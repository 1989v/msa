/**
 * card-dispenser — 회전판에 옆으로 꽂힌 카드 중 정면에 온 하나가 일어나는 장치.
 *
 * 프레임워크·의존성 없음(DOM + CSS 3D). 색은 `card-dispenser.css` 의 `--cd-*` 변수로만 받는다 —
 * 이 파일은 그대로 떼어 별도 패키지로 낼 수 있게 portal-fe 의 다른 모듈을 import 하지 않는다.
 *
 * 각도 하나로 움직인다: 드럼 회전 = 스크롤이 주는 `angle` + 사용자 조작(드래그·스핀)이 주는 `offset`.
 * 카드 하나의 "뽑힘 정도" p 는 정면과의 각 거리로만 정해지므로(pullAmount) 스크럽·스핀·드래그가
 * 전부 같은 layout 을 지난다. 입력 방식마다 다른 코드가 없다.
 *
 * 항목이 최소 칸 수(minCards)보다 적으면 있는 것을 돌려 가며 칸을 채운다 — 칸 s 의 항목은
 * items[s % n] 이라 뽑히는 것은 언제나 실제 항목이다.
 */

export interface DispenserOptions<T> {
  items: T[];
  /** 카드 앞면 innerHTML. 사용자 데이터는 escapeHtml 로 감싼다. 정면 근처 다섯 장에만 호출된다 */
  render: (item: T, index: number) => string;
  /** 정면 카드가 바뀔 때. 스핀 중에는 쉬고 멈춘 뒤 한 번만 온다 */
  onChange?: (item: T, index: number) => void;
  /** 최소 칸 수 — 모자라면 있는 항목을 돌려 가며 채운다 */
  minCards?: number;
  radius?: number;
  cardW?: number;
  cardH?: number;
  /** 내려다보는 각(도). 양수 */
  tilt?: number;
  /** 뽑힌 카드가 올라오는 높이 · 앞으로 나오는 거리(px) · 커지는 비율 */
  lift?: number;
  forward?: number;
  pullScale?: number;
  /** 정면 카드가 완전히 서 있는 구간의 비율 (0~1, 칸 간격 절반 기준) */
  dwell?: number;
  /** 눈금 간격. 'auto' 면 24칸 초과 시 다섯 장마다 */
  ticksEvery?: number | 'auto';
  label?: string;
}

export interface Dispenser<T> {
  /** 스크롤 등 바깥이 주는 각. offset 과 더해져 드럼 각이 된다 */
  setAngle(deg: number): void;
  rotateBy(deg: number): Promise<void>;
  /** 가장 가까운 카드를 정면에 세운다 (드래그를 놓았을 때) */
  snap(): Promise<void>;
  /** 두 바퀴 돌아 느려지며 멈춘다. 'random' 은 지금 것을 제외한 무작위 칸 */
  spinTo(target: number | 'random', ms?: number): Promise<T>;
  current(): T;
  currentIndex(): number;
  destroy(): void;
}

const DEFAULTS = {
  minCards: 0,
  radius: 130,
  cardW: 96,
  cardH: 128,
  tilt: 26,
  lift: 54,
  forward: 96,
  pullScale: 0.1,
  dwell: 0.6,
  ticksEvery: 'auto' as number | 'auto',
  label: '카드 디스펜서',
};

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** 칸 수 — 항목 수와 최소 칸 수 중 큰 쪽 */
export const slotCount = (itemCount: number, minCards = 0): number => Math.max(itemCount, minCards);

/**
 * 정면과의 각 거리 → 뽑힘 정도 (0~1).
 * 칸 간격 절반의 dwell 비율까지는 1(완전히 서 있음), 절반에서 0, 사이는 smoothstep.
 */
export const pullAmount = (angleDistance: number, step: number, dwell: number): number => {
  const half = step / 2;
  const plateau = half * dwell;
  const ad = Math.abs(angleDistance);
  let p = ad <= plateau ? 1 : ad >= half ? 0 : 1 - (ad - plateau) / (half - plateau);
  p = p * p * (3 - 2 * p);
  return p;
};

const norm = (a: number): number => ((a % 360) + 360) % 360;
const easeOut = (k: number): number => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const pad = (i: number): string => String(i + 1).padStart(2, '0');

