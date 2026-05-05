// V2: extract to packages/treemap-shared/ — see spec.md R3
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTreemapStats } from '@/api/codeDictionary';
import TreemapView from './TreemapView';
import CategoryChipStrip from './CategoryChipStrip';

/**
 * TreemapSection (admin) — chip strip + treemap + legend composition.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.1
 *
 * Mirrors code-dictionary/frontend/src/components/graph/TreemapSection.tsx
 * but uses tanstack-query (admin standard) instead of bare useEffect.
 */

export interface TreemapSectionProps {
  onTileClick: (conceptId: string) => void;
}

export default function TreemapSection({ onTileClick }: TreemapSectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categoriesParam = useMemo(
    () => (selected.size > 0 ? Array.from(selected).sort() : undefined),
    [selected],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['treemap-stats', categoriesParam],
    queryFn: () => fetchTreemapStats({ categories: categoriesParam, includeZeroIndex: false }),
    staleTime: 60_000,
  });

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
    <section className="flex w-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            카테고리 분포
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            타일을 클릭하면 해당 개념의 수정 다이얼로그가 열립니다.
          </p>
        </div>
      </header>

      <CategoryChipStrip
        categories={chipItems}
        selected={selected}
        onToggle={handleToggle}
        onClearAll={handleClearAll}
      />

      <div className="relative min-h-[360px] w-full">
        {isLoading && !data && (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-zinc-500">
            Loading…
          </div>
        )}
        {error && (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-red-600">
            트리맵 데이터를 불러오지 못했습니다
          </div>
        )}
        {data && <TreemapView data={data} onTileClick={onTileClick} />}
      </div>

      {data && (
        <footer
          aria-label="레벨별 concept 합계"
          className="flex flex-wrap items-center gap-4 px-1 pt-1 text-xs text-zinc-600 dark:text-zinc-300"
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--ko-level-beginner)' }}
            />
            BEGINNER
            <span className="ml-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {data.totals.byLevel.BEGINNER ?? 0}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--ko-level-intermediate)' }}
            />
            INTERMEDIATE
            <span className="ml-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {data.totals.byLevel.INTERMEDIATE ?? 0}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--ko-level-advanced)' }}
            />
            ADVANCED
            <span className="ml-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {data.totals.byLevel.ADVANCED ?? 0}
            </span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            Total
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {data.totals.totalConcepts}
            </span>
          </span>
        </footer>
      )}
    </section>
  );
}
