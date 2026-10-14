"""
arterylens__train.py - Track A: Cardiovascular Risk Prediction (Z-Alizadeh Sani extension)

Trains 4 binary classifiers: CAD (column 'Cath'), LAD, LCX, RCA.
For each target it:
  1. cross-validates 3 candidate models (LogReg, RandomForest, XGBoost) with repeated stratified CV
  2. picks the best by mean ROC-AUC
  3. fits it on all data, calibrates probabilities, saves it
  4. computes SHAP values and saves plots
Everything is written to ml/models and ml/reports so you can open it from Jupyter.

Run from terminal:   python arterylens__train.py --data "../data/extention of Z-Alizadeh sani dataset.xlsx"
Run from notebook:   !python arterylens__train.py --data "../data/extention of Z-Alizadeh sani dataset.xlsx"
Or import:           from arterylens__train import run; results = run(data_path)
"""
import argparse
import json
import logging
import warnings
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")  # save plots to files; works in terminal and notebook
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, f1_score, precision_score,
                             recall_score, roc_auc_score, roc_curve,
                             confusion_matrix)
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

warnings.filterwarnings("ignore")
SEED = 42
TARGETS = {"CAD": "Cath", "LAD": "LAD", "LCX": "LCX", "RCA": "RCA"}
LEAKAGE_COLS = ["Cath", "LAD", "LCX", "RCA"]  # never used as inputs
BASE = Path(__file__).resolve().parent
MODEL_DIR = BASE / "models"
REPORT_DIR = BASE / "reports"


# ----------------------------------------------------------------------------
# 1. DATA LOADING + PREPROCESSING
# ----------------------------------------------------------------------------
def load_data(path):
    path = Path(path)
    if path.suffix == ".zip":  # allow passing the zip directly
        import zipfile
        with zipfile.ZipFile(path) as z:
            name = [n for n in z.namelist() if n.endswith(".xlsx")][0]
            z.extract(name, path.parent)
            path = path.parent / name
    df = pd.read_excel(path, sheet_name=0)  # first sheet has the data
    df.columns = [c.strip() for c in df.columns]
    return df


def preprocess(df):
    """Return X (numeric DataFrame), targets dict of 0/1 Series."""
    df = df.copy()

    # --- targets: 1 = CAD / Stenotic, 0 = Normal
    y = {name: df[col].isin(["CAD", "Stenotic"]).astype(int) for name, col in TARGETS.items()}

    # --- drop leakage columns from inputs
    X = df.drop(columns=LEAKAGE_COLS)

    # --- Sex (note the dataset typo 'Fmale')
    X["Sex"] = (X["Sex"].astype(str).str.strip().str.lower() == "male").astype(int)

    # --- ordinal: valvular heart disease
    X["VHD"] = X["VHD"].map({"N": 0, "mild": 1, "Moderate": 2, "Severe": 3}).fillna(0).astype(int)

    # --- Y/N columns -> 1/0
    for c in X.columns:
        if X[c].dtype == object or str(X[c].dtype) in ("str", "string"):
            X[c] = X[c].astype(str).str.strip().map({"Y": 1, "N": 0})

    # --- Obesity is derived from BMI -> drop to avoid redundancy
    X = X.drop(columns=["Obesity"], errors="ignore")

    # --- engineered clinical ratios (small, clinically meaningful)
    X["TG_HDL"] = X["TG"] / X["HDL"].replace(0, np.nan)
    X["LDL_HDL"] = X["LDL"] / X["HDL"].replace(0, np.nan)
    X["NLR"] = X["Neut"] / X["Lymph"].replace(0, np.nan)

    # --- winsorize skewed labs at 1st/99th percentile
    for c in ["WBC", "TG", "ESR", "CR", "TG_HDL", "NLR", "BUN", "FBS"]:
        lo, hi = X[c].quantile([0.01, 0.99])
        X[c] = X[c].clip(lo, hi)

    X = X.astype(float)
    return X, y


# ----------------------------------------------------------------------------
# 2. MODELS
# ----------------------------------------------------------------------------
def get_candidates():
    models = {
        "LogReg": Pipeline([
            ("imp", SimpleImputer(strategy="median")),
            ("sc", StandardScaler()),
            ("clf", LogisticRegression(penalty="elasticnet", solver="saga", l1_ratio=0.3,
                                       C=0.3, max_iter=5000, class_weight="balanced",
                                       random_state=SEED)),
        ]),
        "RandomForest": Pipeline([
            ("imp", SimpleImputer(strategy="median")),
            ("clf", RandomForestClassifier(n_estimators=500, min_samples_leaf=3,
                                           class_weight="balanced", random_state=SEED, n_jobs=-1)),
        ]),
    }
    if HAS_XGB:
        models["XGBoost"] = Pipeline([
            ("imp", SimpleImputer(strategy="median")),
            ("clf", XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.03,
                                  subsample=0.8, colsample_bytree=0.7, min_child_weight=2,
                                  reg_lambda=2.0, eval_metric="logloss",
                                  random_state=SEED, verbosity=0, n_jobs=-1)),
        ])
    return models


