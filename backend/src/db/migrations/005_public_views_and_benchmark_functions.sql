-- ============================================================================
-- Migration 005: Public Views, Multi-Age Pin Collapse, YoY History & Spatial Benchmarks
-- פרויקט "ילדי היקר" (hasadna/dear_child) — חלק 4.2 (docs/04 סעיף 6, D-30, D-31, D-34, D-38)
-- ============================================================================

-- 1. View ציבורי של שורות הדיווח הבודדות (ללא dedup_token וללא חודש דיווח! - D-34)
CREATE OR REPLACE VIEW public.daycare_tuition_reports AS
SELECT
    s.submission_id,
    s.daycare_id,
    s.school_year,
    CASE s.school_year
        WHEN 2024 THEN 'תשפ"ד (2023–2024)'
        WHEN 2025 THEN 'תשפ"ה (2024–2025)'
        WHEN 2026 THEN 'תשפ"ו (2025–2026)'
        WHEN 2027 THEN 'תשפ"ז (2026–2027)'
        ELSE s.school_year::TEXT
    END AS school_year_label,
    s.source_type,
    s.monthly_list_price_nis,
    s.age_group,
    s.framework_track,
    s.hours_sun_thu_start,
    s.hours_sun_thu_end,
    s.is_full_day,
    s.includes_friday,
    s.hours_fri_start,
    s.hours_fri_end,
    s.includes_nutrition,
    s.reported_size_bucket,
    s.reported_shelter_status,
    s.reported_cameras_0_3
FROM app_private.survey_submissions s
WHERE s.is_flagged_hidden = FALSE;

GRANT SELECT ON public.daycare_tuition_reports TO app_public_ro;

-- 2. View אגרגציית מחירים לכל גן, שנה, גיל ומתכונת (D-31 + הפרדת Seed מ-OIDC לפי D-38)
CREATE OR REPLACE VIEW public.daycare_price_aggregates AS
WITH group_has_live AS (
    SELECT
        s.*,
        BOOL_OR(s.source_type != 'community_sheet_tlv_seed') OVER (
            PARTITION BY s.daycare_id, s.school_year, s.age_group, s.framework_track, s.is_full_day
        ) AS has_live_oidc_reports
    FROM app_private.survey_submissions s
    WHERE s.is_flagged_hidden = FALSE
),
effective_reports AS (
    -- D-38: ברגע שיש דיווחי OIDC חיים לאותה שנה+גיל+מסלול, הם מחליפים את שורת ה-Seed הלא-מאומתת בחישוב הפעיל
    SELECT
        g.*,
        FIRST_VALUE(g.monthly_list_price_nis) OVER (
            PARTITION BY g.daycare_id, g.school_year, g.age_group, g.framework_track, g.is_full_day
            ORDER BY g.reported_month DESC, g.submission_id DESC
        ) AS latest_price_nis
    FROM group_has_live g
    WHERE NOT g.has_live_oidc_reports OR g.source_type != 'community_sheet_tlv_seed'
)
SELECT
    r.daycare_id,
    r.school_year,
    r.age_group,
    r.framework_track,
    r.is_full_day,
    COUNT(*)::INTEGER AS reports_count,
    COUNT(*) FILTER (WHERE r.source_type != 'community_sheet_tlv_seed')::INTEGER AS live_verified_reports_count,
    MIN(r.monthly_list_price_nis)::INTEGER AS min_price_nis,
    MAX(r.monthly_list_price_nis)::INTEGER AS max_price_nis,
    ROUND(AVG(r.monthly_list_price_nis))::INTEGER AS avg_price_nis,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.monthly_list_price_nis))::INTEGER AS median_price_nis,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY r.monthly_list_price_nis))::INTEGER AS p25_price_nis,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY r.monthly_list_price_nis))::INTEGER AS p75_price_nis,
    MAX(r.latest_price_nis)::INTEGER AS latest_price_nis,
    MAX(r.reported_month) AS last_updated_month,
    
    -- אופן הצגת המחיר לפי D-31
    CASE
        WHEN COUNT(*) = 1 THEN 'single'
        WHEN COUNT(*) = 2 AND (MAX(r.monthly_list_price_nis) - MIN(r.monthly_list_price_nis))::NUMERIC / NULLIF(MIN(r.monthly_list_price_nis), 0) > 0.05
            THEN 'range_discrepancy'
        WHEN COUNT(*) = 2 THEN 'average_close'
        ELSE 'median_consensus'
    END AS price_display_mode,
    
    -- המחיר הייצוגי הראשי לסיכת המפה ולחישובי השוואה אזוריים
    CASE
        WHEN COUNT(*) = 1 THEN MIN(r.monthly_list_price_nis)::INTEGER
        WHEN COUNT(*) = 2 AND (MAX(r.monthly_list_price_nis) - MIN(r.monthly_list_price_nis))::NUMERIC / NULLIF(MIN(r.monthly_list_price_nis), 0) > 0.05
            THEN MAX(r.latest_price_nis)::INTEGER
        WHEN COUNT(*) = 2 THEN ROUND(AVG(r.monthly_list_price_nis))::INTEGER
        ELSE ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.monthly_list_price_nis))::INTEGER
    END AS primary_pin_price_nis,
    
    -- האם להציג סימן '~' על סיכת המפה (כאשר N=2 והפער מעל 5%)
    (COUNT(*) = 2 AND (MAX(r.monthly_list_price_nis) - MIN(r.monthly_list_price_nis))::NUMERIC / NULLIF(MIN(r.monthly_list_price_nis), 0) > 0.05) AS pin_requires_tilde,
    
    -- דרגת אמינות המחיר (D-38: קונצנזוס Tier 2 מחייב לפחות 3 דיווחי OIDC חיים!)
    CASE
        WHEN COUNT(*) FILTER (WHERE r.source_type != 'community_sheet_tlv_seed') >= 3
            THEN 'tier_2_parent_consensus'::public.trust_tier_enum
        ELSE 'tier_3_unverified_report'::public.trust_tier_enum
    END AS price_trust_tier
