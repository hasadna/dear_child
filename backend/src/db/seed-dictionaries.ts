import pg from 'pg';
import { loadConfig } from '../config/env.js';

/**
 * נרמול שם יישוב לחיפוש pg_trgm ולהתאמת רשומות ממשלתיות (D-25, D-26)
 */
export function normalizeCityName(rawName: string): string {
  return rawName
    .replace(/["'״׳()]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * נרמול שם רחוב להשלמה אוטומטית מקומית (0 ₪) ולהצלבת כתובות
 */
export function normalizeStreetName(rawName: string): string {
  return rawName
    .replace(/^(רחוב|רח'|רח׳|שדרות|שד'|שד׳|דרך|סמטת|סמ'|כיכר)\s+/g, '')
    .replace(/["'״׳()]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RegulatedBenchmarkSeed {
  schoolYear: number;
  schoolYearLabel: string;
  frameworkTrack: 'symbol_regulated' | 'municipal_tzaharon';
  ageGroup: '0_1' | '1_2' | '2_3' | '3_6';
  socioClusterMin: number;
  socioClusterMax: number;
  monthlyMaxPriceNis: number;
  officialOrderRef: string;
  sourceUrl: string;
}

/**
 * תעריפי המקסימום המפוקחים הרשמיים במעונות סמל ובצהרוני ניצנים (D-12, D-30)
 */
export const BASELINE_REGULATED_BENCHMARKS: RegulatedBenchmarkSeed[] = [
  // תשפ"ה (2025) — מעונות סמל
  {
    schoolYear: 2025,
    schoolYearLabel: 'תשפ"ה (2024–2025)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '0_1',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 3182,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ה',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2025,
    schoolYearLabel: 'תשפ"ה (2024–2025)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '1_2',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 2388,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ה',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2025,
    schoolYearLabel: 'תשפ"ה (2024–2025)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '2_3',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 2388,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ה',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  // תשפ"ו (2026) — מעונות סמל
  {
    schoolYear: 2026,
    schoolYearLabel: 'תשפ"ו (2025–2026)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '0_1',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 3290,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ו',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2026,
    schoolYearLabel: 'תשפ"ו (2025–2026)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '1_2',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 2465,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ו',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2026,
    schoolYearLabel: 'תשפ"ו (2025–2026)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '2_3',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 2465,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ו',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  // תשפ"ז (2027) — מעונות סמל וצהרוני ניצנים
  {
    schoolYear: 2027,
    schoolYearLabel: 'תשפ"ז (2026–2027)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '0_1',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 3355,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ז',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2027,
    schoolYearLabel: 'תשפ"ז (2026–2027)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '1_2',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 2515,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ז',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2027,
    schoolYearLabel: 'תשפ"ז (2026–2027)',
    frameworkTrack: 'symbol_regulated',
    ageGroup: '2_3',
    socioClusterMin: 1,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 2515,
    officialOrderRef: 'צו פיקוח על מחירי מצרכים ושירותים (שכר לימוד במעונות יום), תשפ"ז',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_labor',
  },
  {
    schoolYear: 2027,
    schoolYearLabel: 'תשפ"ז (2026–2027)',
    frameworkTrack: 'municipal_tzaharon',
    ageGroup: '3_6',
    socioClusterMin: 1,
    socioClusterMax: 3,
    monthlyMaxPriceNis: 650,
    officialOrderRef: 'מתווה ניצנים לצהרונים בגני ילדים (אשכולות 1–3), משרד החינוך תשפ"ז',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_education',
  },
  {
    schoolYear: 2027,
    schoolYearLabel: 'תשפ"ז (2026–2027)',
    frameworkTrack: 'municipal_tzaharon',
    ageGroup: '3_6',
    socioClusterMin: 4,
    socioClusterMax: 5,
    monthlyMaxPriceNis: 850,
    officialOrderRef: 'מתווה ניצנים לצהרונים בגני ילדים (אשכולות 4–5), משרד החינוך תשפ"ז',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_education',
  },
  {
    schoolYear: 2027,
    schoolYearLabel: 'תשפ"ז (2026–2027)',
    frameworkTrack: 'municipal_tzaharon',
    ageGroup: '3_6',
    socioClusterMin: 6,
    socioClusterMax: 10,
    monthlyMaxPriceNis: 1050,
    officialOrderRef: 'מתווה ניצנים לצהרונים בגני ילדים (אשכולות 6–10), משרד החינוך תשפ"ז',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_education',
  },
];

export interface CitySeedRecord {
  cityCode: number;
  cityNameHe: string;
  workspaceSlug?: string;
  districtHe: string;
  socioEconomicCluster: number;
  lat: number;
  lng: number;
}

/**
 * מילון בסיס של ערי ישראל המרכזיות (למ"ס) לאתחול מיידי (ומתעדכן במלואו מול data.gov.il)
 */
export const BASELINE_ISRAEL_CITIES: CitySeedRecord[] = [
  { cityCode: 5000, cityNameHe: 'תל אביב - יפו', workspaceSlug: 'tlv', districtHe: 'תל אביב', socioEconomicCluster: 8, lat: 32.0853, lng: 34.7818 },
  { cityCode: 3000, cityNameHe: 'ירושלים', workspaceSlug: 'jerusalem', districtHe: 'ירושלים', socioEconomicCluster: 2, lat: 31.7683, lng: 35.2137 },
  { cityCode: 4000, cityNameHe: 'חיפה', workspaceSlug: 'haifa', districtHe: 'חיפה', socioEconomicCluster: 7, lat: 32.7940, lng: 34.9896 },
  { cityCode: 8300, cityNameHe: 'ראשון לציון', workspaceSlug: 'rishon', districtHe: 'המרכז', socioEconomicCluster: 7, lat: 31.9730, lng: 34.7925 },
  { cityCode: 7900, cityNameHe: 'פתח תקווה', workspaceSlug: 'petah-tikva', districtHe: 'המרכז', socioEconomicCluster: 7, lat: 32.0840, lng: 34.8878 },
  { cityCode: 7400, cityNameHe: 'נתניה', workspaceSlug: 'netanya', districtHe: 'המרכז', socioEconomicCluster: 6, lat: 32.3215, lng: 34.8532 },
  { cityCode: 9000, cityNameHe: 'באר שבע', workspaceSlug: 'beer-sheva', districtHe: 'הדרום', socioEconomicCluster: 5, lat: 31.2530, lng: 34.7915 },
  { cityCode: 6100, cityNameHe: 'בני ברק', workspaceSlug: 'bnei-brak', districtHe: 'תל אביב', socioEconomicCluster: 2, lat: 32.0836, lng: 34.8328 },
  { cityCode: 6600, cityNameHe: 'חולון', workspaceSlug: 'holon', districtHe: 'תל אביב', socioEconomicCluster: 7, lat: 32.0158, lng: 34.7874 },
  { cityCode: 8600, cityNameHe: 'רמת גן', workspaceSlug: 'ramat-gan', districtHe: 'תל אביב', socioEconomicCluster: 8, lat: 32.0684, lng: 34.8248 },
  { cityCode: 70, cityNameHe: 'אשדוד', workspaceSlug: 'ashdod', districtHe: 'הדרום', socioEconomicCluster: 5, lat: 31.8044, lng: 34.6553 },
  { cityCode: 8400, cityNameHe: 'רחובות', workspaceSlug: 'rkhobot', districtHe: 'המרכז', socioEconomicCluster: 7, lat: 31.8928, lng: 34.8113 },
  { cityCode: 7100, cityNameHe: 'אשקלון', workspaceSlug: 'ashkelon', districtHe: 'הדרום', socioEconomicCluster: 5, lat: 31.6688, lng: 34.5743 },
  { cityCode: 2610, cityNameHe: 'בית שמש', workspaceSlug: 'beit-shemesh', districtHe: 'ירושלים', socioEconomicCluster: 2, lat: 31.7470, lng: 34.9881 },
  { cityCode: 6900, cityNameHe: 'כפר סבא', workspaceSlug: 'kfar-saba', districtHe: 'המרכז', socioEconomicCluster: 8, lat: 32.1780, lng: 34.9065 },
  { cityCode: 6400, cityNameHe: 'הרצליה', workspaceSlug: 'herzliya', districtHe: 'תל אביב', socioEconomicCluster: 8, lat: 32.1624, lng: 34.8447 },
  { cityCode: 1200, cityNameHe: 'מודיעין-מכבים-רעות', workspaceSlug: 'modiin', districtHe: 'המרכז', socioEconomicCluster: 8, lat: 31.8969, lng: 35.0189 },
  { cityCode: 8700, cityNameHe: 'רעננה', workspaceSlug: 'raanana', districtHe: 'המרכז', socioEconomicCluster: 8, lat: 32.1848, lng: 34.8713 },
  { cityCode: 6300, cityNameHe: 'גבעתיים', workspaceSlug: 'givatayim', districtHe: 'תל אביב', socioEconomicCluster: 9, lat: 32.0717, lng: 34.8124 },
  { cityCode: 6500, cityNameHe: 'חדרה', workspaceSlug: 'hadera', districtHe: 'חיפה', socioEconomicCluster: 6, lat: 32.4340, lng: 34.9197 },
  { cityCode: 7000, cityNameHe: 'לוד', workspaceSlug: 'lod', districtHe: 'המרכז', socioEconomicCluster: 4, lat: 31.9510, lng: 34.8881 },
  { cityCode: 8500, cityNameHe: 'רמלה', workspaceSlug: 'ramla', districtHe: 'המרכז', socioEconomicCluster: 4, lat: 31.9292, lng: 34.8656 },
  { cityCode: 9700, cityNameHe: 'הוד השרון', workspaceSlug: 'hod-hasharon', districtHe: 'המרכז', socioEconomicCluster: 8, lat: 32.1524, lng: 34.8933 },
  { cityCode: 2640, cityNameHe: 'ראש העין', workspaceSlug: 'rosh-haayin', districtHe: 'המרכז', socioEconomicCluster: 7, lat: 32.0958, lng: 34.9566 },
  { cityCode: 7300, cityNameHe: 'נצרת', workspaceSlug: 'nazareth', districtHe: 'הצפון', socioEconomicCluster: 3, lat: 32.6996, lng: 35.3035 },
  { cityCode: 7700, cityNameHe: 'עפולה', workspaceSlug: 'afula', districtHe: 'הצפון', socioEconomicCluster: 5, lat: 32.6078, lng: 35.2897 },
  { cityCode: 2600, cityNameHe: 'אילת', workspaceSlug: 'eilat', districtHe: 'הדרום', socioEconomicCluster: 6, lat: 29.5577, lng: 34.9519 },
];

export async function seedBaselineDictionaries(
  client: pg.PoolClient
): Promise<{ citiesInserted: number; benchmarksInserted: number }> {
  let citiesInserted = 0;
  let benchmarksInserted = 0;

  for (const city of BASELINE_ISRAEL_CITIES) {
    const norm = normalizeCityName(city.cityNameHe);
    const res = await client.query(
      `
      INSERT INTO public.cities (
        city_code, city_name_he, city_name_norm, workspace_slug,
        district_he, socio_economic_cluster, geom_centroid
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        ST_SetSRID(ST_MakePoint($7, $8), 4326)
      )
      ON CONFLICT (city_code) DO UPDATE SET
        city_name_he = EXCLUDED.city_name_he,
        city_name_norm = EXCLUDED.city_name_norm,
        workspace_slug = COALESCE(EXCLUDED.workspace_slug, public.cities.workspace_slug),
        district_he = COALESCE(EXCLUDED.district_he, public.cities.district_he),
        socio_economic_cluster = COALESCE(EXCLUDED.socio_economic_cluster, public.cities.socio_economic_cluster),
        geom_centroid = COALESCE(EXCLUDED.geom_centroid, public.cities.geom_centroid),
        updated_at = CURRENT_DATE
      `,
      [
        city.cityCode,
        city.cityNameHe,
        norm,
        city.workspaceSlug || null,
        city.districtHe,
        city.socioEconomicCluster,
        city.lng,
        city.lat,
      ]
    );
    citiesInserted += res.rowCount || 0;
  }

  for (const b of BASELINE_REGULATED_BENCHMARKS) {
    const res = await client.query(
      `
      INSERT INTO public.regulated_tuition_benchmarks (
        school_year, school_year_label, framework_track, age_group,
        socio_cluster_min, socio_cluster_max, monthly_max_price_nis,
        official_order_ref, source_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (school_year, framework_track, age_group, socio_cluster_min, socio_cluster_max)
      DO UPDATE SET
        monthly_max_price_nis = EXCLUDED.monthly_max_price_nis,
        official_order_ref = EXCLUDED.official_order_ref,
        source_url = EXCLUDED.source_url
      `,
      [
        b.schoolYear,
        b.schoolYearLabel,
        b.frameworkTrack,
        b.ageGroup,
        b.socioClusterMin,
        b.socioClusterMax,
        b.monthlyMaxPriceNis,
        b.officialOrderRef,
        b.sourceUrl,
      ]
    );
    benchmarksInserted += res.rowCount || 0;
  }

  return { citiesInserted, benchmarksInserted };
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-dictionaries.js') ||
    process.argv[1].endsWith('seed-dictionaries.ts'))
) {
  const config = loadConfig();
  const pool = new pg.Pool({ connectionString: config.databaseEtlUrl });
  pool
    .connect()
    .then(async (client) => {
      try {
        const res = await seedBaselineDictionaries(client);
        console.log(
          `[DB Seed] Seeded ${res.citiesInserted} cities and ${res.benchmarksInserted} regulated tuition benchmarks.`
        );
      } finally {
        client.release();
        await pool.end();
      }
    })
    .catch((err) => {
      console.error('[DB Seed] Failed:', err);
      process.exit(1);
    });
}
