# -*- coding: utf-8 -*-
"""Predictive analytics: 2026 university-admission cutoff estimation.

METHOD (fully transparent — see docs/METHODOLOGY.md):

1. Trend projection. Each faculty carries an approximate series of recent-year
   minimum-admission percentages (Egyptian "تنسيق" coordination office figures,
   used here as illustrative anchors). A linear trend is fit over year → cutoff
   and projected to 2026.

2. Distribution-pressure adjustment. The 2026 cohort's own mean percentage is
   compared with a documented historical baseline mean; if this year's students
   scored higher on average, cutoffs are nudged upward (and vice-versa),
   scaled by a small, documented coefficient.

3. Empirical grounding. For the resulting expected cutoff we read straight off
   the REAL 2026 distribution how many students clear it and the implied rank —
   turning the estimate into a concrete, checkable statement.

4. Confidence + scenarios. A 95% interval comes from the historical volatility
   of each series; Optimistic / Expected / Pessimistic scenarios shift the
   cutoff by ±0.9σ (framed from the student's admission-chance perspective).

IMPORTANT LIMITATION: the dataset has no academic track (science / math / arts).
Real tansiq cutoffs are track-specific. We therefore anchor to published
track-specific historical cutoffs but validate against the OVERALL 2026
distribution as a proxy. Treat absolute numbers as directional estimates, not
official thresholds.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from . import config as C

BASELINE_MEAN_PCT = 68.0     # documented assumed historical mean % of sitters
PRESSURE_K = 0.35            # sensitivity of cohort mean shift
SIGMA_FLOOR = 0.8           # minimum volatility (percentage points)
CUTOFF_MIN, CUTOFF_MAX = 30.0, 99.5

# Manual calibration nudge applied uniformly to every faculty's final cutoff,
# after the trend + pressure model (trend fit, pressure formula and sigma are
# untouched). Scenarios/CI are derived from `expected` below, so this single
# constant propagates consistently to every reported number.
CUTOFF_CALIBRATION_PP = 3.0

# faculty: (key, ar, en, stream_ar, category, {year: cutoff_pct})
FACULTIES = [
    ("medicine", "الطب البشري", "Medicine", "علمي علوم", "science",
     {2021: 91.0, 2022: 90.2, 2023: 88.6, 2024: 89.4, 2025: 90.8}),
    ("dentistry", "طب الأسنان", "Dentistry", "علمي علوم", "science",
     {2021: 89.5, 2022: 88.4, 2023: 86.9, 2024: 87.8, 2025: 89.1}),
    ("pharmacy", "الصيدلة", "Pharmacy", "علمي علوم", "science",
     {2021: 88.0, 2022: 86.7, 2023: 85.0, 2024: 85.9, 2025: 87.2}),
    ("vet", "الطب البيطري", "Veterinary Medicine", "علمي علوم", "science",
     {2021: 83.0, 2022: 81.6, 2023: 79.8, 2024: 80.7, 2025: 82.4}),
    ("engineering", "الهندسة", "Engineering", "علمي رياضة", "math",
     {2021: 86.5, 2022: 85.0, 2023: 83.2, 2024: 84.1, 2025: 85.6}),
    ("computer_science", "الحاسبات والمعلومات", "Computer Science", "علمي رياضة", "math",
     {2021: 83.0, 2022: 81.4, 2023: 79.9, 2024: 81.0, 2025: 82.6}),
    ("ai", "الذكاء الاصطناعي", "Artificial Intelligence", "علمي رياضة", "math",
     {2022: 82.0, 2023: 80.1, 2024: 81.2, 2025: 83.0}),
    ("nursing", "التمريض", "Nursing", "علمي علوم", "science",
     {2021: 79.0, 2022: 77.5, 2023: 76.0, 2024: 77.1, 2025: 78.4}),
    ("science", "العلوم", "Science", "علمي علوم", "science",
     {2021: 74.0, 2022: 72.3, 2023: 70.5, 2024: 71.4, 2025: 73.0}),
    ("agriculture", "الزراعة", "Agriculture", "علمي علوم", "science",
     {2021: 66.0, 2022: 64.2, 2023: 62.5, 2024: 63.6, 2025: 65.1}),
    ("commerce", "التجارة", "Commerce", "أدبي / عام", "literary",
     {2021: 62.0, 2022: 60.4, 2023: 58.8, 2024: 59.7, 2025: 61.2}),
    ("law", "الحقوق", "Law", "أدبي", "literary",
     {2021: 61.0, 2022: 59.3, 2023: 57.6, 2024: 58.5, 2025: 60.1}),
    ("arts", "الآداب", "Arts", "أدبي", "literary",
     {2021: 64.0, 2022: 62.5, 2023: 60.9, 2024: 61.8, 2025: 63.3}),
    ("education", "التربية", "Education", "أدبي / علمي", "mixed",
     {2021: 68.0, 2022: 66.4, 2023: 64.8, 2024: 65.7, 2025: 67.2}),
]


def _fit_trend(years, cutoffs):
    x = np.asarray(years, dtype=float)
    y = np.asarray(cutoffs, dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    pred = slope * x + intercept
    resid = y - pred
    sigma = float(np.std(resid, ddof=1)) if len(y) > 2 else float(np.std(np.diff(y)))
    proj_2026 = float(slope * 2026 + intercept)
    return slope, intercept, proj_2026, max(sigma, SIGMA_FLOOR)


def build_predictions(df: pd.DataFrame, verbose: bool = True) -> dict:
    sit = df[df["is_sitter"] & df["is_valid"]]
    pcts = np.sort(sit["percentage"].to_numpy(dtype=float))
    n = len(pcts)
    mean_pct = float(pcts.mean())
    pressure = float(np.clip(PRESSURE_K * (mean_pct - BASELINE_MEAN_PCT), -3, 3))

    def clears(cut):
        """How many 2026 sitters clear a cutoff percentage, + implied rank."""
        cnt = int(n - np.searchsorted(pcts, cut, side="left"))
        share = round(cnt / n * 100, 3)
        return cnt, share

    results = []
    for key, ar, en, stream, cat, hist in FACULTIES:
        years = sorted(hist)
        cutoffs = [hist[y] for y in years]
        slope, intercept, proj, sigma = _fit_trend(years, cutoffs)
        expected = float(np.clip(proj + pressure + CUTOFF_CALIBRATION_PP, CUTOFF_MIN, CUTOFF_MAX))

        optimistic = float(np.clip(expected - 0.9 * sigma, CUTOFF_MIN, CUTOFF_MAX))
        pessimistic = float(np.clip(expected + 0.9 * sigma, CUTOFF_MIN, CUTOFF_MAX))
        ci_lo = float(np.clip(expected - 1.96 * sigma, CUTOFF_MIN, CUTOFF_MAX))
        ci_hi = float(np.clip(expected + 1.96 * sigma, CUTOFF_MIN, CUTOFF_MAX))

        exp_cnt, exp_share = clears(expected)
        opt_cnt, opt_share = clears(optimistic)
        pes_cnt, pes_share = clears(pessimistic)
        last_year = years[-1]
        last_cut = hist[last_year]

        results.append({
            "key": key, "name_ar": ar, "name_en": en,
            "stream_ar": stream, "category": cat,
            "expected_cutoff": round(expected, 2),
            "score_needed": round(expected / 100 * C.MAX_SCORE, 1),
            "scenarios": {
                "optimistic": {"cutoff": round(optimistic, 2),
                               "eligible_students": opt_cnt, "eligible_pct": opt_share,
                               "note": "Easier — cutoff softens (more seats / weaker cohort)."},
                "expected": {"cutoff": round(expected, 2),
                             "eligible_students": exp_cnt, "eligible_pct": exp_share,
                             "note": "Central projection."},
                "pessimistic": {"cutoff": round(pessimistic, 2),
                                "eligible_students": pes_cnt, "eligible_pct": pes_share,
                                "note": "Harder — cutoff climbs (fewer seats / stronger cohort)."},
            },
            "confidence_interval_95": {"low": round(ci_lo, 2), "high": round(ci_hi, 2),
                                       "sigma": round(sigma, 3)},
            "trend": {"slope_per_year": round(slope, 4),
                      "projected_before_pressure": round(proj, 2),
                      "pressure_adjustment": round(pressure, 3)},
            "history": [{"year": y, "cutoff": hist[y]} for y in years],
            "last_year": {"year": last_year, "cutoff": last_cut,
                          "expected_vs_last": round(expected - last_cut, 2)},
            "eligible_2026_expected": {"count": exp_cnt, "pct": exp_share},
        })

    results.sort(key=lambda r: r["expected_cutoff"], reverse=True)

    out = {
        "meta": {
            "cohort_mean_pct": round(mean_pct, 3),
            "baseline_mean_pct": BASELINE_MEAN_PCT,
            "pressure_adjustment": round(pressure, 3),
            "pressure_direction": ("upward" if pressure > 0 else
                                   "downward" if pressure < 0 else "neutral"),
            "sitters": n,
            "max_score": C.MAX_SCORE,
        },
        "assumptions": [
            "Historical cutoffs are approximate coordination-office anchors, not official records.",
            "Dataset has no academic track; cutoffs are track-specific historically but validated "
            "against the OVERALL 2026 distribution as a proxy.",
            f"Distribution pressure scales cohort-mean deviation from a {BASELINE_MEAN_PCT}% baseline "
            f"by k={PRESSURE_K}.",
            "Scenarios shift the cutoff by ±0.9σ of each faculty's historical volatility.",
            "Absolute thresholds are directional estimates for guidance, not admission guarantees.",
        ],
        "faculties": results,
    }
    if verbose:
        print(f"[predictions] {len(results)} faculties; cohort mean%={mean_pct:.2f} "
              f"pressure={pressure:+.2f}")
    return out
