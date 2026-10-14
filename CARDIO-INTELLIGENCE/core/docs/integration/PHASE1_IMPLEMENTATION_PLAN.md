# Phase 1: Source-Code Inheritance Engine - Implementation Plan

## Overview

**Phase:** 1 - Source-Code Inheritance Engine
**Status:** IN PROGRESS
**Start Date:** 2026-10-11
**Priority:** CRITICAL

This document outlines the concrete implementation steps for Phase 1, which focuses on extracting, adapting, and integrating code from the **3 APPROVED projects** (case-twin-main, heartAI-main, SlicerHeart-master) into CardioTwin.

---

## Phase 1 Objectives

1. **Extract** reusable capabilities from approved projects
2. **Adapt** domain-specific behavior for cardiovascular use cases
3. **Integrate** into CardioTwin's existing architecture
4. **Create** the canonical CardiacCase domain model
5. **Build** the foundation for the Cardiac Evidence Continuity Engine

---

## Approved Projects Summary

### 1. heartAI-main (MIT License)

**Cardiovascular Value:** HIGH - Direct cardiac imaging and analysis

**Capabilities to Extract:**
- ✅ NIfTI medical imaging file processing
- ✅ 3D CNN + Transformer embedding generation
- ✅ MONAI-based preprocessing (Resize, ScaleIntensity, ToTensor)
- ✅ Vespa vector search integration
- ✅ FastAPI backend with upload/search endpoints
- ✅ React/Next.js frontend components:
  - ECGViewer with pan/zoom/markers
  - ComparisonViewer with measurement tools
  - ResultsDashboard with AI explanation
  - Upload page with drag-and-drop
  - Heart 3D visualization component
- ✅ Diagnosis system using Perplexity AI
- ✅ Clinical context extraction from images

**Integration Strategy:**
- **Backend:** Extract embedding generation, Vespa integration, and API endpoints
- **Frontend:** Extract and adapt React components for CardioTwin UI
- **Domain Model:** Map to CardiacCase ImagingStudy and CardiacSegmentation entities

### 2. case-twin-main (MIT License)

**Cardiovascular Value:** HIGH - Adaptable similar case retrieval

**Capabilities to Extract:**
- ✅ MedSiglip medical image embedding
- ✅ Qdrant vector database integration
- ✅ Hybrid search (visual + contextual)
- ✅ Case profile extraction and matching
- ✅ CrewAI multi-agent orchestration
- ✅ FastAPI backend with search/extract endpoints
- ✅ React frontend with case comparison

**Integration Strategy:**
- **Backend:** Extract vector search, hybrid matching, and agent orchestration
- **Frontend:** Extract case comparison and retrieval UI
- **Domain Model:** Map to CardiacCase EvidenceArtifact and AgentExecution entities

### 3. SlicerHeart-master (BSD 3-Clause License)

**Cardiovascular Value:** HIGH - Advanced cardiac imaging

**Capabilities to Extract:**
- ✅ Echocardiography volume rendering
- ✅ 3D Slicer plugin architecture
- ✅ Cardiac-specific imaging algorithms
- ✅ C++ medical imaging processing
- ✅ MRI and echo processing pipelines

**Integration Strategy:**
- **Wrapper:** Create Python wrapper for C++ plugins
- **Integration:** Connect to CardioTwin imaging pipeline
- **Domain Model:** Map to ImagingStudy and CardiacSegmentation entities

---

## Implementation Roadmap

### Week 1: Foundation and Domain Model

#### Task 1.1: Create Canonical CardiacCase Domain Model
**Priority:** HIGH
**Effort:** Medium
**Dependencies:** None

**Deliverables:**
- `backend/cardiotwin/models/cardiac_case.py` - Domain entities
- `backend/cardiotwin/models/evidence.py` - Evidence tracking
- `backend/cardiotwin/models/agent.py` - Agent execution model

**Entities to Define:**
```python
# Core Domain Entities
- Patient (FHIR-aligned)
- CardiacCase
- ClinicalEncounter
- ClinicalObservation
- ECGStudy
- ImagingStudy
- DiagnosticReport
- CardiacSegmentation
- DigitalTwinInstance
- SimulationRun
- ModelInference
- EvidenceArtifact
- AgentExecution
- ClinicalReview
- FollowUpTask
- AuditEvent
```

