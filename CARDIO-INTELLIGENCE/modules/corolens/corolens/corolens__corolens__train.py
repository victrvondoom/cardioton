"""Train, evaluate and export the CoroLens models.

Protocol (all decisions are made without touching the held-out test set):
  1. Stratified 80/20 split on overall CAD (seed 2026): 242 development / 61 held-out test patients.
  2. Per target, choose between L1-logistic regression and a random forest by 5x3 repeated CV ROC-AUC
     on the development set. The whole selection is also wrapped in an outer 5x2 CV (nested CV) to
     report an unbiased estimate of the procedure.
  3. Platt calibration and split-conformal thresholds are fitted on out-of-fold development predictions.
  4. Final metrics (with bootstrap 95% CIs) on the 61 held-out patients, then everything is exported
     as JSON so the browser can run inference and TreeSHAP locally.

    python -m corolens.corolens__corolens__train
"""

from __future__ import annotations

import json
import math
import platform
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, brier_score_loss, f1_score, precision_score, recall_score,
                             roc_auc_score)
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .corolens__corolens__data import FEATURE_GROUPS, RAW_FEATURES, TARGETS, load_xy, raw_record_types, to_jsonable

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[1]
SEED = 2026
ALPHA = 0.10  # conformal miscoverage: 90% target coverage


def candidates() -> dict:
    return {
        "logreg_l1": Pipeline([("scale", StandardScaler()),
                               ("clf", LogisticRegression(C=0.3, penalty="l1", solver="liblinear", max_iter=5000))]),
        "random_forest": RandomForestClassifier(n_estimators=200, min_samples_leaf=3, max_depth=8,
                                                max_features="sqrt", random_state=SEED, n_jobs=-1),
    }


def select(X, y, seed=SEED) -> tuple[str, dict]:
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=seed)
    scores = {}
    for name, model in candidates().items():
        aucs = []
        for tr, va in cv.split(X, y):
            m = clone(model).fit(X.iloc[tr], y.iloc[tr])
            aucs.append(roc_auc_score(y.iloc[va], m.predict_proba(X.iloc[va])[:, 1]))
        scores[name] = float(np.mean(aucs))
    return max(scores, key=scores.get), scores


def platt_fit(p: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    lr = LogisticRegression(C=1e6, max_iter=5000).fit(_logit(p).reshape(-1, 1), y)
    return float(lr.coef_[0, 0]), float(lr.intercept_[0])


def _logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def platt_apply(p, a, b):
    return 1 / (1 + np.exp(-(a * _logit(np.asarray(p)) + b)))


def conformal_q(p_cal: np.ndarray, y: np.ndarray, alpha=ALPHA) -> float:
    s = np.where(y == 1, 1 - p_cal, p_cal)  # 1 - probability of the true class
    n = len(s)
    level = min(1.0, math.ceil((n + 1) * (1 - alpha)) / n)
    return float(np.quantile(s, level, method="higher"))


def conformal_set(p, q) -> list[list[int]]:
    p = np.atleast_1d(p)
    return [[c for c, pc in ((0, 1 - pi), (1, pi)) if 1 - pc <= q] for pi in p]


def metrics(y, p, thr=0.5) -> dict:
    yhat = (p >= thr).astype(int)
    return {
        "roc_auc": float(roc_auc_score(y, p)),
        "accuracy": float(accuracy_score(y, yhat)),
        "precision": float(precision_score(y, yhat, zero_division=0)),
        "recall": float(recall_score(y, yhat, zero_division=0)),
        "f1": float(f1_score(y, yhat, zero_division=0)),
        "brier": float(brier_score_loss(y, p)),
    }


def bootstrap_ci(y, p, n=1000, seed=SEED) -> dict:
    rng = np.random.default_rng(seed)
    acc = {k: [] for k in metrics(y, p)}
    y, p = np.asarray(y), np.asarray(p)
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        if len(set(y[idx])) < 2:
            continue
        for k, v in metrics(y[idx], p[idx]).items():
            acc[k].append(v)
    return {k: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] for k, v in acc.items()}


def fit_target(X, y, seed=SEED) -> dict:
    """Selection + final fit + OOF calibration + conformal threshold on one development set."""
    name, cv_scores = select(X, y, seed)
    model = candidates()[name]
    oof = cross_val_predict(clone(model), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=seed),
                            method="predict_proba")[:, 1]
    a, b = platt_fit(oof, y.values)
    q = conformal_q(platt_apply(oof, a, b), y.values)
    final = clone(model).fit(X, y)
    return {"name": name, "cv_auc": cv_scores, "model": final, "platt": (a, b), "q": q, "oof": oof}


