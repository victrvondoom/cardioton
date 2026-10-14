import pandas as pd

from pathlib import Path

from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
)


DATASET = Path(
    "data/raw/extention of Z-Alizadeh sani dataset.xlsx"
)


def main():
    # ---------------------------------------------------------
    # 1. Load dataset
    # ---------------------------------------------------------

    df = pd.read_excel(
        DATASET,
        sheet_name="Sheet 1 - Table 1"
    )

    print(f"Dataset shape: {df.shape}")

    # ---------------------------------------------------------
    # 2. Clean known categorical inconsistency
    # ---------------------------------------------------------

    if "Sex" in df.columns:
        df["Sex"] = df["Sex"].replace({
            "Fmale": "Female"
        })

    # ---------------------------------------------------------
    # 3. Define target
    # ---------------------------------------------------------

    target = "Cath"

    y = df[target]

    # Convert:
    # Normal -> 0
    # CAD    -> 1

    y = y.map({
        "Normal": 0,
        "CAD": 1
    })

    if y.isna().any():
        raise ValueError(
            "Unexpected values found in target column."
        )

    # ---------------------------------------------------------
    # 4. Remove targets / known constant feature
    # ---------------------------------------------------------

    target_columns = [
        "Cath",
        "LAD",
        "LCX",
        "RCA",
    ]

    X = df.drop(
        columns=target_columns + ["Exertional CP"],
        errors="ignore"
    )

    # ---------------------------------------------------------
    # 5. Identify feature types
    # ---------------------------------------------------------

    categorical_features = X.select_dtypes(
        include=["object", "string", "category"]
    ).columns.tolist()

    numerical_features = X.select_dtypes(
        include=["number"]
    ).columns.tolist()

    print(f"Numerical features: {len(numerical_features)}")
    print(f"Categorical features: {len(categorical_features)}")

    # ---------------------------------------------------------
    # 6. Numerical preprocessing
    # ---------------------------------------------------------

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median")
            ),
            (
                "scaler",
                StandardScaler()
            ),
        ]
    )

    # ---------------------------------------------------------
    # 7. Categorical preprocessing
    # ---------------------------------------------------------

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent")
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore"
                )
            ),
        ]
    )

    # ---------------------------------------------------------
    # 8. Combine preprocessing
    # ---------------------------------------------------------

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numerical",
                numerical_pipeline,
                numerical_features
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_features
            ),
        ]
    )

    # ---------------------------------------------------------
    # 9. Model
    # ---------------------------------------------------------

    model = LogisticRegression(
        max_iter=2000,
        class_weight="balanced"
    )

    pipeline = Pipeline(
        steps=[
            (
                "preprocessing",
                preprocessor
            ),
            (
                "model",
                model
            ),
        ]
    )

    # ---------------------------------------------------------
    # 10. Train/test split
    # ---------------------------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        stratify=y,
        random_state=42
    )

    print(f"Training samples: {len(X_train)}")
    print(f"Test samples:     {len(X_test)}")

    # ---------------------------------------------------------
    # 11. Train
    # ---------------------------------------------------------

    print("\nTraining Logistic Regression...")

    pipeline.fit(
        X_train,
        y_train
    )

    # ---------------------------------------------------------
    # 12. Predictions
    # ---------------------------------------------------------

    y_pred = pipeline.predict(X_test)

    y_probability = pipeline.predict_proba(
        X_test
    )[:, 1]

    # ---------------------------------------------------------
    # 13. Evaluation
    # ---------------------------------------------------------

    print("\n" + "=" * 60)
    print("BASELINE RESULTS")
    print("=" * 60)

    print(
        f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}"
    )

    print(
        f"Precision: {precision_score(y_test, y_pred):.4f}"
    )

    print(
        f"Recall:    {recall_score(y_test, y_pred):.4f}"
    )

    print(
        f"F1:        {f1_score(y_test, y_pred):.4f}"
    )

    print(
        f"ROC-AUC:   {roc_auc_score(y_test, y_probability):.4f}"
    )

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            y_pred,
            target_names=["Normal", "CAD"]
        )
    )


if __name__ == "__main__":
    main()