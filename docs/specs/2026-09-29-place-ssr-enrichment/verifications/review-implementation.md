# 구현 가능성 리뷰 — place 관광지 서버 렌더 + 인리치먼트·패싯

- 대상: `spec.md` · `planning/requirements.md` · `context/open-questions.yml` · `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md`
- 차원: implementation (참조 코드 존재 · 기존 코드 충돌 · 복잡도 · NFR · 이행/롤백 · 동시성)
- 판정: **REVISE** — 차단 사유는 없다. 다만 SR-4·SR-5 가 스펙대로는 구현이 안 되는 지점이 둘 있고(전량 집계 구조, place 스키마), 드러나지 않은 작업과 배포 순서 제약이 여럿 있다.

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 통과 — 이름 붙은 파일은 전부 있다. 다만 SR-4 의 시군구 **이름**, SR-5 를 담을 place 저장소, SR-6 의 analytics 조회 API 는 아직 없다(아래 I-3·I-2·I-6) |
| 2 | 기존 코드와 충돌하지 않는가 | 이슈 — 재색인이 스트리밍이라 SR-4 와 맞지 않음(I-1). SR-5 가 스펙의 「place 스키마 변경 없음」과 충돌함(I-2) |
| 3 | 복잡도 위험을 짚었는가 | 이슈 — 태스클릿에 합류 다섯 가지가 한꺼번에 붙는다(I-1) |
| 4 | NFR 안티패턴(무제한 자원 등)이 없는가 | 이슈 — 배치 힙 약 256MB. 전량을 메모리에 들면 OOM 이 난다(I-1). kNN 과 post_filter 를 함께 쓰면 리콜이 준다(I-5) |
| 5 | 이행·롤백 전략이 있는가 | 부분 — 프리렌더 제거 순서만 있다. ingress·이미지·재색인 순서는 없다(I-9) |
| 6 | 동시성 | 통과 — 셸 캐시는 블로그와 같은 `@Volatile` + Caffeine 구조다. 재색인은 `concurrencyPolicy: Forbid`(`k8s/base/search-batch/cronjob-attraction-reindex.yaml:20`) |

## 확인된 것 (그대로 된다)

- **search:app 의 의존성**: `spring-boot-starter-web`·`caffeine`·`actuator`·`kotlin-logging` 이 이미 있다(`search/app/build.gradle.kts:10-11,24,37`). 블로그 셸 제공자가 쓰는 것과 같다(`blog/feature/build.gradle.kts:17,24,25,27`). `ShellHtmlProvider`(`blog/.../render/ShellHtmlProvider.kt:20-87`)는 `RestClient` 와 Caffeine 만 쓰므로 새 의존성 없이 복사할 수 있다. `commonmark` 는 필요 없다(관광지 본문은 마크다운이 아니다).
- **gateway 라우트**: `search:8083` 대상은 이미 있고(`GatewayRouteConfig.kt:369-373`), `blog-page` 처럼 Host 조건 없이 경로만 거는 방식(`:750-754`)을 그대로 쓸 수 있다. 호스트를 가르는 일은 ingress 가 맡는다(`commerce-platform.yaml:228-247`).
- **ingress**: place 블록(`commerce-platform.yaml:194-211`)에 `/attractions`·`/en/attractions` Prefix 두 줄을 넣으면 된다. k8s Prefix 는 경로 요소 단위로 맞추므로 `/en` 루트는 영향이 없다.
- **문서 조회 한 번**: `findById` 가 GET 한 번이다(`AttractionSearchAdapter.kt:94-97`). breadcrumb 에 필요한 시도 이름도 문서에 있다(`attractions-index.json:222` `sidoName`, `AttractionPage.tsx:140-142`).
- **hreflang 없음**: 클라이언트(`AttractionPage.tsx:156-158`)와 프리렌더(`prerender-seo.mjs:1086`) 모두 걸지 않는다. 서버도 걸지 않으면 되고, 짝 문서를 찾는 두 번째 조회는 생기지 않는다.
- **비활성 문서 404**: 재색인이 `ACTIVE` 만 싣는다(`AttractionApiReindexTasklet.kt:75`). 비활성 문서는 색인에 없으므로 `findById` 가 null → 404 로 자연히 떨어진다.
- **계약 게이트**: `verifySearchIndexContract` 가 매핑 키와 쓰기·읽기 클래스를 대조하고(`build.gradle.kts:494-601`), 읽기 쪽 제외는 `searchReadOmitted` 에 이유를 적는다(`:515-532`). 새 필드도 이 경로로 막힌다.

