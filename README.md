# Commerce Platform (MSA)

실서비스 배포 가능 수준의 MSA 기반 커머스 플랫폼.
수평 확장, 이중화, Docker 로컬 개발 환경, Kubernetes(EKS) 배포 가능 구조로 설계되었습니다.

---

## 서비스 구성

| 서비스 | 포트 | 설명 |
|--------|------|------|
| `discovery` | 8761 | Eureka 서비스 디스커버리 |
| `gateway` | 8080 | Spring Cloud Gateway (인증/인가, 라우팅) |
| `product` | 8081 | 상품 서비스 (CRUD, 재고 관리) |
| `order` | 8082 | 주문 서비스 (결제 연동, 이벤트 발행) |
| `search` | 8083 | 검색 서비스 (Elasticsearch 기반) |
| `common` | — | 공통 라이브러리 모듈 |

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 언어 | Kotlin 2.2.21, Java 25 |
| 프레임워크 | Spring Boot 4.0.3, Spring Cloud 2025.1.0 (Oakwood) |
| 아키텍처 | Clean Architecture |
| DB | MySQL 8.0 (Master/Replica R/W 분리) |
| ORM | JPA + QueryDSL |
| 캐시/락 | Redis 7.2 (Cluster 모드) |
| 메시징 | Apache Kafka |
| 검색 | Elasticsearch 8.17 (nori 형태소 분석기) |
| 외부 통신 | WebClient + Resilience4j CircuitBreaker |
| 인증 | JWT (RS256), AES-256-GCM 암호화 |
| 테스트 | Kotest BehaviorSpec + MockK |

---

## 인프라 포트 현황

| 컨테이너 | 호스트 포트 | 용도 |
|----------|------------|------|
| mysql-product-master | 3316 | Product DB 쓰기 |
| mysql-product-replica | 3317 | Product DB 읽기 |
| mysql-order-master | 3326 | Order DB 쓰기 |
| mysql-order-replica | 3327 | Order DB 읽기 |
| redis-1~6 | 6379~6384 | Redis Cluster (3 Master + 3 Replica) |
| elasticsearch | 9200, 9300 | 검색 엔진 |
| zookeeper | 2181 | Kafka 코디네이터 |
| kafka | 9092 | 메시지 브로커 |

---

## 빠른 시작

### 1. 환경변수 설정

```bash
cp docker/.env.example docker/.env
# docker/.env 파일 열어서 비밀번호, JWT_SECRET, AES_KEY 값 설정
```

### 2. 인프라 기동 (DB, Redis, Kafka, Elasticsearch)

```bash
docker compose -f docker/docker-compose.infra.yml up -d
```

### 3. 전체 서비스 기동

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4. 서비스 단독 실행 (로컬 개발)

```bash
# 인프라 기동 후
./gradlew :product:bootRun
```

---

## 빌드

```bash
# 전체 빌드
./gradlew build

# 서비스 앱 단독 빌드 (Nested Submodule 구조)
./gradlew :product:app:build
./gradlew :order:app:build
./gradlew :search:app:build

# 도메인 단독 테스트 (Spring Context 없음)
./gradlew :product:domain:test
./gradlew :order:domain:test
./gradlew :search:domain:test

# 테스트 제외 빌드
./gradlew build -x test
```

---

## 아키텍처

### Clean Architecture 레이어

```
domain/          # 비즈니스 규칙 (Spring 의존성 없음)
application/     # 유스케이스, 포트 인터페이스
infrastructure/  # JPA, Kafka, Redis, WebClient 구현체
presentation/    # REST Controller, DTO
```

- 의존성 방향: `presentation → application → domain` (단방향)
- `domain` 패키지는 Spring/JPA 어노테이션 사용 금지
- 서비스 간 DB 직접 접근 금지 (API 호출만 허용)

### Kafka 토픽

| 토픽 | 발행 | 수신 |
|------|------|------|
| `product.item.created` | product | search |
| `product.item.updated` | product | search |
| `order.order.completed` | order | — |
| `order.order.cancelled` | order | — |

### API 응답 포맷

모든 응답은 `ApiResponse<T>`로 래핑됩니다.

```json
// 성공
{ "success": true, "data": { ... }, "error": null }

// 실패
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "..." } }
```

---

## 모듈 구조

각 서비스는 `{service}:domain` / `{service}:app` 형태의 중첩 Gradle 서브모듈로 분리됩니다.

```
msa/
├── common/          # 공통 라이브러리 (bootJar 없음)
├── discovery/       # Eureka Server
├── gateway/         # Spring Cloud Gateway
├── product/         # 상품 서비스 (컨테이너)
│   ├── domain/      #   순수 도메인 모듈 (Spring/JPA 의존성 없음)
│   └── app/         #   Spring Boot 앱 (Application + Infrastructure + Presentation)
├── order/           # 주문 서비스 (컨테이너)
│   ├── domain/      #   순수 도메인 모듈
│   └── app/         #   Spring Boot 앱
├── search/          # 검색 서비스 (컨테이너)
│   ├── domain/      #   순수 도메인 모듈
│   └── app/         #   Spring Boot 앱
├── docker/          # Docker Compose 설정
│   ├── docker-compose.infra.yml
│   ├── docker-compose.yml
│   └── .env.example
├── docs/            # 아키텍처 문서, ADR
└── gradle/
    └── libs.versions.toml  # Version Catalog (중앙 버전 관리)
```

---

## 문서

- [아키텍처 결정 기록 (ADR)](docs/adr/)
- [Clean Architecture 가이드](docs/architecture/00.clean-architecture.md)
- [데이터 전략](docs/architecture/data-strategy.md)
- [Resilience 전략](docs/architecture/resilience-strategy.md)
- [구현 플랜](docs/plans/)
