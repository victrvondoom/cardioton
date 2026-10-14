"""Acquire the pinned UCI workbook and produce descriptive, non-fitted artifacts."""

import argparse
import io
import math
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from ml.common import (
    ROOT,
    digest,
    download,
    object_digest,
    read_json,
    utc_now,
    write_json_once,
    write_once,
)


def dataset_config(root: Path = ROOT) -> dict:
    return read_json(root / "config/dataset.json")


def scalar(value):
    if pd.isna(value):
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Non-finite source value")
    return value


def normalized_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.casefold())


def assert_feature_columns(columns, config: dict, *, exact: bool = True) -> None:
    columns = list(columns)
    forbidden = {normalized_name(name) for name in config["forbidden_feature_aliases"]}
    forbidden.update(normalized_name(t["column"]) for t in config["targets"].values())
    if any(normalized_name(name) in forbidden for name in columns):
        raise ValueError("Target leakage: a target or alias appears in the model inputs")
    if len(columns) != len(set(columns)):
        raise ValueError("Duplicate input columns")
    if not set(columns).issubset(config["features"]):
        raise ValueError("Unknown/derived input columns are outside the explicit feature allowlist")
    if exact and columns != config["features"]:
        raise ValueError("Input feature order/set differs from the manifest")


def validate_source(frame: pd.DataFrame, config: dict) -> None:
    expected = config["features"] + [t["column"] for t in config["targets"].values()]
    if frame.columns.duplicated().any() or set(frame.columns) != set(expected):
        raise ValueError("Workbook columns differ from the verified source contract")
    if len(frame) != config["expected_rows"]:
        raise ValueError(f"Expected {config['expected_rows']} records, found {len(frame)}")
    if frame.isna().any().any():
        raise ValueError("Unexpected empty cells in the pinned complete workbook")
    assert_feature_columns(config["features"], config)
    for target in config["targets"].values():
        values = set(frame[target["column"]].unique())
        expected_labels = {target["negative_class"], target["positive_class"]}
        if values != expected_labels:
            raise ValueError(f"Unexpected labels in {target['column']}: {values}")
    for name in frame.select_dtypes(include="number").columns:
        if not np.isfinite(frame[name].to_numpy()).all():
            raise ValueError(f"Non-finite numbers in {name}")


def acquire(root: Path = ROOT) -> Path:
    config = dataset_config(root)
    raw_dir = root / "data/raw/uci-411"
    zip_path = raw_dir / "source.zip"
    record_path = raw_dir / "provenance.json"
    record = download(config["source_url"], zip_path, config["zip_sha256"])
    with zipfile.ZipFile(zip_path) as archive:
        # Extract only the exact member, never arbitrary ZIP paths.
        workbook = archive.read(config["workbook"])
    workbook_path = raw_dir / config["workbook"]
    write_once(workbook_path, workbook)
    if record_path.exists():
        previous = read_json(record_path)
        if previous["workbook_sha256"] != digest(workbook):
            raise ValueError("Workbook provenance changed")
    else:
        write_json_once(
            record_path,
            {
                **record,
                "acquired_at_utc": utc_now(),
                "workbook": config["workbook"],
                "workbook_sha256": digest(workbook),
                "license": config["license"],
                "doi": config["doi"],
            },
        )
    return workbook_path


def load_workbook(path: Path, config: dict) -> pd.DataFrame:
    frame = pd.read_excel(io.BytesIO(path.read_bytes()), engine="openpyxl")
    validate_source(frame, config)
    return frame


def identities(frame: pd.DataFrame, config: dict) -> pd.DataFrame:
    """Content IDs are record IDs, not invented clinical patient identifiers."""
    rows = []
    all_columns = config["features"] + [t["column"] for t in config["targets"].values()]
    for _, row in frame.iterrows():
        features = {name: scalar(row[name]) for name in config["features"]}
        record = {name: scalar(row[name]) for name in all_columns}
        rows.append({"row_id": object_digest(record), "group_id": object_digest(features)})
    result = pd.DataFrame(rows, index=frame.index)
    # Exact duplicates cannot be given distinct, purportedly patient-level identities.
    if result.row_id.duplicated().any():
        raise ValueError("Exact duplicate records require a documented deduplication decision")
    if config["patient_id_column"] is not None:
        raise ValueError("Known patient-ID grouping requires an explicit reviewed source update")
    return result


def encoded_targets(frame: pd.DataFrame, config: dict) -> pd.DataFrame:
    result = {}
    for key, target in config["targets"].items():
        mapping = {target["negative_class"]: 0, target["positive_class"]: 1}
        values = frame[target["column"]].map(mapping)
        if values.isna().any():
            raise ValueError(f"Unknown label for {key}")
        result[key] = values.astype(int)
    return pd.DataFrame(result, index=frame.index)


