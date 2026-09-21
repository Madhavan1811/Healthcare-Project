from __future__ import annotations

import io
import re
from typing import Any

from fastapi import UploadFile
from pypdf import PdfReader


# Common lab names we may want to surface to the HealthTwin agent.
# This is intentionally conservative: values are only extracted when a
# recognizable test name appears near a numeric value.
LAB_PATTERNS: dict[str, re.Pattern[str]] = {
    "HbA1c": re.compile(r"\b(?:hba1c|a1c|glycated\s+hemoglobin)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(%)?", re.I),
    "Fasting Glucose": re.compile(r"\b(?:fasting\s+glucose|fasting\s+blood\s+sugar|fbs)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mg/dl|mmol/l)?", re.I),
    "Total Cholesterol": re.compile(r"\btotal\s+cholesterol\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mg/dl|mmol/l)?", re.I),
    "LDL": re.compile(r"\b(?:ldl(?:\s+cholesterol)?|low[-\s]?density\s+lipoprotein)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mg/dl|mmol/l)?", re.I),
    "HDL": re.compile(r"\b(?:hdl(?:\s+cholesterol)?|high[-\s]?density\s+lipoprotein)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mg/dl|mmol/l)?", re.I),
    "Triglycerides": re.compile(r"\btriglycerides?\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mg/dl|mmol/l)?", re.I),
    "Systolic Blood Pressure": re.compile(r"\b(?:systolic\s+blood\s+pressure|sbp)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mmhg)?", re.I),
    "Diastolic Blood Pressure": re.compile(r"\b(?:diastolic\s+blood\s+pressure|dbp)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mmhg)?", re.I),
    "Creatinine": re.compile(r"\bcreatinine\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(mg/dl|µmol/l|umol/l)?", re.I),
    "eGFR": re.compile(r"\b(?:egfr|estimated\s+gfr)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(ml/min(?:/1\.73m2)?)?", re.I),
    "Hemoglobin": re.compile(r"\b(?:hemoglobin|haemoglobin|hgb)\b[^\d]{0,40}(\d+(?:\.\d+)?)\s*(g/dl|g/l)?", re.I),
}


def _clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_labs(text: str) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str | None]] = set()

    for test_name, pattern in LAB_PATTERNS.items():
        for match in pattern.finditer(text):
            value = match.group(1)
            unit = match.group(2) if match.lastindex and match.lastindex >= 2 else None
            key = (test_name, value, unit)
            if key in seen:
                continue
            seen.add(key)

            values.append(
                {
                    "test": test_name,
                    "value": float(value),
                    "unit": unit,
                    "reference_range": None,
                    "extraction_confidence": 0.85,
                    # Regex extraction is not a clinical verification step.
                    "needs_review": True,
                }
            )

    return values


async def extract_lab_report(
    file: UploadFile,
    *,
    max_bytes: int = 15 * 1024 * 1024,
    max_pages: int = 25,
    raw_text_char_limit: int = 12000,
) -> dict[str, Any]:
    """
    Extract text from an uploaded PDF and conservatively identify common
    laboratory values.

    This service is an extraction layer only. It does NOT diagnose,
    interpret, or pass extracted lab values directly into the ML model.
    The patient/clinician workflow should review extracted values.
    """
    filename = file.filename or ""
    content_type = (file.content_type or "").lower()

    if not filename.lower().endswith(".pdf") and content_type != "application/pdf":
        raise ValueError("Only PDF lab reports are supported.")

    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise ValueError(f"PDF is too large. Maximum size is {max_bytes // (1024 * 1024)} MB.")

    if not content:
        raise ValueError("The uploaded PDF is empty.")

    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:
        raise ValueError("The uploaded file is not a readable PDF.") from exc

    if len(reader.pages) > max_pages:
        raise ValueError(f"PDF has too many pages. Maximum supported pages: {max_pages}.")

    page_text: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            page_text.append(text)

    raw_text = _clean_text("\n\n".join(page_text))

    return {
        "available": bool(raw_text),
        "source": "uploaded_pdf",
        "extracted_values": _extract_labs(raw_text) if raw_text else [],
        "raw_text": raw_text[:raw_text_char_limit] if raw_text else None,
        "filename": filename,
        "pages": len(reader.pages),
    }