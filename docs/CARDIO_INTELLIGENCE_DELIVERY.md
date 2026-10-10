# CardioTwin cardiovascular intelligence delivery

Local implementation and verification: **9 October 2026**. Open `/cardiotwin/intelligence` from the existing coronary, Cardio-Hemo or Atlas workspace. This is a functioning research/support extension with reviewed report annotations, authentic ambient environmental models and historical evidence boundaries. It is not a clinically validated patient reconstruction or production compliance release.

## 1. Existing systems reused

The existing React/TypeScript/Vite application, React Three Fiber/Drei/Three.js renderer, MapLibre stack, HRA heart asset, authenticated FastAPI namespace, pinned backend environment, database pool and generic Evidence Passport utilities are reused. Existing coronary inference/scenarios/sensitivity/evaluation, Cardio-Hemo eight-axis reconstruction/WHY/FHIR/replay, Atlas, OAH exchange, AquaHealth, One Health and oncology remain operational in their existing routes. `/cardiotwin/hemo` is preserved. See the [inspection-first architecture audit](CARDIO_INTELLIGENCE_AUDIT.md).

The checkout already had extensive uncommitted work. This implementation stays local and uncommitted; no push, secret change or environment-file edit was made. `HEAD` remains `c2559a8`, and staging is empty.

## 2. Implemented experience

* **Reference anatomy:** 16 selectable structures, detailed HRA chamber/valve/septal surfaces, labeled illustrative coronary/great-vessel overlays, differentiated PBR tissues, procedural microtexture, adjustable lighting/opacity, orbit/pan/zoom, focus, isolate and uncapped section clipping. Optional illustrative motion is off by default. Keyboard structure controls, text view, loading/error handling and context-loss fallback preserve access to evidence.
* **Reviewed clinical evidence:** prominent upload action in the coronary dashboard and beside the viewer; bounded text-layer PDF/text/FHIR upload, deterministic extraction, source excerpts, normalized measurements, proposed mappings, correction, approval, rejection, versioned decisions, audit, deletion and existing Passport export. Pending/unsupported findings cannot create approved anatomical highlights.
* **Traceability:** structure selection opens the same finding/source/date/reviewer/mapping/Passport panel whether selected through the mesh anchor or keyboard controls. Reported `70%` stenosis associates with the named vessel without generating lesion geometry. LVEF associates with LV functional context without controlling patient motion. AF associates with both atria. General disease retains an unresolved evidence card.
* **Existing coronary model connection:** opening Intelligence from a completed CardioTwin prediction transfers only three vessel probabilities and model provenance. The coronary explorer lets those controls select reference vessel regions. This independent model session is visibly distinct from uploaded report findings and is excluded before its generation time; it does not become an approved diagnosis or a patient-case linkage. Existing model explanations and sensitivity remain in CardioTwin.
* **Cardio-Hemo replay:** explicitly enabled fictional observations reuse the existing deterministic eight-axis engine, classification, confidence, WHY and original-record inspection. Shared end-of-day UTC replay filters event, availability and reviewer decisions; it clears old annotations while requests change. Current uploads cannot appear in August replay. Compare renders two dated reference views with synchronized structure selection and independently inspectable cameras.
* **Environmental exploration:** MapLibre globe, city/country search, manual coordinates, location selection, date/hour controls, seven modeled/forecast variables, two-location comparison, hourly plots/tables, provenance/freshness/gaps and a sparse nine-point regional pollutant heatmap. Provider failure does not synthesize missing values. Text mode retains geographic controls and observations.
* **Evidence alignment:** a consented temporary local view places report occurrence, receipt and review plus loaded Cardio-Hemo source-observation clocks beside the selected date's ambient profile. A bounded scrollable table preserves observation values, classifications, source references and separate availability dates. Personal exposure and reviewed causation remain explicitly unestablished. It does not calculate an individual cardiovascular risk score or persist a location history.
* **Visual system:** scoped graphite/navy instrumentation surfaces, teal selection, amber approved evidence, refined borders, structured source panels, accessible labels and responsive layout. Reused hemodynamic cards retain their behavior with readable scoped styling.

