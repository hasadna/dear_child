import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { stripMobilePhoneForBulkExport } from '../config/meta-envelope.js';
import {
  haversineDistanceMeters,
  trigramSimilarity,
} from '../etl/csv-utils.js';
import {
  DaycareAgeGroup,
  DaycareLicenseStatus,
  normalizeDaycareName,
} from '../etl/facilities-resolver.js';
import {
  ExternalSourceProvenance,
  FrameworkTrack,
  LicensingRegime,
} from '../etl/official-sources-parsers.js';
import {
  AGE_GROUP_LABELS_HE,
  buildFormattedPriceSummary,
  buildRegulatoryContextHe,
  formatSchoolYearLabel,
  PriceAggregateSummary,
} from '../services/regulatory-formatter.js';
import {
  BASELINE_ISRAEL_CITIES,
  BASELINE_REGULATED_BENCHMARKS,
  normalizeCityName,
  normalizeStreetName,
} from './seed-dictionaries.js';
import { getActiveSchoolYear } from '../utils/school-years.js';

export type TriStateStatus = 'yes' | 'no' | 'unknown';
export type SizeBucket =
  | 'up_to_6'
  | '7_or_more'
  | 'up_to_10'
  | '11_or_more'
  | 'unknown';
export type ReportSourceType =
  | 'parent_google_oidc'
  | 'community_sheet_tlv_seed'
  | 'regulated_tariff_table'
  | 'parent_sms_voice_otp'
  | 'owner_claim_declared';

export interface DaycareSearchQuery {
  city_code?: number;
  city_name_he?: string;
  lat?: number;
  lng?: number;
  radius_m?: number;
  bbox?: string;
  school_year?: number;
  age_group?: DaycareAgeGroup;
  framework_track?: FrameworkTrack;
  is_full_day?: boolean;
  min_price?: number;
  max_price?: number;
  has_price_only?: boolean;
  license_status?: DaycareLicenseStatus;
  is_subsidized_symbol?: boolean;
  includes_friday?: boolean;
  shelter_status?: TriStateStatus;
  q?: string;
  sort_by?: 'distance' | 'price_asc' | 'price_desc' | 'reports_desc' | 'name';
  page?: number;
  page_size?: number;
  format?: 'list' | 'map_pins';
}

export interface DaycareListItemDto {
  daycare_id: string;
  external_facility_id: string | null;
  moe_symbol: string | null;
  mol_symbol: string | null;
  display_name: string;
  city_code: number;
  city_name_he: string;
  neighborhood_he: string | null;
  full_address_public: string;
  is_location_approximated: boolean;
  location: { lat: number; lng: number };
  age_groups_supported: DaycareAgeGroup[];
  primary_track: FrameworkTrack;
  licensing_regime: LicensingRegime;
  license_status: DaycareLicenseStatus;
  is_subsidized_symbol: boolean;
  has_active_stop_order: boolean;
  has_official_sanction: boolean;
  official_phone_public: string | null;
  shelter_status: TriStateStatus;
  official_last_checked_at: string;
  regulatory_context_he: string;
  price_summary_current_year: PriceAggregateSummary | null;
}

export interface CompactMapPinDto {
  id: string;
  name: string;
  city_code: number;
  lat: number;
  lng: number;
  track: FrameworkTrack;
  license_status: DaycareLicenseStatus;
  subsidized: boolean;
  stop_order: boolean;
  sanction: boolean;
  price_nis: number | null;
  pin_label: string;
  tilde: boolean;
  reports_count: number;
  trust_tier: 'tier_2_parent_consensus' | 'tier_3_unverified_report' | null;
  relative_level:
    | 'subsidized_regulated'
    | 'below_median_10pct'
    | 'around_median'
    | 'above_median_10pct'
    | 'no_price';
}

export interface DaycareDetailDto {
  daycare: {
    daycare_id: string;
    external_facility_id: string | null;
    moe_symbol: string | null;
    mol_symbol: string | null;
    display_name: string;
    official_registry_name: string | null;
    operator_entity_name: string | null;
    operator_corp_id: string | null;
    city_code: number;
    city_name_he: string;
    neighborhood_he: string | null;
    full_address_public: string;
    is_location_approximated: boolean;
    location: { lat: number; lng: number };
    official_phone_public: string | null;
    official_capacity: number | null;
    age_groups_supported: DaycareAgeGroup[];
    primary_track: FrameworkTrack;
    licensing_regime: LicensingRegime;
    license_status: DaycareLicenseStatus;
    is_official_source: boolean;
    is_subsidized_symbol: boolean;
    trust_tier: 'tier_1_official';
    has_active_stop_order: boolean;
    has_official_sanction: boolean;
    official_sanction_date: string | null;
    official_sanction_text: string | null;
    shelter_status: TriStateStatus;
    cameras_0_3_status: TriStateStatus;
    official_last_checked_at: string;
    regulatory_context_he: string;
    external_sources: {
      source_system: string;
      external_record_id: string;
      source_license: string;
      last_synced_at: string;
    }[];
  };
  price_matrix_by_age: {
    school_year: number;
    school_year_label: string;
    age_group: DaycareAgeGroup;
    age_group_label_he: string;
    framework_track: FrameworkTrack;
    is_full_day: boolean;
    reports_count: number;
    live_verified_reports_count: number;
    price_display_mode:
      | 'single'
      | 'range_discrepancy'
      | 'average_close'
      | 'median_consensus';
    representative_price_nis: number;
    min_price_nis: number;
    max_price_nis: number;
    median_price_nis: number;
    p25_price_nis: number;
    p75_price_nis: number;
    price_trust_tier: 'tier_2_parent_consensus' | 'tier_3_unverified_report';
    last_updated_month: string;
  }[];
  price_history_yoy: {
    school_year: number;
    school_year_label: string;
    age_group: DaycareAgeGroup;
    is_full_day: boolean;
    representative_price_nis: number;
    reports_count: number;
    yoy_diff_nis: number | null;
    yoy_diff_pct: number | null;
    cumulative_diff_nis: number | null;
    cumulative_diff_pct: number | null;
  }[];
  benchmarks: {
    target_price_nis: number | null;
    regulated_symbol_benchmark_nis: number;
    private_vs_regulated_annual_gap_nis: number | null;
    comparisons: {
      benchmark_scope:
        | 'radius_1km'
        | 'city_all_same_track'
        | 'city_similar_params';
      label_he: string;
      sample_daycares_n: number;
      median_price_nis: number;
      p25_price_nis: number;
      p75_price_nis: number;
      diff_from_median_nis: number;
      diff_from_median_pct: number;
    }[];
  };
  individual_reports: {
    submission_id: string;
    school_year: number;
    school_year_label: string;
    source_type: ReportSourceType;
    source_label_he: string;
    monthly_list_price_nis: number;
    age_group: DaycareAgeGroup;
    framework_track: FrameworkTrack;
    hours_sun_thu_start: string | null;
    hours_sun_thu_end: string | null;
    is_full_day: boolean;
    includes_friday: boolean | null;
    hours_fri_start: string | null;
    hours_fri_end: string | null;
    includes_nutrition: boolean | null;
    reported_size_bucket: SizeBucket;
    reported_shelter_status: TriStateStatus;
    reported_cameras_0_3: TriStateStatus;
  }[];
}

export interface AreaStatsDto {
  city_code: number;
  city_name_he: string;
  school_year: number;
  school_year_label: string;
  framework_track: FrameworkTrack;
  age_group: DaycareAgeGroup | 'all';
  total_official_daycares: number;
  daycares_with_price_reports: number;
  subsidized_daycares_count: number;
  private_daycares_count: number;
  median_price_nis: number | null;
  p25_price_nis: number | null;
  p75_price_nis: number | null;
  min_price_nis: number | null;
  max_price_nis: number | null;
  regulated_benchmark_nis: number;
  annual_gap_vs_regulated_nis: number | null;
}

export interface AutocompleteLocationDto {
  kind: 'city' | 'street' | 'daycare';
  id: string;
  label_he: string;
  city_code: number;
  city_name_he: string;
  lat: number;
  lng: number;
}

export interface BlindReportSubmissionInput {
  daycareId: string;
  schoolYear: number;
  dedupToken: string;
  quotaHash: string;
  reportedMonth: string;
  monthlyListPriceNis: number;
  ageGroup: DaycareAgeGroup;
  frameworkTrack: FrameworkTrack;
  hoursSunThuStart: string;
  hoursSunThuEnd: string;
  includesFriday: boolean;
  hoursFriStart: string | null;
  hoursFriEnd: string | null;
  includesNutrition: boolean;
  reportedSizeBucket: SizeBucket;
  reportedShelterStatus: TriStateStatus;
  reportedCameras03: TriStateStatus;
  isStandardListPriceConfirmed: boolean;
  isOutlierConfirmedByUser: boolean;
  replaceAllAgesForToken: boolean;
}

export interface CorrectionRequestRecord {
  request_id: string;
  daycare_id: string;
  issue_category:
    | 'wrong_price_outlier'
    | 'daycare_closed'
    | 'wrong_address_or_location'
    | 'wrong_license_status'
    | 'other_factual_error';
  structured_details: Record<string, unknown>;
  status: 'pending' | 'resolved' | 'rejected';
  reported_month: string;
}

export interface DaycareRepository {
  searchDaycares(query: DaycareSearchQuery): Promise<{
    totalCount: number;
    cityMedianPriceNis: number | null;
    items: DaycareListItemDto[];
    mapPins?: CompactMapPinDto[];
  }>;
  getDaycareDetails(
    daycareIdOrSymbol: string,
    schoolYear?: number
  ): Promise<DaycareDetailDto | null>;
  getAreaPriceStats(params: {
    city_code?: number;
    city_name_he?: string;
    neighborhood_he?: string;
    age_group?: DaycareAgeGroup;
    framework_track?: FrameworkTrack;
    school_year?: number;
  }): Promise<AreaStatsDto | null>;
  autocompleteLocations(params: {
    q: string;
    city_code?: number;
    limit?: number;
  }): Promise<AutocompleteLocationDto[]>;
  getSanityCheckReferenceMedian(params: {
    daycareId: string;
    schoolYear: number;
    frameworkTrack: FrameworkTrack;
    ageGroup: DaycareAgeGroup;
  }): Promise<number>;
  submitParentReportBlindUpsert(
    input: BlindReportSubmissionInput
  ): Promise<boolean>;
  withdrawParentReportBlind(params: {
    daycareId: string;
    schoolYear: number;
    dedupToken: string;
    ageGroup?: DaycareAgeGroup | null;
  }): Promise<boolean>;
  createCorrectionRequest(params: {
    daycareId: string;
    issueCategory: CorrectionRequestRecord['issue_category'];
    structuredDetails: Record<string, unknown>;
    reportedMonth: string;
  }): Promise<string>;
  listCorrectionRequests(
    status?: CorrectionRequestRecord['status']
  ): Promise<CorrectionRequestRecord[]>;
  resolveCorrectionRequest(params: {
    requestId: string;
    newStatus: 'resolved' | 'rejected';
    hideSubmissionId?: string;
  }): Promise<boolean>;
}

function computePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const pos = (sortedValues.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1] ?? sortedValues[base];
  return Math.round(sortedValues[base] + rest * (next - sortedValues[base]));
}

