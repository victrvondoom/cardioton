# CardioTwin Architecture - 04: API Architecture

**Version:** 1.0
**Date:** 2026-10-11
**Phase:** 15 - Architecture Documentation
**Status:** Complete

---

## 1. API Overview

CardioTwin exposes a comprehensive RESTful API organized into domain-specific routers. All 39 new endpoints integrate seamlessly with the existing CardioTwin API structure.

---

## 2. API Structure

```
Base URL: /api/cardiotwin/
├── imaging/                    # Imaging Embedding Service (heartAI-main)
│   ├── generate/              # POST: Generate embedding
│   ├── upload/                # POST: Upload and process file
│   ├── status/{task_id}       # GET: Check task status
│   └── health                 # GET: Health check
│
├── cases/                     # Vector Search Service (case-twin-main)
│   ├── search/                # POST: Search similar cases
│   ├── similar/{case_id}      # GET: Find similar cases
│   ├── compare/               # POST: Compare cases
│   ├── {case_id}              # GET: Get case details
│   └── health                 # GET: Health check
│
├── clinical-extraction/       # Clinical Extraction Service (Epicast-main)
│   ├── extract/               # POST: Extract from text
│   ├── batch/                 # POST: Batch extraction
│   ├── status/{task_id}       # GET: Check task status
│   └── health                 # GET: Health check
│
├── workflow-orchestration/    # Workflow Orchestration Service (SafetyConnect-main)
│   ├── workflows/             # POST: Create workflow, GET: List workflows
│   ├── workflows/{id}         # GET: Get workflow, PUT: Update, DELETE: Delete
│   ├── workflows/{id}/start   # POST: Start workflow
│   ├── workflows/{id}/cancel  # POST: Cancel workflow
│   ├── workflows/{id}/events  # GET: Get workflow events
│   ├── cardiac-case            # GET: Cardiac case workflow
│   ├── workflows/{id}/status  # GET: Get workflow status
│   └── health                 # GET: Health check
│
└── evidence-continuity/       # Evidence Continuity Service (CORE NOVELTY)
    ├── graphs/                # POST: Create graph, GET: List graphs
    ├── graphs/{graph_id}     # GET: Get graph, PUT: Update, DELETE: Delete
    ├── graphs/{graph_id}/nodes # POST: Add node, GET: List nodes
    ├── graphs/{graph_id}/nodes/{node_id} # GET: Get node, PUT: Update, DELETE: Delete
    ├── graphs/{graph_id}/edges # POST: Add edge, GET: List edges
    ├── graphs/{graph_id}/edges/{edge_id} # GET: Get edge, PUT: Update, DELETE: Delete
    ├── graphs/{graph_id}/validate # POST: Validate graph
    ├── graphs/{graph_id}/inconsistencies # POST: Detect inconsistencies
    ├── graphs/{graph_id}/temporal-misalignment # POST: Detect temporal misalignment
    ├── graphs/{graph_id}/contradictions # POST: Detect cross-modality contradictions
    ├── graphs/{graph_id}/outdated-simulations # POST: Detect outdated simulations
    ├── twins/{twin_id}/sync    # POST: Sync digital twin
    ├── twins/{twin_id}/validate-sync # POST: Validate sync
    ├── twins/{twin_id}/sync-status # GET: Get sync status
    └── health                 # GET: Health check
```

---

## 3. API Endpoint Catalog

### 3.1 Imaging Embedding API (4 endpoints)

**Origin:** heartAI-main project
**Base Path:** `/api/cardiotwin/imaging/`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|---------------|----------|
| POST | `/generate` | Generate embedding from file | FileUploadRequest | EmbeddingResponse |
| POST | `/upload` | Upload and process file | FileUploadRequest | TaskResponse |
| GET | `/status/{task_id}` | Check embedding task status | - | TaskStatus |
| GET | `/health` | Service health check | - | HealthResponse |

**Request Schemas:**
```typescript
interface FileUploadRequest {
  file: File;                    // Binary file (DICOM, NIfTI)
  modality: 'MRI' | 'CT' | 'Echo' | 'Ultrasound';
  preprocessing?: PreprocessingConfig;
  metadata?: Record<string, any>;
}

interface PreprocessingConfig {
  normalize?: boolean;
  resize?: [number, number, number];
  crop?: boolean;
  monai_transforms?: string[];
}
```

