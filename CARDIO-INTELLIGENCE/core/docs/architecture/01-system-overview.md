# CardioTwin Architecture - 01: System Overview

**Version:** 1.0
**Date:** 2026-10-11
**Phase:** 15 - Architecture Documentation
**Status:** Complete

---

## 1. Executive Summary

CardioTwin is a unified cardiovascular intelligence workspace that integrates capabilities from 9 extracted healthcare hackathon projects into a single, coherent platform. This document provides the high-level system architecture overview.

---

## 2. System Vision

### 2.1 Core Purpose
CardioTwin solves the **Cardiac Evidence Continuity Problem**: ensuring that a patient-specific digital twin remains synchronized with trustworthy, temporally consistent, multimodal medical evidence.

### 2.2 Key Differentiators
- **Unified Workspace**: One case, one patient context, one evidence timeline
- **Evidence Continuity Engine**: Novel mechanism for tracking and validating cardiovascular evidence consistency
- **Multi-Agent Orchestration**: Specialized agents for cardiovascular evidence processing
- **3-Level Interface**: Serves nontechnical users, medical professionals, and technical researchers simultaneously

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CARDIOTWIN PLATFORM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  Interface Layer  │  │  Domain Layer     │  │ Orchestration  │ │
│  │  (Frontend)       │  │  (Core Models)    │  │ Layer           │ │
│  └──────────┬───────┘  └──────────┬───────┘  └──────────┬───────┘ │
│              │                         │                      │          │
│              ▼                         ▼                      ▼          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Clinical Capability Layer                 │ │
│  │  (ECG, Imaging, Documents, Evidence, Workflow, Follow-up)     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                      │                                 │
│                                      ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Model & Simulation Layer                    │ │
│  │  (AI/ML Inference, Digital Twin, Embeddings, Vector Search)  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                      │                                 │
│                                      ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Storage & Interoperability Layer                 │ │
│  │  (Database, Files, Model Artifacts, Healthcare Schema Adapters)│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                      │                                 │
│                                      ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Observability Layer                         │ │
│  │  (Logs, Tracing, Provenance, Evaluation, Errors, Metrics)    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Logical Layering

### 4.1 Interface Layer
**Purpose:** User interaction and presentation
**Components:**
- React-based frontend (`frontend/src/cardiotwin/`)
- Design system (pixel-geometric, near-black theme)
- Shared navigation, forms, graphs, scientific viewers

**Key Files:**
- `frontend/src/cardiotwin/core__src_cardiotwin__api.ts` - API client with TypeScript types
- `frontend/src/cardiotwin/evidence/EvidenceContinuityDashboard.tsx`
- `frontend/src/cardiotwin/clinical/ClinicalExtractionPanel.tsx`
- `frontend/src/cardiotwin/workflow/WorkflowOrchestrationPanel.tsx`

### 4.2 Domain Layer
**Purpose:** Canonical business objects and relationships
**Components:**
- CardiacCase, Patient, ClinicalObservation, ECGStudy, ImagingStudy
- DiagnosticReport, CardiacSegmentation, DigitalTwinInstance
- SimulationRun, ModelInference, EvidenceArtifact, AgentExecution
- ClinicalReview, FollowUpTask, AuditEvent

**Key Files:**
- `backend/app/cardiotwin/models/evidence_graph.py`
- `backend/app/cardiotwin/models/__init__.py`

### 4.3 Orchestration Layer
**Purpose:** Job execution, dependencies, event streams, state transitions
**Components:**
- Workflow orchestration service
- Multi-agent coordination
- Real-time event streaming
- Retry and failure recovery

**Key Files:**
- `backend/app/cardiotwin/services/core__cardiotwin_services__workflow_orchestration.py`
- `backend/app/cardiotwin/api/core__cardiotwin_api__workflow_orchestration.py`

