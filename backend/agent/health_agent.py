"""
HealthTwin AI - Health Agent
============================

The SINGLE agent of the HealthTwin backend. It is an interpretation + synthesis
layer: it receives verified ML + SHAP + PDF-extraction output and turns it into
patient-friendly insights, a doctor-facing summary and frontend-ready JSON.

It never predicts, never recalculates ML probabilities or SHAP values, and never
decides on its own whether its output is valid. Every LLM response goes through
deterministic validation (Pydantic + semantic checks against the backend data).

Flow (per call to ``HealthAgent.analyze``):

    validate input -> build prompt -> Groq (JSON schema) -> Pydantic parse
        -> semantic validation -> [one retry with the validation errors]
        -> validated HealthAgentOutput   |   controlled HealthAgentError

Usage (from a future FastAPI route):

    agent = get_health_agent()
    try:
        result = await agent.analyze(payload)          # dict or HealthAgentInput
    except HealthAgentError as exc:
        ...  # exc.code, exc.http_status, exc.to_dict()

Environment:
    GROQ_API_KEY   required (unless a client / api_key is injected)

Privacy: raw patient data, lab values and model output are NEVER logged. Logs
contain request ids, timings, token counts, attempt numbers and validation
error *codes* only.
"""

from __future__ import annotations

import asyncio
import copy
import logging
import math
import os
import re
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Literal

import groq
from groq import AsyncGroq
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    model_validator,
)

__all__ = [
    "AgentSettings",
    "HealthAgent",
    "HealthAgentError",
    "HealthAgentConfigError",
    "HealthAgentInputError",
    "HealthAgentTimeoutError",
    "HealthAgentUpstreamError",
    "HealthAgentValidationError",
    "HealthAgentInput",
    "HealthAgentOutput",
    "DiseasePrediction",
    "MLPredictions",
    "ShapFactor",
    "ShapExplanation",
    "ShapExplanations",
    "ValidationIssue",
    "get_health_agent",
    "validate_output",
]

logger = logging.getLogger("healthtwin.health_agent")

PROMPT_VERSION = "2.0.0"

# =============================================================================
# Shared types
# =============================================================================

DiseaseName = Literal["heart_disease", "kidney_disease", "stroke"]
RiskLevel = Literal["Low", "Moderate", "Elevated", "High"]
ShapDirection = Literal["increases_risk", "decreases_risk"]
Text = Annotated[str, StringConstraints(min_length=1)]


class _StrictModel(BaseModel):
    """Base model: unknown fields are rejected (also gives additionalProperties=false)."""

    model_config = ConfigDict(extra="forbid")


# =============================================================================
# INPUT models (what FastAPI hands to the agent)
# =============================================================================


class Patient(_StrictModel):
    age: float = Field(ge=0, le=120)
    sex: Literal["male", "female", "other"]
    height_cm: float = Field(gt=0)
    weight_kg: float = Field(gt=0)
    bmi: float = Field(gt=0)

    smoking_status: Literal["current", "former", "never"]
    exercise_frequency: Literal["never", "1_2", "3_4", "5_plus"]
    sleep_hours: float = Field(ge=0, le=24)
    alcohol_use: Literal["never", "occasional", "frequent"]

    high_bp: bool
    high_chol: bool
    diabetes_status: Literal["none", "prediabetes", "diabetes"]
    kidney_disease: bool
    copd: bool
    depression: bool
    difficulty_walking: bool

    general_health: Literal["excellent", "very_good", "good", "fair", "poor"]
    physical_unwell_days: float = Field(ge=0)


class DiseasePrediction(_StrictModel):
    raw_probability: float = Field(ge=0, le=1)
    probability: float = Field(ge=0, le=1)  # 0..1, e.g. 0.1147
    risk_percent: float = Field(ge=0, le=100)  # 0..100, e.g. 11.47
    risk_level: RiskLevel


class MLPredictions(_StrictModel):
    heart_disease: DiseasePrediction
    kidney_disease: DiseasePrediction
    stroke: DiseasePrediction

    def as_dict(self) -> dict[str, DiseasePrediction]:
        """All integrated disease predictions keyed by disease name."""
        return {
            name: getattr(self, name)
            for name in type(self).model_fields
        }


class ShapFactor(_StrictModel):
    feature: str
    label: str
    shap_value: float
    direction: ShapDirection


class ShapExplanation(_StrictModel):
    disease: DiseaseName
    shap_space: Literal["xgboost_raw_margin"]
    base_value: float
    model_margin: float
    top_positive_factors: list[ShapFactor] = Field(default_factory=list)
    top_negative_factors: list[ShapFactor] = Field(default_factory=list)

    @model_validator(mode="after")
    def _directions_match_lists(self) -> "ShapExplanation":
        if any(f.direction != "increases_risk" for f in self.top_positive_factors):
            raise ValueError("top_positive_factors must all have direction 'increases_risk'")
        if any(f.direction != "decreases_risk" for f in self.top_negative_factors):
            raise ValueError("top_negative_factors must all have direction 'decreases_risk'")
        return self


