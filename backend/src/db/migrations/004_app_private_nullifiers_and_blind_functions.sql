-- ============================================================================
-- Migration 004: app_private Schema, Unlinkable Nullifiers, Blind Upsert & Blind Withdraw
-- פרויקט "ילדי היקר" (hasadna/dear_child) — חלק 4.2 (docs/04 סעיף 5, D-29, D-34, D-38)
-- ============================================================================

-- 1. טבלת מכסת דיווחים שנתית מנותקת (app_private.auth_rate_limits)
CREATE TABLE IF NOT EXISTS app_private.auth_rate_limits (
    quota_hash          CHAR(64) NOT NULL,                      -- HMAC-SHA256(google_sub || ':' || school_year, QUOTA_PEPPER_SEPARATE)
    school_year         SMALLINT NOT NULL CHECK (school_year BETWEEN 2024 AND 2035),
    submissions_count   SMALLINT NOT NULL DEFAULT 1 CHECK (submissions_count BETWEEN 1 AND 5),
    -- קריטי (D-34): אין daycare_id, אין מפתח זר, ואין שום עמודת timestamp למניעת Timing Correlation!
    PRIMARY KEY (quota_hash, school_year)
);

-- 2. טבלת דיווחי ההורים הגולמית (app_private.survey_submissions)
CREATE TABLE IF NOT EXISTS app_private.survey_submissions (
    submission_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ON DELETE RESTRICT (D-38): איסור מחיקה פיזית של גן שיש לו דיווחי הורים!
    daycare_id                  UUID NOT NULL REFERENCES public.daycares(daycare_id) ON DELETE RESTRICT,
    
    -- שנת לימודים (למשל 2027 עבור תשפ"ז, 2026 עבור תשפ"ו, 2025 עבור תשפ"ה - D-30)
    school_year                 SMALLINT NOT NULL CHECK (school_year BETWEEN 2020 AND 2100),
    
    -- Unlinkable Per-Daycare Nullifier (D-34, D-38): מתאפס ל-NULL בסוף שנת הלימודים!
    -- עבור רשומות Seed מפיילוט גיליון ת"א: NULL
    dedup_token                 CHAR(64),
    source_type                 public.report_source_type_enum NOT NULL DEFAULT 'parent_google_oidc',
    
    -- חודש דיווח מעוגל ('YYYY-MM') לבקרה פנימית בלבד (אינו מוצג בשורות הבודדות ב-public! - D-34)
    reported_month              CHAR(7) NOT NULL CHECK (reported_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    
    -- מחיר המחירון החודשי הרגיל ו-4 צירי הנרמול המחייבים (D-12, D-13, D-34, D-38)
    monthly_list_price_nis      INTEGER NOT NULL CHECK (monthly_list_price_nis BETWEEN 0 AND 50000), -- Sanity Check קשיח!
    age_group                   public.age_group_enum NOT NULL,
    framework_track             public.framework_track_enum NOT NULL DEFAULT 'private_full_day',
    
    -- בטופס החי שדות אלו הם NOT NULL חובה; ב-Seed מגיליון ת"א בלבד מותר NULL כאשר השדה לא צוין במקור (D-38)
    hours_sun_thu_start         TIME DEFAULT '07:30',
    hours_sun_thu_end           TIME DEFAULT '16:30',
    -- שדה מחושב אוטומטית: האם מתכונת יום מלא (>= 7 שעות ביום א'-ה') או חצי יום
    is_full_day                 BOOLEAN GENERATED ALWAYS AS (
        COALESCE(
            EXTRACT(EPOCH FROM (hours_sun_thu_end - hours_sun_thu_start)) / 3600.0 >= 7.0,
            framework_track != 'private_half_day'
        )
    ) STORED,
    
    includes_friday             BOOLEAN DEFAULT TRUE,
    hours_fri_start             TIME,
    hours_fri_end               TIME,
    includes_nutrition          BOOLEAN DEFAULT TRUE,
    
    -- שדות עובדתיים מהירים (גודל מסגרת, ממ"ד, מצלמות לגילאי 0-3 בלבד)
    reported_size_bucket        public.size_bucket_enum NOT NULL DEFAULT 'unknown',
    reported_shelter_status     public.tri_state_status_enum NOT NULL DEFAULT 'unknown',
    reported_cameras_0_3        public.tri_state_status_enum NOT NULL DEFAULT 'unknown',
    
    -- אישור הצהרת ההורה: מחיר מחירון כללי ללא הנחות אישיות וללא הפרת סודיות חוזית (D-34 - סעיף 62 לפקודת הנזיקין)
    is_standard_list_price_confirmed BOOLEAN NOT NULL CHECK (is_standard_list_price_confirmed = TRUE),
    is_outlier_confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE, -- האם ההורה אישר חריגה מעל 40% ב-Sanity Check
    is_flagged_hidden           BOOLEAN NOT NULL DEFAULT FALSE,  -- להסתרת דיווח שהוכח כשגוי בבדיקת "מצאתם טעות?"

    -- ייחודיות לפי (dedup_token, age_group): מאפשר להורה לדווח על 2 כיתות גיל באותו גן ללא דריסה הדדית וללא ניפוח קונצנזוס (D-38)
    CONSTRAINT uq_dedup_token_age_group UNIQUE (dedup_token, age_group),

    -- אכיפת 4 צירי החובה בדיווחי הורים חיים (NULL מותר אך ורק בייבוא ה-Seed ההיסטורי מגיליון ת"א - D-38)
    CONSTRAINT chk_live_report_mandatory_axes CHECK (
        source_type = 'community_sheet_tlv_seed' OR (
            dedup_token IS NOT NULL AND
            hours_sun_thu_start IS NOT NULL AND
            hours_sun_thu_end IS NOT NULL AND
            includes_friday IS NOT NULL AND
            includes_nutrition IS NOT NULL
        )
    ),

    -- אכיפת תקינות שעות יום שישי ומצלמות
    CONSTRAINT chk_friday_hours CHECK (
        (includes_friday IS DISTINCT FROM TRUE AND hours_fri_start IS NULL AND hours_fri_end IS NULL) OR
        (includes_friday = TRUE)
    ),
    CONSTRAINT chk_cameras_only_0_3 CHECK (
        age_group != '3_6' OR reported_cameras_0_3 = 'unknown'
    )
);

CREATE INDEX IF NOT EXISTS idx_submissions_daycare_year ON app_private.survey_submissions (daycare_id, school_year, age_group, is_full_day)
    WHERE is_flagged_hidden = FALSE;

-- 3. פונקציית ה-Blind Upsert האטומית (Write-Only — החלפה אטומית לפי dedup_token ותמיכה בריבוי קבוצות גיל - D-38)
CREATE OR REPLACE FUNCTION app_private.submit_parent_report_blind_upsert(
    p_daycare_id                UUID,
    p_school_year               SMALLINT,
    p_dedup_token               CHAR(64),
    p_quota_hash                CHAR(64),
    p_reported_month            CHAR(7),
    p_monthly_list_price_nis    INTEGER,
    p_age_group                 public.age_group_enum,
    p_framework_track           public.framework_track_enum,
    p_hours_sun_thu_start       TIME,
    p_hours_sun_thu_end         TIME,
    p_includes_friday           BOOLEAN,
    p_hours_fri_start           TIME,
    p_hours_fri_end             TIME,
    p_includes_nutrition        BOOLEAN,
    p_reported_size_bucket      public.size_bucket_enum,
    p_reported_shelter_status   public.tri_state_status_enum,
    p_reported_cameras_0_3      public.tri_state_status_enum,
    p_is_list_price_confirmed   BOOLEAN,
    p_is_outlier_confirmed      BOOLEAN,
    p_replace_all_ages_for_token BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_private, public
AS $$
DECLARE
    v_is_official BOOLEAN;
    v_already_exists_for_daycare BOOLEAN;
    v_current_quota SMALLINT;
BEGIN
    -- 1. וידוא שב-MVP1 מדווחים רק על מסגרת רשמית קיימת (D-28)
    SELECT is_official_source INTO v_is_official
    FROM public.daycares
    WHERE daycare_id = p_daycare_id;

    IF v_is_official IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'DAYCARE_NOT_FOUND_OR_NOT_OFFICIAL';
    END IF;

    -- 2. בדיקה פנימית (בזיכרון בלבד, ללא חשיפה החוצה) האם זהו עדכון/שכבת גיל נוספת לגן שכבר דווח ע"י ההורה או גן חדש
    SELECT EXISTS (
        SELECT 1 FROM app_private.survey_submissions WHERE dedup_token = p_dedup_token
    ) INTO v_already_exists_for_daycare;

    -- 3. אם זה גן חדש עבור אותו משתמש באותה שנה — בדיקת ועדכון מכסת 5 הגנים השנתית בטבלה המנותקת
    IF NOT v_already_exists_for_daycare THEN
        INSERT INTO app_private.auth_rate_limits (quota_hash, school_year, submissions_count)
        VALUES (p_quota_hash, p_school_year, 1)
        ON CONFLICT (quota_hash, school_year)
        DO UPDATE SET submissions_count = app_private.auth_rate_limits.submissions_count + 1
        WHERE app_private.auth_rate_limits.submissions_count < 5
        RETURNING submissions_count INTO v_current_quota;

        IF v_current_quota IS NULL THEN
            RAISE EXCEPTION 'ANNUAL_REPORT_QUOTA_EXCEEDED';
        END IF;
    ELSIF p_replace_all_ages_for_token THEN
        -- אם ההורה שלח דיווח מתוקן לאותו גן+שנה (למשל תיקן טעות מקבוצת גיל 1_2 ל-2_3), מוחקים אטומית את השורה הקודמת שלו באותו גן
        DELETE FROM app_private.survey_submissions
        WHERE dedup_token = p_dedup_token AND age_group != p_age_group;
    END IF;

    -- 4. ביצוע Blind Upsert לפי (dedup_token, age_group)
    INSERT INTO app_private.survey_submissions (
        daycare_id, school_year, dedup_token, source_type, reported_month,
        monthly_list_price_nis, age_group, framework_track,
        hours_sun_thu_start, hours_sun_thu_end,
        includes_friday, hours_fri_start, hours_fri_end, includes_nutrition,
        reported_size_bucket, reported_shelter_status, reported_cameras_0_3,
        is_standard_list_price_confirmed, is_outlier_confirmed_by_user
    ) VALUES (
        p_daycare_id, p_school_year, p_dedup_token, 'parent_google_oidc', p_reported_month,
        p_monthly_list_price_nis, p_age_group, p_framework_track,
        p_hours_sun_thu_start, p_hours_sun_thu_end,
        p_includes_friday, p_hours_fri_start, p_hours_fri_end, p_includes_nutrition,
        p_reported_size_bucket, p_reported_shelter_status, p_reported_cameras_0_3,
        p_is_list_price_confirmed, p_is_outlier_confirmed
    )
    ON CONFLICT (dedup_token, age_group) DO UPDATE SET
        reported_month              = EXCLUDED.reported_month,
        monthly_list_price_nis      = EXCLUDED.monthly_list_price_nis,
        framework_track             = EXCLUDED.framework_track,
        hours_sun_thu_start         = EXCLUDED.hours_sun_thu_start,
        hours_sun_thu_end           = EXCLUDED.hours_sun_thu_end,
        includes_friday             = EXCLUDED.includes_friday,
        hours_fri_start             = EXCLUDED.hours_fri_start,
        hours_fri_end               = EXCLUDED.hours_fri_end,
        includes_nutrition          = EXCLUDED.includes_nutrition,
        reported_size_bucket        = EXCLUDED.reported_size_bucket,
        reported_shelter_status     = EXCLUDED.reported_shelter_status,
        reported_cameras_0_3        = EXCLUDED.reported_cameras_0_3,
        is_outlier_confirmed_by_user = EXCLUDED.is_outlier_confirmed_by_user;

    -- תמיד מחזיר TRUE (אפס אורקל בדיקת קיום!)
    RETURN TRUE;
END;
$$;

-- 4. פונקציית Blind Withdraw לביטול/מחיקת דיווח שגוי ע"י ההורה ללא אורקל קיום (סעיף 14 לחוק הפרטיות - D-38)
CREATE OR REPLACE FUNCTION app_private.withdraw_parent_report_blind(
    p_daycare_id    UUID,
    p_school_year   SMALLINT,
    p_dedup_token   CHAR(64),
    p_age_group     public.age_group_enum DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_private, public
AS $$
BEGIN
    DELETE FROM app_private.survey_submissions
    WHERE daycare_id = p_daycare_id
      AND school_year = p_school_year
      AND dedup_token = p_dedup_token
      AND (p_age_group IS NULL OR age_group = p_age_group);

    RETURN TRUE;
END;
$$;

-- 5. נוהל מחיקה ואיפוס שנתי בתום שנת הלימודים (Annual Nullifier Wipe - D-34)
CREATE OR REPLACE FUNCTION app_private.wipe_school_year_nullifiers(p_closed_school_year SMALLINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE app_private.survey_submissions
    SET dedup_token = NULL
    WHERE school_year = p_closed_school_year AND dedup_token IS NOT NULL;

    DELETE FROM app_private.auth_rate_limits
    WHERE school_year = p_closed_school_year;
END;
$$;

-- 6. טבלת פניות "מצאתם טעות?" (בקרת דיוק מידע - סעיף 14 לחוק הפרטיות)
CREATE TABLE IF NOT EXISTS app_private.correction_requests (
    request_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daycare_id          UUID NOT NULL REFERENCES public.daycares(daycare_id) ON DELETE CASCADE,
    issue_category      TEXT NOT NULL CHECK (issue_category IN (
        'wrong_price_outlier',
        'daycare_closed',
        'wrong_address_or_location',
        'wrong_license_status',
        'other_factual_error'
    )),
    structured_details  JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
    reported_month      CHAR(7) NOT NULL
);

GRANT EXECUTE ON FUNCTION app_private.submit_parent_report_blind_upsert TO app_backend_write;
GRANT EXECUTE ON FUNCTION app_private.withdraw_parent_report_blind TO app_backend_write;
GRANT INSERT ON app_private.correction_requests TO app_backend_write;
GRANT SELECT, INSERT, UPDATE ON app_private.survey_submissions, app_private.correction_requests TO app_etl;
