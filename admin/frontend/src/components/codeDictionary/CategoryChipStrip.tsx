// V2: extract to packages/treemap-shared/ — see spec.md R3
import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * CategoryChipStrip (admin copy) — horizontal scroll chip filter for treemap.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.5, §6.6
 *  - chip strip scoped horizontal scroll (page-level horizontal scroll banned)
 *  - role=tablist + role=tab + aria-selected
 *  - touch-target min 44px
 *  - empty categories filtered upstream (Q3)
 *
 * Mirrors code-dictionary/frontend/src/components/graph/CategoryChipStrip.tsx
 * with admin's tailwind utility styling instead of dedicated CSS.
 */

export interface ChipItem {
  name: string;
  count: number;
}

export interface CategoryChipStripProps {
  categories: ChipItem[];
  selected: Set<string>;
  onToggle: (categoryName: string) => void;
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

  const chipBase = 'ko-chip inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-normal transition-colors';
  const chipActive = 'border-zinc-700 bg-zinc-200 text-zinc-900 font-semibold dark:border-zinc-300 dark:bg-zinc-700 dark:text-zinc-50';
  const chipIdle = 'border-zinc-200 bg-white/60 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-800';

  return (
    <div className="relative flex w-full items-center">
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="카테고리 필터"
        className="flex flex-1 flex-nowrap gap-2 overflow-x-auto px-3 py-2 pr-10 [-ms-overflow-style:none] [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={allSelected}
          onClick={() => onClearAll?.()}
          className={cn(
            chipBase,
            'min-h-[44px] [scroll-snap-align:start] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2',
            allSelected ? chipActive : chipIdle,
          )}
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
              onClick={() => onToggle(cat.name)}
              className={cn(
                chipBase,
                'min-h-[44px] [scroll-snap-align:start] focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2',
                isActive ? chipActive : chipIdle,
              )}
            >
              <span className="tabular-nums">{cat.name}</span>
              <span className={cn('text-xs tabular-nums', isActive ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-500')}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="오른쪽으로 스크롤"
        onClick={handleScrollRight}
        className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/85 text-zinc-600 backdrop-blur sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-300"
      >
        ›
      </button>
    </div>
  );
}