FROM effective_reports r
GROUP BY r.daycare_id, r.school_year, r.age_group, r.framework_track, r.is_full_day;

GRANT SELECT ON public.daycare_price_aggregates TO app_public_ro;

-- 3. View סיכום מאוחד ברמת גן+שנה למניעת כפילות סיכות במפה ללא פילטר גיל (D-38)
CREATE OR REPLACE VIEW public.daycare_year_summary AS
WITH prioritized_tracks AS (
    SELECT
        a.*,
        BOOL_OR(a.is_full_day) OVER (PARTITION BY a.daycare_id, a.school_year) AS has_full_day_reports
    FROM public.daycare_price_aggregates a
)
SELECT
    p.daycare_id,
    p.school_year,
    SUM(p.reports_count)::INTEGER AS total_reports_count,
    SUM(p.live_verified_reports_count)::INTEGER AS total_live_verified_count,
    MIN(p.min_price_nis)::INTEGER AS min_price_nis,
    MAX(p.max_price_nis)::INTEGER AS max_price_nis,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.primary_pin_price_nis))::INTEGER AS primary_pin_price_nis,
    (SUM(p.reports_count) = 2 AND (MAX(p.max_price_nis) - MIN(p.min_price_nis))::NUMERIC / NULLIF(MIN(p.min_price_nis), 0) > 0.05) AS pin_requires_tilde,
    CASE
        WHEN SUM(p.live_verified_reports_count) >= 3 THEN 'tier_2_parent_consensus'::public.trust_tier_enum
        ELSE 'tier_3_unverified_report'::public.trust_tier_enum
    END AS price_trust_tier,
    CASE
        WHEN SUM(p.reports_count) = 1 THEN 'single'
        WHEN SUM(p.reports_count) = 2 AND (MAX(p.max_price_nis) - MIN(p.min_price_nis))::NUMERIC / NULLIF(MIN(p.min_price_nis), 0) > 0.05
            THEN 'range_discrepancy'
        WHEN SUM(p.reports_count) = 2 THEN 'average_close'
        ELSE 'median_consensus'
    END AS price_display_mode,
    ARRAY_AGG(DISTINCT p.age_group) AS reported_age_groups,
    MAX(p.last_updated_month) AS last_updated_month
FROM prioritized_tracks p
WHERE p.is_full_day = p.has_full_day_reports
GROUP BY p.daycare_id, p.school_year;

GRANT SELECT ON public.daycare_year_summary TO app_public_ro;

