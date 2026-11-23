import {
  DaycareAgeGroup,
  DaycareLicenseStatus,
} from '../etl/facilities-resolver.js';
import {
  FrameworkTrack,
  LicensingRegime,
} from '../etl/official-sources-parsers.js';

export interface RegulatoryFormatInput {
  licensingRegime: LicensingRegime;
  licenseStatus: DaycareLicenseStatus;
  moeSymbol?: string | null;
  molSymbol?: string | null;
  isSubsidizedSymbol: boolean;
  hasActiveStopOrder: boolean;
  hasOfficialSanction: boolean;
  officialSanctionDate?: string | null;
  officialSanctionText?: string | null;
  officialLastCheckedAt: string;
}

/**
 * בניית משפט ההקשר הרגולטורי המוגן משפטית (D-23(3), docs/05 סעיף 3.1 ו-5)
 * מצוטט כלשונו בכרטיס הגן ובכלי ה-MCP כדי למנוע פרשנות שגויה של סטטוס "בתהליך רישוי" או חובת רישיון.
 */
export function buildRegulatoryContextHe(input: RegulatoryFormatInput): string {
  const symbolPart = input.moeSymbol
    ? `סמל מסגרת במשרד החינוך: ${input.moeSymbol}`
    : input.molSymbol
      ? `סמל מעון במשרד העבודה: ${input.molSymbol}`
      : 'ללא סמל משרד החינוך משויך';

  const checkedDate = input.officialLastCheckedAt;

  if (input.hasActiveStopOrder || input.licenseStatus === 'stop_order_active') {
    return `התראת אכיפה רשמית: למסגרת זו רשום צו הפסקה מנהלי פעיל במרשם משרד החינוך (${symbolPart}, נבדק לאחרונה: ${checkedDate}).`;
  }

  if (input.hasOfficialSanction && input.officialSanctionText) {
    return `התראת אכיפה רשמית: למסגרת זו רשום עיצום כספי במרשם משרד החינוך מתאריך ${input.officialSanctionDate || checkedDate} בגין "${input.officialSanctionText}" (${symbolPart}).`;
  }

  if (
    input.licenseStatus === 'symbol_recognized' ||
    input.isSubsidizedSymbol
  ) {
    return `מעון סמל מוכר לסבסוד ושכר לימוד מפוקח ע״י משרד העבודה והחינוך (${symbolPart}, נבדק לאחרונה: ${checkedDate}).`;
  }

  if (input.licenseStatus === 'active_license') {
    const registryName =
      input.licensingRegime === 'schools_law_3_6' ||
      input.licensingRegime === 'municipal_public'
        ? 'מרשם מוסדות החינוך המפוקחים של משרד החינוך (גילאי 3–6)'
        : 'מרשם מעונות היום המפוקחים של משרד החינוך (גילאי 0–3)';
    return `מסגרת זו מופיעה ב${registryName} בסטטוס 'רישיון הפעלה בתוקף' (${symbolPart}, נבדק לאחרונה: ${checkedDate}).`;
  }

  if (input.licenseStatus === 'in_licensing_process') {
    return `מסגרת זו מופיעה במרשם משרד החינוך בסטטוס 'בתהליך רישוי' — הוגשה בקשת רישוי/חידוש הנמצאת בבדיקת המשרד ופועלת כחוק במסגרת הסדר רציפות הרישוי (${symbolPart}, נבדק לאחרונה: ${checkedDate}).`;
  }

  if (input.licenseStatus === 'municipal_verified') {
    return `מסגרת זו מופיעה במאגר המוניציפלי הרשמי של הרשות המקומית (נבדק לאחרונה: ${checkedDate}). חובת רישיון משרד החינוך חלה מ-7 פעוטות ומעלה בגילאי 0–3 ומ-11 תלמידים ומעלה בגילאי 3–6.`;
  }

  return `מסגרת זו לא אותרה אוטומטית במרשם הרלוונטי בבדיקה מתאריך ${checkedDate}; ייתכן שהיא פועלת תחת שם תאגיד שונה, בהליך רישוי או פטורה מרישיון מפאת גודלה (עד 6 פעוטות בגילאי 0–3 / עד 10 ילדים בגילאי 3–6).`;
}

export const AGE_GROUP_LABELS_HE: Record<DaycareAgeGroup, string> = {
  '0_1': 'תינוקות (לידה עד שנה)',
  '1_2': 'פעוטות צעירים (שנה עד שנתיים)',
  '2_3': 'פעוטות בוגרים (שנתיים עד שלוש)',
  '0_3': 'רב-גילי (לידה עד 3)',
  '3_6': 'גני ילדים וצהרונים (גילאי 3–6)',
};

