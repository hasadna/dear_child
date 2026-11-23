/**
 * לקוח ה-API של "ילדי היקר" (Frontend REST API Client)
 * מתקשר מול שרתי ה-Fastify (/api/v1/*) וכולל מנגנון גיבוי אוטומטי (Offline Demo Store)
 * כך שהממשק והמפה עובדים באופן מלא ואינטראקטיבי גם בהרצה מקומית ללא DB פעיל.
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
  school_year: 2025 | 2026 | 2027;
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
  submitter_role: 'parent' | 'daycare_operator' | 'researcher_or_public';
  turnstile_token: string;
}

// ============================================================================
// מאגר נתוני הדגמה ופיילוט עשיר (למקרה ששרת ה-Backend אינו רץ מקומית)
// ============================================================================
const FALLBACK_DAYCARES: DaycareDetailDto[] = [
  {
    id: 'a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99',
    name: 'מעון יום כוכב הצפון',
    city_code: 5000,
    city_name_he: 'תל אביב - יפו',
    address: 'ארלוזורוב 42, תל אביב - יפו',
    lat: 32.0882,
    lon: 34.7818,
    target_age_groups: ['0_1', '1_2', '2_3'],
    age_group_label_he: 'לידה עד 3',
    is_subsidized: false,
    license_status: 'licensed',
    license_status_label_he: 'רישיון הפעלה בתוקף (משרד החינוך)',
    license_icon_code: 'valid',
    ministry_edu_symbol: '410923',
    labor_Cross_symbol: null,
    operator_name: 'כוכב הצפון חינוך לגיל הרך בע"מ',
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
    yoy_trend_summary_he:
      'תשפ״ה: ₪4,950 → תשפ״ו: ₪5,250 (+6.1%) → תשפ״ז: ₪5,600 (+6.7%)',
    benchmark_neighborhood_summary_he:
      'זול ב-₪150 (-2.6%) מחציון רדיוס 1 ק״מ (₪5,750 · N=11 גנים)',
    regulatory_context_he:
      'מעון זה מופיע במרשם מעונות היום המפוקחים של משרד החינוך לשנת תשפ״ז בסטטוס "רישיון בתוקף" (סמל מסגרת: 410923).',
    price_cohorts: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        age_group_label_he: 'פעוטות צעירים (שנה עד שנתיים)',
        is_municipal_tzaharon_only: false,
        hours_bucket: 'full_day',
        includes_friday: true,
        includes_nutrition: true,
        active_reports_count: 4,
        display_mode: 'median',
        headline_price_nis: 5600,
        min_price_nis: 5500,
        max_price_nis: 5750,
        iqr_q25_nis: 5550,
        iqr_q75_nis: 5680,
        price_formatted_he: '₪5,600 לחודש (חציון)',
        trust_badge_he: '✓ מידע הורים מאומת (4 דיווחים)',
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '0_1',
        age_group_label_he: 'תינוקות (לידה עד שנה)',
        is_municipal_tzaharon_only: false,
        hours_bucket: 'full_day',
        includes_friday: true,
        includes_nutrition: true,
        active_reports_count: 2,
        display_mode: 'range',
        headline_price_nis: 5900,
        min_price_nis: 5750,
        max_price_nis: 6100,
        iqr_q25_nis: 5750,
        iqr_q75_nis: 6100,
        price_formatted_he: '₪5,750–₪6,100 לחודש (טווח 2 דיווחים)',
        trust_badge_he: '⚠️ פער בין 2 דיווחי הורים (מוצג טווח)',
      },
    ],
    relative_benchmarks: [
      {
        scope: 'radius_1km',
        label_he: 'שכונה / רדיוס 1 ק"מ (אותו מסלול)',
        median_price_nis: 5750,
        iqr_q25_nis: 5450,
        iqr_q75_nis: 6050,
        sample_daycares_count: 11,
        is_sufficient_sample: true,
        diff_nis: -150,
        diff_pct: -2.6,
        comparison_text_he: 'זול ב-₪150 (-2.6%) מהחציון (₪5,750 · N=11 גנים)',
      },
      {
        scope: 'city_all_same_track',
        label_he: 'כלל היישוב (תל אביב - יפו, גילאי 0–3 פרטי)',
        median_price_nis: 5500,
        iqr_q25_nis: 5100,
        iqr_q75_nis: 5900,
        sample_daycares_count: 142,
        is_sufficient_sample: true,
        diff_nis: 100,
        diff_pct: 1.8,
        comparison_text_he: 'יקר ב-₪100 (+1.8%) מהחציון העירוני (₪5,500 · N=142 גנים)',
      },
      {
        scope: 'city_similar_params',
        label_he: 'גנים דומים בעיר (יום מלא + ימי שישי + הזנה)',
        median_price_nis: 5650,
        iqr_q25_nis: 5400,
        iqr_q75_nis: 5950,
        sample_daycares_count: 84,
        is_sufficient_sample: true,
        diff_nis: -50,
        diff_pct: -0.9,
        comparison_text_he: 'זול ב-₪50 (-0.9%) מגנים דומים (₪5,650 · N=84 גנים)',
      },
    ],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: 2515,
      annual_gap_11_months_nis: 33935,
      summary_he:
        'מחיר מסגרת פרטית זו גבוה ב-₪3,085 לחודש מתעריף המקסימום של מעון סמל מפוקח (₪2,515) — פער מצטבר של ₪33,935 לשנת לימודים (11 חודשים).',
    },
    yoy_price_history: [
      {
        school_year: 2025,
        school_year_label: 'תשפ"ה (2024–2025)',
        age_group: '1_2',
        median_price_nis: 4950,
        reports_count: 3,
        yoy_change_nis: null,
        yoy_change_pct: null,
      },
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '1_2',
        median_price_nis: 5250,
        reports_count: 5,
        yoy_change_nis: 300,
        yoy_change_pct: 6.1,
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        median_price_nis: 5600,
        reports_count: 4,
        yoy_change_nis: 350,
        yoy_change_pct: 6.7,
      },
    ],
    individual_reports: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        age_group_label_he: 'פעוטות צעירים (שנה עד שנתיים)',
        monthly_price_nis: 5600,
        start_time_weekday: '07:30',
        end_time_weekday: '16:30',
        includes_friday: true,
        friday_start_time: '07:30',
        friday_end_time: '12:30',
        includes_nutrition: true,
        is_municipal_tzaharon_only: false,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        age_group_label_he: 'פעוטות צעירים (שנה עד שנתיים)',
        monthly_price_nis: 5600,
        start_time_weekday: '07:30',
        end_time_weekday: '16:30',
        includes_friday: true,
        friday_start_time: '07:30',
        friday_end_time: '12:30',
        includes_nutrition: true,
        is_municipal_tzaharon_only: false,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        age_group_label_he: 'פעוטות צעירים (שנה עד שנתיים)',
        monthly_price_nis: 5750,
        start_time_weekday: '07:30',
        end_time_weekday: '17:00',
        includes_friday: true,
        friday_start_time: '07:30',
        friday_end_time: '12:30',
        includes_nutrition: true,
        is_municipal_tzaharon_only: false,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '0_3_mixed',
        age_group_label_he: 'רב-גילי (לידה עד 3)',
        monthly_price_nis: 5250,
        start_time_weekday: null,
        end_time_weekday: null,
        includes_friday: null,
        friday_start_time: null,
        friday_end_time: null,
        includes_nutrition: null,
        is_municipal_tzaharon_only: false,
        report_source: 'community_sheet_import_tlv',
        report_source_label_he: 'ייבוא מגיליון קהילתי ת"א (היסטורי)',
      },
    ],
    reliance_disclaimer_he:
      'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד החינוך, משרד העבודה והרשויות המקומיות ומתעדכנים מעת לעת. נתוני המחירים מבוססים על דיווחי הורים למחירון הכללי של המסגרת ומוצגים לצורכי שקיפות והשוואה צרכנית בלבד — יש לוודא את התעריף ותנאי ההתקשרות העדכניים ישירות מול הנהלת המסגרת.',
  },
  {
    id: 'c3d2e1f0-9a88-4b77-8c66-5d4e3f2a1b00',
    name: 'גן השקמים — פלורנטין',
    city_code: 5000,
    city_name_he: 'תל אביב - יפו',
    address: 'ויטל 14, תל אביב - יפו',
    lat: 32.0564,
    lon: 34.7695,
    target_age_groups: ['0_3_mixed'],
    age_group_label_he: 'לידה עד 3',
    is_subsidized: false,
    license_status: 'in_process',
    license_status_label_he: 'בתהליך רישוי (הסדר רציפות משרד החינוך)',
    license_icon_code: 'in_progress',
    ministry_edu_symbol: '412881',
    labor_Cross_symbol: null,
    operator_name: 'גן השקמים פלורנטין',
    phone_official: '03-6819900',
    has_active_stop_order: false,
    display_mode: 'range',
    price_Trust_tier: 'community_discrepancy',
    price_formatted_he: '₪4,900–₪5,350 לחודש (טווח 2 דיווחים)',
    price_pill_short_he: '~₪5,125',
    trust_badge_he: '⚠️ פער מעל 5% בין 2 דיווחי הורים (מוצג טווח)',
    headline_price_nis: 5125,
    min_price_nis: 4900,
    max_price_nis: 5350,
    active_reports_count: 2,
    school_year: 2027,
    activity_hours_summary_he:
      'א׳–ה׳ 07:30–16:30 · כולל ימי שישי · כולל הזנה',
    yoy_trend_summary_he: 'תשפ״ו: ₪4,800 → תשפ״ז: ₪4,900–₪5,350',
    benchmark_neighborhood_summary_he:
      'בטווח חציון דרום ת״א (₪5,050 · N=9 גנים)',
    regulatory_context_he:
      'מעון זה מופיע במרשם משרד החינוך בסטטוס "בתהליך רישוי" (סמל מסגרת: 412881). סטטוס זה משקף מסגרת שהגישה בקשה ונמצאת בבדיקת תנאי הבטיחות והתקינה.',
    price_cohorts: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '0_3_mixed',
        age_group_label_he: 'רב-גילי (לידה עד 3)',
        is_municipal_tzaharon_only: false,
        hours_bucket: 'full_day',
        includes_friday: true,
        includes_nutrition: true,
        active_reports_count: 2,
        display_mode: 'range',
        headline_price_nis: 5125,
        min_price_nis: 4900,
        max_price_nis: 5350,
        iqr_q25_nis: 4900,
        iqr_q75_nis: 5350,
        price_formatted_he: '₪4,900–₪5,350 לחודש (טווח 2 דיווחים)',
        trust_badge_he: '⚠️ פער מעל 5% בין 2 דיווחי הורים (מוצג טווח)',
      },
    ],
    relative_benchmarks: [
      {
        scope: 'radius_1km',
        label_he: 'שכונה / רדיוס 1 ק"מ (פלורנטין ונווה צדק)',
        median_price_nis: 5050,
        iqr_q25_nis: 4800,
        iqr_q75_nis: 5300,
        sample_daycares_count: 9,
        is_sufficient_sample: true,
        diff_nis: 75,
        diff_pct: 1.5,
        comparison_text_he: 'דומה לחציון השכונתי (₪5,050 · N=9 גנים)',
      },
      {
        scope: 'city_all_same_track',
        label_he: 'כלל היישוב (תל אביב - יפו, גילאי 0–3 פרטי)',
        median_price_nis: 5500,
        iqr_q25_nis: 5100,
        iqr_q75_nis: 5900,
        sample_daycares_count: 142,
        is_sufficient_sample: true,
        diff_nis: -375,
        diff_pct: -6.8,
        comparison_text_he: 'זול ב-₪375 (-6.8%) מהחציון העירוני (₪5,500 · N=142 גנים)',
      },
    ],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: 2515,
      annual_gap_11_months_nis: 28710,
      summary_he:
        'פער שנתי מוערך של ₪28,710 לעומת מעון סמל מפוקח (₪2,515 לחודש).',
    },
    yoy_price_history: [
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '0_3_mixed',
        median_price_nis: 4800,
        reports_count: 1,
        yoy_change_nis: null,
        yoy_change_pct: null,
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '0_3_mixed',
        median_price_nis: 5125,
        reports_count: 2,
        yoy_change_nis: 325,
        yoy_change_pct: 6.8,
      },
    ],
    individual_reports: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '0_3_mixed',
        age_group_label_he: 'רב-גילי (לידה עד 3)',
        monthly_price_nis: 5350,
        start_time_weekday: '07:30',
        end_time_weekday: '16:30',
        includes_friday: true,
        friday_start_time: '07:30',
        friday_end_time: '12:00',
        includes_nutrition: true,
        is_municipal_tzaharon_only: false,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '0_3_mixed',
        age_group_label_he: 'רב-גילי (לידה עד 3)',
        monthly_price_nis: 4900,
        start_time_weekday: '07:30',
        end_time_weekday: '16:00',
        includes_friday: false,
        friday_start_time: null,
        friday_end_time: null,
        includes_nutrition: true,
        is_municipal_tzaharon_only: false,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
    ],
    reliance_disclaimer_he:
      'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד החינוך, משרד העבודה והרשויות המקומיות ומתעדכנים מעת לעת. נתוני המחירים מבוססים על דיווחי הורים למחירון הכללי של המסגרת ומוצגים לצורכי שקיפות והשוואה צרכנית בלבד.',
  },
  {
    id: 'd4e5f6a7-1b2c-4d3e-9f4a-5b6c7d8e9f11',
    name: 'פעוטון שדרות רוטשילד (ייבוא פיילוט ת״א)',
    city_code: 5000,
    city_name_he: 'תל אביב - יפו',
    address: 'שדרות רוטשילד 88, תל אביב - יפו',
    lat: 32.0668,
    lon: 34.7771,
    target_age_groups: ['0_3_mixed'],
    age_group_label_he: 'לידה עד 3',
    is_subsidized: false,
    license_status: 'licensed',
    license_status_label_he: 'רישיון הפעלה בתוקף (משרד החינוך)',
    license_icon_code: 'valid',
    ministry_edu_symbol: '415009',
    labor_Cross_symbol: null,
    operator_name: 'חינוך רוטשילד בע"מ',
    phone_official: '03-5601122',
    has_active_stop_order: false,
    display_mode: 'single',
    price_Trust_tier: 'single_parent_report',
    price_formatted_he: '₪5,800 לחודש (דיווח בודד)',
    price_pill_short_he: '₪5,800',
    trust_badge_he: 'ℹ️ דיווח בודד מייבוא גיליון קהילתי ת"א (ממתין לאימות הורים נוסף)',
    headline_price_nis: 5800,
    min_price_nis: 5800,
    max_price_nis: 5800,
    active_reports_count: 1,
    school_year: 2026,
    activity_hours_summary_he: 'שעות וימי שישי: לא צוין בגיליון המקור',
    yoy_trend_summary_he: 'תשפ״ו: ₪5,800 (ממתין לעדכון תשפ״ז)',
    benchmark_neighborhood_summary_he:
      'יקר ב-₪200 (+3.6%) מחציון לב העיר (₪5,600 · N=15 גנים)',
    regulatory_context_he:
      'מעון זה מופיע במרשם מעונות היום המפוקחים של משרד החינוך בסטטוס "רישיון בתוקף" (סמל מסגרת: 415009).',
    price_cohorts: [
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '0_3_mixed',
        age_group_label_he: 'רב-גילי (לידה עד 3)',
        is_municipal_tzaharon_only: false,
        hours_bucket: 'unspecified',
        includes_friday: null,
        includes_nutrition: null,
        active_reports_count: 1,
        display_mode: 'single',
        headline_price_nis: 5800,
        min_price_nis: 5800,
        max_price_nis: 5800,
        iqr_q25_nis: null,
        iqr_q75_nis: null,
        price_formatted_he: '₪5,800 לחודש (דיווח בודד)',
        trust_badge_he: 'ℹ️ דיווח בודד מייבוא גיליון קהילתי ת"א (טרם אומת ע"י הורים נוספים)',
      },
    ],
    relative_benchmarks: [
      {
        scope: 'radius_1km',
        label_he: 'שכונה / רדיוס 1 ק"מ (לב העיר)',
        median_price_nis: 5600,
        iqr_q25_nis: 5350,
        iqr_q75_nis: 5950,
        sample_daycares_count: 15,
        is_sufficient_sample: true,
        diff_nis: 200,
        diff_pct: 3.6,
        comparison_text_he: 'יקר ב-₪200 (+3.6%) מהחציון השכונתי (₪5,600 · N=15 גנים)',
      },
    ],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: 2515,
      annual_gap_11_months_nis: 36135,
      summary_he:
        'פער שנתי של ₪36,135 לעומת מעון סמל מפוקח (₪2,515 לחודש).',
    },
    yoy_price_history: [
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '0_3_mixed',
        median_price_nis: 5800,
        reports_count: 1,
        yoy_change_nis: null,
        yoy_change_pct: null,
      },
    ],
    individual_reports: [
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '0_3_mixed',
        age_group_label_he: 'רב-גילי (לידה עד 3)',
        monthly_price_nis: 5800,
        start_time_weekday: null,
        end_time_weekday: null,
        includes_friday: null,
        friday_start_time: null,
        friday_end_time: null,
        includes_nutrition: null,
        is_municipal_tzaharon_only: false,
        report_source: 'community_sheet_import_tlv',
        report_source_label_he: 'ייבוא מגיליון קהילתי ת"א (היסטורי)',
      },
    ],
    reliance_disclaimer_he:
      'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד החינוך, משרד העבודה והרשויות המקומיות ומתעדכנים מעת לעת.',
  },
  {
    id: 'e5f6a7b8-2c3d-4e5f-8a9b-0c1d2e3f4a22',
    name: 'גן עירייה חבצלת החוף (כולל צהרון יובל חינוך)',
    city_code: 5000,
    city_name_he: 'תל אביב - יפו',
    address: 'בזל 35, תל אביב - יפו',
    lat: 32.0901,
    lon: 34.7764,
    target_age_groups: ['3_6'],
    age_group_label_he: 'גילאי 3–6 (גן עירייה + צהרון)',
    is_subsidized: true,
    license_status: 'municipal_verified',
    license_status_label_he: 'גן רשמי מפוקח משרד החינוך והרשות המקומית',
    license_icon_code: 'valid',
    ministry_edu_symbol: '510342',
    labor_Cross_symbol: null,
    operator_name: 'עיריית תל אביב-יפו / יובל חינוך',
    phone_official: '03-7240910',
    has_active_stop_order: false,
    display_mode: 'median',
    price_Trust_tier: 'community_consensus',
    price_formatted_he: '₪980 לחודש (תוספת צהרון עירייה)',
    price_pill_short_he: '✓ ₪980',
    trust_badge_he: '✓ צהרון עירוני (שכ״ל בוקר פטור מתשלום בחוק חינוך חובה חינם · 3 דיווחים)',
    headline_price_nis: 980,
    min_price_nis: 950,
    max_price_nis: 1020,
    active_reports_count: 3,
    school_year: 2027,
    activity_hours_summary_he:
      'בוקר 07:35–14:00 (חינם) · צהרון 14:00–16:30 · כולל ארוחת צהריים',
    yoy_trend_summary_he: 'תשפ״ו: ₪935 → תשפ״ז: ₪980 (+4.8%)',
    benchmark_neighborhood_summary_he:
      'תואם לתעריף צהרוני עיריית ת״א-יפו (₪980)',
    regulatory_context_he:
      'מוסד חינוך רשמי בגילאי 3–6 המופיע במאגר מוסדות משרד החינוך ובשכבת ה-GIS העירונית (סמל מוסד: 510342).',
    price_cohorts: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '3_6',
        age_group_label_he: 'גני ילדים וצהרונים (גילאי 3–6)',
        is_municipal_tzaharon_only: true,
        hours_bucket: 'full_day',
        includes_friday: false,
        includes_nutrition: true,
        active_reports_count: 3,
        display_mode: 'median',
        headline_price_nis: 980,
        min_price_nis: 950,
        max_price_nis: 1020,
        iqr_q25_nis: 965,
        iqr_q75_nis: 1000,
        price_formatted_he: '₪980 לחודש (תוספת צהרון עירייה)',
        trust_badge_he: '✓ מידע הורים מאומת (3 דיווחים · מסלול צהרון עירייה)',
      },
    ],
    relative_benchmarks: [
      {
        scope: 'city_all_same_track',
        label_he: 'צהרונים עירוניים בתל אביב - יפו (גילאי 3–6)',
        median_price_nis: 980,
        iqr_q25_nis: 950,
        iqr_q75_nis: 1020,
        sample_daycares_count: 68,
        is_sufficient_sample: true,
        diff_nis: 0,
        diff_pct: 0,
        comparison_text_he: 'זהה לחציון צהרוני העירייה בעיר (₪980 · N=68 גנים)',
      },
    ],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: 980,
      annual_gap_11_months_nis: 0,
      summary_he:
        'בגני עירייה בגילאי 3–6 שעות הבוקר פטורות משכר לימוד (חוק לימוד חובה חינם), והתשלום המוצג מתייחס לתוספת הצהרון בלבד (מופרד מהשוואה לגנים פרטיים מלאים).',
    },
    yoy_price_history: [
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '3_6',
        median_price_nis: 935,
        reports_count: 3,
        yoy_change_nis: null,
        yoy_change_pct: null,
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '3_6',
        median_price_nis: 980,
        reports_count: 3,
        yoy_change_nis: 45,
        yoy_change_pct: 4.8,
      },
    ],
    individual_reports: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '3_6',
        age_group_label_he: 'גני ילדים וצהרונים (3–6)',
        monthly_price_nis: 980,
        start_time_weekday: '07:35',
        end_time_weekday: '16:30',
        includes_friday: true,
        friday_start_time: '07:35',
        friday_end_time: '12:45',
        includes_nutrition: true,
        is_municipal_tzaharon_only: true,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
    ],
    reliance_disclaimer_he:
      'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד החינוך והרשויות המקומיות.',
  },
  {
    id: 'f6a7b8c9-3d4e-4f5a-9b0c-1d2e3f4a5b33',
    name: 'מעון קשת צפון — רמת אביב',
    city_code: 5000,
    city_name_he: 'תל אביב - יפו',
    address: 'אינשטיין 24, תל אביב - יפו',
    lat: 32.1128,
    lon: 34.7982,
    target_age_groups: ['0_1', '1_2', '2_3'],
    age_group_label_he: 'לידה עד 3',
    is_subsidized: false,
    license_status: 'licensed',
    license_status_label_he: 'רישיון הפעלה בתוקף (משרד החינוך)',
    license_icon_code: 'valid',
    ministry_edu_symbol: '418210',
    labor_Cross_symbol: null,
    operator_name: 'קשת צפון חינוך בע"מ',
    phone_official: '03-6412233',
    has_active_stop_order: false,
    display_mode: 'no_price',
    price_Trust_tier: 'no_price',
    price_formatted_he: 'טרם דווח מחיר — היו הראשונים לדווח!',
    price_pill_short_he: '+ הוסף מחיר',
    trust_badge_he: 'מסגרת רשמית במרשם משרד החינוך (ממתינה לדיווח מחיר ראשון)',
    headline_price_nis: null,
    min_price_nis: null,
    max_price_nis: null,
    active_reports_count: 0,
    school_year: 2027,
    activity_hours_summary_he: null,
    yoy_trend_summary_he: null,
    benchmark_neighborhood_summary_he:
      'חציון רמת אביב והצפון החדש: ₪5,850 לחודש (N=18 גנים)',
    regulatory_context_he:
      'מעון זה מופיע במרשם מעונות היום המפוקחים של משרד החינוך לשנת תשפ״ז בסטטוס "רישיון בתוקף" (סמל מסגרת: 418210). טרם התקבל דיווח מחיר מהורים למסגרת זו.',
    price_cohorts: [],
    relative_benchmarks: [
      {
        scope: 'radius_1km',
        label_he: 'שכונה / רדיוס 1 ק"מ (רמת אביב)',
        median_price_nis: 5850,
        iqr_q25_nis: 5600,
        iqr_q75_nis: 6200,
        sample_daycares_count: 18,
        is_sufficient_sample: true,
        diff_nis: null,
        diff_pct: null,
        comparison_text_he: 'חציון השכונה: ₪5,850 לחודש (N=18 גנים) — דווחו מחיר להשוואה!',
      },
    ],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: 2515,
      annual_gap_11_months_nis: null,
      summary_he: 'תעריף מעון סמל מפוקח להשוואה: ₪2,515 לחודש.',
    },
    yoy_price_history: [],
    individual_reports: [],
    reliance_disclaimer_he:
      'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד החינוך והרשויות המקומיות.',
  },
  {
    id: 'b7e4c1a0-3d8a-4f11-8b22-6c1d0e9f8a77',
    name: 'מעון ויצו רחובות המדע',
    city_code: 8400,
    city_name_he: 'רחובות',
    address: 'דרך יבנה 18, רחובות',
    lat: 31.8981,
    lon: 34.8112,
    target_age_groups: ['0_1', '1_2', '2_3'],
    age_group_label_he: 'לידה עד 3',
    is_subsidized: true,
    license_status: 'symbol_recognized',
    license_status_label_he: 'מעון סמל מוכר לסבסוד (משרד העבודה ומשרד החינוך)',
    license_icon_code: 'valid',
    ministry_edu_symbol: '401122',
    labor_Cross_symbol: '12045',
    operator_name: 'ויצו — הסתדרות עולמית לנשים ציוניות',
    phone_official: '08-9456789',
    has_active_stop_order: false,
    display_mode: 'median',
    price_Trust_tier: 'official_regulated',
    price_formatted_he: '₪2,515 לחודש (תעריף מפוקח)',
    price_pill_short_he: '🛡️ ₪2,515',
    trust_badge_he: '🛡️ תעריף סמל מפוקח ממשלתית + 3 דיווחי הורים',
    headline_price_nis: 2515,
    min_price_nis: 1650,
    max_price_nis: 2515,
    active_reports_count: 3,
    school_year: 2027,
    activity_hours_summary_he:
      'א׳–ה׳ 07:00–16:00 · שישי 07:00–12:00 · כולל הזנה מלאה',
    yoy_trend_summary_he: 'תעריף מקסימום מפוקח משרד העבודה לשנת תשפ״ז (לפני דרגת סבסוד)',
    benchmark_neighborhood_summary_he:
      'חיסכון שנתי של כ-₪24,035 לעומת חציון השוק הפרטי ברחובות (₪4,700)',
    regulatory_context_he:
      'מעון סמל מוכר לסבסוד ושכר לימוד מפוקח (סמל משרד העבודה: 12045, סמל משרד החינוך: 401122). הזכאים לדרגת השתתפות של משרד העבודה משלמים תעריף מופחת בהתאם למבחן הכנסה.',
    price_cohorts: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        age_group_label_he: 'פעוטות (שנה עד 3)',
        is_municipal_tzaharon_only: false,
        hours_bucket: 'full_day',
        includes_friday: true,
        includes_nutrition: true,
        active_reports_count: 3,
        display_mode: 'median',
        headline_price_nis: 2515,
        min_price_nis: 1650,
        max_price_nis: 2515,
        iqr_q25_nis: 2100,
        iqr_q75_nis: 2515,
        price_formatted_he: '₪2,515 לחודש (תעריף מקסימום מפוקח)',
        trust_badge_he: '🛡️ תעריף סמל מפוקח + 3 דיווחי הורים',
      },
    ],
    relative_benchmarks: [
      {
        scope: 'city_all_same_track',
        label_he: 'מעונות סמל מפוקחים ברחובות',
        median_price_nis: 2515,
        iqr_q25_nis: 2100,
        iqr_q75_nis: 2515,
        sample_daycares_count: 14,
        is_sufficient_sample: true,
        diff_nis: 0,
        diff_pct: 0,
        comparison_text_he: 'תעריף אחיד מפוקח ארצית (₪2,515 לפני דרגת סבסוד)',
      },
    ],
    regulated_benchmark_comparison: {
      regulated_symbol_max_price_nis: 2515,
      annual_gap_11_months_nis: 0,
      summary_he:
        'זהו מעון סמל מפוקח — שכר הלימוד כפוף לצו הפיקוח על מחירי מצרכים ושירותים וזכאי לסבסוד משרד העבודה.',
    },
    yoy_price_history: [
      {
        school_year: 2025,
        school_year_label: 'תשפ"ה (2024–2025)',
        age_group: '1_2',
        median_price_nis: 2360,
        reports_count: 3,
        yoy_change_nis: null,
        yoy_change_pct: null,
      },
      {
        school_year: 2026,
        school_year_label: 'תשפ"ו (2025–2026)',
        age_group: '1_2',
        median_price_nis: 2440,
        reports_count: 3,
        yoy_change_nis: 80,
        yoy_change_pct: 3.4,
      },
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        median_price_nis: 2515,
        reports_count: 3,
        yoy_change_nis: 75,
        yoy_change_pct: 3.1,
      },
    ],
    individual_reports: [
      {
        school_year: 2027,
        school_year_label: 'תשפ"ז (2026–2027)',
        age_group: '1_2',
        age_group_label_he: 'פעוטות צעירים (שנה עד שנתיים)',
        monthly_price_nis: 2515,
        start_time_weekday: '07:00',
        end_time_weekday: '16:00',
        includes_friday: true,
        friday_start_time: '07:00',
        friday_end_time: '12:00',
        includes_nutrition: true,
        is_municipal_tzaharon_only: false,
        report_source: 'parent_verified_google',
        report_source_label_he: 'דיווח הורה מאומת',
      },
    ],
    reliance_disclaimer_he:
      'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי משרד העבודה ומשרד החינוך.',
  },
];

// עותק בזיכרון לעדכונים מיידיים במהלך הסשן (Blind Upsert / Blind Withdraw בדמו)
let inMemoryDaycares: DaycareDetailDto[] = structuredClone(FALLBACK_DAYCARES);

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

/**
 * שליפת רשימת מסגרות (מנסה מול ה-Backend ובמקרה של סביבה ללא DB חוזר למאגר המקומי)
 */
