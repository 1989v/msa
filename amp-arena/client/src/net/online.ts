// 온라인 세션 컨트롤러: 릴레이 방(대기실) · 매치 시작 · 방장 역할(권위 워커 + 루프백) · 방장 승계.
// 화면(app.ts)은 이 클래스의 state 를 그리고 명령만 내린다.
import {
  ACCESSORY_IDS, STYLE_IDS, MAX_PLAYERS, MAPS, MODES, TICK_RATE, sanitizeName, occupiedSeats, hostOf,
  type MatchConfig, type RosterEntry, type Pick, type RoomSettings, type GuestMsg, type HostMsg, type ArenaMsg, type AccessoryId, type StyleId, type MapId, type ModeId,
} from '@amp/shared';
import { RelayClient, type RelayIn } from './relay.ts';
import { GuestSource, type HostChannel } from './guestsource.ts';
import type { WorkerIn, WorkerOut } from './authority.worker.ts';

export interface SeatInfo { seat: number; name: string; pick: Pick | null; settings: RoomSettings | null }
export interface OnlineState {
  code: string;
  mySeat: number;
  seats: (SeatInfo | null)[];
  party: boolean;           // 코드 방(방장이 시작) / 빠른 대전(릴레이가 30초 뒤 시작)
  started: boolean;
  host: number;             // 대기실: 가장 낮은 점유 좌석. 매치: cfg.host
  joinedAt: number;
  chat: { from: string; text: string; system?: boolean }[];
}

export interface OnlineHooks {
  onState: () => void;
  onMatch: (src: GuestSource) => void;
  onRoundEnd: () => void;       // 결과 뒤 대기실로(코드 방) 또는 로비로(빠른 대전)
  onToast: (msg: string) => void;
  onDisconnect: () => void;
}

const BOT_NAMES = ['봇-알파', '봇-브라보', '봇-찰리', '봇-델타', '봇-에코', '봇-폭스', '봇-골프', '봇-호텔'];
const CFG_WAIT_MS = 1200;    // 방장이 hi 를 못 받은 좌석을 기다리는 시간
const CFG_TIMEOUT_MS = 6000; // 게스트가 cfg 를 기다리는 시간
const HOST_DELAY_MIN = 33, HOST_DELAY_MAX = 150;

const ERROR_TEXT: Record<string, string> = {
  ROOM_NOT_FOUND: '그 코드의 방이 없습니다', ROOM_FULL: '방이 가득 찼습니다', ROOM_STARTED: '이미 시작한 방입니다',
  ROOM_LIMIT: '대전 서버가 붐빕니다. 잠시 뒤 다시', ALREADY_JOINED: '이미 방에 있습니다', NOT_HOST: '방장만 시작할 수 있습니다',
  RATE_LIMIT: '메시지가 너무 많아 끊겼습니다', TOO_LARGE: '메시지가 너무 커서 끊겼습니다',
};

/** 게스트 → 릴레이 → 방장. 방장 메시지만 HostMsg 로 넘긴다. */
class RelayChannel implements HostChannel {
  hostSeat = -1;
  private handlers = new Set<(d: HostMsg) => void>();
  private relay: RelayClient;
  constructor(relay: RelayClient) { this.relay = relay; }
  send(d: GuestMsg): void {
    if (d.t === 'i' || d.t === 'p' || d.t === 'q') { if (this.hostSeat >= 0) this.relay.send(d, this.hostSeat); }
    else this.relay.send(d);
  }
  on(h: (d: HostMsg) => void): () => void { this.handlers.add(h); return () => this.handlers.delete(h); }
  feed(d: HostMsg): void { for (const h of [...this.handlers]) h(d); }
}

