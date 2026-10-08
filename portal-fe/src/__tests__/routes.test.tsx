import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../seo/useSeo', () => ({ useSeo: () => undefined }));
vi.mock('../components/AuthButton', () => ({ default: () => null }));
vi.mock('../api/resumeApi', () => ({ fetchResumeStatus: () => Promise.resolve(false) }));

import generated from '../pages/tech/generated/search-architecture.json';
import App from '../App';

/**
 * App 이 BrowserRouter 를 직접 연다 — MemoryRouter 로 감쌀 수 없어 주소를 먼저 바꾸고 그린다.
 */
function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => window.history.pushState({}, '', '/'));

describe('라우트', () => {
  it('/tech/search 는 검색 아키텍처 페이지다 — /tech/:category 용어집이 받지 않는다', async () => {
    renderAt('/tech/search');
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe(generated.headings.find((h) => h.level === 1)?.text);
    expect(h1.textContent).not.toMatch(/용어집/);
  });

  it('/tech 아틀라스 NAV 에 검색 아키텍처 링크가 하나 있다', async () => {
    renderAt('/tech');
    const links = await screen.findAllByRole('link', { name: '검색 아키텍처' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/tech/search');
  });
});
