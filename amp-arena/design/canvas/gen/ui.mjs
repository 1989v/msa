// UI 부품 — 패널·버튼·바·아이콘. 전부 인라인 스타일 HTML 문자열.
import { T } from './tokens.mjs';

const ICON_PATHS = {
  sword: 'M4 20 L14 10 M12 4 L20 12 L16 16 L8 8 Z M6 14 L10 18',
  spear: 'M3 21 L18 6 M15 3 L21 3 L21 9 M13 11 L17 7',
  pistol: 'M3 9 L18 9 L18 13 L10 13 L10 17 L6 17 L6 13 L3 13 Z M18 11 L21 11',
  shield: 'M12 3 L20 6 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V6 Z',
  glove: 'M7 11 V6 A2 2 0 0 1 11 6 V11 M11 9 V5 A2 2 0 0 1 15 5 V11 M15 10 V7 A2 2 0 0 1 19 7 V14 A6 6 0 0 1 13 20 H11 A5 5 0 0 1 6 15 V11',
  fist: 'M6 12 V8 A2 2 0 0 1 10 8 V12 M10 10 V6 A2 2 0 0 1 14 6 V12 M14 9 V7 A2 2 0 0 1 18 7 V14 A5 5 0 0 1 13 19 H11 A5 5 0 0 1 6 14 V12 M6 13 L3 11',
  clock: 'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M12 7 V12 L15 14',
  users: 'M9 12 A4 4 0 1 0 9 4 A4 4 0 0 0 9 12 Z M3 21 V19 A5 5 0 0 1 8 14 H10 A5 5 0 0 1 15 19 V21 M16 4 A4 4 0 0 1 16 12 M21 21 V19 A5 5 0 0 0 17.5 14.2',
  map: 'M3 6 L9 3 L15 6 L21 3 V18 L15 21 L9 18 L3 21 Z M9 3 V18 M15 6 V21',
  chat: 'M4 5 H20 V16 H10 L6 20 V16 H4 Z',
  crown: 'M3 8 L8 12 L12 5 L16 12 L21 8 L19 18 H5 Z',
  skull: 'M12 3 A7 7 0 0 0 5 10 V14 L8 16 V20 H16 V16 L19 14 V10 A7 7 0 0 0 12 3 Z M9 11 A1.5 1.5 0 1 0 9 8 A1.5 1.5 0 0 0 9 11 Z M15 11 A1.5 1.5 0 1 0 15 8 A1.5 1.5 0 0 0 15 11 Z',
  heart: 'M12 20 L4.5 12.5 A4 4 0 0 1 12 7 A4 4 0 0 1 19.5 12.5 Z',
  bomb: 'M10 21 A7 7 0 1 0 10 7 A7 7 0 0 0 10 21 Z M15 9 L18 6 M18 6 L21 3 M17 3 L20 5',
  box: 'M3 8 L12 3 L21 8 V16 L12 21 L3 16 Z M3 8 L12 13 L21 8 M12 13 V21',
  lock: 'M6 11 H18 V21 H6 Z M8 11 V8 A4 4 0 0 1 16 8 V11',
  gamepad: 'M7 8 H17 A5 5 0 0 1 21 14 L20 17 A2 2 0 0 1 16.5 17.5 L15 15 H9 L7.5 17.5 A2 2 0 0 1 4 17 L3 14 A5 5 0 0 1 7 8 Z M8 11 V14 M6.5 12.5 H9.5 M16 12 H16.01 M18 13.5 H18.01',
  refresh: 'M20 12 A8 8 0 1 1 17.5 6.2 M20 4 V9 H15',
  plus: 'M12 5 V19 M5 12 H19',
  check: 'M5 12 L10 17 L19 8',
  flag: 'M5 21 V4 H18 L15 8 L18 12 H5',
  signal: 'M4 18 V14 M9 18 V10 M14 18 V6 M19 18 V3',
  arrowUp: 'M12 19 V5 M6 11 L12 5 L18 11',
  arrowDown: 'M12 5 V19 M6 13 L12 19 L18 13',
  arrowLeft: 'M19 12 H5 M11 6 L5 12 L11 18',
  arrowRight: 'M5 12 H19 M13 6 L19 12 L13 18',
  bolt: 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z',
  keyboard: 'M3 6 H21 V18 H3 Z M7 10 H7.01 M11 10 H11.01 M15 10 H15.01 M7 14 H17',
  mouse: 'M12 3 A6 6 0 0 1 18 9 V15 A6 6 0 0 1 6 15 V9 A6 6 0 0 1 12 3 Z M12 3 V10',
  eye: 'M2 12 C5 6 9 4 12 4 C15 4 19 6 22 12 C19 18 15 20 12 20 C9 20 5 18 2 12 Z M12 15 A3 3 0 1 0 12 9 A3 3 0 0 0 12 15 Z',
  camera: 'M4 7 H8 L10 4 H14 L16 7 H20 V19 H4 Z M12 16 A3.5 3.5 0 1 0 12 9 A3.5 3.5 0 0 0 12 16 Z',
  server: 'M4 4 H20 V10 H4 Z M4 14 H20 V20 H4 Z M8 7 H8.01 M8 17 H8.01',
  globe: 'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M3 12 H21 M12 3 C15 6 15 18 12 21 C9 18 9 6 12 3',
  door: 'M4 21 V3 H16 V21 M16 3 L20 5 V21 M13 12 H13.01',
  door2: 'M14 4 H19 V20 H14 M10 8 L6 12 L10 16 M6 12 H15',
  target: 'M12 21 A9 9 0 1 0 12 3 A9 9 0 0 0 12 21 Z M12 16 A4 4 0 1 0 12 8 A4 4 0 0 0 12 8 Z M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21',
  settings: 'M12 15 A3 3 0 1 0 12 9 A3 3 0 0 0 12 15 Z M19 12 L21 10.5 L19.5 7.5 L17 8 L15.5 6.5 L15 4 H9 L8.5 6.5 L7 8 L4.5 7.5 L3 10.5 L5 12 L3 13.5 L4.5 16.5 L7 16 L8.5 17.5 L9 20 H15 L15.5 17.5 L17 16 L19.5 16.5 L21 13.5 Z',
};

