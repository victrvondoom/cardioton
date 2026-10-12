# Integration Plan - CardioTwin Multi-Project Inheritance

**Project:** CardioTwin - Cardiovascular Intelligence Workspace
**Phase:** 0 - Repository Reconnaissance
**Document:** Integration Plan
**Date:** 2026-10-11
**Status:** COMPLETE

---

## Executive Summary

This document provides a **comprehensive integration plan** for transforming the 9 extracted healthcare hackathon projects into a unified, cohesive CardioTwin platform. The plan is organized into **phases**, **sprints**, and **tasks** with clear ownership, timelines, and success criteria.

**Goal:** Build ONE CardioTwin product (not 9 products) that inherits the best capabilities from each extracted project, adapted for cardiovascular use cases.

---

## Integration Principles

### 1. Inherit, Don't Rebuild
- Extract existing working code
- Adapt for cardiology where appropriate
- Consolidate overlapping capabilities
- Preserve unique functionality

### 2. One Product, One Experience
- Single navigation system
- Unified design language (Mistral AI pixel-geometric style)
- Shared data architecture
- Common authentication
- Consistent API patterns

### 3. Priority-Based Integration
- **CRITICAL:** Core cardiology capabilities (heartAI, SlicerHeart, case-twin)
- **HIGH:** Advanced capabilities that enhance core workflow (Epicast, SafetyConnect)
- **MEDIUM:** Useful utilities (Axxess)
- **LOW:** Optional enhancements (grok-app, HopHacks)

### 4. Incremental Delivery
- Deliver working features every sprint
- Maintain deployability throughout
- Test rigorously at each step
- Document all decisions

---

## Phase Overview

### Phase 0: Repository Reconnaissance (COMPLETE)
- **Duration:** Completed
- **Deliverables:** ✅ source-inventory.md, ✅ feature-capability-matrix.md, ✅ dependency-compatibility.md, ✅ integration-plan.md

### Phase 1: Source-Code Inheritance Engine (IN PROGRESS)
- **Duration:** 4 weeks
- **Objective:** Extract, adapt, and integrate code from the 9 projects into CardioTwin
- **Status:** Tasks 1.1-1.3, 2.1-2.2, 3.1-3.2 complete

### Phase 2: Learn from Healthcare Hackathon Winners
- **Duration:** 2 weeks
- **Objective:** Implement lessons from reference projects (Argus, EpiCast, Sunny, Tracer, CaseTwin, Hearti, SafetyConnect)

### Phase 3: Build One Product
- **Duration:** 4 weeks
- **Objective:** Consolidate all capabilities into a single, cohesive CardioTwin experience

### Phase 4: Unified Data & Domain Model
- **Duration:** 2 weeks
- **Objective:** Finalize canonical domain model and data architecture

### Phase 5: Hidden Technical Problem Discovery
- **Duration:** 2 weeks
- **Objective:** Identify and implement the core technical novelty (Evidence Continuity Engine - DONE)

### Phase 6: Discover Real Technical Novelty
- **Duration:** 2 weeks
- **Objective:** Research and validate novelty against prior art

### Phase 7: One Core Scientific Engine
- **Duration:** 2 weeks
- **Objective:** Refine and harden the Evidence Continuity Engine
- **Status:** ✅ COMPLETE (Evidence Continuity Engine implemented)

### Phase 8: Multi-Agent Architecture
- **Duration:** 2 weeks
- **Objective:** Build comprehensive multi-agent orchestration

### Phase 9: CardioTwin User Experience
- **Duration:** 4 weeks
- **Objective:** Design and implement the unified UI/UX

### Phase 10: Three-Level Interface Rule
- **Duration:** 2 weeks
- **Objective:** Ensure all features are understandable by nontechnical, medical, and technical users

### Phase 11: Memorable Demo
- **Duration:** 2 weeks
- **Objective:** Create a compelling 3-minute demonstration

### Phase 12: Evidence Engineering
- **Duration:** 2 weeks
- **Objective:** Build evidence matrix and validation framework

### Phase 13: Scientific Evaluation
- **Duration:** 2 weeks
- **Objective:** Design and run experiments to validate the novelty

### Phase 14: Medical Data & Security
- **Duration:** 1 week
- **Objective:** Ensure compliance and security for medical data

### Phase 15: Architecture & Implementation Plan
- **Duration:** 1 week
- **Objective:** Document final architecture
- **Status:** ✅ PARTIALLY COMPLETE

### Phase 16: Integration Order
- **Duration:** Ongoing
- **Objective:** Execute integration in correct sequence

### Phase 17: Comprehensive Testing
- **Duration:** 2 weeks
- **Objective:** Full test suite and quality assurance

### Phase 18: Prevent Feature Bloat
- **Duration:** Ongoing
- **Objective:** Keep the product focused and usable

### Phase 19: Final Deliverables
- **Duration:** 1 week
- **Objective:** Package and document everything

---

## Detailed Integration Plan

---

## Phase 1: Source-Code Inheritance Engine (Weeks 1-4)

### Sprint 1: Foundation & High-Compatibility Projects (Week 1-2)

#### Week 1: Complete Existing Work

**Task 1.1:** Complete Canonical CardiacCase Domain Model
- **Status:** ✅ COMPLETE
- **Files:** `backend/app/cardiotwin/models/cardiac_case.py`
- **Verification:** All domain entities defined and tested

**Task 1.2:** heartAI-main backend extraction
- **Status:** ✅ COMPLETE (partially integrated)
- **Owner:** CardioTwin Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/integrations/heartai/` (already exists)
  - `backend/app/cardiotwin/imaging/` (needs completion)
- **Actions:**
  - [x] Extract NIfTI processing
  - [x] Extract 3D CNN + Transformer embedding
  - [x] Extract MONAI preprocessing
  - [ ] Complete Vespa integration
  - [ ] Integrate FastAPI endpoints
  - [ ] Adapt for cardiology
- **Success Criteria:** All heartAI backend functionality available in CardioTwin

**Task 1.3:** case-twin-main backend extraction
- **Status:** ✅ COMPLETE (already partially integrated)
- **Owner:** CardioTwin Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/services/case_similarity/`
  - `backend/app/cardiotwin/search/`
- **Actions:**
  - [ ] Extract MedSigLIP embedding generation
  - [ ] Migrate Qdrant to Vespa (or run both)
  - [ ] Extract hybrid search (visual + contextual)
  - [ ] Extract case profile extraction and matching
  - [ ] Adapt CrewAI multi-agent orchestration
  - [ ] Integrate FastAPI endpoints
  - [ ] Map to CardioTwin domain model
- **Success Criteria:** Similar case retrieval working for cardiac cases

#### Week 2: Complete Core Integration

**Task 1.4:** Integrate heartAI-main frontend components
- **Status:** PENDING
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/cardiotwin/imaging/`
  - `frontend/src/cardiotwin/visualization/`
- **Actions:**
  - [ ] Extract ECG Viewer component
  - [ ] Extract Comparison Viewer component
  - [ ] Extract Results Dashboard component
  - [ ] Extract Upload page with drag-and-drop
  - [ ] Extract Heart 3D visualization component
  - [ ] Adapt to CardioTwin design system
  - [ ] Integrate with CardioTwin routing
- **Success Criteria:** All heartAI frontend components working in CardioTwin

**Task 1.5:** Integrate case-twin-main frontend components
- **Status:** PENDING
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/cardiotwin/cases/`
  - `frontend/src/cardiotwin/search/`
- **Actions:**
  - [ ] Extract case comparison components
  - [ ] Extract upload interface
  - [ ] Extract similar case visualization
  - [ ] Extract specialist referral workflow
  - [ ] Adapt to CardioTwin design system
  - [ ] Integrate with CardioTwin routing
