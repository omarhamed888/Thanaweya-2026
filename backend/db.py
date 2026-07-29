# -*- coding: utf-8 -*-
"""SQLite data-access layer for the API.

All queries are read-only and parameterised. Sort columns are whitelisted to
prevent injection. A per-thread connection keeps concurrent reads cheap.
"""
from __future__ import annotations
import os
import re
import sqlite3
import threading

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "data", "students.db")

_local = threading.local()

# Columns clients may sort by -> real SQL columns.
SORT_COLUMNS = {
    "rank": "national_rank",
    "seat": "seating_no",
    "name": "name",
    "score": "total_degree",
    "percentage": "percentage",
    "percentile": "percentile",
    "performance_index": "performance_index",
}

STATUS_KEYS = {"pass_r1", "round2", "fail_r1", "absent"}
BAND_KEYS = {"ge95", "b90_95", "b80_90", "b70_80", "b60_70", "b50_60", "lt50"}
SEAT_DIGITS = 7  # all seat numbers are 7 digits (2001970..2993862)

_MULTISPACE = re.compile(r"\s+")
_NON_ARABIC = re.compile(r"[^ء-يٱ ]")


def normalize_query(q: str) -> str:
    """Fold an Arabic search string the same way the stored name_key was built."""
    if q is None:
        return ""
    q = q.strip()
    for a, b in (("آ", "ا"), ("أ", "ا"), ("إ", "ا"), ("ٱ", "ا"),
                 ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي"), ("ء", "")):
        q = q.replace(a, b)
    q = _NON_ARABIC.sub(" ", q)
    q = _MULTISPACE.sub(" ", q).strip()
    return q


def get_conn() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        if not os.path.exists(DB_PATH):
            raise FileNotFoundError(
                f"Database not found at {DB_PATH}. Run: python -m pipeline.build")
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only=ON;")
        conn.execute("PRAGMA cache_size=-40000;")  # ~40MB page cache
        _local.conn = conn
    return conn


def _row_to_dict(r: sqlite3.Row) -> dict:
    return {k: r[k] for k in r.keys()}


def get_student(seat: int) -> dict | None:
    row = get_conn().execute(
        "SELECT * FROM students WHERE seating_no = ?", (seat,)
    ).fetchone()
    if row is None:
        return None
    d = _row_to_dict(row)
    # Neighbours by rank (context around the student), sitters only.
    if d.get("national_rank"):
        rk = d["national_rank"]
        nb = get_conn().execute(
            "SELECT seating_no,name,total_degree,percentage,national_rank "
            "FROM students WHERE national_rank BETWEEN ? AND ? "
            "ORDER BY national_rank LIMIT 11",
            (max(1, rk - 5), rk + 5)).fetchall()
        d["neighbours"] = [_row_to_dict(x) for x in nb]
    return d


def _build_filters(status=None, band=None, min_pct=None, max_pct=None,
                   sitters_only=False):
    clauses, params = [], []
    if status and status in STATUS_KEYS:
        clauses.append("status = ?"); params.append(status)
    if band and band in BAND_KEYS:
        clauses.append("grade_band = ?"); params.append(band)
    if min_pct is not None:
        clauses.append("percentage >= ?"); params.append(float(min_pct))
    if max_pct is not None:
        clauses.append("percentage <= ?"); params.append(float(max_pct))
    if sitters_only:
        clauses.append("is_sitter = 1")
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def list_students(page=1, size=25, sort="rank", order="asc",
                  status=None, band=None, min_pct=None, max_pct=None,
                  sitters_only=False) -> dict:
    page = max(1, int(page))
    size = min(200, max(1, int(size)))
    sort_col = SORT_COLUMNS.get(sort, "national_rank")
    order = "DESC" if str(order).lower() == "desc" else "ASC"
    where, params = _build_filters(status, band, min_pct, max_pct, sitters_only)

    conn = get_conn()
    total = conn.execute(f"SELECT COUNT(*) AS c FROM students{where}", params).fetchone()["c"]
    # NULLs (unranked) always sort last.
    null_order = "IS NULL, " if sort_col in ("national_rank", "percentile", "performance_index") else ""
    offset = (page - 1) * size
    rows = conn.execute(
        f"SELECT seating_no,name,total_degree,percentage,status,grade_band,"
        f"national_rank,percentile,performance_index "
        f"FROM students{where} ORDER BY {sort_col} {null_order}{order} "
        f"LIMIT ? OFFSET ?",
        params + [size, offset]).fetchall()
    return {
        "page": page, "size": size, "total": total,
        "pages": (total + size - 1) // size,
        "rows": [_row_to_dict(r) for r in rows],
    }


def search(q: str, by="auto", page=1, size=25) -> dict:
    page = max(1, int(page))
    size = min(100, max(1, int(size)))
    offset = (page - 1) * size
    conn = get_conn()
    q = (q or "").strip()
    if not q:
        return {"mode": "empty", "total": 0, "rows": [], "page": page, "size": size, "pages": 0}

    digits = re.sub(r"\D", "", q)
    use_seat = by == "seat" or (by == "auto" and digits and len(digits) >= 3
                                and re.fullmatch(r"\d+", q.replace(" ", "")))

    if use_seat:
        # Exact seat first.
        exact = conn.execute("SELECT * FROM students WHERE seating_no = ?",
                             (int(digits),)).fetchone()
        if exact:
            return {"mode": "seat_exact", "total": 1, "page": 1, "size": size,
                    "pages": 1, "rows": [_row_to_dict(exact)]}
        # Seat numbers are all 7 digits -> a prefix is a numeric range on the PK.
        L = len(digits)
        if L == 0 or L > SEAT_DIGITS:
            return {"mode": "seat_prefix", "total": 0, "rows": [], "page": page,
                    "size": size, "pages": 0}
        span = 10 ** (SEAT_DIGITS - L)
        lo = int(digits) * span
        hi = lo + span - 1
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM students WHERE seating_no BETWEEN ? AND ?",
            (lo, hi)).fetchone()["c"]
        rows = conn.execute(
            "SELECT * FROM students WHERE seating_no BETWEEN ? AND ? "
            "ORDER BY seating_no LIMIT ? OFFSET ?",
            (lo, hi, size, offset)).fetchall()
        return {"mode": "seat_prefix", "total": total, "page": page, "size": size,
                "pages": (total + size - 1) // size,
                "rows": [_row_to_dict(r) for r in rows]}

    # Name search via FTS5 (token prefix match on the normalised key).
    key = normalize_query(q)
    if len(key) < 2:
        return {"mode": "name", "total": 0, "rows": [], "page": page, "size": size, "pages": 0}
    tokens = [t for t in key.split() if t]
    match_expr = " ".join(f"{t}*" for t in tokens)  # AND of prefix tokens
    try:
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM students_fts WHERE students_fts MATCH ?",
            (match_expr,)).fetchone()["c"]
        rows = conn.execute(
            "SELECT s.seating_no,s.name,s.total_degree,s.percentage,s.status,"
            "s.grade_band,s.national_rank,s.percentile,s.performance_index "
            "FROM students_fts f JOIN students s ON s.seating_no = f.rowid "
            "WHERE f.students_fts MATCH ? "
            "ORDER BY (s.national_rank IS NULL), s.national_rank LIMIT ? OFFSET ?",
            (match_expr, size, offset)).fetchall()
    except Exception:
        return {"mode": "name", "total": 0, "rows": [], "page": page, "size": size,
                "pages": 0, "error": "query_failed"}
    return {"mode": "name", "query_key": key, "total": total, "page": page,
            "size": size, "pages": (total + size - 1) // size,
            "rows": [_row_to_dict(r) for r in rows]}
