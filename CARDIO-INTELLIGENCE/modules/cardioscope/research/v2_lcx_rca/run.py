"""Sequential bounded experiment; only development data enters any fit/metric."""

import argparse
import copy
import json
import time

import joblib
import numpy as np
from threadpoolctl import threadpool_limits

from ml.common import ROOT, digest, object_digest, read_json, utc_now, write_json_once, write_once
from ml.models import positive_probability, preprocessing_metadata
from research.v2_lcx_rca.core import (
    ARMS,
    TARGETS,
    FitLedger,
    arm_choices,
    data_identity,
    development_boundary,
    inner_select,
    load_data,
    metrics,
    runtime_versions,
    success_gate,
    summarize,
    validate_folds,
)
from research.v2_lcx_rca.preregister import HERE, OUTPUT
from scripts.verify_immutable import verify


def preflight():
    verify()
    p = read_json(HERE / "protocol.json")
    if object_digest(p) != (HERE / "protocol.sha256").read_text().strip():
        raise ValueError("Preregistered protocol changed")
    if digest((HERE / "requirements.lock.txt").read_bytes()) != p["requirements_lock_sha256"]:
        raise ValueError("Experimental dependency lock changed")
    for name, sha in p["source_code_sha256"].items():
        if digest((ROOT / name).read_bytes()) != sha:
            raise ValueError("Preregistered implementation changed: " + name)
    if runtime_versions() != p["runtime"]:
        raise ValueError("Experimental runtime differs")
    data, manifest = load_data()
    if any(p[key] != val for key, val in data_identity(data).items()):
        raise ValueError("Development membership/data changed")
    if object_digest(manifest) != p["schema_sha256"]:
        raise ValueError("Schema changed")
    folds = read_json(HERE / "folds.json")
    if object_digest(folds) != p["experimental_folds_sha256"]:
        raise ValueError("Experimental folds changed")
    validate_folds(data, folds)
    return p, data, manifest, folds


def evaluate_fold(data, target, fold, repeat, number, manifest, protocol):
    train, validation = fold["train_ids"], fold["validation_ids"]
    ledger = FitLedger()
    ref = protocol["references"][target]
    candidates = [ref, *protocol["candidates"]]
    # The selector's complete API contains only training rows/outcomes.
    rows = inner_select(
        data.features.loc[train],
        data.targets.loc[train, target],
        data.groups.loc[train],
        fold["inner"],
        candidates,
        manifest,
        protocol,
        ledger,
        f"{target}/repeat-{repeat}/outer-{number}",
    )
    choices = arm_choices(rows, ref["id"])
    decision_sha256 = object_digest(choices)  # All rules fixed BEFORE any outer outcome retrieval.
    predictions = {}
    result = {}
    for arm, choice in choices.items():
        common = {"repeat": repeat, "fold": number, "arm": arm, "choice": choice}
        if choice is None:
            result[arm] = {**common, "status": "ineligible", "metrics": None, "predictions": []}
            continue
        candidate = choice["candidate"]
        if candidate["id"] not in predictions:
            fitted = ledger.fit(
                candidate,
                data.features.loc[train],
                data.targets.loc[train, target],
                manifest,
                protocol,
                set(train),
                f"{target}/repeat-{repeat}/outer-{number}/refit",
            )
            predictions[candidate["id"]] = positive_probability(
                fitted, data.features.loc[validation]
            )
        probability = predictions[candidate["id"]]
        positive = data.targets.loc[validation, target].to_numpy()
        predicted = probability >= choice["threshold"]
        result[arm] = {
            **common,
            "status": "evaluated",
            "metrics": metrics(positive, probability, predicted),
            "predictions": [
                {
                    "row_id": i,
                    "positive": int(y),
                    "probability": float(p),
                    "predicted_positive": int(v),
                }
                for i, y, p, v in zip(validation, positive, probability, predicted, strict=True)
            ],
        }
    if object_digest(choices) != decision_sha256:
        raise ValueError("Outer evaluation mutated the already-frozen rules")
    return {
        "protocol_sha256": object_digest(protocol),
        "decision_sha256": decision_sha256,
        "inner_selection": rows,
        "arms": result,
        "fits": ledger.entries,
    }


