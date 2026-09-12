// 진행 UI (타이틀): 레벨·경험치·골드 줄 + 「스탯 분배」·「상점」 모달. 상태는 app.ts 가 들고 있고 여기는 그리기와 클릭만.
import { STYLES, statsForStyle, type StyleId, type Stats } from '@amp/shared';
import {
  type Progress, levelProgress, freePoints, statPoints, allocate, buy, wear, owns,
  STAT_KEYS, STAT_NAMES, STAT_DESC, SHOP, SHIRT_PALETTE, HAIR_PALETTE, BAND_PALETTE, type SkinKind,
} from '../platform/progress.ts';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** 타이틀 폼의 진행 줄 */
export function progressPanelHtml(p: Progress): string {
  const lp = levelProgress(p.xp);
  const pct = lp.need > 0 ? Math.round((lp.cur / lp.need) * 100) : 100;
  const free = freePoints(p);
  return `
    <div class="progress-row row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div class="col" style="gap:4px;min-width:180px;flex:1">
        <div class="row" style="gap:8px;flex-wrap:wrap"><b class="lv" style="font-size:16px">Lv ${lp.level}</b><span class="chip xp">${lp.need > 0 ? `${lp.cur} / ${lp.need} XP` : '최고 레벨'}</span><span class="chip amp gold">${p.gold} 골드</span><span class="muted" style="font-size:11px">${p.matches}판 · ${p.wins}승 · ${p.kos} KO</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="row" style="gap:6px">
        <button class="btn stats-btn" style="height:34px;font-size:13px">스탯 분배${free > 0 ? ` <span class="chip amp" style="font-size:11px">${free}</span>` : ''}</button>
        <button class="btn shop-btn" style="height:34px;font-size:13px">상점</button>
        <button class="btn emblem-btn" style="height:34px;font-size:13px">그림</button>
      </div>
    </div>`;
}