#### Task 1.2: Extract heartAI-main Backend
**Priority:** HIGH
**Effort:** Medium
**Dependencies:** Task 1.1

**Subtasks:**
1. Extract `embeddings.py` → `cardiotwin/services/imaging_embedding.py`
2. Extract Vespa integration → `cardiotwin/services/vector_search.py`
3. Extract FastAPI endpoints → `cardiotwin/api/imaging_routes.py`
4. Add license attribution headers

**Adaptations Needed:**
- Change from chest X-ray to cardiac imaging focus
- Update data schemas for cardiovascular context
- Integrate with canonical CardiacCase model

#### Task 1.3: Extract case-twin-main Backend
**Priority:** HIGH
**Effort:** Medium
**Dependencies:** Task 1.1, Task 1.2

**Subtasks:**
1. Extract `qdrant_service.py` → `cardiotwin/services/similar_case_search.py`
2. Extract hybrid matching logic → `cardiotwin/services/case_matching.py`
3. Extract agent orchestration → `cardiotwin/agents/case_twin_agents.py`
4. Extract FastAPI endpoints → `cardiotwin/api/case_routes.py`

**Adaptations Needed:**
- Change from chest X-ray to cardiac imaging
- Update case profile schema for cardiovascular
- Integrate with CardiacCase domain model

### Week 2: Frontend Integration

#### Task 2.1: Extract heartAI-main Frontend Components
**Priority:** HIGH
**Effort:** Medium
**Status:** ✅ COMPLETED 2026-10-11

**Subtasks:**
1. ✅ Extract `ECGViewer.tsx` → `frontend/src/cardiotwin/cardiac/ECGViewer.tsx`
2. ✅ Extract `ComparisonViewer.tsx` → `frontend/src/cardiotwin/cardiac/ImagingComparison.tsx`
3. ✅ Extract `ResultsDashboard.tsx` → `frontend/src/cardiotwin/cardiac/AnalysisDashboard.tsx`
4. ✅ Extract `Heart.tsx` → `frontend/src/cardiotwin/cardiac/HeartVisualization.tsx`
5. ✅ Extract `upload/page.tsx` → `frontend/src/cardiotwin/cardiac/ImagingUpload.tsx`
6. ✅ Extract `results/page.tsx` → `frontend/src/cardiotwin/cardiac/AnalysisResults.tsx`
7. ✅ Extract `FeedbackForm.tsx` → `frontend/src/cardiotwin/cardiac/FeedbackForm.tsx`
8. ✅ Create package `frontend/src/cardiotwin/cardiac/core__cardiotwin_cardiac__index.ts` with all exports
9. ✅ Extract types → `frontend/src/cardiotwin/cardiac/core__cardiotwin_cardiac__types.ts`

**Adaptations Completed:**
- ✅ Updated styling to match CardioTwin design system (near-black background, orange accents, geometric styling)
- ✅ Connected to CardioTwin backend endpoints (`/api/cardiotwin/imaging/upload`)
- ✅ Integrated with CardiacCase context and type system
- ✅ Added proper TypeScript types and interfaces
- ✅ Added MIT license headers with attribution to Ethan Tam

#### Task 2.2: Extract case-twin-main Frontend
**Priority:** HIGH
**Effort:** Medium
**Status:** ✅ COMPLETED 2026-10-11

**Subtasks:**
1. ✅ Extract `UploadDropzone.tsx` → `frontend/src/cardiotwin/evidence/UploadDropzone.tsx`
2. ✅ Extract `MatchCard.tsx` → `frontend/src/cardiotwin/evidence/MatchCard.tsx`
3. ✅ Extract `CaseProfileView.tsx` → `frontend/src/cardiotwin/evidence/CaseProfileView.tsx`
4. ✅ Extract types → `frontend/src/cardiotwin/evidence/core__cardiotwin_evidence__types.ts`
5. ✅ Extract UI components → `frontend/src/cardiotwin/ui/` (Badge, Button, Card, utils)

