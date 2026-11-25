import { FastifyInstance } from 'fastify';
import { AppConfig } from '../config/env.js';
import {
  CorrectionRequestRecord,
  DaycareRepository,
  SizeBucket,
  TriStateStatus,
} from '../db/daycare-repository.js';
import { DaycareAgeGroup } from '../etl/facilities-resolver.js';
import { FrameworkTrack } from '../etl/official-sources-parsers.js';
import { AuthVerifiers } from '../security/external-verifiers.js';
import {
  getMaxReportableSchoolYear,
  MIN_REPORTABLE_SCHOOL_YEAR,
} from '../utils/school-years.js';
import {
  AUTH_COOKIE_NAME,
  decryptAuthSessionCookie,
  deriveDedupToken,
  deriveQuotaHash,
  encryptAuthSessionCookie,
} from '../security/nullifiers.js';

const VALID_AGE_GROUPS = new Set<DaycareAgeGroup>([
  '0_1',
  '1_2',
  '2_3',
  '0_3',
  '3_6',
]);
const VALID_TRACKS = new Set<FrameworkTrack>([
  'private_full_day',
  'private_half_day',
  'symbol_regulated',
  'municipal_tzaharon',
  'rehab_or_welfare',
]);
const VALID_SIZE_BUCKETS = new Set<SizeBucket>([
  'up_to_6',
  '7_or_more',
  'up_to_10',
  '11_or_more',
  'unknown',
]);
const VALID_TRI_STATES = new Set<TriStateStatus>(['yes', 'no', 'unknown']);
const VALID_ISSUE_CATEGORIES = new Set<CorrectionRequestRecord['issue_category']>([
  'wrong_price_outlier',
  'daycare_closed',
  'wrong_address_or_location',
  'wrong_license_status',
  'other_factual_error',
]);

function currentUtcYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function registerAuthAndReportsRoutes(
  app: FastifyInstance,
  repo: DaycareRepository,
  config: AppConfig,
  verifiers: AuthVerifiers
): Promise<void> {
  // 4.1 אימות חשבון Google ללא כתובת מייל (Scope: openid בלבד) — POST /api/v1/auth/google
  app.post('/api/v1/auth/google', async (req, reply) => {
    const body = (req.body || {}) as { id_token?: string };
    if (!body.id_token || typeof body.id_token !== 'string') {
      reply.code(400);
      return {
        error_code: 'MISSING_ID_TOKEN',
        message_he: 'חסר טוקן אימות מ-Google.',
      };
    }

    const verified = await verifiers.verifyGoogleIdToken(body.id_token);
    if (!verified) {
      reply.code(401);
      return {
        error_code: 'INVALID_GOOGLE_ID_TOKEN',
        message_he: 'אימות חשבון Google נכשל או פג תוקף.',
      };
    }

    // D-29, D-38: הנפקת Strictly Necessary Cookie מוצפנת במפתח HKDF דטרמיניסטי ל-15 דקות (900 שניות)
    const encryptedBlob = encryptAuthSessionCookie(
      verified.sub,
      config.secretPepper,
      900
    );

    reply.setCookie(AUTH_COOKIE_NAME, encryptedBlob, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      path: '/api/v1/reports',
      maxAge: 900,
    });

    return {
      status: 'authenticated',
      expires_in_seconds: 900,
    };
  });

  // 4.2 שליחת דיווח מחיר (Blind Upsert רב-גילאי + Sanity Check היברידי) — POST /api/v1/reports
  app.post('/api/v1/reports', async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const confirmOutlier = Boolean(body.confirm_outlier);

    // 1. אימות עוגיית הסשן yh_auth_session בזיכרון ה-RAM בלבד
    const cookieVal = req.cookies?.[AUTH_COOKIE_NAME];
    const session = cookieVal
      ? decryptAuthSessionCookie(cookieVal, config.secretPepper)
      : null;

    if (!session) {
      reply.code(401);
      return {
        error_code: 'AUTH_SESSION_REQUIRED',
        message_he: 'פג תוקף חיבור האבטחה או שלא בוצעה התחברות עם Google.',
      };
    }

    // 2. אימות Cloudflare Turnstile: נדרש בשליחה הראשונה; באישור חריגה שני (confirm_outlier=true) מסתמכים על העוגייה התקפה (D-38)
    if (!confirmOutlier) {
      const turnstileToken =
        typeof body.turnstile_token === 'string' ? body.turnstile_token : '';
      const turnstileOk = await verifiers.verifyTurnstileToken(turnstileToken);
      if (!turnstileOk) {
        reply.code(403);
        return {
          error_code: 'TURNSTILE_VERIFICATION_FAILED',
          message_he: 'אימות האבטחה (Turnstile) נכשל. אנא נסו שנית.',
        };
      }
    }

    // 3. ולידציה קשיחה של שדות החובה, הצהרת מחיר מחירון וטווח 500–15,000 ₪ (D-12, D-34, D-38)
    const daycareId =
      typeof body.daycare_id === 'string' ? body.daycare_id.trim() : '';
    const schoolYear = Number(body.school_year || config.activeSchoolYear);
    const monthlyListPriceNis = Number(body.monthly_list_price_nis);
    const ageGroup = body.age_group as DaycareAgeGroup;
    const frameworkTrack =
      (body.framework_track as FrameworkTrack) || 'private_full_day';
    const hoursSunThuStart =
      typeof body.hours_sun_thu_start === 'string'
        ? body.hours_sun_thu_start.trim()
        : '';
    const hoursSunThuEnd =
      typeof body.hours_sun_thu_end === 'string'
        ? body.hours_sun_thu_end.trim()
        : '';
    const includesFriday =
      typeof body.includes_friday === 'boolean' ? body.includes_friday : null;
    const hoursFriStart =
      typeof body.hours_fri_start === 'string'
        ? body.hours_fri_start.trim()
        : null;
    const hoursFriEnd =
      typeof body.hours_fri_end === 'string' ? body.hours_fri_end.trim() : null;
    const includesNutrition =
      typeof body.includes_nutrition === 'boolean'
        ? body.includes_nutrition
        : null;
    const reportedSizeBucket =
      (body.reported_size_bucket as SizeBucket) || 'unknown';
    const reportedShelterStatus =
      (body.reported_shelter_status as TriStateStatus) || 'unknown';
    const reportedCameras03 =
      ageGroup === '3_6'
        ? 'unknown'
        : (body.reported_cameras_0_3 as TriStateStatus) || 'unknown';
    const isListPriceConfirmed = body.is_standard_list_price_confirmed === true;
    const replaceAllAgesForToken =
      body.replace_all_ages_for_token === undefined
        ? true
        : Boolean(body.replace_all_ages_for_token);

    const maxReportableSchoolYear = getMaxReportableSchoolYear();
    if (
      !daycareId ||
      !isListPriceConfirmed ||
      !Number.isInteger(schoolYear) ||
      schoolYear < MIN_REPORTABLE_SCHOOL_YEAR ||
      schoolYear > maxReportableSchoolYear ||
      !Number.isInteger(monthlyListPriceNis) ||
      monthlyListPriceNis < 0 ||
      monthlyListPriceNis > 50000 ||
      !VALID_AGE_GROUPS.has(ageGroup) ||
      !VALID_TRACKS.has(frameworkTrack) ||
      !hoursSunThuStart ||
      !hoursSunThuEnd ||
      includesFriday === null ||
      includesNutrition === null ||
      !VALID_SIZE_BUCKETS.has(reportedSizeBucket) ||
      !VALID_TRI_STATES.has(reportedShelterStatus) ||
      !VALID_TRI_STATES.has(reportedCameras03)
    ) {
      reply.code(422);
      return {
        error_code: 'VALIDATION_ERROR',
        message_he:
          'אחד או יותר משדות החובה אינם תקינים (מחיר חייב להיות מספר שלם בין 0 ל-50,000 ₪ ושנת לימודים תקינה).',
      };
    }

    // 4. בדיקת חריגה מעל 40% ממפל חציון הייחוס (Soft Outlier Prompt — D-34, D-38)
    if (!confirmOutlier) {
      const refMedian = await repo.getSanityCheckReferenceMedian({
        daycareId,
        schoolYear,
        frameworkTrack,
        ageGroup,
      });

      if (
        refMedian > 0 &&
        Math.abs(monthlyListPriceNis - refMedian) / refMedian > 0.4
      ) {
        reply.code(409);
        return {
          error_code: 'OUTLIER_CONFIRMATION_REQUIRED',
          message_he: `המחיר שהזנת (₪${monthlyListPriceNis.toLocaleString()}) חורג משמעותית מחציון הייחוס למסלול זה (₪${refMedian.toLocaleString()}). האם זהו אכן מחיר המחירון החודשי המלא (ללא סבסוד אישי או הנחה)?`,
          reference_median_nis: refMedian,
        };
      }
    }

    // 5. גזירת ה-Unlinkable Nullifier בזיכרון ה-RAM וביצוע Blind Upsert (D-34, D-38)
    const dedupToken = deriveDedupToken(
      session.sub,
      daycareId,
      schoolYear,
      config.secretPepper
    );
    const quotaHash = deriveQuotaHash(
      session.sub,
      schoolYear,
      config.quotaPepperSeparate
    );

    try {
      await repo.submitParentReportBlindUpsert({
        daycareId,
        schoolYear,
        dedupToken,
        quotaHash,
        reportedMonth: currentUtcYearMonth(),
        monthlyListPriceNis,
        ageGroup,
        frameworkTrack,
        hoursSunThuStart,
        hoursSunThuEnd,
        includesFriday,
        hoursFriStart: includesFriday ? hoursFriStart : null,
        hoursFriEnd: includesFriday ? hoursFriEnd : null,
        includesNutrition,
        reportedSizeBucket,
        reportedShelterStatus,
        reportedCameras03,
        isStandardListPriceConfirmed: true,
        isOutlierConfirmedByUser: confirmOutlier,
        replaceAllAgesForToken,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('ANNUAL_REPORT_QUOTA_EXCEEDED')) {
        reply.code(429);
        return {
          error_code: 'ANNUAL_REPORT_QUOTA_EXCEEDED',
          message_he: 'הגעת למכסת הדיווחים השנתית המרבית (עד 5 מסגרות לשנת לימודים).',
        };
      }
      if (msg.includes('DAYCARE_NOT_FOUND_OR_NOT_OFFICIAL')) {
        reply.code(404);
        return {
          error_code: 'DAYCARE_NOT_FOUND',
          message_he: 'המסגרת המבוקשת אינה קיימת במאגר המסגרות הרשמיות.',
        };
      }
      throw err;
    }

    // 6. תשובה אחידה תמיד (200 OK — אפס אורקל קיום!)
    return {
      status: 'recorded',
      message_he: 'תודה! הדיווח נקלט במערכת ויסייע להורים נוספים.',
    };
  });

  // 4.3 ביטול/מחיקת דיווח שגוי על גן ספציפי (Blind Withdraw — סעיף 14 לחוק הפרטיות, D-38) — POST /api/v1/reports/withdraw
  app.post('/api/v1/reports/withdraw', async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;

    const cookieVal = req.cookies?.[AUTH_COOKIE_NAME];
    const session = cookieVal
      ? decryptAuthSessionCookie(cookieVal, config.secretPepper)
      : null;

    if (!session) {
      reply.code(401);
      return {
        error_code: 'AUTH_SESSION_REQUIRED',
        message_he: 'נדרשת התחברות עם Google לביצוע ביטול דיווח.',
      };
    }

    const turnstileToken =
      typeof body.turnstile_token === 'string' ? body.turnstile_token : '';
    const turnstileOk = await verifiers.verifyTurnstileToken(turnstileToken);
    if (!turnstileOk) {
      reply.code(403);
      return {
        error_code: 'TURNSTILE_VERIFICATION_FAILED',
        message_he: 'אימות האבטחה (Turnstile) נכשל.',
      };
    }

    const daycareId =
      typeof body.daycare_id === 'string' ? body.daycare_id.trim() : '';
    const schoolYear = Number(body.school_year || config.activeSchoolYear);
    const rawAgeGroup =
      typeof body.age_group === 'string' ? body.age_group.trim() : '';
    const normalizedAgeGroup =
      rawAgeGroup === '0_3_mixed'
        ? ('0_3' as DaycareAgeGroup)
        : (rawAgeGroup as DaycareAgeGroup);
    const ageGroup = rawAgeGroup ? normalizedAgeGroup : null;

    if (
      !daycareId ||
      !Number.isInteger(schoolYear) ||
      (ageGroup !== null && !VALID_AGE_GROUPS.has(ageGroup))
    ) {
      reply.code(422);
      return {
        error_code: 'VALIDATION_ERROR',
        message_he: 'חסר מזהה מסגרת, שנת לימודים או שכבת גיל תקינה.',
      };
    }

    const dedupToken = deriveDedupToken(
      session.sub,
      daycareId,
      schoolYear,
      config.secretPepper
    );

    await repo.withdrawParentReportBlind({
      daycareId,
      schoolYear,
      dedupToken,
      ageGroup,
    });

    // תשובה אחידה תמיד (200 OK — ללא חיווי אם היה קיים דיווח!)
    return {
      status: 'processed',
      message_he:
        'אם היה קיים דיווח משויך לחשבונך בגן זה לשנת הלימודים שנבחרה, הוא הוסר מהמערכת.',
    };
  });

  // 4.4 דיווח על טעות עובדתית בכרטיס גן ("מצאתם טעות?" — D-38) — POST /api/v1/corrections
  app.post('/api/v1/corrections', async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;

    const turnstileToken =
      typeof body.turnstile_token === 'string' ? body.turnstile_token : '';
    const turnstileOk = await verifiers.verifyTurnstileToken(turnstileToken);
    if (!turnstileOk) {
      reply.code(403);
      return {
        error_code: 'TURNSTILE_VERIFICATION_FAILED',
        message_he: 'אימות האבטחה (Turnstile) נכשל.',
      };
    }

    const daycareId =
      typeof body.daycare_id === 'string' ? body.daycare_id.trim() : '';
    const issueCategory =
      body.issue_category as CorrectionRequestRecord['issue_category'];
    const structuredDetails =
      body.structured_details && typeof body.structured_details === 'object'
        ? (body.structured_details as Record<string, unknown>)
        : {};

    if (!daycareId || !VALID_ISSUE_CATEGORIES.has(issueCategory)) {
      reply.code(422);
      return {
        error_code: 'VALIDATION_ERROR',
        message_he: 'חסר מזהה מסגרת או קטגוריית פנייה תקנית.',
      };
    }

    const requestId = await repo.createCorrectionRequest({
      daycareId,
      issueCategory,
      structuredDetails,
      reportedMonth: currentUtcYearMonth(),
    });

    return {
      status: 'received',
      request_id: requestId,
      message_he: 'תודה! הפנייה נקלטה ותיבדק.',
    };
  });
}
