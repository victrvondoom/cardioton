"""Load and encode the UCI 'Extension of Z-Alizadeh Sani' dataset (303 patients)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "z_alizadeh_sani_extension.xlsx"

TARGETS = ["CAD", "LAD", "LCX", "RCA"]
# Never used as model inputs (target leakage), per the Track A brief.
LEAKY = ["LAD", "LCX", "RCA", "Cath"]
CONSTANT = ["Exertional CP"]  # single value in all 303 rows

YES_NO = [
    "Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease", "CHF", "DLP", "Weak Peripheral Pulse",
    "Lung rales", "Systolic Murmur", "Diastolic Murmur", "Dyspnea", "Atypical", "Nonanginal", "LowTH Ang",
    "LVH", "Poor R Progression",
]
BINARY_01 = ["DM", "HTN", "Current Smoker", "EX-Smoker", "FH", "Edema", "Typical Chest Pain", "Q Wave",
             "St Elevation", "St Depression", "Tinversion"]
NUMERIC = ["Age", "Weight", "Length", "BMI", "BP", "PR", "Function Class", "FBS", "CR", "TG", "LDL", "HDL", "BUN",
           "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut", "PLT", "EF-TTE", "Region RWMA"]
VHD_LEVELS = {"N": 0, "mild": 1, "Moderate": 2, "Severe": 3}
BBB_LEVELS = ["N", "LBBB", "RBBB"]

# Feature metadata used by the API and the UI.
FEATURE_GROUPS = {
    "Demographics": ["Age", "Sex", "Weight", "Length", "BMI"],
    "History and risk factors": ["DM", "HTN", "Current Smoker", "EX-Smoker", "FH", "Obesity", "CRF", "CVA",
                                 "Airway disease", "Thyroid Disease", "CHF", "DLP"],
    "Examination": ["BP", "PR", "Edema", "Weak Peripheral Pulse", "Lung rales", "Systolic Murmur",
                    "Diastolic Murmur"],
    "Symptoms": ["Typical Chest Pain", "Dyspnea", "Function Class", "Atypical", "Nonanginal", "LowTH Ang"],
    "ECG": ["Q Wave", "St Elevation", "St Depression", "Tinversion", "LVH", "Poor R Progression", "BBB"],
    "Laboratory": ["FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut", "PLT"],
    "Echocardiography": ["EF-TTE", "Region RWMA", "VHD"],
}
RAW_FEATURES = [f for group in FEATURE_GROUPS.values() for f in group]


def load_raw(path: Path = DATA_PATH) -> pd.DataFrame:
    return pd.read_excel(path)


def targets(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "CAD": (df["Cath"] == "CAD").astype(int),
            "LAD": (df["LAD"] == "Stenotic").astype(int),
            "LCX": (df["LCX"] == "Stenotic").astype(int),
            "RCA": (df["RCA"] == "Stenotic").astype(int),
        },
        index=df.index,
    )


def encode(raw: pd.DataFrame) -> pd.DataFrame:
    """Raw clinical columns -> numeric model matrix. Works for the dataset or for one API record."""
    missing = [c for c in RAW_FEATURES if c not in raw.columns]
    if missing:
        raise KeyError(f"missing features: {missing}")
    out = pd.DataFrame(index=raw.index)
    for c in NUMERIC:
        out[c] = pd.to_numeric(raw[c]).astype(float)
    out["Sex_male"] = (raw["Sex"].astype(str).str.lower() == "male").astype(float)
    for c in YES_NO:
        out[c] = raw[c].map(lambda v: 1.0 if str(v).upper() in ("Y", "1", "TRUE", "YES") else 0.0)
    for c in BINARY_01:
        out[c] = raw[c].map(lambda v: 1.0 if str(v).upper() in ("Y", "1", "TRUE", "YES", "1.0") else 0.0)
    out["VHD"] = raw["VHD"].map(lambda v: float(VHD_LEVELS.get(str(v), VHD_LEVELS.get(str(v).capitalize(), 0))))
    for lvl in BBB_LEVELS[1:]:
        out[f"BBB_{lvl}"] = (raw["BBB"].astype(str) == lvl).astype(float)
    return out


def load_xy(path: Path = DATA_PATH) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    raw = load_raw(path)
    leak = [c for c in LEAKY if c in RAW_FEATURES]
    assert not leak, leak
    return raw, encode(raw), targets(raw)


def feature_names() -> list[str]:
    raw = load_raw()
    return list(encode(raw.head(1)).columns)


def raw_record_types() -> dict[str, str]:
    t = {}
    for c in RAW_FEATURES:
        if c in NUMERIC:
            t[c] = "number"
        elif c == "Sex":
            t[c] = "Male|Fmale"
        elif c == "VHD":
            t[c] = "|".join(VHD_LEVELS)
        elif c == "BBB":
            t[c] = "|".join(BBB_LEVELS)
        elif c in YES_NO:
            t[c] = "Y|N"
        else:
            t[c] = "1|0"
    return t


def to_jsonable(row: pd.Series) -> dict:
    d = {}
    for k, v in row.items():
        if isinstance(v, (np.integer,)):
            v = int(v)
        elif isinstance(v, (np.floating,)):
            v = float(v)
        d[k] = v
    return d
