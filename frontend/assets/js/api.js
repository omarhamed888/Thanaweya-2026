// Thin API client with in-memory caching for the static analytics payloads.
import { store } from "./store.js";

async function get(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).detail || msg; } catch (_) {}
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json();
}

function cached(key, fn) {
  if (store.cache[key]) return Promise.resolve(store.cache[key]);
  return fn().then((d) => { store.cache[key] = d; return d; });
}

export const api = {
  health: () => get("/api/health"),
  // Derived from /api/analytics (which already carries meta/cohort/predictions_summary)
  // rather than a dedicated endpoint, so this also works on static deployments
  // that only publish the precomputed JSON (no SQLite backend).
  meta: () => cached("analytics", () => get("/api/analytics"))
    .then((a) => ({ meta: a.meta, cohort: a.cohort, predictions_summary: a.predictions_summary })),
  analytics: () => cached("analytics", () => get("/api/analytics")),
  quality: () => cached("quality", () => get("/api/quality")),
  predictions: () => cached("predictions", () => get("/api/predictions")),
  student: (seat) => get(`/api/student/${encodeURIComponent(seat)}`),
  search: (q, by = "auto", page = 1, size = 25) =>
    get(`/api/search?q=${encodeURIComponent(q)}&by=${by}&page=${page}&size=${size}`),
  students: (params) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")
    ).toString();
    return get(`/api/students?${qs}`);
  },
};
