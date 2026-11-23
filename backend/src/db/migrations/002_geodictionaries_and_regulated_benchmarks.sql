-- ============================================================================
-- Migration 002: Geo-Dictionaries (Cities, Streets, Synonyms) & Regulated Tuition Benchmarks
-- פרויקט "ילדי היקר" (hasadna/dear_child) — חלק 4.2 (docs/04 סעיף 3, D-25, D-26)
-- ============================================================================

-- 1. טבלת יישובים רשמית (מבוססת הלמ"ס / רשות האוכלוסין מ-data.gov.il + אוכלוסיית גיל 0-5)
CREATE TABLE IF NOT EXISTS public.cities (
    city_code               INTEGER PRIMARY KEY,                    -- סמל יישוב למ"ס (למשל 5000 לתל אביב-יפו, 3000 לירושלים)
    city_name_he            TEXT NOT NULL UNIQUE,                   -- שם יישוב תקני בעברית
    city_name_norm          TEXT NOT NULL,                          -- שם מנורמל לחיפוש (ללא מקפים/רווחים כפולים)
    workspace_slug          TEXT,                                   -- מזהה מרחב עירוני אם קיים (למשל 'rkhobot', 'tlv')
    district_he             TEXT,                                   -- מחוז
    socio_economic_cluster  SMALLINT CHECK (socio_economic_cluster BETWEEN 1 AND 10), -- אשכול חברתי-כלכלי למ"ס (לסיבסוד ניצנים ולמפל גיבוי ב-Sanity Check)
    children_age_0_5        INTEGER CHECK (children_age_0_5 >= 0),  -- מספר ילדים בגילאי 0-5 (ממאגר רשות האוכלוסין)
    geom_centroid           GEOMETRY(Point, 4326),                  -- מרכז היישוב (WGS84)
    updated_at              DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_cities_name_trgm ON public.cities USING GIN (city_name_norm gin_trgm_ops);

-- 2. טבלת רחובות רשמית ושמות נרדפים (ממאגרי data.gov.il: dataset/321 ו-israel-streets-synom)
CREATE TABLE IF NOT EXISTS public.streets (
    street_id           BIGSERIAL PRIMARY KEY,
    city_code           INTEGER NOT NULL REFERENCES public.cities(city_code) ON DELETE CASCADE,
    street_code         INTEGER NOT NULL,                       -- סמל רחוב רשמי ביישוב
    street_name_he      TEXT NOT NULL,                          -- שם רחוב רשמי
    street_name_norm    TEXT NOT NULL,                          -- שם רחוב מנורמל
    neighborhood_he     TEXT,                                   -- שכונה (אם קיימת ב-GIS העירוני)
    geom_center         GEOMETRY(Point, 4326),                  -- נקודת אמצע הרחוב (משמשת גם להקהיית מיקום בשלב ב'!)
    UNIQUE (city_code, street_code)
);

CREATE INDEX IF NOT EXISTS idx_streets_city_trgm ON public.streets USING GIN (street_name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_streets_city_code ON public.streets (city_code);

CREATE TABLE IF NOT EXISTS public.street_synonyms (
    synonym_id          BIGSERIAL PRIMARY KEY,
    city_code           INTEGER NOT NULL,
    street_code         INTEGER NOT NULL,
    synonym_name_he     TEXT NOT NULL,
    synonym_name_norm   TEXT NOT NULL,
    FOREIGN KEY (city_code, street_code) REFERENCES public.streets(city_code, street_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_street_synonyms_trgm ON public.street_synonyms USING GIN (synonym_name_norm gin_trgm_ops);

-- 3. טבלת תעריפי ייחוס ממשלתיים מפוקחים (Benchmark מעונות סמל וצהרוני ניצנים — D-12)
CREATE TABLE IF NOT EXISTS public.regulated_tuition_benchmarks (
    benchmark_id            SERIAL PRIMARY KEY,
    school_year             SMALLINT NOT NULL CHECK (school_year BETWEEN 2020 AND 2035), -- למשל 2027 עבור תשפ"ז (2026-2027)
    school_year_label       TEXT NOT NULL,                          -- למשל 'תשפ"ז (2026–2027)'
    framework_track         public.framework_track_enum NOT NULL,   -- 'symbol_regulated' או 'municipal_tzaharon'
    age_group               public.age_group_enum NOT NULL,         -- '0_1' (תינוקות), '1_2'/'2_3' (פעוטות), '3_6' (צהרון ניצנים)
    socio_cluster_min       SMALLINT NOT NULL DEFAULT 1,
    socio_cluster_max       SMALLINT NOT NULL DEFAULT 10,
    monthly_max_price_nis   INTEGER NOT NULL CHECK (monthly_max_price_nis BETWEEN 0 AND 10000),
    official_order_ref      TEXT NOT NULL,                          -- סימוכין לצו הפיקוח / חוזר מנכ"ל
    source_url              TEXT NOT NULL,
    UNIQUE (school_year, framework_track, age_group, socio_cluster_min, socio_cluster_max)
);

GRANT SELECT ON public.cities, public.streets, public.street_synonyms, public.regulated_tuition_benchmarks TO app_public_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities, public.streets, public.street_synonyms, public.regulated_tuition_benchmarks TO app_etl;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_etl;
