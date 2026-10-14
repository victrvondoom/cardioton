"""Frozen, development-only nested CV. No holdout evaluation or deployment entry point."""

import argparse
import io
import platform
import time
import warnings
from importlib.metadata import version
from pathlib import Path

import joblib
import numpy as np
from sklearn.exceptions import ConvergenceWarning
from threadpoolctl import threadpool_limits

from ml.common import ROOT, digest, object_digest, read_json, utc_now, write_json_once, write_once
from ml.development import validate_folds, verify_locked_inputs
from ml.metrics import aggregate_folds, choose_candidate, curves, score_predictions
from ml.models import build_pipeline, positive_probability, preprocessing_metadata
from ml.splits import DevelopmentData, load_development

FAMILIES = ("dummy", "logistic", "forest")


def preflight(data: DevelopmentData, manifest: dict, search: dict, provenance: dict):
    if data.features.index.tolist() != provenance["development_ids"]:
        raise ValueError("Only the exact locked development membership/order is permitted")
    if not data.targets.index.equals(data.features.index) or list(data.targets) != list(
        manifest["targets"]
    ):
        raise ValueError("Target alignment differs")
    if search["phase"] != "DEVELOPMENT_ONLY" or search["threshold"] != 0.5:
        raise ValueError("Development protocol differs")
    if (search["outer_folds"], search["inner_folds"]) != (5, 3):
        raise ValueError("Only existing five/three folds are permitted")
    candidates = search["candidates"]
    if set(c["family"] for c in candidates) != set(FAMILIES):
        raise ValueError("Only dummy/logistic/shallow forest families are approved")
    if len({c["id"] for c in candidates}) != len(candidates):
        raise ValueError("Duplicate candidate IDs")
    validate_folds(data.features.index, data.groups, data.nested_cv, list(data.targets))
    for target, outer in data.nested_cv.items():
        for fold in outer:
            for partition in [fold, *fold["inner"]]:
                for key in ["train_ids", "validation_ids"]:
                    if set(data.targets.loc[partition[key], target]) != {0, 1}:
                        raise ValueError(f"Existing fold lacks both classes: {target}/{key}")
    for candidate in candidates:
        # Check schema before any estimator fit, including forbidden aliases/target-derived fields.
        build_pipeline(candidate, manifest, provenance["schema_sha256"], search).named_steps[
            "schema"
        ].validate(data.features)


def fit_partition(data, target, candidate, train_ids, validation_ids, manifest, search, schema_sha):
    pipeline = build_pipeline(candidate, manifest, schema_sha, search)
    with warnings.catch_warnings():
        warnings.simplefilter("error", ConvergenceWarning)
        pipeline.fit(data.features.loc[train_ids], data.targets.loc[train_ids, target])
    if pipeline.named_steps["schema"].fit_row_ids_ != train_ids:
        raise ValueError("Fitted row ledger differs from the existing training fold")
    probability = positive_probability(pipeline, data.features.loc[validation_ids])
    return (
        pipeline,
        probability,
        score_predictions(data.targets.loc[validation_ids, target], probability),
    )


def summarize_candidate(candidate, metrics):
    return {
        "candidate": candidate,
        "mean_inner_roc_auc": float(np.mean([m["roc_auc"] for m in metrics])),
        "mean_inner_brier_score": float(np.mean([m["brier_score"] for m in metrics])),
        "inner_fold_count": len(metrics),
    }


def benchmark_prediction(pipeline, features, repetitions=100):
    profile = features.iloc[:1]
    positive_probability(pipeline, profile)  # Warmup, development profile only.
    single, batch = [], []
    for _ in range(repetitions):
        start = time.perf_counter()
        positive_probability(pipeline, profile)
        single.append((time.perf_counter() - start) * 1000)
    for _ in range(10):
        start = time.perf_counter()
        positive_probability(pipeline, features)
        batch.append((time.perf_counter() - start) * 1000)
    return {
        "profile_source": "first locked development record; no holdout inputs",
        "single_profile_repetitions": repetitions,
        "single_median_ms": float(np.median(single)),
        "single_p95_ms": float(np.percentile(single, 95)),
        "batch_records": len(features),
        "batch_repetitions": 10,
        "batch_median_ms": float(np.median(batch)),
    }


