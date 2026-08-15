// NOVA STRIKE — bosses: 가디언 3기 + 카이로스(2형태)
// 공통 셸: WARNING → 등장 → HP 필 → 전투(페이즈 2) → 사망 연출
'use strict';
(function () {
  const P = NS.PAL;
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // ── 보스 스프라이트 베이크 ─────────────────────────────
  function bakeBosses() {
    const S = NS.Sprites;
    S.bosses = {};
    // 이그니스 몰록 — 용광로 골렘 88×84
    const moloch = (pose) => NS.bake(96, 92, (g) => {
      const armUp = pose === 'raise' ? -18 : pose === 'slam' ? 10 : 0;
      const mouthOpen = pose === 'lob';
      // 다리 (굵은 기둥)
      NS.limb(g, 34, 62, 28, 86, 10, '#6e3428', '#48201a', '#a05a3c');
      NS.limb(g, 60, 62, 66, 86, 10, '#6e3428', '#48201a', '#a05a3c');
      R(g, 20, 84, 16, 6, '#48201a'); R(g, 60, 84, 16, 6, '#48201a');
      // 뒷팔
      NS.limb(g, 30, 40, 14, 56 + armUp, 9, '#5c2c22', '#3d1a14', null);
      NS.orb(g, 13, 60 + armUp, 8, '#6e3428', '#48201a', '#a05a3c');
      // 몸통 — 용광로
      R(g, 26, 28, 44, 40, '#7e3c2c');
      R(g, 26, 58, 44, 10, '#54241c');
      R(g, 26, 28, 44, 4, '#b8703c');
      // 용광로 그레이트 (가슴)
      R(g, 34, 38, 28, 20, P.ink);
      for (let i = 0; i < 3; i++) {
        R(g, 36, 40 + i * 6, 24, 4, pose === 'hurt' ? P.red1 : P.orange2);
        R(g, 36, 40 + i * 6, 24, 1, P.yellow);
      }
      // 어깨 장갑
      R(g, 18, 24, 22, 12, '#8e4632'); R(g, 18, 24, 22, 3, '#c28050');
      R(g, 56, 24, 22, 12, '#8e4632'); R(g, 56, 24, 22, 3, '#c28050');
      // 머리
      R(g, 38, 10, 20, 18, '#8e4632');
      R(g, 38, 10, 20, 3, '#c28050');
      // 눈 — V 바이저
      R(g, 40, 17, 16, 5, P.ink);
      R(g, 41, 18, 6, 3, pose === 'hurt' ? P.white : P.orange3);
      R(g, 49, 18, 6, 3, pose === 'hurt' ? P.white : P.orange3);
      // 입 (용광로 배출구)
      if (mouthOpen) { R(g, 42, 24, 12, 5, P.ink); R(g, 44, 25, 8, 3, P.yellow); }
      // 앞팔 (거대 주먹)
      NS.limb(g, 66, 40, 82, 56 + armUp, 9, '#7e3c2c', '#54241c', '#b8703c');
      NS.orb(g, 84, 60 + armUp, 9, '#8e4632', '#54241c', '#c28050');
      R(g, 79, 55 + armUp, 4, 4, P.orange2);
      // 굴뚝
      R(g, 30, 2, 8, 12, '#54241c'); R(g, 30, 2, 8, 2, '#8e4632');
      R(g, 58, 4, 8, 10, '#54241c'); R(g, 58, 4, 8, 2, '#8e4632');
    });
    S.bosses.moloch = { idle: [moloch('idle'), moloch('idle2')], raise: [moloch('raise')], slam: [moloch('slam')], lob: [moloch('lob')], hurt: [moloch('hurt')] };

    // 글레이셔 팬텀 — 빙령 60×76
    const phantom = (pose) => NS.bake(68, 84, (g) => {
      const armUp = pose === 'cast' ? -14 : 0;
      const lean = pose === 'dash' ? 8 : 0;
      // 하부 — 소용돌이 옷자락 (다리 없음)
      for (let i = 0; i < 5; i++) {
        const w = 30 - i * 5;
        R(g, 34 - w / 2 - lean * (i / 5), 48 + i * 6, w, 5, i % 2 ? '#24407a' : '#2e4a8e');
      }
      R(g, 30 - lean, 76, 6, 4, '#8fc6ea');
      // 몸통 로브
      R(g, 20 - lean / 2, 30, 28, 22, '#2e4a8e');
      R(g, 20 - lean / 2, 30, 28, 3, '#5c85c2');
      R(g, 24 - lean / 2, 36, 20, 12, '#1b2c5c');
      // 가슴 크리스털 코어
      R(g, 30 - lean / 2, 38, 8, 8, P.ink);
      R(g, 31 - lean / 2, 39, 6, 6, pose === 'hurt' ? P.white : P.cyan2);
      R(g, 32 - lean / 2, 40, 2, 2, P.white);
      // 팔 (냉기 클로)
      NS.limb(g, 22, 34, 8, 46 + armUp, 5, '#24407a', '#16224a', '#5c85c2');
      NS.limb(g, 46, 34, 60, 46 + armUp, 5, '#24407a', '#16224a', '#5c85c2');
      for (const hx of [6, 58]) for (let i = 0; i < 3; i++) R(g, hx + i * 3 - 2, 48 + armUp + (i === 1 ? 3 : 0), 2, 5, '#8fc6ea');
      // 머리 — 크리스털 크라운
      NS.orb(g, 34 - lean / 2, 18, 9, '#3a5ca2', '#24407a', '#6a9ad2');
      R(g, 27 - lean / 2, 4, 3, 10, '#8fc6ea'); R(g, 33 - lean / 2, 0, 3, 14, '#c8ecff'); R(g, 39 - lean / 2, 4, 3, 10, '#8fc6ea');
      // 눈 — 차가운 발광
      R(g, 29 - lean / 2, 16, 5, 3, pose === 'hurt' ? P.white : P.cyan3);
      R(g, 37 - lean / 2, 16, 5, 3, pose === 'hurt' ? P.white : P.cyan3);
      R(g, 28 - lean / 2, 22, 13, 2, '#16224a');
    });
    S.bosses.phantom = { idle: [phantom('idle'), phantom('idle2')], cast: [phantom('cast')], dash: [phantom('dash')], hurt: [phantom('hurt')] };

    // 템페스트 로크 — 조류 메카 120×88
    const roc = (pose) => NS.bake(128, 96, (g) => {
      const wingUp = pose === 'flyUp' ? -16 : pose === 'dive' ? 14 : 0;
      const screech = pose === 'screech';
      // 날개 (3단 페더)
      for (const dir of [-1, 1]) {
        const bx = 64 + dir * 22;
        for (let i = 0; i < 3; i++) {
          const wx = bx + dir * i * 13, wy = 34 + wingUp * (1 + i * 0.5) + i * 3;
          NS.limb(g, bx, 38, wx + dir * 12, wy, 7 - i, '#4a3c7e', '#332a58', '#7a68b2');
          R(g, wx + dir * 12 - 4, wy - 2, 8, 3, '#9a88d2');
        }
      }
      // 꼬리
      NS.limb(g, 52, 56, 30, 70, 4, '#4a3c7e', '#332a58', null);
      R(g, 24, 68, 8, 5, '#c08cff');
      // 동체
      NS.orb(g, 66, 48, 17, '#5e4a92', '#3d2f66', '#8a70c2');
      R(g, 50, 40, 34, 8, '#8a70c2');
      // 가슴 코어
      R(g, 60, 52, 12, 9, P.ink);
      R(g, 62, 54, 8, 5, pose === 'hurt' ? P.white : P.violet3);
      // 다리 + 클로
      NS.limb(g, 58, 62, 54, 78, 4, P.steel2, P.steel1, null);
      NS.limb(g, 74, 62, 78, 78, 4, P.steel2, P.steel1, null);
      for (const cx of [50, 74]) for (let i = 0; i < 3; i++) R(g, cx + i * 4, 78, 3, 6, P.steel4);
      // 머리
      NS.orb(g, 92, 32, 10, '#5e4a92', '#3d2f66', '#8a70c2');
      // 부리
      R(g, 100, 30, 14, 6, P.orange3); R(g, 100, 34, 12, 4, P.orange2);
      if (screech) { R(g, 100, 36, 14, 4, P.ink); R(g, 102, 34, 10, 2, P.yellow); }
      // 눈
      R(g, 92, 27, 6, 4, P.ink);
      R(g, 93, 28, 4, 2, pose === 'hurt' ? P.white : screech ? P.red2 : P.magenta2);
      // 크레스트
      R(g, 84, 18, 4, 10, '#c08cff'); R(g, 90, 14, 4, 12, '#e6c8ff'); R(g, 96, 18, 4, 8, '#c08cff');
    });
    S.bosses.roc = { fly: [roc('flyUp'), roc('idle')], dive: [roc('dive')], screech: [roc('screech')], hurt: [roc('hurt')] };

    // 카이로스 1형태 — 코어 72×72 + 실드 포드
    const core1 = (pose) => NS.bake(80, 80, (g) => {
      // 외곽 링
      for (let a = 0; a < 16; a++) {
        const th = a / 16 * Math.PI * 2;
        R(g, 40 + Math.cos(th) * 30 - 2, 40 + Math.sin(th) * 30 - 2, 5, 5, a % 2 ? '#31284e' : '#4a3c7e');
      }
      NS.orb(g, 40, 40, 22, '#31284e', '#1c1633', '#5a4a86');
      // 내부 기계 디테일
      for (let a = 0; a < 8; a++) {
        const th = a / 8 * Math.PI * 2 + 0.3;
        R(g, 40 + Math.cos(th) * 14 - 1, 40 + Math.sin(th) * 14 - 1, 3, 3, '#8244d8');
      }
      // 중앙 눈
      NS.orb(g, 40, 40, 11, '#8c1660', '#4a0d36', '#e63e8f');
      NS.orb(g, 40, 40, 5, pose === 'open' ? '#ff9fd0' : '#e63e8f', '#8c1660', '#ffffff');
      R(g, 38, 36, 3, 3, '#ffffff');
      if (pose === 'hurt') { NS.orb(g, 40, 40, 7, '#ffffff', '#ff9fd0', '#ffffff'); }
    });
    S.bosses.kairos1 = { idle: [core1('idle'), core1('open')], open: [core1('open')], hurt: [core1('hurt')] };
    S.bosses.pod = [0, 1].map(f => NS.bake(20, 20, (g) => {
      NS.orb(g, 10, 10, 7, '#4a3c7e', '#2c2154', '#7a68b2');
      R(g, 6, 8 - f, 8, 4, '#38e0ff');
      R(g, 8, 9 - f, 4, 2, '#a8f6ff');
    }));
    // 카이로스 2형태 — 거대 두상 100×100 + 손 40×40
    const face = (pose) => NS.bake(108, 108, (g) => {
      // 후광 링
      for (let a = 0; a < 20; a++) {
        const th = a / 20 * Math.PI * 2;
        R(g, 54 + Math.cos(th) * 48 - 1, 54 + Math.sin(th) * 48 - 1, 3, 3, NS.rgba('#e63e8f', 0.6));
      }
      // 두상 실루엣
      NS.orb(g, 54, 50, 34, '#31284e', '#1c1633', '#5a4a86');
      R(g, 30, 62, 48, 30, '#31284e');
      R(g, 30, 84, 48, 8, '#1c1633');
      // 크라운 스파이크
      for (let i = 0; i < 5; i++) {
        const sx = 30 + i * 12;
        R(g, sx, 10 - (i === 2 ? 6 : 0), 5, 14, i === 2 ? '#e63e8f' : '#4a3c7e');
        R(g, sx + 1, 8 - (i === 2 ? 6 : 0), 3, 3, '#ff9fd0');
      }
      // 얼굴 판
      R(g, 36, 36, 36, 40, '#3d3260');
      R(g, 36, 36, 36, 3, '#6a5a9e');
      // 눈 2개
      for (const ex of [40, 58]) {
        R(g, ex, 46, 10, 7, P.ink);
        R(g, ex + 1, 47, 8, 5, pose === 'charge' ? '#ffffff' : pose === 'hurt' ? '#ffe66d' : '#e63e8f');
        R(g, ex + 2, 48, 3, 2, '#ffffff');
      }
      // 코/입 라인
      R(g, 52, 58, 4, 8, '#1c1633');
      R(g, 42, 70, 24, 3, '#1c1633');
      if (pose === 'charge') { R(g, 42, 69, 24, 5, '#e63e8f'); }
      // 볼 도관
      R(g, 32, 60, 4, 16, '#8244d8'); R(g, 72, 60, 4, 16, '#8244d8');
    });
    S.bosses.kairos2 = { idle: [face('idle'), face('idle')], charge: [face('charge')], hurt: [face('hurt')] };
    S.bosses.hand = ['open', 'fist'].map(k => NS.bake(44, 44, (g) => {
      if (k === 'open') {
        R(g, 8, 18, 28, 18, '#3d3260'); R(g, 8, 30, 28, 6, '#1c1633'); R(g, 8, 18, 28, 2, '#6a5a9e');
        for (let i = 0; i < 4; i++) { NS.limb(g, 12 + i * 7, 18, 12 + i * 7, 6, 4, '#4a3c7e', '#2c2154', '#7a68b2'); }
        R(g, 18, 24, 8, 6, '#e63e8f');
      } else {
        NS.orb(g, 22, 22, 15, '#3d3260', '#1c1633', '#6a5a9e');
        for (let i = 0; i < 4; i++) R(g, 10 + i * 7, 12, 5, 8, '#4a3c7e');
        R(g, 18, 22, 8, 6, '#e63e8f'); R(g, 20, 24, 4, 2, '#ff9fd0');
      }
    }));
  }
  NS.bakeBossSprites = bakeBosses;

  // ── 보스 공통 셸 ───────────────────────────────────────
  const Boss = {
    active: false, id: null, def: null,
    x: 0, y: 0, w: 60, h: 60, hp: 0, maxHp: 48, shownHp: 0,
    phase: 1, state: 'warning', t: 0, frame: 0, flash: 0, invulnT: 0,
    arena: null, onDefeat: null, pose: 'idle', vx: 0, vy: 0, subs: [],
    contactDmg: 3,

    start(id, arena, onDefeat) {
      this.id = id;
      this.def = BOSS_DEFS[id];
      this.arena = arena;
      this.onDefeat = onDefeat;
      this.active = true;
      this.state = 'warning'; this.t = 0; this.frame = 0;
      this.phase = 1; this.flash = 0; this.invulnT = 0;
      this.maxHp = this.def.hp; this.hp = this.def.hp; this.shownHp = 0;
      this.w = this.def.w; this.h = this.def.h;
      this.subs = [];
      this.pose = 'idle';
      this.hitboxTop = 0;
      this.x = arena.x1 - 120;
      this.y = arena.y1 - this.def.h - (this.def.hover || 0);
      this.vx = 0; this.vy = 0;
      NS.Level.camBounds = { x0: arena.x0, y0: arena.y0, x1: arena.x1, y1: arena.y1 };
      NS.Audio.sfx('warning');
      if (this.def.init) this.def.init(this);
    },
    get cx() { return this.x + this.w / 2; },
    get cy() { return this.y + this.h / 2; },
    get hpRatio() { return this.shownHp / this.maxHp; },

    clampToArena() {
      this.x = NS.clamp(this.x, this.arena.x0 + 6, this.arena.x1 - this.w - 6);
      this.y = NS.clamp(this.y, this.arena.y0 + 6, this.arena.y1 - this.h);
    },

    update(pl) {
      if (!this.active) return;
      this.frame++;
      this.t++;
      this.flash = NS.tick(this.flash);
      this.invulnT = NS.tick(this.invulnT);
      switch (this.state) {
        case 'warning':
          if (this.t > 110) { this.state = 'enter'; this.t = 0; NS.Audio.sfx('teleportIn'); }
          return;
        case 'enter':
          if (this.t > 40) {
            this.state = 'fill'; this.t = 0;
            NS.Audio.playBgm(this.def.finalForm ? 'finalBoss' : 'boss');
          }
          return;
        case 'fill':
          this.shownHp = Math.min(this.maxHp, this.shownHp + 1);
          if (this.t % 3 === 0) NS.Audio.sfx('chip');
          if (this.shownHp >= this.maxHp) { this.state = 'fight'; this.t = 0; }
          return;
        case 'dying':
          this.updateDying(pl);
          return;
        case 'fight': break;
        default: return;
      }
      this.shownHp = Math.max(this.hp, this.shownHp - 1);
      this.def.update(this, pl);
      this.clampToArena();

      // 접촉 대미지 (hitboxTop: 돌진 등 웅크린 자세에서 상단 클리어런스 허용)
      const hbTop = this.hitboxTop || 6;
      if (pl.alive && pl.invuln <= 0 && !this.noContact && NS.aabb(pl.x, pl.y, pl.w, pl.h, this.x + 6, this.y + hbTop, this.w - 12, this.h - hbTop - 6)) {
        pl.damage(this.contactDmg, NS.sign(pl.cx - this.cx) || 1);
      }
      // 피격
      for (const s of NS.Shots.list) {
        if (s.dead || s.hits.has(this)) continue;
        if (!NS.aabb(s.x, s.y, s.w, s.h, this.x, this.y, this.w, this.h)) continue;
        s.hits.add(this);
        if (this.invulnT > 0 || this.def.blocks && this.def.blocks(this, s)) {
          NS.Audio.sfx('clink');
          NS.FX.sparks(s.x + s.w / 2, s.y + s.h / 2, -NS.sign(s.vx));
          if (!s.pierce) s.dead = true;
          continue;
        }
        let dmg = s.dmg;
        if (s.elem && s.elem === this.def.weak) { dmg *= 2; NS.FX.popup(this.cx, this.y - 8, '약점!', '#ffe66d'); }
        else if (s.elem && this.def.resist === s.elem) dmg = Math.max(1, Math.floor(dmg / 2));
        this.hp -= dmg;
        this.flash = 5;
        this.invulnT = this.def.hitInvuln || 12;
        NS.Audio.sfx('bossHit');
        NS.FX.hitstop(dmg >= 4 ? 4 : 2);
        NS.FX.hitSpark(s.x + s.w / 2, s.y + s.h / 2);
        NS.FX.popup(s.x + s.w / 2, this.y - 2, `${dmg}`, '#a8f6ff');
        if (!s.pierce) s.dead = true;
        // 페이즈 전환
        if (this.phase === 1 && this.hp <= this.maxHp / 2 && !this.def.noPhase) {
          this.phase = 2;
          this.invulnT = 50;
          this.state = 'fight'; this.t = 0; this.pattern = null;
          NS.Audio.sfx('phase');
          NS.FX.flash('#ffffff', 14);
          NS.FX.shake(4, 24);
          NS.FX.burst(this.cx, this.cy, 24, { color: [P.white, P.magenta3, P.cyan3], spMax: 4 });
          if (this.def.onPhase2) this.def.onPhase2(this);
        }
        if (this.hp <= 0) {
          this.hp = 0;
          this.state = 'dying'; this.t = 0;
          NS.Audio.stopBgm();
          NS.FX.slowmo(0.25, 60);
          NS.FX.shake(5, 30);
          NS.EBullets.reset();
          this.subs = [];
        }
      }
    },
    updateDying(pl) {
      if (this.t % 9 === 0 && this.t < 100) {
        NS.FX.explode(this.x + NS.rand(6, this.w - 6), this.y + NS.rand(6, this.h - 6), this.t % 27 === 0);
      }
      if (this.t === 100) {
        NS.FX.flash('#ffffff', 24);
        NS.FX.explode(this.cx, this.cy, true);
      }
      if (this.t > 130) {
        this.active = false;
        const cb = this.onDefeat;
        this.onDefeat = null;
        if (cb) cb();
      }
    },

    draw(g, cx, cy) {
      if (!this.active) return;
      if (this.state === 'warning') return;
      if (this.state === 'enter') {
        // 텔레포트 빔
        const t = this.t / 40;
        g.fillStyle = P.magenta2;
        g.fillRect(Math.round(this.cx - 4 - cx), 0, 8, Math.round(NS.lerp(0, this.y + this.h - cy, Math.min(1, t * 1.8))));
        return;
      }
      if (this.state === 'dying' && this.t > 100) return;
      const spr = NS.Sprites.bosses[this.def.sprite];
      let frames = spr[this.pose] || spr.idle;
      if (this.flash > 0 && spr.hurt) frames = spr.hurt;
      const fi = Math.floor(this.frame / 16) % frames.length;
      const img = frames[fi];
      const flip = this.def.faces ? (pl => false)() : (NS.Player.cx < this.cx);
      const dx = this.cx - img.width / 2 - cx;
      const dy = this.y + this.h - img.height - cy;
      if (!this.def.hover) NS.groundShadow(g, this.cx - cx, this.y + this.h - cy, this.w);
      NS.blit(g, img, dx, dy, flip);
      if (this.flash > 0) {
        g.globalAlpha = 0.6;
        g.fillStyle = '#ffffff';
        g.fillRect(Math.round(dx), Math.round(dy), img.width, img.height);
        g.globalAlpha = 1;
      }
      if (this.def.drawExtra) this.def.drawExtra(this, g, cx, cy);
    },
  };
  NS.Boss = Boss;

  // ── 텔레그래프 마커 헬퍼 (지면 경고 표시) ──────────────
  const markers = [];
  NS.BossMarkers = {
    get list() { return markers; },
    add(x, y, w, h, life) { markers.push({ x, y, w, h, life, max: life }); },
    reset() { markers.length = 0; },
    update() {
      for (let i = markers.length - 1; i >= 0; i--) {
        markers[i].life--;
        if (!(markers[i].life > 0)) markers.splice(i, 1);
      }
    },
    draw(g, cx, cy) {
      for (const m of markers) {
        const a = 0.25 + 0.2 * Math.sin(m.life * 0.6);
        g.fillStyle = NS.rgba('#e04545', a);
        g.fillRect(Math.round(m.x - cx), Math.round(m.y - cy), m.w, m.h);
        g.strokeStyle = NS.rgba('#ff9070', a + 0.25);
        g.lineWidth = 1;
        g.strokeRect(Math.round(m.x - cx) + 0.5, Math.round(m.y - cy) + 0.5, m.w - 1, m.h - 1);
      }
    },
  };

  // ── 보스 정의 ──────────────────────────────────────────
  const BOSS_DEFS = {
    // ═══ 이그니스 몰록 ═══
    moloch: {
      name: '이그니스 몰록', sprite: 'moloch', w: 72, h: 80, hp: 44,
      weak: 'wind', resist: 'fire', hitInvuln: 10,
      update(b, pl) {
        const groundY = b.arena.y1 - b.h;
        if (!b.pattern) {
          b.pattern = NS.pick(b.phase === 1 ? ['lob', 'slamCharge', 'lob'] : ['lob', 'slamCharge', 'meteor']);
          b.t = 0; b.pose = 'idle';
        }
        const speedUp = b.phase === 2 ? 0.75 : 1;
        if (b.pattern === 'lob') {
          if (b.t === Math.round(28 * speedUp)) { b.pose = 'lob'; NS.Audio.sfx('telegraph'); }
          if (b.t === Math.round(58 * speedUp)) {
            for (let i = 0; i < (b.phase === 2 ? 4 : 3); i++) {
              const dx = pl.cx - b.cx + (i - 1) * 40;
              NS.EBullets.spawn({
                x: b.cx, y: b.y + 20, sprite: 'lavaGlob', w: 10, h: 10,
                vx: NS.clamp(dx / 60, -3, 3), vy: -5.2, gravity: 0.18, dmg: 3,
              });
            }
            NS.Audio.sfx('shot2');
          }
          if (b.t > 90 * speedUp) b.pattern = null;
        } else if (b.pattern === 'slamCharge') {
          if (b.t === 1) { b.pose = 'raise'; NS.Audio.sfx('telegraph'); b.chargeDir = NS.sign(pl.cx - b.cx) || -1; }
          if (b.t === Math.round(36 * speedUp)) { b.pose = 'slam'; b.hitboxTop = 44; }
          if (b.t > 36 * speedUp && b.t < 100 * speedUp) {
            b.x += b.chargeDir * 3.6;
            if (b.frame % 4 === 0) NS.FX.burst(b.cx - b.chargeDir * 20, b.arena.y1 - 6, 2, { color: [P.orange3, P.red2], up: 1 });
            // 벽 도달 → 충격파
            if (b.x <= b.arena.x0 + 8 || b.x + b.w >= b.arena.x1 - 8) {
              b.t = Math.round(100 * speedUp);
            }
          }
          if (b.t === Math.round(100 * speedUp)) {
            NS.FX.shake(5, 20); NS.Audio.sfx('bigExplode');
            NS.FX.burst(b.cx, b.arena.y1, 16, { color: [P.orange3, P.yellow], up: 2.5, spMax: 3 });
            for (const d of [-1, 1]) {
              NS.EBullets.spawn({
                x: b.cx, y: b.arena.y1 - 10, w: 12, h: 10, sprite: 'lavaGlob',
                vx: d * 3.2, vy: 0, dmg: 3, ignoreWall: false, life: 80,
                update(bl) { if (!NS.Level.solidAt(bl.x + 6, bl.y + 14)) bl.vy = Math.min(4, bl.vy + 0.3); else bl.vy = 0; },
              });
            }
          }
          if (b.t > 130 * speedUp) { b.pattern = 'return'; b.pose = 'idle'; b.hitboxTop = 0; b.t = 0; }
        } else if (b.pattern === 'return') {
          // 돌진 후 중앙 복귀 — 코너에 눌러앉아 플레이어를 가두지 않는다
          const mid = (b.arena.x0 + b.arena.x1) / 2;
          b.x += NS.sign(mid - b.cx) * 1.5;
          if (Math.abs(b.cx - mid) < 80 || b.t > 160) b.pattern = null;
        } else { // meteor (P2)
          if (b.t === 1) { b.pose = 'raise'; NS.Audio.sfx('warning'); }
          if (b.t === 30) {
            b.meteorXs = [];
            for (let i = 0; i < 5; i++) {
              const mx = b.arena.x0 + 30 + i * ((b.arena.x1 - b.arena.x0 - 60) / 4) + NS.rand(-14, 14);
              b.meteorXs.push(mx);
              NS.BossMarkers.add(mx - 10, b.arena.y1 - 90, 20, 90, 45);
            }
          }
          if (b.t === 75) {
            for (const mx of b.meteorXs) {
              NS.EBullets.spawn({ x: mx - 6, y: b.arena.y0 - 10, sprite: 'lavaGlob', w: 12, h: 12, vx: 0, vy: 5.2, dmg: 4,
                onWall(bl) { bl.dead = true; NS.FX.burst(bl.x + 6, bl.y + 8, 8, { color: [P.orange3, P.red2, P.yellow], up: 1.5 }); NS.Audio.sfx('explode'); } });
            }
            NS.FX.shake(3, 12);
          }
          if (b.t > 120) { b.pattern = null; b.pose = 'idle'; }
        }
        // 중력 (제자리 유지)
        if (b.pattern !== 'slamCharge') {
          b.y = NS.lerp(b.y, groundY, 0.3);
        } else b.y = groundY;
      },
    },

    // ═══ 글레이셔 팬텀 ═══
    phantom: {
      name: '글레이셔 팬텀', sprite: 'phantom', w: 48, h: 68, hp: 46,
      weak: 'fire', resist: 'ice', hover: 40, hitInvuln: 10,
      init(b) { b.hoverT = 0; b.clones = []; },
      update(b, pl) {
        b.hoverT++;
        const baseY = b.arena.y1 - b.h - 40;
        if (!b.pattern) {
          b.pattern = NS.pick(b.phase === 1 ? ['volley', 'mirror', 'volley'] : ['volley', 'mirror', 'clones', 'rain']);
          b.t = 0; b.pose = 'idle';
        }
        const drift = Math.sin(b.hoverT * 0.04) * 0.6;
        if (b.pattern === 'volley') {
          b.y = baseY + Math.sin(b.hoverT * 0.06) * 8;
          b.x += drift;
          if (b.t === 24) { b.pose = 'cast'; NS.Audio.sfx('telegraph'); }
          if (b.t === 54) {
            const n = b.phase === 2 ? 7 : 5;
            for (let i = 0; i < n; i++) {
              const a = NS.angleTo(b.cx, b.cy, pl.cx, pl.cy) + (i - (n - 1) / 2) * 0.22;
              NS.EBullets.spawn({ x: b.cx, y: b.cy, sprite: 'icicle', w: 6, h: 12, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, dmg: 2 });
            }
            NS.Audio.sfx('freeze');
          }
          if (b.t > 84) b.pattern = null;
        } else if (b.pattern === 'mirror') {
          if (b.t === 1) { NS.Audio.sfx('teleport'); NS.FX.burst(b.cx, b.cy, 10, { color: [P.cyan3, P.white] }); }
          if (b.t === 20) {
            // 플레이어 반대편에 재출현 + 대시 라인 텔레그래프
            b.x = pl.cx < (b.arena.x0 + b.arena.x1) / 2 ? b.arena.x1 - 90 : b.arena.x0 + 40;
            b.y = NS.clamp(pl.y - 20, b.arena.y0 + 20, baseY);
            b.dashY = b.y + b.h / 2;
            NS.BossMarkers.add(b.arena.x0, b.dashY - 10, b.arena.x1 - b.arena.x0, 20, 34);
            NS.Audio.sfx('teleportIn');
            NS.Audio.sfx('telegraph');
          }
          if (b.t === 54) { b.pose = 'dash'; b.dashDir = b.x < (b.arena.x0 + b.arena.x1) / 2 ? 1 : -1; NS.Audio.sfx('dash'); }
          if (b.t > 54 && b.t < 100) {
            b.x += b.dashDir * (b.phase === 2 ? 6 : 4.8);
            if (b.frame % 3 === 0) {
              const spr = NS.Sprites.bosses.phantom.dash[0];
              NS.FX.ghost(spr, b.cx - spr.width / 2, b.y + b.h - spr.height, b.dashDir < 0);
            }
            if (b.x <= b.arena.x0 + 8 || b.x + b.w >= b.arena.x1 - 8) b.t = 100;
          }
          if (b.t >= 100) { b.pose = 'idle'; b.pattern = null; }
        } else if (b.pattern === 'clones') {
          if (b.t === 1) {
            NS.Audio.sfx('teleport');
            b.clones = [-1, 1].map(d => ({ off: d * 70, alpha: 0.55 }));
          }
          b.y = baseY + Math.sin(b.hoverT * 0.06) * 8;
          if (b.t === 40 || b.t === 70 || b.t === 100) {
            // 본체+클론이 순차 아이시클
            const srcs = [b.cx, b.cx + (b.clones[0] ? b.clones[0].off : 0), b.cx + (b.clones[1] ? b.clones[1].off : 0)];
            const src = srcs[(b.t - 40) / 30];
            NS.EBullets.aimed(src, b.cy, pl.cx, pl.cy, 3.4, { sprite: 'icicle', w: 6, h: 12, dmg: 2 });
            NS.Audio.sfx('freeze');
          }
          if (b.t > 130) { b.clones = []; b.pattern = null; }
        } else { // rain (P2)
          if (b.t === 1) { b.pose = 'cast'; NS.Audio.sfx('warning'); }
          if (b.t === 30) {
            for (let i = 0; i < 6; i++) {
              const mx = b.arena.x0 + 24 + i * ((b.arena.x1 - b.arena.x0 - 48) / 5);
              NS.BossMarkers.add(mx - 8, b.arena.y0, 16, b.arena.y1 - b.arena.y0, 40);
            }
          }
          if (b.t === 70) {
            for (let i = 0; i < 6; i++) {
              const mx = b.arena.x0 + 24 + i * ((b.arena.x1 - b.arena.x0 - 48) / 5);
              NS.EBullets.spawn({ x: mx - 3, y: b.arena.y0 - 8, sprite: 'icicle', w: 6, h: 12, vx: 0, vy: 4.6, dmg: 3 });
            }
            NS.Audio.sfx('freeze');
          }
          if (b.t > 110) { b.pose = 'idle'; b.pattern = null; }
        }
      },
      drawExtra(b, g, cx, cy) {
        for (const c of b.clones || []) {
          const spr = NS.Sprites.bosses.phantom.idle[0];
          g.globalAlpha = c.alpha;
          NS.blit(g, spr, b.cx + c.off - spr.width / 2 - cx, b.y + b.h - spr.height - cy, NS.Player.cx < b.cx + c.off);
          g.globalAlpha = 1;
        }
      },
    },

    // ═══ 템페스트 로크 ═══
    roc: {
      name: '템페스트 로크', sprite: 'roc', w: 90, h: 70, hp: 52,
      weak: 'ice', resist: 'wind', hover: 60, hitInvuln: 10,
      init(b) { b.addTimer = 0; },
      update(b, pl) {
        const baseY = b.arena.y0 + 50;
        if (!b.pattern) {
          b.pattern = NS.pick(b.phase === 1 ? ['feathers', 'dive', 'gust'] : ['feathers', 'dive', 'lightning', 'dive']);
          b.t = 0; b.pose = 'fly';
        }
        if (b.pattern === 'feathers') {
          b.y = NS.lerp(b.y, baseY, 0.08);
          b.x = NS.lerp(b.x, NS.clamp(pl.cx - b.w / 2, b.arena.x0 + 20, b.arena.x1 - b.w - 20), 0.05);
          if (b.t === 24) { b.pose = 'screech'; NS.Audio.sfx('telegraph'); }
          if (b.t === 50) {
            const n = b.phase === 2 ? 7 : 5;
            for (let i = 0; i < n; i++) {
              const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.3;
              NS.EBullets.spawn({ x: b.cx, y: b.y + b.h - 10, sprite: 'feather', w: 12, h: 6, vx: Math.cos(a) * 2.8, vy: Math.sin(a) * 2.8, dmg: 2 });
            }
            NS.Audio.sfx('shot2');
          }
          if (b.t > 80) b.pattern = null;
        } else if (b.pattern === 'dive') {
          if (b.t === 1) { b.diveX = pl.cx; NS.BossMarkers.add(b.diveX - 24, b.arena.y1 - 8, 48, 8, 40); NS.Audio.sfx('telegraph'); }
          if (b.t < 40) { b.y = NS.lerp(b.y, b.arena.y0 + 24, 0.1); b.x = NS.lerp(b.x, NS.clamp(b.diveX - b.w / 2, b.arena.x0 + 10, b.arena.x1 - b.w - 10), 0.15); }
          if (b.t === 40) { b.pose = 'dive'; NS.Audio.sfx('dash'); b.vy = 0; }
          if (b.t > 40 && b.t < 90) {
            b.vy = Math.min(6.5, b.vy + 0.5);
            b.y += b.vy;
            if (b.y + b.h >= b.arena.y1 - 4) {
              b.y = b.arena.y1 - 4 - b.h;
              b.t = 90;
              NS.FX.shake(4, 14); NS.Audio.sfx('bigExplode');
              NS.FX.burst(b.cx, b.arena.y1, 14, { color: [P.violet3, P.steel4], up: 2 });
              // 착지 돌풍탄
              for (const d of [-1, 1]) NS.EBullets.spawn({ x: b.cx, y: b.arena.y1 - 12, sprite: 'feather', w: 12, h: 6, vx: d * 3.4, vy: 0, dmg: 2, life: 70 });
            }
          }
          if (b.t > 90) { b.pose = 'fly'; b.y -= 2.4; if (b.y <= baseY) { b.pattern = null; } }
        } else if (b.pattern === 'gust') {
          b.y = NS.lerp(b.y, baseY, 0.1);
          b.x = NS.lerp(b.x, (b.arena.x0 + b.arena.x1) / 2 - b.w / 2, 0.06);
          if (b.t === 20) NS.Audio.sfx('telegraph');
          if (b.t > 40 && b.t < 150) {
            // 밀어내기 바람 + 시각화
            const dir = NS.sign(pl.cx - b.cx) || 1;
            pl.x += dir * 0.9;
            if (b.frame % 2 === 0) {
              NS.FX.p({ x: b.cx + NS.rand(-40, 40), y: b.y + b.h + NS.rand(0, 60), vx: dir * NS.rand(2, 4), vy: NS.rand(-0.5, 0.5), life: 20, size: 1, color: NS.rgba('#c8d8ff', 0.6) });
            }
          }
          if (b.t > 160) b.pattern = null;
        } else { // lightning (P2)
          b.y = NS.lerp(b.y, b.arena.y0 + 30, 0.08);
          if (b.t === 1) { b.pose = 'screech'; NS.Audio.sfx('warning'); }
          if (b.t === 30) {
            b.boltXs = [pl.cx, pl.cx - 70, pl.cx + 70].map(x => NS.clamp(x, b.arena.x0 + 16, b.arena.x1 - 16));
            for (const bx of b.boltXs) NS.BossMarkers.add(bx - 8, b.arena.y0, 16, b.arena.y1 - b.arena.y0, 46);
          }
          if (b.t === 76) {
            NS.Audio.sfx('thunder');
            NS.FX.flash('#e8e4ff', 8);
            for (const bx of b.boltXs) {
              for (let y = b.arena.y0; y < b.arena.y1; y += 14) {
                NS.EBullets.spawn({ x: bx - 3, y, w: 6, h: 12, vx: 0, vy: 0, dmg: 4, life: 14, sprite: 'enemy', ignoreWall: true });
              }
              NS.FX.burst(bx, b.arena.y1 - 10, 8, { color: [P.yellow, P.white], up: 2 });
            }
          }
          if (b.t > 110) { b.pose = 'fly'; b.pattern = null; }
          // 애드 스폰 (최대 1)
          b.addTimer++;
          if (b.addTimer > 300 && NS.Enemies.list.length < 1) {
            b.addTimer = 0;
            NS.Enemies.spawn('glider', b.cx, b.y + b.h + 20);
          }
        }
      },
    },

    // ═══ 카이로스 1형태 ═══
    kairos1: {
      name: '카이로스', sprite: 'kairos1', w: 60, h: 60, hp: 56,
      hover: 70, hitInvuln: 8, finalForm: true,
      init(b) {
        b.pods = [0, 1, 2, 3].map(i => ({ a: i * Math.PI / 2, r: 46, hp: 3, dead: false, regen: 0 }));
        b.spin = 0.02;
      },
      blocks(b, s) {
        // 포드가 실드 — 발사체가 포드에 먼저 맞으면 차단
        for (const pod of b.pods) {
          if (pod.dead) continue;
          const px = b.cx + Math.cos(pod.a) * pod.r - 8, py = b.cy + Math.sin(pod.a) * pod.r - 8;
          if (NS.aabb(s.x, s.y, s.w, s.h, px, py, 16, 16)) {
            pod.hp -= s.dmg;
            if (pod.hp <= 0) { pod.dead = true; pod.regen = 420; NS.FX.explode(px + 8, py + 8, false); }
            else { NS.Audio.sfx('clink'); NS.FX.sparks(px + 8, py + 8, -NS.sign(s.vx)); }
            return true;
          }
        }
        return false;
      },
      update(b, pl) {
        const midX = (b.arena.x0 + b.arena.x1) / 2;
        b.x = NS.lerp(b.x, midX - b.w / 2 + Math.sin(b.frame * 0.02) * 60, 0.04);
        b.y = b.arena.y0 + 40 + Math.sin(b.frame * 0.035) * 22;
        // 포드 회전/재생
        for (const pod of b.pods) {
          pod.a += b.spin * (b.phase === 2 ? 1.6 : 1);
          if (pod.dead) { pod.regen--; if (!(pod.regen > 0)) { pod.dead = false; pod.hp = 3; NS.Audio.sfx('teleportIn'); } }
        }
        if (!b.pattern) {
          b.pattern = NS.pick(b.phase === 1 ? ['ring', 'sweep', 'contract'] : ['ring', 'sweep', 'contract', 'ring']);
          b.t = 0;
        }
        if (b.pattern === 'ring') {
          if (b.t === 20) { b.pose = 'open'; NS.Audio.sfx('telegraph'); }
          if (b.t === 46 || (b.phase === 2 && b.t === 66)) {
            const n = 8;
            for (let i = 0; i < n; i++) {
              const a = i / n * Math.PI * 2 + b.frame * 0.01;
              NS.EBullets.spawn({ x: b.cx - 5, y: b.cy - 5, sprite: 'ringShot', w: 10, h: 10, vx: Math.cos(a) * 1.9, vy: Math.sin(a) * 1.9, dmg: 3, ignoreWall: true, life: 130 });
            }
            NS.Audio.sfx('shot2');
          }
          if (b.t > 96) { b.pose = 'idle'; b.pattern = null; }
        } else if (b.pattern === 'sweep') {
          if (b.t === 1) {
            b.sweepA = NS.angleTo(b.cx, b.cy, pl.cx, pl.cy);
            NS.Audio.sfx('warning');
          }
          if (b.t > 20 && b.t < 50 && b.t % 4 === 0) {
            // 레이저 예고선 파티클
            for (let d = 20; d < 300; d += 16) {
              NS.FX.p({ x: b.cx + Math.cos(b.sweepA) * d, y: b.cy + Math.sin(b.sweepA) * d, vx: 0, vy: 0, life: 8, size: 2, color: NS.rgba('#e63e8f', 0.7) });
            }
          }
          if (b.t >= 50 && b.t < 110 && b.t % 3 === 0) {
            NS.EBullets.spawn({ x: b.cx - 4, y: b.cy - 4, sprite: 'ringShot', w: 8, h: 8, vx: Math.cos(b.sweepA) * 5, vy: Math.sin(b.sweepA) * 5, dmg: 3, ignoreWall: true, life: 90 });
            b.sweepA += (b.phase === 2 ? 0.055 : 0.04) * (b.sweepDir || 1);
            if (b.t === 51) NS.Audio.sfx('shot3');
          }
          if (b.t > 130) { b.pattern = null; b.sweepDir = -(b.sweepDir || 1); }
        } else { // contract — 포드 확장/수축 압박
          const target = b.t < 60 ? 90 : 26;
          for (const pod of b.pods) pod.r = NS.lerp(pod.r, target, 0.06);
          if (b.t === 1) NS.Audio.sfx('telegraph');
          if (b.t > 120) {
            for (const pod of b.pods) pod.r = NS.lerp(pod.r, 46, 0.5);
            b.pattern = null;
          }
        }
        // 포드 접촉 대미지
        for (const pod of b.pods) {
          if (pod.dead) continue;
          const px = b.cx + Math.cos(pod.a) * pod.r - 8, py = b.cy + Math.sin(pod.a) * pod.r - 8;
          if (pl.alive && pl.invuln <= 0 && NS.aabb(pl.x, pl.y, pl.w, pl.h, px + 2, py + 2, 12, 12)) {
            pl.damage(3, NS.sign(pl.cx - px) || 1);
          }
        }
      },
      drawExtra(b, g, cx, cy) {
        const podImg = NS.Sprites.bosses.pod;
        for (const pod of b.pods) {
          if (pod.dead) continue;
          const px = b.cx + Math.cos(pod.a) * pod.r, py = b.cy + Math.sin(pod.a) * pod.r;
          NS.blit(g, podImg[Math.floor(b.frame / 8) % 2], px - 10 - cx, py - 10 - cy);
        }
      },
    },

    // ═══ 카이로스 2형태 (최종) ═══
    kairos2: {
      name: '카이로스 · 진 형태', sprite: 'kairos2', w: 84, h: 96, hp: 64,
      hover: 30, hitInvuln: 8, finalForm: true, contact: 4,
      init(b) {
        b.hands = [
          { x: 0, y: 0, state: 'hover', t: 0, side: -1, pose: 0 },
          { x: 0, y: 0, state: 'hover', t: 0, side: 1, pose: 0 },
        ];
        b.noContactT = 0;
      },
      update(b, pl) {
        const midX = (b.arena.x0 + b.arena.x1) / 2;
        b.x = NS.lerp(b.x, midX - b.w / 2, 0.03);
        b.y = b.arena.y0 + 26 + Math.sin(b.frame * 0.03) * 10;
        // 손 기본 위치
        for (const h of b.hands) {
          if (h.state === 'hover') {
            h.x = NS.lerp(h.x, b.cx + h.side * 90 - 22, 0.08);
            h.y = NS.lerp(h.y, b.cy + 10 + Math.sin(b.frame * 0.05 + h.side) * 12, 0.08);
            h.pose = 0;
          }
        }
        if (!b.pattern) {
          b.pattern = NS.pick(b.phase === 1 ? ['handSlam', 'eyeBeam', 'spiral'] : ['handSlam', 'eyeBeam', 'spiral', 'doubleSlam']);
          b.t = 0;
        }
        const hands = b.hands;
        if (b.pattern === 'handSlam' || b.pattern === 'doubleSlam') {
          const both = b.pattern === 'doubleSlam';
          if (b.t === 1) {
            b.slamHands = both ? [0, 1] : [pl.cx < b.cx ? 0 : 1];
            for (const hi of b.slamHands) {
              hands[hi].state = 'raise'; hands[hi].t = 0;
              hands[hi].tx = NS.clamp(pl.cx - 22 + (both ? hands[hi].side * 50 : 0), b.arena.x0 + 10, b.arena.x1 - 54);
              NS.BossMarkers.add(hands[hi].tx, b.arena.y1 - 10, 44, 10, 50);
            }
            NS.Audio.sfx('telegraph');
          }
          for (const hi of (b.slamHands || [])) {
            const h = hands[hi];
            h.t++;
            if (h.state === 'raise') {
              h.x = NS.lerp(h.x, h.tx, 0.15);
              h.y = NS.lerp(h.y, b.arena.y0 + 20, 0.15);
              h.pose = 1;
              if (h.t > 46) { h.state = 'slam'; h.vy = 0; }
            } else if (h.state === 'slam') {
              h.vy = Math.min(9, (h.vy || 0) + 0.8);
              h.y += h.vy;
              if (h.y + 44 >= b.arena.y1) {
                h.y = b.arena.y1 - 44;
                h.state = 'rest'; h.t = 0;
                NS.FX.shake(5, 16); NS.Audio.sfx('bigExplode');
                NS.FX.burst(h.x + 22, b.arena.y1, 12, { color: [P.magenta3, P.violet3], up: 2 });
                for (const d of [-1, 1]) NS.EBullets.spawn({ x: h.x + 22, y: b.arena.y1 - 10, sprite: 'ringShot', w: 8, h: 8, vx: d * 3, vy: 0, dmg: 3, life: 60 });
              }
            } else if (h.state === 'rest') {
              if (h.t > 50) h.state = 'hover';
            }
          }
          if (b.t > 130) b.pattern = null;
        } else if (b.pattern === 'eyeBeam') {
          if (b.t === 12) { b.pose = 'charge'; NS.Audio.sfx('warning'); }
          if (b.t > 30 && b.t < 60 && b.t % 4 === 0) {
            const a = NS.angleTo(b.cx, b.cy + 6, pl.cx, pl.cy);
            b.beamA = a;
            for (let d = 30; d < 260; d += 18)
              NS.FX.p({ x: b.cx + Math.cos(a) * d, y: b.cy + 6 + Math.sin(a) * d, vx: 0, vy: 0, life: 6, size: 2, color: NS.rgba('#e63e8f', 0.8) });
          }
          if (b.t === 60) NS.Audio.sfx('shot3');
          if (b.t >= 60 && b.t < 96 && b.t % 2 === 0) {
            NS.EBullets.spawn({ x: b.cx - 4, y: b.cy + 2, sprite: 'ringShot', w: 8, h: 8, vx: Math.cos(b.beamA) * 6.5, vy: Math.sin(b.beamA) * 6.5, dmg: 4, ignoreWall: true, life: 80 });
          }
          if (b.t > 110) { b.pose = 'idle'; b.pattern = null; }
        } else { // spiral
          if (b.t === 10) NS.Audio.sfx('telegraph');
          if (b.t > 30 && b.t < (b.phase === 2 ? 150 : 110) && b.t % 7 === 0) {
            const a = b.t * 0.55;
            for (const off of [0, Math.PI]) {
              NS.EBullets.spawn({ x: b.cx - 5, y: b.cy - 5, sprite: 'ringShot', w: 10, h: 10, vx: Math.cos(a + off) * 2.2, vy: Math.sin(a + off) * 2.2, dmg: 3, ignoreWall: true, life: 140 });
            }
            if (b.t % 21 === 0) NS.Audio.sfx('shot');
          }
          if (b.t > 160) b.pattern = null;
        }
        // 손 접촉 대미지
        for (const h of hands) {
          if (pl.alive && pl.invuln <= 0 && NS.aabb(pl.x, pl.y, pl.w, pl.h, h.x + 8, h.y + 8, 28, 28)) {
            pl.damage(3, NS.sign(pl.cx - (h.x + 22)) || 1);
          }
        }
      },
      drawExtra(b, g, cx, cy) {
        const handImg = NS.Sprites.bosses.hand;
        for (const h of b.hands) {
          NS.blit(g, handImg[h.pose], h.x - cx, h.y - cy, h.side < 0);
        }
      },
    },
  };
  NS.BOSS_DEFS = BOSS_DEFS;
})();