interface StoredSubmission {
  submission_id: string;
  daycare_id: string;
  school_year: number;
  dedup_token: string | null;
  source_type: ReportSourceType;
  reported_month: string;
  monthly_list_price_nis: number;
  age_group: DaycareAgeGroup;
  framework_track: FrameworkTrack;
  hours_sun_thu_start: string | null;
  hours_sun_thu_end: string | null;
  is_full_day: boolean;
  includes_friday: boolean | null;
  hours_fri_start: string | null;
  hours_fri_end: string | null;
  includes_nutrition: boolean | null;
  reported_size_bucket: SizeBucket;
  reported_shelter_status: TriStateStatus;
  reported_cameras_0_3: TriStateStatus;
  is_standard_list_price_confirmed: boolean;
  is_outlier_confirmed_by_user: boolean;
  is_flagged_hidden: boolean;
}

interface StoredDaycare {
  daycare_id: string;
  external_facility_id: string | null;
  moe_symbol: string | null;
  mol_symbol: string | null;
  display_name: string;
  official_registry_name: string | null;
  normalized_name: string;
  operator_entity_name: string | null;
  operator_corp_id: string | null;
  city_code: number;
  city_name_he: string;
  neighborhood_he: string | null;
  street_name_he: string | null;
  house_number_public: string | null;
  full_address_public: string;
  lat: number;
  lng: number;
  official_phone_public: string | null;
  official_capacity: number | null;
  age_groups_supported: DaycareAgeGroup[];
  primary_track: FrameworkTrack;
  licensing_regime: LicensingRegime;
  license_status: DaycareLicenseStatus;
  is_official_source: boolean;
  is_subsidized_symbol: boolean;
  has_active_stop_order: boolean;
  has_official_sanction: boolean;
  official_sanction_date: string | null;
  official_sanction_text: string | null;
  shelter_status: TriStateStatus;
  cameras_0_3_status: TriStateStatus;
  official_last_checked_at: string;
  external_sources: ExternalSourceProvenance[];
}

function isFullDayHours(
  start: string | null,
  end: string | null,
  track: FrameworkTrack
): boolean {
  if (!start || !end) return track !== 'private_half_day';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diffHours = eh + em / 60 - (sh + sm / 60);
  return diffHours >= 7.0;
}

/**
 * מימוש Repository מלא בזיכרון (מיישם 1:1 את כל הלוגיקה של Views ופונקציות ה-SQL מ-docs/04 ו-D-38)
 * משמש לבדיקות אינטגרציה מהירות של ה-API וה-MCP ולפיתוח מקומי ללא תלות ב-Docker.
 */
export class InMemoryDaycareRepository implements DaycareRepository {
  private readonly daycares: StoredDaycare[] = [];
  private readonly submissions: StoredSubmission[] = [];
  private readonly quotaMap = new Map<string, number>();
  private readonly corrections: CorrectionRequestRecord[] = [];

  constructor(options: { seedDemoData?: boolean } = {}) {
    if (options.seedDemoData) {
      this.seedInitialOfficialData();
    }
  }

  private seedInitialOfficialData() {
    this.daycares.push(
      {
        daycare_id: 'a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99',
        external_facility_id: 'c49a8b12',
        moe_symbol: '410923',
        mol_symbol: null,
        display_name: 'מעון יום כוכב הצפון',
        official_registry_name: 'מעון כוכב הצפון בע״מ',
        normalized_name: normalizeDaycareName('מעון יום כוכב הצפון'),
        operator_entity_name: 'כוכב הצפון חינוך לגיל הרך בע״מ',
        operator_corp_id: '515987654',
        city_code: 5000,
        city_name_he: 'תל אביב - יפו',
        neighborhood_he: 'הצפון הישן',
        street_name_he: 'ארלוזורוב',
        house_number_public: '42',
        full_address_public: 'ארלוזורוב 42, תל אביב - יפו',
        lat: 32.08791,
        lng: 34.77824,
        official_phone_public: '03-5551234',
        official_capacity: 48,
        age_groups_supported: ['0_1', '1_2', '2_3'],
        primary_track: 'private_full_day',
        licensing_regime: 'daycare_law_0_3',
        license_status: 'active_license',
        is_official_source: true,
        is_subsidized_symbol: false,
        has_active_stop_order: false,
        has_official_sanction: false,
        official_sanction_date: null,
        official_sanction_text: null,
        shelter_status: 'yes',
        cameras_0_3_status: 'yes',
        official_last_checked_at: '2026-11-22',
        external_sources: [
          {
            sourceSystem: 'moe_getmeonot',
            externalRecordId: '410923',
            sourceLicense: 'data.gov.il',
          },
          {
            sourceSystem: 'tlv_gis_925',
            externalRecordId: 'TLV-925-108',
            sourceLicense: 'TLV-OpenData',
          },
        ],
      },
      {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        external_facility_id: 'e12f34a5',
        moe_symbol: '11849',
        mol_symbol: null,
        display_name: 'מעון לומוס קידס',
        official_registry_name: 'לומוס - קידס בע״מ',
        normalized_name: normalizeDaycareName('מעון לומוס קידס'),
        operator_entity_name: 'לומוס - קידס בע״מ',
        operator_corp_id: '558500369',
        city_code: 5000,
        city_name_he: 'תל אביב - יפו',
        neighborhood_he: 'הצפון החדש',
        street_name_he: 'דנין',
        house_number_public: '6',
        full_address_public: 'דנין 6, תל אביב - יפו',
        lat: 32.0912,
        lng: 34.7815,
        official_phone_public: '050-6798027',
        official_capacity: 36,
        age_groups_supported: ['0_1', '1_2', '2_3'],
        primary_track: 'private_full_day',
        licensing_regime: 'daycare_law_0_3',
        license_status: 'active_license',
        is_official_source: true,
        is_subsidized_symbol: false,
        has_active_stop_order: false,
        has_official_sanction: false,
        official_sanction_date: null,
        official_sanction_text: null,
        shelter_status: 'yes',
        cameras_0_3_status: 'yes',
        official_last_checked_at: '2026-11-22',
        external_sources: [
          {
            sourceSystem: 'moe_getmeonot',
            externalRecordId: '11849',
            sourceLicense: 'data.gov.il',
          },
        ],
      },
      {
        daycare_id: 'd2e3f4a5-6b7c-4d8e-9f0a-1b2c3d4e5f22',
        external_facility_id: 'f98a76b5',
        moe_symbol: '10979',
        mol_symbol: null,
        display_name: 'גן אינגלסיטו',
        official_registry_name: 'אינגלסיטו בע״מ',
        normalized_name: normalizeDaycareName('גן אינגלסיטו'),
        operator_entity_name: 'אינגלסיטו בע״מ',
        operator_corp_id: '516773033',
        city_code: 5000,
        city_name_he: 'תל אביב - יפו',
        neighborhood_he: 'לב העיר',
        street_name_he: 'אלנבי',
        house_number_public: '59',
        full_address_public: 'אלנבי 59, תל אביב - יפו',
        lat: 32.0845,
        lng: 34.7731,
        official_phone_public: '03-6543210',
        official_capacity: 32,
        age_groups_supported: ['0_1', '1_2', '2_3'],
        primary_track: 'private_full_day',
        licensing_regime: 'daycare_law_0_3',
        license_status: 'in_licensing_process',
        is_official_source: true,
        is_subsidized_symbol: false,
        has_active_stop_order: false,
        has_official_sanction: false,
        official_sanction_date: null,
        official_sanction_text: null,
        shelter_status: 'yes',
        cameras_0_3_status: 'yes',
        official_last_checked_at: '2026-11-22',
        external_sources: [
          {
            sourceSystem: 'moe_getmeonot',
            externalRecordId: '10979',
            sourceLicense: 'data.gov.il',
          },
        ],
      },
      {
        daycare_id: 'b7e4c1a0-3d8a-4f11-8b22-6c1d0e9f8a77',
        external_facility_id: 'a12b34c5',
        moe_symbol: '69617',
        mol_symbol: '12045',
        display_name: 'מעון ויצו רחובות המדע',
        official_registry_name: 'ויצו - הסתדרות עולמית לנשים ציוניות (ע״ר)',
        normalized_name: normalizeDaycareName('מעון ויצו רחובות המדע'),
        operator_entity_name: 'ויצו - הסתדרות עולמית לנשים ציוניות (ע״ר)',
        operator_corp_id: '580057321',
        city_code: 8400,
        city_name_he: 'רחובות',
        neighborhood_he: 'פארק המדע',
        street_name_he: 'דרך יבנה',
        house_number_public: '18',
        full_address_public: 'דרך יבנה 18, רחובות',
        lat: 31.8945,
        lng: 34.8112,
        official_phone_public: '08-9456789',
        official_capacity: 75,
        age_groups_supported: ['0_1', '1_2', '2_3'],
        primary_track: 'symbol_regulated',
        licensing_regime: 'daycare_law_0_3',
        license_status: 'symbol_recognized',
        is_official_source: true,
        is_subsidized_symbol: true,
        has_active_stop_order: false,
        has_official_sanction: false,
        official_sanction_date: null,
        official_sanction_text: null,
        shelter_status: 'yes',
        cameras_0_3_status: 'yes',
        official_last_checked_at: '2026-11-22',
        external_sources: [
          {
            sourceSystem: 'mol_daycare',
            externalRecordId: '12045',
            sourceLicense: 'data.gov.il',
          },
        ],
      }
    );

    // Seed initial price reports for Kohav HaTzafon (4 live OIDC reports in 2027 + history in 2025, 2026)
    const kohavId = 'a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99';
    for (const [idx, price] of [5400, 5550, 5650, 5800].entries()) {
      this.submissions.push({
        submission_id: `00000000-0000-4000-8000-00000000010${idx}`,
        daycare_id: kohavId,
        school_year: 2027,
        dedup_token: `seed_oidc_token_kohav_${idx}`.padEnd(64, '0'),
        source_type: 'parent_google_oidc',
        reported_month: '2026-11',
        monthly_list_price_nis: price,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        is_full_day: true,
        includes_friday: true,
        hours_fri_start: '07:30',
        hours_fri_end: '12:30',
        includes_nutrition: true,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        is_outlier_confirmed_by_user: false,
        is_flagged_hidden: false,
      });
    }

    // Historical years for Kohav HaTzafon (2025 & 2026)
    this.submissions.push(
      {
        submission_id: '00000000-0000-4000-8000-000000000201',
        daycare_id: kohavId,
        school_year: 2025,
        dedup_token: null,
        source_type: 'community_sheet_tlv_seed',
        reported_month: '2024-09',
        monthly_list_price_nis: 4950,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        is_full_day: true,
        includes_friday: true,
        hours_fri_start: null,
        hours_fri_end: null,
        includes_nutrition: null,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        is_outlier_confirmed_by_user: false,
        is_flagged_hidden: false,
      },
      {
        submission_id: '00000000-0000-4000-8000-000000000202',
        daycare_id: kohavId,
        school_year: 2026,
        dedup_token: null,
        source_type: 'community_sheet_tlv_seed',
        reported_month: '2025-09',
        monthly_list_price_nis: 5250,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        is_full_day: true,
        includes_friday: true,
        hours_fri_start: null,
        hours_fri_end: null,
        includes_nutrition: null,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        is_outlier_confirmed_by_user: false,
        is_flagged_hidden: false,
      },
      // Lumos Kids & Inglesito reports in TLV for 2027 so spatial radius_1km & city benchmarks have N >= 3 daycares!
      {
        submission_id: '00000000-0000-4000-8000-000000000301',
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        dedup_token: null,
        source_type: 'community_sheet_tlv_seed',
        reported_month: '2026-09',
        monthly_list_price_nis: 5800,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '08:00',
        hours_sun_thu_end: '16:30',
        is_full_day: true,
        includes_friday: false,
        hours_fri_start: null,
        hours_fri_end: null,
        includes_nutrition: null,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        is_outlier_confirmed_by_user: false,
        is_flagged_hidden: false,
      },
      {
        submission_id: '00000000-0000-4000-8000-000000000302',
        daycare_id: 'd2e3f4a5-6b7c-4d8e-9f0a-1b2c3d4e5f22',
        school_year: 2027,
        dedup_token: 'seed_oidc_token_inglesito_1'.padEnd(64, '0'),
        source_type: 'parent_google_oidc',
        reported_month: '2026-10',
        monthly_list_price_nis: 5400,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:45',
        hours_sun_thu_end: '16:30',
        is_full_day: true,
        includes_friday: true,
        hours_fri_start: '07:45',
        hours_fri_end: '12:30',
        includes_nutrition: true,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        is_outlier_confirmed_by_user: false,
        is_flagged_hidden: false,
      }
    );
  }

