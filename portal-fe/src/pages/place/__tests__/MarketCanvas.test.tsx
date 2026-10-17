import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MarketBasemapMeta, MarketResponse, MarketStore } from '../../../api/marketApi';
import { groupMarketPins, marketBasemapFrame, projectMarketPins } from '../marketView';
import MarketCanvas from '../MarketCanvas';

const store = (overrides: Partial<MarketStore> = {}): MarketStore => ({
  id: 1, name: '가게', items: null, zoneId: null, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT',
  manual: false, actorKind: null, relativePosition: null, positionNote: null, ...overrides,
});
const data: MarketResponse = {
  market: { name: '시장', marketType: 'STREET', sourceMarketType: null, storeCountRaw: null, openingCycle: null, facilities: null, attribution: null },
  zones: [], stores: [],
  boundary: { source: 'OSM', polygon: [[37.499, 126.999], [37.501, 126.999], [37.501, 127.001], [37.499, 127.001]] },
  paths: [{ id: 1, name: '시장길', named: true, source: 'OSM', geometry: [[37.499, 127], [37.501, 127]] }],
};
function mount(stores = [store(), store({ id: 2, name: '두번째', longitude: 127.00005 })], width = 600, focusStoreId?: number) {
  const projection = projectMarketPins(groupMarketPins(stores), data)!;
  function Canvas() {
    const [key, setKey] = useState<string | null>(null);
    return <MarketCanvas data={data} lang="ko" projection={projection} points={projection.points} hasGeometry query="가게" focusStoreId={focusStoreId} selectedKey={key} onSelect={setKey} color={() => 'var(--market-zone-1)'} pathColor={() => undefined} />;
  }
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width, height: width * 440 / 600, right: width + 10, bottom: 20 + width * 440 / 600, x: 10, y: 20, toJSON: () => ({}) });
  const result = render(<Canvas />);
  const svg = result.container.querySelector('svg')!;
  const box = () => svg.getAttribute('viewBox')!.split(' ').map(Number);
  return { ...result, svg, box };
}
beforeEach(() => {
  // jsdom lacks PointerEvent; preserve pointer identities/types in dispatched events.
  class TestPointerEvent extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, options: PointerEventInit = {}) { super(type, options); this.pointerId = options.pointerId ?? 1; this.pointerType = options.pointerType ?? 'mouse'; }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('MarketCanvas navigation and shared SVG coordinates', () => {
  it('merges nearby parcels at 24 screen pixels and splits them at zoom 8', () => {
    const { container } = mount();
    expect(container.querySelectorAll('.place-market-pin')).toHaveLength(1);
    expect(container.querySelector('.place-market-pin text')).toHaveTextContent('2');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(container.querySelectorAll('.place-market-pin')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '확대' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(container.querySelectorAll('.place-market-pin')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(container.querySelectorAll('.place-market-pin')).toHaveLength(1);
  });
  it('zooms the buttons towards the shop-weighted centre of the pins, not the empty view centre', () => {
    // Both pins sit in the south-west corner of the boundary; the view centre has nothing.
    const stores = [store({ latitude: 37.4992, longitude: 126.9992 }), store({ id: 2, name: '옆집', latitude: 37.4993, longitude: 126.9993 })];
    const { box } = mount(stores);
    const projection = projectMarketPins(groupMarketPins(stores), data)!;
    const pin = projection.points[0];
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '확대' }));
    const [x, y, w, h] = box();
    expect(w).toBeCloseTo(75);
    expect(pin.x).toBeGreaterThanOrEqual(x);
    expect(pin.x).toBeLessThanOrEqual(x + w);
    expect(pin.y).toBeGreaterThanOrEqual(y);
    expect(pin.y).toBeLessThanOrEqual(y + h);
  });
  it('uses actual rendered pixels for responsive screen-distance merging', () => {
    const stores = [store(), store({ id: 2, name: '다른', longitude: 127.0003 })];
    const first = mount(stores, 600);
    expect(first.container.querySelectorAll('.place-market-pin')).toHaveLength(2);
    first.unmount();
    const second = mount(stores, 300);
    expect(second.container.querySelectorAll('.place-market-pin')).toHaveLength(1);
  });
  it('zooms with wheel without ctrl around its cursor, clamps 1–8, and resets', () => {
    const { svg, box } = mount();
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -Math.log(2) / 0.002, clientX: 160, clientY: 130 });
    fireEvent(svg, event);
    expect(event.defaultPrevented).toBe(true);
    expect(box()[0]).toBeCloseTo(75); expect(box()[1]).toBeCloseTo(55); expect(box()[2]).toBeCloseTo(300);
    fireEvent.wheel(svg, { deltaY: -100000, clientX: 310, clientY: 240 });
    expect(box()[2]).toBe(75);
    fireEvent.wheel(svg, { deltaY: 100000 }); expect(box()[2]).toBe(600);
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' })); expect(box()).toEqual([0, 0, 600, 440]);
  });
  it('pans with drag and shares one inverse-scaled transform for hit area and visible pin', () => {
    const { svg, container, box } = mount([store()]);
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    const pin = container.querySelector('.place-market-pin')!;
    expect(pin).toHaveAttribute('transform', 'translate(300 216) scale(0.5)');
    expect(pin.querySelector('.place-market-dot')!.parentElement).toBe(pin);
    expect(pin.querySelector('.place-market-pin-hit-area')!.parentElement).toBe(pin);
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 110, clientY: 120 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 170, clientY: 164 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    // The button zoomed around the only pin (300, 216), so the view sits 2 units above the centre-anchored one.
    expect(box()).toEqual([120, 86, 300, 220]);
    const worldToScreen = (x: number, y: number) => [(x - box()[0]) * 600 / box()[2], (y - box()[1]) * 440 / box()[3]];
    expect(worldToScreen(300, 216)).toEqual([360, 260]);
    expect(pin.querySelector('.place-market-pin-hit-area')).toHaveAttribute('r', '22');
    expect(container.querySelector('.place-market-path-label')).toHaveAttribute('transform', 'translate(300 216) scale(0.5)');
    expect(container.querySelector('.place-market-scale')!.parentElement).toHaveAttribute('transform', 'translate(120 306) scale(0.5)');
  });
  it('pinches with two fingers and double taps exactly twice even when a browser emits dblclick', () => {
    const { svg, box } = mount();
    fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 210, clientY: 240 });
    fireEvent.pointerDown(svg, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 410, clientY: 240 });
    fireEvent.pointerMove(svg, { pointerId: 2, pointerType: 'touch', clientX: 610, clientY: 240 });
    expect(box()[2]).toBe(300);
    fireEvent.pointerCancel(svg, { pointerId: 1 }); fireEvent.pointerCancel(svg, { pointerId: 2 });
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(svg, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 310, clientY: 240 });
      fireEvent.pointerUp(svg, { pointerId: 3, pointerType: 'touch', clientX: 310, clientY: 240 });
    }
    expect(box()[2]).toBe(300);
    fireEvent.doubleClick(svg, { detail: 2, clientX: 310, clientY: 240 });
    expect(box()[2]).toBe(300);
  });
  it('keeps native pin click targets and opens the shared selection with Enter and Space', () => {
    const { svg } = mount();
    const capture = vi.fn(); svg.setPointerCapture = capture;
    const pin = screen.getByRole('button', { name: /같은 필지 가게:/ });
    const capturePin = vi.fn(); pin.setPointerCapture = capturePin;
    fireEvent.pointerDown(pin.querySelector('.place-market-dot')!, { pointerId: 1, button: 0 });
    expect(capture).not.toHaveBeenCalled();
    expect(capturePin).toHaveBeenCalledWith(1);
    fireEvent.pointerUp(pin, { pointerId: 1 });
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(screen.getByRole('region', { name: '선택한 가게' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 가게 보기' }));
    fireEvent.keyDown(pin, { key: ' ' });
    expect(within(screen.getByRole('region', { name: '선택한 가게' })).getAllByRole('listitem')).toHaveLength(2);
  });
  it('preserves the selected multi-parcel list and highlights its child pins after zoom splits it', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: /같은 필지 가게:/ }));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(container.querySelectorAll('.place-market-pin[data-selected]')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: '선택한 가게' })).getAllByRole('listitem')).toHaveLength(2);
  });
  it('sorts building numbers naturally before floor and unit, and uses names without location details', () => {
    mount([
      store({ id: 1, name: '열번째', buildingName: '상가10', floor: '1', ho: '1' }),
      store({ id: 2, name: '이층', buildingName: '상가2', floor: '2', ho: '1' }),
      store({ id: 3, name: '일층10호', buildingName: '상가2', floor: '1', ho: '10' }),
      store({ id: 4, name: '일층2호', buildingName: '상가2', floor: '1', ho: '2' }),
      store({ id: 5, name: '가게10' }), store({ id: 6, name: '가게2' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /같은 필지 가게:/ }));
    expect(within(screen.getByRole('region', { name: '선택한 가게' })).getAllByRole('listitem').map((row) => row.querySelector('strong')!.textContent))
      .toEqual(['가게2', '가게10', '일층2호', '일층10호', '이층', '열번째']);
  });
  it('naturally sorts building, floor and unit, falls back to name, and shows 50 more rows above 200', () => {
    const stores = Array.from({ length: 201 }, (_, i) => store({ id: i, name: `가게 ${201 - i}`, jibunAddress: '한 필지',
      buildingName: '상가', floor: i === 0 ? 'B1' : '1', ho: String(201 - i) }));
    const { container } = mount(stores);
    fireEvent.click(screen.getByRole('button', { name: /같은 필지 가게:/ }));
    const sheet = screen.getByRole('region', { name: '선택한 가게' });
    let rows = within(sheet).getAllByRole('listitem'); expect(rows).toHaveLength(50);
    expect(rows[0]).toHaveTextContent('가게 201'); expect(rows[1]).toHaveTextContent('가게 1'); expect(rows[2]).toHaveTextContent('가게 2');
    fireEvent.click(within(sheet).getByRole('button', { name: '더 보기' }));
    rows = within(sheet).getAllByRole('listitem'); expect(rows).toHaveLength(100);
    expect(rows[0]).toHaveAttribute('data-found', 'true');
    expect(container.querySelectorAll('.place-market-pin')).toHaveLength(1);
  });
});


