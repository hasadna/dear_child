import React from 'react';

interface OnboardingModalProps {
  open: boolean;
  onCloseAndSearch: () => void;
  onOpenReportFlow: () => void;
}

/**
 * חלונית Onboarding ופתיחה של "ילדי היקר" (docs/06 סעיף 1.1)
 */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  onCloseAndSearch,
  onOpenReportFlow,
}) => {
  if (!open) return null;

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="app-dialog-container"
        style={{ maxWidth: '560px', padding: '24px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <img
            src="/icons/logo-header.svg"
            alt=""
            width={42}
            height={44}
          />
          <div>
            <h1
              id="onboarding-title"
              style={{ fontSize: '22px', color: '#053856', fontWeight: 700 }}
            >
              ברוכים הבאים ל"ילדי היקר"
            </h1>
            <p style={{ fontSize: '13px', color: '#4A4A4A' }}>
              מיזם שקיפות מחירים ופיקוח בגיל הרך (לידה עד 6) · הסדנא לידע ציבורי
              (ע״ר) וועד ההורים הארצי
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize: '15px',
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
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            onClick={onCloseAndSearch}
            style={{
              backgroundColor: '#053856',
              color: '#ffffff',
              border: 'none',
              borderRadius: '24px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔍 חיפוש והשוואת גנים ומחירים באזור שלי
          </button>

          <button
            type="button"
            onClick={() => {
              onCloseAndSearch();
              onOpenReportFlow();
            }}
            style={{
              backgroundColor: '#97D6BE',
              color: '#053856',
              border: '1px solid #053856',
              borderRadius: '24px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ➕ דיווח אנונימי על מחיר הגן שלנו (60 שניות · Zero-PII)
          </button>
        </div>

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
