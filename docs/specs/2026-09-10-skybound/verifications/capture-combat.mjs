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






try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});
  await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-start>15000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
  const result=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s.error)throw new Error(s.error);s.resetForTest();for(let i=0;i<4;i++)s.advanceForTest(.25,{x:-1});for(let i=0;i<7;i++)s.advanceForTest(.25,{z:-1});for(let i=0;i<240&&s.charger.phase!=='windup';i++)s.advanceForTest(1/120,{});for(let i=0;i<36&&s.charger.phase==='windup';i++)s.advanceForTest(1/120,{});return {position:s.snapshot.position,charger:s.charger,health:s.health};})()`);
  await evaluate(`document.querySelector('#viewer').scrollIntoView({block:'center'})`);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL('./combat-readability.png',import.meta.url),Buffer.from(shot.data,'base64'));
  await writeFile(new URL('./combat-readability.json',import.meta.url),JSON.stringify({result,errors,scope:'Local desktop deterministic combat view capture; no full combat playthrough'},null,2)+'\n');
  console.log(JSON.stringify({phase:result.charger.phase,errors:errors.length}));
  if(errors.length)throw new Error('Browser errors');
} finally {socket.close();}
