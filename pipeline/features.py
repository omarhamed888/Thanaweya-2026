# -*- coding: utf-8 -*-
"""Feature engineering.

Adds the calculated fields the analytics and UI rely on: grade band, national
rank, percentile, top-N flags, a T-score style performance index, and a score
crowding ("density") measure. Ranking is computed over the *exam-sitter* cohort
so that the ~0.5% fully-absent students (score 0) do not distort positions.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from . import config as C


def _grade_band(pct: pd.Series) -> pd.Series:
    """Map a percentage to a grade-band key (vectorised)."""
    # Build with numpy.select, high band first.
    conds, choices = [], []
    for key, _ar, _en, lo, hi in C.GRADE_BANDS:
        conds.append((pct >= lo) & (pct < hi))
        choices.append(key)
    return pd.Series(np.select(conds, choices, default=C.GRADE_BANDS[-1][0]),
                     index=pct.index)


def add_features(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    df = df.copy()

    # --- Grade band (all rows, by percentage) ------------------------------
    df["grade_band"] = _grade_band(df["percentage"])

    # --- Ranking within the exam-sitter cohort -----------------------------
    sit = df["is_sitter"] & df["is_valid"]
    score = df["total_degree"]

    # National rank: 1 = highest score, ties share the smallest rank.
    rank = score.where(sit).rank(ascending=False, method="min")
    df["national_rank"] = rank.astype("Int64")

    # Percentile (0–100): share of the cohort scoring at or below this student.
    pr = score.where(sit).rank(pct=True, method="max") * 100.0
    df["percentile"] = pr.round(4)

    n_sit = int(sit.sum())
    df["cohort_size"] = n_sit

    # Top-N flags (by percentile within the sitter cohort).
    df["is_top_1pct"] = df["percentile"] >= 99.0
    df["is_top_5pct"] = df["percentile"] >= 95.0
    df["is_top_10pct"] = df["percentile"] >= 90.0

    # --- Performance index: T-score (mean 50, sd 10) over sitters ----------
    s_scores = score[sit]
    mu, sd = float(s_scores.mean()), float(s_scores.std(ddof=0))
    if sd == 0:
        sd = 1.0
    tscore = 50.0 + 10.0 * (score - mu) / sd
    df["performance_index"] = tscore.where(sit).clip(0, 100).round(2)

    # --- Score density: how many students share this exact total -----------
    freq = df.loc[sit, "total_degree"].value_counts()
    df["score_frequency"] = df["total_degree"].map(freq).astype("Int64")

    if verbose:
        print(f"[features] ranked cohort n={n_sit:,}; mean={mu:.2f} sd={sd:.2f}")
    return df