The unified workspace automatically loads the existing hemodynamic engine only for its explicitly labeled fictional patient. Arbitrary real-patient hemodynamic inputs/FHIR remain supported in the preserved Cardio-Hemo route; the new report adapter does not automatically turn every report into a full longitudinal hemodynamic dataset.

## 3. Files and modules

| Area | New files / modules |
|---|---|
| Backend clinical | `app/api/cardio_anatomy.py`; `app/cardiotwin/anatomy/{models,validation,extract,mapping,service,repository}.py` and package initializer |
| Backend environmental | `app/api/cardio_environment.py`; `app/cardiotwin/environment/service.py` and initializer |
| Unified frontend | `src/routes/CardioIntelligence.tsx`; `src/cardiotwin/intelligence/{reportApi,ReportReview,SurfaceBoundary,coronaryContext}.tsx/.ts`; `intelligence.css` |
| Reference rendering | `src/cardiotwin/intelligence/{AnatomyViewer.tsx,anatomyTypes.ts,anatomy.css}` |
| Environmental frontend | `src/cardiotwin/intelligence/{EnvironmentWorkspace.tsx,EnvironmentGlobe.tsx,environmentApi.ts,environment.css}` |
| Backend tests | `tests/cardiotwin/test_anatomy_reports.py`, `test_environment.py` |
| Frontend tests | `tests/{anatomy-viewer,anatomy-asset,cardio-intelligence,cardio-environment,cardio-environment-api,cardio-coronary-context}.test.ts/.tsx` |
| Browser journeys | `frontend/e2e/{cardio-intelligence-journeys,cardio-environment-journey,cardio-coronary-model-journey,cardio-renderer-check}.js` |
| Fixtures/docs | `backend/scripts/cardio_intelligence_demo_files.py`; this delivery, architecture audit, report/environment contracts and anatomy documentation |

Paths in the first three rows are relative to `backend/` or `frontend/` as appropriate. Existing integration edits are limited to router registration in `backend/app/main.py`, the additive frontend route in `frontend/src/main.tsx`, and entry links in `CardioTwin.tsx`, `CardioHemoTwin.tsx`, `CardioTwinAtlas.tsx`. The pre-existing case-economics test fixture gained its required `case_id`; the existing stale-case identity guard was retained.

Other dirty files and earlier hemodynamics/Atlas/environment-profile work were already present and are not represented as new changes from this delivery.

## 4. Dependencies and assets

**No new application dependency, renderer or downloaded model was added.** Existing pypdf, multipart handling, reportlab fixture generation, HTTPX, MapLibre, Three.js/R3F/Drei and existing authentication/Passport packages provide the implementation. Playwright CLI was used as external verification tooling through `npx`; it was not added to the application package manifest.

The existing HRA/HuBMAP CC BY 4.0 GLB is 4,071,500 bytes with 164,119 source triangles. Its SHA-256 matches the official original. Attribution, ontology IDs and adaptations are visible and recorded in [reference viewer documentation](CARDIO_ANATOMY_VIEWER.md) and the asset README.

## 5. API additions

No existing API contract was renamed. Two authenticated router groups were added:

| Prefix | Routes |
|---|---|
| `/api/v1/cardiotwin/anatomy` | POST/GET `/reports`; GET/DELETE `/reports/{id}`; POST `/reports/{id}/review`; GET `/reports/{id}/passport` |
| `/api/v1/cardiotwin/environment` | GET `/locations`, `/observations`, `/layer` |

See [clinical contracts/security](CARDIOVASCULAR_REPORTS.md) and [environment contracts/sources](CARDIO_ENVIRONMENT.md) for payloads, authorization, limits and failure behavior.

## 6. Reference illustration versus clinical evidence

HRA surfaces are generic Visible Human reference anatomy, not patient imaging. Coronary and great-vessel paths, fixed wall/lumen layers, procedural tissue texture, clipping and optional heartbeat motion are illustrative adaptations. Cutaway coordinates are generic display units; there is no capped medical section or segmented tissue-layer asset. No report modifies vessel radius, physical obstruction, wall injury or animation contractility.

