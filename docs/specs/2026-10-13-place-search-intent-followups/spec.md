# Specification: 관광지 검색 해석 후속 — 동반 표현 · 분류 안 0건 · 영문 교정 하한

## Goal
「아이랑 갈 만한 곳」이 「아이」로 시작하는 상호 대신 아이와 함께 가기 좋은 곳을 내고, 「도쿄 수족관」 같은 0건에 이유와 다음 행동을 붙이며,
영문 한 글자 오타를 고쳐 어휘 근거 `GATE` 를 다시 잴 수 있게 한다.

## User Stories
- 아이와 갈 곳을 찾는 사람으로서, 「아이랑 갈 만한 곳」에 어린이공원·체험장이 나오기를 원한다 — 지금은 「아이아이 연남」·「아이와즈」가 위에 온다.
- 해외 지명과 시설을 함께 친 사람으로서, 0건이면 왜 없는지와 「국내 수족관 보기」 같은 다음 행동을 보고 싶다.
- 영문으로 찾는 사람으로서, 「botanical garedn」을 「botanical garden」으로 고쳐 받고 싶다.

## Specific Requirements

### SR-1 동반 표현 (관광지 경로만)
1. `QueryIntent.analyze(attractionOnly = true)` 는 동반 표현을 잔여 검색어·근거 잔여에서 뺀다.
   - 한국어: 머리말(아이·아이들·애·애들·아기·아가·어린이·자녀·유아·키즈·가족) + 조사(랑·이랑·와·과·하고·들과·…·동반) 한 어절,
     또는 머리말 + 다음 어절 「함께·같이·동반·데리고」. 머리말만 있는 「어린이 박물관」·「키즈카페」와 조사가 아닌 꼬리 「아이와즈」는 옮기지 않는다.
   - 영문: 「with kids」·「for kids」·「kid friendly」·「family friendly」 등 두 어절 이하.
2. `Understood.vectorText` = 원문에서 그 어절만 표준 문구(ko 「어린이와 가족이 함께」 · en 「family friendly for kids」)로 바꾼 문장.
   검색 서비스는 벡터 인코딩에 `vectorText ?: 교정된 원문` 을 쓴다.
3. 통합 검색(attractionOnly=false)은 바꾸지 않는다 — 잔여가 다른 타입 검색으로 넘어간다.
4. 근거: 운영 인코더 + 색인 벡터 레그 단독 실측(2026-10-13). 「아이랑 갈 만한 곳」 상위 10 에 상호 「아이아이 연남」·「아이러브팜핑」·「아이와즈」…,
   「어린이와 가족이 함께 가기 좋은 곳」은 안성맞춤가족공원·임내숲 어린이공원·수성패밀리파크·가야랜드….

### SR-2 분류 안 0건 사유 `NO_MATCH_IN_CATEGORY`
1. `Understood.facetPhrase` = 분류·유형 필터로 읽은 원문 어절.
2. 결과 0건이고 어휘 근거 0건(`NO_EVIDENCE`)이 아니며 잔여 검색어와 `facetPhrase` 가 있으면, 같은 조건에서 잔여·벡터·근거 검사만 빼고 한 번 더 센다.
   1건 이상이면 `zeroReason=NO_MATCH_IN_CATEGORY`, `relaxedKeyword` = 해석 조건어 + 분류어, `relaxedTotal` = 그 건수.
3. 허브 0건 화면은 「‘수족관’ 관광지 중에는 나머지 검색어와 겹치는 곳이 없습니다.」와 버튼 「‘수족관’ 결과 20건 보기」를 낸다.
   버튼은 그 검색어로 다시 찾는다(계측 trigger `relax`, changed `keyword`·`page`).
4. 원인 실측: 「수족관」은 분류 코드표 `VE020400`(ko 「수족관 / 아쿠아리움」)으로 읽혀 국내 20곳으로 좁혀지고, 그중 「도쿄」를 가진 곳이 없다.
   「서울 수족관」 2건(코엑스·롯데월드), 붙여 쓴 「도쿄수족관」은 분류로 안 읽혀 3,639건.

### SR-3 영문 교정 하한
1. 제목 자모 사전 제안의 채택 하한: 한글이 섞인 단어 0.85(그대로), 라틴 단어 0.80.
2. 교정은 지금처럼 색인에서 0건인 단어에만 부른다.
3. 근거: 판정 세트 영문 112단어 실측 — 0.80~0.85 에 새로 드는 0건 단어는 garedn→garden(0.833)·chomsongdae→cheomseongdae(0.818) 둘.
   quiet→quilt(0.8)·spots→sports(0.8) 는 원 단어가 이미 51·76건이라 부르지 않는다. egpyt→egret 0.6·louvre→lounge 0.667 은 하한 아래.

### SR-4 다음 단계
배포 뒤 어휘 근거 `GATE` 를 `stage2-gate.md` 와 같은 방법으로 다시 잰다(SR-7.3 조건). 「아이랑」 두 질의 top-5 의 「아이」 상호 0건, 「해수욕장」·「경복궁」 기준 id 4/5 유지를 함께 본다.

## Existing Code to Leverage
- `search/domain/.../query/model/QueryIntent.kt` — 조건어 추출(`extractConditions`)과 같은 모양으로 `extractCompanion`
- `search/app/.../attraction/service/SearchAttractionService.kt` — `resolveEmbedding`, 0건 사유
- `search/app/.../opensearch/AttractionSearchAdapter.kt` — `correct` · `closestTitleSpelling`
- `portal-fe/src/pages/place/PlacePage.tsx` — 0건 화면(`zeroByKeyword`·`correctedLink` 옆)

## Out of Scope
- 아이 친화 분류(체험·동물원·테마파크)·유모차 대여에 가중치를 주는 것 — SR-1 실측 뒤 판정 세트로 필요할 때.
- 해외 지명 사전(「도쿄」를 해외로 알아보기). 지금은 분류 안 0건으로 충분히 설명된다.

## 검증 (2026-10-13 04:19~04:25 KST)
- `./gradlew :search:domain:test --tests '*QueryIntentTest'` → tests=94 failures=0
- `./gradlew :search:app:test --tests '*SearchAttractionServiceTest'` → tests=81 failures=0
- `./gradlew :search:app:test --tests '*AttractionSearchAdapterSpellTest'` → tests=4 failures=0
- `vitest run src/pages/place/__tests__/PlacePage.interpret.test.tsx` → 15 passed · `tsc -b` exit 0 · `searchArchitecture.drift.test.ts` 10 passed
- 회귀 주입(컴파일되는 변경, 원본 복구 확인): 라틴 하한 제거 → Spell 1 실패 · 벡터 문장 미사용 → Service 1 실패 ·
  0건 재계수 끔(`takeIf { false }`) → Service 1 실패 · 동반 추출 끔 → QueryIntent 8 실패 · 화면 버튼 숨김 → interpret 1 실패
