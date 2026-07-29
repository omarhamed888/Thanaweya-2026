# -*- coding: utf-8 -*-
"""Data Quality Report generation.

Produces a structured report: per-column missing %, duplicate %, unique value
counts, outlier detection (IQR), invalid-row accounting, and summary statistics.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from . import config as C


def _col_profile(s: pd.Series) -> dict:
    n = len(s)
    missing = int(s.isna().sum())
    return {
        "count": int(n - missing),
        "missing": missing,
        "missing_pct": round(missing / n * 100, 4) if n else 0.0,
        "unique": int(s.nunique(dropna=True)),
        "unique_pct": round(s.nunique(dropna=True) / n * 100, 4) if n else 0.0,
        "dtype": str(s.dtype),
    }


def build_quality_report(df_raw: pd.DataFrame, df_clean: pd.DataFrame,
                         clean_log: dict) -> dict:
    n = len(df_clean)

    # --- Per-column profiles (on cleaned canonical columns) ----------------
    columns = {}
    for col in ["seating_no", "name", "total_degree", "percentage", "status"]:
        columns[col] = _col_profile(df_clean[col])

    # --- Duplicates --------------------------------------------------------
    dup_seat = int(df_clean["seating_no"].duplicated(keep=False).sum())
    dup_name = int(df_clean["name"].duplicated(keep=False).sum())
    dup_name_groups = int(
        (df_clean["name"].value_counts() > 1).sum()
    )

    duplicates = {
        "exact_duplicate_rows_removed": clean_log.get("exact_duplicate_rows_removed", 0),
        "duplicate_seat_rows": dup_seat,
        "duplicate_seat_pct": round(dup_seat / n * 100, 4) if n else 0.0,
        "duplicate_name_rows": dup_name,
        "duplicate_name_pct": round(dup_name / n * 100, 4) if n else 0.0,
        "distinct_names_shared_by_multiple": dup_name_groups,
        "note_names": ("Duplicate names are expected in a national dataset "
                       "(different people share common names); seat numbers are "
                       "the true unique key."),
    }

    # --- Outliers (IQR) on the sitter score distribution -------------------
    sit_scores = df_clean.loc[df_clean["is_sitter"], "total_degree"].dropna()
    q1, q3 = np.percentile(sit_scores, [25, 75])
    iqr = q3 - q1
    lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    out_low = int((sit_scores < lo_f).sum())
    out_high = int((sit_scores > hi_f).sum())
    outliers = {
        "method": "IQR (1.5×) on exam-sitter total_degree",
        "q1": float(q1), "q3": float(q3), "iqr": float(iqr),
        "lower_fence": float(lo_f), "upper_fence": float(hi_f),
        "outliers_low": out_low,
        "outliers_high": out_high,
        "outliers_total": out_low + out_high,
        "outliers_pct": round((out_low + out_high) / len(sit_scores) * 100, 4),
    }

    # --- Invalid rows ------------------------------------------------------
    invalid = {
        "invalid_rows": clean_log.get("invalid_rows", 0),
        "invalid_pct": round(clean_log.get("invalid_rows", 0) / n * 100, 4) if n else 0.0,
        "breakdown": clean_log.get("invalid_breakdown", {}),
        "rules": [
            "missing_seat: seat number null",
            "missing_or_short_name: name null or < 3 chars",
            "missing_score: total_degree null",
            "score_below_zero: total_degree < 0",
            f"score_above_max: total_degree > {C.MAX_SCORE}",
            "passing_but_zero_score: status pass/round2 yet score is 0",
        ],
        "note": ("Flagged rows are status–score inconsistencies, not corrupt data: "
                 "students marked passed / second-round yet carrying a recorded total "
                 "of exactly 0 (score withheld or not released in this file). They are "
                 "retained in the database and in status totals, but excluded from the "
                 "ranked score distribution so a placeholder zero cannot distort ranks, "
                 "percentiles, or the mean."),
    }

    # --- Summary statistics ------------------------------------------------
    def stat_block(x: pd.Series) -> dict:
        x = x.dropna()
        return {
            "count": int(x.count()),
            "mean": round(float(x.mean()), 4),
            "std": round(float(x.std(ddof=1)), 4),
            "min": float(x.min()),
            "p25": float(np.percentile(x, 25)),
            "median": float(np.percentile(x, 50)),
            "p75": float(np.percentile(x, 75)),
            "max": float(x.max()),
        }

    summary = {
        "total_degree_all": stat_block(df_clean["total_degree"]),
        "total_degree_sitters": stat_block(df_clean.loc[df_clean["is_sitter"], "total_degree"]),
        "percentage_sitters": stat_block(df_clean.loc[df_clean["is_sitter"], "percentage"]),
    }

    # --- Status accounting -------------------------------------------------
    status_counts = df_clean["status"].value_counts().to_dict()
    status_block = {
        k: {"count": int(v), "pct": round(v / n * 100, 4),
            "label_en": C.STATUS_LABELS_EN.get(k, k),
            "label_ar": C.STATUS_LABELS_AR.get(k, k)}
        for k, v in status_counts.items()
    }

    # --- Overall quality score (0-100) -------------------------------------
    completeness = 100 - max(c["missing_pct"] for c in columns.values())
    validity = 100 - invalid["invalid_pct"]
    uniqueness = 100 - duplicates["duplicate_seat_pct"]
    overall = round((completeness + validity + uniqueness) / 3, 2)

    return {
        "generated_rows": n,
        "raw_rows": int(len(df_raw)),
        "cleaning_log": clean_log,
        "overall_quality_score": overall,
        "dimension_scores": {
            "completeness": round(completeness, 4),
            "validity": round(validity, 4),
            "uniqueness": round(uniqueness, 4),
        },
        "columns": columns,
        "duplicates": duplicates,
        "outliers": outliers,
        "invalid": invalid,
        "summary_statistics": summary,
        "status_distribution": status_block,
    }
