import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AutocompleteLocationDto,
  fetchAutocompleteLocations,
} from '../../services/api-client';
import { MapColorMode } from './AppHeader';
import { useModalDismiss } from './useModalDismiss';

export type FilterDialogKey =
  | 'age_group'
  | 'licensing'
  | 'subsidy'
  | 'features'
  | 'color_mode'
  | null;

export interface ActiveFilters {
  searchTerm: string;
  ageGroups: string[];
  licensing: string[];
  subsidy: string[];
  features: string[];
}

interface FiltersBarProps {
  filters: ActiveFilters;
  colorMode: MapColorMode;
  onColorModeChange: (mode: MapColorMode) => void;
  onFiltersChange: (next: ActiveFilters) => void;
  onSelectAutocompleteSuggestion?: (suggestion: AutocompleteLocationDto) => void;
}

const COLOR_MODE_OPTIONS: {
  value: MapColorMode;
  shortLabel: string;
  label: string;
}[] = [
  {
    value: 'relative_price',
    shortLabel: 'מחיר וסבסוד',
    label: 'רמת מחיר יחסית וסבסוד',
  },
  {
    value: 'supervision_status',
    shortLabel: 'רישוי ופיקוח',
    label: 'סטטוס רישוי ופיקוח רשמי',
  },
  {
    value: 'reports_count',
    shortLabel: 'מספר דיווחים',
    label: 'מספר דיווחי הורים מאומתים',
  },
];

const FILTER_DIALOG_OPTIONS: Record<
  Exclude<FilterDialogKey, null | 'color_mode'>,
  { title: string; options: { value: string; label: string }[] }
> = {
  age_group: {
    title: 'קבוצת גיל',
    options: [
      { value: '0_1', label: 'תינוקות (לידה עד שנה)' },
      { value: '1_2', label: 'פעוטות צעירים (שנה עד שנתיים)' },
      { value: '2_3', label: 'פעוטות בוגרים (שנתיים עד שלוש)' },
      { value: '0_3', label: 'רב-גילי (לידה עד 3)' },
      { value: '3_6', label: 'גני ילדים וצהרונים (גילאי 3–6)' },
    ],
  },
  licensing: {
    title: 'סטטוס רישוי ופיקוח רשמי',
    options: [
      { value: 'valid', label: 'רישיון הפעלה בתוקף (משרד החינוך)' },
      { value: 'in_progress', label: 'בתהליך רישוי (הסדר רציפות)' },
      { value: 'symbol_recognized', label: 'מעון סמל מוכר (משרד העבודה)' },
      { value: 'municipal_verified', label: 'מופיע במאגר מוניציפלי רשמי (GIS)' },
      { value: 'stop_order_active', label: 'צו הפסקה מנהלי פעיל' },
    ],
  },
  subsidy: {
    title: 'מסלול וסבסוד ממשלתי',
    options: [
      { value: 'yes', label: 'מעון סמל מסובסד / תעריף מפוקח' },
      { value: 'no', label: 'מסגרת פרטית (שוק חופשי)' },
      { value: 'tzaharon', label: 'צהרון בגן עירייה (גילאי 3–6)' },
    ],
  },
  features: {
    title: 'מאפיינים ודיווחי מחיר',
    options: [
      { value: 'has_price_only', label: 'הצג רק גנים עם דיווח מחיר' },
      { value: 'includes_friday', label: 'פעיל בימי שישי' },
      { value: 'has_shelter', label: 'קיים ממ״ד / מקלט תקני' },
    ],
  },
};

type FilterCategoryKey = Exclude<FilterDialogKey, null | 'color_mode'>;

interface DropdownAnchorPos {
  top: number;
  left: number;
  width: number;
}

/**
 * סרגל החיפוש, ההשלמה האוטומטית (Autocomplete), הפילטרים וכפתור צביעת המפה של "ילדי היקר".
 */
