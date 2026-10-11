// TG6 상세 배포 후 — 390×844, TG1 과 같은 표본 12곳 × 3회 (SR-8.4·8.5)
// 판정 근거: 대상 페이지 DOM 사각형·hidden 속성·document.activeElement·layout-shift 항목
// 계측 전송(/api/v1/events)은 막는다 — 측정 클릭이 운영 원장에 들어가지 않게(원장 확인은 ledger.mjs 하나만)
import { writeFileSync, mkdirSync } from 'node:fs';
import { tab, sleep, BUNDLE_JS } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com', ONLY] = process.argv;
const LOCAL = /localhost|127\.0\.0\.1/.test(ORIG);
const IDS = { ko: [77, 4811, 16151, 12933, 2961, 47], en: [13863, 13808, 18083, 14580, 14367, 1658] };
const RUNS = ONLY ? 1 : 3;
const FOLD = 664; // TG1·직전 스펙과 같은 가시 기준
const CLS_INIT = `window.__cls=0;try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value;}}).observe({type:'layout-shift',buffered:true});}catch(e){}`;
const H = `const B=(e)=>e?e.getBoundingClientRect():null;const bar=document.querySelector('.place-action-bar');const hd=document.querySelector('.place-header');const jump=document.querySelector('.place-jump');`;
const TOP = `(()=>{${H}const act=document.querySelector('.place-detail-actions');const dir=act?[...act.querySelectorAll('a')].find(a=>/길찾기|Directions/i.test(a.textContent)):null;
 const D=(e)=>e?Math.round(e.getBoundingClientRect().bottom+scrollY):null;
 return {hasApp:!!document.querySelector('.place-page'),header:D(hd),actionsBottom:D(act),dirBottom:D(dir),first:D(document.querySelector('.place-detail-first')),
  phone:!!(act&&act.querySelector('a[href^="tel:"]')),bar:!!bar,barHidden:bar?bar.hidden:null,barDisplay:bar?getComputedStyle(bar).display:null,
  barCells:bar?bar.children.length:null,jump:jump?[...jump.querySelectorAll('a')].map(a=>a.getAttribute('href').slice(11)):null,
  headerH:getComputedStyle(document.querySelector('.place-page')).getPropertyValue('--place-header-h'),
  scrollPad:getComputedStyle(document.documentElement).scrollPaddingBottom,docH:document.documentElement.scrollHeight,js:${BUNDLE_JS}}})()`;
// 행동 줄 bottom 이 머리띠 bottom 위로 올라가게 스크롤하고 바가 나올 때까지의 시간(ms)
const REVEAL = `(async()=>{${H}const act=document.querySelector('.place-detail-actions');const y=act.getBoundingClientRect().bottom+scrollY-hd.getBoundingClientRect().bottom+8;
 scrollTo(0,y);const t0=performance.now();while(bar.hidden&&performance.now()-t0<2000)await new Promise(r=>requestAnimationFrame(r));
 const ms=Math.round(performance.now()-t0);await new Promise(r=>setTimeout(r,200));const b=B(bar);const cells=[...bar.children].map(c=>{const r=c.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]});
 const ab=act.getBoundingClientRect().bottom,hb=hd.getBoundingClientRect().bottom;
 return {ms,shown:!bar.hidden&&getComputedStyle(bar).display!=='none',actionsVsHeader:[Math.round(ab),Math.round(hb)],barTop:Math.round(b.top),barH:Math.round(b.height),vh:innerHeight,
  tabbarTop:(()=>{const t=document.querySelector('.kh-tabbar');return t&&getComputedStyle(t).display!=='none'?Math.round(t.getBoundingClientRect().top):null})(),cells,
  minCell:[Math.min(...cells.map(c=>c[0])),Math.min(...cells.map(c=>c[1]))]}})()`;
// 위로 되돌리면 다시 숨는가
const BACK = `(async()=>{${H}scrollTo(0,0);const t0=performance.now();while(!bar.hidden&&performance.now()-t0<2000)await new Promise(r=>requestAnimationFrame(r));return {hiddenAgain:bar.hidden,ms:Math.round(performance.now()-t0)}})()`;
const STICK = `(async()=>{${H}const f=document.querySelector('.place-detail-first');scrollTo(0,f.getBoundingClientRect().bottom+scrollY+300);await new Promise(r=>setTimeout(r,300));
 const j=B(jump),h=B(hd);return {jumpTop:Math.round(j.top*10)/10,jumpBottom:Math.round(j.bottom*10)/10,headerBottom:Math.round(h.bottom*10)/10,overlap:Math.max(0,Math.round((h.bottom-j.top)*10)/10),jumpH:Math.round(j.height)}})()`;
const END = `(async()=>{${H}for(let i=0;i<60;i++){scrollBy(0,600);await new Promise(r=>setTimeout(r,120));if(innerHeight+scrollY>=document.documentElement.scrollHeight-2)break;}
 await new Promise(r=>setTimeout(r,600));const page=document.querySelector('.place-page');let last=0;for(const c of page.querySelectorAll('*')){const r=c.getBoundingClientRect();if(r.height>0&&r.width>0&&getComputedStyle(c).position!=='fixed'&&!c.closest('.place-action-bar,.kh-tabbar'))last=Math.max(last,r.bottom);}
 const b=B(bar);return {barShown:!bar.hidden,barTop:Math.round(b.top),pageContentBottom:Math.round(last),gap:Math.round(b.top-last),pageBottom:Math.round(page.getBoundingClientRect().bottom)}})()`;
