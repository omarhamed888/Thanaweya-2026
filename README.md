# 🎓 Thanaweya Amma 2026 — Analytics Platform

A production-grade analytics platform for the **Egyptian Thanaweya Amma 2026** results
(**النظام الحديث / new system**). It turns a raw 45 MB / **919,396-student** workbook into a
clean database, a full statistical analysis, university-admission forecasts, and a
premium bilingual (Arabic / English) dashboard with instant search.

> **Not a toy dashboard.** It ships a real data-engineering pipeline, a data-quality
> report, statistical + predictive analytics, a FastAPI backend over an indexed SQLite
> database (FTS5 full-text search), and a responsive glassmorphism SPA — all runnable
> offline with one command.

---

## ✨ Features

| Area | What's included |
|------|-----------------|
| **Data Cleaning** | Exact-duplicate removal, Arabic text standardization (NFKC, diacritic/tatweel stripping, alef/hamza/ya/ta-marbuta folding), whitespace normalization, strict type coercion |
| **Validation** | Per-row rules (missing fields, impossible grades, status–score inconsistencies) + a full **Data Quality Report** (missing %, duplicate %, unique counts, outliers, invalid rows, summary stats) |
| **Feature Engineering** | Grade bands, national rank, percentile, top-1/5/10 % flags, T-score performance index, score-frequency density |
| **Statistics / EDA** | Mean · median · mode · std · variance · skewness · kurtosis · 9 percentiles · KDE density · CDF · box & violin · **K-means** clusters · Pareto · heatmap · **4 normality tests** |
| **Predictions** | 2026 admission-cutoff estimates for **14 faculties** with Optimistic / Expected / Pessimistic scenarios, 95 % confidence intervals, historical trends |
| **Search** | Sub-millisecond seat lookup + FTS5 name search over 919 k students, with paginated results and per-student profiles |
| **UI** | 8 dashboard pages + 4 site pages, glassmorphism, dark/light, RTL/LTR, animations, 15+ chart types (Plotly), CSV / Excel / PDF export |

### Dashboard pages
`Overview` · `Score Distribution` · `Top Performers` · `Statistical Analysis` ·
`Predictions` · `University Admission` · `Student Search` · `Data Quality`

### Website pages
`Home` · `About` · `Methodology` · `FAQ`

---

## 🚀 Quick start

**Prerequisites:** Python 3.10+ and the source workbook
`نتيجة ثانوية عامة نظام حديث.xlsx` in the parent directory (one level above this folder).

```powershell
# 1. install dependencies
pip install -r requirements.txt

# 2. build data + serve (first run reads the workbook, ~2-3 min; later runs are instant)
./run.ps1
```

Then open <http://127.0.0.1:8000>.

<details>
<summary>Manual steps (any OS)</summary>

```bash
pip install -r requirements.txt
python -m pipeline.build          # ETL + analytics + predictions + SQLite
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
</details>

Force a full rebuild (re-reads the workbook): `./run.ps1 -Build` or
`python -m pipeline.build --force`.

---

## 🏗 Architecture

```
Excel workbook (919k rows, score out of 320)
        │
        ▼   pipeline/  (pandas · numpy · scipy · scikit-learn)
  clean → validate → feature-engineer → quality report
        → EDA/statistics → predictions → AI insights
        │
        ├── data/students.db      (indexed SQLite + FTS5 name index)
        ├── data/analytics.json   (all precomputed EDA/stats/insights)
        ├── data/predictions.json (faculty cutoffs + scenarios)
        └── data/data_quality_report.json
        │
        ▼   backend/  (FastAPI)
  /api/analytics · /api/search · /api/students · /api/student/{seat}
  /api/predictions · /api/quality  +  static frontend
        │
        ▼   frontend/  (Preact + htm + Plotly, no build step)
  glassmorphism SPA · dark/light · Arabic/English · responsive
```

**Design choice:** heavy analytics are computed **once** at build time into JSON, so the API
only serves precomputed results; the 919 k-row table lives in **SQLite** so search /
pagination / sorting stay server-side and fast. The frontend uses **vendored** Preact +
Plotly (no `npm install`, no CDN) so it runs fully offline.

---

## 📁 Project structure

```
thanaweya-analytics/
├── pipeline/                # Python ETL + analytics
│   ├── config.py            # single source of truth (paths, bands, thresholds)
│   ├── loaders.py           # workbook → DataFrame (+ pickle cache)
│   ├── clean.py             # cleaning, Arabic normalization, validation rules
│   ├── features.py          # rank, percentile, grade band, performance index
│   ├── quality.py           # Data Quality Report
│   ├── analytics.py         # EDA + statistics → analytics.json
│   ├── predictions.py       # admission-cutoff models + scenarios
│   ├── insights.py          # bilingual auto-generated narrative
│   ├── loaddb.py            # indexed SQLite + FTS5 loader
│   └── build.py             # orchestrator (python -m pipeline.build)
├── backend/                 # FastAPI service
│   ├── main.py              # routes + static hosting
│   └── db.py                # SQLite data-access (search/list/detail)
├── frontend/                # Preact + Plotly SPA
│   ├── index.html
│   └── assets/{css,js,vendor}/
├── data/                    # generated artefacts (gitignored)
├── docs/                    # METHODOLOGY.md · API.md
├── requirements.txt
└── run.ps1
```

---

## 📊 Dataset notes

- **919,396** students; columns: name, seat number, total degree (**out of 320**), status.
- Percentage = `total_degree ÷ 320 × 100`.
- **No academic track** (science / math / arts) — the whole platform is designed around this
  limitation (see [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md)).
- Status split: passed R1 70.8 % · second round 22.9 % · failed 5.8 % · absent 0.5 %.
- ~30 k records are marked passed/second-round yet carry a recorded 0 — treated as
  status–score inconsistencies: kept in totals, excluded from the ranked distribution.

---

## 🔌 API summary

| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics` | All precomputed EDA / statistics / insights |
| `GET /api/predictions` | Faculty cutoff estimates + scenarios |
| `GET /api/quality` | Data quality report |
| `GET /api/meta` | Platform meta + cohort totals |
| `GET /api/search?q=&by=&page=&size=` | Search by seat or name |
| `GET /api/students?page=&size=&sort=&order=&status=&band=…` | Server-side list |
| `GET /api/student/{seat}` | Single student + rank neighbours |

Full details in [`docs/API.md`](docs/API.md). Interactive docs at `/docs` (Swagger UI).

---

## 🧰 Tech stack

**Backend/Data:** Python · FastAPI · Pandas · NumPy · SciPy · scikit-learn · SQLite (FTS5)
**Frontend:** Preact + htm (React-compatible, no build) · Plotly.js · custom CSS design system

---

## ⚠️ Disclaimer

Admission-cutoff figures are **statistical estimates for guidance only**, not official
coordination-office thresholds. Because the dataset has no academic track, faculty cutoffs
are anchored to historical figures and validated against the overall distribution as a
proxy. See the Methodology and FAQ pages for every assumption.

*Built as a portfolio-grade analytics platform · v1.0 · 2026.*
