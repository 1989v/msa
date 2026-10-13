import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { gameSource, loadGame, MARBLE_SIM_FILES } from './loadGame';
it('native button/summary Enter/Space do not launch a new race, and Tab is not swallowed', async () => {
  document.body.innerHTML = '<canvas id="game"></canvas>';
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  const handlers: EventListener[] = [];
  const copy = vi.fn().mockResolvedValue(undefined);
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  Object.assign(g, {
    document, navigator: { clipboard: { writeText: copy } }, innerWidth: 1080, innerHeight: 1440,
    Art: { W: 1080, H: 1440, FONT: 'sans-serif' }, requestAnimationFrame: () => 0,
    addEventListener: (key: string, handler: EventListener) => { if (key === 'keydown') { handlers.push(handler); window.addEventListener(key, handler); } },
    Meta: { mode: 'last', course: 'pinball', rank: 1, roster: 'A\nB', muted: false },
    Setup: { build() {}, show() {}, visible: () => false, parseRoster: () => [{ name: 'A', count: 1 }, { name: 'B', count: 1 }] },
    Sound: { ...g.Sound, ensure() {}, startBed() {}, stopBed() {}, confirm() {} }, FX: { ...g.FX, clear() {} },
  });
  vm.runInNewContext(gameSource('marble-race', 'main.js'), g);
  try {
    g.dev.scene('result'); const seed = g.Game.state().seed; const text = g.Game.resultText();
    expect(text).toContain('1등');
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent === '결과 복사')!;
    button.hidden = false;
    for (const key of ['Enter', 'Space']) {
      const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: key });
      button.dispatchEvent(ev); expect(ev.defaultPrevented).toBe(false);
      expect(g.Game.state().phase).toBe('done'); expect(g.Game.state().seed).toBe(seed);
    }
    button.click(); await Promise.resolve(); expect(copy).toHaveBeenCalledWith(text);
    const summary = document.querySelector('summary')!;
    summary.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Enter' }));
    expect(g.Game.state().phase).toBe('done');
    const tab = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Tab' });
    button.dispatchEvent(tab); expect(tab.defaultPrevented).toBe(false);
    const participant = [...document.querySelectorAll('button')].find((b) => b.textContent === 'A')!;
    participant.click(); expect(g.Game.state().selectedOwner).toBe(0);
  } finally { handlers.forEach((h) => window.removeEventListener('keydown', h)); vi.restoreAllMocks(); }
});

