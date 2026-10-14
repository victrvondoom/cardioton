"""Training orchestrator for CardioVision AI.

Pipeline: load -> validate -> leakage exclusion -> shared stratified 80/20
holdout -> CV leaderboard per target -> threshold tuning (train-only OOF) ->
final refit on full training set -> holdout evaluation -> artifact export.

Usage:  python -m ml.cv_risk_viz_prediction__backend_ml__train   (from backend/, writes backend/models/*, reports/*)
"""
from __future__ import annotations

import hashlib
import json
import platform
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.model_selection import cross_val_predict

from ml.data_loader import load, DatasetBundle
from ml.blocking import make_holdout_split, make_cv, assert_no_forbidden_features, SEED, N_FOLDS
from ml.model_comparison import get_candidates
from ml.preprocessing import build_preprocessor
from ml.cv_risk_viz_prediction__backend_ml__evaluate import evaluate_probs, macro_f05
from ml.thresholds import select_threshold

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "backend" / "models"
REPORTS_DIR = ROOT / "reports"
TARGET_KEYS = ["cad", "lad", "lcx", "rca"]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _split_data(bundle: DatasetBundle, train_idx, test_idx):
    X = bundle.X.reset_index(drop=True)
    out = {}
    for key in TARGET_KEYS:
        y = bundle.y[key].reset_index(drop=True)
        X_tr, X_te = X.iloc[train_idx], X.iloc[test_idx]
        y_tr, y_te = y.iloc[train_idx], y.iloc[test_idx]
        assert_no_forbidden_features(X.columns)
        out[key] = (X_tr, X_te, y_tr, y_te)
    return out


