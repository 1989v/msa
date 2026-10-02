# Domain Review — place 관광 포털 확장

- 대상: `spec.md` · `context/open-questions.yml` · `docs/adr/ADR-0104-place-tour-portal-expansion.md`
- 차원: domain (행사 상태·KST 경계 · 유형 분류 · 코스 구성 · 용어 사전 일관성 · 외부 데이터 3규칙)
- 근거 범위: 같은 워크트리(wt3)

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 | 통과. place 가 날짜만 저장하고(SR-2), 상태 판정은 search 읽기 모델 쪽에 둔다(SR-3:46, ADR-0104:26-28). deal 과도 분리돼 있다(ADR-0104:37-38) |
| 2 | 용어 사전 존재 | 부분. `search/glossary.md` §3-1 에 관광지 용어가 있다. place 용어 사전은 없고 `docs/context-map.md:20` 에도 place 행이 없다 → D7 |
| 3 | 스펙 용어 ↔ 사전 | 새 용어가 등재되지 않았다(SR-9:98 이 등재를 예고만 한다) → D7 |
| 4 | Avoid 동의어 | 위반 없음. 「프리렌더」는 지역 페이지에만 쓴다(SR-6:69, `search/glossary.md:79` 와 같은 뜻) |
| 5 | 코드와 용어 일치 | `stay`·「숙박」의 범위가 코드와 다르다 → D1 |
| 6 | 불변식 | 행사 날짜 불변식에 빈칸이 있다 → D3, D4 |
| 7 | 도메인 이벤트 | 해당 없음(새 이벤트 없음) |
| 8 | 애그리거트 간 참조 | 통과. 코스 구성은 색인하지 않는 객체에 contentId·id 로만 싣는다(SR-4:49-50) |
| 9 | VO/엔티티 | 통과. 행사 상태는 저장하지 않는 파생 값(SR-3:41) |

## 이슈 (REVISE)

### D1 — 「숙박 = `stay`」 정의가 기존 데이터·화면과 겹친다 (#5)
- 스펙: 「숙박 → `stay`. 그 밖의 유형은 지금 규칙 그대로」(spec.md:35). 근처 숙소는 반경 5km·최대 6건(spec.md:70).
- 코드 ①: `stay` 는 이미 다른 유형에서도 나온다. 구 코드가 비면 신 대분류 `AC` 가 `stay` 로 간다(`place/ingest/src/sync_tour.py:63`, `:104-107`). 캠핑장 `AC05` 가 그 경로를 탄다는 것은 테스트가 보여 준다(`place/ingest/tests/smoke_test.py:399`). 무지정 조회에서는 `cat1` 이 늘 비어 온다(`docs/architecture/data-sources.md:104-105`). 그래서 레포츠(28) 캠핑장이 지금도 `stay` 일 수 있다.
- 코드 ②: 관광지 상세의 편의시설 캐로셀이 이미 `stay` 를 5km·유형당 6건으로 조회한다(`portal-fe/src/api/placeApi.ts:189`, `portal-fe/src/pages/place/AttractionPage.tsx:87,136`). 숙박 2,990건이 들어오면 새 「근처 숙소」와 같은 카드가 한 화면에 두 번 나온다.
- 수정안: 「숙소」를 `category=stay`(캠핑 포함)로 볼지 `contentTypeId ∈ {32,80}` 로 볼지 SR-2 에 한 줄로 정한다. 그리고 SR-6 에 `AMENITY_CATEGORIES` 에서 `stay` 를 빼거나 캐로셀의 숙박 몫을 「근처 숙소」로 옮긴다고 적는다. 전자로 정하면 SR-10 의 숙박 규모 확인(spec.md:102)도 유형이 아니라 분류 기준으로 바꾼다.

