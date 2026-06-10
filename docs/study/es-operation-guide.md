# 검색 품질 및 운영 디버깅 가이드

## 1. 검색 결과 이상 디버깅

검색 결과가 기대와 다르거나 특정 문서가 노출되지 않는 경우 아래 순서로 확인한다.

### Step 1. Analyze

**API**

```
GET index/_analyze
```

**목적**

- 분석기(Analyzer) 동작 확인
- 입력 텍스트가 어떤 토큰으로 분해되는지 확인

**확인 사항**

- Tokenizer 결과
- 형태소 분석 결과
- Synonym 적용 여부
- Ngram 생성 여부

**예시**

```json
GET ac-airport/_analyze
{
  "field": "airportKoName",
  "text": "인천국제공항"
}
```

### Step 2. Term Vectors

**API**

```
GET index/_termvectors/{id}
```

**목적**

- 실제 색인된 토큰 확인
- TF, DF 등 검색 점수 계산에 사용되는 통계 확인

**예시**

```json
GET ac-airport/_termvectors/123
{
  "fields": ["airportKoName"],
  "term_statistics": true
}
```

**주요 항목**

| 항목 | 의미 |
|------|------|
| `term_freq` | 현재 문서 내 토큰 등장 횟수 |
| `doc_freq` | 해당 토큰을 포함하는 전체 문서 수 |
| `ttf` | 전체 인덱스 내 토큰 등장 횟수 총합 |

**`term_statistics` 옵션**

| 값 | 동작 |
|----|------|
| `false` (기본값) | 현재 문서 기준 정보만 조회 |
| `true` | 인덱스 전체 통계(doc_freq, ttf) 조회 가능 — BM25의 IDF 계산 원인 분석 가능 |

### Step 3. Explain

**API**

```
GET index/_explain/{id}
```

**목적**

- 문서 점수가 계산된 이유 확인

**예시**

```json
GET ac-airport/_explain/123
{
  "query": {
    "match": {
      "airportKoName": "인천공항"
    }
  }
}
```

**확인 사항**

- BM25 계산 결과
- TF 영향도
- IDF 영향도
- Boost 적용 여부
- Function Score 적용 여부

### Step 4. Profile

**API**

```
GET index/_search?profile=true
```

**목적**

- 검색 성능 병목 분석

**예시**

```json
GET ac-airport/_search?profile=true
{
  "query": {
    "match": {
      "airportKoName": "인천공항"
    }
  }
}
```

**확인 사항**

- Query Phase 수행 시간
- Fetch Phase 수행 시간
- Script 비용
- Aggregation 비용
- 느린 Query 분석

### 검색 품질 문제 분석 순서

```
검색 결과 이상 발생
  ↓
_analyze
  ↓
_termvectors
  ↓
_explain
  ↓
_search?profile=true
```

---

## 2. Elasticsearch 운영 디버깅

### 클러스터 상태 확인

**API**

```
GET _cluster/health
```

**목적**

- 클러스터 전체 상태 확인

**상태값**

| 상태 | 의미 |
|------|------|
| Green | 모든 Primary/Replica 정상 |
| Yellow | Replica 일부 미할당 |
| Red | Primary 샤드 미할당 |

### 인덱스 상태 확인

**API**

```
GET _cat/indices?v
```

**목적**

- 인덱스별 상태 확인

**확인 항목**

- `health`
- `docs.count`
- `store.size`
- `pri`
- `rep`

### 샤드 상태 확인

**API**

```
GET _cat/shards?v
```

**목적**

- 샤드 배치 및 할당 상태 확인

**확인 항목**

- `STARTED`
- `INITIALIZING`
- `RELOCATING`
- `UNASSIGNED`

> 특히 `UNASSIGNED` 존재 여부 확인

### 노드 리소스 확인

**API**

```
GET _nodes/stats
```

**목적**

- 노드 리소스 상태 확인

**확인 항목**

- Heap 사용량
- CPU 사용량
- GC 횟수
- Search Latency
- Indexing Latency
- Disk 사용량

### CPU 병목 확인

**API**

```
GET _nodes/hot_threads
```

**목적**

- CPU를 많이 사용하는 스레드 확인

**주요 원인**

- 과도한 검색 요청
- Merge 작업
- GC 작업
- Aggregation 과부하
- Script Query 과다 사용

### 이슈 진단 API 요약

| API | 용도 |
|-----|------|
| `GET _cluster/health` | 클러스터 상태 |
| `GET _cat/indices?v` | 인덱스 상태 |
| `GET _cat/shards?v` | 샤드 상태 |
| `GET _nodes/stats` | 노드 리소스 상태 |
| `GET _nodes/hot_threads` | CPU 병목 확인 |
| `GET index/_analyze` | 토큰 분석 |
| `GET index/_termvectors/{id}` | 실제 색인 토큰 확인 |
| `GET index/_explain/{id}` | 스코어 계산 확인 |
| `GET index/_search?profile=true` | 쿼리 성능 병목 확인 |

