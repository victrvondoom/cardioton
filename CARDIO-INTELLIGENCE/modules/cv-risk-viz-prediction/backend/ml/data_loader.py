# Data loader for the UCI Extension of Z-Alizadeh Sani dataset (UCI ID 411).
# DOI: 10.24432/C5461K
# Loads, validates and encodes the dataset. Positive class = 1 (CAD / Stenotic).
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "cv_risk_viz_prediction__data_raw__extention of Z-Alizadeh sani dataset.xlsx"
SHEET_NAME = "Sheet 1 - Table 1"

TARGETS: dict[str, str] = {"cad": "Cath", "lad": "LAD", "lcx": "LCX", "rca": "RCA"}
POSITIVE_LABELS: dict[str, str] = {"cad": "CAD", "lad": "Stenotic", "lcx": "Stenotic", "rca": "Stenotic"}
FORBIDDEN_COLUMNS = ["LAD", "LCX", "RCA", "Cath"]

EXPECTED_N_ROWS = 303


@dataclass
class DatasetBundle:
    X: pd.DataFrame
    y: dict[str, pd.Series]
    feature_names: list[str] = field(default_factory=list)
    categorical_features: list[str] = field(default_factory=list)


def load_raw(path: Path | str = DATA_PATH) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=SHEET_NAME)
    required = list(df.columns)
    missing = [c for c in [*TARGETS.values()] if c not in required]
    if missing:
        raise ValueError(f"Missing target columns: {missing}")
    return df


def validate(df: pd.DataFrame) -> dict:
    # Dataset validation report: dims, missing, duplicates, encodings, ranges.
    report: dict = {
        "n_rows": int(len(df)),
        "n_columns": int(df.shape[1]),
        "missing_per_column": df.isna().sum().sum(),
        "duplicate_rows": int(df.duplicated().sum()),
        "target_encoding": {k: str(sorted(df[v].unique().tolist())) for k, v in TARGETS.items()},
        "class_counts": {},
    }
    for key, col in TARGETS.items():
        report["class_counts"][key] = df[col].value_counts().to_dict()
    return report


def make_targets(df: pd.DataFrame) -> dict[str, pd.Series]:
    # Binary targets: 1 = positive (CAD / Stenotic), 0 = Normal.
    y: dict[str, pd.Series] = {}
    for key, col in TARGETS.items():
        s = df[col].map({POSITIVE_LABELS[key]: 1, "Normal": 0})
        if s.isna().any():
            unknown = df.loc[s.isna(), col].unique().tolist()
            raise ValueError(f"Unmapped target label in {col}: {unknown}")
        y[key] = s.astype(int)
    return y


def build_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    # Feature matrix excluding every forbidden angiography column.
    feature_cols = [c for c in df.columns if c not in FORBIDDEN_COLUMNS]
    X = df[feature_cols].copy()
    # Numeric binary cols already 0/1; string categorical ('Male'/'Fmale', 'Y'/'N',
    # VHD severity) handled downstream by preprocessing pipeline.
    cat = [c for c in feature_cols if str(X[c].dtype) in ("object", "str") or str(X[c].dtype).startswith("str")]
    return X, cat


def load(path: Path | str = DATA_PATH) -> DatasetBundle:
    raw = load_raw(path)
    rep = validate(raw)
    if rep["n_rows"] != EXPECTED_N_ROWS:
        raise ValueError(f"Unexpected dataset size {rep['n_rows']} != {EXPECTED_N_ROWS}")
    y = make_targets(raw)
    X, cat = build_features(raw)
    return DatasetBundle(X=X, y=y, feature_names=list(X.columns), categorical_features=cat)


if __name__ == "__main__":
    raw = load_raw()
    print(validate(raw).__repr__())