function modal(root: HTMLElement, title: string, body: string): { el: HTMLElement; close: () => void } {
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="panel modal-box col" style="gap:12px"><div class="row" style="justify-content:space-between"><span class="display" style="font-size:22px">${esc(title)}</span><button class="btn ghost close" style="height:32px">닫기</button></div><div class="modal-body col" style="gap:10px">${body}</div></div>`;
  root.appendChild(el);
  const close = () => el.remove();
  (el.querySelector('.close') as HTMLButtonElement).onclick = close;
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  return { el, close };
}

/** 스탯 분배 모달 — onChange 는 바뀐 진행을 저장·전파한다 */
export function openStatsModal(root: HTMLElement, get: () => Progress, style: StyleId, onChange: (p: Progress) => void): void {
  const { el } = modal(root, '스탯 분배', `<div class="stats-body"></div>`);
  const body = el.querySelector('.stats-body') as HTMLElement;
  const draw = () => {
    const p = get();
    const base = statsForStyle(style);
    const free = freePoints(p);
    body.innerHTML = `
      <div class="muted" style="font-size:12px">레벨마다 포인트 1 · 스탯당 최대 +5 · ${esc(STYLES[style].name)} 기본치 위에 더해진다. 남은 포인트 <b style="color:var(--amp)">${free}</b> / ${statPoints(p)}</div>
      <table class="stats-table"><thead><tr><th>스탯</th><th>효과</th><th>기본</th><th>분배</th><th>합계</th><th></th></tr></thead><tbody>
      ${STAT_KEYS.map((k: keyof Stats) => { const a = p.alloc[k] ?? 0; return `<tr data-stat="${k}"><td style="font-weight:800">${STAT_NAMES[k]}</td><td class="muted" style="font-size:12px">${STAT_DESC[k]}</td><td class="num">${base[k]}</td><td class="num" style="color:var(--amp)">+${a}</td><td class="num" style="font-weight:800">${base[k] + a}</td><td><button class="btn ghost minus" style="height:28px;width:34px" ${a <= 0 ? 'disabled' : ''}>−</button> <button class="btn primary plus" style="height:28px;width:34px" ${free <= 0 || a >= 5 ? 'disabled' : ''}>+</button></td></tr>`; }).join('')}
      </tbody></table>`;
    for (const row of body.querySelectorAll<HTMLElement>('tr[data-stat]')) {
      const k = row.dataset.stat as keyof Stats;
      (row.querySelector('.plus') as HTMLButtonElement).onclick = () => { const n = allocate(get(), k, 1); if (n) { onChange(n); draw(); } };
      (row.querySelector('.minus') as HTMLButtonElement).onclick = () => { const n = allocate(get(), k, -1); if (n) { onChange(n); draw(); } };
    }
  };
  draw();
}

/** 상점 모달 — 색 조합 스킨. 산 것은 입기/벗기, 안 산 것은 사기 */
export function openShopModal(root: HTMLElement, get: () => Progress, onChange: (p: Progress) => void, toast: (m: string) => void): void {
  const { el } = modal(root, '상점 · 색 조합', `<div class="shop-body"></div>`);
  const body = el.querySelector('.shop-body') as HTMLElement;
  const groups: [SkinKind, string, string[], number][] = [['shirt', '상의', SHIRT_PALETTE, 8], ['hair', '머리', HAIR_PALETTE, 0], ['band', '머리띠', BAND_PALETTE, 0]];
  const draw = () => {
    const p = get();
    body.innerHTML = `<div class="row" style="justify-content:space-between"><span class="muted" style="font-size:12px">판이 끝나면 골드가 들어온다 (점수/10 + 승리 20 + 온라인 10). 색은 다른 사람에게도 보인다.</span><span class="chip amp">${p.gold} 골드</span></div>` +
      groups.map(([kind, label, palette, from]) => `
        <div class="col" style="gap:6px"><span class="label">${label}${kind === 'shirt' ? ' <span class="muted" style="font-weight:600">(앞 8색은 자리 색 · 무료)</span>' : ''}</span>
        <div class="swatches">
          <button class="swatch ${p.skin[kind] < 0 ? 'on' : ''}" data-kind="${kind}" data-idx="-1" title="기본"><span style="background:transparent;border:2px dashed var(--muted)"></span><small>기본</small></button>
          ${palette.map((c, i) => {
            const shopItem = SHOP.find((s) => s.kind === kind && s.idx === i);
            const free = kind === 'shirt' && i < from;
            const has = free || (shopItem ? owns(p, shopItem.id) : false);
            const on = p.skin[kind] === i;
            return `<button class="swatch ${on ? 'on' : ''} ${has ? 'owned' : ''}" data-kind="${kind}" data-idx="${i}" title="${shopItem ? esc(shopItem.name) : label}"><span style="background:${c}"></span><small>${has ? (on ? '입는 중' : '입기') : `${shopItem?.price ?? 0}G`}</small></button>`;
          }).join('')}
        </div></div>`).join('');
    for (const b of body.querySelectorAll<HTMLButtonElement>('.swatch')) {
      b.onclick = () => {
        const kind = b.dataset.kind as SkinKind, idx = Number(b.dataset.idx);
        const cur = get();
        const free = idx < 0 || (kind === 'shirt' && idx < 8);
        const item = SHOP.find((s) => s.kind === kind && s.idx === idx);
        if (!free && item && !owns(cur, item.id)) {
          const r = buy(cur, item.id);
          if (!r.ok) { toast(r.reason ?? '살 수 없다'); return; }
          const worn = wear(r.p, kind, idx) ?? r.p;
          onChange(worn); toast(`${item.name} 구매 · 입었다`); draw(); return;
        }
        const worn = free ? { ...cur, skin: { ...cur.skin, [kind]: idx }, updated: Date.now() } : wear(cur, kind, idx);
        if (worn) { onChange(worn); draw(); }
      };
    }
  };
  draw();
}
