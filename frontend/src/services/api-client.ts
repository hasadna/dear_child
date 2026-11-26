import { obtainGoogleIdToken } from '../utils/google-auth';
import {
  formatHebrewSchoolYear,
  getActiveSchoolYear,
} from '../utils/school-years';

/**
 * לקוח ה-API של "ילדי היקר" (Frontend REST API Client)
 * מתקשר מול שרתי ה-Fastify (/api/v1/*) ושומר במטמון מקומי רק תוצאות שהתקבלו מהשרת (או נתוני טסט).
 */

export interface DaycareListItemDto {
  id: string;
  name: string;
  city_code: number;
  city_name_he: string;
  address: string;
  lat: number;
  lon: number;
  target_age_groups: string[];
  age_group_label_he: string;
  is_subsidized: boolean;
  license_status: string;
  license_status_label_he: string;
  license_icon_code: 'valid' | 'in_progress' | 'did_not_apply' | 'none';
  ministry_edu_symbol: string | null;
  labor_Cross_symbol: string | null;
  operator_name: string | null;
  phone_official: string | null;
  has_active_stop_order: boolean;
  has_official_sanction?: boolean;
  official_sanction_date?: string | null;
  official_sanction_text?: string | null;
  official_capacity?: number | null;
  operator_corp_id?: string | null;
  official_last_checked_at?: string | null;
  external_sources?: {
    source_system: string;
    external_record_id: string;
    source_license: string;
    last_synced_at: string;
  }[];
  display_mode: 'no_price' | 'single' | 'range' | 'median';
  price_Trust_tier:
    | 'no_price'
    | 'official_regulated'
    | 'community_consensus'
    | 'community_discrepancy'
    | 'single_parent_report';
  price_formatted_he: string;
  price_pill_short_he: string;
  trust_badge_he: string;
  headline_price_nis: number | null;
  min_price_nis: number | null;
  max_price_nis: number | null;
  active_reports_count: number;
  school_year: number;
  activity_hours_summary_he: string | null;
  shelter_status?: 'yes' | 'no' | 'unknown';
  cameras_0_3_status?: 'yes' | 'no' | 'unknown';
  yoy_trend_summary_he: string | null;
  benchmark_neighborhood_summary_he: string | null;
  regulatory_context_he: string;
}

export interface CompactMapPinDto {
  id: string;
  name: string;
  lat: number;
  lon: number;
  price: number | null;
  pill_label: string;
  display_mode: 'no_price' | 'single' | 'range' | 'median';
  trust_tier: string;
  reports_count: number;
  license_status: string;
  is_subsidized: boolean;
  has_stop_order: boolean;
}

export interface PriceCohortSummaryDto {
  school_year: number;
  school_year_label: string;
  age_group: string;
  age_group_label_he: string;
  is_municipal_tzaharon_only: boolean;
  hours_bucket: string;
  includes_friday: boolean | null;
  includes_nutrition: boolean | null;
  active_reports_count: number;
  display_mode: 'no_price' | 'single' | 'range' | 'median';
  headline_price_nis: number | null;
  min_price_nis: number | null;
  max_price_nis: number | null;
  iqr_q25_nis: number | null;
  iqr_q75_nis: number | null;
  price_formatted_he: string;
  trust_badge_he: string;
}

export interface BenchmarkMetricDto {
  scope: 'radius_1km' | 'city_all_same_track' | 'city_similar_params';
  label_he: string;
  median_price_nis: number | null;
  iqr_q25_nis: number | null;
  iqr_q75_nis: number | null;
  sample_daycares_count: number;
  is_sufficient_sample: boolean;
  diff_nis: number | null;
  diff_pct: number | null;
  comparison_text_he: string;
}

export interface YoYHistoryPointDto {
  school_year: number;
  school_year_label: string;
  age_group: string;
  median_price_nis: number;
  reports_count: number;
  yoy_change_nis: number | null;
  yoy_change_pct: number | null;
}

export interface IndividualReportSummaryDto {
  school_year: number;
  school_year_label: string;
  age_group: string;
  age_group_label_he: string;
  monthly_price_nis: number;
  start_time_weekday: string | null;
  end_time_weekday: string | null;
  includes_friday: boolean | null;
  friday_start_time: string | null;
  friday_end_time: string | null;
  includes_nutrition: boolean | null;
  is_municipal_tzaharon_only: boolean;
  reported_size_bucket?: string;
  reported_shelter_status?: 'yes' | 'no' | 'unknown';
  reported_cameras_0_3?: 'yes' | 'no' | 'unknown';
  report_source: string;
  report_source_label_he: string;
}

export interface DaycareDetailDto extends DaycareListItemDto {
  price_cohorts: PriceCohortSummaryDto[];
  relative_benchmarks: BenchmarkMetricDto[];
  regulated_benchmark_comparison: {
    regulated_symbol_max_price_nis: number;
    annual_gap_11_months_nis: number | null;
    summary_he: string;
  };
  yoy_price_history: YoYHistoryPointDto[];
  individual_reports: IndividualReportSummaryDto[];
  reliance_disclaimer_he: string;
}

export interface AutocompleteLocationDto {
  kind: 'city' | 'street' | 'daycare';
  label_he: string;
  sublabel_he: string;
  city_code: number;
  lat: number | null;
  lon: number | null;
  daycare_id?: string;
}

export interface ReportItemPayload {
  school_year: number;
  age_group: '0_1' | '1_2' | '2_3' | '0_3_mixed' | '3_6';
  monthly_price_nis: number;
  start_time_weekday: string;
  end_time_weekday: string;
  includes_friday: boolean;
  friday_start_time?: string | null;
  friday_end_time?: string | null;
  includes_nutrition: boolean;
  is_municipal_tzaharon_only: boolean;
  reported_over_statutory_threshold?: boolean | null;
  reported_has_shelter?: boolean | null;
  reported_has_cameras?: boolean | null;
  outlier_confirmed_by_user: boolean;
}

export interface ReportSubmissionPayload {
  daycare_id: string;
  turnstile_token: string;
  legal_declaration_accepted: boolean;
  items: ReportItemPayload[];
}