def compare_development(data, manifest, search, provenance, progress=None):
    """Pure inputs are already restricted by load_development; no dataset path is accepted."""
    preflight(data, manifest, search, provenance)
    results = {
        "phase": "DEVELOPMENT_ONLY",
        "holdout_evaluated": False,
        "provenance": provenance,
        "search": search,
        "targets": {},
    }
    models, timings = {}, {}
    with threadpool_limits(limits=1):
        for target in data.targets:
            start_target = time.perf_counter()
            if progress:
                progress(f"{target}: development-only comparison starting")
            all_inner = {c["id"]: [] for c in search["candidates"]}
            outer_results = []
            oof = {family: {} for family in (*FAMILIES, "selection_procedure")}
            for number, fold in enumerate(data.nested_cv[target]):
                summaries, inner_results = [], []
                for candidate in search["candidates"]:
                    candidate_metrics = []
                    for inner_number, inner in enumerate(fold["inner"]):
                        pipeline, _, metrics = fit_partition(
                            data,
                            target,
                            candidate,
                            inner["train_ids"],
                            inner["validation_ids"],
                            manifest,
                            search,
                            provenance["schema_sha256"],
                        )
                        candidate_metrics.append(metrics)
                        inner_results.append(
                            {
                                "inner_fold": inner_number,
                                "candidate_id": candidate["id"],
                                "train_ids_sha256": object_digest(inner["train_ids"]),
                                "validation_ids_sha256": object_digest(inner["validation_ids"]),
                                "train_class_counts": {
                                    str(k): int(v)
                                    for k, v in data.targets.loc[inner["train_ids"], target]
                                    .value_counts()
                                    .sort_index()
                                    .items()
                                },
                                "metrics": metrics,
                                "preprocessing": preprocessing_metadata(pipeline),
                            }
                        )
                    summaries.append(summarize_candidate(candidate, candidate_metrics))
                    all_inner[candidate["id"]].extend(candidate_metrics)
                # Selection occurs BEFORE this outer validation partition is scored.
                winners = {
                    family: choose_candidate(
                        [row for row in summaries if row["candidate"]["family"] == family], search
                    )["candidate"]
                    for family in FAMILIES
                }
                selected = choose_candidate(summaries, search)["candidate"]
                outer_metrics = {}
                for family, candidate in winners.items():
                    pipeline, probability, metrics = fit_partition(
                        data,
                        target,
                        candidate,
                        fold["train_ids"],
                        fold["validation_ids"],
                        manifest,
                        search,
                        provenance["schema_sha256"],
                    )
                    predictions = dict(
                        zip(fold["validation_ids"], probability.tolist(), strict=True)
                    )
                    oof[family].update(predictions)
                    outer_metrics[family] = {
                        "candidate": candidate,
                        "metrics": metrics,
                        "preprocessing": preprocessing_metadata(pipeline),
                    }
                    if candidate["id"] == selected["id"]:
                        oof["selection_procedure"].update(predictions)
                        outer_metrics["selection_procedure"] = outer_metrics[family]
                outer_results.append(
                    {
                        "outer_fold": number,
                        "train_ids": fold["train_ids"],
                        "validation_ids": fold["validation_ids"],
                        "inner_results": inner_results,
                        "inner_summaries": summaries,
                        "selected": selected,
                        "outer_results": outer_metrics,
                    }
                )
                if progress:
                    progress(
                        f"{target}: outer fold {number + 1}/5 complete; "
                        f"inner-selected {selected['id']}"
                    )
            final_summaries = [
                summarize_candidate(c, all_inner[c["id"]]) for c in search["candidates"]
            ]
            selected = choose_candidate(final_summaries, search)["candidate"]
            ids = data.features.index.tolist()
            aggregate = {}
            for family, predictions in oof.items():
                if set(predictions) != set(ids) or len(predictions) != len(ids):
                    raise ValueError("Outer predictions do not exactly cover development records")
                probabilities = [predictions[i] for i in ids]
                aggregate[family] = {
                    "fold_metrics": aggregate_folds(
                        [fold["outer_results"][family]["metrics"] for fold in outer_results]
                    ),
                    "pooled_oof_metrics": score_predictions(data.targets[target], probabilities),
                    "pooled_oof_curves": curves(data.targets[target], probabilities),
                    "oof_predictions": [
                        {
                            "row_id": i,
                            "positive_probability": p,
                            "label": int(data.targets.loc[i, target]),
                        }
                        for i, p in zip(ids, probabilities, strict=True)
                    ],
                }
            cv_seconds = time.perf_counter() - start_target
            fit_start = time.perf_counter()
            pipeline = build_pipeline(selected, manifest, provenance["schema_sha256"], search)
            with warnings.catch_warnings():
                warnings.simplefilter("error", ConvergenceWarning)
                pipeline.fit(data.features, data.targets[target])
            if pipeline.named_steps["schema"].fit_row_ids_ != ids:
                raise ValueError("Final fit escaped locked development membership")
            # These all-development predictions are ONLY serialization checks, never CV results.
            fit_seconds = time.perf_counter() - fit_start
            metadata = preprocessing_metadata(pipeline)
            results["targets"][target] = {
                "class_counts": {
                    str(k): int(v)
                    for k, v in data.targets[target].value_counts().sort_index().items()
                },
                "encoding": manifest["targets"][target],
                "outer_folds": outer_results,
                "aggregate": aggregate,
                "final_inner_summaries": final_summaries,
                "selected_configuration": {
                    "candidate": selected,
                    "estimator_parameters": pipeline.named_steps["classifier"].get_params(),
                    "preprocessing": metadata,
                    "primary_metric": search["selection"]["primary"],
                    "tie_breakers": search["selection"]["tie_breakers"],
                    "reason": (
                        "Highest mean ROC-AUC over the 15 existing inner validations; "
                        "Brier and predefined simplicity resolve ties. "
                        "No outer-test outcome enters selection."
                    ),
                    "outer_fold_metrics_for_family_selection_procedure": aggregate[
                        selected["family"]
                    ]["fold_metrics"],
                    "evaluation_scope": (
                        "Outer scores estimate inner selection procedures, "
                        "not an independent test of this all-development frozen fit."
                    ),
                    "threshold": 0.5,
                    "calibrated": False,
                },
            }
            models[target] = pipeline
            timings[target] = {
                "nested_cv_seconds": cv_seconds,
                "selected_fit_seconds": fit_seconds,
                "prediction": benchmark_prediction(pipeline, data.features),
            }
    return results, models, timings


