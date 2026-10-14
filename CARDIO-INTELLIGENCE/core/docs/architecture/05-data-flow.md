# CardioTwin Architecture - 05: Data Flow

**Version:** 1.0
**Date:** 2026-10-11
**Phase:** 15 - Architecture Documentation
**Status:** Complete

---

## 1. Data Flow Overview

This document describes how data moves through the CardioTwin system, from initial ingestion to final presentation, including all intermediate processing steps.

---

## 2. Primary Data Flow: Cardiac Case Journey

### 2.1 End-to-End Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CARDIOTWIN DATA FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                     │
│  USER INTERACTION                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────┐                                             │
│  │   Frontend      │  ◄── TypeScript API Client                 │
│  │   (React/Next.js)│      (frontend/src/cardiotwin/core__src_cardiotwin__api.ts)       │
│  └─────────┬────────┘                                             │
│             │                                                      │
│             │ HTTP/HTTPS                                           │
│             ▼                                                      │
│  ┌──────────────────┐                                             │
│  │  API Gateway     │  ◄── FastAPI Main Router                    │
│  │  (cardiotwin.py) │      (backend/app/api/cardiotwin.py)        │
│  └─────────┬────────┘                                             │
│             │                                                      │
│             │ Routing                                              │
│             ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SERVICE LAYER                           │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │   │
│  │  │  Imaging    │ │ Clinical     │ │ Workflow     │     │   │
│  │  │  Embedding  │ │ Extraction   │ │ Orchestration│     │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘     │   │
│  │         │                │               │              │   │
│  │         └────────────────┼───────────────┘              │   │
│  │                          │                                      │   │
│  │                          ▼                                      │   │
│  │               ┌─────────────────────┐                       │   │
│  │               │ Evidence Continuity  │  ◄── CORE NOVELTY       │   │
│  │               │      Engine          │                       │   │
│  │               └─────────┬───────────┘                       │   │
│  │                         │                                       │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
│                            │                                       │
│                            ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DATA STORAGE                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │   │
│  │  │ PostgreSQL  │ │ File Storage │ │  Model Cache  │     │   │
│  │  │ (Evidence   │ │ (DICOM,      │ │ (FAISS, etc.) │     │   │
│  │  │  Graphs)    │ │  NIfTI, etc.)│ │               │     │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    OBSERVABILITY                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │   │
│  │  │   Logging   │ │   Tracing   │ │   Metrics    │     │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Data Flow Sequences

### 3.1 Cardiac Case Creation Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│  Frontend    │────▶│   API        │────▶│  Evidence    │
│  Action  │     │  (React)      │     │  Gateway     │     │  Continuity  │
└─────────┘     └──────────────┘     └──────────────┘     │   Service    │
                                                            │              │
┌────────────────────────────────────────────────────────────────┐ │
│  1. User clicks "Create New Case"                                   │ │
│  2. Frontend opens case creation form                             │ │
│  3. User enters patient info and case details                    │ │
│  4. Frontend sends POST /api/cardiotwin/cases                     │ │
│  5. API Gateway routes to Evidence Continuity Service             │ │
│  6. Service creates new CardiacCase record                        │ │
│  7. Service creates new EvidenceGraph for the case                 │ │
│  8. Service returns new case with empty graph                     │ │
│  9. Frontend displays case workspace with empty state           │ │
└────────────────────────────────────────────────────────────────┘
```

**Data Transformed:**
- User input → CardiacCase entity + EvidenceGraph entity
- Frontend state → Case workspace UI

---

### 3.2 Data Ingestion Flow (ECG)

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│  Frontend    │────▶│   API        │────▶│ Clinical     │
│  Uploads │     │  (Upload UI)  │     │  Gateway     │     │ Extraction    │
│  ECG     │     └──────────────┘     └──────────────┘     │   Service     │
│  File    │                                             │              │
└─────────┘                                             │              │
                                                        │              │
        ┌───────────────────────────────────────────────┘              │
        │                                                      │
        ▼                                                      │
┌──────────────────┐                                        │
│ Evidence          │◄───────────────────────────────────────┘
│ Continuity        │
│ Service           │
└─────────┬─────────┘
          │
          ▼
┌──────────────────┐
│  PostgreSQL       │
│  Database         │
└──────────────────┘
```