- **_analyze** : 입력 텍스트가 어떻게 분석되는지 확인
- **_termvectors** : 실제 색인된 토큰 확인
- **_explain** : 점수가 왜 그렇게 계산됐는지 확인
- **profile=true** : 검색이 왜 느린지 확인
- **_cluster/health** : 클러스터 상태 확인
- **_cat/indices** : 인덱스 상태 확인
- **_cat/shards** : 샤드 상태 확인
- **_nodes/stats** : 노드 리소스 확인
- **_nodes/hot_threads** : CPU 병목 확인

> 검색 품질 이슈는 보통 Analyze → TermVectors → Explain → Profile 순서로, 운영 장애는 Health → Indices → Shards → Nodes → Hot Threads 순서로 접근하면 대부분 원인 파악이 가능하다.

---

## 3. 디버깅 흐름 정리

### 검색 결과 이상 디버깅 흐름

```
검색 결과가 이상하다
  ↓
_analyze
  ↓
_termvectors
  ↓
_explain
```

#### 1) `_analyze`

**목적**

- 입력 텍스트가 어떻게 분석되는지 확인
- Analyzer, Tokenizer, Synonym 적용 여부 확인

**확인 사항**

- 토큰 분리 결과
- 형태소 분석 결과
- Ngram 생성 결과
- 동의어 확장 여부

#### 2) `_termvectors`

**목적**

- 실제 색인된 토큰 확인
- 문서에 저장된 토큰 정보 확인

**확인 사항**

- `term_freq` (TF)
- `doc_freq` (DF)
- `ttf`
- 실제 색인 토큰

**예시**

```json
GET index/_termvectors/{id}
{
  "fields": ["field_name"],
  "term_statistics": true
}
```

#### 3) `_explain`

**목적**

- 검색 점수가 계산된 이유 확인

**확인 사항**

- BM25 계산 결과
- TF 영향도
- IDF 영향도
- Boost 영향도
- Function Score 영향도

**예시**

```json
GET index/_explain/{id}
{
  "query": {
    ...
  }
}
```

### 검색 성능 이상 디버깅 흐름

```
검색이 느리다
  ↓
_profile
  ↓
hot_threads
  ↓
slowlog
```

#### 1) `_profile`

**목적**

- 검색 요청 내부 수행 시간 분석

**예시**

```json
GET index/_search?profile=true
{
  "query": {
    ...
  }
}
```

**확인 사항**

- Query Phase 시간
- Fetch Phase 시간
- Aggregation 비용
- Script 실행 비용
- 병목 Query 확인

**사용 시점**

- 특정 쿼리가 느릴 때
- 어떤 Query 절이 병목인지 확인할 때

#### 2) `hot_threads`

**목적**

- 현재 CPU를 가장 많이 사용하는 스레드 확인

**예시**

```
GET _nodes/hot_threads
```

**확인 사항**

- Search Thread 과부하
- Merge 작업 과부하
- GC 수행 여부
- Script Query 과다 사용
- Aggregation 과부하

**사용 시점**

- CPU 사용률이 높을 때
- 노드가 응답 지연될 때

#### 3) `slowlog`

**목적**

- 실제 운영 환경에서 느린 검색 로그 확인

**설정 예시**

```yaml
index.search.slowlog.threshold.query.warn: 3s
index.search.slowlog.threshold.query.info: 1s
index.search.slowlog.threshold.fetch.warn: 1s
```

**확인 사항**

- 어떤 쿼리가 느린지
- 얼마나 자주 발생하는지
- 특정 인덱스에 집중되는지
- 특정 사용자 요청인지

**사용 시점**

- 간헐적으로 느린 검색이 발생할 때
- 운영 환경 성능 분석 시

---

## 4. 검색 품질 vs 성능 디버깅 (요약)

```
검색 결과가 이상하다          검색이 느리다
  ↓                          ↓
_analyze                     _profile
  ↓                          ↓
_termvectors                 hot_threads
  ↓                          ↓
_explain                     slowlog
```

### 기억하기

**검색 품질 문제**

- `_analyze` → 토큰 확인
- `_termvectors` → 색인 확인
- `_explain` → 점수 확인

**검색 성능 문제**

- `_profile` → 쿼리 병목 확인
- `_nodes/hot_threads` → CPU 병목 확인
- `slowlog` → 실제 느린 쿼리 확인

> 실무에서는 대부분 이 순서대로 접근하면 원인 파악이 가능하다.
