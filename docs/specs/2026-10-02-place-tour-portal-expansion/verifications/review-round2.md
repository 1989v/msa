# 재리뷰 1회차 — 1차 REVISE 반영 확인

대상: `spec.md`(189줄) · `planning/test-quality.md` · `planning/requirements.md` · `context/open-questions.yml` · `docs/adr/ADR-0104-place-tour-portal-expansion.md`
방법: 1차 리뷰 6개의 「반영」 표가 가리키는 spec 줄을 직접 열어 대조했다. 새 지적은 wt3 코드로 확인했다.

## 1. 1차 지적 반영 확인

| 차원 | 지적 | 결과 |
|---|---|---|
| architecture | R1~R4 | 전부 해결. `EventSchedule` 한 객체(spec.md:63,68-72) · 유효 날짜 색인(:76) · 레이어 배치(:85, :96, :126-127) · 투영 contentId(:80) · 재색인 소요 비교(:165) |
| domain | D1, D3, D4, D5, D6 | 해결(spec.md:58-59, :110 · :27-28, :64-69 · :67, :76 · :30, :164 · :47-52) |
| domain | D7 | 해결(:149-150, :111 「주변 명소」) |
| implementation | I1~I10 | 전부 해결(:77 · :80 · :23-26, :35 · :27-28 · :76 · :130-132, :124-125 · :154-156 · :159-160 · :35-37 · :39-40) |
| security | R1~R3 | 전부 해결(:128-133, :169 · :99-100 · :103, :147) |
| test-strategy | R1~R8 | 전부 해결(spec.md:81-82 · T9, T12, T12b, T4, T13, T19, T11, T7b, T16, T10, T15, T18 · spec.md:158, :163, :166) |
| usecase | U1, U3~U7 | 해결(:70, :85, :88 · :90 · :91 · :42-43 · :88, :98, :111 · :104, :118, :121) |

### 미반영 6건 사유 판정

| 지적 | 판정 | 이유 |
|---|---|---|
| domain D2② 이름 분리 | 타당 | 상태 칩은 한 번에 하나만 고른다. 사전에 「행사 상태」(값 넷)와 「행사 필터」(값 다섯)를 따로 올려 두 뜻이 섞이지 않는다(spec.md:149) |
| domain D5 좌표 없는 행사 보존 Q | 타당 | 모델이 좌표를 non-null 로 요구한다. 대신 제외 건수를 Q1 에서 잰다(open-questions.yml:5) |
| domain D7 context-map 행 | 타당 | 관광지 용어 자리가 이미 `search/glossary.md` §3-1 이다(spec.md:150) |
| security R1 메모리 캐시 | 타당 | 측정된 병목이 없다. `max-age=300` 이 반복 요청을 막는다(spec.md:129, :131) |
| usecase U2 기존 절 제거 → 종료 행사만 제외 | 방향은 타당. 다만 구현 경로에 빈칸이 생겼다 → 아래 N1 |
| usecase U7 「자체 가공 절」 조건 | 타당 | 그 조건이면 숙박 전체가 빠진다. 사진 조건으로 먼저 거른다. 다만 「숙박」의 범위가 비어 있다 → 아래 N3 |

## 2. 반영 과정에서 생긴 새 지적

### N1 [implementation · test-strategy] 가까운 곳·비슷한 곳 항목의 「유효 종료일」이 지나가는 자리가 빠졌다
- 스펙: spec.md:113-114 는 두 가지를 요구한다. 재색인이 종료·`UNKNOWN` 행사를 후보와 건수에서 뺀다. 그리고 각 항목에 유효 종료일을 실어 렌더·화면이 한 번 더 거른다.
- 코드: 가까운 곳과 건수는 1차 투영 `RegionProjection` 으로 계산한다(`AttractionApiReindexTasklet.kt:303`, `:317-328`). 비슷한 곳 항목도 이 투영에서 만든다(`:180-181`). 그런데 spec.md:80 은 투영에 contentId 만 더한다. 날짜가 없으면 재색인이 후보를 거를 수 없다.
- 항목 클래스가 다섯 벌이다. 도메인 `NearbyPlace`(`RegionAggregator.kt:33`) · `SimilarPlace`(`SimilarPlace.kt:7`), 쓰기 문서 `AttractionIndexDocument.Nearby/Similar`(`:127`, `:130`), 읽기 문서 `AttractionSearchDocument.Nearby/Similar`(`:81`, `:84`), View `SearchAttractionUseCase.Nearby/Similar`(`:126`, `:128`). 계약 게이트는 매핑의 최상위 키만 본다(review-implementation.md:24). 그래서 하위 필드가 한 곳에서 빠지면 null 이 되고, 렌더의 2차 거르기는 경고 없이 꺼진다. spec.md:77 이 막으려는 사고와 같은 모양이다.
- 수정안:
  - spec.md:80 의 투영에 유효 시작일·유효 종료일을 더한다(또는 재색인일 기준 「제외 여부」 한 비트). 이때 `RegionAggregator` 가 그 값으로 후보를 거른다고 적는다.
  - SR-6 에 위 다섯 자리를 적는다.
  - T9 의 캡처 왕복에 `sameCategoryNearby[].eventEndEffective` · `similarElsewhere[].eventEndEffective` 를 더한다. 회귀 주입은 읽기 클래스의 하위 필드 하나를 지우는 것으로 한다.

