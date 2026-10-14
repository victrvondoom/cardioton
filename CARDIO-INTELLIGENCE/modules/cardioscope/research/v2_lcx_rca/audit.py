"""Post-run evidence audit only: no fitting, tuning, selection changes or holdout reads."""

import csv
import io
from collections import Counter

import joblib
import numpy as np
from sklearn.metrics import auc, average_precision_score, precision_recall_curve, roc_auc_score

from ml.common import ROOT, digest, object_digest, read_json, write_json_once, write_once
from ml.models import positive_probability
from research.v2_lcx_rca.core import ARMS, SCALARS, development_boundary
from research.v2_lcx_rca.preregister import OUTPUT
from research.v2_lcx_rca.run import preflight


def independent_metrics(y, p, predicted):
    y, p, predicted = np.asarray(y), np.asarray(p), np.asarray(predicted, dtype=bool)
    tp, fn = int(np.sum(predicted & (y == 1))), int(np.sum(~predicted & (y == 1)))
    tn, fp = int(np.sum(~predicted & (y == 0))), int(np.sum(predicted & (y == 0)))
    precision, recall, _ = precision_recall_curve(y, p)
    return {
        "sensitivity": tp / (tp + fn),
        "specificity": tn / (tn + fp),
        "balanced_accuracy": (tp / (tp + fn) + tn / (tn + fp)) / 2,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "f1": 2 * tp / (2 * tp + fn + fp) if tp else 0.0,
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(auc(recall, precision)),
        "average_precision": float(average_precision_score(y, p)),
        "predicted_positive_rate": float(np.mean(predicted)),
        "prevalence": float(np.mean(y)),
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "records": len(y),
    }


def same_metrics(actual, expected):
    assert actual.keys() == expected.keys()
    for name in actual:
        np.testing.assert_allclose(actual[name], expected[name], atol=1e-12, rtol=1e-10)


def audit_inner(rows, y, train, rule):
    for row in rows:
        assert row["oof_ids_sha256"] == object_digest(train)
        p = np.asarray(row["oof_probabilities"])
        assert len(p) == len(train) and np.isfinite(p).all() and np.all((p >= 0) & (p <= 1))
        thresholds = np.unique(np.r_[0, p, 1])
        pred = p[:, None] >= thresholds[None, :]
        recall = np.mean(pred[y == 1], axis=0)
        specificity = np.mean(~pred[y == 0], axis=0)
        feasible = thresholds[
            (recall >= rule["sensitivity_min"]) & (specificity >= rule["specificity_min"])
        ]
        op = row["operating_point"]
        if len(feasible) == 0:
            assert op is None
        else:
            assert op is not None and op["threshold"] == float(np.max(feasible))
            same_metrics(op["metrics"], independent_metrics(y, p, p >= op["threshold"]))


