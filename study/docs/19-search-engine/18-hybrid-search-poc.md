---
parent: 19-search-engine
seq: 18
title: Hybrid Search PoC — msa search 서비스에 BM25 + Dense Vector + RRF 부분 적용 코드
type: deep
created: 2026-05-03
---

# 18. Hybrid Search PoC

> 묶음 2 (A) 의 종합 적용. msa search 서비스 (`product` 검색) 에 hybrid (BM25 (Best Match 25) + dense_vector + RRF (Reciprocal Rank Fusion, 상호 순위 융합)) 를 한 endpoint 만 부분 PoC. 전면 도입은 §19 ADR (Architecture Decision Record, 아키텍처 결정 기록) 후 별도 결정.

## 1. 한 줄 핵심

> **PoC 의 목표 = "기술적으로 가능한지" + "검색 품질 향상이 측정되는지" 둘 다 검증.**
> 본 PoC 는 코드 변경을 최소화 (기존 ProductEsDocument 에 vector 필드 추가, 새 endpoint `/search/hybrid` 분리).

## 2. PoC Scope

### 2-1. In Scope

- ProductEsDocument 에 `embedding` (dense_vector) 필드 추가
- search:consumer 가 인덱싱 시 임베딩 생성 (외부 API 호출)
- search:app 에 새 endpoint `/search/hybrid` 추가 (기존 `/search` 유지)
- ES 의 retriever / RRF 활용
- 평가: BM25 only vs Hybrid 비교 (sample query)

### 2-2. Out of Scope

- 전면 전환 (모든 검색 hybrid)
- LTR / cross-encoder rerank (§10)
- 임베딩 모델 self-host (외부 API 가정)
- A/B 플랫폼 통합 (PoC 후)

### 2-3. 가정

- 임베딩 모델: **bge-m3** (외부 API 또는 self-host. PoC 는 OpenAI text-embedding-3-small 도 가능)
- ES 8.8+ (retriever / RRF native)
- product 100만 건 가정 → 메모리 약 3~6GB (bge-m3 1024 차원 기준)

## 3. 매핑 변경

### 3-1. ProductEsDocument 확장

```kotlin
// search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductEsDocument.kt
@Document(indexName = "products")
data class ProductEsDocument(
    @Id val id: String,
    @MultiField(
        mainField = Field(type = FieldType.Text, analyzer = "nori"),
        otherFields = [InnerField(suffix = "raw", type = FieldType.Keyword)]
    )
    val name: String,
    @Field(type = FieldType.Double) val price: BigDecimal,
    @Field(type = FieldType.Keyword) val status: String,
    @Field(type = FieldType.Date, format = [], pattern = ["yyyy-MM-dd'T'HH:mm:ss"])
    val createdAt: LocalDateTime,
    @Field(type = FieldType.Double) val popularityScore: Double,
    @Field(type = FieldType.Double) val ctr: Double,
    @Field(type = FieldType.Double) val cvr: Double,
    @Field(type = FieldType.Long) val scoreUpdatedAt: Long,
    
    // 추가: 임베딩 필드
    @Field(
        type = FieldType.Dense_Vector,
        dims = 1024,
        index = true
    )
    val nameEmbedding: FloatArray? = null,
    
    // 임베딩 모델 메모 (변경 추적)
    @Field(type = FieldType.Keyword) val embeddingModel: String = "bge-m3-v1"
)
```

→ 기존 필드 유지 + `nameEmbedding` 추가. **mapping 변경 = reindex 필요** (§13).

### 3-2. 인덱스 settings (ES native API)