  private computeGroupAggregates(daycareId: string, schoolYear?: number) {
    const activeSubs = this.submissions.filter(
      (s) =>
        s.daycare_id === daycareId &&
        !s.is_flagged_hidden &&
        (schoolYear === undefined || s.school_year === schoolYear)
    );

    const groups = new Map<string, StoredSubmission[]>();
    for (const s of activeSubs) {
      const key = `${s.school_year}:${s.age_group}:${s.framework_track}:${s.is_full_day}`;
      const arr = groups.get(key) || [];
      arr.push(s);
      groups.set(key, arr);
    }

    const result: DaycareDetailDto['price_matrix_by_age'] = [];

    for (const [, rawGroupSubs] of groups) {
      // D-38: If live OIDC reports exist for this group, they supersede community_sheet_tlv_seed
      const hasLive = rawGroupSubs.some(
        (s) => s.source_type !== 'community_sheet_tlv_seed'
      );
      const effective = hasLive
        ? rawGroupSubs.filter(
            (s) => s.source_type !== 'community_sheet_tlv_seed'
          )
        : rawGroupSubs;

      const sortedByPrice = [...effective]
        .map((s) => s.monthly_list_price_nis)
        .sort((a, b) => a - b);
      const sortedByDateDesc = [...effective].sort((a, b) =>
        b.reported_month.localeCompare(a.reported_month)
      );

      const count = effective.length;
      const liveCount = effective.filter(
        (s) => s.source_type !== 'community_sheet_tlv_seed'
      ).length;
      const minP = sortedByPrice[0];
      const maxP = sortedByPrice[sortedByPrice.length - 1];
      const avgP = Math.round(
        sortedByPrice.reduce((acc, v) => acc + v, 0) / count
      );
      const medP = computePercentile(sortedByPrice, 0.5);
      const p25 = computePercentile(sortedByPrice, 0.25);
      const p75 = computePercentile(sortedByPrice, 0.75);
      const latestP = sortedByDateDesc[0].monthly_list_price_nis;
      const lastMonth = sortedByDateDesc[0].reported_month;

      let displayMode:
        | 'single'
        | 'range_discrepancy'
        | 'average_close'
        | 'median_consensus' = 'median_consensus';
      let primaryPinPrice = medP;

      if (count === 1) {
        displayMode = 'single';
        primaryPinPrice = minP;
      } else if (count === 2 && (maxP - minP) / minP > 0.05) {
        displayMode = 'range_discrepancy';
        primaryPinPrice = latestP;
      } else if (count === 2) {
        displayMode = 'average_close';
        primaryPinPrice = avgP;
      }

      const sample = effective[0];
      result.push({
        school_year: sample.school_year,
        school_year_label: formatSchoolYearLabel(sample.school_year),
        age_group: sample.age_group,
        age_group_label_he: AGE_GROUP_LABELS_HE[sample.age_group],
        framework_track: sample.framework_track,
        is_full_day: sample.is_full_day,
        reports_count: count,
        live_verified_reports_count: liveCount,
        price_display_mode: displayMode,
        representative_price_nis: primaryPinPrice,
        min_price_nis: minP,
        max_price_nis: maxP,
        median_price_nis: medP,
        p25_price_nis: p25,
        p75_price_nis: p75,
        price_trust_tier:
          liveCount >= 3
            ? 'tier_2_parent_consensus'
            : 'tier_3_unverified_report',
        last_updated_month: lastMonth,
      });
    }

    return result;
  }

  private computeDaycareYearSummary(
    daycare: StoredDaycare,
    schoolYear: number,
    cityMedian: number | null,
    ageGroupFilter?: DaycareAgeGroup
  ): PriceAggregateSummary | null {
    const groups = this.computeGroupAggregates(daycare.daycare_id, schoolYear);
    const filtered = ageGroupFilter
      ? groups.filter((g) => g.age_group === ageGroupFilter)
      : groups;
    if (filtered.length === 0) return null;

    // D-38: Prefer full-day reports when collapsing across age groups
    const hasFullDay = filtered.some((g) => g.is_full_day);
    const prioritized = filtered.filter((g) => g.is_full_day === hasFullDay);

    const totalReports = prioritized.reduce(
      (acc, g) => acc + g.reports_count,
      0
    );
    const totalLive = prioritized.reduce(
      (acc, g) => acc + g.live_verified_reports_count,
      0
    );
    const minP = Math.min(...prioritized.map((g) => g.min_price_nis));
    const maxP = Math.max(...prioritized.map((g) => g.max_price_nis));
    const repPrices = prioritized
      .map((g) => g.representative_price_nis)
      .sort((a, b) => a - b);
    const primaryPinPrice = computePercentile(repPrices, 0.5);

    let displayMode: PriceAggregateSummary['price_display_mode'] =
      'median_consensus';
    if (totalReports === 1) {
      displayMode = 'single';
    } else if (totalReports === 2 && (maxP - minP) / minP > 0.05) {
      displayMode = 'range_discrepancy';
    } else if (totalReports === 2) {
      displayMode = 'average_close';
    }

    const pinRequiresTilde =
      totalReports === 2 && (maxP - minP) / minP > 0.05;
    const trustTier =
      totalLive >= 3 ? 'tier_2_parent_consensus' : 'tier_3_unverified_report';

    return buildFormattedPriceSummary({
      schoolYear,
      priceDisplayMode: displayMode,
      primaryPinPriceNis: primaryPinPrice,
      pinRequiresTilde,
      minPriceNis: minP,
      maxPriceNis: maxP,
      medianPriceNis: primaryPinPrice,
      reportsCount: totalReports,
      priceTrustTier: trustTier,
      isSubsidizedSymbol: daycare.is_subsidized_symbol,
      frameworkTrack: daycare.primary_track,
      cityMedianPriceNis: cityMedian,
    });
  }

  private computeCityMedian(
    cityCode: number,
    schoolYear: number,
    track: FrameworkTrack = 'private_full_day'
  ): number | null {
    const prices: number[] = [];
    for (const d of this.daycares) {
      if (d.city_code !== cityCode || d.primary_track !== track) continue;
      const summary = this.computeDaycareYearSummary(d, schoolYear, null);
      if (summary) prices.push(summary.primary_pin_price_nis);
    }
    if (prices.length === 0) return null;
    prices.sort((a, b) => a - b);
    return computePercentile(prices, 0.5);
  }

  async searchDaycares(query: DaycareSearchQuery) {
    const schoolYear = query.school_year || 2027;
    let candidates = [...this.daycares];

    if (query.city_code) {
      candidates = candidates.filter((d) => d.city_code === query.city_code);
    }
    if (query.city_name_he) {
      const norm = normalizeCityName(query.city_name_he);
      candidates = candidates.filter((d) =>
        normalizeCityName(d.city_name_he).includes(norm)
      );
    }
    if (query.framework_track) {
      candidates = candidates.filter(
        (d) => d.primary_track === query.framework_track
      );
    }
    if (query.license_status) {
      candidates = candidates.filter(
        (d) => d.license_status === query.license_status
      );
    }
    if (query.is_subsidized_symbol !== undefined) {
      candidates = candidates.filter(
        (d) => d.is_subsidized_symbol === query.is_subsidized_symbol
      );
    }
    if (query.shelter_status) {
      candidates = candidates.filter(
        (d) => d.shelter_status === query.shelter_status
      );
    }
    if (query.age_group) {
      candidates = candidates.filter((d) =>
        d.age_groups_supported.includes(query.age_group!)
      );
    }
    if (
      query.lat !== undefined &&
      query.lng !== undefined &&
      query.radius_m !== undefined
    ) {
      candidates = candidates.filter(
        (d) =>
          haversineDistanceMeters(query.lat!, query.lng!, d.lat, d.lng) <=
          query.radius_m!
      );
    }
    if (query.bbox) {
      const parts = query.bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        candidates = candidates.filter(
          (d) =>
            d.lng >= minLng &&
            d.lng <= maxLng &&
            d.lat >= minLat &&
            d.lat <= maxLat
        );
      }
    }
    if (query.q) {
      const qTrim = query.q.trim();
      candidates = candidates.filter(
        (d) =>
          d.display_name.includes(qTrim) ||
          d.full_address_public.includes(qTrim) ||
          trigramSimilarity(d.normalized_name, qTrim) >= 0.3
      );
    }

    const cityCodeForMedian =
      query.city_code || candidates[0]?.city_code || 5000;
    const cityMedian = this.computeCityMedian(cityCodeForMedian, schoolYear);

    let enriched = candidates.map((d) => {
      const priceSummary = this.computeDaycareYearSummary(
        d,
        schoolYear,
        cityMedian,
        query.age_group
      );
      return { daycare: d, priceSummary };
    });

    if (query.has_price_only) {
      enriched = enriched.filter((e) => e.priceSummary !== null);
    }
    if (query.min_price !== undefined) {
      enriched = enriched.filter(
        (e) =>
          e.priceSummary !== null &&
          e.priceSummary.primary_pin_price_nis >= query.min_price!
      );
    }
    if (query.max_price !== undefined) {
      enriched = enriched.filter(
        (e) =>
          e.priceSummary !== null &&
          e.priceSummary.primary_pin_price_nis <= query.max_price!
      );
    }

    if (query.sort_by === 'price_asc') {
      enriched.sort(
        (a, b) =>
          (a.priceSummary?.primary_pin_price_nis ?? 999999) -
          (b.priceSummary?.primary_pin_price_nis ?? 999999)
      );
    } else if (query.sort_by === 'price_desc') {
      enriched.sort(
        (a, b) =>
          (b.priceSummary?.primary_pin_price_nis ?? 0) -
          (a.priceSummary?.primary_pin_price_nis ?? 0)
      );
    } else if (query.sort_by === 'reports_desc') {
      enriched.sort(
        (a, b) =>
          (b.priceSummary?.reports_count ?? 0) -
          (a.priceSummary?.reports_count ?? 0)
      );
    } else {
      enriched.sort((a, b) =>
        a.daycare.display_name.localeCompare(b.daycare.display_name, 'he')
      );
    }

