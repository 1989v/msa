// 터치 조작: 왼쪽 가상 스틱 + 오른쪽 버튼 4+1, 남는 오른쪽 영역 드래그는 카메라.
import { BTN_ATTACK, BTN_JUMP, BTN_GUARD, BTN_SPECIAL, BTN_DASH, BTN_PICKUP } from '@amp/shared';

export interface TouchState { x: number; y: number; btn: number; dragPx: number }

const BUTTONS: [string, string, number, string][] = [
  ['atk', '공격', BTN_ATTACK, 'right:104px;bottom:60px;width:88px;height:88px;font-size:18px'],
  ['jump', '점프', BTN_JUMP, 'right:24px;bottom:118px;width:66px;height:66px'],
  ['guard', '가드', BTN_GUARD, 'right:196px;bottom:34px;width:66px;height:66px'],
  ['special', '기술', BTN_SPECIAL, 'right:150px;bottom:150px;width:66px;height:66px'],
  ['pickup', '줍기', BTN_PICKUP, 'right:30px;bottom:200px;width:52px;height:52px;font-size:12px'],
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
    if (e.clientX < w * 0.45 && this.stickId < 0) {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.stick.style.left = `${e.clientX - 60}px`; this.stick.style.top = `${e.clientY - 60}px`;
      this.stick.classList.add('on');
      // 빠른 재터치 = 대시
      if (performance.now() - this.lastRelease < 260) this.dashLatched = true;
      this.el.setPointerCapture(e.pointerId);
    } else if (this.camId < 0) {
      this.camId = e.pointerId; this.camLastX = e.clientX;
      this.el.setPointerCapture(e.pointerId);
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      e.preventDefault();
      const dx = e.clientX - this.stickOrigin.x, dy = e.clientY - this.stickOrigin.y;
      const l = Math.hypot(dx, dy), max = 56;
      const k = l > max ? max / l : 1;
      this.vec = { x: (dx * k) / max, y: -(dy * k) / max };
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      if (l > max * 0.95) this.dashLatched = true;
    } else if (e.pointerId === this.camId) {
      this.dragPx += e.clientX - this.camLastX; this.camLastX = e.clientX;
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