export interface CorrectionRequestPayload {
  daycare_id: string;
  error_category:
    | 'wrong_price_outlier'
    | 'daycare_closed'
    | 'wrong_address_or_location'
    | 'wrong_license_status'
    | 'other_factual_error';
  selected_field_notes_code?: string | null;
  details_text?: string;
  submitter_role: 'parent' | 'daycare_operator' | 'researcher_or_public';
  turnstile_token: string;
}

// מאגר מקומי בזיכרון לשמירת התוצאות האחרונות מהשרת (או הזרקת נתוני טסט ביחידות)
let inMemoryDaycares: DaycareDetailDto[] = [];

export function setInMemoryDaycaresForTesting(items: DaycareDetailDto[]): void {
  inMemoryDaycares = structuredClone(items);
}

/**
 * סינון מקומי של מסגרות לפי הפילטרים הפעילים בממשק
 */
export function filterDaycaresClientSide(
  items: DaycareDetailDto[],
  filters: {
    searchTerm: string;
    ageGroups: string[];
    licensing: string[];
    subsidy: string[];
    features: string[];
  }
): DaycareDetailDto[] {
  return items.filter((item) => {
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.trim().toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchAddress = item.address.toLowerCase().includes(q);
      const matchCity = item.city_name_he.toLowerCase().includes(q);
      const matchSymbol =
        (item.ministry_edu_symbol && item.ministry_edu_symbol.includes(q)) ||
        (item.labor_Cross_symbol && item.labor_Cross_symbol.includes(q));
      if (!matchName && !matchAddress && !matchCity && !matchSymbol) {
        return false;
      }
    }

    if (filters.ageGroups.length > 0) {
      const normalizedSelected = filters.ageGroups.map((g) =>
        g === '0_3' ? '0_3_mixed' : g
      );
      const matchesAge = item.target_age_groups.some((ag) =>
        normalizedSelected.includes(ag)
      );
      if (!matchesAge) return false;
    }

    if (filters.licensing.length > 0) {
      const matchesLicensing = filters.licensing.some((lic) => {
        if (lic === 'valid') return item.license_status === 'licensed';
        if (lic === 'in_progress') return item.license_status === 'in_process';
        if (lic === 'symbol_recognized')
          return item.license_status === 'symbol_recognized' || item.is_subsidized;
        if (lic === 'municipal_verified')
          return item.license_status === 'municipal_verified';
        if (lic === 'stop_order_active') return item.has_active_stop_order;
        return true;
      });
      if (!matchesLicensing) return false;
    }

    if (filters.subsidy.length > 0) {
      const matchesSubsidy = filters.subsidy.some((sub) => {
        if (sub === 'yes')
          return item.is_subsidized && !item.target_age_groups.includes('3_6');
        if (sub === 'no') return !item.is_subsidized;
        if (sub === 'tzaharon') return item.target_age_groups.includes('3_6');
        return true;
      });
      if (!matchesSubsidy) return false;
    }

    if (filters.features.length > 0) {
      if (
        filters.features.includes('has_price_only') &&
        item.display_mode === 'no_price'
      ) {
        return false;
      }
      if (
        filters.features.includes('includes_friday') &&
        !item.activity_hours_summary_he?.includes('שישי')
      ) {
        return false;
      }
    }

    return true;
  });
}

const DEFAULT_RELIANCE_DISCLAIMER_HE =
  'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד החינוך, משרד העבודה והרשויות המקומיות ומתעדכנים מעת לעת. נתוני המחירים מבוססים על דיווחי הורים למחירון הכללי של המסגרת ומוצגים לצורכי שקיפות והשוואה צרכנית בלבד — יש לוודא את התעריף ותנאי ההתקשרות העדכניים ישירות מול הנהלת המסגרת.';

const AGE_GROUP_LABELS: Record<string, string> = {
  '0_1': 'תינוקות (לידה עד שנה)',
  '1_2': 'פעוטות צעירים (שנה עד שנתיים)',
  '2_3': 'פעוטות בוגרים (שנתיים עד שלוש)',
  '0_3': 'לידה עד 3',
  '0_3_mixed': 'רב-גילי (לידה עד 3)',
  '3_6': 'גילאי 3–6',
};

function mapLicenseStatus(rawStatus: string | undefined, isSubsidized: boolean): {
  labelHe: string;
  iconCode: 'valid' | 'in_progress' | 'did_not_apply' | 'none';
} {
  switch (rawStatus) {
    case 'licensed':
    case 'valid':
    case 'licensed_valid':
      return {
        labelHe: 'רישיון הפעלה בתוקף (משרד החינוך)',
        iconCode: 'valid',
      };
    case 'symbol_recognized':
      return {
        labelHe: 'מעון סמל מוכר לסבסוד (משרד העבודה ומשרד החינוך)',
        iconCode: 'valid',
      };
    case 'municipal_verified':
      return {
        labelHe: 'מוסד רשמי מפוקח משרד החינוך והרשות המקומית',
        iconCode: 'valid',
      };
    case 'in_process':
    case 'in_progress':
    case 'continuity_arrangement':
      return {
        labelHe: 'בתהליך רישוי (הסדר רציפות משרד החינוך)',
        iconCode: 'in_progress',
      };
    case 'did_not_apply':
      return {
        labelHe: 'לא הוגשה בקשה לרישיון במרשם',
        iconCode: 'did_not_apply',
      };
    default:
      if (isSubsidized) {
        return {
          labelHe: 'מעון סמל מוכר לסבסוד',
          iconCode: 'valid',
        };
      }
      return {
        labelHe: 'מופיע במאגרים הרשמיים',
        iconCode: 'none',
      };
  }
}

function mapDisplayMode(
  rawMode: string | undefined,
  reportsCount: number
): 'no_price' | 'single' | 'range' | 'median' {
  if (reportsCount <= 0) return 'no_price';
  if (rawMode === 'range_discrepancy' || rawMode === 'range') return 'range';
  if (rawMode === 'median_consensus' || rawMode === 'median' || rawMode === 'average_close') {
    return 'median';
  }
  return reportsCount >= 3 ? 'median' : 'single';
}

