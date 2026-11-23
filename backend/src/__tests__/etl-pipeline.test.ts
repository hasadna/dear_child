import { describe, expect, it } from 'vitest';
import {
  cleanSymbol,
  itmToWgs84,
  parseCsvRecords,
  splitStreetAndHouseNumber,
  trigramSimilarity,
} from '../etl/csv-utils.js';
import { processEtlBatchInMemory } from '../etl/run-sync.js';
import {
  parseSheetActivityHours,
  parseSheetIncludesFriday,
  parseSheetPriceNis,
} from '../etl/tlv-sheet-seed.js';

describe('Dear Child ETL Pipeline, Entity Resolution & TLV Sheet Seed (Part 4.3)', () => {
  it('parses RFC-4180 CSV with quoted multiline cells, escaped quotes, and converts ITM EPSG:2039 to WGS84', () => {
    const sampleCsv = `\uFEFFשם הגן,כתובת,פרטים נוספים
"גן ""כוכב"" הצפון","כרמיה 24 
(ליד רוטשילד)","שורה 1
שורה 2"`;

    const records = parseCsvRecords(sampleCsv);
    expect(records).toHaveLength(1);
    expect(records[0]['שם הגן']).toBe('גן "כוכב" הצפון');
    expect(splitStreetAndHouseNumber('ארלוזורוב 42, תל אביב - יפו')).toEqual({
      streetNameHe: 'ארלוזורוב',
      houseNumber: '42',
    });
    expect(cleanSymbol('46862.0')).toBe('46862');

    // ITM coordinates in Tel Aviv (Borochov 22: X=179009.88, Y=664335.05) -> ~32.07N, 34.77E
    const wgs = itmToWgs84(179009.88, 664335.05);
    expect(wgs).not.toBeNull();
    expect(wgs!.lat).toBeGreaterThan(32.05);
    expect(wgs!.lat).toBeLessThan(32.10);
    expect(wgs!.lng).toBeGreaterThan(34.76);
    expect(wgs!.lng).toBeLessThan(34.80);

    expect(trigramSimilarity('כוכב הצפון', 'כוכב הצפון')).toBe(1);
  });

  it('merges official sources across 3 tiers, filters individual IDs (D-23), and attaches official sanctions', () => {
    const moeGetMeonotCsv = `shnaT_LIMUDIM,shanA_IVRITH_ARUKA,semeL_MISGERET_IRGUNIT,sheM_MISGERET_IRGUNIT,semeL_MAON_KLKALA_MEHASAVA,owner_entity_type_inferred,semeL_BAALUT,sheM_BAALUT,teuR_STATUS_RISHUY,teuR_SHLAV_TIPUL,teuR_MIGZAR,codE_YISHUV_MISGERET,yishuV_MISGERET,codE_RECHOV_MISGERET,rechoV_MISGERET,mispaR_BAIT,kidomeT_TELEPHONE,telephonE_MAON,sheM_PRATI_MENAHEL,sheM_MISHPACHA_MENAHEL
2027,"תשפ""ז",11849,לומוס קידיס,,company,558500369,לומוס - קידס בע"מ,רישיון בתוקף,,יהודי,50005,תל אביב - יפו,904,דנין,6,050,6798027,פלונית,אלמונית
2027,"תשפ""ז",10558,גן שורש,,sole_proprietor_individual_id,034567891,אילנית פלונית,בתהליך רישוי,צו הפסקה מנהלי,יהודי,13516,מודיעין-מכבים-רעות,164,נץ החלב,1,052,8080850,פלונית,אלמונית`;

    const laborDaycaresCsv = `_id,סמל מעון,שם מעון,שנת לימוד,שנת לימוד עברי,קוד סוג מעון,תיאור סוג מעון,קוד מחוז,תיאור מחוז,תאריך פתיחה,תאריך קבלת סמל מעון,סמל ארגון,שם ארגון,ח.פ. ארגון,שם מנהל,קוד עיר,שם עיר,קוד רחוב,שם רחוב,מספר בית,מיקוד,מספר טלפון,תפוסת תינוקות,תפוסת פעוטות,תפוסת בוגרים
1,41092,אביב טי אל וי,2025,"תשפ""ה",0,מעון,4,תל אביב,2015-09-01,,772,"פ.ש.ר - העמותה לפיתוח שירותי רווחה (ע""ר)",580118032,פלונית,5000,תל אביב - יפו,1107,החשמונאים,96,0,03-9491131,34,28,36`;

    const tlvGisLayer925Csv = `"OBJECTID","id_esek","shimush","shem_rechov","ms_bayit","tr_hakama","sw_taun_rishui","shetach","x_coord","y_coord","date_import","shem_machzik_rashi","ms_mezahe_machzik_rashi"
"27","62","גני ילדים פרטיים","בורוכוב","22","1740787200000","0","156","179009.88","664335.05","29/10/2026 01:43:29","",""
"28","999","גני ילדים פרטיים","דנין","6","1740787200000","0","210","180100.00","665100.00","29/10/2026 01:43:29","לומוס - קידס בע""מ","558500369"`;

    const moeMirshamSanctionsCsv = `מס' סידורי,שם המעון המפר,שם בעלות המעון,כתובת המעון,תאריך הטלת העיצום,סכום העיצום שהוטל ₪,מהות ההפרה שבשלה הוטל העיצום
1,גן שורש,אילנית פלונית,נץ החלב 1 מודיעין-מכבים-רעות,2025-11-03 00:00:00,25000,הפעלת מעון יום בניגוד לתנאי הרישיון`;

    // TLV community sheet:
    // Row 1 ("גן אורלי", "בורוכוב 22") intersects with TLV GIS Layer 925 record id_esek=62 ("בורוכוב 22")!
    // Row 2 ("לומוס קידיס", "דנין 6") intersects with MoE GetMeonot symbol 11849 ("דנין 6")!
    // Row 3 ("גן דמיוני לא רשום", "רחוב לא קיים 999") does NOT intersect with any official record and must be skipped (D-28)!
    const tlvCommunitySheetCsv = `שם הגן,איזור בעיר,כתובת,איש קשר,חן,גן / משפחתון,גילאים,שעות הגן,שישי,מחיר ספטמבר 2024,מחיר ספטמבר 2025,מחיר ספטמבר 2026,כמות ילדים,פרטים נוספים
גן אורלי,,בורוכוב 22,אורלי,052-8419799,גן,1-3,08:00-16:00,בתשלום נפרד,,5700,5900,,טקסט חופשי שאסור לייבא
לומוס קידיס,,דנין 6,פלונית,050-6798027,גן,0-3,,כן,"5,000","5,600","5,800",20,עוד טקסט חופשי שאסור לייבא
גן דמיוני לא רשום,,רחוב לא קיים 999,משה,050-0000000,גן,1-3,07:30-16:30,כן,5000,5200,5500,15,לא מצטלב עם מאגר רשמי`;

    const { mergedDaycares, tlvSeedResult } = processEtlBatchInMemory({
      moeGetMeonotCsv,
      laborDaycaresCsv,
      tlvGisLayer925Csv,
      moeMirshamSanctionsCsv,
      tlvCommunitySheetCsv,
    });

    // Verify 4 unique official daycares (since "לומוס קידיס" at "דנין 6" in MoE and TLV GIS 925 merged into 1!)
    expect(mergedDaycares).toHaveLength(4);

    // 1. Check Lumos Kids merged MoE + TLV GIS 925
    const lumos = mergedDaycares.find((d) => d.moeSymbol === '11849');
    expect(lumos).toBeDefined();
    expect(lumos?.municipalGisId).toBe('TLV-925-999');
    expect(lumos?.operatorCorpId).toBe('558500369');
    expect(lumos?.externalSources).toHaveLength(2);

    // 2. Check Gan Shoresh: individual ID '034567891' dropped in memory, owner anonymized to 'עוסק יחיד', stop order & mirsham sanction attached!
    const shoresh = mergedDaycares.find((d) => d.moeSymbol === '10558');
    expect(shoresh).toBeDefined();
    expect(shoresh?.operatorCorpId).toBeNull();
    expect(shoresh?.operatorEntityName).toBe('עוסק יחיד');
    expect(shoresh?.hasActiveStopOrder).toBe(true);
    expect(shoresh?.licenseStatus).toBe('stop_order_active');
    expect(shoresh?.hasOfficialSanction).toBe(true);
    expect(shoresh?.officialSanctionText).toBe(
      'הפעלת מעון יום בניגוד לתנאי הרישיון'
    );

    // 3. Check Aviv TLV (Ministry of Labor subsidized daycare capacity = 34 + 28 + 36 = 98)
    const aviv = mergedDaycares.find((d) => d.molSymbol === '41092');
    expect(aviv).toBeDefined();
    expect(aviv?.isSubsidizedSymbol).toBe(true);
    expect(aviv?.officialCapacity).toBe(98);

    // 4. Check TLV Community Sheet Intersection (D-28, D-30, D-38):
    // Only 2 daycares matched (Gan Orly -> 2 years 2026,2027; Lumos -> 3 years 2025,2026,2027 = 5 total rows), and 1 unmatched row was skipped!
    expect(tlvSeedResult.matchedDaycaresCount).toBe(2);
    expect(tlvSeedResult.skippedUnmatchedRowsCount).toBe(1);
    expect(tlvSeedResult.matchedSubmissions).toHaveLength(5);

    // Check D-38 transparency rule: Lumos had empty hours in sheet -> hoursSunThuStart & hoursSunThuEnd are NULL (not invented!)
    const lumos2027 = tlvSeedResult.matchedSubmissions.find(
      (s) => s.targetDaycare.moeSymbol === '11849' && s.schoolYear === 2027
    );
    expect(lumos2027?.monthlyListPriceNis).toBe(5800);
    expect(lumos2027?.hoursSunThuStart).toBeNull();
    expect(lumos2027?.hoursSunThuEnd).toBeNull();
    expect(lumos2027?.includesFriday).toBe(true);
    expect(lumos2027?.includesNutrition).toBeNull();

    // Check Gan Orly hours ('08:00-16:00') & Friday ('בתשלום נפרד' -> false)
    const orly2027 = tlvSeedResult.matchedSubmissions.find(
      (s) =>
        s.targetDaycare.municipalGisId === 'TLV-925-62' && s.schoolYear === 2027
    );
    expect(orly2027?.monthlyListPriceNis).toBe(5900);
    expect(orly2027?.hoursSunThuStart).toBe('08:00');
    expect(orly2027?.hoursSunThuEnd).toBe('16:00');
    expect(orly2027?.includesFriday).toBe(false);
  });

  it('validates helper functions for TLV sheet prices, hours, and Friday flags', () => {
    expect(parseSheetPriceNis('"5,800"')).toBe(5800);
    expect(parseSheetPriceNis('כנראה 6000')).toBeNull();
    expect(parseSheetPriceNis('200')).toBeNull();
    expect(parseSheetActivityHours('7:45-16:30')).toEqual({
      start: '07:45',
      end: '16:30',
    });
    expect(parseSheetActivityHours('')).toEqual({ start: null, end: null });
    expect(parseSheetIncludesFriday('בתוספת של 500 ₪')).toBe(false);
    expect(parseSheetIncludesFriday('שישי לסירוגין')).toBe(true);
    expect(parseSheetIncludesFriday('')).toBeNull();
  });
});