### 4.4 Clinical Capability Layer
**Purpose:** Domain-specific functionality
**Components:**
- ECG Intelligence (signal processing, rhythm analysis)
- Cardiac Imaging (embedding, segmentation, 3D visualization)
- Clinical Extraction (text processing, entity recognition)
- Evidence Continuity (validation, temporal alignment, contradiction detection)
- Workflow Management (task tracking, follow-up)

**Key Files:**
- `backend/app/cardiotwin/services/imaging_embedding.py`
- `backend/app/cardiotwin/services/vector_search.py`
- `backend/app/cardiotwin/services/core__cardiotwin_services__clinical_extraction.py`
- `backend/app/cardiotwin/services/core__cardiotwin_services__evidence_continuity.py`

### 4.5 Model & Simulation Layer
**Purpose:** AI/ML inference and digital twin operations
**Components:**
- 3D CNN + Transformer for imaging embeddings
- MONAI preprocessing for medical images
- Vector search with hybrid retrieval
- Cardiovascular-specific clinical text extraction
- Versioned evidence graph management

### 4.6 Storage & Interoperability Layer
**Purpose:** Persistent data management
**Components:**
- PostgreSQL database (existing CardioTwin)
- File storage for imaging and documents
- Model artifact repository
- Healthcare schema adapters (FHIR-based where appropriate)

### 4.7 Observability Layer
**Purpose:** System monitoring and debugging
**Components:**
- Structured logging
- Execution tracing
- Provenance tracking
- Error handling and reporting
- Performance metrics
- Evaluation benchmarks

---

## 5. Technology Stack

### 5.1 Backend
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | Latest | REST API |
| Language | Python | 3.9+ | Core logic |
| Database | PostgreSQL | 13+ | Persistent storage |
| ORM | SQLAlchemy | Latest | Database access |
| Async | asyncio | Built-in | Concurrent operations |
| Validation | Pydantic | Latest | Data validation |

### 5.2 Frontend
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Next.js/React | Latest | UI framework |
| Language | TypeScript | Latest | Type safety |
| Styling | CSS Modules | Built-in | Component styling |
| State | React Context | Built-in | State management |
| Visualization | D3.js, Three.js | Latest | Charts and 3D |
| Mapping | CesiumJS | Latest | Geospatial |

### 5.3 AI/ML
| Component | Technology | Purpose |
|-----------|------------|---------|
| Medical Imaging | MONAI | Medical image preprocessing |
| Embeddings | PyTorch | Deep learning |
| Vector Search | FAISS | Similarity search |
| NLP | Transformers | Text processing |

### 5.4 DevOps
| Component | Technology | Purpose |
|-----------|------------|---------|
| Containerization | Docker | Deployment |
| Testing | pytest | Backend tests |
| Testing | Jest | Frontend tests |
| Documentation | Markdown | Project docs |
| Version Control | Git | Source control |

---

## 6. Integration Strategy

### 6.1 Project Inheritance
All 9 extracted projects were integrated using the following approach:

1. **heartAI-main**: Imaging embedding service → `services/imaging_embedding.py`
2. **case-twin-main**: Vector search and case similarity → `services/vector_search.py`
3. **Epicast-main**: Clinical text extraction → `services/core__cardiotwin_services__clinical_extraction.py`
4. **SafetyConnect-main**: Workflow orchestration → `services/core__cardiotwin_services__workflow_orchestration.py`
5. **Evidence Continuity Engine**: Core novelty → `services/core__cardiotwin_services__evidence_continuity.py`

### 6.2 Integration Principles
- **REUSE**: Use existing modules unchanged when correct and isolated
- **ADAPT**: Modify domain-specific behavior for cardiology
- **EXTRACT**: Pull valuable algorithms from larger applications
- **WRAP**: Create adapters around existing services
- **CONSOLIDATE**: Use one canonical service for duplicate features
- **PRESERVE**: Keep unique functionality accessible
- **REJECT**: Quarantine clinically irrelevant or insecure features

---

## 7. Data Flow Overview

