import { describe, expect, it } from 'vitest';
import { overrideRequest, polygonEdit, polygonWkt, projection, revertConfirmation, historyTime, shouldShowStoreLabel } from '../editorState';
import type { Market } from '@/api/markets';
const market: Market = { id: 1, name: '시장', marketType: 'STREET', latitude: 37.5, longitude: 127 };
describe('market editor state', () => {
  it('requires trimmed reasons for set and clear', () => {
    expect(() => overrideRequest({ name: '가게' }, [], '  ')).toThrow();
    expect(() => overrideRequest({}, ['name'], '\n')).toThrow();
    expect(overrideRequest({}, ['latitude', 'longitude'], '  오위치  ').reason).toBe('오위치');
  });
  it('adds vertices, requires three to close, closes ring and cancels without persisting', () => {
    let state = polygonEdit({ vertices: [], closed: false }, { type: 'add', coordinate: { latitude: 37, longitude: 127 } });
    expect(polygonEdit(state, { type: 'close' }).closed).toBe(false);
    state = polygonEdit(state, { type: 'add', coordinate: { latitude: 37, longitude: 128 } });
    state = polygonEdit(state, { type: 'add', coordinate: { latitude: 38, longitude: 128 } });
    state = polygonEdit(state, { type: 'close' });
    expect(polygonWkt(state)).toBe('POLYGON((127 37,128 37,128 38,127 37))');
    expect(polygonEdit(state, { type: 'add', coordinate: { latitude: 39, longitude: 129 } })).toBe(state);
    expect(polygonEdit(state, { type: 'cancel' })).toEqual({ vertices: [], closed: false });
  });
  it.each([{ coordinates: [] }, { coordinates: [{ latitude: 37.5, longitude: 127 }] }, { coordinates: [{ latitude: 37.5, longitude: 127 }, { latitude: 37.501, longitude: 127.003 }] }])('round trips geographic coordinates even empty/collocated maps: %j', ({ coordinates }) => {
    const map = projection(coordinates, market);
    const point = map.toPoint({ latitude: 37.5005, longitude: 127.001 });
    expect(Number.isFinite(point.x)).toBe(true);
    const inverse = map.toCoordinate(point.x, point.y);
    expect(inverse.latitude).toBeCloseTo(37.5005, 10);
    expect(inverse.longitude).toBeCloseTo(127.001, 10);
  });
  it('keeps revert confirmation inline and clears cancelled/completed selection', () => {
    expect(revertConfirmation(null, { type: 'ask', id: 7 })).toBe(7);
    expect(revertConfirmation(7, { type: 'cancel' })).toBeNull();
    expect(revertConfirmation(7, { type: 'complete' })).toBeNull();
  });
  it('formats local server times and UTC instants as KST', () => { expect(historyTime('2026-10-15T10:00:00')).toBe(historyTime('2026-10-15T01:00:00Z')); });
});

describe('store label visibility', () => {
  const base = { storeId: 7, selectedStoreId: null, hoveredStoreId: null, draggedStoreId: null, drawing: false };
  it('hides all labels by default', () => expect(shouldShowStoreLabel(base)).toBe(false));
  it.each(['selectedStoreId', 'hoveredStoreId', 'draggedStoreId'] as const)('shows the %s label only', field => {
    expect(shouldShowStoreLabel({ ...base, [field]: 7 })).toBe(true);
    expect(shouldShowStoreLabel({ ...base, [field]: 8 })).toBe(false);
  });
  it('hides labels while drawing even if selected, hovered and dragged', () => expect(shouldShowStoreLabel({ ...base, selectedStoreId: 7, hoveredStoreId: 7, draggedStoreId: 7, drawing: true })).toBe(false));
});
