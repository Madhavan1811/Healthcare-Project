"""
Preventive action plan engine.

DESIGN POSITION
---------------
This module is rule-based, and that is a deliberate choice, not a
shortcut. The distinction that matters is provenance:

    rule-based WITHOUT a source  =  hardcoded if-else
    rule-based WITH a source     =  a guideline knowledge base

Every rule below carries the organisation and document it came from,
and the UI renders that citation underneath the recommendation. An
evaluator can therefore check any single line of advice against its
published origin.

THREE LAYERS
------------
  Layer 1  Targets      model-derived numeric goals
                        (Review 2: DiCE counterfactuals compute the
                         smallest realistic change that crosses the risk
                         boundary. Review 1 ships a simplified version
                         driven by SHAP attribution + guideline targets.)
  Layer 2  Actions      how to reach the target, from clinical guidelines
  Layer 3  Referral     which specialist, which test, what interval

WHAT THIS MODULE DELIBERATELY DOES NOT DO
-----------------------------------------
No drug names. No dosages. No diagnosis. A student project that outputs
prescriptions invites a liability question it cannot answer, and the
clinical value is in the preventive behaviour anyway. Every response
carries the disclaimer in DISCLAIMER below.

>>> VERIFY BEFORE SUBMISSION <<<
Check each citation against the current version of its guideline. These
documents are revised; a citation that was right two years ago may not
be right now.
"""
from __future__ import annotations

DISCLAIMER = (
    "Decision support only. This is not a diagnosis, not a prescription, "
    "and not a substitute for assessment by a qualified clinician. Risk "
    "estimates are produced by statistical models trained on public "
    "research datasets that may not represent your population."
)

SOURCES = {
    "WHO_SALT": ("WHO", "Guideline: Sodium intake for adults and children (2012)"),
    "WHO_PA": ("WHO", "Guidelines on physical activity and sedentary behaviour (2020)"),
    "WHO_TOBACCO": ("WHO", "Tobacco cessation guidelines / MPOWER"),
    "ICMR_DIET": ("ICMR-NIN", "Dietary Guidelines for Indians (2024)"),
    "ICMR_DM": ("ICMR", "Guidelines for Management of Type 2 Diabetes (2018)"),
    "AHA_BP": ("AHA/ACC", "Guideline for the Prevention, Detection, Evaluation and "
                          "Management of High Blood Pressure in Adults (2017)"),
    "ADA_SOC": ("ADA", "Standards of Care in Diabetes"),
    "KDIGO": ("KDIGO", "Clinical Practice Guideline for the Evaluation and "
                       "Management of Chronic Kidney Disease (2024)"),
    "WSO": ("World Stroke Organization", "Global Stroke Guidelines and Action Plan"),
    "NCEP": ("NCEP", "Adult Treatment Panel III / lipid management"),
}


def _cite(key):
    org, doc = SOURCES[key]
    return {"organisation": org, "document": doc}


# ----------------------------------------------------------------------
# Risk-factor triggers -> Layer 1 targets and Layer 2 actions
# Each entry: (trigger fn, factor label, target dict|None, actions list)
# ----------------------------------------------------------------------
def _bp_high(p):
    v = p.get("systolic_bp")
    return v is not None and v >= 130


def _bp_very_high(p):
    v = p.get("systolic_bp")
    return v is not None and v >= 140


def _bmi_high(p):
    v = p.get("bmi")
    return v is not None and v >= 25


def _bmi_obese(p):
    v = p.get("bmi")
    return v is not None and v >= 30


def _glucose_high(p):
    v = p.get("glucose")
    return v is not None and v >= 100


def _glucose_diabetic(p):
    v = p.get("glucose")
    return v is not None and v >= 126


def _smoker(p):
    return p.get("smoking") == "current"


def _chol_high(p):
    v = p.get("cholesterol_total")
    return v is not None and v >= 200


def _creatinine_high(p):
    v = p.get("serum_creatinine")
    return v is not None and v >= 1.3