def audit():
    protocol, data, manifest, folds = preflight()
    result = read_json(OUTPUT / "results.json")
    assert result["protocol_sha256"] == object_digest(protocol)
    all_fits, outer_scored = [], 0
    paired = {}
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(
        [
            "target",
            "arm",
            "eligible_paired_folds",
            "metric",
            "arm_mean",
            "reference_same_folds_mean",
            "mean_paired_delta",
        ]
    )
    with development_boundary():
        for target, t in result["targets"].items():
            paired[target] = {}
            for outer in t["outer_folds"]:
                arm_rows = outer["arms"]
                r, f = arm_rows["v1_rf_0.5"]["repeat"], arm_rows["v1_rf_0.5"]["fold"]
                fold = folds[target]["repeats"][r][f]
                tr, va = fold["train_ids"], fold["validation_ids"]
                audit_inner(
                    outer["inner_selection"],
                    data.targets.loc[tr, target].to_numpy(),
                    tr,
                    protocol["threshold_rule"],
                )
                eligible = [s for s in outer["inner_selection"] if s["operating_point"] is not None]

                def key(s):
                    mm = s["operating_point"]["metrics"]
                    return (
                        -round(mm["balanced_accuracy"], 12),
                        -round(mm["pr_auc"], 12),
                        -round(mm["roc_auc"], 12),
                        s["candidate"]["simplicity_rank"],
                    )

                assert outer["decision_sha256"] == object_digest(
                    {a: v["choice"] for a, v in arm_rows.items()}
                )
                for arm, row in arm_rows.items():
                    cc = row["choice"]
                    if arm == "v1_rf_0.5":
                        assert (
                            cc["candidate"] == protocol["references"][target]
                            and cc["threshold"] == 0.5
                        )
                    else:
                        family = "reference" if arm == "v1_rf_nested_threshold" else arm
                        pool = (
                            eligible
                            if arm == "selection_procedure"
                            else [s for s in eligible if s["candidate"]["family"] == family]
                        )
                        chosen = min(pool, key=key) if pool else None
                        if chosen is None:
                            assert cc is None and row["metrics"] is None and not row["predictions"]
                            assert row["status"] == "ineligible"
                            continue
                        assert cc["candidate"] == chosen["candidate"]
                        assert cc["threshold"] == chosen["operating_point"]["threshold"]
                    assert row["status"] == "evaluated"
                    assert [p["row_id"] for p in row["predictions"]] == va
                    yy = data.targets.loc[va, target].to_numpy()
                    assert [p["positive"] for p in row["predictions"]] == yy.tolist()
                    pp = np.array([p["probability"] for p in row["predictions"]])
                    vv = np.array([p["predicted_positive"] for p in row["predictions"]])
                    assert (vv == (pp >= cc["threshold"])).all()
                    same_metrics(row["metrics"], independent_metrics(yy, pp, vv))
                    outer_scored += 1
                for fit in outer["fits"]:
                    ids = (
                        tr
                        if fit["context"].endswith("/refit")
                        else fold["inner"][int(fit["context"].rsplit("-", 1)[1])]["train_ids"]
                    )
                    assert fit["fit_records"] == len(ids) and fit[
                        "fit_ids_sha256"
                    ] == object_digest(ids)
                    assert set(ids).issubset(data.features.index)
                    all_fits.append(fit)
                counts = Counter(
                    v["candidate_id"] for v in outer["fits"] if "/inner-" in v["context"]
                )
                assert counts == Counter(
                    {c["id"]: 4 for c in [protocol["references"][target], *protocol["candidates"]]}
                )
            for arm in ARMS:
                rows = [o["arms"][arm] for o in t["outer_folds"]]
                paired_rows = [
                    (row, o["arms"]["v1_rf_0.5"])
                    for row, o in zip(rows, t["outer_folds"], strict=True)
                    if row["status"] == "evaluated"
                ]
                paired[target][arm] = {"paired_folds": len(paired_rows), "metrics": {}}
                for k in SCALARS:
                    if not paired_rows:
                        continue
                    arm_values = [a["metrics"][k] for a, b in paired_rows]
                    ref_values = [b["metrics"][k] for a, b in paired_rows]
                    delta = [a - b for a, b in zip(arm_values, ref_values, strict=True)]
                    d = {
                        "arm_mean": float(np.mean(arm_values)),
                        "reference_same_folds_mean": float(np.mean(ref_values)),
                        "mean_paired_delta": float(np.mean(delta)),
                        "individual_paired_deltas": delta,
                    }
                    paired[target][arm]["metrics"][k] = d
                    writer.writerow(
                        [
                            target,
                            arm,
                            len(paired_rows),
                            k,
                            d["arm_mean"],
                            d["reference_same_folds_mean"],
                            d["mean_paired_delta"],
                        ]
                    )
                    s = t["summaries"][arm]["statistics"][k]
                    assert s["values"] == arm_values
                    np.testing.assert_allclose(
                        [s["mean"], s["sample_sd"], s["median"], s["min"], s["max"]],
                        [
                            np.mean(arm_values),
                            np.std(arm_values, ddof=1),
                            np.median(arm_values),
                            min(arm_values),
                            max(arm_values),
                        ],
                        atol=1e-12,
                    )
                # Threshold-only changes classification, not ranking on matched folds.
                if arm == "v1_rf_nested_threshold":
                    for a, b in paired_rows:
                        assert [p["probability"] for p in a["predictions"]] == [
                            p["probability"] for p in b["predictions"]
                        ]
                        assert a["metrics"]["roc_auc"] == b["metrics"]["roc_auc"]
                        assert a["metrics"]["pr_auc"] == b["metrics"]["pr_auc"]
                        assert (
                            a["metrics"]["average_precision"] == b["metrics"]["average_precision"]
                        )
            final = t["final_candidate"]
            ids = data.features.index.tolist()
            audit_inner(
                final["inner_selection"],
                data.targets[target].to_numpy(),
                ids,
                protocol["threshold_rule"],
            )
            eligible = [s for s in final["inner_selection"] if s["operating_point"] is not None]
            chosen = min(eligible, key=key) if eligible else None
            assert chosen is not None and final["choice"]["candidate"] == chosen["candidate"]
            assert final["choice"]["threshold"] == chosen["operating_point"]["threshold"]
            model = joblib.load(OUTPUT / "v2-candidate" / f"{target}.joblib")
            assert model.named_steps["schema"].fit_row_ids_ == ids
            assert list(model.named_steps["schema"].feature_names_in_) == protocol["predictors"]
            np.testing.assert_allclose(
                positive_probability(model, data.features),
                final["development_check_probabilities"],
                atol=1e-12,
                rtol=1e-10,
            )
            for fit in final["fits"]:
                expected = (
                    ids
                    if fit["context"].endswith("/refit")
                    else folds[target]["full_development_inner"][
                        int(fit["context"].rsplit("-", 1)[1])
                    ]["train_ids"]
                )
                assert fit["fit_records"] == len(expected) and fit[
                    "fit_ids_sha256"
                ] == object_digest(expected)
                all_fits.append(fit)
    assert len(all_fits) == result["fit_count"]
    write_json_once(OUTPUT / "paired_comparisons.json", paired)
    write_once(OUTPUT / "paired_comparisons.csv", csv_buffer.getvalue().encode())
    record = {
        "protocol_sha256": object_digest(protocol),
        "audit_source_sha256": digest((ROOT / "research/v2_lcx_rca/audit.py").read_bytes()),
        "fit_memberships_audited": len(all_fits),
        "outer_arm_evaluations_audited": outer_scored,
        "inner_thresholds_and_selections_recomputed": True,
        "metrics_independently_recomputed": True,
        "paired_same_fold_reference_comparisons": True,
        "threshold_only_ranking_unchanged": True,
        "full_candidate_242_membership_and_predictions_checked": True,
        "holdout_outcomes_accessed": False,
        "fitting_performed_by_audit": False,
        "note": (
            "Post-run audit and descriptive pairing only; "
            "no changes to registered fitting/selection/protocol."
        ),
    }
    write_json_once(OUTPUT / "audit.json", record)
    print(record)


if __name__ == "__main__":
    audit()
