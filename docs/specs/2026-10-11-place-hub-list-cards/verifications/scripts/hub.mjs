// TG1 허브 기준선 — 390×844·1440×900 × ko·en × 질의(none·sido51) × 3회
// 판정 근거: 대상 페이지 DOM 사각형·계산 스타일·layout-shift 항목
import { writeFileSync } from 'node:fs';
import { tab, sleep, BUNDLE_JS } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
const CLS_INIT = `window.__cls=0;window.__shifts=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput){window.__cls+=e.value;window.__shifts.push([Math.round(e.startTime),+e.value.toFixed(4)]);}}}).observe({type:'layout-shift',buffered:true});}catch(e){window.__clsErr=String(e)}`;
const SEED = (sido) => `try{if(!sessionStorage.getItem('__seeded')){sessionStorage.setItem('__seeded','1');sessionStorage.setItem('kgd.placeHubState.v1',JSON.stringify({keyword:'',exactFor:null,keepWordsFor:null,skipConditions:null,category:null,attributes:[],areaCode:null,sidoCode:'${sido}',sigunguCode:null,geo:null,listEventStatus:null,selectedId:null,page:0,createdAt:Date.now()}));}}catch(e){}`;
const GEOM = `(()=>{if(!document.querySelector('.place-page'))return {error:'앱이 로드되지 않음'};
 const cards=[...document.querySelectorAll('.place-list .place-card:not(.place-card-loading)')].slice(0,10);
 const rows=cards.map(c=>{const r=c.getBoundingClientRect();const a=c.querySelector('a[href*="/attractions/"]')||c.closest('a[href*="/attractions/"]')||c;const m=(a.getAttribute('href')||'').match(/attractions\\/(\\d+)/);
  return {id:m?m[1]:null,title:c.querySelector('.place-card-title')?.textContent.trim().slice(0,24),top:Math.round(r.top+scrollY),x:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height*10)/10,
   overflow:c.scrollWidth>c.clientWidth,addr:!!c.querySelector('.place-card-addr'),meta:c.querySelector('.place-card-meta')?.textContent.trim().slice(0,40)||null}});
 const hs=rows.map(r=>r.h).sort((a,b)=>a-b);const med=hs.length?(hs.length%2?hs[(hs.length-1)/2]:(hs[hs.length/2-1]+hs[hs.length/2])/2):null;
 return {vw:innerWidth,vh:innerHeight,count:rows.length,rows,median:med,max:hs.length?hs[hs.length-1]:null,firstY:rows[0]?.top??null,
  doc:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth},
  summary:document.querySelector('.place-region-trigger-label')?.textContent?.trim()||null,
  cls:Math.round((window.__cls||0)*10000)/10000,shifts:(window.__shifts||[]).slice(0,10)}})()`;
const settle = async (t) => { for (let i = 0; i < 40; i++) { const b = await t.ev(`(()=>{const l=document.querySelector('.place-list');return l&&l.getAttribute('aria-busy')==='false'&&document.querySelectorAll('.place-list .place-card:not(.place-card-loading)').length>0})()`); if (b) break; await sleep(300); } await sleep(2500); };
const res = { at: new Date().toISOString(), orig: ORIG, runs: [] };
for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]])
 for (const lang of ['ko', 'en']) for (const q of ['none', 'sido51']) for (let run = 1; run <= 3; run++) {
  const t = await tab(port, w, h, mobile);
  await t.send('Network.setCacheDisabled', { cacheDisabled: true });
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT });
  if (q === 'sido51') await t.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED('51') });
  await t.send('Page.navigate', { url: ORIG + (lang === 'en' ? '/en' : '/') }); await sleep(3000); await settle(t);
  const bundle = await t.ev(BUNDLE_JS);
  const g = await t.ev(GEOM);
  if (run === 1 && w === 390) {
    await t.shot(`${out}/screens/before/hub-390-${lang}-${q}.png`, { x: 0, y: 0, width: 390, height: 844 });
    if (q === 'none' && g.rows) for (const [i, r] of g.rows.slice(0, 8).entries()) {
      const s = await t.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.top, width: r.w, height: Math.ceil(r.h), scale: 1 } });
      const { writeFileSync: wf } = await import('node:fs'); wf(`${out}/screens/before/card-390-${lang}-${String(i + 1).padStart(2, '0')}-${r.id}.png`, Buffer.from(s.data, 'base64'));
    }
  }
  if (run === 1 && w === 1440) await t.shot(`${out}/screens/before/hub-1440-${lang}-${q}.png`, { x: 0, y: 0, width: 1440, height: 900 });
  res.runs.push({ vp: `${w}x${h}`, lang, q, run, bundle, ...g });
  console.log(w, lang, q, run, g.count, g.median, g.max, g.firstY, g.cls, g.error || '');
  await t.close();
}
writeFileSync(`${out}/hub.json`, JSON.stringify(res, null, 1)); console.log('hub done'); process.exit(0);
