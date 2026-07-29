# -*- coding: utf-8 -*-
"""FastAPI application for the Thanaweya Amma 2026 analytics platform.

Serves precomputed analytics JSON plus fast, server-side search / pagination /
sorting over the ~919k-row SQLite database, and hosts the static frontend.
"""
from __future__ import annotations
import json
import mimetypes
import os
from functools import lru_cache

# Windows registry sometimes maps .js -> text/plain, which breaks ES module
# loading (strict MIME checks). Force correct types before StaticFiles mounts.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/json", ".json")

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from . import db

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "data")
FRONTEND_DIR = os.path.join(BASE, "frontend")

app = FastAPI(
    title="Thanaweya Amma 2026 Analytics API",
    version="1.0.0",
    description="Analytics, search and admission-prediction API for the "
                "Egyptian Thanaweya Amma 2026 results (new system).",
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@lru_cache(maxsize=8)
def _load_json(name: str) -> str:
    path = os.path.join(DATA_DIR, name)
    if not os.path.exists(path):
        raise HTTPException(503, f"{name} not found — run: python -m pipeline.build")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _json_file_response(name: str) -> JSONResponse:
    # Serve the precomputed file verbatim (already valid JSON) — no re-encode.
    return JSONResponse(content=json.loads(_load_json(name)))


# --------------------------------------------------------------------------- #
# API routes
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    ok = os.path.exists(db.DB_PATH)
    return {"status": "ok" if ok else "degraded", "database": ok,
            "analytics": os.path.exists(os.path.join(DATA_DIR, "analytics.json"))}


@app.get("/api/analytics")
def analytics():
    return _json_file_response("analytics.json")


@app.get("/api/quality")
def quality():
    return _json_file_response("data_quality_report.json")


@app.get("/api/predictions")
def predictions():
    return _json_file_response("predictions.json")


@app.get("/api/meta")
def meta():
    a = json.loads(_load_json("analytics.json"))
    return {"meta": a["meta"], "cohort": a["cohort"],
            "predictions_summary": a.get("predictions_summary")}


@app.get("/api/students")
def students(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=200),
    sort: str = "rank",
    order: str = "asc",
    status: str | None = None,
    band: str | None = None,
    min_pct: float | None = Query(None, ge=0, le=100),
    max_pct: float | None = Query(None, ge=0, le=100),
    sitters_only: bool = False,
):
    return db.list_students(page, size, sort, order, status, band,
                            min_pct, max_pct, sitters_only)


@app.get("/api/search")
def search(
    q: str = Query(..., min_length=1),
    by: str = Query("auto", pattern="^(auto|seat|name)$"),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
):
    return db.search(q, by, page, size)


@app.get("/api/student/{seat}")
def student(seat: int):
    s = db.get_student(seat)
    if s is None:
        raise HTTPException(404, f"No student with seat number {seat}")
    return s


# --------------------------------------------------------------------------- #
# Static frontend
# --------------------------------------------------------------------------- #
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")),
              name="assets")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{path:path}")
    def spa(path: str):
        # SPA fallback: serve real files if present, else index.html.
        candidate = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
