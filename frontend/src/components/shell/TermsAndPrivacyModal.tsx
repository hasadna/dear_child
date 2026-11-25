import React from 'react';
import { useModalDismiss } from './useModalDismiss';

interface TermsAndPrivacyModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * מודאל תנאי שימוש ומדיניות פרטיות — טיוטה מסודרת לעיון ואישור הייעוץ המשפטי של הסדנא
 * משקף את החלטות D-24, D-25, D-28, D-29, D-34, D-37 ו-D-38 (כולל X בשמאל למעלה, Esc ולחיצה בחוץ).
 */
export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
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
      aria-labelledby="terms-privacy-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wizard-modal-card">
        <div className="modal-top-bar">
          <h2 id="terms-privacy-title" className="wizard-title">
            ⚖️ תנאי שימוש ומדיניות פרטיות
          </h2>
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת תנאי שימוש ופרטיות"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="draft-legal-banner">
          <strong>שימו לב — נוסח טיוטה:</strong> מסמך זה מציג את עקרונות תנאי
          השימוש ומדיניות הפרטיות של המיזם ויעודכן בהמשך לנוסח המשפטי המחייב.
        </div>

        <div className="guide-sections-list">
          <section className="guide-card">
            <h3>1. מהות השירות והיעדר חסות ממשלתית (כתב ויתור)</h3>
            <p>
              &quot;ילדי היקר&quot; הוא מיזם אזרחי חינמי בקוד פתוח של{' '}
              <strong>הסדנא לידע ציבורי (ע״ר)</strong> בשיתוף{' '}
              <strong>ועד ההורים הארצי</strong>, ואינו פועל מטעם משרד ממשלתי או
              רשות מקומית.
              <br />
              נתוני הרישוי והפיקוח נשאבים מעת לעת ממאגרים ממשלתיים ועירוניים
              פתוחים, ונתוני המחירים מבוססים על דיווחי הורים. המידע מוצג כשירות
              שקיפות והשוואה בלבד ואינו תחליף לבדיקה ישירה מול המסגרת של רישיון
              הפעלה תקף, מיגון (ממ״ד/מקלט), תעריף עדכני ותנאי התקשרות.
            </p>
          </section>

          <section className="guide-card">
            <h3>2. כללי דיווח מחירים ע״י הורים (מחירון כללי בלבד)</h3>
            <p>
              המערכת אוספת נתונים עובדתיים ומובנים בלבד (מחיר, שכבת גיל, שעות
              פעילות, ימי שישי, הזנה ומאפייני בטיחות) ואינה מאפשרת פרסום ביקורות
              או טקסט חופשי.
              <br />
              בעת שליחת דיווח, ההורה מצהיר כי הנתון נמסר בתום לב וכי המחיר
              המדווח הוא <strong>מחיר המחירון החודשי הרגיל והכללי</strong> של
              המסגרת (ולא תעריף אישי מוזל, מלגה או הסדר הכפוף לתניית סודיות).
            </p>
          </section>

          <section className="guide-card">
            <h3>3. פרטיות ההורים ואי-קישוריות (Zero-PII · תיקון 13)</h3>
            <ul>
              <li>
                <strong>אפס שמירת מייל או פרטים מזהים:</strong> אימות ההורה
                למניעת ספאם מתבצע מול <code>Sign in with Google</code> בהרשאה
                מינימלית (<code>Scope: openid</code> בלבד) — המערכת אינה מבקשת
                ואינה שומרת את כתובת המייל או שמכם.
              </li>
              <li>
                <strong>אי-קישוריות מלאה ומחיקה שנתית:</strong> מהמזהה הטכני
                נגזר בזיכרון אסימון חד-כיווני תלוי-גן (<code>HMAC-SHA256</code>
                עם מפתח סודי נפרד ממסד הנתונים), כך שלא ניתן לקשר בין דיווחים
                של אותו הורה על גנים שונים. בתום כל שנת לימודים האסימון נמחק
                לצמיתות.
              </li>
              <li>
                <strong>ביטול דיווח עצמי (סעיף 14):</strong> הורה שדיווח בטעות
                יכול להסיר את הדיווח בכל עת דרך מנגנון הביטול העצמי באשף הדיווח.
              </li>
              <li>
                <strong>עוגיות (Cookies):</strong> המערכת משתמשת בעוגיית אבטחה
                הכרחית אחת בלבד (<code>Strictly Necessary HttpOnly Cookie</code>)
                למשך 15 דקות בעת שליחת דיווח, וללא עוגיות מעקב או פרסום צד ג׳.
              </li>
            </ul>
          </section>

          <section className="guide-card">
            <h3>4. רישיון נתונים פתוחים (ODbL 1.0) וייחוס מקורות</h3>
            <p>
              המאגר הפומבי של הפרויקט (באתר, ב-API, בשרת ה-MCP ובייצוא CSV) מופץ
              ברישיון <strong>ODbL 1.0</strong> בכפוף לייחוס המקורות: משרד
              החינוך, משרד העבודה, משרד הרווחה, הלמ״ס, <code>data.gov.il</code>,
              עיריית תל אביב-יפו, <code>© OpenStreetMap contributors</code>{' '}
              והסדנא לידע ציבורי.
              <br />
              חל איסור להשתמש במידע או בפרטי קשר של מסגרות לצורכי דיוור פרסומי
              או ספאם.
            </p>
          </section>

          <section className="guide-card">
            <h3>5. נגישות (ת״י 5568 AA) ודיווח על טעויות</h3>
            <p>
              המערכת כוללת תצוגת טבלה מלאה ונגישה לצד המפה, תמיכה בניווט מקלדת
              ובסגירת חלונות באמצעות מקש <code>Esc</code>.
              <br />
              מצאתם אי-דיוק בנתוני מסגרת? בכל כרטיס גן זמין כפתור{' '}
              <strong>&quot;מצאתם טעות?&quot;</strong> לדיווח מובנה לבקרת צוות
              הפרויקט.
            </p>
          </section>
        </div>

        <div className="wizard-footer-nav" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="wizard-primary-btn" onClick={onClose}>
            סגירה
          </button>
        </div>
      </div>
    </div>
  );
};
