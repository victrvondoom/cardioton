# Dependency Compatibility Analysis - Extracted Projects

**Project:** CardioTwin - Cardiovascular Intelligence Workspace
**Phase:** 0 - Repository Reconnaissance
**Document:** Dependency Compatibility Analysis
**Date:** 2026-10-11
**Status:** COMPLETE

---

## Overview

This document analyzes the **dependency compatibility** between the extracted projects and the existing CardioTwin codebase. It identifies:
- Current CardioTwin dependencies
- Each project's dependencies
- Compatibility issues
- Integration strategies
- Required adaptations

---

## CardioTwin Current Technology Stack

### Backend Stack

**Language & Framework:**
- Python 3.11+
- FastAPI (primary backend framework)
- Pydantic v2 (data validation)
- SQLAlchemy (ORM)
- Async support (asyncio)

**Database:**
- PostgreSQL (primary)
- SQLite (for testing)
- Redis (caching/sessions)

**AI/ML:**
- PyTorch
- scikit-learn
- Transformers (HuggingFace)
- Custom CardioTwin models

**Imaging:**
- MONAI (already integrated from heartAI-main)
- OpenCV
- PIL/Pillow
- NumPy

**API Clients:**
- requests
- httpx
- aiohttp

**Authentication:**
- OAuth2
- JWT
- FastAPI security utilities

**Testing:**
- pytest
- pytest-asyncio
- httpx for API testing
- Factory fixtures

**Observability:**
- structlog
- Prometheus metrics

**Frontend Stack:**
- Next.js (React)
- TypeScript
- Tailwind CSS
- Three.js (for 3D visualization)
- CesiumJS (for geospatial)

---

## Project Dependency Analysis

---

### 1. Axxess-main (MedScribe)

#### Current Dependencies
```
Framework:
- Expo SDK ~54
- React Native 0.81
- TypeScript ~5.9

AI:
- Google Gemini 2.5 Pro API
- whisper.rn 0.5.5 (ggml-small, 466 MB)

Database:
- expo-sqlite 16 (SQLite with WAL + foreign keys)
- Firebase Firestore 12.9
- AsyncStorage

Audio:
- expo-speech-recognition 3.1
- expo-av

UI:
- @expo/vector-icons (Ionicons)
- Expo Router v6
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Expo SDK** | ❌ No | INCOMPATIBLE | Mobile framework, CardioTwin is web-based |
| **React Native** | ❌ No | INCOMPATIBLE | Mobile, not web |
| **Google Gemini API** | ✅ Yes | COMPATIBLE | Can use same API |
| **whisper.rn** | ❌ No | INCOMPATIBLE | Mobile-specific Whisper, CardioTwin uses PyTorch |
| **expo-sqlite** | ❌ No | INCOMPATIBLE | Mobile SQLite, CardioTwin uses PostgreSQL |
| **Firebase Firestore** | ❌ No | INCOMPATIBLE | Different database |
| **AsyncStorage** | ❌ No | INCOMPATIBLE | Mobile storage |
| **expo-speech-recognition** | ❌ No | INCOMPATIBLE | Mobile audio |
| **expo-av** | ❌ No | INCOMPATIBLE | Mobile audio |
| **@expo/vector-icons** | ✅ Yes | COMPATIBLE | Icons can be replaced with web icons |
| **Expo Router** | ❌ No | INCOMPATIBLE | Mobile navigation |

#### Integration Strategy

**Approach:** **ADAPT** - Extract the logic, rewrite the interface for web

**Specific Adaptations:**
1. **ASR Transcription:**
   - Replace whisper.rn with PyTorch-based Whisper or existing CardioTwin audio processing
   - Alternatively, use Web Speech API for browser-based transcription
   - Keep the dual-ASR pipeline concept (cloud + on-device)

2. **Database:**
   - Replace expo-sqlite with PostgreSQL (CardioTwin's database)
   - Replace Firebase Firestore with CardioTwin's PostgreSQL
   - Map data schema to CardioTwin's FHIR-based models

3. **Audio Processing:**
   - Replace expo-speech-recognition with Web Audio API or PyAudio
   - Use FastAPI for audio upload and processing

4. **Frontend:**
   - Rewrite React Native components as React (web) components
   - Replace Expo-specific APIs with web equivalents
   - Use existing CardioTwin frontend patterns (Next.js, TypeScript)

5. **Authentication:**
   - Replace biometric auth with CardioTwin's JWT/OAuth2 system
   - Or implement web-based biometric auth if needed

#### Reusable Components

```python
# Backend (Python/Node.js logic - HIGH reusability)
✅ Clinical text processing logic
✅ ICD-10 coding algorithms
✅ Risk stratification logic
✅ Medication tracking logic
✅ Contradiction detection algorithms
✅ FHIR export functionality
✅ Language detection and translation

# Frontend (React Native - LOW reusability, needs porting)
⚠️  React components (can be ported to web React)
⚠️  State management patterns (can be adapted)
⚠️  UI/UX patterns (can be adapted to CardioTwin design system)

