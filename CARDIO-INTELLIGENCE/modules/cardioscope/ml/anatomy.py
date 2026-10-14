"""Acquire verified BodyParts3D leaf meshes and disjoint coronary groups.

Raw OBJ coordinates are preserved. One shared center/scale is recorded for a
future assembled viewer; each leaf is never centered independently.
"""

import argparse
import csv
import io
import json
import re
import zipfile
from pathlib import Path

import numpy as np

from ml.common import ROOT, digest, download, read_json, session, write_json_once, write_once


class HTTPRangeFile(io.RawIOBase):
    """Seekable ZIP source fetching only requested byte ranges (no full archive)."""

    def __init__(self, url: str):
        self.url = url
        self.client = session()
        response = self.client.get(url, headers={"Range": "bytes=0-0"}, timeout=(15, 60))
        response.raise_for_status()
        if response.status_code != 206:
            self.client.close()
            raise ValueError(
                "Anatomy server must support byte ranges; no silent full-download fallback"
            )
        match = re.fullmatch(r"bytes 0-0/(\d+)", response.headers.get("Content-Range", ""))
        if not match or len(response.content) != 1:
            self.client.close()
            raise ValueError("Invalid range response")
        self.size = int(match[1])
        self.etag = response.headers.get("ETag")
        self.modified = response.headers.get("Last-Modified")
        if not self.etag and not self.modified:
            self.client.close()
            raise ValueError(
                "Archive needs an ETag or modification timestamp to prevent mixed versions"
            )
        self.position = 0
        self.bytes_received = 1

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        position = (
            offset if whence == 0 else self.position + offset if whence == 1 else self.size + offset
        )
        if position < 0 or whence not in [0, 1, 2]:
            raise ValueError("Invalid seek")
        self.position = position
        return position

    def read(self, size=-1):
        size = min(self.size - self.position, size if size >= 0 else self.size)
        if size <= 0:
            return b""
        start, end = self.position, self.position + size - 1
        headers = {"Range": f"bytes={start}-{end}"}
        if self.etag and not self.etag.startswith("W/"):
            headers["If-Match"] = self.etag
        elif self.modified:
            headers["If-Unmodified-Since"] = self.modified
        else:
            raise ValueError("Weak ETag without timestamp cannot pin a ZIP snapshot")
        response = self.client.get(self.url, headers=headers, timeout=(15, 60))
        response.raise_for_status()
        expected_range = f"bytes {start}-{end}/{self.size}"
        if response.status_code != 206 or response.headers.get("Content-Range") != expected_range:
            raise ValueError("Archive version/range changed during extraction")
        if (
            response.headers.get("ETag") != self.etag
            or response.headers.get("Last-Modified") != self.modified
        ):
            raise ValueError("Archive snapshot changed during extraction")
        content = response.content
        if len(content) != size:
            raise ValueError("Incomplete anatomy range response")
        self.position += size
        self.bytes_received += size
        return content

    def close(self):
        self.client.close()
        super().close()


