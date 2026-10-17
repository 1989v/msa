import { describe, expect, it, vi } from 'vitest';
import { marketMapMeta, marketMapPath, PLACE_BRAND_EN, PLACE_BRAND_KO } from '../copy.mjs';
import { fetchMarketSitemapContentIds, indexDoc, marketMapSitemapEntries, placeSitemapFiles } from '../../../scripts/prerender-seo.mjs';
const market = { market: { name: '광명시장' }, stores: [{}, {}], zones: [{ children: [{ children: [] }] }] };
describe('dedicated market map SEO', () => {
  it('owns bilingual canonical URLs without search state and only declares actual alternate pairs', () => {
    expect(marketMapPath('en', '8')).toBe('/en/attractions/8/market');
    const ko = marketMapMeta('ko', { id: '7', lang: 'ko', alternateId: '8' }, market);
    expect(ko.title).toBe(`광명시장 가게 지도 | ${PLACE_BRAND_KO}`);
    expect(ko.description).toContain('가게 2곳, 구역 2개');
    expect(ko.canonical).toBe('https://place.1989v.com/attractions/7/market');
    expect(ko.alternates).toEqual([{ hreflang: 'ko', href: ko.canonical }, { hreflang: 'en', href: 'https://place.1989v.com/en/attractions/8/market' }, { hreflang: 'x-default', href: 'https://place.1989v.com/en/attractions/8/market' }]);
    expect(marketMapMeta('en', { id: '8', lang: 'en', title: 'Gwangmyeong' }, market).title).toBe(`Gwangmyeong market map | ${PLACE_BRAND_EN}`);
    expect(marketMapMeta('ko', { id: '7' }, market).alternates).toEqual([]);
  });
  it('keeps market content IDs through index projection and detail sitemap rules, dates, pairing and grouping', () => {
    const ko = indexDoc({ id: '7', contentId: '100', title: '시장', overview: '소개', alternateId: '8', contentUpdatedAt: '2026-10-17T01:00:00', contentTypeId: '38' }, '11');
    const en = indexDoc({ id: '8', contentId: '200', title: 'Market', overview: 'About', alternateId: '7', contentTypeId: '79' }, '11');
    const places = { ko: [ko, { ...ko, id: '9', contentId: '999' }, { ...ko, id: '10', hasOverview: false }], en: [en] };
    const entries = marketMapSitemapEntries(places, ['100', '200']);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ loc: 'https://place.1989v.com/attractions/7/market', lastmod: '2026-10-17', priority: '0.6' });
    expect(entries[0].alternates?.map((link: { href: string }) => link.href)).toContain('https://place.1989v.com/en/attractions/8/market');
    expect(marketMapSitemapEntries(places, ['100'])[0].alternates).toBeUndefined();
    const files = placeSitemapFiles([], entries);
    expect(files.find(([name]) => name === 'sitemap-places-1.xml')?.[1]).toContain('/attractions/7/market');
    expect(marketMapSitemapEntries(places, [])).toEqual([]);
  });
  it('warns and returns an empty map index when the optional API is unavailable', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await fetchMarketSitemapContentIds(get)).toEqual([]);
    expect(get).toHaveBeenCalledWith('/api/v1/place/markets/content-ids');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('offline'));
    warning.mockRestore();
  });
});
