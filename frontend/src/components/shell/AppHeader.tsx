import React, { useState } from 'react';
import { useModalDismiss } from './useModalDismiss';

export type MapColorMode = 'relative_price' | 'supervision_status' | 'reports_count';

interface AppHeaderProps {
  onOpenReportModal: () => void;
  onOpenOnboardingModal: () => void;
  onOpenParentGuideModal: () => void;
  onOpenTermsModal: () => void;
  onOpenApiMcpModal: () => void;
}

/**
 * סרגל עליון ותפריט ניווט נשלף של "ילדי היקר"
 * - צד ימין: כפתור תפריט, לוגו ושם המיזם.
 * - מרכז: כפתור CTA מרכזי ובולט "+ הוספת מחיר גן".
 * - תפריט נשלף משודרג עם רקע Backdrop, סגירה ב-Esc/לחיצה בחוץ וחלוקה לוגית לקבוצות.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenReportModal,
  onOpenOnboardingModal,
  onOpenParentGuideModal,
  onOpenTermsModal,
  onOpenApiMcpModal,
}) => {
  const [menuActive, setMenuActive] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useModalDismiss(menuActive, () => setMenuActive(false));

  const handleShareApp = async () => {
    const shareUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ילדי היקר — שקיפות מחירים ופיקוח בגיל הרך',
          text: 'השוואת מחירי גנים ומעונות יום וסטטוס רישוי רשמי בישראל',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <header className="app-header" role="banner">
      <div className="header-container">
        {/* קצה ימני ב-RTL: כפתור תפריט + לוגו + כותרת "ילדי היקר" */}
        <div className="header-right-group">
          <button
            type="button"
            className="menu-button"
            aria-label="פתיחת תפריט ניווט ומידע"
            aria-expanded={menuActive}
            onClick={() => setMenuActive(true)}
          />

          <div
            className="brand-area"
            role="button"
            tabIndex={0}
            onClick={onOpenOnboardingModal}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenOnboardingModal();
              }
            }}
          >
            <div className="brand-logo" aria-hidden="true" />
            <div className="brand-titles">
              <span className="brand-title">ילדי היקר</span>
              <span className="brand-subtitle">
                הסדנא לידע ציבורי (ע״ר) · ועד ההורים הארצי
              </span>
            </div>
          </div>
        </div>

        {/* מרכז הסרגל: כפתור הוספת מחיר גן בולט וממורכז */}
        <div className="header-center-cta">
          <button
            type="button"
            className="cta-report-btn prominent"
            onClick={onOpenReportModal}
          >
            <span className="cta-plus-badge" aria-hidden="true">
              +
            </span>
            <span>הוספת מחיר גן</span>
            <span className="cta-time-hint">(60 שנ׳)</span>
          </button>
        </div>

        {/* עמודה שמאלית לאיזון מושלם של המרכוז בדסקטופ */}
        <div className="header-left-spacer" aria-hidden="true" />
      </div>

      {/* רקע כהה מאחורי התפריט לסגירה בלחיצה מחוץ לתפריט */}
      {menuActive && (
        <div
          className="menu-drawer-backdrop"
          aria-hidden="true"
          onClick={() => setMenuActive(false)}
        />
      )}

      {/* תפריט הניווט הנשלף */}
      <nav
        className={`app-menu-drawer ${menuActive ? 'active' : ''}`}
        aria-label="תפריט ראשי"
        aria-hidden={!menuActive}
      >
        <div className="drawer-header-bar">
          <div className="drawer-brand-row">
            <img src="/icons/logo-header.svg" alt="" width={32} height={34} />
            <div>
              <div className="drawer-brand-title">ילדי היקר</div>
              <div className="drawer-brand-sub">
                שקיפות מחירים ופיקוח בגיל הרך (לידה עד 6)
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת תפריט"
            onClick={() => setMenuActive(false)}
          >
            ✕
          </button>
        </div>

        <div className="drawer-section-label">מידע להורים</div>
        <div className="drawer-links-group">
          <button
            type="button"
            className="menu-link info-item"
            onClick={() => {
              setMenuActive(false);
              onOpenOnboardingModal();
            }}
          >
            <span>
              <strong>אודות &quot;ילדי היקר&quot;</strong>
            </span>
          </button>

          <button
            type="button"
            className="menu-link guide-item"
            onClick={() => {
              setMenuActive(false);
              onOpenParentGuideModal();
            }}
          >
            <span>
              <strong>הגיל הרך — מדריך רישוי, פיקוח ומחירים</strong>
            </span>
          </button>

          <button
            type="button"
            className="menu-link terms-item"
            onClick={() => {
              setMenuActive(false);
              onOpenTermsModal();
            }}
          >
            <span>
              <strong>תנאי שימוש ופרטיות</strong>
            </span>
          </button>
        </div>

        <div className="drawer-section-label">קהילה ושקיפות</div>
        <div className="drawer-links-group">
          <button
            type="button"
            className="menu-link api-mcp-item"
            onClick={() => {
              setMenuActive(false);
              onOpenApiMcpModal();
            }}
          >
            <span>
              <strong>API ו-MCP</strong>
            </span>
          </button>

          <a
            className="menu-link external"
            href="https://www.hasadna.org.il/"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuActive(false)}
          >
            <span>
              <strong>הסדנא לידע ציבורי (ע״ר)</strong>
            </span>
          </a>

          <a
            className="menu-link external"
            href="https://github.com/hasadna/dear_child"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuActive(false)}
          >
            <span>
              <strong>מאגר הפרויקט בקוד פתוח</strong>
            </span>
          </a>

          <button
            type="button"
            className="menu-link share-pill-btn"
            onClick={handleShareApp}
          >
            <span className="menu-item-icon">🔗</span>
            <span>
              <strong>
                {shareCopied
                  ? '✓ הקישור הועתק ללוח — אפשר להדביק בקבוצת הגן!'
                  : 'שיתוף "ילדי היקר" עם הורים אחרים'}
              </strong>
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
};
