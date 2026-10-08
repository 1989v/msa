import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharedCollectionPage from '../SharedCollectionPage';
import { FAVORITE_INTENT_KEY, writeFavoriteIntent } from '../favoriteIntent';
import { installWishlistHttp, setSession, type Reply } from './wishlistHttpKit';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  fetchAttraction: vi.fn(),
}));
import { fetchAttraction } from '../../../api/placeApi';

const TOKEN = 'Ab3dE5gH9k';
const SHARED_PATH = `/api/v1/wishlist/shared/${TOKEN}`;
const ATTRACTIONS: Record<string, { title: string; address: string }> = {
  '126508': { title: '경복궁', address: '서울 종로구' },
  '264337': { title: '해운대해수욕장', address: '부산 해운대구' },
};

let http: ReturnType<typeof installWishlistHttp>;

function serve(shared: Reply, keys: string[] = []) {
  http = installWishlistHttp((method, url) => {
    if (url === SHARED_PATH && method === 'GET') return shared;
    if (url.startsWith('/api/v1/wishlist/keys')) return { status: 200, data: { keys } };
    if (method === 'PUT' && url.startsWith('/api/v1/wishlist/ATTRACTION/')) {
      return { status: 200, data: { id: 1, targetType: 'ATTRACTION', targetKey: url.split('/').pop(), collectionId: null, createdAt: '' } };
    }
    return undefined;
  });
}

function items(...keys: string[]) {
  return keys.map((targetKey) => ({ targetType: 'ATTRACTION', targetKey }));
}

function renderAt(token = TOKEN) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/shared/${token}`]}>
        <Routes>
          <Route path="/shared/:token" element={<SharedCollectionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setSession(null);
  sessionStorage.clear();
  vi.mocked(fetchAttraction).mockReset();
  vi.mocked(fetchAttraction).mockImplementation(async (id: string) => {
    const a = ATTRACTIONS[id];
    if (!a) throw new Error('없는 관광지');
    return { id, title: a.title, address: a.address, imageUrl: null } as never;
  });
});

afterEach(() => {
  http.restore();
  setSession(null);
  document.head.querySelector('meta[name="robots"]')?.remove();
});

describe('공유 묶음 수신 화면', () => {
  it('없거나 만료된 링크(404)는 안내 문구를 그린다', async () => {
    serve({ status: 404 });
    renderAt();

    expect(await screen.findByText(/찾을 수 없거나 만료된 링크/)).toBeInTheDocument();
  });

  it('짧은 주소가 보낸 /shared/invalid 도 같은 문구다', async () => {
    serve({ status: 404 });
    renderAt('invalid');

    expect(await screen.findByText(/찾을 수 없거나 만료된 링크/)).toBeInTheDocument();
  });

  it('항목이 없거나 하이드레이션이 전부 실패하면 빈 상태 문구', async () => {
    serve({ status: 200, data: { name: '빈 묶음', items: [], truncated: false } });
    const { unmount } = renderAt();
    expect(await screen.findByText(/담긴 관광지가 없습니다/)).toBeInTheDocument();
    unmount();
    http.restore();

    serve({ status: 200, data: { name: '사라진 곳들', items: items('999', '998'), truncated: false } });
    renderAt();
    expect(await screen.findByText(/담긴 관광지가 없습니다/)).toBeInTheDocument();
  });

  it('정상: 이름과 카드를 그리고 noindex, 소유자 정보는 없다, 이름의 태그는 글자 그대로다', async () => {
    const name = '<img src=x onerror="window.__pwned=1">';
    serve({
      status: 200,
      // 서버가 실수로 소유자 필드를 실어도 화면에 나가지 않는다
      data: { name, items: items('126508', '264337'), truncated: true, memberId: 42, ownerName: '홍길동' },
    });
    const { container } = renderAt();

    expect(await screen.findByText('경복궁')).toBeInTheDocument();
    expect(screen.getByText('해운대해수욕장')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.textContent).not.toContain('홍길동');
    expect(container.textContent).not.toContain('42');
    expect(screen.getByText(/100곳까지/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex'),
    );
  });

  it('카드 별은 수신자 자신의 찜이다 — 누르면 그 관광지를 내 찜에 넣는다', async () => {
    setSession('77');
    serve({ status: 200, data: { name: '서울', items: items('126508'), truncated: false } });
    renderAt();

    await userEvent.click(await screen.findByRole('button', { name: '관광지 찜' }));

    await waitFor(() => expect(http.calls).toContain('PUT /api/v1/wishlist/ATTRACTION/126508'));
  });

  it('로그인해 돌아오면 남겨 둔 찜 의도를 한 번 마저 찜한다', async () => {
    setSession('77');
    writeFavoriteIntent('264337');
    serve({ status: 200, data: { name: '부산', items: items('264337'), truncated: false } });
    renderAt();

    await waitFor(() => expect(http.calls.filter((c) => c === 'PUT /api/v1/wishlist/ATTRACTION/264337')).toHaveLength(1));
    expect(sessionStorage.getItem(FAVORITE_INTENT_KEY)).toBeNull();
    expect(await screen.findByRole('status')).toHaveTextContent('찜했습니다');
  });
});
