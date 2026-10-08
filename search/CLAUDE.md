# Search Service

OpenSearch 기반 읽기 전용 검색 모델 서비스 (ADR-0055 로 ES 에서 전환). CDC + Kafka로 상품 데이터를 비동기 인덱싱.
관광지(`attractions` 인덱스)는 place SSOT 를 batch 가 일괄 재색인 — Kafka 미경유 (ADR-0065).
문서 벡터(`embedding`·`embeddingModel`·`embeddingHash`)도 그 재색인이 place `/internal/attractions/embeddings/lookup`
에서 받아 함께 싣는다 (ADR-0090). **`search.embedding.model-ref` 가 비어 있으면 벡터 없이 색인한다** — 첫 채움 전 정상 상태다.
벡터가 없는 문서는 세 필드가 빈 채로 색인되고 BM25 로만 찾힌다 — 재색인은 벡터를 기다리지 않는다.

## Modules

| Gradle path | 역할 | 배포 형태 |
|---|---|---|
| `:search:domain` | Pure Kotlin 도메인 (검색 모델, 포트) | — |
| `:search:app` | REST API 서버 (port 8083) | Deployment (API tier) |
| `:search:consumer` | Kafka 이벤트 소비 → OpenSearch 인덱싱 (port 8084) | Deployment (Worker tier — 벌크 색인이 쿼리 P99 위협, ADR-0025/0058 로 분리 유지) |
| `:search:batch` | 전체 리인덱싱 / 오프라인 평가 | **CronJob** (ADR-0058 — 상주 Deployment 제거, `search-reindex`/`search-eval-daily`/`attraction-reindex`) |

## 구조 상태 (ADR-0083)

표준 준수 (2026-08-26, P3·P4·P7 완료) — 디렉토리 == 패키지, application → infrastructure import 0, presentation → infrastructure 0. `SearchDebugController` 가 직접 들고 있던 OpenSearch·리랭커·프로퍼티 9개는 `SearchDebugPort` + `SearchDebugAdapter` 뒤로 옮겼다(응답 JSON 무변경). 실험 variant 해석은 `SearchVariantPort` 뒤로(실험 on/off·비로그인 판정은 어댑터가 접는다). UseCase 인터페이스 4 · Adapter 4, Port 는 `search:domain` 의 문서화된 예외 위치.

## Commands

```bash
./gradlew :search:app:build        # API 서버 빌드
./gradlew :search:domain:test      # 도메인 테스트
./gradlew :search:consumer:build   # Consumer 빌드
./gradlew :search:batch:build      # Batch 빌드
```

## 인덱스 문서 계약 (ADR-0083 §5-1)

인덱스마다 **쓰기(`:batch`·`:consumer`)와 읽기(`:app`) 문서 클래스가 따로 있고, 합치지 않는다** — 셋은 별개
배포 단위라 클래스를 공유하면 색인 쪽 필드 추가가 검색 API 재배포를 강제하고, 애너테이션 비대칭
(`쓰기 @JsonInclude(NON_NULL)` / `읽기 @JsonIgnoreProperties(ignoreUnknown = true)`)이 그 독립 배포를 가능하게 한다.

**계약의 SSOT 는 클래스가 아니라 `search/batch/src/main/resources/opensearch/*-index.json` 이다.**
읽기 클래스는 `ignoreUnknown = true` 라 필드를 빠뜨려도 컴파일이 통과하고 값만 조용히 빈다 —
`verifyArchitecture` 의 `verifySearchIndexContract` 가 매핑 키와 클래스 필드를 맞춰본다
(쓰기는 정확히 일치, 읽기는 부분집합 + 빠진 이유를 루트 `build.gradle.kts` 의 `searchReadOmitted` 에).
**`searchReadRequired` 에 든 필드는 사유를 적어도 빠질 수 없다** — 지금은 `attractions` 의 `eventStartEffective`·`eventEndEffective`·`courseStops`.
읽기에서 빠지면 진행 중 행사가 「날짜 없음」으로 보이고 코스 절이 사라지는데, 컴파일도 사유 목록도 그걸 못 막는다.

