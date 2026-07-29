// Shared Neon Postgres helpers for the search API functions.
// Mirrors backend/db.py's normalization + code maps, over the students table
// created by scripts/migrate_to_postgres.py (status/grade_band as smallint
// codes to keep the free-tier Postgres storage budget small).
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

const STATUS_KEYS = ["pass_r1", "round2", "fail_r1", "absent", "unknown"];
const BAND_KEYS = ["ge95", "b90_95", "b80_90", "b70_80", "b60_70", "b50_60", "lt50"];
const SEAT_DIGITS = 7;

const MULTISPACE = /\s+/g;
const NON_ARABIC = /[^ء-يٱ ]/g;

function normalizeQuery(q) {
  if (!q) return "";
  q = q.trim();
  const folds = [["آ", "ا"], ["أ", "ا"], ["إ", "ا"], ["ٱ", "ا"],
    ["ى", "ي"], ["ة", "ه"], ["ؤ", "و"], ["ئ", "ي"], ["ء", ""]];
  for (const [a, b] of folds) q = q.split(a).join(b);
  q = q.replace(NON_ARABIC, " ").replace(MULTISPACE, " ").trim();
  return q;
}

function decodeRow(r) {
  if (!r) return r;
  const out = { ...r };
  if (typeof out.status === "number") out.status = STATUS_KEYS[out.status] || "unknown";
  if (typeof out.grade_band === "number") out.grade_band = BAND_KEYS[out.grade_band] || "lt50";
  if (out.percentile != null) {
    out.is_top_1pct = out.percentile >= 99;
    out.is_top_5pct = out.percentile >= 95;
    out.is_top_10pct = out.percentile >= 90;
  }
  return out;
}

module.exports = { sql, normalizeQuery, decodeRow, STATUS_KEYS, BAND_KEYS, SEAT_DIGITS };
