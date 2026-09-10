// 캐릭터 · 악세서리 · 동작 시트
import { T, doc, r2 } from '../tokens.mjs';
import { figure, figureFront, svgWrap, POSES } from '../figure.mjs';
import { icon, panel, chip, row, col, h1, p, table, label, sheetHeader, key } from '../ui.mjs';

const sheet = (w, h, inner) => `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${T.bg};color:${T.ink};padding:28px;display:flex;flex-direction:column;gap:20px">${inner}</div>`;

/** 대기 포즈의 관절 위치 (figure.mjs 와 같은 수식) — 리그 도식용. */
function joints() {
  const P = POSES.idle;
  const rad = (a) => (a * Math.PI) / 180;
  const fwd = (from, len, ang) => [from[0] + len * Math.sin(rad(ang)), from[1] + len * Math.cos(rad(ang))];
  const shoulderN = [13, -58], shoulderF = [-13, -58];
  const elbowN = fwd(shoulderN, 15, P.nearArm[0]);
  const wristN = fwd(elbowN, 13, P.nearArm[0] + P.nearArm[1]);
  const handN = fwd(wristN, 15, P.nearArm[0] + P.nearArm[1]);
  const elbowF = fwd(shoulderF, 15, P.farArm[0]);
  const wristF = fwd(elbowF, 13, P.farArm[0] + P.farArm[1]);
  const hipN = [6, -30], kneeN = [6, -16], ankleN = [6, -4];
  const hipF = [-6, -30], kneeF = [-6, -16], ankleF = [-6, -4];
  return [
    ['머리', [0, -86]], ['목·몸통 위', [0, -62]], ['몸통 뿌리', [0, -30]],
    ['어깨 R', shoulderN], ['팔꿈치 R', elbowN], ['손 R', handN],
    ['어깨 L', shoulderF], ['팔꿈치 L', elbowF], ['손 L', wristF],
    ['엉덩이 R', hipN], ['무릎 R', kneeN], ['발 R', ankleN],
    ['엉덩이 L', hipF], ['무릎 L', kneeF], ['발 L', ankleF],
  ];
}

