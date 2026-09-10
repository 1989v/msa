// 방: 슬롯 8 · 설정 · 준비/시작 · 매치 루프(60틱 고정) · 스냅샷 20Hz · 봇 채움.
import {
  World, botInput, newBotMemory, encodeSnapshot, ACCESSORIES, ACCESSORY_IDS, STYLES, STYLE_IDS, MODES, MAPS,
  MAX_PLAYERS, DT, SNAPSHOT_EVERY, RESULT_TICKS, TICK_RATE,
  type Input, type RoomState, type RoomSlot, type RoomSummary, type ServerMsg, type ClientMsg, type AccessoryId, type StyleId, type MapId, type ModeId, type BotMemory, type RosterEntry,
} from '@amp/shared';
import type { Lobby } from './lobby.ts';
import type { Session } from './session.ts';

interface Slot { session: Session | null; name: string; team: number; acc: AccessoryId; style: StyleId; ready: boolean; bot: boolean; mem: BotMemory | null }

const BOT_NAMES = ['봇-알파', '봇-브라보', '봇-찰리', '봇-델타', '봇-에코', '봇-폭스', '봇-골프', '봇-호텔'];
type SettingsMsg = Extract<ClientMsg, { t: 'settings' }>;

export class Room {
  readonly slots: (Slot | null)[] = new Array(MAX_PLAYERS).fill(null);
  phase: RoomState['phase'] = 'wait';
  world: World | null = null;
  private queues: Input[][] = [];
  private lastSeq: number[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private acc = 0;
  private lastTime = 0;
  private resultLeft = 0;
  private tickLag = { max: 0, over4ms: 0, ticks: 0 };

  readonly lobby: Lobby;
  readonly id: string;
  name: string;
  host: Session;
  mode: ModeId;
  map: MapId;
  seconds: number;
  readonly pass: string;
  fillBots: boolean;

  constructor(lobby: Lobby, id: string, name: string, host: Session, mode: ModeId, map: MapId, seconds: number, pass: string, fillBots: boolean) {
    this.lobby = lobby; this.id = id; this.name = name; this.host = host;
    this.mode = mode; this.map = map; this.seconds = seconds; this.pass = pass; this.fillBots = fillBots;
  }

  // ---- 상태 ----
  summary(): RoomSummary {
    return { id: this.id, name: this.name, mode: this.mode, map: this.map, count: this.slots.filter((s) => s && !s.bot).length, max: MAX_PLAYERS, phase: this.phase, locked: !!this.pass };
  }

  state(): RoomState {
    return {
      id: this.id, name: this.name, host: this.host.sid, mode: this.mode, map: this.map, seconds: this.seconds, locked: !!this.pass, fillBots: this.fillBots, phase: this.phase,
      slots: this.slots.map((s): RoomSlot | null => (s ? { sid: s.session?.sid ?? '', name: s.name, team: s.team, acc: s.acc, style: s.style, ready: s.ready, bot: s.bot } : null)),
    };
  }

  isFull(): boolean { return this.slots.every((s) => s && !s.bot); }

  broadcast(msg: ServerMsg): void {
    const text = JSON.stringify(msg);
    for (const s of this.slots) if (s?.session) s.session.sendRaw(text);
  }

  private broadcastState(): void { this.broadcast({ t: 'room', room: this.state() }); }

  private teamFor(): number {
    const c = [0, 0];
    for (const s of this.slots) if (s) c[s.team]++;
    return c[0] <= c[1] ? 0 : 1;
  }

  // ---- 입장·퇴장 ----
  join(session: Session): void {
    // 봇 자리를 사람이 밀어내도 된다
    let idx = this.slots.findIndex((s) => s === null);
    if (idx < 0) idx = this.slots.findIndex((s) => s?.bot);
    if (idx < 0) return session.send({ t: 'err', msg: '방이 가득 찼습니다' });
    this.slots[idx] = { session, name: session.name, team: this.teamFor(), acc: 'none', style: 'fighter', ready: false, bot: false, mem: null };
    session.room = this;
    session.slot = idx;
    if (this.phase !== 'wait') session.send({ t: 'chat', from: '시스템', text: '진행 중인 매치가 끝나면 다음 판에 참가합니다.', system: true });
    this.broadcast({ t: 'chat', from: '시스템', text: `${session.name} 님이 들어왔습니다.`, system: true });
    this.broadcastState();
  }

  leave(session: Session): void {
    const idx = session.slot;
    if (idx < 0 || this.slots[idx]?.session !== session) return;
    this.slots[idx] = null;
    session.room = null;
    session.slot = -1;
    session.send({ t: 'left' });
    if (this.world) this.world.removePlayer(idx);
    const humans = this.slots.filter((s) => s && !s.bot && s.session);
    if (humans.length === 0) { this.stopLoop(); this.lobby.removeRoom(this); return; }
    if (this.host === session) { this.host = humans[0]!.session!; this.broadcast({ t: 'chat', from: '시스템', text: `${this.host.name} 님이 방장이 되었습니다.`, system: true }); }
    this.broadcast({ t: 'chat', from: '시스템', text: `${session.name} 님이 나갔습니다.`, system: true });
    this.broadcastState();
    this.lobby.broadcastRooms();
  }

  private slotOf(session: Session): Slot | null {
    const s = this.slots[session.slot];
    return s && s.session === session ? s : null;
  }

  setReady(session: Session, ready: boolean): void {
    const s = this.slotOf(session);
    if (!s || this.phase !== 'wait') return;
    s.ready = ready;
    this.broadcastState();
  }

  setAcc(session: Session, acc: AccessoryId): void {
    const s = this.slotOf(session);
    if (!s || this.phase !== 'wait' || !(acc in ACCESSORIES)) return;
    s.acc = acc;
    this.broadcastState();
  }

  setStyle(session: Session, style: StyleId): void {
    const s = this.slotOf(session);
    if (!s || this.phase !== 'wait' || !(style in STYLES)) return;
    s.style = style;
    this.broadcastState();
  }

  setTeam(session: Session, team: number): void {
    const s = this.slotOf(session);
    if (!s || this.phase !== 'wait') return;
    s.team = team;
    this.broadcastState();
  }

  setSettings(session: Session, msg: SettingsMsg): void {
    if (session !== this.host || this.phase !== 'wait') return;
    if (msg.mode && msg.mode in MODES) this.mode = msg.mode;
    if (msg.map && msg.map in MAPS) this.map = msg.map;
    if (typeof msg.seconds === 'number' && [120, 180, 300].includes(msg.seconds)) this.seconds = msg.seconds;
    if (typeof msg.fillBots === 'boolean') this.fillBots = msg.fillBots;
    this.broadcastState();
    this.lobby.broadcastRooms();
  }

  // ---- 매치 ----
  start(session: Session): void {
    if (session !== this.host || this.phase !== 'wait') return;
    const humans = this.slots.filter((s) => s && !s.bot);
    if (humans.some((s) => s!.session !== this.host && !s!.ready)) return session.send({ t: 'err', msg: '아직 준비하지 않은 사람이 있습니다' });
    // 봇 채움
    for (let i = 0; i < MAX_PLAYERS; i++) if (this.slots[i]?.bot) this.slots[i] = null;
    if (this.fillBots) {
      let n = 0;
      for (let i = 0; i < MAX_PLAYERS; i++) {
        if (this.slots[i]) continue;
        this.slots[i] = { session: null, name: BOT_NAMES[i], team: this.teamFor(), acc: ACCESSORY_IDS[(i + n) % ACCESSORY_IDS.length], style: STYLE_IDS[(i * 2 + n++) % STYLE_IDS.length], ready: true, bot: true, mem: null };
      }
    }
    const count = this.slots.filter((s) => s).length;
    if (count < 2) return session.send({ t: 'err', msg: '2명 이상 있어야 시작합니다' });

    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const world = new World({ mapId: this.map, modeId: this.mode, seconds: this.seconds, seed });
    this.world = world;
    this.queues = [];
    this.lastSeq = [];
    const roster: RosterEntry[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const s = this.slots[i];
      if (!s) continue;
      world.addPlayer(i, s.name, s.team, s.acc, s.bot, s.style);
      if (s.bot) s.mem = newBotMemory(world.rng);
      this.queues[i] = [];
      this.lastSeq[i] = 0;
      roster.push({ id: i, name: s.name, team: world.teams ? s.team : 0, acc: s.acc, style: s.style, bot: s.bot, sid: s.session?.sid ?? '' });
    }
    this.phase = 'countdown';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const s = this.slots[i];
      if (s?.session) s.session.send({ t: 'start', seed, map: this.map, mode: this.mode, seconds: this.seconds, myId: i, roster });
    }
    this.broadcastState();
    this.lobby.broadcastRooms();
    this.startLoop();
  }