def fit_final(data, target, folds, manifest, protocol, reproduce=False):
    ledger = FitLedger()
    rows = inner_select(
        data.features,
        data.targets[target],
        data.groups,
        folds["full_development_inner"],
        [protocol["references"][target], *protocol["candidates"]],
        manifest,
        protocol,
        ledger,
        target + "/full-development",
    )
    choice = arm_choices(rows, protocol["references"][target]["id"])["selection_procedure"]
    payload = {
        "target": target,
        "status": "v2-candidate INTERNAL DEVELOPMENT ONLY",
        "protocol_sha256": object_digest(protocol),
        "choice": choice,
        "inner_selection": rows,
        "deployment": False,
        "holdout_evaluation": False,
    }
    if choice is None:
        return {**payload, "status": "ineligible; no candidate persisted", "fits": ledger.entries}
    fitted = ledger.fit(
        choice["candidate"],
        data.features,
        data.targets[target],
        manifest,
        protocol,
        set(data.features.index),
        target + "/full-development/refit",
    )
    info = preprocessing_metadata(fitted)
    if (
        info["fit_record_count"] != 242
        or info["fit_row_ids_sha256"] != protocol["membership_sha256"]
    ):
        raise ValueError("Final candidate not fitted on exact 242 development records")
    reference_p = positive_probability(fitted, data.features)
    times = []
    for _ in range(20):
        started = time.perf_counter()
        positive_probability(fitted, data.features.iloc[:1])
        times.append((time.perf_counter() - started) * 1000)
    if not reproduce:
        path = OUTPUT / "v2-candidate" / f"{target}.joblib"
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            raise ValueError("Do not overwrite a candidate model")
        joblib.dump(fitted, path)
    return {
        **payload,
        "preprocessing": info,
        "fits": ledger.entries,
        "development_check_probabilities": reference_p.tolist(),
        "single_profile_latency_median_ms": float(np.median(times)),
    }


def bootstrap(data, target, arm_rows, protocol):
    if any(r["status"] != "evaluated" for r in arm_rows):
        return {"status": "unavailable: incomplete operating rules"}
    ids = data.features.index.tolist()
    groups = data.groups.loc[ids]
    units = sorted(groups.unique())
    indices = {g: np.flatnonzero(groups.to_numpy() == g) for g in units}
    maps = [
        {p["row_id"]: p for r in arm_rows if r["repeat"] == repeat for p in r["predictions"]}
        for repeat in range(5)
    ]
    arrays = [
        (
            np.array([m[i]["probability"] for i in ids]),
            np.array([m[i]["predicted_positive"] for i in ids]),
        )
        for m in maps
    ]
    y = data.targets.loc[ids, target].to_numpy()
    rng = np.random.default_rng(protocol["uncertainty"]["seed"])
    names = [
        "sensitivity",
        "specificity",
        "balanced_accuracy",
        "precision",
        "roc_auc",
        "pr_auc",
        "average_precision",
        "predicted_positive_rate",
    ]
    estimates = {k: [] for k in names}
    for _ in range(protocol["uncertainty"]["bootstrap_samples"]):
        sampled = np.concatenate([indices[g] for g in rng.choice(units, len(units), replace=True)])
        if set(y[sampled]) != {0, 1}:
            raise ValueError("Bootstrap sample lacks a class; no silent sample replacement")
        mm = [metrics(y[sampled], p[sampled], v[sampled]) for p, v in arrays]
        for k in names:
            estimates[k].append(float(np.mean([m[k] for m in mm])))
    return {
        "status": "conditional patient/group bootstrap, not independent validation",
        "samples": protocol["uncertainty"]["bootstrap_samples"],
        "percentile_95": {k: np.quantile(v, [0.025, 0.975]).tolist() for k, v in estimates.items()},
    }


def remove_timing(value):
    if isinstance(value, dict):
        return {
            k: remove_timing(v)
            for k, v in value.items()
            if k
            not in {
                "fit_seconds",
                "single_profile_latency_median_ms",
                "elapsed_seconds",
                "started_at_utc",
            }
        }
    if isinstance(value, list):
        return [remove_timing(v) for v in value]
    return value


def assert_reproduced(before, after, protocol):
    a, b = remove_timing(before), remove_timing(after)

    def compare(x, y, path="result"):
        if isinstance(x, dict):
            if not isinstance(y, dict) or x.keys() != y.keys():
                raise ValueError("Reproduction keys differ: " + path)
            for k in x:
                compare(x[k], y[k], path + "/" + k)
        elif isinstance(x, list):
            if not isinstance(y, list) or len(x) != len(y):
                raise ValueError("Reproduction length differs: " + path)
            for i, (u, v) in enumerate(zip(x, y, strict=True)):
                compare(u, v, path + "/" + str(i))
        elif isinstance(x, float):
            if not np.isclose(
                x,
                y,
                atol=protocol["reproduction"]["probability_atol"],
                rtol=protocol["reproduction"]["probability_rtol"],
            ):
                raise ValueError("Reproduction number differs: " + path)
        elif x != y:
            raise ValueError("Reproduction identity/selection differs: " + path)

    compare(a, b)


