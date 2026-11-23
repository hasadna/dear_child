import React, { useEffect, useMemo, useState } from 'react';
import { AppHeader, MapColorMode } from './components/shell/AppHeader';
import { ActiveFilters, FiltersBar } from './components/shell/FiltersBar';
import { DaycareListTable } from './components/shell/DaycareListTable';
import { OnboardingModal } from './components/shell/OnboardingModal';
import { DaycareMap } from './components/map/DaycareMap';
import { DaycareProfileModal } from './components/daycare/DaycareProfileModal';
import { ParentReportWizardModal } from './components/crowdsourcing/ParentReportWizardModal';
import { CorrectionRequestModal } from './components/crowdsourcing/CorrectionRequestModal';
import {
  AutocompleteLocationDto,
  DaycareDetailDto,
  fetchDaycaresList,
  filterDaycaresClientSide,
} from './services/api-client';

export const App: React.FC = () => {
  const [allDaycares, setAllDaycares] = useState<DaycareDetailDto[]>([]);
  const [colorMode, setColorMode] = useState<MapColorMode>('relative_price');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number;
    lon: number;
    zoom?: number;
  } | null>(null);

  // תצוגת מובייל: מעבר בין מפה לטבלה
  const [mobilePane, setMobilePane] = useState<'list' | 'map'>('list');

  // מודאלים
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
  const [profileDaycare, setProfileDaycare] =
    useState<DaycareDetailDto | null>(null);
  const [reportModalState, setReportModalState] = useState<{
    open: boolean;
    daycare: DaycareDetailDto | null;
    withdrawMode: boolean;
  }>({
    open: false,
    daycare: null,
    withdrawMode: false,
  });
  const [correctionDaycare, setCorrectionDaycare] =
    useState<DaycareDetailDto | null>(null);

  const [filters, setFilters] = useState<ActiveFilters>({
    searchTerm: '',
    ageGroups: [],
    licensing: [],
    subsidy: [],
    features: [],
  });

  useEffect(() => {
    fetchDaycaresList().then((items) => {
      setAllDaycares(items);
      if (items.length > 0) {
        setSelectedId(items[0].id);
      }
    });
  }, []);

  const filteredItems = useMemo(
    () => filterDaycaresClientSide(allDaycares, filters),
    [allDaycares, filters]
  );

  // חישוב חציון המחיר הפרטי באזור הפעיל
  const cityMedianPriceNis = useMemo(() => {
    const privatePrices = filteredItems
      .filter((it) => !it.is_subsidized && it.headline_price_nis !== null)
      .map((it) => it.headline_price_nis as number)
      .sort((a, b) => a - b);

    if (privatePrices.length === 0) return 5400;
    const mid = Math.floor(privatePrices.length / 2);
    return privatePrices.length % 2 === 1
      ? privatePrices[mid]
      : Math.round((privatePrices[mid - 1] + privatePrices[mid]) / 2);
  }, [filteredItems]);

  const handleSelectIdFromTable = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      const target = allDaycares.find((d) => d.id === id);
      if (target) {
        setFlyToTarget({ lat: target.lat, lon: target.lon, zoom: 15 });
      }
    }
  };

  const handleAutocompleteSelect = (suggestion: AutocompleteLocationDto) => {
    if (suggestion.lat !== null && suggestion.lon !== null) {
      setFlyToTarget({
        lat: suggestion.lat,
        lon: suggestion.lon,
        zoom: suggestion.kind === 'city' ? 13 : 16,
      });
    }
    if (suggestion.daycare_id) {
      setSelectedId(suggestion.daycare_id);
    }
  };

  const handleReportSubmitted = (updatedDaycare: DaycareDetailDto | null) => {
    if (updatedDaycare) {
      setAllDaycares((prev) =>
        prev.map((d) => (d.id === updatedDaycare.id ? updatedDaycare : d))
      );
      if (profileDaycare?.id === updatedDaycare.id) {
        setProfileDaycare(updatedDaycare);
      }
    } else {
      fetchDaycaresList().then(setAllDaycares);
    }
  };

  // ייצוא תוצאות החיפוש לקובץ CSV תקני בעברית עם UTF-8 BOM (תואם אקסל)
  const handleExportCsv = () => {
    const headers = [
      'שם המסגרת',
      'יישוב',
      'כתובת',
      'שכבת גיל',
      'סטטוס רישוי רשמי',
      'סמל משרד החינוך',
      'סמל משרד העבודה',
      'סבסוד',
      'מחיר חודשי מוצג',
      'דרגת אמינות ודיווחים',
      'שעות פעילות מדווחות',
    ];
    const rows = filteredItems.map((it) => [
      it.name,
      it.city_name_he,
      it.address,
      it.age_group_label_he,
      it.license_status_label_he,
      it.ministry_edu_symbol || '',
      it.labor_Cross_symbol || '',
      it.is_subsidized ? 'כן' : 'לא',
      it.price_formatted_he,
      it.trust_badge_he,
      it.activity_hours_summary_he || '',
    ]);

    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dear_child_daycares_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-root">
      <AppHeader
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        onOpenReportModal={() =>
          setReportModalState({
            open: true,
            daycare:
              allDaycares.find((d) => d.id === selectedId) ||
              allDaycares[0] ||
              null,
            withdrawMode: false,
          })
        }
        onOpenOnboardingModal={() => setOnboardingOpen(true)}
      />

      <main className="main-workspace">
        <FiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          onSelectAutocompleteSuggestion={handleAutocompleteSelect}
        />

        <div className={`split-view-grid mobile-mode-${mobilePane}`}>
          {/* חצי ימני ב-RTL: הטבלה הנגישה (ת"י 5568 AA) וכרטיס הגן הנפתח */}
          <DaycareListTable
            items={filteredItems}
            selectedId={selectedId}
            hoveredId={hoveredId}
            cityMedianPriceNis={cityMedianPriceNis}
            onSelectId={handleSelectIdFromTable}
            onHoverId={setHoveredId}
            onOpenFullProfile={(daycare) => setProfileDaycare(daycare)}
            onReportForDaycare={(daycare) =>
              setReportModalState({
                open: true,
                daycare,
                withdrawMode: false,
              })
            }
            onFlagErrorForDaycare={(daycare) => setCorrectionDaycare(daycare)}
            onExportCsv={handleExportCsv}
          />

          {/* חצי שמאלי ב-RTL: המפה האינטראקטיבית (Leaflet + Supercluster + Price Pills) */}
          <DaycareMap
            items={filteredItems}
            selectedId={selectedId}
            hoveredId={hoveredId}
            colorMode={colorMode}
            cityMedianPriceNis={cityMedianPriceNis}
            flyToTarget={flyToTarget}
            onSelectDaycare={(daycare) => setSelectedId(daycare.id)}
            onOpenFullProfile={(daycare) => setProfileDaycare(daycare)}
            onReportPriceForDaycare={(daycare) =>
              setReportModalState({
                open: true,
                daycare,
                withdrawMode: false,
              })
            }
          />
        </div>

        {/* כפתור צף למובייל למעבר בין מפה לרשימה */}
        <div
          className="mobile-floating-view-toggle"
          role="group"
          aria-label="מעבר בין תצוגת מפה לתצוגת טבלה"
        >
          <button
            type="button"
            className={`mobile-toggle-pill ${
              mobilePane === 'list' ? 'active' : ''
            }`}
            onClick={() => setMobilePane('list')}
          >
            📋 רשימה וטבלה ({filteredItems.length})
          </button>
          <button
            type="button"
            className={`mobile-toggle-pill ${
              mobilePane === 'map' ? 'active' : ''
            }`}
            onClick={() => setMobilePane('map')}
          >
            🗺️ מפת מחירים
          </button>
        </div>
      </main>

      {/* כרטיס גן מלא ב-5 בלוקים */}
      <DaycareProfileModal
        daycare={profileDaycare}
        onClose={() => setProfileDaycare(null)}
        onOpenReportModal={(daycare, initialWithdrawMode = false) => {
          setProfileDaycare(null);
          setReportModalState({
            open: true,
            daycare,
            withdrawMode: initialWithdrawMode,
          });
        }}
        onOpenCorrectionModal={(daycare) => {
          setProfileDaycare(null);
          setCorrectionDaycare(daycare);
        }}
      />

      {/* אשף דיווח מחיר ב-60 שניות + Blind Withdraw */}
      <ParentReportWizardModal
        open={reportModalState.open}
        initialDaycare={reportModalState.daycare}
        allDaycares={allDaycares}
        initialWithdrawMode={reportModalState.withdrawMode}
        cityMedianPriceNis={cityMedianPriceNis}
        onClose={() =>
          setReportModalState((prev) => ({ ...prev, open: false }))
        }
        onReportSubmitted={handleReportSubmitted}
      />

      {/* מודאל מובנה "מצאתם טעות?" */}
      <CorrectionRequestModal
        daycare={correctionDaycare}
        onClose={() => setCorrectionDaycare(null)}
      />

      {/* מודאל אודות והיכרות */}
      <OnboardingModal
        open={onboardingOpen}
        onCloseAndSearch={() => setOnboardingOpen(false)}
        onOpenReportFlow={() => {
          setOnboardingOpen(false);
          setReportModalState({
            open: true,
            daycare: allDaycares[0] || null,
            withdrawMode: false,
          });
        }}
      />
    </div>
  );
};

export default App;
