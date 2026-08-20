import { describe, expect, it } from 'vitest';
import {
  BLOG_BRAND,
  BLOG_ORIGIN,
  blogAuthorUrl,
  blogBreadcrumbJsonLd,
  blogCategoryUrl,
  blogHubMeta,
  blogPostMeta,
  blogPostUrl,
  blogPostingJsonLd,
  blogPrivateMeta,
} from '../copy.mjs';

/**
 * 이 카피는 서버 렌더(`blog/feature` 의 `BlogSeoCopy`)와 쌍이다 (ADR-0072 §6).
 * 형식이 바뀌면 크롤러가 본 제목과 탭 제목이 갈라지므로 여기서 고정한다.
 */
describe('blog SEO copy', () => {
  const post = {
    slug: 'search-index',
    title: '검색 색인 이야기',
    summary: '요약입니다',
    coverImageUrl: 'https://cdn.example.com/c.png',
    categoryName: '검색',
    publishedAt: '2026-08-21T09:00:00',
    author: { displayName: '권기덕', handle: 'kgd' },
    ratingAverage: 4.5,
    ratingCount: 4,
  };

  it('URL 은 blog 호스트의 절대 주소다 — 공유 링크가 apex 로 새면 canonical 이 갈린다', () => {
    expect(blogPostUrl('a')).toBe(`${BLOG_ORIGIN}/posts/a`);
    expect(blogAuthorUrl('kgd')).toBe(`${BLOG_ORIGIN}/authors/kgd`);
    expect(blogCategoryUrl('/tech/server')).toBe(`${BLOG_ORIGIN}/c/tech/server`);
  });

  it('글 제목은 "제목 | 브랜드" 형식 — 서버 BlogSeoCopy.postTitle 과 같아야 한다', () => {
    expect(blogPostMeta(post).title).toBe(`검색 색인 이야기 | ${BLOG_BRAND}`);
    expect(blogPostMeta(post).canonical).toBe(`${BLOG_ORIGIN}/posts/search-index`);
    expect(blogPostMeta(post).type).toBe('article');
  });

  it('허브 설명은 글 수를 반영하고 길이 상한을 넘지 않는다', () => {
    expect(blogHubMeta(12).description).toContain('12');
    expect(blogHubMeta(0).description.length).toBeLessThanOrEqual(155);
  });

  it('스튜디오 같은 화면은 noindex 다', () => {
    expect(blogPrivateMeta('내 스튜디오').noindex).toBe(true);
  });

  it('평점이 있으면 aggregateRating 이 붙고, 없으면 붙지 않는다', () => {
    expect(blogPostingJsonLd(post).aggregateRating?.ratingValue).toBe('4.5');
    expect(blogPostingJsonLd({ ...post, ratingCount: 0 }).aggregateRating).toBeUndefined();
  });

  it('브레드크럼이 비면 JSON-LD 를 만들지 않는다 — 빈 목록을 넣으면 검증 경고가 뜬다', () => {
    expect(blogBreadcrumbJsonLd([])).toBeNull();
    expect(blogBreadcrumbJsonLd([{ name: '기술', path: '/tech' }])?.itemListElement).toHaveLength(1);
  });
});