/** 방장 자신 ↔ 권위 워커. 양방향에 같은 지연을 넣어 게스트와 조건을 맞춘다 (입력 지연 균등화). */
class Loopback implements HostChannel {
  delayMs = 0;
  private handlers = new Set<(d: HostMsg) => void>();
  private toWorker: (d: GuestMsg) => void;
  constructor(toWorker: (d: GuestMsg) => void) { this.toWorker = toWorker; }
  send(d: GuestMsg): void {
    if (d.t === 'p') { const at = d.at; this.later(() => this.feed({ t: 'q', at })); return; }
    this.later(() => this.toWorker(d));
  }
  on(h: (d: HostMsg) => void): () => void { this.handlers.add(h); return () => this.handlers.delete(h); }
  deliver(m: HostMsg): void { this.later(() => this.feed(m)); }
  private feed(m: HostMsg): void { for (const h of [...this.handlers]) h(m); }
  private later(fn: () => void): void { if (this.delayMs <= 0) fn(); else setTimeout(fn, this.delayMs); }
}

export class Online {
  readonly state: OnlineState = { code: '', mySeat: -1, seats: new Array(MAX_PLAYERS).fill(null), party: false, started: false, host: -1, joinedAt: 0, chat: [] };
  private relay = new RelayClient();
  private hooks: OnlineHooks;
  private nick: string;
  private pick: Pick;
  private settings: RoomSettings;
  private channel: RelayChannel;
  private source: GuestSource | null = null;
  private cfg: MatchConfig | null = null;
  private gone = new Set<number>();
  private worker: Worker | null = null;
  private loopback: Loopback | null = null;
  private guestRtt = new Map<number, number>();
  private hostPingTimer: ReturnType<typeof setInterval> | null = null;
  private cfgTimer: ReturnType<typeof setTimeout> | null = null;
  private off: (() => void) | null = null;
  private joinResolve: ((ok: boolean) => void) | null = null;
  private lobbySeed = 0;

  constructor(nick: string, pick: Omit<Pick, 'name'>, settings: RoomSettings, hooks: OnlineHooks) {
    this.nick = nick;
    this.pick = { ...pick, name: nick };
    this.settings = settings;
    this.hooks = hooks;
    this.channel = new RelayChannel(this.relay);
  }

  get connected(): boolean { return this.relay.connected; }
  get inRoom(): boolean { return this.state.mySeat >= 0; }
  get isHost(): boolean { return this.state.host === this.state.mySeat && this.state.mySeat >= 0; }
  get dropped(): number { return this.relay.dropped; }
  get hostDelayMs(): number { return this.loopback?.delayMs ?? 0; }

  async connect(): Promise<void> {
    if (this.relay.connected) return;
    await this.relay.connect();
    this.relay.onClose = (info) => {
      this.teardownMatch();
      this.resetRoom();
      this.hooks.onToast(ERROR_TEXT[info.reason] ?? '대전 서버 연결이 끊겼습니다');
      this.hooks.onDisconnect();
    };
    this.off = this.relay.on((m) => this.onRelay(m));
  }

  close(): void {
    this.teardownMatch();
    this.off?.();
    this.off = null;
    this.relay.close();
    this.resetRoom();
  }

  // ---------------- 방 ----------------
  /** 빠른 대전: 같은 슬러그 대기열 자동 매칭. 릴레이가 만석 또는 30초 뒤에 시작시킨다. */
  quick(): Promise<boolean> { return this.join({ room: null, private: false }); }
  /** 코드 방 만들기: 방장이 시작 버튼을 누를 때까지 기다린다 */
  create(): Promise<boolean> { return this.join({ room: null, private: true }); }
  joinCode(code: string): Promise<boolean> { return this.join({ room: code.trim().toUpperCase(), private: true }); }

  private join(o: { room: string | null; private: boolean }): Promise<boolean> {
    if (this.inRoom) return Promise.resolve(false);
    this.resetRoom();
    this.state.party = o.private;
    this.relay.join({ room: o.room, nick: this.nick, seats: MAX_PLAYERS, private: o.private, manualStart: o.private });
    return new Promise((resolve) => {
      this.joinResolve = resolve;
      setTimeout(() => { if (this.joinResolve === resolve) { this.joinResolve = null; resolve(false); } }, 8000);
    });
  }

