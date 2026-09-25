import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GNB from '../../components/GNB';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { PORTAL_PAGES, portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import AtlasHome from './AtlasHome';
import { domainLinks, kindCounts, pathFromRoot } from './atlasGraph';
import ConceptPanel from './ConceptPanel';
import DomainScreen from './DomainScreen';
import { useDescriptions, useGraph, useMediaQuery, usePostCounts } from './useAtlasData';
import './ConceptAtlas.css';

const NAV = [
  { label: '아틀라스', href: '/tech' },
  { label: '홈', href: '/' },
];

/**
 * `/tech` 개념 아틀라스 — 아틀라스(도메인 지도) → 도메인 병풍 → 개념 순으로 좁혀 간다.
 * 주소가 상태를 든다: `/tech` · `/tech/d/<domain>?sel=<conceptId>` · `/tech/c/<conceptId>` — 글에서 넘어오고 공유된다.
 * 그래프 구조는 빌드에 실린 정적 청크라 API 를 기다리지 않는다. 코드 · 글 · 질문만 개념 화면에서 API 로 받는다.
 */
export default function ConceptAtlasPage() {
  useHeritageSurface();
  const { domain: domainParam, conceptId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1024px)');
  const graph = useGraph();
  const postCounts = usePostCounts();
  const g = graph.data;

  const domainKey = conceptId ? g?.concepts.get(conceptId)?.domain : domainParam;
  const domain = g?.domains.find((d) => d.key === domainKey);
  const desc = useDescriptions(domain?.key);
  const atlas = useMemo(
    () => g && {
      domains: g.domains.map((d) => ({
        domain: d.key,
        rootId: d.rootId,
        name: d.name,
        description: d.description,
        conceptCount: d.conceptIds.length,
        kindCounts: kindCounts(g, d),
        codeRefCount: d.codeRefCount,
        conceptIds: d.conceptIds,
      })),
      links: domainLinks(g),
    },
    [g],
  );

  // 옛 주소의 `at` 은 고른 개념으로 읽는다 — 공유된 링크가 깨지지 않게
  const sel = params.get('sel') ?? params.get('at') ?? undefined;
  const select = useCallback(
    (id: string | null) => {
      if (!id) {
        if (domain) navigate(`/tech/d/${domain.key}`, { replace: true });
        return;
      }
      const target = g?.concepts.get(id)?.domain ?? domain?.key;
      navigate(`/tech/d/${target}?sel=${encodeURIComponent(id)}`, { replace: target === domain?.key });
    },
    [g, domain, navigate],
  );

  const seoPath = conceptId ? `/tech/c/${conceptId}` : domainParam ? `/tech/d/${domainParam}` : '/tech';
  useSeo({
    title: domain && !conceptId ? portalTitle(`${domain.name} · 개념 아틀라스`) : PORTAL_PAGES['/tech'].title,
    description: domain?.description ?? PORTAL_PAGES['/tech'].description,
    canonical: portalUrl(seoPath),
  });

  let body;
  if (graph.isLoading) {
    body = <main className="atlas-status"><p className="kh-skeleton atlas-skeleton" aria-label="불러오는 중" /></main>;
  } else if (graph.isError || !g || !atlas) {
    body = (
      <main className="atlas-status">
        <p>개념 그래프를 불러오지 못했다. 다른 서비스는 그대로 동작한다.</p>
        <button type="button" className="kh-button" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  } else if (!domainParam && !conceptId) {
    body = <AtlasHome atlas={atlas} postCounts={postCounts} wide={wide} />;
  } else if (conceptId) {
    // 개념 화면 — 코드 · 글 · 질문까지. 도메인에 놓이지 않은 개념도 관계는 보인다
    const path = domain ? pathFromRoot(g, domain.rootId, conceptId).slice(0, -1) : [];
    body = (
      <main className="atlas-concept-page">
        <Link className="atlas-back" to={domain ? `/tech/d/${domain.key}?sel=${encodeURIComponent(conceptId)}` : '/tech'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
          {domain ? `${domain.name} 병풍` : '아틀라스'}
        </Link>
        <ConceptPanel
          conceptId={conceptId}
          domain={domain?.key}
          path={path.map((id) => ({ id, name: g.concepts.get(id)?.name ?? id }))}
          owner={(id) => g.concepts.get(id)?.domain}
          domainName={(key) => g.domains.find((d) => d.key === key)?.name}
          variant="page"
        />
      </main>
    );
  } else if (!domain) {
    body = (
      <main className="atlas-status">
        <p>그런 도메인이 없다. <Link to="/tech">아틀라스로</Link></p>
      </main>
    );
  } else {
    body = (
      <DomainScreen
        key={domain.key}
        graph={g}
        domain={domain}
        sel={sel && g.concepts.has(sel) ? sel : undefined}
        descriptions={desc.data ?? {}}
        onSelect={select}
      />
    );
  }

  return (
    <div className="atlas-page">
      <GNB pageLabel="IT" items={NAV} />
      {body}
    </div>
  );
}
