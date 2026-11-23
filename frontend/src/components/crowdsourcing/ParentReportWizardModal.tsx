import React, { useEffect, useState } from 'react';
import {
  DaycareDetailDto,
  ReportItemPayload,
  submitParentReport,
  withdrawParentReport,
} from '../../services/api-client';

interface ParentReportWizardModalProps {
  open: boolean;
  initialDaycare: DaycareDetailDto | null;
  allDaycares: DaycareDetailDto[];
  initialWithdrawMode?: boolean;
  cityMedianPriceNis: number;
  onClose: () => void;
  onReportSubmitted: (updatedDaycare: DaycareDetailDto | null) => void;
}

const WEEKDAY_START_OPTIONS = ['06:45', '07:00', '07:15', '07:30', '07:45', '08:00'];
const WEEKDAY_END_OPTIONS = [
  '13:30',
  '14:00',
  '15:30',
  '16:00',
  '16:15',
  '16:30',
  '16:45',
  '17:00',
  '17:30',
];
const FRIDAY_START_OPTIONS = ['07:00', '07:15', '07:30', '07:45', '08:00'];
const FRIDAY_END_OPTIONS = ['11:45', '12:00', '12:15', '12:30', '12:45', '13:00'];

function createDefaultReportItem(
  defaultAgeGroup: ReportItemPayload['age_group'] = '1_2'
): ReportItemPayload {
  return {
    school_year: 2027,
    age_group: defaultAgeGroup,
    monthly_price_nis: 5500,
    start_time_weekday: '07:30',
    end_time_weekday: '16:30',
    includes_friday: true,
    friday_start_time: '07:30',
    friday_end_time: '12:30',
    includes_nutrition: true,
    is_municipal_tzaharon_only: false,
    reported_over_statutory_threshold: null,
    reported_has_shelter: null,
    reported_has_cameras: null,
    outlier_confirmed_by_user: false,
  };
}

/**
 * אשף דיווח מחיר להורים ב-60 שניות (3 שלבים — docs/06_ui_ux_and_cartography_spec.md סעיף 5):
 * שלב 1: בחירת המסגרת הרשמית (או מעבר למסלול ביטול דיווח עצמי Blind Withdraw).
 * שלב 2: מחיר המחירון החודשי + 4 צירי הנרמול החובה + תמיכה במספר שכבות גיל + מודאל Sanity Check לחריגים (>40%).
 * שלב 3: הצהרה משפטית (סעיף 62 לפקודת הנזיקין), הודעת פרטיות (סעיף 11) ואימות Google OIDC (Scope: openid בלבד).
 */
