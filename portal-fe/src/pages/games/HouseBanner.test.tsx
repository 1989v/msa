import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HouseBanner from './HouseBanner';
import { HOUSE_ROTATION_MS } from '../../components/ads/HouseRotator';
import { resetAdsForTest } from '../../components/ads/adsApi';
import {
  advance, captureAdEvents, decisionBody, houseItem, installDecisionAdapter,
} from '../../components/ads/__tests__/adsTestKit';

/** F3 — 게임 목록 HOUSE 배너는 결정 응답의 HOUSE 목록을 6초마다 돌리고, 앱 안 경로는 SPA 로 이동한다. */

const HOUSE = [
  houseItem(1, 'IT 개념 사전', '/tech'),
  houseItem(2, '혜택 모음', 'https://deal.1989v.com/'),
  houseItem(3, '랭킹', '/rank'),
];

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderBanner() {
  return render(
    <MemoryRouter initialEntries={['/games']}>
      <HouseBanner placementKey="game-list-banner" />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const title = () => document.querySelector('.ad-house-text strong')?.textContent;

describe('HouseBanner', () => {
  let events: ReturnType<typeof captureAdEvents>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetAdsForTest();
    events = captureAdEvents();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('결정 API 의 HOUSE 목록을 6초마다 돌린다', async () => {
    const sent = installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'game-list-banner', house: HOUSE }]) }));
    renderBanner();
    await advance(0);

    expect(sent.map((r) => r.url)).toEqual(['/api/v1/ads/decisions']);
    expect(title()).toBe('IT 개념 사전');
    await advance(HOUSE_ROTATION_MS);
    expect(title()).toBe('혜택 모음');
    await advance(HOUSE_ROTATION_MS);
    expect(title()).toBe('랭킹');
    await advance(HOUSE_ROTATION_MS);
    expect(title()).toBe('IT 개념 사전');
    expect(events.fills()).toEqual([{ placementKey: 'game-list-banner', source: 'HOUSE' }]);
  });

  it('앱 안 경로는 SPA 이동, https 주소는 일반 링크다', async () => {
    installDecisionAdapter(() => ({ status: 200, data: decisionBody([{ placementKey: 'game-list-banner', house: HOUSE }]) }));
    renderBanner();
    await advance(0);

    const inApp = screen.getByRole('link', { name: '홍보: IT 개념 사전' });
    expect(inApp.getAttribute('href')).toBe('/tech');
    fireEvent.click(inApp);
    // 라우터가 받았다 — 전체 새로고침이면 MemoryRouter 의 위치가 그대로다
    expect(screen.getByTestId('where').textContent).toBe('/tech');

    await advance(HOUSE_ROTATION_MS);
    const external = screen.getByRole('link', { name: '홍보: 혜택 모음' });
    expect(external.getAttribute('href')).toBe('https://deal.1989v.com/');
  });

  it('다른 오리진으로 나가는 경로(//host)는 버린다', async () => {
    installDecisionAdapter(() => ({
      status: 200,
      data: decisionBody([{ placementKey: 'game-list-banner', house: [houseItem(9, '위조', '//evil.example'), HOUSE[0]] }]),
    }));
    renderBanner();
    await advance(0);

    expect(screen.queryByText('위조')).toBeNull();
    expect(title()).toBe('IT 개념 사전');
    expect(document.querySelector('.ad-house-dots')).toBeNull();
  });

  it('결정이 실패하면 아무것도 그리지 않는다', async () => {
    installDecisionAdapter(() => ({ status: 500, data: null }));
    const { container } = renderBanner();
    await advance(1_000);

    expect(container.querySelector('.house-banner')).toBeNull();
    expect(events.fills()).toEqual([{ placementKey: 'game-list-banner', source: 'EMPTY' }]);
  });
});