it('no user skip; completed-only centered replay keeps the seed, has no background activation, and leaves all ranks outside its target', () => {
  document.body.innerHTML = '<canvas id="game"></canvas>';
  const noop = () => {};
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({ measureText: () => ({ width: 100 }) }, { get: (t, k) => Reflect.get(t, k) ?? noop }) as unknown as CanvasRenderingContext2D);
  const cv = document.querySelector('canvas')!;
  vi.spyOn(cv, 'getBoundingClientRect').mockImplementation(() => {
    const width = parseFloat(cv.style.width), height = parseFloat(cv.style.height);
    return { left: 100, top: 30, right: 100 + width, bottom: 30 + height, width, height, x: 100, y: 30, toJSON: () => ({}) };
  });
  const handlers: [string, EventListener][] = [], label = vi.fn();
  let frame!: (now: number) => void;
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  Object.assign(g, {
    document, navigator: {}, innerWidth: 844, innerHeight: 390,
    Art: new Proxy({ W: 1080, H: 1440, FONT: 'sans-serif', nameTagLayout: () => [], label, fit: (_: unknown, s: string) => s }, { get: (t, k) => Reflect.get(t, k) ?? noop }),
    requestAnimationFrame: (cb: (now: number) => void) => { frame = cb; return 0; },
    addEventListener: (key: string, handler: EventListener) => { handlers.push([key, handler]); window.addEventListener(key, handler); },
    Meta: { mode: 'last', course: 'seesaw', rank: 1, roster: 'A x9\nB x9\nC x2', muted: false, countRace() {} },
    Setup: { build() {}, show() {}, visible: () => false, parseRoster: () => [{ name: 'A', count: 9 }, { name: 'B', count: 9 }, { name: 'C', count: 2 }] },
    Sound: new Proxy({}, { get: () => noop }), FX: new Proxy({}, { get: () => noop }),
  });
  vm.runInNewContext(gameSource('marble-race', 'main.js'), g);
  const button = document.querySelector<HTMLButtonElement>('.mr-replay')!;
  const ff = vi.spyOn(g.Game, 'fastForward'), start = vi.spyOn(g.Game, 'start');
  try {
    expect(button.hidden).toBe(true); expect(button.title).toBe('다시 보기'); expect(button.getAttribute('aria-label')).toBe('다시 보기');
    expect(button.querySelector('svg')!.getAttribute('width')).toBe('32');
    g.dev.scene('race'); expect(g.Game.state().phase).toBe('ready'); expect(button.hidden).toBe(true);
    for (const [width, height] of [[360, 780], [390, 844], [1080, 1440], [844, 390]]) {
      g.innerWidth = width; g.innerHeight = height; window.dispatchEvent(new Event('resize'));
      const rect = cv.getBoundingClientRect();
      expect(parseFloat(button.style.left) + 32).toBe(rect.left + rect.width / 2);
      expect(parseFloat(button.style.top) + 32).toBe(rect.top + rect.height / 2);
      const menu = document.querySelector<HTMLElement>('.mr-watch')!;
      expect(parseFloat(menu.style.left) + parseFloat(menu.style.maxWidth) + 8).toBeLessThanOrEqual(rect.left + 1000 * rect.width / 1080 + .01);
      expect(parseFloat(menu.style.top) + parseFloat(menu.style.maxHeight) + 8).toBeLessThanOrEqual(rect.bottom + .01);
    }
    for (let i = 1; i <= 25; i++) frame(i * 80);
    expect(g.Game.state().phase).toBe('racing'); expect(button.hidden).toBe(true);
    const before = g.Game.state().world.t, seed = g.Game.state().seed;
    start.mockClear(); ff.mockClear();
    for (const code of ['Space', 'Enter', 'KeyR']) cv.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    cv.dispatchEvent(new MouseEvent('pointerdown', { clientX: 150, clientY: 350, bubbles: true }));
    expect(ff).not.toHaveBeenCalled(); expect(start).not.toHaveBeenCalled(); expect(g.Game.state().world.t).toBe(before); expect(g.Game.state().seed).toBe(seed);
    const slow = [...document.querySelectorAll('button')].find(b => b.textContent === '느리게 보기')!;
    slow.click(); expect(g.Game.state().manualSlow).toBe(true); expect(slow.textContent).toBe('보통 속도로 보기');
    g.Game.fastForward(240); frame(2080);
    expect(button.hidden).toBe(true); start.mockClear(); button.click(); expect(start).not.toHaveBeenCalled();
    for (let i = 1; i <= 6; i++) frame(2080 + i * 80);
    expect(button.hidden).toBe(false);
    for (const code of ['Enter', 'Space']) {
      g.dev.scene('result'); const resultSeed = g.Game.state().seed;
      expect(button.hidden).toBe(false); expect(button.disabled).toBe(false);
      start.mockClear(); ff.mockClear();
      cv.dispatchEvent(new MouseEvent('pointerdown', { clientX: 150, clientY: 350, bubbles: true }));
      expect(start).not.toHaveBeenCalled();
      const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
      button.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); expect(start).not.toHaveBeenCalled();
      // jsdom does not synthesize native keyboard clicks; one browser activation is one click.
      button.click(); button.click();
      expect(start).toHaveBeenCalledTimes(1); expect(g.Game.state().seed).toBe(resultSeed); expect(button.hidden).toBe(true); expect(ff).not.toHaveBeenCalled();
    }
    g.dev.scene('result'); const resultSeed = g.Game.state().seed; start.mockClear(); label.mockClear(); frame(2080);
    const ranks = label.mock.calls.filter(args => /^\d+등$/.test(String(args[1])));
    expect(ranks).toHaveLength(20);
    for (const args of ranks) expect(Math.abs(args[3] - 720) * (292 / 1080)).toBeGreaterThan(44);
    cv.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    expect(start).toHaveBeenCalledTimes(1); expect(g.Game.state().seed).toBe(resultSeed);
    [...document.querySelectorAll('button')].find(b => b.textContent === '참가자 변경')!.click(); expect(button.hidden).toBe(true);
    expect(label.mock.calls.some(args => String(args[1]).includes('Space 빨리 감기'))).toBe(false);
  } finally { handlers.forEach(([key, handler]) => window.removeEventListener(key, handler)); vi.restoreAllMocks(); }
});