def run_provenance(root, search):
    split = read_json(root / "artifacts/data/split.json")
    paths = [
        "artifacts/data/feature_manifest.json",
        "artifacts/data/split.json",
        "config/development_access.json",
        "config/model_search_v1.json",
        "uv.lock",
        "ml/train.py",
        "ml/models.py",
        "ml/metrics.py",
        "ml/development.py",
        "ml/data.py",
        "ml/splits.py",
        "ml/common.py",
        "ml/plots.py",
    ]
    files = {name: digest((root / name).read_bytes()) for name in paths}
    if search["access_lock_file_sha256"] != files["config/development_access.json"]:
        raise ValueError("Predeclared source access lock changed")
    return {
        "schema_sha256": files["artifacts/data/feature_manifest.json"],
        "split_sha256": files["artifacts/data/split.json"],
        "development_ids": split["development_ids"],
        "development_ids_sha256": object_digest(split["development_ids"]),
        "development_records": len(split["development_ids"]),
        "files_sha256": files,
        "seed": search["seed"],
        "libraries": {
            name: version(name)
            for name in [
                "scikit-learn",
                "numpy",
                "pandas",
                "scipy",
                "joblib",
                "matplotlib",
                "threadpoolctl",
            ]
        },
        "python": platform.python_version(),
        "threads": "BLAS/OpenMP=1, random forest n_jobs=1",
    }


