---
parent: 19-search-engine
seq: 15
title: msa search 서비스 grounding — 4-모듈 직접 분석, 매핑/스코어링/멱등성/alias swap 점검
type: deep
created: 2026-05-03
---

# 15. msa search 서비스 Grounding

> Phase 3 핵심. §01~§14 의 개념을 msa 의 실제 코드와 매핑해서 강점 / 약점 / 개선 후보 도출.

## 1. 한 줄 핵심

> **msa search 서비스는 BM25 + function_score + alias swap 의 정통 패턴을 따른다.**
> 단, 변동성 필드 색인 (price), 멱등성 명시화 (version_type=external), search_analyzer 분리, multi-field 패턴 등 시니어 의사결정 점검 포인트가 5개 도출됨.

## 2. 모듈 구조 검증

`search/CLAUDE.md` 와 실제 디렉토리 일치:

| Gradle | 역할 | 실제 진입점 |
|---|---|---|
| `:search:domain` | Pure Kotlin 검색 모델 + 포트 | `search/domain/` (모델 / port 인터페이스) |
| `:search:app` | REST API (port 8083) | `search/app/src/.../SearchApplication.kt` |
| `:search:consumer` | Kafka → ES 인덱싱 (port 8084) | `search/consumer/src/.../SearchConsumerApplication.kt` |
| `:search:batch` | 전체 reindex (port 8085, alias swap) | `search/batch/src/.../SearchBatchApplication.kt` |

→ ✅ Clean Architecture 의 hexagonal 패턴 (port + adapter). 책임 분리 명확.
→ ✅ 4-모듈로 read-write 책임 분리 (app=read, consumer/batch=write) → 운영 / 스케일링 독립.

## 3. ProductEsDocument — 매핑 분석

`search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductEsDocument.kt`:

```kotlin
@Document(indexName = "products")
data class ProductEsDocument(
    @Id val id: String,
    @Field(type = FieldType.Text, analyzer = "nori") val name: String,
    @Field(type = FieldType.Double) val price: BigDecimal,
    @Field(type = FieldType.Keyword) val status: String,
    @Field(type = FieldType.Date, ...) val createdAt: LocalDateTime,
    @Field(type = FieldType.Double) val popularityScore: Double,
    @Field(type = FieldType.Double) val ctr: Double,
    @Field(type = FieldType.Double) val cvr: Double,
    @Field(type = FieldType.Long) val scoreUpdatedAt: Long
)
```

### 3-1. 강점

- ✅ `name` 에 nori analyzer 적용 (한국어 형태소, §05)
- ✅ `status` keyword (정확 매칭 / filter 용, §07)
- ✅ `popularity / ctr / cvr` 분리 — function_score 결합 가능 (§06)
- ✅ `scoreUpdatedAt` 으로 partial update 추적 가능

### 3-2. 점검 포인트 (§01~§14 기준)

#### ⚠ 점검 1: 변동성 필드 (`price`) ES 색인 — Two-Phase Lookup 원칙

영상 요약 + §01 §14 원칙: "변동성 큰 필드 (가격/재고) 는 ES 에 색인 ❌, RDB 에서 fetch".

현재: `price` 가 ES 에 있음.
- 가격 변경 빈도 ↑ → product 이벤트 폭증 → ES 인덱싱 부하 ↑
- 검색 결과의 가격이 stale 가능 (사용자 lag)

판단:
- 가격 변경이 드물면 (월 1회 미만) OK
- 가격 변경이 잦으면 (시간/일 단위) → ES 에서 빼고 RDB fetch (Two-Phase Lookup)
- 가격 range filter 가 검색에 필수면 ES 유지 (range 필터는 ES 가 빠름) — 트레이드오프

→ **§19 ADR 후보 1**: "변동성 큰 필드 ES 색인 컨벤션".

#### ⚠ 점검 2: search_analyzer 분리 ❌

```
@Field(type = Text, analyzer = "nori")
```

→ `analyzer` 만 정의, `search_analyzer` 없음 → 인덱싱과 검색에 같은 analyzer 적용.

