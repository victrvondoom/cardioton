# CardioTwin Atlas — integration audit and local implementation

7 October 2026. Additive workspace inside CLINI-CASE. Local only; no commit or push.

## Read-only audit before implementation

The existing application is React 18/TypeScript/Vite/Tailwind over FastAPI/Pydantic
2. PostgreSQL owns clinical cases, organizations, users, agent runs and reviewer
actions. One Health/Interop have their existing repositories and isolated SQLite
demo. Cardio-Hemo reconstruction is stateless. No new database is needed for this
bounded research workspace, and no schema, environment or deployment changes are
planned.

| Existing implementation | Integration decision |
| --- | --- |
| Coronary CardioTwin and eight original APIs | Preserve; add Atlas entry link |
| Cardio-Hemo schema, deterministic engine, FHIR adapter | Reuse unchanged |
| WHY, original record, trajectory, knowledge arrival, intervention views | Compose in Atlas |
| Evidence Passport sealing, portable export and verifier | Reuse for Atlas artifact |
| Authentication, roles and organization context | Reuse; server owns export identity |
| Governed model gateway | Preserve; no parallel gateway |
| OncoTwin, oncology, AquaHealth, One Health, Interop | Preserve all routes and domain boundaries |
| React Three Fiber, procedural heart geometry, MapLibre | Reuse dependencies and geometry; preserve existing scenes |
| Shared spatial styling and accessible HTML controls | Extend with scoped Atlas styling |
| ECG/imaging/speech clinical inference providers | Missing; expose UNAVAILABLE, accept explicit structured findings |
| Multimodal graph, synchronized spatial replay, isolated sandbox | Add inside cardiotwin/atlas |

Potential conflicts: existing coronary probabilities do not represent hemodynamic
axes; AquaHealth map statuses are ecological, so Atlas needs separate spatial
types; the existing sidebar has a compact-link contract; patient coordinates must
not enter public tile requests; future modalities must not leak through counts,
graph nodes, map events or explanations. Original source facts, deterministic
derivations, research interpretations and UNKNOWN must remain distinct.

## Implementation plan

1. Add Atlas contracts/adapters and compose the unchanged Cardio-Hemo engine.
2. Build an evidence graph, modality ablation, system-of-twins presentation and
   consent-gated spatial context from the same server-filtered reconstruction.
3. Add safe hypothetical reconstruction and source-grounded copilot answers.
4. Add authenticated APIs and reuse Passport integrity helpers.
5. Add lazy Atlas route, navigation links, fusion/graph/spatial/sandbox workspaces,
   evidence-linked schematic 3D heart and shared replay.
6. Verify temporal integrity, provenance, scenario isolation, missing providers,
   conflicts, consent, APIs and frontend behavior; run regression checks and build.

The original state engine and all existing routes remain authoritative. Atlas is
a bounded research composition, not a clinically validated physiological simulator.

## Implemented composition

`backend/app/cardiotwin/atlas` wraps the existing Cardio-Hemo reconstruction. It
does not replace its state rules, FHIR mappings, confidence windows or diagnoses.
Structured modality findings and conservative patient-report phrase extraction
become unverified source assertions with the original record and transformation.
Waveforms and media metadata alone never create clinical findings. Environment
is context only. No new clinical model, AI gateway, database or approval service
was introduced.

Every view is built after gating both `event_at` and `available_at`. Future
observations, modality descriptors, map events, reference IDs and counts are
excluded from the known frontier. A future hypothetical record cannot invalidate
an earlier reconstruction. Contradictory identities fail closed. A structured
source record retains a disclosed reference projection to admitted evidence;
untrusted free text and caller-supplied clocks are not independently certified.

The graph connects Patient reference, observed evidence, modality descriptors,
derived measures, eight twin axes, transitions, spatial context and mandatory
review. Its edges indicate support or temporal association, never proven
causality. Graph inspection opens provenance, both clocks, dependencies and the
original record. Transition WHY additionally compares recorded preceding/current
confidence and support sets: added, removed and retained evidence. A missing
historical snapshot remains UNKNOWN. Removed support does not mean record deletion.

