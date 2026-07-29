// Dashboard pages: Overview, Score Distribution, Top Performers, Statistics.
import { html } from "./preact.js";
import { store } from "./store.js";
import { api } from "./api.js";
import { t } from "./i18n.js";
import { nf, nf1, pct, compact } from "./format.js";
import { Chart, baseLayout, colors, statusColor, BLUE_RAMP } from "./charts.js";
import { SecHead, Card, KPI, Stat, Insight, Loading, ErrorBox, useAsync, CountUp, DataTable } from "./ui.js";

const L = (o) => (store.lang === "ar" ? o.label_ar : o.label_en) || o.label_en;
const medal = (r) => (r === 1 ? "rankbadge gold" : r === 2 ? "rankbadge silver" : r === 3 ? "rankbadge bronze" : "rankbadge");

/* =======================================================================
   OVERVIEW
   ======================================================================= */
export function Overview() {
  const { loading, data: a, error } = useAsync(() => api.analytics(), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;

  const c = colors();
  const co = a.cohort;
  const passd = a.status_distribution.find((s) => s.key === "pass_r1") || { count: 0, pct: 0 };
  const above90 = a.thresholds.find((x) => x.threshold === 90);
  const ge95 = a.grade_bands_sitters.find((b) => b.key === "ge95");

  // status donut
  const donut = [{
    type: "pie", hole: 0.62, sort: false, direction: "clockwise",
    labels: a.status_distribution.map(L),
    values: a.status_distribution.map((s) => s.count),
    marker: { colors: a.status_distribution.map((s) => statusColor(s.key)), line: { color: c.surface, width: 2 } },
    textinfo: "percent", textfont: { color: "#fff", size: 12 },
    hovertemplate: "%{label}<br>%{value:,} (" + "%{percent})<extra></extra>",
  }];
  // grade bands bar (ordinal blue ramp low->high)
  const bands = a.grade_bands_sitters.slice().reverse(); // low..high
  const bandBar = [{
    type: "bar", x: bands.map(L), y: bands.map((b) => b.count),
    marker: { color: bands.map((_, i) => BLUE_RAMP[Math.min(i, BLUE_RAMP.length - 1)]), line: { width: 0 } },
    text: bands.map((b) => compact(b.count)), textposition: "outside",
    textfont: { color: c.ink2, size: 11 },
    hovertemplate: "%{x}<br>%{y:,} " + t("students") + "<extra></extra>",
  }];
  // thresholds
  const th = a.thresholds;
  const thrBar = [{
    type: "bar", orientation: "h",
    y: th.map((x) => "≥ " + x.threshold + "%").reverse(),
    x: th.map((x) => x.count_sitters).reverse(),
    marker: { color: c.accent, line: { width: 0 } },
    text: th.map((x) => compact(x.count_sitters) + "  ·  " + nf1(x.pct_sitters, 1) + "%").reverse(),
    textposition: "auto", textfont: { color: "#fff", size: 11 },
    hovertemplate: "%{y}: %{x:,}<extra></extra>",
  }];

  const insights = (store.lang === "ar" ? a.insights.ar : a.insights.en).slice(0, 6);

  return html`<div class="page">
    <${SecHead} title=${t("ov_title")} sub=${t("ov_sub")}
      right=${html`<span class="pill"><span class="dot" style="background:var(--accent)"></span>${t("updated")}</span>`} />

    <div class="grid g-4" style="margin:16px 0">
      <${KPI} icon="👥" label=${t("total_students")} tone="var(--accent)"
        value=${html`<${CountUp} to=${co.total_students} />`}
        sub=${html`<span class="muted">${nf(co.sitters)} ${t("exam_sitters")}</span>`} />
      <${KPI} icon="✅" label=${t("pass_rate")} tone="var(--good)"
        value=${html`<${CountUp} to=${passd.pct} decimals=${1} suffix="%" />`}
        sub=${html`<span class="muted">${nf(passd.count)} ${t("students")}</span>`} />
      <${KPI} icon="📊" label=${t("mean_pct")} tone="var(--accent-3)"
        value=${html`<${CountUp} to=${a.stats_pct.mean} decimals=${1} suffix="%" />`}
        sub=${html`<span class="muted">${t("median_pct")}: ${nf1(a.stats_pct.median, 1)}%</span>`} />
      <${KPI} icon="🏆" label=${t("above_90")} tone="var(--accent-2)"
        value=${html`<${CountUp} to=${above90.count_sitters} />`}
        sub=${html`<span class="muted">${nf1(above90.pct_sitters, 2)}% · 95%+: ${nf(ge95.count)}</span>`} />
    </div>

    <div class="grid g-3" style="margin-bottom:18px">
      <${Card} title=${t("status_split")} cls="span-1">
        <${Chart} className="chart-mid" data=${donut} layout=${baseLayout({
          showlegend: true, margin: { l: 10, r: 10, t: 10, b: 10 },
          legend: { orientation: "h", y: -0.05, x: 0.5, xanchor: "center", font: { color: c.ink2, size: 11 } },
          annotations: [{ text: nf(co.total_students) + "<br><span style='font-size:11px'>" + t("students") + "</span>",
            showarrow: false, font: { color: c.ink, size: 20 }, x: 0.5, y: 0.5 }],
        })} />
      <//>
      <${Card} title=${t("grade_bands")} cls="span-2">
        <${Chart} className="chart-mid" data=${bandBar} layout=${baseLayout({ margin: { l: 46, r: 16, t: 24, b: 60 } })} />
      <//>
    </div>

    <div class="grid g-2" style="margin-bottom:18px">
      <${Card} title=${t("students_above")} desc=${t("out_of_320")}>
        <${Chart} className="chart-mid" data=${thrBar} layout=${baseLayout({ margin: { l: 60, r: 20, t: 10, b: 36 } })} />
      <//>
      <${Card} title=${t("ai_insights")}>
        <div class="grid" style="gap:10px">
          ${insights.map((s) => html`<${Insight} text=${s} />`)}
        </div>
      <//>
    </div>

    <${Card} title=${t("leaderboard")} desc=${"Top 5"}
      right=${html`<a class="btn sm" href="#/top">${t("view_all")} →</a>`}>
      ${miniLeaderboard(a.top_100.slice(0, 5))}
    <//>
  </div>`;
}

function miniLeaderboard(rows) {
  return html`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th class="no-sort">${t("rank")}</th><th class="no-sort">${t("name")}</th>
      <th class="no-sort">${t("seat")}</th><th class="no-sort">${t("score")}</th><th class="no-sort">${t("percentage")}</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr>
      <td><span class=${medal(r.national_rank)}>${nf(r.national_rank)}</span></td>
      <td style="font-weight:650">${r.name}</td>
      <td class="mono muted">${r.seating_no}</td>
      <td class="tabnums">${nf1(r.total_degree, 1)}</td>
      <td class="tabnums" style="font-weight:750;color:var(--accent)">${nf1(r.percentage, 2)}%</td>
    </tr>`)}</tbody></table></div>`;
}

/* =======================================================================
   SCORE DISTRIBUTION
   ======================================================================= */
export function Distribution() {
  const { loading, data: a, error } = useAsync(() => api.analytics(), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;
  const c = colors();

  const H = a.histogram_pct;
  // normal overlay scaled to counts
  const { mu, sigma } = a.normal_fit_pct;
  const binW = H.bin_edges[1] - H.bin_edges[0];
  const normY = H.bin_centers.map((x) =>
    H.total * binW * (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2));
  const hist = [
    { type: "bar", x: H.bin_centers, y: H.counts, name: t("histogram"),
      marker: { color: c.accent, line: { width: 0 } },
      hovertemplate: "%{x:.0f}% : %{y:,}<extra></extra>" },
    { type: "scatter", mode: "lines", x: H.bin_centers, y: normY, name: "Normal fit",
      line: { color: c.s2 || c.series[1], width: 2, dash: "dot" }, hoverinfo: "skip" },
  ];

  const dens = [{ type: "scatter", mode: "lines", x: a.density_pct.x, y: a.density_pct.y,
    fill: "tozeroy", line: { color: c.accent3, width: 2 },
    fillcolor: c.accent3 + "33",
    hovertemplate: "%{x:.1f}% <extra></extra>" }];

  const cdf = [{ type: "scatter", mode: "lines", x: a.cdf_pct.x, y: a.cdf_pct.y,
    line: { color: c.accent2, width: 2.5 }, fill: "tozeroy",
    fillcolor: c.accent2 + "22", hovertemplate: "%{x:.1f}% → %{y:.1f}%<extra></extra>" }];

  // box overall + per status
  const box = a.violin_by_status.map((v) => ({
    type: "box", name: L(v), x: undefined,
    q1: [v.box.q1], median: [v.box.median], q3: [v.box.q3],
    lowerfence: [v.box.lower_whisker], upperfence: [v.box.upper_whisker],
    mean: [v.box.mean], y0: L(v), orientation: "h",
    marker: { color: statusColor(v.key) }, line: { color: statusColor(v.key) },
    hovertemplate: `${L(v)}<br>Q1 ${nf1(v.box.q1,1)} · Med ${nf1(v.box.median,1)} · Q3 ${nf1(v.box.q3,1)}<extra></extra>`,
  }));

  // violin from kde curves (mirror)
  const violin = [];
  a.violin_by_status.forEach((v, i) => {
    const maxD = Math.max(...v.kde.y) || 1;
    const half = v.kde.y.map((d) => (d / maxD) * 0.42);
    const base = i;
    violin.push({ type: "scatter", mode: "lines", x: v.kde.x, y: half.map((hh) => base + hh),
      line: { color: statusColor(v.key), width: 1.5 }, fill: "tonexty", showlegend: false, hoverinfo: "skip",
      fillcolor: statusColor(v.key) + "33", name: L(v) });
    violin.push({ type: "scatter", mode: "lines", x: v.kde.x, y: half.map((hh) => base - hh),
      line: { color: statusColor(v.key), width: 1.5 }, showlegend: false,
      hovertemplate: `${L(v)}: %{x:.1f}%<extra></extra>`, name: L(v) });
  });

  // frequency: top-frequency scores (density of scores)
  const ft = a.frequency_table;
  const freqTrace = [{ type: "bar", x: ft.map((r) => r.pct_value), y: ft.map((r) => r.count),
    marker: { color: c.accent }, hovertemplate: "%{x:.1f}% : %{y:,}<extra></extra>" }];

  const b = a.box_overall;
  return html`<div class="page">
    <${SecHead} title=${t("dist_title")} sub=${t("dist_sub")} />

    <div class="grid g-4" style="margin:16px 0">
      <${Stat} t=${t("mean_pct")} v=${nf1(a.stats_pct.mean, 2)} u="%" />
      <${Stat} t=${t("median_pct")} v=${nf1(a.stats_pct.median, 2)} u="%" />
      <${Stat} t=${t("std_dev")} v=${nf1(a.stats_pct.std, 2)} u="pts" />
      <${Stat} t="IQR" v=${nf1(a.stats_pct.iqr, 2)} u="%" />
    </div>

    <${Card} title=${t("histogram")} desc=${`μ=${nf1(mu,1)}% · σ=${nf1(sigma,1)} · ${nf(H.total)} ${t("students")}`}>
      <${Chart} className="chart-tall" data=${hist} layout=${baseLayout({ bargap: 0.04,
        xaxis: { title: { text: t("percentage"), font: { color: c.muted, size: 11 } }, gridcolor: c.grid, tickfont: { color: c.muted } },
        yaxis: { title: { text: t("students"), font: { color: c.muted, size: 11 } }, gridcolor: c.grid, tickfont: { color: c.muted } } })} />
    <//>

    <div class="grid g-2" style="margin:18px 0">
      <${Card} title=${t("density")}>
        <${Chart} className="chart-mid" data=${dens} layout=${baseLayout()} />
      <//>
      <${Card} title=${t("cdf")} desc=${"% ≤ x"}>
        <${Chart} className="chart-mid" data=${cdf} layout=${baseLayout({ yaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
      <//>
    </div>

    <div class="grid g-2" style="margin-bottom:18px">
      <${Card} title=${t("boxplot")} desc=${`${t("median_pct")} ${nf1(b.median,1)}% · Q1 ${nf1(b.q1,1)} · Q3 ${nf1(b.q3,1)}`}>
        <${Chart} className="chart-mid" data=${box} layout=${baseLayout({ showlegend: false,
          xaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
      <//>
      <${Card} title=${t("violin")}>
        <${Chart} className="chart-mid" data=${violin} layout=${baseLayout({ showlegend: false,
          xaxis: { ticksuffix: "%", title: { text: t("percentage"), font: { color: c.muted } }, gridcolor: c.grid, tickfont: { color: c.muted } },
          yaxis: { tickvals: a.violin_by_status.map((_, i) => i), ticktext: a.violin_by_status.map(L), tickfont: { color: c.ink2 } } })} />
      <//>
    </div>

    <${Card} title=${t("freq_table")} desc=${`${nf(ft.length)} ${t("of")} 641 ${t("score")}`}>
      <${Chart} className="chart-mid" data=${freqTrace} layout=${baseLayout({ bargap: 0.02,
        xaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
    <//>
  </div>`;
}

/* =======================================================================
   TOP PERFORMERS
   ======================================================================= */
export function TopPerformers() {
  const { loading, data: a, error } = useAsync(() => api.analytics(), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;
  const c = colors();
  const co = a.cohort, ex = a.extremes;
  const top = a.top_100;
  const podium = top.slice(0, 3);

  const cols = [
    { key: "national_rank", label: t("rank"), render: (r) => html`<span class=${medal(r.national_rank)}>${nf(r.national_rank)}</span>`, exportValue: (r) => r.national_rank },
    { key: "name", label: t("name"), render: (r) => html`<span style="font-weight:650">${r.name}</span>` },
    { key: "seating_no", label: t("seat"), render: (r) => html`<span class="mono muted">${r.seating_no}</span>` },
    { key: "total_degree", label: t("score"), render: (r) => html`<span class="tabnums">${nf1(r.total_degree, 1)}</span>`, exportValue: (r) => r.total_degree },
    { key: "percentage", label: t("percentage"), render: (r) => html`<span class="tabnums" style="font-weight:750;color:var(--accent)">${nf1(r.percentage, 3)}%</span>`, exportValue: (r) => r.percentage },
    { key: "performance_index", label: t("perf_index"), render: (r) => html`<span class="tabnums">${nf1(r.performance_index, 1)}</span>`, exportValue: (r) => r.performance_index },
  ];

  return html`<div class="page">
    <${SecHead} title=${t("top_title")} sub=${t("top_sub")} />

    <div class="grid g-3" style="margin:16px 0">
      ${podium.map((p, i) => html`
        <div class="card hover" style=${`border-color:${[ "#e8a400", "#aab6c8", "#c9793f" ][i]}55`}>
          <div style="display:flex;align-items:center;gap:14px">
            <div class=${medal(p.national_rank)} style="width:52px;height:52px;font-size:22px;border-radius:14px">${i + 1}</div>
            <div style="min-width:0">
              <div style="font-weight:750;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
              <div class="muted mono" style="font-size:12px">${t("seat")} ${p.seating_no}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:16px">
            <div><div class="muted" style="font-size:11px">${t("score")}</div><div style="font-weight:800;font-size:20px" class="tabnums">${nf1(p.total_degree,1)}</div></div>
            <div style="text-align:end"><div class="muted" style="font-size:11px">${t("percentage")}</div>
              <div style="font-weight:800;font-size:20px;color:var(--accent)" class="tabnums">${nf1(p.percentage,2)}%</div></div>
          </div>
        </div>`)}
    </div>

    <div class="grid g-4" style="margin-bottom:18px">
      <${KPI} icon="💯" label=${t("perfect_scores")} value=${nf(ex.perfect_scores)} tone="var(--good)"
        sub=${html`<span class="muted">320 / 320</span>`} />
      <${KPI} icon="⭐" label="Top 1%" value=${nf(Math.round(co.sitters * 0.01))} tone="var(--accent)"
        sub=${html`<span class="muted">≥ ${nf1(a.percentiles_pct["99"],1)}%</span>`} />
      <${KPI} icon="🎖" label="Top 5%" value=${nf(Math.round(co.sitters * 0.05))} tone="var(--accent-3)"
        sub=${html`<span class="muted">≥ ${nf1(a.percentiles_pct["95"],1)}%</span>`} />
      <${KPI} icon="🏅" label="Top 10%" value=${nf(Math.round(co.sitters * 0.10))} tone="var(--accent-2)"
        sub=${html`<span class="muted">≥ ${nf1(a.percentiles_pct["90"],1)}%</span>`} />
    </div>

    <${Card} title=${t("leaderboard")} desc=${"Top 100"}>
      <${DataTable} columns=${cols} rows=${top} exportName="thanaweya-2026-top100" />
    <//>
  </div>`;
}

/* =======================================================================
   STATISTICAL ANALYSIS
   ======================================================================= */
export function Statistics() {
  const { loading, data: a, error } = useAsync(() => api.analytics(), []);
  if (loading) return html`<${Loading} />`;
  if (error) return html`<${ErrorBox} error=${error} />`;
  const c = colors();
  const s = a.stats_pct, ss = a.stats_score;

  const stats = [
    ["Mean μ", nf1(s.mean, 3), "%"], ["Median", nf1(s.median, 3), "%"],
    ["Mode", nf1(ss.mode, 0) + "/320", ""], ["Std σ", nf1(s.std, 3), ""],
    ["Variance", nf1(s.variance, 2), ""], ["Skewness", nf1(s.skewness, 3), ""],
    ["Kurtosis", nf1(s.kurtosis_excess, 3), ""], ["Range", nf1(s.range, 1), "%"],
    ["IQR", nf1(s.iqr, 2), "%"], ["CV", nf1(s.cv_pct, 2), "%"],
    ["SEM", nf1(s.sem, 4), ""], ["N", compact(s.n), ""],
  ];

  const P = a.percentiles_pct;
  const pk = Object.keys(P);
  const pctBar = [{ type: "bar", x: pk.map((k) => "P" + k), y: pk.map((k) => P[k]),
    marker: { color: pk.map((_, i) => BLUE_RAMP[Math.min(i, 6)]) },
    text: pk.map((k) => nf1(P[k], 1) + "%"), textposition: "outside", textfont: { color: c.ink2, size: 10 },
    hovertemplate: "P%{x}: %{y:.2f}%<extra></extra>" }];

  // clusters
  const cl = a.clusters.clusters;
  const clTrace = [{ type: "bar", x: cl.map((k) => "C" + k.cluster + " · " + nf1(k.center_pct, 0) + "%"),
    y: cl.map((k) => k.share_pct), marker: { color: cl.map((_, i) => BLUE_RAMP[Math.min(i + 1, 6)]) },
    text: cl.map((k) => nf1(k.share_pct, 1) + "%"), textposition: "outside", textfont: { color: c.ink2, size: 10 },
    hovertemplate: "%{x}<br>%{y:.1f}% · center %{customdata:.0f}/320<extra></extra>",
    customdata: cl.map((k) => k.center_score) }];

  // pareto
  const pb = a.pareto_bands;
  const pareto = [
    { type: "bar", x: pb.map(L), y: pb.map((r) => r.count), name: t("students"),
      marker: { color: c.accent }, hovertemplate: "%{x}: %{y:,}<extra></extra>" },
    { type: "scatter", mode: "lines+markers", x: pb.map(L), y: pb.map((r) => r.cumulative_pct),
      name: "Cumulative %", yaxis: "y2", line: { color: c.s2 || c.series[1], width: 2.5 }, marker: { size: 6 },
      hovertemplate: "%{y:.1f}%<extra></extra>" },
  ];

  // heatmap
  const hm = a.heatmap_band_status;
  const heat = [{ type: "heatmap", z: hm.matrix,
    x: hm.statuses.map(L), y: hm.bands.map(L),
    colorscale: [[0, c.surface], [0.15, BLUE_RAMP[1]], [0.5, BLUE_RAMP[3]], [1, BLUE_RAMP[6]]],
    hovertemplate: "%{y} · %{x}: %{z:,}<extra></extra>", colorbar: { tickfont: { color: c.muted } } }];

  const norm = a.normality;
  const normRows = [
    ["Shapiro–Wilk", norm.shapiro_wilk], ["D'Agostino K²", norm.dagostino_k2],
    ["Jarque–Bera", norm.jarque_bera],
  ].filter((r) => r[1]);

  return html`<div class="page">
    <${SecHead} title=${t("stat_title")} sub=${t("stat_sub")} />

    <${Card} title=${t("moments")} cls="span-full" >
      <div class="grid g-4" style="gap:12px">
        ${stats.map(([k, v, u]) => html`<div class="stat-tile"><div class="t">${k}</div><div class="v">${v}${u && html` <span class="u">${u}</span>`}</div></div>`)}
      </div>
    <//>

    <div class="grid g-2" style="margin:18px 0">
      <${Card} title=${t("percentiles")} desc=${t("percentage")}>
        <${Chart} className="chart-mid" data=${pctBar} layout=${baseLayout({ yaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
      <//>
      <${Card} title=${t("clusters")} desc=${`K=${a.clusters.k} · sample ${compact(a.clusters.sample_n)}`}>
        <${Chart} className="chart-mid" data=${clTrace} layout=${baseLayout({ yaxis: { ticksuffix: "%", gridcolor: c.grid, tickfont: { color: c.muted } } })} />
      <//>
    </div>

    <div class="grid g-2" style="margin-bottom:18px">
      <${Card} title=${t("pareto")}>
        <${Chart} className="chart-mid" data=${pareto} layout=${baseLayout({
          xaxis: { tickangle: -20, gridcolor: c.grid, tickfont: { color: c.muted, size: 10 } },
          yaxis: { gridcolor: c.grid, tickfont: { color: c.muted } },
          yaxis2: { overlaying: "y", side: store.lang === "ar" ? "left" : "right", range: [0, 105], ticksuffix: "%", tickfont: { color: c.muted }, showgrid: false },
          legend: { orientation: "h", y: 1.12, font: { color: c.ink2, size: 11 } } })} />
      <//>
      <${Card} title=${t("heatmap")}>
        <${Chart} className="chart-mid" data=${heat} layout=${baseLayout({ margin: { l: 96, r: 20, t: 12, b: 40 } })} />
      <//>
    </div>

    <${Card} title=${t("normality")}>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th class="no-sort">Test</th><th class="no-sort">Statistic</th><th class="no-sort">p-value</th><th class="no-sort">Normal @0.05</th></tr></thead>
        <tbody>${normRows.map(([name, r]) => html`<tr>
          <td style="font-weight:650">${name}</td>
          <td class="tabnums">${nf1(r.statistic, 3)}</td>
          <td class="tabnums">${r.p_value < 1e-6 ? "< 1e-6" : nf1(r.p_value, 4)}</td>
          <td>${r["normal_at_0.05"] ? html`<span class="pill good">Yes</span>` : html`<span class="pill bad">No</span>`}</td>
        </tr>`)}</tbody></table></div>
      <p class="muted" style="font-size:12.5px;margin:12px 0 0">${norm.verdict}</p>
    <//>
  </div>`;
}
