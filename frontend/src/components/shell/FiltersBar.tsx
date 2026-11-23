import React, { useState } from 'react';

export type FilterDialogKey =
  | 'age_group'
  | 'licensing'
  | 'subsidy'
  | 'features'
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
  onFiltersChange: (next: ActiveFilters) => void;
}

const FILTER_DIALOG_OPTIONS: Record<
  Exclude<FilterDialogKey, null>,
  { title: string; options: { value: string; label: string }[] }
> = {
  age_group: {
    title: 'סינון לפי קבוצת גיל (0–3 ו-3–6)',
    options: [
      { value: '0_1', label: 'תינוקות (לידה עד שנה)' },
      { value: '1_2', label: 'פעוטות צעירים (שנה עד שנתיים)' },
      { value: '2_3', label: 'פעוטות בוגרים (שנתיים עד שלוש)' },
      { value: '0_3', label: 'רב-גילי (לידה עד 3)' },
      { value: '3_6', label: 'גני ילדים וצהרונים (גילאי 3–6)' },
    ],
  },
  licensing: {
    title: 'סינון לפי סטטוס רישוי ופיקוח רשמי',
    options: [
      { value: 'valid', label: 'רישיון הפעלה בתוקף (משרד החינוך)' },
      { value: 'in_progress', label: 'בתהליך רישוי (הסדר רציפות)' },
      { value: 'symbol_recognized', label: 'מעון סמל מוכר (משרד העבודה)' },
      { value: 'municipal_verified', label: 'מופיע במאגר מוניציפלי רשמי (GIS)' },
      { value: 'stop_order_active', label: 'צו הפסקה מנהלי פעיל' },
    ],
  },
  subsidy: {
    title: 'סינון לפי מסלול וסבסוד ממשלתי',
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

/**
 * סרגל החיפוש והסינון של "ילדי היקר"
 */
export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [openDialog, setOpenDialog] = useState<FilterDialogKey>(null);

  const activeCategoryCount =
    (filters.ageGroups.length > 0 ? 1 : 0) +
    (filters.licensing.length > 0 ? 1 : 0) +
    (filters.subsidy.length > 0 ? 1 : 0) +
    (filters.features.length > 0 ? 1 : 0);

  const getCategoryValues = (key: Exclude<FilterDialogKey, null>): string[] => {
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

  const toggleDialogOption = (
    key: Exclude<FilterDialogKey, null>,
    value: string
  ) => {
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

  const clearDialogCategory = (key: Exclude<FilterDialogKey, null>) => {
    onFiltersChange({
      ...filters,
      ageGroups: key === 'age_group' ? [] : filters.ageGroups,
      licensing: key === 'licensing' ? [] : filters.licensing,
      subsidy: key === 'subsidy' ? [] : filters.subsidy,
      features: key === 'features' ? [] : filters.features,
    });
    setOpenDialog(null);
  };

  return (
    <section className="app-filters-wrapper" aria-label="חיפוש וסינון מסגרות">
      <div className="app-search-bar">
        <button
          type="button"
          className="filter-icon-btn"
          aria-label="פתיחת וסגירת סרגל פילטרים"
          onClick={() => setExpanded(!expanded)}
        >
          {activeCategoryCount > 0 && (
            <span className="count">{activeCategoryCount}</span>
          )}
        </button>

        <div className="input-container">
          <input
            type="search"
            aria-label="חיפוש לפי עיר, רחוב או שם המסגרת"
            placeholder="חיפוש לפי עיר, כתובת או שם מסגרת..."
            value={filters.searchTerm}
            onChange={(e) =>
              onFiltersChange({ ...filters, searchTerm: e.target.value })
            }
          />
        </div>
      </div>

      {expanded && (
        <div className="app-filters-tab">
          <div className="filter-row">
            <button
              type="button"
              className={`filter-selector ${filters.ageGroups.length > 0 ? 'active' : ''}`}
              onClick={() => setOpenDialog('age_group')}
            >
              גיל {filters.ageGroups.length > 0 ? `(${filters.ageGroups.length})` : ''}
            </button>
            <button
              type="button"
              className={`filter-selector ${filters.licensing.length > 0 ? 'active' : ''}`}
              onClick={() => setOpenDialog('licensing')}
            >
              רישוי ופיקוח{' '}
              {filters.licensing.length > 0 ? `(${filters.licensing.length})` : ''}
            </button>
            <button
              type="button"
              className={`filter-selector ${filters.subsidy.length > 0 ? 'active' : ''}`}
              onClick={() => setOpenDialog('subsidy')}
            >
              סבסוד ומסלול{' '}
              {filters.subsidy.length > 0 ? `(${filters.subsidy.length})` : ''}
            </button>
            <button
              type="button"
              className={`filter-selector ${filters.features.length > 0 ? 'active' : ''}`}
              onClick={() => setOpenDialog('features')}
            >
              מאפיינים ומחיר{' '}
              {filters.features.length > 0 ? `(${filters.features.length})` : ''}
            </button>
          </div>
        </div>
      )}

      {openDialog && (
        <div
          className="app-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={FILTER_DIALOG_OPTIONS[openDialog].title}
        >
          <div className="app-dialog-container">
            <div className="dialog-header">
              {FILTER_DIALOG_OPTIONS[openDialog].title}
            </div>
            <div className="options">
              {FILTER_DIALOG_OPTIONS[openDialog].options.map((opt) => {
                const checked = getCategoryValues(openDialog).includes(
                  opt.value
                );
                return (
                  <div
                    key={opt.value}
                    className="option"
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={0}
                    onClick={() => toggleDialogOption(openDialog, opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleDialogOption(openDialog, opt.value);
                      }
                    }}
                  >
                    <div className={`icon ${checked ? 'checked' : ''}`} />
                    <span className="name">{opt.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="controls">
              <button
                type="button"
                className="clear-btn"
                onClick={() => clearDialogCategory(openDialog)}
              >
                ניקוי הסינון
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={() => setOpenDialog(null)}
              >
                שמירה
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
