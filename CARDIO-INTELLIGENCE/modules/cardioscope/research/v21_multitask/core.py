"""Fold-scoped shared MLP; selection APIs never receive outer validation rows."""

import copy
import hashlib
import random
import time

import numpy as np
import pandas as pd
import torch
from sklearn.pipeline import Pipeline
from torch import nn

from ml.models import build_pipeline, positive_probability, preprocessing_metadata
from ml.splits import assert_disjoint_groups
from research.v2_lcx_rca.core import choose_threshold, metrics, partition

TASKS = ("CAD", "LAD", "LCX", "RCA")
VESSELS = ("LCX", "RCA")


def deterministic(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)


def context_seed(context):
    return int(hashlib.sha256(context.encode()).hexdigest()[:8], 16) % (2**31 - 1)


class SharedMLP(nn.Module):
    def __init__(self, width, candidate):
        super().__init__()
        a, b = candidate["hidden"]
        self.trunk = nn.Sequential(
            nn.Linear(width, a),
            nn.ReLU(),
            nn.Dropout(candidate["dropout"]),
            nn.Linear(a, b),
            nn.ReLU(),
            nn.Dropout(candidate["dropout"]),
        )
        self.heads = nn.ModuleDict({t: nn.Linear(b, 1) for t in TASKS})

    def forward(self, X):
        shared = self.trunk(X)
        return torch.cat([self.heads[t](shared) for t in TASKS], dim=1)


def processor(manifest, schema_sha):
    # Reuse the exact v1 linear preprocessing, including SchemaGuard and auto OHE.
    dummy = {"family": "logistic", "params": {"C": 0.1, "class_weight": "balanced"}}
    fixed = {"seed": 42, "logistic_fixed": {"solver": "lbfgs", "max_iter": 2000}}
    return Pipeline(build_pipeline(dummy, manifest, schema_sha, fixed).steps[:2])


def validate_training(X, Y, allowed):
    if not X.index.equals(Y.index) or list(Y.columns) != list(TASKS):
        raise ValueError("Four supervised outputs must align with predictors")
    if not X.index.is_unique or not set(X.index).issubset(allowed):
        raise ValueError("Fit escapes authorized development training membership")
    if Y.isna().any().any() or not np.isin(Y.to_numpy(), [0, 1]).all():
        raise ValueError("Invalid four-task outcomes")


def train_network(X, Y, candidate, settings, seed, stop=None, epochs=None):
    """Array-only fit. stop is a private inner-training holdback, never scoring data."""
    deterministic(seed)
    model = SharedMLP(X.shape[1], candidate).cpu()
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=settings["learning_rate"],
        weight_decay=candidate["weight_decay"],
        betas=(0.9, 0.999),
        eps=1e-8,
        foreach=False,
    )
    xt, yt = torch.from_numpy(X.astype(np.float32)), torch.from_numpy(Y.astype(np.float32))
    weights = torch.tensor(candidate["weights"], dtype=torch.float32)
    criterion = nn.BCEWithLogitsLoss(reduction="none")

    def loss(x, y):
        return (criterion(model(x), y).mean(dim=0) * weights).sum() / weights.sum()

    best_loss, best_epoch, stale = float("inf"), 1, 0
    history = []
    if stop is not None:
        sx, sy = [torch.from_numpy(z.astype(np.float32)) for z in stop]
    limit = settings["max_epochs"] if epochs is None else epochs
    for epoch in range(1, limit + 1):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        value = loss(xt, yt)
        if not torch.isfinite(value):
            raise ValueError("Nonfinite training loss; abort without changing configuration")
        value.backward()
        optimizer.step()
        if stop is not None:
            model.eval()
            with torch.no_grad():
                current = float(loss(sx, sy))
            if not np.isfinite(current):
                raise ValueError("Nonfinite stopping loss")
            history.append(current)
            if current < best_loss - settings["min_delta"]:
                best_loss, best_epoch, stale = current, epoch, 0
            else:
                stale += 1
            if stale >= settings["patience"]:
                break
    model.eval()
    return model, {
        "best_epoch": best_epoch if stop is not None else limit,
        "executed_epochs": epoch,
        "stopping_losses": history,
        "parameter_count": sum(p.numel() for p in model.parameters()),
    }


def predict(model, preprocessor, X):
    encoded = preprocessor.transform(X).astype(np.float32)
    model.eval()
    with torch.no_grad():
        p = torch.sigmoid(model(torch.from_numpy(encoded))).numpy().astype(float)
    if p.shape != (len(X), 4) or not np.isfinite(p).all() or np.any((p < 0) | (p > 1)):
        raise ValueError("Invalid four-head probability output")
    return p


def stop_partition(Y, groups, focus, context):
    # A fixed stratified/group-safe 20% holdback from inner training only.
    return partition(Y[focus], groups, 5, context_seed(context + "/stop"))[0]


