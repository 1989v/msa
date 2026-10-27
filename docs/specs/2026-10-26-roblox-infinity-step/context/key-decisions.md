# Decisions

## 2026-10-26 First slice authorized
- User selected the proposed Infinity Step first slice and requested optional paid revival.
- Standalone `roblox/infinity-step/`; no changes to existing web games or MSA deployment. No new ADR needed: no platform service, schema, auth or communication changes.
- Three short regions are the bounded interpretation of the previously proposed short first course, not a promise to port the entire tower now.
- Initial agent default was region entrance; superseded by the explicit user selection below.
- Purchases grant durable inventory; item use is a separate explicit action. Keep live product ID zero until configured and tested.
- Implementation and scoped checks use one `gpt-6.1-sol` subagent, with fresh read-only review afterwards. Preserve all unrelated contributors' changes and existing staging.
- No computer use authorization exists. No Studio/browser UI automation is permitted in this bundle. No Studio/rojo/Luau executable was found on PATH during initial exploration.

## 2026-10-26 Explicit user follow-ups
- Destination: “떨어지기 직전 밟았던 발판으로 복귀”. Capture server-known platform ID before falling and resolve a safe return point on that platform. No regional checkpoint substitution.
- Add one reusable Roblox game porting prompt and a Roblox development reference guide. Parent owns these documents; implementation agent remains sole owner of the game source subtree.

## 2026-10-26 Installation follow-up
- User requested Studio installation and upload instructions; installed signed official Studio arm64 version 0.744.0.7441077 at `/Applications/RobloxStudio.app` and added the upload guide.
- User initially approved scoped Studio/official-site computer use. The tool rejected Studio access with `Computer Use was not approved to use Roblox Studio`; no alternate tool bypass was attempted.
- User then selected “설치까지만 마무리하고 내가 실행”. Stop computer use and hand local opening/login/Play to the user. Prior bundle is closed; do not reuse it for a later task.
- No upload, public release, product creation, sales or payments performed. Runtime acceptance remains pending.

## 2026-10-28 작업 재개 — 원작 기준 복원
- 사용자가 원작과 다르다고 지적하고 반복해서 작업 진행을 요청했다. 기존 9개 발판과 임의의 골목 시안 대신 실제 Tower/Climber/Biome/KgdTraverse 코드를 기준으로 복원한다.
- 부모가 복원 범위를 개정 명세로 정리했다. 원작 지형 생성 코드를 독립 임시 프로젝트에서 비대화형으로 평가하여 좌표·종류·구간의 기준 자료를 만들고, 구현과 비교하는 방법을 우선한다. 원작 자체는 수정하지 않는다.
- 화면/브라우저 접근의 이전 명시적 거절을 우회하지 않는다. 비대화형 코드 평가·테스트를 실제 플레이로 부르지 않는다. 새 날짜의 재개 요청을 새 앱·웹사이트 조작 승인으로 확대 해석하지 않는다.
- 사용자 요청에 따라 대화·진행 보고·새 실행 안내는 한글로 한다. 코드 심볼은 원본을 보존한다.
- 구현 발견: Unity 비대화형 실행이 라이선스 부재로 종료198. 라이선스를 우회하지 않고 원본 생성/기하 C#의 독립 호스트 컴파일+수학 타입 어댑터를 대안으로 승인했다. 실제Unity실행/bit단위동등/직접플레이라고 주장하지 않는다.

## 2026-10-28 사용자 정정 — 게임 아이디어 보존과 플랫폼 최적화
- 사용자: “완전 발판 개수까지 동일할게아니라 컨셉을 유지하며 로블록스 구성에 최적화하면서 옮기라는거야. 게임 구성과 아이디어를 유지한채”.
- 원본 발판1901개/좌표/경로795개와의 일치 요구를 종료했다. 추출 자료는 참고 도구로 보존하며 기본 빌드·런타임에서는 분리한다. 원본 경사 세분화도 기본 맵에서 제거한다.
- 충전 등반·매달림·스태미나·추락 위험·7개 고도 구간·진행 저장·마지막 발판 부활이라는 정체성을 유지한다. 맵 배치·규모·파트·물리 구현은 로블록스 기본 구성과 성능/조작에 맞춘다.
- 부모가 네이티브 지형/결정적 생성기/구간별 장치/가독성/객체 예산을 인계했고 구현 담당자가 이 범위로 전환한다. 숫자 맞추기나 이미지 시안으로 게임 경험 검증을 대신하지 않는다.
