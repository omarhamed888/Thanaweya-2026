# -*- coding: utf-8 -*-
"""Load the source workbook into a DataFrame, with a pickle cache.

Reading the 45 MB / 919k-row workbook with openpyxl takes ~100 seconds, so the
first successful read is cached to ``data/raw_cache.pkl``. Subsequent pipeline
runs load the cache in well under a second unless ``force`` is requested.
"""
from __future__ import annotations
import os
import time
import pandas as pd

from . import config as C


def load_raw(force: bool = False, verbose: bool = True) -> pd.DataFrame:
    """Return the raw workbook as a DataFrame with the five source columns."""
    if not force and os.path.exists(C.RAW_CACHE):
        if verbose:
            print(f"[loaders] using raw cache: {C.RAW_CACHE}")
        return pd.read_pickle(C.RAW_CACHE)

    if not os.path.exists(C.SOURCE_XLSX):
        raise FileNotFoundError(f"Source workbook not found: {C.SOURCE_XLSX}")

    if verbose:
        print(f"[loaders] reading workbook (this takes ~100s): {C.SOURCE_XLSX}")
    t0 = time.time()

    # We only need the four real data columns; the 5th (percentage) is an Excel
    # formula and is recomputed exactly from total_degree during cleaning.
    df = pd.read_excel(
        C.SOURCE_XLSX,
        engine="openpyxl",
        usecols=[C.COL_SEAT, C.COL_NAME, C.COL_SCORE, C.COL_STATUS],
        dtype={C.COL_SEAT: "Int64"},
    )
    if verbose:
        print(f"[loaders] read {len(df):,} rows in {time.time() - t0:.1f}s")

    os.makedirs(C.DATA_DIR, exist_ok=True)
    df.to_pickle(C.RAW_CACHE)
    if verbose:
        print(f"[loaders] cached raw -> {C.RAW_CACHE}")
    return df