def run(seed: int = SEED) -> dict:
    t0 = time.time()
    bundle = load()
    cat_cols = bundle.categorical_features
    num_cols = [c for c in bundle.feature_names if c not in cat_cols]

    train_idx, test_idx = make_holdout_split(bundle.y)
    # sharing one holdout across targets (stratified on Cath)
    data = _split_data(bundle, train_idx, test_idx)
    folds, n_folds = make_cv({k: data[k][2] for k in TARGET_KEYS})

    leaderboard: dict[str, list] = {k: [] for k in TARGET_KEYS}
    chosen: dict[str, dict] = {}
    holdout_metrics: dict[str, dict] = {}
    thresholds: dict[str, float] = {}

    for key in TARGET_KEYS:
        X_tr, X_te, y_tr, y_te = data[key]
        defaults = []
        for name, base_est in get_candidates().items():
            pre = build_preprocessor(cat_cols, num_cols)
            from sklearn.pipeline import Pipeline as SkPipeline
            pipe = SkPipeline([("prep", pre), ("clf", clone(base_est))])
            # --- cross-validated leaderboard (train only) ---
            oof_prob = cross_val_predict(pipe, X_tr, y_tr, cv=folds, method="predict_proba", n_jobs=1)[:, 1]
            entry = evaluate_probs(y_tr, oof_prob, threshold=0.5)
            entry["model"] = name
            # per-fold macro-F0.5 std across CV folds
            f05s = []
            for tr_i, va_i in folds.split(X_tr, y_tr):
                m = clone(pipe)
                m.fit(X_tr.iloc[tr_i], y_tr.iloc[tr_i])
                prob_va = m.predict_proba(X_tr.iloc[va_i])[:, 1]
                f05s.append(macro_f05(y_tr.iloc[va_i], (prob_va >= 0.5).astype(int)))
            entry["cv_macro_f05_std"] = float(np.std(f05s))
            entry["oof_recall"] = entry["recall_sensitivity"]
            entry["oof_false_negatives"] = entry["false_negatives"]
            leaderboard[key].append(entry)

            # --- threshold tuning on training-only OOF probs ---
            thr, thr_diag = select_threshold(y_tr, oof_prob)
            entry["tuned_threshold"] = thr

        # ---- model selection with clinical safety review (documented) ----
        lb = leaderboard[key]
        # Requested selection: max mean CV macro F0.5 with safety review of
        # sensitivity/FN counts. No fabricated clinical recall floor; the
        # precision/recall table for all thresholds is exported for each model.
        eligible = [e for e in lb if e["precision"] > 0 and e["oof_recall"] > 0]
        if not eligible:
            eligible = lb
        best = max(eligible, key=lambda e: e["macro_f05"])
        chosen[key] = {
            "model": best["model"],
            "cv_macro_f05": best["macro_f05"],
            "cv_macro_f05_std": best["cv_macro_f05_std"],
            "tuned_threshold": best["tuned_threshold"],
            "selection_note": "argmax mean CV macro F0.5; models with zero CV precision or recall rejected",
        }
        thresholds[key] = float(best["tuned_threshold"])

        # ---- final training on full training set; holdout eval once ----
        from sklearn.pipeline import Pipeline as SkPipeline
        pre_fit = build_preprocessor(cat_cols, num_cols)
        final_pipe = SkPipeline([("prep", pre_fit), ("clf", clone(get_candidates()[best["model"]]))])
        final_pipe.fit(X_tr, y_tr)
        hold_prob = final_pipe.predict_proba(X_te)[:, 1]
        hold_def = evaluate_probs(y_te, hold_prob, threshold=0.5)
        hold_tun = evaluate_probs(y_te, hold_prob, threshold=thresholds[key])
        holdout_metrics[key] = {"default": hold_def, "tuned": hold_tun, "n_test": int(len(y_te))}

        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(final_pipe, MODELS_DIR / f"{key}.joblib")
        chosen[key]["test_default_macro_f05"] = hold_def["macro_f05"]

    # --------------------------- artifact export ---------------------------
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "leaderboards").mkdir(parents=True, exist_ok=True)

    artifact_paths = {k: str((MODELS_DIR / f"{k}.joblib").resolve()) for k in TARGET_KEYS}
    manifest = {
        "model_version": "1.0.0",
        "training_seed": SEED,
        "cv_folds": n_folds,
        "split": f"stratified 80/20 holdout on Cath (random_state={SEED}); shared across targets; no genuine group ids (documented)",
        "targets": {k: {"chosen_model": chosen[k]["model"], "threshold": thresholds[k]} for k in TARGET_KEYS},
        "feature_columns": bundle.feature_names,
        "categorical_features": cat_cols,
        "positive_class_mapping": {"cad": "Cath==CAD -> 1", "lad": "LAD==Stenotic -> 1", "lcx": "LCX==Stenotic -> 1", "rca": "RCA==Stenotic -> 1"},
        "artifacts": artifact_paths,
        "dependency_versions": {
            "python": platform.python_version(),
            "scikit-learn": __import__("sklearn").__version__,
            "xgboost": __import__("xgboost").__version__,
            "lightgbm": __import__("lightgbm").__version__,
            "catboost": __import__("catboost").__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "joblib": joblib.__version__,
        },
        "created_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (MODELS_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # feature schema
    schema_rows = []
    for c in bundle.feature_names:
        dtype = "categorical" if c in cat_cols else "numeric"
        schema_rows.append({"feature": c, "type": dtype})
    (MODELS_DIR / "feature_schema.json").write_text(json.dumps(schema_rows, indent=2))

    (MODELS_DIR / "thresholds.json").write_text(json.dumps({k: thresholds[k] for k in TARGET_KEYS}, indent=2))
    (MODELS_DIR / "metrics.json").write_text(json.dumps({
        "holdout": holdout_metrics,
        "chosen": chosen,
        "test_n": {k: holdout_metrics[k]["n_test"] for k in TARGET_KEYS},
    }, indent=2))

    # leaderboards CSV + JSON
    for key in TARGET_KEYS:
        lb = leaderboard[key]
        pd.DataFrame(lb).to_csv(REPORTS_DIR / "leaderboards" / f"{key}_leaderboard.csv", index=False)
        (REPORTS_DIR / "leaderboards" / f"{key}_leaderboard.json").write_text(json.dumps(lb, indent=2))

    # checksums file
    checksums = {k: _sha256(Path(p)) for k, p in artifact_paths.items()}
    (MODELS_DIR / "checksums.json").write_text(json.dumps(checksums, indent=2))

    elapsed = time.time() - t0
    summary = {"chosen": chosen, "holdout": holdout_metrics, "elapsed_s": elapsed, "n_folds": n_folds}
    (REPORTS_DIR / "training_summary.json").write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    s = run()
    print(json.dumps(s["chosen"], indent=2))
    print(f"elapsed: {s['elapsed_s']:.1f}s")
