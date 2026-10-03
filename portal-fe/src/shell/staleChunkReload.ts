const KEY = 'kgd:stale-chunk-reload';
/** 이 안에 또 실패하면 새로고침하지 않는다 — 새 셸로도 못 받는 청크면 무한 새로고침이 된다 */
const WINDOW_MS = 10_000;

type Host = Pick<Window, 'addEventListener' | 'sessionStorage'> & { location: Pick<Location, 'reload'> };

/**
 * 청크를 못 받으면 한 번 새로고침한다 — 배포 전에 열어 둔 탭이 옛 이름으로 청크를 부르는 경우다.
 * 새로 받은 셸이 새 이름을 준다. 이미지가 최근 릴리스 몫의 옛 자산을 남기므로(scripts/retain-assets.mjs)
 * 이건 그보다 오래 열어 둔 탭의 안전망이다. 저장소를 못 쓰면 반복을 막을 수 없어 새로고침하지 않는다.
 */
export function installStaleChunkReload(host: Host = window, now: () => number = Date.now) {
  host.addEventListener('vite:preloadError', (event) => {
    try {
      const last = Number(host.sessionStorage.getItem(KEY)) || 0;
      if (now() - last < WINDOW_MS) return;
      host.sessionStorage.setItem(KEY, String(now()));
    } catch {
      return;
    }
    event.preventDefault();
    host.location.reload();
  });
}
