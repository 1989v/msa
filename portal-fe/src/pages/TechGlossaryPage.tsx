import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PORTAL_ORIGIN,
  TECH_CATEGORY_KO,
  breadcrumbJsonLd,
  definedTermSetJsonLd,
  techCategoryFromSlug,
  techGlossaryMeta,
  techGlossaryPath,
} from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { fetchConcepts, type Concept } from '../api/searchApi';
import NotFoundPage from './NotFoundPage';
import './TechGlossaryPage.css';

/**
 * 분류별 용어집 — `/tech/data-structure` 같은 주소.
 *
 * 개념 하나에 URL 하나를 주지 않는다. 162개 중 풀이 중앙값이 29자라(2026-09-10 실측)
 * 개념당 한 장이면 제목 + 한 문장짜리 페이지가 162장 생기고, 이 사이트는 이미 같은 이유로
 * 광고 심사에서 사이트 전체가 반려된 적이 있다 (ADR-0062 §8). 분류로 묶으면 한 장이
 * 8~20개 용어를 들고 있어 그 자체로 읽힌다.
 */
export default function TechGlossaryPage() {
  const { category: slug = '' } = useParams();
  // 슬러그 판정은 copy.mjs 가 한다 — 모르는 슬러그면 null 이고 그때는 404 다
  const category: string | null = techCategoryFromSlug(slug);
  const labels: Record<string, string> = TECH_CATEGORY_KO;

  const { data: concepts } = useQuery({
    queryKey: ['concepts', 'all'],
    queryFn: fetchConcepts,
    staleTime: 30 * 60_000,
    enabled: category != null,
  });

  const items = (concepts ?? [])
    .filter((c) => c.category === category)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  // 데이터가 오기 전에는 메타를 건드리지 않는다 — 프리렌더가 심어 둔 정확한 값이 이긴다
  const meta = category && items.length > 0 ? techGlossaryMeta(category, items) : null;
  useSeo(
    meta
      ? {
          ...meta,
          // 프리렌더와 **같은 구성**이어야 한다 — 하이드레이션이 그쪽을 갈아끼우므로
          // 여기서 빠뜨리면 정적 HTML 에 있던 breadcrumb 이 렌더 후 사라진다.
          jsonLd: [
            definedTermSetJsonLd(category!, items),
            breadcrumbJsonLd('ko', [
              { name: 'IT 개념 사전', url: `${PORTAL_ORIGIN}/tech` },
              { name: meta.heading, url: meta.canonical },
            ]),
          ],
        }
      : { title: '' },
  );

  // 없는 분류 주소는 없는 페이지다 — 빈 용어집을 200 으로 그리지 않는다
  if (!category) return <NotFoundPage />;

  const others = Object.keys(labels).filter((c) => c !== category);

  return (
    <div className="glossary">
      <nav className="glossary-crumb">
        <Link to="/tech">IT 개념 사전</Link>
      </nav>
      <h1 className="glossary-title">{labels[category]} 용어집</h1>
      <p className="glossary-lede">
        {items.length > 0
          ? `${labels[category]} 분야의 개념 ${items.length}개.`
          : '개념을 불러오는 중…'}
      </p>

      <dl className="glossary-terms">
        {items.map((c) => (
          <div key={c.conceptId} className="glossary-row">
            <dt>
              {c.name}
              {c.synonyms?.length ? <span className="glossary-alt">{c.synonyms.join(', ')}</span> : null}
            </dt>
            <dd>{c.description}</dd>
          </div>
        ))}
      </dl>

      <h2 className="glossary-more">다른 분류</h2>
      <ul className="glossary-nav">
        {others.map((c) => (
          <li key={c}>
            <Link to={techGlossaryPath(c)}>{labels[c]}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { Concept };
