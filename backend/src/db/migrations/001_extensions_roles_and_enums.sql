-- ============================================================================
-- Migration 001: Extensions, Schemas, Database Roles & Enumerated Types (ENUMs)
-- פרויקט "ילדי היקר" (hasadna/dear_child) — חלק 4.2 (docs/04 סעיף 2)
-- ============================================================================

-- 1. Extensions & Schemas
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app_private;

-- 2. Database Roles & Least-Privilege Permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_public_ro') THEN
        CREATE ROLE app_public_ro NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_backend_write') THEN
        CREATE ROLE app_backend_write NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_etl') THEN
        CREATE ROLE app_etl NOLOGIN;
    END IF;
END
$$;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM app_public_ro;
GRANT USAGE ON SCHEMA public TO app_public_ro, app_backend_write, app_etl;
GRANT USAGE ON SCHEMA app_private TO app_backend_write, app_etl;

-- 3. Enumerated Types (ENUMs) — מניעת טקסט חופשי ואכיפת ערכים מובנים (D-08)

-- קבוצות גיל (D-12, D-13, D-16): כיסוי מלא ללידה עד 6 כבר ב-MVP1
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_group_enum') THEN
        CREATE TYPE public.age_group_enum AS ENUM (
            '0_1',   -- תינוקות (לידה עד שנה / ~3–15 חודשים)
            '1_2',   -- פעוטות צעירים (שנה עד שנתיים / ~15–24 חודשים)
            '2_3',   -- פעוטות בוגרים (שנתיים עד שלוש / ~24–36 חודשים)
            '0_3',   -- רב-גילי לידה עד 3 (כאשר המחיר אחיד לכל השכבות במעון)
            '3_6'    -- גני ילדים גילאי 3–6 (גן פרטי/מוכש"ר או צהרון בגן עירייה)
        );
    END IF;
END
$$;

-- מסלול המסגרת (D-12, D-16): הפרדת תפוחים-לתפוחים בין שוק חופשי, סמל וצהרון
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_track_enum') THEN
        CREATE TYPE public.framework_track_enum AS ENUM (
            'private_full_day',     -- מעון/גן פרטי בשוק החופשי (יום מלא)
            'private_half_day',     -- מעון/גן פרטי עד הצהריים בלבד (ללא צהרון)
            'symbol_regulated',     -- מעון סמל / משפחתון סמל בפיקוח מחירים וסבסוד משרד העבודה
            'municipal_tzaharon',   -- צהרון בגן עירייה (גילאי 3–6, כגון מתווה ניצנים או צהרון פרטי)
            'rehab_or_welfare'      -- מעון יום שיקומי / מסגרת רווחה
        );
    END IF;
END
$$;

-- משטר הרישוי החוקי החל על המסגרת (חוק הפיקוח 0-3 מול חוק פיקוח בתי ספר 3-6)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'licensing_regime_enum') THEN
        CREATE TYPE public.licensing_regime_enum AS ENUM (
            'daycare_law_0_3',      -- חוק הפיקוח על מעונות יום לפעוטות (חובת רישיון מ-7 פעוטות ומעלה)
            'schools_law_3_6',      -- חוק פיקוח על בתי ספר (חובת רישיון מ-11 תלמידים ומעלה בגילאי 3-6)
            'municipal_public',     -- גן עירייה רשמי / ממלכתי
            'exempt_small_home'     -- מסגרת קטנה הפטורה מרישיון לפי הצהרה (עד 6 בגילאי 0-3, עד 10 בגילאי 3-6 — שלב ב')
        );
    END IF;
END
$$;

-- סטטוס רישוי רשמי מול משרד החינוך / העבודה
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status_enum') THEN
        CREATE TYPE public.license_status_enum AS ENUM (
            'active_license',       -- רישיון הפעלה בתוקף
            'in_licensing_process', -- בתהליך רישוי (כולל הסדר רציפות — חוקי ופועל בפיקוח)
            'symbol_recognized',    -- מוכר כמעון/משפחתון סמל (משרד העבודה)
            'municipal_verified',   -- מופיע במאגר מוניציפלי רשמי (GIS עירוני) ללא סמל משרד החינוך משויך
            'unlisted_in_registry', -- לא אותר אוטומטית במרשם הרשמי (רלוונטי לשלב ב')
            'stop_order_active'     -- צו הפסקה מנהלי / צו סגירה פעיל!
        );
    END IF;
END
$$;

-- דרגת אמינות הנתון (Data Trust Tier)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_tier_enum') THEN
        CREATE TYPE public.trust_tier_enum AS ENUM (
            'tier_1_official',          -- מקור ממשלתי / עירוני רשמי
            'tier_1b_owner_verified',   -- אומת ע"י הנהלת הגן (שלב ב' — Owner Claim)
            'tier_2_parent_consensus',  -- מידע הורים מאומת (קונצנזוס של 3+ דיווחי הורים חיים בלתי תלויים)
            'tier_3_unverified_report'  -- דיווח הורה שטרם אומת (1–2 דיווחים או ייבוא מגיליון קהילתי)
        );
    END IF;
END
$$;

-- אומדן גודל המסגרת בדיווח הורה (להצלבת חובת רישיון 7+ ב-0-3 מול 11+ ב-3-6)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'size_bucket_enum') THEN
        CREATE TYPE public.size_bucket_enum AS ENUM (
            'up_to_6',      -- עד 6 פעוטות (פטור מרישיון בגילאי 0-3)
            '7_or_more',    -- 7 פעוטות ומעלה (חייב ברישיון בגילאי 0-3)
            'up_to_10',     -- עד 10 ילדים (פטור מרישיון בגילאי 3-6)
            '11_or_more',   -- 11 ילדים ומעלה (חייב ברישיון בגילאי 3-6)
            'unknown'       -- לא בטוח / לא ידוע
        );
    END IF;
END
$$;

-- שדות בטיחות מובנים (ממ"ד ומצלמות)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tri_state_status_enum') THEN
        CREATE TYPE public.tri_state_status_enum AS ENUM (
            'yes',
            'no',
            'unknown'
        );
    END IF;
END
$$;

-- מקור רשומת המחיר
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_source_type_enum') THEN
        CREATE TYPE public.report_source_type_enum AS ENUM (
            'parent_google_oidc',       -- דיווח הורה מאומת ב-Google OIDC (MVP1 - D-29)
            'community_sheet_tlv_seed', -- ייבוא פיילוט גיליון ההורים של ת"א לגנים רשמיים מצטלבים (MVP1 - D-28)
            'regulated_tariff_table',   -- תעריף ממשלתי מפוקח רשמי
            'parent_sms_voice_otp',     -- דיווח הורה מאומת ב-SMS/Voice OTP (שלב ב' - D-27)
            'owner_claim_declared'      -- מחיר מוצהר ע"י בעל הגן (שלב ב' - D-22)
        );
    END IF;
END
$$;
