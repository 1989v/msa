# Engineer Review — usecase (1라운드)

대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`
대조: 계획서 `docs/plans/2026-10-08-place-growth-work-plan.md` S2-3a(:80)·S2-3b(:81)·S2-5(:83), 계측 스펙 `docs/specs/2026-10-08-place-hub-instrumentation/spec.md`, 코드 `portal-fe/src/pages/place/PlacePage.tsx`·`placeView.ts`, `search/.../AttractionPageRenderer.kt`, 측정 `evidence/stage1/perf-baseline.md`.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | Actor-goal | 통과 | User Stories 3줄(spec:10-12)이 SR-1~4 에 대응 |
| 2 | Main/Alt/Exception flow | **미흡** | listFirst 지도 상태의 대안 흐름 다수 미정의 (U-4) |
| 3 | Pre/Postcondition | **미흡** | 데스크톱 y≤320 기준선 미확인 (U-3), 「지도 보기」 계측 사후조건이 계측 스펙과 충돌 (U-1) |
| 4 | AC 추적성 | **미흡** | S2-5 완료 조건 중 insecure 0·적재 시 치환·히어로 SSR img 가 스펙에서 바뀌거나 빠짐 (U-2) |
| 5 | Edge case 확장 | **미흡** | 「필터 N」 정의와 요약 줄 범위 불일치 (U-5), U-4 |
| 6 | 테스트 매핑 | 대체로 통과 | SR-5.1~5.3 이 SR-1·2·4 를 덮음. U-4·U-5 해소 시 케이스 추가 필요 |

## 이슈

### U-1 「지도 보기」 계측이 계측 스펙의 「지도 열기」 정의와 충돌 — 체크 3
- 스펙: spec:22 「「지도 보기」 클릭은 기존 지도 열기 계측 규약(S1-12b 의 지도 열기 이벤트)을 따른다」.
- 계측 스펙의 지도 열기는 **관광지 하나의 Google Maps 링크** 클릭이다 — 대상 `ATTRACTION`/관광지 id, 섹션 `MAP_LINK` (instrumentation spec:43). 「지도 보기」 토글에는 관광지 id 가 없다. 이 행을 `MAP_LINK` 로 내면 SR-10 「지도 열기」·「선택당 지도 열기」 비율(instrumentation spec:83, :87)이 오염되고, `POST_SELECTION_SECTIONS` 제외(:64)의 「선택 뒤 후속 행동」 의미와도 맞지 않는다. 지도 레이어 조작(오버레이 토글)은 계측 스펙이 명시적으로 범위 밖에 뒀다(:120).
- 수정안: SR-1.6 을 「「지도 보기 / 목록 보기」 토글은 계측하지 않는다(계측 스펙 Out of Scope 의 오버레이 토글과 같은 이유 — 지도 레이어 조작이지 목록 질의·선택이 아니다). 지도 상태에서 생긴 핀 CLICK·이 지역 검색 SEARCH 는 계측 스펙 그대로」로 바꾸고, 세려면 계측 스펙 Q13 과 같은 후속 질문으로 open-questions 에 둔다. SR-5.1 에 「토글 클릭 → `track` 미호출」 한 줄.

### U-2 S2-5 완료 조건과 어긋남 — 체크 4
- 계획서 S2-5(plan:83): 「`http://tong.visitkorea.or.kr` 사진 https 치환(**적재 시**)」, 완료 조건 「**insecure requests 0**」, 「히어로 `<img>` SSR 은 이미지 SEO·CLS 항목」.
- 스펙: 표시 시점 파생(spec:34, Out of Scope spec:50 「적재 시 사진 주소 정규화」), 다른 http 호스트는 「기록」만(spec:34) → insecure 0 을 보장하지 않는다. 히어로 SSR `<img>` 는 하지도 빼지도 않았다. 또 spec:34 가 열거한 「SSR `<img>`」는 지금 렌더러에 없다 — 렌더러 사진 출력은 og:image(`AttractionPageRenderer.kt:54`, `:145-146`)와 JSON-LD image(`:241`)뿐이고 본문은 `<div id="root">$body</div>`(`:113`).
- 상세·지역 병목은 TTFB + 렌더 지연(perf-baseline.md:41)인데 SR-4 에는 이를 겨누는 항목이 없다. SR-5.4 는 전후를 재기만 하고 통과 기준이 없다.
- 수정안: ① 「적재 시 → 표시 시점」 변경을 계획서 편차로 명시(data-sources §0 ② 근거)하고 계획서 S2-5 행에 같은 줄을 반영. ② insecure 0 을 완료 조건으로 유지할지 정한다 — 유지하면 tong 외 http 호스트 실측 목록과 처리(제외·플레이스홀더)를 SR-4.2 에, 못 지키면 「insecure = tong 외 N건, 사유」로 기준을 고친다고 적는다. ③ 히어로 SSR `<img>` 는 Out of Scope 에 이유와 함께(측정상 상세 LCP 가 텍스트 — perf-baseline.md:41·:50). ④ SR-4.2 열거를 「og:image·JSON-LD image·FE 카드/패널/상세 img」로 실제 출력에 맞춘다. ⑤ SR-5.4 에 통과 기준: 「허브 관측 LCP 의 Resource load delay 중앙값 감소, 허브 CLS 중앙값 ≤ 기준선, 상세·지역은 회귀 없음(중앙값 악화 없음) — 개선 목표 아님을 명시」.

