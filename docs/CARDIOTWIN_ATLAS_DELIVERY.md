# CardioTwin Atlas local delivery

7 October 2026. Local and uncommitted. No branch, staging, commit, push, PR,
release, tag or GitHub action was created. `.env` was not changed.

## Existing features preserved

The implementation composes the original Cardio-Hemo engine, diagnostics, FHIR
adapter and evidence components. Coronary CardioTwin APIs/model, oncology,
OncoTwin, AquaHealth, One Health, governed model gateway, review/interop,
authentication, organization boundaries, deployment files and existing routes
remain present. No database migration, environment change, package addition or
new gateway was required. Tests retain the compact navigation contract.

A tracked-file hash comparison against the read-only audit shows only the six
integration files below changed during Atlas work. Other pre-existing tracked
edits were preserved byte for byte. Git HEAD is unchanged and staging is empty.
The worktree was already dirty before Atlas; its other modifications/untracked
Cardio-Hemo, spatial and deployment work are not claimed as Atlas changes.

## New CardioTwin features

- One workspace with synchronized as-of reconstruction across state, graph,
  trajectory, schematic 3D, modalities and spatial context.
- Eight explainable dimensions with OBSERVED/DERIVED/INFERRED/UNKNOWN,
  confidence, source age, uncertainty and mandatory human review.
- Source-linked graph, original-record tracing and transition comparison of
  prior/current confidence plus added/removed/retained support.
- Structured multimodal intake, synthetic ECG preview, image/echo metadata,
  clinical text and conservative patient-reported transcript adapter.
- Quantity-safe longitudinal source charts, actual same-engine modality
  ablation and cardiac/renal/respiratory presentation with association wording.
- Consent-gated offline care/environment map, replay-filtered events,
  straight-line facility distance and UNKNOWN capacity.
- Isolated bounded hypothetical observations, deterministic copilot and
  optional governed verbatim passage ordering with failure fallback.
- Existing portable Passport sealing/FHIR derivation with server-owned
  export identity, retained source metadata and no clinical approval.

## Files modified by Atlas (6)

| File | Additive change |
| --- | --- |
| `backend/app/api/cardiotwin.py` | Include authenticated Atlas router |
| `frontend/src/main.tsx` | Lazy protected Atlas route |
| `frontend/src/components/AppShell.tsx` | Preserve reconstruction across Atlas tab paths |
| `frontend/src/components/SearchPalette.tsx` | Atlas destination |
| `frontend/src/routes/CardioTwin.tsx` | Atlas entry card |
| `frontend/src/workflow/areas.ts` | Clinical Context entry |

These files already contained earlier local edits. The table describes only the
Atlas additions; the complete Git diff also includes their preserved earlier work.

## Files created for Atlas (30 source/test/document files)

```text
backend/app/cardiotwin/atlas/__init__.py
backend/app/cardiotwin/atlas/api.py
backend/app/cardiotwin/atlas/copilot.py
backend/app/cardiotwin/atlas/demo.py
backend/app/cardiotwin/atlas/fusion.py
backend/app/cardiotwin/atlas/graph.py
backend/app/cardiotwin/atlas/schema.py
backend/app/cardiotwin/atlas/service.py
backend/app/cardiotwin/atlas/spatial.py
backend/tests/cardiotwin/test_atlas.py
backend/tests/cardiotwin/test_atlas_copilot.py
frontend/src/cardiotwin/atlas/api.ts
frontend/src/cardiotwin/atlas/atlas.css
frontend/src/cardiotwin/atlas/AtlasHeart3D.tsx
frontend/src/cardiotwin/atlas/AtlasPanels.tsx
frontend/src/cardiotwin/atlas/AtlasTransitionDelta.tsx
frontend/src/cardiotwin/atlas/CardioCopilot.tsx
frontend/src/cardiotwin/atlas/CardioEvidenceGraph.tsx
frontend/src/cardiotwin/atlas/CardioFusion.tsx
frontend/src/cardiotwin/atlas/SpatialTwinMap.tsx
frontend/src/cardiotwin/atlas/TwinSandbox.tsx
frontend/src/cardiotwin/atlas/types.ts
frontend/src/routes/CardioTwinAtlas.tsx
frontend/tests/atlas.test.tsx
frontend/tests/atlas-passport-serialization.test.ts
frontend/tests/atlas-shell.test.tsx
frontend/tests/atlas-spatial-fallback.test.tsx
frontend/tests/atlas-transition-delta.test.tsx
docs/CARDIOTWIN_ATLAS.md
docs/CARDIOTWIN_ATLAS_DELIVERY.md
```

Browser artifacts were created at these local paths:

```text
output/playwright/atlas-command.png
output/playwright/atlas-heart-state.png
output/playwright/atlas-unknown-graph.png
output/playwright/atlas-why-replay.png
output/playwright/atlas-fusion.png
output/playwright/atlas-spatial.png
output/playwright/atlas-sandbox.png
output/playwright/atlas-copilot.png
output/playwright/atlas-mobile-dark.png
output/playwright/atlas-mobile-light.png
output/playwright/atlas-transition-delta.png
output/playwright/atlas-final-command.png
```

