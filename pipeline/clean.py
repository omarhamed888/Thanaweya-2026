# -*- coding: utf-8 -*-
"""Data cleaning, standardisation and validation.

The workbook is unusually clean, so the value here is in *proving* it clean and
in the transformations that matter: Arabic text standardisation, status
normalisation, exact type coercion, a recomputed percentage, and a per-row
validity flag that encodes domain rules (e.g. an absentee may legitimately have
a zero, but a "passed" student may not).
"""
from __future__ import annotations
import re
import numpy as np
import pandas as pd

from . import config as C

# --------------------------------------------------------------------------- #
# Arabic text helpers
# --------------------------------------------------------------------------- #
# Tashkeel (diacritics), superscript alef, and tatweel/kashida.
_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟـ]")
_MULTISPACE = re.compile(r"\s+")
# Characters kept in the search key: Arabic letters + space only.
_NON_ARABIC = re.compile(r"[^ء-يٱ ]")


def standardize_display_name(s: pd.Series) -> pd.Series:
    """Clean a name for display: NFKC, drop diacritics/tatweel, tidy spaces."""
    s = s.astype("string")
    s = s.str.normalize("NFKC")
    s = s.str.replace(_DIACRITICS, "", regex=True)
    s = s.str.replace(_MULTISPACE, " ", regex=True)
    s = s.str.strip()
    return s


def normalize_search_key(s: pd.Series) -> pd.Series:
    """Aggressively fold a name into a canonical search key.

    Folds alef/hamza/ya/ta-marbuta variants so that user queries match
    regardless of how the writer spelled these ambiguous letters.
    """
    s = s.astype("string")
    # Alef family -> bare alef
    s = s.str.replace(r"[آأإٱ]", "ا", regex=True)
    # Alef maqsura -> ya
    s = s.str.replace("ى", "ي", regex=False)
    # Ta marbuta -> ha
    s = s.str.replace("ة", "ه", regex=False)
    # Hamza on waw / ya -> waw / ya
    s = s.str.replace("ؤ", "و", regex=False)
    s = s.str.replace("ئ", "ي", regex=False)
    # Bare hamza -> drop
    s = s.str.replace("ء", "", regex=False)
    s = s.str.replace(_NON_ARABIC, " ", regex=True)
    s = s.str.replace(_MULTISPACE, " ", regex=True)
    s = s.str.strip()
    return s


# --------------------------------------------------------------------------- #
# Main cleaning routine
# --------------------------------------------------------------------------- #
def clean(df_raw: pd.DataFrame, verbose: bool = True) -> tuple[pd.DataFrame, dict]:
    """Return (cleaned DataFrame, cleaning-log dict)."""
    log: dict = {}
    df = df_raw.copy()
    log["rows_in"] = int(len(df))

    # --- Drop fully-duplicate rows -----------------------------------------
    before = len(df)
    df = df.drop_duplicates()
    log["exact_duplicate_rows_removed"] = int(before - len(df))

    # --- Seat number: coerce to nullable int -------------------------------
    df[C.COL_SEAT] = pd.to_numeric(df[C.COL_SEAT], errors="coerce").astype("Int64")

    # --- Score: coerce to float, keep half marks ---------------------------
    df[C.COL_SCORE] = pd.to_numeric(df[C.COL_SCORE], errors="coerce")

    # --- Name standardisation ----------------------------------------------
    df["name"] = standardize_display_name(df[C.COL_NAME])
    df["name_key"] = normalize_search_key(df["name"])
    df["name_word_count"] = df["name"].str.split().map(
        lambda x: len(x) if isinstance(x, list) else 0
    )

    # --- Status normalisation ----------------------------------------------
    status_stripped = df[C.COL_STATUS].astype("string").str.strip()
    status_stripped = status_stripped.str.replace(_MULTISPACE, " ", regex=True)
    df["status_ar_raw"] = df[C.COL_STATUS]
    df["status"] = status_stripped.map(C.STATUS_MAP).fillna(C.STATUS_UNKNOWN)
    log["status_trailing_ws_fixed"] = int(
        (df[C.COL_STATUS].astype("string") != status_stripped).sum()
    )

    # --- Recompute percentage exactly --------------------------------------
    df["percentage"] = (df[C.COL_SCORE] / C.MAX_SCORE * 100).round(4)

    # --- Cohort flag --------------------------------------------------------
    df["is_sitter"] = df["status"].isin(C.SITTER_STATUSES)

    # --- Rename canonical columns ------------------------------------------
    df = df.rename(columns={C.COL_SEAT: "seating_no", C.COL_SCORE: "total_degree"})

    # --- Validation rules ---------------------------------------------------
    reasons = _validity_reasons(df)
    df["invalid_reason"] = reasons
    df["is_valid"] = reasons.eq("")

    log["rows_out"] = int(len(df))
    log["invalid_rows"] = int((~df["is_valid"]).sum())
    log["invalid_breakdown"] = (
        df.loc[~df["is_valid"], "invalid_reason"].value_counts().to_dict()
    )

    # Final column order
    cols = [
        "seating_no", "name", "name_key", "name_word_count",
        "total_degree", "percentage",
        "status", "status_ar_raw", "is_sitter",
        "is_valid", "invalid_reason",
    ]
    df = df[cols].reset_index(drop=True)
    if verbose:
        print(f"[clean] {log['rows_in']:,} -> {log['rows_out']:,} rows; "
              f"{log['invalid_rows']:,} flagged invalid")
    return df, log


def _validity_reasons(df: pd.DataFrame) -> pd.Series:
    """Compute a per-row validity reason ('' means valid). First failing rule wins."""
    n = len(df)
    reason = np.full(n, "", dtype=object)

    seat = df[C.COL_SEAT] if C.COL_SEAT in df.columns else df["seating_no"]
    score = df[C.COL_SCORE] if C.COL_SCORE in df.columns else df["total_degree"]
    name = df["name"]
    status = df["status"]

    def set_reason(mask, text):
        m = mask.to_numpy() if hasattr(mask, "to_numpy") else np.asarray(mask)
        empty = reason == ""
        reason[m & empty] = text

    set_reason(seat.isna(), "missing_seat")
    set_reason(name.isna() | (name.astype("string").str.len() < 3), "missing_or_short_name")
    set_reason(score.isna(), "missing_score")
    set_reason(score < 0, "score_below_zero")
    set_reason(score > C.MAX_SCORE, "score_above_max")
    # Domain consistency: a passing/round-2 student cannot have a zero total.
    set_reason((status.isin([C.STATUS_PASS, C.STATUS_ROUND2])) & (score <= 0),
               "passing_but_zero_score")
    return pd.Series(reason, index=df.index)