def audit(frame: pd.DataFrame, config: dict) -> dict:
    ids = identities(frame, config)
    column_audit = {}
    for name in frame.columns:
        values = frame[name]
        entry = {
            "storage_dtype": str(values.dtype),
            "missing": int(values.isna().sum()),
            "distinct": int(values.nunique()),
            "unit": None,
            "unit_status": "not established by the inspected workbook",
        }
        if pd.api.types.is_numeric_dtype(values):
            entry["observed_min"] = scalar(values.min())
            entry["observed_max"] = scalar(values.max())
        else:
            entry["observed_values"] = sorted(values.unique().tolist())
            entry["whitespace_values"] = [v for v in values.unique() if v != v.strip()]
        column_audit[name] = entry
    y = encoded_targets(frame, config)
    vessel_union = y[["LAD", "LCX", "RCA"]].max(axis=1)
    inconsistent = ids.loc[y.CAD != vessel_union, "row_id"].tolist()
    return {
        "schema_version": 1,
        "rows": len(frame),
        "columns": len(frame.columns),
        "predictors": len(config["features"]),
        "missing_cells": int(frame.isna().sum().sum()),
        "exact_duplicate_rows": int(frame.duplicated().sum()),
        "duplicate_predictor_groups": int((ids.group_id.value_counts() > 1).sum()),
        "constant_columns": [name for name in frame if frame[name].nunique() == 1],
        "targets": {
            key: {
                "source_column": t["column"],
                "counts": {str(k): int(v) for k, v in frame[t["column"]].value_counts().items()},
            }
            for key, t in config["targets"].items()
        },
        "cad_vessel_union_inconsistent_row_ids": inconsistent,
        "column_audit": column_audit,
        "notes": [
            "Descriptive full-source integrity audit, "
            "not fitted preprocessing or model evaluation.",
            "Observed ranges are not clinical reference ranges or input rejection thresholds.",
            "Possible numeric sentinel codes are unverified; "
            "zero is not silently treated as missing.",
            "No authoritative patient identifiers: "
            "identical predictor rows are conservatively grouped.",
            "Source spellings, casing, and constant columns are retained "
            "without clinical reinterpretation.",
        ],
    }


def feature_manifest(development: pd.DataFrame, config: dict, provenance: dict) -> dict:
    """Domains come only from development records; no learned holdout metadata."""
    features = []
    for name in config["features"]:
        values = development[name]
        if pd.api.types.is_integer_dtype(values):
            kind = "integer"
        elif pd.api.types.is_float_dtype(values):
            kind = "number"
        else:
            kind = "category"
        features.append(
            {
                "name": name,
                "kind": kind,
                "storage_dtype": str(values.dtype),
                "unit": None,
                "unit_status": "undocumented",
                "categories": sorted(values.unique().tolist()) if kind == "category" else None,
                "categories_source": "development partition only" if kind == "category" else None,
                "required": True,
            }
        )
    return {
        "schema_version": 1,
        "dataset_zip_sha256": provenance["sha256"],
        "workbook_sha256": provenance["workbook_sha256"],
        "feature_order": config["features"],
        "features": features,
        "targets": config["targets"],
        "forbidden_feature_aliases": config["forbidden_feature_aliases"],
        "missing_input_policy": "reject; no imputation has been fitted",
        "preprocessing_fitted": False,
    }


def prepare(root: Path = ROOT) -> dict:
    from ml.splits import create_or_verify_split, development_frame

    config = dataset_config(root)
    workbook = acquire(root)
    frame = load_workbook(workbook, config)
    provenance = read_json(workbook.parent / "provenance.json")
    out = root / "artifacts/data"
    write_json_once(out / "audit.json", audit(frame, config))
    split = create_or_verify_split(
        frame, config, read_json(root / "config/split.json"), provenance, out / "split.json"
    )
    development = development_frame(frame, config, split)
    manifest = feature_manifest(development, config, provenance)
    write_json_once(out / "feature_manifest.json", manifest)
    return {
        "rows": len(frame),
        "features": len(manifest["features"]),
        "development": len(split["development_ids"]),
        "holdout": len(split["holdout_ids"]),
        "artifacts": str(out),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "verify"])
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args.root)
    elif (args.root / "config/development_access.json").exists():
        from ml.development import verify_locked_inputs
        from ml.splits import load_development

        verify_locked_inputs(args.root)
        development = load_development(args.root)
        result = {
            "verified": True,
            "scope": "immutable source bytes and development-only contract/folds",
            "development_rows": len(development.features),
            "holdout_targets_decoded": False,
            "folds_regenerated": False,
        }
    else:
        from ml.splits import development_frame, verify_split

        config = dataset_config(args.root)
        raw = args.root / "data/raw/uci-411"
        source = read_json(raw / "provenance.json")
        if digest((raw / "source.zip").read_bytes()) != config["zip_sha256"]:
            raise ValueError("Cached ZIP checksum changed")
        workbook = raw / config["workbook"]
        if digest(workbook.read_bytes()) != source["workbook_sha256"]:
            raise ValueError("Cached workbook checksum changed")
        frame = load_workbook(workbook, config)
        split = read_json(args.root / "artifacts/data/split.json")
        verify_split(frame, config, read_json(args.root / "config/split.json"), source, split)
        development = development_frame(frame, config, split)
        expected = feature_manifest(development, config, source)
        if expected != read_json(args.root / "artifacts/data/feature_manifest.json"):
            raise ValueError("Feature manifest changed")
        if audit(frame, config) != read_json(args.root / "artifacts/data/audit.json"):
            raise ValueError("Audit artifact changed")
        result = {"verified": True, "rows": len(frame)}
    print(__import__("json").dumps(result, indent=2))


if __name__ == "__main__":
    main()
