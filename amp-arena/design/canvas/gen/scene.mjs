// 콜로세움 원근 장면 — 인게임 목업과 맵 썸네일이 같이 쓴다.
// 월드 좌표: 아레나 중심 (0,0), 카메라는 z = camZ 에서 +z 를 본다. y 는 높이(m).
import { T, r2 } from './tokens.mjs';
import { figure } from './figure.mjs';

export function makeCamera({ W = 1280, H = 720, horizon = 250, f = 820, camH = 5, camZ = -24 } = {}) {
  const project = (x, z, y = 0) => {
    const d = z - camZ;
    const k = f / d;
    return { sx: W / 2 + k * x, sy: horizon + k * (camH - y), k, d };
  };
  return { W, H, horizon, f, camH, camZ, project };
}

const pt = (p) => `${r2(p.sx)} ${r2(p.sy)}`;

/** 원 위의 점을 각도 범위로 샘플해 화면 폴리라인으로. */
function ring(cam, R, y, from, to, step, cx = 0, cz = 0) {
  const pts = [];
  for (let a = from; a <= to + 1e-6; a += step) {
    const rad = (a * Math.PI) / 180;
    const x = cx + R * Math.cos(rad), z = cz + R * Math.sin(rad);
    const p = cam.project(x, z, y);
    if (p.d > 2.5) pts.push(p);
  }
  return pts;
}

function crate(cam, x, z, size = 1) {
  const p = cam.project(x, z);
  const s = p.k * size;
  const top = r2(p.sy - s);
  const depth = s * 0.45;
  return (
    `<g>` +
    `<ellipse cx="${r2(p.sx)}" cy="${r2(p.sy + 2)}" rx="${r2(s * 0.7)}" ry="${r2(s * 0.18)}" style="fill:rgba(0,0,0,0.28)"></ellipse>` +
    `<path d="M ${r2(p.sx - s / 2)} ${top} L ${r2(p.sx - s / 2 + depth * 0.5)} ${r2(top - depth * 0.5)} L ${r2(p.sx + s / 2 + depth * 0.5)} ${r2(top - depth * 0.5)} L ${r2(p.sx + s / 2)} ${top} Z" style="fill:${T.wood};stroke:${T.outline};stroke-width:2px;stroke-linejoin:round"></path>` +
    `<rect x="${r2(p.sx - s / 2)}" y="${top}" width="${r2(s)}" height="${r2(s)}" style="fill:${T.woodDark};stroke:${T.outline};stroke-width:2px"></rect>` +
    `<path d="M ${r2(p.sx - s / 2)} ${top} L ${r2(p.sx + s / 2)} ${r2(top + s)} M ${r2(p.sx + s / 2)} ${top} L ${r2(p.sx - s / 2)} ${r2(top + s)}" style="stroke:${T.wood};stroke-width:${r2(Math.max(2, s * 0.12))}px"></path>` +
    `</g>`
  );
}

function pillar(cam, x, z, radius = 0.8, height = 6) {
  const base = cam.project(x, z);
  const w = base.k * radius * 2;
  const top = cam.project(x, z, height);
  const capH = base.k * 0.5;
  return (
    `<g>` +
    `<ellipse cx="${r2(base.sx)}" cy="${r2(base.sy)}" rx="${r2(w * 0.9)}" ry="${r2(w * 0.22)}" style="fill:rgba(0,0,0,0.25)"></ellipse>` +
    `<rect x="${r2(base.sx - w / 2)}" y="${r2(top.sy)}" width="${r2(w)}" height="${r2(base.sy - top.sy)}" style="fill:#b3aa9c;stroke:${T.outline};stroke-width:2px"></rect>` +
    `<rect x="${r2(base.sx - w / 2)}" y="${r2(top.sy)}" width="${r2(w * 0.28)}" height="${r2(base.sy - top.sy)}" style="fill:#d8cfbf"></rect>` +
    `<rect x="${r2(base.sx - w * 0.65)}" y="${r2(top.sy - capH)}" width="${r2(w * 1.3)}" height="${r2(capH)}" style="fill:#cfc6b6;stroke:${T.outline};stroke-width:2px"></rect>` +
    `<rect x="${r2(base.sx - w * 0.65)}" y="${r2(base.sy - capH)}" width="${r2(w * 1.3)}" height="${r2(capH)}" style="fill:#cfc6b6;stroke:${T.outline};stroke-width:2px"></rect>` +
    `</g>`
  );
}