export function characterBoard() {
  const W = 1200, H = 900;
  const S = 2.2;
  const guide = (x, w) => {
    const lines = [[0, '머리 꼭대기'], [56, '턱 (머리 1.0)'], [90, '허리'], [120, '발바닥']];
    return `<g>${lines.map(([u, t]) => `<line x1="${x}" y1="${r2(290 - (120 - u) * S)}" x2="${x + w}" y2="${r2(290 - (120 - u) * S)}" style="stroke:${T.amp};stroke-width:1.5px;stroke-dasharray:6 6;opacity:0.7"></line><text x="${x + w + 8}" y="${r2(290 - (120 - u) * S + 4)}" style="font:700 11px 'Gothic A1',sans-serif;fill:${T.amp}">${t}</text>`).join('')}</g>`;
  };
  const turn = svgWrap(
    figureFront({ x: 110, y: 290, s: S }) +
    figure({ x: 330, y: 290, s: S, pose: 'idle' }) +
    figure({ x: 550, y: 290, s: S, pose: 'run' }) +
    figure({ x: 770, y: 290, s: S, pose: 'idle', facing: -1 }) +
    guide(20, 830) +
    ['정면', '측면 대기', '측면 달리기', '반대 측면'].map((t, i) => `<text x="${110 + i * 220}" y="318" text-anchor="middle" style="font:800 13px 'Gothic A1',sans-serif;fill:${T.muted}">${t}</text>`).join(''),
    { w: 980, h: 330, vb: '0 0 980 330' });

  const js = joints();
  const rig = svgWrap(
    figure({ x: 130, y: 250, s: 2.0, pose: 'idle', alpha: 0.55 }) +
    js.map(([, [x, y]]) => `<circle cx="${r2(130 + x * 2)}" cy="${r2(250 + y * 2)}" r="6" style="fill:${T.amp};stroke:${T.outline};stroke-width:2px"></circle>`).join('') +
    // 뼈 연결
    [[[0, -86], [0, -62]], [[0, -62], [0, -30]], [[0, -62], [13, -58]], [[0, -62], [-13, -58]], [[0, -30], [6, -30]], [[0, -30], [-6, -30]]]
      .map(([a, b]) => `<line x1="${r2(130 + a[0] * 2)}" y1="${r2(250 + a[1] * 2)}" x2="${r2(130 + b[0] * 2)}" y2="${r2(250 + b[1] * 2)}" style="stroke:${T.amp};stroke-width:3px"></line>`).join(''),
    { w: 280, h: 270, vb: '0 0 280 270' });
  const rigList = `<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:4px 14px">${js.map(([n]) => `<div style="font-size:12px;color:${T.ink}"><span style="color:${T.amp}">●</span> ${n}</div>`).join('')}</div>`;

  // 머리만 보이게: 머리 중심(0,-86)·s 1.4 → (48, 48) 에 오도록 발 위치를 잡고, 프레임 밖은 숨긴다
  const faces = [['calm', '기본'], ['angry', '공격'], ['hurt', '피격'], ['dizzy', '다운·기절']].map(([f, t]) =>
    `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${svgWrap(figure({ x: 52, y: 48 + 86 * 1.4, s: 1.4, pose: 'idle', faceKind: f, shadow: false }), { w: 96, h: 96, vb: '0 0 96 96', extra: 'overflow:hidden;background:' + T.bg2 + ';border-radius:12px' })}<div style="font-size:12px;font-weight:700;color:${T.muted}">${t}</div></div>`).join('');
  const sw = (c, n) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:32px;height:32px;border-radius:8px;background:${c};border:2px solid ${T.outline}"></div><div style="font-size:10px;color:${T.muted};white-space:nowrap">${n}</div></div>`;
  const palette = `<div style="display:flex;flex-direction:row;gap:6px">${[[T.skin, '피부'], [T.outline, '외곽선'], [T.amp, '머리띠'], [T.hair, '머리'], [T.pants, '바지'], [T.shoe, '신발']].map(([c, n]) => sw(c, n)).join('')}</div>`;
  const slots = `<div style="display:flex;flex-direction:row;gap:4px">${T.slot.map((c, i) => sw(c, `${i + 1}`)).join('')}</div>`;

  const atlas = (() => {
    const cells = [
      [0, 0, 128, 128, '머리 앞'], [128, 0, 128, 128, '머리 뒤'], [0, 128, 128, 96, '몸통 앞'], [128, 128, 128, 96, '몸통 뒤'],
      [0, 224, 64, 32, '팔 R'], [64, 224, 64, 32, '팔 L'], [128, 224, 64, 32, '다리 R'], [192, 224, 64, 32, '다리 L'],
    ];
    return `<svg viewBox="0 0 256 256" width="240" height="240" style="display:block;flex:none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="256" height="256" style="fill:${T.bg2};stroke:${T.line2};stroke-width:2px"></rect>
      ${cells.map(([x, y, w, h, n]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="fill:${T.panel2};stroke:${T.amp};stroke-width:1.5px"></rect><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" style="font:700 11px 'Gothic A1',sans-serif;fill:${T.ink}">${n}</text>`).join('')}
    </svg>`;
  })();

  const inner = `
    ${sheetHeader('루키 — 캐릭터 시트', '치비 약 2.3등신 · 오리지널 실루엣: 머리띠 + 뒤로 뻗친 머리 3가닥 + 큰 운동화 · 상의 색이 슬롯 색', '캐릭터')}
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) 300px;gap:20px">
      ${panel(col([label('턴어라운드 · 비율 (머리 지름 = 키의 43%)'), turn], { gap: 6 }), { pad: 14 })}
      ${panel(col([label('리그 13본 + 발 2 (3D 프리미티브 리그)'), rig, rigList], { gap: 8 }), { pad: 14 })}
    </div>
    <div style="display:grid;grid-template-columns:470px minmax(0, 1fr) 300px;gap:20px">
      ${panel(col([label('표정 4종'), `<div style="display:flex;flex-direction:row;gap:12px;justify-content:space-between">${faces}</div>`], { gap: 8 }), { pad: 14 })}
      ${panel(col([label('팔레트'), palette, label('슬롯 색 8 (상의 · 명찰)'), slots], { gap: 8 }), { pad: 14 })}
      ${panel(col([label('스킨 아틀라스 1024² (Phase 2 페인터)'), atlas, p('부위별 사각 영역을 고정해 두면 사용자가 칠한 그림이 그대로 3D 에 입혀진다. 1차는 단색 + 슬롯 색.', { size: 11 })], { gap: 8 }), { pad: 14 })}
    </div>`;
  return doc({ body: sheet(W, H, inner) });
}

export function accessoriesBoard() {
  const W = 1200, H = 800;
  const ACC = [
    { ic: 'fist', name: '맨손', kind: '기본', pose: 'uppercut', acc: null, basic: '잽 · 스트레이트 · 돌려차기 3단 (5 / 6 / 10)', skill: '어퍼컷 — 14, 높이 띄움', nums: ['리치 1.2m', '쿨다운 3초', '잡기 가능'] },
    { ic: 'sword', name: '브레이커 (대검)', kind: '근접 · 중', pose: 'swing', acc: 'greatsword', basic: '2단 대각 베기, 호 150° (12 / 16)', skill: '내려찍기 — 점프 후 낙하 충격파 반지름 2.5m, 20, 다운', nums: ['리치 1.9m', '쿨다운 6초', '이동 −10% · 잡기 불가'] },
    { ic: 'spear', name: '스파이크 (장창)', kind: '근접 · 장', pose: 'thrust', acc: 'spear', basic: '3단 찌르기, 직선 판정 (6 / 6 / 12)', skill: '돌진 찌르기 — 6m 돌진, 관통, 14, 다운', nums: ['리치 2.2m', '쿨다운 5초', '측면 약함'] },
    { ic: 'pistol', name: '더블탭 (쌍권총)', kind: '원거리', pose: 'shoot', acc: 'pistol', basic: '탄환 사거리 14m, 4 데미지, 탄창 12, 재장전 1.5초', skill: '백롤 난사 — 뒤로 구르며 부채꼴 6발', nums: ['사거리 14m', '쿨다운 6초', '근접 잡기 취약'] },
    { ic: 'shield', name: '월 (방패)', kind: '방어', pose: 'bash', acc: 'shield', basic: '방패 밀치기 8, 넉백 3 m/s', skill: '실드 차지 — 가드 유지 돌진 5m, 12, 다운', nums: ['가드 각 150°', '쿨다운 5초', '가드 크러시 면역'] },
    { ic: 'glove', name: '부스터 (로켓 글러브)', kind: '근접 · 기동', pose: 'thrust', acc: 'rocket', basic: '펀치 리치 +0.4m (6 / 6 / 12)', skill: '로켓 펀치 발사 — 투사체 10m, 16, 다운 · 공중 대시 1회', nums: ['리치 1.6m', '쿨다운 5초', '공중전 특화'] },
  ];
  const cards = ACC.map((a, i) => `<div style="display:flex;flex-direction:row;gap:12px;padding:14px;background:${T.panel};border:2px solid ${T.line2};border-radius:12px;box-shadow:0 4px 0 ${T.bg2}">
    <div style="flex:none;width:150px;height:170px;display:flex;align-items:flex-end;justify-content:center;background:${T.bg2};border-radius:10px;overflow:hidden">${svgWrap(figure({ x: 62, y: 150, s: 1.15, pose: a.pose, acc: a.acc, shirt: T.slot[i] }), { w: 150, h: 170, vb: '0 0 150 170', extra: 'overflow:hidden' })}</div>
    <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <div style="display:flex;flex-direction:row;align-items:center;gap:8px">${icon(a.ic, 22, T.amp, 2.2)}<div class="display" style="font-size:20px">${a.name}</div>${chip(a.kind, { color: T.panel3, fg: T.muted, size: 11 })}</div>
      <div style="font-size:12px;color:${T.muted}">기본 공격 (Z)</div><div style="font-size:13px;font-weight:700">${a.basic}</div>
      <div style="font-size:12px;color:${T.muted}">기술 (V)</div><div style="font-size:13px;font-weight:700;color:${T.amp}">${a.skill}</div>
      <div style="display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;margin-top:2px">${a.nums.map((n) => chip(n, { color: T.bg2, fg: T.ink, size: 11 })).join('')}</div>
    </div>
  </div>`).join('');
  const inner = `
    ${sheetHeader('악세서리 6종 — 1차 구현분', '대기실에서 1개 장착, 매치 중 교체 불가. 기본 공격과 기술(V)이 통째로 바뀐다. 이름·수치 전부 오리지널.', '장비')}
    <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px">${cards}</div>`;
  return doc({ body: sheet(W, H, inner) });
}

