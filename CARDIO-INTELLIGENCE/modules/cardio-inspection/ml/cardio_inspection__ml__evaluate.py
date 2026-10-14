import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.calibration import calibration_curve
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from xgboost import XGBClassifier


# ============================================================
# CONFIGURATION
# ============================================================

DATASET = Path(
    "data/raw/extention of Z-Alizadeh sani dataset.xlsx"
)

OUTPUT_DIR = Path("data/processed/evaluation")

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

N_SPLITS = 5
N_REPEATS = 5
RANDOM_STATE = 42

BOOTSTRAP_ITERATIONS = 2000


# ============================================================
# DATA LOADING
# ============================================================

def load_data(target):
    """Load and validate the dataset for one target."""

    if target not in TARGETS:
        raise ValueError(
            f"Unknown target '{target}'. "
            f"Choose from: {list(TARGETS.keys())}"
        )

    df = pd.read_excel(DATASET)

    print(f"Dataset shape: {df.shape}")

    # --------------------------------------------------------
    # Known categorical typo
    # --------------------------------------------------------

    if "Sex" in df.columns:
        df["Sex"] = (
            df["Sex"]
            .astype("string")
            .str.strip()
            .replace({"Fmale": "Female"})
        )

    # --------------------------------------------------------
    # Validate target columns
    # --------------------------------------------------------

    missing_targets = [
        col for col in TARGET_COLUMNS
        if col not in df.columns
    ]

    if missing_targets:
        raise ValueError(
            f"Missing target columns: {missing_targets}"
        )

    # --------------------------------------------------------
    # Validate constant column
    # --------------------------------------------------------

    for column in CONSTANT_COLUMNS:

        if column not in df.columns:
            raise ValueError(
                f"Expected constant column '{column}' "
                f"was not found."
            )

        if df[column].nunique(dropna=False) != 1:
            raise ValueError(
                f"Column '{column}' is no longer constant. "
                f"Check the dataset before continuing."
            )

    # --------------------------------------------------------
    # Encode target
    # --------------------------------------------------------

    mapping = TARGETS[target]

    y_raw = (
        df[target]
        .astype("string")
        .str.strip()
    )

    unexpected = sorted(
        set(y_raw.dropna().unique())
        - set(mapping.keys())
    )

    if unexpected:
        raise ValueError(
            f"Unexpected values found in {target}: "
            f"{unexpected}"
        )

    if y_raw.isna().any():
        raise ValueError(
            f"Missing values found in target '{target}'."
        )

    y = y_raw.map(mapping).astype(int)

    # --------------------------------------------------------
    # Remove ALL target columns + constant column
    # --------------------------------------------------------

    X = df.drop(
        columns=TARGET_COLUMNS + CONSTANT_COLUMNS
    ).copy()

    # --------------------------------------------------------
    # Safety checks
    # --------------------------------------------------------

    leakage_columns = [
        col for col in TARGET_COLUMNS
        if col in X.columns
    ]

    if leakage_columns:
        raise RuntimeError(
            f"TARGET LEAKAGE DETECTED: {leakage_columns}"
        )

    if X.shape[1] != 54:
        raise RuntimeError(
            f"Expected 54 usable features, "
            f"found {X.shape[1]}."
        )

    print(f"Target:   {target}")
    print(f"Features: {X.shape[1]}")
    print(f"Samples:  {len(X)}")

    print("\nClass distribution:")

    class_counts = y.value_counts().sort_index()

    for cls, count in class_counts.items():
        print(f"  Class {cls}: {count}")

    return X, y


# ============================================================
# PREPROCESSING
# ============================================================

def build_preprocessor(X):

    categorical_features = X.select_dtypes(
        include=["object", "string", "category"]
    ).columns.tolist()

    numerical_features = X.select_dtypes(
        include=["number"]
    ).columns.tolist()

    print(
        f"Numerical features:   "
        f"{len(numerical_features)}"
    )

    print(
        f"Categorical features: "
        f"{len(categorical_features)}"
    )

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median"),
            ),
            (
                "scaler",
                StandardScaler(),
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                ),
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=True,
                ),
            ),
        ]
    )

    return ColumnTransformer(
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
        ],
        remainder="drop",
    )


# ============================================================
# MODELS
# ============================================================

def build_logistic_pipeline(X):

    preprocessor = build_preprocessor(X)

    model = LogisticRegression(
        max_iter=2000,
        random_state=RANDOM_STATE,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def build_xgboost_pipeline(X, y):

    preprocessor = build_preprocessor(X)

    class_counts = y.value_counts()

    # Computed from the training fold only.
    # scale_pos_weight = (
    #     class_counts[0] / class_counts[1]
    #)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=3,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        # scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


# ============================================================
# METRICS
# ============================================================

def specificity_score(y_true, y_pred):

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        y_pred,
        labels=[0, 1],
    ).ravel()

    denominator = tn + fp

    if denominator == 0:
        return np.nan

    return tn / denominator


