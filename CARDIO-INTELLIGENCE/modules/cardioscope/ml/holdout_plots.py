"""Clearly labeled FINAL HOLDOUT artifacts derived solely from saved pairs/results."""

import csv
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from ml.common import write_json_once, write_once
from ml.metrics import SCALARS


def save_holdout_outputs(out, results, fingerprint):
    plt.rcParams["svg.hashsalt"] = fingerprint
    roc_figure, roc_axes = plt.subplots(2, 2, figsize=(9, 8), layout="constrained")
    pr_figure, pr_axes = plt.subplots(2, 2, figsize=(9, 8), layout="constrained")
    cm_figure, cm_axes = plt.subplots(2, 2, figsize=(8, 7), layout="constrained")
    csv_text = io.StringIO(newline="")
    writer = csv.DictWriter(
        csv_text,
        fieldnames=[
            "phase",
            "target",
            "negative_records",
            "positive_records",
            *SCALARS,
            "tn",
            "fp",
            "fn",
            "tp",
        ],
    )
    writer.writeheader()
    for index, (target, row) in enumerate(results["targets"].items()):
        metrics, curves = row["metrics"], row["curves"]
        roc, pr = curves["roc"], curves["precision_recall"]
        axis = roc_axes.flat[index]
        axis.plot(roc["false_positive_rate"], roc["true_positive_rate"])
        axis.plot([0, 1], [0, 1], linestyle="--", color="gray")
        axis.set(
            xlabel="False positive rate",
            ylabel="True positive rate",
            xlim=(0, 1),
            ylim=(0, 1.02),
            title=f"{target}: ROC-AUC {metrics['roc_auc']:.3f}",
        )
        axis = pr_axes.flat[index]
        axis.plot(pr["recall"], pr["precision"])
        counts = metrics["class_counts"]
        axis.axhline(counts["1"] / sum(counts.values()), linestyle="--", color="gray")
        axis.set(
            xlabel="Recall",
            ylabel="Precision",
            xlim=(0, 1),
            ylim=(0, 1.02),
            title=(
                f"{target}: AP {metrics['average_precision']:.3f}; PR-AUC {metrics['pr_auc']:.3f}"
            ),
        )
        cm = metrics["confusion_matrix"]
        axis = cm_axes.flat[index]
        axis.imshow(cm, cmap="Blues", vmin=0)
        for i in range(2):
            for j in range(2):
                axis.text(j, i, str(cm[i][j]), ha="center", va="center")
        axis.set(
            xticks=[0, 1],
            yticks=[0, 1],
            xlabel="Predicted (threshold 0.5)",
            ylabel="True",
            title=target,
        )
        writer.writerow(
            {
                "phase": "FINAL_HOLDOUT",
                "target": target,
                "negative_records": counts["0"],
                "positive_records": counts["1"],
                **{name: metrics[name] for name in SCALARS},
                "tn": cm[0][0],
                "fp": cm[0][1],
                "fn": cm[1][0],
                "tp": cm[1][1],
            }
        )
    for name, figure in [
        ("roc", roc_figure),
        ("precision-recall", pr_figure),
        ("confusion", cm_figure),
    ]:
        count = sum(next(iter(results["targets"].values()))["metrics"]["class_counts"].values())
        figure.suptitle(f"FINAL HOLDOUT — {count} locked records; frozen models; no refitting")
        for suffix in ["png", "svg"]:
            stream = io.BytesIO()
            metadata = (
                {"Date": None} if suffix == "svg" else {"Software": "CardioScope FINAL HOLDOUT"}
            )
            figure.savefig(stream, format=suffix, dpi=140, metadata=metadata)
            write_once(out / "figures" / f"{name}.{suffix}", stream.getvalue())
        plt.close(figure)
    write_once(out / "metrics.csv", csv_text.getvalue().encode())
    write_json_once(
        out / "confusion_matrices.json",
        {t: r["metrics"]["confusion_matrix"] for t, r in results["targets"].items()},
    )
    write_json_once(out / "curves.json", {t: r["curves"] for t, r in results["targets"].items()})
    write_json_once(
        out / "uncertainty.json", {t: r["uncertainty"] for t, r in results["targets"].items()}
    )
    write_json_once(
        out / "development_comparison.json",
        {t: r["development_comparison"] for t, r in results["targets"].items()},
    )