**Sequence:**
1. User uploads ECG file via frontend upload component
2. Frontend sends file to `/api/cardiotwin/clinical-extraction/extract`
3. API Gateway routes to Clinical Extraction Service
4. Service processes text extraction from ECG report (if available)
5. Service returns structured clinical observations
6. Frontend sends observations to Evidence Continuity Service
7. Service creates EvidenceNodes for each observation
8. Service adds nodes to EvidenceGraph
9. Service persists graph to PostgreSQL
10. Frontend updates UI with new evidence

**Data Transformed:**
- ECG file + report → Structured clinical observations
- Observations → EvidenceNodes
- EvidenceNodes → Updated EvidenceGraph

---

### 3.3 Imaging Ingestion Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│  Frontend    │────▶│   API        │────▶│ Imaging       │
│  Uploads │     │  (Upload UI)  │     │  Gateway     │     │ Embedding     │
│  MRI     │     └──────────────┘     └──────────────┘     │   Service     │
│  Files   │                                             │              │
└─────────┘                                             │              │
                                                        │              │
        ┌───────────────────────────────────────────────┘              │
        │                                                      │
        ▼                                                      │
┌──────────────────┐     ┌──────────────┐                    │
│ Vector Search     │◄────│ Evidence      │◄───────────────────┘
│ Service           │     │ Continuity    │
└──────────────────┘     │   Service     │
                         └──────────────┘
```

**Sequence:**
1. User uploads DICOM/NIfTI files via frontend
2. Frontend sends file to `/api/cardiotwin/imaging/generate`
3. API Gateway routes to Imaging Embedding Service
4. Service loads medical image using MONAI
5. Service preprocesses image (normalize, resize)
6. Service runs 3D CNN + Transformer model
7. Service generates 512-dimensional embedding
8. Service returns embedding + metadata
9. Frontend sends embedding to Vector Search Service
10. Service indexes embedding for similarity search
11. Frontend sends metadata to Evidence Continuity Service
12. Service creates ImagingObservation EvidenceNode
13. Service adds node to EvidenceGraph
14. Service persists to PostgreSQL

**Data Transformed:**
- DICOM/NIfTI file → Preprocessed volume
- Volume → 512D embedding vector
- Embedding → Indexed for search
- Metadata → ImagingObservation EvidenceNode

---

### 3.4 Evidence Graph Validation Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│  Frontend    │────▶│   API        │
│  Request │     │  (Dashboard)  │     │  Gateway     │
└─────────┘     └──────────────┘     └──────┬───────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Evidence Continuity Service                                   │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌───────────┐ │
│  │ Temporal         │    │ Constraint        │    │ Provenance │ │
│  │ Alignment Engine │    │ Checking Engine   │    │ Tracker    │ │
│  └─────────────────┘    └─────────────────┘    └───────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Validation Process                        │ │
│  │  1. Load EvidenceGraph from PostgreSQL                      │ │
│  │  2. TemporalAlignmentEngine.check_temporal_consistency()  │ │
│  │  3. ConstraintCheckingEngine.check_physiological()          │ │
│  │  4. ProvenanceTracker.validate_provenance()                │ │
│  │  5. UncertaintyPropagator.propagate_uncertainty()           │ │
│  │  6. DigitalTwinSync.validate_sync()                         │ │
│  │  7. Compile all validation results                          │ │
│  │  8. Return ValidationResponse                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────┐
│  Frontend         │
│  (Validation      │
│  Results Display) │
└──────────────────┘
```

**Data Transformed:**
- EvidenceGraph → Validation results
- Validation results → UI visualizations (warnings, errors, recommendations)

---

