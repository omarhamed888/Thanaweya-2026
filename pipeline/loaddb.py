# -*- coding: utf-8 -*-
"""Load the cleaned + engineered dataset into an indexed SQLite database.

The DB backs the fast server-side search / pagination / sorting endpoints over
~919k rows. Seat number is the primary key; a normalised ``name_key`` column
plus indexes on score and rank keep every query sub-second.
"""
from __future__ import annotations
import os
import sqlite3
import time
import numpy as np
import pandas as pd

from . import config as C

SCHEMA = """
CREATE TABLE students (
    seating_no        INTEGER PRIMARY KEY,
    name              TEXT NOT NULL,
    name_key          TEXT NOT NULL,
    total_degree      REAL NOT NULL,
    percentage        REAL NOT NULL,
    status            TEXT NOT NULL,
    grade_band        TEXT NOT NULL,
    national_rank     INTEGER,
    percentile        REAL,
    performance_index REAL,
    score_frequency   INTEGER,
    is_sitter         INTEGER NOT NULL,
    is_top_1pct       INTEGER NOT NULL,
    is_top_5pct       INTEGER NOT NULL,
    is_top_10pct      INTEGER NOT NULL
);
"""

INDEXES = [
    "CREATE INDEX idx_score ON students(total_degree DESC);",
    "CREATE INDEX idx_rank ON students(national_rank);",
    "CREATE INDEX idx_namekey ON students(name_key);",
    "CREATE INDEX idx_status ON students(status);",
    "CREATE INDEX idx_band ON students(grade_band);",
    "CREATE INDEX idx_pct ON students(percentage DESC);",
]

COLS = [
    "seating_no", "name", "name_key", "total_degree", "percentage", "status",
    "grade_band", "national_rank", "percentile", "performance_index",
    "score_frequency", "is_sitter", "is_top_1pct", "is_top_5pct", "is_top_10pct",
]


def _row_iter(df: pd.DataFrame):
    def nz(v):
        if v is None:
            return None
        if isinstance(v, float) and (np.isnan(v)):
            return None
        return v
    for t in df[COLS].itertuples(index=False, name=None):
        seat, name, key, deg, pct, status, band, rank, perc, pi, sf, sit, t1, t5, t10 = t
        yield (
            int(seat), str(name), str(key), float(deg), float(pct), str(status),
            str(band),
            None if pd.isna(rank) else int(rank),
            None if pd.isna(perc) else float(perc),
            None if pd.isna(pi) else float(pi),
            None if pd.isna(sf) else int(sf),
            int(bool(sit)), int(bool(t1)), int(bool(t5)), int(bool(t10)),
        )


def load_sqlite(df: pd.DataFrame, verbose: bool = True) -> str:
    if os.path.exists(C.DB_PATH):
        os.remove(C.DB_PATH)
    t0 = time.time()
    con = sqlite3.connect(C.DB_PATH)
    cur = con.cursor()
    cur.execute("PRAGMA journal_mode=OFF;")
    cur.execute("PRAGMA synchronous=OFF;")
    cur.executescript(SCHEMA)

    placeholders = ",".join(["?"] * len(COLS))
    cur.execute("BEGIN;")
    cur.executemany(f"INSERT INTO students VALUES ({placeholders});", _row_iter(df))
    con.commit()

    for stmt in INDEXES:
        cur.execute(stmt)
    con.commit()

    # Full-text index on the normalised name key for fast token/prefix search.
    cur.execute(
        "CREATE VIRTUAL TABLE students_fts USING fts5("
        "name_key, content='students', content_rowid='seating_no', "
        "tokenize='unicode61');")
    cur.execute(
        "INSERT INTO students_fts(rowid, name_key) "
        "SELECT seating_no, name_key FROM students;")
    con.commit()

    cur.execute("PRAGMA optimize;")
    con.commit()
    n = cur.execute("SELECT COUNT(*) FROM students;").fetchone()[0]
    con.close()
    if verbose:
        size_mb = os.path.getsize(C.DB_PATH) / 1e6
        print(f"[loaddb] wrote {n:,} rows -> {C.DB_PATH} "
              f"({size_mb:.1f} MB) in {time.time() - t0:.1f}s")
    return C.DB_PATH
