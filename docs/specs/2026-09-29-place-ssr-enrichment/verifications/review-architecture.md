# 아키텍처 리뷰 — place 관광지 서버 렌더 + 인리치먼트·패싯

- 대상: `spec.md`, `planning/requirements.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md`
- 기준: `CLAUDE.md`(레이어 표준·서비스 경계), `docs/conventions/package-structure.md`(ADR-0083), ADR-0062/0072/0095, NetworkPolicy·`verifyPodTopology`, 스펙이 가리킨 기존 코드
- 판정: **BLOCK 1건(사람의 결정 하나) + REVISE 8건**

## 통과한 항목

- **파드 토폴로지.** 새 `:app` 이 없다. 서버 렌더는 기존 `search:app` 이, 인리치먼트는 기존 `search:batch` 가 맡는다. 그래서 `verifyPodTopology`(`build.gradle.kts:687-697`)에 걸리지 않는다.
- **렌더 위치.** 데이터 주인인 search 가 렌더하므로 요청 경로에서 서비스 간 호출이 없다(ADR-0103:21-23). 블로그 쪽 대안은 요청마다 place→search 호출이 생겨 기각됐고, 그 근거도 타당하다(ADR-0103:39).
- **셸 제공자 복사.** 두 번째 사용처라 복사하고, 세 번째가 생기면 공통 모듈로 옮긴다(ADR-0103:24). Rule of Three 에 맞는다.
- **파생값 위치.** 파생 속성은 search 문서에만 두고 place 원천 컬럼은 그대로 둔다(ADR-0103:27-29). data-sources §0 ②와 맞는다.
- **순환 의존 없음.** 새 엣지는 search-batch → (analytics 또는 ClickHouse) 하나뿐이고, 역방향 호출은 없다.
- **트랜잭션 경계.** 모두 읽기 경로이거나 배치 색인이다. `@Transactional` 경계에는 변화가 없다.

## BLOCK

### B1. 인기도 소비 방식이 ADR-0095 §6(전용 집계 표 계약)과 충돌한다. 충돌을 적지 않았고, 근거도 사실과 다르다

- **스펙의 결정**
  - `spec.md:54` 「analytics 는 최근 14일 관광지별 조회·클릭 합을 내부 API 로 연다」
  - `ADR-0103:32` 「search 가 ClickHouse 를 직접 읽지 않는다(서비스 간 API 호출만)」
- **기존 결정과 코드**
  - `ADR-0095:106-116` §6 「소비 — 전용 집계 표로 노출한다」. `attraction_popularity_daily` 는 analytics 가 소유한 **읽기 계약 표**다. 같은 문서 `:100-101` 은 소비자로 **「검색 랭킹」** 을 이미 꼽는다.
  - `place/ingest/src/popularity.py:7-8,65-72` 에서 place-ingest 가 이 표를 직접 읽는다. recommendation 이 `recommendation_*` 표를 읽는 것과 같은 형태다(`CLAUDE.md` 서비스 표 recommendation 행 「analytics 의 ClickHouse 를 **읽기만**」).
  - `k8s/base/network-policy/09-allow-app-to-clickhouse.yaml:40` 을 보면 search-batch 는 이미 ClickHouse 접근이 허용돼 있다.
  - `search/batch/build.gradle.kts:25-26` 에 `clickhouse-jdbc` 가 이미 있다.
- **문제**
  - 이 플랫폼에서 「서비스 간 API 호출만」 규칙은 MySQL 스키마 공유 금지를 뜻한다. analytics 가 연 전용 집계 표는 ADR-0095 가 허가한 경계다. ADR-0103 은 ADR-0095 를 관련 문서로만 적었고, §6 을 뒤집는다는 사실은 적지 않았다.
  - API 쪽을 고르면 새 부품이 넷 생긴다.
    - ① analytics 내부 컨트롤러
    - ② `search-batch → analytics` ingress NetworkPolicy. 04 파일 규칙(`04-allow-backend-to-backend.yaml:19`)상 필요하다. 그런데 ADR-0103 §결과(`:45`)에는 portal-fe 정책 하나만 적혀 있어 누락됐다.
    - ③ 재색인이 analytics 파드에 런타임 의존한다. analytics 는 1.2Gi Kafka Streams 파드이고 replicas 1 이다(`k8s/overlays/oci-arm/kustomization.yaml:152-156`).
    - ④ analytics 쪽 API 계약 테스트
  - 표를 직접 읽으면 이 넷이 모두 필요 없다.
