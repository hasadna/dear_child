-- ============================================================================
-- מיגרציה 006: הרחבת טווח מחירים ל-0..50,000 ₪, טווח שנים עד 2100,
-- ותמיכה בביטול דיווח עצמי לפי שכבת גיל אופציונלית (p_age_group)
-- ============================================================================

-- 1. עדכון אילוצי CHECK ב-app_private.survey_submissions בצורה אידמפוטנטית
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    FOR v_constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'app_private.survey_submissions'::regclass
          AND contype = 'c'
          AND (
              pg_get_constraintdef(oid) LIKE '%monthly_list_price_nis%'
              OR pg_get_constraintdef(oid) LIKE '%school_year%'
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE app_private.survey_submissions DROP CONSTRAINT IF EXISTS %I',
            v_constraint_name
        );
    END LOOP;
END;
$$;

ALTER TABLE app_private.survey_submissions
    ADD CONSTRAINT chk_survey_monthly_price_range
        CHECK (monthly_list_price_nis BETWEEN 0 AND 50000),
    ADD CONSTRAINT chk_survey_school_year_range
        CHECK (school_year BETWEEN 2020 AND 2100);

-- 2. שדרוג פונקציית Blind Withdraw כך שתתמוך גם בביטול שכבת גיל ספציפית (p_age_group DEFAULT NULL)
DROP FUNCTION IF EXISTS app_private.withdraw_parent_report_blind(UUID, SMALLINT, CHAR(64));

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

GRANT EXECUTE ON FUNCTION app_private.withdraw_parent_report_blind(UUID, SMALLINT, CHAR(64), public.age_group_enum)
    TO app_backend_write;
