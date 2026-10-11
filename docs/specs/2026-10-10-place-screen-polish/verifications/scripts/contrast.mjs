// 4조합 대비 기준선 — 허브·RegionPage 카드, primary, 언어 토글, 시트 라벨 8곳, 필터·지역 시트 글자 전부, 바닥글 낙관(참고)
import { writeFileSync } from 'node:fs';
import { tab, sleep, CONTRAST_JS, BUNDLE_JS } from './lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com', only] = process.argv;
// 로컬 프리뷰(localhost)는 place 호스트가 아니라 /place 경로로 그린다. 다른 호스트(game·blog) 시트는 운영에서만 잰다
const LOCAL = /localhost|127\.0\.0\.1/.test(ORIG);
const HUB = LOCAL ? '/place' : '/';
const REGION = LOCAL ? '/place/regions/11' : '/regions/11';
const APEX = LOCAL ? ORIG : 'https://1989v.com';
const E = (body) => `(()=>{${CONTRAST_JS};${body}})()`;
const ESC = `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`;
const THEME = `document.documentElement.dataset.theme+'/'+(document.documentElement.dataset.surface||'-')`;
const CARD = (scope) => E(`const a=document.querySelector('[data-m=card]');if(!a)return {missing:true};
  const t=a.querySelector('.place-card-title');const prim=__tok('--ko-text-primary',a.parentElement);const acs=getComputedStyle(a);
  return {href:a.getAttribute('href'),tag:a.tagName,titleColor:getComputedStyle(t).color,primary:prim,titleIsPrimary:getComputedStyle(t).color===prim,
   decoA:acs.textDecorationLine,decoTitle:getComputedStyle(t).textDecorationLine,outline:acs.outlineStyle+' '+acs.outlineWidth+' '+acs.outlineColor,
   title:__cr(t,'title'),meta:__cr(a.querySelector('.place-card-meta'),'meta'),addr:__cr(a.querySelector('.place-card-addr'),'addr')}`);
const markCard = (sel) => `(()=>{document.querySelectorAll('[data-m=card]').forEach(x=>x.removeAttribute('data-m'));const c=[...document.querySelectorAll('${sel}')].find(x=>x.querySelector('.place-card-addr'))||document.querySelector('${sel}');if(c)c.setAttribute('data-m','card');return !!c})()`;
const states = async (t, sel, fn) => { const r = { def: await t.ev(fn) }; if (await t.force(sel, ['hover'])) r.hover = await t.ev(fn); if (await t.force(sel, ['focus', 'focus-visible'])) r.focus = await t.ev(fn); await t.force(null); return r; };
const btn = (mark) => E(`return __cr(document.querySelector('[data-m=${mark}]'),'${mark}')`);
const btnStates = async (t, mark) => { const r = { def: await t.ev(btn(mark)) }; if (await t.force(`[data-m=${mark}]`, ['hover'])) r.hover = await t.ev(btn(mark)); await t.force(null); return r; };
const label = E(`const l=[...document.querySelectorAll('.kh-sheet .kh-sheet-label')].pop();return l?__cr(l,'kh-sheet-label'):{missing:true}`);
const texts = E(`const s=[...document.querySelectorAll('.kh-sheet')].pop();return s?__texts(s):[]`);
// 넓은 화면 다이얼로그 — 가로 넘침(scrollWidth ≤ clientWidth)과 글자 전부
const dialog = E(`const s=[...document.querySelectorAll('.kh-sheet')].pop();if(!s)return {missing:true};const r=s.getBoundingClientRect();
  return {cls:s.className,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth,rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],texts:__texts(s)}`);
