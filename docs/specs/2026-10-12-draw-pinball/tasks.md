# Task Breakdown

검증 담당은 구현 에이전트 한 명. 전체 구현 후 통합 검증하고 루트가 재실행하지 않는다.

## Group 1: 후반 경합과 카메라
Dependencies: None. Phase: pinball.
- [x] 경쟁 조건/단독 종료/모드별 관심 무리/결정성 테스트 작성.
- [x] SR-1/SR-2 구현, 결과 복사와 참가자 강조.
- [x] Verify: portal-fe vitest의 games/결정성 관련 테스트.

## Group 2: 간단 추첨과 초대
Dependencies: Group 1. Phase: frontend.
- [x] 명단 유지/게임 선택/초대 파싱/잘못된 코드의 방 생성 방지 테스트.
- [x] SR-3/SR-4 구현. 기존 파티/호스트 라우팅 보존.
- [x] Verify: focused vitest, npx tsc -b, touched-file eslint.

## Group 3: 코스 및 통합
Dependencies: Group 1/2. Phase: course.
- [x] SR-5의 작은 후반 변경과 미리보기 구현.
- [x] 시드 재현/완주/출발자리 편향을 비-UI 시뮬로 검증.
- [x] Verify: npm run build, 관련 vitest suite, git diff --check. 최종 출력/제한을 verifications/final-verification.md에 기록.
- [x] 사용자 "진행해" 승인으로 루트FE/spec와 현재games560224e4 포인터를 명시적 경로로 통합; 다른 staged/dirty 항목은 보존. games7개 파일은 별도 커밋; 다른 staged/dirty 변경은 보존. hooks 우회 금지. push/deploy는 하지 않음.

## Group 4: 맵 3종 추가와 경기 화면 정리
Dependencies: 기존 구현/배포 완료. User requested 2026-10-13.
- [x] 지그재그/범퍼 숲/시소 코스와 미리보기, 간결한 한국어 설명 추가.
- [x] 후속 지시에 따라 사용자용 스킵/빨리감기와 하단 버튼·안내 줄 제거; 완료 후 중앙 같은 시드 리플레이 아이콘과 보조 native 메뉴 제공.
- [x] 구슬 레이스만 desktop/mobile 플레이 시 visible viewport 높이 전체를 쓰는 기존 몰입 무대 적용; resize/종료/다른 게임 보존 확인.
- [x] 새 맵 완주/시드 재현/스케줄 동일성과 native controls 통합 검증; 기존 맵 보존 확인.
- [x] 관련 lint/type/build와 fresh-context 구현 리뷰; 증거는 `verifications/course-expansion.md`에 기록.
- [x] 승인된 로컬 브라우저로 모바일/데스크톱 및 새 맵/viewport/완료 후 리플레이·메뉴 검증. 브라우저 검증 여부와 한계를 구분해 보고.


## Group 5: 여섯 코스의 출발 입구 구분
- [x] 코스별 경계/출구/첫 접촉 구현; spawn/physics/downstream 유지.
- [x] 실제 입구 geometry/spawn JSON과 비-UI 정적 도식 생성.
- [x] 모든6코스2/6/12명×10시드 완주·재현, 대표스케줄·spawn/통로/nonfinite/downstream 검증, 제한된 출발-x 표본 보고.
- [x] focused tests/type/build 및 fresh review, 증거 entrance-variation.md 기록 후 coherent games/root commits. 구현자 push/deploy/browser 없음.
