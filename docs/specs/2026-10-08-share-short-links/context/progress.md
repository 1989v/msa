# 진행 상태

- 현재 그룹: 8 (문서·통합 검증)
- 완료: 스펙·ADR c418643ff · G1 common d96ab86f8 · G2 resume 0e739d2e2 · G3·4 game/blog b6849d6af · G5 place/search 544dc0243
- 다음 단계: 그룹 8
- 블로커: 없음

## 푸시 전 제약 (필수)
- **place V20 은 다른 세션의 untracked V17~V19 보다 먼저 main 에 들어가면 안 된다.** `outOfOrder=false` 라 V20 이 운영에 먼저 적용되면 이후 V17~V19 가 검증에 걸려 content 기동이 막힌다. 푸시 시점에 V17~V19 커밋 여부를 확인한다.
- game V93(untracked, 다른 세션)도 같은 위험 — V105 가 이미 적용됐으므로 그 세션이 번호를 바꿔야 한다. 보고만 한다.

## 열린 확인
- common 전체 스위트(`:common:test`) — usage 87% 로 게이트가 막아 미확인. 배포 게이트에 넣었으므로 그룹 8 또는 verifier 에서 반드시 확인
- 깨끗한 HEAD 검증 워크트리: scratchpad/wt-head (그룹 8 후 `git worktree remove`)

## 범위 밖 보고 후보
- deal `DealRedirectService.referrerHost/uaFamily` — common ClickContext 로 통합 후보(uaFamily 의미 다름: 봇도 기록)
- 크롤러 판정 3벌(analytics·blog·common)
- `privacyRetention.test.ts` 에 BlogRetentionRunner 누락(기존)
- place `Attraction.isActive()` 는 확장 함수 — 다른 세션의 Attraction.kt 커밋 후 멤버로 옮길지
- blog `BlogQueryService.publishedOrThrow` 가 `status != PUBLISHED` 직접 비교 — `publiclyVisible` 과 판정 두 곳
