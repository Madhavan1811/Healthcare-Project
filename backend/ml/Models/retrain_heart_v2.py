"""
HealthTwin AI - Heart Disease model, RETRAIN v2 (CDC BRFSS 2025)
=================================================================

Re-uses the pipeline in train_heart.py unchanged (same features, same value
recoding, same ColumnTransformer preprocessor, same XGBoost search space /
scale_pos_weight, same sigmoid-vs-isotonic calibration choice) but changes the
DATA and the SPLIT:

  * ALL valid _MICHD = 1 rows  +  N_NEG randomly sampled valid _MICHD = 2 rows
  * rows with an invalid/blank FEATURE are NOT dropped (complete-case dropping
    would throw away ~23% of the positives); invalid codes are still turned into
    NaN by the same recoding and filled by the preprocessor's imputers, which
    are fit on the TRAIN split only.
  * stratified 70 / 15 / 15 train / validation / test split, done BEFORE the
    preprocessor is fit or anything else is learned.
  * validation split is used to choose the F1 decision threshold.
  * the old model is scored on the same held-out rows (excluding any row the
    old model was trained on) for a like-for-like comparison.

Usage:   python retrain_heart_v2.py [path/to/LLCP2025XPT.zip]
         (needs train_heart.py in the same folder, plus the previous model saved as
          old_heart_model.pkl / old_heart_preprocessor.pkl / old_heart_metadata.json for the comparison)

Outputs: models/heart_model.pkl, models/heart_preprocessor.pkl,
         models/heart_metadata.json
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss, confusion_matrix,
    f1_score, log_loss, precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import (
    RandomizedSearchCV, StratifiedKFold, cross_val_predict, train_test_split,
)
from xgboost import XGBClassifier

import train_heart as th

HERE = Path(__file__).resolve().parent
DATA_ZIP = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/mnt/user-data/uploads/LLCP2025XPT.zip")
RAW_CACHE = HERE / "raw17.pkl"
OLD_MODEL = HERE / "old_heart_model.pkl"
OLD_PRE = HERE / "old_heart_preprocessor.pkl"
OLD_META = HERE / "old_heart_metadata.json"

SEED = th.RANDOM_STATE          # 42, same as the original script
N_NEG = 60_000
FEATURES = th.FEATURES


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------- #
# Cleaning: identical recoding to th.clean_brfss, minus the complete-case drop
# --------------------------------------------------------------------------- #
def clean_keep_missing(raw: pd.DataFrame) -> pd.DataFrame:
    d = pd.DataFrame(index=raw.index)
    d["heart_disease"] = raw["_MICHD"].map({1.0: 1, 2.0: 0})

    age = raw["_AGE80"]
    d["age"] = age.where(age.between(18, 80))
    bmi = raw["_BMI5"] / 100.0
    d["bmi"] = bmi.where(bmi.between(12, 65))
    sleep = raw["SLEPTIM1"].where(raw["SLEPTIM1"].between(1, 24))
    d["sleep_hours"] = sleep.clip(3, 14)
    phys = raw["PHYSHLTH"].replace({88: 0})
    d["physical_unwell_days"] = phys.where(phys.between(0, 30))

    d["sex_male"] = raw["SEXVAR"].map({1.0: 1, 2.0: 0})
    d["diabetes_status"] = raw["DIABETE4"].map({3.0: 0, 2.0: 0, 4.0: 1, 1.0: 2})
    d["high_bp"] = raw["_RFHYPE6"].map({1.0: 0, 2.0: 1})
    d["high_chol"] = raw["_RFCHOL3"].map({1.0: 0, 2.0: 1})
    d["physically_active"] = raw["_TOTINDA"].map({1.0: 1, 2.0: 0})
    d["general_health"] = raw["GENHLTH"].where(raw["GENHLTH"].between(1, 5))
    d["heavy_drinker"] = raw["_RFDRHV9"].map({1.0: 0, 2.0: 1})
    for cdc, name in [("CHCCOPD3", "copd"), ("CHCKDNY2", "kidney_disease"),
                      ("ADDEPEV3", "depression"), ("DIFFWALK", "difficulty_walking")]:
        d[name] = raw[cdc].map({1.0: 1, 2.0: 0})
    d["smoking_status"] = raw["_SMOKER3"].where(raw["_SMOKER3"].isin(th.SMOKING_LEVELS))

    d = d[d["heart_disease"].notna()].copy()
    d["heart_disease"] = d["heart_disease"].astype(int)
    return d


# --------------------------------------------------------------------------- #
# Metrics helpers (optionally sample-weighted)
# --------------------------------------------------------------------------- #
def w_ece(y, p, w, n_bins=10):
    """Equal-total-weight-bin ECE (weighted analogue of th.expected_calibration_error)."""
    y, p, w = np.asarray(y, float), np.asarray(p, float), np.asarray(w, float)
    o = np.argsort(p)
    y, p, w = y[o], p[o], w[o]
    cw = np.cumsum(w) / w.sum()
    bins = np.clip(np.ceil(cw * n_bins).astype(int) - 1, 0, n_bins - 1)
    ece = 0.0
    for b in range(n_bins):
        m = bins == b
        if m.any():
            ece += w[m].sum() / w.sum() * abs(np.average(y[m], weights=w[m]) - np.average(p[m], weights=w[m]))
    return float(ece)


def w_reliability(y, p, w, edges=(0, .05, .10, .20, .30, .50, 1.0001)):
    y, p, w = np.asarray(y, float), np.asarray(p, float), np.asarray(w, float)
    rows = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi)
        if m.any():
            rows.append({"predicted_range": f"{lo:.0%}-{min(hi, 1):.0%}",
                         "weighted_share_of_population": float(w[m].sum() / w.sum()),
                         "mean_predicted": float(np.average(p[m], weights=w[m])),
                         "observed_rate": float(np.average(y[m], weights=w[m]))})
    return rows


def rank_and_calibration(y, p, w=None) -> dict:
    y, p = np.asarray(y), np.asarray(p)
    return {
        "roc_auc": float(roc_auc_score(y, p, sample_weight=w)),
        "pr_auc": float(average_precision_score(y, p, sample_weight=w)),
        "brier": float(brier_score_loss(y, p, sample_weight=w)),
        "log_loss": float(log_loss(y, np.clip(p, 1e-6, 1 - 1e-6), sample_weight=w)),
        "ece": float(th.expected_calibration_error(y, p) if w is None else w_ece(y, p, w)),
        "mean_predicted_prob": float(np.average(p, weights=w)),
        "observed_positive_rate": float(np.average(y, weights=w)),
    }


def threshold_block(y, p, thr, w=None) -> dict:
    y, p = np.asarray(y), np.asarray(p)
    pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1], sample_weight=w).ravel()
    return {
        "threshold": round(float(thr), 4),
        "accuracy": float(accuracy_score(y, pred, sample_weight=w)),
        "precision": float(precision_score(y, pred, zero_division=0, sample_weight=w)),
        "recall": float(recall_score(y, pred, zero_division=0, sample_weight=w)),
        "f1": float(f1_score(y, pred, zero_division=0, sample_weight=w)),
        "confusion_matrix": {"tn": float(tn), "fp": float(fp), "fn": float(fn), "tp": float(tp)},
    }


def best_thr(y, p, w=None) -> float:
    grid = np.arange(0.05, 0.60, 0.005)
    sc = [f1_score(y, (p >= t).astype(int), zero_division=0, sample_weight=w) for t in grid]
    return float(grid[int(np.argmax(sc))])


def shift_prior(p, pi_from: float, pi_to: float):
    """Bayes prior-shift correction of probabilities trained at prevalence pi_from -> pi_to."""
    p = np.clip(np.asarray(p, float), 1e-9, 1 - 1e-9)
    delta = np.log(pi_to / (1 - pi_to)) - np.log(pi_from / (1 - pi_from))
    return 1.0 / (1.0 + np.exp(-(np.log(p / (1 - p)) + delta)))


# --------------------------------------------------------------------------- #
def main():
    t0 = time.time()
    log("=" * 72)
    log("HealthTwin AI - Heart model RETRAIN v2 (BRFSS 2025, all positives + sampled negatives)")
    log("=" * 72)

    # ---- 1. load ----
    if RAW_CACHE.exists():
        raw = pd.read_pickle(RAW_CACHE)
    else:
        log("[1] loading raw XPT (17 needed columns) ...")
        raw = th.load_brfss(DATA_ZIP)
        raw.to_pickle(RAW_CACHE)
    log(f"[1] raw rows: {len(raw):,}")

    # ---- 2. clean (+ prove the recoding matches the original script) ----
    km = clean_keep_missing(raw)
    cc, cc_stats = th.clean_brfss(raw)
    cols = FEATURES + ["heart_disease"]
    complete_mask = km[FEATURES].notna().all(axis=1)
    assert set(km.index[complete_mask]) == set(cc.index), "complete-case row sets differ"
    assert np.array_equal(km.loc[cc.index, cols].to_numpy(float), cc[cols].to_numpy(float)), \
        "recoded values differ from train_heart.py"
    log("[2] recoding verified identical to train_heart.py on all complete-case rows")

    n_pos_all = int((km.heart_disease == 1).sum())
    n_neg_all = int((km.heart_disease == 0).sum())
    log(f"[2] valid target rows: positives {n_pos_all:,} | negatives {n_neg_all:,}")
    log(f"[2] complete-case would keep only {int(cc.heart_disease.sum()):,} positives "
        f"({int(cc.heart_disease.sum())/n_pos_all:.1%}); using all {n_pos_all:,} instead")
    miss_pos = km.loc[km.heart_disease == 1, FEATURES].isna().mean().round(4).to_dict()
    log(f"[2] missing rate among positives: {miss_pos}")

    # ---- reproduce the OLD model's training rows (for a leak-free comparison) ----
    samp = cc.sample(n=10_000, random_state=SEED)
    old_pos_idx = np.arange(10_000)
    o_tr, o_te = train_test_split(old_pos_idx, test_size=0.20, stratify=samp.heart_disease.to_numpy(),
                                  random_state=SEED)
    old_train_raw_idx = set(samp.index[o_tr])
    old_meta = json.loads(OLD_META.read_text())
    assert int(samp.heart_disease.sum()) == old_meta["class_distribution_all"]["positive_1"]
    assert int(samp.heart_disease.iloc[o_tr].sum()) == old_meta["class_distribution_train"]["1"]
    old_model = joblib.load(OLD_MODEL)
    old_pre = joblib.load(OLD_PRE)
    ot = samp.iloc[o_te]
    p_old_own = old_model.predict_proba(old_pre.transform(ot[FEATURES]))[:, 1]
    auc_repro = roc_auc_score(ot.heart_disease, p_old_own)
    log(f"[2] old-model row reproduction: own-test ROC-AUC {auc_repro:.10f} "
        f"vs stored {old_meta['metrics_test']['roc_auc']:.10f}")
    assert abs(auc_repro - old_meta["metrics_test"]["roc_auc"]) < 1e-9, "could not reproduce old split"

    # ---- 3. sample ----
    pos = km[km.heart_disease == 1]
    neg = km[km.heart_disease == 0].sample(n=N_NEG, random_state=SEED)
    data = pd.concat([pos, neg]).sample(frac=1.0, random_state=SEED)
    X, y = data[FEATURES], data["heart_disease"]
    log(f"[3] sampled dataset: {len(data):,} rows | pos {int(y.sum()):,} | neg {int((y==0).sum()):,} "
        f"| prevalence {y.mean():.2%}")

    # ---- 4. split BEFORE any fitting ----
    i_tr, i_tmp = train_test_split(data.index, test_size=0.30, stratify=y, random_state=SEED)
    i_va, i_te = train_test_split(i_tmp, test_size=0.50, stratify=y.loc[i_tmp], random_state=SEED)
    X_tr, y_tr = X.loc[i_tr], y.loc[i_tr]
    X_va, y_va = X.loc[i_va], y.loc[i_va]
    X_te, y_te = X.loc[i_te], y.loc[i_te]
    for n, yy in (("train", y_tr), ("val", y_va), ("test", y_te)):
        log(f"[4] {n:5s}: {len(yy):,} rows | pos {int(yy.sum()):,} | prevalence {yy.mean():.2%}")

    # ---- 5. preprocessor (fit on train only) ----
    pre = th.build_preprocessor()
    Xt_tr = pre.fit_transform(X_tr)
    Xt_va, Xt_te = pre.transform(X_va), pre.transform(X_te)
    names = list(pre.get_feature_names_out())

    # ---- 6. XGBoost + same search space ----
    spw = float((y_tr == 0).sum() / (y_tr == 1).sum())
    log(f"[6] scale_pos_weight (neg/pos in train) = {spw:.3f}")
    base = XGBClassifier(objective="binary:logistic", eval_metric="logloss", tree_method="hist",
                         scale_pos_weight=spw, random_state=SEED, n_jobs=1)
    search = RandomizedSearchCV(
        base,
        param_distributions={
            "n_estimators": [100, 150, 200, 300, 400], "max_depth": [2, 3, 4, 5],
            "learning_rate": [0.02, 0.03, 0.05, 0.08, 0.1], "subsample": [0.7, 0.8, 0.9, 1.0],
            "colsample_bytree": [0.6, 0.8, 1.0], "min_child_weight": [1, 3, 5, 10],
            "reg_lambda": [1, 3, 5, 10], "gamma": [0, 0.5, 1],
        },
        n_iter=25, scoring="roc_auc", cv=StratifiedKFold(3, shuffle=True, random_state=SEED),
        random_state=SEED, n_jobs=1, refit=True,
    )
    search.fit(Xt_tr, y_tr)
    best = search.best_params_
    log(f"[6] best CV ROC-AUC {search.best_score_:.4f} | params {best}  ({time.time()-t0:.0f}s)")
    tuned = XGBClassifier(**{**base.get_params(), **best})

    # ---- 7. calibration: choose sigmoid vs isotonic by out-of-fold Brier on train ----
    cv5 = StratifiedKFold(5, shuffle=True, random_state=SEED)
    oof, briers = {}, {}
    for method in ("sigmoid", "isotonic"):
        cal = CalibratedClassifierCV(tuned, method=method, cv=cv5)
        oof[method] = cross_val_predict(cal, Xt_tr, y_tr,
                                        cv=StratifiedKFold(5, shuffle=True, random_state=SEED + 1),
                                        method="predict_proba")[:, 1]
        briers[method] = brier_score_loss(y_tr, oof[method])
        log(f"[7] {method:9s} OOF Brier on train: {briers[method]:.5f}  ({time.time()-t0:.0f}s)")
    calib_method = min(briers, key=briers.get)
    log(f"[7] -> using '{calib_method}'")
    model = CalibratedClassifierCV(tuned, method=calib_method, cv=cv5)
    model.fit(Xt_tr, y_tr)
    raw_xgb = XGBClassifier(**{**base.get_params(), **best}).fit(Xt_tr, y_tr)

    p_va, p_te = model.predict_proba(Xt_va)[:, 1], model.predict_proba(Xt_te)[:, 1]
    p_va_u, p_te_u = raw_xgb.predict_proba(Xt_va)[:, 1], raw_xgb.predict_proba(Xt_te)[:, 1]

    # ---- 8. thresholds chosen on VALIDATION ----
    thr_sample = best_thr(y_va, p_va)                       # scale of the model's own output
    pi_s = float(y_tr.mean())                               # training prevalence
    pi_p = n_pos_all / (n_pos_all + n_neg_all)              # prevalence among all valid BRFSS rows
    w_neg = n_neg_all / N_NEG                               # each sampled negative stands for this many
    w_of = lambda yy: np.where(np.asarray(yy) == 1, 1.0, w_neg)
    p_va_pop, p_te_pop = shift_prior(p_va, pi_s, pi_p), shift_prior(p_te, pi_s, pi_p)
    thr_pop = best_thr(y_va, p_va_pop, w_of(y_va))
    log(f"[8] validation F1-optimal threshold: {thr_sample:.3f} (as-sampled) | {thr_pop:.3f} (population-corrected)")

    # ---- 9. evaluation: NEW model, as-sampled (what was asked) ----
    def eval_as_sampled(yy, pp, pu, thr):
        return {**rank_and_calibration(yy, pp),
                "brier_uncalibrated": float(brier_score_loss(yy, pu)),
                "ece_uncalibrated": float(th.expected_calibration_error(yy, pu)),
                "at_threshold_0.50": threshold_block(yy, pp, 0.50),
                f"at_threshold_{thr:.3f}_f1_optimised": threshold_block(yy, pp, thr)}
    m_val = eval_as_sampled(y_va, p_va, p_va_u, thr_sample)
    m_test = eval_as_sampled(y_te, p_te, p_te_u, thr_sample)
    lo, hi = th.auc_bootstrap_ci(y_te, p_te)
    m_test["roc_auc_95ci"] = [lo, hi]
    m_test["calibration"] = {"method": calib_method, "reliability_table": th.reliability_table(y_te, p_te)}
    lv = pd.Series([th.risk_level_from_percent(int(round(p * 100))) for p in p_te])
    m_test["risk_level_distribution_as_sampled"] = (
        lv.value_counts().reindex(["Low", "Moderate", "Elevated", "High"], fill_value=0).to_dict())

    # ---- 10. NEW vs OLD on identical held-out rows (old-train rows removed) ----
    keep = ~X_te.index.isin(old_train_raw_idx)
    n_overlap = int((~keep).sum())
    Xc, yc = X_te.loc[keep], y_te.loc[keep]
    pn = p_te[keep]
    po = old_model.predict_proba(old_pre.transform(Xc))[:, 1]
    wc = w_of(yc)
    pn_pop = p_te_pop[keep]
    thr_old = float(old_meta["f1_optimised_threshold"])
    log(f"[10] comparison set: {len(Xc):,} test rows ({n_overlap} removed because the old model trained on them)")

    comparison = {
        "rows": int(len(Xc)), "positives": int(yc.sum()),
        "rows_removed_old_model_trained_on": n_overlap,
        "as_sampled": {   # prevalence ~34.6%: probabilities of the OLD model are calibrated to ~10%, so its
                          # Brier/ECE/threshold metrics are penalised here; ROC-AUC / PR-AUC are comparable.
            "prevalence": float(yc.mean()),
            "new": {**rank_and_calibration(yc, pn),
                    "at_0.50": threshold_block(yc, pn, 0.5),
                    "at_f1_threshold": threshold_block(yc, pn, thr_sample)},
            "old": {**rank_and_calibration(yc, po),
                    "at_0.50": threshold_block(yc, po, 0.5),
                    "at_f1_threshold": threshold_block(yc, po, thr_old)},
        },
        "population_weighted": {   # negatives up-weighted -> ~9% prevalence; new probs prior-shift corrected
            "prevalence": float(np.average(yc, weights=wc)),
            "new_prior_corrected": {**rank_and_calibration(yc, pn_pop, wc),
                                    "at_0.50": threshold_block(yc, pn_pop, 0.5, wc),
                                    "at_f1_threshold": threshold_block(yc, pn_pop, thr_pop, wc),
                                    "reliability_table": w_reliability(yc, pn_pop, wc)},
            "new_uncorrected": {**rank_and_calibration(yc, pn, wc)},
            "old": {**rank_and_calibration(yc, po, wc),
                    "at_0.50": threshold_block(yc, po, 0.5, wc),
                    "at_f1_threshold": threshold_block(yc, po, thr_old, wc),
                    "reliability_table": w_reliability(yc, po, wc)},
        },
    }
    # risk-band spread, to show what the UI would display
    lvp = pd.Series([th.risk_level_from_percent(int(round(p * 100))) for p in pn_pop])
    lvr = pd.Series([th.risk_level_from_percent(int(round(p * 100))) for p in pn])
    lvo = pd.Series([th.risk_level_from_percent(int(round(p * 100))) for p in po])
    order = ["Low", "Moderate", "Elevated", "High"]
    def wshare(levels):
        s = pd.Series(wc).groupby(levels.values).sum().reindex(order, fill_value=0.0)
        return (s / s.sum()).round(4).to_dict()
    comparison["risk_band_share_of_population"] = {
        "new_uncorrected": wshare(lvr), "new_prior_corrected": wshare(lvp), "old": wshare(lvo)}

    # ---- 11. save ----
    imp = pd.Series(raw_xgb.feature_importances_, index=names).sort_values(ascending=False)
    th.MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(pre, th.PREPROCESSOR_PATH)
    joblib.dump(model, th.MODEL_PATH)
    meta = {
        "target_cdc_variable": th.TARGET_CDC,
        "target_definition": "1 = reported MI or CHD (CVDINFR4=1 OR CVDCRHD4=1); 2 = neither -> mapped to 1/0",
        "data_source": "CDC BRFSS LLCP2025.XPT",
        "model_version": "v2 (retrained on all positives + sampled negatives, 70/15/15 split)",
        "cdc_variables_used": th.CDC_VARS_USED,
        "cdc_to_feature_name": th.CDC_FEATURE_VARS,
        "features": FEATURES,
        "encoded_feature_names": names,
        "sampling": {
            "positives_used": int(y.sum()), "negatives_used": int((y == 0).sum()),
            "valid_positives_in_file": n_pos_all, "valid_negatives_in_file": n_neg_all,
            "negative_sampling": f"random {N_NEG:,} of {n_neg_all:,} valid _MICHD=2 rows, seed={SEED}",
            "feature_missingness_handling": "rows kept; invalid/refused codes -> NaN -> imputed by the preprocessor "
                                            "(median / most-frequent, fit on train only). Complete-case dropping "
                                            "(train_heart.py) would have kept only "
                                            f"{int(cc.heart_disease.sum()):,} of {n_pos_all:,} positives.",
            "missing_rate_among_positives": miss_pos,
        },
        "rows_used": int(len(data)),
        "train_rows": int(len(X_tr)), "validation_rows": int(len(X_va)), "test_rows": int(len(X_te)),
        "split": "stratified 70/15/15, seed 42, performed before the preprocessor was fit",
        "class_distribution_all": {"negative_0": int((y == 0).sum()), "positive_1": int(y.sum()),
                                   "positive_rate": float(y.mean())},
        "class_distribution_train": {"0": int((y_tr == 0).sum()), "1": int(y_tr.sum())},
        "class_distribution_validation": {"0": int((y_va == 0).sum()), "1": int(y_va.sum())},
        "class_distribution_test": {"0": int((y_te == 0).sum()), "1": int(y_te.sum())},
        "scale_pos_weight": spw,
        "xgboost_params": best,
        "cv_roc_auc_best": float(search.best_score_),
        "calibration_method": calib_method,
        "calibration_oof_brier_train": briers,
        "f1_optimised_threshold": thr_sample,
        "f1_optimised_threshold_note": "chosen on the validation split; applies to the model's raw output "
                                       "(which is calibrated to the ~34.6% training prevalence)",
        "prevalence_note": {
            "training_prevalence": pi_s,
            "population_prevalence_valid_brfss_rows": pi_p,
            "explanation": "predict_proba() output is calibrated to the training sample prevalence, so it reads "
                           "higher than real-world risk. To express it at real-world prevalence apply "
                           "logit(p') = logit(p) + delta.",
            "delta_logit_shift": float(np.log(pi_p / (1 - pi_p)) - np.log(pi_s / (1 - pi_s))),
            "f1_optimised_threshold_after_correction": thr_pop,
        },
        "risk_bands_percent": {"Low": "0-29", "Moderate": "30-49", "Elevated": "50-69", "High": "70-100"},
        "metrics_validation": m_val,
        "metrics_test": m_test,
        "comparison_vs_old_model": comparison,
        "feature_importance": {k: float(v) for k, v in imp.items()},
    }
    th.METADATA_PATH.write_text(json.dumps(meta, indent=2, default=float))
    log(f"[11] saved model / preprocessor / metadata  ({time.time()-t0:.0f}s total)")

    # ---- 12. smoke test on saved files: new vs old on the demo patients ----
    pre2, m2 = joblib.load(th.PREPROCESSOR_PATH), joblib.load(th.MODEL_PATH)
    demo = {
        "healthy 30F": {"age": 30, "sex": "female", "height_cm": 165, "weight_kg": 60},
        "55M mixed risk": {"age": 55, "sex": "male", "bmi": 29, "smoking_status": "former", "high_bp": "yes",
                           "high_chol": "yes", "diabetes": "no", "physically_active": "yes", "general_health": "good"},
        "76M many conditions": {"age": 76, "sex": "male", "bmi": 31, "smoking_status": "former", "high_bp": True,
                                "high_chol": True, "diabetes": "yes", "kidney_disease": True, "copd": True,
                                "difficulty_walking": True, "physically_active": False, "general_health": "poor",
                                "physical_unwell_days": 20},
    }
    smoke = {}
    for k, pd_ in demo.items():
        row = th._patient_to_row(pd_)
        pn_ = float(m2.predict_proba(pre2.transform(row))[0, 1])
        po_ = float(old_model.predict_proba(old_pre.transform(row))[0, 1])
        smoke[k] = {"new_raw": pn_, "new_prior_corrected": float(shift_prior(np.array([pn_]), pi_s, pi_p)[0]),
                    "old": po_}
        log(f"[12] {k:22s} new raw {pn_:.3f} | new corrected {smoke[k]['new_prior_corrected']:.3f} | old {po_:.3f}")
    meta["smoke_test_probabilities"] = smoke
    th.METADATA_PATH.write_text(json.dumps(meta, indent=2, default=float))

    # ---- console summary ----
    log("\n" + "=" * 72 + "\nSUMMARY\n" + "=" * 72)
    log(f"best params: {best} | calibration: {calib_method} | threshold(val): {thr_sample:.3f}")
    for name, mm in (("VAL ", m_val), ("TEST", m_test)):
        c = mm[f'at_threshold_{thr_sample:.3f}_f1_optimised']
        log(f"{name} as-sampled: AUC {mm['roc_auc']:.4f} PR-AUC {mm['pr_auc']:.4f} Brier {mm['brier']:.4f} "
            f"ECE {mm['ece']:.4f} | @thr acc {c['accuracy']:.4f} P {c['precision']:.4f} R {c['recall']:.4f} F1 {c['f1']:.4f}")
    log(f"done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
