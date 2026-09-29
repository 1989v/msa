# Specification: place 관광지 서버 렌더 + 도큐먼트 인리치먼트·속성 패싯

## Goal
관광지 상세 55,524개 전부가 크롤러 첫 응답에 본문을 갖게 하고, TourAPI 원문에서 뽑은 속성·지역 집계·유사도·클릭 신호로
검색 필터와 상세 페이지에 원문 이상의 정보를 더한다.

## User Stories
- 검색 엔진으로서, 관광지 상세를 JS 실행 없이 읽어 각 페이지를 서로 다른 본문으로 색인하고 싶다.
- 여행자로서, 「오늘 정기휴무 아님」「주차 가능」「반려동물 동반」 같은 조건으로 거르고 조건별 건수를 보고 싶다.
- 여행자로서, 상세에서 그 지역 안의 위치, 같은 종류의 가까운 곳, 다른 지역의 비슷한 곳을 보고 싶다.
- 운영자로서, 실제로 많이 클릭된 곳이 조금 위에 오되 표본이 적거나 조작된 신호로 순위가 흔들리지 않기를 바란다.

## 유지 (사용자: 「이미 있는 건 두고」)
주변 관광지 섹션(반경 5km 거리순) · 편의시설 섹션 · 링크 섹션 · 기존 방문 정보 원문 표 · 노출 기록 섹션 식별자 ·
노출·클릭 원장과 일 집계 배치 · 임베딩 적재 계약 · 하이브리드 검색 · `popularityScore`(정보 충실도 — 이름·의미·사용처 불변).

## Specific Requirements

### SR-1 관광지 상세 서버 렌더
- place 호스트 `/attractions/{id}` · `/en/attractions/{id}` 는 portal-fe nginx 가 search:app 의 **`/internal/render/attractions/{id}`** 로 프록시한다.
  `/internal/**` 은 공개 게이트웨이 라우트(`/api/search/**` 포함) 어디에도 속하지 않는다 — Cloudflare 를 거치지 않는 호스트로 닿지 않게.
- nginx 는 숫자 id(1~12자리)만 받는 location 을 따로 둔다(기존 `attractions|regions` location 에서 관광지를 떼어 낸다). 숫자가 아닌 id 는 404. upstream URL 은 캡처한 값으로만 만들고 Cookie·Authorization 은 넘기지 않는다.
- 시간 초과는 층을 둔다: nginx 연결 0.5초 · 읽기 3초, search 의 셸 받기 1초. search 응답이 404 면 그대로, 시간 초과·5xx·연결 실패만 SPA 셸 200 으로 가로챈다.
  upstream 이름은 요청 시 해석한다(search 가 없는 환경에서도 portal-fe 가 뜬다).
- `{id}` 는 search 도 숫자 1~12자리만 받는다. 404 페이지는 요청 id 를 되돌려 쓰지 않는다. canonical 은 조회한 문서의 id·언어와 설정된 origin 으로만 만든다.
- 응답은 셸의 seo 블록을 관광지 메타로 바꾸고 `#root` 에 본문을 넣는다(블로그 서버 렌더·관광지 프리렌더와 같은 계약). 셸 치환은 치환 문자열을 해석하지 않는 방식이다.
- 원문 텍스트는 태그 제거 → 엔티티 디코드 → HTML 이스케이프 순서로 처리한다. JSON-LD 는 `<` 를 `<` 로 바꾼다.
- 메타 규칙은 클라이언트와 같다: 개요가 없으면 `noindex`, 경로 언어와 문서 언어가 다르면 문서 언어 경로를 canonical 로.
  서버가 심는 JSON-LD 는 `data-seo-multi` 를 달고 클라이언트(`useSeo`)가 그리는 것과 **같은 내용**이다(ADR-0062 §13).
- 관광지당 OpenSearch 조회는 한 번이다. 셸은 `http://portal-fe/index.html` 로 받는다(프록시 경로가 아니라 순환이 없다). 5분 캐시, 받기 실패 시 마지막 정상본, 실패 뒤 30초는 다시 받지 않는다, 받기 시간 초과 1초, 한 번도 못 받았으면 최소 HTML. 셸 상태는 헬스 표시기로 보인다.
- 응답에 서버 렌더 표지(`X-Render: ssr` 헤더)를 단다. 운영 확인이 프리렌더·캐시된 응답을 재지 않게 하기 위해서다.
- 관광지 상세 프리렌더와 그 nginx 경로는 운영 확인(SR-8) 뒤 제거한다. 지역 프리렌더는 유지한다(허브는 지금처럼 대표 관광지로 링크한다 — ADR-0062 §8).

