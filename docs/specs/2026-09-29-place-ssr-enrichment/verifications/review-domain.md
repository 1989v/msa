# 도메인 리뷰 — place 관광지 서버 렌더 + 인리치먼트·패싯

- 대상: `spec.md` · `planning/requirements.md` · `context/open-questions.yml` · `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md`
- 차원: domain (속성 의미 · TourAPI 필드 의미 · 지역/분류 집계 · 인기도 명명 · 용어 일관성)
- 판정: **REVISE** — 차단 이슈 없음, 비차단 12건

## Seed Discovery

1. 스펙 — spec.md SR-1~7, requirements.md R2 표, open-questions Q1~Q3, ADR-0103 결정 1~6
2. 같은 폴더 — `planning/initialization.md`(실측: 국문 2,000건 필드 보유율 L25 · 사람 이벤트 7일 92건 L28)
3. 문서 — `docs/context-map.md`, `search/glossary.md`, `place/CLAUDE.md`, `docs/adr/ADR-0095-impression-click-pipeline.md`
4. 코드 — `search/domain/.../AttractionDocument.kt`, `AttractionPopularity.kt`, `attractions-index.json`, `AttractionSearchAdapter.kt`,
   `analytics/.../ClickHouseAttractionPopularityAdapter.kt`, `V006__attraction_popularity_daily.sql`, `place/ingest/src/{backfill_intro,sync_pet_tour}.py`,
   `V12__create_attraction_embedding.sql`, `portal-fe/src/pages/place/placeView.ts`

## 체크리스트

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | BC 경계 · 누수 없음 | 통과(조건부) | analytics→search 는 내부 API(ADR-0103:32), search→place 는 기존 API 경로. 단 SR-5 적재 위치가 스펙 안에서 모순 — D11 |
| 2 | 용어집 존재 | REVISE | `docs/context-map.md:16-38` 표에 place BC 행이 없다. `search/glossary.md` 는 ProductDocument·Bandit 만 있고 관광지 문서 항목이 없다 — D12 |
| 3 | 스펙 어휘가 용어집에 있음 | REVISE | 새 용어(파생 속성 · 방문 신호 · 패싯 · 파서 버전 · 지역 안 위치 · 비슷한 곳) 미등재 — D12 |
| 4 | `Avoid:` 동의어 미사용 | 통과 | `search/glossary.md:25` 의 Avoid(Product, ProductIndex)는 스펙에 없다 |
| 5 | 스펙 ↔ 코드 용어 일관 | REVISE | popularity 3중 의미(D1) · 유모차(D3) · 시군구 축(D9) · 「관광지」(D10) · 모델 이름(D11) |
| 6 | 불변식 명시·강제 가능 | REVISE | `UNKNOWN` 불변식은 있으나(spec.md:29) 저장·필터 규칙이 없고(D8), 휴무 해석 규칙이 없다(D7) |
| 7 | 도메인 이벤트 범위 | 해당 없음 | 새 이벤트 없음. 기존 원장(ADR-0095)을 읽기만 한다 |
| 8 | 집합체 간 직접 참조 없음 | 통과 | 가까운 곳·비슷한 곳은 id·제목·거리 사본(spec.md:43, 48). 매일 전량 재색인이라 사본 부패 창이 하루로 묶인다 |
| 9 | VO / Entity 분류 | 통과 | 파생 속성·집계는 문서의 값 객체. 식별자를 새로 만들지 않는다 |

## Findings

### D1. 「인기도」가 코드에서 이미 두 뜻이고, 스펙이 세 번째를 같은 이름으로 얹는다 (체크 5)
- 스펙: SR-6 제목 「인기도 (D)」(spec.md:53), `popularityScore` 는 「이름·의미·사용처가 그대로」(spec.md:56, requirements.md:57-58).
- 코드: 관광지 `popularityScore` 는 **완결성**이다(`AttractionPopularity.kt:10-18`, `AttractionDocument.kt:62-67`).
  같은 이름이 상품 쪽에선 **analytics 가 주입한 이용 점수**다(`search/glossary.md:22`).
  analytics 표 이름은 `attraction_popularity_daily`(`V006__attraction_popularity_daily.sql:9`)이고 내용은 노출·클릭이다.