const JUMP = (k) => `(async()=>{${H}const a=jump.querySelectorAll('a')[${k}];if(!a)return null;const tgt=a.getAttribute('href').slice(1);a.click();await new Promise(r=>setTimeout(r,700));
 const s=document.getElementById(tgt);const j=B(jump);return {target:tgt,active:document.activeElement?.id||document.activeElement?.tagName,ok:document.activeElement===s,secTop:Math.round(s.getBoundingClientRect().top*10)/10,jumpBottom:Math.round(j.bottom*10)/10,
  belowJump:s.getBoundingClientRect().top>=j.bottom-1,hash:location.hash}})()`;
const FOCUS = `(()=>{${H}const e=document.activeElement;if(!e||e===document.body)return null;const r=e.getBoundingClientRect();let fixed=false;for(let n=e;n;n=n.parentElement){if(getComputedStyle(n).position==='fixed'){fixed=true;break;}}
 const b=B(bar);return {tag:e.tagName,cls:(typeof e.className==='string'?e.className:'').slice(0,40),txt:(e.textContent||'').trim().slice(0,16),top:Math.round(r.top),bottom:Math.round(r.bottom),fixed,inBar:!!e.closest('.place-action-bar'),barShown:!bar.hidden,barTop:Math.round(b.top)}})()`;
const res = { at: new Date().toISOString(), rows: [] };
mkdirSync(`${out}/screens/after`, { recursive: true });
for (const lang of ['ko', 'en']) for (const id of IDS[lang]) for (let run = 1; run <= RUNS; run++) {
  if (ONLY && String(id) !== ONLY) continue;
  const t = await tab(port, 390, 844, true);
  await t.send('Network.setCacheDisabled', { cacheDisabled: true });
  await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT });
  const url = LOCAL ? `${ORIG}/place${lang === 'en' ? '/en' : ''}/attractions/${id}` : `${ORIG}${lang === 'en' ? '/en' : ''}/attractions/${id}`;
  await t.send('Page.navigate', { url }); await sleep(6000);
  const row = { lang, id, run };
  row.top = await t.ev(TOP);
  row.top.fold = row.top.dirBottom != null && row.top.dirBottom <= FOLD;
  if (run === 1 && !ONLY && (id === 77 || id === 13808)) await t.shot(`${out}/screens/after/detail-390-${lang}-${id}-top.png`);
  row.clsLoad = +(+(await t.ev('window.__cls'))).toFixed(4);
  row.reveal = await t.ev(REVEAL);
  row.back = await t.ev(BACK);
  row.stick = row.top.jump ? await t.ev(STICK) : null;
  if (run === 1 && !ONLY && (id === 77 || id === 13808)) await t.shot(`${out}/screens/after/detail-390-${lang}-${id}-bar-jump.png`);
  row.end = await t.ev(END);
  if (run === 1 && !ONLY && (id === 77 || id === 13808)) await t.shot(`${out}/screens/after/detail-390-${lang}-${id}-end.png`);
  // CLS = 로드 + 끝까지 스크롤 + 이동 링크 1회
  row.jump1 = row.top.jump ? await t.ev(JUMP(0)) : null;
  await sleep(800);
  row.cls = +(+(await t.ev('window.__cls'))).toFixed(4);
  if (run === 1) {
    row.jumps = [];
    for (let k = 0; k < (row.top.jump?.length ?? 0); k++) { await t.ev(`scrollTo(0,document.documentElement.scrollHeight)`); await sleep(300); row.jumps.push(await t.ev(JUMP(k))); }
    // Tab 순회 — 위에서부터 본문을 돈다. 바 칸·고정 요소는 판정 밖(바 안이라 늘 바 top 아래)
    await t.ev(`scrollTo(0,0);document.activeElement&&document.activeElement.blur();true`); await sleep(400);
    const seen = []; const bad = [];
    for (let i = 0; i < 160; i++) {
      await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await sleep(60);
      const f = await t.ev(FOCUS); if (!f) continue; seen.push(f);
      if (!f.fixed && !f.inBar && f.barShown && f.bottom > f.barTop + 0.5) bad.push(f);
    }
    row.tab = { stops: seen.length, checkedWithBar: seen.filter((f) => !f.fixed && !f.inBar && f.barShown).length, hidden: bad.length, bad: bad.slice(0, 5) };
  }
  res.rows.push(row);
  console.log(lang, id, run, JSON.stringify({ fold: row.top.fold, barHidden: row.top.barHidden, shown: row.reveal?.shown, ms: row.reveal?.ms, back: row.back?.hiddenAgain, ov: row.stick?.overlap, gap: row.end?.gap, cls: row.cls, tab: row.tab && [row.tab.checkedWithBar, row.tab.hidden] }));
  await t.close();
}
writeFileSync(`${out}/detail-after${ONLY ? '-' + ONLY : ''}.json`, JSON.stringify(res, null, 1)); console.log('detail done'); process.exit(0);