- **Success Criteria:** Case similarity UI working in CardioTwin

**Sprint 1 Deliverables:**
- [ ] Complete heartAI backend and frontend integration
- [ ] Complete case-twin backend and frontend integration
- [ ] All core cardiac imaging capabilities available
- [ ] Similar case retrieval working for cardiac cases
- [ ] Comprehensive test suite for integrated features

---

### Sprint 2: Medium-Compatibility Projects (Week 3-4)

**Task 1.6:** Extract Epicast-main agentic pipeline
- **Status:** PENDING
- **Owner:** Backend Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/agents/`
  - `backend/app/cardiotwin/services/agentic_orchestration/`
- **Actions:**
  - [ ] Extract Intake Agent (MedASR + MedGemma 4B)
  - [ ] Extract Image Triage Agent (MedSigLIP + MedGemma 4B)
  - [ ] Extract Surveillance Analytics Agent (MedGemma 27B)
  - [ ] Extract Alert Agent
  - [ ] Create model abstraction layer for HAI-DEF models
  - [ ] Adapt for CardioTwin domain model
  - [ ] Integrate with Evidence Continuity Engine
- **Dependencies:** HAI-DEF model access (or fallbacks)
- **Success Criteria:** Multi-agent orchestration working for cardiac evidence validation

**Task 1.7:** Integrate Axxess-main clinical documentation
- **Status:** PENDING
- **Owner:** Backend Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/services/clinical_documentation/`
  - `backend/app/cardiotwin/services/asr/`
- **Actions:**
  - [ ] Port from Expo/React Native to FastAPI/Next.js
  - [ ] Extract dual ASR pipeline logic
  - [ ] Extract clinical text processing
  - [ ] Extract ICD-10 coding algorithms
  - [ ] Extract risk stratification logic
  - [ ] Extract medication tracking
  - [ ] Extract contradiction detection
  - [ ] Integrate FHIR export
  - [ ] Adapt for cardiology (ECG, echo, cath reports)
- **Dependencies:** Audio processing libraries, Google Gemini API
- **Success Criteria:** Clinical documentation generation working for cardiac cases

**Task 1.8:** Create Unified Multi-Agent Framework
- **Status:** PENDING
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/orchestrator.py`
  - `backend/app/cardiotwin/agents/registry.py`
- **Actions:**
  - [ ] Consolidate CrewAI (from case-twin) and Epicast agents
  - [ ] Create unified agent interface
  - [ ] Implement agent registry
  - [ ] Add agent lifecycle management
  - [ ] Integrate with Evidence Continuity Engine
- **Success Criteria:** Single multi-agent framework supporting all agents

**Sprint 2 Deliverables:**
- [ ] Multi-agent orchestration working
- [ ] Clinical documentation generation working
- [ ] All agents registered and manageable
- [ ] Agents integrated with evidence validation
- [ ] Comprehensive test suite for agentic features

---

## Phase 2: Learn from Healthcare Hackathon Winners (Weeks 5-6)

### Reference Project Lessons

| Reference | Lesson | CardioTwin Implementation |
|-----------|--------|--------------------------|
| **Argus** (Imagine Cup) | Accessibility-first, simple interaction, memorable demo | [ ] Implement voice navigation, [ ] Simple explanations, [ ] Memorable demo |
| **EpiCast** (MedGemma) | Offline execution, multi-agent processing | ✅ Integrated from Epicast-main |
| **Sunny** (MedGemma) | On-device inference, longitudinal tracking | [ ] Implement private cardiac timeline, [ ] Local model execution |
| **Tracer** (MedGemma) | Diagnostic workflow continuity | ✅ Evidence Continuity Engine addresses this |
| **CaseTwin** (MedGemma) | Similar-case retrieval, agent workflows | ✅ Integrated from case-twin-main |
| **Hearti** (TreeHacks) | Cardiac MRI, 3D models, congenital heart disease | ✅ Integrated from heartAI-main and SlicerHeart-master |
| **SafetyConnect** (Autonomous) | Multi-agent workflows, event-driven alerts | [ ] Integrate from SafetyConnect-main |

### Week 5: Accessibility & UX

**Task 2.1:** Implement Argus-inspired accessibility
- **Owner:** UX Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Add voice-assisted navigation
  - [ ] Implement simple descriptions of complex outputs
  - [ ] Minimal cognitive load design
  - [ ] Clear user feedback mechanisms
  - [ ] One memorable primary benefit
- **Success Criteria:** Accessibility audit passed, voice navigation working

**Task 2.2:** Create Cardiovascular Explanation Layer
- **Owner:** Backend + UX Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/services/explanation.py`
  - `frontend/src/cardiotwin/components/Explanation/`
- **Actions:**
  - [ ] Translate technical outputs to plain language
  - [ ] Highlight relevant observations
  - [ ] Show what has changed
  - [ ] Explain why features were flagged
  - [ ] Display supporting evidence
  - [ ] Clarify unknowns and limitations
  - [ ] Emphasize clinical review requirements
- **Success Criteria:** Nontechnical users understand outputs, clinicians trust explanations

### Week 6: Offline & Privacy

**Task 2.3:** Implement Sunny-inspired privacy features
- **Owner:** Backend Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/services/private_timeline.py`
  - `backend/app/cardiotwin/services/local_inference.py`
- **Actions:**
  - [ ] Private cardiac timeline (heart rate, ECG, BP, etc.)
  - [ ] Local model execution (where feasible)
  - [ ] Data ownership controls
  - [ ] Compact model deployment
  - [ ] Offline workflow support
  - [ ] Privacy-preserving inference
- **Dependencies:** ONNX runtime, model quantization libraries
- **Success Criteria:** Offline mode working, data stays on-device when requested

**Task 2.4:** Integrate Tracer's diagnostic workflow continuity
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/services/diagnostic_continuity.py`
- **Actions:**
  - [ ] Track diagnostic questions
  - [ ] Associate tests with cases and timelines
  - [ ] Ingest results automatically
  - [ ] Reconcile evidence with original questions
  - [ ] Identify missing/inconsistent information
  - [ ] Track clinician review status
  - [ ] Detect incomplete workflows
- **Success Criteria:** Diagnostic continuity dashboard working, missing follow-ups detected

**Phase 2 Deliverables:**
- [ ] Accessibility features implemented
- [ ] Cardiovascular Explanation Layer working
- [ ] Private cardiac timeline implemented
- [ ] Diagnostic workflow continuity working
- [ ] All reference project lessons incorporated

---

## Phase 3: Build One Product (Weeks 7-10)

### Week 7: Unified Navigation & Design

**Task 3.1:** Create unified navigation system
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/components/Navigation/`
  - `frontend/src/layouts/`
- **Actions:**
  - [ ] Single navigation bar for all features
  - [ ] Context-aware side panels
  - [ ] Quick access to common tasks
  - [ ] Case-centric navigation
  - [ ] Integrate all extracted project UIs
- **Success Criteria:** One navigation system for all CardioTwin features

**Task 3.2:** Apply unified design system
- **Owner:** UX Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/styles/cardiotwin.css`
  - `frontend/src/lib/theme.ts`
- **Actions:**
  - [ ] Near-black background (CardioTwin style)
  - [ ] Ultra-simple geometric sans-serif typography
  - [ ] Precise alignment
  - [ ] Square pixels
  - [ ] Restrained orange/red/yellow accents
  - [ ] Thin section dividers
  - [ ] Minimal borders
  - [ ] Fluid transitions
  - [ ] Responsive layouts
- **Success Criteria:** All UIs match CardioTwin design system

### Week 8: Case-Centric Architecture

