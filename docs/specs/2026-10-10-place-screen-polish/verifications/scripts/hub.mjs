// 허브 1440×900 — 첫 카드 y · 툴바 자식별 top·height · layout-shift(3회) · 속성 2개 상태. 1024×768 참고
import { writeFileSync } from 'node:fs';
import { tab, sleep, BUNDLE_JS } from './lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
// 로컬 프리뷰(localhost)는 place 호스트가 아니라 /place 경로로 그린다
const LOCAL = /localhost|127\.0\.0\.1/.test(ORIG);
const HUB = LOCAL ? '/place' : '/';
const CLS_INIT = `window.__cls=0;window.__shifts=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput){window.__cls+=e.value;window.__shifts.push([Math.round(e.startTime),+e.value.toFixed(4)]);}}}).observe({type:'layout-shift',buffered:true});}catch(e){window.__clsErr=String(e)}`;
const GEOM = `(()=>{const R=(e)=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),h:Math.round(r.height)}};
 if(!document.querySelector('.place-page'))return {error:'앱이 로드되지 않음'};
 const card=document.querySelector('.place-list .place-card:not(.place-card-loading)');
 const tb=document.querySelector('.place-toolbar');
 return {vw:innerWidth,vh:innerHeight,firstCard:R(card),firstCardTitle:card?.querySelector('.place-card-title')?.textContent.trim().slice(0,20),cards:document.querySelectorAll('.place-list .place-card').length,
  header:R(document.querySelector('.place-header')),toolbar:R(tb),
  toolbarChildren:tb?[...tb.children].map(c=>({cls:(c.className||c.tagName).toString().slice(0,40),...R(c)})):null,
  body:R(document.querySelector('main.place-body')),
  attrsActive:[...document.querySelectorAll('.place-attr-chip.active')].map(c=>c.dataset.attr),
  filterOpen:document.querySelector('.place-filter-open')?.textContent||null,
  dialogOpen:!!document.querySelector('.kh-sheet'),
  summary:document.querySelector('.place-filter-summary')?.textContent||null,
  cls:Math.round((window.__cls||0)*10000)/10000,shifts:(window.__shifts||[]).slice(0,20),clsErr:window.__clsErr||null}})()`;
const settle = async (t) => { for (let i = 0; i < 30; i++) { const b = await t.ev(`document.querySelector('.place-list')?.getAttribute('aria-busy')`); if (b === 'false') break; await sleep(300); } await sleep(2000); };
const res = { at: new Date().toISOString(), orig: ORIG, runs: [], ref1024: null };
for (const lang of ['ko', 'en']) for (let run = 1; run <= 3; run++) {
  const t = await tab(port, 1440, 900, false);
  await t.send('Network.setCacheDisabled', { cacheDisabled: true });
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT });
  await t.send('Page.navigate', { url: ORIG + (lang === 'en' ? '/en' + (LOCAL ? '/place' : '') : HUB) }); await sleep(8000);
  const bundle = await t.ev(BUNDLE_JS);
  const none = await t.ev(GEOM);
  if (run === 1) await t.shot(`${out}/screens/hub-1440-${lang}-none.png`, { x: 0, y: 0, width: 1440, height: 900 });
  // 속성 2개 상태 — 전(인라인 칩): 칩 둘을 차례로. 후(필터 한 줄): 「필터」 열기 → 같은 칩 둘 → 닫기(Escape).
  // 두 쪽 모두 SEARCH 응답이 그려진 뒤(aria-busy=false + 2초) 잰다. 같은 두 칩을 국·영에서 쓴다
  const dialogMode = await t.ev(`!!document.querySelector('.place-filter-open')`);
  if (dialogMode) { await t.ev(`document.querySelector('.place-filter-open').click()`); await sleep(1200); }
  const scope = dialogMode ? '.kh-sheet' : '.place-toolbar';
  const picked = [];
  for (let k = 0; k < 2; k++) {
    const id = await t.ev(`(()=>{const want=${JSON.stringify(['parking', 'admissionFree'])}[${k}];let c=document.querySelector('${scope} .place-attr-chip[data-attr="'+want+'"]');
      if(!c||c.classList.contains('is-empty'))c=[...document.querySelectorAll('${scope} .place-attr-chip:not(.is-empty):not(.active)')][0];if(!c)return null;c.click();return c.dataset.attr})()`);
    picked.push(id); await settle(t);
  }
  if (dialogMode) { await t.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(800); }
  const two = await t.ev(GEOM);
  if (run === 1) await t.shot(`${out}/screens/hub-1440-${lang}-attr2.png`, { x: 0, y: 0, width: 1440, height: 900 });
  res.runs.push({ lang, run, bundle, none, picked, two });
  await t.close();
}
{
  const t = await tab(port, 1024, 768, false);
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT });
  await t.send('Page.navigate', { url: ORIG + HUB }); await sleep(8000);
  res.ref1024 = await t.ev(GEOM); await t.close();
}
writeFileSync(`${out}/hub.json`, JSON.stringify(res, null, 1)); console.log('hub done'); process.exit(0);
