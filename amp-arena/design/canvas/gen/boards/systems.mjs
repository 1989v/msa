// 맵 2 · 조작/상태 머신 · 네트워크 · 로드맵
import { T, doc, r2 } from '../tokens.mjs';
import { figure, svgWrap } from '../figure.mjs';
import { icon, panel, chip, row, col, p, table, label, sheetHeader, key } from '../ui.mjs';
import { makeCamera, colosseumScene } from '../scene.mjs';

const sheet = (w, h, inner) => `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${T.bg};color:${T.ink};padding:28px;display:flex;flex-direction:column;gap:20px">${inner}</div>`;
const txt = (x, y, t, { size = 12, color = T.ink, weight = 700, anchor = 'middle' } = {}) =>
  `<text x="${r2(x)}" y="${r2(y)}" text-anchor="${anchor}" style="font:${weight} ${size}px 'Gothic A1',sans-serif;fill:${color}">${t}</text>`;

/** 드럼통(터지는 오브젝트)·점프대 평면 기호 */
const BARREL = (cx, cy, r) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" style="fill:#b8402e;stroke:${T.outline};stroke-width:2px"></circle><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r * 0.42)}" style="fill:${T.amp}"></circle>`;
const PAD = (cx, cy, r) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" style="fill:${T.amp};stroke:${T.outline};stroke-width:2px"></circle><path d="M ${r2(cx - r * 0.45)} ${r2(cy + r * 0.3)} L ${r2(cx)} ${r2(cy - r * 0.42)} L ${r2(cx + r * 0.45)} ${r2(cy + r * 0.3)} Z" style="fill:${T.outline}"></path>`;
/** 들어갈 수 있는 방: 회색 상자 + 문(주황 띠). rect 는 (x0..x1, z0..z1), door 는 문 중심 좌표와 방향('x' 세로 띠 / 'z' 가로 띠) */
const ROOM = (w2s, sc, x0, x1, z0, z1, door, name) => {
  const [px, py] = w2s(x0, z1);
  const [dx, dy] = w2s(door.x, door.z);
  const strip = door.dir === 'x' ? `<rect x="${r2(dx - 3)}" y="${r2(dy - 0.9 * sc)}" width="6" height="${r2(1.8 * sc)}" style="fill:${T.amp}"></rect>` : `<rect x="${r2(dx - 0.9 * sc)}" y="${r2(dy - 3)}" width="${r2(1.8 * sc)}" height="6" style="fill:${T.amp}"></rect>`;
  return `<rect x="${r2(px)}" y="${r2(py)}" width="${r2((x1 - x0) * sc)}" height="${r2((z1 - z0) * sc)}" style="fill:#6d7390;stroke:${T.outline};stroke-width:3px;opacity:0.92"></rect>${strip}${txt(px + (x1 - x0) * sc / 2, py + (z1 - z0) * sc + 13, name, { size: 10, color: T.ink })}`;
};

const SPAWN = (cx, cy, s, i, team) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${s}" style="fill:${team === 'red' ? T.red : team === 'blue' ? T.blue : T.amp};stroke:${T.outline};stroke-width:2px"></circle>${txt(cx, cy + 4, String(i), { size: 11, color: T.ink })}`;