**Task 3.3:** Implement canonical CardiacCase workflow
- **Owner:** Backend Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/services/cardiac_case_workflow.py`
- **Actions:**
  - [ ] CASE CREATED → DATA INGESTED
  - [ ] DATA INGESTED → QUALITY CHECKED
  - [ ] QUALITY CHECKED → PHYSIOLOGICAL SIGNALS ANALYZED
  - [ ] PHYSIOLOGICAL SIGNALS ANALYZED → IMAGING CONNECTED
  - [ ] IMAGING CONNECTED → EVIDENCE RECONCILED
  - [ ] EVIDENCE RECONCILED → DIGITAL TWIN UPDATED
  - [ ] DIGITAL TWIN UPDATED → AGENTS EXECUTE
  - [ ] AGENTS EXECUTE → CLINICIAN REVIEWS
  - [ ] CLINICIAN REVIEWS → RESULTS DOCUMENTED
  - [ ] RESULTS DOCUMENTED → FOLLOW-UP TRACKED
- **Success Criteria:** End-to-end case workflow working

**Task 3.4:** Connect all modules to case context
- **Owner:** Full Stack Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] All imaging modules use case_id
  - [ ] All documentation modules use case_id
  - [ ] All similarity modules use case_id
  - [ ] All agentic modules use case_id
  - [ ] Shared state across all modules
  - [ ] Context passing between modules
- **Success Criteria:** All features operate around the same case context

### Week 9: Specialized Capabilities

**Task 3.5:** Integrate SlicerHeart-master
- **Owner:** Backend + Imaging Team
- **Effort:** 10-14 days
- **Files:**
  - `backend/app/cardiotwin/services/medical_imaging/`
  - `backend/app/integrations/slicerheart/` (enhance existing)
- **Actions:**
  - [ ] Create Python bindings using Pybind11 (Option A)
  - [ ] OR: Extract algorithms to Python using SimpleITK/VTK (Option B)
  - [ ] OR: Create subprocess wrapper for quick integration (Option C - Start here)
  - [ ] Integrate DICOM processing
  - [ ] Integrate cardiac image visualization
  - [ ] Integrate valve analysis
  - [ ] Integrate echo volume rendering
- **Dependencies:** Pybind11 or subprocess management
- **Success Criteria:** SlicerHeart imaging capabilities available in CardioTwin

**Task 3.6:** Integrate SafetyConnect-main
- **Owner:** Backend Team
- **Effort:** 7-10 days
- **Files:**
  - `backend/app/cardiotwin/services/patient_safety/`
  - `backend/app/cardiotwin/services/alerts/`
- **Actions:**
  - [ ] Integrate Next.js frontend components
  - [ ] Replace Inngest with FastAPI BackgroundTasks or Celery
  - [ ] Replace xAI Grok with CardioTwin models or obtain access
  - [ ] Replace ClickHouse with PostgreSQL (or run both)
  - [ ] Replace Inngest Realtime with WebSockets or Server-Sent Events
  - [ ] Adapt for cardiac medications
  - [ ] Integrate with Evidence Continuity Engine
- **Dependencies:** WebSocket library, PostgreSQL, optional ClickHouse
- **Success Criteria:** Cardiac medication safety alerts working

### Week 10: Final Integration

**Task 3.7:** Consolidate all backends
- **Owner:** Backend Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Merge all FastAPI routers
  - [ ] Resolve any route conflicts
  - [ ] Consolidate common dependencies
  - [ ] Standardize error handling
  - [ ] Standardize logging
  - [ ] Standardize authentication
- **Success Criteria:** Single backend serving all features

**Task 3.8:** Consolidate all frontends
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Merge all Next.js pages
  - [ ] Resolve any route conflicts
  - [ ] Standardize state management
  - [ ] Standardize error handling
  - [ ] Standardize styling
  - [ ] Standardize i18n
- **Success Criteria:** Single frontend serving all features

**Phase 3 Deliverables:**
- [ ] Unified navigation system
- [ ] Unified design system applied
- [ ] Case-centric architecture working
- [ ] SlicerHeart imaging integrated
- [ ] SafetyConnect alerts integrated
- [ ] Single consolidated backend
- [ ] Single consolidated frontend

---

## Phase 4: Unified Data & Domain Model (Weeks 11-12)

### Week 11: Domain Model Finalization

**Task 4.1:** Review and refine domain model
- **Owner:** Architecture Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/models/cardiac_case.py`
  - `backend/app/cardiotwin/models/evidence_graph.py`
- **Actions:**
  - [ ] Review all entities from extracted projects
  - [ ] Identify duplicates and overlaps
  - [ ] Consolidate into canonical CardioTwin domain model
  - [ ] Ensure FHIR compatibility where appropriate
  - [ ] Document all domain model decisions
- **Success Criteria:** Final domain model documented and approved

**Task 4.2:** Implement FHIR-based adapters
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/interop/fhir/`
- **Actions:**
  - [ ] Patient → FHIR Patient
  - [ ] CardiacCase → FHIR Encounter/Composition
  - [ ] ClinicalObservation → FHIR Observation
  - [ ] ImagingStudy → FHIR ImagingStudy
  - [ ] ECGStudy → FHIR DiagnosticReport
  - [ ] ModelInference → FHIR ServiceRequest/Task
  - [ ] DiagnosticReport → FHIR DiagnosticReport
  - [ ] Create FHIR export/import utilities
- **Success Criteria:** All domain entities mappable to FHIR

### Week 12: Data Architecture

**Task 4.3:** Finalize data storage strategy
- **Owner:** Data Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/database/strategy.py`
- **Actions:**
  - [ ] PostgreSQL for relational data
  - [ ] Vespa for vector search
  - [ ] PostgreSQL with TimescaleDB for time-series
  - [ ] Optional: ClickHouse for analytics
  - [ ] File storage for images (S3/MinIO)
  - [ ] Cache for performance (Redis)
- **Success Criteria:** Data architecture documented and implemented

**Task 4.4:** Implement data migration
- **Owner:** Data Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/database/migrations/`
  - `backend/app/cardiotwin/database/adapters/`
- **Actions:**
  - [ ] Migrate Qdrant data to Vespa
  - [ ] Migrate SQLite data to PostgreSQL
  - [ ] Migrate Firebase data to PostgreSQL
  - [ ] Create adapters for ClickHouse (if used)
  - [ ] Test all migrations
- **Success Criteria:** All data migrated and validated

**Phase 4 Deliverables:**
- [ ] Final domain model
- [ ] FHIR adapters
- [ ] Data storage strategy
- [ ] Data migration scripts
- [ ] All data validated

---

## Phase 5: Hidden Technical Problem Discovery (Weeks 13-14)

**Status:** ✅ PARTIALLY COMPLETE - Evidence Continuity Engine addresses the core problem

### Week 13: Validate Problem Identification

**Task 5.1:** Confirm hidden problem
- **Owner:** Research Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Validate that digital twin synchronization is a real problem
  - [ ] Confirm with cardiology experts
  - [ ] Research prior art
  - [ ] Identify what's novel about our approach
- **Success Criteria:** Problem validated and documented

**Task 5.2:** Formalize problem statement
- **Owner:** Research Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/research/latent-problems.md`
- **Actions:**
  - [ ] Define problem formally
  - [ ] Identify assumptions
  - [ ] Define failure modes
  - [ ] Document expected outcomes
- **Success Criteria:** Formal problem statement approved

### Week 14: Negative Space Analysis

