// NOVA STRIKE — ui: HUD + 메뉴. 한국어 텍스트는 전부 고해상 오버레이 캔버스에 렌더
// (픽셀 캔버스에 텍스트를 올리지 않는다 → 업스케일 뭉개짐 방지)
// 좌표계: 오버레이 유닛 == 픽셀 캔버스 좌표 (640×360), s = 물리 픽셀 배율
'use strict';
(function () {
  const P = NS.PAL;
  const FONT = "'Apple SD Gothic Neo','Pretendard','Noto Sans KR','Malgun Gothic',sans-serif";
  let menuStars = null;
  const CX = () => NS.VW / 2;

  function text(g, s, str, x, y, size, color, opts = {}) {
    g.font = `${opts.weight || 700} ${Math.round(size * s)}px ${FONT}`;
    g.textAlign = opts.align || 'left';
    g.textBaseline = opts.baseline || 'alphabetic';
    if (opts.glow) {
      g.shadowColor = opts.glow;
      g.shadowBlur = (opts.glowSize || 6) * s;
    }
    if (opts.stroke) {
      g.strokeStyle = opts.stroke;
      g.lineWidth = Math.max(2, 3.2 * s * (opts.strokeW || 1) / 2);
      g.strokeText(str, x * s, y * s);
    }
    g.fillStyle = color;
    g.fillText(str, x * s, y * s);
    g.shadowBlur = 0;
  }
  function panel(g, s, x, y, w, h, opts = {}) {
    g.fillStyle = opts.bg || 'rgba(9,10,26,0.88)';
    g.fillRect(x * s, y * s, w * s, h * s);
    g.strokeStyle = opts.border || NS.rgba(P.cyan2, 0.55);
    g.lineWidth = Math.max(1, 1 * s * 0.6);
    g.strokeRect(x * s + 0.5, y * s + 0.5, w * s - 1, h * s - 1);
  }

  // 셀렉트 카드 레이아웃 (픽셀/오버레이 공유)
  const CARD = { y: 110, w: 100, h: 96, gap: 12, labW: 72 };
  CARD.x0 = () => (NS.VW - (4 * CARD.w + 3 * CARD.gap + 16 + CARD.labW)) / 2;
  CARD.x = (i) => CARD.x0() + i * (CARD.w + CARD.gap);
  CARD.labX = () => CARD.x0() + 4 * (CARD.w + CARD.gap) + 4;

  NS.UI = {
    frame: 0,

    // ── 픽셀 캔버스 쪽 (배경/스프라이트) ──
    drawPixel(g) {
      const G = NS.Game;
      const st = G.state;
      this.frame++;
      if (['title', 'select', 'shop'].includes(st)) {
        this.drawMenuBackdrop(g);
        if (st === 'select') this.drawSelectPortraits(g);
        if (st === 'title') this.drawTitleHero(g);
      } else if (G.stage) {
        if (['stage', 'paused'].includes(st)) this.drawHudPixel(g);
        if (st === 'weaponGet') this.drawWeaponGetPixel(g);
      }
    },

    drawMenuBackdrop(g) {
      if (!menuStars) {
        menuStars = [];
        const rng = NS.makeRng(20260815);
        for (let i = 0; i < 120; i++) menuStars.push({ x: rng() * NS.VW, y: rng() * NS.VH, z: rng() });
      }
      NS.ditherGrad(g, 0, 0, NS.VW, NS.VH, ['#04030d', '#0a0618', '#140a28', '#1c1038']);
      for (const s of menuStars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(this.frame * 0.02 + s.x));
        g.fillStyle = NS.rgba(s.z > 0.7 ? P.cyan3 : s.z > 0.4 ? P.steel5 : P.violet3, 0.3 + 0.5 * tw * s.z);
        g.fillRect(Math.round(s.x), Math.round((s.y + this.frame * 0.03 * s.z) % NS.VH), s.z > 0.8 ? 2 : 1, s.z > 0.8 ? 2 : 1);
      }
      // 하단 실루엣 스카이라인
      g.fillStyle = '#0a0818';
      for (let x = 0; x < NS.VW; x += 24) {
        const h = 20 + (((x * 2654435761) >>> 16) % 97) % 40;
        g.fillRect(x, NS.VH - h, 24, h);
      }
      g.fillStyle = NS.rgba(P.cyan2, 0.12);
      g.fillRect(0, NS.VH - 66, NS.VW, 1);
    },

    drawTitleHero(g) {
      const img = NS.Sprites.hero.idle[Math.floor(this.frame / 40) % 2];
      g.save();
      g.imageSmoothingEnabled = false;
      g.translate(Math.round(NS.VW * 0.82), Math.round(NS.VH * 0.95));
      g.scale(2.6, 2.6);
      g.drawImage(img, -32, -64);
      g.restore();
      g.fillStyle = NS.rgba(P.cyan2, 0.06 + 0.03 * Math.sin(this.frame * 0.05));
      g.fillRect(0, 0, NS.VW, NS.VH);
    },

    drawSelectPortraits(g) {
      const defs = [['moloch', 'idle'], ['phantom', 'idle'], ['roc', 'fly'], ['kairos2', 'idle']];
      const G = NS.Game;
      for (let i = 0; i < 4; i++) {
        const cx = CARD.x(i) + CARD.w / 2, by = CARD.y + CARD.h - 16;
        const id = NS.STAGE_ORDER[i];
        const locked = NS.STAGES[id].locked && G.clearedCount() < 3;
        const spr = NS.Sprites.bosses[defs[i][0]][defs[i][1]][0];
        const sc = Math.min(64 / spr.width, 58 / spr.height);
        g.save();
        g.imageSmoothingEnabled = false;
        g.translate(Math.round(cx), Math.round(by));
        g.scale(sc, sc);
        if (locked) g.globalAlpha = 0.25;
        g.drawImage(spr, -spr.width / 2, -spr.height);
        g.restore();
        g.globalAlpha = 1;
      }
    },

    drawHudPixel(g) {
      const pl = NS.Player;
      // ── 체력바 (세로 세그먼트) ──
      const x = 12, yBot = 200;
      const segs = pl.maxHp, segH = 3;
      const barH = segs * segH + 8;
      g.fillStyle = 'rgba(9,10,26,0.8)';
      g.fillRect(x - 2, yBot - barH, 12, barH);
      g.fillStyle = P.steel2;
      g.fillRect(x - 2, yBot - barH, 12, 3);
      g.fillRect(x - 2, yBot - 3, 12, 3);
      for (let i = 0; i < segs; i++) {
        const filled = i < pl.hp;
        g.fillStyle = filled ? (i % 4 === 3 ? P.cyan3 : P.cyan2) : P.night2;
        g.fillRect(x, yBot - 6 - i * segH, 8, segH - 1);
      }
      g.strokeStyle = P.steel3; g.lineWidth = 1;
      g.strokeRect(x - 2.5, yBot - barH + 0.5, 13, barH);
      // ── 무기 에너지 ──
      if (pl.weapon !== 0) {
        const W = NS.WEAPONS[pl.weapon];
        const ex = x + 16, eSegs = pl.ammoMax;
        const eH = eSegs * 2 + 6;
        g.fillStyle = 'rgba(9,10,26,0.8)';
        g.fillRect(ex - 2, yBot - eH, 10, eH);
        for (let i = 0; i < eSegs; i++) {
          g.fillStyle = i < pl.ammo[pl.weapon] ? W.color : P.night2;
          g.fillRect(ex, yBot - 5 - i * 2, 6, 1);
        }
        g.strokeStyle = P.steel3;
        g.strokeRect(ex - 2.5, yBot - eH + 0.5, 11, eH);
      }
      // ── 보스 체력바 (우측) ──
      const B = NS.Boss;
      if (B.active && ['fill', 'fight', 'dying'].includes(B.state)) {
        const bx = NS.VW - 24, bBot = 226, bH2 = Math.min(160, B.maxHp * 2) + 8;
        g.fillStyle = 'rgba(9,10,26,0.8)';
        g.fillRect(bx - 2, bBot - bH2, 12, bH2);
        const shown = Math.round(B.hpRatio * (bH2 - 8) / 2);
        for (let i = 0; i < (bH2 - 8) / 2; i++) {
          g.fillStyle = i < shown ? (i % 4 === 3 ? P.magenta3 : P.magenta2) : P.night2;
          g.fillRect(bx, bBot - 6 - i * 2, 8, 1);
        }
        g.strokeStyle = P.red2;
        g.strokeRect(bx - 2.5, bBot - bH2 + 0.5, 13, bH2);
      }
      // 라이프 아이콘
      const li = NS.Sprites.items.oneUp[0];
      for (let i = 0; i < Math.min(5, pl.lives); i++) g.drawImage(li, 10 + i * 14, 8);
    },

    drawWeaponGetPixel(g) {
      g.fillStyle = 'rgba(5,6,15,0.82)';
      g.fillRect(0, 0, NS.VW, NS.VH);
      const G = NS.Game;
      const sprMap = { magma: 'magma', frost: 'frost', cyclone: 'cyclone' };
      const wid = G.pendingWeapon;
      if (wid && NS.Sprites.bullets[sprMap[wid]]) {
        const spr = NS.Sprites.bullets[sprMap[wid]][Math.floor(this.frame / 8) % 2];
        g.save();
        g.imageSmoothingEnabled = false;
        g.translate(CX(), 150);
        g.scale(3.4, 3.4);
        g.drawImage(spr, -spr.width / 2, -spr.height / 2);
        g.restore();
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2 + this.frame * 0.03;
          g.fillStyle = NS.rgba(P.cyan3, 0.5);
          g.fillRect(Math.round(CX() + Math.cos(a) * 54), Math.round(150 + Math.sin(a) * 54), 2, 2);
        }
      }
    },

    // ── 오버레이 (고해상, 한국어 텍스트) ──
    drawOverlay(g, s) {
      const G = NS.Game;
      g.clearRect(0, 0, g.canvas.width, g.canvas.height);
      switch (G.state) {
        case 'title': this.ovTitle(g, s); break;
        case 'select': this.ovSelect(g, s); break;
        case 'shop': this.ovShop(g, s); break;
        case 'stage': this.ovStage(g, s); break;
        case 'paused': this.ovStage(g, s); this.ovPaused(g, s); break;
        case 'weaponGet': this.ovWeaponGet(g, s); break;
        case 'results': this.ovResults(g, s); break;
        case 'gameover': this.ovGameover(g, s); break;
        case 'ending': this.ovEnding(g, s); break;
      }
      // 공지 배너
      let ay = 44;
      for (const a of G.announceQueue) {
        const alpha = Math.min(1, a.t / 30);
        g.globalAlpha = alpha;
        panel(g, s, CX() - 160, ay, 320, 22, { border: NS.rgba(P.orange3, 0.7) });
        text(g, s, a.text, CX(), ay + 15.5, 11, '#ffe66d', { align: 'center' });
        g.globalAlpha = 1;
        ay += 27;
      }
    },

    ovTitle(g, s) {
      const t = this.frame;
      text(g, s, 'NOVA STRIKE', CX(), 122, 56, '#38e0ff', { align: 'center', weight: 900, glow: NS.rgba(P.cyan2, 0.9), glowSize: 18, stroke: '#0a0c1e', strokeW: 2 });
      text(g, s, 'NOVA STRIKE', CX() - 1, 119, 56, '#f2f7ff', { align: 'center', weight: 900 });
      text(g, s, '노바 스트라이크', CX(), 148, 16, '#a8f6ff', { align: 'center', weight: 700, glow: NS.rgba(P.cyan2, 0.6), glowSize: 8 });
      text(g, s, '궤도 도시 헬리오스 스파이어 탈환 작전', CX(), 172, 11, '#8b96bd', { align: 'center', weight: 500 });
      if (Math.floor(t / 30) % 2 === 0)
        text(g, s, 'ENTER 또는 Z — 작전 개시', CX(), 218, 14, '#ffe66d', { align: 'center', glow: 'rgba(255,230,109,0.5)', glowSize: 8 });
      panel(g, s, CX() - 170, 246, 340, 66, { border: NS.rgba(P.steel3, 0.6) });
      text(g, s, '이동 ←→/AD · 점프 Z/K · 사격(홀드=차지) X/J · 대시 C/L', CX(), 266, 10.5, '#c3cbe8', { align: 'center', weight: 500 });
      text(g, s, '무기 전환 Q·E (또는 U·O, 1~4) · 일시정지 ENTER', CX(), 283, 10.5, '#c3cbe8', { align: 'center', weight: 500 });
      text(g, s, '벽에 붙어 하강 = 월 슬라이드 · 벽에서 점프 = 월 점프 · 대시 중 점프 = 대시 점프', CX(), 300, 9.5, '#8b96bd', { align: 'center', weight: 500 });
      const best = NS.Game.save.totalScore;
      if (best > 0) text(g, s, `누적 베스트 스코어 ${best.toLocaleString()}`, CX(), 336, 10, '#5c6690', { align: 'center', weight: 500 });
    },

    ovSelect(g, s) {
      const G = NS.Game;
      text(g, s, '미션 셀렉트', CX(), 44, 24, '#f2f7ff', { align: 'center', weight: 900, glow: NS.rgba(P.cyan2, 0.6), glowSize: 10 });
      text(g, s, `보유 코어 칩 ${G.save.chips.toLocaleString()}`, CX(), 66, 12, '#ffc44d', { align: 'center' });
      const ws = ['magma', 'frost', 'cyclone'].filter(w => G.save.weapons[w]);
      if (ws.length) {
        const names = { magma: '마그마 버스트', frost: '프로스트 랜스', cyclone: '사이클론 커터' };
        text(g, s, '획득 무기: ' + ws.map(w => names[w]).join(' · '), CX(), 88, 10, '#a8f6ff', { align: 'center', weight: 500 });
      }
      for (let i = 0; i < 4; i++) {
        const x = CARD.x(i), y = CARD.y, w = CARD.w, h = CARD.h;
        const id = NS.STAGE_ORDER[i];
        const def = NS.STAGES[id];
        const sel = G.selectIdx === i;
        const locked = def.locked && G.clearedCount() < 3;
        const cleared = G.save.cleared[id];
        panel(g, s, x, y, w, h, { border: sel ? NS.rgba(P.cyan2, 0.95) : NS.rgba(P.steel3, 0.5), bg: sel ? 'rgba(15,22,52,0.85)' : 'rgba(9,10,26,0.7)' });
        if (sel) {
          g.strokeStyle = NS.rgba(P.cyan3, 0.5 + 0.3 * Math.sin(this.frame * 0.15));
          g.lineWidth = 2 * Math.max(1, s * 0.5);
          g.strokeRect((x - 3) * s, (y - 3) * s, (w + 6) * s, (h + 6) * s);
        }
        text(g, s, locked ? '???' : def.name, x + w / 2, y + 15, 10, sel ? '#a8f6ff' : '#c3cbe8', { align: 'center' });
        text(g, s, locked ? 'LOCKED' : def.bossName, x + w / 2, y + h - 8, 9.5, locked ? '#5c6690' : sel ? '#ff9fd0' : '#8b96bd', { align: 'center', weight: 500 });
        if (cleared) text(g, s, '격파', x + w - 18, y + 30, 10, '#3ecf6e', { align: 'center', weight: 900, glow: 'rgba(62,207,110,0.6)', glowSize: 5 });
      }
      {
        const x = CARD.labX(), y = CARD.y, w = CARD.labW, h = CARD.h, sel = G.selectIdx === 4;
        panel(g, s, x, y, w, h, { border: sel ? NS.rgba(P.orange3, 0.95) : NS.rgba(P.steel3, 0.5) });
        if (sel) {
          g.strokeStyle = NS.rgba(P.orange3, 0.5 + 0.3 * Math.sin(this.frame * 0.15));
          g.lineWidth = 2 * Math.max(1, s * 0.5);
          g.strokeRect((x - 3) * s, (y - 3) * s, (w + 6) * s, (h + 6) * s);
        }
        text(g, s, '연구소', x + w / 2, y + 48, 11, sel ? '#ffe66d' : '#c3cbe8', { align: 'center' });
        text(g, s, '강화 상점', x + w / 2, y + 66, 9.5, '#8b96bd', { align: 'center', weight: 500 });
      }
      const sel = G.selectIdx;
      panel(g, s, CX() - 220, 244, 440, 54, { border: NS.rgba(P.steel3, 0.5) });
      if (sel < 4) {
        const def = NS.STAGES[NS.STAGE_ORDER[sel]];
        const locked = def.locked && G.clearedCount() < 3;
        text(g, s, locked ? '가디언 3기 격파 시 개방' : def.desc, CX(), 266, 11, '#c3cbe8', { align: 'center', weight: 500 });
        const best = G.save.best[def.id];
        if (best) text(g, s, `베스트 ${best.score.toLocaleString()}점 · ${Math.floor(best.time / 3600)}:${String(Math.floor(best.time / 60) % 60).padStart(2, '0')}`, CX(), 286, 10, '#8b96bd', { align: 'center', weight: 500 });
      } else {
        text(g, s, '코어 칩으로 영구 강화를 구매한다 (사망해도 칩은 남는다)', CX(), 272, 11, '#c3cbe8', { align: 'center', weight: 500 });
      }
      text(g, s, '←→ 선택 · Z 결정', CX(), 330, 10, '#5c6690', { align: 'center', weight: 500 });
    },

    ovShop(g, s) {
      const G = NS.Game;
      text(g, s, '연구소 — 영구 강화', CX(), 42, 21, '#ffe66d', { align: 'center', weight: 900, glow: 'rgba(255,196,77,0.5)', glowSize: 10 });
      text(g, s, `보유 코어 칩 ${G.save.chips.toLocaleString()}`, CX(), 64, 12, '#ffc44d', { align: 'center' });
      const items = NS.SHOP_ITEMS;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const y = 80 + i * 32, sel = G.shopIdx === i;
        const owned = G.save.shop[it.id];
        const gated = it.needs && !G.save.shop[it.needs];
        panel(g, s, CX() - 220, y, 440, 28, { border: sel ? NS.rgba(P.cyan2, 0.9) : NS.rgba(P.steel3, 0.4), bg: sel ? 'rgba(15,22,52,0.9)' : 'rgba(9,10,26,0.72)' });
        text(g, s, it.name, CX() - 206, y + 19, 11.5, owned ? '#3ecf6e' : gated ? '#5c6690' : sel ? '#f2f7ff' : '#c3cbe8');
        text(g, s, it.desc, CX() - 62, y + 19, 10.5, gated ? '#5c6690' : '#8b96bd', { weight: 500 });
        text(g, s, owned ? '보유중' : gated ? '선행 필요' : `${it.cost}칩`, CX() + 206, y + 19, 11, owned ? '#3ecf6e' : G.save.chips >= it.cost && !gated ? '#ffc44d' : '#e04545', { align: 'right' });
      }
      text(g, s, '↑↓ 선택 · Z 구매 · ESC 돌아가기', CX(), 330, 10, '#5c6690', { align: 'center', weight: 500 });
    },

    ovStage(g, s) {
      const G = NS.Game;
      const pl = NS.Player;
      if (!G.stage) return;
      const W = NS.WEAPONS[pl.weapon];
      text(g, s, W.name, 12, 216, 10, W.color === P.cyan2 ? '#a8f6ff' : W.color, { weight: 700 });
      if (pl.weapon !== 0) text(g, s, `${pl.ammo[pl.weapon]}/${pl.ammoMax}`, 12, 230, 9.5, '#8b96bd', { weight: 500 });
      text(g, s, `칩 ${G.save.chips.toLocaleString()}`, NS.VW - 12, 22, 11, '#ffc44d', { align: 'right' });
      text(g, s, `${G.stage.score.toLocaleString()}점`, NS.VW - 12, 40, 10.5, '#c3cbe8', { align: 'right', weight: 500 });
      const B = NS.Boss;
      if (B.active && ['fill', 'fight', 'dying'].includes(B.state)) {
        text(g, s, B.def.name, NS.VW - 12, 244, 11, '#ff9fd0', { align: 'right' });
      }
      if (B.active && B.state === 'warning') {
        if (Math.floor(B.t / 12) % 2 === 0) {
          g.fillStyle = 'rgba(126,29,44,0.35)';
          g.fillRect(0, 144 * s, NS.VW * s, 62 * s);
          text(g, s, 'W A R N I N G', CX(), 186, 38, '#e04545', { align: 'center', weight: 900, glow: 'rgba(224,69,69,0.8)', glowSize: 18 });
        }
      }
      // 데미지 팝업 (월드 좌표 == 유닛 좌표)
      const camX = NS.Level.camX, camY = NS.Level.camY;
      for (const pu of NS.FX.popups) {
        const a = Math.min(1, pu.life / 16);
        g.globalAlpha = a;
        text(g, s, pu.text, pu.x - camX, pu.y - camY, 11, pu.color, { align: 'center', weight: 900, stroke: 'rgba(10,12,30,0.9)', strokeW: 1.4 });
        g.globalAlpha = 1;
      }
    },

    ovPaused(g, s) {
      const G = NS.Game;
      g.fillStyle = 'rgba(5,6,15,0.72)';
      g.fillRect(0, 0, NS.VW * s, NS.VH * s);
      panel(g, s, CX() - 150, 76, 190, 128, { border: NS.rgba(P.cyan2, 0.8) });
      text(g, s, 'PAUSE', CX() - 55, 100, 17, '#f2f7ff', { align: 'center', weight: 900 });
      const opts = G.pauseOptions();
      for (let i = 0; i < opts.length; i++) {
        const sel = G.pauseIdx === i;
        text(g, s, (sel ? '▶ ' : '   ') + opts[i].label, CX() - 138, 130 + i * 22, 11.5, sel ? '#a8f6ff' : '#8b96bd');
      }
      panel(g, s, CX() + 56, 76, 140, 168, { border: NS.rgba(P.steel3, 0.6) });
      text(g, s, '장비 현황', CX() + 126, 96, 11, '#c3cbe8', { align: 'center' });
      const pl = NS.Player;
      const lines = [['버스터', '#a8f6ff']];
      if (pl.owned[1]) lines.push(['마그마 버스트', NS.WEAPONS[1].color]);
      if (pl.owned[2]) lines.push(['프로스트 랜스', '#a8f6ff']);
      if (pl.owned[3]) lines.push(['사이클론 커터', NS.WEAPONS[3].color]);
      if (pl.parts.boots) lines.push(['부스터 파츠', '#ffc44d']);
      if (pl.parts.buster) lines.push(['버스터 파츠', '#ffc44d']);
      const hearts = ['mg-heart', 'cr-heart', 'st-heart'].filter(id => G.save.collected[id]).length;
      lines.push([`하트 탱크 ${hearts}/3`, '#ff9fd0']);
      for (let i = 0; i < lines.length; i++)
        text(g, s, lines[i][0], CX() + 68, 116 + i * 17, 10, lines[i][1], { weight: 500 });
      text(g, s, '↑↓ 선택 · Z 결정 · ENTER 복귀', CX(), 330, 10, '#5c6690', { align: 'center', weight: 500 });
    },

    ovWeaponGet(g, s) {
      const G = NS.Game;
      const names = { magma: ['마그마 버스트', '착탄 시 지면을 타고 번지는 화염구. 빙결 속성에 강하다.'], frost: ['프로스트 랜스', '적을 관통하며 얼리는 냉기 창. 폭풍 속성에 강하다.'], cyclone: ['사이클론 커터', '되돌아오는 회전 칼날. 화염 속성에 강하다.'] };
      const info = names[G.pendingWeapon] || ['', ''];
      text(g, s, 'NEW WEAPON GET!', CX(), 72, 24, '#ffe66d', { align: 'center', weight: 900, glow: 'rgba(255,230,109,0.7)', glowSize: 12 });
      text(g, s, info[0], CX(), 212, 18, '#a8f6ff', { align: 'center', weight: 900, glow: NS.rgba(P.cyan2, 0.6), glowSize: 10 });
      text(g, s, info[1], CX(), 236, 11.5, '#c3cbe8', { align: 'center', weight: 500 });
      if (G.stateT > 90 && Math.floor(this.frame / 24) % 2 === 0)
        text(g, s, 'Z — 계속', CX(), 288, 12.5, '#ffe66d', { align: 'center' });
    },

    ovResults(g, s) {
      const G = NS.Game;
      const st = G.stage;
      g.fillStyle = 'rgba(5,6,15,0.7)';
      g.fillRect(0, 0, NS.VW * s, NS.VH * s);
      text(g, s, 'MISSION COMPLETE', CX(), 96, 27, '#3ecf6e', { align: 'center', weight: 900, glow: 'rgba(62,207,110,0.6)', glowSize: 14 });
      text(g, s, st.def.name + ' — ' + st.def.bossName + ' 격파', CX(), 124, 12.5, '#c3cbe8', { align: 'center', weight: 500 });
      panel(g, s, CX() - 115, 148, 230, 100, { border: NS.rgba(P.cyan2, 0.6) });
      const mm = Math.floor(st.time / 3600), ss2 = String(Math.floor(st.time / 60) % 60).padStart(2, '0');
      text(g, s, `클리어 타임  ${mm}:${ss2}`, CX(), 176, 12.5, '#f2f7ff', { align: 'center', weight: 500 });
      text(g, s, `스코어  ${st.score.toLocaleString()}점`, CX(), 202, 12.5, '#ffe66d', { align: 'center' });
      const best = G.save.best[st.id];
      if (best) text(g, s, `베스트  ${best.score.toLocaleString()}점`, CX(), 228, 11, '#8b96bd', { align: 'center', weight: 500 });
      if (G.stateT > 60 && Math.floor(this.frame / 24) % 2 === 0)
        text(g, s, 'Z — 미션 셀렉트로', CX(), 292, 12.5, '#a8f6ff', { align: 'center' });
    },

    ovGameover(g, s) {
      g.fillStyle = 'rgba(5,6,15,0.78)';
      g.fillRect(0, 0, NS.VW * s, NS.VH * s);
      text(g, s, 'GAME OVER', CX(), 158, 34, '#e04545', { align: 'center', weight: 900, glow: 'rgba(224,69,69,0.7)', glowSize: 16 });
      text(g, s, '수리 완료 — 코어 칩은 보존되었다', CX(), 190, 12.5, '#c3cbe8', { align: 'center', weight: 500 });
      if (NS.Game.stateT > 90 && Math.floor(this.frame / 24) % 2 === 0)
        text(g, s, 'Z — 미션 셀렉트로', CX(), 244, 12.5, '#a8f6ff', { align: 'center' });
    },

    ovEnding(g, s) {
      const G = NS.Game;
      g.fillStyle = 'rgba(5,6,15,0.85)';
      g.fillRect(0, 0, NS.VW * s, NS.VH * s);
      const t = G.stateT;
      text(g, s, 'MISSION ACCOMPLISHED', CX(), 88, 25, '#38e0ff', { align: 'center', weight: 900, glow: NS.rgba(P.cyan2, 0.8), glowSize: 14 });
      const lines = [
        '카이로스 코어, 침묵.',
        '헬리오스 스파이어의 하늘이 다시 열린다.',
        '',
        '기계군단의 잔해 위로 첫 새벽이 내려앉고,',
        '노바는 다음 신호가 올 때까지 — 조용히 도시를 지켜본다.',
      ];
      for (let i = 0; i < lines.length; i++) {
        if (t > 40 + i * 34) {
          g.globalAlpha = Math.min(1, (t - 40 - i * 34) / 30);
          text(g, s, lines[i], CX(), 136 + i * 24, 12.5, '#c3cbe8', { align: 'center', weight: 500 });
          g.globalAlpha = 1;
        }
      }
      if (G.endingStats && t > 240)
        text(g, s, `최종 스코어 ${G.endingStats.score.toLocaleString()}점`, CX(), 292, 14, '#ffe66d', { align: 'center' });
      if (t > 300 && Math.floor(this.frame / 24) % 2 === 0)
        text(g, s, 'Z — 타이틀로', CX(), 322, 11.5, '#a8f6ff', { align: 'center' });
    },
  };
})();