class ShapExplanations(_StrictModel):
    heart_disease: ShapExplanation
    kidney_disease: ShapExplanation
    stroke: ShapExplanation

    @model_validator(mode="after")
    def _disease_names_match_fields(self) -> "ShapExplanations":
        for name, explanation in self.as_dict().items():
            if explanation.disease != name:
                raise ValueError(
                    f"SHAP explanation '{name}' has mismatched disease '{explanation.disease}'."
                )
        return self

    def as_dict(self) -> dict[str, ShapExplanation]:
        """All integrated disease explanations keyed by disease name."""
        return {
            name: getattr(self, name)
            for name in type(self).model_fields
        }


class LabValue(_StrictModel):
    test: str
    value: float | str
    unit: str | None = None
    reference_range: str | None = None
    extraction_confidence: float | None = None
    needs_review: bool


class LabReport(_StrictModel):
    available: bool
    source: Literal["uploaded_pdf"] | None = None
    extracted_values: list[LabValue] = Field(default_factory=list)
    raw_text: str | None = None


class HealthAgentInput(_StrictModel):
    patient: Patient
    ml_predictions: MLPredictions
    shap: ShapExplanations
    lab_report: LabReport


# =============================================================================
# OUTPUT models (what the frontend receives). Deliberately no defaults so every
# field is "required" in the JSON schema sent to Groq.
# =============================================================================


class RiskOverviewItem(_StrictModel):
    disease: str
    probability: float = Field(ge=0, le=1)
    risk_percent: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    headline: Text
    short_explanation: Text
    risk_context: Text


class KeyFactor(_StrictModel):
    disease: DiseaseName
    feature: str
    label: str
    direction: ShapDirection
    importance: Literal["high", "medium", "low"]
    explanation: Text


class LabInsight(_StrictModel):
    test: str
    value: str
    unit: str | None
    status: Literal["normal", "review", "important", "unverified"]
    explanation: Text


class Recommendation(_StrictModel):
    priority: int = Field(ge=1)
    title: Text
    description: Text
    type: Literal["lifestyle", "monitoring", "follow_up", "specialist"]


class SpecialistFollowUp(_StrictModel):
    recommended: bool
    reason: Text


class PatientReport(_StrictModel):
    summary: Text
    risk_explanation: Text
    lab_summary: Text
    next_steps: Text


class DoctorSummary(_StrictModel):
    clinical_overview: Text
    risk_summary: Text
    important_factors: list[Text]
    lab_points: list[Text]
    follow_up_points: list[Text]


class UIHints(_StrictModel):
    overall_severity: RiskLevel
    headline: Text
    show_attention_banner: bool
    priority_count: int = Field(ge=0)


class HealthAgentOutput(_StrictModel):
    overall_summary: Text
    risk_overview: list[RiskOverviewItem] = Field(min_length=1)
    key_factors: list[KeyFactor]
    lab_insights: list[LabInsight]
    recommendations: list[Recommendation]
    specialist_follow_up: SpecialistFollowUp
    patient_report: PatientReport
    doctor_summary: DoctorSummary
    ui: UIHints


# =============================================================================
# Errors (controlled backend errors - safe to map to HTTP responses)
# =============================================================================


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    message: str


class HealthAgentError(Exception):
    """Base class. ``public_message`` is safe to show; it never contains patient data."""

    code = "health_agent_error"
    http_status = 500
    retryable = False  # used internally to decide whether the one retry applies

    def __init__(self, public_message: str, *, issue_codes: list[str] | None = None) -> None:
        super().__init__(public_message)
        self.public_message = public_message
        self.issue_codes = issue_codes or []

    def to_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.public_message}
        if self.issue_codes:
            body["issue_codes"] = self.issue_codes
        return {"error": body}


class HealthAgentConfigError(HealthAgentError):
    code = "agent_misconfigured"
    http_status = 500


class HealthAgentInputError(HealthAgentError):
    code = "invalid_agent_input"
    http_status = 422


class HealthAgentTimeoutError(HealthAgentError):
    code = "agent_timeout"
    http_status = 504
    retryable = True


class HealthAgentUpstreamError(HealthAgentError):
    code = "agent_upstream_error"
    http_status = 502

    def __init__(self, public_message: str, *, retryable: bool = False, **kw: Any) -> None:
        super().__init__(public_message, **kw)
        self.retryable = retryable


class HealthAgentValidationError(HealthAgentError):
    code = "agent_output_invalid"
    http_status = 502


# =============================================================================
# Settings
# =============================================================================


