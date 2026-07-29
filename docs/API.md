# API Reference

Base URL: `http://127.0.0.1:8000`
Interactive docs (Swagger): `GET /docs` · OpenAPI schema: `GET /openapi.json`

All responses are JSON (UTF-8). All endpoints are read-only.

---

## Health & metadata

### `GET /api/health`
```json
{ "status": "ok", "database": true, "analytics": true }
```

### `GET /api/meta`
Platform metadata + cohort totals + a compact prediction summary.
```json
{ "meta": { "title_en": "...", "max_score": 320, ... },
  "cohort": { "total_students": 919396, "sitters": 884661, "absent": 4451, "invalid": 30284 },
  "predictions_summary": { "meta": {...}, "top": [ { "name_en": "Medicine", "expected_cutoff": 88.5, ... } ] } }
```

---

## Precomputed analytics (served from JSON)

### `GET /api/analytics`
The full analytics payload. Top-level keys include:
`meta`, `cohort`, `status_distribution`, `grade_bands_sitters`, `grade_bands_all`,
`histogram_pct`, `histogram_score`, `density_pct`, `cdf_pct`, `cdf_score`, `box_overall`,
`violin_by_status`, `stats_score`, `stats_pct`, `percentiles_score`, `percentiles_pct`,
`thresholds`, `frequency_table`, `pareto_bands`, `normality`, `normal_fit_pct`, `clusters`,
`heatmap_band_status`, `hierarchy_status_band`, `top_100`, `extremes`, `gap_analysis`,
`insights` (`{en:[], ar:[]}`), `predictions_summary`.

### `GET /api/predictions`
`{ meta, assumptions: [...], faculties: [ { key, name_en, name_ar, stream_ar, category,
expected_cutoff, score_needed, scenarios:{optimistic,expected,pessimistic},
confidence_interval_95, trend, history:[{year,cutoff}], last_year, ... } ] }`

### `GET /api/quality`
The data-quality report: `columns`, `duplicates`, `outliers`, `invalid`,
`summary_statistics`, `status_distribution`, `dimension_scores`, `overall_quality_score`.

---

## Search & records (served from SQLite)

### `GET /api/search`
Search by seat number or Arabic name.

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `q` | string | — | required, ≥ 1 char |
| `by` | `auto` \| `seat` \| `name` | `auto` | `auto` treats all-digit input as a seat |
| `page` | int | 1 | |
| `size` | int | 25 | max 100 |

Response modes: `seat_exact`, `seat_prefix`, `name`.
```json
{ "mode": "name", "total": 10524, "page": 1, "size": 25, "pages": 421,
  "rows": [ { "seating_no": 2769465, "name": "…", "total_degree": 320.0,
             "percentage": 100.0, "status": "pass_r1", "grade_band": "ge95",
             "national_rank": 1, "percentile": 100.0, "performance_index": 72.47 } ] }
```
Name search uses an **SQLite FTS5** token-prefix index on the normalized `name_key`; multiple
words are AND-combined. Seat prefixes use a numeric range on the primary key.

### `GET /api/students`
Server-side list with filtering, sorting, pagination.

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` / `size` | int | 1 / 25 | size max 200 |
| `sort` | `rank`\|`seat`\|`name`\|`score`\|`percentage`\|`percentile`\|`performance_index` | `rank` | whitelisted |
| `order` | `asc` \| `desc` | `asc` | |
| `status` | `pass_r1`\|`round2`\|`fail_r1`\|`absent` | — | |
| `band` | `ge95`\|`b90_95`\|`b80_90`\|`b70_80`\|`b60_70`\|`b50_60`\|`lt50` | — | |
| `min_pct` / `max_pct` | float | — | 0–100 |
| `sitters_only` | bool | false | |

```json
{ "page": 1, "size": 25, "total": 919396, "pages": 36776, "rows": [ ... ] }
```

### `GET /api/student/{seat}`
Full record for one seat number, including `neighbours` (±5 by national rank).
Returns **404** if the seat does not exist.

---

## Errors
Standard FastAPI error shape: `{ "detail": "..." }` with the appropriate HTTP status
(`404` unknown seat, `422` invalid params, `503` if data artefacts are missing — run
`python -m pipeline.build`).
