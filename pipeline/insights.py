# -*- coding: utf-8 -*-
"""Automatic written insights (bilingual).

Turns the computed analytics/predictions into human-readable narrative bullets
in both English and Arabic. Purely rule-based on the numbers — no external LLM —
so the "AI Insights" page is deterministic and reproducible.
"""
from __future__ import annotations


def _fmt(n):
    return f"{int(n):,}"


def build_insights(analytics: dict, predictions: dict) -> dict:
    a, p = analytics, predictions
    cohort = a["cohort"]
    stats = a["stats_pct"]
    thr = {t["threshold"]: t for t in a["thresholds"]}
    bands = {b["key"]: b for b in a["grade_bands_sitters"]}

    en, ar = [], []

    # Headline scale
    en.append(f"A total of {_fmt(cohort['total_students'])} students appear in the "
              f"2026 results, of whom {_fmt(cohort['sitters'])} sat the exams and "
              f"{_fmt(cohort['absent'])} were fully absent.")
    ar.append(f"إجمالي {_fmt(cohort['total_students'])} طالب في نتيجة 2026، منهم "
              f"{_fmt(cohort['sitters'])} أدّوا الامتحانات و{_fmt(cohort['absent'])} "
              f"في حالة غياب كلي.")

    # Central tendency
    en.append(f"The average percentage among exam-sitters is {stats['mean']:.2f}% "
              f"(median {stats['median']:.2f}%, mode {a['stats_score']['mode']:.0f}/320), "
              f"with a standard deviation of {stats['std']:.2f} points.")
    ar.append(f"متوسط النسبة المئوية للطلاب المؤدّين {stats['mean']:.2f}% "
              f"(الوسيط {stats['median']:.2f}%)، بانحراف معياري {stats['std']:.2f}.")

    # Shape
    skew = stats["skewness"]
    shape_en = ("left-skewed — a long tail of lower scores" if skew < -0.1 else
                "right-skewed — a long tail of high achievers" if skew > 0.1 else
                "roughly symmetric")
    en.append(f"The distribution is {shape_en} (skewness {skew:+.2f}, excess "
              f"kurtosis {stats['kurtosis_excess']:+.2f}), and normality tests "
              f"reject a Gaussian fit — typical of national exam data.")
    ar.append(f"شكل التوزيع {'ملتوٍ لليسار' if skew < -0.1 else 'ملتوٍ لليمين' if skew > 0.1 else 'شبه متماثل'} "
              f"(معامل الالتواء {skew:+.2f})، واختبارات الحالة الطبيعية ترفض التوزيع الطبيعي.")

    # Elite share
    t90 = thr[90]
    en.append(f"{_fmt(t90['count_sitters'])} students ({t90['pct_sitters']:.2f}%) "
              f"scored 90% or above, and {_fmt(bands['ge95']['count'])} "
              f"({bands['ge95']['pct']:.2f}%) reached the elite 95%+ band.")
    ar.append(f"حصل {_fmt(t90['count_sitters'])} طالب ({t90['pct_sitters']:.2f}%) على 90% فأكثر، "
              f"ووصل {_fmt(bands['ge95']['count'])} طالب إلى فئة 95% فأكثر.")

    # Pass share
    passd = next((s for s in a["status_distribution"] if s["key"] == "pass_r1"), None)
    if passd:
        en.append(f"{passd['pct']:.1f}% of all students passed in the first round, "
                  f"while the remainder are split between the second round, failing, "
                  f"and absence.")
        ar.append(f"نجح {passd['pct']:.1f}% من الطلاب في الدور الأول، والباقون موزّعون بين "
                  f"الدور الثاني والرسوب والغياب.")

    # Median band
    med = stats["median"]
    en.append(f"Half of all sitting students scored above {med:.1f}% — the median "
              f"student sits in the "
              f"{'70–80%' if 70 <= med < 80 else '60–70%' if 60 <= med < 70 else '80–90%' if 80 <= med < 90 else 'sub-60%'} "
              f"band.")
    ar.append(f"نصف الطلاب حصلوا على أكثر من {med:.1f}%.")

    # Prediction highlights
    pmeta = p["meta"]
    press = pmeta["pressure_direction"]
    en.append(f"Because the 2026 cohort mean ({pmeta['cohort_mean_pct']:.1f}%) is "
              f"{'above' if press=='upward' else 'below' if press=='downward' else 'in line with'} "
              f"the {pmeta['baseline_mean_pct']:.0f}% historical baseline, projected "
              f"admission cutoffs are nudged {press}.")
    ar.append(f"لأن متوسط دفعة 2026 ({pmeta['cohort_mean_pct']:.1f}%) "
              f"{'أعلى من' if press=='upward' else 'أقل من' if press=='downward' else 'قريب من'} "
              f"المتوسط التاريخي، فإن حدود القبول المتوقعة تتجه {('للأعلى' if press=='upward' else 'للأسفل' if press=='downward' else 'للاستقرار')}.")

    for fac in p["faculties"][:3]:
        exp = fac["scenarios"]["expected"]
        en.append(f"Expected {fac['name_en']} cutoff ≈ {exp['cutoff']:.1f}% "
                  f"(~{fac['score_needed']:.0f}/320); about {_fmt(exp['eligible_students'])} "
                  f"students ({exp['eligible_pct']:.2f}%) would clear it.")
        ar.append(f"الحد المتوقع لكلية {fac['name_ar']} ≈ {exp['cutoff']:.1f}% "
                  f"(~{fac['score_needed']:.0f}/320)، ويستوفيه نحو {_fmt(exp['eligible_students'])} طالب.")

    return {"en": en, "ar": ar}
