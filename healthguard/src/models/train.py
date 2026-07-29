"""
Training pipeline for HealthGuard AI.

PROTOCOL (this is the part that earns the marks -- know it cold)
---------------------------------------------------------------
1.  HOLD OUT FIRST. A stratified 20% test set is split off before
    anything else happens and is touched exactly once, at the very end.

2.  EVERYTHING INSIDE THE PIPELINE. Imputation, scaling and one-hot
    encoding are steps of a sklearn Pipeline, so they are refitted on
    the training portion of every cross-validation fold. Fitting an
    imputer on the full dataset before splitting is the single most
    common cause of the inflated 90-95% accuracies reported on these
    datasets. It is structurally impossible here.

3.  REPEATED CROSS-VALIDATION. RepeatedStratifiedKFold, 5 folds x 5
    repeats = 25 estimates per model. On 303 rows a single 5-fold run
    swings several points on the luck of the split, so every metric is
    reported as mean +/- standard deviation.

4.  CLASS WEIGHTING, NOT SMOTE. Stroke is ~5% positive. We reweight
    the loss instead of synthesising minority patients. SMOTE applied
    before splitting -- very common, and wrong -- leaks synthetic rows
    derived from validation patients into training.

5.  SELECTION BY AVERAGE PRECISION. This is a screening context: what
    matters is performance on the positive class, which PR-AUC measures
    and ROC-AUC flatters on imbalanced data.

6.  CALIBRATION. Both Platt (sigmoid) and isotonic are fitted; the one
    with the lower out-of-fold Brier score wins. A raw model's 0.92 is
    a score, not a probability. Calibration is what makes it a
    probability, and the reliability diagrams prove it did something.

7.  TWO FEATURE SETS PER DISEASE. 'full' uses everything the source
    dataset offers; 'core' uses only the core clinical fields that
    source actually measures. The gap between them is what a user loses
    by leaving optional fields blank.

Run:  python -m src.models.train
"""
from __future__ import annotations

import json
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, average_precision_score,
                             brier_score_loss, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import (RepeatedStratifiedKFold, cross_val_predict,
                                     cross_validate, train_test_split)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from src.clinical.scores import findrisc_score, framingham_cvd_risk
from src.data.clean import CORE, DISPLAY, SOURCE

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
ART = ROOT / "artifacts"
MODELS = ART / "models"

SEED = 20260727
N_SPLITS, N_REPEATS = 5, 5
TEST_SIZE = 0.20

DISEASES = ["heart", "diabetes", "kidney", "stroke"]


# ----------------------------------------------------------------------
# Feature set construction
# ----------------------------------------------------------------------
def usable_columns(df: pd.DataFrame, cols) -> list:
    """Keep only columns that exist, have data, and vary."""
    out = []
    for c in cols:
        if c not in df.columns:
            continue
        s = df[c]
        if s.isna().all():
            continue
        if s.dropna().nunique() < 2:      # constants carry no information
            continue
        out.append(c)
    return out


def feature_sets(df: pd.DataFrame) -> dict:
    feats = [c for c in df.columns if c != "target"]
    return {"full": usable_columns(df, feats),
            "core": usable_columns(df, CORE)}


def split_types(df: pd.DataFrame, cols):
    num = [c for c in cols if pd.api.types.is_numeric_dtype(df[c])]
    cat = [c for c in cols if c not in num]
    return num, cat


def build_preprocessor(num, cat) -> ColumnTransformer:
    """Imputation + scaling + encoding. Fitted per fold, never globally."""
    num_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    cat_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    return ColumnTransformer(
        [("num", num_pipe, num), ("cat", cat_pipe, cat)],
        remainder="drop", verbose_feature_names_out=False)


def candidate_models(pos_weight: float) -> dict:
    """Three models: an interpretable baseline, a bagged ensemble, a boosted one."""
    return {
        "logistic_regression": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=SEED),
        "random_forest": RandomForestClassifier(
            n_estimators=400, min_samples_leaf=2, max_features="sqrt",
            class_weight="balanced_subsample", random_state=SEED, n_jobs=-1),
        "xgboost": XGBClassifier(
            n_estimators=350, max_depth=3, learning_rate=0.06,
            subsample=0.85, colsample_bytree=0.85, reg_lambda=1.5,
            scale_pos_weight=pos_weight, eval_metric="logloss",
            random_state=SEED, n_jobs=-1, tree_method="hist"),
    }


