# 결정 기록 — S1-12b

### 2026-10-08 — 리뷰 1라운드: 중복 키·eventId 에 sectionId
FE `keyOf` 와 서버 eventId 에 `sectionId` 추가(노출 포함). 상세 두 섹션 겹침 노출이 2행이 되는 것은 ADR-0095 §2(지면별 CTR)와 같은 방향이라 수용. 찜은 `saved:true` 만 집계.

### 2026-10-08 — 리뷰 2라운드 심판 §2 (`context/review-verdict-round2.md`)
① `overlay` 트리거 제거(지도 레이어, 목록 질의 아님) ② 선택률은 view 단위 전환 + 분자를 선택 튜플로 제한, 자동완성 CLICK 미발화 유지 ③ 제외 상수 `POST_SELECTION_SECTIONS` 를 use case companion 에 ④ `TrackedItem = PlacedItem | PageItem(sectionId?: never)` 판별 합집합 ⑤ 가운데 클릭 미계측.

### 2026-10-08 — 리뷰 3라운드 심판 (`context/review-verdict-round3.md`)
test-strategy 4건 전부 MINOR 강등(결정 불변) — `other` 금지 게이트로 대체, IMPRESSION 부정 단언, screenRef 합성 단언, `@ts-expect-error` 타입 게이트. 메모 ②(SR-10 ref 누락 점검 행)·③(접두 제거 주입) 채택, ①(`PlacedItem.entityType` 좁히기) 미채택(KISS).