문제 시점:
- synonym 추가 시 → indexing 에 적용되면 reindex 필요
- edge_ngram 자동완성 추가 시 → 검색어도 ngram 화 → 매칭 폭증

현 시점: synonym / ngram 미사용 → 큰 문제 없음.
미래: 동의어 도입 시 search_analyzer 분리 (§04 §05).

#### ⚠ 점검 3: multi-field (`name.raw` keyword) 미설정

```
@Field(type = Text, analyzer = "nori")  // text only
```

→ `name` 으로 sort / aggregation / 정확 매칭 ❌.

추가 권장:
```kotlin
@MultiField(
    mainField = Field(type = Text, analyzer = "nori"),
    otherFields = [InnerField(suffix = "raw", type = Keyword)]
)
val name: String
```

→ `name` (BM25) + `name.raw` (정확 매칭 / sort / agg) 동시 색인.

#### ⚠ 점검 4: createdAt 의 date 패턴

```
@Field(type = Date, format = [], pattern = ["yyyy-MM-dd'T'HH:mm:ss"])
```

→ ISO 표준 그대로. 시간대 (Timezone) 미명시 — UTC vs KST 일관성 점검 필요.

#### ⚠ 점검 5: vector / 임베딩 필드 ❌

→ Hybrid Search (§09) 미적용. 의미 기반 검색 / 자연어 질문 ("접히는 폰") 처리 ❌.
→ §18 의 PoC 기회.

## 4. ProductSearchAdapter — 검색 쿼리 분석

`search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductSearchAdapter.kt:21-73`:

```kotlin
override fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
    val query = NativeQuery.builder()
        .withQuery { q ->
            q.functionScore { fs ->
                fs.query { inner ->
                    inner.bool { b ->
                        b.must { m ->
                            m.match { mt ->
                                mt.field("name").query(keyword)
                            }
                        }
                        b.filter { f ->
                            f.term { t ->
                                t.field("status").value("ACTIVE")
                            }
                        }
                    }
                }
                fs.functions { fn ->
                    fn.fieldValueFactor { fvf ->
                        fvf.field("popularityScore")
                            .factor(rankingProperties.popularityWeight)
                            .modifier(FieldValueFactorModifier.Log1p)
                            .missing(0.0)
                    }
                    fn.weight(1.0)
                }
                fs.functions { fn ->
                    fn.fieldValueFactor { fvf ->
                        fvf.field("ctr")
                            .factor(rankingProperties.ctrWeight)
                            .modifier(FieldValueFactorModifier.Log1p)
                            .missing(0.0)
                    }
                    fn.weight(1.0)
                }
                fs.scoreMode(FunctionScoreMode.Sum)
                fs.boostMode(FunctionBoostMode.Sum)
            }
        }
        .withPageable(pageable)
        .build()
    ...
}
```

### 4-1. 강점

- ✅ **filter / query 분리 정확** (§07): `status=ACTIVE` 는 filter context (캐시 + score X), `name` 매칭은 query context
- ✅ **function_score 패턴** (§06): popularityScore + ctr 결합, log1p modifier (saturation 방지)
- ✅ **`missing(0.0)`** — null safe (점수 계산 NPE 방지)
- ✅ **RankingProperties 외부화** — 가중치를 코드 박지 않고 config 로 분리 → A/B 테스트 가능
- ✅ **scoreMode + boostMode = Sum** — function 끼리 합 + query 와도 합. 명시적

### 4-2. 점검 포인트

#### ⚠ 점검 6: multi_match / 다중 필드 검색 ❌

→ `name` 만 검색. `description`, `tags`, `category` 등 다중 필드 매칭 안 함.
→ "갤럭시" 검색이 description 의 "갤럭시 시리즈" 와 매칭 ❌.
→ multi_match (§07) 적용 권장.

#### ⚠ 점검 7: cvr 미사용

ProductEsDocument 에 `cvr` 정의되어 있지만 검색 score 에 미반영. 의도적 보류면 OK, 누락이면 추가.

#### ⚠ 점검 8: boost_mode = Sum

