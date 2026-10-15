import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metric } from 'web-vitals';

const reporters = vi.hoisted(() => ({ onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn() }));
vi.mock('web-vitals', () => reporters);

let target: { location: URL; PerformanceObserver?: unknown; gtag?: ReturnType<typeof vi.fn>; __kgdWebVitals?: { initialHref: string; installed: boolean; stopped: boolean } };
const metric = (name = 'LCP', value = 1234): Metric => ({
  name, value, delta: value, rating: 'good', id: 'never-send-this-id', entries: [{ name: 'private element' }],
} as Metric);

function callback(name: keyof typeof reporters = 'onLCP'): (m: Metric) => void {
  return reporters[name].mock.calls[0][0];
}

async function install(href = 'https://game.1989v.com/en/games/block-burst', referrer = '') {
  target = { location: new URL(href), PerformanceObserver: class {}, gtag: vi.fn() };
  vi.stubGlobal('window', target);
  vi.stubGlobal('document', { referrer });
  const { installWebVitals } = await import('../webVitals');
  await installWebVitals(href);
  return installWebVitals;
}

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('document CWV via existing GA4', () => {
  it('registers each official reporter once, including repeated boot calls', async () => {
    const again = await install();
    await again(target.location.href);
    for (const reporter of Object.values(reporters)) expect(reporter).toHaveBeenCalledTimes(1);
    callback()(metric());
    expect(target.gtag).toHaveBeenCalledWith('event', 'web_vitals', {
      metric_name: 'LCP', metric_value: 1234, metric_delta: 1234, metric_rating: 'good',
      page_type: 'game_detail', page_lang: 'en', non_interaction: true,
      page_location: 'https://game.1989v.com/game_detail', page_referrer: '', page_title: 'game_detail',
    });
    expect(JSON.stringify(target.gtag!.mock.calls)).not.toMatch(/never-send|private element|block-burst/);
  });

  it('preserves CLS ratio units and INP milliseconds without rounding or attribution', async () => {
    await install('https://place.1989v.com/attractions/100');
    callback('onCLS')(metric('CLS', 0.023));
    callback('onINP')(metric('INP', 275));
    expect(target.gtag!.mock.calls.map((call) => call[2].metric_value)).toEqual([0.023, 275]);
    expect(target.gtag!.mock.calls[0][2]).toMatchObject({ page_type: 'place_detail', page_lang: 'ko' });
  });

  it.each([
    'https://game.1989v.com/?room=secret', 'https://game.1989v.com/#secret',
    'https://game.1989v.com/party', 'https://game.1989v.com/party/secret',
    'https://game.1989v.com/shared/token', 'https://game.1989v.com/login',
    'https://game.1989v.com/games/not-a-catalog-game', 'https://game.1989v.com/games/genre/unknown',
    'https://place.1989v.com/favorites', 'https://place.1989v.com/search',
    'https://resume.1989v.com/', 'https://1989v.com/', 'https://game.1989v.com.evil.example/',
    'http://game.1989v.com/', 'https://localhost/',
  ])('does not install on private or unknown initial URL: %s', async (href) => {
    await install(href);
    expect(reporters.onLCP).not.toHaveBeenCalled();
  });

  it.each([
    'https://1989v.com/shared/secret', 'https://resume.1989v.com/d/person',
    'https://game.1989v.com/login?next=%2Fshared%2Fsecret', 'invalid referrer',
  ])('honors excluded referrers: %s', async (referrer) => {
    await install('https://game.1989v.com/', referrer);
    expect(reporters.onLCP).not.toHaveBeenCalled();
  });

  it.each(['/party/secret', '/?invite=secret', '/#secret', '/games/mine-pioneer'])('drops reports after navigation: %s', async (path) => {
    await install();
    target.location = new URL(path, target.location);
    callback()(metric());
    expect(target.gtag).not.toHaveBeenCalled();
  });

  it('does not resume a document invalidated by the router, even on return to initial URL', async () => {
    await install();
    target.__kgdWebVitals!.stopped = true;
    callback()(metric());
    expect(target.gtag).not.toHaveBeenCalled();
  });

  it('rechecks analytics availability and isolates sender failures', async () => {
    await install();
    const sender = target.gtag!;
    target.gtag = undefined;
    callback()(metric());
    expect(sender).not.toHaveBeenCalled();
    target.gtag = vi.fn(() => { throw Error('analytics blocked'); });
    expect(() => callback()(metric())).not.toThrow();
  });

  it.each(['observer', 'ga'])('does not import/install when %s is absent at boot', async (missing) => {
    target = { location: new URL('https://game.1989v.com/'), gtag: vi.fn(), PerformanceObserver: class {} };
    if (missing === 'observer') delete target.PerformanceObserver;
    else delete target.gtag;
    vi.stubGlobal('window', target);
    const { installWebVitals } = await import('../webVitals');
    await installWebVitals(target.location.href);
    expect(reporters.onLCP).not.toHaveBeenCalled();
  });

  it('is safe on the server and with invalid metric values', async () => {
    vi.stubGlobal('window', undefined);
    const { installWebVitals } = await import('../webVitals');
    await expect(installWebVitals('https://game.1989v.com/')).resolves.toBeUndefined();
    vi.resetModules();
    await install();
    callback()(metric('LCP', NaN));
    callback()(metric('FCP'));
    expect(target.gtag).not.toHaveBeenCalled();
  });

  it('isolates reporter setup errors', async () => {
    reporters.onCLS.mockImplementationOnce(() => { throw Error('unsupported browser'); });
    await expect(install()).resolves.toBeTypeOf('function');
  });
});
