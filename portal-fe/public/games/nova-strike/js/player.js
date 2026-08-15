// NOVA STRIKE — player: 32비트 액션 문법 무브셋 (대시/월점프/코요테/버퍼/차지 3단/특수무기)
'use strict';
(function () {
  const P = NS.PAL;
  const I = () => NS.Input;

  // ── 플레이어 발사체 ────────────────────────────────────
  const Shots = {
    list: [],
    reset() { this.list.length = 0; },
    count(type) { return this.list.filter(s => s.type === type).length; },
    spawn(s) { this.list.push(Object.assign({ dead: false, frame: 0, pierce: false, hits: new Set() }, s)); },
    update() {
      const L = NS.Level;
      for (const s of this.list) {
        s.frame++;
        if (s.update) s.update(s);
        s.x += s.vx; s.y += s.vy;
        if (s.gravity) s.vy = Math.min(6, s.vy + s.gravity);
        // 근접 판정은 지형 통과 + 겹치는 부서지는 블록 파괴
        if (s.melee) {
          const T = NS.TILE;
          for (let ty = Math.floor(s.y / T); ty <= Math.floor((s.y + s.h) / T); ty++)
            for (let tx = Math.floor(s.x / T); tx <= Math.floor((s.x + s.w) / T); tx++)
              L.breakTile(tx, ty);
          if (s.life !== undefined) { s.life--; if (!(s.life > 0)) s.dead = true; }
          continue;
        }
        // 지형 충돌
        if (!s.ignoreWall && L.solidAt(s.x + s.w / 2, s.y + s.h / 2)) {
          if (s.onWall) s.onWall(s);
          else { NS.FX.hitSpark(s.x + s.w / 2, s.y + s.h / 2); s.dead = true; }
          // 부서지는 블록
          L.breakTile(Math.floor((s.x + s.w / 2) / NS.TILE), Math.floor((s.y + s.h / 2) / NS.TILE));
        }
        if (s.x < L.camX - 60 || s.x > L.camX + NS.VW + 60 || s.y < L.camY - 80 || s.y > L.camY + NS.VH + 80) s.dead = true;
        if (s.life !== undefined) { s.life--; if (!(s.life > 0)) s.dead = true; }
      }
      this.list = this.list.filter(s => !s.dead);
    },
    draw(g, cx, cy) {
      for (const s of this.list) {
        if (!s.sprite) continue;   // 근접 히트박스는 그리지 않음 (참격 FX 별도)
        const frames = NS.Sprites.bullets[s.sprite];
        const img = frames[Math.floor(s.frame / 4) % frames.length];
        NS.blit(g, img, s.x + s.w / 2 - img.width / 2 - cx, s.y + s.h / 2 - img.height / 2 - cy, s.vx < 0);
      }
    },
  };
  NS.Shots = Shots;

  // ── 적 발사체 ──────────────────────────────────────────
  const EBullets = {
    list: [],
    reset() { this.list.length = 0; },
    spawn(b) { this.list.push(Object.assign({ dead: false, frame: 0, sprite: 'enemy', w: 6, h: 6, dmg: 2 }, b)); },
    aimed(x, y, tx, ty, speed, opts) {
      const a = NS.angleTo(x, y, tx, ty);
      this.spawn(Object.assign({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }, opts));
    },
    update() {
      const L = NS.Level;
      for (const b of this.list) {
        b.frame++;
        if (b.update) b.update(b);
        b.x += b.vx; b.y += b.vy;
        if (b.gravity) b.vy = Math.min(6, b.vy + b.gravity);
        if (!b.ignoreWall && L.solidAt(b.x + b.w / 2, b.y + b.h / 2)) {
          if (b.onWall) b.onWall(b); else b.dead = true;
        }
        if (b.x < L.camX - 80 || b.x > L.camX + NS.VW + 80 || b.y < L.camY - 100 || b.y > L.camY + NS.VH + 100) b.dead = true;
        if (b.life !== undefined) { b.life--; if (!(b.life > 0)) b.dead = true; }
      }
      this.list = this.list.filter(b => !b.dead);
    },
    draw(g, cx, cy) {
      for (const b of this.list) {
        const frames = NS.Sprites.bullets[b.sprite];
        const img = frames[Math.floor(b.frame / 5) % frames.length];
        NS.blit(g, img, b.x + b.w / 2 - img.width / 2 - cx, b.y + b.h / 2 - img.height / 2 - cy, b.vx < 0);
      }
    },
  };
  NS.EBullets = EBullets;

  // ── 무기 정의 ──────────────────────────────────────────
  NS.WEAPONS = [
    { id: 'basic', name: '퀵드로우 리볼버', color: P.orange3, infinite: true },
    { id: 'magma', name: '마그마 버스트', color: P.orange2 },
    { id: 'frost', name: '프로스트 랜스', color: P.cyan3 },
    { id: 'cyclone', name: '사이클론 커터', color: P.green2 },
  ];
  NS.CHAR_INFO = {
    dusk: { name: '더스크', sub: '방랑 건슬링거', desc: '리볼버 연사 + 차지 매그넘. ↓↘→공격=팬 파이어(5방향) · →↓↘공격=라이징 배럴(대공).', basicName: '퀵드로우 리볼버', basicColor: P.orange3 },
    raven: { name: '레이븐', sub: '흑풍 검객', desc: '3연 콤보 + 차지 강참·회전참. ↓↘→공격=참풍파(검기) · →↓↘공격=승천참(무적 대공).', basicName: '흑풍 세이버', basicColor: P.steel5 },
  };

  const GRAV = 0.38, TERM = 7.6;
  const RUN = 2.5, DASH = 5.5, DASH_TIME = 26;
  const JUMP = -6.8, WALL_VY = 1.9, WJ_VX = 4.2, WJ_VY = -6.6;
  const COYOTE = 6, BUFFER = 7;

  const Player = {
    x: 0, y: 0, w: 14, h: 30, vx: 0, vy: 0, facing: 1,
    state: 'air', onGround: false,
    hp: 16, maxHp: 16, lives: 3,
    weapon: 0, owned: [true, false, false, false], ammo: [0, 16, 16, 16], ammoMax: 16,
    dashTimer: 0, dashDir: 1, airDashes: 0, dashJump: false,
    coyote: 0, jumpBuf: 0, dropTimer: 0,
    chargeT: 0, charging: false, shootAnim: 0, shotCd: 0,
    invuln: 0, hurtT: 0, deadT: 0, victoryT: 0,
    runDist: 0, idleF: 0, wallSide: 0,
    parts: { boots: false, buster: false },
    meta: null, // game.js 가 주입 (상점 업그레이드)
    teleportT: 0, // 등장 연출

    spawn(x, y, meta) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.facing = 1;
      this.state = 'air'; this.onGround = false;
      this.meta = meta;
      this.charKey = meta.charKey || 'dusk';
      this.melee = this.charKey === 'raven';
      NS.WEAPONS[0].name = NS.CHAR_INFO[this.charKey].basicName;
      NS.WEAPONS[0].color = NS.CHAR_INFO[this.charKey].basicColor;
      this.atkStage = 0; this.atkT = 0; this.chainT = 0; this.atkQueued = false; this.atkKind = 1;
      this.landT = 0; this.skidding = false; this.strideAcc = 0;
      this.tp = 20; this.tpMax = 20; this.dirHist = []; this.lastDir = 5;
      this.maxHp = 16 + (meta.hearts || 0) * 4 + (meta.shop.maxHp ? 4 : 0) + (meta.shop.maxHp2 ? 4 : 0);
      this.hp = this.maxHp;
      this.ammoMax = 16 + (meta.shop.weaponEff ? 8 : 0);
      this.ammo = [0, this.ammoMax, this.ammoMax, this.ammoMax];
      this.owned = [true, !!meta.weapons.magma, !!meta.weapons.frost, !!meta.weapons.cyclone];
      this.parts.boots = !!meta.parts.boots;
      this.parts.buster = !!meta.parts.buster;
      this.weapon = 0;
      this.dashTimer = 0; this.airDashes = 0; this.coyote = 0; this.jumpBuf = 0;
      this.chargeT = 0; this.charging = false; this.shootAnim = 0; this.shotCd = 0;
      this.invuln = 0; this.hurtT = 0; this.deadT = 0; this.victoryT = 0;
      this.teleportT = 40;
      Shots.reset(); EBullets.reset();
    },

    get alive() { return this.state !== 'dead'; },
    get cx() { return this.x + this.w / 2; },
    get cy() { return this.y + this.h / 2; },

    chargeMax() {
      let t = 58;
      if (this.parts.buster) t = Math.round(t / 1.4);
      if (this.meta && this.meta.shop.chargeSpeed) t = Math.round(t / 1.25);
      return t;
    },
    chargeMid() { return Math.round(this.chargeMax() * 0.4); },

    update() {
      if (this.teleportT > 0) { // 등장 연출 — 상공 강하 착지
        this.teleportT--;
        if (this.teleportT === 39) NS.Audio.sfx('teleportIn');
        if (this.teleportT === 14) {
          NS.Audio.sfx('land');
          NS.FX.shake(2, 6);
          NS.FX.burst(this.cx, this.y + this.h, 8, { color: ['#c0aa88', '#a89068', '#d8c8a8'], up: 1.2, g: 0.12 });
        }
        return;
      }
      if (this.state === 'dead') { this.deadT++; return; }
      if (this.state === 'victory') { this.victoryT++; return; }

      const inp = I();
      const L = NS.Level;
      this.invuln = NS.tick(this.invuln);
      this.shotCd = NS.tick(this.shotCd);
      this.shootAnim = NS.tick(this.shootAnim);
      this.coyote = NS.tick(this.coyote);
      this.jumpBuf = NS.tick(this.jumpBuf);
      this.dropTimer = NS.tick(this.dropTimer);
      this.dropThrough = this.dropTimer > 0;

      // ── 피격 경직 ──
      if (this.hurtT > 0) {
        this.hurtT--;
        this.vy = Math.min(TERM, this.vy + GRAV);
        const r = NS.Physics.move(this);
        if (r.down) { this.vy = 0; this.onGround = true; }
        if (r.left || r.right) this.vx *= -0.3;
        this.postMove();
        return;
      }

      const ax = inp.axisX();
      if (ax !== 0 && this.state !== 'dash') this.facing = ax;

      // 커맨드 방향 히스토리 (넘패드 표기, facing 상대 — 6=전방)
      {
        const rel = ax * this.facing;   // 1=전방, -1=후방
        const dn = inp.down('down') ? 1 : 0, up = inp.down('up') ? 1 : 0;
        let d = 5;
        if (dn && rel > 0) d = 3; else if (dn && rel < 0) d = 1; else if (dn) d = 2;
        else if (up && rel > 0) d = 9; else if (up) d = 8;
        else if (rel > 0) d = 6; else if (rel < 0) d = 4;
        if (d !== this.lastDir) {
          this.lastDir = d;
          if (d !== 5) this.dirHist.push({ d, t: this.idleF });
          if (this.dirHist.length > 10) this.dirHist.shift();
        }
      }
      // 기력 재생
      if (this.idleF % 30 === 0 && this.tp < this.tpMax) this.tp++;

      // ── 점프 입력 버퍼 ──
      if (inp.pressed('jump')) this.jumpBuf = BUFFER;

      // ── 대시 ──
      const dashPressed = inp.pressed('dash');
      if (dashPressed) {
        const canGround = this.onGround;
        const canAir = !this.onGround && this.state !== 'wall' && this.airDashes < (this.parts.boots ? 2 : 1);
        if (canGround || canAir) {
          this.state = 'dash';
          this.dashTimer = DASH_TIME;
          this.dashDir = ax !== 0 ? ax : this.facing;
          this.facing = this.dashDir;
          this.vx = DASH * this.dashDir;
          if (!canGround) { this.airDashes++; this.vy = 0; }
          if (this.meta.shop.dashIFrame) this.invuln = Math.max(this.invuln, 10);
          NS.Audio.sfx('dash');
        }
      }

      // ── 상태별 이동 ──
      const onIce = this.onGround && L.iceAt(this.cx, this.y + this.h + 2);
      if (this.state === 'dash') {
        this.dashTimer--;
        this.vx = DASH * this.dashDir;
        if (this.onGround) this.vy = Math.min(TERM, this.vy + GRAV);
        // 대시 잔상
        if (this.dashTimer % 4 === 0) {
          const img = this.spriteNow();
          NS.FX.ghost(img.img, this.spriteX(), this.spriteY(), img.flip);
        }
        if (!(this.dashTimer > 0) || (!inp.down('dash') && this.onGround && this.dashTimer < DASH_TIME - 6)) {
          this.state = this.onGround ? 'ground' : 'air';
          if (!this.onGround) this.vx = this.dashDir * RUN;
        }
        // 대시 점프 (모멘텀 유지)
        if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
          this.jumpBuf = 0;
          this.vy = JUMP; this.dashJump = true;
          this.state = 'air';
          this.onGround = false;
          NS.Audio.sfx('jump');
        }
      } else {
        // 수평
        const speed = this.dashJump && !this.onGround ? DASH : RUN;
        const acc = onIce ? 0.08 : (this.onGround ? 0.85 : 0.5);
        const fric = onIce ? 0.02 : (this.onGround ? 0.65 : 0.15);
        // 방향 전환 스키드 (지상 감속 중 반대 입력)
        this.skidding = this.onGround && ax !== 0 && NS.sign(this.vx) === -ax && Math.abs(this.vx) > 1.1;
        if (this.skidding && this.idleF % 3 === 0) NS.FX.dust(this.cx + this.facing * 6, this.y + this.h, -ax);
        if (ax !== 0) this.vx = NS.clamp(this.vx + ax * acc, -speed, speed);
        else {
          if (Math.abs(this.vx) <= fric) this.vx = 0;
          else this.vx -= NS.sign(this.vx) * fric;
        }
        // 컨베이어
        if (this.onGround) {
          const cvx = L.conveyorAt(this.cx, this.y + this.h + 2);
          if (cvx) this.x += cvx;
        }
        // 중력 / 월 슬라이드
        if (this.state === 'wall') {
          this.vy = Math.min(WALL_VY, this.vy + GRAV * 0.5);
          this.facing = -this.wallSide;
          if (NS.chance(0.3)) NS.FX.p({ x: this.cx + this.wallSide * 7, y: this.y + NS.rand(8, 26), vx: 0, vy: -0.3, life: 12, size: 1, color: P.cyan3 });
          // 벽에서 떨어짐
          if (ax === -this.wallSide || !this.touchingWall(this.wallSide)) {
            this.state = 'air';
          }
          // 월 점프
          if (this.jumpBuf > 0) {
            this.jumpBuf = 0;
            this.vx = -this.wallSide * WJ_VX;
            this.vy = WJ_VY;
            this.facing = -this.wallSide;
            this.state = 'air';
            this.airDashes = 0;
            this.dashJump = inp.down('dash');
            NS.Audio.sfx('jump');
            NS.FX.burst(this.cx + this.wallSide * 7, this.y + 20, 5, { color: [P.cyan3, P.white], spMax: 2 });
          }
        } else {
          this.vy = Math.min(TERM, this.vy + GRAV);
          // 가변 점프 높이
          if (this.vy < -1.5 && !inp.down('jump')) this.vy = -1.5;
        }
        // 점프 (지상/코요테)
        if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
          this.jumpBuf = 0;
          this.vy = JUMP;
          this.onGround = false;
          this.coyote = 0;
          this.state = 'air';
          this.dashJump = false;
          NS.Audio.sfx('jump');
        }
        // 원웨이 아래로 통과 (아래+점프)
        if (this.onGround && inp.down('down') && inp.pressed('jump')) {
          this.dropTimer = 10; this.dropThrough = true; this.jumpBuf = 0;
        }
      }

      // ── 이동 적용 ──
      const wasGround = this.onGround;
      const fallVy = this.vy;
      const r = NS.Physics.move(this);
      if (r.down) {
        if (!wasGround && fallVy > 3) {
          NS.Audio.sfx('land');
          this.landT = 8;
          NS.FX.dust(this.cx - 8, this.y + this.h, -1);
          NS.FX.dust(this.cx + 8, this.y + this.h, 1);
        }
        this.vy = 0;
        this.onGround = true;
        this.airDashes = 0;
        this.dashJump = false;
        if (this.state === 'air' || this.state === 'wall') this.state = 'ground';
      } else {
        if (wasGround) this.coyote = COYOTE;
        this.onGround = false;
        if (this.state === 'ground') this.state = 'air';
      }
      if (r.up && this.vy < 0) this.vy = 0;
      if (r.left || r.right) {
        const side = r.right ? 1 : -1;
        this.vx = 0;
        // 월 슬라이드 진입 (공중 + 벽 방향 입력 + 하강, 가상 경계벽 제외)
        if (!this.onGround && this.state !== 'dash' && ax === side && this.vy > 0 && this.touchingWall(side)) {
          if (this.state !== 'wall') { this.state = 'wall'; this.airDashes = 0; NS.Audio.sfx('wall'); }
          this.wallSide = side;
        }
      } else if (this.state === 'wall' && !this.touchingWall(this.wallSide)) {
        this.state = 'air';
      }

      this.postMove();

      // ── 사격 / 차지 ──
      this.updateShooting(inp);

      // ── 무기 전환 ──
      if (inp.pressed('wnext')) this.cycleWeapon(1);
      if (inp.pressed('wprev')) this.cycleWeapon(-1);
      ['slot1', 'slot2', 'slot3', 'slot4'].forEach((s, idx) => {
        if (inp.pressed(s) && this.owned[idx]) { this.weapon = idx; NS.Audio.sfx('menuMove'); }
      });

      // 달리기 애니 거리 + 발구름 먼지
      this.landT = NS.tick(this.landT);
      if (this.onGround && Math.abs(this.vx) > 0.3) {
        this.runDist += Math.abs(this.vx);
        this.strideAcc += Math.abs(this.vx);
        if (this.strideAcc > 26) {
          this.strideAcc = 0;
          NS.FX.dust(this.cx - this.facing * 8, this.y + this.h, -this.facing);
        }
      }
      this.idleF++;
    },

    postMove() {
      const L = NS.Level;
      // 위험 타일
      if (this.invuln <= 0 && this.alive) {
        const hz = L.hazardIn(this.x, this.y, this.w, this.h);
        if (hz === 'spike') this.damage(4, NS.sign(this.vx) || this.facing);
        else if (hz === 'lava') this.damage(4, -this.facing);
      }
      // 낙사 / 상단 장외 (맵 최상단 림 위는 정상 플레이 도달 불가 — 장외 처리)
      if (this.y > L.pxH + 40 && this.alive) this.kill();
      if (this.y + this.h < 8 && this.alive) this.kill();
      if (this.y < -120) { this.y = -120; if (this.vy < 0) this.vy = 0; }
    },

    touchingWall(side) {
      const px = side > 0 ? this.x + this.w + 1 : this.x - 1;
      if (px <= 0 || px >= NS.Level.pxW) return false;   // 가상 경계벽은 월슬라이드 불가 (무한 등반 방지)
      return NS.Level.solidAt(px, this.y + 6) || NS.Level.solidAt(px, this.y + this.h - 6);
    },

    cycleWeapon(dir) {
      let w = this.weapon;
      for (let i = 0; i < 4; i++) {
        w = (w + dir + 4) % 4;
        if (this.owned[w]) { this.weapon = w; NS.Audio.sfx('menuMove'); return; }
      }
    },

    checkCommand() {
      const now = this.idleF;
      const within = (win) => this.dirHist.filter(e => now - e.t <= win).map(e => e.d);
      const tailRecent = this.dirHist.length && now - this.dirHist[this.dirHist.length - 1].t <= 10;
      const hasSeq = (arr, pat) => {
        let i = 0;
        for (const d of arr) if (d === pat[i]) { i++; if (i === pat.length) return true; }
        return false;
      };
      if (!tailRecent) return null;
      // 승천/대공 (→↓↘) — 순서 조건(6→2→3)이 걷기 오폭을 막는다
      if (hasSeq(within(24), [6, 2, 3])) return 'dp';
      // 파동 (↓↘→ / ↓→ 관용)
      const q = within(26);
      if (hasSeq(q, [2, 3, 6]) || hasSeq(q, [2, 6])) return 'qcf';
      return null;
    },

    doCommand(cmd) {
      const dir = this.facing;
      const mz = this.muzzlePos();
      if (!this.melee) {
        if (cmd === 'qcf') {
          // 팬 파이어 — 5방향 부채 연사
          this.tp -= 6;
          this.shootAnim = 18; this.shotCd = 10;
          NS.Audio.sfx('shot3'); NS.FX.shake(2, 6);
          NS.FX.muzzle(mz.x, mz.y);
          for (let i = -2; i <= 2; i++) {
            const a = i * 0.19;
            Shots.spawn({ type: 'cmd', sprite: 'buster1', x: mz.x - 6, y: mz.y - 3, w: 12, h: 6, vx: Math.cos(a) * 9 * dir, vy: Math.sin(a) * 9, dmg: 1 });
          }
          NS.FX.casing(mz.x - dir * 10, mz.y - 2, dir);
        } else {
          // 라이징 배럴 — 대공 상방 3연사 + 백스텝
          this.tp -= 6;
          this.shootAnim = 18; this.shotCd = 10;
          NS.Audio.sfx('shot2'); NS.Audio.sfx('jump');
          this.vy = Math.min(this.vy, -3.4); this.vx = -dir * 1.6; this.onGround = false;
          for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + dir * (0.42 - i * 0.21);
            Shots.spawn({ type: 'cmd', sprite: 'buster2', x: this.cx - 9, y: this.y - 4, w: 18, h: 12, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: 2 });
          }
        }
      } else {
        if (cmd === 'qcf') {
          // 참풍파 — 전방 검기
          this.tp -= 6;
          this.atkKind = 1; this.atkT = 16;
          NS.Audio.sfx('slashHeavy'); NS.FX.shake(2, 6);
          Shots.spawn({ type: 'cmd', sprite: 'wave', x: this.cx + dir * 10 - 13, y: this.cy - 13, w: 26, h: 26, vx: 8.5 * dir, vy: 0, dmg: 4, pierce: true, life: 46 });
          NS.FX.p({ anim: 'slash', x: this.cx + dir * 24, y: this.cy - 2, life: 9, maxLife: 9, animFps: 3, flip: dir < 0 });
        } else {
          // 승천참 — 무적 상승 다단 베기
          this.tp -= 7;
          this.atkKind = 3; this.atkT = 20;
          this.vy = -8; this.onGround = false;
          this.invuln = Math.max(this.invuln, 14);
          NS.Audio.sfx('slashHeavy'); NS.Audio.sfx('jump');
          this.meleeBox(30, 48, 3, { oy: -10 });
          const self = this;
          setTimeout(() => { if (self.alive) self.meleeBox(30, 48, 2, { oy: -14 }); }, 130);
          NS.FX.dust(this.cx - 8, this.y + this.h, -1); NS.FX.dust(this.cx + 8, this.y + this.h, 1);
        }
      }
      this.dirHist = [];
    },

    updateShooting(inp) {
      const holding = inp.down('shoot');
      if (inp.pressed('shoot')) {
        const cmd = this.weapon === 0 ? this.checkCommand() : null;
        const cost = cmd === 'dp' ? 7 : 6;
        if (cmd && this.tp >= cost && !(this.shotCd > 0)) {
          this.doCommand(cmd);
        } else if (this.melee && this.weapon === 0) this.trySlash();
        else this.fire(0);
      }
      // 근접 콤보 예약 소비
      if (this.melee) {
        this.atkT = NS.tick(this.atkT);
        this.chainT = NS.tick(this.chainT);
        if (this.atkQueued && !(this.atkT > 2)) { this.atkQueued = false; this.trySlash(); }
      }
      if (holding && this.weapon === 0) {
        this.chargeT++;
        const mid = this.chargeMid(), max = this.chargeMax();
        if (this.chargeT === mid || this.chargeT === max) NS.Audio.sfx('chargeFull');
        if (this.chargeT > 8 && this.chargeT % 5 === 0) {
          NS.Audio.sfx('chargeTick', Math.min(1, this.chargeT / max));
          const lvl = this.chargeT >= max ? 2 : this.chargeT >= mid ? 1 : 0;
          const cols = this.melee
            ? [[P.steel4, P.steel5], [P.steel5, P.white], [P.orange3, P.white, P.steel5]][lvl]
            : [[P.orange2, P.orange3], [P.orange3, P.white], [P.yellow, P.white, P.orange3]][lvl];
          const a = NS.rand(0, Math.PI * 2), d = NS.rand(14, 22);
          NS.FX.p({
            x: this.cx + Math.cos(a) * d, y: this.cy + Math.sin(a) * d,
            vx: -Math.cos(a) * 2, vy: -Math.sin(a) * 2, life: 10, size: lvl + 1, color: NS.pick(cols),
          });
        }
      } else if (this.chargeT > 0 && this.weapon === 0) {
        const mid = this.chargeMid(), max = this.chargeMax();
        if (this.melee) {
          if (this.chargeT >= max) this.spinSlash();
          else if (this.chargeT >= mid) this.heavySlash();
        } else {
          if (this.chargeT >= max) this.fire(2);
          else if (this.chargeT >= mid) this.fire(1);
        }
        this.chargeT = 0;
      } else {
        this.chargeT = 0;
      }
    },

    // ── 레이븐 근접 시스템 ─────────────────────────────────
    trySlash() {
      if (this.atkT > 2) { this.atkQueued = true; return; }
      const dir = this.state === 'wall' ? -this.wallSide : this.facing;
      if (!this.onGround) {
        this.atkKind = 'air';
        this.meleeBox(30, 30, 2, { oy: 8 });
      } else if (this.state === 'dash') {
        this.atkKind = 1;
        this.meleeBox(34, 26, 3, {});
      } else {
        this.atkStage = (this.chainT > 0 && this.atkStage < 3) ? this.atkStage + 1 : 1;
        this.atkKind = this.atkStage;
        const dmg = this.atkStage === 3 ? 3 : 2;
        this.meleeBox(30, 26, dmg, { oy: this.atkStage === 3 ? -8 : 0, launch: this.atkStage === 3 });
        this.vx += dir * 1.2;   // 내딛기
      }
      this.atkT = 14;
      this.chainT = 30;
      this.shootAnim = 0;
      NS.Audio.sfx('slash');
      NS.FX.p({ anim: 'slash', x: this.cx + dir * 22, y: this.cy - 2 + (this.atkKind === 'air' ? 8 : this.atkKind === 3 ? -8 : 0), life: 9, maxLife: 9, animFps: 3, flip: dir < 0 });
    },
    heavySlash() {
      const dir = this.facing;
      this.atkKind = 2; this.atkT = 16;
      this.meleeBox(44, 32, 5, {});
      NS.Audio.sfx('slashHeavy');
      NS.FX.shake(2, 6);
      NS.FX.p({ anim: 'slash', x: this.cx + dir * 26, y: this.cy - 2, life: 9, maxLife: 9, animFps: 3, flip: dir < 0 });
    },
    spinSlash() {
      this.atkKind = 'spin'; this.atkT = 20;
      this.meleeBox(64, 40, 4, { both: true });
      const self = this;
      setTimeout(() => { if (self.alive) self.meleeBox(64, 40, 4, { both: true }); }, 150);
      NS.Audio.sfx('slashHeavy');
      NS.FX.shake(3, 10);
      NS.FX.hitstop(3);
      NS.FX.p({ anim: 'spinArc', x: this.cx, y: this.cy - 2, life: 12, maxLife: 12, animFps: 4 });
    },
    meleeBox(w, h, dmg, opts) {
      const self = this;
      Shots.spawn({
        type: 'melee', melee: true, sprite: null, pierce: true, ignoreWall: true,
        x: 0, y: 0, w, h, dmg, vx: this.facing * 0.001, vy: 0, life: 9,
        launch: !!opts.launch,
        update(s) {
          s.x = opts.both ? self.cx - s.w / 2 : (self.facing > 0 ? self.cx + 4 : self.cx - 4 - s.w);
          s.y = self.y + self.h / 2 - s.h / 2 + (opts.oy || 0);
        },
      });
      this.meleeBoxInit();
    },
    meleeBoxInit() {
      // 스폰 직후 위치 반영 (update 가 다음 프레임에 돌기 전)
      const s = Shots.list[Shots.list.length - 1];
      if (s && s.update) s.update(s);
    },

    muzzlePos() {
      // 현재 스프라이트 상태 기준 포구/발도 월드 좌표
      const table = NS.Sprites.heroMuzzle[this.charKey] || {};
      const key = this.spriteKey(true);
      const m = table[key] || table.default || { x: 56, y: 30 };
      const sx = this.spriteX(), sy = this.spriteY();
      const x = this.facing > 0 ? sx + m.x : sx + 64 - m.x;
      return { x, y: sy + m.y };
    },

    fire(level) {
      const W = NS.WEAPONS[this.weapon];
      if (this.weapon === 0) {
        if (level === 0 && (this.shotCd > 0 || Shots.count('b1') >= 3)) return;
        const mz = this.muzzlePos();
        const dir = this.state === 'wall' ? -this.wallSide : this.facing;
        NS.FX.muzzle(mz.x, mz.y);
        this.shootAnim = 18;
        this.shotCd = 6;
        if (level === 0) {
          NS.Audio.sfx('shot');
          Shots.spawn({ type: 'b1', sprite: 'buster1', x: mz.x - 6, y: mz.y - 3, w: 12, h: 6, vx: 9 * dir, vy: 0, dmg: 1 });
          NS.FX.casing(mz.x - dir * 10, mz.y - 2, dir);
        } else if (level === 1) {
          NS.Audio.sfx('shot2');
          Shots.spawn({ type: 'b2', sprite: 'buster2', x: mz.x - 9, y: mz.y - 6, w: 18, h: 12, vx: 9.5 * dir, vy: 0, dmg: 3 });
          NS.FX.shake(1, 4);
        } else {
          NS.Audio.sfx('shot3');
          Shots.spawn({ type: 'b3', sprite: 'buster3', x: mz.x - 13, y: mz.y - 8, w: 26, h: 16, vx: 10.5 * dir, vy: 0, dmg: 6, pierce: true });
          NS.FX.shake(2, 6);
          NS.FX.hitstop(3);
        }
        return;
      }
      // 특수무기
      if (this.shotCd > 0) return;
      if (this.ammo[this.weapon] < 1) { NS.Audio.sfx('menuBack'); this.shotCd = 12; return; }
      const mz = this.muzzlePos();
      const dir = this.state === 'wall' ? -this.wallSide : this.facing;
      this.ammo[this.weapon]--;
      this.shootAnim = 18;
      this.shotCd = 14;
      NS.FX.muzzle(mz.x, mz.y);
      if (W.id === 'magma') {
        NS.Audio.sfx('shot2');
        Shots.spawn({
          type: 'magma', sprite: 'magma', x: mz.x - 9, y: mz.y - 9, w: 14, h: 14, vx: 5.2 * dir, vy: -3.8, gravity: 0.27, dmg: 3, elem: 'fire',
          onWall(s) {
            s.dead = true;
            NS.FX.burst(s.x + 7, s.y + 7, 10, { color: [P.orange3, P.red2, P.yellow], up: 1 });
            NS.Audio.sfx('explode');
            for (const d of [-1, 1]) {
              Shots.spawn({ type: 'magmaF', sprite: 'lavaGlob', x: s.x, y: s.y, w: 12, h: 12, vx: 2.2 * d, vy: 0, gravity: 0.3, dmg: 2, elem: 'fire', life: 60, bounces: 2,
                onWall(f) { f.vy = -2.6; f.bounces--; if (f.bounces < 0) f.dead = true; } });
            }
          },
        });
      } else if (W.id === 'frost') {
        NS.Audio.sfx('freeze');
        Shots.spawn({ type: 'frost', sprite: 'frost', x: mz.x - 13, y: mz.y - 5, w: 22, h: 8, vx: 11 * dir, vy: 0, dmg: 2, elem: 'ice', pierce: true, freeze: 90 });
      } else if (W.id === 'cyclone') {
        NS.Audio.sfx('dash');
        const self = this;
        Shots.spawn({
          type: 'cyclone', sprite: 'cyclone', x: mz.x - 10, y: mz.y - 10, w: 18, h: 18, vx: 6.8 * dir, vy: -1.5, dmg: 2, elem: 'wind', pierce: true, life: 110, ignoreWall: true, phase: 0,
          update(s) {
            s.phase++;
            if (s.phase === 26) { s.returning = true; }
            if (s.returning) {
              const a = NS.angleTo(s.x, s.y, self.cx - 9, self.cy - 9);
              s.vx = NS.lerp(s.vx, Math.cos(a) * 8, 0.2);
              s.vy = NS.lerp(s.vy, Math.sin(a) * 8, 0.2);
              if (NS.dist(s.x + 9, s.y + 9, self.cx, self.cy) < 12) s.dead = true;
            } else {
              s.vy -= 0.06;
            }
            if (s.phase % 24 === 0) s.hits.clear(); // 다단히트
          },
        });
      }
    },

    damage(amount, fromDir) {
      if (this.invuln > 0 || !this.alive || this.teleportT > 0) return;
      this.hp -= amount;
      NS.Audio.sfx('hurt');
      NS.FX.hitstop(4);
      NS.FX.shake(3, 10);
      NS.FX.burst(this.cx, this.cy, 8, { color: [P.red3, P.orange3, P.white] });
      NS.FX.popup(this.cx, this.y - 4, `-${amount}`, '#ff9070');
      this.chargeT = 0;
      if (this.hp <= 0) { this.hp = 0; this.kill(); return; }
      this.invuln = 60;
      this.hurtT = 18;
      this.state = this.onGround ? 'ground' : 'air';
      this.vx = (fromDir !== undefined ? fromDir : -this.facing) * 2.2;
      this.vy = -2.6;
      this.onGround = false;
    },

    kill() {
      if (this.state === 'dead') return;
      this.state = 'dead';
      this.deadT = 0;
      this.hp = 0;
      NS.Audio.sfx('bigExplode');
      NS.FX.slowmo(0.3, 50);
      NS.FX.shake(4, 20);
      // 링 형태 에너지 소산
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        NS.FX.p({ x: this.cx, y: this.cy, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, life: 70, size: 3, color: NS.pick([P.cyan2, P.cyan3, P.white]), fade: true });
        NS.FX.p({ x: this.cx, y: this.cy, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.8, life: 90, size: 2, color: P.cyan3, fade: true });
      }
    },

    victory() {
      if (this.state === 'dead') return;
      this.state = 'victory';
      this.victoryT = 0;
      this.vx = 0; this.vy = 0;
      this.chargeT = 0;
    },

    heal(v) {
      this.hp = Math.min(this.maxHp, this.hp + v);
      this.tp = Math.min(this.tpMax, this.tp + Math.ceil(v / 4));
      NS.Audio.sfx('heal');
      NS.FX.burst(this.cx, this.cy, 6, { color: [P.green3, P.white], g: -0.05 });
    },
    refillAmmo(v) {
      let w = this.weapon !== 0 ? this.weapon : [1, 2, 3].filter(i => this.owned[i]).sort((a, b) => this.ammo[a] - this.ammo[b])[0];
      if (w) this.ammo[w] = Math.min(this.ammoMax, this.ammo[w] + v);
      NS.Audio.sfx('pickup');
    },

    // ── 렌더 ──
    spriteKey(forMuzzle) {
      if (this.state === 'dead') return 'hurt';
      if (this.state === 'victory') return 'victory';
      if (this.hurtT > 0) return 'hurt';
      if (this.melee) {
        if (this.atkT > 0) {
          const map = { 1: 'atk1', 2: 'atk2', 3: 'atk3', air: 'atkAir', spin: 'atkSpin' };
          return map[this.atkKind] || 'atk1';
        }
        if (this.shootAnim > 0) return this.onGround ? 'atk1' : 'atkAir';   // 특수무기 시전 포즈
        if (this.state === 'wall') return 'wall';
        if (this.state === 'dash') return 'dash';
        if (!this.onGround) return this.vy < -1 ? 'jumpRise' : this.vy > 1.4 ? 'jumpFall' : 'jumpApex';
        if (this.skidding) return 'skid';
        if (this.landT > 0 && Math.abs(this.vx) < 0.5) return 'land';
        if (Math.abs(this.vx) > 0.3) return 'run';
        return 'idle';
      }
      const shooting = this.shootAnim > 0;
      if (this.state === 'wall') return shooting ? 'wallShoot' : 'wall';
      if (this.state === 'dash') return shooting ? 'dashShoot' : 'dash';
      if (!this.onGround) {
        const k = this.vy < -1 ? 'jumpRise' : this.vy > 1.4 ? 'jumpFall' : 'jumpApex';
        return shooting ? k + 'Shoot' : k;
      }
      if (this.skidding && !shooting) return 'skid';
      if (this.landT > 0 && Math.abs(this.vx) < 0.5 && !shooting) return 'land';
      if (Math.abs(this.vx) > 0.3) return shooting ? 'runShoot' : 'run';
      return shooting ? (forMuzzle ? 'idleShoot' : 'idleShoot') : 'idle';
    },
    spriteNow() {
      const key = this.spriteKey();
      const set = NS.Sprites.heroes[this.charKey];
      const frames = set[key] || set.idle;
      let fi = 0;
      if (key === 'run' || key === 'runShoot') fi = Math.floor(this.runDist / 5) % 12;
      else if (key === 'idle') { const c = Math.floor(this.idleF / 30) % 8; fi = [0, 1, 2, 1, 0, 1, 2, 3][c]; }
      else if (key === 'idleShoot') fi = this.shootAnim > 11 ? 0 : 1;
      else if (key === 'wall') fi = Math.floor(this.idleF / 8) % 2;
      else if (key === 'victory') fi = Math.min(1, Math.floor(this.victoryT / 14));
      else if (key === 'atkSpin') fi = this.atkT > 10 ? 0 : 1;
      const flip = this.facing < 0;
      return { img: frames[Math.min(fi, frames.length - 1)], flip };
    },
    spriteX() { return this.cx - 32; },
    spriteY() { return this.y + this.h - 60; },

    draw(g, cx, cy) {
      if (this.state === 'dead' && this.deadT > 2) return;
      // 상공 강하 등장
      if (this.teleportT > 0) {
        const set = NS.Sprites.heroes[this.charKey];
        if (this.teleportT > 14) {
          const t = (40 - this.teleportT) / 26;
          const dy = (1 - Math.min(1, t)) * -240;
          NS.blit(g, set.jumpFall[0], this.spriteX() - cx, this.spriteY() + dy - cy, false);
        } else {
          NS.blit(g, set.idle[0], this.spriteX() - cx, this.spriteY() - cy, false);
        }
        return;
      }
      if (this.invuln > 0 && this.hurtT <= 0 && (this.invuln % 6) < 3) return; // 무적 점멸
      const { img, flip } = this.spriteNow();
      // 접지 그림자
      if (this.onGround) NS.groundShadow(g, this.cx - cx, this.y + this.h - cy, 14);
      NS.blit(g, img, this.spriteX() - cx, this.spriteY() - cy, flip);
      // 차지 궤도 픽셀 (구조화)
      if (this.chargeT > 10) {
        const lvl = this.chargeT >= this.chargeMax() ? 2 : this.chargeT >= this.chargeMid() ? 1 : 0;
        const n = 3 + lvl * 2;
        const cols = this.melee ? [P.steel5, P.white, P.orange3] : [P.orange3, P.yellow, P.white];
        for (let k = 0; k < n; k++) {
          const a = this.idleF * (0.18 + lvl * 0.06) + k * Math.PI * 2 / n;
          const r = 16 + Math.sin(this.idleF * 0.3 + k) * 4;
          const px2 = this.cx + Math.cos(a) * r - cx, py2 = this.cy + Math.sin(a) * r * 0.8 - cy;
          g.fillStyle = cols[k % cols.length];
          g.fillRect(Math.round(px2), Math.round(py2), lvl > 0 ? 2 : 1, lvl > 0 ? 2 : 1);
        }
      }
      // 풀차지 오라
      if (this.chargeT >= this.chargeMid()) {
        const full = this.chargeT >= this.chargeMax();
        const r = 20 + Math.sin(this.idleF * 0.4) * 3;
        g.globalAlpha = full ? 0.4 : 0.22;
        g.strokeStyle = this.melee ? (full ? P.orange3 : P.steel5) : (full ? P.yellow : P.orange3);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(Math.round(this.cx - cx), Math.round(this.cy - cy), r, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    },
  };
  NS.Player = Player;
})();
