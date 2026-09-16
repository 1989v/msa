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
    }, 45000);
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
 const lost=await evaluate(`(async()=>{const s=window.__SKYBOUND_TRAVERSAL__;s.resetForTest({stoneRuinActive:true});s.resume();window.__graphicsExtension=document.querySelector('#viewer').getContext('webgl2').getExtension('WEBGL_lose_context');if(!window.__graphicsExtension)throw new Error('Context loss extension unavailable');window.__graphicsExtension.loseContext();await new Promise(r=>setTimeout(r,150));const before={...s.snapshot.position},tick=s.snapshot.tick;s.resume();await new Promise(r=>setTimeout(r,100));window.__beforeRestore={position:before,tick};return{paused:s.paused,tick:s.snapshot.tick,passed:s.graphicsLost===true&&s.paused&&s.snapshot.tick===tick&&document.querySelector('#start').disabled};})()`);
 checks.push({name:'loss pauses and prevents accidental resume',...lost});if(!lost.passed)throw new Error('Loss guard failed');
 const restored=await evaluate(`(async()=>{const s=window.__SKYBOUND_TRAVERSAL__;window.__graphicsExtension.restoreContext();await new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(s.graphicsLost===false)return resolve();if(Date.now()-t>15000)return reject(new Error('restore timeout'));setTimeout(poll,50)};poll()});return{error:s.error,paused:s.paused,position:s.snapshot.position,passed:!s.error&&s.paused&&!document.querySelector('#start').disabled&&JSON.stringify(s.snapshot.position)===JSON.stringify(window.__beforeRestore.position)&&s.snapshot.progress.stoneRuinActive===true};})()`);
 checks.push({name:'GPU restore preserves place and progress without autoplay',...restored});if(!restored.passed)throw new Error('Restore failed');
 const resume=await evaluate(`(async()=>{const s=window.__SKYBOUND_TRAVERSAL__,tick=s.snapshot.tick;document.querySelector('#start').click();await new Promise(r=>setTimeout(r,250));const passed=!s.paused&&s.snapshot.tick>tick&&!s.error;s.pause();return{passed,tick:s.snapshot.tick};})()`);checks.push({name:'deliberate resume advances restored renderer',...resume});
 console.log(JSON.stringify({checks,errors}));if(errors.length||checks.some(c=>!c.passed))throw new Error('Graphics recovery failed');
}finally{await writeFile(new URL('./graphics-recovery.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
