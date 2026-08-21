import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlogHomePage from '../BlogHomePage';
import type { BlogCategoryNode, BlogPage, BlogPostSummary } from '../../../api/blogApi';

vi.mock('../../../api/blogApi', () => ({
  fetchCategories: vi.fn(),
  fetchPosts: vi.fn(),
}));

import { fetchCategories, fetchPosts } from '../../../api/blogApi';

const space = (id: number, slug: string, name: string, description: string): BlogCategoryNode => ({
  id,
  slug,
  name,
  description,
  path: `/${slug}`,
  depth: 1,
  orderNo: id * 10,
  postCount: id,
  children: [],
});

const post = (id: number, title: string, categoryPath: string): BlogPostSummary => ({
  id,
  slug: `post-${id}`,
  title,
  summary: '요약',
  coverImageUrl: null,
  categoryPath,
  categoryName: '분류',
  author: { handle: 'kgd', displayName: 'kgd', avatarUrl: null, bio: null },
  status: 'PUBLISHED',
  publishedAt: '2026-08-20T00:00:00Z',
  readingMinutes: 3,
  viewCount: 10,
  likeCount: 0,
  commentCount: 0,
  ratingAverage: 0,
  ratingCount: 0,
});

const page = (items: BlogPostSummary[]): BlogPage<BlogPostSummary> => ({
  items,
  page: 0,
  size: items.length,
  totalElements: items.length,
  totalPages: 1,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <BlogHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BlogHomePage', () => {
  beforeEach(() => {
    vi.mocked(fetchCategories).mockResolvedValue([
      space(1, 'tech', '기술', '서버 · 검색 · 데이터'),
      space(2, 'harness', 'AI 하네스', '도메인별 베스트 CLAUDE.md · 에이전트 하네스 공유'),
    ]);
    vi.mocked(fetchPosts).mockImplementation(async ({ categoryPath } = {}) => {
      if (categoryPath === '/harness') return page([post(9, '주문 서비스 CLAUDE.md', '/harness')]);
      if (categoryPath === '/tech') return page([post(8, '검색 랭킹 개선기', '/tech/server')]);
      return page([post(1, '최신 글 하나', '/tech/server')]);
    });
  });

  it('공간 입구 카드가 이름·소개·최근 글 제목까지 보여 준다', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '공간' })).toBeInTheDocument();
    const harnessCard = (await screen.findByRole('heading', { name: 'AI 하네스' })).closest('a');
    expect(harnessCard).toHaveAttribute('href', '/c/harness');
    expect(harnessCard).toHaveTextContent('도메인별 베스트 CLAUDE.md · 에이전트 하네스 공유');
    expect(harnessCard).toHaveTextContent('주문 서비스 CLAUDE.md');

    // 최신 글 목록도 함께 있다 — 공간 카드가 목록을 대체하는 것이 아니다
    expect(await screen.findByText('최신 글 하나')).toBeInTheDocument();
  });

  it('공간별 최근 글은 공간마다 따로, 작게(2건) 묻는다', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'AI 하네스' });
    expect(fetchPosts).toHaveBeenCalledWith({ categoryPath: '/harness', size: 2 });
    expect(fetchPosts).toHaveBeenCalledWith({ categoryPath: '/tech', size: 2 });
  });
});
