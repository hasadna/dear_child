import { createPublicKey, createVerify, JsonWebKey } from 'node:crypto';

export interface AuthVerifiers {
  /**
   * מאמת קריפטוגרפית את ה-Google ID Token (Scope: openid בלבד) ומחזיר אך ורק את ה-sub המספרי.
   * לעולם אינו מחזיר או שומר כתובת מייל או שם משתמש (D-29, D-34).
   */
  verifyGoogleIdToken(idToken: string): Promise<{ sub: string } | null>;

  /**
   * מאמת טוקן חד-פעמי של Cloudflare Turnstile (ללא שמירת או העברת IP ללוגים).
   */
  verifyTurnstileToken(turnstileToken: string): Promise<boolean>;
}

interface GoogleJwksResponse {
  keys: (JsonWebKey & { kid?: string; alg?: string })[];
}

let cachedGoogleKeys: Map<string, JsonWebKey> | null = null;
let cachedGoogleKeysExpiresAt = 0;

async function getGooglePublicJwk(kid: string): Promise<JsonWebKey | null> {
  const now = Date.now();
  if (!cachedGoogleKeys || now >= cachedGoogleKeysExpiresAt) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleJwksResponse;
    const map = new Map<string, JsonWebKey>();
    for (const k of data.keys || []) {
      if (k.kid) map.set(k.kid, k);
    }
    cachedGoogleKeys = map;
    cachedGoogleKeysExpiresAt = now + 3600_000;
  }
  return cachedGoogleKeys.get(kid) || null;
}

/**
 * מימוש פרודקשן של אימות Google OIDC (מול JWKS הרשמי של גוגל) ו-Cloudflare Turnstile
 */
export function createProductionAuthVerifiers(options: {
  googleClientId: string;
  turnstileSecretKey: string;
  nodeEnv: 'development' | 'production' | 'test';
}): AuthVerifiers {
  return {
    async verifyGoogleIdToken(idToken: string): Promise<{ sub: string } | null> {
      if (!idToken || typeof idToken !== 'string') return null;

      // בסביבת פיתוח מקומית ללא GOOGLE_CLIENT_ID מוגדר, מאפשר טוקן פיתוח בפורמט dev_sub_<21_digits>
      if (
        options.nodeEnv !== 'production' &&
        !options.googleClientId &&
        /^dev_sub_\d{10,30}$/.test(idToken)
      ) {
        return { sub: idToken.replace(/^dev_sub_/, '') };
      }

      try {
        const parts = idToken.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;
        const header = JSON.parse(
          Buffer.from(headerB64, 'base64url').toString('utf8')
        ) as { alg?: string; kid?: string };
        if (header.alg !== 'RS256' || !header.kid) return null;

        const jwk = await getGooglePublicJwk(header.kid);
        if (!jwk) return null;

        const pubKey = createPublicKey({ key: jwk, format: 'jwk' });
        const verifier = createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        verifier.end();

        const isValidSig = verifier.verify(
          pubKey,
          Buffer.from(signatureB64, 'base64url')
        );
        if (!isValidSig) return null;

        const payload = JSON.parse(
          Buffer.from(payloadB64, 'base64url').toString('utf8')
        ) as {
          iss?: string;
          aud?: string;
          sub?: string;
          exp?: number;
        };

        if (
          payload.iss !== 'https://accounts.google.com' &&
          payload.iss !== 'accounts.google.com'
        ) {
          return null;
        }
        if (
          options.googleClientId &&
          payload.aud !== options.googleClientId
        ) {
          return null;
        }
        const nowSec = Math.floor(Date.now() / 1000);
        if (!payload.exp || payload.exp < nowSec) {
          return null;
        }
        if (!payload.sub || !/^\d{10,30}$/.test(payload.sub)) {
          return null;
        }

        // שולפים אך ורק את ה-sub המספרי וזורקים מהזיכרון את כל שאר שדות ה-JWT (אפס שמירת email!)
        return { sub: payload.sub };
      } catch {
        return null;
      }
    },

    async verifyTurnstileToken(turnstileToken: string): Promise<boolean> {
      if (!turnstileToken || typeof turnstileToken !== 'string') return false;

      if (options.nodeEnv !== 'production' && !options.turnstileSecretKey) {
        return turnstileToken.length >= 4;
      }

      try {
        const form = new URLSearchParams();
        form.set('secret', options.turnstileSecretKey);
        form.set('response', turnstileToken);

        const res = await fetch(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            body: form,
          }
        );
        if (!res.ok) return false;
        const data = (await res.json()) as { success?: boolean };
        return Boolean(data.success);
      } catch {
        return false;
      }
    },
  };
}
