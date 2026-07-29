"""
Cleaning layer for HealthGuard AI.

DESIGN RULE (read this before changing anything)
------------------------------------------------
Cleaners perform DETERMINISTIC repairs only:
  * type coercion            ("13.5\t"  -> 13.5)
  * sentinel decoding        ('?' and impossible 0s -> NaN)
  * label normalisation      ("ckd\t"   -> 1)
  * renaming to schema names (trestbps  -> systolic_bp)

Cleaners DO NOT impute and DO NOT scale. Both of those are fitted
inside the model pipeline, per cross-validation fold, so that no
information from a validation fold can leak into training. This single
rule is the main reason our reported accuracy is lower -- and more
trustworthy -- than the 95% figures common in this project space.

CORE-FIELD COVERAGE
-------------------
Each cleaner also reports how each of the six core fields is actually
represented in its source dataset:

  direct    a comparable measurement of the same quantity
  proxy     a related but non-equivalent measurement
            (Heart's binary fbs standing in for a glucose value;
             diastolic BP standing in for systolic)
  constant  present but with no variance (Pima is female-only)
  absent    never collected

The resulting matrix is the empirical basis for our claim that a
single patient form cannot honestly drive four models trained on
heterogeneous public datasets. See docs/dataset_audit.md.
"""
from __future__ import annotations

import json
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"

CORE = ["age", "sex", "systolic_bp", "bmi", "glucose", "smoking"]

DIRECT, PROXY, CONSTANT, ABSENT = "direct", "proxy", "constant", "absent"


def _strip_numeric(s: pd.Series) -> pd.Series:
    """Coerce a string-typed numeric column, dropping stray tabs/spaces."""
    return pd.to_numeric(
        s.astype(str).str.replace(r"[\t\s]+", "", regex=True)
         .replace({"": None, "?": None, "nan": None, "None": None}),
        errors="coerce")


# ======================================================================
# HEART -- UCI Cleveland
# ======================================================================
def clean_heart(df: pd.DataFrame):
    log = []
    out = pd.DataFrame(index=df.index)

    out["age"] = pd.to_numeric(df["age"], errors="coerce")
    out["sex"] = np.where(pd.to_numeric(df["sex"], errors="coerce") == 1,
                          "male", "female")
    out["systolic_bp"] = pd.to_numeric(df["trestbps"], errors="coerce")

    # Heart records fasting blood sugar only as a binary flag (>120 mg/dL).
    # We keep the flag; we do NOT invent a glucose value from it.
    out["glucose"] = np.nan
    log.append("glucose left NaN: source records only binary fbs (>120 mg/dL)")
    out["bmi"] = np.nan
    log.append("bmi left NaN: not collected by UCI Heart")
    out["smoking"] = np.nan
    log.append("smoking left NaN: not collected by UCI Heart")

    # disease-specific extensions
    out["cholesterol_total"] = pd.to_numeric(df["chol"], errors="coerce")
    n0 = int((out["cholesterol_total"] == 0).sum())
    if n0:
        out.loc[out["cholesterol_total"] == 0, "cholesterol_total"] = np.nan
        log.append(f"cholesterol: {n0} zeros decoded as missing")

    cp_map = {1: "typical_angina", 2: "atypical_angina",
              3: "non_anginal", 4: "asymptomatic"}
    out["chest_pain_type"] = pd.to_numeric(df["cp"], errors="coerce").map(cp_map)
    out["fasting_bs_high"] = pd.to_numeric(df["fbs"], errors="coerce")
    ecg_map = {0: "normal", 1: "st_t_abnormality", 2: "lv_hypertrophy"}
    out["resting_ecg"] = pd.to_numeric(df["restecg"], errors="coerce").map(ecg_map)
    out["max_heart_rate"] = pd.to_numeric(df["thalach"], errors="coerce")
    out["exercise_angina"] = np.where(
        pd.to_numeric(df["exang"], errors="coerce") == 1, "yes", "no")
    out["st_depression"] = pd.to_numeric(df["oldpeak"], errors="coerce")
    slope_map = {1: "upsloping", 2: "flat", 3: "downsloping"}
    out["st_slope"] = pd.to_numeric(df["slope"], errors="coerce").map(slope_map)

    q = _strip_numeric(df["ca"])
    log.append(f"ca: {int(q.isna().sum())} '?' markers decoded as missing")
    out["major_vessels"] = q

    t = _strip_numeric(df["thal"])
    log.append(f"thal: {int(t.isna().sum())} '?' markers decoded as missing")
    out["thalassemia"] = t.map({3: "normal", 6: "fixed_defect", 7: "reversible_defect"})

    # UCI target is 0-4 severity; the standard binarisation is num > 0
    out["target"] = (pd.to_numeric(df["num"], errors="coerce") > 0).astype(int)
    log.append("target binarised from num (0-4) as num > 0")

    coverage = {"age": DIRECT, "sex": DIRECT, "systolic_bp": DIRECT,
                "bmi": ABSENT, "glucose": PROXY, "smoking": ABSENT}
    return out, log, coverage


