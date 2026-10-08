# Engineer Review — domain (1라운드)

대상: `docs/specs/2026-10-09-place-detail-first-screen/spec.md`
근거 문서: `search/glossary.md`, `docs/context-map.md`, `place/CLAUDE.md`, `docs/architecture/data-sources.md`, 코드(워크트리 기준)

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 | 대체로 지킴(search 는 place API 로만 읽음). 단 요금 접기 규칙의 소유가 흔들림 → D1 |
| 2 | glossary 존재 | 있음 — `docs/context-map.md:20` → `search/glossary.md` (place 는 glossary 없음, `place/CLAUDE.md` 가 대신) |
| 3 | 용어 일치 | 신조어 다수 미등록, 기존 용어 개명 → D2·D3 |
| 4 | `Avoid:` 동의어 사용 | 없음 — 「프리렌더」(`search/glossary.md:79`)·「근처/주변 관광지」(`:81`) 미사용 |
| 5 | 코드와 언어 일관성 | 필드명 불일치·적용 규칙 오인용 → D4 |
| 6 | 불변식 명시 | 「정보 없음을 불가로 바꾸지 않는다」(spec SR-2.1, `spec.md:22`)가 `search/glossary.md:75` UNKNOWN 규칙과 일치. 출처 표시 의무 불변식이 흔들림 → D5 |
| 7 | 이벤트 범위 | 해당 없음(도메인 이벤트 없음) |
| 8 | 교차 집계 직접 참조 | 없음 — `source`·`copyrightDivCd` 는 place 응답 필드로 전달 |
| 9 | VO/Entity 분류 | 해당 없음 |

## Findings (REVISE)

### D1 [#1·#5] 요금 「반복정보 폴백」 규칙이 search 안에서 세 벌로, 소유가 place 에서 search 로 넘어간다
- 스펙: SR-2.2(`spec.md:23`) 표시용 폴백, SR-2.3(`spec.md:24`) 파서 입력 확장 — 같은 규칙(이름이 「입장료」「관람료」「이용요금」인 `infoRaw` 행)을 FE 표시·SSR 표시·파서가 각각 쓴다.
- 코드: `AttractionAttributeParser.kt:6-8` — 「요금·주차·휴무를 여기서 다시 찾으면 place 의 접기 규칙과 두 벌이 된다」. 요금 접기는 place 가 `use_fee` 파생 컬럼으로 갖는다(`place/CLAUDE.md:147-150`, `data-sources.md:31-36` §0 ②).
- 수정안 (하나를 골라 스펙에 적는다):
  (a) 재색인 때 search:domain 순수 함수 하나(예: `AttractionFee.resolve(useFee, infoRaw)`)가 요금 원문을 한 번 정하고, 파서 입력과 색인 문서 필드(표시용 요금 텍스트)에 같은 값을 싣는다. SSR·FE 는 그 필드만 읽는다. 파서 KDoc `:6-8` 은 「요금은 place 컬럼 + 반복정보 폴백, 규칙은 X 한 곳」으로 고친다.
  (b) place 에 파생 컬럼을 둔다(§0 ②의 정석). 마이그레이션·수집기 변경이 붙으므로 범위가 커진다.
  어느 쪽이든 「규칙 원본 한 곳」을 스펙에 적는다.

### D2 [#3] 신조어 glossary 미등록
- `방문 요약`(SR-2), `확인 상태`(SR-2.5), `행동 줄`(SR-2.6), `사실 표`(SR-3.1), `집계 문장`(SR-3.3), `고유 블록`(SR-3 제목), `이웃 링크`(SR-3.2) — `search/glossary.md` 3-1절(`:71-91`)에 없음.
- 특히 `방문 요약`은 기존 `방문 정보 요약`(배지 절 — `AttractionPageRenderer.kt:474`, `AttractionPage.tsx:78`)·`이용 안내`(`AttractionPageRenderer.kt:459`)·FE 탭 `At a glance`(`AttractionInfoTabs.tsx:20`)와 관계가 스펙에 없다. 새 절이 배지·이용 안내를 **대체**하는지 **병존**하는지 SR-2.1 에 한 줄로 적는다(병존이면 같은 사실이 두 번 나간다).
- 수정안: 구현 뒤 `/hns:glossary --conflict 방문 요약` 등으로 3-1절에 등록.

