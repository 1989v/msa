---
parent: 8-system-design
seq: 14
title: 실시간 검색 자동완성 시스템 — System Design Card
type: scenario-card
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
catalog-row: "§3 시나리오 카드"
---

# 14. 실시간 검색 자동완성 시스템 (Realtime Search Autocomplete)

> 한국어 + 빈도 정렬 + 실시간 trending 반영. 1억 query/day, P99 (99th Percentile, 가장 느린 1%) < 50ms 라는 SLA (Service Level Agreement, 서비스 수준 협약) 가 핵심 도전. 단순한 prefix 매칭처럼 보이지만 한글 자모 분해, weight 갱신, hot prefix 함정까지 풀어야 한다.

---

## 1. Functional Requirements

1. **Prefix 매칭** — 사용자가 입력한 prefix 로 시작하는 후보 top-N 반환 (보통 N=10)
2. **빈도/스코어 정렬** — 검색량 + 최신성 + 비즈니스 가중치 (sponsored, brand boost) 반영
3. **한글 부분 입력 대응** — "노트" → "노트북", "노ㅌ" (자모 미완) → "노트북" 까지 보정
4. **한영 혼동 보정** — `dhsx` (영문 키로 친 "한글") → "한글" 변환
5. **Typo tolerance** — `노ㅡㅌ북` (오타) → "노트북" 까지 fuzzy
6. **실시간 trending 반영** — 5분 이내 급상승 키워드는 boost (예: 신상품 출시, 이슈 키워드)
7. **개인화 (선택)** — 최근 검색 / 카테고리 선호 반영
8. **Personalized blacklist** — 성인 / 비방 키워드 필터

### Out of scope

- 자연어 질문 응답 (LLM)
- 음성 / 이미지 자동완성
- 서버 푸시 (autocomplete 는 polling pattern)

---

## 2. NFR (Non-Functional Requirements)

| 항목 | 목표 | 비고 |
|---|---|---|
| Read QPS (Queries Per Second, 초당 쿼리 수) | 평균 1,200 / 피크 6,000 | 1억 query/day = 1,157 QPS 평균 |
| **P99 latency** | **< 50ms** | 입력 keystroke 단위 호출 → tight budget |
| P50 latency | < 10ms | 사용자 체감 즉시 |
| Availability | 99.95% | 검색 진입 직전 단계, 다운 시 검색 UX 붕괴 |
| 빈도 갱신 주기 | 5분 | trending 반영 |
| Index 크기 | ~100M unique queries | 검색 로그 90일 보존 |
| 데이터 정합성 | Eventual Consistency (EC) | 빈도 ±1% 오차 허용 |

### Capacity / Sizing

```
DAU 1천만, 1인 평균 10 검색 → 1억 query / day
keystroke 당 autocomplete 1회 (debounced 200ms) → 평균 4 keystroke = 4억 autocomplete / day
autocomplete QPS = 4억 / 86,400 ≈ 4,630 (피크 ×3 = 14,000)

unique query 수: ~100M (long tail 포함)
평균 query 길이: 한글 8 char × 3 byte = 24 byte
저장: 100M × 24 byte = 2.4GB (term) + posting/score = 약 10GB

Redis 메모리:
  ZSet entry = 평균 50 byte (member + score + skiplist overhead)
  100M entry = 5GB → cluster 3샤드 + replica 1 = 30GB
```

---

## 3. High-Level Architecture

```
                    ┌──────────────────────┐
   keystroke────►   │  API GW (Rate Limit) │
                    └──────────┬───────────┘
                               │ GET /autocomplete?prefix=노트
                               ▼
                    ┌──────────────────────┐
                    │ Autocomplete Service │
                    │  (Spring Boot)       │
                    └────┬───────┬────┬────┘
                         │       │    │
            L1 cache     │       │    │ fallback
            (Caffeine)◄──┘       │    └─────────►  ES (Elasticsearch)
                                 │                  completion suggester
                                 ▼                   + edge_ngram
                    ┌────────────────────┐
                    │   Redis Cluster    │
                    │   ZSet per prefix  │ ←── 99% hit 경로
                    └────────────────────┘

   ┌─────────────┐   search.queried   ┌─────────────────┐
   │ Search App  │──────►Kafka───────►│ Aggregator      │
   └─────────────┘                    │ (Streams + 5min │
                                      │  tumbling)      │
                                      └────────┬────────┘
                                               │ 5min batch
                                               ▼
                                       ZINCRBY ac:{prefix}
                                       (recency decay 적용)
```

