"""Generate a complete, descriptive development-only experiment report after the sealed run."""

from collections import Counter

import numpy as np

from ml.common import ROOT, object_digest, read_json, write_once
from research.v21_multitask.preregister import HERE, OUTPUT

METRICS = (
    "sensitivity",
    "specificity",
    "balanced_accuracy",
    "precision",
    "f1",
    "roc_auc",
    "pr_auc",
    "average_precision",
    "predicted_positive_rate",
)


def mean(summary, key):
    stat = summary["statistics"][key]
    return "—" if stat is None else f"{stat['mean']:.4f}"


def table(summaries, names):
    lines = [
        "| Procedure | Folds | " + " | ".join(METRICS) + " |",
        "|---|---:" + "|---:" * len(METRICS) + "|",
    ]
    for name in names:
        summary = summaries[name]
        lines.append(
            f"| {name} | {summary['evaluated_folds']}/25 | "
            + " | ".join(mean(summary, k) for k in METRICS)
            + " |"
        )
    return lines


def generate():
    p = read_json(HERE / "protocol.json")
    result = read_json(OUTPUT / "results.json")
    audit = read_json(OUTPUT / "audit.json")
    reproduction = read_json(OUTPUT / "reproducibility.json")
    folds = [read_json(q) for q in sorted((OUTPUT / "folds").glob("*.json"))]
    lines = [
        "# CardioScope v2.1 — bounded four-task neural experiment",
        "",
        f"**Gate: {'PASS' if result['joint_gate_passed'] else 'FAIL — STOP'}**. "
        + result["final_candidate"]["status"]
        + ".",
        "",
        "Internal development evidence only. No holdout outcomes, deployment, product changes, "
        "or additional architecture attempts. The historical 61-record holdout is not available "
        "as an independent test for this or any later research candidate.",
        "",
        f"Branch: `codex/v2-multitask`. Protocol SHA256: `{object_digest(p)}`. "
        "The protocol and implementation were committed before real-data fitting.",
        "",
        "## Design",
        "",
        "Exactly 242 original development records, 55 predictor fields, four related binary "
        "outputs. No true CAD or vessel labels enter input features or prediction-time inputs. "
        "Two separate repeated nested-CV strata reuse the previous LCX/RCA exact five repeats "
        "of five outer and four inner folds. All networks learn all four tasks. The stratum's "
        "focal task chooses architecture and its screening threshold using inner OOF data only. "
        "The two strata cannot be pooled as independent patient evaluations.",
        "",
        "Sixteen fixed configurations: [32,16]/[64,32], dropout0.1/0.25, Adam L2 "
        "1e-4/1e-3, equal [1,1,1,1] or vessel-focused [1,1,1.5,1.5]. CPU, one thread, "
        "float32, full-batch Adam LR0.001, maximum300epochs, patience30, min_delta1e-4. "
        "No seed search, class weighting, feature selection or calibration.",
        "",
        "Each inner-training partition has a private group-safe stratified20% stopping holdback. "
        "Stopping preprocessing is fitted on the other80%; weighted BCE stopping outcomes never "
        "include inner scoring or outer validation records. A fresh model/preprocessor refits "
        "the complete inner training set for the selected epoch. Outer refit uses the rounded "
        "median of four inner epochs, never outer outcomes. The exact v1 linear fold-safe "
        "preprocessing is reused; one-hot expansion means55 raw variables do not imply55 neurons.",
        "",
        "LCX/RCA thresholds are the highest unique inner OOF probability (+0/1) satisfying "
        "sensitivity≥.65 and specificity≥.60; comparison is >=. Infeasible means ineligible, "
        "with no screening threshold fallback. A fixed inner-ranking-only diagnostic selector "
        "still permits CAD/LAD and clearly labeled vessel@.5 diagnostics in that case.",
        "",
        "## Focal vessel results",
        "",
        "Means below are across eligible outer folds; missing folds remain ineligible. "
        "ROC/PR summaries over different eligible subsets must not be compared without pairing. "
        "PR-AUC is trapezoidal; AP is non-interpolated average precision. Both are reported "
        "because constant predictions can have trapezoidal PR-AUC=(1+prevalence)/2 despite "
        "AP=prevalence. No table is an independent test result.",
        "",
    ]
    for focus in ("LCX", "RCA"):
        lines += [f"### {focus}", ""]
        summary = result["summaries"][focus][focus]
        lines += table(
            summary,
            [
                "v1_rf_0.5",
                "v1_rf_nested_threshold",
                "selection_procedure",
                "multitask",
                "multitask_0.5_diagnostic",
            ],
        )
        lines += ["", f"Preregistered focal gate: `{result['vessel_gates'][focus]}`.", ""]
        records = [r for r in folds if r["focus"] == focus]
        for ref_name in ("v1_rf_0.5", "v1_rf_nested_threshold", "selection_procedure"):
            paired = [
                r
                for r in records
                if r["arms"][focus]["multitask"]["status"] == "evaluated"
                and r["arms"][focus][ref_name]["status"] == "evaluated"
            ]
            if paired:
                differences = {
                    k: float(
                        np.mean(
                            [
                                r["arms"][focus]["multitask"]["metrics"][k]
                                - r["arms"][focus][ref_name]["metrics"][k]
                                for r in paired
                            ]
                        )
                    )
                    for k in METRICS
                }
                lines += [
                    f"Paired multi-task minus `{ref_name}` ({len(paired)} identical folds): "
                    + ", ".join(f"{k} {v:+.4f}" for k, v in differences.items())
                    + ".",
                    "",
                ]
        lines += [
            "Repeat-pooled multi-task screening metrics (each complete repeat =242 OOF "
            "development predictions; correlated repeats, no independent-sample CI):",
            "",
            "| Repeat | Status | Sensitivity | Specificity | BA | ROC-AUC | Positive rate |",
            "|---|---|---:|---:|---:|---:|---:|",
        ]
        for repeat in summary["multitask"]["repeat_pooled"]:
            m = repeat["metrics"]
            values = (
                "— | — | — | — | —"
                if m is None
                else " | ".join(
                    f"{m[k]:.4f}"
                    for k in (
                        "sensitivity",
                        "specificity",
                        "balanced_accuracy",
                        "roc_auc",
                        "predicted_positive_rate",
                    )
                )
            )
            lines.append(f"| {repeat['repeat'] + 1} | {repeat['status']} | {values} |")
        lines += [""]
    lines += [
        "## CAD/LAD preservation",
        "",
        "Exact same-fold v1 CAD/LAD balanced logistic C0.1 is refitted on outer training data "
        "only. All CAD/LAD thresholds stay0.5. Preregistered maximum mean declines: "
        "ROC-AUC0.02, balanced accuracy0.03, sensitivity0.05, AP0.03. Both tasks must pass "
        "in both strata. These are safeguards, not extra model-selection feedback.",
        "",
    ]
    for focus in ("LCX", "RCA"):
        for task in ("CAD", "LAD"):
            lines += [f"### {task}, {focus}-stratified folds", ""]
            lines += table(result["summaries"][focus][task], ["v1_0.5", "multitask"])
            lines += ["", f"Safeguard: `{result['cad_lad_gates'][focus][task]}`.", ""]
    lines += [
        "## Configurations, thresholds and stopping",
        "",
        "Nested CV selects fold-specific configurations; selecting a new single model from "
        "outer rankings would be post-hoc. Frequencies below are descriptive, not a final "
        "winner. A full242-record candidate is permitted only if the full locked gate passes.",
        "",
    ]
    for focus in ("LCX", "RCA"):
        rr = [r for r in folds if r["focus"] == focus]
        counts = Counter(r["decision"]["candidate"]["id"] for r in rr)
        lines += [f"**{focus}** configuration frequencies:", ""]
        lines += [f"- `{name}`: {count}/25" for name, count in sorted(counts.items())]
        thresholds = [r["arms"][focus]["multitask"].get("threshold") for r in rr]
        valid = [t for t in thresholds if t is not None]
        epochs = [r["decision"]["epochs"] for r in rr]
        parameters = [r["outer_fit"]["trace"]["parameter_count"] for r in rr]
        widths = [len(r["outer_fit"]["preprocessing"]["encoded_feature_names"]) for r in rr]
        lines += [
            "",
            f"Focal thresholds: {len(valid)}/25 eligible. "
            + (
                f"Range {min(valid):.6f}–{max(valid):.6f}, median {np.median(valid):.6f}, "
                f"mean {np.mean(valid):.6f}, SD {np.std(valid, ddof=1):.6f}."
                if valid
                else "No eligible screening thresholds."
            ),
            "",
            "Per-repeat thresholds (fold order; null=ineligible): "
            + str(
                [
                    [
                        r["arms"][focus]["multitask"].get("threshold")
                        for r in sorted(rr, key=lambda z: (z["repeat"], z["fold"]))
                        if r["repeat"] == k
                    ]
                    for k in range(5)
                ]
            ),
            "",
            f"Outer refit epochs: range{min(epochs)}–{max(epochs)}, median{np.median(epochs):.0f}; "
            f"encoded channels{min(widths)}–{max(widths)}; "
            f"parameters{min(parameters)}–{max(parameters)}.",
            "",
        ]
    lines += [
        "## Locked gate and disposition",
        "",
        "Both vessel procedures need all25 eligible folds, mean sensitivity≥.65, specificity≥.60, "
        "BA≥.625, at least4/5 complete repeat-pooled passes, no repeat below sensitivity.55/"
        "specificity.50, mean ROC-AUC decline≤.02 versus same-fold v1, positive fraction≤.65, "
        "and PPV/PR-AUC/AP≥prevalence+.05. CAD/LAD safeguards above must also pass.",
        "",
        f"Joint gate passed: **{result['joint_gate_passed']}**. "
        + result["final_candidate"]["status"]
        + ". "
        "No further architectures or threshold changes were attempted.",
        "",
        "## Runtime and verification",
        "",
        f"Bounded study wall time: {result['elapsed_seconds']:.2f}s "
        f"({result['elapsed_seconds'] / 60:.2f}min), "
        f"{result['outer_evaluations']} outer evaluations, "
        f"{result['training_stages']} neural training stages, {result['reference_fits']} "
        "same-fold CAD/LAD reference fits. Stage count includes private stopping fits and "
        "fresh epoch-constrained refits. No final all-development fit on failure.",
        "",
        f"Real-data deterministic verification repeated the complete first-fold16-config "
        f"inner search and outer refit ({reproduction['elapsed_seconds']:.2f}s); decisions, "
        "epochs, probabilities and metrics reproduced. This repeats the sealed computation "
        "for verification; it is not an additional search or different seed experiment.",
        "",
        f"Post-run audit: {audit['training_stages_audited']} neural stages; "
        f"{audit['outer_arms_recomputed']} outer arm metrics; all private stopping and scoring "
        "memberships, train-only scaler/category fits, OOF thresholds and decisions recomputed. "
        f"All {audit['v1_tag_byte_identical_files']} protected v1 files match the original tag "
        f"byte-for-byte; all {audit['all_baseline_files_unchanged']} pre-existing tracked files "
        "and previous v2 artifacts remain unchanged.",
        "",
        "Holdout outcome use: **zero**. Reserved readers and final evaluator were blocked for "
        "the entire run. The approved loader decodes only development target cells; raw "
        "source/frozen file checksum reads are opaque verification, not holdout evaluation. "
        "No historical holdout result was deserialized. The original split was not regenerated.",
        "",
        "Tests and checks are recorded in `checks.json` alongside results. The product runtime, "
        "frontend, data contract, trained models and deployment are unchanged.",
        "",
        "Reproduce using the isolated hash-locked environment and "
        "`python -m research.v21_multitask.run --reproduce-first-fold`. The default runner refuses "
        "a completed experiment. Refer to the sealed `protocol.json`, per-fold traces, "
        "`results.json`, `audit.json` and `reproducibility.json` for full provenance.",
        "",
    ]
    write_once(ROOT / "docs/V21_MULTITASK.md", ("\n".join(lines)).encode())
    print("Report written: docs/V21_MULTITASK.md")


if __name__ == "__main__":
    generate()