- **사람이 정할 것 (둘 중 하나)**
  - (a) ADR-0095 §6 을 따른다. search-batch 가 `analytics.attraction_popularity_daily` 를 직접 읽는다. 새 인프라가 0 이다. `spec.md:54` 와 `ADR-0103:32` 를 이 방식으로 고친다.
  - (b) API 를 유지한다. 그러면 ADR-0103 에 「ADR-0095 §6 을 search 에 한해 개정한다」와 그 이유를 적는다. ADR-0095 에도 역링크를 단다. §결과에는 `search-batch → analytics` NetworkPolicy 를 추가한다.

## REVISE

### R1. SR-4 지역 집계는 전량을 본 뒤에야 쓸 수 있다. 지금 재색인은 페이지마다 바로 쓴다

- **근거**
  - `AttractionApiReindexTasklet.kt:71-152` 는 한 페이지를 받는 즉시 `processDocument`(`:146`)로 쓴다.
  - SR-4 는 「시군구별 전체 수 · 가까운 같은 분류 상위 5곳」을 문서마다 싣는다고 적는다(`spec.md:42-43`). 이 값은 전량을 다 본 뒤에야 계산된다.
  - 스펙은 두 번 훑을지, 전량을 메모리에 들고 있을지 정하지 않았다. 전량 문서를 들고 있으면 `introRaw`·`overview`·벡터(문서당 약 4KB, `AttractionSearchAdapter.kt:57-61`)까지 약 6만 건이 올라간다. 무료 노드의 CronJob 메모리 예산을 넘길 수 있다.
- **수정안**
  - SR-4 에 「1차: place 풀스캔에서 가벼운 투영(id·lang·시군구·lclsSystm3·위경도·제목)만 모은다. 순수 함수로 집계와 근접 상위 5곳을 계산한다. 2차: 기존 스트리밍 색인 루프에서 결과 맵을 조회해 싣는다」를 명시한다.
  - 1차 스캔의 place 호출 수와 메모리 상한을 적는다.
- **시군구 축도 정한다.** 문서에는 구 코드 `sigunguCode` 와 법정동 `ldongSignguCd` 가 둘 다 있다(`AttractionApiReindexTasklet.kt:114-116`). 지역 허브는 법정동 축이다(ADR-0071). 구 코드는 폐기가 진행 중이라 빈 값이 섞인다. SR-4 의 「시군구」를 `ldongRegnCd+ldongSignguCd` 로 못박아야 허브 링크와 건수가 같은 축을 쓴다.

### R2. SR-5 는 place 스키마 변경이 필요한데, 범위 밖과 모순이다

- **근거**
  - `place/feature/src/main/resources/placedb/migration/V12__create_attraction_embedding.sql:6-20` 에는 유사 목록을 담을 컬럼이 없다.
  - 그런데 SR-5 는 「결과는 임베딩과 같은 경로로 place 에 적재」(`spec.md:49`)라고 적는다.
  - 범위 밖에는 「place 스키마 변경」이 들어 있다(`spec.md:77`). ADR-0103:27 도 「place 스키마를 바꾸지 않는다」라고 적는다.
- **수정안**
  - 범위 밖을 「place **원천 컬럼** 변경」으로 좁힌다.
  - SR-5 에 새 Flyway 마이그레이션을 명시한다. 예: `attraction_similar(attraction_id, model_ref, similar JSON, computed_at)` 에 UK `(attraction_id, model_ref)`.
  - `AttractionEmbeddingInternalController`(`/internal/attractions/embeddings`, `AttractionEmbeddingInternalController.kt:28`)와 같은 형태로 bulk·lookup 을 둔다.
  - 이미 적용된 마이그레이션은 고치지 않는다. 새 번호로 만든다.