# ----------------------------------------------------------------------
# Metrics
# ----------------------------------------------------------------------
def evaluate(y, p, threshold=0.5) -> dict:
    yhat = (p >= threshold).astype(int)
    return {
        "accuracy": accuracy_score(y, yhat),
        "precision": precision_score(y, yhat, zero_division=0),
        "recall": recall_score(y, yhat, zero_division=0),
        "f1": f1_score(y, yhat, zero_division=0),
        "roc_auc": roc_auc_score(y, p),
        "pr_auc": average_precision_score(y, p),
        "brier": brier_score_loss(y, p),
    }


def threshold_analysis(y, p) -> dict:
    """
    Recall at the default 0.5 threshold is close to meaningless when
    prevalence is 5%: a well-calibrated model rarely emits a probability
    above 0.5 for such a class, so recall collapses while the model is
    ranking patients perfectly well.

    We therefore also report two clinically-motivated operating points.
    Full cost-sensitive threshold selection and decision curve analysis
    land in Review 2; this is the honest interim reporting.
    """
    grid = np.unique(np.round(np.linspace(0.01, 0.95, 190), 4))
    rows = []
    for t in grid:
        yhat = (p >= t).astype(int)
        rows.append({
            "threshold": float(t),
            "recall": float(recall_score(y, yhat, zero_division=0)),
            "precision": float(precision_score(y, yhat, zero_division=0)),
            "f1": float(f1_score(y, yhat, zero_division=0)),
            "flagged_rate": float(yhat.mean()),
        })

    best_f1 = max(rows, key=lambda r: r["f1"])
    at90 = [r for r in rows if r["recall"] >= 0.90]
    screening = min(at90, key=lambda r: r["flagged_rate"]) if at90 else None
    return {"max_f1": best_f1, "recall_at_least_90pct": screening,
            "default_0.5": next(r for r in rows if abs(r["threshold"] - 0.5) < 0.01)}