### SR-2 속성 추출·정규화 (A)
- 재색인 때 search:domain 의 순수 함수가 파생 속성을 계산해 문서에 싣는다. 입력은 place 가 **이미 유형별로 접어 둔 컬럼**(`useTime` · `restDate` · `useFee` · `parking`)과 기존 `petAcmpyType` 이고, 유형별 키 매핑을 새로 만들지 않는다. `introRaw` 는 신용카드·유모차 대여 키에만 쓴다.
- 속성: 정기휴무(연중무휴 · 매주 휴무 요일 집합) · 주차 · 반려동물 · 신용카드 · **유모차 대여** · 입장 무료. 각 값은 긍정·부정(반려동물은 일부 포함)·`UNKNOWN`.
- `UNKNOWN` 은 명시값으로 저장하고 부정으로 바꾸지 않는다. 조건부 휴무(「첫째 주 월요일」「공휴일 다음날」 등)는 요일 집합에 넣지 않고 `UNKNOWN`.
- 반려동물은 기존 `petAcmpyType` 원문(그대로 둔다)을 대응 표로 정규화해 `petPolicy`(가능 · 일부 구역 가능 · 불가 · `UNKNOWN`)에 싣는다. 대응 표는 운영 원문 값 전부를 나열해 스펙 구현 문서에 둔다. 영문 문서는 원천이 없어 `UNKNOWN`.
- 입장 무료는 원천에 요금 키가 없는 유형(관광지 12 · 레포츠 28)에서 구조적으로 `UNKNOWN` 이다.
- 영문 문서는 영문 표기 규칙으로 해석한다. 파생 결과에 `attributeParserVersion` 을 싣고, 파서를 고치면 다음 재색인이 전량을 다시 계산한다.
- 상세: 배지와 방문 정보 목록. 해석된 경우만 JSON-LD 에 `openingHoursSpecification`(정기휴무 요일) · `isAccessibleForFree` — 같은 필드를 클라이언트 JSON-LD 에도 같은 규칙으로 더한다.
- 정확도: 사람이 라벨링한 운영 표본 200건(국·영)에서 속성별 정밀도·재현율을 기록한다. 긍정 판정 정밀도 95% 미만인 속성은 필터로 열지 않는다.

### SR-3 속성 패싯 검색
- 이름은 「속성 패싯」이다(질의 이해의 `facets` 와 구분).
- 검색 API 는 속성 필터를 받는다. 필터는 **긍정 값만** 받는다(`UNKNOWN`·부정으로는 거르지 않는다). 속성 간 AND.
  「오늘 정기휴무 아님」은 요청 시 KST 요일로 계산한다(연중무휴 또는 오늘이 휴무 요일 집합에 없음 — `UNKNOWN` 제외).
- 필터는 본 질의(텍스트·벡터 레그 모두)에 들어간다.
- 건수는 본 질의와 **병렬로 내는 집계 요청**(결과 0건) 하나가 센다. 각 속성의 건수는 **자기 속성의 선택만 빼고** 나머지 선택·구조 필터(지역·분류·반경)를 반영한다. 텍스트 경로에서는 질의어도 반영하고, 하이브리드·벡터 경로에서는 질의어를 빼고 구조 필터만 반영한다(건수가 결과 목록과 다를 수 있음을 화면에 쓰지 않는다 — 칩 옆 숫자는 「이 조건을 더하면」의 규모다).
- `UNKNOWN` 은 건수 버킷으로 내지 않는다. 반려동물은 「동반 가능」「일부 구역 가능」 두 칩이고 둘 다 긍정 값이다.
- 속성 파라미터가 없는 요청의 결과·순서는 지금과 같다.
- 화면: 속성 칩과 건수. 칩은 숨기지 않는다 — 선택 안 된 칩이 0 이면 흐리게(자리 유지), 선택된 칩은 0 이어도 활성. 속성 묶음 아래에 「정보가 있는 곳만 거릅니다」를 둔다.
  모바일은 속성 칩을 한 줄 가로 스크롤 묶음 하나로 두고 기존 분류 칩과 섞지 않는다. 필터가 바뀌면 누적 목록을 처음부터 다시 받는다. 새 색인 URL 을 만들지 않는다.

