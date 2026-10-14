# CardioTwin Architecture - 02: Domain Model

**Version:** 1.0
**Date:** 2026-10-11
**Phase:** 15 - Architecture Documentation
**Status:** Complete

---

## 1. Domain Model Overview

The CardioTwin domain model defines the canonical entities that represent cardiovascular patients, cases, evidence, and workflows. This model follows HL7 FHIR conventions where applicable, with cardiovascular-specific extensions.

---

## 2. Core Entity Hierarchy

```
CardioTwin Domain Model
├── Patient
│   ├── Person
│   │   ├── Identifier
│   │   ├── Name
│   │   ├── Contact
│   │   └── Demographics
│   └── Patient-specific attributes
│
├── CardiacCase
│   ├── CaseIdentifier
│   ├── Status
│   ├── Priority
│   ├── Created/Updated timestamps
│   └── Associated Patient
│
├── ClinicalEncounter
│   ├── EncounterType
│   ├── Date/Time
│   ├── Location
│   ├── Reason
│   └── Associated CardiacCase
│
├── Evidence Graph (NOVEL CORE)
│   ├── EvidenceNode
│   │   ├── ECGObservation
│   │   ├── ImagingObservation
│   │   ├── ClinicalObservation
│   │   ├── DiagnosticReport
│   │   ├── ModelInference
│   │   ├── DigitalTwinState
│   │   ├── ClinicalReview
│   │   └── FollowUpTask
│   │
│   └── EvidenceEdge
│       ├── RelationshipType
│       │   ├── observed_at
│       │   ├── derived_from
│       │   ├── supports
│       │   ├── contradicts
│       │   ├── supersedes
│       │   ├── requires_review
│       │   ├── generated_by
│       │   └── belongs_to_case
│       └── Metadata (timestamp, confidence, provenance)
│
└── Supporting Entities
    ├── CardiacSegmentation
    ├── SimulationRun
    ├── AgentExecution
    ├── EvidenceArtifact
    └── AuditEvent
```

---

## 3. Entity Definitions

### 3.1 Patient

**Purpose:** Represents a person receiving cardiovascular care

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| mrn | String | No | Medical Record Number |
| name | Name | Yes | Patient name (family, given, prefix, suffix) |
| birth_date | Date | Yes | Date of birth |
| gender | Code | Yes | Administrative gender (male/female/other/unknown) |
| contact | Contact | No | Telephone, email, address |
| identifiers | List[Identifier] | No | External identifiers (SSN, passport, etc.) |
| active | Boolean | Yes | Whether this patient record is active |
| created_at | DateTime | Yes | Record creation timestamp |
| updated_at | DateTime | Yes | Last update timestamp |

**Relationships:**
- Has many: CardiacCase, ClinicalEncounter
- FHIR Equivalent: `Patient`

**Implementation:**
- Existing CardioTwin patient model preserved
- Extended with cardiovascular-specific metadata

---

### 3.2 CardiacCase

**Purpose:** Central container for all cardiovascular evidence and activities related to a patient episode

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_number | String | Yes | Human-readable case number |
| patient_id | UUID | Yes | Reference to Patient |
| status | Enum | Yes | active, resolved, archived, on_hold |
| priority | Enum | Yes | routine, urgent, emergency |
| title | String | No | Descriptive title |
| description | Text | No | Detailed description |
| created_at | DateTime | Yes | Case creation timestamp |
| updated_at | DateTime | Yes | Last update timestamp |
| resolved_at | DateTime | No | Resolution timestamp |
| evidence_graph_id | UUID | No | Reference to EvidenceGraph |

**Relationships:**
- Belongs to: Patient
- Has many: ClinicalEncounter, ECGStudy, ImagingStudy, DiagnosticReport
- Has one: EvidenceGraph
- FHIR Equivalent: `EpisodeOfCare` (extended for cardiology)

**Implementation:**
- `backend/app/cardiotwin/models/cardiac_case.py` (existing, extended)

---

### 3.3 ClinicalEncounter

**Purpose:** Represents a patient interaction with healthcare services

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| encounter_type | Code | Yes | Type of encounter (outpatient, inpatient, emergency, etc.) |
| date | Date | Yes | Date of encounter |
| start_time | DateTime | No | Start time |
| end_time | DateTime | No | End time |
| reason | CodeableConcept | No | Reason for encounter |
| location | Reference | No | Location reference |
| status | Enum | Yes | planned, arrived, in-progress, completed, cancelled |
| chief_complaint | Text | No | Patient's chief complaint |

