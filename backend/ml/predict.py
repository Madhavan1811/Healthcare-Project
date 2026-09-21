"""
HealthTwin AI - Multi-Disease Inference

Inference-only wrapper for the saved HealthTwin disease models.

Supported diseases:
    - heart_disease
    - kidney_disease
    - stroke

Runtime artifacts are expected in:
    backend/ml/Models/

Each disease uses:
    <disease>_model.pkl
    <disease>_preprocessor.pkl
    <disease>_metadata.json

For SHAP:
    <disease>_xgb_base.pkl

This module:
    - normalizes the frontend questionnaire into CDC/model features
    - runs the saved calibrated model
    - applies the model-specific BRFSS prevalence/prior correction exactly once
    - returns the corrected probability/risk level for the UI
    - never retrains
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Mapping

import joblib
import numpy as np
import pandas as pd


HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "Models"


DISEASES = {
    "heart_disease": {
        "model": MODEL_DIR / "heart_model.pkl",
        "preprocessor": MODEL_DIR / "heart_preprocessor.pkl",
        "metadata": MODEL_DIR / "heart_metadata.json",
    },
    "kidney_disease": {
        "model": MODEL_DIR / "kidney_model.pkl",
        "preprocessor": MODEL_DIR / "kidney_preprocessor.pkl",
        "metadata": MODEL_DIR / "kidney_metadata.json",
    },
    "stroke": {
        "model": MODEL_DIR / "stroke_model.pkl",
        "preprocessor": MODEL_DIR / "stroke_preprocessor.pkl",
        "metadata": MODEL_DIR / "stroke_metadata.json",
    },
}


DEFAULT_RISK_BANDS = {
    "Low": (0.00, 0.30),
    "Moderate": (0.30, 0.50),
    "Elevated": (0.50, 0.70),
    "High": (0.70, 1.00),
}


# ---------------------------------------------------------------------------
# Lazy-loaded artifact cache
# ---------------------------------------------------------------------------

_CACHE: dict[str, tuple[Any, Any, dict[str, Any]]] = {}


def _load_artifacts(disease: str) -> tuple[Any, Any, dict[str, Any]]:
    """Load one disease model package once per process."""
    if disease not in DISEASES:
        raise ValueError(
            f"Unsupported disease {disease!r}. "
            f"Expected one of: {', '.join(DISEASES)}"
        )

    if disease in _CACHE:
        return _CACHE[disease]

    paths = DISEASES[disease]
    missing = [
        str(path)
        for path in paths.values()
        if not path.exists()
    ]
    if missing:
        raise FileNotFoundError(
            f"Missing HealthTwin {disease} artifact(s):\n" + "\n".join(missing)
        )

    model = joblib.load(paths["model"])
    preprocessor = joblib.load(paths["preprocessor"])
    metadata = json.loads(paths["metadata"].read_text(encoding="utf-8"))

    _CACHE[disease] = (model, preprocessor, metadata)
    return _CACHE[disease]


def get_feature_schema(
    disease: str,
    *,
    metadata: Mapping[str, Any] | None = None,
    preprocessor: Any | None = None,
) -> list[str]:
    """
    Return the exact raw feature names expected by the saved preprocessor.

    Heart v2 stores a CDC-variable mapping in ``metadata["features"]`` and
    the actual model-facing names in ``metadata["model_features"]``. The
    Kidney/Stroke packages store the model-facing names directly in
    ``metadata["features"]``. This adapter keeps both artifact generations
    compatible without changing the trained models.
    """
    if metadata is None or preprocessor is None:
        _, preprocessor, metadata = _load_artifacts(disease)

    model_features = metadata.get("model_features")
    if isinstance(model_features, (list, tuple)) and model_features:
        return [str(name) for name in model_features]

    features = metadata.get("features")
    if isinstance(features, Mapping) and features:
        # Preserve the metadata insertion order.
        mapped = list(features.values())
        return [str(name) for name in mapped]

    if isinstance(features, (list, tuple)) and features:
        return [str(name) for name in features]

    preprocessor_features = getattr(preprocessor, "feature_names_in_", None)
    if preprocessor_features is not None and len(preprocessor_features):
        return [str(name) for name in preprocessor_features]

    raise RuntimeError(
        f"No raw feature schema found for {disease}"
    )


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def _key(value: Any) -> str:
    return str(value).strip().lower().replace("-", "_").replace(" ", "_")


def _coalesce(data: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if data.get(key) is not None:
            return data[key]
    return None


def _to_float(value: Any, field: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{field}' must be numeric; got {value!r}") from exc

    if not np.isfinite(result):
        raise ValueError(f"'{field}' must be finite; got {value!r}")

    return result


def _to_binary(value: Any, field: str) -> float:
    if isinstance(value, bool):
        return float(value)

    if isinstance(value, (int, float, np.integer, np.floating)):
        if int(value) in (0, 1) and float(value) == int(value):
            return float(value)

    k = _key(value)
    if k in {"yes", "true", "y", "1"}:
        return 1.0
    if k in {"no", "false", "n", "0"}:
        return 0.0

    raise ValueError(f"'{field}' must be 0/1 or yes/no; got {value!r}")


_SMOKING_MAP = {
    "1": 1,
    "current": 1,
    "current_daily": 1,
    "daily": 1,
    "every_day": 1,
    "2": 2,
    "current_some_days": 2,
    "some_days": 2,
    "occasional": 2,
    "3": 3,
    "former": 3,
    "former_daily": 3,
    "former_occasional": 3,
    "ex": 3,
    "quit": 3,
    "4": 4,
    "never": 4,
    "never_smoked": 4,
    "non_smoker": 4,
    "nonsmoker": 4,
}


def _to_smoking(value: Any) -> float:
    k = _key(value)
    if k in _SMOKING_MAP:
        return float(_SMOKING_MAP[k])

    raise ValueError(
        "'smoking_status' must be current/former/never "
        "(or CDC-compatible codes 1-4)"
    )


_DIABETES_MAP = {
    "0": 0,
    "no": 0,
    "none": 0,
    "not_diabetic": 0,
    "1": 1,
    "prediabetes": 1,
    "pre_diabetes": 1,
    "borderline": 1,
    "2": 2,
    "yes": 2,
    "diabetes": 2,
    "diabetic": 2,
}


def _to_diabetes(value: Any) -> float:
    k = _key(value)
    if k in _DIABETES_MAP:
        return float(_DIABETES_MAP[k])

    raise ValueError(
        "'diabetes' must be no, prediabetes, or diabetes "
        "(or CDC-compatible codes 0/1/2)"
    )


_GENERAL_HEALTH_MAP = {
    "1": 1,
    "excellent": 1,
    "2": 2,
    "very_good": 2,
    "verygood": 2,
    "3": 3,
    "good": 3,
    "4": 4,
    "fair": 4,
    "5": 5,
    "poor": 5,
}


def _to_general_health(value: Any) -> float:
    k = _key(value)
    if k in _GENERAL_HEALTH_MAP:
        return float(_GENERAL_HEALTH_MAP[k])

    raise ValueError(
        "'general_health' must be excellent/very_good/good/fair/poor "
        "(or 1-5)"
    )


def _exercise_to_active(value: Any) -> float:
    k = _key(value)

    if k in {"never", "0", "none", "inactive", "no", "false"}:
        return 0.0

    if k in {
        "1_2", "1_2_days", "1-2", "1-2_days",
        "3_4", "3_4_days", "3-4", "3-4_days",
        "5_plus", "5_plus_days", "5+", "5_plus_per_week",
        "yes", "true", "active",
    }:
        return 1.0

    # Already-encoded 0/1
    if value in (0, 1, 0.0, 1.0, False, True):
        return float(value)

    raise ValueError(
        "'exercise_frequency' must be never, 1_2, 3_4, or 5_plus "
        "(or 0/1)"
    )


def _alcohol_to_heavy(value: Any) -> float:
    k = _key(value)

    if k in {"frequent", "heavy", "yes", "true", "1"}:
        return 1.0

    if k in {"never", "occasional", "moderate", "no", "false", "0"}:
        return 0.0

    if value in (0, 1, 0.0, 1.0, False, True):
        return float(value)

    raise ValueError(
        "'alcohol_use' must be never, occasional, or frequent "
        "(or 0/1)"
    )


def _normalize_frontend_aliases(patient: Mapping[str, Any]) -> dict[str, Any]:
    """
    Accept both the final HealthTwin questionnaire names and the older
    inference-wrapper names.
    """
    data = dict(patient)

    aliases = {
        "sex": ("sex", "gender"),
        "height_cm": ("height_cm", "height"),
        "weight_kg": ("weight_kg", "weight"),
        "smoking_status": ("smoking_status", "smoking"),
        "exercise_frequency": ("exercise_frequency", "exercise"),
        "sleep_hours": ("sleep_hours", "sleep"),
        "alcohol_use": ("alcohol_use", "alcohol"),
        "high_bp": ("high_bp", "high_blood_pressure"),
        "high_chol": ("high_chol", "high_cholesterol"),
        "diabetes": ("diabetes", "diabetes_status"),
        "general_health": ("general_health", "overall_health"),
        "physical_unwell_days": (
            "physical_unwell_days",
            "physical_health_days",
        ),
    }

    for target, sources in aliases.items():
        if data.get(target) is None:
            value = _coalesce(data, *sources)
            if value is not None:
                data[target] = value

    if data.get("physically_active") is None and data.get("exercise_frequency") is not None:
        data["physically_active"] = _exercise_to_active(
            data["exercise_frequency"]
        )

    if data.get("heavy_drinker") is None and data.get("alcohol_use") is not None:
        data["heavy_drinker"] = _alcohol_to_heavy(
            data["alcohol_use"]
        )

    return data


# ---------------------------------------------------------------------------
# Patient -> exact model feature row
# ---------------------------------------------------------------------------

def build_feature_row(
    patient: Mapping[str, Any],
    features: list[str] | tuple[str, ...],
) -> pd.DataFrame:
    """
    Build the exact raw feature schema expected by a disease model.

    The caller supplies the disease-specific feature list from its metadata.
    Missing optional fields remain NaN so the train-fitted preprocessor can
    impute them exactly as during training.
    """
    if not isinstance(patient, Mapping):
        raise TypeError("patient_data must be a mapping/dict")

    data = _normalize_frontend_aliases(patient)
    row = {feature: np.nan for feature in features}

    # Required demographic inputs used by all three current models.
    if "age" in features:
        age_value = data.get("age")
        if age_value is None:
            raise ValueError("'age' is required")

        age = _to_float(age_value, "age")
        if not 18 <= age <= 120:
            raise ValueError("'age' must be between 18 and 120")

        # Training used _AGE80.
        row["age"] = min(age, 80.0)

    if "sex_male" in features:
        sex_value = data.get("sex")
        if sex_value is None:
            raise ValueError("'sex'/'gender' is required")

        sex = _key(sex_value)
        if sex in {"male", "m", "man", "1"}:
            row["sex_male"] = 1.0
        elif sex in {"female", "f", "woman", "0", "2"}:
            row["sex_male"] = 0.0
        else:
            raise ValueError(
                "'sex' must be male or female for the current BRFSS-trained models"
            )

    if "bmi" in features:
        bmi_value = data.get("bmi")
        if bmi_value is not None:
            bmi = _to_float(bmi_value, "bmi")
        elif data.get("height_cm") is not None and data.get("weight_kg") is not None:
            height_cm = _to_float(data["height_cm"], "height_cm")
            weight_kg = _to_float(data["weight_kg"], "weight_kg")

            if not 100 <= height_cm <= 250:
                raise ValueError("'height_cm' must be between 100 and 250")
            if not 25 <= weight_kg <= 350:
                raise ValueError("'weight_kg' must be between 25 and 350")

            height_m = height_cm / 100.0
            bmi = weight_kg / (height_m * height_m)
        else:
            raise ValueError(
                "Provide either 'bmi' or both 'height_cm' and 'weight_kg'"
            )

        if not 10 <= bmi <= 100:
            raise ValueError("'bmi' must be between 10 and 100")

        row["bmi"] = float(np.clip(bmi, 12.0, 65.0))

    if "sleep_hours" in features and data.get("sleep_hours") is not None:
        sleep = _to_float(data["sleep_hours"], "sleep_hours")
        if not 0 <= sleep <= 24:
            raise ValueError("'sleep_hours' must be between 0 and 24")
        row["sleep_hours"] = float(np.clip(sleep, 3.0, 14.0))

    if (
        "physical_unwell_days" in features
        and data.get("physical_unwell_days") is not None
    ):
        days = _to_float(
            data["physical_unwell_days"],
            "physical_unwell_days",
        )
        if not 0 <= days <= 30:
            raise ValueError(
                "'physical_unwell_days' must be between 0 and 30"
            )
        row["physical_unwell_days"] = days

    if "smoking_status" in features and data.get("smoking_status") is not None:
        row["smoking_status"] = _to_smoking(data["smoking_status"])

    if "diabetes_status" in features and data.get("diabetes") is not None:
        row["diabetes_status"] = _to_diabetes(data["diabetes"])

    if "general_health" in features and data.get("general_health") is not None:
        row["general_health"] = _to_general_health(data["general_health"])

    if "physically_active" in features and data.get("physically_active") is not None:
        row["physically_active"] = _to_binary(
            data["physically_active"],
            "physically_active",
        )

    if "heavy_drinker" in features and data.get("heavy_drinker") is not None:
        row["heavy_drinker"] = _to_binary(
            data["heavy_drinker"],
            "heavy_drinker",
        )

    binary_fields = {
        "high_bp",
        "high_chol",
        "copd",
        "kidney_disease",
        "depression",
        "difficulty_walking",
    }

    for field in binary_fields.intersection(features):
        if data.get(field) is not None:
            row[field] = _to_binary(data[field], field)

    # Explicitly ignore disease target fields if they were supplied by a caller.
    # The disease-specific feature list controls what reaches the model.
    return pd.DataFrame([row], columns=list(features))


# ---------------------------------------------------------------------------
# Probability correction + risk band
# ---------------------------------------------------------------------------

def _apply_prior_shift(probability: float, logit_shift: float) -> float:
    """Apply the documented case-enrichment prior correction exactly once."""
    p = float(np.clip(probability, 1e-9, 1.0 - 1e-9))
    logit = math.log(p / (1.0 - p))
    corrected_logit = logit + float(logit_shift)

    if corrected_logit >= 0:
        z = math.exp(-corrected_logit)
        corrected = 1.0 / (1.0 + z)
    else:
        z = math.exp(corrected_logit)
        corrected = z / (1.0 + z)

    return float(np.clip(corrected, 0.0, 1.0))


def _get_prior_shift(metadata: Mapping[str, Any]) -> float:
    """
    Support the original Heart metadata and the newer Kidney/Stroke metadata.
    """
    if metadata.get("prior_logit_shift") is not None:
        return float(metadata["prior_logit_shift"])

    prevalence_note = metadata.get("prevalence_note", {})
    if prevalence_note.get("delta_logit_shift") is not None:
        return float(prevalence_note["delta_logit_shift"])

    return 0.0


def _risk_level(
    probability: float,
    metadata: Mapping[str, Any],
) -> str:
    bands = metadata.get("risk_bands_percent", {})
    parsed: dict[str, tuple[float, float]] = {}

    for label, value in bands.items():
        try:
            lo, hi = [float(x.strip()) for x in str(value).split("-", 1)]
            parsed[label] = (lo, hi)
        except Exception:
            continue

    if not parsed:
        parsed = DEFAULT_RISK_BANDS

    pct = probability * 100.0

    for label in ("Low", "Moderate", "Elevated", "High"):
        lo, hi = parsed.get(label, DEFAULT_RISK_BANDS[label])
        if label == "High":
            if pct >= lo:
                return label
        elif lo <= pct < hi:
            return label

    return "High" if pct >= 70.0 else "Low"


# ---------------------------------------------------------------------------
# Public prediction API
# ---------------------------------------------------------------------------

def predict_disease(
    disease: str,
    patient_data: Mapping[str, Any],
) -> dict[str, Any]:
    """
    Run one disease model.

    Returns the corrected production probability/risk plus the raw calibrated
    probability for audit/debugging.
    """
    model, preprocessor, metadata = _load_artifacts(disease)

    features = get_feature_schema(
        disease,
        metadata=metadata,
        preprocessor=preprocessor,
    )

    raw_row = build_feature_row(patient_data, features)
    processed = preprocessor.transform(raw_row)

    raw_probability = float(model.predict_proba(processed)[0, 1])

    prior_shift = _get_prior_shift(metadata)
    corrected_probability = _apply_prior_shift(
        raw_probability,
        prior_shift,
    )

    return {
        "disease": disease,
        "raw_probability": round(raw_probability, 6),
        "probability": round(corrected_probability, 6),
        "risk_percent": round(corrected_probability * 100.0, 2),
        "risk_level": _risk_level(corrected_probability, metadata),
    }


def predict_heart(patient_data: Mapping[str, Any]) -> dict[str, Any]:
    return predict_disease("heart_disease", patient_data)


def predict_kidney(patient_data: Mapping[str, Any]) -> dict[str, Any]:
    return predict_disease("kidney_disease", patient_data)


def predict_stroke(patient_data: Mapping[str, Any]) -> dict[str, Any]:
    return predict_disease("stroke", patient_data)


def predict_all(patient_data: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """
    Run all currently integrated disease models.
    """
    return {
        "heart_disease": predict_heart(patient_data),
        "kidney_disease": predict_kidney(patient_data),
        "stroke": predict_stroke(patient_data),
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

    print(json.dumps(predict_all(sample_patient), indent=2))
