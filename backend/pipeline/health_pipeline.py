"""
pipeline/health_pipeline.py

HealthTwin AI - end-to-end assessment pipeline.

Request flow:
    frontend payload + optional PDF
        -> normalize/validate patient input
        -> heart + kidney + stroke ML predictions
        -> SHAP explanations for all three diseases
        -> optional PDF lab extraction
        -> HealthTwin AI agent
        -> validated frontend-ready JSON

Design goals:
- Keep orchestration in one place.
- Reuse the existing prediction/SHAP implementations as single sources of truth.
- Never let PDF/lab data silently alter the ML prediction.
- Pass only the exact schema accepted by the HealthTwin agent.
- Keep synchronous CPU/model work off the async event loop.
- Fail loudly on cross-component inconsistencies.
- Do not log patient data or raw PDF contents.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
import uuid
from collections.abc import Mapping
from typing import Any, Awaitable, Callable, Protocol, TypeVar

from agent.health_agent import (
    Patient,
    HealthAgentInput,
    HealthAgentOutput,
    get_health_agent,
)
from explainability.explainer import explain_all
from ml.predict import predict_all
from services.pdf import extract_lab_report

logger = logging.getLogger(__name__)

T = TypeVar("T")


class PDFUploadLike(Protocol):
    """Minimal interface required by services.pdf.extract_lab_report."""

    filename: str | None
    content_type: str | None

    async def read(self, size: int = -1) -> bytes:
        ...


class HealthPipelineError(RuntimeError):
    """Controlled pipeline failure that is safe for an API layer to map later."""

    def __init__(
        self,
        message: str,
        *,
        code: str,
        stage: str,
        request_id: str,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.stage = stage
        self.request_id = request_id


# ---------------------------------------------------------------------------
# Frontend -> canonical patient mapping
# ---------------------------------------------------------------------------

_REQUIRED_PATIENT_FIELDS = (
    "age",
    "sex",
    "height_cm",
    "weight_kg",
    "smoking_status",
    "exercise_frequency",
    "sleep_hours",
    "alcohol_use",
    "high_bp",
    "high_chol",
    "diabetes_status",
    "kidney_disease",
    "copd",
    "depression",
    "difficulty_walking",
    "general_health",
    "physical_unwell_days",
)

_TRUE_VALUES = {"1", "true", "yes", "y", "on"}
_FALSE_VALUES = {"0", "false", "no", "n", "off"}

_SEX_MAP = {
    "male": "male",
    "m": "male",
    "man": "male",
    "female": "female",
    "f": "female",
    "woman": "female",
}

_SMOKING_MAP = {
    "current": "current",
    "current_smoker": "current",
    "smoker": "current",
    "former": "former",
    "former_smoker": "former",
    "ex_smoker": "former",
    "never": "never",
    "never_smoked": "never",
    # CDC-compatible codes accepted by the ML wrapper.
    "1": "current",
    "2": "former",
    "3": "former",
    "4": "never",
}

_EXERCISE_MAP = {
    "never": "never",
    "0": "never",
    "1_2": "1_2",
    "1-2": "1_2",
    "1–2": "1_2",
    "1_2_days": "1_2",
    "3_4": "3_4",
    "3-4": "3_4",
    "3–4": "3_4",
    "3_4_days": "3_4",
    "5_plus": "5_plus",
    "5+": "5_plus",
    "5_plus_days": "5_plus",
}

_ALCOHOL_MAP = {
    "never": "never",
    "none": "never",
    "occasional": "occasional",
    "occasionally": "occasional",
    "frequent": "frequent",
    "often": "frequent",
}

_DIABETES_MAP = {
    "none": "none",
    "no": "none",
    "normal": "none",
    "prediabetes": "prediabetes",
    "pre_diabetes": "prediabetes",
    "pre-diabetes": "prediabetes",
    "diabetes": "diabetes",
    "yes": "diabetes",
    # CDC-compatible values used by the ML wrapper.
    "0": "none",
    "1": "prediabetes",
    "2": "diabetes",
}

_GENERAL_HEALTH_MAP = {
    "excellent": "excellent",
    "very_good": "very_good",
    "very good": "very_good",
    "verygood": "very_good",
    "good": "good",
    "fair": "fair",
    "poor": "poor",
    "1": "excellent",
    "2": "very_good",
    "3": "good",
    "4": "fair",
    "5": "poor",
}


def _key(value: Any) -> str:
    """Normalize user-entered categorical text into a lookup key."""
    return str(value).strip().lower().replace("-", "_")


def _first_present(data: Mapping[str, Any], *names: str) -> Any:
    """Return the first non-None alias value."""
    for name in names:
        if name in data and data[name] is not None:
            return data[name]
    return None


def _require(data: Mapping[str, Any], *names: str) -> Any:
    value = _first_present(data, *names)
    if value is None:
        raise ValueError(f"Missing required patient field: {names[0]}")
    return value


def _number(value: Any, field: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{field}' must be numeric") from exc

    if not math.isfinite(result):
        raise ValueError(f"'{field}' must be finite")

    return result


def _boolean(value: Any, field: str) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, int | float) and not isinstance(value, bool):
        if value in (0, 1):
            return bool(value)

    normalized = str(value).strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False

    raise ValueError(f"'{field}' must be yes/no or true/false")


def _normalize_choice(
    value: Any,
    *,
    field: str,
    mapping: Mapping[str, str],
) -> str:
    normalized = _key(value)
    try:
        return mapping[normalized]
    except KeyError as exc:
        raise ValueError(f"Invalid value for '{field}': {value!r}") from exc


def _normalize_patient(patient_data: Mapping[str, Any]) -> dict[str, Any]:
    """
    Convert frontend naming into the exact canonical schema used by the
    HealthTwin agent and by the ML wrapper.

    The returned mapping intentionally contains only fields that the agent
    accepts. This prevents accidental leakage of unrelated frontend fields.
    """
    if not isinstance(patient_data, Mapping):
        raise TypeError("patient_data must be a mapping/dict")

    sex = _normalize_choice(
        _require(patient_data, "sex", "gender"),
        field="sex",
        mapping=_SEX_MAP,
    )
    smoking = _normalize_choice(
        _require(patient_data, "smoking_status", "smoking"),
        field="smoking_status",
        mapping=_SMOKING_MAP,
    )
    exercise = _normalize_choice(
        _require(patient_data, "exercise_frequency", "exercise"),
        field="exercise_frequency",
        mapping=_EXERCISE_MAP,
    )
    alcohol = _normalize_choice(
        _require(patient_data, "alcohol_use", "alcohol"),
        field="alcohol_use",
        mapping=_ALCOHOL_MAP,
    )
    diabetes = _normalize_choice(
        _require(patient_data, "diabetes_status", "diabetes"),
        field="diabetes_status",
        mapping=_DIABETES_MAP,
    )
    general_health = _normalize_choice(
        _require(patient_data, "general_health"),
        field="general_health",
        mapping=_GENERAL_HEALTH_MAP,
    )

    age = _number(_require(patient_data, "age"), "age")
    height_cm = _number(_require(patient_data, "height_cm", "height"), "height_cm")
    weight_kg = _number(_require(patient_data, "weight_kg", "weight"), "weight_kg")
    sleep_hours = _number(_require(patient_data, "sleep_hours", "sleep"), "sleep_hours")
    physical_unwell_days = _number(
        _require(patient_data, "physical_unwell_days"),
        "physical_unwell_days",
    )

    if not 18 <= age <= 120:
        raise ValueError("'age' must be between 18 and 120")
    if not 100 <= height_cm <= 250:
        raise ValueError("'height_cm' must be between 100 and 250")
    if not 25 <= weight_kg <= 350:
        raise ValueError("'weight_kg' must be between 25 and 350")
    if not 0 <= sleep_hours <= 24:
        raise ValueError("'sleep_hours' must be between 0 and 24")
    if not 0 <= physical_unwell_days <= 30:
        raise ValueError("'physical_unwell_days' must be between 0 and 30")

    bmi = weight_kg / ((height_cm / 100.0) ** 2)
    if not 10 <= bmi <= 100:
        raise ValueError("Derived BMI is outside the supported range")

    high_bp = _boolean(_require(patient_data, "high_bp"), "high_bp")
    high_chol = _boolean(_require(patient_data, "high_chol"), "high_chol")
    kidney_disease = _boolean(
        _require(patient_data, "kidney_disease"),
        "kidney_disease",
    )
    copd = _boolean(_require(patient_data, "copd"), "copd")
    depression = _boolean(_require(patient_data, "depression"), "depression")
    difficulty_walking = _boolean(
        _require(patient_data, "difficulty_walking"),
        "difficulty_walking",
    )

    # The trained BRFSS model expects "any physical activity" and a binary
    # heavy-drinker signal, while the patient UI collects richer categories.
    # These deterministic mappings are product-level encodings, not new ML.
    physically_active = exercise != "never"
    heavy_drinker = alcohol == "frequent"

    canonical = {
        "age": age,
        "sex": sex,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "bmi": bmi,
        "smoking_status": smoking,
        "exercise_frequency": exercise,
        "sleep_hours": sleep_hours,
        "alcohol_use": alcohol,
        "high_bp": high_bp,
        "high_chol": high_chol,
        "diabetes_status": diabetes,
        "kidney_disease": kidney_disease,
        "copd": copd,
        "depression": depression,
        "difficulty_walking": difficulty_walking,
        "general_health": general_health,
        "physical_unwell_days": physical_unwell_days,
    }

    # Fields below are consumed by the ML prediction/explanation wrappers, not by the agent schema.
    # Keep them separate so the final LLM payload remains strict.
    canonical["ml_features"] = {
        "age": age,
        "sex": sex,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "bmi": bmi,
        "smoking_status": smoking,
        "diabetes": diabetes,
        "high_bp": high_bp,
        "high_chol": high_chol,
        "physically_active": physically_active,
        "heavy_drinker": heavy_drinker,
        "copd": copd,
        "kidney_disease": kidney_disease,
        "depression": depression,
        "difficulty_walking": difficulty_walking,
        "general_health": general_health,
        "sleep_hours": sleep_hours,
        "physical_unwell_days": physical_unwell_days,
    }

    # Agent-side schema is strict; validate before doing any LLM call.
    agent_patient = dict(canonical)
    agent_patient.pop("ml_features")
    validated = Patient.model_validate(agent_patient)

    # Return both views internally.
    return {
        "agent_patient": validated.model_dump(mode="json"),
        "ml_patient": canonical["ml_features"],
    }


# ---------------------------------------------------------------------------
# Component adapters
# ---------------------------------------------------------------------------


_DISEASES = ("heart_disease", "kidney_disease", "stroke")
_PREDICTION_FIELDS = ("raw_probability", "probability", "risk_percent", "risk_level")


def _prepare_ml_predictions(
    predictions: Mapping[str, Any],
) -> dict[str, dict[str, Any]]:
    """Validate and keep only fields accepted by DiseasePrediction."""
    if not isinstance(predictions, Mapping):
        raise TypeError("ML prediction output must be a mapping")

    actual = set(predictions.keys())
    expected = set(_DISEASES)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        details = []
        if missing:
            details.append(f"missing={missing}")
        if extra:
            details.append(f"unexpected={extra}")
        raise RuntimeError(
            "ML prediction set does not match the integrated diseases: "
            + ", ".join(details)
        )

    result: dict[str, dict[str, Any]] = {}

    for disease in _DISEASES:
        prediction = predictions[disease]
        if not isinstance(prediction, Mapping):
            raise RuntimeError(f"ML prediction for {disease} must be a mapping")

        missing = [name for name in _PREDICTION_FIELDS if name not in prediction]
        if missing:
            raise RuntimeError(
                f"ML prediction for {disease} is missing required field(s): "
                f"{', '.join(missing)}"
            )

        result[disease] = {
            name: prediction[name]
            for name in _PREDICTION_FIELDS
        }

    return result


def _prepare_shap_explanations(
    explanations: Mapping[str, Any],
) -> dict[str, dict[str, Any]]:
    """Validate SHAP outputs and strip diagnostics before agent input."""
    if not isinstance(explanations, Mapping):
        raise TypeError("SHAP explanation output must be a mapping")

    actual = set(explanations.keys())
    expected = set(_DISEASES)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        details = []
        if missing:
            details.append(f"missing={missing}")
        if extra:
            details.append(f"unexpected={extra}")
        raise RuntimeError(
            "SHAP explanation set does not match the integrated diseases: "
            + ", ".join(details)
        )

    result: dict[str, dict[str, Any]] = {}

    for disease in _DISEASES:
        explanation = explanations[disease]
        if not isinstance(explanation, Mapping):
            raise RuntimeError(f"SHAP explanation for {disease} must be a mapping")

        required = ("disease", "shap_space", "base_value", "model_margin")
        missing = [name for name in required if name not in explanation]
        if missing:
            raise RuntimeError(
                f"SHAP explanation for {disease} is missing required field(s): "
                f"{', '.join(missing)}"
            )

        if explanation["disease"] != disease:
            raise RuntimeError(
                f"SHAP explanation disease mismatch: expected {disease}, "
                f"got {explanation['disease']!r}"
            )

        if explanation["shap_space"] != "xgboost_raw_margin":
            raise RuntimeError(
                f"Unsupported SHAP space for {disease}: "
                f"{explanation['shap_space']!r}"
            )

        result[disease] = {
            "disease": disease,
            "shap_space": explanation["shap_space"],
            "base_value": explanation["base_value"],
            "model_margin": explanation["model_margin"],
            "top_positive_factors": [],
            "top_negative_factors": [],
        }

        for direction_key, expected_direction in (
            ("top_positive_factors", "increases_risk"),
            ("top_negative_factors", "decreases_risk"),
        ):
            factors = explanation.get(direction_key, [])
            if not isinstance(factors, list):
                raise RuntimeError(
                    f"{disease}.{direction_key} must be a list"
                )

            for factor in factors:
                if not isinstance(factor, Mapping):
                    raise RuntimeError(
                        f"SHAP factor for {disease}.{direction_key} must be a mapping"
                    )

                required_factor = ("feature", "label", "shap_value", "direction")
                missing_factor = [
                    name for name in required_factor
                    if name not in factor
                ]
                if missing_factor:
                    raise RuntimeError(
                        f"SHAP factor for {disease} is missing field(s): "
                        f"{', '.join(missing_factor)}"
                    )
                if factor["direction"] != expected_direction:
                    raise RuntimeError(
                        f"SHAP factor direction mismatch for {disease}.{direction_key}: "
                        f"expected {expected_direction!r}, got {factor['direction']!r}"
                    )

                result[disease][direction_key].append(
                    {
                        "feature": factor["feature"],
                        "label": factor["label"],
                        "shap_value": factor["shap_value"],
                        "direction": expected_direction,
                    }
                )

        consistency_error = explanation.get("shap_consistency_error")
        if consistency_error is not None and float(consistency_error) > 1e-3:
            raise RuntimeError(
                f"SHAP consistency check failed for {disease}: "
                f"error={float(consistency_error):.8f}"
            )

    return result


def _prepare_lab_report(report: Mapping[str, Any] | None) -> dict[str, Any]:
    """
    Adapt services.pdf output to the strict LabReport agent schema.

    services.pdf intentionally returns operational metadata such as filename
    and page count; those fields are not sent to the LLM.
    """
    if not report:
        return {
            "available": False,
            "source": None,
            "extracted_values": [],
            "raw_text": None,
        }

    values = []
    for item in report.get("extracted_values", []):
        values.append(
            {
                "test": item["test"],
                "value": item["value"],
                "unit": item.get("unit"),
                "reference_range": item.get("reference_range"),
                "extraction_confidence": item.get("extraction_confidence"),
                "needs_review": bool(item.get("needs_review", True)),
            }
        )

    return {
        "available": bool(report.get("available")),
        "source": report.get("source") if report.get("available") else None,
        "extracted_values": values,
        "raw_text": report.get("raw_text"),
    }


def _verify_prediction_consistency(
    ml_predictions: Mapping[str, Mapping[str, Any]],
    shap_explanations: Mapping[str, Mapping[str, Any]],
) -> None:
    """
    The SHAP engine delegates final risk calculation to the same prediction
    module. Refuse to synthesize a patient report if any disease disagrees.
    """
    expected = set(_DISEASES)

    if set(ml_predictions) != expected or set(shap_explanations) != expected:
        raise RuntimeError("ML/SHAP disease sets are inconsistent")

    for disease in _DISEASES:
        ml_prediction = ml_predictions[disease]
        shap_explanation = shap_explanations[disease]

        for key in ("probability", "risk_percent"):
            left = float(ml_prediction[key])
            if key not in shap_explanation:
                raise RuntimeError(
                    f"SHAP explanation for {disease} is missing '{key}'"
                )
            right = float(shap_explanation[key])
            if not math.isclose(left, right, rel_tol=0.0, abs_tol=1e-6):
                raise RuntimeError(
                    f"ML/SHAP {disease} {key} mismatch: "
                    f"prediction={left}, explanation={right}"
                )

        if "risk_level" not in shap_explanation:
            raise RuntimeError(
                f"SHAP explanation for {disease} is missing 'risk_level'"
            )

        if ml_prediction["risk_level"] != shap_explanation["risk_level"]:
            raise RuntimeError(
                f"ML/SHAP {disease} risk-level mismatch: "
                f"{ml_prediction['risk_level']} vs {shap_explanation['risk_level']}"
            )


# ---------------------------------------------------------------------------
# Async execution helpers
# ---------------------------------------------------------------------------


async def _run_blocking(
    stage: str,
    request_id: str,
    func: Callable[..., T],
    *args: Any,
) -> T:
    """Run CPU/blocking model work outside the FastAPI event loop."""
    started = time.perf_counter()

    try:
        result = await asyncio.to_thread(func, *args)
    except Exception as exc:
        logger.exception(
            "health_pipeline.stage_failed request_id=%s stage=%s error_type=%s",
            request_id,
            stage,
            type(exc).__name__,
        )
        raise HealthPipelineError(
            f"Health assessment failed during {stage}.",
            code="stage_failed",
            stage=stage,
            request_id=request_id,
        ) from exc

    logger.info(
        "health_pipeline.stage_ok request_id=%s stage=%s duration_ms=%.1f",
        request_id,
        stage,
        (time.perf_counter() - started) * 1000.0,
    )
    return result


# ---------------------------------------------------------------------------
# Public pipeline
# ---------------------------------------------------------------------------


async def run_health_assessment(
    patient_data: Mapping[str, Any],
    pdf: PDFUploadLike | None = None,
    *,
    request_id: str | None = None,
    shap_top_k: int = 8,
) -> dict[str, Any]:
    """
    Execute a complete HealthTwin assessment.

    Parameters
    ----------
    patient_data:
        Patient questionnaire payload from the frontend. Both the canonical
        backend names and the current frontend aliases are supported.
    pdf:
        Optional uploaded PDF-like object accepted by services.pdf.
    request_id:
        Optional caller-supplied correlation ID.
    shap_top_k:
        Number of positive/negative SHAP factors retained for the agent.

    Returns
    -------
    dict
        The exact HealthAgentOutput JSON structure expected by the frontend.

    Raises
    ------
    ValueError / TypeError
        Invalid patient input.
    HealthPipelineError
        A downstream stage failed or the cross-component consistency check
        failed.
    """
    correlation_id = request_id or uuid.uuid4().hex[:12]
    started = time.perf_counter()

    logger.info(
        "health_pipeline.start request_id=%s pdf=%s",
        correlation_id,
        bool(pdf),
    )

    if shap_top_k < 1:
        raise ValueError("shap_top_k must be >= 1")

    # 1. Normalize + validate once.
    try:
        normalized = _normalize_patient(patient_data)
    except (TypeError, ValueError):
        logger.exception(
            "health_pipeline.input_invalid request_id=%s",
            correlation_id,
        )
        raise

    agent_patient = normalized["agent_patient"]
    ml_patient = normalized["ml_patient"]

    # 2. Deterministic ML predictions for all integrated diseases.
    prediction_raw = await _run_blocking(
        "disease_predictions",
        correlation_id,
        predict_all,
        ml_patient,
    )
    ml_predictions = _prepare_ml_predictions(prediction_raw)

    # 3. Patient-level SHAP explanations for all integrated diseases.
    shap_raw = await _run_blocking(
        "disease_explanations",
        correlation_id,
        explain_all,
        ml_patient,
        shap_top_k,
    )
    shap_explanations = _prepare_shap_explanations(shap_raw)

    # The SHAP engine also returns its final prediction values. Keep those
    # internal fields available for a strict disease-by-disease cross-check.
    _verify_prediction_consistency(ml_predictions, shap_raw)

    # 4. Optional PDF extraction. PDF data is NEVER sent back into the ML model.
    if pdf is not None:
        try:
            pdf_raw = await extract_lab_report(pdf)
        except ValueError:
            logger.exception(
                "health_pipeline.pdf_invalid request_id=%s",
                correlation_id,
            )
            raise
        except Exception as exc:
            logger.exception(
                "health_pipeline.pdf_failed request_id=%s error_type=%s",
                correlation_id,
                type(exc).__name__,
            )
            raise HealthPipelineError(
                "The uploaded PDF could not be processed.",
                code="pdf_processing_failed",
                stage="pdf_extraction",
                request_id=correlation_id,
            ) from exc
    else:
        pdf_raw = None

    lab_report = _prepare_lab_report(pdf_raw)

    # 5. Strict agent-input validation. This also guarantees the LLM sees
    # exactly one schema and no operational metadata from other components.
    try:
        agent_input = HealthAgentInput.model_validate(
            {
                "patient": agent_patient,
                "ml_predictions": ml_predictions,
                "shap": shap_explanations,
                "lab_report": lab_report,
            }
        )
    except Exception as exc:
        logger.exception(
            "health_pipeline.agent_input_invalid request_id=%s",
            correlation_id,
        )
        raise HealthPipelineError(
            "The health-assessment data could not be prepared for analysis.",
            code="agent_input_invalid",
            stage="agent_input_validation",
            request_id=correlation_id,
        ) from exc

    # 6. One agent call. The agent itself owns its bounded retry/validation
    # policy and returns a validated HealthAgentOutput.
    try:
        agent = get_health_agent()
        agent_output: HealthAgentOutput = await agent.analyze(agent_input)
    except Exception as exc:
        logger.exception(
            "health_pipeline.agent_failed request_id=%s error_type=%s",
            correlation_id,
            type(exc).__name__,
        )
        raise HealthPipelineError(
            "The AI health analysis could not be completed.",
            code="agent_failed",
            stage="health_agent",
            request_id=correlation_id,
        ) from exc

    result = agent_output.model_dump(mode="json")

    logger.info(
        "health_pipeline.ok request_id=%s duration_ms=%.1f",
        correlation_id,
        (time.perf_counter() - started) * 1000.0,
    )

    return result


__all__ = [
    "HealthPipelineError",
    "run_health_assessment",
]
