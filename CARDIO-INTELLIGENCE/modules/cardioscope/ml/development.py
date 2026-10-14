"""Read only development outcomes; holdout cells are never decoded or summarized."""

import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

import pandas as pd
import sklearn

from ml.common import ROOT, digest, object_digest, read_json
from ml.data import assert_feature_columns, dataset_config, encoded_targets, validate_source

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def verify_locked_inputs(root: Path = ROOT, *, anatomy: bool = False) -> dict:
    lock = read_json(root / "config/development_access.json")
    for name, expected in lock["files"].items():
        if name.startswith("assets/") and not anatomy:
            continue
        if digest((root / name).read_bytes()) != expected:
            raise ValueError(f"Locked phase-one input changed: {name}")
    return lock


def validate_folds(ids, groups: pd.Series, nested: dict, targets: list[str]) -> None:
    """Validate persisted IDs/group boundaries without creating any new splits."""
    from ml.splits import assert_disjoint_groups

    development = set(ids)
    if len(development) != len(ids) or set(groups.index) != development:
        raise ValueError("Development identity/group alignment differs")
    if set(nested) != set(targets):
        raise ValueError("Nested target set differs")
    lookup = groups.to_dict()

    def partition(train, validation, parent):
        if len(set(train)) != len(train) or len(set(validation)) != len(validation):
            raise ValueError("Repeated fold IDs")
        if set(train) | set(validation) != parent:
            raise ValueError("Fold escapes or incompletely covers its development parent")
        assert_disjoint_groups(train, validation, lookup)

    for outer in nested.values():
        if len(outer) != 5:
            raise ValueError("Locked protocol requires five outer folds")
        seen = []
        for fold in outer:
            train, validation = fold["train_ids"], fold["validation_ids"]
            partition(train, validation, development)
            seen.extend(validation)
            if len(fold["inner"]) != 3:
                raise ValueError("Locked protocol requires three inner folds")
            inner_seen = []
            for inner in fold["inner"]:
                partition(inner["train_ids"], inner["validation_ids"], set(train))
                inner_seen.extend(inner["validation_ids"])
            if Counter(inner_seen) != Counter(train):
                raise ValueError("Inner validation coverage differs")
        if Counter(seen) != Counter(ids):
            raise ValueError("Outer validation coverage differs")


def decode_cell(cell, strings: list[str]):
    """Called for predictors/header cells and DEVELOPMENT target cells only."""
    if cell is None:
        raise ValueError("Missing cells require explicit source review")
    kind = cell.get("t", "n")
    if kind == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//" + NS + "t"))
    value = cell.find(NS + "v")
    if value is None or value.text is None:
        raise ValueError("Missing workbook value")
    if kind == "s":
        return strings[int(value.text)]
    if kind == "n":
        return float(value.text)
    if kind == "str":
        return value.text
    raise ValueError(f"Unsupported source cell type: {kind}")


def read_development_rows(path: Path, config: dict, manifest: dict, split: dict) -> pd.DataFrame:
    """Identify membership by the existing predictor-group hashes BEFORE target decoding.

    Opaque ZIP/XML bytes are read for integrity. Predictor cells are hashed for membership;
    holdout target cells are skipped, not converted to values. No holdout statistics exist here.
    """
    dev_ids = set(split["development_ids"])
    lookup = {r["row_id"]: r["group_id"] for r in split["records"]}
    dev_groups = {lookup[i] for i in dev_ids}
    other_groups = {g for i, g in lookup.items() if i not in dev_ids}
    if dev_groups & other_groups:
        raise ValueError("Development/holdout duplicate-group overlap")
    specs = {f["name"]: f for f in manifest["features"]}
    target_columns = [v["column"] for v in config["targets"].values()]
    columns = config["features"] + target_columns
    records = {}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [
                "".join(t.text or "" for t in item.findall(".//" + NS + "t"))
                for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))
            ]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = workbook.find(NS + "sheets")[0]  # Same first worksheet as phase one.
        relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in relations if r.get("Id") == sheet.get(REL + "id"))
        sheet_path = posixpath.normpath(posixpath.join("xl", target))
        if target.startswith("/"):
            sheet_path = target.lstrip("/")
        if not sheet_path.startswith("xl/worksheets/"):
            raise ValueError("Unexpected source worksheet path")
        header = None
        rows_seen = 0
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
                        raise ValueError("Workbook header differs from the locked contract")
                    row.clear()
                    continue
                rows_seen += 1
                features = {}
                for name in config["features"]:
                    cell = cells.get(header[name])
                    if cell is not None and cell.find(NS + "f") is not None:
                        # Verified source formulas: BMI from Weight/Length and Obesity from BMI.
                        # Use the immutable cached values exactly as phase-one openpyxl did.
                        if name not in {"BMI", "Obesity"}:
                            raise ValueError(f"Unreviewed predictor formula: {name}")
                    value = decode_cell(cell, strings)
                    kind = specs[name]["kind"]
                    if kind == "integer":
                        if not isinstance(value, float) or not value.is_integer():
                            raise ValueError(f"Unexpected integer source value: {name}")
                        value = int(value)
                    elif kind == "number":
                        value = float(value)
                    features[name] = value
                group_id = object_digest(features)
                if group_id in dev_groups:
                    record = {
                        **features,
                        **{
                            name: decode_cell(cells.get(header[name]), strings)
                            for name in target_columns
                        },
                    }
                    row_id = object_digest(record)
                    if row_id not in dev_ids or row_id in records:
                        raise ValueError("Development row identity changed or duplicated")
                    records[row_id] = record
                elif group_id not in other_groups:
                    raise ValueError("Source predictor identity differs from the locked source")
                row.clear()
        if rows_seen != config["expected_rows"] or set(records) != dev_ids:
            raise ValueError("Source/development membership incomplete")
    result = pd.DataFrame.from_dict(records, orient="index").loc[split["development_ids"], columns]
    validate_source(result, {**config, "expected_rows": len(dev_ids)})
    return result


def load_safe_development(root: Path):
    from ml.splits import DevelopmentData

    verify_locked_inputs(root)
    config = dataset_config(root)
    manifest = read_json(root / "artifacts/data/feature_manifest.json")
    split = read_json(root / "artifacts/data/split.json")
    if split["scikit_learn_version"] != sklearn.__version__:
        raise ValueError("Library version differs from locked folds")
    if split["feature_contract_sha256"] != object_digest(config):
        raise ValueError("Feature contract fingerprint differs")
    if split["strategy"] != read_json(root / "config/split.json"):
        raise ValueError("Split strategy changed")
    if manifest["feature_order"] != config["features"] or manifest["targets"] != config["targets"]:
        raise ValueError("Feature/target manifest differs from the source contract")
    dev = read_development_rows(
        root / "data/raw/uci-411" / config["workbook"], config, manifest, split
    )
    lookup = {r["row_id"]: r["group_id"] for r in split["records"]}
    groups = pd.Series(lookup).loc[dev.index]
    features = dev[config["features"]].copy()
    assert_feature_columns(features.columns, config)
    targets = encoded_targets(dev, config)
    validate_folds(features.index, groups, split["nested_cv"], list(targets))
    return DevelopmentData(features, targets, groups, split["nested_cv"])
