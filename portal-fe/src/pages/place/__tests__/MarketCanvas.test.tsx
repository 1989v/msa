import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MarketResponse, MarketStore } from '../../../api/marketApi';
import { groupMarketPins, projectMarketPins } from '../marketView';
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
function mount(stores = [store(), store({ id: 2, name: '두번째', longitude: 127.00005 })], width = 600) {
  const projection = projectMarketPins(groupMarketPins(stores), data)!;
  function Canvas() {
    const [key, setKey] = useState<string | null>(null);
    return <MarketCanvas data={data} lang="ko" projection={projection} points={projection.points} hasGeometry query="가게" selectedKey={key} onSelect={setKey} color={() => 'var(--market-zone-1)'} pathColor={() => undefined} />;
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
    expect(box()).toEqual([120, 88, 300, 220]);
    const worldToScreen = (x: number, y: number) => [(x - box()[0]) * 600 / box()[2], (y - box()[1]) * 440 / box()[3]];
    expect(worldToScreen(300, 216)).toEqual([360, 256]);
    expect(pin.querySelector('.place-market-pin-hit-area')).toHaveAttribute('r', '22');
    expect(container.querySelector('.place-market-path-label')).toHaveAttribute('transform', 'translate(300 216) scale(0.5)');
    expect(container.querySelector('.place-market-scale')!.parentElement).toHaveAttribute('transform', 'translate(120 308) scale(0.5)');
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