### 3.5 Multi-Agent Workflow Execution Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│  Frontend    │────▶│   API        │
│  Starts  │     │  (Workflow   │     │  Gateway     │
│  Workflow│     │   Panel)     │     └──────┬───────┘
└─────────┘     └──────────────┘         │
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Workflow Orchestration Service                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Workflow Engine                            │ │
│  │  1. Receive workflow creation request                       │ │
│  │  2. Create WorkflowInstance with initial state               │ │
│  │  3. Emit "workflow_started" event                            │ │
│  │  4. For each stage:                                         │ │
│  │     a. Check preconditions                                  │ │
│  │     b. Execute stage-specific logic                         │ │
│  │     c. Emit "stage_started" event                            │ │
│  │     d. Execute agents in parallel or sequence               │ │
│  │     e. Wait for agent completion                            │ │
│  │     f. Handle failures with retry or escalation             │ │
│  │     g. Emit "stage_completed" event                         │ │
│  │  5. After all stages:                                        │ │
│  │     a. Emit "workflow_completed" event                      │ │
│  │     b. Update WorkflowInstance status                      │ │
│  │     c. Return final results                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Agent Coordination                          │ │
│  │  1. Orchestrator dispatches tasks to agents                │ │
│  │  2. Agents execute using their specialized logic             │ │
│  │  3. Agents emit events during execution                      │ │
│  │  4. Agents return results to orchestrator                  │ │
│  │  5. Orchestrator aggregates and validates results           │ │
│  │  6. Orchestrator handles dependencies between agents        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Event Streaming                             │ │
│  │  1. Events emitted to EventStream                          │ │
│  │  2. Events broadcast to connected clients via WebSocket    │ │
│  │  3. Events stored in event history                          │ │
│  │  4. Events available for replay and analysis                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────┐
│  All Services      │
│  (Evidence         │
│   Continuity,     │
│   Clinical Ext.,  │
│   Imaging, etc.)  │
└──────────────────┘
        │
        ▼
┌──────────────────┐
│  Frontend         │
│  (Real-time       │
│   Updates)        │
└──────────────────┘
```

**Cardiac Case Workflow Stages:**
1. CASE_CREATED - Initialize case and evidence graph
2. DATA_INGESTED - Upload and process all available data
3. QUALITY_CHECKED - Validate data quality and completeness
4. PHYSIOLOGICAL_SIGNALS_ANALYZED - Process ECG and other signals
5. IMAGING_CONNECTED - Process and analyze imaging studies
6. EVIDENCE_RECONCILED - Resolve contradictions and validate consistency
7. DIGITAL_TWIN_UPDATED - Update digital twin with validated evidence
8. AGENTS_EXECUTED - Run specialized agents for analysis
9. CLINICIAN_REVIEWED - Human review and decision
10. FOLLOW_UP_TRACKED - Schedule and track follow-up actions

**Data Transformed:**
- Workflow definition → WorkflowInstance
- WorkflowInstance → Execution events
- Events → Real-time UI updates
- Agent outputs → Workflow results

---

## 4. Data State Transitions

### 4.1 EvidenceNode Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    EvidenceNode Lifecycle                          │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│  │ CREATED  │────▶│ VALIDATED│────▶│  USED    │               │
│  └──────────┘     └──────────┘     └──────────┘               │
│       │               │               │                         │
│       ▼               ▼               ▼                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│  │ QUEUED   │     │ REVIEWED │     │ ARCHIVED │               │
│  └──────────┘     └──────────┘     └──────────┘               │
│       │               │                                         │
│       ▼               ▼                                         │
│  ┌──────────┐     ┌──────────┐                                       │
│  │ PROCESSING│     │ SUPERSEDED│                                       │
│  └──────────┘     └──────────┘                                       │
│       │                                                               │
│       ▼                                                               │
│  ┌──────────┐                                                       │
│  │ QUESTION-│                                                       │
│  │ ABLE     │                                                       │
│  └──────────┘                                                       │
│       │                                                               │
│       ▼                                                               │
│  ┌──────────┐                                                       │
│  │ INVALID  │                                                       │
│  └──────────┘                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────┘
```

**State Definitions:**
- **CREATED**: Node created but not yet validated
- **QUEUED**: Node waiting for processing
- **PROCESSING**: Node currently being processed
- **VALIDATED**: Node passed all validation checks
- **REVIEWED**: Node reviewed by clinician
- **USED**: Node actively used in digital twin or analysis
- **SUPERSEDED**: Node replaced by newer evidence
- **QUESTIONABLE**: Node has quality or consistency concerns
- **INVALID**: Node failed validation or is known to be incorrect
- **ARCHIVED**: Node no longer relevant but kept for history

---