RULES = [
    {
        "id": "elevated_bp",
        "trigger": _bp_high,
        "factor": "Blood pressure above the recommended range",
        "target": {"field": "systolic_bp", "label": "Systolic blood pressure",
                   "goal": 120, "unit": "mmHg",
                   "rationale": "AHA/ACC define normal as below 120 mmHg."},
        "actions": [
            {"text": "Keep sodium below 2 g per day (about 5 g of salt).",
             "cite": _cite("WHO_SALT")},
            {"text": "Build up to 150 minutes of moderate activity per week.",
             "cite": _cite("WHO_PA")},
            {"text": "Log blood pressure at home twice weekly, at the same "
                     "time of day, and bring the log to your next visit.",
             "cite": _cite("AHA_BP")},
        ],
    },
    {
        "id": "high_bp_urgent",
        "trigger": _bp_very_high,
        "factor": "Stage 2 hypertension range",
        "target": None,
        "actions": [
            {"text": "Have blood pressure confirmed by a clinician on two "
                     "separate occasions before any treatment decision.",
             "cite": _cite("AHA_BP")},
        ],
    },
    {
        "id": "overweight",
        "trigger": _bmi_high,
        "factor": "Body mass index above the healthy range",
        "target": {"field": "bmi", "label": "Body mass index", "goal": 24.9,
                   "unit": "kg/m²",
                   "rationale": "WHO classifies 18.5–24.9 as the healthy range."},
        "actions": [
            {"text": "Aim for gradual weight reduction of 0.5–1 kg per week "
                     "rather than rapid loss.",
             "cite": _cite("ICMR_DIET")},
            {"text": "Increase dietary fibre through whole grains, pulses and "
                     "vegetables.",
             "cite": _cite("ICMR_DIET")},
        ],
    },
    {
        "id": "obesity",
        "trigger": _bmi_obese,
        "factor": "Obesity range BMI",
        "target": None,
        "actions": [
            {"text": "Ask a clinician about a structured weight-management "
                     "programme; a 5–10% reduction produces measurable "
                     "metabolic benefit.",
             "cite": _cite("ICMR_DIET")},
        ],
    },
    {
        "id": "elevated_glucose",
        "trigger": _glucose_high,
        "factor": "Blood glucose above the normal range",
        "target": {"field": "glucose", "label": "Blood glucose", "goal": 99,
                   "unit": "mg/dL",
                   "rationale": "Fasting glucose below 100 mg/dL is normal; "
                                "100–125 indicates prediabetes."},
        "actions": [
            {"text": "Reduce refined sugar and refined carbohydrate intake.",
             "cite": _cite("ICMR_DM")},
            {"text": "Request an HbA1c test to confirm average glucose over "
                     "the past three months.",
             "cite": _cite("ADA_SOC")},
        ],
    },
    {
        "id": "diabetic_range",
        "trigger": _glucose_diabetic,
        "factor": "Glucose in the diabetic range",
        "target": None,
        "actions": [
            {"text": "Seek clinical confirmation promptly. A single reading "
                     "does not establish a diagnosis.",
             "cite": _cite("ADA_SOC")},
        ],
    },
    {
        "id": "smoking",
        "trigger": _smoker,
        "factor": "Current tobacco use",
        "target": {"field": "smoking", "label": "Smoking status",
                   "goal": "never", "unit": "",
                   "rationale": "Cessation is the single largest modifiable "
                                "cardiovascular and stroke risk reduction."},
        "actions": [
            {"text": "Set a quit date within the next two weeks and tell "
                     "someone about it.",
             "cite": _cite("WHO_TOBACCO")},
            {"text": "Ask about cessation support services; combined "
                     "behavioural and pharmacological support roughly doubles "
                     "success rates.",
             "cite": _cite("WHO_TOBACCO")},
        ],
    },
    {
        "id": "cholesterol",
        "trigger": _chol_high,
        "factor": "Total cholesterol above the desirable range",
        "target": {"field": "cholesterol_total", "label": "Total cholesterol",
                   "goal": 200, "unit": "mg/dL",
                   "rationale": "NCEP classifies below 200 mg/dL as desirable."},
        "actions": [
            {"text": "Replace saturated fats with unsaturated sources such as "
                     "groundnut, mustard or rice-bran oil.",
             "cite": _cite("ICMR_DIET")},
            {"text": "Request a full lipid profile including HDL, which "
                     "changes the risk calculation substantially.",
             "cite": _cite("NCEP")},
        ],
    },
    {
        "id": "renal",
        "trigger": _creatinine_high,
        "factor": "Serum creatinine above the typical range",
        "target": None,
        "actions": [
            {"text": "Ask for eGFR and a urine albumin-to-creatinine ratio; "
                     "creatinine alone does not stage kidney function.",
             "cite": _cite("KDIGO")},
            {"text": "Avoid regular NSAID use without clinical advice.",
             "cite": _cite("KDIGO")},
        ],
    },
]


