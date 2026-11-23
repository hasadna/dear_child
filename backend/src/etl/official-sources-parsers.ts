import {
  BASELINE_ISRAEL_CITIES,
  normalizeCityName,
  normalizeStreetName,
} from '../db/seed-dictionaries.js';
import {
  sanitizeMoEOperatorCorpId,
  sanitizeOperatorEntityName,
} from '../security/nullifiers.js';
import {
  cleanSymbol,
  itmToWgs84,
  splitStreetAndHouseNumber,
} from './csv-utils.js';
import {
  DaycareAgeGroup,
  DaycareLicenseStatus,
  normalizeDaycareName,
} from './facilities-resolver.js';

export type FrameworkTrack =
  | 'private_full_day'
  | 'private_half_day'
  | 'symbol_regulated'
  | 'municipal_tzaharon'
  | 'rehab_or_welfare';

export type LicensingRegime =
  | 'daycare_law_0_3'
  | 'schools_law_3_6'
  | 'municipal_public'
  | 'exempt_small_home';

export interface ExternalSourceProvenance {
  sourceSystem:
    | 'facilities_datapackage'
    | 'obudget'
    | 'moe_getmeonot'
    | 'moe_mosdot'
    | 'moe_mirsham_sanctions'
    | 'mol_daycare'
    | 'welfare'
    | 'tlv_gis_925';
  externalRecordId: string;
  sourceLicense: 'ODbL-1.0' | 'CC-BY-SA-4.0' | 'data.gov.il' | 'TLV-OpenData';
  rawStatusText?: string;
}

export interface CanonicalDaycareCandidate {
  externalFacilityId?: string | null;
  obudgetFacilityId?: string | null;
  moeSymbol?: string | null;
  molSymbol?: string | null;
  welfareSymbol?: string | null;
  municipalGisId?: string | null;

  displayName: string;
  officialRegistryName?: string | null;
  normalizedName: string;

  ageGroupsSupported: DaycareAgeGroup[];
  primaryTrack: FrameworkTrack;
  licensingRegime: LicensingRegime;

  cityCode: number;
  cityNameHe: string;
  neighborhoodHe?: string | null;
  streetNameHe?: string | null;
  houseNumberPublic?: string | null;
  fullAddressPublic: string;
  lat: number;
  lng: number;

  operatorEntityName?: string | null;
  operatorCorpId?: string | null;
  officialPhonePublic?: string | null;
  officialCapacity?: number | null;

  licenseStatus: DaycareLicenseStatus;
  isSubsidizedSymbol: boolean;
  hasActiveStopOrder: boolean;
  hasOfficialSanction: boolean;
  officialSanctionDate?: string | null;
  officialSanctionText?: string | null;

  primaryOfficialSource: string;
  provenance: ExternalSourceProvenance;
}

const CITY_LOOKUP_BY_NORM = new Map<
  string,
  { cityCode: number; cityNameHe: string; lat: number; lng: number }
>();
const CITY_LOOKUP_BY_CODE = new Map<
  number,
  { cityCode: number; cityNameHe: string; lat: number; lng: number }
>();

for (const c of BASELINE_ISRAEL_CITIES) {
  CITY_LOOKUP_BY_NORM.set(normalizeCityName(c.cityNameHe), c);
  CITY_LOOKUP_BY_CODE.set(c.cityCode, c);
}

/**
 * זיהוי סמל יישוב למ"ס מתוך קוד או שם יישוב (תומך גם בקודי משרד החינוך בני 5 ספרות עם ספרת ביקורת כגון 50005 -> 5000)
 */
