import { describe, it, expect } from 'vitest';
import type { GraphData, GraphNode } from '../../../types/graph';
import type { Category, Level } from '../../../types';
import {
  CORE_CONCEPT_LIMIT,
  DOMAIN_NODE_PREFIX,
  INITIAL_DRILLDOWN,
  buildDomainModel,
  categoryFocusTarget,
  clearEmphasis,
  computeVisible,
  conceptWeight,
  conceptsOfCategory,
  domainIdOfCategory,
  domainNodeId,
  expandConcept,
  primaryDomainOf,
  revealCategory,
  revealConcepts,
  selectConcept,
  toggleDomain,
} from '../domainModel';
import type { TechDomainSpec } from '../domainModel';

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

/**
 * 서버가 주는 업무 도메인 정의. 실제 매핑과 같은 성질을 담는다 —
 * `cqrs` 는 두 도메인에 걸치고, `tcp` 는 어느 도메인에도 안 실린다.
 */
const SPECS: TechDomainSpec[] = [
  { code: 'order', label: '주문·결제', tagline: '상태 전이·보상 트랜잭션', conceptIds: ['saga', 'cqrs'] },
  { code: 'search', label: '검색', tagline: '색인·랭킹·자동완성', conceptIds: ['cqrs', 'btree'] },
  { code: 'member', label: '회원·인증', tagline: null, conceptIds: ['jwt', 'port-adapter'] },
];

describe('buildDomainModel — 서버 도메인 정의가 루트', () => {
  const model = buildDomainModel(BASE_DATA, SPECS);

  it('루트는 기술 분류가 아니라 업무 도메인이고 정의 순서를 지킨다', () => {
    expect(model.domains.map((d) => d.id)).toEqual(['order', 'search', 'member']);
    expect(model.domains.map((d) => d.label)).toEqual(['주문·결제', '검색', '회원·인증']);
  });

  it('한 개념이 여러 도메인에 실린다 (배타적으로 나누지 않는다)', () => {
    expect(model.domainsOfConcept.get('cqrs')).toEqual(['order', 'search']);
    expect(primaryDomainOf(model, 'cqrs')).toBe('order');
  });

  it('어느 도메인에도 안 실린 개념은 매핑이 비고 대표 도메인도 없다', () => {
    expect(model.domainsOfConcept.get('tcp')).toBeUndefined();
    expect(primaryDomainOf(model, 'tcp')).toBeNull();
    // 그래도 그래프 노드로는 살아 있다 — 검색/트리맵으로 닿는다
    expect(model.nodesById.has('tcp')).toBe(true);
  });

  it('그래프에 없는 개념 id 는 조용히 빠진다 (매핑이 색인보다 오래 산다)', () => {
    const stale = buildDomainModel(BASE_DATA, [
      { code: 'ingest', label: '데이터 수집', tagline: null, conceptIds: ['saga', 'not-indexed-yet'] },
    ]);
    expect(stale.conceptsByDomain.get('ingest')!.map((c) => c.id)).toEqual(['saga']);
    expect(stale.domains[0].conceptCount).toBe(1);
  });

  it('도메인별 개념을 weight 내림차순으로 정렬하고 상위 이름을 담는다', () => {
    expect(model.conceptsByDomain.get('order')!.map((c) => c.id)).toEqual(['saga', 'cqrs']);
    expect(model.domains.find((d) => d.id === 'order')!.topConceptNames[0]).toBe('SAGA');
  });

  it('개념이 하나도 남지 않은 도메인은 루트에서 빠진다', () => {
    const empty = buildDomainModel(BASE_DATA, [
      ...SPECS,
      { code: 'ghost', label: '유령', tagline: null, conceptIds: ['nothing-here'] },
    ]);
    expect(empty.domains.map((d) => d.id)).toEqual(['order', 'search', 'member']);
  });

  it('링크를 무방향 dedupe 하고 양방향 이웃을 만든다', () => {
    const withDupes = graphData(
      [concept('a', 'ARCHITECTURE'), concept('b', 'ARCHITECTURE')],
      [
        ['a', 'b'],
        ['b', 'a'],
      ],
    );
    const dupModel = buildDomainModel(withDupes, [
      { code: 'x', label: 'X', tagline: null, conceptIds: ['a', 'b'] },
    ]);
    expect(dupModel.relationLinks).toHaveLength(1);
    expect(dupModel.neighbors.get('a')).toEqual(['b']);
    expect(dupModel.neighbors.get('b')).toEqual(['a']);
  });
});