# ======================================================================
# DIABETES -- Pima Indians
# ======================================================================
def clean_diabetes(df: pd.DataFrame):
    log = []
    out = pd.DataFrame(index=df.index)

    out["age"] = pd.to_numeric(df["Age"], errors="coerce")

    # The cohort is female by construction. Recorded so the model-scope
    # warning can fire, but it carries zero predictive variance.
    out["sex"] = "female"
    log.append("sex set to 'female' for all rows: Pima cohort is female-only")

    # Pima's BloodPressure is DIASTOLIC. It is NOT interchangeable with
    # the systolic reading the form collects, so it is kept separate.
    out["systolic_bp"] = np.nan
    log.append("systolic_bp left NaN: source records DIASTOLIC pressure only")

    out["smoking"] = np.nan
    log.append("smoking left NaN: not collected by Pima")

    zero_is_missing = {"Glucose": "glucose", "BloodPressure": "diastolic_bp",
                       "SkinThickness": "skin_thickness", "Insulin": "insulin",
                       "BMI": "bmi"}
    for src, dst in zero_is_missing.items():
        v = pd.to_numeric(df[src], errors="coerce")
        n0 = int((v == 0).sum())
        v = v.replace(0, np.nan)
        out[dst] = v
        if n0:
            log.append(f"{src}: {n0} physiologically impossible zeros "
                       f"({n0/len(df):.1%}) decoded as missing")

    out["pregnancies"] = pd.to_numeric(df["Pregnancies"], errors="coerce")
    out["diabetes_pedigree"] = pd.to_numeric(df["DiabetesPedigreeFunction"],
                                             errors="coerce")
    out["target"] = pd.to_numeric(df["Outcome"], errors="coerce").astype(int)

    coverage = {"age": DIRECT, "sex": CONSTANT, "systolic_bp": PROXY,
                "bmi": DIRECT, "glucose": DIRECT, "smoking": ABSENT}
    return out, log, coverage


