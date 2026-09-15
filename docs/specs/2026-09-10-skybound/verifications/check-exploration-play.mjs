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
  await send('Page.enable'); await send('Runtime.enable'); await send('Page.navigate', {url});
  await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
  const boot = await evaluate(`window.__SKYBOUND_TRAVERSAL__.error`); if(boot) throw new Error(boot);
  await evaluate(`window.__SKYBOUND_TRAVERSAL__.resetForTest();window.__SKYBOUND_TRAVERSAL__.resume();document.querySelector('#open-hints').click()`);
  const hints = await evaluate(`(()=>{const d=document.querySelector('#hint-dialog'); const first=document.querySelectorAll('#hint-steps li').length;document.querySelector('#next-hint').click();document.querySelector('#next-hint').click();return{open:d.open,paused:window.__SKYBOUND_TRAVERSAL__.paused,first,last:document.querySelectorAll('#hint-steps li').length,disabled:document.querySelector('#next-hint').disabled}})()`);
  checks.push({name:'opt-in hints pause and reveal three stages',passed:hints.open&&hints.paused&&hints.first===1&&hints.last===3&&hints.disabled,...hints});
  await evaluate(`document.querySelector('#close-hints').click();new Promise(r=>setTimeout(r,50))`);
  checks.push({name:'hint close resumes prior play state',passed:await evaluate(`!window.__SKYBOUND_TRAVERSAL__.paused`)});
  const recenter = await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;s.pause();s.setCameraForTest({yaw:1.4,distance:6});document.querySelector('#recenter-camera').click();return {yaw:s.camera.yaw,distance:s.camera.distance}})()`);
  checks.push({name:'recenter faces forward and preserves zoom',passed:Math.abs(recenter.yaw)<.001&&recenter.distance===6,...recenter});
  const visits = await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;s.resetForTest();const visited=[];for(const [x,z] of [[-8,35],[-12,10],[-12,0],[12,-15],[0,-42]]){let ticks=0;while(ticks++<1800){const p=s.snapshot.position,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<2)break;s.advanceForTest(.05,{x:dx/d,z:dz/d});}visited.push({x,z,position:{...s.snapshot.position},ticks});}document.querySelector('#open-map').click();return{visited,discoveries:s.snapshot.progress.discoveries,rows:document.querySelectorAll('#map-locations li').length,summary:document.querySelector('#map-summary').textContent,error:s.error}})()`);
  checks.push({name:'walk across all three survey sites and show journal',passed:['west-survey','east-survey','north-survey'].every(id=>visits.discoveries.includes(id))&&visits.rows===visits.discoveries.length&&!visits.error,...visits});
  console.log(JSON.stringify({checks,errors:errors.length}));
  if(errors.length||checks.some(check=>!check.passed))throw new Error('Exploration integration failed');
} finally {await writeFile(new URL('./exploration-play.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
