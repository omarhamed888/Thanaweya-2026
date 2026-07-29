// Tiny global store for theme + language + cross-render cache, with subscribers.
const listeners = new Set();

function readTheme() {
  const saved = localStorage.getItem("ta-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light" : "dark";
}
function readLang() {
  const saved = localStorage.getItem("ta-lang");
  return saved === "en" || saved === "ar" ? saved : "ar";
}

export const store = {
  theme: readTheme(),
  lang: readLang(),
  cache: {},          // API response cache
};

function apply() {
  const root = document.documentElement;
  root.setAttribute("data-theme", store.theme);
  root.setAttribute("lang", store.lang);
  root.setAttribute("dir", store.lang === "ar" ? "rtl" : "ltr");
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { apply(); listeners.forEach((f) => f()); }

export function setTheme(t) { store.theme = t; localStorage.setItem("ta-theme", t); emit(); }
export function toggleTheme() { setTheme(store.theme === "dark" ? "light" : "dark"); }
export function setLang(l) { store.lang = l; localStorage.setItem("ta-lang", l); emit(); }
export function toggleLang() { setLang(store.lang === "ar" ? "en" : "ar"); }

apply(); // initial