```json
PUT /products_v_with_vector
{
  "settings": {
    "index": {
      "number_of_shards": 1,
      "number_of_replicas": 0,    // PoC 는 0
      "refresh_interval": "1s",
      "knn": true                 // OpenSearch 면 필수
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": {
        "type": "text",
        "analyzer": "nori",
        "fields": {
          "raw": { "type": "keyword" }
        }
      },
      "price": { "type": "double" },
      "status": { "type": "keyword" },
      "createdAt": { "type": "date", "format": "yyyy-MM-dd'T'HH:mm:ss" },
      "popularityScore": { "type": "double" },
      "ctr": { "type": "double" },
      "cvr": { "type": "double" },
      "scoreUpdatedAt": { "type": "long" },
      "nameEmbedding": {
        "type": "dense_vector",
        "dims": 1024,
        "index": true,
        "similarity": "cosine",
        "index_options": {
          "type": "hnsw",
          "m": 16,
          "ef_construction": 100
        }
      },
      "embeddingModel": { "type": "keyword" }
    }
  }
}
```

## 4. 임베딩 클라이언트 추상화

### 4-1. 인터페이스 (port)

```kotlin
// search/domain/src/main/kotlin/com/kgd/search/domain/port/EmbeddingPort.kt
package com.kgd.search.domain.product.port

interface EmbeddingPort {
    suspend fun embed(text: String): FloatArray
    fun model(): String   // "bge-m3-v1" 등
}
```

### 4-2. 구현 (외부 API 가정)

```kotlin
// search/consumer/src/main/kotlin/com/kgd/search/infrastructure/embedding/BgeEmbeddingAdapter.kt
@Component
@ConditionalOnProperty(name = ["search.embedding.enabled"], havingValue = "true")
class BgeEmbeddingAdapter(
    private val webClient: WebClient,
    @Value("\${search.embedding.url}") private val embeddingUrl: String,
    @Value("\${search.embedding.model:bge-m3-v1}") private val modelName: String
) : EmbeddingPort {
    
    override suspend fun embed(text: String): FloatArray {
        val response = webClient.post()
            .uri("$embeddingUrl/embed")
            .bodyValue(EmbeddingRequest(text = text, model = modelName))
            .retrieve()
            .awaitBody<EmbeddingResponse>()
        return response.embedding
    }
    
    override fun model(): String = modelName
    
    data class EmbeddingRequest(val text: String, val model: String)
    data class EmbeddingResponse(val embedding: FloatArray)
}
```

### 4-3. self-host 옵션 (FastAPI + sentence-transformers)

```python
# embedding-service/app.py
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()
model = SentenceTransformer("BAAI/bge-m3")

class EmbedReq(BaseModel):
    text: str

@app.post("/embed")
def embed(req: EmbedReq):
    vec = model.encode(req.text, normalize_embeddings=True).tolist()
    return {"embedding": vec}
```

→ K8s 에 별도 service 로 배포 (search 외부).

## 5. 인덱싱 변경 (Consumer)

### 5-1. 임베딩 생성 추가

```kotlin
// search/consumer/src/main/kotlin/com/kgd/search/infrastructure/messaging/ProductIndexingConsumer.kt
@Component
class ProductIndexingConsumer(
    private val bulkProcessor: EsBulkDocumentProcessor,
    private val embeddingPort: EmbeddingPort?    // optional (PoC)
) {
    
    @KafkaListener(topics = ["product.item.created", "product.item.updated"])
    suspend fun handle(event: ProductEvent) {
        val doc = event.toDomain()
        
        // PoC: 임베딩 추가
        val docWithEmbedding = if (embeddingPort != null) {
            val embedding = embeddingPort.embed(doc.name)
            doc.copy(
                nameEmbedding = embedding,
                embeddingModel = embeddingPort.model()
            )
        } else {
            doc
        }
        
        bulkProcessor.processDocument("products_v_with_vector", docWithEmbedding)
    }
}
```

### 5-2. 비용 / throughput 영향

- 임베딩 API 호출 ~ 100~500ms / doc (외부 API)
- 인덱싱 throughput → 임베딩이 병목
- 해법:
  - bulk 임베딩 API (한 번 호출에 N text)
  - 비동기 + 병렬 (최대 N concurrent)
  - 자체 호스팅 + GPU (latency ↓)

