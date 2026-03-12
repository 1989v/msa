# ADR-002 벡터 저장소로 pgvector 선택 (Elasticsearch 대신)

## Status
Accepted

## Context

Charting 서비스는 32-차원 임베딩 벡터를 저장하고, 코사인 유사도 기반으로 top-20 유사 패턴을 검색해야 한다.
MVP 규모는 ~125,000 패턴이다.

기존 플랫폼은 텍스트 검색을 위해 Elasticsearch를 사용하지만, 이는 Search 서비스 전용이다.

### 평가 기준

1. 단순성: 운영 복잡도 최소화 (서버 비용 최소화 원칙)
2. 벡터 검색 성능: 125k 패턴, top-20 쿼리, 단일 서버
3. 기존 인프라와의 조화: 이미 PostgreSQL 친화적 스택
4. HNSW 인덱스 지원: Approximate Nearest Neighbor 검색
5. 트랜잭션 일관성: 패턴 데이터와 메타데이터 동일 DB 관리

## Decision

**벡터 저장소로 pgvector (PostgreSQL extension)를 선택한다.**

- PostgreSQL 16 + pgvector extension
- `vector(32)` 컬럼 타입 사용
- HNSW 인덱스: `vector_cosine_ops`, `m=16`, `ef_construction=64`
- 별도 벡터 DB 없이 OHLCV 데이터와 동일 PostgreSQL 인스턴스 사용

## Alternatives Considered

### Elasticsearch (기존 플랫폼 사용 중)
- **기각 이유:**
  - Search 서비스 전용 인프라로, Charting 서비스가 공유 불가 (서비스 간 DB 공유 금지 원칙)
  - 독자적 ES 인스턴스 추가 시 메모리 요구량 증가 (~512MB~)
  - 125k 벡터에 JVM 오버헤드 비효율적
  - OHLCV 메타데이터와 벡터 데이터 분리 관리 필요 → 트랜잭션 복잡도 증가

### Pinecone / Weaviate (전용 벡터 DB)
- **기각 이유:**
  - SaaS 비용 (서버 비용 최소화 원칙 위반)
  - 외부 벤더 종속성
  - 125k 패턴 규모에서 오버엔지니어링

### FAISS (인메모리)
- **기각 이유:**
  - 영속성 없음 (재시작 시 인덱스 재구축 필요)
  - PostgreSQL과 별도 동기화 로직 필요

## Consequences

### Positive
- 단일 PostgreSQL 인스턴스로 메타데이터 + 벡터 + OHLCV 통합 관리
- HNSW 인덱스로 125k 패턴에서 <10ms ANN 검색 달성 가능
- 트랜잭션 일관성 보장 (패턴 생성/수익률 업데이트 원자적 처리)
- PostgreSQL 운영 경험 재사용, 추가 인프라 불필요

### Negative
- 수천만 벡터 이상으로 규모 확장 시 전용 벡터 DB 고려 필요
- pgvector는 PostgreSQL 확장이므로 버전 호환성 관리 필요

### Neutral
- PostgreSQL 포트: 5433 (기존 서비스와 충돌 방지)
- pgvector/pgvector:pg16 Docker 이미지 사용
