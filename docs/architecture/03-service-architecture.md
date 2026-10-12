# CardioTwin Architecture - 03: Service Architecture

**Version:** 1.0
**Date:** 2026-10-11
**Phase:** 15 - Architecture Documentation
**Status:** Complete

---

## 1. Service Organization

CardioTwin follows a **modular service architecture** where each service encapsulates a specific cardiovascular capability. Services are organized under `backend/app/cardiotwin/services/` and expose their functionality through API routers under `backend/app/cardiotwin/api/`.

---

## 2. Service Directory Structure

```
backend/app/cardiotwin/
├── __init__.py                    # Package exports
├── api/                           # API routers
│   ├── __init__.py
│   ├── clinical_extraction.py     # Epicast-main integration
│   ├── evidence_continuity.py     # Core novelty service
│   ├── imaging.py                 # heartAI-main integration
│   ├── case_routes.py              # case-twin-main integration
│   └── workflow_orchestration.py  # SafetyConnect-main integration
│
├── models/                        # Data models
│   ├── __init__.py
│   └── evidence_graph.py           # Evidence graph model
│
├── services/                     # Service implementations
│   ├── __init__.py
│   ├── clinical_extraction.py     # Clinical text extraction
│   ├── evidence_continuity.py     # Evidence continuity engine
│   ├── imaging_embedding.py       # Medical imaging embeddings
│   ├── vector_search.py            # Vector similarity search
│   └── workflow_orchestration.py  # Multi-agent workflow orchestration
│
└── tests/                        # Test suites
    ├── __init__.py
    └── test_evidence_continuity.py
```

---

## 3. Service Inventory

### 3.1 Imaging Embedding Service

**Origin:** heartAI-main project
**Purpose:** Generate embeddings from medical imaging data (DICOM, NIfTI) for similarity search and analysis

**Capabilities:**
- NIfTI and DICOM file processing
- 3D CNN + Transformer-based embedding generation
- MONAI-powered medical image preprocessing
- Multi-file batch processing
- Quality validation

**Implementation:**
- File: `backend/app/cardiotwin/services/imaging_embedding.py`
- Lines: 400+
- Dependencies: MONAI, PyTorch, NumPy

**API Router:**
- File: `backend/app/cardiotwin/api/imaging.py`
- Endpoints: 4 (POST /generate, POST /upload, GET /status/{task_id}, GET /health)

**Key Classes:**
```python
class ImagingEmbeddingService:
    - generate_embedding(file_path, modality, preprocessing_config)
    - upload_and_process(file, metadata)
    - get_status(task_id)
    - health_check()

class ImagingPreprocessor:
    - load_nifti(file_path)
    - load_dicom(file_path)
    - normalize_volume(volume)
    - resize_volume(volume, target_size)
    - apply_monai_transforms(volume, transforms)

class EmbeddingModel:
    - 3D CNN + Transformer architecture
    - Supports cardiac MRI, CT, ultrasound
    - Output dimension: 512
```

**Integration Points:**
- Used by: Vector Search Service, Evidence Continuity Engine
- Input: Medical imaging files (DICOM, NIfTI)
- Output: Embedding vectors + metadata

---

### 3.2 Vector Search Service

**Origin:** case-twin-main project
**Purpose:** Efficient similarity search across cardiac cases using vector embeddings

**Capabilities:**
- High-dimensional vector search (512D embeddings)
- Hybrid search (vector + metadata filters)
- MedSigLIP-inspired architecture
- Index management and optimization
- Batch search operations

**Implementation:**
- File: `backend/app/cardiotwin/services/vector_search.py`
- Lines: 600+
- Dependencies: FAISS, NumPy

**API Router:**
- File: `backend/app/cardiotwin/api/case_routes.py`
- Endpoints: 5 (POST /search, GET /cases/{case_id}/similar, POST /compare, GET /cases/{case_id}, GET /health)

**Key Classes:**
```python
class VectorSearchService:
    - search(query_embedding, top_k=10, filters=None)
    - find_similar_cases(case_id, top_k=10)
    - compare_cases(case_id_1, case_id_2)
    - add_case_to_index(case_data)
    - update_index()
    - get_case_details(case_id)

class VectorIndex:
    - FAISS index management
    - GPU acceleration support
    - Incremental updates
    - Persistence to disk

class HybridSearch:
    - Combine vector similarity with metadata
    - Weighted scoring
    - Cardiovascular-specific filtering
```

**Integration Points:**
- Used by: Evidence Continuity Engine, Clinical Workflow Agent
- Input: Embedding vectors, case metadata
- Output: Similar cases with scores, comparison results