Patient-derived content consists of source-supported excerpts/measurements and reviewer decisions. These create dated evidence associations and text explanations. Qualitative Cardio-Hemo states remain `OBSERVED`/`DERIVED`/`INFERRED`/`UNKNOWN` context rather than measured flow or pressure. Model probabilities are a separately labeled independent session. Unsupported location remains **Location not established from supplied evidence**.

## 7. Environmental sources and demonstrated coverage

Open-Meteo CAMS supplies four air pollutants; historical ERA5 and recent weather models supply temperature/humidity/apparent temperature; GeoNames-backed geocoding supplies search. Provider source/grid/units/observation and current ingestion timestamps are retained. Original environmental publication availability is unknown, so historical environmental values are not asserted to be knowledge available at a past clinical boundary.

Live browser requests returned **24/24 Chennai PM2.5 and weather hours for 10 August 2026**, **24/24 comparison weather hours at Delhi coordinates**, **9/9 regional pollutant samples**, and a successful city search. An earlier provider handshake timeout was correctly left as a gap before a later successful retrieval. Coverage is subject to provider/network availability. Sources, licenses, WHO averaging boundaries, basemap attribution and commercial-use limits are documented in [environment details](CARDIO_ENVIRONMENT.md).

## 8. Verification and measured performance

| Check | Verified result |
|---|---|
| Backend offline regression | **1,083 passed, 1 skipped, 108 deselected**; skipped trace propagation because optional `opentelemetry.sdk.trace` is not installed; no live-model or external integration tests included |
| Frontend full regression | **219 passed across 46 files** |
| Feature backend Ruff | Passed |
| Backend strict mypy | Passed across all **396 application source files** after the error-remediation pass; see [verification report](ERROR_REMEDIATION_2026-10-09.md) |
| Frontend TypeScript | Passed |
| Vite production build | Passed; existing large lazy Three.js/MapLibre chunks still emit optimization warnings |
| Synthetic browser A/D | Upload → pending → approval → LAD/source → Passport download; cutaway/isolate; unspecified disease approved without invented lesion |
| Replay browser B | Eight-state fictional engine; current-report exclusion at August boundary; delayed BNP exclusion; WHY and original-record inspection; consented source-observation/environment alignment; two-date comparison |
| Live browser C | Authentic PM/weather, regional samples, comparison/search, accessible map text alternative and explicit alignment consent |
| Coronary browser | Existing successful prediction transferred to vessel controls; independent-model labeling; historical exclusion |
| Accessibility/responsiveness | Reduced motion disables illustrative motion; 390 × 844 viewport has page width 380, no horizontal overflow; text mode and actual context-loss fallback selection exercised |
| Downloaded Passport | Hash chain valid and no changed artifacts; without its public key the demo signature is correctly classified `UNVERIFIABLE` / `HASH_CHAIN_ONLY`, not an external attestation |
| Diff/staging | `git diff --check` passed; staging empty; no commit/push |

The desktop anatomy renderer measured **120 frames / 2.0053 seconds = 59.84 FPS**, 35 draw calls, 298,743 rendered triangles (reference plus overlays/layers), 31 geometries, one texture and DPR 1. Its demand loop drew zero frames during a subsequent idle second. The emulated narrow viewport measured **121 / 2.0087 seconds = 60.24 FPS** at DPR 1 and also zero idle frames. These are short measurements on this browser/host, not a mobile-device benchmark or sustained 60 FPS guarantee. Both actual context-loss checks preserved text selection. There is adaptive DPR, lazy model loading, memoization and resource disposal, but no multiresolution mesh LOD or new compression decoder.

Verification logs are under `output/cardio-intelligence-*.log`, `output/cardio-environment-browser-journey.log` and `output/cardio-coronary-model-browser-journey.log`. Screenshots and fictional Passport are under `output/playwright/`. The browser functions contain assertions and exercise real application APIs; environmental responses were not mocked.

## 9. Remaining production and functional gaps

