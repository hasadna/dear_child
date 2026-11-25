import React, { useEffect, useRef, useState } from 'react';
import { DaycareDetailDto } from '../../services/api-client';
import {
  formatHebrewYearShort,
  getActiveSchoolYear,
} from '../../utils/school-years';

interface DaycareListTableProps {
  items: DaycareDetailDto[];
  selectedId: string | null;
  hoveredId: string | null;
  cityMedianPriceNis: number;
  onSelectId: (id: string | null) => void;
  onHoverId: (id: string | null) => void;
  onOpenFullProfile: (daycare: DaycareDetailDto) => void;
  onReportForDaycare: (daycare: DaycareDetailDto) => void;
  onFlagErrorForDaycare: (daycare: DaycareDetailDto) => void;
  onExportCsv: () => void;
}

/**
 * טבלת המסגרות הנגישה (ת"י 5568 AA) וכרטיס הפרטים המהיר של "ילדי היקר"
 * מסונכרנת דו-כיוונית עם סיכות המפה (Hover & Click) וכוללת פתיחת כרטיס גן מלא ב-5 בלוקים.
 */
export const DaycareListTable: React.FC<DaycareListTableProps> = ({
  items,
  selectedId,
  hoveredId,
  cityMedianPriceNis,
  onSelectId,
  onHoverId,
  onOpenFullProfile,
  onReportForDaycare,
  onFlagErrorForDaycare,
  onExportCsv,
}) => {
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);

  // גלילה אוטומטית חלקה אל השורה הנבחרת בטבלה (למשל בעת לחיצה על סיכה במפה)
  useEffect(() => {
    if (!selectedId || !tableContainerRef.current) return;
    const row = tableContainerRef.current.querySelector(
      `tr[data-daycare-id="${selectedId}"]`
    );
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

  const handleShareRow = async (item: DaycareDetailDto) => {
    const shareUrl = `${window.location.origin}/?daycare=${encodeURIComponent(item.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item.name} — ילדי היקר`,
          text: `${item.name} (${item.address}) — ${item.price_formatted_he}`,
          url: shareUrl,
        });
        return;
      } catch {
        // cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSharedId(item.id);
      setTimeout(() => setSharedId(null), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="app-item-list-container">
      <div className="area-summary-bar">
        <span>
          נמצאו <strong>{items.length}</strong> מסגרות חינוך רשמיות · חציון מחיר
          פרטי באזור: <strong>₪{cityMedianPriceNis.toLocaleString()}</strong>
        </span>
        <button
          type="button"
          className="export-btn"
          onClick={onExportCsv}
          aria-label="ייצוא תוצאות החיפוש לקובץ CSV או Excel"
        >
          📥 ייצוא לאקסל / CSV
        </button>
      </div>

      <div className="app-table-scroll" ref={tableContainerRef}>
        <table className="app-table" aria-label="רשימת מעונות וגני ילדים">
          <thead>
            <tr>
              <th scope="col">
                <div className="total-tag">{items.length}</div>
              </th>
              <th scope="col">שם מזהה ויישוב</th>
              <th scope="col">גיל</th>
              <th scope="col">
                מחיר חודשי ({formatHebrewYearShort(getActiveSchoolYear())})
              </th>
              <th scope="col">סבסוד</th>
              <th scope="col">רישוי</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              const isHovered = hoveredId === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr
                    data-daycare-id={item.id}
                    className={`item-row ${isSelected ? 'active' : ''} ${
                      isHovered ? 'hovered' : ''
                    }`}
                    onMouseEnter={() => onHoverId(item.id)}
                    onMouseLeave={() => onHoverId(null)}
                    onClick={() => onSelectId(isSelected ? null : item.id)}
                  >
                    <td>
                      <div className="toggle-circle" aria-hidden="true">
                        <svg
                          width="10"
                          height="7"
                          viewBox="0 0 10 7"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M1.17188 6.85156L5 3.02344L8.82812 6.85156L10 5.67969L5 0.679688L0 5.67969L1.17188 6.85156Z"
                            fill="#053856"
                          />
                        </svg>
                      </div>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      <div style={{ fontSize: '12px', color: '#7A7A7A' }}>
                        {item.address}
                      </div>
                    </td>
                    <td>{item.age_group_label_he}</td>
                    <td>
                      <strong>{item.price_formatted_he}</strong>
                      <div style={{ fontSize: '11px', color: '#204E37' }}>
                        {item.trust_badge_he}
                      </div>
                    </td>
                    <td>{item.is_subsidized ? 'כן (סמל/רשות)' : 'לא'}</td>
                    <td>
                      <span
                        className={`licensing-icon ${item.license_icon_code}`}
                        title={item.license_status_label_he}
                        aria-label={item.license_status_label_he}
                      />
                    </td>
                  </tr>

                  {isSelected && (
                    <tr className="app-details-box">
                      <td colSpan={6}>
                        <div className="inner-fields">
                          <div className="detail-row">
                            <i
                              className="field-icon"
                              style={{
                                backgroundImage: 'url(/icons/icon-deets.svg)',
                              }}
                            />
                            <strong>סטטוס רישוי רשמי:&nbsp;</strong>
                            <span>{item.regulatory_context_he}</span>
                          </div>

                          {(item.ministry_edu_symbol ||
                            item.labor_Cross_symbol) && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-deets.svg)',
                                }}
                              />
                              <strong>סמל מעון / מוסד:&nbsp;</strong>
                              <span>
                                {item.ministry_edu_symbol
                                  ? `${item.ministry_edu_symbol} (משרד החינוך)`
                                  : ''}
                                {item.ministry_edu_symbol &&
                                item.labor_Cross_symbol
                                  ? ' · '
                                  : ''}
                                {item.labor_Cross_symbol
                                  ? `${item.labor_Cross_symbol} (משרד העבודה)`
                                  : ''}
                              </span>
                            </div>
                          )}

                          {item.activity_hours_summary_he && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-clock.svg)',
                                }}
                              />
                              <strong>שעות פעילות מדווחות:&nbsp;</strong>
                              <span>{item.activity_hours_summary_he}</span>
                            </div>
                          )}

                          {item.benchmark_neighborhood_summary_he && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-info.svg)',
                                }}
                              />
                              <strong>השוואה לסביבה:&nbsp;</strong>
                              <span>
                                {item.benchmark_neighborhood_summary_he}
                              </span>
                            </div>
                          )}

                          {item.yoy_trend_summary_he && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-info.svg)',
                                }}
                              />
                              <strong>היסטוריית מחירים:&nbsp;</strong>
                              <span>{item.yoy_trend_summary_he}</span>
                            </div>
                          )}

                          {item.phone_official && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-phone.svg)',
                                }}
                              />
                              <strong>טלפון המוסד:&nbsp;</strong>
                              <a href={`tel:${item.phone_official}`}>
                                {item.phone_official}
                              </a>
                            </div>
                          )}

                          <div className="detail-row">
                            <i
                              className="field-icon"
                              style={{
                                backgroundImage: 'url(/icons/icon-address.svg)',
                              }}
                            />
                            <strong>כתובת:&nbsp;</strong>
                            <span>{item.address}</span>
                          </div>
                        </div>

                        <div className="bookend">
                          <button
                            type="button"
                            className="bookend-btn primary"
                            onClick={() => onOpenFullProfile(item)}
                          >
                            📊 כרטיס גן מלא, השוואה והיסטוריה
                          </button>
                          <button
                            type="button"
                            className="bookend-btn"
                            onClick={() => onReportForDaycare(item)}
                          >
                            + דווחו / עדכנו מחיר
                          </button>
                          <button
                            type="button"
                            className="bookend-btn"
                            onClick={() => handleShareRow(item)}
                          >
                            {sharedId === item.id ? '✓ הקישור הועתק' : '🔗 שיתוף'}
                          </button>
                          <button
                            type="button"
                            className="bookend-btn"
                            onClick={() => onFlagErrorForDaycare(item)}
                          >
                            🚩 מצאתם טעות?
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
