# CardioScope v1 engineering hardening

Engineering validation performed on 3 October 2026. This phase preserves the completed scientific application and adds reproducibility, failure containment and operational safeguards. It does not train real-data models, decode reserved outcomes, execute the consumed final evaluation, or change thresholds, SHAP mathematics/background, source geometry or probability outputs.

**Validation status: complete in the tested environments.** The scientific baseline is unchanged. [FINAL_VERIFICATION.json](hardening/FINAL_VERIFICATION.json) consolidates the final checks; untested environments and public-distribution decisions are listed below.

## 1. Frozen v1 baseline identity

The annotated tag **`cardioscope-v1.0.0`** permanently identifies the verified Phase 7 baseline at **`c75913853577e802703b7509334963d9be1fd868`**. The repository previously had no commits. The snapshot includes the required prepared sources, models and verification evidence; dependencies and generated build output remain outside Git. Engineering changes are on `codex/engineering-hardening`.

[BASELINE.json](hardening/BASELINE.json) records all four model checksums and these identities:

| Identity | Frozen value |
| --- | --- |
| Model/application | `d955d81c63c3d1402766c7891fa8015919b737f36a7efb7e0130686c98e4bdcd` |
| Schema | `b94a1e93d98728e465d42f578f7e66008d04618b04f5db4076fa997e691a9d01` |
| Final evaluation | `final-v1-f1fd0d4cdc334c65aba46c37fa68717b` |
| Explanation configuration | `aca7177ff9aeb4a6a817e73247f42eaf8cf7cf14d853c895b3491efddcf7ca80` |
| SHAP background | `d0b134ca26640dde8edd3d777a710197140a6aedc63e3be07e8991f5488edb57` |
| Protected manifest | `7f03a46a9edcb1e695fd68b4ae3ea485654645c1ab23e02dce00eb3321f77dd6` |

The [experiment boundary](EXPERIMENT_BOUNDARY.md) documents recovery and requires separate versioned branches/artifacts for future experiments. The tag and v1 artifacts must not be overwritten.

## 2. Clean Linux results

A separate `git clone --no-local` supplied the Docker build context. The context excludes the host virtualenv, frontend dependencies, build output and caches. Validation uses an Ubuntu 24.04.5 ARM64 container in a fresh Ubuntu 24.04.4 ARM64 VM, not copied macOS runtime binaries.

Two real portability problems were discovered and addressed:

- The official Node ARM64 executable needs `libatomic.so.1` in Ubuntu; the build stage installs Ubuntu's `libatomic1` package.
- uv 0.12.1's embedded Linux downloads stop at Python 3.12.13. The frozen provenance correctly rejects that patch version. Rather than change that check, `scripts/install_python_linux.sh` builds **Python 3.12.14 exactly** from the [official CPython source release](https://www.python.org/downloads/release/python-31214/), verifying its published XZ SHA-256 `5c8462af5790baf43a321a1559dbe0db06d1be4300fb85fb53c40060668e548a`. Ubuntu development libraries support SSL, compression, SQLite and ctypes; the script verifies their imports.

The original supplemental SHAP lock already contains hashes for Linux wheels. No platform-specific scientific lock, altered library version or weakened runtime check is needed. All **53 package versions** are checked against the frozen runtime, including SHAP 0.52.0 / numba 0.68.0 / llvmlite 0.50.0. Node is 25.3.0; npm bundled with that Linux image is 11.6.2 (the host npm is 11.7.0). Both use the unchanged npm lock.

The final clean build at implementation commit `e45d282` passed **134 Python tests, 75 frontend tests across 8 files**, lint/format, TypeScript, production build, source/anatomy checks and the four-target frozen smoke. The final image starts healthy as uid 10001 with a read-only filesystem and all capabilities dropped. Inside it, all 53 package versions and all 256 protected-file hashes match the baseline. See [LINUX_ENVIRONMENT.json](hardening/LINUX_ENVIRONMENT.json) and [LINUX_SMOKE.json](hardening/LINUX_SMOKE.json).

Actual loopback HTTP checks used the public development example: all four predictions and all four 55-factor explanations passed identity and reconstruction checks ([LINUX_HTTP.json](hardening/LINUX_HTTP.json)). Prediction median was 30.27 ms; first CAD explanation was 704.05 ms, and warm explanations were 2.17–2.32 ms. CAD's Linux probability differs from macOS by only 5.55e-17, within the documented 1e-12 tolerance; reconstruction residuals remain within 1e-6. This is floating-point roundoff, not a changed artifact/configuration. A macOS Chromium browser successfully rendered and interacted with the anatomy served by this Linux image ([LINUX_BROWSER.json](hardening/LINUX_BROWSER.json)). Linux AMD64 and a Linux GPU/browser have not been tested locally.

