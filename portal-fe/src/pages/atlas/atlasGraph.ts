import type { ConceptKind } from '../../types/graph';

/**
 * 개념 아틀라스의 순수 로직 — 빌드에 실린 정적 그래프(`generated/graph.json`)를 색인하고,
 * 병풍(도메인 아웃라인)과 관계 판·그래프 판이 쓰는 값을 계산한다. 화면은 이 결과만 그린다.
 *
 * 그래프 원본은 온톨로지 YAML 이고, code-dictionary 의 `AtlasGraphExportSpec` 이 내보낸다.
 */
export interface RawGraph {
  revision: number;
  source: string;
  kinds: string[];
  edgeKinds: string[];
  /** [key, name, description, rootId, codeRefCount] */
  domains: [string, string, string, string, number][];
  /** [id, name, kindIndex, domainIndex] */
  concepts: [string, string, number, number][];
  /** [fromIndex, toIndex, edgeKindIndex] */
  edges: [number, number, number][];
}

export interface GraphConcept {
  id: string;
  name: string;
  kind: ConceptKind;
  domain: string;
}

export interface GraphDomain {
  key: string;
  name: string;
  description: string;
  rootId: string;
  codeRefCount: number;
  conceptIds: string[];
}

export interface Edge {
  from: string;
  to: string;
  kind: string;
}

export interface Graph {
  revision: number;
  domains: GraphDomain[];
  concepts: Map<string, GraphConcept>;
  /** 부모 → 자식 (파일 순서 = 학습 순서) */
  children: Map<string, string[]>;
  out: Map<string, Edge[]>;
  in: Map<string, Edge[]>;
  /** 도메인 루트들 */
  roots: Set<string>;
}

export function indexGraph(raw: RawGraph): Graph {
  const concepts = new Map<string, GraphConcept>();
  const ids = raw.concepts.map(([id, name, k, d]) => {
    concepts.set(id, { id, name, kind: raw.kinds[k] as ConceptKind, domain: raw.domains[d][0] });
    return id;
  });
  const children = new Map<string, string[]>();
  const out = new Map<string, Edge[]>();
  const inn = new Map<string, Edge[]>();
  const push = <T>(m: Map<string, T[]>, key: string, v: T) => {
    const list = m.get(key);
    if (list) list.push(v);
    else m.set(key, [v]);
  };
  for (const [f, t, k] of raw.edges) {
    const e = { from: ids[f], to: ids[t], kind: raw.edgeKinds[k] };
    push(out, e.from, e);
    push(inn, e.to, e);
    if (e.kind === 'CONTAINS') push(children, e.from, e.to);
  }
  const domains = raw.domains.map(([key, name, description, rootId, codeRefCount]) => ({
    key, name, description, rootId, codeRefCount, conceptIds: [] as string[],
  }));
  const byKey = new Map(domains.map((d) => [d.key, d]));
  for (const c of concepts.values()) byKey.get(c.domain)?.conceptIds.push(c.id);
  return { revision: raw.revision, domains, concepts, children, out, in: inn, roots: new Set(domains.map((d) => d.rootId)) };
}

/** 아틀라스 첫 화면이 그리는 도메인 요약 — 정적 그래프에서 만든다 */
export interface AtlasDomain {
  domain: string;
  rootId: string;
  name: string;
  description?: string | null;
  conceptCount: number;
  kindCounts: Record<string, number>;
  codeRefCount: number;
  conceptIds: string[];
}

export interface ConceptAtlas {
  domains: AtlasDomain[];
  links: { from: string; to: string; count: number }[];
}

/** 도메인 간 관계 수 — 아틀라스 첫 화면의 지도가 그린다. 양 끝 도메인이 다른 간선을 쌍마다 센다 */
export function domainLinks(g: Graph): { from: string; to: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of g.out.values()) {
    for (const e of list) {
      const a = g.concepts.get(e.from)?.domain;
      const b = g.concepts.get(e.to)?.domain;
      if (!a || !b || a === b) continue;
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split('\u0000');
      return { from, to, count };
    })
    .sort((x, y) => y.count - x.count);
}