## 이슈

### I-1 (체크 2·3·4) SR-4 는 지금 재색인 구조로는 안 된다 — 전량을 두 번 훑어야 하고, 메모리에 다 들면 OOM 이 난다
- 근거: 태스클릿은 페이지를 받는 즉시 색인한다(`AttractionApiReindexTasklet.kt:71-152`, `bulkProcessor.processDocument` 이 `:146`). 시군구 전체 수와 「같은 시군구·분류에서 가까운 5곳」(`spec.md:42-43`)은 **전량을 본 뒤에야** 정해지므로 첫 문서를 쓰기 전에 알아야 한다.
- 메모리: CronJob 은 `limits.memory: 1Gi` 인데(`cronjob-attraction-reindex.yaml:61-63`) `JAVA_TOOL_OPTIONS` 패치가 Deployment 에만 걸린다(`k8s/overlays/oci-arm/kustomization.yaml:130-132`). 그래서 JVM 기본값 25%, 힙 약 256MB 다. 벡터가 `List<Float>`(박싱)라(`PlaceApiClient.kt:84`) 59,735 × 640 을 메모리에 들면 Float 객체만 약 3,800만 개, 0.9GB 안팎이다. 벡터를 빼도 개요·`introRaw`·`infoRaw`·`imagesRaw` 원문 전량은 수백 MB 다.
- 수정안: SR-4 에 **두 번 훑기**를 적는다.
  - 1차: 가벼운 투영만 모은다 — `id · lang · ldongSignguCd · lclsSystm3 · lat · lon · title`. 6만 건에 약 10MB 다.
  - 집계: 이 투영에서 시군구별·분류별 수와 가까운 5곳을 계산한다.
  - 2차: 지금 루프를 그대로 돌리면서 집계를 붙인다.
  - 부담: 관측 소요 125~157초(`cronjob-attraction-reindex.yaml:32`)가 약 두 배가 된다. `activeDeadlineSeconds: 1800` 안이다. 1차 투영은 SR-5 의 비활성 id 거르기(I-2)에도 쓴다.
- 함께 적을 것:
  - 집계 범위는 **언어별**이다. ko/en 은 다른 문서다(`AttractionPage.tsx:156-158`).
  - 시군구 키는 `ldongSignguCd` 다. 옛 `sigunguCode` 는 TourAPI 가 폐기 중이라 비는 값이 있다 — 검색 필터도 이미 법정동 축을 쓴다(`AttractionSearchAdapter.kt:277-283`).

### I-2 (체크 2) SR-5 는 place 스키마 변경 없이는 안 된다 — 스펙의 범위 밖 항목과 충돌한다
- 스펙 결정: 「place 스키마 변경」이 범위 밖이고(`spec.md:77`), ADR 도 「place 스키마를 바꾸지 않는다」고 적었다(`ADR-0103:27-29`). 그런데 SR-5 는 결과를 「임베딩과 같은 경로로 place 에 적재」한다(`spec.md:49`, `ADR-0103:30`).
- 코드: place 에 있는 임베딩 저장소는 `attraction_embedding` 한 표뿐이다(`place/feature/src/main/resources/placedb/migration/V12__create_attraction_embedding.sql:6-21`). 유사 목록을 담을 컬럼·표가 없고 마지막 마이그레이션은 V21 이다.
- 드러나지 않은 작업:
  - place: `V22__create_attraction_similar.sql` 과 엔티티·저장소, `/internal/attractions/similar/bulk`·`/lookup`
  - search-batch: `PlaceApiClient.lookupSimilar`
  - `tools/embed`: 유사도 계산 명령과 push. 지금 도구에는 임베딩 bulk·lookup 만 있다(`tools/embed/src/embed/client.py:80-104`)
- 수정안:
  - 범위 밖 문구를 「**원천 컬럼** 변경 없음. 파생 저장용 새 표 하나(유사 목록)는 허용」으로 고치고, ADR §4·§5 에도 같은 예외를 적는다.
  - 마이그레이션은 되돌릴 수 없다(main = 배포). 표 모양(`attraction_id, model_ref, similar_json` 또는 행 단위)을 태스크 전에 확정한다.
  - 재색인은 유사 목록의 id 를 1차 투영의 활성 집합과 대조해, 비활성·삭제된 곳을 빼고 싣는다. 안 빼면 상세의 「비슷한 곳」 링크가 404 로 간다.
