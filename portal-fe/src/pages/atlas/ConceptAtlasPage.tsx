import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import GNB from '../../components/GNB';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { PORTAL_PAGES, portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import AtlasHome from './AtlasHome';
import ConceptPanel from './ConceptPanel';
import DomainDesktop from './DomainDesktop';
import DomainMobile from './DomainMobile';
import { useAtlas, useDomainTree, useMediaQuery, useOwnerIndex, usePostCounts } from './useAtlasData';
import './ConceptAtlas.css';

const NAV = [
  { label: '아틀라스', href: '/tech' },
  { label: '홈', href: '/' },
];

/**
 * `/tech` 개념 아틀라스 — 아틀라스(도메인 열한 개) → 도메인 그래프 → 개념 순으로 좁혀 간다.
 * 주소가 상태를 든다: `/tech` · `/tech/d/<domain>?at=&sel=` · `/tech/c/<conceptId>` — 글에서 넘어오고 공유된다.
 */
export default function ConceptAtlasPage() {
  useHeritageSurface();
  const { domain: domainParam, conceptId } = useParams();
  const [params] = useSearchParams();
  const wide = useMediaQuery('(min-width: 1024px)');
  const atlas = useAtlas();
  const owner = useOwnerIndex();
  const postCounts = usePostCounts();
  const domainNames = useMemo(
    () => new Map((atlas.data?.domains ?? []).map((d) => [d.domain, d.name])),
    [atlas.data],
  );

  const domain = conceptId ? owner.get(conceptId) : domainParam;
  const atlasDomain = atlas.data?.domains.find((d) => d.domain === domain);
  const { tree, isLoading: treeLoading } = useDomainTree(atlasDomain?.rootId);

  const seoPath = conceptId ? `/tech/c/${conceptId}` : domainParam ? `/tech/d/${domainParam}` : '/tech';
  useSeo({
    title: atlasDomain && !conceptId ? portalTitle(`${atlasDomain.name} · 개념 아틀라스`) : PORTAL_PAGES['/tech'].title,
    description: atlasDomain?.description ?? PORTAL_PAGES['/tech'].description,
    canonical: portalUrl(seoPath),
  });

  let body;
  if (atlas.isLoading) {
    body = <main className="atlas-status"><p className="kh-skeleton atlas-skeleton" aria-label="불러오는 중" /></main>;
  } else if (atlas.isError || !atlas.data) {
    body = (
      <main className="atlas-status">
        <p>개념 사전 백엔드가 지금 응답하지 않는다. 다른 서비스는 그대로 동작한다.</p>
        <button type="button" className="kh-button" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  } else if (!domainParam && !conceptId) {
    body = <AtlasHome atlas={atlas.data} postCounts={postCounts} wide={wide} />;
  } else if (domainParam && !atlasDomain) {
    body = (
      <main className="atlas-status">
        <p>그런 도메인이 없다. <Link to="/tech">아틀라스로</Link></p>
      </main>
    );
  } else if (conceptId && !wide) {
    // 모바일 개념 화면 — 도메인에 놓이지 않은 개념도 관계 · 코드 · 글은 보인다
    body = (
      <main className="atlas-concept-page">
        <Link className="atlas-back" to={domain ? `/tech/d/${domain}?at=${encodeURIComponent(conceptId)}` : '/tech'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
          {atlasDomain ? `${atlasDomain.name} 그래프` : '아틀라스'}
        </Link>
        <ConceptPanel conceptId={conceptId} domain={domain} tree={tree} owner={owner} domainNames={domainNames} variant="page" />
      </main>
    );
  } else if (treeLoading || !tree || !domain) {
    body = conceptId && !domain ? (
      <main className="atlas-concept-page">
        <ConceptPanel conceptId={conceptId} tree={null} owner={owner} domainNames={domainNames} variant="page" />
      </main>
    ) : (
      <main className="atlas-status"><p className="kh-skeleton atlas-skeleton" aria-label="불러오는 중" /></main>
    );
  } else {
    const at = conceptId ?? params.get('at') ?? tree.rootId;
    const sel = conceptId ?? params.get('sel') ?? undefined;
    body = wide ? (
      <DomainDesktop atlas={atlas.data} domain={domain} tree={tree} at={at} sel={sel ?? at} owner={owner} domainNames={domainNames} />
    ) : (
      <DomainMobile domain={domain} tree={tree} at={at} sel={sel} owner={owner} domainNames={domainNames} postCounts={postCounts} />
    );
  }

  return (
    <div className="atlas-page">
      <GNB pageLabel="IT" items={NAV} />
      {body}
    </div>
  );
}
