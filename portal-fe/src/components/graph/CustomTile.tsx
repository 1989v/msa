import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TreemapLevel } from '../../api/treemap';
import { tileColor } from './tileColor';

/**
 * CustomTile — recharts <Treemap> custom content renderer for Code Dictionary.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.5, §6.6, §6.9
 *
 * 디자인: 기존 TreemapPanel 의 단일 축(카테고리=색) 인코딩 채택.
 *  - 같은 카테고리 = 동일 hex 색 → 그룹 응집감
 *  - 흰 텍스트 + 짙은 stroke (#0a0a14, 두께 2, rx 4) → 모든 색에서 가독성 보장
 *  - level 은 색이 아닌 aria-label / 툴팁에서만 표현
 *
 * Responsibilities:
 *  1. leaf tile fill = tileColor(category) — fillOpacity 0.7
 *  2. depth=1 카테고리 컨테이너 = 투명 (recharts 기본, 라벨 없음)
 *  3. label priority by tile area (name > 생략)
 *  4. a11y: aria-label, role=treeitem, focus-ring outline
 *  5. click -> onTileClick(conceptId)
 */

interface CustomTileProps {
  // recharts injects these
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  // payload props from data
  name?: string;
  level?: TreemapLevel;
  conceptId?: string;
  indexCount?: number;
  categoryKey?: string;
  depth?: number;
  // injected by parent
  onTileClick?: (conceptId: string) => void;
}

const LEVEL_LABEL: Record<TreemapLevel, string> = {
  BEGINNER: '입문',
  INTERMEDIATE: '중급',
  ADVANCED: '심화',
};

export default function CustomTile(props: CustomTileProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name = '',
    level,
    conceptId,
    indexCount = 0,
    depth = 0,
    onTileClick,
  } = props;

  // Recharts emits depth=0 for root, depth=1 for category container, depth=2 for leaf concept.
  // 카테고리 컨테이너는 시각적 추가 요소 없음 (기존 TreemapPanel 과 동일 — 자연스러운 packing).
  const isLeaf = depth >= 2 || Boolean(conceptId);

  if (!isLeaf) {
    return <g />;
  }

  if (width <= 0 || height <= 0 || width < 20 || height < 20) return <g />;

  const fill = tileColor(props.categoryKey);

  const handleClick = () => {
    if (conceptId && onTileClick) {
      onTileClick(conceptId);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<SVGGElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && conceptId && onTileClick) {
      e.preventDefault();
      onTileClick(conceptId);
    }
  };

  const ariaLabel = level
    ? `${name}, ${LEVEL_LABEL[level]}, indexCount ${indexCount}`
    : `${name}, indexCount ${indexCount}`;

  // 라벨 표시 조건 (기존 TreemapPanel 과 동일)
  const showName = width > 40 && height > 24;
  const fontSize = Math.min(12, width / 8);
  const maxChars = Math.floor(width / 8);
  const displayName = name.length > maxChars ? `${name.slice(0, maxChars)}…` : name;

  return (
    <g
      className="ko-treemap-tile"
      role="treeitem"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        outline: 'none',
        transition: 'opacity 100ms ease, transform 100ms ease',
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.7}
        stroke="#0a0a14"
        strokeWidth={2}
        rx={4}
      />
      {showName && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={fontSize}
          style={{ pointerEvents: 'none' }}
        >
          {displayName}
        </text>
      )}
    </g>
  );
}
