-- ============================================================================
-- Migration 003: Canonical Daycares Table & Cross-Referenced Official Sources
-- פרויקט "ילדי היקר" (hasadna/dear_child) — חלק 4.2 (docs/04 סעיף 4, D-23, D-28, D-36, D-38)
-- ============================================================================

-- 1. טבלת המסגרות הקנונית (public.daycares)
CREATE TABLE IF NOT EXISTS public.daycares (
    daycare_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- מזהים רשמיים חיצוניים (לסינכרון דטרמיניסטי ואיחוד ישויות היררכי - D-36, D-38)
    external_facility_id    TEXT UNIQUE,                        -- מזהה מסגרת מאוחד מצינור הנתונים (md5(_id)[:8] או _id)
    obudget_facility_id     TEXT UNIQUE,                        -- מזהה המסגרת ב-next.obudget.org/datapackages/facilities/all
    moe_symbol              TEXT,                               -- סמל מוסד / סמל מעון במשרד החינוך (GetMeonot / mosdot_edu)
    mol_symbol              TEXT,                               -- סמל מעון / משפחתון במשרד העבודה (daycare-centers)
    welfare_symbol          TEXT,                               -- סמל מסגרת במשרד הרווחה (welfare-frames)
    municipal_gis_id        TEXT,                               -- מזהה שכבת GIS עירונית (למשל שכבה 925 בת"א: 'TLV-925-xxxx')
    
    -- שם המסגרת ונרמול לחיפוש ומניעת כפילויות (Entity Resolution)
    display_name            TEXT NOT NULL,                      -- השם הקנוני להצגה
    official_registry_name  TEXT,                               -- השם הרשמי המדויק במרשם משרד החינוך / העבודה
    normalized_name         TEXT NOT NULL,                      -- שם מנורמל (ללא תחיליות 'מעון'/'גן'/'בע"מ' וללא סימני פיסוק)
    
    -- סיווג חינוכי, גילאים ומשטר רישוי
    min_age_months          SMALLINT CHECK (min_age_months BETWEEN 0 AND 72),
    max_age_months          SMALLINT CHECK (max_age_months BETWEEN 3 AND 84),
    age_groups_supported    public.age_group_enum[] NOT NULL DEFAULT '{0_3}',
    primary_track           public.framework_track_enum NOT NULL DEFAULT 'private_full_day',
    licensing_regime        public.licensing_regime_enum NOT NULL DEFAULT 'daycare_law_0_3',
    
    -- מיקום גיאוגרפי וכתובת (ב-MVP1 כולן מסגרות רשמיות עם כתובת מלאה; בשלב ב' בגן לא-רשמי רק רחוב!)
    city_code               INTEGER NOT NULL REFERENCES public.cities(city_code),
    city_name_he            TEXT NOT NULL,
    neighborhood_he         TEXT,
    street_code             INTEGER,
    street_name_he          TEXT,
    house_number_public     TEXT,                               -- ב-MVP1: מספר בית רשמי. בשלב ב' בגן לא-רשמי ללא Opt-In: NULL!
    full_address_public     TEXT NOT NULL,                      -- ב-MVP1: כתובת מלאה. בשלב ב' בגן לא-רשמי: "רחוב X, עיר Y (מיקום מקורב)"
    is_location_approximated BOOLEAN NOT NULL DEFAULT FALSE,    -- FALSE למסגרת רשמית / Opt-In; TRUE למסגרת לא-רשמית בשלב ב'
    geom                    GEOMETRY(Point, 4326) NOT NULL,     -- קואורדינטה לתצוגה על המפה ולחיפוש מרחבי
    
    -- בעלות, רישוי, פיקוח ואכיפה (ללא מספרי ת"ז של יחידים! - D-23)
    operator_entity_name    TEXT,                               -- שם התאגיד המפעיל (חברה/עמותה/רשות) או 'עוסק יחיד'
    operator_corp_id        TEXT CHECK (operator_corp_id IS NULL OR operator_corp_id ~ '^5[0-9]{8}$'), -- רק ח.פ./ע"ר המתחיל ב-5!
    official_phone_public   TEXT,                               -- טלפון רשמי של המוסד מהמרשם (ב-MVP1 מוצג בכרטיס הגן ב-UI בלבד)
    official_capacity       SMALLINT CHECK (official_capacity > 0), -- קיבולת תקנית רשמית (אם מדווחת במרשם)
    
    license_status          public.license_status_enum NOT NULL DEFAULT 'active_license',
    is_official_source      BOOLEAN NOT NULL DEFAULT TRUE,      -- ב-MVP1: אכיפת TRUE בלבד (D-28)!
    is_active_in_registry   BOOLEAN NOT NULL DEFAULT TRUE,      -- Soft-Status ב-ETL: לעולם לא מוחקים פיזית גן כדי לא לאבד דיווחי הורים (D-38)!
    is_subsidized_symbol    BOOLEAN NOT NULL DEFAULT FALSE,     -- האם מעון סמל מוכר לסבסוד ותעריף מפוקח
    trust_tier              public.trust_tier_enum NOT NULL DEFAULT 'tier_1_official',
    
    -- אכיפה רשמית ממשרד החינוך בלבד (GetMeonot סטטוס צו סגירה + mirsham.xlsx עיצומים כספיים)
    has_active_stop_order   BOOLEAN NOT NULL DEFAULT FALSE,     -- צו הפסקה מנהלי פעיל
    has_official_sanction   BOOLEAN NOT NULL DEFAULT FALSE,     -- עיצום כספי במרשם משרד החינוך
    official_sanction_date  DATE,
    official_sanction_text  TEXT,                               -- ציטוט מדויק של עמודת 'מהות ההפרה' מ-mirsham.xlsx בלבד
    
    -- שדות תשתית מדווחים/רשמיים (ממ"ד ומצלמות)
    shelter_status          public.tri_state_status_enum NOT NULL DEFAULT 'unknown',
    cameras_0_3_status      public.tri_state_status_enum NOT NULL DEFAULT 'unknown',
    
    -- חותמות עדכניות ומקור (לעולם לא שומרים שניות מדויקות של פעולות הורים)
    official_last_checked_at DATE NOT NULL DEFAULT CURRENT_DATE,
    primary_official_source TEXT NOT NULL DEFAULT 'official_registry', -- למשל 'obudget_facilities', 'moe_getmeonot', 'moe_mosdot', 'tlv_gis_925'
    created_at              DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at              DATE NOT NULL DEFAULT CURRENT_DATE,

    -- אכיפת MVP1: אם המסגרת אינה ממקור רשמי (שלב ב'), אסור לחשוף מספר בית או טלפון ללא Opt-In
    CONSTRAINT chk_unlisted_privacy CHECK (
        is_official_source = TRUE OR (house_number_public IS NULL AND official_phone_public IS NULL AND is_location_approximated = TRUE)
    )
);

-- אינדקסים מרחביים וטקסטואליים לחיפוש מהיר ולמניעת כפילויות
CREATE INDEX IF NOT EXISTS idx_daycares_geom ON public.daycares USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_daycares_city_code ON public.daycares (city_code);
CREATE INDEX IF NOT EXISTS idx_daycares_norm_name_trgm ON public.daycares USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_daycares_moe_symbol ON public.daycares (moe_symbol) WHERE moe_symbol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daycares_mol_symbol ON public.daycares (mol_symbol) WHERE mol_symbol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daycares_filters ON public.daycares (city_code, primary_track, license_status, is_subsidized_symbol);

-- 2. טבלת מעקב מקורות רשמיים מוצלבים לכל מסגרת (Provenance & Cross-Reference)
CREATE TABLE IF NOT EXISTS public.daycare_external_sources (
    source_link_id          BIGSERIAL PRIMARY KEY,
    daycare_id              UUID NOT NULL REFERENCES public.daycares(daycare_id) ON DELETE CASCADE,
    source_system           TEXT NOT NULL,                      -- 'facilities_datapackage', 'obudget', 'moe_getmeonot', 'moe_mosdot', 'mol_daycare', 'welfare', 'tlv_gis_925'
    external_record_id      TEXT NOT NULL,                      -- המזהה במאגר המקור
    source_license          TEXT NOT NULL,                      -- 'ODbL-1.0', 'CC-BY-SA-4.0', 'data.gov.il', 'TLV-OpenData'
    raw_status_text         TEXT,                               -- הסטטוס המקורי כפי שהופיע במאגר
    last_synced_at          DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (source_system, external_record_id)
);

CREATE INDEX IF NOT EXISTS idx_ext_sources_daycare ON public.daycare_external_sources (daycare_id);

GRANT SELECT ON public.daycares, public.daycare_external_sources TO app_public_ro, app_backend_write;
GRANT SELECT, INSERT, UPDATE ON public.daycares, public.daycare_external_sources TO app_etl;