---

### 3.3 Clinical Extraction Service

**Origin:** Epicast-main project
**Purpose:** Extract cardiovascular-specific clinical information from text documents

**Capabilities:**
- Cardiovascular entity recognition
- 25+ ECG findings extraction
- 20+ echocardiography findings extraction
- ICD-10 code extraction
- Medication extraction
- Temporal information extraction
- Context-aware processing

**Implementation:**
- File: `backend/app/cardiotwin/services/clinical_extraction.py`
- Lines: 800+
- Dependencies: Transformers, spaCy (optional)

**API Router:**
- File: `backend/app/cardiotwin/api/clinical_extraction.py`
- Endpoints: 4 (POST /extract, POST /batch, GET /status/{task_id}, GET /health)

**Key Classes:**
```python
class ClinicalExtractionService:
    - extract_from_text(text, extraction_config)
    - batch_extract(documents, config)
    - extract_ecg_findings(text)
    - extract_echo_findings(text)
    - extract_medications(text)
    - extract_icd10_codes(text)
    - get_status(task_id)

class CardiovascularExtractor:
    - ECG findings: 25+ patterns (AFib, VTach, ST-elevation, etc.)
    - Echo findings: 20+ patterns (LVH, wall motion, EF, etc.)
    - Biomarkers: Troponin, BNP, CK-MB, etc.
    - Risk factors: Hypertension, diabetes, smoking, etc.
    - Procedures: PCI, CABG, ablation, etc.

class ExtractionConfig:
    - entity_types to extract
    - confidence_threshold
    - include_context
    - temporal_extraction
    - negation_detection
```

**Supported ECG Findings (25+):**
- Atrial fibrillation, atrial flutter
- Ventricular tachycardia, ventricular fibrillation
- ST-segment elevation/depression
- T-wave abnormalities
- QRS complex abnormalities
- AV block (1st, 2nd, 3rd degree)
- Bundle branch blocks
- P-wave abnormalities
- QT prolongation
- Premature contractions
- Heart rate extremes
- Rhythm irregularities

**Supported Echo Findings (20+):**
- Left ventricular hypertrophy
- Wall motion abnormalities
- Ejection fraction
- Valvular abnormalities
- Chamber dimensions
- Pericardial effusion
- Diastolic dysfunction
- Systolic dysfunction

**Integration Points:**
- Used by: Evidence Continuity Engine, Clinical Workflow Agent
- Input: Clinical notes, reports, text documents
- Output: Structured clinical observations, findings, codes

---

### 3.4 Workflow Orchestration Service

**Origin:** SafetyConnect-main project
**Purpose:** Coordinate multi-agent, multi-stage cardiovascular workflows

**Capabilities:**
- Event-driven workflow execution
- Multi-stage pipeline orchestration
- Real-time event streaming
- Dependency management
- Retry and failure recovery
- Traceability and audit logging
- Human review gates

**Implementation:**
- File: `backend/app/cardiotwin/services/workflow_orchestration.py`
- Lines: 600+
- Dependencies: asyncio, FastAPI, Pydantic

**API Router:**
- File: `backend/app/cardiotwin/api/workflow_orchestration.py`
- Endpoints: 9 (POST /workflows, GET /workflows, GET /workflows/{id}, POST /workflows/{id}/start, POST /workflows/{id}/cancel, GET /workflows/{id}/events, GET /workflows/cardiac-case, GET /workflows/{id}/status, GET /health)

**Key Classes:**
```python
class WorkflowOrchestrationService:
    - create_workflow(workflow_definition)
    - get_workflow(workflow_id)
    - start_workflow(workflow_id, inputs)
    - cancel_workflow(workflow_id)
    - get_events(workflow_id, since=None)
    - get_status(workflow_id)
    - cardiac_case_workflow(case_id, inputs)

class WorkflowEngine:
    - Execute multi-stage workflows
    - Manage agent dependencies
    - Handle retries and failures
    - Stream real-time events
    - Maintain execution state

class EventStream:
    - Real-time event broadcasting
    - Event history
    - Event filtering
    - WebSocket support

class WorkflowState:
    - Track workflow progress
    - Manage stage transitions
    - Validate preconditions
    - Store execution context
```

**Workflow Types:**

1. **Cardiac Case Workflow** (10 stages):
   - CASE_CREATED → DATA_INGESTED → QUALITY_CHECKED → PHYSIOLOGICAL_SIGNALS_ANALYZED → IMAGING_CONNECTED → EVIDENCE_RECONCILED → DIGITAL_TWIN_UPDATED → AGENTS_EXECUTED → CLINICIAN_REVIEWED → FOLLOW_UP_TRACKED