- 계산 비용(오프라인)은 문제없다. 언어당 n ≤ 약 3.5만일 때 n²·640 ≈ 8×10¹¹ 곱셈합이다. numpy BLAS 로 수십 초 규모고, 2천 행씩 나누면 청크당 행렬이 약 280MB 다. 단, 「다른 시도」 마스크에는 id → (lang, ldongRegnCd) 가 필요하다. 이 값은 임베딩 lookup 에 없으므로 도구가 place 목록 API 로 따로 받아야 한다 — 이것도 태스크로 적는다.

### I-3 (체크 1) SR-4 의 「{시군구} 관광지 N곳」 — 시군구 **이름**이 문서에 없다
- 근거: 매핑에는 `sidoName` 만 있고(`attractions-index.json:222`) 시군구는 코드뿐이다(`:142`, `:148`). 재색인은 시도 이름표만 받는다(`AttractionApiReindexTasklet.kt:62-64`). 서버 렌더는 조회 한 번 규칙(`spec.md:19`) 때문에 요청 시점에 이름을 찾을 수 없다.
- 수정안: SR-4 에 `sigunguName` 필드를 추가한다(`index:false`, 계약 3곳). 재색인이 시군구 이름표를 회차당 한 번 받는 경로(`PlaceApiClient` 메서드 하나)를 태스크로 적는다. 시도 이름표와 같은 패턴이다.

### I-4 (체크 2) 서버 JSON-LD·메타 「클라이언트와 같은 내용」 — 스펙에 없는 조건 둘
- **개요 없는 문서의 noindex**: 클라이언트는 `noindex: !attraction.overview` 를 건다(`AttractionPage.tsx:155`). 서버가 이걸 안 따르면, 하이드레이션 전(크롤러가 보는 HTML)에는 색인 허용이고 후에는 noindex 인 두 벌이 된다. SR-1 에 「개요 없으면 robots noindex — 클라이언트와 같은 규칙」을 넣는다.
- **경로 언어와 문서 언어가 다를 때**: `/en/attractions/{ko 문서 id}` 요청에 대한 규칙이 없다. canonical 이 다른 경로를 가리키는 중복 페이지가 생긴다. 404 또는 canonical 경로로 301 중 하나를 SR-1 에 적는다.
- 구현 메모: 메타·JSON-LD 가 Kotlin(서버)과 `copy.mjs`(클라이언트) 두 곳에 구현된다. SR-2 의 `openingHoursSpecification`·`isAccessibleForFree` 도 **양쪽**에 넣어야 한다(`copy.mjs` `touristAttractionJsonLd` + `AttractionPage.tsx:159-170`). FE 쪽 태스크가 스펙에 빠져 있다(`spec.md:31` 은 서버 JSON-LD 만 말한다).

### I-5 (체크 4) SR-3 패싯 — post_filter 는 벡터 레그와 함께 쓰면 리콜을 깎는다. 포트 반환형도 바뀐다
- 근거:
  - 벡터 레그는 필터를 **knn 안에** 넣어야 한다고 코드가 적었다(`AttractionSearchAdapter.kt:381-384`, `:393-400`). 밖에 두면 전역 k 개 뒤에 걸러서 레그가 꺼진다.
  - 속성 필터를 post_filter 로 보내면 `matched`(`:263-308`)에 들어가지 않는다. 그러면 knn 필터에도 없어서 정확히 그 실패가 난다.
  - Q1 기본값(`open-questions.yml:5-6`)은 「하이브리드 활성」만 다룬다. **키워드 없이 벡터만 쓰는 경로**(`:321-324`)도 같은 문제를 갖는다.
- 수정안: Q1 을 다음과 같이 확정한다.
  - 벡터가 걸리는 두 경로(하이브리드·벡터 단독): 속성 필터를 `matched` 에 넣어 양 레그에 걸고, 패싯은 `size:0` 집계 요청 한 번으로 따로 받는다(패싯마다 「자기 뺀 필터」 filter agg).
  - BM25 경로만 post_filter + 같은 요청 집계를 쓴다.
- 드러나지 않은 작업:
  - `AttractionSearchPort.search` 가 `Page<AttractionHit>` 를 돌려주므로(`search/domain/.../AttractionSearchPort.kt:10`) 패싯을 실을 자리가 없다. 포트·유스케이스·응답 DTO·`placeApi.ts` 의 반환형이 바뀐다.
  - 이름 충돌: `SearchQuery.facets` 는 이미 「질의 이해가 유도한 원천 분류 term」이다(`AttractionSearchPort.kt:47`, `AttractionSearchAdapter.kt:293-296`). 새 속성 필터는 `attributes` 처럼 다른 이름을 쓴다. 같은 이름을 쓰면 질의 이해 필터와 사용자 선택이 한 맵에 섞인다.

