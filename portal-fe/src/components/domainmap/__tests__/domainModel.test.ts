import { describe, it, expect } from 'vitest';
import type { GraphData, GraphNode } from '../../../types/graph';
import type { Category, Level } from '../../../types';
import {
  CORE_CONCEPT_LIMIT,
  DOMAIN_NODE_PREFIX,
  INITIAL_DRILLDOWN,
  buildDomainModel,
  clearEmphasis,
  computeVisible,
  conceptWeight,
  domainIdOfCategory,
  domainNodeId,
  expandConcept,
  revealCategory,
  revealConcepts,
  selectConcept,
  toggleDomain,
} from '../domainModel';

function concept(
  id: string,
  category: Category,
  indexCount = 1,
  relatedCount = 0,
  level: Level = 'BEGINNER',
): GraphNode {
  return { id, name: id.toUpperCase(), category, level, indexCount, relatedCount };
}

function graphData(nodes: GraphNode[], links: Array<[string, string]> = []): GraphData {
  return {
    nodes,
    links: links.map(([source, target]) => ({ source, target, type: 'RELATED' })),
    stats: { totalConcepts: nodes.length, totalIndexes: 0, byCategory: {}, byLevel: {}, matrix: {} },
  };
}

const BASE_DATA = graphData(
  [
    concept('saga', 'DISTRIBUTED_SYSTEM', 9, 3),
    concept('cqrs', 'ARCHITECTURE', 7, 2),
    concept('port-adapter', 'ARCHITECTURE', 5, 1),
    concept('jwt', 'SECURITY', 4, 1),
    concept('btree', 'DATA_STRUCTURE', 3, 0),
    concept('tcp', 'NETWORK', 2, 0),
  ],
  [
    ['saga', 'cqrs'],
    ['saga', 'jwt'],
    ['cqrs', 'port-adapter'],
  ],
);

describe('buildDomainModel', () => {
  it('category 를 도메인으로 묶고, 개념이 없는 도메인은 제외한다', () => {
    const model = buildDomainModel(BASE_DATA);
    const ids = model.domains.map((d) => d.id);
    // ARCHITECTURE → architecture, DISTRIBUTED_SYSTEM/NETWORK → distributed,
    // DATA_STRUCTURE → data, SECURITY → quality. infra/language 는 개념이 없다.
    expect(ids).toEqual(['architecture', 'distributed', 'data', 'quality']);
    expect(model.domainOfConcept.get('saga')).toBe('distributed');
    expect(model.domainOfConcept.get('tcp')).toBe('distributed');
    expect(model.domainOfConcept.get('btree')).toBe('data');
  });

  it('도메인별 개념을 weight 내림차순으로 정렬하고 상위 이름을 서브라벨 시드로 담는다', () => {
    const model = buildDomainModel(BASE_DATA);
    const architecture = model.conceptsByDomain.get('architecture')!;
    expect(architecture.map((c) => c.id)).toEqual(['cqrs', 'port-adapter']);
    const distributed = model.domains.find((d) => d.id === 'distributed')!;
    expect(distributed.conceptCount).toBe(2);
    expect(distributed.topConceptNames[0]).toBe('SAGA');
  });

  it('링크를 무방향 dedupe 하고 양방향 이웃을 만든다', () => {
    const withDupes = graphData(
      [concept('a', 'ARCHITECTURE'), concept('b', 'ARCHITECTURE')],
      [
        ['a', 'b'],
        ['b', 'a'],
      ],
    );
    const model = buildDomainModel(withDupes);
    expect(model.relationLinks).toHaveLength(1);
    expect(model.neighbors.get('a')).toEqual(['b']);
    expect(model.neighbors.get('b')).toEqual(['a']);
  });

  it('모르는 category 는 기타 도메인으로 폴백한다', () => {
    const unknown = graphData([{ ...concept('x', 'ARCHITECTURE'), category: 'BRAND_NEW' as Category }]);
    const model = buildDomainModel(unknown);
    expect(domainIdOfCategory('BRAND_NEW')).toBe('etc');
    expect(model.domains.map((d) => d.id)).toEqual(['etc']);
  });
});

