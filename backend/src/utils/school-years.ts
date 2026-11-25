export const MIN_REPORTABLE_SCHOOL_YEAR = 2025;

/**
 * חישוב שנת הלימודים הפעילה בישראל (1 בספטמבר עד 31 באוגוסט):
 * למשל: ספטמבר 2026 – אוגוסט 2027 = שנת הלימודים 2027 (תשפ״ז).
 */
export function getActiveSchoolYear(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1..12
  return month >= 9 ? year + 1 : year;
}

/**
 * השנה המקסימלית שניתן לדווח עבורה: תמיד כוללת גם את השנה הבאה
 * כדי לאפשר להורים שנרשמו מראש לדווח עוד לפני תחילת שנת הלימודים.
 */
export function getMaxReportableSchoolYear(now: Date = new Date()): number {
  return getActiveSchoolYear(now) + 1;
}

/**
 * מחזיר את רשימת שנות הלימודים הזמינות בסדר יורד (מהשנה הבאה ועד 2025).
 */
export function getAvailableSchoolYears(now: Date = new Date()): number[] {
  const maxYear = getMaxReportableSchoolYear(now);
  const years: number[] = [];
  for (let y = maxYear; y >= MIN_REPORTABLE_SCHOOL_YEAR; y -= 1) {
    years.push(y);
  }
  return years;
}

const HUNDREDS_HE: Record<number, string> = {
  100: 'ק',
  200: 'ר',
  300: 'ש',
  400: 'ת',
  500: 'תק',
  600: 'תר',
  700: 'תש',
  800: 'תת',
  900: 'תתק',
};

const TENS_HE: Record<number, string> = {
  10: 'י',
  20: 'כ',
  30: 'ל',
  40: 'מ',
  50: 'נ',
  60: 'ס',
  70: 'ע',
  80: 'פ',
  90: 'צ',
};

const UNITS_HE: Record<number, string> = {
  1: 'א',
  2: 'ב',
  3: 'ג',
  4: 'ד',
  5: 'ה',
  6: 'ו',
  7: 'ז',
  8: 'ח',
  9: 'ט',
};

/**
 * ממיר שנת סיום לועזית (למשל 2027 -> ה'תשפ"ז -> "תשפ״ז") לשם שנה עברית תקני אוטומטית.
 */
export function formatHebrewYearShort(gregorianEndYear: number): string {
  const hebrewYear = gregorianEndYear + 3760;
  const rem = hebrewYear % 1000;
  const hundreds = Math.floor(rem / 100) * 100;
  const tensUnits = rem % 100;

  let letters = HUNDREDS_HE[hundreds] || '';
  if (tensUnits === 15) {
    letters += 'טו';
  } else if (tensUnits === 16) {
    letters += 'טז';
  } else {
    const tens = Math.floor(tensUnits / 10) * 10;
    const units = tensUnits % 10;
    letters += (TENS_HE[tens] || '') + (UNITS_HE[units] || '');
  }

  if (letters.length <= 1) {
    return `${letters}׳`;
  }
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/**
 * תווית מלאה לשנת לימודים, למשל: תשפ״ח (2027–2028)
 */
export function formatHebrewSchoolYear(gregorianEndYear: number): string {
  return `${formatHebrewYearShort(gregorianEndYear)} (${gregorianEndYear - 1}–${gregorianEndYear})`;
}