-- 4. View היסטוריית מחירים רב-שנתית ושינוי לאורך השנים (YoY Trend - D-30)
CREATE OR REPLACE VIEW public.daycare_price_history_yoy AS
SELECT
    a.daycare_id,
    a.school_year,
    a.age_group,
    a.framework_track,
    a.is_full_day,
    a.reports_count,
    a.price_display_mode,
    a.primary_pin_price_nis AS representative_price_nis,
    a.min_price_nis,
    a.max_price_nis,
    a.median_price_nis,
    a.price_trust_tier,
    LAG(a.primary_pin_price_nis) OVER (
        PARTITION BY a.daycare_id, a.age_group, a.framework_track, a.is_full_day
        ORDER BY a.school_year
    ) AS prev_year_price_nis,
    (a.primary_pin_price_nis - LAG(a.primary_pin_price_nis) OVER (
        PARTITION BY a.daycare_id, a.age_group, a.framework_track, a.is_full_day
        ORDER BY a.school_year
    ))::INTEGER AS yoy_diff_nis,
    ROUND(
        100.0 * (a.primary_pin_price_nis - LAG(a.primary_pin_price_nis) OVER (
            PARTITION BY a.daycare_id, a.age_group, a.framework_track, a.is_full_day
            ORDER BY a.school_year
        ))::NUMERIC / NULLIF(LAG(a.primary_pin_price_nis) OVER (
            PARTITION BY a.daycare_id, a.age_group, a.framework_track, a.is_full_day
            ORDER BY a.school_year
        ), 0),
        1
    ) AS yoy_diff_pct
FROM public.daycare_price_aggregates a;

GRANT SELECT ON public.daycare_price_history_yoy TO app_public_ro;

-- 5. פונקציית השוואת מחיר יחסית ללא הטיית משקל רב-גילאית (D-30, D-38)
CREATE OR REPLACE FUNCTION public.get_daycare_benchmarks(
    p_daycare_id        UUID,
    p_school_year       SMALLINT,
    p_age_group         public.age_group_enum,
    p_framework_track   public.framework_track_enum,
    p_is_full_day       BOOLEAN
)
RETURNS TABLE (
    benchmark_scope     TEXT,
    sample_daycares_n   INTEGER,
    median_price_nis    INTEGER,
    p25_price_nis       INTEGER,
    p75_price_nis       INTEGER,
    diff_from_median_nis INTEGER,
    diff_from_median_pct NUMERIC(5,1)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_city_code INTEGER;
    v_geom GEOMETRY(Point, 4326);
    v_target_price INTEGER;
BEGIN
    SELECT d.city_code, d.geom, COALESCE(a.primary_pin_price_nis, ys.primary_pin_price_nis)
    INTO v_city_code, v_geom, v_target_price
    FROM public.daycares d
    LEFT JOIN public.daycare_price_aggregates a
        ON a.daycare_id = d.daycare_id
        AND a.school_year = p_school_year
        AND a.age_group = p_age_group
        AND a.framework_track = p_framework_track
        AND a.is_full_day = p_is_full_day
    LEFT JOIN public.daycare_year_summary ys
        ON ys.daycare_id = d.daycare_id
        AND ys.school_year = p_school_year
    WHERE d.daycare_id = p_daycare_id;

    RETURN QUERY
    -- 1. רדיוס 1 ק"מ (1000 מטר) — משקל שווה (1) לכל גן באמצעות daycare_year_summary (D-38)
    SELECT
        'radius_1km'::TEXT,
        COUNT(DISTINCT d2.daycare_id)::INTEGER,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER,
        (v_target_price - ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER)::INTEGER,
        ROUND(100.0 * (v_target_price - PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::NUMERIC
            / NULLIF(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis)::NUMERIC, 0), 1)
    FROM public.daycares d2
    JOIN public.daycare_year_summary ys2 ON ys2.daycare_id = d2.daycare_id
    WHERE d2.city_code = v_city_code
      AND d2.primary_track = p_framework_track
      AND ST_DWithin(d2.geom::geography, v_geom::geography, 1000)
      AND ys2.school_year = p_school_year
    HAVING COUNT(DISTINCT d2.daycare_id) >= 3

    UNION ALL

    -- 2. כלל הגנים באותה עיר ובאותו מסלול — משקל שווה (1) לכל גן באמצעות daycare_year_summary (D-38)
    SELECT
        'city_all_same_track'::TEXT,
        COUNT(DISTINCT d2.daycare_id)::INTEGER,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER,
        (v_target_price - ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::INTEGER)::INTEGER,
        ROUND(100.0 * (v_target_price - PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis))::NUMERIC
            / NULLIF(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ys2.primary_pin_price_nis)::NUMERIC, 0), 1)
    FROM public.daycares d2
    JOIN public.daycare_year_summary ys2 ON ys2.daycare_id = d2.daycare_id
    WHERE d2.city_code = v_city_code
      AND d2.primary_track = p_framework_track
      AND ys2.school_year = p_school_year
    HAVING COUNT(DISTINCT d2.daycare_id) >= 3

    UNION ALL

    -- 3. גנים עם פרמטרים דומים בעיר ("תפוחים לתפוחים": אותה עיר + אותה קבוצת גיל + אותו מסלול + אותה מתכונת יום מלא/חצי יום)
    SELECT
        'city_similar_params'::TEXT,
        COUNT(DISTINCT d2.daycare_id)::INTEGER,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a2.primary_pin_price_nis))::INTEGER,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY a2.primary_pin_price_nis))::INTEGER,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY a2.primary_pin_price_nis))::INTEGER,
        (v_target_price - ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a2.primary_pin_price_nis))::INTEGER)::INTEGER,
        ROUND(100.0 * (v_target_price - PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a2.primary_pin_price_nis))::NUMERIC
            / NULLIF(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a2.primary_pin_price_nis)::NUMERIC, 0), 1)
    FROM public.daycares d2
    JOIN public.daycare_price_aggregates a2 ON a2.daycare_id = d2.daycare_id
    WHERE d2.city_code = v_city_code
      AND a2.school_year = p_school_year
      AND a2.age_group = p_age_group
      AND a2.framework_track = p_framework_track
      AND a2.is_full_day = p_is_full_day
    HAVING COUNT(DISTINCT d2.daycare_id) >= 3;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daycare_benchmarks TO app_public_ro;

