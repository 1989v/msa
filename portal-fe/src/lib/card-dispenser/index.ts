/**
 * card-dispenser — 회전판에 옆으로 꽂힌 카드 중 정면에 온 하나가 일어나는 장치.
 *
 * 프레임워크·의존성 없음(DOM + CSS 3D). 색은 `card-dispenser.css` 의 `--cd-*` 변수로만 받는다.
 *
 * 각도 하나로 움직인다: 드럼 회전 = 스크롤이 주는 `angle` + 사용자 조작(드래그·스핀)이 주는 `offset`.
 * 카드 하나의 "뽑힘 정도" p 는 정면과의 각 거리로만 정해지므로(pullAmount) 스크럽·스핀·드래그가
 * 전부 같은 layout 을 지난다. 입력 방식마다 다른 코드가 없다.
 *
 * 두 단계다. 판이 **움직이는 동안**에는 정면을 지나는 카드가 덱에서 살짝 위로 밀려 올라오기만 하고(peek),
 * 판이 **멈춘 뒤**(스핀 종료·스냅·스크롤 정지)에야 정면 카드가 완전히 나와 얼굴을 보인다(reveal).
 * 룰렛이 돌 때마다 카드가 통째로 튀어나오면 무엇이 뽑혔는지가 아니라 움직임만 보인다.
 *
 * 항목이 최소 칸 수(minCards)보다 적으면 있는 것을 돌려 가며 칸을 채운다 — 칸 s 의 항목은
 * items[s % n] 이라 뽑히는 것은 언제나 실제 항목이다.
 */

export interface DispenserOptions<T> {
  items: T[];
  /** 카드 앞면 innerHTML. 사용자 데이터는 escapeHtml 로 감싼다. 정면 다섯 칸 안에 들어올 때 한 번 호출된다 */
  render: (item: T, index: number) => string;
  /** 정면 카드가 바뀔 때. 스핀 중에는 쉬고 멈춘 뒤 한 번만 온다 */
  onChange?: (item: T, index: number) => void;
  /** 완전히 일어난 정면 카드를 탭·클릭하거나 Enter 를 눌렀을 때 — 링크로 보내는 자리 */
  onActivate?: (item: T, index: number) => void;
  /** 최소 칸 수 — 모자라면 있는 항목을 돌려 가며 채운다 */
  minCards?: number;
  radius?: number;
  cardW?: number;
  cardH?: number;
  /** 내려다보는 각(도). 양수 */
  tilt?: number;
  /** 완전히 일어났을 때 올라오는 높이 · 앞으로 나오는 거리(px) · 커지는 비율 */
  lift?: number;
  forward?: number;
  pullScale?: number;
  /** 판이 움직이는 동안 정면 카드가 덱에서 살짝 올라오는 높이(px) */
  peek?: number;
  /**
   * peek 이 걸리는 폭(칸 수). 정면 ±이만큼의 카드가 함께 올라왔다 내려간다.
   *
   * 이 값이 작으면 한 번에 한 장만 올라오는데, 스핀은 한 칸을 수십 ms 만에 지나가므로 **눈에 안 보인다**
   * (실측: 스핀 중 올라온 카드 중앙값 1장). 여러 장이 함께 올라와야 물결이 판을 도는 것으로 읽힌다.
   */
  peekSpread?: number;
  /** 멈춘 뒤 완전히 일어나는 데 걸리는 시간(ms). 0 이면 즉시 */
  revealMs?: number;
  /** setAngle(스크롤)이 이만큼 조용하면 멈춘 것으로 보고 일어난다(ms) */
  idleMs?: number;
  /** 정면 카드가 완전히 서 있는 구간의 비율 (0~1, 칸 간격 절반 기준) */
  dwell?: number;
  /**
   * 그림을 넣을 범위(칸 수) — `render()` 가 낸 `.cd-photo[data-src]` 는 정면 ±이만큼에 들어오고
   * **판이 멈춘 뒤에야** 실제 주소가 붙는다. 그 전에는 요청 자체가 나가지 않는다.
   *
   * 판이 돌 때마다 모든 카드가 정면을 지나므로, 그냥 두면 스핀 한 번에 전 카드의 그림을 내려받는다
   * (실측: 18장 → 49장). 옆으로 선 카드의 그림은 어차피 보이지 않는다.
   */
  photoSteps?: number;
  /** 눈금 간격. 'auto' 면 24칸 초과 시 다섯 장마다 */
  ticksEvery?: number | 'auto';
  /**
   * 라이트 모드 — 정면에서 nearSteps 칸 밖의 카드는 보이는 면 하나와 옆면 하나, 요소 둘만 남긴다.
   * 카드 한 장이 3D 요소 다섯 개라 판 하나가 수백 레이어가 되는데, 모바일 GPU 는 그걸 못 견딘다(실측: 레이어 530개·418MB).
   */
  lite?: boolean;
  nearSteps?: number;
  label?: string;
}