**Adaptations Completed:**
- ✅ Updated styling to match CardioTwin design system (near-black background, orange accents)
- ✅ Adapted case profile types for cardiovascular-specific fields
- ✅ Created comprehensive type definitions for cardiac cases
- ✅ Built reusable UI components for CardioTwin
- ✅ Added MIT license headers with attribution to CaseTwin project

### Week 3: Evidence Continuity Engine Foundation

#### Task 3.1: Create Evidence Graph Model
**Priority:** HIGH
**Effort:** High
**Dependencies:** Task 1.1, Task 1.2, Task 1.3

**Deliverables:**
- `backend/cardiotwin/models/evidence_graph.py` - Graph structure
- `backend/cardiotwin/services/evidence_continuity.py` - Core engine

**Capabilities:**
- Temporal consistency checking
- Cross-modality contradiction detection
- Provenance tracking
- Confidence scoring
- State validation for digital twin

#### Task 3.2: Integrate with Existing CardioTwin
**Priority:** HIGH
**Effort:** Medium

**Subtasks:**
1. Connect to existing CardioTwin backend (FastAPI)
2. Connect to existing CardioTwin frontend (React)
3. Ensure compatibility with existing database
4. Add migration scripts if needed

---

## File Structure - New Integration

```
cardiotwin/
├── backend/
│   ├── cardiotwin/
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── cardiac_case.py          # Canonical domain model
│   │   │   ├── evidence.py              # Evidence tracking
│   │   │   ├── agent.py                 # Agent execution model
│   │   │   └── imaging.py               # Imaging-specific models
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── imaging_embedding.py     # From heartAI-main
│   │   │   ├── vector_search.py         # From heartAI-main/case-twin
│   │   │   ├── case_matching.py          # From case-twin-main
│   │   │   ├── similar_case_search.py   # From case-twin-main
│   │   │   └── evidence_continuity.py    # NEW: Core engine
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── cardiac_agents.py        # From case-twin-main agents
│   │   │   └── orchestration.py         # Agent orchestrator
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── imaging_routes.py        # From heartAI-main
│   │       ├── case_routes.py           # From case-twin-main
│   │       └── evidence_routes.py        # NEW: Evidence endpoints
│   └── tests/
│       ├── test_imaging_embedding.py
│       ├── test_case_matching.py
│       └── test_evidence_continuity.py
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── cardiac/
    │   │   │   ├── ECGViewer.tsx         # From heartAI-main
    │   │   │   ├── ImagingComparison.tsx # From heartAI-main
    │   │   │   ├── AnalysisDashboard.tsx # From heartAI-main
    │   │   │   ├── HeartVisualization.tsx # From heartAI-main
    │   │   │   └── CaseComparison.tsx    # From case-twin-main
    │   │   └── ...
    │   ├── types/
    │   │   └── cardiac.ts               # From heartAI-main
    │   └── pages/
    │       ├── cases/
    │       │   └── [caseId]/
    │       │       ├── imaging.tsx
    │       │       ├── evidence.tsx
    │       │       └── analysis.tsx
    │       └── ...
    └── ...
```

---

## Extract-Adapt-Integrate Matrix

### heartAI-main Extraction

| Source File | Destination | Adaptation | Integration Points |
|------------|-------------|------------|-------------------|
| `api2/embeddings.py` | `services/imaging_embedding.py` | Change for cardiac | Embedding generation service |
| `api2/main.py` | `api/imaging_routes.py` | Update schemas | FastAPI endpoints |
| `api2/smart_diagnosis.py` | `services/cardiac_diagnosis.py` | Cardio-specific prompts | Diagnosis service |
| `web/src/app/components/ECGViewer.tsx` | `components/cardiac/ECGViewer.tsx` | Style updates | ECG display |
| `web/src/app/components/ComparisonViewer.tsx` | `components/cardiac/ImagingComparison.tsx` | Rename, style | Image comparison |
| `web/src/app/components/ResultsDashboard.tsx` | `components/cardiac/AnalysisDashboard.tsx` | Update for cardiac | Analysis display |
| `web/src/app/components/Heart.tsx` | `components/cardiac/HeartVisualization.tsx` | Minor updates | 3D heart view |
| `web/types/cmr.ts` | `types/cardiac.ts` | Rename types | Type definitions |

