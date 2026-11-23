/**
 * מנגנון איחוד ופענוח רשומות מסגרות חינוך (Facility Layer Resolution & Normalization)
 */

export interface FacilityRawLayer {
  name?: string;
  phone?: string;
  url?: string;
  email?: string;
  manager_name?: string;
  owner_kind?: 'municipal' | 'private' | 'national' | string;
  address?: string;
  formatted_address?: string;
  license_status?: string;
  licensing_not_needed?: boolean;
  symbol?: string;
  source?: 'labor' | 'welfare' | 'mol' | 'moe' | string;
  symbol_text?: string;
  lat?: number;
  lng?: number;
  facility_kind?: 'education' | 'health' | 'community' | string;
  facility_sub_kind?: string;
  age_group?: 'birth_to_1' | '1_to_2' | '2_to_3' | 'all_ages' | string;
  mentoring_type?: 'municipal' | 'private' | 'not-mentored' | string;
  school_year?: string | number;
  activity_hours?: string;
  more_details?: string;
  [key: string]: unknown;
}

export interface FacilityRawItem {
  id: string;
  user?: FacilityRawLayer;
  admin?: FacilityRawLayer;
  info?: FacilityRawLayer;
  official?: FacilityRawLayer[];
  resolved?: FacilityResolvedItem;
}

export type LicenseStatusCode =
  | 'valid'
  | 'in_progress'
  | 'did_not_apply'
  | 'not_needed'
  | 'none';

export type DaycareLicenseStatus =
  | 'active_license'
  | 'in_licensing_process'
  | 'symbol_recognized'
  | 'municipal_verified'
  | 'unlisted_in_registry'
  | 'stop_order_active';

export type DaycareAgeGroup = '0_1' | '1_2' | '2_3' | '0_3' | '3_6';

export interface FacilityResolvedItem {
  id: string;
  name: string;
  phone?: string;
  url?: string;
  email?: string;
  owner_kind?: string;
  address: string;
  license_status: string;
  license_status_code: LicenseStatusCode;
  daycare_license_status: DaycareLicenseStatus;
  licensing_not_needed: boolean;
  symbol?: string;
  source?: string;
  symbol_text?: string;
  lat: number;
  lng: number;
  facility_kind: string;
  facility_sub_kind?: string;
  age_group?: string;
  daycare_age_groups: DaycareAgeGroup[];
  mentoring_type: string;
  school_year?: string | number;
  subsidized: boolean;
  activity_hours?: string;
  more_details?: string;
}

function resolveField<T = unknown>(
  item: FacilityRawItem,
  field: keyof FacilityRawLayer
): T | undefined {
  const tries: (FacilityRawLayer | undefined)[] = [
    item.user,
    item.admin,
    item.info,
    ...(item.official || []),
  ];
  for (const tryItem of tries) {
    if (
      tryItem &&
      tryItem[field] !== undefined &&
      tryItem[field] !== null &&
      tryItem[field] !== ''
    ) {
      return tryItem[field] as T;
    }
  }
  return undefined;
}

/**
 * פענוח רשומת מסגרת משכבות מידע מרובות ומיפוי לטיפוסי ה-ENUM של "ילדי היקר".
 */
