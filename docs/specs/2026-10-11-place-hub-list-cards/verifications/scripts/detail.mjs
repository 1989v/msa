// TG1 상세 기준선 — 390×844, 표본 12곳(직전 스펙 10 + 전화 없는 곳 국·영 1) × 3회
// 판정 근거: 대상 페이지 DOM 사각형 · layout-shift 항목
import { writeFileSync } from 'node:fs';
import { tab, sleep, BUNDLE_JS } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
const IDS = { ko: [77, 4811, 16151, 12933, 2961, 47], en: [13863, 13808, 18083, 14580, 14367, 1658] };
const CLS_INIT = `window.__cls=0;try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value;}}).observe({type:'layout-shift',buffered:true});}catch(e){}`;
const PROBE = `(()=>{const B=(e)=>e?Math.round(e.getBoundingClientRect().bottom+scrollY):null;
 const act=document.querySelector('[data-place-section="actions"]')||document.querySelector('.place-detail-actions');
 const dir=act?[...act.querySelectorAll('a')].find(a=>/길찾기|Directions/i.test(a.textContent)):null;
 return {title:document.querySelector('h1')?.textContent.trim().slice(0,24),hasApp:!!document.querySelector('.place-page'),
  header:B(document.querySelector('.place-header')),actionsBottom:B(act),dirBottom:B(dir),first:B(document.querySelector('.place-detail-first')),
  phone:!!(act&&act.querySelector('a[href^="tel:"]')),docH:document.documentElement.scrollHeight,js:${BUNDLE_JS}}})()`;
const res = { at: new Date().toISOString(), rows: [] };
for (const lang of ['ko', 'en']) for (const id of IDS[lang]) for (let run = 1; run <= 3; run++) {
  const t = await tab(port, 390, 844, true);
  await t.send('Network.setCacheDisabled', { cacheDisabled: true });
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT });
  await t.send('Page.navigate', { url: `${ORIG}${lang === 'en' ? '/en' : ''}/attractions/${id}` }); await sleep(6000);
  const p = await t.ev(PROBE);
  const clsLoad = await t.ev('window.__cls');
  for (let i = 0; i < 30; i++) { const done = await t.ev(`(()=>{scrollBy(0,600);return innerHeight+scrollY>=document.documentElement.scrollHeight-2})()`); await sleep(250); if (done) break; }
  await sleep(1500);
  const clsAll = await t.ev('window.__cls');
  res.rows.push({ lang, id, run, ...p, clsLoad: +(+clsLoad).toFixed(4), clsAll: +(+clsAll).toFixed(4) });
  console.log(lang, id, run, JSON.stringify(p).slice(0, 160), clsLoad, clsAll);
  await t.close();
}
writeFileSync(`${out}/detail.json`, JSON.stringify(res, null, 1)); console.log('detail done'); process.exit(0);