### R3. SR-3 패싯은 포트 계약을 바꾼다. 게다가 `facets` 이름이 이미 다른 뜻으로 쓰이고 있다

- **근거**
  - `search/domain/.../AttractionSearchPort.kt:10` 의 `search()` 는 `Page<AttractionHit>` 만 반환한다. 집계 결과를 실어 보낼 자리가 없다.
  - `:42-47` 의 `SearchQuery.facets: Map<String,String>` 은 **쿼리 언더스탠딩이 만든 원천 분류 term 필터**다. SR-3 이 말하는 「패싯(속성 필터 + 값별 건수)」과 이름이 겹친다.
- **수정안**
  - 스펙에 두 가지를 적는다.
    - ① 포트 반환 타입을 `AttractionSearchResult(page, attributeCounts)` 같은 search:domain 타입으로 바꾸거나, 집계 전용 포트 메서드를 추가한다.
    - ② 새 필터 필드는 `attributeFilters` 처럼 기존 `facets` 와 구별되는 이름을 쓴다.
  - Q1(하이브리드 시 별도 집계 요청)을 고른 결과가 포트 모양을 정한다. 그래서 Q1 을 구현 전에 확정해야 한다는 점도 SR-3 에 연결한다.

### R4. 서버 렌더와 파생 함수가 어느 레이어에 들어가는지 적혀 있지 않다

- **근거**
  - 「Existing Code to Leverage」(`spec.md:67`)에는 `ShellHtmlProvider`·`BlogMetaRenderer`·컨트롤러·서비스만 있다. 레이어 표준을 만드는 부분이 빠졌다.
    - `BlogShellPort`·`BlogPageRenderPort`(`blog/feature/.../application/post/port/BlogPageRenderPort.kt:12-20`)
    - `RenderBlogPageUseCase`(`BlogPageService.kt:12-19`)
  - 서버 렌더를 컨트롤러와 어댑터만으로 짜면 `package-structure.md` 규칙 7(컨트롤러는 UseCase 인터페이스만 주입)과 규칙 8(application → infrastructure import 금지)에 걸린다.
- **수정안**
  - SR-1 에 search:app 배치를 적는다.
    - `application/attraction/usecase/RenderAttractionPageUseCase`
    - `application/attraction/port/{AttractionShellPort, AttractionPageRenderPort}`
    - `infrastructure/render/`
    - `presentation/attraction/controller/AttractionPageController`
    - 셸 URL `@ConfigurationProperties` 는 어댑터만 읽으므로 `infrastructure/config` 에 둔다(규칙 11).
  - SR-2·SR-4 의 순수 함수는 `search:domain` 의 `domain/attraction/policy/` 에 둔다(`package-structure.md:23`). 그래야 쓰는 쪽(batch)과 읽는 쪽(app, 서버 렌더)이 같은 값 타입(속성 enum·`UNKNOWN`·파서 버전)을 공유한다. batch 의 `infrastructure` 에 두면 app 이 그 타입을 재정의하게 된다.

### R5. JSON-LD 「같은 내용」(SR-1)을 보장하는 장치가 없다. 같은 지식이 두 언어에 복제된다

- **근거**
  - `spec.md:20` 은 서버 JSON-LD 가 `useSeo` 결과와 같아야 한다고 요구한다.
  - 카피 원본은 `copy.mjs` 다(`CLAUDE.md` SEO 절 「카피 SSOT 는 copy.mjs」).
  - 블로그 선례를 보면 이 등가를 지키는 것은 주석뿐이다(`BlogSeoCopy.kt:9-11`). `portal-fe/src/seo/__tests__/blogCopy.test.ts:38` 은 JS 쪽 출력을 리터럴과만 비교하고 Kotlin 출력은 보지 않는다.
  - 관광지 JSON-LD 는 `openingHoursSpecification`·`isAccessibleForFree`·`BreadcrumbList` 까지 있어 블로그보다 훨씬 크다. 한쪽만 고치면 ADR-0062 §13 이 경고한 두 벌 상태가 된다.