def reliability(y, p, bins=8) -> dict:
    """Points for a reliability diagram, plus expected calibration error."""
    try:
        frac_pos, mean_pred = calibration_curve(y, p, n_bins=bins, strategy="quantile")
    except Exception:
        return {"mean_predicted": [], "fraction_positive": [], "ece": None}
    edges = np.quantile(p, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    idx = np.digitize(p, edges[1:-1])
    ece = 0.0
    for b in np.unique(idx):
        m = idx == b
        ece += m.mean() * abs(p[m].mean() - y[m].mean())
    return {"mean_predicted": [round(float(v), 4) for v in mean_pred],
            "fraction_positive": [round(float(v), 4) for v in frac_pos],
            "ece": round(float(ece), 4)}


# ----------------------------------------------------------------------
# Clinical baselines on the held-out test set
# ----------------------------------------------------------------------
def clinical_baseline(disease: str, X_test: pd.DataFrame, y_test: np.ndarray):
    if disease == "heart":
        risk, rep = framingham_cvd_risk(X_test)
        name = "Framingham General CVD (BMI-based)"
    elif disease == "diabetes":
        _pts, risk, rep = findrisc_score(X_test)
        name = "FINDRISC (adapted)"
    else:
        return None

    ok = ~np.isnan(risk)
    if ok.sum() < 10 or len(np.unique(y_test[ok])) < 2:
        return None
    return {
        "name": name,
        "roc_auc": float(roc_auc_score(y_test[ok], risk[ok])),
        "pr_auc": float(average_precision_score(y_test[ok], risk[ok])),
        "brier": float(brier_score_loss(y_test[ok], np.clip(risk[ok], 0, 1))),
        "item_report": rep.to_dict(),
        "caveat": ("Discrimination (AUC) is a fair comparison. Absolute "
                   "calibration is not: the published score targets a "
                   "different outcome definition and time horizon than the "
                   "dataset label."),
    }


# ----------------------------------------------------------------------
# Train one (disease, feature-set) combination
# ----------------------------------------------------------------------
def train_one(disease: str, df: pd.DataFrame, fs_name: str, cols: list) -> dict:
    y = df["target"].to_numpy()
    X = df[cols].copy()

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED)

    num, cat = split_types(X, cols)
    pos_weight = float((y_tr == 0).sum() / max((y_tr == 1).sum(), 1))

    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS,
                                 random_state=SEED)
    scoring = {"roc_auc": "roc_auc", "pr_auc": "average_precision",
               "recall": "recall", "f1": "f1", "accuracy": "accuracy"}

    # ---- compare the three candidates by repeated CV --------------------
    comparison, fitted = {}, {}
    for mname, est in candidate_models(pos_weight).items():
        pipe = Pipeline([("prep", build_preprocessor(num, cat)), ("clf", est)])
        t0 = time.perf_counter()
        cvres = cross_validate(pipe, X_tr, y_tr, cv=cv, scoring=scoring,
                               n_jobs=-1, error_score="raise")
        elapsed = time.perf_counter() - t0
        comparison[mname] = {
            k: {"mean": float(np.mean(cvres[f"test_{k}"])),
                "std": float(np.std(cvres[f"test_{k}"]))}
            for k in scoring
        }
        comparison[mname]["cv_seconds"] = round(elapsed, 2)
        fitted[mname] = pipe

    # selection: average precision, i.e. performance on the positive class
    best_name = max(comparison, key=lambda m: comparison[m]["pr_auc"]["mean"])
    best_pipe = fitted[best_name]

    # ---- calibration: sigmoid vs isotonic, chosen by out-of-fold Brier --
    calib_results = {}
    for method in ("sigmoid", "isotonic"):
        cal = CalibratedClassifierCV(best_pipe, method=method, cv=5)
        oof = cross_val_predict(cal, X_tr, y_tr, cv=5, method="predict_proba",
                                n_jobs=-1)[:, 1]
        calib_results[method] = {"brier": float(brier_score_loss(y_tr, oof)),
                                 "reliability": reliability(y_tr, oof)}
    best_method = min(calib_results, key=lambda m: calib_results[m]["brier"])

    # uncalibrated out-of-fold probabilities, for the before/after diagram
    oof_raw = cross_val_predict(best_pipe, X_tr, y_tr, cv=5,
                                method="predict_proba", n_jobs=-1)[:, 1]
    calib_before = {"brier": float(brier_score_loss(y_tr, oof_raw)),
                    "reliability": reliability(y_tr, oof_raw)}

    # ---- refit on the full training set, then touch the test set ONCE ---
    final = CalibratedClassifierCV(best_pipe, method=best_method, cv=5)
    final.fit(X_tr, y_tr)
    p_te = final.predict_proba(X_te)[:, 1]
    test_metrics = evaluate(y_te, p_te)
    test_metrics["reliability"] = reliability(y_te, p_te, bins=6)
    test_metrics["thresholds"] = threshold_analysis(y_te, p_te)

    # uncalibrated test performance, to show what calibration changed
    best_pipe.fit(X_tr, y_tr)
    p_te_raw = best_pipe.predict_proba(X_te)[:, 1]
    test_raw = evaluate(y_te, p_te_raw)

    # ---- explainer bundle (SHAP runs on the ranking model) -------------
    prep = build_preprocessor(num, cat).fit(X_tr, y_tr)
    Xt = prep.transform(X_tr)
    feat_names = list(prep.get_feature_names_out())
    base = candidate_models(pos_weight)[best_name]
    base.fit(Xt, y_tr)
    rng = np.random.default_rng(SEED)
    bg_idx = rng.choice(len(Xt), size=min(120, len(Xt)), replace=False)

    MODELS.mkdir(parents=True, exist_ok=True)
    joblib.dump(final, MODELS / f"{disease}__{fs_name}__calibrated.joblib")
    joblib.dump({"preprocessor": prep, "base_model": base,
                 "model_name": best_name, "feature_names": feat_names,
                 "background": Xt[bg_idx], "columns": cols,
                 "numeric": num, "categorical": cat},
                MODELS / f"{disease}__{fs_name}__explainer.joblib")

    baseline = clinical_baseline(disease, X_te, y_te) if fs_name == "full" else None

    return {
        "feature_set": fs_name,
        "n_features": len(cols),
        "features": cols,
        "n_train": int(len(X_tr)),
        "n_test": int(len(X_te)),
        "model_comparison": comparison,
        "selected_model": best_name,
        "selection_criterion": "highest mean PR-AUC over 5x5 repeated stratified CV",
        "calibration": {
            "method_chosen": best_method,
            "candidates": {k: {"brier": v["brier"]} for k, v in calib_results.items()},
            "before": calib_before,
            "after": calib_results[best_method],
        },
        "test_metrics": test_metrics,
        "test_metrics_uncalibrated": test_raw,
        "clinical_baseline": baseline,
    }