describe('MarketCanvas result focus', () => {
  it('selects the current zoom-four cluster rather than the original merged group', () => {
    const { container, box } = mount([store({ id: 1, name: '원래묶음' }), store({ id: 2, name: '목표', longitude: 127.00015 })], 600, 2);
    expect(box().slice(2)).toEqual([150, 110]);
    expect(container.querySelectorAll('.place-market-pin')).toHaveLength(2);
    const sheet = screen.getByRole('region', { name: '선택한 가게' });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(1);
    expect(within(sheet).getByText('목표').closest('li')).toHaveAttribute('data-selected', 'true');
    expect(within(sheet).queryByText('원래묶음')).not.toBeInTheDocument();
  });
  it('reveals and scrolls a target after the first fifty rows in a large parcel', () => {
    const scroll = vi.fn(); const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      mount(Array.from({ length: 251 }, (_, index) => store({ id: index + 1, name: `가게 ${index + 1}`, jibunAddress: '한 필지', ho: String(index + 1) })), 600, 231);
      const sheet = screen.getByRole('region', { name: '선택한 가게' });
      expect(within(sheet).getAllByRole('listitem')).toHaveLength(250);
      const target = within(sheet).getByText('가게 231').closest('li')!;
      expect(target).toHaveAttribute('data-selected', 'true');
      expect(target).toHaveStyle({ outline: '2px solid var(--ko-accent-text)' });
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scroll.mock.instances).toContain(target);
      fireEvent.click(within(sheet).getByRole('button', { name: '더 보기' }));
      expect(within(sheet).getAllByRole('listitem')).toHaveLength(251);
    } finally { HTMLElement.prototype.scrollIntoView = previous; }
  });
});