@dataclass(frozen=True)
class AgentSettings:
    api_key: str | None = None  # falls back to the GROQ_API_KEY env var
    model: str = "openai/gpt-oss-20b"
    timeout_s: float = 60.0  # per Groq call
    max_completion_tokens: int = 8192  # gpt-oss reasoning tokens count against this
    temperature: float = 0.2
    reasoning_effort: Literal["low", "medium", "high"] = "medium"
    strict_schema: bool = True  # Groq constrained decoding; set False if Groq rejects the schema
    retry_backoff_s: float = 1.0  # pause before retrying a transient upstream failure
    raw_text_char_limit: int = 6000  # lab raw_text is truncated before it goes to the LLM


MAX_ATTEMPTS = 2  # first try + exactly one retry


# =============================================================================
# System prompt
# =============================================================================

SYSTEM_PROMPT = """\
You are the HealthTwin AI Health Agent. You are an interpretation and synthesis \
layer that turns VERIFIED backend data into patient-friendly health insights. \
You are NOT a prediction engine and NOT a clinician.

You receive one JSON object with:
- patient: questionnaire answers
- ml_predictions: verified model output (authoritative)
- shap: verified SHAP explanations for heart disease, kidney disease and stroke
  (authoritative, xgboost raw-margin space)
- lab_report: values extracted from an uploaded PDF (context only; may be unverified)

Return ONLY one JSON object that matches the provided response schema. No prose \
outside the JSON, no markdown fences, no reasoning.

## Authority and numbers
- Never recalculate, adjust, round differently or invent probabilities or risk levels. \
For every disease, copy `probability`, `risk_percent` and `risk_level` EXACTLY from \
ml_predictions. When you mention the estimated risk in text, write the exact \
`risk_percent` (e.g. "11.47%"). Do not quote any other percentage about the patient's risk.
- Risk bands used by the backend (for your understanding only, never to recompute): \
0-29 Low, 30-49 Moderate, 50-69 Elevated, 70-100 High. Use the supplied `risk_level`.
- Only discuss SHAP factors present in the supplied disease-specific SHAP lists. Copy \
`disease`, `feature`, `label` and `direction` exactly. Never convert SHAP values into \
percentages or say a factor "increased your risk by X". Use SHAP only for: what pushed \
each disease estimate up, what pushed it down, and relative importance.
- If patient answers conflict with ml_predictions, the ML result stays authoritative \
for the ML prediction. You may note the discrepancy neutrally.
- If information is missing or insufficient, say what is missing. Never invent it.

## Language rules
- Never claim the patient has or was diagnosed with a disease. Use wording such as \
"estimated risk", "the model indicates", "is associated with", "may warrant review".
- Never say "you have heart disease" or "AI diagnosed ...".
- No fear-based language. Never use words such as dangerous, danger, critical, \
life-threatening, deadly, fatal, alarming, terrifying, catastrophic.
- Never prescribe or suggest specific medication: no drug names, drug classes, doses, \
frequencies or treatment orders. Say "discuss this with a qualified healthcare professional".
- Do not promise that lifestyle changes will reduce risk by any specific amount.
- Patient-facing text: plain, warm, non-technical English (around grade 8). Technical \
detail belongs in `doctor_summary`.
- Keep the four sources clearly distinguishable in your wording: the ML prediction \
("the model's estimate"), the SHAP explanation ("the main factors the model weighed"), \
laboratory observations ("your uploaded report shows"), and your own suggestions \
("suggested next steps").
- Do not expose reasoning or chain-of-thought; give conclusions and concise explanations.

## Lab report rules
- Create `lab_insights` ONLY from `lab_report.extracted_values`. `raw_text` is background \
context; never create lab values from it. If `available` is false or there are no \
extracted values, `lab_insights` must be [] and `patient_report.lab_summary` must say no \
lab report information was available.
- For each insight copy `test`, `value` and `unit` exactly as supplied. Never invent \
reference ranges; mention a reference range only if supplied.
- `status`:
  - "unverified": REQUIRED whenever `needs_review` is true (say the value was not \
verified and should be confirmed against the original report), and used only then.
  - "normal" / "important": only when a `reference_range` was supplied and the value \
clearly sits inside / outside it.
  - "review": everything else (e.g. no reference range supplied, or unclear).
- Lab findings are observations. They must not be presented as changing the ML result.

## Field guide
- overall_summary: 2-4 sentences, plain language, states the estimated risk exactly.
- risk_overview: exactly one entry per disease in ml_predictions. `headline` is short; `short_explanation` is 1-2 sentences using "estimated risk" wording. `risk_context` MUST summarize the associated factors precisely using the format: "The current estimate is mainly associated with [factor1, factor2, etc.]."
- key_factors: choose the most relevant factors across the three disease-specific SHAP \
lists, including factors that pushed an estimate down where supplied. Every item must \
identify its `disease`. `importance` reflects relative |shap_value| within that disease's \
supplied lists (largest = "high"). Explain each factor in one or two plain sentences, \
linking it to the patient's questionnaire answers where relevant. State factors are \
associated with the estimate, not proven causes.
- recommendations: 3-7 items, practical, specific and non-prescriptive, tied to supplied \
risk factors. `priority` is 1..N, unique, 1 = most important. `type` is one of \
lifestyle / monitoring / follow_up / specialist.
- specialist_follow_up: `recommended` true when the risk level is Elevated or High, or a \
lab value warrants review, or the questionnaire raises concerns; `reason` explains why in \
neutral wording. Recommending a check-up with a qualified professional is always allowed.
- patient_report: summary, risk_explanation, lab_summary, next_steps - each a short \
paragraph in patient-friendly language.
- doctor_summary: concise clinical language. Describe the estimate as model output, list \
important SHAP factors, lab points (mark unverified values as such) and follow-up points.
- ui: `overall_severity` = the highest supplied risk_level; `headline` is a short, calm \
line; `show_attention_banner` is true if the risk level is Elevated or High, or \
specialist follow-up is recommended, or any lab insight status is "important"; \
`priority_count` = number of recommendations.
"""


