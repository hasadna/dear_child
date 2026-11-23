import React, { useState } from 'react';

export type MapColorMode = 'relative_price' | 'supervision_status' | 'reports_count';

interface AppHeaderProps {
  colorMode: MapColorMode;
  onColorModeChange: (mode: MapColorMode) => void;
  onOpenReportModal: () => void;
  onOpenOnboardingModal: () => void;
}

/**
 * סרגל עליון ותפריט ניווט נשלף של "ילדי היקר"
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  colorMode,
  onColorModeChange,
  onOpenReportModal,
  onOpenOnboardingModal,
}) => {
  const [menuActive, setMenuActive] = useState(false);

  return (
    <header className="app-header" role="banner">
      <div className="header-container">
        <button
          type="button"
          className="menu-button"
          aria-label="פתיחת תפריט ניווט ומידע"
          aria-expanded={menuActive}
          onClick={() => setMenuActive(true)}
        />

        <div className="brand-area">
          <div className="brand-logo" aria-hidden="true" />
          <div className="brand-titles">
            <span className="brand-title">ילדי היקר</span>
            <span className="brand-subtitle">
              הסדנא לידע ציבורי (ע״ר) · בשיתוף ועד ההורים הארצי
            </span>
          </div>
        </div>

        {/* מתג 3 מצבי צביעת המפה (D-32) */}
        <div className="sections" role="group" aria-label="מצב צביעת סיכות המפה">
          <button
            type="button"
            className={`section-pill ${colorMode === 'relative_price' ? 'selected' : ''}`}
            onClick={() => onColorModeChange('relative_price')}
          >
            צביעה: רמת מחיר וסבסוד
          </button>
          <button
            type="button"
            className={`section-pill ${colorMode === 'supervision_status' ? 'selected' : ''}`}
            onClick={() => onColorModeChange('supervision_status')}
          >
            צביעה: סטטוס רישוי ופיקוח
          </button>
          <button
            type="button"
            className={`section-pill ${colorMode === 'reports_count' ? 'selected' : ''}`}
            onClick={() => onColorModeChange('reports_count')}
          >
            צביעה: מספר דיווחי הורים
          </button>
        </div>

        <button
          type="button"
          className="cta-report-btn"
          onClick={onOpenReportModal}
        >
          <span>+ הוספת מחיר גן (60 שנ׳)</span>
        </button>
      </div>

      {/* תפריט הניווט הנשלף */}
      <nav
        className={`app-menu-drawer ${menuActive ? 'active' : ''}`}
        aria-label="תפריט ראשי"
      >
        <button
          type="button"
          className="close-btn"
          aria-label="סגירת תפריט"
          onClick={() => setMenuActive(false)}
        />

        <button
          type="button"
          className="menu-link"
          onClick={() => {
            setMenuActive(false);
            onOpenOnboardingModal();
          }}
        >
          אודות "ילדי היקר" ואיך המידע מאומת (3 שכבות האמינות)
        </button>

        <button
          type="button"
          className="menu-link"
          onClick={() => {
            setMenuActive(false);
            onOpenReportModal();
          }}
        >
          + דיווח אנונימי על מחיר הגן שלנו (Zero-PII)
        </button>

        <a
          className="external"
          href="https://www.hasadna.org.il/"
          target="_blank"
          rel="noreferrer"
        >
          הסדנא לידע ציבורי (ע״ר) — שקיפות שלטונית ומידע פתוח
        </a>

        <a
          className="external"
          href="https://github.com/hasadna/dear_child"
          target="_blank"
          rel="noreferrer"
        >
          קוד פתוח ומפרטי ה-API וה-MCP ב-GitHub (hasadna/dear_child)
        </a>
      </nav>
    </header>
  );
};