# Data Models (MEDIUM reusability)
⚠️  Patient, Encounter, DocumentReference (FHIR-compatible)
⚠️  Condition, Observation (FHIR-compatible)
```

#### Effort Estimation
- **Backend Logic Extraction:** LOW (2-3 days)
- **Database Migration:** MEDIUM (3-5 days)
- **Frontend Porting:** HIGH (1-2 weeks)
- **Audio Processing:** MEDIUM (3-5 days)
- **Total:** MEDIUM-HIGH (2-3 weeks)

---

### 2. Epicast-main

#### Current Dependencies
```
Language:
- Python 3.8+

AI Models:
- MedGemma 1.5 4B
- MedGemma 27B
- MedASR
- MedSigLIP

Configuration:
- PyYAML

Database:
- SQLite (default)
- Configurable (can use PostgreSQL)
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Python 3.8+** | ✅ Python 3.11+ | COMPATIBLE | CardioTwin uses newer Python |
| **MedGemma models** | ⚠️ No | INCOMPATIBLE | Requires Google HAI-DEF access |
| **MedASR** | ⚠️ No | INCOMPATIBLE | Requires Google HAI-DEF access |
| **MedSigLIP** | ⚠️ No | INCOMPATIBLE | Requires Google HAI-DEF access |
| **PyYAML** | ✅ Yes | COMPATIBLE | Already used in CardioTwin |
| **SQLite** | ✅ Yes | COMPATIBLE | CardioTwin uses for testing |
| **PostgreSQL** | ✅ Yes | COMPATIBLE | CardioTwin's primary database |

#### Integration Strategy

**Approach:** **EXTRACT + WRAP** - Extract the orchestration logic, wrap the model dependencies

**Specific Adaptations:**
1. **Model Access:**
   - Option A: Obtain Google HAI-DEF model access (preferred)
   - Option B: Replace with equivalent open-source models:
     - MedGemma → Mistral or Llama-based medical models
     - MedASR → Whisper (PyTorch-based)
     - MedSigLIP → Medical CLIP variants
   - Option C: Create abstraction layer for model interchangeability

2. **Database:**
   - Use CardioTwin's PostgreSQL (already compatible)
   - Map Epicast's data schema to CardioTwin's domain model

3. **Configuration:**
   - Keep YAML configuration (CardioTwin already uses it)
   - Adapt configuration schema to CardioTwin's patterns

#### Reusable Components

```python
# Backend (Python - HIGH reusability)
✅ Agent orchestration framework
✅ Multi-agent pipeline design
✅ Syndromic signal extraction logic
✅ Temporal validation algorithms
✅ Cross-modality validation logic
✅ Anomaly detection algorithms
✅ Time-series forecasting
✅ Outbreak probability scoring
✅ FHIR-compatible report generation
✅ Configuration management

# Data Models (HIGH reusability - FHIR-compatible)
✅ Syndromic signals schema
✅ Patient/encounter data structures
✅ Alert and notification models
```

#### Effort Estimation
- **Backend Logic Extraction:** LOW (1-2 days)
- **Model Access/Replacement:** HIGH (1-2 weeks, depends on model access)
- **Database Integration:** LOW (1-2 days)
- **Configuration Adaptation:** LOW (1 day)
- **Total:** MEDIUM-HIGH (2-3 weeks, mostly for model setup)

---

### 3. HopHacks-main (MedRelay)

#### Current Dependencies
```
Backend:
- Python Flask

AI:
- Google Gemini 2.0 Flash

Frontend:
- Simple HTML/CSS/JavaScript
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Python Flask** | ❌ FastAPI | INCOMPATIBLE | Different frameworks |
| **Google Gemini API** | ✅ Yes | COMPATIBLE | Can use same API |
| **Simple Web UI** | ✅ Next.js | PARTIAL | Needs upgrading to Next.js |

#### Integration Strategy

**Approach:** **WRAP + ADAPT** - Simple enough to wrap or rewrite

**Specific Adaptations:**
1. **Backend Framework:**
   - Rewrite Flask routes as FastAPI routes
   - Or wrap Flask app behind CardioTwin API
   - FastAPI is more modern and type-safe

2. **Frontend:**
   - Upgrade simple HTML/CSS/JS to Next.js/React
   - Use existing CardioTwin frontend patterns
   - Or embed as iframe (temporary solution)

3. **AI Integration:**
   - Use existing Google Gemini API access (if CardioTwin has it)
   - Or use CardioTwin's existing models

#### Reusable Components

```python
# Backend (Python - MEDIUM reusability)
⚠️  Text extraction logic
⚠️  ICD-10/CPT code lookup
⚠️  PDF generation (CMS-1500)

# Frontend (LOW reusability)
⚠️  Simple UI can be rebuilt in Next.js
```

#### Effort Estimation
- **Backend Rewriting:** LOW (1-2 days)
- **Frontend Upgrade:** LOW (1-2 days)
- **Total:** LOW (2-4 days)
- **Priority:** LOW (billing is not core to CardioTwin)

---

### 4. SafetyConnect-main

#### Current Dependencies
```
Hosting:
- Vercel

