// 방장이 돌리는 권위 시뮬. 서버가 하던 일(입력 큐 · 봇 · 60틱 스텝 · 스냅샷 10Hz · 종료)을 그대로 브라우저에서 한다.
// DOM 에 기대지 않아 워커 안에서도, 테스트(node)에서도 돈다.
import {
  World, botInput, newBotMemory, encodeSnapshot, applySnapshot, makeRng, sanitizeInput,
  MAX_PLAYERS, SNAPSHOT_EVERY, RELAY_SAFE_CHARS, TICK_RATE, INTERP_TICKS, LAG_COMP_MAX_TICKS,
  type Input, type BotMemory, type WorldEvent, type Snapshot, type MatchConfig, type HostMsg,
} from '@amp/shared';

export interface AuthorityInit {
  cfg: MatchConfig;
  /** 승계: 옛 방장의 마지막 스냅샷과 좌석별 반영 seq 에서 이어서 돈다 */
  resume?: { snap: Snapshot; acks: number[] } | null;
  /** 이미 나간 좌석 — 월드에 넣지 않는다 */
  gone: number[];
}

const MAX_EVENTS_PER_SNAPSHOT = 24;
const QUEUE_MAX = 30;

/** 왕복 지연 → 지연 보상 틱. 게스트가 남을 보는 시점은 「스냅샷 편도 + 보간 지연」 뒤이고 입력이 오는 데 편도가 더 걸리므로 왕복 + 보간이다 */
export function latencyTicksFor(rttMs: number): number {
  if (!(rttMs > 0)) return 0;
  return Math.min(LAG_COMP_MAX_TICKS, Math.round((rttMs / 1000) * TICK_RATE) + INTERP_TICKS);
}

export class Authority {
  readonly world: World;
  readonly cfg: MatchConfig;
  readonly epoch: number;
  ended = false;
  readonly stats = { ticks: 0, tickMax: 0, over4ms: 0, snapMax: 0, snapCount: 0 };
  private queues: Input[][] = [];
  private lastSeq: number[] = new Array(MAX_PLAYERS).fill(0);
  private mems: (BotMemory | null)[] = [];
  private bots = new Set<number>();
  private pendingEvents: WorldEvent[] = [];
  private out: (m: HostMsg) => void;

  constructor(init: AuthorityInit, out: (m: HostMsg) => void) {
    this.out = out;
    this.cfg = init.cfg;
    this.epoch = init.cfg.epoch;
    const gone = new Set(init.gone);
    const w = new World({ mapId: init.cfg.map, modeId: init.cfg.mode, seconds: init.cfg.seconds, seed: init.cfg.seed });
    this.world = w;
    for (const r of init.cfg.roster) {
      if (gone.has(r.id)) continue;
      w.addPlayer(r.id, r.name, r.team, r.acc, r.bot, r.style, r.stats);
      this.queues[r.id] = [];
      if (r.bot) this.bots.add(r.id);
    }
    if (init.resume) {
      applySnapshot(w, init.resume.snap);
      for (let i = 0; i < MAX_PLAYERS; i++) this.lastSeq[i] = init.resume.acks[i] ?? 0;
      // 옛 방장의 난수열은 알 수 없다 — 새 방장이 유일한 권위이므로 여기서 새로 시작해도 된다
      w.rng = makeRng((init.cfg.seed ^ Math.imul(init.cfg.epoch, 0x9e3779b1)) >>> 0);
    }
    for (const id of this.bots) this.mems[id] = newBotMemory(w.rng);
  }

  /** 게스트 입력 — 신뢰 경계: 값 범위와 seq 순서를 여기서 거른다 */
  input(seat: number, raw: unknown[]): void {
    if (seat < 0 || seat >= MAX_PLAYERS || this.bots.has(seat)) return;
    const q = this.queues[seat];
    if (!q || !Array.isArray(raw)) return;
    let last = q.length ? q[q.length - 1].seq : this.lastSeq[seat];
    for (const r of raw.slice(0, 16)) {
      const i = sanitizeInput(r);
      if (!i || i.seq <= last) continue;
      q.push(i);
      last = i.seq;
    }
    if (q.length > QUEUE_MAX) q.splice(0, q.length - QUEUE_MAX);
  }

  /** 좌석의 왕복 지연(ms) — 방장이 2초마다 잰다. 그 좌석의 타격 판정을 그만큼 되감는다 */
  setLatency(seat: number, rttMs: number): void {
    if (seat < 0 || seat >= MAX_PLAYERS || this.bots.has(seat)) return;
    this.world.latency[seat] = latencyTicksFor(rttMs);
  }

  left(seat: number): void {
    this.world.latency[seat] = 0;
    this.world.removePlayer(seat);
    this.queues[seat] = [];
    this.bots.delete(seat);
  }

  /** 60틱 중 한 틱 */
  tick(): void {
    if (this.ended) return;
    const w = this.world;
    const inputs: (Input | undefined)[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = w.players[i];
      if (!p) continue;
      if (this.bots.has(i)) { inputs[i] = botInput(w, p, this.mems[i]!); continue; }
      const q = this.queues[i];
      if (q?.length) {
        // 밀린 입력은 두 개씩 소화해 지연을 줄인다
        const take = q.length >= 4 ? 2 : 1;
        let last: Input | undefined;
        for (let k = 0; k < take; k++) last = q.shift();
        inputs[i] = last;
        if (last) this.lastSeq[i] = last.seq;
      }
    }
    const events = w.step(inputs);
    this.stats.ticks++;
    for (const e of events) this.pendingEvents.push(e);
    const endEv = events.find((e) => e.t === 'end');
    if (w.tick % SNAPSHOT_EVERY === 0 || endEv) this.emitSnapshot();
    if (endEv && endEv.t === 'end') {
      this.ended = true;
      this.out({ t: 'end', e: this.epoch, ranking: endEv.ranking, score: [w.score[0], w.score[1]] });
    }
  }

  private emitSnapshot(): void {
    let ev = this.pendingEvents;
    this.pendingEvents = [];
    if (ev.length > MAX_EVENTS_PER_SNAPSHOT) ev = ev.filter((e) => e.t !== 'hit' && e.t !== 'shot').slice(0, MAX_EVENTS_PER_SNAPSHOT);
    const msg: HostMsg = { t: 's', e: this.epoch, snap: encodeSnapshot(this.world), acks: this.lastSeq.slice(), ev };
    // 릴레이 봉투({t:'move', d:…}) 를 씌운 길이가 상한 안이어야 한다
    let len = JSON.stringify(msg).length + 16;
    if (len > RELAY_SAFE_CHARS && ev.length) { msg.ev = []; len = JSON.stringify(msg).length + 16; }
    this.stats.snapCount++;
    if (len > this.stats.snapMax) this.stats.snapMax = len;
    this.out(msg);
  }
}