**Response Schemas:**
```typescript
interface EmbeddingResponse {
  embedding: number[];           // 512-dimensional vector
  metadata: {
    file_name: string;
    file_size: number;
    modality: string;
    dimensions: [number, number, number];
    preprocessing: PreprocessingConfig;
    timestamp: string;
  };
  quality_score: number;         // 0-1
}

interface TaskResponse {
  task_id: string;               // UUID
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;            // ISO8601
}

interface TaskStatus {
  task_id: string;
  status: string;
  progress: number;               // 0-100
  result?: EmbeddingResponse;
  error?: string;
  started_at?: string;
  completed_at?: string;
}
```

---

### 3.2 Vector Search / Cases API (5 endpoints)

**Origin:** case-twin-main project
**Base Path:** `/api/cardiotwin/cases/`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|---------------|----------|
| POST | `/search` | Search similar cases | SearchRequest | SearchResponse |
| GET | `/similar/{case_id}` | Find similar cases | - | SimilarCasesResponse |
| POST | `/compare` | Compare two cases | CompareRequest | CompareResponse |
| GET | `/{case_id}` | Get case details | - | CaseDetails |
| GET | `/health` | Service health check | - | HealthResponse |

**Request Schemas:**
```typescript
interface SearchRequest {
  embedding: number[];            // Query embedding vector
  top_k?: number;               // Default: 10
  filters?: {
    modality?: string[];
    diagnosis?: string[];
    date_range?: [string, string];
  };
  hybrid_search?: boolean;       // Combine with metadata
}

interface CompareRequest {
  case_id_1: string;
  case_id_2: string;
  comparison_type?: 'full' | 'quick';
}
```

**Response Schemas:**
```typescript
interface SearchResponse {
  results: CaseResult[];
  query_embedding: number[];
  search_time_ms: number;
}

interface CaseResult {
  case_id: string;
  similarity_score: number;      // 0-1
  metadata: CaseMetadata;
  supporting_evidence: EvidenceSummary[];
}

interface SimilarCasesResponse {
  case_id: string;
  similar_cases: CaseResult[];
}

interface CompareResponse {
  case_id_1: string;
  case_id_2: string;
  similarity_score: number;
  matching_features: FeatureMatch[];
  differing_features: FeatureMatch[];
  comparison_details: Record<string, any>;
}

interface CaseDetails {
  case_id: string;
  patient_info: PatientSummary;
  observations: ClinicalObservation[];
  studies: ImagingStudy[];
  reports: DiagnosticReport[];
  evidence_graph_id?: string;
  created_at: string;
  updated_at: string;
}
```

---

### 3.3 Clinical Extraction API (4 endpoints)

**Origin:** Epicast-main project
**Base Path:** `/api/cardiotwin/clinical-extraction/`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|---------------|----------|
| POST | `/extract` | Extract from single text | ExtractionRequest | ExtractionResponse |
| POST | `/batch` | Batch extraction | BatchExtractionRequest | BatchExtractionResponse |
| GET | `/status/{task_id}` | Check task status | - | TaskStatus |
| GET | `/health` | Service health check | - | HealthResponse |

**Request Schemas:**
```typescript
interface ExtractionRequest {
  text: string;                  // Clinical text to analyze
  config?: ExtractionConfig;
}

interface BatchExtractionRequest {
  documents: {
    id: string;
    text: string;
    metadata?: Record<string, any>;
  }[];
  config?: ExtractionConfig;
}

interface ExtractionConfig {
  entity_types?: EntityType[];   // ECG, echo, medications, etc.
  confidence_threshold?: number; // 0-1, default: 0.7
  include_context?: boolean;     // Include surrounding text
  temporal_extraction?: boolean; // Extract time references
  negation_detection?: boolean;  // Detect negated findings
  icd10_mapping?: boolean;       // Map to ICD-10 codes
}

type EntityType =
  | 'ecg_findings'
  | 'echo_findings'
  | 'clinical_observations'
  | 'medications'
  | 'diagnoses'
  | 'procedures'
  | 'risk_factors'
  | 'biomarkers';
```

