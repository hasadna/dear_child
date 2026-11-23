import { describe, expect, it } from 'vitest';
import { loadMigrationFiles } from '../db/migrate.js';
import {
  BASELINE_ISRAEL_CITIES,
  BASELINE_REGULATED_BENCHMARKS,
  normalizeCityName,
  normalizeStreetName,
} from '../db/seed-dictionaries.js';

describe('Dear Child Database Schema & Migrations (Part 4.2)', () => {
  it('loads all 5 SQL migrations in lexical order with valid SHA-256 checksums', () => {
    const migrations = loadMigrationFiles();
    expect(migrations).toHaveLength(5);
    expect(migrations.map((m) => m.version)).toEqual([
      '001_extensions_roles_and_enums',
      '002_geodictionaries_and_regulated_benchmarks',
      '003_daycares_and_external_sources',
      '004_app_private_nullifiers_and_blind_functions',
      '005_public_views_and_benchmark_functions',
    ]);

    const forbiddenBrandA = ['taf', 'map'].join('');
    const forbiddenBrandB = ['mapat', 'hataf'].join('');
    for (const m of migrations) {
      expect(m.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(m.sql.length).toBeGreaterThan(500);
      // Enforce independent naming rule: zero mentions of external brand identifiers in SQL
      expect(m.sql.toLowerCase()).not.toContain(forbiddenBrandA);
      expect(m.sql.toLowerCase()).not.toContain(forbiddenBrandB);
    }
  });

  it('enforces all D-34 and D-38 security, privacy, and aggregation guardrails in DDL', () => {
    const migrations = loadMigrationFiles();
    const combinedSql = migrations.map((m) => m.sql).join('\n');

    // 1. Role separation & app_private isolation
    expect(combinedSql).toContain(
      'REVOKE ALL ON SCHEMA app_private FROM app_public_ro'
    );

    // 2. GetMeonot ID leak constraint (corporations starting with 5 only)
    expect(combinedSql).toContain("operator_corp_id ~ '^5[0-9]{8}$'");

    // 3. ETL protection: ON DELETE RESTRICT & is_active_in_registry (D-38)
    expect(combinedSql).toContain(
      'REFERENCES public.daycares(daycare_id) ON DELETE RESTRICT'
    );
    expect(combinedSql).toContain('is_active_in_registry');

    // 4. Multi-age Blind Upsert & mandatory axes check (D-38)
    expect(combinedSql).toContain(
      'CONSTRAINT uq_dedup_token_age_group UNIQUE (dedup_token, age_group)'
    );
    expect(combinedSql).toContain('CONSTRAINT chk_live_report_mandatory_axes');

    // 5. Blind Upsert, Blind Withdraw & Annual Nullifier Wipe functions
    expect(combinedSql).toContain(
      'CREATE OR REPLACE FUNCTION app_private.submit_parent_report_blind_upsert'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE FUNCTION app_private.withdraw_parent_report_blind'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE FUNCTION app_private.wipe_school_year_nullifiers'
    );

    // 6. Real-time public views & multi-age pin collapse (D-30, D-31, D-38)
    expect(combinedSql).toContain(
      'CREATE OR REPLACE VIEW public.daycare_tuition_reports'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE VIEW public.daycare_price_aggregates'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE VIEW public.daycare_year_summary'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE VIEW public.daycare_price_history_yoy'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE FUNCTION public.get_daycare_benchmarks'
    );
    expect(combinedSql).toContain(
      'CREATE OR REPLACE FUNCTION public.get_sanity_check_reference_median'
    );
  });

  it('normalizes Hebrew city and street names for pg_trgm search and validates baseline seeds', () => {
    expect(normalizeCityName('תל אביב - יפו')).toBe('תל אביב יפו');
    expect(normalizeCityName('מודיעין-מכבים-רעות')).toBe('מודיעין מכבים רעות');
    expect(normalizeStreetName('רחוב ארלוזורוב')).toBe('ארלוזורוב');
    expect(normalizeStreetName("שד' רוטשילד")).toBe('רוטשילד');

    expect(BASELINE_ISRAEL_CITIES.length).toBeGreaterThanOrEqual(25);
    const tlv = BASELINE_ISRAEL_CITIES.find((c) => c.cityCode === 5000);
    expect(tlv?.cityNameHe).toBe('תל אביב - יפו');
    expect(tlv?.socioEconomicCluster).toBe(8);

    expect(BASELINE_REGULATED_BENCHMARKS.length).toBeGreaterThanOrEqual(12);
    const symbol2027Toddler = BASELINE_REGULATED_BENCHMARKS.find(
      (b) =>
        b.schoolYear === 2027 &&
        b.frameworkTrack === 'symbol_regulated' &&
        b.ageGroup === '1_2'
    );
    expect(symbol2027Toddler?.monthlyMaxPriceNis).toBe(2515);
  });
});
