// Game orchestrator: fixed-step simulation, state machine, room lifecycle and the
// full render pipeline. Everything that needs to know about "the run" lives here.

import {
  TAU, clamp, lerp, damp, dist, rng, Rng, easeOutCubic, easeOutQuint, noise1, formatInt,
} from './core.js';
import {
  updateFx, drawParticles, drawDamageNumbers, drawShockwaves, drawDecals, drawFloaters,
  drawFlashes, getShake, addShake, screenFlash, tickHitstop, getHitstop, clearFx, clearDecals,
  burst, shockwave, rgba, floatText, emit, getChroma,
} from './fx.js';
import {
  initInput, endFrame, isDown, justPressed, buffered, consumeBuffer, clearBuffers, menuAxis,
} from './input.js';
import {
  initAudio, resumeAudio, sfx, playMusic, stopMusic, duckMusic, setSfxVolume, setMusicVolume,
  toggleMute, getVolumes, audioReady,
} from './audio.js';
import {
  PAL, GODS, RARITY, BIOME_THEME, causticFrame, vignette, grainTexture, drawGlyph, glowDot, starPath,
} from './art.js';
import { Build, rollBoonOffer, BOON_BY_ID } from './boons.js';
import {
  loadSave, getSave, metaMods, addShards, recordRunStart, recordRunEnd, recordBossKill,
  META_UPGRADES, levelOf, upgradeCost, buyUpgrade, respec, setSetting, getSettings, setFlag, getFlag,
} from './meta.js';
import { Player } from './player.js';
import { Enemy, drawTelegraph, tierFor } from './enemies.js';
import { Beam } from './bosses.js';
import { TEAM, Pickup, drawChainArcs, applyDamage } from './entities.js';
import {
  Room, Door, Pedestal, BIOMES, REWARD_TYPES, SHOP_STOCK,
  planRun, doorRewardsFor, buildRoom, planWaves, spawnWave, spawnBoss, placeDoors,
} from './rooms.js';
import * as UI from './ui.js';

const W = UI.W, H = UI.H;
const STEP = 1 / 60;
const MAX_STEPS = 5;

