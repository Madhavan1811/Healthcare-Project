# HealthTwin AI — Kidney Disease Model Retrain v2

## Target
`CHCKDNY2`: 1 = ever told kidney disease (not including kidney stones, bladder infection or incontinence); 2 = No

## Data
CDC BRFSS 2025 `LLCP2025.XPT`.

- Valid target rows: 354,677
- Positives used: 19,215
- Random negatives used: 60,000
- Split: 70/15/15, stratified, seed 42

## Features
- `_AGE80` → `age`
- `SEXVAR` → `sex_male`
- `_BMI5` → `bmi`
- `_SMOKER3` → `smoking_status`
- `_TOTINDA` → `physically_active`
- `SLEPTIM1` → `sleep_hours`
- `_RFDRHV9` → `heavy_drinker`
- `_RFHYPE6` → `high_bp`
- `_RFCHOL3` → `high_chol`
- `DIABETE4` → `diabetes_status`
- `CHCCOPD3` → `copd`
- `ADDEPEV3` → `depression`
- `DIFFWALK` → `difficulty_walking`
- `GENHLTH` → `general_health`
- `PHYSHLTH` → `physical_unwell_days`

## Model
XGBoost, tuned with 25-iteration 3-fold randomized search. Calibration was selected by train out-of-fold Brier score: **isotonic**.

Raw base XGBoost is saved separately for SHAP.

## Validation
- ROC-AUC: 0.8148
- PR-AUC: 0.5684
- Brier: 0.1398
- ECE: 0.0082
- F1 threshold: 0.290
- F1 at threshold: 0.5839

## Test
- ROC-AUC: 0.8183 (95% bootstrap CI 0.8096–0.8269)
- PR-AUC: 0.5686
- Brier: 0.1389
- ECE: 0.0063
- Precision @ F1 threshold: 0.4903
- Recall @ F1 threshold: 0.7329
- F1 @ F1 threshold: 0.5875

## Probability correction
The training sample is enriched for positives, so the raw calibrated probability is corrected to the BRFSS valid-row prevalence using a log-odds prior shift.

- Training prevalence: 24.2561%
- BRFSS valid-row prevalence: 5.4176%
- Logit shift: -1.721127
- Corrected F1 threshold: 0.070

## Risk display bands
These are **product display bands**, not validated clinical decision thresholds.

{
  "Low": "0-29",
  "Moderate": "30-49",
  "Elevated": "50-69",
  "High": "70-100"
}

## Important scope
This model predicts the probability that the respondent has **ever reported being told they had kidney disease** in BRFSS. It is not a clinical diagnosis or prospective clinical risk score.
