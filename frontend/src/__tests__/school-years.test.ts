import { describe, expect, it } from 'vitest';
import {
  formatHebrewSchoolYear,
  formatHebrewYearShort,
  getActiveSchoolYear,
  getAvailableSchoolYears,
  getMaxReportableSchoolYear,
} from '../utils/school-years';

describe('Automatic School Year Rollover Utility (Frontend)', () => {
  it('computes active and next reportable school years automatically', () => {
    const d = new Date('2026-11-25T12:00:00Z');
    expect(getActiveSchoolYear(d)).toBe(2027);
    expect(getMaxReportableSchoolYear(d)).toBe(2028);
    expect(getAvailableSchoolYears(d)).toEqual([2028, 2027, 2026, 2025]);
  });

  it('formats Hebrew year labels dynamically for future years', () => {
    expect(formatHebrewYearShort(2027)).toBe('תשפ״ז');
    expect(formatHebrewYearShort(2028)).toBe('תשפ״ח');
    expect(formatHebrewSchoolYear(2028)).toBe('תשפ״ח (2027–2028)');
    expect(formatHebrewSchoolYear(2031)).toBe('תשצ״א (2030–2031)');
  });
});
