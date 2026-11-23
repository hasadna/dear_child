import React, { useState } from 'react';
import {
  CorrectionRequestPayload,
  DaycareDetailDto,
  submitCorrectionRequest,
} from '../../services/api-client';

interface CorrectionRequestModalProps {
  daycare: DaycareDetailDto | null;
  onClose: () => void;
}

const ERROR_CATEGORIES: {
  code: CorrectionRequestPayload['error_category'];
  label: string;
  desc: string;
}[] = [
  {
    code: 'wrong_price_outlier',
    label: 'המחיר המוצג שגוי או חריג',
    desc: 'המחיר אינו משקף את מחיר המחירון הכללי של המסגרת לשנה זו.',
  },
  {
    code: 'daycare_closed',
    label: 'המעון / הגן נסגר ואינו פעיל עוד',
    desc: 'המסגרת הפסיקה את פעילותה בכתובת זו.',
  },
  {
    code: 'wrong_address_or_location',
    label: 'כתובת או מיקום הסיכה במפה אינם מדויקים',
    desc: 'המסגרת פועלת בכתובת אחרת או שהקואורדינטות שגויות.',
  },
  {
    code: 'wrong_license_status',
    label: 'סטטוס הרישוי או הסבסוד השתנה',
    desc: 'קיים עדכון במרשם משרד החינוך / העבודה שטרם השתקף בכרטיס.',
  },
  {
    code: 'other_factual_error',
    label: 'טעות עובדתית אחרת בפרטי המסגרת',
    desc: 'שעות פעילות, שכבת גיל או סמל מוסד שגויים.',
  },
];

/**
 * מודאל מובנה לדיווח על טעות בנתוני גן ("מצאתם טעות?") — docs/06_ui_ux_and_cartography_spec.md סעיף 6
 * ללא שדה טקסט חופשי וללא איסוף מידע אישי (מניעת לשון הרע וציות לתיקון 13).
 */
export const CorrectionRequestModal: React.FC<CorrectionRequestModalProps> = ({
  daycare,
  onClose,
}) => {
  const [errorCategory, setErrorCategory] =
    useState<CorrectionRequestPayload['error_category']>('wrong_price_outlier');
  const [submitterRole, setSubmitterRole] =
    useState<CorrectionRequestPayload['submitter_role']>('parent');
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  if (!daycare) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await submitCorrectionRequest({
        daycare_id: daycare.id,
        error_category: errorCategory,
        submitter_role: submitterRole,
        turnstile_token: 'turnstile_verified_token',
      });
      setDoneMessage(res.confirmation_message_he);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-modal-title"
    >
      <div className="wizard-modal-card">
        <button
          type="button"
          className="modal-close-x"
          aria-label="סגירת דיווח על טעות"
          onClick={onClose}
        >
          ✕
        </button>

        {doneMessage ? (
          <div className="wizard-confirmation-screen">
            <div className="confirmation-check-circle">✓</div>
            <h2 id="correction-modal-title">הדיווח על הטעות נקלט</h2>
            <p className="confirmation-body-text">{doneMessage}</p>
            <button
              type="button"
              className="wizard-primary-btn"
              onClick={onClose}
            >
              סגירה
            </button>
          </div>
        ) : (
          <div className="wizard-step-container">
            <h2 id="correction-modal-title" className="wizard-title">
              🚩 מצאתם טעות בנתוני המסגרת?
            </h2>
            <p className="wizard-subtitle">
              דיווח מובנה לבדיקת צוות הבקרה של הסדנא לידע ציבורי עבור{' '}
              <strong>{daycare.name}</strong> ({daycare.address}):
            </p>

            <div className="form-field-group">
              <label className="field-label">מהי מהות הטעות שמצאתם?</label>
              <div className="daycare-picker-list">
                {ERROR_CATEGORIES.map((cat) => (
                  <div
                    key={cat.code}
                    role="radio"
                    aria-checked={errorCategory === cat.code}
                    tabIndex={0}
                    className={`daycare-picker-item ${
                      errorCategory === cat.code ? 'selected' : ''
                    }`}
                    onClick={() => setErrorCategory(cat.code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setErrorCategory(cat.code);
                      }
                    }}
                  >
                    <div>
                      <strong>{cat.label}</strong>
                      <div className="picker-item-sub">{cat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label">מי מדווח/ת על הטעות?</label>
              <div className="pill-radio-group">
                <button
                  type="button"
                  className={`pill-choice-btn ${
                    submitterRole === 'parent' ? 'selected' : ''
                  }`}
                  onClick={() => setSubmitterRole('parent')}
                >
                  הורה במסגרת
                </button>
                <button
                  type="button"
                  className={`pill-choice-btn ${
                    submitterRole === 'daycare_operator' ? 'selected' : ''
                  }`}
                  onClick={() => setSubmitterRole('daycare_operator')}
                >
                  מנהל/ת או בעל/ת המסגרת
                </button>
                <button
                  type="button"
                  className={`pill-choice-btn ${
                    submitterRole === 'researcher_or_public' ? 'selected' : ''
                  }`}
                  onClick={() => setSubmitterRole('researcher_or_public')}
                >
                  חוקר/ת או ציבור רחב
                </button>
              </div>
            </div>

            <div className="wizard-footer-nav">
              <button
                type="button"
                className="wizard-secondary-btn"
                onClick={onClose}
              >
                ביטול
              </button>
              <button
                type="button"
                className="wizard-primary-btn"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'שולח פנייה...' : 'שליחת דיווח לבקרה'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