export function mapColosseumBoard() {
  const W = 1200, H = 820; // 규칙 표가 9행이라 760 은 잘린다
  const sc = 12, C = 270; // 12px / m, 중심
  const w2s = (x, z) => [C + x * sc, C - z * sc];
  const plan = [];
  plan.push(`<circle cx="${C}" cy="${C}" r="${20 * sc}" style="fill:#d2b98b;stroke:${T.outline};stroke-width:4px"></circle>`);
  plan.push(`<circle cx="${C}" cy="${C}" r="${20 * sc + 8}" style="fill:none;stroke:#8f8778;stroke-width:8px"></circle>`);
  for (const R of [5, 10, 15]) plan.push(`<circle cx="${C}" cy="${C}" r="${R * sc}" style="fill:none;stroke:rgba(60,40,20,0.22);stroke-width:1.5px"></circle>`);
  for (const [x, z] of [[-8.5, 8.5], [8.5, 8.5], [-8.5, -8.5], [8.5, -8.5]]) { const [px, py] = w2s(x, z); plan.push(`<circle cx="${r2(px)}" cy="${r2(py)}" r="${0.8 * sc}" style="fill:#b3aa9c;stroke:${T.outline};stroke-width:2px"></circle>`); }
  for (const z of [12, -12]) { const [px, py] = w2s(0, z); plan.push(`<rect x="${r2(px - 2 * sc)}" y="${r2(py - 2 * sc)}" width="${4 * sc}" height="${4 * sc}" style="fill:#c9bfae;stroke:${T.outline};stroke-width:2px"></rect>${txt(px, py + 4, '+1.5m', { size: 10, color: T.outline })}`); }
  for (let i = 0; i < 6; i++) { const a = (i * 60 + 30) * Math.PI / 180; const [px, py] = w2s(9 * Math.cos(a), 9 * Math.sin(a)); plan.push(`<rect x="${r2(px - 6)}" y="${r2(py - 6)}" width="12" height="12" style="fill:${T.woodDark};stroke:${T.outline};stroke-width:2px"></rect>`); }
  for (let i = 0; i < 8; i++) { const a = (i * 45) * Math.PI / 180; const [px, py] = w2s(15 * Math.cos(a), 15 * Math.sin(a)); plan.push(SPAWN(px, py, 10, i + 1, Math.cos(a) > 0.01 ? 'red' : Math.cos(a) < -0.01 ? 'blue' : (i === 2 ? 'red' : 'blue'))); }
  // 동·서 문루 (2026-09-12): 5×5 방, 아레나 쪽 문 1.8m, 안에 드럼통. 점프대 2.
  plan.push(ROOM(w2s, sc, 12.5, 17.5, 3.5, 8.5, { x: 12.5, z: 6, dir: 'x' }, '동 문루'));
  plan.push(ROOM(w2s, sc, -17.5, -12.5, -8.5, -3.5, { x: -12.5, z: -6, dir: 'x' }, '서 문루'));
  for (const [x, z] of [[15, 6], [-15, -6]]) { const [px, py] = w2s(x, z); plan.push(BARREL(px, py, 0.45 * sc)); }
  for (const [x, z] of [[5, 12], [-5, -12]]) { const [px, py] = w2s(x, z); plan.push(PAD(px, py, 0.9 * sc)); }
  // 축척
  plan.push(`<line x1="20" y1="520" x2="${20 + 10 * sc}" y2="520" style="stroke:${T.ink};stroke-width:3px"></line>${txt(20 + 5 * sc, 512, '10m', { size: 11, color: T.ink })}`);
  const planSvg = `<svg viewBox="0 0 540 540" width="540" height="540" style="display:block" xmlns="http://www.w3.org/2000/svg">${plan.join('')}</svg>`;

  const cam = makeCamera();
  const { svg } = colosseumScene({ cam, chars: [], crates: [{ x: -5, z: -7 }, { x: 6, z: 4 }] });
  const thumb = svg.replace('width="1280" height="1280"', '').replace('width="1280" height="720"', 'width="560" height="315"');

  const legend = `<div style="display:flex;flex-direction:row;flex-wrap:wrap;gap:8px">${[
    ['#b3aa9c', '기둥 ×4 (r 0.8m)'], ['#c9bfae', '단상 ×2 (4×4m, +1.5m)'], [T.woodDark, '상자 ×6'], ['#6d7390', '문루 ×2 (5×5m · 2.4m)'], ['#b8402e', '드럼통 ×2'], [T.amp, '점프대 ×2'], [T.red, '레드 스폰'], [T.blue, '블루 스폰'],
  ].map(([c, n]) => `<div style="display:flex;flex-direction:row;align-items:center;gap:6px;font-size:12px"><div style="width:14px;height:14px;border-radius:3px;background:${c};border:2px solid ${T.outline}"></div>${n}</div>`).join('')}</div>`;
  const rules = table(['항목', '값'], [
    ['크기', '원형 지름 40m · 외벽 3m'], ['낙사', '없음 (벽으로 막힘)'], ['기둥', '4개, 반지름 12m 원주 대각'], ['단상', '남북 2개, 높이 1.5m — 점프로 오름'],
    ['상자', '6개, 파괴 30초 뒤 재생성'], ['문루', '동·서 5×5m 방(2.4m), 아레나 쪽 문 1.8m — 안에 드럼통(반경 3m · 25, 연쇄)'], ['점프대', '(5,12)·(−5,−12), 상승 11 m/s'], ['스폰', '반지름 15m 원주 45° 간격 · 팀전은 동서'], ['용도', '기본 맵 · 근접전 · 첫 매치'],
  ], { size: 12, colW: [70] });
  const inner = `
    ${sheetHeader('맵 1 — 콜로세움', '벽이 있어 낙사가 없는 기본 아레나. 기둥과 단상이 시야와 동선을 끊는다.', '맵')}
    <div style="display:grid;grid-template-columns:560px minmax(0, 1fr);gap:20px">
      ${panel(col([label('평면도 (12px = 1m)'), planSvg, legend], { gap: 8 }), { pad: 10 })}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${panel(col([label('인게임 카메라에서 본 모습 (캐릭터 제외)'), `<div style="border-radius:8px;overflow:hidden;border:2px solid ${T.outline}">${thumb}</div>`], { gap: 8 }), { pad: 10 })}
        ${panel(rules, { pad: 10 })}
      </div>
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}

export function mapSkyDockBoard() {
  const W = 1200, H = 760;
  const sc = 10, C = 270;
  const w2s = (x, z) => [C + x * sc, C - z * sc];
  const plan = [];
  plan.push(`<rect x="0" y="0" width="540" height="540" style="fill:${T.bg2}"></rect>`);
  // 낙사 영역 빗금
  plan.push(`<defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" style="stroke:${T.line2};stroke-width:2px"></line></pattern></defs>`);
  plan.push(`<rect x="0" y="0" width="540" height="540" style="fill:url(#hatch);opacity:0.5"></rect>`);
  // 작은 발판은 이름을 발판 밖(위)에 적는다 — 안에 적으면 스폰·상자와 겹친다
  const plat = (x, z, w, d, h, name, outside = false) => {
    const [px, py] = w2s(x, z);
    const fill = h > 0 ? '#c9bfae' : '#a7b8c9';
    const size = `${w}×${d}m · 높이 ${h > 0 ? '+' + h : h}m`;
    const lbl = outside
      ? `${txt(px, py - d * sc / 2 - 18, name, { size: 12, color: T.ink })}${txt(px, py - d * sc / 2 - 5, size, { size: 10, color: T.muted, weight: 600 })}`
      : `${txt(px, py - 4, name, { size: 12, color: T.outline })}${txt(px, py + 12, size, { size: 10, color: T.outline, weight: 600 })}`;
    return `<rect x="${r2(px - w * sc / 2)}" y="${r2(py - d * sc / 2)}" width="${w * sc}" height="${d * sc}" rx="6" style="fill:${fill};stroke:${T.outline};stroke-width:3px"></rect>${lbl}`;
  };
  plan.push(plat(0, 0, 24, 16, 0, '중앙 발판'));
  plan.push(plat(-19, 0, 8, 8, 2, '서', true));
  plan.push(plat(19, 0, 8, 8, 2, '동', true));
  plan.push(plat(0, 16, 6, 10, 0, '북', true));
  plan.push(plat(0, -16, 6, 10, 0, '남'));
  // 간격 표시
  for (const [[x1, z1], [x2, z2]] of [[[12, 3], [15, 3]], [[-12, 3], [-15, 3]], [[2, 8], [2, 11]], [[2, -8], [2, -11]]]) {
    const [a, b] = w2s(x1, z1), [c, d] = w2s(x2, z2);
    plan.push(`<line x1="${r2(a)}" y1="${r2(b)}" x2="${r2(c)}" y2="${r2(d)}" style="stroke:${T.amp};stroke-width:2px"></line>${txt((a + c) / 2, (b + d) / 2 - 6, '3m', { size: 10, color: T.amp })}`);
  }
  // 상자·스폰
  for (const [x, z] of [[-21.5, 2.5], [21.5, 2.5], [-21.5, -2.5], [21.5, -2.5]]) { const [px, py] = w2s(x, z); plan.push(`<rect x="${r2(px - 6)}" y="${r2(py - 6)}" width="12" height="12" style="fill:${T.woodDark};stroke:${T.outline};stroke-width:2px"></rect>`); }
  const spawns = [[-10, 6, 'red'], [-10, -6, 'red'], [10, 6, 'blue'], [10, -6, 'blue'], [-17, 0, 'red'], [17, 0, 'blue'], [0, 19, 'red'], [0, -19, 'blue']];
  spawns.forEach(([x, z, t], i) => { const [px, py] = w2s(x, z); plan.push(SPAWN(px, py, 10, i + 1, t)); });
  // 컨테이너 (2026-09-12): 중앙 발판 남쪽 8×4 방(2.3m), 북쪽 문. 드럼통 3 · 점프대 3
  plan.push(ROOM(w2s, sc, -4, 4, -7.5, -3.5, { x: 0, z: -3.5, dir: 'z' }, '컨테이너'));
  for (const [x, z] of [[0, -5.5], [-19, 3], [19, -3]]) { const [px, py] = w2s(x, z); plan.push(BARREL(px, py, 0.45 * sc)); }
  for (const [x, z] of [[-10.5, 0], [10.5, 0], [0, 0]]) { const [px, py] = w2s(x, z); plan.push(PAD(px, py, 0.9 * sc)); }
  plan.push(`<line x1="20" y1="520" x2="${20 + 10 * sc}" y2="520" style="stroke:${T.ink};stroke-width:3px"></line>${txt(20 + 5 * sc, 512, '10m', { size: 11, color: T.ink })}`);
  plan.push(txt(440, 525, '빗금 = 낙사 (y < −8m)', { size: 11, color: T.muted }));
  const planSvg = `<svg viewBox="0 0 540 540" width="540" height="540" style="display:block" xmlns="http://www.w3.org/2000/svg">${plan.join('')}</svg>`;

  // 측면 입면도
  const elev = (() => {
    const s = 10, gy = 150, x0 = 40;
    const box = (x, w, h, fill) => `<rect x="${r2(x0 + (x + 27) * s)}" y="${r2(gy - h * s)}" width="${w * s}" height="${r2(h * s + 8)}" style="fill:${fill};stroke:${T.outline};stroke-width:2px"></rect>`;
    return `<svg viewBox="0 0 600 220" width="560" height="205" style="display:block" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="600" height="220" style="fill:${T.bg2}"></rect>
      <line x1="0" y1="${gy + 56}" x2="600" y2="${gy + 56}" style="stroke:${T.red};stroke-width:2px;stroke-dasharray:6 6"></line>${txt(540, gy + 50, 'y = −8m 낙사', { size: 11, color: T.red })}
      ${box(-23, 8, 2, '#c9bfae')}${box(-12, 24, 0, '#a7b8c9')}${box(15, 8, 2, '#c9bfae')}
      ${txt(x0 + 8 * s, gy - 28, '서 +2m', { size: 11 })}${txt(x0 + 27 * s, gy - 8, '중앙 0m', { size: 11 })}${txt(x0 + 46 * s, gy - 28, '동 +2m', { size: 11 })}
      ${figure({ x: x0 + 20 * s, y: gy, s: 0.32, pose: 'run' })}${figure({ x: x0 + 12.5 * s, y: gy - 30, s: 0.32, pose: 'jump', facing: -1 })}
      ${txt(300, 200, '점프 높이 1.8m > 단차 2m 는 달리기 점프(수평 7.5 m/s)로만 오른다', { size: 11, color: T.muted })}
    </svg>`;
  })();
  const rules = table(['항목', '값'], [
    ['발판', '중앙 24×16m · 동서 8×8m(+2m) · 남북 6×10m'], ['간격', '3m — 걷기 점프로 건넘, 달리기 점프로 여유'], ['낙사', 'y < −8m 즉시 KO · 마지막 3초 타격자에게 KO'],
    ['상자', '4개, 동서 발판'], ['컨테이너', '중앙 남쪽 8×4m 방(2.3m), 북쪽 문 — 안에 드럼통'], ['드럼통', '컨테이너 안 + 동서 발판(옆 상자를 같이 날린다)'], ['점프대', '(±10.5, 0) 12 m/s · (0, 0) 13 m/s'], ['스폰', '중앙 모서리 4 + 측면 발판 4'], ['핵심', '태클·던지기·로켓 펀치로 링아웃'],
  ], { size: 12, colW: [60] });
  const inner = `
    ${sheetHeader('맵 2 — 스카이독', '허공에 뜬 발판 5개. 벽이 없어 던지기와 태클이 곧 KO 수단이다.', '맵')}
    <div style="display:grid;grid-template-columns:560px minmax(0, 1fr);gap:20px">
      ${panel(col([label('평면도 (10px = 1m)'), planSvg], { gap: 8 }), { pad: 10 })}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${panel(col([label('입면도 (동서 단면)'), elev], { gap: 8 }), { pad: 10 })}
        ${panel(rules, { pad: 10 })}
      </div>
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}

export function controlsBoard() {
  const W = 1200, H = 860;
  const keymap = [
    ['이동 (카메라 기준 8방향)', [key('↑'), key('←'), key('↓'), key('→')], '왼쪽 스틱'],
    ['대시 (달리기)', [key('→→'), p('또는', { size: 11 }), key('Shift')], 'LB 홀드'],
    ['공격 · 잡기(밀착)', [key('Z')], 'A'],
    ['점프', [key('X')], 'B'],
    ['가드 (홀드)', [key('C')], 'RB 홀드'],
    ['악세서리 기술', [key('V')], 'X'],
    ['줍기 · 들기 · 놓기', [key('F')], 'Y'],
    ['카메라 회전', [key('Q'), key('E'), p('우클릭 드래그', { size: 11 })], '오른쪽 스틱'],
    ['채팅 / 점수판', [key('Enter'), key('Tab')], 'Back'],
  ];
  const keyRows = keymap.map(([a, ks, pad]) => `<div style="display:grid;grid-template-columns:1fr 200px 90px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid ${T.line}">
    <div style="font-size:13px;font-weight:700">${a}</div><div style="display:flex;flex-direction:row;gap:6px;align-items:center">${ks.join('')}</div><div style="font-size:12px;color:${T.muted}">${pad}</div></div>`).join('');

  // 상태 머신
  const N = {
    idle: [330, 50, '대기 · 이동'], run: [110, 50, '달리기'], dashAtk: [110, 130, '대시 공격'],
    jump: [550, 50, '점프 · 낙하'], jumpAtk: [550, 130, '점프 공격'],
    a1: [330, 130, '공격 1'], a2: [330, 200, '공격 2'], a3: [330, 270, '공격 3 (띄움)'],
    guard: [110, 260, '가드'], stun: [110, 340, '기절 90틱'],
    grab: [550, 260, '잡기'], throwS: [550, 340, '던지기'],
    hitstun: [330, 380, '경직'], launched: [330, 450, '띄움'], down: [330, 520, '다운 50틱'],
    getup: [110, 520, '기상 24틱'], dead: [550, 450, '사망'], respawn: [550, 520, '리스폰 (모드별)'],
  };
  const node = (k, accent = false) => { const [x, y, t] = N[k]; return `<rect x="${x - 60}" y="${y - 18}" width="120" height="36" rx="8" style="fill:${accent ? T.amp : T.panel2};stroke:${T.outline};stroke-width:2px"></rect>${txt(x, y + 4, t, { size: 12, color: accent ? T.outline : T.ink })}`; };
  const edge = (a, b, lbl = '', bend = 0) => {
    const [x1, y1] = N[a], [x2, y2] = N[b];
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 + bend * 0.4;
    const d = bend ? `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
    return `<path d="${d}" style="fill:none;stroke:${T.line2};stroke-width:2px" marker-end="url(#arr)"></path>${lbl ? `<rect x="${mx - lbl.length * 3.6 - 4}" y="${my - 8}" width="${lbl.length * 7.2 + 8}" height="16" rx="4" style="fill:${T.bg}"></rect>${txt(mx, my + 4, lbl, { size: 10, color: T.amp })}` : ''}`;
  };
  const edges = [
    edge('idle', 'run', '더블탭'), edge('run', 'dashAtk', 'Z'), edge('idle', 'jump', 'X'), edge('jump', 'jumpAtk', 'Z'),
    edge('idle', 'a1', 'Z'), edge('a1', 'a2', 'Z'), edge('a2', 'a3', 'Z'), edge('idle', 'guard', 'C 홀드', -30), edge('guard', 'stun', '게이지 0'),
    edge('idle', 'grab', 'Z 밀착', 30), edge('grab', 'throwS', 'Z / 방향'), edge('idle', 'hitstun', '경타', -110), edge('hitstun', 'launched', '강타'),
    edge('launched', 'down', '착지'), edge('down', 'getup', ''), edge('getup', 'idle', '', -170), edge('hitstun', 'dead', 'HP 0'), edge('dead', 'respawn', ''),
    edge('respawn', 'idle', '', 190),
  ];
  const sm = `<svg viewBox="0 0 660 570" width="660" height="570" style="display:block" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" style="fill:${T.line2}"></path></marker></defs>
    ${edges.join('')}
    ${Object.keys(N).map((k) => node(k, k === 'idle')).join('')}
  </svg>`;

  const inner = `
    ${sheetHeader('조작과 상태 머신', '키는 설정에서 바꿀 수 있다. 잡기는 별도 키 없이 밀착 상태의 공격 키가 우선한다.', '규칙')}
    <div style="display:grid;grid-template-columns:440px minmax(0, 1fr);gap:20px">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${panel(col([`<div style="display:grid;grid-template-columns:1fr 200px 90px;gap:10px;font-size:11px;color:${T.dim};font-weight:700"><div>동작</div><div>키보드</div><div>패드</div></div>`, keyRows], { gap: 4 }), { pad: 14 })}
        ${panel(col([label('무적 · 우선순위'), p('무적: 다운 50틱 · 기상 24틱 · 구르기 30틱 · 리스폰 120틱(공격 시 해제). 같은 틱 충돌은 발동이 빠른 쪽, 같으면 둘 다 맞는다. 가드는 잡기와 후방 타격에 뚫린다.', { size: 12 })], { gap: 6 }), { pad: 14 })}
      </div>
      ${panel(col([label('캐릭터 상태 머신 (shared/sim/player)'), sm], { gap: 8 }), { pad: 14 })}
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}

export function netcodeBoard() {
  const W = 1200, H = 1020;
  const box = (x, y, w, h, title, lines, accent) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" style="fill:${T.panel};stroke:${accent};stroke-width:3px"></rect>
    <rect x="${x}" y="${y}" width="${w}" height="40" rx="12" style="fill:${accent}"></rect><rect x="${x}" y="${y + 24}" width="${w}" height="16" style="fill:${accent}"></rect>
    ${txt(x + w / 2, y + 26, title, { size: 15, color: T.outline, weight: 800 })}
    ${lines.map((l, i) => `<rect x="${x + 16}" y="${y + 56 + i * 40}" width="${w - 32}" height="30" rx="6" style="fill:${T.bg2}"></rect>${txt(x + w / 2, y + 76 + i * 40, l, { size: 12 })}`).join('')}`;
  const arrow = (x1, y1, x2, y2, lbl, color) => `<path d="M ${x1} ${y1} L ${x2} ${y2}" style="fill:none;stroke:${color};stroke-width:3px" marker-end="url(#arr2)"></path>
    <rect x="${(x1 + x2) / 2 - 92}" y="${(y1 + y2) / 2 - 12}" width="184" height="24" rx="6" style="fill:${T.bg}"></rect>${txt((x1 + x2) / 2, (y1 + y2) / 2 + 4, lbl, { size: 12, color })}`;
  const diagram = `<svg viewBox="0 0 1140 330" width="1140" height="330" style="display:block" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" style="fill:${T.ink}"></path></marker></defs>
    ${box(20, 20, 380, 290, '브라우저 클라이언트 (Three.js)', ['입력 수집 60Hz → 카메라 기준 벡터', '로컬 캐릭터 즉시 예측 (shared/sim)', '스냅샷 수신 → 되감기 + 미확인 입력 재실행', '원격 캐릭터 100ms 지연 보간', '렌더 · 애니메이션 · HUD · 이펙트'], T.cyan)}
    ${box(740, 20, 380, 290, 'Node 서버 (ws)', ['로비 · 방 · 슬롯 · 준비 · 시작', '방마다 World, 60틱 고정 스텝', '입력 큐 → step() → 판정 · HP · KO', '스냅샷 20Hz + 이벤트 즉시', '봇 = 같은 입력 파이프라인'], T.amp)}
    ${arrow(400, 90, 740, 90, '입력 60Hz {seq, tick, mx, mz, btn}', T.cyan)}
    ${arrow(740, 170, 400, 170, '스냅샷 20Hz {tick, lastSeq, players[]}', T.amp)}
    ${arrow(740, 250, 400, 250, '이벤트 즉시 {hit, ko, pickup, chat}', T.green)}
    ${txt(570, 300, 'shared/ 시뮬레이션 코드를 양쪽이 같은 파일로 실행한다 — 예측이 서버와 어긋나지 않는 조건', { size: 12, color: T.muted })}
  </svg>`;
  // 예측 타임라인
  const tl = (() => {
    const x0 = 120, step = 48;
    const ticks = [];
    for (let i = 0; i < 20; i++) ticks.push(`<line x1="${x0 + i * step}" y1="70" x2="${x0 + i * step}" y2="86" style="stroke:${T.line2};stroke-width:2px"></line>${i % 5 === 0 ? txt(x0 + i * step, 104, `틱 ${1200 + i}`, { size: 10, color: T.muted }) : ''}`);
    return `<svg viewBox="0 0 1140 170" width="1140" height="170" style="display:block" xmlns="http://www.w3.org/2000/svg">
      <line x1="${x0}" y1="78" x2="${x0 + 19 * step}" y2="78" style="stroke:${T.line2};stroke-width:3px"></line>${ticks.join('')}
      <circle cx="${x0}" cy="78" r="8" style="fill:${T.cyan};stroke:${T.outline};stroke-width:2px"></circle>${txt(x0, 50, '입력 Z (seq 41)', { size: 11, color: T.cyan })}${txt(x0, 130, '즉시 공격 1 예측 시작', { size: 11, color: T.cyan })}
      <circle cx="${x0 + 4 * step}" cy="78" r="8" style="fill:${T.amp};stroke:${T.outline};stroke-width:2px"></circle>${txt(x0 + 4 * step, 50, '서버 처리 (RTT/2 ≈ 4틱)', { size: 11, color: T.amp })}
      <circle cx="${x0 + 8 * step}" cy="78" r="8" style="fill:${T.amp};stroke:${T.outline};stroke-width:2px"></circle>${txt(x0 + 8 * step, 50, '스냅샷 도착 (lastSeq 41)', { size: 11, color: T.amp })}${txt(x0 + 8 * step, 130, '되감기 → seq 42~48 재실행 → 오차 0.01m 이하면 무시', { size: 11, color: T.amp })}
      <circle cx="${x0 + 9 * step}" cy="78" r="8" style="fill:${T.green};stroke:${T.outline};stroke-width:2px"></circle>${txt(x0 + 9 * step, 152, '히트 이벤트 → 스파크 · 데미지 숫자', { size: 11, color: T.green })}
      <rect x="${x0 + 13 * step}" y="60" width="${5 * step}" height="36" rx="6" style="fill:${T.panel2};stroke:${T.line2};stroke-width:2px"></rect>${txt(x0 + 15.5 * step, 82, '원격 캐릭터: 100ms(6틱) 뒤에서 보간', { size: 11 })}
    </svg>`;
  })();
  const nums = table(['항목', '값', '근거'], [
    ['시뮬 틱', '60Hz 고정 (16.67ms)', '프레임 데이터 표가 틱 단위'], ['입력 전송', '60Hz, 미확인분 묶어 재전송', '유실 대비, 입력당 6바이트급'],
    ['스냅샷', '20Hz, 8인 약 1.2KB (JSON)', '24KB/s ↓ · 바이너리 전환 시 1/3'], ['보간 지연', '100ms', '스냅샷 2개 사이를 항상 확보'],
    ['반응 목표', '입력→화면 < 50ms', '예측이 있어 RTT 와 무관'], ['히트 확인', 'RTT + 50ms', '서버 판정 후 이벤트'],
    ['래그 보상', 'P1 없음 → P4 100ms 리와인드', '8인 난전이라 우선순위 낮음'], ['봇', '서버 안, 방당 최대 7', '사람 1 + 봇 7 = 8인 부하'],
  ], { size: 12, colW: [90, 220] });
  const stack = row([['Three.js', '렌더'], ['TypeScript', '전부'], ['Vite', '클라 빌드'], ['Node 22 + ws', '서버'], ['vitest', '테스트'], ['esbuild', '서버 빌드']].map(([a, b]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px;background:${T.panel2};border-radius:8px"><div style="font-size:13px;font-weight:800">${a}</div><div style="font-size:10px;color:${T.muted}">${b}</div></div>`), { gap: 8 });
  const inner = `
    ${sheetHeader('네트워크 구조 — 서버 권위 + 클라 예측', '위치·HP·판정은 서버만 정한다. 클라는 입력을 보내고, 자기 캐릭터만 미리 움직여 보여준다.', '구조')}
    ${panel(diagram, { pad: 10 })}
    ${panel(col([label('예측 · 조정 타임라인 (한 번의 공격 입력)'), tl], { gap: 8 }), { pad: 10 })}
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) 560px;gap:20px;align-items:start">
      ${panel(col([label('기술 스택'), stack, p('설치 의존성은 Three.js · ws · vite · vitest · esbuild 뿐. shared 는 의존성 0 이라 서버·클라·테스트가 같은 파일을 실행한다.', { size: 12 })], { gap: 10 }), { pad: 12 })}
      ${panel(nums, { pad: 10 })}
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}

export function roadmapBoard() {
  const W = 1200, H = 600;
  const phases = [
    ['P0', '시안', '기획서 + 이 캔버스 13장', '사용자 확인', T.green],
    ['P1', '코어 전투', 'shared 시뮬 · 로컬 플레이(봇 3) · 콜로세움 · HUD', '이동·콤보·가드·잡기·다운 테스트, 봇과 3분 매치', T.amp],
    ['P2', '온라인', '로비 · 방 · 8인 · 예측/보간 · 결과 화면', '헤드리스 2탭 + 봇 6 매치 완주, 스냅 오차 로그', T.amp],
    ['P3', '콘텐츠', '악세서리 6 · 상자/하트/폭탄 · 스카이독 · 모드 3', '악세서리별 테스트, 링아웃 KO', T.cyan],
    ['P4', '마감', '이펙트 · SFX · 터치 패드 · 배포', '1080p 60fps 트레이스, 모바일 가로 실측', T.cyan],
    ['2차', '차별화', '스타일 6종 기술 · 스킨 페인터 · 진행/상점', '별도 기획', T.purple],
  ];
  const cards = phases.map(([k, n, what, gate, c]) => `<div style="display:flex;flex-direction:column;gap:8px;padding:14px;background:${T.panel};border:2px solid ${c};border-radius:12px;box-shadow:0 4px 0 ${T.bg2}">
    <div style="display:flex;flex-direction:row;align-items:center;gap:8px"><div class="display" style="font-size:26px;color:${c}">${k}</div><div style="font-size:16px;font-weight:800">${n}</div></div>
    <div style="font-size:12px;color:${T.ink};line-height:1.5">${what}</div>
    <div style="font-size:11px;color:${T.muted};line-height:1.5"><span style="color:${c};font-weight:800">완료 판정</span> · ${gate}</div>
  </div>`).join('');
  const gates = table(['축', '목표', '판정'], [
    ['동시 인원', '방당 8인 (봇 포함)', '봇 7 + 사람 1, 3분 완주'], ['아레나', '40×40m 급 · 발판 맵 3층', '맵 정의 수치'],
    ['시뮬레이션', '60틱 · 스냅샷 20Hz', '틱 지연 p99 < 4ms'], ['클라', '1080p 60fps, 8인 화면', '프레임 p95 < 16.7ms'],
    ['반응', '입력→화면 < 50ms', '타임스탬프 비교'], ['매치', '3분 · 결과까지 자동', 'E2E 2탭 완주'],
  ], { size: 12 });
  const inner = `
    ${sheetHeader('로드맵과 완료 게이트', '작은 단계로 나누고, 각 단계는 수치로 닫는다. 시안 확인 뒤 P1 부터 바로 구현에 들어간다.', '계획')}
    <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:12px">${cards}</div>
    ${panel(col([label('기준 수치 (벤치마크 게이트)'), gates], { gap: 8 }), { pad: 12 })}`;
  return doc({ body: sheet(W, H, inner) });
}

/** 맵 3 옥상 (2026-09-11 · 기계실 개방 2026-09-12) */
export function mapRooftopBoard() {
  const W = 1200, H = 760;
  const sc = 14, C = 270;
  const w2s = (x, z) => [C + x * sc, C - z * sc];
  const plan = [];
  plan.push(`<rect x="0" y="0" width="540" height="540" style="fill:#0b1026"></rect>`);
  // 도시 야경 — 먼 건물 실루엣
  for (let i = 0; i < 14; i++) plan.push(`<rect x="${i * 40}" y="${r2(30 + ((i * 37) % 60))}" width="30" height="${r2(60 - ((i * 37) % 60))}" style="fill:#161c3a"></rect>`);
  const rect = (x0, x1, z0, z1, fill, name, h) => { const [px, py] = w2s(x0, z1); return `<rect x="${r2(px)}" y="${r2(py)}" width="${r2((x1 - x0) * sc)}" height="${r2((z1 - z0) * sc)}" rx="3" style="fill:${fill};stroke:${T.outline};stroke-width:3px"></rect>${name ? txt(px + (x1 - x0) * sc / 2, py + (z1 - z0) * sc / 2 + 4, `${name}${h ? ' +' + h + 'm' : ''}`, { size: 10, color: T.outline }) : ''}`; };
  plan.push(rect(-15, 15, -10, 10, '#8a919f', '', 0));
  // 헬리패드 무늬
  plan.push(`<circle cx="${C}" cy="${C}" r="${4 * sc}" style="fill:none;stroke:#c9cfdb;stroke-width:3px"></circle>${txt(C, C + 6, 'H', { size: 26, color: '#c9cfdb' })}`);
  plan.push(rect(-14, -6, -1, 2, '#a4abb8', '턱', 1));
  plan.push(rect(7, 9, 5, 7, '#a4abb8', '실외기', 1.2));
  plan.push(rect(7, 9, -7, -5, '#a4abb8', '실외기', 1.2));
  plan.push(rect(-1.5, 1.5, -8.75, -7.25, '#a4abb8', '', 1));
  plan.push(ROOM(w2s, sc, -14, -6, 2, 8, { x: -6, z: 5, dir: 'x' }, '기계실 8×6m · 2.3m'));
  for (const [x, z] of [[-13.5, -6], [13.5, -8.5], [3, 8.5], [-3, -8.5], [-12, 6.5]]) { const [px, py] = w2s(x, z); plan.push(`<rect x="${r2(px - 6)}" y="${r2(py - 6)}" width="12" height="12" style="fill:${T.woodDark};stroke:${T.outline};stroke-width:2px"></rect>`); }
  for (const [x, z] of [[-8, 6.5], [5, -3]]) { const [px, py] = w2s(x, z); plan.push(BARREL(px, py, 0.45 * sc)); }
  for (const [x, z] of [[-4.5, 3.2], [11, 0]]) { const [px, py] = w2s(x, z); plan.push(PAD(px, py, 0.9 * sc)); }
  const spawns = [[-13, -8, 'red'], [-13, 8, 'red'], [-5, -8.5, 'red'], [-10, 5, 'red'], [13, -8, 'blue'], [13, 8, 'blue'], [5, 8.5, 'blue'], [12, 0, 'blue']];
  spawns.forEach(([x, z, t], i) => { const [px, py] = w2s(x, z); plan.push(SPAWN(px, py, 10, i + 1, t)); });
  plan.push(`<line x1="20" y1="520" x2="${20 + 10 * sc}" y2="520" style="stroke:${T.ink};stroke-width:3px"></line>${txt(20 + 5 * sc, 512, '10m', { size: 11, color: T.ink })}`);
  plan.push(txt(430, 525, '지붕 밖 = 낙사 (난간 없음)', { size: 11, color: T.muted }));
  const planSvg = `<svg viewBox="0 0 540 540" width="540" height="540" style="display:block" xmlns="http://www.w3.org/2000/svg">${plan.join('')}</svg>`;
  const legend = `<div style="display:flex;flex-direction:row;flex-wrap:wrap;gap:8px">${[
    ['#8a919f', '지붕 30×20m (0m)'], ['#a4abb8', '턱 +1m · 실외기 +1.2m'], ['#6d7390', '기계실 (들어갈 수 있는 방, 동쪽 문)'], [T.woodDark, '상자 ×5'], ['#b8402e', '드럼통 ×2'], [T.amp, '점프대 ×2'], [T.red, '레드 스폰'], [T.blue, '블루 스폰'],
  ].map(([c, n]) => `<div style="display:flex;flex-direction:row;align-items:center;gap:6px;font-size:12px"><div style="width:14px;height:14px;border-radius:3px;background:${c};border:2px solid ${T.outline}"></div>${n}</div>`).join('')}</div>`;
  const section = (() => {
    const s = 12, gy = 150, x0 = 40;
    const box = (x, w, h, fill) => `<rect x="${r2(x0 + (x + 16) * s)}" y="${r2(gy - h * s)}" width="${r2(w * s)}" height="${r2(h * s + 8)}" style="fill:${fill};stroke:${T.outline};stroke-width:2px"></rect>`;
    return `<svg viewBox="0 0 600 220" width="560" height="205" style="display:block" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="600" height="220" style="fill:${T.bg2}"></rect>
      ${box(-15, 30, 0, '#8a919f')}${box(-14, 8, 1, '#a4abb8')}${box(-14, 8, 2.3, '#6d7390')}${box(7, 2, 1.2, '#a4abb8')}
      ${txt(x0 + 2 * s, gy - 42, '기계실 지붕 +2.3m (턱 +1m 을 밟고 점프)', { size: 11, anchor: 'start' })}${txt(x0 + 24 * s, gy - 22, '실외기 +1.2m', { size: 11, anchor: 'start' })}
      ${figure({ x: x0 + 14 * s, y: gy - 12, s: 0.32, pose: 'jump' })}${figure({ x: x0 + 20 * s, y: gy, s: 0.32, pose: 'run', facing: -1 })}
      <line x1="0" y1="${gy + 56}" x2="600" y2="${gy + 56}" style="stroke:${T.red};stroke-width:2px;stroke-dasharray:6 6"></line>${txt(540, gy + 50, 'y = −8m 낙사', { size: 11, color: T.red })}
    </svg>`;
  })();
  const rules = table(['항목', '값'], [
    ['크기', '지붕 30×20m · 난간 없음 — 가장자리가 곧 낙사'], ['기계실', '8×6m 방, 높이 2.3m, 동쪽 벽 가운데 1.8m 문. 안에 상자 1 · 드럼통 1'], ['벽·지붕', '시뮬에서 보통 상자(천장에 머리가 막힌다) · 화면은 안에 있으면 벽·지붕을 비친다'],
    ['턱·실외기', '+1m 턱을 밟고 기계실 지붕(+2.3m)에 오른다 · 실외기 +1.2m 엄폐'], ['드럼통', '기계실 안 (−8, 6.5) · 밖 (5, −3)'], ['점프대', '(−4.5, 3.2) · (11, 0) 11 m/s'], ['스폰', '레드 서쪽 4 · 블루 동쪽 4'],
  ], { size: 12, colW: [70] });
  const inner = `
    ${sheetHeader('맵 3 — 옥상', '도시 야경 위 30×20m 지붕. 기계실에 들어가 싸울 수 있고, 난간이 없어 가장자리가 곧 낙사다.', '맵')}
    <div style="display:grid;grid-template-columns:560px minmax(0, 1fr);gap:20px">
      ${panel(col([label('평면도 (14px = 1m)'), planSvg, legend], { gap: 8 }), { pad: 10 })}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${panel(col([label('단면 (서→동)'), section], { gap: 8 }), { pad: 10 })}
        ${panel(rules, { pad: 10 })}
      </div>
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}

/** 맵 4 얼음 호수 (2026-09-11) */
export function mapIceLakeBoard() {
  const W = 1200, H = 760;
  const sc = 13, C = 270;
  const w2s = (x, z) => [C + x * sc, C - z * sc];
  const plan = [];
  plan.push(`<rect x="0" y="0" width="540" height="540" style="fill:#223a66"></rect>`);
  plan.push(`<circle cx="${C}" cy="${C}" r="${18 * sc}" style="fill:#cfe6f5;stroke:${T.outline};stroke-width:4px"></circle>`);
  for (const R of [6, 12]) plan.push(`<circle cx="${C}" cy="${C}" r="${R * sc}" style="fill:none;stroke:rgba(40,70,120,0.25);stroke-width:1.5px"></circle>`);
  // 균열 무늬
  for (let i = 0; i < 6; i++) { const a = (i * 61 + 17) * Math.PI / 180; plan.push(`<line x1="${r2(C + Math.cos(a) * 4 * sc)}" y1="${r2(C + Math.sin(a) * 4 * sc)}" x2="${r2(C + Math.cos(a + 0.4) * 15 * sc)}" y2="${r2(C + Math.sin(a + 0.4) * 15 * sc)}" style="stroke:rgba(90,130,180,0.35);stroke-width:2px"></line>`); }
  const rock = (x, z, r, h) => { const [px, py] = w2s(x, z); return `<circle cx="${r2(px)}" cy="${r2(py)}" r="${r2(r * sc)}" style="fill:#7d8593;stroke:${T.outline};stroke-width:2px"></circle>${txt(px, py + 4, `+${h}m`, { size: 9, color: T.outline })}`; };
  plan.push(rock(0, 0, 1.6, 2.2));
  for (const [x, z] of [[9, 9], [-9, 9], [9, -9], [-9, -9]]) plan.push(rock(x, z, 0.9, 1.4));
  for (let i = 0; i < 4; i++) { const a = (i * 90 + 45) * Math.PI / 180; const [px, py] = w2s(6 * Math.cos(a), 6 * Math.sin(a)); plan.push(`<rect x="${r2(px - 6)}" y="${r2(py - 6)}" width="12" height="12" style="fill:${T.woodDark};stroke:${T.outline};stroke-width:2px"></rect>`); }
  for (const [x, z] of [[0, 4.5], [0, -4.5]]) { const [px, py] = w2s(x, z); plan.push(BARREL(px, py, 0.45 * sc)); }
  for (let i = 0; i < 8; i++) { const a = (i * 45) * Math.PI / 180; const [px, py] = w2s(12 * Math.cos(a), 12 * Math.sin(a)); plan.push(SPAWN(px, py, 10, i + 1, Math.cos(a) > 0.01 ? 'red' : Math.cos(a) < -0.01 ? 'blue' : (i === 2 ? 'red' : 'blue'))); }
  plan.push(`<line x1="20" y1="520" x2="${20 + 10 * sc}" y2="520" style="stroke:${T.ink};stroke-width:3px"></line>${txt(20 + 5 * sc, 512, '10m', { size: 11, color: T.ink })}`);
  plan.push(txt(440, 525, '얼음판 밖 = 물 (낙사)', { size: 11, color: T.ink }));
  const planSvg = `<svg viewBox="0 0 540 540" width="540" height="540" style="display:block" xmlns="http://www.w3.org/2000/svg">${plan.join('')}</svg>`;
  const legend = `<div style="display:flex;flex-direction:row;flex-wrap:wrap;gap:8px">${[
    ['#cfe6f5', '얼음판 r 18m (미끄러움)'], ['#7d8593', '바위 ×5 (중앙 r 1.6 · 작은 r 0.9)'], [T.woodDark, '상자 ×4'], ['#b8402e', '드럼통 ×2'], [T.red, '레드 스폰'], [T.blue, '블루 스폰'],
  ].map(([c, n]) => `<div style="display:flex;flex-direction:row;align-items:center;gap:6px;font-size:12px"><div style="width:14px;height:14px;border-radius:3px;background:${c};border:2px solid ${T.outline}"></div>${n}</div>`).join('')}</div>`;
  // 미끄러짐 곡선: 손을 떼면 틱당 1.5% 감속 → 약 2.5초
  const slide = (() => {
    const pts = []; let v = 6.2; for (let t = 0; t <= 180; t += 6) { pts.push(`${r2(40 + t * 2.8)},${r2(170 - v * 20)}`); for (let k = 0; k < 6; k++) v *= 0.985; }
    return `<svg viewBox="0 0 600 220" width="560" height="205" style="display:block" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="600" height="220" style="fill:${T.bg2}"></rect>
      <line x1="40" y1="170" x2="560" y2="170" style="stroke:${T.line2};stroke-width:2px"></line><line x1="40" y1="30" x2="40" y2="170" style="stroke:${T.line2};stroke-width:2px"></line>
      <polyline points="${pts.join(' ')}" style="fill:none;stroke:${T.amp};stroke-width:3px"></polyline>
      ${txt(300, 195, '손을 뗀 뒤 시간 (0 → 3초)', { size: 11, color: T.muted })}${txt(60, 40, '속도 6.2 m/s', { size: 11, color: T.muted, anchor: 'start' })}
      ${txt(300, 60, '틱당 1.5% 감속 — 약 2.5초 미끄러진다 · 가속은 틱당 7% · 공격 중엔 멈춘다', { size: 11, color: T.ink })}
    </svg>`;
  })();
  const rules = table(['항목', '값'], [
    ['크기', '반지름 18m 얼음판, 밖은 물(낙사 y < −8m)'], ['미끄러움', '목표 속도에 틱당 7% 씩 붙고, 손을 떼면 틱당 1.5% 씩 감속. 공격 중엔 멈춘다'], ['바위', '중앙 r 1.6m(+2.2m) + 작은 바위 4 (r 0.9m, +1.4m) — 엄폐·발판'],
    ['상자·드럼통', '상자 4 (반지름 6m) · 드럼통 2 (바위 남북 4.5m)'], ['스폰', '반지름 12m 원주 8 · 팀전은 동서'], ['봇', '벽 없는 맵에서 앞 0.9m 에 지지면이 없으면 멈춘다'],
  ], { size: 12, colW: [80] });
  const inner = `
    ${sheetHeader('맵 4 — 얼음 호수', '미끄러워 멈추기 어려운 원형 얼음판. 가장자리 밖은 물이라 밀려나면 끝이다.', '맵')}
    <div style="display:grid;grid-template-columns:560px minmax(0, 1fr);gap:20px">
      ${panel(col([label('평면도 (13px = 1m)'), planSvg, legend], { gap: 8 }), { pad: 10 })}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${panel(col([label('미끄러짐'), slide], { gap: 8 }), { pad: 10 })}
        ${panel(rules, { pad: 10 })}
      </div>
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}
