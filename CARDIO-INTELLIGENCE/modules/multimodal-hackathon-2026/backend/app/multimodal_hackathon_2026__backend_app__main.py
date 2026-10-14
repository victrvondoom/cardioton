from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .multimodal_hackathon_2026__backend_app__config import settings
from .routers import multimodal_hackathon_2026__app_routers__api as api

app = FastAPI(title="CardioFusion API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])
app.include_router(api.router)
