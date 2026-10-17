import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MarketResponse } from '../../../api/marketApi';
import MarketLocate from '../MarketLocate';
import MarketCanvas from '../MarketCanvas';
import { projectMarketPins } from '../marketView';

const data: MarketResponse = {
  market: { name: '시장', marketType: 'STREET', sourceMarketType: null, storeCountRaw: null, openingCycle: null, facilities: null, attribution: null },
  zones: [], stores: [],
  boundary: { source: 'OSM', polygon: [[37.499, 126.999], [37.501, 126.999], [37.501, 127.001], [37.499, 127.001]] },
};
const position = (latitude = 37.5, longitude = 127): GeolocationPosition => ({ coords: { latitude, longitude, accuracy: 12, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: 1_760_000_000_000 } as GeolocationPosition);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mockLocation() {
  const request = vi.fn();
  vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition: request } as unknown as Geolocation);
  return request;
}
// jsdom has no geolocation property, so provide a configurable getter for each test.
Object.defineProperty(navigator, 'geolocation', { configurable: true, get: () => undefined });

describe('MarketLocate', () => {
  it('requests only on click with high accuracy and a ten-second timeout, then shows time and accuracy and allows retry', () => {
    const request = mockLocation(); const onPosition = vi.fn();
    render(<MarketLocate data={data} lang="ko" onPosition={onPosition} />);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '내 위치' }));
    expect(request).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    expect(screen.getByRole('button')).toBeDisabled();
    act(() => request.mock.calls[0][0](position()));
    expect(onPosition).toHaveBeenCalledWith({ latitude: 37.5, longitude: 127, accuracy: 12, timestamp: position().timestamp });
    expect(screen.getByText('시장 안입니다')).toBeInTheDocument();
    expect(screen.getByText(/정확도 ±12 m/)).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('dateTime', new Date(position().timestamp).toISOString());
    fireEvent.click(screen.getByRole('button', { name: '다시 재기' }));
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each([[1, '위치 권한이 거부되었습니다'], [3, '10초 안에 위치를 확인하지 못했습니다'], [2, '현재 위치를 확인할 수 없습니다']])('shows geolocation error %s and permits retry', (code, message) => {
    const request = mockLocation(); render(<MarketLocate data={data} lang="ko" onPosition={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '내 위치' }));
    act(() => request.mock.calls[0][1]({ code }));
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: '다시 재기' })).toBeEnabled();
  });
  it('reports unsupported geolocation only after clicking', () => {
    render(<MarketLocate data={data} lang="ko" onPosition={vi.fn()} />);
    expect(screen.queryByText(/지원하지/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '내 위치' }));
    expect(screen.getByRole('status')).toHaveTextContent('이 브라우저는 위치 확인을 지원하지 않습니다');
  });
  it('still returns a measured position when neither boundary nor market centre is supplied', () => {
    const request = mockLocation(); const onPosition = vi.fn();
    render(<MarketLocate data={{ ...data, boundary: null }} lang="ko" onPosition={onPosition} />);
    fireEvent.click(screen.getByRole('button', { name: '내 위치' }));
    act(() => request.mock.calls[0][0](position()));
    expect(onPosition).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('시장 중심 위치가 없어 거리 안내를 표시할 수 없습니다');
    expect(screen.getByRole('status')).toHaveTextContent('정확도 ±12 m');
  });
  it('shows the user-to-market direction and distance outside the market in English', () => {
    const request = mockLocation(); render(<MarketLocate data={data} lang="en" onPosition={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'My location' }));
    act(() => request.mock.calls[0][0](position(37.49, 126.99)));
    expect(screen.getByRole('status')).toHaveTextContent(/Market centre: \d+ m · NE/);
  });
});

describe('MarketCanvas user location viewport', () => {
  const projection = projectMarketPins([], data)!;
  const canvas = (userPosition: { latitude: number; longitude: number; accuracy: number; timestamp: number }) => <MarketCanvas data={data} lang="ko" projection={projection} points={[]} hasGeometry query="" selectedKey={null} onSelect={vi.fn()} color={() => ''} userPosition={userPosition} />;
  it('connects a button measurement to the map and clears it when the market changes without requesting again', () => {
    const request = mockLocation();
    const props = { lang: 'ko' as const, projection, points: [], hasGeometry: true, query: '', selectedKey: null, onSelect: vi.fn(), color: () => '', pathColor: () => undefined };
    const { container, rerender } = render(<MarketCanvas {...props} data={data} />);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '내 위치' }));
    act(() => request.mock.calls[0][0](position()));
    expect(container.querySelector('.place-market-user-dot')).not.toBeNull();
    rerender(<MarketCanvas {...props} data={{ ...data, market: { ...data.market, id: 2 } }} />);
    expect(container.querySelector('.place-market-user-dot')).toBeNull();
    expect(screen.getByRole('button', { name: '내 위치' })).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('renders a point and an accuracy circle inside the viewBox, and an edge arrow outside after zoom', () => {
    const userPosition = { latitude: 37.5008, longitude: 127, accuracy: 12, timestamp: 0 };
    const { container } = render(canvas(userPosition));
    expect(container.querySelector('.place-market-user-dot')).not.toBeNull();
    expect(Number(container.querySelector('.place-market-user-accuracy')?.getAttribute('r'))).toBeCloseTo(projection.scale100m * 0.12);
    expect(container.querySelector('.place-market-user-edge')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(container.querySelector('.place-market-user-dot')).toBeNull();
    expect(container.querySelector('.place-market-user-edge')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(container.querySelector('.place-market-user-dot')).not.toBeNull();
  });
  it('clamps an offscreen location arrow to the edge and keeps it separate from the actual point', () => {
    const { container } = render(canvas({ latitude: 37.49, longitude: 126.99, accuracy: 20, timestamp: 0 }));
    expect(container.querySelector('.place-market-user-dot')).toBeNull();
    expect(container.querySelector('.place-market-user-accuracy')).toBeNull();
    expect(container.querySelector('.place-market-user-edge')).toHaveAttribute('transform', expect.stringContaining('translate('));
  });
});
