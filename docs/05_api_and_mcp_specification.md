<div dir="rtl">

# איפיון מיקרו חלק ב': מפרט ה-REST API, אימות הורים (`Zero-PII`) ושרת ה-MCP (`API & MCP Spec v1`)

> **מסמך:** `docs/05_api_and_mcp_specification.md` (שלב 2 — איפיון מיקרו מפורט)  
> **תקן מפרט:** `OpenAPI 3.1.0` (REST API) + `Model Context Protocol (MCP 2025-11)`  
> **בסיס נתונים משויך:** [`docs/04_data_schema_v1.md`](./04_data_schema_v1.md) (`PostgreSQL 17 + PostGIS`)  
> **החלטות מוטמעות:** `D-01` עד `D-38` (כולל הפרדת `app_public_ro` מ-`app_backend_write`, טופולוגיית קונטיינר מאוחדת על `hasadna-k8s`, אינדקס סיכות ארצי דחוס ל-`Supercluster`, אימות `Google OIDC` עם `Scope: openid` בלבד ללא קבלת כתובת מייל, `Strictly Necessary Cookie` עם מפתח HKDF דטרמיניסטי, `Blind Upsert` רב-גילאי + `Blind Withdraw` ללא אורקל קיום, `Sanity Check` היברידי עם מפל גיבוי תלת-שלבי, ורישוי `ODbL 1.0`).

---

## 1. עקרונות ארכיטקטורת ה-API, טופולוגיית הקונטיינרים ב-`hasadna-k8s` ומעטפת משפטית (`Envelope`)

1. **טופולוגיית קונטיינרים מאוחדת וחסכונית ב-`hasadna-k8s` (`D-38`):**
   - **קונטיינר ה-Backend (`Node.js / TypeScript`):** חושף באותו תהליך הן את נקודות הקצה של ה-REST API (`/api/v1/*`) והן את שרת ה-MCP (`/mcp` בפרוטוקול `Streamable HTTP / SSE`), תוך החזקת שני Connection Pools מופרדים הרמטית למסד הנתונים (`roPool` תחת `app_public_ro` ו-`writePool` תחת `app_backend_write`).
   - **משימות ה-ETL (`K8s CronJob`):** רצות מתוך אותו Docker Image של ה-Backend (`npm run etl:sync`) תחת המשתמש `app_etl`, ללא ניפוח מספר ה-Deployments בקלאסטר.
   - **ה-Frontend (`React / TypeScript SPA`):** נבנה כ-Static Build ומוגש דרך Nginx קל (או ישירות משכבת ה-Static של ה-Backend לפי תבנית `open-bus-map-search`).
2. **הפרדת הרשאות מסד נתונים בין נקודות הקצה:**
   - כל נקודות הקצה הציבוריות לקריאה (`GET /api/v1/*` ושרת ה-MCP `/mcp`) רצות תחת חיבור DB עם ה-Role **`app_public_ro`** (שיש לו הרשאת `SELECT` על סכמת `public` בלבד ואפס גישה לסכמת `app_private`).
   - רק שלוש נקודות הקצה של כתיבה (`POST /api/v1/reports`, `POST /api/v1/reports/withdraw` ו-`POST /api/v1/corrections`) רצות תחת **`app_backend_write`**, וקוראות אך ורק לפונקציות ה-`SECURITY DEFINER` האטומיות ב-`app_private`.
3. **הגנה מפני קצירת מספרי ניידים (`05x`) ושמות יחידים בייצוא המוני (`צמידות מטרה` וחוק הספאם):**
   - במרשם `GetMeonot` של משרד החינוך כ-68% ממספרי הטלפון של המעונות הם מספרי נייד (`05x`). כדי למנוע כריית מאגר סלולר לספאם מסחרי, **בנקודות הקצה של רשימות וייצוא המוני (`GET /api/v1/daycares` ו-`GET /api/v1/export`) שדה הטלפון מוסתר אם הוא מספר סלולרי (`05x`)**, ומוצג אך ורק בשליפת כרטיס גן בודד (`GET /api/v1/daycares/{daycare_id}`) לטובת הורה המחפש ליצור קשר עם הגן.
4. **מעטפת מטא-דאטה, רישוי (`ODbL 1.0`), ייחוס וכתב ויתור (`meta` Envelope):**
   כל תשובת JSON ב-API וב-MCP כוללת אובייקט `meta` אחיד שמבטיח ציות לתנאי `data.gov.il`, `ODbL 1.0` ודיני הנזיקין (`Reliance Disclaimer`):

<div dir="ltr">