def assert_reproduced(expected, actual, path="results"):
    """Ignore no metrics: exact choices/IDs and tightly bounded numeric reproducibility."""
    if isinstance(expected, dict):
        if set(expected) != set(actual):
            raise ValueError(f"Reproduction keys differ: {path}")
        for key in expected:
            assert_reproduced(expected[key], actual[key], f"{path}.{key}")
    elif isinstance(expected, list):
        if not isinstance(actual, list) or len(expected) != len(actual):
            raise ValueError(f"Reproduction shape differs: {path}")
        for i, (a, b) in enumerate(zip(expected, actual, strict=True)):
            assert_reproduced(a, b, f"{path}[{i}]")
    elif isinstance(expected, float):
        if not np.isclose(expected, actual, atol=1e-12, rtol=1e-10):
            raise ValueError(f"Reproduction metric differs: {path}")
    elif expected != actual:
        raise ValueError(f"Reproduction value differs: {path}")


def save_run(out, results, models, timings, data, reproduce=False):
    config_sha = object_digest(results["provenance"])
    payload = {**results, "training_configuration_sha256": config_sha}
    path = out / "results.json"
    if reproduce:
        if not path.exists():
            raise ValueError("No existing run to reproduce")
        assert_reproduced(read_json(path), payload)
    else:
        write_json_once(path, payload)
        write_json_once(out / "search.json", results["search"])
        write_json_once(
            out / "provenance.json",
            {**results["provenance"], "training_configuration_sha256": config_sha},
        )
        write_json_once(
            out / "selected_configurations.json",
            {target: row["selected_configuration"] for target, row in results["targets"].items()},
        )
    for target, pipeline in models.items():
        model_path = out / "models" / f"{target}.joblib"
        if not reproduce:
            buffer = io.BytesIO()
            joblib.dump(pipeline, buffer, compress=3)
            write_once(model_path, buffer.getvalue())
            write_json_once(
                model_path.with_suffix(".json"),
                {
                    "phase": "DEVELOPMENT_ONLY",
                    "holdout_evaluated": False,
                    "deployed": False,
                    "model_sha256": digest(model_path.read_bytes()),
                    "target": target,
                    "schema_sha256": results["provenance"]["schema_sha256"],
                    "split_sha256": results["provenance"]["split_sha256"],
                    "training_configuration_sha256": config_sha,
                    "selected_configuration": results["targets"][target]["selected_configuration"],
                },
            )
        metadata = read_json(model_path.with_suffix(".json"))
        if (
            metadata["schema_sha256"] != results["provenance"]["schema_sha256"]
            or metadata["training_configuration_sha256"] != config_sha
            or digest(model_path.read_bytes()) != metadata["model_sha256"]
        ):
            raise ValueError("Saved development model fingerprint differs")
        # Trusted local artifacts only. Full-development reload check, never holdout predictions.
        restored = joblib.load(model_path)
        np.testing.assert_allclose(
            positive_probability(restored, data.features),
            positive_probability(pipeline, data.features),
            rtol=1e-10,
            atol=1e-12,
        )
    measurement = {
        "phase": "DEVELOPMENT_ONLY",
        "utc": utc_now(),
        "training_configuration_sha256": config_sha,
        "reproduction": reproduce,
        "platform": platform.platform(),
        "processor": platform.processor(),
        "targets": timings,
        "total_nested_cv_seconds": sum(t["nested_cv_seconds"] for t in timings.values()),
    }
    write_json_once(out / "timings" / (measurement["utc"].replace(":", "-") + ".json"), measurement)
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument(
        "--reproduce",
        action="store_true",
        help="Re-run the same frozen search and compare all results; never alter outputs",
    )
    args = parser.parse_args()
    verify_locked_inputs(args.root, anatomy=True)
    search = read_json(args.root / "config/model_search_v1.json")
    provenance = run_provenance(args.root, search)
    data = load_development(args.root)
    manifest = read_json(args.root / "artifacts/data/feature_manifest.json")
    out = args.root / "artifacts/development" / ("v1-" + object_digest(provenance)[:12])
    results, models, timings = compare_development(
        data, manifest, search, provenance, progress=lambda message: print(message, flush=True)
    )
    payload = save_run(out, results, models, timings, data, reproduce=args.reproduce)
    if not args.reproduce:
        from ml.plots import save_figures

        save_figures(out, payload)
    verify_locked_inputs(args.root, anatomy=True)
    print(f"{'Reproduced' if args.reproduce else 'Saved'} DEVELOPMENT ONLY: {out}", flush=True)
    print("Holdout targets were not decoded or evaluated; no deployment/prediction integration.")


if __name__ == "__main__":
    main()