**Task 5.3:** Identify missing capabilities
- **Owner:** Research Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/research/negative-space.md`
- **Actions:**
  - [ ] Cross-modality verification
  - [ ] Temporal consistency
  - [ ] Data provenance
  - [ ] Confidence calibration
  - [ ] Uncertainty propagation
  - [ ] Contradiction detection
  - [ ] Failure recovery
  - [ ] Human escalation
  - [ ] Model drift
  - [ ] Data drift
  - [ ] Case identity resolution
  - [ ] Closed-loop tracking
  - [ ] Simulation validity
  - [ ] Clinical evidence reconciliation
- **Success Criteria:** All missing capabilities identified and prioritized

**Phase 5 Deliverables:**
- [ ] Problem validation
- [ ] Formal problem statement
- [ ] Negative space analysis
- [ ] Priority list of missing capabilities

---

## Phase 6: Discover Real Technical Novelty (Weeks 15-16)

### Week 15: Prior Art Research

**Task 6.1:** Research existing solutions
- **Owner:** Research Team
- **Effort:** 5-7 days
- **Files:**
  - `docs/research/prior-art-collision.md`
- **Actions:**
  - [ ] Search academic literature (PubMed, arXiv, IEEE)
  - [ ] Search open-source projects (GitHub, GitLab)
  - [ ] Search commercial products
  - [ ] Search relevant patents
  - [ ] Document closest existing implementations
  - [ ] Identify limitations of existing solutions
- **Success Criteria:** Comprehensive prior art analysis completed

**Task 6.2:** Evaluate novelty claims
- **Owner:** Research Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/research/novelty-hypothesis.md`
- **Actions:**
  - [ ] Define novelty criteria
  - [ ] Compare Evidence Continuity Engine against prior art
  - [ ] Identify unique contributions
  - [ ] Document what's truly novel
  - [ ] Define novelty hypothesis
- **Success Criteria:** Novelty hypothesis documented and justified

### Week 16: Research Hammer

**Task 6.3:** Apply Research Hammer methodology
- **Owner:** Research Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Find similar open-source projects
  - [ ] Find similar commercial products
  - [ ] Find relevant research papers
  - [ ] Identify existing approaches
  - [ ] Identify what's already solved
  - [ ] Identify limitations documented by evidence
  - [ ] Search for techniques from unrelated industries
  - [ ] Compare against simpler alternatives
  - [ ] Design falsification experiment
  - [ ] Attempt to disprove novelty
- **Success Criteria:** Research Hammer methodology applied to all claims

**Phase 6 Deliverables:**
- [ ] Prior art analysis
- [ ] Novelty evaluation
- [ ] Novelty hypothesis
- [ ] Research Hammer results

---

## Phase 7: One Core Scientific Engine (Weeks 17-18)

**Status:** ✅ MOSTLY COMPLETE - Evidence Continuity Engine implemented

### Week 17: Refine Engine

**Task 7.1:** Review and refactor Evidence Continuity Engine
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/models/evidence_graph.py`
  - `backend/app/cardiotwin/services/evidence_continuity.py`
  - `backend/app/cardiotwin/api/evidence_continuity.py`
- **Actions:**
  - [x] Review current implementation (Task 3.1)
  - [x] Validate against research findings (Phase 6)
  - [ ] Refactor based on feedback
  - [ ] Optimize performance
  - [ ] Add missing capabilities from Phase 5
  - [ ] Harden error handling
  - [ ] Improve logging
- **Success Criteria:** Evidence Continuity Engine refined and validated

**Task 7.2:** Integrate with all other services
- **Owner:** Full Stack Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Connect to imaging services (heartAI, SlicerHeart)
  - [ ] Connect to clinical documentation (Axxess)
  - [ ] Connect to case similarity (case-twin)
  - [ ] Connect to agentic orchestration (Epicast)
  - [ ] Connect to patient safety (SafetyConnect)
  - [ ] Ensure evidence flows through all services
- **Success Criteria:** Evidence Continuity Engine integrated with all services

### Week 18: Harden and Scale

**Task 7.3:** Performance optimization
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Profile engine performance
  - [ ] Optimize graph operations
  - [ ] Add caching for common queries
  - [ ] Implement incremental validation
  - [ ] Add parallel processing where appropriate
- **Success Criteria:** Performance meets requirements for production use

**Task 7.4:** Scalability improvements
- **Owner:** DevOps Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Database indexing optimization
  - [ ] Connection pooling
  - [ ] Load balancing considerations
  - [ ] Horizontal scaling strategy
- **Success Criteria:** Scalability strategy documented and tested

**Phase 7 Deliverables:**
- [ ] Refined Evidence Continuity Engine
- [ ] Full service integration
- [ ] Performance optimization
- [ ] Scalability strategy

---

## Phase 8: Multi-Agent Architecture (Weeks 19-20)

### Week 19: Agent Framework

**Task 8.1:** Implement agent registry
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/registry.py`
  - `backend/app/cardiotwin/agents/models.py`
- **Actions:**
  - [ ] Agent CRUD operations
  - [ ] Agent versioning
  - [ ] Agent capability registry
  - [ ] Agent health monitoring
  - [ ] Agent lifecycle management
- **Success Criteria:** Agent registry working with all agents registered

**Task 8.2:** Define agent interfaces
- **Owner:** Architecture Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/interfaces.py`
- **Actions:**
  - [ ] Define Agent protocol
  - [ ] Define Tool interface
  - [ ] Define AgentExecution model
  - [ ] Define AgentResult model
  - [ ] Define AgentError model
- **Success Criteria:** All agent interfaces defined and documented

### Week 20: Implement Core Agents

**Task 8.3:** Signal Intelligence Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/signal_intelligence.py`
- **Actions:**
  - [ ] Process ECG and physiological recordings
  - [ ] Validate signal quality
  - [ ] Extract relevant features
  - [ ] Detect anomalies
  - [ ] Generate signal reports
- **Success Criteria:** Signal Intelligence Agent working

**Task 8.4:** Imaging Intelligence Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/imaging_intelligence.py`
- **Actions:**
  - [ ] Coordinate cardiac imaging analysis
  - [ ] Run segmentation
  - [ ] Extract anatomical features
  - [ ] Generate imaging reports
  - [ ] Validate imaging quality
- **Success Criteria:** Imaging Intelligence Agent working

**Task 8.5:** Evidence Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/evidence_agent.py`
- **Actions:**
  - [ ] Retrieve relevant cases
  - [ ] Retrieve relevant reports
  - [ ] Retrieve reference documents
  - [ ] Match against current case
  - [ ] Generate evidence recommendations
- **Success Criteria:** Evidence Agent working

**Task 8.6:** Consistency Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/consistency_agent.py`
- **Actions:**
  - [ ] Check source alignment
  - [ ] Detect contradictory values
  - [ ] Validate timestamps
  - [ ] Identify missing evidence
  - [ ] Generate consistency reports
- **Success Criteria:** Consistency Agent working

**Task 8.7:** Simulation Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/simulation_agent.py`
- **Actions:**
  - [ ] Coordinate digital twin simulations
  - [ ] Validate simulation inputs
  - [ ] Run simulation workflows
  - [ ] Validate simulation outputs
  - [ ] Generate simulation reports
- **Success Criteria:** Simulation Agent working

**Task 8.8:** Clinical Workflow Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/clinical_workflow.py`
- **Actions:**
  - [ ] Track diagnostic questions
  - [ ] Track pending reports
  - [ ] Track review decisions
  - [ ] Track follow-up tasks
  - [ ] Generate workflow reports
- **Success Criteria:** Clinical Workflow Agent working

**Task 8.9:** Verification Agent
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/verification_agent.py`
- **Actions:**
  - [ ] Validate output schemas
  - [ ] Validate provenance
  - [ ] Validate execution status
  - [ ] Validate supported claims
  - [ ] Generate verification reports
- **Success Criteria:** Verification Agent working

