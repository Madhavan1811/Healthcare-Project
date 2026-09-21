"""
routes/assessment.py

Thin FastAPI transport layer for HealthTwin AI.

Responsibilities:
- Accept multipart/form-data from the frontend.
- Parse patient JSON.
- Pass the request to the central health pipeline.
- Map controlled pipeline failures to HTTP responses.

All ML, SHAP, PDF extraction, and agent orchestration lives in
pipeline.health_pipeline.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from pipeline.health_pipeline import (
    HealthPipelineError,
    run_health_assessment,
)

logger = logging.getLogger("healthtwin.assessment")

router = APIRouter(
    prefix="/api",
    tags=["assessment"],
)


@router.post(
    "/assessment",
    summary="Run a complete HealthTwin health assessment",
)
async def create_assessment(
    patient_json: str = Form(...),
    pdf: UploadFile | None = File(default=None),
    x_request_id: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    Accept a patient questionnaire plus an optional laboratory-report PDF.

    Expected multipart/form-data:
        patient_json: JSON object
        pdf: optional PDF laboratory report

    The endpoint intentionally contains no business orchestration.
    """

    # ------------------------------------------------------------------
    # 1. Normalize caller-supplied request ID
    # ------------------------------------------------------------------
    request_id = None

    if x_request_id:
        cleaned_request_id = x_request_id.strip()

        if cleaned_request_id:
            # Prevent excessively large IDs from entering logs/context.
            request_id = cleaned_request_id[:128]

    # ------------------------------------------------------------------
    # 2. Decode patient JSON
    # ------------------------------------------------------------------
    try:
        patient_data = json.loads(patient_json)

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail="patient_json must be valid JSON.",
        ) from exc

    if not isinstance(patient_data, dict):
        raise HTTPException(
            status_code=422,
            detail="patient_json must decode to a JSON object.",
        )

    # ------------------------------------------------------------------
    # 3. Execute the complete HealthTwin pipeline
    # ------------------------------------------------------------------
    try:
        return await run_health_assessment(
            patient_data=patient_data,
            pdf=pdf,
            request_id=request_id,
            shap_top_k=8,
        )

    except (ValueError, TypeError) as exc:
        # Deterministic frontend/input validation failure.
        #
        # Do not expose arbitrary internal exception text from downstream
        # services. The pipeline should normally raise these only for
        # invalid client-provided patient data.
        logger.info(
            "assessment.invalid_input request_id=%s error_type=%s",
            request_id,
            type(exc).__name__,
        )

        raise HTTPException(
            status_code=422,
            detail="Invalid patient assessment data.",
        ) from None

    except HealthPipelineError as exc:
        logger.error(
            "assessment.failed request_id=%s stage=%s code=%s",
            exc.request_id,
            exc.stage,
            exc.code,
        )

        # Client-side contract / upload problems.
        if exc.code in {
            "pdf_processing_failed",
            "agent_input_invalid",
        }:
            status_code = 422

        # Backend/model/agent execution failure.
        else:
            status_code = 502

        raise HTTPException(
            status_code=status_code,
            detail={
                "message": str(exc),
                "request_id": exc.request_id,
                "stage": exc.stage,
            },
        ) from None


__all__ = ["router"]