- 또 `AttractionDocument.kt:65` KDoc 은 「방문자 지표가 생기면 이 자리를 그 값으로 바꾼다」고 적혀 있어 SR-6 결정과 반대다.
- 수정안:
  1. 새 문서 필드는 `popularity` 를 쓰지 말고 재는 것의 이름으로 짓는다(예: `clicks14d`, 배율은 `visitBoost`). 스펙 SR-6 에 필드명을 박는다.
  2. `AttractionDocument.kt:62-66` KDoc 을 「완결성 신호. 방문 신호는 별도 필드」로 고치는 일을 태스크에 넣는다.
  3. 용어집에 「관광지 `popularityScore` = 완결성, 상품 `popularityScore` 와 다르다」를 한 줄 남긴다(D12).

### D2. 방문 신호의 원천이 「조회」가 아니라 노출·클릭이고, 노출은 순위가 만든 값이다 (체크 5·6)
- 스펙: 「최근 14일 관광지별 조회·클릭 합」(spec.md:54), 사용자 이야기 「실제로 많이 본 곳」(spec.md:11), 상세 「많이 본 곳」(spec.md:58).
- 코드: 원장 동작은 `IMPRESSION · CLICK` 둘뿐이다(ADR-0095:51). 집계 표도 `impressions`·`clicks` 만 갖는다
  (`ClickHouseAttractionPopularityAdapter.kt:44-53`). 「조회」(상세 페이지 방문)는 원장에 없다.
- 노출 수는 검색 순위와 섹션 배치가 결정한다. 노출을 순위 계수에 넣으면 위에 있던 문서가 계속 위에 남는 되먹임이 생긴다.
  또 서버 렌더 뒤 주 유입이 될 외부 검색 착지는 원장 이벤트가 아니다.
- 표본 규모: 사람 이벤트 7일 92건(initialization.md:28). Q2 기본값 「14일 조회 20 미만이면 1.0」(open-questions.yml:11)이면 사실상 모든 문서가 1.0 이다.
- 수정안: 신호를 **클릭**(또는 사전분포를 둔 CTR)으로 정의하고 노출은 분모로만 쓴다고 SR-6 에 적는다.
  상세 표시 문구도 「많이 본 곳」 대신 신호와 맞는 말(「많이 찾은 곳」 등)로 바꾼다.
  조인 키는 `attraction_popularity_daily.attraction_id` = 문서 `id`(언어별 행)라고 명시한다. 현재 표본으로는 계수가 거의 켜지지 않는다는 것도 기록한다.

### D3. `chkbabycarriage` 는 「유모차 동반」이 아니라 「유모차 대여」다 (체크 5)
- 스펙: 속성 「유모차」, 값 「가능 / 불가」(spec.md:28, requirements.md:30).
- 코드: 기존 화면은 이 키를 「유모차 대여 / Stroller rental」로 표시한다(`placeView.ts:137`, 테스트 `placeView.test.ts:193-194`).
- 이대로면 「유모차 불가」 칩이 「유모차를 들일 수 없다」로 읽히는데, 원문 뜻은 「대여를 안 한다」다.
- 수정안: 속성명을 「유모차 대여」로 바꾸고 칩·배지·JSON-LD 설명도 맞춘다. 음식점(39)에는 이 키가 없다는 것도 적는다.

### D4. 반려동물 원천은 `chkpet` 이 아니라 `petAcmpyType` 하나이고, 영문은 원천이 없다 (체크 5·6)
- 스펙: 원천 「petAcmpyType · introRaw chkpet*」(requirements.md:28).
- 코드: `chkpet` 은 국문 44,924건 중 3건이다(`place/CLAUDE.md:62`, `sync_pet_tour.py:3-5`).
  영문 서비스에는 `detailPetTour2` 가 없다(`sync_pet_tour.py:62-65`). 그래서 영문 문서는 전량 `UNKNOWN` 이 된다.
- 또 `petAcmpyType` 은 이미 keyword 필터 축으로 색인돼 있다(`AttractionDocument.kt:37-38`, `attractions-index.json:166-168`). 정규화 속성이 생기면 같은 사실이 두 필드에 있게 된다.
- `detailPetTour2` 는 등록된 곳만 주는 목록이라 목록에 없음 = `UNKNOWN` 이다(불가 아님). 스펙 규칙(spec.md:29)과는 맞지만 명시가 필요하다.
- 수정안: 원천을 `petAcmpyType` 으로 한정한다. `전구역 동반가능 → 가능 · 일부구역 → 일부 · 동반불가 → 불가`, 그 외·null → `UNKNOWN` 매핑을 SR-2 에 표로 둔다.
  기존 `petAcmpyType` keyword 를 필터 축에서 내릴지 둘 다 둘지 정한다. 영문은 같은 `contentId` 의 국문 값을 빌릴지, `UNKNOWN` 으로 둘지 정해 적는다.
  보유율 22%(spec.md:32)는 국문 표본 값(initialization.md:25)이라고 밝힌다.