def predict_cal(fitted: dict, X) -> np.ndarray:
    return platt_apply(fitted["model"].predict_proba(X)[:, 1], *fitted["platt"])


def nested_cv(X, Y) -> dict:
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=2, random_state=SEED + 1)
    res = {t: {"auc": [], "f1": [], "coverage": [], "picked": []} for t in TARGETS}
    for k, (tr, va) in enumerate(outer.split(X, Y["CAD"])):
        for t in TARGETS:
            f = fit_target(X.iloc[tr], Y[t].iloc[tr], seed=SEED + k)
            p = predict_cal(f, X.iloc[va])
            yv = Y[t].iloc[va].values
            res[t]["auc"].append(roc_auc_score(yv, p))
            res[t]["f1"].append(f1_score(yv, (p >= 0.5).astype(int)))
            sets = conformal_set(p, f["q"])
            res[t]["coverage"].append(float(np.mean([yy in s for yy, s in zip(yv, sets)])))
            res[t]["picked"].append(f["name"])
    return {
        t: {
            "roc_auc_mean": float(np.mean(v["auc"])), "roc_auc_sd": float(np.std(v["auc"], ddof=1)),
            "f1_mean": float(np.mean(v["f1"])), "f1_sd": float(np.std(v["f1"], ddof=1)),
            "conformal_coverage_mean": float(np.mean(v["coverage"])),
            "model_picked": {m: v["picked"].count(m) for m in set(v["picked"])},
            "folds": len(v["auc"]),
        }
        for t, v in res.items()
    }


# ------------------------------------------------------------------ export for the browser
def export_tree(est) -> dict:
    t = est.tree_
    values = t.value[:, 0, :]
    values = values / values.sum(axis=1, keepdims=True)
    return {
        "left": t.children_left.tolist(),
        "right": t.children_right.tolist(),
        "feature": t.feature.tolist(),
        "threshold": [float(x) for x in t.threshold],
        "value": [float(x) for x in values[:, 1]],  # P(class 1) at each node
        "cover": [float(x) for x in t.weighted_n_node_samples],
    }


def export_model(f: dict, feature_names: list[str]) -> dict:
    m = f["model"]
    base = {"kind": f["name"], "platt": {"a": f["platt"][0], "b": f["platt"][1]}, "conformal_q": f["q"],
            "alpha": ALPHA, "cv_auc": f["cv_auc"]}
    if f["name"] == "random_forest":
        base["trees"] = [export_tree(e) for e in m.estimators_]
    else:
        sc, clf = m.named_steps["scale"], m.named_steps["clf"]
        base.update({"mean": sc.mean_.tolist(), "scale": sc.scale_.tolist(), "coef": clf.coef_[0].tolist(),
                     "intercept": float(clf.intercept_[0])})
    assert len(feature_names) == m.n_features_in_
    return base