def calculate_metrics(y_true, probabilities):

    predictions = (
        probabilities >= 0.5
    ).astype(int)

    return {
        "accuracy": accuracy_score(
            y_true,
            predictions,
        ),

        "precision": precision_score(
            y_true,
            predictions,
            zero_division=0,
        ),

        "recall_sensitivity": recall_score(
            y_true,
            predictions,
            zero_division=0,
        ),

        "specificity": specificity_score(
            y_true,
            predictions,
        ),

        "f1": f1_score(
            y_true,
            predictions,
            zero_division=0,
        ),

        "roc_auc": roc_auc_score(
            y_true,
            probabilities,
        ),

        "pr_auc": average_precision_score(
            y_true,
            probabilities,
        ),

        "brier_score": brier_score_loss(
            y_true,
            probabilities,
        ),
    }


# ============================================================
# CALIBRATION
# ============================================================

def calculate_calibration_data(
    y_true,
    probabilities,
    n_bins=10,
):

    fraction_positive, mean_predicted_value = (
        calibration_curve(
            y_true,
            probabilities,
            n_bins=n_bins,
            strategy="uniform",
        )
    )

    return pd.DataFrame(
        {
            "mean_predicted_probability":
                mean_predicted_value,

            "observed_positive_fraction":
                fraction_positive,
        }
    )


# ============================================================
# THRESHOLD ANALYSIS
# ============================================================

