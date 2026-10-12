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