### SR-4 지역 안 위치 (B)
- 시군구 축은 **`ldongRegnCd` + `ldongSignguCd`(5자리)** 다. `ldongSignguCd` 는 시도 안에서만 유일하다. 둘 중 하나라도 없는 문서는 지역 필드를 싣지 않고 색인은 한다.
- 재색인은 두 번 훑는다: 1차에 가벼운 투영(id · 언어 · 시군구 축 · 유형 · lclsSystm3 · 좌표 · 제목, 문서당 약 200B — 6만 건 약 12MB)을 모아 언어별로 집계하고, 2차에 색인한다.
- 문서에 싣는 것: 시군구 이름 · 같은 시군구·같은 유형 수 N · 같은 시군구·같은 유형·같은 lclsSystm3 수 M(항상 M ≤ N)과 분류 이름 · 같은 시군구·같은 유형·같은 분류의 가까운 곳 최대 5곳(자기 제외, id · 제목 · 거리 m).
- 상세 문구: 「{시군구} {유형 이름} N곳 중 {분류 이름} M곳」(영문 「{분류} {M} of {N} {유형} in {시군구}」). 지역 허브(`/regions/{5자리}`)로 링크한다.
- 상세 섹션 순서: 기존 개요·방문 정보 원문 → 방문 정보 배지 → 지역 안 위치 → 같은 분류 가까운 곳 → 비슷한 곳 → 기존 주변 관광지 · 편의시설 · 링크. 같은 분류 가까운 곳에 나온 id 는 주변 관광지에서 뺀다. 새 섹션 노출 식별자는 `SAME_CATEGORY_NEARBY` · `SIMILAR_ELSEWHERE`.
- 표시용 목록 필드는 매핑에서 색인하지 않는 객체로 선언한다.

### SR-5 비슷한 곳 (C)
- 임베딩을 만드는 오프라인 도구가 같은 언어·**다른 시도(`ldongRegnCd`)**·같은 유형에서 코사인 유사도 상위 5곳을 계산한다(자기 제외).
- place 에 유사 목록 표(`attraction_similar`, 마이그레이션 V22)와 내부 적재·조회 API 를 더한다(임베딩과 같은 모양). 모델은 `model_ref` 로 함께 저장한다.
- 재색인이 조회해 **활성 문서만 남겨** 싣고, 현재 임베딩의 `model_ref` 와 다르면 싣지 않는다.
- 품질: 표본 50건의 유형·분류 일치율과 사람 검토를 기록한다.

### SR-6 클릭 신호 (D)
- 신호는 **14일 고유 클릭 방문자 수**다. 노출은 순위의 결과라 쓰지 않는다. analytics 가 일 집계 표에 고유 방문자 집계 상태 컬럼(`uniqState(visitor_id)`, `anonymous` 제외)을 더한다 — ClickHouse V007, `ADD COLUMN IF NOT EXISTS`, 기존 행 보존. 날짜를 합칠 때 `uniqMerge` 로 합쳐 한 사람이 여러 날 눌러도 1로 센다. 집계기는 그날 행을 지우고 한 행만 넣는다는 불변식을 V007 주석에 적는다. 배포 뒤 최근 14일을 한 번 다시 집계한다.
- search 재색인은 ADR-0095 §6 대로 그 표를 **직접 읽어** `uniqueClickers14d` 를 싣는다(14일 창은 KST 날짜 기준). 재색인 CronJob 에 ClickHouse 접속 설정(env·Secret)을 두고, 적재한 관광지 수를 로그에 남긴다. 읽기 실패는 필드를 비우고 재색인은 진행하되 경고를 남긴다.
- 재색인이 계수 `clickBoost` 를 미리 계산해 싣는다: 최소 표본 미만이면 1.0, 이상이면 상한까지. 순위는 관련도 × `clickBoost` — **키워드 레그의 점수 함수에만** 붙고 벡터 단독·상업 의도 경로는 그대로다. nDCG 비교도 키워드 경로로 한다.
- 한계: `visitor_id` 는 클라이언트가 보내는 값이라 바꿔 가며 부풀릴 수 있다. 방어는 상한 · 최소 표본 · 기본 꺼짐 스위치이고, 이 계수는 작은 가중치로만 쓴다.
- 순위 반영은 스위치로 켜고 **기본은 꺼짐**이다. 켜기 전에 같은 시점에서 켠 상태·끈 상태를 질의별로 짝지어 nDCG 를 재고, 판정 없는 문서 비율을 함께 기록해 하락이 없을 때만 켠다.
- 지금 사람 이벤트는 7일 92건이라 대부분 문서의 계수가 1.0 이다. 이것이 의도된 초기 상태다.
- 상세의 「많이 클릭한 곳」 표시는 최소 표본 이상일 때만. `AttractionDocument` 의 「방문자 지표로 바꾼다」 주석은 이 결정에 맞게 고친다.