export function kindCounts(g: Graph, d: GraphDomain): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of d.conceptIds) {
    const k = g.concepts.get(id)?.kind ?? 'TERM';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

/**
 * 형제 순서 — 형제끼리 FLOWS_TO 로 이어져 있으면 그 흐름 순서로 앞에 세우고 1, 2, 3 을 붙인다.
 * 흐름에 없는 형제는 원래 순서로 뒤에 둔다.
 */
export function orderSiblings(g: Graph, ids: string[]): { list: string[]; step: Map<string, number> } {
  const set = new Set(ids);
  const next = (id: string) => (g.out.get(id) ?? []).filter((e) => e.kind === 'FLOWS_TO' && set.has(e.to)).map((e) => e.to);
  const inFlow = new Set<string>();
  const indeg = new Map(ids.map((i) => [i, 0]));
  for (const i of ids) {
    for (const t of next(i)) {
      inFlow.add(i);
      inFlow.add(t);
      indeg.set(t, (indeg.get(t) ?? 0) + 1);
    }
  }
  if (inFlow.size === 0) return { list: ids, step: new Map() };
  const queue = ids.filter((i) => inFlow.has(i) && indeg.get(i) === 0);
  const chain: string[] = [];
  while (queue.length > 0) {
    const i = queue.shift() as string;
    chain.push(i);
    for (const t of next(i)) {
      indeg.set(t, (indeg.get(t) ?? 0) - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  const step = new Map(chain.map((i, k) => [i, k + 1]));
  return { list: [...chain, ...ids.filter((i) => !step.has(i))], step };
}

/** 하위 전체 수 — 접힌 항목 옆 숫자 */
export function descendantCount(g: Graph, id: string): number {
  const seen = new Set<string>();
  const stack = [...(g.children.get(id) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(g.children.get(cur) ?? []));
  }
  return seen.size;
}

/** 루트에서 target 까지의 최단 포함 경로(양 끝 포함). 닿지 않으면 빈 배열 */
export function pathFromRoot(g: Graph, rootId: string, target: string): string[] {
  if (rootId === target) return [rootId];
  const prev = new Map<string, string>();
  const queue = [rootId];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const next of g.children.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === target) {
        const path = [next];
        for (let p = cur; p !== rootId; p = prev.get(p) as string) path.unshift(p);
        return [rootId, ...path];
      }
      queue.push(next);
    }
  }
  return [];
}

/** 들어오는 쪽에서 읽는 이름 — 백엔드 `ConceptEdgeKind.inverseLabel` 과 같은 말 */
const INVERSE: Record<string, string> = {
  CONTAINS: 'PART_OF',
  FLOWS_TO: 'FOLLOWS',
  USES: 'USED_BY',
  IMPLEMENTS: 'IMPLEMENTED_BY',
  AFFECTS: 'AFFECTED_BY',
  CAUSES: 'CAUSED_BY',
  MITIGATES: 'MITIGATED_BY',
  MEASURED_BY: 'MEASURES',
  ALTERNATIVE_TO: 'ALTERNATIVE_TO',
};

export type RelationGroup = 'flow' | 'cross' | 'hier';

export interface Neighbor {
  /** RELATION_LABELS 의 키 — 나가는 쪽은 간선 이름, 들어오는 쪽은 역방향 이름 */
  label: string;
  incoming: boolean;
  group: RelationGroup;
  concept: GraphConcept;
}

const groupOf = (kind: string): RelationGroup => (kind === 'FLOWS_TO' ? 'flow' : kind === 'CONTAINS' ? 'hier' : 'cross');

/** 한 개념의 이웃 전부 — 흐름 · 가로지름 · 포함, 들어오는 쪽과 나가는 쪽 */
export function neighbors(g: Graph, id: string): Neighbor[] {
  const out: Neighbor[] = [];
  for (const e of g.out.get(id) ?? []) {
    const c = g.concepts.get(e.to);
    if (c) out.push({ label: e.kind, incoming: false, group: groupOf(e.kind), concept: c });
  }
  for (const e of g.in.get(id) ?? []) {
    const c = g.concepts.get(e.from);
    if (!c) continue;
    // 도메인 루트는 누구의 「속한 곳」으로 세지 않는다 — 모든 첫 층이 루트를 가리켜 소음이 된다
    if (e.kind === 'CONTAINS' && g.roots.has(c.id)) continue;
    out.push({ label: INVERSE[e.kind] ?? e.kind, incoming: e.kind !== 'ALTERNATIVE_TO', group: groupOf(e.kind), concept: c });
  }
  return out;
}

/** 흐름 → 가로지름 → 포함 — 따라갈 가치가 큰 것부터 */
export const GROUP_RANK: Record<RelationGroup, number> = { flow: 0, cross: 1, hier: 2 };

export interface LocalGraph {
  nodes: { id: string; name: string; kind: ConceptKind; depth: number; domain: string }[];
  links: { source: string; target: string; group: RelationGroup }[];
}

/**
 * 로컬 그래프 — 고른 개념에서 depth 홉까지. 이웃의 이웃은 개념마다 `perNode` 개로 자른다
 * (허브 개념 하나가 판을 실타래로 만들지 않게). `hidden` 에 든 관계 이름은 뺀다.
 */
export function localGraph(g: Graph, center: string, depth: 1 | 2, hidden: Set<string>, perNode = 8): LocalGraph {
  const c = g.concepts.get(center);
  if (!c) return { nodes: [], links: [] };
  const nodes = new Map([[center, { id: center, name: c.name, kind: c.kind, depth: 0, domain: c.domain }]]);
  const links: LocalGraph['links'] = [];
  const seen = new Set<string>();
  const link = (a: string, b: string, n: Neighbor) => {
    const [source, target] = n.incoming ? [b, a] : [a, b];
    const key = `${source}>${target}`;
    if (seen.has(key) || seen.has(`${target}>${source}`)) return;
    seen.add(key);
    links.push({ source, target, group: n.group });
  };
  const first = neighbors(g, center).filter((n) => !hidden.has(n.label));
  for (const n of first) {
    if (!nodes.has(n.concept.id)) nodes.set(n.concept.id, { ...n.concept, depth: 1 });
    link(center, n.concept.id, n);
  }
  if (depth === 2) {
    for (const n of first) {
      const second = neighbors(g, n.concept.id).filter((m) => m.concept.id !== center && !hidden.has(m.label)).slice(0, perNode);
      for (const m of second) {
        if (!nodes.has(m.concept.id)) nodes.set(m.concept.id, { ...m.concept, depth: 2 });
        link(n.concept.id, m.concept.id, m);
      }
    }
  }
  return { nodes: [...nodes.values()], links };
}

/** 이름 검색 — 앞에서 맞을수록, 짧을수록 위 */
export function searchConcepts(g: Graph, query: string, limit = 8): GraphConcept[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { c: GraphConcept; at: number }[] = [];
  for (const c of g.concepts.values()) {
    const at = c.name.toLowerCase().indexOf(q);
    if (at >= 0) hits.push({ c, at });
    else if (c.id.includes(q)) hits.push({ c, at: 1000 });
  }
  return hits.sort((a, b) => a.at - b.at || a.c.name.length - b.c.name.length).slice(0, limit).map((h) => h.c);
}
