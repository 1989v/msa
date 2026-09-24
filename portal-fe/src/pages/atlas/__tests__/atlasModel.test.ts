import { describe, expect, it } from 'vitest';
import type { ConceptHierarchy, HierarchyNode } from '../../../types/graph';
import { buildTree, descendantCount, layerCounts, layoutColumns, nextSteps, pathTo } from '../atlasModel';

const node = (id: string, depth: number): HierarchyNode => ({
  id, name: id, category: 'DATA' as HierarchyNode['category'], level: 'BEGINNER' as HierarchyNode['level'], depth,
});

// sys ─ ingest ─ collect
//     └ query ─┬ candidate ─┬ bm25
//              │            └ ann ─ hnsw
//              └ fusion
const hierarchy: ConceptHierarchy = {
  roots: ['sys'],
  nodes: [
    node('sys', 0), node('ingest', 1), node('query', 1), node('collect', 2),
    node('candidate', 2), node('fusion', 2), node('bm25', 3), node('ann', 3), node('hnsw', 4),
  ],
  edges: [
    { from: 'sys', to: 'query', kind: 'CONTAINS', ordinal: 2 },
    { from: 'sys', to: 'ingest', kind: 'CONTAINS', ordinal: 1 },
    { from: 'ingest', to: 'collect', kind: 'CONTAINS', ordinal: 1 },
    { from: 'query', to: 'candidate', kind: 'CONTAINS', ordinal: 1 },
    { from: 'query', to: 'fusion', kind: 'CONTAINS', ordinal: 2 },
    { from: 'candidate', to: 'bm25', kind: 'CONTAINS', ordinal: 1 },
    { from: 'candidate', to: 'ann', kind: 'CONTAINS', ordinal: 2 },
    { from: 'ann', to: 'hnsw', kind: 'CONTAINS', ordinal: 1 },
    { from: 'candidate', to: 'fusion', kind: 'FLOWS_TO', ordinal: 0 },
    { from: 'bm25', to: 'ann', kind: 'ALTERNATIVE_TO', ordinal: 0 },
  ],
};

describe('atlasModel', () => {
  const tree = buildTree(hierarchy, 'sys');

  it('자식은 ordinal 순서다 — 응답 순서가 아니라', () => {
    expect(tree.children.get('sys')).toEqual(['ingest', 'query']);
  });

  it('루트에서 개념까지의 경로를 찾는다', () => {
    expect(pathTo(tree, 'hnsw')).toEqual(['sys', 'query', 'candidate', 'ann', 'hnsw']);
    expect(pathTo(tree, 'sys')).toEqual(['sys']);
    expect(pathTo(tree, 'ghost')).toEqual(['sys']);
  });

  it('층마다 개념 수를 센다', () => {
    expect(layerCounts(tree)).toEqual([1, 2, 3, 2, 1]);
  });

  it('다음 단계와 하위 수', () => {
    expect(nextSteps(tree, 'candidate')).toEqual(['fusion']);
    expect(descendantCount(tree, 'query')).toBe(5);
  });

  it('데스크탑 배치는 경로 위 가지만 펼치고, 경로 위 자식이 부모와 같은 행에 온다', () => {
    const laid = layoutColumns(tree, ['sys', 'query', 'candidate', 'ann']);
    const at = (id: string) => laid.find((n) => n.id === id);
    expect(laid.map((n) => n.id)).toEqual(['sys', 'ingest', 'query', 'candidate', 'fusion', 'bm25', 'ann', 'hnsw']);
    expect(at('query')?.row).toBe(at('sys')?.row);
    expect(at('candidate')?.row).toBe(at('query')?.row);
    expect(at('ann')?.row).toBe(at('candidate')?.row);
    expect(at('collect')).toBeUndefined();
    expect(laid.filter((n) => n.onPath).map((n) => n.id)).toEqual(['sys', 'query', 'candidate', 'ann']);
  });
});
