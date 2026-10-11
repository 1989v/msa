import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../seo/useSeo', () => ({ useSeo: () => undefined }));
vi.mock('../components/AuthButton', () => ({ default: () => null }));
vi.mock('../api/resumeApi', () => ({ fetchResumeStatus: () => Promise.resolve(false) }));

declare const jsdom: { reconfigure(options: { url: string }): void };

/**
 * 호스트 판별(`isPlaceHost`)이 모듈 상수라 호스트마다 모듈을 새로 읽어 App 을 그린다.
 * 트래커도 같은 모듈 그래프에서 읽어야 App 이 쓴 대기열을 본다.
 */
async function bootAppAt(url: string) {
  vi.resetModules();
  jsdom.reconfigure({ url });
  sessionStorage.clear();
  const tracker = await import('../analytics/tracker');
  const { default: App } = await import('../App');
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  );
  return tracker.pendingForTest().filter((e) => e.entityId === 'place-entry');
}

afterEach(() => {
  jsdom.reconfigure({ url: 'http://localhost:3000/' });
  sessionStorage.clear();
});

describe('앱 부팅 — place 유입 기록', () => {
  it('place 호스트에서는 한 행을 남긴다', async () => {
    const rows = await bootAppAt('https://place.1989v.com/no-such-page');
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ referrerHost: '', landingType: 'other', lang: 'ko' });
  });

  it('place 가 아닌 호스트에서는 남기지 않는다', async () => {
    const rows = await bootAppAt('https://1989v.com/no-such-page');
    expect(rows).toHaveLength(0);
  });
});
