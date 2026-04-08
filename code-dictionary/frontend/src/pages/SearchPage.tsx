import { useState, useRef, useCallback, useEffect } from 'react';
import { useGraphData } from '../hooks/useGraphData';
import SearchBar from '../components/SearchBar';
import Carousel3D from '../components/Carousel3D';
import ForceGraph3D from '../components/graph/ForceGraph3D';
import HeatmapPanel from '../components/panels/HeatmapPanel';
import StatsDashboard from '../components/panels/StatsDashboard';
import TreemapPanel from '../components/panels/TreemapPanel';
import DetailSidePanel from '../components/DetailSidePanel';
import { searchConcepts } from '../api/searchApi';
import type { GraphRenderer, GraphNode } from '../types/graph';

export default function SearchPage() {
  const { data, loading, error } = useGraphData();
  const graphRef = useRef<GraphRenderer>(null);

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [dimmed, setDimmed] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedConceptId(node.id);
    const related = data?.links
      .filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
        return src === node.id || tgt === node.id;
      })
      .map((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
        return src === node.id ? tgt : src;
      }) ?? [];

    setHighlightedNodes(new Set([node.id, ...related]));
    setDimmed(true);
    graphRef.current?.focusNode(node.id);
  }, [data]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedConceptId(null);
    setHighlightedNodes(new Set());
    setDimmed(false);
    graphRef.current?.resetView();
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    try {
      const result = await searchConcepts(query, undefined, undefined, 0, 50);
      const matchIds = new Set(result.hits.map((h) => h.conceptId));
      setHighlightedNodes(matchIds);
      setDimmed(true);
      setCarouselIndex(0);
      if (result.hits.length > 0) {
        graphRef.current?.focusNode(result.hits[0].conceptId);
      }
    } catch {
      // search failed silently
    }
  }, []);

  const handleSelectConcept = useCallback((conceptId: string) => {
    setSelectedConceptId(conceptId);
    setHighlightedNodes(new Set([conceptId]));
    setDimmed(true);
    setCarouselIndex(0);
    graphRef.current?.focusNode(conceptId);
  }, []);

  const handleHeatmapClick = useCallback((category: string, level: string) => {
    if (!data) return;
    const matching = data.nodes.filter((n) => n.category === category && n.level === level);
    setHighlightedNodes(new Set(matching.map((n) => n.id)));
    setDimmed(true);
    setCarouselIndex(0);
    if (matching.length > 0) {
      graphRef.current?.focusNode(matching[0].id);
    }
  }, [data]);

  const handleTreemapClick = useCallback((conceptId: string) => {
    handleSelectConcept(conceptId);
    setCarouselIndex(0);
  }, [handleSelectConcept]);

  const handleNavigate = useCallback((conceptId: string) => {
    handleSelectConcept(conceptId);
  }, [handleSelectConcept]);

  if (loading) {
    return (
      <div className="viz-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888' }}>Loading concept graph...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="viz-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#ff6b6b' }}>{error || 'Failed to load data'}</p>
      </div>
    );
  }

  const panels = [
    {
      key: 'graph',
      label: 'Graph',
      content: (
        <div ref={containerRef} className="carousel-slide-inner" style={{ width: '100%', height: '100%' }}>
          <ForceGraph3D
            ref={graphRef}
            nodes={data.nodes}
            links={data.links}
            highlightedNodes={highlightedNodes}
            dimmed={dimmed}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            width={containerSize.width}
            height={containerSize.height}
          />
        </div>
      ),
      preview: <div className="carousel-preview-card">Concept Graph</div>,
    },
    {
      key: 'heatmap',
      label: 'Heatmap',
      content: (
        <div className="carousel-slide-inner">
          <HeatmapPanel matrix={data.stats.matrix} onCellClick={handleHeatmapClick} />
        </div>
      ),
      preview: <div className="carousel-preview-card">Heatmap</div>,
    },
    {
      key: 'stats',
      label: 'Statistics',
      content: (
        <div className="carousel-slide-inner">
          <StatsDashboard stats={data.stats} />
        </div>
      ),
      preview: <div className="carousel-preview-card">Statistics</div>,
    },
    {
      key: 'treemap',
      label: 'Treemap',
      content: (
        <div className="carousel-slide-inner">
          <TreemapPanel nodes={data.nodes} onNodeClick={handleTreemapClick} />
        </div>
      ),
      preview: <div className="carousel-preview-card">Treemap</div>,
    },
  ];

  return (
    <div className="viz-page">
      <div className="search-bar-overlay">
        <SearchBar onSearch={handleSearch} onSelectConcept={handleSelectConcept} />
      </div>

      <Carousel3D panels={panels} activeIndex={carouselIndex} onActiveChange={setCarouselIndex} />

      <DetailSidePanel
        conceptId={selectedConceptId}
        onClose={handleBackgroundClick}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
