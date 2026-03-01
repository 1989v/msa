# Resilience Strategy

## 1. Circuit Breaker Policy

- Resilience4j 사용
- Sliding Window 기반 실패율 계산
- Open 상태 시 빠른 실패

---

## 2. Timeout Policy

- 외부 API: 짧은 Timeout
- 내부 서비스 호출: 명확한 SLA 정의
- DB: Connection Pool 기반 관리

---

## 3. Retry Policy

- 멱등 요청에 한해 Retry 허용
- 지수 백오프 적용
- 무한 재시도 금지

---

## 4. Failure Propagation Prevention

- 장애 전파 차단
- Kafka 이벤트 기반 비동기 분리
- Bulkhead 패턴 적용 고려
- 캐시 fallback 전략 적용 가능

---

## 5. High Availability Strategy

- 서비스는 Stateless 설계
- 수평 확장 가능 구조
- Redis Cluster 대비 설계
- Elasticsearch Replica 설정