2. **Evidence Continuity Workflow** (3 stages):
   - EVIDENCE_COLLECTED → CONSISTENCY_VALIDATED → DIGITAL_TWIN_SYNCED

3. **Imaging Analysis Workflow** (5 stages):
   - IMAGE_UPLOADED → PREPROCESSED → EMBEDDING_GENERATED → SIMILAR_CASES_FOUND → REPORT_GENERATED

**Agent Types (8):**
1. Signal Intelligence Agent - ECG and physiological signals
2. Imaging Intelligence Agent - Cardiac imaging analysis
3. Evidence Agent - Clinical evidence retrieval and validation
4. Consistency Agent - Cross-modality consistency checking
5. Simulation Agent - Digital twin simulation coordination
6. Clinical Workflow Agent - Clinical workflow tracking
7. Verification Agent - Output validation and verification
8. Orchestrator - Multi-agent orchestration

**Integration Points:**
- Used by: All other services (for coordination)
- Input: Workflow definitions, inputs, triggers
- Output: Execution results, events, status updates

---

### 3.5 Evidence Continuity Service (NOVELTY CORE)

**Origin:** CardioTwin core innovation
**Purpose:** Maintain and validate temporal consistency of cardiovascular evidence across modalities

**Capabilities:**
- Versioned evidence graph construction
- Temporal alignment validation
- Cross-modality contradiction detection
- Constraint checking (cardiovascular-specific)
- Provenance tracking across pipeline
- Uncertainty propagation
- Digital twin synchronization validation
- Inconsistency detection and flagging

**Implementation:**
- File: `backend/app/cardiotwin/services/evidence_continuity.py`
- Lines: 1,200+
- Dependencies: NetworkX, NumPy, Pydantic

**API Router:**
- File: `backend/app/cardiotwin/api/evidence_continuity.py`
- Endpoints: 17 endpoints across:
  - Graph management (create, get, update, delete, list)
  - Node management (add, update, delete, get)
  - Edge management (add, update, delete)
  - Validation (validate, detect_inconsistencies)
  - Detection (temporal_misalignment, cross_modality_contradictions, outdated_simulations)
  - Digital twin sync (sync, validate_sync, get_sync_status)
  - Health check

**Key Classes:**
```python
class EvidenceContinuityEngine:
    # Core engine orchestrating all continuity operations
    - create_graph(case_id)
    - add_node(graph_id, node_data)
    - add_edge(graph_id, edge_data)
    - validate_graph(graph_id)
    - detect_inconsistencies(graph_id)
    - sync_digital_twin(twin_id, graph_id)

class TemporalAlignmentEngine:
    # Validates temporal relationships between evidence
    - check_temporal_consistency(graph)
    - detect_timing_misalignments(graph)
    - validate_observation_order(graph)
    - check_evidence_freshness(graph)

class ConstraintCheckingEngine:
    # Validates cardiovascular-specific constraints
    - check_physiological_constraints(graph)
    - validate_cardiac_measurements(graph)
    - check_cross_modality_consistency(graph)
    - validate_clinical_plausibility(graph)

class ProvenanceTracker:
    # Tracks data lineage and origins
    - record_provenance(node_id, source_info)
    - get_provenance_chain(node_id)
    - validate_provenance(graph)
    - detect_orphaned_evidence(graph)

class UncertaintyPropagator:
    # Propagates uncertainty through evidence relationships
    - calculate_uncertainty(node)
    - propagate_uncertainty(graph)
    - combine_uncertainties(nodes)
    - get_confidence_scores(graph)

class DigitalTwinSync:
    # Validates and synchronizes digital twin with evidence
    - validate_sync(twin_id, graph_id)
    - detect_sync_issues(twin_id, graph_id)
    - mark_for_revalidation(twin_id)
    - get_sync_status(twin_id)
```

**Evidence Node Types (10):**
1. ecg_observation - ECG measurement or finding
2. imaging_observation - Imaging measurement or finding
3. clinical_observation - Clinical measurement or finding
4. diagnostic_report - Formal clinical report
5. model_inference - AI model prediction or inference
6. digital_twin_state - Digital twin state snapshot
7. clinical_review - Clinician review decision
8. follow_up_task - Follow-up task or requirement
9. cardiac_segmentation - Anatomical segmentation result
10. simulation_run - Simulation result

