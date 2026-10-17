import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketResponse, MarketStore } from '../../../api/marketApi';
import { groupMarketPins, projectMarketPins } from '../marketView';
import MarketMap from '../MarketMap';
vi.mock('../../../seo/copy.mjs', async (original) => ({ ...await original<typeof import('../../../seo/copy.mjs')>(), NAVER_MAP_KEY_ID: 'test-key' }));
const shop = (overrides: Partial<MarketStore> = {}): MarketStore => ({
  id: 1, name: '가게', items: '떡볶이', zoneId: null, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT',
  manual: false, actorKind: null, relativePosition: null, positionNote: null, ...overrides,
});
const data: MarketResponse = {
  market: { name: '시장', marketType: 'STREET', sourceMarketType: null, storeCountRaw: null, openingCycle: null, facilities: null, attribution: null },
  zones: [], stores: [shop(), shop({ id: 2, name: '옆집', longitude: 127.0001 })],
  boundary: { source: 'OSM', polygon: [[37.499, 126.999], [37.501, 126.999], [37.501, 127.001]] },
};
const scripts = () => document.querySelectorAll<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
function sdk() {
  let host: HTMLElement; let scale = 100000;
  const listeners = new Map<string, () => void>(); const panTo = vi.fn(); const setZoom = vi.fn();
  return {
    panTo, setZoom, listeners, scale: (next: number) => { scale = next; },
    Map: vi.fn(function (element: HTMLElement) { host = element; return {
      destroy: vi.fn(), setCenter: vi.fn(), panTo, setZoom,
      getProjection: () => ({ fromCoordToOffset: (point: { latitude: number; longitude: number }) => ({ x: point.longitude * scale, y: point.latitude * scale }) }),
    }; }),
    LatLng: vi.fn(function (latitude: number, longitude: number) { return { latitude, longitude }; }),
    Marker: vi.fn(function (options: { icon: { content: HTMLElement }; title: string }) {
      host.appendChild(options.icon.content); return { setMap: () => options.icon.content.remove() };
    }),
    Polyline: vi.fn(function (_options: unknown) { return { setMap: vi.fn() }; }),
    Circle: vi.fn(function (_options: unknown) { return { setMap: vi.fn() }; }),
    Event: { addListener: vi.fn((_map: unknown, name: string, listener: () => void) => { listeners.set(name, listener); return name; }), removeListener: vi.fn() },
  };
}
let maps: ReturnType<typeof sdk>;
const install = () => Object.defineProperty(window, 'naver', { configurable: true, value: { maps } });
function view(market = data, lang: 'ko' | 'en' = 'ko') {
  const projection = projectMarketPins(groupMarketPins(market.stores), market)!;
  return function View() {
    const [selectedKey, onSelect] = useState<string | null>(null); const [focusStoreId, focus] = useState<number | null>(null);
    return <><button onClick={() => focus(1)}>Focus shop</button><button onClick={() => focus(null)}>Clear focus</button>
      <MarketMap contentId="123" data={market} lang={lang} projection={projection} points={[...projection.points]} hasGeometry query="떡볶이"
        basemapAttribution={<a href="https://openfreemap.org/">OpenFreeMap</a>}
        basemapMeta={{ contentId: '123', centre: { latitude: 37.5, longitude: 127 }, zoom: 18, width: 1536, height: 1152,
          bounds: { north: 37.501, south: 37.499, east: 127.001, west: 126.999 }, renderedAt: '2026-10-17', styleVersion: '1', themes: ['light', 'dark'] }}
        selectedKey={selectedKey} onSelect={onSelect} focusStoreId={focusStoreId} color={() => 'var(--market-zone-1)'} pathColor={() => undefined} /></>;
  };
}
beforeEach(() => { maps = sdk(); window.localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); cleanup(); scripts().forEach((script) => script.remove()); Reflect.deleteProperty(window, 'naver'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('market map provider', () => {
  it('defaults to Naver, clusters counts and colours, opens the shared sheet and reclusters on zoom and idle', async () => {
    install(); const View = view(); const { container } = render(<View />);
    await waitFor(() => expect(container.querySelector('.place-market-naver-pin')).not.toBeNull());
    const pin = container.querySelector('.place-market-naver-pin')!;
    expect(pin).toHaveTextContent('2');
    expect(pin.firstElementChild?.getAttribute('style')).toContain('background: var(--market-zone-1)');
    expect(pin.firstElementChild?.getAttribute('style')).toContain('border-width: 3px');
    expect(pin.firstElementChild?.getAttribute('style')).toContain('border-color: var(--ko-accent-text)');
    expect(maps.Polyline).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link', { name: 'OpenFreeMap' })).not.toBeInTheDocument();
    fireEvent.click(pin);
    expect(screen.getByRole('region', { name: '선택한 가게' })).toHaveTextContent('같은 필지 가게 (2)');
    maps.scale(1000000); act(() => maps.listeners.get('zoom_changed')!());
    expect(container.querySelectorAll('.place-market-naver-pin')).toHaveLength(2);
    maps.scale(100000); act(() => maps.listeners.get('idle')!());
    expect(container.querySelectorAll('.place-market-naver-pin')).toHaveLength(1);
    expect(screen.getByRole('region', { name: '선택한 가게' })).toHaveTextContent('같은 필지 가게 (2)');
  });
  it('focuses at zoom 19 once, lets the sheet close, and handles a repeated focus request', async () => {
    install(); const View = view(); render(<View />);
    await waitFor(() => expect(maps.Map).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('Focus shop'));
    expect(maps.panTo).toHaveBeenCalledWith({ latitude: 37.5, longitude: 127 }); expect(maps.setZoom).toHaveBeenCalledWith(19);
    expect(screen.getByRole('region', { name: '선택한 가게' })).toHaveTextContent('가게');
    fireEvent.click(screen.getByText('전체 가게 보기'));
    expect(screen.queryByRole('region', { name: '선택한 가게' })).not.toBeInTheDocument(); expect(maps.panTo).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Clear focus')); fireEvent.click(screen.getByText('Focus shop')); expect(maps.panTo).toHaveBeenCalledTimes(2);
  });
  it('measures only on click and draws the marker and accuracy Circle with existing locate copy', async () => {
    install(); const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: 37.5, longitude: 127, accuracy: 12 }, timestamp: 1000 } as GeolocationPosition));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } }); const View = view(); render(<View />);
    await waitFor(() => expect(maps.Map).toHaveBeenCalledOnce()); expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '내 위치' }));
    expect(screen.getByText('시장 안입니다')).toBeInTheDocument(); expect(screen.getByText(/정확도 ±12 m/)).toBeInTheDocument();
    expect(maps.Circle).toHaveBeenCalledWith(expect.objectContaining({ radius: 12, center: { latitude: 37.5, longitude: 127 } }));
    expect(maps.Marker).toHaveBeenCalledWith(expect.objectContaining({ title: '내 위치' }));
  });
  it('persists manual Canvas choice, switches back and reuses one SDK script', async () => {
    const View = view(); const first = render(<View />); expect(scripts()).toHaveLength(1); install();
    await act(async () => fireEvent.load(scripts()[0])); fireEvent.click(screen.getByText('우리 지도로 보기'));
    expect(first.container.querySelector('svg')).toBeInTheDocument();
    fireEvent.load(first.container.querySelector('image')!);
    expect(screen.getByRole('link', { name: 'OpenFreeMap' })).toBeInTheDocument();
    expect(window.localStorage.getItem('market-map-provider')).toBe('canvas'); first.unmount();
    const second = render(<View />); expect(second.container.querySelector('svg')).toBeInTheDocument(); fireEvent.click(screen.getByText('네이버 지도로 보기'));
    await waitFor(() => expect(maps.Map).toHaveBeenCalledTimes(2)); expect(scripts()).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'OpenFreeMap' })).not.toBeInTheDocument();
  });
  it('falls back automatically after SDK failure and retries with a fresh script', async () => {
    const View = view(); const { container } = render(<View />); await act(async () => fireEvent.error(scripts()[0]));
    expect(container.querySelector('svg')).toBeInTheDocument(); expect(screen.queryByRole('group', { name: '네이버 가게 위치 지도' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('네이버 지도로 보기')); expect(scripts()).toHaveLength(1); install(); await act(async () => fireEvent.load(scripts()[0])); expect(maps.Map).toHaveBeenCalledOnce();
  });
  it('falls back when the loaded SDK is missing and allows a fresh retry', async () => {
    const View = view(); const { container } = render(<View />); await act(async () => fireEvent.load(scripts()[0])); expect(container.querySelector('svg')).toBeInTheDocument();
    fireEvent.click(screen.getByText('네이버 지도로 보기')); expect(scripts()).toHaveLength(1);
    install(); await act(async () => fireEvent.load(scripts()[0])); expect(maps.Map).toHaveBeenCalledOnce();
  });
  it('renders Canvas for SSR without window even with a key', () => {
    const View = view(); vi.stubGlobal('window', undefined); const html = renderToStaticMarkup(<View />);
    expect(html).toContain('<svg'); expect(html).not.toContain('네이버 가게 위치 지도'); expect(maps.Map).not.toHaveBeenCalled();
  });
  it('still switches maps when localStorage is denied', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); }); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    install(); const View = view(); const { container } = render(<View />); await waitFor(() => expect(maps.Map).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('우리 지도로 보기')); expect(container.querySelector('svg')).toBeInTheDocument();
  });
  it('supports paths-only projections with zero coordinate shops', async () => {
    install(); const View = view({ ...data, stores: [], boundary: null, paths: [{ id: 1, name: '시장길', named: true, source: 'OSM', geometry: [[37.5, 127], [37.501, 127.001]] }] });
    render(<View />); await waitFor(() => expect(maps.Map).toHaveBeenCalledOnce()); expect(maps.Marker).toHaveBeenCalledWith(expect.objectContaining({ title: '시장길' }));
  });
  it('requests English SDK labels after a Korean SDK was loaded', async () => {
    const Korean = view(); const first = render(<Korean />); install(); await act(async () => fireEvent.load(scripts()[0])); first.unmount();
    const English = view(data, 'en'); render(<English />); expect(scripts()).toHaveLength(1); expect(scripts()[0].src).toContain('language=en');
    await act(async () => fireEvent.load(scripts()[0])); expect(screen.getByRole('group', { name: 'Naver shop location map' })).toBeInTheDocument();
  });
});
