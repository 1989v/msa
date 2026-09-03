import { useEffect, useRef, useState } from 'react';
import { useHeritageTheme } from '../../hooks/useHeritageSurface';
import './SystemCore.css';

/**
 * 시스템 코어 — 히어로의 판 위에 운영 토폴로지를 그린다 (2D 캔버스, 의존성 0).
 *
 * 비어 있던 `< / system_core >` 판을 진짜로 만든다: 요청이 portal-fe → gateway → 서비스로
 * 흐르고, 이벤트가 kafka 를 지나 clickhouse·opensearch 로 간다. 포인터를 올리면 그 노드의
 * 경로가 밝아지고, 누르면 요청이 몇 개 더 들어온다.
 *
 * 배터리 계약은 먹 캔버스와 같다 — 깨운 뒤 12초가 지나면 rAF 를 완전히 멈춘다. 포인터·스크롤·
 * 재진입이 다시 깨운다. reduced-motion 이면 정지 화면 한 장이다.
 *
 * 색은 판(.kh-slab)의 토큰에서 읽는다. 캔버스는 CSS 변수를 직접 못 읽으므로 테마가 바뀌면
 * 다시 읽는다 — 안 그러면 옛 팔레트가 남는다.
 */

interface Node {
  id: string;
  label: string;
  fx: number;
  fy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  flash: number;
}

const NODES: Array<[string, string, number, number]> = [
  ['fe', 'portal-fe', 0.09, 0.5],
  ['gw', 'gateway', 0.28, 0.5],
  ['place', 'place', 0.5, 0.11],
  ['game', 'game', 0.5, 0.265],
  ['blog', 'blog', 0.5, 0.42],
  ['deal', 'deal', 0.5, 0.575],
  ['rank', 'rank', 0.5, 0.73],
  ['commerce', 'commerce', 0.5, 0.885],
  ['kafka', 'kafka', 0.72, 0.5],
  ['search', 'opensearch', 0.905, 0.3],
  ['ch', 'clickhouse', 0.905, 0.7],
];
const EDGES: Array<[string, string]> = [
  ['fe', 'gw'], ['gw', 'place'], ['gw', 'game'], ['gw', 'blog'], ['gw', 'deal'], ['gw', 'rank'], ['gw', 'commerce'],
  ['game', 'kafka'], ['blog', 'kafka'], ['deal', 'kafka'], ['commerce', 'kafka'],
  ['kafka', 'ch'], ['kafka', 'search'], ['place', 'search'],
];
const ROUTES: string[][] = [
  ['fe', 'gw', 'place', 'search'], ['fe', 'gw', 'game', 'kafka', 'ch'], ['fe', 'gw', 'blog', 'kafka', 'ch'],
  ['fe', 'gw', 'deal', 'kafka', 'ch'], ['fe', 'gw', 'rank'], ['fe', 'gw', 'commerce', 'kafka', 'search'],
  ['fe', 'gw', 'commerce', 'kafka', 'ch'], ['fe', 'gw', 'game'], ['fe', 'gw', 'blog'],
];
const AWAKE_MS = 12_000;
const MAX_PACKETS = 9;

interface Packet { route: string[]; i: number; t: number; x: number; y: number; v: number; trail: Array<[number, number]> }
interface Stamp { x: number; y: number; life: number }

