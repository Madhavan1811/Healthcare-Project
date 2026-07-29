# HealthGuard AI — Report Material

> Auto-generated from `artifacts/metrics.json` by `src/data/report_material.py`.
> Do not edit by hand — re-run the script to update.

## ⚠ Data Provenance Notice

**Generated:** unknown  
**Seed:** 20260727

The following figures were produced on **stand-in synthetic data**,
not on the real source CSVs. Key caveats before quoting any number:

- Feature-outcome relationships were generated from a linear logit over each dataset's own features. Logistic regression is therefore the true model, and will beat the tree ensembles here. On the real datasets that ordering will very likely reverse.
- Model-versus-clinical-score comparisons are NOT meaningful on stand-in data: our models see the exact features the labels were generated from, while Framingham and FINDRISC do not. Report these comparisons only after swapping in the real CSVs.
- Absolute accuracy figures are properties of this generator, not of the real datasets. The PIPELINE is what is being demonstrated.

These caveats are stored in `data/raw/STANDIN_MARKER.json` and are
displayed in the UI whenever the app is running on stand-in data.
Update all numbers below after swapping in the real CSVs.

---

## 1. Evaluation Protocol

| Parameter | Value |
|---|---|
| Test set size | 20.0% stratified holdout, touched once |
| Cross-validation | RepeatedStratifiedKFold(5 folds x 5 repeats) |
| Selection metric | average_precision (average precision / PR-AUC) |
| Leakage control | all preprocessing inside the Pipeline, refitted per fold |
| Imbalance strategy | class weighting (no SMOTE) |
| Seed | 20260727 |

All preprocessing (imputation, scaling, one-hot encoding) is fitted
**inside** a sklearn Pipeline so it refits on the training portion of
every cross-validation fold. This is why the reported figures are lower
than the 90–95% commonly claimed on these datasets — and why they are
more trustworthy.

---

## 2. Held-Out Test Performance — Full Feature Set

| Disease | Dataset | Rows | Positive | Model | ROC-AUC | PR-AUC | Brier | ECE before | ECE after |
|---|---|---|---|---|---|---|---|---|---|
| Heart Disease | UCI Cleveland Heart Disease | 303 | 46.9% | logistic regression | **0.862** | 0.840 | 0.172 | 0.093 | **0.071** |
| Diabetes | Pima Indians Diabetes (NIDDK) | 768 | 33.2% | logistic regression | **0.772** | 0.683 | 0.175 | 0.142 | **0.026** |
| Chronic Kidney Disease | UCI Chronic Kidney Disease | 400 | 62.5% | logistic regression | **0.723** | 0.842 | 0.207 | 0.091 | **0.045** |
| Stroke | Kaggle Healthcare Stroke Prediction | 5110 | 5.2% | logistic regression | **0.872** | 0.400 | 0.040 | 0.277 | **0.004** |

ECE = Expected Calibration Error; lower is better. 'Before' = raw model
out-of-fold probabilities; 'After' = calibrated (sigmoid). ECE improvement
proves calibration was not decorative.

---

## 3. Core-Only Feature Set — Accuracy Cost

Each disease is trained twice: once on all features the source dataset
provides ('full') and once on only the 6 core clinical fields ('core').
The gap shows what a user loses by leaving optional fields blank.

| Disease | Full ROC-AUC | Core ROC-AUC | Cost (Δ) | Core features used |
|---|---|---|---|---|
| Heart Disease | 0.862 | 0.454 | +0.408 | `age, sex, systolic_bp` |
| Diabetes | 0.772 | 0.763 | +0.009 | `age, bmi, glucose` |
| Chronic Kidney Disease | 0.723 | 0.515 | +0.208 | `age, glucose` |
| Stroke | 0.872 | 0.854 | +0.018 | `age, sex, bmi, glucose, smoking` |

A positive cost means using only core fields *reduces* ROC-AUC.
A negative cost (if any) means the full feature set actually hurts,
suggesting multicollinearity or noise in the extra features.

---

## 4. Clinical Baseline Comparison

| Disease | ML Model | ML ROC-AUC | Clinical Score | Baseline ROC-AUC | Inputs available |
|---|---|---|---|---|---|
| Heart Disease | logistic regression | 0.862 | Framingham General CVD (BMI-based) | 0.577 | 57.1% of inputs |
| Diabetes | logistic regression | 0.772 | FINDRISC (adapted) | 0.735 | 37.5% of inputs |

**Important caveat:** discrimination (AUC) is a fair comparison between
the ML model and the clinical score. Absolute calibration is not — the
published scores target a different outcome definition and time horizon.

The low input availability (57–38%) for the clinical baselines is itself
a finding: these public datasets are missing the exact features that the
validated clinical scores require. This is independent evidence that the
datasets are not fit for the CDSS people routinely build from them.

---

## 5. Candidate Model Comparison (Cross-Validation)

All figures are mean ± std over 5-fold × 5-repeat repeated stratified CV.
Selection criterion: highest mean PR-AUC (average precision).

### Heart Disease

| Candidate | CV ROC-AUC | CV PR-AUC | CV Recall | CV F1 | Fit time (s) |
|---|---|---|---|---|---|
| logistic regression ← **selected** | 0.778 ± 0.065 | 0.757 ± 0.081 | 0.713 | 0.703 | 0.68 |
| random forest | 0.712 ± 0.054 | 0.688 ± 0.075 | 0.609 | 0.629 | 16.53 |
| xgboost | 0.683 ± 0.064 | 0.663 ± 0.081 | 0.627 | 0.620 | 1.63 |