| 인덱스 | 쓰기 | 읽기 | 필드 |
|---|---|---|---|
| `regions` | `RegionIndexDocument` (batch) | `RegionSearchDocument` (app) | 7 / 7 |
| `attractions` | `AttractionIndexDocument` (batch) | `AttractionSearchDocument` (app) | 60 / 49 — 읽기가 안 읽는 11개: 정렬·검색 전용(`idSort`·`titleJamo`), 벡터 3필드, 필터 축(`lclsSystm1~3`·`petAcmpyType`·`setting`), 순위 계수(`clickBoost`). 사유는 `searchReadOmitted` |
| `products` | `ProductIndexDocument` (batch·consumer 2벌) | `ProductSearchDocument` (app) | 26 / 26 |
| `unified` | `UnifiedIndexDocument` (batch) | `UnifiedSearchDocument` (app) | 15 / 14 — `body`(평문)는 검색 전용. **관광지는 안 싣는다** — 6만 벡터를 두 번 실으면 k-NN 메모리가 두 배. 통합 API(`/api/search/unified`)가 `attractions` 와 둘을 부른다 (ADR-0090 D6) |

`ProductIndexDocument` 2벌은 둘 다 쓰기 측이라 분리 근거가 없는 순수 중복이다. 게이트가 드리프트를 잡으므로
**세 번째 사본이 생길 때** 공유 모듈을 만든다(지금 묶으면 두 배포 단위를 다시 붙인다).
`GeoPoint` 는 각 모듈의 top-level — 한쪽 문서의 중첩 타입으로 두면 별개 인덱스가 남의 문서에 묶인다.

## 질의 벡터 — RDB 원천 + 캐시 (ADR-0090 개정 2026-09-08 · 2026-10-08)

질의를 벡터로 바꾼다. **여기 있는 항목은 절대 검색 결과가 되지 않는다** — 답이 되는 것은 문서 벡터뿐이다.
`QueryVectorService` 가 세 층을 순서대로 본다.

1. 프로세스 Caffeine 캐시(10분 · 1만 건). **미적중도 담는다** — 안 담으면 인코딩이 실패하는 질의가 매 요청 DB 와 사이드카를 친다.
2. MySQL `query_vector` 표(`search_db`, `V1__create_query_vector.sql`). 캐시가 아니라 **원천**이라 재기동해도 남는다.
   키는 `(model_ref, normalized)` 유니크, 벡터는 float32 LE 원시 바이트.
3. 상주 사이드카 `search-embed`(harrier-270m · CPU 1코어 · fp32) 인코딩. 만든 값은 즉시 표에 쓴다 — 저장 실패는 삼킨다.

- 셋 다 실패하면 벡터 레그를 끄고 키워드 레그로 답한다. 적중률은 비용 지표이지 가용성 지표가 아니다.
- **정규화는 `QueryNormalizer` 한 곳**이 한다. 도구는 원문을 보낸다 — 규칙이 두 곳이면 키가 어긋나 통째로 미적중이 된다.
  이 함수를 고치면 표 전량 재적재다(`query_text` 원문이 남아 있어 그것으로 다시 만든다).
- 인코딩까지 실패한 질의만 Redis ZSET `search:qmiss:{modelRef}` 에 ZINCRBY. **휘발을 허용한다** — Redis 가 죽어도 검색은 계속된다.
- 내부 API `/internal/query-vectors/{bulk,misses,status}` + `DELETE /misses` — 게이트웨이가 라우팅하지 않는다.
  `bulk` 로 넣은 항목은 그 키만 캐시에서 지운다.
