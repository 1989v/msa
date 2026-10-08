# 2단계 증거 — 구현 (S1-12b 완료, 이후 슬라이스 진행 중)

> 1단계(진단·기준선)는 `../stage1/README.md`. 계획은 `docs/plans/2026-10-08-place-growth-work-plan.md`. 보고 틀은 계획서 「완료 보고 형식」 절.

## S1-12b 허브 최소 행동 계측 — 첫 슬라이스

- 스펙·리뷰·태스크: `docs/specs/2026-10-08-place-hub-instrumentation/`(hns 파이프라인: 리뷰 3라운드, 심판 3회 — `context/review-verdict-round{1,2,3}.md`).
- 세션이 대신 내린 결정(사용자 「이어서 마지막까지」 지시): ① 중복 키·eventId 에 `sectionId`(노출 포함) ② `overlay` 토글은 계측 안 함(`MAP_OVERLAY` 핀 CLICK 만) ③ 선택률은 view 단위 전환 + 선택 튜플 제한 ④ `TrackedItem = PlacedItem | PageItem` 판별 합집합 ⑤ 가운데 클릭 미계측 ⑥ `POST_SELECTION_SECTIONS` 상수를 use case companion 에.
- 기준선 정의(SR-10): 허브 세션 · 검색 제출 · 필터 적용 · 결과 view · 결과 선택 · 찜 완료 · 지도 열기 · ref 누락 점검(`trigger='other'` 0건) · 비율 셋(세션당 검색, 선택률, 선택당 지도/찜).

### 비포 (배포 전, 2026-10-08 15:1x KST, `ssh msa-oci` ClickHouse 읽기 전용)
```
SELECT screen_type, action, count() n, uniqExact(view_id) views FROM analytics.events
 WHERE timestamp >= now() - INTERVAL 7 DAY GROUP BY screen_type, action
  (빈 screen_type) SESSION_END 1 · SESSION_START 2        ← 게임 세션
  ATTRACTION_DETAIL CLICK 1 · IMPRESSION 173 (11 views)
  UNIFIED_SEARCH    CLICK 1 · IMPRESSION 5 · SEARCH 1
  PLACE_HUB         (행 없음)                                ← 허브 6종 미계측(1단계 S1-12 그대로)
```

### 결과 한눈에 (2026-10-08 16:5x KST 완료)

| 항목 | 결과 |
|---|---|
| 커밋 | origin/main `8a61f0b` → `16090d4aa` (8커밋: 스펙 1 · 코드 5 · 문서 2). 바뀐 코드: portal-fe 7파일(`events.ts`·`tracker.ts`·`useFavorites.ts`·`FavoriteButton.tsx`·`PlacePage.tsx`·`AttractionPage.tsx` + 테스트 5), analytics 7파일(DTO·컨트롤러·유스케이스·어댑터 + 테스트 3). `common` 변경 0 |
| 테스트 | vitest 10파일 **208 passed** · `tsc -b` 0 · Kotest **17/0** (Adapter 6 · CollectEventItem 5 · Controller 6) |
| 회귀 주입 | 13회 전부 빨간불 → 되돌림 → 초록 (`docs/specs/2026-10-08-place-hub-instrumentation/verifications/regression-injection.md`). ①은 구문 오류 빨간불이라 무효 처리 후 유효 주입으로 재실행 |
| 최종 검증 | `hns:verifier` fresh context PASS, 불일치 0 (`verifications/final-verification.md`) |
| 배포 | images.yml 성공(06:29Z) → OCI `analytics`·`portal-fe` 둘 다 `16090d4`, Argo Synced |
| 세 수 대조 | CDP(일반 Chrome UA) 3회 합 **보낸 31건 = ClickHouse 31행**(1차 15 · 2차 10 · 3차 6). 응답은 전부 202. `accepted` 본문은 CDP `getResponseBody` 가 빈 값을 돌려줘 미수집 — 행 수 일치로 대체 |

배포 뒤 ClickHouse(60분, 내 세션 3개): SESSION_START 3 · SEARCH initial 3 / submit 1 / category 1 / area 1 · IMPRESSION 18 · CLICK card 1 / 목록 핀(map) 1 / MAP_OVERLAY(map) 1 / MAP_LINK 1. 쓰이지 않은 경로(미확인): **찜**(테스트 계정 없음) · `suggestion`·`nearMe`·`attribute`·`eventStatus`·`page`·`lang`(vitest 에서만 확인). 관찰: `landing` 은 운영에서 지역 목록(엣지 캐시)이 첫 관광지 질의보다 먼저 도착해 **생략될 수 있다** — SR-10 이 landing 을 건수에서 빼므로 영향 없음. 목록 핀은 시도 줌에서 클러스터 안이라 줌인(휠 7회) 뒤에야 개별 마커가 생긴다.

SR-10 첫 실행값(60분, 표본 = 내 세션이라 의미는 「질의가 돈다」뿐): 허브 세션 3 · 검색 제출 2 · 필터 적용 1 · ref 누락(other) **0** · 선택률 0.5 · 선택당 지도 열기 0.333.

### 결정 영향
_(S2-1 이후 슬라이스의 전후 비교는 이 기준선 정의로 한다)_

### 다음
S2-1 영문 정제(허브 카드·패널 경로) → S2-2 신뢰 블록(source 전달 + 원천 갱신일) → S2-3a 변형 시안.