## 6. 검색 endpoint 추가 (App)

### 6-1. 기존 endpoint 유지

```kotlin
// search/app/src/main/kotlin/com/kgd/search/api/SearchController.kt
@RestController
@RequestMapping("/search")
class SearchController(
    private val productSearchPort: ProductSearchPort,            // 기존 BM25
    private val hybridSearchPort: HybridProductSearchPort?       // PoC, optional
) {
    
    @GetMapping
    fun search(
        @RequestParam keyword: String,
        pageable: Pageable
    ): Page<ProductDocument> {
        return productSearchPort.search(keyword, pageable)
    }
    
    @GetMapping("/hybrid")
    fun hybridSearch(
        @RequestParam keyword: String,
        pageable: Pageable
    ): Page<ProductDocument> {
        return hybridSearchPort?.search(keyword, pageable)
            ?: throw NotImplementedException("Hybrid search not enabled")
    }
}
```

### 6-2. Hybrid Adapter

```kotlin
// search/app/src/main/kotlin/com/kgd/search/elasticsearch/HybridProductSearchAdapter.kt
@Component
@ConditionalOnProperty(name = ["search.hybrid.enabled"], havingValue = "true")
class HybridProductSearchAdapter(
    private val esClient: ElasticsearchClient,
    private val embeddingPort: EmbeddingPort,
    private val rankingProperties: RankingProperties
) : HybridProductSearchPort {
    
    override suspend fun search(keyword: String, pageable: Pageable): Page<ProductDocument> {
        // 1. 쿼리 임베딩 생성
        val queryEmbedding = embeddingPort.embed(keyword)
        
        // 2. ES retriever (RRF) — 8.8+ 문법
        val request = SearchRequest.of { req ->
            req.index("products")
                .from(pageable.offset.toInt())
                .size(pageable.pageSize)
                .retriever { r ->
                    r.rrf { rrf ->
                        // BM25 retriever
                        rrf.retrievers { ret1 ->
                            ret1.standard { std ->
                                std.query { q ->
                                    q.bool { b ->
                                        b.must { m ->
                                            m.match { mt -> mt.field("name").query(keyword) }
                                        }
                                        b.filter { f ->
                                            f.term { t -> t.field("status").value("ACTIVE") }
                                        }
                                    }
                                }
                            }
                        }
                        // kNN retriever
                        rrf.retrievers { ret2 ->
                            ret2.knn { knn ->
                                knn.field("nameEmbedding")
                                    .queryVector(queryEmbedding.toList())
                                    .k(50)
                                    .numCandidates(200)
                                    .filter { f ->
                                        f.term { t -> t.field("status").value("ACTIVE") }
                                    }
                            }
                        }
                        rrf.rankWindowSize(100)
                        rrf.rankConstant(60)
                    }
                }
        }
        
        val response = esClient.search(request, ProductEsDocument::class.java)
        val docs = response.hits().hits().map { it.source()!!.toDomain() }
        return PageImpl(docs, pageable, response.hits().total()?.value() ?: 0)
    }
}
```

### 6-3. 도메인 port 정의

```kotlin
// search/domain/src/main/kotlin/com/kgd/search/domain/product/port/HybridProductSearchPort.kt
interface HybridProductSearchPort {
    suspend fun search(keyword: String, pageable: Pageable): Page<ProductDocument>
}
```

## 7. 설정 (`application.yml`)

```yaml
# search/app/src/main/resources/application.yml
search:
  embedding:
    enabled: true
    url: http://embedding-service.search.svc.cluster.local:8000
    model: bge-m3-v1
  hybrid:
    enabled: true
  ranking:
    popularity-weight: 1.0
    ctr-weight: 1.5
```

## 8. K8s 매니페스트