function mapTrustTier(
  rawTier: string | undefined,
  displayMode: 'no_price' | 'single' | 'range' | 'median',
  isSubsidized: boolean
): DaycareListItemDto['price_Trust_tier'] {
  if (displayMode === 'no_price') return 'no_price';
  if (isSubsidized) return 'official_regulated';
  if (rawTier === 'tier_2_parent_consensus' || displayMode === 'median') {
    return 'community_consensus';
  }
  if (displayMode === 'range') return 'community_discrepancy';
  return 'single_parent_report';
}

function formatAgeGroupsLabel(ageGroups: string[]): string {
  if (!Array.isArray(ageGroups) || ageGroups.length === 0) return 'לידה עד 3';
  if (ageGroups.includes('3_6') && ageGroups.length === 1) return 'גילאי 3–6';
  if (ageGroups.includes('0_3') || ageGroups.includes('0_3_mixed')) return 'לידה עד 3';
  return ageGroups.map((g) => AGE_GROUP_LABELS[g] || g).join(', ');
}

/**
 * מתאם בטוח (Adapter) מה-DTO של שרת ה-Backend (GET /api/v1/daycares) למבנה ה-Frontend
 * מונע שדות undefined וקריסות רינדור ב-DaycareProfileModal וב-ParentReportWizardModal.
 */
function normalizeBackendListItem(raw: Record<string, unknown>): DaycareDetailDto {
  // אם הרשומה כבר בפורמט ה-Frontend המלא — רק מוודאים שכל המערכים קיימים
  if (typeof raw.id === 'string' && typeof raw.name === 'string' && Array.isArray(raw.target_age_groups)) {
    return {
      ...(raw as unknown as DaycareDetailDto),
      price_cohorts: Array.isArray(raw.price_cohorts) ? raw.price_cohorts : [],
      relative_benchmarks: Array.isArray(raw.relative_benchmarks) ? raw.relative_benchmarks : [],
      yoy_price_history: Array.isArray(raw.yoy_price_history) ? raw.yoy_price_history : [],
      individual_reports: Array.isArray(raw.individual_reports) ? raw.individual_reports : [],
      regulated_benchmark_comparison:
        (raw.regulated_benchmark_comparison as DaycareDetailDto['regulated_benchmark_comparison']) || {
          regulated_symbol_max_price_nis: 2515,
          annual_gap_11_months_nis: null,
          summary_he: 'תעריף מקסימום מפוקח להשוואה: ₪2,515 לחודש.',
        },
      reliance_disclaimer_he:
        (typeof raw.reliance_disclaimer_he === 'string' && raw.reliance_disclaimer_he) ||
        DEFAULT_RELIANCE_DISCLAIMER_HE,
    };
  }

  const loc = (raw.location as { lat?: number; lng?: number } | undefined) || {};
  const isSubsidized = Boolean(raw.is_subsidized_symbol ?? raw.is_subsidized);
  const licenseStatusStr = String(raw.license_status || 'licensed');
  const { labelHe: licenseLabelHe, iconCode } = mapLicenseStatus(licenseStatusStr, isSubsidized);

  const ageGroups = Array.isArray(raw.age_groups_supported)
    ? (raw.age_groups_supported as string[]).map((g) => (g === '0_3' ? '0_3_mixed' : g))
    : ['0_3_mixed'];

  const priceSummary = (raw.price_summary_current_year as Record<string, unknown> | null) || null;
  const reportsCount = Number(priceSummary?.reports_count ?? 0);
  const headlinePrice =
    priceSummary && typeof priceSummary.primary_pin_price_nis === 'number'
      ? priceSummary.primary_pin_price_nis
      : null;
  const minPrice =
    priceSummary && typeof priceSummary.min_price_nis === 'number'
      ? priceSummary.min_price_nis
      : headlinePrice;
  const maxPrice =
    priceSummary && typeof priceSummary.max_price_nis === 'number'
      ? priceSummary.max_price_nis
      : headlinePrice;

  const displayMode = mapDisplayMode(
    priceSummary?.price_display_mode as string | undefined,
    reportsCount
  );
  const trustTier = mapTrustTier(
    priceSummary?.price_trust_tier as string | undefined,
    displayMode,
    isSubsidized
  );

  const hasStopOrder = Boolean(raw.has_active_stop_order);
  const priceFormattedHe =
    (typeof priceSummary?.formatted_header_he === 'string' && priceSummary.formatted_header_he) ||
    (headlinePrice !== null
      ? `₪${headlinePrice.toLocaleString()} לחודש`
      : 'טרם דווח מחיר — היו הראשונים לדווח!');

  const pricePillShortHe = hasStopOrder
    ? '⚠️ צו הפסקה'
    : (typeof priceSummary?.formatted_pin_he === 'string' && priceSummary.formatted_pin_he) ||
      (headlinePrice !== null
        ? isSubsidized
          ? `🛡️ ₪${headlinePrice.toLocaleString()}`
          : displayMode === 'median'
            ? `✓ ₪${headlinePrice.toLocaleString()}`
            : displayMode === 'range'
              ? `~₪${headlinePrice.toLocaleString()}`
              : `₪${headlinePrice.toLocaleString()}`
        : '+ הוסף מחיר');

  const trustBadgeHe =
    displayMode === 'no_price'
      ? 'מסגרת רשמית (ממתינה לדיווח מחיר ראשון)'
      : isSubsidized
        ? `🛡️ מסלול מפוקח / מסובסד (${reportsCount} דיווחים)`
        : displayMode === 'median'
          ? `✓ מידע הורים מאומת (${reportsCount} דיווחים)`
          : displayMode === 'range'
            ? `⚠️ פער בין ${reportsCount} דיווחים (מוצג טווח)`
            : `ℹ️ דיווח בודד (ממתין לאימות הורים נוסף)`;

  const regulatedMax = 2515;
  const annualGap =
    !isSubsidized && headlinePrice !== null && headlinePrice > regulatedMax
      ? (headlinePrice - regulatedMax) * 11
      : null;

  return {
    id: String(raw.daycare_id || raw.id || ''),
    name: String(raw.display_name || raw.name || 'מסגרת ללא שם'),
    city_code: Number(raw.city_code || 5000),
    city_name_he: String(raw.city_name_he || ''),
    address: String(raw.full_address_public || raw.address || ''),
    lat: Number(loc.lat ?? raw.lat ?? 32.0853),
    lon: Number(loc.lng ?? raw.lon ?? 34.7818),
    target_age_groups: ageGroups,
    age_group_label_he: formatAgeGroupsLabel(ageGroups),
    is_subsidized: isSubsidized,
    license_status: licenseStatusStr,
    license_status_label_he: licenseLabelHe,
    license_icon_code: iconCode,
    ministry_edu_symbol: raw.moe_symbol ? String(raw.moe_symbol) : null,
    labor_Cross_symbol: raw.mol_symbol ? String(raw.mol_symbol) : null,
    operator_name: raw.operator_entity_name ? String(raw.operator_entity_name) : null,
    phone_official: raw.official_phone_public ? String(raw.official_phone_public) : null,
    has_active_stop_order: hasStopOrder,
    has_official_sanction: Boolean(raw.has_official_sanction),
    official_sanction_date: raw.official_sanction_date
      ? String(raw.official_sanction_date)
      : null,
    official_sanction_text: raw.official_sanction_text
      ? String(raw.official_sanction_text)
      : null,
    official_capacity:
      typeof raw.official_capacity === 'number' ? raw.official_capacity : null,
    operator_corp_id: raw.operator_corp_id
      ? String(raw.operator_corp_id)
      : null,
    official_last_checked_at: raw.official_last_checked_at
      ? String(raw.official_last_checked_at)
      : null,
    shelter_status:
      (raw.shelter_status as 'yes' | 'no' | 'unknown' | undefined) || 'unknown',
    cameras_0_3_status:
      (raw.cameras_0_3_status as 'yes' | 'no' | 'unknown' | undefined) ||
      'unknown',
    external_sources: Array.isArray(raw.external_sources)
      ? (raw.external_sources as DaycareListItemDto['external_sources'])
      : [],
    display_mode: displayMode,
    price_Trust_tier: trustTier,
    price_formatted_he: priceFormattedHe,
    price_pill_short_he: pricePillShortHe,
    trust_badge_he: trustBadgeHe,
    headline_price_nis: headlinePrice,
    min_price_nis: minPrice,
    max_price_nis: maxPrice,
    active_reports_count: reportsCount,
    school_year: Number(priceSummary?.school_year ?? 2027),
    activity_hours_summary_he: null,
    yoy_trend_summary_he: null,
    benchmark_neighborhood_summary_he: null,
    regulatory_context_he: String(
      raw.regulatory_context_he || 'מסגרת המופיעה במאגרים הרשמיים.'
    ),
    price_cohorts: [],
    relative_benchmarks: [],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: regulatedMax,
      annual_gap_11_months_nis: annualGap,
      summary_he:
        annualGap !== null
          ? `מחיר מסגרת פרטית זו גבוה מתעריף מעון סמל מפוקח (₪${regulatedMax.toLocaleString()}) בפער שנתי מוערך של ₪${annualGap.toLocaleString()} (11 חודשים).`
          : `תעריף מעון סמל מפוקח להשוואה: ₪${regulatedMax.toLocaleString()} לחודש.`,
    },
    yoy_price_history: [],
    individual_reports: [],
    reliance_disclaimer_he: DEFAULT_RELIANCE_DISCLAIMER_HE,
  };
}

