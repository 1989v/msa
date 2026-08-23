import { useEffect, useRef } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force-3d';
import type { LinkForce, Simulation } from 'd3-force-3d';
import type { VisibleGraph, VisibleNode } from './domainModel';
import './DomainMap.css';

/**
 * DomainMap — 옵시디언 그래프 느낌의 2D 캔버스 마인드맵.
 *
 * d3-force-3d 를 2차원으로 돌리고 rAF 에서 수동 tick 한다. 시뮬레이션이 식고
 * 카메라/스폰 애니메이션이 끝나면 rAF 루프를 완전히 멈춘다 (플랫폼 컨벤션 —
 * idle 캔버스는 rAF 를 돌리지 않는다).
 *
 * 입력(visible 노드/링크)은 domainModel.computeVisible 이 계산한 부분 그래프만
 * 받는다 — 전체 개념을 한 번에 그리지 않는 progressive disclosure.
 */

export interface DomainMapProps {
  graph: VisibleGraph;
  highlighted: ReadonlySet<string>;
  selectedId: string | null;
  /** nonce 가 바뀔 때마다 해당 노드로 카메라 이동 */
  focus: { id: string; nonce: number } | null;
  onNodeClick: (node: VisibleNode) => void;
  onBackgroundClick: () => void;
}

interface SimNode {
  id: string;
  data: VisibleNode;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  anchorX: number;
  anchorY: number;
  hasAnchor: boolean;
  spawnAt: number;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  kind: 'spoke' | 'relation';
}

/** 도메인 루트 링 반지름 (world 단위) */
const RING_RADIUS = 195;
const SPAWN_FADE_MS = 280;
const ALPHA_MIN = 0.02;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

function radiusOf(node: VisibleNode): number {
  if (node.kind === 'domain') {
    return Math.min(46, 22 + 3.4 * Math.sqrt(node.weight));
  }
  return Math.min(18, 6 + 2.0 * Math.sqrt(node.weight));
}

function endpoint(link: SimLink, side: 'source' | 'target'): SimNode | null {
  const value = link[side];
  return typeof value === 'string' ? null : value;
}

function easeAmount(reduced: boolean): number {
  return reduced ? 1 : 0.16;
}

/** 캔버스 색 — 토큰을 mount 시 1회 해석 (다크 전제 폴백 포함, hex 직접 지정 회피) */
function readCanvasColors(): { text: string; muted: string; link: string; accent: string } {
  const fallback = { text: 'oklch(0.96 0.005 250)', muted: 'oklch(0.62 0.015 250)', link: 'oklch(0.42 0.015 250)', accent: 'oklch(0.68 0.16 245)' };
  if (typeof window === 'undefined') return fallback;
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fb: string) => style.getPropertyValue(name).trim() || fb;
  return {
    text: pick('--ko-text-primary', fallback.text),
    muted: pick('--ko-text-muted', fallback.muted),
    link: pick('--ko-border-default', fallback.link),
    accent: pick('--ko-accent-primary', fallback.accent),
  };
}

