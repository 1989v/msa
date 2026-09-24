import type { ConceptHierarchy, HierarchyNode } from '../../types/graph';

/**
 * hierarchyModel — /tech 계층 뷰의 순수 로직.
 *
 * 서버가 준 DAG(`CONTAINS` 로 층을 센 노드 + 간선)를 접기·펼치기 상태와 합쳐
 * **지금 보이는 행**만 계산한다. 같은 개념이 두 부모를 가지면 양쪽 아래에 행이 생기지만
 * id 는 하나라 선택·강조는 두 행에 같이 걸린다.
 */

export interface HierarchyModel {
  roots: string[];
  nodesById: Map<string, HierarchyNode>;
  /** CONTAINS — ordinal 순 */
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  /** FLOWS_TO — 같은 층 안 다음 단계 */
  nextOf: Map<string, string[]>;
  /** USES — 이 단계·장치가 쓰는 용어·장치·구체물. 트리 행이 아니라 칩으로 보인다 */
  usesOf: Map<string, string[]>;
  maxDepth: number;
}

export interface HierarchyRow {
  /** 부모 경로까지 붙인 행 키 — 두 부모 아래 같은 개념이 나와도 React 키가 겹치지 않는다 */
  key: string;
  node: HierarchyNode;
  /** 행이 놓인 위치의 깊이 (두 부모 중 먼 쪽 아래면 node.depth 보다 클 수 있다) */
  indent: number;
  hasChildren: boolean;
  expanded: boolean;
  parentCount: number;
  nextIds: string[];
  usesIds: string[];
}

function pushTo(map: Map<string, string[]>, key: string, value: string): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

export function buildHierarchyModel(data: ConceptHierarchy): HierarchyModel {
  const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const nextOf = new Map<string, string[]>();
  const usesOf = new Map<string, string[]>();
  const contains = data.edges.filter((e) => e.kind === 'CONTAINS').sort((a, b) => a.ordinal - b.ordinal);
  for (const e of contains) {
    if (!nodesById.has(e.from) || !nodesById.has(e.to)) continue;
    pushTo(childrenOf, e.from, e.to);
    pushTo(parentsOf, e.to, e.from);
  }
  for (const e of data.edges) {
    if (!nodesById.has(e.from) || !nodesById.has(e.to)) continue;
    if (e.kind === 'FLOWS_TO') pushTo(nextOf, e.from, e.to);
    else if (e.kind === 'USES') pushTo(usesOf, e.from, e.to);
  }
  const maxDepth = data.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  return {
    roots: data.roots.filter((id) => nodesById.has(id)),
    nodesById,
    childrenOf,
    parentsOf,
    nextOf,
    usesOf,
    maxDepth,
  };
}

/** 처음엔 진입점과 그 바로 아래 층만 펼친다 — 전체를 한 번에 그리지 않는다 */
export function initialExpanded(model: HierarchyModel): ReadonlySet<string> {
  const expanded = new Set<string>();
  for (const root of model.roots) {
    expanded.add(root);
  }
  return expanded;
}

export function toggleExpanded(expanded: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(expanded);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** 부모 경로에 이미 있는 개념은 다시 내려가지 않는다 — 데이터가 순환해도 화면은 끝난다 */
export function visibleRows(model: HierarchyModel, expanded: ReadonlySet<string>): HierarchyRow[] {
  const rows: HierarchyRow[] = [];
  const walk = (id: string, indent: number, path: string[]) => {
    const node = model.nodesById.get(id);
    if (!node) return;
    const children = model.childrenOf.get(id) ?? [];
    const isExpanded = expanded.has(id);
    const key = [...path, id].join('/');
    rows.push({
      key,
      node,
      indent,
      hasChildren: children.length > 0,
      expanded: isExpanded,
      parentCount: model.parentsOf.get(id)?.length ?? 0,
      nextIds: model.nextOf.get(id) ?? [],
      usesIds: model.usesOf.get(id) ?? [],
    });
    if (!isExpanded) return;
    for (const child of children) {
      if (path.includes(child) || child === id) continue;
      walk(child, indent + 1, [...path, id]);
    }
  };
  for (const root of model.roots) walk(root, 0, []);
  return rows;
}
