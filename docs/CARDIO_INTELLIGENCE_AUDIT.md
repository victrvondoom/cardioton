# Cardiovascular intelligence: architecture audit

Audit performed before substantial changes on 9 October 2026. The checkout contains extensive existing uncommitted work; existing routes, schemas and rendering implementations are retained. No commits, pushes, secret changes or environment-file edits are part of this work.

## Systems reused

* FastAPI authenticated `/api/v1/cardiotwin` coronary inference, scenarios, evaluation and sensitivity remain intact.
* `/cardiotwin/hemo` and `backend/app/cardiotwin/hemodynamics/` own eight-axis deterministic reconstruction, WHY, FHIR source adaptation and event/availability-aware replay.
* `/cardiotwin/atlas/:tab?`, its spatial/evidence graph and research controls remain intact.
* React Three Fiber, Drei and Three.js already provide rendering; MapLibre already provides global geographic rendering. No second rendering engine is introduced.
* The local HRA/HuBMAP CC BY 4.0 heart GLB contains named chamber, septal, valve and papillary meshes. Coronaries and great vessels require explicitly illustrative overlays. See `frontend/public/models/README.md` for credit.
* Existing `get_current_user`/role authentication and organization identifiers establish ownership. Existing Evidence Passport `seal_artifact` and `portable` establish export integrity; they do not establish clinical validation.
* Existing intake offers PDF/FHIR pathways. The new bounded report adapter uses the installed PDF parser and conservative source extraction without sending clinical text to a model or environmental provider.
* AquaHealth, One Health, OAH/FHIR exchange, oncology, authentication and governance routes remain available.

## Baseline and ownership

Full frontend baseline saved to `output/cardio-intelligence-frontend-baseline.log`. It exposed a case-economics test fixture that omitted the `case_id` required by the existing response identity guard. Backend CardioTwin baseline and new feature tests are recorded in the delivery report. The subsequent error-remediation pass resolved the whole-backend application typing backlog; see [current verification](ERROR_REMEDIATION_2026-10-09.md).

New report storage, environment adapters, anatomy viewer and `/cardiotwin/intelligence` are additive modules. Clinical annotations require explicit reviewer approval; report occurrence, server receipt and review decision times remain distinct. Environmental historical values are contextual reconstructions with unknown original availability, never retroactive clinical evidence.
