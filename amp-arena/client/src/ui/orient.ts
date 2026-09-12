// 가로 화면 강제 — 터치 기기가 세로일 때 앱 뿌리(#app)를 90° 돌려 가로 게임으로 만든다.
// 안드로이드 크롬은 전체화면 안에서 screen.orientation.lock('landscape') 가 되지만 iOS 는 안 되므로 CSS 회전이 최종 수단이다.
// 회전 중에는 터치 좌표가 화면 기준이라 게임 좌표로 바꿔야 한다 — TouchPad 가 `isRotated()` 로 판단해 (dx, dy) → (dy, -dx) 로 돌린다.
let rotated = false;
let root: HTMLElement | null = null;

export const isRotated = (): boolean => rotated;

function portraitTouch(): boolean {
  const touch = (navigator.maxTouchPoints ?? 0) > 0 && matchMedia('(pointer: coarse)').matches;
  const forced = new URLSearchParams(location.search).get('rotate') === '1';
  return (touch || forced) && window.innerHeight > window.innerWidth;
}

function apply(): void {
  if (!root) return;
  const want = portraitTouch();
  if (want === rotated) { if (rotated) size(); return; }
  rotated = want;
  root.classList.toggle('rotated', rotated);
  if (rotated) size(); else { root.style.width = ''; root.style.height = ''; }
  window.dispatchEvent(new Event('resize')); // 렌더러가 캔버스 크기를 다시 잰다
}

/** 회전한 뿌리의 크기 = 화면을 눕힌 크기 (가로 = innerHeight, 세로 = innerWidth) */
function size(): void {
  if (!root) return;
  root.style.width = `${window.innerHeight}px`;
  root.style.height = `${window.innerWidth}px`;
}

export function installForcedLandscape(el: HTMLElement): void {
  root = el;
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 50));
  document.addEventListener('fullscreenchange', () => setTimeout(apply, 50));
}

/** 전체화면에 들어간 뒤 가로 고정을 시도한다 (안드로이드). 안 되면 CSS 회전이 맡는다. */
export async function tryLockLandscape(): Promise<boolean> {
  const o = screen.orientation as ScreenOrientation & { lock?: (m: string) => Promise<void> };
  if (!o || typeof o.lock !== 'function') return false;
  try { await o.lock('landscape'); return true; } catch { return false; }
}
