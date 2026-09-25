import {
  forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimNode, type Simulation,
} from 'd3-force-3d';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { ConceptKind } from '../../types/graph';
import { localGraph, type Graph, type RelationGroup } from './atlasGraph';

interface Props {
  graph: Graph;
  sel: string;
  depth: 1 | 2;
  hidden: Set<string>;
  full: boolean;
  onToggleFull: () => void;
  onSelect: (id: string) => void;
}

interface Node extends SimNode {
  name: string;
  kind: ConceptKind;
  depth: number;
}
interface Link {
  source: string | Node;
  target: string | Node;
  group: RelationGroup;
}

const W = 420;
const H = 440;
const radius = (n: Node) => (n.depth === 0 ? 9 : n.depth === 1 ? 6 : 4);
const endId = (e: string | Node) => (typeof e === 'string' ? e : e.id);

/**
 * 그래프 판 — 옵시디언 로컬 그래프처럼 고른 개념을 가운데 두고 깊이 1~2 의 이웃을 힘으로 배치한다.
 * 색은 먹빛 하나에 황토(흐름 · 중심 · 강조)만 쓰고, 유형은 모양으로 가른다. 노드를 누르면 중심이 옮겨 간다.
 */
export default function GraphBoard({ graph, sel, depth, hidden, full, onToggleFull, onSelect }: Props) {
  const lg = useMemo(() => localGraph(graph, sel, depth, hidden), [graph, sel, depth, hidden]);
  // 시뮬레이션은 ref 의 노드를 움직이고, 그리기는 틱마다 찍은 스냅숏(state)에서 한다
  const [snap, setSnap] = useState<{ nodes: Node[]; links: { a: string; b: string; group: RelationGroup }[] }>({ nodes: [], links: [] });
  const [focus, setFocus] = useState<string | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0, of: sel });
  if (view.of !== sel) setView({ k: 1, x: 0, y: 0, of: sel });
  const nodesRef = useRef<Node[]>([]);
  const simRef = useRef<Simulation<Node> | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const nodes: Node[] = lg.nodes.map((n) => ({ ...n, ...(n.depth === 0 ? { fx: 0, fy: 0 } : {}) }));
    const links: Link[] = lg.links.map((l) => ({ ...l }));
    nodesRef.current = nodes;
    const sim = forceSimulation(nodes, 2)
      .force('link', forceLink<Node, Link>(links).id((n) => n.id).distance((l) => (endId(l.source) === sel || endId(l.target) === sel ? 90 : 50)).strength(0.7))
      .force('charge', forceManyBody<Node>().strength((n) => (n.depth === 2 ? -60 : -220)))
      .force('collide', forceCollide<Node>().radius((n) => radius(n) + 10))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.05));
    simRef.current = sim;
    const shot = () => setSnap({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ a: endId(l.source), b: endId(l.target), group: l.group })),
    });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      sim.stop().tick(240);
      shot();
    } else {
      sim.on('tick', shot);
    }
    return () => {
      sim.stop();
    };
  }, [lg, sel]);

  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const l of lg.links) {
      if (l.source === focus) s.add(l.target);
      if (l.target === focus) s.add(l.source);
    }
    return s;
  }, [focus, lg]);

  // 끌기 — 빈 곳은 판을 옮기고, 노드는 그 노드를 옮긴다. 거의 안 움직였으면 누른 것으로 친다
  const drag = useRef<{ kind: 'pan' | 'node'; node?: Node; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const toGraph = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const sx = ((e.clientX - r.left) / r.width) * W - W / 2;
    const sy = ((e.clientY - r.top) / r.height) * H - H / 2;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
  };
  const onDown = (e: ReactPointerEvent, id?: string) => {
    e.stopPropagation();
    // 끌다가 판 밖으로 나가도 이어서 받는다 — 포인터가 이미 풀렸으면 잡지 않는다
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* 활성 포인터가 없다 */
    }
    const node = id ? nodesRef.current.find((n) => n.id === id) : undefined;
    drag.current = { kind: node ? 'node' : 'pan', node, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.kind === 'pan') {
      const r = svgRef.current?.getBoundingClientRect();
      const scale = r ? W / r.width : 1;
      setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx) * scale, y: d.oy + (e.clientY - d.sy) * scale }));
    } else if (d.node) {
      const p = toGraph(e);
      d.node.fx = p.x;
      d.node.fy = p.y;
      simRef.current?.alphaTarget(0.2).restart();
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'node' && d.node) {
      if (!d.moved && d.node.id !== sel) onSelect(d.node.id);
      if (d.node.depth > 0) {
        d.node.fx = null;
        d.node.fy = null;
      }
      simRef.current?.alphaTarget(0);
    }
  };
  const onWheel = (e: ReactWheelEvent) => {
    const k = Math.min(3, Math.max(0.4, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    setView((v) => ({ ...v, k }));
  };

  const nodes = snap.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const crowded = nodes.length > 30;

  return (
    <div className={`atlas-graph ${full ? 'is-full' : ''}`}>
      <svg
        ref={svgRef}
        viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`}
        role="img"
        aria-label={`${graph.concepts.get(sel)?.name} 중심 그래프 — 개념 ${nodes.length}`}
        onPointerDown={(e) => onDown(e)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onWheel={onWheel}
      >
        <defs>
          <marker id="atlas-arrow-cross" className="atlas-graph__marker" viewBox="0 -4 8 8" refX={15} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,-3.5L8,0L0,3.5" />
          </marker>
          <marker id="atlas-arrow-flow" className="atlas-graph__marker is-flow" viewBox="0 -4 8 8" refX={15} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,-3.5L8,0L0,3.5" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {snap.links.map((l) => {
            const a = byId.get(l.a);
            const b = byId.get(l.b);
            if (!a || !b || a.x == null || b.x == null) return null;
            const hot = focus && (a.id === focus || b.id === focus);
            const dim = near && !hot;
            return (
              <line
                key={`${a.id}>${b.id}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={`atlas-graph__edge is-${l.group} ${hot ? 'is-hot' : ''} ${dim ? 'is-dim' : ''}`}
                markerEnd={l.group === 'hier' ? undefined : `url(#atlas-arrow-${l.group === 'flow' ? 'flow' : 'cross'})`}
              />
            );
          })}
          {nodes.map((n) => {
            if (n.x == null || n.y == null) return null;
            const r = radius(n);
            const name = n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className={`atlas-graph__node is-${n.kind.toLowerCase()} d${n.depth} ${near && !near.has(n.id) ? 'is-dim' : ''} ${crowded && n.depth === 2 ? 'is-quiet' : ''}`}
                onPointerDown={(e) => onDown(e, n.id)}
                onPointerEnter={() => setFocus(n.id)}
                onPointerLeave={() => setFocus(null)}
              >
                <title>{n.name}</title>
                {n.depth === 0 && (
                  <>
                    <circle className="atlas-graph__halo" r={r + 12} />
                    <circle className="atlas-graph__ring" r={r + 5} />
                  </>
                )}
                <Shape kind={n.kind} r={r} />
                <text x={r + 5} y={4}>{name}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <button type="button" className="kh-mono atlas-graph__full" onClick={onToggleFull}>{full ? '닫기' : '크게'}</button>
      <div className="kh-mono atlas-graph__hint" aria-hidden="true">드래그 · 휠 확대 · 누르면 중심 이동</div>
      <div className="kh-mono atlas-graph__key" aria-hidden="true">
        <span className="is-flow"><i />흐름</span>
        <span className="is-cross"><i />가로지름</span>
        <span className="is-hier"><i />포함</span>
      </div>
    </div>
  );
}

/** 모양이 유형이다 — 색만으로 가르지 않는다 */
function Shape({ kind, r }: { kind: ConceptKind; r: number }) {
  switch (kind) {
    case 'MECHANISM':
      return <rect className="atlas-graph__shape" x={-r} y={-r} width={r * 2} height={r * 2} />;
    case 'DOMAIN':
      return <rect className="atlas-graph__shape" x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" />;
    case 'TECHNOLOGY':
      return <path className="atlas-graph__shape" d={`M0,${-r * 1.2}L${r * 1.1},${r * 0.8}L${-r * 1.1},${r * 0.8}Z`} />;
    case 'PROBLEM':
      return <path className="atlas-graph__shape" d={`M0,${r * 1.2}L${r * 1.1},${-r * 0.8}L${-r * 1.1},${-r * 0.8}Z`} />;
    case 'METRIC':
      return (
        <>
          <circle className="atlas-graph__shape" r={r} />
          <circle className="atlas-graph__dot" r={Math.max(1.5, r * 0.35)} />
        </>
      );
    default:
      return <circle className="atlas-graph__shape" r={r} />;
  }
}
