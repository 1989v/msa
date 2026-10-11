// TG6 허브 배포 후 — TG1 과 같은 뷰포트·언어·질의(none·sido51) + 채움률용 셋째 질의(sido26) × 3회
// 판정 근거: 대상 페이지 DOM 사각형·계산 스타일·layout-shift 항목, 채움률은 그 화면이 받은 검색 응답 본문
import { writeFileSync, mkdirSync } from 'node:fs';
import { tab, sleep, BUNDLE_JS } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
// TG1 이 캡처한 같은 id 8장(pre-measure.md §2)
const SAME = { ko: [1, 9, 12, 17, 32, 37, 39, 40], en: [21, 24, 1625, 1651, 1652, 1656, 1658, 1662] };
const LOCAL = /localhost|127\.0\.0\.1/.test(ORIG);
const CLS_INIT = `window.__cls=0;window.__shifts=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput){window.__cls+=e.value;window.__shifts.push([Math.round(e.startTime),+e.value.toFixed(4)]);}}}).observe({type:'layout-shift',buffered:true});}catch(e){window.__clsErr=String(e)}`;
const SEED = (sido) => `try{if(!sessionStorage.getItem('__seeded')){sessionStorage.setItem('__seeded','1');sessionStorage.setItem('kgd.placeHubState.v1',JSON.stringify({keyword:'',exactFor:null,keepWordsFor:null,skipConditions:null,category:null,attributes:[],areaCode:null,sidoCode:'${sido}',sigunguCode:null,geo:null,listEventStatus:null,selectedId:null,page:0,createdAt:Date.now()}));}}catch(e){}`;
const GEOM = `(()=>{if(!document.querySelector('.place-page'))return {error:'앱이 로드되지 않음'};
 const cards=[...document.querySelectorAll('.place-list .place-card:not(.place-card-loading)')].slice(0,10);
 const rows=cards.map(c=>{const r=c.getBoundingClientRect();const m=(c.getAttribute('href')||'').match(/attractions\\/(\\d+)/);
  const bl=c.querySelector('.place-card-badges');const lis=bl?[...bl.querySelectorAll('li')]:[];
  const blr=bl?bl.getBoundingClientRect():null;
  // 배지가 화면에 보이는가 = li 가 ul 의 보이는 상자 안에 있다(넘친 것은 max-height 밖)
  const shown=lis.filter(li=>{const x=li.getBoundingClientRect();return blr&&x.top>=blr.top-0.5&&x.bottom<=blr.bottom+0.5;});
  const reg=c.querySelector('.place-card-region');const sav=c.querySelector('.place-card-saved');
  return {id:m?m[1]:null,title:c.querySelector('.place-card-title')?.textContent.trim().slice(0,24),top:Math.round(r.top+scrollY),x:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height*10)/10,
   overflow:c.scrollWidth>c.clientWidth,addr:!!c.querySelector('.place-card-addr'),meta:c.querySelector('.place-card-meta')?.textContent.trim().slice(0,60)||null,
   badges:lis.map(li=>li.textContent.trim()),badgesShown:shown.length,closedToday:!!c.querySelector('li.is-closed-today'),
   badgeRowH:blr?Math.round(blr.height*10)/10:null,badgeLineTops:[...new Set(lis.map(li=>Math.round(li.getBoundingClientRect().top)))].length,
   region:reg?reg.textContent.trim():null,regionW:reg?reg.clientWidth:null,regionClipped:reg?reg.scrollWidth>reg.clientWidth:null,saved:sav?sav.textContent.trim():null}});
 const hs=rows.map(r=>r.h).sort((a,b)=>a-b);const med=hs.length?(hs.length%2?hs[(hs.length-1)/2]:(hs[hs.length/2-1]+hs[hs.length/2])/2):null;
 return {vw:innerWidth,vh:innerHeight,count:rows.length,rows,median:med,max:hs.length?hs[hs.length-1]:null,firstY:rows[0]?.top??null,
  doc:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth},
  htmlScrollPadBottom:getComputedStyle(document.documentElement).scrollPaddingBottom,actionBar:!!document.querySelector('.place-action-bar'),
  summary:document.querySelector('.place-region-trigger-label')?.textContent?.trim()||null,
  cls:Math.round((window.__cls||0)*10000)/10000,shifts:(window.__shifts||[]).slice(0,10)}})()`;