→ `(BM25 score) + (functions sum)`. multiply 가 더 일반적이지만 sum 도 정상.
→ 도메인 의도에 따라 검토 (sum: 함수가 BM25 와 독립 가산, multiply: BM25 가 함수에 곱셈 작용).

#### ⚠ 점검 9: pagination 방식

→ `pageable` 사용 (Spring Data) → from + size 방식. 깊은 페이지 (예: 1000+) 시 max_result_window 제한.
→ 무한 스크롤 / 깊은 페이지 필요하면 search_after 마이그레이션 (§07).

#### ⚠ 점검 10: 캐시 / 성능

- query cache 활용 → filter 만 캐시. `status=ACTIVE` 캐시 ✅
- 성능 측정 (`profile: true`) 코드 없음 → 운영 시 별도 활용 필요

## 5. EsBulkDocumentProcessor — 인덱싱 분석

`search/consumer/src/main/kotlin/com/kgd/search/infrastructure/indexing/EsBulkDocumentProcessor.kt`:

### 5-1. 강점

- ✅ **BulkIngester 사용** (Elastic 공식 helper) — 자동 배치 / flush
- ✅ **이중 Ingester (primary + retry)** — 첫 시도 실패 시 retry 로 분리. DLQ 패턴의 일종
  - primary: 1000 ops, 5s flush
  - retry: 500 ops, 3s flush
- ✅ **partial failure 처리** — bulk 응답에서 item 별 error 확인 후 retry 전송
- ✅ **메트릭 (processedCount, errorCount)** — AtomicLong 으로 thread-safe
- ✅ **DisposableBean** — graceful shutdown 시 ingester close
- ✅ **로깅** — debug (성공) / error (실패)

### 5-2. 점검 포인트 (§14 기준)

#### ⚠ 점검 11: 멱등성 (`version_type=external`) ❌

```kotlin
op.index { idx ->
    idx.index(indexName).id(document.id).document(docMap)
}
```

→ version 없음. **out-of-order 메시지가 새 doc 을 덮어쓸 가능**.

`search/CLAUDE.md` 가 "멱등성 패턴 적용 필수 (ADR-0012)" 명시했지만 코드에 명시 ❌.

가능성:
- ADR-0012 가 다른 패턴 (processed event log 등) 으로 보장
- ScoreUpdateEvent 같은 별도 path 에서 보장
- 또는 누락 (개선 후보)

→ **§19 ADR 후보 2**: "ES 인덱싱에 version_type=external 명시화 컨벤션".

#### ⚠ 점검 12: refresh policy

→ default (`?refresh=false`) 추정. bulk 후 1s refresh 자연 처리. ✅
→ 단, 사용자 직접 액션 후 즉시 노출 시나리오면 wait_for 검토.

#### ⚠ 점검 13: retry 전략

- retry ingester 로 1번 더 시도 → 그래도 실패면 errorCount 증가만, 별도 처리 ❌
- DLQ (Kafka 등) 로 영구 실패 메시지 백업 권장

#### ⚠ 점검 14: ScoreUpdateEvent 분리

`search/consumer/src/main/kotlin/com/kgd/search/infrastructure/messaging/ScoreUpdateEvent.kt` 존재 → popularity/ctr/cvr 같은 자주 변경되는 필드를 별도 이벤트로 분리한 듯.

→ ✅ partial update 패턴. 전체 doc reindex 보다 효율적.
→ 단, ES 의 update API 사용 시 refresh / version 처리 별도 필요.

## 6. ReindexJobExecutionListener — Alias Swap 분석

`search/batch/src/main/kotlin/com/kgd/search/job/ReindexJobExecutionListener.kt`:

```kotlin
override fun beforeJob(jobExecution: JobExecution) {
    val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
    aliasManager.createIndex(newIndexName)
    jobExecution.executionContext.putString(NEW_INDEX_NAME_KEY, newIndexName)
    log.info("Created new index for reindex: {}", newIndexName)
}

override fun afterJob(jobExecution: JobExecution) {
    if (jobExecution.status != BatchStatus.COMPLETED) {
        log.warn("Job did not complete successfully ({}), skipping alias swap", jobExecution.status)
        return
    }
    val newIndexName = jobExecution.executionContext.getString(NEW_INDEX_NAME_KEY)
    bulkProcessor.flush()
    aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
    log.info("Alias swap complete: {} → {} errors", newIndexName, bulkProcessor.errorCount.get())
}
```