### D3 [#3·#5] 「가까운 같은 종류」는 기존 용어 「같은 분류 가까운 곳」의 개명이고, FE 와도 어긋난다
- 스펙: SR-3.2(`spec.md:31`) 독립 절 「가까운 같은 종류」, 같은 대상을 「이웃」으로도 부름.
- 기존: SSR 제목 「같은 분류 가까운 곳」(`AttractionPageRenderer.kt:557`), glossary 「주변 명소」 정의가 이 이름으로 구분(`search/glossary.md:81`), FE 는 절 없이 「주변 탐색」에 합침(`AttractionPage.test.tsx:140,147`, `AttractionPage.tsx:508`).
- SR-1.3(`spec.md:19`)·SR-3.1(`spec.md:30`)은 「FE 와 같은 순서·같은 문구」를 요구하는데 SR-3.2 는 FE 에 없는 절을 SSR 에만 만든다.
- 수정안: 이름은 기존 「같은 분류 가까운 곳」을 유지하고, 「SSR 전용 절(FE 는 주변 탐색에 합쳐 둠) — 패리티 예외」라고 SR-1.3 에 명시. 0건 판정은 지금처럼 끝난 행사를 거른 뒤(`AttractionPageRenderer.kt:552`)임을 적는다.

### D4 [#5] 필드명·적용 규칙 오인용
- SR-2.5(`spec.md:26`) `modifiedAt` 은 색인 쪽 이름이고 원천은 place `sourceModifiedAt`(`AttractionDtos.kt:187` → `AttractionApiReindexTasklet.kt:309`). 의미(원천 갱신일)는 맞으니 「`modifiedAt`(= place `sourceModifiedAt`)」으로 적어 둔다.
- SR-2.3(`spec.md:24`) `attrAdmission` 은 색인 필드, 도메인 이름은 `freeAdmission`(`AttractionAttributeParser.kt:34`, glossary 「무료 입장」 `search/glossary.md:75`). 도메인 쪽 이름으로 쓴다.
- SR-4.1·4.2(`spec.md:38-39`): place 응답은 이미 `source`·`copyrightDivCd` 를 낸다(`AttractionDtos.kt:140,159`) — place 배포 단계가 필요 없다. 실제로 고칠 자리는 search:batch `PlaceApiClient.AttractionDto`(`PlaceApiClient.kt:35-79`, 두 필드 없음)와 손 매핑(`:32-34` 「추가하지 않으면 null 이 조용히 이긴다」). 외부 데이터 3규칙 ③(`data-sources.md:42-60`)은 place 왕복 경로 규칙이라 이번엔 해당 없다 — 대신 `PlaceApiClient` 매핑 누락을 단위 테스트로 막는다고 적는다.
- SR-3.3(`spec.md:32`) 「분류」는 `categoryName`(lclsSystm3 이름, `RegionAggregator.kt:33`)이고, glossary 「분류 가중치」의 「파생 분류 `category`」(`search/glossary.md:113`)와 다른 축이다. 「{분류}=원천 소분류 이름」으로 한정한다. 또 이미 같은 집계 문장(「{시군구} {유형} N곳 중 {분류} M곳」, `AttractionPageRenderer.kt:535-543`)이 있으므로 대체인지 추가인지 적는다.

### D5 [#6] 출처 표시 줄을 `source` 값으로 바꾸면 출처 의무 문구가 흔들린다
- 스펙: SR-2.5(`spec.md:26`) 「지금 고정 문구 SSR `:739`·FE `placeAttributes.ts:187` 를 이 값으로」.
- 코드: 그 문구는 출처 줄의 **첫 항목**이고 뒤에 무장애·웰니스·고캠핑·빅데이터 원천을 잇는다(`AttractionPageRenderer.kt:610-619`, `placeAttributes.ts:187-197`). TourAPI 는 출처표시 의무가 있다(`data-sources.md:99`).
- `source=GOCAMPING` 문서에 `camping` 원문이 있으면 「고캠핑」이 두 번 나간다(`AttractionPageRenderer.kt:615`). 또 `source` 는 코드값(`Attraction.kt:17`, TOURAPI/GOCAMPING)이라 국·영 표시 이름 표가 필요하다.
- 수정안: 「확인 상태」 칸(방문 요약 안)과 바닥 출처 줄을 분리해 적는다. 바닥 출처 줄은 유지하고 첫 항목만 `source` 에 따라 고르되 중복 원천은 한 번만 낸다. `source` → 표시 이름 대응 표(국·영)를 SR-2.5 에 둔다. 폴백(필드 없음 = TourAPI 문구)은 SR-4.2 그대로.

## 요약
BLOCK 사유 없음(`Avoid:` 사용 없음, glossary 와 다른 뜻으로 쓴 용어 없음). 규칙 소유(D1)와 출처 줄(D5)은 구현 전에 스펙에 한 줄씩 정하면 된다.

VERDICT: REVISE