describe('buildDomainModel — 도메인 API 실패 시 category 폴백', () => {
  it('정의가 없으면 category 를 묶어 루트로 쓴다 (개념 없는 도메인은 제외)', () => {
    const model = buildDomainModel(BASE_DATA);
    // ARCHITECTURE → architecture, DISTRIBUTED_SYSTEM/NETWORK → distributed,
    // DATA_STRUCTURE → data, SECURITY → quality. infra/language 는 개념이 없다.
    expect(model.domains.map((d) => d.id)).toEqual(['architecture', 'distributed', 'data', 'quality']);
    expect(model.domainsOfConcept.get('saga')).toEqual(['distributed']);
    expect(model.domainsOfConcept.get('tcp')).toEqual(['distributed']);
    expect(model.domainsOfConcept.get('btree')).toEqual(['data']);
  });

  it('빈 정의 배열도 폴백으로 친다 (활성 도메인이 하나도 없는 응답)', () => {
    expect(buildDomainModel(BASE_DATA, []).domains.map((d) => d.id)).toEqual([
      'architecture',
      'distributed',
      'data',
      'quality',
    ]);
  });

  it('폴백에서는 개념이 정확히 한 도메인에 속하고 tagline 이 없다', () => {
    const model = buildDomainModel(BASE_DATA);
    expect(model.domains.every((d) => d.tagline === null)).toBe(true);
    expect(model.conceptsByDomain.get('architecture')!.map((c) => c.id)).toEqual(['cqrs', 'port-adapter']);
    expect(model.domains.find((d) => d.id === 'distributed')!.conceptCount).toBe(2);
  });

  it('모르는 category 는 기타 도메인으로 폴백한다', () => {
    const unknown = graphData([{ ...concept('x', 'ARCHITECTURE'), category: 'BRAND_NEW' as Category }]);
    const model = buildDomainModel(unknown);
    expect(domainIdOfCategory('BRAND_NEW')).toBe('etc');
    expect(model.domains.map((d) => d.id)).toEqual(['etc']);
  });
});

