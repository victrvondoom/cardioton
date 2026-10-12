"""CardioTwin API Package.

This package contains API routers for CardioTwin's extended capabilities.

Routers:
- imaging.py: Cardiac imaging processing and embedding (from heartAI-main)
- case_routes.py: Similar case search (from case-twin-main)
- evidence_continuity.py: Evidence continuity endpoints
- clinical_extraction.py: Clinical text extraction (from Epicast-main)
- workflow_orchestration.py: Workflow orchestration (from SafetyConnect-main)
"""

from app.cardiotwin.api.case_routes import router as case_router
from app.cardiotwin.api.clinical_extraction import router as clinical_extraction_router
from app.cardiotwin.api.evidence_continuity import router as evidence_continuity_router
from app.cardiotwin.api.imaging import router as imaging_router
from app.cardiotwin.api.workflow_orchestration import router as workflow_orchestration_router

__all__ = ["imaging_router", "case_router", "evidence_continuity_router", "clinical_extraction_router", "workflow_orchestration_router"]
