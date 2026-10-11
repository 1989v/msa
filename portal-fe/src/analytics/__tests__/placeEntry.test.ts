import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordPlaceEntry, resetPlaceEntryForTest } from '../inflow';
import { pendingForTest, resetTrackerForTest } from '../tracker';
import { resetIdentityForTest } from '../identity';

/** 부팅 시점의 주소·리퍼러를 둔다. 호스트까지 바꿔야 해서 jsdom 을 다시 설정한다. */
function bootAt(url: string, referrer: string) {
  jsdom.reconfigure({ url });
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

function entries() {
  return pendingForTest().filter((e) => e.entityId === 'place-entry');
}

/** jsdom 의 Blob 은 `text()` 가 없어 FileReader 로 읽는다. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

declare const jsdom: { reconfigure(options: { url: string }): void };

describe('place 첫 방문 유입 기록', () => {
  beforeEach(() => {
    resetTrackerForTest();
    resetIdentityForTest();
    resetPlaceEntryForTest();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetPlaceEntryForTest();
    bootAt('http://localhost:3000/', '');
  });

  it('두 번 불러도 탭 세션에 한 행 — 이전 사이트 호스트·착지 유형·언어·UTM 만 담는다', () => {
    bootAt(
      'https://place.1989v.com/attractions/4321?utm_source=naver&utm_medium=cafe&utm_campaign=autumn&q=x',
      'https://www.google.com/search?q=%EB%B9%84%EB%B0%80&token=abc',
    );
    recordPlaceEntry();
    recordPlaceEntry();

    const rows = entries();
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.action).toBe('SESSION_START');
    expect(row.entityType).toBe('PAGE');
    expect(row.screenType).toBe('PLACE_ENTRY');
    expect(row.screenRef).toBe('');
    expect(row.sectionId).toBeUndefined();
    expect(row.viewId).not.toBe('');
    expect(row.payload).toEqual({
      referrerHost: 'www.google.com',
      landingType: 'detail',
      lang: 'ko',
      utmSource: 'naver',
      utmMedium: 'cafe',
      utmCampaign: 'autumn',
    });
    for (const value of Object.values(row.payload ?? {})) {
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
    }
  });

  it('UTM 이 없는 진입은 UTM 키가 없다 — 빈 리퍼러·영문 허브', () => {
    bootAt('https://place.1989v.com/en', '');
    recordPlaceEntry();

    const [row] = entries();
    expect(row.payload).toEqual({ referrerHost: '', landingType: 'hub', lang: 'en' });
    expect(Object.keys(row.payload ?? {})).not.toContain('utmSource');
    for (const value of Object.values(row.payload ?? {})) {
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
    }
  });

  it('세션 저장소에 쓸 수 없으면 모듈 변수로 한 번만', () => {
    bootAt('https://place.1989v.com/regions/11', 'https://blog.1989v.com/posts/a');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    recordPlaceEntry();
    recordPlaceEntry();

    const rows = entries();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ referrerHost: 'blog.1989v.com', landingType: 'region', lang: 'ko' });
  });

  it('떠날 때 흘리는 것을 스스로 설치한다 — 설치하는 화면이 없는 편집 글 착지에서도 beacon 에 실린다', async () => {
    bootAt('https://place.1989v.com/guides', 'https://m.search.naver.com/search.naver?query=x');
    const beacons: Blob[] = [];
    vi.stubGlobal('navigator', {
      ...navigator,
      sendBeacon: (_url: string, body: Blob) => {
        beacons.push(body);
        return true;
      },
    });

    recordPlaceEntry();
    window.dispatchEvent(new Event('pagehide'));

    expect(beacons).toHaveLength(1);
    const sent = JSON.parse(await readBlob(beacons[0])) as {
      events: { entityId: string; payload: Record<string, string> }[];
    };
    const row = sent.events.find((e) => e.entityId === 'place-entry');
    expect(row?.payload).toEqual({ referrerHost: 'm.search.naver.com', landingType: 'editorial', lang: 'ko' });
  });
});
