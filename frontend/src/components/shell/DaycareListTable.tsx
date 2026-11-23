import React from 'react';

export interface DaycareTableItem {
  id: string;
  name: string;
  cityNameHe: string;
  address: string;
  ageGroupLabel: string;
  subsidized: boolean;
  licenseStatusCode: 'valid' | 'in_progress' | 'did_not_apply' | 'none';
  licenseStatusText: string;
  symbolText?: string;
  ownerKind?: 'municipal' | 'private' | 'national';
  activityHours?: string;
  phone?: string;
  priceFormattedHeader: string;
  priceTrustBadge: string;
  reportsCount: number;
  yoyTrendText?: string;
  benchmarkNeighborhoodText?: string;
  regulatoryContextHe: string;
}

interface DaycareListTableProps {
  items: DaycareTableItem[];
  selectedId: string | null;
  cityMedianPriceNis: number;
  onSelectId: (id: string | null) => void;
  onReportForDaycare: (daycare: DaycareTableItem) => void;
  onFlagErrorForDaycare: (daycare: DaycareTableItem) => void;
  onExportCsv: () => void;
}

/**
 * טבלת המסגרות הנגישה (ת"י 5568 AA) וכרטיס הפרטים הנפתח של "ילדי היקר"
 */
export const DaycareListTable: React.FC<DaycareListTableProps> = ({
  items,
  selectedId,
  cityMedianPriceNis,
  onSelectId,
  onReportForDaycare,
  onFlagErrorForDaycare,
  onExportCsv,
}) => {
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

      <div className="app-table-scroll">
        <table className="app-table" aria-label="רשימת מעונות וגני ילדים">
          <thead>
            <tr>
              <th scope="col">
                <div className="total-tag">{items.length}</div>
              </th>
              <th scope="col">שם מזהה ויישוב</th>
              <th scope="col">גיל</th>
              <th scope="col">מחיר חודשי (תשפ״ז)</th>
              <th scope="col">סבסוד</th>
              <th scope="col">רישוי</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={`item-row ${isSelected ? 'active' : ''}`}
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
                    <td>{item.ageGroupLabel}</td>
                    <td>
                      <strong>{item.priceFormattedHeader}</strong>
                      <div style={{ fontSize: '11px', color: '#204E37' }}>
                        {item.priceTrustBadge}
                      </div>
                    </td>
                    <td>{item.subsidized ? 'כן (סמל)' : 'לא'}</td>
                    <td>
                      <span
                        className={`licensing-icon ${item.licenseStatusCode}`}
                        title={item.licenseStatusText}
                        aria-label={item.licenseStatusText}
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
                            <span>{item.regulatoryContextHe}</span>
                          </div>

                          {item.symbolText && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-deets.svg)',
                                }}
                              />
                              <strong>סמל מעון / מוסד:&nbsp;</strong>
                              <span>{item.symbolText}</span>
                            </div>
                          )}

                          {item.activityHours && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-clock.svg)',
                                }}
                              />
                              <strong>שעות פעילות מדווחות:&nbsp;</strong>
                              <span>{item.activityHours}</span>
                            </div>
                          )}

                          {item.benchmarkNeighborhoodText && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-info.svg)',
                                }}
                              />
                              <strong>השוואה לסביבה (D-30):&nbsp;</strong>
                              <span>{item.benchmarkNeighborhoodText}</span>
                            </div>
                          )}

                          {item.yoyTrendText && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-info.svg)',
                                }}
                              />
                              <strong>היסטוריית מחירים (D-30):&nbsp;</strong>
                              <span>{item.yoyTrendText}</span>
                            </div>
                          )}

                          {item.phone && (
                            <div className="detail-row">
                              <i
                                className="field-icon"
                                style={{
                                  backgroundImage: 'url(/icons/icon-phone.svg)',
                                }}
                              />
                              <strong>טלפון המוסד:&nbsp;</strong>
                              <a href={`tel:${item.phone}`}>{item.phone}</a>
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
                            onClick={() => onReportForDaycare(item)}
                          >
                            + דווחו או עדכנו מחיר לגן זה
                          </button>
                          <button
                            type="button"
                            className="bookend-btn"
                            onClick={() => onFlagErrorForDaycare(item)}
                          >
                            🚩 מצאת טעות בנתונים?
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
