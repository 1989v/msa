/**
 * 가로 전용 게임의 자동 가로 전환 판정 (2026-08-24).
 *
 * 카탈로그의 `orientation` 은 도메인 → DTO → gameApi 까지 배선돼 있었는데 **읽는 코드가
 * 없어** 죽은 값이었다. 가로 전용 게임(2560×1440 캔버스 등)이 세로 폰에서 열리면
 * 390×219 CSS px 로 줄어 조작 대상이 손톱만 해진다 — 사용자가 매번 `⛶ 크게` 를 눌렀다.
 *
 * 컴포넌트에서 분리한 이유는 이 판정이 **네 조건의 AND** 라 눈으로는 못 지키기 때문이다.
 */
export interface StageEnv {
  /** 카탈로그가 선언한 방향 */
  orientation: string | null | undefined;
  /** 터치 기기인가 (`pointer: coarse`) — 데스크톱은 전환하지 않는다 */
  coarsePointer: boolean;
  /** 지금 세로인가 — 이미 가로면 건드리지 않는다 */
  portrait: boolean;
  /** 이미 전체화면인가 */
  fullscreen: boolean;
}

export function shouldAutoLandscape(env: StageEnv): boolean {
  if (env.orientation !== 'LANDSCAPE') return false;
  if (!env.coarsePointer) return false;
  if (!env.portrait) return false;
  if (env.fullscreen) return false;
  return true;
}
