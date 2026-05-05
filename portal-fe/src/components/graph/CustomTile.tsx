import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TreemapLevel } from '../../api/treemap';

/**
 * CustomTile — recharts <Treemap> custom content renderer for Code Dictionary.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.5, §6.6, §6.9
 *
 * Responsibilities:
 *  1. color tile by level via OKLCH var(--ko-level-*) tokens (cool->warm sequential)
 *  2. label priority by tile area (name + count > name only > omit)
 *  3. a11y: aria-label, role=treeitem, focus-ring outline
 *  4. click -> onTileClick(conceptId)
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

const LEVEL_TO_TOKEN: Record<TreemapLevel, string> = {
  BEGINNER: 'var(--ko-level-beginner)',
  INTERMEDIATE: 'var(--ko-level-intermediate)',
  ADVANCED: 'var(--ko-level-advanced)',
};

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
  // Only render concept-level (leaf) tiles; let category container render as transparent group
  // (recharts will still call content() for them, so we draw a thin border and label).
  const isLeaf = depth >= 2 || Boolean(conceptId);

  if (!isLeaf) {
    // Category container — draw subtle separator only
    if (width <= 0 || height <= 0) return <g />;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="transparent"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
        {width > 80 && height > 28 && (
          <text
            x={x + 8}
            y={y + 16}
            fill="#94a3b8"
            fontSize={11}
            fontWeight={600}
            style={{ pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            {name}
          </text>
        )}
      </g>
    );
  }

  if (width <= 0 || height <= 0) return <g />;

  const fill = level ? LEVEL_TO_TOKEN[level] : 'var(--ko-level-beginner)';
  const area = width * height;

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

  // Label priority by area (spec §6.9)
  const showName = area > 1500;
  const showCount = area > 5000;

  // Truncate name to fit width (rough heuristic ~7px per char at 12px font)
  const maxChars = Math.max(2, Math.floor(width / 8));
  const displayName = name.length > maxChars ? `${name.slice(0, maxChars - 1)}…` : name;

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
        stroke="rgba(10, 10, 20, 0.55)"
        strokeWidth={1}
        rx={2}
      />
      {showName && (
        <text
          x={x + width / 2}
          y={showCount ? y + height / 2 - 8 : y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0a0a14"
          fontSize={Math.min(14, Math.max(10, width / 10))}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {displayName}
        </text>
      )}
      {showCount && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(10, 10, 20, 0.75)"
          fontSize={11}
          style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
        >
          {indexCount}
        </text>
      )}
    </g>
  );
}