- **수정안**
  - SR-1(또는 SR-7)에 공유 골든 픽스처를 요구한다. 같은 문서 JSON 하나를 `touristAttractionJsonLd`(vitest)와 Kotlin 렌더러(Kotest)에 넣고, 정규화한 JSON-LD 가 픽스처 기대값과 같은지 양쪽에서 검사한다.
  - 한쪽에 회귀를 주입해 빨간불을 확인하는 것까지 포함한다.

### R6. search 파드 하나가 관광지 상세 페이지 전체를 좌우하게 된다. 파드 부재 시 동작이 스펙에 없다

- **근거**
  - search 는 `replicas: 1` 이다(`k8s/base/search/deployment.yaml:10`).
  - 게이트웨이는 업스트림이 죽으면 **200 + 빈 바디**를 낸다(`memory/project_gateway_empty_200_pitfall.md:13`).
  - 지금 place 상세는 portal-fe 정적 셸이 서빙한다(`commerce-platform.yaml:209-211`). search 가 재기동되는 동안에도 SPA 는 뜬다.
  - 변경 뒤에는 search 가 재배포·재기동하는 창에서 상세 55,524개가 **빈 200**(크롤러 포함)으로 나간다. 프리렌더까지 지우면(`spec.md:23`) 대체 경로도 사라진다.
  - `spec.md:22` 는 ES 조회 실패만 다루고, **search 파드 부재**는 다루지 않는다.
- **수정안**
  - SR-1 에 「search 가 없을 때」의 의도된 동작을 적는다. 방법은 셋 중 하나다.
    - 게이트웨이 라우트에서 연결 실패 시 portal-fe 셸로 넘기는 폴백 필터를 둔다.
    - 빈 응답을 5xx 로 바꿔 크롤러가 재시도하게 한다.
    - 위험을 받아들이고 ADR §결과에 적는다.
  - 운영 확인(`spec.md:24`)에 재기동 중 응답도 한 줄 넣는다.

### R7. NetworkPolicy·라우팅 배선의 세부

- **정책 파일.** ADR-0103:45 의 `search → portal-fe:80` 정책은 18번 파일의 이유(`18-allow-blog-shell-fetch.yaml:8-10`)대로 **별도 파일**로 둔다.
- **`kgd.io/host-of: search` 는 달지 않는다.** 이 게이트는 호스트 `*Application.kt` 안의 따옴표로 감싼 `"com.kgd.X"` 문자열로 도메인 지도를 만든다(`build.gradle.kts:757-763`). `SearchApplication.kt` 에는 그런 문자열이 없어 `:810-811` 에서 실패한다. 라벨 `search` 는 옵트인이 아닌 라벨 검사(`build.gradle.kts:827-841`)가 이미 확인한다.
- **ingress.** place 호스트 블록(`commerce-platform.yaml:194-211`)에 `/attractions`·`/en/attractions` Prefix → gateway 를 추가한다. 블로그처럼 「이 호스트에만」이라는 주석도 단다.
- **게이트웨이.** 라우트는 `search-service`(`GatewayRouteConfig.kt:369-373`) 옆에 둔다. `blog-page`(`:750-754`)와 같은 이유 주석을 붙인다.
- **SR-6 을 API 로 유지할 때.** B1 (b) 를 고르면 `search-batch → analytics` 정책을 04번 파일에 추가한다.

### R8. 개정되는 ADR·문서의 역링크

- **ADR-0062 §8.** ADR-0103 §3 은 §8(상세 선별 프리렌더)을 대체한다. 그런데 ADR-0062 상태 줄(`ADR-0062-seo-and-organic-discovery.md:3`)과 §8 에 개정 표시가 없다. 표시가 없으면 다음 사람이 `PLACE_DETAIL_CAP` 을 되살린다.
- **ADR-0072 §6.** 셸 계약의 두 번째 사용처가 생겼다는 한 줄을 추가한다. 이 한 줄이 Rule of Three 의 셋째 사용처를 셀 기준이 된다.
- **search 역할 표.** `package-structure.md:116` 의 `:search:app` 설명 「REST API (읽기 전용)」에 공개 HTML 페이지가 추가된다는 점을 반영한다. `search/CLAUDE.md` 도 같이 고친다.