export function resolveCityCodeAndName(
  rawCode?: string | number | null,
  rawCityName?: string | null
): { cityCode: number; cityNameHe: string; defaultLat: number; defaultLng: number } | null {
  if (rawCityName) {
    const norm = normalizeCityName(rawCityName);
    const byName = CITY_LOOKUP_BY_NORM.get(norm);
    if (byName) {
      return {
        cityCode: byName.cityCode,
        cityNameHe: byName.cityNameHe,
        defaultLat: byName.lat,
        defaultLng: byName.lng,
      };
    }
  }

  if (rawCode !== null && rawCode !== undefined && String(rawCode).trim() !== '') {
    const num = Number(String(rawCode).trim());
    if (Number.isInteger(num) && num > 0) {
      const direct = CITY_LOOKUP_BY_CODE.get(num);
      if (direct) {
        return {
          cityCode: direct.cityCode,
          cityNameHe: direct.cityNameHe,
          defaultLat: direct.lat,
          defaultLng: direct.lng,
        };
      }
      // בקובץ GetMeonot קוד היישוב כולל לעיתים ספרת ביקורת אחרונה (למשל 50005 עבור ת"א 5000, 87007 עבור רעננה 8700)
      const withoutCheckDigit = Math.floor(num / 10);
      const byTruncated = CITY_LOOKUP_BY_CODE.get(withoutCheckDigit);
      if (byTruncated) {
        return {
          cityCode: byTruncated.cityCode,
          cityNameHe: byTruncated.cityNameHe,
          defaultLat: byTruncated.lat,
          defaultLng: byTruncated.lng,
        };
      }
    }
  }

  return null;
}

/**
 * 1. פענוח שורה מקובץ המסגרות הארצי המעובד (facilities.csv / obudget — D-36)
 * מתעלם לחלוטין מעמודות manager_name (Zero-PII).
 */
export function parseProcessedFacilitiesCsvRow(
  row: Record<string, string>
): CanonicalDaycareCandidate | null {
  const facilityKind = (
    row.resolved_facility_kind ||
    row.info_facility_kind ||
    ''
  ).trim();
  if (facilityKind && facilityKind !== 'education') {
    return null;
  }

  const cityInfo = resolveCityCodeAndName(
    row.official_moh_city_code,
    row.workspace_city ||
      row.info_city ||
      row.official_moe_city ||
      row.official_mol_city
  );
  if (!cityInfo) return null;

  const lat = Number(row.resolved_lat || row.info_lat || 0) || cityInfo.defaultLat;
  const lng = Number(row.resolved_lng || row.info_lng || 0) || cityInfo.defaultLng;

  const displayName = (
    row.resolved_name ||
    row.official_moe_name ||
    row.official_mol_name ||
    row.official_welfare_name ||
    ''
  ).trim();
  if (!displayName) return null;

  const moeSymbol =
    cleanSymbol(row.official_moe_symbol) ||
    (row.resolved_source === 'moe' ? cleanSymbol(row.resolved_symbol) : null);
  const molSymbol =
    cleanSymbol(row.official_mol_symbol) ||
    cleanSymbol(row.official_moe_mol_symbol) ||
    (row.resolved_source === 'mol' || row.resolved_source === 'labor'
      ? cleanSymbol(row.resolved_symbol)
      : null);
  const welfareSymbol =
    cleanSymbol(row.official_welfare_symbol) ||
    (row.resolved_source === 'welfare' ? cleanSymbol(row.resolved_symbol) : null);

  const isSubsidized =
    row.resolved_subsidized?.toLowerCase() === 'true' || Boolean(molSymbol);

  const rawLicense = (
    row.resolved_license_status ||
    row.official_moe_license_status ||
    ''
  ).trim();
  let licenseStatus: DaycareLicenseStatus = 'municipal_verified';
  if (rawLicense === 'רישיון בתוקף') {
    licenseStatus = isSubsidized ? 'symbol_recognized' : 'active_license';
  } else if (rawLicense === 'בתהליך רישוי') {
    licenseStatus = 'in_licensing_process';
  } else if (isSubsidized) {
    licenseStatus = 'symbol_recognized';
  }

  const fullAddress =
    (
      row.resolved_formatted_address ||
      row.resolved_address ||
      row.info_formatted_address ||
      row.official_moe_address ||
      row.official_mol_address ||
      cityInfo.cityNameHe
    ).trim();
  const { streetNameHe, houseNumber } = splitStreetAndHouseNumber(fullAddress);

  const babiesCap = Number(row.official_mol_total_places_babies || 0);
  const toddlersCap = Number(row.official_mol_total_places_toddlers || 0);
  const adultsCap = Number(row.official_mol_total_places_adults || 0);
  const welfareCap = Number(row.official_welfare_capacity || 0);
  const totalCap = babiesCap + toddlersCap + adultsCap || welfareCap;

  const rawOwner =
    row.official_mol_org_name ||
    row.official_moe_owner ||
    row.official_welfare_org ||
    null;

  const externalId = (row.id || row.info_id_slug || '').trim();
  if (!externalId) return null;

  return {
    externalFacilityId: externalId,
    obudgetFacilityId: (row.info_id || '').trim() || null,
    moeSymbol,
    molSymbol,
    welfareSymbol,
    displayName,
    officialRegistryName:
      (row.official_moe_name || row.official_mol_name || displayName).trim(),
    normalizedName: normalizeDaycareName(displayName),
    ageGroupsSupported: ['0_1', '1_2', '2_3'],
    primaryTrack: isSubsidized ? 'symbol_regulated' : 'private_full_day',
    licensingRegime: 'daycare_law_0_3',
    cityCode: cityInfo.cityCode,
    cityNameHe: cityInfo.cityNameHe,
    streetNameHe: streetNameHe ? normalizeStreetName(streetNameHe) : null,
    houseNumberPublic: houseNumber,
    fullAddressPublic: fullAddress,
    lat,
    lng,
    operatorEntityName: sanitizeOperatorEntityName(rawOwner, null),
    operatorCorpId: null,
    officialPhonePublic: (row.resolved_phone || row.official_moe_phone || row.official_mol_phone || '').trim() || null,
    officialCapacity: totalCap > 0 ? totalCap : null,
    licenseStatus,
    isSubsidizedSymbol: isSubsidized,
    hasActiveStopOrder: false,
    hasOfficialSanction: false,
    primaryOfficialSource: 'facilities_datapackage',
    provenance: {
      sourceSystem: 'facilities_datapackage',
      externalRecordId: externalId,
      sourceLicense: 'ODbL-1.0',
      rawStatusText: rawLicense || undefined,
    },
  };
}

