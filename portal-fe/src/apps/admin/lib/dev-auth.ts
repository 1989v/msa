/**
 * 로컬 개발 전용 토큰 주입 — OAuth 왕복 없이 어드민을 띄우기 위한 편의 장치.
 *
 * 운영 빌드에서는 **구조적으로** 켜질 수 없다: Vite 가 프로덕션 번들에서
 * `import.meta.env.DEV` 를 리터럴 `false` 로 치환하므로 아래 분기 전체가
 * dead code 로 제거되고, 값을 담는 환경변수 자체도 번들에 들어가지 않는다.
 * (소스 상수 하드코딩 방식으로 되돌리지 말 것 — 그건 운영에 그대로 실려 나간다.)
 *
 * 게다가 여기서 돌려주는 값은 auth 서비스가 실제로 발급한 JWT 여야 한다.
 * 위조 토큰을 넣어도 gateway 가 서명을 검증하므로 API 는 401 이다 —
 * 화면만 열리고 데이터는 비는 과거의 실패 모드가 재현되지 않는다.
 *
 * 사용법: `portal-fe/.env.local` 에
 *   VITE_DEV_ADMIN_TOKEN=<POST /api/auth/login/{provider} 로 받은 accessToken>
 */
export function getDevAuthToken(): string | null {
  if (!import.meta.env.DEV) return null;
  return import.meta.env.VITE_DEV_ADMIN_TOKEN || null;
}
