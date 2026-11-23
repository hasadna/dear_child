import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

export const AUTH_COOKIE_NAME = 'yh_auth_session';
const HKDF_INFO = 'yh-cookie-encryption-v1';
const HKDF_SALT = 'hasadna-dear-child-cookie-salt-v1';

/**
 * D-34, D-38: גזירת Unlinkable Per-Daycare Nullifier בזיכרון ה-RAM בלבד.
 * dedup_token = HMAC-SHA256(google_sub || ":" || daycare_id || ":" || school_year, SECRET_PEPPER)
 */
export function deriveDedupToken(
  googleSub: string,
  daycareId: string,
  schoolYear: number,
  secretPepper: string
): string {
  if (!/^\d{10,30}$/.test(googleSub)) {
    throw new Error('INVALID_GOOGLE_SUB_FORMAT');
  }
  return createHmac('sha256', secretPepper)
    .update(`${googleSub}:${daycareId}:${schoolYear}`)
    .digest('hex');
}

/**
 * D-34: גזירת מזהה מכסה מנותק לטבלת auth_rate_limits (ללא daycare_id וללא חותמת זמן).
 * quota_hash = HMAC-SHA256(google_sub || ":" || school_year, QUOTA_PEPPER_SEPARATE)
 */
export function deriveQuotaHash(
  googleSub: string,
  schoolYear: number,
  quotaPepperSeparate: string
): string {
  if (!/^\d{10,30}$/.test(googleSub)) {
    throw new Error('INVALID_GOOGLE_SUB_FORMAT');
  }
  return createHmac('sha256', quotaPepperSeparate)
    .update(`${googleSub}:${schoolYear}`)
    .digest('hex');
}

/**
 * D-38: גזירת מפתח הצפנה דטרמיניסטי (32 בתים ל-AES-256-GCM) מ-SECRET_PEPPER באמצעות HKDF-SHA256.
 * מאפשר פענוח עוגיית yh_auth_session בכל Pod ב-hasadna-k8s ללא שמירת סשן ב-DB.
 */
export function deriveDeterministicCookieKey(secretPepper: string): Buffer {
  const derived = hkdfSync('sha256', secretPepper, HKDF_SALT, HKDF_INFO, 32);
  return Buffer.from(derived);
}

export interface AuthSessionPayload {
  sub: string;
  exp: number;
}

/**
 * D-29, D-38: הצפנת עוגיית האבטחה ההכרחית (Strictly Necessary Cookie) ב-AES-256-GCM ל-15 דקות.
 */
export function encryptAuthSessionCookie(
  googleSub: string,
  secretPepper: string,
  ttlSeconds = 900,
  nowMs = Date.now()
): string {
  const key = deriveDeterministicCookieKey(secretPepper);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const payload: AuthSessionPayload = {
    sub: googleSub,
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/**
 * פענוח ואימות תוקף עוגיית yh_auth_session בזיכרון ה-RAM בלבד.
 */
export function decryptAuthSessionCookie(
  cookieValue: string,
  secretPepper: string,
  nowMs = Date.now()
): AuthSessionPayload | null {
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 3) return null;

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');

    if (iv.length !== 12 || authTag.length !== 16) return null;

    const key = deriveDeterministicCookieKey(secretPepper);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    const payload = JSON.parse(decrypted) as AuthSessionPayload;
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    const nowSec = Math.floor(nowMs / 1000);
    if (payload.exp < nowSec) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * D-23 (סעיף 8 לחוק הגנת הפרטיות): סינון קשיח בזיכרון של מספרי ת"ז מדליפת מרשם GetMeonot.
 * שומר אך ורק מספר תאגיד (ח.פ. / ע"ר) בן 9 ספרות המתחיל בספרה 5.
 * כל מספר אחר (ת"ז של עוסק יחיד) נזרק מיידית בזיכרון ומוחזר null.
 */
export function sanitizeMoEOperatorCorpId(
  rawSemelBaalut: string | number | null | undefined
): string | null {
  if (rawSemelBaalut === null || rawSemelBaalut === undefined) return null;
  const digits = String(rawSemelBaalut).trim().replace(/[^0-9]/g, '');
  if (/^5\d{8}$/.test(digits)) {
    return digits;
  }
  return null;
}

/**
 * D-23 (סעיף 53(א)(6) לחוק הפיקוח): התממת שם עוסק יחיד במרשם העיצומים הכספיים (mirsham.xlsx).
 */
export function sanitizeOperatorEntityName(
  rawName: string | null | undefined,
  corpId: string | null
): string | null {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const isCorporatePattern =
    /(בע"מ|בע״מ|בע'מ|ע"ר|ע״ר|\(ע"ר\)|עמותת|עמותה|חברת|חברה|רשות|עיריית|מועצה|ויצו|נעמת|אמונה|מתנ"ס|מתנס)/.test(
      trimmed
    );

  if (corpId || isCorporatePattern) {
    return trimmed;
  }
  return 'עוסק יחיד';
}