### case-twin-main Extraction

| Source File | Destination | Adaptation | Integration Points |
|------------|-------------|------------|-------------------|
| `backend/qdrant_service.py` | `services/similar_case_search.py` | Change for cardiac | Vector search service |
| `backend/embedding_service.py` | `services/case_embedding.py` | Update for cardiac | Case embedding |
| `backend/agents.py` | `agents/cardiac_agents.py` | Update roles | Multi-agent system |
| `backend/main.py` | `api/case_routes.py` | Update endpoints | API routes |

### SlicerHeart-master Extraction

| Source File | Destination | Adaptation | Integration Points |
|------------|-------------|------------|-------------------|
| C++ plugins | `services/slicer_wrapper.py` | Python wrapper | Imaging processing |
| Various modules | `services/echo_processing.py` | Extract algorithms | Echo analysis |

---

## Testing Strategy

### Unit Tests
1. Test embedding generation with cardiac NIfTI files
2. Test vector search with cardiac case profiles
3. Test evidence graph creation and validation
4. Test temporal consistency checking

### Integration Tests
1. Test end-to-end imaging upload and processing
2. Test similar case retrieval with cardiac images
3. Test evidence continuity detection
4. Test agent orchestration for cardiac workflows

### Regression Tests
1. Ensure existing CardioTwin functionality still works
2. Verify database migrations
3. Check API endpoint compatibility

---

## Success Criteria

### Week 1
- [ ] Canonical domain model defined
- [ ] heartAI-main backend extracted and integrated
- [ ] case-twin-main backend extracted and integrated
- [ ] All code has proper license attribution

### Week 2
- [ ] heartAI-main frontend components extracted and integrated
- [ ] case-twin-main frontend extracted and integrated
- [ ] Components use CardioTwin design system
- [ ] All components connected to backend

### Week 3
- [ ] Evidence Continuity Engine core implemented
- [ ] Integration with existing CardioTwin complete
- [ ] Basic tests passing
- [ ] Documentation updated

---

## Dependencies and Risks

### Technical Dependencies
- FastAPI (already in CardioTwin)
- React + TypeScript (already in CardioTwin)
- MONAI (Medical Open Network for AI) - need to verify if installed
- Qdrant client - need to verify if installed
- Vespa client - optional, can use alternatives

### Risks and Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MONAI not available | Medium | High | Add to requirements, provide fallback |
| Qdrant not available | Medium | High | Use pgvector or ChromaDB as fallback |
| Version conflicts | Medium | Medium | Pin versions, use virtual environments |
| Integration breaks existing functionality | Low | High | Extensive testing, incremental integration |

---

## Next Steps

1. **Start with Task 1.1:** Create the canonical domain model
2. **Parallel:** Begin extracting heartAI-main backend (Task 1.2)
3. **Then:** Extract case-twin-main backend (Task 1.3)
4. **Next:** Begin frontend extraction (Week 2 tasks)
5. **Finally:** Build Evidence Continuity Engine (Week 3 tasks)

---

## Status Tracking

- [x] Task 1.1: Canonical domain model (COMPLETED 2026-10-11)
- [x] Task 1.2: heartAI-main backend extraction (COMPLETED 2026-10-11)
- [x] Task 1.3: case-twin-main backend extraction (COMPLETED 2026-10-11)
- [x] Task 2.1: heartAI-main frontend extraction (COMPLETED 2026-10-11)
- [x] Task 2.2: case-twin-main frontend extraction (COMPLETED 2026-10-11)
- [x] Task 3.1: Evidence Continuity Engine (COMPLETED 2026-10-11)
- [x] Task 3.2: Integration with existing CardioTwin (COMPLETED 2026-10-11)

---

**Document Generated:** 2026-10-11
**Status:** Ready for implementation
**Next Review:** Upon completion of Week 1 tasks