Atlas navigation retains one reconstruction across its tabs, including through
the real application shell. Replay clears stale state, WHY, source selection,
scenario and copilot results while loading, and ignores obsolete responses.
The lazy 3D heart uses existing procedural geometry, demand rendering, capped
pixel ratio and accessible HTML controls; unavailable WebGL reuses the existing
schematic state view. Charts use engine-supported units/bounds, elapsed collection
time and exclude conflicting points instead of inventing a numerical trend.

Spatial context requires supplied consent and a known location. The interactive
MapLibre map uses a local coordinate grid with no tile/geocoder requests.
Facilities show straight-line distance and UNKNOWN live capacity. Missing
rendering has an SVG/text fallback; missing consent withholds patient/context data.

The sandbox copies admitted evidence and substitutes bounded hypothetical
observations. It cannot change the original twin, prescribe medication or export
its scenario as the original Passport. The copilot retrieves deterministic
passages and citations. Optional assistance reuses the governed gateway only
when its quota/audit store is available; it may reorder every existing passage
exactly once and cannot author facts or omit uncertainty. Failure retains the
deterministic answer.

## Authenticated API

All paths are under `/api/v1/cardiotwin/atlas`, using existing authentication and
organization context. Requests are bounded by the existing 2 MB reader, 3,000
combined observations and 100 modality sources. Validation messages do not echo
submitted records. No endpoint approves a state or modifies a patient record.

| Method/path | Purpose |
| --- | --- |
| GET `/demo?as_of=...` | Deterministic synthetic story at one boundary |
| GET `/providers` | Structured adapter and clinical-model availability |
| POST `/reconstruct` | Atlas sources or selected FHIR R4 contract |
| POST `/scenarios` | Isolated current/hypothetical comparison |
| POST `/explain` | Grounded answer; optional `compare_as_of` and `use_ai` |
| POST `/passport` | Existing portable Passport contract with server actor/tenant |

Atlas JSON supplies aware source clocks and an `as_of`. FHIR imports without a
reliable result/version availability use receipt time, so the UI advances to
receipt time when importing a Bundle. Newly entered transcripts also become
available now; they preserve submitted evidence, modalities, Bundle and receipt
metadata. Adding to the demo materializes only its displayed synthetic sources
and preserves their source mode. Historical replay still withholds later intake.

Passport export retains the server JSON text instead of reserializing sealed
numbers in JavaScript. Decode downloaded files as UTF-8. Existing hash-chain and
optional demo-system signature semantics apply; integrity does not certify the
source, diagnosis, clinical review or official FHIR conformance.

## Two-minute synthetic demonstration

Open `/cardiotwin/atlas`. The existing local Track 7 launcher also serves Atlas:

```powershell
python backend/scripts/track7_demo.py --sqlite --keep-running --api-port 8875 --receiver-port 8876 --frontend-port 5191
```

The verification preview uses an isolated cache wrapper at
`backend/.cache/atlas-preview-launch.py` so an earlier running demo is preserved.
It has disconnected clinical-case storage, an independent synthetic SQLite
receiver and no live AI calls. Use the existing one-click Reviewer demo login.

1. Replay **10 Aug**. The BNP collected that day but released on 12 Aug is absent;
   the later admission and encounter are also absent from graph and map.
2. Advance to **12 Aug**. Open a cardiovascular state or transition, inspect WHY,
   then open the original evidence and provenance. The graph and map share the date.
3. Compare **17 Aug** and **21 Aug** for documented intervention and subsequent
   observations. Describe association and residual uncertainty, not treatment causality.
4. Inspect source forms, modality ablation, system interactions and a hypothetical
   sandbox. Ask the copilot about available evidence and export the Passport.

See [CARDIOTWIN_ATLAS_DELIVERY.md](CARDIOTWIN_ATLAS_DELIVERY.md) for exact files,
validation evidence and research/provider limitations.