# ----------------------------------------------------------------------------
# 3. CROSS-VALIDATION
# ----------------------------------------------------------------------------
def cv_evaluate(model, X, y, n_splits=5, n_repeats=3):
    """Repeated stratified CV; returns mean/std of metrics over all folds."""
    rskf = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=SEED)
    rows = []
    from sklearn.base import clone
    for tr, te in rskf.split(X, y):
        m = clone(model).fit(X.iloc[tr], y.iloc[tr])
        p = m.predict_proba(X.iloc[te])[:, 1]
        pred = (p >= 0.5).astype(int)
        yt = y.iloc[te]
        rows.append({
            "accuracy": accuracy_score(yt, pred),
            "precision": precision_score(yt, pred, zero_division=0),
            "recall": recall_score(yt, pred, zero_division=0),
            "f1": f1_score(yt, pred, zero_division=0),
            "roc_auc": roc_auc_score(yt, p),
        })
    r = pd.DataFrame(rows)
    return r.mean().to_dict(), r.std().to_dict()


# ----------------------------------------------------------------------------
# 4. PLOTS
# ----------------------------------------------------------------------------
def save_roc_and_calibration(oof, y_all, best_names):
    fig, ax = plt.subplots(1, 2, figsize=(12, 5))
    for t in TARGETS:
        p = oof[t]
        fpr, tpr, _ = roc_curve(y_all[t], p)
        ax[0].plot(fpr, tpr, label=f"{t} (AUC={roc_auc_score(y_all[t], p):.2f}, {best_names[t]})")
        frac, mean_p = calibration_curve(y_all[t], p, n_bins=6, strategy="quantile")
        ax[1].plot(mean_p, frac, marker="o", label=t)
    ax[0].plot([0, 1], [0, 1], "k--")
    ax[0].set(title="ROC curves (out-of-fold)", xlabel="False positive rate", ylabel="True positive rate")
    ax[1].plot([0, 1], [0, 1], "k--")
    ax[1].set(title="Calibration (out-of-fold, uncalibrated)", xlabel="Predicted probability",
              ylabel="Observed fraction")
    ax[0].legend(); ax[1].legend()
    plt.tight_layout()
    plt.savefig(REPORT_DIR / "roc_calibration.png", dpi=150)
    plt.close()


def save_confusion(oof, y_all):
    fig, axes = plt.subplots(1, 4, figsize=(16, 3.8))
    for ax, t in zip(axes, TARGETS):
        cm = confusion_matrix(y_all[t], (oof[t] >= 0.5).astype(int))
        ax.imshow(cm, cmap="Blues")
        for (i, j), v in np.ndenumerate(cm):
            ax.text(j, i, v, ha="center", va="center")
        ax.set(title=t, xticks=[0, 1], yticks=[0, 1], xlabel="Predicted", ylabel="Actual")
    plt.tight_layout()
    plt.savefig(REPORT_DIR / "confusion_matrices.png", dpi=150)
    plt.close()


# ----------------------------------------------------------------------------
# 5. SHAP
# ----------------------------------------------------------------------------
def build_explainer(fitted_pipeline, X):
    """Return a SHAP explainer for the underlying model of a fitted pipeline."""
    clf = fitted_pipeline.named_steps["clf"]
    Xt = pd.DataFrame(fitted_pipeline[:-1].transform(X), columns=X.columns)
    if isinstance(clf, LogisticRegression):
        return shap.LinearExplainer(clf, Xt), Xt
    return shap.TreeExplainer(clf), Xt


def shap_values_pos(explainer, Xt):
    sv = explainer.shap_values(Xt)
    if isinstance(sv, list):          # older shap: list per class
        sv = sv[1]
    sv = np.asarray(sv)
    if sv.ndim == 3:                  # newer shap: (n, features, classes)
        sv = sv[:, :, 1]
    return sv


def save_shap_plot(sv, Xt, target):
    plt.figure()
    shap.summary_plot(sv, Xt, show=False, max_display=15)
    plt.title(f"SHAP summary - {target}")
    plt.tight_layout()
    plt.savefig(REPORT_DIR / f"shap_summary_{target}.png", dpi=150, bbox_inches="tight")
    plt.close()
    plt.figure(figsize=(7, 5))
    shap.summary_plot(sv, Xt, plot_type="bar", show=False, max_display=15)
    plt.title(f"Mean |SHAP| - {target}")
    plt.tight_layout()
    plt.savefig(REPORT_DIR / f"shap_bar_{target}.png", dpi=150, bbox_inches="tight")
    plt.close()


