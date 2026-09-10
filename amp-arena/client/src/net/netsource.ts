// 온라인 매치: 내 캐릭터는 예측(입력 즉시 시뮬 + 스냅샷 되감기·재실행), 남은 캐릭터는 100ms 지연 보간.
import {
  World, applySnapshot, decodePlayer, createPlayer, STATE_IDS, MOVE_IDS, TICK_RATE, lerpAngle,
  type Input, type WorldEvent, type RankEntry, type RosterEntry, type Snapshot, type ServerMsg, type PlayerSnap, type PState, type MoveId,
} from '@amp/shared';
import { type MatchSource, type RenderPlayer, renderFromPlayer } from '../game/match.ts';
import type { NetClient } from './client.ts';

type StartMsg = Extract<ServerMsg, { t: 'start' }>;
const INTERP_TICKS = 6; // 100ms
const ERR_IGNORE = 0.01, ERR_SNAP = 3;

interface Buffered { at: number; snap: Snapshot; rows: Map<number, PlayerSnap> }

export class NetSource implements MatchSource {
  readonly world: World;
  readonly myId: number;
  readonly roster: RosterEntry[];
  readonly online = true;
  ended: { ranking: RankEntry[]; score: [number, number] } | null = null;
  rtt: number | null = null;
  private pending: Input[] = [];
  private buffer: Buffered[] = [];
  private events: WorldEvent[] = [];
  private offset = { x: 0, y: 0, z: 0 };
  private offs: (() => void)[] = [];
  private pingTimer: ReturnType<typeof setInterval>;
  private lastSnapAt = 0;
  private lastSnapTick = 0;
  private corrections = { count: 0, large: 0 };
  private scratch = createPlayer(0, '', 0, 'none', false, 0);
  private net: NetClient;

  constructor(net: NetClient, start: StartMsg) {
    this.net = net;
    this.myId = start.myId;
    this.roster = start.roster;
    this.world = new World({ mapId: start.map, modeId: start.mode, seconds: start.seconds, seed: start.seed });
    for (const r of start.roster) this.world.addPlayer(r.id, r.name, r.team, r.acc, r.bot, r.style ?? 'fighter');
    this.offs.push(net.on('s', (m) => this.onSnap(m.snap, m.ack)));
    this.offs.push(net.on('ev', (m) => { for (const e of m.events) this.events.push(e); }));
    this.offs.push(net.on('end', (m) => { this.ended = { ranking: m.ranking, score: m.score }; }));
    this.offs.push(net.on('pong', (m) => { this.rtt = performance.now() - m.at; }));
    this.pingTimer = setInterval(() => net.send({ t: 'ping', at: performance.now() }), 2000);
    net.send({ t: 'ping', at: performance.now() });
  }

  tick(input: Input): void {
    if (this.ended) return;
    this.pending.push(input);
    if (this.pending.length > 180) this.pending.shift();
    this.world.stepLocal(this.myId, input);
    // 최근 입력 몇 개를 같이 보내 유실·순서 문제를 줄인다
    this.net.send({ t: 'in', inputs: this.pending.slice(-3) });
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
    this.pending = this.pending.filter((i) => i.seq > ack);
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
    // 서버 틱 추정: 마지막 스냅샷 틱 + 경과 시간
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

  dispose(): void {
    for (const off of this.offs) off();
    clearInterval(this.pingTimer);
    console.log(`[net] corrections ${this.corrections.count} (large ${this.corrections.large})`);
  }
}

// 타입 참조 유지 (스냅샷 인덱스 정의가 바뀌면 여기서 컴파일 오류가 나야 한다)
export const _stateCount: number = STATE_IDS.length;
export const _moveCount: number = MOVE_IDS.length;
export type _PS = PState; export type _MV = MoveId;
