# CROSS-5 — Five-Frame Multiscale Cardiovascular Intelligence

CROSS-5 connects five scientific reference frames into one evidence-linked
research system. The frames are **linked, never physically merged**: each keeps
its own coordinate system, units, observation semantics and evidence status.

```
FRAME 01  CardioTwin      human organ      anatomy, CAD probability (existing)
FRAME 02  CardioEarth     planet           WHO GHO snapshot, Open-Meteo environment (existing components, new module)
FRAME 03  CardioFlow      mm–µm            0D coronary solver, cardiac-cycle waveforms (new)
FRAME 04  CardioChronos   ms–years         multiscale timeline, leakage-safe replay (new)
FRAME 05  CardioCity      streets–metro    synthetic city graph, Dijkstra access analysis (new)
```

## Where the code lives

| Layer | Path | Contents |
|---|---|---|
| Frame registry | `backend/app/cardiotwin/cross5/frames.py` | five frames, scales, claims policies |
| Typed evidence | `backend/app/cardiotwin/cross5/evidence.py` | EvidenceRecord: frame, subject/population, spatial+temporal refs, units, provenance, status (observed/derived/modeled/simulated), uncertainty, consent, model version |
| Intersection engine | `backend/app/cardiotwin/cross5/intersections.py` | declared link registry, temporal overlap, spatial identity, leakage check |
| CardioFlow | `backend/app/cardiotwin/cross5/microphysics.py` | reuses the shared 0D solver; adds waveform + centreline models |
| CardioChronos | `backend/app/cardiotwin/cross5/chronos.py` | reuses ecg/wearables generators; adds HRV windows, replay, alignment |
| CardioEarth | `backend/app/cardiotwin/cross5/earth.py` | WHO GHO snapshot + environment via existing Open-Meteo service |
| CardioCity | `backend/app/cardiotwin/cross5/city.py` | synthetic graph, Dijkstra, population-weighted access stats |
| Experiments | `backend/app/cardiotwin/cross5/experiments.py` | Earth→Heart, Artery→Time, Planet→City→Heart |
| API | `backend/app/api/cross5.py` | `/api/v1/cross5/*` (auth-gated) |
| Agent tools | `backend/app/cardiotwin/cross5/agent_tools.py` | frame/intersection/experiment explanations; registered in the CardioTwin agent registry; never invent data |
| Frontend | `frontend/src/cross5/*`, `frontend/src/routes/Cross5Studio.tsx` | studio at `/cross5` (incl. the CardioTwin→CardioFlow vessel navigation bridge) |

## The intersection engine

Three link types are computed, and one is declared:

