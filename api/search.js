// GET /api/search?q=&by=&page=&size= — seat-number or Arabic-name search.
// Mirrors backend/db.py's search() over SQLite, but against the Postgres
// mirror of the students table (see scripts/migrate_to_postgres.py).
const { sql, normalizeQuery, decodeRow, SEAT_DIGITS } = require("./_lib/db.js");

module.exports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 25));
    const by = req.query.by || "auto";
    const q = (req.query.q || "").toString().trim();
    const offset = (page - 1) * size;

    if (!q) {
      return res.json({ mode: "empty", total: 0, rows: [], page, size, pages: 0 });
    }

    const digits = q.replace(/\D/g, "");
    const useSeat = by === "seat" ||
      (by === "auto" && digits.length >= 3 && /^\d+$/.test(q.replace(/\s/g, "")));

    if (useSeat) {
      const seatNum = parseInt(digits, 10);
      const exactRows = await sql`
        SELECT seating_no, name, total_degree, percentage, status, grade_band,
               national_rank, percentile, performance_index
        FROM students WHERE seating_no = ${seatNum}`;
      if (exactRows.length) {
        return res.json({ mode: "seat_exact", total: 1, page: 1, size, pages: 1, rows: [decodeRow(exactRows[0])] });
      }
      const L = digits.length;
      if (L === 0 || L > SEAT_DIGITS) {
        return res.json({ mode: "seat_prefix", total: 0, rows: [], page, size, pages: 0 });
      }
      const span = 10 ** (SEAT_DIGITS - L);
      const lo = seatNum * span;
      const hi = lo + span - 1;
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM students WHERE seating_no BETWEEN ${lo} AND ${hi}`;
      const rows = await sql`
        SELECT seating_no, name, total_degree, percentage, status, grade_band,
               national_rank, percentile, performance_index
        FROM students WHERE seating_no BETWEEN ${lo} AND ${hi}
        ORDER BY seating_no LIMIT ${size} OFFSET ${offset}`;
      return res.json({
        mode: "seat_prefix", total: count, page, size, pages: Math.ceil(count / size),
        rows: rows.map(decodeRow),
      });
    }

    const key = normalizeQuery(q);
    if (key.length < 2) {
      return res.json({ mode: "name", total: 0, rows: [], page, size, pages: 0 });
    }
    const tokens = key.split(" ").filter(Boolean);
    const tsq = tokens.map((t) => `${t}:*`).join(" & ");

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM students
      WHERE to_tsvector('simple', name_key) @@ to_tsquery('simple', ${tsq})`;
    const rows = await sql`
      SELECT seating_no, name, total_degree, percentage, status, grade_band,
             national_rank, percentile, performance_index
      FROM students
      WHERE to_tsvector('simple', name_key) @@ to_tsquery('simple', ${tsq})
      ORDER BY (national_rank IS NULL), national_rank LIMIT ${size} OFFSET ${offset}`;

    return res.json({
      mode: "name", query_key: key, total: count, page, size, pages: Math.ceil(count / size),
      rows: rows.map(decodeRow),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: "search_failed" });
  }
};
