# -*- coding: utf-8 -*-
"""Central configuration for the Thanaweya Amma 2026 analytics pipeline.

Everything downstream (cleaning, features, analytics, predictions, DB load,
and the API) imports its constants from here so that a single source of truth
governs the whole platform.
"""
from __future__ import annotations
import os

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(PIPELINE_DIR)
DATA_DIR = os.path.join(PROJECT_DIR, "data")

# Source workbook lives one directory up from the project (next to it).
SOURCE_XLSX = os.path.abspath(
    os.path.join(PROJECT_DIR, "..", "نتيجة ثانوية عامة نظام حديث.xlsx")
)

RAW_CACHE = os.path.join(DATA_DIR, "raw_cache.pkl")          # fast re-load cache
CLEAN_CACHE = os.path.join(DATA_DIR, "clean_cache.pkl")      # cleaned + engineered
DB_PATH = os.path.join(DATA_DIR, "students.db")
ANALYTICS_JSON = os.path.join(DATA_DIR, "analytics.json")
QUALITY_JSON = os.path.join(DATA_DIR, "data_quality_report.json")
PREDICTIONS_JSON = os.path.join(DATA_DIR, "predictions.json")

# --------------------------------------------------------------------------- #
# Domain constants
# --------------------------------------------------------------------------- #
# Egyptian Thanaweya Amma 2026 "النظام الحديث" (new system) total marks.
MAX_SCORE = 320

# Raw column names as they appear in the workbook.
COL_SEAT = "seating_no"
COL_NAME = "arabic_name"
COL_SCORE = "total_degree"
COL_STATUS = "student_case_desc"
COL_PCT_RAW = "النسبة المئوية"  # stored as an Excel formula; recomputed here

# Canonical status codes. Raw Arabic labels (some carry trailing whitespace)
# are normalised into these stable machine keys.
STATUS_PASS = "pass_r1"        # ناجح دور أول
STATUS_ROUND2 = "round2"       # دور ثان
STATUS_FAIL = "fail_r1"        # راسب دور أول
STATUS_ABSENT = "absent"       # غياب كلى دور أول
STATUS_UNKNOWN = "unknown"

STATUS_MAP = {
    "ناجح دور أول": STATUS_PASS,
    "دور ثان": STATUS_ROUND2,
    "دور ثانى": STATUS_ROUND2,
    "راسب دور أول": STATUS_FAIL,
    "غياب كلى دور أول": STATUS_ABSENT,
    "غياب كلي دور أول": STATUS_ABSENT,
}

STATUS_LABELS_AR = {
    STATUS_PASS: "ناجح (الدور الأول)",
    STATUS_ROUND2: "دور ثانٍ",
    STATUS_FAIL: "راسب (الدور الأول)",
    STATUS_ABSENT: "غياب كلي",
    STATUS_UNKNOWN: "غير معروف",
}
STATUS_LABELS_EN = {
    STATUS_PASS: "Passed (Round 1)",
    STATUS_ROUND2: "Second Round",
    STATUS_FAIL: "Failed (Round 1)",
    STATUS_ABSENT: "Absent",
    STATUS_UNKNOWN: "Unknown",
}

# A student is considered an "exam sitter" (part of the analytical cohort used
# for the score distribution / ranking) when they were not fully absent.
SITTER_STATUSES = {STATUS_PASS, STATUS_ROUND2, STATUS_FAIL}

# --------------------------------------------------------------------------- #
# Grade categories (by percentage). Ordered high -> low.
# Each entry: key, arabic label, english label, low (inclusive), high (exclusive
# except the top band which is inclusive of 100).
# --------------------------------------------------------------------------- #
GRADE_BANDS = [
    ("ge95", "95% فأكثر", "95%+", 95.0, 100.0001),
    ("b90_95", "90% - 95%", "90–95%", 90.0, 95.0),
    ("b80_90", "80% - 90%", "80–90%", 80.0, 90.0),
    ("b70_80", "70% - 80%", "70–80%", 70.0, 80.0),
    ("b60_70", "60% - 70%", "60–70%", 60.0, 70.0),
    ("b50_60", "50% - 60%", "50–60%", 50.0, 60.0),
    ("lt50", "أقل من 50%", "Below 50%", -0.0001, 50.0),
]

# Percentage thresholds used for the "students above X%" analytics.
PCT_THRESHOLDS = [95, 90, 85, 80, 75, 70, 65, 60, 50]

# Percentiles reported in the statistical analysis.
REPORTED_PERCENTILES = [1, 5, 10, 25, 50, 75, 90, 95, 99]

# Histogram configuration for the percentage distribution.
HIST_BINS = 50

PLATFORM_META = {
    "title_en": "Thanaweya Amma 2026 Analytics",
    "title_ar": "تحليلات الثانوية العامة 2026",
    "system": "النظام الحديث (New System)",
    "max_score": MAX_SCORE,
    "source_file": os.path.basename(SOURCE_XLSX),
}