### D2 — `eventStatus` 한 필드에 상태와 기간이 섞였고, 기본값을 표현할 값이 없다 (#3, #6)
- 스펙: 상태는 셋(진행 중·예정·종료)이다(spec.md:41-42). 필터 값은 `ONGOING`·`WEEKEND`·`UPCOMING`·`THIS_MONTH` 이고 그 밖의 값은 무시한다(spec.md:52). 그런데 칩 기본값은 「진행 중+예정(종료 제외)」(spec.md:54)이고, 근처 행사도 「종료 제외」(spec.md:70)다.
- 문제 ①: 기본값과 근처 행사가 쓰는 「종료 아님」을 나타낼 값이 없다. 단일 값 필터로는 진행 중+예정을 한 번에 조회할 수 없다.
- 문제 ②: `WEEKEND`·`THIS_MONTH` 는 상태가 아니라 기간이다. 「행사 상태」를 세 값으로 정의해 놓고 필터 이름에 기간을 섞으면 같은 말이 두 뜻을 갖는다.
- 수정안: `NOT_ENDED` 를 더하거나 다중 값(`ONGOING,UPCOMING`)을 허용한다. 이름은 `eventWindow` 로 바꾸거나, 상태(`eventStatus`)와 기간(`eventPeriod`)을 둘로 가른다. ADR-0104:26 의 「진행 중·예정·종료·이번 주말·이번 달」 서술도 같이 고친다.

### D3 — 행사 날짜 불변식에 빈칸이 있다 (#6)
- 스펙이 정한 경우는 「종료일 없음 → 시작일」과 「둘 다 없음 → 상태 없음」뿐이다(spec.md:43, open-questions.yml Q4).
- 정하지 않은 경우: ① 시작일 없이 종료일만 있음 ② 시작일 > 종료일(원천 오류) ③ `yyyyMMdd` 파싱 실패.
- 「이번 주말」의 「오늘 이후 날짜」(spec.md:44)는 오늘을 포함하는지가 문장으로 드러나지 않는다(일요일 예외 문장으로만 추론된다).
- 수정안: SR-3 에 세 경우의 처리를 적는다. 예: ① 종료일을 시작일로도 본다 ② 상태 없음으로 두고 건수를 Q4 와 함께 잰다 ③ null 로 적재하고 원문은 목록 행 원문에 남는다. 주말 문장은 「오늘 포함」으로 쓴다. 각 경우를 골든 픽스처에 넣는다.

### D4 — 「판정 함수 하나」가 검색 범위 질의에서는 보장되지 않는다 (#6)
- 스펙: 검색 필터도 같은 순수 함수를 부른다(spec.md:46). 그런데 필터는 「날짜 범위 질의로 바꾼다」(spec.md:52).
- 문제: OpenSearch 질의는 문서마다 함수를 부르지 않는다. 종료일 없는 행사(시작일을 종료일로 봄)는 색인된 `endDate` 가 비어 있으면 `endDate >= today` 범위에서 빠진다. 또 「상태 없음」 행사는 「행사」 칩 기본 필터에서 사라진다. 이것은 「일반 관광지처럼 다룬다」(spec.md:43)와 충돌한다.
- 수정안: ① 재색인이 「유효 종료일」(종료일 없으면 시작일)을 색인 필드로 싣는다고 SR-4:49 에 적는다. ② 도메인 함수가 상태 판정과 「상태 → 날짜 범위」 변환을 함께 내게 한다. 픽스처의 모든 날짜 조합에서 `statusOf(doc, today) ∈ S ⇔ doc ∈ rangeFor(S, today)` 를 확인하는 테스트를 수용 기준에 넣는다. ③ 상태 없는 행사를 「행사」 칩에서 보일지 정한다.

