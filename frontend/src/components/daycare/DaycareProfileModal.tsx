import React from 'react';
import { DaycareDetailDto } from '../../services/api-client';

interface DaycareProfileModalProps {
  daycare: DaycareDetailDto | null;
  onClose: () => void;
  onOpenReportModal: (daycare: DaycareDetailDto, initialWithdrawMode?: boolean) => void;
  onOpenCorrectionModal: (daycare: DaycareDetailDto) => void;
}

/**
 * כרטיס הגן המורחב ב-5 בלוקים קבועים (docs/06_ui_ux_and_cartography_spec.md סעיף 4):
 * 1. כותרת רשמית, סמלי משרד החינוך/העבודה וניסוח רישוי מוגן משפטית.
 * 2. מחיר חודשי משוקלל לפי שכבת גיל ושנת לימודים (D-31: בודד / טווח / חציון + IQR).
 * 3. השוואה יחסית לשכונה (1 ק"מ), לעיר ולגנים דומים + פער שנתי מול מעון סמל מפוקח (D-30).
 * 4. היסטוריית מחירים רב-שנתית ושינוי שנתי באחוזים (YoY — D-30).
 * 5. טבלת פירוט דיווחי הורים (ללא חשיפת חודש דיווח, ועם "לא צוין בגיליון המקור" לייבוא היסטורי — D-38) + כתב ויתור.
 */