```json
{
  "meta": {
    "api_version": "1.0.0",
    "license": "ODbL-1.0",
    "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
    "attribution_he": "הנתונים הרשמיים מבוססים על 'מפת הטף' ו'מפתח התקציב' (הסדנא לידע ציבורי), מאגרי משרד החינוך, משרד העבודה, משרד הרווחה, הלמ״ס, פורטל data.gov.il, עיריית תל אביב-יפו ונתוני © OpenStreetMap contributors.",
    "non_endorsement_he": "המערכת מופעלת באופן עצמאי ע״י הסדנא לידע ציבורי (ע״ר) ואינה פועלת מטעם או בחסות משרד ממשלתי.",
    "reliance_disclaimer_he": "המידע מוצג להשוואה ראשונית בלבד. נתוני המחירים מבוססים על דיווחי הורים מהשטח ועשויים לכלול טעויות. המידע אינו מהווה תחליף לבדיקה פיזית של תעודת רישיון תקפה בכניסה למסגרת (סעיף 11 לחוק הפיקוח), ממ״ד תקני וחוזה ההתקשרות."
  }
}
```

</div>

---

## 2. סיכום כלל נקודות הקצה (`Endpoints Overview`)

| מתודה ונתיב (`Endpoint`) | ייעוד | הרשאת DB | דרישת אימות / הגנה |
|---|---|---|---|
| `GET /api/v1/daycares` | חיפוש, סינון ומיון מסגרות (לתצוגת הטבלה הנגישה ולשכבת המפה / הקלאסטרים) | `app_public_ro` | פומבי (`Rate Limit: 60 req/min/IP` בזיכרון ה-Ingress בלבד) |
| `GET /api/v1/daycares/{daycare_id}` | שליפת כרטיס מסגרת מלא: רישוי ואכיפה, מחירים לפי גיל/שעות (`D-31`), היסטוריית שנים (`D-30`), השוואה יחסית (`D-30`) ושורות דיווח מותממות (`D-34`) | `app_public_ro` | פומבי (`Rate Limit: 60 req/min/IP`) |
| `GET /api/v1/stats/area` | סטטיסטיקת מחירים מרחבית לפי עיר/רדיוס והשוואה לתעריף הממשלתי המפוקח | `app_public_ro` | פומבי (`Rate Limit: 30 req/min/IP`) |
| `GET /api/v1/autocomplete/locations` | השלמת יישובים ורחובות מקומית ממילוני `data.gov.il` ב-DB (`0 ₪`, ללא ספק חיצוני) | `app_public_ro` | פומבי (`Rate Limit: 120 req/min/IP`) |
| `GET /api/v1/export` | ייצוא תוצאות החיפוש המסוננות לקובץ `CSV` (`UTF-8 BOM`) או `XLSX` | `app_public_ro` | פומבי (`Rate Limit: 10 req/min/IP`) |
| `POST /api/v1/auth/google` | אימות `Google OIDC` (`Scope: openid` בלבד ללא מייל!) והנפקת `Strictly Necessary Cookie` מוצפנת במפתח דטרמיניסטי (`HKDF`) | ללא גישה ל-DB! | `Google ID Token` חתום ע"י Google JWKS |
| `POST /api/v1/reports` | שליחת דיווח מחיר הורה (`Sanity Check` היברידי + `Turnstile` + `Blind Upsert` רב-גילאי עם `Unlinkable Nullifier`) | `app_backend_write` | עוגיית סשן `Google OIDC` + `Cloudflare Turnstile Token` (נדרש בשליחה הראשונה בלבד) |
| `POST /api/v1/reports/withdraw` | ביטול/מחיקת דיווח שגוי על גן ספציפי ע"י ההורה (`Blind Withdraw` — מימוש סעיף 14 לחוק הפרטיות ללא אורקל קיום — `D-38`) | `app_backend_write` | עוגיית סשן `Google OIDC` + `Cloudflare Turnstile Token` |
| `POST /api/v1/corrections` | שליחת דיווח מובנה על טעות עובדתית בכרטיס גן (`"מצאתם טעות?"` — מועבר לבדיקה מדורגת דרך `CLI/Webhook` — `D-38`) | `app_backend_write` | `Cloudflare Turnstile Token` |

---

## 3. מפרט נקודות הקצה הציבוריות לקריאה (`Public Read-Only Endpoints`)

### 3.1 חיפוש וסינון מסגרות למפה ולטבלה הנגישה — `GET /api/v1/daycares`

נקודת קצה זו משרתת הן את **תצוגת הטבלה/הרשימה הנגישה (`ת"י 5568 AA`)** והן את **המפה האינטראקטיבית (`D-32`)**.

#### פרמטרים ב-Query String:

| פרמטר | טיפוס | ברירת מחדל | תיאור וערכים מותרים |
|---|---|---|---|
| `city_code` | `integer` | — | סמל יישוב למ"ס (למשל `5000` לתל אביב-יפו). |
| `lat`, `lng`, `radius_m` | `float`, `float`, `int` | — | חיפוש לפי מיקום ורדיוס במטרים (`100` עד `15000`). |
| `bbox` | `string` | — | תיחום מפה `min_lng,min_lat,max_lng,max_lat` לשליפת סיכות במסך הנוכחי. |
| `school_year` | `integer` | `2027` | שנת לימודים לתצוגת המחיר (`2024` עד `2027` — ברירת מחדל: השנה הפעילה `2027` / תשפ"ז). |
| `age_group` | `string` | — | סינון לפי קבוצת גיל: `0_1`, `1_2`, `2_3`, `0_3`, `3_6`. |
| `framework_track` | `string` | — | `private_full_day`, `private_half_day`, `symbol_regulated`, `municipal_tzaharon`, `rehab_or_welfare`. |
| `is_full_day` | `boolean` | — | `true` (יום מלא 7+ שעות) / `false` (חצי יום). |
| `min_price`, `max_price` | `integer` | — | סינון לפי טווח מחיר חודשי בש"ח (על בסיס `primary_pin_price_nis`). |
| `has_price_only` | `boolean` | `false` | אם `true`, מחזיר רק מסגרות שכבר יש להן דיווח מחיר לשנה המבוקשת. |
| `license_status` | `string` | — | `active_license`, `in_licensing_process`, `symbol_recognized`, `municipal_verified`, `stop_order_active`. |
| `is_subsidized_symbol` | `boolean` | — | `true` למעונות/משפחתוני סמל מסובסדים בלבד; `false` לשוק הפרטי החופשי בלבד. |
| `includes_friday` | `boolean` | — | סינון מסגרות הפועלות בימי שישי. |
| `shelter_status` | `string` | — | `yes` לסינון מסגרות עם ממ"ד/מקלט תקני מדווח. |
| `q` | `string` | — | חיפוש טקסטואלי חופשי בשם המסגרת או ברחוב (משתמש ב-`pg_trgm`). |
| `sort_by` | `string` | `distance` או `name` | `distance`, `price_asc`, `price_desc`, `reports_desc`, `name`. |
| `page`, `page_size` | `int`, `int` | `1`, `50` | עימוד לטבלה (`format=list`). במצב `format=map_pins` מוחזר אינדקס הסיכות המלא ללא חיתוך עימוד (`D-38`). |
| `format` | `string` | `list` | `list` (רשימה מעומדת לטבלה הנגישה) או `map_pins` (**אינדקס סיכות ארצי רזה ודחוס `~400KB Gzipped` עם `Cache-Control: public, max-age=300`** עבור `Supercluster` ו-`Price Pills` במפה ב-`0ms` השהיה — נשלף מ-`public.daycare_year_summary` כשלא נבחר פילטר גיל, או מ-`public.daycare_price_aggregates` כשנבחר פילטר גיל — `D-38`). |

#### דוגמת תשובה (`200 OK` — `format=list`):

<div dir="ltr">

```json
{
  "meta": {
    "api_version": "1.0.0",
    "license": "ODbL-1.0",
    "total_count": 412,
    "page": 1,
    "page_size": 50,
    "city_median_price_nis": 5400,
    "attribution_he": "הנתונים הרשמיים מבוססים על 'מפת הטף'...",
    "reliance_disclaimer_he": "המידע מוצג להשוואה ראשונית בלבד..."
  },
  "items": [
    {
      "daycare_id": "a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99",
      "tafmap_id": "c49a8b12",
      "moe_symbol": "410923",
      "display_name": "מעון יום כוכב הצפון",
      "city_code": 5000,
      "city_name_he": "תל אביב - יפו",
      "neighborhood_he": "הצפון הישן",
      "full_address_public": "ארלוזורוב 42, תל אביב - יפו",
      "is_location_approximated": false,
      "location": {
        "lat": 32.08791,
        "lng": 34.77824
      },
      "age_groups_supported": ["0_1", "1_2", "2_3"],
      "primary_track": "private_full_day",
      "licensing_regime": "daycare_law_0_3",
      "license_status": "active_license",
      "is_subsidized_symbol": false,
      "has_active_stop_order": false,
      "has_official_sanction": false,
      "official_last_checked_at": "2026-11-22",
      "regulatory_context_he": "מעון זה מופיע במרשם מעונות היום המפוקחים של משרד החינוך לשנת תשפ״ז בסטטוס 'רישיון בתוקף' (סמל מסגרת: 410923, נבדק לאחרונה: 22.11.2026).",
      "price_summary_current_year": {
        "school_year": 2027,
        "school_year_label": "תשפ״ז (2026–2027)",
        "price_display_mode": "median_consensus",
        "primary_pin_price_nis": 5600,
        "pin_requires_tilde": false,
        "formatted_card_header": "₪5,600 לחודש (חציון מתוך 4 דיווחים)",
        "formatted_pin_label": "₪5,600",
        "min_price_nis": 5400,
        "max_price_nis": 5800,
        "median_price_nis": 5600,
        "reports_count": 4,
        "price_trust_tier": "tier_2_parent_consensus",
        "relative_to_city_median": "around_median"
      }
    }
  ]
}
```

</div>

---

### 3.2 פרופיל מסגרת מלא, היסטוריית שנים והשוואה יחסית — `GET /api/v1/daycares/{daycare_id}`

מחזיר את כל הנתונים הנדרשים לתצוגת כרטיס הגן המלא:
1. פרטי המסגרת, סטטוס הרישוי והאכיפה, ומקורות המידע המוצלבים (`external_sources`).
2. טבלת המחירים לפי קבוצת גיל ומתכונת שעות לשנת הלימודים הנבחרת (`price_matrix_by_age` — לפי כללי `D-31`).
3. היסטוריית מחירים רב-שנתית ושינוי באחוזים ובש"ח לאורך השנים (`price_history_yoy` — לפי `D-30`).
4. השוואת מחיר יחסית מול 3 קבוצות הייחוס (`benchmarks` — רדיוס 1 ק"מ כאשר `N >= 3`, עיר, וגנים עם פרמטרים דומים בעיר — לפי `D-30`), לצד תעריף המקסימום הממשלתי המפוקח (`regulated_benchmark`).
5. רשימת דיווחי ההורים הבודדים בתחתית הכרטיס (`individual_reports`), שבה מוצגת **שנת הלימודים בלבד** (`school_year_label`, ללא חודש דיווח פרטני וללא מזהה מדווח — `D-34`).

#### דוגמת תשובה (`200 OK`):

<div dir="ltr">

```json
{
  "meta": {
    "api_version": "1.0.0",
    "license": "ODbL-1.0",
    "attribution_he": "הנתונים הרשמיים מבוססים על 'מפת הטף'...",
    "reliance_disclaimer_he": "המידע מוצג להשוואה ראשונית בלבד..."
  },
  "daycare": {
    "daycare_id": "a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99",
    "tafmap_id": "c49a8b12",
    "moe_symbol": "410923",
    "mol_symbol": null,
    "display_name": "מעון יום כוכב הצפון",
    "official_registry_name": "מעון כוכב הצפון בע״מ",
    "operator_entity_name": "כוכב הצפון חינוך לגיל הרך בע״מ",
    "operator_corp_id": "515987654",
    "city_code": 5000,
    "city_name_he": "תל אביב - יפו",
    "neighborhood_he": "הצפון הישן",
    "full_address_public": "ארלוזורוב 42, תל אביב - יפו",
    "is_location_approximated": false,
    "location": { "lat": 32.08791, "lng": 34.77824 },
    "official_phone_public": "03-5551234",
    "official_capacity": 48,
    "licensing_regime": "daycare_law_0_3",
    "license_status": "active_license",
    "is_official_source": true,
    "is_subsidized_symbol": false,
    "trust_tier": "tier_1_official",
    "has_active_stop_order": false,
    "has_official_sanction": false,
    "official_sanction_date": null,
    "official_sanction_text": null,
    "shelter_status": "yes",
    "cameras_0_3_status": "yes",
    "official_last_checked_at": "2026-11-22",
    "regulatory_context_he": "מעון זה מופיע במרשם מעונות היום המפוקחים של משרד החינוך לשנת תשפ״ז בסטטוס 'רישיון בתוקף' (סמל מסגרת: 410923, נבדק לאחרונה: 22.11.2026).",
    "external_sources": [
      { "source_system": "tafmap", "external_record_id": "c49a8b12", "source_license": "ODbL-1.0", "last_synced_at": "2026-11-23" },
      { "source_system": "moe_getmeonot", "external_record_id": "410923", "source_license": "data.gov.il", "last_synced_at": "2026-11-22" },
      { "source_system": "tlv_gis_925", "external_record_id": "TLV-925-108", "source_license": "TLV-OpenData", "last_synced_at": "2026-11-22" }
    ]
  },
  "price_matrix_by_age": [
    {
      "school_year": 2027,
      "school_year_label": "תשפ״ז (2026–2027)",
      "age_group": "1_2",
      "age_group_label_he": "גילאי שנה עד שנתיים",
      "framework_track": "private_full_day",
      "is_full_day": true,
      "reports_count": 4,
      "price_display_mode": "median_consensus",
      "representative_price_nis": 5600,
      "min_price_nis": 5400,
      "max_price_nis": 5800,
      "median_price_nis": 5600,
      "p25_price_nis": 5500,
      "p75_price_nis": 5700,
      "price_trust_tier": "tier_2_parent_consensus",
      "last_updated_month": "2026-11"
    }
  ],
  "price_history_yoy": [
    {
      "school_year": 2025,
      "school_year_label": "תשפ״ה (2024–2025)",
      "age_group": "1_2",
      "is_full_day": true,
      "representative_price_nis": 4950,
      "reports_count": 1,
      "yoy_diff_nis": null,
      "yoy_diff_pct": null
    },
    {
      "school_year": 2026,
      "school_year_label": "תשפ״ו (2025–2026)",
      "age_group": "1_2",
      "is_full_day": true,
      "representative_price_nis": 5250,
      "reports_count": 2,
      "yoy_diff_nis": 300,
      "yoy_diff_pct": 6.1
    },
    {
      "school_year": 2027,
      "school_year_label": "תשפ״ז (2026–2027)",
      "age_group": "1_2",
      "is_full_day": true,
      "representative_price_nis": 5600,
      "reports_count": 4,
      "yoy_diff_nis": 350,
      "yoy_diff_pct": 6.7,
      "cumulative_3yr_diff_nis": 650,
      "cumulative_3yr_diff_pct": 13.1
    }
  ],
  "benchmarks": {
    "target_price_nis": 5600,
    "regulated_symbol_benchmark_nis": 2515,
    "private_vs_regulated_annual_gap_nis": 37020,
    "comparisons": [
      {
        "benchmark_scope": "radius_1km",
        "label_he": "גנים ברדיוס 1 ק״מ (הצפון הישן)",
        "sample_daycares_n": 11,
        "median_price_nis": 5750,
        "p25_price_nis": 5400,
        "p75_price_nis": 6100,
        "diff_from_median_nis": -150,
        "diff_from_median_pct": -2.6
      },
      {
        "benchmark_scope": "city_all_same_track",
        "label_he": "כלל הגנים הפרטיים בתל אביב - יפו",
        "sample_daycares_n": 218,
        "median_price_nis": 5400,
        "p25_price_nis": 4800,
        "p75_price_nis": 5900,
        "diff_from_median_nis": 200,
        "diff_from_median_pct": 3.7
      },
      {
        "benchmark_scope": "city_similar_params",
        "label_he": "גנים דומים בעיר (גילאי 1–2 · פרטי · יום מלא)",
        "sample_daycares_n": 94,
        "median_price_nis": 5500,
        "p25_price_nis": 5100,
        "p75_price_nis": 5850,
        "diff_from_median_nis": 100,
        "diff_from_median_pct": 1.8
      }
    ]
  },
  "individual_reports": [
    {
      "submission_id": "f4c129e0-1b2a-4c33-8e11-90a1b2c3d4e5",
      "school_year": 2027,
      "school_year_label": "תשפ״ז (2026–2027)",
      "source_type": "parent_google_oidc",
      "source_label_he": "דיווח הורה מאומת",
      "monthly_list_price_nis": 5600,
      "age_group": "1_2",
      "framework_track": "private_full_day",
      "hours_sun_thu_start": "07:30",
      "hours_sun_thu_end": "16:30",
      "is_full_day": true,
      "includes_friday": true,
      "hours_fri_start": "07:30",
      "hours_fri_end": "12:30",
      "includes_nutrition": true,
      "reported_size_bucket": "7_or_more",
      "reported_shelter_status": "yes",
      "reported_cameras_0_3": "yes"
    }
  ]
}
```

</div>

---

### 3.3 השלמת יישובים ורחובות מקומית (`0 ₪`) — `GET /api/v1/autocomplete/locations`

- **קלט:** `q` (טקסט חיפוש בעברית, מינימום 2 תווים), `city_code` (אופציונלי — אם סופק, משלים רחובות באותו יישוב בלבד), `limit` (ברירת מחדל `10`).
- **ביצוע:** שאילתת `pg_trgm` מהירה מול `public.cities`, `public.streets` ו-`public.street_synonyms`. **אפס קריאות החוצה ל-Nominatim או לכל ספק חיצוני!**

---

### 3.4 ייצוא לתוצאות חיפוש (`CSV` / `XLSX`) — `GET /api/v1/export`

- **קלט:** אותם פרמטרי סינון כמו `GET /api/v1/daycares` + `format=csv` (ברירת מחדל, מקודד עם **`UTF-8 BOM` `\uFEFF`** לפתיחה תקינה ב-Excel בעברית) או `format=xlsx`.
- **הגנת פרטיות בייצוא המוני:** הקובץ כולל את שדות המסגרת הרשמיים, סטטוס הפיקוח, המחיר המשוקלל (`representative_price_nis`), הטווח (`min`–`max`), מספר הדיווחים, אחוז השינוי השנתי (`yoy_diff_pct`) ודרגת האמינות — **ללא מספרי טלפון סלולריים (`05x`) וללא שמות מנהלות יחידות**. השורה הראשונה בקובץ כוללת את שורת הייחוס (`ODbL 1.0`) וכתב הוויתור (`Reliance Disclaimer`).

---

## 4. מפרט נקודות הקצה לאימות הורים (`Zero-PII`), הזנת דיווחים וביטול עיוור (`D-29`, `D-34`, `D-38`)

### 4.1 אימות חשבון Google ללא כתובת מייל — `POST /api/v1/auth/google`

1. **בקשת ה-OAuth בצד הלקוח (`Frontend`):**
   רכיב `Sign in with Google` מוגדר עם **`scope: "openid"` בלבד** (ללא `"email"` וללא `"profile"`).
2. **בדיקת השרת ב-`POST /api/v1/auth/google`:**
   - קלט: `{"id_token": "<JWT_FROM_GOOGLE>"}`.
   - השרת מאמת קריפטוגרפית את חתימת ה-JWT מול המפתחות הפומביים של גוגל (`https://www.googleapis.com/oauth2/v3/certs`), מוודא את ה-`aud` (ה-Client ID של "ילדי היקר") ואת תוקף ה-`exp`.
   - השרת שולף מה-Payload אך ורק את השדה המספרי **`sub`** (מחרוזת בת 21 ספרות, למשל `"107691503500061507151"`), ומוחק מיד מהזיכרון את ה-JWT הגולמי.
3. **הנפקת עוגיית האבטחה ההכרחית (`Strictly Necessary Cookie` — תמיכה ב-Multi-Pod ב-K8s לפי `D-38`):**
   - השרת מצפין בזיכרון באמצעות `AES-256-GCM` עם **מפתח הצפנה דטרמיניסטי הנגזר ב-RAM מתוך `SECRET_PEPPER` (`HKDF-SHA256(SECRET_PEPPER, "yh-cookie-encryption-v1")` או מפתח Vault ייעודי)** — כך שהעוגייה מפוענחת בהצלחה גם בסביבת Multi-Pod או לאחר Restart של Pod ב-`hasadna-k8s`.
   - האובייקט המוצפן `{"sub": "<21_DIGIT_SUB>", "exp": <NOW+900s>}` מוצב בעוגייה:
     `Set-Cookie: yh_auth_session=<ENCRYPTED_BLOB>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/reports; Max-Age=900`
   - **משמעות:** הדפדפן שולח את העוגייה אך ורק לנתיבי `POST /api/v1/reports` ו-`POST /api/v1/reports/withdraw` למשך 15 דקות; שום קוד JavaScript אינו יכול לקרוא אותה (`HttpOnly`), לא נשמר שום סשן במסד הנתונים, ולא קיימות עוגיות מעקב צד ג' (פטור מבאנר קוקיז לפי `D-29`).

---

### 4.2 שליחת דיווח מחיר (`Blind Upsert` רב-גילאי + `Sanity Check` היברידי) — `POST /api/v1/reports`

#### מבנה הבקשה (`Request JSON`):

<div dir="ltr">

```json
{
  "daycare_id": "a8f5c2d1-4e9b-4a12-9c81-7b3d2e1f0a99",
  "school_year": 2027,
  "monthly_list_price_nis": 5600,
  "age_group": "1_2",
  "framework_track": "private_full_day",
  "hours_sun_thu_start": "07:30",
  "hours_sun_thu_end": "16:30",
  "includes_friday": true,
  "hours_fri_start": "07:30",
  "hours_fri_end": "12:30",
  "includes_nutrition": true,
  "reported_size_bucket": "7_or_more",
  "reported_shelter_status": "yes",
  "reported_cameras_0_3": "yes",
  "replace_all_ages_for_token": true,
  "is_standard_list_price_confirmed": true,
  "confirm_outlier": false,
  "turnstile_token": "0.mJH8s9..."
}
```

</div>

#### סדר הפעולות הקשיח בשרת (`Server Pipeline` — `D-34`, `D-38`):
1. **אימות עוגיית הסשן (`yh_auth_session`) ו-`Cloudflare Turnstile`:**
   - פענוח ה-`google_sub` בזיכרון ה-RAM מתוך `yh_auth_session`. אם פג תוקף או חסר -> `401 Unauthorized`.
   - בשליחה הראשונה (`confirm_outlier === false`), שליחת ה-`turnstile_token` החד-פעמי לאימות מול `https://challenges.cloudflare.com/turnstile/v0/siteverify` (ללא שמירת IP בלוגים). אם ההורה כבר אומת ונדרש לאשר חריגת מחיר בשליחה שנייה (`confirm_outlier === true`), השרת מסתמך על עוגיית ה-`yh_auth_session` החתומה התקפה ואינו דורש `turnstile_token` שני (`D-38`).
2. **אימות חוקיות קשיח ו-`Sanity Check` היברידי (`D-34`, `D-38`):**
   - וידוא ש-`is_standard_list_price_confirmed === true` ושכל 4 צירי הנרמול מלאים.
   - וידוא קשיח ש-`monthly_list_price_nis` בטווח **`500` עד `15,000` ₪** (אחרת -> `422 Unprocessable Entity`).
   - **בדיקת חריגה של מעל `40%` ממפל חציון הייחוס (`get_sanity_check_reference_median`):** ה-Frontend מקפיץ את חלונית האישור כבר בצעד 2 (לפני ה-OAuth וה-Turnstile) ושולח `confirm_outlier: true`. אם בכל זאת הגיעה בקשה עם `confirm_outlier === false` והמחיר חורג ביותר מ-`40%` מחציון הייחוס (שלב 1: חציון העיר אם `N>=5` -> שלב 2: חציון אשכול למ"ס/מחוז אם `N>=5` -> שלב 3: חציון ארצי למסלול), השרת מחזיר `409 Conflict`:

<div dir="ltr">

```json
{
  "error_code": "OUTLIER_CONFIRMATION_REQUIRED",
  "message_he": "המחיר שהזנת (₪1,800) חורג משמעותית מחציון הייחוס למסלול זה (₪5,400). האם זהו אכן מחיר המחירון החודשי המלא (ללא סבסוד אישי או הנחה)?",
  "reference_median_nis": 5400
}
```

</div>

3. **גזירת ה-`Unlinkable Nullifier` וביצוע ה-`Blind Upsert` (`D-34`, `D-38`):**
   - השרת מחשב ב-RAM בלבד (מול המפתחות שהוזרקו מ-**Vault**):
     - `dedup_token = HMAC_SHA256(f"{google_sub}:{daycare_id}:{school_year}", SECRET_PEPPER)`
     - `quota_hash = HMAC_SHA256(f"{google_sub}:{school_year}", QUOTA_PEPPER_SEPARATE)`
     - `reported_month = current_utc_date.strftime("%Y-%m")`
   - מוחק את `google_sub` מהזיכרון וקורא ל-`SELECT app_private.submit_parent_report_blind_upsert(...)`.
4. **תשובה אחידה (`200 OK` — חסימת `Enumeration Oracle`):**
   בין אם זו רשומה חדשה לגן ובין אם היא דרסה בשקט דיווח קודם של אותו הורה לאותו גן באותה שנה, התשובה זהה ב-100%:

<div dir="ltr">

```json
{
  "status": "recorded",
  "message_he": "תודה! הדיווח נקלט במערכת ויסייע להורים נוספים."
}
```

</div>

---

### 4.3 ביטול/מחיקת דיווח שגוי על גן ספציפי (`Blind Withdraw` — `D-38`) — `POST /api/v1/reports/withdraw`

מאפשר להורה שדיווח בטעות על הגן הלא נכון למחוק את דיווחו בשירות עצמי (`סעיף 14` לחוק הגנת הפרטיות) **מבלי לחשוף אורקל קיום (`Anti-Enumeration`) ומבלי לאפס את מונה המכסה השנתי**:
- **קלט:** `{"daycare_id": "<UUID>", "school_year": 2027, "turnstile_token": "<TOKEN>"}` + עוגיית `yh_auth_session`.
- **ביצוע:** השרת גוזר ב-RAM את `dedup_token = HMAC_SHA256(f"{google_sub}:{daycare_id}:{school_year}", SECRET_PEPPER)`, מוחק את `google_sub` מהזיכרון, וקורא ל-`SELECT app_private.withdraw_parent_report_blind(daycare_id, school_year, dedup_token)`.
- **תשובה אחידה תמיד (`200 OK`):**
  `{"status": "processed", "message_he": "אם היה קיים דיווח משויך לחשבונך בגן זה לשנת הלימודים שנבחרה, הוא הוסר מהמערכת."}`

---

### 4.4 דיווח על טעות עובדתית ונוהל ההכרעה ב-`MVP1` (`"מצאתם טעות?"` — `D-38`) — `POST /api/v1/corrections`

- **קלט:** `{"daycare_id": "<UUID>", "issue_category": "wrong_price_outlier", "structured_details": {...}, "turnstile_token": "<TOKEN>"}`.
- **נוהל הטיפול והבקרה המדורגת ב-`MVP1` (`D-38`):**
  1. הפנייה נשמרת ב-`app_private.correction_requests` ושולחת התראת `Webhook` פנימית לצוות הפרויקט (3–5 מורשי הגישה), שמטפלים בפניות באמצעות כלי `CLI` ייעודי (`npm run admin:corrections`) ללא חשיפת פאנל Admin וובי ציבורי.
  2. **אין הסתרה אוטומטית (`No Auto-Hide`):** לחיצה על `"מצאתם טעות?"` אינה מסתירה דיווחים אוטומטית (למניעת מחיקת דיווחי הורים לגיטימיים ע"י בעלי עניין).
  3. **כלל ההכרעה המדורג:** בדיווח בודד שטרם אומת (`N = 1`, `tier_3_unverified_report`), אם מוצגת אסמכתא עובדתית סותרת (כגון דף מחירון רשמי של המסגרת או אישור ממ"ד עירוני), הדיווח הבודד מסומן ב-`is_flagged_hidden = TRUE`; בקונצנזוס הורים מאומת (`N >= 3`, `tier_2_parent_consensus`), דיווחי ההורים לעולם אינם מוסרים על סמך הכחשה לא-מגובה.

---

## 5. מפרט שרת ה-MCP לסוכני בינה מלאכותית (`yaldi-hayakar-mcp`)

שרת ה-MCP פועל במצב **Read-Only** בלבד (משתמש DB: `app_public_ro`), ותומך בחיבור `Streamable HTTP / SSE` (`/mcp`) ובחיבור `stdio` מקומי. כל כלי מחזיר בחתימת הפלט שלו את `trust_tier`, את `regulatory_context_he` ואת `reliance_disclaimer_he` כדי למנוע מסוכני AI (Claude, ChatGPT, Gemini) להציג דיווח הורה בודד כנתון ממשלתי או להכתים מעון בסטטוס `"בתהליך רישוי"` כבלתי-חוקי.

### טבלת 5 הכלים בשרת ה-MCP:

| שם הכלי (`Tool Name`) | תיאור והנחיית מערכת לסוכן ה-AI (`Description & Guardrails`) | פרמטרי קלט (`inputSchema`) | מה מוחזר בפלט? |
|---|---|---|---|
| **`search_daycares`** | חיפוש מעונות וגני ילדים בישראל לפי עיר, כתובת/רדיוס, גיל (`0–3`, `3–6`), מסלול (`private_full_day`, `symbol_regulated`, `municipal_tzaharon`), תקציב וסטטוס רישוי. **חובה על הסוכן:** לציין בתשובתו למשתמש את דרגת האמינות (`price_trust_tier`) ומספר הדיווחים לכל מחיר. | `city_name_he` (או `lat`,`lng`,`radius_m`), `age_group`, `framework_track`, `max_price_nis`, `is_subsidized_symbol`, `includes_friday`, `has_shelter`, `school_year` | רשימת מסגרות מתאימות + סיכום מחירים (`D-31`) + `regulatory_context_he` + חציון העיר להשוואה. |
| **`get_daycare_details`** | שליפת פרופיל מלא של מעון/גן ספציפי לפי `daycare_id` או `moe_symbol`, כולל היסטוריית מחירים רב-שנתית (`YoY`), השוואה לשכונה ולעיר, ופירוט דיווחי ההורים. | `daycare_id` (UUID) או `moe_symbol` (string) | האובייקט המלא מ-`GET /api/v1/daycares/{id}` (ללא מידע אישי). |
| **`get_area_price_stats`** | קבלת סטטיסטיקת יוקר החינוך בגיל הרך בעיר או בשכונה/רדיוס: חציון, רבעונים (`P25`/`P75`), שיעור התייקרות שנתי (`YoY`), ויחס מסגרות מפוקחות/מסובסדות מול פרטיות. | `city_name_he`, `neighborhood_he` (אופציונלי), `age_group`, `framework_track`, `school_year` | מדדי חציון, `IQR`, מספר גנים במדגם, ומגמת התייקרות רב-שנתית. |
| **`check_supervision_status`** | בדיקה רשמית האם מסגרת חינוכית מופיעה במרשמי הפיקוח של משרד החינוך (`GetMeonot` לגילאי `0–3` מרף `7+` פעוטות; `mosdot_edu` לגילאי `3–6` מרף `11+` תלמידים), משרד העבודה או ה-GIS העירוני, והאם קיים צו הפסקה או עיצום כספי רשמי. **חובה על הסוכן:** לצטט את השדה `regulatory_context_he` כלשונו ולא להמציא פרשנות משפטית עצמאית. | `daycare_name_he`, `city_name_he`, `street_name_he` (אופציונלי) | התאמות ממרשמי המדינה + `license_status` + `has_active_stop_order` + `has_official_sanction` + `regulatory_context_he` + תאריך בדיקה אחרון. |
| **`compare_regulated_vs_market_cost`** | חישוב הפער הכלכלי החודשי והשנתי (ל-12 חודשים) למשפחה בין תעריף מעון סמל מפוקח (או צהרון `ניצנים`) לבין חציון השוק הפרטי באותה עיר וקבוצת גיל. | `city_name_he`, `age_group` (`0_1`, `1_2`, `2_3`, `3_6`), `school_year` | תעריף מפוקח (`regulated_monthly_nis`), חציון שוק פרטי בעיר (`market_median_monthly_nis`), פער חודשי ופער שנתי בש"ח ובאחוזים. |

</div>