Frontend:
- Next.js (App Router, TypeScript, Tailwind)

Backend:
- Next.js API Routes
- Inngest (orchestration)

AI:
- xAI Grok (grok-4.3)

Database:
- ClickHouse (columnar analytics database)

Real-time:
- Inngest Realtime
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Vercel** | ✅ Vercel | COMPATIBLE | Both can deploy to Vercel |
| **Next.js** | ✅ Next.js | COMPATIBLE | Same framework, same version |
| **TypeScript** | ✅ TypeScript | COMPATIBLE | Same language |
| **Tailwind** | ✅ Tailwind | COMPATIBLE | Same CSS framework |
| **Inngest** | ❌ No | INCOMPATIBLE | Different orchestration system |
| **xAI Grok** | ⚠️ No | INCOMPATIBLE | Requires xAI API access |
| **ClickHouse** | ❌ PostgreSQL | INCOMPATIBLE | Different database |
| **Inngest Realtime** | ❌ No | INCOMPATIBLE | Different real-time system |

#### Integration Strategy

**Approach:** **ADAPT + CONSOLIDATE** - Next.js compatible, but different backend services

**Specific Adaptations:**
1. **Frontend:**
   - Directly reusable! Next.js components can be integrated
   - Use CardioTwin's design system and styling
   - Map to CardioTwin's routing

2. **Orchestration:**
   - Replace Inngest with CardioTwin's existing orchestration:
     - FastAPI BackgroundTasks
     - Celery (if CardioTwin has it)
     - Custom event-driven architecture
   - Or run Inngest alongside CardioTwin

3. **AI:**
   - Option A: Obtain xAI Grok API access
   - Option B: Replace with CardioTwin's models or open-source alternatives
   - Option C: Create abstraction layer for AI model interchangeability

4. **Database:**
   - Replace ClickHouse with PostgreSQL
   - ClickHouse is columnar for analytics, but PostgreSQL can handle most use cases
   - Or run ClickHouse alongside PostgreSQL for analytics

5. **Real-time:**
   - Replace Inngest Realtime with:
     - WebSockets (FastAPI)
     - Server-Sent Events
     - Firebase Realtime Database
     - Pusher or similar service

#### Reusable Components

```typescript
# Frontend (TypeScript/Next.js - HIGH reusability)
✅ Dashboard layout and components
✅ Alert display and management UI
✅ Real-time update patterns
✅ Patient cohort visualization
✅ Authentication flows
✅ Responsive design patterns

# Backend (Next.js API Routes - MEDIUM reusability)
⚠️  FDA recall ingestion logic
⚠️  Alert generation algorithms
⚠️  Severity triage logic
⚠️  API route patterns (can be adapted to FastAPI)
```

#### Effort Estimation
- **Frontend Integration:** LOW (3-5 days)
- **Orchestration Replacement:** MEDIUM (5-7 days)
- **AI Replacement:** HIGH (1-2 weeks, depends on xAI access)
- **Database Migration:** MEDIUM (5-7 days)
- **Real-time Replacement:** MEDIUM (5-7 days)
- **Total:** HIGH (3-5 weeks)
- **Priority:** HIGH (patient safety is valuable for cardiology)

---

### 5. SlicerHeart-master

#### Current Dependencies
```
Core:
- 3D Slicer (base platform)
- C++17
- CMake 3.0+

Libraries:
- VTK (Visualization Toolkit)
- ITK (Insight Segmentation and Registration Toolkit)
- DCMTK (DICOM Toolkit)

Build System:
- CMake
- CTest
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **3D Slicer** | ❌ No | INCOMPATIBLE | Desktop application, CardioTwin is web-based |
| **C++17** | ❌ Python | INCOMPATIBLE | Different languages |
| **CMake** | ❌ No | INCOMPATIBLE | Different build systems |
| **VTK** | ❌ No | INCOMPATIBLE | C++ visualization library |
| **ITK** | ❌ No | INCOMPATIBLE | C++ imaging library |
| **DCMTK** | ❌ No | INCOMPATIBLE | C++ DICOM library |

#### Integration Strategy

**Approach:** **WRAP + EXTRACT** - Create Python bindings or extract algorithms

**Specific Adaptations:**

1. **Option A: Python Bindings (Preferred)**
   - Use Pybind11 to create Python bindings for SlicerHeart
   - Expose key functions as Python API
   - Use in CardioTwin backend
   - **Effort:** HIGH (2-4 weeks)
   - **Benefit:** Full native performance

2. **Option B: Algorithm Extraction**
   - Extract the algorithms from C++ to Python
   - Use SimpleITK (Python bindings for ITK)
   - Use vtk (Python bindings for VTK)
   - Use pydicom (Python DICOM library)
   - **Effort:** HIGH (3-5 weeks)
   - **Benefit:** Pure Python, easier maintenance

3. **Option C: Subprocess Wrapper**
   - Run 3D Slicer as subprocess with SlicerHeart extension
   - Communicate via CLI or temporary files
   - **Effort:** MEDIUM (1-2 weeks)
   - **Benefit:** Fast to implement, but less elegant

4. **Option D: Docker Integration**
   - Run 3D Slicer + SlicerHeart in Docker container
   - Expose API via custom microservice
   - **Effort:** MEDIUM (1-2 weeks)
   - **Benefit:** Isolated, but adds complexity

#### Reusable Components

```python
# Algorithms (C++ - HIGH value, needs porting)
✅ DICOM ultrasound import plugins
✅ Philips 4D US DICOM patcher
✅ 4D cine-MRI reconstruction
✅ Echo Volume Render algorithm
✅ Valve View visualization
✅ Valve annulus analysis
✅ Valve segmentation
✅ Leaflet analysis
✅ Papillary analysis
✅ Carto Export
✅ Mimics import
```

#### Effort Estimation
- **Python Bindings:** HIGH (2-4 weeks)
- **Algorithm Extraction:** HIGH (3-5 weeks)
- **Subprocess Wrapper:** MEDIUM (1-2 weeks)
- **Docker Integration:** MEDIUM (1-2 weeks)
- **Recommended:** Start with subprocess wrapper for quick integration, then create Python bindings
- **Total for Phase 1:** MEDIUM (1-2 weeks for basic integration)
- **Total for Phase 2:** HIGH (3-5 weeks for full native integration)

---

### 6. case-twin-main

#### Current Dependencies
```
Backend:
- Python 3.11+
- FastAPI
- MedGemma
- MedSigLIP
- CrewAI
- Qdrant
- GCP Cloud Run (deployment)