**Response Schemas:**
```typescript
interface ExtractionResponse {
  document_id: string;
  extraction_id: string;
  entities: ExtractedEntity[];
  statistics: {
    entity_count: number;
    extraction_time_ms: number;
    confidence_avg: number;
  };
}

interface BatchExtractionResponse {
  results: ExtractionResponse[];
  total_count: number;
  success_count: number;
  failed_count: number;
  batch_time_ms: number;
}

interface ExtractedEntity {
  entity_id: string;
  entity_type: EntityType;
  text: string;                  // Extracted text
  value?: any;                  // Normalized value (if applicable)
  code?: string;                // Standard code (ICD-10, LOINC, etc.)
  confidence: number;           // 0-1
  start_pos: number;           // Character position in source
  end_pos: number;
  context?: string;             // Surrounding text
  is_negated?: boolean;
  temporal_info?: TemporalInfo;
  metadata?: Record<string, any>;
}

interface TemporalInfo {
  date?: string;
  time?: string;
  relative_time?: string;       // "2 days ago", "last month", etc.
  duration?: string;            // "for 3 months", etc.
}
```

**ECG Findings (25+ patterns):**
- Rhythm: AFib, AFlutter, VTach, VFib, Bradycardia, Tachycardia
- Intervals: PR prolongation, QRS widening, QT prolongation
- Segments: ST elevation, ST depression, T-wave inversion
- Blocks: AV block (1st/2nd/3rd), Bundle branch blocks
- Other: Premature contractions, PVCs, PACs, Heart rate extremes

**Echo Findings (20+ patterns):**
- Structure: LVH, RVH, LA dilation, RA dilation
- Function: EF, FS, Wall motion abnormalities, Diastolic dysfunction
- Valves: Aortic stenosis, Mitral regurgitation, etc.
- Other: Pericardial effusion, Chamber dimensions, Systolic dysfunction

---

### 3.4 Workflow Orchestration API (9 endpoints)

**Origin:** SafetyConnect-main project
**Base Path:** `/api/cardiotwin/workflow-orchestration/`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|---------------|----------|
| POST | `/workflows` | Create new workflow | WorkflowCreateRequest | WorkflowResponse |
| GET | `/workflows` | List workflows | QueryParams | WorkflowListResponse |
| GET | `/workflows/{id}` | Get workflow details | - | WorkflowResponse |
| PUT | `/workflows/{id}` | Update workflow | WorkflowUpdateRequest | WorkflowResponse |
| DELETE | `/workflows/{id}` | Delete workflow | - | DeleteResponse |
| POST | `/workflows/{id}/start` | Start workflow execution | StartRequest | ExecutionResponse |
| POST | `/workflows/{id}/cancel` | Cancel workflow | CancelRequest | ExecutionResponse |
| GET | `/workflows/{id}/events` | Get workflow events | QueryParams | EventsResponse |
| GET | `/workflows/cardiac-case` | Cardiac case workflow | CardiacCaseRequest | WorkflowResponse |
| GET | `/workflows/{id}/status` | Get workflow status | - | StatusResponse |
| GET | `/health` | Service health check | - | HealthResponse |

**Request Schemas:**
```typescript
interface WorkflowCreateRequest {
  workflow_type: WorkflowType;
  case_id: string;
  config?: WorkflowConfig;
  inputs?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

type WorkflowType =
  | 'cardiac_case'          // 10-stage cardiac workflow
  | 'evidence_continuity'   // 3-stage evidence workflow
  | 'imaging_analysis';      // 5-stage imaging workflow

interface WorkflowConfig {
  agent_configs?: Record<AgentType, AgentConfig>;
  timeout_seconds?: number;
  retry_policy?: RetryPolicy;
  event_streaming?: boolean;
}

type AgentType =
  | 'signal_intelligence'
  | 'imaging_intelligence'
  | 'evidence_agent'
  | 'consistency_agent'
  | 'simulation_agent'
  | 'clinical_workflow'
  | 'verification_agent'
  | 'orchestrator';

interface StartRequest {
  inputs?: Record<string, any>;   // Override initial inputs
  force_restart?: boolean;         // Restart from beginning
}

interface CancelRequest {
  reason?: string;
  force?: boolean;
}
```

