"""Local API and built-frontend serving with frozen-model inference."""

from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from backend.contracts import (
    ExplanationRequest,
    FeatureManifest,
    Health,
    ProfileRequest,
    ProfileValidation,
    validate_profile,
)
from backend.evidence import application_metadata, saved_evidence
from backend.explanations import ExplanationService
from backend.inference import InferenceService
from ml.common import ROOT, read_json
from ml.data import assert_feature_columns, dataset_config


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            response = await call_next(request)
        except Exception:
            response = JSONResponse(
                status_code=503,
                content={"detail": "Application operation unavailable; no results returned."},
            )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
            "base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        )
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response


def create_app(root: Path = ROOT) -> FastAPI:
    app = FastAPI(title="CardioScope", version="0.1.0")
    app.add_middleware(SecurityHeaders)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        # FastAPI's default error includes submitted values. Never echo profile bodies.
        return JSONResponse(
            status_code=422, content={"detail": "Invalid request structure or value type."}
        )

    @app.exception_handler(Exception)
    async def internal_failure(request, exc):
        return JSONResponse(
            status_code=503,
            content={"detail": "Application operation unavailable; no results returned."},
        )

    try:
        service = InferenceService(root)
        model_error = None
    except (OSError, ValueError, KeyError, RuntimeError, ImportError):
        service = None
        model_error = (
            "Frozen models unavailable. Verify the v1 files with make verify; "
            "restore missing or changed artifacts."
        )
    app.state.inference = service
    app.state.explanations = None
    explanation_lock = Lock()

    def manifest() -> FeatureManifest:
        if service is not None:
            return service.manifest
        path = root / "artifacts/data/feature_manifest.json"
        if not path.exists():
            raise HTTPException(503, detail="Verified dataset schema is unavailable.")
        result = FeatureManifest.model_validate(read_json(path))
        config = dataset_config(root)
        assert_feature_columns(result.feature_order, config)
        if result.dataset_zip_sha256 != config["zip_sha256"]:
            raise ValueError("Schema refers to an unverified source dataset")
        if list(result.targets) != list(config["targets"]):
            # JSON serialization sorts dictionary keys; compare sets and definitions below.
            if set(result.targets) != set(config["targets"]):
                raise ValueError("API target set differs from the source contract")
        if {k: v.model_dump() for k, v in result.targets.items()} != config["targets"]:
            raise ValueError("API target encodings differ from source contract")
        if [f.name for f in result.features] != result.feature_order:
            raise ValueError("API feature definitions differ from the feature order")
        return result

    @app.get("/api/health", response_model=Health)
    def health():
        return Health(
            data_prepared=(root / "artifacts/data/feature_manifest.json").exists(),
            anatomy_prepared=(root / "assets/anatomy/manifest.json").exists(),
            models_loaded=service is not None,
            model_error=model_error,
        )

    @app.get("/api/schema", response_model=FeatureManifest)
    def schema():
        try:
            return manifest()
        except (OSError, ValueError, KeyError) as exc:
            raise HTTPException(503, detail="Verified dataset schema is unavailable.") from exc

    @app.post("/api/profiles/validate", response_model=ProfileValidation)
    def profile_validation(profile: ProfileRequest):
        try:
            result = validate_profile(profile, manifest())
            result.model_version = service.version if service else None
            return result
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc)) from exc

    @app.get("/api/anatomy")
    def anatomy():
        path = root / "assets/anatomy/manifest.json"
        if not path.exists():
            raise HTTPException(
                503,
                detail="Anatomy not prepared. Run make verify and restore the frozen v1 assets.",
            )
        try:
            return read_json(path)
        except (OSError, ValueError) as exc:
            raise HTTPException(503, detail="Verified anatomy manifest unavailable.") from exc

    @app.post("/api/predict")
    def predict(profile: ProfileRequest):
        if service is None:
            raise HTTPException(503, detail=model_error)
        try:
            validate_profile(profile, manifest())
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc)) from exc
        try:
            return service.predict(profile)
        except Exception as exc:
            # Never return partial target outputs or echo a patient's submitted values.
            raise HTTPException(
                503, detail="Frozen-model prediction failed; no results returned."
            ) from exc

    @app.get("/api/examples")
    def examples():
        if service is None:
            raise HTTPException(503, detail=model_error)
        return {"examples": service.examples}

    @app.get("/api/metadata")
    def metadata():
        if service is None:
            raise HTTPException(503, detail=model_error)
        try:
            return application_metadata(service, root)
        except (OSError, ValueError, KeyError, RuntimeError, ImportError) as exc:
            raise HTTPException(503, detail="Verified explanation metadata unavailable.") from exc

    @app.get("/api/evidence")
    def evidence():
        if service is None:
            raise HTTPException(503, detail=model_error)
        try:
            return saved_evidence(service, root)
        except (OSError, ValueError, KeyError) as exc:
            raise HTTPException(
                503, detail="Verified saved evaluation evidence unavailable."
            ) from exc

    @app.post("/api/explain")
    def explain(request: ExplanationRequest):
        if service is None:
            raise HTTPException(503, detail=model_error)
        try:
            validate_profile(ProfileRequest(features=request.features), service.manifest)
            # Reject stale identities before any lazy import/reference/explanation work.
            from ml.common import object_digest

            if (
                request.profile_fingerprint != object_digest(request.features)
                or request.model_version != service.version
                or request.schema_fingerprint != service.protocol["schema_sha256"]
                or request.model_sha256 != service.checksums[request.target]
            ):
                raise ValueError("Explanation profile/model/schema identity mismatch")
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc)) from exc
        try:
            with explanation_lock:
                if app.state.explanations is None:
                    app.state.explanations = ExplanationService(service, root)
            return app.state.explanations.explain(request)
        except Exception as exc:
            raise HTTPException(
                503, detail="Verified explanation unavailable; numerical predictions remain valid."
            ) from exc

    @app.get("/api/model-information", response_class=PlainTextResponse)
    def model_information():
        if service is None:
            raise HTTPException(503, detail=model_error)
        return service.model_information

    @app.get("/api/{unknown_path:path}", include_in_schema=False)
    def unknown_api(unknown_path: str):
        raise HTTPException(404, detail="Unknown API route")

    mesh_dir = root / "assets/anatomy/meshes"
    if mesh_dir.is_dir():
        # Never expose source caches, dataset rows, raw labels, split IDs, or all repo files.
        app.mount("/anatomy/meshes", StaticFiles(directory=mesh_dir), name="anatomy-meshes")
    frontend_dist = root / "frontend/dist"
    if frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    return app


app = create_app()
