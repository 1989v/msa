# Requirements — Analytics & Scoring System

## 1. 이벤트 수집 (Event Collection)

### FR-1.1: 공통 이벤트 스키마
- 모든 이벤트는 통일된 스키마로 수집
- 필수 필드: eventType, userId/visitorId, timestamp, sessionId, payload
- 이벤트 유형: `SEARCH_KEYWORD`, `PAGE_VIEW`, `PRODUCT_VIEW`, `PRODUCT_CLICK`, `ADD_TO_CART`, `ORDER_COMPLETE`

### FR-1.2: 이벤트 발행 SDK (common 모듈)
- 각 서비스에서 사용할 수 있는 공통 이벤트 발행 라이브러리
- Kafka 토픽: `analytics.event.{eventType}` 또는 단일 토픽 `analytics.events`
- 비동기 fire-and-forget (서비스 성능에 영향 없음)

### FR-1.3: Gateway 사용자 식별
- 비로그인 사용자: Gateway에서 visitorId 쿠키/헤더 발행
- 로그인 사용자: JWT에서 userId 추출
- 하위 서비스에 X-Visitor-Id, X-User-Id 헤더 전달

### FR-1.4: 이벤트 저장
- Kafka Consumer → ClickHouse 적재
- analytics 서비스가 ClickHouse 단독 소유
- 파티셔닝: 날짜 기반 (일별/월별)
- 보관 기간: raw 이벤트 90일, 집계 데이터 1년

## 2. 스코어 산출 (Score Computation)

### FR-2.1: 지표 종류
| 지표 | 산출 방식 | 적용 대상 |
|------|-----------|-----------|
| CTR (Click-Through Rate) | clicks / impressions | 상품, 키워드 |
| CVR (Conversion Rate) | orders / clicks | 상품, 키워드 |
| 인기도 스코어 | weighted(views, clicks, orders) | 상품 |
| 키워드 스코어 | weighted(search_count, CTR, CVR) | 검색 키워드 |

### FR-2.2: 준실시간 산출 (Kafka Streams)
- Kafka Streams 앱이 이벤트 스트림을 소비하여 시간 윈도우 기반 집계
- 윈도우: 1시간 텀블링 윈도우 (설정 가능)
- 산출된 스코어 → Redis 캐시 + ClickHouse 영구 저장

### FR-2.3: 정규화 (Normalization)
- Min-Max 정규화: 0.0 ~ 1.0 범위
- 정규화 기준: 카테고리별 또는 전체 (설정 가능)
- 이상치 처리: percentile 클리핑 (95th/99th)

### FR-2.4: 스코어 조회 API
- `GET /api/v1/scores/products/{productId}` — 상품 스코어
- `GET /api/v1/scores/keywords/{keyword}` — 키워드 스코어
- `GET /api/v1/scores/products/bulk?ids=...` — 벌크 조회
- Redis 캐시 우선, miss 시 ClickHouse fallback

## 3. 검색 통합 (Search Integration)

### FR-3.1: ES 상품 문서 스코어 필드 추가
- ProductEsDocument에 `popularityScore`, `ctr`, `cvr` 필드 추가
- analytics 서비스가 Kafka 이벤트로 스코어 업데이트 발행
- search:consumer가 스코어 업데이트 이벤트를 소비하여 ES 부분 업데이트

### FR-3.2: 검색 랭킹 함수
- ES function_score 쿼리 활용
- 최종 점수 = textScore * α + popularityScore * β + ctr * γ
- 가중치(α, β, γ)는 설정 가능 (A/B 테스트 연동 가능)

### FR-3.3: 키워드 기반 부스팅
- 검색 키워드의 CTR/CVR 스코어에 따라 검색 결과 부스팅
- 인기 키워드 → 상위 전환 상품 우선 노출

## 4. A/B 테스트 플랫폼 (Experiment Service)

### FR-4.1: 실험 관리
- 실험 CRUD: 이름, 설명, 시작/종료일, 트래픽 비율
- 실험 상태: DRAFT → RUNNING → PAUSED → COMPLETED
- 다중 변형(variant) 지원: A/B/C/... (2~N개)

### FR-4.2: 버킷 할당
- `GET /api/v1/experiments/{experimentId}/assignment?userId={userId}`
- 결정적 해싱: 같은 userId + experimentId → 항상 같은 버킷
- Gateway에서 실험 할당 결과를 하위 서비스에 헤더로 전달

### FR-4.3: 결과 분석
- 실험별 지표 비교: CTR, CVR 등을 변형별로 집계
- 통계적 유의성 검정 (p-value, confidence interval)
- ClickHouse에서 실험 기간 이벤트 데이터 조회

### FR-4.4: Gateway 통합
- Gateway 필터에서 활성 실험 목록 조회 (캐시)
- 요청마다 버킷 할당 → `X-Experiment-{id}: {variant}` 헤더 주입
- 각 서비스는 헤더 기반으로 분기 처리

## 5. 비기능 요구사항

### NFR-1: 성능
- 이벤트 발행: < 5ms (fire-and-forget)
- 스코어 조회 API: p99 < 10ms (Redis 캐시)
- 버킷 할당 API: p99 < 5ms (결정적 해싱, 메모리)

### NFR-2: 확장성
- ClickHouse: 일 1억 이벤트 처리 가능한 설계
- Kafka Streams: 파티션 기반 수평 확장
- 개인화/추천 확장 포인트 (사용자 프로파일, 협업 필터링)

### NFR-3: 데이터 정합성
- 이벤트 유실 방지: Kafka acks=all, at-least-once
- 멱등 처리: 이벤트 중복 방어 (ADR-0012 준수)
- 스코어 지연 허용: 최대 수 분 (Eventual Consistency)

### NFR-4: 운영
- ClickHouse Docker Compose 구성
- 이벤트 모니터링: 수집량, 지연, 에러율 메트릭
- 스코어 이상치 알림