  leave(): void {
    if (!this.inRoom) return;
    this.relay.leave();
    this.teardownMatch();
    this.resetRoom();
    this.hooks.onState();
  }

  setPick(p: Partial<Omit<Pick, 'name'>>): void {
    this.pick = { ...this.pick, ...p };
    this.sayHi();
  }

  setSettings(s: Partial<RoomSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.sayHi();
  }

  chat(text: string): void {
    const t = text.trim().slice(0, 120);
    if (!t || !this.inRoom) return;
    this.relay.send({ t: 'c', text: t });
    this.pushChat(this.nick, t);
  }

  /** 코드 방 방장의 시작 — 릴레이 `start` 봉투에 매치 설정을 실어 전원이 같은 메시지로 받는다 */
  start(): void {
    if (!this.state.party || !this.isHost || this.state.started) return;
    const cfg = this.buildConfig(this.occupied(), (Math.random() * 0x7fffffff) >>> 0, 0);
    this.relay.raw({ t: 'start', cfg });
  }

  /** 결과 화면에서 — 코드 방은 `done` 으로 다음 판을 열고, 빠른 대전은 방을 나간다 */
  finishRound(): void {
    this.teardownMatch();
    if (this.state.party) { this.relay.raw({ t: 'done' }); }
    else { this.leave(); }
  }

  private resetRoom(): void {
    this.state.code = '';
    this.state.mySeat = -1;
    this.state.seats = new Array(MAX_PLAYERS).fill(null);
    this.state.started = false;
    this.state.host = -1;
    this.state.chat = [];
    this.channel.hostSeat = -1;
    this.cfg = null;
    this.gone.clear();
    this.guestRtt.clear();
  }

  private occupied(): number[] {
    const out: number[] = [];
    this.state.seats.forEach((s, i) => { if (s) out.push(i); });
    return out;
  }

  private sayHi(): void {
    if (!this.inRoom) return;
    const me = this.state.seats[this.state.mySeat];
    if (me) { me.pick = this.pick; me.settings = this.settings; }
    this.relay.send({ t: 'hi', pick: this.pick, settings: this.settings });
    this.hooks.onState();
  }

  private pushChat(from: string, text: string, system = false): void {
    this.state.chat.push({ from, text, system });
    if (this.state.chat.length > 40) this.state.chat.shift();
    this.hooks.onState();
  }

  private seatName(seat: number): string { return this.state.seats[seat]?.name ?? `${seat + 1}번`; }