### 4.2 WorkflowInstance Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    WorkflowInstance Lifecycle                     │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│  │ PENDING  │────▶│ RUNNING  │────▶│ COMPLETED│               │
│  └──────────┘     └──────────┘     └──────────┘               │
│       │               │               │                         │
│       ▼               ▼               │                         │
│  ┌──────────┐     ┌──────────┐     │                         │
│  │ CANCELLED │     │ FAILED   │     │                         │
│  └──────────┘     └──────────┘     │                         │
│                           │         │                         │
│                           └─────────┼─────────────────────┘     │
│                                     ▼                           │
│                              ┌──────────┐                         │
│                              │ PAUSED   │                         │
│                              └──────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────┘
```

**State Definitions:**
- **PENDING**: Workflow created but not started
- **RUNNING**: Workflow actively executing
- **PAUSED**: Workflow temporarily paused (awaiting review or external input)
- **COMPLETED**: Workflow finished successfully
- **FAILED**: Workflow failed with error
- **CANCELLED**: Workflow cancelled by user

**Transition Triggers:**
- PENDING → RUNNING: User starts workflow
- RUNNING → PAUSED: Review gate encountered or manual pause
- PAUSED → RUNNING: Review completed or manual resume
- RUNNING → COMPLETED: All stages completed successfully
- RUNNING → FAILED: Unrecoverable error or max retries exceeded
- PENDING/RUNNING/PAUSED → CANCELLED: User cancels workflow

---

### 4.3 DigitalTwinInstance Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalTwinInstance Lifecycle                   │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│  │ INITIAL- │────▶│ SYNCED   │────▶│ STALE    │               │
│  │ IZED     │     └──────────┘     └──────────┘               │
│  └──────────┘           │               │                       │
│       │                 │               │                       │
│       ▼                 ▼               ▼                       │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│  │ NEEDS    │◄────┤ NEEDS    │     │ NEEDS    │               │
│  │ SYNC     │     │ REVIEW   │     │ SYNC     │               │
│  └──────────┘     └──────────┘     └──────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────┘
```

**State Definitions:**
- **INITIALIZED**: Digital twin created with initial state
- **SYNCED**: Digital twin synchronized with latest validated evidence
- **STALE**: Digital twin not synchronized with latest evidence
- **NEEDS_REVIEW**: Digital twin has potential issues requiring review
- **NEEDS_SYNC**: Digital twin explicitly marked for synchronization

**Synchronization Process:**
1. Evidence Continuity Engine detects new or updated evidence
2. Engine validates evidence against current digital twin state
3. If valid and consistent: Update digital twin, mark as SYNCED
4. If inconsistent: Mark as NEEDS_REVIEW
5. If outdated: Mark as STALE
6. Manual or automatic sync triggers synchronization

---

## 5. Error Handling Flows

### 5.1 Service Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    Service Error Handling                          │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  Service Execution                                             │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────┐                                           │
│  │  Try Operation   │                                           │
│  └─────────┬─────────┘                                           │
│             │                                                      │
│     ┌───────┴───────┐                                              │
│     │               │                                              │
│     ▼               ▼                                              │
│┌──────────┐   ┌─────────────┐                                     │
││ Success  │   │ Exception    │                                     │
│└──────────┘   │ Raised       │                                     │
│               └───────┬──────┘                                     │
│                        │                                            │
│               ┌────────▼────────┐                                  │
│               │                 │                                  │
│         ┌─────▼─────┐     ┌─────▼─────┐                            │
│         │           │     │           │                            │
│         ▼           ▼     ▼           ▼                            │
│  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐               │
│  │Validation│ │Rate Limit│ │Database │ │Network    │               │
│  │Error     │ │Exceeded  │ │Error    │ │Error      │               │
│  └──────────┘ └────────┘ └─────────┘ └───────────┘               │
│         │           │           │            │                     │
│         └───────────┼───────────┼────────────┘                     │
│                     │           │                                      │
│                     ▼           ▼                                      │
│              ┌──────────────────┐                                      │
│              │    Retry?         │                                      │
│              │  (Configurable)   │                                      │
│              └─────────┬─────────┘                                      │
│                        │                                            │
│                ┌───────┴───────┐                                     │
│                │               │                                     │
│                ▼               ▼                                     │
│         ┌──────────────┐ ┌──────────────┐                          │
│         │    Retry     │ │  Don't Retry  │                          │
│         │  (with delay)│ │  (Return err) │                          │
│         └──────────────┘ └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Retry Configuration:**
```python
RETRY_CONFIG = {
    'max_retries': 3,
    'initial_delay_ms': 100,
    'max_delay_ms': 10000,
    'backoff_multiplier': 2.0,
    'retryable_errors': [
        'DatabaseConnectionError',
        'RateLimitError',
        'NetworkTimeout',
        'ServiceUnavailable'
    ]
}
```

