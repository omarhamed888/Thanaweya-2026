# -*- coding: utf-8 -*-
"""One-time migration: local SQLite (data/students.db) -> Neon Postgres.

Feeds the Vercel search API (api/search.js, api/student.js), which needs a
serverless-reachable copy of the ranked-cohort student table. Status and
grade-band are stored as smallint codes (not text) to keep the free-tier
500MB budget: see STATUS_CODES / BAND_CODES below, mirrored in the JS API.

Usage:
    python scripts/migrate_to_postgres.py <path-to-connection-string-file>
"""
from __future__ import annotations
import sys
import sqlite3
import psycopg2
import psycopg2.extras

STATUS_CODES = {"pass_r1": 0, "round2": 1, "fail_r1": 2, "absent": 3, "unknown": 4}
BAND_CODES = {"ge95": 0, "b90_95": 1, "b80_90": 2, "b70_80": 3, "b60_70": 4, "b50_60": 5, "lt50": 6}

SCHEMA = """
DROP TABLE IF EXISTS students;
CREATE TABLE students (
    seating_no        INTEGER PRIMARY KEY,
    name              TEXT NOT NULL,
    name_key          TEXT NOT NULL,
    total_degree      REAL NOT NULL,
    percentage        REAL NOT NULL,
    status            SMALLINT NOT NULL,
    grade_band        SMALLINT NOT NULL,
    national_rank     INTEGER,
    percentile        REAL,
    performance_index REAL
);
"""

INDEXES = [
    "CREATE INDEX idx_rank ON students(national_rank);",
    "CREATE INDEX idx_name_tsv ON students USING gin(to_tsvector('simple', name_key));",
]


def main(conn_file: str):
    pg_conn_str = open(conn_file, encoding="utf-8").read().strip()

    sconn = sqlite3.connect("data/students.db")
    sconn.row_factory = sqlite3.Row
    total = sconn.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    print(f"[migrate] {total:,} rows in source SQLite")

    pconn = psycopg2.connect(pg_conn_str, connect_timeout=20)
    pcur = pconn.cursor()
    print("[migrate] creating schema...")
    pcur.execute(SCHEMA)
    pconn.commit()

    rows_iter = sconn.execute(
        "SELECT seating_no, name, name_key, total_degree, percentage, status, "
        "grade_band, national_rank, percentile, performance_index FROM students"
    )
    batch = []
    n = 0
    BATCH_SIZE = 5000
    insert_sql = (
        "INSERT INTO students (seating_no, name, name_key, total_degree, percentage, "
        "status, grade_band, national_rank, percentile, performance_index) VALUES %s"
    )
    for r in rows_iter:
        batch.append((
            r["seating_no"], r["name"], r["name_key"], r["total_degree"], r["percentage"],
            STATUS_CODES.get(r["status"], 4), BAND_CODES.get(r["grade_band"], 6),
            r["national_rank"], r["percentile"], r["performance_index"],
        ))
        if len(batch) >= BATCH_SIZE:
            psycopg2.extras.execute_values(pcur, insert_sql, batch, page_size=BATCH_SIZE)
            pconn.commit()
            n += len(batch)
            print(f"[migrate] inserted {n:,}/{total:,}", end="\r")
            batch = []
    if batch:
        psycopg2.extras.execute_values(pcur, insert_sql, batch, page_size=BATCH_SIZE)
        pconn.commit()
        n += len(batch)
    print(f"\n[migrate] inserted {n:,} rows total")

    print("[migrate] building indexes...")
    for stmt in INDEXES:
        pcur.execute(stmt)
        pconn.commit()

    pcur.execute("SELECT pg_size_pretty(pg_database_size(current_database()));")
    print(f"[migrate] final DB size: {pcur.fetchone()[0]}")
    pcur.execute("SELECT COUNT(*) FROM students;")
    print(f"[migrate] rows in Postgres: {pcur.fetchone()[0]:,}")

    pconn.close()
    sconn.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".pg_conn.local")
