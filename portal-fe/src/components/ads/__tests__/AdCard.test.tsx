import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdCard from '../AdCard';
import { resetAdsForTest, type PaidAd } from '../adsApi';
import { resetIdentityForTest, sessionId, visitorId } from '../../../analytics/identity';
import { advance, captureAdEvents, installIntersectionObserver, paidAd } from './adsTestKit';

/** F4 광고주 문자열은 텍스트 · F5 가시 노출은 useImpression 기준으로 한 번 · 클릭 주소의 analytics 신원. */

describe('AdCard', () => {
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
    delete (window as { __pwned?: number }).__pwned;
  });

  it('광고주 문자열에 마크업이 있어도 글자로 보인다', () => {
    const hostile = '<img src=x onerror="window.__pwned=1">';
    const { container } = render(
      <AdCard ad={paidAd({ advertiserName: hostile, title: `<b>${hostile}</b>`, body: '<script>1</script>' }) as PaidAd} />,
    );

    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(screen.getByText(`<b>${hostile}</b>`)).toBeInTheDocument();
    expect(screen.getByText('<script>1</script>')).toBeInTheDocument();
    // 그려진 이미지는 소재 이미지 하나뿐이고, 광고주 문자열에서 요소가 생기지 않았다
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('img[onerror], b, script')).toBeNull();
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('「광고」 인장이 늘 보이고 카드 전체가 클릭 리다이렉터로 간다 — 주소에 analytics 신원이 붙는다', () => {
    render(<AdCard ad={paidAd() as PaidAd} />);

    expect(screen.getByText('광고')).toBeInTheDocument();
    const link = screen.getByRole('link');
    const href = new URL(link.getAttribute('href')!, 'https://blog.1989v.com');
    expect(href.pathname).toBe('/api/v1/ads/click/clk-token');
    expect(href.searchParams.get('vid')).toBe(visitorId());
    expect(href.searchParams.get('sid')).toBe(sessionId());
    expect(link.getAttribute('rel')).toContain('sponsored');
  });

  it('면적 50% 미만은 오래 보여도 노출이 아니다', async () => {
    render(<AdCard ad={paidAd() as PaidAd} />);
    io.show(0.4);
    await advance(5_000);

    expect(events.tokens()).toEqual([]);
  });

  it('1초를 못 채우고 나가면 노출이 아니다', async () => {
    render(<AdCard ad={paidAd() as PaidAd} />);
    io.show(0.6);
    await advance(999);
    io.show(0);
    await advance(5_000);

    expect(events.tokens()).toEqual([]);
  });

  it('면적 50% 이상으로 1초 보이면 노출 토큰을 한 번 보낸다', async () => {
    render(<AdCard ad={paidAd() as PaidAd} />);
    io.show(0.6);
    await advance(999);
    expect(events.tokens()).toEqual([]);

    await advance(1);
    io.show(0);
    io.show(0.9);
    await advance(5_000);

    const bodies = events.flushed();
    expect(bodies.flatMap((b) => b.tokens)).toEqual(['imp-token']);
    expect(bodies[0].visitorId).toBe(visitorId());
    expect(bodies[0].sessionId).toBe(sessionId());
  });
});
