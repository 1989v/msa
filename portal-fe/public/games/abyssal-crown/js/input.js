// Keyboard-only input. Bindings key off `event.code` so a Hangul IME layout
// still maps J/K/L correctly.

const down = new Set();
const pressedThisFrame = new Set();
const releasedThisFrame = new Set();
const buffer = Object.create(null); // action -> timestamp of last press

export const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', 'KeyZ'],
  special: ['KeyK', 'KeyX'],
  cast: ['KeyL', 'KeyC'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'],
  confirm: ['Enter', 'KeyJ', 'KeyZ', 'Space'],
  cancel: ['Escape', 'KeyX', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  respec: ['KeyR'],
};

const codeToActions = Object.create(null);
for (const [action, codes] of Object.entries(BINDINGS)) {
  for (const c of codes) (codeToActions[c] ||= []).push(action);
}

const PREVENT = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Backspace',
]);

let anyKeyFlag = false;

export function initInput(target = window) {
  target.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    pressedThisFrame.add(e.code);
    anyKeyFlag = true;
    const acts = codeToActions[e.code];
    if (acts) for (const a of acts) buffer[a] = performance.now();
  });
  target.addEventListener('keyup', (e) => {
    down.delete(e.code);
    releasedThisFrame.add(e.code);
  });
  target.addEventListener('blur', () => { down.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) down.clear(); });
}

export function endFrame() {
  pressedThisFrame.clear();
  releasedThisFrame.clear();
  anyKeyFlag = false;
}

export function isDown(action) {
  const codes = BINDINGS[action];
  if (!codes) return false;
  for (const c of codes) if (down.has(c)) return true;
  return false;
}

export function justPressed(action) {
  const codes = BINDINGS[action];
  if (!codes) return false;
  for (const c of codes) if (pressedThisFrame.has(c)) return true;
  return false;
}

export function anyKey() { return anyKeyFlag; }

/**
 * Input buffering: an action counts as "requested" for `windowMs` after the press,
 * so a dash queued during attack recovery still fires. Consuming clears it.
 */
export function buffered(action, windowMs = 160) {
  const t = buffer[action];
  return t !== undefined && performance.now() - t <= windowMs;
}
export function consumeBuffer(action) { delete buffer[action]; }
export function clearBuffers() { for (const k in buffer) delete buffer[k]; }

/** Normalised movement vector with a proper diagonal magnitude of 1. */
export function moveVector() {
  let x = 0, y = 0;
  if (isDown('left')) x -= 1;
  if (isDown('right')) x += 1;
  if (isDown('up')) y -= 1;
  if (isDown('down')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    x *= inv; y *= inv;
  }
  return { x, y, len: Math.hypot(x, y) };
}

/** Menu navigation helper: returns -1 / 0 / +1 on the requested axis this frame. */
export function menuAxis(axis = 'x') {
  if (axis === 'x') {
    const l = justPressed('left'), r = justPressed('right');
    return l && !r ? -1 : r && !l ? 1 : 0;
  }
  const u = justPressed('up'), d = justPressed('down');
  return u && !d ? -1 : d && !u ? 1 : 0;
}
