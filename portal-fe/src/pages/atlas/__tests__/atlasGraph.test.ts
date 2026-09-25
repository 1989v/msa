import { describe, expect, it } from 'vitest';
import {
  descendantCount, domainLinks, indexGraph, localGraph, neighbors, orderSiblings, pathFromRoot, searchConcepts,
  type RawGraph,
} from '../atlasGraph';

// search ─┬ ingest ─ collect
//         └ query ─┬ rank     (retrieve → rank 흐름)
//                  ├ retrieve ─ ann ─uses→ hnsw(data 도메인)
//                  └ recall(지표) ←measured_by─ retrieve
// data ── hnsw
const K = ['DOMAIN', 'STAGE', 'MECHANISM', 'TERM', 'TECHNOLOGY', 'PROBLEM', 'METRIC'];
const E = ['CONTAINS', 'FLOWS_TO', 'USES', 'IMPLEMENTS', 'AFFECTS', 'CAUSES', 'MITIGATES', 'MEASURED_BY', 'ALTERNATIVE_TO'];
const ids = ['search', 'ingest', 'collect', 'query', 'rank', 'retrieve', 'ann', 'recall', 'data', 'hnsw'];
const i = (id: string) => ids.indexOf(id);
const raw: RawGraph = {
  revision: 1,
  source: 'test',
  kinds: K,
  edgeKinds: E,
  domains: [['search', '검색', '검색 도메인', 'search', 3], ['data', '데이터', '데이터 도메인', 'data', 0]],
  concepts: [
    ['search', '검색', 0, 0], ['ingest', '인제스트', 0, 0], ['collect', '수집', 1, 0], ['query', '질의', 0, 0],
    ['rank', '랭킹', 1, 0], ['retrieve', '후보 검색', 1, 0], ['ann', 'ANN 검색', 2, 0], ['recall', '재현율', 6, 0],
    ['data', '데이터', 0, 1], ['hnsw', 'HNSW', 2, 1],
  ],
  edges: [
    [i('search'), i('ingest'), 0], [i('search'), i('query'), 0], [i('ingest'), i('collect'), 0],
    [i('query'), i('rank'), 0], [i('query'), i('retrieve'), 0], [i('query'), i('recall'), 0],
    [i('retrieve'), i('ann'), 0], [i('data'), i('hnsw'), 0],
    [i('retrieve'), i('rank'), 1],
    [i('ann'), i('hnsw'), 2],
    [i('retrieve'), i('recall'), 7],
  ],
};
const g = indexGraph(raw);

describe('atlasGraph', () => {
  it('형제 사이 흐름을 순번으로 앞에 세우고, 흐름 밖 형제는 원래 순서로 뒤에 둔다', () => {
    const { list, step } = orderSiblings(g, g.children.get('query') ?? []);
    expect(list).toEqual(['retrieve', 'rank', 'recall']);
    expect(step.get('retrieve')).toBe(1);
    expect(step.get('rank')).toBe(2);
    expect(step.has('recall')).toBe(false);
  });

  it('루트에서 개념까지의 포함 경로를 찾고, 닿지 않으면 빈 배열이다', () => {
    expect(pathFromRoot(g, 'search', 'ann')).toEqual(['search', 'query', 'retrieve', 'ann']);
    expect(pathFromRoot(g, 'search', 'hnsw')).toEqual([]);
    expect(descendantCount(g, 'query')).toBe(4);
  });

  it('이웃은 방향을 가르고, 들어오는 쪽은 역방향 이름으로 읽는다 — 도메인 루트는 속한 곳으로 세지 않는다', () => {
    const labels = (id: string) => neighbors(g, id).map((n) => `${n.incoming ? '<' : '>'}${n.label}:${n.concept.id}`).sort();
    expect(labels('retrieve')).toEqual(['<PART_OF:query', '>CONTAINS:ann', '>FLOWS_TO:rank', '>MEASURED_BY:recall']);
    expect(labels('hnsw')).toEqual(['<USED_BY:ann']);
    expect(labels('query')).not.toContain('<PART_OF:search');
  });

  it('로컬 그래프는 깊이 2 에서 이웃의 이웃까지 넓히고, 숨긴 관계는 뺀다', () => {
    const d1 = localGraph(g, 'retrieve', 1, new Set());
    expect(d1.nodes.map((n) => n.id).sort()).toEqual(['ann', 'query', 'rank', 'recall', 'retrieve']);
    const d2 = localGraph(g, 'retrieve', 2, new Set());
    expect(d2.nodes.find((n) => n.id === 'hnsw')?.depth).toBe(2);
    const noHier = localGraph(g, 'retrieve', 1, new Set(['PART_OF', 'CONTAINS']));
    expect(noHier.nodes.map((n) => n.id).sort()).toEqual(['rank', 'recall', 'retrieve']);
    expect(noHier.links.find((l) => l.target === 'rank')?.group).toBe('flow');
  });

  it('도메인 간 관계 수는 양 끝 도메인이 다른 간선만 쌍으로 센다', () => {
    expect(domainLinks(g)).toEqual([{ from: 'data', to: 'search', count: 1 }]);
    expect(g.domains.find((d) => d.key === 'data')?.conceptIds).toEqual(['data', 'hnsw']);
  });

  it('이름 검색은 앞에서 맞는 것을 위로 올린다', () => {
    expect(searchConcepts(g, '검색').map((c) => c.id)).toEqual(['search', 'retrieve', 'ann']);
  });
});