    const totalCount = enriched.length;
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.page_size || 50));
    const paged =
      query.format === 'map_pins'
        ? enriched
        : enriched.slice((page - 1) * pageSize, page * pageSize);

    const items: DaycareListItemDto[] = paged.map(({ daycare: d, priceSummary }) => ({
      daycare_id: d.daycare_id,
      external_facility_id: d.external_facility_id,
      moe_symbol: d.moe_symbol,
      mol_symbol: d.mol_symbol,
      display_name: d.display_name,
      city_code: d.city_code,
      city_name_he: d.city_name_he,
      neighborhood_he: d.neighborhood_he,
      full_address_public: d.full_address_public,
      is_location_approximated: false,
      location: { lat: d.lat, lng: d.lng },
      age_groups_supported: d.age_groups_supported,
      primary_track: d.primary_track,
      licensing_regime: d.licensing_regime,
      license_status: d.license_status,
      is_subsidized_symbol: d.is_subsidized_symbol,
      has_active_stop_order: d.has_active_stop_order,
      has_official_sanction: d.has_official_sanction,
      // חוק ברזל (docs/05 סעיף 1.2): הסתרת מספרי סלולר (05x) ברשימות וייצוא המוני!
      official_phone_public: stripMobilePhoneForBulkExport(
        d.official_phone_public
      ),
      shelter_status: d.shelter_status,
      official_last_checked_at: d.official_last_checked_at,
      regulatory_context_he: buildRegulatoryContextHe({
        licensingRegime: d.licensing_regime,
        licenseStatus: d.license_status,
        moeSymbol: d.moe_symbol,
        molSymbol: d.mol_symbol,
        isSubsidizedSymbol: d.is_subsidized_symbol,
        hasActiveStopOrder: d.has_active_stop_order,
        hasOfficialSanction: d.has_official_sanction,
        officialSanctionDate: d.official_sanction_date,
        officialSanctionText: d.official_sanction_text,
        officialLastCheckedAt: d.official_last_checked_at,
      }),
      price_summary_current_year: priceSummary,
    }));

    const mapPins: CompactMapPinDto[] | undefined =
      query.format === 'map_pins'
        ? enriched.map(({ daycare: d, priceSummary }) => ({
            id: d.daycare_id,
            name: d.display_name,
            city_code: d.city_code,
            lat: d.lat,
            lng: d.lng,
            track: d.primary_track,
            license_status: d.license_status,
            subsidized: d.is_subsidized_symbol,
            stop_order: d.has_active_stop_order,
            sanction: d.has_official_sanction,
            price_nis: priceSummary?.primary_pin_price_nis ?? null,
            pin_label: priceSummary?.formatted_pin_label ?? '+ הוסף מחיר',
            tilde: priceSummary?.pin_requires_tilde ?? false,
            reports_count: priceSummary?.reports_count ?? 0,
            trust_tier: priceSummary?.price_trust_tier ?? null,
            relative_level: priceSummary?.relative_to_city_median ?? 'no_price',
          }))
        : undefined;

    return {
      totalCount,
      cityMedianPriceNis: cityMedian,
      items,
      mapPins,
    };
  }

  async getDaycareDetails(
    daycareIdOrSymbol: string,
    schoolYear = 2027
  ): Promise<DaycareDetailDto | null> {
    const d = this.daycares.find(
      (item) =>
        item.daycare_id === daycareIdOrSymbol ||
        item.moe_symbol === daycareIdOrSymbol ||
        item.mol_symbol === daycareIdOrSymbol ||
        item.external_facility_id === daycareIdOrSymbol
    );
    if (!d) return null;

    const allYearAggs = this.computeGroupAggregates(d.daycare_id);
    const currentYearMatrix = allYearAggs.filter(
      (a) => a.school_year === schoolYear
    );

    // Build YoY history (D-30)
    const sortedByYear = [...allYearAggs].sort(
      (a, b) => a.school_year - b.school_year
    );
    const firstPrice = sortedByYear[0]?.representative_price_nis ?? null;
    const priceHistoryYoy: DaycareDetailDto['price_history_yoy'] =
      sortedByYear.map((curr, idx) => {
        const prev = idx > 0 ? sortedByYear[idx - 1] : null;
        const yoyDiffNis = prev
          ? curr.representative_price_nis - prev.representative_price_nis
          : null;
        const yoyDiffPct =
          prev && prev.representative_price_nis > 0
            ? Number(
                (
                  ((curr.representative_price_nis -
                    prev.representative_price_nis) /
                    prev.representative_price_nis) *
                  100
                ).toFixed(1)
              )
            : null;
        const cumDiffNis =
          idx > 0 && firstPrice !== null
            ? curr.representative_price_nis - firstPrice
            : null;
        const cumDiffPct =
          idx > 0 && firstPrice && firstPrice > 0
            ? Number(
                (
                  ((curr.representative_price_nis - firstPrice) / firstPrice) *
                  100
                ).toFixed(1)
              )
            : null;

        return {
          school_year: curr.school_year,
          school_year_label: curr.school_year_label,
          age_group: curr.age_group,
          is_full_day: curr.is_full_day,
          representative_price_nis: curr.representative_price_nis,
          reports_count: curr.reports_count,
          yoy_diff_nis: yoyDiffNis,
          yoy_diff_pct: yoyDiffPct,
          cumulative_diff_nis: cumDiffNis,
          cumulative_diff_pct: cumDiffPct,
        };
      });

    // Compute Benchmarks (D-30, D-38: equal weight 1 per daycare & N >= 3 threshold!)
    const targetSummary = this.computeDaycareYearSummary(d, schoolYear, null);
    const targetPrice = targetSummary?.primary_pin_price_nis ?? null;

    const radiusPrices: number[] = [];
    const cityTrackPrices: number[] = [];

    for (const peer of this.daycares) {
      if (
        peer.city_code !== d.city_code ||
        peer.primary_track !== d.primary_track
      ) {
        continue;
      }
      const peerSummary = this.computeDaycareYearSummary(peer, schoolYear, null);
      if (!peerSummary) continue;

      cityTrackPrices.push(peerSummary.primary_pin_price_nis);
      if (
        haversineDistanceMeters(d.lat, d.lng, peer.lat, peer.lng) <= 1000
      ) {
        radiusPrices.push(peerSummary.primary_pin_price_nis);
      }
    }

    const comparisons: DaycareDetailDto['benchmarks']['comparisons'] = [];
    const addComparison = (
      scope: 'radius_1km' | 'city_all_same_track' | 'city_similar_params',
      labelHe: string,
      prices: number[]
    ) => {
      if (prices.length < 3 || targetPrice === null) return;
      const sorted = [...prices].sort((a, b) => a - b);
      const med = computePercentile(sorted, 0.5);
      const p25 = computePercentile(sorted, 0.25);
      const p75 = computePercentile(sorted, 0.75);
      const diffNis = targetPrice - med;
      const diffPct = Number(((diffNis / med) * 100).toFixed(1));
      comparisons.push({
        benchmark_scope: scope,
        label_he: labelHe,
        sample_daycares_n: sorted.length,
        median_price_nis: med,
        p25_price_nis: p25,
        p75_price_nis: p75,
        diff_from_median_nis: diffNis,
        diff_from_median_pct: diffPct,
      });
    };

    addComparison(
      'radius_1km',
      `גנים ברדיוס 1 ק״מ (${d.neighborhood_he || d.city_name_he})`,
      radiusPrices
    );
    addComparison(
      'city_all_same_track',
      `כלל הגנים הפרטיים ב${d.city_name_he}`,
      cityTrackPrices
    );
    addComparison(
      'city_similar_params',
      `גנים דומים בעיר (${d.city_name_he} · יום מלא)`,
      cityTrackPrices
    );

    const regulatedSymbolBenchmark = 2515;
    const annualGap =
      targetPrice !== null
        ? (targetPrice - regulatedSymbolBenchmark) * 12
        : null;

    // Individual reports (D-34: expose school_year only, NEVER reported_month or dedup_token!)
    const individualReports: DaycareDetailDto['individual_reports'] =
      this.submissions
        .filter((s) => s.daycare_id === d.daycare_id && !s.is_flagged_hidden)
        .map((s) => ({
          submission_id: s.submission_id,
          school_year: s.school_year,
          school_year_label: formatSchoolYearLabel(s.school_year),
          source_type: s.source_type,
          source_label_he:
            s.source_type === 'community_sheet_tlv_seed'
              ? 'גיליון הורים קהילתי'
              : 'דיווח הורה מאומת',
          monthly_list_price_nis: s.monthly_list_price_nis,
          age_group: s.age_group,
          framework_track: s.framework_track,
          hours_sun_thu_start: s.hours_sun_thu_start,
          hours_sun_thu_end: s.hours_sun_thu_end,
          is_full_day: s.is_full_day,
          includes_friday: s.includes_friday,
          hours_fri_start: s.hours_fri_start,
          hours_fri_end: s.hours_fri_end,
          includes_nutrition: s.includes_nutrition,
          reported_size_bucket: s.reported_size_bucket,
          reported_shelter_status: s.reported_shelter_status,
          reported_cameras_0_3: s.reported_cameras_0_3,
        }));

    return {
      daycare: {
        daycare_id: d.daycare_id,
        external_facility_id: d.external_facility_id,
        moe_symbol: d.moe_symbol,
        mol_symbol: d.mol_symbol,
        display_name: d.display_name,
        official_registry_name: d.official_registry_name,
        operator_entity_name: d.operator_entity_name,
        operator_corp_id: d.operator_corp_id,
        city_code: d.city_code,
        city_name_he: d.city_name_he,
        neighborhood_he: d.neighborhood_he,
        full_address_public: d.full_address_public,
        is_location_approximated: false,
        location: { lat: d.lat, lng: d.lng },
        // בכרטיס הגן הבודד מותר להציג את מספר הטלפון של המסגרת לטובת יצירת קשר של ההורה
        official_phone_public: d.official_phone_public,
        official_capacity: d.official_capacity,
        age_groups_supported: d.age_groups_supported,
        primary_track: d.primary_track,
        licensing_regime: d.licensing_regime,
        license_status: d.license_status,
        is_official_source: d.is_official_source,
        is_subsidized_symbol: d.is_subsidized_symbol,
        trust_tier: 'tier_1_official',
        has_active_stop_order: d.has_active_stop_order,
        has_official_sanction: d.has_official_sanction,
        official_sanction_date: d.official_sanction_date,
        official_sanction_text: d.official_sanction_text,
        shelter_status: d.shelter_status,
        cameras_0_3_status: d.cameras_0_3_status,
        official_last_checked_at: d.official_last_checked_at,
        regulatory_context_he: buildRegulatoryContextHe({
          licensingRegime: d.licensing_regime,
          licenseStatus: d.license_status,
          moeSymbol: d.moe_symbol,
          molSymbol: d.mol_symbol,
          isSubsidizedSymbol: d.is_subsidized_symbol,
          hasActiveStopOrder: d.has_active_stop_order,
          hasOfficialSanction: d.has_official_sanction,
          officialSanctionDate: d.official_sanction_date,
          officialSanctionText: d.official_sanction_text,
          officialLastCheckedAt: d.official_last_checked_at,
        }),
        external_sources: d.external_sources.map((src) => ({
          source_system: src.sourceSystem,
          external_record_id: src.externalRecordId,
          source_license: src.sourceLicense,
          last_synced_at: d.official_last_checked_at,
        })),
      },
      price_matrix_by_age: currentYearMatrix,
      price_history_yoy: priceHistoryYoy,
      benchmarks: {
        target_price_nis: targetPrice,
        regulated_symbol_benchmark_nis: regulatedSymbolBenchmark,
        private_vs_regulated_annual_gap_nis: annualGap,
        comparisons,
      },
      individual_reports: individualReports,
    };
  }

  async getAreaPriceStats(params: {
    city_code?: number;
    city_name_he?: string;
    neighborhood_he?: string;
    age_group?: DaycareAgeGroup;
    framework_track?: FrameworkTrack;
    school_year?: number;
  }): Promise<AreaStatsDto | null> {
    const schoolYear = params.school_year || 2027;
    const track = params.framework_track || 'private_full_day';

    let cityRecord = BASELINE_ISRAEL_CITIES.find(
      (c) =>
        (params.city_code && c.cityCode === params.city_code) ||
        (params.city_name_he &&
          normalizeCityName(c.cityNameHe).includes(
            normalizeCityName(params.city_name_he)
          ))
    );
    if (!cityRecord) {
      cityRecord = BASELINE_ISRAEL_CITIES[0];
    }

    const cityDaycares = this.daycares.filter(
      (d) => d.city_code === cityRecord!.cityCode
    );
    const subsidizedCount = cityDaycares.filter(
      (d) => d.is_subsidized_symbol
    ).length;
    const privateCount = cityDaycares.length - subsidizedCount;

    const prices: number[] = [];
    for (const d of cityDaycares) {
      if (d.primary_track !== track) continue;
      const summary = this.computeDaycareYearSummary(
        d,
        schoolYear,
        null,
        params.age_group
      );
      if (summary) prices.push(summary.primary_pin_price_nis);
    }

    prices.sort((a, b) => a - b);
    const median = prices.length > 0 ? computePercentile(prices, 0.5) : null;
    const p25 = prices.length > 0 ? computePercentile(prices, 0.25) : null;
    const p75 = prices.length > 0 ? computePercentile(prices, 0.75) : null;
    const minP = prices.length > 0 ? prices[0] : null;
    const maxP = prices.length > 0 ? prices[prices.length - 1] : null;

    const regBenchmark =
      BASELINE_REGULATED_BENCHMARKS.find(
        (b) =>
          b.schoolYear === schoolYear &&
          b.frameworkTrack ===
            (track === 'municipal_tzaharon'
              ? 'municipal_tzaharon'
              : 'symbol_regulated') &&
          (params.age_group && b.ageGroup === params.age_group ? true : b.ageGroup === '1_2')
      )?.monthlyMaxPriceNis ?? 2515;

    return {
      city_code: cityRecord.cityCode,
      city_name_he: cityRecord.cityNameHe,
      school_year: schoolYear,
      school_year_label: formatSchoolYearLabel(schoolYear),
      framework_track: track,
      age_group: params.age_group || 'all',
      total_official_daycares: cityDaycares.length,
      daycares_with_price_reports: prices.length,
      subsidized_daycares_count: subsidizedCount,
      private_daycares_count: privateCount,
      median_price_nis: median,
      p25_price_nis: p25,
      p75_price_nis: p75,
      min_price_nis: minP,
      max_price_nis: maxP,
      regulated_benchmark_nis: regBenchmark,
      annual_gap_vs_regulated_nis:
        median !== null ? (median - regBenchmark) * 12 : null,
    };
  }

  async autocompleteLocations(params: {
    q: string;
    city_code?: number;
    limit?: number;
  }): Promise<AutocompleteLocationDto[]> {
    const q = params.q.trim();
    if (q.length < 2) return [];
    const limit = Math.min(25, Math.max(1, params.limit || 10));
    const normQ = normalizeStreetName(q);

    const results: AutocompleteLocationDto[] = [];

    for (const c of BASELINE_ISRAEL_CITIES) {
      if (params.city_code && c.cityCode !== params.city_code) continue;
      if (
        c.cityNameHe.includes(q) ||
        normalizeCityName(c.cityNameHe).includes(normQ)
      ) {
        results.push({
          kind: 'city',
          id: `city:${c.cityCode}`,
          label_he: c.cityNameHe,
          city_code: c.cityCode,
          city_name_he: c.cityNameHe,
          lat: c.lat,
          lng: c.lng,
        });
      }
    }

    for (const d of this.daycares) {
      if (params.city_code && d.city_code !== params.city_code) continue;
      if (
        d.street_name_he &&
        (d.street_name_he.includes(normQ) ||
          trigramSimilarity(d.street_name_he, normQ) >= 0.45)
      ) {
        const streetId = `street:${d.city_code}:${d.street_name_he}`;
        if (!results.some((r) => r.id === streetId)) {
          results.push({
            kind: 'street',
            id: streetId,
            label_he: `רחוב ${d.street_name_he}, ${d.city_name_he}`,
            city_code: d.city_code,
            city_name_he: d.city_name_he,
            lat: d.lat,
            lng: d.lng,
          });
        }
      }

      if (
        d.display_name.includes(q) ||
        d.full_address_public.includes(q) ||
        trigramSimilarity(d.normalized_name, normQ) >= 0.45
      ) {
        results.push({
          kind: 'daycare',
          id: d.daycare_id,
          label_he: `${d.display_name} (${d.full_address_public})`,
          city_code: d.city_code,
          city_name_he: d.city_name_he,
          lat: d.lat,
          lng: d.lng,
        });
      }
    }

    return results.slice(0, limit);
  }

  async getSanityCheckReferenceMedian(params: {
    daycareId: string;
    schoolYear: number;
    frameworkTrack: FrameworkTrack;
    ageGroup: DaycareAgeGroup;
  }): Promise<number> {
    const daycare = this.daycares.find(
      (d) => d.daycare_id === params.daycareId
    );
    const cityCode = daycare?.city_code ?? 5000;
    const cityMedian = this.computeCityMedian(
      cityCode,
      params.schoolYear,
      params.frameworkTrack
    );
    if (cityMedian !== null) return cityMedian;

    switch (params.frameworkTrack) {
      case 'symbol_regulated':
        return 2515;
      case 'municipal_tzaharon':
        return 1050;
      case 'private_half_day':
        return 3200;
      default:
        return 5400;
    }
  }

  async submitParentReportBlindUpsert(
    input: BlindReportSubmissionInput
  ): Promise<boolean> {
    const daycare = this.daycares.find(
      (d) => d.daycare_id === input.daycareId
    );
    if (!daycare || !daycare.is_official_source) {
      throw new Error('DAYCARE_NOT_FOUND_OR_NOT_OFFICIAL');
    }

    const existingForDaycare = this.submissions.some(
      (s) => s.dedup_token === input.dedupToken
    );

    if (!existingForDaycare) {
      const quotaKey = `${input.quotaHash}:${input.schoolYear}`;
      const currentQuota = this.quotaMap.get(quotaKey) || 0;
      if (currentQuota >= 5) {
        throw new Error('ANNUAL_REPORT_QUOTA_EXCEEDED');
      }
      this.quotaMap.set(quotaKey, currentQuota + 1);
    } else if (input.replaceAllAgesForToken) {
      // D-38: Replace any previous submission under the same dedup_token with a different age_group
      for (let i = this.submissions.length - 1; i >= 0; i--) {
        if (
          this.submissions[i].dedup_token === input.dedupToken &&
          this.submissions[i].age_group !== input.ageGroup
        ) {
          this.submissions.splice(i, 1);
        }
      }
    }

    const existingSameAgeIdx = this.submissions.findIndex(
      (s) =>
        s.dedup_token === input.dedupToken && s.age_group === input.ageGroup
    );

    const newRecord: StoredSubmission = {
      submission_id:
        existingSameAgeIdx >= 0
          ? this.submissions[existingSameAgeIdx].submission_id
          : randomUUID(),
      daycare_id: input.daycareId,
      school_year: input.schoolYear,
      dedup_token: input.dedupToken,
      source_type: 'parent_google_oidc',
      reported_month: input.reportedMonth,
      monthly_list_price_nis: input.monthlyListPriceNis,
      age_group: input.ageGroup,
      framework_track: input.frameworkTrack,
      hours_sun_thu_start: input.hoursSunThuStart,
      hours_sun_thu_end: input.hoursSunThuEnd,
      is_full_day: isFullDayHours(
        input.hoursSunThuStart,
        input.hoursSunThuEnd,
        input.frameworkTrack
      ),
      includes_friday: input.includesFriday,
      hours_fri_start: input.hoursFriStart,
      hours_fri_end: input.hoursFriEnd,
      includes_nutrition: input.includesNutrition,
      reported_size_bucket: input.reportedSizeBucket,
      reported_shelter_status: input.reportedShelterStatus,
      reported_cameras_0_3: input.reportedCameras03,
      is_standard_list_price_confirmed: input.isStandardListPriceConfirmed,
      is_outlier_confirmed_by_user: input.isOutlierConfirmedByUser,
      is_flagged_hidden: false,
    };

    if (existingSameAgeIdx >= 0) {
      this.submissions[existingSameAgeIdx] = newRecord;
    } else {
      this.submissions.push(newRecord);
    }

    return true;
  }

  async withdrawParentReportBlind(params: {
    daycareId: string;
    schoolYear: number;
    dedupToken: string;
    ageGroup?: DaycareAgeGroup | null;
  }): Promise<boolean> {
    for (let i = this.submissions.length - 1; i >= 0; i--) {
      const s = this.submissions[i];
      if (
        s.daycare_id === params.daycareId &&
        s.school_year === params.schoolYear &&
        s.dedup_token === params.dedupToken &&
        (!params.ageGroup || s.age_group === params.ageGroup)
      ) {
        this.submissions.splice(i, 1);
      }
    }
    return true;
  }

  async createCorrectionRequest(params: {
    daycareId: string;
    issueCategory: CorrectionRequestRecord['issue_category'];
    structuredDetails: Record<string, unknown>;
    reportedMonth: string;
  }): Promise<string> {
    const id = randomUUID();
    this.corrections.push({
      request_id: id,
      daycare_id: params.daycareId,
      issue_category: params.issueCategory,
      structured_details: params.structuredDetails,
      status: 'pending',
      reported_month: params.reportedMonth,
    });
    return id;
  }

  async listCorrectionRequests(
    status?: CorrectionRequestRecord['status']
  ): Promise<CorrectionRequestRecord[]> {
    if (!status) return [...this.corrections];
    return this.corrections.filter((c) => c.status === status);
  }

  async resolveCorrectionRequest(params: {
    requestId: string;
    newStatus: 'resolved' | 'rejected';
    hideSubmissionId?: string;
  }): Promise<boolean> {
    const req = this.corrections.find((c) => c.request_id === params.requestId);
    if (!req) return false;
    req.status = params.newStatus;

    if (params.hideSubmissionId) {
      const sub = this.submissions.find(
        (s) => s.submission_id === params.hideSubmissionId
      );
      if (sub) {
        sub.is_flagged_hidden = true;
      }
    }
    return true;
  }
}