export default function SystemCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theme] = useHeritageTheme();
  // reduced-motion 이면 포인터 안내가 의미 없다 — 처음부터 숨긴다
  const [hintHidden, setHintHidden] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const node = Object.fromEntries(
      NODES.map(([id, label, fx, fy]) => [id, { id, label, fx, fy, x: 0, y: 0, w: 0, h: 20, flash: 0 } as Node]),
    ) as Record<string, Node>;
    const packets: Packet[] = [];
    const stamps: Stamp[] = [];
    let W = 0;
    let H = 0;
    let hover: string | null = null;
    let col = { ocher: '', on: '', slab: '', yeonji: '' };
    let awakeUntil = 0;
    let running = false;
    let inView = true;
    let visible = !document.hidden;
    let last = 0;
    let spawnAt = 0;
    let raf = 0;

    const readColors = () => {
      const cs = getComputedStyle(host);
      const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
      col = {
        ocher: read('--kh-ocher', '#b38b6d'),
        on: read('--kh-on-slab', '#f9f8f2'),
        slab: read('--kh-slab', '#1d1d1f'),
        yeonji: read('--kh-yeonji', '#a2231d'),
      };
    };
    const font = () => `500 ${W < 480 ? 9 : 10.5}px ${getComputedStyle(host).getPropertyValue('--kh-font-mono') || 'ui-monospace, monospace'}`;
    const size = () => {
      const r = host.getBoundingClientRect();
      if (r.width === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = font();
      const small = W < 480;
      for (const n of Object.values(node)) {
        n.x = n.fx * W;
        n.y = n.fy * (H - 30) + 4;
        n.w = ctx.measureText(n.label).width + (small ? 10 : 14);
        n.h = small ? 18 : 20;
      }
    };
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (const [a, b] of EDGES) {
        const A = node[a];
        const B = node[b];
        const hi = hover !== null && (a === hover || b === hover);
        ctx.strokeStyle = hi ? col.ocher : 'rgba(179,139,109,.28)';
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      for (const p of packets) {
        p.trail.forEach(([tx, ty], i) => {
          const a = (i + 1) / p.trail.length;
          ctx.fillStyle = col.on;
          ctx.globalAlpha = a * 0.32;
          ctx.beginPath();
          ctx.arc(tx, ty, 1.6 + a * 1.4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = col.on;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // 도착 지점에 연지 점이 찍히고 마른다 — 붉은 것은 이것뿐이다
      for (const s of stamps) {
        ctx.globalAlpha = s.life;
        ctx.fillStyle = col.yeonji;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3 + (1 - s.life) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = font();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (const n of Object.values(node)) {
        const x = n.x - n.w / 2;
        const y = n.y - n.h / 2;
        const hi = hover === n.id;
        rr(x, y, n.w, n.h, 3);
        ctx.fillStyle = n.flash > 0 ? `rgba(179,139,109,${(0.15 + n.flash * 0.85).toFixed(3)})` : col.slab;
        ctx.fill();
        ctx.strokeStyle = hi ? col.on : n.flash > 0 ? col.ocher : 'rgba(179,139,109,.6)';
        ctx.stroke();
        ctx.fillStyle = hi ? col.on : n.flash > 0.5 ? col.slab : col.on;
        ctx.fillText(n.label, n.x, n.y + 0.5);
      }
    };

    const seg = (p: Packet): [Node, Node, number] => {
      const a = node[p.route[p.i]];
      const b = node[p.route[p.i + 1]];
      return [a, b, Math.hypot(b.x - a.x, b.y - a.y)];
    };
    const spawn = () => {
      if (packets.length >= MAX_PACKETS) return;
      let route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
      if (hover && hover !== 'fe' && hover !== 'gw') {
        const pref = ROUTES.filter((r) => r.includes(hover!));
        if (pref.length) route = pref[Math.floor(Math.random() * pref.length)];
      }
      packets.push({ route, i: 0, t: 0, x: node.fe.x, y: node.fe.y, v: 110 + Math.random() * 70, trail: [] });
    };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (now > spawnAt) {
        spawn();
        spawnAt = now + 420 + Math.random() * 520;
      }
      for (let k = packets.length - 1; k >= 0; k -= 1) {
        const p = packets[k];
        const [, b, len] = seg(p);
        p.t += (p.v * dt) / Math.max(1, len);
        if (p.t >= 1) {
          p.i += 1;
          b.flash = 1;
          p.t = 0;
          if (p.i >= p.route.length - 1) {
            stamps.push({ x: b.x + b.w / 2 + 6, y: b.y - b.h / 2 - 2, life: 1 });
            packets.splice(k, 1);
            continue;
          }
        }
        const [a2, b2] = seg(p);
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 7) p.trail.shift();
        p.x = a2.x + (b2.x - a2.x) * p.t;
        p.y = a2.y + (b2.y - a2.y) * p.t;
      }
      for (const n of Object.values(node)) n.flash = Math.max(0, n.flash - dt * 2.2);
      for (let k = stamps.length - 1; k >= 0; k -= 1) {
        stamps[k].life -= dt * 0.9;
        if (stamps[k].life <= 0) stamps.splice(k, 1);
      }
      draw();
      if (now < awakeUntil && inView && visible) raf = requestAnimationFrame(step);
      else running = false;
    };
    const wake = (ms = AWAKE_MS) => {
      awakeUntil = Math.max(awakeUntil, performance.now() + ms);
      if (!running && inView && visible) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    readColors();
    size();
    if (reduced) {
      // 정지 화면 한 장 — 경로 위에 요청 몇 개를 고정해 둔다
      const fixed: Array<[string, string, number]> = [['fe', 'gw', 0.5], ['gw', 'game', 0.4], ['gw', 'commerce', 0.7], ['kafka', 'ch', 0.35]];
      for (const [a, b, t] of fixed) {
        const A = node[a];
        const B = node[b];
        packets.push({ route: [a, b], i: 0, t, x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, v: 0, trail: [] });
      }
      draw();
      return;
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      let best: string | null = null;
      let bd = 34;
      for (const n of Object.values(node)) {
        const d = Math.hypot(n.x - mx, n.y - my);
        if (d < bd) {
          bd = d;
          best = n.id;
        }
      }
      if (best !== hover) {
        hover = best;
        if (best) setHintHidden(true);
      }
      wake();
    };
    const onLeave = () => {
      hover = null;
      if (!running) draw();
    };
    const onDown = () => {
      spawn();
      spawn();
      wake();
    };
    const onScroll = () => wake(4000);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) wake();
    };
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    const io = new IntersectionObserver((entries) => {
      inView = entries.some((en) => en.isIntersecting);
      if (inView) wake();
    });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      size();
      if (!running) draw();
    });
    ro.observe(host);
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        size();
        if (!running) draw();
      });
    }
    wake(14_000);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
      ro.disconnect();
    };
    // theme 이 바뀌면 통째로 다시 만든다 — 색을 다시 읽고 정지 화면도 새 정경으로 그린다
  }, [theme]);

  return (
    <div
      className="kh-slab kh-grain home-core"
      role="img"
      aria-label="운영 중인 서비스 토폴로지 — 요청이 게이트웨이를 지나 서비스와 카프카로 흐른다"
    >
      <canvas ref={canvasRef} className="home-core-canvas" />
      {!hintHidden && <span className="kh-mono home-core-hint">노드에 포인터를 올리거나 탭해 보세요</span>}
      <div className="kh-mono home-core-cap">
        <span>&lt; / system_core &gt;</span>
        <span>
          <i aria-hidden="true" />
          event · 19 services · 1 node · free tier
        </span>
      </div>
    </div>
  );
}