# =============================================================================
# Response schema for Groq structured output
# =============================================================================

# Keywords Groq's constrained decoding may not support. They are stripped from the
# schema sent to the model; Pydantic still enforces them after the fact.
_UNSUPPORTED_KEYWORDS = frozenset(
    {
        "title", "default", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
        "minLength", "maxLength", "minItems", "maxItems", "pattern", "format",
    }
)


def _inline_refs(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        if "$ref" in node:
            return _inline_refs(copy.deepcopy(defs[node["$ref"].rsplit("/", 1)[-1]]), defs)
        return {k: _inline_refs(v, defs) for k, v in node.items() if k != "$defs"}
    if isinstance(node, list):
        return [_inline_refs(i, defs) for i in node]
    return node


def _clean_schema(node: Any) -> Any:
    if isinstance(node, list):
        return [_clean_schema(i) for i in node]
    if not isinstance(node, dict):
        return node
    out: dict[str, Any] = {}
    for key, value in node.items():
        if key in _UNSUPPORTED_KEYWORDS:
            continue
        if key == "properties":  # keys here are field names ("title", "type"...), keep them
            out[key] = {name: _clean_schema(sub) for name, sub in value.items()}
        else:
            out[key] = _clean_schema(value)
    variants = out.get("anyOf")
    if isinstance(variants, list) and len(variants) == 2:  # X | None -> type: [X, "null"]
        non_null = [v for v in variants if v != {"type": "null"}]
        if len(non_null) == 1 and set(non_null[0]) == {"type"}:
            del out["anyOf"]
            out["type"] = [non_null[0]["type"], "null"]
    return out


@lru_cache(maxsize=1)
def build_response_schema() -> dict[str, Any]:
    raw = HealthAgentOutput.model_json_schema()
    return _clean_schema(_inline_refs(raw, raw.get("$defs", {})))


def _response_format(strict: bool) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "health_agent_output",
            "strict": strict,
            "schema": build_response_schema(),
        },
    }


# =============================================================================
# Prompt construction
# =============================================================================


def build_user_message(inp: HealthAgentInput, raw_text_char_limit: int = 6000) -> str:
    data = inp.model_dump(mode="json")
    raw = data["lab_report"].get("raw_text")
    if raw and len(raw) > raw_text_char_limit:
        data["lab_report"]["raw_text"] = raw[:raw_text_char_limit] + " ...[truncated]"

    contract = "\n".join(
        f'- {name}: probability={p.probability}, risk_percent={p.risk_percent}, '
        f'risk_level="{p.risk_level}"'
        for name, p in inp.ml_predictions.as_dict().items()
    )
    import json  # local import keeps the module header focused on hard dependencies

    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return (
        "Analyze the verified backend data below and return the response JSON.\n\n"
        "Values you must copy EXACTLY (never round or restate differently):\n"
        f"{contract}\n\n"
        f"Backend data:\n{payload}"
    )


def _retry_messages(previous: str, issues: list[ValidationIssue]) -> list[dict[str, str]]:
    listed = "\n".join(f"- [{i.code}] {i.message}" for i in issues[:12])
    feedback = (
        "Your previous response failed automated validation. Fix every issue below, "
        "keep everything else consistent with the backend data, and return the COMPLETE "
        "corrected JSON object only.\n" + listed
    )
    messages: list[dict[str, str]] = []
    if previous.strip():
        messages.append({"role": "assistant", "content": previous[:20000]})
    messages.append({"role": "user", "content": feedback})
    return messages


# =============================================================================
# Deterministic output validation (the LLM never judges its own output)
# =============================================================================

_SEVERITY_ORDER = {"Low": 0, "Moderate": 1, "Elevated": 2, "High": 3}

_PERCENT_RE = re.compile(r"(?<![\w.])(\d+(?:\.\d+)?)\s*(?:%|percent\b|per\s+cent\b)", re.I)
_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")