- `search.query-vector.model-ref` 는 **batch 의 `search.embedding.model-ref` 와 한 글자도 달라선 안 된다.**
  비어 있으면 질의 벡터를 아예 쓰지 않는다(첫 채움 전 정상 상태).

## 하이브리드 질의 (ADR-0090 D4)

키워드 레그(지금 것 그대로) 위에 벡터 레그를 얹고 **검색 파이프라인이 순위로 융합**한다(RRF, rank_constant 60).
`search.attraction-hybrid.enabled` 기본 **false** — 사전과 문서 벡터가 다 찬 뒤에 켠다.

- 벡터 레그를 켜는 것은 `SearchQuery.embedding` 하나다. 애플리케이션이 사전에서 받아 채우고,
  어댑터는 받은 벡터로 레그를 얹을 뿐이다 — 어댑터는 사전을 모른다.
- **넷 중 하나라도 아니면 BM25 로 간다**: 기능 켜짐 · 스탬프 설정됨 · 키워드 있음 · 거리순 정렬 아님.
  거리순을 빼는 이유는 정렬이 점수를 무시해 이웃 100개를 훑는 값만 치르고 얻는 것이 없어서다.
- 벡터 레그에 **`embeddingModel` 필터**를 건다. 재색인이 아직 옛 스탬프 문서를 갖고 있으면 다른 벡터
  공간이라 거리가 뜻을 잃는다 — 그 문서는 키워드 레그로만 올라온다. 이것이 스탬프 전환 창의 안전장치다.
- 필터는 **두 레그에 각각** 건다. 하이브리드는 레그별로 후보를 뽑아 합치므로 한쪽에만 걸면
  다른 레그가 필터 밖 문서를 끌어온다.
- `pagination_depth` 를 `from + size`(최소 k)로 준다. **기본값이 10 이라 안 주면 2페이지부터 빈다.**
- **하이브리드 경로에는 정렬을 걸지 않는다.** `_score` 정렬과 tiebreaker 를 함께 주면 OpenSearch 가 거부한다
  (`_score sort criteria cannot be applied with any other criteria`). 기본이 점수 내림차순이라 순서는 같지만
  **동점 시 순서 보장이 사라진다** — RRF 점수가 `1/(60+rank)` 의 합이라 동점이 실제로 생긴다.
  단위 검사는 요청 모양만 보므로 이 규칙을 못 잡는다. 로컬 프로브(`probes/hybrid_spike.py` 케이스 3)가 잡았다.
- `_source.excludes` 로 `embedding` 을 응답에서 뺀다 — **하이브리드가 꺼져 있어도** 뺀다(문서당 4KB).
  매핑에서 빼면 안 된다: 인덱스가 3.4배 커진다(플랜 §8.4 실측).
- 파이프라인은 앱이 기동 시 PUT 으로 만든다(`rrf` 만). 다른 융합 방식은 운영이 만든 것을 쓴다 —
  융합 방식이 미확정(D5-1)이라 코드가 종류를 늘리지 않는다.

## 관광지 상세 서버 렌더 · 속성 · 클릭 신호 (ADR-0103)

- **서버 렌더**: place 호스트 `/(en/)attractions/{id}` 는 portal-fe nginx 가 `/internal/render/(en/)attractions/{id}` 로 프록시하고
  search:app 이 셸(`http://portal-fe/index.html`, 5분 캐시 · 받기 1초 · 실패 뒤 30초 억제)에 메타·JSON-LD·본문을 넣어 낸다.
  `/internal/**` 은 게이트웨이 라우트가 없다. 응답 표지 `X-Render`: `ssr` · `shell-fallback`(색인 조회 실패) · nginx 의 `proxy-fallback`.
  JSON-LD 는 클라이언트(`copy.mjs`)와 **같은 내용**이어야 한다 — `AttractionJsonLdParityTest` 가 portal-fe 골든 픽스처와 대조한다.
  관광지 상세 프리렌더는 없다(지역만 프리렌더).
