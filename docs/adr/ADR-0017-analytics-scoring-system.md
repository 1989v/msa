# ADR-0017: Analytics & Scoring System

## Status
Proposed

## Context
검색/전시 영역에 지표 기반 컨텐츠 평가 체계가 없다. 상품 검색은 ES 기본 텍스트 매칭만 사용하며, CTR/CVR 등 사용자 행동 기반 랭킹이 불가능하다. A/B 테스트 인프라도 부재하여 랭킹 가중치 실험이 불가능하다.

## Decision

### 1. 신규 서비스 2개 추가

| 서비스 | 역할 | 모듈 | 포트 |
|--------|------|------|------|
| `analytics` | 이벤트 수집, 스코어 산출(Kafka Streams), 스코어 조회 API | domain / app | 8090 |
| `experiment` | A/B 실험 관리, 버킷 할당, 결과 분석 | domain / app | 8091 |

Clean Architecture 준수: domain 모듈은 프레임워크 의존 없음.

### 2. ClickHouse 도입 (OLAP)

- 용도: 이벤트 로그 저장 + 지표 집계 + A/B 실험 결과 분석
- 기존 MySQL(OLTP)과 역할 분리: MySQL은 실험 메타데이터 CRUD, ClickHouse는 대량 이벤트 분석
- analytics 서비스가 ClickHouse 단독 소유 (이벤트 데이터)
- experiment 서비스는 MySQL(실험 CRUD)만 소유, 결과 분석은 analytics API 호출 (DB 공유 금지 준수)
- 로컬: Docker Compose 단일 노드, 운영: 클러스터 확장 가능 구조

### 3. Kafka Streams 준실시간 스코어 산출

- analytics 서비스 내부에 Kafka Streams 앱 임베딩
- 이벤트 스트림 → 1시간 텀블링 윈도우 집계 → 스코어 산출
- 산출 결과: Redis 캐시 + ClickHouse 영구 저장
- 스코어 변경 시 `analytics.score.updated` 토픽으로 발행

### 4. 이벤트 수집 체계

- 단일 토픽 `analytics.events` + eventType 헤더 기반 라우팅
- common 모듈에 이벤트 발행 SDK (`AnalyticsEventPublisher`) 제공
- fire-and-forget: 이벤트 발행 실패가 비즈니스 로직에 영향 없음
- 멱등 처리: eventId 기반 중복 방어 (ADR-0012 준수)

### 5. 검색 랭킹 통합

- ES ProductDocument에 `popularityScore`, `ctr`, `cvr` 필드 추가
- search:consumer가 `analytics.score.updated` 토픽 소비 → ES 부분 업데이트
- ES function_score 쿼리로 텍스트 스코어 + 지표 스코어 조합 랭킹
- 스코어 유형별 독립 정규화 (상품↔키워드 별개 모집단)

### 6. Gateway 확장

- `VisitorIdFilter`: 비로그인 사용자 visitorId 발행 (쿠키 + 헤더)
- `ExperimentAssignmentFilter`: 활성 실험 버킷 할당 → 하위 서비스에 헤더 전달
- 버킷 할당은 결정적 해싱 (MurmurHash3), stateless

## Alternatives Considered

### 이벤트 저장소
- **MySQL**: 기존 인프라 활용 가능하나 대량 이벤트 집계 성능 한계
- **Elasticsearch**: 검색 + 분석 겸용 가능하나 수치 집계 쿼리 복잡, 리소스 비효율

### 스코어 산출 방식
- **배치 (1시간/일 단위)**: 구현 단순하나 실시간성 부족
- **Kafka Streams**: 준실시간 처리, 파티션 기반 수평 확장, analytics 내부 임베딩으로 운영 단순화

### 이벤트 토픽 전략
- **유형별 개별 토픽**: 독립 스케일링 유리하나 토픽 관리 복잡
- **단일 토픽**: 관리 간편, Kafka Streams 조인 용이

## Consequences

### 긍정적
- 사용자 행동 기반 검색 랭킹으로 전환율 개선 기대
- A/B 테스트로 데이터 기반 의사결정 가능
- 개인화/추천 확장 기반 마련

### 부정적
- 새로운 인프라(ClickHouse) 운영 부담 증가
- Kafka Streams 상태 관리 복잡성 (RocksDB, rebalancing)
- Gateway 필터 증가로 요청 지연 미세 증가 (캐시로 완화)
- 이벤트 수집 SDK를 기존 서비스에 통합하는 작업 필요

### 리스크
- ClickHouse 단일 노드 장애 시 스코어 조회 불가 → Redis 캐시가 방어
- Kafka Streams rebalancing 중 스코어 갱신 지연 → Eventual Consistency 허용 범위 내
