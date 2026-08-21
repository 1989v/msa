import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useGraphData } from '../hooks/useGraphData';
import SearchBar from '../components/SearchBar';
import ForceGraph3D from '../components/graph/ForceGraph3D';
import HeatmapPanel from '../components/panels/HeatmapPanel';
import StatsDashboard from '../components/panels/StatsDashboard';
import TreemapPanel from '../components/panels/TreemapPanel';
import TreemapSection from '../components/graph/TreemapSection';
import DomainMap from '../components/domainmap/DomainMap';
import {
  INITIAL_DRILLDOWN,
  DOMAIN_NODE_PREFIX,
  buildDomainModel,
  clearEmphasis,
  computeVisible,
  domainIdOfCategory,
  domainNodeId,
  revealCategory,
  revealConcepts,
  selectConcept,
  toggleDomain,
} from '../components/domainmap/domainModel';
import type { DrilldownState, VisibleNode } from '../components/domainmap/domainModel';
import DetailSidePanel from '../components/DetailSidePanel';
import GNB from '../components/GNB';
import { portalTitle, portalUrl, websiteJsonLd } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import HeroSection from '../components/HeroSection';
import CategoryChips from '../components/CategoryChips';
import PopularConcepts from '../components/PopularConcepts';
import ServiceCatalog from '../components/ServiceCatalog';
import AboutSection from '../components/AboutSection';
import Footer from '../components/Footer';
import { searchConcepts } from '../api/searchApi';
import type { GraphRenderer, GraphNode } from '../types/graph';
import type { Category } from '../types/index';
import './SearchPage.css';

/** 보조 뷰 — 도메인 맵이 기본, 기존 시각화는 명시적 전환 뒤에 둔다 */
const VIEWS = [
  { key: 'map', label: '도메인 맵' },
  { key: 'treemap', label: '트리맵' },
  { key: 'graph3d', label: '3D 그래프' },
  { key: 'concept-treemap', label: '개념 트리맵' },
  { key: 'heatmap', label: '히트맵' },
  { key: 'stats', label: '통계' },
] as const;

type ViewKey = (typeof VIEWS)[number]['key'];

