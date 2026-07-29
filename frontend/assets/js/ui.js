// Reusable UI components, an async hook, and export helpers.
import { html, useState, useEffect, useRef } from "./preact.js";
import { t } from "./i18n.js";
import { nf } from "./format.js";

/* ---- async data hook --------------------------------------------------- */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: null });
    Promise.resolve().then(fn).then(
      (d) => alive && setState({ loading: false, data: d, error: null }),
      (e) => alive && setState({ loading: false, data: null, error: e.message || String(e) })
    );
    return () => { alive = false; };
  }, deps);
  return state;
}

/* ---- primitives -------------------------------------------------------- */
export const SecHead = ({ title, sub, right }) => html`
  <div class="sec-head">
    <div><h2>${title}</h2>${sub && html`<p>${sub}</p>`}</div>
    ${right && html`<div>${right}</div>`}
  </div>`;

export const Card = ({ title, desc, right, children, cls = "", pad = true, hover = false }) => html`
  <div class=${"card " + (hover ? "hover " : "") + cls} style=${pad ? "" : "padding:0"}>
    ${(title || right) && html`<div class="card-head" style=${pad ? "" : "padding:16px 18px 0"}>
      <div><div class="card-title">${title}</div>${desc && html`<div class="card-desc">${desc}</div>`}</div>
      ${right && html`<div>${right}</div>`}
    </div>`}
    ${children}
  </div>`;

export const KPI = ({ icon, label, value, sub, tone }) => html`
  <div class="card kpi hover">
    <div class="kpi-ic">${icon}</div>
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub && html`<div class="kpi-sub">${sub}</div>`}
    <div class="accent-bar" style=${tone ? `background:linear-gradient(90deg,${tone},${tone})` : ""}></div>
  </div>`;

export const Stat = ({ t: label, v, u }) => html`
  <div class="stat-tile"><div class="t">${label}</div>
    <div class="v">${v}${u && html` <span class="u">${u}</span>`}</div></div>`;

export const Insight = ({ text, icon = "✦" }) => html`
  <div class="insight"><span class="ico">${icon}</span><span>${text}</span></div>`;

export const Pill = ({ children, tone }) => html`<span class=${"pill " + (tone || "")}>${children}</span>`;

export const Skeleton = ({ h = 120, cls = "" }) => html`<div class=${"sk " + cls} style=${`height:${h}px`}></div>`;

export const Loading = ({ rows = 3 }) => html`
  <div class="grid g-4" style="margin-bottom:18px">
    ${[0, 1, 2, 3].map(() => html`<${Skeleton} h=${118} />`)}
  </div>
  <div class="grid g-2">
    ${Array.from({ length: rows * 2 }).map(() => html`<${Skeleton} h=${300} />`)}
  </div>`;

export const ErrorBox = ({ error }) => html`
  <div class="card" style="border-color:var(--critical)">
    <div class="card-title" style="color:var(--critical)">⚠ ${"Error"}</div>
    <p class="muted" style="margin:8px 0 0">${error}</p>
    <p class="muted" style="margin:8px 0 0;font-size:12px">Ensure the API is running and the pipeline build has completed.</p>
  </div>`;

/* ---- status chip ------------------------------------------------------- */
export const StatusChip = ({ st, label }) => {
  const map = { pass_r1: ["good", "var(--good)"], round2: ["warn", "var(--warn)"],
    fail_r1: ["bad", "var(--critical)"], absent: ["", "var(--muted)"] };
  const [tone, col] = map[st] || ["", "var(--muted)"];
  return html`<span class=${"pill " + tone}><span class="dot" style=${`background:${col}`}></span>${label}</span>`;
};

/* ---- data table (server-driven) --------------------------------------- */
export function DataTable({ columns, rows, sort, order, onSort, loading, exportName, emptyText }) {
  const arrow = (k) => (sort === k ? (order === "asc" ? " ▲" : " ▼") : "");
  return html`
    <div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            ${columns.map((c) => html`<th class=${c.sortKey ? "" : "no-sort"}
              onClick=${() => c.sortKey && onSort && onSort(c.sortKey)}>${c.label}${c.sortKey ? arrow(c.sortKey) : ""}</th>`)}
          </tr></thead>
          <tbody>
            ${loading
              ? Array.from({ length: 8 }).map(() => html`<tr>${columns.map(() => html`<td><div class="sk" style="height:16px"></div></td>`)}</tr>`)
              : (rows.length === 0
                  ? html`<tr><td colspan=${columns.length} class="center muted" style="padding:34px">${emptyText || t("no_results")}</td></tr>`
                  : rows.map((r) => html`<tr>${columns.map((c) => html`<td>${c.render ? c.render(r) : r[c.key]}</td>`)}</tr>`))}
          </tbody>
        </table>
      </div>
      ${exportName && rows.length > 0 && html`
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn sm" onClick=${() => exportCSV(exportName, columns, rows)}>⬇ ${t("export_csv")}</button>
          <button class="btn sm" onClick=${() => exportXLS(exportName, columns, rows)}>⬇ ${t("export_excel")}</button>
          <button class="btn sm" onClick=${() => window.print()}>🖨 ${t("export_pdf")}</button>
        </div>`}
    </div>`;
}

/* ---- pager ------------------------------------------------------------- */
export const Pager = ({ page, pages, total, onPage }) => html`
  <div class="pager">
    <div class="muted" style="font-size:12.5px">${nf(total)} ${t("results")}</div>
    <div class="grp">
      <button class="btn sm" disabled=${page <= 1} onClick=${() => onPage(page - 1)}>‹ ${t("prev")}</button>
      <span class="muted" style="font-size:12.5px">${t("page")} ${nf(page)} / ${nf(pages || 1)}</span>
      <button class="btn sm" disabled=${page >= pages} onClick=${() => onPage(page + 1)}>${t("next")} ›</button>
    </div>
  </div>`;

/* ---- exports ----------------------------------------------------------- */
function cellText(c, r) {
  const v = c.exportValue ? c.exportValue(r) : (c.plain ? c.plain(r) : r[c.key]);
  return v === null || v === undefined ? "" : String(v);
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function exportCSV(name, columns, rows) {
  const cols = columns.filter((c) => !c.noExport);
  const head = cols.map((c) => `"${(c.label || c.key)}"`).join(",");
  const body = rows.map((r) => cols.map((c) => `"${cellText(c, r).replace(/"/g, '""')}"`).join(",")).join("\n");
  download(new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}
export function exportXLS(name, columns, rows) {
  const cols = columns.filter((c) => !c.noExport);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const th = cols.map((c) => `<th>${esc(c.label || c.key)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(cellText(c, r))}</td>`).join("")}</tr>`).join("");
  const htmlStr = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;font-family:sans-serif}th{background:#eef}</style>
    </head><body><table>${`<thead><tr>${th}</tr></thead>`}<tbody>${tr}</tbody></table></body></html>`;
  download(new Blob(["﻿" + htmlStr], { type: "application/vnd.ms-excel;charset=utf-8" }), `${name}.xls`);
}

/* ---- animated number (count-up on mount) ------------------------------ */
export function CountUp({ to, decimals = 0, suffix = "", format }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const dur = 1000, start = performance.now();
    const fmt = format || ((v) => (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()));
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e) + suffix;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = fmt(to) + suffix;
    }
    requestAnimationFrame(frame);
  }, [to]);
  return html`<span ref=${ref}>0${suffix}</span>`;
}