**Response Schemas:**
```typescript
interface WorkflowResponse {
  id: string;
  workflow_type: WorkflowType;
  case_id: string;
  status: WorkflowStatus;
  current_stage?: string;
  stages: WorkflowStage[];
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
  agent_executions?: AgentExecutionSummary[];
}

type StageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_review';

interface ExecutionResponse {
  execution_id: string;
  status: ExecutionStatus;
  message: string;
}

type ExecutionStatus =
  | 'started'
  | 'cancelled'
  | 'cancel_failed';

interface EventsResponse {
  events: WorkflowEvent[];
  has_more: boolean;
  next_cursor?: string;
}

interface WorkflowEvent {
  event_id: string;
  timestamp: string;
  event_type: EventType;
  stage?: string;
  agent_type?: AgentType;
  message: string;
  data?: Record<string, any>;
  severity: 'info' | 'warning' | 'error';
}

type EventType =
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'workflow_cancelled'
  | 'stage_started'
  | 'stage_completed'
  | 'stage_failed'
  | 'agent_started'
  | 'agent_completed'
  | 'agent_failed'
  | 'review_required'
  | 'retry_attempt';
```

**Cardiac Case Workflow (10 stages):**
1. CASE_CREATED
2. DATA_INGESTED
3. QUALITY_CHECKED
4. PHYSIOLOGICAL_SIGNALS_ANALYZED
5. IMAGING_CONNECTED
6. EVIDENCE_RECONCILED
7. DIGITAL_TWIN_UPDATED
8. AGENTS_EXECUTED
9. CLINICIAN_REVIEWED
10. FOLLOW_UP_TRACKED

---

### 3.5 Evidence Continuity API (17 endpoints) - NOVELTY CORE

**Origin:** CardioTwin core innovation
**Base Path:** `/api/cardiotwin/evidence-continuity/`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|---------------|----------|
| **Graph Management** |
| POST | `/graphs` | Create evidence graph | GraphCreateRequest | GraphResponse |
| GET | `/graphs` | List evidence graphs | QueryParams | GraphListResponse |
| GET | `/graphs/{graph_id}` | Get graph details | - | GraphResponse |
| PUT | `/graphs/{graph_id}` | Update graph | GraphUpdateRequest | GraphResponse |
| DELETE | `/graphs/{graph_id}` | Delete graph | - | DeleteResponse |
| **Node Management** |
| POST | `/graphs/{graph_id}/nodes` | Add evidence node | NodeCreateRequest | NodeResponse |
| GET | `/graphs/{graph_id}/nodes` | List nodes | QueryParams | NodeListResponse |
| GET | `/graphs/{graph_id}/nodes/{node_id}` | Get node | - | NodeResponse |
| PUT | `/graphs/{graph_id}/nodes/{node_id}` | Update node | NodeUpdateRequest | NodeResponse |
| DELETE | `/graphs/{graph_id}/nodes/{node_id}` | Delete node | - | DeleteResponse |
| **Edge Management** |
| POST | `/graphs/{graph_id}/edges` | Add evidence edge | EdgeCreateRequest | EdgeResponse |
| GET | `/graphs/{graph_id}/edges` | List edges | QueryParams | EdgeListResponse |
| GET | `/graphs/{graph_id}/edges/{edge_id}` | Get edge | - | EdgeResponse |
| PUT | `/graphs/{graph_id}/edges/{edge_id}` | Update edge | EdgeUpdateRequest | EdgeResponse |
| DELETE | `/graphs/{graph_id}/edges/{edge_id}` | Delete edge | - | DeleteResponse |
| **Validation & Detection** |
| POST | `/graphs/{graph_id}/validate` | Validate graph | - | ValidationResponse |
| POST | `/graphs/{graph_id}/inconsistencies` | Detect inconsistencies | - | InconsistencyResponse |
| POST | `/graphs/{graph_id}/temporal-misalignment` | Detect temporal issues | - | TemporalResponse |
| POST | `/graphs/{graph_id}/contradictions` | Detect contradictions | - | ContradictionResponse |
| POST | `/graphs/{graph_id}/outdated-simulations` | Detect outdated sims | - | OutdatedResponse |
| **Digital Twin Sync** |
| POST | `/twins/{twin_id}/sync` | Sync digital twin | SyncRequest | SyncResponse |
| POST | `/twins/{twin_id}/validate-sync` | Validate sync | - | ValidationResponse |
| GET | `/twins/{twin_id}/sync-status` | Get sync status | - | SyncStatusResponse |
| **Health** |
| GET | `/health` | Service health check | - | HealthResponse |