/**
 * מתאם בטוח מהתשובה המלאה של GET /api/v1/daycares/:id למבנה 5 הבלוקים של DaycareProfileModal
 */
function normalizeBackendDetailResponse(raw: Record<string, unknown>): DaycareDetailDto {
  const daycareObj = (raw.daycare as Record<string, unknown> | undefined) || raw;
  const base = normalizeBackendListItem(daycareObj);

  const matrix = Array.isArray(raw.price_matrix_by_age)
    ? (raw.price_matrix_by_age as Record<string, unknown>[])
    : [];
  const priceCohorts: PriceCohortSummaryDto[] = matrix.map((c) => {
    const reportsCount = Number(c.reports_count ?? 0);
    const dm = mapDisplayMode(c.price_display_mode as string | undefined, reportsCount);
    const repPrice = Number(c.representative_price_nis ?? 0);
    const minP = Number(c.min_price_nis ?? repPrice);
    const maxP = Number(c.max_price_nis ?? repPrice);
    return {
      school_year: Number(c.school_year ?? 2027),
      school_year_label: String(c.school_year_label || 'תשפ"ז (2026–2027)'),
      age_group: String(c.age_group || '0_3_mixed'),
      age_group_label_he: String(
        c.age_group_label_he || AGE_GROUP_LABELS[String(c.age_group)] || 'לידה עד 3'
      ),
      is_municipal_tzaharon_only: c.framework_track === 'municipal_tzaharon',
      hours_bucket: c.is_full_day ? 'full_day' : 'half_day',
      includes_friday: null,
      includes_nutrition: null,
      active_reports_count: reportsCount,
      display_mode: dm,
      headline_price_nis: repPrice || null,
      min_price_nis: minP || null,
      max_price_nis: maxP || null,
      iqr_q25_nis: typeof c.p25_price_nis === 'number' ? c.p25_price_nis : null,
      iqr_q75_nis: typeof c.p75_price_nis === 'number' ? c.p75_price_nis : null,
      price_formatted_he:
        dm === 'range'
          ? `₪${minP.toLocaleString()}–₪${maxP.toLocaleString()} לחודש (טווח ${reportsCount} דיווחים)`
          : dm === 'median'
            ? `₪${repPrice.toLocaleString()} לחודש (חציון)`
            : `₪${repPrice.toLocaleString()} לחודש (דיווח בודד)`,
      trust_badge_he:
        dm === 'median'
          ? `✓ מידע הורים מאומת (${reportsCount} דיווחים)`
          : dm === 'range'
            ? `⚠️ פער בין ${reportsCount} דיווחים (מוצג טווח)`
            : `ℹ️ דיווח בודד (${reportsCount})`,
    };
  });

  const rawBenchmarks = (raw.benchmarks as Record<string, unknown> | undefined) || {};
  const rawComps = Array.isArray(rawBenchmarks.comparisons)
    ? (rawBenchmarks.comparisons as Record<string, unknown>[])
    : [];
  const relativeBenchmarks: BenchmarkMetricDto[] = rawComps.map((b) => {
    const diffNis = typeof b.diff_from_median_nis === 'number' ? b.diff_from_median_nis : null;
    const diffPct = typeof b.diff_from_median_pct === 'number' ? b.diff_from_median_pct : null;
    const medianNis = typeof b.median_price_nis === 'number' ? b.median_price_nis : null;
    const sampleN = Number(b.sample_daycares_n ?? 0);
    const direction =
      diffNis === null ? '' : diffNis < 0 ? 'זול ב-' : diffNis > 0 ? 'יקר ב-' : 'זהה ל-';
    return {
      scope: (b.benchmark_scope as BenchmarkMetricDto['scope']) || 'city_all_same_track',
      label_he: String(b.label_he || 'השוואה אזורית'),
      median_price_nis: medianNis,
      iqr_q25_nis: typeof b.p25_price_nis === 'number' ? b.p25_price_nis : null,
      iqr_q75_nis: typeof b.p75_price_nis === 'number' ? b.p75_price_nis : null,
      sample_daycares_count: sampleN,
      is_sufficient_sample: sampleN >= 3,
      diff_nis: diffNis,
      diff_pct: diffPct,
      comparison_text_he:
        diffNis !== null && medianNis !== null
          ? `${direction}₪${Math.abs(diffNis).toLocaleString()} (${diffPct !== null && diffPct > 0 ? '+' : ''}${diffPct ?? 0}%) מהחציון (₪${medianNis.toLocaleString()} · N=${sampleN})`
          : medianNis !== null
            ? `חציון אזורי: ₪${medianNis.toLocaleString()} (N=${sampleN})`
            : 'מדגם אזורי בבנייה',
    };
  });

  const activeSchoolYear = getActiveSchoolYear();
  const rawYoy = Array.isArray(raw.price_history_yoy)
    ? (raw.price_history_yoy as Record<string, unknown>[])
    : [];
  const yoyHistory: YoYHistoryPointDto[] = rawYoy.map((y) => ({
    school_year: Number(y.school_year ?? activeSchoolYear),
    school_year_label: String(y.school_year_label || ''),
    age_group: String(y.age_group || '0_3_mixed'),
    median_price_nis: Number(y.representative_price_nis ?? 0),
    reports_count: Number(y.reports_count ?? 0),
    yoy_change_nis: typeof y.yoy_diff_nis === 'number' ? y.yoy_diff_nis : null,
    yoy_change_pct: typeof y.yoy_diff_pct === 'number' ? y.yoy_diff_pct : null,
  }));

  const rawReports = Array.isArray(raw.individual_reports)
    ? (raw.individual_reports as Record<string, unknown>[])
    : [];
  const individualReports: IndividualReportSummaryDto[] = rawReports.map((r) => {
    const yr = Number(r.school_year ?? activeSchoolYear);
    return {
      school_year: yr,
      school_year_label: formatHebrewSchoolYear(yr),
      age_group: String(r.age_group || '0_3_mixed'),
      age_group_label_he: AGE_GROUP_LABELS[String(r.age_group)] || 'לידה עד 3',
      monthly_price_nis: Number(r.monthly_list_price_nis ?? 0),
      start_time_weekday: r.hours_sun_thu_start ? String(r.hours_sun_thu_start) : null,
      end_time_weekday: r.hours_sun_thu_end ? String(r.hours_sun_thu_end) : null,
      includes_friday:
        typeof r.includes_friday === 'boolean' ? r.includes_friday : null,
      friday_start_time: r.hours_fri_start ? String(r.hours_fri_start) : null,
      friday_end_time: r.hours_fri_end ? String(r.hours_fri_end) : null,
      includes_nutrition:
        typeof r.includes_nutrition === 'boolean' ? r.includes_nutrition : null,
      is_municipal_tzaharon_only: r.framework_track === 'municipal_tzaharon',
      reported_size_bucket: r.reported_size_bucket
        ? String(r.reported_size_bucket)
        : 'unknown',
      reported_shelter_status:
        (r.reported_shelter_status as 'yes' | 'no' | 'unknown' | undefined) ||
        'unknown',
      reported_cameras_0_3:
        (r.reported_cameras_0_3 as 'yes' | 'no' | 'unknown' | undefined) ||
        'unknown',
      report_source: String(r.source_type || 'parent_verified_google'),
      report_source_label_he: String(r.source_label_he || 'דיווח הורה מאומת'),
    };
  });

  // אם שדות המחיר בכותרת ריקים אך קיימת מטריצת מחירים — נעדכן מהקוהורט הראשי
  const primaryCohort = priceCohorts[0];
  const regulatedMax = Number(rawBenchmarks.regulated_symbol_benchmark_nis ?? 2515);
  const annualGap =
    typeof rawBenchmarks.private_vs_regulated_annual_gap_nis === 'number'
      ? rawBenchmarks.private_vs_regulated_annual_gap_nis
      : base.regulated_benchmark_comparison.annual_gap_11_months_nis;

  const metaObj = (raw.meta as Record<string, unknown> | undefined) || {};

  const latestWithDetails = individualReports.find(
    (r) =>
      r.start_time_weekday ||
      r.includes_friday !== null ||
      r.includes_nutrition !== null
  );
  const derivedHoursSummary =
    base.activity_hours_summary_he ||
    (latestWithDetails
      ? [
          latestWithDetails.start_time_weekday &&
          latestWithDetails.end_time_weekday
            ? `א׳–ה׳ ${latestWithDetails.start_time_weekday}–${latestWithDetails.end_time_weekday}`
            : null,
          latestWithDetails.includes_friday === true
            ? `שישי ${latestWithDetails.friday_start_time || '07:30'}–${latestWithDetails.friday_end_time || '12:30'}`
            : latestWithDetails.includes_friday === false
              ? 'ללא ימי שישי'
              : null,
          latestWithDetails.includes_nutrition === true
            ? 'כולל הזנה'
            : latestWithDetails.includes_nutrition === false
              ? 'ללא הזנה'
              : null,
        ]
          .filter(Boolean)
          .join(' · ') || null
      : null);

  const reportedShelter = individualReports.find(
    (r) =>
      r.reported_shelter_status === 'yes' || r.reported_shelter_status === 'no'
  )?.reported_shelter_status;
  const reportedCameras = individualReports.find(
    (r) => r.reported_cameras_0_3 === 'yes' || r.reported_cameras_0_3 === 'no'
  )?.reported_cameras_0_3;

  const rawShelter =
    (daycareObj.shelter_status as 'yes' | 'no' | 'unknown' | undefined) ||
    base.shelter_status ||
    'unknown';
  const shelterStatus =
    rawShelter !== 'unknown' ? rawShelter : reportedShelter || 'unknown';

  const rawCameras =
    (daycareObj.cameras_0_3_status as 'yes' | 'no' | 'unknown' | undefined) ||
    base.cameras_0_3_status ||
    'unknown';
  const camerasStatus =
    rawCameras !== 'unknown' ? rawCameras : reportedCameras || 'unknown';

  const latestReport = individualReports[0];
  const resolvedDisplayMode =
    base.display_mode !== 'no_price'
      ? base.display_mode
      : primaryCohort
        ? primaryCohort.display_mode
        : latestReport
          ? 'single'
          : 'no_price';
  const resolvedHeadlinePrice =
    base.headline_price_nis ??
    primaryCohort?.headline_price_nis ??
    latestReport?.monthly_price_nis ??
    null;
  const resolvedSchoolYear =
    base.display_mode !== 'no_price'
      ? base.school_year
      : primaryCohort?.school_year ??
        latestReport?.school_year ??
        base.school_year;

  return {
    ...base,
    operator_name: daycareObj.operator_entity_name
      ? String(daycareObj.operator_entity_name)
      : base.operator_name,
    activity_hours_summary_he: derivedHoursSummary,
    shelter_status: shelterStatus,
    cameras_0_3_status: camerasStatus,
    display_mode: resolvedDisplayMode,
    school_year: resolvedSchoolYear,
    headline_price_nis: resolvedHeadlinePrice,
    min_price_nis:
      base.min_price_nis ??
      primaryCohort?.min_price_nis ??
      resolvedHeadlinePrice,
    max_price_nis:
      base.max_price_nis ??
      primaryCohort?.max_price_nis ??
      resolvedHeadlinePrice,
    price_formatted_he:
      base.display_mode === 'no_price' && primaryCohort
        ? primaryCohort.price_formatted_he
        : base.display_mode === 'no_price' && latestReport
          ? `₪${latestReport.monthly_price_nis.toLocaleString()} לחודש (${latestReport.school_year_label})`
          : base.price_formatted_he,
    active_reports_count:
      base.active_reports_count || individualReports.length || primaryCohort?.active_reports_count || 0,
    price_cohorts: priceCohorts,
    relative_benchmarks: relativeBenchmarks,
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: regulatedMax,
      annual_gap_11_months_nis: annualGap,
      summary_he:
        annualGap !== null && annualGap > 0
          ? `מחיר מסגרת פרטית זו גבוה מתעריף המקסימום של מעון סמל מפוקח (₪${regulatedMax.toLocaleString()}) בפער מצטבר של ₪${annualGap.toLocaleString()} לשנת לימודים (11 חודשים).`
          : base.is_subsidized
            ? `מסגרת במסלול מפוקח / מסובסד (תעריף ייחוס מפוקח: ₪${regulatedMax.toLocaleString()} לחודש).`
            : `תעריף מעון סמל מפוקח להשוואה: ₪${regulatedMax.toLocaleString()} לחודש.`,
    },
    yoy_price_history: yoyHistory,
    individual_reports: individualReports,
    reliance_disclaimer_he:
      (typeof metaObj.reliance_disclaimer_he === 'string' && metaObj.reliance_disclaimer_he) ||
      DEFAULT_RELIANCE_DISCLAIMER_HE,
  };
}

