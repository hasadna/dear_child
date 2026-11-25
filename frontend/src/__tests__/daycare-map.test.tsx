import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DaycareMap } from '../components/map/DaycareMap';

// Mock Leaflet cleanly for jsdom environment
const mockFlyToBounds = vi.fn();
const mockFlyTo = vi.fn();

vi.mock('leaflet', () => {
  const mockLayer = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
  };
  const mockMap = {
    on: vi.fn(),
    remove: vi.fn(),
    removeLayer: vi.fn(),
    flyTo: (...args: unknown[]) => mockFlyTo(...args),
    flyToBounds: (...args: unknown[]) => mockFlyToBounds(...args),
    getZoom: () => 13,
    getBounds: () => ({
      getWest: () => 34.5,
      getSouth: () => 31.8,
      getEast: () => 35.0,
      getNorth: () => 32.3,
    }),
  };
  const L = {
    map: vi.fn(() => mockMap),
    control: { zoom: vi.fn(() => ({ addTo: vi.fn() })) },
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    layerGroup: vi.fn(() => mockLayer),
    divIcon: vi.fn(() => ({})),
    marker: vi.fn(() => ({ on: vi.fn() })),
  };
  return { default: L, ...L };
});

describe('DaycareMap — Dynamic Legend, Quick Jump & Google-Maps-Style Layer Switcher', () => {
  it('renders only National View and Tel Aviv quick-jump buttons in exact order and calls flyToBounds', () => {
    render(
      <DaycareMap
        items={[]}
        selectedId={null}
        hoveredId={null}
        colorMode="relative_price"
        cityMedianPriceNis={5400}
        flyToTarget={null}
        onSelectDaycare={vi.fn()}
        onOpenFullProfile={vi.fn()}
        onReportPriceForDaycare={vi.fn()}
      />
    );

    const toolbar = screen.getByRole('toolbar', { name: 'ניווט מהיר במפה' });
    const buttons = toolbar.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('מבט ארצי');
    expect(buttons[1]).toHaveTextContent('תל אביב-יפו');
    expect(buttons[1]).not.toHaveTextContent('אשכולות');

    fireEvent.click(buttons[0]);
    expect(mockFlyToBounds).toHaveBeenCalled();
  });

  it('updates Map Legend dynamically per colorMode and never displays numeric prices', () => {
    const { rerender } = render(
      <DaycareMap
        items={[]}
        selectedId={null}
        hoveredId={null}
        colorMode="relative_price"
        cityMedianPriceNis={5400}
        flyToTarget={null}
        onSelectDaycare={vi.fn()}
        onOpenFullProfile={vi.fn()}
        onReportPriceForDaycare={vi.fn()}
      />
    );

    const legend = screen.getByLabelText('מקרא סיכות המפה');
    expect(legend).toHaveTextContent('זול / סביב החציון');
    expect(legend).not.toHaveTextContent('₪');

    rerender(
      <DaycareMap
        items={[]}
        selectedId={null}
        hoveredId={null}
        colorMode="supervision_status"
        cityMedianPriceNis={5400}
        flyToTarget={null}
        onSelectDaycare={vi.fn()}
        onOpenFullProfile={vi.fn()}
        onReportPriceForDaycare={vi.fn()}
      />
    );
    expect(legend).toHaveTextContent('רישיון בתוקף / סמל מוכר');
    expect(legend).not.toHaveTextContent('₪');

    rerender(
      <DaycareMap
        items={[]}
        selectedId={null}
        hoveredId={null}
        colorMode="reports_count"
        cityMedianPriceNis={5400}
        flyToTarget={null}
        onSelectDaycare={vi.fn()}
        onOpenFullProfile={vi.fn()}
        onReportPriceForDaycare={vi.fn()}
      />
    );
    expect(legend).toHaveTextContent('קונצנזוס (3+ דיווחים');
    expect(legend).not.toHaveTextContent('₪');
  });

  it('displays active map name on bottom-left FAB, lists all 5 map types in priority order and switches on click', () => {
    render(
      <DaycareMap
        items={[]}
        selectedId={null}
        hoveredId={null}
        colorMode="relative_price"
        cityMedianPriceNis={5400}
        flyToTarget={null}
        onSelectDaycare={vi.fn()}
        onOpenFullProfile={vi.fn()}
        onReportPriceForDaycare={vi.fn()}
      />
    );

    const fab = screen.getByRole('button', { name: /החלפת סוג מפה/ });
    expect(fab).toHaveTextContent('מפת רחובות');
    expect(fab).not.toHaveTextContent('שכבות');

    // Open map type popover
    fireEvent.click(fab);
    const popover = screen.getByRole('dialog', { name: 'בחירת סוג מפה' });
    expect(popover).toHaveTextContent('סוג מפה');
    expect(popover).not.toHaveTextContent('MapLibre');
    expect(popover).not.toHaveTextContent('Leaflet');

    const optionLabels = Array.from(
      popover.querySelectorAll('.layer-option-label')
    ).map((el) => el.textContent);
    expect(optionLabels).toEqual([
      'מפת רחובות',
      'לוויין',
      'מפה נקייה',
      'מפה בהירה',
      'פני שטח',
    ]);

    // Switch to Satellite ("לוויין")
    fireEvent.click(screen.getByText('לוויין'));
    expect(screen.queryByRole('dialog', { name: 'בחירת סוג מפה' })).not.toBeInTheDocument();
    expect(fab).toHaveTextContent('לוויין');
  });
});
