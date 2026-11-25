import { describe, expect, it } from 'vitest';
import {
  formatHebrewSchoolYear,
  formatHebrewYearShort,
  getActiveSchoolYear,
  getAvailableSchoolYears,
  getMaxReportableSchoolYear,
} from '../utils/school-years.js';

describe('Automatic School Year Rollover Utility (Backend)', () => {
  it('computes active school year based on Sept 1 Israeli academic calendar', () => {
    expect(getActiveSchoolYear(new Date('2026-08-31T12:00:00Z'))).toBe(2026);
    expect(getActiveSchoolYear(new Date('2026-09-01T12:00:00Z'))).toBe(2027);
    expect(getActiveSchoolYear(new Date('2026-11-25T12:00:00Z'))).toBe(2027);
    expect(getActiveSchoolYear(new Date('2027-02-15T12:00:00Z'))).toBe(2027);
    expect(getActiveSchoolYear(new Date('2027-09-01T12:00:00Z'))).toBe(2028);
  });

  it('always includes next school year for early registration and scales automatically', () => {
    const nov2026 = new Date('2026-11-25T12:00:00Z');
    expect(getMaxReportableSchoolYear(nov2026)).toBe(2028);
    expect(getAvailableSchoolYears(nov2026)).toEqual([2028, 2027, 2026, 2025]);

    const sep2028 = new Date('2028-09-02T12:00:00Z');
    expect(getMaxReportableSchoolYear(sep2028)).toBe(2030);
    expect(getAvailableSchoolYears(sep2028)).toEqual([
      2030, 2029, 2028, 2027, 2026, 2025,
    ]);
  });

  it('formats Hebrew academic year labels programmatically without hardcoding', () => {
    expect(formatHebrewYearShort(2025)).toBe('תשפ״ה');
    expect(formatHebrewYearShort(2026)).toBe('תשפ״ו');
    expect(formatHebrewYearShort(2027)).toBe('תשפ״ז');
    expect(formatHebrewYearShort(2028)).toBe('תשפ״ח');
    expect(formatHebrewYearShort(2029)).toBe('תשפ״ט');
    expect(formatHebrewYearShort(2030)).toBe('תש״צ');
    expect(formatHebrewSchoolYear(2028)).toBe('תשפ״ח (2027–2028)');
  });
});
