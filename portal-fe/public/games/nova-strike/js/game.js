// NOVA STRIKE — game: 상태 머신, 세이브(localStorage), 스테이지 플로우, 보스 체인
'use strict';
(function () {
  const SAVE_KEY = 'nova-strike-save-v1';
  const P = NS.PAL;

  const defaultSave = () => ({
    chips: 0,
    charKey: 'dusk',
    cleared: {},                 // stageId → true
    weapons: {},                 // magma/frost/cyclone → true
    collected: {},               // persistId → true
    shop: {},                    // upgradeId → true
    subtankCharge: 0,
    best: {},                    // stageId → { time, score }
    totalScore: 0,
    endingSeen: false,
  });

  const SHOP_ITEMS = [
    { id: 'maxHp', name: '아머 강화 I', desc: '최대 체력 +4', cost: 300 },
    { id: 'maxHp2', name: '아머 강화 II', desc: '최대 체력 +4 (중첩)', cost: 700, needs: 'maxHp' },
    { id: 'lifePlus', name: '예비 보디', desc: '시작 라이프 +1', cost: 400 },
    { id: 'chargeSpeed', name: '차지 가속기', desc: '차지 속도 1.25배', cost: 500 },
    { id: 'magnet', name: '칩 자석', desc: '코어 칩 자동 흡인', cost: 250 },
    { id: 'dashIFrame', name: '대시 코팅', desc: '대시 시작 10프레임 무적', cost: 600 },
    { id: 'weaponEff', name: '증폭 탄창', desc: '특수무기 에너지 최대 +8', cost: 450 },
  ];
  NS.SHOP_ITEMS = SHOP_ITEMS;

  const Game = {
    state: 'boot',            // boot → title → charSelect → select/shop → stage → ...
    save: null,
    stage: null,              // 실행 중 스테이지 상태
    selectIdx: 0, shopIdx: 0, pauseIdx: 0, charIdx: 0,
    stateT: 0,
    announceQueue: [],        // {text, t}
    pendingWeapon: null,
    endingStats: null,
    introSeen: false,

    // ── 세이브 ──
    loadSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        this.save = raw ? Object.assign(defaultSave(), JSON.parse(raw)) : defaultSave();
      } catch (e) { this.save = defaultSave(); }
    },
    persist() {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* 세이브 불가 환경 */ }
    },
    meta() {
      const s = this.save;
      const hearts = ['mg-heart', 'cr-heart', 'st-heart'].filter(id => s.collected[id]).length;
      return {
        hearts,
        charKey: s.charKey || 'dusk',
        shop: s.shop,
        weapons: s.weapons,
        parts: { boots: !!s.collected['mg-caps'], buster: !!s.collected['st-caps'] },
        subtank: !!s.collected['cr-sub'],
      };
    },
    clearedCount() { return NS.STAGE_ORDER.slice(0, 3).filter(id => this.save.cleared[id]).length; },

    addChips(n) { this.save.chips += n; this.persist(); },
    addScore(n) { if (this.stage) this.stage.score += n; },
    collectPersist(id) { if (id) { this.save.collected[id] = true; this.persist(); } },
    announce(text) { this.announceQueue.push({ text, t: 150 }); },

    setState(st) { this.state = st; this.stateT = 0; },

    // ── 부팅 ──
    boot() {
      this.loadSave();
      NS.bakeCharacterSprites();
      NS.bakeEnemySprites();
      NS.bakeBossSprites();
      NS.bakeStageSprites();
      this.setState('title');
      NS.Input.onFirstKey(() => {
        NS.Audio.unlock();
        if (this.state === 'title') NS.Audio.playBgm('title');
      });
    },

    // ── 스테이지 시작 ──
    startStage(stageId) {
      const def = NS.STAGES[stageId];
      const theme = NS.THEMES[def.theme];
      NS.FX.reset();
      NS.BossMarkers.reset();
      NS.Level.load(theme, def.build());
      NS.Enemies.reset(def.enemies.map(([type, x, y]) => ({ type, x, y: y - 1 })));
      NS.Items.reset();
      for (const [kind, tx, ty, persistId, part] of def.items) {
        if (persistId && this.save.collected[persistId]) continue;
        NS.Items.add(kind, tx * NS.TILE, ty * NS.TILE, { persistId, part });
      }
      NS.Boss.active = false;
      const meta = this.meta();
      NS.Player.spawn(def.playerStart.x, def.playerStart.y, meta);
      NS.Player.lives = 3 + (meta.shop.lifePlus ? 1 : 0);
      this.stage = {
        id: stageId, def,
        time: 0, score: 0,
        respawn: { x: def.playerStart.x, y: def.playerStart.y },
        checkpointsHit: {},
        doorClosed: false,
        bossDefeated: false,
        kairosChainT: 0,
        lava: def.lavaChase ? { active: false, done: false, y: def.lavaChase.fromY } : null,
        deathHandled: false,
      };
      NS.Level.updateCamera(NS.Player, true);
      NS.Audio.playBgm(def.bgm);
      this.setState('stage');
    },

    respawnPlayer() {
      const st = this.stage;
      NS.Player.spawn(st.respawn.x, st.respawn.y, this.meta());
      st.deathHandled = false;
      st.doorClosed = false;
      // 보스방 문/카메라 원복
      NS.Boss.active = false;
      NS.Level.camBounds = null;
      NS.EBullets.reset();
      NS.BossMarkers.reset();
      if (st.lava) { st.lava.active = false; st.lava.y = st.def.lavaChase.fromY; NS.Level.lavaRise = null; }
      for (let y = 24; y < 30; y++) NS.Level.set(NS.DOOR_COL, y, '.'); // 보스방 문 재개방
      NS.Level.updateCamera(NS.Player, true);
      NS.Audio.playBgm(st.def.bgm);
    },

    // ── 스테이지 갱신 ──
    updateStage() {
      const st = this.stage;
      const pl = NS.Player;
      const L = NS.Level;
      st.time++;

      // 일시정지
      if (NS.Input.pressed('start') && pl.alive && this.state === 'stage') {
        this.pauseIdx = 0;
        this.setState('paused');
        NS.Audio.sfx('pause');
        return;
      }

      pl.update();

      // 체크포인트
      for (const [tx, ty] of st.def.checkpoints) {
        const key = `${tx},${ty}`;
        if (!st.checkpointsHit[key] && Math.abs(pl.cx - tx * NS.TILE) < 14 && Math.abs((pl.y + pl.h) - ty * NS.TILE) < 40) {
          st.checkpointsHit[key] = true;
          st.respawn = { x: tx * NS.TILE, y: (ty - 3) * NS.TILE };
          NS.Audio.sfx('checkpoint');
          pl.heal(pl.maxHp);   // 활성화 시 완전 회복
          this.announce('체크포인트 기록 — 아머 수복');
        }
      }

      // 바람 (폭풍)
      if (st.def.windZones && pl.alive) {
        for (const z of st.def.windZones) {
          if (pl.cx > z.x0 && pl.cx < z.x1 && pl.cy > z.y0 && pl.cy < z.y1) {
            pl.vy = Math.max(pl.vy + z.fy, -3.2);
            if (NS.chance(0.4)) NS.FX.p({ x: NS.rand(z.x0, z.x1), y: pl.cy + NS.rand(-60, 80), vx: 0, vy: -3, life: 16, size: 1, color: NS.rgba('#c8d8ff', 0.55) });
          }
        }
      }
      // 용암 추격 (마그마)
      if (st.lava && pl.alive) {
        const cfg = st.def.lavaChase;
        if (!st.lava.done && !st.lava.active && pl.x > cfg.startX) {
          st.lava.active = true;
          NS.Audio.sfx('warning');
          this.announce('경고 — 용암 상승!');
        }
        if (st.lava.active) {
          st.lava.y = Math.max(cfg.minY, st.lava.y - cfg.speed);
          L.lavaRise = { y: st.lava.y };
          if (pl.x > cfg.endX) { st.lava.active = false; st.lava.done = true; }
        } else if (st.lava.done && L.lavaRise) {
          st.lava.y += 3;
          L.lavaRise = st.lava.y > L.pxH ? null : { y: st.lava.y };
        }
      }

      // 보스 트리거 (방 내부 높이에서만 — 지붕 위 통과 방지)
      if (!st.doorClosed && pl.x > (NS.DOOR_COL + 2) * NS.TILE && pl.y > NS.ARENA.y0 + 100) {
        st.doorClosed = true;
        for (let y = 24; y < 30; y++) L.set(NS.DOOR_COL, y, '#');
        NS.Audio.sfx('doorOpen');
        NS.Audio.stopBgm();
        NS.Boss.start(st.def.boss, NS.ARENA, () => this.onBossDefeat());
      }

      NS.Enemies.update(pl);
      NS.Items.update(pl);
      NS.Shots.update();
      NS.EBullets.update();
      NS.Boss.update(pl);
      NS.BossMarkers.update();
      L.updateCrumbles();
      L.spawnAmbient();

      // 적 발사체 → 플레이어
      if (pl.alive && pl.invuln <= 0) {
        for (const b of NS.EBullets.list) {
          if (b.dead) continue;
          if (NS.aabb(pl.x, pl.y, pl.w, pl.h, b.x, b.y, b.w, b.h)) {
            b.dead = true;
            pl.damage(b.dmg, NS.sign(pl.cx - (b.x + b.w / 2)) || 1);
          }
        }
      }

      // 카메라 (보스전은 arena 고정)
      L.updateCamera(pl);

      // 사망 처리
      if (!pl.alive && !st.deathHandled && pl.deadT > 110) {
        st.deathHandled = true;
        pl.lives--;
        if (pl.lives > 0) this.respawnPlayer();
        else {
          NS.Audio.jingle('gameover');
          if (window.PlatformAdapter) PlatformAdapter.runEnd({ score: st.score, detail: { stage: st.id, time: st.time, cleared: false } });
          this.setState('gameover');
        }
      }

      // 카이로스 1형태 → 2형태 체인
      if (st.kairosChainT > 0) {
        st.kairosChainT--;
        if (!(st.kairosChainT > 0)) {
          NS.Boss.start('kairos2', NS.ARENA, () => this.onBossDefeat());
          NS.Boss.state = 'enter'; NS.Boss.t = 0; // WARNING 생략, 바로 등장
          NS.Audio.sfx('phase');
        }
      }
    },

    onBossDefeat() {
      const st = this.stage;
      const pl = NS.Player;
      if (st.id === 'core' && !st.kairos2Done) {
        if (NS.Boss.id === 'kairos1') {
          // 형태 전환
          st.kairosChainT = 90;
          this.announce('카이로스 — 「이 몸의 진정한 형태를 보아라」');
          NS.FX.flash('#e63e8f', 24);
          return;
        }
        st.kairos2Done = true;
      }
      st.bossDefeated = true;
      pl.victory();
      NS.Audio.jingle('victory');
      NS.FX.flash('#ffffff', 18);
      this.addScore(5000);
      const timeBonus = Math.max(0, 18000 - st.time);
      this.addScore(Math.floor(timeBonus / 10));
      // 세이브 반영
      const first = !this.save.cleared[st.id];
      this.save.cleared[st.id] = true;
      const weaponBy = { magma: 'magma', cryo: 'frost', storm: 'cyclone' };
      if (weaponBy[st.id]) this.save.weapons[weaponBy[st.id]] = true;
      const best = this.save.best[st.id];
      if (!best || st.score > best.score) this.save.best[st.id] = { time: st.time, score: st.score };
      this.save.totalScore = Object.values(this.save.best).reduce((a, b) => a + b.score, 0);
      this.persist();
      if (window.PlatformAdapter) PlatformAdapter.runEnd({ score: st.score, detail: { stage: st.id, time: st.time, cleared: true } });
      this.pendingWeapon = first && weaponBy[st.id] ? weaponBy[st.id] : null;
      setTimeoutFrames(this, st.id === 'core' ? 'ending' : (this.pendingWeapon ? 'weaponGet' : 'results'), 140);
      if (st.id === 'core') {
        this.endingStats = { time: st.time, score: st.score };
        this.save.endingSeen = true;
        this.persist();
      }
    },

    // ── 메뉴 입력 ──
    updateTitle() {
      if (NS.Input.pressed('start') || NS.Input.pressed('jump')) {
        NS.Audio.sfx('menuSel');
        NS.Audio.playBgm('title');
        this.charIdx = this.save.charKey === 'raven' ? 1 : 0;
        this.setState('charSelect');
      }
    },
    updateCharSelect() {
      const I = NS.Input;
      if (I.pressed('left') || I.pressed('right')) { this.charIdx = 1 - this.charIdx; NS.Audio.sfx('menuMove'); }
      if (I.pressed('back')) { NS.Audio.sfx('menuBack'); this.setState('title'); return; }
      if (I.pressed('jump') || I.pressed('start')) {
        this.save.charKey = this.charIdx === 1 ? 'raven' : 'dusk';
        this.persist();
        NS.Audio.sfx('menuSel');
        this.setState('select');
        this.selectIdx = 0;
      }
    },
    updateSelect() {
      const I = NS.Input;
      const cols = 5; // 4 스테이지 + 연구소
      if (I.pressed('back')) { NS.Audio.sfx('menuBack'); this.setState('charSelect'); return; }
      if (I.pressed('left')) { this.selectIdx = (this.selectIdx + cols - 1) % cols; NS.Audio.sfx('menuMove'); }
      if (I.pressed('right')) { this.selectIdx = (this.selectIdx + 1) % cols; NS.Audio.sfx('menuMove'); }
      if (I.pressed('jump') || I.pressed('start')) {
        if (this.selectIdx === 4) { NS.Audio.sfx('menuSel'); this.shopIdx = 0; this.setState('shop'); return; }
        const id = NS.STAGE_ORDER[this.selectIdx];
        const def = NS.STAGES[id];
        if (def.locked && this.clearedCount() < 3) { NS.Audio.sfx('menuBack'); this.announce('가디언 3기를 먼저 격파하라'); return; }
        NS.Audio.sfx('menuSel');
        NS.Audio.stopBgm();
        this.startStage(id);
      }
    },
    updateShop() {
      const I = NS.Input;
      const n = SHOP_ITEMS.length;
      if (I.pressed('up')) { this.shopIdx = (this.shopIdx + n - 1) % n; NS.Audio.sfx('menuMove'); }
      if (I.pressed('down')) { this.shopIdx = (this.shopIdx + 1) % n; NS.Audio.sfx('menuMove'); }
      if (I.pressed('back')) { NS.Audio.sfx('menuBack'); this.setState('select'); return; }
      if (I.pressed('jump') || I.pressed('start')) {
        const item = SHOP_ITEMS[this.shopIdx];
        const s = this.save;
        if (s.shop[item.id]) { NS.Audio.sfx('menuBack'); return; }
        if (item.needs && !s.shop[item.needs]) { NS.Audio.sfx('menuBack'); return; }
        if (s.chips < item.cost) { NS.Audio.sfx('menuBack'); return; }
        s.chips -= item.cost;
        s.shop[item.id] = true;
        this.persist();
        NS.Audio.sfx('weaponGet');
      }
    },
    updatePaused() {
      const I = NS.Input;
      const opts = this.pauseOptions();
      if (I.pressed('up')) { this.pauseIdx = (this.pauseIdx + opts.length - 1) % opts.length; NS.Audio.sfx('menuMove'); }
      if (I.pressed('down')) { this.pauseIdx = (this.pauseIdx + 1) % opts.length; NS.Audio.sfx('menuMove'); }
      if (I.pressed('start') || I.pressed('back')) { NS.Audio.sfx('pause'); this.setState('stage'); return; }
      if (I.pressed('jump')) {
        const opt = opts[this.pauseIdx];
        if (opt.id === 'resume') { NS.Audio.sfx('pause'); this.setState('stage'); }
        else if (opt.id === 'subtank') {
          const pl = NS.Player;
          if (this.save.subtankCharge > 0 && pl.hp < pl.maxHp) {
            const use = Math.min(this.save.subtankCharge, pl.maxHp - pl.hp);
            pl.hp += use;
            this.save.subtankCharge -= use;
            this.persist();
            NS.Audio.sfx('heal');
          } else NS.Audio.sfx('menuBack');
        } else if (opt.id === 'quit') {
          NS.Audio.stopBgm();
          NS.Audio.sfx('menuBack');
          NS.Level.camBounds = null;
          NS.Boss.active = false;
          this.setState('select');
          NS.Audio.playBgm('title');
        }
      }
    },
    pauseOptions() {
      const opts = [{ id: 'resume', label: '계속하기' }];
      if (this.meta().subtank) opts.push({ id: 'subtank', label: `서브 탱크 사용 (${this.save.subtankCharge}/28)` });
      opts.push({ id: 'quit', label: '스테이지 포기' });
      return opts;
    },
    updateWeaponGet() {
      if (this.stateT > 90 && (NS.Input.pressed('jump') || NS.Input.pressed('start'))) {
        NS.Audio.sfx('menuSel');
        this.setState('results');
      }
    },
    updateResults() {
      if (this.stateT > 60 && (NS.Input.pressed('jump') || NS.Input.pressed('start'))) {
        NS.Audio.sfx('menuSel');
        NS.Audio.playBgm('title');
        NS.Level.camBounds = null;
        this.setState('select');
      }
    },
    updateGameover() {
      if (this.stateT > 90 && (NS.Input.pressed('jump') || NS.Input.pressed('start'))) {
        NS.Audio.sfx('menuSel');
        NS.Level.camBounds = null;
        NS.Boss.active = false;
        NS.Audio.playBgm('title');
        this.setState('select');
      }
    },
    updateEnding() {
      if (this.stateT > 300 && (NS.Input.pressed('jump') || NS.Input.pressed('start'))) {
        NS.Audio.sfx('menuSel');
        NS.Level.camBounds = null;
        NS.Audio.playBgm('title');
        this.setState('select');
      }
    },

    // ── 메인 스텝 (고정) ──
    step() {
      this.stateT++;
      for (const a of this.announceQueue) a.t--;
      this.announceQueue = this.announceQueue.filter(a => a.t > 0);

      switch (this.state) {
        case 'title': this.updateTitle(); break;
        case 'charSelect': this.updateCharSelect(); break;
        case 'select': this.updateSelect(); break;
        case 'shop': this.updateShop(); break;
        case 'stage': {
          // 히트스톱/슬로모는 월드 갱신만 정지
          const steps = NS.FX.worldSteps();
          NS.FX.tickHitstop();
          if (steps > 0) this.updateStage();
          else if (NS.Input.pressed('start') && NS.Player.alive) { this.pauseIdx = 0; this.setState('paused'); NS.Audio.sfx('pause'); }
          NS.FX.update();
          break;
        }
        case 'paused': this.updatePaused(); break;
        case 'weaponGet': this.updateWeaponGet(); NS.FX.update(); break;
        case 'results': this.updateResults(); NS.FX.update(); break;
        case 'gameover': this.updateGameover(); NS.FX.update(); break;
        case 'ending': this.updateEnding(); NS.FX.update(); break;
      }
      // 상태 전환 타이머
      tickTimeouts(this);
    },

    // ── 월드 렌더 (픽셀 캔버스) ──
    drawWorld(g) {
      const inStage = ['stage', 'paused', 'weaponGet', 'results', 'gameover', 'ending'].includes(this.state);
      if (!inStage || !this.stage) return;
      const shake = NS.FX.shakeOffset();
      const cx = Math.round(NS.Level.camX + shake.x);
      const cy = Math.round(NS.Level.camY + shake.y);
      NS.Level.draw(g);
      NS.BossMarkers.draw(g, cx, cy);
      NS.Items.draw(g, cx, cy);
      NS.Enemies.draw(g, cx, cy);
      NS.Boss.draw(g, cx, cy);
      // 체크포인트 비콘
      for (const [tx, ty] of this.stage.def.checkpoints) {
        const hit = this.stage.checkpointsHit[`${tx},${ty}`];
        const img = NS.Sprites.beacon[hit ? 1 : 0];
        NS.blit(g, img, tx * NS.TILE - 8 - cx, ty * NS.TILE - 32 - cy);
      }
      NS.Player.draw(g, cx, cy);
      NS.Shots.draw(g, cx, cy);
      NS.EBullets.draw(g, cx, cy);
      NS.FX.drawWorld(g, cx, cy);
      NS.Level.drawFront(g);
      NS.FX.drawScreenFlash(g);
    },
  };
  NS.Game = Game;

  // 프레임 기반 상태 전환 타이머 (Date 사용 금지 규약)
  const timeouts = [];
  function setTimeoutFrames(game, state, frames) { timeouts.push({ state, frames }); }
  function tickTimeouts(game) {
    for (const t of timeouts) {
      t.frames--;
      if (!(t.frames > 0)) game.setState(t.state);
    }
    for (let i = timeouts.length - 1; i >= 0; i--) if (!(timeouts[i].frames > 0)) timeouts.splice(i, 1);
  }
})();
