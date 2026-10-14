# Phase 2: real anatomy viewer verification

Engineering verification on **1 October 2026**, using the production frontend served by the existing local FastAPI app at `http://127.0.0.1:8000/`. No models were trained or evaluated.

## Source assembly and orientation

The viewer consumes `/api/anatomy` and its 83 prepared OBJ files. It verifies the actual FMA/BP IDs, expected 30/18/6/29 leaf counts, safe paths, original-heart membership, disjoint groups, and mesh checksums/byte sizes before presenting a model. OBJ parsing also checks finite positions and source triangle counts. Six concurrent fetches limit acquisition work. An incomplete/changed mesh causes the whole assembly to fail, with no partial model displayed.

The only geometry transform is the shared parent transform **`scale * (source_position - center)`**. Meshes remain in source coordinates. No vessel is moved, normalized independently, decimated, repaired, thickened, or connected with invented geometry. The heart base excludes all 53 named LAD/LCX/RCA leaves. Other vessels belonging to the base-heart source remain their original gray geometry.

Orientation was verified against the official [BodyParts3D coordinate diagram](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/coordinate_system.png), also saved unmodified as [coordinate_system.png](coordinate_system.png):

- Positive X is the patient's left.
- Negative Y is anterior; positive Y is posterior.
- Positive Z is superior. Camera up is `[0, 0, 1]`.
- Source length units are **millimetres**, as stated by this diagram and all 83 OBJ `Bounds(mm)` headers. This does not establish any clinical dataset units.

Diagram SHA-256: `338736275c11eac8c89531fdc14193c9a8adf5baab674033d9d89259f152a5f6`. Retrieved 1 October 2026 from the same current archive. Credit: **BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International**.

The anterior/posterior cameras are `[0, -4, 0]` and `[0, 4, 0]`, looking at the shared origin. Selecting a vessel centers the camera target on that group's shared-coordinate bounds and uses a distance of 3.2. LAD/RCA focus on the anterior surface; LCX focuses on the posterior surface, where it is visible in the actual source assembly. This changes only the camera. Presets preserve the selection/isolation; reset clears both and restores the complete anterior view. Scroll/pinch zoom and orbit rotate the camera without altering geometry.

## Browser observations

| Check | Observed result |
| --- | --- |
| Complete assembly | Real heart base and all three source coronary groups rendered together; no obvious duplicate coronary rendering |
| Source identities | Actual mesh clicks selected LAD, LCX and RCA, with matching pressed UI controls and on-model/full-name labels |
| UI to viewer | Named UI controls highlighted/focused the corresponding source group |
| Isolation | Each of LAD, LCX and RCA displayed alone; switching the selected vessel changed the isolated group |
| Hidden picking | Isolated-out groups are unmounted, so invisible coronary meshes cannot capture raycasts; a blank-space click preserved the LCX selection |
| Anterior/posterior | Source-facing views had Z superior; LCX was inspected on the posterior/lateral surface |
| Orbit and zoom | Native drag and wheel changed the camera and visible orientation/size; selection was retained |
| Reset/show all | Restored all groups; reset cleared selection/isolation and returned camera to `[0, -4, 0]` |
| Performance | Approximately **60 FPS** shown by the one-second render-frame counter during the local session; orbit, focus, zoom and isolation responded without an observed stall |
| Neutral state | No clinical probabilities were shown; blue/amber denote unselected/selected anatomy, explicitly labeled as unrelated to risk |

The local test used the current ARM64/16 GB machine and Codex's in-app browser. Both a wide 1000×480 canvas and a narrow 521×400 canvas were inspected. DPR is capped at 1.5; there are no shadows, post-processing effects, or mesh optimization. FPS measures render callback cadence, not GPU completion, input-to-display latency, or a guarantee on other hardware. No decimation/merging was justified by this observation.

Saved visual evidence:

- [Anterior assembly with selected LAD](anterior-lad.jpg)
- [Isolated LCX](lcx-isolated.jpg)

The upstream LCX subset has visibly separated small branch fragments at the supplied 99% polygon reduction. Its six leaves loaded with matching hashes and source triangle counts. The fragments were retained as supplied; no inferred connections were inserted. Smaller vessels require a sufficiently zoomed view for precise mesh clicks; the named controls provide the same selection independently of pointer precision.

This is a source-based engineering/visual check, **not clinical validation or a review by an anatomist**. The immutable acquisition manifest still records its phase-one `browser_render_verified: false` and `anatomical_visual_review_complete: false`. This document records subsequent browser verification separately rather than altering locked acquisition metadata or claiming medical expert review.

## Automated checks and phase boundary

- **43 Python tests passed**, with no skips; both source verifiers and Ruff lint/format checks passed again.
- **30 frontend tests passed**, with no skips, including actual offline parsing/checksumming of all 83 OBJ files, group/mapping guards, state/reset/isolation, bidirectional UI/scene wiring, API errors, cancellation, partial asset failure, WebGL fallback/context loss, renderer initialization failure, and geometry cleanup.
- Clean locked `npm ci`, strict TypeScript checking and production build passed.
- The jsdom test dependency requires Node 22.13+ in the 22.x line or 24+. The frontend engine declaration/setup documentation now reflect that actual requirement; the existing Node 25.3.0 installation meets it.
- The Vite build retains its ordinary >500 kB chunk warning: the Three.js viewer bundle is about 1.18 MB / 324 kB gzip. Runtime remained responsive; no warning threshold was hidden and no premature bundling framework was added.
- The browser reports a nonfatal `THREE.Clock` deprecation warning from the pinned React Three Fiber dependency, which still instantiates that Three.js class. No browser rendering errors were observed. Dependency code was not monkey-patched or silently upgraded.

DOM tests mock WebGL only; actual rendering/raycasting/controls are verified in the browser as described above. Mesh/manifest/WebGL failures show explicit failure states and do not show a ready status. Retry discards obsolete loads and rebuilds the full assembly. Backend error details survive JSON errors, and HTML proxy failures become a readable HTTP error.

No dataset acquisition, split creation, model fitting, holdout prediction, SHAP, patient form, report, or submission work ran in this phase. The typed vessel-state interface supports unavailable/pending/error or future prediction states with probability, model version and profile fingerprint. Production supplies unavailable states only. Probability colors are bounded and unit-tested; there is no demo-probability injection or persisted fake result.

Unchanged artifact SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `artifacts/data/split.json` | `98e8d0b080019e6d9426543a543efb1cffe8f249a9b6c7ada544caa5dac6cdb2` |
| `artifacts/data/feature_manifest.json` | `b94a1e93d98728e465d42f578f7e66008d04618b04f5db4076fa997e691a9d01` |
| `artifacts/data/audit.json` | `3ad398338e4541f43b89b69c1572dea953ef57c23856950a76a5b5c786f347c5` |
| `assets/anatomy/manifest.json` | `598726cd5ef3bc7e1091ac9255e583ee52a2ed625c13b262ea7c7c80d8b67aa8` |

No blocking source mapping/orientation problem was found. Model inference, explanations, external clinical/anatomical validation, broad device testing, UI polish, and submission work remain outside this completed phase.