  // ---------------- 릴레이 수신 ----------------
  private onRelay(m: RelayIn): void {
    switch (m.t) {
      case 'joined': {
        if (m.seat < 0) { this.relay.leave(); this.hooks.onToast('관전은 아직 지원하지 않습니다'); this.joinResolve?.(false); this.joinResolve = null; return; }
        this.state.code = m.room;
        this.state.mySeat = m.seat;
        this.state.joinedAt = performance.now();
        this.state.seats[m.seat] = { seat: m.seat, name: this.nick, pick: this.pick, settings: this.settings };
        this.state.host = hostOf(this.occupied());
        this.joinResolve?.(true);
        this.joinResolve = null;
        this.sayHi();
        break;
      }
      case 'seat': {
        // 새로 온 사람 — 내 선택을 다시 알려 그쪽 대기실에도 내가 보이게 한다
        this.state.seats[m.seat] = { seat: m.seat, name: sanitizeName(m.nick, `${m.seat + 1}번`), pick: null, settings: null };
        this.state.host = hostOf(this.occupied());
        this.pushChat('시스템', `${this.seatName(m.seat)} 님이 들어왔습니다.`, true);
        this.sayHi();
        break;
      }
      case 'move': this.onArena(m.seat, m.d); break;
      case 'start': this.onStart(m); break;
      case 'left':
      case 'opponentLeft': {
        const seat = m.t === 'left' ? m.seat : -1;
        if (seat < 0) return;
        const name = this.seatName(seat);
        this.state.seats[seat] = null;
        this.gone.add(seat);
        this.guestRtt.delete(seat);
        if (this.state.started) this.onLeftDuringMatch(seat, name);
        else { this.state.host = hostOf(this.occupied()); this.pushChat('시스템', `${name} 님이 나갔습니다.`, true); }
        break;
      }
      case 'roundEnded':
        // 코드 방: 판이 닫혔다 — 대기실로. 좌석은 그대로라 hi 를 다시 돌려 선택을 맞춘다
        this.state.started = false;
        this.cfg = null;
        this.gone.clear();
        this.state.host = hostOf(this.occupied());
        this.hooks.onRoundEnd();
        this.sayHi();
        break;
      case 'error': {
        const text = ERROR_TEXT[m.code] ?? `대전 서버 오류: ${m.code}`;
        if (this.joinResolve) { this.joinResolve(false); this.joinResolve = null; this.resetRoom(); }
        this.hooks.onToast(text);
        break;
      }
      case 'pong': break;
      case 'ping': break;
    }
  }

  private onArena(from: number, d: ArenaMsg): void {
    switch (d.t) {
      case 'hi': {
        const s = this.state.seats[from] ?? { seat: from, name: d.pick.name, pick: null, settings: null };
        s.pick = d.pick;
        s.settings = d.settings ?? s.settings;
        if (!this.state.seats[from]) { s.name = sanitizeName(d.pick.name, `${from + 1}번`); }
        this.state.seats[from] = s;
        this.state.host = this.state.started && this.cfg ? this.cfg.host : hostOf(this.occupied());
        this.hooks.onState();
        break;
      }
      case 'c': this.pushChat(this.seatName(from), String(d.text).slice(0, 120)); break;
      case 'i': if (this.worker && from !== this.state.mySeat) this.worker.postMessage({ t: 'in', seat: from, inputs: d.inputs } satisfies WorkerIn); break;
      case 'p':
        if (this.worker) this.relay.send({ t: 'q', at: d.at }, from); // 게스트 ping → 방장이 바로 답한다
        else if (from === this.channel.hostSeat) this.channel.feed(d);  // 방장 ping → 게스트 소스가 답한다
        break;
      case 'q':
        if (this.worker) this.guestRtt.set(from, performance.now() - d.at);
        else if (from === this.channel.hostSeat) this.channel.feed(d);
        break;
      case 'cfg': if (from === this.state.host || !this.cfg) this.applyConfig(d.cfg); break;
      case 's': case 'end': case 'host':
        if (d.t === 'host' && d.e > (this.cfg?.epoch ?? -1)) { this.cfg = this.cfg ? { ...this.cfg, epoch: d.e, host: d.host } : this.cfg; this.state.host = d.host; this.channel.hostSeat = d.host; }
        if (from === this.channel.hostSeat) this.channel.feed(d);
        break;
    }
  }