### 6-1. 강점 (§13 정통 패턴)

- ✅ **timestamped 새 인덱스** — `products_v20260503...` 패턴
- ✅ **batch 실패 시 alias swap 스킵** — 부분 reindex 노출 방지
- ✅ **bulkProcessor.flush()** — 인덱싱 완료 보장 후 swap
- ✅ **updateAliasAndCleanup** — atomic alias 변경 + 옛 인덱스 정리

### 6-2. 점검 포인트

#### ⚠ 점검 15: refresh_interval / replica 토글

`refresh_interval=-1` + `replica=0` 인덱싱 중 패턴 (§13) 명시 ❌ (코드에 안 보임).

검토:
- `IndexAliasManager.createIndex` 가 settings 로 처리할 수도
- 안 하면 인덱싱 throughput 손실 (refresh / replica 인덱싱 부하)

→ §13 패턴대로 `createIndex` 시 토글 + `afterJob` 에서 복구.

#### ⚠ 점검 16: 검증 / 카나리

→ alias swap 직후 옛 인덱스 즉시 cleanup. **검증 단계 ❌**.
→ 권장: swap 후 일정 시간 (예: 1시간) 옛 인덱스 보관 → 사용자 메트릭 정상 확인 후 cleanup.

#### ⚠ 점검 17: ProductApiReindexJobConfig vs ProductDbReindexJobConfig

→ 두 가지 reindex 모드 (API 호출 vs DB 직접)? 의도 분리 명확한지 검증.

## 7. CLAUDE.md 의 "CDC + Kafka" 검증

`search/CLAUDE.md` 명시: "CDC + Kafka로 상품 데이터를 비동기 인덱싱".

검증:
- Kafka topics: `product.item.created`, `product.item.updated` (consumer group: `search-indexer`) ✅
- CDC (Debezium) 사용? → 직접 확인 필요. product 서비스가 outbox 패턴인지 Debezium 기반인지.
- product 서비스의 outbox / Debezium 코드 확인 (별도 grounding 필요)

→ §14 의 Outbox vs CDC 결정이 msa 어디에 적용됐는지 ADR / product/CLAUDE.md 확인 권장.

## 8. ES vs OpenSearch 사용 확인

코드 import: `co.elastic.clients.elasticsearch.*`

→ **Elasticsearch 8.x client 사용** (OpenSearch 미사용).
→ `k8s/infra/local/` 에 OpenSearch 도 있다면 **사용 안 함**, 일원화 ADR 가치 ↑.

→ **§19 ADR 후보 3**: "ES 일원화 — OpenSearch 인프라 제거 또는 명시적 분리".

## 9. 종합 — 강점 vs 점검 포인트

### 강점 (정통 패턴 준수)

| # | 강점 |
|---|---|
| ✅ 1 | Clean Architecture 4-모듈 (port + adapter) |
| ✅ 2 | nori analyzer (한국어) |
| ✅ 3 | filter / query context 분리 정확 |
| ✅ 4 | function_score (popularity + ctr) 패턴 |
| ✅ 5 | RankingProperties 외부화 (튜닝 가능) |
| ✅ 6 | BulkIngester + 이중 (primary + retry) |
| ✅ 7 | partial failure 처리 |
| ✅ 8 | alias swap reindex (무중단) |
| ✅ 9 | batch 실패 시 swap 스킵 (안전) |
| ✅ 10 | ScoreUpdateEvent 로 partial update 분리 |

### 점검 포인트 (개선 후보)

