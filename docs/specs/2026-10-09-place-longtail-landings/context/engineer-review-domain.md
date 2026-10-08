# Engineer Review — domain (1라운드)

스펙: `docs/specs/2026-10-09-place-longtail-landings/spec.md`
체크리스트: hns 0.15.1 `reviewers/domain/checklist.md`

## Findings

### D1. 속성 슬러그 넷 중 둘의 정의가 없다 (체크: Ubiquitous language / Invariants)
- 스펙: `attr` 은 `parking`·`pet`·`barrier-free`·`free` (`spec.md:12`), h1 「{시군구} {속성 이름} 관광지」 (`spec.md:14`).
- 코드: 반려동물은 칩이 둘(`petAllowed`·`petPartial`)이고 서버 facet 도 `pet.ALLOWED`·`pet.PARTIAL` 로 갈린다(`placeAttributes.ts:50-51,103-104`, `SearchAttractionUseCase.kt:207`). 무장애는 코드 셋(`WHEELCHAIR`·`ELEVATOR`·`RESTROOM`)이 **AND** 로만 걸리고 「아무거나 하나」 건수는 facet 에 없다(`AttractionSearchController.kt:66-67`, `SearchAttractionUseCase.kt:209-210`).
- 그래서 `pet` 의 N 이 ALLOWED 만인지 합인지, `barrier-free` 의 N 이 어느 코드인지가 미정이고, 집계 문장 「{속성 조건}인 관광지 N곳」이 무엇을 센 수인지 틀릴 수 있다.
- 수정안: SR-1.1 에 표 하나 — 슬러그 → (검색 파라미터, facet 키, 국/영 이름). 예: `parking`→`parking=YES`/`parking.YES`, `pet`→`pet=ALLOWED,PARTIAL`/`pet.ALLOWED+pet.PARTIAL`(이름 「반려동물 동반(일부 구역 포함)」) 또는 ALLOWED 만, `barrier-free`→`barrierFree=WHEELCHAIR`/`barrierFree.WHEELCHAIR`(이름 「휠체어 이용」), `free`→`admission=FREE`. 칩 id 와의 대응도 같은 표에(SR-2 프리셋이 칩 상태로 들어가야 하므로).

### D2. 「관광지」의 범위(분류 필터)가 빠졌다 (체크: Ubiquitous language consistent with codebase)
- 스펙: 후보 집계 질의는 `GET /api/search/attractions?…&facets=true` (`spec.md:13`) — 분류 조건이 없다.
- 코드: 색인되는 지역 페이지는 반드시 관광 분류로 거른다 — "안 걸면 병원·상점이 이 지역 관광지로 색인된다"(`RegionPage.tsx:117-119`). 허브도 분류 미지정 시 `SIGHT_CATEGORIES` 로 건다(`PlacePage.tsx:377-379`).
- 그대로면 「주차 가능 관광지 N곳」에 음식점·쇼핑이 섞이고, SPA(허브 기본 = SIGHT_CATEGORIES)가 보이는 N 과 프리렌더 N 이 갈린다(SR-2.2 「같은 문장」이 깨짐).
- 수정안: SR-1.2 질의에 `category=SIGHT_CATEGORIES.join(',')` 를 명시하고, 프리렌더·SPA·목록 조회가 같은 분류 집합을 쓴다고 적는다.

### D3. place BC 의 glossary 가 없다 (체크: Glossary present)
- `docs/context-map.md:16-38` 에 place BC 가 없고 search 행에도 관광지(Attraction) 계열 용어가 없다(`docs/context-map.md:20`).
- 스펙이 새로 들이는 명사: 랜딩(속성 랜딩), 편집 페이지(guide), 속성(attr), 프리셋.
- 판정 규칙상 REVISE — 스펙 출고 뒤 `/hns:glossary` 로 place(또는 search) glossary 에 넣는다.

### D4. 「landing」 이 두 뜻으로 쓰인다 (체크: Ubiquitous language)
- 기존: SEARCH 계측 trigger `landing` = "직전 조건이 없는 첫 질의"(`PlacePage.tsx:262-265`).
- 스펙: 페이지 종류로서의 「랜딩」(`spec.md:6-17`)과 같은 trigger 값 재사용(`spec.md:20`).
- 첫 질의라는 뜻은 같으므로 값 재사용은 맞다. 다만 계획의 측정(「유효 유입·저장·상세 탐색」 — `work-plan.md:94`)에서 허브 첫 진입과 속성 랜딩 첫 진입을 가를 필드가 스펙에 없다.
- 수정안: 프리셋 첫 SEARCH payload 에 어떤 필드로 랜딩임을 남기는지(예: 기존 `attributes` 필드에 실린 값 + 경로) 한 줄 명시. 페이지 종류는 문서에서 「속성 랜딩」으로 불러 trigger 와 구분.

### D5. 시군구 이름은 시도 없이 유일하지 않다 (체크: Value Object 식별)
- 스펙 h1 「{시군구} {속성 이름} 관광지」(`spec.md:14`). 「중구」「동구」「서구」「남구」「북구」는 여러 시도에 있다.
- 코드 선례: 지역 메타는 `regionDisplayName` 이 이름만 쓴다(`copy.mjs:460-462`) — 지역 페이지는 시군구별 h1 이 겹쳐도 경로가 하나였지만, 랜딩은 title·h1 중복이 바로 「얇은 중복 페이지」 신호가 된다.
- 수정안: 랜딩 h1·title 은 「{시도 약칭} {시군구}」(예: 「부산 중구 주차 가능 관광지」)로 한다. 집계 문장은 이미 `{시도} {시군구}` 라 일관된다.

## 해당 없음
Aggregate·도메인 이벤트·교차 aggregate 참조: 읽기 전용 빌드 산출물이라 해당 없음.

VERDICT: REVISE