export default function SearchPage() {
  useSeo({
    title: portalTitle('IT'),
    description:
      '코드베이스에서 추출한 IT 개념을 트리맵·그래프로 탐색하는 개념 사전. 백엔드 아키텍처 포트폴리오와 MSA 서비스 카탈로그를 함께 제공합니다.',
    canonical: portalUrl('/tech'),
    jsonLd: [websiteJsonLd()],
  });
  const { data, loading, error } = useGraphData();
  const graphRef = useRef<GraphRenderer>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const model = useMemo(() => (data ? buildDomainModel(data) : null), [data]);
  const [drill, setDrill] = useState<DrilldownState>(INITIAL_DRILLDOWN);
  const [view, setView] = useState<ViewKey>('map');
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const visible = useMemo(
    () => (model ? computeVisible(model, drill) : { nodes: [], links: [] }),
    [model, drill],
  );

  // 3D 그래프 뷰 전용 크기 측정 — 예전 window.innerWidth*0.9 고정값 대체
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setStageSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error]);

  const bumpFocus = useCallback((id: string) => {
    setFocus((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  /** 개념 선택 공통 경로 — 자동완성/인기 개념/카탈로그/트리맵 타일/상세 패널 내비게이션 */
  const handleSelectConcept = useCallback(
    (conceptId: string) => {
      if (!model) return;
      setDrill((prev) => selectConcept(prev, model, conceptId));
      if (model.nodesById.has(conceptId)) {
        if (view === 'graph3d') {
          graphRef.current?.focusNode(conceptId, true);
        } else {
          setView('map');
          bumpFocus(conceptId);
        }
      }
    },
    [model, view, bumpFocus],
  );

  /** 검색 실행 — 히트를 도메인 맵에 드러내고 첫 히트로 카메라 이동 */
  const handleSearch = useCallback(
    async (query: string) => {
      if (!model) return;
      try {
        const result = await searchConcepts(query, undefined, undefined, 0, 50);
        const hitIds = result.hits.map((h) => h.conceptId);
        setDrill((prev) => revealConcepts(prev, model, hitIds));
        setView('map');
        const firstKnown = hitIds.find((id) => model.nodesById.has(id));
        if (firstKnown) bumpFocus(firstKnown);
      } catch {
        // search failed silently
      }
    },
    [model, bumpFocus],
  );

  /** 카테고리 칩 — 해당 카테고리 개념을 맵에 펼쳐 강조 */
  const handleCategoryFilter = useCallback(
    (category: Category | null) => {
      if (!model) return;
      if (category === null) {
        setDrill((prev) => clearEmphasis(prev));
        return;
      }
      setDrill((prev) => revealCategory(prev, model, category));
      setView('map');
      bumpFocus(domainNodeId(domainIdOfCategory(category)));
    },
    [model, bumpFocus],
  );

  const handleHeatmapClick = useCallback(
    (category: string, level: string) => {
      if (!model || !data) return;
      const ids = data.nodes.filter((n) => n.category === category && n.level === level).map((n) => n.id);
      setDrill((prev) => revealConcepts(prev, model, ids));
      setView('map');
      if (ids.length > 0) bumpFocus(ids[0]);
    },
    [model, data, bumpFocus],
  );

  const handleTreemapCategoryClick = useCallback(
    (category: string) => {
      handleCategoryFilter(category as Category);
    },
    [handleCategoryFilter],
  );

  const handleMapNodeClick = useCallback(
    (node: VisibleNode) => {
      if (!model) return;
      if (node.kind === 'domain') {
        setDrill((prev) => toggleDomain(prev, model, node.id.slice(DOMAIN_NODE_PREFIX.length)));
        bumpFocus(node.id);
        return;
      }
      setDrill((prev) => selectConcept(prev, model, node.id));
      bumpFocus(node.id);
    },
    [model, bumpFocus],
  );

  /** 배경 클릭/ESC/패널 닫기 — 강조·선택만 걷어내고 펼친 구조는 유지 */
  const handleClearEmphasis = useCallback(() => {
    setDrill((prev) => clearEmphasis(prev));
    if (view === 'graph3d') graphRef.current?.resetView();
  }, [view]);

  const handleMapReset = useCallback(() => {
    setDrill(INITIAL_DRILLDOWN);
    setFocus(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClearEmphasis();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearEmphasis]);

  // 3D 그래프 뷰의 노드 클릭 — 뷰 전환 없이 그 자리에서 선택
  const handle3DNodeClick = useCallback(
    (node: GraphNode) => {
      if (!model) return;
      setDrill((prev) => selectConcept(prev, model, node.id));
      graphRef.current?.focusNode(node.id, true);
    },
    [model],
  );

  const highlightedSet = useMemo(() => new Set(drill.highlighted), [drill.highlighted]);

  const handleSearchFocus = useCallback(() => {
    if (searchBarRef.current) {
      searchBarRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = searchBarRef.current.querySelector('input');
      if (input) {
        setTimeout(() => input.focus(), 400);
      }
    }
  }, []);

  if (loading) {
    return (
      <div className="viz-page-scroll tech-status-screen">
        <p className="tech-status-text">개념 그래프를 불러오는 중…</p>
      </div>
    );
  }

  if (error || !data || !model) {
    // code-dictionary 백엔드 unavailable 시 (5xx / network) graceful fallback —
    // 메인 페이지가 빈 에러 메시지만 보이지 않도록 안내 + 다른 서비스 진입 링크.
    return (
      <div className="viz-page-scroll tech-status-screen tech-fallback">
        <h2 className="tech-fallback-title">1989v</h2>
        <p className="tech-fallback-desc">
          코드 사전 백엔드가 일시적으로 응답하지 않습니다. 다른 서비스는 정상 동작 중입니다.
        </p>
        <p className="tech-fallback-detail">{error ? `(${error})` : ''}</p>
        <div className="tech-fallback-links">
          <a href="/quant/">Quant 트레이딩</a>
          <a href="/admin/">Admin</a>
          <a href="/gifticon/">기프티콘</a>
          <a href="/agent-viewer/">Agent Viewer</a>
        </div>
        <button type="button" className="tech-fallback-retry" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="viz-page-scroll">
      <GNB pageLabel="IT" onSearchFocus={handleSearchFocus} />

      <section id="tech">
        <HeroSection stats={data.stats} serviceCount={9} />
        <div className="search-bar-section" ref={searchBarRef}>
          <SearchBar onSearch={handleSearch} onSelectConcept={handleSelectConcept} />
        </div>
        <CategoryChips onCategoryFilter={handleCategoryFilter} />

        <div className="tech-stage-wrap">
          <div className="tech-toolbar">
            <div className="tech-view-tabs" role="tablist" aria-label="시각화 뷰 선택">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={view === v.key}
                  className={`tech-view-tab ${view === v.key ? 'is-active' : ''}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {view === 'map' && (
              <button type="button" className="tech-map-reset" onClick={handleMapReset}>
                처음으로
              </button>
            )}
          </div>

          <div className="tech-stage" ref={stageRef}>
            {view === 'map' && (
              <DomainMap
                graph={visible}
                highlighted={drill.highlighted}
                selectedId={drill.selected}
                focus={focus}
                onNodeClick={handleMapNodeClick}
                onBackgroundClick={handleClearEmphasis}
              />
            )}
            {view === 'treemap' && <TreemapSection onTileClick={handleSelectConcept} />}
            {view === 'graph3d' && stageSize.width > 0 && (
              <ForceGraph3D
                ref={graphRef}
                nodes={data.nodes}
                links={data.links}
                highlightedNodes={highlightedSet}
                dimmed={drill.highlighted.size > 0}
                onNodeClick={handle3DNodeClick}
                onBackgroundClick={handleClearEmphasis}
                width={stageSize.width}
                height={stageSize.height}
              />
            )}
            {view === 'concept-treemap' && (
              <TreemapPanel
                nodes={data.nodes}
                onNodeClick={handleSelectConcept}
                onCategoryClick={handleTreemapCategoryClick}
              />
            )}
            {view === 'heatmap' && <HeatmapPanel matrix={data.stats.matrix} onCellClick={handleHeatmapClick} />}
            {view === 'stats' && <StatsDashboard stats={data.stats} />}
          </div>

          {view === 'map' && (
            <p className="tech-map-hint">
              도메인을 누르면 핵심 개념이, 개념을 누르면 연관 개념과 상세가 펼쳐집니다 — 드래그로 이동 · 휠/핀치로
              확대
            </p>
          )}
        </div>

        <PopularConcepts nodes={data.nodes} onConceptClick={handleSelectConcept} />
      </section>

      <ServiceCatalog onConceptClick={handleSelectConcept} />

      <section id="about">
        <AboutSection stats={data.stats} />
      </section>

      <Footer />

      <DetailSidePanel
        conceptId={drill.selected}
        onClose={handleClearEmphasis}
        onNavigate={handleSelectConcept}
      />
    </div>
  );
}
