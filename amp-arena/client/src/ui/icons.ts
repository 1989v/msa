// 선 아이콘 (24px 그리드) — 시안과 같은 경로
const PATHS: Record<string, string> = {
  sword: 'M4 20 L14 10 M12 4 L20 12 L16 16 L8 8 Z M6 14 L10 18',
  spear: 'M3 21 L18 6 M15 3 L21 3 L21 9 M13 11 L17 7',
  pistol: 'M3 9 L18 9 L18 13 L10 13 L10 17 L6 17 L6 13 L3 13 Z M18 11 L21 11',
  shield: 'M12 3 L20 6 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V6 Z',
  glove: 'M7 11 V6 A2 2 0 0 1 11 6 V11 M11 9 V5 A2 2 0 0 1 15 5 V11 M15 10 V7 A2 2 0 0 1 19 7 V14 A6 6 0 0 1 13 20 H11 A5 5 0 0 1 6 15 V11',
  fist: 'M6 12 V8 A2 2 0 0 1 10 8 V12 M10 10 V6 A2 2 0 0 1 14 6 V12 M14 9 V7 A2 2 0 0 1 18 7 V14 A5 5 0 0 1 13 19 H11 A5 5 0 0 1 6 14 V12 M6 13 L3 11',
  bolt: 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z',
  crown: 'M3 8 L8 12 L12 5 L16 12 L21 8 L19 18 H5 Z',
  plus: 'M12 5 V19 M5 12 H19',
  door: 'M14 4 H19 V20 H14 M10 8 L6 12 L10 16 M6 12 H15',
  refresh: 'M20 12 A8 8 0 1 1 17.5 6.2 M20 4 V9 H15',
  lock: 'M6 11 H18 V21 H6 Z M8 11 V8 A4 4 0 0 1 16 8 V11',
  users: 'M9 12 A4 4 0 1 0 9 4 A4 4 0 0 0 9 12 Z M3 21 V19 A5 5 0 0 1 8 14 H10 A5 5 0 0 1 15 19 V21 M16 4 A4 4 0 0 1 16 12 M21 21 V19 A5 5 0 0 0 17.5 14.2',
  gamepad: 'M7 8 H17 A5 5 0 0 1 21 14 L20 17 A2 2 0 0 1 16.5 17.5 L15 15 H9 L7.5 17.5 A2 2 0 0 1 4 17 L3 14 A5 5 0 0 1 7 8 Z',
  keyboard: 'M3 6 H21 V18 H3 Z M7 10 H7.01 M11 10 H11.01 M15 10 H15.01 M7 14 H17',
  arrowRight: 'M5 12 H19 M13 6 L19 12 L13 18',
};

export const ACC_ICON: Record<string, string> = { none: 'fist', greatsword: 'sword', spear: 'spear', pistols: 'pistol', shield: 'shield', rocket: 'glove' };

export function icon(name: string, size = 20, color = 'currentColor', sw = 2): string {
  const d = PATHS[name] ?? PATHS.bolt;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block;flex:none;fill:none;stroke:${color};stroke-width:${sw}px;stroke-linecap:round;stroke-linejoin:round" aria-hidden="true"><path d="${d}"></path></svg>`;
}

export function boltLogo(size = 30): string {
  return `<div class="logo display" style="font-size:${size}px"><span class="amp">AMP</span><svg class="bolt" viewBox="0 0 24 24" style="fill:#ff6a2a;stroke:#ffb020;stroke-width:2.4px;stroke-linejoin:round"><path d="${PATHS.bolt}"></path></svg><span class="arena">ARENA</span></div>`;
}
