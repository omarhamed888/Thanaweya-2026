// GET /api/student/:seat — single student + rank neighbours (±5).
// Mirrors backend/db.py's get_student() over the Postgres mirror table.
const { sql, decodeRow } = require("../_lib/db.js");

module.exports = async (req, res) => {
  try {
    const seat = parseInt(req.query.seat, 10);
    if (!Number.isFinite(seat)) {
      return res.status(422).json({ detail: "invalid seat number" });
    }

    const rows = await sql`
      SELECT seating_no, name, total_degree, percentage, status, grade_band,
             national_rank, percentile, performance_index
      FROM students WHERE seating_no = ${seat}`;
    if (!rows.length) {
      return res.status(404).json({ detail: `No student with seat number ${seat}` });
    }
    const student = decodeRow(rows[0]);

    if (student.national_rank) {
      const rk = student.national_rank;
      const neighbours = await sql`
        SELECT seating_no, name, total_degree, percentage, national_rank
        FROM students WHERE national_rank BETWEEN ${Math.max(1, rk - 5)} AND ${rk + 5}
        ORDER BY national_rank LIMIT 11`;
      student.neighbours = neighbours;
    }

    return res.json(student);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: "lookup_failed" });
  }
};
