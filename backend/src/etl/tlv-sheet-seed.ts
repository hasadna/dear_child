import pg from 'pg';
import { normalizeStreetName } from '../db/seed-dictionaries.js';
import {
  parseCsvRecords,
  splitStreetAndHouseNumber,
  trigramSimilarity,
} from './csv-utils.js';
import { MergedOfficialDaycare } from './entity-resolution-engine.js';
import {
  DaycareAgeGroup,
  normalizeDaycareName,
} from './facilities-resolver.js';

export interface TlvSeedSubmissionRecord {
  matchedDaycareDisplayName: string;
  matchedDaycareAddress: string;
  schoolYear: 2025 | 2026 | 2027;
  reportedMonth: string;
  monthlyListPriceNis: number;
  ageGroup: DaycareAgeGroup;
  hoursSunThuStart: string | null;
  hoursSunThuEnd: string | null;
  includesFriday: boolean | null;
  includesNutrition: null;
  reportedSizeBucket: 'up_to_6' | '7_or_more' | 'unknown';
}

/**
 * חילוץ מחיר חודשי תקני בש"ח מתוך תא בגיליון ת"א (מסנן טקסטים לא-וודאיים ומאמת טווח 500–15,000 ₪)
 */
export function parseSheetPriceNis(rawCell: string | undefined): number | null {
  if (!rawCell) return null;
  const trimmed = rawCell.trim();
  if (!trimmed || trimmed.includes('כנראה') || trimmed.includes('?')) {
    return null;
  }
  const digitsOnly = trimmed.replace(/[,₪\s"']/g, '');
  if (!/^\d{3,5}$/.test(digitsOnly)) return null;
  const price = Number(digitsOnly);
  if (price < 500 || price > 15000) return null;
  return price;
}

/**
 * חילוץ שעות פתיחה וסיום בימי א'-ה' (למשל '07:45-16:30' -> {start: '07:45', end: '16:30'}).
 * אם השדה חסר בגיליון — מחזיר null (אמת ושקיפות בדאטה לפי D-38, ללא המצאת ברירת מחדל!).
 */
export function parseSheetActivityHours(rawHours: string | undefined): {
  start: string | null;
  end: string | null;
} {
  if (!rawHours) return { start: null, end: null };
  const match = rawHours
    .trim()
    .match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (!match) return { start: null, end: null };

  const padTime = (t: string) => (t.length === 4 ? `0${t}` : t);
  return {
    start: padTime(match[1]),
    end: padTime(match[2]),
  };
}

/**
 * חילוץ האם המחיר כולל ימי שישי מתוך עמודת 'שישי' בגיליון ת"א (D-38: מחזיר null אם לא צוין)
 */
export function parseSheetIncludesFriday(
  rawFriday: string | undefined
): boolean | null {
  if (!rawFriday) return null;
  const text = rawFriday.trim();
  if (!text) return null;
  if (
    text === 'לא' ||
    text.includes('תוספת') ||
    text.includes('בתשלום נפרד')
  ) {
    return false;
  }
  if (text === 'כן' || text.includes('שישי לסירוגין') || text.includes('שישי אחרון')) {
    return true;
  }
  return null;
}

/**
 * אלגוריתם הייבוא של פיילוט גיליון ההורים של תל אביב (2024–2026 — D-28 אפשרות ב', D-30, D-38):
 * 1. מתעלם לחלוטין מעמודות 'איש קשר', 'חן' (טלפון), ו-'פרטים נוספים' (טקסט חופשי).
 * 2. מצליב אך ורק מול מסגרות רשמיות בתל אביב (cityCode = 5000, is_official_source = TRUE).
 * 3. מדלג על כל שורה שאינה מצטלבת בוודאות גבוהה עם מסגרת רשמית.
 * 4. מייצר רשומות היסטוריה רב-שנתית (2024->תשפ"ה 2025, 2025->תשפ"ו 2026, 2026->תשפ"ז 2027) עם NULL בשדות נרמול שלא צוינו במקור.
 */
export function matchAndBuildTlvCommunitySheetSeed(
  csvText: string,
  officialDaycares: MergedOfficialDaycare[]
): {
  matchedSubmissions: (TlvSeedSubmissionRecord & {
    targetDaycare: MergedOfficialDaycare;
  })[];
  matchedDaycaresCount: number;
  skippedUnmatchedRowsCount: number;
} {
  const rows = parseCsvRecords(csvText);
  const tlvOfficials = officialDaycares.filter((d) => d.cityCode === 5000);

  const matchedSubmissions: (TlvSeedSubmissionRecord & {
    targetDaycare: MergedOfficialDaycare;
  })[] = [];
  let matchedDaycaresCount = 0;
  let skippedUnmatchedRowsCount = 0;

  for (const row of rows) {
    // חוק ברזל D-23: קוראים אך ורק שדות עובדתיים מובנים (מתעלמים מ-'איש קשר', 'חן', 'פרטים נוספים')
    const rawName = (row['שם הגן'] || '').trim();
    const rawAddress = (row['כתובת'] || '').replace(/\r?\n/g, ' ').trim();
    if (!rawName && !rawAddress) {
      continue;
    }

    const sheetNormName = rawName ? normalizeDaycareName(rawName) : '';
    const primaryAddressVariant = rawAddress.split('/')[0].trim();
    const { streetNameHe: rawStreet, houseNumber } =
      splitStreetAndHouseNumber(primaryAddressVariant);
    const sheetNormStreet = rawStreet ? normalizeStreetName(rawStreet) : null;

    let matchedOfficial: MergedOfficialDaycare | undefined;

    for (const official of tlvOfficials) {
      const sameStreet =
        Boolean(sheetNormStreet) &&
        Boolean(official.streetNameHe) &&
        official.streetNameHe === sheetNormStreet;
      const sameHouse =
        Boolean(houseNumber) &&
        Boolean(official.houseNumberPublic) &&
        official.houseNumberPublic === houseNumber;

      const nameSim =
        sheetNormName && official.normalizedName
          ? trigramSimilarity(sheetNormName, official.normalizedName)
          : 0;

      // כלל הצלבה א': התאמת רחוב ומספר בית מדויקת + דמיון שם >= 0.45 (או התאמת כתובת מדויקת מול רשומת GIS עירונית רשמית בשכבה 925)
      if (
        sameStreet &&
        sameHouse &&
        (nameSim >= 0.45 ||
          official.primaryOfficialSource === 'tlv_gis_925' ||
          !sheetNormName)
      ) {
        matchedOfficial = official;
        break;
      }

      // כלל הצלבה ב': התאמת שם חזקה (>= 0.80) באותו רחוב או בעיר
      if (nameSim >= 0.8 && (!sheetNormStreet || sameStreet)) {
        matchedOfficial = official;
        break;
      }
    }

    // D-28: שורה שאינה מצטלבת עם מסגרת רשמית מדולגת ואינה מיובאת ב-MVP1!
    if (!matchedOfficial) {
      skippedUnmatchedRowsCount++;
      continue;
    }

    const hours = parseSheetActivityHours(row['שעות הגן']);
    const includesFriday = parseSheetIncludesFriday(row['שישי']);

    const rawCount = (row['כמות ילדים'] || '').trim();
    let reportedSizeBucket: 'up_to_6' | '7_or_more' | 'unknown' = 'unknown';
    if (rawCount === '5-6' || rawCount === '6') {
      reportedSizeBucket = 'up_to_6';
    } else if (/^\d+$/.test(rawCount) && Number(rawCount) >= 7) {
      reportedSizeBucket = '7_or_more';
    }

    const yearColumns: {
      colName: string;
      schoolYear: 2025 | 2026 | 2027;
      reportedMonth: string;
    }[] = [
      {
        colName: 'מחיר ספטמבר 2024',
        schoolYear: 2025,
        reportedMonth: '2024-09',
      },
      {
        colName: 'מחיר ספטמבר 2025',
        schoolYear: 2026,
        reportedMonth: '2025-09',
      },
      {
        colName: 'מחיר ספטמבר 2026',
        schoolYear: 2027,
        reportedMonth: '2026-09',
      },
    ];

    let addedAnyYearForRow = false;
    for (const yc of yearColumns) {
      const price = parseSheetPriceNis(row[yc.colName]);
      if (price !== null) {
        matchedSubmissions.push({
          targetDaycare: matchedOfficial,
          matchedDaycareDisplayName: matchedOfficial.displayName,
          matchedDaycareAddress: matchedOfficial.fullAddressPublic,
          schoolYear: yc.schoolYear,
          reportedMonth: yc.reportedMonth,
          monthlyListPriceNis: price,
          ageGroup: '0_3',
          hoursSunThuStart: hours.start,
          hoursSunThuEnd: hours.end,
          includesFriday,
          includesNutrition: null,
          reportedSizeBucket,
        });
        addedAnyYearForRow = true;
      }
    }

    if (addedAnyYearForRow) {
      matchedDaycaresCount++;
    } else {
      skippedUnmatchedRowsCount++;
    }
  }

  return {
    matchedSubmissions,
    matchedDaycaresCount,
    skippedUnmatchedRowsCount,
  };
}

/**
 * שמירת רשומות ה-Seed שהוצלבו מגיליון ת"א אל טבלת app_private.survey_submissions (עם dedup_token = NULL ו-source_type = 'community_sheet_tlv_seed')
 */
export async function insertTlvSeedSubmissionsToDb(
  client: pg.PoolClient,
  submissions: (TlvSeedSubmissionRecord & {
    targetDaycare: MergedOfficialDaycare;
  })[]
): Promise<number> {
  let inserted = 0;

  for (const s of submissions) {
    const daycareId = s.targetDaycare.daycareId;
    if (!daycareId) continue;

    // מניעת כפילות בריצה חוזרת של ה-Seed לאותו גן ושנת לימודים
    const existsRes = await client.query(
      `
      SELECT 1 FROM app_private.survey_submissions
      WHERE daycare_id = $1
        AND school_year = $2
        AND source_type = 'community_sheet_tlv_seed'
      LIMIT 1
      `,
      [daycareId, s.schoolYear]
    );
    if (existsRes.rows.length > 0) continue;

    await client.query(
      `
      INSERT INTO app_private.survey_submissions (
        daycare_id, school_year, dedup_token, source_type, reported_month,
        monthly_list_price_nis, age_group, framework_track,
        hours_sun_thu_start, hours_sun_thu_end,
        includes_friday, hours_fri_start, hours_fri_end, includes_nutrition,
        reported_size_bucket, reported_shelter_status, reported_cameras_0_3,
        is_standard_list_price_confirmed, is_outlier_confirmed_by_user
      ) VALUES (
        $1, $2, NULL, 'community_sheet_tlv_seed', $3,
        $4, $5::public.age_group_enum, 'private_full_day',
        $6::TIME, $7::TIME,
        $8, NULL, NULL, NULL,
        $9::public.size_bucket_enum, 'unknown', 'unknown',
        TRUE, FALSE
      )
      `,
      [
        daycareId,
        s.schoolYear,
        s.reportedMonth,
        s.monthlyListPriceNis,
        s.ageGroup,
        s.hoursSunThuStart,
        s.hoursSunThuEnd,
        s.includesFriday,
        s.reportedSizeBucket,
      ]
    );
    inserted++;
  }

  return inserted;
}
