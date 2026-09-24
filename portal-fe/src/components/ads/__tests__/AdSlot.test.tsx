import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdSlot, { ADSENSE_STATUS_TIMEOUT_MS, type AdPlacementKey } from '../AdSlot';
import HouseBanner from '../../../pages/games/HouseBanner';
import { DECISION_TIMEOUT_MS, resetAdsForTest } from '../adsApi';
import { resetIdentityForTest } from '../../../analytics/identity';
import {
  advance, captureAdEvents, decisionBody, houseItem, installDecisionAdapter, installIntersectionObserver, paidAd,
} from './adsTestKit';

/**
 * F1 채움 순서 · F2 결정 호출 경로 · selfAds=false.
 * `blog-post-end` 는 AdSense 단위 ID 가 있는 지면, `attraction-end` 는 없는 지면이다(copy.mjs).
 */

const HOUSE = [houseItem(1, 'IT 개념 사전', '/tech'), houseItem(2, '랭킹', '/rank')];

function renderSlot(placement: AdPlacementKey, props: { selfAds?: boolean; contextKey?: string } = {}) {
  return render(
    <MemoryRouter>
      <AdSlot placement={placement} shape="horizontal" minHeight={90} {...props} />
    </MemoryRouter>,
  );
}

const adsenseUnit = (c: HTMLElement) => c.querySelector('ins.adsbygoogle');
const paidCard = (c: HTMLElement) => c.querySelector('a.ad-card');
const houseCard = (c: HTMLElement) => c.querySelector('.ad-house-card');

describe('AdSlot — 채움 순서', () => {
  let events: ReturnType<typeof captureAdEvents>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetAdsForTest();
    resetIdentityForTest();
    installIntersectionObserver();
    events = captureAdEvents();
    window.adsbygoogle = [];
    document.cookie = 'portal_access_token=tok-owner; path=/';
  });
  afterEach(() => {
    document.cookie = 'portal_access_token=; max-age=0; path=/';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('유료 광고가 있으면 카드를 그리고 AdSense 는 채우지 않는다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end', ad: paidAd(), house: HOUSE }]) }));
    const { container } = renderSlot('blog-post-end');
    await advance(0);

    expect(paidCard(container)).not.toBeNull();
    expect(adsenseUnit(container)).toBeNull();
    expect(window.adsbygoogle).toHaveLength(0);
    expect(events.fills()).toEqual([{ placementKey: 'blog-post-end', source: 'PAID' }]);
  });

  it.each([
    ['오류 응답', { status: 500, data: null }],
    ['빈 200', { status: 200, data: '' }],
    ['형식 불일치', { status: 200, data: { success: true, data: { placements: 'x' } } }],
    ['광고 필드가 모자란 응답', { status: 200, data: decisionBody([{ placementKey: 'blog-post-end', ad: { creativeId: 7, title: 't' } }]) }],
  ])('결정 실패(%s)는 유료 없음 — AdSense 로 간다', async (_name, reply) => {
    installDecisionAdapter(() => reply);
    const { container } = renderSlot('blog-post-end');
    await advance(0);

    expect(paidCard(container)).toBeNull();
    expect(adsenseUnit(container)).not.toBeNull();
    expect(window.adsbygoogle).toHaveLength(1);
  });

  it('결정이 제한 시간 안에 안 오면 유료 없음 — 그 전까지는 예약 높이만 비워 둔다', async () => {
    installDecisionAdapter(() => 'never');
    const { container } = renderSlot('blog-post-end');
    await advance(DECISION_TIMEOUT_MS - 1);

    const waiting = container.querySelector('aside.ad-slot');
    expect(waiting).not.toBeNull();
    expect((waiting as HTMLElement).style.minHeight).toBe('90px');
    expect(adsenseUnit(container)).toBeNull();

    await advance(1);
    expect(adsenseUnit(container)).not.toBeNull();
  });

  it('AdSense 가 unfilled 를 적으면 HOUSE 로 간다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end', house: HOUSE }]) }));
    const { container } = renderSlot('blog-post-end');
    await advance(0);
    expect(adsenseUnit(container)).not.toBeNull();

    adsenseUnit(container)!.setAttribute('data-ad-status', 'unfilled');
    await advance(0);

    expect(adsenseUnit(container)).toBeNull();
    expect(houseCard(container)?.textContent).toContain('IT 개념 사전');
    expect(events.fills()).toEqual([{ placementKey: 'blog-post-end', source: 'HOUSE' }]);
  });

  it('AdSense 가 3초 안에 상태를 안 적으면(차단기·로드 실패) HOUSE 로 간다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end', house: HOUSE }]) }));
    const { container } = renderSlot('blog-post-end');
    await advance(0);

    await advance(ADSENSE_STATUS_TIMEOUT_MS - 1);
    expect(adsenseUnit(container)).not.toBeNull();

    await advance(1);
    expect(adsenseUnit(container)).toBeNull();
    expect(houseCard(container)).not.toBeNull();
  });

  it('AdSense 가 채우면 그대로 두고 채움 출처 ADSENSE 를 알린다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end', house: HOUSE }]) }));
    const { container } = renderSlot('blog-post-end');
    await advance(0);

    adsenseUnit(container)!.setAttribute('data-ad-status', 'filled');
    await advance(ADSENSE_STATUS_TIMEOUT_MS * 2);

    expect(adsenseUnit(container)).not.toBeNull();
    expect(houseCard(container)).toBeNull();
    expect(events.fills()).toEqual([{ placementKey: 'blog-post-end', source: 'ADSENSE' }]);
  });

  it('AdSense 도 HOUSE 도 없으면 자리를 숨기고 EMPTY 를 알린다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'blog-post-end' }]) }));
    const { container } = renderSlot('blog-post-end');
    await advance(0);
    adsenseUnit(container)!.setAttribute('data-ad-status', 'unfilled');
    await advance(0);

    expect(container.querySelector('aside')).toBeNull();
    expect(events.fills()).toEqual([{ placementKey: 'blog-post-end', source: 'EMPTY' }]);
  });

  it('AdSense ID 가 없는 지면은 대기 중에 자리를 잡지 않고, 유료가 없으면 바로 HOUSE', async () => {
    installDecisionAdapter(() => 'never');
    const { container } = renderSlot('attraction-end');
    await advance(DECISION_TIMEOUT_MS - 1);
    // 예전에 아무것도 그리지 않던 지면 — 대기 중 높이를 잡으면 없던 밀림이 새로 생긴다
    expect(container.innerHTML).toBe('');

    await advance(1);
    expect(container.innerHTML).toBe('');
    expect(events.fills()).toEqual([{ placementKey: 'attraction-end', source: 'EMPTY' }]);
  });

  it('AdSense ID 가 없는 지면에 HOUSE 가 있으면 HOUSE 를 그린다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'attraction-end', house: HOUSE }]) }));
    const { container } = renderSlot('attraction-end');
    await advance(0);

    expect(adsenseUnit(container)).toBeNull();
    expect(houseCard(container)).not.toBeNull();
  });
});

