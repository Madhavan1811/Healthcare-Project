"""
HealthGuard AI backend.

Endpoints
---------
  GET  /health          liveness
  GET  /schema          the core schema, so the React form is generated
                        from the same file the models were trained against
  GET  /metrics         model comparison table, calibration curves,
                        clinical baselines, data provenance
  POST /predict         calibrated risk per disease + completeness +
                        scope warnings + imputed-field list
  POST /explain         SHAP attributions grouped back to form fields
  POST /assess          predict + explain + plan in one round trip
                        (used by the what-if sliders)

Run:
    uvicorn src.api.main:app --reload --port 8000
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.api.recommendations import DISCLAIMER, build_plan

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts"
MODELS = ART / "models"

DISEASES = ["heart", "diabetes", "kidney", "stroke"]

app = FastAPI(title="HealthGuard AI", version="1.0.0-review1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                    "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# ----------------------------------------------------------------------
# Load once at startup, never per request
# ----------------------------------------------------------------------
SCHEMA = yaml.safe_load((ROOT / "schema" / "core_schema.yaml").read_text())
METRICS = json.loads((ART / "metrics.json").read_text()) if (ART / "metrics.json").exists() else {}

BUNDLES: dict[str, dict] = {}
for d in DISEASES:
    for fs in ("full", "core"):
        cal = MODELS / f"{d}__{fs}__calibrated.joblib"
        exp = MODELS / f"{d}__{fs}__explainer.joblib"
        if cal.exists() and exp.exists():
            BUNDLES[f"{d}__{fs}"] = {"model": joblib.load(cal),
                                     "explainer": joblib.load(exp)}

BANDS = SCHEMA["risk_bands"]


def band_for(p: float) -> str:
    for b in BANDS:
        if p < b["max"]:
            return b["name"]
    return BANDS[-1]["name"]


# ----------------------------------------------------------------------
# Request model -- fields come from the schema, so form and API cannot drift
# ----------------------------------------------------------------------
class Patient(BaseModel):
    age: float = Field(..., ge=18, le=100)
    sex: str = Field(..., pattern="^(male|female)$")
    systolic_bp: Optional[float] = Field(None, ge=80, le=220)
    bmi: Optional[float] = Field(None, ge=12, le=60)
    glucose: Optional[float] = Field(None, ge=50, le=350)
    smoking: Optional[str] = Field(None, pattern="^(never|former|current)$")

    # heart
    cholesterol_total: Optional[float] = None
    chest_pain_type: Optional[str] = None
    max_heart_rate: Optional[float] = None
    exercise_angina: Optional[str] = None
    st_depression: Optional[float] = None
    resting_ecg: Optional[str] = None
    # diabetes
    pregnancies: Optional[float] = None
    insulin: Optional[float] = None
    skin_thickness: Optional[float] = None
    diabetes_pedigree: Optional[float] = None
    diastolic_bp: Optional[float] = None
    # kidney
    serum_creatinine: Optional[float] = None
    blood_urea: Optional[float] = None
    hemoglobin: Optional[float] = None
    albumin: Optional[float] = None
    specific_gravity: Optional[float] = None
    # stroke
    hypertension: Optional[str] = None
    heart_disease: Optional[str] = None
    ever_married: Optional[str] = None
    work_type: Optional[str] = None
    residence_type: Optional[str] = None

    def as_dict(self) -> dict:
        return {k: v for k, v in self.model_dump().items()}


# ----------------------------------------------------------------------
def to_frame(patient: dict, columns: list) -> tuple[pd.DataFrame, list]:
    """Build a one-row frame for a model, recording which fields it had to impute."""
    row, imputed = {}, []
    for c in columns:
        v = patient.get(c)
        if v is None or (isinstance(v, float) and np.isnan(v)):
            row[c] = np.nan
            imputed.append(c)
        else:
            row[c] = v
    return pd.DataFrame([row]), imputed


def scope_warnings(patient: dict) -> list:
    out = []
    for w in SCHEMA.get("scope_warnings", []):
        cond = w["condition"]
        v = patient.get(cond["field"])
        if v is None:
            continue
        hit = (("equals" in cond and v == cond["equals"])
               or ("less_than" in cond and v < cond["less_than"])
               or ("greater_than" in cond and v > cond["greater_than"]))
        if hit:
            out.append({"disease": w["disease"], "severity": w["severity"],
                        "message": " ".join(w["message"].split())})
    return out


def predict_all(patient: dict) -> dict:
    results = {}
    for d in DISEASES:
        key = f"{d}__full"
        if key not in BUNDLES:
            continue
        cols = BUNDLES[key]["explainer"]["columns"]
        X, imputed = to_frame(patient, cols)
        p = float(BUNDLES[key]["model"].predict_proba(X)[0, 1])

        core_p = None
        ckey = f"{d}__core"
        if ckey in BUNDLES:
            ccols = BUNDLES[ckey]["explainer"]["columns"]
            Xc, _ = to_frame(patient, ccols)
            core_p = float(BUNDLES[ckey]["model"].predict_proba(Xc)[0, 1])

        supplied = len(cols) - len(imputed)
        results[d] = {
            "disease": d,
            "display_name": SCHEMA["extensions"][d]["display_name"],
            "probability": round(p, 4),
            "band": band_for(p),
            "core_only_probability": round(core_p, 4) if core_p is not None else None,
            "completeness": round(supplied / max(len(cols), 1), 3),
            "fields_supplied": supplied,
            "fields_total": len(cols),
            "imputed_fields": imputed,
        }
    return results


# ----------------------------------------------------------------------
# SHAP
# ----------------------------------------------------------------------
def _feature_groups(bundle) -> list[tuple[str, list[int]]]:
    """Map transformed one-hot columns back to their original form field."""
    prep = bundle["preprocessor"]
    groups, i = [], 0
    for name in bundle["numeric"]:
        groups.append((name, [i]))
        i += 1
    ohe = prep.named_transformers_["cat"].named_steps["encode"] \
        if bundle["categorical"] else None
    if ohe is not None:
        for name, cats in zip(bundle["categorical"], ohe.categories_):
            idx = list(range(i, i + len(cats)))
            groups.append((name, idx))
            i += len(cats)
    return groups


def explain_one(disease: str, patient: dict, top_k: int = 8) -> dict:
    key = f"{disease}__full"
    if key not in BUNDLES:
        raise HTTPException(404, f"no model for {disease}")
    import shap

    b = BUNDLES[key]["explainer"]
    X, imputed = to_frame(patient, b["columns"])
    Xt = b["preprocessor"].transform(X)
    model = b["base_model"]

    if b["model_name"] == "logistic_regression":
        expl = shap.LinearExplainer(model, b["background"])
        sv = np.asarray(expl.shap_values(Xt))
    else:
        expl = shap.TreeExplainer(model)
        raw = expl.shap_values(Xt)
        sv = np.asarray(raw[1] if isinstance(raw, list) else raw)
    sv = sv.reshape(-1)

    contribs = []
    for name, idx in _feature_groups(b):
        val = float(np.sum(sv[idx]))
        contribs.append({
            "feature": name,
            "shap": round(val, 5),
            "direction": "increases" if val > 0 else "decreases",
            "value": patient.get(name),
            "was_imputed": name in imputed,
        })
    contribs.sort(key=lambda c: -abs(c["shap"]))
    return {
        "disease": disease,
        "model": b["model_name"],
        "contributions": contribs[:top_k],
        "note": ("SHAP is computed on the underlying ranking model. "
                 "Calibration is a monotone transform of that ranking, so "
                 "the direction and relative magnitude of each attribution "
                 "are preserved."),
    }


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": sorted(BUNDLES),
            "data_provenance": METRICS.get("data_provenance", {})}


@app.get("/schema")
def get_schema():
    return SCHEMA


@app.get("/metrics")
def get_metrics():
    if not METRICS:
        raise HTTPException(503, "run python -m src.models.train first")
    return METRICS


@app.post("/predict")
def predict(patient: Patient):
    p = patient.as_dict()
    return {"risks": predict_all(p), "scope_warnings": scope_warnings(p),
            "disclaimer": DISCLAIMER}


@app.post("/explain")
def explain(patient: Patient):
    p = patient.as_dict()
    return {"explanations": {d: explain_one(d, p) for d in DISEASES
                             if f"{d}__full" in BUNDLES}}


@app.post("/plan")
def plan(patient: Patient):
    p = patient.as_dict()
    return build_plan(p, predict_all(p))


@app.post("/assess")
def assess(patient: Patient):
    """Everything in one round trip. This is what the sliders call."""
    p = patient.as_dict()
    risks = predict_all(p)
    expl = {d: explain_one(d, p) for d in DISEASES if f"{d}__full" in BUNDLES}
    highest = max(risks.values(), key=lambda r: r["probability"]) if risks else None
    n_elevated = sum(1 for r in risks.values() if r["band"] in ("High", "Critical"))
    return {
        "risks": risks,
        "explanations": expl,
        "plan": build_plan(p, risks),
        "triage": {
            "tier": highest["band"] if highest else "Low",
            "driven_by": highest["display_name"] if highest else None,
            "diseases_elevated": n_elevated,
            "basis": ("Highest calibrated single-disease risk, plus a count of "
                      "diseases above the High threshold. This is a triage "
                      "heuristic for prioritising follow-up. It is NOT a "
                      "probability and the four risks are deliberately not "
                      "averaged: they come from four unrelated cohorts."),
        },
        "scope_warnings": scope_warnings(p),
        "data_provenance": METRICS.get("data_provenance", {}),
        "disclaimer": DISCLAIMER,
    }
