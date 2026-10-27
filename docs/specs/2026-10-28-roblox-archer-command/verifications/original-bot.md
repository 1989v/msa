# 원작 봇 측정 — 로블록스판 오라클의 출처

측정일 2026-10-28. 원작 `portal-fe/public/games/marine-command/js/origin/{sim,campaign,map}.js` 를 Node 22 로 직접 실행했다.
스크립트는 이 폴더의 **`orig_bot.mjs`** 이고, 레포 루트에서 `node docs/specs/2026-10-28-roblox-archer-command/verifications/orig_bot.mjs` 로 다시 잴 수 있다.

## 측정 시점의 원작
- games 서브모듈 커밋 `73607847e3dc76bd55f8acd37968e221cbd67554` (2026-10-19), `MAP_VERSION = origin-se-southwest-4`
- sha256 `sim.js b19b6cc2…`, `campaign.js 6b334b89…`, `map.js bdf6970a…` — `tools/verify.py` 가 이 셋을 다시 재서 다르면 오라클 행을 `STALE` 로 찍고 PASS 를 내지 않는다.
- 원작 `status.md` 「아군 능력치·좀비 공격11·치유50%」 절은 이 밸런스가 **사용자 답변 대기 중인 잠정값**이라고 적고 있다. 원작이 바뀌면 위 해시가 바뀌고 이 문서를 다시 잰다.

## 정책 넷 × 시드 1~20 (동률 처리까지 스크립트와 같다)

| 정책 | 내용 |
|---|---|
| still | 리더 본진 정지 · 자동 사격 · 금화가 되면 `armor<=attack ? armor : attack` 을 1단씩(합 5까지) · 500G 되면 `hire carpenter` |
| circle | 위와 같되 치료사 주위 반경 100px 원을 돈다 (원작 `tests/outpost.test.mjs` opening) |
| still-noup | 정지 · 강화 없음 |
| nofire | 리더 사격 금지(`assignment='garrison'`, `cooldown=1e9`) → 첫 웨이브가 본진에 실제 피해를 주는 시각 |

```
still       | leaderDied 23.37~29.40 (n=20) | firstBaseHit none | carpenter none
  per-seed 26.17 28.03 23.57 27.90 24.57 26.93 29.40 23.97 24.20 24.57 25.87 25.53 24.63 23.37 25.93 24.23 27.30 27.80 24.33 25.53
circle      | leaderDied 21.57~24.20 (n=20) | firstBaseHit none | carpenter none
  per-seed 23.20 23.77 22.27 23.43 22.73 23.50 24.20 22.30 22.37 22.90 23.07 22.83 22.47 21.57 23.20 22.27 23.17 23.27 23.03 23.10
still-noup  | leaderDied 21.87~26.20 (n=20) | firstBaseHit none | carpenter none
  per-seed 24.23 25.50 22.17 25.00 23.43 24.00 26.20 22.57 22.87 23.23 23.83 23.27 22.83 21.87 24.57 22.93 24.57 25.23 22.83 24.03
nofire      | firstBaseHit 13.37~14.13 (n=20)
  per-seed 13.50 13.40 14.03 13.43 13.43 13.63 13.67 14.13 13.67 13.60 13.90 13.50 13.37 13.43 13.43 13.63 13.53 13.63 13.77 13.40
```

원작 자체 진행 봇 `node tests/origin-progression.mjs 1989` → `AssertionError: Defeated at32s; base392; gold45`.
원작 `tests/outpost.test.mjs:28` 의 「15~30초」 단언은 이전 밸런스의 값이고 현재 코드 측정은 13.4~14.1초다 — 창은 **측정값**에서 만든다.

## 로블록스판 오라클
| 검사 | 창 (원작 측정 ±20%) | Luau 쪽 정책 |
|---|---|---|
| 정지 봇 리더 사망 | 18.7 ~ 35.3초 | still 과 줄 단위 동일 (`tests/run.luau`) |
| 무사격 본진 첫 피해 | 10.7 ~ 17.0초 | 스냅샷의 리더 cooldown 을 1e9 로 고쳐 restore (공개 면만 사용) |
| 둘 다 같은 시드 표 | 시드 1~20 값을 원작 옆에 나란히 기록 — 전부 같으면 창이 필요 없고, 다르면 그 시드가 난수·경로 차이의 실마리 |

목수 구매 시각은 원작 봇이 한 번도 도달하지 못해 창으로 쓰지 않는다(측정값만 기록).

## 사용자에게 알릴 것
원작 현재 밸런스는 단순 봇이 전부 초반에 죽는다(사람은 걷고 피하며 넘긴다). 이식판은 이를 그대로 재현한다 — 로블록스판에서 쉬워지면 그것은 이식 오류다. 밸런스를 바꾸려면 원작부터 바꿔야 한다.
