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

| 인덱스 | 쓰기 | 읽기 | 필드 |
|---|---|---|---|
| `regions` | `RegionIndexDocument` (batch) | `RegionSearchDocument` (app) | 7 / 7 |
| `attractions` | `AttractionIndexDocument` (batch) | `AttractionSearchDocument` (app) | 24 / 19 — `idSort`·`titleJamo` + 벡터 3필드가 쓰기 전용 |
| `products` | `ProductIndexDocument` (batch·consumer 2벌) | `ProductSearchDocument` (app) | 26 / 26 |
| `query_vectors` | `QueryVectorDocument` (app) | 같은 클래스 | 7 / 7 — 재색인이 없어 넣는 쪽과 읽는 쪽이 한 앱이다 |

`ProductIndexDocument` 2벌은 둘 다 쓰기 측이라 분리 근거가 없는 순수 중복이다. 게이트가 드리프트를 잡으므로
**세 번째 사본이 생길 때** 공유 모듈을 만든다(지금 묶으면 두 배포 단위를 다시 붙인다).
`GeoPoint` 는 각 모듈의 top-level — 한쪽 문서의 중첩 타입으로 두면 별개 인덱스가 남의 문서에 묶인다.

## 질의 사전 `query_vectors` (ADR-0090)

질의를 벡터로 바꾸는 표. **여기 있는 항목은 절대 검색 결과가 되지 않는다** — 답이 되는 것은 문서 벡터뿐이고,
그래서 별도 인덱스에 두고 `vector` 를 `binary`(base64 float32)로 박는다. 검색하지 않고 **id 로만** 읽는다
(`_id = "{modelRef}|{normalized}"`).

- **2026-09-08 개정: 질의는 상주 사이드카(`search-embed`, harrier-270m · CPU 1코어 · fp32)가 실시간 인코딩한다.**
  이 인덱스는 **캐시로 강등**됐다 — 적중하면 조회 1회로 끝나고, 미적중은 사이드카가 채운다.
  사이드카가 죽으면 벡터 레그를 끄고 BM25 로 답한다. 적중률은 비용 지표이지 가용성 지표가 아니다.
- **정규화는 `QueryNormalizer` 한 곳**이 한다. 도구는 원문을 보낸다 — 규칙이 두 곳에 있으면 `_id` 가
  어긋나 사전이 통째로 미적중이 된다. 이 함수를 고치면 **사전 전량 재적재**다(도구가 원문을 갖고 있어 모델은 안 돌린다).
- 미적중은 Redis ZSET `search:qmiss:{modelRef}` 에 ZINCRBY. **휘발을 허용한다** — 날아가도 하루치뿐이고,
  그래서 Redis 가 죽어도 검색은 계속된다(기록 실패를 삼킨다).
- 인덱스는 앱이 기동 시 **멱등**으로 만든다(`QueryVectorIndexInitializer`). 못 만들어도 앱은 뜬다 —
  여기서 기동을 막으면 OpenSearch 가 늦게 뜬 날 검색 전체가 죽는다.
- 내부 API `/internal/query-vectors/{bulk,misses,status}` + `DELETE /misses` — 게이트웨이가 라우팅하지 않는다.
- `search.query-vector.model-ref` 는 **batch 의 `search.embedding.model-ref` 와 한 글자도 달라선 안 된다.**
  비어 있으면 사전을 아예 쓰지 않는다(첫 채움 전 정상 상태).

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

## Key Rules

- **읽기 전용** — OpenSearch 는 Product DB의 읽기 모델, 직접 쓰기 금지
- Kafka 소비 토픽: `product.item.created`, `product.item.updated` (consumer group: `search-indexer`)
- Batch 리인덱싱은 alias swap 방식 — 무중단 전환
- search:domain은 `spring-data-commons`에 의존 (Page/Pageable 포트용)
- 멱등성 패턴 적용 필수 (ADR-0012) — 중복 이벤트 방어

## Docs

- [서비스 상세](docs/service.md) — 아키텍처, 이벤트 흐름, 배치 전략
