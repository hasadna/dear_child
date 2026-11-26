import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DaycareDetailDto,
  fetchAutocompleteLocations,
  fetchDaycareDetails,
  fetchDaycaresList,
  filterDaycaresClientSide,
  setInMemoryDaycaresForTesting,
  submitCorrectionRequest,
  submitParentReport,
  withdrawParentReport,
} from '../services/api-client';

describe('API Client & Backend-to-Frontend DTO Adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps raw Backend DaycareListItemDto safely without undefined crashes (white-screen regression)', async () => {
    const mockBackendResponse = {
      items: [
        {
          daycare_id: 'backend-uuid-1',
          display_name: 'גן השחר הרשמי',
          city_code: 5000,
          city_name_he: 'תל אביב - יפו',
          full_address_public: 'דיזנגוף 100, תל אביב - יפו',
          location: { lat: 32.081, lng: 34.774 },
          age_groups_supported: ['0_3'],
          license_status: 'licensed',
          is_subsidized_symbol: false,
          moe_symbol: '419999',
          mol_symbol: null,
          official_phone_public: '03-5559999',
          has_active_stop_order: false,
          regulatory_context_he: 'מופיע במרשם משרד החינוך.',
          price_summary_current_year: {
            school_year: 2027,
            reports_count: 4,
            primary_pin_price_nis: 5500,
            min_price_nis: 5400,
            max_price_nis: 5700,
            price_display_mode: 'median_consensus',
            price_trust_tier: 'tier_2_parent_consensus',
            formatted_header_he: '₪5,500 לחודש (חציון)',
            formatted_pin_he: '✓ ₪5,500',
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockBackendResponse), { status: 200 })
    );

    const items = await fetchDaycaresList();
    expect(items).toHaveLength(1);
    const d = items[0];

    expect(d.id).toBe('backend-uuid-1');
    expect(d.name).toBe('גן השחר הרשמי');
    expect(d.lat).toBe(32.081);
    expect(d.lon).toBe(34.774);
    expect(d.target_age_groups).toEqual(['0_3_mixed']);
    expect(d.headline_price_nis).toBe(5500);
    expect(d.display_mode).toBe('median');
    // Arrays must always be initialized so modals never crash on .map()
    expect(Array.isArray(d.price_cohorts)).toBe(true);
    expect(Array.isArray(d.relative_benchmarks)).toBe(true);
    expect(Array.isArray(d.yoy_price_history)).toBe(true);
    expect(Array.isArray(d.individual_reports)).toBe(true);
    expect(d.regulated_benchmark_comparison.regulated_symbol_max_price_nis).toBe(2515);
  });

  it('maps raw Backend DaycareDetailDto (GET /api/v1/daycares/:id) into full 5-block DTO', async () => {
    const mockDetail = {
      daycare: {
        daycare_id: 'backend-uuid-2',
        display_name: 'מעון האורנים',
        city_code: 5000,
        city_name_he: 'תל אביב - יפו',
        full_address_public: 'אבן גבירול 50, תל אביב - יפו',
        location: { lat: 32.078, lng: 34.781 },
        age_groups_supported: ['1_2'],
        license_status: 'in_process',
        is_subsidized_symbol: false,
        moe_symbol: '411222',
        operator_entity_name: 'האורנים בע"מ',
        has_active_stop_order: false,
        regulatory_context_he: 'בתהליך רישוי.',
      },
      price_matrix_by_age: [
        {
          school_year: 2027,
          school_year_label: 'תשפ"ז (2026–2027)',
          age_group: '1_2',
          age_group_label_he: 'פעוטות צעירים',
          framework_track: 'private_full_day',
          is_full_day: true,
          reports_count: 3,
          price_display_mode: 'median_consensus',
          representative_price_nis: 5400,
          min_price_nis: 5200,
          max_price_nis: 5600,
          p25_price_nis: 5300,
          p75_price_nis: 5500,
        },
      ],
      price_history_yoy: [
        {
          school_year: 2026,
          school_year_label: 'תשפ"ו',
          age_group: '1_2',
          representative_price_nis: 5000,
          reports_count: 2,
          yoy_diff_nis: null,
          yoy_diff_pct: null,
        },
        {
          school_year: 2027,
          school_year_label: 'תשפ"ז',
          age_group: '1_2',
          representative_price_nis: 5400,
          reports_count: 3,
          yoy_diff_nis: 400,
          yoy_diff_pct: 8.0,
        },
      ],
      benchmarks: {
        regulated_symbol_benchmark_nis: 2515,
        private_vs_regulated_annual_gap_nis: 31735,
        comparisons: [
          {
            benchmark_scope: 'radius_1km',
            label_he: 'רדיוס 1 ק"מ',
            sample_daycares_n: 8,
            median_price_nis: 5550,
            p25_price_nis: 5300,
            p75_price_nis: 5800,
            diff_from_median_nis: -150,
            diff_from_median_pct: -2.7,
          },
        ],
      },
      individual_reports: [
        {
          school_year: 2027,
          school_year_label: 'תשפ"ז',
          source_type: 'parent_google_oidc',
          source_label_he: 'דיווח הורה מאומת',
          monthly_list_price_nis: 5400,
          age_group: '1_2',
          framework_track: 'private_full_day',
          hours_sun_thu_start: '07:30',
          hours_sun_thu_end: '16:30',
          includes_friday: true,
          hours_fri_start: '07:30',
          hours_fri_end: '12:30',
          includes_nutrition: true,
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockDetail), { status: 200 })
    );

    const detail = await fetchDaycareDetails('backend-uuid-2');
    expect(detail).not.toBeNull();
    expect(detail?.id).toBe('backend-uuid-2');
    expect(detail?.price_cohorts).toHaveLength(1);
    expect(detail?.yoy_price_history).toHaveLength(2);
    expect(detail?.relative_benchmarks).toHaveLength(1);
    expect(detail?.individual_reports).toHaveLength(1);
    expect(detail?.regulated_benchmark_comparison.annual_gap_11_months_nis).toBe(
      31735
    );
  });

  it('returns empty list when Backend returns empty items (clean DB, no hardcoded fallback)', async () => {
    setInMemoryDaycaresForTesting([]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    );

    const items = await fetchDaycaresList();
    expect(items).toEqual([]);
  });

  it('filters daycares accurately by searchTerm, ageGroups, licensing, subsidy and features', async () => {
    const testItems: DaycareDetailDto[] = [
      {
        id: 'test-1',
        name: 'גן בדיקה 1',
        city_code: 5000,
        city_name_he: 'תל אביב - יפו',
        address: 'רחוב הבדיקה 1, תל אביב - יפו',
        lat: 32.08,
        lon: 34.78,
        target_age_groups: ['1_2'],
        age_group_label_he: '1–2',
        is_subsidized: false,
        license_status: 'licensed',
        license_status_label_he: 'רישיון הפעלה בתוקף',
        license_icon_code: 'valid',
        ministry_edu_symbol: '111111',
        labor_Cross_symbol: null,
        operator_name: 'בדיקה',
        phone_official: null,
        has_active_stop_order: false,
        display_mode: 'single',
        price_Trust_tier: 'single_parent_report',
        price_formatted_he: '₪5,000',
        price_pill_short_he: '₪5,000',
        trust_badge_he: 'דיווח בודד',
        headline_price_nis: 5000,
        min_price_nis: 5000,
        max_price_nis: 5000,
        active_reports_count: 1,
        school_year: 2027,
        activity_hours_summary_he: 'א׳–ה׳ 07:30–16:30',
        yoy_trend_summary_he: null,
        benchmark_neighborhood_summary_he: null,
        regulatory_context_he: 'רשמי.',
        price_cohorts: [],
        relative_benchmarks: [],
        regulated_benchmark_comparison: {
          regulated_symbol_max_price_nis: 2515,
          annual_gap_11_months_nis: null,
          summary_he: '',
        },
        yoy_price_history: [],
        individual_reports: [],
        reliance_disclaimer_he: 'כתב ויתור.',
      },
      {
        id: 'test-2',
        name: 'גן עירייה 3–6',
        city_code: 5000,
        city_name_he: 'תל אביב - יפו',
        address: 'רחוב הבדיקה 2, תל אביב - יפו',
        lat: 32.09,
        lon: 34.79,
        target_age_groups: ['3_6'],
        age_group_label_he: '3–6',
        is_subsidized: true,
        license_status: 'municipal_verified',
        license_status_label_he: 'גן רשמי',
        license_icon_code: 'valid',
        ministry_edu_symbol: '222222',
        labor_Cross_symbol: null,
        operator_name: 'עירייה',
        phone_official: null,
        has_active_stop_order: false,
        display_mode: 'no_price',
        price_Trust_tier: 'no_price',
        price_formatted_he: 'טרם דווח',
        price_pill_short_he: '+ הוסף מחיר',
        trust_badge_he: 'ממתין לדיווח',
        headline_price_nis: null,
        min_price_nis: null,
        max_price_nis: null,
        active_reports_count: 0,
        school_year: 2027,
        activity_hours_summary_he: null,
        yoy_trend_summary_he: null,
        benchmark_neighborhood_summary_he: null,
        regulatory_context_he: 'רשמי.',
        price_cohorts: [],
        relative_benchmarks: [],
        regulated_benchmark_comparison: {
          regulated_symbol_max_price_nis: 980,
          annual_gap_11_months_nis: null,
          summary_he: '',
        },
        yoy_price_history: [],
        individual_reports: [],
        reliance_disclaimer_he: 'כתב ויתור.',
      },
    ];
    setInMemoryDaycaresForTesting(testItems);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const items = await fetchDaycaresList();
    expect(items).toHaveLength(2);

    const byAge36 = filterDaycaresClientSide(items, {
      searchTerm: '',
      ageGroups: ['3_6'],
      licensing: [],
      subsidy: [],
      features: [],
    });
    expect(byAge36.every((d) => d.target_age_groups.includes('3_6'))).toBe(true);

    const hasPriceOnly = filterDaycaresClientSide(items, {
      searchTerm: '',
      ageGroups: [],
      licensing: [],
      subsidy: [],
      features: ['has_price_only'],
    });
    expect(hasPriceOnly.every((d) => d.display_mode !== 'no_price')).toBe(true);
  });

  it('supports offline fallback for autocomplete, report submission, withdraw and corrections', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const suggestions = await fetchAutocompleteLocations('תל אביב');
    expect(suggestions.length).toBeGreaterThan(0);

    const items = await fetchDaycaresList();
    const target = items[0];
    expect(target).toBeDefined();

    const reportRes = await submitParentReport({
      daycare_id: target.id,
      turnstile_token: 'test-token',
      legal_declaration_accepted: true,
      items: [
        {
          school_year: 2027,
          age_group: '1_2',
          monthly_price_nis: 5650,
          start_time_weekday: '07:30',
          end_time_weekday: '16:30',
          includes_friday: true,
          friday_start_time: '07:30',
          friday_end_time: '12:30',
          includes_nutrition: true,
          is_municipal_tzaharon_only: false,
          outlier_confirmed_by_user: false,
        },
      ],
    });
    expect(reportRes.status).toBe('accepted');
    expect(reportRes.updatedDaycare).not.toBeNull();

    const withdrawRes = await withdrawParentReport({
      daycare_id: target.id,
      school_year: 2027,
      turnstile_token: 'test-token',
    });
    expect(withdrawRes.status).toBe('accepted');

    const corrRes = await submitCorrectionRequest({
      daycare_id: target.id,
      error_category: 'wrong_price_outlier',
      submitter_role: 'parent',
      turnstile_token: 'test-token',
    });
    expect(corrRes.status).toBe('accepted');
  });

  it('sends valid Backend wire format for /api/v1/auth/google, /api/v1/reports (including 0_3_mixed -> 0_3) and /api/v1/reports/withdraw', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init) => {
        const url = String(input);
        if (url === '/api/v1/auth/google') {
          const body = JSON.parse(String(init?.body || '{}'));
          expect(body.id_token).toMatch(/^dev_sub_\d{10,30}$/);
          return new Response(JSON.stringify({ status: 'authenticated' }), {
            status: 200,
          });
        }
        if (url === '/api/v1/reports') {
          const body = JSON.parse(String(init?.body || '{}'));
          expect(body.monthly_list_price_nis).toBe(940);
          expect(body.age_group).toBe('0_3');
          expect(body.is_standard_list_price_confirmed).toBe(true);
          expect(body.hours_sun_thu_start).toBe('07:30');
          expect(body.hours_sun_thu_end).toBe('16:30');
          return new Response(
            JSON.stringify({ status: 'recorded', message_he: 'נקלט' }),
            { status: 200 }
          );
        }
        if (url === '/api/v1/reports/withdraw') {
          const body = JSON.parse(String(init?.body || '{}'));
          expect(body.daycare_id).toBe('daycare-abc');
          expect(body.school_year).toBe(2027);
          expect(body.age_group).toBe('1_2');
          return new Response(
            JSON.stringify({ status: 'processed', message_he: 'בוטל' }),
            { status: 200 }
          );
        }
        if (url.startsWith('/api/v1/daycares/')) {
          return new Response(JSON.stringify({}), { status: 404 });
        }
        return new Response('', { status: 404 });
      }
    );

    const submitRes = await submitParentReport({
      daycare_id: 'daycare-abc',
      turnstile_token: 'turnstile_managed_background_token',
      legal_declaration_accepted: true,
      items: [
        {
          school_year: 2027,
          age_group: '0_3_mixed',
          monthly_price_nis: 940,
          start_time_weekday: '07:30',
          end_time_weekday: '16:30',
          includes_friday: false,
          includes_nutrition: true,
          is_municipal_tzaharon_only: false,
          outlier_confirmed_by_user: true,
        },
      ],
    });
    expect(submitRes.status).toBe('accepted');

    const withdrawRes = await withdrawParentReport({
      daycare_id: 'daycare-abc',
      school_year: 2027,
      age_group: '1_2',
      turnstile_token: 'turnstile_managed_background_token',
    });
    expect(withdrawRes.status).toBe('accepted');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/reports/withdraw',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
