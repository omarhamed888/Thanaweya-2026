// Dashboard pages: Predictions, University Admission, Student Search, Data Quality.
import { html, useState, useEffect, useRef } from "./preact.js";
import { store } from "./store.js";
import { api } from "./api.js";
import { t } from "./i18n.js";
import { nf, nf1, pct, compact } from "./format.js";
import { Chart, baseLayout, colors, statusColor, BLUE_RAMP } from "./charts.js";
import { SecHead, Card, KPI, Stat, Insight, Loading, ErrorBox, useAsync, StatusChip, DataTable, Pager } from "./ui.js";

const FN = (f) => (store.lang === "ar" ? f.name_ar : f.name_en);
const bandLabel = { ge95: { en: "95%+", ar: "95%+" }, b90_95: { en: "90–95%", ar: "90–95%" },
  b80_90: { en: "80–90%", ar: "80–90%" }, b70_80: { en: "70–80%", ar: "70–80%" },
  b60_70: { en: "60–70%", ar: "60–70%" }, b50_60: { en: "50–60%", ar: "50–60%" }, lt50: { en: "<50%", ar: "أقل من 50%" } };
const statusLbl = { pass_r1: { en: "Passed (R1)", ar: "ناجح (دور أول)" }, round2: { en: "Second Round", ar: "دور ثانٍ" },
  fail_r1: { en: "Failed (R1)", ar: "راسب (دور أول)" }, absent: { en: "Absent", ar: "غياب كلي" } };
const LB = (o) => o[store.lang] || o.en;