export function formatSchoolYearLabel(schoolYear: number): string {
  switch (schoolYear) {
    case 2024:
      return 'תשפ״ד (2023–2024)';
    case 2025:
      return 'תשפ״ה (2024–2025)';
    case 2026:
      return 'תשפ״ו (2025–2026)';
    case 2027:
      return 'תשפ״ז (2026–2027)';
    default:
      return `${schoolYear}`;
  }
}

export interface PriceAggregateSummary {
  school_year: number;
  school_year_label: string;
  price_display_mode:
    | 'single'
    | 'range_discrepancy'
    | 'average_close'
    | 'median_consensus';
  primary_pin_price_nis: number;
  pin_requires_tilde: boolean;
  formatted_card_header: string;
  formatted_pin_label: string;
  min_price_nis: number;
  max_price_nis: number;
  median_price_nis: number;
  reports_count: number;
  price_trust_tier: 'tier_2_parent_consensus' | 'tier_3_unverified_report';
  relative_to_city_median:
    | 'subsidized_regulated'
    | 'below_median_10pct'
    | 'around_median'
    | 'above_median_10pct';
}

/**
 * עיצוב תצוגת המחיר בכרטיס הגן ובסיכת המפה לפי כללי D-31 ו-D-32
 */
export function buildFormattedPriceSummary(params: {
  schoolYear: number;
  priceDisplayMode:
    | 'single'
    | 'range_discrepancy'
    | 'average_close'
    | 'median_consensus';
  primaryPinPriceNis: number;
  pinRequiresTilde: boolean;
  minPriceNis: number;
  maxPriceNis: number;
  medianPriceNis: number;
  reportsCount: number;
  priceTrustTier: 'tier_2_parent_consensus' | 'tier_3_unverified_report';
  isSubsidizedSymbol: boolean;
  frameworkTrack: FrameworkTrack;
  cityMedianPriceNis: number | null;
}): PriceAggregateSummary {
  let formattedCardHeader: string;
  let formattedPinLabel: string;

  if (params.priceDisplayMode === 'single') {
    formattedCardHeader = `₪${params.primaryPinPriceNis.toLocaleString()} לחודש (דיווח בודד)`;
    formattedPinLabel = `₪${params.primaryPinPriceNis.toLocaleString()}`;
  } else if (params.priceDisplayMode === 'range_discrepancy') {
    formattedCardHeader = `₪${params.minPriceNis.toLocaleString()}–₪${params.maxPriceNis.toLocaleString()} לחודש (טווח מתוך 2 דיווחים)`;
    formattedPinLabel = `~₪${params.primaryPinPriceNis.toLocaleString()}`;
  } else if (params.priceDisplayMode === 'average_close') {
    formattedCardHeader = `₪${params.primaryPinPriceNis.toLocaleString()} לחודש (2 דיווחים תואמים)`;
    formattedPinLabel = `₪${params.primaryPinPriceNis.toLocaleString()}`;
  } else {
    formattedCardHeader = `₪${params.medianPriceNis.toLocaleString()} לחודש (חציון מתוך ${params.reportsCount} דיווחים)`;
    formattedPinLabel =
      params.priceTrustTier === 'tier_2_parent_consensus'
        ? `✓ ₪${params.primaryPinPriceNis.toLocaleString()}`
        : `₪${params.primaryPinPriceNis.toLocaleString()}`;
  }

  let relativeToCityMedian: PriceAggregateSummary['relative_to_city_median'] =
    'around_median';
  if (
    params.isSubsidizedSymbol ||
    params.frameworkTrack === 'symbol_regulated' ||
    params.frameworkTrack === 'municipal_tzaharon'
  ) {
    relativeToCityMedian = 'subsidized_regulated';
  } else if (params.cityMedianPriceNis && params.cityMedianPriceNis > 0) {
    const ratio =
      (params.primaryPinPriceNis - params.cityMedianPriceNis) /
      params.cityMedianPriceNis;
    if (ratio <= -0.1) {
      relativeToCityMedian = 'below_median_10pct';
    } else if (ratio >= 0.1) {
      relativeToCityMedian = 'above_median_10pct';
    }
  }

  return {
    school_year: params.schoolYear,
    school_year_label: formatSchoolYearLabel(params.schoolYear),
    price_display_mode: params.priceDisplayMode,
    primary_pin_price_nis: params.primaryPinPriceNis,
    pin_requires_tilde: params.pinRequiresTilde,
    formatted_card_header: formattedCardHeader,
    formatted_pin_label: formattedPinLabel,
    min_price_nis: params.minPriceNis,
    max_price_nis: params.maxPriceNis,
    median_price_nis: params.medianPriceNis,
    reports_count: params.reportsCount,
    price_trust_tier: params.priceTrustTier,
    relative_to_city_median: relativeToCityMedian,
  };
}
