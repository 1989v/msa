import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMarketBasemapMeta, type MarketBasemapMeta } from '../marketApi';

afterEach(() => vi.unstubAllGlobals());

describe('market basemap metadata API', () => {
  it('reads raw metadata through the same-origin proxy with an encoded content ID', async () => {
    const meta: MarketBasemapMeta = { contentId: '100', centre: { latitude: 37.5, longitude: 127 }, zoom: 17, width: 1024, height: 768,
      bounds: { north: 38, south: 37, east: 128, west: 126 }, renderedAt: '2026-10-17T00:00:00Z', styleVersion: 'v1', themes: ['light'] };
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => meta });
    vi.stubGlobal('fetch', request);
    expect(await fetchMarketBasemapMeta('100/a')).toEqual(meta);
    expect(request).toHaveBeenCalledWith('/basemaps/markets/100%2Fa/meta.json');
  });
  it.each([404, 403, 500])('returns null for HTTP %i without attempting JSON parsing', async (status) => {
    const json = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json }));
    expect(await fetchMarketBasemapMeta('100')).toBeNull();
    expect(json).not.toHaveBeenCalled();
  });
  it('returns null for network and JSON decoding failures', async () => {
    const request = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } });
    vi.stubGlobal('fetch', request);
    expect(await fetchMarketBasemapMeta('100')).toBeNull();
    expect(await fetchMarketBasemapMeta('100')).toBeNull();
  });
});
