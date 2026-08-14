// HUD 및 화면 오버레이. 월드 버퍼와 달리 네이티브 해상도로 그려 한글이 또렷하다.

import { clamp, rgba, lerp, VW, VH } from './core.js';
import { COMMAND_LIST } from './moves.js';
import { CHARS } from './chars.js';

export const FONT_H = '"Galmuri14", "Galmuri11", system-ui, sans-serif';
export const FONT_B = '"Galmuri11", "Galmuri14", system-ui, sans-serif';

const st = { hpTrail: 1, bossTrail: 1, comboPop: 0, lastCombo: 0 };

function panel(ctx, x, y, w, h, a = 0.72) {
  ctx.fillStyle = `rgba(12,10,20,${a})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(220,200,160,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function text(ctx, s, x, y, size, color, font = FONT_B, align = 'left', outline = '#100c18', ow = 3) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  if (ow) {
    ctx.fillStyle = outline;
    for (let dx = -ow; dx <= ow; dx += ow) for (let dy = -ow; dy <= ow; dy += ow) {
      if (dx || dy) ctx.fillText(s, x + dx, y + dy);
    }
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

function bar(ctx, x, y, w, h, v, trail, cols) {
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#2a2334';
  ctx.fillRect(x, y, w, h);
  if (trail > v) {
    ctx.fillStyle = '#c8402a';
    ctx.fillRect(x, y, w * trail, h);
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * v, h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y + 1, w * v, Math.max(1, h * 0.22));
  ctx.strokeStyle = 'rgba(230,215,180,0.65)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
}

export function drawHud(ctx, g, S, W, H) {
  const p = g.player;
  if (!p) return;
  const u = (v) => v * S;

  // 체력
  const hv = clamp(p.hp / p.maxHp, 0, 1);
  st.hpTrail = st.hpTrail > hv ? Math.max(hv, st.hpTrail - 0.012) : hv;
  panel(ctx, u(6), u(5), u(174), u(38), 0.6);
  text(ctx, CHARS.hero.name, u(12), u(19), u(11), '#f2e6c8', FONT_H, 'left', '#120e1a', 2);
  bar(ctx, u(12), u(23), u(120), u(9), hv, st.hpTrail, ['#7ef07a', '#3ec84a', '#1f8a34']);
  text(ctx, `${Math.max(0, Math.ceil(p.hp))}`, u(138), u(32), u(11), '#e8f6e0', FONT_B, 'left', '#120e1a', 2);
  // 잔기
  for (let i = 0; i < Math.min(p.lives, 5); i++) {
    const lx = u(60 + i * 11), ly = u(13);
    ctx.fillStyle = '#e04a6a';
    ctx.beginPath();
    ctx.arc(lx - u(2.4), ly - u(1.4), u(2.6), 0, 6.284);
    ctx.arc(lx + u(2.4), ly - u(1.4), u(2.6), 0, 6.284);
    ctx.moveTo(lx - u(5), ly); ctx.lineTo(lx, ly + u(5.4)); ctx.lineTo(lx + u(5), ly);
    ctx.fill();
  }
  if (p.lives > 5) text(ctx, `x${p.lives}`, u(122), u(18), u(10), '#ffc0d0', FONT_B, 'left', '#120e1a', 2);

  // 기 게이지 3칸
  const seg = 3;
  for (let i = 0; i < seg; i++) {
    const mx = u(12 + i * 56), my = u(35);
    const fill = clamp((p.meter - i * 100) / 100, 0, 1);
    ctx.fillStyle = '#0d0a14'; ctx.fillRect(mx - u(1.5), my - u(1.5), u(53), u(8));
    ctx.fillStyle = '#241c30'; ctx.fillRect(mx, my, u(50), u(5));
    if (fill > 0) {
      const g2 = ctx.createLinearGradient(0, my, 0, my + u(5));
      const full = fill >= 1;
      g2.addColorStop(0, full ? '#fff0a0' : '#9fd8ff');
      g2.addColorStop(0.5, full ? '#ffb43c' : '#3f9ce8');
      g2.addColorStop(1, full ? '#e0602c' : '#1f5aa8');
      ctx.fillStyle = g2;
      ctx.fillRect(mx, my, u(50) * fill, u(5));
    }
    ctx.strokeStyle = 'rgba(220,205,170,0.55)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(mx - u(0.5), my - u(0.5), u(51), u(6));
  }
  if (p.meter >= 300) {
    const bl = 0.5 + Math.sin(g.tick * 0.2) * 0.5;
    text(ctx, 'MAX', u(172), u(41), u(10), `rgba(255,220,120,${0.5 + bl * 0.5})`, FONT_H, 'left', '#120e1a', 2);
  }
  if (p.weapon) {
    text(ctx, `무기: ${p.weapon.kind === 'pipe' ? '쇠파이프' : p.weapon.kind === 'wrench' ? '대형 렌치' : '설검'} (${p.weapon.uses})`,
      u(12), u(52), u(9), '#ffe0a0', FONT_B, 'left', '#120e1a', 2);
  }

  // 점수 / 스테이지
  text(ctx, `SCORE ${String(g.score).padStart(7, '0')}`, W - u(8), u(18), u(11), '#ffe9a8', FONT_H, 'right', '#120e1a', 2);
  const stg = g.stage;
  text(ctx, `${g.room ? g.room.def.name : `${stg.name} · ${g.sec.hint || ''}`}`, W - u(8), u(33), u(9), '#cfd6e4', FONT_B, 'right', '#120e1a', 2);
  if (g.hidden.scrolls > 0) {
    text(ctx, `두루마리 ${g.hidden.scrolls}/3`, W - u(8), u(46), u(9), '#e8dcc0', FONT_B, 'right', '#120e1a', 2);
  }

  // 보스 체력
  if (g.boss && !g.boss.removed) {
    const b = g.boss;
    const bv = clamp(b.hp / b.maxHp, 0, 1);
    st.bossTrail = st.bossTrail > bv ? Math.max(bv, st.bossTrail - 0.008) : bv;
    const bw = u(240);
    const bx = (W - bw) / 2;
    text(ctx, b.def.name, W / 2, H - u(30), u(12), '#ffd0c0', FONT_H, 'center', '#120e1a', 2);
    bar(ctx, bx, H - u(24), bw, u(10), bv, st.bossTrail, ['#ff9a7a', '#e0402a', '#8a1a12']);
  } else st.bossTrail = 1;

  // 콤보
  if (g.combo >= 2) {
    if (g.combo !== st.lastCombo) { st.comboPop = 1; st.lastCombo = g.combo; }
    st.comboPop = Math.max(0, st.comboPop - 0.08);
    const sc = 1 + st.comboPop * 0.35;
    const cy = u(96);
    ctx.save();
    ctx.translate(u(24), cy);
    ctx.scale(sc, sc);
    const hot = g.combo >= 20 ? '#ff8a4a' : g.combo >= 10 ? '#ffd04a' : '#ffffff';
    text(ctx, String(g.combo), 0, 0, u(30), hot, FONT_H, 'left', '#120e1a', 3);
    text(ctx, 'HIT', u(30) * String(g.combo).length * 0.62, 0, u(13), '#ffe9a8', FONT_H, 'left', '#120e1a', 2);
    ctx.restore();
    if (g.combo >= 10) {
      text(ctx, g.combo >= 30 ? '격노!' : g.combo >= 20 ? '맹공!' : '연속타!', u(26), cy + u(15), u(11),
        g.combo >= 30 ? '#ff6a6a' : '#ffd04a', FONT_H, 'left', '#120e1a', 2);
    }
  } else { st.lastCombo = 0; }

  // 안내 토스트
  if (g.msgT > 0 && g.msg) {
    const a = clamp(g.msgT / 30, 0, 1);
    const col = g.msg.kind === 'secret' ? '#ffd6ff' : g.msg.kind === 'item' ? '#ffe0a0' : '#dfe8f4';
    ctx.globalAlpha = a;
    panel(ctx, W / 2 - u(150), H - u(58), u(300), u(24), 0.7);
    text(ctx, g.msg.text, W / 2, H - u(41), u(11), col, FONT_B, 'center', '#120e1a', 2);
    ctx.globalAlpha = 1;
  }

  // 비밀 통로 프롬프트
  if (g.prompt) {
    const px = (g.prompt.x - g.cam) * S, py = (g.prompt.y - 46) * S;
    const bl = 0.6 + Math.sin(g.tick * 0.16) * 0.4;
    ctx.globalAlpha = bl;
    panel(ctx, px - u(34), py - u(13), u(68), u(20), 0.75);
    text(ctx, g.prompt.text, px, py + u(2), u(11), '#ffe8a0', FONT_H, 'center', '#120e1a', 2);
    ctx.globalAlpha = 1;
  }
}

export function drawLoading(ctx, g, S, W, H) {
  ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, H);
  const u = (v) => v * S;
  text(ctx, '스프라이트 굽는 중…', W / 2, H / 2 - u(14), u(14), '#e8dcc0', FONT_H, 'center');
  const bw = u(220), bx = (W - bw) / 2;
  ctx.fillStyle = '#231c30'; ctx.fillRect(bx, H / 2, bw, u(10));
  ctx.fillStyle = '#e0a83c'; ctx.fillRect(bx, H / 2, bw * g.bakeProgress, u(10));
  ctx.strokeStyle = 'rgba(220,200,160,0.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(bx - 1, H / 2 - 1, bw + 2, u(10) + 2);
  text(ctx, `${Math.round(g.bakeProgress * 100)}%`, W / 2, H / 2 + u(30), u(11), '#c8bfa8', FONT_B, 'center');
}

export function drawTitle(ctx, S, W, H, t, hiddenUnlocked) {
  const u = (v) => v * S;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#120a1c'); g.addColorStop(0.55, '#2a1230'); g.addColorStop(1, '#5c1e24');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 후광
  const rg = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.5);
  rg.addColorStop(0, 'rgba(255,140,60,0.28)'); rg.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 6.283 + t * 0.004;
    ctx.fillStyle = `rgba(255,180,90,${0.05 + (i % 3) * 0.02})`;
    ctx.save(); ctx.translate(W / 2, H * 0.38); ctx.rotate(a);
    ctx.fillRect(0, -u(3), W * 0.6, u(6)); ctx.restore();
  }
  const cx = W * 0.42;
  const pop = 1 + Math.sin(t * 0.04) * 0.012;
  ctx.save();
  ctx.translate(cx, H * 0.3); ctx.scale(pop, pop);
  text(ctx, '레이징 피스트', 0, 0, u(40), '#ffdf8a', FONT_H, 'center', '#3a0e14', 5);
  text(ctx, 'RAGING FIST SAGA', 0, u(24), u(14), '#ff9a5a', FONT_H, 'center', '#3a0e14', 3);
  ctx.restore();
  text(ctx, '― 강철의 거리에 울리는 격투 ―', cx, H * 0.48, u(11), '#e6d0b0', FONT_B, 'center');

  if ((t >> 5) % 2 === 0) text(ctx, 'Enter — 게임 시작', cx, H * 0.62, u(16), '#fff0c0', FONT_H, 'center');
  text(ctx, 'Tab — 커맨드 목록    M — 음소거    P — 일시정지', W / 2, H * 0.8, u(10), '#c4b8a8', FONT_B, 'center');
  text(ctx, '이동 ← → ↑ ↓ (또는 WASD)   약공격 J   강공격 K   점프 L   잡기 U   가드 Space',
    W / 2, H * 0.87, u(10), '#a8a0b0', FONT_B, 'center');
  if (hiddenUnlocked) text(ctx, '★ 히든 초필살기 해금됨', W / 2, H * 0.93, u(10), '#e0a8ff', FONT_B, 'center');
}

export function drawCommandList(ctx, S, W, H) {
  const u = (v) => v * S;
  ctx.fillStyle = 'rgba(8,6,14,0.97)'; ctx.fillRect(0, 0, W, H);
  text(ctx, '커맨드 목록', W / 2, u(21), u(16), '#ffdf8a', FONT_H, 'center');
  ctx.fillStyle = 'rgba(224,168,60,0.5)';
  ctx.fillRect(W / 2 - u(60), u(26), u(120), Math.max(1, u(1)));

  // 2단 구성 — 한 단으로 세우면 화면 밖으로 넘친다
  const cols = [
    { x: u(18), w: u(216), groups: [COMMAND_LIST[0], COMMAND_LIST[3]] },
    { x: u(250), w: u(212), groups: [COMMAND_LIST[1], COMMAND_LIST[2]] },
  ];
  for (const col of cols) {
    let y = u(44);
    for (const grp of col.groups) {
      ctx.fillStyle = '#ffb45a';
      ctx.fillRect(col.x, y - u(8), u(3), u(10));
      text(ctx, grp.g, col.x + u(8), y, u(11), '#ffb45a', FONT_H, 'left', '#120e1a', 2);
      y += u(15);
      for (const r of grp.rows) {
        text(ctx, r[0], col.x + u(6), y, u(10), '#e8e0d0', FONT_B, 'left', '#120e1a', 2);
        text(ctx, r[1], col.x + col.w, y, u(10), '#9fd8ff', FONT_B, 'right', '#120e1a', 2);
        y += u(13);
        if (r[2]) { text(ctx, r[2], col.x + u(6), y, u(8.5), '#a2988c', FONT_B, 'left', '#120e1a', 2); y += u(10); }
      }
      y += u(9);
    }
  }
  text(ctx, 'Tab / Esc — 닫기', W / 2, H - u(10), u(10), '#c8bfa8', FONT_B, 'center');
}

export function drawStageIntro(ctx, g, S, W, H) {
  const u = (v) => v * S;
  const t = g.introT;
  const a = t < 20 ? t / 20 : t > 120 ? clamp((150 - t) / 30, 0, 1) : 1;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,6,14,0.72)'; ctx.fillRect(0, 0, W, H);
  const stg = g.stage;
  text(ctx, `STAGE ${stg.no}`, W / 2, H * 0.36, u(16), '#ff9a5a', FONT_H, 'center');
  text(ctx, stg.name, W / 2, H * 0.5, u(34), '#ffdf8a', FONT_H, 'center', '#2a0e14', 4);
  text(ctx, stg.sub, W / 2, H * 0.6, u(12), '#d8c8b0', FONT_B, 'center');
  if (t > 90) {
    const s = 1 + Math.max(0, (110 - t) / 20) * 0.5;
    ctx.save(); ctx.translate(W / 2, H * 0.76); ctx.scale(s, s);
    text(ctx, 'FIGHT!', 0, 0, u(28), '#ff5a4a', FONT_H, 'center', '#2a0e14', 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawClear(ctx, g, S, W, H) {
  const u = (v) => v * S;
  ctx.fillStyle = 'rgba(8,6,14,0.8)'; ctx.fillRect(0, 0, W, H);
  text(ctx, 'STAGE CLEAR', W / 2, H * 0.26, u(30), '#ffdf8a', FONT_H, 'center', '#2a0e14', 4);
  const rows = [
    ['처치', `${g.stats.kills}`],
    ['최대 콤보', `${g.stats.maxCombo} HIT`],
    ['발견한 비밀', `${g.stats.secrets}`],
    ['봉인 두루마리', `${g.hidden.scrolls} / 3`],
    ['점수', `${g.score}`],
  ];
  let y = H * 0.42;
  for (const [k, v] of rows) {
    text(ctx, k, W / 2 - u(90), y, u(12), '#d8ccb8', FONT_B, 'left');
    text(ctx, v, W / 2 + u(90), y, u(12), '#ffe9a8', FONT_H, 'right');
    y += u(20);
  }
  if (g.clearT > 90 && (g.clearT >> 5) % 2 === 0) {
    text(ctx, 'Enter — 계속', W / 2, H * 0.84, u(15), '#fff0c0', FONT_H, 'center');
  }
}

export function drawGameOver(ctx, g, S, W, H, cont) {
  const u = (v) => v * S;
  ctx.fillStyle = 'rgba(6,4,10,0.86)'; ctx.fillRect(0, 0, W, H);
  if (cont) {
    text(ctx, 'CONTINUE?', W / 2, H * 0.32, u(30), '#ff6a5a', FONT_H, 'center', '#2a0e14', 4);
    const n = Math.max(0, Math.ceil(g.continueT));
    text(ctx, String(n), W / 2, H * 0.55, u(56), n <= 3 ? '#ff4a3a' : '#ffdf8a', FONT_H, 'center', '#2a0e14', 5);
    text(ctx, `Enter — 이어하기 (남은 코인 ${g.credits})`, W / 2, H * 0.74, u(14), '#fff0c0', FONT_H, 'center');
  } else {
    text(ctx, 'GAME OVER', W / 2, H * 0.38, u(34), '#c8402a', FONT_H, 'center', '#2a0e14', 4);
    text(ctx, `최종 점수 ${g.score}`, W / 2, H * 0.54, u(14), '#e8dcc0', FONT_B, 'center');
    text(ctx, `최대 콤보 ${g.stats.maxCombo} HIT · 비밀 ${g.stats.secrets}`, W / 2, H * 0.62, u(11), '#b8aca0', FONT_B, 'center');
    text(ctx, 'Enter — 타이틀로', W / 2, H * 0.78, u(14), '#fff0c0', FONT_H, 'center');
  }
}

export function drawEnding(ctx, g, S, W, H, t) {
  const u = (v) => v * S;
  const gd = ctx.createLinearGradient(0, 0, 0, H);
  gd.addColorStop(0, '#1a1030'); gd.addColorStop(0.6, '#4a2038'); gd.addColorStop(1, '#8a4a2a');
  ctx.fillStyle = gd; ctx.fillRect(0, 0, W, H);
  text(ctx, g.hidden.scrolls >= 3 ? '진 엔딩' : '엔딩', W / 2, H * 0.2, u(16), '#ffb45a', FONT_H, 'center');
  text(ctx, '강철의 거리에 새벽이 왔다', W / 2, H * 0.34, u(26), '#ffdf8a', FONT_H, 'center', '#2a0e14', 4);
  const lines = g.hidden.scrolls >= 3
    ? ['세 개의 봉인이 풀리고, 심연의 그림자마저 무릎 꿇었다.',
      '진은 자신의 분노를 이겨냈다. 이제 주먹은 지키기 위해 쥔다.']
    : ['거리는 조용해졌다. 그러나 어딘가에 남은 봉인이 있다.',
      '세 개의 두루마리를 모두 찾으면 다른 결말이 기다린다.'];
  let y = H * 0.48;
  for (const l of lines) { text(ctx, l, W / 2, y, u(12), '#e8dcc8', FONT_B, 'center'); y += u(20); }
  const rows = [['최종 점수', `${g.score}`], ['최대 콤보', `${g.stats.maxCombo} HIT`],
    ['처치', `${g.stats.kills}`], ['발견한 비밀', `${g.stats.secrets}`]];
  y = H * 0.64;
  for (const [k, v] of rows) {
    text(ctx, k, W / 2 - u(80), y, u(11), '#d8ccb8', FONT_B, 'left');
    text(ctx, v, W / 2 + u(80), y, u(11), '#ffe9a8', FONT_H, 'right');
    y += u(16);
  }
  if ((t >> 5) % 2 === 0) text(ctx, 'Enter — 타이틀로', W / 2, H * 0.93, u(13), '#fff0c0', FONT_H, 'center');
}

export function drawPause(ctx, S, W, H) {
  const u = (v) => v * S;
  ctx.fillStyle = 'rgba(6,4,10,0.7)'; ctx.fillRect(0, 0, W, H);
  text(ctx, '일시정지', W / 2, H * 0.45, u(28), '#ffdf8a', FONT_H, 'center');
  text(ctx, 'P — 계속    Tab — 커맨드 목록', W / 2, H * 0.58, u(12), '#d8ccb8', FONT_B, 'center');
}
