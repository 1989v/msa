// 엠블럼 페인터 (타이틀): 12×12 격자에 팔레트로 그림을 그린다. 저해상인 이유는 릴레이(4KB) 안에서 명단에 실어
// 온라인 상대에게도 보이기 위해서다(144자). 무료 — 골드가 아니라 창작이다. onChange 가 진행에 저장·전파한다.
import { EMBLEM_SIZE, EMBLEM_CELLS } from '@amp/shared';
import { EMBLEM_PALETTE, emptyEmblem, type Progress } from '../platform/progress.ts';

export function openEmblemModal(root: HTMLElement, get: () => Progress, onChange: (grid: string) => void): void {
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="panel modal-box col" style="gap:12px;width:min(460px,96vw)">
    <div class="row" style="justify-content:space-between"><span class="display" style="font-size:22px">가슴 그림</span><button class="btn ghost close" style="height:32px">닫기</button></div>
    <div class="muted" style="font-size:12px">12×12 격자. 팔레트로 칠하고 지우개로 지운다. 온라인에서 상대에게도 보인다.</div>
    <div class="row" style="justify-content:center"><div class="emblem-grid"></div></div>
    <div class="emblem-palette row" style="justify-content:center;flex-wrap:wrap;gap:6px"></div>
    <div class="row" style="justify-content:space-between"><button class="btn ghost clear" style="height:32px">전부 지우기</button><span class="muted" style="font-size:11px">칸을 눌러 칠하기 · 끌어서 이어 칠하기</span></div>
  </div>`;
  root.appendChild(el);
  const close = () => el.remove();
  (el.querySelector('.close') as HTMLButtonElement).onclick = close;
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  let grid = (get().emblem || emptyEmblem()).split('');
  let sel = 2; // 기본 붓 색 (팔레트 인덱스 1~9), 0 = 지우개
  const gridEl = el.querySelector('.emblem-grid') as HTMLElement;
  gridEl.style.cssText = `display:grid;grid-template-columns:repeat(${EMBLEM_SIZE}, 22px);grid-template-rows:repeat(${EMBLEM_SIZE}, 22px);gap:1px;background:var(--line2);padding:2px;border-radius:8px;touch-action:none`;
  const cellColor = (v: number) => (v <= 0 ? 'var(--bg2)' : EMBLEM_PALETTE[v - 1]);
  const cells: HTMLElement[] = [];
  for (let i = 0; i < EMBLEM_CELLS; i++) {
    const c = document.createElement('div');
    c.style.cssText = `background:${cellColor(grid[i].charCodeAt(0) - 48)};border-radius:2px;cursor:pointer`;
    c.dataset.i = String(i);
    cells.push(c); gridEl.appendChild(c);
  }
  const paint = (i: number) => {
    const ch = String(sel);
    if (grid[i] === ch) return;
    grid[i] = ch;
    cells[i].style.background = cellColor(sel);
    onChange(grid.join(''));
  };
  let down = false;
  const cellAt = (t: EventTarget | null) => { const i = (t as HTMLElement)?.dataset?.i; return i ? Number(i) : -1; };
  gridEl.addEventListener('pointerdown', (e) => { const i = cellAt(e.target); if (i >= 0) { down = true; paint(i); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } });
  gridEl.addEventListener('pointermove', (e) => { if (!down) return; const el2 = document.elementFromPoint(e.clientX, e.clientY); const i = cellAt(el2); if (i >= 0) paint(i); });
  const end = () => { down = false; };
  gridEl.addEventListener('pointerup', end); gridEl.addEventListener('pointercancel', end); window.addEventListener('pointerup', end, { once: false });

  const pal = el.querySelector('.emblem-palette') as HTMLElement;
  const swatch = (idx: number, color: string, label: string) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (idx === sel ? ' on' : '');
    b.innerHTML = `<span style="background:${color}${idx === 0 ? ';border:2px dashed var(--muted)' : ''}"></span><small>${label}</small>`;
    b.onclick = () => { sel = idx; for (const x of pal.querySelectorAll('.swatch')) x.classList.remove('on'); b.classList.add('on'); };
    pal.appendChild(b);
  };
  swatch(0, 'transparent', '지우개');
  EMBLEM_PALETTE.forEach((c, i) => swatch(i + 1, c, ''));

  (el.querySelector('.clear') as HTMLButtonElement).onclick = () => { grid = emptyEmblem().split(''); cells.forEach((c) => { c.style.background = 'var(--bg2)'; }); onChange(''); };
}
