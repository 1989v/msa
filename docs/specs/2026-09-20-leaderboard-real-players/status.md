<!-- source: game/feature/src/main/kotlin/com/kgd/game/application/play/service/GameScoreService.kt -->
<!-- source: portal-fe/public/games/lib/rank.js -->
# 랭킹 실제 플레이어만 — status 2026-09-20

## 구현 (커밋 15cfb430 · games 60220b74)

| Step | Result | Evidence |
|---|---|---|
| 스펙 리뷰 | SHIP 6/6 (1회차 REVISE 6/6 → 반영) | `context/engineer-review-*.md` Round 2 |
| 단위 | PASS | `CrawlerUserAgentsTest` 13/13 (common) · `GameScoreServiceTest` 20/20 · `GameScoreControllerTest` 4/4 |
| 게이트 증명 | PASS | 제외 분기를 `if (false)` 로 바꾸면 4건 빨간불(서비스 2 · 컨트롤러 2), 되돌리면 초록 |
| 컴파일 | PASS | `:analytics:app:compileKotlin`, arena `tsc -p client --noEmit` (score.ts 포함) |
| V5 빨간불 (배포 전) | RED as expected | 새 `e2e-prod-score.mjs` → 옛 서버 응답 `{"applied":true,"rank":2}`, 닉 `실측658445` 보드 14위 → `checks {"noteScore":true,"excluded":false,"notOnLeaderboard":false}` exit 1 |
| CI | ci success · images success (common 변경이라 JVM 13종 전부 rebuild) | run 35498755685 / 35498755719 → `82533b7d ci: bump 13 service image tag(s) to 15cfb43` |
| 롤아웃 | content `15cfb43` 1/1 · portal-fe `15cfb43` 1/1 | 새 심볼: 헤드리스 UA curl POST → `{"applied":false,"rank":0,"excluded":true}` · 보드에 그 닉 없음 · 배포된 `lib/rank.js` 에 `Authorization`·`excluded` 문자열 |
| V5 초록불 (배포 후) | PASS | 같은 스크립트 → 응답 `excluded:true`, `leaderboard success=true · mine null` → `checks {"noteScore":true,"excluded":true,"notOnLeaderboard":true}` exit 0. 결과 화면은 예고대로 「연습 순위표 0위 · 227점 (최고 기록 유지)」(옛 번들 `index-CjJOLYZk.js`). 파드 로그 `score excluded slug=arena nick=실측993129 operator=false automation=true` |
| V7 운영자 끝-끝 | **OPEN — 사용자 플레이 필요** | 전제 확인: `auth_db.member_roles` member 1 = ROLE_ADMIN. 절차: 로그인한 일반 브라우저로 `auth.js`+`rank.js` 게임 한 판(예 archer-outbreak) → 위젯 「운영·자동화 기록 — 랭킹에 오르지 않음」 · 파드 로그 `operator=true` · 그 닉 행 수 무변화 |
| R7 정리 | DONE | id 17 + 16 삭제, 패턴 잔여 0, 남은 20행 = `go` 14 · `스넥크` 4 · `가즈아` 2 → `verifications/purge.md` |

## 남은 것

- V7 만 열려 있다 — 운영자 로그인 플레이의 끝-끝은 사용자만 만들 수 있다(헤드리스는 UA 에서 먼저 걸려 `automation=true` 로 나온다).
- 아레나 재게시 전까지 제외 응답의 결과 화면은 「순위표 0위 · (최고 기록 유지)」. `client/src/platform/score.ts` 는 고쳐 뒀다.
- game BC 사전 없음 — `/hns:glossary` 후속.
