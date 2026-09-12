// 매치 런타임: 고정 60틱 시뮬 + 매 프레임 렌더. 입력원(로컬/네트워크)은 MatchSource 가 감싼다.
import { DT, MAPS, PICKUP_RANGE, type Input, type Player, type World, type WorldEvent, type RankEntry, type RosterEntry, type MoveId, type PState, type AccessoryId } from '@amp/shared';
import { Renderer } from './renderer.ts';
import { Hud } from './hud.ts';
import { InputController } from './input.ts';
import { SLOT_COLORS } from './rig.ts';
import { targetPose } from './poses.ts';
import { audio } from './audio.ts';
import { botInput, newBotMemory, STYLES, MOVES, ACCESSORIES, allowedAccessory, type BotMemory, type Item } from '@amp/shared';
import { STRIKE_HOLD } from './poses.ts';
import { toggleFullscreen, isFullscreen } from '../ui/fullscreen.ts';

/** E2E·디버그용 창 훅: 월드 조회와 오토파일럿(봇 AI 가 내 캐릭터를 조종) */
interface DebugHook {
  source: MatchSource; lastInput: Input | null; autopilot: boolean; spectating: () => number;
  /** 카메라 위치·요 — 운영에서 「내려다보는 고정 요」를 수치로 확인한다 */
  camera: () => { x: number; y: number; z: number; yaw: number };
  /** 리그의 현재(보간된) 포즈 — 타격 때 팔·다리가 뻗었는지 */
  pose: (id: number) => { nearArm: [number, number]; farArm: [number, number]; nearLeg: [number, number]; reach: number; lean: number } | null;
}
declare global { interface Window { __amp?: DebugHook } }

export interface RenderPlayer {
  id: number; x: number; y: number; z: number; yaw: number; state: PState; t: number; move: MoveId | null;
  grounded: boolean; invuln: number; speed: number; acc: AccessoryId; holding: number;
}

export interface MatchSource {
  readonly myId: number;
  readonly world: World;
  readonly roster: RosterEntry[];
  readonly online: boolean;
  tick(input: Input): void;
  renderPlayers(now: number): RenderPlayer[];
  drainEvents(): WorldEvent[];
  ended: { ranking: RankEntry[]; score: [number, number] } | null;
  rtt: number | null;
  /** HUD 에 붙는 짧은 상태 (온라인: 방장/게스트, 입력 지연) */
  info?: string | null;
  /** 관전: 내 캐릭터가 없다 — 카메라는 남을 따라간다 (Tab 으로 전환) */
  readonly spectator?: boolean;
  dispose(): void;
}