def run(reproduce=False):
    protocol, data, manifest, folds = preflight()
    started = time.perf_counter()
    payload = {
        "protocol_sha256": object_digest(protocol),
        "started_at_utc": utc_now(),
        "status": "POST_HOLDOUT_INTERNAL_DEVELOPMENT_ONLY",
        "targets": {},
    }
    all_fits = []
    if reproduce:
        for name, sha in read_json(OUTPUT / "checksums.json").items():
            if digest((OUTPUT / name).read_bytes()) != sha:
                raise ValueError("Saved experiment artifact changed: " + name)
    with development_boundary(), threadpool_limits(limits=1):
        for target in TARGETS:
            outer_results = []
            for repeat, outer in enumerate(folds[target]["repeats"]):
                for number, fold in enumerate(outer):
                    path = OUTPUT / "outer" / f"{target}-repeat{repeat}-fold{number}.json"
                    if path.exists() and not reproduce:
                        if (
                            digest(path.read_bytes())
                            != path.with_suffix(".sha256").read_text().strip()
                        ):
                            raise ValueError("Cached fold changed")
                        result = read_json(path)
                        if result["protocol_sha256"] != object_digest(protocol):
                            raise ValueError("Cached result refers to another protocol")
                    else:
                        result = evaluate_fold(
                            data, target, fold, repeat, number, manifest, protocol
                        )
                        if reproduce:
                            assert_reproduced(read_json(path), result, protocol)
                        else:
                            write_json_once(path, result)
                            write_once(
                                path.with_suffix(".sha256"),
                                (digest(path.read_bytes()) + "\n").encode(),
                            )
                    outer_results.append(result)
                    all_fits.extend(result["fits"])
                    print(
                        json.dumps(
                            {
                                "target": target,
                                "repeat": repeat + 1,
                                "fold": number + 1,
                                "completed_outer_evaluations": len(outer_results),
                                "fits_so_far": len(all_fits),
                                "reproduction": reproduce,
                            }
                        ),
                        flush=True,
                    )
            arms = {arm: [r["arms"][arm] for r in outer_results] for arm in ARMS}
            summaries = {arm: summarize(rows) for arm, rows in arms.items()}
            final_path = OUTPUT / "v2-candidate" / f"{target}.json"
            if final_path.exists() and not reproduce:
                if (
                    digest(final_path.read_bytes())
                    != final_path.with_suffix(".sha256").read_text().strip()
                ):
                    raise ValueError("Cached full-development candidate changed")
                final = read_json(final_path)
            else:
                final = fit_final(data, target, folds[target], manifest, protocol, reproduce)
                if reproduce:
                    assert_reproduced(read_json(final_path), final, protocol)
                    if final["choice"] is not None:
                        saved = joblib.load(final_path.with_suffix(".joblib"))
                        np.testing.assert_allclose(
                            positive_probability(saved, data.features),
                            final["development_check_probabilities"],
                            atol=protocol["reproduction"]["probability_atol"],
                            rtol=protocol["reproduction"]["probability_rtol"],
                        )
                else:
                    write_json_once(final_path, final)
                    write_once(
                        final_path.with_suffix(".sha256"),
                        (digest(final_path.read_bytes()) + "\n").encode(),
                    )
            all_fits.extend(final["fits"])
            payload["targets"][target] = {
                "outer_folds": outer_results,
                "summaries": summaries,
                "gate": success_gate(
                    summaries["selection_procedure"],
                    summaries["v1_rf_0.5"],
                    protocol["success_gate"],
                ),
                "threshold_only_gate": success_gate(
                    summaries["v1_rf_nested_threshold"],
                    summaries["v1_rf_0.5"],
                    protocol["success_gate"],
                ),
                "conditional_uncertainty": bootstrap(
                    data, target, arms["selection_procedure"], protocol
                ),
                "final_candidate": final,
            }
    payload["joint_success"] = all(t["gate"]["passed"] for t in payload["targets"].values())
    payload["elapsed_seconds"] = time.perf_counter() - started
    payload["fit_count"] = len(all_fits)
    payload["per_family_fit_runtime"] = {
        family: {
            "fit_count": len(ff := [r for r in all_fits if r["family"] == family]),
            "fit_seconds": sum(r["fit_seconds"] for r in ff),
        }
        for family in ["reference", "elastic_net", "forest", "xgboost"]
    }
    verify()
    if reproduce:
        original = read_json(OUTPUT / "results.json")
        # Wall-clock family totals are descriptive, not reproducible scientific outputs.
        a, b = copy.deepcopy(original), copy.deepcopy(payload)
        for p in [a, b]:
            for stats in p["per_family_fit_runtime"].values():
                stats.pop("fit_seconds")
        assert_reproduced(a, b, protocol)
        write_json_once(
            OUTPUT / "reproduction.json",
            {
                "protocol_sha256": object_digest(protocol),
                "repeated_complete_experiment": True,
                "same_selections_thresholds_metrics_oof_and_final_predictions": True,
                "fit_count": payload["fit_count"],
                "elapsed_seconds": payload["elapsed_seconds"],
                "holdout_use": False,
                "protected_files_byte_identical": True,
            },
        )
    else:
        write_json_once(OUTPUT / "results.json", payload)
        files = [p for p in OUTPUT.rglob("*") if p.is_file()]
        write_json_once(
            OUTPUT / "checksums.json",
            {str(p.relative_to(OUTPUT)): digest(p.read_bytes()) for p in sorted(files)},
        )
    print(
        json.dumps(
            {
                "completed": True,
                "fit_count": len(all_fits),
                "elapsed_seconds": payload["elapsed_seconds"],
                "reproduction": reproduce,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reproduce", action="store_true")
    args = parser.parse_args()
    run(args.reproduce)
