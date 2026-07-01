// ⚠️ TEMPORARY — k3d 로컬 테스트용 SSO 우회 플래그.
// 별도 파일로 분리한 이유: useAuth ↔ api/client 의 순환 import 를 끊기 위함.
// (useAuth 가 client 의 TOKEN_KEY 를, client 가 BYPASS_AUTH 를 참조하므로
//  같은 파일에 두면 모듈 평가 순서에 따라 한쪽이 undefined 로 평가될 수 있음.)
//
// TODO(removal): auth flow 정상화 후 본 파일 + 모든 BYPASS_AUTH 분기 제거.
//                운영 빌드에 절대 포함 금지.
export const BYPASS_AUTH = true;
