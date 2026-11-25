import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FiltersBar, ActiveFilters } from '../components/shell/FiltersBar';
import {
  DaycareListTable,
  formatCompactAgeRange,
} from '../components/shell/DaycareListTable';
import { DaycareDetailDto } from '../services/api-client';

const SAMPLE_ITEM: DaycareDetailDto = {
  id: 'test-daycare-1',
  name: 'מעון כוכב הצפון',
  city_code: 5000,
  city_name_he: 'תל אביב - יפו',
  address: 'ארלוזורוב 42, תל אביב - יפו',
  lat: 32.0882,
  lon: 34.7818,
  target_age_groups: ['1_2'],
  age_group_label_he: 'לידה עד 3',
  is_subsidized: false,
  license_status: 'licensed',
  license_status_label_he: 'רישיון הפעלה בתוקף',
  license_icon_code: 'valid',
  ministry_edu_symbol: '410923',
  labor_Cross_symbol: null,
  operator_name: 'כוכב הצפון בע"מ',
  phone_official: '03-5551234',
  has_active_stop_order: false,
  display_mode: 'median',
  price_Trust_tier: 'community_consensus',
  price_formatted_he: '₪5,600 לחודש (חציון)',
  price_pill_short_he: '✓ ₪5,600',
  trust_badge_he: '✓ מידע הורים מאומת (4 דיווחים)',
  headline_price_nis: 5600,
  min_price_nis: 5500,
  max_price_nis: 5750,
  active_reports_count: 4,
  school_year: 2027,
  activity_hours_summary_he: 'א׳–ה׳ 07:30–16:30',
  yoy_trend_summary_he: null,
  benchmark_neighborhood_summary_he: null,
  regulatory_context_he: 'רישיון בתוקף.',
  price_cohorts: [],
  relative_benchmarks: [],
  regulated_benchmark_comparison: {
    regulated_symbol_max_price_nis: 2515,
    annual_gap_11_months_nis: 33935,
    summary_he: 'פער שנתי.',
  },
  yoy_price_history: [],
  individual_reports: [],
  reliance_disclaimer_he: 'כתב ויתור.',
};

