import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarketNaverMap from '../MarketNaverMap';

const props = {
  contentId: '132180', lang: 'ko' as const, keyId: 'test-key',
  centre: { latitude: 37.56, longitude: 126.98 },
  pins: [
    { key: 'one', latitude: 37.56, longitude: 126.98, count: 3, color: 'var(--ko-accent-primary)', label: '<가게>' },
    { key: 'two', latitude: 37.561, longitude: 126.981, count: 1, color: '--ko-accent-secondary', label: '두 번째 가게' },
  ],
};
function sdk() {
  const destroy = vi.fn(); const setCenter = vi.fn(); const setMap = vi.fn();
  return {
    destroy, setCenter, setMap,
    Map: vi.fn(function (...args: [HTMLElement, unknown]) { void args; return { destroy, setCenter }; }),
    LatLng: vi.fn(function (latitude: number, longitude: number) { return { latitude, longitude }; }),
    Marker: vi.fn(function (...args: [{ icon: { content: HTMLElement }; title?: string }]) { void args; return { setMap }; }),
    Polyline: vi.fn(function (...args: [unknown]) { void args; return { setMap }; }),
  };
}
let maps: ReturnType<typeof sdk>;
const install = () => Object.defineProperty(window, 'naver', { configurable: true, value: { maps } });
const scripts = () => document.querySelectorAll<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
beforeEach(() => { maps = sdk(); });
afterEach(() => {
  cleanup(); scripts().forEach((script) => script.remove()); Reflect.deleteProperty(window, 'naver');
});

describe('MarketNaverMap', () => {
  it('inserts the SDK once across concurrent mounts and reuses it on remount', async () => {
    const first = render(<MarketNaverMap {...props} />);
    const second = render(<MarketNaverMap {...props} />);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toBe('https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=test-key&language=ko');
    install();
    await act(async () => { fireEvent.load(scripts()[0]); });
    expect(maps.Map).toHaveBeenCalledTimes(2);
    first.unmount(); second.unmount();
    render(<MarketNaverMap {...props} />);
    await waitFor(() => expect(maps.Map).toHaveBeenCalledTimes(3));
    expect(scripts()).toHaveLength(1);
  });

  it('reuses the SDK, draws one safe HTML icon per pin, and destroys the map', async () => {
    install();
    const { unmount } = render(<MarketNaverMap {...props} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledTimes(props.pins.length));
    expect(scripts()).toHaveLength(0);
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), { center: props.centre, zoom: 17 });
    const options = maps.Marker.mock.calls[0][0];
    expect(options.icon.content.textContent).toBe('3');
    expect(options.icon.content.style.background).toBe('var(--ko-accent-primary)');
    expect(maps.Marker.mock.calls[1][0].icon.content.style.background).toBe('var(--ko-accent-secondary)');
    expect(options.title).toBe('<가게>');
    expect(options.icon.content.querySelector('가게')).toBeNull();
    unmount();
    expect(maps.destroy).toHaveBeenCalledOnce();
    expect(maps.setMap).toHaveBeenCalledWith(null);
  });

  it('renders and loads nothing for an empty key', () => {
    const { container } = render(<MarketNaverMap {...props} keyId="" />);
    expect(container).toBeEmptyDOMElement();
    expect(scripts()).toHaveLength(0);
    expect(maps.Map).not.toHaveBeenCalled();
  });

  it('synchronizes centre, boundary, pins and user position without replacing the map', async () => {
    install();
    const { rerender } = render(<MarketNaverMap {...props} />);
    await waitFor(() => expect(maps.Marker).toHaveBeenCalledTimes(2));
    maps.Marker.mockClear(); maps.setMap.mockClear();
    const centre = { latitude: 37.57, longitude: 127 };
    rerender(<MarketNaverMap {...props} centre={centre} pins={props.pins.slice(0, 1)}
      boundary={[[37.56, 126.98], [37.57, 127]]} userPosition={{ ...centre, accuracy: 15 }} />);
    await waitFor(() => expect(maps.Polyline).toHaveBeenCalledOnce());
    expect(maps.Map).toHaveBeenCalledOnce();
    expect(maps.setCenter).toHaveBeenLastCalledWith(centre);
    expect(maps.setMap).toHaveBeenCalledTimes(2);
    expect(maps.Marker).toHaveBeenCalledTimes(2);
  });

  it('does not create a map after unmount during SDK loading', async () => {
    const { unmount } = render(<MarketNaverMap {...props} />);
    const script = scripts()[0];
    unmount(); install();
    await act(async () => { fireEvent.load(script); });
    expect(maps.Map).not.toHaveBeenCalled();
  });

  it('uses the latest props after SDK loading and tears down when the key is cleared', async () => {
    const { rerender, container } = render(<MarketNaverMap {...props} />);
    const centre = { latitude: 37.6, longitude: 127.1 };
    rerender(<MarketNaverMap {...props} centre={centre} pins={props.pins.slice(0, 1)} />);
    install();
    await act(async () => { fireEvent.load(scripts()[0]); });
    expect(maps.setCenter).toHaveBeenLastCalledWith(centre);
    expect(maps.Marker).toHaveBeenCalledOnce();
    rerender(<MarketNaverMap {...props} keyId="" />);
    expect(container).toBeEmptyDOMElement();
    expect(maps.destroy).toHaveBeenCalledOnce();
    expect(maps.setMap).toHaveBeenCalledWith(null);
  });

  it('shows a localized SDK load failure', async () => {
    render(<MarketNaverMap {...props} lang="en" />);
    await act(async () => { fireEvent.error(scripts()[0]); });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Naver Map.');
    expect(maps.Map).not.toHaveBeenCalled();
  });
});
