// Plotly integration: theme-aware colors, a shared layout, and a Chart component
// that re-plots on theme/language change. Plotly is loaded globally.
import { h, useRef, useEffect } from "./preact.js";
import { store } from "./store.js";

const Plotly = window.Plotly;

export function colors() {
  const s = getComputedStyle(document.documentElement);
  const g = (v) => s.getPropertyValue(v).trim();
  return {
    ink: g("--ink"), ink2: g("--ink-2"), muted: g("--muted"),
    grid: g("--grid"), axis: g("--axis"), surface: g("--chart-surface"),
    accent: g("--accent"), accent2: g("--accent-2"), accent3: g("--accent-3"),
    series: [g("--s1"), g("--s2"), g("--s3"), g("--s4"), g("--s5"), g("--s6"), g("--s7"), g("--s8")],
    good: g("--good"), warn: g("--warn"), serious: g("--serious"), critical: g("--critical"),
  };
}

// Fixed status colors (state palette + label, never color-alone in the UI).
export function statusColor(key) {
  const c = colors();
  return { pass_r1: c.good, round2: c.warn, fail_r1: c.critical, absent: c.muted }[key] || c.series[0];
}

// Blue sequential ramp for ordinal grade bands (light->dark = low->high band).
export const BLUE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

export function baseLayout(over = {}) {
  const c = colors();
  const rtl = store.lang === "ar";
  const font = { family: '"Segoe UI", system-ui, Tahoma, sans-serif', color: c.ink2, size: 12.5 };
  return Object.assign({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font,
    margin: { l: 54, r: 22, t: 16, b: 44 },
    hovermode: "closest",
    hoverlabel: {
      bgcolor: c.surface, bordercolor: c.axis,
      font: { color: c.ink, family: font.family, size: 12.5 },
      align: rtl ? "right" : "left",
    },
    xaxis: {
      gridcolor: c.grid, zerolinecolor: c.axis, linecolor: c.axis,
      tickfont: { color: c.muted, size: 11.5 }, automargin: true,
    },
    yaxis: {
      gridcolor: c.grid, zerolinecolor: c.axis, linecolor: c.axis,
      tickfont: { color: c.muted, size: 11.5 }, automargin: true,
    },
    legend: {
      orientation: "h", y: 1.14, x: rtl ? 1 : 0, xanchor: rtl ? "right" : "left",
      font: { color: c.ink2, size: 11.5 }, bgcolor: "rgba(0,0,0,0)",
    },
    colorway: colors().series,
  }, over);
}

export const chartConfig = {
  responsive: true, displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d", "toggleSpikelines"],
  toImageButtonOptions: { format: "png", scale: 2, filename: "thanaweya-2026-chart" },
};

// Preact component: renders {data, layout} into a div and re-plots on theme change.
export function Chart({ data, layout, config, className, style }) {
  const ref = useRef(null);
  // depend on theme+lang so a toggle forces a full re-theme
  useEffect(() => {
    if (!ref.current || !Plotly) return;
    Plotly.react(ref.current, data, layout, Object.assign({}, chartConfig, config || {}));
    return () => { try { Plotly.purge(ref.current); } catch (_) {} };
  }, [JSON.stringify(data).length, JSON.stringify(layout || {}).length, store.theme, store.lang, data, layout]);
  return h("div", { ref, className: "chart " + (className || ""), style });
}
