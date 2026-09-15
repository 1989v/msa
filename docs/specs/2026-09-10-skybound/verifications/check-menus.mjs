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





const checks = [];
async function check(name, expression) {
  const passed = await evaluate(expression);
  checks.push({ name, passed: passed === true });
  if (passed !== true) throw new Error(name + ': ' + JSON.stringify(await evaluate('({ready:window.__SKYBOUND_TRAVERSAL__.ready,paused:window.__SKYBOUND_TRAVERSAL__.paused,error:window.__SKYBOUND_TRAVERSAL__.error,charger:window.__SKYBOUND_TRAVERSAL__.charger})')));
  console.log(`PASS: ${name}`);
}
async function waitFor(expression) {
  await evaluate(`new Promise((resolve,reject)=>{const started=Date.now();const poll=()=>{if(${expression})return resolve();if(Date.now()-started>12000)return reject(new Error('Ready timeout'));setTimeout(poll,50)};poll()})`);
}
const s = 'window.__SKYBOUND_TRAVERSAL__';
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  await waitFor(`${s}?.ready === true`);
  await check('boots paused with charger and no game error', `${s}.paused && !!${s}.charger && !${s}.error`);
  await evaluate(`document.querySelector('#start').click()`);
  await waitFor(`${s}.paused === false`);
  await evaluate(`document.querySelector('#open-map').click()`);
  await check('map pauses and lists discovered camp', `document.querySelector('#map-dialog').open && ${s}.paused && document.querySelector('#map-locations').children.length > 0`);
  await evaluate(`document.querySelector('#close-map').click()`);
  await waitFor(`${s}.paused === false`);
  await evaluate(`document.querySelector('#open-settings').click()`);
  await check('settings pause play', `document.querySelector('#settings-dialog').open && ${s}.paused`);
  await evaluate(`(()=>{const input=document.querySelector('#render-quality');input.value='light';input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await check('graphics preference persists', `JSON.parse(localStorage.getItem('skybound.settings.v1')).quality === 'light'`);
  const before = await evaluate(`JSON.stringify(${s}.snapshot.progress)`);
  await evaluate(`document.querySelector('#safe-return').click()`);
  await waitFor(`${s}.paused === false`);
  await check('safe return preserves progress', `JSON.stringify(${s}.snapshot.progress) === ${JSON.stringify(before)} && Math.abs(${s}.snapshot.position.x) < .01 && Math.abs(${s}.snapshot.position.z-35)<.01`);
  await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape'});
  await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape'});
  await check('Escape pauses and labels continue', `${s}.paused && document.querySelector('#start').textContent === '계속하기'`);
  await send('Page.reload'); await waitFor(`${s}?.ready === true`);
  await check('reload offers saved continuation', `${s}.paused && document.querySelector('#start').textContent === '이어하기'`);
  if(errors.length) throw new Error(JSON.stringify(errors));
  await writeFile(new URL('./menus-smoke.json', import.meta.url), JSON.stringify({checkedAt:new Date().toISOString(),url,checks,errors,limits:'Desktop DOM/input smoke only; no audio audition, visual, mobile or full journey validation.'},null,2)+'\n');
} finally { socket.close(); }