### D5 — §0 ①「대상 전부」 예외인 좌표 제외가 드러나 있지 않다 (data-sources §0 ①)
- 스펙: 기존 「좌표 제외 규칙」을 그대로 쓴다(spec.md:24). 코드는 좌표가 없는 행을 버린다(`place/ingest/src/sync_tour.py:218-222`). §0 ① 은 「대상도 전부」를 요구한다(`docs/architecture/data-sources.md:21-23`).
- 영향: 여행코스·행사는 좌표가 빈 행이 관광지보다 많을 수 있다. 그 경우 SR-10 의 규모 대조(행사 294/94, 코스 1,068 — spec.md:102)가 맞지 않게 되고, 누락인지 제외인지 가를 수 없다.
- 수정안: SR-1:27 의 로그에 유형·언어별 「좌표 제외 건수」를 더한다. SR-10 대조식을 「호출 규모 − 좌표 제외」로 고친다. 좌표 없는 행사를 원문으로라도 남길지는 Q 로 연다. 모델이 좌표 non-null 을 요구하므로(`place/domain/.../Attraction.kt:33-34`, `:141-142`) 남기려면 별도 결정이 필요하다.

### D6 — §0 ③ 왕복 경로의 자리 목록이 실제보다 적다 (data-sources §0 ③)
- 스펙은 여섯 곳을 적었다(spec.md:33).
- 실제로 새 필드가 지나가는 자리가 더 있다: `UpsertAttractionUseCase` 커맨드(`place/feature/.../UpsertAttractionUseCase.kt:45` 부근), `GetAttractionUseCase.AttractionView`(`GetAttractionUseCase.kt:21`), `AttractionService` 의 두 매핑(`AttractionService.kt:83`, `:91`), 도메인 `create`/`restore`(`Attraction.kt:94`, `:191`). 대장도 「요청 DTO·View·응답 DTO」 세 곳을 명시한다(`docs/architecture/data-sources.md:58`).
- `AttractionDtoRoundTripTest` 가 일부를 잡지만, 목록에 없으면 작업자가 테스트 실패를 보고서야 자리를 찾는다.
- 수정안: SR-2:33 목록에 위 자리를 더하고, 수용 기준에 `AttractionDtoRoundTripTest` 통과를 넣는다.
- 덧붙임: 행사 날짜에 「들어온 값이 있을 때만 갱신」(spec.md:34)을 적용하면, 원천이 종료일을 지워도 반영되지 않는다. 의도한 예외라면 한 줄로 밝힌다.

### D7 — 새 용어가 사전에 없다 (#2, #3)
- 새 용어: 행사 상태(진행 중·예정·종료), 이번 주말, 이번 달, 만료 noindex(종료 + 31일), 코스 구성, 근처 행사, 근처 숙소, 분류 `festival`·`course`. 모두 미등재다. SR-9:98 은 등재를 예고만 한다.
- place 용어 사전이 없고 `docs/context-map.md:20` 은 search 만 가리킨다. 지금 관광지 용어는 `search/glossary.md` §3-1 에 있다.
- 사전과 표기가 어긋난 곳이 하나 있다: 사전과 코드는 「주변 명소」(`search/glossary.md:80`, `AttractionPage.tsx:70`)인데 스펙은 「주변 관광지 섹션」(spec.md:71)이다.
- 수정안: 구현 전에 `/hns:glossary --conflict 행사 상태` 를 돌려 위 용어를 `search/glossary.md` §3-1 에 넣는다. 어떤 용어를 place 쪽에 둘지는 context-map 에 한 줄로 정한다. spec.md:71 은 「주변 명소」로 맞춘다.

