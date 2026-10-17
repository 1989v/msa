import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketResponse, MarketStore } from '../../../api/marketApi';
import MarketGoogleMap from '../MarketGoogleMap';
const loader = vi.hoisted(() => vi.fn());
vi.mock('../googleMaps', () => ({ loadGoogleMaps: loader }));
const stores = [[37.5, 127], [37.50001, 127.00001], [37.5001, 127]].map(([latitude, longitude], id) => ({ id, name: `Shop ${id}`, latitude, longitude, membership: 'IN', categoryMajor: '음식', categoryMid: '한식', zoneId: 1, sources: [] } as unknown as MarketStore));
const data: MarketResponse = { market: { name: 'Market' } as MarketResponse['market'], stores, zones: [{ id: 1, name: 'Lane', children: [] } as unknown as MarketResponse['zones'][number]], paths: [{ id: 1, name: 'Lane', named: true, source: 'OSM', geometry: [[37.5, 127], [37.501, 127]] }] };
function sdk() {
  let zoom = 17; const listeners = new Map<string, () => void>(); const setMap = vi.fn(); const panTo = vi.fn(); const setZoom = vi.fn((z: number) => { zoom = z; });
  const map = { getZoom: () => zoom, panTo, setZoom, unbindAll: vi.fn(), getBounds: () => ({ getNorthEast: () => ({ lat: () => 38, lng: () => 128 }), getSouthWest: () => ({ lat: () => 37, lng: () => 126 }) }) };
  return { map, zoom: (z: number) => { zoom = z; }, listeners, setMap, Map: vi.fn(function (_element: HTMLElement, options: { zoom: number }) { zoom = options.zoom; return map; }),
    Polygon: vi.fn(function (_options: unknown) { return { setMap }; }), Polyline: vi.fn(function (_options: unknown) { return { setMap }; }),
    Circle: vi.fn(function (_options: unknown) { return { setMap }; }), Marker: vi.fn(function (_options: unknown) { return { setMap }; }), Point: vi.fn(function (x: number, y: number) { return { x, y }; }), SymbolPath: { CIRCLE: 0 },
    event: { addListener: vi.fn((target: unknown, name: string, fn: () => void) => { if (target === map) listeners.set(name, fn); return { remove: vi.fn() }; }), removeListener: vi.fn() },
  };
}
let maps: ReturnType<typeof sdk>;
beforeEach(() => { maps = sdk(); loader.mockReset().mockResolvedValue(maps); });
afterEach(cleanup);
describe('MarketGoogleMap', () => {
  it('disables gestures, UI and keyboard for a preview and activates markers and polygons without selection or viewport reports', async () => {
    const onActivate = vi.fn(); const onSelect = vi.fn(); const onViewportChange = vi.fn();
    render(<MarketGoogleMap contentId="1" lang="ko" data={data} interactive={false} initialZoom={16} onActivate={onActivate} onSelect={onSelect} onViewportChange={onViewportChange} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ zoom: 16, gestureHandling: 'none', disableDefaultUI: true, keyboardShortcuts: false }));
    expect(maps.Marker).toHaveBeenCalledWith(expect.objectContaining({ title: 'Market' }));
    const clicks = maps.event.addListener.mock.calls.filter(([, event]) => event === 'click');
    act(() => { clicks[0][2](); clicks.at(-1)![2](); maps.listeners.get('idle')!(); });
    expect(onActivate).toHaveBeenCalledTimes(2); expect(onSelect).not.toHaveBeenCalled(); expect(onViewportChange).not.toHaveBeenCalled();
  });
  it('reports first viewport and idle bounds with the rendered zoom', async () => {
    const onViewportChange = vi.fn();
    render(<MarketGoogleMap contentId="1" lang="ko" data={data} onViewportChange={onViewportChange} />);
    await waitFor(() => expect(onViewportChange).toHaveBeenCalledWith({ bounds: { north: 38, east: 128, south: 37, west: 126 }, zoom: 17 }));
    maps.zoom(19); act(() => maps.listeners.get('idle')!());
    expect(onViewportChange).toHaveBeenLastCalledWith({ bounds: { north: 38, east: 128, south: 37, west: 126 }, zoom: 19 });
    expect(onViewportChange).toHaveBeenCalledTimes(2);
  });
  it('draws the same polygons and alley highlights with legacy SVG markers and no Map ID', async () => {
    render(<MarketGoogleMap contentId="1" lang="en" data={data} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce()); expect(maps.Polygon).toHaveBeenCalledTimes(1); expect(maps.Polyline).toHaveBeenCalledOnce();
    expect(maps.Polygon).toHaveBeenCalledWith(expect.objectContaining({ fillOpacity: .12, strokeWeight: 1.5 }));
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ clickableIcons: false, streetViewControl: false, mapTypeControl: false }));
    expect(maps.Marker).toHaveBeenCalledWith(expect.objectContaining({ label: expect.objectContaining({ text: '3' }), icon: expect.objectContaining({ path: expect.stringContaining("M ") }) }));
  });
  it('uses model zoom stages and retains unchanged objects on idle', async () => {
    render(<MarketGoogleMap contentId="1" lang="ko" data={data} />); await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    act(() => maps.listeners.get('idle')!()); expect(maps.Marker).toHaveBeenCalledOnce();
    maps.zoom(16); act(() => maps.listeners.get('zoom_changed')!()); expect(maps.Marker).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Market' }));
    maps.zoom(19); act(() => maps.listeners.get('zoom_changed')!()); expect(maps.Marker).toHaveBeenCalledTimes(6); expect(maps.Polygon).toHaveBeenCalledTimes(1);
  });
  it('shares focus, selection and location callbacks and tears down overlays', async () => {
    const onSelect = vi.fn(); const { unmount } = render(<MarketGoogleMap contentId="1" lang="en" data={data} selection={{ storeId: 1 }} onSelect={onSelect} userPosition={{ latitude: 37.5, longitude: 127, accuracy: 12 }} />);
    await waitFor(() => expect(maps.Circle).toHaveBeenCalledOnce()); expect(maps.map.setZoom).toHaveBeenCalledWith(19); expect(onSelect).toHaveBeenCalled();
    expect(maps.Marker).toHaveBeenCalledWith(expect.objectContaining({ title: 'Your location' }));
    const click = maps.event.addListener.mock.calls.find(([, event]) => event === 'click')![2]; act(() => click()); expect(onSelect).toHaveBeenCalled();
    unmount(); expect(maps.setMap).toHaveBeenCalledWith(null); expect(maps.map.unbindAll).toHaveBeenCalledOnce();
  });
  it('reports SDK failure and never creates a map after disposal', async () => {
    loader.mockRejectedValueOnce(new Error('offline')); const onError = vi.fn(); const first = render(<MarketGoogleMap contentId="1" lang="en" data={data} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledOnce()); expect(maps.Map).not.toHaveBeenCalled(); first.unmount();
    let resolve!: (value: unknown) => void; loader.mockReturnValueOnce(new Promise((done) => { resolve = done; })); const second = render(<MarketGoogleMap contentId="1" lang="en" data={data} />); second.unmount(); await act(async () => resolve(maps)); expect(maps.Map).not.toHaveBeenCalled();
  });
  it('registers auth failure before load, preserves an existing handler and never overwrites a newer owner on cleanup', async () => {
    const global = window as Window & { gm_authFailure?: () => void }; const previous = vi.fn(); global.gm_authFailure = previous;
    const onError = vi.fn(); const { unmount } = render(<MarketGoogleMap contentId="1" lang="en" data={data} onError={onError} />);
    expect(global.gm_authFailure).not.toBe(previous); await waitFor(() => expect(maps.Map).toHaveBeenCalledOnce());
    act(() => global.gm_authFailure!()); expect(previous).toHaveBeenCalledOnce(); expect(onError).toHaveBeenCalledOnce();
    const newer = vi.fn(); global.gm_authFailure = newer; unmount(); expect(global.gm_authFailure).toBe(newer); delete global.gm_authFailure;
  });
});
