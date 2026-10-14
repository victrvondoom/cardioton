from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.special import expit
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss


EVALUATION_DIR = Path("data/processed/evaluation")

TARGET = "Cath"

MODELS = {
    "Logistic Regression": EVALUATION_DIR / f"{TARGET}_logistic_regression_oof_predictions.csv",
    "XGBoost": EVALUATION_DIR / f"{TARGET}_xgboost_oof_predictions.csv",
}


def calibration_in_the_large(y_true, probability):
    """
    Calibration-in-the-large:
    logistic regression with calibration slope fixed at 1.

    Positive value -> predictions tend to underestimate risk.
    Negative value -> predictions tend to overestimate risk.
    """
    p = np.clip(np.asarray(probability, dtype=float), 1e-6, 1 - 1e-6)
    y = np.asarray(y_true, dtype=float)

    logit_p = np.log(p / (1 - p))

    observed_rate = np.mean(y)
    if observed_rate == 0.0:
        return float("-inf")
    if observed_rate == 1.0:
        return float("inf")

    # The score equation is monotonic; brentq solves the fixed-slope
    # likelihood equation robustly without unstable Newton steps.
    def score(alpha):
        return float(np.mean(expit(logit_p + alpha)) - observed_rate)

    return float(brentq(score, -100.0, 100.0))


def calibration_slope(y_true, probability):
    """
    Cox calibration regression:

        logit(Y) ~ intercept + slope * logit(predicted probability)

    The slope is estimated using unpenalized logistic regression.
    """
    eps = 1e-6
    p = np.clip(probability, eps, 1 - eps)

    logit_p = np.log(p / (1 - p)).reshape(-1, 1)

    model = LogisticRegression(
        fit_intercept=True,
        solver="lbfgs",
        max_iter=1000,
    )

    model.fit(logit_p, y_true)

    return float(model.coef_[0][0]), float(model.intercept_[0])


def calculate_ece(y_true, probability, n_bins=5):
    """
    Descriptive equal-width ECE.

    Kept only as a secondary diagnostic because calibration
    bins can be unstable with small datasets.
    """
    y_true = np.asarray(y_true)
    probability = np.asarray(probability)

    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)

    ece = 0.0
    total = len(y_true)

    rows = []

    for i in range(n_bins):
        if i == n_bins - 1:
            mask = (
                (probability >= bin_edges[i])
                & (probability <= bin_edges[i + 1])
            )
        else:
            mask = (
                (probability >= bin_edges[i])
                & (probability < bin_edges[i + 1])
            )

        count = np.sum(mask)

        if count == 0:
            continue

        mean_probability = np.mean(probability[mask])
        observed_fraction = np.mean(y_true[mask])

        ece += (count / total) * abs(
            mean_probability - observed_fraction
        )

        rows.append(
            {
                "bin": i + 1,
                "count": int(count),
                "mean_predicted_probability": mean_probability,
                "observed_positive_fraction": observed_fraction,
            }
        )

    return ece, pd.DataFrame(rows)


def load_oof(path):
    df = pd.read_csv(path)

    required = {
        "repeat",
        "fold",
        "index",
        "y_true",
        "probability",
    }

    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            f"Missing required columns in {path}: {sorted(missing)}"
        )

    return df


def evaluate_repeat(df, expected_patient_count=None):
    patient_counts = df.groupby("index", dropna=False).size()
    expected_patients = (
        patient_counts.size
        if expected_patient_count is None
        else expected_patient_count
    )

    if patient_counts.size != expected_patients:
        raise ValueError(
            "Invalid repeat OOF structure: expected "
            f"{expected_patients} unique patients, found {patient_counts.size}."
        )
    if df["index"].isna().any():
        raise ValueError(
            "Invalid repeat OOF structure: patient IDs must not be missing."
        )
    if (patient_counts != 1).any():
        duplicated_patients = patient_counts[patient_counts != 1].index.tolist()
        raise ValueError(
            "Invalid repeat OOF structure: each patient must have exactly "
            f"one prediction; duplicated or missing counts for "
            f"{duplicated_patients}."
        )

    y = df["y_true"].to_numpy()
    p = df["probability"].to_numpy()

    brier = brier_score_loss(y, p)

    intercept = calibration_in_the_large(y, p)

    slope, unconstrained_intercept = calibration_slope(y, p)

    ece, bins = calculate_ece(y, p, n_bins=5)

    return {
        "samples": len(df),
        "brier_score": brier,
        "calibration_in_the_large": intercept,
        "calibration_slope": slope,
        "unconstrained_intercept": unconstrained_intercept,
        "ece_5_bins": ece,
    }, bins