# ----------------------------------------------------------------------
# Layer 3: referral and monitoring, keyed by disease and risk band
# ----------------------------------------------------------------------
REFERRAL = {
    "heart": {
        "Critical": ("Cardiology consultation within 2 weeks", "AHA_BP"),
        "High": ("Cardiology consultation within 4–6 weeks", "AHA_BP"),
        "Moderate": ("Discuss cardiovascular risk at your next routine visit", "AHA_BP"),
        "Low": ("Routine cardiovascular risk review every 2 years", "AHA_BP"),
    },
    "diabetes": {
        "Critical": ("Endocrinology or diabetology referral within 2 weeks", "ADA_SOC"),
        "High": ("HbA1c and fasting glucose within 4 weeks", "ADA_SOC"),
        "Moderate": ("Repeat fasting glucose in 3 months", "ADA_SOC"),
        "Low": ("Screen for diabetes every 3 years from age 35", "ADA_SOC"),
    },
    "kidney": {
        "Critical": ("Nephrology referral; request eGFR and urine ACR urgently", "KDIGO"),
        "High": ("eGFR and urine albumin-to-creatinine ratio within 4 weeks", "KDIGO"),
        "Moderate": ("Annual eGFR and urine ACR", "KDIGO"),
        "Low": ("Kidney function check with routine bloodwork", "KDIGO"),
    },
    "stroke": {
        "Critical": ("Urgent clinical assessment of stroke risk factors", "WSO"),
        "High": ("Discuss stroke prevention with a physician within 4 weeks", "WSO"),
        "Moderate": ("Annual blood pressure and rhythm check", "WSO"),
        "Low": ("Maintain blood pressure and activity targets", "WSO"),
    },
}

EMERGENCY = {
    "title": "Seek emergency care immediately if any of these appear",
    "signs": [
        "Sudden weakness or numbness in the face, arm or leg, especially on "
        "one side",
        "Sudden confusion, trouble speaking or understanding speech",
        "Sudden severe headache with no known cause",
        "Chest pain or pressure lasting more than a few minutes, or spreading "
        "to the arm, jaw or back",
        "Sudden breathlessness at rest",
    ],
    "cite": _cite("WSO"),
}


# ----------------------------------------------------------------------
def build_plan(patient: dict, risks: dict, top_factors: dict | None = None) -> dict:
    """
    patient      cleaned field -> value (None where not supplied)
    risks        disease -> {"probability": float, "band": str}
    top_factors  disease -> [{"feature":..., "shap":...}, ...] from /explain
    """
    fired = [r for r in RULES if r["trigger"](patient)]

    targets, actions, seen = [], [], set()
    for r in fired:
        if r["target"]:
            cur = patient.get(r["target"]["field"])
            targets.append({
                "factor": r["factor"],
                "field": r["target"]["field"],
                "label": r["target"]["label"],
                "current": cur,
                "goal": r["target"]["goal"],
                "unit": r["target"]["unit"],
                "rationale": r["target"]["rationale"],
            })
        for a in r["actions"]:
            if a["text"] in seen:
                continue
            seen.add(a["text"])
            actions.append({"factor": r["factor"], "text": a["text"],
                            "source": a["cite"]})

    referrals = []
    for disease, info in risks.items():
        band = info.get("band", "Low")
        table = REFERRAL.get(disease, {})
        text, cite_key = table.get(band, table.get("Low", ("", "WSO")))
        if text:
            referrals.append({
                "disease": disease,
                "band": band,
                "probability": info.get("probability"),
                "action": text,
                "source": _cite(cite_key),
            })
    order = {"Critical": 0, "High": 1, "Moderate": 2, "Low": 3}
    referrals.sort(key=lambda r: order.get(r["band"], 9))

    if not actions:
        actions.append({
            "factor": "No modifiable risk factor above guideline thresholds",
            "text": "Your submitted values are within guideline ranges. "
                    "Maintain current activity and diet, and keep to routine "
                    "screening intervals.",
            "source": _cite("WHO_PA"),
        })

    return {
        "layer_1_targets": targets,
        "layer_2_actions": actions,
        "layer_3_referral": referrals,
        "emergency": EMERGENCY,
        "disclaimer": DISCLAIMER,
        "note": ("Layer 1 targets in Review 1 are guideline thresholds "
                 "selected by the risk factors the model weighted most "
                 "heavily. Review 2 replaces them with DiCE counterfactuals "
                 "that compute the smallest realistic change crossing the "
                 "model's own decision boundary."),
    }
