# -*- coding: utf-8 -*-
"""Pipeline orchestrator.

Runs the full ETL + analytics build:

    raw workbook -> clean -> features -> quality report
                 -> analytics -> predictions -> insights
                 -> SQLite DB + JSON artefacts

Usage:
    python -m pipeline.build            # normal build (uses caches)
    python -m pipeline.build --force    # re-read the workbook from scratch
"""
from __future__ import annotations
import os
import sys
import json
import time

from . import config as C
from .loaders import load_raw
from .clean import clean
from .features import add_features
from .quality import build_quality_report
from .analytics import build_analytics
from .predictions import build_predictions
from .insights import build_insights
from .loaddb import load_sqlite


def _write_json(path: str, obj: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[build] wrote {path} ({os.path.getsize(path)/1e6:.2f} MB)")


def main(force: bool = False):
    t0 = time.time()
    os.makedirs(C.DATA_DIR, exist_ok=True)
    print("=" * 70)
    print(" Thanaweya Amma 2026 — Analytics Pipeline Build")
    print("=" * 70)

    # 1. Load ---------------------------------------------------------------
    df_raw = load_raw(force=force)

    # 2. Clean + validate ---------------------------------------------------
    df_clean, clean_log = clean(df_raw)

    # 3. Feature engineering -----------------------------------------------
    df = add_features(df_clean)
    df.to_pickle(C.CLEAN_CACHE)
    print(f"[build] cached cleaned+engineered -> {C.CLEAN_CACHE}")

    # 4. Data quality report -----------------------------------------------
    quality = build_quality_report(df_raw, df, clean_log)
    _write_json(C.QUALITY_JSON, quality)

    # 5. Analytics / EDA ----------------------------------------------------
    analytics = build_analytics(df)

    # 6. Predictions --------------------------------------------------------
    predictions = build_predictions(df)
    _write_json(C.PREDICTIONS_JSON, predictions)

    # 7. Insights (fold into analytics payload) ----------------------------
    analytics["insights"] = build_insights(analytics, predictions)
    analytics["predictions_summary"] = {
        "meta": predictions["meta"],
        "top": [
            {"name_en": f["name_en"], "name_ar": f["name_ar"],
             "expected_cutoff": f["expected_cutoff"],
             "score_needed": f["score_needed"]}
            for f in predictions["faculties"]
        ],
    }
    _write_json(C.ANALYTICS_JSON, analytics)

    # 8. SQLite -------------------------------------------------------------
    load_sqlite(df)

    print("=" * 70)
    print(f" Build complete in {time.time() - t0:.1f}s")
    print(f"  DB:        {C.DB_PATH}")
    print(f"  Analytics: {C.ANALYTICS_JSON}")
    print(f"  Quality:   {C.QUALITY_JSON}")
    print(f"  Predict:   {C.PREDICTIONS_JSON}")
    print("=" * 70)


if __name__ == "__main__":
    main(force="--force" in sys.argv)