export function icon(name, size = 20, color = 'currentColor', sw = 2) {
  const d = ICON_PATHS[name] ?? ICON_PATHS.target;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block;flex:none;fill:none;stroke:${color};stroke-width:${sw}px;stroke-linecap:round;stroke-linejoin:round" xmlns="http://www.w3.org/2000/svg"><path d="${d}"></path></svg>`;
}

/** 두꺼운 외곽선 패널. */
export function panel(inner, { w = 'auto', h = 'auto', pad = 14, bg = T.panel, radius = 10, extra = '', border = T.line2 } = {}) {
  return `<div style="width:${typeof w === 'number' ? w + 'px' : w};height:${typeof h === 'number' ? h + 'px' : h};padding:${pad}px;background:${bg};border:2px solid ${border};border-radius:${radius}px;box-shadow:0 4px 0 ${T.bg2};${extra}">${inner}</div>`;
}

export function label(text, { size = 12, color = T.muted, weight = 700, extra = '' } = {}) {
  return `<div style="font-size:${size}px;color:${color};font-weight:${weight};letter-spacing:0.06em;text-transform:uppercase;${extra}">${text}</div>`;
}

export function button(text, { kind = 'primary', w = 'auto', h = 44, size = 16, iconName = null } = {}) {
  const bg = kind === 'primary' ? T.amp : kind === 'danger' ? T.red : kind === 'ghost' ? 'transparent' : T.panel3;
  const fg = kind === 'primary' ? T.outline : T.ink;
  const border = kind === 'primary' ? T.amp : kind === 'ghost' ? T.line2 : T.line2;
  const shadow = kind === 'primary' ? '#b8760a' : T.bg2;
  return `<div style="display:flex;align-items:center;justify-content:center;gap:8px;width:${typeof w === 'number' ? w + 'px' : w};height:${h}px;padding:0 20px;background:${bg};color:${fg};border:2px solid ${border};border-radius:10px;box-shadow:0 4px 0 ${shadow};font-weight:800;font-size:${size}px;white-space:nowrap">${iconName ? icon(iconName, size + 2, fg, 2.4) : ''}<span>${text}</span></div>`;
}