### D5. 입장 무료는 유형에 따라 원천 키가 아예 없다 (체크 5)
- 스펙: 원천 「useFee · introRaw usefee*」(requirements.md:31).
- 코드: 관광지(12)·레포츠(28)에는 `usefee` 가 없다(`place/CLAUDE.md:125-126`). `useFee` 파생 컬럼은 축제의 `usetimefestival`(이용요금)도 합친다(`backfill_intro.py:29`).
- 수정안: 「유형 12·28 은 이 속성이 구조적으로 `UNKNOWN`」이라고 SR-2 에 적는다. 그래야 4.7% 가 파서 결함으로 읽히지 않는다.
  `infoRaw`(detailInfo2, 보유 49.8% — initialization.md:25)의 입장료 행을 원천으로 쓸지, 범위 밖으로 둘지 결정해 적는다.

### D6. 유형별 키 매핑이 이미 두 곳에 있다 — 세 번째 사본을 만들지 않는다 (체크 5)
- 코드: 파이썬이 유형별 키를 `useTime·restDate·useFee·parking` 컬럼으로 접는다(`backfill_intro.py:25-32`).
  프런트는 `chk*` 접미사를 벗겨 개념 키로 만든다(`placeView.ts:104-110`).
- 스펙은 원천을 `introRaw chk*` 처럼 와일드카드로만 적는다(requirements.md:28-31). 12/14/28/38/39 별 실제 키(`chkcreditcardfood`, `chkbabycarriageshopping` 등)와 유형별 부재가 스펙에 없다.
- 수정안: 운영·휴무·주차·요금은 **이미 접힌 place 컬럼**(`useTime`·`restDate`·`parking`·`useFee`)을 읽는다고 적는다.
  `chk*` 만 `introRaw` 에서 읽는다. 유형 × 키 표를 스펙 한 곳에 두고, 규칙은 `placeView.ts` 의 접미사 목록과 같다고 적는다.

### D7. 「오늘 여는 곳」과 「휴무 요일 집합」 사이의 해석 규칙이 없다 (체크 6)
- 스펙: 사용자 이야기 「오늘 여는 곳」(spec.md:9), 값은 「연중무휴 여부 · 휴무 요일 집합」(spec.md:28).
- 원문 `restDate` 에는 「매월 첫째 주 월요일」, 「공휴일 다음날」, 「동절기 월요일」, 「설·추석 당일」 같은 조건부 휴무가 섞인다.
  이것을 요일 집합으로 접으면 매주 닫는 곳처럼 보이거나(과대), 버리면 매일 여는 곳처럼 보인다(과소). 어느 쪽이든 `UNKNOWN` 을 사실로 바꾸는 것과 같다.
- 수정안: 「모든 절이 무조건 매주 반복일 때만 요일 집합, 조건부 절이 하나라도 있으면 휴무는 `UNKNOWN`(또는 `IRREGULAR` 값)」이라고 적는다.
  「연중무휴」와 명절 휴무가 같이 있으면 연중무휴가 아니다. 「오늘」은 요청 시점의 KST 요일로 계산한다.
  칩 이름은 「오늘 정기휴무 아님」처럼 실제로 아는 것만 말하게 한다. 영업시간은 모른다.

### D8. `UNKNOWN` 의 저장·필터·집계 규칙이 없다 (체크 6)
- 스펙: 「`UNKNOWN` 을 불가로 바꾸지 않는다」(spec.md:29), 필터·패싯(spec.md:35-36).
- 필드가 없는 것으로 저장하면 `must_not: 불가` 형태 질의가 `UNKNOWN` 을 「불가 아님」으로 섞어 넣는다. 불변식이 저장 방식에 따라 깨진다.
- 수정안: SR-2 또는 SR-7 에 다음을 적는다.
  - 속성은 keyword 로 **명시값 `UNKNOWN`** 을 저장한다(필드 누락 금지).
  - 필터는 양의 term(`가능`, `일부`)만 받고 부정형 필터를 두지 않는다.
  - 패싯 응답에 `UNKNOWN` 버킷을 낼지 정한다.
  - 파서 버전 필드 이름을 정한다.

