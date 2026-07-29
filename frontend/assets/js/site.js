// Website pages: Home, About, Methodology, FAQ.
import { html, useState } from "./preact.js";
import { store } from "./store.js";
import { api } from "./api.js";
import { t } from "./i18n.js";
import { nf, nf1, compact } from "./format.js";
import { SecHead, Card, useAsync, CountUp, Insight } from "./ui.js";
import { CREATORS, LINKEDIN_ICON } from "./creators.js";

const AR = () => store.lang === "ar";
const go = (h) => () => { location.hash = h; };

/* =======================================================================
   HOME
   ======================================================================= */
export function Home() {
  const { data: m } = useAsync(() => api.meta(), []);
  const co = m && m.cohort;
  const top = m && m.predictions_summary && m.predictions_summary.top;

  const features = [
    ["📊", { en: "Deep Analytics", ar: "تحليلات عميقة" }, { en: "Distribution, percentiles, skewness, kurtosis, normality tests and K-means clusters over 884k exam-sitters.", ar: "توزيع ومئينيات والتواء وتفلطح واختبارات طبيعية وتجميعات على أكثر من 884 ألف طالب." }, "#/stats"],
    ["🎓", { en: "Admission Predictions", ar: "توقعات القبول" }, { en: "Statistically estimated 2026 cutoffs for 14 faculties with optimistic / expected / pessimistic scenarios.", ar: "تقدير إحصائي لحدود القبول 2026 لأربع عشرة كلية بسيناريوهات متفائل / متوقع / متشائم." }, "#/predictions"],
    ["🔎", { en: "Instant Search", ar: "بحث فوري" }, { en: "Find any of 919,396 students by seat number or Arabic name in milliseconds (FTS5).", ar: "ابحث عن أي طالب من 919,396 برقم الجلوس أو الاسم في أجزاء من الثانية." }, "#/search"],
    ["🧪", { en: "Full Transparency", ar: "شفافية كاملة" }, { en: "A complete data-quality report: cleaning, validation, duplicates, outliers and every assumption.", ar: "تقرير جودة كامل: تنظيف وتحقق وتكرارات وقيم شاذة وكل الافتراضات." }, "#/quality"],
  ];

  return html`<div class="page">
    <div class="card" style="padding:0;overflow:hidden;position:relative">
      <div style="padding:clamp(28px,5vw,64px);position:relative;z-index:1">
        <span class="pill" style="margin-bottom:18px"><span class="dot" style="background:var(--accent)"></span>${m ? m.meta.system : t("loading")}</span>
        <h1 style="font-size:clamp(30px,5.4vw,56px);font-weight:850;letter-spacing:-.02em;line-height:1.05;margin:8px 0 6px">
          ${AR() ? "منصة تحليلات الثانوية العامة 2026" : "Thanaweya Amma 2026 Analytics"}</h1>
        <p class="muted" style="font-size:clamp(14px,2vw,18px);max-width:640px;margin:0 0 8px">
          ${AR() ? "تحليل بيانات احترافي، إحصاءات متقدمة، وتوقعات قبول جامعي لنتائج الثانوية العامة المصرية بالنظام الحديث."
                 : "Production-grade data analysis, advanced statistics and university-admission forecasting for the Egyptian Thanaweya Amma results (new system)."}</p>
        <div class="hero-num" style="margin:18px 0 6px">${co ? html`<${CountUp} to=${co.total_students} />` : "—"}</div>
        <div class="muted" style="font-weight:600">${AR() ? "طالب في قاعدة البيانات" : "students analyzed"}</div>
        <div style="display:flex;gap:12px;margin-top:26px;flex-wrap:wrap">
          <button class="btn primary" onClick=${go("#/overview")}>📊 ${AR() ? "افتح لوحة التحكم" : "Open Dashboard"}</button>
          <button class="btn" onClick=${go("#/search")}>🔎 ${t("search")}</button>
          <button class="btn" onClick=${go("#/methodology")}>📖 ${t("methodology")}</button>
        </div>
      </div>
      <div class="aurora" style="position:absolute;inset:0;z-index:0;opacity:.6"></div>
    </div>

    ${co && html`<div class="grid g-4" style="margin:18px 0">
      <div class="card center"><div class="hero-num" style="font-size:34px"><${CountUp} to=${co.sitters} /></div><div class="muted">${t("exam_sitters")}</div></div>
      <div class="card center"><div class="hero-num" style="font-size:34px"><${CountUp} to=${co.absent} /></div><div class="muted">${AR() ? "غياب كلي" : "absent"}</div></div>
      <div class="card center"><div class="hero-num" style="font-size:34px">320</div><div class="muted">${AR() ? "الدرجة العظمى" : "max score"}</div></div>
      <div class="card center"><div class="hero-num" style="font-size:34px">14</div><div class="muted">${AR() ? "كلية متوقعة" : "faculties modeled"}</div></div>
    </div>`}

    <div class="grid g-2" style="margin-bottom:18px">
      ${features.map(([ic, ti, de, hrefto]) => html`
        <div class="card hover" onClick=${go(hrefto)} style="cursor:pointer">
          <div style="display:flex;gap:14px;align-items:flex-start">
            <div class="brand-logo" style="background:var(--surface-2);color:var(--accent);font-size:22px">${ic}</div>
            <div><div class="card-title" style="font-size:16px">${ti[store.lang] || ti.en}</div>
              <p class="muted" style="margin:6px 0 0;font-size:13.5px;line-height:1.6">${de[store.lang] || de.en}</p></div>
          </div>
        </div>`)}
    </div>

    ${top && html`<${Card} title=${AR() ? "أعلى الحدود المتوقعة للقبول 2026" : "Top Expected 2026 Cutoffs"}
        right=${html`<a class="btn sm" href="#/predictions">${t("view_all")} →</a>`}>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${top.slice(0, 6).map((f) => html`<div class="stat-tile" style="flex:1;min-width:150px">
          <div class="t">${store.lang === "ar" ? f.name_ar : f.name_en}</div>
          <div class="v">${nf1(f.expected_cutoff, 1)}%</div>
          <div class="u">${nf1(f.score_needed, 0)}/320</div></div>`)}
      </div>
    <//>`}

    <${Card} title=${t("creators_title")} cls="span-full" style="margin-top:18px">
      <div class="creators-row">
        <img src="/assets/img/logo.png" alt="Omar &amp; Tayam" class="creators-avatar" />
        <div style="flex:1;min-width:0">
          <p class="muted" style="margin:0 0 12px;font-size:13.5px;line-height:1.7">${AR()
            ? "المنصة دي اتصممت وابتُنيت بواسطة عمر وتيام."
            : "This platform was designed and built by Omar and Tayam."}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${CREATORS.map((c) => html`<a class="btn sm" href=${c.linkedin} target="_blank" rel="noopener noreferrer">
              <span dangerouslySetInnerHTML=${{ __html: LINKEDIN_ICON }}></span>${AR() ? c.nameAr : c.name}</a>`)}
          </div>
        </div>
      </div>
    <//>
  </div>`;
}

/* =======================================================================
   ABOUT
   ======================================================================= */
export function About() {
  return html`<div class="page">
    <${SecHead} title=${t("about")} sub=${AR() ? "عن المنصة ومصدر البيانات والحدود." : "About this platform, its data and its limitations."} />
    <div class="grid g-2" style="margin-top:16px">
      <${Card} title=${AR() ? "ما هذه المنصة؟" : "What is this?"}>
        <p class="muted" style="line-height:1.7;font-size:13.5px">${AR()
          ? "منصة تحليلات متكاملة مبنية فوق نتائج الثانوية العامة المصرية 2026 (النظام الحديث). تشمل خط معالجة بيانات كامل، وتحليلًا إحصائيًا متقدمًا، ومحرك بحث فوري، ونماذج تقدير لحدود القبول الجامعي."
          : "A complete analytics platform built on the Egyptian Thanaweya Amma 2026 (new system) results. It includes a full data-engineering pipeline, advanced statistics, an instant search engine, and admission-cutoff estimation models."}</p>
      <//>
      <${Card} title=${AR() ? "مجموعة البيانات" : "The Dataset"}>
        <ul class="muted" style="line-height:1.9;font-size:13.5px;padding-inline-start:18px;margin:0">
          <li>${AR() ? "919,396 طالبًا" : "919,396 students"}</li>
          <li>${AR() ? "الحقول: الاسم، رقم الجلوس، الدرجة الكلية (من 320)، الحالة" : "Fields: name, seat number, total degree (out of 320), status"}</li>
          <li>${AR() ? "النسبة المئوية = الدرجة ÷ 320 × 100" : "Percentage = degree ÷ 320 × 100"}</li>
          <li>${AR() ? "لا يوجد شعبة أكاديمية (علمي/أدبي)" : "No academic track (science/arts)"}</li>
        </ul>
      <//>
      <${Card} title=${AR() ? "المنظومة التقنية" : "Tech Stack"}>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${["Python", "FastAPI", "Pandas", "NumPy", "SciPy", "scikit-learn", "SQLite (FTS5)", "Preact", "htm", "Plotly.js"].map((x) =>
            html`<span class="pill">${x}</span>`)}
        </div>
        <p class="muted" style="line-height:1.7;font-size:13px;margin:14px 0 0">${AR()
          ? "خط معالجة بايثون يبني قاعدة SQLite مفهرسة وملفات تحليلات محسوبة مسبقًا، تخدمها واجهة FastAPI لواجهة أحادية الصفحة خفيفة."
          : "A Python pipeline builds an indexed SQLite database and precomputed analytics files, served by a FastAPI backend to a lightweight single-page app."}</p>
      <//>
      <${Card} title=${AR() ? "حدود مهمة" : "Important Limitations"}>
        <div class="grid" style="gap:10px">
          <${Insight} icon="⚠" text=${AR() ? "لا تحتوي البيانات على الشعبة، لذا تُبنى التوقعات على التوزيع الإجمالي كبديل تقريبي." : "The data has no academic track, so predictions use the overall distribution as a proxy."} />
          <${Insight} icon="⚠" text=${AR() ? "حدود القبول تقديرات استرشادية وليست أرقامًا رسمية." : "Admission cutoffs are directional estimates, not official figures."} />
        </div>
      <//>
    </div>
  </div>`;
}

/* =======================================================================
   METHODOLOGY
   ======================================================================= */
export function Methodology() {
  const steps = [
    ["🧹", { en: "1 · Data Cleaning", ar: "1 · تنظيف البيانات" }, {
      en: "Exact-duplicate removal, Arabic text standardization (NFKC, diacritic & tatweel stripping, alef/hamza/ya/ta-marbuta folding into a search key), whitespace normalization, and strict type coercion.",
      ar: "إزالة التكرارات، وتوحيد النص العربي (NFKC، إزالة التشكيل والتطويل، وطي الألف/الهمزة/الياء/التاء المربوطة في مفتاح بحث)، وتوحيد المسافات، وتحويل الأنواع." }],
    ["✅", { en: "2 · Validation", ar: "2 · التحقق" }, {
      en: "Per-row rules: missing seat/name/score, score < 0 or > 320, and status–score inconsistency (a 'passed' student with a recorded 0). Flagged rows are excluded from the ranked distribution but kept in totals.",
      ar: "قواعد لكل صف: نقص الجلوس/الاسم/الدرجة، درجة أقل من 0 أو أكبر من 320، وتعارض الحالة مع الدرجة (ناجح بدرجة صفر). تُستبعد الصفوف المُعلَّمة من التوزيع لكنها تبقى في الإجماليات." }],
    ["🧬", { en: "3 · Feature Engineering", ar: "3 · هندسة الخصائص" }, {
      en: "Grade band, national rank (competition ranking), percentile, top-1/5/10% flags, a T-score performance index (mean 50, sd 10), and score-frequency density — all computed over the exam-sitter cohort.",
      ar: "الفئة التقديرية، الترتيب القومي، المئيني، مؤشرات أعلى 1/5/10%، مؤشر أداء T (متوسط 50، انحراف 10)، وكثافة تكرار الدرجة — محسوبة على الطلاب المؤدّين." }],
    ["📊", { en: "4 · Statistics & EDA", ar: "4 · الإحصاء والاستكشاف" }, {
      en: "Central tendency & dispersion, skewness/kurtosis, nine percentiles, KDE density, CDF, box & violin by status, K-means clustering, a Pareto, a band×status heatmap, and four normality tests.",
      ar: "النزعة المركزية والتشتت، الالتواء/التفلطح، تسعة مئينيات، كثافة KDE، توزيع تراكمي، صندوق وكمان حسب الحالة، تجميع K-means، باريتو، خريطة حرارية، وأربعة اختبارات طبيعية." }],
    ["🎓", { en: "5 · Admission Prediction", ar: "5 · توقع القبول" }, {
      en: "Linear trend of each faculty's recent cutoffs projected to 2026, nudged by a distribution-pressure term (cohort mean vs a historical baseline), grounded against the real 2026 distribution, with 95% intervals and three scenarios (±0.9σ).",
      ar: "اتجاه خطي لحدود كل كلية يُسقَط إلى 2026، معدّلًا بضغط التوزيع (متوسط الدفعة مقابل أساس تاريخي)، ومربوطًا بالتوزيع الحقيقي لعام 2026، مع فترات ثقة 95% وثلاثة سيناريوهات (±0.9σ)." }],
  ];
  return html`<div class="page">
    <${SecHead} title=${t("methodology")} sub=${AR() ? "كل خطوة من خط المعالجة، بشفافية كاملة." : "Every step of the pipeline, fully transparent."} />
    <div class="grid" style="gap:14px;margin-top:16px">
      ${steps.map(([ic, ti, de]) => html`<div class="card">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <div class="brand-logo" style="background:var(--surface-2);color:var(--accent);font-size:20px;flex:none">${ic}</div>
          <div><div class="card-title" style="font-size:15.5px">${ti[store.lang] || ti.en}</div>
            <p class="muted" style="margin:8px 0 0;line-height:1.7;font-size:13.5px">${de[store.lang] || de.en}</p></div>
        </div></div>`)}
    </div>
    <${Card} title=${AR() ? "صيغة مؤشر ضغط الحدود" : "Cutoff-Pressure Formula"} cls="span-full">
      <p class="mono" style="background:var(--surface-2);padding:14px 16px;border-radius:12px;font-size:13px;overflow-x:auto">
        pressure = clip( 0.35 × (cohort_mean% − 68%), −3, +3 )<br/>
        expected = clip( trend₍₂₀₂₆₎ + pressure, 30, 99.5 )<br/>
        scenarios = expected ± 0.9σ · CI₉₅ = expected ± 1.96σ
      </p>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">${AR()
        ? "σ مشتق من تقلب الحدود التاريخية لكل كلية، بحد أدنى 0.8 نقطة."
        : "σ is derived from each faculty's historical cutoff volatility, floored at 0.8 points."}</p>
    <//>
  </div>`;
}

/* =======================================================================
   FAQ
   ======================================================================= */
export function FAQ() {
  const items = [
    [{ en: "Why is the score out of 320, not 100?", ar: "لماذا الدرجة من 320 وليست 100؟" },
     { en: "The 2026 'new system' Thanaweya Amma is graded out of 320 total marks. Percentage is computed as score ÷ 320 × 100.", ar: "الثانوية العامة 2026 (النظام الحديث) من 320 درجة. تُحسب النسبة كالدرجة ÷ 320 × 100." }],
    [{ en: "Why exclude some students from the distribution?", ar: "لماذا يُستبعد بعض الطلاب من التوزيع؟" },
     { en: "About 30,284 records are marked 'passed' or 'second round' yet carry a recorded total of 0 (score withheld). Keeping those zeros would distort ranks and the mean, so they're excluded from the ranked distribution but kept in status totals.", ar: "نحو 30,284 سجلًا مُعلَّم كـ«ناجح» أو «دور ثانٍ» بدرجة صفر مسجلة. إبقاؤها يشوّه الترتيب والمتوسط، لذا تُستبعد من التوزيع وتبقى في الإجماليات." }],
    [{ en: "How accurate are the admission predictions?", ar: "ما مدى دقة توقعات القبول؟" },
     { en: "They're statistical estimates, not official figures. Because the dataset has no academic track, faculty cutoffs are anchored to historical figures and validated against the overall distribution as a proxy. Treat them as directional guidance.", ar: "إنها تقديرات إحصائية وليست أرقامًا رسمية. لعدم وجود شعبة في البيانات، تُربط الحدود بأرقام تاريخية وتُتحقق مقابل التوزيع الإجمالي كبديل. اعتبرها إرشادية." }],
    [{ en: "How fast is the search over 919k students?", ar: "ما سرعة البحث بين 919 ألف طالب؟" },
     { en: "Seat lookups are sub-millisecond via the primary key. Name search uses an SQLite FTS5 full-text index, returning results in well under a second even for the most common names.", ar: "البحث برقم الجلوس فوري عبر المفتاح الأساسي. البحث بالاسم يستخدم فهرس FTS5 النصي ويعيد النتائج في أقل من ثانية حتى لأكثر الأسماء شيوعًا." }],
    [{ en: "Is my data sent anywhere?", ar: "هل تُرسل بياناتي لأي مكان؟" },
     { en: "No. Everything runs locally: a FastAPI server, a local SQLite database, and precomputed JSON. No external calls and no tracking.", ar: "لا. كل شيء يعمل محليًا: خادم FastAPI وقاعدة SQLite محلية وملفات JSON محسوبة مسبقًا. لا اتصالات خارجية ولا تتبّع." }],
  ];
  const [open, setOpen] = useState(0);
  return html`<div class="page">
    <${SecHead} title=${t("faq")} sub=${AR() ? "أسئلة شائعة حول البيانات والمنهجية." : "Common questions about the data and methodology."} />
    <div class="grid" style="gap:10px;margin-top:16px">
      ${items.map(([qq, aa], i) => html`<div class="card" style="cursor:pointer;padding:0" onClick=${() => setOpen(open === i ? -1 : i)}>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px">
          <div style="font-weight:700;font-size:14.5px">${qq[store.lang] || qq.en}</div>
          <div class="iconbtn" style="width:30px;height:30px;font-size:16px">${open === i ? "−" : "+"}</div>
        </div>
        ${open === i && html`<div class="muted" style="padding:0 20px 18px;line-height:1.7;font-size:13.5px">${aa[store.lang] || aa.en}</div>`}
      </div>`)}
    </div>
  </div>`;
}
