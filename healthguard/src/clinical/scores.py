"""
Published clinical risk scores, used as baselines for our models.

WHY THIS MODULE MATTERS
-----------------------
Comparing a student model against another student model proves nothing.
Comparing it against the instrument clinicians actually use is a real
benchmark. This module implements two:

  Framingham General CVD Risk (office/BMI-based variant)
      D'Agostino RB Sr, Vasan RS, Pencina MJ, et al.
      "General Cardiovascular Risk Profile for Use in Primary Care:
       The Framingham Heart Study." Circulation. 2008;117(6):743-753.

  FINDRISC (Finnish Diabetes Risk Score)
      Lindstrom J, Tuomilehto J. "The Diabetes Risk Score: a practical
      tool to predict type 2 diabetes risk." Diabetes Care.
      2003;26(3):725-731.

>>> VERIFY BEFORE SUBMISSION <<<
The Framingham coefficients in FRAMINGHAM_COEF below are transcribed
from the published Table 6 simple (BMI-based) model. Check every number
against the paper itself before you put this in your report. If an
evaluator asks "where did these come from", the answer must be the
paper, not this file.

THE SECOND AUDIT FINDING
------------------------
Neither score can be computed in full on these public datasets:

  * Framingham needs BMI and smoking status. UCI Heart records neither.
  * FINDRISC needs waist circumference, physical activity, diet and
    family history. Pima records none of them.

Rather than silently substituting population averages and reporting the
result as though it were the real instrument, every call returns an
ItemReport saying exactly which inputs were available, which were
substituted, and what the substitution was. Comparisons in the report
must be read as indicative of DISCRIMINATION only.

A further caveat, stated plainly: Framingham predicts 10-year INCIDENT
cardiovascular disease, while the UCI Heart target is PREVALENT
angiographic disease. Ranking ability (AUC) is still a fair comparison.
Absolute calibration is not transferable and we do not claim it is.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd


# ======================================================================
# Item availability reporting
# ======================================================================
@dataclass
class ItemReport:
    """Records how honestly a clinical score could be computed."""
    score_name: str
    required: list
    available: list = field(default_factory=list)
    substituted: dict = field(default_factory=dict)
    unavailable: list = field(default_factory=list)

    @property
    def completeness(self) -> float:
        return len(self.available) / len(self.required)

    def summary(self) -> str:
        s = (f"{self.score_name}: {len(self.available)}/{len(self.required)} "
             f"required inputs available ({self.completeness:.0%})")
        if self.substituted:
            s += "\n  substituted: " + "; ".join(
                f"{k} <- {v}" for k, v in self.substituted.items())
        if self.unavailable:
            s += "\n  unavailable: " + ", ".join(self.unavailable)
        return s

    def to_dict(self) -> dict:
        return {"score_name": self.score_name, "required": self.required,
                "available": self.available, "substituted": self.substituted,
                "unavailable": self.unavailable,
                "completeness": round(self.completeness, 3)}


# ======================================================================
# Framingham General CVD Risk -- BMI-based ("office") variant
# ======================================================================
# D'Agostino 2008, Table 6 (simple model). Risk over 10 years:
#     L    = sum(beta_i * x_i)
#     risk = 1 - S0 ** exp(L - Lbar)
FRAMINGHAM_COEF = {
    "female": {
        "ln_age": 2.72107,
        "ln_bmi": 0.51125,
        "ln_sbp_untreated": 2.81291,
        "ln_sbp_treated": 2.88267,
        "smoker": 0.61868,
        "diabetic": 0.77763,
        "Lbar": 26.0145,
        "S0": 0.94833,
    },
    "male": {
        "ln_age": 3.11296,
        "ln_bmi": 0.79277,
        "ln_sbp_untreated": 1.85508,
        "ln_sbp_treated": 1.92672,
        "smoker": 0.70953,
        "diabetic": 0.53160,
        "Lbar": 23.9388,
        "S0": 0.88431,
    },
}

FRAMINGHAM_REQUIRED = ["age", "sex", "systolic_bp", "bmi", "smoking",
                       "diabetes_status", "bp_treated"]


def framingham_cvd_risk(
    df: pd.DataFrame,
    *,
    bmi_fallback: Optional[float] = None,
    smoking_fallback: str = "never",
    assume_untreated_bp: bool = True,
) -> tuple[np.ndarray, ItemReport]:
    """
    10-year general CVD risk, BMI-based Framingham variant.

    Returns (risk in [0,1], ItemReport).

    Missing inputs are filled from the fallbacks and RECORDED in the
    ItemReport. They are never filled silently.
    """
    rep = ItemReport("Framingham General CVD (BMI-based)", FRAMINGHAM_REQUIRED)
    n = len(df)

    # --- age -----------------------------------------------------------
    age = pd.to_numeric(df["age"], errors="coerce")
    rep.available.append("age")

    # --- sex -----------------------------------------------------------
    if "sex" in df.columns and df["sex"].notna().any():
        sex = df["sex"].astype(str).str.lower()
        rep.available.append("sex")
    else:
        sex = pd.Series(["female"] * n, index=df.index)
        rep.substituted["sex"] = "assumed female (not recorded in source)"

    # --- systolic BP ---------------------------------------------------
    sbp = pd.to_numeric(df.get("systolic_bp"), errors="coerce") \
        if "systolic_bp" in df.columns else pd.Series(np.nan, index=df.index)
    if sbp.notna().any():
        rep.available.append("systolic_bp")
    else:
        rep.unavailable.append("systolic_bp")

    # --- BMI -----------------------------------------------------------
    bmi = pd.to_numeric(df.get("bmi"), errors="coerce") \
        if "bmi" in df.columns else pd.Series(np.nan, index=df.index)
    if bmi.notna().any():
        rep.available.append("bmi")
    else:
        fb = bmi_fallback if bmi_fallback is not None else 27.0
        bmi = pd.Series(fb, index=df.index)
        rep.substituted["bmi"] = (f"constant {fb} (not collected by source; "
                                  f"score cannot discriminate on this axis)")

    # --- smoking -------------------------------------------------------
    if "smoking" in df.columns and df["smoking"].notna().any():
        smoker = (df["smoking"].astype(str).str.lower() == "current").astype(float)
        rep.available.append("smoking")
    else:
        smoker = pd.Series(1.0 if smoking_fallback == "current" else 0.0,
                           index=df.index)
        rep.substituted["smoking"] = (f"constant '{smoking_fallback}' "
                                      f"(not collected by source)")

    # --- diabetes status -----------------------------------------------
    if "fasting_bs_high" in df.columns and df["fasting_bs_high"].notna().any():
        diabetic = pd.to_numeric(df["fasting_bs_high"], errors="coerce").fillna(0)
        rep.available.append("diabetes_status")
        rep.substituted["diabetes_status"] = "binary fbs flag (>120 mg/dL)"
    elif "glucose" in df.columns and df["glucose"].notna().any():
        diabetic = (pd.to_numeric(df["glucose"], errors="coerce") >= 126).astype(float)
        rep.available.append("diabetes_status")
        rep.substituted["diabetes_status"] = "derived from glucose >= 126 mg/dL"
    else:
        diabetic = pd.Series(0.0, index=df.index)
        rep.unavailable.append("diabetes_status")

    # --- BP treatment status -------------------------------------------
    if assume_untreated_bp:
        rep.substituted["bp_treated"] = ("assumed untreated (treatment status "
                                         "not recorded in any source dataset)")
    else:
        rep.available.append("bp_treated")

    # --- evaluate ------------------------------------------------------
    risk = np.full(n, np.nan)
    for grp in ("female", "male"):
        c = FRAMINGHAM_COEF[grp]
        m = (sex == grp).to_numpy()
        if not m.any():
            continue
        a = np.clip(age.to_numpy()[m].astype(float), 30, 79)
        b = np.clip(bmi.to_numpy()[m].astype(float), 15, 50)
        s = np.clip(sbp.to_numpy()[m].astype(float), 90, 200)
        s = np.where(np.isnan(s), 120.0, s)
        b = np.where(np.isnan(b), 27.0, b)

        L = (c["ln_age"] * np.log(a)
             + c["ln_bmi"] * np.log(b)
             + c["ln_sbp_untreated"] * np.log(s)
             + c["smoker"] * smoker.to_numpy()[m].astype(float)
             + c["diabetic"] * diabetic.to_numpy()[m].astype(float))
        risk[m] = 1.0 - c["S0"] ** np.exp(L - c["Lbar"])

    return np.clip(risk, 0.0, 1.0), rep


# ======================================================================
# FINDRISC -- Finnish Diabetes Risk Score
# ======================================================================
FINDRISC_REQUIRED = ["age", "bmi", "waist_circumference", "physical_activity",
                     "fruit_veg_daily", "bp_medication", "high_glucose_history",
                     "family_history"]

FINDRISC_BANDS = [
    (7,  "Low",              0.01),
    (12, "Slightly elevated", 0.04),
    (15, "Moderate",          0.17),
    (21, "High",              0.33),
    (99, "Very high",         0.50),
]


def findrisc_score(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, ItemReport]:
    """
    Adapted FINDRISC.

    Returns (points, estimated 10-year risk, ItemReport).

    ADAPTATION, stated openly: the Pima dataset does not record waist
    circumference, physical activity, diet or family history. Those four
    items (worth 12 of the 26 published points) are dropped. Two further
    items are approximated:

        bp_medication        <- diastolic BP >= 90 mmHg
        family_history       <- DiabetesPedigreeFunction bands

    The resulting instrument has a maximum of 19 points, not 26. It is
    therefore NOT the published FINDRISC and must not be reported as
    though it were. It is a documented degraded variant, used here only
    to give the ML model a clinically-grounded comparator.
    """
    rep = ItemReport("FINDRISC (adapted)", FINDRISC_REQUIRED)
    n = len(df)
    pts = np.zeros(n)

    # --- age (0/2/3/4) -------------------------------------------------
    age = pd.to_numeric(df["age"], errors="coerce").fillna(45).to_numpy()
    pts += np.select([age < 45, age < 55, age < 65], [0, 2, 3], default=4)
    rep.available.append("age")

    # --- BMI (0/1/3) ---------------------------------------------------
    bmi = pd.to_numeric(df["bmi"], errors="coerce").to_numpy()
    bmi_f = np.where(np.isnan(bmi), 27.0, bmi)
    pts += np.select([bmi_f < 25, bmi_f <= 30], [0, 1], default=3)
    rep.available.append("bmi")

    # --- items Pima never collected ------------------------------------
    for item in ["waist_circumference", "physical_activity", "fruit_veg_daily"]:
        rep.unavailable.append(item)

    # --- BP medication (0/2), approximated -----------------------------
    if "diastolic_bp" in df.columns and df["diastolic_bp"].notna().any():
        dbp = pd.to_numeric(df["diastolic_bp"], errors="coerce").fillna(75).to_numpy()
        pts += np.where(dbp >= 90, 2, 0)
        rep.substituted["bp_medication"] = "diastolic BP >= 90 mmHg used as proxy"
    else:
        rep.unavailable.append("bp_medication")

    # --- history of high blood glucose (0/5) ---------------------------
    if "glucose" in df.columns and df["glucose"].notna().any():
        g = pd.to_numeric(df["glucose"], errors="coerce").fillna(100).to_numpy()
        pts += np.where(g >= 140, 5, 0)
        rep.available.append("high_glucose_history")
        rep.substituted["high_glucose_history"] = "2-hour plasma glucose >= 140 mg/dL"
    else:
        rep.unavailable.append("high_glucose_history")

    # --- family history (0/3/5), approximated --------------------------
    if "diabetes_pedigree" in df.columns and df["diabetes_pedigree"].notna().any():
        dpf = pd.to_numeric(df["diabetes_pedigree"], errors="coerce").fillna(0.3).to_numpy()
        pts += np.select([dpf < 0.30, dpf < 0.60], [0, 3], default=5)
        rep.substituted["family_history"] = ("DiabetesPedigreeFunction bands "
                                             "(<0.30 / <0.60 / >=0.60)")
    else:
        rep.unavailable.append("family_history")

    # --- map points to published risk bands ----------------------------
    risk = np.zeros(n)
    for cutoff, _label, r in FINDRISC_BANDS:
        risk = np.where((risk == 0) & (pts < cutoff), r, risk)
    risk = np.where(risk == 0, FINDRISC_BANDS[-1][2], risk)

    return pts, risk, rep


def findrisc_band(points: float) -> str:
    for cutoff, label, _ in FINDRISC_BANDS:
        if points < cutoff:
            return label
    return FINDRISC_BANDS[-1][1]


# ======================================================================
if __name__ == "__main__":
    from pathlib import Path
    ROOT = Path(__file__).resolve().parents[2]

    heart = pd.read_csv(ROOT / "data" / "processed" / "heart.csv")
    r, rep = framingham_cvd_risk(heart)
    print(rep.summary())
    print(f"  risk: mean {np.nanmean(r):.3f}  range "
          f"{np.nanmin(r):.3f}-{np.nanmax(r):.3f}\n")

    dia = pd.read_csv(ROOT / "data" / "processed" / "diabetes.csv")
    p, r2, rep2 = findrisc_score(dia)
    print(rep2.summary())
    print(f"  points: mean {p.mean():.1f}  max observed {p.max():.0f} "
          f"(published maximum is 26)")