```yaml
# k8s/overlays/k3s-lite/embedding-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-service
  namespace: search
spec:
  replicas: 2
  selector:
    matchLabels:
      app: embedding-service
  template:
    metadata:
      labels:
        app: embedding-service
    spec:
      containers:
      - name: embedding
        image: commerce/embedding-service:latest
        ports:
        - containerPort: 8000
        resources:
          requests: { cpu: "1", memory: "2Gi" }
          limits: { cpu: "4", memory: "4Gi" }
---
apiVersion: v1
kind: Service
metadata:
  name: embedding-service
  namespace: search
spec:
  selector:
    app: embedding-service
  ports:
  - port: 8000
    targetPort: 8000
```

→ FastAPI + sentence-transformers self-host. CPU 만으로도 충분 (bge-m3-small).

## 9. 평가 / A/B 비교

### 9-1. 메트릭

```kotlin
// 같은 keyword 로 BM25 only vs Hybrid 비교
val bm25Result = productSearchPort.search(keyword, PageRequest.of(0, 10))
val hybridResult = hybridSearchPort.search(keyword, PageRequest.of(0, 10))

// 측정 항목
// - top-10 의 doc id 차이
// - 어느 query 에서 hybrid 가 차이를 만드는가
// - latency 비교 (BM25 vs hybrid)
```

### 9-2. 정성 평가 시나리오

| Query 유형 | 예시 | 예상 hybrid 효과 |
|---|---|---|
| 정확 키워드 | "갤럭시 폴드" | BM25 와 같음 (RRF 안정) |
| 동의어 | "핸드폰" → "스마트폰" | hybrid ↑ |
| 자연어 | "접히는 화면 폰" | hybrid ↑↑ |
| 오타 | "갤력시" | BM25 약간 (fuzzy), hybrid 더 나음 |
| 신상품 | "신상" | BM25 (function_score) ↑ |
| 카테고리 | "smartphone" | BM25 ↑, vector 약 |

### 9-3. 정량 평가 (Rank Eval API)

```http
POST /products/_rank_eval
{
  "requests": [
    {
      "id": "갤럭시 폴드",
      "request": { "query": { "match": { "name": "갤럭시 폴드" } } },
      "ratings": [
        { "_id": "p001", "rating": 3 },
        { "_id": "p002", "rating": 2 }
      ]
    },
    ...
  ],
  "metric": { "dcg": { "k": 10, "normalize": true } }
}
```

→ judgment list 미리 준비 (도메인 전문가 + 클릭 로그). nDCG 비교.

### 9-4. A/B 플랫폼 통합 (확장 시)

msa 의 `experiment` 서비스 활용:
- traffic 50:50 분할
- group A: `/search` (BM25)
- group B: `/search/hybrid` (hybrid)
- CTR / CVR / 검색 만족도 비교

## 10. PoC 결과 측정 템플릿

```markdown
# Hybrid Search PoC 결과 — 2026-05-XX

## 환경
- 인덱스: products_v_with_vector (10만 doc 가정)
- 임베딩: bge-m3 (1024차원)
- ES: 8.x, retriever + RRF

## 비용
- 인덱싱 throughput: BM25 only 10K doc/sec → hybrid 1K doc/sec (10배 ↓)
- 메모리 사용: +500MB (HNSW 그래프)
- 디스크: +400MB (vector storage)
- 임베딩 latency: 평균 50ms / doc (self-host CPU)

## 검색 품질
- 정확 키워드 query (10개): nDCG@10 동일 (0.85 = 0.85)
- 동의어 query (10개): nDCG@10 0.61 → 0.78 (+27%)
- 자연어 query (10개): nDCG@10 0.42 → 0.71 (+69%)

## 검색 latency
- BM25 P99: 50ms
- Hybrid P99: 120ms (임베딩 추론 50ms + ES 검색 70ms)

## 결론
- 자연어 / 동의어 검색에 hybrid 효과 명확
- 비용 (throughput 10배 ↓, latency 2.4배 ↑) 감수 가능
- 권장: 일부 카테고리 (가전, 의류) 부터 단계 도입 → A/B 후 확대
```

