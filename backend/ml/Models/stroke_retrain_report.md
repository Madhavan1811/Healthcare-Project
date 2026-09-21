# HealthTwin AI — Stroke Model Retrain v2

## Target
`CVDSTRK3`: 1 = Yes, ever told stroke; 2 = No

## Data
CDC BRFSS 2025 `LLCP2025.XPT`.

- Valid target rows: 354,950
- Positives used: 16,353
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
- `CHCKDNY2` → `kidney_disease`
- `ADDEPEV3` → `depression`
- `DIFFWALK` → `difficulty_walking`
- `GENHLTH` → `general_health`
- `PHYSHLTH` → `physical_unwell_days`

## Model
XGBoost, tuned with 25-iteration 3-fold randomized search. Calibration was selected by train out-of-fold Brier score: **isotonic**.

Raw base XGBoost is saved separately for SHAP.

## Validation
- ROC-AUC: 0.8083
- PR-AUC: 0.5049
- Brier: 0.1336
- ECE: 0.0061
- F1 threshold: 0.260
- F1 at threshold: 0.5398

## Test
- ROC-AUC: 0.8077 (95% bootstrap CI 0.7989–0.8162)
- PR-AUC: 0.5089
- Brier: 0.1334
- ECE: 0.0080
- Precision @ F1 threshold: 0.4262
- Recall @ F1 threshold: 0.7220
- F1 @ F1 threshold: 0.5360

## Probability correction
The training sample is enriched for positives, so the raw calibrated probability is corrected to the BRFSS valid-row prevalence using a log-odds prior shift.

- Training prevalence: 21.4175%
- BRFSS valid-row prevalence: 4.6071%
- Logit shift: -1.730457
- Corrected F1 threshold: 0.060

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