### SR-7 색인 계약·배선
- 새 필드는 매핑 · 쓰기 문서 · 읽기 문서(또는 읽기 제외 사유)에 모두 반영해 계약 게이트를 통과하고, 재색인 테스트가 bulk 요청에서 **값이 실제로 실리는지** 확인한다.
- 필터·집계 대상만 keyword, 나머지는 `index:false` 또는 색인하지 않는 객체. 재색인 전후 색인 크기를 기록한다.
- 네트워크 정책(새 파일 둘, `kgd.io/host-of` 표식은 달지 않는다): search 가 portal-fe 로부터 받는 수신 · portal-fe 가 search 로부터 받는 수신. portal-fe·search 의 송신은 이미 열려 있다.
- 레이어: 속성 파서·지역 집계기는 search:domain 순수 함수, 렌더는 search:app 의 UseCase 인터페이스 + 포트 + 어댑터(ADR-0083).
- 문서: ADR-0103, ADR-0062 상태 줄에 §8 대체 표시, ADR-0072 §6 에 셸 계약 두 번째 사용처, ADR-0095 §6 소비자에 search-batch, ClickHouse 네트워크 정책(09) 주석, `package-structure.md` 의 search:app 역할, `search/CLAUDE.md`, 새 용어(속성 패싯 · `petPolicy` · `clickBoost` · 서버 렌더) 사전 등재(`/hns:glossary`).

### SR-8 배포 순서·운영 확인
- 순서: ① 매핑·파서·집계기 → 재색인 ② search 렌더 → 이미지 운영 확인 → nginx 프록시·네트워크 정책(AdSense 에 가장 급한 것 — 렌더는 문서에 있는 필드만 그린다) ③ 속성 패싯 API → 화면 ④ place V22 → 도구 적재 → 재색인(SR-5) ⑤ analytics V007 → 14일 재집계 → 재색인(SR-6) ⑥ 프리렌더 제거.
- 운영 확인: 프리렌더에 없던 표본 id 에 Googlebot UA 로 요청해 **서버 렌더만 내는 표지**와 관광지 제목·개요가 있는 HTML 을 받는다. search 파드를 재기동하는 동안 같은 요청이 셸 200 으로 떨어지는 것도 확인한다.

## Existing Code to Leverage
- 서버 렌더: `blog/feature/.../render/ShellHtmlProvider.kt` · `BlogMetaRenderer.kt` · `application/.../BlogPageRenderPort.kt` · `BlogPageService.kt` · `BlogPageController.kt` · `BlogShellHealthIndicator.kt` · 테스트 `BlogMetaRendererTest.kt` · `BlogShellHealthIndicatorTest.kt`
- 본문·메타 계약: `portal-fe/scripts/prerender-seo.mjs` `renderAttractionDetail`·`visitorInfoHtml` · `portal-fe/src/seo/copy.mjs` `attractionMeta`·`touristAttractionJsonLd`·`SEO_MULTI_ATTR` · `AttractionPage.tsx`(noindex·canonical 규칙)
- 프록시: `portal-fe/nginx.conf`(attractions|regions location) · `k8s/base/network-policy/18-allow-blog-shell-fetch.yaml`
- 검색: `AttractionSearchAdapter.kt`(`findById`·`buildRequest`·벡터 레그) · `AttractionSearchPort.kt` · `SearchAttractionService.kt` · `AttractionSearchController.kt`
- 재색인: `AttractionApiReindexTasklet.kt`(sidoNames·links·embeddings 합류) · `AttractionIndexDocument.kt` · `attractions-index.json` · `build.gradle.kts` `searchIndexContracts`
- 속성 원천: place `AttractionJpaEntity`(접힌 컬럼) · `place/ingest/src/backfill_intro.py`(키 매핑) · `placeView.ts`(라벨)
- 유사: `tools/embed` · place `/internal/attractions/embeddings/bulk`·`/lookup` · `V12__create_attraction_embedding.sql`
- 클릭: `analytics/.../ClickHouseAttractionPopularityAdapter.kt` · `V006__attraction_popularity_daily.sql` · `place/ingest/src/popularity.py`(직접 읽기 전례) · 평가 `live-eval.py`

## Out of Scope
- Cloudflare HTML 캐시 규칙 · AdSense 재신청 절차 · 복잡한 영업시간(시각) 해석 · 관광지 외 타입의 서버 렌더 · 블로그 셸 제공자의 타임아웃 결함 수정(발견으로 기록)
- place 의 기존 컬럼 변경(SR-5 의 새 표 하나만 더한다)

## Open Questions
`context/open-questions.yml` — 전부 결정됨(Q1 집계 방식 · Q2 최소 표본·상한 초기값 · Q3 Cache-Control). 값은 구현 중 측정으로 조정한다.