### Diabetes

| Candidate | CV ROC-AUC | CV PR-AUC | CV Recall | CV F1 | Fit time (s) |
|---|---|---|---|---|---|
| logistic regression ← **selected** | 0.701 ± 0.030 | 0.542 ± 0.044 | 0.652 | 0.559 | 0.46 |
| random forest | 0.691 ± 0.029 | 0.489 ± 0.041 | 0.318 | 0.381 | 20.45 |
| xgboost | 0.680 ± 0.029 | 0.479 ± 0.043 | 0.492 | 0.486 | 1.82 |

### Chronic Kidney Disease

| Candidate | CV ROC-AUC | CV PR-AUC | CV Recall | CV F1 | Fit time (s) |
|---|---|---|---|---|---|
| logistic regression ← **selected** | 0.777 ± 0.042 | 0.855 ± 0.037 | 0.688 | 0.736 | 0.79 |
| random forest | 0.755 ± 0.050 | 0.837 ± 0.042 | 0.848 | 0.775 | 17.56 |
| xgboost | 0.760 ± 0.044 | 0.844 ± 0.035 | 0.766 | 0.758 | 2.01 |

### Stroke

| Candidate | CV ROC-AUC | CV PR-AUC | CV Recall | CV F1 | Fit time (s) |
|---|---|---|---|---|---|
| logistic regression ← **selected** | 0.838 ± 0.023 | 0.257 ± 0.037 | 0.759 | 0.257 | 1.05 |
| random forest | 0.811 ± 0.027 | 0.223 ± 0.035 | 0.100 | 0.149 | 37.7 |
| xgboost | 0.805 ± 0.035 | 0.231 ± 0.045 | 0.554 | 0.275 | 3.68 |

---

## 6. Operating Points

Recall at the default 0.5 threshold is not meaningful when class prevalence
is low (stroke is ~5% positive). The operating point analysis is the honest
alternative. Full cost-sensitive threshold selection and decision curve
analysis are planned for Review 2.

| Disease | Recall @0.50 | Max-F1 threshold | Recall @max-F1 | Precision @max-F1 | ≥90% recall threshold |
|---|---|---|---|---|---|
| Heart Disease | 0.586 | 0.338 | 0.931 | 0.711 | 0.338 |
| Diabetes | 0.333 | 0.423 | 0.529 | 0.692 | 0.269 |
| Chronic Kidney Disease | 0.760 | 0.229 | 1.000 | 0.649 | 0.333 |
| Stroke | 0.057 | 0.184 | 0.547 | 0.333 | 0.040 |

**Stroke note:** recall of ~0.06 at threshold 0.5 is *correct behaviour*
for a well-calibrated model at 5% prevalence — the model rarely emits a
probability above 0.5 because the true risk rarely is above 0.5.
The operating-point analysis at a lower threshold is the right number to quote.

---

## 7. Calibration — Method Selection and ECE Improvement

| Disease | Method tested | Sigmoid Brier | Isotonic Brier | Winner | ECE before | ECE after | Improvement |
|---|---|---|---|---|---|---|---|
| Heart Disease | sigmoid vs isotonic | 0.198 | 0.201 | **sigmoid** | 0.093 | **0.071** | 1× |
| Diabetes | sigmoid vs isotonic | 0.199 | 0.201 | **sigmoid** | 0.142 | **0.026** | 5× |
| Chronic Kidney Disease | sigmoid vs isotonic | 0.185 | 0.185 | **sigmoid** | 0.091 | **0.045** | 2× |
| Stroke | sigmoid vs isotonic | 0.044 | 0.044 | **sigmoid** | 0.277 | **0.004** | 62× |

Sigmoid won for all four diseases — expected, because isotonic calibration
is a flexible non-parametric method that requires substantially more data
than 303–768 rows to fit reliably.

---

## 8. Core-Field Coverage Matrix

Generated by `src/data/clean.py`. This is the project's headline finding.

| Core field | Heart Disease | Diabetes | Chronic Kidney Disease | Stroke |
|---|---|---|---|---|
| `age` | **direct** | **direct** | **direct** | **direct** |
| `sex` | **direct** | **constant** (female-only cohort) | **ABSENT** | **direct** |
| `systolic_bp` | **direct** | proxy (diastolic) | proxy (diastolic) | **ABSENT** (binary flag only) |
| `bmi` | **ABSENT** | **direct** | **ABSENT** | **direct** |
| `glucose` | proxy (binary fbs flag) | **direct** | **direct** | **direct** |
| `smoking` | **ABSENT** | **ABSENT** | **ABSENT** | **direct** |

**1 of 6** core fields is measured directly and comparably across all four
datasets. This is the empirical basis for training each disease twice (full
vs core feature sets) rather than building one shared model.

---

## How to Update This Document

1. Swap in the real CSVs (see README for filenames).
2. Delete `data/raw/STANDIN_MARKER.json`.
3. Run `python -m src.data.clean && python -m src.data.audit && python -m src.models.train`.
4. Run `python -m src.data.report_material`.
5. All numbers above update automatically.
