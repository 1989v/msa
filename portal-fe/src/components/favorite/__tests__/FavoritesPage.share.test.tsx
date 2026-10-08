import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FavoritesPage from '../FavoritesPage';
import { installWishlistHttp, setSession, type Reply } from './wishlistHttpKit';

const COLLECTION = { id: 7, name: '부산 2박', itemCount: 0, createdAt: '2026-10-01T00:00:00' };
const LINK = { token: 'Ab3dE5gH9k', url: 'https://1989v.com/c/Ab3dE5gH9k', expiresAt: '2026-11-08T00:00:00' };
const SHARE_PATH = `/api/v1/wishlist/collections/${COLLECTION.id}/share`;

let http: ReturnType<typeof installWishlistHttp>;
let writeText: ReturnType<typeof vi.fn>;

/** 공유 경로 응답만 바꿔 끼운다 — 나머지(묶음·목록·키)는 빈 찜 */
function serve(share: { get?: Reply; post?: Reply; del?: Reply }) {
  http = installWishlistHttp((method, url) => {
    if (url === '/api/v1/wishlist/collections') return { status: 200, data: [COLLECTION] };
    if (url.startsWith('/api/v1/wishlist?')) return { status: 200, data: { items: [], totalCount: 0 } };
    if (url.startsWith('/api/v1/wishlist/keys')) return { status: 200, data: { keys: [] } };
    if (url === SHARE_PATH && method === 'GET') return share.get;
    if (url === SHARE_PATH && method === 'POST') return share.post;
    if (url === SHARE_PATH && method === 'DELETE') return share.del;
    return undefined;
  });
}

const shareGets = () => http.calls.filter((c) => c === `GET ${SHARE_PATH}`).length;

async function openAttractionTab() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/favorites']}>
        <FavoritesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: '관광지' }));
  await screen.findByRole('button', { name: /부산 2박/ });
}

async function pickCollection() {
  await userEvent.click(screen.getByRole('button', { name: /부산 2박/ }));
  await waitFor(() => expect(shareGets()).toBe(1));
}

/** 막대가 숨겨졌는지 — 응답을 받고 다시 그려질 틈을 준 뒤 본다 */
async function expectNoShareBar() {
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByRole('button', { name: '공유 링크 만들기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '링크 복사' })).not.toBeInTheDocument();
}

function expectNoPublicPostLinks() {
  expect(screen.queryByRole('link', { name: /^X/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /^LinkedIn/ })).not.toBeInTheDocument();
}

beforeEach(() => {
  setSession('42');
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

afterEach(() => {
  http.restore();
  setSession(null);
});

describe('찜 화면 — 묶음 공유 막대', () => {
  it('「전체」·「미분류」에서는 공유 조회를 하지 않고 막대도 없다', async () => {
    serve({ get: { status: 200, data: { link: LINK } } });
    await openAttractionTab();

    await userEvent.click(screen.getByRole('button', { name: '미분류' }));
    await userEvent.click(screen.getByRole('button', { name: '전체' }));

    expect(shareGets()).toBe(0);
    await expectNoShareBar();
  });

  it('공유가 꺼졌거나 없는 묶음(404)이면 막대를 숨긴다', async () => {
    serve({ get: { status: 404 } });
    await openAttractionTab();
    await pickCollection();

    await expectNoShareBar();
  });

  it('5xx·네트워크 오류도 숨긴다', async () => {
    serve({ get: { status: 503 } });
    await openAttractionTab();
    await pickCollection();
    await expectNoShareBar();

    http.restore();
    serve({ get: 'network' });
    await userEvent.click(screen.getByRole('button', { name: '전체' }));
    await userEvent.click(screen.getByRole('button', { name: /부산 2박/ }));
    await waitFor(() => expect(shareGets()).toBe(1));
    await expectNoShareBar();
  });

  it('링크가 없으면 「공유 링크 만들기」 — 누르면 만들어 복사·공유 막대로 바뀐다', async () => {
    serve({ get: { status: 200, data: { link: null } }, post: { status: 200, data: LINK } });
    await openAttractionTab();
    await pickCollection();

    await userEvent.click(await screen.findByRole('button', { name: '공유 링크 만들기' }));

    expect(http.calls).toContain(`POST ${SHARE_PATH}`);
    expect(await screen.findByRole('button', { name: '링크 복사' })).toBeInTheDocument();
    expectNoPublicPostLinks();
  });

  it('링크가 있으면 복사·공유·중단 — X·LinkedIn 은 없고, 복사는 단축 주소, 중단하면 다시 만들기', async () => {
    serve({ get: { status: 200, data: { link: LINK } }, del: { status: 200 } });
    await openAttractionTab();
    await pickCollection();

    await userEvent.click(await screen.findByRole('button', { name: '링크 복사' }));
    expect(writeText).toHaveBeenCalledWith(LINK.url);
    expect(screen.getByRole('button', { name: '공유' })).toBeInTheDocument();
    expectNoPublicPostLinks();

    await userEvent.click(screen.getByRole('button', { name: '공유 중단' }));
    expect(http.calls).toContain(`DELETE ${SHARE_PATH}`);
    expect(await screen.findByRole('button', { name: '공유 링크 만들기' })).toBeInTheDocument();
  });
});