export function bar(pct, { w = 200, h = 12, color = T.green, bg = T.bg2, radius = 6, border = true } = {}) {
  return `<div style="width:${w}px;height:${h}px;background:${bg};border-radius:${radius}px;${border ? `border:2px solid ${T.outline};` : ''}overflow:hidden;flex:none"><div style="width:${pct}%;height:100%;background:${color}"></div></div>`;
}

export function hpColor(pct) {
  return pct > 50 ? T.green : pct > 25 ? T.amp : T.red;
}

/** 키캡. */
export function key(text, { w = 30, h = 30, size = 13 } = {}) {
  return `<div style="display:inline-flex;align-items:center;justify-content:center;min-width:${w}px;height:${h}px;padding:0 8px;background:${T.ink};color:${T.outline};border:2px solid ${T.outline};border-bottom-width:5px;border-radius:7px;font-weight:800;font-size:${size}px;font-family:'Gothic A1',sans-serif;flex:none">${text}</div>`;
}

export function chip(text, { color = T.amp, fg = T.outline, size = 12 } = {}) {
  return `<div style="display:inline-flex;align-items:center;height:24px;padding:0 10px;background:${color};color:${fg};border-radius:12px;font-weight:800;font-size:${size}px;flex:none">${text}</div>`;
}

export function row(children, { gap = 10, align = 'center', justify = 'flex-start', extra = '' } = {}) {
  return `<div style="display:flex;flex-direction:row;gap:${gap}px;align-items:${align};justify-content:${justify};${extra}">${children.join('')}</div>`;
}

export function col(children, { gap = 10, align = 'stretch', justify = 'flex-start', extra = '' } = {}) {
  return `<div style="display:flex;flex-direction:column;gap:${gap}px;align-items:${align};justify-content:${justify};${extra}">${children.join('')}</div>`;
}

export function h1(text, { size = 28, color = T.ink, extra = '' } = {}) {
  return `<div class="display" style="font-size:${size}px;color:${color};line-height:1.1;${extra}">${text}</div>`;
}

export function p(text, { size = 13, color = T.muted, extra = '' } = {}) {
  return `<div style="font-size:${size}px;color:${color};line-height:1.5;${extra}">${text}</div>`;
}

/** 표 (헤더 배열 + 행 배열). */
export function table(headers, rows, { size = 12, colW = null, extra = '' } = {}) {
  const th = headers.map((h, i) => `<th style="text-align:left;padding:6px 8px;font-size:${size - 1}px;color:${T.muted};font-weight:700;border-bottom:2px solid ${T.line};${colW && colW[i] ? `width:${colW[i]}px;` : ''}">${h}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 8px;font-size:${size}px;color:${T.ink};border-bottom:1px solid ${T.line};vertical-align:top">${c}</td>`).join('')}</tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%;${extra}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/** 아트보드 상단 제목 띠 (시트류). */
export function sheetHeader(title, subtitle, tag) {
  return `<div style="display:flex;flex-direction:row;align-items:flex-end;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:3px solid ${T.line2}">
    <div style="display:flex;flex-direction:column;gap:4px">
      ${h1(title, { size: 32 })}
      ${p(subtitle, { size: 14 })}
    </div>
    ${chip(tag, { color: T.panel3, fg: T.amp })}
  </div>`;
}