**Request/Response Schemas:**
```typescript
// Graph Schemas
interface GraphCreateRequest {
  case_id: string;
  initial_version?: number;
}

interface GraphResponse {
  id: string;
  case_id: string;
  version: number;
  node_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
  validation_status: ValidationStatus;
  validation_message?: string;
}

// Node Schemas
interface NodeCreateRequest {
  node_type: NodeType;
  content: Record<string, any>;
  timestamp: string;
  source: string;
  provenance?: Record<string, any>;
  confidence?: number;
}

type NodeType =
  | 'ecg_observation'
  | 'imaging_observation'
  | 'clinical_observation'
  | 'diagnostic_report'
  | 'model_inference'
  | 'digital_twin_state'
  | 'clinical_review'
  | 'follow_up_task'
  | 'cardiac_segmentation'
  | 'simulation_run';

interface NodeResponse {
  id: string;
  graph_id: string;
  node_type: NodeType;
  content: Record<string, any>;
  timestamp: string;
  source: string;
  provenance: Record<string, any>;
  confidence: number;
  validity: 'valid' | 'questionable' | 'invalid';
  version: number;
  created_at: string;
  updated_at: string;
}

// Edge Schemas
interface EdgeCreateRequest {
  source_node_id: string;
  target_node_id: string;
  relationship_type: RelationshipType;
  weight?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

type RelationshipType =
  | 'observed_at'
  | 'derived_from'
  | 'supports'
  | 'contradicts'
  | 'supersedes'
  | 'requires_review'
  | 'generated_by'
  | 'belongs_to_case';

interface EdgeResponse {
  id: string;
  graph_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: RelationshipType;
  weight: number;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
}

// Validation & Detection Schemas
interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  graph_id: string;
  checked_at: string;
}

interface InconsistencyResponse {
  inconsistencies: Inconsistency[];
  graph_id: string;
  detection_method: string;
  checked_at: string;
}

interface Inconsistency {
  id: string;
  type: InconsistencyType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  involved_nodes: string[];
  involved_edges: string[];
  evidence: Record<string, any>;
  suggested_action: string;
}

type InconsistencyType =
  | 'temporal_misalignment'
  | 'cross_modality_contradiction'
  | 'outdated_simulation'
  | 'missing_evidence'
  | 'provenance_gap'
  | 'uncertainty_propagation'
  | 'constraint_violation';

// Digital Twin Sync Schemas
interface SyncRequest {
  force_sync?: boolean;
  validate_only?: boolean;
}

interface SyncResponse {
  synced: boolean;
  twin_id: string;
  graph_id: string;
  issues?: SyncIssue[];
  sync_timestamp: string;
}

interface SyncIssue {
  issue_type: SyncIssueType;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  node_id?: string;
  suggested_action: string;
}

type SyncIssueType =
  | 'stale_evidence'
  | 'missing_update'
  | 'temporal_mismatch'
  | 'contradiction_unresolved';

interface SyncStatusResponse {
  twin_id: string;
  graph_id: string;
  status: 'synced' | 'out_of_sync' | 'needs_review';
  last_sync: string;
  sync_issues: SyncIssue[];
}
```

---

## 4. API Design Patterns

### 4.1 Consistency Across Services

All services follow these consistent patterns:

**1. Response Wrapping:**
```json
{
  "status": "success|error",
  "data": { ... },
  "meta": { "timestamp", "request_id", "duration_ms", "version" },
  "error": null | { "code", "message", "details", "retryable", "timestamp" }
}
```

**2. Error Handling:**
- HTTP status codes (200, 400, 401, 403, 404, 409, 429, 500, 503)
- Error response format (see above)
- Retryable vs non-retryable errors

**3. Pagination:**
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

**4. Filtering:**
```
GET /api/cardiotwin/cases?
  modality=MRI
  &diagnosis=HCM
  &date_from=2024-01-01
  &date_to=2024-12-31
  &limit=10
  &offset=0
  &order_by=created_at
  &order=desc
```

---

## 5. API Client Implementation

