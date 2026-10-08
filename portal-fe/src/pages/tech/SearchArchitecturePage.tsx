import GNB from '../../components/GNB';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { PORTAL_PAGES, breadcrumbJsonLd, portalUrl, techArticleJsonLd } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import generated from './generated/search-architecture.json';
import './SearchArchitecturePage.css';

const NAV = [
  { label: '아틀라스', href: '/tech' },
  { label: '검색 아키텍처', href: '/tech/search' },
  { label: '홈', href: '/' },
];

const { html, headings, updated, sourceHash, gitSha } = generated;

// 첫 h2 앞(제목 · 한 줄 요약 · 요약 불릿)을 목차와 나란히 첫 화면에 둔다. marked 가 h2 를
// 최상위 블록으로 내므로 문자열 경계가 곧 블록 경계다.
const splitAt = html.indexOf('<h2');
const summaryHtml = splitAt < 0 ? html : html.slice(0, splitAt);
const bodyHtml = splitAt < 0 ? '' : html.slice(splitAt);
const toc = headings.filter((h) => h.level === 2 || h.level === 3);

/**
 * `/tech/search` — 관광지 검색과 통합 검색의 구조·흐름·기법.
 * 본문은 레포의 `src/content/search-architecture.md` 를 빌드 때 렌더한 산출물이다.
 */
export default function SearchArchitecturePage() {
  useHeritageSurface();
  useSeo({
    ...PORTAL_PAGES['/tech/search'],
    canonical: portalUrl('/tech/search'),
    // 프리렌더와 같은 구성이어야 한다 — 하이드레이션이 정적 HTML 의 것을 갈아끼운다
    jsonLd: [
      techArticleJsonLd(updated),
      breadcrumbJsonLd('ko', [
        { name: '홈', url: portalUrl('/') },
        { name: 'IT', url: portalUrl('/tech') },
        { name: '검색 아키텍처', url: portalUrl('/tech/search') },
      ]),
    ],
  });

  return (
    <div className="ts-page" data-source-hash={sourceHash}>
      <GNB pageLabel="IT" items={NAV} />
      <main className="ts-main">
        <p className="ts-build">빌드 커밋 {gitSha} · 문서 갱신 {updated}</p>
        <div className="ts-top">
          {/* 런타임 sanitize 를 두지 않는다 — 레포에 커밋된 md 에서만 나오고, 렌더 스크립트의 출력 계약 검사를 통과한 빌드 산출물이다 */}
          <section className="ts-doc ts-summary" aria-label="요약" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
          <nav className="ts-toc" aria-label="목차">
            <p className="ts-toc-title">목차</p>
            <ol>
              {toc.map((h) => (
                <li key={h.id} className={h.level === 3 ? 'ts-toc-sub' : undefined}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <article className="ts-doc ts-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </main>
    </div>
  );
}