## 모듈 깊이 · 삭제 테스트

- **셸 제공자(복사본).** 지우면 복잡도가 셸 캐시·마지막 정상본·헬스 세 곳으로 흩어진다. 따라서 제값을 한다. 두 번째 사본이라 공통화는 보류해도 된다(ADR-0103:24).
- **파생 속성 파서와 지역 집계 함수.** 지우면 batch 색인과 app 렌더·필터로 흩어진다. 따라서 제값을 한다. 다만 R4 에 적은 위치에 둬야 이 판정이 성립한다.
- **analytics 내부 API(SR-6).** 지우면 복잡도가 **통째로 사라진다**. 전용 집계 표가 같은 값을 이미 준다. 이것이 B1 의 핵심이다.

VERDICT: BLOCK

## Round 2

- 대상: 개정된 `spec.md`, `planning/test-quality.md`, `context/open-questions.yml`, `ADR-0103`
- 판정: **REVISE** — BLOCK 해소. 1차 항목 중 5건 해소, 4건 부분 해소. 개정으로 새로 생긴 문제 4건(N1 은 정확성 결함).

### 1차 항목 상태

| # | 상태 | 근거 |
|---|---|---|
| B1 | **RESOLVED** | (a)안을 채택했다. `spec.md:65` 「ADR-0095 §6 대로 그 집계 표를 직접 읽어」, `ADR-0103:37-38` 결정 6, `:49` API 대안 기각. 새 인프라 없이 `09-allow-app-to-clickhouse.yaml:40`(search-batch 허용)과 `cronjob-attraction-reindex.yaml:37`(라벨 search-batch)로 닿는다. |
| R1 | **PARTIAL** | 두 번 훑기는 들어갔다(`spec.md:52`). 두 가지가 남았다. ① 1차 스캔의 메모리 상한이 없다. CronJob 한도는 `limits.memory 1Gi` 다(`cronjob-attraction-reindex.yaml:63`). ② 축을 `ldongSignguCd` **하나로** 잡았다. 이것이 N1 이다. |
| R2 | **RESOLVED** | V22 `attraction_similar` 와 내부 적재·조회 API(`spec.md:59`), 범위 밖을 「기존 컬럼 변경」으로 좁힘(`:94`), `ADR-0103:35-36·56`. 번호도 맞다(현재 최신은 V21 `V21__add_attraction_setting.sql`). |
| R3 | **PARTIAL** | 이름 구분(`spec.md:42`)과 Q1 확정(`open-questions.yml:2-6`)은 됐다. 남은 것은 포트 반환 타입이다. `AttractionSearchPort.search()` 가 `Page<AttractionHit>` 만 돌려주는데, 건수를 어디에 실을지(`spec.md:45`)가 스펙에 없다. SR-3 에 「search:domain 결과 타입에 속성 건수를 더한다」 한 줄을 넣는다. |
| R4 | **RESOLVED** | `spec.md:75`(UseCase 인터페이스 + 포트 + 어댑터, 파서·집계기는 search:domain 순수 함수), `:32`. |
| R5 | **RESOLVED** | T2 `AttractionJsonLdParityTest`. vitest 가 `copy.mjs` 실제 함수로 만든 골든 픽스처를 Kotlin 이 비교하고, ★(회귀 주입)가 붙었다(`test-quality.md:9`). |
| R6 | **RESOLVED** | 구조를 바꿔 해소했다. nginx 가 앞에 서고 시간 초과·5xx·연결 실패면 셸 200 을 낸다(`spec.md:22`, `ADR-0103:21-26`). 재기동 중 확인은 `spec.md:80`·T19 에 있다. |
| R7 | **PARTIAL** | ingress·게이트웨이 항목은 설계 변경으로 필요 없어졌다. 정책 둘은 적혀 있다(`spec.md:74`, `ADR-0103:55`). 다만 「파드 토폴로지 게이트가 요구하는 표식 규칙을 따른다」(`spec.md:74`)는 뜻이 모호하다. 게이트는 `host-of` 를 요구하지 않는다(`build.gradle.kts:798-823`). search 를 가리키는 `host-of` 를 달면 실패한다(1차 R7 근거). 「`kgd.io/host-of` 를 달지 않는다, 18번과 같이 별도 파일」로 적는다. |
| R8 | **PARTIAL** | ADR-0062·ADR-0072·`package-structure.md` 는 SR-7(`spec.md:76`)에 들어갔다. `search/CLAUDE.md` 가 빠졌고, B1 해소로 ADR-0095 §6 역링크가 새로 필요해졌다(N4). |