describe('computeVisible', () => {
  const model = buildDomainModel(BASE_DATA, SPECS);

  it('루트에서는 도메인 노드만 보인다 (progressive disclosure)', () => {
    const { nodes, links } = computeVisible(model, INITIAL_DRILLDOWN);
    expect(nodes.every((n) => n.kind === 'domain')).toBe(true);
    expect(nodes).toHaveLength(3);
    expect(links).toHaveLength(0);
    // 도메인 노드 id 는 concept id 와 충돌하지 않는 접두어를 쓴다
    expect(nodes[0].id.startsWith(DOMAIN_NODE_PREFIX)).toBe(true);
  });

  it('도메인 노드는 색을 갖지 않는다 — 색은 category 인코딩이라 루트에는 안 쓴다', () => {
    const { nodes } = computeVisible(model, toggleDomain(INITIAL_DRILLDOWN, model, 'order'));
    expect(nodes.filter((n) => n.kind === 'domain').every((n) => n.color === null)).toBe(true);
    expect(nodes.filter((n) => n.kind === 'concept').every((n) => n.color !== null)).toBe(true);
  });

  it('도메인 서브라벨은 tagline 이 있으면 tagline, 없으면 개수+상위 개념', () => {
    const { nodes } = computeVisible(model, INITIAL_DRILLDOWN);
    expect(nodes.find((n) => n.id === domainNodeId('order'))!.sub).toBe('상태 전이·보상 트랜잭션 · 2');
    expect(nodes.find((n) => n.id === domainNodeId('member'))!.sub).toBe('2 · PORT-ADAPTER · JWT');
  });

  it('도메인을 펼치면 핵심 개념과 spoke 링크가 드러난다', () => {
    const state = toggleDomain(INITIAL_DRILLDOWN, model, 'order');
    const { nodes, links } = computeVisible(model, state);
    const conceptIds = nodes.filter((n) => n.kind === 'concept').map((n) => n.id);
    expect(conceptIds).toEqual(['saga', 'cqrs']);
    expect(links).toContainEqual({ source: domainNodeId('order'), target: 'saga', kind: 'spoke' });
    // 두 개념 다 보이므로 둘 사이 관계 링크도 그려진다
    expect(links).toContainEqual({ source: 'saga', target: 'cqrs', kind: 'relation' });
  });

  it('여러 도메인에 걸친 개념은 펼쳐진 도메인마다 spoke 가 붙는다', () => {
    let state = toggleDomain(INITIAL_DRILLDOWN, model, 'order');
    state = toggleDomain(state, model, 'search');
    const { links } = computeVisible(model, state);
    const cqrsSpokes = links.filter((l) => l.kind === 'spoke' && l.target === 'cqrs').map((l) => l.source);
    expect(cqrsSpokes.sort()).toEqual([domainNodeId('order'), domainNodeId('search')]);
  });

  it('핵심 개념은 CORE_CONCEPT_LIMIT 까지만 드러난다', () => {
    const many = Array.from({ length: CORE_CONCEPT_LIMIT + 5 }, (_, i) => concept(`c${i}`, 'ARCHITECTURE', i));
    const bigModel = buildDomainModel(graphData(many), [
      { code: 'order', label: '주문·결제', tagline: null, conceptIds: many.map((c) => c.id) },
    ]);
    const state = toggleDomain(INITIAL_DRILLDOWN, bigModel, 'order');
    const { nodes } = computeVisible(bigModel, state);
    expect(nodes.filter((n) => n.kind === 'concept')).toHaveLength(CORE_CONCEPT_LIMIT);
  });

  it('pin 된 개념은 top-N 밖이어도 보인다', () => {
    const many = Array.from({ length: CORE_CONCEPT_LIMIT + 5 }, (_, i) => concept(`c${i}`, 'ARCHITECTURE', i));
    const bigModel = buildDomainModel(graphData(many), [
      { code: 'order', label: '주문·결제', tagline: null, conceptIds: many.map((c) => c.id) },
    ]);
    // c0 은 weight 최하위 — top-12 에 못 든다
    let state = toggleDomain(INITIAL_DRILLDOWN, bigModel, 'order');
    expect(computeVisible(bigModel, state).nodes.some((n) => n.id === 'c0')).toBe(false);
    state = revealConcepts(state, bigModel, ['c0']);
    expect(computeVisible(bigModel, state).nodes.some((n) => n.id === 'c0')).toBe(true);
  });

  it('개념을 펼치면 접힌 도메인의 이웃도 관계 링크로만 드러난다', () => {
    const state = expandConcept(INITIAL_DRILLDOWN, model, 'saga');
    const { nodes, links } = computeVisible(model, state);
    const ids = nodes.map((n) => n.id);
    // saga 의 이웃 cqrs/jwt — 소속 도메인(search/member)이 접혀 있어도 보인다
    expect(ids).toContain('cqrs');
    expect(ids).toContain('jwt');
    expect(links).toContainEqual({ source: 'saga', target: 'cqrs', kind: 'relation' });
    // 접힌 도메인으로는 spoke 를 걸지 않는다
    expect(links.some((l) => l.kind === 'spoke' && l.target === 'jwt')).toBe(false);
    // saga 자신의 도메인은 펼쳐져 spoke 가 생긴다
    expect(links).toContainEqual({ source: domainNodeId('order'), target: 'saga', kind: 'spoke' });
  });

  it('무소속 개념은 pin 되면 보이지만 소속 도메인 노드가 없다', () => {
    const state = revealConcepts(INITIAL_DRILLDOWN, model, ['tcp']);
    const { nodes, links } = computeVisible(model, state);
    const tcp = nodes.find((n) => n.id === 'tcp')!;
    expect(tcp.domainNodeId).toBeNull();
    expect(links.some((l) => l.kind === 'spoke' && l.target === 'tcp')).toBe(false);
  });
});

