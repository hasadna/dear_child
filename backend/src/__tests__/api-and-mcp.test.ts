import { describe, expect, it } from 'vitest';
import { executeCorrectionsCliCommand } from '../cli/manage-corrections.js';
import { loadConfig } from '../config/env.js';
import {
  InMemoryDaycareRepository,
  PostgresDaycareRepository,
} from '../db/daycare-repository.js';
import { AuthVerifiers } from '../security/external-verifiers.js';
import { AUTH_COOKIE_NAME } from '../security/nullifiers.js';
import { buildServer } from '../server.js';

describe('Dear Child REST API, Blind Upsert/Withdraw, CLI Moderation & MCP Server (Part 4.4)', () => {
  const mockVerifiers: AuthVerifiers = {
    async verifyGoogleIdToken(token: string) {
      if (token === 'valid_google_token_parent_1') {
        return { sub: '107691503500061507151' };
      }
      if (token === 'valid_google_token_parent_2') {
        return { sub: '209876543210987654321' };
      }
      return null;
    },
    async verifyTurnstileToken(token: string) {
      return token === 'valid_turnstile_token';
    },
  };

  function createTestApp() {
    const config = loadConfig({
      NODE_ENV: 'test',
      SECRET_PEPPER: 'test-secret-pepper-256-bit-key-1234567890',
      QUOTA_PEPPER_SEPARATE: 'test-quota-pepper-separate-key-0987654321',
    });
    const repository = new InMemoryDaycareRepository({ seedDemoData: true });
    return buildServer({ config, repository, verifiers: mockVerifiers });
  }

  it('serves GET /api/v1/daycares in both list and map_pins formats with 05x phone stripping', async () => {
    const app = await createTestApp();

    // 1. format=list
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/daycares?city_code=5000',
    });
    expect(listRes.statusCode).toBe(200);
    const listJson = listRes.json();
    expect(listJson.meta.license).toBe('ODbL-1.0');
    expect(listJson.items.length).toBeGreaterThanOrEqual(3);

    // Lumos Kids has mobile phone 050-6798027 -> must be stripped (null) in bulk list!
    const lumosInList = listJson.items.find(
      (i: { moe_symbol: string }) => i.moe_symbol === '11849'
    );
    expect(lumosInList.official_phone_public).toBeNull();

    // Kohav HaTzafon has landline 03-5551234 -> preserved!
    const kohavInList = listJson.items.find(
      (i: { moe_symbol: string }) => i.moe_symbol === '410923'
    );
    expect(kohavInList.official_phone_public).toBe('03-5551234');
    expect(
      kohavInList.price_summary_current_year.price_display_mode
    ).toBe('median_consensus');
    expect(
      kohavInList.price_summary_current_year.price_trust_tier
    ).toBe('tier_2_parent_consensus');

    // 2. format=map_pins (D-38 compact payload with Cache-Control)
    const pinsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/daycares?format=map_pins',
    });
    expect(pinsRes.statusCode).toBe(200);
    expect(pinsRes.headers['cache-control']).toBe('public, max-age=300');
    const pinsJson = pinsRes.json();
    expect(pinsJson.pins.length).toBeGreaterThanOrEqual(4);
    expect(pinsJson.pins[0]).toHaveProperty('pin_label');

    await app.close();
  });

  it('serves GET /api/v1/daycares/:id with YoY price history, spatial benchmarks, and month-free individual reports (D-30, D-34)', async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/daycares/a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.daycare.display_name).toBe('מעון יום כוכב הצפון');
    expect(body.price_matrix_by_age).toHaveLength(1);
    expect(body.price_matrix_by_age[0].median_price_nis).toBe(5600);
    expect(body.price_history_yoy).toHaveLength(3); // 2025, 2026, 2027
    expect(body.benchmarks.comparisons.length).toBeGreaterThanOrEqual(2);

    // D-34: individual_reports must expose school_year and school_year_label ONLY (never reported_month or dedup_token!)
    for (const rep of body.individual_reports) {
      expect(rep).toHaveProperty('school_year');
      expect(rep).toHaveProperty('school_year_label');
      expect(rep).not.toHaveProperty('reported_month');
      expect(rep).not.toHaveProperty('dedup_token');
    }

    await app.close();
  });

  it('serves GET /api/v1/stats/area, GET /api/v1/autocomplete/locations, and GET /api/v1/export (UTF-8 BOM CSV)', async () => {
    const app = await createTestApp();

    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/stats/area?city_code=5000',
    });
    expect(statsRes.statusCode).toBe(200);
    expect(statsRes.json().stats.city_name_he).toBe('תל אביב - יפו');
    expect(statsRes.json().stats.median_price_nis).toBe(5600);

    const autoRes = await app.inject({
      method: 'GET',
      url: '/api/v1/autocomplete/locations?q=ארלוזורוב',
    });
    expect(autoRes.statusCode).toBe(200);
    expect(autoRes.json().suggestions.length).toBeGreaterThanOrEqual(1);

    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/v1/export?city_code=5000&format=csv',
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.body.startsWith('\uFEFF')).toBe(true);
    expect(exportRes.body).toContain('ODbL-1.0');
    // Mobile phone 050-6798027 must NOT appear in CSV export!
    expect(exportRes.body).not.toContain('050-6798027');

    await app.close();
  });

  it('handles Google OIDC auth cookie, Hybrid Sanity Check (409 -> 200 without second Turnstile), Blind Upsert, and Blind Withdraw (D-29, D-34, D-38)', async () => {
    const app = await createTestApp();

    // 1. Authenticate via Google OIDC (Scope: openid) -> receive Strictly Necessary Cookie
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      payload: { id_token: 'valid_google_token_parent_1' },
    });
    expect(authRes.statusCode).toBe(200);
    const setCookieHeader = authRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const cookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : String(setCookieHeader);
    expect(cookieStr).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(cookieStr).toContain('HttpOnly');

    const cookiePair = cookieStr.split(';')[0];

    // 2. Submit an outlier price (1800 NIS in Tel Aviv where median is ~5600 NIS) with confirm_outlier=false -> 409 Conflict
    const outlierRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        monthly_list_price_nis: 1800,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        includes_friday: true,
        hours_fri_start: '07:30',
        hours_fri_end: '12:30',
        includes_nutrition: true,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        confirm_outlier: false,
        turnstile_token: 'valid_turnstile_token',
      },
    });
    expect(outlierRes.statusCode).toBe(409);
    expect(outlierRes.json().error_code).toBe('OUTLIER_CONFIRMATION_REQUIRED');

    // 3. Confirm outlier (confirm_outlier=true) WITHOUT a second turnstile_token (relying on yh_auth_session cookie - D-38) -> 200 OK
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        monthly_list_price_nis: 5750,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        includes_friday: true,
        hours_fri_start: '07:30',
        hours_fri_end: '12:30',
        includes_nutrition: true,
        reported_size_bucket: '7_or_more',
        reported_shelter_status: 'yes',
        reported_cameras_0_3: 'yes',
        is_standard_list_price_confirmed: true,
        confirm_outlier: true,
      },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('recorded');

    // Verify D-38 rule: the live OIDC report (5750 NIS) superseded the unverified TLV sheet seed (5800 NIS) on Lumos Kids!
    const detailsAfterReport = await app.inject({
      method: 'GET',
      url: '/api/v1/daycares/c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
    });
    expect(
      detailsAfterReport.json().price_matrix_by_age[0].representative_price_nis
    ).toBe(5750);

    // 4. Blind Withdraw (POST /api/v1/reports/withdraw - D-38) removes the parent's report without revealing an existence oracle
    const withdrawRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/withdraw',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        turnstile_token: 'valid_turnstile_token',
      },
    });
    expect(withdrawRes.statusCode).toBe(200);
    expect(withdrawRes.json().status).toBe('processed');

    // Calling withdraw a second time returns the exact same 200 OK response (Zero Enumeration Oracle!)
    const withdrawAgainRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/withdraw',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        turnstile_token: 'valid_turnstile_token',
      },
    });
    expect(withdrawAgainRes.statusCode).toBe(200);
    expect(withdrawAgainRes.json()).toEqual(withdrawRes.json());

    // 5. Price range 0..50000 and next-year early registration validation
    const zeroPriceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2028,
        monthly_list_price_nis: 0,
        age_group: '3_6',
        framework_track: 'municipal_tzaharon',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '14:00',
        includes_friday: false,
        includes_nutrition: false,
        is_standard_list_price_confirmed: true,
        confirm_outlier: true,
      },
    });
    expect(zeroPriceRes.statusCode).toBe(200);

    const outOfRangeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        monthly_list_price_nis: 50001,
        age_group: '1_2',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        includes_friday: true,
        includes_nutrition: true,
        is_standard_list_price_confirmed: true,
        confirm_outlier: true,
      },
    });
    expect(outOfRangeRes.statusCode).toBe(422);

    // 6. Blind Withdraw with specific age_group removes only that cohort
    await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        monthly_list_price_nis: 5200,
        age_group: '0_1',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        includes_friday: true,
        includes_nutrition: true,
        is_standard_list_price_confirmed: true,
        confirm_outlier: true,
        replace_all_ages_for_token: true,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        monthly_list_price_nis: 5100,
        age_group: '2_3',
        framework_track: 'private_full_day',
        hours_sun_thu_start: '07:30',
        hours_sun_thu_end: '16:30',
        includes_friday: true,
        includes_nutrition: true,
        is_standard_list_price_confirmed: true,
        confirm_outlier: true,
        replace_all_ages_for_token: false,
      },
    });
    const withdrawSingleAge = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/withdraw',
      headers: { cookie: cookiePair },
      payload: {
        daycare_id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
        school_year: 2027,
        age_group: '0_1',
        turnstile_token: 'valid_turnstile_token',
      },
    });
    expect(withdrawSingleAge.statusCode).toBe(200);
    const afterPartialWithdraw = await app.inject({
      method: 'GET',
      url: '/api/v1/daycares/c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e11',
    });
    const remainingAges = afterPartialWithdraw
      .json()
      .individual_reports.filter((r: { school_year: number }) => r.school_year === 2027)
      .map((r: { age_group: string }) => r.age_group);
    expect(remainingAges).not.toContain('0_1');
    expect(remainingAges).toContain('2_3');

    await app.close();
  });

  it('handles POST /api/v1/corrections without auto-hiding and supports CLI moderation commands (D-38)', async () => {
    const app = await createTestApp();

    const corrRes = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: {
        daycare_id: 'a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99',
        issue_category: 'wrong_price_outlier',
        structured_details: { claimed_price_nis: 5500 },
        turnstile_token: 'valid_turnstile_token',
      },
    });
    expect(corrRes.statusCode).toBe(200);
    expect(corrRes.json().status).toBe('received');

    // Test CLI command handler
    const executedQueries: string[] = [];
    const mockDbClient = {
      async query(sql: string) {
        executedQueries.push(sql);
        return { rows: [{ request_id: 'req-1', status: 'pending' }], rowCount: 1 };
      },
    };

    const listOutput = await executeCorrectionsCliCommand(
      ['list', 'pending'],
      mockDbClient
    );
    expect(JSON.parse(listOutput).count).toBe(1);

    const resolveOutput = await executeCorrectionsCliCommand(
      [
        'resolve',
        '00000000-0000-4000-8000-000000000999',
        '--hide-submission',
        '00000000-0000-4000-8000-000000000100',
      ],
      mockDbClient
    );
    expect(JSON.parse(resolveOutput).new_status).toBe('resolved');
    expect(
      executedQueries.some((q) => q.includes('SET is_flagged_hidden = TRUE'))
    ).toBe(true);

    await app.close();
  });

  it('executes all 5 MCP tools over JSON-RPC 2.0 POST /mcp with ODbL-1.0 and regulatory guardrails', async () => {
    const app = await createTestApp();

    // 1. tools/list
    const listToolsRes = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(listToolsRes.statusCode).toBe(200);
    expect(listToolsRes.json().result.tools).toHaveLength(5);

    // 2. search_daycares
    const searchCall = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'search_daycares',
          arguments: { city_name_he: 'תל אביב' },
        },
      },
    });
    expect(searchCall.statusCode).toBe(200);
    expect(
      searchCall.json().result.structuredContent.items.length
    ).toBeGreaterThanOrEqual(3);

    // 3. get_daycare_details
    const detailsCall = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_daycare_details',
          arguments: { moe_symbol: '410923' },
        },
      },
    });
    expect(detailsCall.statusCode).toBe(200);
    expect(
      detailsCall.json().result.structuredContent.daycare.display_name
    ).toBe('מעון יום כוכב הצפון');

    // 4. check_supervision_status
    const supCall = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'check_supervision_status',
          arguments: {
            daycare_name_he: 'אינגלסיטו',
            city_name_he: 'תל אביב',
          },
        },
      },
    });
    expect(supCall.statusCode).toBe(200);
    const supMatch = supCall.json().result.structuredContent.matches[0];
    expect(supMatch.license_status).toBe('in_licensing_process');
    expect(supMatch.regulatory_context_he).toContain('הסדר רציפות הרישוי');

    // 5. compare_regulated_vs_market_cost
    const compCall = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'compare_regulated_vs_market_cost',
          arguments: {
            city_name_he: 'תל אביב - יפו',
            age_group: '1_2',
          },
        },
      },
    });
    expect(compCall.statusCode).toBe(200);
    const comp = compCall.json().result.structuredContent.comparison;
    expect(comp.regulated_monthly_nis).toBe(2515);
    expect(comp.market_median_monthly_nis).toBe(5600);
    expect(comp.annual_12m_gap_nis).toBe((5600 - 2515) * 12);

    await app.close();
  });

  it('PostgresDaycareRepository binds exact SQL parameter counts across search, map_pins, stats, and autocomplete', async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const fakePool = {
      async query(text: string, values: unknown[] = []) {
        queries.push({ text, values });
        const placeholders = Array.from(text.matchAll(/\$(\d+)/g)).map((m) =>
          Number(m[1])
        );
        const maxPlaceholder =
          placeholders.length > 0 ? Math.max(...placeholders) : 0;
        expect(values.length).toBe(maxPlaceholder);
        if (text.includes('COUNT(*)')) {
          return { rows: [{ total: '0', total_cnt: '0', subsidized_cnt: '0', median_price: null }] };
        }
        return { rows: [] };
      },
    };

    const pgRepo = new PostgresDaycareRepository(
      fakePool as never,
      fakePool as never
    );

    const emptyRes = await pgRepo.searchDaycares({ school_year: 2027 });
    expect(emptyRes.items).toEqual([]);
    expect(emptyRes.totalCount).toBe(0);
    expect(emptyRes.mapPins).toBeUndefined();
    expect(queries[0].values).toEqual([2027]);
    expect(queries[1].values).toEqual([2027, 50, 0]);

    const filteredRes = await pgRepo.searchDaycares({
      city_code: 5000,
      city_name_he: 'תל אביב',
      framework_track: 'private_full_day',
      q: 'כוכב',
      age_group: '1_2',
      is_subsidized_symbol: false,
      license_status: 'active_license',
      shelter_status: 'yes',
      lat: 32.0853,
      lng: 34.7818,
      radius_m: 1500,
      bbox: '34.7,32.0,34.85,32.15',
      has_price_only: true,
      min_price: 3000,
      max_price: 7000,
      sort_by: 'price_asc',
      format: 'map_pins',
      school_year: 2028,
    });
    expect(filteredRes.items).toEqual([]);
    expect(filteredRes.mapPins).toEqual([]);
    expect(queries[2].values).toEqual([
      2028,
      5000,
      '%תל אביב%',
      'private_full_day',
      'active_license',
      false,
      'yes',
      '1_2',
      34.7818,
      32.0853,
      1500,
      34.7,
      32.0,
      34.85,
      32.15,
      '%כוכב%',
      3000,
      7000,
    ]);
    expect(queries[3].values).toEqual([...queries[2].values, 5000]);

    const stats = await pgRepo.getAreaPriceStats({
      city_name_he: 'תל אביב - יפו',
      school_year: 2027,
      age_group: '1_2',
    });
    expect(stats.city_code).toBe(5000);
    expect(stats.total_official_daycares).toBe(0);

    const ac = await pgRepo.autocompleteLocations({
      q: 'תל אביב',
      city_code: 5000,
      limit: 5,
    });
    expect(ac.some((item) => item.kind === 'city')).toBe(true);
  });
});