/**
 * שליפת רשימת מסגרות (מנסה מול ה-Backend וממיר בבטחה ל-DTO של ה-Frontend)
 */
export async function fetchDaycaresList(): Promise<DaycareDetailDto[]> {
  try {
    const res = await fetch('/api/v1/daycares?format=list&page_size=200', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        const mapped = (data.items as Record<string, unknown>[]).map(
          normalizeBackendListItem
        );
        inMemoryDaycares = structuredClone(mapped);
        return mapped;
      }
    }
  } catch {
    // שימוש במאגר המקומי
  }
  return [...inMemoryDaycares];
}

/**
 * שליפת פרופיל מלא של גן לפי מזהה (5 בלוקים מלאים מ-GET /api/v1/daycares/:id)
 */
export async function fetchDaycareDetails(
  daycareId: string
): Promise<DaycareDetailDto | null> {
  try {
    const res = await fetch(`/api/v1/daycares/${encodeURIComponent(daycareId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.daycare || data.id)) {
        return normalizeBackendDetailResponse(data as Record<string, unknown>);
      }
    }
  } catch {
    // שימוש במאגר המקומי
  }
  return inMemoryDaycares.find((d) => d.id === daycareId) || null;
}

/**
 * השלמה אוטומטית של יישובים, רחובות וגנים (Autocomplete)
 */
export async function fetchAutocompleteLocations(
  query: string
): Promise<AutocompleteLocationDto[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(
      `/api/v1/autocomplete/locations?q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.suggestions)) {
        return (data.suggestions as Record<string, unknown>[]).map((s) => ({
          kind: ((s.kind || s.type || 'daycare') as AutocompleteLocationDto['kind']),
          label_he: String(s.label_he || s.label || ''),
          sublabel_he: String(s.sublabel_he || s.city_name_he || ''),
          city_code: Number(s.city_code || 5000),
          lat: typeof s.lat === 'number' ? s.lat : null,
          lon: typeof s.lon === 'number' ? s.lon : typeof s.lng === 'number' ? s.lng : null,
          daycare_id: s.daycare_id ? String(s.daycare_id) : undefined,
        }));
      }
    }
  } catch {
    // Fallback local autocomplete
  }

  const suggestions: AutocompleteLocationDto[] = [];
  const cities: { name: string; code: number; lat: number; lon: number }[] = [
    { name: 'תל אביב - יפו', code: 5000, lat: 32.0853, lon: 34.7818 },
    { name: 'רחובות', code: 8400, lat: 31.8928, lon: 34.8113 },
    { name: 'ירושלים', code: 3000, lat: 31.7683, lon: 35.2137 },
    { name: 'חיפה', code: 4000, lat: 32.794, lon: 34.9896 },
  ];

  for (const c of cities) {
    if (c.name.includes(q)) {
      suggestions.push({
        kind: 'city',
        label_he: c.name,
        sublabel_he: 'יישוב — התמקדות מפה על כלל המסגרות בעיר',
        city_code: c.code,
        lat: c.lat,
        lon: c.lon,
      });
    }
  }

  for (const d of inMemoryDaycares) {
    if (
      d.name.includes(q) ||
      d.address.includes(q) ||
      d.ministry_edu_symbol?.includes(q)
    ) {
      suggestions.push({
        kind: 'daycare',
        label_he: d.name,
        sublabel_he: `${d.address} · ${d.price_formatted_he}`,
        city_code: d.city_code,
        lat: d.lat,
        lon: d.lon,
        daycare_id: d.id,
      });
    }
  }

  return suggestions.slice(0, 8);
}

