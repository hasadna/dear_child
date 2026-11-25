import React, { useRef, useState } from 'react';
import { useModalDismiss } from './useModalDismiss';

interface ApiAndMcpModalProps {
  open: boolean;
  onClose: () => void;
}

interface DocParamRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface RestEndpointDoc {
  id: string;
  categoryHe: string;
  method: 'GET';
  path: string;
  titleHe: string;
  descriptionHe: string;
  examplePath: string;
  params: DocParamRow[];
}

interface McpToolDoc {
  name: string;
  categoryHe: string;
  titleHe: string;
  descriptionHe: string;
  exampleArgs: Record<string, unknown>;
  params: DocParamRow[];
}

const REST_ENDPOINTS: RestEndpointDoc[] = [
  {
    id: 'list',
    categoryHe: 'מסגרות ומפה',
    method: 'GET',
    path: '/api/v1/daycares',
    titleHe: 'חיפוש וסינון מסגרות',
    descriptionHe:
      'מחזיר רשימת מעונות וגני ילדים ממוינת ומפולטרת (format=list) או אינדקס סיכות דחוס למפה (format=map_pins).',
    examplePath:
      '/api/v1/daycares?city_code=5000&has_price_only=true&format=list',
    params: [
      { name: 'q', type: 'string', required: false, description: 'חיפוש טקסט חופשי (שם גן, רחוב, סמל מוסד)' },
      { name: 'city_code', type: 'number', required: false, description: 'קוד יישוב למ״ס (למשל 5000 לתל אביב-יפו)' },
      { name: 'city_name_he', type: 'string', required: false, description: 'שם היישוב בעברית' },
      { name: 'lat', type: 'number', required: false, description: 'קו רוחב לחיפוש לפי רדיוס' },
      { name: 'lng', type: 'number', required: false, description: 'קו אורך לחיפוש לפי רדיוס' },
      { name: 'radius_m', type: 'number', required: false, description: 'רדיוס חיפוש במטרים סביב lat/lng' },
      { name: 'bbox', type: 'string', required: false, description: 'תיחום מפה: west,south,east,north' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים (2025 / 2026 / 2027)' },
      { name: 'age_group', type: 'string', required: false, description: '0_1 | 1_2 | 2_3 | 0_3 | 3_6' },
      { name: 'framework_track', type: 'string', required: false, description: 'private_full_day | private_half_day | symbol_regulated | municipal_tzaharon | rehab_or_welfare' },
      { name: 'is_full_day', type: 'boolean', required: false, description: 'יום מלא (true / false)' },
      { name: 'min_price', type: 'number', required: false, description: 'מחיר חודשי מינימלי בש״ח' },
      { name: 'max_price', type: 'number', required: false, description: 'מחיר חודשי מקסימלי בש״ח' },
      { name: 'has_price_only', type: 'boolean', required: false, description: 'הצגת מסגרות עם דיווח מחיר בלבד' },
      { name: 'license_status', type: 'string', required: false, description: 'licensed | in_process | symbol_recognized | municipal_verified | did_not_apply' },
      { name: 'is_subsidized_symbol', type: 'boolean', required: false, description: 'מעון סמל מסובסד (true / false)' },
      { name: 'includes_friday', type: 'boolean', required: false, description: 'פעיל בימי שישי (true / false)' },
      { name: 'shelter_status', type: 'string', required: false, description: 'yes | no | unknown' },
      { name: 'sort_by', type: 'string', required: false, description: 'distance | price_asc | price_desc | reports_desc | name' },
      { name: 'page', type: 'number', required: false, description: 'מספר עמוד (ברירת מחדל: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'גודל עמוד (ברירת מחדל: 50)' },
      { name: 'format', type: 'string', required: false, description: 'list (ברירת מחדל) או map_pins' },
    ],
  },
  {
    id: 'detail',
    categoryHe: 'מסגרות ומפה',
    method: 'GET',
    path: '/api/v1/daycares/:daycare_id',
    titleHe: 'פרופיל גן מלא (5 בלוקים)',
    descriptionHe:
      'מחזיר מידע רגולטורי רשמי, מטריצת מחירים לפי שכבת גיל, השוואות לשכונה ולעיר, היסטוריית שנים (YoY) ופירוט דיווחים.',
    examplePath: '/api/v1/daycares/410923?school_year=2027',
    params: [
      { name: 'daycare_id', type: 'string (path)', required: true, description: 'מזהה UUID של המסגרת או סמל משרד החינוך' },
      { name: 'school_year', type: 'number (query)', required: false, description: 'שנת לימודים מבוקשת (ברירת מחדל: 2027)' },
    ],
  },
  {
    id: 'stats',
    categoryHe: 'סטטיסטיקה והשוואות',
    method: 'GET',
    path: '/api/v1/stats/area',
    titleHe: 'סטטיסטיקת מחירים מרחבית',
    descriptionHe:
      'מחזיר חציון מחירים, רבעונים (P25/P75), ספירת מסגרות ופער מול תעריף מעון סמל מפוקח בעיר או בשכונה.',
    examplePath: '/api/v1/stats/area?city_code=5000&school_year=2027',
    params: [
      { name: 'city_code', type: 'number', required: false, description: 'קוד יישוב למ״ס' },
      { name: 'city_name_he', type: 'string', required: false, description: 'שם היישוב בעברית' },
      { name: 'neighborhood_he', type: 'string', required: false, description: 'שם השכונה לסינון ממוקד' },
      { name: 'age_group', type: 'string', required: false, description: '0_1 | 1_2 | 2_3 | 0_3 | 3_6' },
      { name: 'framework_track', type: 'string', required: false, description: 'מסלול מסגרת' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים (ברירת מחדל: 2027)' },
    ],
  },
  {
    id: 'autocomplete',
    categoryHe: 'חיפוש וייצוא נתונים',
    method: 'GET',
    path: '/api/v1/autocomplete/locations',
    titleHe: 'השלמה אוטומטית למיקומים ומסגרות',
    descriptionHe:
      'מחזיר הצעות יישובים, רחובות ומסגרות מתאימות עם קואורדינטות (מינימום 2 תווים).',
    examplePath: '/api/v1/autocomplete/locations?q=תל%20אביב&limit=10',
    params: [
      { name: 'q', type: 'string', required: true, description: 'מחרוזת חיפוש (לפחות 2 תווים)' },
      { name: 'city_code', type: 'number', required: false, description: 'הגבלת הצעות ליישוב מסוים' },
      { name: 'limit', type: 'number', required: false, description: 'מספר תוצאות מרבי (ברירת מחדל: 10)' },
    ],
  },
  {
    id: 'export',
    categoryHe: 'חיפוש וייצוא נתונים',
    method: 'GET',
    path: '/api/v1/export',
    titleHe: 'ייצוא קובץ CSV / XLSX',
    descriptionHe:
      'מייצא את תוצאות החיפוש לקובץ טבלאי בעברית (UTF-8 BOM) כולל שורת ייחוס ODbL 1.0 וללא מספרי נייד (05x).',
    examplePath: '/api/v1/export?format=csv&city_code=5000',
    params: [
      { name: 'format', type: 'string', required: false, description: 'csv (ברירת מחדל) או xlsx' },
      { name: 'city_code', type: 'number', required: false, description: 'קוד יישוב למ״ס' },
      { name: 'city_name_he', type: 'string', required: false, description: 'שם היישוב בעברית' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים' },
      { name: 'age_group', type: 'string', required: false, description: '0_1 | 1_2 | 2_3 | 0_3 | 3_6' },
      { name: 'framework_track', type: 'string', required: false, description: 'מסלול מסגרת' },
      { name: 'has_price_only', type: 'boolean', required: false, description: 'מסגרות עם דיווח מחיר בלבד' },
      { name: 'is_subsidized_symbol', type: 'boolean', required: false, description: 'מעון סמל מסובסד בלבד' },
      { name: 'q', type: 'string', required: false, description: 'סינון טקסט חופשי' },
    ],
  },
];

const MCP_TOOLS: McpToolDoc[] = [
  {
    name: 'search_daycares',
    categoryHe: 'חיפוש ופרטי מסגרת',
    titleHe: 'חיפוש וסינון מסגרות',
    descriptionHe:
      'חיפוש מעונות וגני ילדים לפי עיר, קואורדינטות/רדיוס, גיל, מסלול, תקציב מקסימלי וסטטוס רישוי.',
    exampleArgs: {
      city_name_he: 'תל אביב - יפו',
      age_group: '1_2',
      max_price_nis: 5800,
      includes_friday: true,
    },
    params: [
      { name: 'city_name_he', type: 'string', required: false, description: 'שם היישוב בעברית' },
      { name: 'lat', type: 'number', required: false, description: 'קו רוחב' },
      { name: 'lng', type: 'number', required: false, description: 'קו אורך' },
      { name: 'radius_m', type: 'number', required: false, description: 'רדיוס במטרים' },
      { name: 'age_group', type: 'string', required: false, description: '0_1 | 1_2 | 2_3 | 0_3 | 3_6' },
      { name: 'framework_track', type: 'string', required: false, description: 'private_full_day | private_half_day | symbol_regulated | municipal_tzaharon | rehab_or_welfare' },
      { name: 'max_price_nis', type: 'number', required: false, description: 'תקרת מחיר חודשי בש״ח' },
      { name: 'is_subsidized_symbol', type: 'boolean', required: false, description: 'מעון סמל מסובסד בלבד' },
      { name: 'includes_friday', type: 'boolean', required: false, description: 'פעיל בימי שישי' },
      { name: 'has_shelter', type: 'boolean', required: false, description: 'קיים ממ״ד/מקלט תקני' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים (ברירת מחדל: 2027)' },
    ],
  },
  {
    name: 'get_daycare_details',
    categoryHe: 'חיפוש ופרטי מסגרת',
    titleHe: 'פרופיל גן מלא',
    descriptionHe:
      'שליפת פרופיל מלא של מעון או גן ספציפי כולל היסטוריית מחירים רב-שנתית, השוואה לשכונה ופירוט דיווחים.',
    exampleArgs: { moe_symbol: '410923', school_year: 2027 },
    params: [
      { name: 'daycare_id', type: 'string', required: false, description: 'מזהה UUID של המסגרת' },
      { name: 'moe_symbol', type: 'string', required: false, description: 'סמל מוסד / מעון במשרד החינוך' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים (ברירת מחדל: 2027)' },
    ],
  },
  {
    name: 'get_area_price_stats',
    categoryHe: 'רגולציה והשוואת יוקר',
    titleHe: 'סטטיסטיקת יוקר באזור',
    descriptionHe:
      'קבלת חציון מחירים, רבעונים (P25/P75) ויחס מסגרות מפוקחות מול פרטיות בעיר או בשכונה.',
    exampleArgs: { city_name_he: 'תל אביב - יפו', age_group: '1_2' },
    params: [
      { name: 'city_name_he', type: 'string', required: true, description: 'שם היישוב בעברית' },
      { name: 'neighborhood_he', type: 'string', required: false, description: 'שם השכונה' },
      { name: 'age_group', type: 'string', required: false, description: '0_1 | 1_2 | 2_3 | 0_3 | 3_6' },
      { name: 'framework_track', type: 'string', required: false, description: 'מסלול מסגרת' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים (ברירת מחדל: 2027)' },
    ],
  },
  {
    name: 'check_supervision_status',
    categoryHe: 'רגולציה והשוואת יוקר',
    titleHe: 'בדיקת רישוי ופיקוח רשמי',
    descriptionHe:
      'בדיקה רשמית מול מרשמי משרד החינוך, העבודה וה-GIS העירוני, כולל צווי הפסקה או עיצומים פעילים.',
    exampleArgs: { daycare_name_he: 'מעון יום כוכב הצפון', city_name_he: 'תל אביב - יפו' },
    params: [
      { name: 'daycare_name_he', type: 'string', required: true, description: 'שם המסגרת בעברית' },
      { name: 'city_name_he', type: 'string', required: true, description: 'שם היישוב בעברית' },
      { name: 'street_name_he', type: 'string', required: false, description: 'שם הרחוב לדיוק ההתאמה' },
    ],
  },
  {
    name: 'compare_regulated_vs_market_cost',
    categoryHe: 'רגולציה והשוואת יוקר',
    titleHe: 'השוואת עלות פרטית מול מפוקחת',
    descriptionHe:
      'חישוב הפער החודשי והשנתי למשפחה בין תעריף מעון סמל מפוקח לבין חציון השוק הפרטי באותה עיר וגיל.',
    exampleArgs: { city_name_he: 'תל אביב - יפו', age_group: '1_2', school_year: 2027 },
    params: [
      { name: 'city_name_he', type: 'string', required: true, description: 'שם היישוב בעברית' },
      { name: 'age_group', type: 'string', required: true, description: '0_1 | 1_2 | 2_3 | 3_6' },
      { name: 'school_year', type: 'number', required: false, description: 'שנת לימודים (ברירת מחדל: 2027)' },
    ],
  },
];

function groupByCategory<T extends { categoryHe: string }>(
  items: T[]
): { categoryHe: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const existing = groups.get(item.categoryHe);
    if (existing) existing.push(item);
    else groups.set(item.categoryHe, [item]);
  }
  return Array.from(groups.entries()).map(([categoryHe, list]) => ({
    categoryHe,
    items: list,
  }));
}

/**
 * מודאל תיעוד מפתחים עבור ה-Public REST API ושרת ה-MCP של "ילדי היקר"
 * בהשראת Financial Modeling Prep Docs: ניווט צדדי לפי קטגוריות + כרטיסי נקודות קצה עם טבלאות פרמטרים.
 */
export const ApiAndMcpModal: React.FC<ApiAndMcpModalProps> = ({
  open,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rest' | 'mcp'>('rest');
  const [activeAnchorId, setActiveAnchorId] = useState<string>('list');
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  useModalDismiss(open, onClose);

  if (!open) return null;

  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://yaldihayakar.hasadna.org.il';

  const mcpConfigExample = JSON.stringify(
    {
      mcpServers: {
        'yaldi-hayakar': {
          url: `${baseUrl}/mcp`,
        },
      },
    },
    null,
    2
  );

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const scrollToSection = (anchorId: string) => {
    setActiveAnchorId(anchorId);
    const container = contentScrollRef.current;
    if (!container) return;
    const targetEl = container.querySelector(
      `[data-doc-anchor="${anchorId}"]`
    ) as HTMLElement | null;
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const restCategories = groupByCategory(REST_ENDPOINTS);
  const mcpCategories = groupByCategory(MCP_TOOLS);

  return (
    <div
      className="app-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-mcp-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="profile-modal-card api-docs-modal-wide">
        <div className="modal-top-bar">
          <div>
            <h2 id="api-mcp-title" className="wizard-title">
              🔌 Public REST API ושרת MCP (מידע פתוח)
            </h2>
            <p className="wizard-subtitle" style={{ marginTop: '4px' }}>
              גישה חופשית לקריאה בלבד (ללא מפתח API) ברישיון{' '}
              <strong>ODbL 1.0</strong> וללא מידע אישי מזהה (Zero-PII).
            </p>
          </div>
          <button
            type="button"
            className="modal-close-x-top"
            aria-label="סגירת מדריך API ו-MCP"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* 2 לשוניות: Public REST API ושרת MCP */}
        <div className="api-docs-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rest'}
            className={`api-tab-btn ${activeTab === 'rest' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rest');
              setActiveAnchorId(REST_ENDPOINTS[0].id);
            }}
          >
            Public REST API
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mcp'}
            className={`api-tab-btn ${activeTab === 'mcp' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('mcp');
              setActiveAnchorId(MCP_TOOLS[0].name);
            }}
          >
            שרת MCP
          </button>
        </div>

        {/* פריסת תיעוד דו-טורית עם סרגל ניווט צדדי לפי קטגוריות (בהשראת FMP Docs) */}
        <div className="api-docs-layout">
          <aside className="api-docs-sidebar" aria-label="ניווט בין קטגוריות ונקודות קצה">
            {(activeTab === 'rest' ? restCategories : mcpCategories).map((group) => (
              <div key={group.categoryHe} className="api-sidebar-group">
                <div className="api-sidebar-cat">{group.categoryHe}</div>
                <div className="api-sidebar-links">
                  {group.items.map((item) => {
                    const anchor =
                      'id' in item ? item.id : (item as McpToolDoc).name;
                    const isActive = activeAnchorId === anchor;
                    return (
                      <button
                        key={anchor}
                        type="button"
                        className={`api-sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={() => scrollToSection(anchor)}
                      >
                        <span className="sidebar-link-title">{item.titleHe}</span>
                        <code className="sidebar-link-code">
                          {'path' in item ? item.path : (item as McpToolDoc).name}
                        </code>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          <div className="api-docs-main" ref={contentScrollRef}>
            {activeTab === 'rest' ? (
              <section className="api-docs-section">
                <h3 className="api-section-heading">
                  נקודות הקצה של ה-Public REST API
                </h3>

                {REST_ENDPOINTS.map((ep) => {
                  const curlCmd = `curl "${baseUrl}${ep.examplePath}"`;
                  return (
                    <article
                      key={ep.id}
                      data-doc-anchor={ep.id}
                      className={`api-endpoint-card ${
                        activeAnchorId === ep.id ? 'highlighted' : ''
                      }`}
                    >
                      <div className="api-endpoint-header">
                        <div className="api-endpoint-title-row">
                          <span className="http-method-badge">{ep.method}</span>
                          <code className="endpoint-path-code">{ep.path}</code>
                          <span className="endpoint-he-title">{ep.titleHe}</span>
                        </div>
                        <a
                          href={ep.examplePath}
                          target="_blank"
                          rel="noreferrer"
                          className="api-try-link"
                        >
                          ↗ בדיקה חיה
                        </a>
                      </div>

                      <p className="api-endpoint-desc">{ep.descriptionHe}</p>

                      <div className="reports-breakdown-table-wrap">
                        <table className="reports-breakdown-table api-params-table">
                          <thead>
                            <tr>
                              <th>פרמטר</th>
                              <th>סוג</th>
                              <th>סטטוס</th>
                              <th>תיאור וערכים לדוגמה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ep.params.map((p) => (
                              <tr key={p.name}>
                                <td dir="ltr" className="api-code-cell">
                                  <code>{p.name}</code>
                                </td>
                                <td dir="ltr" className="api-type-cell">
                                  <code>{p.type}</code>
                                </td>
                                <td>
                                  <span
                                    className={`param-req-badge ${
                                      p.required ? 'req' : 'opt'
                                    }`}
                                  >
                                    {p.required ? 'חובה' : 'רשות'}
                                  </span>
                                </td>
                                <td>{p.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="code-snippet-box" dir="ltr">
                        <div className="code-snippet-header">
                          <span>דוגמת קריאה (curl)</span>
                          <button
                            type="button"
                            className="code-copy-btn"
                            onClick={() => handleCopy(`curl-${ep.id}`, curlCmd)}
                          >
                            {copiedKey === `curl-${ep.id}` ? '✓ הועתק' : 'העתקה'}
                          </button>
                        </div>
                        <pre>
                          <code>{curlCmd}</code>
                        </pre>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <section className="api-docs-section">
                <h3 className="api-section-heading">
                  שרת MCP לסוכני AI{'\u200F'} (<bdi>yaldi-hayakar-mcp</bdi>)
                </h3>
                <p className="wizard-subtitle">
                  חיבור ישיר לסוכני AI (כגון Claude, Cursor ו-Antigravity) לכתובת{' '}
                  <code>{baseUrl}/mcp</code>:
                </p>

                <div className="code-snippet-box" dir="ltr">
                  <div className="code-snippet-header">
                    <span>הגדרת חיבור בלקוח MCP (JSON)</span>
                    <button
                      type="button"
                      className="code-copy-btn"
                      onClick={() => handleCopy('mcp-config', mcpConfigExample)}
                    >
                      {copiedKey === 'mcp-config' ? '✓ הועתק' : 'העתקה'}
                    </button>
                  </div>
                  <pre>
                    <code>{mcpConfigExample}</code>
                  </pre>
                </div>

                {MCP_TOOLS.map((tool) => {
                  const argsJson = JSON.stringify(tool.exampleArgs, null, 2);
                  return (
                    <article
                      key={tool.name}
                      data-doc-anchor={tool.name}
                      className={`api-endpoint-card ${
                        activeAnchorId === tool.name ? 'highlighted' : ''
                      }`}
                    >
                      <div className="api-endpoint-header">
                        <div className="api-endpoint-title-row">
                          <span className="mcp-tool-badge">TOOL</span>
                          <code className="endpoint-path-code">{tool.name}</code>
                          <span className="endpoint-he-title">{tool.titleHe}</span>
                        </div>
                      </div>

                      <p className="api-endpoint-desc">{tool.descriptionHe}</p>

                      <div className="reports-breakdown-table-wrap">
                        <table className="reports-breakdown-table api-params-table">
                          <thead>
                            <tr>
                              <th>פרמטר</th>
                              <th>סוג</th>
                              <th>סטטוס</th>
                              <th>תיאור וערכים לדוגמה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tool.params.map((p) => (
                              <tr key={p.name}>
                                <td dir="ltr" className="api-code-cell">
                                  <code>{p.name}</code>
                                </td>
                                <td dir="ltr" className="api-type-cell">
                                  <code>{p.type}</code>
                                </td>
                                <td>
                                  <span
                                    className={`param-req-badge ${
                                      p.required ? 'req' : 'opt'
                                    }`}
                                  >
                                    {p.required ? 'חובה' : 'רשות'}
                                  </span>
                                </td>
                                <td>{p.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="code-snippet-box" dir="ltr">
                        <div className="code-snippet-header">
                          <span>דוגמת ארגומנטים לכלי (JSON)</span>
                          <button
                            type="button"
                            className="code-copy-btn"
                            onClick={() => handleCopy(`mcp-${tool.name}`, argsJson)}
                          >
                            {copiedKey === `mcp-${tool.name}` ? '✓ הועתק' : 'העתקה'}
                          </button>
                        </div>
                        <pre>
                          <code>{argsJson}</code>
                        </pre>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </div>
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
