# Data Strategy

## 1. Database Isolation Principle

- 서비스별 DB 완전 분리
- 스키마 공유 금지
- 직접 DB 접근 금지

---

## 2. MySQL Read/Write Separation

구조:
- Master → Write
- Replica → Read

전략:
- 쓰기 트랜잭션은 Master
- 조회는 Replica
- 강한 일관성이 필요한 조회는 Master 사용

---

## 3. Transaction Boundary

- 트랜잭션은 서비스 내부에서만 유효
- 분산 트랜잭션 사용 금지
- 이벤트 기반 eventual consistency 채택

---

## 4. Query Strategy

- JPA 기반
- QueryDSL 사용
- 복잡 조회는 읽기 모델 분리 고려