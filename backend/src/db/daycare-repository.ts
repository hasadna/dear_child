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

  constructor() {
    this.seedInitialOfficialData();
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
              ? 'מקור: גיליון הורים קהילתי · דורש אימות מחדש'
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
  private readonly fallbackMemory = new InMemoryDaycareRepository();

  constructor(
    private readonly roPool: pg.Pool,
    private readonly writePool: pg.Pool
  ) {}

  async searchDaycares(query: DaycareSearchQuery) {
    return this.fallbackMemory.searchDaycares(query);
  }

  async getDaycareDetails(daycareIdOrSymbol: string, schoolYear?: number) {
    return this.fallbackMemory.getDaycareDetails(daycareIdOrSymbol, schoolYear);
  }

  async getAreaPriceStats(params: {
    city_code?: number;
    city_name_he?: string;
    neighborhood_he?: string;
    age_group?: DaycareAgeGroup;
    framework_track?: FrameworkTrack;
    school_year?: number;
  }) {
    return this.fallbackMemory.getAreaPriceStats(params);
  }

  async autocompleteLocations(params: {
    q: string;
    city_code?: number;
    limit?: number;
  }) {
    return this.fallbackMemory.autocompleteLocations(params);
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
    return this.fallbackMemory.listCorrectionRequests(status);
  }

  async resolveCorrectionRequest(params: {
    requestId: string;
    newStatus: 'resolved' | 'rejected';
    hideSubmissionId?: string;
  }) {
    return this.fallbackMemory.resolveCorrectionRequest(params);
  }
}
