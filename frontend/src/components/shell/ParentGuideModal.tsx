import React from 'react';
import { useModalDismiss } from './useModalDismiss';

interface ParentGuideModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * מדריך קצר וברור להורים על רישוי, פיקוח וסבסוד בגיל הרך (0–3 מול 3–6)
 */
export const ParentGuideModal: React.FC<ParentGuideModalProps> = ({
  open,
  onClose,
}) => {
  useModalDismiss(open, onClose);
  if (!open) return null;

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wizard-modal-card">
        <div className="modal-top-bar">
          <h2 id="parent-guide-title" className="wizard-title">
            📘 הגיל הרך — מדריך רישוי, פיקוח ומחירים להורים
          </h2>
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת המדריך"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="guide-sections-list">
          <section className="guide-card">
            <h3>1. גילאי לידה עד 3 (חוק הפיקוח על מעונות יום)</h3>
            <p>
              כל מסגרת שבה שוהים <strong>7 פעוטות ומעלה</strong> חייבת ברישיון
              הפעלה בתוקף ממשרד החינוך, הדרכה פדגוגית ועמידה בתקני בטיחות
              ובחוק המצלמות.
              <br />
              מסגרות של עד 6 פעוטות (משפחתון ביתי קטן) אינן חייבות ברישיון לפי
              החוק.
            </p>
          </section>

          <section className="guide-card">
            <h3>2. מעונות סמל מסובסדים מול מסגרות פרטיות</h3>
            <p>
              <strong>מעונות סמל (ויצו, נעמת, אמונה, חברה למתנ״סים ועוד):</strong>{' '}
              מפוקחים במחיר ע״י המדינה (תעריף מקסימום סביב ₪2,515 לחודש לפני
              דרגת סבסוד לפי הכנסה).
              <br />
              <strong>מסגרות פרטיות:</strong> פועלות בשוק חופשי ללא פיקוח מחירים,
              ולכן השוואת מחירון שקופה לפי שעות, ימי שישי והזנה חיונית להורים.
            </p>
          </section>

          <section className="guide-card">
            <h3>3. גילאי 3–6 (גני עירייה, צהרונים וגנים פרטיים)</h3>
            <p>
              בגני עירייה שעות הבוקר פטורות משכר לימוד (חוק לימוד חובה חינם),
              והתשלום המוצג במערכת מתייחס ל<strong>תוספת הצהרון בלבד</strong>.
              <br />
              בגנים פרטיים בגילאי 3–6 חובת הרישיון חלה מ-
              <strong>11 ילדים ומעלה</strong> (חוק פיקוח על בתי ספר).
            </p>
          </section>

          <section className="guide-card">
            <h3>4. איך לקרוא את דרגות האמינות במפה?</h3>
            <ul>
              <li>
                <strong>מסגרת רציפה + ✓:</strong> קונצנזוס של 3 דיווחי הורים מאומתים
                ומעלה (מוצג החציון לנטרול חריגים) או תעריף סמל מפוקח.
              </li>
              <li>
                <strong>מסגרת מקווקוות + ~:</strong> קיים פער בין 2 דיווחים (בכרטיס
                יוצג הטווח המלא) או דיווח בודד הממתין לאימות הורים נוסף.
              </li>
              <li>
                <strong>+ הוסף מחיר:</strong> מסגרת רשמית שטרם דווח עליה מחיר —
                ניתן להוסיף תוך 60 שניות ללא שמירת מייל או פרטים מזהים.
              </li>
            </ul>
          </section>
        </div>

        <div className="wizard-footer-nav" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="wizard-primary-btn" onClick={onClose}>
            הבנתי, חזרה למפה
          </button>
        </div>
      </div>
    </div>
  );
};
