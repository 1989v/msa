// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-texture.mjs <CDP port> <viewer URL> [artifact label]
import { writeFile } from 'node:fs/promises';

const [port, url] = process.argv.slice(2);
if (!port || !url) throw new Error('Usage: node check-texture.mjs <CDP port> <viewer URL>');
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fixture HTTP ${response.status}`);
  await send('Page.enable');
  await send('Runtime.enable');
  const navigation = await send('Page.navigate', { url });
  if (navigation.errorText) throw new Error(navigation.errorText);
  const result = await evaluate(`new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const state = window.__SKYBOUND_TEXTURE_CHECK__;
      if (state?.ready) return resolve(state);
      if (Date.now() - started > 10000) return reject(new Error('Texture probe timeout'));
      setTimeout(poll, 50);
    }; poll();
  })`);
  const { glbBase64, pngBase64, ...report } = result;
  const output = { url, browser: await send('Browser.getVersion'), ...report, errors };
  await writeFile(new URL('t02b-2-browser.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
  if (!result.passed || errors.length || !result.checks?.length || result.checks.some(c => !c.passed)) {
    throw new Error(JSON.stringify(output));
  }
  const directory = new URL('../implementation/t02b/texture-check/', import.meta.url);
  await writeFile(new URL('diagnostic-texture.glb', directory), Buffer.from(glbBase64, 'base64'));
  await writeFile(new URL('diagnostic-atlas.png', directory), Buffer.from(pngBase64, 'base64'));
  console.log(JSON.stringify(output, null, 2));
} finally {
  socket.close();
}
