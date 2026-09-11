// 게임 플랫폼 릴레이 클라이언트 (`/ws/games/arena`). 봉투(join · move · leave · ping · start · done)만 알고
// `d` 의 내용은 모른다. 릴레이 상한(4KB · 40 msg/s)을 넘기면 연결이 끊기므로 여기서 먼저 막는다.
import { RELAY_SAFE_CHARS, RELAY_SAFE_MSGS_PER_SEC, type ArenaMsg } from '@amp/shared';

export type RelayIn =
  | { t: 'joined'; room: string; seat: number; seats: number; token?: string }
  | { t: 'seat'; seat: number; nick: string }
  | { t: 'start'; seed: number; players: string[]; round?: number; cfg?: unknown }
  | { t: 'move'; seat: number; d: ArenaMsg }
  | { t: 'left'; seat: number }
  | { t: 'opponentLeft' }
  | { t: 'roundEnded'; round: number }
  | { t: 'error'; code: string }
  | { t: 'ping' }
  | { t: 'pong' };

export interface JoinOptions { room: string | null; nick: string; seats: number; private?: boolean; manualStart?: boolean }

export function relayUrl(): string {
  const override = new URLSearchParams(location.search).get('relay');
  if (override) return override;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/games/arena`;
}

const KEEPALIVE_MS = 20_000; // 릴레이는 무메시지 60초에 ping 을 요구하고 90초에 끊는다

export class RelayClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<(m: RelayIn) => void>();
  private sentAt: number[] = [];
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private lastSent = 0;
  private warnedAt = 0;
  /** 상한 때문에 버린 메시지 수 — 0 이어야 정상 */
  dropped = 0;
  connected = false;
  onClose: ((info: { code: number; reason: string }) => void) | null = null;

  connect(url = relayUrl()): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.lastSent = performance.now();
        this.keepalive = setInterval(() => { if (performance.now() - this.lastSent > KEEPALIVE_MS) this.raw({ t: 'ping' }); }, 5000);
        resolve();
      };
      ws.onerror = () => { if (!this.connected) reject(new Error('대전 서버에 연결할 수 없습니다')); };
      ws.onclose = (ev) => {
        const was = this.connected;
        this.connected = false;
        if (this.keepalive) clearInterval(this.keepalive);
        this.keepalive = null;
        if (was) this.onClose?.({ code: ev.code, reason: ev.reason });
      };
      ws.onmessage = (ev) => {
        let msg: RelayIn;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
        if (msg.t === 'ping') { this.raw({ t: 'ping' }); return; } // 유휴 확인 — 아무 메시지나 보내면 된다
        for (const h of [...this.handlers]) h(msg);
      };
    });
  }

  on(h: (m: RelayIn) => void): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  /** 봉투 그대로 보낸다. 상한에 걸리면 버리고 false. */
  raw(msg: object): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const text = JSON.stringify(msg);
    const now = performance.now();
    while (this.sentAt.length && now - this.sentAt[0] > 1000) this.sentAt.shift();
    if (text.length > RELAY_SAFE_CHARS || this.sentAt.length >= RELAY_SAFE_MSGS_PER_SEC) {
      this.dropped++;
      if (now - this.warnedAt > 1000) { this.warnedAt = now; console.warn(`[relay] 상한 때문에 버림 · ${text.length}자 · 최근 1초 ${this.sentAt.length}건`); }
      return false;
    }
    this.sentAt.push(now);
    this.lastSent = now;
    this.ws.send(text);
    return true;
  }

  /** 아레나 메시지를 `move` 봉투로. `to` 가 있으면 그 좌석에게만. */
  send(d: ArenaMsg, to?: number): boolean {
    return this.raw(to === undefined ? { t: 'move', d } : { t: 'move', d, to });
  }

  join(o: JoinOptions): void {
    const msg: Record<string, unknown> = { t: 'join', room: o.room, nick: o.nick, seats: o.seats };
    if (o.private) msg.private = true;
    if (o.manualStart) msg.manualStart = true;
    this.raw(msg);
  }

  leave(): void { this.raw({ t: 'leave' }); }

  close(): void {
    this.onClose = null;
    this.ws?.close();
    this.ws = null;
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
    this.connected = false;
  }
}
