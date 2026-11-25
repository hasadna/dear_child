import React, { useEffect, useState } from 'react';
import {
  CorrectionRequestPayload,
  DaycareDetailDto,
  submitCorrectionRequest,
} from '../../services/api-client';
import { useModalDismiss } from '../shell/useModalDismiss';

interface CorrectionRequestModalProps {
  daycare: DaycareDetailDto | null;
  onClose: () => void;
}

const ERROR_CATEGORIES: {
  code: CorrectionRequestPayload['error_category'];
  label: string;
}[] = [
  {
    code: 'wrong_price_outlier',
    label: 'המחיר המוצג שגוי או חריג',
  },
  {
    code: 'daycare_closed',
    label: 'המעון / הגן נסגר ואינו פעיל עוד',
  },
  {
    code: 'wrong_address_or_location',
    label: 'כתובת או מיקום הסיכה במפה אינם מדויקים',
  },
  {
    code: 'wrong_license_status',
    label: 'סטטוס הרישוי או הסבסוד השתנה',
  },
  {
    code: 'other_factual_error',
    label: 'טעות עובדתית אחרת בפרטי המסגרת',
  },
];

interface CorrectionFieldErrors {
  errorCategory?: string;
  submitterRole?: string;
}

/**
 * מודאל לדיווח על טעות בנתוני גן ("מצאתם טעות?")
 * כל שדות החובה מתחילים ריקים ונבדקים בלחיצה על שליחה; תיבת הפירוט מועברת לבדיקה פנימית בלבד ואינה מתפרסמת לציבור.
 */
export const CorrectionRequestModal: React.FC<CorrectionRequestModalProps> = ({
  daycare,
  onClose,
}) => {
  const [errorCategory, setErrorCategory] = useState<
    CorrectionRequestPayload['error_category'] | null
  >(null);
  const [submitterRole, setSubmitterRole] = useState<
    CorrectionRequestPayload['submitter_role'] | null
  >(null);
  const [detailsText, setDetailsText] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<CorrectionFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    setDoneMessage(null);
    setErrorCategory(null);
    setSubmitterRole(null);
    setDetailsText('');
    setFieldErrors({});
  }, [daycare?.id]);

  useModalDismiss(daycare !== null, onClose);

  if (!daycare) return null;

  const handleSubmit = async () => {
    const errors: CorrectionFieldErrors = {};
    if (!errorCategory) {
      errors.errorCategory = 'יש לבחור את מהות הטעות שמצאתם.';
    }
    if (!submitterRole) {
      errors.submitterRole = 'יש לבחור מי מדווח/ת על הטעות.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !errorCategory || !submitterRole) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitCorrectionRequest({
        daycare_id: daycare.id,
        error_category: errorCategory,
        submitter_role: submitterRole,
        details_text: detailsText.trim() || undefined,
        turnstile_token: 'turnstile_managed_background_token',
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wizard-modal-card">
        <div className="modal-sticky-close-row">
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת דיווח על טעות"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

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
              דיווח לבדיקה עבור <strong>{daycare.name}</strong> ({daycare.address}):
            </p>

            <div className="required-legend-note">
              <span className="required-star">*</span> שדה חובה
            </div>

            <div className="form-field-group">
              <label className="field-label">
                מהי מהות הטעות שמצאתם? <span className="required-star">*</span>
              </label>
              <div
                className={`daycare-picker-list ${fieldErrors.errorCategory ? 'field-invalid-group' : ''}`}
              >
                {ERROR_CATEGORIES.map((cat) => (
                  <div
                    key={cat.code}
                    role="radio"
                    aria-checked={errorCategory === cat.code}
                    tabIndex={0}
                    className={`daycare-picker-item ${
                      errorCategory === cat.code ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setErrorCategory(cat.code);
                      setFieldErrors((prev) => ({
                        ...prev,
                        errorCategory: undefined,
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setErrorCategory(cat.code);
                        setFieldErrors((prev) => ({
                          ...prev,
                          errorCategory: undefined,
                        }));
                      }
                    }}
                  >
                    <strong>{cat.label}</strong>
                  </div>
                ))}
              </div>
              {fieldErrors.errorCategory && (
                <div className="field-error-note">
                  {fieldErrors.errorCategory}
                </div>
              )}
            </div>

            <div className="form-field-group">
              <label className="field-label">
                מי מדווח/ת על הטעות? <span className="required-star">*</span>
              </label>
              <div
                className={`pill-radio-group ${fieldErrors.submitterRole ? 'field-invalid-group' : ''}`}
              >
                <button
                  type="button"
                  className={`pill-choice-btn ${
                    submitterRole === 'parent' ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSubmitterRole('parent');
                    setFieldErrors((prev) => ({
                      ...prev,
                      submitterRole: undefined,
                    }));
                  }}
                >
                  הורה במסגרת
                </button>
                <button
                  type="button"
                  className={`pill-choice-btn ${
                    submitterRole === 'daycare_operator' ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSubmitterRole('daycare_operator');
                    setFieldErrors((prev) => ({
                      ...prev,
                      submitterRole: undefined,
                    }));
                  }}
                >
                  מנהל/ת או בעל/ת המסגרת
                </button>
                <button
                  type="button"
                  className={`pill-choice-btn ${
                    submitterRole === 'researcher_or_public' ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSubmitterRole('researcher_or_public');
                    setFieldErrors((prev) => ({
                      ...prev,
                      submitterRole: undefined,
                    }));
                  }}
                >
                  חוקר/ת או ציבור רחב
                </button>
              </div>
              {fieldErrors.submitterRole && (
                <div className="field-error-note">
                  {fieldErrors.submitterRole}
                </div>
              )}
            </div>

            <div className="form-field-group">
              <label className="field-label" htmlFor="correction-details-input">
                פירוט הטעות
              </label>
              <textarea
                id="correction-details-input"
                className="wizard-textarea"
                rows={3}
                maxLength={500}
                placeholder="פרטו עובדתית מה שגוי ומה הנתון הנכון (ללא פרטים אישיים מזהים)..."
                value={detailsText}
                onChange={(e) => setDetailsText(e.target.value)}
              />
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
