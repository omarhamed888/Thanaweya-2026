# Methodology

This document explains exactly how the platform transforms the raw workbook into the
analytics and predictions you see, and every assumption behind them.

---

## 0. The dataset & its central constraint

The source is a single-sheet workbook of **919,396 students** with four real columns
(`seating_no`, `arabic_name`, `total_degree`, `student_case_desc`) plus a percentage column
stored as an Excel formula (`total_degree / 320 × 100`), which we **recompute exactly**.

- Scores are **out of 320** (the 2026 "new system" total). `percentage = degree / 320 × 100`.
- **There is no academic track** (science / math / arts). This is the defining limitation and
  it shapes every downstream decision — especially predictions, where real coordination
  cutoffs are track-specific.

---

## 1. Data cleaning

| Step | Detail |
|------|--------|
| Exact duplicates | Dropped (`drop_duplicates`). None were present. |
| Type coercion | `seating_no → Int64`, `total_degree → float` (half-marks preserved). |
| Arabic display name | NFKC normalization; strip tashkeel (diacritics) & tatweel/kashida; collapse whitespace. |
| Search key | A separate `name_key`: fold `آأإٱ→ا`, `ى→ي`, `ة→ه`, `ؤ→و`, `ئ→ي`, drop bare hamza and non-letters. Makes search robust to spelling variants. |
| Status | Trailing/duplicate whitespace fixed (57,976 labels), then mapped to stable codes: `pass_r1`, `round2`, `fail_r1`, `absent`. |

---

## 2. Validation rules

Each row gets a validity flag; the **first** failing rule wins:

1. `missing_seat` — seat number null
2. `missing_or_short_name` — name null or < 3 chars
3. `missing_score` — total null
4. `score_below_zero` — total < 0
5. `score_above_max` — total > 320
6. `passing_but_zero_score` — status is passed/second-round yet total is exactly 0

Rule 6 catches ~30,284 records (a "passed" student with a recorded 0 — score withheld/not
released). These are **kept in the database and in status totals** but **excluded from the
ranked score distribution**, so a placeholder zero cannot distort ranks, percentiles, or the
mean. Absentees (legitimately 0) are excluded from ranking by cohort definition, not flagged
as invalid.

**Cohort definitions**
- *All students* — every row (used for totals & status splits).
- *Exam-sitters* — `pass_r1 ∪ round2 ∪ fail_r1` (used for the distribution).
- *Ranked cohort* — exam-sitters that are also valid (≈ 884,661) — the basis for ranks,
  percentiles, and all descriptive statistics.

---

## 3. Feature engineering

| Feature | Definition |
|---------|------------|
| `grade_band` | 95 %+, 90–95, 80–90, 70–80, 60–70, 50–60, < 50 (by percentage) |
| `national_rank` | Competition ranking (`method="min"`) over the ranked cohort, 1 = highest |
| `percentile` | Share of the cohort scoring ≤ this student, 0–100 |
| `is_top_1/5/10pct` | Percentile ≥ 99 / 95 / 90 |
| `performance_index` | **T-score**: `50 + 10 × (score − μ) / σ`, clipped 0–100 — a standardized position metric distinct from percentile |
| `score_frequency` | How many students share this exact total (score crowding) |

---

## 4. Statistics & EDA

Computed over the ranked cohort and serialized to `analytics.json`:

- **Central tendency / dispersion:** mean, median, mode, std, variance, range, IQR, CV, SEM.
- **Shape:** skewness (Fisher), excess kurtosis.
- **Percentiles:** P1, P5, P10, P25, P50, P75, P90, P95, P99 (score & percentage).
- **Distributions:** 50-bin histogram (+ best-fit Gaussian overlay), Gaussian-KDE density
  curve, empirical CDF, box plot, and per-status violins (KDE-mirrored).
- **Clustering:** K-means (k = 5) on scores → cluster centers, sizes, ranges.
- **Concentration:** exact score-frequency table (641 distinct scores), Pareto over grade
  bands, and a grade-band × status heatmap.
- **Normality:** Shapiro–Wilk (subsample), D'Agostino K², Jarque–Bera, Anderson–Darling.
  National-exam scores are bounded and skewed, so these are reported for completeness — a
  Gaussian is not assumed anywhere in the analysis.

Heavy operations (KDE, K-means, normality) run on fixed-seed subsamples where appropriate for
speed; parameters are in `pipeline/analytics.py`.

---

## 5. Admission-cutoff prediction

For each of 14 faculties we hold an approximate series of recent-year minimum-admission
percentages (illustrative coordination-office anchors). The 2026 estimate combines:

1. **Trend projection** — a linear fit of `year → cutoff`, projected to 2026, with residual
   volatility σ (floored at 0.8 pts).
2. **Distribution pressure** — the 2026 cohort mean is compared to a documented baseline; a
   small coefficient nudges cutoffs up or down:

   ```
   pressure = clip( 0.35 × (cohort_mean% − 68%), −3, +3 )
   expected = clip( trend₂₀₂₆ + pressure, 30, 99.5 )
   ```

3. **Empirical grounding** — for the resulting cutoff we read straight off the **real 2026
   distribution** how many students clear it and the implied rank.
4. **Confidence & scenarios**

   ```
   CI₉₅      = expected ± 1.96 σ
   optimistic  = expected − 0.9 σ   (easier admission)
   pessimistic = expected + 0.9 σ   (harder admission)
   ```

### Assumptions & limitations (stated plainly)

- Historical cutoffs are **approximate anchors, not official records**.
- Because the dataset has **no track**, cutoffs (which are track-specific in reality) are
  validated against the **overall** distribution as a proxy — so absolute numbers are
  **directional estimates**, not guarantees.
- The pressure model assumes admission difficulty moves with cohort strength; the 0.35
  coefficient and 68 % baseline are documented, tunable constants in `pipeline/predictions.py`.

---

## 6. Reproducibility

Everything is deterministic (fixed random seeds) and rebuildable:

```bash
python -m pipeline.build --force
```

Outputs: `data/students.db`, `data/analytics.json`, `data/predictions.json`,
`data/data_quality_report.json`.