### D9. 「시군구」가 어느 코드 축인지 적혀 있지 않다 (체크 5)
- 스펙: 「시군구별 전체 수와 시군구·분류별 수」(spec.md:42), 「같은 언어·다른 시도」(spec.md:48).
- 코드: 문서에는 `sigunguCode` 와 `ldongSignguCd` 가 둘 다 있다. 앞의 것은 두 코드 체계가 섞여 **축으로 쓰지 않는다**(`AttractionDocument.kt:21-24`, `place/CLAUDE.md:64-65`).
  검색 파라미터 이름은 `sigunguCode` 인데 실제로는 `ldongSignguCd` 에 건다(`AttractionSearchAdapter.kt:277-283`). 이름이 이미 한 번 어긋나 있다.
- 수정안: SR-4 는 `ldongSignguCd`(시도 접두 포함 코드), SR-5 의 「시도」는 `ldongRegnCd` 라고 박는다.
  집계는 언어별(`lang`)로 따로 센다. 국문·영문은 별도 문서다(`AttractionDocument.kt:6-7`).
  `ldongSignguCd`·`lclsSystm3` 가 null 인 문서는 해당 블록을 그리지 않는다고 적는다.

### D10. 「관광지 N곳」의 모집단과 표시 이름의 출처가 없다 (체크 5, SR-1 규칙과의 관계)
- 스펙: 「{시군구} 관광지 N곳 중 {분류} M곳」(spec.md:44).
- 코드: 문서 모집단은 음식점·쇼핑 등 전 유형이다. 도메인에서 「관광지」는 `contentTypeId=12` 를 가리키기도 한다(`AttractionDocument.kt:35` — 「12 가 곧 관광지다」).
  분류 이름은 place `attraction_category_codes` 에 있다(`AttractionDocument.kt:27-31`, `place/CLAUDE.md:58-61`). 문서에는 `sidoName` 만 있고 시군구 이름이 없다(`AttractionDocument.kt:57-58`).
- SR-1 은 요청 경로에 다른 서비스 호출을 금지한다(spec.md:19). 그러면 이름은 재색인 때 문서에 실려야 하는데, 스펙에 그 필드가 없다.
- 수정안: N 의 모집단(전 유형 또는 12 만)을 정하고 문구를 그에 맞춘다(예: 「{시군구}의 장소 N곳」).
  `sigunguName`·`lclsSystm3Name`(ko/en)을 재색인 합류로 싣는다고 SR-4 에 적고, SR-7 의 새 필드 목록에 넣는다.

### D11. SR-5 적재가 「place 스키마 변경 없음」과 모순되고, 모델 식별자 용어가 기존과 다르다 (체크 1·5)
- 스펙: 「결과는 임베딩과 같은 경로로 place 에 적재」(spec.md:49), 범위 밖 「place 스키마 변경」(spec.md:77). ADR-0103:27-29 도 「place 스키마를 바꾸지 않는다」.
- 코드: `attraction_embedding` 에는 유사 목록을 담을 자리가 없다(`V12__create_attraction_embedding.sql:6-21`). 적재하려면 새 표나 컬럼이 필요하다.
- 스펙은 「모델 이름을 함께 저장」(spec.md:50)이라고 쓰지만 기존 용어는 `model_ref`(`hf_id@rev#d{dim}`, V12:10)이고 색인 필드는 `embeddingModel`(`attractions-index.json:254-256`)이다.
- 수정안: 범위 밖 문구를 「SR-2·SR-4 파생 속성을 위한 place 스키마 변경」으로 좁힌다. SR-5 에 새 표(예: `attraction_similar(attraction_id, model_ref, …)`)를 명시한다.
  ADR-0103 결정 5 에 「이 표 하나는 추가한다」를 적는다. 모델 식별자는 `model_ref` 로 통일한다.

### D12. place BC 용어집이 없고, 스펙이 새 용어를 만든다 (체크 2·3)
- `docs/context-map.md:16-38` 에 place 행이 없다. `search/glossary.md` 에 관광지 문서 항목이 없다(§2 는 ProductDocument·BanditState 뿐, L16-36).
- 스펙이 새로 쓰는 명사: 파생 속성, `UNKNOWN`, 파서 버전, 패싯, 지역 안 위치, 비슷한 곳, 방문 신호(계수).
- 수정안: 스펙 통과 뒤 `/hns:glossary` 로 place BC 행과 `place/glossary.md` 를 만든다. `search/glossary.md` 에 AttractionDocument 와 위 용어를 등재한다.
  D1 의 `popularityScore` 이중 의미는 Shared Terms 에 둔다.