### 개정으로 새로 생긴 문제

#### N1. 지역 집계 축 `ldongSignguCd` 단독은 시도를 넘어 겹친다 — 건수와 허브 링크가 틀린다

- **개정된 스펙**
  - `spec.md:52` 「1차에 … `ldongSignguCd` … 를 모아」
  - `spec.md:54` 「지역 허브(`/regions/{ldongSignguCd}`)로 링크」
  - `test-quality.md:17` T10 「`ldongSignguCd` 축」
- **코드**
  - `ldongSignguCd` 는 시도 안에서만 유일한 3자리다. `PlaceApiClientTest.kt:42` 에 `"ldongRegnCd":"11","ldongSignguCd":"110"` 이 있다.
  - 허브 코드는 5자리 합성값이다. `prerenderPlace.test.ts:136` 에 `href="/regions/11680"` 이 있고, `RegionDrilldown.tsx:100` 은 `region.code.slice(2)` 로 뒤 3자리를 뗀다.
- **문제**
  - 단독 축으로 묶으면 다른 시도의 같은 번호 시군구가 한 그룹으로 합쳐진다. 「N곳 중 M곳」과 근접 5곳이 틀린다.
  - `/regions/110` 은 존재하지 않는 허브다.
  - 1차 R1 이 제안한 `ldongRegnCd+ldongSignguCd` 에서 앞쪽이 빠졌다.
- **수정안**
  - SR-4·T10 의 축을 `ldongRegnCd + ldongSignguCd`(5자리)로 바꾼다. 허브 링크는 `/regions/{ldongRegnCd}{ldongSignguCd}` 로 한다.
  - T10 에 「다른 시도의 같은 `ldongSignguCd` 는 합쳐지지 않는다」 케이스를 더한다.

#### N2. 「클러스터 내부 전용 렌더 경로」의 경로가 정해지지 않았다

- **개정된 스펙.** `spec.md:20-21` 은 공개 게이트웨이에 경로를 만들지 않는다고만 적었다.
- **코드.** 게이트웨이는 `/api/search/**` 를 통째로 search 로 넘긴다(`GatewayRouteConfig.kt:369-372`). 거기에는 `rt.1989v.com` 도 포함된다(`commerce-platform.yaml:291-296`, rt 호스트는 모두 gateway 로 간다).
- **문제.** 렌더 경로를 `/api/search/…` 아래에 두면 라우트를 만들지 않아도 공개된다. 그러면 ADR-0103:25 의 「우회 호스트로는 닿지 않는다」가 거짓이 된다. NetworkPolicy 는 L4 라 경로를 가르지 못한다(`04-allow-backend-to-backend.yaml:6-7`).
- **수정안**
  - SR-1 에 경로를 못박는다. 예: `/internal/render/attractions/{id}`. 기존 관례처럼 `/internal` 은 게이트웨이·ingress 어디에도 열지 않는다(`GatewayRouteConfig.kt:140-141,660`).
  - T19 의 rt 404 확인(`test-quality.md:26`)이 이 경로로 요청하도록 적는다.

#### N3. nginx 프록시·셸 페치 배선의 계약이 빠졌다

- **정책 방향은 맞다.**
  - portal-fe egress 는 이미 열려 있다. portal-fe 는 `part-of: commerce-platform`(`k8s/base/portal-fe/deployment.yaml:18`)이라 `12-allow-backend-egress-internal.yaml:25-33` 에 해당한다.
  - search 의 ingress 는 지금 gateway 와 search-eval 만 받는다(`03:22-34`, `04:180-203`). 그래서 **portal-fe → search ingress** 정책 하나와 **search → portal-fe ingress** 정책 하나가 필요하다. 스펙의 두 줄(`spec.md:74`)과 맞는다.
  - portal-fe 쪽 정책은 13번에 합치지 않고 별도 파일로 둔다(`18-allow-blog-shell-fetch.yaml:8-10`). search 쪽은 FE→백엔드라 04번(백엔드↔백엔드) 파일이 아니라 새 파일이 맞다.
