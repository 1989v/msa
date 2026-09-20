<!-- source: game/feature/src/main/kotlin/com/kgd/game/application/play/service/GameScoreService.kt -->
# 시험 기록 정리 — 2026-09-20

패턴은 **찾는 데**만 쓰고 삭제는 아래 id 목록으로 했다. `oci-mysql game_db` 에 `SET NAMES utf8mb4;` 를 앞에 두면
한글 리터럴이 그대로 매치된다(행 수로 확인 — 0 이면 charset 불일치).

## 1. 읽기 (2026-09-20 17:10 KST, 정리 전 `game_score` 37행 · `game_score_daily` 36행)

```sql
WHERE nickname LIKE '실측%' OR nickname IN ('진행실측','zz-e2e-probe','00')
```

`game_score` 17행 — 전부 `member_id NULL`, `requirements.md` 표와 일치 (실측 12 + 빨간불 실행분 1 · 진행실측 · zz-e2e-probe · 00 ×2):

| id | slug | board | nickname | score | created_at |
|---|---|---|---|---|---|
| 8 | deadline | | zz-e2e-probe | 200 | 2026-08-17 09:05 |
| 10 | hand-alchemy | | 00 | 78 | 2026-08-23 15:02 |
| 11 | coin-corgi | | 00 | 3400 | 2026-08-23 15:04 |
| 25 | arena | practice | 실측417930 | 227 | 2026-09-12 03:07 |
| 27 | arena | practice | 진행실측 | 200 | 2026-09-12 11:54 |
| 29 | arena | practice | 실측351942 | 227 | 2026-09-12 23:06 |
| 30 | arena | practice | 실측695336 | 227 | 2026-09-13 03:38 |
| 31 | arena | practice | 실측792286 | 227 | 2026-09-13 03:39 |
| 32 | arena | practice | 실측925458 | 227 | 2026-09-13 03:42 |
| 33 | arena | practice | 실측287305 | 227 | 2026-09-13 07:41 |
| 34 | arena | practice | 실측764361 | 227 | 2026-09-13 07:49 |
| 35 | arena | practice | 실측896587 | 227 | 2026-09-13 07:51 |
| 36 | arena | practice | 실측247008 | 227 | 2026-09-13 09:04 |
| 39 | arena | practice | 실측515437 | 227 | 2026-09-13 10:48 |
| 40 | arena | practice | 실측638654 | 227 | 2026-09-13 10:50 |
| 41 | arena | practice | 실측271760 | 227 | 2026-09-13 12:24 |
| 42 | arena | practice | 실측658445 | 227 | 2026-09-20 08:07 (V5 빨간불 실행 — 옛 서버가 기록한 행) |

`game_score_daily` 16행 (zz-e2e-probe 는 오늘 보드 도입 전이라 짝이 없다): id 1, 2, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 36.

남기는 행: `go` 14 · `가즈아` 2 · `스넥크` 4 = 20 (사용자 결정 2026-09-20).

## 2. 쓰기 (2026-09-20 22:15 KST — 배포·V5 초록불 뒤)

```
oci-mysql --write game_db "DELETE FROM game_score WHERE id IN (8,10,11,25,27,29,30,31,32,33,34,35,36,39,40,41,42)"
  미리보기 affected_rows 17 → 반영 17
oci-mysql --write game_db "DELETE FROM game_score_daily WHERE id IN (1,2,18,20,22,23,24,25,26,27,28,29,32,33,34,36)"
  미리보기 affected_rows 16 → 반영 16
```

## 3. 대조 (V6)

| 질의 | 값 |
|---|---|
| 패턴 잔여 `game_score` | 0 |
| 패턴 잔여 `game_score_daily` | 0 |
| `game_score` 총행 | 37 − 17 = **20** (`go` 14 · `스넥크` 4 · `가즈아` 2) |
| `game_score_daily` 총행 | 36 − 16 = **20** |
| `GET /api/v1/games/arena/leaderboard?board=practice` | `[(1, 가즈아, 1322)]` |
| 허브 레일 `GET /api/v1/games/leaderboards` | arena/online · circle-trace · zombie-lane · zombie-march · sum-trail · archer-outbreak · serpent-legion · block-burst — 시험 닉 없음 |
