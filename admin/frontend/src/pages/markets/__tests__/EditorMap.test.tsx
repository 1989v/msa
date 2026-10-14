import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Detail, StoreRow } from '@/api/markets';
import { EditorMap } from '../EditorMap';
const row: StoreRow = { source: { id: 2, marketId: 1, name: '가게', source: 'MANUAL', membership: { status: 'IN' }, items: null, zoneId: null, pinKind: 'EXACT', latitude: 37.5, longitude: 127, referenceStoreId: null, relativePosition: null, positionNote: null, actorKind: 'ADMIN' }, display: { name: '가게', items: null, zoneId: null, membership: { status: 'IN' }, coordinate: { latitude: 37.5, longitude: 127 }, pinKind: 'EXACT' }, overrides: [] };
const detail: Detail = { market: { id: 1, name: '시장', marketType: 'STREET', latitude: 37.5, longitude: 127 }, zones: [], stores: [row] };
function props() { return { detail, polygon: { vertices: [], closed: false }, setPolygon: vi.fn(), onCoordinate: vi.fn(), onMove: vi.fn(), draft: null, disabled: false, selectedStoreId: null, onSelect: vi.fn() }; }
describe('map store labels', () => {
  it('renders no text labels by default and exposes hovered / selected names', () => {
    const options = props(); const { container, rerender } = render(<EditorMap {...options} />);
    expect(container.querySelectorAll('svg text')).toHaveLength(0);
    const pin = screen.getByRole('button', { name: '가게 핀' });
    expect(pin).toHaveAttribute('r', '22');
    fireEvent.pointerEnter(pin);
    expect(container.querySelector('svg text')).toHaveTextContent('가게');
    fireEvent.pointerLeave(pin);
    expect(container.querySelectorAll('svg text')).toHaveLength(0);
    rerender(<EditorMap {...options} selectedStoreId={2} />);
    expect(container.querySelector('svg text')).toHaveTextContent('가게');
    fireEvent.click(screen.getByRole('button', { name: '폴리곤 그리기' }));
    expect(container.querySelectorAll('svg text')).toHaveLength(0);
  });
  it('selects a pin by keyboard without moving its coordinates', () => {
    const options = props(); render(<EditorMap {...options} />);
    fireEvent.keyDown(screen.getByRole('button', { name: '가게 핀' }), { key: 'Enter' });
    expect(options.onSelect).toHaveBeenCalledWith(row);
    expect(options.onMove).not.toHaveBeenCalled();
  });
  it('prevents keyboard selection when the map is disabled', () => {
    const options = props(); render(<EditorMap {...options} disabled />);
    const pin = screen.getByRole('button', { name: '가게 핀' });
    expect(pin).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(options.onSelect).not.toHaveBeenCalled();
  });
});