# ======================================================================
# KIDNEY -- UCI Chronic Kidney Disease
# ======================================================================
def clean_kidney(df: pd.DataFrame):
    log = []
    out = pd.DataFrame(index=df.index)
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    out["age"] = pd.to_numeric(df["age"], errors="coerce")
    out["sex"] = np.nan
    log.append("sex left NaN: not collected by UCI CKD")
    out["bmi"] = np.nan
    log.append("bmi left NaN: not collected by UCI CKD")
    out["smoking"] = np.nan
    log.append("smoking left NaN: not collected by UCI CKD")
    out["systolic_bp"] = np.nan
    log.append("systolic_bp left NaN: source records DIASTOLIC pressure only")
    out["diastolic_bp"] = pd.to_numeric(df["bp"], errors="coerce")

    out["glucose"] = pd.to_numeric(df["bgr"], errors="coerce")

    # String-typed numerics carrying stray tabs -- the classic CKD trap
    fixed = []
    for src, dst in [("sc", "serum_creatinine"), ("bu", "blood_urea"),
                     ("hemo", "hemoglobin"), ("sod", "sodium"),
                     ("pot", "potassium"), ("pcv", "packed_cell_volume"),
                     ("wc", "white_cell_count"), ("rc", "red_cell_count")]:
        # pandas 2.x reports these as 'object', pandas 3.x as 'str'
        was_text = not pd.api.types.is_numeric_dtype(df[src])
        out[dst] = _strip_numeric(df[src])
        if was_text:
            fixed.append(src)
    if fixed:
        log.append(f"coerced string-typed numerics to float (stray tabs/spaces): "
                   f"{', '.join(fixed)}")

    out["specific_gravity"] = pd.to_numeric(df["sg"], errors="coerce")
    out["albumin"] = pd.to_numeric(df["al"], errors="coerce")
    out["sugar"] = pd.to_numeric(df["su"], errors="coerce")

    for src, dst in [("rbc", "red_blood_cells"), ("pc", "pus_cell"),
                     ("pcc", "pus_cell_clumps"), ("ba", "bacteria"),
                     ("htn", "hypertension"), ("dm", "diabetes_mellitus"),
                     ("cad", "coronary_artery_disease"), ("appet", "appetite"),
                     ("pe", "pedal_edema"), ("ane", "anemia")]:
        out[dst] = (df[src].astype(str).str.strip().str.lower()
                    .replace({"nan": None, "": None}))

    lab = df["classification"].astype(str).str.strip().str.lower()
    n_tab = int(df["classification"].astype(str).str.contains(r"\t").sum())
    if n_tab:
        log.append(f"classification: {n_tab} labels carried a trailing tab "
                   f"('ckd\\t'); stripped before mapping")
    out["target"] = (lab == "ckd").astype(int)

    coverage = {"age": DIRECT, "sex": ABSENT, "systolic_bp": PROXY,
                "bmi": ABSENT, "glucose": DIRECT, "smoking": ABSENT}
    return out, log, coverage


# ======================================================================
# STROKE -- Kaggle
# ======================================================================
def clean_stroke(df: pd.DataFrame):
    log = []
    out = pd.DataFrame(index=df.index)

    out["age"] = pd.to_numeric(df["age"], errors="coerce")

    g = df["gender"].astype(str).str.strip().str.lower()
    n_other = int((~g.isin(["male", "female"])).sum())
    if n_other:
        log.append(f"gender: {n_other} row(s) outside male/female decoded as "
                   f"missing (the real file contains one 'Other')")
    out["sex"] = g.where(g.isin(["male", "female"]), np.nan)

    out["systolic_bp"] = np.nan
    log.append("systolic_bp left NaN: source has no BP reading, only a "
               "binary hypertension flag")

    b = pd.to_numeric(df["bmi"], errors="coerce")
    log.append(f"bmi: {int(b.isna().sum())} missing values left as NaN "
               f"for in-pipeline imputation")
    out["bmi"] = b
    out["glucose"] = pd.to_numeric(df["avg_glucose_level"], errors="coerce")

    sm = df["smoking_status"].astype(str).str.strip().str.lower()
    n_unk = int((sm == "unknown").sum())
    out["smoking"] = sm.map({"never smoked": "never",
                             "formerly smoked": "former",
                             "smokes": "current"})
    log.append(f"smoking: {n_unk} rows ({n_unk/len(df):.1%}) coded 'Unknown' "
               f"in source, decoded as missing rather than as 'never'")

    out["hypertension"] = np.where(
        pd.to_numeric(df["hypertension"], errors="coerce") == 1, "yes", "no")
    out["heart_disease"] = np.where(
        pd.to_numeric(df["heart_disease"], errors="coerce") == 1, "yes", "no")
    out["ever_married"] = df["ever_married"].astype(str).str.strip().str.lower()
    out["work_type"] = (df["work_type"].astype(str).str.strip().str.lower()
                        .str.replace("-", "_", regex=False))
    out["residence_type"] = df["Residence_type"].astype(str).str.strip().str.lower()

    out["target"] = pd.to_numeric(df["stroke"], errors="coerce").astype(int)
    log.append(f"class balance: {out['target'].mean():.2%} positive "
               f"-- accuracy is not a usable metric here")

    coverage = {"age": DIRECT, "sex": DIRECT, "systolic_bp": ABSENT,
                "bmi": DIRECT, "glucose": DIRECT, "smoking": DIRECT}
    return out, log, coverage