describe('market raster basemap', () => {
  const mapped: MarketResponse = { ...data, market: { ...data.market, contentId: '1059391', latitude: 37.562, longitude: 126.981 },
    boundary: { source: 'OSM', polygon: [[37.55, 126.97], [37.57, 126.97], [37.56, 127], [37.55, 126.97]] },
    entrances: [{ id: 1, pathId: null, lat: 37.56, lng: 126.98, label: '입구', source: 'OSM' }], stores: [store()] };
  const url = (theme: string, id = '1059391') => `/basemaps/markets/${id}/z18-${theme}.png`;
  const meta: MarketBasemapMeta = { contentId: '1059391', centre: { latitude: 37.561, longitude: 126.984 }, zoom: 17, width: 1024, height: 768, bounds: marketBasemapFrame([37.561, 126.984], 17, 1024, 768), renderedAt: '2026-10-17T00:00:00Z', styleVersion: 'v1', themes: ['light', 'dark'] };
  function canvas(value = mapped, basemapMeta: MarketBasemapMeta | null = meta) {
    const projection = projectMarketPins(groupMarketPins(value.stores), value)!;
    return <MarketCanvas basemapMeta={basemapMeta} data={value} lang="ko" projection={projection} points={projection.points} hasGeometry query="가게" selectedKey={null} onSelect={vi.fn()} color={() => 'var(--market-zone-1)'} pathColor={() => undefined}
      userPosition={{ latitude: 37.56, longitude: 126.98, accuracy: 10, timestamp: 1 }} basemapAttribution={<p>Basemap credit</p>} />;
  }
  afterEach(() => { cleanup(); document.documentElement.removeAttribute('data-theme'); });
  it('projects raster corners from the metadata bounds independently of response and boundary centres', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(canvas());
    const projection = projectMarketPins(groupMarketPins(mapped.stores), mapped)!;
    const frame = marketBasemapFrame([meta.centre.latitude, meta.centre.longitude], meta.zoom, meta.width, meta.height);
    const nw = projection.project([frame.north, frame.west]);
    const se = projection.project([frame.south, frame.east]);
    const svg = container.querySelector('svg')!; const image = svg.querySelector('image')!;
    expect(svg.firstElementChild).toBe(image);
    expect(image).toHaveAttribute('href', url('light'));
    for (const [attr, value] of Object.entries({ x: nw.x, y: nw.y, width: se.x - nw.x, height: se.y - nw.y })) expect(Number(image.getAttribute(attr))).toBeCloseTo(value, 7);
    expect(image).toHaveAttribute('preserveAspectRatio', 'none');
  });
  it('keeps the SVG without metadata or an available theme and ignores missing response centres', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, rerender } = render(canvas(mapped, null));
    expect(container.querySelector('image')).toBeNull();
    expect(container.querySelector('.place-market-path')).not.toBeNull();
    rerender(canvas(mapped, { ...meta, themes: ['dark'] }));
    expect(container.querySelector('image')).toBeNull();
    await act(async () => { document.documentElement.dataset.theme = 'dark'; });
    expect(container.querySelector('image')).toHaveAttribute('href', url('dark'));
    rerender(canvas({ ...mapped, boundary: null, market: { ...mapped.market, contentId: null, latitude: null, longitude: null } }));
    expect(container.querySelector('image')).toHaveAttribute('href', url('dark'));
    rerender(canvas(mapped, null));
    expect(container.querySelector('image')).toBeNull();
    expect(screen.queryByText('Basemap credit')).toBeNull();
  });
  it('shows fallback until load, preserves overlays, then restores lines and credit on error', () => {
    const { container } = render(canvas()); const image = container.querySelector('image')!;
    expect(image).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelector('.place-market-path')).not.toBeNull();
    expect(container.querySelector('.place-market-path-label')).not.toBeNull();
    expect(screen.queryByText('Basemap credit')).toBeNull();
    fireEvent.load(image);
    expect(image).toHaveAttribute('visibility', 'visible');
    expect(container.querySelector('.place-market-path')).toBeNull();
    expect(container.querySelector('.place-market-path-label')).toBeNull();
    for (const selector of ['.place-market-boundary', '.place-market-entrance', '.place-market-pin', '.place-market-user', '.place-market-hit-label', '.place-market-direction', '.place-market-scale']) expect(container.querySelector(selector)).not.toBeNull();
    expect(screen.getByText('Basemap credit').parentElement).toHaveClass('place-market-canvas');
    fireEvent.error(image);
    expect(image).toHaveAttribute('visibility', 'hidden');
    expect(container.querySelector('.place-market-path')).not.toBeNull();
    expect(screen.queryByText('Basemap credit')).toBeNull();
  });
  it('switches theme and market URLs with immediate fallback and ignores stale load/error events', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, rerender } = render(canvas()); const old = container.querySelector('image')!;
    fireEvent.load(old);
    await act(async () => { document.documentElement.dataset.theme = 'dark'; });
    const dark = container.querySelector('image')!;
    expect(dark).toHaveAttribute('href', url('dark')); expect(dark).toHaveAttribute('visibility', 'hidden');
    expect(screen.queryByText('Basemap credit')).toBeNull();
    fireEvent.load(old); expect(dark).toHaveAttribute('visibility', 'hidden');
    fireEvent.load(dark); fireEvent.error(old); expect(dark).toHaveAttribute('visibility', 'visible');
    rerender(canvas({ ...mapped, market: { ...mapped.market, contentId: 'another' } }, { ...meta, contentId: 'another' }));
    const another = container.querySelector('image')!;
    expect(another).toHaveAttribute('href', url('dark', 'another')); expect(another).toHaveAttribute('visibility', 'hidden');
    expect(screen.queryByText('Basemap credit')).toBeNull();
    fireEvent.load(dark); expect(another).toHaveAttribute('visibility', 'hidden');
    await act(async () => { document.documentElement.dataset.theme = 'light'; });
    expect(container.querySelector('image')).toHaveAttribute('visibility', 'hidden');
  });
  it('uses media changes only without an explicit html theme and does not mutate html', async () => {
    let listener: () => void = () => {}; const media = { matches: false, addEventListener: vi.fn((_type, fn) => { listener = fn; }), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    const { container } = render(canvas());
    expect(container.querySelector('image')).toHaveAttribute('href', url('light'));
    act(() => { media.matches = true; listener(); });
    expect(container.querySelector('image')).toHaveAttribute('href', url('dark'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    await act(async () => { document.documentElement.dataset.theme = 'light'; });
    act(() => { listener(); }); expect(container.querySelector('image')).toHaveAttribute('href', url('light'));
    await act(async () => { document.documentElement.removeAttribute('data-theme'); });
    expect(container.querySelector('image')).toHaveAttribute('href', url('dark'));
  });
  it('keeps image geometry fixed while zoom and pan change only the shared viewBox', () => {
    const { container } = render(canvas()); const svg = container.querySelector('svg')!; const image = svg.querySelector('image')!;
    fireEvent.load(image);
    const geometry = () => ['x', 'y', 'width', 'height'].map((attr) => image.getAttribute(attr));
    const before = geometry(); const initialView = svg.getAttribute('viewBox');
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(svg.getAttribute('viewBox')).not.toBe(initialView); expect(geometry()).toEqual(before);
    const zoomed = svg.getAttribute('viewBox');
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 160, clientY: 140 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(svg.getAttribute('viewBox')).not.toBe(zoomed); expect(geometry()).toEqual(before);
  });
});
