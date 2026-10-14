"""Candidate model registry: 8 algorithms (SVM included, supplementary)."""
from __future__ import annotations

from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier

SEED = 42

CANDIDATE_MODELS: dict[str, object] = {
    # Conservative settings appropriate for n=303; light tuning via CV.
    "logistic_regression": LogisticRegression(max_iter=5000, C=1.0, random_state=SEED),
    "random_forest": RandomForestClassifier(n_estimators=400, max_depth=None, min_samples_leaf=2,
                                            class_weight="balanced", random_state=SEED, n_jobs=1),
    "extra_trees": ExtraTreesClassifier(n_estimators=400, min_samples_leaf=2,
                                        class_weight="balanced", random_state=SEED, n_jobs=1),
    "xgboost": XGBClassifier(n_estimators=200, max_depth=3, learning_rate=0.05,
                             subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
                             eval_metric="logloss", random_state=SEED, n_jobs=1),
    "lightgbm": LGBMClassifier(n_estimators=200, num_leaves=15, learning_rate=0.05,
                               min_child_samples=10, subsample=0.9, colsample_bytree=0.9,
                               reg_lambda=1.0, random_state=SEED, n_jobs=1, verbose=-1),
    "catboost": CatBoostClassifier(iterations=300, depth=4, learning_rate=0.05,
                                   l2_leaf_reg=3.0, verbose=0, random_seed=SEED),
    "hist_gradient_boosting": HistGradientBoostingClassifier(max_iter=200, max_leaf_nodes=15,
                                                             learning_rate=0.05,
                                                             min_samples_leaf=10,
                                                             l2_regularization=1.0,
                                                             random_state=SEED),
    # Supplementary (optional per spec): RBF-SVM with train-only calibration-free
    # decision probing is harder to explain with SHAP TreeExplainer; enabled but
    # deprioritized.
    "svm_rbf": SVC(kernel="rbf", C=2.0, gamma="scale", class_weight="balanced",
                   probability=True, random_state=SEED),
}


def get_candidates() -> dict[str, object]:
    return dict(CANDIDATE_MODELS)
