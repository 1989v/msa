// NOVA STRIKE — enemies: 적 8종 (전원 텔레그래프 보유) + 아이템/드롭 + 스포너
'use strict';
(function () {
  const P = NS.PAL;
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // ── 적 스프라이트 베이크 ───────────────────────────────
  function bakeEnemies() {
    const S = NS.Sprites;
    S.enemies = {};
    // 1. 스캐럽 워커 (28×20)
    S.enemies.walker = [0, 1, 2].map(f => NS.bake(30, 24, (g) => {
      const legUp = f === 1 ? 1 : 0;
      // 다리 4개
      for (let i = 0; i < 4; i++) {
        const lx = 5 + i * 6, up = (i % 2 === f % 2) ? 1 : 0;
        NS.limb(g, lx + 2, 14, lx, 20 - up, 3, P.steel2, P.steel1, null);
      }
      // 등딱지
      NS.orb(g, 15, 11 - legUp, 10, '#7e3a4a', '#54202e', '#b86a6a');
      R(g, 6, 8 - legUp, 18, 3, '#b86a6a');
      R(g, 9, 4 - legUp, 12, 2, '#e04545');
      // 코어 눈
      R(g, 22, 10 - legUp, 5, 4, P.ink);
      R(g, 23, 11 - legUp, 3, 2, f === 2 ? P.yellow : P.red2);
      R(g, 12, 12 - legUp, 3, 2, '#54202e'); R(g, 17, 12 - legUp, 3, 2, '#54202e');
    }));
    // 2. 터렛 돔 (22×18) — 닫힘/열림중/열림
    S.enemies.turret = [0, 1, 2].map(f => NS.bake(24, 20, (g) => {
      R(g, 2, 15, 20, 4, P.steel2); R(g, 2, 15, 20, 1, P.steel4);
      const lift = f * 3;
      NS.orb(g, 12, 12 - lift, 9, P.steel3, P.steel2, P.steel4);
      R(g, 3, 12 - lift, 18, Math.max(0, 4 + lift - 4), P.steel3);
      if (f > 0) {
        R(g, 4, 12 - lift + 3, 16, lift + 1, P.night1);
        R(g, 9, 13 - lift + 2, 6, 4, P.magenta1);
        R(g, 10, 14 - lift + 2, 4, 2, f === 2 ? P.magenta3 : P.magenta2);
      }
      R(g, 6, 7 - lift, 5, 2, P.steel5);
    }));
    // 3. 드론 위습 (20×20)
    S.enemies.wisp = [0, 1, 2].map(f => NS.bake(22, 22, (g) => {
      const bob = f === 1 ? 1 : 0;
      // 로터
      R(g, 3, 2 + bob, 16, 2, f % 2 ? P.steel4 : P.steel3);
      R(g, 10, 4 + bob, 2, 3, P.steel2);
      NS.orb(g, 11, 12 + bob, 7, '#3d5a8e', '#243a66', '#6a8ec2');
      // 렌즈 눈
      R(g, 8, 9 + bob, 7, 5, P.ink);
      R(g, 9, 10 + bob, 5, 3, f === 2 ? P.red2 : P.cyan2);
      R(g, 10, 10 + bob, 2, 1, P.white);
      // 하부 침
      R(g, 10, 18 + bob, 3, 3, P.steel2); R(g, 11, 21 + bob, 1, 1, P.steel4);
    }));
    // 4. 마그마 스피터 (26×18)
    S.enemies.spitter = [0, 1].map(f => NS.bake(28, 20, (g) => {
      R(g, 2, 14, 24, 5, '#54303a'); R(g, 2, 14, 24, 1, '#8a5152');
      // 포탑 입
      NS.orb(g, 14, 10, 8, '#7e3a2a', '#4a1e18', '#b86a4a');
      R(g, 8, 4, 12, 4, '#b86a4a');
      R(g, 10, 2, 8, 4, P.ink);
      R(g, 11, 3, 6, 3, f ? P.yellow : P.orange2);
      if (f) { R(g, 12, 0, 4, 2, P.orange3); }
      R(g, 5, 12, 3, 2, '#4a1e18'); R(g, 20, 12, 3, 2, '#4a1e18');
    }));
    // 5. 크라이오 센트리 (20×30)
    S.enemies.sentry = [0, 1, 2].map(f => NS.bake(22, 32, (g) => {
      R(g, 4, 27, 14, 4, P.steel2); R(g, 4, 27, 14, 1, P.steel4);
      // 크리스털 본체
      for (let i = 0; i < 10; i += 2) {
        const w = 12 - i;
        R(g, 11 - w / 2, 4 + i * 2.2, w, 3, i < 4 ? '#8fc6ea' : '#4a7ec2');
      }
      R(g, 8, 6, 3, 10, '#e8fbff');
      // 코어 눈
      R(g, 8, 14, 7, 5, P.ink);
      R(g, 9, 15, 5, 3, f === 2 ? P.white : f === 1 ? P.cyan3 : P.cyan1);
      if (f === 1) R(g, 4, 16, 3, 1, P.cyan3);
    }));
    // 6. 글라이더 블레이드 (28×16)
    S.enemies.glider = [0, 1].map(f => NS.bake(30, 18, (g) => {
      const wing = f ? -2 : 2;
      // 날개
      NS.limb(g, 8, 8, 1, 8 + wing, 3, '#4a3c7e', '#332a58', '#6a5a9e');
      NS.limb(g, 22, 8, 29, 8 + wing, 3, '#4a3c7e', '#332a58', '#6a5a9e');
      // 동체
      NS.orb(g, 15, 9, 6, '#5e4a92', '#3d2f66', '#8a70c2');
      R(g, 18, 7, 6, 3, '#8a70c2');
      R(g, 22, 8, 4, 2, P.ink); R(g, 23, 8, 2, 1, P.magenta2);
      // 블레이드 꼬리
      R(g, 2, 8, 5, 1, P.steel5);
    }));
    // 7. 실드 나이트 (26×34)
    S.enemies.shield = [0, 1, 2].map(f => NS.bake(30, 36, (g) => {
      const step = f === 1 ? 1 : 0;
      // 다리
      NS.limb(g, 12, 24, 9 + step * 2, 33, 4, P.steel2, P.steel1, null);
      NS.limb(g, 16, 24, 19 - step * 2, 33, 4, P.steel2, P.steel1, null);
      R(g, 6 + step * 2, 31, 7, 3, P.steel3); R(g, 16 - step * 2, 31, 7, 3, P.steel3);
      // 몸통
      R(g, 8, 12, 12, 13, '#3d6e5a'); R(g, 8, 21, 12, 4, '#24483a');
      R(g, 8, 12, 12, 2, '#6aa88a');
      // 머리
      NS.orb(g, 14, 8, 5, '#3d6e5a', '#24483a', '#6aa88a');
      R(g, 15, 6, 4, 3, P.ink); R(g, 16, 7, 2, 2, f === 2 ? P.red2 : P.yellow);
      // 대형 실드 (전면)
      const sx = 21;
      R(g, sx, 4, 7, 28, P.steel3);
      R(g, sx, 4, 7, 2, P.steel5); R(g, sx, 28, 7, 4, P.steel1);
      R(g, sx + 2, 8, 3, 20, P.steel4);
      R(g, sx + 3, 10, 1, 16, P.cyan2);
    }));
    // 8. 바럴 봄버 (26×30)
    S.enemies.bomber = [0, 1, 2].map(f => NS.bake(30, 34, (g) => {
      const step = f === 1 ? 1 : 0;
      NS.limb(g, 11, 22, 8 + step * 2, 31, 4, P.steel2, P.steel1, null);
      NS.limb(g, 17, 22, 20 - step * 2, 31, 4, P.steel2, P.steel1, null);
      R(g, 5 + step * 2, 29, 7, 3, P.steel3); R(g, 17 - step * 2, 29, 7, 3, P.steel3);
      // 몸통 (둥근 캐리어)
      NS.orb(g, 14, 16, 9, '#8a5a2c', '#5e3a1a', '#c29450');
      R(g, 6, 12, 16, 3, '#c29450');
      R(g, 10, 18, 8, 4, '#5e3a1a');
      // 눈
      R(g, 16, 12, 6, 4, P.ink); R(g, 17, 13, 4, 2, f === 2 ? P.red2 : P.orange3);
      // 머리 위 폭탄
      if (f !== 2) {
        NS.orb(g, 14, 4, 4, P.steel2, P.steel1, P.steel4);
        R(g, 13, 0, 2, 2, P.orange3);
      }
    }));
  }

  // ── 적 타입 정의 ───────────────────────────────────────
  const TYPES = {
    walker: {
      w: 24, h: 20, hp: 3, dmg: 3, score: 100,
      init(e) { e.dir = -1; e.speed = 0.5; },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        if (e.state === 'lunge') {
          e.vy = Math.min(6, e.vy + 0.3);
          const r = NS.Physics.move(e);
          if (r.down) { e.vy = 0; e.state = 'walk'; e.t = 0; }
          if (r.left || r.right) e.vx *= -1;
          return;
        }
        if (e.state === 'tele') {
          e.t--;
          if (!(e.t > 0)) {
            e.state = 'lunge';
            e.vx = NS.sign(pl.cx - e.x) * 2.2;
            e.vy = -3.4;
            NS.Audio.sfx('jump');
          }
          return;
        }
        // 순찰
        e.vx = e.dir * e.speed;
        e.vy = Math.min(6, e.vy + 0.3);
        const r = NS.Physics.move(e);
        if (r.down) e.vy = 0;
        if (r.left) e.dir = 1; if (r.right) e.dir = -1;
        // 낭떠러지 반전
        if (r.down && !NS.Level.solidAt(e.x + e.w / 2 + e.dir * (e.w / 2 + 4), e.y + e.h + 4)) e.dir *= -1;
        e.facing = e.dir;
        // 플레이어 감지 → 텔레그래프
        if (Math.abs(pl.cx - (e.x + e.w / 2)) < 90 && Math.abs(pl.cy - e.y) < 40 && e.cool <= 0) {
          e.state = 'tele'; e.t = 22; e.cool = 120;
          NS.Audio.sfx('telegraph');
        }
        e.cool = NS.tick(e.cool);
      },
      frame(e) { return e.state === 'tele' ? 2 : Math.floor(e.frame / 8) % 2; },
    },
    turret: {
      w: 22, h: 18, hp: 4, dmg: 2, score: 150, noGravity: true,
      init(e) { e.cycle = 0; },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        e.cycle = (e.cycle + 1) % 150;
        e.invulnerable = e.cycle < 70;             // 닫힘 = 무적
        if (e.cycle === 70) NS.Audio.sfx('telegraph');
        if (e.cycle === 100) {
          for (const spread of [-0.35, 0, 0.35]) {
            const a = NS.angleTo(e.x + e.w / 2, e.y + 6, pl.cx, pl.cy) + spread;
            NS.EBullets.spawn({ x: e.x + e.w / 2, y: e.y + 6, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, dmg: 2 });
          }
          NS.Audio.sfx('shot');
        }
      },
      frame(e) { return e.cycle < 70 ? 0 : e.cycle < 100 ? 1 : 2; },
    },
    wisp: {
      w: 18, h: 18, hp: 2, dmg: 2, score: 100, noGravity: true,
      init(e) { e.baseY = e.y; e.t = NS.rand(0, 100); },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        if (e.state === 'dive') {
          e.x += e.vx; e.y += e.vy;
          e.vy += 0.08;
          if (e.y > e.baseY + 130 || NS.Level.solidAt(e.x + 9, e.y + 18)) { e.state = 'idle'; e.vy = 0; }
          return;
        }
        if (e.state === 'tele') {
          e.t2--;
          if (!(e.t2 > 0)) {
            e.state = 'dive';
            const a = NS.angleTo(e.x, e.y, pl.cx, pl.cy);
            e.vx = Math.cos(a) * 2.8; e.vy = Math.sin(a) * 2.8;
            NS.Audio.sfx('dash');
          }
          return;
        }
        e.t++;
        e.x += Math.sin(e.t * 0.02) * 0.4;
        e.y = e.baseY + Math.sin(e.t * 0.06) * 8;
        if (e.y < e.baseY - 2) e.y = e.baseY - 2;
        if (Math.abs(pl.cx - e.x) < 80 && pl.cy > e.y && e.cool <= 0) {
          e.state = 'tele'; e.t2 = 20; e.cool = 140;
          NS.Audio.sfx('telegraph');
        }
        e.cool = NS.tick(e.cool);
      },
      frame(e) { return e.state === 'tele' ? 2 : Math.floor(e.frame / 6) % 2; },
    },
    spitter: {
      w: 24, h: 16, hp: 4, dmg: 3, score: 150, noGravity: true,
      init(e) { e.t = NS.randInt(0, 60); },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        if (Math.abs(pl.cx - e.x) > 200) return;
        e.t++;
        if (e.t % 130 === 90) NS.Audio.sfx('telegraph');
        if (e.t % 130 === 120) {
          const dx = pl.cx - (e.x + e.w / 2);
          NS.EBullets.spawn({
            x: e.x + e.w / 2, y: e.y - 4, sprite: 'lavaGlob', w: 10, h: 10,
            vx: NS.clamp(dx / 70, -2.2, 2.2), vy: -4.6, gravity: 0.18, dmg: 3,
          });
          NS.Audio.sfx('shot2');
        }
      },
      frame(e) { return (e.t % 130) >= 90 ? 1 : 0; },
    },
    sentry: {
      w: 18, h: 28, hp: 5, dmg: 2, score: 200, noGravity: true,
      init(e) { e.t = NS.randInt(0, 80); },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        if (Math.abs(pl.cx - e.x) > 220) { e.t = 0; return; }
        e.t++;
        e.facing = NS.sign(pl.cx - e.x) || 1;
        if (e.t % 160 === 90) NS.Audio.sfx('telegraph');
        if (e.t % 160 >= 120 && e.t % 160 < 138 && (e.t % 6 === 0)) {
          NS.EBullets.spawn({
            x: e.x + e.w / 2 + e.facing * 8, y: e.y + 12, sprite: 'icicle', w: 6, h: 12,
            vx: e.facing * 4.2, vy: 0, dmg: 2,
          });
          NS.Audio.sfx('freeze');
        }
      },
      frame(e) { const c = e.t % 160; return c >= 120 ? 2 : c >= 90 ? 1 : 0; },
    },
    glider: {
      w: 26, h: 14, hp: 2, dmg: 3, score: 120, noGravity: true,
      init(e) { e.baseY = e.y; e.dir = -1; e.t = 0; },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        e.t++;
        if (e.state === 'swoop') {
          e.swoopT++;
          const t = e.swoopT / 60;
          e.x += e.vx;
          e.y = e.swoopY + Math.sin(t * Math.PI) * 60;
          if (e.swoopT >= 60) { e.state = 'fly'; e.baseY = e.y; }
          return;
        }
        e.x += e.dir * 1.3;
        e.y = e.baseY + Math.sin(e.t * 0.08) * 6;
        e.facing = e.dir;
        if (NS.Level.solidAt(e.x + (e.dir > 0 ? e.w + 4 : -4), e.y + 7)) e.dir *= -1;
        if (Math.abs(pl.cx - e.x) < 110 && pl.cy > e.y + 20 && e.cool <= 0) {
          e.state = 'swoop'; e.swoopT = 0; e.swoopY = e.y;
          e.vx = NS.sign(pl.cx - e.x) * 2.0;
          e.cool = 180;
          NS.Audio.sfx('dash');
        }
        e.cool = NS.tick(e.cool);
      },
      frame(e) { return Math.floor(e.frame / 7) % 2; },
    },
    shield: {
      w: 24, h: 32, hp: 5, dmg: 3, score: 250,
      init(e) { e.dir = -1; },
      shielded(e, fromDir) { return e.state !== 'fire' && fromDir === -e.facing; }, // 정면 방어
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        e.facing = NS.sign(pl.cx - (e.x + e.w / 2)) || e.facing || -1;
        e.vy = Math.min(6, e.vy + 0.3);
        if (e.state === 'fire') {
          e.t--;
          if (e.t === 14) {
            NS.EBullets.aimed(e.x + e.w / 2 + e.facing * 14, e.y + 10, pl.cx, pl.cy, 2.8, { dmg: 2 });
            NS.Audio.sfx('shot');
          }
          if (!(e.t > 0)) e.state = 'walk';
          NS.Physics.move(e);
          return;
        }
        e.vx = e.facing * 0.35;
        const r = NS.Physics.move(e);
        if (r.down) e.vy = 0;
        e.cool = NS.tick(e.cool);
        if (Math.abs(pl.cx - e.x) < 140 && e.cool <= 0) {
          e.state = 'fire'; e.t = 30; e.cool = 160;
          NS.Audio.sfx('telegraph');
        }
      },
      frame(e) { return e.state === 'fire' ? 2 : Math.floor(e.frame / 10) % 2; },
    },
    bomber: {
      w: 24, h: 30, hp: 4, dmg: 3, score: 200,
      init(e) { e.dir = -1; e.hasBomb = true; },
      update(e, pl) {
        e.frozen = NS.tick(e.frozen);
        if (e.frozen > 0) return;
        e.vy = Math.min(6, e.vy + 0.3);
        if (e.state === 'throw') {
          e.t--;
          if (e.t === 10 && e.hasBomb) {
            e.hasBomb = false;
            const dx = pl.cx - e.x;
            NS.EBullets.spawn({
              x: e.x + e.w / 2, y: e.y - 2, sprite: 'enemyBig', w: 10, h: 10,
              vx: NS.clamp(dx / 60, -2.6, 2.6), vy: -4.2, gravity: 0.2, dmg: 3,
              onWall(b) {
                b.dead = true;
                NS.FX.explode(b.x + 5, b.y + 5, false);
                for (let i = 0; i < 3; i++) {
                  const a = -Math.PI / 2 + (i - 1) * 0.7;
                  NS.EBullets.spawn({ x: b.x + 5, y: b.y + 5, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, dmg: 2, gravity: 0.12 });
                }
              },
            });
            NS.Audio.sfx('shot2');
          }
          if (!(e.t > 0)) { e.state = 'walk'; e.regen = 240; }
          NS.Physics.move(e);
          return;
        }
        e.regen = NS.tick(e.regen);
        if (!e.hasBomb && !(e.regen > 0)) e.hasBomb = true;
        e.facing = NS.sign(pl.cx - e.x) || -1;
        e.vx = e.facing * 0.4;
        const r = NS.Physics.move(e);
        if (r.down) e.vy = 0;
        e.cool = NS.tick(e.cool);
        if (e.hasBomb && Math.abs(pl.cx - e.x) < 150 && e.cool <= 0) {
          e.state = 'throw'; e.t = 26; e.cool = 200;
          NS.Audio.sfx('telegraph');
        }
      },
      frame(e) { return e.state === 'throw' ? 2 : Math.floor(e.frame / 9) % 2; },
    },
  };

  // ── 적 매니저 ──────────────────────────────────────────
  const Enemies = {
    list: [], spawners: [],
    reset(spawnDefs) {
      this.list = [];
      this.spawners = (spawnDefs || []).map(d => ({ def: d, ent: null, left: true }));
    },
    spawn(type, x, y, extra) {
      const def = TYPES[type];
      const e = Object.assign({
        type, x, y: y, w: def.w, h: def.h, vx: 0, vy: 0,
        hp: def.hp, maxHp: def.hp, facing: -1, dead: false,
        frame: 0, state: 'walk', t: 0, t2: 0, cool: 0, frozen: 0, flash: 0,
      }, extra || {});
      e.y = y - def.h; // y = 바닥 기준
      if (def.init) def.init(e);
      this.list.push(e);
      return e;
    },
    update(pl) {
      const L = NS.Level;
      // 스포너: 화면 밖 → 안 진입 시 스폰, 밖으로 나가면 리셋
      for (const sp of this.spawners) {
        const sx = sp.def.x * NS.TILE, sy = sp.def.y * NS.TILE + NS.TILE;
        const onScreen = sx > L.camX - 60 && sx < L.camX + NS.VW + 60 && sy > L.camY - 80 && sy < L.camY + NS.VH + 80;
        if (onScreen && !sp.ent && sp.left) {
          sp.ent = this.spawn(sp.def.type, sx, sy);
          sp.left = false;
        } else if (!onScreen) {
          // 화면 밖 정리 (죽은 적은 재스폰 허용)
          if (sp.ent) {
            if (!sp.ent.dead) sp.ent.cull = true;
            sp.ent = null;
          }
          sp.left = true;
        }
      }
      this.list = this.list.filter(e => !e.cull);
      for (const e of this.list) {
        if (e.dead) continue;
        e.frame++;
        e.flash = NS.tick(e.flash);
        const def = TYPES[e.type];
        def.update(e, pl);
        // 플레이어 접촉 대미지
        if (pl.alive && pl.invuln <= 0 && NS.aabb(pl.x, pl.y, pl.w, pl.h, e.x + 2, e.y + 2, e.w - 4, e.h - 4)) {
          pl.damage(def.dmg, NS.sign(pl.cx - (e.x + e.w / 2)) || 1);
        }
        // 플레이어 발사체 피격 (키 작은 적은 위로 판정 확장 — 가슴 높이 버스터 배려)
        const hitPad = e.h < 26 ? 14 : 0;
        for (const s of NS.Shots.list) {
          if (s.dead || s.hits.has(e)) continue;
          if (!NS.aabb(s.x, s.y, s.w, s.h, e.x, e.y - hitPad, e.w, e.h + hitPad)) continue;
          const fromDir = NS.sign((e.x + e.w / 2) - (s.x + s.w / 2)) || 1;
          if (e.invulnerable || (def.shielded && def.shielded(e, fromDir) && !s.pierce)) {
            NS.Audio.sfx('clink');
            NS.FX.sparks(s.x + s.w / 2, s.y + s.h / 2, -NS.sign(s.vx));
            if (!s.pierce) s.dead = true;
            s.hits.add(e);
            continue;
          }
          this.hurt(e, s.dmg, s);
          s.hits.add(e);
          if (!s.pierce) s.dead = true;
        }
      }
      this.list = this.list.filter(e => !e.dead);
    },
    hurt(e, dmg, shot) {
      e.hp -= dmg;
      e.flash = 6;
      NS.Audio.sfx('hit');
      NS.FX.hitstop(dmg >= 3 ? 3 : 1);
      NS.FX.hitSpark(shot ? shot.x + shot.w / 2 : e.x + e.w / 2, e.y + e.h / 2);
      NS.FX.popup(e.x + e.w / 2, e.y - 2, `${dmg}`, '#a8f6ff');
      if (shot && shot.freeze) { e.frozen = shot.freeze; NS.Audio.sfx('freeze'); }
      if (e.hp <= 0) {
        e.dead = true;
        NS.FX.explode(e.x + e.w / 2, e.y + e.h / 2, false);
        NS.Game.addScore(TYPES[e.type].score);
        Items.dropFrom(e.x + e.w / 2, e.y + e.h / 2);
      }
    },
    draw(g, cx, cy) {
      for (const e of this.list) {
        if (e.dead) continue;
        const def = TYPES[e.type];
        const frames = NS.Sprites.enemies[e.type];
        const fi = def.frame ? def.frame(e) : 0;
        const img = frames[Math.min(fi, frames.length - 1)];
        const dx = e.x + e.w / 2 - img.width / 2 - cx;
        const dy = e.y + e.h - img.height - cy + 2;
        if (!def.noGravity || e.type === 'turret' || e.type === 'spitter' || e.type === 'sentry')
          NS.groundShadow(g, e.x + e.w / 2 - cx, e.y + e.h - cy, e.w - 2);
        // 텔레그래프 발광 링
        if (e.state === 'tele' || (def.frame && def.frame(e) === 2 && e.type !== 'walker')) {
          g.globalAlpha = 0.3 + 0.2 * Math.sin(e.frame * 0.5);
          g.strokeStyle = P.red2;
          g.lineWidth = 1;
          g.strokeRect(Math.round(dx) - 2, Math.round(dy) - 2, img.width + 4, img.height + 4);
          g.globalAlpha = 1;
        }
        NS.blit(g, img, dx, dy, e.facing > 0);
        // 빙결 오버레이
        if (e.frozen > 0) {
          g.globalAlpha = 0.5;
          g.fillStyle = P.cyan3;
          g.fillRect(Math.round(dx), Math.round(dy), img.width, img.height);
          g.globalAlpha = 1;
        }
        // 피격 플래시
        if (e.flash > 0 && e.flash % 2 === 0) {
          g.fillStyle = NS.rgba('#ffffff', 0.55);
          g.fillRect(Math.round(dx), Math.round(dy), img.width, img.height);
        }
      }
    },
  };
  NS.Enemies = Enemies;

  // ── 아이템 ─────────────────────────────────────────────
  const Items = {
    list: [],
    reset() { this.list = []; },
    add(type, x, y, opts) {
      this.list.push(Object.assign({ type, x, y, vy: 0, frame: 0, dead: false, persistId: null, life: -1 }, opts || {}));
    },
    dropFrom(x, y) {
      const r = Math.random();
      let type = null;
      if (r < 0.26) type = 'chipS';
      else if (r < 0.34) type = 'chipL';
      else if (r < 0.46) type = 'healthS';
      else if (r < 0.50) type = 'healthL';
      else if (r < 0.58) type = 'energy';
      if (type) this.add(type, x - 5, y - 5, { vy: -2, life: 300 });
    },
    update(pl) {
      const magnet = pl.meta && pl.meta.shop.magnet ? 70 : 0;
      for (const it of this.list) {
        it.frame++;
        if (it.life > 0) { it.life--; if (!(it.life > 0)) { it.dead = true; continue; } }
        // 중력 (칩/회복류만)
        if (['chipS', 'chipL', 'healthS', 'healthL', 'energy', 'oneUp'].includes(it.type)) {
          it.vy = Math.min(4, it.vy + 0.18);
          if (!NS.Level.solidAt(it.x + 5, it.y + 12 + it.vy)) it.y += it.vy;
          else it.vy = 0;
          // 칩 자석
          if (magnet && (it.type === 'chipS' || it.type === 'chipL')) {
            const d = NS.dist(it.x, it.y, pl.cx, pl.cy);
            if (d < magnet) {
              const a = NS.angleTo(it.x, it.y, pl.cx, pl.cy);
              it.x += Math.cos(a) * 2.4; it.y += Math.sin(a) * 2.4;
            }
          }
        }
        // 획득
        const size = it.type === 'capsule' ? 28 : 14;
        if (pl.alive && NS.aabb(pl.x, pl.y, pl.w, pl.h, it.x - 2, it.y - 2, size, size + 4)) {
          this.collect(it, pl);
        }
      }
      this.list = this.list.filter(i => !i.dead);
    },
    collect(it, pl) {
      const G = NS.Game;
      switch (it.type) {
        case 'chipS': G.addChips(10); NS.Audio.sfx('chip'); NS.FX.popup(it.x + 5, it.y, '+10', '#ffc44d'); break;
        case 'chipL': G.addChips(50); NS.Audio.sfx('chip'); NS.FX.popup(it.x + 5, it.y, '+50', '#ffe66d'); break;
        case 'healthS': pl.heal(4); break;
        case 'healthL': pl.heal(10); break;
        case 'energy': pl.refillAmmo(8); break;
        case 'oneUp': pl.lives++; NS.Audio.sfx('oneUp'); NS.FX.popup(it.x + 6, it.y, '1UP!', '#38e0ff'); break;
        case 'heart':
          G.collectPersist(it.persistId);
          pl.maxHp += 4; pl.hp = pl.maxHp;
          NS.Audio.sfx('weaponGet');
          G.announce('하트 탱크 획득! 최대 체력 +4');
          break;
        case 'subtank':
          G.collectPersist(it.persistId);
          NS.Audio.sfx('weaponGet');
          G.announce('서브 탱크 획득! (일시정지 메뉴에서 사용)');
          break;
        case 'capsule':
          G.collectPersist(it.persistId);
          NS.Audio.sfx('weaponGet');
          if (it.part === 'boots') {
            pl.parts.boots = true;
            G.announce('부스터 파츠 획득! 공중 대시 2회 가능');
          } else {
            pl.parts.buster = true;
            G.announce('버스터 파츠 획득! 차지 속도 1.4배');
          }
          NS.FX.flash('#a8f6ff', 20);
          break;
      }
      it.dead = true;
    },
    draw(g, cx, cy) {
      const S = NS.Sprites.items;
      for (const it of this.list) {
        const map = { chipS: 'chipS', chipL: 'chipL', healthS: 'healthS', healthL: 'healthL', energy: 'energy', heart: 'heart', subtank: 'subtank', oneUp: 'oneUp', capsule: 'capsule' };
        const frames = S[map[it.type]];
        let fi = Math.floor(it.frame / 12) % frames.length;
        if (it.type === 'capsule') fi = Math.floor(it.frame / 20) % 2;
        const img = frames[fi];
        const bob = ['heart', 'subtank', 'capsule'].includes(it.type) ? 0 : Math.sin(it.frame * 0.1) * 1.5;
        // 깜빡임 (소멸 직전)
        if (it.life > 0 && it.life < 60 && (it.frame % 6) < 3) continue;
        NS.blit(g, img, it.x - cx, it.y - cy + bob);
        // 주요 아이템 발광
        if (['heart', 'subtank', 'capsule'].includes(it.type)) {
          g.globalAlpha = 0.25 + 0.15 * Math.sin(it.frame * 0.08);
          g.fillStyle = P.cyan3;
          g.fillRect(Math.round(it.x - cx) - 2, Math.round(it.y - cy) - 2, img.width + 4, img.height + 4);
          g.globalAlpha = 1;
        }
      }
    },
  };
  NS.Items = Items;
  NS.bakeEnemySprites = bakeEnemies;
})();