export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  colorMode,
  onColorModeChange,
  onFiltersChange,
  onSelectAutocompleteSuggestion,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [openDialog, setOpenDialog] = useState<FilterDialogKey>(null);
  const [anchorPos, setAnchorPos] = useState<DropdownAnchorPos | null>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteLocationDto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  useModalDismiss(openDialog !== null, () => setOpenDialog(null));

  // סגירת dropdown בלחיצה מחוץ לתפריט ולכפתור הפותח
  useEffect(() => {
    if (!openDialog) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (dropdownMenuRef.current?.contains(target)) return;
      if (activeTriggerRef.current?.contains(target)) return;
      setOpenDialog(null);
    };
    const handleViewportChange = () => {
      if (activeTriggerRef.current) {
        setAnchorPos(computeDropdownPos(activeTriggerRef.current));
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [openDialog]);

  useEffect(() => {
    let active = true;
    if (filters.searchTerm.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    fetchAutocompleteLocations(filters.searchTerm).then((list) => {
      if (active) setSuggestions(list);
    });
    return () => {
      active = false;
    };
  }, [filters.searchTerm]);

  const computeDropdownPos = (btn: HTMLButtonElement): DropdownAnchorPos => {
    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.max(270, Math.min(340, window.innerWidth - 24));
    // ב-RTL עדיף ליישר את הקצה הימני של התפריט לקצה הימני של הכפתור, עם הגנה מיציאה מהמסך
    let left = rect.right - menuWidth;
    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }
    const top = Math.min(rect.bottom + 6, Math.max(12, window.innerHeight - 280));
    return { top, left, width: menuWidth };
  };

  const handleTriggerClick = (
    key: Exclude<FilterDialogKey, null>,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (openDialog === key) {
      setOpenDialog(null);
      return;
    }
    activeTriggerRef.current = e.currentTarget;
    setAnchorPos(computeDropdownPos(e.currentTarget));
    setOpenDialog(key);
  };

  const activeCategoryCount =
    (filters.ageGroups.length > 0 ? 1 : 0) +
    (filters.licensing.length > 0 ? 1 : 0) +
    (filters.subsidy.length > 0 ? 1 : 0) +
    (filters.features.length > 0 ? 1 : 0);

  const activeColorModeMeta =
    COLOR_MODE_OPTIONS.find((opt) => opt.value === colorMode) ||
    COLOR_MODE_OPTIONS[0];

  const getCategoryValues = (key: FilterCategoryKey): string[] => {
    switch (key) {
      case 'age_group':
        return filters.ageGroups;
      case 'licensing':
        return filters.licensing;
      case 'subsidy':
        return filters.subsidy;
      case 'features':
        return filters.features;
    }
  };

  const toggleDialogOption = (key: FilterCategoryKey, value: string) => {
    const current = getCategoryValues(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    onFiltersChange({
      ...filters,
      ageGroups: key === 'age_group' ? next : filters.ageGroups,
      licensing: key === 'licensing' ? next : filters.licensing,
      subsidy: key === 'subsidy' ? next : filters.subsidy,
      features: key === 'features' ? next : filters.features,
    });
  };

  const clearDialogCategory = (key: FilterCategoryKey) => {
    onFiltersChange({
      ...filters,
      ageGroups: key === 'age_group' ? [] : filters.ageGroups,
      licensing: key === 'licensing' ? [] : filters.licensing,
      subsidy: key === 'subsidy' ? [] : filters.subsidy,
      features: key === 'features' ? [] : filters.features,
    });
    setOpenDialog(null);
  };

  // רשימת תגיות פילטרים פעילים להסרה מהירה בקליק בודד
  const activeFilterChips: {
    key: FilterCategoryKey;
    value: string;
    label: string;
  }[] = [];
  (['age_group', 'licensing', 'subsidy', 'features'] as FilterCategoryKey[]).forEach(
    (catKey) => {
      const selectedValues = getCategoryValues(catKey);
      const defs = FILTER_DIALOG_OPTIONS[catKey].options;
      selectedValues.forEach((val) => {
        const found = defs.find((o) => o.value === val);
        if (found) {
          activeFilterChips.push({
            key: catKey,
            value: val,
            label: found.label,
          });
        }
      });
    }
  );

  // רנדור תפריט נפתח צמוד לכפתור (Dropdown Mode — ברירת מחדל)
  const renderDropdownMenu = () => {
    if (!openDialog || !anchorPos) return null;
    const isColorMode = openDialog === 'color_mode';
    const currentValues = !isColorMode ? getCategoryValues(openDialog) : [];

    return createPortal(
      <div
        ref={dropdownMenuRef}
        className="filter-dropdown-menu"
        role="menu"
        aria-label={
          isColorMode
            ? 'בחירת מצב צביעת סיכות המפה'
            : FILTER_DIALOG_OPTIONS[openDialog].title
        }
        style={{
          top: `${anchorPos.top}px`,
          left: `${anchorPos.left}px`,
          width: `${anchorPos.width}px`,
        }}
      >
        <div className="dropdown-menu-header">
          <span>
            {isColorMode
              ? '🎨 צביעת סיכות המפה'
              : FILTER_DIALOG_OPTIONS[openDialog].title}
          </span>
          {!isColorMode && currentValues.length > 0 && (
            <button
              type="button"
              className="dropdown-clear-link"
              onClick={() => clearDialogCategory(openDialog)}
            >
              ניקוי
            </button>
          )}
        </div>

        <div className="dropdown-menu-options">
          {isColorMode
            ? COLOR_MODE_OPTIONS.map((opt) => {
                const selected = colorMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={`dropdown-option-btn ${selected ? 'selected' : ''}`}
                    onClick={() => {
                      onColorModeChange(opt.value);
                      setOpenDialog(null);
                    }}
                  >
                    <span
                      className={`dropdown-radio-dot ${selected ? 'checked' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="dropdown-option-label">{opt.label}</span>
                  </button>
                );
              })
            : FILTER_DIALOG_OPTIONS[openDialog].options.map((opt) => {
                const checked = currentValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    className={`dropdown-option-btn ${checked ? 'selected' : ''}`}
                    onClick={() => toggleDialogOption(openDialog, opt.value)}
                  >
                    <span
                      className={`dropdown-check-box ${checked ? 'checked' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="dropdown-option-label">{opt.label}</span>
                  </button>
                );
              })}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <section className="app-filters-wrapper" aria-label="חיפוש וסינון מסגרות">
      <div className="app-search-bar">
        <button
          type="button"
          className={`filter-icon-btn ${expanded ? 'expanded' : 'collapsed'}`}
          aria-label="פתיחת וסגירת סרגל פילטרים"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="filter-icon-graphic" aria-hidden="true" />
          {activeCategoryCount > 0 && (
            <span className="count">{activeCategoryCount}</span>
          )}
        </button>

        <div className="input-container">
          <input
            type="text"
            aria-label="חיפוש לפי עיר, רחוב או שם המסגרת"
            placeholder="חיפוש לפי עיר, כתובת, סמל מוסד או שם מסגרת..."
            value={filters.searchTerm}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
            onChange={(e) => {
              onFiltersChange({ ...filters, searchTerm: e.target.value });
              setShowSuggestions(true);
            }}
          />

          {/* כפתור ניקוי מהיר בתוך תיבת החיפוש */}
          {filters.searchTerm.length > 0 && (
            <button
              type="button"
              className="search-clear-btn"
              aria-label="ניקוי טקסט החיפוש"
              onClick={() => {
                onFiltersChange({ ...filters, searchTerm: '' });
                setSuggestions([]);
              }}
            >
              ✕
            </button>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div className="autocomplete-dropdown" role="listbox">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="autocomplete-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onFiltersChange({
                      ...filters,
                      searchTerm: sug.label_he,
                    });
                    setShowSuggestions(false);
                    onSelectAutocompleteSuggestion?.(sug);
                  }}
                >
                  <div className="ac-main-line">
                    <span className="ac-kind-tag">
                      {sug.kind === 'city'
                        ? '🏙️ יישוב'
                        : sug.kind === 'street'
                          ? '🛣️ רחוב'
                          : '🏠 מסגרת'}
                    </span>
                    <strong>{sug.label_he}</strong>
                  </div>
                  <div className="ac-sub-line">{sug.sublabel_he}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="app-filters-tab">
          <div className="filter-row">
            <div className="filter-chips-group">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openDialog === 'age_group'}
                className={`filter-selector ${filters.ageGroups.length > 0 ? 'active' : ''} ${openDialog === 'age_group' ? 'open' : ''}`}
                onClick={(e) => handleTriggerClick('age_group', e)}
              >
                גיל{' '}
                {filters.ageGroups.length > 0
                  ? `(${filters.ageGroups.length})`
                  : ''}
              </button>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openDialog === 'licensing'}
                className={`filter-selector ${filters.licensing.length > 0 ? 'active' : ''} ${openDialog === 'licensing' ? 'open' : ''}`}
                onClick={(e) => handleTriggerClick('licensing', e)}
              >
                רישוי ופיקוח{' '}
                {filters.licensing.length > 0
                  ? `(${filters.licensing.length})`
                  : ''}
              </button>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openDialog === 'subsidy'}
                className={`filter-selector ${filters.subsidy.length > 0 ? 'active' : ''} ${openDialog === 'subsidy' ? 'open' : ''}`}
                onClick={(e) => handleTriggerClick('subsidy', e)}
              >
                סבסוד ומסלול{' '}
                {filters.subsidy.length > 0 ? `(${filters.subsidy.length})` : ''}
              </button>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openDialog === 'features'}
                className={`filter-selector ${filters.features.length > 0 ? 'active' : ''} ${openDialog === 'features' ? 'open' : ''}`}
                onClick={(e) => handleTriggerClick('features', e)}
              >
                מאפיינים ומחיר{' '}
                {filters.features.length > 0
                  ? `(${filters.features.length})`
                  : ''}
              </button>

              {(activeCategoryCount > 0 || filters.searchTerm.trim() !== '') && (
                <button
                  type="button"
                  className="reset-all-filters-btn"
                  onClick={() =>
                    onFiltersChange({
                      searchTerm: '',
                      ageGroups: [],
                      licensing: [],
                      subsidy: [],
                      features: [],
                    })
                  }
                >
                  ✕ איפוס סינון
                </button>
              )}
            </div>

            {/* כפתור צביעת מפה בצד שמאל של שורת הפילטרים בצבע מובחן */}
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openDialog === 'color_mode'}
              className={`color-mode-selector ${openDialog === 'color_mode' ? 'open' : ''}`}
              onClick={(e) => handleTriggerClick('color_mode', e)}
              aria-label="בחירת מצב צביעת סיכות המפה"
            >
              <span>🎨 צביעת מפה: {activeColorModeMeta.shortLabel}</span>
            </button>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="active-filter-chips-row" aria-label="סינונים פעילים">
              {activeFilterChips.map((chip) => (
                <span
                  key={`${chip.key}-${chip.value}`}
                  className="active-filter-chip"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    className="active-filter-chip-remove"
                    aria-label={`הסרת סינון: ${chip.label}`}
                    onClick={() => toggleDialogOption(chip.key, chip.value)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {renderDropdownMenu()}
    </section>
  );
};
