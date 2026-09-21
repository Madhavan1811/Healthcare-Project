"""
HealthTwin AI - Multi-Disease Explainability Engine

Provides SHAP explanations for:
    - heart disease
    - kidney disease
    - stroke

The final user-facing probability/risk always comes from ml.predict.
SHAP values stay in raw XGBoost margin/log-odds space and are never presented
as percentage-point changes in clinical risk.

The Heart base artifact may contain an ensemble of recovered raw estimators.
Kidney and Stroke currently use their saved single raw XGBoost base estimator.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

import joblib
import numpy as np
import pandas as pd
import shap


HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parent.parent
MODEL_DIR = BACKEND_DIR / "ml" / "Models"


DISEASE_CONFIG = {
    "heart_disease": {
        "base_model": MODEL_DIR / "heart_xgb_base.pkl",
        "preprocessor": MODEL_DIR / "heart_preprocessor.pkl",
        "metadata": MODEL_DIR / "heart_metadata.json",
    },
    "kidney_disease": {
        "base_model": MODEL_DIR / "kidney_xgb_base.pkl",
        "preprocessor": MODEL_DIR / "kidney_preprocessor.pkl",
        "metadata": MODEL_DIR / "kidney_metadata.json",
    },
    "stroke": {
        "base_model": MODEL_DIR / "stroke_xgb_base.pkl",
        "preprocessor": MODEL_DIR / "stroke_preprocessor.pkl",
        "metadata": MODEL_DIR / "stroke_metadata.json",
    },
}


FRIENDLY_NAMES = {
    "age": "Age",
    "bmi": "BMI",
    "sleep_hours": "Sleep duration",
    "physical_unwell_days": "Poor physical-health days",
    "sex_male": "Sex",
    "diabetes_status": "Diabetes status",
    "high_bp": "High blood pressure",
    "high_chol": "High cholesterol",
    "physically_active": "Physical activity",
    "general_health": "General health",
    "heavy_drinker": "Alcohol use",
    "copd": "COPD",
    "kidney_disease": "Kidney disease",
    "depression": "Depression",
    "difficulty_walking": "Difficulty walking",
    "smoking_status": "Smoking status",
}


SMOKING_PREFIX = "smoking_status_"


@lru_cache(maxsize=3)
def _load_artifacts(
    disease: str,
) -> tuple[list[Any], Any, dict[str, Any], list[Any]]:
    """
    Load the base XGBoost artifact, preprocessor, metadata and TreeExplainers.
    """
    if disease not in DISEASE_CONFIG:
        raise ValueError(
            f"Unsupported disease {disease!r}. "
            f"Expected one of: {', '.join(DISEASE_CONFIG)}"
        )

    paths = DISEASE_CONFIG[disease]
    for path in paths.values():
        if not path.exists():
            raise FileNotFoundError(
                f"Missing HealthTwin explainability artifact: {path}"
            )

    artifact = joblib.load(paths["base_model"])
    preprocessor = joblib.load(paths["preprocessor"])
    metadata = json.loads(
        paths["metadata"].read_text(encoding="utf-8")
    )

    # Heart recovery artifact: multiple calibrated-fold raw estimators.
    if (
        isinstance(artifact, dict)
        and artifact.get("artifact_type")
        == "healthtwin_v2_xgboost_base_ensemble"
    ):
        models = list(artifact.get("estimators", []))
    else:
        # Kidney/Stroke: saved raw XGBoost estimator.
        models = [artifact]

    if not models:
        raise RuntimeError(
            f"No XGBoost base estimators found for {disease}"
        )

    for model in models:
        if not hasattr(model, "predict") or not hasattr(model, "predict_proba"):
            raise TypeError(
                f"{disease}_xgb_base.pkl does not contain an XGBoost classifier"
            )

    explainers = [
        shap.TreeExplainer(model, model_output="raw")
        for model in models
    ]

    return models, preprocessor, metadata, explainers


def _build_raw_features(
    disease: str,
    patient_data: Mapping[str, Any],
    preprocessor: Any,
    metadata: Mapping[str, Any],
) -> pd.DataFrame:
    """
    Reuse the exact feature mapping from ml.predict instead of duplicating it.
    """
    from ml.predict import build_feature_row, get_feature_schema

    features = get_feature_schema(
        disease,
        metadata=metadata,
        preprocessor=preprocessor,
    )

    return build_feature_row(patient_data, features)


def _normalize_shap_values(raw_values: Any) -> np.ndarray:
    """
    Normalize SHAP output across common SHAP/XGBoost output shapes.
    """
    values = getattr(raw_values, "values", raw_values)
    values = np.asarray(values, dtype=float)

    if values.ndim == 2:
        if values.shape[0] != 1:
            raise RuntimeError(
                f"Expected one patient row, got SHAP shape {values.shape}"
            )
        values = values[0]

    elif values.ndim == 3:
        if values.shape[0] != 1:
            raise RuntimeError(
                f"Expected one patient row, got SHAP shape {values.shape}"
            )
        if values.shape[-1] == 1:
            values = values[0, :, 0]
        else:
            values = values[0, :, -1]

    if values.ndim != 1:
        raise RuntimeError(
            f"Unexpected SHAP output shape: {values.shape}"
        )

    return values


def _base_value(explainer: Any) -> float:
    expected = np.asarray(
        explainer.expected_value,
        dtype=float,
    ).reshape(-1)

    if expected.size == 0:
        raise RuntimeError(
            "SHAP explainer returned no expected_value"
        )

    return float(expected[0])


def _aggregate_one_hot_features(
    encoded_names: list[str],
    values: np.ndarray,
) -> dict[str, float]:
    """
    Collapse smoking-status OHE contributions back to one patient-facing
    'Smoking status' factor.
    """
    if len(encoded_names) != len(values):
        raise RuntimeError(
            f"SHAP feature count ({len(values)}) does not match "
            f"encoded feature-name count ({len(encoded_names)})"
        )

    result: dict[str, float] = {}

    for name, value in zip(encoded_names, values):
        key = (
            "smoking_status"
            if name.startswith(SMOKING_PREFIX)
            else name
        )
        result[key] = result.get(key, 0.0) + float(value)

    return result


def _prediction(
    disease: str,
    patient_data: Mapping[str, Any],
) -> dict[str, Any]:
    """
    Use the production prediction module as the single risk source.
    """
    from ml.predict import predict_disease

    return predict_disease(disease, patient_data)


def explain_disease(
    disease: str,
    patient_data: Mapping[str, Any],
    top_k: int = 8,
) -> dict[str, Any]:
    """
    Return ensemble/base-model SHAP factors plus the final corrected risk.

    SHAP values are raw XGBoost margin/log-odds contributions. They are not
    converted into percentage-point risk changes.
    """
    if top_k < 1:
        raise ValueError("top_k must be >= 1")

    models, preprocessor, metadata, explainers = _load_artifacts(disease)

    raw_row = _build_raw_features(
        disease,
        patient_data,
        preprocessor,
        metadata,
    )
    processed = preprocessor.transform(raw_row)
    processed_array = np.asarray(processed, dtype=float)

    if processed_array.ndim != 2 or processed_array.shape[0] != 1:
        raise RuntimeError(
            f"Expected one processed patient row; got {processed_array.shape}"
        )

    encoded_names = list(
        preprocessor.get_feature_names_out()
    )

    if processed_array.shape[1] != len(encoded_names):
        raise RuntimeError(
            f"Processed feature count ({processed_array.shape[1]}) does not "
            f"match feature-name count ({len(encoded_names)})"
        )

    all_shap: list[np.ndarray] = []
    base_values: list[float] = []
    margins: list[float] = []

    for model, explainer in zip(models, explainers):
        raw_values = explainer(processed_array)
        values = _normalize_shap_values(raw_values)

        if len(values) != len(encoded_names):
            raise RuntimeError(
                f"SHAP value count ({len(values)}) does not match "
                f"encoded feature count ({len(encoded_names)})"
            )

        all_shap.append(values)
        base_values.append(_base_value(explainer))

        margins.append(
            float(
                model.predict(
                    processed_array,
                    output_margin=True,
                )[0]
            )
        )

    mean_shap = np.mean(
        np.asarray(all_shap, dtype=float),
        axis=0,
    )

    aggregated = _aggregate_one_hot_features(
        encoded_names,
        mean_shap,
    )

    ordered = sorted(
        aggregated.items(),
        key=lambda kv: abs(kv[1]),
        reverse=True,
    )

    positive = sorted(
        (
            (key, value)
            for key, value in aggregated.items()
            if value > 0
        ),
        key=lambda kv: kv[1],
        reverse=True,
    )[:top_k]

    negative = sorted(
        (
            (key, value)
            for key, value in aggregated.items()
            if value < 0
        ),
        key=lambda kv: kv[1],
    )[:top_k]

    def factor_item(
        key: str,
        value: float,
    ) -> dict[str, Any]:
        return {
            "feature": key,
            "label": FRIENDLY_NAMES.get(
                key,
                key.replace("_", " ").title(),
            ),
            "shap_value": round(float(value), 6),
            "direction": (
                "increases_risk"
                if value > 0
                else "decreases_risk"
                if value < 0
                else "neutral"
            ),
            "abs_impact": round(abs(float(value)), 6),
        }

    prediction = _prediction(
        disease,
        patient_data,
    )

    base_value = float(np.mean(base_values))
    model_margin = float(np.mean(margins))

    # For TreeExplainer's raw-output formulation:
    # base_value + sum(SHAP) ~= raw XGBoost margin.
    shap_sum = float(
        base_value + mean_shap.sum()
    )
    consistency_error = abs(
        shap_sum - model_margin
    )

    return {
        "disease": disease,
        "raw_probability": prediction["raw_probability"],
        "probability": prediction["probability"],
        "risk_percent": prediction["risk_percent"],
        "risk_level": prediction["risk_level"],
        "shap_space": "xgboost_raw_margin",
        "base_value": round(base_value, 6),
        "model_margin": round(model_margin, 6),
        "shap_sum": round(shap_sum, 6),
        "shap_consistency_error": round(
            consistency_error,
            8,
        ),
        "shap_consistency": (
            "ok"
            if consistency_error <= 1e-3
            else "warning"
        ),
        "base_model_count": len(models),
        "top_positive_factors": [
            factor_item(k, v)
            for k, v in positive
        ],
        "top_negative_factors": [
            factor_item(k, v)
            for k, v in negative
        ],
        "all_factors": [
            factor_item(k, v)
            for k, v in ordered
        ],
        "model_features": metadata.get(
            "features",
            [],
        ),
    }


def explain_heart(
    patient_data: Mapping[str, Any],
    top_k: int = 8,
) -> dict[str, Any]:
    return explain_disease(
        "heart_disease",
        patient_data,
        top_k,
    )


def explain_kidney(
    patient_data: Mapping[str, Any],
    top_k: int = 8,
) -> dict[str, Any]:
    return explain_disease(
        "kidney_disease",
        patient_data,
        top_k,
    )


def explain_stroke(
    patient_data: Mapping[str, Any],
    top_k: int = 8,
) -> dict[str, Any]:
    return explain_disease(
        "stroke",
        patient_data,
        top_k,
    )


def explain_all(
    patient_data: Mapping[str, Any],
    top_k: int = 8,
) -> dict[str, dict[str, Any]]:
    """
    Generate SHAP explanations for all currently integrated diseases.
    """
    return {
        "heart_disease": explain_heart(patient_data, top_k),
        "kidney_disease": explain_kidney(patient_data, top_k),
        "stroke": explain_stroke(patient_data, top_k),
    }


if __name__ == "__main__":
    sample_patient = {
        "age": 55,
        "gender": "male",
        "height_cm": 175,
        "weight_kg": 83,
        "smoking_status": "former",
        "exercise_frequency": "1_2",
        "sleep_hours": 5,
        "alcohol_use": "occasional",
        "high_bp": True,
        "high_chol": True,
        "diabetes": "prediabetes",
        "kidney_disease": False,
        "copd": False,
        "depression": False,
        "difficulty_walking": False,
        "general_health": "good",
        "physical_unwell_days": 15,
    }

    print(
        json.dumps(
            explain_all(sample_patient, top_k=5),
            indent=2,
        )
    )