-- 6. מפל גיבוי תלת-שלבי לחציון הייחוס ב-Sanity Check (Cold Start Fallback Cascade - D-38)
CREATE OR REPLACE FUNCTION public.get_sanity_check_reference_median(
    p_city_code         INTEGER,
    p_school_year       SMALLINT,
    p_framework_track   public.framework_track_enum,
    p_age_group         public.age_group_enum
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_median INTEGER;
    v_count INTEGER;
    v_cluster SMALLINT;
    v_district TEXT;
BEGIN
    -- שלב 1: חציון העיר לאותו מסלול (אם יש לפחות N >= 5 גנים מדווחים בעיר)
    SELECT
        COUNT(DISTINCT d.daycare_id),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.primary_pin_price_nis))::INTEGER
    INTO v_count, v_median
    FROM public.daycares d
    JOIN public.daycare_price_aggregates a ON a.daycare_id = d.daycare_id
    WHERE d.city_code = p_city_code
      AND a.school_year = p_school_year
      AND a.framework_track = p_framework_track;

    IF v_count >= 5 AND v_median IS NOT NULL THEN
        RETURN v_median;
    END IF;

    -- שלב 2: חציון אשכול חברתי-כלכלי למ"ס דומה (±1) או אותו מחוז (אם יש N >= 5 גנים)
    SELECT socio_economic_cluster, district_he INTO v_cluster, v_district
    FROM public.cities WHERE city_code = p_city_code;

    SELECT
        COUNT(DISTINCT d.daycare_id),
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.primary_pin_price_nis))::INTEGER
    INTO v_count, v_median
    FROM public.daycares d
    JOIN public.cities c ON c.city_code = d.city_code
    JOIN public.daycare_price_aggregates a ON a.daycare_id = d.daycare_id
    WHERE a.school_year = p_school_year
      AND a.framework_track = p_framework_track
      AND (
          (v_cluster IS NOT NULL AND c.socio_economic_cluster BETWEEN v_cluster - 1 AND v_cluster + 1)
          OR (v_district IS NOT NULL AND c.district_he = v_district)
      );

    IF v_count >= 5 AND v_median IS NOT NULL THEN
        RETURN v_median;
    END IF;

    -- שלב 3: חציון ארצי לאותו מסלול, או קבוע ייחוס ארצי התחלתי (Cold Start Day-1)
    SELECT
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.primary_pin_price_nis))::INTEGER
    INTO v_median
    FROM public.daycare_price_aggregates a
    WHERE a.school_year = p_school_year
      AND a.framework_track = p_framework_track;

    RETURN COALESCE(
        v_median,
        CASE p_framework_track
            WHEN 'symbol_regulated' THEN 2515
            WHEN 'municipal_tzaharon' THEN 1050
            WHEN 'private_half_day' THEN 3200
            ELSE 4500
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sanity_check_reference_median TO app_public_ro;