# Dose / frequency / dosage-form expressions. "mg/dL"-style lab units are excluded
# by the negative lookahead.
_DOSAGE_PATTERNS = tuple(
    re.compile(p, re.I)
    for p in (
        r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|iu|ml|units?)\b(?!\s*/)",
        r"\b(?:once|twice|thrice)\s+(?:a\s+|per\s+)?(?:day|daily)\b",
        r"\b(?:one|two|three|four)\s+times\s+(?:a|per)\s+day\b",
        r"\bevery\s+\d+\s+hours?\b",
        r"\b(?:bid|tid|qid|qd|prn)\b",
        r"\b(?:tablets?|capsules?|pills?)\b",
        r"\bdos(?:e|es|age|ing)\b",
    )
)

# Heuristic blocklist: drug names and classes. Extend as needed. Terms that also appear
# in a supplied lab test name (e.g. a "Fasting Insulin" test) are exempted per request.
_DRUG_TERMS = (
    "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "lovastatin", "statins?",
    "metformin", "glipizide", "gliclazide", "glimepiride", "sitagliptin", "empagliflozin",
    "dapagliflozin", "semaglutide", "liraglutide", "insulin", "aspirin", "clopidogrel",
    "warfarin", "apixaban", "rivaroxaban", "heparin", "lisinopril", "enalapril", "ramipril",
    "losartan", "telmisartan", "valsartan", "amlodipine", "nifedipine", "metoprolol",
    "atenolol", "bisoprolol", "carvedilol", "propranolol", "hydrochlorothiazide",
    "furosemide", "spironolactone", "nitroglycerin", "ibuprofen", "paracetamol",
    "acetaminophen", "naproxen", "prednisone", "sertraline", "fluoxetine",
    r"beta[\s-]?blockers?", r"ace[\s-]?inhibitors?", r"calcium[\s-]channel[\s-]blockers?",
    r"blood[\s-]thinners?", "diuretics?", "anticoagulants?", "antiplatelets?",
    "antihypertensives?", "antidepressants?", "sulfonylureas?", "fibrates?",
)
_DRUG_PATTERNS = tuple((t, re.compile(rf"\b(?:{t})\b", re.I)) for t in _DRUG_TERMS)

_FEAR_RE = re.compile(
    r"\b(?:dangerous(?:ly)?|danger|critical(?:ly)?|life[\s-]threatening|deadly|fatal|"
    r"alarming|terrifying|frightening|catastrophic)\b",
    re.I,
)

_DIAGNOSTIC_PATTERNS = tuple(
    re.compile(p, re.I)
    for p in (
        r"\byou\s+(?:definitely\s+|certainly\s+)?(?:have|suffer\s+from|are\s+suffering\s+from)"
        r"\s+(?:heart|cardiac|cardiovascular|coronary|kidney|renal)\s+(?:disease|condition|"
        r"failure)?",
        r"\byou\s+(?:definitely\s+|certainly\s+)?(?:have|had)\s+(?:a\s+)?stroke\b",
        r"\b(?:ai|model|algorithm)\s+(?:has\s+)?diagnos(?:ed|es)\b",
        r"\bdiagnos(?:ed|es)\s+(?:you\s+|the\s+patient\s+)?with\s+(?:heart|cardiac|"
        r"cardiovascular|coronary|kidney|renal|stroke)\b",
        r"\b(?:patient|he|she)\s+(?:definitely\s+)?has\s+(?:heart|cardiac|cardiovascular|"
        r"coronary)\s+(?:disease|condition|failure)\b",
        r"\b(?:patient|he|she)\s+(?:definitely\s+)?has\s+(?:kidney|renal)\s+(?:disease|condition|failure)\b",
        r"\b(?:patient|he|she)\s+(?:definitely\s+)?(?:has|had)\s+(?:a\s+)?stroke\b",
    )
)


def _same_number(a: float, b: float) -> bool:
    return math.isclose(a, b, rel_tol=0.0, abs_tol=1e-9)


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s if s is not None else "")).strip().lower()


def _values_equal(supplied: float | str, produced: str) -> bool:
    try:
        return _same_number(float(supplied), float(produced))
    except (TypeError, ValueError):
        return _norm(supplied) == _norm(produced)


def _narrative_strings(out: HealthAgentOutput) -> list[str]:
    """All free-text fields (structural copies like feature/test/value are excluded)."""
    texts = [out.overall_summary, out.ui.headline, out.specialist_follow_up.reason]
    for r in out.risk_overview:
        texts += [r.headline, r.short_explanation]
    texts += [f.explanation for f in out.key_factors]
    texts += [l.explanation for l in out.lab_insights]
    for rec in out.recommendations:
        texts += [rec.title, rec.description]
    pr = out.patient_report
    texts += [pr.summary, pr.risk_explanation, pr.lab_summary, pr.next_steps]
    d = out.doctor_summary
    texts += [d.clinical_overview, d.risk_summary, *d.important_factors, *d.lab_points,
              *d.follow_up_points]
    return texts