### I-6 (체크 1·2) SR-6 인기도 — 「조회」가 원장에 없고, 새 네트워크 정책과 상한 계산 위치가 빠졌다
- 원장 컬럼: `attraction_popularity_daily` 는 `impressions`·`clicks` 만 갖는다(`analytics/app/src/main/resources/clickhouse/analytics/V006__attraction_popularity_daily.sql:11-14`). 집계도 `IMPRESSION`·`CLICK` 만 센다(`ClickHouseAttractionPopularityAdapter.kt:44-54`). 스펙의 「조회·클릭」(`spec.md:54`)과 「14일 조회 20 미만」(`open-questions.yml:11`)의 「조회」가 검색 노출인지 상세 조회인지 정해지지 않았다. 상세 조회라면 ClickHouse 마이그레이션과 집계 변경이 추가된다. 노출이라고 적는 편이 작업이 없다.
- API 없음: analytics 에는 `/api/v1/events`·`judgments`·`scores`·`experiments` 컨트롤러만 있다(`analytics/app/.../ScoreController.kt:16` 등). 14일 합을 내는 조회 포트·어댑터·내부 컨트롤러를 새로 만들어야 한다. 모양은 id 목록 lookup 보다 「0 아닌 행 전체」 한 번이 낫다 — 6만 id 를 나눠 부를 이유가 없다.
- 네트워크 정책: search-batch → analytics:8090 규칙이 없다. `04-allow-backend-to-backend.yaml:4-17` 목록에 없다. 빠뜨리면 「Connection refused」가 나는데 SR-6 은 실패를 삼키므로(`spec.md:59`) **조용히 인기도 0** 이 된다. 정책을 태스크로 적고, 재색인 로그에 「인기도 적재 N건」을 찍어 0 을 드러낸다.
- ADR 근거 보정: ADR §6 은 「search 가 ClickHouse 를 직접 읽지 않는다」고 쓴다(`ADR-0103:32`). 그런데 search-batch 는 이미 ClickHouse JDBC 를 갖고(`search/batch/build.gradle.kts:25-26`) ClickHouse 허용 목록에도 있다(`k8s/base/network-policy/09-allow-app-to-clickhouse.yaml:40`). API 를 고른 이유는 「원장 스키마 소유를 analytics 에 둔다」(V006:3-4 와 같은 논리)로 적는 게 정확하다. 결론은 그대로 두어도 된다.
- 상한·최소 표본 계산 위치: 순위 함수는 `fieldValueFactor` 곱이다(`AttractionSearchAdapter.kt:446-455`). fvf 로는 상한(min)을 못 건다. 재색인이 `visitBoost` = (표본 미만이면 1.0, 아니면 min(상한, f(n))) 를 미리 계산해 숫자 필드로 싣고, 질의는 modifier 없이 곱하게 한다. 이러면 값을 바꿀 때 재색인이 필요하다 — 스펙에 적는다. 스위치(`AttractionRankingProperties`, 기본 꺼짐)도 적는다. 꺼져 있어야 SR-3 의 「기존 요청의 결과와 순서 그대로」(`spec.md:37`)와 충돌하지 않는다.
- 적용 범위: 이 함수는 키워드 레그에만 걸린다. 벡터 단독 경로(`:324`)와 `commerceIntent`(`:440`)에서는 빠진다. nDCG 비교도 같은 경로에서 해야 한다.

### I-7 (체크 4) SR-7 — 객체 필드는 매핑하지 않으면 동적 매핑으로 부풀고, 계약 게이트는 하위 키를 안 본다
- 근거: `attractions-index.json` 에 `"dynamic"` 설정이 없다(검색 결과 없음). 게이트는 최상위 `val` 만 비교한다(`build.gradle.kts:562-564`).
- 문제: SR-4 의 가까운 5곳, SR-5 의 비슷한 5곳을 객체 배열로 넣으면서 하위 속성을 매핑하지 않을 수 있다. 그러면 `id`·`title` 이 text+keyword 로 **동적 색인**된다. SR-7 의 `index:false` 의도(`spec.md:63`)가 조용히 무너지는데 게이트는 통과한다.
- 수정안: 표시용 객체는 `"type":"object","enabled":false` 로 선언한다고 SR-7 에 적는다. 속성 필드(SR-2)는 평평한 keyword 필드로 둔다.