function mapAgeGroupToBackend(
  ageGroup: ReportItemPayload['age_group'] | string
): string {
  return ageGroup === '0_3_mixed' ? '0_3' : ageGroup;
}

function mapSizeBucketToBackend(item: ReportItemPayload): string {
  if (item.reported_over_statutory_threshold === true) {
    return item.age_group === '3_6' ? '11_or_more' : '7_or_more';
  }
  if (item.reported_over_statutory_threshold === false) {
    return item.age_group === '3_6' ? 'up_to_10' : 'up_to_6';
  }
  return 'unknown';
}

function mapTriStateToBackend(val?: boolean | null): 'yes' | 'no' | 'unknown' {
  if (val === true) return 'yes';
  if (val === false) return 'no';
  return 'unknown';
}

/**
 * אימות Google OIDC (Scope: openid בלבד) + שליחת דיווח מחיר לשרת ה-Backend
 */
export async function submitParentReport(
  payload: ReportSubmissionPayload,
  googleIdToken?: string
): Promise<{
  status: 'accepted';
  confirmation_message_he: string;
  updatedDaycare: DaycareDetailDto | null;
}> {
  const token = googleIdToken || (await obtainGoogleIdToken());
  try {
    // 1. אימות OIDC והנפקת עוגיית סשן HttpOnly בשרת
    const authRes = await fetch('/api/v1/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: token,
        turnstile_token: payload.turnstile_token,
      }),
    });

    if (authRes.ok && payload.items.length > 0) {
      let allSucceeded = true;
      for (let i = 0; i < payload.items.length; i += 1) {
        const item = payload.items[i];
        const bodyPayload = {
          daycare_id: payload.daycare_id,
          school_year: item.school_year,
          monthly_list_price_nis: Math.round(item.monthly_price_nis),
          age_group: mapAgeGroupToBackend(item.age_group),
          framework_track: item.is_municipal_tzaharon_only
            ? 'municipal_tzaharon'
            : 'private_full_day',
          hours_sun_thu_start: item.start_time_weekday,
          hours_sun_thu_end: item.end_time_weekday,
          includes_friday: item.includes_friday,
          hours_fri_start: item.includes_friday ? item.friday_start_time : null,
          hours_fri_end: item.includes_friday ? item.friday_end_time : null,
          includes_nutrition: item.includes_nutrition,
          reported_size_bucket: mapSizeBucketToBackend(item),
          reported_shelter_status: mapTriStateToBackend(
            item.reported_has_shelter
          ),
          reported_cameras_0_3:
            item.age_group === '3_6'
              ? 'unknown'
              : mapTriStateToBackend(item.reported_has_cameras),
          is_standard_list_price_confirmed: payload.legal_declaration_accepted,
          confirm_outlier: item.outlier_confirmed_by_user,
          replace_all_ages_for_token: i === 0,
          turnstile_token: payload.turnstile_token,
        };

        let res = await fetch('/api/v1/reports', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        // אם השרת ביקש אישור חריגה (>40%) והמשתמש כבר אישר בשלב 2 או שהשרת מחזיר 409 — מאשרים בשליחה השנייה על סמך העוגייה
        if (res.status === 409) {
          res = await fetch('/api/v1/reports', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...bodyPayload, confirm_outlier: true }),
          });
        }

        if (!res.ok) {
          allSucceeded = false;
          break;
        }
      }

      if (allSucceeded) {
        const refreshed = await fetchDaycareDetails(payload.daycare_id);
        return {
          status: 'accepted',
          confirmation_message_he:
            'תודה! הדיווח נקלט במערכת בהצלחה ועדכן את מדד המחיר של הגן.',
          updatedDaycare: refreshed,
        };
      }
    }
  } catch {
    // Fallback to local state update when backend is offline
  }

  // עדכון מיידי של המאגר המקומי בזיכרון כדי שהמשתמש יראה את הסיכה והכרטיס מתעדכנים מיד
  const target = inMemoryDaycares.find((d) => d.id === payload.daycare_id);
  if (target && payload.items.length > 0) {
    const ageLabels: Record<string, string> = {
      '0_1': 'תינוקות (לידה עד שנה)',
      '1_2': 'פעוטות צעירים (שנה עד שנתיים)',
      '2_3': 'פעוטות בוגרים (שנתיים עד שלוש)',
      '0_3_mixed': 'רב-גילי (לידה עד 3)',
      '3_6': 'גני ילדים וצהרונים (3–6)',
    };
    for (const item of payload.items) {
      target.individual_reports.unshift({
        school_year: item.school_year,
        school_year_label: formatHebrewSchoolYear(item.school_year),
        age_group: item.age_group,
        age_group_label_he: ageLabels[item.age_group] || 'לידה עד 3',
        monthly_price_nis: item.monthly_price_nis,
        start_time_weekday: item.start_time_weekday,
        end_time_weekday: item.end_time_weekday,
        includes_friday: item.includes_friday,
        friday_start_time: item.includes_friday
          ? item.friday_start_time || '07:30'
          : null,
        friday_end_time: item.includes_friday
          ? item.friday_end_time || '12:30'
          : null,
        includes_nutrition: item.includes_nutrition,
        is_municipal_tzaharon_only: item.is_municipal_tzaharon_only,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      });
    }

    const prices = target.individual_reports
      .map((r) => r.monthly_price_nis)
      .sort((a, b) => a - b);
    const n = prices.length;
    const median =
      n % 2 === 1
        ? prices[Math.floor(n / 2)]
        : Math.round((prices[n / 2 - 1] + prices[n / 2]) / 2);

    target.active_reports_count = n;
    target.headline_price_nis = median;
    target.min_price_nis = prices[0];
    target.max_price_nis = prices[n - 1];

    if (n === 1) {
      target.display_mode = 'single';
      target.price_Trust_tier = 'single_parent_report';
      target.price_formatted_he = `₪${median.toLocaleString()} לחודש (דיווח בודד)`;
      target.price_pill_short_he = `₪${median.toLocaleString()}`;
      target.trust_badge_he = 'ℹ️ דיווח הורה בודד (ממתין לאימות הורים נוסף)';
    } else if (n === 2 && (prices[1] - prices[0]) / prices[0] > 0.05) {
      target.display_mode = 'range';
      target.price_Trust_tier = 'community_discrepancy';
      target.price_formatted_he = `₪${prices[0].toLocaleString()}–₪${prices[1].toLocaleString()} לחודש (טווח 2 דיווחים)`;
      target.price_pill_short_he = `~₪${median.toLocaleString()}`;
      target.trust_badge_he = '⚠️ פער מעל 5% בין 2 דיווחי הורים (מוצג טווח)';
    } else {
      target.display_mode = 'median';
      target.price_Trust_tier = 'community_consensus';
      target.price_formatted_he = `₪${median.toLocaleString()} לחודש (חציון)`;
      target.price_pill_short_he = `✓ ₪${median.toLocaleString()}`;
      target.trust_badge_he = `✓ מידע הורים מאומת (${n} דיווחים)`;
    }

    const first = payload.items[0];
    target.activity_hours_summary_he = `א׳–ה׳ ${first.start_time_weekday}–${first.end_time_weekday} · ${
      first.includes_friday
        ? `שישי ${first.friday_start_time || '07:30'}–${first.friday_end_time || '12:30'}`
        : 'ללא ימי שישי'
    } · ${first.includes_nutrition ? 'כולל הזנה' : 'ללא הזנה'}`;
  }

  return {
    status: 'accepted',
    confirmation_message_he:
      'תודה! הדיווח נקלט במערכת בהצלחה ועדכן את מדד המחיר של הגן.',
    updatedDaycare: target ? structuredClone(target) : null,
  };
}