**Relationship Types (8):**
1. observed_at - Observation occurred at this time
2. derived_from - Derived from source evidence
3. supports - Supports the target evidence
4. contradicts - Contradicts the target evidence
5. supersedes - Supersedes previous evidence
6. requires_review - Requires human review
7. generated_by - Generated by this process/model
8. belongs_to_case - Belongs to this case

**Integration Points:**
- **Central Integration Hub**: Used by all other services
- Input: Evidence from all modalities (ECG, imaging, clinical, AI, digital twin)
- Output: Validated evidence graph, inconsistency reports, sync status

---

## 4. Service Dependencies

### 4.1 Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    Service Dependencies                     │
├─────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐     ┌──────────────────┐          │
│  │ Evidence Continuity│     │   Workflow        │          │
│  │      Service      │◄────│ Orchestration     │          │
│  └─────────┬─────────┘     └─────────┬─────────┘          │
│            │                         │                       │
│            │          ┌──────────────┴──────────────┐        │
│            │          │                             │        │
│            ▼          ▼                             ▼        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐ │
│  │ Imaging          │ │ Clinical          │ │ Vector       │ │
│  │ Embedding        │ │ Extraction        │ │ Search       │ │
│  └──────────────────┘ └──────────────────┘ └─────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    External Dependencies                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │ PostgreSQL│ │ Redis     │ │ MONAI    │ │ FAISS    │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Service Dependency Matrix

| Service | Clinical Extraction | Imaging Embedding | Vector Search | Workflow Orch. | Evidence Continuity | DB |
|---------|-------------------|------------------|--------------|----------------|-------------------|----|
| Clinical Extraction | - | No | No | No | Yes | Yes |
| Imaging Embedding | No | - | No | No | Yes | Yes |
| Vector Search | No | Yes | - | No | Yes | Yes |
| Workflow Orchestration | No | No | No | - | Yes | Yes |
| Evidence Continuity | Yes | Yes | Yes | Yes | - | Yes |

**Key:**
- `-` = Self
- `Yes` = Direct dependency
- `No` = No direct dependency

### 4.3 Dependency Details

**Evidence Continuity Service Dependencies:**
- **Imaging Embedding Service**: For processing imaging evidence into embeddings
- **Vector Search Service**: For finding similar cases and evidence
- **Clinical Extraction Service**: For processing clinical text into structured observations
- **Workflow Orchestration Service**: For coordinating multi-agent validation workflows
- **Database**: PostgreSQL for persistent storage of evidence graphs

**Workflow Orchestration Service Dependencies:**
- **Evidence Continuity Service**: For evidence validation tasks
- **All other services**: As agents within orchestrated workflows
- **Database**: PostgreSQL for workflow state persistence

**Vector Search Service Dependencies:**
- **Imaging Embedding Service**: For generating embeddings to index
- **Database**: For storing case metadata

---

## 5. Service Communication

### 5.1 Communication Patterns

**1. Direct Function Calls (In-Process)**
- Used for: Services within same Python process
- Latency: <1ms
- Example: EvidenceContinuityService calling ClinicalExtractionService

**2. REST API (HTTP/JSON)**
- Used for: External clients, frontend, other systems
- Latency: 10-100ms
- Example: Frontend calling Evidence Continuity API

**3. Event Streaming (WebSocket/SSE)**
- Used for: Real-time workflow progress updates
- Latency: <10ms
- Example: Workflow engine streaming execution events

**4. Database Polling**
- Used for: Status checks, async operation results
- Latency: 10-500ms
- Example: Checking workflow completion status

### 5.2 API Design Principles

All services follow consistent API design:

1. **RESTful Endpoints**: Standard HTTP methods (GET, POST, PUT, DELETE)
2. **Consistent Responses**: Standardized response format
3. **Error Handling**: HTTP status codes + error details
4. **Type Safety**: Pydantic models for validation
5. **Pagination**: For list endpoints
6. **Filtering**: Query parameters for filtering
7. **Sorting**: Order by fields
8. **Async Support**: Background task execution

### 5.3 Response Format

```json
{
  "status": "success|error",
  "data": { ... },          // Main response data
  "meta": {                 // Metadata
    "timestamp": "ISO8601",
    "request_id": "UUID",
    "duration_ms": 123,
    "version": "1.0.0"
  },
  "error": null            // Error details (if status=error)
}
```

---

## 6. Service Configuration

### 6.1 Configuration Management

All services use consistent configuration:

```python
# Configuration loaded from:
# 1. Environment variables
# 2. Configuration files
# 3. Default values

class ServiceConfig:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://...")
    REDIS_URL = os.getenv("REDIS_URL", "redis://...")
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", "10"))
    TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", "30"))
    ENABLE_CACHE = os.getenv("ENABLE_CACHE", "true").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
```

