/**
 * מעטפת מטא-דאטה, רישוי (ODbL 1.0), ייחוס וכתב ויתור (docs/05 סעיף 1.3)
 */
export interface ApiMetaEnvelope {
  api_version: string;
  license: 'ODbL-1.0';
  license_url: string;
  attribution_he: string;
  non_endorsement_he: string;
  reliance_disclaimer_he: string;
  [key: string]: unknown;
}

export const STANDARD_META_ENVELOPE: ApiMetaEnvelope = {
  api_version: '1.0.0',
  license: 'ODbL-1.0',
  license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution_he:
    'הנתונים הרשמיים מבוססים על מאגרי הסדנא לידע ציבורי (מפתח התקציב), משרד החינוך, משרד העבודה, משרד הרווחה, הלמ״ס, פורטל data.gov.il, עיריית תל אביב-יפו ונתוני © OpenStreetMap contributors.',
  non_endorsement_he:
    'המערכת מופעלת באופן עצמאי ע״י הסדנא לידע ציבורי (ע״ר) ואינה פועלת מטעם או בחסות משרד ממשלתי.',
  reliance_disclaimer_he:
    'המידע מוצג להשוואה ראשונית בלבד. נתוני המחירים מבוססים על דיווחי הורים מהשטח ועשויים לכלול טעויות. המידע אינו מהווה תחליף לבדיקה פיזית של תעודת רישיון תקפה בכניסה למסגרת, ממ״ד תקני וחוזה ההתקשרות.',
};

export function buildMetaEnvelope(
  extra: Record<string, unknown> = {}
): ApiMetaEnvelope {
  return {
    ...STANDARD_META_ENVELOPE,
    ...extra,
  };
}

/**
 * הגנה מפני קצירת מספרי ניידים (05x) בייצוא המוני ורשימות (docs/05 סעיף 1.2)
 * מחזיר null אם המספר הוא טלפון סלולרי (05x / +972-5x), ומשאיר טלפונים קוויים (02/03/04/08/09/07x).
 */
export function stripMobilePhoneForBulkExport(
  phone: string | null | undefined
): string | null {
  if (!phone) return null;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  if (/^(05\d{8}|9725\d{8})$/.test(digitsOnly)) {
    return null;
  }
  return phone.trim();
}
