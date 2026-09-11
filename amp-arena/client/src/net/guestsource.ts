// 온라인 매치의 게스트 쪽: 내 캐릭터는 예측(입력 즉시 시뮬 + 스냅샷 되감기·재실행), 남은 캐릭터는 100ms 지연 보간.
// 방장도 자기 권위 시뮬의 게스트로 이 코드를 그대로 쓴다(루프백 채널) — 그래서 방장과 게스트의 체감이 같다.
import {
  World, applySnapshot, decodePlayer, createPlayer, STATE_IDS, MOVE_IDS, TICK_RATE, lerpAngle,
  type Input, type WorldEvent, type RankEntry, type RosterEntry, type Snapshot, type PlayerSnap, type PState, type MoveId,
  type MatchConfig, type GuestMsg, type HostMsg,
} from '@amp/shared';
import { type MatchSource, type RenderPlayer, renderFromPlayer } from '../game/match.ts';

/** 게스트가 방장에게 닿는 길. 릴레이(게스트) 또는 루프백(방장 자신). */
export interface HostChannel {
  send(d: GuestMsg): void;
  on(h: (d: HostMsg) => void): () => void;
}

const INTERP_TICKS = 6; // 100ms
const ERR_IGNORE = 0.01, ERR_SNAP = 3;
const SEND_EVERY = 3; // 입력 3틱마다 한 번 = 20Hz (릴레이 40 msg/s 의 절반)

interface Buffered { at: number; snap: Snapshot; rows: Map<number, PlayerSnap> }

export class GuestSource implements MatchSource {
  readonly world: World;
  readonly myId: number;
  readonly roster: RosterEntry[];
  readonly online = true;
  ended: { ranking: RankEntry[]; score: [number, number] } | null = null;
  rtt: number | null = null;
  info: string | null = null;
  epoch: number;
  hostSeat: number;
  /** 마지막으로 반영한 권위 스냅샷 — 방장 승계 때 여기서 이어서 돌린다 */
  lastAuth: { snap: Snapshot; acks: number[] } | null = null;
  private ack = 0;
  private pending: Input[] = [];
  private buffer: Buffered[] = [];
  private events: WorldEvent[] = [];
  private offset = { x: 0, y: 0, z: 0 };
  private off: (() => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval>;
  private lastSnapAt = 0;
  private lastSnapTick = 0;
  private sinceSend = 0;
  private corrections = { count: 0, large: 0 };
  private scratch = createPlayer(0, '', 0, 'none', false, 0);
  private channel: HostChannel;

  constructor(channel: HostChannel, cfg: MatchConfig, mySeat: number) {
    this.channel = channel;
    this.myId = mySeat;
    this.roster = cfg.roster;
    this.epoch = cfg.epoch;
    this.hostSeat = cfg.host;
    this.world = new World({ mapId: cfg.map, modeId: cfg.mode, seconds: cfg.seconds, seed: cfg.seed });
    for (const r of cfg.roster) this.world.addPlayer(r.id, r.name, r.team, r.acc, r.bot, r.style);
    this.off = channel.on((d) => this.onMsg(d));
    this.pingTimer = setInterval(() => this.channel.send({ t: 'p', at: performance.now() }), 2000);
    this.channel.send({ t: 'p', at: performance.now() });
  }

  /** 승계로 내가 방장이 되면 릴레이 대신 루프백으로 갈아 끼운다 */
  setChannel(channel: HostChannel): void {
    this.off?.();
    this.channel = channel;
    this.off = channel.on((d) => this.onMsg(d));
  }

  /** 방장이 바뀌었다 — 옛 방장의 스냅샷은 버리고 새 세대의 첫 스냅샷에 맞춘다 */
  onHostChange(epoch: number, host: number): void {
    if (epoch <= this.epoch && host === this.hostSeat) return;
    this.epoch = Math.max(this.epoch, epoch);
    this.hostSeat = host;
    this.resetInterp();
  }

  tick(input: Input): void {
    if (this.ended) return;
    this.pending.push(input);
    if (this.pending.length > 180) this.pending.shift();
    this.world.stepLocal(this.myId, input);
    if (++this.sinceSend >= SEND_EVERY) {
      this.sinceSend = 0;
      this.channel.send({ t: 'i', inputs: this.pending.slice(-SEND_EVERY) });
    }
  }

  private onMsg(d: HostMsg): void {
    switch (d.t) {
      case 's':
        if (d.e < this.epoch) return; // 옛 방장의 늦은 스냅샷
        if (d.e > this.epoch) { this.epoch = d.e; this.resetInterp(); }
        this.lastAuth = { snap: d.snap, acks: d.acks };
        this.onSnap(d.snap, d.acks[this.myId] ?? this.ack);
        for (const e of d.ev) this.events.push(e);
        break;
      case 'end':
        if (d.e >= this.epoch) this.ended = { ranking: d.ranking, score: d.score };
        break;
      case 'host':
        this.onHostChange(d.e, d.host);
        break;
      case 'q':
        this.rtt = performance.now() - d.at;
        break;
      case 'p':
        this.channel.send({ t: 'q', at: d.at });
        break;
      case 'cfg':
        break;
    }
  }

  private resetInterp(): void {
    this.buffer = [];
    this.lastSnapAt = 0;
    this.lastSnapTick = 0;
    this.offset.x = this.offset.y = this.offset.z = 0;
  }

  private onSnap(snap: Snapshot, ack: number): void {
    const me = this.world.players[this.myId];
    const bx = me?.pos.x ?? 0, by = me?.pos.y ?? 0, bz = me?.pos.z ?? 0;
    const rows = new Map<number, PlayerSnap>();
    for (const r of snap.p) rows.set(r[0], r);
    this.buffer.push({ at: performance.now(), snap, rows });
    if (this.buffer.length > 40) this.buffer.shift();
    this.lastSnapAt = performance.now();
    this.lastSnapTick = snap.tick;
    applySnapshot(this.world, snap);
    this.ack = Math.max(this.ack, ack);
    this.pending = this.pending.filter((i) => i.seq > this.ack);
    for (const i of this.pending) this.world.stepLocal(this.myId, i);
    if (me) {
      const dx = bx - me.pos.x, dy = by - me.pos.y, dz = bz - me.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > ERR_IGNORE) {
        this.corrections.count++;
        if (d >= ERR_SNAP) { this.offset.x = this.offset.y = this.offset.z = 0; this.corrections.large++; }
        else { this.offset.x += dx; this.offset.y += dy; this.offset.z += dz; }
      }
    }
  }