**Frontend API Client:**
- File: `frontend/src/cardiotwin/core__src_cardiotwin__api.ts`
- Language: TypeScript
- Features: Full type safety, comprehensive type definitions

**Example Usage:**
```typescript
import { cardiotwinApi } from './api';

// Generate imaging embedding
const embedding = await cardiotwinApi.imaging.generateEmbedding({
  file: niftiFile,
  modality: 'MRI',
  preprocessing: { normalize: true, resize: [128, 128, 128] }
});

// Search similar cases
const similarCases = await cardiotwinApi.cases.searchSimilar({
  case_id: 'case-123',
  top_k: 5
});

// Extract clinical entities
const extraction = await cardiotwinApi.clinicalExtraction.extract({
  text: clinicalNote,
  config: { entity_types: ['ecg_findings', 'echo_findings'] }
});

// Create and validate evidence graph
const graph = await cardiotwinApi.evidenceContinuity.createGraph({
  case_id: 'case-123'
});
const validation = await cardiotwinApi.evidenceContinuity.validateGraph(
  graph.id
);

// Start cardiac workflow
const workflow = await cardiotwinApi.workflowOrchestration.createWorkflow({
  workflow_type: 'cardiac_case',
  case_id: 'case-123'
});
```

---

## 6. API Security

### 6.1 Authentication
- All endpoints require authentication
- JWT token validation
- Role-based access control (RBAC)

### 6.2 Authorization
**Roles:**
- `patient` - Read own data, limited access
- `clinician` - Read/write clinical data, manage cases
- `researcher` - Full read access, limited write
- `admin` - Full access

**Endpoint-Level Permissions:**
- POST /generate: `clinician`, `researcher`, `admin`
- GET /status/{task_id}: `patient` (own), `clinician`, `researcher`, `admin`
- POST /extract: `clinician`, `researcher`, `admin`
- POST /workflows: `clinician`, `researcher`, `admin`
- POST /graphs: `clinician`, `researcher`, `admin`

### 6.3 Rate Limiting
- Per-user rate limits
- Per-endpoint rate limits
- Global rate limits
- Configurable limits via environment variables

### 6.4 Data Protection
- All data encrypted at rest (database, files)
- All data encrypted in transit (HTTPS)
- PII (Personally Identifiable Information) handling
- HIPAA/GDPR compliance features

---

## 7. API Versioning

**Current Version:** 1.0.0
**Versioning Strategy:** URL path prefix

**Future Versions:**
- `/api/cardiotwin/v1/` - Current version
- `/api/cardiotwin/v2/` - Future version (when breaking changes occur)

**Deprecation Policy:**
- 6 months notice before deprecation
- 12 months support after deprecation announcement
- Migration guides provided

---

## 8. API Documentation

### 8.1 OpenAPI/Swagger
- Auto-generated from FastAPI
- Available at: `/api/cardiotwin/docs`
- Interactive documentation
- Try endpoints directly

### 8.2 Redoc
- Alternative documentation
- Available at: `/api/cardiotwin/redoc`
- More readable format

### 8.3 Postman Collection
- Postman collection available
- Environment variables configured
- Pre-request scripts included
- Test scripts included

---

## 9. Document Navigation

This is **Part 4 of 5** in the Architecture Documentation series:

1. [01-system-overview.md](01-system-overview.md) - High-level system vision, layering, technology stack
2. [02-domain-model.md](02-domain-model.md) - Detailed entity definitions and relationships
3. [03-service-architecture.md](03-service-architecture.md) - Service organization and responsibilities
4. **[04-api-architecture.md](04-api-architecture.md)** - This document: API design, endpoints, and contracts
5. [05-data-flow.md](05-data-flow.md) - Detailed data flow diagrams and sequences

---

## 10. References

- [FINAL_STATUS.md](../FINAL_STATUS.md) - Complete project status
- [frontend/src/cardiotwin/core__src_cardiotwin__api.ts](../../frontend/src/cardiotwin/core__src_cardiotwin__api.ts) - API client implementation
- [backend/app/cardiotwin/api/](../../backend/app/cardiotwin/api/) - API router implementations
- [docs/integration/feature-capability-matrix.md](../integration/feature-capability-matrix.md) - API capabilities

---

*Document created: 2026-10-11*
*Author: CardioTwin Architecture Team*
*Classification: Internal - Architecture Documentation*
