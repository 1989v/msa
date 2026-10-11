// TG6 CSS 회귀 주입 측정 — 사본 빌드를 로컬 프리뷰(/api 는 운영 프록시)로 띄워 R8·R9·R9b·R10 이 드러나는 값을 잰다
// 판정 근거: 프리뷰 페이지의 계산된 색·outline·DOM 사각형·document.activeElement (lib.mjs CONTRAST_JS)
import { writeFileSync } from 'node:fs';
import { tab, sleep, CONTRAST_JS, BUNDLE_JS } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG, label] = process.argv;
const E = (body) => `(()=>{${CONTRAST_JS};const __nt=(el,label,prop)=>{if(!el)return {label,missing:true};const cs=getComputedStyle(el);const c=__parse(cs[prop||'color']);const bg=__bgOf(el).rgb;const fg=c[3]<1?__over(c,[...bg,1]):c.slice(0,3);return {label,fg:__hex(fg),bg:__hex(bg),ratio:__ratio(fg,bg)}};${body}})()`;
const res = { label, at: new Date().toISOString(), combos: [] };
for (const [dev, site] of [['light', 'light'], ['dark', 'dark']]) {
  const C = { dev, site };
  { const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
    await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
    await t.send('Page.navigate', { url: ORIG + '/place' }); await sleep(8000);
    C.bundle = await t.ev(BUNDLE_JS); C.css = await t.ev(`[...document.styleSheets].map(s=>s.href||'').filter(h=>/PlacePage-/.test(h)).map(h=>h.split('/').pop())`);
    C.badge = await t.ev(E(`const li=document.querySelector('.place-list .place-card-badges li');return li?__cr(li,'badge'):{missing:true}`));
    await t.close(); }
  { const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
    await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
    await t.send('Page.navigate', { url: ORIG + '/place/attractions/77' }); await sleep(8000);
    C.scrollPad = await t.ev(`getComputedStyle(document.documentElement).scrollPaddingBottom`);
    await t.ev(`(()=>{const f=document.querySelector('.place-detail-first');scrollTo(0,f.getBoundingClientRect().bottom+scrollY+300)})()`); await sleep(1200);
    C.jump = await t.ev(`(()=>{const j=document.querySelector('.place-jump').getBoundingClientRect(),h=document.querySelector('.place-header').getBoundingClientRect();return {jumpTop:Math.round(j.top),headerBottom:Math.round(h.bottom),overlap:Math.max(0,Math.round(h.bottom-j.top))}})()`);
    await t.ev(`document.querySelector('.place-action-bar .favorite-btn')?.setAttribute('data-m','fav')`);
    C.bar = await t.ev(E(`const b=document.querySelector('.place-action-bar');const f=b.querySelector('[data-m=fav]');const r=f.getBoundingClientRect();const off=__nt(f,'star-off');f.classList.add('is-on');const on=__nt(f,'star-on');f.classList.remove('is-on');
      return {shown:!b.hidden,barTop:Math.round(b.getBoundingClientRect().top),favSize:[Math.round(r.width),Math.round(r.height)],off,on}`));
    if (await t.force('[data-m=fav]', ['focus', 'focus-visible'])) C.favFocus = await t.ev(E(`const el=document.querySelector('[data-m=fav]');const cs=getComputedStyle(el);return {...__nt(el,'fav-focus','outlineColor'),outline:cs.outlineStyle+' '+cs.outlineWidth}`));
    await t.force(null);
    if (dev === 'light') {
      // Tab 순회 — 바가 보이는 동안 본문 포커스 요소 bottom > 바 top 인 수
      await t.ev(`scrollTo(0,0);document.activeElement&&document.activeElement.blur();true`); await sleep(400);
      let checked = 0, hidden = 0;
      for (let i = 0; i < 160; i++) {
        await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await sleep(60);
        const f = await t.ev(`(()=>{const e=document.activeElement;if(!e||e===document.body)return null;let fixed=false;for(let n=e;n;n=n.parentElement){if(getComputedStyle(n).position==='fixed'){fixed=true;break;}}const b=document.querySelector('.place-action-bar');return {bottom:e.getBoundingClientRect().bottom,fixed,barShown:!b.hidden,barTop:b.getBoundingClientRect().top}})()`);
        if (!f || f.fixed || !f.barShown) continue; checked++; if (f.bottom > f.barTop + 0.5) hidden++;
      }
      C.tab = { checked, hidden };
    }
    await t.close(); }
  res.combos.push(C);
  console.log(label, dev, site, JSON.stringify({ b: C.bundle, css: C.css, badge: C.badge?.ratio, pad: C.scrollPad, ov: C.jump?.overlap, off: C.bar?.off?.ratio, on: C.bar?.on?.ratio, fav: C.bar?.favSize, focus: C.favFocus?.ratio, tab: C.tab }));
}
writeFileSync(`${out}/css-${label}.json`, JSON.stringify(res, null, 1)); process.exit(0);
