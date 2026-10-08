import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedHit, UnifiedResult } from '../../../api/searchApi';

vi.mock('../../../components/GNB', () => ({ default: () => null }));
vi.mock('../../../components/Footer', () => ({ default: () => null }));
vi.mock('../../../seo/useSeo', () => ({ useSeo: () => undefined }));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));
vi.mock('../../../api/searchApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/searchApi')>()),
  fetchUnifiedSearch: vi.fn(),
}));

import { fetchUnifiedSearch } from '../../../api/searchApi';
import UnifiedSearchPage from '../UnifiedSearchPage';

/*
 * 통합 검색의 summary 는 화면이 손대지 않는다 — 관광지는 서버가 목록 요약을 이미 정리했고,
 * 다른 타입 본문에 관광 원천 정리(태그 제거)를 걸면 `List<String>` 같은 글자가 지워진다.
 * 판정은 그려진 DOM 텍스트다.
 */

const hit = (over: Partial<UnifiedHit>): UnifiedHit => ({
  type: 'blog_post', id: '1', slug: 's', title: 't', summary: null, category: null, thumbnailUrl: null, facets: {}, score: 1,
  ...over,
});

afterEach(() => vi.clearAllMocks());

describe('UnifiedSearchPage summary', () => {
  it('관광지 외 타입의 summary 는 받은 글자 그대로 보인다(List<String> 이 지워지지 않는다)', async () => {
    const result: UnifiedResult = {
      query: 'kotlin',
      understood: { type: null, residual: null },
      groups: [
        { type: 'blog_post', total: 1, hits: [hit({ id: 'b1', title: '제네릭', summary: 'List<String> 은 불공변이다' })] },
        { type: 'attraction', total: 1, hits: [hit({ type: 'attraction', id: 'a1', title: '극장', summary: 'K-movie <PARASITE> - …' })] },
      ],
    };
    vi.mocked(fetchUnifiedSearch).mockResolvedValue(result);
    render(
      <MemoryRouter initialEntries={['/search?q=kotlin']}>
        <UnifiedSearchPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('List<String> 은 불공변이다')).toBeInTheDocument();
    // 관광지도 서버 값을 다시 풀지 않는다
    expect(screen.getByText('K-movie <PARASITE> - …')).toBeInTheDocument();
  });
});