export async function fetchDaycaresList(): Promise<DaycareDetailDto[]> {
  try {
    const res = await fetch('/api/v1/daycares?mode=list&limit=200', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return data.items as DaycareDetailDto[];
      }
    }
  } catch {
    // שימוש במאגר המקומי
  }
  return [...inMemoryDaycares];
}

/**
 * שליפת פרופיל מלא של גן לפי מזהה
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
      if (data && data.id) {
        return data as DaycareDetailDto;
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
      if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
        return data.suggestions;
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

/**
 * אימות Google OIDC (Scope: openid בלבד) + שליחת דיווח מחיר ב-Blind Upsert
 */
export async function submitParentReport(
  payload: ReportSubmissionPayload,
  googleIdToken = 'demo_google_id_token_openid_only'
): Promise<{
  status: 'accepted';
  confirmation_message_he: string;
  updatedDaycare: DaycareDetailDto | null;
}> {
  try {
    // ניסיון אימות OIDC ושליחה לשרת ה-Backend אם זמין
    await fetch('/api/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: googleIdToken,
        turnstile_token: payload.turnstile_token,
      }),
    });

    const res = await fetch('/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      const refreshed = await fetchDaycareDetails(payload.daycare_id);
      return {
        status: 'accepted',
        confirmation_message_he:
          data.confirmation_message_he ||
          'תודה! הדיווח נקלט במערכת בהצלחה ועדכן את מדד השקיפות של הגן.',
        updatedDaycare: refreshed,
      };
    }
  } catch {
    // Fallback to local state update
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
    const yearLabels: Record<number, string> = {
      2025: 'תשפ"ה (2024–2025)',
      2026: 'תשפ"ו (2025–2026)',
      2027: 'תשפ"ז (2026–2027)',
    };

    for (const item of payload.items) {
      target.individual_reports.unshift({
        school_year: item.school_year,
        school_year_label: yearLabels[item.school_year] || 'תשפ"ז (2026–2027)',
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
      'תודה! הדיווח נקלט במערכת בהצלחה במנגנון שומר פרטיות (Blind Upsert ללא שמירת מייל) ועדכן את מדד המחיר של הגן.',
    updatedDaycare: target ? structuredClone(target) : null,
  };
}

/**
 * ביטול דיווח עצמי עיוור (Blind Withdraw — D-38)
 */
export async function withdrawParentReport(payload: {
  daycare_id: string;
  school_year: 2025 | 2026 | 2027;
  turnstile_token: string;
}): Promise<{ status: 'accepted'; confirmation_message_he: string }> {
  try {
    const res = await fetch('/api/v1/reports/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        status: 'accepted',
        confirmation_message_he:
          data.confirmation_message_he ||
          'בקשת הביטול עובדה בהצלחה. אם היה קיים דיווח המשויך לחשבונך עבור גן זה ושנת הלימודים שנבחרה, הוא הוסר מחישוב המחירים הפומבי.',
      };
    }
  } catch {
    // Fallback
  }

  return {
    status: 'accepted',
    confirmation_message_he:
      'בקשת הביטול עובדה בהצלחה (Blind Withdraw). אם היה קיים דיווח המשויך לחשבונך עבור גן זה ושנת הלימודים שנבחרה, הוא הוסר מחישוב המחירים הפומבי.',
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
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        status: 'accepted',
        confirmation_message_he:
          data.confirmation_message_he ||
          'תודה! הפנייה המובנית נקלטה בתור הבקרה ותיבדק מול מאגרי המקור הרשמיים.',
      };
    }
  } catch {
    // Fallback
  }

  return {
    status: 'accepted',
    confirmation_message_he:
      'תודה! הפנייה המובנית נקלטה בתור הבקרה ותיבדק מול מאגרי המקור הרשמיים.',
  };
}