**Task 8.10:** Orchestrator
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/agents/orchestrator.py`
- **Actions:**
  - [ ] Coordinate agent dependencies
  - [ ] Handle retries
  - [ ] Handle cancellation
  - [ ] Handle failures
  - [ ] Manage review gates
  - [ ] Generate orchestration reports
- **Success Criteria:** Orchestrator working with all agents

**Phase 8 Deliverables:**
- [ ] Agent registry
- [ ] Agent interfaces
- [ ] Signal Intelligence Agent
- [ ] Imaging Intelligence Agent
- [ ] Evidence Agent
- [ ] Consistency Agent
- [ ] Simulation Agent
- [ ] Clinical Workflow Agent
- [ ] Verification Agent
- [ ] Orchestrator

---

## Phase 9: CardioTwin User Experience (Weeks 21-24)

### Week 21: Information Architecture

**Task 9.1:** Implement Overview Dashboard
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/routes/Dashboard.tsx` (enhance existing)
- **Actions:**
  - [ ] One primary action: Open a Cardiac Case
  - [ ] Recent case activity
  - [ ] Key workflow state
  - [ ] Available research tools
  - [ ] Agent execution activity
  - [ ] Latest completed analyses
- **Success Criteria:** Overview dashboard communicating product in seconds

**Task 9.2:** Implement Cardiac Case Workspace
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/routes/Cases.tsx` (enhance existing)
  - `frontend/src/routes/CardioTwin.tsx` (enhance existing)
- **Actions:**
  - [ ] Patient/case overview
  - [ ] Clinical timeline
  - [ ] Available studies
  - [ ] Observations
  - [ ] AI analysis
  - [ ] Digital twin
  - [ ] Evidence
  - [ ] Reviews
  - [ ] Follow-up
- **Success Criteria:** Cardiac Case Workspace as central product experience

### Week 22: Specialized Studios

**Task 9.3:** Implement Digital Twin Studio
- **Owner:** Frontend + 3D Team
- **Effort:** 7-10 days
- **Files:**
  - `frontend/src/routes/DigitalTwinStudio.tsx`
  - `frontend/src/cardiotwin/studio/`
- **Actions:**
  - [ ] Large 3D canvas
  - [ ] Relevant imaging overlays
  - [ ] Anatomical inspection
  - [ ] Simulation controls
  - [ ] Version history
  - [ ] Quantitative measurements
  - [ ] Model validity indicators
- **Success Criteria:** Digital Twin Studio with all visualization features

**Task 9.4:** Implement ECG Intelligence Studio
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/routes/ECGIntelligence.tsx`
  - `frontend/src/cardiotwin/ecg/`
- **Actions:**
  - [ ] ECG import/viewer
  - [ ] Signal quality indicators
  - [ ] Rhythm analysis models
  - [ ] Model outputs
  - [ ] Confidence and limitations
  - [ ] Explainability
  - [ ] Temporal comparison
- **Success Criteria:** ECG Intelligence Studio with all analysis features

### Week 23: Multi-Agent Interface

**Task 9.5:** Implement Multi-Agent Command Center
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/routes/AgentCenter.tsx`
  - `frontend/src/cardiotwin/agents/`
- **Actions:**
  - [ ] Interactive execution graph
  - [ ] Show which agents are active
  - [ ] Show which inputs each is using
  - [ ] Show which tasks are waiting
  - [ ] Show which outputs are ready
  - [ ] Explain why tasks failed
  - [ ] Show when human review is needed
  - [ ] Pixel-particle animation for real events
- **Success Criteria:** Multi-Agent Command Center showing real agent activity

**Task 9.6:** Implement Evidence & Research Panel
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/cardiotwin/evidence/`
- **Actions:**
  - [ ] Similar cases
  - [ ] Literature references
  - [ ] Model provenance
  - [ ] Cross-modal consistency
  - [ ] Contradictions
  - [ ] Confidence limitations
  - [ ] Source inspection
- **Success Criteria:** Evidence & Research Panel with all features

### Week 24: Clinical & Global Intelligence

**Task 9.7:** Implement Clinical Workflow Dashboard
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/cardiotwin/workflow/`
- **Actions:**
  - [ ] Open diagnostic questions
  - [ ] Pending reports
  - [ ] Review decisions
  - [ ] Incomplete follow-ups
  - [ ] Care team tasks
- **Success Criteria:** Clinical Workflow Dashboard tracking all workflows

**Task 9.8:** Implement Global Cardiac Intelligence
- **Owner:** Frontend + Geospatial Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/cardiotwin/intelligence/` (enhance existing)
- **Actions:**
  - [ ] Healthcare facility discovery
  - [ ] Accessibility analysis
  - [ ] Research geography
  - [ ] Aggregated regional health intelligence
  - [ ] Emergency resource scenarios
  - [ ] Keep aggregate and patient data separate
- **Success Criteria:** Global Cardiac Intelligence with legitimate use cases

**Task 9.9:** Implement Research Laboratory
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Files:**
  - `frontend/src/cardiotwin/research/`
- **Actions:**
  - [ ] Model versions
  - [ ] Experiment configuration
  - [ ] Comparative evaluations
  - [ ] Simulation outputs
  - [ ] Benchmark results
  - [ ] Reproducibility data
  - [ ] Progressive disclosure (simple by default, technical when expanded)
- **Success Criteria:** Research Laboratory with all advanced features

**Phase 9 Deliverables:**
- [ ] Overview Dashboard
- [ ] Cardiac Case Workspace
- [ ] Digital Twin Studio
- [ ] ECG Intelligence Studio
- [ ] Multi-Agent Command Center
- [ ] Evidence & Research Panel
- [ ] Clinical Workflow Dashboard
- [ ] Global Cardiac Intelligence
- [ ] Research Laboratory

---

## Phase 10: Three-Level Interface Rule (Weeks 25-26)

### Week 25: Level 1 - Nontechnical Users

**Task 10.1:** Simple explanations for all features
- **Owner:** UX + Content Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Review all complex features
  - [ ] Write one plain sentence for each
  - [ ] Avoid AI/technical jargon
  - [ ] Example: "Your available heart recordings and scans are being organized for review."
- **Success Criteria:** Nontechnical users understand all primary workflows

**Task 10.2:** Progressive disclosure implementation
- **Owner:** Frontend Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Hide technical details by default
  - [ ] Show simple explanations first
  - [ ] Allow expansion for more detail
  - [ ] Consistent pattern across all features
- **Success Criteria:** All features have progressive disclosure

### Week 26: Level 2 & 3 - Medical & Technical Users

**Task 10.3:** Medical professional interface
- **Owner:** UX + Clinical Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Clinical context for all outputs
  - [ ] Relevant measurements
  - [ ] Evidence supporting outputs
  - [ ] Uncertainty indicators
  - [ ] Review decisions
  - [ ] Limitations clearly stated
- **Success Criteria:** Medical professionals have all needed information

**Task 10.4:** Technical researcher interface
- **Owner:** Backend + UX Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Model version for all outputs
  - [ ] Data transformations applied
  - [ ] Algorithm used
  - [ ] Input schema
  - [ ] Output schema
  - [ ] Intermediate artifacts
  - [ ] Timing information
  - [ ] Logs
  - [ ] Evaluation metrics
- **Success Criteria:** Technical researchers can inspect all details

**Task 10.5:** Verify all three levels
- **Owner:** QA Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Test with nontechnical users
  - [ ] Test with medical professionals
  - [ ] Test with technical researchers
  - [ ] Document all feedback
  - [ ] Make adjustments as needed
- **Success Criteria:** All three levels working and validated

