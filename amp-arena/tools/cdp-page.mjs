// 헤드리스 크롬 탭 하나를 CDP 로 조작한다 (클릭·키 입력·평가·스크린샷·콘솔 오류 수집).
// 크롬은 scripts/cdp-chrome.sh start <이름> --gl 로 띄운다 (WebGL 필요).
import { writeFileSync } from 'node:fs';

export class Page {
  constructor(port) { this.port = port; this.seq = 0; this.pending = new Map(); this.events = new Map(); this.errors = []; this.logs = []; }

  async open(url, { width = 1280, height = 720 } = {}) {
    const created = await (await fetch(`http://127.0.0.1:${this.port}/json/new?about:blank`, { method: 'PUT' })).json();
    this.id = created.id;
    this.ws = new WebSocket(created.webSocketDebuggerUrl);
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
      if (m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? 'exception');
      else if (m.method === 'Runtime.consoleAPICalled') {
        const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        this.logs.push(`[${m.params.type}] ${text}`);
        if (m.params.type === 'error') this.errors.push(text);
      } else if (m.method && this.events.has(m.method)) this.events.get(m.method)(m.params);
    });
    await new Promise((r) => this.ws.addEventListener('open', r));
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    const loaded = new Promise((resolve) => this.events.set('Page.loadEventFired', resolve));
    await this.send('Page.navigate', { url });
    await Promise.race([loaded, this.sleep(8000)]);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => { const id = ++this.seq; this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }

  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result.value;
  }

  async click(selector) {
    const ok = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`no element: ${selector}`);
  }

  async type(selector, text) {
    await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  }

  async waitFor(expression, { timeout = 10000, every = 100 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await this.eval(`!!(${expression})`)) return true;
      await this.sleep(every);
    }
    throw new Error(`timeout waiting: ${expression}`);
  }

  keyDown(code, key = code) { return this.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode(key) }); }
  keyUp(code, key = code) { return this.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode(key) }); }
  async tap(code, key = code, ms = 40) { await this.keyDown(code, key); await this.sleep(ms); await this.keyUp(code, key); }
  async hold(code, key, ms) { await this.keyDown(code, key); await this.sleep(ms); await this.keyUp(code, key); }

  async shot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
    return path;
  }

  async close() {
    try { await fetch(`http://127.0.0.1:${this.port}/json/close/${this.id}`); } catch {}
    this.ws?.close();
  }
}

function keyCode(key) {
  const map = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Shift: 16, Enter: 13, ' ': 32 };
  if (map[key]) return map[key];
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return 0;
}
