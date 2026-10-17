import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useStageFit } from '../useStageFit';
afterEach(() => vi.unstubAllGlobals());
it('forced desktop immersion uses visible viewport, ignores content height and preserves responsive mode when released', () => {
  vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 1200);
  let coarse = false;
  vi.stubGlobal('matchMedia', () => ({ matches: coarse }));
  const viewport = new EventTarget(); Object.assign(viewport, { height: 1100 });
  vi.stubGlobal('visualViewport', viewport);
  const { result, rerender } = renderHook(({ force }) => useStageFit(true, force), { initialProps: { force: true } });
  const frame = document.createElement('iframe'); document.body.append(frame);
  Object.defineProperty(frame, 'clientWidth', { value: 1000 });
  frame.contentDocument!.body.innerHTML = '<canvas width="1080" height="1440"></canvas>';
  result.current.ref.current = frame;
  try {
    act(() => frame.dispatchEvent(new Event('load')));
    expect(result.current.immersive).toBe(true); expect(result.current.height).toBeNull(); expect(result.current.stageHeight).toBe(1100);
    Object.assign(viewport, { height: 700 });
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(result.current.stageHeight).toBe(700);
    vi.stubGlobal('innerHeight', 650);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(result.current.stageHeight).toBe(650);
    rerender({ force: false }); expect(result.current.immersive).toBe(false);
    act(() => frame.dispatchEvent(new Event('load')));
    // 세로 캔버스 비율 높이(1333)는 창 안에 들어오게 자른다 — innerHeight 650 − 헤더·여백 88
    expect(result.current.height).toBe(562);
    coarse = true; vi.stubGlobal('innerWidth', 390);
    act(() => window.dispatchEvent(new Event('orientationchange')));
    expect(result.current.immersive).toBe(true); expect(result.current.height).toBeNull();
  } finally { frame.remove(); }
});