def _check_risk(out: HealthAgentOutput, inp: HealthAgentInput, issues: list[ValidationIssue]) -> None:
    expected = inp.ml_predictions.as_dict()
    seen: set[str] = set()
    for item in out.risk_overview:
        pred = expected.get(item.disease)
        if pred is None:
            issues.append(ValidationIssue(
                "UNKNOWN_DISEASE", f"risk_overview contains '{item.disease}', which was not supplied."))
            continue
        if item.disease in seen:
            issues.append(ValidationIssue(
                "DUPLICATE_DISEASE", f"risk_overview has more than one entry for '{item.disease}'."))
            continue
        seen.add(item.disease)
        if not _same_number(item.probability, pred.probability):
            issues.append(ValidationIssue(
                "PROBABILITY_MISMATCH",
                f"{item.disease}.probability must be exactly {pred.probability}."))
        if not _same_number(item.risk_percent, pred.risk_percent):
            issues.append(ValidationIssue(
                "PROBABILITY_MISMATCH",
                f"{item.disease}.risk_percent must be exactly {pred.risk_percent}."))
        if item.risk_level != pred.risk_level:
            issues.append(ValidationIssue(
                "RISK_LEVEL_MISMATCH",
                f"{item.disease}.risk_level must be exactly '{pred.risk_level}'."))
    for missing in expected.keys() - seen:
        issues.append(ValidationIssue(
            "MISSING_DISEASE", f"risk_overview is missing an entry for '{missing}'."))

    worst = max((p.risk_level for p in expected.values()), key=_SEVERITY_ORDER.__getitem__)
    if out.ui.overall_severity != worst:
        issues.append(ValidationIssue(
            "SEVERITY_MISMATCH", f"ui.overall_severity must be '{worst}' (highest supplied risk_level)."))


def _check_shap(out: HealthAgentOutput, inp: HealthAgentInput, issues: list[ValidationIssue]) -> None:
    supplied: dict[tuple[str, str, str], ShapFactor] = {}

    for disease, explanation in inp.shap.as_dict().items():
        for factor in (*explanation.top_positive_factors, *explanation.top_negative_factors):
            supplied[(disease, factor.feature, factor.direction)] = factor

    known_features_by_disease = {
        disease: {feature for d, feature, _ in supplied if d == disease}
        for disease in type(inp.shap).model_fields
    }

    for kf in out.key_factors:
        key = (kf.disease, kf.feature, kf.direction)
        match = supplied.get(key)

        if match is None:
            disease_features = known_features_by_disease.get(kf.disease, set())
            if kf.feature in disease_features:
                issues.append(ValidationIssue(
                    "SHAP_DIRECTION_MISMATCH",
                    f"key_factors '{kf.disease}/{kf.feature}' has direction '{kf.direction}', "
                    "which differs from the supplied SHAP data."
                ))
            else:
                issues.append(ValidationIssue(
                    "SHAP_UNKNOWN_FACTOR",
                    f"key_factors '{kf.disease}/{kf.feature}' is not in the supplied SHAP factors."
                ))
            continue

        if _norm(kf.label) != _norm(match.label):
            issues.append(ValidationIssue(
                "SHAP_LABEL_MISMATCH",
                f"key_factors '{kf.disease}/{kf.feature}' label must be exactly '{match.label}'."
            ))


def _check_labs(out: HealthAgentOutput, inp: HealthAgentInput, issues: list[ValidationIssue]) -> None:
    index: dict[str, list[LabValue]] = {}
    if inp.lab_report.available:
        for lv in inp.lab_report.extracted_values:
            index.setdefault(_norm(lv.test), []).append(lv)

    if out.lab_insights and not index:
        issues.append(ValidationIssue(
            "LAB_UNEXPECTED", "lab_insights must be [] because no extracted lab values were supplied."))
        return

    for li in out.lab_insights:
        candidates = index.get(_norm(li.test), [])
        if not candidates:
            issues.append(ValidationIssue(
                "LAB_UNKNOWN_TEST", f"lab_insights test '{li.test}' is not in the supplied extracted values."))
            continue
        match = next((c for c in candidates if _values_equal(c.value, li.value)), None)
        if match is None:
            issues.append(ValidationIssue(
                "LAB_VALUE_MISMATCH", f"lab_insights '{li.test}' value must be exactly as supplied."))
            continue
        if _norm(li.unit) != _norm(match.unit):
            issues.append(ValidationIssue(
                "LAB_UNIT_MISMATCH", f"lab_insights '{li.test}' unit must be exactly as supplied."))
        if match.needs_review and li.status != "unverified":
            issues.append(ValidationIssue(
                "LAB_STATUS_INVALID", f"'{li.test}' has needs_review=true, so status must be 'unverified'."))
        elif not match.needs_review and li.status == "unverified":
            issues.append(ValidationIssue(
                "LAB_STATUS_INVALID", f"'{li.test}' has needs_review=false, so status must not be 'unverified'."))
        elif not match.reference_range and li.status in ("normal", "important"):
            issues.append(ValidationIssue(
                "LAB_STATUS_INVALID",
                f"'{li.test}' has no supplied reference range, so status must be 'review' (or 'unverified')."))