## 3. CI implementation

[GitHub Actions](../.github/workflows/ci.yml) targets Ubuntu 24.04, uses official actions pinned to commit SHAs, and restricts repository permissions to read-only. It builds the checksum-verified exact Python interpreter, installs the locked core and supplemental runtime, and runs `make install prepare lint test build`, the four-target development-example reconstruction smoke and final immutable verification.

Real final evaluation and training commands are absent. Existing evaluation tests use synthetic temporary roots; source checks and real inference/explanation tests use development records. The smoke patches fitting, reserved-data loading and evaluation execution to fail if called. Package caches are disabled in CI. No GitHub remote exists here, so hosted CI execution remains unverified until the repository is published; local Ubuntu validation exercises the same command path.

## 4. Installation improvements

The documented finished-app path is `make install prepare verify build` then `make run`; `make setup` additionally runs tests and lint. Prerequisite checks explain missing uv/Node/npm, missing virtualenv and frontend dependencies/build. `scripts/check_runtime.py` rejects wrong Python patches and missing/mismatched scientific packages with recovery instructions.

The Make targets use the virtualenv interpreter directly after installing the original hash-locked SHAP add-on. They avoid `uv run` pruning that add-on and do not resolve the incompatible historical optional-extra environment. `prepare` verifies shipped immutable sources rather than rebuilding the locked split/cache. Historical training/reproduction/preparation shortcuts were removed from Make; the underlying research implementation remains byte-identical. `make run` binds loopback, disables access logs and supports a port override.

[REPRODUCIBILITY.md](REPRODUCIBILITY.md) includes fresh checkout commands and exact Ubuntu source/container setup. No implicit host cache or previously downloaded anatomy is required.

## 5. Container decision and result

The container materially improves reproducibility by carrying the exact interpreter, scientific wheels and frozen files. Its Ubuntu build stage performs the complete checks and public development smoke. The runtime omits Node, frontend development dependencies and compilers; serves the production frontend/API together; runs as uid 10001; and supports `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges`. The healthcheck requires loaded frozen models. WebGL remains in the host browser, so the backend needs no GPU.

The image does not fit alternative models, replace results or expose a training/evaluation API. Profiles have no persistent volume. Python/npm locks are unchanged; Ubuntu apt/base tags can receive OS updates and are not a complete content-addressed OS lock. The tested final image is `sha256:e4d35f8a69fdb18dbc8ff6d4c52cdd7d53dd0b4497d972f17dccfe8e8adb8fdb`, 338,093,080 bytes. [LINUX_ENVIRONMENT.json](hardening/LINUX_ENVIRONMENT.json) records base-image digests and actual security/runtime settings; healthy startup and frozen HTTP checks passed. No container is published.

## 6. Browser compatibility

[BROWSER_CHECKS.json](hardening/BROWSER_CHECKS.json) records actual UI checks and their limits. Production anatomy renders all 83 verified meshes, with approximately 59–60 FPS observed locally, in:

| Browser | Verified workflow |
| --- | --- |
| Codex in-app Chromium; version not exposed | Example, four predictions, all target explanations on the Linux-backed app, actual LAD mesh selection, orbit/zoom camera changes, vessel controls, isolation/reset, Evidence navigation, refresh, keyboard groups; 390/1024/1440 CSS-pixel layouts without horizontal overflow |
| Firefox 157.0 on macOS | Example, four outputs, named target explanations, actual LAD mesh click synchronizing selection, all three vessel buttons, LCX/RCA isolation, visibly changed orbit/zoom, reset and Evidence navigation preserving LCX isolation |
| Safari 27.2 on macOS | Example, four outputs, explanations, actual LAD mesh selection, LCX/RCA selection/isolation, visibly changed orbit/zoom, reset and current-build Evidence/Prediction navigation |

Firefox's first-launch agreement was accepted with the user's explicit permission. Native Chrome testing was interrupted; the Chromium compatibility result is from the in-app browser. No physical phone/tablet, Linux graphical browser, hardware matrix or screen-reader certification is claimed. Earlier [Phase 7 orbit/camera evidence](product/BROWSER_INTERACTIONS.json) remains unchanged; this phase additionally observes native Firefox/Safari geometry changing under orbit/zoom and records actual Chromium camera changes, reset, posterior LCX isolation and navigation preservation against the final Linux service.

A real stale chunk failure occurred when `dist` was rebuilt while an older Safari tab was open. The new module boundary showed **Evidence unavailable**, without falsely displaying saved evidence. Refresh recovered on the current build and cleared the in-memory profile/results. Deployments should switch build assets together; this containment is not zero-downtime version retention.

