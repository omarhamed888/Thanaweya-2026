// Formatting helpers (locale-aware for Arabic/English).
import { store } from "./store.js";

const enNF = new Intl.NumberFormat("en-US");
const arNF = new Intl.NumberFormat("ar-EG");

export function nf(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (store.lang === "ar" ? arNF : enNF).format(Math.round(n));
}
export function nf1(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const f = new Intl.NumberFormat(store.lang === "ar" ? "ar-EG" : "en-US",
    { minimumFractionDigits: d, maximumFractionDigits: d });
  return f.format(n);
}
export function pct(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf1(n, d) + "%";
}
export function compact(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const f = new Intl.NumberFormat(store.lang === "ar" ? "ar-EG" : "en-US",
    { notation: "compact", maximumFractionDigits: 1 });
  return f.format(n);
}
export function ordinal(n) {
  return nf(n);
}
// Count-up animation helper: returns [displayValue] state updater via rAF.
export function animateValue(el, to, opts = {}) {
  if (!el) return;
  const dur = opts.duration ?? 900;
  const dec = opts.decimals ?? 0;
  const suffix = opts.suffix ?? "";
  const start = performance.now();
  const from = 0;
  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = from + (to - from) * eased;
    el.textContent = (dec ? nf1(val, dec) : nf(val)) + suffix;
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = (dec ? nf1(to, dec) : nf(to)) + suffix;
  }
  requestAnimationFrame(frame);
}
