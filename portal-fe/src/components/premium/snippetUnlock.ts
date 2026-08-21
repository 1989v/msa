/**
 * 광고 시청 보상 토큰 보관 — 탭 단위(sessionStorage).
 *
 * 이력서 공유 토큰(resumeApi)과 같은 결이다: URL 로 끌고 다니면 복사·공유에서 새고,
 * localStorage 에 두면 1시간짜리 토큰이 영구 보관되는 척을 한다. 만료 판정은 서버가
 * 한다 — 만료된 토큰으로 조회하면 잠긴 응답이 돌아올 뿐, 화면은 자연히 잠금 상태로 돌아간다.
 */
const SNIPPET_UNLOCK_KEY = 'portfolio.snippetUnlock';

export function storeUnlockToken(token: string): void {
  sessionStorage.setItem(SNIPPET_UNLOCK_KEY, token);
}

export function storedUnlockToken(): string | null {
  return sessionStorage.getItem(SNIPPET_UNLOCK_KEY);
}
