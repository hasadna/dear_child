/**
 * כלי עזר לפענוח CSV (תומך RFC-4180 ותאים רב-שורתיים), המרת קואורדינטות ITM->WGS84 וחישוב דמיון תלת-גרמי (pg_trgm)
 */

/**
 * פענוח טקסט CSV לרשימת אובייקטים לפי שורת הכותרת הראשונה.
 * תומך במרכאות כפולות (""), פסיקים וירידות שורה בתוך תאים מוקפים במרכאות, ו-UTF-8 BOM.
 */
export function parseCsvRecords(csvText: string): Record<string, string>[] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"' && currentField.length === 0) {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0] === '') continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (key) {
        obj[key] = row[c] !== undefined ? row[c] : '';
      }
    }
    records.push(obj);
  }

  return records;
}

/**
 * ניקוי סמל מוסד/מעון (הסרת סיומת .0 של מספרי Float בייצוא CSV וערכי סרק)
 */
export function cleanSymbol(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw)
    .trim()
    .replace(/\.0+$/, '');
  if (!str || str === '0' || str === '-1' || str.toLowerCase() === 'none' || str.toLowerCase() === 'null') {
    return null;
  }
  return str;
}

/**
 * המרת קואורדינטות מרשת ישראל החדשה (ITM / EPSG:2039) ל-WGS84 (EPSG:4326 lat/lng).
 * משמשת כאשר הנתונים מגיעים מ-mosdot_edu, משרד הרווחה או GIS עיריית ת"א לפני הכנסתם ל-PostGIS.
 */
export function itmToWgs84(
  eastingX: number,
  northingY: number
): { lat: number; lng: number } | null {
  if (
    !Number.isFinite(eastingX) ||
    !Number.isFinite(northingY) ||
    eastingX < 100_000 ||
    eastingX > 300_000 ||
    northingY < 350_000 ||
    northingY > 850_000
  ) {
    return null;
  }

  // GRS80 / ITM projection parameters
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = 2 * f - f * f;
  const k0 = 1.0000067;
  const lat0 = (31.73439361111111 * Math.PI) / 180;
  const lon0 = (35.20451694444445 * Math.PI) / 180;
  const falseE = 219529.584;
  const falseN = 626907.39;

  const x = eastingX - falseE;
  const y = northingY - falseN;

  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const A0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
  const A2 = (3 / 8) * (e2 + e4 / 4 + (15 * e6) / 128);
  const A4 = (15 / 256) * (e4 + (3 * e6) / 4);
  const A6 = (35 * e6) / 3072;

  const M0 =
    a *
    (A0 * lat0 -
      A2 * Math.sin(2 * lat0) +
      A4 * Math.sin(4 * lat0) -
      A6 * Math.sin(6 * lat0));
  const M = M0 + y / k0;

  const mu = M / (a * A0);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const J1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32;
  const J2 = (21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32;
  const J3 = (151 * Math.pow(e1, 3)) / 96;
  const J4 = (1097 * Math.pow(e1, 4)) / 512;

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu);

  const ePrime2 = e2 / (1 - e2);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);

  const C1 = ePrime2 * cosFp * cosFp;
  const T1 = tanFp * tanFp;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
  const N1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const D = x / (N1 * k0);

  const latRad =
    fp -
    ((N1 * tanFp) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrime2) * Math.pow(D, 4)) /
          24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrime2 - 3 * C1 * C1) *
          Math.pow(D, 6)) /
          720);

  const lonRad =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrime2 + 24 * T1 * T1) *
        Math.pow(D, 5)) /
        120) /
      cosFp;

  return {
    lat: Number(((latRad * 180) / Math.PI).toFixed(6)),
    lng: Number(((lonRad * 180) / Math.PI).toFixed(6)),
  };
}

/**
 * חישוב מרחק אווירי במטרים בין שתי נקודות WGS84 (נוסחת Haversine)
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * חישוב דמיון Trigram (תואם ל-similarity() של pg_trgm ב-PostgreSQL)
 */
export function trigramSimilarity(strA: string, strB: string): number {
  const a = `  ${strA.toLowerCase().trim()} `;
  const b = `  ${strB.toLowerCase().trim()} `;
  if (a.trim() === '' || b.trim() === '') return 0;
  if (a === b) return 1;

  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();

  for (let i = 0; i <= a.length - 3; i++) {
    trigramsA.add(a.slice(i, i + 3));
  }
  for (let i = 0; i <= b.length - 3; i++) {
    trigramsB.add(b.slice(i, i + 3));
  }

  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }

  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * פירוק כתובת עברית ("ארלוזורוב 42, תל אביב - יפו") לשם רחוב ומספר בית
 */
export function splitStreetAndHouseNumber(rawAddress: string): {
  streetNameHe: string | null;
  houseNumber: string | null;
} {
  const beforeComma = rawAddress.split(',')[0].replace(/\([^)]*\)/g, '').trim();
  if (!beforeComma) return { streetNameHe: null, houseNumber: null };

  const match = beforeComma.match(/^(.+?)\s+(\d+[א-ת]?(?:\/\d+)?)$/);
  if (match) {
    return {
      streetNameHe: match[1].trim(),
      houseNumber: match[2].trim(),
    };
  }
  return {
    streetNameHe: beforeComma,
    houseNumber: null,
  };
}
