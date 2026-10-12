// 상세 탭바 제거 · 행동 바 위치 측정 (390×844 모바일).
// 판정 근거 = 대상 페이지의 DOM 노드 존재·getBoundingClientRect·계산 스타일. 기대값은 뷰포트 높이에서 온다.
// 사용: node measure.mjs <CDP 포트> <원천 주소> <출력 디렉토리> <상세 id>
import { writeFileSync } from 'node:fs';

const [port, origin, out, detailId] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA_MOB = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? { __error: m.error }); pend.delete(m.id); } };
await new Promise((r) => (ws.onopen = r));
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? { __exc: r.exceptionDetails.exception?.description } : r.result?.value; };
const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.data, 'base64')); };

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Network.setUserAgentOverride', { userAgent: UA_MOB });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

async function open(path, ready) {
  await send('Page.navigate', { url: origin + path });
  for (let i = 0; i < 60; i++) { await sleep(250); if (await ev(ready)) return true; }
  return false;
}

const bundle = `[...document.scripts].map(s=>s.src.split('/').pop()).filter(Boolean)`;
const result = {};

// ── 상세 ──
const detailReady = await open(`/attractions/${detailId}`, `!!document.querySelector('.place-action-bar') && !!document.querySelector('h1')`);
result.detail = { ready: detailReady, scripts: await ev(bundle), title: await ev(`document.querySelector('h1')?.textContent`) };
result.detail.tabbarNode = await ev(`document.querySelectorAll('.kh-tabbar').length`);
result.detail.dataTabbar = await ev(`document.documentElement.dataset.tabbar ?? null`);
result.detail.shellBottomVar = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--kh-shell-bottom') || '(없음)'`);

// 바는 행동 줄이 머리띠 밑으로 지나간 뒤에만 보인다 — 첫 화면은 숨김
result.detail.barHiddenAtTop = await ev(`document.querySelector('.place-action-bar').hidden`);
await ev(`window.scrollTo(0, 1400)`); await sleep(800);
const BAR = `(()=>{const b=document.querySelector('.place-action-bar');const r=b.getBoundingClientRect();const cs=getComputedStyle(b);
  return {hidden:b.hidden,top:r.top,bottom:r.bottom,height:r.height,innerHeight:innerHeight,cssBottom:cs.bottom,marginBottom:cs.marginBottom,paddingBottom:cs.paddingBottom};})()`;
result.detail.barMid = await ev(BAR);

// 문서 끝 — 바 바깥의 보이는 글자·컨트롤 중 가장 아래 것
await ev(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(800);
result.detail.barEnd = await ev(BAR);
result.detail.lastContent = await ev(`(()=>{const bar=document.querySelector('.place-action-bar');let best=null;
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);let n;
  while((n=w.nextNode())){if(bar.contains(n))continue;const own=[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())||/^(A|BUTTON|IMG|INPUT|SVG)$/i.test(n.tagName);
    if(!own)continue;const r=n.getBoundingClientRect();if(!r.width||!r.height)continue;const cs=getComputedStyle(n);if(cs.visibility==='hidden'||cs.display==='none')continue;
    if(cs.position==='fixed')continue;
    if(!best||r.bottom>best.bottom)best={tag:n.tagName.toLowerCase(),cls:String(n.className).slice(0,40),text:(n.textContent||'').trim().slice(0,30),bottom:r.bottom};}
  return best;})()`);
result.detail.scrollPaddingBottom = await ev(`getComputedStyle(document.documentElement).scrollPaddingBottom`);
result.detail.atEnd = await ev(`Math.round(scrollY+innerHeight)>=document.documentElement.scrollHeight-1`);
await shot(`${out}/detail-390-ko-${detailId}-end.png`);

// ── 허브 ──
const hubReady = await open('/', `!!document.querySelector('.kh-tabbar') && !!document.querySelector('.place-page') && !document.body.textContent.includes('로딩…')`);
await sleep(1500);
result.hub = {
  ready: hubReady,
  scripts: await ev(bundle),
  tabbarNode: await ev(`document.querySelectorAll('.kh-tabbar').length`),
  dataTabbar: await ev(`document.documentElement.dataset.tabbar ?? null`),
  tabs: await ev(`[...document.querySelectorAll('.kh-tabbar-item')].map(e=>e.textContent.trim())`),
  tabbarRect: await ev(`(()=>{const r=document.querySelector('.kh-tabbar').getBoundingClientRect();return {top:r.top,bottom:r.bottom,innerHeight}})()`),
  actionBar: await ev(`document.querySelectorAll('.place-action-bar').length`),
};
await shot(`${out}/hub-390-ko.png`);

console.log(JSON.stringify(result, null, 2));
writeFileSync(`${out}/measure.json`, JSON.stringify(result, null, 2) + '\n');
try { await send('Page.close'); } catch {}
ws.close();
