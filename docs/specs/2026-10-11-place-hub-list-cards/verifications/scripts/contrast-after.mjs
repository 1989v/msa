// TG6 대비 4조합(기기 light/dark × 사이트 light/dark) — SR-8.3
// 판정 근거: 대상 페이지의 계산된 글자색·아이콘색·outline 색과 실제 바탕 층 합성(lib.mjs CONTRAST_JS, 표준 §4.5)
// 계측 전송은 막는다. 없는 상태(오늘 휴무 배지·찜 켜짐)는 같은 클래스를 같은 요소에 붙여 잰다(injected 표시)
import { writeFileSync } from 'node:fs';
import { tab, sleep, CONTRAST_JS, BUNDLE_JS } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com', only] = process.argv;
const LOCAL = /localhost|127\.0\.0\.1/.test(ORIG);
const HUB = LOCAL ? '/place' : '/';
const DETAIL = LOCAL ? '/place/attractions/77' : '/attractions/77';
const E = (body) => `(()=>{${CONTRAST_JS};const __nt=(el,label,prop)=>{if(!el)return {label,missing:true};const cs=getComputedStyle(el);const c=__parse(cs[prop||'color']);const bg=__bgOf(el).rgb;const fg=c[3]<1?__over(c,[...bg,1]):c.slice(0,3);return {label,fg:__hex(fg),bg:__hex(bg),ratio:__ratio(fg,bg)}};${body}})()`;
const THEME = `document.documentElement.dataset.theme+'/'+(document.documentElement.dataset.surface||'-')`;
const res = { at: new Date().toISOString(), orig: ORIG, combos: [] };
for (const dev of ['light', 'dark']) for (const site of ['light', 'dark']) {
  if (only && only !== `${dev}-${site}`) continue;
  const C = { dev, site };
  // 1) 허브 390 카드
  { const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
    await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
    await t.send('Page.navigate', { url: ORIG + HUB }); await sleep(8000);
    C.hubTheme = await t.ev(THEME); C.hubBundle = await t.ev(BUNDLE_JS);
    C.card = await t.ev(E(`const c=[...document.querySelectorAll('.place-list a.place-card')].find(x=>x.querySelector('.place-card-badges li')&&x.querySelector('.place-card-region'));if(!c)return {missing:true};
      const li=c.querySelector('.place-card-badges li:not(.is-closed-today)');const badge0=__cr(li,'badge');let ct=document.querySelector('.place-card-badges li.is-closed-today');let injected=false;
      if(!ct){const l2=c.querySelector('.place-card-badges li');l2.classList.add('is-closed-today');ct=l2;injected=true;}
      const r={meta:__cr(c.querySelector('.place-card-meta > span'),'meta-category'),region:__cr(c.querySelector('.place-card-region'),'region'),badge:badge0,closedToday:{...__cr(ct,'closedToday'),injected},
        saved:document.querySelector('.place-card-saved')?__cr(document.querySelector('.place-card-saved'),'saved'):{missing:true,note:'운영 색인 찜 수 0건'}};
      if(injected)ct.classList.remove('is-closed-today');return r`));
    await t.close(); }
  // 2) 상세 390 — 바·이동 줄
  { const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
    await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
    await t.send('Page.navigate', { url: ORIG + DETAIL }); await sleep(7000);
    C.detailTheme = await t.ev(THEME);
    await t.ev(`(()=>{const f=document.querySelector('.place-detail-first');scrollTo(0,f.getBoundingClientRect().bottom+scrollY+300)})()`); await sleep(1200);
    await t.ev(`(()=>{const b=document.querySelector('.place-action-bar');const cells=[...b.children];
      cells.forEach((c,i)=>c.setAttribute('data-cell',String(i)));
      const dir=b.querySelector('a.place-action-bar__cell');dir&&dir.setAttribute('data-m','bar-dir');
      const ph=b.querySelector('a.place-action-bar__cell[href^="tel:"]');ph&&ph.setAttribute('data-m','bar-phone');
      b.querySelector('.favorite-btn')?.setAttribute('data-m','bar-fav');b.querySelector('.share-panel__btn')?.setAttribute('data-m','bar-share');
      document.querySelectorAll('.place-jump a').forEach((a,i)=>a.setAttribute('data-m','jump'+i));})()`);
    const barText = () => t.ev(E(`const b=document.querySelector('.place-action-bar');return {shown:!b.hidden,
      texts:[__cr(b.querySelector('[data-m=bar-dir] span'),'dir'),__cr(b.querySelector('.place-action-bar__label'),'save'),__cr(b.querySelector('[data-m=bar-share]'),'share'),__cr(b.querySelector('[data-m=bar-phone] span'),'call')],
      shareText:b.querySelector('[data-m=bar-share]')?.textContent.trim(),
      icons:[__nt(b.querySelector('[data-m=bar-dir] svg'),'dir-icon'),__nt(b.querySelector('[data-m=bar-fav]'),'star-off'),__nt(b.querySelector('[data-m=bar-share]'),'share-icon'),__nt(b.querySelector('[data-m=bar-phone] svg'),'call-icon')]}`));
    C.bar = await barText();
    // 찜 켜짐 — 로그인 없이 누를 수 없어 같은 클래스를 붙여 잰다
    C.barStarOn = await t.ev(E(`const f=document.querySelector('[data-m=bar-fav]');const had=f.classList.contains('is-on');f.classList.add('is-on');const r={...__nt(f,'star-on'),injected:!had};if(!had)f.classList.remove('is-on');return r`));
    // 포커스 링 — outline 색 대 그 칸 바탕
    C.focus = {};
    for (const m of ['bar-dir', 'bar-fav', 'bar-share', 'bar-phone', 'jump0']) {
      if (!(await t.force(`[data-m=${m}]`, ['focus', 'focus-visible']))) { C.focus[m] = { missing: true }; continue; }
      C.focus[m] = await t.ev(E(`const el=document.querySelector('[data-m=${m}]');const cs=getComputedStyle(el);return {...__nt(el,'${m}','outlineColor'),outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineOffset}`));
    }
    await t.force(null);
    // 이동 줄 링크 — 기본·hover·focus
    C.jump = { def: await t.ev(E(`return __cr(document.querySelector('[data-m=jump0]'),'jump')`)) };
    if (await t.force('[data-m=jump0]', ['hover'])) C.jump.hover = await t.ev(E(`return __cr(document.querySelector('[data-m=jump0]'),'jump')`));
    if (await t.force('[data-m=jump0]', ['focus', 'focus-visible'])) C.jump.focus = await t.ev(E(`return __cr(document.querySelector('[data-m=jump0]'),'jump')`));
    await t.force(null);
    await t.close(); }
  res.combos.push(C); console.log('combo', dev, site);
}
writeFileSync(`${out}/contrast-after${only ? '-' + only : ''}.json`, JSON.stringify(res, null, 1)); console.log('contrast done'); process.exit(0);
