import pandas as pd
import joblib
import os

from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


# -----------------------------
# 1. Load dataset
# -----------------------------

df = pd.read_excel(
    "data/extension of Z-Alizadeh Sani Dataset.xlsx"
)

print("Dataset loaded:", df.shape)


# -----------------------------
# 2. Encode categorical columns
# -----------------------------

df["Sex"] = df["Sex"].map({
    "Male": 1,
    "Fmale": 0
})


binary_columns = [
    "Obesity",
    "CRF",
    "CVA",
    "Airway disease",
    "Thyroid Disease",
    "CHF",
    "DLP",
    "Weak Peripheral Pulse",
    "Lung rales",
    "Systolic Murmur",
    "Diastolic Murmur",
    "Dyspnea",
    "Atypical",
    "Nonanginal",
    "Exertional CP",
    "LowTH Ang",
    "LVH",
    "Poor R Progression"
]

for column in binary_columns:
    df[column] = df[column].map({
        "N": 0,
        "Y": 1
    })


df["BBB"] = df["BBB"].map({
    "N": 0,
    "LBBB": 1,
    "RBBB": 2
})


df["VHD"] = df["VHD"].map({
    "N": 0,
    "mild": 1,
    "Moderate": 2,
    "Severe": 3
})


# -----------------------------
# 3. Create input features
# -----------------------------

X = df.drop(
    columns=["Cath", "LAD", "LCX", "RCA"]
)

print("Number of input features:", X.shape[1])


# -----------------------------
# 4. Create target variables
# -----------------------------

y_cad = df["Cath"].map({
    "Normal": 0,
    "CAD": 1
})

y_lad = df["LAD"].map({
    "Normal": 0,
    "Stenotic": 1
})

y_lcx = df["LCX"].map({
    "Normal": 0,
    "Stenotic": 1
})

y_rca = df["RCA"].map({
    "Normal": 0,
    "Stenotic": 1
})


# -----------------------------
# 5. Create models
# -----------------------------

# CAD → SVM
cad_model = Pipeline([
    ("scaler", StandardScaler()),
    ("model", SVC(
        probability=True,
        class_weight="balanced",
        random_state=42
    ))
])


# LAD → Random Forest
lad_model = RandomForestClassifier(
    n_estimators=200,
    class_weight="balanced",
    random_state=42
)


# LCX → Random Forest
lcx_model = RandomForestClassifier(
    n_estimators=200,
    class_weight="balanced",
    random_state=42
)


# RCA → Random Forest
rca_model = RandomForestClassifier(
    n_estimators=200,
    class_weight="balanced",
    random_state=42
)


# -----------------------------
# 6. Train models on full dataset
# -----------------------------

print("\nTraining CAD model...")
cad_model.fit(X, y_cad)

print("Training LAD model...")
lad_model.fit(X, y_lad)

print("Training LCX model...")
lcx_model.fit(X, y_lcx)

print("Training RCA model...")
rca_model.fit(X, y_rca)


# -----------------------------
# 7. Create models folder
# -----------------------------

os.makedirs("models", exist_ok=True)


# -----------------------------
# 8. Save models
# -----------------------------

joblib.dump(
    cad_model,
    "models/cad_model.pkl"
)

joblib.dump(
    lad_model,
    "models/lad_model.pkl"
)

joblib.dump(
    lcx_model,
    "models/lcx_model.pkl"
)

joblib.dump(
    rca_model,
    "models/rca_model.pkl"
)


# Save feature names
joblib.dump(
    list(X.columns),
    "models/feature_columns.pkl"
)


print("\nAll models saved successfully!")

print("\nSaved files:")
print("models/cad_model.pkl")
print("models/lad_model.pkl")
print("models/lcx_model.pkl")
print("models/rca_model.pkl")
print("models/feature_columns.pkl")