### 두 갈래 path

| Path | 자료구조 | 용도 |
|---|---|---|
| **Hot path (Redis ZSet)** | 사전 계산된 prefix → top-N | P99 < 10ms |
| **Cold/Fallback (ES completion suggester + edge_ngram)** | FST (Finite State Transducer) | hot path miss / 신규 prefix / typo fuzzy |

---

## 4. Core Components

| 컴포넌트 | 역할 | 기술 선택 | 비고 |
|---|---|---|---|
| API GW | Rate Limiting, 인증 | Spring Cloud Gateway + Redis | msa gateway 그대로 |
| Autocomplete Service | prefix 정규화 → cache 조회 → fallback | Spring Boot + Reactor | non-blocking 필수 |
| L1 Cache | hot prefix in-process | Caffeine (LRU + 60s TTL) | top-1000 prefix hit |
| L2 Cache | prefix → ZSet | Redis Cluster | top-N member 미리 sort |
| Backing Store | full text + completion suggester | Elasticsearch + nori | typo / 신규 prefix |
| Aggregator | search log → frequency 갱신 | Kafka Streams + 5분 tumbling | 검색 이벤트 stream |
| Trending Detector | 급상승 점수 계산 | EMA (지수 이동 평균) over 5min/1h | trending boost |
| Blacklist filter | 금칙어 제거 | Aho-Corasick in-memory | 동기 차단 |

---

## 5. Data Model

### 5-1. Redis ZSet (hot path)

```
Key:    ac:{normalized_prefix}
Value:  ZSet member = full term, score = weight
TTL (Time To Live, 생존 시간):    24h (재계산되면 갱신됨)

예시:
  ZADD ac:노트 850 "노트북" 720 "노트북 거치대" 510 "노트 필기"
  ZADD ac:ㄴㅗㅌ 850 "노트북" ...   # 자모 분해 prefix 도 별도 entry
```

**Score 공식**:

```
score = log1p(query_count_30d) × 100        # base frequency
      + click_through_rate × 50               # 사용자 의도 신호
      + recency_boost(updated_at)             # 최근성
      + trending_score × trending_weight      # 5min EMA spike
      - penalty(blacklist, low_quality)
```

`log1p` 로 saturate → top 키워드 score 폭주 방지 (msa search 의 function_score 패턴 동일).