// tiny inline SVG sparkline for faculty history
function Spark({ values, color }) {
  const w = 108, hgt = 30, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const rng = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = hgt - pad - ((v - min) / rng) * (hgt - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = values[values.length - 1], lx = w - pad, ly = hgt - pad - ((last - min) / rng) * (hgt - 2 * pad);
  return html`<svg width=${w} height=${hgt} style="overflow:visible">
    <polyline points=${pts} fill="none" stroke=${color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx=${lx} cy=${ly} r="2.6" fill=${color} />
  </svg>`;
}

/* =======================================================================
   PREDICTIONS
   ======================================================================= */
export function Predictions() {
  const { loading, data: p, error } = useAsync(() => api.predictions(), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;
  const c = colors();
  const facs = p.faculties;

  const cutoffBar = [{
    type: "bar", orientation: "h",
    y: facs.map(FN).reverse(), x: facs.map((f) => f.expected_cutoff).reverse(),
    marker: { color: facs.map((_, i) => BLUE_RAMP[Math.min(6 - Math.floor(i / 3), 6)]).reverse() },
    text: facs.map((f) => nf1(f.expected_cutoff, 1) + "%").reverse(), textposition: "auto",
    textfont: { color: "#fff", size: 11 },
    hovertemplate: "%{y}: %{x:.1f}%<extra></extra>",
  }];

  const scen = [
    { type: "bar", name: t("optimistic"), x: facs.map(FN), y: facs.map((f) => f.scenarios.optimistic.cutoff), marker: { color: c.good } },
    { type: "bar", name: t("expected"), x: facs.map(FN), y: facs.map((f) => f.scenarios.expected.cutoff), marker: { color: c.accent } },
    { type: "bar", name: t("pessimistic"), x: facs.map(FN), y: facs.map((f) => f.scenarios.pessimistic.cutoff), marker: { color: c.critical } },
  ];

  return html`<div class="page">
    <${SecHead} title=${t("pred_title")} sub=${t("pred_sub")} />

    <div class="grid g-3" style="margin:16px 0">
      <${KPI} icon="📈" label=${store.lang === "ar" ? "متوسط الدفعة" : "Cohort Mean"} value=${nf1(p.meta.cohort_mean_pct, 1) + "%"} tone="var(--accent)"
        sub=${html`<span class="muted">${store.lang === "ar" ? "الأساس التاريخي" : "baseline"} ${p.meta.baseline_mean_pct}%</span>`} />
      <${KPI} icon=${p.meta.pressure_direction === "downward" ? "🔻" : p.meta.pressure_direction === "upward" ? "🔺" : "➖"}
        label=${store.lang === "ar" ? "ضغط الحدود" : "Cutoff Pressure"} value=${nf1(p.meta.pressure_adjustment, 2)} tone=${p.meta.pressure_direction === "downward" ? "var(--good)" : "var(--critical)"}
        sub=${html`<span class="muted">${LB({ en: p.meta.pressure_direction, ar: p.meta.pressure_direction === "downward" ? "للأسفل" : p.meta.pressure_direction === "upward" ? "للأعلى" : "محايد" })}</span>`} />
      <${KPI} icon="🎓" label=${store.lang === "ar" ? "عدد الكليات" : "Faculties Modeled"} value=${nf(facs.length)} tone="var(--accent-3)"
        sub=${html`<span class="muted">${compact(p.meta.sitters)} ${t("students")}</span>`} />
    </div>

    <div class="grid g-2" style="margin-bottom:18px">
      <${Card} title=${store.lang === "ar" ? "الحدود المتوقعة للكليات" : "Expected Faculty Cutoffs"} desc="2026">
        <${Chart} className="chart-tall" data=${cutoffBar} layout=${baseLayout({ margin: { l: 130, r: 24, t: 8, b: 34 },
          xaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
      <//>
      <${Card} title=${store.lang === "ar" ? "مقارنة السيناريوهات" : "Scenario Comparison"}>
        <${Chart} className="chart-tall" data=${scen} layout=${baseLayout({ barmode: "group",
          xaxis: { tickangle: -30, gridcolor: c.grid, tickfont: { color: c.muted, size: 10 } },
          yaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } },
          legend: { orientation: "h", y: 1.1, font: { color: c.ink2, size: 11 } } })} />
      <//>
    </div>

    <div class="grid g-3" style="margin-bottom:18px">
      ${facs.map((f) => {
        const e = f.scenarios.expected, o = f.scenarios.optimistic, pe = f.scenarios.pessimistic;
        const delta = f.last_year.expected_vs_last;
        return html`<div class="card hover">
          <div class="card-head">
            <div><div class="card-title">${FN(f)}</div><div class="card-desc">${f.stream_ar}</div></div>
            <${Spark} values=${f.history.map((h) => h.cutoff).concat([f.expected_cutoff])} color=${c.accent} />
          </div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between">
            <div>
              <div class="muted" style="font-size:11px">${t("expected_cutoff")}</div>
              <div style="font-size:30px;font-weight:850;letter-spacing:-.02em;line-height:1">${nf1(f.expected_cutoff, 1)}<span style="font-size:16px">%</span></div>
              <div class="muted" style="font-size:11.5px;margin-top:2px">${t("score_needed")}: ${nf1(f.score_needed, 0)}/320</div>
            </div>
            <div style="text-align:end">
              <span class=${"pill " + (delta > 0 ? "bad" : "good")}>${delta > 0 ? "▲" : "▼"} ${nf1(Math.abs(delta), 1)} ${t("vs_last_year")}</span>
              <div class="muted" style="font-size:11px;margin-top:8px">${t("ci95")}: ${nf1(f.confidence_interval_95.low, 1)}–${nf1(f.confidence_interval_95.high, 1)}%</div>
            </div>
          </div>
          <div class="divider" style="margin:14px 0 10px"></div>
          <div class="scenario-row">
            <div class="stat-tile"><div class="t" style="color:var(--good)">${t("optimistic")}</div><div class="v" style="font-size:16px">${nf1(o.cutoff,1)}%</div><div class="u">${compact(o.eligible_students)} ${t("eligible")}</div></div>
            <div class="stat-tile"><div class="t" style="color:var(--accent)">${t("expected")}</div><div class="v" style="font-size:16px">${nf1(e.cutoff,1)}%</div><div class="u">${compact(e.eligible_students)} ${t("eligible")}</div></div>
            <div class="stat-tile"><div class="t" style="color:var(--critical)">${t("pessimistic")}</div><div class="v" style="font-size:16px">${nf1(pe.cutoff,1)}%</div><div class="u">${compact(pe.eligible_students)} ${t("eligible")}</div></div>
          </div>
        </div>`;
      })}
    </div>

    <${Card} title=${t("assumptions")}>
      <div class="grid" style="gap:10px">${p.assumptions.map((s) => html`<${Insight} icon="⚠" text=${s} />`)}</div>
    <//>
  </div>`;
}

/* =======================================================================
   UNIVERSITY ADMISSION EXPLORER
   ======================================================================= */
export function Admission() {
  const { loading, data: p, error } = useAsync(() => api.predictions(), []);
  const [pctVal, setPctVal] = useState(85);
  const [sel, setSel] = useState(0);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;
  const c = colors();
  const facs = p.faculties;
  const qualifying = facs.filter((f) => pctVal >= f.scenarios.expected.cutoff);

  const gauge = [{
    type: "indicator", mode: "gauge+number", value: pctVal,
    number: { suffix: "%", font: { color: c.ink, size: 30 } },
    gauge: {
      axis: { range: [0, 100], tickcolor: c.muted, tickfont: { color: c.muted, size: 9 } },
      bar: { color: c.accent }, bgcolor: "rgba(0,0,0,0)", borderwidth: 0,
      steps: [{ range: [0, 50], color: c.critical + "33" }, { range: [50, 70], color: c.warn + "33" },
        { range: [70, 85], color: c.accent + "22" }, { range: [85, 100], color: c.good + "33" }],
    },
  }];

  const f = facs[sel];
  const years = f.history.map((h) => h.year).concat([2026]);
  const vals = f.history.map((h) => h.cutoff).concat([f.expected_cutoff]);
  const trend = [
    { type: "scatter", mode: "lines+markers", x: f.history.map((h) => h.year), y: f.history.map((h) => h.cutoff),
      name: store.lang === "ar" ? "تاريخي" : "Historical", line: { color: c.accent, width: 2.5 }, marker: { size: 7 } },
    { type: "scatter", mode: "markers", x: [2026], y: [f.expected_cutoff], name: t("expected"),
      marker: { color: c.s2 || c.series[1], size: 12, symbol: "star" },
      error_y: { type: "data", symmetric: false,
        array: [f.confidence_interval_95.high - f.expected_cutoff],
        arrayminus: [f.expected_cutoff - f.confidence_interval_95.low], color: c.muted } },
  ];

  const cols = [
    { key: "n", label: store.lang === "ar" ? "الكلية" : "Faculty", render: (r) => html`<span style="font-weight:650">${FN(r)}</span><div class="muted" style="font-size:11px">${r.stream_ar}</div>`, exportValue: (r) => FN(r) },
    { key: "exp", label: t("expected"), render: (r) => html`<span class="tabnums" style="font-weight:750;color:var(--accent)">${nf1(r.scenarios.expected.cutoff, 1)}%</span>`, exportValue: (r) => r.scenarios.expected.cutoff },
    { key: "opt", label: t("optimistic"), render: (r) => html`<span class="tabnums" style="color:var(--good)">${nf1(r.scenarios.optimistic.cutoff, 1)}%</span>`, exportValue: (r) => r.scenarios.optimistic.cutoff },
    { key: "pes", label: t("pessimistic"), render: (r) => html`<span class="tabnums" style="color:var(--critical)">${nf1(r.scenarios.pessimistic.cutoff, 1)}%</span>`, exportValue: (r) => r.scenarios.pessimistic.cutoff },
    { key: "sn", label: t("score_needed"), render: (r) => html`<span class="tabnums">${nf1(r.score_needed, 0)}/320</span>`, exportValue: (r) => r.score_needed },
    { key: "el", label: t("eligible"), render: (r) => html`<span class="tabnums">${compact(r.scenarios.expected.eligible_students)}</span>`, exportValue: (r) => r.scenarios.expected.eligible_students },
  ];

  return html`<div class="page">
    <${SecHead} title=${t("admission_title")} sub=${t("admission_sub")} />

    <div class="grid g-3" style="margin:16px 0">
      <${Card} title=${t("check_eligibility")} cls="span-1">
        <div class="field-lbl">${t("enter_pct")}</div>
        <input class="input" type="range" min="0" max="100" step="0.5" value=${pctVal}
          onInput=${(e) => setPctVal(parseFloat(e.target.value))} style="padding:8px 0" />
        <input class="input" type="number" min="0" max="100" step="0.1" value=${pctVal}
          onInput=${(e) => setPctVal(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} style="margin-top:8px" />
        <${Chart} className="chart-sm" data=${gauge} layout=${baseLayout({ margin: { l: 20, r: 20, t: 10, b: 0 } })} />
        <div class="center muted" style="font-size:12.5px">${nf1(pctVal / 100 * 320, 0)} / 320</div>
      <//>
      <${Card} title=${t("you_qualify")} cls="span-2">
        ${qualifying.length === 0
          ? html`<p class="muted">${store.lang === "ar" ? "لا توجد كليات ضمن هذا الحد المتوقع. جرّب نسبة أعلى." : "No faculties within this expected cutoff. Try a higher percentage."}</p>`
          : html`<div style="display:flex;flex-wrap:wrap;gap:10px">
            ${qualifying.map((q) => html`<div class="stat-tile" style="min-width:150px;flex:1">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <span style="font-weight:700;font-size:13px">${FN(q)}</span>
                <span class="pill good">✓</span>
              </div>
              <div class="muted" style="font-size:11px;margin-top:6px">${t("expected")}: ${nf1(q.scenarios.expected.cutoff, 1)}% · ${nf1(q.score_needed, 0)}/320</div>
            </div>`)}
          </div>`}
        <div class="divider" style="margin:16px 0 12px"></div>
        <div class="muted" style="font-size:12.5px">${store.lang === "ar"
          ? `تؤهّلك نسبة ${nf1(pctVal, 1)}% مبدئيًا لـ ${nf(qualifying.length)} كلية ضمن السيناريو المتوقع.`
          : `At ${nf1(pctVal, 1)}% you provisionally qualify for ${nf(qualifying.length)} of ${nf(facs.length)} modeled faculties (Expected scenario).`}</div>
      <//>
    </div>

    <${Card} title=${store.lang === "ar" ? "اتجاه حد القبول" : "Cutoff Trend"} cls="span-full"
      right=${html`<select class="input" style="width:auto;padding:8px 12px" onChange=${(e) => setSel(parseInt(e.target.value))}>
        ${facs.map((ff, i) => html`<option value=${i} selected=${i === sel}>${FN(ff)}</option>`)}
      </select>`}>
      <${Chart} className="chart-mid" data=${trend} layout=${baseLayout({
        xaxis: { dtick: 1, gridcolor: c.grid, tickfont: { color: c.muted } },
        yaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } },
        legend: { orientation: "h", y: 1.12, font: { color: c.ink2, size: 11 } } })} />
    <//>

    <${Card} title=${store.lang === "ar" ? "مقارنة كل الكليات" : "All Faculties Comparison"} cls="span-full" cls2="">
      <${DataTable} columns=${cols} rows=${facs} exportName="thanaweya-2026-admission" />
    <//>
  </div>`;
}

/* =======================================================================
   STUDENT SEARCH
   ======================================================================= */
export function Search() {
  const [q, setQ] = useState("");
  const [by, setBy] = useState("auto");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState(null);
  const timer = useRef(null);

  async function run(query, mode, pg) {
    if (!query || query.trim().length < 1) { setRes(null); return; }
    setLoading(true);
    try { const r = await api.search(query.trim(), mode, pg, 25); setRes(r); }
    catch (e) { setRes({ unavailable: true, rows: [] }); }
    setLoading(false);
  }
  function onInput(v) {
    setQ(v); setPage(1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => run(v, by, 1), 350);
  }
  function goPage(pg) { setPage(pg); run(q, by, pg); }

  async function openProfile(seat) {
    try { const s = await api.student(seat); setProfile(s); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { setProfile({ unavailable: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  const cols = [
    { label: t("seat"), render: (r) => html`<span class="mono">${r.seating_no}</span>` },
    { label: t("name"), render: (r) => html`<span style="font-weight:650">${r.name}</span>` },
    { label: t("score"), render: (r) => html`<span class="tabnums">${nf1(r.total_degree, 1)}</span>` },
    { label: t("percentage"), render: (r) => html`<span class="tabnums" style="font-weight:700;color:var(--accent)">${nf1(r.percentage, 2)}%</span>` },
    { label: t("status"), render: (r) => html`<${StatusChip} st=${r.status} label=${LB(statusLbl[r.status] || { en: r.status })} />` },
    { label: t("rank"), render: (r) => html`<span class="tabnums">${r.national_rank ? nf(r.national_rank) : "—"}</span>` },
    { label: "", render: (r) => html`<button class="btn sm" onClick=${() => openProfile(r.seating_no)}>${t("view_profile")}</button>` },
  ];

  return html`<div class="page">
    <${SecHead} title=${t("search_title")} sub=${t("search_sub")} />

    ${profile && html`<${StudentProfile} s=${profile} onClose=${() => setProfile(null)} />`}

    <div class="card" style="margin:16px 0">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:240px;position:relative">
          <input class="input" placeholder=${t("search_ph")} value=${q}
            onInput=${(e) => onInput(e.target.value)}
            onKeyDown=${(e) => e.key === "Enter" && run(q, by, 1)} style="padding-inline-start:42px" />
          <span style="position:absolute;inset-inline-start:14px;top:12px;font-size:16px">🔎</span>
        </div>
        <div class="seg">
          ${[["auto", t("by_auto")], ["seat", t("by_seat")], ["name", t("by_name")]].map(([k, lbl]) =>
            html`<button class=${by === k ? "on" : ""} onClick=${() => { setBy(k); run(q, k, 1); }}>${lbl}</button>`)}
        </div>
      </div>
    </div>

    ${res && res.unavailable && html`<${SearchUnavailable} />`}
    ${res && !res.unavailable && html`<${Card} title=${t("results")} desc=${`${nf(res.total)} ${t("results")} · ${res.mode}`}>
      <${DataTable} columns=${cols} rows=${res.rows} loading=${loading} exportName="thanaweya-2026-search" />
      ${res.pages > 1 && html`<${Pager} page=${res.page} pages=${res.pages} total=${res.total} onPage=${goPage} />`}
    <//>`}
    ${!res && !loading && html`<div class="card center muted" style="padding:50px">${t("search_ph")}</div>`}
  </div>`;
}

function SearchUnavailable() {
  return html`<div class="card" style="border-color:var(--warn)">
    <div class="card-title">🔒 ${store.lang === "ar" ? "البحث غير متاح في هذه النسخة" : "Search unavailable in this deployment"}</div>
    <p class="muted" style="margin:8px 0 0;line-height:1.7">${store.lang === "ar"
      ? "هذه نسخة عرض تنشر التحليلات والتوقعات المجمّعة فقط، لحماية خصوصية الطلاب — بدون بحث أو تصدير لبيانات الطلاب الفردية. لتجربة البحث الكامل عن 919,396 طالب، شغّل المشروع محليًا (راجع README)."
      : "This deployment only publishes aggregate analytics and predictions, to protect student privacy — it doesn't include search or export over individual student records. Run the project locally (see the README) for full search over all 919,396 students."}</p>
  </div>`;
}

function StudentProfile({ s, onClose }) {
  const c = colors();
  if (s.unavailable) return html`<${SearchUnavailable} />`;
  if (s.error) return html`<${ErrorBox} error=${s.error} />`;
  const perc = s.percentile || 0;
  const gauge = [{
    type: "indicator", mode: "gauge+number", value: s.percentage,
    number: { suffix: "%", font: { color: c.ink, size: 26 } },
    gauge: { axis: { range: [0, 100], tickfont: { color: c.muted, size: 9 } },
      bar: { color: c.accent }, bgcolor: "rgba(0,0,0,0)", borderwidth: 0,
      steps: [{ range: [0, 50], color: c.critical + "22" }, { range: [50, 80], color: c.warn + "22" }, { range: [80, 100], color: c.good + "22" }] } }];
  return html`<div class="card" style="margin-bottom:18px;border-color:var(--accent)">
    <div class="card-head">
      <div><div class="card-title" style="font-size:18px">${s.name}</div>
        <div class="card-desc mono">${t("seat")} ${s.seating_no}</div></div>
      <button class="iconbtn" onClick=${onClose}>✕</button>
    </div>
    <div class="grid g-4" style="align-items:center">
      <div class="stat-tile"><div class="t">${t("national_rank")}</div>
        <div class="v" style="font-size:26px">${s.national_rank ? "#" + nf(s.national_rank) : "—"}</div>
        <div class="u">${s.percentile ? `${t("better_than")} ${nf1(s.percentile, 1)}%` : ""}</div></div>
      <div class="stat-tile"><div class="t">${t("score")}</div><div class="v" style="font-size:26px">${nf1(s.total_degree, 1)}</div><div class="u">${t("out_of_320")}</div></div>
      <div class="stat-tile"><div class="t">${t("perf_index")}</div><div class="v" style="font-size:26px">${s.performance_index ? nf1(s.performance_index, 1) : "—"}</div><div class="u">T-score</div></div>
      <div><${Chart} className="chart-sm" style="height:170px" data=${gauge} layout=${baseLayout({ margin: { l: 16, r: 16, t: 8, b: 0 } })} /></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <${StatusChip} st=${s.status} label=${LB(statusLbl[s.status] || { en: s.status })} />
      <span class="pill">${LB(bandLabel[s.grade_band] || { en: s.grade_band })}</span>
      ${s.is_top_1pct ? html`<span class="pill good">Top 1%</span>` : s.is_top_5pct ? html`<span class="pill">Top 5%</span>` : s.is_top_10pct ? html`<span class="pill">Top 10%</span>` : ""}
    </div>
    ${s.neighbours && s.neighbours.length > 0 && html`
      <div class="divider" style="margin:16px 0 10px"></div>
      <div class="card-desc" style="margin-bottom:8px">${t("nearby")}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th class="no-sort">${t("rank")}</th><th class="no-sort">${t("name")}</th><th class="no-sort">${t("score")}</th><th class="no-sort">${t("percentage")}</th></tr></thead>
        <tbody>${s.neighbours.map((n) => html`<tr style=${n.seating_no === s.seating_no ? "background:color-mix(in srgb,var(--accent) 12%,transparent)" : ""}>
          <td class="tabnums">${nf(n.national_rank)}</td><td>${n.name}</td>
          <td class="tabnums">${nf1(n.total_degree, 1)}</td><td class="tabnums">${nf1(n.percentage, 2)}%</td></tr>`)}</tbody>
      </table></div>`}
  </div>`;
}

/* =======================================================================
   DATA QUALITY
   ======================================================================= */
export function Quality() {
  const { loading, data: q, error } = useAsync(() => api.quality(), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;
  const c = colors();

  const gauge = [{
    type: "indicator", mode: "gauge+number", value: q.overall_quality_score,
    number: { suffix: "%", font: { color: c.ink, size: 30 } },
    gauge: { axis: { range: [0, 100], tickfont: { color: c.muted, size: 9 } },
      bar: { color: q.overall_quality_score > 95 ? c.good : c.warn }, bgcolor: "rgba(0,0,0,0)", borderwidth: 0,
      steps: [{ range: [0, 80], color: c.critical + "22" }, { range: [80, 95], color: c.warn + "22" }, { range: [95, 100], color: c.good + "22" }] } }];

  const dims = Object.entries(q.dimension_scores);
  const dimBar = [{ type: "bar", x: dims.map(([k]) => t(k)), y: dims.map(([, v]) => v),
    marker: { color: [c.good, c.accent, c.accent3] }, text: dims.map(([, v]) => nf1(v, 1) + "%"),
    textposition: "outside", textfont: { color: c.ink2, size: 11 },
    hovertemplate: "%{x}: %{y:.2f}%<extra></extra>" }];

  const cols = Object.entries(q.columns);
  const st = q.status_distribution;
  const donut = [{ type: "pie", hole: 0.6, sort: false,
    labels: Object.entries(st).map(([k, v]) => LB(statusLbl[k] || { en: v.label_en, ar: v.label_ar })),
    values: Object.values(st).map((v) => v.count),
    marker: { colors: Object.keys(st).map(statusColor), line: { color: c.surface, width: 2 } },
    textinfo: "percent", textfont: { color: "#fff", size: 11 },
    hovertemplate: "%{label}: %{value:,}<extra></extra>" }];

  return html`<div class="page">
    <${SecHead} title=${t("q_title")} sub=${t("q_sub")} />

    <div class="grid g-3" style="margin:16px 0">
      <${Card} title=${t("quality_score")}>
        <${Chart} className="chart-sm" data=${gauge} layout=${baseLayout({ margin: { l: 20, r: 20, t: 8, b: 0 } })} />
      <//>
      <${Card} title=${store.lang === "ar" ? "أبعاد الجودة" : "Quality Dimensions"} cls="span-2">
        <${Chart} className="chart-sm" data=${dimBar} layout=${baseLayout({ yaxis: { range: [0, 105], ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
      <//>
    </div>

    <div class="grid g-4" style="margin-bottom:18px">
      <${Stat} t=${store.lang === "ar" ? "الصفوف" : "Rows"} v=${compact(q.generated_rows)} />
      <${Stat} t=${t("duplicates") + " (seat)"} v=${nf(q.duplicates.duplicate_seat_rows)} u=${nf1(q.duplicates.duplicate_seat_pct, 2) + "%"} />
      <${Stat} t=${t("outliers")} v=${compact(q.outliers.outliers_total)} u=${nf1(q.outliers.outliers_pct, 2) + "%"} />
      <${Stat} t=${t("invalid_rows")} v=${compact(q.invalid.invalid_rows)} u=${nf1(q.invalid.invalid_pct, 2) + "%"} />
    </div>

    <div class="grid g-2" style="margin-bottom:18px">
      <${Card} title=${t("col_profile")}>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th class="no-sort">${store.lang === "ar" ? "العمود" : "Column"}</th><th class="no-sort">${t("missing")}</th><th class="no-sort">${t("unique")}</th><th class="no-sort">Type</th></tr></thead>
          <tbody>${cols.map(([name, p]) => html`<tr>
            <td style="font-weight:650">${name}</td>
            <td class="tabnums">${nf1(p.missing_pct, 2)}%</td>
            <td class="tabnums">${nf(p.unique)}</td>
            <td class="mono muted" style="font-size:11px">${p.dtype}</td></tr>`)}</tbody>
        </table></div>
      <//>
      <${Card} title=${t("status_split")}>
        <${Chart} className="chart-mid" data=${donut} layout=${baseLayout({ showlegend: true,
          legend: { orientation: "h", y: -0.05, x: 0.5, xanchor: "center", font: { color: c.ink2, size: 11 } },
          margin: { l: 10, r: 10, t: 10, b: 10 } })} />
      <//>
    </div>

    <${Card} title=${store.lang === "ar" ? "ملاحظات التنظيف والتحقق" : "Cleaning & Validation Notes"}>
      <div class="grid" style="gap:10px">
        <${Insight} icon="🧹" text=${`${store.lang === "ar" ? "تم توحيد المسافات في" : "Whitespace standardized in"} ${nf(q.cleaning_log.status_trailing_ws_fixed)} ${store.lang === "ar" ? "حالة" : "status labels"}.`} />
        <${Insight} icon="🔑" text=${q.duplicates.note_names} />
        <${Insight} icon="⚠" text=${q.invalid.note} />
        <${Insight} icon="📐" text=${`${t("outliers")}: ${nf(q.outliers.outliers_total)} (${q.outliers.method}); ${store.lang === "ar" ? "الأسوار" : "fences"} ${nf1(q.outliers.lower_fence,1)}–${nf1(q.outliers.upper_fence,1)}.`} />
      </div>
    <//>
  </div>`;
}
