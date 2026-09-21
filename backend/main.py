"""
HealthTwin AI FastAPI application entry point.

Run from the repository root with:
    uvicorn backend.main:app --reload

Or from the backend directory with:
    uvicorn main:app --reload
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Make backend/ importable regardless of whether Uvicorn is launched from
# the repository root or directly from backend/.
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load backend/.env locally. The file must never be committed.
load_dotenv(BACKEND_DIR / ".env")

from routes.assessment import router as assessment_router  # noqa: E402


logger = logging.getLogger("healthtwin.api")


def _cors_origins() -> list[str]:
    """
    Read comma-separated frontend origins from CORS_ORIGINS.

    Example:
        CORS_ORIGINS=http://localhost:5173,https://your-domain.example
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()

    if not raw:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    origins = [origin.strip().rstrip("/") for origin in raw.split(",")]
    return [origin for origin in origins if origin]


app = FastAPI(
    title="HealthTwin AI API",
    description="Patient-centered AI health risk assessment backend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assessment_router)


@app.get("/health", tags=["health"], summary="Health check")
async def health_check() -> dict[str, str]:
    """Return a lightweight liveness response."""
    return {
        "status": "ok",
        "service": "healthtwin-api",
    }


__all__ = ["app"]