Ignored verification-only files: `backend/.cache/atlas-baseline.json`,
`atlas-preview-launch.py`, `atlas-browser-check.js`, `atlas-browser-workspaces.js`,
`atlas-browser-mobile.js`, `atlas-browser-export.js`, `atlas-browser-intake.js`,
`atlas-browser-demo-transcript.js`,
`atlas-local-audit.py`, `atlas-local-audit.json`, `atlas-passport-check.py` and
`atlas-passport-diagnose.py`. The `backend/.cache/atlas-preview/` directory contains
isolated demo runtime logs/SQLite stores/generated signing material and the
verified browser Passport. Generated secrets are ignored and are not included in
this report. Playwright also generated its ignored session snapshots/downloads.
`frontend/dist/` is the generated ignored production build.

## Test results

| Check | Result |
| --- | --- |
| Full offline backend suite | **996 passed**, 108 external/integration/live/Postgres tests deselected |
| Full frontend suite | **200 passed**, 40 files |
| New Atlas tests | **61 backend + 23 frontend** passed |
| Ruff over backend `app` and `tests` | Passed |
| Atlas strict mypy, existing imports silenced | Passed, 9 source files |
| Atlas Python bytecode compilation | Passed |
| Frontend TypeScript and production build | Passed |
| Git diff whitespace check | Passed; existing LF/CRLF notices only |
| Browser replay, WHY/source, graph, map layers, sandbox and offline copilot | Passed |
| Browser FHIR receipt, transcript source retention, and replay before intake | Passed |
| Browser demo transcript preserves waveform previews and synthetic labels | Passed |
| Downloaded historical Passport | UTF-8 hash-chain verification passed; tampering rejected |
| Mobile 390 px, both themes, reduced motion | No document overflow; controls and source views usable |
| Existing independent HTTP exchange demo | 13/13 semantic fields preserved, receiver IDs reassigned, broken Bundle rejected, Passport verified |

Commands used from `backend`:

```powershell
python -m pytest -o addopts= -q -m 'not integration and not live and not postgres'
python -m ruff check app tests
python -m mypy --follow-imports=silent app/cardiotwin/atlas
python -m compileall -q app/cardiotwin/atlas
```

Commands used from `frontend`: `npm run test`, `npm run typecheck`, `npm run build`.
The existing large Three.js/MapLibre chunk warning remains an optimization issue.
The Python multipart import emits an existing dependency deprecation warning.

Running mypy while following imported legacy modules reports 11 existing typing
errors in `app/oncotwin/observability.py`, `app/auth/jwt_helpers.py` and
`app/auth/dependencies.py`. Atlas itself passes the scoped strict check; these
unrelated files were not modified. Live provider/Postgres integration tests were
not run and production clinical-case storage was not exercised by this demo.

## Known limitations

- Research heuristics and confidence describe evidence support; clinical
  diagnosis, physiological prediction, treatment choice and causality are not validated.
- Clinical ECG/image/speech models are UNAVAILABLE. Waveform/local-media previews,
  manual findings and transcripts work; automatic ECG diagnosis, imaging analysis,
  OCR and speech-to-text are not implemented or claimed.
- 3D uses schematic procedural geometry, not patient-specific anatomy or CFD.
  System-of-twins views group existing axes rather than simulate separate organs.
- Wearables are bounded supplied observations, not a live device stream. Steps
  and sleep are source metadata. There is no wearable transition-overlay chart.
- The sandbox reruns existing rules with hypothetical observations, not a
  calibrated forecast, drug-response model or treatment optimizer.
- Spatial data is supplied/synthetic. There is no street basemap, live routing,
  geocoder, care-capacity feed, weather feed or environmental causal model.
- Copilot is constrained intent retrieval. Optional AI only reorders complete
  retrieved passages; a live provider was not used for verification.
- Atlas remains stateless batch reconstruction. It has no durable media/job
  store, continuous ingestion or dedicated reviewer-note/approval persistence.
  Existing governed review/exchange remains the authority; export does not create
  an approved clinical record or exchange job.
- FHIR covers the existing selected application contract, not full official R4
  profile certification. Supplied identity, clocks, provenance and consent remain
  unverified assertions. Free text cannot be certified temporally by these rules.
- Input bounds are 2 MB, 3,000 combined observations and 100 modality sources;
  graph rendering is paginated. Loader progress describes batch stages, not live
  clinical-model jobs.

## Git status

Uncommitted local changes and pre-existing untracked work remain. HEAD unchanged,
index empty, no remote operation performed, `.env` hash unchanged. No removal or
reset of earlier work occurred. The preview is a synthetic research environment,
not a production readiness or clinical certification claim.