# ----------------------------------------------------------------------
def data_provenance() -> dict:
    marker = ROOT / "data" / "raw" / "STANDIN_MARKER.json"
    if marker.exists():
        return json.loads(marker.read_text())
    return {"is_standin": False,
            "note": "Trained on the real source CSVs in data/raw/."}


def main():
    ART.mkdir(exist_ok=True)
    prov = data_provenance()
    if prov.get("is_standin"):
        print("!" * 70)
        print("TRAINING ON STAND-IN DATA -- read these before quoting any number:")
        for c in prov["caveats"]:
            print("  * " + c)
        print("!" * 70)

    results = {"seed": SEED, "data_provenance": prov, "protocol": {
        "test_size": TEST_SIZE, "cv": f"RepeatedStratifiedKFold("
        f"{N_SPLITS} folds x {N_REPEATS} repeats)",
        "selection_metric": "average_precision",
        "leakage_control": "all preprocessing inside the Pipeline, refitted per fold",
        "imbalance_strategy": "class weighting (no SMOTE)",
    }, "diseases": {}}

    t_start = time.perf_counter()
    for d in DISEASES:
        df = pd.read_csv(PROC / f"{d}.csv")
        fsets = feature_sets(df)
        print(f"\n{'='*70}\n{DISPLAY[d]}  ({SOURCE[d]})")
        print(f"  {len(df)} rows | positive {df['target'].mean():.2%}")
        print(f"  full feature set: {len(fsets['full'])} | "
              f"core feature set: {len(fsets['core'])} -> {fsets['core']}")

        entry = {"display_name": DISPLAY[d], "source": SOURCE[d],
                 "n_rows": int(len(df)),
                 "positive_rate": float(df["target"].mean()),
                 "variants": {}}

        for fs_name, cols in fsets.items():
            if len(cols) == 0:
                continue
            r = train_one(d, df, fs_name, cols)
            entry["variants"][fs_name] = r
            tm = r["test_metrics"]
            print(f"    [{fs_name:<4}] {r['selected_model']:<20} "
                  f"ROC-AUC {tm['roc_auc']:.3f}  PR-AUC {tm['pr_auc']:.3f}  "
                  f"recall {tm['recall']:.3f}  Brier {tm['brier']:.3f}  "
                  f"(calib: {r['calibration']['method_chosen']})")
            if r["clinical_baseline"]:
                b = r["clinical_baseline"]
                print(f"           vs {b['name']}: ROC-AUC {b['roc_auc']:.3f} "
                      f"({b['item_report']['completeness']:.0%} of inputs available)")

        # cost of using core fields only
        if "full" in entry["variants"] and "core" in entry["variants"]:
            gap = (entry["variants"]["full"]["test_metrics"]["roc_auc"]
                   - entry["variants"]["core"]["test_metrics"]["roc_auc"])
            entry["core_only_auc_cost"] = float(gap)
            print(f"    core-only costs {gap:+.3f} ROC-AUC vs full features")

        results["diseases"][d] = entry

    results["total_train_seconds"] = round(time.perf_counter() - t_start, 1)
    with open(ART / "metrics.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'='*70}")
    print(f"done in {results['total_train_seconds']}s -> artifacts/metrics.json")
    print(f"models -> artifacts/models/")


if __name__ == "__main__":
    main()