/**
 * מימוש Repository מול PostgreSQL 17 + PostGIS (משתמש ב-roPool לקריאה וב-writePool לכתיבה עיוורת)
 */
export class PostgresDaycareRepository implements DaycareRepository {
  constructor(
    private readonly roPool: pg.Pool,
    private readonly writePool: pg.Pool
  ) {}

  async searchDaycares(query: DaycareSearchQuery): Promise<{
    items: DaycareListItemDto[];
    mapPins?: CompactMapPinDto[];
    totalCount: number;
    cityMedianPriceNis: number | null;
  }> {
    const activeSchoolYear = query.school_year || getActiveSchoolYear();
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.page_size || 50));
    const offset = (page - 1) * pageSize;

    // $1 is always activeSchoolYear for the daycare_year_summary LEFT JOIN
    const conditions: string[] = [
      'd.is_official_source = TRUE',
      'd.is_active_in_registry = TRUE',
    ];
    const baseValues: unknown[] = [activeSchoolYear];

    if (query.city_code !== undefined) {
      baseValues.push(query.city_code);
      conditions.push(`d.city_code = $${baseValues.length}`);
    }
    if (query.city_name_he && query.city_name_he.trim()) {
      baseValues.push(`%${query.city_name_he.trim()}%`);
      conditions.push(`d.city_name_he ILIKE $${baseValues.length}`);
    }
    if (query.framework_track) {
      baseValues.push(query.framework_track);
      conditions.push(
        `d.primary_track = $${baseValues.length}::public.framework_track_enum`
      );
    }
    if (query.license_status) {
      baseValues.push(query.license_status);
      conditions.push(
        `d.license_status = $${baseValues.length}::public.license_status_enum`
      );
    }
    if (query.is_subsidized_symbol !== undefined) {
      baseValues.push(query.is_subsidized_symbol);
      conditions.push(`d.is_subsidized_symbol = $${baseValues.length}`);
    }
    if (query.shelter_status) {
      baseValues.push(query.shelter_status);
      conditions.push(
        `d.shelter_status = $${baseValues.length}::public.tri_state_status_enum`
      );
    }
    if (query.age_group) {
      baseValues.push(query.age_group);
      conditions.push(
        `$${baseValues.length}::public.age_group_enum = ANY(d.age_groups_supported)`
      );
    }
    if (
      query.lat !== undefined &&
      query.lng !== undefined &&
      query.radius_m !== undefined
    ) {
      baseValues.push(query.lng, query.lat, query.radius_m);
      const lngIdx = `$${baseValues.length - 2}`;
      const latIdx = `$${baseValues.length - 1}`;
      const radIdx = `$${baseValues.length}`;
      conditions.push(
        `ST_DWithin(d.geom::geography, ST_SetSRID(ST_MakePoint(${lngIdx}, ${latIdx}), 4326)::geography, ${radIdx})`
      );
    }
    if (query.bbox) {
      const parts = query.bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        baseValues.push(minLng, minLat, maxLng, maxLat);
        const i1 = `$${baseValues.length - 3}`;
        const i2 = `$${baseValues.length - 2}`;
        const i3 = `$${baseValues.length - 1}`;
        const i4 = `$${baseValues.length}`;
        conditions.push(
          `ST_Intersects(d.geom, ST_MakeEnvelope(${i1}, ${i2}, ${i3}, ${i4}, 4326))`
        );
      }
    }
    if (query.q && query.q.trim()) {
      baseValues.push(`%${query.q.trim()}%`);
      const p = `$${baseValues.length}`;
      conditions.push(
        `(d.display_name ILIKE ${p} OR d.full_address_public ILIKE ${p} OR d.city_name_he ILIKE ${p} OR COALESCE(d.moe_symbol, '') ILIKE ${p} OR COALESCE(d.mol_symbol, '') ILIKE ${p})`
      );
    }
    if (query.has_price_only) {
      conditions.push('ys.primary_pin_price_nis IS NOT NULL');
    }
    if (query.min_price !== undefined) {
      baseValues.push(query.min_price);
      conditions.push(`ys.primary_pin_price_nis >= $${baseValues.length}`);
    }
    if (query.max_price !== undefined) {
      baseValues.push(query.max_price);
      conditions.push(`ys.primary_pin_price_nis <= $${baseValues.length}`);
    }

    const whereClause = conditions.join(' AND ');
    const countRes = await this.roPool.query<{
      total: string;
      median_price: string | null;
    }>(
      `
      SELECT
        COUNT(*)::TEXT AS total,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys.primary_pin_price_nis))::TEXT AS median_price
      FROM public.daycares d
      LEFT JOIN public.daycare_year_summary ys
        ON ys.daycare_id = d.daycare_id AND ys.school_year = $1
      WHERE ${whereClause}
      `,
      baseValues
    );
    const totalCount = Number(countRes.rows[0]?.total || 0);
    const cityMedianPriceNis =
      countRes.rows[0]?.median_price !== null &&
      countRes.rows[0]?.median_price !== undefined
        ? Number(countRes.rows[0].median_price)
        : null;

    let orderByClause = 'd.display_name ASC';
    if (query.sort_by === 'price_asc') {
      orderByClause = 'ys.primary_pin_price_nis ASC NULLS LAST, d.display_name ASC';
    } else if (query.sort_by === 'price_desc') {
      orderByClause = 'ys.primary_pin_price_nis DESC NULLS LAST, d.display_name ASC';
    } else if (query.sort_by === 'reports_desc') {
      orderByClause = 'COALESCE(ys.total_reports_count, 0) DESC, d.display_name ASC';
    }

    const isMapPins = query.format === 'map_pins';
    const rowsValues = isMapPins
      ? [...baseValues, 5000]
      : [...baseValues, pageSize, offset];
    const paginationClause = isMapPins
      ? `LIMIT $${rowsValues.length}`
      : `LIMIT $${rowsValues.length - 1} OFFSET $${rowsValues.length}`;

    const rowsRes = await this.roPool.query<{
      daycare_id: string;
      external_facility_id: string | null;
      moe_symbol: string | null;
      mol_symbol: string | null;
      display_name: string;
      city_code: number;
      city_name_he: string;
      neighborhood_he: string | null;
      full_address_public: string;
      is_location_approximated: boolean;
      lat: number;
      lng: number;
      age_groups_supported: DaycareAgeGroup[];
      primary_track: FrameworkTrack;
      licensing_regime: LicensingRegime;
      license_status: DaycareLicenseStatus;
      is_subsidized_symbol: boolean;
      has_active_stop_order: boolean;
      has_official_sanction: boolean;
      official_sanction_date: string | null;
      official_sanction_text: string | null;
      official_phone_public: string | null;
      shelter_status: TriStateStatus;
      official_last_checked_at: string;
      primary_pin_price_nis: number | null;
      pin_requires_tilde: boolean | null;
      min_price_nis: number | null;
      max_price_nis: number | null;
      total_reports_count: number | null;
      price_display_mode:
        | 'single'
        | 'range_discrepancy'
        | 'average_close'
        | 'median_consensus'
        | null;
      price_trust_tier:
        | 'tier_2_parent_consensus'
        | 'tier_3_unverified_report'
        | null;
    }>(
      `
      SELECT
        d.daycare_id, d.external_facility_id, d.moe_symbol, d.mol_symbol,
        d.display_name, d.city_code, d.city_name_he, d.neighborhood_he,
        d.full_address_public, d.is_location_approximated,
        ST_Y(d.geom) AS lat, ST_X(d.geom) AS lng,
        d.age_groups_supported, d.primary_track, d.licensing_regime,
        d.license_status, d.is_subsidized_symbol, d.has_active_stop_order,
        d.has_official_sanction, d.official_sanction_date::TEXT,
        d.official_sanction_text, d.official_phone_public, d.shelter_status,
        d.official_last_checked_at::TEXT,
        ys.primary_pin_price_nis, ys.pin_requires_tilde,
        ys.min_price_nis, ys.max_price_nis,
        ys.total_reports_count, ys.price_display_mode,
        ys.price_trust_tier
      FROM public.daycares d
      LEFT JOIN public.daycare_year_summary ys
        ON ys.daycare_id = d.daycare_id AND ys.school_year = $1
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      ${paginationClause}
      `,
      rowsValues
    );

    const enriched = rowsRes.rows.map((r) => {
      const repPrice = r.primary_pin_price_nis;
      const mode = r.price_display_mode;
      const priceSummary =
        repPrice !== null && mode
          ? buildFormattedPriceSummary({
              schoolYear: activeSchoolYear,
              priceDisplayMode: mode,
              primaryPinPriceNis: repPrice,
              pinRequiresTilde:
                r.pin_requires_tilde ?? mode === 'range_discrepancy',
              minPriceNis: r.min_price_nis ?? repPrice,
              maxPriceNis: r.max_price_nis ?? repPrice,
              medianPriceNis: repPrice,
              reportsCount: Number(r.total_reports_count || 0),
              priceTrustTier:
                r.price_trust_tier || 'tier_3_unverified_report',
              isSubsidizedSymbol: r.is_subsidized_symbol,
              frameworkTrack: r.primary_track,
              cityMedianPriceNis,
            })
          : null;
      return { row: r, priceSummary };
    });

    const items: DaycareListItemDto[] = enriched.map(({ row: r, priceSummary }) => ({
      daycare_id: r.daycare_id,
      external_facility_id: r.external_facility_id,
      moe_symbol: r.moe_symbol,
      mol_symbol: r.mol_symbol,
      display_name: r.display_name,
      city_code: r.city_code,
      city_name_he: r.city_name_he,
      neighborhood_he: r.neighborhood_he,
      full_address_public: r.full_address_public,
      is_location_approximated: r.is_location_approximated,
      location: { lat: Number(r.lat), lng: Number(r.lng) },
      age_groups_supported: r.age_groups_supported,
      primary_track: r.primary_track,
      licensing_regime: r.licensing_regime,
      license_status: r.license_status,
      is_subsidized_symbol: r.is_subsidized_symbol,
      has_active_stop_order: r.has_active_stop_order,
      has_official_sanction: r.has_official_sanction,
      official_phone_public: stripMobilePhoneForBulkExport(
        r.official_phone_public
      ),
      shelter_status: r.shelter_status,
      official_last_checked_at: r.official_last_checked_at,
      regulatory_context_he: buildRegulatoryContextHe({
        licenseStatus: r.license_status,
        licensingRegime: r.licensing_regime,
        isSubsidizedSymbol: r.is_subsidized_symbol,
        moeSymbol: r.moe_symbol,
        molSymbol: r.mol_symbol,
        hasActiveStopOrder: r.has_active_stop_order,
        hasOfficialSanction: r.has_official_sanction,
        officialSanctionDate: r.official_sanction_date,
        officialSanctionText: r.official_sanction_text,
        officialLastCheckedAt: r.official_last_checked_at,
      }),
      price_summary_current_year: priceSummary,
    }));

    const mapPins: CompactMapPinDto[] | undefined = isMapPins
      ? enriched.map(({ row: r, priceSummary }) => ({
          id: r.daycare_id,
          name: r.display_name,
          city_code: r.city_code,
          lat: Number(r.lat),
          lng: Number(r.lng),
          track: r.primary_track,
          license_status: r.license_status,
          subsidized: r.is_subsidized_symbol,
          stop_order: r.has_active_stop_order,
          sanction: r.has_official_sanction,
          price_nis: priceSummary?.primary_pin_price_nis ?? null,
          pin_label: priceSummary?.formatted_pin_label ?? '+ הוסף מחיר',
          tilde: priceSummary?.pin_requires_tilde ?? false,
          reports_count: priceSummary?.reports_count ?? 0,
          trust_tier: priceSummary?.price_trust_tier ?? null,
          relative_level: priceSummary?.relative_to_city_median ?? 'no_price',
        }))
      : undefined;

    return { items, mapPins, totalCount, cityMedianPriceNis };
  }

  async getDaycareDetails(
    daycareIdOrSymbol: string,
    schoolYear = getActiveSchoolYear()
  ): Promise<DaycareDetailDto | null> {
    const res = await this.roPool.query<{
      daycare_id: string;
      external_facility_id: string | null;
      moe_symbol: string | null;
      mol_symbol: string | null;
      display_name: string;
      official_registry_name: string | null;
      operator_entity_name: string | null;
      operator_corp_id: string | null;
      city_code: number;
      city_name_he: string;
      neighborhood_he: string | null;
      full_address_public: string;
      is_location_approximated: boolean;
      lat: number;
      lng: number;
      official_phone_public: string | null;
      official_capacity: number | null;
      age_groups_supported: DaycareAgeGroup[];
      primary_track: FrameworkTrack;
      licensing_regime: LicensingRegime;
      license_status: DaycareLicenseStatus;
      is_official_source: boolean;
      is_subsidized_symbol: boolean;
      has_active_stop_order: boolean;
      has_official_sanction: boolean;
      official_sanction_date: string | null;
      official_sanction_text: string | null;
      shelter_status: TriStateStatus;
      cameras_0_3_status: TriStateStatus;
      official_last_checked_at: string;
    }>(
      `
      SELECT
        daycare_id, external_facility_id, moe_symbol, mol_symbol,
        display_name, official_registry_name, operator_entity_name,
        operator_corp_id, city_code, city_name_he, neighborhood_he,
        full_address_public, is_location_approximated,
        ST_Y(geom) AS lat, ST_X(geom) AS lng,
        official_phone_public, official_capacity, age_groups_supported,
        primary_track, licensing_regime, license_status,
        is_official_source, is_subsidized_symbol, has_active_stop_order,
        has_official_sanction, official_sanction_date::TEXT,
        official_sanction_text, shelter_status, cameras_0_3_status,
        official_last_checked_at::TEXT
      FROM public.daycares
      WHERE daycare_id::TEXT = $1
         OR moe_symbol = $1
         OR mol_symbol = $1
         OR external_facility_id = $1
      LIMIT 1
      `,
      [daycareIdOrSymbol]
    );
    const d = res.rows[0];
    if (!d) return null;

    const [extRes, reportsRes, allAggRes, peersRes] = await Promise.all([
      this.roPool.query<{
        source_system: string;
        external_record_id: string;
        source_license: string;
        last_synced_at: string;
      }>(
        `SELECT source_system, external_record_id, source_license, last_synced_at::TEXT
         FROM public.daycare_external_sources WHERE daycare_id = $1`,
        [d.daycare_id]
      ),
      this.roPool.query<{
        submission_id: string;
        school_year: number;
        school_year_label: string;
        source_type: ReportSourceType;
        monthly_list_price_nis: number;
        age_group: DaycareAgeGroup;
        framework_track: FrameworkTrack;
        hours_sun_thu_start: string | null;
        hours_sun_thu_end: string | null;
        is_full_day: boolean;
        includes_friday: boolean | null;
        hours_fri_start: string | null;
        hours_fri_end: string | null;
        includes_nutrition: boolean | null;
        reported_size_bucket: SizeBucket;
        reported_shelter_status: TriStateStatus;
        reported_cameras_0_3: TriStateStatus;
      }>(
        `SELECT * FROM public.daycare_tuition_reports
         WHERE daycare_id = $1
         ORDER BY school_year DESC, submission_id DESC`,
        [d.daycare_id]
      ),
      this.roPool.query<{
        school_year: number;
        age_group: DaycareAgeGroup;
        framework_track: FrameworkTrack;
        is_full_day: boolean;
        reports_count: number;
        live_verified_reports_count: number;
        price_display_mode:
          | 'single'
          | 'range_discrepancy'
          | 'average_close'
          | 'median_consensus';
        primary_pin_price_nis: number;
        min_price_nis: number;
        max_price_nis: number;
        median_price_nis: number;
        p25_price_nis: number;
        p75_price_nis: number;
        price_trust_tier:
          | 'tier_2_parent_consensus'
          | 'tier_3_unverified_report';
        last_updated_month: string;
      }>(
        `SELECT * FROM public.daycare_price_aggregates
         WHERE daycare_id = $1
         ORDER BY school_year ASC`,
        [d.daycare_id]
      ),
      this.roPool.query<{
        primary_pin_price_nis: number;
        within_1km: boolean;
      }>(
        `
        SELECT
          ys.primary_pin_price_nis,
          ST_DWithin(
            peer.geom::geography,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
            1000
          ) AS within_1km
        FROM public.daycares peer
        JOIN public.daycare_year_summary ys
          ON ys.daycare_id = peer.daycare_id AND ys.school_year = $1
        WHERE peer.is_official_source = TRUE
          AND peer.is_active_in_registry = TRUE
          AND peer.city_code = $2
          AND peer.primary_track = $5::public.framework_track_enum
          AND ys.primary_pin_price_nis IS NOT NULL
        `,
        [schoolYear, d.city_code, Number(d.lng), Number(d.lat), d.primary_track]
      ),
    ]);

    const allYearMatrix = allAggRes.rows.map((a) => ({
      school_year: a.school_year,
      school_year_label: formatSchoolYearLabel(a.school_year),
      age_group: a.age_group,
      age_group_label_he: AGE_GROUP_LABELS_HE[a.age_group] || a.age_group,
      framework_track: a.framework_track,
      is_full_day: a.is_full_day,
      reports_count: Number(a.reports_count),
      live_verified_reports_count: Number(a.live_verified_reports_count),
      price_display_mode: a.price_display_mode,
      representative_price_nis: a.primary_pin_price_nis,
      min_price_nis: a.min_price_nis,
      max_price_nis: a.max_price_nis,
      median_price_nis: a.median_price_nis,
      p25_price_nis: a.p25_price_nis,
      p75_price_nis: a.p75_price_nis,
      price_trust_tier: a.price_trust_tier,
      last_updated_month: a.last_updated_month,
    }));

    const currentYearMatrix = allYearMatrix.filter(
      (a) => a.school_year === schoolYear
    );

    // Build YoY history (D-30)
    const firstPrice = allYearMatrix[0]?.representative_price_nis ?? null;
    const priceHistoryYoy: DaycareDetailDto['price_history_yoy'] =
      allYearMatrix.map((curr, idx) => {
        const prev = idx > 0 ? allYearMatrix[idx - 1] : null;
        const yoyDiffNis = prev
          ? curr.representative_price_nis - prev.representative_price_nis
          : null;
        const yoyDiffPct =
          prev && prev.representative_price_nis > 0
            ? Number(
                (
                  ((curr.representative_price_nis -
                    prev.representative_price_nis) /
                    prev.representative_price_nis) *
                  100
                ).toFixed(1)
              )
            : null;
        const cumDiffNis =
          idx > 0 && firstPrice !== null
            ? curr.representative_price_nis - firstPrice
            : null;
        const cumDiffPct =
          idx > 0 && firstPrice && firstPrice > 0
            ? Number(
                (
                  ((curr.representative_price_nis - firstPrice) / firstPrice) *
                  100
                ).toFixed(1)
              )
            : null;

        return {
          school_year: curr.school_year,
          school_year_label: curr.school_year_label,
          age_group: curr.age_group,
          is_full_day: curr.is_full_day,
          representative_price_nis: curr.representative_price_nis,
          reports_count: curr.reports_count,
          yoy_diff_nis: yoyDiffNis,
          yoy_diff_pct: yoyDiffPct,
          cumulative_diff_nis: cumDiffNis,
          cumulative_diff_pct: cumDiffPct,
        };
      });

    // Benchmarks (D-30, D-38: N >= 3 threshold)
    const targetPrice = currentYearMatrix[0]?.representative_price_nis ?? null;
    const cityTrackPrices = peersRes.rows.map((p) =>
      Number(p.primary_pin_price_nis)
    );
    const radiusPrices = peersRes.rows
      .filter((p) => p.within_1km)
      .map((p) => Number(p.primary_pin_price_nis));

    const comparisons: DaycareDetailDto['benchmarks']['comparisons'] = [];
    const addComparison = (
      scope: 'radius_1km' | 'city_all_same_track' | 'city_similar_params',
      labelHe: string,
      prices: number[]
    ) => {
      if (prices.length < 3 || targetPrice === null) return;
      const sorted = [...prices].sort((a, b) => a - b);
      const med = computePercentile(sorted, 0.5);
      const p25 = computePercentile(sorted, 0.25);
      const p75 = computePercentile(sorted, 0.75);
      const diffNis = targetPrice - med;
      const diffPct = med > 0 ? Number(((diffNis / med) * 100).toFixed(1)) : 0;
      comparisons.push({
        benchmark_scope: scope,
        label_he: labelHe,
        sample_daycares_n: sorted.length,
        median_price_nis: med,
        p25_price_nis: p25,
        p75_price_nis: p75,
        diff_from_median_nis: diffNis,
        diff_from_median_pct: diffPct,
      });
    };

    addComparison(
      'radius_1km',
      `גנים ברדיוס 1 ק״מ (${d.neighborhood_he || d.city_name_he})`,
      radiusPrices
    );
    addComparison(
      'city_all_same_track',
      `כלל הגנים הפרטיים ב${d.city_name_he}`,
      cityTrackPrices
    );
    addComparison(
      'city_similar_params',
      `גנים דומים בעיר (${d.city_name_he} · יום מלא)`,
      cityTrackPrices
    );

    const regulatedSymbolBenchmark = 2515;
    const annualGap =
      targetPrice !== null
        ? (targetPrice - regulatedSymbolBenchmark) * 12
        : null;

    return {
      daycare: {
        daycare_id: d.daycare_id,
        external_facility_id: d.external_facility_id,
        moe_symbol: d.moe_symbol,
        mol_symbol: d.mol_symbol,
        display_name: d.display_name,
        official_registry_name: d.official_registry_name,
        operator_entity_name: d.operator_entity_name,
        operator_corp_id: d.operator_corp_id,
        city_code: d.city_code,
        city_name_he: d.city_name_he,
        neighborhood_he: d.neighborhood_he,
        full_address_public: d.full_address_public,
        is_location_approximated: d.is_location_approximated,
        location: { lat: Number(d.lat), lng: Number(d.lng) },
        official_phone_public: d.official_phone_public,
        official_capacity: d.official_capacity,
        age_groups_supported: d.age_groups_supported,
        primary_track: d.primary_track,
        licensing_regime: d.licensing_regime,
        license_status: d.license_status,
        is_official_source: d.is_official_source,
        is_subsidized_symbol: d.is_subsidized_symbol,
        trust_tier: 'tier_1_official',
        has_active_stop_order: d.has_active_stop_order,
        has_official_sanction: d.has_official_sanction,
        official_sanction_date: d.official_sanction_date,
        official_sanction_text: d.official_sanction_text,
        shelter_status: d.shelter_status,
        cameras_0_3_status: d.cameras_0_3_status,
        official_last_checked_at: d.official_last_checked_at,
        regulatory_context_he: buildRegulatoryContextHe({
          licenseStatus: d.license_status,
          licensingRegime: d.licensing_regime,
          isSubsidizedSymbol: d.is_subsidized_symbol,
          moeSymbol: d.moe_symbol,
          molSymbol: d.mol_symbol,
          hasActiveStopOrder: d.has_active_stop_order,
          hasOfficialSanction: d.has_official_sanction,
          officialSanctionDate: d.official_sanction_date,
          officialSanctionText: d.official_sanction_text,
          officialLastCheckedAt: d.official_last_checked_at,
        }),
        external_sources: extRes.rows,
      },
      price_matrix_by_age: currentYearMatrix,
      price_history_yoy: priceHistoryYoy,
      benchmarks: {
        target_price_nis: targetPrice,
        regulated_symbol_benchmark_nis: regulatedSymbolBenchmark,
        private_vs_regulated_annual_gap_nis: annualGap,
        comparisons,
      },
      individual_reports: reportsRes.rows.map((r) => ({
        submission_id: r.submission_id,
        school_year: r.school_year,
        school_year_label: formatSchoolYearLabel(r.school_year),
        source_type: r.source_type,
        source_label_he:
          r.source_type === 'community_sheet_tlv_seed'
            ? 'גיליון הורים קהילתי'
            : 'דיווח הורה מאומת',
        monthly_list_price_nis: r.monthly_list_price_nis,
        age_group: r.age_group,
        framework_track: r.framework_track,
        hours_sun_thu_start: r.hours_sun_thu_start
          ? r.hours_sun_thu_start.slice(0, 5)
          : null,
        hours_sun_thu_end: r.hours_sun_thu_end
          ? r.hours_sun_thu_end.slice(0, 5)
          : null,
        is_full_day: r.is_full_day,
        includes_friday: r.includes_friday,
        hours_fri_start: r.hours_fri_start ? r.hours_fri_start.slice(0, 5) : null,
        hours_fri_end: r.hours_fri_end ? r.hours_fri_end.slice(0, 5) : null,
        includes_nutrition: r.includes_nutrition,
        reported_size_bucket: r.reported_size_bucket,
        reported_shelter_status: r.reported_shelter_status,
        reported_cameras_0_3: r.reported_cameras_0_3,
      })),
    };
  }

  async getAreaPriceStats(params: {
    city_code?: number;
    city_name_he?: string;
    neighborhood_he?: string;
    age_group?: DaycareAgeGroup;
    framework_track?: FrameworkTrack;
    school_year?: number;
  }): Promise<AreaStatsDto> {
    const yr = params.school_year || getActiveSchoolYear();
    const track = params.framework_track || 'private_full_day';

    let resolvedCity = BASELINE_ISRAEL_CITIES.find(
      (c) =>
        (params.city_code && c.cityCode === params.city_code) ||
        (params.city_name_he &&
          normalizeCityName(c.cityNameHe).includes(
            normalizeCityName(params.city_name_he)
          ))
    );
    const cityCode = params.city_code || resolvedCity?.cityCode || 5000;
    const cityNameHe =
      params.city_name_he || resolvedCity?.cityNameHe || 'תל אביב - יפו';

    const countRes = await this.roPool.query<{
      total_cnt: string;
      subsidized_cnt: string;
    }>(
      `SELECT
        COUNT(*)::TEXT AS total_cnt,
        COUNT(*) FILTER (WHERE is_subsidized_symbol)::TEXT AS subsidized_cnt
       FROM public.daycares
       WHERE is_official_source = TRUE AND is_active_in_registry = TRUE AND city_code = $1`,
      [cityCode]
    );
    const totalCnt = Number(countRes.rows[0]?.total_cnt || 0);
    const subCnt = Number(countRes.rows[0]?.subsidized_cnt || 0);

    const priceRes = params.age_group
      ? await this.roPool.query<{ price: number }>(
          `
          SELECT a.primary_pin_price_nis AS price
          FROM public.daycares d
          JOIN public.daycare_price_aggregates a
            ON a.daycare_id = d.daycare_id
           AND a.school_year = $1
           AND a.age_group = $4::public.age_group_enum
          WHERE d.is_official_source = TRUE
            AND d.is_active_in_registry = TRUE
            AND d.city_code = $2
            AND d.primary_track = $3::public.framework_track_enum
            AND a.primary_pin_price_nis IS NOT NULL
          `,
          [yr, cityCode, track, params.age_group]
        )
      : await this.roPool.query<{ price: number }>(
          `
          SELECT ys.primary_pin_price_nis AS price
          FROM public.daycares d
          JOIN public.daycare_year_summary ys
            ON ys.daycare_id = d.daycare_id AND ys.school_year = $1
          WHERE d.is_official_source = TRUE
            AND d.is_active_in_registry = TRUE
            AND d.city_code = $2
            AND d.primary_track = $3::public.framework_track_enum
            AND ys.primary_pin_price_nis IS NOT NULL
          `,
          [yr, cityCode, track]
        );

    const prices = priceRes.rows
      .map((r) => Number(r.price))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    const median = prices.length > 0 ? computePercentile(prices, 0.5) : null;
    const p25 = prices.length > 0 ? computePercentile(prices, 0.25) : null;
    const p75 = prices.length > 0 ? computePercentile(prices, 0.75) : null;
    const minP = prices.length > 0 ? prices[0] : null;
    const maxP = prices.length > 0 ? prices[prices.length - 1] : null;

    const regBenchmark =
      BASELINE_REGULATED_BENCHMARKS.find(
        (b) =>
          b.schoolYear === yr &&
          b.frameworkTrack ===
            (track === 'municipal_tzaharon'
              ? 'municipal_tzaharon'
              : 'symbol_regulated') &&
          (params.age_group ? b.ageGroup === params.age_group : b.ageGroup === '1_2')
      )?.monthlyMaxPriceNis ?? 2515;

    return {
      city_code: cityCode,
      city_name_he: cityNameHe,
      school_year: yr,
      school_year_label: formatSchoolYearLabel(yr),
      framework_track: track,
      age_group: params.age_group || 'all',
      total_official_daycares: totalCnt,
      daycares_with_price_reports: prices.length,
      subsidized_daycares_count: subCnt,
      private_daycares_count: totalCnt - subCnt,
      median_price_nis: median,
      p25_price_nis: p25,
      p75_price_nis: p75,
      min_price_nis: minP,
      max_price_nis: maxP,
      regulated_benchmark_nis: regBenchmark,
      annual_gap_vs_regulated_nis:
        median !== null ? (median - regBenchmark) * 12 : null,
    };
  }

  async autocompleteLocations(params: {
    q: string;
    city_code?: number;
    limit?: number;
  }): Promise<AutocompleteLocationDto[]> {
    const q = params.q.trim();
    if (q.length < 2) return [];
    const limit = Math.min(25, Math.max(1, params.limit || 10));
    const normQ = normalizeCityName(q);

    const results: AutocompleteLocationDto[] = [];
    for (const c of BASELINE_ISRAEL_CITIES) {
      if (params.city_code !== undefined && c.cityCode !== params.city_code) {
        continue;
      }
      if (
        c.cityNameHe.includes(q) ||
        normalizeCityName(c.cityNameHe).includes(normQ)
      ) {
        results.push({
          kind: 'city',
          id: `city:${c.cityCode}`,
          label_he: c.cityNameHe,
          city_code: c.cityCode,
          city_name_he: c.cityNameHe,
          lat: c.lat,
          lng: c.lng,
        });
      }
    }

    const values: unknown[] = [`%${q}%`];
    const cityFilter =
      params.city_code !== undefined
        ? (values.push(params.city_code), `AND city_code = $${values.length}`)
        : '';
    values.push(limit);
    const limitIdx = `$${values.length}`;

    const res = await this.roPool.query<{
      daycare_id: string;
      display_name: string;
      city_code: number;
      city_name_he: string;
      full_address_public: string;
      lat: number;
      lng: number;
    }>(
      `SELECT daycare_id, display_name, city_code, city_name_he, full_address_public,
              ST_Y(geom) AS lat, ST_X(geom) AS lng
       FROM public.daycares
       WHERE is_official_source = TRUE AND is_active_in_registry = TRUE
         ${cityFilter}
         AND (display_name ILIKE $1 OR full_address_public ILIKE $1 OR city_name_he ILIKE $1)
       LIMIT ${limitIdx}`,
      values
    );
    for (const r of res.rows) {
      results.push({
        kind: 'daycare',
        id: r.daycare_id,
        label_he: `${r.display_name} (${r.full_address_public})`,
        city_code: r.city_code,
        city_name_he: r.city_name_he,
        lat: Number(r.lat),
        lng: Number(r.lng),
      });
    }
    return results.slice(0, limit);
  }

  async getSanityCheckReferenceMedian(params: {
    daycareId: string;
    schoolYear: number;
    frameworkTrack: FrameworkTrack;
    ageGroup: DaycareAgeGroup;
  }): Promise<number> {
    const res = await this.roPool.query<{ median: number }>(
      `
      SELECT public.get_sanity_check_reference_median(
        (SELECT city_code FROM public.daycares WHERE daycare_id = $1),
        $2::SMALLINT,
        $3::public.framework_track_enum,
        $4::public.age_group_enum
      ) AS median
      `,
      [
        params.daycareId,
        params.schoolYear,
        params.frameworkTrack,
        params.ageGroup,
      ]
    );
    return res.rows[0]?.median ?? 5400;
  }

  async submitParentReportBlindUpsert(
    input: BlindReportSubmissionInput
  ): Promise<boolean> {
    await this.writePool.query(
      `
      SELECT app_private.submit_parent_report_blind_upsert(
        $1::UUID, $2::SMALLINT, $3::CHAR(64), $4::CHAR(64), $5::CHAR(7),
        $6::INTEGER, $7::public.age_group_enum, $8::public.framework_track_enum,
        $9::TIME, $10::TIME, $11::BOOLEAN, $12::TIME, $13::TIME,
        $14::BOOLEAN, $15::public.size_bucket_enum, $16::public.tri_state_status_enum,
        $17::public.tri_state_status_enum, $18::BOOLEAN, $19::BOOLEAN, $20::BOOLEAN
      )
      `,
      [
        input.daycareId,
        input.schoolYear,
        input.dedupToken,
        input.quotaHash,
        input.reportedMonth,
        input.monthlyListPriceNis,
        input.ageGroup,
        input.frameworkTrack,
        input.hoursSunThuStart,
        input.hoursSunThuEnd,
        input.includesFriday,
        input.hoursFriStart,
        input.hoursFriEnd,
        input.includesNutrition,
        input.reportedSizeBucket,
        input.reportedShelterStatus,
        input.reportedCameras03,
        input.isStandardListPriceConfirmed,
        input.isOutlierConfirmedByUser,
        input.replaceAllAgesForToken,
      ]
    );
    return true;
  }

  async withdrawParentReportBlind(params: {
    daycareId: string;
    schoolYear: number;
    dedupToken: string;
    ageGroup?: DaycareAgeGroup | null;
  }): Promise<boolean> {
    await this.writePool.query(
      `
      SELECT app_private.withdraw_parent_report_blind(
        $1::UUID, $2::SMALLINT, $3::CHAR(64), $4::public.age_group_enum
      )
      `,
      [
        params.daycareId,
        params.schoolYear,
        params.dedupToken,
        params.ageGroup || null,
      ]
    );
    return true;
  }

  async createCorrectionRequest(params: {
    daycareId: string;
    issueCategory: CorrectionRequestRecord['issue_category'];
    structuredDetails: Record<string, unknown>;
    reportedMonth: string;
  }): Promise<string> {
    const res = await this.writePool.query<{ request_id: string }>(
      `
      INSERT INTO app_private.correction_requests (
        daycare_id, issue_category, structured_details, reported_month
      ) VALUES ($1::UUID, $2, $3::JSONB, $4::CHAR(7))
      RETURNING request_id
      `,
      [
        params.daycareId,
        params.issueCategory,
        JSON.stringify(params.structuredDetails),
        params.reportedMonth,
      ]
    );
    return res.rows[0].request_id;
  }

  async listCorrectionRequests(status?: CorrectionRequestRecord['status']) {
    const query = status
      ? 'SELECT request_id, daycare_id, issue_category, structured_details, status, reported_month FROM app_private.correction_requests WHERE status = $1 ORDER BY reported_month DESC'
      : 'SELECT request_id, daycare_id, issue_category, structured_details, status, reported_month FROM app_private.correction_requests ORDER BY reported_month DESC';
    const res = await this.writePool.query<CorrectionRequestRecord>(
      query,
      status ? [status] : []
    );
    return res.rows;
  }

  async resolveCorrectionRequest(params: {
    requestId: string;
    newStatus: 'resolved' | 'rejected';
    hideSubmissionId?: string;
  }) {
    await this.writePool.query(
      'UPDATE app_private.correction_requests SET status = $1 WHERE request_id = $2::UUID',
      [params.newStatus, params.requestId]
    );
    if (params.hideSubmissionId) {
      await this.writePool.query(
        'UPDATE app_private.survey_submissions SET is_flagged_hidden = TRUE WHERE submission_id = $1::UUID',
        [params.hideSubmissionId]
      );
    }
    return true;
  }
}
