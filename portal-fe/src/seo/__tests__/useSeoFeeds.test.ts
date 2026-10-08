import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { placeFeed, SEO_MULTI_ATTR } from '../copy.mjs';
import { useSeo, type SeoInput } from '../useSeo';

/** useSeo 가 head 에 실제로 남긴 피드 링크 — (제목, 주소, 관리 표시) */
function feedLinks() {
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][type="application/rss+xml"]')].map(
    (el) => ({ title: el.title, href: el.getAttribute('href'), multi: el.hasAttribute(SEO_MULTI_ATTR) }),
  );
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('useSeo — feeds', () => {
  it('feeds 를 MULTI 블록에 피드 링크로 담는다', () => {
    renderHook(() => useSeo({ title: 'T', feeds: [placeFeed('ko')] }));

    expect(feedLinks()).toEqual([
      { title: 'K-관광 — 최근 바뀐 관광지', href: 'https://place.1989v.com/feed.xml', multi: true },
    ]);
  });

  it('서버 렌더가 심은 같은 링크가 있어도 다시 불렀을 때 한 벌만 남는다', () => {
    // 서버 렌더(AttractionPageRenderer) 산출물과 같은 모양
    document.head.insertAdjacentHTML(
      'beforeend',
      `<link rel="alternate" type="application/rss+xml" title="K-관광 — 최근 바뀐 관광지" href="https://place.1989v.com/feed.xml" ${SEO_MULTI_ATTR} />`,
    );
    const { rerender } = renderHook((input: SeoInput) => useSeo(input), {
      initialProps: { title: 'A', feeds: [placeFeed('ko')] } as SeoInput,
    });
    expect(feedLinks()).toHaveLength(1);

    rerender({ title: 'B', lang: 'en', feeds: [placeFeed('en')] });
    expect(feedLinks()).toEqual([
      { title: 'K-Tour — Recently Updated Attractions', href: 'https://place.1989v.com/en/feed.xml', multi: true },
    ]);
  });

  it('feeds 가 없는 화면으로 가면 피드 링크가 사라진다', () => {
    const { rerender } = renderHook((input: SeoInput) => useSeo(input), {
      initialProps: { title: 'A', feeds: [placeFeed('ko')] } as SeoInput,
    });
    rerender({ title: 'B' });
    expect(feedLinks()).toEqual([]);
  });
});