## 7. Before/after performance

Measurements are [before](hardening/PERFORMANCE_BEFORE.json) and [after](hardening/PERFORMANCE_AFTER.json), from fresh local servers using the same public development example. They are short loopback samples, not controlled benchmarks or clinical-performance changes.

| Measurement | Before | After |
| --- | ---: | ---: |
| HTML HTTP | 23.74 ms | 21.98 ms |
| Anatomy manifest HTTP | 2.14 ms | 2.31 ms |
| All 83 mesh HTTP transfers, sequential | 77.39 ms | 69.24 ms |
| Four-target prediction, median of 10 | 23.24 ms | 22.07 ms |
| CAD first / warm explanation | 659.13 / 1.88 ms | 490.88 / 1.84 ms |
| LAD first / warm | 21.63 / 1.57 ms | 20.57 / 1.70 ms |
| LCX first / warm | 23.87 / 1.57 ms | 21.91 / 1.70 ms |
| RCA first / warm | 26.02 / 1.61 ms | 23.95 / 1.80 ms |
| Initial JS, uncompressed | 1,216,295 bytes | 266,391 bytes |
| Warm reload to verified renderer, automation upper bound | 557 ms | 1,017 ms |

CAD is measured first and includes shared lazy SHAP initialization. Later targets do not repeat that initialization. The sequential mesh measurement excludes browser parallel acquisition, parsing and GPU setup. Browser render timing includes automation overhead; the after run overlapped a Linux build, so it demonstrates no render-speed improvement. Differences in backend times are ordinary run variation; no backend acceleration is attributed to frontend changes.

The measured improvement retained is **about 78% less initial JS**. The viewer (~951 KB / ~254 KB Vite gzip) and Evidence (~17 KB / ~5.3 KB gzip) load separately, allowing the form/numerical UI to load without waiting on the renderer. A barrel Three.js import in the small probability-color contract was replaced with the same upstream Color class's direct module import. A 1,001-point grid test confirms exact original color strings. Geometry and rendering features are unchanged; the total loaded assets are not materially smaller. The remaining large viewer chunk warning is expected and retained. No post-processing, geometry decimation, SHAP prewarming or new caching policy was introduced.

The after measurement predates the final heading-only rebuild; final bundle filenames/sizes are recorded separately in final verification.

## 8. UI and accessibility hardening

The form shows exact completeness and per-group counts; a first-incomplete/invalid action focuses the field and reveals its error. Group buttons now focus a field, not only scroll. Keyboard Enter on History focuses field-5; Tab advances to field-6. All 55 fields remain empty on initial load; no units, clinical ranges, imputation or defaults were added.

The anatomy note states verified superior orientation in anterior/posterior presets and explicitly labels the **last preset**, acknowledging that dragging changes the viewpoint. Accessible controls, pressed selection state, named selected-vessel text and scene description supplement color. Geometry/mapping/opacity are unchanged. Explanation subsection headings now follow the section hierarchy. The skip link has a programmatically focusable main target; visible keyboard focus is retained. Existing Evidence tables have captions and row/column scopes, confusion cells have text labels, and the factor table uses header cells with signed numeric values and interpretation text.

Reduced-motion preferences disable smooth scrolling/animation/transitions. Representative CSS text contrast ratios meet 4.5:1; the focus ring exceeds 3:1. [CONTRAST.json](hardening/CONTRAST.json) gives exact pairs/results. This is a scoped accessibility pass, not full WCAG certification.

## 9. Reliability, privacy and security

New lazy module boundaries contain renderer/Evidence initialization failures while preserving numerical siblings. Runtime API validation rejects malformed successful JSON/health/schema/examples before using them. Schema validation enforces 55 unique predictors and excludes all four target columns.

Automated failure coverage includes missing/corrupt models, incomplete preparation, changed schema/search bytes, missing/changed mesh and manifest, renderer initialization, WebGL absence/context loss, unavailable SHAP, corrupt explanation configuration, backend/network/non-JSON errors, cancelled/obsolete predictions/explanations and late responses. Failed/pending states do not publish partial geometry or fake probabilities. Edits immediately invalidate prior numerical/colored/explanation state. Explanation failures keep verified predictions usable. Refresh clears the in-memory profile/results; navigation preserves them within the session. Test coverage and actual browser observations are distinguished; destructive failure cases are injected in mocks or disposable test roots rather than the frozen repository. The final Linux image additionally passed actual missing-model, corrupt-model and corrupt-explanation-configuration checks in disposable `/tmp` copies: model failures return 503 with no partial outputs/path disclosure; explanation failure returns 503 while predictions remain unchanged ([LINUX_FAILURES.json](hardening/LINUX_FAILURES.json)). An isolated read-only container with an empty SHAP import directory also returns explanation 503 while keeping all four predictions available and unchanged.

