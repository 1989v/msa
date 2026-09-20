# Tasks — 게임 랭킹에 실제 플레이어 기록만 남긴다

작업 트리: `origin/main` 에서 딴 별도 worktree. 커밋은 경로 지정(`git add <paths>`), 서브모듈 포인터 불변.

## Group 1 — common: 판별기 이동
Dependencies: 없음.
- [x] `analytics/app/.../presentation/event/CrawlerUserAgents.kt` → `common/src/main/kotlin/com/kgd/common/web/CrawlerUserAgents.kt` (`git mv`, 패키지만 변경)
- [x] 테스트 → `common/src/test/kotlin/com/kgd/common/web/CrawlerUserAgentsTest.kt`, HeadlessChrome 케이스를 실측 UA(153)로
- [x] `analytics/.../EventCollectController.kt` import 한 줄
- [x] Verify: `./gradlew :common:test --tests '*CrawlerUserAgentsTest' :analytics:app:compileKotlin`

## Group 2 — game: 제출 제외 규칙
Dependencies: Group 1.
- [x] `SubmitGameScoreUseCase`: `Command.isOperator`/`isAutomation` (맨 뒤 기본값), `Result(applied, rank, excluded)`
- [x] `GameScoreService.execute`: 검증 뒤·저장소 앞 제외 분기 + `log.info { "score excluded slug=… nick=… operator=… automation=…" }`
- [x] `GameScoreController.submit`: `HttpHeaders.USER_AGENT`·`X-User-Roles` 헤더 → Command, `ScoreSubmitResponse.excluded`
- [x] `GameScoreServiceTest`: 기존 단언 2줄 `Result(true, 1)`, 신규 4케이스(V1)
- [x] `GameScoreControllerTest` 신규 (V3, 4케이스 — 포트 호출 여부로 판정)
- [x] Verify: `./gradlew :game:feature:test --tests '*GameScoreServiceTest' --tests '*GameScoreControllerTest'`

## Group 3 — 클라이언트
Dependencies: Group 2 (응답 필드명).
- [x] `portal-fe/public/games/lib/rank.js`: Bearer(`GameAuth.token()`), `excluded` 문구 ko/en
- [x] 22개 `index.html` 에 `<script src="../lib/auth.js"></script>` 한 줄 (rank.js 앞)
- [x] `amp-arena/client/src/platform/score.ts`: `excluded?` + `scoreNote` (재게시 없음)
- [x] `amp-arena/tools/e2e-prod-score.mjs`: fetch 감싸기 · 판정 반전 · `noteRank` 완화 · 헤더 주석
- [x] Verify: `node --check` 셋, 22개 파일 grep 으로 auth.js 가 rank.js 앞에 있는지

## Group 4 — 문서
Dependencies: Group 2·3.
- [x] ADR-0084 「2026-09-20 개정」 절
- [x] `game/CLAUDE.md` `/scores` 행 + Key Rules
- [x] `docs/architecture/common-features.md` 행, `common/docs/service.md` 행
- [x] `docs/changelog/harness-changelog.md` — CLAUDE.md 를 고쳤으므로 한 줄

## Group 5 — 배포 · 운영 검증 · 정리 (순서 고정)
Dependencies: Group 1~4 커밋·푸시.
- [x] V5 빨간불: 새 `e2e-prod-score.mjs` 를 **배포 전** 운영에 → 실패 확인(`excluded` 없음 · 닉 보드에 있음)
- [x] 푸시 → images CI → Argo Synced(portal-fe·content 둘 다) → 새 심볼로 롤아웃 확인(`excluded` 필드가 응답에 있는지)
- [x] V5 초록불: 같은 스크립트 → 통과, 파드 로그 `automation=true`
- [ ] V7: 사용자가 로그인 브라우저로 한 판 → 파드 로그 `operator=true`, 행 수 무변화 (`member_roles` 확인 선행 — 완료)
- [x] R7 정리: 패턴 SELECT → `verifications/purge.md` → id 로 DELETE ×2 → V6 COUNT
- [x] `status.md` 갱신
