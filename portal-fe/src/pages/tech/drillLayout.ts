/**
 * 드릴다운 그림 배치 — 좌표를 저장하지 않고 흐름에서 계산한다(ADR-0108 R5).
 *
 * - 열: 흐름(간선)의 최장 경로 단계. 간선이 없는 노드는 첫 열
 * - 가로: 열이 화면 폭을 넘으면 다음 줄로 접고, 줄을 넘는 간선은 아래로 내려 왼쪽으로 돌아 들어간다
 * - 세로(좁은 화면): 열을 행으로 바꾸고, 한 행이 폭을 넘으면 여러 줄로 접는다(같은 단계끼리는 간선이 없다)
 * - 묶음 노드는 틀 안에 하위 단계를 나란히 펼친다(세로 배치에서 폭이 모자라면 여러 줄로)
 */

export interface DrillNode {
  id: string;
  lanes?: string[];
}
export interface DrillEdge {
  from: string;
  to: string;
  label?: string;
}
export interface DrillDiagram {
  nodes: DrillNode[];
  edges: DrillEdge[];
  related: string[];
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Box extends Rect {
  lanes: Rect[];
}
export interface Route {
  from: string;
  to: string;
  d: string;
  lx: number;
  ly: number;
  label?: string;
  /** 글자 정렬 — 기본은 가운데 */
  anchor?: 'start' | 'middle' | 'end';
}
export interface Layout {
  boxes: Box[];
  routes: Route[];
  width: number;
  height: number;
}

export const NODE_W = 168;
export const NODE_H = 58;
const PAD = 28;
const GAP_X = 92;
const GAP_Y = 26;
const BAND_GAP = 64;
const GROUP_PAD = 12;
const GROUP_HEAD = 28;
/** 묶음 안 단계 사이 — 위 단계의 [상세보기] 글자가 들어갈 자리 */
const LANE_GAP = 24;
const GROUP_FOOT = 24;
/** 세로 배치의 행 사이 — 위 상자의 [상세보기], 돌아가는 선의 글자, 받는 상자 쪽 글자가 차례로 들어갈 자리 */
const ROW_GAP_V = 60;

/**
 * 최장 경로 단계 — 순환이 있으면(데이터 오류) 남은 노드는 마지막 단계 다음에 둔다.
 * 흐름이 있는 그림에서 간선이 하나도 없는 노드는 맨 뒤 단계에 둔다 — 첫 단계에 두면 흐름의 시작처럼 읽힌다
 */
function layers(d: DrillDiagram): Map<string, number> {
  const ids = d.nodes.map((n) => n.id);
  const indeg = new Map(ids.map((id) => [id, 0]));
  for (const e of d.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const layer = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const done = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    done.add(id);
    for (const e of d.edges.filter((x) => x.from === id)) {
      layer.set(e.to, Math.max(layer.get(e.to) ?? 0, (layer.get(id) ?? 0) + 1));
      indeg.set(e.to, (indeg.get(e.to) ?? 0) - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }
  const max = Math.max(0, ...layer.values());
  for (const id of ids) if (!done.has(id)) layer.set(id, max + 1);
  if (d.edges.length) {
    const linked = new Set(d.edges.flatMap((e) => [e.from, e.to]));
    const last = Math.max(0, ...ids.filter((id) => linked.has(id)).map((id) => layer.get(id)!));
    for (const id of ids) if (!linked.has(id)) layer.set(id, last + 1);
  }
  return layer;
}

/** 묶음 안 단계를 한 줄에 몇 개 둘지 — 세로 배치는 폭이 모자라면 여러 줄로 접는다 */
function laneCols(n: DrillNode, vertical: boolean, maxWidth: number): number {
  const k = n.lanes?.length ?? 0;
  if (!vertical) return 1;
  return Math.max(1, Math.min(k, Math.floor((maxWidth - PAD * 2 - GROUP_PAD * 2 + LANE_GAP) / (NODE_W + LANE_GAP))));
}

function size(n: DrillNode, vertical: boolean, maxWidth: number, nodeH: number): { w: number; h: number } {
  const k = n.lanes?.length ?? 0;
  if (!k) return { w: NODE_W, h: nodeH };
  const cols = laneCols(n, vertical, maxWidth);
  const rows = Math.ceil(k / cols);
  return {
    w: GROUP_PAD * 2 + cols * NODE_W + (cols - 1) * LANE_GAP,
    h: GROUP_HEAD + rows * nodeH + (rows - 1) * LANE_GAP + GROUP_FOOT,
  };
}

function lanesOf(n: DrillNode, x: number, y: number, vertical: boolean, maxWidth: number, nodeH: number): Rect[] {
  const cols = laneCols(n, vertical, maxWidth);
  return (n.lanes ?? []).map((id, i) => ({
    id,
    x: x + GROUP_PAD + (i % cols) * (NODE_W + LANE_GAP),
    y: y + GROUP_HEAD + Math.floor(i / cols) * (nodeH + LANE_GAP),
    w: NODE_W,
    h: nodeH,
  }));
}

const curveH = (x1: number, y1: number, x2: number, y2: number) => {
  const k = Math.max(20, (x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
};
const curveV = (x1: number, y1: number, x2: number, y2: number) => {
  const k = Math.max(16, (y2 - y1) / 2);
  return `M${x1},${y1} C${x1},${y1 + k} ${x2},${y2 - k} ${x2},${y2}`;
};

/**
 * @param maxWidth 그릴 수 있는 폭(px). 가로 배치에서 열을 몇 개씩 한 줄에 둘지 정한다
 * @param nodeH 노드 상자 높이 — 제목이 두 줄인 노드가 있는 그림은 화면이 키워서 넘긴다
 */
export function layoutDiagram(
  d: DrillDiagram,
  { vertical, maxWidth, nodeH = NODE_H }: { vertical: boolean; maxWidth: number; nodeH?: number },
): Layout {
  if (d.nodes.length === 0) return { boxes: [], routes: [], width: 0, height: 0 };
  const layer = layers(d);
  const count = Math.max(...layer.values()) + 1;
  const columns: DrillNode[][] = Array.from({ length: count }, () => []);
  for (const n of d.nodes) columns[layer.get(n.id)!].push(n);

  const boxes = new Map<string, Box>();
  const bandOf = new Map<string, number>();
  let width = 0;
  let height = 0;
  const bandBottoms: number[] = [];

  if (vertical) {
    const step = GAP_X / 2;
    const rows: DrillNode[][] = [];
    for (const col of columns) {
      let row: DrillNode[] = [];
      let used = 0;
      for (const n of col) {
        const w = size(n, true, maxWidth, nodeH).w;
        if (row.length && used + step + w > maxWidth - PAD * 2) {
          rows.push(row);
          row = [];
          used = 0;
        }
        used += (row.length ? step : 0) + w;
        row.push(n);
      }
      rows.push(row);
    }
    let y = PAD;
    const rowWidths = rows.map((col) => col.reduce((s, n) => s + size(n, true, maxWidth, nodeH).w, 0) + (col.length - 1) * step);
    // 받을 수 있는 폭을 다 쓴다 — 선 옆 글자가 상자 폭 밖으로 나가도 그림 안에 남게
    width = Math.max(Math.max(...rowWidths) + PAD * 2, maxWidth);
    rows.forEach((col, r) => {
      const rowH = Math.max(...col.map((n) => size(n, true, maxWidth, nodeH).h));
      let x = (width - rowWidths[r]) / 2;
      for (const n of col) {
        const { w, h } = size(n, true, maxWidth, nodeH);
        boxes.set(n.id, { id: n.id, x, y: y + (rowH - h) / 2, w, h, lanes: lanesOf(n, x, y + (rowH - h) / 2, true, maxWidth, nodeH) });
        bandOf.set(n.id, 0);
        x += w + step;
      }
      y += rowH + ROW_GAP_V;
    });
    height = y - ROW_GAP_V + PAD;
  } else {
    const slot = NODE_W + GROUP_PAD * 2;
    const fit = Math.max(1, Math.floor((maxWidth - PAD * 2 + GAP_X) / (slot + GAP_X)));
    const bands = Math.ceil(count / fit);
    const perBand = Math.ceil(count / bands);
    let top = PAD;
    for (let b = 0; b < bands; b++) {
      const cols = columns.slice(b * perBand, (b + 1) * perBand);
      const colH = cols.map((col) => col.reduce((s, n) => s + size(n, false, maxWidth, nodeH).h, 0) + (col.length - 1) * GAP_Y);
      const bandH = Math.max(...colH);
      cols.forEach((col, i) => {
        const x = PAD + i * (slot + GAP_X);
        let y = top + (bandH - colH[i]) / 2;
        for (const n of col) {
          const { w, h } = size(n, false, maxWidth, nodeH);
          const bx = x + (slot - w) / 2;
          boxes.set(n.id, { id: n.id, x: bx, y, w, h, lanes: lanesOf(n, bx, y, false, maxWidth, nodeH) });
          bandOf.set(n.id, b);
          y += h + GAP_Y;
        }
      });
      width = Math.max(width, PAD * 2 + cols.length * slot + (cols.length - 1) * GAP_X);
      top += bandH;
      bandBottoms.push(top);
      top += BAND_GAP;
    }
    height = top - BAND_GAP + PAD;
  }

  /** 두 단계 이상 건너뛰는 간선이 지나갈 사이 노드들 */
  const between = (e: DrillEdge) =>
    [...boxes.values()].filter((x) => {
      const l = layer.get(x.id)!;
      return l > layer.get(e.from)! && l < layer.get(e.to)! && bandOf.get(x.id) === bandOf.get(e.from);
    });
  /** 출발 상자마다 이미 단 돌아가는 간선 글자 수 — 겹치지 않게 한 줄씩 내린다 */
  const detours = new Map<string, number>();
  /** 세로 배치에서 이미 쓴 돌아가는 통로 — 쪽과 높이 범위 */
  const passes: { left: boolean; y1: number; y2: number }[] = [];
  const routes: Route[] = d.edges.map((e) => {
    const a = boxes.get(e.from)!;
    const b = boxes.get(e.to)!;
    const mid = between(e);
    if (vertical) {
      const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
      // 사이에 낀 상자 — 단계를 건너뛴 간선뿐 아니라 접힌 줄을 지나는 간선도 걸린다
      const hit = [...boxes.values()].filter(
        (m) => m.id !== e.from && m.id !== e.to && m.y >= y1 && m.y + m.h <= y2 && m.x < Math.max(x1, x2) + 8 && m.x + m.w > Math.min(x1, x2) - 8,
      );
      if (hit.length) {
        // 사이 노드의 옆으로 비켜 내려간다 — 출발이 가운데보다 왼쪽이면 왼쪽으로.
        // 그쪽에 높이가 겹치는 돌아가는 선이 이미 있으면 반대쪽으로 — 같은 통로를 쓰면 선이 겹쳐 어느 쪽인지 안 보인다
        let left = x1 <= width / 2;
        if (passes.some((u) => u.left === left && u.y1 < y2 && y1 < u.y2)) left = !left;
        passes.push({ left, y1, y2 });
        const sx = left ? Math.min(...hit.map((m) => m.x)) - 16 : Math.max(...hit.map((m) => m.x + m.w)) + 16;
        const dd = `M${x1},${y1} C${x1},${y1 + 24} ${sx},${y1 + 12} ${sx},${y1 + 36} L${sx},${y2 - 36} C${sx},${y2 - 12} ${x2},${y2 - 24} ${x2},${y2}`;
        // 글자는 돌아가는 선이 아니라 출발 상자 바로 밑, 선이 돌아 나가지 않는 쪽에 — 선은 가장자리를 타서 글자가 그림 밖으로 잘린다
        // 오른쪽 통로는 바깥에 자리가 남는다 — 글자를 그 세로 구간 옆에 달아 어느 선의 글자인지 보이게 한다(글자 폭은 어림)
        if (!left && e.label && width - sx - 10 >= e.label.length * 11) {
          return { from: e.from, to: e.to, label: e.label, d: dd, lx: sx + 6, ly: (y1 + y2) / 2 + 9, anchor: 'start' };
        }
        const lx = left ? x1 + 8 : x1 - 8;
        const nth = detours.get(e.from) ?? 0;
        detours.set(e.from, nth + 1);
        return { from: e.from, to: e.to, label: e.label, d: dd, lx, ly: y1 + 37 + nth * 16, anchor: left ? 'start' : 'end' };
      }
      // 글자는 받는 상자 쪽, 선 오른쪽에 붙인다 — 가운데에 두면 출발 상자의 [상세보기] 글자와 겹치고, 선 위에 두면 선이 글자를 가른다
      return { from: e.from, to: e.to, label: e.label, d: curveV(x1, y1, x2, y2), lx: Math.max(x1, x2) + 8, ly: y2 - 6, anchor: 'start' };
    }
    if (bandOf.get(e.from) === bandOf.get(e.to)) {
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      const hit = mid.filter((m) => m.y < Math.max(y1, y2) + 8 && m.y + m.h > Math.min(y1, y2) - 8);
      if (hit.length) {
        // 사이 노드의 위나 아래로 돌아간다 — 출발이 사이 노드보다 위에 있으면 위로
        const top = Math.min(...hit.map((m) => m.y));
        const bottom = Math.max(...hit.map((m) => m.y + m.h));
        const up = y1 <= (top + bottom) / 2;
        const ry = up ? top - 18 : bottom + 26;
        const k = 28;
        const dd = `M${x1},${y1} C${x1 + k},${y1} ${x1 + k},${ry} ${x1 + k * 2},${ry} L${x2 - k * 2},${ry} C${x2 - k},${ry} ${x2 - k},${y2} ${x2},${y2}`;
        return { from: e.from, to: e.to, label: e.label, d: dd, lx: (x1 + x2) / 2, ly: ry };
      }
      return { from: e.from, to: e.to, label: e.label, d: curveH(x1, y1, x2, y2), lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 };
    }
    // 다음 줄로 넘어가는 간선 — 아래로 내려 왼쪽으로 돌아 대상의 왼쪽으로 들어간다
    const sx = a.x + a.w / 2, sy = a.y + a.h;
    const midY = bandBottoms[bandOf.get(e.from)!] + BAND_GAP / 2;
    const tx = b.x, ty = b.y + b.h / 2, lx = tx - 28, r = 8;
    const d = `M${sx},${sy} L${sx},${midY - r} Q${sx},${midY} ${sx - r},${midY} L${lx + r},${midY} Q${lx},${midY} ${lx},${midY + r} L${lx},${ty - r} Q${lx},${ty} ${lx + r},${ty} L${tx},${ty}`;
    return { from: e.from, to: e.to, label: e.label, d, lx: (sx + lx) / 2, ly: midY };
  });

  // 돌아가는 간선이 그림 밖으로 나가지 않게 높이를 늘린다
  const lowest = Math.max(height, ...routes.map((r) => r.ly + 18));
  return { boxes: [...boxes.values()], routes, width, height: lowest };
}
