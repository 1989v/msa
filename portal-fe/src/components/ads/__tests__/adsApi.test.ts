import { describe, expect, it } from 'vitest';
import { parseAd, parseDecisions } from '../adsApi';
import { bannerAd, decisionBody, paidAd } from './adsTestKit';

/** C1 — 결정 응답의 광고 형태. 형태를 싣기 전의 광고 서버와도 함께 돈다. */
describe('parseAd — 광고 형태', () => {
  it('형태가 없으면 카드로 받는다', () => {
    expect(parseAd(paidAd())?.format).toBe('CARD');
    expect(parseAd(paidAd({ format: null }))?.format).toBe('CARD');
  });

  it('띠배너는 설명이 비어도 받는다', () => {
    const ad = parseAd(bannerAd());
    expect(ad).not.toBeNull();
    expect(ad?.format).toBe('BANNER');
    expect(ad?.title).toBe('가을 원서 모임 — 첫 달 무료');
    expect(ad?.body).toBe('');
  });

  it('모르는 형태는 광고를 버린다', () => {
    expect(parseAd(paidAd({ format: 'VIDEO' }))).toBeNull();
    expect(parseAd(paidAd({ format: 'banner' }))).toBeNull();
  });

  it('결정 응답을 읽을 때도 같은 판정이다 — 모르는 형태 지면은 유료 없음', () => {
    const byKey = parseDecisions(
      decisionBody([
        { placementKey: 'blog-post-end', ad: paidAd({ format: 'VIDEO' }) },
        { placementKey: 'game-list-banner', ad: bannerAd() },
      ]),
    );
    expect(byKey.get('blog-post-end')?.ad).toBeNull();
    expect(byKey.get('game-list-banner')?.ad?.format).toBe('BANNER');
  });
});
