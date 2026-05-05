import { useRef } from 'react';
import './CategoryChipStrip.css';

/**
 * CategoryChipStrip — horizontal scroll chip filter for treemap categories.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.5, §6.6
 *  - overflow-x: auto + scroll-snap (chip strip scoped exception)
 *  - role=tablist + role=tab + aria-selected
 *  - touch-target min 44px height
 *  - empty categories already filtered upstream (Q3)
 */

export interface ChipItem {
  name: string;
  count: number;
}

export interface CategoryChipStripProps {
  categories: ChipItem[];
  selected: Set<string>;
  onToggle: (categoryName: string) => void;
  /** when "전체" chip is clicked, parent should clear selection */
  onClearAll?: () => void;
}

export default function CategoryChipStrip({
  categories,
  selected,
  onToggle,
  onClearAll,
}: CategoryChipStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const allSelected = selected.size === 0;

  const handleScrollRight = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.6, behavior: 'smooth' });
  };

  return (
    <div className="ko-chip-strip-wrap">
      <div
        className="ko-chip-strip"
        role="tablist"
        aria-label="카테고리 필터"
        ref={scrollRef}
      >
        <button
          type="button"
          role="tab"
          aria-selected={allSelected}
          className={`ko-chip ${allSelected ? 'is-active' : ''}`}
          onClick={() => onClearAll?.()}
        >
          전체
        </button>
        {categories.map((cat) => {
          const isActive = selected.has(cat.name);
          return (
            <button
              key={cat.name}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`ko-chip ${isActive ? 'is-active' : ''}`}
              onClick={() => onToggle(cat.name)}
            >
              <span className="ko-chip-name">{cat.name}</span>
              <span className="ko-chip-count">{cat.count}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="ko-chip-strip-arrow"
        aria-label="오른쪽으로 스크롤"
        onClick={handleScrollRight}
      >
        ›
      </button>
    </div>
  );
}