export default function DomainMap({ graph, highlighted, selectedId, focus, onNodeClick, onBackgroundClick }: DomainMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 렌더 사이 유지되는 엔진 상태 (React 상태로 두면 프레임마다 리렌더된다)
  const simNodesRef = useRef<Map<string, SimNode>>(new Map());
  const simLinksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode> | null>(null);
  const linkForceRef = useRef<LinkForce<SimNode, SimLink> | null>(null);
  const camRef = useRef({ x: 0, y: 0, k: 1, fitted: false });
  const followRef = useRef<{ nodeId: string; toK: number } | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    downX: number;
    downY: number;
    moved: boolean;
    node: SimNode | null;
    pinchDist: number | null;
  } | null>(null);
  const colorsRef = useRef(readCanvasColors());
  const reducedMotionRef = useRef(false);
  /** mount 이펙트가 만든 rAF wake 를 데이터/포커스 이펙트가 공유 */
  const wakeRef = useRef<(() => void) | null>(null);

  const propsRef = useRef({ graph, highlighted, selectedId, onNodeClick, onBackgroundClick });
  useEffect(() => {
    propsRef.current = { graph, highlighted, selectedId, onNodeClick, onBackgroundClick };
  });

  /* ---- 엔진 셋업 (mount 1회) ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    colorsRef.current = readCanvasColors();
    reducedMotionRef.current =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const linkForce = forceLink<SimNode, SimLink>([])
      .id((n) => n.id)
      .distance((l) => (l.kind === 'spoke' ? 96 : 72))
      .strength((l) => (l.kind === 'spoke' ? 0.5 : 0.18));
    linkForceRef.current = linkForce;

    const sim = forceSimulation<SimNode>([], 2)
      .alphaMin(ALPHA_MIN)
      .velocityDecay(0.34)
      .force('charge', forceManyBody<SimNode>().strength((n) => (n.data.kind === 'domain' ? -460 : -150)).distanceMax(480))
      .force('collide', forceCollide<SimNode>((n) => n.r + 12).strength(0.9))
      .force('x', forceX<SimNode>((n) => n.anchorX).strength((n) => (n.hasAnchor ? 0.16 : 0.012)))
      .force('y', forceY<SimNode>((n) => n.anchorY).strength((n) => (n.hasAnchor ? 0.16 : 0.012)))
      .force('link', linkForce)
      .stop(); // rAF 에서 수동 tick
    simRef.current = sim;

    /* ---- 좌표 변환 ---- */
    const toWorld = (sx: number, sy: number) => {
      const { w, h } = sizeRef.current;
      const cam = camRef.current;
      return { x: (sx - w / 2) / cam.k + cam.x, y: (sy - h / 2) / cam.k + cam.y };
    };

    const hitTest = (sx: number, sy: number): SimNode | null => {
      const { x, y } = toWorld(sx, sy);
      const cam = camRef.current;
      // 터치 대상 최소 22px 화면 반경 확보
      const slack = 11 / cam.k;
      let hit: SimNode | null = null;
      for (const node of simNodesRef.current.values()) {
        const rr = Math.max(node.r, slack);
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy <= rr * rr) {
          // 나중에 그려지는(위에 보이는) 개념 노드 우선
          if (!hit || node.data.kind === 'concept' || hit.data.kind === 'domain') hit = node;
        }
      }
      return hit;
    };

    /* ---- draw ---- */
    const draw = (now: number) => {
      const { w, h, dpr } = sizeRef.current;
      if (w === 0 || h === 0) return;
      const cam = camRef.current;
      const colors = colorsRef.current;
      const { highlighted: hl, selectedId: sel } = propsRef.current;
      const emphasis = hl.size > 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * (w / 2 - cam.x * cam.k), dpr * (h / 2 - cam.y * cam.k));

      const spawnAlpha = (node: SimNode) =>
        reducedMotionRef.current ? 1 : Math.min(1, (now - node.spawnAt) / SPAWN_FADE_MS);

      /* links */
      for (const link of simLinksRef.current) {
        const src = endpoint(link, 'source');
        const tgt = endpoint(link, 'target');
        if (!src || !tgt) continue;
        const bothHl = hl.has(src.id) && hl.has(tgt.id);
        let alpha = link.kind === 'spoke' ? 0.35 : 0.22;
        if (emphasis) alpha = bothHl ? 0.7 : 0.06;
        ctx.globalAlpha = alpha * Math.min(spawnAlpha(src), spawnAlpha(tgt));
        ctx.strokeStyle = bothHl ? colors.text : colors.link;
        ctx.lineWidth = (bothHl ? 1.8 : 1.1) / cam.k;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      }

      /* nodes — 도메인 먼저, 개념 위에 */
      const domains: SimNode[] = [];
      const concepts: SimNode[] = [];
      for (const node of simNodesRef.current.values()) {
        (node.data.kind === 'domain' ? domains : concepts).push(node);
      }

      for (const node of domains) {
        const fade = spawnAlpha(node);
        const isHover = hoveredRef.current === node.id;
        // 판: 은은한 채움 + 카테고리 색 링 — 펼치면 판이 비워져 "열림"을 표시
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = fade * (node.data.expanded ? 0.06 : 0.16);
        ctx.fill();
        ctx.globalAlpha = fade * (isHover ? 1 : 0.85);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = (isHover ? 2.4 : 1.6) / cam.k;
        ctx.stroke();

        // 라벨 — 화면 고정 크기
        ctx.globalAlpha = fade;
        ctx.fillStyle = colors.text;
        ctx.font = `600 ${13 / cam.k}px ${'Pretendard, -apple-system, system-ui, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.data.label, node.x, node.y);
        // 서브라벨(개수 + 상위 개념) — 접힌 상태에서만: 안에 뭐가 있는지 미리 보여준다
        if (!node.data.expanded && node.data.sub && cam.k > 0.55) {
          ctx.fillStyle = colors.muted;
          ctx.font = `400 ${10 / cam.k}px ${'Pretendard, -apple-system, system-ui, sans-serif'}`;
          let sub = node.data.sub;
          if (sub.length > 34) sub = `${sub.slice(0, 33)}…`;
          ctx.fillText(sub, node.x, node.y + node.r + 14 / cam.k);
        }
      }

      for (const node of concepts) {
        const fade = spawnAlpha(node);
        const isHl = hl.has(node.id);
        const isSel = sel === node.id;
        const isHover = hoveredRef.current === node.id;
        const dimmedOut = emphasis && !isHl && !isHover && !isSel;

        ctx.globalAlpha = fade * (dimmedOut ? 0.15 : 0.95);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.data.color ?? colors.accent;
        ctx.fill();

        if (isSel || isHl || isHover) {
          ctx.globalAlpha = fade;
          ctx.strokeStyle = isSel ? colors.accent : colors.text;
          ctx.lineWidth = (isSel ? 2.6 : 1.6) / cam.k;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r + 2.5 / cam.k, 0, Math.PI * 2);
          ctx.stroke();
        }

        const showLabel = isHover || isHl || isSel || cam.k * node.r > 6.5;
        if (showLabel && !dimmedOut) {
          ctx.globalAlpha = fade * (isHl || isSel || isHover ? 1 : 0.8);
          ctx.fillStyle = isHl || isSel ? colors.text : colors.muted;
          ctx.font = `500 ${11 / cam.k}px ${'Pretendard, -apple-system, system-ui, sans-serif'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          let label = node.data.label;
          if (label.length > 22) label = `${label.slice(0, 21)}…`;
          ctx.fillText(label, node.x, node.y + node.r + 4 / cam.k);
        }
      }
      ctx.globalAlpha = 1;
    };

    /* ---- rAF 루프 — 할 일 없으면 완전히 멈춘다 ---- */
    const frame = (now: number) => {
      rafRef.current = null;
      let active = false;
      const sim = simRef.current;
      if (sim && sim.alpha() > ALPHA_MIN) {
        sim.tick();
        active = true;
      }
      if (!reducedMotionRef.current) {
        for (const node of simNodesRef.current.values()) {
          if (now - node.spawnAt < SPAWN_FADE_MS) {
            active = true;
            break;
          }
        }
      }
      const follow = followRef.current;
      if (follow) {
        const node = simNodesRef.current.get(follow.nodeId);
        if (!node) {
          followRef.current = null;
        } else {
          const cam = camRef.current;
          const ease = easeAmount(reducedMotionRef.current);
          cam.x += (node.x - cam.x) * ease;
          cam.y += (node.y - cam.y) * ease;
          cam.k += (follow.toK - cam.k) * ease;
          const settled =
            Math.abs(node.x - cam.x) < 0.5 && Math.abs(node.y - cam.y) < 0.5 && Math.abs(follow.toK - cam.k) < 0.004;
          if (settled) {
            followRef.current = null;
          } else {
            active = true;
          }
        }
      }
      const gesture = gestureRef.current;
      if (gesture && (gesture.node || gesture.pinchDist !== null)) active = true;

      draw(now);
      if (active) {
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    const wake = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    // graph/focus 이펙트가 쓸 수 있게 노출
    wakeRef.current = wake;

    /* ---- 입력 ---- */
    const onPointerDown = (e: PointerEvent) => {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // 이미 해제된 포인터 등 — 캡처 실패해도 제스처 추적은 계속한다
      }
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      pointersRef.current.set(e.pointerId, { x: sx, y: sy });

      if (pointersRef.current.size === 2) {
        const [p1, p2] = [...pointersRef.current.values()];
        gestureRef.current = {
          downX: sx,
          downY: sy,
          moved: true, // 핀치는 탭이 아니다
          node: null,
          pinchDist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        };
        followRef.current = null;
        wake();
        return;
      }

      const node = hitTest(sx, sy);
      gestureRef.current = { downX: sx, downY: sy, moved: false, node, pinchDist: null };
      if (node) {
        node.fx = node.x;
        node.fy = node.y;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const gesture = gestureRef.current;
      const cam = camRef.current;

      if (!gesture || !pointersRef.current.has(e.pointerId)) {
        // 호버 (fine pointer)
        if (e.pointerType === 'mouse') {
          const hit = hitTest(sx, sy);
          const nextId = hit?.id ?? null;
          if (nextId !== hoveredRef.current) {
            hoveredRef.current = nextId;
            canvas.style.cursor = hit ? 'pointer' : 'grab';
            wake();
          }
        }
        return;
      }

      const prev = pointersRef.current.get(e.pointerId)!;
      pointersRef.current.set(e.pointerId, { x: sx, y: sy });

      if (gesture.pinchDist !== null && pointersRef.current.size >= 2) {
        const [p1, p2] = [...pointersRef.current.values()];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (gesture.pinchDist > 0) {
          const ratio = dist / gesture.pinchDist;
          cam.k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.k * ratio));
        }
        gesture.pinchDist = dist;
        wake();
        return;
      }

      const dx = sx - prev.x;
      const dy = sy - prev.y;
      if (Math.abs(sx - gesture.downX) + Math.abs(sy - gesture.downY) > 5) gesture.moved = true;

      if (gesture.node) {
        const { x, y } = toWorld(sx, sy);
        gesture.node.fx = x;
        gesture.node.fy = y;
        const sim = simRef.current;
        if (sim && sim.alpha() < 0.25) sim.alpha(0.25);
        wake();
        return;
      }

      if (gesture.moved) {
        cam.x -= dx / cam.k;
        cam.y -= dy / cam.k;
        followRef.current = null;
        wake();
      }
    };

    const endGesture = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (pointersRef.current.size > 0) return; // 핀치 손가락 하나 남음
      gestureRef.current = null;

      if (gesture.node) {
        gesture.node.fx = null;
        gesture.node.fy = null;
      }
      if (!gesture.moved && e.type !== 'pointercancel') {
        const { onNodeClick: click, onBackgroundClick: background } = propsRef.current;
        if (gesture.node) {
          click(gesture.node.data);
        } else {
          background();
        }
      }
      wake();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camRef.current;
      const before = toWorld(sx, sy);
      cam.k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.k * Math.exp(-e.deltaY * 0.0016)));
      const after = toWorld(sx, sy);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
      followRef.current = null;
      wake();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endGesture);
    canvas.addEventListener('pointercancel', endGesture);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    /* ---- 리사이즈 ---- */
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        const dpr = window.devicePixelRatio || 1;
        sizeRef.current = { w: width, h: height, dpr };
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const cam = camRef.current;
        if (!cam.fitted) {
          // 루트 링이 한눈에 들어오게 초기 fit
          cam.k = Math.min(1.3, Math.max(0.45, Math.min(width, height) / ((RING_RADIUS + 90) * 2)));
          cam.fitted = true;
        }
        wake();
      }
    });
    ro.observe(wrap);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endGesture);
      canvas.removeEventListener('pointercancel', endGesture);
      canvas.removeEventListener('wheel', onWheel);
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      simRef.current?.stop();
      simRef.current = null;
      wakeRef.current = null;
    };
  }, []);

  /* ---- visible 그래프 변경 — 노드 diff + 시뮬레이션 재점화 ---- */
  useEffect(() => {
    const sim = simRef.current;
    const linkForce = linkForceRef.current;
    if (!sim || !linkForce) return;

    const prev = simNodesRef.current;
    const now = performance.now();
    const domainOrder = graph.nodes.filter((n) => n.kind === 'domain');

    const anchorOf = (node: VisibleNode): { x: number; y: number } => {
      const idx = domainOrder.findIndex((d) => d.id === node.id);
      if (idx < 0) return { x: 0, y: 0 };
      const angle = (idx / Math.max(1, domainOrder.length)) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(angle) * RING_RADIUS, y: Math.sin(angle) * RING_RADIUS };
    };

    // 새 개념은 이미 보이던 링크 상대(클릭한 노드/소속 도메인) 옆에서 스폰 →
    // 펼침이 그 자리에서 일어나는 마인드맵 확장감
    const seedFor = (node: VisibleNode): { x: number; y: number } => {
      for (const link of graph.links) {
        const other = link.source === node.id ? link.target : link.target === node.id ? link.source : null;
        if (!other) continue;
        const existing = prev.get(other);
        if (existing) {
          const jitter = Math.random() * Math.PI * 2;
          return { x: existing.x + Math.cos(jitter) * 24, y: existing.y + Math.sin(jitter) * 24 };
        }
      }
      const domain = node.domainNodeId ? prev.get(node.domainNodeId) : null;
      if (domain) return { x: domain.x + 20, y: domain.y + 20 };
      return anchorOf(node);
    };

    const next = new Map<string, SimNode>();
    let structureChanged = false;
    for (const visible of graph.nodes) {
      const existing = prev.get(visible.id);
      if (existing) {
        existing.data = visible;
        existing.r = radiusOf(visible);
        if (visible.kind === 'domain') {
          const anchor = anchorOf(visible);
          existing.anchorX = anchor.x;
          existing.anchorY = anchor.y;
        }
        next.set(visible.id, existing);
        continue;
      }
      structureChanged = true;
      const seed = visible.kind === 'domain' ? anchorOf(visible) : seedFor(visible);
      const anchor = visible.kind === 'domain' ? seed : { x: 0, y: 0 };
      next.set(visible.id, {
        id: visible.id,
        data: visible,
        r: radiusOf(visible),
        x: seed.x,
        y: seed.y,
        vx: 0,
        vy: 0,
        anchorX: anchor.x,
        anchorY: anchor.y,
        hasAnchor: visible.kind === 'domain',
        spawnAt: now,
      });
    }
    if (next.size !== prev.size) structureChanged = true;

    simNodesRef.current = next;
    const nodeList = [...next.values()];
    const linkList: SimLink[] = graph.links.map((l) => ({ ...l }));
    simLinksRef.current = linkList;
    sim.nodes(nodeList);
    linkForce.links(linkList);
    if (structureChanged) {
      sim.alpha(0.7);
    }
    wakeRef.current?.();
  }, [graph]);

  /* ---- 강조/선택 변경 — 한 프레임 다시 그림 ---- */
  useEffect(() => {
    wakeRef.current?.();
  }, [highlighted, selectedId]);

  /* ---- 포커스 — 카메라 추적 시작 ---- */
  useEffect(() => {
    if (!focus) return;
    const node = simNodesRef.current.get(focus.id);
    if (!node) return;
    followRef.current = {
      nodeId: focus.id,
      toK: node.data.kind === 'domain' ? Math.max(camRef.current.k, 0.9) : Math.max(camRef.current.k, 1.2),
    };
    wakeRef.current?.();
  }, [focus]);

  return (
    <div ref={wrapRef} className="domain-map">
      <canvas
        ref={canvasRef}
        className="domain-map-canvas"
        role="application"
        aria-label="만들어본 업무 도메인 맵 — 도메인을 누르면 핵심 개념이, 개념을 누르면 연관 개념이 펼쳐집니다"
      />
    </div>
  );
}