def calculate_threshold_metrics(
    y_true,
    probabilities,
):

    thresholds = np.arange(
        0.10,
        0.91,
        0.05,
    )

    rows = []

    for threshold in thresholds:

        predictions = (
            probabilities >= threshold
        ).astype(int)

        rows.append(
            {
                "threshold": threshold,

                "accuracy": accuracy_score(
                    y_true,
                    predictions,
                ),

                "precision": precision_score(
                    y_true,
                    predictions,
                    zero_division=0,
                ),

                "sensitivity": recall_score(
                    y_true,
                    predictions,
                    zero_division=0,
                ),

                "specificity": specificity_score(
                    y_true,
                    predictions,
                ),

                "f1": f1_score(
                    y_true,
                    predictions,
                    zero_division=0,
                ),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# BOOTSTRAP CONFIDENCE INTERVAL
# ============================================================

def bootstrap_confidence_intervals(
    y_true,
    probabilities,
    n_iterations=2000,
    random_state=42,
):

    rng = np.random.default_rng(
        random_state
    )

    y_true = np.asarray(y_true)
    probabilities = np.asarray(probabilities)

    n = len(y_true)

    metric_names = [
        "accuracy",
        "precision",
        "recall_sensitivity",
        "specificity",
        "f1",
        "roc_auc",
        "pr_auc",
        "brier_score",
    ]

    bootstrap_values = {
        metric: []
        for metric in metric_names
    }

    for _ in range(n_iterations):

        indices = rng.integers(
            0,
            n,
            size=n,
        )

        y_sample = y_true[indices]
        p_sample = probabilities[indices]

        # A bootstrap sample can occasionally contain
        # only one class. Skip those samples.
        if len(np.unique(y_sample)) < 2:
            continue

        metrics = calculate_metrics(
            y_sample,
            p_sample,
        )

        for metric in metric_names:
            bootstrap_values[metric].append(
                metrics[metric]
            )

    rows = []

    for metric in metric_names:

        values = np.asarray(
            bootstrap_values[metric]
        )

        rows.append(
            {
                "metric": metric,

                "estimate": calculate_metrics(
                    y_true,
                    probabilities,
                )[metric],

                "bootstrap_mean":
                    np.mean(values),

                "ci_lower":
                    np.percentile(
                        values,
                        2.5,
                    ),

                "ci_upper":
                    np.percentile(
                        values,
                        97.5,
                    ),

                "n_bootstrap":
                    len(values),
            }
        )

    return pd.DataFrame(rows)


# ============================================================
# REPEATED CROSS-VALIDATION
# ============================================================

def evaluate_model(
    model_name,
    X,
    y,
):

    print(
        f"\n{'=' * 70}"
    )

    print(
        f"EVALUATING: {model_name}"
    )

    print(
        f"{'=' * 70}"
    )

    cv = RepeatedStratifiedKFold(
        n_splits=N_SPLITS,
        n_repeats=N_REPEATS,
        random_state=RANDOM_STATE,
    )

    fold_metrics = []

    all_predictions = []

    # --------------------------------------------------------
    # Run all folds
    # --------------------------------------------------------

    for split_number, (
        train_idx,
        test_idx,
    ) in enumerate(
        cv.split(X, y),
        start=1,
    ):

        repeat_number = (
            (split_number - 1)
            // N_SPLITS
        ) + 1

        fold_number = (
            (split_number - 1)
            % N_SPLITS
        ) + 1

        X_train = X.iloc[train_idx]
        X_test = X.iloc[test_idx]

        y_train = y.iloc[train_idx]
        y_test = y.iloc[test_idx]

        # ----------------------------------------------------
        # Pipeline is rebuilt and fitted only on training data.
        # ----------------------------------------------------

        if model_name == "Logistic Regression":

            model = build_logistic_pipeline(
                X_train
            )

        else:

            model = build_xgboost_pipeline(
                X_train,
                y_train,
            )

        model.fit(
            X_train,
            y_train,
        )

        probabilities = (
            model.predict_proba(
                X_test
            )[:, 1]
        )

        metrics = calculate_metrics(
            y_test,
            probabilities,
        )

        metrics["repeat"] = repeat_number
        metrics["fold"] = fold_number

        fold_metrics.append(metrics)

        for index, probability in zip(
            test_idx,
            probabilities,
        ):

            all_predictions.append(
                {
                    "repeat": repeat_number,
                    "fold": fold_number,
                    "index": int(index),
                    "y_true": int(y.iloc[index]),
                    "probability": float(
                        probability
                    ),
                }
            )

        print(
            f"Repeat {repeat_number}, "
            f"Fold {fold_number}: "
            f"ROC-AUC="
            f"{metrics['roc_auc']:.4f}, "
            f"PR-AUC="
            f"{metrics['pr_auc']:.4f}, "
            f"F1="
            f"{metrics['f1']:.4f}"
        )

    fold_metrics_df = pd.DataFrame(
        fold_metrics
    )

    predictions_df = pd.DataFrame(
        all_predictions
    )

    # ========================================================
    # PRIMARY EVALUATION:
    # pooled OOF predictions within EACH repeat
    # ========================================================

    repeat_metrics = []

    for repeat_number in range(
        1,
        N_REPEATS + 1,
    ):

        repeat_predictions = (
            predictions_df[
                predictions_df["repeat"]
                == repeat_number
            ]
        )

        metrics = calculate_metrics(
            repeat_predictions["y_true"].values,
            repeat_predictions["probability"].values,
        )

        metrics["repeat"] = repeat_number

        repeat_metrics.append(
            metrics
        )

    repeat_metrics_df = pd.DataFrame(
        repeat_metrics
    )

    # ========================================================
    # SECONDARY ANALYSIS:
    # average five OOF predictions per patient
    #
    # This is an ensemble-style estimate and is NOT used
    # as the primary CV performance estimate.
    # ========================================================

    aggregated = (
        predictions_df
        .groupby("index")
        .agg(
            y_true=("y_true", "first"),
            probability=("probability", "mean"),
            prediction_count=(
                "probability",
                "count",
            ),
        )
        .reset_index()
    )

    aggregated_metrics = calculate_metrics(
        aggregated["y_true"].values,
        aggregated["probability"].values,
    )

    calibration_data = (
        calculate_calibration_data(
            aggregated["y_true"].values,
            aggregated["probability"].values,
        )
    )

    threshold_data = (
        calculate_threshold_metrics(
            aggregated["y_true"].values,
            aggregated["probability"].values,
        )
    )

    bootstrap_data = (
        bootstrap_confidence_intervals(
            aggregated["y_true"].values,
            aggregated["probability"].values,
            n_iterations=BOOTSTRAP_ITERATIONS,
            random_state=RANDOM_STATE,
        )
    )

    return (
        fold_metrics_df,
        repeat_metrics_df,
        predictions_df,
        aggregated,
        aggregated_metrics,
        calibration_data,
        threshold_data,
        bootstrap_data,
    )


# ============================================================
# REPORTING
# ============================================================

METRIC_NAMES = [
    "accuracy",
    "precision",
    "recall_sensitivity",
    "specificity",
    "f1",
    "roc_auc",
    "pr_auc",
    "brier_score",
]


def print_results(
    model_name,
    repeat_metrics_df,
    aggregated_metrics,
    bootstrap_data,
):

    print(
        f"\n{'=' * 70}"
    )

    print(
        f"PRIMARY RESULTS — {model_name}"
    )

    print(
        f"{'=' * 70}"
    )

    print(
        "Repeated CV: "
        "5 repeats × pooled 5-fold OOF predictions"
    )

    for metric in METRIC_NAMES:

        mean = (
            repeat_metrics_df[metric]
            .mean()
        )

        std = (
            repeat_metrics_df[metric]
            .std(ddof=1)
        )

        print(
            f"{metric.upper():20}: "
            f"{mean:.4f} ± {std:.4f}"
        )

    # --------------------------------------------------------
    # Secondary aggregated analysis
    # --------------------------------------------------------

    print(
        f"\n{'-' * 70}"
    )

    print(
        "SECONDARY ANALYSIS — "
        "5-model-per-patient averaged OOF predictions"
    )

    print(
        "(Ensemble-style; not the primary CV estimate)"
    )

    for metric in METRIC_NAMES:

        print(
            f"{metric.upper():20}: "
            f"{aggregated_metrics[metric]:.4f}"
        )

    # --------------------------------------------------------
    # Bootstrap confidence intervals
    # --------------------------------------------------------

    print(
        f"\n{'-' * 70}"
    )

    print(
        "BOOTSTRAP 95% CI — aggregated OOF analysis"
    )

    for _, row in bootstrap_data.iterrows():

        print(
            f"{row['metric'].upper():20}: "
            f"{row['estimate']:.4f} "
            f"[{row['ci_lower']:.4f}, "
            f"{row['ci_upper']:.4f}]"
        )


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Rigorous repeated-CV evaluation "
            "for CardioInspection."
        )
    )

    parser.add_argument(
        "--target",
        required=True,
        choices=list(TARGETS.keys()),
        help="Prediction target.",
    )

    args = parser.parse_args()

    target = args.target

    print(
        "\n"
        + "=" * 70
    )

    print(
        f"CARDIOINSPECTION — MODEL EVALUATION "
        f"— TARGET: {target}"
    )

    print(
        "=" * 70
    )

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    X, y = load_data(target)

    results = {}

    # --------------------------------------------------------
    # Evaluate both models
    # --------------------------------------------------------

    for model_name in [
        "Logistic Regression",
        "XGBoost",
    ]:

        (
            fold_metrics_df,
            repeat_metrics_df,
            predictions_df,
            aggregated,
            aggregated_metrics,
            calibration_data,
            threshold_data,
            bootstrap_data,
        ) = evaluate_model(
            model_name,
            X,
            y,
        )

        print_results(
            model_name,
            repeat_metrics_df,
            aggregated_metrics,
            bootstrap_data,
        )

        results[model_name] = {
            "fold_metrics":
                fold_metrics_df,

            "repeat_metrics":
                repeat_metrics_df,

            "predictions":
                predictions_df,

            "aggregated":
                aggregated,

            "aggregated_metrics":
                aggregated_metrics,

            "calibration":
                calibration_data,

            "thresholds":
                threshold_data,

            "bootstrap":
                bootstrap_data,
        }

    # ========================================================
    # SAVE RESULTS
    # ========================================================

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    for model_name, result in results.items():

        safe_name = (
            model_name
            .lower()
            .replace(" ", "_")
        )

        # Fold-level metrics
        result["fold_metrics"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_fold_metrics.csv",
            index=False,
        )

        # PRIMARY metrics: one row per repeat
        result["repeat_metrics"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_cv_metrics.csv",
            index=False,
        )

        # All individual OOF predictions
        result["predictions"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_oof_predictions.csv",
            index=False,
        )

        # Patient-level averaged predictions
        result["aggregated"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_aggregated_oof.csv",
            index=False,
        )

        # Calibration
        result["calibration"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_calibration.csv",
            index=False,
        )

        # Threshold analysis
        result["thresholds"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_thresholds.csv",
            index=False,
        )

        # Bootstrap CIs
        result["bootstrap"].to_csv(
            OUTPUT_DIR
            / f"{target}_{safe_name}_bootstrap_ci.csv",
            index=False,
        )

    # ========================================================
    # FINAL COMPARISON
    # ========================================================

    print(
        f"\n{'=' * 70}"
    )

    print(
        f"FINAL PRIMARY COMPARISON — {target}"
    )

    print(
        f"{'=' * 70}"
    )

    for model_name, result in results.items():

        metrics = result["repeat_metrics"]

        print(
            f"\n{model_name}:"
        )

        for metric in [
            "roc_auc",
            "pr_auc",
            "f1",
            "brier_score",
        ]:

            mean = metrics[metric].mean()
            std = metrics[metric].std(
                ddof=1
            )

            print(
                f"  {metric.upper():10}: "
                f"{mean:.4f} ± {std:.4f}"
            )

    print(
        f"\nResults saved to: "
        f"{OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()