* **Temporal** — wall-clock interval overlap between typed records (patient
  wearable windows vs regional environmental windows). Model-time records
  (CardioFlow's cardiac cycle) are excluded by design.
* **Spatial** — country-ISO containment or anatomical vessel-id identity.
* **Anatomical/contextual** — declared relations (CardioTwin↔CardioFlow share
  vessel ids; individual↔aggregate context is displayed side-by-side, never
  merged).
* **Model-based** — only relations actually implemented: the 0D lesion circuit,
  HRV formulas, the Dijkstra router and the evaluated logistic CAD model.

Unsupported pairs (e.g. CardioFlow↔CardioChronos: *"CardioFlow's time axis is
simulated cardiac-cycle model time, not wall-clock time"*) are returned as
`unsupported` with the reason — never computed anyway.

## API contract (all under `/api/v1/cross5`, auth required)

| Endpoint | Method | Purpose |
|---|---|---|
| `/frames` | GET | five-frame registry with claims policies |
| `/intersections?frames=a,b,…` | GET | declared supported + unsupported links for a selection |
| `/flow/vessels` | GET | nominal reference vessel geometry |
| `/flow/simulate` | POST | 0D solve + cardiac-cycle waveform + centreline profile |
| `/flow/compare` | POST | hypothetical stenosis → FFR-index curve |
| `/chronos/timeline` | GET | deterministic multiscale synthetic timeline + alignment |
| `/chronos/replay` | POST | leakage-safe point-in-time reconstruction |
| `/earth/countries[/{iso}]` | GET | WHO GHO snapshot with provenance |
| `/earth/environment` | GET | Open-Meteo context (503 `environmental_provider_unavailable` when offline) |
| `/city` | GET | synthetic city graph + baseline access statistics |
| `/city/access` | POST | node-to-facility Dijkstra or city-wide scenario analysis |
| `/experiments[/{id}/run]` | GET/POST | three flagship experiments |

## Flagship experiments

* **A — Earth to Heart**: country profile → synthetic patient timeline → real
  CAD model inference → declared temporal alignment (interval overlap only,
  association ≠ causation).
* **B — Artery to Time**: hypothetical 0D scenarios on a nominal vessel,
  cardiac-cycle waveform replay, and — kept explicitly separate — the vessel's
  statistical CAD probability. The payload states the probability never places
  a lesion and the simulation is never a diagnosis.
* **C — Planet to City to Heart**: regional context → city access analysis
  (baseline vs hypothetical facility) → patient timeline → CAD inference →
  coronary scenario summary, with a five-step provenance chain.

## Frontend (`/cross5`)

Command-center layout: left frame navigation + experiment launchers; one
**active immersive viewport** (Earth CesiumJS globe / CardioTwin heart /
CardioFlow 3D vessel / Chronos timeline / City SVG graph) — heavy scenes render
only when active; right panel shows declared intersections (supported and
unsupported), the FFR scenario curve, experiment outputs with JSON export;
bottom shows the synchronized multiscale timeline with a leakage-safe replay
marker. The Earth view reuses the pinned CesiumJS CDN loader (no Cesium ion)
with a table fallback when WebGL/CDN is unavailable.

## Scientific honesty rules enforced in code

1. Country statistics are labelled population-level and never applied to an
   individual; the snapshot notice says "not live surveillance, verify at WHO
   GHO before publication use".
2. CardioFlow outputs carry the notice: hypothetical, nominal geometry, not
   patient-specific, interpret comparatively (the shared solver's calibration).
3. CardioChronos replay excludes any record after the requested date — future
   leakage is impossible by construction; gaps are reported, never interpolated.
4. CardioCity notices: synthetic network, graph estimates, not emergency
   dispatch guidance.
5. Environmental observations never imply causation of disease.
6. Particle motion in the vessel view represents the reduced-order simulated
   flow — it is never presented as CFD.

## Testing

Backend (`tests/cardiotwin/test_cross5.py`, 29 tests): frame registry, evidence
typing + leakage rule, intersection declarations (including key-order
robustness and the model-time exclusion), flow determinism/monotonicity/
waveform physiology, chronos determinism/HRV formulas/replay leakage/gap
policy, earth snapshot provenance, city Dijkstra + scenarios, all three
experiments, agent tools (frame/intersection explanations, honest registry
entry), and the full API contract including honest 503s. **All pass.**

Frontend (`tests/cross5-studio.test.tsx`, 8 tests): frames render, honest
unsupported intersections, experiment execution + export, **CardioTwin →
CardioFlow vessel navigation** (selecting RCA in the heart view runs the flow
simulation for RCA and activates the flow viewport), Earth/City frame switching
with notices, node access computation, timeline gap policy, API error handling.
**All pass.** Viewports (WebGL/Cesium) are stubbed in jsdom; their props
contracts are asserted.

## Measured performance (this deployment's hardware)

Backend latency — in-process FastAPI TestClient, N=10 per endpoint, paced to
respect the platform's 10 req/s per-second rate limit (which correctly fired
429s during the first unpaced run). Median request→response wall time,
including JSON serialization:

| Endpoint | Median | Payload |
|---|---|---|
| POST /cross5/flow/simulate | 19.2 ms | 13.1 KiB |
| POST /cross5/flow/compare (5 scenarios) | 66.6 ms | 1.2 KiB |
| GET /cross5/chronos/timeline (48 h) | 23.5 ms | 8.6 KiB |
| POST /cross5/chronos/replay | 23.4 ms | 3.9 KiB |
| GET /cross5/intersections (5 frames) | 5.2 ms | 3.0 KiB |
| POST /cross5/experiments/earth_to_heart | 27.1 ms | 4.4 KiB |
| POST /cross5/experiments/artery_to_time | 83.3 ms | 15.4 KiB |
| POST /cross5/experiments/planet_to_city_to_heart | 63.1 ms | 7.0 KiB |
| POST /iit_mandi/demonstration (multimodal fusion) | 49.3 ms | 2.7 KiB |
| POST /cardiotwin/predict (logistic model) | 11.0 ms | 51.9 KiB |

Every flagship experiment completes server-side in well under 100 ms — no GPU,
no cloud CFD, no paid compute. The heaviest operation (Experiment B) is the
5-scenario 0D comparison plus a full waveform simulation.

Frontend production build (`tsc && vite build`), measured:

* Build time: **14.6 s**.
* `Cross5Studio` route chunk: **24.3 kB (gzip 8.8 kB)** — lazily loaded only
  when `/cross5` is visited.
* `CardioFlowView` chunk: 4.9 kB; `HeartViewer` chunk: 5.8 kB (both lazy).
  The shared three.js/R3F chunk (824 kB / gzip 222 kB) is shared with the
  existing 3D routes and loaded on demand, not at startup.
* The main entry chunk is 301 kB (gzip 94 kB), unchanged in structure by CROSS-5.

Not measured here (no browser in this environment): first-paint startup time,
frame rate, and browser memory of the WebGL/Cesium viewports. Those require a
real-device run; the viewports inherit the on-demand render loops, capped DPR
and single-active-viewport design of the proven CardioTwin viewers, which exist
precisely to bound those costs.

## Limitations and not-done

* The Cesium globe itself and the R3F vessel scene were **not render-tested in
  a real browser** in this session (jsdom has no WebGL); their logic is
  unit-tested and they follow the exact loader/fallback patterns of the proven
  OneAquaHealth globe and CardioTwin viewer.
* The Open-Meteo environment endpoint depends on network availability; offline
  it returns an explicit 503 (tested). Tests never hit the network.
* The city graph is synthetic. Loading a real OSM-derived graph is a data task;
  the analysis code is OSM-shaped and unchanged by that swap.
* WHO GHO values are rounded demonstration snapshots — verify at source before
  any publication use.
* Web Workers / WebAssembly / WebGPU were not required for the current
  workload sizes; the studio keeps one active viewport and on-demand render
  loops instead of speculative parallelism.
