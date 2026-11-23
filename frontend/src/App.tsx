import React, { useState } from 'react';
import {
  MapColorMode,
  AppHeader,
} from './components/shell/AppHeader';
import {
  ActiveFilters,
  FiltersBar,
} from './components/shell/FiltersBar';
import {
  DaycareTableItem,
  DaycareListTable,
} from './components/shell/DaycareListTable';
import { OnboardingModal } from './components/shell/OnboardingModal';

const INITIAL_DEMO_ITEMS: DaycareTableItem[] = [
  {
    id: 'a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99',
    name: 'מעון יום כוכב הצפון',
    cityNameHe: 'תל אביב - יפו',
    address: 'ארלוזורוב 42, תל אביב - יפו',
    ageGroupLabel: '0–3',
    subsidized: false,
    licenseStatusCode: 'valid',
    licenseStatusText: 'רישיון הפעלה בתוקף (משרד החינוך)',
    symbolText: '410923 (משרד החינוך)',
    ownerKind: 'private',
    activityHours: 'א׳–ה׳ 07:30–16:30 · שישי 07:30–12:30 · כולל הזנה',
    phone: '03-5551234',
    priceFormattedHeader: '₪5,600 לחודש (חציון)',
    priceTrustBadge: '✓ מידע הורים מאומת (4 דיווחים)',
    reportsCount: 4,
    yoyTrendText:
      'תשפ״ה: ₪4,950 → תשפ״ו: ₪5,250 (+6.1%) → תשפ״ז: ₪5,600 (+6.7%)',
    benchmarkNeighborhoodText:
      'זול ב-₪150 (-2.6%) מחציון רדיוס 1 ק״מ (₪5,750 · N=11 גנים)',
    regulatoryContextHe:
      'מעון זה מופיע במרשם מעונות היום המפוקחים של משרד החינוך לשנת תשפ״ז בסטטוס "רישיון בתוקף" (סמל מסגרת: 410923).',
  },
  {
    id: 'b7e4c1a0-3d8a-4f11-8b22-6c1d0e9f8a77',
    name: 'מעון ויצו רחובות המדע',
    cityNameHe: 'רחובות',
    address: 'דרך יבנה 18, רחובות',
    ageGroupLabel: '0–3',
    subsidized: true,
    licenseStatusCode: 'valid',
    licenseStatusText: 'מעון סמל מוכר לסבסוד (משרד העבודה)',
    symbolText: '12045 (משרד העבודה)',
    ownerKind: 'national',
    activityHours: 'א׳–ה׳ 07:00–16:00 · שישי 07:00–12:00 · כולל הזנה',
    phone: '08-9456789',
    priceFormattedHeader: '₪2,515 לחודש (מפוקח)',
    priceTrustBadge: '🛡️ תעריף סמל מפוקח + 3 דיווחי הורים',
    reportsCount: 3,
    yoyTrendText: 'תעריף מקסימום מפוקח משרד העבודה לשנת תשפ״ז',
    benchmarkNeighborhoodText:
      'חיסכון שנתי של כ-₪26,200 לעומת חציון השוק הפרטי ברחובות (₪4,700)',
    regulatoryContextHe:
      'מעון סמל מוכר לסבסוד ושכר לימוד מפוקח (משרד העבודה והחינוך).',
  },
];

export const App: React.FC = () => {
  const [colorMode, setColorMode] = useState<MapColorMode>('relative_price');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    INITIAL_DEMO_ITEMS[0].id
  );
  const [filters, setFilters] = useState<ActiveFilters>({
    searchTerm: '',
    ageGroups: [],
    licensing: [],
    subsidy: [],
    features: [],
  });

  const filteredItems = INITIAL_DEMO_ITEMS.filter((item) => {
    if (
      filters.searchTerm &&
      !item.name.includes(filters.searchTerm) &&
      !item.address.includes(filters.searchTerm)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="app-root">
      <AppHeader
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        onOpenReportModal={() => setOnboardingOpen(true)}
        onOpenOnboardingModal={() => setOnboardingOpen(true)}
      />

      <main className="main-workspace">
        <FiltersBar filters={filters} onFiltersChange={setFilters} />

        <div className="split-view-grid">
          {/* חצי ימני ב-RTL: הטבלה הנגישה וכרטיס הגן הנפתח */}
          <DaycareListTable
            items={filteredItems}
            selectedId={selectedId}
            cityMedianPriceNis={5400}
            onSelectId={setSelectedId}
            onReportForDaycare={() => setOnboardingOpen(true)}
            onFlagErrorForDaycare={() => setOnboardingOpen(true)}
            onExportCsv={() => window.open('/api/v1/export?format=csv', '_blank')}
          />

          {/* חצי שמאלי ב-RTL: אזור המפה האינטראקטיבית (Supercluster & Price Pills — יורחב בחלק 4.5) */}
          <section
            aria-label="מפת מסגרות ומחירים"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#EAF5E9',
              color: '#053856',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <img
              src="/icons/logo-header.svg"
              alt=""
              width={56}
              height={58}
              style={{ marginBottom: '12px' }}
            />
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
              שכבת המפה הקרטוגרפית (Supercluster + Price Pills)
            </h2>
            <p style={{ fontSize: '14px', maxWidth: '420px', marginTop: '6px' }}>
              מצב צביעה פעיל:{' '}
              <strong>
                {colorMode === 'relative_price'
                  ? 'רמת מחיר יחסית וסבסוד'
                  : colorMode === 'supervision_status'
                    ? 'סטטוס רישוי ופיקוח'
                    : 'מספר דיווחי הורים'}
              </strong>
            </p>
          </section>
        </div>
      </main>

      <OnboardingModal
        open={onboardingOpen}
        onCloseAndSearch={() => setOnboardingOpen(false)}
        onOpenReportFlow={() => setOnboardingOpen(false)}
      />
    </div>
  );
};

export default App;
