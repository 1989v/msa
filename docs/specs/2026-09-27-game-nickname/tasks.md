<!-- source: game/feature/src/main/kotlin/com/kgd/game/application/profile/service/GamePlayerProfileService.kt, portal-fe/src/game-profile/GameProfileHost.tsx -->

# Task Breakdown: 게임 공통 닉네임
## Overview
Total Task Groups: 3

### Task Group 1: 계정 프로필 및 랭킹
**Dependencies:** None
**Phase:** backend
**Required Skills:** hns:agent-behavior
- [x] 1.0 Domain nickname, profile API, guest cookie, new score tables, combined legacy reads, personal record, suggestion identity.
- [x] 1.1 Add domain/service/MySQL/gateway tests.
- [x] 1.2 Verify: `./gradlew :game:domain:test :game:feature:test :gateway:test verifyArchitecture`
**Acceptance Criteria:** 서버가 이름 소유권과 중복을 강제, guest/member 모두 분리, legacy 보존.

### Task Group 2: 전역 프로필 모달
**Dependencies:** API contract in spec
**Phase:** frontend
**Required Skills:** hns:agent-behavior
- [x] 2.0 Shared state/API, modal, global entry, score ownership rendering, suggestions.
- [x] 2.1 Add component/API race tests.
- [x] 2.2 Verify: `cd portal-fe && npx tsc -b && npm test -- --run`
**Acceptance Criteria:** 모달 저장/실패/포커스/계정 전환 및 전역 동기화.

### Task Group 3: 공용 게임 위젯 및 통합 검증
**Dependencies:** Groups 1, 2 API contract
**Phase:** integration
**Required Skills:** hns:agent-behavior
- [x] 3.0 rank.js/platform.js profile, iframe bridge, standalone modal, pending isolation.
- [x] 3.1 Run focused JS tests, browser smoke, fresh context review.
- [x] 3.2 Record evidence and commit only task files.
**Acceptance Criteria:** 실제 iframe/standalone와 게스트가 같은 서버 소유 프로필 사용.
