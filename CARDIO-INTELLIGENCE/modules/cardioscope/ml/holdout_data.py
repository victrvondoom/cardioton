"""Deliberate final-evaluation reader: only selected holdout outcomes are decoded.

Call only AFTER the durable evaluation reservation. No training or split generation.
"""

import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from ml.common import object_digest
from ml.data import encoded_targets, validate_source
from ml.development import NS, REL, decode_cell


@dataclass(frozen=True)
class HoldoutData:
    features: pd.DataFrame
    targets: pd.DataFrame


def validate_membership(split: dict, expected_count: int, expected_sha256: str) -> None:
    ids, development = split["holdout_ids"], split["development_ids"]
    if len(ids) != expected_count or len(set(ids)) != len(ids):
        raise ValueError("Incorrect or duplicate holdout membership")
    if object_digest(ids) != expected_sha256 or set(ids) & set(development):
        raise ValueError("Holdout membership fingerprint/partition differs")
    records = split["records"]
    if len({r["row_id"] for r in records}) != len(records):
        raise ValueError("Duplicate source record IDs")
    lookup = {r["row_id"]: r["group_id"] for r in records}
    if set(lookup) != set(ids) | set(development):
        raise ValueError("Source membership does not cover the two locked partitions")
    if {lookup[i] for i in ids} & {lookup[i] for i in development}:
        raise ValueError("Duplicate groups cross development/holdout boundary")


def load_reserved_holdout(
    path: Path, config: dict, manifest: dict, split: dict, expected_count: int, expected_sha256: str
) -> HoldoutData:
    """Predictor hashes identify membership before decoding a selected target cell."""
    validate_membership(split, expected_count, expected_sha256)
    holdout_ids = split["holdout_ids"]
    lookup = {r["row_id"]: r["group_id"] for r in split["records"]}
    holdout_groups = {lookup[i] for i in holdout_ids}
    dev_groups = {lookup[i] for i in split["development_ids"]}
    specs = {f["name"]: f for f in manifest["features"]}
    target_columns = [t["column"] for t in config["targets"].values()]
    columns = config["features"] + target_columns
    selected = {}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [
                "".join(t.text or "" for t in item.findall(".//" + NS + "t"))
                for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))
            ]
        book = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = book.find(NS + "sheets")[0]
        relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in relations if r.get("Id") == sheet.get(REL + "id"))
        sheet_path = (
            target.lstrip("/")
            if target.startswith("/")
            else posixpath.normpath(posixpath.join("xl", target))
        )
        if not sheet_path.startswith("xl/worksheets/"):
            raise ValueError("Unexpected source worksheet path")
        header, rows_seen = None, 0
        with archive.open(sheet_path) as stream:
            for _, row in ET.iterparse(stream, events=["end"]):
                if row.tag != NS + "row":
                    continue
                cells = {re.sub(r"\d", "", c.get("r", "")): c for c in row if c.tag == NS + "c"}
                if not cells:
                    row.clear()
                    continue
                if header is None:
                    header = {decode_cell(c, strings): letter for letter, c in cells.items()}
                    if set(header) != set(columns) or len(cells) != len(columns):
                        raise ValueError("Workbook header differs from frozen schema")
                    row.clear()
                    continue
                rows_seen += 1
                features = {}
                for name in config["features"]:
                    cell = cells.get(header[name])
                    if cell is not None and cell.find(NS + "f") is not None:
                        if name not in {"BMI", "Obesity"}:
                            raise ValueError("Unreviewed predictor formula: " + name)
                    value = decode_cell(cell, strings)
                    if specs[name]["kind"] == "integer":
                        if not isinstance(value, float) or not value.is_integer():
                            raise ValueError("Unexpected integral predictor: " + name)
                        value = int(value)
                    elif specs[name]["kind"] == "number":
                        value = float(value)
                    features[name] = value
                group = object_digest(features)
                if group in holdout_groups:
                    record = {
                        **features,
                        **{
                            name: decode_cell(cells.get(header[name]), strings)
                            for name in target_columns
                        },
                    }
                    row_id = object_digest(record)
                    if row_id not in holdout_ids or row_id in selected:
                        raise ValueError("Changed or duplicate holdout source record")
                    selected[row_id] = record
                elif group not in dev_groups:
                    raise ValueError("Unexpected source predictor identity")
                row.clear()
    if rows_seen != config["expected_rows"] or set(selected) != set(holdout_ids):
        raise ValueError("Missing holdout/source records; no row may be silently dropped")
    frame = pd.DataFrame.from_dict(selected, orient="index").loc[holdout_ids, columns]
    validate_source(frame, {**config, "expected_rows": expected_count})
    return HoldoutData(frame[config["features"]].copy(), encoded_targets(frame, config))