- **스펙에 한 줄씩 넣을 것**
  - **셸 URL 은 `/index.html` 이다.** 블로그 선례가 그렇다(`blog/CLAUDE.md:93`). `.html` location(`nginx.conf:253`)이 정적으로 받으므로 루프가 없다. 셸 URL 을 `/attractions/…` 같은 프록시 경로로 잡으면 search → portal-fe → search 루프가 된다.
  - **폴백은 5xx·시간 초과만 가로챈다.** 404 는 통과해야 한다(`spec.md:22`). nginx 의 `error_page` 에 500/502/503/504 만 두고, `proxy_connect_timeout`·`proxy_read_timeout` 은 2초로 둔다.
  - **`upstream` 호스트 이름 해석은 기동 시 한 번이다.** 모든 오버레이에 search Service 가 있으므로 운영 위험은 낮다(`k8s/base/kustomization.yaml:13`). 다만 portal-fe 이미지를 search 없이 띄우면(로컬 `docker run`) nginx 가 기동하지 못한다. 이 조건을 SR-1 에 적거나 `resolver` + 변수로 늦게 해석한다.

#### N4. ClickHouse 직접 읽기의 배선·계약 세부

방향(ADR-0095 §6)은 맞다. 다음이 스펙에 없다.

- **접속 정보.** `cronjob-attraction-reindex.yaml:52-60` 의 env 에는 OpenSearch·place·모델 참조만 있다. ClickHouse URL·계정을 어디서 받는지(search-eval 이 쓰는 `EvalProperties.kt:20-22` 계열과 같은 Secret 을 쓰는지)를 SR-7 배선에 적는다. 빠지면 T11 은 초록불인데 운영에서는 「읽기 실패 → 필드 비움」(`spec.md:65`)으로 조용히 떨어진다.
- **ADR-0095 역링크.** §6 도식(`ADR-0095-impression-click-pipeline.md:108-112`)은 소비자를 place-ingest 하나로 적는다. `09-allow-app-to-clickhouse.yaml:5-11,28-30` 의 search-batch 사유도 평가 잡뿐이다. 둘 다 「search-batch 관광지 재색인이 읽는다」를 더한다. 이미 적용된 V006 파일 주석은 고치지 않는다.
- **V007 의 멱등성과 엔진.**
  - analytics 는 기동할 때마다 모든 SQL 을 다시 적용한다(ADR-0095 §4, `:88-90`). 그래서 V007 은 `ALTER TABLE … ADD COLUMN IF NOT EXISTS` 여야 한다.
  - 표는 `SummingMergeTree((impressions, clicks))` 다(`V006__attraction_popularity_daily.sql:16`). 새 컬럼은 합산 목록 밖이라, 병합 때 임의의 값 하나가 남는다. 이것이 안전한 이유는 집계기가 그날을 지우고 한 행만 넣기 때문이다(`ClickHouseAttractionPopularityAdapter.kt:22-24`). 이 불변식을 V007 주석과 T14 에 적는다.
- **「14일 합」의 뜻.** 일별 고유 방문자를 14일 더하면 「고유 방문자」가 아니라 「방문자-일」이다(`spec.md:64-65`). 필드 이름(`uniqueClickers14d`)과 조작 방어 근거(`ADR-0103:39`)가 이 값을 전제로 한다. 이름을 `clickerDays14d` 로 바꾸거나, 이 뜻을 스펙에 명시한다.

### 요약

- 차단 사유는 없다.
- N1 은 구현 전에 반드시 고친다. 그대로 두면 지역 문구와 허브 링크가 틀린 값으로 5만 5천 페이지에 나간다.
- 나머지는 스펙에 한 줄씩 더하면 된다.

VERDICT: REVISE
