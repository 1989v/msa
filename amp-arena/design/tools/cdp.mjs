// CDP 로 탭 하나 열어 찍고 닫는다. 크롬은 scripts/cdp-chrome.sh 가 띄우고 끈다.
import { writeFileSync } from 'node:fs';

export async function shoot({ port, url, out, width = 1280, height = 720, settle = 400 }) {
  const created = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  const events = new Map();
  const consoleErrors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails?.text ?? 'exception');
    } else if (m.method && events.has(m.method)) {
      events.get(m.method)(m.params);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (method) => new Promise((resolve) => events.set(method, resolve));
  await new Promise((r) => ws.addEventListener('open', r));
  try {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.enable');
    await send('Runtime.enable');
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url });
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 8000))]);
    await send('Runtime.evaluate', {
      expression: `document.fonts.ready.then(() => new Promise(r => setTimeout(r, ${settle})))`,
      awaitPromise: true,
    });
    const info = await send('Runtime.evaluate', {
      expression: 'JSON.stringify({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })',
      returnByValue: true,
    });
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    return { out, info: JSON.parse(info.result.value), errors: consoleErrors };
  } finally {
    await fetch(`http://127.0.0.1:${port}/json/close/${created.id}`);
    ws.close();
  }
}
