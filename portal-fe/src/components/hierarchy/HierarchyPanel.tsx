import { useEffect, useMemo, useState } from 'react';
import { fetchConceptHierarchy } from '../../api/searchApi';
import type { ConceptHierarchy } from '../../types/graph';
import { CATEGORY_LABELS } from '../../types';
import { buildHierarchyModel, initialExpanded, toggleExpanded, visibleRows } from './hierarchyModel';
import type { HierarchyRow } from './hierarchyModel';
import './HierarchyPanel.css';

interface HierarchyPanelProps {
  /** 상세 패널이 열려 있는 개념 — 두 부모 아래 같은 개념이 있으면 두 행이 같이 강조된다 */
  selectedId: string | null;
  onSelectConcept: (conceptId: string) => void;
}

/** 진입 → 단계 → 장치 → 구현. 깊이가 그보다 깊으면 마지막 이름을 쓴다 */
const LAYER_LABELS = ['진입', '단계', '장치', '구현'] as const;

function layerLabel(depth: number): string {
  return LAYER_LABELS[Math.min(depth, LAYER_LABELS.length - 1)];
}

/**
 * /tech 계층 뷰 — `CONTAINS` 로 층을 접고 펼친다. 새 페이지가 아니라 도메인 맵 옆 탭이다.
 * 노드를 누르면 그 아래 층만 펼친다(전체를 한 번에 안 그린다). 이름을 누르면 상세가 열린다.
 */
export default function HierarchyPanel({ selectedId, onSelectConcept }: HierarchyPanelProps) {
  const [data, setData] = useState<ConceptHierarchy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchConceptHierarchy()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setExpanded(initialExpanded(buildHierarchyModel(result)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '계층을 불러오지 못했습니다');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => (data ? buildHierarchyModel(data) : null), [data]);
  const rows = useMemo(() => (model ? visibleRows(model, expanded) : []), [model, expanded]);

  if (error) {
    return <p className="hier-status">계층을 불러오지 못했습니다 — {error}</p>;
  }
  if (!model) {
    return <p className="hier-status">계층을 불러오는 중…</p>;
  }
  if (model.roots.length === 0) {
    return <p className="hier-status">아직 층으로 묶인 개념이 없습니다</p>;
  }

  const nameOf = (id: string) => model.nodesById.get(id)?.name ?? id;

  const renderRow = (row: HierarchyRow) => {
    const { node } = row;
    const isSelected = selectedId === node.id;
    return (
      <li
        key={row.key}
        role="treeitem"
        aria-level={row.indent + 1}
        aria-expanded={row.hasChildren ? row.expanded : undefined}
        aria-selected={isSelected}
        className={`hier-row hier-depth-${Math.min(node.depth, 3)} ${isSelected ? 'is-selected' : ''}`}
        style={{ '--hier-indent': row.indent } as React.CSSProperties}
      >
        <div className="hier-line">
          {row.hasChildren ? (
            <button
              type="button"
              className="hier-toggle"
              aria-label={row.expanded ? `${node.name} 접기` : `${node.name} 펼치기`}
              onClick={() => setExpanded((prev) => toggleExpanded(prev, node.id))}
            >
              <span aria-hidden="true">{row.expanded ? '−' : '+'}</span>
            </button>
          ) : (
            <span className="hier-toggle hier-toggle--leaf" aria-hidden="true" />
          )}
          <button type="button" className="hier-name" onClick={() => onSelectConcept(node.id)}>
            {node.name}
          </button>
          <span className="hier-layer">{layerLabel(node.depth)}</span>
          <span className="hier-category">{CATEGORY_LABELS[node.category] ?? node.category}</span>
          {row.parentCount > 1 && (
            <span className="hier-badge" title="두 축에 걸친 개념 — 같은 노드다">
              부모 {row.parentCount}
            </span>
          )}
          {row.nextIds.map((next) => (
            <button
              key={next}
              type="button"
              className="hier-flow"
              title={`다음 단계: ${nameOf(next)}`}
              onClick={() => onSelectConcept(next)}
            >
              → {nameOf(next)}
            </button>
          ))}
        </div>
      </li>
    );
  };

  return (
    <div className="hier-panel">
      <div className="hier-legend" aria-hidden="true">
        {LAYER_LABELS.map((label, depth) => (
          <span key={label} className={`hier-legend-item hier-depth-${depth}`}>
            {label}
          </span>
        ))}
        <span className="hier-legend-hint">+ 로 아래 층을 펼치고, 이름을 누르면 상세가 열립니다</span>
      </div>
      <ul className="hier-tree" role="tree" aria-label="개념 계층">
        {rows.map(renderRow)}
      </ul>
    </div>
  );
}