// World-space zoom. Actors are authored at "true" scale (player radius 17) and
// the camera pulls in so a fight reads at roughly the same character-to-screen
// ratio as an isometric action roguelike.
const ZOOM = 1.5;
const BOSS_ZOOM = 1.28;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.state = 'title';
    this.stateT = 0;
    this.acc = 0;
    this.last = 0;
    this.time = 0;
    this.dtReal = STEP;
    this.frame = 0;
    this.fps = 60;
    this.fpsAcc = 0;
    this.fpsN = 0;

    this.hint = '';
    this.hintT = 0;
    this.banner = null;

    this.titleIndex = 0;
    this.titleItems = [
      { id: 'play', label: '심연으로 잠수' },
      { id: 'sanctum', label: '침묵의 영묘' },
      { id: 'controls', label: '조작법' },
    ];
    this.sanctumIndex = 0;
    this.pauseIndex = 0;
    this.pauseItems = [
      { id: 'resume', label: '계속하기' },
      { id: 'sfx', label: '효과음', value: () => volBar(getVolumes().sfx) },
      { id: 'music', label: '음악', value: () => volBar(getVolumes().music) },
      { id: 'controls', label: '조작법' },
      { id: 'quit', label: '잠수 포기' },
    ];

    this.boonCards = [];
    this.boonIndex = 0;
    this.boonT = 0;
    this.boonTitle = '축복을 선택하라';
    this.boonSubtitle = '';
    this.afterBoon = null;

    this.snow = [];
    for (let i = 0; i < 150; i++) {
      this.snow.push({
        x: rng.range(-1200, 1200), y: rng.range(-900, 900),
        z: rng.range(0.25, 1), r: rng.range(0.8, 2.6),
        vy: rng.range(6, 26), vx: rng.range(-10, 10), ph: rng.angle(),
      });
    }

    this.world = null;
    this.summary = null;
    this.paused = false;

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
  }

  // ---------------------------------------------------------------- boot

  init() {
    loadSave();
    const s = getSettings();
    initAudio();
    setSfxVolume(s.sfx);
    setMusicVolume(s.music);
    initInput(window);
    window.addEventListener('resize', this.resize);
    this.resize();

    const unlock = () => {
      resumeAudio();
      playMusic(this.state === 'sanctum' ? 'sanctum' : 'menu');
    };
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });

    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  resize() {
    const cw = window.innerWidth, chh = window.innerHeight;
    const scale = Math.min(cw / W, chh / H);
    const dispW = Math.floor(W * scale), dispH = Math.floor(H * scale);
    this.canvas.style.width = `${dispW}px`;
    this.canvas.style.height = `${dispH}px`;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(W * this.dpr);
    this.canvas.height = Math.floor(H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  }

  // ---------------------------------------------------------------- loop

  loop(ts) {
    requestAnimationFrame(this.loop);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = STEP;
    dt = Math.min(dt, 0.25);
    this.dtReal = dt;
    this.time += dt;
    this.frame++;

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }

    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;

    this.render();
    // Only retire edge-triggered input once a simulation step has actually seen
    // it. Above ~60Hz many render frames run zero steps, and clearing there
    // would swallow presses that landed on those frames.
    if (steps > 0) endFrame();
  }

  step(dt) {
    this.stateT += dt;
    this.hintT = Math.max(0, this.hintT - dt);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.life) this.banner = null;
    }
    if (justPressed('mute')) {
      const muted = toggleMute();
      this.toast(muted ? '음소거' : '음소거 해제', 1.4);
    }

    switch (this.state) {
      case 'title': this.stepTitle(dt); break;
      case 'controls': this.stepControls(dt); break;
      case 'sanctum': this.stepSanctum(dt); break;
      case 'playing': this.stepPlaying(dt); break;
      case 'boonSelect': this.stepBoonSelect(dt); break;
      case 'paused': this.stepPaused(dt); break;
      case 'runEnd': this.stepRunEnd(dt); break;
    }
    updateFx(dt);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    clearBuffers();
  }

  toast(msg, seconds = 2.6) {
    this.hint = msg;
    this.hintT = seconds;
  }

  showBanner(title, subtitle, color, life = 2.4, big = false) {
    this.banner = { title, subtitle, color, life, t: 0, big };
  }

  // --------------------------------------------------------------- title

  stepTitle(dt) {
    playMusic('menu');
    const ay = menuAxis('y');
    if (ay) {
      this.titleIndex = (this.titleIndex + ay + this.titleItems.length) % this.titleItems.length;
      sfx('uiMove');
    }
    if (justPressed('confirm') || justPressed('interact')) {
      const it = this.titleItems[this.titleIndex];
      sfx('uiSelect');
      if (it.id === 'play') this.startRun();
      else if (it.id === 'sanctum') { this.setState('sanctum'); playMusic('sanctum'); }
      else if (it.id === 'controls') { this.returnTo = 'title'; this.setState('controls'); }
    }
  }

  stepControls(dt) {
    if (justPressed('cancel') || justPressed('confirm') || justPressed('interact')) {
      sfx('uiBack');
      this.setState(this.returnTo || 'title');
    }
  }

  // ------------------------------------------------------------- sanctum

  stepSanctum(dt) {
    playMusic('sanctum');
    const cols = 5;
    const n = META_UPGRADES.length;
    const ax = menuAxis('x'), ay = menuAxis('y');
    if (ax) { this.sanctumIndex = clamp(this.sanctumIndex + ax, 0, n - 1); sfx('uiMove'); }
    if (ay) { this.sanctumIndex = clamp(this.sanctumIndex + ay * cols, 0, n - 1); sfx('uiMove'); }

    if (justPressed('interact') || justPressed('confirm')) {
      const u = META_UPGRADES[this.sanctumIndex];
      const cost = upgradeCost(u.id);
      if (cost === null) { sfx('uiBack'); this.toast('이미 최대 단계다'); }
      else if (buyUpgrade(u.id)) {
        sfx('boon', this.sanctumIndex);
        screenFlash('#57e2d6', 0.2, 0.3);
        this.toast(`${u.name} 강화 → ${levelOf(u.id)}단계`);
      } else {
        sfx('uiBack');
        this.toast(`심연 결정이 ${cost - getSave().shards} 개 부족하다`);
      }
    }
    if (justPressed('respec')) {
      const refund = respec();
      if (refund > 0) {
        sfx('uiSelect');
        this.toast(`강화를 전부 되돌렸다 — 심연 결정 ${refund} 반환`, 3.2);
      } else {
        sfx('uiBack');
        this.toast('되돌릴 강화가 없다');
      }
    }
    if (justPressed('cancel')) { sfx('uiBack'); this.setState('title'); playMusic('menu'); }
  }

  // ---------------------------------------------------------- run start

  startRun() {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    this.runRng = new Rng(seed);
    const mm = metaMods();
    const build = new Build(mm);
    const plan = planRun(seed);

    this.world = {
      seed,
      plan,
      biomeIndex: 0,
      roomIndex: 0,
      biomePlan: plan[0],
      room: null,
      player: null,
      enemies: [], projectiles: [], pickups: [], hazards: [], beams: [],
      rings: [], spikes: [], arcs: [], tendrilFx: [],
      doors: [], pedestals: [],
      boss: null,
      camera: { x: 0, y: 0, tx: 0, ty: 0 },
      zoom: ZOOM,
      run: { gold: mm.startGold || 0, shards: 0, kills: 0, boons: 0, startTime: performance.now() },
      controlLocked: false,
      prompt: null,
      waves: [], waveIndex: 0, waveTotal: 0,
      arenaHazard: false,
      pendingBoon: false,
      phase: 'combat',
    };

    clearFx();
    recordRunStart();
    this.summary = null;
    this.setState('playing');
    this.enterRoom(0, 0, true);
    if (!getFlag('seenIntro')) {
      setFlag('seenIntro');
      this.toast('WASD 이동 · J 공격 · K 특수 · L 주문 · SPACE 대시', 8);
    } else {
      this.toast('SPACE 대시는 무적이다. 예고를 보고 빠져나가라.', 5);
    }
  }

  // ------------------------------------------------------------- rooms

  enterRoom(biomeIndex, roomIndex, fresh = false) {
    const world = this.world;
    world.biomeIndex = biomeIndex;
    world.roomIndex = roomIndex;
    world.biomePlan = world.plan[biomeIndex];
    const info = world.biomePlan.rooms[roomIndex];
    world.roomInfo = info;

    const room = buildRoom(info, biomeIndex);
    world.room = room;
    world.enemies.length = 0;
    world.projectiles.length = 0;
    world.hazards.length = 0;
    world.beams.length = 0;
    world.rings.length = 0;
    world.spikes.length = 0;
    world.tendrilFx.length = 0;
    world.pickups.length = 0;
    world.doors = [];
    world.pedestals = [];
    world.boss = null;
    world.arenaHazard = false;
    world.prompt = null;
    world.controlLocked = false;
    clearDecals();

    const spawnX = room.cx;
    const spawnY = room.bottom - 110;
    if (fresh) {
      world.player = new Player(spawnX, spawnY, new Build(metaMods()));
      world.player.build = world.player.build;
    } else {
      world.player.x = spawnX;
      world.player.y = spawnY;
      world.player.vx = 0; world.player.vy = 0;
      world.player.knockVx = 0; world.player.knockVy = 0;
      world.player.state = 'free';
      world.player.invuln = 0.8;
      world.player.dashStock = world.player.dashCharges;
      world.player.castAmmo = world.player.castAmmoMax;
      world.player.statuses = Object.create(null);
      world.player.defiance = world.player.defianceMax;
    }
    world.player.facing = -Math.PI / 2;
    world.player.invuln = Math.max(world.player.invuln, 1.0);
    world.camera.x = spawnX;
    world.camera.y = spawnY - 60;
    world.zoom = info.type === 'boss' ? BOSS_ZOOM : ZOOM;

    const th = BIOME_THEME[info.biome];
    const tier = tierFor(biomeIndex, roomIndex);

    if (info.type === 'boss') {
      world.phase = 'boss';
      const b = spawnBoss(world, info.biome, tier);
      playMusic('boss');
      this.showBanner(th.name, '수호자가 기다린다', '#ff5a4d', 2.4, true);
      sfx('bossRoar');
    } else if (info.type === 'shop') {
      world.phase = 'shop';
      room.cleared = true;
      const stock = this.runRng.shuffle(SHOP_STOCK).slice(0, 3);
      stock.forEach((item, i) => {
        world.pedestals.push(new Pedestal(room.cx + (i - 1) * 190, room.cy - 30, item));
      });
      playMusic(info.biome);
      this.showBanner('난파선 상인', '금화로 물건을 산다', '#c9a04a', 2.2);
      this.openDoors();
    } else {
      world.phase = 'combat';
      world.waves = planWaves(info, biomeIndex, roomIndex);
      world.waveIndex = 0;
      world.waveTotal = world.waves.reduce((a, b) => a + b.length, 0);
      spawnWave(world, world.waves[0], tier);
      playMusic(info.biome);
      if (roomIndex === 0) {
        this.showBanner(th.name, BIOME_THEME[info.biome].subtitle, th.accent2, 2.6, true);
      }
      if (info.elite) this.toast('강화된 적이 섞여 있다', 2.6);
    }

    screenFlash('#000000', 0.9, 0.45);
  }

  clearRoom() {
    const world = this.world;
    if (world.room.cleared) return;
    world.room.cleared = true;
    sfx('doorOpen');
    screenFlash('#ffffff', 0.18, 0.4);

    // Grant this room's reward, then open the doors.
    const reward = world.roomInfo.reward;
    this.grantReward(reward, () => this.openDoors());
  }

  grantReward(reward, done) {
    const world = this.world;
    const p = world.player;
    const depth = world.biomeIndex * 6 + world.roomIndex;
    switch (reward.type) {
      case 'boon': {
        this.openBoonSelect(reward.god || null, done);
        return;
      }
      case 'gold': {
        const amt = Math.round((55 + depth * 14) * p.mods.goldMult);
        for (let i = 0; i < 8; i++) {
          world.pickups.push(new Pickup(
            world.room.cx + rng.range(-70, 70), world.room.cy + rng.range(-50, 50),
            'gold', Math.max(1, Math.round(amt / 8))
          ));
        }
        this.toast(`금화 ${amt} 획득`);
        break;
      }
      case 'shard': {
        const amt = Math.max(1, Math.round((2 + world.biomeIndex) * p.mods.shardMult));
        for (let i = 0; i < amt; i++) {
          world.pickups.push(new Pickup(
            world.room.cx + rng.range(-60, 60), world.room.cy + rng.range(-40, 40), 'shard', 1
          ));
        }
        this.toast(`심연 결정 ${amt} 획득`);
        break;
      }
      case 'heal': {
        const amt = Math.round(p.maxHp * 0.35);
        world.pickups.push(new Pickup(world.room.cx, world.room.cy, 'health', amt));
        this.toast('조류 샘이 솟았다');
        break;
      }
      case 'maxhp': {
        p.addMaxHp(20);
        floatText(p.x, p.y - 60, '최대 체력 +20', { color: '#ff8fb0', size: 24, life: 2 });
        sfx('heal');
        break;
      }
      default: break;
    }
    if (done) done();
  }

  openDoors() {
    const world = this.world;
    const rewards = doorRewardsFor(world.plan, world.biomeIndex, world.roomIndex, this.runRng, world.player.build);
    if (rewards.length === 0) { this.winRun(); return; }
    world.doors = placeDoors(world.room, rewards);
    for (const d of world.doors) d.open = true;
    sfx('doorOpen');
  }

  takeDoor(door) {
    const world = this.world;
    const nextIndex = door.reward.roomIndex;
    if (door.reward.jump || nextIndex === undefined) {
      // Advance to the next biome.
      const nb = world.biomeIndex + 1;
      if (nb >= world.plan.length) { this.winRun(); return; }
      // Carry the chosen reward into the first room of the next biome.
      world.plan[nb].rooms[0].reward = { ...door.reward, roomIndex: undefined, jump: undefined };
      this.enterRoom(nb, 0);
      return;
    }
    // The chosen door overrides the planned reward so the preview is honest.
    world.biomePlan.rooms[nextIndex].reward = { type: door.reward.type, god: door.reward.god };
    this.enterRoom(world.biomeIndex, nextIndex);
  }

  onBossDefeated(boss) {
    const world = this.world;
    recordBossKill(boss.bossId);
    screenFlash('#ffffff', 0.7, 1.1);
    addShake(1);
    this.showBanner(`${boss.title} 격파`, '', '#ffd34a', 3.0, true);
    sfx('victory');
    duckMusic(0.25, 2.5);

    if (world.biomeIndex >= world.plan.length - 1) {
      setTimeout(() => { if (this.state === 'playing') this.winRun(); }, 2200);
      world.room.cleared = true;
      return;
    }
    world.room.cleared = true;
    this.grantReward({ type: 'boon' }, () => {
      const world2 = this.world;
      world2.doors = placeDoors(world2.room, [{
        type: 'boss', label: `${BIOME_THEME[world2.plan[world2.biomeIndex + 1].biome].name}으로`, jump: true,
      }]);
      for (const d of world2.doors) d.open = true;
    });
  }

  // -------------------------------------------------------- boon select

  openBoonSelect(god, after) {
    const world = this.world;
    const p = world.player;
    const luck = p.mods.rarityLuck + world.biomeIndex * 0.12;
    const cards = rollBoonOffer(p.build, this.runRng, { count: 3, luck, god });
    if (cards.length === 0) {
      // Nothing left to offer — pay out gold instead so the room still rewards.
      world.run.gold += 120;
      this.toast('바칠 축복이 남지 않았다 — 금화 120 획득');
      if (after) after();
      return;
    }
    this.boonCards = cards;
    this.boonIndex = 0;
    this.boonT = 0;
    this.afterBoon = after || null;
    this.boonTitle = god ? `${GODS[god].name}의 축복` : '축복을 선택하라';
    this.boonSubtitle = god ? GODS[god].title : '한 번 고르면 그 자리는 채워진다';
    duckMusic(0.3, 3.5);
    sfx('boon', 0);
    this.setState('boonSelect');
  }

  stepBoonSelect(dt) {
    this.boonT += dt;
    const ax = menuAxis('x');
    if (ax) {
      this.boonIndex = clamp(this.boonIndex + ax, 0, this.boonCards.length - 1);
      sfx('uiMove');
    }
    if (this.boonT > 0.25 && (justPressed('confirm') || justPressed('interact'))) {
      const card = this.boonCards[this.boonIndex];
      const p = this.world.player;
      p.build.add(card.def, card.rarity);
      p.refreshMods();
      this.world.run.boons++;
      sfx('boon', ['neptuna', 'volkar', 'glacia', 'echos', 'crown'].indexOf(card.def.god));
      screenFlash(GODS[card.def.god].color, 0.28, 0.5);
      floatText(p.x, p.y - 70, card.def.name, { color: GODS[card.def.god].color, size: 26, life: 2 });
      this.boonCards = [];
      this.setState('playing');
      const after = this.afterBoon;
      this.afterBoon = null;
      if (after) after();
    }
  }

  // ------------------------------------------------------------ playing

  stepPlaying(dt) {
    const world = this.world;
    if (justPressed('pause')) {
      this.pauseIndex = 0;
      this.setState('paused');
      sfx('uiBack');
      return;
    }

    // Hitstop freezes the sim but not the fx layer.
    if (tickHitstop(dt)) return;

    const p = world.player;
    world.prompt = null;

    p.update(dt, world);

    if (p.dead && p.deathTimer > 1.6) { this.loseRun(); return; }

    for (const e of world.enemies) if (!e.dead) e.update(dt, world);

    for (let i = world.projectiles.length - 1; i >= 0; i--) {
      const pr = world.projectiles[i];
      pr.update(dt, world);
      if (pr.remove || pr.dead) world.projectiles.splice(i, 1);
    }
    for (let i = world.hazards.length - 1; i >= 0; i--) {
      world.hazards[i].update(dt, world);
      if (world.hazards[i].dead) world.hazards.splice(i, 1);
    }
    for (let i = world.beams.length - 1; i >= 0; i--) {
      world.beams[i].update(dt, world);
      if (world.beams[i].dead) world.beams.splice(i, 1);
    }
    for (let i = world.pickups.length - 1; i >= 0; i--) {
      world.pickups[i].update(dt, world);
      if (world.pickups[i].remove) world.pickups.splice(i, 1);
    }
    this.updateRings(dt);
    this.updateSpikes(dt);
    for (let i = world.tendrilFx.length - 1; i >= 0; i--) {
      world.tendrilFx[i].t += dt;
      if (world.tendrilFx[i].t >= world.tendrilFx[i].life) world.tendrilFx.splice(i, 1);
    }
    if (world.arenaHazard) this.updateArenaHazard(dt);

    // Reap dead enemies.
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const e = world.enemies[i];
      if (!e.dead) continue;
      if (e.isBoss && world.boss === e) {
        world.boss = null;
        this.onBossDefeated(e);
      }
      world.enemies.splice(i, 1);
    }

    // Wave / clear logic
    if (world.phase === 'combat' && !world.room.cleared) {
      const alive = world.enemies.length;
      if (alive === 0) {
        if (world.waveIndex < world.waves.length - 1) {
          world.waveIndex++;
          world.waveDelay = (world.waveDelay ?? 0.7);
          world.waveDelay -= dt;
          if (world.waveDelay <= 0) {
            spawnWave(world, world.waves[world.waveIndex], tierFor(world.biomeIndex, world.roomIndex));
            world.waveDelay = 0.7;
            this.toast(`다음 파도 ${world.waveIndex + 1}/${world.waves.length}`, 1.6);
          }
        } else {
          this.clearRoom();
        }
      }
    }

    // Shop interaction
    for (const ped of world.pedestals) {
      ped.update(dt, p);
      if (ped.near && !ped.bought) {
        world.prompt = `${ped.item.name} — ${ped.item.desc} · ${ped.item.cost} G`;
        if (justPressed('interact')) {
          if (world.run.gold >= ped.item.cost) {
            world.run.gold -= ped.item.cost;
            ped.bought = true;
            ped.item.apply(world);
            sfx('boon', 1);
            burst(ped.x, ped.y - 40, 18, {
              speed: [80, 260], life: [0.3, 0.7], r0: [2, 5], r1: 0,
              color: ped.item.color, kind: 'spark', spread: TAU, drag: 4, glow: true,
            });
            if (world.pendingBoon) { world.pendingBoon = false; this.openBoonSelect(null, null); return; }
          } else {
            sfx('uiBack');
            this.toast('금화가 부족하다');
          }
        }
      }
    }

    // Doors
    for (const d of world.doors) {
      d.update(dt, p);
      if (d.near) {
        world.prompt = d.reward.god
          ? `${GODS[d.reward.god].name}의 축복으로`
          : `${REWARD_TYPES[d.reward.type].name} 방으로`;
        if (justPressed('interact')) {
          sfx('doorOpen');
          screenFlash('#ffffff', 0.35, 0.45);
          this.takeDoor(d);
          return;
        }
      }
    }

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const world = this.world;
    const p = world.player;
    const room = world.room;
    // Lead the camera slightly toward velocity for readability.
    const leadX = clamp(p.vx * 0.16, -90, 90);
    const leadY = clamp(p.vy * 0.16, -70, 70);
    let tx = p.x + leadX;
    let ty = p.y + leadY - 20;

    let wantZoom = ZOOM;
    const boss = world.boss;
    if (boss && !boss.dead) {
      // Frame both combatants: centre on the midpoint and back off just enough
      // that the boss can never leave the screen mid-pattern.
      tx = (p.x + boss.x) / 2;
      ty = (p.y + boss.y) / 2 - 10;
      const needW = Math.abs(p.x - boss.x) + boss.r * 2 + 300;
      const needH = Math.abs(p.y - boss.y) + boss.r * 2 + 300;
      wantZoom = clamp(Math.min(W / needW, H / needH), 0.82, BOSS_ZOOM);
    }
    world.zoom = damp(world.zoom ?? wantZoom, wantZoom, 3.5, dt);
    const halfW = W / (2 * world.zoom), halfH = H / (2 * world.zoom);
    const padX = 40, padY = 40;
    const minX = room.left - padX + halfW, maxX = room.right + padX - halfW;
    const minY = room.top - padY + halfH, maxY = room.bottom + padY - halfH;
    tx = minX > maxX ? room.cx : clamp(tx, minX, maxX);
    ty = minY > maxY ? room.cy : clamp(ty, minY, maxY);
    world.camera.x = damp(world.camera.x, tx, 7, dt);
    world.camera.y = damp(world.camera.y, ty, 7, dt);
  }

  updateRings(dt) {
    const world = this.world;
    const p = world.player;
    for (let i = world.rings.length - 1; i >= 0; i--) {
      const r = world.rings[i];
      r.t += dt;
      if (r.t >= r.life) { world.rings.splice(i, 1); continue; }
      const u = r.t / r.life;
      const rad = lerp(r.r0, r.r, easeOutCubic(u));
      if (!r.hit && p && !p.dead) {
        const d = dist(r.x, r.y, p.x, p.y);
        if (Math.abs(d - rad) < r.width / 2 + p.r * 0.5) {
          r.hit = true;
          const a = Math.atan2(p.y - r.y, p.x - r.x);
          p.takeDamage(world, r.damage, { dirX: Math.cos(a), dirY: Math.sin(a) });
        }
      }
    }
  }

  updateSpikes(dt) {
    const world = this.world;
    const p = world.player;
    for (let i = world.spikes.length - 1; i >= 0; i--) {
      const s = world.spikes[i];
      s.t += dt;
      if (s.t >= s.life) { world.spikes.splice(i, 1); continue; }
      if (s.t > 0.28 && !s.hit && p && !p.dead) {
        if (dist(s.x, s.y, p.x, p.y) < s.r + p.r * 0.5) {
          s.hit = true;
          const a = Math.atan2(p.y - s.y, p.x - s.x);
          p.takeDamage(world, s.damage, { dirX: Math.cos(a), dirY: Math.sin(a) });
        }
      }
      if (s.t > 0.24 && s.t - dt <= 0.24) {
        burst(s.x, s.y, 6, {
          speed: [60, 220], life: [0.2, 0.5], r0: [2, 4], r1: 0,
          color: s.color, kind: 'shard', spread: TAU, dir: -Math.PI / 2, drag: 3, grav: 300,
        });
      }
    }
  }

  updateArenaHazard(dt) {
    const world = this.world;
    const p = world.player;
    if (!p || p.dead) return;
    const room = world.room;
    const inner = room.clampedPoint(p.x, p.y, 0);
    // Danger band along the outer 110px of the arena.
    const edgeDist = Math.min(
      Math.abs(p.x - room.left), Math.abs(room.right - p.x),
      Math.abs(p.y - room.top), Math.abs(room.bottom - p.y)
    );
    world.arenaTick = (world.arenaTick || 0) - dt;
    if (edgeDist < 110) {
      if (world.arenaTick <= 0) {
        world.arenaTick = 0.5;
        p.takeDamage(world, 12, { dirX: 0, dirY: 0 });
      }
      if (rng.next() < 0.6) {
        emit({
          x: p.x + rng.range(-20, 20), y: p.y + rng.range(-20, 20),
          vx: 0, vy: rng.range(-60, -20), life: 0.5, t: 0,
          r0: 3, r1: 0, color: '#ff5a6a', kind: 'dot', drag: 2, glow: true,
        });
      }
    }
  }

  // --------------------------------------------------------------- pause

  stepPaused(dt) {
    const ay = menuAxis('y');
    if (ay) {
      this.pauseIndex = (this.pauseIndex + ay + this.pauseItems.length) % this.pauseItems.length;
      sfx('uiMove');
    }
    const it = this.pauseItems[this.pauseIndex];
    const ax = menuAxis('x');
    if (ax && (it.id === 'sfx' || it.id === 'music')) {
      const v = getVolumes();
      if (it.id === 'sfx') {
        const nv = clamp(v.sfx + ax * 0.1, 0, 1);
        setSfxVolume(nv); setSetting('sfx', nv);
      } else {
        const nv = clamp(v.music + ax * 0.1, 0, 1);
        setMusicVolume(nv); setSetting('music', nv);
      }
      sfx('uiMove');
    }
    if (justPressed('pause')) { this.setState('playing'); sfx('uiBack'); return; }
    if (justPressed('confirm') || justPressed('interact')) {
      sfx('uiSelect');
      if (it.id === 'resume') this.setState('playing');
      else if (it.id === 'controls') { this.returnTo = 'paused'; this.setState('controls'); }
      else if (it.id === 'quit') this.loseRun(true);
    }
  }

  // ------------------------------------------------------------- run end

  buildSummary(won) {
    const world = this.world;
    const secs = (performance.now() - world.run.startTime) / 1000;
    const mm = Math.floor(secs / 60), ss = Math.floor(secs % 60);
    const names = ['산호 묘지', '침몰 성채', '심연 옥좌'];
    return {
      won,
      kills: world.run.kills,
      gold: world.run.gold,
      boons: world.run.boons,
      shards: world.run.shards,
      time: `${mm}:${String(ss).padStart(2, '0')}`,
      timeSec: secs,
      place: `${names[world.biomeIndex] || '심연'} ${world.roomIndex + 1}구역`,
      boonList: world.player.build.summary(),
      biomeIndex: world.biomeIndex,
      roomIndex: world.roomIndex,
    };
  }

  loseRun(quit = false) {
    const world = this.world;
    if (this.state === 'runEnd') return;
    const bonus = Math.round(3 + world.biomeIndex * 4 + world.roomIndex);
    world.run.shards += Math.max(0, Math.round(bonus * world.player.mods.shardMult));
    this.summary = this.buildSummary(false);
    addShards(this.summary.shards);
    recordRunEnd({
      won: false, biomeIndex: world.biomeIndex, roomIndex: world.roomIndex,
      kills: world.run.kills, shards: this.summary.shards, boons: world.run.boons,
      timeSec: this.summary.timeSec,
    });
    stopMusic();
    if (!quit) sfx('defeat');
    this.setState('runEnd');
  }

  winRun() {
    const world = this.world;
    if (this.state === 'runEnd') return;
    world.run.shards += Math.round(40 * world.player.mods.shardMult);
    this.summary = this.buildSummary(true);
    addShards(this.summary.shards);
    recordRunEnd({
      won: true, biomeIndex: world.biomeIndex, roomIndex: world.roomIndex,
      kills: world.run.kills, shards: this.summary.shards, boons: world.run.boons,
      timeSec: this.summary.timeSec,
    });
    stopMusic();
    sfx('victory');
    screenFlash('#ffffff', 0.9, 1.6);
    this.setState('runEnd');
  }

  stepRunEnd(dt) {
    if (this.stateT > 0.9 && (justPressed('confirm') || justPressed('interact'))) {
      sfx('uiSelect');
      this.world = null;
      this.sanctumIndex = 0;
      this.setState('sanctum');
      playMusic('sanctum');
    }
  }

  // -------------------------------------------------------------- render

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'title') {
      UI.drawTitle(ctx, this, this.time);
      this.drawGrain(ctx);
      return;
    }
    if (this.state === 'sanctum') {
      UI.drawSanctum(ctx, this, this.time);
      if (this.hintT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(this.hintT, 0, 1);
        UI.text(ctx, this.hint, W / 2, H - 76, { size: 17, align: 'center', color: '#8ce8ff' });
        ctx.restore();
      }
      this.drawGrain(ctx);
      return;
    }
    if (this.state === 'controls') {
      if (this.returnTo === 'paused' && this.world) this.renderWorld(ctx);
      else UI.drawTitle(ctx, this, this.time);
      UI.drawControls(ctx, this.time);
      this.drawGrain(ctx);
      return;
    }

    if (this.world) this.renderWorld(ctx);

    if (this.state === 'boonSelect') {
      UI.drawBoonSelect(ctx, this.boonCards, this.boonIndex, this.boonT, {
        title: this.boonTitle, subtitle: this.boonSubtitle,
      });
    } else if (this.state === 'paused') {
      UI.drawPause(ctx, this, this.time);
    } else if (this.state === 'runEnd') {
      UI.drawRunEnd(ctx, this, this.stateT, this.summary ? this.summary.won : false);
    }

    this.drawGrain(ctx);
  }

  renderWorld(ctx) {
    const world = this.world;
    if (!world || !world.room) return;
    const cam = world.camera;
    const shake = getShake();
    const room = world.room;

    this.drawBackdrop(ctx, cam, room);

    ctx.save();
    ctx.translate(W / 2 + shake.x, H / 2 + shake.y);
    ctx.rotate(shake.rot);
    ctx.scale(world.zoom, world.zoom);
    ctx.translate(-cam.x, -cam.y);

    room.drawDecor(ctx, this.time);
    room.drawFloor(ctx);

    // Floor-level layers
    drawDecals(ctx);
    for (const h of world.hazards) h.draw(ctx);
    this.drawArenaHazard(ctx, room);
    this.drawTelegraphs(ctx, world);
    this.drawRings(ctx, world);
    this.drawSpikes(ctx, world);
    for (const t of world.tendrilFx) this.drawTendrilFx(ctx, t);

    room.drawEdge(ctx, this.time);
    for (const d of world.doors) d.draw(ctx);
    for (const ped of world.pedestals) ped.draw(ctx, world.run.gold);

    // Depth-sorted actors
    const actors = [];
    for (const e of world.enemies) if (!e.dead) actors.push(e);
    for (const pk of world.pickups) actors.push(pk);
    if (world.player) actors.push(world.player);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a === world.player) a.draw(ctx, world);
      else if (a instanceof Pickup) a.draw(ctx);
      else a.drawBase(ctx, world);
    }

    for (const pr of world.projectiles) pr.draw(ctx);
    for (const b of world.beams) b.draw(ctx);

    drawParticles(ctx, false);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawParticles(ctx, true);
    ctx.restore();

    drawShockwaves(ctx);
    drawChainArcs(ctx, world.arcs, this.dtReal);
    drawDamageNumbers(ctx);
    drawFloaters(ctx);

    ctx.restore();

    // Screen-space overlays
    this.drawCaustics(ctx, cam);
    ctx.drawImage(vignette(W, H, 0.9), 0, 0);
    drawFlashes(ctx, W, H);

    if (world.boss && world.boss.aiState === 'intro') {
      UI.drawBossIntro(ctx, world.boss, world.boss.introT, world.boss.introDur);
    }
    UI.drawRoomBanner(ctx, this.banner);
    if (this.state === 'playing' || this.state === 'boonSelect' || this.state === 'paused') {
      UI.drawHud(ctx, this);
    }
    // After the HUD: an edge arrow tucked under the boss bar helps nobody.
    this.drawOffscreenMarkers(ctx, world);
  }

  drawBackdrop(ctx, cam, room) {
    const th = room.theme;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.fog);
    g.addColorStop(0.5, '#050a13');
    g.addColorStop(1, '#02040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Distant light shafts (parallax 0.25)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 340 - cam.x * 0.22) % (W + 700) + W + 700) % (W + 700) - 350;
      const gg = ctx.createLinearGradient(bx, 0, bx + 150, H);
      gg.addColorStop(0, rgba(th.light, 0.075));
      gg.addColorStop(1, rgba(th.light, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(bx - 70, -10); ctx.lineTo(bx + 70, -10);
      ctx.lineTo(bx + 230, H + 10); ctx.lineTo(bx + 40, H + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Marine snow — three parallax layers.
    ctx.save();
    for (const s of this.snow) {
      s.y += s.vy * this.dtReal;
      s.x += (s.vx + Math.sin(this.time * 0.6 + s.ph) * 8) * this.dtReal;
      const px = ((s.x - cam.x * s.z) % 1400 + 1400) % 1400 - 100;
      const py = ((s.y - cam.y * s.z) % 1000 + 1000) % 1000 - 100;
      ctx.globalAlpha = 0.1 + s.z * 0.3;
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.arc(px, py, s.r * s.z, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCaustics(ctx, cam) {
    const f = causticFrame(Math.floor(this.time * 11));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.075;
    const ox = -(cam.x * 0.1) % 512;
    const oy = -(cam.y * 0.1) % 288;
    for (let x = -1; x <= 3; x++) {
      for (let y = -1; y <= 3; y++) {
        ctx.drawImage(f, ox + x * 512, oy + y * 288, 512, 288);
      }
    }
    ctx.restore();
  }

  drawGrain(ctx) {
    const t = grainTexture();
    ctx.save();
    ctx.globalAlpha = 0.045;
    const ox = (this.frame * 37) % 180;
    const oy = (this.frame * 61) % 180;
    for (let x = -1; x < W / 180 + 1; x++) {
      for (let y = -1; y < H / 180 + 1; y++) {
        ctx.drawImage(t, x * 180 - ox, y * 180 - oy);
      }
    }
    ctx.restore();
  }

  /**
   * Edge arrows for anything the player needs but cannot see. The camera is
   * zoomed in enough that a door or a last straggler is regularly off-frame.
   */
  drawOffscreenMarkers(ctx, world) {
    const cam = world.camera, z = world.zoom;
    const targets = [];
    for (const d of world.doors) {
      if (d.open) {
        const info = REWARD_TYPES[d.reward.type];
        const col = d.reward.god ? GODS[d.reward.god].color : info.color;
        targets.push({ x: d.x, y: d.y - 60, color: col, glyph: d.reward.god ? GODS[d.reward.god].glyph : info.glyph });
      }
    }
    for (const p of world.pedestals) {
      if (!p.bought) targets.push({ x: p.x, y: p.y - 40, color: p.item.color, glyph: p.item.glyph });
    }
    const live = world.enemies.filter((e) => !e.dead && !e.untargetable);
    if (live.length > 0 && live.length <= 3) {
      for (const e of live) targets.push({ x: e.x, y: e.y, color: e.tint, glyph: null, faint: true });
    }
    if (targets.length === 0) return;

    // Two different insets on purpose: `vis` decides whether the target is
    // actually off-screen, `m` is where the arrow sits so it clears the HP panel
    // and the boss banner. Using one value marks things the player can plainly see.
    const vis = 24;
    const m = 96;
    for (const t of targets) {
      const sx = (t.x - cam.x) * z + W / 2;
      const sy = (t.y - cam.y) * z + H / 2;
      if (sx > vis && sx < W - vis && sy > vis && sy < H - vis) continue;
      const dx = sx - W / 2, dy = sy - H / 2;
      const ang = Math.atan2(dy, dx);
      // Project onto the inset viewport rectangle.
      const hw = W / 2 - m, hh = H / 2 - m;
      const s = Math.min(hw / Math.abs(Math.cos(ang) || 1e-6), hh / Math.abs(Math.sin(ang) || 1e-6));
      const px = W / 2 + Math.cos(ang) * s;
      const py = H / 2 + Math.sin(ang) * s;
      const pulse = 1 + Math.sin(this.time * 5) * 0.08;

      ctx.save();
      ctx.globalAlpha = t.faint ? 0.5 : 0.92;
      ctx.translate(px, py);
      ctx.save();
      ctx.rotate(ang);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = rgba(t.color, 0.95);
      ctx.strokeStyle = 'rgba(3,7,13,0.9)';
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(15, 0); ctx.lineTo(-6, 10); ctx.lineTo(-1, 0); ctx.lineTo(-6, -10);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      if (t.glyph) {
        const gx = -Math.cos(ang) * 26, gy = -Math.sin(ang) * 26;
        ctx.fillStyle = 'rgba(4,9,16,0.85)';
        ctx.beginPath(); ctx.arc(gx, gy, 17, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(t.color, 0.7);
        ctx.lineWidth = 2;
        ctx.stroke();
        drawGlyph(ctx, t.glyph, gx, gy, 20, t.color, 2.2);
      }
      ctx.restore();
    }
  }

  drawTelegraphs(ctx, world) {
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (e.tel) drawTelegraph(ctx, e.tel);
      if (e.tels) for (const t of e.tels) drawTelegraph(ctx, t);
    }
  }

  drawRings(ctx, world) {
    for (const r of world.rings) {
      const u = r.t / r.life;
      const rad = lerp(r.r0, r.r, easeOutCubic(u));
      ctx.save();
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.strokeStyle = rgba(r.color, 0.95);
      ctx.lineWidth = r.width * (1 - u * 0.5);
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rad, rad * 0.72, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = (1 - u) * 0.28;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r.width * 0.3;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSpikes(ctx, world) {
    for (const s of world.spikes) {
      if (s.t < 0) continue;
      const grow = clamp(s.t / 0.24, 0, 1);
      const fade = clamp((s.life - s.t) / 0.35, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(s.x, s.y);
      if (grow < 1) {
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = rgba(s.color, 0.9);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, s.r * (1.4 - grow * 0.4), s.r * 0.5, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = fade;
      }
      const h = 62 * easeOutQuint(grow);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(-s.r * 0.55, 6);
      ctx.lineTo(0, -h);
      ctx.lineTo(s.r * 0.55, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5c1f31';
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(-s.r * 0.2, 2);
      ctx.lineTo(0, -h * 0.9);
      ctx.lineTo(s.r * 0.1, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawTendrilFx(ctx, t) {
    const u = t.t / t.life;
    const h = 130 * easeOutQuint(clamp(u * 2.4, 0, 1)) * (1 - Math.max(0, (u - 0.5) / 0.5));
    ctx.save();
    ctx.globalAlpha = 1 - u * u;
    ctx.translate(t.x, t.y);
    ctx.fillStyle = '#6d3f9e';
    ctx.beginPath();
    ctx.moveTo(-24, 8);
    ctx.quadraticCurveTo(-10, -h * 0.6, 0, -h);
    ctx.quadraticCurveTo(10, -h * 0.6, 24, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2c1746';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  drawArenaHazard(ctx, room) {
    if (!this.world.arenaHazard) return;
    ctx.save();
    const pulse = 0.35 + Math.sin(this.time * 4) * 0.12;
    ctx.globalAlpha = pulse;
    room.arenaPath(ctx, 0);
    ctx.strokeStyle = '#ff5a6a';
    ctx.lineWidth = 200;
    ctx.save();
    room.arenaPath(ctx, 0);
    ctx.clip();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ff8a9a';
    ctx.lineWidth = 3;
    room.arenaPath(ctx, 110);
    ctx.setLineDash([18, 14]);
    ctx.lineDashOffset = -this.time * 60;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function volBar(v) {
  const n = Math.round(v * 10);
  return '▮'.repeat(n) + '▯'.repeat(10 - n);
}