### 5-2. ES (Elasticsearch) Mapping (fallback)

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "ko_autocomplete": {
          "type": "custom",
          "tokenizer": "edge_ngram_tokenizer",
          "filter": ["lowercase", "icu_normalizer"]
        }
      },
      "tokenizer": {
        "edge_ngram_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 1,
          "max_gram": 20,
          "token_chars": ["letter", "digit"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "term": { "type": "text", "analyzer": "ko_autocomplete" },
      "term_completion": {
        "type": "completion",
        "analyzer": "simple",
        "preserve_separators": true,
        "preserve_position_increments": true,
        "max_input_length": 50
      },
      "weight": { "type": "long" },
      "trending_score": { "type": "double" },
      "category": { "type": "keyword" }
    }
  }
}
```

`completion` 타입은 내부적으로 FST (Finite State Transducer, 유한 상태 변환기) 자료구조 사용 → 메모리 in-resident, P99 < 30ms.

### 5-3. Kafka 토픽

```
search.queried v1
{
  "user_id": "u_xxx",
  "query": "노트북",
  "category": "electronics",
  "result_count": 124,
  "clicked_position": 1,        // null = no click
  "session_id": "s_yyy",
  "occurred_at": "2026-05-05T..."
}
```

partition key = `query` 의 hash → 같은 키워드는 같은 partition → in-order frequency 집계.

---

## 6. Critical Decisions

### 6-1. **한글 정규화: ICU NFD vs NFC**

| 옵션 | 동작 | 트레이드오프 |
|---|---|---|
| **NFC (조합형)** | "노트" → "노트" (1 codepoint per syllable) | 검색 시 prefix 자모 미완 ("노ㅌ") 매칭 안됨 |
| **NFD (분해형)** ★ | "노트" → "ㄴㅗㅌㅡ" (자모 분해) | 자모 단위 prefix 가능, edge_ngram 친화적 |
| Both | NFC 입력 + NFD 인덱싱 | 메모리 ×2 |

**선택**: **NFD + ICU (International Components for Unicode) normalizer** 인덱싱, 쿼리도 NFD 정규화 후 매칭.
- "노ㅌ" 도 "ㄴㅗㅌ" 로 정규화되어 "노트북" hit
- 비용: token 수 증가 (한 음절 = 평균 2.5 자모) → index 크기 ~30% 증가
- 본 msa 의 `nori` 분석기는 형태소 분석 기반이라 autocomplete 에는 부적합 → **별도 ko_autocomplete 분석기** 필요

### 6-2. **Weight 갱신 주기: 실시간 vs 5분 batch**

| 옵션 | latency | 부하 | 정확도 |
|---|---|---|---|
| 실시간 (검색 시 ZINCRBY) | 0초 | Redis write QPS = search QPS = ~14k | 100% |
| **5분 tumbling (Streams)** ★ | 5분 lag | Redis write 50/min × shard | 99% (5분 ±) |
| 시간당 batch | 1h lag | 매우 낮음 | trending 반영 못함 |

**선택**: **5분 tumbling window (Kafka Streams)** + trending 키워드만 1분 미니 batch.
- 일반 키워드: 5분 충분 (사용자가 5분 ±1 hit 차이 인지 못함)
- Trending 키워드 (EMA spike threshold 초과): 1분 윈도우 + 별도 prefix key 로 boost
- 비용: aggregator 1대 + state store (RocksDB) ~20GB

### 6-3. **TTL 전략: prefix ZSet 만료 정책**

| 옵션 | 동작 | 위험 |
|---|---|---|
| TTL 없음 | 영구 | stale 데이터 + 메모리 무한 증가 |
| 24h TTL ★ | 5분 batch 가 매번 갱신 | batch 멈추면 24h 후 cache miss storm |
| 1h TTL | 자주 갱신 | 매번 ES fallback 으로 부하 ↑ |

**선택**: **24h TTL + 5분 batch refresh** + sentinel key 로 batch health check.
- batch 가 5분 안 들어오면 alert → 운영자가 ES fallback 으로 전환
- Cache miss 시: ES completion suggester 로 fallback + Redis 에 lazy populate

### 6-4. **Top-N 정렬 위치: Redis vs Application**

| 옵션 | latency | Redis 부하 |
|---|---|---|
| **Redis ZREVRANGE 0 9 ★** | < 1ms | sorted set 자체가 정렬됨 |
| Application 에서 정렬 | 5-10ms | ZRANGEBYSCORE + 정렬 |

**선택**: **ZREVRANGE 직접** — ZSet 은 skiplist 로 정렬 유지 → O(log N + M) 직접 top-10 추출.

### 6-5. **한영 혼동 (Korean-English mistype) 처리**

| 옵션 | 정확도 | 비용 |
|---|---|---|
| 고정 매핑 테이블 | 80% | 매우 낮음 (KR/EN 키 매핑 26 entry) |
| 학습 기반 | 95% | offline ML pipeline 필요 |
| **Hybrid ★** | 90% | 매핑 + 결과 비교 (ZCARD ≥ N 인 쪽 채택) |

**선택**: 입력에 자음/모음 자모만 있으면 한글, 영문만이면 두 candidate 변환 후 ZCARD 큰 쪽 채택.

---

## 7. Failure Modes

| 장애 | 영향 | 대응 |
|---|---|---|
| **Redis cluster shard 다운** | 일부 prefix hit 0% | ES fallback 자동 (CircuitBreaker), P99 50→100ms degraded |
| **Aggregator (Kafka Streams) 다운** | weight 갱신 멈춤 | 24h TTL 동안 stale 사용 가능, 알람으로 운영자 대응 |
| **Cache miss storm** (Redis flush 등) | ES 부하 폭증 | Singleflight (per-prefix mutex) + circuit breaker + L1 Caffeine 60s TTL |
| **Hot prefix** (예: "ㅇ" 모음 단독) | 단일 ZSet 에 트래픽 집중, shard hot | client-side prefetch + 짧은 prefix 는 L1 강제 + 1글자 prefix 는 별도 hot tier (Caffeine only) |
| **Typo / 자모 미완** | matching 실패 | NFD + edge_ngram fallback + fuzzy ES query |
| **한영 혼동** | 빈 결과 | 양쪽 candidate 비교 후 큰 쪽 |
| **Trending poison** (어뷰징, 봇 검색) | 가짜 trending | bot detection (UA, IP rate) + trending threshold + manual blacklist |
| **Personalized data 유출** | 다른 사용자 검색 노출 | 캐시 키에 user-id 포함 또는 personalized 결과는 캐시 안 함 |
| **batch lag 1h+** | trending 못 잡음 | dedicated 1분 mini-batch + alert |
| **금칙어 누락** | 부적절 키워드 노출 | Aho-Corasick blacklist 동기 검사 + 사후 제거 |

---

## 8. Scaling Path

### Phase 1 — 단일 인스턴스 (DAU < 10만)

```
[App] ──► [ES single node] ──► completion suggester
```
- ES 의 `completion` 타입 단일 사용
- Redis 없음, weight 는 매일 batch 로 ES `weight` 필드 update
- P99 ~80ms 수준

### Phase 2 — Redis 캐시 + Streams aggregator (DAU 100만)

```
[App] ──► [Redis ZSet hot path] (99% hit)
       └─► [ES fallback] (1%)