CLEANERS = {"heart": clean_heart, "diabetes": clean_diabetes,
            "kidney": clean_kidney, "stroke": clean_stroke}

DISPLAY = {"heart": "Heart Disease", "diabetes": "Diabetes",
           "kidney": "Chronic Kidney Disease", "stroke": "Stroke"}

SOURCE = {
    "heart": "UCI Cleveland Heart Disease",
    "diabetes": "Pima Indians Diabetes (NIDDK)",
    "kidney": "UCI Chronic Kidney Disease",
    "stroke": "Kaggle Healthcare Stroke Prediction",
}


def clean_all(verbose: bool = True) -> dict:
    PROC.mkdir(parents=True, exist_ok=True)
    report = {}

    for name, fn in CLEANERS.items():
        raw = pd.read_csv(RAW / f"{name}.csv")
        clean, log, coverage = fn(raw)

        clean.to_csv(PROC / f"{name}.csv", index=False)

        feats = [c for c in clean.columns if c != "target"]
        miss = (clean[feats].isna().mean() * 100).round(2)

        report[name] = {
            "display_name": DISPLAY[name],
            "source": SOURCE[name],
            "n_rows": int(len(clean)),
            "n_raw_columns": int(raw.shape[1]),
            "n_clean_features": len(feats),
            "positive_rate": float(clean["target"].mean()),
            "n_positive": int(clean["target"].sum()),
            "imbalance_ratio": float(
                (1 - clean["target"].mean()) / max(clean["target"].mean(), 1e-9)),
            "core_coverage": coverage,
            "cleaning_log": log,
            "missingness_pct": {k: float(v) for k, v in miss.items() if v > 0},
            "fully_missing_features": [c for c in feats if clean[c].isna().all()],
            "usable_features": [c for c in feats if not clean[c].isna().all()],
        }

        if verbose:
            print(f"\n[{name}] {SOURCE[name]}")
            print(f"  {len(clean)} rows | {len(feats)} features | "
                  f"{clean['target'].mean():.2%} positive")
            for line in log:
                print(f"    - {line}")

    (ROOT / "artifacts").mkdir(exist_ok=True)
    with open(ROOT / "artifacts" / "cleaning_report.json", "w") as f:
        json.dump(report, f, indent=2)

    if verbose:
        print("\n" + "=" * 66)
        print("CORE-FIELD COVERAGE ACROSS THE FOUR SOURCES")
        print("=" * 66)
        hdr = f"{'core field':<14}" + "".join(f"{n:<12}" for n in CLEANERS)
        print(hdr)
        print("-" * 66)
        for field in CORE:
            row = f"{field:<14}"
            for name in CLEANERS:
                row += f"{report[name]['core_coverage'][field]:<12}"
            print(row)
        print("-" * 66)
        n_direct = sum(
            1 for f in CORE
            if all(report[n]["core_coverage"][f] == DIRECT for n in CLEANERS))
        print(f"Core fields measured DIRECTLY in all four sources: {n_direct} of {len(CORE)}")
        print("=" * 66)

    return report


if __name__ == "__main__":
    clean_all()
