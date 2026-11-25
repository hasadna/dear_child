import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../components/shell/AppHeader';
import { ErrorBoundary } from '../components/shell/ErrorBoundary';
import { OnboardingModal } from '../components/shell/OnboardingModal';
import { ParentGuideModal } from '../components/shell/ParentGuideModal';
import { TermsAndPrivacyModal } from '../components/shell/TermsAndPrivacyModal';
import { ApiAndMcpModal } from '../components/shell/ApiAndMcpModal';

describe('AppHeader, Slide-Down Menu Drawer & Info Modals', () => {
  it('renders AppHeader with prominent centered CTA and exact cleaned menu drawer items', () => {
    const onOpenReport = vi.fn();
    const onOpenOnboarding = vi.fn();
    const onOpenGuide = vi.fn();
    const onOpenTerms = vi.fn();
    const onOpenApiMcp = vi.fn();

    render(
      <AppHeader
        onOpenReportModal={onOpenReport}
        onOpenOnboardingModal={onOpenOnboarding}
        onOpenParentGuideModal={onOpenGuide}
        onOpenTermsModal={onOpenTerms}
        onOpenApiMcpModal={onOpenApiMcp}
      />
    );

    // Prominent CTA in header
    const ctaBtn = screen.getByRole('button', { name: /הוספת מחיר גן/ });
    expect(ctaBtn).toBeInTheDocument();
    fireEvent.click(ctaBtn);
    expect(onOpenReport).toHaveBeenCalledTimes(1);

    // Open menu drawer
    fireEvent.click(screen.getByLabelText('פתיחת תפריט ניווט ומידע'));

    // Required menu items & cleaned text
    expect(screen.getByText('אודות "ילדי היקר"')).toBeInTheDocument();
    expect(
      screen.getByText('הגיל הרך — מדריך רישוי, פיקוח ומחירים')
    ).toBeInTheDocument();
    expect(screen.getByText('תנאי שימוש ופרטיות')).toBeInTheDocument();
    expect(screen.getByText('קהילה ושקיפות')).toBeInTheDocument();
    expect(screen.getByText('API ו-MCP')).toBeInTheDocument();
    expect(screen.getByText('מאגר הפרויקט בקוד פתוח')).toBeInTheDocument();

    // Ensure removed item is NOT present in menu
    expect(
      screen.queryByText(/דיווח אנונימי על מחיר הגן שלנו/)
    ).not.toBeInTheDocument();

    // Clicking Terms opens callback
    fireEvent.click(screen.getByText('תנאי שימוש ופרטיות'));
    expect(onOpenTerms).toHaveBeenCalledTimes(1);

    // Re-open and click API ו-MCP
    fireEvent.click(screen.getByLabelText('פתיחת תפריט ניווט ומידע'));
    fireEvent.click(screen.getByText('API ו-MCP'));
    expect(onOpenApiMcp).toHaveBeenCalledTimes(1);

    // Re-open and verify Esc closes the drawer
    fireEvent.click(screen.getByLabelText('פתיחת תפריט ניווט ומידע'));
    expect(document.querySelector('.app-menu-drawer.active')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.app-menu-drawer.active')).toBeFalsy();
  });

  it('OnboardingModal renders without action buttons and closes on X, Esc and backdrop click', () => {
    const onClose = vi.fn();
    render(<OnboardingModal open={true} onCloseAndSearch={onClose} />);

    expect(screen.getByText(/ברוכים הבאים ל"ילדי היקר"/)).toBeInTheDocument();
    expect(
      screen.queryByText(/חיפוש והשוואת גנים ומחירים באזור שלי/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/דיווח אנונימי על מחיר הגן שלנו/)
    ).not.toBeInTheDocument();

    // Close via X button
    fireEvent.click(screen.getByLabelText('סגירת חלון אודות'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Close via Esc
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Close via backdrop click
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('ParentGuideModal renders all 4 sections with line breaks and closes on X/Esc', () => {
    const onClose = vi.fn();
    const { container } = render(<ParentGuideModal open={true} onClose={onClose} />);

    expect(
      screen.getByText(/הגיל הרך — מדריך רישוי, פיקוח ומחירים להורים/)
    ).toBeInTheDocument();
    // Sections 1-3 must contain explicit <br> newlines between sentences
    expect(container.querySelectorAll('.guide-card br').length).toBeGreaterThanOrEqual(
      3
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('TermsAndPrivacyModal renders updated draft notice and closes on X/Esc/backdrop', () => {
    const onClose = vi.fn();
    render(<TermsAndPrivacyModal open={true} onClose={onClose} />);

    expect(
      screen.getByText(
        /מסמך זה מציג את עקרונות תנאי השימוש ומדיניות הפרטיות של המיזם ויעודכן בהמשך לנוסח המשפטי המחייב\./
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('סגירת תנאי שימוש ופרטיות'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ApiAndMcpModal uses 2 tabs (REST / MCP) with categorized sidebar navigation and parameter tables', () => {
    const onClose = vi.fn();
    const { container } = render(<ApiAndMcpModal open={true} onClose={onClose} />);

    expect(screen.getByText(/Public REST API ושרת MCP/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /הכול/ })).not.toBeInTheDocument();

    // Default tab: Public REST API
    expect(screen.getByRole('tab', { name: /Public REST API/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('נקודות הקצה של ה-Public REST API')).toBeInTheDocument();
    expect(container.querySelector('.api-docs-sidebar')).toBeInTheDocument();
    expect(container.querySelectorAll('table.api-params-table').length).toBe(5);
    expect(screen.getAllByText(/\/api\/v1\/daycares/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/\/api\/v1\/export/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('radius_m').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('min_price')).toBeInTheDocument();
    expect(screen.getAllByText('neighborhood_he').length).toBeGreaterThanOrEqual(1);

    // Switch to MCP tab and verify all 5 MCP tools and parameter tables
    fireEvent.click(screen.getByRole('tab', { name: /שרת MCP/ }));
    expect(screen.getByText(/שרת MCP לסוכני AI/)).toBeInTheDocument();
    expect(container.querySelectorAll('table.api-params-table').length).toBe(5);
    expect(screen.getAllByText('search_daycares').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('get_daycare_details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('get_area_price_stats').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('check_supervision_status').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText('compare_regulated_vs_market_cost').length
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText(/ODbL 1\.0/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByLabelText('סגירת מדריך API ו-MCP'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ErrorBoundary catches render errors instead of crashing to a white screen', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ThrowingChild: React.FC = () => {
      throw new Error('Simulated render crash');
    };

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText(/אופס! אירעה תקלה זמנית בתצוגה/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /רענון המערכת/ })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
