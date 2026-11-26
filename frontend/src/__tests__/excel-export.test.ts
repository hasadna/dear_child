import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { DaycareDetailDto } from '../services/api-client';
import {
  buildDaycaresExcelBuffer,
  DEFAULT_EXCEL_FILENAME,
  EXCEL_EXPORT_HEADERS,
} from '../utils/excel-export';

const SAMPLE_DAYCARE: DaycareDetailDto = {
  id: 'excel-test-1',
  name: 'מעון יום כוכב הצפון — שלוחת ארלוזורוב',
  city_code: 5000,
  city_name_he: 'תל אביב - יפו',
  address: 'ארלוזורוב 42, תל אביב - יפו',
  lat: 32.0882,
  lon: 34.7818,
  target_age_groups: ['1_2'],
  age_group_label_he: 'לידה עד 3',
  is_subsidized: false,
  license_status: 'licensed',
  license_status_label_he: 'רישיון הפעלה בתוקף (משרד החינוך)',
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
  activity_hours_summary_he:
    'א׳–ה׳ 07:30–16:30 · שישי 07:30–12:30 · כולל הזנה',
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

describe('Excel Export (.xlsx)', () => {
  it('generates a valid RTL .xlsx workbook with centered cells, bold header, autoFilter, wrapText, and auto-fitted column widths', async () => {
    const buffer = await buildDaycaresExcelBuffer([SAMPLE_DAYCARE]);
    expect(buffer.byteLength).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.worksheets[0];
    expect(ws).toBeDefined();

    // RTL sheet view with frozen header row
    const firstView = ws.views[0] as {
      rightToLeft?: boolean;
      state?: string;
      ySplit?: number;
    };
    expect(firstView?.rightToLeft).toBe(true);
    expect(firstView?.state).toBe('frozen');
    expect(firstView?.ySplit).toBe(1);

    // AutoFilter (sort & filter buttons) on the entire header row
    expect(ws.autoFilter).toBeDefined();

    // Header row: David 11 bold + centered + wrapText
    const headerRow = ws.getRow(1);
    expect(headerRow.cellCount).toBe(EXCEL_EXPORT_HEADERS.length);
    for (let col = 1; col <= EXCEL_EXPORT_HEADERS.length; col += 1) {
      const cell = headerRow.getCell(col);
      expect(cell.value).toBe(EXCEL_EXPORT_HEADERS[col - 1]);
      expect(cell.font?.name).toBe('David');
      expect(cell.font?.size).toBe(11);
      expect(cell.font?.bold).toBe(true);
      expect(cell.alignment?.horizontal).toBe('center');
      expect(cell.alignment?.vertical).toBe('middle');
      expect(cell.alignment?.wrapText).toBe(true);
    }

    // Data row: David 11 + centered + wrapText
    const dataRow = ws.getRow(2);
    expect(dataRow.getCell(1).value).toBe(SAMPLE_DAYCARE.name);
    for (let col = 1; col <= EXCEL_EXPORT_HEADERS.length; col += 1) {
      const cell = dataRow.getCell(col);
      expect(cell.font?.name).toBe('David');
      expect(cell.font?.size).toBe(11);
      expect(cell.alignment?.horizontal).toBe('center');
      expect(cell.alignment?.vertical).toBe('middle');
      expect(cell.alignment?.wrapText).toBe(true);
    }

    // Column widths tightly fitted (capped so long multi-cohort strings wrap cleanly without huge whitespace)
    const nameCol = ws.getColumn(1);
    expect(nameCol.width).toBeGreaterThanOrEqual(20);
    expect(nameCol.width).toBeLessThanOrEqual(45);
    const hoursCol = ws.getColumn(11);
    expect(hoursCol.width).toBeGreaterThanOrEqual(20);
    expect(hoursCol.width).toBeLessThanOrEqual(45);
    expect((dataRow.height || 0)).toBeGreaterThanOrEqual(24);

    expect(DEFAULT_EXCEL_FILENAME).toBe('מסגרות ילדי היקר.xlsx');
  });
});
