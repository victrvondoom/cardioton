# CARDIO-HEMO TWIN — local implementation and demo

Research / clinical-support inference. These qualitative rules are not a validated
diagnostic model, prediction, treatment recommendation or clinical certification.
All reconstructions remain drafts requiring clinician interpretation. No source
record is changed and no clinical approval endpoint is introduced.

## Architecture audit and extension decisions

The existing backend is FastAPI/Pydantic 2. The frontend is React 18, TypeScript,
Vite and Tailwind, with authenticated React Router routes. Existing clinical
domains include oncology, OncoTwin, case twins, OneHealth and AquaHealth.
`app/cardiotwin` already serves CAD/vessel probability estimates from an offline
artifact. Its eight authenticated endpoints, existing heart viewer, sensitivity
flow and evaluation page are preserved.

The new domain lives under `app/cardiotwin/hemodynamics` and the existing
`/api/v1/cardiotwin/hemo` namespace. `/cardiotwin/hemo` is linked from the coronary
workspace and Clinical Context. It uses the existing authenticated CardioTwin
client. No alternate application, gateway, patient store, approval queue,
deployment, database migration or external model dependency is added.

Existing FHIR clinical validation is specific to prior authorization and cannot
require its Patient+Condition cardinality for sparse hemodynamic evidence. The
adapter therefore implements a conservative exact-code R4 application contract,
with native resources and explicit unsupported-input issues. Source records,
quantity conversions and source provenance are retained. This is not full HL7
R4 profile/terminology validation. Generated artifact bundles pass the existing
R4B base-shape validator, whose scope is explicitly narrower than R4 certification.

The existing passport `seal()` is coupled to OneHealth/Interop records. An
additive `seal_artifact()` helper reuses its manifest/hash-chain format for a
one-revision immutable research export. Existing `portable()` and
`verify_package()` support export, configured system signing and tamper detection.
An export signature establishes system integrity, never clinician approval.
The authenticated actor/organization are server-derived.

The existing governed GenAI Gateway remains unchanged. The new domain never
calls an LLM and remains usable during provider failure. `/interop` remains the
existing governed mapping/review/exchange workflow. Its link is navigation:
it does not automatically enqueue or approve a Cardio-Hemo snapshot.

Pre-existing local shell/navigation/architecture changes, the cardiology 3D
component, Kubernetes remote files and `.env` are outside this implementation.

## Domain modules

| Module | Responsibility |
| --- | --- |
| `schema.py` | Strict observed-evidence and reconstruction contracts; forbidden approval/identity overrides |
| `engine.py` | Eight-axis state, congestion/function/rhythm/cardiorenal trajectories, confidence, transitions, as-of reconstruction and intervention comparison |
| `fhir.py` | Native source adapter, selected-patient scoping, exact codes/UCUM, provenance and knowledge-time quarantine |
| `diagnostics.py` | Evidence withholding audit and delayed-result knowledge-arrival ledger using the same engine |
| `demo.py` | Fixed entirely synthetic longitudinal FHIR scenario |
| `service.py` | Stateless domain composition, separate inferred FHIR artifact and existing Evidence Passport integration |
| `api.py` | Existing authentication, bounded request parsing, sanitized validation output and hash-only telemetry |

An evidence record has `event_at` and `available_at`. The latter is when the
supplied version became knowable, not an assumed measurement time. Both must
precede the reconstruction instant. Dates must include a timezone. Impossible
availability ordering is rejected. Filtering precedes deduplication, issues,
confidence, interventions and explanations. Timeline cutoffs follow knowledge
arrival, so late evidence does not rewrite earlier snapshots.

The state vector contains pump function, volume status, filling-pressure proxy,
rhythm stability, vascular load, renal interaction, respiratory interaction and
functional capacity. State levels are LOW/NORMAL/ELEVATED/HIGH/UNKNOWN. Source
facts are OBSERVED, reproducible numerical changes are DERIVED, qualitative
state interpretations are INFERRED, and absent/stale/unsupported/conflicting
state evidence remains UNKNOWN. LVEF is only a systolic-function proxy; filling
pressure is never presented as a measured pressure.

The versioned `rules` object exposes windows, supported units, numerical bounds,
congestion criteria, temporal gates and confidence meaning. Recent evidence and
trend windows are 14 days; the echo window is 90 days. These are configurable-in-
code research assumptions requiring clinical evaluation, not standard-of-care
cutoffs. Confidence reflects coverage and corroboration, never a probability.
`confidence_details` exposes known/unknown axes, corroborating modalities and
conflicts. A stable proxy requires explicit negative findings; silence is not
normality.

