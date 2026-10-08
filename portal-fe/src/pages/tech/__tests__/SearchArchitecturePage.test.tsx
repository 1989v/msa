import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

/**
 * 기대값은 전부 생성 JSON(`render-content.mjs` 산출물)에서 계산한다 — 원본 md 의 문장이 바뀌어도
 * 이 테스트는 페이지가 그 산출물을 빠짐없이 그리는지만 본다.
 */

const heritage = vi.hoisted(() => vi.fn());
const seo = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useHeritageSurface', () => ({
  useHeritageSurface: heritage,
  useHeritageTheme: () => ['light', () => undefined],
}));
vi.mock('../../../seo/useSeo', () => ({ useSeo: seo }));
vi.mock('../../../components/AuthButton', () => ({ default: () => null }));
vi.mock('../../../api/resumeApi', () => ({ fetchResumeStatus: () => Promise.resolve(false) }));

import generated from '../generated/search-architecture.json';
import { PORTAL_PAGES } from '../../../seo/copy.mjs';
import SearchArchitecturePage from '../SearchArchitecturePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tech/search']}>
      <SearchArchitecturePage />
    </MemoryRouter>,
  );
}

const tocHeadings = generated.headings.filter((h) => h.level === 2 || h.level === 3);
const h1 = generated.headings.find((h) => h.level === 1);

describe('SearchArchitecturePage', () => {
  it('목차는 level 2·3 제목마다 링크 하나이고, 링크마다 본문에 대상 id 가 있다', () => {
    renderPage();
    const toc = screen.getByRole('navigation', { name: '목차' });
    const links = within(toc).getAllByRole('link');
    expect(links).toHaveLength(tocHeadings.length);
    links.forEach((a, i) => {
      expect(a.getAttribute('href')).toBe(`#${tocHeadings[i].id}`);
      expect(a.textContent).toBe(tocHeadings[i].text);
      expect(document.getElementById(tocHeadings[i].id)).not.toBeNull();
    });
  });

  it('K-Heritage 표면을 켠다', () => {
    renderPage();
    expect(heritage).toHaveBeenCalled();
  });

  it('요약 블록은 첫 h2 앞까지(h1 포함)를 담고, 본문 h2 는 요약 밖에 있다', () => {
    const { container } = renderPage();
    const summary = screen.getByRole('region', { name: '요약' });
    expect(within(summary).getByRole('heading', { level: 1 }).textContent).toBe(h1?.text);
    expect(within(summary).queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    const h2Count = generated.headings.filter((h) => h.level === 2).length;
    expect(container.querySelectorAll('h2')).toHaveLength(h2Count);
  });

  it('루트에 원본 해시, 상단에 빌드 커밋 · 문서 갱신 줄', () => {
    const { container } = renderPage();
    expect(container.querySelector('[data-source-hash]')?.getAttribute('data-source-hash')).toBe(generated.sourceHash);
    expect(screen.getByText(`빌드 커밋 ${generated.gitSha} · 문서 갱신 ${generated.updated}`)).toBeInTheDocument();
  });

  it('생성 그림을 펜스 수만큼 그린다', () => {
    const { container } = renderPage();
    const expected = (generated.html.match(/role="img"/g) ?? []).length;
    expect(container.querySelectorAll('figure.fs-figure svg[role="img"]')).toHaveLength(expected);
  });

  it('SEO 는 canonical 과 TechArticle · BreadcrumbList 를 주고 og:type 은 정하지 않는다', () => {
    renderPage();
    const input = seo.mock.calls.at(-1)?.[0];
    expect(input.title).toBe(PORTAL_PAGES['/tech/search'].title);
    expect(input.description).toBe(PORTAL_PAGES['/tech/search'].description);
    expect(input.canonical).toBe('https://1989v.com/tech/search');
    expect(input.type).toBeUndefined();
    expect(input.jsonLd.map((j: { '@type': string }) => j['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
    expect(input.jsonLd[0].dateModified).toBe(generated.updated);
  });
});
