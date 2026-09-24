import { act } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { vi } from 'vitest';
import { apiClient } from '../../../shell/apiClient';
import { flushAdEvents } from '../adsApi';

/**
 * 광고 화면 테스트 도구 — 결정 요청은 실제 `apiClient`(인터셉터 포함)를 지나 어댑터에서 멈추고,
 * 이벤트는 실제 전송 함수가 부르는 `fetch` 에서 받는다. 판정은 둘 다 대상이 내보낸 값으로 한다.
 */

export interface SentRequest {
  url: string;
  authorization: string | undefined;
  body: { placements: string[]; host: string; contextKey?: string };
}

type Reply = { status: number; data: unknown } | 'never' | Error;

export function installDecisionAdapter(reply: (req: SentRequest) => Reply): SentRequest[] {
  const sent: SentRequest[] = [];
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const req: SentRequest = {
      url: String(config.url),
      authorization: config.headers?.Authorization as string | undefined,
      body: JSON.parse(String(config.data)),
    };
    sent.push(req);
    const r = reply(req);
    if (r === 'never') return new Promise(() => {});
    if (r instanceof Error) return Promise.reject(r);
    if (r.status >= 400) return Promise.reject(Object.assign(new Error(`HTTP ${r.status}`), { response: { status: r.status } }));
    return Promise.resolve({ data: r.data, status: r.status, statusText: 'OK', headers: {}, config });
  };
  apiClient.defaults.adapter = adapter;
  return sent;
}

export interface EventBody {
  tokens: string[];
  visitorId: string;
  sessionId: string;
  fills: { placementKey: string; source: string }[];
}

/** 광고 이벤트 전송을 받는다. `flushed()` 는 남은 것을 흘린 뒤 지금까지 보낸 본문 전부. */
export function captureAdEvents() {
  const bodies: EventBody[] = [];
  vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return Promise.resolve(new Response(null, { status: 200 }));
  });
  return {
    flushed(): EventBody[] {
      flushAdEvents();
      return bodies;
    },
    tokens(): string[] {
      return this.flushed().flatMap((b) => b.tokens);
    },
    fills(): { placementKey: string; source: string }[] {
      return this.flushed().flatMap((b) => b.fills);
    },
  };
}

export async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

export const paidAd = (overrides: Record<string, unknown> = {}) => ({
  creativeId: 7,
  title: '한 달에 한 권, 개발 원서 같이 읽기',
  body: '매주 목요일 저녁 온라인 모임.',
  advertiserName: '스튜디오 모래시계',
  imageUrl: '/api/v1/ads/assets/abc123',
  clickUrl: '/api/v1/ads/click/clk-token',
  impressionToken: 'imp-token',
  ...overrides,
});

export const houseItem = (creativeId: number, title: string, link: string) => ({
  creativeId,
  title,
  body: `${title} 설명`,
  emoji: '📚',
  link,
  imageUrl: null,
});

export function decisionBody(placements: { placementKey: string; ad?: unknown; house?: unknown[] }[]) {
  return {
    success: true,
    data: {
      decisionId: 'd-1',
      placements: placements.map((p) => ({
        placementKey: p.placementKey,
        ad: p.ad ?? null,
        reason: p.ad ? null : 'no_candidates',
        house: p.house ?? [],
      })),
    },
    error: null,
  };
}

/** IntersectionObserver 대역 — 테스트가 보이는 비율을 직접 넣는다. */
export function installIntersectionObserver() {
  const observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];
  class FakeIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0.5];
    private entry: { callback: IntersectionObserverCallback; targets: Element[] };
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback, targets: [] };
      observers.push(this.entry);
    }
    observe(target: Element) {
      this.entry.targets.push(target);
    }
    unobserve() {}
    disconnect() {
      this.entry.targets = [];
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  return {
    /** 관찰 중인 모든 대상이 `ratio` 만큼 보인다고 알린다 */
    show(ratio: number) {
      act(() => {
        for (const o of observers) {
          for (const target of o.targets) {
            o.callback(
              [{ target, isIntersecting: ratio > 0, intersectionRatio: ratio } as unknown as IntersectionObserverEntry],
              {} as IntersectionObserver,
            );
          }
        }
      });
    },
  };
}