### 6.2 Environment Variables

**Database:**
- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_POOL_SIZE` - Connection pool size
- `DATABASE_MAX_OVERFLOW` - Max overflow connections

**Redis:**
- `REDIS_URL` - Redis connection string
- `REDIS_PASSWORD` - Redis password
- `REDIS_DB` - Redis database number

**Service-Specific:**
- `MAX_EMBEDDING_SIZE` - Maximum embedding dimension
- `MAX_FILE_SIZE_MB` - Maximum file upload size
- `MODEL_CACHE_DIR` - Directory for cached models
- `TEMP_DIR` - Temporary file directory

---

## 7. Error Handling

### 7.1 Error Classification

| Error Type | HTTP Status | Description | Retry? |
|------------|-------------|-------------|--------|
| ValidationError | 400 | Invalid input data | No |
| NotFoundError | 404 | Resource not found | No |
| ConflictError | 409 | Resource conflict | No |
| RateLimitError | 429 | Too many requests | Yes (after delay) |
| InternalError | 500 | Internal server error | Yes |
| ServiceUnavailable | 503 | Service temporarily unavailable | Yes |

### 7.2 Error Response

```json
{
  "status": "error",
  "data": null,
  "meta": {
    "timestamp": "2026-10-11T10:00:00Z",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "duration_ms": 45
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input: field 'patient_id' is required",
    "details": {
      "patient_id": ["field required"]
    },
    "retryable": false,
    "timestamp": "2026-10-11T10:00:00Z"
  }
}
```

### 7.3 Error Recovery

**Automatic Recovery:**
- Database connection failures: Retry with exponential backoff
- Rate limiting: Retry after delay
- Temporary file errors: Retry with cleanup

**Manual Intervention:**
- Invalid input: Return error to client
- Resource not found: Return 404
- Authentication failures: Return 401/403

---

## 8. Service Health Monitoring

### 8.1 Health Check Endpoints

All services expose a `/health` endpoint:

```bash
GET /api/cardiotwin/imaging/health
GET /api/cardiotwin/cases/health
GET /api/cardiotwin/clinical-extraction/health
GET /api/cardiotwin/workflow-orchestration/health
GET /api/cardiotwin/evidence-continuity/health
```

### 8.2 Health Check Response

```json
{
  "status": "healthy|degraded|unhealthy",
  "service": "evidence_continuity",
  "version": "1.0.0",
  "timestamp": "2026-10-11T10:00:00Z",
  "checks": {
    "database": {"status": "healthy", "response_time_ms": 5},
    "redis": {"status": "healthy", "response_time_ms": 2},
    "model_cache": {"status": "healthy", "loaded_models": 3},
    "disk_space": {"status": "healthy", "free_gb": 100}
  },
  "dependencies": {
    "clinical_extraction": "healthy",
    "imaging_embedding": "healthy",
    "vector_search": "healthy"
  }
}
```

### 8.3 Monitoring Metrics

| Metric | Type | Description | Target |
|--------|------|-------------|--------|
| request_count | Counter | Total requests | - |
| request_duration_ms | Histogram | Request duration | <100ms |
| error_count | Counter | Total errors | 0 |
| active_workflows | Gauge | Active workflows | <100 |
| queue_size | Gauge | Pending tasks | <50 |
| memory_usage_mb | Gauge | Memory usage | <2048 |
| cpu_usage_percent | Gauge | CPU usage | <80% |

---

## 9. Document Navigation

This is **Part 3 of 5** in the Architecture Documentation series:

1. [01-system-overview.md](01-system-overview.md) - High-level system vision, layering, technology stack
2. [02-domain-model.md](02-domain-model.md) - Detailed entity definitions and relationships
3. **[03-service-architecture.md](03-service-architecture.md)** - This document: Service organization and responsibilities
4. [04-api-architecture.md](04-api-architecture.md) - API design, endpoints, and contracts
5. [05-data-flow.md](05-data-flow.md) - Detailed data flow diagrams and sequences

---

## 10. References

- [FINAL_STATUS.md](../FINAL_STATUS.md) - Complete project status
- [backend/app/cardiotwin/services/](../../backend/app/cardiotwin/services/) - Service implementations
- [backend/app/cardiotwin/api/](../../backend/app/cardiotwin/api/) - API implementations
- [docs/integration/feature-capability-matrix.md](../integration/feature-capability-matrix.md) - Service capabilities

---

*Document created: 2026-10-11*
*Author: CardioTwin Architecture Team*
*Classification: Internal - Architecture Documentation*
