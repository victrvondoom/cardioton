# CardioTon - IIT Mandi Track A Implementation Audit

**Date:** 2026-10-11  
**Target:** IIT Mandi Multimodal AI Hackathon 2026 - Track A: Interactive 3D Cardiovascular Risk Visualization & Prediction  
**Deadline:** 2026-10-15 00:15 IST

---

## Executive Summary

The existing CardioTon platform already contains **~80% of the required functionality** for IIT Mandi Track A. The core CardioTwin module provides:
- ✅ Real CAD prediction model with evaluation
- ✅ Interactive 3D coronary visualization
- ✅ Multimodal clinical data integration (EHR features)
- ✅ Explainable risk and evidence provenance
- ✅ Counterfactual simulation
- ✅ FHIR interoperability

**Critical gaps to fill:**
1. ECG signal processing pipeline (currently only ECG flags from EHR, not raw signals)
2. Wearable streaming and longitudinal digital twin
3. Enhanced multimodal fusion (EHR + ECG + imaging)
4. Dedicated IIT Mandi Track A demonstration experience

---

## Phase 1: Repository Audit Results

### Existing Features Status

| Component | Status | Location | Notes |
|-----------|--------|---------|-------|
| **Core Platform** | ✅ IMPLEMENTED | `backend/app/`, `frontend/src/` | FastAPI + React + Three.js |
| **CardioTwin Model** | ✅ IMPLEMENTED | `backend/app/cardiotwin/model.py` | L2 logistic regression, 4 targets (CAD, LAD, LCX, RCA) |
| **3D Visualization** | ✅ IMPLEMENTED | `frontend/src/cardiotwin/core__src_cardiotwin__HeartViewer.tsx` | Interactive coronary arteries with probability color coding |
| **API Endpoints** | ✅ IMPLEMENTED | `backend/app/api/cardiotwin.py` | predict, counterfactual, sensitivity, evaluation |
| **EHR Integration** | ✅ IMPLEMENTED | `backend/app/cardiotwin/schema.py` | 54 clinical features across 6 groups |
| **Explainability** | ✅ IMPLEMENTED | `frontend/src/cardiotwin/core__src_cardiotwin__panels.tsx` | Feature attribution, evidence panels |
| **FHIR Interop** | ✅ IMPLEMENTED | `backend/app/interop/`, `backend/app/cardiotwin/interop/` | FHIR R4, OAH constraints |
| **Evaluation** | ✅ IMPLEMENTED | `backend/app/cardiotwin/core__app_cardiotwin__evaluation.py` | Cross-validation, AUC, calibration |
| **Anatomy Viewer** | ✅ IMPLEMENTED | `frontend/src/cardiotwin/intelligence/core__cardiotwin_intelligence__AnatomyViewer.tsx` | 16 selectable structures |
| **Atlas Module** | ✅ IMPLEMENTED | `backend/app/cardiotwin/atlas/` | Evidence fusion, provenance graph |
| **Hemo Twin** | ✅ IMPLEMENTED | `backend/app/cardiotwin/hemodynamics/` | Longitudinal cardiovascular state |
| **Guideline Engine** | ✅ IMPLEMENTED | `backend/app/cardiotwin/guideline_engine.py` | Clinical guideline verification |
| **Counterfactual** | ✅ IMPLEMENTED | Both backend and frontend | What-if simulation |

### Model Performance (Existing)

