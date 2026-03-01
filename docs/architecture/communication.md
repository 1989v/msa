# Communication Strategy

## 1. Synchronous Communication

사용 기술:
- WebClient

사용 대상:
- Gateway → 내부 서비스
- 외부 API 호출

### Rule
- 반드시 CircuitBreaker 적용
- Timeout 설정 필수
- Retry 정책 명시

---

## 2. Asynchronous Communication

사용 기술:
- Kafka

목적:
- 도메인 이벤트 전파
- 검색 인덱스 업데이트
- 서비스 간 결합도 감소

---

## 3. Kafka Topic Naming Convention

형식:

{domain}.{entity}.{event}

예:
- product.item.created
- order.order.completed

---

## 4. WebClient Standard Pattern

- Base URL 분리
- Timeout 설정
- CircuitBreaker 적용
- 공통 Error Mapping

---

## 5. CircuitBreaker Standard

- Resilience4j 사용
- 실패율 기반 오픈
- Half-open 상태 지원
- fallback은 최소화