### I-8 (체크 2) 서버 렌더를 search:app 에 넣을 때의 레이어·정책 작업
- 레이어: `verifyLayerDependencies`(ADR-0083)가 걸린다. 블로그처럼 `RenderAttractionPageUseCase` 인터페이스 + `AttractionShellPort`(application) + `ShellHtmlProvider` 어댑터(infrastructure) 모양이어야 게이트를 통과한다. 블로그 쪽은 `BlogShellPort` 를 구현한다(`ShellHtmlProvider.kt:6,23`).
- 네트워크 정책: `18-allow-blog-shell-fetch.yaml:27-38` 을 복사해 from 을 `search` 로 바꾼 정책이 필요하다. ADR 결과 절에 적혀 있지만(`ADR-0103:45`) 스펙 SR 에는 없다. 없으면 모든 상세가 최소 HTML 로 나가고 경고 로그만 남는다(18번 파일 5-6행이 이 증상을 적어 두었다).
- 참고(경미): `rt.1989v.com` 은 `/` 전체를 gateway 로 보낸다(`commerce-platform.yaml:291-296`). 그래서 `rt.1989v.com/attractions/{id}` 로도 HTML 이 나간다. 블로그도 같은 상태이고, canonical 이 place 호스트를 가리키니 차단 사유는 아니다.

### I-9 (체크 5) 순서 제약 — 스펙에 없다
Argo 는 한 커밋을 한 번에 반영하고, 이미지 태그는 CI 가 나중에 커밋백한다. 순서를 스펙(또는 tasks)에 못 박아야 한다.
1. **매핑·계약 → 재색인 → 읽는 쪽**: SR-2/4/5/6 필드는 `search-batch` 이미지로 재색인된 뒤에야 존재한다. 그 전에 search:app 패싯이나 FE 칩이 나가면 전 값이 0(비활성)으로 보인다. FE 칩은 패싯 응답이 비면 숨기게 한다.
2. **place V22 → tools push → 재색인**(SR-5). 마이그레이션은 되돌릴 수 없다.
3. **analytics API + netpol → search-batch 합류**(SR-6). 순서가 뒤집혀도 실패는 삼켜진다. 그래서 I-6 의 적재 건수 로그가 유일한 신호다.
4. **서버 렌더**: search:app 이미지(컨트롤러) + search→portal-fe netpol + gateway 라우트가 운영에 뜬 것을 확인한 **다음 커밋**에서 ingress 두 줄을 연다. 같은 커밋에 두면 search 이미지가 늦을 때 전 상세가 404/502 로 크롤러에 나간다. 이미지 게이트 실패는 그 커밋의 **모든** 이미지를 막는다.
5. **롤백**: ingress 두 줄을 되돌리면 프리렌더로 돌아간다. 그러니 프리렌더 제거(SR-1 마지막 항)는 4번을 운영에서 확인한 뒤 별도 커밋으로 한다 — 스펙대로다.

### I-10 (체크 3) 태스클릿 복잡도
시도 이름·링크·벡터 합류에 속성 파서, 두 번 훑기 집계, 유사 목록, 인기도, 시군구 이름이 더해진다. `execute` 하나에 넣으면 기존 `AttractionApiReindexTaskletTest` 가 모든 합류를 한 번에 모킹해야 한다. 순수 함수 둘 — 속성 파서(SR-2)와 지역 집계기(SR-4, 투영 → 문서별 결과) — 을 search:domain 에 두고, 태스클릿은 합류만 한다는 것을 SR-2/SR-4 에 적는다. 파서 버전 필드도 이 함수가 갖는다.

## 요약 수정안
1. SR-4: 두 번 훑기 + 언어별 + `ldongSignguCd` 키 + `sigunguName` 필드 (I-1, I-3)
2. 범위 밖·ADR §4: 「원천 컬럼 변경 없음, 유사 목록용 새 표 허용」. SR-5 에 place V22·내부 API·도구 명령·활성 대조 (I-2)
3. SR-1: 개요 없음 noindex, 경로·문서 언어 불일치 규칙, FE JSON-LD 태스크, search→portal-fe netpol (I-4, I-8)
4. Q1 확정: 벡터가 걸리는 두 경로는 필터를 레그 안에 + 별도 집계. 포트 반환형 변경. `facets` 이름 충돌 회피 (I-5)
5. SR-6: 「조회」 정의, analytics 내부 API 신설, search-batch→analytics netpol, `visitBoost` 사전 계산 + 스위치 기본 꺼짐 (I-6)
6. SR-7: 표시용 객체는 `enabled:false` (I-7)
7. 배포 순서 5단계를 tasks 에 (I-9)

