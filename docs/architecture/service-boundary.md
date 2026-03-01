# Service Boundary

## 1. Gateway

### Responsibility
- 인증/인가
- 라우팅
- 요청 검증
- 외부 요청 표준화

### Does NOT
- 비즈니스 로직 수행 금지
- DB 접근 금지

---

## 2. Product Service

### Responsibility
- 상품 CRUD
- 상품 상태 관리
- 상품 도메인 규칙

### Data Ownership
- product DB 완전 소유

---

## 3. Order Service

### Responsibility
- 주문 생성
- 주문 상태 전이
- 결제 연계 (외부 API)

### Data Ownership
- order DB 완전 소유

---

## 4. Search Service

### Responsibility
- 검색 API 제공
- Elasticsearch 인덱스 관리
- Kafka 이벤트 기반 색인

### Data Ownership
- Elasticsearch 인덱스 소유
- RDBMS 미사용 (또는 최소화)

---

## 5. Data Ownership Rule

- 서비스 간 DB 공유 금지
- 데이터 변경은 이벤트 기반으로 전파
- 직접 조회가 필요한 경우 API 호출