/**
 * 2. פענוח שורה ממרשם מעונות היום המורשים של משרד החינוך (GetMeonotExcel — גילאי 0–3)
 * מיישם את חוק הברזל D-23: מסנן בזיכרון מספרי ת"ז של עוסקים יחידים ב-semeL_BAALUT ומתעלם משמות מנהלים.
 */
export function parseMoELicensedDaycareRow(
  row: Record<string, string>
): CanonicalDaycareCandidate | null {
  const moeSymbol = cleanSymbol(row.semeL_MISGERET_IRGUNIT);
  const displayName = (row.sheM_MISGERET_IRGUNIT || '').trim();
  if (!moeSymbol || !displayName) return null;

  const cityInfo = resolveCityCodeAndName(
    row.codE_YISHUV_MISGERET,
    row.yishuV_MISGERET
  );
  if (!cityInfo) return null;

  const molSymbol = cleanSymbol(row.semeL_MAON_KLKALA_MEHASAVA);
  const rawBaalutId = row.semeL_BAALUT ?? row.semeL_BAALUT_redacted ?? null;
  const corpId = sanitizeMoEOperatorCorpId(rawBaalutId);
  const entityName = sanitizeOperatorEntityName(row.sheM_BAALUT, corpId);

  const statusText = (row.teuR_STATUS_RISHUY || '').trim();
  const stageText = (row.teuR_SHLAV_TIPUL || '').trim();
  const hasStopOrder = stageText.includes('צו הפסקה') || statusText.includes('צו הפסקה');

  let licenseStatus: DaycareLicenseStatus = 'active_license';
  if (hasStopOrder) {
    licenseStatus = 'stop_order_active';
  } else if (statusText === 'בתהליך רישוי') {
    licenseStatus = 'in_licensing_process';
  } else if (molSymbol) {
    licenseStatus = 'symbol_recognized';
  }

  const streetRaw = (row.rechoV_MISGERET || '').trim();
  const houseNum = (row.mispaR_BAIT || '').trim() || null;
  const fullAddress = streetRaw
    ? `${streetRaw}${houseNum ? ` ${houseNum}` : ''}, ${cityInfo.cityNameHe}`
    : cityInfo.cityNameHe;

  const prefix = (row.kidomeT_TELEPHONE || '').trim();
  const phoneNum = (row.telephonE_MAON || '').trim();
  const phone =
    prefix && phoneNum ? `${prefix}-${phoneNum}` : phoneNum || null;

  return {
    moeSymbol,
    molSymbol,
    displayName,
    officialRegistryName: displayName,
    normalizedName: normalizeDaycareName(displayName),
    ageGroupsSupported: ['0_1', '1_2', '2_3'],
    primaryTrack: molSymbol ? 'symbol_regulated' : 'private_full_day',
    licensingRegime: 'daycare_law_0_3',
    cityCode: cityInfo.cityCode,
    cityNameHe: cityInfo.cityNameHe,
    streetNameHe: streetRaw ? normalizeStreetName(streetRaw) : null,
    houseNumberPublic: houseNum,
    fullAddressPublic: fullAddress,
    lat: cityInfo.defaultLat,
    lng: cityInfo.defaultLng,
    operatorEntityName: entityName,
    operatorCorpId: corpId,
    officialPhonePublic: phone,
    licenseStatus,
    isSubsidizedSymbol: Boolean(molSymbol),
    hasActiveStopOrder: hasStopOrder,
    hasOfficialSanction: false,
    primaryOfficialSource: 'moe_getmeonot',
    provenance: {
      sourceSystem: 'moe_getmeonot',
      externalRecordId: moeSymbol,
      sourceLicense: 'data.gov.il',
      rawStatusText: hasStopOrder ? `${statusText} (${stageText})` : statusText,
    },
  };
}

