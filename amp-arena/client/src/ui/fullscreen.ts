// 전체화면 — 카탈로그 상세의 IFRAME 안에서는 무대가 좁아서, 매치에 들어갈 때 문서 전체를 전체화면으로 올린다.
// 사용자 제스처(버튼 클릭) 안에서만 허용되므로 매치 시작 버튼 핸들러에서 부른다. 거절되면 조용히 그대로 간다.
import { tryLockLandscape } from './orient.ts';
export const isEmbedded = (): boolean => { try { return window.self !== window.top; } catch { return true; } };
/**
 * 카탈로그(부모 문서)가 무대 `<section>` 을 전체화면으로 올려 둘 수 있다 (2026-09-13: 가로 전용 게임은
 * 플레이를 누르면 바로 그렇게 한다). 그때 **내 문서의 fullscreenElement 는 비어 있다** — 그것만 보면
 * 전체화면인데 버튼은 「전체화면」이라 적히고, 눌러도 화면이 안 바뀌어 죽은 버튼이 된다.
 * 카탈로그와 게임은 같은 오리진(game.1989v.com)이라 부모 문서를 읽고 풀 수 있다.
 */
function parentDoc(): Document | null {
  try { return window.parent !== window ? window.parent.document : null; } catch { return null; } // 다른 오리진에 박히면 접근이 막힌다
}

export const isFullscreen = (): boolean => !!document.fullscreenElement || !!parentDoc()?.fullscreenElement;

export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement;
  if (isFullscreen()) { void tryLockLandscape(); return true; } // 부모가 무대를 이미 올려 뒀으면 겹쳐 올리지 않는다
  if (!el.requestFullscreen) return false;
  try { await el.requestFullscreen({ navigationUI: 'hide' }); } catch { return false; }
  void tryLockLandscape(); // 안드로이드: 전체화면 안에서만 가로 고정이 된다. iOS 는 실패 → CSS 회전(orient.ts)이 맡는다
  return true;
}

export async function toggleFullscreen(): Promise<boolean> {
  if (!isFullscreen()) return enterFullscreen();
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* 무시 */ } }
  const pd = parentDoc();
  if (pd?.fullscreenElement) { try { await pd.exitFullscreen(); } catch { /* 무시 */ } } // 무대까지 같이 푼다
  return false;
}