---

### 5.2 Workflow Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Error Handling                         │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stage Execution                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────┐                                           │
│  │  Execute Stage   │                                           │
│  └─────────┬─────────┘                                           │
│             │                                                      │
│     ┌───────┴───────┐                                              │
│     │               │                                              │
│     ▼               ▼                                              │
│┌──────────┐   ┌─────────────┐                                     │
││ Success  │   │ Agent Error  │                                     │
│└──────────┘   │ or Stage     │                                     │
│               │ Error         │                                     │
│               └───────┬──────┘                                     │
│                        │                                            │
│               ┌────────▼────────┐                                  │
│               │                 │                                  │
│         ┌─────▼─────┐     ┌─────▼─────┐                            │
│         │           │     │           │                            │
│         ▼           ▼     ▼           ▼                            │
│  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐               │
│  │Continue  │ │Retry    │ │Skip Stage│ │Fail       │               │
│  │          │ │Agent    │ │         │ │Workflow   │               │
│  └──────────┘ └────────┘ └─────────┘ └───────────┘               │
│                        │                                            │
│                        ▼                                            │
│                ┌──────────────────┐                                      │
│                │  Retry Limit?     │                                      │
│                │  (Max 3 times)    │                                      │
│                └─────────┬─────────┘                                      │
│                          │                                            │
│                  ┌───────┴───────┐                                     │
│                  │               │                                     │
│                  ▼               ▼                                     │
│           ┌──────────────┐ ┌──────────────┐                          │
│           │  Continue     │ │  Escalate/   │                          │
│           │  Execution    │ │  Notify      │                          │
│           └──────────────┘ └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Error Handling Strategies:**
1. **Retry**: For transient errors (network, database connection)
2. **Skip**: For optional stages with non-critical errors
3. **Escalate**: For errors requiring human intervention
4. **Fail**: For unrecoverable errors in critical stages

---

## 6. Data Transformation Examples

### 6.1 ECG Processing Pipeline

```
Input: ECG DICOM file + Report PDF
    │
    ▼
┌─────────────────────────────────────┐
│  Clinical Extraction Service          │
│  - Extract text from PDF report       │
│  - Identify cardiovascular entities  │
│  - Extract ECG findings              │
│  - Extract measurements               │
└─────────────────────┬────────────────┘
                        │
                        ▼
            Structured Clinical Observations
            [
              {
                "type": "ecg_finding",
                "code": "I48.0",  // AFib ICD-10
                "text": "Atrial fibrillation",
                "confidence": 0.95,
                "timestamp": "2024-01-15T10:00:00Z",
                "source": "ECG Report.pdf"
              },
              {
                "type": "ecg_measurement",
                "code": "8889-8",  // Heart rate LOINC
                "value": 110,
                "unit": "bpm",
                "confidence": 0.98,
                "timestamp": "2024-01-15T10:00:00Z"
              }
            ]
                        │
                        ▼
┌─────────────────────────────────────┐
│  Evidence Continuity Service          │
│  - Create EvidenceNodes for each     │
│    observation                       │
│  - Add nodes to EvidenceGraph        │
│  - Validate temporal consistency      │
│  - Check for contradictions           │
└─────────────────────┬────────────────┘
                        │
                        ▼
            Evidence Graph with ECG Nodes
            {
              "graph_id": "graph-123",
              "nodes": [
                {
                  "id": "node-1",
                  "type": "ecg_observation",
                  "content": {"finding": "Atrial fibrillation", "code": "I48.0"},
                  "timestamp": "2024-01-15T10:00:00Z",
                  "confidence": 0.95
                },
                {
                  "id": "node-2",
                  "type": "clinical_observation",
                  "content": {"code": "8889-8", "value": 110, "unit": "bpm"},
                  "timestamp": "2024-01-15T10:00:00Z",
                  "confidence": 0.98
                }
              ],
              "edges": [
                {
                  "source": "node-1",
                  "target": "node-2",
                  "relationship": "observed_at",
                  "confidence": 0.95
                }
              ]
            }
```