/**
 * 3. פענוח שורה ממרשם העיצומים הכספיים של משרד החינוך (mirsham.xlsx — סעיף 53(א)(6) לחוק הפיקוח)
 */
export interface SanctionRecord {
  daycareName: string;
  normalizedName: string;
  operatorEntityName: string;
  rawAddress: string;
  sanctionDate: string | null;
  sanctionText: string;
}

export function parseMoEFinancialSanctionRow(
  row: Record<string, string>
): SanctionRecord | null {
  const daycareName = (row['שם המעון המפר'] || '').trim();
  const sanctionText = (row['מהות ההפרה שבשלה הוטל העיצום'] || '').trim();
  if (!daycareName || !sanctionText) return null;

  const rawOwner = (row['שם בעלות המעון'] || '').trim();
  const operatorEntityName =
    sanitizeOperatorEntityName(rawOwner, null) || 'עוסק יחיד';
  const rawDate = (row['תאריך הטלת העיצום'] || '').trim();
  const sanctionDate = rawDate ? rawDate.slice(0, 10) : null;

  return {
    daycareName,
    normalizedName: normalizeDaycareName(daycareName),
    operatorEntityName,
    rawAddress: (row['כתובת המעון'] || '').trim(),
    sanctionDate,
    sanctionText,
  };
}

/**
 * 4. פענוח שורה ממרשם מוסדות החינוך של משרד החינוך (mosdot_edu — גני ילדים גילאי 3–6 ומעונות)
 */