## 확인한 것(문제 없음)
- KST 경계: 종료 당일은 진행 중(spec.md:42). 색인 유지는 종료 + 30일까지(spec.md:76, :80), noindex 는 종료 + 31일부터(ADR-0104:31). 세 문장이 서로 맞는다. 상태를 저장하지 않으므로 수집이 밀려도 상태가 틀리지 않는다(ADR-0104:26-28, :46).
- 코스 순서: `subnum` 수 값 오름차순, 매칭되지 않는 지점은 링크 없음(spec.md:50). 원천 `infoRaw` 를 보존하는 파생이라 §0 ② 와 맞는다(`Attraction.kt:57-65`).
- 분류: 유형 코드를 먼저 보는 규칙은 `EV → culture` 폴백(`sync_tour.py:63`)이 문화시설에 섞이는 것을 막는다. `SIGHT_CATEGORIES` 는 그대로 둔다(spec.md:37, `Attraction.kt:91`). `contentTypeId` 가 원천 컬럼으로 남으므로 규칙을 바꿔도 UPDATE 로 다시 계산할 수 있다(§0 ②).
- §0 ①: `searchFestival2`·`searchStay2` 의 행 원문 전체를 TEXT 컬럼에 싣는다(spec.md:24, :32). 숙박의 예약 키는 저장하되 화면에 그리지 않는다(ADR-0104:36-37).

VERDICT: REVISE

## 반영

근거 확인: `sync_tour.py:63`(`AC`→stay, `EV`→culture) · `smoke_test.py:399` · `placeApi.ts:189`(`AMENITY_CATEGORIES` 에 stay) · `AttractionPage.tsx:136` · `sync_tour.py:218-222`(좌표 제외) · `Attraction.kt:33-34,94,191` · `GetAttractionUseCase.kt:21` · `AttractionService.kt:83,91` · `search/glossary.md:80` · `docs/context-map.md:20`.

| 지적 | 반영 위치 | 내용 |
|---|---|---|
| D1 | spec.md:58-59(「숙소」= `category=stay`, 캠핑장 포함, `AC` 규칙 유지) · :110(편의시설 캐로셀의 숙박 몫을 「근처 숙소」로 옮김) · :164(적재 대조는 유형 기준 totalCount 와) | 숙박 원문 키 절·딥링크 제외만 유형 32·80 기준(:59, :99-100) |
| D2 | spec.md:68, :85(`NOT_ENDED` 추가) · :70(`sort=eventStart`) · ADR-0104 결정 2 서술 | ② 이름 분리(`eventWindow`/`eventPeriod`)는 **미반영**: 화면의 상태 칩은 한 번에 하나를 고르는 단일 선택이라 파라미터 하나가 칩과 1:1 이다. 값 다섯의 정의는 spec.md:68-69 표 하나뿐이고, 사전에 「행사 상태」(값 넷)와 「행사 필터」(`eventStatus` 값 다섯)를 따로 등재해 두 뜻이 섞이지 않게 했다(spec.md:149) |
| D3 | spec.md:64-65(E 만 → (E,E) · S>E → 날짜 없음 · 변환 실패 → 수집기 None) · :27-28 · :69(주말 「오늘 포함」) | 각 경우를 T1 픽스처에 넣었다 |
| D4 | spec.md:76(① 유효 종료일 색인) · :68-72(② 상태와 범위 한 객체 + 동치 수용 기준) · :67(③ `UNKNOWN` 은 행사 칩·필터에서 빠짐) | |
| D5 | spec.md:30(§0 ① 명시 예외 + 건수 로그) · :39 · :164(대조식 = totalCount − 좌표 제외) | 좌표 없는 행사를 원문으로 남기는 별도 Q 는 **미반영**: 모델이 좌표 non-null 이라 남기려면 새 표나 모델 변경이 필요하고, 제외 건수를 먼저 재 본다(Q1 에 좌표 제외 건수 포함) |
| D6 | spec.md:47-48(자리 목록 보완) · :49(`AttractionDtoRoundTripTest` 수용 기준) · :50-51(`?:` 로 원천의 날짜 삭제가 반영 안 되는 것은 의도한 예외) | |
| D7 | spec.md:149-150(등재 용어 목록 · `search/glossary.md` §3-1) · :111(「주변 명소」 표기) | context-map 에 place 행을 더하는 것은 **미반영**: 관광지 용어가 이미 `search/glossary.md` §3-1 에 있어 자리가 정해져 있고, 이 스펙이 새 사전을 만들지 않는다 |
