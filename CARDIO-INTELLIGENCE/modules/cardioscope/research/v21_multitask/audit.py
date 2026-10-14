"""Recompute selection provenance, preprocessing, metrics and immutable seals after fitting."""

import subprocess

import numpy as np

from ml.common import ROOT, digest, object_digest, read_json, write_json_once
from research.v2_lcx_rca.core import choose_threshold, development_boundary, metrics
from research.v21_multitask.core import TASKS, context_seed, decision, select, stop_partition
from research.v21_multitask.preregister import OUTPUT
from research.v21_multitask.run import analyze, preflight


def audit():
    with development_boundary():
        protocol, data, manifest, folds = preflight()
        records = []
        stages, examined = 0, 0
        for focus in ("LCX", "RCA"):
            for r, outer in enumerate(folds[focus]["repeats"]):
                for f, fold in enumerate(outer):
                    record = read_json(OUTPUT / "folds" / f"{focus}-r{r}-f{f}.json")
                    records.append(record)
                    parent = fold["train_ids"]
                    assert record["protocol_sha256"] == object_digest(protocol)
                    assert record["outer_fit"]["ids"] == parent
                    assert record["outer_fit"]["preprocessing"][
                        "fit_row_ids_sha256"
                    ] == object_digest(parent)
                    assert (
                        record["outer_fit"]["trace"]["executed_epochs"]
                        == record["decision"]["epochs"]
                    )
                    for entry in record["training_ledger"]:
                        n = int(entry["context"].rsplit("-", 1)[1])
                        inner = fold["inner"][n]
                        ids = inner["train_ids"]
                        stop = stop_partition(
                            data.targets.loc[ids], data.groups.loc[ids], focus, entry["context"]
                        )
                        assert entry["fit_ids"] == stop["train_ids"]
                        assert entry["stop_ids"] == stop["validation_ids"]
                        assert entry["refit_ids"] == ids
                        assert entry["scoring_ids"] == inner["validation_ids"]
                        assert entry["seed"] == context_seed(entry["context"])
                        assert entry["refit_seed"] == entry["seed"] + 1
                        trace = entry["stopping"]
                        best, epoch, stale = float("inf"), 1, 0
                        for k, loss in enumerate(trace["stopping_losses"], 1):
                            if loss < best - protocol["training"]["min_delta"]:
                                best, epoch, stale = loss, k, 0
                            else:
                                stale += 1
                        assert epoch == trace["best_epoch"]
                        assert len(trace["stopping_losses"]) == trace["executed_epochs"]
                        assert (
                            stale >= protocol["training"]["patience"]
                            or k == protocol["training"]["max_epochs"]
                        )
                        assert entry["refit"]["executed_epochs"] == epoch
                        for key, fit_ids in (
                            ("stop_preprocessing", stop["train_ids"]),
                            ("refit_preprocessing", ids),
                        ):
                            pre = entry[key]
                            assert pre["fit_row_ids_sha256"] == object_digest(fit_ids)
                            assert pre["feature_order"] == manifest["feature_order"]
                            scale = pre["numeric_scaling"]
                            np.testing.assert_allclose(
                                scale["mean"],
                                data.features.loc[fit_ids, scale["features"]].mean().to_numpy(),
                                atol=1e-10,
                            )
                            for name, vocab in pre["training_categories"].items():
                                assert set(vocab) == set(data.features.loc[fit_ids, name])
                        stages += 2
                    stages += 1
                    for row in record["inner_selection"]:
                        idx = [q["row_id"] for q in row["oof"]]
                        assert len(idx) == len(set(idx)) and set(idx) == set(parent)
                        p = np.array([q["probabilities"] for q in row["oof"]])
                        for t in ("LCX", "RCA"):
                            op = choose_threshold(
                                data.targets.loc[idx, t],
                                p[:, TASKS.index(t)],
                                protocol["threshold_rule"],
                            )
                            assert op == row["operating_points"][t]
                        for ti, t in enumerate(TASKS):
                            assert (
                                metrics(data.targets.loc[idx, t], p[:, ti], p[:, ti] >= 0.5)
                                == row["ranking_metrics"][t]
                            )
                        assert row["refit_epochs"] == int(np.floor(np.median(row["epochs"]) + 0.5))
                    chosen, eligible = select(record["inner_selection"], focus)
                    assert decision(chosen, eligible) == record["decision"]
                    assert record["decision_sha256"] == object_digest(record["decision"])
                    for t, arms in record["arms"].items():
                        for name, value in arms.items():
                            if value["status"] != "evaluated":
                                assert value["predictions"] == [] and value["metrics"] is None
                                continue
                            pred = value["predictions"]
                            idx = [q["row_id"] for q in pred]
                            assert idx == fold["validation_ids"]
                            assert [q["positive"] for q in pred] == data.targets.loc[
                                idx, t
                            ].tolist()
                            assert (
                                metrics(
                                    [q["positive"] for q in pred],
                                    [q["probability"] for q in pred],
                                    [q["predicted_positive"] for q in pred],
                                )
                                == value["metrics"]
                            )
                            if name.startswith("multitask"):
                                threshold = value["threshold"]
                                assert all(
                                    q["predicted_positive"] == int(q["probability"] >= threshold)
                                    for q in pred
                                )
                            examined += 1
        result = read_json(OUTPUT / "results.json")
        assert analyze(records, protocol) == {k: result[k] for k in analyze(records, protocol)}
        if not result["joint_gate_passed"]:
            assert not (OUTPUT / "candidate").exists()
        frozen = read_json(ROOT / "docs/product/IMMUTABLE_INPUTS.json")
        for name, sha in frozen.items():
            tagged = subprocess.check_output(["git", "show", f"cardioscope-v1.0.0:{name}"])
            assert digest(tagged) == sha
        report = {
            "status": "PASS",
            "training_stages_audited": stages,
            "outer_arms_recomputed": examined,
            "v1_tag_byte_identical_files": len(frozen),
            "all_baseline_files_unchanged": len(protocol["baseline_files_sha256"]),
            "holdout_reader_calls": 0,
            "holdout_outcome_use": False,
            "protocol_sha256": object_digest(protocol),
        }
        write_json_once(OUTPUT / "audit.json", report)
        print(report)


if __name__ == "__main__":
    audit()
