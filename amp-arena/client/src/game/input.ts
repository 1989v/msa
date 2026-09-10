// 키보드·게임패드 → Input. 이동은 카메라 요(yaw)로 돌려 월드 방향으로 보낸다.
import { BTN_ATTACK, BTN_JUMP, BTN_GUARD, BTN_SPECIAL, BTN_DASH, BTN_PICKUP, type Input } from '@amp/shared';
import { TouchPad, touchWanted } from './touch.ts';

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const GAME_KEYS = new Set([...Object.keys(MOVE_KEYS), 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyF', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyJ', 'KeyK', 'KeyL']);
const DOUBLE_TAP_MS = 260;

export class InputController {
  private down = new Set<string>();
  private lastTap = new Map<string, number>();
  private dashLatched = false;
  private camRotate = 0;      // -1..1 (Q/E)
  private dragDelta = 0;      // 마우스 우클릭 드래그 누적 (px)
  private dragging = false;
  private lastX = 0;
  private touchState: { dragPx: number } | null = null;
  enabled = true;
  private touch: TouchPad | null = null;

  constructor(el: HTMLElement) {
    if (touchWanted()) this.touch = new TouchPad(el);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => { this.down.clear(); this.dashLatched = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mousedown', (e) => { if (e.button === 2) { this.dragging = true; this.lastX = e.clientX; } });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => { if (this.dragging) { this.dragDelta += e.clientX - this.lastX; this.lastX = e.clientX; } });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.touch?.dispose();
  }

  get hasTouch(): boolean { return !!this.touch; }

  private isTyping(): boolean {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled || this.isTyping()) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (MOVE_KEYS[e.code]) {
      const now = performance.now();
      const last = this.lastTap.get(e.code) ?? -1e9;
      if (now - last < DOUBLE_TAP_MS) this.dashLatched = true;
      this.lastTap.set(e.code, now);
    }
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    if (![...this.down].some((k) => MOVE_KEYS[k])) this.dashLatched = false;
  };

  private pad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** 카메라 회전 입력 (-1 왼쪽 … 1 오른쪽) — 프레임마다 읽고 드래그 누적은 비운다 */
  cameraTurn(): { keys: number; dragPx: number; stick: number } {
    const keys = (this.down.has('KeyE') ? 1 : 0) - (this.down.has('KeyQ') ? 1 : 0);
    let dragPx = this.dragDelta;
    this.dragDelta = 0;
    if (this.touchState) { dragPx += this.touchState.dragPx; this.touchState = null; }
    const p = this.pad();
    const stick = p && Math.abs(p.axes[2] ?? 0) > 0.2 ? p.axes[2] : 0;
    return { keys, dragPx, stick };
  }

  sample(seq: number, camYaw: number): Input {
    let x = 0, y = 0;
    for (const k of this.down) { const m = MOVE_KEYS[k]; if (m) { x += m[0]; y += m[1]; } }
    let btn = 0;
    const has = (c: string) => this.down.has(c);
    if (has('KeyZ') || has('KeyJ')) btn |= BTN_ATTACK;
    if (has('KeyX') || has('KeyK') || has('Space')) btn |= BTN_JUMP;
    if (has('KeyC') || has('KeyL')) btn |= BTN_GUARD;
    if (has('KeyV')) btn |= BTN_SPECIAL;
    if (has('KeyF')) btn |= BTN_PICKUP;
    if (has('ShiftLeft') || has('ShiftRight') || this.dashLatched) btn |= BTN_DASH;

    if (this.touch) {
      const t = this.touch.read();
      this.touchState = { dragPx: (this.touchState?.dragPx ?? 0) + t.dragPx };
      if (Math.hypot(t.x, t.y) > 0.12) { x = t.x; y = t.y; }
      btn |= t.btn;
    }
    const p = this.pad();
    if (p) {
      const ax = p.axes[0] ?? 0, ay = -(p.axes[1] ?? 0);
      if (Math.hypot(ax, ay) > 0.18) { x = ax; y = ay; }
      const b = (i: number) => !!p.buttons[i]?.pressed;
      if (b(0)) btn |= BTN_ATTACK;
      if (b(1)) btn |= BTN_JUMP;
      if (b(2)) btn |= BTN_SPECIAL;
      if (b(3)) btn |= BTN_PICKUP;
      if (b(5) || b(7)) btn |= BTN_GUARD;
      if (b(4) || b(6)) btn |= BTN_DASH;
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    // 카메라 기준: 앞 = (sin yaw, cos yaw). 오른쪽 = 앞 × 위 = (-cos yaw, sin yaw) — 오른손 좌표계라 +z 를 볼 때 화면 오른쪽은 -x 다
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    return { seq, mx: rx * x + fx * y, mz: rz * x + fz * y, btn };
  }
}
