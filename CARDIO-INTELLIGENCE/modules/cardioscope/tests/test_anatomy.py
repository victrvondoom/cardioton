import copy
import io
import zipfile

import pytest

from ml.anatomy import HTTPRangeFile, inspect_obj, resolve_groups
from ml.common import ROOT, read_json


def mapping_fixture():
    config = copy.deepcopy(read_json(ROOT / "config/anatomy.json"))
    parts = "concept id\trepresentation id\ten\n"
    elements = "concept id\tname\telement file id\n"
    for key, value in config["structures"].items():
        value["expected_leaves"] = 4 if key == "heart" else 1
        parts += f"{value['concept_id']}\t{value['representation_id']}\t{value['source_name']}\n"
        leaves = (
            ["FJ1", "FJ2", "FJ3", "FJ4"]
            if key == "heart"
            else {"LAD": ["FJ2"], "LCX": ["FJ3"], "RCA": ["FJ4"]}[key]
        )
        for leaf in leaves:
            elements += f"{value['concept_id']}\t{value['source_name']}\t{leaf}\n"
    return config, parts, elements


def test_real_concepts_resolve_to_disjoint_leaf_groups():
    config, parts, elements = mapping_fixture()
    groups = resolve_groups(parts, elements, config)
    assert groups["heart"]["leaf_ids"] == ["FJ1"]
    all_leaves = [leaf for group in groups.values() for leaf in group["leaf_ids"]]
    assert len(all_leaves) == len(set(all_leaves)) == 4
    assert groups["LAD"]["representation_id"] == "BP9548"


def test_source_suffix_ids_are_supported_but_path_traversal_is_rejected():
    config, parts, elements = mapping_fixture()
    assert resolve_groups(parts, elements.replace("FJ1", "FJ1M"), config)["heart"]["leaf_ids"] == [
        "FJ1M"
    ]
    with pytest.raises(ValueError, match="Unsafe"):
        resolve_groups(parts, elements.replace("FJ1", "../FJ1"), config)


def test_changed_concepts_and_leaf_counts_fail_closed():
    config, parts, elements = mapping_fixture()
    with pytest.raises(ValueError, match="representation"):
        resolve_groups(parts.replace("BP9548", "BP9999"), elements, config)
    with pytest.raises(ValueError, match="leaf mapping"):
        resolve_groups(parts, elements.replace("FMA3862", "FMA999"), config)


def test_obj_inspection_preserves_shared_coordinates_and_supports_relative_indices():
    content = b"v 10 20 1200\nv 11 20 1200\nv 10 21 1200\nf -3 -2 -1\n"
    result = inspect_obj(content)
    assert result["vertices"] == 3 and result["faces"] == 1
    assert result["bounds_min"] == [10, 20, 1200]
    assert result["bounds_max"] == [11, 21, 1200]


@pytest.mark.parametrize(
    "content",
    [
        b"v 0 0 0\n",
        b"v nan 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n",
        b"v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 4\n",
        b"v 0 0 0\nv 1 0 0\nv 0 1 0\nf 0 1 2\n",
        b"v 0 0 0\nv 1 0 0\nf 0 1 2\nv 0 1 0\n",
        b"v 0 0 0\nv 1 0 0\nf -3 -2 -1\nv 0 1 0\n",
    ],
)
def test_corrupt_or_empty_obj_is_rejected(content):
    with pytest.raises(ValueError):
        inspect_obj(content)


class RangeResponse:
    status_code = 206

    def __init__(self, content, start, end, total, etag='"fixture"'):
        self.content = content
        self.headers = {
            "Content-Range": f"bytes {start}-{end}/{total}",
            "ETag": etag,
            "Last-Modified": "Thu, 01 Oct 2026 00:00:00 GMT",
        }

    def raise_for_status(self):
        pass


class RangeSession:
    def __init__(self, content):
        self.content = content
        self.changed = False

    def get(self, url, headers, timeout):
        start, end = map(int, headers["Range"].split("=")[1].split("-"))
        return RangeResponse(
            self.content[start : end + 1],
            start,
            end,
            len(self.content),
            '"changed"' if self.changed else '"fixture"',
        )

    def close(self):
        pass


def test_zip_subset_range_reader_never_downloads_unselected_mesh(monkeypatch):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("FJ1.obj", b"selected mesh")
        archive.writestr("unselected.bin", b"x" * 200_000)
    raw = buffer.getvalue()
    client = RangeSession(raw)
    monkeypatch.setattr("ml.anatomy.session", lambda: client)
    with HTTPRangeFile("https://fixture.invalid/source.zip") as remote:
        with zipfile.ZipFile(remote) as archive:
            assert archive.read("FJ1.obj") == b"selected mesh"
        assert remote.bytes_received < 10_000


def test_range_reader_detects_archive_snapshot_change(monkeypatch):
    client = RangeSession(b"some archive bytes")
    monkeypatch.setattr("ml.anatomy.session", lambda: client)
    with HTTPRangeFile("https://fixture.invalid/source.zip") as remote:
        client.changed = True
        with pytest.raises(ValueError, match="snapshot changed"):
            remote.read(3)