const clickText = (sel, re) => `(()=>{const b=[...document.querySelectorAll('${sel}')].find(x=>${re}.test(x.textContent));if(b)b.click();return !!b})()`;
const res = { at: new Date().toISOString(), combos: [] };
for (const dev of ['light', 'dark']) for (const site of ['light', 'dark']) {
  if (only && only !== `${dev}-${site}`) continue;
  const C = { dev, site, pages: {} };
  // 1) 허브 1440
  { const t = await tab(port, 1440, 900, false, { dev, site, origin: ORIG });
    await t.send('Page.navigate', { url: ORIG + HUB }); await sleep(8000);
    const P = { theme: await t.ev(THEME), bundle: await t.ev(BUNDLE_JS) };
    if (!(await t.ev(`!!document.querySelector('.place-page')`))) P.error = '앱이 로드되지 않음';
    // 넓은 화면 필터·지역 다이얼로그(이번 변경 뒤에만 있다)
    if (await t.ev(`(()=>{const b=document.querySelector('.place-filter-open');if(b)b.click();return !!b})()`)) {
      await sleep(1300); P.dialogFilter = { label: await t.ev(label), ...(await t.ev(dialog)) }; await t.ev(ESC); await sleep(600);
    }
    if (await t.ev(`(()=>{const b=document.querySelector('.place-region-trigger');if(b)b.click();return !!b})()`)) {
      await sleep(2000); P.dialogRegion = { label: await t.ev(label), ...(await t.ev(dialog)) }; await t.ev(ESC); await sleep(600);
    }
    await t.ev(markCard('.place-list a.place-card'));
    P.card = await states(t, '[data-m=card]', CARD());
    await t.ev(`(()=>{const b=document.querySelector('.place-search button[type=submit]');b&&b.setAttribute('data-m','search')})()`);
    P.search = await btnStates(t, 'search');
    // 「이 지역 검색」 — 지도를 움직여야 생긴다. 같은 클래스 요소를 같은 자리에 넣어 잰다(표준 §4)
    await t.ev(`(()=>{const w=document.querySelector('.place-map-wrap');if(!w)return;const b=document.createElement('button');b.className='place-btn primary place-search-area';b.textContent='이 지역 재검색';b.setAttribute('data-m','area');w.appendChild(b)})()`);
    P.searchArea = await btnStates(t, 'area'); P.searchArea.injected = true;
    await t.ev(`document.querySelector('[data-m=area]')?.remove()`);
    P.lang = await t.ev(E(`return {active:__cr(document.querySelector('.place-lang-btn.active'),'active'),inactive:__cr(document.querySelector('.place-lang-btn:not(.active)'),'inactive')}`));
    P.footerMark = await t.ev(E(`return __cr(document.querySelector('.site-footer-mark'),'footer-mark')`));
    await t.ev(`document.querySelector('.site-footer-explore')?.click()`); await sleep(1300);
    P.sheetServiceExplorer = await t.ev(label); await t.ev(ESC); await sleep(500);
    await t.ev(clickText('.place-search button', '/뽑기/')); await sleep(1500);
    P.sheetPick = await t.ev(label); await t.ev(ESC); await sleep(500);
    await t.ev(`document.querySelector('.place-list a.place-card')?.click()`); await sleep(3500);
    await t.ev(`(()=>{const b=document.querySelector('.place-detail .place-btn.primary');b&&b.setAttribute('data-m','detailmap')})()`);
    P.detailMap = await btnStates(t, 'detailmap');
    C.pages.hub1440 = P; await t.close(); }
  // 2) 허브 390
  { const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
    await t.send('Page.navigate', { url: ORIG + HUB }); await sleep(8000);
    const P = { theme: await t.ev(THEME) };
    await t.ev(`(()=>{const b=document.querySelector('.place-view-toggle');b&&b.setAttribute('data-m','toggle')})()`);
    P.viewToggle = await btnStates(t, 'toggle');
    await t.ev(`document.querySelector('.place-filter-open')?.click()`); await sleep(1300);
    P.sheetFilter = { label: await t.ev(label), texts: await t.ev(texts) }; await t.ev(ESC); await sleep(600);
    await t.ev(`document.querySelector('.place-region-trigger')?.click()`); await sleep(2000);
    P.sheetRegion = { label: await t.ev(label), texts: await t.ev(texts) };
    await t.ev(`(()=>{const r=document.querySelector('.kh-sheet .place-region-row[aria-current]')||[...document.querySelectorAll('.kh-sheet .place-region-row')][1];r&&r.click()})()`); await sleep(2500);
    P.sheetRegionSigungu = { texts: await t.ev(texts) }; await t.ev(ESC); await sleep(600);
    await t.ev(`document.querySelector('.place-list a.place-card')?.click()`); await sleep(3500);
    P.sheetDetail = await t.ev(label); await t.ev(ESC);
    C.pages.hub390 = P; await t.close(); }
  // 3) 지역 페이지 1440 (서울)
  { const t = await tab(port, 1440, 900, false, { dev, site, origin: ORIG });
    await t.send('Page.navigate', { url: ORIG + REGION }); await sleep(8000);
    const P = { theme: await t.ev(THEME) };
    await t.ev(markCard('.place-list a.place-card'));
    P.card = await states(t, '[data-m=card]', CARD());
    await t.ev(`(()=>{const b=document.querySelector('a.place-btn.primary');b&&b.setAttribute('data-m','hublink')})()`);
    P.hubLink = await btnStates(t, 'hublink');
    C.pages.region1440 = P; await t.close(); }
  // 4) 다른 호스트 시트 라벨 — GNB 메뉴(apex) · 탭바 장르(game) · 공간 전환(blog)
  for (const [key, url, act] of [
    ['sheetGnb', APEX + '/about', `document.querySelector('.gnb-hamburger')?.click()`],
    ...(LOCAL ? [] : [
      ['sheetTabbarGenres', 'https://game.1989v.com/', clickText('.kh-tabbar-item', '/장르|Genres/')],
      ['sheetBlogSpace', 'https://blog.1989v.com/', `document.querySelector('.blog-space-trigger')?.click()`],
    ]),
  ]) { const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
    await t.send('Page.navigate', { url }); await sleep(8000);
    const theme = await t.ev(THEME); const clicked = await t.ev(act); await sleep(1500);
    C.pages[key] = { url, theme, clicked, label: await t.ev(label) }; await t.close(); }
  res.combos.push(C);
  console.log('combo', dev, site);
}
writeFileSync(`${out}/contrast${only ? '-' + only : ''}.json`, JSON.stringify(res, null, 1)); console.log('contrast done'); process.exit(0);