[Search log] ──► [Kafka] ──► [Streams 5min] ──► [ZINCRBY]
```
- Redis 단일 인스턴스 + replica 1
- Kafka topic 6 partition

### Phase 3 — Cluster + 다중 region (DAU 1천만+)

```
[App] ──► [Caffeine L1] ──► [Redis Cluster 6shard × replica 2]
                          └─► [ES Cluster 6 data nodes]
[Streams cluster 3 instance + RocksDB]
[Trending detector EMA + bot filter]
```
- Redis Cluster (CRC16 mod 16384 slot)
- 한국 region active, 일본 active-passive (검색 데이터 지역성 강함)
- L1 Caffeine: 1ms 이내 hit (top-1000 prefix 만 capacity)

### Phase 4 — 개인화 + ML 랭킹

- 사용자별 click 기반 LTR (Learning to Rank)
- offline feature pipeline + online inference (TF Serving / ONNX)
- 개인화 결과는 user_id namespace 분리 + TTL 짧게 (5분)

---

## 9. Observability

### 핵심 metric

| metric | 임계값 | 알람 |
|---|---|---|
| `autocomplete.p99.latency.ms` | > 50 | warning, > 100 critical |
| `autocomplete.cache.hit.ratio` | < 95% | warning |
| `redis.cluster.slot.unavailable` | > 0 | critical |
| `aggregator.lag.minutes` | > 10 | warning, > 30 critical |
| `es.fallback.qps` | > 1000 | warning (cache 문제) |
| `trending.spike.detected` | n/a | info (대시보드) |
| `blacklist.hit.count` | 추적 | abuse 탐지 |
| `keystroke.empty.result.ratio` | > 5% | warning (recall 떨어짐) |

### 분산 트레이싱

- 모든 keystroke request 에 OTel (OpenTelemetry, 오픈 텔레메트리) span: `autocomplete.lookup`
  - child: `cache.l1.lookup`, `cache.l2.redis.zrevrange`, `es.fallback.completion`
- sampling 0.1% (volume 큼)

### 로그

```kotlin
private val log = KotlinLogging.logger {}
log.debug { "autocomplete miss: prefix=$prefix lang=$lang fallback=ES" }
log.warn  { "autocomplete cache hit ratio dropped: $ratio (threshold=0.95)" }
```

---

## 10. 면접 트랩

### Trap 1 — "그냥 Trie 쓰면 되지 않나요?"

**Reality**: 단일 노드 Trie 는 메모리 가능하지만 분산이 어렵다. score 갱신 시 lock 경합 + replica 동기화 비용. ZSet 은 이미 분산 자료구조이고 ZINCRBY 가 atomic.

### Trap 2 — "한글은 그냥 prefix matching 하면 되지 않나요?"

**Reality**:
- "노" 입력 시 "노트북" matching 되어야 하는데, 사용자가 "노ㅌ" (자모 미완) 으로 입력 → NFC prefix 만으로는 fail
- "ㄱㅏ" 입력 → "가방" matching 위해 NFD 분해 필요
- ICU normalizer + edge_ngram 조합 필수

### Trap 3 — "ES completion suggester 만 쓰면 충분하지 않나요?"

**Reality**:
- P99 30-50ms 는 가능하지만 1억 query/day (피크 14k QPS) 부하 직접 받기엔 ES cluster 비용 폭증
- weight 갱신 = `_update` API → write 부하 → indexing 영향
- Redis ZSet 은 in-memory + ZREVRANGE O(log N) → 10x 빠름

### Trap 4 — "trending 이 뭐가 어렵죠?"

**Reality**:
- "갑자기 검색량 spike" 정의가 모호 — 절대값? 상대값? 시간 윈도우?
- EMA over 5min vs baseline 30min 비율 (예: ratio > 3 → trending)
- 봇 / 어뷰징 필터 없으면 가짜 trending → 운영 issue

### Trap 5 — "Redis 다운되면 어쩌죠?"

**Reality**:
- ES fallback 동작하지만 latency P99 50→200ms (4배)
- CircuitBreaker 로 ES 보호 + L1 Caffeine 으로 hot prefix 만이라도 hit
- 사전 capacity planning 으로 ES 가 100% 부하 받을 수 있는지 검증

### Trap 6 — "personalized 결과는 어떻게?"

**Reality**:
- user_id 별 ZSet 만들면 메모리 폭발 (1천만 user × 10MB = 100TB)
- 보통 글로벌 ZSet + 사용자 최근 검색 (Redis List 50개) 을 application 에서 merge
- 개인화는 P50 약간 늘어나는 trade-off (10ms → 15ms)

### Trap 7 — "5분 lag 가 비즈니스적으로 OK 인가요?"

**Reality**:
- Trending 키워드 (예: 신상품 발매) 는 5분 늦으면 첫 5분 검색량을 못 잡음
- → 별도 1분 mini-batch + EMA spike detection 으로 trending 만 빠르게 boost

### Trap 8 — "cache miss storm"

**Reality**:
- Redis flush / 노드 다운 시 모든 keystroke 가 ES 직접 hit
- Singleflight pattern (같은 prefix 동시 요청 1개로 합치기) + L1 + 사전 warmup

---

## 11. msa 코드 grounding

본 msa 에는 autocomplete 가 직접 구현되지 않았지만 cross-ref:

- **search/app**: `ProductSearchAdapter.kt` 의 `function_score` 패턴 → autocomplete weight 식과 동일 구조 (log1p saturate)
- **search/consumer**: Kafka CDC 로 ES 색인 패턴 → search.queried 토픽 consumer 도 동일 패턴 사용 가능
- **search/batch**: alias swap 무중단 reindex → autocomplete 인덱스도 동일 패턴 (분석기 변경 시)
- **gateway**: Rate Limiting 으로 keystroke 폭주 방어
- **analytics**: 검색 이벤트 → ClickHouse 집계 → CTR / CVR 갱신 → 본 시나리오의 score input

향후 autocomplete 서비스 추가 시 모듈 구조: `:autocomplete:domain / :autocomplete:app / :autocomplete:aggregator (Streams)`.

---

## 12. 30초 면접 요약

> "Realtime search autocomplete 는 1억 query/day, P99 < 50ms. 핵심은 (1) Redis ZSet hot path (99% hit) + ES completion fallback 2-tier 구조, (2) ICU NFD 정규화 + edge_ngram 으로 한글 자모 미완 prefix 처리, (3) Kafka Streams 5분 tumbling 으로 weight 갱신 + trending 만 1분 mini-batch + EMA spike detection, (4) score = log1p(freq) + CTR (Click-Through Rate, 클릭률) + recency + trending boost — saturate 패턴, (5) hot prefix 는 Caffeine L1 + singleflight 로 cache miss storm 방어. 한영 혼동, 봇 trending poison, personalized 메모리 폭발이 면접 트랩."

---

## 부록 A. 흔한 함정

1. **NFC 만으로 한글 prefix** — 자모 미완 입력 fail → NFD 필수
2. **검색 시 ZINCRBY 동기 호출** — Redis QPS = autocomplete QPS, 부하 폭증 → Kafka 비동기로 빼야
3. **trending threshold 절대값** — 키워드별 baseline 다름 → 비율 (EMA / baseline) 사용
4. **개인화 ZSet per user** — 메모리 폭발 → global + 최근 검색 merge
5. **TTL 없음** — long tail 키워드가 영구 점유 → 24h TTL + batch refresh
6. **금칙어 사후 처리만** — 일시적으로 부적절 키워드 노출 → 동기 Aho-Corasick 검사
7. **completion suggester 만** — weight 갱신이 ES write → indexing 영향 → Redis 분리
8. **bot / abuse 무방비** — 가짜 trending → IP rate + UA 검사
9. **L1 cache 안 쓰면** — top prefix 도 매번 Redis hit → Caffeine 60s TTL 권장
10. **multi-language 무시** — 영문 / 일문 분석기 분리 안 하면 검색 깨짐 → language detection per request
