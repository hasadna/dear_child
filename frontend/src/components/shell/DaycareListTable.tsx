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
  onExportExcel: () => void;
}

const KNOWN_AGE_RANGES: Record<string, [number, number]> = {
  '0_1': [0, 1],
  '1_2': [1, 2],
  '2_3': [2, 3],
  '0_3': [0, 3],
  '0_3_mixed': [0, 3],
  '3_6': [3, 6],
};

/**
 * מאחד שכבות גיל לטווחים מספריים רציפים וקומפקטיים, למשל:
 * ['0_1', '1_2', '2_3'] -> '0–3', ['0_1', '1_2', '2_3', '3_6'] -> '0–6', ['1_2', '3_6'] -> '1–2, 3–6'
 */
export function formatCompactAgeRange(
  ageGroups: string[],
  fallbackLabel = ''
): string {
  const intervals: [number, number][] = [];

  for (const raw of ageGroups || []) {
    const code = raw.trim();
    if (KNOWN_AGE_RANGES[code]) {
      intervals.push([...KNOWN_AGE_RANGES[code]]);
      continue;
    }
    const match = code.match(/^(\d+)[_-](\d+)$/);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        intervals.push([start, end]);
      }
    }
  }

  if (intervals.length === 0) {
    return fallbackLabel || '—';
  }

  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: [number, number][] = [intervals[0]];
  for (let i = 1; i < intervals.length; i += 1) {
    const prev = merged[merged.length - 1];
    const curr = intervals[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  return merged.map(([from, to]) => `${from}–${to}`).join(', ');
}

function formatCompactPriceCell(item: DaycareDetailDto): {
  primary: string;
  secondary: string | null;
  isMuted: boolean;
} {
  if (item.display_mode === 'no_price' || item.headline_price_nis === null) {
    return { primary: 'טרם דווח', secondary: null, isMuted: true };
  }

  if (
    item.display_mode === 'range' &&
    item.min_price_nis !== null &&
    item.max_price_nis !== null &&
    item.min_price_nis !== item.max_price_nis
  ) {
    return {
      primary: `₪${item.min_price_nis.toLocaleString()}–${item.max_price_nis.toLocaleString()}`,
      secondary: `⚠️ ${item.active_reports_count} דיווחים`,
      isMuted: false,
    };
  }

  const primary = `₪${item.headline_price_nis.toLocaleString()}`;
  let secondary: string | null = null;
  if (item.active_reports_count >= 2) {
    secondary = `✓ ${item.active_reports_count} דיווחים`;
  } else if (item.active_reports_count === 1) {
    secondary = 'דיווח בודד';
  }

  return { primary, secondary, isMuted: false };
}

function buildGoogleMapsUrl(item: DaycareDetailDto): string {
  const query = item.address?.trim()
    ? `${item.name}, ${item.address}`
    : `${item.lat},${item.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * טבלת המסגרות הנגישה (ת"י 5568 AA) וכרטיס הפרטים המהיר של "ילדי היקר"
 * מסונכרנת דו-כיוונית עם סיכות המפה (Hover & Click) וכוללת פתיחת כרטיס גן מלא.
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
  onExportExcel,
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
          חציון מחיר באזור:{' '}
          <strong>₪{cityMedianPriceNis.toLocaleString()}</strong>
        </span>
        <button
          type="button"
          className="export-btn"
          onClick={onExportExcel}
          aria-label="ייצוא תוצאות החיפוש לקובץ אקסל"
        >
          📥 ייצוא לאקסל
        </button>
      </div>

      <div className="app-table-scroll" ref={tableContainerRef}>
        <table className="app-table" aria-label="רשימת מעונות וגני ילדים">
          <thead>
            <tr>
              <th scope="col">
                <div className="total-tag">{items.length}</div>
              </th>
              <th scope="col">שם וכתובת</th>
              <th scope="col">גיל</th>
              <th scope="col">
                מחיר ({formatHebrewYearShort(getActiveSchoolYear())})
              </th>
              <th scope="col">רישוי</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              const isHovered = hoveredId === item.id;
              const compactAge = formatCompactAgeRange(
                item.target_age_groups,
                item.age_group_label_he
              );
              const priceCell = formatCompactPriceCell(item);

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
                      <div className="table-name-row">
                        <strong>{item.name}</strong>
                        {item.is_subsidized && (
                          <span
                            className="subsidized-inline-tag"
                            title="מסגרת מסובסדת (סמל / רשות)"
                          >
                            מסובסד
                          </span>
                        )}
                      </div>
                      <div className="table-sub-address">{item.address}</div>
                    </td>
                    <td>
                      <span
                        className="compact-age-pill"
                        title={item.age_group_label_he}
                      >
                        {compactAge}
                      </span>
                    </td>
                    <td>
                      <div
                        className={`compact-price-main ${priceCell.isMuted ? 'muted' : ''}`}
                      >
                        {priceCell.primary}
                      </div>
                      {priceCell.secondary && (
                        <div className="compact-price-sub">
                          {priceCell.secondary}
                        </div>
                      )}
                    </td>
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
                      <td colSpan={5}>
                        <div className="inner-fields">
                          {item.activity_hours_summary_he && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-clock.svg)',
                                }}
                              />
                              <strong>שעות פעילות:&nbsp;</strong>
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
                              <strong>טלפון:&nbsp;</strong>
                              <a
                                href={`tel:${item.phone_official}`}
                                className="quick-action-link"
                                onClick={(e) => e.stopPropagation()}
                              >
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
                            <a
                              href={buildGoogleMapsUrl(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="quick-action-link"
                              title="פתיחה ב-Google Maps"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.address} ↗
                            </a>
                          </div>
                        </div>

                        <div className="bookend">
                          <button
                            type="button"
                            className="bookend-btn primary"
                            onClick={() => onOpenFullProfile(item)}
                          >
                            📊 כרטיס גן מלא
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
                            onClick={() => onFlagErrorForDaycare(item)}
                          >
                            🚩 מצאתם טעות?
                          </button>
                          <button
                            type="button"
                            className={`bookend-icon-btn ${sharedId === item.id ? 'copied' : ''}`}
                            aria-label="שיתוף"
                            title={
                              sharedId === item.id
                                ? 'הקישור הועתק!'
                                : 'שיתוף קישור לגן'
                            }
                            onClick={() => handleShareRow(item)}
                          >
                            {sharedId === item.id ? (
                              '✓'
                            ) : (
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                            )}
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
