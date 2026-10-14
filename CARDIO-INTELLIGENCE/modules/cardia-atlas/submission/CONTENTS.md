# Cardia Atlas Submission Package

This package contains the browser application and API source, trained model pipelines, UCI source data and attribution, nested cross-validation results, report and editable report source, timed demo script, requirements checklist, verification record, and Render Blueprint matching the verified public deployment. The included model bundle supports inference without retraining.

## Start locally

See `cardia_atlas__README.md`. The supported command is `./scripts/run_local.sh`; then open http://127.0.0.1:8000.

## Primary deliverables

- `reports/cardia_atlas_report.pdf` (at most 6 pages; checked against the attached brief)
- `reports/report_source.md` and `scripts/build_report.py` (editable report content and reproducible PDF builder)
- `artifacts/cardia_models.joblib` (four fitted pipelines and metadata)
- `artifacts/*_pipeline.joblib` (the four individual fitted preprocessing + estimator pipelines)
- `artifacts/features.json`, `artifacts/ui_schema.json`, `artifacts/evaluation.json`, `artifacts/evaluation.csv`, and `artifacts/data_audit.json` (feature, UI, evaluation, and data audit artifacts)
- `requirements.txt`, `package.json`, `package-lock.json`, and `scripts/run_local.sh` (pinned setup and start files)
- `data/source.csv`, `data/raw/` (source data copies; license and hash noted in attribution)
- `cardia_atlas__demo_script.md` (timed 5-minute demonstration)
- `docs/cardia_atlas__docs__submission_checklist.md` and `docs/cardia_atlas__docs__verification.md`
- `docs/cardia_atlas__docs__third_party_notices.md` (dataset, library, reference, and AI-use attribution)
- `render.yaml` and `Dockerfile` (the hosted container build is verified; local Docker build was not run)

## Before submission

Record a 3–10 minute YouTube demo, add the public video link to Devpost, disclose OpenAI Codex in Built With, check the current entry form for any upload constraints, and submit before the listed deadline. This package has not been uploaded or submitted.