VERDICT: REVISE

## Round 2

- 대상: 개정된 `spec.md` · `context/open-questions.yml` · `ADR-0103`
- 판정: **REVISE** — 1차 이슈는 대부분 해소됐다. 개정으로 생긴 새 구현 지점 중 둘(N-1 재색인 잡의 ClickHouse 접속 설정 없음, N-3 nginx·셸 제공자 시간 초과가 둘 다 2초)이 스펙대로 두면 **조용히 실패**한다. 차단할 사유는 없다.

### 1차 항목 상태

| # | 상태 | 근거 |
|---|---|---|
| I-1 | RESOLVED | 두 번 훑기·가벼운 투영·언어별 집계(`spec.md:52`). 투영 6만 건은 약 10MB라 힙 256MB 안이다. 1차도 place 페이지를 전부 받으므로 place 호출 수와 소요가 약 두 배가 된다(관측 125~157초 → 300초 안팎). `activeDeadlineSeconds: 1800`(`cronjob-attraction-reindex.yaml:33`) 안이다 |
| I-2 | RESOLVED | 범위 밖 문구가 「기존 컬럼 변경 없음, 새 표 하나」로 바뀌었다(`spec.md:94`). V22·내부 API·`model_ref`·활성 대조(`spec.md:58-60`), ADR §5(`ADR-0103:35-36`)도 반영됐다. 마지막 마이그레이션은 여전히 V21 이다(`placedb/migration/V21__add_attraction_setting.sql`). 도구가 「다른 시도」 마스크용 `ldongRegnCd` 를 받는 경로는 태스크에서 적는다 |
| I-3 | RESOLVED | 「시군구 이름」을 문서에 싣는다(`spec.md:53`). 이름 원천은 이미 있다 — `PlaceApiClient.fetchRegionPage`(`PlaceApiClient.kt:92`) |
| I-4 | RESOLVED | noindex 규칙·언어 불일치 시 canonical(`spec.md:26`). 클라이언트 JSON-LD 도 같은 규칙으로 추가(`spec.md:38`) |
| I-5 | RESOLVED | 필터를 모든 레그에 넣고 벡터가 걸리는 경로는 집계 요청을 따로 낸다(`spec.md:45-46`, `open-questions.yml:6`). 이름은 「속성 패싯」으로 갈랐다(`spec.md:42`). 포트 반환형 변경은 태스크 몫이다. 집계 방식의 새 문제는 N-4 |
| I-6 | PARTIAL | 방향이 바뀌었다 — analytics API 대신 집계 표를 직접 읽는다(`spec.md:65`, `ADR-0103:37-40`). ClickHouse 네트워크 정책은 이미 search-batch 를 허용한다(`09-allow-app-to-clickhouse.yaml:40`). 신호 정의(고유 클릭 방문자)·`clickBoost` 사전 계산·스위치 기본 꺼짐도 해소됐다(`spec.md:64-67`). **남은 것**: 계수가 붙는 경로가 적혀 있지 않다. 지금 순위 함수는 키워드 레그에만 걸리고 벡터 단독(`AttractionSearchAdapter.kt:324`)과 `commerceIntent`(`:440`)에서는 빠진다. `spec.md:66` 의 「순위는 관련도 × `clickBoost`」가 어느 경로인지와 nDCG 비교 경로를 한 줄로 적는다. 접속 설정 문제는 N-1 |
| I-7 | RESOLVED | 「색인하지 않는 객체」로 선언(`spec.md:55,73`) |
| I-8 | RESOLVED | 레이어(`spec.md:75`)와 두 방향 네트워크 정책(`spec.md:74`). 내부 전용 경로라 우회 호스트 문제도 없어졌다 — gateway 의 search 라우트는 `/api/search/**` 뿐이다(`GatewayRouteConfig.kt:369-372`) |
| I-9 | RESOLVED | 배포 순서 6단계와 운영 확인 절차(`spec.md:79-80`) |
| I-10 | RESOLVED | 파서·집계기를 search:domain 순수 함수로(`spec.md:32,75`) |

### 새 이슈