describe('FiltersBar & DaycareListTable', () => {
  it('opens anchored dropdown menus by default, live-filters options, shows active filter chips, and switches map color mode', () => {
    const onFiltersChange = vi.fn();
    const onColorModeChange = vi.fn();
    const filters: ActiveFilters = {
      searchTerm: 'תל אביב',
      ageGroups: ['1_2'],
      licensing: [],
      subsidy: [],
      features: [],
    };

    render(
      <FiltersBar
        filters={filters}
        colorMode="relative_price"
        onColorModeChange={onColorModeChange}
        onFiltersChange={onFiltersChange}
      />
    );

    // Search clear button clears search term
    fireEvent.click(screen.getByLabelText('ניקוי טקסט החיפוש'));
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: '' })
    );

    // Active filter chip is rendered and can be removed directly
    const removeChipBtn = screen.getByLabelText(/הסרת סינון: פעוטות צעירים/);
    fireEvent.click(removeChipBtn);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ ageGroups: [] })
    );

    // Open Age filter dropdown (not modal dialog)
    fireEvent.click(screen.getByRole('button', { name: /^גיל/ }));
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveTextContent('תינוקות (לידה עד שנה)');

    // Clicking an option live-updates filters
    fireEvent.click(screen.getByText('תינוקות (לידה עד שנה)'));
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ ageGroups: ['1_2', '0_1'] })
    );

    // Close via Esc
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Open Map Color Mode dropdown from left button in filters bar
    fireEvent.click(screen.getByLabelText('בחירת מצב צביעת סיכות המפה'));
    const colorMenu = screen.getByRole('menu');
    expect(colorMenu).toHaveTextContent('רמת מחיר יחסית וסבסוד');
    expect(colorMenu).toHaveTextContent('סטטוס רישוי ופיקוח רשמי');
    expect(colorMenu).toHaveTextContent('מספר דיווחי הורים מאומתים');

    fireEvent.click(screen.getByText('סטטוס רישוי ופיקוח רשמי'));
    expect(onColorModeChange).toHaveBeenCalledWith('supervision_status');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles filter bar expanded/collapsed state and rotates filter icon smoothly', () => {
    render(
      <FiltersBar
        filters={{
          searchTerm: '',
          ageGroups: [],
          licensing: [],
          subsidy: [],
          features: [],
        }}
        colorMode="relative_price"
        onColorModeChange={vi.fn()}
        onFiltersChange={vi.fn()}
      />
    );

    const toggleBtn = screen.getByLabelText('פתיחת וסגירת סרגל פילטרים');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveClass('expanded');
    expect(toggleBtn).not.toHaveClass('collapsed');
    expect(screen.getByRole('button', { name: /^גיל/ })).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveClass('collapsed');
    expect(screen.queryByRole('button', { name: /^גיל/ })).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveClass('expanded');
  });

  it('merges contiguous and non-contiguous age groups into compact numeric ranges', () => {
    expect(formatCompactAgeRange(['0_1', '1_2', '2_3'])).toBe('0–3');
    expect(formatCompactAgeRange(['0_1', '1_2', '2_3', '3_6'])).toBe('0–6');
    expect(formatCompactAgeRange(['1_2', '3_6'])).toBe('1–2, 3–6');
    expect(formatCompactAgeRange(['0_3_mixed'])).toBe('0–3');
    expect(formatCompactAgeRange(['3_6'])).toBe('3–6');
  });

  it('renders streamlined DaycareListTable columns, compact prices, subsidy badge, Maps/tel links, and concise expanded card', () => {
    const onSelectId = vi.fn();
    const onOpenFullProfile = vi.fn();
    const onReport = vi.fn();
    const onFlagError = vi.fn();
    const onExportExcel = vi.fn();

    const subsidizedNoPriceItem: DaycareDetailDto = {
      ...SAMPLE_ITEM,
      id: 'test-daycare-2',
      name: 'מעון ויצו',
      target_age_groups: ['0_1', '1_2', '2_3'],
      is_subsidized: true,
      display_mode: 'no_price',
      headline_price_nis: null,
      active_reports_count: 0,
      price_formatted_he: 'טרם דווח מחיר',
    };

    render(
      <DaycareListTable
        items={[SAMPLE_ITEM, subsidizedNoPriceItem]}
        selectedId={SAMPLE_ITEM.id}
        hoveredId={null}
        cityMedianPriceNis={5400}
        onSelectId={onSelectId}
        onHoverId={vi.fn()}
        onOpenFullProfile={onOpenFullProfile}
        onReportForDaycare={onReport}
        onFlagErrorForDaycare={onFlagError}
        onExportExcel={onExportExcel}
      />
    );

    // Updated summary bar text (count removed since total-tag already shows it)
    expect(screen.queryByText(/נמצאו/)).not.toBeInTheDocument();
    expect(screen.getByText(/חציון מחיר באזור:/)).toHaveTextContent(
      'חציון מחיר באזור: ₪5,400'
    );

    // 4 clean content columns (no separate "סבסוד" column, renamed to "שם וכתובת")
    expect(screen.getByText('שם וכתובת')).toBeInTheDocument();
    expect(screen.queryByText('שם מזהה ויישוב')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'סבסוד' })
    ).not.toBeInTheDocument();

    // Compact numeric age ranges & concise prices + subsidy badge
    expect(screen.getByText('1–2')).toBeInTheDocument();
    expect(screen.getByText('0–3')).toBeInTheDocument();
    expect(screen.getByText('₪5,600')).toBeInTheDocument();
    expect(screen.getByText('✓ 4 דיווחים')).toBeInTheDocument();
    expect(screen.getByText('טרם דווח')).toBeInTheDocument();
    expect(screen.getByText('מסובסד')).toBeInTheDocument();

    // Expanded quick card omits official licensing text & MOE symbol (kept in full profile)
    expect(screen.queryByText(/סטטוס רישוי רשמי/)).not.toBeInTheDocument();
    expect(screen.queryByText(/סמל מעון \/ מוסד/)).not.toBeInTheDocument();

    // Clickable Google Maps address link & tel phone link
    const mapsLink = screen.getByRole('link', {
      name: /ארלוזורוב 42, תל אביב - יפו/,
    });
    expect(mapsLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/search/')
    );
    expect(mapsLink).toHaveAttribute('target', '_blank');

    const phoneLink = screen.getByRole('link', { name: /03-5551234/ });
    expect(phoneLink).toHaveAttribute('href', 'tel:03-5551234');

    // Concise action buttons + icon-only share button
    const profileBtn = screen.getByRole('button', { name: /כרטיס גן מלא/ });
    expect(profileBtn).toHaveTextContent('כרטיס גן מלא');
    expect(profileBtn).not.toHaveTextContent('השוואה והיסטוריה');
    fireEvent.click(profileBtn);
    expect(onOpenFullProfile).toHaveBeenCalledWith(SAMPLE_ITEM);

    fireEvent.click(screen.getByRole('button', { name: /דווחו \/ עדכנו מחיר/ }));
    expect(onReport).toHaveBeenCalledWith(SAMPLE_ITEM);

    fireEvent.click(screen.getByRole('button', { name: /מצאתם טעות/ }));
    expect(onFlagError).toHaveBeenCalledWith(SAMPLE_ITEM);

    expect(screen.getByRole('button', { name: 'שיתוף' })).toBeInTheDocument();

    const exportBtn = screen.getByRole('button', { name: /ייצוא.*אקסל/ });
    expect(exportBtn).toHaveTextContent('ייצוא לאקסל');
    expect(exportBtn).not.toHaveTextContent(/CSV/i);
    fireEvent.click(exportBtn);
    expect(onExportExcel).toHaveBeenCalledTimes(1);
  });
});