describe('computeVisible', () => {
  const model = buildDomainModel(BASE_DATA);

  it('루트에서는 도메인 노드만 보인다 (progressive disclosure)', () => {
    const { nodes, links } = computeVisible(model, INITIAL_DRILLDOWN);
    expect(nodes.every((n) => n.kind === 'domain')).toBe(true);
    expect(nodes).toHaveLength(4);
    expect(links).toHaveLength(0);
    // 도메인 노드 id 는 concept id 와 충돌하지 않는 접두어를 쓴다
    expect(nodes[0].id.startsWith(DOMAIN_NODE_PREFIX)).toBe(true);
  });

  it('도메인을 펼치면 핵심 개념과 spoke 링크가 드러난다', () => {
    const state = toggleDomain(INITIAL_DRILLDOWN, model, 'architecture');
    const { nodes, links } = computeVisible(model, state);
    const conceptIds = nodes.filter((n) => n.kind === 'concept').map((n) => n.id);
    expect(conceptIds).toEqual(['cqrs', 'port-adapter']);
    expect(links).toContainEqual({ source: domainNodeId('architecture'), target: 'cqrs', kind: 'spoke' });
    // 두 개념 다 보이므로 둘 사이 관계 링크도 그려진다
    expect(links).toContainEqual({ source: 'cqrs', target: 'port-adapter', kind: 'relation' });
  });

  it('핵심 개념은 CORE_CONCEPT_LIMIT 까지만 드러난다', () => {
    const many = graphData(
      Array.from({ length: CORE_CONCEPT_LIMIT + 5 }, (_, i) => concept(`c${i}`, 'ARCHITECTURE', i)),
    );
    const bigModel = buildDomainModel(many);
    const state = toggleDomain(INITIAL_DRILLDOWN, bigModel, 'architecture');
    const { nodes } = computeVisible(bigModel, state);
    expect(nodes.filter((n) => n.kind === 'concept')).toHaveLength(CORE_CONCEPT_LIMIT);
  });

  it('pin 된 개념은 top-N 밖이어도 보인다', () => {
    const many = graphData(
      Array.from({ length: CORE_CONCEPT_LIMIT + 5 }, (_, i) => concept(`c${i}`, 'ARCHITECTURE', i)),
    );
    const bigModel = buildDomainModel(many);
    // c0 은 weight 최하위 — top-12 에 못 든다
    let state = toggleDomain(INITIAL_DRILLDOWN, bigModel, 'architecture');
    expect(computeVisible(bigModel, state).nodes.some((n) => n.id === 'c0')).toBe(false);
    state = revealConcepts(state, bigModel, ['c0']);
    expect(computeVisible(bigModel, state).nodes.some((n) => n.id === 'c0')).toBe(true);
  });

  it('개념을 펼치면 접힌 도메인의 이웃도 관계 링크로만 드러난다', () => {
    const state = expandConcept(INITIAL_DRILLDOWN, model, 'saga');
    const { nodes, links } = computeVisible(model, state);
    const ids = nodes.map((n) => n.id);
    // saga 의 이웃 cqrs(architecture)/jwt(quality) — 둘 다 도메인은 접혀 있어도 보인다
    expect(ids).toContain('cqrs');
    expect(ids).toContain('jwt');
    expect(links).toContainEqual({ source: 'saga', target: 'cqrs', kind: 'relation' });
    // 접힌 도메인으로는 spoke 를 걸지 않는다
    expect(links.some((l) => l.kind === 'spoke' && l.target === 'cqrs')).toBe(false);
    // saga 자신의 도메인은 펼쳐져 spoke 가 생긴다
    expect(links).toContainEqual({ source: domainNodeId('distributed'), target: 'saga', kind: 'spoke' });
  });
});

describe('drilldown state transitions', () => {
  const model = buildDomainModel(BASE_DATA);

  it('toggleDomain 은 접을 때 그 도메인의 파생 상태를 정리한다', () => {
    let state = selectConcept(INITIAL_DRILLDOWN, model, 'cqrs');
    expect(state.selected).toBe('cqrs');
    expect(state.expandedDomains.has('architecture')).toBe(true);
    state = toggleDomain(state, model, 'architecture');
    expect(state.expandedDomains.has('architecture')).toBe(false);
    expect(state.selected).toBeNull();
    expect(state.pinned.has('cqrs')).toBe(false);
    expect(state.expandedConcepts.has('cqrs')).toBe(false);
  });

  it('selectConcept 은 도메인을 열고 본인+이웃을 강조한다', () => {
    const state = selectConcept(INITIAL_DRILLDOWN, model, 'saga');
    expect(state.selected).toBe('saga');
    expect(state.expandedDomains.has('distributed')).toBe(true);
    expect([...state.highlighted].sort()).toEqual(['cqrs', 'jwt', 'saga']);
  });

  it('selectConcept 은 그래프에 없는 개념이어도 상세 패널용 selected 는 세팅한다', () => {
    const state = selectConcept(INITIAL_DRILLDOWN, model, 'not-in-graph');
    expect(state.selected).toBe('not-in-graph');
    expect(state.expandedDomains.size).toBe(0);
  });

  it('revealConcepts 는 히트들의 도메인을 열고 pin+강조한다 (미지 id 무시)', () => {
    const state = revealConcepts(INITIAL_DRILLDOWN, model, ['saga', 'btree', 'ghost']);
    expect(state.expandedDomains.has('distributed')).toBe(true);
    expect(state.expandedDomains.has('data')).toBe(true);
    expect([...state.highlighted].sort()).toEqual(['btree', 'saga']);
    expect(state.pinned.has('saga')).toBe(true);
  });

  it('revealCategory 는 해당 카테고리 개념 전부를 드러낸다', () => {
    const state = revealCategory(INITIAL_DRILLDOWN, model, 'ARCHITECTURE');
    expect([...state.highlighted].sort()).toEqual(['cqrs', 'port-adapter']);
    expect(state.expandedDomains.has('architecture')).toBe(true);
  });

  it('clearEmphasis 는 강조/선택만 걷고 펼친 구조는 유지한다', () => {
    let state = selectConcept(INITIAL_DRILLDOWN, model, 'saga');
    state = clearEmphasis(state);
    expect(state.selected).toBeNull();
    expect(state.highlighted.size).toBe(0);
    expect(state.expandedDomains.has('distributed')).toBe(true);
    expect(state.pinned.has('saga')).toBe(true);
  });

  it('conceptWeight 는 코드 참조를 연관보다 무겁게 친다', () => {
    expect(conceptWeight(concept('x', 'ARCHITECTURE', 3, 2))).toBe(8);
  });
});