### 6.2 Imaging Processing Pipeline

```
Input: Cardiac MRI DICOM series
    │
    ▼
┌─────────────────────────────────────┐
│  Imaging Embedding Service             │
│  - Load DICOM series using MONAI      │
│  - Normalize intensities              │
│  - Resize to standard dimensions      │
│  - Apply 3D CNN + Transformer        │
│  - Generate 512D embedding             │
└─────────────────────┬────────────────┘
                        │
                        ▼
            Imaging Embedding + Metadata
            {
              "embedding": [0.12, -0.45, 0.78, ..., 0.33],  // 512D
              "metadata": {
                "modality": "MRI",
                "study_type": "CINE",
                "dimensions": [256, 256, 64],
                "spacing": [1.5, 1.5, 2.0],
                "patient_position": "supine",
                "quality_score": 0.92
              }
            }
                        │
                        ▼
┌─────────────────────────────────────┐
│  Vector Search Service                 │
│  - Index embedding in FAISS           │
│  - Store metadata in PostgreSQL       │
│  - Return indexing result             │
└─────────────────────┬────────────────┘
                        │
                        ▼
            Indexed Imaging Case
            {
              "case_id": "case-123",
              "embedding_id": "emb-456",
              "embedding": [0.12, -0.45, ..., 0.33],
              "metadata": { ... },
              "indexed_at": "2024-01-15T10:15:00Z"
            }
                        │
                        ▼
┌─────────────────────────────────────┐
│  Evidence Continuity Service          │
│  - Create ImagingObservation node    │
│  - Link to ImagingStudy              │
│  - Add to EvidenceGraph              │
│  - Validate consistency               │
└─────────────────────┬────────────────┘
```

---

## 7. Performance Characteristics

### 7.1 Latency Expectations

| Operation | Expected Latency | Notes |
|-----------|-----------------|-------|
| API Request (simple) | <100ms | GET endpoints, no processing |
| API Request (complex) | 100-500ms | POST with light processing |
| Imaging Embedding | 2-10s | Depends on image size |
| Clinical Extraction | 500ms-2s | Depends on text length |
| Vector Search | 10-100ms | Depends on index size |
| Evidence Validation | 1-5s | Full graph validation |
| Workflow Execution | 10s-5min | Full cardiac case workflow |
| Digital Twin Sync | 1-10s | Synchronization check |

### 7.2 Throughput

| Service | Requests/Second | Concurrent Tasks |
|---------|----------------|-----------------|
| Imaging Embedding | 5-10 | 3-5 |
| Clinical Extraction | 20-50 | 10-20 |
| Vector Search | 100+ | 50+ |
| Workflow Orchestration | 20-50 | 10-20 |
| Evidence Continuity | 50-100 | 20-50 |

---

## 8. Document Navigation

This is **Part 5 of 5** in the Architecture Documentation series:

1. [01-system-overview.md](01-system-overview.md) - High-level system vision, layering, technology stack
2. [02-domain-model.md](02-domain-model.md) - Detailed entity definitions and relationships
3. [03-service-architecture.md](03-service-architecture.md) - Service organization and responsibilities
4. [04-api-architecture.md](04-api-architecture.md) - API design, endpoints, and contracts
5. **[05-data-flow.md](05-data-flow.md)** - This document: Detailed data flow diagrams and sequences

---

## 9. References

- [FINAL_STATUS.md](../FINAL_STATUS.md) - Complete project status
- [backend/app/cardiotwin/](../../backend/app/cardiotwin/) - Backend implementation
- [frontend/src/cardiotwin/](../../frontend/src/cardiotwin/) - Frontend implementation
- [docs/integration/integration-plan.md](../integration/integration-plan.md) - Integration plan

---

*Document created: 2026-10-11*
*Author: CardioTwin Architecture Team*
*Classification: Internal - Architecture Documentation*