  // ---------------- 시작 ----------------
  private onStart(m: Extract<RelayIn, { t: 'start' }>): void {
    if (this.state.started) return;
    this.state.started = true;
    const occ = occupiedSeats(m.players);
    // 릴레이가 준 이름이 정본 — 대기실에서 못 본 사람도 여기서 채운다
    for (const seat of occ) {
      const s = this.state.seats[seat];
      if (!s) this.state.seats[seat] = { seat, name: sanitizeName(m.players[seat], `${seat + 1}번`), pick: null, settings: null };
    }
    this.state.seats.forEach((s, i) => { if (s && !occ.includes(i)) this.state.seats[i] = null; });
    this.state.host = hostOf(occ);
    this.channel.hostSeat = this.state.host;
    this.lobbySeed = m.seed;
    const cfgInStart = m.cfg && typeof m.cfg === 'object' ? (m.cfg as MatchConfig) : null;
    if (cfgInStart && Array.isArray(cfgInStart.roster)) { this.applyConfig(cfgInStart); return; }
    if (this.isHost) {
      // 빠른 대전: hi 가 아직 안 온 좌석을 잠깐 기다렸다가 설정을 뿌린다
      const missing = () => occ.filter((s) => s !== this.state.mySeat && !this.state.seats[s]?.pick);
      const go = () => { if (this.cfg) return; const cfg = this.buildConfig(occ, this.lobbySeed, 0); this.relay.send({ t: 'cfg', cfg }); this.applyConfig(cfg); };
      if (missing().length === 0) go();
      else this.cfgTimer = setTimeout(go, CFG_WAIT_MS);
    } else {
      this.cfgTimer = setTimeout(() => { if (!this.cfg) { this.hooks.onToast('방장에게서 매치 설정을 못 받았습니다'); this.leave(); } }, CFG_TIMEOUT_MS);
    }
    this.hooks.onState();
  }

  /** 방장이 매치 설정을 만든다: 점유 좌석은 사람, 빈 좌석은 (설정에 따라) 봇 */
  private buildConfig(occ: number[], seed: number, epoch: number): MatchConfig {
    const mine = this.state.seats[this.state.mySeat];
    const settings = mine?.settings ?? this.settings;
    const teams = MODES[settings.mode].teams;
    const count = [0, 0];
    const roster: RosterEntry[] = [];
    for (const seat of occ) {
      const s = this.state.seats[seat];
      const pick = s?.pick;
      const team = teams ? (pick && pick.team >= 0 ? pick.team : (count[0] <= count[1] ? 0 : 1)) : 0;
      count[team]++;
      roster.push({ id: seat, name: s?.name ?? `${seat + 1}번`, team, acc: pick?.acc ?? 'none', style: pick?.style ?? 'fighter', bot: false });
    }
    if (settings.fillBots) {
      let n = 0;
      for (let i = 0; i < MAX_PLAYERS; i++) {
        if (occ.includes(i)) continue;
        const team = teams ? (count[0] <= count[1] ? 0 : 1) : 0;
        count[team]++;
        roster.push({ id: i, name: BOT_NAMES[i], team, acc: ACCESSORY_IDS[(i + n) % ACCESSORY_IDS.length], style: STYLE_IDS[(i * 2 + n++) % STYLE_IDS.length], bot: true });
      }
    }
    roster.sort((a, b) => a.id - b.id);
    return { epoch, host: this.state.mySeat, map: settings.map in MAPS ? settings.map : 'colosseum', mode: settings.mode, seconds: settings.seconds, seed, roster };
  }

  private applyConfig(cfg: MatchConfig): void {
    if (this.cfg) return;
    if (this.cfgTimer) clearTimeout(this.cfgTimer);
    this.cfgTimer = null;
    this.cfg = cfg;
    this.state.host = cfg.host;
    this.channel.hostSeat = cfg.host;
    const src = new GuestSource(this.channel, cfg, this.state.mySeat);
    this.source = src;
    if (cfg.host === this.state.mySeat) this.becomeHost(null);
    else src.info = `게스트 · 방장 ${this.seatName(cfg.host)}`;
    this.hooks.onMatch(src);
    this.hooks.onState();
  }