export function parseMoEMosdotEduRow(
  row: Record<string, string>
): CanonicalDaycareCandidate | null {
  const moeSymbol = cleanSymbol(row.SEMEL_MOSAD);
  const displayName = (row.SHEM_MOSAD || '').trim();
  const subKind = (row.TEUR_TAT_SUG_MISGERET || '').trim();
  const status = (row.TEUR_STATUS || '').trim();

  if (!moeSymbol || !displayName || status !== 'פעיל') return null;
  if (subKind !== 'גן ילדים' && subKind !== 'מעון יום') return null;

  const cityInfo = resolveCityCodeAndName(
    row.SEMEL_ISHUV_PNIM,
    row.ISV_SHEM_ISHUV
  );
  if (!cityInfo) return null;

  const coords = itmToWgs84(Number(row.X), Number(row.Y));
  const lat = coords?.lat ?? cityInfo.defaultLat;
  const lng = coords?.lng ?? cityInfo.defaultLng;

  const isKindergarten3to6 = subKind === 'גן ילדים';
  const legalStatus = (row.TEUR_MAMAD || '').trim();
  const isMunicipalPublic = legalStatus === 'רשמי';

  return {
    moeSymbol,
    displayName,
    officialRegistryName: displayName,
    normalizedName: normalizeDaycareName(displayName),
    ageGroupsSupported: isKindergarten3to6 ? ['3_6'] : ['0_1', '1_2', '2_3'],
    primaryTrack: isKindergarten3to6
      ? isMunicipalPublic
        ? 'municipal_tzaharon'
        : 'private_full_day'
      : 'private_full_day',
    licensingRegime: isKindergarten3to6
      ? isMunicipalPublic
        ? 'municipal_public'
        : 'schools_law_3_6'
      : 'daycare_law_0_3',
    cityCode: cityInfo.cityCode,
    cityNameHe: cityInfo.cityNameHe,
    fullAddressPublic: cityInfo.cityNameHe,
    lat,
    lng,
    licenseStatus: 'active_license',
    isSubsidizedSymbol: false,
    hasActiveStopOrder: false,
    hasOfficialSanction: false,
    primaryOfficialSource: 'moe_mosdot',
    provenance: {
      sourceSystem: 'moe_mosdot',
      externalRecordId: moeSymbol,
      sourceLicense: 'data.gov.il',
      rawStatusText: `${subKind} - ${legalStatus}`,
    },
  };
}

/**
 * 5. פענוח שורה ממאגר מעונות היום, המשפחתונים והצהרונים המוכרים של משרד העבודה (daycare-centers)
 */
export function parseLaborDaycareRow(
  row: Record<string, string>
): CanonicalDaycareCandidate | null {
  const molSymbol = cleanSymbol(row['סמל מעון'] || row.FrameId);
  const displayName = (row['שם מעון'] || row.FrameName || '').trim();
  if (!molSymbol || !displayName) return null;

  const cityInfo = resolveCityCodeAndName(
    row['קוד עיר'] || row.TownCode,
    row['שם עיר'] || row.TownName
  );
  if (!cityInfo) return null;

  const corpId = sanitizeMoEOperatorCorpId(row['ח.פ. ארגון']);
  const orgName = sanitizeOperatorEntityName(
    row['שם ארגון'] || row.OrganizationName,
    corpId
  );

  const typeDesc = (row['תיאור סוג מעון'] || row.FrameTypeDesc || 'מעון').trim();
  const isTzaharon = typeDesc.includes('צהרון');

  const streetRaw = (row['שם רחוב'] || row.Address || '').trim();
  const houseNum = (row['מספר בית'] || '').trim() || null;
  const fullAddress = streetRaw
    ? `${streetRaw}${houseNum ? ` ${houseNum}` : ''}, ${cityInfo.cityNameHe}`
    : cityInfo.cityNameHe;

  const babies = Number(row['תפוסת תינוקות'] || row.NumOfApprovedBabiesPlaces || 0);
  const toddlers = Number(row['תפוסת פעוטות'] || row.NumOfApprovedToddlersPlaces || 0);
  const adults = Number(row['תפוסת בוגרים'] || row.NumOfApprovedAdultsPlaces || 0);
  const totalCap = babies + toddlers + adults;

  const rawPhone = (row['מספר טלפון'] || row.Phone || '').trim();
  const phone =
    rawPhone && rawPhone !== 'אין' && rawPhone !== '000000000' && rawPhone !== 'None'
      ? rawPhone
      : null;

  return {
    molSymbol,
    displayName,
    officialRegistryName: displayName,
    normalizedName: normalizeDaycareName(displayName),
    ageGroupsSupported: isTzaharon ? ['3_6'] : ['0_1', '1_2', '2_3'],
    primaryTrack: isTzaharon ? 'municipal_tzaharon' : 'symbol_regulated',
    licensingRegime: isTzaharon ? 'schools_law_3_6' : 'daycare_law_0_3',
    cityCode: cityInfo.cityCode,
    cityNameHe: cityInfo.cityNameHe,
    streetNameHe: streetRaw ? normalizeStreetName(streetRaw) : null,
    houseNumberPublic: houseNum,
    fullAddressPublic: fullAddress,
    lat: cityInfo.defaultLat,
    lng: cityInfo.defaultLng,
    operatorEntityName: orgName,
    operatorCorpId: corpId,
    officialPhonePublic: phone,
    officialCapacity: totalCap > 0 ? totalCap : null,
    licenseStatus: 'symbol_recognized',
    isSubsidizedSymbol: true,
    hasActiveStopOrder: false,
    hasOfficialSanction: false,
    primaryOfficialSource: 'mol_daycare',
    provenance: {
      sourceSystem: 'mol_daycare',
      externalRecordId: molSymbol,
      sourceLicense: 'data.gov.il',
      rawStatusText: typeDesc,
    },
  };
}

