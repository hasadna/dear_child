import React from 'react';
import { useModalDismiss } from './useModalDismiss';

interface OnboardingModalProps {
  open: boolean;
  onCloseAndSearch: () => void;
}

/**
 * חלונית Onboarding ואודות של "ילדי היקר" (כולל X בצד שמאל למעלה, Esc ולחיצה בחוץ)
 */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  onCloseAndSearch,
}) => {
  useModalDismiss(open, onCloseAndSearch);

  if (!open) return null;

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseAndSearch();
      }}
    >
      <div
        className="wizard-modal-card"
        style={{ padding: '22px 26px' }}
      >
        <div className="modal-top-bar" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/icons/logo-header.svg" alt="" width={40} height={42} />
            <div>
              <h1
                id="onboarding-title"
                style={{ fontSize: '21px', color: '#053856', fontWeight: 700 }}
              >
                ברוכים הבאים ל&quot;ילדי היקר&quot;
              </h1>
              <p style={{ fontSize: '12.5px', color: '#4A4A4A' }}>
                שקיפות מחירים ופיקוח בגיל הרך (לידה עד 6) · הסדנא לידע ציבורי
                (ע״ר) וועד ההורים הארצי
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת חלון אודות"
            onClick={onCloseAndSearch}
          >
            ✕
          </button>
        </div>

        <p
          style={{
            fontSize: '14.5px',
            lineHeight: 1.55,
            color: '#383838',
            marginBottom: '16px',
          }}
        >
          מערכת פתוחה המאחדת את מרשמי הפיקוח והרישוי הרשמיים של משרד החינוך,
          משרד העבודה והרשויות המקומיות יחד עם{' '}
          <strong>דיווחי מחירי מחירון אנונימיים ומאומתים של הורים</strong> — כדי
          שכל הורה יוכל להשוות תפוחים-לתפוחים (לפי גיל, שעות, ימי שישי והזנה).
        </p>

        <div
          style={{
            fontSize: '11.5px',
            color: '#7A7A7A',
            borderTop: '1px solid #E8E5E6',
            paddingTop: '10px',
            lineHeight: 1.45,
          }}
        >
          <strong>כתב ויתור וייחוס (ODbL 1.0):</strong> הנתונים הרשמיים מבוססים על
          מאגרי הסדנא לידע ציבורי (מפתח התקציב), משרד החינוך, העבודה, הרווחה,
          הלמ״ס, data.gov.il, עיריית ת״א ו-© OpenStreetMap contributors. המערכת
          אינה פועלת מטעם משרד ממשלתי והמידע אינו תחליף לבדיקה פיזית של רישיון תקף
          וממ״ד במסגרת.
        </div>
      </div>
    </div>
  );
};