export function createDispenser<T>(host: HTMLElement, options: DispenserOptions<T>): Dispenser<T> {
  const o = { ...DEFAULTS, ...options };
  const items = o.items;
  const n = items.length;
  if (n === 0) throw new Error('card-dispenser: items 가 비어 있다');
  const slots = slotCount(n, o.minCards);
  const step = 360 / slots;
  const itemAt = (slot: number): T => items[slot % n];
  const reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  host.classList.add('cd');
  host.style.setProperty('--cd-r', `${o.radius}px`);
  host.style.setProperty('--cd-w', `${o.cardW}px`);
  host.style.setProperty('--cd-h', `${o.cardH}px`);
  host.style.setProperty('--cd-tilt', `${o.tilt}deg`);
  host.setAttribute('tabindex', '0');
  host.setAttribute('role', 'listbox');
  host.setAttribute('aria-label', o.label);
  host.innerHTML =
    '<div class="cd-scene"><div class="cd-world"><div class="cd-disc"></div><div class="cd-hub"></div>' +
    '<div class="cd-slot"></div><div class="cd-drum"></div><div class="cd-count" aria-live="polite"></div></div></div>';
  const drum = host.querySelector<HTMLElement>('.cd-drum')!;
  const count = host.querySelector<HTMLElement>('.cd-count')!;

  const cards = Array.from({ length: slots }, (_, slot) => {
    const el = document.createElement('div');
    el.className = 'cd-card';
    el.setAttribute('role', 'option');
    el.innerHTML =
      '<div class="cd-face cd-front"></div>' +
      `<div class="cd-face cd-back"><span>${pad(slot % n)}</span></div>` +
      '<i class="cd-edge cd-edge-l"></i><i class="cd-edge cd-edge-r"></i><i class="cd-edge cd-edge-t"></i>';
    drum.appendChild(el);
    return el;
  });
  const every = o.ticksEvery === 'auto' ? (slots > 24 ? 5 : 1) : o.ticksEvery;
  for (let slot = 0; slot < slots; slot += every) {
    const tick = document.createElement('span');
    tick.className = 'cd-tick';
    tick.textContent = pad(slot % n);
    tick.style.transform = `rotateY(${slot * step}deg) translateZ(${o.radius + 46}px) rotateX(90deg)`;
    drum.appendChild(tick);
  }

  let angle = 0;
  let offset = 0;
  let current = -1;
  let anim = 0;
  let quiet = false; // 스핀 중에는 onChange 를 미룬다 — 빠르게 지나가는 제목은 읽을 수 없다
  let rendered = 0;

  const layout = () => {
    const phi = norm(angle + offset);
    drum.style.transform = `rotateY(${phi.toFixed(3)}deg)`;
    let best = -1;
    let bestD = Infinity;
    cards.forEach((el, slot) => {
      const a = norm(slot * step + phi);
      const ad = Math.min(a, 360 - a);
      if (ad < bestD) {
        bestD = ad;
        best = slot;
      }
      // 정면 근처 다섯 장 안에 들어올 때 앞면을 그린다 — 뒤쪽 카드는 내용이 안 보여도 된다
      if (!el.dataset.ready && ad < step * 5) {
        el.dataset.ready = '1';
        rendered += 1;
        el.firstElementChild!.innerHTML = o.render(itemAt(slot), slot % n);
      }
      const p = pullAmount(ad, step, o.dwell);
      el.style.transform =
        `rotateY(${slot * step}deg) translateZ(${o.radius}px) rotateY(90deg) translateY(${-o.cardH / 2}px) ` +
        `translateY(${(-o.lift * p).toFixed(2)}px) rotateY(${(-90 * p).toFixed(2)}deg) rotateX(${(o.tilt * p).toFixed(2)}deg) ` +
        `translateZ(${(o.forward * p).toFixed(2)}px) scale(${(1 + o.pullScale * p).toFixed(3)})`;
      const out = p > 0.5;
      el.classList.toggle('is-out', out);
      el.setAttribute('aria-selected', out ? 'true' : 'false');
    });
    if (best !== current) {
      current = best;
      count.textContent = `${pad(best % n)} / ${n}`;
      if (!quiet) o.onChange?.(itemAt(best), best % n);
    }
  };

  const fit = () => host.style.setProperty('--cd-s', Math.max(0.66, Math.min(1, host.clientWidth / 520)).toFixed(3));
  const stopAnim = () => {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  };
  const animateOffset = (to: number, ms: number, ease: (k: number) => number): Promise<void> =>
    new Promise((resolve) => {
      stopAnim();
      if (reducedMotion || ms === 0) {
        offset = to;
        layout();
        resolve();
        return;
      }
      const from = offset;
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        offset = from + (to - from) * ease(k);
        layout();
        if (k < 1) anim = requestAnimationFrame(tick);
        else {
          anim = 0;
          resolve();
        }
      };
      anim = requestAnimationFrame(tick);
    });
  /** 칸 slot 을 정면에 세우는 offset 중 지금 offset 에 가장 가까운 것 */
  const nearestFor = (slot: number): number => {
    const want = norm(-(slot * step) - angle);
    const k = Math.round((offset - want) / 360);
    return want + 360 * k;
  };

  const api: Dispenser<T> = {
    setAngle(a) {
      angle = a;
      layout();
    },
    rotateBy(d) {
      return animateOffset(offset + d, 320, easeOut);
    },
    snap() {
      return animateOffset(nearestFor(current), 320, easeOut);
    },
    spinTo(target, ms = 2600) {
      const slot =
        target === 'random' ? (current + 1 + Math.floor(Math.random() * (slots - 1))) % slots : target;
      quiet = true;
      return animateOffset(nearestFor(slot) - 720, ms, easeInOut).then(() => {
        quiet = false;
        o.onChange?.(itemAt(current), current % n);
        return itemAt(current);
      });
    },
    current: () => itemAt(current),
    currentIndex: () => current % n,
    destroy() {
      stopAnim();
      ro?.disconnect();
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', endDrag);
      removeEventListener('pointercancel', endDrag);
      host.innerHTML = '';
      host.classList.remove('cd');
    },
  };

  // 드래그 — 가로로 끌면 돌고, 놓으면 가장 가까운 카드에 맞춘다. 세로 스크롤은 그대로(touch-action: pan-y)
  let drag: { x: number; o: number; moved: boolean } | null = null;
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    offset = drag.o + dx * 0.45;
    layout();
  };
  const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) void api.snap();
  };
  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, o: offset, moved: false };
    stopAnim();
  });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  host.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      void api.rotateBy(-step);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      void api.rotateBy(step);
    }
  });

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(host);
  fit();
  layout();
  void rendered;
  return api;
}
