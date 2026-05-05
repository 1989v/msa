import { useEffect, useMemo, useState } from 'react';
import { fetchTreemapStats } from '../../api/treemap';
import type { TreemapDataDto } from '../../api/treemap';
import TreemapView from './TreemapView';
import CategoryChipStrip from './CategoryChipStrip';
import { categorySwatch } from './tileColor';
import './TreemapSection.css';

/**
 * TreemapSection — chip strip + treemap + legend composition.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.1
 *
 * Owns:
 *  - selected categories state (Set<string>)
 *  - data fetch (refetch on selection change)
 *  - legend rendering (BEGINNER / INTERMEDIATE / ADVANCED counts + total)
 */

export interface TreemapSectionProps {
  onTileClick: (conceptId: string) => void;
}

export default function TreemapSection({ onTileClick }: TreemapSectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [data, setData] = useState<TreemapDataDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTreemapStats({
      categories: selected.size > 0 ? Array.from(selected) : undefined,
      includeZeroIndex: false,
    })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load treemap stats';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Chip list — we use ALL categories from response.totals.byCategory so chips
  // remain stable across selection changes; counts come from totals.byCategory.
  const chipItems = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.totals.byCategory)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const handleToggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleClearAll = () => setSelected(new Set());

  return (
    <div className="ko-treemap-section">
      <header className="ko-treemap-header">
        <h2 className="ko-treemap-title">카테고리 분포</h2>
      </header>

      <CategoryChipStrip
        categories={chipItems}
        selected={selected}
        onToggle={handleToggle}
        onClearAll={handleClearAll}
      />

      <div className="ko-treemap-canvas">
        {loading && !data && (
          <div className="ko-treemap-status">Loading…</div>
        )}
        {error && (
          <div className="ko-treemap-status ko-treemap-status--error">{error}</div>
        )}
        {data && <TreemapView data={data} onTileClick={onTileClick} />}
      </div>

      {data && (
        <footer className="ko-treemap-legend" aria-label="범례 — 카테고리 색상 + 레벨 합계">
          {/* 카테고리 색상 — 단일 축 인코딩 (카테고리=색) */}
          <span className="ko-legend-group ko-legend-categories" aria-label="카테고리 색상">
            <span className="ko-legend-label">카테고리</span>
            {Object.keys(data.totals.byCategory)
              .filter((c) => (data.totals.byCategory[c] ?? 0) > 0)
              .map((cat) => (
                <span key={cat} className="ko-legend-cat-item" title={`${cat} (${data.totals.byCategory[cat]})`}>
                  <span
                    className="ko-legend-dot"
                    aria-hidden="true"
                    style={{ background: categorySwatch(cat) }}
                  />
                  <span className="ko-legend-mini">{cat}</span>
                </span>
              ))}
          </span>

          {/* 레벨별 합계 (텍스트만 — 색상 인코딩 X) */}
          <span className="ko-legend-group" aria-label="레벨별 concept 합계">
            <span className="ko-legend-label">난이도</span>
            <span className="ko-legend-mini">입문 {data.totals.byLevel.BEGINNER ?? 0}</span>
            <span className="ko-legend-mini">중급 {data.totals.byLevel.INTERMEDIATE ?? 0}</span>
            <span className="ko-legend-mini">심화 {data.totals.byLevel.ADVANCED ?? 0}</span>
          </span>

          <span className="ko-legend-total">
            Total <span className="ko-legend-count">{data.totals.totalConcepts}</span>
          </span>
        </footer>
      )}
    </div>
  );
}