export interface MatchOptions {
  onExit: () => void;           // 나가기 (로컬: 타이틀, 온라인: 대기실·로비 복귀)
  onAgain?: () => void;         // 로컬: 다시
  exitLabel: string;
  /** 판이 끝나면 내 결과로 순위표 제출 — 돌려준 문구를 결과 화면 아래 한 줄로 보여준다 */
  onResult?: (me: RankEntry, ranking: RankEntry[]) => Promise<string | null>;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

export class Match {
  readonly el: HTMLElement;
  private renderer: Renderer;
  private hud: Hud;
  private input: InputController;
  private seq = 0;
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  private running = true;
  private comboN = 0;
  private comboAt = 0;
  private resultShown = false;
  private prevGrounded = new Map<number, boolean>();
  private prevState = new Map<number, PState>();
  private nameOf = new Map<number, string>();
  /** 관전 대상 플레이어 id (관전이 아니면 -1) */
  private followId = -1;
  private stats = { frames: 0, slow: 0, t0: performance.now(), worst: 0 };
  private source: MatchSource;
  private opts: MatchOptions;
  private hitstop = new Map<number, number>(); // 리그별 포즈 정지 만료 시각
  private shake = 0;
  private lastCountdown = -1;
  private counterUntil = 0; // 가드로 막은 뒤 반격 창 안내가 보이는 시각
  private debug: DebugHook;
  private autoMem: BotMemory | null = null;
  private onKey = (e: KeyboardEvent): void => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'KeyM') { const m = audio.toggleMute(); this.hud.pushFeed(`<span class="muted">효과음 ${m ? '끔' : '켬'} (M)</span>`); }
    if (e.code === 'Tab' && this.followId >= 0) { e.preventDefault(); this.followId = this.nextFollow(this.followId, e.shiftKey ? -1 : 1); }
  };

  /** 관전 대상: 살아 있는 플레이어 중 다음/이전 (없으면 아무나) */
  private nextFollow(from: number, dir: 1 | -1): number {
    const ids = this.source.world.players.filter((p): p is Player => !!p).map((p) => p.id);
    if (!ids.length) return -1;
    const alive = ids.filter((id) => this.source.world.players[id]!.alive);
    const pool = alive.length ? alive : ids;
    const i = pool.indexOf(from);
    return pool[(i < 0 ? (dir > 0 ? 0 : pool.length - 1) : (i + dir + pool.length) % pool.length)];
  }

  constructor(container: HTMLElement, source: MatchSource, opts: MatchOptions) {
    this.source = source;
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'match';
    container.appendChild(this.el);
    this.renderer = new Renderer(this.el);
    this.hud = new Hud(this.el);
    this.input = new InputController(this.el);
    this.renderer.buildMap(source.world.map);
    for (const r of source.roster) {
      this.nameOf.set(r.id, r.name);
      this.renderer.ensureRig(r.id, SLOT_COLORS[r.id % 8], r.acc);
    }
    this.hud.setRoster(source.roster, source.myId, source.world.teams);
    const me = source.world.players[source.myId];
    if (me) this.renderer.resetCamera(me.yaw);
    this.debug = {
      source, lastInput: null, autopilot: new URLSearchParams(location.search).get('autopilot') === '1', spectating: () => this.followId,
      camera: () => { const c = this.renderer.camera.position; return { x: c.x, y: c.y, z: c.z, yaw: this.renderer.camYaw }; },
      pose: (id) => { const r = this.renderer.rigs.get(id); if (!r) return null; const p = r.currentPose; return { nearArm: [...p.nearArm], farArm: [...p.farArm], nearLeg: [...p.nearLeg], reach: p.reach, lean: p.lean }; },
    };
    window.__amp = this.debug;
    audio.unlock();
    window.addEventListener('keydown', this.onKey);
    const fs = document.createElement('button');
    fs.className = 'btn ghost fsbtn';
    fs.textContent = isFullscreen() ? '⤢ 전체화면 해제' : '⤢ 전체화면';
    fs.onclick = () => { void toggleFullscreen().then(() => { fs.textContent = isFullscreen() ? '⤢ 전체화면 해제' : '⤢ 전체화면'; }); };
    document.addEventListener('fullscreenchange', () => { fs.textContent = isFullscreen() ? '⤢ 전체화면 해제' : '⤢ 전체화면'; });
    this.el.appendChild(fs);
    if (this.input.hasTouch) this.el.classList.add('touch'); // 세로 기기는 orient.ts 가 뿌리를 돌려 가로로 만든다
    if (source.spectator) {
      // 관전: 사람 먼저, 없으면 첫 플레이어. 체력판·기술판은 감춘다
      this.el.classList.add('spectator');
      const human = source.roster.find((r) => !r.bot);
      this.followId = human ? human.id : this.nextFollow(-1, 1);
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 5) {
      this.seq++;
      let input = this.input.sample(this.seq, this.renderer.camYaw);
      if (this.debug.autopilot) {
        const me = this.source.world.players[this.source.myId];
        if (me) { if (!this.autoMem) this.autoMem = newBotMemory(this.source.world.rng); input = { ...botInput(this.source.world, me, this.autoMem), seq: this.seq }; }
      }
      this.debug.lastInput = input;
      this.source.tick(input);
      this.acc -= DT;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    this.render(now, dt);
    this.stats.frames++;
    if (dt > 0.02) this.stats.slow++;
    if (dt > this.stats.worst) this.stats.worst = dt;
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(now: number, dt: number): void {
    const src = this.source;
    const world = src.world;
    const players = src.renderPlayers(now);
    const k = 1 - Math.exp(-22 * dt);
    let meView: RenderPlayer | null = null;
    for (const rp of players) {
      const rig = this.renderer.ensureRig(rp.id, SLOT_COLORS[rp.id % 8], rp.acc);
      rig.setLook(STYLES[world.players[rp.id]?.style ?? 'fighter'].look);
      rig.root.position.set(rp.x, rp.y, rp.z);
      rig.root.rotation.y = rp.yaw;
      const attackLike = rp.state === 'attack' || rp.state === 'special' || rp.state === 'dashAttack' || rp.state === 'jumpAttack';
      const frozen = (this.hitstop.get(rp.id) ?? 0) > now;
      // 타격 구간은 보간 없이 그 포즈를 그대로 박는다 — 부드럽게 섞으면 팔·다리가 다 뻗기 전에 돌아와 동작이 뭉개진다
      const mv = attackLike && rp.move ? MOVES[rp.move] : null;
      const striking = !!mv && rp.t >= mv.startup && rp.t < mv.startup + mv.active + Math.round(mv.recovery * STRIKE_HOLD);
      if (!frozen) rig.setPose(targetPose(rp.state, rp.t, rp.move, rp.speed, rp.grounded, rp.holding >= 0), striking ? 1 : attackLike ? Math.min(1, k * 3) : k);
      rig.root.visible = rp.state !== 'dead' || rp.t < 60;
      rig.setOpacity(rp.invuln > 0 ? (Math.floor(now / 90) % 2 ? 0.45 : 0.85) : 1);
      // 착지·대시 먼지
      const wasG = this.prevGrounded.get(rp.id);
      if (wasG === false && rp.grounded) { this.renderer.spawnDust(rp.x, rp.y, rp.z); if (rp.id === src.myId) audio.play('land'); }
      const ps = this.prevState.get(rp.id);
      if (ps !== 'run' && rp.state === 'run') { this.renderer.spawnDust(rp.x, rp.y, rp.z); if (rp.id === src.myId) audio.play('whoosh'); }
      if (rp.id === src.myId && ps !== 'jump' && rp.state === 'jump') audio.play('jump');
      if (rp.id === src.myId && ps !== rp.state && (rp.state === 'attack' || rp.state === 'special' || rp.state === 'dashAttack' || rp.state === 'jumpAttack')) audio.play('whoosh');
      this.prevGrounded.set(rp.id, rp.grounded);
      this.prevState.set(rp.id, rp.state);
      if (rp.id === (this.followId >= 0 ? this.followId : src.myId)) meView = rp;
    }
    for (const ev of src.drainEvents()) this.onEvent(ev);
    this.renderer.updateProjectiles(world.projectiles);
    const holders = new Map<number, { x: number; y: number; z: number }>();
    for (const rp of players) if (rp.holding >= 0) holders.set(rp.id, { x: rp.x, y: rp.y, z: rp.z });
    this.renderer.updateItems(world.items, holders, now);
    this.renderer.updateEffects(dt);
    const turn = this.input.cameraTurn();
    if (meView) {
      this.renderer.updateCamera(meView.x, meView.y, meView.z, turn, dt);
      this.renderer.setViewer(meView.x, meView.y, meView.z, dt);
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 2.2);
        const s = this.shake * 0.35;
        this.renderer.camera.position.x += (Math.random() - 0.5) * s;
        this.renderer.camera.position.y += (Math.random() - 0.5) * s;
      }
    }
    // 카운트다운 소리
    if (world.phase === 'countdown') {
      const left = Math.ceil((180 - world.phaseT) / 60);
      if (left !== this.lastCountdown && left > 0 && left <= 3) { this.lastCountdown = left; audio.play('tick'); }
    } else if (this.lastCountdown !== -2 && world.phase === 'play') { this.lastCountdown = -2; audio.play('go'); }
    const plates = players.map((rp) => { const s = this.renderer.project(rp.x, rp.y + 1.9, rp.z); return { id: rp.id, x: s.x, y: s.y, visible: s.visible }; });
    if (this.followId >= 0) {
      const fp = world.players[this.followId];
      if (!fp || !fp.alive) this.followId = this.nextFollow(this.followId, 1); // 대상이 죽거나 나가면 다음 사람
      this.hud.setPrompt(`관전 · ${this.nameOf.get(this.followId) ?? ''}${this.input.hasTouch ? '' : ' · Tab 전환'}`);
    } else if (meView) {
      const me = world.players[src.myId];
      let near: Item | null = null;
      if (me && me.holding < 0) for (const it of world.items) {
        if (it.kind === 'heart' || it.heldBy >= 0 || it.airborne || it.hp <= 0 || Math.abs(it.y - me.pos.y) > 1.5 || Math.hypot(it.x - me.pos.x, it.z - me.pos.z) >= PICKUP_RANGE) continue;
        if (it.kind === 'acc' && allowedAccessory(me.style, it.acc) !== it.acc) continue; // 내 직업이 못 드는 것은 안내하지 않는다
        near = it; break;
      }
      const counter = now < this.counterUntil ? (this.input.hasTouch ? '반격! 약공' : 'Z 반격!') : null;
      const pickKey = this.input.hasTouch ? '줍기 버튼' : 'F';
      const pickText = near ? (near.kind === 'acc' ? `${pickKey} 장착 · ${ACCESSORIES[near.acc].name}` : (this.input.hasTouch ? '줍기 버튼으로 줍는다' : 'F 줍기')) : null;
      this.hud.setPrompt(counter ?? (pickText ?? (me && me.holding >= 0 ? (this.input.hasTouch ? '약공 버튼으로 던진다' : 'Z 던지기 · F 내려놓기') : null)));
    }
    this.hud.update({
      me: world.players[src.myId], players: world.players.filter((p): p is Player => !!p), myId: src.myId,
      phase: world.phase, phaseT: world.phaseT, timeLeft: world.timeLeft, score: world.score, teams: world.teams, plates, rtt: src.rtt,
      modeId: world.mode.id, mapName: world.map.name, info: src.info ?? null,
    });
    this.renderer.render();
    if (src.ended && !this.resultShown) this.showResult(src.ended);
  }

  private onEvent(ev: WorldEvent): void {
    const src = this.source;
    const name = (id: number) => esc(this.nameOf.get(id) ?? '?');
    switch (ev.t) {
      case 'hit': {
        const mine = ev.a === src.myId || ev.v === src.myId;
        if (ev.kind === 'guard') { this.renderer.spawnHit(ev.x, ev.y, ev.z, 'guard'); if (mine) { audio.play('guard'); const s = this.renderer.project(ev.x, ev.y + 0.4, ev.z); this.hud.showDamage(s.x, s.y, '가드', 'guard'); } if (ev.v === src.myId) this.counterUntil = performance.now() + 250; break; }
        if (ev.kind === 'guardBreak') { this.renderer.spawnHit(ev.x, ev.y, ev.z, 'launch'); audio.play('guardBreak'); const s = this.renderer.project(ev.x, ev.y + 0.4, ev.z); this.hud.showDamage(s.x, s.y, '가드 크러시!', 'guard'); break; }
        this.renderer.spawnHit(ev.x, ev.y, ev.z, ev.launch ? 'launch' : 'hit');
        audio.play(ev.launch ? 'heavy' : 'hit');
        if (mine) { const until = performance.now() + (ev.launch ? 90 : 50); this.hitstop.set(ev.a, until); this.hitstop.set(ev.v, until); if (ev.v === src.myId) this.shake = Math.max(this.shake, ev.launch ? 0.5 : 0.25); }
        const s = this.renderer.project(ev.x, ev.y + 0.5, ev.z);
        if (s.visible) this.hud.showDamage(s.x, s.y, String(ev.dmg), 'hit');
        if (ev.a === src.myId) {
          const now = performance.now();
          this.comboN = now - this.comboAt < 1200 ? this.comboN + 1 : 1;
          this.comboAt = now;
          if (this.comboN >= 2) this.hud.showCombo(this.comboN);
        }
        break;
      }
      case 'ko': {
        const v = src.world.players[ev.v];
        if (v) this.renderer.spawnHit(v.pos.x, v.pos.y + 0.9, v.pos.z, 'ko');
        audio.play('ko');
        if (ev.v === src.myId) this.shake = 1;
        if (ev.cause === 'fall') this.hud.pushFeed(`<b>${name(ev.v)}</b> <span class="muted">낙사${ev.a >= 0 ? ` (<b>${name(ev.a)}</b>)` : ''}</span>`);
        else {
          const friendly = src.world.teams && src.world.players[ev.a]?.team === v?.team;
          this.hud.pushFeed(`<b>${name(ev.a)}</b> <span class="muted">이</span> <b style="color:var(--ink)">${name(ev.v)}</b> <span class="muted">을 KO${friendly ? ' (아군 · KO −1)' : ''}</span>`);
        }
        if (ev.v === src.myId) this.hud.showCenter('KO', ev.a >= 0 ? `${this.nameOf.get(ev.a) ?? '?'} 에게 당했다` : '낙사', true);
        else if (ev.a === src.myId) { const s = this.renderer.project(v?.pos.x ?? 0, (v?.pos.y ?? 0) + 1.6, v?.pos.z ?? 0); this.hud.showDamage(s.x, s.y, 'KO!', 'ko'); }
        break;
      }
      case 'respawn':
        if (ev.id === src.myId) { this.hud.hideCenter(); const me = src.world.players[src.myId]; if (me) this.renderer.resetCamera(me.yaw); }
        break;
      case 'shot': this.renderer.spawnDust(ev.x, ev.y, ev.z); if (ev.id === src.myId) audio.play('shot'); break;
      case 'phase': if (ev.phase === 'play') this.hud.hideCenter(); break;
      case 'explode': this.renderer.spawnHit(ev.x, ev.y, ev.z, 'blast'); this.renderer.spawnDust(ev.x, ev.y - 0.4, ev.z); audio.play('explode'); this.shake = Math.max(this.shake, 0.8); break;
      case 'crateBreak': this.renderer.spawnDust(ev.x, ev.y - 0.3, ev.z); this.renderer.spawnHit(ev.x, ev.y, ev.z, 'hit'); audio.play('hit'); break;
      case 'heal': if (ev.id === src.myId) { audio.play('heal'); const me = src.world.players[src.myId]; if (me) { const s = this.renderer.project(me.pos.x, me.pos.y + 1.8, me.pos.z); this.hud.showDamage(s.x, s.y, `+${ev.amount}`, 'guard'); } } break;
      case 'pickup': if (ev.id === src.myId) audio.play('pickup'); break;
      case 'accDrop': this.renderer.spawnDust(ev.x, ev.y - 0.4, ev.z); this.hud.pushFeed(`<b>${name(ev.id)}</b> <span class="muted">의</span> <b style="color:var(--amp)">${ACCESSORIES[ev.acc].name}</b> <span class="muted">이 떨어졌다</span>`); break;
      case 'equip': if (ev.id === src.myId) audio.play('pickup'); this.hud.pushFeed(`<b>${name(ev.id)}</b> <span class="muted">이</span> <b style="color:var(--amp)">${ACCESSORIES[ev.acc].name}</b> <span class="muted">을 들었다</span>`); break;
      case 'pad': this.renderer.kickPad(ev.x, ev.z); this.renderer.spawnDust(ev.x, ev.y + 0.1, ev.z); if (ev.id === src.myId) audio.play('jump'); break;
      case 'end': audio.play('end'); break;
      case 'grab': break;
    }
  }

  private showResult(r: { ranking: RankEntry[]; score: [number, number] }): void {
    this.resultShown = true;
    this.input.enabled = false;
    const buttons = [] as { label: string; primary?: boolean; onClick: () => void }[];
    if (this.opts.onAgain) buttons.push({ label: '다시 하기', primary: true, onClick: () => this.opts.onAgain!() });
    buttons.push({ label: this.opts.exitLabel, primary: !this.opts.onAgain, onClick: () => this.opts.onExit() });
    this.hud.showResult(r.ranking, r.score, this.source.world.teams, this.source.myId, buttons);
    const mine = r.ranking.find((e) => e.id === this.source.myId);
    if (mine && this.opts.onResult) void this.opts.onResult(mine, r.ranking).then((note) => { if (note && this.running) this.hud.setResultNote(note); });
    const s = this.stats;
    console.log(`[match] frames ${s.frames} · slow(>20ms) ${s.slow} · worst ${(s.worst * 1000).toFixed(1)}ms · ${((s.frames / ((performance.now() - s.t0) / 1000))).toFixed(1)} fps avg`);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    this.input.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.source.dispose();
    this.el.remove();
  }
}

export function renderFromPlayer(p: Player): RenderPlayer {
  return { id: p.id, x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, state: p.state, t: p.t, move: p.move, grounded: p.grounded, invuln: p.invuln, speed: Math.hypot(p.vel.x, p.vel.z), acc: p.acc, holding: p.holding };
}

export const MAP_NAMES = Object.fromEntries(Object.values(MAPS).map((m) => [m.id, m.name]));
