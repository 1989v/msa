// 터치 조작: 왼쪽 가상 스틱 + 오른쪽 버튼 4+1, 남는 오른쪽 영역 드래그는 카메라.
import { BTN_ATTACK, BTN_HEAVY, BTN_JUMP, BTN_GUARD, BTN_SPECIAL, BTN_DASH, BTN_PICKUP } from '@amp/shared';
import { isRotated } from '../ui/orient.ts';

/** 화면 좌표 → 뿌리(#app) 좌표. 뿌리가 90° 돌아가 있으면 x' = y, y' = W − x (W = 화면 너비) */
function toLocal(x: number, y: number): { x: number; y: number } {
  return isRotated() ? { x: y, y: window.innerWidth - x } : { x, y };
}

export interface TouchState { x: number; y: number; btn: number; dragPx: number }

const BUTTONS: [string, string, number, string][] = [
  ['atk', '약공', BTN_ATTACK, 'right:110px;bottom:36px;width:84px;height:84px;font-size:18px'],
  ['heavy', '강공', BTN_HEAVY, 'right:26px;bottom:36px;width:74px;height:74px;font-size:16px'],
  ['jump', '점프', BTN_JUMP, 'right:34px;bottom:124px;width:64px;height:64px'],
  ['guard', '가드', BTN_GUARD, 'right:206px;bottom:44px;width:64px;height:64px'],
  ['special', '기술', BTN_SPECIAL, 'right:124px;bottom:134px;width:64px;height:64px'],
  ['pickup', '줍기', BTN_PICKUP, 'right:44px;bottom:204px;width:52px;height:52px;font-size:12px'],
];

export function touchWanted(): boolean {
  if (new URLSearchParams(location.search).get('touch') === '1') return true;
  return (navigator.maxTouchPoints ?? 0) > 0 && matchMedia('(pointer: coarse)').matches;
}

export class TouchPad {
  readonly el: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private stickId = -1;
  private stickOrigin = { x: 0, y: 0 };
  private vec = { x: 0, y: 0 };
  private dashLatched = false;
  private lastRelease = 0;
  private held = 0;
  private camId = -1;
  private camLastX = 0;
  private dragPx = 0;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'touchpad';
    this.el.innerHTML = `<div class="stick"><div class="knob"></div></div>` + BUTTONS.map(([k, label, , style]) => `<div class="tbtn ${k}" data-k="${k}" style="${style}">${label}</div>`).join('');
    container.appendChild(this.el);
    this.stick = this.el.querySelector('.stick') as HTMLElement;
    this.knob = this.el.querySelector('.knob') as HTMLElement;
    this.el.addEventListener('pointerdown', this.onDown, { passive: false });
    this.el.addEventListener('pointermove', this.onMove, { passive: false });
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    for (const b of this.el.querySelectorAll<HTMLElement>('.tbtn')) {
      const bit = BUTTONS.find((x) => x[0] === b.dataset.k)![2];
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.held |= bit; b.classList.add('on'); b.setPointerCapture(e.pointerId); });
      const off = () => { this.held &= ~bit; b.classList.remove('on'); };
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    }
  }

  private onDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).classList.contains('tbtn')) return;
    e.preventDefault();
    const w = this.el.clientWidth;
    const p = toLocal(e.clientX, e.clientY);
    if (p.x < w * 0.45 && this.stickId < 0) {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: p.x, y: p.y };
      this.stick.style.left = `${p.x - 60}px`; this.stick.style.top = `${p.y - 60}px`;
      this.stick.classList.add('on');
      // 빠른 재터치 = 대시
      if (performance.now() - this.lastRelease < 260) this.dashLatched = true;
      this.el.setPointerCapture(e.pointerId);
    } else if (this.camId < 0) {
      this.camId = e.pointerId; this.camLastX = p.x;
      this.el.setPointerCapture(e.pointerId);
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = toLocal(e.clientX, e.clientY);
    if (e.pointerId === this.stickId) {
      e.preventDefault();
      const dx = p.x - this.stickOrigin.x, dy = p.y - this.stickOrigin.y;
      const l = Math.hypot(dx, dy), max = 56;
      const k = l > max ? max / l : 1;
      this.vec = { x: (dx * k) / max, y: -(dy * k) / max };
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      if (l > max * 0.95) this.dashLatched = true;
    } else if (e.pointerId === this.camId) {
      this.dragPx += p.x - this.camLastX; this.camLastX = p.x;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      this.stickId = -1; this.vec = { x: 0, y: 0 }; this.dashLatched = false; this.lastRelease = performance.now();
      this.knob.style.transform = ''; this.stick.classList.remove('on');
    } else if (e.pointerId === this.camId) this.camId = -1;
  };

  read(): TouchState {
    const drag = this.dragPx; this.dragPx = 0;
    let btn = this.held;
    if (this.dashLatched && Math.hypot(this.vec.x, this.vec.y) > 0.2) btn |= BTN_DASH;
    return { x: this.vec.x, y: this.vec.y, btn, dragPx: drag };
  }

  dispose(): void { this.el.remove(); }
}
