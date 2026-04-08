# Test Strategy — Analytics & Scoring System

## 테스트 계층

### 1. Domain Tests (순수 단위 테스트)
- 스코어 산출 로직 (CTR, CVR, 인기도, 키워드 스코어)
- 정규화 로직 (Min-Max, percentile 클리핑)
- 이벤트 스키마 유효성 검증
- 버킷 할당 해싱 로직 (결정적 해싱 검증)
- 실험 상태 전이 규칙
- **프레임워크 의존 없음**, Kotest BehaviorSpec + MockK

### 2. Application Tests (서비스 로직)
- 스코어 조회 UseCase (Redis hit/miss 시나리오)
- 이벤트 발행 UseCase
- 실험 관리 UseCase (CRUD, 상태 전이)
- 버킷 할당 UseCase (일관성 검증)

### 3. Infrastructure Tests
- ClickHouse Repository (Testcontainers)
- Kafka Producer/Consumer 통합
- Kafka Streams 토폴로지 테스트 (TopologyTestDriver)
- Redis 캐시 동작 검증
- ES 부분 업데이트 (스코어 필드)

### 4. API Tests
- 스코어 조회 API 응답 포맷 (ApiResponse<T>)
- 실험 CRUD API
- 버킷 할당 API
- Gateway 헤더 주입 필터

## 핵심 테스트 시나리오

| 시나리오 | 검증 포인트 |
|---------|------------|
| 동일 userId + experimentId → 항상 같은 버킷 | 결정적 해싱 일관성 |
| 이벤트 중복 수신 → 스코어 이중 반영 방지 | 멱등성 (ADR-0012) |
| 스코어 0건일 때 검색 → 기본 텍스트 스코어만 적용 | graceful degradation |
| 정규화 시 이상치 → percentile 클리핑 동작 | 정규화 정확성 |
| ClickHouse 장애 시 → 스코어 조회 Redis fallback | 장애 대응 |
