// V2: extract to packages/treemap-shared/ — see spec.md R3
import { useMemo, useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreemapDataDto, TreemapLevel } from '@admin/api/codeDictionary';
import CustomTile from './CustomTile';

/**
 * TreemapView (admin copy) — recharts <Treemap> wrapper for stats endpoint.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.1, §6.9
 *
 * Mirrors code-dictionary/frontend/src/components/graph/TreemapView.tsx.
 * V1 allows duplication; admin click action differs (edit dialog open).
 */

interface TreemapNodeLeaf {
  name: string;
  size: number;
  level: TreemapLevel;
  conceptId: string;
}

interface TreemapNodeCategory {
  name: string;
  categoryKey: string;
  children: TreemapNodeLeaf[];
}

interface TreemapNodeRoot {
  name: string;
  children: TreemapNodeCategory[];
}

export interface TreemapViewProps {
  data: TreemapDataDto;
  onTileClick: (conceptId: string) => void;
}

function toTreemapData(dto: TreemapDataDto): TreemapNodeRoot {
  return {
    name: 'root',
    children: dto.categories.map((cat) => ({
      name: cat.name,
      categoryKey: cat.name,
      children: cat.concepts.map((c) => ({
        name: c.name,
        size: Math.max(1, c.indexCount),
        level: c.level,
        conceptId: c.conceptId,
      })),
    })),
  };
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 640px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return isMobile;
}

export default function TreemapView({ data, onTileClick }: TreemapViewProps) {
  const tree = useMemo(() => toTreemapData(data), [data]);
  const isMobile = useIsMobile();
  const aspectRatio = isMobile ? 1 : 16 / 9;

  const isEmpty = tree.children.length === 0
    || tree.children.every((cat) => cat.children.length === 0);

  if (isEmpty) {
    return (
      <div
        role="status"
        className="flex items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
        style={{ minHeight: 320 }}
      >
        데이터 없음
      </div>
    );
  }

  return (
    <div
      role="tree"
      aria-label="카테고리별 concept 분포 트리맵"
      style={{ width: '100%', height: '100%', minHeight: 360 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          // recharts v3 Treemap expects readonly TreemapDataType[] (with string index sig).
          // 우리 모델은 nested + ts-safe 라서 명시적으로 cast.
          data={tree.children as unknown as readonly Record<string, unknown>[]}
          dataKey="size"
          aspectRatio={aspectRatio}
          stroke="rgba(120,120,140,0.35)"
          isAnimationActive={false}
          content={<CustomTile onTileClick={onTileClick} />}
        >
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e4e4e7',
              color: '#18181b',
              fontSize: '0.85rem',
              borderRadius: '6px',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, item: any) => {
              const payload = item?.payload;
              const level = payload?.level as TreemapLevel | undefined;
              const displayName = payload?.name ?? '';
              if (level) {
                return [`indexCount ${value} · ${level}`, displayName];
              }
              return [`${value}`, displayName];
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