export function movesBoard() {
  const W = 1200, H = 900;
  const MOVES = [
    ['idle', '대기', '입력 없음 · 가드 게이지 회복 20/s'],
    ['walk', '걷기', '4.5 m/s · 8방향 · 카메라 기준'],
    ['run', '달리기', '더블탭 · 7.5 m/s · 공격 시 태클'],
    ['jump', '점프', '초속 8 m/s · 높이 1.8m · 1단'],
    ['attack1', '1타 잽', '발동 5 · 지속 3 · 후딜 8 · 5'],
    ['attack2', '2타 스트레이트', '발동 6 · 지속 3 · 후딜 10 · 6'],
    ['attack3', '3타 돌려차기', '발동 10 · 지속 5 · 후딜 18 · 10 · 다운'],
    ['dashAttack', '대시 공격 (태클)', '발동 8 · 지속 8 · 후딜 16 · 8 · 다운'],
    ['jumpAttack', '점프 공격 (다이빙 킥)', '발동 6 · 착지까지 · 후딜 12 · 9 · 다운'],
    ['uppercut', '강타 어퍼컷 (V, 맨손)', '발동 14 · 지속 4 · 후딜 22 · 14 · 띄움'],
    ['guard', '가드 (C 홀드)', '정면 180° · 게이지 100 · 잡기에 뚫림'],
    ['stun', '가드 크러시 기절', '90틱 · 무적 없음'],
    ['grab', '잡기', '밀착 1.0m · 정면 60° · 발동 4'],
    ['throw', '던지기', '발동 10 · 후딜 20 · 15 · 방향 선택'],
    ['hit', '피격 경직', '14~20틱 · 뒤로 밀림'],
    ['launched', '띄움 (강타)', '수평 6 · 상승 7 m/s · 공중 추가타 1회'],
    ['down', '다운', '50틱 무적 · 누움'],
    ['getup', '기상 · 구르기', '24틱 무적 · 방향 입력 시 3m 구르기'],
  ];
  const cards = MOVES.map(([pz, name, data], i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;background:${T.panel};border:2px solid ${T.line2};border-radius:12px">
    <div style="width:150px;height:140px;display:flex;align-items:flex-end;justify-content:center;background:${T.bg2};border-radius:10px;overflow:hidden">${svgWrap(figure({ x: 75, y: 128, s: 0.8, pose: pz, shirt: T.slot[i % 8] }), { w: 150, h: 140, vb: '0 0 150 140', extra: 'overflow:hidden' })}</div>
    <div style="font-size:14px;font-weight:800;text-align:center">${name}</div>
    <div style="font-size:11px;color:${T.muted};text-align:center;line-height:1.35">${data}</div>
  </div>`).join('');
  const inner = `
    ${sheetHeader('기본 동작 18 — 상태와 프레임 데이터', '60틱 기준 · 발동 / 지속 / 후딜 / 데미지. 애니메이션은 코드 키프레임(포즈 보간)이라 이 포즈가 곧 3D 리그의 키다.', '동작')}
    <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:12px">${cards}</div>
    <div style="display:flex;flex-direction:row;gap:10px;align-items:center">${p('콤보 입력은 각 타격의 지속 시작~후딜 종료 사이에만 받는다. 3타·강타 뒤에는 대시 캔슬이 없다. 같은 공격자에게 연속 4히트째부터 넉백 ×1.5 (무한 콤보 방지).', { size: 12 })}</div>`;
  return doc({ body: sheet(W, H, inner) });
}