function platform(cam, x, z, w, dpt, h) {
  const a = cam.project(x - w / 2, z - dpt / 2, 0), b = cam.project(x + w / 2, z - dpt / 2, 0);
  const at = cam.project(x - w / 2, z - dpt / 2, h), bt = cam.project(x + w / 2, z - dpt / 2, h);
  const ct = cam.project(x + w / 2, z + dpt / 2, h), dt = cam.project(x - w / 2, z + dpt / 2, h);
  return (
    `<path d="M ${pt(a)} L ${pt(b)} L ${pt(bt)} L ${pt(at)} Z" style="fill:#9c9384;stroke:${T.outline};stroke-width:2px;stroke-linejoin:round"></path>` +
    `<path d="M ${pt(at)} L ${pt(bt)} L ${pt(ct)} L ${pt(dt)} Z" style="fill:#c9bfae;stroke:${T.outline};stroke-width:2px;stroke-linejoin:round"></path>`
  );
}

function heart(cam, x, z) {
  const p = cam.project(x, z, 0.5);
  const s = p.k * 0.5;
  return (
    `<ellipse cx="${r2(p.sx)}" cy="${r2(cam.project(x, z).sy)}" rx="${r2(s * 0.8)}" ry="${r2(s * 0.2)}" style="fill:rgba(0,0,0,0.25)"></ellipse>` +
    `<path transform="translate(${r2(p.sx)} ${r2(p.sy)}) scale(${r2(s / 12)})" d="M 0 10 L -10 0 A 5 5 0 0 1 0 -5 A 5 5 0 0 1 10 0 Z" style="fill:${T.red};stroke:${T.outline};stroke-width:${r2(24 / Math.max(s, 6))}px;stroke-linejoin:round"></path>`
  );
}

function spark(sx, sy, s) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.3;
    const r1 = s * 0.45, r2v = s * (i % 2 ? 0.8 : 1.1);
    rays.push(`M ${r2(sx + Math.cos(a) * r1)} ${r2(sy + Math.sin(a) * r1)} L ${r2(sx + Math.cos(a) * r2v)} ${r2(sy + Math.sin(a) * r2v)}`);
  }
  const star = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? s * 0.22 : s * 0.5;
    star.push(`${i ? 'L' : 'M'} ${r2(sx + Math.cos(a) * r)} ${r2(sy + Math.sin(a) * r)}`);
  }
  return (
    `<path d="${rays.join(' ')}" style="stroke:${T.amp};stroke-width:4px;stroke-linecap:round"></path>` +
    `<path d="${star.join(' ')} Z" style="fill:#ffffff;stroke:${T.amp2};stroke-width:3px;stroke-linejoin:round"></path>`
  );
}

/**
 * 콜로세움 장면 SVG. chars: [{x,z,y,pose,facing,shirt,acc,name,hp,team,me}] 는 월드 좌표.
 * 반환: { svg, plates: [{sx, sy, name, hp, team, me}] } — 명찰은 DOM 으로 얹는다.
 */