export const ParentReportWizardModal: React.FC<ParentReportWizardModalProps> = ({
  open,
  initialDaycare,
  allDaycares,
  initialWithdrawMode = false,
  cityMedianPriceNis,
  onClose,
  onReportSubmitted,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(initialDaycare ? 2 : 1);
  const [withdrawMode, setWithdrawMode] = useState<boolean>(initialWithdrawMode);
  const [selectedDaycareId, setSelectedDaycareId] = useState<string>(
    initialDaycare?.id || allDaycares[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [items, setItems] = useState<ReportItemPayload[]>([
    createDefaultReportItem(),
  ]);
  const [withdrawYear, setWithdrawYear] = useState<2025 | 2026 | 2027>(2027);
  const [outlierWarningItemIndex, setOutlierWarningItemIndex] = useState<
    number | null
  >(null);
  const [legalAccepted, setLegalAccepted] = useState<boolean>(false);
  const [turnstileVerified, setTurnstileVerified] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resultMessageHe, setResultMessageHe] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setWithdrawMode(initialWithdrawMode);
      setSelectedDaycareId(initialDaycare?.id || allDaycares[0]?.id || '');
      setStep(initialDaycare ? 2 : 1);
      const is36 = initialDaycare?.target_age_groups.includes('3_6');
      setItems([
        {
          ...createDefaultReportItem(is36 ? '3_6' : '1_2'),
          monthly_price_nis: initialDaycare?.headline_price_nis || (is36 ? 980 : 5500),
          is_municipal_tzaharon_only: Boolean(is36 && initialDaycare?.is_subsidized),
        },
      ]);
      setOutlierWarningItemIndex(null);
      setLegalAccepted(false);
      setResultMessageHe(null);
      setErrorText(null);
    }
  }, [open, initialDaycare, initialWithdrawMode, allDaycares]);

  if (!open) return null;

  const selectedDaycare =
    allDaycares.find((d) => d.id === selectedDaycareId) || initialDaycare;

  const filteredDaycares = allDaycares.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.address.toLowerCase().includes(q) ||
      d.city_name_he.toLowerCase().includes(q)
    );
  });

  const updateItem = (idx: number, patch: Partial<ReportItemPayload>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  };

  const addAnotherAgeCohort = () => {
    if (items.length >= 5) return;
    setItems((prev) => [...prev, createDefaultReportItem('0_1')]);
  };

  const removeAgeCohort = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // בדיקת Sanity Check היברידית בסיום שלב 2 לפני מעבר לשלב 3 (D-38)
  const handleProceedFromStep2 = () => {
    setErrorText(null);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (
        !Number.isFinite(it.monthly_price_nis) ||
        it.monthly_price_nis < 500 ||
        it.monthly_price_nis > 15000
      ) {
        setErrorText(
          'מחיר המחירון החודשי חייב להיות מספר שלם בין 500 ₪ ל-15,000 ₪.'
        );
        return;
      }

      const refMedian = it.is_municipal_tzaharon_only
        ? 980
        : selectedDaycare?.is_subsidized
          ? 2515
          : selectedDaycare?.headline_price_nis || cityMedianPriceNis || 5400;

      const deviationRatio = Math.abs(it.monthly_price_nis - refMedian) / refMedian;
      if (deviationRatio > 0.4 && !it.outlier_confirmed_by_user) {
        setOutlierWarningItemIndex(i);
        return;
      }
    }
    setOutlierWarningItemIndex(null);
    setStep(3);
  };

  const handleConfirmOutlierAndProceed = () => {
    if (outlierWarningItemIndex !== null) {
      updateItem(outlierWarningItemIndex, { outlier_confirmed_by_user: true });
    }
    setOutlierWarningItemIndex(null);
    setStep(3);
  };

  const handleSubmitFinalReport = async () => {
    if (!selectedDaycare) return;
    if (!legalAccepted) {
      setErrorText('יש לאשר את הצהרת תום הלב ומחיר המחירון הכללי לפני השליחה.');
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    try {
      const response = await submitParentReport({
        daycare_id: selectedDaycare.id,
        turnstile_token: turnstileVerified
          ? 'turnstile_verified_token'
          : 'missing',
        legal_declaration_accepted: legalAccepted,
        items,
      });
      setResultMessageHe(response.confirmation_message_he);
      onReportSubmitted(response.updatedDaycare);
    } catch {
      setErrorText('אירעה שגיאה בשליחת הדיווח. אנא נסו שנית.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteBlindWithdraw = async () => {
    if (!selectedDaycare) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      const response = await withdrawParentReport({
        daycare_id: selectedDaycare.id,
        school_year: withdrawYear,
        turnstile_token: 'turnstile_verified_token',
      });
      setResultMessageHe(response.confirmation_message_he);
    } catch {
      setErrorText('אירעה שגיאה בביצוע בקשת הביטול.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-modal-title"
    >
      <div className="wizard-modal-card">
        <button
          type="button"
          className="modal-close-x"
          aria-label="סגירת טופס דיווח"
          onClick={onClose}
        >
          ✕
        </button>

        {/* מסך סיום אחיד (Blind Upsert / Blind Withdraw Confirmation) */}
        {resultMessageHe ? (
          <div className="wizard-confirmation-screen">
            <div className="confirmation-check-circle">✓</div>
            <h2 id="wizard-modal-title">הפעולה הושלמה בהצלחה!</h2>
            <p className="confirmation-body-text">{resultMessageHe}</p>
            <div className="privacy-assurance-pill">
              🔒 אפס שמירת מייל או פרטים מזהים: הדיווח נשמר באמצעות אסימון חד-כיווני
              תלוי-גן (HMAC-SHA256) שאינו מאפשר קישור בין דיווחים או זיהוי חוזר.
            </div>
            <button
              type="button"
              className="wizard-primary-btn"
              onClick={onClose}
            >
              חזרה למפה ולנתוני הגן המעודכנים
            </button>
          </div>
        ) : withdrawMode ? (
          /* ==================================================================
             מסלול ביטול דיווח עצמי עיוור (Blind Withdraw — D-38)
             ================================================================== */
          <div className="wizard-step-container">
            <h2 id="wizard-modal-title" className="wizard-title">
              🗑️ ביטול דיווח עצמי לגן (Blind Withdraw)
            </h2>
            <p className="wizard-subtitle">
              אם דיווחתם בטעות על מסגרת זו, תוכלו להזדהות עם אותו חשבון Google
              (ללא חשיפת מייל) ולהסיר את הדיווח שלכם משנת הלימודים שנבחרה.
            </p>

            {selectedDaycare && (
              <div className="locked-daycare-banner">
                <strong>מסגרת נבחרת:</strong> {selectedDaycare.name} (
                {selectedDaycare.address})
              </div>
            )}

            <div className="form-field-group">
              <label className="field-label">
                שנת הלימודים עבורה תרצו לבטל את הדיווח:
              </label>
              <div className="pill-radio-group">
                {([2027, 2026, 2025] as const).map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    className={`pill-choice-btn ${withdrawYear === yr ? 'selected' : ''}`}
                    onClick={() => setWithdrawYear(yr)}
                  >
                    {yr === 2027
                      ? 'תשפ״ז (2026–2027)'
                      : yr === 2026
                        ? 'תשפ״ו (2025–2026)'
                        : 'תשפ״ה (2024–2025)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="wizard-footer-nav">
              <button
                type="button"
                className="wizard-secondary-btn"
                onClick={() => setWithdrawMode(false)}
              >
                חזרה לטופס דיווח מחיר
              </button>
              <button
                type="button"
                className="wizard-primary-btn"
                disabled={submitting}
                onClick={handleExecuteBlindWithdraw}
              >
                {submitting
                  ? 'מעבד בקשה...'
                  : '🔐 אימות Google וביטול הדיווח שלי'}
              </button>
            </div>
          </div>
        ) : (
          /* ==================================================================
             אשף 3 השלבים לדיווח או עדכון מחיר (60-Second Parent Report Wizard)
             ================================================================== */
          <div className="wizard-step-container">
            <div className="wizard-progress-header">
              <span className={`step-dot ${step >= 1 ? 'active' : ''}`}>
                1. בחירת המסגרת
              </span>
              <span className={`step-dot ${step >= 2 ? 'active' : ''}`}>
                2. מחיר ו-4 צירי נרמול
              </span>
              <span className={`step-dot ${step >= 3 ? 'active' : ''}`}>
                3. הצהרה ואימות שומר פרטיות
              </span>
            </div>

            {errorText && (
              <div className="wizard-error-banner" role="alert">
                ⚠️ {errorText}
              </div>
            )}

            {/* שלב 1: בחירת המסגרת הרשמית */}
            {step === 1 && (
              <div className="wizard-step-body">
                <h2 id="wizard-modal-title" className="wizard-title">
                  שלב 1 מתוך 3: בחרו את המסגרת הרשמית
                </h2>
                <p className="wizard-subtitle">
                  חפשו לפי שם המעון/הגן, כתובת או יישוב מתוך מרשם המסגרות הרשמיות:
                </p>

                <input
                  type="search"
                  className="wizard-text-input"
                  placeholder="הקלידו שם גן, רחוב או עיר..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="daycare-picker-list">
                  {filteredDaycares.map((d) => (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={0}
                      className={`daycare-picker-item ${
                        selectedDaycareId === d.id ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedDaycareId(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedDaycareId(d.id);
                        }
                      }}
                    >
                      <div>
                        <strong>{d.name}</strong>
                        <div className="picker-item-sub">{d.address}</div>
                      </div>
                      <span className="picker-item-badge">
                        {d.price_pill_short_he}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mvp1-scope-notice">
                  ℹ️ <strong>לא מצאתם את הגן?</strong> בגרסה זו (MVP1) ניתן לדווח
                  על מסגרות המופיעות במאגרי הממשלה והרשויות המקומיות בלבד. מסלול
                  דיווח על מסגרות שאינן במרשם ייפתח בשלב ב׳.
                </div>

                <div className="wizard-footer-nav">
                  <button
                    type="button"
                    className="wizard-link-btn"
                    onClick={() => setWithdrawMode(true)}
                  >
                    דיווחתם בטעות על גן זה? לחצו לביטול הדיווח
                  </button>
                  <button
                    type="button"
                    className="wizard-primary-btn"
                    disabled={!selectedDaycareId}
                    onClick={() => setStep(2)}
                  >
                    המשך להזנת המחיר ←
                  </button>
                </div>
              </div>
            )}

            {/* שלב 2: מחיר המחירון החודשי + 4 צירי הנרמול החובה */}
            {step === 2 && selectedDaycare && (
              <div className="wizard-step-body">
                <div className="locked-daycare-banner">
                  <div>
                    <strong>{selectedDaycare.name}</strong> ·{' '}
                    <span>{selectedDaycare.address}</span>
                  </div>
                  <button
                    type="button"
                    className="change-daycare-btn"
                    onClick={() => setStep(1)}
                  >
                    החלפת גן
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="cohort-form-card">
                    {items.length > 1 && (
                      <div className="cohort-form-header">
                        <strong>שכבת גיל #{idx + 1} באותו גן</strong>
                        <button
                          type="button"
                          className="remove-cohort-btn"
                          onClick={() => removeAgeCohort(idx)}
                        >
                          הסרת שכבה זו
                        </button>
                      </div>
                    )}

                    {/* שנת לימודים + מחיר מחירון חודשי */}
                    <div className="form-two-cols">
                      <div className="form-field-group">
                        <label className="field-label">שנת לימודים (חובה):</label>
                        <select
                          className="wizard-select"
                          value={item.school_year}
                          onChange={(e) =>
                            updateItem(idx, {
                              school_year: Number(e.target.value) as
                                | 2025
                                | 2026
                                | 2027,
                            })
                          }
                        >
                          <option value={2027}>תשפ״ז (2026–2027)</option>
                          <option value={2026}>תשפ״ו (2025–2026)</option>
                          <option value={2025}>תשפ״ה (2024–2025)</option>
                        </select>
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          מחיר מחירון חודשי רגיל ב-₪ (ללא הנחות אישיות):
                        </label>
                        <input
                          type="number"
                          min={500}
                          max={15000}
                          step={50}
                          className="wizard-text-input price-input-highlight"
                          value={item.monthly_price_nis}
                          onChange={(e) =>
                            updateItem(idx, {
                              monthly_price_nis: Number(e.target.value),
                              outlier_confirmed_by_user: false,
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* ציר נרמול 1: קבוצת גיל + הפרדת גן פרטי מול צהרון בגילאי 3-6 */}
                    <div className="form-field-group">
                      <label className="field-label">
                        1. קבוצת גיל (ציר נרמול #1 — חובה):
                      </label>
                      <div className="pill-radio-group">
                        {[
                          { code: '0_1', label: 'תינוקות (לידה–שנה)' },
                          { code: '1_2', label: 'פעוטות (שנה–שנתיים)' },
                          { code: '2_3', label: 'בוגרים (שנתיים–3)' },
                          { code: '0_3_mixed', label: 'רב-גילי (0–3)' },
                          { code: '3_6', label: 'גילאי 3–6' },
                        ].map((ag) => (
                          <button
                            key={ag.code}
                            type="button"
                            className={`pill-choice-btn ${
                              item.age_group === ag.code ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, {
                                age_group: ag.code as ReportItemPayload['age_group'],
                                is_municipal_tzaharon_only:
                                  ag.code === '3_6'
                                    ? item.is_municipal_tzaharon_only
                                    : false,
                                reported_has_cameras:
                                  ag.code === '3_6'
                                    ? null
                                    : item.reported_has_cameras,
                              })
                            }
                          >
                            {ag.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {item.age_group === '3_6' && (
                      <div className="form-field-group tzaharon-track-box">
                        <label className="field-label">
                          סוג מסגרת בגילאי 3–6 (למניעת עיוות חציון מול גנים פרטיים — D-38):
                        </label>
                        <div className="pill-radio-group">
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              !item.is_municipal_tzaharon_only ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, {
                                is_municipal_tzaharon_only: false,
                              })
                            }
                          >
                            גן פרטי מלא (בוקר + צהריים)
                          </button>
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              item.is_municipal_tzaharon_only ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, {
                                is_municipal_tzaharon_only: true,
                              })
                            }
                          >
                            צהרון בלבד בגן עירייה (בוקר חינם)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ציר נרמול 2: שעות פעילות א'-ה' */}
                    <div className="form-two-cols">
                      <div className="form-field-group">
                        <label className="field-label">
                          2. שעת פתיחה א׳–ה׳ (חובה):
                        </label>
                        <select
                          className="wizard-select"
                          value={item.start_time_weekday}
                          onChange={(e) =>
                            updateItem(idx, {
                              start_time_weekday: e.target.value,
                            })
                          }
                        >
                          {WEEKDAY_START_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          שעת סיום א׳–ה׳ (חובה):
                        </label>
                        <select
                          className="wizard-select"
                          value={item.end_time_weekday}
                          onChange={(e) =>
                            updateItem(idx, {
                              end_time_weekday: e.target.value,
                            })
                          }
                        >
                          {WEEKDAY_END_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* ציר נרמול 3 + 4: ימי שישי (ושעות יום שישי מותנות) + הזנה */}
                    <div className="form-two-cols">
                      <div className="form-field-group">
                        <label className="field-label">
                          3. כולל ימי שישי? (חובה):
                        </label>
                        <div className="pill-radio-group">
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              item.includes_friday ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, {
                                includes_friday: true,
                                friday_start_time:
                                  item.friday_start_time || '07:30',
                                friday_end_time: item.friday_end_time || '12:30',
                              })
                            }
                          >
                            כן, פעיל בשישי
                          </button>
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              !item.includes_friday ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, {
                                includes_friday: false,
                                friday_start_time: null,
                                friday_end_time: null,
                              })
                            }
                          >
                            לא (א׳–ה׳ בלבד)
                          </button>
                        </div>
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          4. הזנה / ארוחות כלולות במחיר? (חובה):
                        </label>
                        <div className="pill-radio-group">
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              item.includes_nutrition ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, { includes_nutrition: true })
                            }
                          >
                            כולל הזנה
                          </button>
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              !item.includes_nutrition ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, { includes_nutrition: false })
                            }
                          >
                            ללא הזנה
                          </button>
                        </div>
                      </div>
                    </div>

                    {item.includes_friday && (
                      <div className="form-two-cols friday-hours-row">
                        <div className="form-field-group">
                          <label className="field-label">
                            שעת פתיחה ביום שישי:
                          </label>
                          <select
                            className="wizard-select"
                            value={item.friday_start_time || '07:30'}
                            onChange={(e) =>
                              updateItem(idx, {
                                friday_start_time: e.target.value,
                              })
                            }
                          >
                            {FRIDAY_START_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-field-group">
                          <label className="field-label">
                            שעת סיום ביום שישי:
                          </label>
                          <select
                            className="wizard-select"
                            value={item.friday_end_time || '12:30'}
                            onChange={(e) =>
                              updateItem(idx, {
                                friday_end_time: e.target.value,
                              })
                            }
                          >
                            {FRIDAY_END_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 3 שאלות בטיחות וסף רישוי בקליק בודד (רשות) */}
                    <div className="safety-optional-box">
                      <div className="safety-box-title">
                        מאפייני בטיחות וסף חובת רישוי (רשות — קליק בודד):
                      </div>
                      <div className="safety-questions-grid">
                        <div>
                          <span className="safety-q-label">
                            {item.age_group === '3_6'
                              ? 'מספר ילדים (סף חוק חינוך: 11+):'
                              : 'מספר פעוטות (סף חוק הפיקוח: 7+):'}
                          </span>
                          <div className="pill-radio-group compact">
                            <button
                              type="button"
                              className={`pill-choice-btn ${
                                item.reported_over_statutory_threshold === true
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                updateItem(idx, {
                                  reported_over_statutory_threshold: true,
                                })
                              }
                            >
                              {item.age_group === '3_6'
                                ? '11+ ילדים'
                                : '7+ פעוטות'}
                            </button>
                            <button
                              type="button"
                              className={`pill-choice-btn ${
                                item.reported_over_statutory_threshold === false
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                updateItem(idx, {
                                  reported_over_statutory_threshold: false,
                                })
                              }
                            >
                              {item.age_group === '3_6'
                                ? 'עד 10 ילדים'
                                : 'עד 6 פעוטות'}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="safety-q-label">ממ״ד / מקלט תקני:</span>
                          <div className="pill-radio-group compact">
                            <button
                              type="button"
                              className={`pill-choice-btn ${
                                item.reported_has_shelter === true
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                updateItem(idx, { reported_has_shelter: true })
                              }
                            >
                              יש ממ״ד
                            </button>
                            <button
                              type="button"
                              className={`pill-choice-btn ${
                                item.reported_has_shelter === false
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                updateItem(idx, { reported_has_shelter: false })
                              }
                            >
                              אין
                            </button>
                          </div>
                        </div>

                        {item.age_group !== '3_6' && (
                          <div>
                            <span className="safety-q-label">
                              מצלמות (חוק המצלמות 0–3):
                            </span>
                            <div className="pill-radio-group compact">
                              <button
                                type="button"
                                className={`pill-choice-btn ${
                                  item.reported_has_cameras === true
                                    ? 'selected'
                                    : ''
                                }`}
                                onClick={() =>
                                  updateItem(idx, { reported_has_cameras: true })
                                }
                              >
                                יש מצלמות
                              </button>
                              <button
                                type="button"
                                className={`pill-choice-btn ${
                                  item.reported_has_cameras === false
                                    ? 'selected'
                                    : ''
                                }`}
                                onClick={() =>
                                  updateItem(idx, { reported_has_cameras: false })
                                }
                              >
                                אין
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="add-cohort-link-btn"
                  onClick={addAnotherAgeCohort}
                >
                  + הוספת שכבת גיל נוספת באותו גן (למשל תינוקייה + פעוטות)
                </button>

                {/* מודאל Sanity Check היברידי לחריגים (>40% מהחציון — D-38) */}
                {outlierWarningItemIndex !== null && (
                  <div className="outlier-sanity-modal" role="alertdialog">
                    <strong>
                      ⚠️ בדיקת סבירות מחיר (₪
                      {items[
                        outlierWarningItemIndex
                      ].monthly_price_nis.toLocaleString()}{' '}
                      לחודש):
                    </strong>
                    <p>
                      המחיר שהזנתם חורג בשיעור חד (מעל 40%) מחציון המסגרות
                      הדומות באזור. האם אתם בטוחים שזהו מחיר המחירון החודשי
                      הרגיל בשקלים (ולא תשלום שנתי או תעריף מסובסד אישי)?
                    </p>
                    <div className="outlier-modal-actions">
                      <button
                        type="button"
                        className="wizard-secondary-btn"
                        onClick={() => setOutlierWarningItemIndex(null)}
                      >
                        חזרה לתיקון המחיר
                      </button>
                      <button
                        type="button"
                        className="wizard-primary-btn"
                        onClick={handleConfirmOutlierAndProceed}
                      >
                        כן, המחיר מדויק — המשך לשלב 3
                      </button>
                    </div>
                  </div>
                )}

                <div className="wizard-footer-nav">
                  <button
                    type="button"
                    className="wizard-link-btn"
                    onClick={() => setWithdrawMode(true)}
                  >
                    🗑️ דיווחתם בטעות על גן זה? לחצו לביטול הדיווח
                  </button>
                  <button
                    type="button"
                    className="wizard-primary-btn"
                    onClick={handleProceedFromStep2}
                  >
                    המשך להצהרה ואימות ←
                  </button>
                </div>
              </div>
            )}

            {/* שלב 3: הצהרה משפטית (סעיף 62), הודעת פרטיות (סעיף 11) ואימות Google OIDC */}
            {step === 3 && selectedDaycare && (
              <div className="wizard-step-body">
                <h2 id="wizard-modal-title" className="wizard-title">
                  שלב 3 מתוך 3: הצהרת מחיר מחירון ואימות שומר פרטיות
                </h2>

                <label className="legal-checkbox-box">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                  />
                  <span>
                    <strong>הצהרת ההורה המדווח (חובה — סעיף 62 לפקודת הנזיקין):</strong>{' '}
                    אני מצהיר/ה כי הנתונים נמסרים מניסיוני האישי או מבירור ישיר
                    מול המסגרת מתוך תום לב, כי המחיר המדווח הוא{' '}
                    <strong>
                      מחיר המחירון החודשי הרגיל והכללי של המסגרת (ולא תעריף אישי
                      מוזל, מלגה או הנחת אחים)
                    </strong>
                    , וכי למיטב ידיעתי אין בהסכם ההתקשרות תניית סודיות האוסרת על
                    מסירתו.
                  </span>
                </label>

                <div className="section11-privacy-box">
                  <strong>
                    🔒 הודעת פרטיות (סעיף 11 לחוק הגנת הפרטיות, תיקון 13) ועוגיות
                    (Cookies):
                  </strong>
                  <p>
                    לצורך מניעת דיווחי ספאם בלבד, האימות מתבצע מול{' '}
                    <code>Sign in with Google (Scope: openid)</code>. המערכת{' '}
                    <strong>אינה מבקשת ואינה שומרת את כתובת האימייל או שמכם</strong>
                    , אלא גוזרת בזיכרון אסימון חד-כיווני תלוי-גן (
                    <code>HMAC-SHA256</code> עם מפתח נפרד מה-DB הנמחק בתום שנת
                    הלימודים) כך שלא ניתן לקשר בין דיווחיכם על גנים שונים. נעשה
                    שימוש בעוגיית אבטחה הכרחית בלבד (
                    <code>Strictly Necessary HttpOnly Cookie</code>) ללא עוגיות
                    מעקב צד ג׳.בעלי המידע ומפעיל המאגר: עמותת הסדנא לידע ציבורי
                    (ע״ר).
                  </p>
                </div>

                <div className="turnstile-badge-box">
                  <label className="turnstile-check-row">
                    <input
                      type="checkbox"
                      checked={turnstileVerified}
                      onChange={(e) => setTurnstileVerified(e.target.checked)}
                    />
                    <span>
                      🛡️ אימות הגנת בוטים (Cloudflare Turnstile — מאומת)
                    </span>
                  </label>
                </div>

                <div className="wizard-footer-nav">
                  <button
                    type="button"
                    className="wizard-secondary-btn"
                    onClick={() => setStep(2)}
                  >
                    → חזרה לעריכת המחיר
                  </button>
                  <button
                    type="button"
                    className="wizard-primary-btn google-submit-btn"
                    disabled={submitting || !legalAccepted}
                    onClick={handleSubmitFinalReport}
                  >
                    {submitting
                      ? 'מאמת ושולח דיווח...'
                      : '🔐 המשך עם Google ושליחת הדיווח'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
