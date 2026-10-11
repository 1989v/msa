// TG6 원장 도착 — 사람 UA(모바일 Pixel 8) 세션에서 바 길찾기·공유·전화·이동 링크를 한 번씩 누르고
// 화면이 실제로 보낸 /api/v1/events 요청 본문(viewId)과 응답을 남긴다. 원장 행은 ssh msa-oci ClickHouse 로 따로 본다
import { writeFileSync } from 'node:fs';
import { tab, sleep } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
const t = await tab(port, 390, 844, true);
const sent = []; const resp = new Map();
t.on((m) => {
  if (m.method === 'Network.requestWillBeSent' && /\/api\/v1\/events/.test(m.params.request.url)) sent.push({ id: m.params.requestId, at: new Date().toISOString(), body: m.params.request.postData });
  if (m.method === 'Network.responseReceived' && /\/api\/v1\/events/.test(m.params.response.url)) resp.set(m.params.requestId, m.params.response.status);
});
const ua = await t.ev('navigator.userAgent');
await t.send('Page.navigate', { url: `${ORIG}/attractions/77` }); await sleep(7000);
// 새 탭·tel: 이동은 막는다 — 계측은 React onClick 이 그대로 보낸다
await t.ev(`window.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&(a.target==='_blank'||a.href.startsWith('tel:')))e.preventDefault()},true);true`);
await t.ev(`(()=>{const f=document.querySelector('.place-detail-first');scrollTo(0,f.getBoundingClientRect().bottom+scrollY+300)})()`); await sleep(1200);
const clicks = await t.ev(`(async()=>{const b=document.querySelector('.place-action-bar');const o={barShown:!b.hidden};
  const w=()=>new Promise(r=>setTimeout(r,400));
  b.querySelector('a.place-action-bar__cell').click();o.dir=true;await w();
  const s=b.querySelector('.share-panel__btn');o.shareText=s.textContent.trim();s.click();o.share=true;await w();
  const p=b.querySelector('a[href^="tel:"]');if(p){p.click();o.phone=true;}await w();
  const j=document.querySelector('.place-jump a[href="#place-sec-info"]')||document.querySelector('.place-jump a');o.jumpTarget=j.getAttribute('href');j.click();o.jump=true;return o})()`);
await sleep(7000);
for (const s of sent) { s.status = resp.get(s.id) ?? null; try { const b = await t.send('Network.getResponseBody', { requestId: s.id }); s.respBody = b.body?.slice(0, 300); } catch {} }
const events = sent.flatMap((s) => { try { const j = JSON.parse(s.body); return (j.events ?? j).map((e) => ({ action: e.action, sectionId: e.sectionId, entityId: e.entityId, viewId: e.viewId, payload: e.payload, status: s.status, resp: s.respBody })); } catch { return [{ raw: s.body?.slice(0, 200), status: s.status }]; } });
const res = { at: new Date().toISOString(), ua, clicks, events };
writeFileSync(`${out}/ledger.json`, JSON.stringify(res, null, 1));
console.log(ua); console.log(JSON.stringify(clicks)); for (const e of events) console.log(JSON.stringify(e).slice(0, 260));
await t.close(); process.exit(0);
