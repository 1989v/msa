import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdSlot from '../AdSlot';
import BannerAd from '../BannerAd';
import { resetAdsForTest, type PaidAd } from '../adsApi';
import { resetIdentityForTest, sessionId, visitorId } from '../../../analytics/identity';
import {
  advance, bannerAd, captureAdEvents, decisionBody, installDecisionAdapter, installIntersectionObserver, paidAd,
} from './adsTestKit';

/** C2 — 띠배너: 대체 텍스트·이미지 밖 「광고」·카드와 같은 링크와 가시 노출 기준. */

const banner = () => ({ ...bannerAd(), format: 'BANNER' }) as PaidAd;

describe('BannerAd', () => {
  let events: ReturnType<typeof captureAdEvents>;
  let io: ReturnType<typeof installIntersectionObserver>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetAdsForTest();
    resetIdentityForTest();
    io = installIntersectionObserver();
    events = captureAdEvents();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('이미지의 alt 는 대체 텍스트이고, 「광고 · 광고주」 는 이미지 밖 글자다', () => {
    const { container } = render(<BannerAd ad={banner()} />);

    const img = screen.getByRole('img');
    expect(img.getAttribute('alt')).toBe('가을 원서 모임 — 첫 달 무료');
    const mark = screen.getByText('광고');
    expect(img.contains(mark)).toBe(false);
    expect(mark.closest('.ad-banner-frame')).toBeNull();
    expect(container.querySelector('.ad-banner-meta')).toHaveTextContent('광고 · 스튜디오 모래시계');
  });

  it('클릭은 리다이렉터로, sponsored·새 탭 — 주소에 analytics 신원이 붙는다', () => {
    render(<BannerAd ad={banner()} />);

    const link = screen.getByRole('link');
    const href = new URL(link.getAttribute('href')!, 'https://game.1989v.com');
    expect(href.pathname).toBe('/api/v1/ads/click/clk-token');
    expect(href.searchParams.get('vid')).toBe(visitorId());
    expect(href.searchParams.get('sid')).toBe(sessionId());
    expect(link.getAttribute('rel')).toBe('sponsored nofollow noopener');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('면적 50% 미만이거나 1초를 못 채우면 노출이 아니다', async () => {
    render(<BannerAd ad={banner()} />);
    io.show(0.4);
    await advance(5_000);
    io.show(0.6);
    await advance(999);
    io.show(0);
    await advance(5_000);

    expect(events.tokens()).toEqual([]);
  });

  it('면적 50% 이상으로 1초 보이면 노출 토큰을 한 번 보낸다', async () => {
    render(<BannerAd ad={banner()} />);
    io.show(0.6);
    await advance(1_000);
    io.show(0);
    io.show(0.9);
    await advance(5_000);

    expect(events.tokens()).toEqual(['imp-token']);
  });
});

describe('AdSlot — 형태 분기', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAdsForTest();
    installIntersectionObserver();
    captureAdEvents();
    window.adsbygoogle = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderSlot = () =>
    render(
      <MemoryRouter>
        <AdSlot placement="blog-post-end" />
      </MemoryRouter>,
    );

  it('띠배너 우승자는 띠배너로 그린다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end', ad: bannerAd() }]) }));
    const { container } = renderSlot();
    await advance(0);

    expect(container.querySelector('a.ad-banner img')?.getAttribute('alt')).toBe('가을 원서 모임 — 첫 달 무료');
    expect(container.querySelector('a.ad-card')).toBeNull();
  });

  it('카드 우승자(형태 없음 포함)는 카드로 그린다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end', ad: paidAd() }]) }));
    const { container } = renderSlot();
    await advance(0);

    expect(container.querySelector('a.ad-card')).not.toBeNull();
    expect(container.querySelector('a.ad-banner')).toBeNull();
  });
});
