import React, { useEffect, useState } from 'react';
import {
  BenchmarkMetricDto,
  DaycareDetailDto,
} from '../../services/api-client';
import { formatHebrewYearShort, getActiveSchoolYear } from '../../utils/school-years';
import { formatCompactAgeRange } from '../shell/DaycareListTable';
import { useModalDismiss } from '../shell/useModalDismiss';

interface DaycareProfileModalProps {
  daycare: DaycareDetailDto | null;
  onClose: () => void;
  onOpenReportModal: (
    daycare: DaycareDetailDto,
    initialWithdrawMode?: boolean
  ) => void;
  onOpenCorrectionModal: (daycare: DaycareDetailDto) => void;
}

function buildGoogleMapsUrl(daycare: DaycareDetailDto): string {
  const query = daycare.address?.trim()
    ? `${daycare.name}, ${daycare.address}`
    : `${daycare.lat},${daycare.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatHeadlinePriceClean(daycare: DaycareDetailDto): string {
  const fallbackReport = daycare.individual_reports?.[0];
  const effectivePrice =
    daycare.headline_price_nis ?? fallbackReport?.monthly_price_nis ?? null;

  if (effectivePrice === null) {
    return 'טרם דווח מחיר';
  }

  const effectiveYear =
    daycare.headline_price_nis !== null
      ? daycare.school_year
      : fallbackReport?.school_year ?? daycare.school_year;
  const activeYear = getActiveSchoolYear();
  const yearSuffix =
    effectiveYear && effectiveYear !== activeYear
      ? ` (${formatHebrewYearShort(effectiveYear)})`
      : '';

  if (
    daycare.display_mode === 'range' &&
    daycare.min_price_nis !== null &&
    daycare.max_price_nis !== null &&
    daycare.min_price_nis !== daycare.max_price_nis
  ) {
    return `₪${daycare.min_price_nis.toLocaleString()}–${daycare.max_price_nis.toLocaleString()} / חודש${yearSuffix}`;
  }
  return `₪${effectivePrice.toLocaleString()} / חודש${yearSuffix}`;
}

function formatShortTrustTag(daycare: DaycareDetailDto): string | null {
  const reportsCount = Math.max(
    daycare.active_reports_count,
    daycare.individual_reports?.length || 0
  );
  if (reportsCount === 0) {
    return null;
  }
  if (daycare.display_mode === 'range') {
    return `⚠️ ${reportsCount} דיווחים (טווח)`;
  }
  if (reportsCount >= 2) {
    return `✓ ${reportsCount} דיווחים`;
  }
  return 'דיווח בודד';
}

const SOURCE_SYSTEM_LABELS_HE: Record<string, string> = {
  moe_getmeonot: 'מרשם מעונות היום (משרד החינוך)',
  moe_mosdot: 'מאגר מוסדות חינוך (משרד החינוך)',
  mol_daycare: 'מרשם מעונות סמל (משרד העבודה)',
  welfare: 'מרשם מסגרות (משרד הרווחה)',
  tlv_gis_925: 'שכבת GIS עירונית (עיריית ת״א-יפו)',
  obudget: 'מפתח התקציב (הסדנא לידע ציבורי)',
  facilities_datapackage: 'מאגר המסגרות המאוחד',
};

function formatSizeBucketShort(bucket?: string): string {
  switch (bucket) {
    case '7_or_more':
      return '7+';
    case 'up_to_6':
      return '≤6';
    case '11_or_more':
      return '11+';
    case 'up_to_10':
      return '≤10';
    default:
      return '—';
  }
}

function formatShortBenchmarkLabel(bm: BenchmarkMetricDto): string {
  switch (bm.scope) {
    case 'radius_1km':
      return 'שכונה (עד 1 ק״מ)';
    case 'city_all_same_track':
      return 'כלל היישוב';
    case 'city_similar_params':
      return 'גנים דומים בעיר';
    default:
      return bm.label_he;
  }
}

function formatShortBenchmarkDiff(bm: BenchmarkMetricDto): string {
  if (bm.diff_nis === null || bm.diff_pct === null) {
    return bm.comparison_text_he;
  }
  if (bm.diff_nis === 0) {
    return 'זהה לחציון';
  }
  const absNis = Math.abs(bm.diff_nis).toLocaleString();
  const signPct = bm.diff_pct > 0 ? `+${bm.diff_pct}%` : `${bm.diff_pct}%`;
  return bm.diff_nis < 0
    ? `זול ב-₪${absNis} (${signPct})`
    : `יקר ב-₪${absNis} (${signPct})`;
}

/**
 * כרטיס הגן המלא של "ילדי היקר" — נקי, תמציתי ונגיש להורים:
 * - כותרת עם תגיות קומפקטיות, כתובת לחיצה ל-Google Maps, טלפון לחיוג ופרטי רישוי מתקפלים
 * - מחיר חודשי ושכבות גיל (ללא ז'רגון IQR)
 * - השוואה פשוטה לאזור ולמעון מפוקח (ללא N=/IQR)
 * - היסטוריית מחירים רב-שנתית (מוצגת כשיש 2+ שנים)
 * - פירוט דיווחי הורים באקורדיון סגור כברירת מחדל + שורת פעולות אחידה בתחתית
 */
export const DaycareProfileModal: React.FC<DaycareProfileModalProps> = ({
  daycare,
  onClose,
  onOpenReportModal,
  onOpenCorrectionModal,
}) => {
  const [copiedShare, setCopiedShare] = useState(false);
  const [showRegulatoryInfo, setShowRegulatoryInfo] = useState(false);
  const [showReportsTable, setShowReportsTable] = useState(false);

  useEffect(() => {
    setCopiedShare(false);
    setShowRegulatoryInfo(false);
    setShowReportsTable(false);
  }, [daycare?.id]);

  useModalDismiss(daycare !== null, onClose);

  if (!daycare) return null;

  const priceCohorts = daycare.price_cohorts || [];
  const relativeBenchmarks = daycare.relative_benchmarks || [];
  const yoyHistory = daycare.yoy_price_history || [];
  const individualReports = daycare.individual_reports || [];
  const regulatedComparison = daycare.regulated_benchmark_comparison;

  const compactAge = formatCompactAgeRange(
    daycare.target_age_groups,
    daycare.age_group_label_he
  );
  const shortTrustTag = formatShortTrustTag(daycare);

  const officialMetaItems: { label: string; value: string }[] = [];
  if (daycare.ministry_edu_symbol) {
    officialMetaItems.push({
      label: 'סמל משרד החינוך',
      value: daycare.ministry_edu_symbol,
    });
  }
  if (daycare.labor_Cross_symbol) {
    officialMetaItems.push({
      label: 'סמל משרד העבודה',
      value: daycare.labor_Cross_symbol,
    });
  }
  if (daycare.operator_name) {
    officialMetaItems.push({
      label: 'מפעיל',
      value: daycare.operator_name,
    });
  }
  if (daycare.official_capacity) {
    officialMetaItems.push({
      label: 'קיבולת תקנית',
      value: String(daycare.official_capacity),
    });
  }

  const latestDetailedReport = individualReports.find(
    (r) =>
      r.start_time_weekday ||
      r.includes_friday !== null ||
      r.includes_nutrition !== null
  );
  const weekdayHoursText =
    latestDetailedReport?.start_time_weekday &&
    latestDetailedReport?.end_time_weekday
      ? `${latestDetailedReport.start_time_weekday}–${latestDetailedReport.end_time_weekday}`
      : 'טרם דווח';
  const fridayText =
    latestDetailedReport?.includes_friday === true
      ? `${latestDetailedReport.friday_start_time || '07:30'}–${latestDetailedReport.friday_end_time || '12:30'}`
      : latestDetailedReport?.includes_friday === false
        ? 'ללא ימי שישי'
        : 'טרם דווח';
  const nutritionText =
    latestDetailedReport?.includes_nutrition === true
      ? '✓'
      : latestDetailedReport?.includes_nutrition === false
        ? '✗'
        : 'טרם דווח';
  const shelterText =
    daycare.shelter_status === 'yes'
      ? '✓'
      : daycare.shelter_status === 'no'
        ? '✗'
        : 'טרם דווח';
  const isOnly3To6 =
    daycare.target_age_groups.length > 0 &&
    daycare.target_age_groups.every((g) => g === '3_6');
  const camerasText =
    daycare.cameras_0_3_status === 'yes'
      ? '✓'
      : daycare.cameras_0_3_status === 'no'
        ? '✗'
        : 'טרם דווח';

  const showRegulatedGap =
    !daycare.is_subsidized &&
    daycare.headline_price_nis !== null &&
    regulatedComparison &&
    regulatedComparison.regulated_symbol_max_price_nis > 0 &&
    daycare.headline_price_nis >
      regulatedComparison.regulated_symbol_max_price_nis;

  const monthlyRegulatedGap = showRegulatedGap
    ? (daycare.headline_price_nis as number) -
      regulatedComparison.regulated_symbol_max_price_nis
    : 0;
  const annualRegulatedGap =
    regulatedComparison?.annual_gap_11_months_nis || monthlyRegulatedGap * 11;

  const maxHistoryPrice = Math.max(
    ...yoyHistory.map((h) => h.median_price_nis),
    6500
  );

  const handleShareDaycare = async () => {
    const shareUrl = `${window.location.origin}/?daycare=${encodeURIComponent(daycare.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${daycare.name} — ילדי היקר`,
          text: `${daycare.name} (${daycare.address}) — ${daycare.price_formatted_he}`,
          url: shareUrl,
        });
        return;
      } catch {
        // cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daycare-profile-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="profile-modal-card">
        <div className="modal-sticky-close-row">
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת כרטיס הגן"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* 1. כותרת המסגרת: שם הגן במרכז, תגיות משמאל ללא חפיפה, Google Maps, טלפון ופרטי מוסד */}
        <header className="profile-block profile-header-block centered-header">
          <div className="profile-header-top-grid">
            <div className="profile-header-spacer" aria-hidden="true" />
            <h2 id="daycare-profile-title" className="profile-main-title">
              {daycare.name}
            </h2>
            <div className="profile-header-top-left-badges">
              <span className={`status-pill-badge ${daycare.license_icon_code}`}>
                {daycare.license_status_label_he}
              </span>
              {daycare.is_subsidized && (
                <span className="subsidized-inline-tag">מסובסד</span>
              )}
            </div>
          </div>

          <p className="profile-sub-address centered-row">
            <a
              href={buildGoogleMapsUrl(daycare)}
              target="_blank"
              rel="noopener noreferrer"
              className="quick-action-link"
              title="פתיחה ב-Google Maps"
            >
              📍 {daycare.address} ↗
            </a>
            {daycare.phone_official && (
              <>
                {' · '}
                <a
                  href={`tel:${daycare.phone_official}`}
                  className="quick-action-link"
                >
                  📞 {daycare.phone_official}
                </a>
              </>
            )}
          </p>

          {officialMetaItems.length > 0 && (
            <div className="profile-official-meta-line centered-row">
              {officialMetaItems.map((meta, idx) => (
                <React.Fragment key={meta.label}>
                  {idx > 0 && <span className="meta-dot"> · </span>}
                  <span>
                    <strong>{meta.label}:</strong> {meta.value}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {daycare.has_active_stop_order && (
            <div className="stop-order-alert" role="alert">
              ⚠️ אזהרה רשמית: למסגרת זו קיים צו הפסקה מנהלי פעיל במרשם משרד
              החינוך.
            </div>
          )}

          {daycare.has_official_sanction && (
            <div className="sanction-alert" role="alert">
              <strong>⚠️ עיצום כספי רשמי (משרד החינוך)</strong>
              {daycare.official_sanction_date
                ? ` · ${daycare.official_sanction_date}`
                : ''}
              {daycare.official_sanction_text
                ? `: ${daycare.official_sanction_text}`
                : ''}
            </div>
          )}

          {daycare.regulatory_context_he && (
            <div className="profile-regulatory-toggle-wrap centered-toggle">
              <button
                type="button"
                className="profile-subtle-toggle-btn"
                aria-expanded={showRegulatoryInfo}
                onClick={() => setShowRegulatoryInfo((v) => !v)}
              >
                ℹ️ פרטי רישוי {showRegulatoryInfo ? '▴' : '▾'}
              </button>
              {showRegulatoryInfo && (
                <div className="regulatory-context-box">
                  <div>{daycare.regulatory_context_he}</div>
                  {(daycare.operator_corp_id ||
                    daycare.official_last_checked_at ||
                    (daycare.external_sources &&
                      daycare.external_sources.length > 0)) && (
                    <div className="regulatory-meta-list">
                      {daycare.operator_corp_id && (
                        <div>
                          <strong>ח.פ. / ע״ר תאגיד:</strong>{' '}
                          {daycare.operator_corp_id}
                        </div>
                      )}
                      {daycare.official_last_checked_at && (
                        <div>
                          <strong>בדיקה אחרונה במרשם:</strong>{' '}
                          {daycare.official_last_checked_at}
                        </div>
                      )}
                      {daycare.external_sources &&
                        daycare.external_sources.length > 0 && (
                          <div>
                            <strong>מקורות רשמיים מוצלבים:</strong>{' '}
                            {daycare.external_sources
                              .map(
                                (s) =>
                                  SOURCE_SYSTEM_LABELS_HE[s.source_system] ||
                                  s.source_system
                              )
                              .join(' · ')}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {/* 2. מחיר חודשי, שעות פעילות ומאפייני בטיחות */}
        <section className="profile-block" aria-label="מחיר חודשי ופרטי פעילות">
          <div className="block-header-row">
            <h3 className="block-title">💰 מחיר חודשי</h3>
            {shortTrustTag && (
              <span className="trust-tier-tag">{shortTrustTag}</span>
            )}
          </div>

          <div className="headline-price-banner">
            <div className="headline-price-value">
              {formatHeadlinePriceClean(daycare)}
            </div>
          </div>

          <div
            className="profile-facts-grid"
            aria-label="שעות פעילות ומאפייני בטיחות"
          >
            <div className="profile-fact-tile" title={daycare.age_group_label_he}>
              <span className="fact-label">👶 גילאים</span>
              <strong className="fact-value fact-value-ltr">
                {compactAge}
              </strong>
            </div>
            <div className="profile-fact-tile">
              <span className="fact-label">🕒 שעות א׳–ה׳</span>
              <strong
                className={`fact-value ${weekdayHoursText === 'טרם דווח' ? 'muted' : 'fact-value-ltr'}`}
              >
                {weekdayHoursText}
              </strong>
            </div>
            <div className="profile-fact-tile">
              <span className="fact-label">📅 ימי שישי</span>
              <strong
                className={`fact-value ${fridayText === 'טרם דווח' ? 'muted' : fridayText.includes('–') ? 'fact-value-ltr' : ''}`}
              >
                {fridayText}
              </strong>
            </div>
            <div className="profile-fact-tile">
              <span className="fact-label">🍽️ הזנה</span>
              <strong
                className={`fact-value ${nutritionText === 'טרם דווח' ? 'muted' : nutritionText === '✓' ? 'fact-yes' : 'fact-no'}`}
                title={
                  nutritionText === '✓'
                    ? 'כולל הזנה'
                    : nutritionText === '✗'
                      ? 'ללא הזנה'
                      : undefined
                }
              >
                {nutritionText}
              </strong>
            </div>
            <div className="profile-fact-tile">
              <span className="fact-label">🛡️ ממ״ד / מקלט</span>
              <strong
                className={`fact-value ${shelterText === 'טרם דווח' ? 'muted' : shelterText === '✓' ? 'fact-yes' : 'fact-no'}`}
                title={
                  shelterText === '✓'
                    ? 'יש ממ״ד / מקלט תקני'
                    : shelterText === '✗'
                      ? 'אין ממ״ד / מקלט תקני'
                      : undefined
                }
              >
                {shelterText}
              </strong>
            </div>
            {!isOnly3To6 && (
              <div className="profile-fact-tile">
                <span className="fact-label">📹 מצלמות</span>
                <strong
                  className={`fact-value ${camerasText === 'טרם דווח' ? 'muted' : camerasText === '✓' ? 'fact-yes' : 'fact-no'}`}
                  title={
                    camerasText === '✓'
                      ? 'יש מצלמות'
                      : camerasText === '✗'
                        ? 'אין מצלמות'
                        : undefined
                  }
                >
                  {camerasText}
                </strong>
              </div>
            )}
          </div>

          {priceCohorts.length > 1 && (
            <div className="cohorts-grid">
              {priceCohorts.map((cohort, idx) => (
                <div key={idx} className="cohort-card">
                  <div className="cohort-card-top">
                    <strong>
                      {formatCompactAgeRange(
                        [cohort.age_group],
                        cohort.age_group_label_he
                      )}
                    </strong>
                    <span className="cohort-year-chip">
                      {cohort.school_year_label}
                    </span>
                  </div>
                  <div className="cohort-price-text">
                    {cohort.display_mode === 'range' &&
                    cohort.min_price_nis &&
                    cohort.max_price_nis
                      ? `₪${cohort.min_price_nis.toLocaleString()}–${cohort.max_price_nis.toLocaleString()}`
                      : cohort.headline_price_nis !== null
                        ? `₪${cohort.headline_price_nis.toLocaleString()}`
                        : 'טרם דווח'}
                  </div>
                  <div className="cohort-tags-row">
                    <span>
                      {cohort.active_reports_count >= 2
                        ? `✓ ${cohort.active_reports_count} דיווחים`
                        : 'דיווח בודד'}
                    </span>
                    {cohort.includes_friday !== null && (
                      <span>
                        · {cohort.includes_friday ? '📅 שישי' : 'א׳–ה׳'}
                      </span>
                    )}
                    {cohort.includes_nutrition !== null && (
                      <span>
                        · {cohort.includes_nutrition ? '🍽️ הזנה' : 'ללא הזנה'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. השוואה לאזור ולמעון מפוקח */}
        {(relativeBenchmarks.length > 0 || showRegulatedGap) && (
          <section className="profile-block" aria-label="השוואת מחיר לאזור">
            <h3 className="block-title">📊 איך המחיר ביחס לאזור?</h3>

            {relativeBenchmarks.length > 0 && (
              <div className="benchmarks-list">
                {relativeBenchmarks.map((bm) => (
                  <div key={bm.scope} className="benchmark-row-card">
                    <div className="bm-label-col">
                      <strong>{formatShortBenchmarkLabel(bm)}</strong>
                      {bm.median_price_nis !== null && (
                        <span className="bm-sample-meta">
                          חציון ₪{bm.median_price_nis.toLocaleString()} (
                          {bm.sample_daycares_count} גנים)
                        </span>
                      )}
                    </div>
                    <div className="bm-value-col">
                      <span
                        className={`bm-diff-badge ${
                          bm.diff_nis !== null && bm.diff_nis < 0
                            ? 'diff-cheaper'
                            : bm.diff_nis !== null && bm.diff_nis > 0
                              ? 'diff-pricier'
                              : 'diff-neutral'
                        }`}
                      >
                        {formatShortBenchmarkDiff(bm)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showRegulatedGap && (
              <div className="regulated-comparison-box">
                🛡️ מעון מפוקח עולה עד{' '}
                <strong>
                  ₪
                  {regulatedComparison.regulated_symbol_max_price_nis.toLocaleString()}
                  /חודש
                </strong>{' '}
                — פער של{' '}
                <strong>₪{monthlyRegulatedGap.toLocaleString()} לחודש</strong> (
                <strong>₪{annualRegulatedGap.toLocaleString()} בשנה</strong>).
              </div>
            )}
          </section>
        )}

        {/* 4. היסטוריית מחירים (מוצגת רק כשיש לפחות 2 שנים להשוואה) */}
        {yoyHistory.length >= 2 && (
          <section
            className="profile-block"
            aria-label="היסטוריית מחירים לאורך השנים"
          >
            <h3 className="block-title">📈 היסטוריית מחירים</h3>

            <div className="yoy-chart-rows">
              {yoyHistory.map((point) => {
                const widthPct = Math.min(
                  100,
                  Math.max(
                    20,
                    Math.round((point.median_price_nis / maxHistoryPrice) * 100)
                  )
                );
                return (
                  <div
                    key={`${point.school_year}-${point.age_group}`}
                    className="yoy-bar-row"
                  >
                    <div className="yoy-year-label">
                      <strong>{point.school_year_label}</strong>
                      <span>({point.reports_count} דיווחים)</span>
                    </div>
                    <div className="yoy-bar-track">
                      <div
                        className="yoy-bar-fill"
                        style={{ width: `${widthPct}%` }}
                      >
                        ₪{point.median_price_nis.toLocaleString()}
                      </div>
                    </div>
                    <div className="yoy-change-col">
                      {point.yoy_change_pct !== null &&
                      point.yoy_change_nis !== null ? (
                        <span className="yoy-delta-badge">
                          {point.yoy_change_nis >= 0 ? '+' : ''}₪
                          {point.yoy_change_nis.toLocaleString()} (
                          {point.yoy_change_pct >= 0 ? '+' : ''}
                          {point.yoy_change_pct}%)
                        </span>
                      ) : (
                        <span className="yoy-base-label">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. פירוט דיווחי הורים (אקורדיון סגור כברירת מחדל), שורת פעולות והבהרה */}
        <section className="profile-block" aria-label="פירוט דיווחים ופעולות">
          {individualReports.length > 0 && (
            <div className="reports-accordion-wrap">
              <button
                type="button"
                className="privacy-collapsible-btn"
                aria-expanded={showReportsTable}
                onClick={() => setShowReportsTable((v) => !v)}
              >
                <span>🧾 פירוט דיווחי הורים ({individualReports.length})</span>
                <span className="privacy-chevron" aria-hidden="true">
                  {showReportsTable ? '▴' : '▾'}
                </span>
              </button>

              {showReportsTable && (
                <div className="reports-breakdown-table-wrap">
                  <table className="reports-breakdown-table">
                    <thead>
                      <tr>
                        <th>שנה</th>
                        <th>גיל</th>
                        <th>מחיר</th>
                        <th>שעות א׳–ה׳</th>
                        <th>שישי</th>
                        <th>הזנה</th>
                        <th>ממ״ד</th>
                        {!isOnly3To6 && <th>מצלמות</th>}
                        <th>גודל</th>
                        <th>מקור</th>
                      </tr>
                    </thead>
                    <tbody>
                      {individualReports.map((rep, idx) => (
                        <tr key={idx}>
                          <td>{rep.school_year_label}</td>
                          <td>
                            <span
                              className="compact-age-pill"
                              title={rep.age_group_label_he}
                            >
                              {formatCompactAgeRange(
                                [rep.age_group],
                                rep.age_group_label_he
                              )}
                            </span>
                            {rep.is_municipal_tzaharon_only && (
                              <span className="tzaharon-mini-tag"> צהרון</span>
                            )}
                          </td>
                          <td>
                            <strong>
                              ₪{rep.monthly_price_nis.toLocaleString()}
                            </strong>
                          </td>
                          <td>
                            {rep.start_time_weekday && rep.end_time_weekday ? (
                              <span className="fact-value-ltr">
                                {rep.start_time_weekday}–{rep.end_time_weekday}
                              </span>
                            ) : (
                              <span
                                className="muted-dash"
                                title="לא צוין בגיליון המקור"
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            {rep.includes_friday === null ? (
                              <span
                                className="muted-dash"
                                title="לא צוין בגיליון המקור"
                              >
                                —
                              </span>
                            ) : rep.includes_friday ? (
                              <span className="fact-value-ltr">
                                {rep.friday_start_time || '07:30'}–
                                {rep.friday_end_time || '12:30'}
                              </span>
                            ) : (
                              <span className="fact-no">✗</span>
                            )}
                          </td>
                          <td>
                            {rep.includes_nutrition === null ? (
                              <span
                                className="muted-dash"
                                title="לא צוין בגיליון המקור"
                              >
                                —
                              </span>
                            ) : rep.includes_nutrition ? (
                              <span className="fact-yes">✓</span>
                            ) : (
                              <span className="fact-no">✗</span>
                            )}
                          </td>
                          <td>
                            {rep.reported_shelter_status === 'yes' ? (
                              <span className="fact-yes">✓</span>
                            ) : rep.reported_shelter_status === 'no' ? (
                              <span className="fact-no">✗</span>
                            ) : (
                              <span className="muted-dash">—</span>
                            )}
                          </td>
                          {!isOnly3To6 && (
                            <td>
                              {rep.reported_cameras_0_3 === 'yes' ? (
                                <span className="fact-yes">✓</span>
                              ) : rep.reported_cameras_0_3 === 'no' ? (
                                <span className="fact-no">✗</span>
                              ) : (
                                <span className="muted-dash">—</span>
                              )}
                            </td>
                          )}
                          <td>
                            <span className="fact-value-ltr">
                              {formatSizeBucketShort(rep.reported_size_bucket)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`provenance-chip ${
                                rep.report_source === 'parent_verified_google'
                                  ? 'verified'
                                  : 'sheet-seed'
                              }`}
                            >
                              {rep.report_source_label_he}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="profile-actions-bar unified-row">
            <button
              type="button"
              className="profile-action-btn primary"
              onClick={() => onOpenReportModal(daycare, false)}
            >
              + דווחו / עדכנו מחיר
            </button>
            <button
              type="button"
              className="profile-action-btn secondary"
              onClick={() => onOpenReportModal(daycare, true)}
            >
              🗑️ ביטול דיווח
            </button>
            <button
              type="button"
              className="profile-action-btn outline"
              onClick={() => onOpenCorrectionModal(daycare)}
            >
              🚩 מצאתם טעות?
            </button>
            <button
              type="button"
              className={`profile-share-icon-btn ${copiedShare ? 'copied' : ''}`}
              aria-label="שיתוף"
              title={copiedShare ? 'הקישור הועתק!' : 'שיתוף כרטיס הגן'}
              onClick={handleShareDaycare}
            >
              {copiedShare ? (
                '✓'
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              )}
            </button>
          </div>

          <footer className="reliance-disclaimer-box quiet-disclaimer">
            {daycare.reliance_disclaimer_he}
          </footer>
        </section>
      </div>
    </div>
  );
};
