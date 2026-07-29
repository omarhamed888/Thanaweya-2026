// Application shell: sidebar nav, top bar, hash router, theme/lang toggles.
import { html, render, useState, useEffect } from "./preact.js";
import { store, subscribe, toggleTheme, toggleLang } from "./store.js";
import { t } from "./i18n.js";
import { Overview, Distribution, TopPerformers, Statistics } from "./dash_analysis.js";
import { Predictions, Admission, Search, Quality } from "./dash_explore.js";
import { Home, About, Methodology, FAQ } from "./site.js";

const ROUTES = {
  "/": { comp: Home, key: "home", icon: "🏠", group: null },
  "/overview": { comp: Overview, key: "overview", icon: "📊", group: "analytics" },
  "/distribution": { comp: Distribution, key: "distribution", icon: "📈", group: "analytics" },
  "/top": { comp: TopPerformers, key: "top", icon: "🏆", group: "analytics" },
  "/stats": { comp: Statistics, key: "stats", icon: "🧮", group: "analytics" },
  "/predictions": { comp: Predictions, key: "predictions", icon: "🔮", group: "analytics" },
  "/admission": { comp: Admission, key: "admission", icon: "🎓", group: "analytics" },
  "/search": { comp: Search, key: "search", icon: "🔎", group: "analytics" },
  "/quality": { comp: Quality, key: "quality", icon: "🧪", group: "analytics" },
  "/about": { comp: About, key: "about", icon: "ℹ️", group: "site" },
  "/methodology": { comp: Methodology, key: "methodology", icon: "📖", group: "site" },
  "/faq": { comp: FAQ, key: "faq", icon: "❓", group: "site" },
};

const NAV_ANALYTICS = ["/overview", "/distribution", "/top", "/stats", "/predictions", "/admission", "/search", "/quality"];
const NAV_SITE = ["/", "/about", "/methodology", "/faq"];

function currentPath() {
  const h = location.hash.replace(/^#/, "") || "/";
  return ROUTES[h] ? h : "/";
}

function App() {
  const [path, setPath] = useState(currentPath());
  const [, force] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => { setPath(currentPath()); setMenuOpen(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    const unsub = subscribe(() => force((n) => n + 1)); // re-render on theme/lang
    return () => { window.removeEventListener("hashchange", onHash); unsub(); };
  }, []);

  const route = ROUTES[path];
  const Page = route.comp;

  const navItem = (p) => {
    const r = ROUTES[p];
    return html`<a class=${"nav-item " + (p === path ? "active" : "")} href=${"#" + p}>
      <span class="ic" style="font-size:16px">${r.icon}</span><span>${t(r.key)}</span></a>`;
  };

  return html`
    <div class="aurora"></div>
    <div class="app">
      <aside class=${"sidebar " + (menuOpen ? "open" : "")}>
        <div class="brand">
          <div class="brand-logo">ث</div>
          <div class="brand-txt"><b>${t("brand_name")}</b><span>${t("brand_tag")}</span></div>
        </div>
        <div class="nav-group-label">${t("nav_analytics")}</div>
        ${NAV_ANALYTICS.map(navItem)}
        <div class="nav-group-label">${t("nav_site")}</div>
        ${NAV_SITE.map(navItem)}
        <div class="sidebar-foot">${t("built_with")}<br/>© 2026 · v1.0</div>
      </aside>
      <div class=${"scrim " + (menuOpen ? "show" : "")} onClick=${() => setMenuOpen(false)}></div>

      <div class="main">
        <header class="topbar">
          <button class="iconbtn hamburger" onClick=${() => setMenuOpen(true)}>☰</button>
          <div>
            <div class="page-title">${t(route.key)}</div>
            <div class="page-sub">${t("brand_name")} · ${t("brand_tag")}</div>
          </div>
          <div class="spacer"></div>
          <button class="iconbtn" title="Language" onClick=${toggleLang}>${store.lang === "ar" ? "EN" : "ع"}</button>
          <button class="iconbtn" title="Theme" onClick=${toggleTheme}>${store.theme === "dark" ? "☀️" : "🌙"}</button>
        </header>
        <main class="content"><${Page} key=${path + store.lang} /></main>
      </div>
    </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