const settle = async (t) => { for (let i = 0; i < 40; i++) { const b = await t.ev(`(()=>{const l=document.querySelector('.place-list');return l&&l.getAttribute('aria-busy')==='false'&&document.querySelectorAll('.place-list .place-card:not(.place-card-loading)').length>0})()`); if (b) break; await sleep(300); } await sleep(2500); };
mkdirSync(`${out}/screens/after`, { recursive: true });
const res = { at: new Date().toISOString(), orig: ORIG, runs: [], fill: [] };
for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]])
 for (const lang of ['ko', 'en']) for (const q of ['none', 'sido51', 'sido26']) for (let run = 1; run <= 3; run++) {
  if (q === 'sido26' && (w !== 390 || run > 1)) continue; // 셋째 질의는 채움률만
  const t = await tab(port, w, h, mobile);
  const bodies = []; const reqs = new Map();
  t.on((m) => { if (m.method === 'Network.responseReceived' && /\/api\/search\/attractions\?/.test(m.params.response.url)) reqs.set(m.params.requestId, m.params.response.url); });
  await t.send('Network.setCacheDisabled', { cacheDisabled: true });
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT });
  if (q !== 'none') await t.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED(q.slice(4)) });
  const path = LOCAL ? (lang === 'en' ? '/place/en' : '/place') : (lang === 'en' ? '/en' : '/');
  await t.send('Page.navigate', { url: ORIG + path }); await sleep(3000); await settle(t);
  const bundle = await t.ev(BUNDLE_JS);
  const g = await t.ev(GEOM);
  if (run === 1 && w === 390) {
    for (const [rid, url] of reqs) { const b = await t.send('Network.getResponseBody', { requestId: rid }); try { const j = JSON.parse(b.body); const items = j.data?.attractions ?? []; bodies.push({ url, n: items.length, sigungu: items.filter((x) => x.sigunguName).length, region: items.filter((x) => x.region).length, ids: items.slice(0, 10).map((x) => x.id) }); } catch { bodies.push({ url, err: true }); } }
    res.fill.push({ lang, q, bodies });
  }
  if (run === 1 && w === 390 && q !== 'sido26') {
    await t.shot(`${out}/screens/after/hub-390-${lang}-${q}.png`, { x: 0, y: 0, width: 390, height: 844 });
    if (q === 'none') for (const [i, id] of SAME[lang].entries()) {
      const r = await t.ev(`(()=>{const c=document.getElementById('place-card-${id}');if(!c)return null;const b=c.getBoundingClientRect();return {x:b.left,y:b.top+scrollY,w:b.width,h:b.height}})()`);
      if (!r) { console.log('missing card', lang, id); continue; }
      const s = await t.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: Math.ceil(r.h), scale: 1 } });
      writeFileSync(`${out}/screens/after/card-390-${lang}-${String(i + 1).padStart(2, '0')}-${id}.png`, Buffer.from(s.data, 'base64'));
    }
  }
  if (run === 1 && w === 1440 && q !== 'sido26') await t.shot(`${out}/screens/after/hub-1440-${lang}-${q}.png`, { x: 0, y: 0, width: 1440, height: 900 });
  res.runs.push({ vp: `${w}x${h}`, lang, q, run, bundle, ...g });
  console.log(w, lang, q, run, bundle, g.count, g.median, g.max, g.firstY, g.cls, g.error || '');
  await t.close();
}
writeFileSync(`${out}/hub-after.json`, JSON.stringify(res, null, 1)); console.log('hub done'); process.exit(0);
