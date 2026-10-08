# 2단계 증거 — 구현 (진행 중)

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

### 결과 한눈에
_(구현·배포 뒤 채운다: 바뀐 파일·커밋 · 테스트 수 · 회귀 주입 12건 표 · 배포 뒤 세 수 대조(보낸 건수 = 202 accepted = ClickHouse 행) · SR-10 질의 첫 실행값)_

### 결정 영향
_(S2-1 이후 슬라이스의 전후 비교는 이 기준선 정의로 한다)_

### 다음
S2-1 영문 정제(허브 카드·패널 경로) → S2-2 신뢰 블록(source 전달 + 원천 갱신일) → S2-3a 변형 시안.
