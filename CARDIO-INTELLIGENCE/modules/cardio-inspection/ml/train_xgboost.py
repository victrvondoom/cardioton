import argparse
from pathlib import Path

import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from xgboost import XGBClassifier


DATASET = Path(
    "data/raw/extention of Z-Alizadeh sani dataset.xlsx"
)

TARGETS = {
    "Cath": {
        "Normal": 0,
        "CAD": 1,
    },
    "LAD": {
        "Normal": 0,
        "Stenotic": 1,
    },
    "LCX": {
        "Normal": 0,
        "Stenotic": 1,
    },
    "RCA": {
        "Normal": 0,
        "Stenotic": 1,
    },
}

TARGET_COLUMNS = [
    "Cath",
    "LAD",
    "LCX",
    "RCA",
]

CONSTANT_COLUMNS = [
    "Exertional CP",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run 5-fold CV XGBoost for a CardioInspection target."
    )

    parser.add_argument(
        "--target",
        required=True,
        choices=TARGETS.keys(),
        help="Prediction target: Cath, LAD, LCX, or RCA",
    )

    return parser.parse_args()


def load_data(target):
    """Load dataset and prepare X/y for the selected target."""

    df = pd.read_excel(
        DATASET,
        sheet_name="Sheet 1 - Table 1",
    )

    print(f"Dataset shape: {df.shape}")

    # Known categorical inconsistency
    if "Sex" in df.columns:
        df["Sex"] = df["Sex"].replace({
            "Fmale": "Female"
        })

    # Convert selected target to binary
    y = df[target].map(TARGETS[target])

    if y.isna().any():
        unexpected = df.loc[y.isna(), target].unique()

        raise ValueError(
            f"Unexpected values found in {target}: {unexpected}"
        )

    # Remove ALL target columns from the input.
    X = df.drop(
        columns=TARGET_COLUMNS + CONSTANT_COLUMNS,
        errors="ignore",
    )

    return X, y


def build_pipeline(X):
    """Build preprocessing + XGBoost pipeline."""

    categorical_features = X.select_dtypes(
        include=["object", "string", "category"]
    ).columns.tolist()

    numerical_features = X.select_dtypes(
        include=["number"]
    ).columns.tolist()

    print(f"Numerical features:   {len(numerical_features)}")
    print(f"Categorical features: {len(categorical_features)}")

    # XGBoost does not require feature scaling.
    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median"),
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent"),
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore"
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numerical",
                numerical_pipeline,
                numerical_features,
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_features,
            ),
        ]
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(
        steps=[
            (
                "preprocessing",
                preprocessor,
            ),
            (
                "model",
                model,
            ),
        ]
    )

    return pipeline


def main():

    args = parse_args()
    target = args.target

    print("=" * 70)
    print(f"CARDIOINSPECTION — XGBOOST 5-FOLD CV — TARGET: {target}")
    print("=" * 70)

    # ---------------------------------------------------------
    # Load data
    # ---------------------------------------------------------

    X, y = load_data(target)

    print(f"Target:   {target}")
    print(f"Features: {X.shape[1]}")
    print(f"Samples:  {X.shape[0]}")

    print("\nClass distribution:")

    class_counts = y.value_counts().sort_index()

    for class_value, count in class_counts.items():
        print(f"  Class {class_value}: {count}")

    # ---------------------------------------------------------
    # Build pipeline
    # ---------------------------------------------------------

    pipeline = build_pipeline(X)

    # ---------------------------------------------------------
    # 5-fold stratified CV
    # ---------------------------------------------------------

    cv = StratifiedKFold(
        n_splits=5,
        shuffle=True,
        random_state=42,
    )

    scoring = {
        "accuracy": "accuracy",
        "precision": "precision",
        "recall": "recall",
        "f1": "f1",
        "roc_auc": "roc_auc",
    }

    print("\nRunning 5-fold cross-validation...")

    results = cross_validate(
        pipeline,
        X,
        y,
        cv=cv,
        scoring=scoring,
        return_train_score=False,
        n_jobs=1,
    )

    # ---------------------------------------------------------
    # Results
    # ---------------------------------------------------------

    print("\n" + "=" * 70)
    print(f"RESULTS — XGBOOST — {target}")
    print("=" * 70)

    for metric in scoring:

        scores = results[f"test_{metric}"]

        mean = scores.mean()
        std = scores.std()

        print(
            f"{metric.upper():<10}: "
            f"{mean:.4f} ± {std:.4f}"
        )

    print("\nIndividual fold results:")

    for i in range(5):

        print(
            f"Fold {i + 1}: "
            f"Accuracy={results['test_accuracy'][i]:.4f}, "
            f"Precision={results['test_precision'][i]:.4f}, "
            f"Recall={results['test_recall'][i]:.4f}, "
            f"F1={results['test_f1'][i]:.4f}, "
            f"ROC-AUC={results['test_roc_auc'][i]:.4f}"
        )


if __name__ == "__main__":
    main()