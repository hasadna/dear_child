import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DaycareProfileModal } from '../components/daycare/DaycareProfileModal';
import { ParentReportWizardModal } from '../components/crowdsourcing/ParentReportWizardModal';
import { CorrectionRequestModal } from '../components/crowdsourcing/CorrectionRequestModal';
import { DaycareDetailDto } from '../services/api-client';

const MINIMAL_DAYCARE: DaycareDetailDto = {
  id: 'daycare-profile-test-1',
  name: 'פעוטון רוטשילד',
  city_code: 5000,
  city_name_he: 'תל אביב - יפו',
  address: 'שדרות רוטשילד 88, תל אביב - יפו',
  lat: 32.0668,
  lon: 34.7771,
  target_age_groups: ['0_3_mixed'],
  age_group_label_he: 'לידה עד 3',
  is_subsidized: false,
  license_status: 'licensed',
  license_status_label_he: 'רישיון הפעלה בתוקף',
  license_icon_code: 'valid',
  ministry_edu_symbol: '415009',
  labor_Cross_symbol: null,
  operator_name: 'חינוך רוטשילד בע"מ',
  phone_official: '03-5601122',
  has_active_stop_order: false,
  display_mode: 'single',
  price_Trust_tier: 'single_parent_report',
  price_formatted_he: '₪5,800 לחודש (דיווח בודד)',
  price_pill_short_he: '₪5,800',
  trust_badge_he: 'ℹ️ דיווח בודד',
  headline_price_nis: 5800,
  min_price_nis: 5800,
  max_price_nis: 5800,
  active_reports_count: 1,
  school_year: 2026,
  activity_hours_summary_he: null,
  yoy_trend_summary_he: null,
  benchmark_neighborhood_summary_he: null,
  regulatory_context_he: 'מופיע במרשם משרד החינוך.',
  price_cohorts: [],
  relative_benchmarks: [],
  regulated_benchmark_comparison: {
    regulated_symbol_max_price_nis: 2515,
    annual_gap_11_months_nis: 36135,
    summary_he: 'פער שנתי של ₪36,135.',
  },
  yoy_price_history: [],
  individual_reports: [
    {
      school_year: 2026,
      school_year_label: 'תשפ"ו (2025–2026)',
      age_group: '0_3_mixed',
      age_group_label_he: 'רב-גילי (לידה עד 3)',
      monthly_price_nis: 5800,
      start_time_weekday: null,
      end_time_weekday: null,
      includes_friday: null,
      friday_start_time: null,
      friday_end_time: null,
      includes_nutrition: null,
      is_municipal_tzaharon_only: false,
      report_source: 'community_sheet_import_tlv',
      report_source_label_he: 'ייבוא מגיליון קהילתי ת"א (היסטורי)',
    },
  ],
  reliance_disclaimer_he: 'הבהרה משפטית: נתוני הרישוי מבוססים על מאגרי המדינה.',
};