#### N-1 (체크 1·4) 재색인 잡에 ClickHouse 접속 설정이 없다 — 스펙대로면 매일 조용히 빈 값이 된다
- 근거:
  - search-batch 의 ClickHouse 접속값은 `EvalProperties`(`search.eval.*`) 하나뿐이고 기본값이 `jdbc:clickhouse://localhost:8123/analytics` 다(`search/batch/.../eval/EvalProperties.kt:14,20-22`).
  - 이 값을 채우던 Kotlin 평가 잡은 2026-09-27 에 제거됐다(`k8s/base/search-batch/kustomization.yaml:7`).
  - 재색인 CronJob 의 env 에는 OpenSearch·place·모델 참조만 있다(`cronjob-attraction-reindex.yaml:52-60`).
- 결과: 그대로 구현하면 localhost 로 붙다 실패한다. SR-6 이 실패를 삼키므로(`spec.md:65`) 필드가 매일 빈다.
- 수정안: SR-6(또는 SR-7 배선)에 다음을 적는다.
  - 재색인 전용 접속 설정(`search.click-signal.*` 같은 새 prefix)을 만든다. 폐기된 평가 잡의 `search.eval` 을 재사용하지 않는다.
  - CronJob 에 URL·계정 env 와 Secret 참조를 더한다. place-ingest `popularity.py` 가 쓰는 Secret 과 같은 것을 쓴다.
  - 경고 건수 말고 「클릭 신호 적재 N건 / 표 행 수 M」을 로그에 찍는다. 7일 사람 이벤트가 92건이라 0 이 정상값처럼 보일 수 있다.

#### N-2 (체크 5) V007 새 컬럼은 과거 날짜가 0 이다 — 14일 창이 차는 데 14일 걸린다. 합의 의미도 정해야 한다
- 근거: 집계는 날짜 하나를 지우고 다시 넣는다(`ClickHouseAttractionPopularityAdapter.kt:20-33`). `ADD COLUMN` 은 기존 행을 기본값 0 으로 둔다.
- 엔진: `SummingMergeTree((impressions, clicks))` 다(`V006__attraction_popularity_daily.sql:16`). 합산 대상에 없는 새 컬럼은 병합 때 한 행의 값만 남는다. 지금은 (day, id)당 한 행이라 안전하다. 엔진 인자는 ALTER 로 못 바꾸니 새 컬럼을 합산 목록에 넣으려 하지 않는다 — 스펙에 한 줄 적어 둔다.
- 수정안:
  - V007 배포 뒤 최근 14일을 한 번 다시 접는다. 날짜별 DELETE+INSERT 라 멱등이다. 그러면 첫 재색인부터 창이 찬다.
  - 「14일 합」은 **날짜별 고유 방문자의 합**이다. 14일 안의 고유 방문자 수와 다르다(매일 누르는 한 사람이 14로 센다). 조작 방어가 목적이면(`ADR-0103:39`) 이 차이를 명시한다. 진짜 14일 고유가 필요하면 표 대신 원장을 읽어야 하는데, 그건 §6 과 충돌한다. 지금 표본 크기에서는 날짜별 합으로 충분하다고 적는 편이 작업이 없다.

#### N-3 (체크 4) nginx 시간 초과와 셸 페치 시간 초과가 둘 다 2초다 — 셸 캐시가 만료되는 요청은 늘 폴백으로 떨어진다
- 근거:
  - 셸 제공자는 캐시가 비면 **요청 스레드에서 동기로** 셸을 받는다(`blog/.../render/ShellHtmlProvider.kt:27-28,48-51`). 스펙은 이 요청 시간 초과를 2초로 정했고, nginx 시간 초과도 2초다(`spec.md:22,28`).
  - 둘이 같으면 5분마다 오는 셸 재수신 요청이 ES 조회 시간만큼 nginx 한도를 넘는다. 그 요청은 서버 렌더를 버리고 셸로 나간다.
  - 네트워크 정책이 없거나 틀리면 패킷이 버려진다. 그러면 연결 거부가 아니라 연결 시간 초과가 된다. 그 경우 **모든 상세가 2초 늦게** 셸로 나간다. search 파드는 게이트웨이 말고는 받지 않는다(`04-allow-backend-to-backend.yaml:181`).
