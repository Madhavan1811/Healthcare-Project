"""
Generate stand-in raw datasets for HealthGuard AI.

WHY THIS EXISTS
---------------
The four real datasets cannot be downloaded inside this build
environment. These stand-ins reproduce, for each source:

  * the EXACT real column names and encodings (including the numeric
    codes in UCI Heart and the yes/no strings in UCI CKD)
  * matching row counts and class prevalences
  * the SAME KNOWN DEFECTS ('?' markers, zeros-as-missing, string-typed
    numerics with stray tabs, missing BMI, severe class imbalance)
  * clinically-plausible feature -> outcome relationships, so the models
    learn real structure instead of noise

CRITICAL DESIGN NOTE
--------------------
These files deliberately do NOT contain columns the real datasets lack.
UCI Heart has no BMI and no smoking status. UCI CKD has no sex and no
BMI. Kaggle Stroke has no blood pressure reading, only a hypertension
flag. Pima records DIASTOLIC blood pressure and contains female
patients only.

That is the real feature-overlap problem, and src/data/clean.py
measures it rather than hiding it.

TO SWAP IN THE REAL DATA
------------------------
Drop the real CSVs into data/raw/ as heart.csv, diabetes.csv,
kidney.csv, stroke.csv, then run: python -m src.models.train
Do NOT re-run this script afterwards -- it would overwrite them.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
SEED = 20260727


def _logistic(x):
    return 1.0 / (1.0 + np.exp(-x))


def _fit_intercept(z, target_prev):
    lo, hi = -25.0, 25.0
    for _ in range(90):
        mid = (lo + hi) / 2
        if _logistic(z + mid).mean() < target_prev:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _draw(z, rng):
    return (rng.random(len(z)) < _logistic(z)).astype(int)


# ----------------------------------------------------------------------
# 1. HEART -- UCI Cleveland processed.cleveland.data
#    303 rows, 13 predictors + num. ~46% positive (num > 0).
#    NO bmi. NO smoking. Glucose only as binary fbs (>120 mg/dL).
# ----------------------------------------------------------------------
def make_heart(rng):
    n = 303
    age = np.clip(rng.normal(54.4, 9.0, n), 29, 77).round(0)
    sex = (rng.random(n) < 0.68).astype(int)                    # 1 = male
    cp = rng.choice([1, 2, 3, 4], n, p=[0.076, 0.165, 0.284, 0.475])
    trestbps = np.clip(rng.normal(131.6, 17.5, n), 94, 200).round(0)
    chol = np.clip(rng.normal(246.7, 51.8, n), 126, 564).round(0)
    fbs = (rng.random(n) < 0.148).astype(int)
    restecg = rng.choice([0, 1, 2], n, p=[0.498, 0.013, 0.489])
    thalach = np.clip(rng.normal(149.6, 22.9, n), 71, 202).round(0)
    exang = (rng.random(n) < 0.327).astype(int)
    oldpeak = np.clip(rng.gamma(1.6, 0.66, n), 0, 6.2).round(1)
    slope = rng.choice([1, 2, 3], n, p=[0.467, 0.462, 0.071])
    ca = rng.choice([0, 1, 2, 3], n, p=[0.59, 0.22, 0.13, 0.06])
    thal = rng.choice([3, 6, 7], n, p=[0.55, 0.06, 0.39])

    z = (0.042 * (age - 54.4)
         + 0.78 * sex
         + 0.55 * (cp == 4) - 0.45 * (cp == 1)
         + 0.017 * (trestbps - 131.6)
         + 0.0050 * (chol - 246.7)
         + 0.22 * fbs
         + 0.32 * (restecg == 2)
         - 0.024 * (thalach - 149.6)
         + 0.82 * exang
         + 0.45 * oldpeak
         + 0.40 * (slope == 2)
         + 0.62 * ca
         + 0.85 * (thal == 7)
         + rng.normal(0, 0.60, n))
    num = _draw(z + _fit_intercept(z, 0.459), rng)

    df = pd.DataFrame(dict(
        age=age.astype(int), sex=sex, cp=cp, trestbps=trestbps.astype(int),
        chol=chol.astype(int), fbs=fbs, restecg=restecg,
        thalach=thalach.astype(int), exang=exang, oldpeak=oldpeak,
        slope=slope, ca=ca, thal=thal, num=num))

    # DEFECT: UCI Cleveland carries 4 '?' in ca and 2 in thal
    df["ca"] = df["ca"].astype(object)
    df.loc[rng.choice(n, 4, replace=False), "ca"] = "?"
    df["thal"] = df["thal"].astype(object)
    df.loc[rng.choice(n, 2, replace=False), "thal"] = "?"
    return df


# ----------------------------------------------------------------------
# 2. DIABETES -- Pima Indians. 768 rows, 34.9% positive.
#    FEMALE ONLY. Age >= 21. BloodPressure is DIASTOLIC.
#    NO sex column. NO smoking. Zeros encode missing in 5 columns.
# ----------------------------------------------------------------------
def make_diabetes(rng):
    n = 768
    age = np.clip(rng.gamma(6.4, 5.2, n) + 21, 21, 81).round(0)
    preg = np.clip(rng.poisson(3.3, n), 0, 17)
    glucose = np.clip(rng.normal(121, 31, n), 44, 199).round(0)
    dbp = np.clip(rng.normal(72.4, 12.4, n), 40, 122).round(0)
    skin = np.clip(rng.normal(29.2, 10.5, n), 7, 99).round(0)
    insulin = np.clip(rng.gamma(2.0, 78, n), 14, 846).round(0)
    bmi = np.clip(rng.normal(32.5, 6.9, n), 18.2, 67.1).round(1)
    dpf = np.clip(rng.gamma(2.0, 0.24, n), 0.078, 2.42).round(3)

    z = (0.0300 * (glucose - 121)
         + 0.060 * (bmi - 32.5)
         + 0.031 * (age - 33)
         + 0.055 * preg
         + 0.0130 * (dbp - 72.4)
         + 0.0011 * (insulin - 155)
         + 0.65 * dpf
         + 0.012 * (skin - 29.2)
         + rng.normal(0, 0.62, n))
    outcome = _draw(z + _fit_intercept(z, 0.349), rng)

    df = pd.DataFrame(dict(
        Pregnancies=preg, Glucose=glucose.astype(int),
        BloodPressure=dbp.astype(int), SkinThickness=skin.astype(int),
        Insulin=insulin.astype(int), BMI=bmi,
        DiabetesPedigreeFunction=dpf, Age=age.astype(int), Outcome=outcome))

    for col, frac in [("Glucose", 0.0065), ("BloodPressure", 0.0456),
                      ("SkinThickness", 0.2955), ("Insulin", 0.4870),
                      ("BMI", 0.0143)]:
        df.loc[rng.choice(n, int(round(frac * n)), replace=False), col] = 0
    return df


# ----------------------------------------------------------------------
# 3. KIDNEY -- UCI Chronic Kidney Disease. 400 rows, 62.5% positive.
#    NO sex. NO BMI. NO smoking. bp is DIASTOLIC.
# ----------------------------------------------------------------------
def make_kidney(rng):
    n = 400
    age = np.clip(rng.normal(51.5, 17.2, n), 18, 90).round(0)
    bp = np.clip(rng.normal(76.5, 13.7, n), 50, 180).round(0)
    sg = rng.choice([1.005, 1.010, 1.015, 1.020, 1.025], n,
                    p=[0.12, 0.21, 0.25, 0.31, 0.11])
    al = rng.choice([0, 1, 2, 3, 4, 5], n, p=[0.51, 0.11, 0.11, 0.12, 0.11, 0.04])
    su = rng.choice([0, 1, 2, 3, 4, 5], n, p=[0.79, 0.05, 0.05, 0.05, 0.04, 0.02])
    rbc = rng.choice(["normal", "abnormal"], n, p=[0.81, 0.19])
    pc = rng.choice(["normal", "abnormal"], n, p=[0.78, 0.22])
    pcc = rng.choice(["notpresent", "present"], n, p=[0.89, 0.11])
    ba = rng.choice(["notpresent", "present"], n, p=[0.94, 0.06])
    bgr = np.clip(rng.normal(148, 79, n), 22, 490).round(0)
    bu = np.clip(rng.gamma(2.4, 24, n), 5, 250).round(0)
    sc = np.clip(rng.gamma(2.1, 1.35, n), 0.4, 15.0).round(1)
    sod = np.clip(rng.normal(137.5, 10.4, n), 104, 163).round(0)
    pot = np.clip(rng.normal(4.6, 3.2, n), 2.5, 47).round(1)
    hemo = np.clip(rng.normal(12.5, 2.9, n), 3.1, 17.8).round(1)
    pcv = np.clip(hemo * 3 + rng.normal(0, 2.0, n), 9, 54).round(0)
    wc = np.clip(rng.normal(8400, 2900, n), 2200, 26400).round(-2)
    rc = np.clip(rng.normal(4.7, 1.0, n), 2.1, 8.0).round(1)
    htn = rng.choice(["yes", "no"], n, p=[0.37, 0.63])
    dm = rng.choice(["yes", "no"], n, p=[0.34, 0.66])
    cad = rng.choice(["yes", "no"], n, p=[0.09, 0.91])
    appet = rng.choice(["good", "poor"], n, p=[0.79, 0.21])
    pe = rng.choice(["yes", "no"], n, p=[0.19, 0.81])
    ane = rng.choice(["yes", "no"], n, p=[0.15, 0.85])

    z = (1.05 * np.log(sc / 1.0)
         + 0.011 * (bu - 57)
         - 0.34 * (hemo - 12.5)
         + 0.52 * al
         - 26.0 * (sg - 1.017)
         + 0.020 * (age - 51.5)
         + 0.010 * (bp - 76.5)
         + 0.0030 * (bgr - 148)
         + 0.60 * (htn == "yes") + 0.55 * (dm == "yes")
         + 0.45 * (ane == "yes") + 0.40 * (pe == "yes")
         + 0.35 * (rbc == "abnormal")
         + rng.normal(0, 0.70, n))
    ckd = _draw(z + _fit_intercept(z, 0.625), rng)

    df = pd.DataFrame(dict(
        age=age.astype(int), bp=bp.astype(int), sg=sg, al=al, su=su,
        rbc=rbc, pc=pc, pcc=pcc, ba=ba, bgr=bgr.astype(int),
        bu=bu.astype(int), sc=sc, sod=sod.astype(int), pot=pot, hemo=hemo,
        pcv=pcv.astype(int), wc=wc.astype(int), rc=rc, htn=htn, dm=dm,
        cad=cad, appet=appet, pe=pe, ane=ane,
        classification=np.where(ckd == 1, "ckd", "notckd")))

    # DEFECT 1: numerics stored as strings carrying stray tabs/spaces
    for col in ["pcv", "wc", "rc"]:
        df[col] = df[col].astype(str)
        idx = rng.choice(n, int(0.18 * n), replace=False)
        df.loc[idx, col] = df.loc[idx, col] + rng.choice(["\t", " ", "  "], len(idx))

    # DEFECT 2: 'ckd\t' label variants, present in the real file
    idx = rng.choice(n, 12, replace=False)
    df.loc[idx, "classification"] = df.loc[idx, "classification"].astype(str) + "\t"

    # DEFECT 3: heavy, uneven missingness.
    # UCI CKD marks missing numerics with '?', which forces the whole
    # column to object dtype -- the single most common parsing trap in
    # this dataset. Reproduced faithfully here.
    for col, frac in [("sc", 0.043), ("bu", 0.048), ("hemo", 0.130),
                      ("sg", 0.118), ("al", 0.115), ("bgr", 0.110),
                      ("rbc", 0.380), ("sod", 0.218), ("pot", 0.220),
                      ("pcv", 0.180), ("wc", 0.263), ("rc", 0.328)]:
        idx = rng.choice(n, int(round(frac * n)), replace=False)
        df[col] = df[col].astype(object)
        df.loc[idx, col] = "?"
    return df


# ----------------------------------------------------------------------
# 4. STROKE -- Kaggle healthcare-dataset-stroke-data.
#    5110 rows, 4.87% positive. NO blood pressure reading.
#    201 missing BMI. One gender='Other'. 30% 'Unknown' smoking.
# ----------------------------------------------------------------------
def make_stroke(rng):
    n = 5110
    age = np.clip(rng.gamma(4.2, 10.6, n), 18, 82).round(0)
    gender = rng.choice(["Female", "Male"], n, p=[0.586, 0.414])
    hyper = (rng.random(n) < 0.0975).astype(int)
    heart = (rng.random(n) < 0.054).astype(int)
    married = rng.choice(["Yes", "No"], n, p=[0.656, 0.344])
    work = rng.choice(["Private", "Self-employed", "Govt_job", "children",
                       "Never_worked"], n, p=[0.572, 0.160, 0.128, 0.135, 0.005])
    residence = rng.choice(["Urban", "Rural"], n, p=[0.508, 0.492])
    glucose = np.clip(rng.gamma(3.0, 33, n) + 55, 55, 272).round(2)
    bmi = np.clip(rng.normal(28.9, 7.7, n), 10.3, 97.6).round(1)
    smoke = rng.choice(["never smoked", "formerly smoked", "smokes", "Unknown"],
                       n, p=[0.370, 0.173, 0.156, 0.301])

    z = (0.074 * (age - 43)
         + 1.05 * hyper + 1.02 * heart
         + 0.0055 * (glucose - 106)
         + 0.021 * (bmi - 28.9)
         + 0.42 * (smoke == "smokes") + 0.24 * (smoke == "formerly smoked")
         + 0.18 * (gender == "Male") + 0.20 * (married == "Yes")
         + rng.normal(0, 0.50, n))
    stroke = _draw(z + _fit_intercept(z, 0.0487), rng)

    df = pd.DataFrame(dict(
        id=rng.choice(np.arange(1, 80000), n, replace=False),
        gender=gender, age=age.astype(int), hypertension=hyper,
        heart_disease=heart, ever_married=married, work_type=work,
        Residence_type=residence, avg_glucose_level=glucose, bmi=bmi,
        smoking_status=smoke, stroke=stroke))

    df.loc[rng.choice(n, 201, replace=False), "bmi"] = np.nan
    df.loc[rng.integers(0, n), "gender"] = "Other"
    return df


def main():
    rng = np.random.default_rng(SEED)
    RAW.mkdir(parents=True, exist_ok=True)
    builders = {"heart": make_heart, "diabetes": make_diabetes,
                "kidney": make_kidney, "stroke": make_stroke}
    targets = {"heart": "num", "diabetes": "Outcome",
               "kidney": "classification", "stroke": "stroke"}

    print("Generating stand-in raw datasets\n" + "-" * 62)
    for name, fn in builders.items():
        df = fn(rng)
        df.to_csv(RAW / f"{name}.csv", index=False)
        t = df[targets[name]]
        prev = (t.astype(str).str.strip().eq("ckd").mean() if name == "kidney"
                else pd.to_numeric(t).gt(0).mean())
        print(f"  {name:9s} {len(df):>5d} rows x {df.shape[1]:>2d} cols "
              f"| positive {prev:6.2%} -> {name}.csv")
    # Provenance marker. train.py reads this and stamps metrics.json, so
    # no chart or table can ever be mistaken for a result on real data.
    # Deleting the four CSVs and dropping in the real ones removes it.
    import json as _json
    (RAW / "STANDIN_MARKER.json").write_text(_json.dumps({
        "is_standin": True,
        "seed": SEED,
        "generated_by": "src/data/generate_standins.py",
        "caveats": [
            "Feature-outcome relationships were generated from a linear "
            "logit over each dataset's own features. Logistic regression is "
            "therefore the true model, and will beat the tree ensembles here. "
            "On the real datasets that ordering will very likely reverse.",
            "Model-versus-clinical-score comparisons are NOT meaningful on "
            "stand-in data: our models see the exact features the labels were "
            "generated from, while Framingham and FINDRISC do not. Report "
            "these comparisons only after swapping in the real CSVs.",
            "Absolute accuracy figures are properties of this generator, not "
            "of the real datasets. The PIPELINE is what is being demonstrated.",
        ],
    }, indent=2))

    print("-" * 62)
    print("STAND-IN DATA. Swap in the real CSVs (same filenames), delete\n"
          "data/raw/STANDIN_MARKER.json, then re-run training.")


if __name__ == "__main__":
    main()