describe('DaycareProfileModal, ParentReportWizardModal & CorrectionRequestModal', () => {
  it('renders DaycareProfileModal safely with historic NULL fields ("לא צוין בגיליון המקור") and closes on Esc/X', () => {
    const onClose = vi.fn();
    render(
      <DaycareProfileModal
        daycare={MINIMAL_DAYCARE}
        onClose={onClose}
        onOpenReportModal={vi.fn()}
        onOpenCorrectionModal={vi.fn()}
      />
    );

    expect(screen.getByText('פעוטון רוטשילד')).toBeInTheDocument();
    expect(screen.getAllByText('לא צוין בגיליון המקור').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByLabelText('סגירת כרטיס הגן'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('opens Step 1 when initialDaycare is null without price badges and with updated texts', () => {
    render(
      <ParentReportWizardModal
        open={true}
        initialDaycare={null}
        allDaycares={[MINIMAL_DAYCARE]}
        cityMedianPriceNis={5400}
        onClose={vi.fn()}
        onReportSubmitted={vi.fn()}
      />
    );

    expect(screen.getByText('בחרו את המסגרת הרשמית')).toBeInTheDocument();
    expect(screen.queryByText(/שלב 1 מתוך 3/)).not.toBeInTheDocument();
    expect(screen.getByText('2. מחיר ופרטים נוספים')).toBeInTheDocument();
    // Picker list must show name & address only, NOT price badge
    expect(screen.getByText('פעוטון רוטשילד')).toBeInTheDocument();
    expect(screen.queryByText('₪5,800')).not.toBeInTheDocument();
    expect(
      screen.getByText(/כרגע ניתן לדווח על מסגרות המופיעות במאגרי הממשלה/)
    ).toBeInTheDocument();
  });

  it('starts Step 2 empty, validates required fields & duplicate cohorts, supports 0-50000 slider/input, and keeps Step 3 confirmation open when allDaycares updates', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const onClose = vi.fn();

    let currentDaycares = [MINIMAL_DAYCARE];
    const onSubmitted = vi.fn((updated: DaycareDetailDto | null) => {
      if (updated) {
        currentDaycares = [updated];
      }
    });

    const { rerender } = render(
      <ParentReportWizardModal
        open={true}
        initialDaycare={MINIMAL_DAYCARE}
        allDaycares={currentDaycares}
        cityMedianPriceNis={5400}
        onClose={onClose}
        onReportSubmitted={onSubmitted}
      />
    );

    // No internal jargon ("ציר נרמול", "D-38") and simplified safety labels
    expect(screen.queryByText(/ציר נרמול/)).not.toBeInTheDocument();
    expect(screen.queryByText(/D-38/)).not.toBeInTheDocument();
    expect(screen.getByText('מאפייני בטיחות')).toBeInTheDocument();
    expect(screen.getByText('מצלמות')).toBeInTheDocument();
    expect(screen.queryByText(/חוק המצלמות/)).not.toBeInTheDocument();
    expect(screen.queryByText('יש ממ״ד')).not.toBeInTheDocument();
    expect(screen.queryByText('יש מצלמות')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ הוספת שכבת גיל נוספת באותו גן' })
    ).toBeInTheDocument();

    // Clicking proceed while empty must show per-field validation errors and stay on Step 2
    fireEvent.click(screen.getByRole('button', { name: /המשך להצהרה ואימות/ }));
    expect(screen.getByText(/יש לבחור שנת לימודים/)).toBeInTheDocument();
    expect(screen.getByText(/יש להזין מחיר חודשי/)).toBeInTheDocument();
    expect(screen.getByText(/יש לבחור קבוצת גיל/)).toBeInTheDocument();

    // Selecting 3_6 hides cameras and shows cleaned "סוג מסגרת בגילאי 3–6"
    fireEvent.click(screen.getByRole('button', { name: 'גילאי 3–6' }));
    expect(screen.queryByText('מצלמות')).not.toBeInTheDocument();
    expect(screen.getByText(/סוג מסגרת בגילאי 3–6/)).toBeInTheDocument();
    expect(screen.queryByText(/למניעת עיוות חציון/)).not.toBeInTheDocument();

    // Fill cohort #1 (next year 2028, 1_2, price 12000 -> triggers >40% outlier check)
    fireEvent.click(screen.getByRole('button', { name: /תשפ״ח/ }));
    fireEvent.click(screen.getByRole('button', { name: 'פעוטות (שנה–שנתיים)' }));
    fireEvent.click(screen.getByRole('button', { name: 'כולל הזנה' }));
    const priceInput = screen.getByRole('spinbutton');
    expect(priceInput).toHaveAttribute('min', '0');
    expect(priceInput).toHaveAttribute('max', '50000');
    const priceSlider = screen.getByRole('slider');
    expect(priceSlider).toHaveAttribute('min', '0');
    expect(priceSlider).toHaveAttribute('max', '50000');
    expect(priceSlider).toHaveAttribute('step', '50');
    fireEvent.change(priceInput, { target: { value: '12000' } });

    // Set weekday start/end hours and Friday = no
    fireEvent.click(screen.getByRole('button', { name: '07:30' }));
    fireEvent.click(screen.getByRole('button', { name: '16:30' }));
    fireEvent.click(screen.getByRole('button', { name: /לא \(א׳–ה׳ בלבד\)/ }));

    // Add duplicate cohort #2 with same year & age group -> must be blocked
    fireEvent.click(
      screen.getByRole('button', { name: '+ הוספת שכבת גיל נוספת באותו גן' })
    );
    const year2028Btns = screen.getAllByRole('button', { name: /תשפ״ח/ });
    fireEvent.click(year2028Btns[1]);
    const age12Btns = screen.getAllByRole('button', {
      name: 'פעוטות (שנה–שנתיים)',
    });
    fireEvent.click(age12Btns[1]);
    const nutritionBtns = screen.getAllByRole('button', { name: 'כולל הזנה' });
    fireEvent.click(nutritionBtns[1]);
    const allSpinButtons = screen.getAllByRole('spinbutton');
    fireEvent.change(allSpinButtons[1], { target: { value: '5500' } });
    const start0730Btns = screen.getAllByRole('button', { name: '07:30' });
    fireEvent.click(start0730Btns[1]);
    const end1630Btns = screen.getAllByRole('button', { name: '16:30' });
    fireEvent.click(end1630Btns[1]);
    const noFriBtns = screen.getAllByRole('button', {
      name: /לא \(א׳–ה׳ בלבד\)/,
    });
    fireEvent.click(noFriBtns[1]);

    fireEvent.click(screen.getByRole('button', { name: /המשך להצהרה ואימות/ }));
    expect(
      screen.getAllByText(/לא ניתן לדווח פעמיים על אותה קבוצת גיל/).length
    ).toBeGreaterThanOrEqual(1);

    // Remove duplicate cohort #2 and proceed -> Outlier sanity check
    fireEvent.click(
      screen.getAllByRole('button', { name: 'הסרת שכבה זו' })[1]
    );
    fireEvent.click(screen.getByRole('button', { name: /המשך להצהרה ואימות/ }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/בדיקת סבירות מחיר/);

    // Confirm outlier to advance to Step 3
    fireEvent.click(
      screen.getByRole('button', { name: /כן, המחיר מדויק — המשך לשלב 3/ })
    );

    // Step 3: cleaned heading, no section 62 prefix, collapsed privacy notice, no Turnstile text or checkbox
    expect(
      screen.getByText('הצהרת מחיר מחירון ואימות שומר פרטיות')
    ).toBeInTheDocument();
    expect(screen.queryByText(/שלב 3 מתוך 3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/סעיף 62 לפקודת הנזיקין/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cloudflare Turnstile/)).not.toBeInTheDocument();
    expect(screen.queryByText(/לא מקבלים ולא שומרים/)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /איך אנחנו שומרים על הפרטיות שלך/ })
    );
    expect(screen.getByText(/לא מקבלים ולא שומרים/)).toBeInTheDocument();

    // Only 1 checkbox (legal declaration)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);

    const submitBtn = screen.getByRole('button', {
      name: /המשך עם Google ושליחת הדיווח/,
    });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(checkboxes[0]);
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText('הפעולה הושלמה בהצלחה!')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'תודה! הדיווח נקלט במערכת בהצלחה ועדכן את מדד המחיר של הגן.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Blind Upsert/)).not.toBeInTheDocument();
    expect(onSubmitted).toHaveBeenCalledTimes(1);

    // Simulate parent updating allDaycares prop -> must NOT bounce back to Step 2!
    rerender(
      <ParentReportWizardModal
        open={true}
        initialDaycare={MINIMAL_DAYCARE}
        allDaycares={[{ ...MINIMAL_DAYCARE, active_reports_count: 2 }]}
        cityMedianPriceNis={5400}
        onClose={onClose}
        onReportSubmitted={onSubmitted}
      />
    );
    expect(screen.getByText('הפעולה הושלמה בהצלחה!')).toBeInTheDocument();
  });

  it('requires explicit selection of daycare, school year and age group in Blind Withdraw mode with validation errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const onSubmitted = vi.fn();

    render(
      <ParentReportWizardModal
        open={true}
        initialDaycare={null}
        initialWithdrawMode={true}
        allDaycares={[MINIMAL_DAYCARE]}
        cityMedianPriceNis={5400}
        onClose={vi.fn()}
        onReportSubmitted={onSubmitted}
      />
    );

    expect(screen.getByText(/ביטול דיווח עצמי לגן/)).toBeInTheDocument();
    const withdrawBtn = screen.getByRole('button', {
      name: /אימות Google וביטול הדיווח שלי/,
    });

    // Clicking withdraw without selections shows validation errors for daycare, year, and age group
    fireEvent.click(withdrawBtn);
    expect(screen.getByText(/יש לבחור מסגרת/)).toBeInTheDocument();
    expect(screen.getByText(/יש לבחור שנת לימודים/)).toBeInTheDocument();
    expect(screen.getByText(/יש לבחור שכבת גיל/)).toBeInTheDocument();

    // Pick daycare, school year, and age group
    fireEvent.click(screen.getByText('פעוטון רוטשילד'));
    fireEvent.click(screen.getByRole('button', { name: /תשפ״ז/ }));
    fireEvent.click(screen.getByRole('button', { name: 'פעוטות (שנה–שנתיים)' }));

    fireEvent.click(withdrawBtn);
    await waitFor(() => {
      expect(screen.getByText('הפעולה הושלמה בהצלחה!')).toBeInTheDocument();
    });
  });

  it('requires explicit category & role in CorrectionRequestModal, supports optional details textarea, and shows concise confirmation', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const onClose = vi.fn();

    render(
      <CorrectionRequestModal daycare={MINIMAL_DAYCARE} onClose={onClose} />
    );

    expect(
      screen.getByText(/מצאתם טעות בנתוני המסגרת/)
    ).toBeInTheDocument();
    expect(screen.getByText(/דיווח לבדיקה עבור/)).toBeInTheDocument();
    expect(screen.queryByText(/צוות הבקרה של הסדנא/)).not.toBeInTheDocument();
    // Sub-descriptions under categories were removed
    expect(
      screen.queryByText(/המסגרת הפסיקה את פעילותה בכתובת זו/)
    ).not.toBeInTheDocument();

    // Clicking submit while empty shows per-field validation errors
    fireEvent.click(screen.getByRole('button', { name: 'שליחת דיווח לבקרה' }));
    expect(screen.getByText(/יש לבחור את מהות הטעות/)).toBeInTheDocument();
    expect(screen.getByText(/יש לבחור מי מדווח/)).toBeInTheDocument();

    // Select category, role, and enter optional details text
    fireEvent.click(screen.getByText('המחיר המוצג שגוי או חריג'));
    fireEvent.click(screen.getByRole('button', { name: 'הורה במסגרת' }));
    const detailsBox = screen.getByLabelText(/פירוט הטעות/);
    fireEvent.change(detailsBox, {
      target: { value: 'המחיר לשנה הנוכחית הוא 4,800 ש״ח' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'שליחת דיווח לבקרה' }));
    await waitFor(() => {
      expect(screen.getByText('הדיווח על הטעות נקלט')).toBeInTheDocument();
    });
    expect(screen.getByText('תודה! הפנייה נקלטה ותיבדק.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
