import { useMemo, useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreemapDataDto, TreemapLevel } from '../../api/treemap';
import CustomTile from './CustomTile';

/**
 * TreemapView — recharts <Treemap> wrapper for code-dictionary stats endpoint.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.1, §6.9
 *
 *  - data.categories[].concepts[]  =>  recharts tree { root, category, concept }
 *  - color by level via CustomTile + OKLCH tokens
 *  - aspectRatio: desktop 16/9, mobile 1/1
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
        // recharts Treemap uses dataKey="size" — must be > 0 for tile to be visible
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
    // older Safari
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
        style={{
          padding: 32,
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.95rem',
        }}
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
          // recharts 의 readonly TreemapDataType 시그니처가 우리 nested 타입과 호환되지
          // 않아 cast. CustomTile 이 실제 shape 를 알고 렌더한다.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data={tree.children as any}
          dataKey="size"
          aspectRatio={aspectRatio}
          stroke="#0a0a14"
          isAnimationActive={false}
          content={<CustomTile onTileClick={onTileClick} />}
        >
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{
              background: '#1a1a2e',
              border: '1px solid #334155',
              color: '#e0e0e0',
              fontSize: '0.85rem',
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
