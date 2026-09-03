import { ADSENSE_CLIENT, ADSENSE_HOSTS } from '../../seo/copy.mjs';

let started = false;

/**
 * AdSense 로더를 **광고 지면이 실제로 생길 때** 부른다 (ADR-0076).
 *
 * 예전에는 index.html 이 모든 페이지에서 이 스크립트를 실었다. 그런데 자동 광고는 콘솔에서 꺼 둔 상태라
 * 지면(`AdSlot`)이 없는 화면에서는 광고가 하나도 나오지 않는데도 591KB 를 받았고, 로더는 지면이 없어도
 * 숨은 0×0 `ins` 로 광고 요청을 쏘아 노출 없는 요청만 쌓였다. 메인(런처)이 그 대표다 — 지면 0곳.
 *
 * `window.adsbygoogle` 배열은 스크립트보다 먼저 쌓아 둬도 로드 직후 처리된다(AdSense 규약). 그래서
 * 지면이 붙는 순간 로더를 부르면 광고 동작은 전과 같고, 지면이 없는 화면만 스크립트를 안 받는다.
 *
 * 호스트 판정은 `ADSENSE_HOSTS` **하나**를 본다. 예전 index.html 사본은 이 파일로 옮기면서 없앴다 —
 * 목록이 두 벌이면 호스트를 늘렸을 때 한쪽만 고쳐져 광고를 내보내면서 ads.txt 가 없는 호스트가 생긴다.
 */
export function ensureAdsenseLoaded(): void {
  if (started || typeof document === 'undefined') return;
  if (!ADSENSE_CLIENT) return;
  if (!ADSENSE_HOSTS.includes(window.location.hostname)) return;

  started = true;
  const tag = document.createElement('script');
  tag.async = true;
  tag.crossOrigin = 'anonymous';
  tag.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(tag);
}