export const DaycareProfileModal: React.FC<DaycareProfileModalProps> = ({
  daycare,
  onClose,
  onOpenReportModal,
  onOpenCorrectionModal,
}) => {
  if (!daycare) return null;

  const maxHistoryPrice = Math.max(
    ...daycare.yoy_price_history.map((h) => h.median_price_nis),
    6500
  );

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daycare-profile-title"
    >
      <div className="profile-modal-card">
        <button
          type="button"
          className="modal-close-x"
          aria-label="סגירת כרטיס הגן"
          onClick={onClose}
        >
          ✕
        </button>

        {/* ====================================================================
            בלוק 1: כותרת רשמית, סמלי מוסד וסטטוס רישוי מוגן (Official Header)
            ==================================================================== */}
        <header className="profile-block profile-header-block">
          <div className="header-badges-row">
            <span className={`status-pill-badge ${daycare.license_icon_code}`}>
              {daycare.license_status_label_he}
            </span>
            <span className="age-pill-badge">{daycare.age_group_label_he}</span>
            {daycare.is_subsidized && (
              <span className="subsidized-pill-badge">
                🛡️ מסלול מפוקח / מסובסד
              </span>
            )}
          </div>

          <h2 id="daycare-profile-title" className="profile-main-title">
            {daycare.name}
          </h2>
          <p className="profile-sub-address">
            📍 {daycare.address}
            {daycare.phone_official && (
              <>
                {' · '}
                <a href={`tel:${daycare.phone_official}`} className="phone-link">
                  📞 {daycare.phone_official}
                </a>
              </>
            )}
          </p>

          <div className="official-symbols-grid">
            {daycare.ministry_edu_symbol && (
              <div className="symbol-chip">
                <strong>סמל משרד החינוך:</strong> {daycare.ministry_edu_symbol}
              </div>
            )}
            {daycare.labor_Cross_symbol && (
              <div className="symbol-chip">
                <strong>סמל מעון משרד העבודה:</strong>{' '}
                {daycare.labor_Cross_symbol}
              </div>
            )}
            {daycare.operator_name && (
              <div className="symbol-chip">
                <strong>גוף מפעיל רשמי:</strong> {daycare.operator_name}
              </div>
            )}
          </div>

          {daycare.has_active_stop_order && (
            <div className="stop-order-alert" role="alert">
              ⚠️ אזהרה רשמית: למסגרת זו קיים צו הפסקה מנהלי פעיל במרשם משרד החינוך.
            </div>
          )}

          <div className="regulatory-context-box">
            <strong>סטטוס רישוי ומקור רשמי: </strong>
            {daycare.regulatory_context_he}
          </div>
        </header>

        {/* ====================================================================
            בלוק 2: מחיר חודשי משוקלל לפי שכבת גיל ושנת לימודים (D-31)
            ==================================================================== */}
        <section className="profile-block" aria-label="מחיר חודשי משוקלל וצירי נרמול">
          <div className="block-header-row">
            <h3 className="block-title">
              💰 בלוק 2: מחיר מחירון חודשי ומדיניות אמינות (D-31)
            </h3>
            <span className="trust-tier-tag">{daycare.trust_badge_he}</span>
          </div>

          <div className="headline-price-banner">
            <div>
              <div className="headline-price-value">
                {daycare.price_formatted_he}
              </div>
              {daycare.activity_hours_summary_he && (
                <div className="headline-hours-sub">
                  מתכונת מדווחת: {daycare.activity_hours_summary_he}
                </div>
              )}
            </div>
            <button
              type="button"
              className="cta-inline-report-btn"
              onClick={() => onOpenReportModal(daycare, false)}
            >
              + דווחו / עדכנו מחיר
            </button>
          </div>

          {daycare.price_cohorts.length > 0 && (
            <div className="cohorts-grid">
              {daycare.price_cohorts.map((cohort, idx) => (
                <div key={idx} className="cohort-card">
                  <div className="cohort-card-top">
                    <strong>{cohort.age_group_label_he}</strong>
                    <span className="cohort-year-chip">
                      {cohort.school_year_label}
                    </span>
                  </div>
                  <div className="cohort-price-text">
                    {cohort.price_formatted_he}
                  </div>
                  {cohort.iqr_q25_nis && cohort.iqr_q75_nis && (
                    <div className="cohort-meta-text">
                      טווח בין-רבעוני (IQR 25%–75%): ₪
                      {cohort.iqr_q25_nis.toLocaleString()}–₪
                      {cohort.iqr_q75_nis.toLocaleString()}
                    </div>
                  )}
                  <div className="cohort-meta-text">
                    {cohort.trust_badge_he} ·{' '}
                    {cohort.includes_friday === null
                      ? 'ימי שישי: לא צוין בגיליון המקור'
                      : cohort.includes_friday
                        ? 'כולל ימי שישי'
                        : 'ללא ימי שישי'}{' '}
                    ·{' '}
                    {cohort.includes_nutrition === null
                      ? 'הזנה: לא צוין בגיליון המקור'
                      : cohort.includes_nutrition
                        ? 'כולל הזנה'
                        : 'ללא הזנה'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ====================================================================
            בלוק 3: השוואה יחסית לסביבה ומול מעון סמל מפוקח (D-30, D-38)
            ==================================================================== */}
        <section className="profile-block" aria-label="השוואת מחיר יחסית לסביבה ולמעון מפוקח">
          <h3 className="block-title">
            📊 בלוק 3: השוואה יחסית לשכונה, לעיר ולתעריף המפוקח (D-30)
          </h3>

          <div className="benchmarks-list">
            {daycare.relative_benchmarks.map((bm) => (
              <div key={bm.scope} className="benchmark-row-card">
                <div className="bm-label-col">
                  <strong>{bm.label_he}</strong>
                  <span className="bm-sample-meta">
                    מדגם: N={bm.sample_daycares_count} גנים
                    {bm.iqr_q25_nis && bm.iqr_q75_nis
                      ? ` · טווח אמצעי (IQR): ₪${bm.iqr_q25_nis.toLocaleString()}–₪${bm.iqr_q75_nis.toLocaleString()}`
                      : ''}
                  </span>
                </div>
                <div className="bm-value-col">
                  {bm.median_price_nis && (
                    <span className="bm-median-pill">
                      חציון: ₪{bm.median_price_nis.toLocaleString()}
                    </span>
                  )}
                  <span
                    className={`bm-diff-badge ${
                      bm.diff_nis !== null && bm.diff_nis < 0
                        ? 'diff-cheaper'
                        : bm.diff_nis !== null && bm.diff_nis > 0
                          ? 'diff-pricier'
                          : 'diff-neutral'
                    }`}
                  >
                    {bm.comparison_text_he}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="regulated-comparison-box">
            <strong>🛡️ ייחוס מול תעריף מעון סמל מפוקח (₪{daycare.regulated_benchmark_comparison.regulated_symbol_max_price_nis.toLocaleString()} לחודש): </strong>
            <span>{daycare.regulated_benchmark_comparison.summary_he}</span>
          </div>
        </section>

        {/* ====================================================================
            בלוק 4: היסטוריית מחירים רב-שנתית (YoY Price History — D-30)
            ==================================================================== */}
        <section className="profile-block" aria-label="היסטוריית מחירים לאורך השנים">
          <h3 className="block-title">
            📈 בלוק 4: היסטוריית מחירים רב-שנתית (תשפ״ה–תשפ״ז)
          </h3>

          {daycare.yoy_price_history.length === 0 ? (
            <p className="empty-block-note">
              טרם נצברו דיווחים היסטוריים רב-שנתיים למסגרת זו. ניתן לדווח גם על
              שנות הלימודים תשפ״ה ותשפ״ו בטופס הדיווח!
            </p>
          ) : (
            <div className="yoy-chart-rows">
              {daycare.yoy_price_history.map((point) => {
                const widthPct = Math.min(
                  100,
                  Math.max(20, Math.round((point.median_price_nis / maxHistoryPrice) * 100))
                );
                return (
                  <div key={`${point.school_year}-${point.age_group}`} className="yoy-bar-row">
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
                      {point.yoy_change_pct !== null && point.yoy_change_nis !== null ? (
                        <span className="yoy-delta-badge">
                          {point.yoy_change_nis >= 0 ? '+' : ''}
                          ₪{point.yoy_change_nis.toLocaleString()} (
                          {point.yoy_change_pct >= 0 ? '+' : ''}
                          {point.yoy_change_pct}%)
                        </span>
                      ) : (
                        <span className="yoy-base-label">שנת בסיס</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ====================================================================
            בלוק 5: פירוט דיווחי הורים בודדים, כפתורי פעולה וכתב ויתור (D-34, D-38)
            ==================================================================== */}
        <section className="profile-block" aria-label="פירוט דיווחי הורים וכתב ויתור">
          <h3 className="block-title">
            🧾 בלוק 5: פירוט דיווחי הורים ומקורות ({daycare.individual_reports.length}{' '}
            דיווחים)
          </h3>

          {daycare.individual_reports.length === 0 ? (
            <p className="empty-block-note">
              טרם הוזנו דיווחי הורים למסגרת זו. לחצו על הכפתור למטה כדי להוסיף
              את הדיווח הראשון תוך 60 שניות!
            </p>
          ) : (
            <div className="reports-breakdown-table-wrap">
              <table className="reports-breakdown-table">
                <thead>
                  <tr>
                    <th>שנת לימודים</th>
                    <th>קבוצת גיל</th>
                    <th>מחיר חודשי</th>
                    <th>שעות א׳–ה׳</th>
                    <th>ימי שישי</th>
                    <th>הזנה</th>
                    <th>מקור ואימות</th>
                  </tr>
                </thead>
                <tbody>
                  {daycare.individual_reports.map((rep, idx) => (
                    <tr key={idx}>
                      <td>{rep.school_year_label}</td>
                      <td>
                        {rep.age_group_label_he}
                        {rep.is_municipal_tzaharon_only ? ' (צהרון עירייה)' : ''}
                      </td>
                      <td>
                        <strong>₪{rep.monthly_price_nis.toLocaleString()}</strong>
                      </td>
                      <td>
                        {rep.start_time_weekday && rep.end_time_weekday
                          ? `${rep.start_time_weekday}–${rep.end_time_weekday}`
                          : 'לא צוין בגיליון המקור'}
                      </td>
                      <td>
                        {rep.includes_friday === null
                          ? 'לא צוין בגיליון המקור'
                          : rep.includes_friday
                            ? `כן (${rep.friday_start_time || '07:30'}–${rep.friday_end_time || '12:30'})`
                            : 'לא'}
                      </td>
                      <td>
                        {rep.includes_nutrition === null
                          ? 'לא צוין בגיליון המקור'
                          : rep.includes_nutrition
                            ? 'כולל הזנה'
                            : 'ללא הזנה'}
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

          <div className="profile-actions-bar">
            <button
              type="button"
              className="profile-action-btn primary"
              onClick={() => onOpenReportModal(daycare, false)}
            >
              + דווחו או עדכנו מחיר לגן זה
            </button>
            <button
              type="button"
              className="profile-action-btn secondary"
              onClick={() => onOpenReportModal(daycare, true)}
            >
              🗑️ דיווחתם בטעות? ביטול דיווח עצמי
            </button>
            <button
              type="button"
              className="profile-action-btn outline"
              onClick={() => onOpenCorrectionModal(daycare)}
            >
              🚩 מצאתם טעות בנתוני הגן?
            </button>
          </div>

          <footer className="reliance-disclaimer-box">
            {daycare.reliance_disclaimer_he}
          </footer>
        </section>
      </div>
    </div>
  );
};
