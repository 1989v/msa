// 매치 런타임: 고정 60틱 시뮬 + 매 프레임 렌더. 입력원(로컬/네트워크)은 MatchSource 가 감싼다.
import { DT, MAPS, type Input, type Player, type World, type WorldEvent, type RankEntry, type RosterEntry, type MoveId, type PState, type AccessoryId } from '@amp/shared';
import { Renderer } from './renderer.ts';
import { Hud } from './hud.ts';
import { InputController } from './input.ts';
import { SLOT_COLORS } from './rig.ts';
import { targetPose } from './poses.ts';
import { audio } from './audio.ts';

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
  dispose(): void;
}

export interface MatchOptions {
  onExit: () => void;           // 나가기 (로컬: 타이틀, 온라인: 대기실 복귀 대기)
  onAgain?: () => void;         // 로컬: 다시
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
  private stats = { frames: 0, slow: 0, t0: performance.now(), worst: 0 };
  private source: MatchSource;
  private opts: MatchOptions;
  private hitstop = new Map<number, number>(); // 리그별 포즈 정지 만료 시각
  private shake = 0;
  private lastCountdown = -1;
  private onKey = (e: KeyboardEvent): void => { if (e.code === 'KeyM' && !(document.activeElement && document.activeElement.tagName === 'INPUT')) { const m = audio.toggleMute(); this.hud.pushFeed(`<span class="muted">효과음 ${m ? '끔' : '켬'} (M)</span>`); } };

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
    audio.unlock();
    window.addEventListener('keydown', this.onKey);
    if (this.input.hasTouch) {
      this.el.classList.add('touch');
      const hint = document.createElement('div');
      hint.className = 'rotate-hint';
      hint.textContent = '가로로 돌려 주세요';
      this.el.appendChild(hint);
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
      const input = this.input.sample(this.seq, this.renderer.camYaw);
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
      rig.root.position.set(rp.x, rp.y, rp.z);
      rig.root.rotation.y = rp.yaw;
      const attackLike = rp.state === 'attack' || rp.state === 'special' || rp.state === 'dashAttack' || rp.state === 'jumpAttack';
      const frozen = (this.hitstop.get(rp.id) ?? 0) > now;
      if (!frozen) rig.setPose(targetPose(rp.state, rp.t, rp.move, rp.speed, rp.grounded, rp.holding >= 0), attackLike ? Math.min(1, k * 2.2) : k);
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
      if (rp.id === src.myId) meView = rp;
    }
    for (const ev of src.drainEvents()) this.onEvent(ev);
    this.renderer.updateProjectiles(world.projectiles);
    const holders = new Map<number, { x: number; y: number; z: number }>();
    for (const rp of players) if (rp.holding >= 0) holders.set(rp.id, { x: rp.x, y: rp.y, z: rp.z });
    this.renderer.updateItems(world.items, holders, now);
    this.renderer.updateEffects(dt);
    const turn = this.input.cameraTurn();
    if (meView) {
      const moving = meView.state === 'walk' || meView.state === 'run' || meView.state === 'roll';
      this.renderer.updateCamera(meView.x, meView.y, meView.z, meView.yaw, moving, turn, dt);
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
    this.hud.update({
      me: world.players[src.myId], players: world.players.filter((p): p is Player => !!p), myId: src.myId,
      phase: world.phase, phaseT: world.phaseT, timeLeft: world.timeLeft, score: world.score, teams: world.teams, plates, rtt: src.rtt,
      modeId: world.mode.id, mapName: world.map.name,
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
        if (ev.kind === 'guard') { this.renderer.spawnHit(ev.x, ev.y, ev.z, 'guard'); if (mine) { audio.play('guard'); const s = this.renderer.project(ev.x, ev.y + 0.4, ev.z); this.hud.showDamage(s.x, s.y, '가드', 'guard'); } break; }
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
        else this.hud.pushFeed(`<b>${name(ev.a)}</b> <span class="muted">이</span> <b style="color:var(--ink)">${name(ev.v)}</b> <span class="muted">을 KO</span>`);
        if (ev.v === src.myId) this.hud.showCenter('KO', ev.a >= 0 ? `${this.nameOf.get(ev.a) ?? '?'} 에게 당했다` : '낙사', true);
        else if (ev.a === src.myId) { const s = this.renderer.project(v?.pos.x ?? 0, (v?.pos.y ?? 0) + 1.6, v?.pos.z ?? 0); this.hud.showDamage(s.x, s.y, 'KO!', 'ko'); }
        break;
      }
      case 'respawn':
        if (ev.id === src.myId) { this.hud.hideCenter(); const me = src.world.players[src.myId]; if (me) this.renderer.resetCamera(me.yaw); }
        break;
      case 'shot': this.renderer.spawnDust(ev.x, ev.y, ev.z); if (ev.id === src.myId) audio.play('shot'); break;
      case 'phase': if (ev.phase === 'play') this.hud.hideCenter(); break;
      case 'explode': this.renderer.spawnHit(ev.x, ev.y, ev.z, 'ko'); this.renderer.spawnDust(ev.x, ev.y - 0.4, ev.z); audio.play('explode'); this.shake = Math.max(this.shake, 0.6); break;
      case 'crateBreak': this.renderer.spawnDust(ev.x, ev.y - 0.3, ev.z); this.renderer.spawnHit(ev.x, ev.y, ev.z, 'hit'); audio.play('hit'); break;
      case 'heal': if (ev.id === src.myId) { audio.play('heal'); const me = src.world.players[src.myId]; if (me) { const s = this.renderer.project(me.pos.x, me.pos.y + 1.8, me.pos.z); this.hud.showDamage(s.x, s.y, `+${ev.amount}`, 'guard'); } } break;
      case 'pickup': if (ev.id === src.myId) audio.play('pickup'); break;
      case 'end': audio.play('end'); break;
      case 'grab': break;
    }
  }

  private showResult(r: { ranking: RankEntry[]; score: [number, number] }): void {
    this.resultShown = true;
    this.input.enabled = false;
    const buttons = [] as { label: string; primary?: boolean; onClick: () => void }[];
    if (this.opts.onAgain) buttons.push({ label: '다시 하기', primary: true, onClick: () => this.opts.onAgain!() });
    buttons.push({ label: this.source.online ? '대기실로' : '타이틀로', primary: !this.opts.onAgain, onClick: () => this.opts.onExit() });
    this.hud.showResult(r.ranking, r.score, this.source.world.teams, this.source.myId, buttons);
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
