"""Fixed development-only reporting; never changes selection or fits models."""

# Long literal Markdown report sentences are intentionally retained.
# ruff: noqa: E501

import csv
import io
import json
from collections import Counter

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from ml.common import ROOT, object_digest, read_json, write_json_once, write_once  # noqa: E402
from research.v2_lcx_rca.core import ARMS, SCALARS, TARGETS  # noqa: E402
from research.v2_lcx_rca.preregister import OUTPUT  # noqa: E402
from research.v2_lcx_rca.run import preflight  # noqa: E402

LABELS = {
    "v1_rf_0.5": "v1 RF @ 0.5",
    "v1_rf_nested_threshold": "v1 RF + inner threshold",
    "elastic_net": "Elastic-net + inner threshold",
    "forest": "RF/cost-sensitive + inner threshold",
    "xgboost": "XGBoost + inner threshold",
    "selection_procedure": "Complete selection procedure",
}


def diagnosis(t):
    primary = t["summaries"]["selection_procedure"]
    simple = t["summaries"]["v1_rf_nested_threshold"]
    if not t["gate"]["passed"]:
        return (
            "C: complete procedure fails the locked development gate; retain v1 and stop searching."
        )
    m = {k: v["mean"] for k, v in primary["statistics"].items()}
    s = {k: v["mean"] for k, v in simple["statistics"].items() if v is not None}
    if t["threshold_only_gate"]["passed"] and all(
        s[k] >= m[k] - limit
        for k, limit in [("sensitivity", 0.03), ("balanced_accuracy", 0.03), ("roc_auc", 0.02)]
    ):
        return "A: unchanged v1 RF plus inner threshold supplies most useful improvement; prefer operating-point explanation."
    chosen = [r["arms"]["selection_procedure"]["choice"] for r in t["outer_folds"]]
    nonref = sum(c is not None and c["candidate"]["family"] != "reference" for c in chosen)
    if not t["threshold_only_gate"]["passed"] and nonref >= 15:
        return "B: primary passes while threshold-only fails; consistently chosen alternatives support an internal ranking-model change."
    return (
        "Mixed/inconclusive: locked A/B criteria not met; no retrospective best-family replacement."
    )


