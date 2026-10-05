export const kakaoBrowser = (ua: string) => /KAKAOTALK/i.test(ua);
export const androidBrowser = (ua: string) => /Android/i.test(ua);
export function chromeIntent(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.href.includes('#Intent;')) return null;
    return `intent:${url.href.slice(6)}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
  } catch { return null; }
}
export type FullscreenTarget = { requestFullscreen?: () => Promise<void> };
export type OrientationControl = { lock?: (orientation: 'landscape' | 'portrait') => Promise<void>; unlock?: () => void };
export function enterGameFullscreen(target: FullscreenTarget, orientation: string | null | undefined, control: OrientationControl | undefined): Promise<string> {
  if (!target.requestFullscreen) return Promise.resolve('이 브라우저는 전체화면을 지원하지 않습니다. 기기를 돌리고 자동 회전 설정을 확인하세요. 카카오에서는 메뉴로 외부 브라우저를 열어 주세요.');
  // Invoke synchronously inside the click, before any promise or session request.
  try {
    return target.requestFullscreen().then(async () => {
      const direction = orientation === 'LANDSCAPE' ? 'landscape' : orientation === 'PORTRAIT' ? 'portrait' : null;
      if (!direction) return '전체화면으로 전환했습니다. 화면 방향은 기기 회전 설정을 따릅니다.';
      if (!control?.lock) return '전체화면으로 전환했지만 방향 잠금은 지원되지 않습니다. 기기를 돌리고 자동 회전을 확인하세요.';
      try { await control.lock(direction); return `전체화면과 ${direction === 'landscape' ? '가로' : '세로'} 잠금 요청이 완료되었습니다.`; }
      catch { return '전체화면으로 전환했지만 방향 잠금이 거부되었습니다. 기기를 돌리고 자동 회전을 확인하세요.'; }
    }, () => '전체화면 요청이 거부되었습니다. 현재 플레이 화면은 유지됩니다. 기기 회전·자동 회전 설정이나 외부 브라우저를 이용하세요.');
  } catch { return Promise.resolve('전체화면 요청을 실행하지 못했습니다. 기기 회전·자동 회전 설정이나 외부 브라우저를 이용하세요.'); }
}
export async function copyGameLink(href: string, clipboard: Pick<Clipboard, 'writeText'> | undefined): Promise<string> {
  try { if (!clipboard) throw Error('unsupported'); await clipboard.writeText(href); return '현재 링크를 복사했습니다.'; }
  catch { return '링크 복사가 허용되지 않았습니다. 브라우저 메뉴의 공유·주소 복사를 이용하세요.'; }
}
