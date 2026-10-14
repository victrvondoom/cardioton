"""Single sealed experiment; no holdout evaluation, inference integration or deployment."""

import argparse
import json
import time

import joblib
import torch
from threadpoolctl import threadpool_limits

from ml.common import ROOT, digest, object_digest, read_json, utc_now, write_json_once
from ml.models import preprocessing_metadata
from research.v2_lcx_rca.core import (
    development_boundary,
    load_data,
    success_gate,
    summarize,
    validate_folds,
)
from research.v21_multitask.core import (
    TASKS,
    VESSELS,
    arm,
    decision,
    fit_selected,
    inner_select,
    predict,
    reference_fit,
    select,
    stronger_gate,
)
from research.v21_multitask.preregister import FOLDS, HERE, OUTPUT, PREVIOUS, identity, runtime
from scripts.verify_immutable import verify


def preflight():
    verify()
    p = read_json(HERE / "protocol.json")
    if object_digest(p) != (HERE / "protocol.sha256").read_text().strip():
        raise ValueError("Protocol seal changed")
    for name, sha in {**p["baseline_files_sha256"], **p["source_files_sha256"]}.items():
        if digest((ROOT / name).read_bytes()) != sha:
            raise ValueError("Protected baseline or preregistered implementation changed: " + name)
    if digest((HERE / "requirements.lock.txt").read_bytes()) != p["requirements_lock_sha256"]:
        raise ValueError("Dependency lock changed")
    if runtime() != p["runtime"]:
        raise ValueError("Runtime changed")
    data, manifest = load_data()
    if (
        identity(data) != {k: p[k] for k in identity(data)}
        or object_digest(manifest) != p["schema_sha256"]
    ):
        raise ValueError("Development contract changed")
    folds = read_json(FOLDS)
    validate_folds(data, folds)
    if (
        object_digest(folds) != p["folds_sha256"]
        or digest(PREVIOUS.read_bytes()) != p["previous_results_sha256"]
    ):
        raise ValueError("Previous development folds/references changed")
    return p, data, manifest, folds


def evaluate_fold(data, manifest, protocol, fold, focus, repeat, number, previous):
    training, validation = fold["train_ids"], fold["validation_ids"]
    context = f"{focus}/repeat-{repeat}/outer-{number}"
    rows, ledger = inner_select(
        data.features.loc[training],
        data.targets.loc[training, list(TASKS)],
        data.groups.loc[training],
        fold["inner"],
        manifest,
        protocol,
        context,
    )
    chosen, eligible = select(rows, focus)
    frozen_decision = decision(chosen, eligible)
    sealed = object_digest(frozen_decision)
    started = time.perf_counter()
    model, pre, trace = fit_selected(
        data.features.loc[training],
        data.targets.loc[training, list(TASKS)],
        manifest,
        protocol,
        chosen,
        context + "/outer-refit",
    )
    probabilities = predict(model, pre, data.features.loc[validation])
    refit_seconds = time.perf_counter() - started
    # Outcomes are retrieved only AFTER decision and prediction.
    outcomes = data.targets.loc[validation, list(TASKS)]
    arms = {}
    for ti, task in enumerate(TASKS):
        if task in VESSELS:
            op = chosen["operating_points"][task]
            threshold = None if op is None else op["threshold"]
        else:
            threshold = 0.5
        arms[task] = {
            "multitask": arm(
                outcomes[task],
                probabilities[:, ti],
                validation,
                threshold,
                repeat,
                number,
                frozen_decision,
            ),
            "multitask_0.5_diagnostic": arm(
                outcomes[task], probabilities[:, ti], validation, 0.5, repeat, number
            ),
        }
        if task in ("CAD", "LAD"):
            ref = reference_fit(
                data.features.loc[training],
                data.targets.loc[training],
                data.features.loc[validation],
                task,
                manifest,
                protocol["schema_sha256"],
            )
            arms[task]["v1_0.5"] = arm(outcomes[task], ref, validation, 0.5, repeat, number)
    old = previous["targets"][focus]["outer_folds"][repeat * 5 + number]["arms"]
    for name in ("v1_rf_0.5", "v1_rf_nested_threshold", "selection_procedure"):
        entry = old[name]
        if entry["status"] == "evaluated":
            if [r["row_id"] for r in entry["predictions"]] != validation:
                raise ValueError("Previous reference membership is not identical")
            if [r["positive"] for r in entry["predictions"]] != outcomes[focus].tolist():
                raise ValueError("Previous DEVELOPMENT outcome orientation differs")
        arms[focus][name] = entry
    if sealed != object_digest(frozen_decision):
        raise ValueError("Outer outcomes altered configuration")
    return {
        "focus": focus,
        "repeat": repeat,
        "fold": number,
        "protocol_sha256": object_digest(protocol),
        "decision_sha256": sealed,
        "decision": frozen_decision,
        "inner_selection": rows,
        "training_ledger": ledger,
        "outer_fit": {
            "ids": training,
            "preprocessing": preprocessing_metadata(pre),
            "trace": trace,
            "seconds": refit_seconds,
        },
        "arms": arms,
    }


