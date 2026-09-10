// WebSocket 래퍼 — 타입별 핸들러 등록.
import type { ClientMsg, ServerMsg } from '@amp/shared';

type Handler<T extends ServerMsg['t']> = (msg: Extract<ServerMsg, { t: T }>) => void;

export class NetClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(m: ServerMsg) => void>>();
  onClose: (() => void) | null = null;
  connected = false;

  connect(url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => { this.connected = true; resolve(); };
      ws.onerror = () => { if (!this.connected) reject(new Error('서버에 연결할 수 없습니다')); };
      ws.onclose = () => { this.connected = false; this.onClose?.(); };
      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const hs = this.handlers.get(msg.t);
        if (hs) for (const h of hs) h(msg);
      };
    });
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  on<T extends ServerMsg['t']>(t: T, h: Handler<T>): () => void {
    let set = this.handlers.get(t);
    if (!set) { set = new Set(); this.handlers.set(t, set); }
    const fn = h as (m: ServerMsg) => void;
    set.add(fn);
    return () => set!.delete(fn);
  }

  close(): void { this.ws?.close(); this.ws = null; }
}