**Relationships:**
- Belongs to: CardiacCase, Patient
- Has many: ClinicalObservation
- FHIR Equivalent: `Encounter`

---

### 3.4 ClinicalObservation (Core FHIR Entity)

**Purpose:** Individual clinical measurement or finding

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| encounter_id | UUID | No | Reference to ClinicalEncounter |
| code | CodeableConcept | Yes | Observation type (LOINC code) |
| subject | Reference | Yes | Reference to Patient |
| effective | DateTime | No | Observation date/time |
| issued | DateTime | No | When result was issued |
| value | Varied | No | Actual value (Quantity, String, Boolean, etc.) |
| status | Enum | Yes | registered, preliminary, final, amended, cancelled |
| reliability | Enum | No | questionable, unreliable, reliable |
| category | CodeableConcept | No | Classification (vital-signs, laboratory, etc.) |
| interpretation | CodeableConcept | No | Clinical interpretation |

**Cardiovascular-Specific Extensions:**
- `cardiac_category`: ECG, echocardiography, biomarkers, blood_pressure, heart_rate
- `lead_position`: For ECG observations
- `anatomical_location`: Heart chamber, vessel, etc.

**Relationships:**
- Belongs to: CardiacCase, ClinicalEncounter, Patient
- Has many: EvidenceNode (in EvidenceGraph)
- FHIR Equivalent: `Observation`

**Implementation:**
- Extended for cardiovascular-specific observations

---

### 3.5 ECGStudy

**Purpose:** Represents a complete ECG recording and its analysis

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| study_date | DateTime | Yes | Date of ECG recording |
| recording_duration | Duration | No | Total recording duration |
| num_leads | Integer | Yes | Number of ECG leads |
| lead_types | List[Code] | Yes | Lead identifiers (I, II, III, aVR, aVL, aVF, V1-V6) |
| sampling_rate | Integer | Yes | Samples per second |
| voltage_scale | Float | No | mV per mm |
| paper_speed | Float | No | mm per second |
| device_info | String | No | ECG device information |
| quality_score | Float | No | Signal quality score (0-1) |
| is_holter | Boolean | No | Whether this is a Holter monitor recording |

**Relationships:**
- Belongs to: CardiacCase
- Has many: ECGLead (individual leads), ECGObservation
- Has one: ECGAnalysis
- FHIR Equivalent: `DiagnosticReport` with ECG observations

**Cardiovascular-Specific:**
- Full 12-lead ECG support
- Rhythm analysis capabilities
- Arrhythmia detection integration

---

### 3.6 ImagingStudy

**Purpose:** Represents a cardiac imaging study (MRI, CT, Echo, etc.)

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| study_date | DateTime | Yes | Date of imaging study |
| modality | Code | Yes | Imaging modality (MRI, CT, Echo, etc.) |
| study_type | Code | No | Type of study (rest, stress, contrast-enhanced) |
| body_site | Code | No | Anatomical site (heart, chest, etc.) |
| series_count | Integer | No | Number of series in study |
| instance_count | Integer | No | Number of images |
| pixel_spacing | Float | No | Image resolution |
| slice_thickness | Float | No | Slice thickness |
| dimensions | List[Integer] | No | Image dimensions |
| dicom_uid | String | No | DICOM study instance UID |
| quality_score | Float | No | Image quality score (0-1) |

**Relationships:**
- Belongs to: CardiacCase
- Has many: ImagingSeries, ImagingInstance, CardiacSegmentation
- FHIR Equivalent: `ImagingStudy`

**Cardiovascular-Specific:**
- Cardiac MRI support (CINE, LGE, T1/T2 mapping)
- Echocardiography support (2D, 3D, Doppler)
- CT angiography support
- DICOM metadata preservation

---

### 3.7 DiagnosticReport

**Purpose:** Formal clinical report interpreting observations and studies

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| study_id | UUID | No | Reference to ImagingStudy or ECGStudy |
| report_type | Code | Yes | Type of report (ECG, Echo, Cardiac MRI, etc.) |
| status | Enum | Yes | preliminary, final, corrected, appended |
| issued_date | DateTime | Yes | When report was issued |
| effective_period | Period | No | Time period report covers |
| conclusion | Text | No | Clinical conclusion |
| findings | Text | No | Key findings |
| recommendations | Text | No | Clinical recommendations |
| impression | Text | No | Clinical impression |
| author | Reference | No | Who authored the report |
| verified_by | Reference | No | Who verified the report |

**Relationships:**
- Belongs to: CardiacCase
- References: ImagingStudy, ECGStudy, ClinicalObservation
- Has many: EvidenceNode (in EvidenceGraph)
- FHIR Equivalent: `DiagnosticReport`