def analyze(all_folds, protocol):
    result = {}
    vessel_gates, safeguards = {}, {}
    for focus in VESSELS:
        records = [r for r in all_folds if r["focus"] == focus]
        summary = {
            task: {
                name: summarize([r["arms"][task][name] for r in records])
                for name in records[0]["arms"][task]
            }
            for task in TASKS
        }
        vessel_gates[focus] = success_gate(
            summary[focus]["multitask"], summary[focus]["v1_rf_0.5"], protocol["gate"]
        )
        safeguards[focus] = {
            t: stronger_gate(
                summary[t]["multitask"],
                summary[t]["v1_0.5"],
                protocol["cad_lad_maximum_mean_decline"],
            )
            for t in ("CAD", "LAD")
        }
        result[focus] = summary
    passed = all(g["passed"] for g in vessel_gates.values()) and all(
        g["passed"] for stratum in safeguards.values() for g in stratum.values()
    )
    return {
        "summaries": result,
        "vessel_gates": vessel_gates,
        "cad_lad_gates": safeguards,
        "joint_gate_passed": passed,
    }


def final_if_pass(data, manifest, folds, protocol):
    rows, ledger = inner_select(
        data.features,
        data.targets.loc[:, list(TASKS)],
        data.groups,
        folds["LCX"]["full_development_inner"],
        manifest,
        protocol,
        "LCX/full-development",
    )
    selected, eligible = select(rows, "LCX", joint=True)
    if not eligible:
        return {"status": "not frozen: no joint eligible full-development rule"}
    model, pre, trace = fit_selected(
        data.features,
        data.targets.loc[:, list(TASKS)],
        manifest,
        protocol,
        selected,
        "LCX/full-development/refit",
    )
    path = OUTPUT / "candidate"
    path.mkdir()
    torch.save(model.state_dict(), path / "weights.pt")
    joblib.dump(pre, path / "preprocessor.joblib")
    payload = {
        "status": "FROZEN DEVELOPMENT-ONLY; NO DEPLOYMENT OR HOLDOUT",
        "decision": decision(selected, True),
        "preprocessing": preprocessing_metadata(pre),
        "trace": trace,
        "protocol_sha256": object_digest(protocol),
        "inner_selection": rows,
        "ledger": ledger,
        "files_sha256": {p.name: digest(p.read_bytes()) for p in path.iterdir()},
    }
    write_json_once(path / "provenance.json", payload)
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reproduce-first-fold", action="store_true")
    args = parser.parse_args()
    started = time.perf_counter()
    with development_boundary(), threadpool_limits(limits=1):
        protocol, data, manifest, folds = preflight()
        previous = read_json(PREVIOUS)  # development-only v2 outcomes; NOT v1 holdout.
        if args.reproduce_first_fold:
            original = read_json(OUTPUT / "folds/LCX-r0-f0.json")
            new = evaluate_fold(
                data, manifest, protocol, folds["LCX"]["repeats"][0][0], "LCX", 0, 0, previous
            )
            compare_reproduction(original, new)
            write_json_once(
                OUTPUT / "reproducibility.json",
                {
                    "status": "identical decisions/epochs/OOF+outer probabilities and metrics",
                    "elapsed_seconds": time.perf_counter() - started,
                    "complete_inner_search_repeated": 16,
                    "training_stages_repeated": 129,
                    "probability_tolerance": 1e-10,
                },
            )
            return
        if (OUTPUT / "results.json").exists():
            raise ValueError("Study already completed; STOP")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        all_folds = []
        for focus in VESSELS:
            for r, outer in enumerate(folds[focus]["repeats"]):
                for f, fold in enumerate(outer):
                    path = OUTPUT / "folds" / f"{focus}-r{r}-f{f}.json"
                    if path.exists():
                        payload = read_json(path)
                        if payload["protocol_sha256"] != object_digest(protocol):
                            raise ValueError("Resume seal differs")
                    else:
                        payload = evaluate_fold(
                            data, manifest, protocol, fold, focus, r, f, previous
                        )
                        write_json_once(path, payload)
                    all_folds.append(payload)
                    print(
                        json.dumps(
                            {
                                "focus": focus,
                                "repeat": r,
                                "fold": f,
                                "eligible": payload["decision"]["eligible"],
                                "candidate": payload["decision"]["candidate"]["id"],
                                "elapsed_seconds": round(time.perf_counter() - started, 1),
                            }
                        ),
                        flush=True,
                    )
        results = {
            "protocol_sha256": object_digest(protocol),
            "completed_at_utc": utc_now(),
            **analyze(all_folds, protocol),
            "outer_evaluations": 50,
            "training_stages": 50 * (16 * 4 * 2 + 1),
            "reference_fits": 100,
            "elapsed_seconds": time.perf_counter() - started,
        }
        results["final_candidate"] = (
            final_if_pass(data, manifest, folds, protocol)
            if results["joint_gate_passed"]
            else {"status": "NOT FITTED: gate failed; STOP"}
        )
        preflight()
        write_json_once(OUTPUT / "results.json", results)
        print("COMPLETED", results["joint_gate_passed"], results["elapsed_seconds"], flush=True)


def compare_reproduction(a, b):
    import numpy as np

    if a["decision_sha256"] != b["decision_sha256"]:
        raise ValueError("Deterministic decision changed")
    for old, new in zip(a["inner_selection"], b["inner_selection"], strict=True):
        if old["epochs"] != new["epochs"]:
            raise ValueError("Stopping epochs changed")
        np.testing.assert_allclose(
            [r["probabilities"] for r in old["oof"]],
            [r["probabilities"] for r in new["oof"]],
            rtol=0,
            atol=1e-10,
        )
    for task in TASKS:
        for name in a["arms"][task]:
            old, new = a["arms"][task][name], b["arms"][task][name]
            if old["status"] != new["status"] or old["metrics"] != new["metrics"]:
                raise ValueError("Outer status/metrics changed")
            np.testing.assert_allclose(
                [r["probability"] for r in old["predictions"]],
                [r["probability"] for r in new["predictions"]],
                rtol=0,
                atol=1e-10,
            )


if __name__ == "__main__":
    main()