def resolve_groups(parts_text: str, elements_text: str, config: dict) -> dict:
    parts = {r["concept id"]: r for r in csv.DictReader(io.StringIO(parts_text), delimiter="\t")}
    leaves: dict[str, set[str]] = {}
    for row in csv.DictReader(io.StringIO(elements_text), delimiter="\t"):
        leaf = row["element file id"]
        if not re.fullmatch(r"FJ\d+[A-Z]*", leaf):
            raise ValueError(f"Unsafe/unknown mesh ID: {leaf}")
        leaves.setdefault(row["concept id"], set()).add(leaf)
    resolved = {}
    for key, expected in config["structures"].items():
        part = parts.get(expected["concept_id"])
        if not part or part["representation id"] != expected["representation_id"]:
            raise ValueError(f"Upstream representation changed for {key}")
        if part["en"] != expected["source_name"]:
            raise ValueError(f"Upstream anatomical name changed for {key}")
        members = leaves.get(expected["concept_id"], set())
        if len(members) != expected["expected_leaves"]:
            raise ValueError(f"Upstream leaf mapping changed for {key}: {len(members)}")
        resolved[key] = {**expected, "leaf_ids": sorted(members)}
    arteries = [set(resolved[key]["leaf_ids"]) for key in ["LAD", "LCX", "RCA"]]
    if any(arteries[i] & arteries[j] for i in range(3) for j in range(i)):
        raise ValueError("Overlapping named coronary groups require an explicit anatomy decision")
    coronary = set.union(*arteries)
    heart = set(resolved["heart"]["leaf_ids"])
    if not coronary.issubset(heart):
        raise ValueError(
            "Coronary leaves outside verified heart require reviewed source correction"
        )
    resolved["heart"]["original_leaf_ids"] = sorted(heart)
    resolved["heart"]["leaf_ids"] = sorted(heart - coronary)
    return resolved


def inspect_obj(content: bytes) -> dict:
    vertices, faces = [], []
    for line in content.decode("utf-8-sig").splitlines():
        fields = line.split()
        if not fields or fields[0].startswith("#"):
            continue
        if fields[0] == "v":
            if len(fields) < 4:
                raise ValueError("Malformed OBJ vertex")
            vertices.append([float(value) for value in fields[1:4]])
        elif fields[0] == "f":
            if len(fields) < 4:
                raise ValueError("OBJ face has fewer than three vertices")
            # Negative OBJ indices are relative to the vertex count at this line.
            indices = [int(v.split("/")[0]) for v in fields[1:]]
            if any(index == 0 or index < -len(vertices) for index in indices):
                raise ValueError("OBJ face references an invalid vertex")
            faces.append([index if index > 0 else len(vertices) + index + 1 for index in indices])
    if not vertices or not faces:
        raise ValueError("OBJ mesh has no usable vertices/faces")
    points = np.asarray(vertices)
    if not np.isfinite(points).all():
        raise ValueError("Non-finite OBJ coordinates")
    if any(index < 1 or index > len(vertices) for face in faces for index in face):
        raise ValueError("OBJ face references an invalid vertex")
    return {
        "vertices": len(vertices),
        "faces": len(faces),
        "bounds_min": points.min(axis=0).tolist(),
        "bounds_max": points.max(axis=0).tolist(),
    }


