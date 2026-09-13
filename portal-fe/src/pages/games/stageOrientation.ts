/**
 * 가로 전용 게임을 시작할 때 무대를 전체화면으로 올릴지 판정한다.
 *
 * 카탈로그의 `orientation` 은 도메인 → DTO → gameApi 까지 배선돼 있었는데 **읽는 코드가
 * 없어** 죽은 값이었다 (2026-08-24). 가로 전용 게임(2560×1440 캔버스 등)이 세로 폰에서
 * 열리면 390×219 CSS px 로 줄어 조작 대상이 손톱만 해진다 — 사용자가 매번 `⛶ 크게` 를 눌렀다.
 *
 * **2026-09-13 데스크톱까지 넓혔다.** 처음에는 「데스크톱에서는 창을 마음대로 돌리면 안 된다」로
 * 터치 기기만 대상으로 했는데, 데스크톱에서 하는 일은 회전이 아니라 전체화면이다. 1440×900 창에서
 * 무대는 **1150×521** 인데 그 안의 게임 대기실은 **659px** 를 써서 캐릭터 선택이 138px 잘려 있었다
 * (실측). 회전은 `enterLandscape` 안의 `screen.orientation.lock` 이 맡고 데스크톱에서는 조용히
 * 실패하므로, 이 판정은 전체화면 여부만 본다.
 */
export interface StageEnv {
  /** 카탈로그가 선언한 방향 */
  orientation: string | null | undefined;
  /** 이미 전체화면인가 — 두 번 부르면 브라우저가 거절한다 */
  fullscreen: boolean;
}

export function shouldEnterFullStage(env: StageEnv): boolean {
  if (env.orientation !== 'LANDSCAPE') return false;
  if (env.fullscreen) return false;
  return true;
}
