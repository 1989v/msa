# 2·3단계 증거 — 구현 (2026-10-09 코드 몫 배포 완료)

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

### 다음 (당시)
S2-1 영문 정제(허브 카드·패널 경로) → S2-2 신뢰 블록(source 전달 + 원천 갱신일) → S2-3a 변형 시안.

## S2-1 · S2-4 · S2-8 · S2-9 — 스펙 B · C (2026-10-08)

| 계획 ID | 스펙 | 증거 |
|---|---|---|
| S2-1 영문 정제 · S2-4 상태 규칙 | `docs/specs/2026-10-08-place-text-and-states/` | `verifications/regression-injection.md`, `verifications/deploy-check.md`(파서 v2 운영 67,435건 전부 v2 — 10-09 11:33 KST) |
| S2-8 ETag · S2-9 신뢰 페이지 | `docs/specs/2026-10-08-place-trust-pages-etag/` | 같은 폴더 `verifications/` |

## 2단계 나머지 + 3단계 코드 몫 — 스펙 D · E · F · G1 · G2 (2026-10-09)

운영 배포 `0d7377f`(12:31 KST) → 수정판 `9f65c3a` · `8cf3177` · `ac95a67` · `74bc02d`. 새 스위치 넷(묶음 공유 · 영문 짝 hreflang · IndexNow 제출 · 랜딩 색인)은 꺼진 채 배포.

| 스펙 | 계획 ID | 회귀 주입 | 운영 확인 | 증거 |
|---|---|---|---|---|
| D 상세 첫 화면 | S2-2 · S2-7 · S3-7 | 18/18 빨강 | S2-7 30곳 불일치 0, schema.org 오류 0, 390 길찾기 4/10(미충족) | `docs/specs/2026-10-09-place-detail-first-screen/verifications/` |
| E 모바일 허브·성능 | S2-3a·b · S2-5 | 14/14 빨강 | 390 폴드 카드 0→2, 1440 첫 카드 y 438(범위 밖 미충족), CLS 회귀 발견·해소 | `docs/specs/2026-10-09-place-hub-mobile-perf/verifications/`, `lh/{before,after,after2,after3}/README.md` |
| F 복귀·공유·계측 | S3-3 · S3-4 · S3-4b · S3-6a | 28/28 빨강 | 꺼짐 404 동일, GA 0건 | `docs/specs/2026-10-09-place-return-share-events/verifications/` |
| G1 랜딩·편집 | S3-1 · S3-2 | 37 중 35 빨강(1 무동작·1 보강) | 랜딩 20장 noindex·301·404 | `docs/specs/2026-10-09-place-longtail-landings/verifications/` |
| G2 hreflang·RSS·IndexNow | S3-5 · S3-9 | 24/24 빨강 | hreflang 0줄, 피드 200(항목 0 — 10-10 재확인) | `docs/specs/2026-10-09-place-hreflang-feed-indexnow/verifications/` |

배포 뒤 사용자 지적으로 고친 것: 상세 길찾기(place_id → `destination_place_id`, 없으면 좌표 — 「이름+주소」는 운영 표본 8건 중 0건 착지), 상세 사진 타일 아래 여백(3줄 고정). 성능 원시 JSON 은 레포 밖(`scratchpad/lh-raw/stage2/`).

### 남은 것
- 세션: RSS·IndexNow 재확인(10-10), H 판정 세트 사례(S3-6b), I 방문량 추천·가는 법(S4-3·S4-4), J 데이터 스토리 초안(S4-5), 종합 비포/애프터.
- 사용자: 스위치 넷과 ADR 승인, 편집 초안 3장 검수, 모바일 상세 긴 칸 접기·선정 균형·시도 약칭 등 결정 — 목록은 아티팩트 §16.
