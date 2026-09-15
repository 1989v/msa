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
  const result=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s.error)throw new Error(s.error);s.resetForTest();for(let i=0;i<10;i++)s.advanceForTest(.25,{z:-1});const stopped=s.snapshot.position.z;s.advanceForTest(.25,{z:-1,dodgePressed:true});const dodged=s.snapshot.position.z;s.advanceForTest(.25,{z:1});return {stopped,dodged,away:s.snapshot.position.z};})()`);
  checks.push({name:'walk/dodge blocked by actual prism; can retreat',passed:result.stopped>=33.6&&result.stopped<34&&result.dodged>=33.6&&result.away>result.dodged,...result});
  await evaluate(`document.querySelector('#open-settings').click();document.querySelector('#safe-return').click()`);
  const notice=await evaluate(`({visible:!document.querySelector('#travel-notice').hidden,text:document.querySelector('#travel-notice').textContent,position:window.__SKYBOUND_TRAVERSAL__.snapshot.position})`);
  checks.push({name:'safe return explains preserved progress',passed:notice.visible&&notice.text.includes('탐험 기록')&&notice.position.x===0&&notice.position.z===35,...notice});
  console.log(JSON.stringify({checks,errors:errors.length}));
  if(errors.length||checks.some(check=>!check.passed))throw new Error('Solid integration failed');
} finally {await writeFile(new URL('./solid-play.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
