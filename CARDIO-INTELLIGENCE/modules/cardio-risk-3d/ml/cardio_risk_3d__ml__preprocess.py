import pandas as pd
df = pd.read_excel("data/extension of Z-Alizadeh Sani Dataset.xlsx")
df["Cath"] = df["Cath"].map({"CAD": 1, "Normal": 0})
df["LAD"] = df["LAD"].map({"Stenotic": 1, "Normal": 0})
df["LCX"] = df["LCX"].map({"Stenotic": 1, "Normal": 0})
df["RCA"] = df["RCA"].map({"Stenotic": 1, "Normal": 0})
print("Cath:")
print(df["Cath"].value_counts())
print("\nLAD:")
print(df["LAD"].value_counts())
print("\nLCX:")
print(df["LCX"].value_counts())
print("\nRCA:")
print(df["RCA"].value_counts())

X=df.drop(columns=["Cath", "LAD", "LCX", "RCA"])
print("\nInput features:")
print(X.columns.tolist())
print("\nNumber of input features:", X.shape[1])

print("\nCategorical columns:")
print(X.select_dtypes(include=["object"]).columns.tolist())
for col in X.select_dtypes(include=["object"]).columns:
    print("\n",col)
    print(X[col].value_counts())

# 5. Categorical columns ko numbers me convert karo

# Sex
X["Sex"] = X["Sex"].map({
    "Male": 1,
    "Fmale": 0
})

# Y/N columns
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

for col in binary_columns:
    X[col] = X[col].map({
        "N": 0,
        "Y": 1
    })

# BBB
X["BBB"] = X["BBB"].map({
    "N": 0,
    "LBBB": 1,
    "RBBB": 2
})

# VHD
X["VHD"] = X["VHD"].map({
    "N": 0,
    "mild": 1,
    "Moderate": 2,
    "Severe": 3
})

print("\nData types after encoding:")
print(X.dtypes)

print("\nMissing values after encoding:")
print(X.isnull().sum().sum())