def main():
    t0 = time.time()
    raw, X, Y = load_xy()
    idx_dev, idx_test = train_test_split(np.arange(len(X)), test_size=0.2, stratify=Y["CAD"], random_state=SEED)
    Xd, Xt, Yd, Yt = X.iloc[idx_dev], X.iloc[idx_test], Y.iloc[idx_dev], Y.iloc[idx_test]
    print(f"[corolens] development {len(Xd)} / held-out test {len(Xt)} patients, {X.shape[1]} features")

    print("[corolens] nested CV (outer 5x2) ...", flush=True)
    nested = nested_cv(Xd, Yd)

    fitted, test_report, test_probs, sets_out = {}, {}, {}, {}
    for t in TARGETS:
        f = fit_target(Xd, Yd[t])
        p = predict_cal(f, Xt)
        sets = conformal_set(p, f["q"])
        yt = Yt[t].values
        test_report[t] = {
            "model": f["name"],
            "cv_auc_dev": f["cv_auc"],
            "metrics": metrics(yt, p),
            "ci95": bootstrap_ci(yt, p),
            "conformal": {
                "q": f["q"],
                "coverage": float(np.mean([y in s for y, s in zip(yt, sets)])),
                "singleton_rate": float(np.mean([len(s) == 1 for s in sets])),
                "both_rate": float(np.mean([len(s) == 2 for s in sets])),
                "empty_rate": float(np.mean([len(s) == 0 for s in sets])),
            },
            "prevalence_test": float(yt.mean()),
        }
        fitted[t], test_probs[t], sets_out[t] = f, p, sets
        print(f"  {t}: {f['name']:13s} test AUC {test_report[t]['metrics']['roc_auc']:.3f} "
              f"F1 {test_report[t]['metrics']['f1']:.3f} coverage {test_report[t]['conformal']['coverage']:.3f}")

    # anatomical consistency: CAD vs 'any vessel predicted stenotic'
    any_vessel = np.maximum.reduce([test_probs[v] for v in ["LAD", "LCX", "RCA"]])
    agree = float(np.mean((test_probs["CAD"] >= 0.5) == (any_vessel >= 0.5)))

    # global importance on development data (shap is a dev-only dependency)
    importance = {}
    try:
        import shap

        for t in TARGETS:
            m = fitted[t]["model"]
            if fitted[t]["name"] == "random_forest":
                sv = shap.TreeExplainer(m).shap_values(Xd, check_additivity=False)
                sv = sv[:, :, 1] if np.ndim(sv) == 3 else sv[1]
            else:
                sc, clf = m.named_steps["scale"], m.named_steps["clf"]
                sv = ((Xd.values - sc.mean_) / sc.scale_) * clf.coef_[0]
            imp = np.abs(sv).mean(axis=0)
            order = np.argsort(-imp)[:12]
            importance[t] = [{"feature": X.columns[i], "mean_abs_shap": float(imp[i])} for i in order]
    except ImportError:
        pass

    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    web = ROOT / "web" / "model"
    web.mkdir(parents=True, exist_ok=True)
    feature_names = list(X.columns)
    medians = {c: (to_jsonable(raw[c].iloc[idx_dev].mode())[0] if raw[c].dtype == object or str(raw[c].dtype) == "str"
                   else float(raw[c].iloc[idx_dev].median())) for c in RAW_FEATURES}
    bundle = {
        "version": 1,
        "generated": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "feature_names": feature_names,
        "raw_features": RAW_FEATURES,
        "raw_types": raw_record_types(),
        "feature_groups": FEATURE_GROUPS,
        "defaults": medians,
        "targets": {t: export_model(fitted[t], feature_names) for t in TARGETS},
    }
    (web / "corolens_model.json").write_text(json.dumps(bundle, separators=(",", ":")))
    joblib.dump({t: fitted[t]["model"] for t in TARGETS}, out / "models.joblib")

    # held-out patients for the demo (never used for fitting) + fixtures for JS parity tests
    demo = []
    for j, i in enumerate(idx_test):
        rec = to_jsonable(raw.iloc[i][RAW_FEATURES])
        demo.append({"id": f"test-{j + 1:02d}", "record": rec,
                     "truth": {t: int(Y[t].iloc[i]) for t in TARGETS},
                     "python_prob": {t: float(test_probs[t][j]) for t in TARGETS}})
    (web / "heldout_patients.json").write_text(json.dumps(demo, indent=0))

    fixtures = {"encoded": Xt.values.tolist(), "prob_cal": {t: test_probs[t].tolist() for t in TARGETS},
                "prob_raw": {t: fitted[t]["model"].predict_proba(Xt)[:, 1].tolist() for t in TARGETS}}
    try:
        import shap

        fixtures["shap"] = {}
        for t in TARGETS:
            if fitted[t]["name"] == "random_forest":
                sv = shap.TreeExplainer(fitted[t]["model"]).shap_values(Xt.iloc[:10], check_additivity=False)
                sv = sv[:, :, 1] if np.ndim(sv) == 3 else sv[1]
                fixtures["shap"][t] = np.asarray(sv).tolist()
    except ImportError:
        pass
    (ROOT / "tests" / "fixtures").mkdir(exist_ok=True)
    (ROOT / "tests" / "fixtures" / "parity.json").write_text(json.dumps(fixtures))

    report = {
        "generated": bundle["generated"],
        "environment": {"python": platform.python_version(), "scikit_learn": sklearn.__version__,
                        "numpy": np.__version__, "pandas": pd.__version__},
        "split": {"development": int(len(Xd)), "test": int(len(Xt)), "seed": SEED,
                  "test_prevalence_cad": float(Yt["CAD"].mean())},
        "excluded_from_inputs": ["LAD", "LCX", "RCA", "Cath", "Exertional CP (constant)"],
        "nested_cv_dev": nested,
        "heldout_test": test_report,
        "consistency_cad_vs_any_vessel_test": agree,
        "global_importance_dev": importance,
        "runtime_seconds": round(time.time() - t0, 1),
    }
    (out / "metrics.json").write_text(json.dumps(report, indent=1))
    print(f"[corolens] CAD vs any-vessel agreement on test: {agree:.3f}")
    print(f"[corolens] done in {report['runtime_seconds']} s; model bundle "
          f"{(web / 'corolens_model.json').stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