describe('AdSlot — 결정 호출', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAdsForTest();
    captureAdEvents();
    window.adsbygoogle = [];
  });
  afterEach(() => {
    document.cookie = 'portal_access_token=; max-age=0; path=/';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('로그인 토큰이 있으면 결정 요청에 Bearer 가 실린다 — 서버의 광고주 본인 판정이 이 값을 쓴다', async () => {
    document.cookie = 'portal_access_token=tok-owner; path=/';
    const sent = installDecisionAdapter(() => ({ status: 200, data: decisionBody([]) }));
    renderSlot('blog-post-end', { contextKey: 'blog:backend' });
    await advance(0);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/v1/ads/decisions');
    expect(sent[0].authorization).toBe('Bearer tok-owner');
    expect(sent[0].body).toEqual({ placements: ['blog-post-end'], host: window.location.hostname, contextKey: 'blog:backend' });
  });

  it('한 페이지의 지면은 결정 한 번으로 묶인다', async () => {
    const sent = installDecisionAdapter(() => ({ status: 200, data: decisionBody([]) }));
    render(
      <MemoryRouter>
        <HouseBanner placementKey="game-list-banner" contextKey="game:puzzle" />
        <AdSlot placement="game-hub-end" contextKey="game:puzzle" />
      </MemoryRouter>,
    );
    await advance(0);

    expect(sent).toHaveLength(1);
    expect(sent[0].body.placements.sort()).toEqual(['game-hub-end', 'game-list-banner']);
  });

  it('selfAds={false} 는 결정을 부르지 않는다', async () => {
    const sent = installDecisionAdapter(() => ({ status: 200, data: decisionBody([]) }));
    const { container } = renderSlot('deal-hub-end', { selfAds: false });
    await advance(ADSENSE_STATUS_TIMEOUT_MS * 2);

    expect(sent).toHaveLength(0);
    // 혜택 허브 지면은 AdSense ID 도 비어 있어 전처럼 아무것도 그리지 않는다
    expect(container.innerHTML).toBe('');
  });

  it('selfAds={false} 인데 AdSense ID 가 있으면 결정 없이 AdSense 만 채운다', async () => {
    const sent = installDecisionAdapter(() => ({ status: 200, data: decisionBody([]) }));
    const { container } = renderSlot('blog-post-end', { selfAds: false });
    await advance(ADSENSE_STATUS_TIMEOUT_MS * 2);

    expect(sent).toHaveLength(0);
    expect(adsenseUnit(container)).not.toBeNull();
    expect(window.adsbygoogle).toHaveLength(1);
  });
});
