import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DaycareDetailDto,
  ReportItemPayload,
  submitParentReport,
  withdrawParentReport,
} from '../../services/api-client';
import {
  formatHebrewSchoolYear,
  formatHebrewYearShort,
  getActiveSchoolYear,
  getAvailableSchoolYears,
} from '../../utils/school-years';
import { useModalDismiss } from '../shell/useModalDismiss';

interface ParentReportWizardModalProps {
  open: boolean;
  initialDaycare: DaycareDetailDto | null;
  allDaycares: DaycareDetailDto[];
  initialWithdrawMode?: boolean;
  cityMedianPriceNis: number;
  onClose: () => void;
  onReportSubmitted: (updatedDaycare: DaycareDetailDto | null) => void;
}

interface DraftReportItem {
  school_year: number | null;
  age_group: ReportItemPayload['age_group'] | null;
  monthly_price_str: string;
  start_time_weekday: string;
  end_time_weekday: string;
  includes_friday: boolean | null;
  friday_start_time: string;
  friday_end_time: string;
  includes_nutrition: boolean | null;
  is_municipal_tzaharon_only: boolean | null;
  reported_over_statutory_threshold: boolean | null;
  reported_has_shelter: boolean | null;
  reported_has_cameras: boolean | null;
  outlier_confirmed_by_user: boolean;
}

interface CohortFieldErrors {
  school_year?: string;
  monthly_price_nis?: string;
  age_group?: string;
  is_municipal_tzaharon_only?: string;
  includes_nutrition?: string;
  start_time_weekday?: string;
  end_time_weekday?: string;
  includes_friday?: string;
  friday_start_time?: string;
  friday_end_time?: string;
  duplicate?: string;
}

const PRICE_MIN_NIS = 0;
const PRICE_MAX_NIS = 50000;
const PRICE_SLIDER_STEP = 50;

function generateQuarterHourSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h += 1) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endHour && m > 0) break;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

const WEEKDAY_START_SLOTS = generateQuarterHourSlots(6, 10);
const WEEKDAY_END_SLOTS = generateQuarterHourSlots(12, 19);
const FRIDAY_START_SLOTS = generateQuarterHourSlots(6, 10);
const FRIDAY_END_SLOTS = generateQuarterHourSlots(11, 15);

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function createEmptyDraftItem(): DraftReportItem {
  return {
    school_year: null,
    age_group: null,
    monthly_price_str: '',
    start_time_weekday: '',
    end_time_weekday: '',
    includes_friday: null,
    friday_start_time: '',
    friday_end_time: '',
    includes_nutrition: null,
    is_municipal_tzaharon_only: null,
    reported_over_statutory_threshold: null,
    reported_has_shelter: null,
    reported_has_cameras: null,
    outlier_confirmed_by_user: false,
  };
}

interface QuarterHourTimePickerProps {
  value: string;
  slots: string[];
  presets: string[];
  placeholder: string;
  invalid?: boolean;
  ariaLabel: string;
  onChange: (next: string) => void;
}