Frontend:
- React 18
- TypeScript
- Tailwind CSS

Database:
- PostgreSQL (metadata)
- Qdrant (vector database)

Testing:
- pytest
- pytest-asyncio

Deployment:
- Docker
- GCP Cloud Run
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Python 3.11+** | ✅ Python 3.11+ | COMPATIBLE | Same Python version |
| **FastAPI** | ✅ FastAPI | COMPATIBLE | Same web framework |
| **MedGemma** | ⚠️ No | INCOMPATIBLE | Requires Google HAI-DEF access |
| **MedSigLIP** | ⚠️ No | INCOMPATIBLE | Requires Google HAI-DEF access |
| **CrewAI** | ❌ No | INCOMPATIBLE | Different multi-agent framework |
| **Qdrant** | ❌ No | INCOMPATIBLE | Different vector database (CardioTwin may use Vespa) |
| **React 18** | ✅ React 18 | COMPATIBLE | Same frontend framework |
| **TypeScript** | ✅ TypeScript | COMPATIBLE | Same language |
| **Tailwind CSS** | ✅ Tailwind | COMPATIBLE | Same CSS framework |
| **PostgreSQL** | ✅ PostgreSQL | COMPATIBLE | Same database |
| **pytest** | ✅ pytest | COMPATIBLE | Same testing framework |
| **Docker** | ✅ Docker | COMPATIBLE | Same deployment |
| **GCP Cloud Run** | ✅ Vercel | PARTIAL | Different cloud, but both serverless |

#### Integration Strategy

**Approach:** **REUSE + CONSOLIDATE** - Highly compatible, can reuse most components

**Specific Adaptations:**
1. **Backend:**
   - Directly merge FastAPI routers with CardioTwin
   - Consolidate common dependencies
   - Resolve any version conflicts

2. **AI Models:**
   - Same as Epicast-main: Obtain HAI-DEF access or use alternatives
   - Note: case-twin uses both MedGemma and MedSigLIP

3. **Multi-Agent:**
   - Replace CrewAI with CardioTwin's existing or custom orchestration
   - Or keep CrewAI as a separate layer
   - CrewAI is a lightweight framework, so keeping it is feasible

4. **Vector Database:**
   - Replace Qdrant with Vespa (already in CardioTwin from heartAI-main)
   - Or run Qdrant alongside Vespa
   - Both are vector databases, so migration should be straightforward

5. **Frontend:**
   - Directly merge React components
   - Use CardioTwin's routing and design system
   - Map to CardioTwin's state management

6. **Deployment:**
   - Use CardioTwin's Vercel deployment
   - Or deploy case-twin separately and connect via API

#### Reusable Components

```python
# Backend (Python/FastAPI - HIGH reusability)
✅ MedSigLIP embedding generation
✅ Qdrant integration (can adapt to Vespa)
✅ Hybrid search (visual + contextual)
✅ Case profile extraction and matching
✅ CrewAI multi-agent orchestration
✅ FastAPI endpoints (search, extract, match)
✅ Docker configuration
✅ CI/CD pipeline

# Frontend (React/TypeScript - HIGH reusability)
✅ Case comparison components
✅ Upload interface
✅ Similar case visualization
✅ Specialist referral workflow UI

# Data Models (HIGH reusability)
✅ Case metadata schema
✅ Vector embedding schema
✅ Search result schema
```