Same-ID conflicting versions reject reconstruction with HTTP 422; identical
duplicates collapse. Different IDs with contradictory same-time values cannot
silently choose a measurement. Correlated BNP/NT-proBNP are kept distinct but
count as one evidence modality. HR and electrolyte observations are retained
as contextual facts without inventing rhythm or renal diagnoses.

Documented interventions are observed events, not recommendations. Numerical
response comparisons require valid, unconflicted, bounded pre/post evidence.
`IMPROVING` refers to a lower observed weight signal; renal/symptom uncertainty
can remain. A stage after an intervention is a temporal association, not proof
that treatment caused it. No dose or prescription is generated.

## Differentiated explanation tools

**WHY:** state/transition → observed operands → transformation/provenance →
original record → explanation. Historical WHY references are limited to evidence
available in that replay. UNKNOWN states can link to the stale/conflicting source
that explains the gap.

**Replay Twin:** selecting a date reconstructs on the server, clears the prior
snapshot while loading, and ignores obsolete asynchronous responses. Date-picker
replays include the entire final second through 23:59:59.999999 UTC; timeline
replay uses the precise knowledge timestamp. Snapshot filenames use the actual
reconstruction timestamp, even if the date input has subsequently been edited.
The server returns no future observations or hospital events.

**Evidence sensitivity:** withhold one modality and rerun the same rules. Show
the resulting stage, changed state categories, confidence and withheld source
references. This audits dependence on evidence. It is not a physiological
counterfactual, causal attribution, clinical certainty or treatment simulation.

**Knowledge arrival:** delayed results show clinical event time, availability
time, lag and changes recorded at release. No pending/future-result list is
revealed in earlier replays. Changes sharing the same release timestamp may
involve multiple records; the ledger does not claim single-record causality.

## FHIR and provenance contract

Supported source contexts: Patient, Observation (including supported components),
Condition, MedicationRequest, MedicationAdministration, DiagnosticReport,
Encounter and Procedure. Unsupported narrative/codings are not mined or guessed.
Medication orders remain distinct from administrations. Conditions/reports are
context; no new diagnosis is inferred from their text.

