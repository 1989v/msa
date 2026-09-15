// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-menus.mjs <CDP port> <viewer URL> [artifact label]
import { writeFile } from 'node:fs/promises';

const [port, url, artifact = 'beta-play'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-menus.mjs <CDP port> <viewer URL>');
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((entry) => entry.type === 'page');
if (!page) throw new Error('No page in isolated browser');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value || arg.description));
  }
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}






const checks=[];
try {
  await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url});
  await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
  await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s.error)throw new Error(s.error);for(let i=0;i<4;i++)s.advanceForTest(.25,{x:-1,sprint:true});})()`);
  for(const [label,width,height] of [['portrait',390,844],['landscape',667,375]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await evaluate(`document.querySelector('#viewer').scrollIntoView({block:'center'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const check=await evaluate(`(()=>{const a=document.querySelector('.player-vitals').getBoundingClientRect(),b=document.querySelector('.carry-controls').getBoundingClientRect(),fill=document.querySelector('#player-stamina span'),st=document.querySelector('#player-stamina');return {noOverlap:a.bottom<=b.top,overflow:document.documentElement.scrollWidth>innerWidth,prismHidden:document.querySelector('#manipulate').hidden&&document.querySelector('#carry-hint').hidden,fill:getComputedStyle(fill).backgroundColor,shown:Number(st.getAttribute('aria-valuenow')),expected:Math.round(window.__SKYBOUND_TRAVERSAL__.snapshot.stamina),cameraValid:window.__SKYBOUND_TRAVERSAL__.camera.actualDistance>0&&window.__SKYBOUND_TRAVERSAL__.camera.actualDistance<=window.__SKYBOUND_TRAVERSAL__.camera.distance+1e-6,compassVisible:document.querySelector('#compass-destination').textContent.includes(window.__SKYBOUND_TRAVERSAL__.navigation.label)};})()`);
    checks.push({label,...check});
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(`./hud-${label}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
    if(!check.noOverlap||check.overflow||!check.prismHidden||!check.cameraValid||!check.compassVisible||check.fill==='rgba(0, 0, 0, 0)'||check.shown!==check.expected)throw new Error('HUD check failed');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#open-map').click();new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  const journal=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {notes:document.querySelectorAll('.journal-note').length,discovered:s.snapshot.progress.discoveries.length,nonempty:[...document.querySelectorAll('.journal-note')].every(p=>p.textContent.length>10)};})()`);
  checks.push({label:'journal',...journal});
  if(journal.notes!==journal.discovered||!journal.nonempty)throw new Error('Journal discovery mismatch');
  const mapShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./journal-map.png',import.meta.url),Buffer.from(mapShot.data,'base64'));
  if(errors.length)throw new Error('Browser error');
  console.log(JSON.stringify({checks,errors:errors.length}));
} finally {await writeFile(new URL('./hud-check.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