def report():
    protocol, _, _, _ = preflight()
    result = read_json(OUTPUT / "results.json")
    if result["protocol_sha256"] != object_digest(protocol):
        raise ValueError("Results are not from the locked protocol")
    lines = [
        "# CardioScope v2 LCX/RCA — one bounded development experiment",
        "",
        "This experiment was motivated **after** the v1 final holdout had been observed. "
        "The old 61 records are a consumed historical v1 test — not v2 validation. "
        "No reserved outcome was decoded or used in this experiment. "
        "V1 remains the only version with the existing independent final-holdout result.",
        "",
        "V2 evidence is **internally validated using repeated nested cross-validation** on the "
        "original 242 development records. It is not independent or external validation. "
        "No v2 candidate is deployed; the v1 product, threshold, evidence, SHAP and anatomy remain unchanged.",
        "",
        "## Frozen provenance and preregistration",
        "",
        f"Experiment: `{protocol['experiment_id']}`. Starting hardened commit: `{protocol['starting_commit']}`. "
        f"V1 tag: `{protocol['baseline_tag']}` at `{protocol['baseline_commit']}`.",
        "",
        f"Protocol SHA-256: `{object_digest(protocol)}`. Schema: `{protocol['schema_sha256']}`. "
        f"Development membership: `{protocol['membership_sha256']}`.",
        "",
        "[Protocol](../research/v2_lcx_rca/protocol.json), "
        "[hash receipt](../research/v2_lcx_rca/protocol.sha256), "
        "[experimental folds](../research/v2_lcx_rca/folds.json), "
        "[experimental dependency lock](../research/v2_lcx_rca/requirements.lock.txt). "
        "Protocol, folds, runtime and implementation hashes were sealed before real-data fitting. "
        "Search space/seeds/gates were not adapted after results.",
        "",
        "## Method",
        "",
        "Each target has five deterministic repetitions of target-stratified 5-fold outer CV "
        "(25 evaluations), with stratified 4-fold inner cross-fitting confined to each outer-training set. "
        "Duplicate predictor-group boundaries are enforced at both levels; this source has no duplicated "
        "development groups and no authoritative patient IDs. Outer seeds: "
        f"`{protocol['outer_seeds']}`; all inner/final/estimator seeds are in the protocol.",
        "",
        "All 55 exact predictors are retained, in locked order. Cath/LAD/LCX/RCA, aliases and derived "
        "fields are rejected. One-hot vocabulary is learned within each fit, never from validation rows. "
        "Elastic-net numeric scaling is fold-fitted; tree numerics pass through. No imputation, "
        "feature selection, calibration, early stopping or validation-derived class weights.",
        "",
        "The reference exactly refits the v1 RF specification (100 trees, seed 42, bootstrap, sqrt feature "
        "sampling, leaf 10; LCX depth 3 / RCA depth 5) on the new outer-training sets. "
        "It does not load a model already fitted on all 242 records to score those records.",
        "",
        "Alternatives: 18 elastic-net configurations (C=.03/.1/.3, l1_ratio=0/.5/.9, unweighted/balanced; "
        "SAGA, 20,000 iterations, tol=1e-7, non-convergence aborts); 8 forests (depth 3/5, leaf 5/10, "
        "unweighted/balanced, 500 seeded single-threaded trees); 6 XGBoost configurations (depth 1/2/3 "
        "with unweighted or training-fold negative/positive weighting). XGBoost fixes 200 trees, "
        "learning rate .03, child weight 5, row/column sampling .8, L2=10, gamma=1, CPU hist, one thread. "
        "[XGBoost parameter definitions](https://xgboost.readthedocs.io/en/stable/parameter.html) and "
        "[scikit-learn logistic solver definitions](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html) "
        "support these implementations. There is no second boosting library.",
        "",
        "For each candidate, choose the **highest** inner OOF threshold satisfying sensitivity≥.65 "
        "and specificity≥.60; predict positive when probability≥threshold. No feasible threshold means "
        "ineligible, without an alternative objective or fallback. Rank eligible candidates by inner "
        "balanced accuracy, trapezoidal PR-AUC, ROC-AUC, then locked simplicity rank (12-decimal ties). "
        "The complete pool contains the target's unchanged reference plus all 32 alternatives. "
        "Every arm's rule is frozen before outer outcomes are retrieved; identical selected fits are reused.",
        "",
        "The complete selection procedure is primary. Family-specific procedures are diagnostic, "
        "not grounds to replace it with a retrospectively better outer family. Full-development candidates "
        "use the same selection rule in a separately predeclared 4-fold inner split of all 242 records.",
        "",
        "## Locked success gate",
        "",
        "For each target: all 25 primary rules eligible; mean sensitivity≥.65, specificity≥.60 and "
        "balanced accuracy≥.625; at least 4/5 repeat-pooled results meet all three; no repeat sensitivity<.55 "
        "or specificity<.50. Mean ROC-AUC may not fall more than .02 below the same-fold reference. "
        "Mean precision, PR-AUC and AP must each exceed prevalence by .05; mean predicted-positive rate≤.65. "
        "These repeatability/quality definitions operationalize the request before fitting. "
        "BOTH targets must pass for joint success. They are prototype research criteria, not clinical standards.",
        "",
        "## Complete development results",
        "",
        "Values below are unweighted outer-fold mean ± sample SD. Missing operating rules are not "
        "substituted; available-fold diagnostic summaries are explicitly counted and incomplete repeats "
        "receive no pooled operating estimate. All median/min/max/individual metric values and confusion "
        "matrices are in [results.json](../artifacts/experiments/v2-lcx-rca-20261003-01/results.json), "
        "[all outer evaluations CSV](../artifacts/experiments/v2-lcx-rca-20261003-01/outer_metrics.csv), "
        "and per-fold JSON in the same artifact directory. No unfavorable metric is omitted.",
        "",
    ]
    csv_buffer = io.StringIO()
    writer = csv.DictWriter(
        csv_buffer,
        fieldnames=[
            "target",
            "arm",
            "repeat",
            "fold",
            "status",
            "candidate",
            "threshold",
            *SCALARS,
            "tn",
            "fp",
            "fn",
            "tp",
        ],
    )
    writer.writeheader()
    compact = {}
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), constrained_layout=True)
    for target, ax in zip(TARGETS, axes, strict=True):
        t = result["targets"][target]
        lines += [
            f"### {target}",
            "",
            "| Arm | Evaluated /25 | Sensitivity | Specificity | BA | PPV | F1 | ROC-AUC | PR-AUC | AP | Positive rate | Prevalence |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        compact[target] = {"gate": t["gate"], "diagnosis": diagnosis(t), "arms": {}}
        for arm in ARMS:
            summary = t["summaries"][arm]

            def f(k):
                v = summary["statistics"][k]
                return (
                    "ineligible"
                    if v is None
                    else f"{v['mean']:.3f} ± {v['sample_sd']:.3f}"
                    if v["sample_sd"] is not None
                    else f"{v['mean']:.3f}"
                )

            lines.append(
                f"| {LABELS[arm]} | {summary['evaluated_folds']} | "
                + " | ".join(f(k) for k in SCALARS)
                + " |"
            )
            compact[target]["arms"][arm] = {
                k: None if v is None else v["mean"] for k, v in summary["statistics"].items()
            }
            if summary["statistics"]["sensitivity"]:
                sens, spec = (
                    summary["statistics"]["sensitivity"],
                    summary["statistics"]["specificity"],
                )
                ax.errorbar(
                    spec["mean"],
                    sens["mean"],
                    xerr=spec["sample_sd"],
                    yerr=sens["sample_sd"],
                    fmt="o",
                    capsize=3,
                    label=LABELS[arm],
                )
        ax.axhline(0.65, color="grey", linestyle="--", linewidth=1)
        ax.axvline(0.60, color="grey", linestyle="--", linewidth=1)
        ax.set(xlim=(0, 1), ylim=(0, 1), xlabel="Specificity", ylabel="Sensitivity", title=target)
        ax.grid(alpha=0.2)
        if target == "RCA":
            ax.legend(fontsize=7, loc="lower left")
        lines += [
            "",
            "#### Threshold distributions and selections",
            "",
            "| Arm | Eligible thresholds | Median | Min | Max | Selected families |",
            "| --- | ---: | ---: | ---: | ---: | --- |",
        ]
        for arm in ARMS:
            rows = [r["arms"][arm] for r in t["outer_folds"]]
            eligible = [r for r in rows if r["choice"] is not None]
            thresholds = [r["choice"]["threshold"] for r in eligible]
            families = dict(Counter(r["choice"]["candidate"]["family"] for r in eligible))
            stats = (
                f"{np.median(thresholds):.6f} | {min(thresholds):.6f} | {max(thresholds):.6f}"
                if thresholds
                else "— | — | —"
            )
            lines.append(f"| {LABELS[arm]} | {len(thresholds)} | {stats} | `{families}` |")
            compact[target]["arms"][arm + "_thresholds"] = thresholds
            for row in rows:
                mm = row["metrics"] or {}
                cc = row["choice"]
                cm = mm.get("confusion_matrix", [[None, None], [None, None]])
                writer.writerow(
                    {
                        "target": target,
                        "arm": arm,
                        "repeat": row["repeat"] + 1,
                        "fold": row["fold"] + 1,
                        "status": row["status"],
                        "candidate": cc["candidate"]["id"] if cc else "",
                        "threshold": cc["threshold"] if cc else "",
                        **{k: mm.get(k, "") for k in SCALARS},
                        "tn": cm[0][0],
                        "fp": cm[0][1],
                        "fn": cm[1][0],
                        "tp": cm[1][1],
                    }
                )
        lines += [
            "",
            "#### Repeat-to-repeat stability",
            "",
            "Primary procedure: one cross-fitted prediction per patient per repeat.",
            "",
            "| Repeat | Status | Sensitivity | Specificity | BA | PPV | ROC-AUC | PR-AUC | AP | Positive rate | Confusion [TN FP; FN TP] |",
            "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
        ]
        for repeat in t["summaries"]["selection_procedure"]["repeat_pooled"]:
            mm = repeat["metrics"]
            ks = [
                "sensitivity",
                "specificity",
                "balanced_accuracy",
                "precision",
                "roc_auc",
                "pr_auc",
                "average_precision",
                "predicted_positive_rate",
            ]
            values = [f"{mm[k]:.3f}" if mm else "—" for k in ks]
            lines.append(
                f"| {repeat['repeat'] + 1} | {repeat['status']} | "
                + " | ".join(values)
                + f" | `{mm['confusion_matrix'] if mm else None}` |"
            )
        lines += [
            "",
            f"**Primary gate: {'PASS' if t['gate']['passed'] else 'FAIL'}.** "
            f"Checks: `{t['gate'].get('checks', {})}`. Threshold-only gate: "
            f"`{t['threshold_only_gate']}`.",
            "",
            f"**Diagnosis:** {diagnosis(t)}",
            "",
        ]
        final = t["final_candidate"]
        compact[target]["final_candidate"] = final["choice"]
        lines += ["#### Full-development candidate (not deployed)", ""]
        if final["choice"] is None:
            lines += ["No feasible candidate; no model artifact persisted.", ""]
        else:
            choice = final["choice"]
            lines += [
                f"Selected `{choice['candidate']['id']}`; parameters `{choice['candidate']['params']}`; "
                f"threshold **{choice['threshold']:.17g}**. Exact fixed parameters are in the protocol and the pipeline joblib. "
                f"Fitted on `{final['preprocessing']['fit_record_count']}` development records only. "
                f"Single-profile latency median of 20: {final['single_profile_latency_median_ms']:.3f} ms.",
                "",
                "The final candidate's inner selection scores are not its independent performance. "
                "A persisted research candidate can exist even when the nested development gate fails; "
                "persistence is not promotion or a success claim.",
                "",
            ]
        lines += [
            "Conditional patient/group bootstrap 95% percentile intervals for the complete procedure: "
            f"`{t['conditional_uncertainty']}`.",
            "",
        ]
    lines += [
        "## Joint conclusion",
        "",
        f"Locked joint success: **{'PASS' if result['joint_success'] else 'FAIL'}**. "
        "The two targets are separate problems; a favorable result for one does not rescue a failed joint gate. "
        "No new search, threshold objective, calibration or feature subset is authorized by these results.",
        "",
        "![Development operating points](../artifacts/experiments/v2-lcx-rca-20261003-01/operating_points.png)",
        "",
        "Plot error bars are descriptive sample SD across correlated folds, not independent-cohort "
        "confidence intervals or a fitted ROC frontier.",
        "",
        "## Runtime and reproduction",
        "",
        f"Total experiment wall time: **{result['elapsed_seconds']:.2f} seconds**; "
        f"**{result['fit_count']} fits**. Reused identical reference/selected predictions are counted once. "
        "Per-family fit counts/seconds (excludes preprocessing/selection/report overhead outside fitting):",
        "",
        "```json",
        json.dumps(result["per_family_fit_runtime"], indent=2),
        "```",
        "",
        "Use the separate environment; do not install XGBoost into v1:",
        "",
        "```sh",
        "uv venv --python .venv/bin/python .runtime/v2",
        "uv pip sync --python .runtime/v2/bin/python research/v2_lcx_rca/requirements.lock.txt",
        ".runtime/v2/bin/python -m pytest research/v2_lcx_rca/tests -q",
        ".runtime/v2/bin/python -m research.v2_lcx_rca.run --reproduce",
        "```",
        "",
        "`--reproduce` repeats every inner/outer fit and full-development selection without overwriting "
        "models/results, comparing choices, thresholds, all metrics/OOF probabilities and saved/fresh "
        "candidate probabilities within the locked tolerances. Protocol/runtime/code/inputs and saved "
        "artifact hashes are checked first. Timing is separately recorded. Registration cannot be repeated "
        "to redefine this experiment. The documented experimental lock is tested on macOS ARM64; "
        "v2 Linux portability is not claimed.",
        "",
        "## Boundary and verification",
        "",
        "Runtime guards forbid the reserved loader, final evaluator, full-workbook outcome audit/loading "
        "and split recreation. The existing safe development reader hashes predictor groups before "
        "decoding development targets; reserved target cells are skipped. Opaque source/protected bytes "
        "and original split IDs are read for integrity/membership, not interpreted as v2 outcomes. "
        "Synthetic poisoned-target tests fail loudly if reserved cells are decoded. All training "
        "memberships are checked and recorded; outer outcomes enter only scoring after rules are fixed.",
        "",
        "[Verification record](../artifacts/experiments/v2-lcx-rca-20261003-01/verification.json) "
        "records the safe v1/v2 checks, unchanged protected files and complete deterministic rerun. "
        "No frontend, v1 models/locks/evidence/SHAP/anatomy or final-evaluation receipt is modified.",
        "",
        "## Limitations and evidence status",
        "",
        "This is a small, same-source development experiment motivated post-holdout. Repetitions reuse "
        "the same patients and overlapping training data; 25 folds are not 25 independent studies. "
        "Thresholds are adaptive selection inputs estimated from relatively small inner OOF panels. "
        "The bootstrap resamples patient/group predictions jointly across five repeats, conditional on "
        "the fitted rules; it omits retraining/selection uncertainty and is not a complete generalization "
        "confidence interval. True patient identifiers are unavailable. RF randomness is fixed; 500 trees "
        "reduce but do not prove elimination of Monte Carlo variability. Probabilities are uncalibrated; "
        "class weighting can change their interpretation. PR-AUC is trapezoidal and distinct from AP. "
        "Prototype sensitivity/specificity constraints establish no clinical safety or utility. "
        "Any future claim of independent v2 validation requires genuinely new, untouched data.",
        "",
        "**Stop here. Keep v1 deployed unchanged. These candidates remain research artifacts only.**",
        "",
    ]
    write_once(OUTPUT / "outer_metrics.csv", csv_buffer.getvalue().encode())
    write_json_once(OUTPUT / "summary.json", compact)
    fig.suptitle("Internal development CV — mean ± descriptive fold SD")
    # Plot is a derived report, never a selection input.
    fig.savefig(OUTPUT / "operating_points.png", dpi=160)
    plt.close(fig)
    write_once(ROOT / "docs/V2_LCX_RCA.md", "\n".join(lines).encode())
    print(json.dumps(compact, indent=2))


if __name__ == "__main__":
    report()
