# CardioTon Cardiac Architecture

CardioTon's cardiology stack after the SlicerHeart integration. This is the
cardiac view of the platform; non-cardiac modules (OncoTwin, OneHealth/AquaHealth,
Atlas geography, environmental mapping, automation) are untouched.

```
┌──────────────────────────── Frontend (React + Vite + R3F/Three.js) ─────────────────────────┐
│  /cardiotwin          CAD risk studio: scenarios → real model predict → vessel 3D (HeartViewer)
│  /cardiotwin/hemo     Cardio-Hemo Twin: realistic heart, cutaway, structure picking (HemoHeartCanvas)
│  /cardiotwin/atlas    Multimodal evidence graph + spatial replay
│  /cardiotwin/intelligence  Anatomic upload → reviewed evidence replay
│  /cardiotwin/global   Global research intelligence (agents, sources)
│  /cardiotwin/evaluation   Evaluation & methods + SlicerHeart panel (provenance, matrix, research)
│  /iit-mandi           IIT Mandi Track A complete demonstration (9 steps, report export)
└──────────────────────────────────────────────────────────────────────────────────────────────┘
              │ /api/v1/* (auth-gated JSON)
┌──────────────────────────── Backend (FastAPI) ───────────────────────────────────────────────┐
│  app/api/cardiotwin.py        predict / counterfactual / sensitivity / telemetry / guidelines
│  app/cardiotwin/model.py      L2 logistic regression (CAD, LAD, LCX, RCA), exact attributions
│  app/cardiotwin/hemodynamics  0D solver, counterfactuals, diagnostics, FHIR
│  app/cardiotwin/anatomy       upload → review → reference anatomy (human-in-the-loop gates)
│  app/cardiotwin/atlas         evidence graph, spatial replay, copilot
│  app/cardiotwin/multimodal    EHR + ECG + wearable fusion with uncertainty
│  app/cardiotwin/agents         deterministic research orchestrator (typed contracts)
│  app/iit_mandi                Track A scenarios + demonstration orchestration
│  app/integrations/slicerheart ★ SlicerHeart integration layer (see below)
└──────────────────────────────────────────────────────────────────────────────────────────────┘
              │ bridge job files only (never in-process)
┌──────────────────────────── Slicer runtime (optional) ────────────────────────────────────────┐
│  3D Slicer + SlicerHeart extension, ops/slicerheart/bridge_worker.py
│  ValveBatchExport CLI: annulus contour export, quantification results, …
│  outputs: CSV (contours), NRRD/NIfTI (volumes), VTK (models), JSON (metrics)
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## SlicerHeart integration layer (`app/integrations/slicerheart/`)

| Component | Role |
|---|---|
| `provenance.py` | Upstream identity, license, deterministic snapshot fingerprint |
| `catalog.py` | Code-verified integration matrix of all 37 upstream module groups |
| `valve_metrics.py` | Valve metric vocabulary + probe-position presets (reference data only) |
| `annulus_shape.py` | Adapted cohort annulus-shape statistics (pure numpy; runs in FastAPI) |
| `bridge.py` | Slicer runtime detection, job specs, honest unavailability (503) |
| `agent_tools.py` | Deterministic, auditable lookups for the CardioTwin agents |
| `api.py` | Router under `/api/v1/integrations/slicerheart` |

Design rules that hold across the whole stack:

1. **Use existing CardioTon functionality first** — the CAD model, hemodynamics,
   anatomy review gates, Atlas, agents and 3D viewers are unchanged in
   behaviour; SlicerHeart capabilities attach additively.
2. **No fabricated medical outputs** — imaging metrics exist only when a
   provisioned Slicer runtime produces them through the bridge; every endpoint
   and panel states this.
3. **Probability ≠ diagnosis** — vessel colours encode estimated probability;
   the 3D heart is reference anatomy, never the patient's.
4. **Human review gates unchanged** — anatomy findings still require reviewer
   approval before becoming confirmed annotations; agent outputs remain
   advisory.
5. **Attribution preserved** — upstream source stays untouched and pinned by
   content fingerprint.

## CROSS-5 multiscale intersection engine (`/cross5`)

Five linked reference frames — CardioTwin (heart), CardioEarth (planet),
CardioFlow (coronary microphysics), CardioChronos (biological time) and
CardioCity (urban access) — connected through a typed evidence model and a
declared intersection registry. Unsupported pairs are reported as unsupported,
never computed. See `docs/CROSS5_ENGINE.md`.

## IIT Mandi Track A demonstration flow (`/iit-mandi`)

1. Select synthetic patient (`GET /iit_mandi/scenarios`)
2. Load physiological/clinical information (EHR features, ECG config, wearable stream)
3. Run the real CAD prediction with multimodal fusion (`POST /iit_mandi/demonstration`)
4. Display CAD probability with model limitations and uncertainty
5. Interactive 3D heart with vessel-level probability overlays (HeartViewer)
6. Per-modality evidence inspection (EHR / ECG / wearable, contributing features)
7. Compare documented vs hypothetical scenario (deltas)
8. Reproducible JSON research report export (full payloads)