### U-3 S2-3b 의 1440×900 첫 카드 y≤320 전제가 미확인 — 체크 3·4
- 스펙: SR-3 이 계획서 조건을 그대로 가져오면서(spec:30) 데스크톱 레이아웃은 바꾸지 않는다(spec:17, :27, Out of Scope spec:50).
- 데스크톱 첫 카드 위로 헤더(`PlacePage.tsx:1191-1210`)·툴바·분류/오버레이 칩(:1333-1396)·속성 칩+캡션(:1425-1453)·`RegionDrilldown`(:1456-1464)이 쌓인다. 지금 y 값이 어디에도 기록돼 있지 않다(stage1 증거에 1440 측정 없음).
- 수정안: 사전조건으로 「구현 전 1440×900 현재 첫 카드 y 를 잰다」를 SR-3 에 넣고, 320 을 넘으면 ⓐ 데스크톱 툴바 압축을 범위에 넣거나 ⓑ 실측·이유를 보고하는 것 중 무엇을 하는지 미리 정한다(지금은 Out of Scope 가 ⓐ 를 막아 ⓑ 만 남는데 그 사실이 스펙에 없다).

### U-4 listFirst 지도 상태의 대안·예외 흐름 미정의 — 체크 2·5
spec:19 는 정상 흐름만 있다. 코드상 다음이 갈린다:
- **오버레이 칩 + 지도 닫힘**: 오버레이 질의는 `overlay != null && mapView != null` 일 때만 돈다(`PlacePage.tsx:974`). 시트(SR-2.2)에서 오버레이를 켜도 지도가 닫혀 있으면 아무 일도 없다 — 칩을 숨길지, 누르면 지도를 열지, 그대로 둘지.
- **클러스터 최대 줌 → 목록 안내**: `scrollCardIntoView`(:780-787)는 목록 카드로 스크롤한다. 지도 상태에서는 목록이 숨겨져 있다 — 하단 시트 안 카드로 갈지.
- **지도 상태에서 핀 선택**: 선택 상세는 모바일 `KhSheet`(:1640-1647)다. 결과 하단 시트 위에 겹칠 때 닫기 순서·포커스.
- **지도 키 없음**(`hasMapKey` false, :1619-1621): 「지도 보기」 버튼을 숨길지.
- **지역 고르기 화면**(`pickingRegion`, :583, :811): 지도 상태에서 시도 마커와 하단 시트의 내용.
- **브레이크포인트 넘나듦**(회전·창 크기, `MOBILE_QUERY` :202): 지도 상태에서 데스크톱으로 넘어갔다 돌아올 때 상태 유지 여부. 한 번 받은 지도 JS 는 그대로.
- **하단 시트 안 무한 스크롤 센티널**(:1589-1591): 접힌 시트(카드 1장)에서 `page` 트리거가 언제 나는지.
- **「목록 보기」 복귀**: 목록 스크롤 위치·`selectedId` 유지 여부.
- 수정안: SR-1.3 아래 「대안 흐름」 표로 위 항목마다 동작 한 줄. vitest 로 잡히는 것(오버레이+지도 닫힘, 키 없음 시 버튼, 브레이크포인트 전환 시 `loadGoogleMaps` 재호출 없음)은 SR-5.1 에 추가, 지도 객체가 필요한 것(클러스터·핀)은 SR-5.5 CDP 로.

### U-5 「필터 N」 정의와 요약 줄 범위 불일치 — 체크 5
- 스펙: N = `relaxConditions` 에서 검색어·지역 제외(spec:25). `relaxConditions`(`placeView.ts:58-72`)는 분류·행사 상태·속성·**geo** 를 낸다 → 「내 주변」·「이 지역 검색」도 N 에 들어간다. 반면 요약 줄은 「고른 분류·속성 이름」만(spec:25) — 행사 상태·geo 는 N 에 세지만 요약에 없다. 오버레이는 시트 안에 있는데(spec:26) `relaxConditions` 에 없어 N 에 안 든다. 바깥 테마 칩으로 고른 분류도 N 에 세여 칩 활성과 N 이 이중 표시된다.
- 수정안: N 에 geo·오버레이를 넣을지 명시하고, 요약 줄 항목을 N 의 구성과 같은 목록으로 맞춘다(또는 다른 이유를 한 줄). SR-5.1 의 N 케이스에 geo 걸린 경우·행사 상태 걸린 경우를 추가.

## 계측 스펙과의 정합 (충돌 없음 확인분)
- 변형이 `query` 메모·trigger 를 안 바꾸고 지도 열기/닫기가 SEARCH 를 안 낸다(spec:21) → viewId 단위(instrumentation spec:24) 보존.
- 시트 안 칩은 같은 핸들러(spec:26) → trigger `category`·`attribute`·`eventStatus` ref 심기(`PlacePage.tsx:1337-1338`, :1352-1353, :1409-1410) 유지. 회귀 주입 「변형이 질의를 바꾸게 함」(spec:42)이 이를 지킨다.
- 카드 IMPRESSION(instrumentation spec:39)은 목록이 숨겨지면 안 나가는 것이 정상 — 숨김이 `display:none` 이면 IntersectionObserver 가 0 면적으로 본다. 언마운트/재마운트여도 (viewId, 섹션) 중복 키로 재발화 없음.

VERDICT: REVISE