## 요약

| # | 이슈 | 심각도 |
|---|---|---|
| D1 | popularity 3중 의미 · KDoc 이 SR-6 과 반대 | 중 |
| D2 | 방문 신호 = 노출+클릭 (조회 없음, 노출 되먹임) | 중 |
| D3 | chkbabycarriage = 유모차 대여 | 중 |
| D4 | 반려동물 원천 = petAcmpyType 하나, 영문 원천 없음, 기존 keyword 와 중복 | 중 |
| D5 | 12·28 은 요금 키 부재 | 하 |
| D6 | 유형별 키 매핑 세 번째 사본 위험 | 하 |
| D7 | 조건부 휴무 해석 규칙 부재 | 중 |
| D8 | UNKNOWN 저장·필터 규칙 부재 | 중 |
| D9 | 시군구 축 미지정 (sigunguCode vs ldongSignguCd) | 중 |
| D10 | 「관광지 N곳」 모집단 · 이름 필드 부재 | 중 |
| D11 | SR-5 place 표 추가 ↔ 범위 밖 문구 모순 · model_ref | 하 |
| D12 | place 용어집 부재 · 신조어 | 하 |

VERDICT: REVISE

## Round 2

대상: 개정된 `spec.md`, `ADR-0103`. 줄 번호는 개정본 기준이다.

### Round 1 항목 판정

| # | 판정 | 근거 |
|---|---|---|
| D1 | RESOLVED | 새 필드 이름은 `uniqueClickers14d`·`clickBoost`(spec.md:65-66)다. `popularityScore` 는 「정보 충실도 — 이름·의미·사용처 불변」(spec.md:15, ADR-0103:41)이다. KDoc 수정은 SR-6(spec.md:69)에 들어갔다. 용어집 줄은 D12 로 넘긴다 |
| D2 | RESOLVED | 신호는 클릭이다. 노출은 「순위의 결과라 쓰지 않는다」(spec.md:64, ADR-0103:39). 문구는 「많이 클릭한 곳」(spec.md:69)이고, 계수가 대부분 1.0 이라는 점도 적혀 있다(spec.md:68). 조인 키는 명시되지 않았지만 구현에서 정해도 되는 수준이다 |
| D3 | RESOLVED | 「유모차 대여」(spec.md:32-33) |
| D4 | PARTIAL | 원천은 `petAcmpyType` 하나로 줄었고, 두 번째 필드는 만들지 않으며, 영문은 `UNKNOWN` 이다(spec.md:35). 원문값을 긍정·일부·부정·`UNKNOWN` 으로 옮기는 표는 아직 없다. 기존 축은 원문 문자열을 keyword 로 두고, 값이 없으면 필드도 없다(`AttractionDocument.kt:37-38`). 그래서 spec.md:34 의 「`UNKNOWN` 명시 저장」, spec.md:43 의 「긍정 값만 필터」와 맞지 않는다 — R2-3 |
| D5 | RESOLVED | 12·28 은 구조적으로 `UNKNOWN`(spec.md:36). `infoRaw` 는 원천에서 빠졌다(spec.md:32) |
| D6 | RESOLVED | 접힌 컬럼 4개와 `petAcmpyType` 을 쓰고, 「유형별 키 매핑을 새로 만들지 않는다」(spec.md:32, ADR-0103:33-34) |
| D7 | RESOLVED | 조건부 휴무는 `UNKNOWN`(spec.md:34). 판정은 KST 요일로 하고 `UNKNOWN` 은 뺀다(spec.md:44). 칩 이름은 「오늘 정기휴무 아님」(spec.md:9) |
| D8 | PARTIAL | 명시값 저장(spec.md:34)과 긍정 값만 받는 필터(spec.md:43)는 해결됐다. 패싯 건수에 `UNKNOWN` 버킷을 내는지와 파서 버전 필드 이름(spec.md:37)은 아직 없다. 하 |
| D9 | PARTIAL | `ldongSignguCd`(spec.md:52), `ldongRegnCd`(spec.md:58), 언어별 집계(spec.md:52)가 명시됐다. 두 코드가 null 인 문서에서 블록을 어떻게 할지는 아직 없다. 하 |
| D10 | RESOLVED | 모집단을 「{시군구} {유형 이름} N곳」으로 고정했고, 시군구 이름과 분류 이름은 문서에 싣는다(spec.md:53-54). 다만 N 과 M 의 포함 관계가 새로 어긋난다 — R2-2 |
| D11 | RESOLVED | `attraction_similar`·V22·`model_ref`(spec.md:59). 범위 밖 문구를 「기존 컬럼 변경」으로 좁혔다(spec.md:94). ADR 결정 5(ADR-0103:35-36), 결과(ADR-0103:56)에도 반영됐다. V22 는 다음 번호가 맞다(최신 `V21__add_attraction_setting.sql`) |
| D12 | OPEN | SR-7 문서 목록(spec.md:76)에 용어집 등재가 없다. 새 용어도 늘었다(속성 패싯·`uniqueClickers14d`·`clickBoost`). 하 |

