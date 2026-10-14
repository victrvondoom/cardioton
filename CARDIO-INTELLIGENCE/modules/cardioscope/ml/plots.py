"""Small, explicitly development-only figures and comparison tables."""

import csv
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from ml.common import write_once
from ml.metrics import SCALARS

LABELS = {
    "dummy": "Dummy prior",
    "logistic": "Inner-selected logistic",
    "forest": "Inner-selected forest",
    "selection_procedure": "All-family selection",
}


def save_figure(path, figure, fingerprint):
    plt.rcParams["svg.hashsalt"] = fingerprint
    for suffix in ["png", "svg"]:
        stream = io.BytesIO()
        metadata = {"Date": None} if suffix == "svg" else {"Software": "CardioScope DEVELOPMENT"}
        figure.savefig(stream, format=suffix, dpi=140, metadata=metadata)
        write_once(path.with_suffix("." + suffix), stream.getvalue())
    plt.close(figure)


def save_figures(out, results):
    table = io.StringIO(newline="")
    fields = ["phase", "target", "family", "negative_records", "positive_records"]
    fields += [item for metric in SCALARS for item in [metric + "_mean", metric + "_std"]]
    fields += ["pooled_tn", "pooled_fp", "pooled_fn", "pooled_tp"]
    writer = csv.DictWriter(table, fieldnames=fields)
    writer.writeheader()
    for target, row in results["targets"].items():
        figure, axes = plt.subplots(1, 2, figsize=(10, 4), layout="constrained")
        confusion_figure, confusion_axes = plt.subplots(2, 2, figsize=(8, 7), layout="constrained")
        for index, (family, aggregate) in enumerate(row["aggregate"].items()):
            metrics = aggregate["fold_metrics"]
            roc = aggregate["pooled_oof_curves"]["roc"]
            pr = aggregate["pooled_oof_curves"]["precision_recall"]
            axes[0].plot(
                roc["false_positive_rate"], roc["true_positive_rate"], label=LABELS[family]
            )
            axes[1].plot(pr["recall"], pr["precision"], label=LABELS[family])
            cm = aggregate["pooled_oof_metrics"]["confusion_matrix"]
            axis = confusion_axes.flat[index]
            axis.imshow(cm, cmap="Blues", vmin=0)
            for i in range(2):
                for j in range(2):
                    axis.text(j, i, str(cm[i][j]), ha="center", va="center")
            axis.set(
                xticks=[0, 1],
                yticks=[0, 1],
                xlabel="Predicted (threshold 0.5)",
                ylabel="True",
                title=LABELS[family],
            )
            values = {
                "phase": "DEVELOPMENT_NESTED_CV",
                "target": target,
                "family": family,
                "negative_records": row["class_counts"]["0"],
                "positive_records": row["class_counts"]["1"],
                "pooled_tn": cm[0][0],
                "pooled_fp": cm[0][1],
                "pooled_fn": cm[1][0],
                "pooled_tp": cm[1][1],
            }
            for metric in SCALARS:
                for statistic in ["mean", "std"]:
                    values[metric + "_" + statistic] = metrics[metric][statistic]
            writer.writerow(values)
        axes[0].plot([0, 1], [0, 1], linestyle="--", color="gray")
        axes[1].axhline(
            row["class_counts"]["1"] / sum(row["class_counts"].values()),
            linestyle="--",
            color="gray",
            label="Development prevalence",
        )
        axes[0].set(
            xlabel="False positive rate", ylabel="True positive rate", title="Pooled outer-fold ROC"
        )
        axes[1].set(xlabel="Recall", ylabel="Precision", title="Pooled outer-fold PR")
        for axis in axes:
            axis.set_xlim(0, 1)
            axis.set_ylim(0, 1.02)
            axis.legend(fontsize=7)
        figure.suptitle(f"{target} — DEVELOPMENT / NESTED CV (242 OOF records)")
        confusion_figure.suptitle(f"{target} — DEVELOPMENT / NESTED CV confusion matrices")
        save_figure(
            out / "figures" / f"{target}-curves", figure, results["training_configuration_sha256"]
        )
        save_figure(
            out / "figures" / f"{target}-confusion",
            confusion_figure,
            results["training_configuration_sha256"],
        )
    write_once(out / "comparison.csv", table.getvalue().encode())
