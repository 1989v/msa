# Engineer Review — domain (1라운드)

대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`
기준: `docs/context-map.md`, `docs/adr/ADR-0095-impression-click-pipeline.md`, `DESIGN.md`, `docs/standards/fe-visual-verification.md`, `docs/conventions/frontend-design.md`, `portal-fe/src/pages/place/*`

이 스펙은 FE 배치·성능 변경이라 애그리거트·도메인 이벤트·VO/엔티티 항목은 해당이 없다(새 엔티티·스키마·이벤트 없음, spec.md:4). 이번 판정은 용어(유비쿼터스 언어)만 근거로 한다.

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 | 통과. place(FE)와 search SSR 렌더러만 건드리고 다른 BC 데이터를 직접 참조하지 않는다 (spec.md:1, 34) |
| 2 | 용어집 존재 | **미흡**. `docs/context-map.md:16-38` 표에 place BC 행·`place/glossary.md` 가 없다 → D-1 |
| 3 | 스펙 용어 ↔ 용어집 | 용어집이 없어 신조어(배치 변형·폴드·필터 N)를 등록할 곳이 없다 → D-1 |
| 4 | Avoid 동의어 | 해당 없음(용어집 없음) |
| 5 | 스펙 ↔ 코드·문서 용어 일치 | **어긋남 4건** → D-2 ~ D-5 |
| 6~9 | 불변식·도메인 이벤트·교차 애그리거트·VO 구분 | 해당 없음 |

## 이슈

### D-2 (가장 중요) 「지도 열기」의 뜻이 기존 계측 규약과 다르다 — 체크 5
- 스펙: SR-1.6 (spec.md:22) — 「지도 보기」 토글 클릭이 「S1-12b 의 지도 열기 이벤트」 규약을 따르고 새 action 을 만들지 않는다.
- 기존 정의: 「지도 열기」는 **선택한 관광지 하나를 구글맵 새 탭으로 여는 외부 링크**다. `sectionId: 'MAP_LINK'`, `entityId: attraction.id` 가 붙는다 (PlacePage.tsx:1702-1718, AttractionPage.tsx:519-534). ADR-0095:131 은 이것을 「선택 뒤 후속 행동」으로 정의해 `POST_SELECTION_SECTIONS` 로 클릭 집계에서 뺀다. 2단계 기준선 지표 「선택당 지도 열기」(evidence/stage2/README.md:9, 34)도 이 값을 쓴다.
- 문제: 화면 안 지도 토글은 관광지가 없는(entity 없음) 배치 전환이다. 같은 규약으로 내보내면 entityId 를 채울 수 없고, 채우더라도 「선택당 지도 열기」 분자에 섞여 S1-12b 지표가 오염된다.
- 수정안: SR-1.6 을 다음 중 하나로 바꾼다. ⓐ 토글은 계측하지 않는다 — 배치 비교는 Q1 캡처로 하고, 「지도 열기」는 MAP_LINK 의미 그대로 둔다(권장, 가장 단순). ⓑ 계측이 필요하면 action 은 기존 `CLICK` 그대로 두고 별도 `sectionId`(예: `MAP_VIEW_TOGGLE`, entityType 없음)를 쓰며, MAP_LINK·`POST_SELECTION_SECTIONS` 와 섞이지 않음을 vitest 로 고정한다. 어느 쪽이든 스펙 문장에서 「지도 열기」를 「지도 보기 전환」으로 바꿔 두 용어를 가른다.

### D-3 「하단 시트」와 「바텀시트(KhSheet)」가 섞였다 — 체크 5
- 스펙: SR-1.3 「지도 위 하단 시트(접힌 높이 = 카드 1장)」 (spec.md:19), SR-2.2 「바텀시트(`KhSheet`)」 (spec.md:26).
- 기준: DESIGN.md:330 은 `KhSheet` 를 「바텀시트 — 먹빛 veil, 비대칭 귀, 드래그 닫기. **모바일의 다이얼로그 대체**」로 정의한다. 코드도 모달 용도로만 쓴다 (RegionSheet.tsx:61, PlacePage.tsx:1638-1641).
- 문제: SR-1.3 의 결과 시트는 지도와 함께 항상 떠 있는 비모달 패널이라 veil·포커스 가둠을 가지면 안 된다. 이름이 비슷해 구현자가 `KhSheet` 를 재사용하면 지도 조작이 막힌다.
- 수정안: SR-1.3 을 「지도 위 결과 패널(비모달, `KhSheet` 아님)」로 이름을 바꾸고, 접힘/펼침이 있다면 그 동작을 한 줄로 적는다. 「시트」라는 말은 `KhSheet` 에만 쓴다.

### D-4 「테마 칩」이 기존 용어와 겹친다 — 체크 5
- 스펙: SR-2.1 「핵심 테마 칩(분류 칩 중 전체·관광지·행사 3개)」 (spec.md:25).
- 기존: 코드·조건 모델은 이것을 **분류(category)** 로 부른다 (placeView.ts:34, 61; PlacePage.tsx:1335-1349). 「테마」는 이 레포에서 라이트/다크 정경을 뜻한다 (PlacePage.tsx:892, 998; fe-visual-verification.md:55).
- 수정안: 「핵심 분류 칩」으로 통일한다.

### D-5 「필터 N」의 셈 정의가 조건 모델과 한 곳 어긋난다 — 체크 5
- 스펙: SR-2.1 「`relaxConditions` 와 같은 정의에서 검색어·지역 제외」 (spec.md:25), SR-5.1 같은 문구 (spec.md:40).
- 기존: `relaxConditions` 는 `keyword`·`category`·`eventStatus`·`attribute`·`region`·**`geo`(내 주변 반경)** 를 낸다 (placeView.ts:32-38, 71). 시트 안에 둘 지도 오버레이 칩(spec.md:26)은 조건이 아니다(PlacePage.tsx:1368, 질의 미반영).
- 문제: `geo` 를 N 에 넣을지가 빠져 있어 테스트 기대값이 구현자 해석에 달린다.
- 수정안: 「N = `relaxConditions` 결과에서 kind 가 `keyword`·`region`·`geo` 인 것을 뺀 수(= 분류·행사 상태·속성). 오버레이는 세지 않는다」처럼 kind 로 못박는다(geo 를 넣기로 하면 그렇게 명시).

### D-1 place 용어집 없음 — 체크 2·3
- 근거: `docs/context-map.md:16-38` 에 place 행이 없다. 이 스펙이 만드는 말(배치 변형 `listFirst`/`mapSplit`, 폴드 높이 664px, 필터 N)과 기존 말(지도 열기=MAP_LINK, 분류, 바텀시트)을 둘 곳이 없어서 D-2~D-4 같은 겹침이 생긴다.
- 수정안: 스펙 통과 뒤 `/hns:glossary` 로 place 용어집을 만들고 context-map 에 한 줄 더한다. 이번 스펙의 차단 사유는 아니다.
- 덧붙여 「변형」은 experiment BC 의 `Variant`(A/B 배정, context-map.md:33)와 다른 것이다 — `?layout=` 은 비교 캡처용 강제 값이고 실험 배정이 아니다(spec.md:18). 용어집에 「배치 변형(layout variant) ≠ 실험 Variant」로 적어 둔다.

### 참고 (다른 차원 소관, 판정에 넣지 않음)
- SR-5.5 (spec.md:44) 의 CDP 캡처는 크기·위치만 잰다. 새로 생기는 면(하단 고정 「지도 보기」 버튼, 조건 요약 한 줄, 결과 패널)은 fe-visual-verification.md:55(기기×사이트 4조합)·:96·:135(대비, hover·focus 상태)의 측정 대상이고, 색은 DESIGN.md 토큰만 쓴다 — 검증/디자인 차원 리뷰에서 확인할 몫이다.

## 요약
차단할 도메인 모델 위반은 없지만 용어 겹침이 4건 있다. 그중 D-2 는 고치지 않으면 S1-12b 지표 「선택당 지도 열기」를 오염시키므로 구현 전에 반드시 고친다.

VERDICT: REVISE