Clinical profiles are held in client/server memory only. No frontend storage, analytics, telemetry collector or request-body logging is present in the application. The existing bounded explanation cache is memory-only. Uvicorn access logs are disabled in documented production commands. API responses are `no-store`; validation errors do not echo submitted values; startup and unexpected operation errors avoid internal path disclosure. The API is same-origin with no permissive CORS headers. CSP constrains scripts/connections to self; headers also disable framing, sniffing, referrer transmission and camera/microphone/geolocation permissions. Inline styles remain allowed for existing rendering/layout. No authentication/accounts were added. The scope is a loopback demo, not an internet-facing clinical service.

## 10. Repository cleanup

The tracked-file scan found no absolute local home-directory paths, dependency/build caches, editor files or recognizable credential/private-key patterns. `.gitignore` and `.dockerignore` exclude environments, local interpreter builds, node/build output, cache/editor files, logs, partial downloads and dotenv variants. These are scoped scans, not a secret-scanning certification.

Prepared source files previously ignored are intentionally tracked so clones are self-contained. Intentional evidence screenshots use the explicitly public development example; new browser screenshots show no private patient data. Stale setup/implementation descriptions were corrected. Historical phase documentation remains identified as history rather than silently rewritten research evidence.

## 11. Artifact distribution readiness

The frozen Git snapshot contains all four joblib pipelines, schema/split/search/provenance, aggregate evaluation and existing receipts/pairs, deterministic SHAP background/config/lock, mapping/license source tables and 83 OBJ leaves. The actual fresh clone verifies their checksums without downloading a moving upstream anatomy archive. No app-required artifact exists only in the host caches.

Tracked content was approximately 28.7 MB before the final hardening evidence; the largest file is development results (~12.3 MB). This subset requires neither separate hosting nor Git LFS. Prepared public research records are distinct from submitted clinical profiles. Joblib is executable serialization; load only trusted, checksum-verified baseline artifacts. [Third-party notices](../THIRD_PARTY_NOTICES.md) document UCI/BodyParts3D attribution and upstream runtime licenses.

## 12. Tests and checks

macOS full safe suite: **134 Python tests** and **75 frontend tests across 8 files**; Ruff lint/format; TypeScript; production build; source/anatomy verification; exact runtime package checks; four-target frozen smoke and SHAP reconstruction. The final repeat passed on macOS and the same counts/checks passed in the clean Ubuntu build, recorded in [FINAL_VERIFICATION.json](hardening/FINAL_VERIFICATION.json). Frontend tests now wait for asynchronous module/mock readiness and use at most two workers; their substantive assertions are retained.

Real-data tests use development membership only. Synthetic model/evaluation tests may fit or execute evaluation within disposable synthetic roots; neither action occurs on the real reserved dataset. Existing warnings are SHAP/matplotlib deprecations, dependency Three.Clock/CJS warnings and the large viewer chunk notice. They do not represent failed tests. No optional-extra upgrade or warning-suppression optimization was applied.

## 13. Immutable-artifact verification

`scripts/verify_immutable.py` checks all **256 files** against the unchanged `docs/product/IMMUTABLE_INPUTS.json`, before setup/runtime and after checks. This covers the original lock, all ML implementation, protected inference/explanation code, data/split/search, models/results/evaluation/guards/background and anatomy sources/meshes. Protected bytes and baseline identities remain unchanged through the completed checks. Final verification passed again on macOS and inside the read-only Linux runtime. No protected-file change exists relative to the v1 tag.

The development smoke compares all four probabilities to the before-hardening reference within 1e-12, checks 55 contributions and unrounded reconstruction tolerances, and compares application identities to the baseline. Actual final holdout inference was never invoked. Hashing opaque source/artifact bytes does not decode reserved labels.

## 14. Remaining blockers before public submission

No engineering blocker remains in the tested macOS ARM64 and Ubuntu ARM64 environments. Before public submission:

- **Public distribution decisions:** the owner must choose a project code license; organizer PDF redistribution permission must be verified or those reference files omitted from a public export. Do not publish history containing unlicensed reference documents while merely deleting them from the latest tree. Preserve the local frozen tag.
- **Hosted CI:** configured but not run on GitHub because there is no remote. Verify its first run after publication; AMD64 is not yet locally certified.
- Physical mobile devices and a Linux GPU/browser remain untested; scoped desktop/responsive evidence does not claim those environments.

Scientific limitations remain those already reported: small same-source data, unverified probability calibration and weak LCX/RCA detection at the frozen threshold. Hardening does not improve or reinterpret predictive performance. Submission/report/video work remains a later phase.