### N2 [domain] Q4 기본값이 SR-1·SR-3 의 변환 실패 규칙과 다르다
- open-questions.yml:21 은 「변환 실패 → 날짜 없음(UNKNOWN)」이라고 쓴다.
- spec.md:27 은 실패한 값만 None 으로 둔다. spec.md:64 는 그 결과 E 만 남으면 (E,E), S 만 남으면 (S,S) 로 본다. 따라서 한쪽만 실패한 행은 UNKNOWN 이 아니다.
- 수정안: Q4 default 를 「변환에 실패한 값만 None — 남은 쪽으로 SR-3 정규화」로 고친다.

### N3 [domain] 정적 sitemap 의 「숙박」 범위가 정해지지 않았다
- spec.md:59 는 「숙소 = `category=stay`(캠핑장 포함)」로 정했다. 예외는 원문 키 절과 딥링크 둘뿐이고, 이 둘만 유형 32·80 기준이다.
- spec.md:121 「숙박은 개요와 대표 사진이 둘 다 있을 때만」은 어느 기준인지 쓰지 않았다. 이것을 `category=stay` 로 읽으면 레포츠(28) 캠핑장의 기존 행이 바뀐다. 지금은 개요만 있으면 sitemap 에 실리는데(`prerender-seo.mjs:942-943`), 사진이 없으면 빠지게 된다. 이것은 spec.md:15-18 「유지」에 없는 변경이다.
- 수정안: spec.md:121 에 「유형 32·80」(또는 `category=stay` 와 그에 따른 기존 행 영향)을 명시한다. T13 의 숙박 사례에 레포츠 캠핑장(28·`AC05`) 대조 행을 더한다.

### N4 [usecase, 경미] 「파라미터 없으면 바이트 동일」과 자동완성 상시 조건이 문장끼리 부딪힌다
- spec.md:87 은 `eventStatus`·`sort` 가 없는 요청이 지금과 같다고 쓴다. spec.md:90 은 자동완성이 항상 「행사가 아니거나 `NOT_ENDED`」를 건다고 쓴다. 자동완성 질의는 파라미터가 없어도 바뀐다.
- T10(test-quality.md:23)은 둘을 따로 보므로 검사에는 문제가 없다. 문장만 고치면 된다.
- 수정안: spec.md:87 에 「자동완성 제외(:90)」를 덧붙인다.

### 참고 (경미, 판정에 넣지 않음)
- T9(test-quality.md:21)는 재색인 완료 로그 중 「코스 매칭 실패」만 단언한다. spec.md:65 의 S>E·날짜 없음 건수는 단언하지 않는다. 같은 행에 한 줄 더하면 된다.

## 3. 구조 규칙

- 길이: spec.md 189줄. 400줄 이하라 통과다.
- SR 당 항목 수: 최대 8개다(SR-1·SR-3·SR-4b·SR-5·SR-8 이 정확히 8). 8항목 이하라 통과다.
- TBD·TODO·미정: 0건이다.
- ADR-0104 와 spec: 결정 1~7 이 spec 과 일치한다. 03:10(결정 3 ↔ :35), 「개요 없음 OR +31일」(결정 4 ↔ :118), 호스트 404·폴백 없음(결정 5 ↔ :130-131), 숙박 딥링크 제외(결정 6 ↔ :100), 약 44콜 + 행사 쪽수(결과 ↔ :39)를 대조했다. 불일치는 없다.
- SR 사이 충돌: 위 N2(SR-1/SR-3 ↔ Q4)와 N4(SR-4b 내부) 외에는 없다. 「`UNKNOWN` 은 필터에서 빠짐」(:67)과 「행사가 아니거나 범위 안」(:86)은 서로 맞는다. 유효 날짜가 없는 문서는 범위 질의에 걸리지 않기 때문이다.
- T 번호의 SR 수용 기준 커버: SR-1(T7·T18) · SR-1b(T7, 실패 격리) · SR-2(T4·T4b) · SR-2b(T6) · SR-3(T1·T2·T2b·T12b) · SR-4(T8·T9·T9b) · SR-4b(T10·T13·T16) · SR-5(T3·T11·T11b·T12) · SR-6(T9·T11·T16, N1 하위 필드 제외) · SR-7(T3·T13·T12b) · SR-7b(T14·T15) · SR-8(T20) · SR-10b(T18·T19). SR-9·SR-10 은 문서·절차라 테스트 대상이 아니다.

## 4. 판정

| 차원 | 판정 | 남은 지적 |
|---|---|---|
| architecture | SHIP | — |
| domain | REVISE | N2, N3 |
| implementation | REVISE | N1 |
| security | SHIP | — |
| test-strategy | REVISE | N1(T9 하위 필드 왕복) |
| usecase | REVISE | N4(경미) |
| **전체** | **REVISE** | 4건. 모두 문안 수정으로 끝나고 BLOCK 사유는 없다 |

VERDICT: REVISE

## 반영 (2026-10-02, 메인 세션)
| 지적 | 반영 |
|---|---|
| N1 | spec.md SR-4 id 매칭 줄에 투영의 유효 날짜 추가 · SR-6 에 하위 필드 다섯 자리 명시 · test-quality T9 에 하위 필드 왕복·회귀 주입 |
| N2 | open-questions Q4 기본값을 spec(값만 None → 남은 쪽 규칙)에 맞춤 |
| N3 | spec.md 숙박 sitemap 조건을 유형 32·80 기준으로 명시 · T13 에 캠핑장 대조 |
| N4 | spec.md 「바이트 동일」 줄에 자동완성 예외 명시 |