Observation codes include weight, LVEF, HR, BP, SpO2, BNP, NT-proBNP, creatinine,
eGFR, sodium and potassium. Explicit local codes cover qualitative symptoms,
rhythm, function, oxygen support and documented diuretic change. Local codes are
declared as local, never mislabeled as standard terminology. BNP and NT-proBNP
remain separate concepts ([BNP LOINC](https://loinc.org/30934-4),
[NT-proBNP LOINC](https://loinc.org/33762-6)).

FHIR `effective[x]` supplies clinical time; `issued`, `meta.lastUpdated` and
`Provenance.recorded` conservatively establish current-version availability.
Where absent, the API records receipt time; earlier replays cannot backfill it.
Only supplied versions are reconstructed; missing prior versions cannot be
recovered. See [FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html) and
[FHIR R4 Provenance](https://hl7.org/fhir/R4/provenance.html).

Unfinalized/entered-in-error sources, ambiguous subjects/fullUrls, invalid units,
comparators, modifier extensions and invalid timestamps fail closed or are
quarantined. Issues are sanitized and only exposed at a known receipt boundary.
Original sources are separate from preliminary inferred Observation artifacts
and their Provenance. Exported twin states are explicitly tagged and cannot
feed back as observed source measurements.

## Local API

All endpoints retain `get_current_user` authentication. Processing is stateless;
there is no cross-tenant lookup, persisted patient state or clinical action.

| Method/path under `/api/v1/cardiotwin` | Input/output |
| --- | --- |
| GET `/hemo/demo?as_of=...` | Filtered synthetic reconstruction; default 21 August 2026 |
| POST `/hemo/reconstruct` | `{patient_ref, as_of, evidence: [...]}` |
| POST `/hemo/fhir` | `{bundle, patient_ref?, as_of, received_at?}` |
| POST `/hemo/fhir/passport` | Same FHIR input; retains intake issues, mapping contract and source provenance in the sealed reconstruction |
| POST `/hemo/passport` | Same source-evidence reconstruction contract; immutable research export |
| GET `/hemo/demo/passport?as_of=...` | Existing passport format with filtered demo snapshot and separate inferred FHIR artifact |

Requests cannot supply approval, reviewer or organization overrides. Responses
always include `review.status=REQUIRED` and `clinical_approval=false`. POST bodies
are limited to 2 MB; FHIR Bundles to 1500 resources; normalized requests to 3000
evidence records. CPU reconstruction and passport work run in bounded worker
threads so they do not block the API event loop. Replay reuses the once-prepared
evidence set; both timestamps are still gated at every historical cutoff.
Large timelines still require repeated state scans and large responses. A local
synthetic benchmark took 0.293 seconds for 300 records, 1.117 seconds for 600,
and 13.609 seconds for 3000. These are workload observations, not performance
guarantees. This implementation is intended for bounded longitudinal research
scenarios, not high-volume streaming telemetry.

## Two-minute demo

Start the existing isolated synthetic launcher from repository root:

```powershell
python backend/scripts/track7_demo.py --sqlite --keep-running
```

Open the locally printed frontend address, use its demo sign-in, then open
`/cardiotwin/hemo` (or follow the coronary-workspace link). The launcher overrides
the database target for its child processes; `.env` is not changed. Production
PostgreSQL-backed shell endpoints are intentionally unavailable in SQLite mode.
The shared shell and navigation use an additive, non-probing health field,
`case_storage_configured`, to skip unsupported case/agent requests and show
unknown counts with a degraded storage indicator. Liveness remains process-only;
`/readyz` still checks storage and fails closed. An initialized pool is not a
database health guarantee. Older servers retain the previous polling behavior.
Shared feed caching is partitioned by authenticated session, with one identity
captured for every request in a polling round.

1. **0:00–0:25:** the 21 August state shows an improving observed signal with
   residual uncertainty. Pump/rhythm can remain UNKNOWN; inspect their reasons.
2. **0:25–0:50:** replay 10 August. The later hospitalization and BNP release
   disappear. The source BNP collected on 10 August is not yet knowable.
3. **0:50–1:15:** replay 12 August; open WHY and an original record. The delayed
   BNP is now visible with a 50-hour availability lag and preserved source JSON.
4. **1:15–1:35:** inspect evidence sensitivity. Withholding weight on 10 August
   changes increasing concern to a mild signal under the same rules.
5. **1:35–2:00:** compare 17 and 21 August intervention-response observations,
   inspect renal uncertainty, then export a snapshot/passport. Nothing is approved
   or written back to a patient record.

## Findings and remediation ledger

| Finding | Resolution / verification |
| --- | --- |
| Backdated results could leak into replay | Gate both clinical and availability times; whole-payload future-invisibility tests |
| Later conflicting ID could erase past WHY references | Reject conflicting eligible identities; future conflicts filtered before rejection |
| Unsupported numeric units could create response deltas | Apply the same unit/range contract to state and response operands |
| Old/contradictory intervention baseline could imply recovery | Bound/unconflict pre/post comparisons; explicit regression tests |
| Nested non-string FHIR references could return 500 | Strict reference parser; hostile nested-input tests |
| Ambiguous Bundle fullUrl could mix patients | Reject conflicting resource identities |
| Missing medication-change value could imply intervention | Only explicit documented-change values enter response/stage logic |
| Clinical approval or tenant spoofing in body | Strict contracts reject extra fields; server identity governs export |
| Existing passport sealing assumed another domain | Add generic new-artifact helper; preserve existing seal and regression-test tampering |
| Provider unavailable | Pure deterministic core; no gateway call, directly tested |
| Equivalent timezone offsets lost release transitions | Compare timestamp instants, with delayed-release replay regression |
| Fractional final-second evidence omitted by date replay | Use the full microsecond end-of-day boundary; test inclusion and next-day exclusion |
| Edited date mislabeled an exported snapshot | Filename comes from the reconstructed as-of timestamp |
| FHIR passport lost intake/mapping context | Reconstruct the original Bundle and receipt time through the dedicated export route |
| Oversized quantities or deeply nested source records returned 500 | Quarantine overflow/recursion failures without exposing source content |
| Large reconstruction blocked independent async requests | Worker execution plus removal of repeated JSON hashing; concurrent-probe regression |
| DB-less shell repeatedly requested unavailable case storage | Reuse the shared capability-aware feed for navigation and shell, keeping counts unknown |
| Shared feed cache could span auth changes | Partition by authorization and capture one identity per polling round |
| Cohort test asserted before asynchronous counts arrived | Await the actual counts while preserving the original assertion |

## Validation and limits

Focused tests cover temporal reconstruction, missing/conflicting/stale evidence,
determinism, reordered/duplicate input, provenance, confidence, as-of replay,
future-data exclusion, FHIR partial/invalid input, unit conversion, strict auth,
human boundaries, AI failure, response comparisons and the novel diagnostics.
Frontend tests cover WHY/source navigation, request races, replay evidence removal,
uncertainty, FHIR import and snapshot/passport export.

Clinical calibration, prospective validation, continuous ingestion, persisted
longitudinal state, Cardio-Hemo-specific clinician approval storage and automated
exchange-job binding are outside this local research implementation. The existing
review/exchange workflow is preserved. No live database/schema/provider or
deployment validation is claimed. See the final local delivery report for the
executed test counts, browser verification and exact changed-file inventory.
