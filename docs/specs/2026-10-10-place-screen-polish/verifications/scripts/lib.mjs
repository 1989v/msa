import { writeFileSync } from 'node:fs';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const UA_DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
export const UA_MOB = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
export async function openTab(port) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = new Map(); const handlers = [];
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? { __error: m.error }); pend.delete(m.id); } else if (m.method) handlers.forEach((h) => h(m)); };
  await new Promise((r) => (ws.onopen = r));
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) return { __exc: r.exceptionDetails.exception?.description }; return r.result?.value; };
  const shot = async (file, clip) => { const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' }); writeFileSync(file, Buffer.from(r.data, 'base64')); };
  const close = async () => { try { await send('Page.close'); } catch {} ws.close(); };
  // :hover·:focus-visible 강제 — 선택자의 첫 요소에. 이전 강제는 해제한다
  let forced = null;
  const force = async (selector, classes) => {
    if (forced) { await send('CSS.forcePseudoState', { nodeId: forced, forcedPseudoClasses: [] }); forced = null; }
    if (!selector) return true;
    const doc = await send('DOM.getDocument', { depth: 0 });
    const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    if (!q?.nodeId) return false;
    await send('CSS.forcePseudoState', { nodeId: q.nodeId, forcedPseudoClasses: classes });
    forced = q.nodeId; await sleep(700); return true;
  };
  return { send, ev, shot, close, force, on: (h) => handlers.push(h) };
}
export async function tab(port, w, h, mobile, { dev, site, origin } = {}) {
  const t = await openTab(port);
  await t.send('Page.enable'); await t.send('Runtime.enable'); await t.send('Network.enable'); await t.send('DOM.enable'); await t.send('CSS.enable');
  await t.send('Network.setUserAgentOverride', { userAgent: mobile ? UA_MOB : UA_DESK });
  await t.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  if (dev) await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dev }] });
  // 운영은 .1989v.com 전 호스트, 로컬 프리뷰는 그 주소 하나에 사이트 정경 쿠키를 심는다
  if (site) await t.send('Network.setCookie', origin && /localhost|127\.0\.0\.1/.test(origin)
    ? { name: 'kh-theme', value: site, url: origin, path: '/' }
    : { name: 'kh-theme', value: site, domain: '.1989v.com', path: '/', secure: true });
  return t;
}
// 대비 — 글자 계산값 색 + 바탕 층 합성(표준 §4·§4.5). 조상 opacity<1 은 묶음 투명도로 합성한다
export const CONTRAST_JS = `
const __parse=(c)=>{const n=(c.match(/-?[\\d.]+(?:e-?\\d+)?/g)||[]).map(Number);const s=c.startsWith('color(');const [r,g,b,a]=s?n:[n[0]/255,n[1]/255,n[2]/255,n[3]];return [r,g,b,a===undefined?1:a];};
const __over=(f,b)=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3]));
const __lum=(c)=>{const l=c.map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*l[0]+0.7152*l[1]+0.0722*l[2];};
const __rootBg=()=>{const r=getComputedStyle(document.documentElement).backgroundColor;return r&&r!=='rgba(0, 0, 0, 0)'?r:(getComputedStyle(document.body).backgroundColor||'rgb(255, 255, 255)');};
const __layers=(el,stop)=>{const st=[];for(let n=el;n&&n!==stop;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(!c||c==='rgba(0, 0, 0, 0)'||c==='transparent')continue;st.push(c);if(!stop&&__parse(c)[3]>=0.999)break;}return st;};
const __comp=(st,base)=>{let acc=base;for(let i=st.length-1;i>=0;i--){acc=__over(__parse(st[i]),[...acc,1]);}return acc;};
const __bgOf=(el)=>{const st=__layers(el,null);let base;if(st.length&&__parse(st[st.length-1])[3]>=0.999){base=__parse(st.pop()).slice(0,3);}else base=__parse(__rootBg()).slice(0,3);return {rgb:__comp(st,base),n:st.length+1};};
const __opEl=(el)=>{let op=1,o=null;for(let n=el;n;n=n.parentElement){const v=parseFloat(getComputedStyle(n).opacity);if(v<1){op*=v;o=o||n;}}return {op,o};};
const __hex=(c)=>'#'+c.map(v=>Math.round(Math.min(1,Math.max(0,v))*255).toString(16).padStart(2,'0')).join('');
const __ratio=(a,b)=>{const L1=__lum(a),L2=__lum(b);return Math.round((Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)*100)/100;};
const __cr=(el,label)=>{if(!el)return {label,missing:true};const cs=getComputedStyle(el);const f=__parse(cs.color);
  const {op,o}=__opEl(el);let bg,fg,layers;
  if(op<1&&o){const outer=__bgOf(o.parentElement).rgb;const inner=__comp(__layers(el,o.parentElement),outer);
    const fgIn=f[3]<1?__over(f,[...inner,1]):f.slice(0,3);bg=[0,1,2].map(i=>op*inner[i]+(1-op)*outer[i]);fg=[0,1,2].map(i=>op*fgIn[i]+(1-op)*outer[i]);layers='op'+Math.round(op*100)/100;}
  else{const b=__bgOf(el);bg=b.rgb;fg=f[3]<1?__over(f,[...bg,1]):f.slice(0,3);layers=b.n;}
  return {label,text:(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,24),cls:(typeof el.className==='string'?el.className:'').slice(0,60),fg:__hex(fg),bg:__hex(bg),layers,fontPx:parseFloat(cs.fontSize),weight:cs.fontWeight,ratio:__ratio(fg,bg)};};
const __tok=(name,scope)=>{const s=document.createElement('span');s.style.color='var('+name+')';(scope||document.body).appendChild(s);const c=getComputedStyle(s).color;s.remove();return c;};
const __texts=(root)=>{const out=[];const seen=new Set();const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){if(!n.textContent.trim())continue;const el=n.parentElement;if(!el||seen.has(el))continue;seen.add(el);const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
   const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')continue;const c=__cr(el,el.tagName.toLowerCase());c.isEmpty=!!el.closest('.is-empty');out.push(c);}return out;};
`;
export const BUNDLE_JS = `[...document.scripts].map(x=>x.src).filter(x=>/assets\\/index-/.test(x)).map(x=>x.split('/').pop())`;