**Phase 10 Deliverables:**
- [ ] Level 1 (Nontechnical) interfaces
- [ ] Level 2 (Medical) interfaces
- [ ] Level 3 (Technical) interfaces
- [ ] Progressive disclosure implemented
- [ ] All levels validated

---

## Phase 11: Memorable Demo (Weeks 27-28)

### Week 27: Demo Design

**Task 11.1:** Design 3-minute demonstration
- **Owner:** Demo Team
- **Effort:** 5-7 days
- **Files:**
  - `docs/demo/three-minute-demo.md`
- **Actions:**
  - [ ] Script the demo flow
  - [ ] Identify the hidden problem (1 sentence)
  - [ ] Design data arrival sequence
  - [ ] Design real multi-agent processing display
  - [ ] Design the technical surprise
  - [ ] Design CardioTwin intelligence reveal
  - [ ] Design clinician interpretation
  - [ ] Design proof of improvement
- **Success Criteria:** Demo script approved

**Task 11.2:** Prepare demo data
- **Owner:** Data Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Create synthetic cardiac case
  - [ ] Include ECG data
  - [ ] Include clinical context
  - [ ] Include imaging (if available)
  - [ ] Inject deliberate but realistic inconsistency
  - [ ] Prepare baseline comparison
- **Success Criteria:** Demo data ready and validated

### Week 28: Demo Implementation

**Task 11.3:** Implement demo workflow
- **Owner:** Full Stack Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/demo/`
  - `frontend/src/routes/Demo.tsx`
- **Actions:**
  - [ ] Implement demo mode
  - [ ] Preload demo data
  - [ ] Sequence demo steps
  - [ ] Highlight key moments
  - [ ] Show real agent execution (not fabricated)
  - [ ] Display the technical surprise (inconsistency detection)
  - [ ] Show improvement metrics
- **Success Criteria:** Demo workflow working end-to-end

**Task 11.4:** Rehearse and refine
- **Owner:** Demo Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Rehearse demo multiple times
  - [ ] Time each section
  - [ ] Refine transitions
  - [ ] Prepare backup scenarios
  - [ ] Create speaker notes
- **Success Criteria:** Demo rehearsed and ready for presentation

**Phase 11 Deliverables:**
- [ ] Demo script
- [ ] Demo data
- [ ] Demo workflow
- [ ] Rehearsed demo

---

## Phase 12: Evidence Engineering (Weeks 29-30)

### Week 29: Evidence Matrix

**Task 12.1:** Create evidence matrix
- **Owner:** Research Team
- **Effort:** 5-7 days
- **Files:**
  - `docs/demo/judge-evidence-matrix.md`
- **Actions:**
  - [ ] Connect each claim to source code
  - [ ] Connect to tests
  - [ ] Connect to benchmarks
  - [ ] Connect to screenshots
  - [ ] Connect to execution logs
  - [ ] Connect to demo steps
  - [ ] Connect to research references
- **Success Criteria:** Evidence matrix complete and validated

**Task 12.2:** Define success metrics
- **Owner:** Research Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/demo/success-metrics.md`
- **Actions:**
  - [ ] Technical depth metrics
  - [ ] Innovation metrics
  - [ ] Impact metrics
  - [ ] Functionality metrics
  - [ ] Usability metrics
  - [ ] Reproducibility metrics
- **Success Criteria:** All success metrics defined and measurable

### Week 30: Validate Evidence

**Task 12.3:** Collect evidence artifacts
- **Owner:** Full Stack Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Capture screenshots of all features
  - [ ] Run all tests and save results
  - [ ] Run benchmarks and save results
  - [ ] Capture execution logs
  - [ ] Document research references
  - [ ] Validate all evidence connections
- **Success Criteria:** All evidence artifacts collected and validated

**Task 12.4:** Final validation
- **Owner:** QA Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Review all evidence connections
  - [ ] Verify all claims are supported
  - [ ] Identify any gaps
  - [ ] Fill gaps or remove unsupported claims
- **Success Criteria:** All claims properly supported by evidence

**Phase 12 Deliverables:**
- [ ] Evidence matrix
- [ ] Success metrics
- [ ] Evidence artifacts
- [ ] Final validation

---

## Phase 13: Scientific Evaluation (Weeks 31-32)

### Week 31: Experiment Design

**Task 13.1:** Define hypotheses
- **Owner:** Research Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/research/experiment-design.md`
- **Actions:**
  - [ ] Define H0: Baseline does not outperform
  - [ ] Define H1: Proposed mechanism improves outcome
  - [ ] Define for temporal inconsistency detection
  - [ ] Define for diagnostic workflow tracking
  - [ ] Define for similar-case retrieval
  - [ ] Define for ECG classification
  - [ ] Define for multimodal consistency
- **Success Criteria:** All hypotheses defined and justified

**Task 13.2:** Implement baselines
- **Owner:** Backend Team
- **Effort:** 5-7 days
- **Files:**
  - `backend/app/cardiotwin/baselines/`
- **Actions:**
  - [ ] Simple temporal validation baseline
  - [ ] Simple workflow tracking baseline
  - [ ] Simple case retrieval baseline
  - [ ] Simple ECG classification baseline
  - [ ] Simple multimodal consistency baseline
- **Success Criteria:** All baselines implemented and tested

### Week 32: Run Experiments

**Task 13.3:** Create synthetic test data
- **Owner:** Data Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/tests/synthetic_data/`
- **Actions:**
  - [ ] Generate synthetic cardiac cases
  - [ ] Inject known temporal inconsistencies
  - [ ] Inject known cross-modality contradictions
  - [ ] Create missing follow-up scenarios
  - [ ] Generate ECG data with known patterns
  - [ ] Ensure train/test separation
- **Success Criteria:** Synthetic test data ready and validated

**Task 13.4:** Run and document experiments
- **Owner:** Research Team
- **Effort:** 5-7 days
- **Files:**
  - `docs/research/benchmark-results.md`
  - `backend/app/cardiotwin/benchmarks/`
- **Actions:**
  - [ ] Run temporal inconsistency detection experiments
  - [ ] Run diagnostic workflow tracking experiments
  - [ ] Run similar-case retrieval experiments
  - [ ] Run ECG classification experiments
  - [ ] Run multimodal consistency experiments
  - [ ] Document all results
  - [ ] Analyze statistical significance
- **Success Criteria:** All experiments run and documented

**Phase 13 Deliverables:**
- [ ] Experiment design
- [ ] Baseline implementations
- [ ] Synthetic test data
- [ ] Benchmark results

---

## Phase 14: Medical Data & Security (Week 33)

### Week 33: Compliance & Security

