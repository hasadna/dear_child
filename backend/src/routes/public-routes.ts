import { FastifyInstance } from 'fastify';
import {
  buildMetaEnvelope,
  STANDARD_META_ENVELOPE,
} from '../config/meta-envelope.js';
import {
  DaycareListItemDto,
  DaycareRepository,
  DaycareSearchQuery,
  TriStateStatus,
} from '../db/daycare-repository.js';
import {
  DaycareAgeGroup,
  DaycareLicenseStatus,
} from '../etl/facilities-resolver.js';
import { FrameworkTrack } from '../etl/official-sources-parsers.js';

function parseOptionalBoolean(val: unknown): boolean | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function parseOptionalInt(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function parseOptionalFloat(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (/[",\r\n]/.test(str)) {
    return `"${str}"`;
  }
  return str;
}

/**
 * בניית קובץ ייצוא CSV עם UTF-8 BOM (\uFEFF), שורת ייחוס ODbL 1.0 וכתב ויתור, וללא מספרי נייד (05x)
 */
export function buildDaycaresExportCsv(items: DaycareListItemDto[]): string {
  const disclaimerRow = [
    `# רישיון וייחוס (${STANDARD_META_ENVELOPE.license}): ${STANDARD_META_ENVELOPE.attribution_he} | ${STANDARD_META_ENVELOPE.reliance_disclaimer_he}`,
  ];

  const headers = [
    'מזהה מסגרת',
    'סמל משרד החינוך',
    'סמל משרד העבודה',
    'שם המסגרת',
    'יישוב',
    'כתובת',
    'מסלול',
    'סטטוס רישוי רשמי',
    'מעון סמל מסובסד',
    'שנת לימודים',
    'מחיר חודשי מייצג (₪)',
    'מחיר מינימום (₪)',
    'מחיר מקסימום (₪)',
    'מספר דיווחים',
    'דרגת אמינות מחיר',
    'טלפון קווי רשמי (ניידים הוסרו)',
    'הקשר רגולטורי',
  ];

  const lines: string[] = [
    disclaimerRow.map(escapeCsvCell).join(','),
    headers.map(escapeCsvCell).join(','),
  ];

  for (const item of items) {
    const p = item.price_summary_current_year;
    const row = [
      item.daycare_id,
      item.moe_symbol || '',
      item.mol_symbol || '',
      item.display_name,
      item.city_name_he,
      item.full_address_public,
      item.primary_track,
      item.license_status,
      item.is_subsidized_symbol ? 'כן' : 'לא',
      p ? p.school_year_label : '',
      p ? p.primary_pin_price_nis : '',
      p ? p.min_price_nis : '',
      p ? p.max_price_nis : '',
      p ? p.reports_count : 0,
      p ? p.price_trust_tier : '',
      item.official_phone_public || '',
      item.regulatory_context_he,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export async function registerPublicRoutes(
  app: FastifyInstance,
  repo: DaycareRepository,
  defaultSchoolYear: number
): Promise<void> {
  // 3.1 חיפוש וסינון מסגרות למפה ולטבלה הנגישה — GET /api/v1/daycares
  app.get('/api/v1/daycares', async (req, reply) => {
    const q = (req.query || {}) as Record<string, unknown>;
    const format = q.format === 'map_pins' ? 'map_pins' : 'list';
    const page = parseOptionalInt(q.page) || 1;
    const pageSize = parseOptionalInt(q.page_size) || 50;

    const searchQuery: DaycareSearchQuery = {
      city_code: parseOptionalInt(q.city_code),
      city_name_he: typeof q.city_name_he === 'string' ? q.city_name_he : undefined,
      lat: parseOptionalFloat(q.lat),
      lng: parseOptionalFloat(q.lng),
      radius_m: parseOptionalInt(q.radius_m),
      bbox: typeof q.bbox === 'string' ? q.bbox : undefined,
      school_year: parseOptionalInt(q.school_year) || defaultSchoolYear,
      age_group: (q.age_group as DaycareAgeGroup) || undefined,
      framework_track: (q.framework_track as FrameworkTrack) || undefined,
      is_full_day: parseOptionalBoolean(q.is_full_day),
      min_price: parseOptionalInt(q.min_price),
      max_price: parseOptionalInt(q.max_price),
      has_price_only: parseOptionalBoolean(q.has_price_only),
      license_status: (q.license_status as DaycareLicenseStatus) || undefined,
      is_subsidized_symbol: parseOptionalBoolean(q.is_subsidized_symbol),
      includes_friday: parseOptionalBoolean(q.includes_friday),
      shelter_status: (q.shelter_status as TriStateStatus) || undefined,
      q: typeof q.q === 'string' ? q.q : undefined,
      sort_by: (q.sort_by as DaycareSearchQuery['sort_by']) || 'name',
      page,
      page_size: pageSize,
      format,
    };

    const result = await repo.searchDaycares(searchQuery);

    if (format === 'map_pins') {
      // D-38: אינדקס סיכות ארצי רזה ודחוס ל-Supercluster עם Cache ל-5 דקות
      reply.header('Cache-Control', 'public, max-age=300');
      return {
        meta: buildMetaEnvelope({
          total_count: result.totalCount,
          city_median_price_nis: result.cityMedianPriceNis,
          format: 'map_pins',
        }),
        pins: result.mapPins || [],
      };
    }

    return {
      meta: buildMetaEnvelope({
        total_count: result.totalCount,
        page,
        page_size: pageSize,
        city_median_price_nis: result.cityMedianPriceNis,
      }),
      items: result.items,
    };
  });

  // 3.2 פרופיל מסגרת מלא, היסטוריית שנים והשוואה יחסית — GET /api/v1/daycares/:daycare_id
  app.get('/api/v1/daycares/:daycare_id', async (req, reply) => {
    const params = req.params as { daycare_id: string };
    const q = (req.query || {}) as Record<string, unknown>;
    const schoolYear = parseOptionalInt(q.school_year) || defaultSchoolYear;

    const details = await repo.getDaycareDetails(params.daycare_id, schoolYear);
    if (!details) {
      reply.code(404);
      return {
        error_code: 'DAYCARE_NOT_FOUND',
        message_he: 'המסגרת המבוקשת לא נמצאה במאגר.',
        meta: buildMetaEnvelope(),
      };
    }

    return {
      meta: buildMetaEnvelope(),
      ...details,
    };
  });

  // 3.2ב סטטיסטיקת מחירים מרחבית לפי עיר והשוואה לתעריף מפוקח — GET /api/v1/stats/area
  app.get('/api/v1/stats/area', async (req, reply) => {
    const q = (req.query || {}) as Record<string, unknown>;
    const stats = await repo.getAreaPriceStats({
      city_code: parseOptionalInt(q.city_code),
      city_name_he: typeof q.city_name_he === 'string' ? q.city_name_he : undefined,
      neighborhood_he:
        typeof q.neighborhood_he === 'string' ? q.neighborhood_he : undefined,
      age_group: (q.age_group as DaycareAgeGroup) || undefined,
      framework_track: (q.framework_track as FrameworkTrack) || undefined,
      school_year: parseOptionalInt(q.school_year) || defaultSchoolYear,
    });

    if (!stats) {
      reply.code(404);
      return {
        error_code: 'AREA_NOT_FOUND',
        message_he: 'לא נמצאו נתונים לאזור המבוקש.',
        meta: buildMetaEnvelope(),
      };
    }

    return {
      meta: buildMetaEnvelope(),
      stats,
    };
  });

  // 3.3 השלמת יישובים, רחובות ומסגרות מקומית (0 ₪) — GET /api/v1/autocomplete/locations
  app.get('/api/v1/autocomplete/locations', async (req) => {
    const q = (req.query || {}) as Record<string, unknown>;
    const term = typeof q.q === 'string' ? q.q.trim() : '';
    const cityCode = parseOptionalInt(q.city_code);
    const limit = parseOptionalInt(q.limit) || 10;

    if (term.length < 2) {
      return {
        meta: buildMetaEnvelope(),
        suggestions: [],
      };
    }

    const suggestions = await repo.autocompleteLocations({
      q: term,
      city_code: cityCode,
      limit,
    });

    return {
      meta: buildMetaEnvelope(),
      suggestions,
    };
  });

  // 3.4 ייצוא תוצאות חיפוש (CSV עם UTF-8 BOM / XLSX) — GET /api/v1/export
  app.get('/api/v1/export', async (req, reply) => {
    const q = (req.query || {}) as Record<string, unknown>;
    const exportFormat = q.format === 'xlsx' ? 'xlsx' : 'csv';

    const searchResult = await repo.searchDaycares({
      city_code: parseOptionalInt(q.city_code),
      city_name_he: typeof q.city_name_he === 'string' ? q.city_name_he : undefined,
      school_year: parseOptionalInt(q.school_year) || defaultSchoolYear,
      age_group: (q.age_group as DaycareAgeGroup) || undefined,
      framework_track: (q.framework_track as FrameworkTrack) || undefined,
      has_price_only: parseOptionalBoolean(q.has_price_only),
      is_subsidized_symbol: parseOptionalBoolean(q.is_subsidized_symbol),
      q: typeof q.q === 'string' ? q.q : undefined,
      page: 1,
      page_size: 200,
      format: 'list',
    });

    const csvBody = buildDaycaresExportCsv(searchResult.items);

    if (exportFormat === 'xlsx') {
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8'
      );
      reply.header(
        'Content-Disposition',
        'attachment; filename="dear_child_daycares_export.csv"'
      );
      return reply.send(csvBody);
    }

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header(
      'Content-Disposition',
      'attachment; filename="dear_child_daycares_export.csv"'
    );
    return reply.send(csvBody);
  });
}