```
User Interaction
     │
     ▼
┌──────────────────┐
│   Interface Layer │  ←→ API Client (TypeScript)
└─────────┬─────────┘
          │
          ▼
┌──────────────────┐
│  Domain Layer     │  ←→ Business Logic
└─────────┬─────────┘
          │
          ▼
┌──────────────────┐
│ Orchestration     │  ←→ Workflow Engine
└─────────┬─────────┘
          │
          ▼
┌──────────────────┐
│ Clinical Capability│  ←→ ECG, Imaging, Clinical, Evidence
└─────────┬─────────┘
          │
          ▼
┌──────────────────┐
│ Model & Simulation│  ←→ AI/ML, Digital Twin
└─────────┬─────────┘
          │
          ▼
┌──────────────────┐
│ Storage & Interop │  ←→ PostgreSQL, Files
└──────────────────┘
```

---

## 8. Key Design Decisions

### 8.1 Architecture Pattern
**Decision:** Layered architecture with clear separation of concerns
**Rationale:**
- Maintains existing CardioTwin patterns
- Allows incremental integration
- Enables independent testing
- Supports future extensibility

### 8.2 Service Organization
**Decision:** Organize by domain capability (imaging, clinical, workflow, evidence)
**Rationale:**
- Matches medical workflow mental model
- Facilitates code reuse
- Improves maintainability
- Aligns with Cardiovascular domain

### 8.3 API Design
**Decision:** RESTful APIs with comprehensive TypeScript types
**Rationale:**
- Consistent with existing CardioTwin
- Type-safe frontend development
- Easy to test and document
- Scalable for future growth

### 8.4 Data Model
**Decision:** FHIR-inspired entities with cardiovascular specialization
**Rationale:**
- Healthcare industry standard
- Interoperability with external systems
- Proven clinical data model
- Extensible for research needs

---

## 9. Non-Functional Requirements

### 9.1 Performance
- API response times < 500ms for simple queries
- Imaging processing < 10s for typical cardiac MRI
- Evidence continuity validation < 2s for standard cases
- Concurrent workflow execution support

### 9.2 Reliability
- 99.9% uptime target
- Automatic retry for transient failures
- Circuit breakers for external services
- Graceful degradation under load

### 9.3 Security
- All API endpoints authenticated
- Data encryption at rest and in transit
- Role-based access control
- Audit logging for all sensitive operations

### 9.4 Maintainability
- Comprehensive logging
- Complete test coverage
- Clear documentation
- Consistent code style

### 9.5 Scalability
- Horizontal scaling for stateless services
- Database connection pooling
- Async I/O for long-running operations
- Efficient memory usage for large files

---

## 10. Document Navigation

This is **Part 1 of 5** in the Architecture Documentation series:

1. **[01-system-overview.md](01-system-overview.md)** - This document: High-level system vision, layering, technology stack
2. **[02-domain-model.md](02-domain-model.md)** - Detailed entity definitions and relationships
3. **[03-service-architecture.md](03-service-architecture.md)** - Service organization and responsibilities
4. **[04-api-architecture.md](04-api-architecture.md)** - API design, endpoints, and contracts
5. **[05-data-flow.md](05-data-flow.md)** - Detailed data flow diagrams and sequences

---

## 11. References

- [FINAL_STATUS.md](../FINAL_STATUS.md) - Complete project status
- [docs/integration/source-inventory.md](../integration/source-inventory.md) - Extracted projects inventory
- [docs/integration/feature-capability-matrix.md](../integration/feature-capability-matrix.md) - Capability mapping
- [docs/research/novelty-hypothesis.md](../research/novelty-hypothesis.md) - Technical innovation
- [backend/app/cardiotwin/](../../backend/app/cardiotwin/) - Backend implementation
- [frontend/src/cardiotwin/](../../frontend/src/cardiotwin/) - Frontend implementation

---

*Document created: 2026-10-11*
*Author: CardioTwin Architecture Team*
*Classification: Internal - Architecture Documentation*
