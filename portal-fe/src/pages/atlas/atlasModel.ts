import type { ConceptHierarchy, HierarchyEdge, HierarchyNode } from '../../types/graph';

/**
 * 개념 아틀라스의 순수 로직 — 도메인 하나의 계층(CONTAINS)을 트리로 읽고, 좁혀 가는 경로와
 * 데스크탑 층별 배치를 계산한다. 화면은 이 결과만 그린다.
 */
export interface DomainTree {
  rootId: string;
  nodes: Map<string, HierarchyNode>;
  /** 부모 → 자식(ordinal 순) */
  children: Map<string, string[]>;
  /** 자식 → 부모들. 부모가 둘인 개념이 있다(다른 도메인이 함께 가진 장치) */
  parents: Map<string, string[]>;
  /** CONTAINS 가 아닌 간선 — 양 끝이 이 도메인 안에 있는 것만 */
  cross: HierarchyEdge[];
}

export function buildTree(hierarchy: ConceptHierarchy, rootId: string): DomainTree {
  const nodes = new Map(hierarchy.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const contains = hierarchy.edges
    .filter((e) => e.kind === 'CONTAINS' && nodes.has(e.from) && nodes.has(e.to))
    .sort((a, b) => a.ordinal - b.ordinal);
  for (const e of contains) {
    children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
    parents.set(e.to, [...(parents.get(e.to) ?? []), e.from]);
  }
  return {
    rootId,
    nodes,
    children,
    parents,
    cross: hierarchy.edges.filter((e) => e.kind !== 'CONTAINS' && nodes.has(e.from) && nodes.has(e.to)),
  };
}

/** 루트에서 target 까지의 최단 CONTAINS 경로(루트 포함). 닿지 않으면 루트만 */
export function pathTo(tree: DomainTree, target: string): string[] {
  if (target === tree.rootId || !tree.nodes.has(target)) return [tree.rootId];
  const prev = new Map<string, string>();
  const queue = [tree.rootId];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const next of tree.children.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === target) {
        const path = [next];
        let p = cur;
        while (p !== tree.rootId) {
          path.unshift(p);
          p = prev.get(p) as string;
        }
        return [tree.rootId, ...path];
      }
      queue.push(next);
    }
  }
  return [tree.rootId];
}

/** 층(루트 0)마다 개념 수 — 층 막대가 그린다 */
export function layerCounts(tree: DomainTree): number[] {
  const counts: number[] = [];
  for (const n of tree.nodes.values()) counts[n.depth] = (counts[n.depth] ?? 0) + 1;
  return Array.from({ length: counts.length }, (_, i) => counts[i] ?? 0);
}

/** 같은 부모 아래의 다음 단계들(FLOWS_TO) */
export function nextSteps(tree: DomainTree, id: string): string[] {
  return tree.cross.filter((e) => e.kind === 'FLOWS_TO' && e.from === id).map((e) => e.to);
}

export function previousSteps(tree: DomainTree, id: string): string[] {
  return tree.cross.filter((e) => e.kind === 'FLOWS_TO' && e.to === id).map((e) => e.from);
}

/** 하위 전체 수 — 접힌 노드 옆 `+N` */
export function descendantCount(tree: DomainTree, id: string): number {
  const seen = new Set<string>();
  const stack = [...(tree.children.get(id) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(tree.children.get(cur) ?? []));
  }
  return seen.size;
}

export interface LaidNode {
  id: string;
  column: number;
  row: number;
  onPath: boolean;
}

/**
 * 데스크탑 층별 배치 — 경로 위 노드만 펼친다. 열 i 는 경로[i-1] 의 자식들이고,
 * 자식 무리는 부모의 행 근처에서 시작해 부모와 선이 짧게 이어진다.
 */
export function layoutColumns(tree: DomainTree, path: string[]): LaidNode[] {
  const laid: LaidNode[] = [{ id: tree.rootId, column: 0, row: 0, onPath: true }];
  let parentRow = 0;
  for (let col = 1; col <= path.length; col += 1) {
    const parent = path[col - 1];
    const kids = tree.children.get(parent) ?? [];
    if (kids.length === 0) break;
    const onPathIdx = col < path.length ? kids.indexOf(path[col]) : -1;
    // 경로 위 자식이 부모와 같은 행에 오도록 무리를 민다 — 음수 행은 마지막에 전체를 내려 맞춘다
    const start = parentRow - Math.max(onPathIdx, 0);
    kids.forEach((id, i) => laid.push({ id, column: col, row: start + i, onPath: i === onPathIdx }));
    if (onPathIdx < 0) break;
    parentRow = start + onPathIdx;
  }
  const top = Math.min(...laid.map((n) => n.row));
  return laid.map((n) => ({ ...n, row: n.row - top }));
}