/**
 * 6. פענוח שורה משכבה 925 ב-GIS עיריית תל אביב-יפו (גני ילדים פרטיים ומוסדות חינוך — D-37)
 */
export function parseTlvGisLayer925Row(
  row: Record<string, string>
): CanonicalDaycareCandidate | null {
  const idEsek = cleanSymbol(row.id_esek || row.OBJECTID);
  const streetRaw = (row.shem_rechov || '').trim();
  const houseNum = (row.ms_bayit || '').trim() || null;
  if (!idEsek || !streetRaw) return null;

  const coords = itmToWgs84(Number(row.x_coord), Number(row.y_coord));
  const lat = coords?.lat ?? 32.0853;
  const lng = coords?.lng ?? 34.7818;

  const corpId = sanitizeMoEOperatorCorpId(row.ms_mezahe_machzik_rashi);
  const holderName = (row.shem_machzik_rashi || '').trim();
  const entityName = sanitizeOperatorEntityName(holderName, corpId);

  const fullAddress = `${streetRaw}${houseNum ? ` ${houseNum}` : ''}, תל אביב - יפו`;
  const displayName =
    holderName && entityName !== 'עוסק יחיד'
      ? holderName.split(' בע"מ')[0].split(' (ע"ר)')[0].trim()
      : `גן ילדים (${streetRaw}${houseNum ? ` ${houseNum}` : ''})`;

  return {
    municipalGisId: `TLV-925-${idEsek}`,
    displayName,
    officialRegistryName: holderName || null,
    normalizedName: normalizeDaycareName(displayName),
    ageGroupsSupported: ['0_1', '1_2', '2_3'],
    primaryTrack: 'private_full_day',
    licensingRegime: 'daycare_law_0_3',
    cityCode: 5000,
    cityNameHe: 'תל אביב - יפו',
    streetNameHe: normalizeStreetName(streetRaw),
    houseNumberPublic: houseNum,
    fullAddressPublic: fullAddress,
    lat,
    lng,
    operatorEntityName: entityName,
    operatorCorpId: corpId,
    licenseStatus: 'municipal_verified',
    isSubsidizedSymbol: false,
    hasActiveStopOrder: false,
    hasOfficialSanction: false,
    primaryOfficialSource: 'tlv_gis_925',
    provenance: {
      sourceSystem: 'tlv_gis_925',
      externalRecordId: `TLV-925-${idEsek}`,
      sourceLicense: 'TLV-OpenData',
      rawStatusText: (row.shimush || 'גני ילדים פרטיים').trim(),
    },
  };
}