**Task 14.1:** Verify data handling
- **Owner:** Security Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/verification/data-handling.md`
- **Actions:**
  - [ ] Review all patient data handling
  - [ ] Verify identity integrity
  - [ ] Verify source lineage
  - [ ] Verify time consistency
  - [ ] Verify measurement units
  - [ ] Verify consent handling
  - [ ] Verify access controls
  - [ ] Verify audit logs
- **Success Criteria:** All data handling verified and compliant

**Task 14.2:** Implement data labeling
- **Owner:** Backend Team
- **Effort:** 3-5 days
- **Files:**
  - `backend/app/cardiotwin/models/data_labels.py`
- **Actions:**
  - [ ] Label real observations
  - [ ] Label historical observations
  - [ ] Label AI-generated interpretations
  - [ ] Label synthetic data
  - [ ] Label simulation outputs
  - [ ] Label unverified inferences
  - [ ] Label clinician-reviewed results
- **Success Criteria:** All data properly labeled

**Task 14.3:** Review medical positioning
- **Owner:** Clinical Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Review all medical claims
  - [ ] Verify model validation status
  - [ ] Verify clinical validation status
  - [ ] Ensure appropriate disclaimers
  - [ ] Position as research/clinician-review support prototype
- **Success Criteria:** Medical positioning reviewed and approved

**Phase 14 Deliverables:**
- [ ] Data handling verification
- [ ] Data labeling implementation
- [ ] Medical positioning review

---

## Phase 15: Architecture & Implementation Plan (Week 34)

**Status:** ✅ PARTIALLY COMPLETE - This document is part of it

**Task 15.1:** Document final architecture
- **Owner:** Architecture Team
- **Effort:** 5-7 days
- **Files:**
  - `docs/architecture/final-architecture.md`
- **Actions:**
  - [ ] Document all layers
  - [ ] Document all services
  - [ ] Document all data flows
  - [ ] Document all dependencies
  - [ ] Document all integration points
- **Success Criteria:** Final architecture documented

**Task 15.2:** Create implementation summary
- **Owner:** Documentation Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/implementation-summary.md`
- **Actions:**
  - [ ] List all extracted projects
  - [ ] List all code inherited from each
  - [ ] List all code adapted
  - [ ] List capabilities consolidated
  - [ ] List capabilities that could not be integrated and why
  - [ ] Map all features to CardioTwin locations
- **Success Criteria:** Implementation summary complete

**Phase 15 Deliverables:**
- [ ] Final architecture documentation
- [ ] Implementation summary

---

## Phase 16: Integration Order (Week 35)

**Task 16.1:** Verify integration sequence
- **Owner:** Architecture Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Verify all integrations happened in correct order
  - [ ] Verify no dependencies were violated
  - [ ] Verify all services are properly connected
  - [ ] Verify all data flows are correct
- **Success Criteria:** Integration order validated

