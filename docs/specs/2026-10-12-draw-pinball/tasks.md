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
