// 화면 흐름 5장 — 타이틀 · 로비 · 대기실 · 인게임 · 결과 (1280×720)
import { T, doc } from '../tokens.mjs';
import { figure, figureFront, svgWrap } from '../figure.mjs';
import { icon, panel, button, bar, hpColor, key, chip, row, col, h1, p, table, label } from '../ui.mjs';
import { makeCamera, colosseumScene } from '../scene.mjs';

const W = 1280, H = 720;
const screen = (inner, bg = T.bg) => `<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${bg};color:${T.ink}">${inner}</div>`;
const abs = (x, y, inner, extra = '') => `<div style="position:absolute;left:${x}px;top:${y}px;${extra}">${inner}</div>`;

const PLAYERS = [
  { name: '루키', team: 'red', shirt: T.slot[0], hp: 72, ko: 3, me: true },
  { name: '망치왕', team: 'red', shirt: T.slot[3], hp: 88, ko: 5 },
  { name: '봇-1', team: 'red', shirt: T.slot[4], hp: 95, ko: 1, bot: true },
  { name: '봇-2', team: 'red', shirt: T.slot[1], hp: 15, ko: 0, bot: true },
  { name: '핑크곰', team: 'blue', shirt: T.slot[6], hp: 41, ko: 2 },
  { name: '스나이퍼J', team: 'blue', shirt: T.slot[5], hp: 60, ko: 4 },
  { name: '슬라임러버', team: 'blue', shirt: T.slot[2], hp: 100, ko: 2 },
  { name: '봇-3', team: 'blue', shirt: T.slot[7], hp: 77, ko: 1, bot: true },
];
const teamColor = (t) => (t === 'red' ? T.red : T.blue);

function logo(size = 96) {
  const shadow = `text-shadow: ${size * 0.045}px ${size * 0.045}px 0 ${T.outline}, -2px -2px 0 ${T.outline}, 2px -2px 0 ${T.outline}, -2px 2px 0 ${T.outline}, 2px 2px 0 ${T.outline}`;
  return `<div style="display:flex;flex-direction:row;align-items:center;gap:${size * 0.12}px">
    <div class="display" style="font-size:${size}px;line-height:1;color:${T.amp};${shadow}">AMP</div>
    ${icon('bolt', size * 0.9, T.amp, 2.6).replace('fill:none', `fill:${T.amp2}`)}
    <div class="display" style="font-size:${size}px;line-height:1;color:${T.ink};${shadow}">ARENA</div>
  </div>`;
}

function topBar(left, right) {
  return `<div style="position:absolute;left:0;top:0;width:${W}px;height:56px;display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:0 20px;background:${T.bg2};border-bottom:2px solid ${T.line}">
    <div style="display:flex;flex-direction:row;align-items:center;gap:18px">${left}</div>
    <div style="display:flex;flex-direction:row;align-items:center;gap:12px">${right}</div>
  </div>`;
}

