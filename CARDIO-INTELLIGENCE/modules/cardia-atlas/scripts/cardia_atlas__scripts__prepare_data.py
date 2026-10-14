"""Fetch the public UCI source and write a schema/audit record (no row identifiers)."""
from pathlib import Path
import hashlib, json, zipfile, urllib.request, ssl, certifi
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
XLSX = RAW / "cardia_atlas__data_raw__extention of Z-Alizadeh sani dataset.xlsx"
ZIP = RAW / "uci-411.zip"
URL = "https://archive.ics.uci.edu/static/public/411/extention%2Bof%2Bz%2Balizadeh%2Bsani%2Bdataset.zip"
TARGETS = ["Cath", "LAD", "LCX", "RCA"]
if not XLSX.exists():
    RAW.mkdir(parents=True, exist_ok=True)
    request=urllib.request.Request(URL,headers={"User-Agent":"CardiaAtlas/1.0 (reproducible UCI dataset retrieval)"})
    with urllib.request.urlopen(request,context=ssl.create_default_context(cafile=certifi.where())) as response:
        ZIP.write_bytes(response.read())
    with zipfile.ZipFile(ZIP) as zf:
        zf.extractall(RAW)
df = pd.read_excel(XLSX, sheet_name=0)
if df.shape != (303, 59):
    raise ValueError(f"Unexpected source shape: {df.shape}")
if not set(TARGETS).issubset(df.columns):
    raise ValueError("Expected target columns missing")
features = [c for c in df.columns if c not in TARGETS]
# Normalize the source typo without changing meaning; remove a constant input that carries no information.
clean = df.copy()
clean["Sex"] = clean["Sex"].replace({"Fmale": "Female"})
constant_features = [c for c in features if clean[c].nunique(dropna=False) <= 1]
features = [c for c in features if c not in constant_features]
summary = {
  "source": "UCI Machine Learning Repository dataset 411, Extension of Z-Alizadeh Sani",
  "source_url": "https://archive.ics.uci.edu/dataset/411/extention%2Bof%2Bz%2B",
  "doi": "10.24432/C5461K", "license": "CC BY 4.0",
  "source_file_sha256": hashlib.sha256(XLSX.read_bytes()).hexdigest(),
  "shape": list(df.shape), "n_rows": len(df), "n_columns": len(df.columns),
  "feature_columns": features, "excluded_target_columns": TARGETS,
  "dropped_constant_features": constant_features,
  "normalizations": {"Sex": {"Fmale": "Female"}},
  "column_types": {c: ("categorical" if isinstance(df[c].dtype, pd.StringDtype) or df[c].dtype == object else "numeric") for c in features},
  "missing_by_column": {c: int(n) for c, n in df.isna().sum().items()},
  "duplicate_rows": int(df.duplicated().sum()),
  "target_distributions": {c: {str(k): int(v) for k, v in df[c].value_counts(dropna=False).items()} for c in TARGETS},
  "cad_vessel_consistency_count": int(((df[["LAD", "LCX", "RCA"]].eq("Stenotic").any(axis=1)) == df["Cath"].eq("CAD")).sum()),
  "note": "Cath is treated as the overall CAD label. The three vessel labels are independently predicted; all four outcome columns are excluded from predictors. No row ID exists in the sheet. Fmale is normalized to Female. Constant predictor(s) are excluded."
}
(ROOT / "data").mkdir(exist_ok=True)
(ROOT / "artifacts").mkdir(exist_ok=True)
(ROOT / "data/source.csv").write_text(clean.to_csv(index=False))
(ROOT / "artifacts/data_audit.json").write_text(json.dumps(summary, indent=2))
(ROOT / "artifacts/features.json").write_text(json.dumps({"features": features, "targets": TARGETS, "groups": {
  "Demographics": ["Age", "Weight", "Length", "Sex", "BMI"],
  "History & examination": [c for c in features if c in ["DM","HTN","Current Smoker","EX-Smoker","FH","Obesity","CRF","CVA","Airway disease","Thyroid Disease","CHF","DLP","BP","PR","Edema","Weak Peripheral Pulse","Lung rales","Systolic Murmur","Diastolic Murmur","Typical Chest Pain","Dyspnea","Function Class","Atypical","Nonanginal","Exertional CP","LowTH Ang"]],
  "ECG": ["Q Wave","St Elevation","St Depression","Tinversion","LVH","Poor R Progression","BBB"],
  "Laboratory & echo": [c for c in features if c in ["FBS","CR","TG","LDL","HDL","BUN","ESR","HB","K","Na","WBC","Lymph","Neut","PLT","EF-TTE","Region RWMA","VHD"]]
}}, indent=2))
print(json.dumps(summary, indent=2))
