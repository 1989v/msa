import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLUSH_INTERVAL_MS, FLUSH_SIZE, flush, pendingForTest, resetTrackerForTest, track,
} from '../tracker';
import { resetIdentityForTest } from '../identity';
import type { TrackedItem } from '../events';

const item = (entityId: string, itemIndex: number): TrackedItem => ({
  entityType: 'ATTRACTION',
  entityId,
  screenType: 'ATTRACTION_DETAIL',
  screenRef: '17592',
  sectionId: 'NEARBY_ATTRACTIONS',
  sectionIndex: 2,
  itemIndex,
});

describe('tracker — 노출·클릭 전송', () => {
  let sent: { url: string; body: unknown }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    resetTrackerForTest();
    resetIdentityForTest();
    sent = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return Promise.resolve(new Response(null, { status: 202 }));
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('건당 보내지 않고 모은다', () => {
    track('IMPRESSION', item('a', 0), 'v1');
    track('IMPRESSION', item('b', 1), 'v1');
    expect(sent).toHaveLength(0);
    expect(pendingForTest()).toHaveLength(2);
  });

  it('정해진 수가 모이면 바로 보낸다', () => {
    for (let i = 0; i < FLUSH_SIZE; i += 1) track('IMPRESSION', item(`a${i}`, i), 'v1');
    expect(sent).toHaveLength(1);
    const body = sent[0].body as { events: unknown[] };
    expect(body.events).toHaveLength(FLUSH_SIZE);
  });

  it('적게 모여도 시간이 지나면 보낸다', () => {
    track('IMPRESSION', item('a', 0), 'v1');
    expect(sent).toHaveLength(0);
    vi.advanceTimersByTime(FLUSH_INTERVAL_MS);
    expect(sent).toHaveLength(1);
  });

  it('같은 화면에서 같은 대상은 한 번만 센다', () => {
    // 스크롤로 오갔다고 노출이 늘면 CTR 분모가 부푼다
    track('IMPRESSION', item('a', 0), 'v1');
    track('IMPRESSION', item('a', 0), 'v1');
    track('IMPRESSION', item('a', 0), 'v1');
    flush();
    const body = sent[0].body as { events: unknown[] };
    expect(body.events).toHaveLength(1);
  });

  it('화면이 다시 그려지면(viewId 변경) 다시 센다', () => {
    track('IMPRESSION', item('a', 0), 'v1');
    track('IMPRESSION', item('a', 0), 'v2');
    flush();
    const body = sent[0].body as { events: unknown[] };
    expect(body.events).toHaveLength(2);
  });

  it('노출과 클릭은 서로 막지 않는다', () => {
    track('IMPRESSION', item('a', 0), 'v1');
    track('CLICK', item('a', 0), 'v1');
    flush();
    const body = sent[0].body as { events: { action: string }[] };
    expect(body.events.map((e) => e.action)).toEqual(['IMPRESSION', 'CLICK']);
  });

  it('위치를 계층 그대로 보낸다', () => {
    // 한 칸으로 누르면 섹션 순서와 항목 순서가 섞인다
    track('IMPRESSION', item('a', 4), 'v1');
    flush();
    const body = sent[0].body as { events: Record<string, unknown>[] };
    expect(body.events[0]).toMatchObject({
      screenType: 'ATTRACTION_DETAIL',
      screenRef: '17592',
      sectionId: 'NEARBY_ATTRACTIONS',
      sectionIndex: 2,
      itemIndex: 4,
    });
  });

  it('보낼 것이 없으면 요청하지 않는다', () => {
    flush();
    expect(sent).toHaveLength(0);
  });

  it('떠날 때는 beacon 으로 보낸다 — 그때 fetch 는 취소된다', () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    track('IMPRESSION', item('a', 0), 'v1');
    flush(true);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(0);
  });

  it('전송이 실패해도 던지지 않는다 — 계측이 화면을 깨뜨리면 안 된다', () => {
    vi.stubGlobal('fetch', () => { throw new Error('network down'); });
    track('IMPRESSION', item('a', 0), 'v1');
    expect(() => flush()).not.toThrow();
  });

  it('같은 대상이라도 섹션이 다르면 각각 남는다 — 카드 선택·지도 열기·찜은 다른 행동이다', () => {
    track('CLICK', { ...item('a', 0), sectionId: 'ATTRACTION_LIST' }, 'v1');
    track('CLICK', { ...item('a', 0), sectionId: 'MAP_LINK' }, 'v1');
    expect(pendingForTest().map((e) => e.sectionId)).toEqual(['ATTRACTION_LIST', 'MAP_LINK']);
  });

  it('같은 섹션에서 같은 대상·같은 행동은 한 번만', () => {
    track('CLICK', { ...item('a', 0), sectionId: 'MAP_LINK' }, 'v1');
    track('CLICK', { ...item('a', 0), sectionId: 'MAP_LINK' }, 'v1');
    expect(pendingForTest()).toHaveLength(1);
  });

  it('PAGE 대상은 섹션 없이 들어가고 이벤트에 sectionId 키가 생기지 않는다', () => {
    track('SESSION_START', {
      entityType: 'PAGE', entityId: 'place-hub', screenType: 'PLACE_HUB', screenRef: '',
    }, 'v1');
    const pending = pendingForTest();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ action: 'SESSION_START', entityType: 'PAGE', entityId: 'place-hub' });
    expect('sectionId' in pending[0]).toBe(false);
  });

  it('목록 대상에서 섹션을 빠뜨리면 컴파일이 막는다', () => {
    // @ts-expect-error — 목록 대상은 sectionId 필수
    track('CLICK', { entityType: 'ATTRACTION', entityId: '1', screenType: 'PLACE_HUB' }, 'v');
    expect(pendingForTest()).toHaveLength(1);
  });
});