| # | 점검 | 우선순위 |
|---|---|---|
| ⚠ 1 | price 변동성 필드 색인 — Two-Phase Lookup 원칙 | 높음 (도메인 의존) |
| ⚠ 2 | search_analyzer 분리 ❌ | 낮음 (synonym 미사용) |
| ⚠ 3 | multi-field (`name.raw` keyword) ❌ | 중간 (sort/agg 필요시) |
| ⚠ 4 | createdAt timezone 명시 X | 낮음 |
| ⚠ 5 | vector / 임베딩 필드 ❌ → Hybrid 미적용 | 중간 (가치 있음) |
| ⚠ 6 | multi_match / 다중 필드 ❌ | 중간 |
| ⚠ 7 | cvr 미사용 | 낮음 |
| ⚠ 8 | boost_mode=Sum (vs Multiply) | 낮음 (의도 확인) |
| ⚠ 9 | pagination from+size (vs search_after) | 중간 (깊은 페이지 시) |
| ⚠ 10 | profile API 활용 X | 낮음 (운영 도구) |
| ⚠ 11 | version_type=external 명시 ❌ | 높음 (멱등성) |
| ⚠ 12 | refresh policy 명시 X | 낮음 |
| ⚠ 13 | retry 후 DLQ ❌ | 중간 (영구 실패 추적) |
| ⚠ 14 | ScoreUpdateEvent 의 update API + version | 중간 |
| ⚠ 15 | reindex 시 refresh/replica 토글 ❌ | 중간 (throughput) |
| ⚠ 16 | alias swap 후 검증 단계 ❌ | 중간 (안전성) |
| ⚠ 17 | API vs DB reindex 두 모드 의도 | 낮음 |

## 10. ADR 후보 매핑

§19 의 4 ADR 후보로 승격:

| ADR 후보 | 점검 포인트 매핑 |
|---|---|
| **1. ES vs OpenSearch 일원화** | §8 (OpenSearch 미사용 확인 → 인프라 제거) |
| **2. 변동성 필드 ES 색인 금지 컨벤션** | ⚠1 (price) |
| **3. 색인 lag SLA + ADR-0025 보강** | §14 의 lag 측정 / SLA 정의 |
| **4. Hybrid Search 도입** | ⚠5 (vector) + §09 |

추가 ADR 후보 (점검 결과):
- "ES 인덱싱 멱등성 표준 — version_type=external 컨벤션" (⚠11)
- "검색 인덱스 매핑 표준 — multi-field, search_analyzer" (⚠2, ⚠3)
- "DLQ 표준 — 영구 실패 메시지 처리" (⚠13)

→ §19 deep file 에서 통합 정리.

## 11. 추가 탐색 필요 항목

본 §15 에서는 시간상 다음은 별도 탐색 권장:

- `IndexAliasManager` 의 createIndex / updateAliasAndCleanup 구현 (settings / replica 토글 여부)
- `ProductApiReindexJobConfig` vs `ProductDbReindexJobConfig` 의 차이
- `ScoreUpdateEvent` consumer 의 update API 사용 / version 처리
- `KafkaConsumerConfig` 의 retry / DLQ / consumer group 설정
- `RankingProperties` 의 외부 설정 (yml) — 현재 가중치
- product 서비스의 outbox / CDC (Debezium) 사용 여부
- application-kubernetes.yml — ES endpoint, refresh, timeout 설정

→ 운영 점검 / 개선 작업 시 우선 확인 대상.

## 12. 다음 학습

- [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) — 운영 / 모니터링 / RTO 측정
- [17-k8s-failure-simulation.md](17-k8s-failure-simulation.md) — 장애 시뮬레이션 절차
- [18-hybrid-search-poc.md](18-hybrid-search-poc.md) — vector + RRF 부분 PoC
- [19-improvements.md](19-improvements.md) — 본 §15 의 점검 포인트를 ADR 4건으로 통합

> **§15 회독 체크리스트**:
> - [ ] msa search 의 4-모듈 책임 분리를 답할 수 있다
> - [ ] ProductEsDocument 매핑의 강점 5개 / 점검 포인트 5개
> - [ ] ProductSearchAdapter 의 function_score 결합 방식
> - [ ] EsBulkDocumentProcessor 의 이중 ingester 패턴 (primary + retry)
> - [ ] ReindexJobExecutionListener 의 alias swap 흐름
> - [ ] 도출된 ADR 후보 4건 + 추가 3건