#### Effort Estimation
- **Backend Integration:** LOW (1-3 days)
- **AI Model Setup:** HIGH (1-2 weeks, same as Epicast)
- **Vector Database Migration:** LOW (1-2 days)
- **Frontend Integration:** LOW (3-5 days)
- **Multi-Agent Adaptation:** LOW (1-2 days)
- **Total:** LOW-MEDIUM (1-2 weeks)
- **Priority:** CRITICAL (case similarity is core to CardioTwin)

---

### 7. grok-app-main (Memento)

#### Current Dependencies
```
Framework:
- Next.js (App Router)

Language:
- TypeScript

AI:
- xAI Grok (grok-voice-think-fast-1.1)
- xAI Grok (for judgment pass)

Memory:
- Supermemory

Database:
- Neon Postgres (serverless Postgres)

Deployment:
- Vercel
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Next.js** | ✅ Next.js | COMPATIBLE | Same framework |
| **TypeScript** | ✅ TypeScript | COMPATIBLE | Same language |
| **Vercel** | ✅ Vercel | COMPATIBLE | Same deployment |
| **xAI Grok** | ⚠️ No | INCOMPATIBLE | Requires xAI API access |
| **Supermemory** | ❌ No | INCOMPATIBLE | Different memory system |
| **Neon Postgres** | ✅ PostgreSQL | COMPATIBLE | Same database type |

#### Integration Strategy

**Approach:** **ADAPT + OPTIONAL** - Next.js compatible, but different AI and memory

**Specific Adaptations:**
1. **Frontend:**
   - Directly reusable! Next.js components can be integrated
   - Use CardioTwin's design system
   - Map to CardioTwin's routing

2. **AI:**
   - Replace xAI Grok with CardioTwin's models
   - Or obtain xAI Grok API access

3. **Memory:**
   - Replace Supermemory with:
     - CardioTwin's existing memory/caching
     - PostgreSQL for conversation history
     - Redis for session memory
     - Custom solution

4. **Database:**
   - Neon Postgres is compatible with CardioTwin's PostgreSQL
   - Can use same database instance

#### Reusable Components

```typescript
# Frontend (Next.js/TypeScript - HIGH reusability)
✅ Voice call UI
✅ Dashboard layout
✅ KPI visualization
✅ AI chat interface
✅ Trend analysis components

# Backend (Next.js API Routes - MEDIUM reusability)
⚠️  Call orchestration logic
⚠️  Cognitive assessment algorithms
⚠️  KPI extraction logic
```

#### Effort Estimation
- **Frontend Integration:** LOW (3-5 days)
- **AI Replacement:** HIGH (1-2 weeks, depends on xAI access)
- **Memory Replacement:** MEDIUM (3-5 days)
- **Total:** MEDIUM-HIGH (2-3 weeks)
- **Priority:** LOW (dementia focus, not core to cardiology)

---

### 8. hack-ireland-2025-team-9-main

#### Current Dependencies
```
Unknown - needs investigation
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| Unknown | Unknown | UNKNOWN | Needs investigation |

#### Integration Strategy
**Approach:** **QUARANTINE** - Investigate first, then decide

#### Effort Estimation
- **Investigation:** LOW (1 day)
- **Decision:** TBD after investigation

---

### 9. heartAI-main

#### Current Dependencies
```
Backend:
- Python 3.8+
- FastAPI
- MONAI
- PyTorch
- Vespa
- Three.js (backend? or frontend?)

Frontend:
- Next.js
- React
- Three.js

Imaging:
- NIfTI files
- DICOM files (potential)

Testing:
- pytest
```

#### Compatibility with CardioTwin

| Dependency | CardioTwin | Compatibility | Notes |
|-----------|------------|---------------|-------|
| **Python 3.8+** | ✅ Python 3.11+ | COMPATIBLE | CardioTwin uses newer Python |
| **FastAPI** | ✅ FastAPI | COMPATIBLE | Same framework |
| **MONAI** | ✅ MONAI | COMPATIBLE | Already integrated! |
| **PyTorch** | ✅ PyTorch | COMPATIBLE | Already used |
| **Vespa** | ✅ Vespa | COMPATIBLE | Already integrated! |
| **Three.js** | ✅ Three.js | COMPATIBLE | Used in CardioTwin frontend |
| **Next.js** | ✅ Next.js | COMPATIBLE | Same framework |
| **React** | ✅ React | COMPATIBLE | Same frontend |
| **pytest** | ✅ pytest | COMPATIBLE | Same testing |
| **NIfTI** | ✅ Yes | COMPATIBLE | CardioTwin supports NIfTI |
| **DICOM** | ⚠️ Partial | PARTIAL | Needs verification |

#### Integration Strategy

**Approach:** **REUSE DIRECTLY** - Highly compatible, already partially integrated!

**Status:** Already integrated into CardioTwin:
- Backend: `backend/app/integrations/heartai/`
- Frontend: Components available in `frontend/`

**Remaining Integration:**
1. Complete API endpoint integration
2. Full frontend component integration
3. Test suite integration

#### Reusable Components