export function resolveFacilityItem(item: FacilityRawItem): FacilityResolvedItem {
  const rawLicenseStatus = resolveField<string>(item, 'license_status');
  const licensingNotNeeded = Boolean(
    resolveField<boolean>(item, 'licensing_not_needed')
  );
  const symbol = resolveField<string>(item, 'symbol');
  const source = resolveField<string>(item, 'source');
  let symbolText = resolveField<string>(item, 'symbol_text');

  const subsidized =
    item?.official?.some(
      (o) => o.source === 'mol' || o.source === 'labor'
    ) ||
    source === 'labor' ||
    source === 'mol';

  let licenseStatus = rawLicenseStatus || 'לא ידוע';
  let licenseStatusCode: LicenseStatusCode = 'none';
  let daycareLicenseStatus: DaycareLicenseStatus = 'municipal_verified';

  if (rawLicenseStatus === 'לא הוגשה בקשה לרישוי') {
    licenseStatusCode = 'did_not_apply';
    daycareLicenseStatus = 'municipal_verified';
  } else if (rawLicenseStatus === 'רישיון בתוקף') {
    licenseStatusCode = 'valid';
    daycareLicenseStatus = subsidized ? 'symbol_recognized' : 'active_license';
  } else if (rawLicenseStatus === 'בתהליך רישוי') {
    licenseStatusCode = 'in_progress';
    daycareLicenseStatus = 'in_licensing_process';
  } else if (!rawLicenseStatus) {
    if (licensingNotNeeded) {
      licenseStatus = 'מתחת ל-7 ילדים ואינו דורש רישוי';
      licenseStatusCode = 'not_needed';
      daycareLicenseStatus = 'municipal_verified';
    } else {
      licenseStatus = 'לא ידוע';
      licenseStatusCode = 'none';
      daycareLicenseStatus = subsidized
        ? 'symbol_recognized'
        : 'municipal_verified';
    }
  }

  if (!symbolText && symbol) {
    if (source === 'labor' || source === 'mol') {
      symbolText = `${symbol} (משרד העבודה)`;
    } else if (source === 'welfare') {
      symbolText = `${symbol} (משרד הרווחה)`;
    } else {
      symbolText = `${symbol}`;
    }
  }

  const rawAgeGroup = resolveField<string>(item, 'age_group');
  let daycareAgeGroups: DaycareAgeGroup[] = ['0_3'];
  if (rawAgeGroup === 'birth_to_1') {
    daycareAgeGroups = ['0_1'];
  } else if (rawAgeGroup === '1_to_2') {
    daycareAgeGroups = ['1_2'];
  } else if (rawAgeGroup === '2_to_3') {
    daycareAgeGroups = ['2_3'];
  } else if (rawAgeGroup === 'all_ages') {
    daycareAgeGroups = ['0_1', '1_2', '2_3'];
  }

  const resolved: FacilityResolvedItem = {
    id: item.id,
    name: resolveField<string>(item, 'name') || 'מסגרת ללא שם',
    phone: resolveField<string>(item, 'phone'),
    url: resolveField<string>(item, 'url'),
    email: resolveField<string>(item, 'email'),
    owner_kind: resolveField<string>(item, 'owner_kind'),
    address:
      resolveField<string>(item, 'formatted_address') ||
      resolveField<string>(item, 'address') ||
      '',
    license_status: licenseStatus,
    license_status_code: licenseStatusCode,
    daycare_license_status: daycareLicenseStatus,
    licensing_not_needed: licensingNotNeeded,
    symbol,
    source,
    symbol_text: symbolText,
    lat: Number(resolveField<number>(item, 'lat') || 0),
    lng: Number(resolveField<number>(item, 'lng') || 0),
    facility_kind: resolveField<string>(item, 'facility_kind') || 'not-set',
    facility_sub_kind: resolveField<string>(item, 'facility_sub_kind'),
    age_group: rawAgeGroup,
    daycare_age_groups: daycareAgeGroups,
    mentoring_type:
      resolveField<string>(item, 'mentoring_type') || 'not-mentored',
    school_year: resolveField<string | number>(item, 'school_year'),
    subsidized,
    activity_hours: resolveField<string>(item, 'activity_hours'),
    more_details: resolveField<string>(item, 'more_details'),
  };

  item.resolved = resolved;
  return resolved;
}

/**
 * נרמול שם מסגרת לאיחוד ישויות (Entity Resolution - docs/04 סעיף 4.1)
 */
export function normalizeDaycareName(name: string): string {
  return name
    .replace(/^(מעון יום|מעון|גן ילדים|גן|משפחתון|פעוטון)\s+/g, '')
    .replace(/\s+(בע"מ|בע״מ|בע'מ|ע"ר|ע״ר|\(ע"ר\))$/g, '')
    .replace(/["'״׳\-.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class FacilitiesApiClient {
  constructor(
    private readonly baseUrl = 'https://api-m5crpfzdeq-ez.a.run.app'
  ) {}

  async fetchWorkspaceEducationItems(
    workspaceId: string
  ): Promise<FacilityResolvedItem[]> {
    const url = `${this.baseUrl}/${encodeURIComponent(workspaceId)}/items?page_size=100000`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Hasadna-DearChild-ETL/1.0 (+https://github.com/hasadna/dear_child)',
      },
    });
    if (!res.ok) {
      throw new Error(
        `Facilities API error (${res.status}) for workspace ${workspaceId}`
      );
    }
    const items = (await res.json()) as FacilityRawItem[];
    return items
      .map((item) => resolveFacilityItem(item))
      .filter(
        (r) =>
          r.facility_kind === 'education' &&
          Boolean(r.lat) &&
          Boolean(r.lng) &&
          Boolean(r.id)
      );
  }
}
