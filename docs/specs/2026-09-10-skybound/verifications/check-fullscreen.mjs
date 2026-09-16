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
  const result = await send('Runtime.evaluate', { expression, userGesture: true, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}






const checks=[];
async function check(name,expression){const result=await evaluate(expression);checks.push({name,...result});if(!result.passed)throw new Error(name);}
try {
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url});
 await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
 await check('enter fullscreen pauses without hiding game controls',`(async()=>{const s=window.__SKYBOUND_TRAVERSAL__;s.resume();const button=document.querySelector('#toggle-fullscreen');if(button.hidden)throw new Error('Fullscreen unavailable');button.click();await new Promise(r=>setTimeout(r,250));return{paused:s.paused,passed:document.fullscreenElement===document.querySelector('main')&&button.getAttribute('aria-pressed')==='true'&&s.paused&&document.fullscreenElement.contains(document.querySelector('#open-map'))};})()`);
 await check('map in fullscreen preserves pause and close focus',`(()=>{document.querySelector('#open-map').click();const opened=document.querySelector('#map-dialog').open;document.querySelector('#close-map').click();return{passed:opened&&!document.querySelector('#map-dialog').open&&window.__SKYBOUND_TRAVERSAL__.paused&&!!document.fullscreenElement};})()`);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./fullscreen.png',import.meta.url),Buffer.from(shot.data,'base64'));
 await check('exit fullscreen restores button and remains paused',`(async()=>{document.querySelector('#toggle-fullscreen').click();await new Promise(resolve=>{const started=Date.now();const poll=()=>{if((!document.fullscreenElement&&document.querySelector('#toggle-fullscreen').getAttribute('aria-pressed')==='false')||Date.now()-started>4000)return resolve();setTimeout(poll,50)};poll()});return{fullscreen:document.fullscreenElement?.tagName,pressed:document.querySelector('#toggle-fullscreen').getAttribute('aria-pressed'),disabled:document.querySelector('#toggle-fullscreen').disabled,paused:window.__SKYBOUND_TRAVERSAL__.paused,passed:!document.fullscreenElement&&document.querySelector('#toggle-fullscreen').getAttribute('aria-pressed')==='false'&&window.__SKYBOUND_TRAVERSAL__.paused};})()`);
 await check('denied fullscreen remains recoverable',`(async()=>{const root=document.querySelector('main'),original=root.requestFullscreen;root.requestFullscreen=()=>Promise.reject(new Error('denied'));document.querySelector('#toggle-fullscreen').click();await new Promise(r=>setTimeout(r,50));root.requestFullscreen=original;return{passed:!document.fullscreenElement&&!document.querySelector('#toggle-fullscreen').disabled&&!window.__SKYBOUND_TRAVERSAL__.error&&document.querySelector('#travel-notice').textContent.includes('현재 화면')};})()`);
 console.log(JSON.stringify({checks,errors}));if(errors.length)throw new Error('Browser errors');
}finally{await writeFile(new URL('./fullscreen.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