const QuarterHourTimePicker: React.FC<QuarterHourTimePickerProps> = ({
  value,
  slots,
  presets,
  placeholder,
  invalid,
  ariaLabel,
  onChange,
}) => {
  const currentIndex = value ? slots.indexOf(value) : -1;

  const stepSlot = (delta: number) => {
    if (currentIndex === -1) {
      onChange(presets[0] || slots[Math.floor(slots.length / 2)]);
      return;
    }
    const nextIdx = Math.min(slots.length - 1, Math.max(0, currentIndex + delta));
    onChange(slots[nextIdx]);
  };

  return (
    <div className={`quarter-time-picker ${invalid ? 'field-invalid' : ''}`}>
      <div className="quarter-time-stepper">
        <button
          type="button"
          className="time-step-btn"
          aria-label={`הקטנת ${ariaLabel} ב-15 דקות`}
          onClick={() => stepSlot(-1)}
        >
          −
        </button>
        <select
          className="quarter-time-select"
          aria-label={ariaLabel}
          aria-invalid={invalid ? 'true' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {slots.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="time-step-btn"
          aria-label={`הגדלת ${ariaLabel} ב-15 דקות`}
          onClick={() => stepSlot(1)}
        >
          +
        </button>
      </div>
      <div className="time-presets-row">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`time-preset-chip ${value === p ? 'selected' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * אשף דיווח מחיר להורים ב-3 שלבים:
 * שלב 1: בחירת המסגרת הרשמית (או מעבר לביטול דיווח עצמי).
 * שלב 2: מחיר ופרטים נוספים (ערכי ברירת מחדל ריקים, סליידר 0–50,000 ₪, בורר רבע שעה, ולידציה מלאה ושונות שכבות).
 * שלב 3: הצהרת מחיר מחירון, הסבר פרטיות מתקפל ואימות Google OIDC (Turnstile רץ אוטומטית ברקע).
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
  const availableSchoolYears = useMemo(() => getAvailableSchoolYears(), []);
  const quickSchoolYears = availableSchoolYears.slice(0, 3);
  const olderSchoolYears = availableSchoolYears.slice(3);
  const activeSchoolYear = useMemo(() => getActiveSchoolYear(), []);

  const [step, setStep] = useState<1 | 2 | 3>(initialDaycare ? 2 : 1);
  const [withdrawMode, setWithdrawMode] = useState<boolean>(initialWithdrawMode);
  const [selectedDaycareId, setSelectedDaycareId] = useState<string>(
    initialDaycare?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [items, setItems] = useState<DraftReportItem[]>([
    createEmptyDraftItem(),
  ]);
  const [fieldErrors, setFieldErrors] = useState<CohortFieldErrors[]>([{}]);
  const [withdrawYear, setWithdrawYear] = useState<number | null>(null);
  const [withdrawAgeGroup, setWithdrawAgeGroup] = useState<string | null>(null);
  const [withdrawErrors, setWithdrawErrors] = useState<{
    daycare?: string;
    year?: string;
    ageGroup?: string;
  }>({});
  const [outlierWarningItemIndex, setOutlierWarningItemIndex] = useState<
    number | null
  >(null);
  const [legalAccepted, setLegalAccepted] = useState<boolean>(false);
  const [privacyExpanded, setPrivacyExpanded] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resultMessageHe, setResultMessageHe] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const prevOpenRef = useRef<boolean>(false);

  useModalDismiss(open, onClose);

  // איפוס האשף אך ורק בעת פתיחה חדשה (false -> true), כדי שעדכון allDaycares לאחר שליחה לא יחזיר לשלב 2!
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setWithdrawMode(initialWithdrawMode);
      setSelectedDaycareId(initialDaycare?.id || '');
      setStep(initialDaycare ? 2 : 1);
      setSearchQuery('');
      setItems([createEmptyDraftItem()]);
      setFieldErrors([{}]);
      setWithdrawYear(null);
      setWithdrawAgeGroup(null);
      setWithdrawErrors({});
      setOutlierWarningItemIndex(null);
      setLegalAccepted(false);
      setPrivacyExpanded(false);
      setResultMessageHe(null);
      setErrorText(null);
    }
    prevOpenRef.current = open;
  }, [open, initialDaycare, initialWithdrawMode, activeSchoolYear]);

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

  const updateItem = (idx: number, patch: Partial<DraftReportItem>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
    // ניקוי שגיאות לשדות שהמשתמש עדכן
    setFieldErrors((prev) =>
      prev.map((errObj, i) => {
        if (i !== idx) return errObj;
        const nextErr = { ...errObj };
        if ('school_year' in patch) {
          delete nextErr.school_year;
          delete nextErr.duplicate;
        }
        if ('monthly_price_str' in patch) delete nextErr.monthly_price_nis;
        if ('age_group' in patch) {
          delete nextErr.age_group;
          delete nextErr.duplicate;
        }
        if ('is_municipal_tzaharon_only' in patch)
          delete nextErr.is_municipal_tzaharon_only;
        if ('includes_nutrition' in patch) delete nextErr.includes_nutrition;
        if ('start_time_weekday' in patch) delete nextErr.start_time_weekday;
        if ('end_time_weekday' in patch) delete nextErr.end_time_weekday;
        if ('includes_friday' in patch) {
          delete nextErr.includes_friday;
          delete nextErr.friday_start_time;
          delete nextErr.friday_end_time;
        }
        if ('friday_start_time' in patch) delete nextErr.friday_start_time;
        if ('friday_end_time' in patch) delete nextErr.friday_end_time;
        return nextErr;
      })
    );
  };

  const addAnotherAgeCohort = () => {
    if (items.length >= 5) return;
    setItems((prev) => [...prev, createEmptyDraftItem()]);
    setFieldErrors((prev) => [...prev, {}]);
  };

  const removeAgeCohort = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setFieldErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateAllCohorts = (): {
    valid: boolean;
    errors: CohortFieldErrors[];
  } => {
    const errors: CohortFieldErrors[] = items.map(() => ({}));
    let valid = true;

    // 1. בדיקת כל שדות החובה והתקינות בכל שכבת גיל
    items.forEach((it, idx) => {
      const err = errors[idx];

      if (it.school_year === null) {
        err.school_year = 'יש לבחור שנת לימודים.';
        valid = false;
      }

      const trimmedPrice = it.monthly_price_str.trim();
      const parsedPrice = Number(trimmedPrice);
      if (
        trimmedPrice === '' ||
        !Number.isInteger(parsedPrice) ||
        parsedPrice < PRICE_MIN_NIS ||
        parsedPrice > PRICE_MAX_NIS
      ) {
        err.monthly_price_nis =
          'יש להזין מחיר חודשי שלם בין 0 ל-50,000 ₪.';
        valid = false;
      }

      if (it.age_group === null) {
        err.age_group = 'יש לבחור קבוצת גיל.';
        valid = false;
      }

      if (it.age_group === '3_6' && it.is_municipal_tzaharon_only === null) {
        err.is_municipal_tzaharon_only = 'יש לבחור סוג מסגרת בגילאי 3–6.';
        valid = false;
      }

      if (it.includes_nutrition === null) {
        err.includes_nutrition = 'יש לבחור האם ההזנה כלולה במחיר.';
        valid = false;
      }

      if (!it.start_time_weekday) {
        err.start_time_weekday = 'יש לבחור שעת פתיחה א׳–ה׳.';
        valid = false;
      }

      if (!it.end_time_weekday) {
        err.end_time_weekday = 'יש לבחור שעת סיום א׳–ה׳.';
        valid = false;
      } else if (
        it.start_time_weekday &&
        timeToMinutes(it.end_time_weekday) <=
          timeToMinutes(it.start_time_weekday)
      ) {
        err.end_time_weekday = 'שעת הסיום חייבת להיות מאוחרת משעת הפתיחה.';
        valid = false;
      }

      if (it.includes_friday === null) {
        err.includes_friday = 'יש לבחור האם המסגרת פעילה בימי שישי.';
        valid = false;
      } else if (it.includes_friday) {
        if (!it.friday_start_time) {
          err.friday_start_time = 'יש לבחור שעת פתיחה ביום שישי.';
          valid = false;
        }
        if (!it.friday_end_time) {
          err.friday_end_time = 'יש לבחור שעת סיום ביום שישי.';
          valid = false;
        } else if (
          it.friday_start_time &&
          timeToMinutes(it.friday_end_time) <=
            timeToMinutes(it.friday_start_time)
        ) {
          err.friday_end_time =
            'שעת הסיום ביום שישי חייבת להיות מאוחרת משעת הפתיחה.';
          valid = false;
        }
      }
    });

    // 2. אימות כללי השונות של ה-DB: UNIQUE (dedup_token, age_group) לכל שנת לימודים
    const seenPairs = new Map<string, number[]>();
    items.forEach((it, idx) => {
      if (it.school_year !== null && it.age_group !== null) {
        const key = `${it.school_year}::${it.age_group}`;
        const list = seenPairs.get(key) || [];
        list.push(idx);
        seenPairs.set(key, list);
      }
    });

    seenPairs.forEach((indices) => {
      if (indices.length > 1) {
        valid = false;
        indices.forEach((idx) => {
          errors[idx].duplicate =
            'לא ניתן לדווח פעמיים על אותה קבוצת גיל באותה שנת לימודים. בחרו שכבת גיל או שנה אחרת.';
        });
      }
    });

    return { valid, errors };
  };

  // ולידציה מלאה + בדיקת Sanity Check היברידית בסיום שלב 2 לפני מעבר לשלב 3
  const handleProceedFromStep2 = () => {
    setErrorText(null);
    const { valid, errors } = validateAllCohorts();
    setFieldErrors(errors);

    if (!valid) {
      setErrorText('יש להשלים או לתקן את השדות המסומנים באדום לפני ההמשך.');
      return;
    }

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const priceVal = Number(it.monthly_price_str);
      const refMedian = it.is_municipal_tzaharon_only
        ? 980
        : selectedDaycare?.is_subsidized
          ? 2515
          : selectedDaycare?.headline_price_nis || cityMedianPriceNis || 5400;

      const deviationRatio =
        refMedian > 0 ? Math.abs(priceVal - refMedian) / refMedian : 0;
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

  const buildReportPayloads = (): ReportItemPayload[] =>
    items.map((it) => ({
      school_year: it.school_year as number,
      age_group: it.age_group as ReportItemPayload['age_group'],
      monthly_price_nis: Number(it.monthly_price_str),
      start_time_weekday: it.start_time_weekday,
      end_time_weekday: it.end_time_weekday,
      includes_friday: Boolean(it.includes_friday),
      friday_start_time: it.includes_friday ? it.friday_start_time : null,
      friday_end_time: it.includes_friday ? it.friday_end_time : null,
      includes_nutrition: Boolean(it.includes_nutrition),
      is_municipal_tzaharon_only:
        it.age_group === '3_6' ? Boolean(it.is_municipal_tzaharon_only) : false,
      reported_over_statutory_threshold: it.reported_over_statutory_threshold,
      reported_has_shelter: it.reported_has_shelter,
      reported_has_cameras:
        it.age_group === '3_6' ? null : it.reported_has_cameras,
      outlier_confirmed_by_user: it.outlier_confirmed_by_user,
    }));

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
        // Cloudflare Turnstile רץ אוטומטית ברקע במצב Managed/Invisible
        turnstile_token: 'turnstile_managed_background_token',
        legal_declaration_accepted: legalAccepted,
        items: buildReportPayloads(),
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
    const errors: { daycare?: string; year?: string; ageGroup?: string } = {};
    if (!selectedDaycare) {
      errors.daycare = 'יש לבחור מסגרת לביטול הדיווח.';
    }
    if (withdrawYear === null) {
      errors.year = 'יש לבחור שנת לימודים לביטול הדיווח.';
    }
    if (withdrawAgeGroup === null) {
      errors.ageGroup = 'יש לבחור שכבת גיל לביטול (או "כל שכבות הגיל").';
    }
    setWithdrawErrors(errors);
    if (
      Object.keys(errors).length > 0 ||
      !selectedDaycare ||
      withdrawYear === null ||
      withdrawAgeGroup === null
    ) {
      setErrorText('יש להשלים את השדות המסומנים באדום לפני הביטול.');
      return;
    }

    setSubmitting(true);
    setErrorText(null);
    try {
      const response = await withdrawParentReport({
        daycare_id: selectedDaycare.id,
        school_year: withdrawYear,
        age_group: withdrawAgeGroup === 'all' ? null : withdrawAgeGroup,
        turnstile_token: 'turnstile_managed_background_token',
      });
      setResultMessageHe(response.confirmation_message_he);
      if (response.updatedDaycare) {
        onReportSubmitted(response.updatedDaycare);
      }
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wizard-modal-card">
        <div className="modal-sticky-close-row">
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת טופס דיווח"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* מסך סיום אחיד */}
        {resultMessageHe ? (
          <div className="wizard-confirmation-screen">
            <div className="confirmation-check-circle">✓</div>
            <h2 id="wizard-modal-title">הפעולה הושלמה בהצלחה!</h2>
            <p className="confirmation-body-text">{resultMessageHe}</p>
            <div className="privacy-assurance-pill">
              🔒 הפרטיות שלך נשמרה: לא שמרנו את כתובת המייל או שמך, והדיווח אינו
              ניתן לקישור אל דיווחים אחרים שלך.
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
          /* מסלול ביטול דיווח עצמי */
          <div className="wizard-step-container">
            <h2 id="wizard-modal-title" className="wizard-title">
              🗑️ ביטול דיווח עצמי לגן
            </h2>
            <p className="wizard-subtitle">
              אם דיווחתם בטעות על מסגרת זו, תוכלו להזדהות עם אותו חשבון Google
              (ללא חשיפת מייל) ולהסיר את הדיווח שלכם משנת הלימודים שנבחרה.
            </p>

            {errorText && (
              <div className="wizard-error-banner" role="alert">
                ⚠️ {errorText}
              </div>
            )}

            <div className="required-legend-note">
              <span className="required-star">*</span> שדה חובה
            </div>

            <div className="form-field-group">
              <label className="field-label">
                בחירת מסגרת <span className="required-star">*</span>
              </label>
              {selectedDaycare ? (
                <div className="locked-daycare-banner">
                  <div>
                    <strong>{selectedDaycare.name}</strong> ·{' '}
                    <span>{selectedDaycare.address}</span>
                  </div>
                  <button
                    type="button"
                    className="change-daycare-btn"
                    onClick={() => setSelectedDaycareId('')}
                  >
                    החלפת גן
                  </button>
                </div>
              ) : (
                <div
                  className={
                    withdrawErrors.daycare ? 'field-invalid-group' : ''
                  }
                >
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
                        onClick={() => {
                          setSelectedDaycareId(d.id);
                          setWithdrawErrors((prev) => ({
                            ...prev,
                            daycare: undefined,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedDaycareId(d.id);
                            setWithdrawErrors((prev) => ({
                              ...prev,
                              daycare: undefined,
                            }));
                          }
                        }}
                      >
                        <div>
                          <strong>{d.name}</strong>
                          <div className="picker-item-sub">{d.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {withdrawErrors.daycare && (
                <div className="field-error-note">{withdrawErrors.daycare}</div>
              )}
            </div>

            <div className="form-field-group">
              <label className="field-label">
                שנת הלימודים עבורה תרצו לבטל את הדיווח{' '}
                <span className="required-star">*</span>
              </label>
              <div
                className={`pill-radio-group ${withdrawErrors.year ? 'field-invalid-group' : ''}`}
              >
                {availableSchoolYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    className={`pill-choice-btn ${withdrawYear === yr ? 'selected' : ''}`}
                    onClick={() => {
                      setWithdrawYear(yr);
                      setWithdrawErrors((prev) => ({
                        ...prev,
                        year: undefined,
                      }));
                    }}
                  >
                    {formatHebrewSchoolYear(yr)}
                  </button>
                ))}
              </div>
              {withdrawErrors.year && (
                <div className="field-error-note">{withdrawErrors.year}</div>
              )}
            </div>

            <div className="form-field-group">
              <label className="field-label">
                שכבת גיל לביטול <span className="required-star">*</span>
              </label>
              <div
                className={`pill-radio-group ${withdrawErrors.ageGroup ? 'field-invalid-group' : ''}`}
              >
                {[
                  { code: 'all', label: 'כל שכבות הגיל' },
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
                      withdrawAgeGroup === ag.code ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setWithdrawAgeGroup(ag.code);
                      setWithdrawErrors((prev) => ({
                        ...prev,
                        ageGroup: undefined,
                      }));
                    }}
                  >
                    {ag.label}
                  </button>
                ))}
              </div>
              {withdrawErrors.ageGroup && (
                <div className="field-error-note">
                  {withdrawErrors.ageGroup}
                </div>
              )}
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
          /* אשף 3 השלבים לדיווח או עדכון מחיר */
          <div className="wizard-step-container">
            <div className="wizard-progress-header">
              <span className={`step-dot ${step >= 1 ? 'active' : ''}`}>
                1. בחירת המסגרת
              </span>
              <span className={`step-dot ${step >= 2 ? 'active' : ''}`}>
                2. מחיר ופרטים נוספים
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
                  בחרו את המסגרת הרשמית
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
                    </div>
                  ))}
                </div>

                <div className="mvp1-scope-notice">
                  ℹ️ <strong>לא מצאתם את הגן?</strong> כרגע ניתן לדווח על מסגרות
                  המופיעות במאגרי הממשלה והרשויות המקומיות בלבד. מסלול דיווח על
                  מסגרות שאינן במרשם ייפתח בהמשך.
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

            {/* שלב 2: מחיר ופרטים נוספים */}
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

                <div className="required-legend-note">
                  <span className="required-star">*</span> שדה חובה
                </div>

                {items.map((item, idx) => {
                  const err = fieldErrors[idx] || {};
                  const numericPrice =
                    item.monthly_price_str.trim() === ''
                      ? 0
                      : Math.min(
                          PRICE_MAX_NIS,
                          Math.max(PRICE_MIN_NIS, Number(item.monthly_price_str) || 0)
                        );
                  const isOlderYearSelected =
                    item.school_year !== null &&
                    olderSchoolYears.includes(item.school_year);

                  return (
                    <div
                      key={idx}
                      className={`cohort-form-card ${err.duplicate ? 'cohort-duplicate-invalid' : ''}`}
                    >
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

                      {err.duplicate && (
                        <div className="field-error-note duplicate-banner" role="alert">
                          ⚠️ {err.duplicate}
                        </div>
                      )}

                      {/* שנת לימודים (3 שנים מובילות כולל שנה הבאה + תפריט לשנים קודמות) */}
                      <div className="form-field-group">
                        <label className="field-label">
                          שנת לימודים <span className="required-star">*</span>
                        </label>
                        <div
                          className={`school-year-selector-row ${err.school_year || err.duplicate ? 'field-invalid-group' : ''}`}
                        >
                          <div className="pill-radio-group">
                            {quickSchoolYears.map((yr) => {
                              const tag =
                                yr === activeSchoolYear + 1
                                  ? ' · שנה הבאה'
                                  : yr === activeSchoolYear
                                    ? ' · השנה'
                                    : '';
                              return (
                                <button
                                  key={yr}
                                  type="button"
                                  className={`pill-choice-btn ${
                                    item.school_year === yr ? 'selected' : ''
                                  }`}
                                  onClick={() =>
                                    updateItem(idx, { school_year: yr })
                                  }
                                >
                                  {formatHebrewYearShort(yr)} ({yr - 1}–{yr})
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                          {olderSchoolYears.length > 0 && (
                            <select
                              aria-label="שנות לימודים קודמות"
                              className={`wizard-select older-years-select ${isOlderYearSelected ? 'selected' : ''}`}
                              value={isOlderYearSelected ? String(item.school_year) : ''}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v) updateItem(idx, { school_year: v });
                              }}
                            >
                              <option value="">שנים קודמות...</option>
                              {olderSchoolYears.map((yr) => (
                                <option key={yr} value={yr}>
                                  {formatHebrewSchoolYear(yr)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {err.school_year && (
                          <div className="field-error-note">{err.school_year}</div>
                        )}
                      </div>

                      {/* מחיר מחירון חודשי: שדה מספר (0–50,000) + סליידר בקפיצות 50 ₪ */}
                      <div className="form-field-group">
                        <label className="field-label">
                          מחיר מחירון חודשי רגיל ב-₪ (ללא הנחות אישיות){' '}
                          <span className="required-star">*</span>
                        </label>
                        <div className="price-modern-control">
                          <div className="price-input-row">
                            <input
                              type="number"
                              min={PRICE_MIN_NIS}
                              max={PRICE_MAX_NIS}
                              step={1}
                              placeholder="לדוגמה: 5400"
                              aria-invalid={err.monthly_price_nis ? 'true' : undefined}
                              className={`wizard-text-input price-input-highlight ${err.monthly_price_nis ? 'field-invalid' : ''}`}
                              value={item.monthly_price_str}
                              onChange={(e) =>
                                updateItem(idx, {
                                  monthly_price_str: e.target.value,
                                  outlier_confirmed_by_user: false,
                                })
                              }
                            />
                            <span className="price-unit-tag">₪ / חודש</span>
                          </div>
                          <div className="price-slider-row">
                            <span className="slider-bound-label">₪0</span>
                            <input
                              type="range"
                              aria-label="גרירת מחיר חודשי בקפיצות של 50 שקלים"
                              className="price-range-slider"
                              min={PRICE_MIN_NIS}
                              max={PRICE_MAX_NIS}
                              step={PRICE_SLIDER_STEP}
                              value={numericPrice}
                              onChange={(e) =>
                                updateItem(idx, {
                                  monthly_price_str: e.target.value,
                                  outlier_confirmed_by_user: false,
                                })
                              }
                            />
                            <span className="slider-bound-label">₪50,000</span>
                          </div>
                        </div>
                        {err.monthly_price_nis && (
                          <div className="field-error-note">
                            {err.monthly_price_nis}
                          </div>
                        )}
                      </div>

                      {/* קבוצת גיל + הזנה / ארוחות באותה שורה */}
                      <div className="form-age-nutrition-row">
                        <div className="form-field-group">
                          <label className="field-label">
                            קבוצת גיל <span className="required-star">*</span>
                          </label>
                          <div
                            className={`pill-radio-group ${err.age_group || err.duplicate ? 'field-invalid-group' : ''}`}
                          >
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
                                    age_group:
                                      ag.code as ReportItemPayload['age_group'],
                                    is_municipal_tzaharon_only:
                                      ag.code === '3_6'
                                        ? item.is_municipal_tzaharon_only
                                        : null,
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
                          {err.age_group && (
                            <div className="field-error-note">{err.age_group}</div>
                          )}
                        </div>

                        <div className="form-field-group">
                          <label className="field-label">
                            הזנה / ארוחות כלולות במחיר?{' '}
                            <span className="required-star">*</span>
                          </label>
                          <div
                            className={`pill-radio-group ${err.includes_nutrition ? 'field-invalid-group' : ''}`}
                          >
                            <button
                              type="button"
                              className={`pill-choice-btn ${
                                item.includes_nutrition === true ? 'selected' : ''
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
                                item.includes_nutrition === false ? 'selected' : ''
                              }`}
                              onClick={() =>
                                updateItem(idx, { includes_nutrition: false })
                              }
                            >
                              ללא הזנה
                            </button>
                          </div>
                          {err.includes_nutrition && (
                            <div className="field-error-note">
                              {err.includes_nutrition}
                            </div>
                          )}
                        </div>
                      </div>

                      {item.age_group === '3_6' && (
                        <div className="form-field-group tzaharon-track-box">
                          <label className="field-label">
                            סוג מסגרת בגילאי 3–6{' '}
                            <span className="required-star">*</span>
                          </label>
                          <div
                            className={`pill-radio-group ${err.is_municipal_tzaharon_only ? 'field-invalid-group' : ''}`}
                          >
                            <button
                              type="button"
                              className={`pill-choice-btn ${
                                item.is_municipal_tzaharon_only === false
                                  ? 'selected'
                                  : ''
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
                                item.is_municipal_tzaharon_only === true
                                  ? 'selected'
                                  : ''
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
                          {err.is_municipal_tzaharon_only && (
                            <div className="field-error-note">
                              {err.is_municipal_tzaharon_only}
                            </div>
                          )}
                        </div>
                      )}

                      {/* שעות פעילות א'–ה' בבורר רבע שעה */}
                      <div className="form-two-cols">
                        <div className="form-field-group">
                          <label className="field-label">
                            שעת פתיחה א׳–ה׳{' '}
                            <span className="required-star">*</span>
                          </label>
                          <QuarterHourTimePicker
                            value={item.start_time_weekday}
                            slots={WEEKDAY_START_SLOTS}
                            presets={['07:00', '07:30', '08:00']}
                            placeholder="בחרו שעת פתיחה..."
                            invalid={Boolean(err.start_time_weekday)}
                            ariaLabel="שעת פתיחה א׳–ה׳"
                            onChange={(val) =>
                              updateItem(idx, { start_time_weekday: val })
                            }
                          />
                          {err.start_time_weekday && (
                            <div className="field-error-note">
                              {err.start_time_weekday}
                            </div>
                          )}
                        </div>

                        <div className="form-field-group">
                          <label className="field-label">
                            שעת סיום א׳–ה׳{' '}
                            <span className="required-star">*</span>
                          </label>
                          <QuarterHourTimePicker
                            value={item.end_time_weekday}
                            slots={WEEKDAY_END_SLOTS}
                            presets={['16:00', '16:30', '17:00']}
                            placeholder="בחרו שעת סיום..."
                            invalid={Boolean(err.end_time_weekday)}
                            ariaLabel="שעת סיום א׳–ה׳"
                            onChange={(val) =>
                              updateItem(idx, { end_time_weekday: val })
                            }
                          />
                          {err.end_time_weekday && (
                            <div className="field-error-note">
                              {err.end_time_weekday}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ימי שישי + שעות שישי מותנות */}
                      <div className="form-field-group">
                        <label className="field-label">
                          כולל ימי שישי?{' '}
                          <span className="required-star">*</span>
                        </label>
                        <div
                          className={`pill-radio-group ${err.includes_friday ? 'field-invalid-group' : ''}`}
                        >
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              item.includes_friday === true ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, { includes_friday: true })
                            }
                          >
                            כן, פעיל בשישי
                          </button>
                          <button
                            type="button"
                            className={`pill-choice-btn ${
                              item.includes_friday === false ? 'selected' : ''
                            }`}
                            onClick={() =>
                              updateItem(idx, {
                                includes_friday: false,
                                friday_start_time: '',
                                friday_end_time: '',
                              })
                            }
                          >
                            לא (א׳–ה׳ בלבד)
                          </button>
                        </div>
                        {err.includes_friday && (
                          <div className="field-error-note">
                            {err.includes_friday}
                          </div>
                        )}
                      </div>

                      {item.includes_friday === true && (
                        <div className="form-two-cols friday-hours-row">
                          <div className="form-field-group">
                            <label className="field-label">
                              שעת פתיחה ביום שישי{' '}
                              <span className="required-star">*</span>
                            </label>
                            <QuarterHourTimePicker
                              value={item.friday_start_time}
                              slots={FRIDAY_START_SLOTS}
                              presets={['07:30', '08:00']}
                              placeholder="בחרו שעת פתיחה..."
                              invalid={Boolean(err.friday_start_time)}
                              ariaLabel="שעת פתיחה ביום שישי"
                              onChange={(val) =>
                                updateItem(idx, { friday_start_time: val })
                              }
                            />
                            {err.friday_start_time && (
                              <div className="field-error-note">
                                {err.friday_start_time}
                              </div>
                            )}
                          </div>

                          <div className="form-field-group">
                            <label className="field-label">
                              שעת סיום ביום שישי{' '}
                              <span className="required-star">*</span>
                            </label>
                            <QuarterHourTimePicker
                              value={item.friday_end_time}
                              slots={FRIDAY_END_SLOTS}
                              presets={['12:00', '12:30', '13:00']}
                              placeholder="בחרו שעת סיום..."
                              invalid={Boolean(err.friday_end_time)}
                              ariaLabel="שעת סיום ביום שישי"
                              onChange={(val) =>
                                updateItem(idx, { friday_end_time: val })
                              }
                            />
                            {err.friday_end_time && (
                              <div className="field-error-note">
                                {err.friday_end_time}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* מאפייני בטיחות (רשות) */}
                      <div className="safety-optional-box">
                        <div className="safety-box-title">מאפייני בטיחות</div>
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
                            <span className="safety-q-label">
                              ממ״ד / מקלט תקני:
                            </span>
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
                                יש
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
                              <span className="safety-q-label">מצלמות</span>
                              <div className="pill-radio-group compact">
                                <button
                                  type="button"
                                  className={`pill-choice-btn ${
                                    item.reported_has_cameras === true
                                      ? 'selected'
                                      : ''
                                  }`}
                                  onClick={() =>
                                    updateItem(idx, {
                                      reported_has_cameras: true,
                                    })
                                  }
                                >
                                  יש
                                </button>
                                <button
                                  type="button"
                                  className={`pill-choice-btn ${
                                    item.reported_has_cameras === false
                                      ? 'selected'
                                      : ''
                                  }`}
                                  onClick={() =>
                                    updateItem(idx, {
                                      reported_has_cameras: false,
                                    })
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
                  );
                })}

                <button
                  type="button"
                  className="add-cohort-link-btn"
                  onClick={addAnotherAgeCohort}
                >
                  + הוספת שכבת גיל נוספת באותו גן
                </button>

                {/* מודאל Sanity Check היברידי לחריגים (>40% מהחציון) */}
                {outlierWarningItemIndex !== null && (
                  <div className="outlier-sanity-modal" role="alertdialog">
                    <strong>
                      ⚠️ בדיקת סבירות מחיר (₪
                      {Number(
                        items[outlierWarningItemIndex].monthly_price_str
                      ).toLocaleString()}{' '}
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

            {/* שלב 3: הצהרת מחיר מחירון ואימות שומר פרטיות */}
            {step === 3 && selectedDaycare && (
              <div className="wizard-step-body">
                <h2 id="wizard-modal-title" className="wizard-title">
                  הצהרת מחיר מחירון ואימות שומר פרטיות
                </h2>

                <label className="legal-checkbox-box">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                  />
                  <span>
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

                <div className="privacy-collapsible-wrapper">
                  <button
                    type="button"
                    className="privacy-collapsible-btn"
                    aria-expanded={privacyExpanded}
                    onClick={() => setPrivacyExpanded((v) => !v)}
                  >
                    <span>🔒 איך אנחנו שומרים על הפרטיות שלך?</span>
                    <span className="privacy-chevron" aria-hidden="true">
                      {privacyExpanded ? '▴' : '▾'}
                    </span>
                  </button>
                  {privacyExpanded && (
                    <div className="section11-privacy-box">
                      <p>
                        ההתחברות עם Google משמשת אך ורק כדי למנוע ספאם ודיווחים
                        כפולים. אנחנו{' '}
                        <strong>
                          לא מקבלים ולא שומרים את כתובת המייל או את השם שלך
                        </strong>
                        . המערכת יוצרת קוד מוצפן זמני שלא מאפשר לזהות אותך או
                        לקשר בין דיווחים על גנים שונים, והוא נמחק אוטומטית בסוף
                        שנת הלימודים. האתר לא משתמש בעוגיות פרסום או מעקב.
                        המאגר מופעל ע״י עמותת הסדנא לידע ציבורי (ע״ר).
                      </p>
                    </div>
                  )}
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