  queueInputs(session: Session, inputs: Input[]): void {
    const idx = session.slot;
    if (idx < 0 || !this.world || !this.queues[idx]) return;
    const q = this.queues[idx];
    let last = q.length ? q[q.length - 1].seq : this.lastSeq[idx];
    for (const i of inputs) {
      if (i.seq <= last) continue;
      q.push(i);
      last = i.seq;
    }
    if (q.length > 30) q.splice(0, q.length - 30);
  }

  private startLoop(): void {
    this.stopLoop();
    this.acc = 0;
    this.lastTime = performance.now();
    this.tickLag = { max: 0, over4ms: 0, ticks: 0 };
    const loop = () => {
      const now = performance.now();
      this.acc += (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (this.acc > DT * 6) this.acc = DT * 6; // 정지 후 폭주 방지
      while (this.acc >= DT) {
        this.acc -= DT;
        const t0 = performance.now();
        this.tick();
        const dt = performance.now() - t0;
        this.tickLag.ticks++;
        if (dt > this.tickLag.max) this.tickLag.max = dt;
        if (dt > 4) this.tickLag.over4ms++;
        if (!this.world) return;
      }
      this.timer = setTimeout(loop, Math.max(0, (DT - this.acc) * 1000 - 1));
    };
    this.timer = setTimeout(loop, 0);
  }

  private stopLoop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const world = this.world;
    if (!world) return;
    const inputs: (Input | undefined)[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const s = this.slots[i];
      const p = world.players[i];
      if (!s || !p) continue;
      if (s.bot) { inputs[i] = botInput(world, p, s.mem!); continue; }
      const q = this.queues[i];
      if (q.length) {
        // 밀린 입력은 두 개씩 소화해 지연을 줄인다
        const take = q.length >= 4 ? 2 : 1;
        let last: Input | undefined;
        for (let k = 0; k < take; k++) last = q.shift();
        inputs[i] = last;
        if (last) this.lastSeq[i] = last.seq;
      }
    }
    const events = world.step(inputs);
    if (this.phase === 'countdown' && world.phase === 'play') { this.phase = 'play'; this.broadcastState(); }
    if (events.length) {
      const ended = events.find((e) => e.t === 'end');
      this.broadcast({ t: 'ev', tick: world.tick, events });
      if (ended && ended.t === 'end') {
        this.broadcast({ t: 'end', ranking: ended.ranking, score: [world.score[0], world.score[1]] });
        this.phase = 'result';
        this.resultLeft = RESULT_TICKS;
        this.broadcastState();
        this.lobby.broadcastRooms();
        console.log(`[room ${this.id}] end · ticks ${this.tickLag.ticks} · tick max ${this.tickLag.max.toFixed(2)}ms · >4ms ${this.tickLag.over4ms}`);
      }
    }
    if (world.tick % SNAPSHOT_EVERY === 0) {
      const snap = encodeSnapshot(world);
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const s = this.slots[i];
        if (s?.session) s.session.send({ t: 's', snap, ack: this.lastSeq[i] ?? 0 });
      }
    }
    if (this.phase === 'result' && --this.resultLeft <= 0) this.finish();
  }

  private finish(): void {
    this.stopLoop();
    this.world = null;
    this.phase = 'wait';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const s = this.slots[i];
      if (!s) continue;
      if (s.bot) { this.slots[i] = null; continue; }
      s.ready = false;
    }
    this.broadcastState();
    this.lobby.broadcastRooms();
  }
}

export const tickRateInfo = { TICK_RATE };