---

## 4. Evidence Graph Entities (NOVELTY CORE)

### 4.1 EvidenceGraph

**Purpose:** Container for versioned, connected cardiovascular evidence (NOVEL CORE)

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| version | Integer | Yes | Evidence graph version |
| created_at | DateTime | Yes | Creation timestamp |
| updated_at | DateTime | Yes | Last update timestamp |
| root_node_id | UUID | No | Root node of the graph |
| validation_status | Enum | Yes | valid, invalid, needs_review |
| validation_message | Text | No | Validation details |

**Implementation:**
- `backend/app/cardiotwin/models/evidence_graph.py` - EvidenceGraph class

**Capabilities:**
- Versioned graph structure
- Temporal alignment tracking
- Provenance chain preservation
- Contradiction detection
- Constraint validation

---

### 4.2 EvidenceNode

**Purpose:** Individual piece of evidence in the graph (NOVEL CORE)

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| graph_id | UUID | Yes | Reference to EvidenceGraph |
| node_type | Enum | Yes | Type of evidence |
| content | JSON | Yes | Evidence content (structure varies by type) |
| timestamp | DateTime | Yes | Evidence timestamp |
| source | String | Yes | Source system/identifier |
| provenance | JSON | Yes | Provenance information |
| confidence | Float | No | Confidence score (0-1) |
| validity | Enum | Yes | valid, questionable, invalid |
| version | Integer | Yes | Node version |

**Node Types:**
1. `ecg_observation` - ECG measurement or finding
2. `imaging_observation` - Imaging measurement or finding
3. `clinical_observation` - Clinical measurement or finding
4. `diagnostic_report` - Formal clinical report
5. `model_inference` - AI model prediction or inference
6. `digital_twin_state` - Digital twin state snapshot
7. `clinical_review` - Clinician review decision
8. `follow_up_task` - Follow-up task or requirement
9. `cardiac_segmentation` - Anatomical segmentation result
10. `simulation_run` - Simulation result

**Implementation:**
- `backend/app/cardiotwin/models/evidence_graph.py` - EvidenceNode class

---

### 4.3 EvidenceEdge

**Purpose:** Relationship between evidence nodes (NOVEL CORE)

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| source_node_id | UUID | Yes | Source EvidenceNode |
| target_node_id | UUID | Yes | Target EvidenceNode |
| relationship_type | Enum | Yes | Type of relationship |
| weight | Float | No | Relationship weight (0-1) |
| confidence | Float | No | Confidence in relationship (0-1) |
| created_at | DateTime | Yes | Creation timestamp |
| metadata | JSON | No | Additional metadata |

**Relationship Types:**
1. `observed_at` - Observation occurred at this time
2. `derived_from` - Derived from source evidence
3. `supports` - Supports the target evidence
4. `contradicts` - Contradicts the target evidence
5. `supersedes` - Supersedes previous evidence
6. `requires_review` - Requires human review
7. `generated_by` - Generated by this process/model
8. `belongs_to_case` - Belongs to this case

**Implementation:**
- `backend/app/cardiotwin/models/evidence_graph.py` - EvidenceEdge class

---

## 5. Digital Twin Entities

### 5.1 DigitalTwinInstance

**Purpose:** Patient-specific digital twin representation

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| version | Integer | Yes | Digital twin version |
| state | JSON | Yes | Current digital twin state |
| created_at | DateTime | Yes | Creation timestamp |
| updated_at | DateTime | Yes | Last update timestamp |
| validity_status | Enum | Yes | valid, stale, needs_sync |
| sync_timestamp | DateTime | No | Last synchronization time |
| validation_errors | JSON | No | Validation error details |

**Relationships:**
- Belongs to: CardiacCase
- Has many: SimulationRun
- Linked to: EvidenceGraph (via evidence nodes)

**Validation:**
- Synchronized with latest evidence
- All supporting evidence validated
- No detected contradictions
- Temporal alignment verified

---

### 5.2 CardiacSegmentation

**Purpose:** Anatomical segmentation of cardiac structures

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| study_id | UUID | Yes | Reference to ImagingStudy |
| segmentation_type | Code | Yes | Type (heart, chamber, vessel, etc.) |
| structures | List[Code] | Yes | Anatomical structures segmented |
| method | String | No | Segmentation method (manual, AI, algorithm) |
| model_version | String | No | AI model version (if applicable) |
| created_at | DateTime | Yes | Creation timestamp |
| quality_score | Float | No | Segmentation quality score |
| mesh_data | JSON | No | 3D mesh representation |