- **속성 패싯**: 재색인 때 search:domain 순수 함수가 휴무·주차·반려동물(`petPolicy`)·신용카드·유모차·무료 입장을 계산해 싣는다(`UNKNOWN` 은 명시값).
  목록 API 필터 `openToday`·`parking`·`creditCard`·`strollerRental`·`pet`·`admission` — 모르는 값은 400 이 아니라 무시한다.
  건수는 `facets=true` 일 때만 센다(목록 첫 쪽만 요청).
- **클릭 신호**: 재색인이 analytics `attraction_popularity_daily` 에서 14일 고유 클릭 방문자(`uniqueClickers14d`)를 읽어 `clickBoost` 를 싣는다.
  순위 반영은 `search.attraction.click-boost.enabled`(env `SEARCH_ATTRACTION_CLICK_BOOST_ENABLED`, **기본 꺼짐**)이고
  검색어 있는 키워드 레그에만 곱한다. 켜기 전에 `live-eval.py --click-boost-pair` 판정이 「켬」이어야 한다.
- **비슷한 곳**: 재색인이 place `/internal/attractions/similar/lookup` 에서 받아 싣는다 — 재색인 중 kNN 을 돌리지 않는다.

## 행사 상태 · 행사 sitemap (ADR-0104)

- **행사 상태는 저장하지 않는다.** 재색인이 원천 시작일·종료일을 유효 기간으로 정규화해 `eventStartEffective`·`eventEndEffective`(`date`)로 싣고,
  상태(`ONGOING`·`UPCOMING`·`ENDED`·`UNKNOWN`)와 필터 범위(`eventStatus` 다섯)는 search:domain `EventSchedule` 하나가 함께 판정한다.
  범위로 고른 문서에 상태를 다시 매기면 같은 답이 나오는지를 날짜 격자 픽스처가 묶는다. 오늘(KST)은 application 서비스가 `Clock` 으로 넘기고
  렌더러·어댑터는 시계를 읽지 않는다. 만료 `noindex`(종료 + 31일)와 sitemap 유예(종료 + 30일)도 같은 객체가 정한다 — 경계가 두 곳에 있으면 sitemap 의 URL 이 noindex 로 나간다.
- **행사 URL 은 정적 sitemap 에 없다.** place 호스트 `/sitemap-places-events.xml` 을 portal-fe nginx 가 `/internal/render/sitemap/events.xml` 로 넘기고,
  `RenderEventSitemapUseCase`(`EventSitemapService`)가 요청 시점의 오늘로 「행사 ∧ 개요 있음 ∧ 날짜 있음 ∧ 종료 + 30일 ≥ 오늘」만 싣는다.
  **색인 조회 실패는 503 + `no-store`** — 빈 200 은 크롤러에게 행사 URL 이 전부 사라졌다는 뜻이 된다. 메모리 캐시는 두지 않는다.
- 상세 서버 렌더는 유형별 본문(행사 일정·상태 · 숙박 입실·퇴실 · 코스 구성)과 출처 절을 그린다. 제목·설명·JSON-LD 는 `copy.mjs` 와 같은 문자열이어야 하고
  `AttractionJsonLdParityTest` 가 대조한다(코스 이름이 「코스」로 끝나면 「여행코스」 접미를 붙이지 않는 규칙도 양쪽에 있다).

## Key Rules

- **읽기 전용** — OpenSearch 는 Product DB의 읽기 모델, 직접 쓰기 금지
- Kafka 소비 토픽: `product.item.created`, `product.item.updated` (consumer group: `search-indexer`)
- Batch 리인덱싱은 alias swap 방식 — 무중단 전환
- search:domain은 `spring-data-commons`에 의존 (Page/Pageable 포트용)
- 멱등성 패턴 적용 필수 (ADR-0012) — 중복 이벤트 방어

## Docs

- [서비스 상세](docs/service.md) — 아키텍처, 이벤트 흐름, 배치 전략