```python
# Backend (Python/FastAPI - HIGH reusability)
✅ NIfTI file processing
✅ 3D CNN + Transformer embedding generation
✅ MONAI-based preprocessing (Resize, ScaleIntensity, ToTensor)
✅ Vespa vector search integration
✅ FastAPI endpoints (upload, search)
✅ Diagnosis system
✅ Clinical context extraction

# Frontend (Next.js/React - HIGH reusability)
✅ ECG Viewer with pan/zoom/markers
✅ Comparison Viewer with measurement tools
✅ Results Dashboard with AI explanation
✅ Upload page with drag-and-drop
✅ Heart 3D visualization component
```

#### Effort Estimation
- **Complete Integration:** LOW (3-5 days)
- **Testing:** LOW (1-2 days)
- **Total:** LOW (1 week)
- **Priority:** CRITICAL (highest cardiology value, already started)

---

## Dependency Compatibility Summary

### High Compatibility Projects (Effort: LOW)

| Project | Compatibility Score | Reason |
|---------|---------------------|--------|
| **heartAI-main** | 95% | Same stack (FastAPI, Next.js, MONAI, Vespa) |
| **case-twin-main** | 85% | Same stack (FastAPI, React, PostgreSQL) |
| **grok-app-main** | 80% | Next.js compatible (only AI differs) |
| **SafetyConnect-main** | 75% | Next.js compatible (orchestration & DB differ) |

### Medium Compatibility Projects (Effort: MEDIUM)

| Project | Compatibility Score | Reason |
|---------|---------------------|--------|
| **Epicast-main** | 70% | Python compatible (AI models differ) |
| **HopHacks-main** | 65% | Python + Flask (framework differs) |

### Low Compatibility Projects (Effort: HIGH)

| Project | Compatibility Score | Reason |
|---------|---------------------|--------|
| **Axxess-main** | 30% | Mobile (Expo/React Native) vs Web |
| **SlicerHeart-master** | 40% | C++/3D Slicer vs Python/Web |

### Unknown

| Project | Compatibility Score | Reason |
|---------|---------------------|--------|
| **hack-ireland-2025-team-9-main** | 0% | Needs investigation |

---

## Integration Feasibility Matrix

| Project | Effort | Priority | ROI | Recommendation |
|---------|--------|----------|-----|----------------|
| **heartAI-main** | LOW | CRITICAL | HIGH | **INTEGRATE IMMEDIATELY** |
| **case-twin-main** | LOW-MEDIUM | CRITICAL | HIGH | **INTEGRATE IMMEDIATELY** |
| **Epicast-main** | MEDIUM | HIGH | HIGH | **INTEGRATE NEXT** |
| **SafetyConnect-main** | HIGH | HIGH | MEDIUM | **INTEGRATE after core** |
| **SlicerHeart-master** | HIGH | CRITICAL | HIGH | **INTEGRATE after core** (start with wrapper) |
| **Axxess-main** | MEDIUM-HIGH | MEDIUM | MEDIUM | **ADAPT for cardiology** (lower priority) |
| **grok-app-main** | MEDIUM-HIGH | LOW | LOW | **OPTIONAL** |
| **HopHacks-main** | LOW | LOW | LOW | **OPTIONAL** |
| **hack-ireland-2025-team-9-main** | UNKNOWN | UNKNOWN | UNKNOWN | **INVESTIGATE** |

---

## Dependency Conflicts and Resolutions

### Version Conflicts

| Dependency | Project Version | CardioTwin Version | Conflict | Resolution |
|-----------|-----------------|--------------------|----------|------------|
| Python | 3.8+ (most projects) | 3.11+ | MINOR | Use 3.11+ (all compatible) |
| FastAPI | Latest (heartAI, case-twin) | Current | NONE | Already compatible |
| Next.js | Latest (SafetyConnect, grok-app) | Current | NONE | Already compatible |
| React | 18 (case-twin, heartAI) | Current | NONE | Already compatible |
| PyTorch | Latest (heartAI) | Current | NONE | Already compatible |
| MONAI | Latest (heartAI) | Current | NONE | Already integrated |
| Vespa | Latest (heartAI) | Current | NONE | Already integrated |

### Framework Conflicts

| Framework | Project | CardioTwin | Conflict | Resolution |
|-----------|---------|------------|----------|------------|
| Flask | HopHacks-main | FastAPI | DIFFERENT | Rewrite Flask as FastAPI |
| Expo/React Native | Axxess-main | Next.js/React | DIFFERENT | Port to web React |
| 3D Slicer/C++ | SlicerHeart-master | Python/Web | DIFFERENT | Create Python bindings or wrapper |
| Inngest | SafetyConnect-main | FastAPI/Celery | DIFFERENT | Use FastAPI BackgroundTasks or Celery |

### AI Model Conflicts

| Model | Project | CardioTwin | Conflict | Resolution |
|-------|---------|------------|----------|------------|
| MedGemma | Epicast-main, case-twin-main | ❌ No | MISSING | Obtain HAI-DEF access or use alternatives |
| MedASR | Epicast-main | ❌ No | MISSING | Use Whisper (PyTorch) or Web Speech API |
| MedSigLIP | Epicast-main, case-twin-main | ❌ No | MISSING | Use open-source medical CLIP variants |
| xAI Grok | SafetyConnect-main, grok-app-main | ❌ No | MISSING | Obtain xAI access or use alternatives |