* No clinical validation, regulatory certification, patient-specific reconstruction, CT/MRI/DICOM segmentation, physical flow simulation or personalized pollutant-risk model.
* Extraction is deterministic and finite; scanned PDF/OCR, arbitrary lab vocabularies and full HL7 profile certification are unsupported. Full original binaries are not archived. Exact source context is retained; an external source-document archive/download still needs integration.
* Real reports require PostgreSQL. The new JSONB schema needs reviewed deployment migrations, PostgreSQL integration/RLS proof, encryption/retention policy, backups and cross-user clinical review/sharing. Current report ownership is both tenant and uploader; this deliberately prevents another same-tenant user from accessing the payload.
* Environmental cache/budget are process-local. Commercial deployment needs provider terms/credentials, shared quota/cache, monitoring and SLA work. Ambient context is not personal exposure; historical source publication times are unknown. No OpenAQ station adapter is implemented.
* The alignment view compares available reports, explicitly loaded fictional hemodynamic observations and a selected ambient day's hourly profile; it is not a multiday exposure reconstruction, validated causal analysis or reviewed patient-location history.
* Backend application typing now passes in full. PostgreSQL/integration/provider tiers, sustained GPU load, true mobile hardware, browser matrix and clinical anatomical assessment remain unverified.

## 10. Local run and demonstrations

From the repository root, using the existing pinned environment and installed frontend dependencies:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/cardio_intelligence_demo_files.py
.\backend\.venv\Scripts\python.exe backend/scripts/track7_demo.py --sqlite --keep-running --api-port 8895 --receiver-port 8896 --frontend-port 5195
```

Open `http://127.0.0.1:5195/login`, select the **Reviewer demo account**, then open `http://127.0.0.1:5195/cardiotwin/intelligence`. The existing launcher sets temporary loopback demo configuration; no `.env` edits are required. SQLite permits only clearly fictional uploads. Stop the foreground launcher with Ctrl+C. This local Track 7 demo is not the remote production deployment.

For A, choose **Upload Cardiovascular Report → Use fictional LAD report**, approve LAD, select it on the heart and export its Passport. The generated PDF in `output/cardio-demo/` also exercises actual multipart PDF intake. For B, enable fictional Cardio-Hemo observations and compare 10 and 12 August; inspect pump/volume WHY. For C, use Earth/Chennai/PM2.5, load the regional air layer, compare another location and inspect UTC hourly values and provenance. For D, upload the fictional unresolved report and verify approval retains a general card without a lesion. To carry actual coronary estimates, first run the existing `/cardiotwin` model and follow its Intelligence link.

Recheck from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -rs
.\.venv\Scripts\python.exe -m ruff check app/cardiotwin/anatomy app/cardiotwin/environment app/api/cardio_anatomy.py app/api/cardio_environment.py tests/cardiotwin/test_anatomy_reports.py tests/cardiotwin/test_environment.py scripts/cardio_intelligence_demo_files.py
.\.venv\Scripts\python.exe -m mypy app/cardiotwin/anatomy app/cardiotwin/environment app/api/cardio_anatomy.py app/api/cardio_environment.py
```

Recheck from `frontend/`: `npm test -- --run`, `npm run typecheck`, `npm run build`.

For browser checks from the repository root, open the demo, authenticate, and run a journey with the named Playwright session:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=cardio-intelligence open http://127.0.0.1:5195/login
# Select the observed Reviewer button, then navigate to the Intelligence route.
npx --yes --package @playwright/cli playwright-cli -s=cardio-intelligence run-code --filename frontend/e2e/cardio-intelligence-journeys.js
```

The environment journey starts on a freshly opened Intelligence route in Heart view; its complete-source assertion intentionally fails if live Chennai PM2.5 is unavailable. The coronary journey starts from the running authenticated app and performs its own navigation. The renderer check uses Vite's development R3F module to inspect actual render counts, then intentionally loses its context; reload afterward. Browser screenshots and local synthetic artifacts can contain fictional source content and should not be repurposed for real PHI without governed artifact handling.