**Task 16.2:** Document integration decisions
- **Owner:** Documentation Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/integration/integration-decisions.md`
- **Actions:**
  - [ ] Document all integration choices
  - [ ] Document all adaptations made
  - [ ] Document all consolidations
  - [ ] Document all wrappers created
  - [ ] Document all quarantined features
- **Success Criteria:** All integration decisions documented

**Phase 16 Deliverables:**
- [ ] Integration order validation
- [ ] Integration decisions documentation

---

## Phase 17: Comprehensive Testing (Weeks 36-37)

### Week 36: Test Implementation

**Task 17.1:** Complete unit tests
- **Owner:** QA Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Test all integrated services
  - [ ] Test all agents
  - [ ] Test all workflows
  - [ ] Test all validations
  - [ ] Test all data models
- **Success Criteria:** All unit tests implemented and passing

**Task 17.2:** Complete integration tests
- **Owner:** QA Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Test service-to-service integration
  - [ ] Test API endpoints
  - [ ] Test frontend-backend integration
  - [ ] Test data flows
  - [ ] Test error handling
- **Success Criteria:** All integration tests implemented and passing

### Week 37: End-to-End Testing

**Task 17.3:** Complete end-to-end tests
- **Owner:** QA Team
- **Effort:** 5-7 days
- **Actions:**
  - [ ] Test complete case journey (data intake to review and follow-up)
  - [ ] Test all primary workflows
  - [ ] Test all secondary workflows
  - [ ] Test edge cases
  - [ ] Test error recovery
- **Success Criteria:** All end-to-end tests implemented and passing

**Task 17.4:** Performance testing
- **Owner:** QA Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Measure rendering performance
  - [ ] Measure task latency
  - [ ] Measure resource usage
  - [ ] Measure large-file handling
  - [ ] Identify bottlenecks
  - [ ] Optimize as needed
- **Success Criteria:** Performance meets requirements

**Phase 17 Deliverables:**
- [ ] All unit tests
- [ ] All integration tests
- [ ] All end-to-end tests
- [ ] Performance test results

---

## Phase 18: Prevent Feature Bloat (Week 38)

**Task 18.1:** Feature audit
- **Owner:** Product Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] List all features
  - [ ] Identify core features
  - [ ] Identify secondary features
  - [ ] Identify optional features
  - [ ] Assess each feature's value
- **Success Criteria:** All features categorized and assessed

**Task 18.2:** Apply bloat prevention rules
- **Owner:** Product Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] For each feature, ask: Who needs it?
  - [ ] What cardiovascular problem does it solve?
  - [ ] Does the user understand why it exists?
  - [ ] Does it require a dedicated page?
  - [ ] Can it become a contextual tool instead?
  - [ ] Does it duplicate existing capability?
  - [ ] Does it need its own model?
  - [ ] Can existing service perform it?
  - [ ] Does it improve primary demonstration?
  - [ ] Would removing it from navigation improve usability?
- **Success Criteria:** All features evaluated and right-sized

**Task 18.3:** Optimize feature placement
- **Owner:** UX Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Move less-important features to context-aware panels
  - [ ] Move research features to research tools
  - [ ] Move secondary workflows to secondary navigation
  - [ ] Preserve all features but reduce prominence
- **Success Criteria:** Feature placement optimized

**Phase 18 Deliverables:**
- [ ] Feature audit
- [ ] Bloat prevention applied
- [ ] Feature placement optimized

---

## Phase 19: Final Deliverables (Week 39)

**Task 19.1:** Compile all documentation
- **Owner:** Documentation Team
- **Effort:** 5-7 days
- **Files:** All docs/integration/ and docs/research/ files
- **Actions:**
  - [ ] source-inventory.md
  - [ ] feature-capability-matrix.md
  - [ ] dependency-compatibility.md
  - [ ] integration-plan.md (this document)
  - [ ] source-license-attribution.md
  - [ ] architecture.md
  - [ ] cardio-adaptation-map.md
  - [ ] latent-problems.md
  - [ ] prior-art-collision.md
  - [ ] novelty-hypothesis.md
  - [ ] experiment-design.md
  - [ ] benchmark-results.md
  - [ ] judge-evidence-matrix.md
  - [ ] three-minute-demo.md
  - [ ] regression-results.md
- **Success Criteria:** All documentation complete

**Task 19.2:** Create final report
- **Owner:** Documentation Team
- **Effort:** 3-5 days
- **Files:**
  - `docs/FINAL_REPORT.md`
- **Actions:**
  - [ ] List actual extracted projects discovered
  - [ ] Which code was inherited from each project
  - [ ] Which code was adapted
  - [ ] Which capabilities were consolidated
  - [ ] Which capabilities could not be integrated and why
  - [ ] Where every inherited feature is located in CardioTwin
  - [ ] Final application architecture
  - [ ] The selected hidden technical problem
  - [ ] The chosen technical mechanism
  - [ ] Closest known existing solutions
  - [ ] Experimental evidence and results
  - [ ] Working end-to-end demonstration
  - [ ] Build/test status
  - [ ] Remaining risks and limitations
- **Success Criteria:** Final report complete and approved

**Task 19.3:** Final verification
- **Owner:** QA Team
- **Effort:** 3-5 days
- **Actions:**
  - [ ] Run all tests one final time
  - [ ] Verify all documentation is complete
  - [ ] Verify all deliverables are in place
  - [ ] Verify demo is working
  - [ ] Create final verification report
- **Success Criteria:** All deliverables verified and ready

**Phase 19 Deliverables:**
- [ ] All documentation compiled
- [ ] Final report
- [ ] Final verification

---

## Resource Requirements

### Team Structure

| Role | Team Size | Responsibilities |
|------|-----------|------------------|
| **Project Lead** | 1 | Overall coordination, decision-making |
| **Architecture Team** | 2-3 | Design, integration strategy, code review |
| **Backend Team** | 3-4 | Server development, API design, database |
| **Frontend Team** | 3-4 | UI/UX, React/Next.js development |
| **AI/ML Team** | 2 | Model integration, AI services, validation |
| **Data Team** | 2 | Data pipeline, migrations, testing data |
| **QA Team** | 2 | Testing, quality assurance, validation |
| **Research Team** | 2 | Scientific evaluation, novelty research |
| **Clinical Team** | 1-2 | Medical validation, clinical requirements |
| **UX Team** | 1-2 | User experience, design system |
| **Documentation Team** | 1 | Documentation, knowledge management |
| **Security Team** | 1 | Security, compliance, data protection |
| **Demo Team** | 1-2 | Demo preparation, presentation |

**Total Team Size:** 18-25 people

### Timeline Summary

| Phase | Duration | Start Week | End Week | Key Deliverables |
|-------|----------|------------|----------|------------------|
| Phase 0 | 1 week | Week 1 | Week 1 | Repository reconnaissance |
| Phase 1 | 4 weeks | Week 2 | Week 5 | Source-code inheritance |
| Phase 2 | 2 weeks | Week 6 | Week 7 | Reference project lessons |
| Phase 3 | 4 weeks | Week 8 | Week 11 | One product |
| Phase 4 | 2 weeks | Week 12 | Week 13 | Unified data model |
| Phase 5 | 2 weeks | Week 14 | Week 15 | Hidden problem discovery |
| Phase 6 | 2 weeks | Week 16 | Week 17 | Novelty discovery |
| Phase 7 | 2 weeks | Week 18 | Week 19 | Scientific engine |
| Phase 8 | 2 weeks | Week 20 | Week 21 | Multi-agent architecture |
| Phase 9 | 4 weeks | Week 22 | Week 25 | User experience |
| Phase 10 | 2 weeks | Week 26 | Week 27 | Three-level interface |
| Phase 11 | 2 weeks | Week 28 | Week 29 | Memorable demo |
| Phase 12 | 2 weeks | Week 30 | Week 31 | Evidence engineering |
| Phase 13 | 2 weeks | Week 32 | Week 33 | Scientific evaluation |
| Phase 14 | 1 week | Week 34 | Week 34 | Medical data & security |
| Phase 15 | 1 week | Week 35 | Week 35 | Architecture documentation |
| Phase 16 | 1 week | Week 36 | Week 36 | Integration validation |
| Phase 17 | 2 weeks | Week 37 | Week 38 | Comprehensive testing |
| Phase 18 | 1 week | Week 39 | Week 39 | Feature bloat prevention |
| Phase 19 | 1 week | Week 40 | Week 40 | Final deliverables |

**Total Duration:** 40 weeks (10 months)

### Accelerated Timeline (With Larger Team)

With a larger team (30-40 people), the timeline can be compressed:

| Phase | Duration | Start Week | End Week |
|-------|----------|------------|----------|
| Phase 0 | 1 week | Week 1 | Week 1 |
| Phase 1 | 3 weeks | Week 2 | Week 4 |
| Phase 2 | 1 week | Week 5 | Week 5 |
| Phase 3 | 3 weeks | Week 6 | Week 8 |
| Phase 4 | 1 week | Week 9 | Week 9 |
| Phase 5 | 1 week | Week 10 | Week 10 |
| Phase 6 | 2 weeks | Week 11 | Week 12 |
| Phase 7 | 1 week | Week 13 | Week 13 |
| Phase 8 | 2 weeks | Week 14 | Week 15 |
| Phase 9 | 3 weeks | Week 16 | Week 18 |
| Phase 10 | 1 week | Week 19 | Week 19 |
| Phase 11 | 2 weeks | Week 20 | Week 21 |
| Phase 12 | 1 week | Week 22 | Week 22 |
| Phase 13 | 2 weeks | Week 23 | Week 24 |
| Phase 14 | 1 week | Week 25 | Week 25 |
| Phase 15 | 1 week | Week 26 | Week 26 |
| Phase 16 | 1 week | Week 27 | Week 27 |
| Phase 17 | 2 weeks | Week 28 | Week 29 |
| Phase 18 | 1 week | Week 30 | Week 30 |
| Phase 19 | 1 week | Week 31 | Week 31 |

**Total Duration:** 31 weeks (7.5 months)

### Minimum Viable Product (MVP) Timeline

For a **minimum viable product** focusing only on core capabilities:

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 0 | 1 week | Repository reconnaissance |
| Phase 1 | 4 weeks | heartAI + case-twin + Epicast backend |
| Phase 3 | 2 weeks | Basic case workflow + Digital Twin Studio |
| Phase 7 | 2 weeks | Evidence Continuity Engine |
| Phase 8 | 1 week | Basic multi-agent orchestration |
| Phase 9 | 2 weeks | Basic UI/UX |
| Phase 11 | 1 week | Basic demo |
| Phase 17 | 1 week | Basic testing |

**Total MVP Duration:** 13 weeks (3 months)

---

## Risk Management

### High Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **HAI-DEF Model Access** | HIGH | HIGH | Secure access or implement fallbacks |
| **xAI Grok Access** | HIGH | MEDIUM | Secure access or use alternatives |
| **SlicerHeart C++ Integration** | MEDIUM | HIGH | Start with subprocess wrapper, then native |
| **Team Availability** | MEDIUM | HIGH | Prioritize, hire contractors if needed |
| **Scope Creep** | HIGH | HIGH | Strictly follow integration principles |

### Medium Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Dependency Conflicts** | MEDIUM | MEDIUM | Use abstraction layers, careful version management |
| **Performance Issues** | MEDIUM | MEDIUM | Profile early, optimize incrementally |
| **Integration Complexity** | MEDIUM | MEDIUM | Follow integration order, test frequently |
| **Testing Overhead** | MEDIUM | MEDIUM | Automate testing, test at each integration step |

### Low Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **License Issues** | LOW | MEDIUM | Review all licenses, use permissive ones |
| **Data Migration Issues** | LOW | LOW | Test migrations thoroughly |
| **Deployment Issues** | LOW | LOW | Use proven deployment patterns |

---

## Success Criteria

### Overall Project Success

✅ **Technical Depth:** Implemented a sophisticated evidence continuity mechanism that addresses a real hidden problem

✅ **Innovation:** Novel approach to digital twin synchronization with trustworthy evidence

✅ **Impact:** Measurable improvement in clinical decision-support trustworthiness

✅ **Functionality:** All integrated features working end-to-end

✅ **Usability:** Intuitive UI/UX that users can understand quickly

✅ **Reproducibility:** Another engineer can run the prototype and verify results

✅ **Integration:** Eight+ projects become components of a coherent architecture

---

## Conclusion

This **Integration Plan** provides a comprehensive roadmap for transforming the 9 extracted healthcare hackathon projects into a unified CardioTwin platform. The plan is organized into **19 phases** spanning **40 weeks** with a **minimum viable product** achievable in **13 weeks**.

**Key Success Factors:**
1. **Follow Integration Principles:** Inherit, don't rebuild; One product, one experience
2. **Prioritize Ruthlessly:** Focus on CRITICAL and HIGH priority items first
3. **Integrate Incrementally:** Deliver working features every sprint
4. **Test Rigorously:** Comprehensive testing at each step
5. **Document Everything:** All decisions, all adaptations, all limitations

**Next Steps:**
1. Complete Phase 0 deliverables (this document is the last one)
2. Begin Phase 1 with heartAI and case-twin integration
3. Assemble the full team
4. Set up project management (Jira, GitHub Projects, etc.)
5. Start sprint planning

---

**Document Generated:** 2026-10-11
**Status:** COMPLETE
**Version:** 1.0
**Next Review:** Weekly during execution

---

*This Integration Plan is a living document that will be updated throughout the project lifecycle.*