- **Dataset:** Extension of Z-Alizadeh Sani (UCI #411), 303 records
- **Targets:** CAD, LAD, LCX, RCA (angiographic labels)
- **Model:** L2-regularized logistic regression with bootstrap ensemble
- **Calibration:** Platt scaling per target
- **Metrics:** AUROC reported per target with 95% CI
- **Attribution:** Exact additive attribution (linear model)
- **Uncertainty:** Bootstrap ensemble (10th-90th percentile intervals)
- **OOD Detection:** Mahalanobis distance to training cohort

### 3D Visualization Capabilities

- ✅ Interactive heart model with coronary arteries (LAD, LCX, RCA)
- ✅ Probability-based color coding (low/intermediate/elevated bands)
- ✅ Confidence-based outline strength
- ✅ Uncertainty-based halo (bootstrap interval width)
- ✅ Selectable vessels with labels
- ✅ Camera controls (rotate, zoom, pan)
- ✅ Reset view functionality
- ✅ WebGL fallback handling
- ✅ Performance optimization (frameloop="demand", capped DPR)

---

## Phase 2: Gap Analysis vs IIT Mandi Track A Requirements

### Required Features vs Current State

| IIT Mandi Track A Requirement | Current State | Gap | Priority |
|--------------------------------|---------------|-----|----------|
| Real CAD prediction model with evaluation | ✅ Full implementation | None | - |
| Interactive 3D human body and coronary heart | ✅ 3D heart with coronaries | Add human body context | Medium |
| Multimodal fusion: EHR + ECG + imaging | ⚠️ Partial (EHR only) | Add ECG signal + imaging | **Critical** |
| Historical + live wearable digital twin | ❌ Not implemented | Full implementation needed | **Critical** |
| Explainable risk and evidence provenance | ✅ Full implementation | None | - |
| Personalized what-if simulation | ✅ Counterfactual implemented | Enhance to full simulation engine | High |
| Multilingual clinician workflow | ❌ Not implemented | Add i18n support | Medium |

### Detailed Gap Analysis

#### 1. ECG Signal Processing (CRITICAL)
**Current:** Only accepts ECG-derived flags (Q Wave, ST Elevation/Depression, T-wave inversion, LVH, BBB) as binary/categorical features.

**Required:** 
- Raw ECG signal ingestion (Lead II, 12-lead)
- Signal feature extraction (heart rate, intervals, segments)
- Arrhythmia detection (AF, VT, Bradycardia)
- Ischemia detection (ST deviations)
- Integration with tabular model

**Implementation Plan:**
```
backend/app/cardiotwin/ecg/
  ├── __init__.py
  ├── signals.py        # Raw signal processing
  ├── features.py       # Feature extraction
  ├── models.py         # ECG-specific models
  └── api.py            # ECG analysis endpoints
```

#### 2. Wearable Digital Twin (CRITICAL)
**Current:** Static EHR data only. OncoTwin has time-series simulation but not for cardiology.

**Required:**
- Real-time wearable data streaming (HR, HRV, activity, SpO2)
- Longitudinal patient state
- Time-aligned predictions
- Historical replay
- Anomaly detection

**Implementation Plan:**
```
backend/app/cardiotwin/wearables/
  ├── __init__.py
  ├── models.py         # Wearable data models
  ├── streaming.py      # Real-time data handling
  ├── fusion.py         # EHR + wearable fusion
  └── api.py            # Wearable endpoints
```

#### 3. Enhanced Multimodal Fusion (CRITICAL)
**Current:** Tabular features only, no raw signal or image integration.

**Required:**
- Multimodal input handling (EHR + ECG + wearable + imaging)
- Missing modality handling
- Weighted fusion of predictions
- Uncertainty propagation

**Implementation Plan:**
```
backend/app/cardiotwin/multimodal/
  ├── __init__.py
  ├── fusion.py          # Multimodal fusion engine
  ├── core__cardiotwin_multimodal__ensemble.py        # Model ensemble
  └── api.py            # Multimodal endpoints
```

#### 4. IIT Mandi Track A Demo Experience (CRITICAL)
**Current:** General CardioTwin workspace exists.

**Required:**
- Focused Track A demonstration flow
- Synthetic patient scenarios
- Step-by-step guided experience
- Competition-ready UI/UX

**Implementation Plan:**
```
frontend/src/routes/IIT_Mandi_TrackA.tsx
backend/app/api/iit_mandi.py
```

---

## Phase 3: Implementation Roadmap

### Week 1 (Oct 11-13): Foundation

#### Day 1 (Oct 11): ECG Signal Processing
- [ ] Create `backend/app/cardiotwin/ecg/` module
- [ ] Implement ECG signal feature extraction
- [ ] Add ECG-specific prediction model
- [ ] Create ECG analysis API endpoints
- [ ] Test with synthetic ECG data

#### Day 2 (Oct 12): Wearable Integration  
- [ ] Create `backend/app/cardiotwin/wearables/` module
- [ ] Implement wearable data streaming
- [ ] Build wearable feature extraction
- [ ] Add wearable analysis API endpoints
- [ ] Test with synthetic wearable data

#### Day 3 (Oct 13): Multimodal Fusion
- [ ] Create `backend/app/cardiotwin/multimodal/` module
- [ ] Implement fusion engine (EHR + ECG + wearable)
- [ ] Add ensemble prediction
- [ ] Create multimodal API endpoints
- [ ] Test multimodal predictions

### Week 2 (Oct 14-15): Integration & Submission

#### Day 4 (Oct 14): IIT Mandi Demo Experience
- [ ] Create dedicated Track A frontend route
- [ ] Build synthetic patient scenarios
- [ ] Implement guided demonstration flow
- [ ] Add competition-specific UI elements
- [ ] Test end-to-end experience

#### Day 5 (Oct 15): Polish & Submission
- [ ] Run comprehensive tests
- [ ] Fix any regressions
- [ ] Prepare submission materials
- [ ] Create demonstration script
- [ ] Submit before 00:15 IST

---

## Phase 4: Technical Architecture

### New Directory Structure

```
backend/app/cardiotwin/
├── __init__.py
├── model.py              # Existing - tabular CAD model
├── schema.py            # Existing - feature definitions
├── training.py          # Existing - model training
├── ecg/                # NEW - ECG signal processing
│   ├── __init__.py
│   ├── signals.py        # Signal processing utilities
│   ├── features.py       # ECG feature extraction
│   ├── models.py         # ECG-specific models
│   └── api.py            # ECG API endpoints
├── wearables/           # NEW - Wearable integration
│   ├── __init__.py
│   ├── models.py         # Wearable data models
│   ├── streaming.py      # Real-time streaming
│   ├── fusion.py         # EHR + wearable fusion
│   └── api.py            # Wearable API endpoints
├── multimodal/          # NEW - Multimodal fusion
│   ├── __init__.py
│   ├── fusion.py          # Multimodal fusion engine
│   ├── core__cardiotwin_multimodal__ensemble.py        # Model ensemble
│   └── api.py            # Multimodal API endpoints
└── iit_mandi/           # NEW - Track A specific
    ├── __init__.py
    ├── scenarios.py       # Synthetic patient scenarios
    ├── demo.py           # Demo orchestration
    └── api.py            # Track A API endpoints

frontend/src/routes/
├── CardioTwin.tsx       # Existing - main CardioTwin
├── IIT_Mandi_TrackA.tsx # NEW - Track A demo
└── ...
```

### API Endpoints to Add

#### ECG Analysis
- `POST /api/v1/cardiotwin/ecg/analyze` - Analyze raw ECG signal
- `POST /api/v1/cardiotwin/ecg/features` - Extract ECG features
- `GET /api/v1/cardiotwin/ecg/capabilities` - List ECG capabilities

#### Wearable Integration
- `POST /api/v1/cardiotwin/wearables/stream` - Ingest wearable data
- `GET /api/v1/cardiotwin/wearables/timeline` - Get wearable timeline
- `POST /api/v1/cardiotwin/wearables/anomalies` - Detect anomalies

#### Multimodal Fusion
- `POST /api/v1/cardiotwin/multimodal/predict` - Multimodal prediction
- `POST /api/v1/cardiotwin/multimodal/fusion` - Fusion with missing modalities
- `GET /api/v1/cardiotwin/multimodal/status` - Fusion status

#### IIT Mandi Track A
- `GET /api/v1/iit_mandi/scenarios` - List synthetic scenarios
- `GET /api/v1/iit_mandi/scenarios/{id}` - Get specific scenario
- `POST /api/v1/iit_mandi/demonstration` - Run demo sequence

---

## Phase 5: Data Requirements

### Synthetic Data Generation

All data must be synthetic or appropriately licensed. We will:

1. **ECG Data:** Generate synthetic ECG signals using:
   - Normal sinus rhythm
   - Atrial fibrillation patterns
   - Ventricular tachycardia patterns
   - ST elevation/depression scenarios
   - Various heart rates (30-200 bpm)

2. **Wearable Data:** Generate synthetic time-series:
   - Heart rate (40-200 bpm)
   - HRV (RMSSD, SDNN)
   - Activity levels
   - SpO2 (90-100%)
   - Steps
   - Sleep stages

3. **Patient Scenarios:** Create 5-10 synthetic patients:
   - Different risk profiles
   - Various combinations of modalities
   - Progressive disease scenarios
   - Treatment response scenarios

---

## Phase 6: Verification Checklist

### Unit Tests
- [ ] ECG signal processing tests
- [ ] Wearable data processing tests
- [ ] Multimodal fusion tests
- [ ] New API endpoint tests
- [ ] Integration tests

### Integration Tests
- [ ] End-to-end Track A demonstration
- [ ] Multimodal prediction flow
- [ ] Wearable streaming flow
- [ ] ECG analysis flow

### Regression Tests
- [ ] Existing CardioTwin functionality unchanged
- [ ] Existing OncoTwin functionality unchanged
- [ ] All existing API endpoints functional
- [ ] All existing tests passing

### Performance Tests
- [ ] ECG processing < 100ms per signal
- [ ] Wearable streaming < 50ms per data point
- [ ] Multimodal prediction < 200ms
- [ ] 3D rendering < 16ms per frame

---

## Phase 7: Submission Materials

### Required Deliverables

1. **Code Repository** (this repo)
   - All new code committed
   - All tests passing
   - No breaking changes

2. **Demonstration Environment**
   - Local docker-compose setup
   - Pre-loaded synthetic scenarios
   - One-command demo launch

3. **Documentation**
   - README updates
   - Architecture diagram
   - Implementation notes
   - Limitations statement

4. **Presentation**
   - 5-minute demo script
   - Slide deck (if required)
   - Technical appendix

---

## Risk Mitigation

### Technical Risks
1. **ECG Processing Complexity:** Mitigate by using existing libraries (biosppy, neurokit2) or implementing simplified versions
2. **Wearable Data Volume:** Mitigate by implementing efficient streaming with sampling
3. **Performance:** Mitigate by lazy loading, caching, and async processing
4. **Integration Issues:** Mitigate by thorough unit and integration testing

### Timeline Risks
1. **Deadline Pressure:** Focus on MVP first (ECG + wearable basics), then enhance
2. **Bug Discovery:** Allocate 20% of time for bug fixing
3. **Testing:** Continuous testing throughout, not just at the end

### Quality Risks
1. **Over-engineering:** Keep features focused on Track A requirements
2. **Scope creep:** Strictly prioritize critical features first
3. **Technical debt:** All new code follows existing patterns and conventions

---

## Next Steps

1. **Immediate (Today):**
   - Create ECG module skeleton
   - Create wearable module skeleton
   - Create multimodal module skeleton
   - Update todo list with specific tasks

2. **This Week:**
   - Implement ECG signal processing
   - Implement wearable streaming
   - Implement multimodal fusion
   - Create Track A demo page

3. **Next Week:**
   - Integration testing
   - Polish and optimization
   - Submission preparation

---

*Document version: 1.0  
*Last updated: 2026-10-11  
*Author: Implementation Team*