def _check_structure(out: HealthAgentOutput, issues: list[ValidationIssue]) -> None:
    priorities = sorted(r.priority for r in out.recommendations)
    if priorities != list(range(1, len(priorities) + 1)):
        issues.append(ValidationIssue(
            "PRIORITY_INVALID", "recommendation priorities must be unique integers 1..N."))
    if out.ui.priority_count != len(out.recommendations):
        issues.append(ValidationIssue(
            "PRIORITY_COUNT_MISMATCH",
            f"ui.priority_count must equal the number of recommendations ({len(out.recommendations)})."))


def _check_language(out: HealthAgentOutput, inp: HealthAgentInput, issues: list[ValidationIssue]) -> None:
    texts = _narrative_strings(out)
    joined = "\n".join(texts)

    # Percentages: only the supplied risk_percent (or numbers that come from the lab data) allowed.
    allowed = {p.risk_percent for p in inp.ml_predictions.as_dict().values()}
    for lv in inp.lab_report.extracted_values:
        for chunk in (str(lv.value), lv.reference_range or ""):
            allowed.update(float(n) for n in _NUMBER_RE.findall(chunk))
    bad_percents = {
        m.group(1) for m in _PERCENT_RE.finditer(joined)
        if not any(_same_number(float(m.group(1)), a) for a in allowed)
    }
    for value in sorted(bad_percents):
        issues.append(ValidationIssue(
            "PERCENT_MISMATCH",
            f"text contains the percentage '{value}%', which is not the supplied risk_percent "
            f"or a supplied lab value. Quote only the exact supplied risk_percent."))

    for pattern in _DOSAGE_PATTERNS:
        m = pattern.search(joined)
        if m:
            issues.append(ValidationIssue(
                "MEDICATION_CONTENT", f"text contains dosage/medication-form wording ('{m.group(0)}'); remove it."))
            break

    lab_names = " ".join(lv.test for lv in inp.lab_report.extracted_values)
    for term, pattern in _DRUG_PATTERNS:
        if pattern.search(lab_names):
            continue
        m = pattern.search(joined)
        if m:
            issues.append(ValidationIssue(
                "MEDICATION_CONTENT", f"text names a medication or drug class ('{m.group(0)}'); remove it."))

    m = _FEAR_RE.search(joined)
    if m:
        issues.append(ValidationIssue(
            "FEAR_LANGUAGE", f"text uses fear-based wording ('{m.group(0)}'); use calm, neutral wording."))

    for pattern in _DIAGNOSTIC_PATTERNS:
        m = pattern.search(joined)
        if m:
            issues.append(ValidationIssue(
                "DIAGNOSTIC_CLAIM",
                "text states or implies a diagnosis; use 'estimated risk' / 'model indicates' wording."))
            break


def validate_output(out: HealthAgentOutput, inp: HealthAgentInput) -> list[ValidationIssue]:
    """Semantic validation of a schema-valid output against the verified backend input."""
    issues: list[ValidationIssue] = []
    _check_risk(out, inp, issues)
    _check_shap(out, inp, issues)
    _check_labs(out, inp, issues)
    _check_structure(out, issues)
    _check_language(out, inp, issues)
    return issues


def _parse_and_validate(
    content: str, inp: HealthAgentInput
) -> tuple[HealthAgentOutput | None, list[ValidationIssue]]:
    try:
        output = HealthAgentOutput.model_validate_json(content)
    except ValidationError as exc:
        issues = []
        for err in exc.errors()[:12]:  # never include err["input"] - it holds raw content
            loc = ".".join(str(p) for p in err["loc"]) or "<root>"
            code = "INVALID_JSON" if err["type"] == "json_invalid" else "SCHEMA_VIOLATION"
            issues.append(ValidationIssue(code, f"{loc}: {err['msg']}"))
        return None, issues
    issues = validate_output(output, inp)
    return (None if issues else output), issues


# =============================================================================
# The agent
# =============================================================================


def _error_code(exc: Exception) -> str | None:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error", body)
        if isinstance(err, dict):
            return err.get("code")
    return None


