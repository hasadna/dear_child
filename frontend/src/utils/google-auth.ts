const DEV_SUB_STORAGE_KEY = 'dear_child_local_dev_oidc_sub';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityAccounts {
  id: {
    initialize: (config: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      cancel_on_tap_outside?: boolean;
    }) => void;
    prompt: (
      callback?: (notification: {
        isNotDisplayed?: () => boolean;
        isSkippedMoment?: () => boolean;
      }) => void
    ) => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts?: GoogleIdentityAccounts;
    };
  }
}

function getOrCreateLocalDevToken(): string {
  try {
    const existing = window.localStorage.getItem(DEV_SUB_STORAGE_KEY);
    if (existing && /^dev_sub_\d{10,30}$/.test(existing)) {
      return existing;
    }
    const generated = `dev_sub_${Date.now()}100001`;
    window.localStorage.setItem(DEV_SUB_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'dev_sub_107691503500061507151';
  }
}

function loadGoogleGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GSI_LOAD_FAILED')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI_LOAD_FAILED'));
    document.head.appendChild(script);
  });
}

/**
 * משיג Google ID Token (Scope: openid בלבד).
 * - כאשר מוגדר VITE_GOOGLE_CLIENT_ID: פותח את חלון ההתחברות הרשמי של Google Identity Services.
 * - בסביבת פיתוח מקומית ללא VITE_GOOGLE_CLIENT_ID: מנפיק אסימון פיתוח יציב (dev_sub_<digits>) התואם לשרת ה-Backend.
 */
export async function obtainGoogleIdToken(): Promise<string> {
  const clientId =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GOOGLE_CLIENT_ID || '';

  if (!clientId) {
    return getOrCreateLocalDevToken();
  }

  await loadGoogleGsiScript();
  const googleId = window.google?.accounts?.id;
  if (!googleId) {
    throw new Error('GOOGLE_IDENTITY_UNAVAILABLE');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('GOOGLE_SIGNIN_TIMEOUT'));
      }
    }, 60_000);

    googleId.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error('GOOGLE_EMPTY_CREDENTIAL'));
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    googleId.prompt((notification) => {
      if (
        !settled &&
        (notification.isNotDisplayed?.() || notification.isSkippedMoment?.())
      ) {
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error('GOOGLE_SIGNIN_DISMISSED'));
      }
    });
  });
}