- 수정안: SR-1 에 시간 초과를 층별로 적는다.
  - nginx 연결 시간 초과는 짧게(예: 300ms), 읽기 시간 초과는 그보다 길게(예: 3초) 둔다.
  - 셸 페치 시간 초과는 nginx 읽기 한도보다 확실히 작게(예: 1초) 둔다.
  - 셸 캐시를 `refreshAfterWrite` 로 바꿔 요청 스레드가 기다리지 않게 하는 것도 방법이다. 블로그 제공자를 **복사**하는 것이므로 여기서만 고치면 된다.
- 경로 순환은 없다: 셸은 `http://portal-fe/index.html` 로 받고(`ShellHtmlProvider.kt:22`), 그 경로는 `\.html$` location 이라(`portal-fe/nginx.conf:253-257`) 새 프록시 location 에 걸리지 않는다. 관광지 셸 URL 도 `/index.html` 로 고정한다고 적어 둔다.

#### N-4 (체크 2) 하이브리드에서 「텍스트 전용」 집계는 결과 목록과 어긋난다 — 텍스트 매치 0 이면 칩이 전부 숨는다
- 근거: 집계 요청은 텍스트 레그의 매치 집합으로 센다(`spec.md:46`, `open-questions.yml:6`). 하이브리드 결과에는 벡터만으로 올라온 문서가 섞인다. 영문·의미 질의처럼 텍스트 매치가 0 이면 모든 속성 건수가 0 이 되고, 선택 안 된 0 칩은 숨긴다(`spec.md:48`). 결과는 있는데 필터를 고를 수 없다.
- 벡터 단독(키워드 없음) 경로에서는 「텍스트 전용」이 곧 필터만 건 전체 집합이다. 결과(상위 k)와 모집단이 다르지만 「조건별 건수」로는 말이 된다.
- 수정안(택1, Q1 에 적는다):
  - 벡터가 걸리는 경로의 집계 모집단을 「질의어를 뺀 구조 필터(지역·분류·속성)」로 정한다. 건수가 0 이 되는 일이 결과 유무와 맞는다. 가장 단순하다.
  - 또는 텍스트 집계 총합이 0 이면 칩을 숨기지 말고 건수 없이 보인다.
- 두 번째 요청은 본 질의와 **병렬**로 낸다고 적는다. 직렬이면 검색 지연이 그대로 늘어난다.

#### N-5 (경미) nginx 가 기동할 때 `search` 이름을 푼다
- 지금 portal-fe nginx 에는 `proxy_pass` 가 하나도 없다(`portal-fe/nginx.conf:242-244` 주석이 「nginx 내 proxy 설정은 불필요」라고 적었다 — 이 주석도 고친다).
- 정적 `proxy_pass http://search:8083` 은 기동 때 이름을 푼다. 이름이 없으면 nginx 가 뜨지 않고 **모든 호스트**가 내려간다. k8s 에서는 파드 상태와 무관하게 Service 가 있으니 문제가 없다. 다만 `docker run` 으로 이미지를 단독 확인하거나 search Service 가 없는 오버레이에서는 실패한다. 각 오버레이에 search Service 가 있음을 확인하는 것을 ⑤ 단계 태스크에 넣는다.
- 404 전달·5xx 폴백은 `proxy_intercept_errors on` + `error_page 500 502 503 504 = @셸` 로 된다. server 수준에 `error_page 404` 가 없으므로(`nginx.conf` 전체) 404 는 search 응답 그대로 나간다. 기존 `attractions|regions` 정규식(`nginx.conf:148-152`)에서 attractions 를 떼어 숫자 id 전용 location 으로 나누고, 숫자가 아닌 id 가 어디로 가는지(404)도 함께 정한다.

### 확인된 것 (새 항목)
- **두 번 훑기 메모리**: 투영 7개 필드 × 6만 건은 힙 256MB 에 여유가 있다. 가까운 5곳 계산은 (시군구 × 분류) 묶음 안에서만 하므로 묶음이 작아 비용이 문제되지 않는다.
- **place V22**: 이 워크트리 기준 마지막이 V21 이라 번호 충돌이 없다. 적용된 마이그레이션은 되돌릴 수 없으니 표 모양을 태스크 전에 확정한다는 1차 권고는 유효하다.
- **ClickHouse 직접 읽기**: `analytics.events` 에 `visitor_id` 가 있다(`V005__events_two_axis.sql:34`). V007 은 analytics 기동 때 `ClickHouseSchemaInitializer` 가 한 번 적용한다(`ClickHouseSchemaInitializer.kt:68-69`). ADR-0095 §6 은 소비자가 이 집계 표만 읽는 구조다(`ADR-0095-impression-click-pipeline.md:106-112`).

VERDICT: REVISE