class HealthAgent:
    """Single HealthTwin interpretation agent (Groq + openai/gpt-oss-20b)."""

    def __init__(self, settings: AgentSettings | None = None, client: AsyncGroq | None = None) -> None:
        self._settings = settings or AgentSettings()
        if client is None:
            api_key = self._settings.api_key or os.environ.get("GROQ_API_KEY")
            if not api_key:
                raise HealthAgentConfigError("The Groq API key is not configured.")
            # max_retries=0: retries are handled here so they stay bounded and logged.
            client = AsyncGroq(api_key=api_key, timeout=self._settings.timeout_s, max_retries=0)
        self._client = client
        self._response_format = _response_format(self._settings.strict_schema)

    async def aclose(self) -> None:
        await self._client.close()

    # ------------------------------------------------------------------ public

    async def analyze(self, payload: HealthAgentInput | dict[str, Any]) -> HealthAgentOutput:
        request_id = uuid.uuid4().hex[:12]
        started = time.perf_counter()
        agent_input = self._parse_input(payload, request_id)

        base_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(
                agent_input, self._settings.raw_text_char_limit)},
        ]
        messages = list(base_messages)
        logger.info(
            "agent.start request_id=%s model=%s prompt_v=%s lab_values=%d",
            request_id, self._settings.model, PROMPT_VERSION,
            len(agent_input.lab_report.extracted_values),
        )

        issues: list[ValidationIssue] = []
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                content = await self._call_llm(messages, request_id, attempt)
            except HealthAgentError as exc:
                if exc.retryable and attempt < MAX_ATTEMPTS:
                    logger.warning("agent.retry_upstream request_id=%s attempt=%d code=%s",
                                   request_id, attempt, exc.code)
                    await asyncio.sleep(self._settings.retry_backoff_s)
                    continue
                logger.error("agent.failed request_id=%s attempt=%d code=%s",
                             request_id, attempt, exc.code)
                raise

            output, issues = _parse_and_validate(content, agent_input)
            if output is not None:
                logger.info("agent.ok request_id=%s attempts=%d total_ms=%d", request_id,
                            attempt, (time.perf_counter() - started) * 1000)
                return output

            codes = sorted({i.code for i in issues})
            logger.warning("agent.validation_failed request_id=%s attempt=%d codes=%s",
                           request_id, attempt, ",".join(codes))
            messages = base_messages + _retry_messages(content, issues)

        codes = sorted({i.code for i in issues})
        logger.error("agent.failed request_id=%s code=agent_output_invalid issue_codes=%s",
                     request_id, ",".join(codes))
        raise HealthAgentValidationError(
            "The health analysis could not be validated. Please try again later.",
            issue_codes=codes,
        )

    # ---------------------------------------------------------------- internals

    @staticmethod
    def _parse_input(payload: HealthAgentInput | dict[str, Any], request_id: str) -> HealthAgentInput:
        if isinstance(payload, HealthAgentInput):
            return payload
        try:
            return HealthAgentInput.model_validate(payload)
        except ValidationError as exc:
            # Field locations only - error 'input' values contain patient data.
            locs = sorted({".".join(str(p) for p in e["loc"]) for e in exc.errors()})[:20]
            logger.error("agent.invalid_input request_id=%s fields=%s", request_id, ",".join(locs))
            raise HealthAgentInputError(
                "The agent input did not match the expected schema.", issue_codes=locs
            ) from None

    async def _call_llm(self, messages: list[dict[str, str]], request_id: str, attempt: int) -> str:
        s = self._settings
        t0 = time.perf_counter()
        try:
            completion = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=s.model,
                    messages=messages,
                    temperature=s.temperature,
                    max_completion_tokens=s.max_completion_tokens,
                    response_format=self._response_format,
                    # gpt-oss: keep reasoning out of the response; we never read it anyway.
                    extra_body={"include_reasoning": False, "reasoning_effort": s.reasoning_effort},
                ),
                timeout=s.timeout_s + 5,  # hard cap on top of the HTTP timeout
            )
        # `from None` throughout: SDK exceptions can carry the model's raw output.
        except (asyncio.TimeoutError, groq.APITimeoutError):
            raise HealthAgentTimeoutError("The health analysis timed out.") from None
        except groq.APIConnectionError:
            raise HealthAgentUpstreamError(
                "The AI service could not be reached.", retryable=True) from None
        except (groq.AuthenticationError, groq.PermissionDeniedError):
            raise HealthAgentConfigError("The AI service rejected the configured credentials.") from None
        except groq.RateLimitError:
            raise HealthAgentUpstreamError(
                "The AI service is rate limited.", retryable=True) from None
        except groq.BadRequestError as exc:
            # json_validate_failed = the model's output violated the schema; worth one retry.
            retryable = _error_code(exc) == "json_validate_failed"
            raise HealthAgentUpstreamError(
                "The AI service rejected the request.", retryable=retryable) from None
        except groq.APIStatusError as exc:
            raise HealthAgentUpstreamError(
                "The AI service returned an error.", retryable=exc.status_code >= 500) from None

        choice = completion.choices[0] if completion.choices else None
        content = (choice.message.content or "") if choice else ""
        usage = completion.usage
        logger.info(
            "agent.llm_ok request_id=%s attempt=%d latency_ms=%d finish=%s prompt_tokens=%s completion_tokens=%s",
            request_id, attempt, (time.perf_counter() - t0) * 1000,
            getattr(choice, "finish_reason", None),
            getattr(usage, "prompt_tokens", None), getattr(usage, "completion_tokens", None),
        )
        return content


@lru_cache(maxsize=1)
def get_health_agent() -> HealthAgent:
    """Process-wide singleton for FastAPI dependency injection."""
    return HealthAgent()