**Recommended AI Model Strategy:**
1. **Primary:** Use CardioTwin's existing models (custom trained)
2. **Secondary:** Obtain access to HAI-DEF and xAI models if available
3. **Fallback:** Use open-source alternatives (Mistral, Llama, Whisper, etc.)
4. **Abstraction:** Create model abstraction layer for easy swapping

### Database Conflicts

| Database | Project | CardioTwin | Conflict | Resolution |
|----------|---------|------------|----------|------------|
| PostgreSQL | case-twin-main, heartAI-main | ✅ PostgreSQL | NONE | Use same instance |
| SQLite | Axxess-main, Epicast-main | ✅ SQLite | NONE | Use for testing/embedding |
| Firebase Firestore | Axxess-main | ❌ No | MISSING | Migrate to PostgreSQL |
| Qdrant | case-twin-main | ⚠️ Vespa | DIFFERENT | Migrate to Vespa or run both |
| ClickHouse | SafetyConnect-main | ❌ PostgreSQL | DIFFERENT | Use PostgreSQL or run ClickHouse alongside |

**Recommended Database Strategy:**
- **Primary:** PostgreSQL (for relational data)
- **Vector Search:** Vespa (already integrated from heartAI-main)
- **Analytics:** Use PostgreSQL with TimescaleDB extension, or ClickHouse alongside
- **Migration:** Create database adapter layer for flexibility

---

## Recommended Integration Order

### Phase 1: Foundation (Weeks 1-2) - High Compatibility, Critical Priority

1. **Complete heartAI-main integration** (3-5 days)
   - Already started, highly compatible
   - Critical for cardiac imaging

2. **Integrate case-twin-main** (5-7 days)
   - Highly compatible (FastAPI, React, PostgreSQL)
   - Critical for case similarity
   - Migrate Qdrant to Vespa

**Total Phase 1:** 1-2 weeks

### Phase 2: Core Capabilities (Weeks 3-4) - Medium Compatibility, High Priority

3. **Integrate Epicast-main multi-agent pipeline** (5-7 days)
   - Medium compatibility (AI models need setup)
   - High value for agentic orchestration
   - Resolve HAI-DEF model access

4. **Integrate Axxess-main clinical documentation** (5-7 days)
   - Low compatibility (mobile vs web)
   - Medium-high value for clinical notes
   - Port to web React + FastAPI

**Total Phase 2:** 2 weeks

### Phase 3: Specialized Capabilities (Weeks 5-6) - Low Compatibility, Medium-High Priority

5. **Integrate SlicerHeart-master** (10-14 days)
   - Low compatibility (C++ vs Python)
   - Critical value for medical imaging
   - Start with subprocess wrapper, then Python bindings

6. **Integrate SafetyConnect-main** (7-10 days)
   - Medium compatibility (Next.js yes, orchestration no)
   - High value for patient safety
   - Replace Inngest with CardioTwin's orchestration

**Total Phase 3:** 2-3 weeks

### Phase 4: Optional Enhancements (Weeks 7+) - Low Priority

7. **Integrate grok-app-main** (1-2 weeks) - Optional
8. **Integrate HopHacks-main** (3-5 days) - Optional
9. **Investigate hack-ireland-2025-team-9-main** (1 day) - TBD

---

## Dependency Management Strategy

### 1. Unified Dependency Management

**Create:** `requirements-unified.txt` for all Python dependencies

**Strategy:**
- Use **poetry** or **pip-tools** for dependency management
- Create **dependency groups** (backend, frontend, ai, testing, etc.)
- Resolve version conflicts using **dependency resolution tools**
- Document all dependencies in `docs/dependencies.md`

### 2. AI Model Abstraction Layer

**Create:** `app/cardiotwin/models/abstraction.py`

```python
class MedicalModelABC(ABC):
    """Abstract base class for medical AI models."""

    @abstractmethod
    def generate_embedding(self, input: Any) -> np.ndarray:
        pass

    @abstractmethod
    def generate_text(self, prompt: str, **kwargs) -> str:
        pass

    @abstractmethod
    def analyze_image(self, image: Image) -> dict:
        pass

class MedGemmaAdapter(MedicalModelABC):
    """Adapter for Google MedGemma models."""
    pass

class LocalModelAdapter(MedicalModelABC):
    """Adapter for local PyTorch models."""
    pass

class GrokAdapter(MedicalModelABC):
    """Adapter for xAI Grok models."""
    pass
```

### 3. Database Abstraction Layer

**Create:** `app/cardiotwin/database/abstraction.py`

```python
class VectorDatabaseABC(ABC):
    """Abstract base class for vector databases."""

    @abstractmethod
    def add_embedding(self, embedding: np.ndarray, metadata: dict) -> str:
        pass

    @abstractmethod
    def search(self, query: np.ndarray, k: int = 10) -> list:
        pass

class VespaAdapter(VectorDatabaseABC):
    """Adapter for Vespa vector search."""
    pass

class QdrantAdapter(VectorDatabaseABC):
    """Adapter for Qdrant vector database."""
    pass

class ClickHouseAdapter:
    """Adapter for ClickHouse analytics."""
    pass
```