/* ---------------- 타이틀 ---------------- */
export function titleBoard() {
  const grid = [];
  for (let i = -10; i <= 10; i++) grid.push(`<line x1="${640 + i * 40}" y1="420" x2="${640 + i * 260}" y2="${H}" style="stroke:${T.line};stroke-width:1.5px;opacity:0.55"></line>`);
  for (const y of [440, 470, 510, 565, 640]) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" style="stroke:${T.line};stroke-width:1.5px;opacity:0.55"></line>`);
  const bg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;left:0;top:0" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" style="fill:${T.bg}"></rect>
    <rect x="0" y="420" width="${W}" height="${H - 420}" style="fill:${T.bg2}"></rect>
    <ellipse cx="640" cy="230" rx="420" ry="150" style="fill:${T.amp};opacity:0.08"></ellipse>
    ${grid.join('')}
    <line x1="0" y1="420" x2="${W}" y2="420" style="stroke:${T.amp2};stroke-width:3px;opacity:0.8"></line>
  </svg>`;
  const heroL = svgWrap(figure({ x: 170, y: 290, s: 2.4, pose: 'swing', acc: 'greatsword', shirt: T.slot[0] }), { w: 380, h: 320, vb: '0 0 380 320' });
  const heroR = svgWrap(figure({ x: 230, y: 290, s: 2.4, pose: 'thrust', acc: 'rocket', facing: -1, shirt: T.slot[1] }), { w: 380, h: 320, vb: '0 0 380 320' });
  const form = panel(col([
    label('닉네임'),
    row([
      `<div style="flex:1;height:48px;display:flex;align-items:center;padding:0 14px;background:${T.bg2};border:2px solid ${T.line2};border-radius:10px;font-size:16px;color:${T.dim}">2~10자, 이 세션에서만 사용</div>`,
      button('입장', { w: 140, h: 48, size: 18, iconName: 'door2' }),
    ], { gap: 10 }),
    p('계정 없이 바로 시작합니다. 방에서 악세서리를 고르고 8인 매치에 들어갑니다.', { size: 12 }),
  ], { gap: 10 }), { w: 460, pad: 18 });
  const body = `
    ${bg}
    ${abs(40, 400, heroL)}
    ${abs(860, 400, heroR)}
    ${abs(0, 96, `<div style="width:${W}px;display:flex;flex-direction:column;align-items:center;gap:14px">${logo(120)}
      <div style="font-size:20px;font-weight:700;color:${T.muted};letter-spacing:0.08em">8인 실시간 대전 액션 · 브라우저에서 바로</div></div>`)}
    ${abs(410, 300, form)}
    ${abs(24, 672, chip('시안 v0.1 · 2026-09-10', { color: T.panel3, fg: T.muted }))}
    ${abs(960, 668, row([icon('keyboard', 22, T.muted), p('키보드', { size: 13 }), icon('gamepad', 22, T.muted), p('게임패드', { size: 13 }), icon('mouse', 22, T.muted), p('우클릭 카메라', { size: 13 })], { gap: 8 }))}
  `;
  return doc({ body: screen(body) });
}

/* ---------------- 로비 ---------------- */
export function lobbyBoard() {
  const rooms = [
    ['0412', '3분 데스매치 (봇 채움)', '팀 데스매치', '콜로세움', '5 / 8', '대기중', false, true],
    ['0409', '초보만 오세요', '개인 서바이벌', '콜로세움', '3 / 8', '대기중', false, false],
    ['0407', '링아웃 파티', '개인 데스매치', '스카이독', '8 / 8', '게임중', false, false],
    ['0405', '대검 금지', '개인 서바이벌', '콜로세움', '6 / 8', '대기중', true, false],
    ['0403', '팀전 4:4 급구', '팀 데스매치', '스카이독', '7 / 8', '대기중', false, false],
    ['0401', '고수방', '개인 데스매치', '콜로세움', '4 / 8', '게임중', true, false],
    ['0398', '누구나 환영', '개인 서바이벌', '스카이독', '2 / 8', '대기중', false, false],
    ['0395', '5분 장기전', '팀 데스매치', '콜로세움', '8 / 8', '게임중', false, false],
    ['0391', '친목 사절 빡겜', '개인 데스매치', '콜로세움', '1 / 8', '대기중', false, false],
  ];
  const roomRows = rooms.map(([no, name, mode, map, cnt, status, locked, selected]) => `
    <div style="display:grid;grid-template-columns:70px 1fr 130px 110px 70px 80px;gap:8px;align-items:center;height:38px;padding:0 12px;border-radius:8px;background:${selected ? T.panel3 : 'transparent'};border:2px solid ${selected ? T.amp : 'transparent'}">
      <div class="num" style="font-size:13px;color:${T.dim}">#${no}</div>
      <div style="display:flex;flex-direction:row;align-items:center;gap:8px;font-size:14px;font-weight:700">${locked ? icon('lock', 16, T.amp) : ''}<span>${name}</span></div>
      <div style="font-size:12px;color:${T.muted}">${mode}</div>
      <div style="font-size:12px;color:${T.muted}">${map}</div>
      <div class="num" style="font-size:13px;font-weight:700">${cnt}</div>
      ${chip(status, { color: status === '게임중' ? T.red : T.green, fg: T.outline, size: 11 })}
    </div>`).join('');
  const roomsPanel = panel(col([
    row([
      label('방 목록 · 자유 1 채널', { size: 12 }),
      row([chip('대기중 6', { color: T.panel3, fg: T.green }), chip('게임중 3', { color: T.panel3, fg: T.red })], { gap: 6 }),
    ], { justify: 'space-between' }),
    `<div style="display:grid;grid-template-columns:70px 1fr 130px 110px 70px 80px;gap:8px;padding:0 12px;font-size:11px;color:${T.dim};font-weight:700"><div>번호</div><div>방 이름</div><div>모드</div><div>맵</div><div>인원</div><div>상태</div></div>`,
    `<div style="display:flex;flex-direction:column;gap:2px">${roomRows}</div>`,
    row([p('1 / 3 페이지', { size: 12 }), row([button('이전', { kind: 'secondary', h: 32, size: 12 }), button('다음', { kind: 'secondary', h: 32, size: 12 })], { gap: 6 })], { justify: 'space-between' }),
  ], { gap: 10 }), { h: 468, pad: 14 });

  const chatLines = [
    ['핑크곰', '팀전 4:4 사람 구해요 0403', T.pink],
    ['망치왕', '대검 금지방은 왜 있는 거임', T.amp],
    ['슬라임러버', '스카이독 링아웃 개꿀잼', T.green],
    ['시스템', '0412 방이 만들어졌습니다.', T.dim],
  ].map(([n, m, c]) => `<div style="font-size:13px"><span style="color:${c};font-weight:700">${n}</span><span style="color:${T.muted}"> : </span><span>${m}</span></div>`).join('');
  const chatPanel = panel(col([
    `<div style="display:flex;flex-direction:column;gap:4px;flex:1">${chatLines}</div>`,
    row([`<div style="flex:1;height:36px;display:flex;align-items:center;padding:0 12px;background:${T.bg2};border:2px solid ${T.line2};border-radius:8px;font-size:13px;color:${T.dim}">채널 대화 입력 · Enter</div>`, button('보내기', { kind: 'secondary', h: 36, size: 13 })], { gap: 8 }),
  ], { gap: 8, extra: 'height:100%' }), { h: 146, pad: 12 });

  const me = panel(col([
    `<div style="display:flex;flex-direction:row;align-items:center;justify-content:center">${svgWrap(figureFront({ x: 60, y: 118, s: 0.9 }), { w: 120, h: 124, vb: '0 0 120 124' })}</div>`,
    `<div style="text-align:center"><div class="display" style="font-size:24px">루키</div><div style="font-size:12px;color:${T.muted}">Lv.7 · 12전 7승</div></div>`,
    row([chip('맨손 선호', { color: T.panel3, fg: T.amp }), chip('KO 41', { color: T.panel3, fg: T.ink })], { justify: 'center', gap: 6 }),
    button('방 만들기', { w: '100%', h: 46, size: 16, iconName: 'plus' }),
    button('빠른 입장', { kind: 'secondary', w: '100%', h: 40, size: 14, iconName: 'bolt' }),
    button('새로고침', { kind: 'ghost', w: '100%', h: 36, size: 13, iconName: 'refresh' }),
  ], { gap: 10 }), { h: 630, pad: 14 });

  const users = ['망치왕 Lv.21', '핑크곰 Lv.14', '스나이퍼J Lv.19', '슬라임러버 Lv.9', '초보탈출 Lv.2', '으르렁 Lv.11', 'Kim_D Lv.30', '루키 Lv.7', '하얀곰 Lv.5', '대검성애자 Lv.16', '나무상자 Lv.3', '롤백왕 Lv.8'];
  const usersPanel = panel(col([
    row([label('접속자 132'), icon('users', 18, T.muted)], { justify: 'space-between' }),
    `<div style="display:flex;flex-direction:column;gap:6px">${users.map((u, i) => `<div style="display:flex;flex-direction:row;align-items:center;gap:8px;font-size:13px"><div style="width:8px;height:8px;border-radius:4px;background:${i % 3 === 1 ? T.red : T.green};flex:none"></div><span style="${u.startsWith('루키') ? `color:${T.amp};font-weight:800` : ''}">${u}</span></div>`).join('')}</div>`,
    p('초록 대기 · 빨강 게임중', { size: 11 }),
  ], { gap: 10 }), { h: 630, pad: 14 });

  const tabs = ['초보 1', '자유 1', '자유 2', '팀전'].map((t, i) => `<div style="height:34px;display:flex;align-items:center;padding:0 14px;border-radius:8px;font-weight:800;font-size:14px;background:${i === 1 ? T.amp : 'transparent'};color:${i === 1 ? T.outline : T.muted}">${t}</div>`).join('');
  const body = `
    ${topBar(`${logo(30)}<div style="display:flex;flex-direction:row;gap:4px">${tabs}</div>`, `${chip('접속 132', { color: T.panel3, fg: T.ink })}${chip('루키 Lv.7', { color: T.amp })}${icon('settings', 22, T.muted)}`)}
    <div style="position:absolute;left:20px;top:70px;width:${W - 40}px;display:grid;grid-template-columns:220px minmax(0, 1fr) 240px;gap:16px">
      ${me}
      <div style="display:flex;flex-direction:column;gap:16px">${roomsPanel}${chatPanel}</div>
      ${usersPanel}
    </div>`;
  return doc({ body: screen(body) });
}

/* ---------------- 대기실 ---------------- */
export function roomBoard() {
  const slots = PLAYERS.map((pl, i) => {
    const empty = false;
    const status = pl.me ? chip('방장', { color: T.amp }) : pl.bot ? chip('봇', { color: T.panel3, fg: T.muted }) : i === 6 ? chip('대기', { color: T.panel3, fg: T.muted }) : chip('준비', { color: T.green, fg: T.outline });
    return `<div style="position:relative;height:232px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;background:${T.panel};border:2px solid ${teamColor(pl.team)};border-radius:12px;box-shadow:0 4px 0 ${T.bg2}">
      <div style="position:absolute;left:10px;top:8px;font-size:11px;font-weight:800;color:${teamColor(pl.team)}">${pl.team === 'red' ? '레드' : '블루'} ${i % 4 + 1}</div>
      ${pl.me ? `<div style="position:absolute;right:8px;top:6px">${icon('crown', 18, T.amp, 2.4)}</div>` : ''}
      ${svgWrap(figureFront({ x: 52, y: 100, s: 0.72, shirt: pl.shirt, faceKind: pl.bot ? 'calm' : 'calm' }), { w: 104, h: 104, vb: '0 0 104 104' })}
      <div style="font-size:14px;font-weight:800;${pl.me ? `color:${T.amp}` : ''}">${pl.name}</div>
      ${status}
    </div>`;
  });
  // 슬롯 하나는 빈 자리로 바꾼다 (봇-3 자리)
  slots[7] = `<div style="height:232px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:transparent;border:2px dashed ${T.line2};border-radius:12px;color:${T.dim}">
    ${icon('plus', 28, T.dim)}<div style="font-size:13px;font-weight:700">빈 자리 · 봇으로 채움</div></div>`;
  const slotGrid = `<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:12px">${slots.join('')}</div>`;

  const mapThumb = `<svg viewBox="0 0 120 120" width="120" height="120" style="display:block" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="54" style="fill:#d2b98b;stroke:${T.outline};stroke-width:3px"></circle>
    <circle cx="60" cy="60" r="30" style="fill:none;stroke:rgba(60,40,20,0.25);stroke-width:2px"></circle>
    ${[[-22, -22], [22, -22], [-22, 22], [22, 22]].map(([x, y]) => `<circle cx="${60 + x}" cy="${60 + y}" r="5" style="fill:#b3aa9c;stroke:${T.outline};stroke-width:2px"></circle>`).join('')}
    <rect x="52" y="14" width="16" height="16" style="fill:#c9bfae;stroke:${T.outline};stroke-width:2px"></rect>
    <rect x="52" y="90" width="16" height="16" style="fill:#c9bfae;stroke:${T.outline};stroke-width:2px"></rect>
  </svg>`;
  const setting = (k, v) => row([p(k, { size: 12 }), `<div style="font-size:13px;font-weight:800">${v}</div>`], { justify: 'space-between' });
  const settings = panel(col([
    row([label('매치 설정'), chip('방장만 변경', { color: T.panel3, fg: T.muted, size: 11 })], { justify: 'space-between' }),
    row([mapThumb, col([
      `<div class="display" style="font-size:20px">콜로세움</div>`,
      p('벽 있음 · 낙사 없음 · 40m', { size: 12 }),
      button('맵 변경', { kind: 'secondary', h: 32, size: 12, iconName: 'map' }),
    ], { gap: 6 })], { gap: 12, align: 'flex-start' }),
    `<div style="height:2px;background:${T.line}"></div>`,
    setting('모드', '팀 데스매치'),
    setting('시간', '3분'),
    setting('최대 인원', '8명'),
    setting('빈 자리', '봇으로 채움'),
    setting('비밀번호', '없음'),
  ], { gap: 10 }), { h: 'auto', pad: 14 });

  const ACC = [
    ['fist', '맨손', 'uppercut', null],
    ['sword', '브레이커', 'swing', 'greatsword'],
    ['spear', '스파이크', 'thrust', 'spear'],
    ['pistol', '더블탭', 'shoot', 'pistol'],
    ['shield', '월', 'bash', 'shield'],
    ['glove', '부스터', 'thrust', 'rocket'],
  ];
  const accCards = ACC.map(([ic, name], i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;background:${i === 5 ? T.amp : T.panel2};color:${i === 5 ? T.outline : T.ink};border:2px solid ${i === 5 ? T.amp : T.line2};border-radius:10px">${icon(ic, 30, i === 5 ? T.outline : T.amp, 2.2)}<div style="font-size:12px;font-weight:800">${name}</div></div>`).join('');
  const accPanel = panel(col([
    row([label('악세서리'), chip('매치 중 교체 불가', { color: T.panel3, fg: T.muted, size: 11 })], { justify: 'space-between' }),
    `<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px">${accCards}</div>`,
    `<div style="display:flex;flex-direction:row;gap:12px;align-items:center;padding:10px;background:${T.bg2};border-radius:10px">
      ${svgWrap(figure({ x: 46, y: 96, s: 0.78, pose: 'thrust', acc: 'rocket', shirt: T.slot[0] }), { w: 100, h: 100, vb: '0 0 100 100' })}
      <div style="display:flex;flex-direction:column;gap:4px;min-width:0"><div class="display" style="font-size:18px;color:${T.amp};white-space:nowrap">부스터</div>
      ${p('로켓 글러브 · 펀치 리치 +0.4m · 기술 V: 로켓 펀치 발사(10m, 16, 다운) · 공중 대시 1회 · 쿨다운 5초', { size: 12, color: T.ink })}</div>
    </div>`,
  ], { gap: 10 }), { h: 'auto', pad: 14 });

  const chatLines = [['망치왕', '준비 눌러주세요'], ['핑크곰', '방패 들고 갑니다 ㅋ'], ['시스템', '봇-2 가 레드 팀에 들어왔습니다.']]
    .map(([n, m]) => `<div style="font-size:13px"><span style="color:${n === '시스템' ? T.dim : T.amp};font-weight:700">${n}</span><span style="color:${T.muted}"> : </span><span>${m}</span></div>`).join('');
  const bottom = `<div style="position:absolute;left:20px;top:${H - 20 - 118}px;width:${W - 40}px;height:118px;display:flex;flex-direction:row;gap:16px">
    ${panel(col([`<div style="display:flex;flex-direction:column;gap:3px">${chatLines}</div>`, `<div style="height:32px;display:flex;align-items:center;padding:0 12px;background:${T.bg2};border:2px solid ${T.line2};border-radius:8px;font-size:13px;color:${T.dim}">대기실 대화 · Enter</div>`], { gap: 6 }), { w: 700, h: 118, pad: 12 })}
    <div style="flex:1;display:flex;flex-direction:row;gap:12px;align-items:stretch">
      ${button('팀 바꾸기', { kind: 'secondary', w: 150, h: 118, size: 15, iconName: 'refresh' })}
      ${button('게임 시작 · 7/8 준비', { w: '100%', h: 118, size: 22, iconName: 'bolt' })}
    </div>
  </div>`;
  const body = `
    ${topBar(`${logo(30)}<div style="font-size:16px;font-weight:800">3분 데스매치 (봇 채움)</div><div class="num" style="font-size:13px;color:${T.dim}">#0412</div>${chip('팀 데스매치 · 콜로세움 · 3분', { color: T.panel3, fg: T.ink })}`,
      `${chip('레드 4 : 3 블루', { color: T.panel3, fg: T.ink })}${button('나가기', { kind: 'ghost', h: 34, size: 13, iconName: 'door2' })}`)}
    <div style="position:absolute;left:20px;top:70px;width:${W - 40}px;display:grid;grid-template-columns:700px minmax(0, 1fr);gap:16px">
      ${col([slotGrid], { gap: 10 })}
      <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px">${settings}${accPanel}</div>
    </div>
    ${bottom}`;
  return doc({ body: screen(body) });
}

/* ---------------- 인게임 ---------------- */
export function ingameBoard() {
  const cam = makeCamera();
  const byName = Object.fromEntries(PLAYERS.map((pl) => [pl.name, pl]));
  const chars = [
    { ...byName['루키'], x: -0.8, z: -10.5, pose: 'thrust', acc: 'rocket', facing: 1 },
    { ...byName['핑크곰'], x: 1.9, z: -9.6, pose: 'hit', facing: -1 },
    { ...byName['망치왕'], x: -7, z: -2, pose: 'swing', acc: 'greatsword', facing: 1 },
    { ...byName['스나이퍼J'], x: -4.4, z: -1.6, pose: 'guard', acc: 'pistol', facing: -1 },
    { ...byName['슬라임러버'], x: 5, z: -3.5, y: 1.2, pose: 'jumpAttack', facing: -1 },
    { ...byName['봇-1'], x: 3, z: 6, pose: 'run', acc: 'spear', facing: -1 },
    { ...byName['봇-2'], x: 10, z: 1, pose: 'down', facing: 1 },
    { ...byName['봇-3'], x: -11.5, z: 4, pose: 'walk', acc: 'shield', facing: 1 },
  ];
  const { svg, plates } = colosseumScene({
    cam, chars,
    crates: [{ x: -5, z: -7 }, { x: 6, z: 4 }, { x: -13, z: -2 }],
    hearts: [{ x: 11.5, z: -6 }],
    hit: { x: 0.6, z: -10.1, y: 1.05 },
  });
  const plateHtml = plates.map((pl) => {
    const w = pl.k > 30 ? 84 : 64, fs = pl.k > 30 ? 12 : 10;
    return `<div style="position:absolute;left:${Math.round(pl.sx - w / 2)}px;top:${Math.round(pl.sy - 26)}px;width:${w}px;display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:${fs}px;font-weight:800;color:${pl.me ? T.amp : T.ink};text-shadow:0 1px 0 ${T.outline},1px 0 0 ${T.outline},-1px 0 0 ${T.outline},0 -1px 0 ${T.outline};white-space:nowrap">${pl.name}</div>
      <div style="width:${w - 12}px;height:7px;background:${T.bg2};border:2px solid ${teamColor(pl.team)};border-radius:4px;overflow:hidden"><div style="width:${pl.hp}%;height:100%;background:${hpColor(pl.hp)}"></div></div>
    </div>`;
  }).join('');

  const hitPt = cam.project(0.6, -10.1, 1.05);
  const dmg = abs(hitPt.sx + 44, hitPt.sy - 36, `<div class="display" style="font-size:44px;line-height:1;color:${T.amp};text-shadow:3px 3px 0 ${T.outline},-2px -2px 0 ${T.outline},2px -2px 0 ${T.outline},-2px 2px 0 ${T.outline}">12</div>
    <div class="display" style="font-size:18px;color:${T.ink};text-shadow:2px 2px 0 ${T.outline},-1px -1px 0 ${T.outline}">COMBO 3</div>`);

  const myPlate = abs(20, 16, panel(col([
    row([`<div class="display" style="font-size:24px;color:${T.amp}">루키</div>`, chip('레드', { color: T.red, fg: T.ink, size: 11 }), `<div class="num" style="font-size:13px;color:${T.muted}">HP 72 / 100</div>`], { gap: 8 }),
    bar(72, { w: 268, h: 18, color: T.green }),
    row([p('가드', { size: 11 }), bar(100, { w: 200, h: 8, color: T.cyan }), `<div class="num" style="font-size:11px;color:${T.muted}">100</div>`], { gap: 8 }),
    row([icon('glove', 18, T.amp), `<div style="font-size:13px;font-weight:800">부스터</div>`, chip('로켓 펀치 준비됨', { color: T.green, fg: T.outline, size: 11 })], { gap: 8 }),
  ], { gap: 8 }), { pad: 12, bg: 'rgba(28,35,66,0.92)' }));

  const timer = abs(0, 14, `<div style="width:${W}px;display:flex;flex-direction:column;align-items:center;gap:6px">
    <div style="display:flex;flex-direction:row;align-items:center;gap:14px;padding:6px 18px;background:rgba(12,17,36,0.9);border:2px solid ${T.line2};border-radius:14px">
      <div style="display:flex;flex-direction:row;align-items:center;gap:6px"><div class="display" style="font-size:22px;color:${T.red}">레드</div><div class="display num" style="font-size:30px;color:${T.ink}">7</div></div>
      <div class="display num" style="font-size:40px;line-height:1;color:${T.amp}">2:41</div>
      <div style="display:flex;flex-direction:row;align-items:center;gap:6px"><div class="display num" style="font-size:30px;color:${T.ink}">5</div><div class="display" style="font-size:22px;color:${T.blue}">블루</div></div>
    </div>
    ${chip('팀 데스매치 · 콜로세움', { color: T.panel3, fg: T.muted, size: 11 })}
  </div>`);

  const list = PLAYERS.map((pl) => `<div style="display:grid;grid-template-columns:8px 92px 60px 24px;gap:8px;align-items:center;height:22px;padding:0 6px;border-radius:6px;background:${pl.me ? T.panel3 : 'transparent'}">
    <div style="width:8px;height:14px;border-radius:2px;background:${teamColor(pl.team)}"></div>
    <div style="font-size:12px;font-weight:${pl.me ? 800 : 600};color:${pl.me ? T.amp : pl.hp === 0 ? T.dim : T.ink};white-space:nowrap;overflow:hidden">${pl.name}</div>
    ${bar(pl.hp, { w: 60, h: 8, color: hpColor(pl.hp), radius: 4 })}
    <div class="num" style="font-size:12px;font-weight:800;text-align:right">${pl.ko}</div>
  </div>`).join('');
  const roster = abs(W - 20 - 232, 16, panel(col([
    `<div style="display:grid;grid-template-columns:8px 92px 60px 24px;gap:8px;padding:0 6px;font-size:10px;color:${T.dim};font-weight:700"><div></div><div>이름</div><div>HP</div><div>KO</div></div>`,
    `<div style="display:flex;flex-direction:column;gap:2px">${list}</div>`,
  ], { gap: 6 }), { pad: 10, bg: 'rgba(28,35,66,0.92)' }));

  const skill = abs(W - 20 - 232, H - 20 - 96, panel(row([
    `<div style="position:relative;width:64px;height:64px;flex:none">
      <svg viewBox="0 0 64 64" width="64" height="64" style="display:block" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="27" style="fill:${T.bg2};stroke:${T.line2};stroke-width:4px"></circle><circle cx="32" cy="32" r="27" style="fill:none;stroke:${T.green};stroke-width:4px;stroke-dasharray:170 170;transform:rotate(-90deg);transform-origin:32px 32px"></circle></svg>
      <div style="position:absolute;left:0;top:0;width:64px;height:64px;display:flex;align-items:center;justify-content:center">${icon('glove', 30, T.amp, 2.2)}</div>
      <div style="position:absolute;left:-6px;top:-6px">${key('V', { w: 26, h: 26, size: 12 })}</div>
    </div>`,
    col([`<div style="font-size:14px;font-weight:800">로켓 펀치</div>`, chip('준비됨', { color: T.green, fg: T.outline, size: 11 }), row([p('공중 대시', { size: 11 }), `<div class="num" style="font-size:12px;font-weight:800">1 / 1</div>`], { gap: 6 })], { gap: 4 }),
  ], { gap: 12 }), { pad: 12, bg: 'rgba(28,35,66,0.92)' }));

  const feed = abs(20, H - 20 - 96, panel(col([
    `<div style="font-size:12px"><span style="color:${T.amp};font-weight:800">망치왕</span><span style="color:${T.muted}"> 이 </span><span style="color:${T.ink};font-weight:700">봇-2</span><span style="color:${T.muted}"> 을 KO</span></div>`,
    `<div style="font-size:12px"><span style="color:${T.pink};font-weight:800">핑크곰</span><span style="color:${T.muted}"> : 낙사 조심 ㅋㅋ</span></div>`,
    `<div style="font-size:12px"><span style="color:${T.slot[7]};font-weight:800">봇-3</span><span style="color:${T.muted}"> 이 </span><span style="color:${T.ink};font-weight:700">스나이퍼J</span><span style="color:${T.muted}"> 을 KO</span></div>`,
    row([key('Enter', { w: 48, h: 22, size: 11 }), p('채팅', { size: 11 })], { gap: 6 }),
  ], { gap: 4 }), { w: 300, pad: 10, bg: 'rgba(28,35,66,0.85)' }));

  const hints = abs(0, H - 40, `<div style="width:${W}px;display:flex;flex-direction:row;justify-content:center;gap:14px;opacity:0.9">
    ${[['Z', '공격'], ['X', '점프'], ['C', '가드'], ['V', '기술'], ['F', '줍기'], ['Q E', '카메라']].map(([k, l]) => row([key(k, { w: 26, h: 24, size: 11 }), `<div style="font-size:12px;font-weight:700;color:${T.ink};text-shadow:0 1px 0 ${T.outline}">${l}</div>`], { gap: 5 })).join('')}
  </div>`);

  const body = `${svg}${plateHtml}${dmg}${myPlate}${timer}${roster}${skill}${feed}${hints}`;
  return doc({ body: screen(body) });
}

/* ---------------- 결과 ---------------- */
export function resultBoard() {
  const ranked = [
    ['1', 'red', '망치왕', 5, 1, 412, true],
    ['2', 'blue', '스나이퍼J', 4, 2, 366, false],
    ['3', 'red', '루키', 3, 2, 298, true],
    ['4', 'blue', '핑크곰', 2, 3, 240, false],
    ['5', 'blue', '슬라임러버', 2, 3, 201, false],
    ['6', 'red', '봇-1', 1, 2, 150, true],
    ['7', 'blue', '봇-3', 1, 4, 96, false],
    ['8', 'red', '봇-2', 0, 4, 44, true],
  ];
  const rows = ranked.map(([r, team, name, ko, d, dmg, win]) => `<div style="display:grid;grid-template-columns:44px 56px 1fr 60px 60px 90px 70px;gap:8px;align-items:center;height:42px;padding:0 12px;border-radius:8px;background:${name === '루키' ? T.panel3 : 'transparent'};border:2px solid ${name === '루키' ? T.amp : 'transparent'}">
    <div class="display num" style="font-size:22px;color:${r === '1' ? T.amp : T.muted}">${r}</div>
    ${chip(team === 'red' ? '레드' : '블루', { color: teamColor(team), fg: T.ink, size: 11 })}
    <div style="font-size:15px;font-weight:800;${name === '루키' ? `color:${T.amp}` : ''}">${name}${r === '1' ? ` <span style="color:${T.amp};font-size:11px">MVP</span>` : ''}</div>
    <div class="num" style="font-size:14px;font-weight:800">${ko}</div>
    <div class="num" style="font-size:14px;color:${T.muted}">${d}</div>
    <div class="num" style="font-size:14px;color:${T.muted}">${dmg}</div>
    <div style="font-size:12px;font-weight:800;color:${win ? T.green : T.dim}">${win ? '승리' : '패배'}</div>
  </div>`).join('');
  const tablePanel = panel(col([
    `<div style="display:grid;grid-template-columns:44px 56px 1fr 60px 60px 90px 70px;gap:8px;padding:0 12px;font-size:11px;color:${T.dim};font-weight:700"><div>순위</div><div>팀</div><div>닉네임</div><div>KO</div><div>데스</div><div>준 데미지</div><div>결과</div></div>`,
    `<div style="display:flex;flex-direction:column;gap:2px">${rows}</div>`,
  ], { gap: 8 }), { pad: 14 });

  const mvp = panel(col([
    label('MVP'),
    `<div style="display:flex;justify-content:center">${svgWrap(figureFront({ x: 110, y: 200, s: 1.55, shirt: T.slot[3], armsUp: true }), { w: 220, h: 210, vb: '0 0 220 210' })}</div>`,
    `<div style="text-align:center"><div class="display" style="font-size:30px;color:${T.amp}">망치왕</div><div style="font-size:13px;color:${T.muted}">5 KO · 412 데미지 · 브레이커</div></div>`,
    row([chip('연속 KO 3', { color: T.panel3, fg: T.amp }), chip('링아웃 1', { color: T.panel3, fg: T.cyan })], { justify: 'center', gap: 6 }),
  ], { gap: 10 }), { w: 300, pad: 16 });

  const body = `
    ${topBar(`${logo(30)}<div style="font-size:16px;font-weight:800">매치 결과</div>${chip('팀 데스매치 · 콜로세움 · 3:00', { color: T.panel3, fg: T.ink })}`, `${chip('#0412', { color: T.panel3, fg: T.muted })}`)}
    ${abs(0, 76, `<div style="width:${W}px;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="display:flex;flex-direction:row;align-items:center;gap:20px">
        <div class="display" style="font-size:48px;color:${T.red}">레드 팀 승리</div>
        <div class="display num" style="font-size:56px;color:${T.ink}">12 : 9</div>
      </div></div>`)}
    <div style="position:absolute;left:20px;top:160px;width:${W - 40}px;display:grid;grid-template-columns:300px minmax(0, 1fr);gap:16px;align-items:start">${mvp}${tablePanel}</div>
    ${abs(20, H - 20 - 56, `<div style="width:${W - 40}px;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:16px">
      <div style="display:flex;flex-direction:row;align-items:center;gap:12px">${p('10초 후 대기실로 돌아갑니다', { size: 13 })}${bar(62, { w: 220, h: 10, color: T.amp })}</div>
      <div style="display:flex;flex-direction:row;gap:10px">${button('방 나가기', { kind: 'ghost', h: 44, size: 14, iconName: 'door2' })}${button('대기실로', { h: 44, size: 15, iconName: 'arrowRight' })}</div>
    </div>`)}`;
  return doc({ body: screen(body) });
}
