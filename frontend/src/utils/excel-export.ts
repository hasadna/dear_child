import { DaycareDetailDto } from '../services/api-client';

export const EXCEL_EXPORT_HEADERS = [
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
] as const;

function mapDaycareToExcelRow(it: DaycareDetailDto): string[] {
  return [
    it.name || '',
    it.city_name_he || '',
    it.address || '',
    it.age_group_label_he || '',
    it.license_status_label_he || '',
    it.ministry_edu_symbol || '',
    it.labor_Cross_symbol || '',
    it.is_subsidized ? 'כן' : 'לא',
    it.price_formatted_he || '',
    it.trust_badge_he || '',
    it.activity_hours_summary_he || '',
  ];
}

/**
 * בונה קובץ Excel (.xlsx) תקני בעברית (RTL):
 * - שורה עליונה ב-Bold עם רקע עדין והקפאת כותרת
 * - כפתורי מיון ופילטור (AutoFilter) על כל העמודות
 * - מרכוז אופקי ואנכי + wrapText בכל תא
 * - התאמה אוטומטית של רוחב כל עמודה כך שכל הטקסט ייכנס במלואו
 */
export async function buildDaycaresExcelBuffer(
  items: DaycareDetailDto[]
): Promise<ArrayBuffer> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ילדי היקר — הסדנא לידע ציבורי';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('מסגרות חינוך - ילדי היקר', {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }],
  });

  const rows = items.map(mapDaycareToExcelRow);

  // הוספת שורת הכותרת
  const headerRow = worksheet.addRow([...EXCEL_EXPORT_HEADERS]);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'David',
      size: 11,
      bold: true,
      color: { argb: 'FF053856' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F4EE' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB8D4C9' } },
      bottom: { style: 'medium', color: { argb: 'FF053856' } },
      left: { style: 'thin', color: { argb: 'FFB8D4C9' } },
      right: { style: 'thin', color: { argb: 'FFB8D4C9' } },
    };
  });

  // הוספת שורות הנתונים עם מרכוז וגלישת טקסט בכל תא
  for (const rowValues of rows) {
    const dataRow = worksheet.addRow(rowValues);
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: 'David',
        size: 11,
        color: { argb: 'FF1F2937' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5ECEF' } },
        bottom: { style: 'thin', color: { argb: 'FFE5ECEF' } },
        left: { style: 'thin', color: { argb: 'FFE5ECEF' } },
        right: { style: 'thin', color: { argb: 'FFE5ECEF' } },
      };
    });
  }

  // הפעלת כפתורי מיון ופילטור (AutoFilter) על כל עמודות הכותרת
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: EXCEL_EXPORT_HEADERS.length },
  };

  // חישוב רוחב עמודה מאוזן (עברית ב-Arial 10.5 צרה יותר מרוחב תו דיפולטי באקסל, עם תקרה ל-wrapText נקי)
  const colWidths: number[] = [];
  for (let colIdx = 0; colIdx < EXCEL_EXPORT_HEADERS.length; colIdx += 1) {
    const headerLen = EXCEL_EXPORT_HEADERS[colIdx].length;
    let maxLen = headerLen;
    for (const r of rows) {
      const val = r[colIdx] || '';
      const longestLine = val
        .split(/\r?\n/)
        .reduce((acc, line) => Math.max(acc, line.length), 0);
      if (longestLine > maxLen) {
        maxLen = longestLine;
      }
    }
    const headerMinWidth = Math.ceil(headerLen * 0.95) + 4; // מקום לכפתור ה-AutoFilter
    const contentWidth = Math.ceil(maxLen * 0.88) + 2;
    const width = Math.min(42, Math.max(12, headerMinWidth, contentWidth));
    colWidths.push(width);
    worksheet.getColumn(colIdx + 1).width = width;
  }

  // התאמת גובה שורה לפי מספר השורות הצפוי בגלישת הטקסט (wrapText) כדי ששום טקסט לא ייחתך אנכית
  rows.forEach((rowValues, rowIdx) => {
    let maxWrappedLines = 1;
    rowValues.forEach((val, colIdx) => {
      const effectiveCharsPerLine = Math.max(8, Math.floor(colWidths[colIdx] * 1.05));
      const lines = (val || '').split(/\r?\n/).reduce((sum, line) => {
        return sum + Math.max(1, Math.ceil(line.length / effectiveCharsPerLine));
      }, 0);
      if (lines > maxWrappedLines) {
        maxWrappedLines = lines;
      }
    });
    worksheet.getRow(rowIdx + 2).height = Math.max(22, maxWrappedLines * 17 + 7);
  });

  const rawBuffer = await workbook.xlsx.writeBuffer();
  if (rawBuffer instanceof ArrayBuffer) {
    return rawBuffer;
  }
  const uint8 = new Uint8Array(rawBuffer as ArrayLike<number>);
  return uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength
  );
}

export const DEFAULT_EXCEL_FILENAME = 'מסגרות ילדי היקר.xlsx';

/**
 * מייצא ומוריד קובץ Excel (.xlsx) בדפדפן
 */
export async function downloadDaycaresExcel(
  items: DaycareDetailDto[],
  filename = DEFAULT_EXCEL_FILENAME
): Promise<void> {
  const buffer = await buildDaycaresExcelBuffer(items);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
