import { describe, expect, it } from 'vitest';
import {
  decryptAuthSessionCookie,
  deriveDedupToken,
  deriveQuotaHash,
  encryptAuthSessionCookie,
  sanitizeMoEOperatorCorpId,
  sanitizeOperatorEntityName,
} from '../security/nullifiers.js';
import { stripMobilePhoneForBulkExport } from '../config/meta-envelope.js';
import {
  normalizeDaycareName,
  resolveFacilityItem,
  FacilityRawItem,
} from '../etl/facilities-resolver.js';
import { buildServer } from '../server.js';

describe('Dear Child Backend Scaffolding (Part 4.1)', () => {
  const SECRET_PEPPER = 'test-secret-pepper-256-bit-key-1234567890';
  const QUOTA_PEPPER = 'test-quota-pepper-separate-key-0987654321';
  const SAMPLE_SUB = '107691503500061507151';

  it('derives unlinkable per-daycare dedup_token and separate quota_hash (D-34, D-38)', () => {
    const tokenDaycareA = deriveDedupToken(
      SAMPLE_SUB,
      'a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99',
      2027,
      SECRET_PEPPER
    );
    const tokenDaycareB = deriveDedupToken(
      SAMPLE_SUB,
      'b9e4d3c2-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
      2027,
      SECRET_PEPPER
    );
    const quotaHash = deriveQuotaHash(SAMPLE_SUB, 2027, QUOTA_PEPPER);

    expect(tokenDaycareA).toHaveLength(64);
    expect(tokenDaycareB).toHaveLength(64);
    expect(quotaHash).toHaveLength(64);
    expect(tokenDaycareA).not.toBe(tokenDaycareB);
    expect(tokenDaycareA).not.toBe(quotaHash);
  });

  it('encrypts and decrypts stateless Multi-Pod HKDF auth session cookie (D-29, D-38)', () => {
    const now = 1_763_900_000_000;
    const cookieVal = encryptAuthSessionCookie(
      SAMPLE_SUB,
      SECRET_PEPPER,
      900,
      now
    );

    // Valid within 15 minutes
    const decoded = decryptAuthSessionCookie(
      cookieVal,
      SECRET_PEPPER,
      now + 300_000
    );
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(SAMPLE_SUB);

    // Expired after 15 minutes
    const expired = decryptAuthSessionCookie(
      cookieVal,
      SECRET_PEPPER,
      now + 901_000
    );
    expect(expired).toBeNull();

    // Wrong key fails authentication tag
    const wrongKey = decryptAuthSessionCookie(
      cookieVal,
      'wrong-pepper',
      now + 10_000
    );
    expect(wrongKey).toBeNull();
  });

  it('filters out individual Israeli IDs from GetMeonot semeL_BAALUT leak (D-23)', () => {
    // Corporation starting with 5 -> kept
    expect(sanitizeMoEOperatorCorpId('515987654')).toBe('515987654');
    expect(sanitizeMoEOperatorCorpId(580123456)).toBe('580123456');

    // Individual 9-digit Israeli ID not starting with 5 -> dropped in memory!
    expect(sanitizeMoEOperatorCorpId('034567891')).toBeNull();
    expect(sanitizeMoEOperatorCorpId('312345678')).toBeNull();
    expect(sanitizeMoEOperatorCorpId('201234567')).toBeNull();

    // Entity name sanitization
    expect(
      sanitizeOperatorEntityName('כוכב הצפון חינוך בע"מ', '515987654')
    ).toBe('כוכב הצפון חינוך בע"מ');
    expect(sanitizeOperatorEntityName('ישראל ישראלי', null)).toBe('עוסק יחיד');
  });

  it('strips 05x mobile phones in bulk list/export while preserving landlines (docs/05 1.2)', () => {
    expect(stripMobilePhoneForBulkExport('050-1234567')).toBeNull();
    expect(stripMobilePhoneForBulkExport('0541234567')).toBeNull();
    expect(stripMobilePhoneForBulkExport('+972-52-9876543')).toBeNull();
    expect(stripMobilePhoneForBulkExport('03-5551234')).toBe('03-5551234');
    expect(stripMobilePhoneForBulkExport('02-6789012')).toBe('02-6789012');
  });

  it('resolves multi-layer facility items into Dear Child schema enums', () => {
    const rawItem: FacilityRawItem = {
      id: 'c49a8b12',
      info: {
        name: 'מעון יום כוכב הצפון בע"מ',
        formatted_address: 'ארלוזורוב 42, תל אביב - יפו',
        lat: 32.08791,
        lng: 34.77824,
        facility_kind: 'education',
        age_group: 'all_ages',
      },
      official: [
        {
          source: 'mol',
          symbol: '410923',
          license_status: 'רישיון בתוקף',
        },
      ],
    };

    const resolved = resolveFacilityItem(rawItem);
    expect(resolved.name).toBe('מעון יום כוכב הצפון בע"מ');
    expect(resolved.license_status_code).toBe('valid');
    expect(resolved.daycare_license_status).toBe('symbol_recognized');
    expect(resolved.subsidized).toBe(true);
    expect(resolved.daycare_age_groups).toEqual(['0_1', '1_2', '2_3']);
    expect(normalizeDaycareName(resolved.name)).toBe('כוכב הצפון');
  });

  it('responds on /api/v1/health and /mcp with ODbL-1.0 meta envelope', async () => {
    const app = await buildServer();
    const healthRes = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(healthRes.statusCode).toBe(200);
    const body = healthRes.json();
    expect(body.status).toBe('ok');
    expect(body.meta.license).toBe('ODbL-1.0');

    const mcpRes = await app.inject({ method: 'GET', url: '/mcp' });
    expect(mcpRes.statusCode).toBe(200);
    expect(mcpRes.json().name).toBe('yaldi-hayakar-mcp');
    await app.close();
  });
});