### 4. Orchestration Abstraction Layer

**Create:** `app/cardiotwin/orchestration/abstraction.py`

```python
class WorkflowOrchestratorABC(ABC):
    """Abstract base class for workflow orchestration."""

    @abstractmethod
    def run_workflow(self, workflow_name: str, inputs: dict) -> dict:
        pass

    @abstractmethod
    def schedule_task(self, task: dict, delay: int = None) -> str:
        pass

class FastAPIOrchestrator(WorkflowOrchestratorABC):
    """FastAPI BackgroundTasks orchestrator."""
    pass

class InngestAdapter(WorkflowOrchestratorABC):
    """Adapter for Inngest orchestration."""
    pass
```

---

## Risk Assessment

### High Risk Items

1. **HAI-DEF Model Access**
   - **Risk:** HIGH - May not have access to MedGemma, MedASR, MedSigLIP
   - **Impact:** HIGH - Epicast and case-twin depend on these
   - **Mitigation:**
     - Contact Google for HAI-DEF access
     - Use open-source alternatives as fallback
     - Create model abstraction layer for flexibility

2. **xAI Grok Access**
   - **Risk:** HIGH - May not have access to xAI Grok
   - **Impact:** MEDIUM - SafetyConnect and grok-app depend on this
   - **Mitigation:**
     - Contact xAI for API access
     - Use CardioTwin's existing models
     - Use open-source LLMs (Mistral, Llama)

3. **SlicerHeart C++ Integration**
   - **Risk:** HIGH - C++ to Python integration complexity
   - **Impact:** HIGH - Critical for medical imaging
   - **Mitigation:**
     - Start with subprocess wrapper (quick win)
     - Create Python bindings (long-term)
     - Use SimpleITK and VTK Python bindings

### Medium Risk Items

4. **Qdrant to Vespa Migration**
   - **Risk:** MEDIUM - Different vector databases
   - **Impact:** MEDIUM - case-twin uses Qdrant, CardioTwin uses Vespa
   - **Mitigation:**
     - Create migration script
     - Run both in parallel temporarily
     - Use abstraction layer

5. **ClickHouse Integration**
   - **Risk:** MEDIUM - New database for CardioTwin
   - **Impact:** MEDIUM - SafetyConnect requires ClickHouse
   - **Mitigation:**
     - Use PostgreSQL for most use cases
     - Run ClickHouse alongside for analytics
     - Use abstraction layer

### Low Risk Items

6. **Flask to FastAPI Migration**
   - **Risk:** LOW - Simple framework change
   - **Impact:** LOW - Only HopHacks-main uses Flask
   - **Mitigation:** Direct rewrite (1-2 days)

7. **Expo to Web Migration**
   - **Risk:** LOW - React Native to React web
   - **Impact:** MEDIUM - Axxess-main has valuable logic
   - **Mitigation:** Port components one by one

---

## Conclusion

### Summary of Compatibility

| Project | Compatibility | Effort | Priority | Recommendation |
|---------|---------------|--------|----------|----------------|
| **heartAI-main** | 95% | LOW | CRITICAL | **INTEGRATE NOW** |
| **case-twin-main** | 85% | LOW-MEDIUM | CRITICAL | **INTEGRATE NOW** |
| **Epicast-main** | 70% | MEDIUM | HIGH | **INTEGRATE NEXT** |
| **SafetyConnect-main** | 75% | HIGH | HIGH | **INTEGRATE after core** |
| **Axxess-main** | 30% | MEDIUM-HIGH | MEDIUM | **ADAPT for cardiology** |
| **SlicerHeart-master** | 40% | HIGH | CRITICAL | **INTEGRATE with wrapper** |
| **grok-app-main** | 80% | MEDIUM-HIGH | LOW | **OPTIONAL** |
| **HopHacks-main** | 65% | LOW | LOW | **OPTIONAL** |

### Key Success Factors

1. **Abstraction Layers:** Create abstraction layers for AI models, databases, and orchestration to enable flexibility
2. **Incremental Integration:** Integrate high-compatibility projects first, then tackle harder ones
3. **Model Access:** Secure access to HAI-DEF and xAI models, or have solid fallback plans
4. **Testing:** Comprehensive testing at each integration step to catch dependency issues early
5. **Documentation:** Document all integration decisions and dependency resolutions

### Estimated Timeline

- **Phase 1 (Core):** 2 weeks - heartAI + case-twin
- **Phase 2 (Agentic):** 2 weeks - Epicast + Axxess
- **Phase 3 (Specialized):** 3 weeks - SlicerHeart + SafetyConnect
- **Phase 4 (Optional):** 3 weeks - grok-app + HopHacks + investigation
- **Total:** 10 weeks (2.5 months) for full integration

---

**Document Generated:** 2026-10-11
**Status:** COMPLETE
**Next Review:** Upon completion of integration-plan.md