def inner_select(X, Y, groups, inner, manifest, protocol, context):
    validate_training(X, Y, set(X.index))
    if not groups.index.equals(X.index):
        raise ValueError("Misaligned groups")
    parent = set(X.index)
    seen = []
    rows = [{"candidate": c, "epochs": [], "oof": []} for c in protocol["candidates"]]
    ledger = []
    focus = context.split("/")[0]
    for number, fold in enumerate(inner):
        train, valid = fold["train_ids"], fold["validation_ids"]
        if set(train) | set(valid) != parent:
            raise ValueError("Inner fold escapes outer training")
        assert_disjoint_groups(train, valid, groups.to_dict())
        seen.extend(valid)
        training_Y = Y.loc[train]
        stop = stop_partition(training_Y, groups.loc[train], focus, f"{context}/inner-{number}")
        fitting, stopping = stop["train_ids"], stop["validation_ids"]
        if set(fitting) | set(stopping) != set(train):
            raise ValueError("Stopping partition escapes inner training")
        assert_disjoint_groups(fitting, stopping, groups.to_dict())
        stop_pre = processor(manifest, protocol["schema_sha256"]).fit(X.loc[fitting])
        refit_pre = processor(manifest, protocol["schema_sha256"]).fit(X.loc[train])
        fx, sx = stop_pre.transform(X.loc[fitting]), stop_pre.transform(X.loc[stopping])
        rx = refit_pre.transform(X.loc[train])
        seed = context_seed(f"{context}/inner-{number}")
        for row in rows:
            candidate = row["candidate"]
            started = time.perf_counter()
            _, trace = train_network(
                fx,
                Y.loc[fitting].to_numpy(),
                candidate,
                protocol["training"],
                seed,
                stop=(sx, Y.loc[stopping].to_numpy()),
            )
            epoch = trace["best_epoch"]
            model, refit_trace = train_network(
                rx,
                training_Y.to_numpy(),
                candidate,
                protocol["training"],
                seed + 1,
                epochs=epoch,
            )
            p = predict(model, refit_pre, X.loc[valid])
            row["epochs"].append(epoch)
            row["oof"].extend(
                {"row_id": i, "probabilities": q.tolist()} for i, q in zip(valid, p, strict=True)
            )
            ledger.append(
                {
                    "candidate_id": candidate["id"],
                    "context": f"{context}/inner-{number}",
                    "seed": seed,
                    "refit_seed": seed + 1,
                    "fit_ids": fitting,
                    "stop_ids": stopping,
                    "refit_ids": train,
                    "scoring_ids": valid,
                    "stop_preprocessing": preprocessing_metadata(stop_pre),
                    "refit_preprocessing": preprocessing_metadata(refit_pre),
                    "stopping": trace,
                    "refit": refit_trace,
                    "fit_seconds": time.perf_counter() - started,
                }
            )
    if len(seen) != len(parent) or set(seen) != parent:
        raise ValueError("Inner OOF membership must occur exactly once")
    for row in rows:
        oof = pd.DataFrame(
            [r["probabilities"] for r in row["oof"]],
            index=[r["row_id"] for r in row["oof"]],
            columns=TASKS,
        ).loc[X.index]
        row["operating_points"] = {
            t: choose_threshold(Y[t], oof[t], protocol["threshold_rule"]) for t in VESSELS
        }
        row["ranking_metrics"] = {t: metrics(Y[t], oof[t], oof[t] >= 0.5) for t in TASKS}
        row["refit_epochs"] = max(1, int(np.floor(np.median(row["epochs"]) + 0.5)))
    return rows, ledger


def select(rows, focus, joint=False):
    required = VESSELS if joint else (focus,)
    eligible = [r for r in rows if all(r["operating_points"][t] is not None for t in required)]

    def key(row):
        source = row["operating_points"]
        return tuple(
            -round(np.mean([source[t]["metrics"][k] for t in required]), 12)
            for k in ("balanced_accuracy", "pr_auc", "roc_auc")
        ) + (row["candidate"]["simplicity_rank"],)

    if eligible:
        return min(eligible, key=key), True
    # Diagnostic ranking ONLY: no replacement screening threshold is invented.
    selected = min(
        rows,
        key=lambda r: (
            -round(np.mean([r["ranking_metrics"][t]["roc_auc"] for t in required]), 12),
            r["candidate"]["simplicity_rank"],
        ),
    )
    return selected, False


def fit_selected(X, Y, manifest, protocol, selected, context):
    validate_training(X, Y, set(X.index))
    pre = processor(manifest, protocol["schema_sha256"]).fit(X)
    model, trace = train_network(
        pre.transform(X),
        Y.to_numpy(),
        selected["candidate"],
        protocol["training"],
        context_seed(context),
        epochs=selected["refit_epochs"],
    )
    return model, pre, trace


def reference_fit(X, Y, validation, target, manifest, schema_sha):
    candidate = {"family": "logistic", "params": {"C": 0.1, "class_weight": "balanced"}}
    search = {
        "seed": 42,
        "logistic_fixed": {"solver": "lbfgs", "l1_ratio": 0.0, "max_iter": 2000, "tol": 1e-8},
    }
    fit = build_pipeline(candidate, manifest, schema_sha, search).fit(X, Y[target])
    return positive_probability(fit, validation)


def arm(y, probability, ids, threshold, repeat, fold, choice=None):
    if threshold is None:
        return {
            "status": "ineligible",
            "metrics": None,
            "predictions": [],
            "repeat": repeat,
            "fold": fold,
            "choice": choice,
        }
    pred = probability >= threshold
    return {
        "status": "evaluated",
        "repeat": repeat,
        "fold": fold,
        "choice": choice,
        "metrics": metrics(y, probability, pred),
        "threshold": float(threshold),
        "predictions": [
            {"row_id": i, "positive": int(z), "probability": float(p), "predicted_positive": int(v)}
            for i, z, p, v in zip(ids, y, probability, pred, strict=True)
        ],
    }


def decision(selected, eligible):
    return copy.deepcopy(
        {
            "candidate": selected["candidate"],
            "eligible": eligible,
            "epochs": selected["refit_epochs"],
            "operating_points": selected["operating_points"],
        }
    )


def stronger_gate(model, reference, limits):
    checks = {"all_25_folds": model["evaluated_folds"] == reference["evaluated_folds"] == 25}
    for key, maximum in limits.items():
        checks[key] = (
            model["statistics"][key]["mean"] >= reference["statistics"][key]["mean"] - maximum
        )
    return {"passed": all(checks.values()), "checks": checks}
