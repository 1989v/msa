import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketResponse, MarketStore } from '../../../api/marketApi';
import MarketNaverMap from '../MarketNaverMap';
const store = (id: number, latitude: number, longitude: number) => ({ id, name: `<Shop ${id}>`, latitude, longitude, membership: 'IN', categoryMajor: '음식', categoryMid: '한식', zoneId: 1, sources: [], pinKind: 'EXACT' } as unknown as MarketStore);
const data: MarketResponse = { market: { name: 'Market' } as MarketResponse['market'], zones: [{ id: 1, name: 'Lane', children: [] } as unknown as MarketResponse['zones'][number]], stores: [store(1, 37.5, 127), store(2, 37.50001, 127.00001), store(3, 37.5001, 127)], paths: [{ id: 1, name: 'Lane', named: true, source: 'OSM', geometry: [[37.5, 127], [37.501, 127]] }] };
const props = { contentId: '132180', lang: 'ko' as const, keyId: 'test-key', data };
function sdk() {
  let zoom = 17; let north = 38; const listeners = new Map<string, () => void>();
  const objects: { setMap: ReturnType<typeof vi.fn> }[] = [];
  const overlay = () => { const object = { setMap: vi.fn() }; objects.push(object); return object; };
  const destroy = vi.fn(); const panTo = vi.fn(); const setZoom = vi.fn((z: number) => { zoom = z; });
  const map = { destroy, panTo, setZoom, getZoom: () => zoom, getBounds: () => ({ getNE: () => ({ lat: () => north, lng: () => 128 }), getSW: () => ({ lat: () => 37, lng: () => 126 }) }) };
  const infoWindow = { content: null as HTMLElement | null, opened: false, open: vi.fn(() => { infoWindow.opened = true; }), close: vi.fn(() => { infoWindow.opened = false; }), setContent: vi.fn((element: HTMLElement) => { infoWindow.content = element; }), getContent: () => infoWindow.content, getMap: () => (infoWindow.opened ? map : null) };
  return { objects, destroy, panTo, setZoom, listeners, infoWindow, zoom: (z: number) => { zoom = z; }, north: (n: number) => { north = n; },
    InfoWindow: vi.fn(function (_options: unknown) { return infoWindow; }),
    Map: vi.fn(function (_host: HTMLElement, options: { zoom: number }) { zoom = options.zoom; return map; }), LatLng: vi.fn(function (latitude: number, longitude: number) { return { latitude, longitude }; }),
    Marker: vi.fn(function (_options: { icon: { content: HTMLElement }; title?: string }) { return overlay(); }),
    Polygon: vi.fn(function (_options: unknown) { return overlay(); }), Polyline: vi.fn(function (_options: unknown) { return overlay(); }), Circle: vi.fn(function (_options: unknown) { return overlay(); }),
    Event: { addListener: vi.fn((target: unknown, event: string, callback: () => void) => { if (target === map) listeners.set(event, callback); return { target, event, callback }; }), removeListener: vi.fn() },
  };
}
let maps: ReturnType<typeof sdk>;
const install = () => Object.defineProperty(window, 'naver', { configurable: true, value: { maps } });
const scripts = () => document.querySelectorAll<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
beforeEach(() => { maps = sdk(); });
afterEach(() => { cleanup(); scripts().forEach((s) => s.remove()); Reflect.deleteProperty(window, 'naver'); });
describe('MarketNaverMap', () => {
  it('disables gestures and controls for a zoom-16 preview, activates pins and polygons without selection or viewport reports', async () => {
    install(); const onActivate = vi.fn(); const onSelect = vi.fn(); const onViewportChange = vi.fn();
    const { container } = render(<MarketNaverMap {...props} interactive={false} initialZoom={16} onActivate={onActivate} onSelect={onSelect} onViewportChange={onViewportChange} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ zoom: 16, draggable: false, scrollWheel: false, pinchZoom: false, keyboardShortcuts: false, disableDoubleClickZoom: true, zoomControl: false, scaleControl: false }));
    expect(maps.Marker.mock.calls[0][0].title).toBe('Market');
    expect(container.querySelector('[style]')).toHaveStyle({ aspectRatio: '16 / 9' });
    fireEvent.click(maps.Marker.mock.calls[0][0].icon.content);
    const click = maps.Event.addListener.mock.calls.find(([, event]) => event === 'click')![2]; act(() => click());
    act(() => maps.listeners.get('idle')!());
    expect(onActivate).toHaveBeenCalledTimes(2); expect(onSelect).not.toHaveBeenCalled(); expect(onViewportChange).not.toHaveBeenCalled();
  });
  it('reports first viewport and idle bounds with the rendered zoom', async () => {
    const onViewportChange = vi.fn(); install();
    render(<MarketNaverMap {...props} onViewportChange={onViewportChange} />);
    await waitFor(() => expect(onViewportChange).toHaveBeenCalledWith({ bounds: { north: 38, east: 128, south: 37, west: 126 }, zoom: 17 }));
    maps.zoom(19); act(() => maps.listeners.get('idle')!());
    expect(onViewportChange).toHaveBeenLastCalledWith({ bounds: { north: 38, east: 128, south: 37, west: 126 }, zoom: 19 });
    expect(onViewportChange).toHaveBeenCalledTimes(2);
  });
  it('inserts one SDK for concurrent mounts and reuses it after remount', async () => {
    const first = render(<MarketNaverMap {...props} />); const second = render(<MarketNaverMap {...props} />);
    expect(scripts()).toHaveLength(1); expect(scripts()[0].src).toContain('ncpKeyId=test-key&language=ko'); install();
    await act(async () => fireEvent.load(scripts()[0])); expect(maps.Map).toHaveBeenCalledTimes(2);
    first.unmount(); second.unmount(); render(<MarketNaverMap {...props} />); await waitFor(() => expect(maps.Map).toHaveBeenCalledTimes(3));
  });
  it('uses safe HTML, polygons with fill, alley lines, and removes all objects on unmount', async () => {
    install(); const { unmount } = render(<MarketNaverMap {...props} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    const icon = maps.Marker.mock.calls[0][0].icon.content;
    expect(icon.textContent).toBe('3'); expect(icon.getAttribute('aria-label')).toContain('<Shop 1>'); expect(icon.querySelector('shop')).toBeNull();
    expect(maps.Polygon).toHaveBeenCalledTimes(1); expect(maps.Polygon).toHaveBeenCalledWith(expect.objectContaining({ fillOpacity: .12, strokeWeight: 1.5 })); expect(maps.Polyline).toHaveBeenCalledOnce();
    unmount(); expect(maps.destroy).toHaveBeenCalledOnce(); expect(maps.objects.every((o) => o.setMap.mock.calls.some(([map]) => map === null))).toBe(true);
  });
  it('loads nothing with an empty key', () => {
    const { container } = render(<MarketNaverMap {...props} keyId="" />); expect(container).toBeEmptyDOMElement(); expect(scripts()).toHaveLength(0);
  });
  it('increments only changed overlays on stage and viewport events, preserving polygons', async () => {
    install(); render(<MarketNaverMap {...props} />); await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    act(() => maps.listeners.get('idle')!()); expect(maps.Marker).toHaveBeenCalledOnce(); expect(maps.Polygon).toHaveBeenCalledTimes(1);
    maps.zoom(16); act(() => maps.listeners.get('zoom_changed')!()); expect(maps.Marker).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Market' }));
    maps.zoom(19); act(() => maps.listeners.get('zoom_changed')!()); expect(maps.Marker.mock.calls.slice(-4).filter(([o]) => o.title?.startsWith('<Shop'))).toHaveLength(3);
    const count = maps.Marker.mock.calls.length; maps.north(37.50002); act(() => maps.listeners.get('bounds_changed')!());
    expect(maps.Marker).toHaveBeenCalledTimes(count); expect(maps.Polygon).toHaveBeenCalledTimes(1);
  });
  it('does not create a map after unmount during loading', async () => {
    const { unmount } = render(<MarketNaverMap {...props} />); const script = scripts()[0]; unmount(); install(); await act(async () => fireEvent.load(script)); expect(maps.Map).not.toHaveBeenCalled();
  });
  it('uses latest props after loading and cleans up when key clears', async () => {
    const { rerender, container } = render(<MarketNaverMap {...props} />);
    rerender(<MarketNaverMap {...props} userPosition={{ latitude: 37.5, longitude: 127, accuracy: 15 }} selection={{ storeId: 1 }} />);
    install(); await act(async () => fireEvent.load(scripts()[0]));
    expect(maps.Circle).toHaveBeenCalledWith(expect.objectContaining({ radius: 15 })); expect(maps.panTo).toHaveBeenCalledWith({ latitude: 37.5, longitude: 127 }); expect(maps.setZoom).toHaveBeenCalledWith(19);
    rerender(<MarketNaverMap {...props} keyId="" />); expect(container).toBeEmptyDOMElement(); expect(maps.destroy).toHaveBeenCalledOnce();
  });
  it('reports localized load failure and suppresses native auth alerts before SDK execution', async () => {
    const onError = vi.fn(); render(<MarketNaverMap {...props} lang="en" onError={onError} />);
    expect(typeof (window as unknown as { navermap_authFailure: unknown }).navermap_authFailure).toBe('function');
    await act(async () => fireEvent.error(scripts()[0])); expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Naver Map.'); expect(onError).toHaveBeenCalledOnce();
  });
  it('reports authentication failure and leaves boundary and alley overlays noninteractive', async () => {
    install(); const onError = vi.fn(); render(<MarketNaverMap {...props} onError={onError} />);
    await waitFor(() => expect(maps.Polygon).toHaveBeenCalledTimes(1));
    const shapes = [...maps.Polygon.mock.results, ...maps.Polyline.mock.results].map((result) => result.value);
    expect(maps.Event.addListener.mock.calls.filter(([target, event]) => event === 'click' && shapes.includes(target))).toHaveLength(0);
    act(() => (window as unknown as { navermap_authFailure: () => void }).navermap_authFailure()); expect(onError).toHaveBeenCalledOnce();
  });
  it('selects the same parcel from the SDK marker click as from the pin element, with a centred hit box', async () => {
    // Mouse events stop at the SDK's event pane above the pins, so the SDK marker click is the only path a mouse has; touch still reaches the pin element.
    install(); const onSelect = vi.fn(); render(<MarketNaverMap {...props} onSelect={onSelect} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    const [options] = maps.Marker.mock.calls[0]; const object = maps.Marker.mock.results[0].value;
    expect(options.icon).toEqual(expect.objectContaining({ size: { width: 44, height: 44 }, anchor: { x: 22, y: 22 } }));
    fireEvent.click(options.icon.content); expect(onSelect).toHaveBeenCalledTimes(1);
    const click = maps.Event.addListener.mock.calls.find(([target, event]) => target === object && event === 'click')![2]; act(() => click());
    expect(onSelect).toHaveBeenCalledTimes(2); expect(onSelect.mock.calls[1][0]).toBe(onSelect.mock.calls[0][0]);
  });
  it('opens an info window at the pin with three shops, detail and list actions, and closes it on ×, map click or cleared selection', async () => {
    const stores = [store(1, 37.5, 127), store(2, 37.50001, 127.00001), store(3, 37.5001, 127), store(4, 37.50002, 127.00002)];
    install(); const onSelect = vi.fn(); const onOpenStore = vi.fn(); const onShowList = vi.fn();
    const { rerender } = render(<MarketNaverMap {...props} data={{ ...data, stores }} selection={{ selectedKey: 'x' }} onSelect={onSelect} onOpenStore={onOpenStore} onShowList={onShowList} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    expect(maps.InfoWindow).toHaveBeenCalledOnce(); expect(maps.infoWindow.open).not.toHaveBeenCalled();
    fireEvent.click(maps.Marker.mock.calls[0][0].icon.content);
    expect(onSelect).toHaveBeenCalledOnce(); expect(maps.infoWindow.open).toHaveBeenCalledWith(expect.anything(), { latitude: expect.any(Number), longitude: expect.any(Number) });
    const content = maps.infoWindow.content!; document.body.appendChild(content);
    expect(content.querySelectorAll('.place-market-naver-info-row')).toHaveLength(3); expect(content.textContent).toContain('<Shop 1>'); expect(content.querySelector('shop')).toBeNull();
    expect(content.textContent).toContain('음식점');
    fireEvent.click(within(content).getByRole('button', { name: '상세보기: <Shop 2>' })); expect(onOpenStore).toHaveBeenCalledWith(2);
    fireEvent.click(within(content).getByRole('button', { name: '외 1곳 · 목록 보기' })); expect(onShowList).toHaveBeenCalledOnce();
    const closes = () => maps.infoWindow.close.mock.calls.length; let before = closes();
    fireEvent.click(within(content).getByRole('button', { name: '닫기' })); expect(closes()).toBe(before + 1);
    before = closes(); act(() => maps.listeners.get('click')!()); expect(closes()).toBe(before + 1);
    before = closes(); rerender(<MarketNaverMap {...props} data={{ ...data, stores }} selection={{ selectedKey: null }} onSelect={onSelect} onOpenStore={onOpenStore} onShowList={onShowList} />); expect(closes()).toBe(before + 1);
    content.remove();
  });
  it('keeps a just-opened info window through map events that redraw before the page selects, then refills it in list order with the page numbers', async () => {
    install(); const onSelect = vi.fn();
    const { rerender } = render(<MarketNaverMap {...props} selection={{}} onSelect={onSelect} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    fireEvent.click(maps.Marker.mock.calls[0][0].icon.content); expect(maps.infoWindow.opened).toBe(true);
    // panBy/bounds_changed arrives with the old props (no selected key yet): the window must not be closed.
    act(() => maps.listeners.get('bounds_changed')!()); act(() => maps.listeners.get('idle')!()); expect(maps.infoWindow.opened).toBe(true);
    const names = () => [...maps.infoWindow.content!.querySelectorAll('.place-market-naver-info-row strong')].map((node) => node.textContent);
    expect(names()).toEqual(['<Shop 1>', '<Shop 2>', '<Shop 3>']); const fills = maps.infoWindow.setContent.mock.calls.length;
    rerender(<MarketNaverMap {...props} selection={{ selectedKey: 'x', numbers: new Map([[3, 1], [2, 2]]) }} onSelect={onSelect} />);
    expect(maps.infoWindow.setContent).toHaveBeenCalledTimes(fills + 1); expect(names()).toEqual(['1<Shop 3>', '2<Shop 2>', '<Shop 1>']);
    expect(maps.infoWindow.content!.querySelectorAll('.market-list-no')).toHaveLength(2);
    act(() => maps.listeners.get('bounds_changed')!()); expect(maps.infoWindow.setContent).toHaveBeenCalledTimes(fills + 1); expect(maps.infoWindow.opened).toBe(true);
    rerender(<MarketNaverMap {...props} selection={{ selectedKey: null }} onSelect={onSelect} />); expect(maps.infoWindow.opened).toBe(false);
  });
  it('opens the info window for the focused shop only and never for a noninteractive preview', async () => {
    install(); const { rerender } = render(<MarketNaverMap {...props} selection={{ storeId: 2 }} />);
    await waitFor(() => expect(maps.infoWindow.open).toHaveBeenCalledOnce());
    expect(maps.infoWindow.content!.querySelectorAll('.place-market-naver-info-row')).toHaveLength(1); expect(maps.infoWindow.content!.textContent).toContain('<Shop 2>');
    rerender(<MarketNaverMap {...props} keyId="" />); maps = sdk(); install();
    render(<MarketNaverMap {...props} interactive={false} initialZoom={16} onActivate={vi.fn()} />); await waitFor(() => expect(maps.Marker).toHaveBeenCalledOnce());
    fireEvent.click(maps.Marker.mock.calls[0][0].icon.content); expect(maps.InfoWindow).not.toHaveBeenCalled();
  });
});