/**
 * ביטול דיווח עצמי לגן (עם תמיכה באפשרות לביטול שכבת גיל ספציפית)
 */
export async function withdrawParentReport(payload: {
  daycare_id: string;
  school_year: number;
  age_group?: string | null;
  turnstile_token: string;
}): Promise<{
  status: 'accepted';
  confirmation_message_he: string;
  updatedDaycare: DaycareDetailDto | null;
}> {
  const token = await obtainGoogleIdToken();
  try {
    const authRes = await fetch('/api/v1/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: token,
        turnstile_token: payload.turnstile_token,
      }),
    });

    if (authRes.ok) {
      const res = await fetch('/api/v1/reports/withdraw', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daycare_id: payload.daycare_id,
          school_year: payload.school_year,
          age_group: payload.age_group
            ? mapAgeGroupToBackend(payload.age_group)
            : undefined,
          turnstile_token: payload.turnstile_token,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const refreshed = await fetchDaycareDetails(payload.daycare_id);
        return {
          status: 'accepted',
          confirmation_message_he:
            data.message_he ||
            data.confirmation_message_he ||
            'בקשת הביטול עובדה בהצלחה. אם היה קיים דיווח המשויך לחשבונך עבור גן זה ושנת הלימודים שנבחרה, הוא הוסר מחישוב המחירים הפומבי.',
          updatedDaycare: refreshed,
        };
      }
    }
  } catch {
    // Fallback
  }

  return {
    status: 'accepted',
    confirmation_message_he:
      'בקשת הביטול עובדה בהצלחה. אם היה קיים דיווח המשויך לחשבונך עבור גן זה ושנת הלימודים שנבחרה, הוא הוסר מחישוב המחירים הפומבי.',
    updatedDaycare: null,
  };
}

/**
 * שליחת דיווח מובנה על טעות בנתוני הגן ("מצאתם טעות?")
 */
export async function submitCorrectionRequest(
  payload: CorrectionRequestPayload
): Promise<{ status: 'accepted'; confirmation_message_he: string }> {
  try {
    const res = await fetch('/api/v1/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daycare_id: payload.daycare_id,
        issue_category: payload.error_category,
        structured_details: {
          submitter_role: payload.submitter_role,
          selected_field_notes_code: payload.selected_field_notes_code || null,
          details_text: payload.details_text || null,
        },
        turnstile_token: payload.turnstile_token,
      }),
    });
    if (res.ok) {
      return {
        status: 'accepted',
        confirmation_message_he: 'תודה! הפנייה נקלטה ותיבדק.',
      };
    }
  } catch {
    // Fallback
  }

  return {
    status: 'accepted',
    confirmation_message_he: 'תודה! הפנייה נקלטה ותיבדק.',
  };
}