### 새 이슈

#### R2-1. `uniqueClickers14d` 는 이름과 달리 「14일 고유 방문자」가 아니다 (체크 5) — 중
- 스펙 정의는 이렇다: 「관광지·일자별 고유 클릭 방문자 수」를 일 집계 표에 더하고, 「최근 14일 합」을 `uniqueClickers14d` 로 싣는다(spec.md:64-65).
- 일별 고유 수를 더하면 **방문자·일 수**가 된다. 한 방문자가 14일 동안 매일 누르면 14로 센다. 익명 키는 `visitor_id` 다(ADR-0095:152).
  「원시 건수는 부풀릴 수 있어 고유 수를 쓴다」(ADR-0103:39)는 근거가 하루 단위에서만 성립한다. 같은 방문자가 여러 날 누르면 값을 부풀릴 수 있다.
- 수정안(택1)
  - (a) 이름을 재는 것에 맞춘다: `clickerDays14d`, 또는 「14일 방문자·일 수」.
  - (b) 14일 고유 수를 쓴다: 일 행에 `uniqState(visitor_id)` 를 두고, 읽을 때 `uniqMerge` 로 14일을 합친다.
  - 어느 쪽이든 ADR-0103 결정 6 의 조작 내성 문장을 그에 맞게 고친다.

#### R2-2. 「N곳 중 M곳」에서 M 이 N 의 부분집합이 아닐 수 있다 (체크 6) — 중
- 스펙: N = 같은 시군구·같은 **유형**, M = 같은 시군구·같은 **lclsSystm3**. 문구는 「{시군구} {유형 이름} N곳 중 {분류 이름} M곳」이다(spec.md:53-54).
- 신 분류 체계는 유형(`contentTypeId`)과 따로 움직인다. 예를 들어 캠핑장은 신 체계에서 `AC`(숙박)으로 간다(`place/CLAUDE.md:55-56`). 그러면 M 의 모집단에는 다른 유형 문서가 섞이고, M > N 이 될 수 있다.
- 수정안: M 을 「같은 시군구·같은 유형·같은 lclsSystm3」로 센다. 가까운 곳 5곳에도 같은 조건을 쓴다(spec.md:53 「같은 분류」). 불변식 `M ≤ N` 을 집계기 테스트에 넣는다.

#### R2-3. 반려동물 축의 값 모델이 SR-2·SR-3 규칙과 맞지 않는다 (체크 6) — 하
- D4 PARTIAL 의 구체 내용이다. spec.md:35 는 「기존 `petAcmpyType` 축을 그대로」 쓴다고 한다. 그런데 기존 값은 원문 문자열이거나 필드 없음이다.
- 이 상태에서는 spec.md:34 의 명시 `UNKNOWN` 과 spec.md:43 의 긍정 값 필터가 반려동물에만 적용되지 않는다.
- 수정안: SR-2 에 「원문 → 가능/일부/불가/`UNKNOWN`」 대응 표를 둔다. 기존 필드를 정규화 값으로 바꾸는지, 아니면 원문 필드는 두고 필터만 정규화 대응으로 거는지 한 줄로 정한다.
  첫째 방식이면 기존 필터 파라미터 값이 바뀐다. 이는 spec.md:47 의 「속성 파라미터가 없는 요청은 지금과 같다」와는 별개 문제이므로 호환 여부를 적는다.

### 요약

- Round 1: RESOLVED 8 · PARTIAL 3(D4·D8·D9) · OPEN 1(D12)
- 새 이슈 3건(R2-1 중 · R2-2 중 · R2-3 하). 차단 이슈는 없다.

VERDICT: REVISE
