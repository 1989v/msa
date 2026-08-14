// 키 입력 · 방향 히스토리 · 모션 커맨드 인식 (백트래킹 매칭 + 입력 버퍼).

import { COMMANDS } from './moves.js';

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  KeyJ: 'lp', KeyK: 'hp', KeyL: 'jump', KeyU: 'grab',
  Space: 'guard', ShiftLeft: 'guard', ShiftRight: 'guard',
  Enter: 'start', Escape: 'pause', KeyP: 'pause', Tab: 'list', KeyH: 'list', KeyM: 'mute',
};

export const held = {};
const edge = {};            // 이번 프레임에 눌린 키
const btnFrame = {};        // 버튼별 마지막 입력 프레임 (버퍼)
const btnUsed = {};
let frame = 0;

const hist = [];            // {d, f}
let lastDir = 5;
const tapHist = { 6: [], 4: [] };

export function dirNum() {
  const l = held.left, r = held.right, u = held.up, d = held.down;
  if (u && l) return 7; if (u && r) return 9;
  if (d && l) return 1; if (d && r) return 3;
  if (u) return 8; if (d) return 2; if (l) return 4; if (r) return 6;
  return 5;
}

export function initInput(target = window) {
  target.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    held[k] = true;
    edge[k] = true;
    if (k === 'lp' || k === 'hp' || k === 'jump' || k === 'grab' || k === 'guard') {
      btnFrame[k] = frame; btnUsed[k] = false;
    }
  });
  target.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    held[k] = false;
  });
  target.addEventListener('blur', () => { for (const k in held) held[k] = false; });
}

// 입력 당시의 facing을 함께 남긴다. 모션 도중 캐릭터가 돌아서도
// 커맨드는 "모션을 시작할 때 보고 있던 방향" 기준으로 해석된다.
export function inputTick(facing = 1) {
  frame++;
  const d = dirNum();
  if (d !== lastDir) {
    hist.push({ d, f: frame, fc: facing });
    if (hist.length > 28) hist.shift();
    if (d === 6 || d === 4) {
      const t = tapHist[d];
      t.push(frame);
      if (t.length > 2) t.shift();
    }
    lastDir = d;
  }
}
export function endFrame() { for (const k in edge) edge[k] = false; }

export const pressed = (k) => !!edge[k];
export const frameNo = () => frame;

/** 버퍼된 버튼 입력 소비 (lenience 프레임 내) */
export function consume(k, lenience = 6) {
  if (btnUsed[k]) return false;
  const f = btnFrame[k];
  if (f === undefined || frame - f > lenience) return false;
  btnUsed[k] = true;
  return true;
}
export function buffered(k, lenience = 6) {
  const f = btnFrame[k];
  return !btnUsed[k] && f !== undefined && frame - f <= lenience;
}
export function clearBuffer() { for (const k in btnFrame) btnUsed[k] = true; }

/** 앞방향 더블탭(대시) 감지 */
export function dashTap(facing) {
  const dir = facing > 0 ? 6 : 4;
  const t = tapHist[dir];
  if (t.length === 2 && t[1] - t[0] <= 15 && frame - t[1] <= 4) {
    t.length = 0;
    return true;
  }
  return false;
}

// 좌우 반전 (facing 기준 정규화)
const MIRROR = { 1: 3, 2: 2, 3: 1, 4: 6, 5: 5, 6: 4, 7: 9, 8: 8, 9: 7 };
const rel = (d, facing) => (facing > 0 ? d : MIRROR[d]);

function matchSeq(seq, window, maxSkip, F) {
  const minF = frame - window;
  const walk = (si, hi) => {
    if (si < 0) return true;
    const step = seq[si];
    const want = step[0], opt = step[1];
    let skipped = 0;
    for (let k = hi; k >= 0; k--) {
      const h = hist[k];
      if (h.f < minF) break;
      if (rel(h.d, F) === want) {
        if (walk(si - 1, k - 1)) return true;
      } else if (++skipped > maxSkip) break;
    }
    return opt ? walk(si - 1, hi) : false;
  };
  return walk(seq.length - 1, hist.length - 1);
}

/** window 프레임 안에서 가장 오래된 입력의 facing = 모션을 시작할 때 보던 방향 */
function startFacing(window, fallback) {
  const minF = frame - window;
  for (let i = 0; i < hist.length; i++) if (hist[i].f >= minF) return hist[i].fc;
  return fallback;
}

/**
 * 눌린 공격 버튼 + 방향 히스토리로 커맨드 기술을 판정한다.
 * 어려운(우선순위 높은) 커맨드부터 검사.
 * @returns {{id:string, btn:string}|null}
 */
export function detectCommand(canUseHidden, facing = 1) {
  for (const cmd of COMMANDS) {
    if (cmd.hidden && !canUseHidden) continue;
    let btn = null;
    for (const b of cmd.btns) if (buffered(b, 5)) { btn = b; break; }
    if (!btn) continue;
    const skip = cmd.skip ?? 2;
    const f0 = startFacing(cmd.window, facing);
    if (matchSeq(cmd.seq, cmd.window, skip, f0)
      || (f0 !== facing && matchSeq(cmd.seq, cmd.window, skip, facing))) {
      btnUsed[btn] = true;
      return { id: cmd.id, btn };
    }
  }
  return null;
}

/** 디버그/자동검증용 — 히스토리 스냅샷 */
export function debugHistory() {
  return hist.slice(-12).map((h) => `${h.d}${h.fc > 0 ? '>' : '<'}@${h.f}`).join(' ');
}
