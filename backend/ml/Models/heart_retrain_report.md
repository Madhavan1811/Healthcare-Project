# Heart model retrain v2 — CDC BRFSS 2025

**Data:** all 31,687 valid `_MICHD=1` rows + 60,000 randomly sampled `_MICHD=2` rows
(91,687 rows, 34.56% positive). Stratified 70/15/15 split
(train 64,180 / val 13,753 / test 13,754) done before the preprocessor was fit.
Rows with a blank/invalid feature were kept and imputed (train-fit imputers) rather than dropped; complete-case dropping would have
kept only 24,455 of 31,687 positives.

**Model:** XGBoost, same search space as `train_heart.py`; best params `{"subsample": 0.7, "reg_lambda": 3, "n_estimators": 400, "min_child_weight": 3, "max_depth": 4, "learning_rate": 0.02, "gamma": 0, "colsample_bytree": 1.0}`; `scale_pos_weight=1.893`;
calibration = **isotonic** (OOF Brier: sigmoid 0.15351, isotonic 0.15297).
F1 threshold 0.375 chosen on the validation split.

## New model, as sampled (34.6% prevalence)
| Split | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1 | Brier | ECE |
|---|---|---|---|---|---|---|---|---|
| Validation @ 0.375 | 0.8420 | 0.7189 | 0.7665 | 0.6336 | 0.7690 | 0.6947 | 0.1520 | 0.0075 |
| Test @ 0.375 | 0.8377 | 0.7053 | 0.7555 | 0.6170 | 0.7711 | 0.6855 | 0.1547 | 0.0112 |
| Test @ 0.50 | 0.8377 | 0.7053 | 0.7625 | 0.6656 | 0.6282 | 0.6464 | 0.1547 | 0.0112 |

Test ROC-AUC 95% bootstrap CI: 0.831–0.844.
Uncalibrated → calibrated on test: Brier 0.1660 → 0.1547, ECE 0.0983 → 0.0112.

## New vs old, same held-out rows (13,446 test rows; 308 removed because the old model trained on them)
### Population-weighted (negatives re-weighted to real-world ~9.0% prevalence; new probabilities prior-shift corrected)
Thresholds: each model at its own F1-optimal threshold (new 0.215 chosen on validation, old 0.215).

| Model | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1 | Brier | ECE |
|---|---|---|---|---|---|---|---|---|
| New (prior-corrected) | 0.8372 | 0.3383 | 0.8563 | 0.3101 | 0.4941 | 0.3810 | 0.0690 | 0.0054 |
| Old | 0.8318 | 0.3320 | 0.8538 | 0.3072 | 0.5038 | 0.3817 | 0.0695 | 0.0081 |

### As sampled (34.4% prevalence, raw probabilities)
The old model's probabilities are calibrated to ~10% prevalence, so its Brier/ECE/threshold metrics are penalised here; ROC-AUC and PR-AUC are directly comparable.

| Model | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1 | Brier | ECE |
|---|---|---|---|---|---|---|---|---|
| New | 0.8372 | 0.7044 | 0.7549 | 0.6155 | 0.7689 | 0.6837 | 0.1548 | 0.0120 |
| Old | 0.8318 | 0.6986 | 0.7558 | 0.7031 | 0.5038 | 0.5870 | 0.2230 | 0.2157 |

## Probability scale warning
`predict_proba` from the new model is calibrated to the 34.6% training prevalence. At real-world prevalence (9.0%) apply
`logit(p') = logit(p) + (-1.6754)`.

Share of population per risk band (0-29 Low, 30-49 Moderate, 50-69 Elevated, 70-100 High):

| | Low | Moderate | Elevated | High |
|---|---|---|---|---|
| new_uncorrected | 62.3% | 16.6% | 14.6% | 6.6% |
| new_prior_corrected | 93.2% | 5.4% | 1.1% | 0.2% |
| old | 91.8% | 7.9% | 0.3% | 0.0% |

Demo patients (probability):

| Patient | New raw | New corrected | Old |
|---|---|---|---|
| healthy 30F | 6.3% | 1.2% | 1.1% |
| 55M mixed risk | 40.9% | 11.5% | 7.0% |
| 76M many conditions | 96.6% | 84.2% | 52.6% |