## 11. PoC → 운영 전환 체크리스트

PoC 성공 후 운영 도입 전:

- [ ] 임베딩 service self-host or 외부 API 결정
- [ ] 임베딩 service HA (replica ≥ 2, PDB)
- [ ] HNSW 파라미터 튜닝 (M / ef_construction / ef_search)
- [ ] dense_vector reindex 절차 (alias swap, embedding model 변경 시)
- [ ] dense_vector 모니터링 (메모리 / 검색 latency)
- [ ] consumer 의 임베딩 추론 throughput 안정성
- [ ] 모델 변경 dual indexing 절차
- [ ] 검색 품질 지속 모니터링 (nDCG / CTR / CVR)
- [ ] 비용 정당성 (cloud GPU / API 비용 예산)
- [ ] ADR 작성 (§19 의 Hybrid 도입 ADR)

## 12. 흔한 PoC 함정

### 12-1. PoC 가 production code 가 됨

→ "임시" 라며 작성한 코드가 그대로 운영. 별도 `_v_with_vector` 인덱스 / 별도 endpoint 분리는 분리해 두어야 cleanup 쉬움.

### 12-2. 평가 없이 도입 결정

→ "직관적으로 좋아짐" 으로 판단. nDCG / A/B 결과 없이 결정 ❌.

### 12-3. 임베딩 모델 silent 변경

→ PoC 중 모델 바꾸면 옛 doc 의 vector 와 새 doc 의 vector 가 다른 공간. 검색 깨짐.

### 12-4. 인덱싱 throughput 측정 안 함

→ PoC 환경 (작은 데이터) 에서는 OK, production 규모에서 throughput 폭락.

### 12-5. ES 8.x retriever 가 OpenSearch 안 됨

→ OS 면 hybrid query + search pipeline 사용. PoC 에서 ES 만 검증하고 OS 배포 시 깜짝.

### 12-6. 임베딩 service 단일 장애

→ embedding-service 죽으면 인덱싱 / 검색 동시 정지. HA 필수.

## 13. msa 시사점

### 13-1. 본 PoC 의 가치

- 시니어가 "기술적으로 가능" 을 코드로 입증
- 비용 / 성능 / 품질의 3축 측정
- ADR (§19) 의 근거 제공

### 13-2. ADR-Hybrid Search 의 결론 후보

- **A. 도입 (전면)** — 임베딩 인프라 + hybrid 표준화
- **B. 부분 도입** — 카테고리 / 검색 유형별 분리 (자연어 = hybrid, 정확 = BM25)
- **C. 보류** — 비용 vs 효과 미검증, 추가 PoC 필요
- **D. 폐기** — 효과 미미

→ PoC 결과로 결정.

### 13-3. 보완 작업

- LTR 파이프라인 (analytics → judgment) — §10
- 모델 평가 / 선택 (bge-m3 vs e5 vs OpenAI) — 별도 spike
- 임베딩 self-host vs API 비용 비교

## 14. 다음 학습

- [19-improvements.md](19-improvements.md) — Hybrid 도입 ADR 초안 (PoC 결과 기반)
- [20-interview-qa.md](20-interview-qa.md) — Hybrid PoC 면접 답변 자료

> **§18 회독 체크리스트**:
> - [ ] PoC scope 정의 (in / out / 가정)
> - [ ] dense_vector mapping 변경의 비용 (reindex 필수)
> - [ ] EmbeddingPort 추상화의 가치 (외부 API ↔ self-host 교체)
> - [ ] 인덱싱 throughput 의 임베딩 병목 해결 방법 3가지
> - [ ] ES retriever (RRF) API 의 실 코드
> - [ ] PoC 평가의 정성 / 정량 / A/B 3축
> - [ ] PoC → 운영 전환 체크리스트의 9개 항목
> - [ ] PoC 함정 6가지
