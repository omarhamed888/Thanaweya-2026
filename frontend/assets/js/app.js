// Application shell: sidebar nav, top bar, hash router, theme/lang toggles.
import { html, render, useState, useEffect } from "./preact.js";
import { store, subscribe, toggleTheme } from "./store.js";
import { t } from "./i18n.js";
import { CREATORS, LINKEDIN_ICON } from "./creators.js";
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

function WelcomeModal({ onClose }) {
  return html`<div class="modal-scrim" onClick=${onClose}>
    <div class="modal-card" onClick=${(e) => e.stopPropagation()}>
      <button class="iconbtn modal-close" onClick=${onClose}>✕</button>
      <img src="/assets/img/logo.png" alt=${t("brand_name")} class="modal-logo" />
      <div class="modal-title">${t("brand_name")}</div>
      <div class="modal-sub">${t("brand_tag")}</div>
      <div class="modal-links">
        ${CREATORS.map((c) => html`<a class="btn sm" href=${c.linkedin} target="_blank" rel="noopener noreferrer">
          <span dangerouslySetInnerHTML=${{ __html: LINKEDIN_ICON }}></span>${store.lang === "ar" ? c.nameAr : c.name}</a>`)}
      </div>
    </div>
  </div>`;
}

function App() {
  const [path, setPath] = useState(currentPath());
  const [, force] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem("ta-welcome-seen"));

  useEffect(() => {
    const onHash = () => { setPath(currentPath()); setMenuOpen(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    const unsub = subscribe(() => force((n) => n + 1)); // re-render on theme/lang
    return () => { window.removeEventListener("hashchange", onHash); unsub(); };
  }, []);

  function closeWelcome() { sessionStorage.setItem("ta-welcome-seen", "1"); setShowWelcome(false); }

  const route = ROUTES[path];
  const Page = route.comp;

  const navItem = (p) => {
    const r = ROUTES[p];
    return html`<a class=${"nav-item " + (p === path ? "active" : "")} href=${"#" + p}>
      <span class="ic" style="font-size:16px">${r.icon}</span><span>${t(r.key)}</span></a>`;
  };

  return html`
    ${showWelcome && html`<${WelcomeModal} onClose=${closeWelcome} />`}
    <div class="aurora"></div>
    <div class="app">
      <aside class=${"sidebar " + (menuOpen ? "open" : "")}>
        <div class="brand">
          <div class="brand-logo">
            <img src="/assets/img/logo.png" alt="${t("brand_name")}" onError=${(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "grid"; }} />
            <span class="brand-logo-fallback">AI</span>
          </div>
          <div class="brand-txt"><b>${t("brand_name")}</b><span>${t("brand_tag")}</span></div>
        </div>
        <div class="nav-group-label">${t("nav_analytics")}</div>
        ${NAV_ANALYTICS.map(navItem)}
        <div class="nav-group-label">${t("nav_site")}</div>
        ${NAV_SITE.map(navItem)}
        <div class="sidebar-foot">
          <div class="creator-row">
            <span>${t("made_by")}</span>
            ${CREATORS.map((c) => html`<a class="creator-chip" href=${c.linkedin} target="_blank" rel="noopener noreferrer" title=${c.name}>
              <span dangerouslySetInnerHTML=${{ __html: LINKEDIN_ICON }}></span>${store.lang === "ar" ? c.nameAr : c.name}</a>`)}
          </div>
          <div>© 2026 · v1.0</div>
        </div>
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
          <button class="iconbtn" title="Theme" onClick=${toggleTheme}>${store.theme === "dark" ? "☀️" : "🌙"}</button>
        </header>
        <main class="content"><${Page} key=${path + store.lang} /></main>
      </div>
    </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