**Cardiovascular Structures:**
- Whole heart
- Left ventricle (LV)
- Right ventricle (RV)
- Left atrium (LA)
- Right atrium (RA)
- Myocardium
- Left anterior descending artery (LAD)
- Left circumflex artery (LCX)
- Right coronary artery (RCA)
- Aorta
- Pulmonary artery

---

### 5.3 SimulationRun

**Purpose:** Digital twin simulation execution

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| twin_id | UUID | Yes | Reference to DigitalTwinInstance |
| simulation_type | Code | Yes | Type of simulation (hemodynamics, electrophysiology, etc.) |
| parameters | JSON | Yes | Simulation parameters |
| started_at | DateTime | Yes | Start timestamp |
| completed_at | DateTime | No | Completion timestamp |
| status | Enum | Yes | pending, running, completed, failed, cancelled |
| results | JSON | No | Simulation results |
| error_message | Text | No | Error details (if failed) |
| validity_status | Enum | Yes | valid, outdated, needs_revalidation |

**Simulation Types:**
- Hemodynamic simulation
- Electrophysiology simulation
- Structural mechanics simulation
- Fluid dynamics simulation

---

## 6. Agent and Workflow Entities

### 6.1 AgentExecution

**Purpose:** Record of agent task execution

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| task_id | UUID | Yes | Unique task identifier |
| case_id | UUID | Yes | Reference to CardiacCase |
| agent_type | Code | Yes | Agent type (signal, imaging, evidence, consistency, simulation, clinical, verification, orchestrator) |
| status | Enum | Yes | queued, running, completed, failed, cancelled, awaiting_review |
| inputs | JSON | Yes | Task inputs |
| outputs | JSON | No | Task outputs |
| started_at | DateTime | No | Start timestamp |
| completed_at | DateTime | No | Completion timestamp |
| error | Text | No | Error message |
| retry_count | Integer | No | Number of retry attempts |
| provenance | JSON | Yes | Execution provenance |

**Agent Types:**
1. `signal_intelligence` - ECG and physiological signal processing
2. `imaging_intelligence` - Cardiac imaging analysis
3. `evidence_agent` - Clinical evidence retrieval and validation
4. `consistency_agent` - Cross-modality consistency checking
5. `simulation_agent` - Digital twin simulation coordination
6. `clinical_workflow` - Clinical workflow tracking
7. `verification_agent` - Output validation and verification
8. `orchestrator` - Multi-agent orchestration

---

### 6.2 WorkflowInstance

**Purpose:** Multi-stage workflow execution

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| workflow_type | Code | Yes | Workflow type (cardiac_case, evidence_continuity, imaging_analysis) |
| case_id | UUID | Yes | Reference to CardiacCase |
| status | Enum | Yes | pending, running, completed, failed, cancelled |
| current_stage | String | No | Current stage in workflow |
| stages | JSON | Yes | Workflow stage definitions |
| started_at | DateTime | No | Start timestamp |
| completed_at | DateTime | No | Completion timestamp |
| agent_executions | List[UUID] | No | References to AgentExecution records |

**Workflow Types:**
1. `cardiac_case` - 10-stage cardiac case workflow
2. `evidence_continuity` - 3-stage evidence continuity workflow
3. `imaging_analysis` - 5-stage imaging analysis workflow

---

## 7. Supporting Entities

### 7.1 ModelInference

**Purpose:** AI/ML model inference result

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| model_name | String | Yes | Model name |
| model_version | String | Yes | Model version |
| inference_type | Code | Yes | Type of inference (classification, segmentation, etc.) |
| inputs | JSON | Yes | Input data |
| outputs | JSON | Yes | Output predictions |
| confidence_scores | JSON | No | Confidence scores for predictions |
| executed_at | DateTime | Yes | Execution timestamp |
| execution_time_ms | Integer | No | Execution time in milliseconds |
| hardware_info | JSON | No | Hardware information |
| framework_info | JSON | No | Framework versions |

---

### 7.2 EvidenceArtifact

**Purpose:** File or data artifact supporting evidence

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| node_id | UUID | Yes | Reference to EvidenceNode |
| file_path | String | Yes | File path |
| file_type | Code | Yes | Type (DICOM, NIfTI, JSON, CSV, etc.) |
| file_size | Integer | Yes | File size in bytes |
| checksum | String | Yes | File checksum (SHA-256) |
| created_at | DateTime | Yes | Creation timestamp |
| metadata | JSON | No | Additional metadata |

---

### 7.3 AuditEvent

**Purpose:** Audit log entry for compliance and debugging