# ----------------------------------------------------------------------------
# 6. MAIN PIPELINE
# ----------------------------------------------------------------------------
def run(data_path, n_repeats=3):
    MODEL_DIR.mkdir(exist_ok=True, parents=True)
    REPORT_DIR.mkdir(exist_ok=True, parents=True)
    logging.basicConfig(level=logging.INFO, format="%(message)s",
                        handlers=[logging.StreamHandler(),
                                  logging.FileHandler(REPORT_DIR / "training.log", mode="w")])
    log = logging.getLogger("train")

    df = load_data(data_path)
    X, y = preprocess(df)
    log.info(f"Data: {X.shape[0]} rows, {X.shape[1]} features (leakage cols removed)")
    log.info("Class balance (positives): " + ", ".join(f"{t}={int(v.sum())}/{len(v)}" for t, v in y.items()))
    assert not set(LEAKAGE_COLS) & set(X.columns), "Leakage columns present!"

    candidates = get_candidates()
    cv_rows, best_names, oof, final = [], {}, {}, {}
    explain_store, shap_importance = {}, {}

    for t in TARGETS:
        log.info(f"\n=== Target: {t} ===")
        best_auc, best_name = -1, None
        for name, model in candidates.items():
            mean, std = cv_evaluate(model, X, y[t], n_repeats=n_repeats)
            log.info(f"  {name:13s} AUC {mean['roc_auc']:.3f}+-{std['roc_auc']:.3f} | "
                     f"F1 {mean['f1']:.3f} | Recall {mean['recall']:.3f} | Prec {mean['precision']:.3f}")
            cv_rows.append({"target": t, "model": name,
                            **{k: round(v, 4) for k, v in mean.items()},
                            **{k + "_std": round(v, 4) for k, v in std.items()}})
            if mean["roc_auc"] > best_auc:
                best_auc, best_name = mean["roc_auc"], name
        best_names[t] = best_name
        log.info(f"  -> best for {t}: {best_name} (AUC {best_auc:.3f})")

        # out-of-fold predictions of the best model (for ROC/calibration/confusion plots)
        skf = StratifiedKFold(5, shuffle=True, random_state=SEED)
        from sklearn.base import clone
        oof[t] = cross_val_predict(clone(candidates[best_name]), X, y[t], cv=skf,
                                   method="predict_proba")[:, 1]

        # final model: calibrated (sigmoid) version for the probabilities shown in the app
        base = clone(candidates[best_name])
        calibrated = CalibratedClassifierCV(base, method="sigmoid", cv=5).fit(X, y[t])
        final[t] = calibrated
        joblib.dump(calibrated, MODEL_DIR / f"model_{t.lower()}.joblib")

        # explainer model: uncalibrated version of the same best model fitted on all data
        expl_model = clone(candidates[best_name]).fit(X, y[t])
        explainer, Xt = build_explainer(expl_model, X)
        sv = shap_values_pos(explainer, Xt)
        save_shap_plot(sv, Xt, t)
        joblib.dump({"pipeline": expl_model, "explainer": explainer,
                     "background_median": X.median().to_dict()},
                    MODEL_DIR / f"explainer_{t.lower()}.joblib")
        imp = pd.Series(np.abs(sv).mean(axis=0), index=X.columns).sort_values(ascending=False)
        shap_importance[t] = imp.head(15).round(4).to_dict()

    # ---- reports
    results = pd.DataFrame(cv_rows)
    results.to_csv(REPORT_DIR / "cv_metrics_all_models.csv", index=False)

    best_rows = pd.concat([results[(results.target == t) & (results.model == best_names[t])]
                           for t in TARGETS])
    best_rows.to_csv(REPORT_DIR / "cv_metrics_best.csv", index=False)

    save_roc_and_calibration(oof, y, best_names)
    save_confusion(oof, y)

    # ---- schema for the frontend form (min/max/median/type per feature)
    schema = []
    for c in X.columns:
        binary = set(X[c].dropna().unique()) <= {0.0, 1.0}
        schema.append({"name": c, "type": "binary" if binary else "numeric",
                       "min": float(X[c].min()), "max": float(X[c].max()),
                       "median": float(X[c].median())})
    (MODEL_DIR / "schema.json").write_text(json.dumps(schema, indent=2))

    (REPORT_DIR / "metrics.json").write_text(json.dumps({
        "best_models": best_names,
        "cv_best": best_rows.to_dict(orient="records"),
        "shap_top_features": shap_importance,
        "feature_order": list(X.columns),
    }, indent=2))

    log.info("\n=== FINAL (best model per target, repeated-CV mean) ===")
    log.info(best_rows[["target", "model", "accuracy", "precision", "recall", "f1", "roc_auc"]]
             .to_string(index=False))
    log.info(f"\nSaved models -> {MODEL_DIR}\nSaved reports -> {REPORT_DIR}")
    return {"cv": results, "best": best_rows, "best_names": best_names, "X": X, "y": y}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="path to .xlsx (or the .zip) dataset")
    ap.add_argument("--repeats", type=int, default=3)
    a = ap.parse_args()
    run(a.data, a.repeats)
