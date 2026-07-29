# -*- coding: utf-8 -*-
"""Exploratory Data Analysis + statistical analytics.

Computes everything the dashboard renders and serialises it into a compact,
JSON-friendly ``analytics.json``. All heavy work happens here, once, at build
time so the API only ever serves precomputed results.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.cluster import KMeans

from . import config as C


# --------------------------------------------------------------------------- #
# JSON helpers
# --------------------------------------------------------------------------- #
def to_native(obj):
    """Recursively convert numpy/pandas scalars to plain Python for JSON."""
    if isinstance(obj, dict):
        return {str(k): to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_native(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        f = float(obj)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, 6)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else round(obj, 6)
    if pd.isna(obj) if np.isscalar(obj) else False:
        return None
    return obj


# --------------------------------------------------------------------------- #
# Building blocks
# --------------------------------------------------------------------------- #
def _histogram(values: np.ndarray, bins: int, lo: float, hi: float) -> dict:
    counts, edges = np.histogram(values, bins=bins, range=(lo, hi))
    centers = (edges[:-1] + edges[1:]) / 2
    return {
        "bin_edges": edges.tolist(),
        "bin_centers": centers.round(4).tolist(),
        "counts": counts.astype(int).tolist(),
        "total": int(counts.sum()),
    }


def _kde_curve(values: np.ndarray, lo: float, hi: float, points: int = 200,
               max_sample: int = 60000) -> dict:
    v = values
    if len(v) > max_sample:
        rng = np.random.default_rng(42)
        v = rng.choice(v, size=max_sample, replace=False)
    try:
        kde = stats.gaussian_kde(v)
        grid = np.linspace(lo, hi, points)
        dens = kde(grid)
        return {"x": grid.round(4).tolist(), "y": dens.round(8).tolist()}
    except Exception:
        return {"x": [], "y": []}


def _boxstats(values: np.ndarray) -> dict:
    q1, med, q3 = np.percentile(values, [25, 50, 75])
    iqr = q3 - q1
    lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    lo_whisker = float(values[values >= lo_f].min()) if (values >= lo_f).any() else float(values.min())
    hi_whisker = float(values[values <= hi_f].max()) if (values <= hi_f).any() else float(values.max())
    return {
        "min": float(values.min()), "q1": float(q1), "median": float(med),
        "q3": float(q3), "max": float(values.max()),
        "iqr": float(iqr), "lower_fence": float(lo_f), "upper_fence": float(hi_f),
        "lower_whisker": lo_whisker, "upper_whisker": hi_whisker,
        "outliers_low": int((values < lo_f).sum()),
        "outliers_high": int((values > hi_f).sum()),
        "mean": float(values.mean()),
    }


def _central_tendency(values: np.ndarray) -> dict:
    vc = pd.Series(values).value_counts()
    mode_val = float(vc.index[0])
    return {
        "n": int(len(values)),
        "mean": float(np.mean(values)),
        "median": float(np.median(values)),
        "mode": mode_val,
        "mode_count": int(vc.iloc[0]),
        "std": float(np.std(values, ddof=1)),
        "variance": float(np.var(values, ddof=1)),
        "skewness": float(stats.skew(values)),
        "kurtosis_excess": float(stats.kurtosis(values)),  # Fisher (excess)
        "range": float(values.max() - values.min()),
        "cv_pct": float(np.std(values, ddof=1) / np.mean(values) * 100) if np.mean(values) else None,
        "iqr": float(np.percentile(values, 75) - np.percentile(values, 25)),
        "sem": float(stats.sem(values)),
    }


def _cdf(values: np.ndarray, points: int = 200) -> dict:
    xs = np.linspace(values.min(), values.max(), points)
    sorted_v = np.sort(values)
    cum = np.searchsorted(sorted_v, xs, side="right") / len(values)
    return {"x": xs.round(4).tolist(), "y": (cum * 100).round(4).tolist()}


def _normality(values: np.ndarray) -> dict:
    out = {}
    rng = np.random.default_rng(7)
    sample = values if len(values) <= 5000 else rng.choice(values, 5000, replace=False)
    # Shapiro-Wilk (small sample)
    try:
        w, p = stats.shapiro(sample)
        out["shapiro_wilk"] = {"statistic": float(w), "p_value": float(p),
                               "sample_n": int(len(sample)),
                               "normal_at_0.05": bool(p > 0.05)}
    except Exception:
        pass
    # D'Agostino K^2 (full)
    try:
        k2, p = stats.normaltest(values)
        out["dagostino_k2"] = {"statistic": float(k2), "p_value": float(p),
                               "normal_at_0.05": bool(p > 0.05)}
    except Exception:
        pass
    # Jarque-Bera
    try:
        jb, p = stats.jarque_bera(values)
        out["jarque_bera"] = {"statistic": float(jb), "p_value": float(p),
                              "normal_at_0.05": bool(p > 0.05)}
    except Exception:
        pass
    # Anderson-Darling
    try:
        ad = stats.anderson(sample, dist="norm")
        out["anderson_darling"] = {
            "statistic": float(ad.statistic),
            "critical_values": [float(c) for c in ad.critical_values],
            "significance_levels": [float(s) for s in ad.significance_level],
        }
    except Exception:
        pass
    out["verdict"] = ("Not normal — national exam scores are typically "
                      "non-Gaussian (bounded, skewed, with mass at pass "
                      "boundaries). Reported for completeness.")
    return out


def _clusters(values: np.ndarray, k: int = 5) -> dict:
    rng = np.random.default_rng(11)
    sample = values if len(values) <= 100000 else rng.choice(values, 100000, replace=False)
    km = KMeans(n_clusters=k, n_init=10, random_state=0)
    labels = km.fit_predict(sample.reshape(-1, 1))
    centers = km.cluster_centers_.ravel()
    order = np.argsort(centers)
    clusters = []
    for rank, idx in enumerate(order):
        mask = labels == idx
        cv = sample[mask]
        clusters.append({
            "cluster": rank + 1,
            "center_score": round(float(centers[idx]), 2),
            "center_pct": round(float(centers[idx]) / C.MAX_SCORE * 100, 2),
            "size_sample": int(mask.sum()),
            "share_pct": round(float(mask.sum()) / len(sample) * 100, 2),
            "min_score": round(float(cv.min()), 1),
            "max_score": round(float(cv.max()), 1),
        })
    return {"k": k, "sample_n": int(len(sample)), "clusters": clusters}


# --------------------------------------------------------------------------- #
# Main entry
# --------------------------------------------------------------------------- #
def build_analytics(df: pd.DataFrame, verbose: bool = True) -> dict:
    n_total = int(len(df))
    sit_mask = df["is_sitter"] & df["is_valid"]
    sit = df[sit_mask]
    scores = sit["total_degree"].to_numpy(dtype=float)
    pcts = sit["percentage"].to_numpy(dtype=float)

    A: dict = {"meta": dict(C.PLATFORM_META)}
    A["cohort"] = {
        "total_students": n_total,
        "sitters": int(sit_mask.sum()),
        "absent": int((df["status"] == C.STATUS_ABSENT).sum()),
        "invalid": int((~df["is_valid"]).sum()),
    }

    # --- Status distribution ----------------------------------------------
    st = df["status"].value_counts()
    A["status_distribution"] = [
        {"key": k, "label_en": C.STATUS_LABELS_EN.get(k, k),
         "label_ar": C.STATUS_LABELS_AR.get(k, k),
         "count": int(v), "pct": round(v / n_total * 100, 4)}
        for k, v in st.items()
    ]

    # --- Grade band distribution (sitters + all) --------------------------
    def band_dist(frame):
        gb = frame["grade_band"].value_counts()
        rows = []
        for key, ar, en, lo, hi in C.GRADE_BANDS:
            c = int(gb.get(key, 0))
            rows.append({"key": key, "label_ar": ar, "label_en": en,
                         "low": lo, "high": min(hi, 100),
                         "count": c, "pct": round(c / len(frame) * 100, 4)})
        return rows
    A["grade_bands_sitters"] = band_dist(sit)
    A["grade_bands_all"] = band_dist(df)

    # --- Distributions -----------------------------------------------------
    A["histogram_pct"] = _histogram(pcts, C.HIST_BINS, 0, 100)
    A["histogram_score"] = _histogram(scores, 64, 0, C.MAX_SCORE)
    A["density_pct"] = _kde_curve(pcts, 0, 100)
    A["cdf_pct"] = _cdf(pcts)
    A["cdf_score"] = _cdf(scores)

    # --- Box + violin (per status, on percentage) -------------------------
    A["box_overall"] = _boxstats(pcts)
    violins = []
    for k in [C.STATUS_PASS, C.STATUS_ROUND2, C.STATUS_FAIL]:
        gp = df.loc[df["status"] == k, "percentage"].to_numpy(dtype=float)
        if len(gp) == 0:
            continue
        violins.append({
            "key": k, "label_en": C.STATUS_LABELS_EN[k],
            "label_ar": C.STATUS_LABELS_AR[k],
            "box": _boxstats(gp),
            "kde": _kde_curve(gp, 0, 100, points=120),
            "n": int(len(gp)),
        })
    A["violin_by_status"] = violins

    # --- Central tendency + percentiles -----------------------------------
    A["stats_score"] = _central_tendency(scores)
    A["stats_pct"] = _central_tendency(pcts)
    A["percentiles_score"] = {
        str(p): round(float(np.percentile(scores, p)), 3) for p in C.REPORTED_PERCENTILES
    }
    A["percentiles_pct"] = {
        str(p): round(float(np.percentile(pcts, p)), 3) for p in C.REPORTED_PERCENTILES
    }

    # --- Threshold analytics (students above X%) --------------------------
    thr = []
    n_sit = len(pcts)
    for t in C.PCT_THRESHOLDS:
        c_sit = int((pcts >= t).sum())
        c_all = int((df["percentage"] >= t).sum())
        thr.append({
            "threshold": t,
            "count_sitters": c_sit,
            "pct_sitters": round(c_sit / n_sit * 100, 4),
            "count_all": c_all,
            "pct_all": round(c_all / n_total * 100, 4),
            "score_needed": round(t / 100 * C.MAX_SCORE, 2),
        })
    A["thresholds"] = thr

    # --- Frequency table (exact score) + Pareto ---------------------------
    vc = sit["total_degree"].value_counts().sort_index()
    cum = vc.cumsum()
    freq_rows = []
    for score_v, cnt in vc.items():
        freq_rows.append({
            "score": round(float(score_v), 1),
            "pct_value": round(float(score_v) / C.MAX_SCORE * 100, 3),
            "count": int(cnt),
            "frequency_pct": round(int(cnt) / n_sit * 100, 5),
            "cumulative_count": int(cum[score_v]),
            "cumulative_pct": round(int(cum[score_v]) / n_sit * 100, 4),
        })
    A["frequency_table"] = freq_rows

    # Pareto over grade bands (sorted by count desc)
    gb_sorted = sorted(A["grade_bands_sitters"], key=lambda r: r["count"], reverse=True)
    run = 0
    pareto = []
    for r in gb_sorted:
        run += r["count"]
        pareto.append({"label_en": r["label_en"], "label_ar": r["label_ar"],
                       "count": r["count"],
                       "cumulative_pct": round(run / n_sit * 100, 3)})
    A["pareto_bands"] = pareto

    # --- Normality + probability model ------------------------------------
    A["normality"] = _normality(pcts)
    A["normal_fit_pct"] = {
        "mu": float(np.mean(pcts)), "sigma": float(np.std(pcts, ddof=1)),
        "note": "Best-fit Gaussian overlay parameters for the percentage distribution.",
    }

    # --- Clusters ----------------------------------------------------------
    A["clusters"] = _clusters(scores, k=5)

    # --- Heatmap: grade band x status -------------------------------------
    hm = pd.crosstab(df["grade_band"], df["status"])
    band_order = [b[0] for b in C.GRADE_BANDS]
    status_order = [C.STATUS_PASS, C.STATUS_ROUND2, C.STATUS_FAIL, C.STATUS_ABSENT]
    hm = hm.reindex(index=band_order, columns=status_order, fill_value=0)
    A["heatmap_band_status"] = {
        "bands": [dict(key=b[0], label_en=b[2], label_ar=b[1]) for b in C.GRADE_BANDS],
        "statuses": [dict(key=s, label_en=C.STATUS_LABELS_EN[s],
                          label_ar=C.STATUS_LABELS_AR[s]) for s in status_order],
        "matrix": hm.values.astype(int).tolist(),
    }

    # --- Sunburst / treemap hierarchy: status -> grade band ---------------
    A["hierarchy_status_band"] = _hierarchy(df)

    # --- Top performers + extremes ----------------------------------------
    top = sit.nlargest(100, "total_degree")[
        ["national_rank", "seating_no", "name", "total_degree",
         "percentage", "performance_index"]
    ]
    A["top_100"] = to_native(top.to_dict(orient="records"))

    perfect = int((sit["total_degree"] >= C.MAX_SCORE).sum())
    A["extremes"] = {
        "max_score": float(scores.max()),
        "min_sitter_score": float(scores.min()),
        "perfect_scores": perfect,
        "ge_98pct": int((pcts >= 98).sum()),
        "ge_99pct": int((pcts >= 99).sum()),
        "count_at_max": int((scores == scores.max()).sum()),
        "bottom_decile_ceiling": round(float(np.percentile(scores, 10)), 2),
    }

    # --- Gap analysis: largest count gaps between adjacent 1-pct bins ------
    A["gap_analysis"] = _gap_analysis(pcts)

    A["_computed_note"] = ("All ranking/percentile statistics computed over the "
                           "exam-sitter cohort; absentees excluded from the "
                           "distribution but reported in totals.")
    if verbose:
        print(f"[analytics] built; sitters={n_sit:,} mean%={A['stats_pct']['mean']:.2f}")
    return to_native(A)


def _hierarchy(df: pd.DataFrame) -> dict:
    labels, parents, values = ["الإجمالي"], [""], [int(len(df))]
    for s in [C.STATUS_PASS, C.STATUS_ROUND2, C.STATUS_FAIL, C.STATUS_ABSENT]:
        sub = df[df["status"] == s]
        if len(sub) == 0:
            continue
        s_label = C.STATUS_LABELS_AR[s]
        labels.append(s_label); parents.append("الإجمالي"); values.append(int(len(sub)))
        gb = sub["grade_band"].value_counts()
        for key, ar, en, lo, hi in C.GRADE_BANDS:
            c = int(gb.get(key, 0))
            if c == 0:
                continue
            labels.append(f"{ar} ({s_label})"); parents.append(s_label); values.append(c)
    return {"labels": labels, "parents": parents, "values": values}


def _gap_analysis(pcts: np.ndarray) -> dict:
    counts, edges = np.histogram(pcts, bins=100, range=(0, 100))
    diffs = np.diff(counts)
    idx = int(np.argmax(np.abs(diffs)))
    return {
        "description": ("Adjacent 1%-bin count differences reveal where the "
                        "population thins or piles up."),
        "largest_jump_at_pct": round(float(edges[idx + 1]), 1),
        "largest_jump_delta": int(diffs[idx]),
        "peak_bin_pct": round(float(edges[int(np.argmax(counts))]), 1),
        "peak_bin_count": int(counts.max()),
    }
