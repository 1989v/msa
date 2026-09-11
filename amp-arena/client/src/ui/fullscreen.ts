// 전체화면 — 카탈로그 상세의 IFRAME 안에서는 무대가 좁아서, 매치에 들어갈 때 문서 전체를 전체화면으로 올린다.
// 사용자 제스처(버튼 클릭) 안에서만 허용되므로 매치 시작 버튼 핸들러에서 부른다. 거절되면 조용히 그대로 간다.
export const isEmbedded = (): boolean => { try { return window.self !== window.top; } catch { return true; } };
export const isFullscreen = (): boolean => !!document.fullscreenElement;

export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement;
  if (document.fullscreenElement) return true;
  if (!el.requestFullscreen) return false;
  try { await el.requestFullscreen({ navigationUI: 'hide' }); return true; } catch { return false; }
}

export async function toggleFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* 무시 */ } return false; }
  return enterFullscreen();
}