**Attributes:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| timestamp | DateTime | Yes | Event timestamp |
| event_type | Code | Yes | Type of event |
| user_id | UUID | No | User identifier |
| resource_type | Code | Yes | Resource type affected |
| resource_id | UUID | Yes | Resource identifier |
| action | Code | Yes | Action performed (create, read, update, delete) |
| details | JSON | No | Additional details |
| ip_address | String | No | IP address |
| user_agent | String | No | User agent string |

---

## 8. FHIR Alignment

### 8.1 Direct FHIR Mappings

| CardioTwin Entity | FHIR Resource | Notes |
|-------------------|---------------|-------|
| Patient | Patient | Direct mapping |
| CardiacCase | EpisodeOfCare | Extended for cardiology |
| ClinicalEncounter | Encounter | Direct mapping |
| ClinicalObservation | Observation | Extended for cardiology |
| ECGStudy | DiagnosticReport | With ECG-specific extensions |
| ImagingStudy | ImagingStudy | Direct mapping |
| DiagnosticReport | DiagnosticReport | Direct mapping |
| AuditEvent | AuditEvent | Direct mapping |

### 8.2 Cardiovascular Extensions

CardioTwin extends FHIR with cardiovascular-specific:
- Observation categories (ECG, echocardiography, biomarkers)
- Imaging study types (cardiac MRI, CT angiography)
- Anatomical structures (heart chambers, coronary arteries)
- Evidence relationships (supports, contradicts, derived_from)
- Digital twin concepts (not in standard FHIR)

---

## 9. Data Relationships

### 9.1 Primary Relationships

```
Patient 1────┬────┬──── CardiacCase
            │    │
            │    └── ClinicalEncounter
            │
            └── ClinicalObservation (via CardiacCase)

CardiacCase 1────┬──── EvidenceGraph
                 │
                 ├── ECGStudy
                 ├── ImagingStudy
                 └── DiagnosticReport

EvidenceGraph 1──── EvidenceNode *
                     │
                     └── EvidenceEdge * (connects nodes)

EvidenceNode *──── DigitalTwinInstance (via digital_twin_state nodes)

DigitalTwinInstance 1──── SimulationRun *

CardiacCase 1──── AgentExecution *
                 │
                 └── WorkflowInstance *
```

### 9.2 Cardinality Summary

| Parent Entity | Child Entity | Relationship | Cardinality |
|---------------|--------------|--------------|-------------|
| Patient | CardiacCase | has many | 1:N |
| Patient | ClinicalEncounter | has many | 1:N |
| Patient | ClinicalObservation | has many | 1:N |
| CardiacCase | ClinicalEncounter | has many | 1:N |
| CardiacCase | ECGStudy | has many | 1:N |
| CardiacCase | ImagingStudy | has many | 1:N |
| CardiacCase | DiagnosticReport | has many | 1:N |
| CardiacCase | EvidenceGraph | has one | 1:1 |
| CardiacCase | AgentExecution | has many | 1:N |
| CardiacCase | WorkflowInstance | has many | 1:N |
| EvidenceGraph | EvidenceNode | has many | 1:N |
| EvidenceGraph | EvidenceEdge | has many | 1:N |
| EvidenceNode | EvidenceEdge | source | 1:N |
| EvidenceNode | EvidenceEdge | target | 1:N |
| DigitalTwinInstance | SimulationRun | has many | 1:N |
| DigitalTwinInstance | EvidenceNode | linked | 1:N |

---

## 10. Document Navigation

This is **Part 2 of 5** in the Architecture Documentation series:

1. [01-system-overview.md](01-system-overview.md) - High-level system vision, layering, technology stack
2. **[02-domain-model.md](02-domain-model.md)** - This document: Detailed entity definitions and relationships
3. [03-service-architecture.md](03-service-architecture.md) - Service organization and responsibilities
4. [04-api-architecture.md](04-api-architecture.md) - API design, endpoints, and contracts
5. [05-data-flow.md](05-data-flow.md) - Detailed data flow diagrams and sequences

---

## 11. References

- [FINAL_STATUS.md](../FINAL_STATUS.md) - Complete project status
- [docs/integration/source-inventory.md](../integration/source-inventory.md) - Extracted projects inventory
- [backend/app/cardiotwin/models/evidence_graph.py](../../backend/app/cardiotwin/models/evidence_graph.py) - Evidence graph implementation
- [HL7 FHIR Specification](https://hl7.org/fhir/) - Healthcare data standard

---

*Document created: 2026-10-11*
*Author: CardioTwin Architecture Team*
*Classification: Internal - Architecture Documentation*