export interface Dispenser<T> {
  /** 스크롤 등 바깥이 주는 각. offset 과 더해져 드럼 각이 된다. 바뀌면 카드가 내려앉고, idleMs 뒤 다시 일어난다 */
  setAngle(deg: number): void;
  rotateBy(deg: number): Promise<void>;
  /** 가장 가까운 카드를 정면에 세우고 일으킨다 (드래그를 놓았을 때) */
  snap(): Promise<void>;
  /** 두 바퀴 돌아 느려지며 멈추고, 멈춘 카드가 일어난 뒤 resolve 한다. 'random' 은 지금 것을 제외한 무작위 칸 */
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
  peek: 18,
  revealMs: 360,
  idleMs: 260,
  dwell: 0.6,
  peekSpread: 2.4,
  photoSteps: 2,
  ticksEvery: 'auto' as number | 'auto',
  lite: false,
  nearSteps: 7,
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

/**
 * 정면과의 각 거리 → peek 정도 (0~1). [pullAmount] 보다 **넓은** 창을 쓴다.
 * spread 칸에서 0, 정면에서 1, 사이는 smoothstep — 여러 장이 함께 올라와 물결로 보인다.
 */
export const peekAmount = (angleDistance: number, step: number, spread: number): number => {
  const span = step * spread;
  if (span <= 0) return 0;
  const ad = Math.abs(angleDistance);
  if (ad >= span) return 0;
  const k = 1 - ad / span;
  return k * k * (3 - 2 * k);
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
  const instant = reducedMotion || o.revealMs === 0;

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
  let reveal = 1; // 0 = 살짝 올라온 상태(peek), 1 = 완전히 일어난 상태. 멈춰 있을 때만 1
  let revealAnim = 0;
  let idleTimer: ReturnType<typeof setTimeout> | 0 = 0;
  // 움직이는 동안만 will-change 를 건다 — 카드 수백 장을 늘 레이어로 올려 두면 모바일 스크롤이 버벅인다
  let live = 0;
  const setLive = (on: boolean) => {
    live += on ? 1 : -1;
    host.classList.toggle('is-live', live > 0);
  };

  /** `.cd-photo[data-src]` 에 실제 주소를 붙인다. 한 번 붙으면 data-src 를 지워 다시 받지 않는다 */
  const hydratePhotos = (card: HTMLElement) => {
    const holes = card.querySelectorAll<HTMLElement>('.cd-photo[data-src]');
    for (const hole of holes) {
      const src = hole.dataset.src;
      hole.removeAttribute('data-src');
      if (src) hole.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
    }
  };

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
      // 정면 다섯 칸 안에 들어올 때 앞면을 그린다 — 뒤쪽 카드는 내용이 안 보여도 된다
      if (!el.dataset.ready && ad < step * 5) {
        el.dataset.ready = '1';
        el.firstElementChild!.innerHTML = o.render(itemAt(slot), slot % n);
      }
      const p = pullAmount(ad, step, o.dwell);
      // r: 완전히 일어나는 정도. 움직이는 동안(reveal 0)은 peek 만큼만 올라온다
      const r = p * reveal;
      // 움직이는 동안에만 넓은 물결이 걸린다 — 멈추면(reveal 1) 정면 한 장만 일어나는 원래 모습으로 돌아간다
      const pk = peekAmount(ad, step, o.peekSpread) * (1 - reveal);
      const lift = o.peek * Math.max(pk, p) + (o.lift - o.peek) * r;
      // 그림은 멈춘 뒤, 정면 가까이에서만 붙인다 — 스핀 중에는 요청이 나가지 않는다
      if (reveal > 0.98 && ad <= step * o.photoSteps) hydratePhotos(el);
      el.style.transform =
        `rotateY(${slot * step}deg) translateZ(${o.radius}px) rotateY(90deg) translateY(${-o.cardH / 2}px) ` +
        `translateY(${(-lift).toFixed(2)}px) rotateY(${(-90 * r).toFixed(2)}deg) rotateX(${(o.tilt * r).toFixed(2)}deg) ` +
        `translateZ(${(o.forward * r).toFixed(2)}px) scale(${(1 + o.pullScale * r).toFixed(3)})`;
      const out = r > 0.5;
      el.classList.toggle('is-out', out);
      el.classList.toggle('is-peek', p > 0.5 && !out);
      if (o.lite) {
        const far = ad > step * o.nearSteps;
        el.classList.toggle('is-far', far);
        // 먼 카드는 보이는 면 하나만 남긴다. 앞면 법선이 (cos a, 0, −sin a) 라 왼쪽 호(a > 180°)에서만 앞면이
        // 보이고 오른쪽 호에서는 뒷면이 보인다 — 눈 거리·기울기·원근 원점과 무관하게 부호는 sin a 가 정한다.
        el.classList.toggle('is-far-front', far && a > 180);
        el.classList.toggle('is-far-back', far && a < 180);
      }
      el.setAttribute('aria-selected', p > 0.5 ? 'true' : 'false');
    });
    if (best !== current) {
      current = best;
      count.textContent = `${pad(best % n)} / ${n}`;
      if (!quiet) o.onChange?.(itemAt(best), best % n);
    }
  };

  const fit = () => host.style.setProperty('--cd-s', Math.max(0.66, Math.min(1, host.clientWidth / 520)).toFixed(3));
  const stopAnim = () => {
    if (anim) {
      cancelAnimationFrame(anim);
      setLive(false);
    }
    anim = 0;
  };
  const stopReveal = () => {
    if (revealAnim) {
      cancelAnimationFrame(revealAnim);
      setLive(false);
    }
    revealAnim = 0;
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
      setLive(true);
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        offset = from + (to - from) * ease(k);
        layout();
        if (k < 1) anim = requestAnimationFrame(tick);
        else {
          anim = 0;
          setLive(false);
          resolve();
        }
      };
      anim = requestAnimationFrame(tick);
    });
  /** reveal 을 to 로 — 멈추면 1(일어남), 움직이기 시작하면 0(내려앉음) */
  const tweenReveal = (to: number, ms: number): Promise<void> =>
    new Promise((resolve) => {
      stopReveal();
      if (instant || ms === 0 || reveal === to) {
        reveal = to;
        layout();
        resolve();
        return;
      }
      const from = reveal;
      const t0 = performance.now();
      setLive(true);
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        reveal = from + (to - from) * easeOut(k);
        layout();
        if (k < 1) revealAnim = requestAnimationFrame(tick);
        else {
          revealAnim = 0;
          setLive(false);
          resolve();
        }
      };
      revealAnim = requestAnimationFrame(tick);
    });
  /** 움직이기 시작 — 일어나 있던 카드가 빠르게 내려앉아 덱에 꽂힌다 */
  const unsettle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = 0;
    if (reveal > 0 || revealAnim) void tweenReveal(0, 120);
  };
  /** 멈춤 — 정면 카드가 완전히 일어난다 */
  const settle = () => tweenReveal(1, o.revealMs);
  /** 칸 slot 을 정면에 세우는 offset 중 지금 offset 에 가장 가까운 것 */
  const nearestFor = (slot: number): number => {
    const want = norm(-(slot * step) - angle);
    const k = Math.round((offset - want) / 360);
    return want + 360 * k;
  };

  const api: Dispenser<T> = {
    setAngle(a) {
      if (a === angle) return;
      angle = a;
      unsettle();
      layout();
      // 스크롤이 조용해지면 멈춘 것이다 — 그때 일어난다
      idleTimer = setTimeout(() => {
        idleTimer = 0;
        void settle();
      }, o.idleMs);
    },
    rotateBy(d) {
      unsettle();
      return animateOffset(offset + d, 320, easeOut).then(settle);
    },
    snap() {
      return animateOffset(nearestFor(current), 320, easeOut).then(settle);
    },
    spinTo(target, ms = 2600) {
      const slot =
        target === 'random' ? (current + 1 + Math.floor(Math.random() * (slots - 1))) % slots : target;
      quiet = true;
      unsettle();
      return animateOffset(nearestFor(slot) - 720, ms, easeInOut)
        .then(settle)
        .then(() => {
          quiet = false;
          o.onChange?.(itemAt(current), current % n);
          return itemAt(current);
        });
    },
    current: () => itemAt(current),
    currentIndex: () => current % n,
    destroy() {
      stopAnim();
      stopReveal();
      if (idleTimer) clearTimeout(idleTimer);
      ro?.disconnect();
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', endDrag);
      removeEventListener('pointercancel', endDrag);
      host.innerHTML = '';
      host.classList.remove('cd');
    },
  };

  // 드래그 — 가로로 끌면 돌고, 놓으면 가장 가까운 카드에 맞춰 세운다. 세로 스크롤은 그대로(touch-action: pan-y)
  let drag: { x: number; o: number; moved: boolean } | null = null;
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4 && !drag.moved) {
      drag.moved = true;
      unsettle();
    }
    if (!drag.moved) return;
    offset = drag.o + dx * 0.45;
    layout();
  };
  const activate = () => {
    if (reveal < 1 || current < 0) return;
    o.onActivate?.(itemAt(current), current % n);
  };
  const endDrag = (e?: Event) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      void api.snap();
      return;
    }
    // 끌지 않고 뗐다 — 일어난 카드 위였으면 그 카드를 고른 것이다
    const target = e?.target instanceof Element ? e.target.closest('.cd-card.is-out') : null;
    if (e?.type === 'pointerup' && target && host.contains(target)) activate();
  };
  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || quiet) return; // 스핀 중에는 잡지 않는다 — 끊으면 멈춘 자리에서 일어나지 못한다
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
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(host);
  fit();
  layout();
  return api;
}