export function colosseumScene({ cam = makeCamera(), chars = [], crates = [], hearts = [], hit = null, showGrid = true } = {}) {
  const { W, H } = cam;
  const out = [];
  // 하늘
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" style="fill:#0f1631"></rect>`);
  out.push(`<rect x="0" y="0" width="${W}" height="${cam.horizon + 60}" style="fill:#182252"></rect>`);
  out.push(`<rect x="0" y="${cam.horizon - 40}" width="${W}" height="100" style="fill:#1f2b66"></rect>`);
  // 관중석 띠 (벽 뒤, 더 높게)
  const standsTop = ring(cam, 23, 7.5, -12, 192, 4);
  const standsBase = ring(cam, 20.6, 3, -12, 192, 4);
  out.push(`<path d="M ${standsBase.map(pt).join(' L ')} L ${standsTop.slice().reverse().map(pt).join(' L ')} Z" style="fill:#2b2f52;stroke:${T.outline};stroke-width:2px"></path>`);
  // 관중석 줄
  for (const [rr, yy] of [[21.4, 4.5], [22.2, 6]]) {
    const line = ring(cam, rr, yy, -12, 192, 4);
    out.push(`<path d="M ${line.map(pt).join(' L ')}" style="fill:none;stroke:#3a3f6b;stroke-width:2px"></path>`);
  }
  // 외벽
  const wallBase = ring(cam, 20, 0, -12, 192, 3);
  const wallTop = ring(cam, 20, 3, -12, 192, 3);
  out.push(`<path d="M ${wallBase.map(pt).join(' L ')} L ${wallTop.slice().reverse().map(pt).join(' L ')} Z" style="fill:#8f8778;stroke:${T.outline};stroke-width:2px;stroke-linejoin:round"></path>`);
  const wallMid = ring(cam, 20, 2.4, -12, 192, 3);
  out.push(`<path d="M ${wallMid.map(pt).join(' L ')}" style="fill:none;stroke:#a89f8f;stroke-width:3px"></path>`);
  // 총안(요철)
  for (let a = -9; a <= 189; a += 9) {
    const seg1 = ring(cam, 20, 3, a, a + 4.5, 1.5), seg2 = ring(cam, 20, 3.7, a, a + 4.5, 1.5);
    if (seg1.length > 1 && seg2.length > 1) {
      out.push(`<path d="M ${seg1.map(pt).join(' L ')} L ${seg2.slice().reverse().map(pt).join(' L ')} Z" style="fill:#a29a8a;stroke:${T.outline};stroke-width:1.5px;stroke-linejoin:round"></path>`);
    }
  }
  // 바닥
  const floorEdge = ring(cam, 20, 0, -12, 192, 3);
  out.push(`<path d="M ${floorEdge.map(pt).join(' L ')} L ${W + 400} ${H + 200} L -400 ${H + 200} Z" style="fill:#d2b98b"></path>`);
  if (showGrid) {
    for (const R of [5, 10, 15]) {
      const c = ring(cam, R, 0, -30, 210, 3);
      out.push(`<path d="M ${c.map(pt).join(' L ')}" style="fill:none;stroke:rgba(60,40,20,0.22);stroke-width:2px"></path>`);
    }
    for (let a = 0; a < 180; a += 22.5) {
      const rad = (a * Math.PI) / 180;
      const p1 = cam.project(20 * Math.cos(rad), 20 * Math.sin(rad));
      const p2 = cam.project(-20 * Math.cos(rad), -20 * Math.sin(rad));
      if (p1.d > 2.5 && p2.d > 2.5) out.push(`<line x1="${r2(p1.sx)}" y1="${r2(p1.sy)}" x2="${r2(p2.sx)}" y2="${r2(p2.sy)}" style="stroke:rgba(60,40,20,0.16);stroke-width:2px"></line>`);
    }
    const center = ring(cam, 2, 0, -30, 210, 6);
    out.push(`<path d="M ${center.map(pt).join(' L ')} Z" style="fill:none;stroke:${T.amp2};stroke-width:3px;opacity:0.7"></path>`);
  }
  // 바닥 물체·캐릭터를 깊이순 정렬
  const items = [];
  items.push({ d: cam.project(0, 12).d, svg: platform(cam, 0, 12, 4, 4, 1.5) });
  for (const [x, z] of [[-8.5, 8.5], [8.5, 8.5], [-8.5, -8.5], [8.5, -8.5]]) items.push({ d: cam.project(x, z).d, svg: pillar(cam, x, z) });
  for (const c of crates) items.push({ d: cam.project(c.x, c.z).d, svg: crate(cam, c.x, c.z, c.size ?? 1) });
  for (const h of hearts) items.push({ d: cam.project(h.x, h.z).d, svg: heart(cam, h.x, h.z) });
  const plates = [];
  for (const c of chars) {
    const p = cam.project(c.x, c.z, 0);
    const lift = (c.y ?? 0) * p.k;
    const s = (1.6 * p.k) / 120;
    items.push({ d: p.d, svg: figure({ x: p.sx, y: p.sy - lift, s, facing: c.facing ?? 1, pose: c.pose ?? 'idle', shirt: c.shirt, acc: c.acc ?? null, alpha: c.alpha ?? 1 }) });
    plates.push({ sx: p.sx, sy: p.sy - lift - 1.9 * p.k, name: c.name, hp: c.hp ?? 100, team: c.team ?? null, me: !!c.me, k: p.k });
  }
  items.sort((a, b) => b.d - a.d);
  for (const it of items) out.push(it.svg);
  if (hit) {
    const p = cam.project(hit.x, hit.z, hit.y ?? 1);
    out.push(spark(p.sx, p.sy, p.k * 0.9));
  }
  return { svg: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block" xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`, plates };
}