def prepare(root: Path = ROOT) -> dict:
    config = read_json(root / "config/anatomy.json")
    folder = root / "assets/anatomy"
    source_folder = folder / "source"
    source_lock = folder / "sources.json"
    locked = read_json(source_lock) if source_lock.exists() else None
    sources = {}
    for key, filename in [
        ("parts", "parts.tsv"),
        ("elements", "elements.tsv"),
        ("license", "license.html"),
    ]:
        expected = locked["sources"][key]["sha256"] if locked else None
        sources[key] = download(config[f"{key}_url"], source_folder / filename, expected)
    if (
        "Creative Commons Attribution 4.0 International"
        not in (source_folder / "license.html").read_text()
    ):
        raise ValueError("Current archive license differs from the planned attribution terms")
    source_record = {
        "schema_version": 1,
        "sources": sources,
        "archive_url": config["archive_url"],
        "license": config["license"],
        "attribution": config["attribution"],
    }
    write_json_once(source_lock, source_record)
    groups = resolve_groups(
        (source_folder / "parts.tsv").read_text(encoding="utf-8-sig"),
        (source_folder / "elements.tsv").read_text(encoding="utf-8-sig"),
        config,
    )
    required = sorted({leaf for group in groups.values() for leaf in group["leaf_ids"]})
    manifest_path = folder / "manifest.json"
    previous = read_json(manifest_path) if manifest_path.exists() else None
    mesh_records = {}
    missing = [leaf for leaf in required if not (folder / f"meshes/{leaf}.obj").exists()]
    remote = HTTPRangeFile(config["archive_url"]) if missing else None
    try:
        snapshot_path = folder / "archive_snapshot.json"
        if remote:
            snapshot = {"size": remote.size, "etag": remote.etag, "modified": remote.modified}
            # Lock before the first leaf; interrupted runs cannot mix ZIP versions.
            write_json_once(snapshot_path, snapshot)
        elif not snapshot_path.exists():
            raise ValueError("Mesh cache without an authoritative archive snapshot")
        snapshot = read_json(snapshot_path)
        if previous and snapshot != previous["archive_snapshot"]:
            raise ValueError("Locked archive snapshot differs from the anatomy manifest")
        archive = zipfile.ZipFile(remote) if remote else None
        try:
            entries = {}
            if archive:
                for name in archive.namelist():
                    basename = Path(name).name
                    if basename.endswith(".obj"):
                        if basename in entries:
                            raise ValueError("Ambiguous duplicate OBJ entry in upstream ZIP")
                        entries[basename] = name
            for number, leaf in enumerate(required, 1):
                path = folder / f"meshes/{leaf}.obj"
                if not path.exists():
                    if f"{leaf}.obj" not in entries:
                        raise ValueError(f"Verified mapping has no ZIP mesh for {leaf}")
                    content = archive.read(entries[f"{leaf}.obj"])
                    inspect_obj(content)
                    write_once(path, content)
                    print(f"Prepared {number}/{len(required)}: {leaf}", flush=True)
                content = path.read_bytes()
                record = {
                    "path": f"meshes/{leaf}.obj",
                    "sha256": digest(content),
                    "bytes": len(content),
                    **inspect_obj(content),
                }
                # Per-leaf lock survives interruption before the aggregate manifest is written.
                write_json_once(folder / f"checksums/{leaf}.json", record)
                if previous and record != previous["meshes"].get(leaf):
                    raise ValueError(f"Locked anatomy mesh changed: {leaf}")
                mesh_records[leaf] = record
        finally:
            if archive:
                archive.close()
        minimum = np.min([r["bounds_min"] for r in mesh_records.values()], axis=0)
        maximum = np.max([r["bounds_max"] for r in mesh_records.values()], axis=0)
        extent = float(np.max(maximum - minimum))
        if extent <= 0:
            raise ValueError("Degenerate anatomical assembly")
        manifest = {
            "schema_version": 1,
            "groups": groups,
            "meshes": mesh_records,
            "archive_snapshot": snapshot,
            "source_records": source_record,
            "assembly": {
                "bounds_min": minimum.tolist(),
                "bounds_max": maximum.tolist(),
                "center": ((minimum + maximum) / 2).tolist(),
                "scale": 2 / extent,
                "transform": "apply p_view = (p_source - center) * scale to all groups together",
                "coordinate_units": "not independently documented; preserve source coordinates",
            },
            "browser_render_verified": False,
            "anatomical_visual_review_complete": False,
        }
        write_json_once(manifest_path, manifest)
    finally:
        if remote:
            remote.close()
    return {
        "prepared": True,
        "unique_meshes": len(required),
        "group_leaf_counts": {k: len(v["leaf_ids"]) for k, v in groups.items()},
        "manifest": str(manifest_path),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "verify"])
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    if args.command == "verify" and not (args.root / "assets/anatomy/manifest.json").exists():
        raise ValueError("Run prepare first; verify must not initiate first-time acquisition")
    if args.command == "verify":
        manifest = read_json(args.root / "assets/anatomy/manifest.json")
        for record in manifest["meshes"].values():
            path = args.root / "assets/anatomy" / record["path"]
            if not path.exists():
                raise ValueError("Incomplete mesh cache; run prepare to restore pinned sources")
    print(json.dumps(prepare(args.root), indent=2))


if __name__ == "__main__":
    main()
