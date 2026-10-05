import { describe, expect, it, vi } from 'vitest';
import { chromeIntent, copyGameLink, enterGameFullscreen, kakaoBrowser } from '../browserHelp';
describe('game browser controls', () => {
  it('preserves normalized current https path/query/hash and encoded delimiters, rejects injected intent marker', () => {
    for (const href of ['https://game.1989v.com/games/marine-command/index.html?room=A123&x=%3B%23#invite;room', 'https://game.1989v.com/games/a?name=한글#q%23']) {
      const intent=chromeIntent(href)!;
      expect('https:'+intent.slice(7,intent.lastIndexOf('#Intent;'))).toBe(new URL(href).href);
      expect(intent).toContain('S.browser_fallback_url='+encodeURIComponent(new URL(href).href));
    }
    expect(chromeIntent('http://game.1989v.com/')).toBeNull();expect(chromeIntent('https://x/#Intent;package=bad')).toBeNull();expect(chromeIntent('https://user:pass@x/')).toBeNull();expect(kakaoBrowser('Android KAKAOTALK')).toBe(true);expect(kakaoBrowser('Chrome')).toBe(false);
  });
  it('calls fullscreen within the gesture and distinguishes unsupported/rejected/lock rejection', async () => {
    expect(await enterGameFullscreen({},'LANDSCAPE',undefined)).toContain('지원하지');
    const rejected=vi.fn().mockRejectedValue(new Error());const pending=enterGameFullscreen({requestFullscreen:rejected},'LANDSCAPE',undefined);expect(rejected).toHaveBeenCalledTimes(1);expect(await pending).toContain('거부');
    const lock=vi.fn().mockRejectedValue(new Error());expect(await enterGameFullscreen({requestFullscreen:async()=>{}},'LANDSCAPE',{lock})).toContain('방향 잠금이 거부');expect(lock).toHaveBeenCalledWith('landscape');
  });
  it('respects portrait metadata and free rotation unless explicit landscape is requested', async () => {
    const lock=vi.fn().mockResolvedValue(undefined);const target={requestFullscreen:async()=>{}};
    await enterGameFullscreen(target,'PORTRAIT',{lock});expect(lock).toHaveBeenCalledWith('portrait');lock.mockClear();
    await enterGameFullscreen(target,'BOTH',{lock});expect(lock).not.toHaveBeenCalled();await enterGameFullscreen(target,'LANDSCAPE',{lock});expect(lock).toHaveBeenCalledWith('landscape');
  });
  it('copies exact invite URL or gives nonblocking denied fallback', async () => {const href='https://game.1989v.com/games/a?room=A#join',writeText=vi.fn().mockResolvedValue(undefined);expect(await copyGameLink(href,{writeText})).toContain('복사했습니다');expect(writeText).toHaveBeenCalledWith(href);expect(await copyGameLink(href,{writeText:vi.fn().mockRejectedValue(new Error())})).toContain('허용되지');});
});
