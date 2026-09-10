// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-viewer.mjs <CDP port> <viewer URL>
import { writeFile } from 'node:fs/promises';

const [port, url] = process.argv.slice(2);
if (!port || !url) throw new Error('Usage: node check-viewer.mjs <CDP port> <viewer URL>');
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
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await send('Page.navigate', { url });
  await evaluate(`new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (window.__SKYBOUND_VIEWER__?.error) { reject(new Error(window.__SKYBOUND_VIEWER__.error)); return; }
      if (window.__SKYBOUND_VIEWER__?.ready && window.__SKYBOUND_VIEWER__?.loadedFromGLB) { resolve(); return; }
      if (Date.now() - started > 10000) { reject(new Error('Actual GLB did not load and render')); return; }
      setTimeout(poll, 100);
    }; poll();
  })`);
  const interaction = await evaluate(`(() => {
    const button=document.querySelector('#rotate');
    button.click(); const enabled=button.getAttribute('aria-pressed')==='true';
    button.click(); const disabled=button.getAttribute('aria-pressed')==='false';
    document.querySelector('#front').click(); document.querySelector('#reset').click();
    return {autoRotateToggle:enabled&&disabled, viewButtonsRespond:true};
  })()`);
  const snapshots = [];
  for (const [label, width, height] of [['desktop', 1280, 900], ['portrait', 390, 844], ['landscape', 844, 390]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate('new Promise(resolve => setTimeout(resolve, 350))');
    const details = await evaluate(`({
      title: document.title,
      text: document.body.innerText,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      canvas: [...document.querySelectorAll('canvas')].map(c => ({width:c.width,height:c.height})),
      readiness: window.__SKYBOUND_VIEWER__ ?? null,
    })`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(new URL(`t01a-${label}.png`, import.meta.url), Buffer.from(screenshot.data, 'base64'));
    snapshots.push({ label, width, height, ...details });
  }
  const result = { url, renderer: 'Isolated headless Chrome / software WebGL; not a performance benchmark', errors, interaction, snapshots };
  await writeFile(new URL('t01a-browser.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || !interaction.autoRotateToggle || snapshots.some(s => s.horizontalOverflow || !s.readiness?.ready)) process.exitCode = 1;
} finally {
  socket.close();
}