  // ---------------- 방장 역할 ----------------
  private becomeHost(resume: { snap: import('@amp/shared').Snapshot; acks: number[] } | null): void {
    const src = this.source, cfg = this.cfg;
    if (!src || !cfg) return;
    this.stopWorker();
    const worker = new Worker(new URL('./authority.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    const loop = new Loopback((d) => { if (d.t === 'i') worker.postMessage({ t: 'in', seat: this.state.mySeat, inputs: d.inputs } satisfies WorkerIn); });
    this.loopback = loop;
    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const m = ev.data;
      if (m.t === 'out') { this.relay.send(m.m); loop.deliver(m.m); }
      else if (m.t === 'stats') console.log(`[host] ticks ${m.stats.ticks} · tick max ${m.stats.tickMax.toFixed(2)}ms · >4ms ${m.stats.over4ms} · snapshot max ${m.stats.snapMax}자 (${m.stats.snapCount}장)`);
    };
    worker.postMessage({ t: 'init', init: { cfg, resume, gone: [...this.gone] } } satisfies WorkerIn);
    src.setChannel(loop);
    src.info = '방장';
    // 게스트 왕복을 재서 내 입력 지연을 맞춘다 (사람이 없으면 0)
    this.hostPingTimer = setInterval(() => {
      for (const seat of this.occupied()) if (seat !== this.state.mySeat) this.relay.send({ t: 'p', at: performance.now() }, seat);
      const rtts = [...this.guestRtt.values()].sort((a, b) => a - b);
      const target = rtts.length ? Math.min(HOST_DELAY_MAX, Math.max(HOST_DELAY_MIN, rtts[Math.floor(rtts.length / 2)] / 2)) : 0;
      const cur = loop.delayMs;
      loop.delayMs = cur + Math.max(-16, Math.min(16, target - cur));
      src.info = `방장 · 입력 지연 ${Math.round(loop.delayMs)}ms (${rtts.length}명 기준)`;
    }, 2000);
  }

  private stopWorker(): void {
    if (this.hostPingTimer) clearInterval(this.hostPingTimer);
    this.hostPingTimer = null;
    if (this.worker) { this.worker.postMessage({ t: 'stop' } satisfies WorkerIn); this.worker.terminate(); }
    this.worker = null;
    this.loopback = null;
  }

  /** 매치 중 누가 나갔다 — 방장이면 승계, 아니면 그 캐릭터만 지운다 */
  private onLeftDuringMatch(seat: number, name: string): void {
    const src = this.source, cfg = this.cfg;
    if (!src || !cfg) return;
    if (this.worker) this.worker.postMessage({ t: 'left', seat } satisfies WorkerIn);
    src.removePlayer(seat);
    if (seat !== cfg.host) { this.hooks.onState(); return; }
    const newHost = hostOf(this.occupied());
    if (newHost < 0) return;
    const epoch = cfg.epoch + 1;
    this.cfg = { ...cfg, epoch, host: newHost };
    this.state.host = newHost;
    this.channel.hostSeat = newHost;
    if (newHost === this.state.mySeat) {
      // 내가 새 방장: 마지막 권위 스냅샷에서 이어서 돌린다
      src.onHostChange(epoch, newHost);
      this.becomeHost(src.lastAuth);
      this.relay.send({ t: 'host', e: epoch, host: newHost });
      console.log(`[host] 승계 · 좌석 ${newHost} · epoch ${epoch} · tick ${src.lastAuth?.snap.tick ?? -1}`);
    } else {
      src.onHostChange(epoch, newHost);
      src.info = `게스트 · 방장 ${this.seatName(newHost)} (승계)`;
    }
    this.hooks.onState();
  }

  private teardownMatch(): void {
    if (this.cfgTimer) clearTimeout(this.cfgTimer);
    this.cfgTimer = null;
    this.stopWorker();
    this.source = null;
    this.cfg = null;
    this.gone.clear();
    this.guestRtt.clear();
    this.state.started = false;
  }
}

/** 대기실에서 보여줄 자동 시작 남은 시간 (빠른 대전은 릴레이가 방 생성 30초 뒤 시작시킨다) */
export const lobbyCloseSec = (joinedAt: number): number => Math.max(0, Math.ceil(30 - (performance.now() - joinedAt) / 1000));
export const ticksToSec = (t: number): number => t / TICK_RATE;
export type { MapId, ModeId, AccessoryId, StyleId };