describe('drilldown state transitions', () => {
  const model = buildDomainModel(BASE_DATA, SPECS);

  it('toggleDomain 은 접을 때 그 도메인의 파생 상태를 정리한다', () => {
    let state = selectConcept(INITIAL_DRILLDOWN, model, 'saga');
    expect(state.selected).toBe('saga');
    expect(state.expandedDomains.has('order')).toBe(true);
    state = toggleDomain(state, model, 'order');
    expect(state.expandedDomains.has('order')).toBe(false);
    expect(state.selected).toBeNull();
    expect(state.pinned.has('saga')).toBe(false);
    expect(state.expandedConcepts.has('saga')).toBe(false);
  });

  it('여러 도메인에 걸친 개념은 다른 소속 도메인이 열려 있으면 접기에도 살아남는다', () => {
    let state = selectConcept(INITIAL_DRILLDOWN, model, 'cqrs'); // order 가 열린다
    state = toggleDomain(state, model, 'search'); // search 도 연다
    state = toggleDomain(state, model, 'order'); // order 만 접는다
    expect(state.pinned.has('cqrs')).toBe(true);
    expect(state.selected).toBe('cqrs');
  });

  it('selectConcept 은 대표 도메인을 열고 본인+이웃을 강조한다', () => {
    const state = selectConcept(INITIAL_DRILLDOWN, model, 'saga');
    expect(state.selected).toBe('saga');
    expect(state.expandedDomains.has('order')).toBe(true);
    expect([...state.highlighted].sort()).toEqual(['cqrs', 'jwt', 'saga']);
  });

  it('selectConcept 은 그래프에 없는 개념이어도 상세 패널용 selected 는 세팅한다', () => {
    const state = selectConcept(INITIAL_DRILLDOWN, model, 'not-in-graph');
    expect(state.selected).toBe('not-in-graph');
    expect(state.expandedDomains.size).toBe(0);
  });

  it('revealConcepts 는 히트들의 도메인을 열고 pin+강조한다 (미지 id 무시)', () => {
    const state = revealConcepts(INITIAL_DRILLDOWN, model, ['saga', 'btree', 'ghost']);
    expect(state.expandedDomains.has('order')).toBe(true);
    expect(state.expandedDomains.has('search')).toBe(true);
    expect([...state.highlighted].sort()).toEqual(['btree', 'saga']);
    expect(state.pinned.has('saga')).toBe(true);
  });

  it('무소속 개념만 히트해도 pin+강조는 된다 (열 도메인이 없을 뿐)', () => {
    const state = revealConcepts(INITIAL_DRILLDOWN, model, ['tcp']);
    expect(state.expandedDomains.size).toBe(0);
    expect(state.pinned.has('tcp')).toBe(true);
    expect([...state.highlighted]).toEqual(['tcp']);
  });

  it('revealCategory 는 루트 축과 무관하게 해당 카테고리 개념 전부를 드러낸다', () => {
    const state = revealCategory(INITIAL_DRILLDOWN, model, 'ARCHITECTURE');
    expect([...state.highlighted].sort()).toEqual(['cqrs', 'port-adapter']);
    // cqrs → order, port-adapter → member 로 서로 다른 업무 도메인이 함께 열린다
    expect(state.expandedDomains.has('order')).toBe(true);
    expect(state.expandedDomains.has('member')).toBe(true);
  });

  it('conceptsOfCategory 는 weight 내림차순으로 준다', () => {
    expect(conceptsOfCategory(model, 'ARCHITECTURE').map((n) => n.id)).toEqual(['cqrs', 'port-adapter']);
  });

  it('categoryFocusTarget 은 대표 개념의 소속 도메인 노드를 가리킨다', () => {
    expect(categoryFocusTarget(model, 'ARCHITECTURE')).toBe(domainNodeId('order'));
    // 무소속 개념뿐인 카테고리는 개념 자신을 본다
    expect(categoryFocusTarget(model, 'NETWORK')).toBe('tcp');
    expect(categoryFocusTarget(model, 'TESTING')).toBeNull();
  });

  it('clearEmphasis 는 강조/선택만 걷고 펼친 구조는 유지한다', () => {
    let state = selectConcept(INITIAL_DRILLDOWN, model, 'saga');
    state = clearEmphasis(state);
    expect(state.selected).toBeNull();
    expect(state.highlighted.size).toBe(0);
    expect(state.expandedDomains.has('order')).toBe(true);
    expect(state.pinned.has('saga')).toBe(true);
  });

  it('conceptWeight 는 코드 참조를 연관보다 무겁게 친다', () => {
    expect(conceptWeight(concept('x', 'ARCHITECTURE', 3, 2))).toBe(8);
  });
});
