import { describe, it, expect } from 'vitest';
import type { ConceptHierarchy } from '../../../types/graph';
import { buildHierarchyModel, initialExpanded, toggleExpanded, visibleRows } from '../hierarchyModel';

function node(id: string, depth: number) {
  return { id, name: id.toUpperCase(), category: 'ALGORITHM' as const, level: 'BEGINNER' as const, depth };
}

/** search-system → ingest·query, 임베딩 모델이 두 축 아래 같이 있는 DAG */
const data: ConceptHierarchy = {
  roots: ['search-system'],
  nodes: [
    node('search-system', 0),
    node('search-ingest', 1),
    node('search-query', 1),
    node('document-embedding', 2),
    node('query-embedding', 2),
    node('embedding-model', 3),
    node('bm25', 2),
  ],
  edges: [
    { from: 'search-system', to: 'search-query', kind: 'CONTAINS', ordinal: 2 },
    { from: 'search-system', to: 'search-ingest', kind: 'CONTAINS', ordinal: 1 },
    { from: 'search-ingest', to: 'document-embedding', kind: 'CONTAINS', ordinal: 1 },
    { from: 'search-query', to: 'query-embedding', kind: 'CONTAINS', ordinal: 1 },
    { from: 'search-query', to: 'bm25', kind: 'CONTAINS', ordinal: 2 },
    { from: 'document-embedding', to: 'embedding-model', kind: 'CONTAINS', ordinal: 1 },
    { from: 'query-embedding', to: 'embedding-model', kind: 'CONTAINS', ordinal: 1 },
    { from: 'query-embedding', to: 'bm25', kind: 'FLOWS_TO', ordinal: 1 },
    { from: 'bm25', to: 'ghost', kind: 'CONTAINS', ordinal: 1 },
  ],
};

describe('buildHierarchyModel', () => {
  const model = buildHierarchyModel(data);

  it('CONTAINS 자식은 ordinal 순서고, 노드가 없는 간선은 버린다', () => {
    expect(model.childrenOf.get('search-system')).toEqual(['search-ingest', 'search-query']);
    expect(model.childrenOf.get('bm25')).toBeUndefined();
  });

  it('두 부모를 가진 개념은 부모가 둘로 잡힌다', () => {
    expect(model.parentsOf.get('embedding-model')).toEqual(['document-embedding', 'query-embedding']);
    expect(model.maxDepth).toBe(3);
  });

  it('FLOWS_TO 는 다음 단계 목록으로 따로 잡는다', () => {
    expect(model.nextOf.get('query-embedding')).toEqual(['bm25']);
  });
});

describe('visibleRows', () => {
  const model = buildHierarchyModel(data);

  it('처음엔 진입점과 바로 아래 층만 보인다', () => {
    const rows = visibleRows(model, initialExpanded(model));
    expect(rows.map((r) => r.node.id)).toEqual(['search-system', 'search-ingest', 'search-query']);
    expect(rows[1].hasChildren).toBe(true);
    expect(rows[1].expanded).toBe(false);
  });

  it('펼치면 그 아래 층만 더 보이고 두 부모 아래 같은 개념은 행 둘·키는 다르다', () => {
    let expanded = initialExpanded(model);
    for (const id of ['search-ingest', 'search-query', 'document-embedding', 'query-embedding']) {
      expanded = toggleExpanded(expanded, id);
    }
    const rows = visibleRows(model, expanded);
    const embeddingRows = rows.filter((r) => r.node.id === 'embedding-model');
    expect(embeddingRows).toHaveLength(2);
    expect(new Set(embeddingRows.map((r) => r.key)).size).toBe(2);
    expect(embeddingRows.every((r) => r.parentCount === 2)).toBe(true);
    expect(embeddingRows.map((r) => r.indent)).toEqual([3, 3]);
  });

  it('다시 누르면 접힌다', () => {
    const expanded = toggleExpanded(toggleExpanded(initialExpanded(model), 'search-query'), 'search-query');
    expect(visibleRows(model, expanded).map((r) => r.node.id)).toEqual(['search-system', 'search-ingest', 'search-query']);
  });

  it('순환 데이터라도 부모 경로에 있는 개념은 다시 내려가지 않는다', () => {
    const cyclic = buildHierarchyModel({
      roots: ['a'],
      nodes: [node('a', 0), node('b', 1)],
      edges: [
        { from: 'a', to: 'b', kind: 'CONTAINS', ordinal: 1 },
        { from: 'b', to: 'a', kind: 'CONTAINS', ordinal: 1 },
      ],
    });
    const rows = visibleRows(cyclic, new Set(['a', 'b']));
    expect(rows.map((r) => r.node.id)).toEqual(['a', 'b']);
  });
});