def patient_bootstrap(df, n_bootstrap=2000, seed=42):
    """
    Patient-level bootstrap.

    Each patient/index is sampled as one unit. All predictions
    belonging to that patient within the selected repeat are
    carried together.
    """
    rng = np.random.default_rng(seed)

    patients = df["index"].unique()
    n_patients = len(patients)

    results = []

    for _ in range(n_bootstrap):
        sampled_patients = rng.choice(
            patients,
            size=n_patients,
            replace=True,
        )

        # Indexed lookup repeats complete patient rows while preserving the
        # bootstrap's patient-unit resampling, including repeated selections.
        sampled = (
            df.set_index("index")
            .loc[sampled_patients]
            .reset_index(drop=True)
        )

        y = sampled["y_true"].to_numpy()
        p = sampled["probability"].to_numpy()

        slope, _ = calibration_slope(y, p)

        results.append(
            {
                "brier_score": brier_score_loss(y, p),
                "calibration_slope": slope,
                "calibration_in_the_large": calibration_in_the_large(
                    y, p
                ),
            }
        )

    boot = pd.DataFrame(results)

    return boot


def summarize(values):
    values = np.asarray(values, dtype=float)

    return {
        "mean": np.mean(values),
        "std": np.std(values, ddof=1),
        "min": np.min(values),
        "max": np.max(values),
    }


def main():
    print("=" * 70)
    print("CARDIOINSPECTION — REPEAT-AWARE CALIBRATION")
    print(f"TARGET: {TARGET}")
    print("=" * 70)

    output_dir = EVALUATION_DIR / "calibration_repeatwise"
    output_dir.mkdir(parents=True, exist_ok=True)

    for model_name, path in MODELS.items():

        print()
        print("=" * 70)
        print(model_name.upper())
        print("=" * 70)

        df = load_oof(path)

        repeats = sorted(df["repeat"].unique())

        print(f"Patients: {df['index'].nunique()}")
        print(f"Repeats:  {len(repeats)}")
        print(f"Rows:     {len(df)}")

        expected_patient_count = df["index"].nunique()
        repeat_results = []
        all_bins = []

        for repeat in repeats:
            repeat_df = df[df["repeat"] == repeat].copy()

            metrics, bins = evaluate_repeat(
                repeat_df,
                expected_patient_count=expected_patient_count,
            )

            metrics["repeat"] = repeat

            repeat_results.append(metrics)

            bins["repeat"] = repeat
            all_bins.append(bins)

            print()
            print(f"Repeat {repeat}")
            print("-" * 40)
            print(f"Brier score              : {metrics['brier_score']:.6f}")
            print(
                "Calibration-in-the-large : "
                f"{metrics['calibration_in_the_large']:.6f}"
            )
            print(
                f"Calibration slope        : "
                f"{metrics['calibration_slope']:.6f}"
            )
            print(f"ECE (5 bins)             : {metrics['ece_5_bins']:.6f}")

        results_df = pd.DataFrame(repeat_results)

        print()
        print("-" * 70)
        print("REPEAT SUMMARY")
        print("-" * 70)

        for column in [
            "brier_score",
            "calibration_in_the_large",
            "calibration_slope",
            "ece_5_bins",
        ]:
            summary = summarize(results_df[column])

            print(
                f"{column:28}: "
                f"{summary['mean']:.6f} ± {summary['std']:.6f} "
                f"(range {summary['min']:.6f}–{summary['max']:.6f})"
            )

        # Patient-level bootstrap on each repeat.
        bootstrap_results = []

        print()
        print("PATIENT-LEVEL BOOTSTRAP")
        print("-" * 70)

        for repeat in repeats:
            repeat_df = df[df["repeat"] == repeat].copy()

            boot = patient_bootstrap(
                repeat_df,
                n_bootstrap=2000,
                seed=42 + int(repeat),
            )

            for column in [
                "brier_score",
                "calibration_slope",
                "calibration_in_the_large",
            ]:
                lower = boot[column].quantile(0.025)
                upper = boot[column].quantile(0.975)

                print(
                    f"Repeat {repeat} | "
                    f"{column:28}: "
                    f"{repeat_df[column if column in repeat_df else 'y_true'].iloc[0] if False else ''}"
                    f"[{lower:.6f}, {upper:.6f}]"
                )

            boot["repeat"] = repeat
            bootstrap_results.append(boot)

        # Save outputs.
        results_path = (
            output_dir
            / f"{TARGET}_{model_name.lower().replace(' ', '_')}_repeatwise.csv"
        )

        bins_path = (
            output_dir
            / f"{TARGET}_{model_name.lower().replace(' ', '_')}_calibration_bins.csv"
        )

        bootstrap_path = (
            output_dir
            / f"{TARGET}_{model_name.lower().replace(' ', '_')}_bootstrap.csv"
        )

        results_df.to_csv(results_path, index=False)

        pd.concat(all_bins, ignore_index=True).to_csv(
            bins_path,
            index=False,
        )

        pd.concat(bootstrap_results, ignore_index=True).to_csv(
            bootstrap_path,
            index=False,
        )

        print()
        print(f"Saved: {results_path}")
        print(f"Saved: {bins_path}")
        print(f"Saved: {bootstrap_path}")

    print()
    print("=" * 70)
    print("REPEAT-AWARE CALIBRATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()