  /** 렌더용 상태: 나 = 예측 + 시각 보정, 남 = 스냅샷 보간 */
  renderPlayers(now: number): RenderPlayer[] {
    const out: RenderPlayer[] = [];
    const me = this.world.players[this.myId];
    if (me) {
      const decay = 0.85;
      this.offset.x *= decay; this.offset.y *= decay; this.offset.z *= decay;
      const rp = renderFromPlayer(me);
      rp.x += this.offset.x; rp.y += this.offset.y; rp.z += this.offset.z;
      out.push(rp);
    }
    // 권위 틱 추정: 마지막 스냅샷 틱 + 경과 시간
    const estTick = this.lastSnapTick + ((now - this.lastSnapAt) / 1000) * TICK_RATE;
    const renderTick = estTick - INTERP_TICKS;
    let i1 = this.buffer.length - 1;
    while (i1 > 0 && this.buffer[i1 - 1].snap.tick >= renderTick) i1--;
    const b1 = this.buffer[i1];
    const b0 = i1 > 0 ? this.buffer[i1 - 1] : b1;
    if (!b1) return out;
    const span = b1.snap.tick - (b0?.snap.tick ?? b1.snap.tick);
    const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTick - b0.snap.tick) / span)) : 1;
    for (const r of this.roster) {
      if (r.id === this.myId) continue;
      const r1 = b1.rows.get(r.id), r0 = b0.rows.get(r.id) ?? r1;
      if (!r1 || !r0) continue;
      const s = this.scratch;
      decodePlayer(s, alpha < 0.5 ? r0 : r1);
      const x = r0[1] + (r1[1] - r0[1]) * alpha, y = r0[2] + (r1[2] - r0[2]) * alpha, z = r0[3] + (r1[3] - r0[3]) * alpha;
      const yaw = lerpAngle(r0[4], r1[4], alpha);
      const p = this.world.players[r.id];
      out.push({
        id: r.id, x, y, z, yaw, state: s.state, t: s.t + (alpha < 0.5 ? Math.round(alpha * span) : 0), move: s.move,
        grounded: s.grounded, invuln: s.invuln, speed: Math.hypot(s.vel.x, s.vel.z), acc: p?.acc ?? r.acc, holding: s.holding,
      });
    }
    return out;
  }

  drainEvents(): WorldEvent[] { const e = this.events; this.events = []; return e; }

  /** 남이 나갔다 — 이 좌석은 더 그리지 않는다 (권위 월드에서도 지워진다) */
  removePlayer(seat: number): void {
    this.world.removePlayer(seat);
    for (const b of this.buffer) b.rows.delete(seat);
  }

  dispose(): void {
    this.off?.();
    this.off = null;
    clearInterval(this.pingTimer);
    console.log(`[net] corrections ${this.corrections.count} (large ${this.corrections.large})`);
  }
}

// 타입 참조 유지 (스냅샷 인덱스 정의가 바뀌면 여기서 컴파일 오류가 나야 한다)
export const _stateCount: number = STATE_IDS.length;
export const _moveCount: number = MOVE_IDS.length;
export type _PS = PState; export type _MV = MoveId;
