import pandas as pd

from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier


# --------------------------------------------------
# 1. DATASET LOAD
# --------------------------------------------------

df = pd.read_excel("data/extension of Z-Alizadeh Sani Dataset.xlsx")


# --------------------------------------------------
# 2. TARGET ENCODING
# --------------------------------------------------

df["Cath"] = df["Cath"].map({
    "Normal": 0,
    "CAD": 1
})

df["LAD"] = df["LAD"].map({
    "Normal": 0,
    "Stenotic": 1
})

df["LCX"] = df["LCX"].map({
    "Normal": 0,
    "Stenotic": 1
})

df["RCA"] = df["RCA"].map({
    "Normal": 0,
    "Stenotic": 1
})


# --------------------------------------------------
# 3. INPUT FEATURES
# --------------------------------------------------

X = df.drop(columns=["Cath", "LAD", "LCX", "RCA"])


# --------------------------------------------------
# 4. ENCODING
# --------------------------------------------------

X["Sex"] = X["Sex"].map({
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


for col in binary_columns:
    X[col] = X[col].map({
        "N": 0,
        "Y": 1
    })


X["BBB"] = X["BBB"].map({
    "N": 0,
    "LBBB": 1,
    "RBBB": 2
})


X["VHD"] = X["VHD"].map({
    "N": 0,
    "mild": 1,
    "Moderate": 2,
    "Severe": 3
})


# --------------------------------------------------
# 5. MODELS
# --------------------------------------------------

models = {

    "Logistic Regression": Pipeline([
        ("scaler", StandardScaler()),
        ("model", LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        ))
    ]),

    "Random Forest": RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced"
    ),

    "SVM": Pipeline([
        ("scaler", StandardScaler()),
        ("model", SVC(
            probability=True,
            class_weight="balanced"
        ))
    ]),

    "XGBoost": XGBClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        random_state=42,
        eval_metric="logloss"
    )
}


# --------------------------------------------------
# 6. CROSS VALIDATION
# --------------------------------------------------

cv = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=42
)


# --------------------------------------------------
# 7. TARGETS
# --------------------------------------------------

targets = {
    "CAD": df["Cath"],
    "LAD": df["LAD"],
    "LCX": df["LCX"],
    "RCA": df["RCA"]
}


# --------------------------------------------------
# 8. MODEL COMPARISON
# --------------------------------------------------

for target_name, y in targets.items():

    print("\n================================")
    print(target_name)
    print("================================")

    for model_name, model in models.items():

        scores = cross_validate(
            model,
            X,
            y,
            cv=cv,
            scoring=[
                "accuracy",
                "precision",
                "recall",
                "f1",
                "roc_auc"
            ]
        )

        print("\n", model_name)

        print(
            "Accuracy :",
            round(scores["test_accuracy"].mean(), 3)
        )

        print(
            "Precision:",
            round(scores["test_precision"].mean(), 3)
        )

        print(
            "Recall   :",
            round(scores["test_recall"].mean(), 3)
        )

        print(
            "F1       :",
            round(scores["test_f1"].mean(), 3)
        )

        print(
            "ROC-AUC  :",
            round(scores["test_roc_auc"].mean(), 3)
        )