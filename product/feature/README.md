# product:app

상품 서비스 Spring Boot 애플리케이션.
상품 CRUD, 재고 관리, Kafka 이벤트 발행을 담당한다.

## 포트: 8081

## 의존 인프라

| 인프라 | 용도 | 로컬 포트 |
|--------|------|-----------|
| MySQL Master | 쓰기 (product_db) | 3316 |
| MySQL Replica | 읽기 (product_db) | 3317 |
| Redis Cluster | 분산 락, 캐시 | 6379~6384 |
| Kafka | 상품 이벤트 발행 | 9092 |
| Eureka | 서비스 등록 | 8761 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/products` | 상품 생성 |
| GET | `/api/products` | 상품 목록 (페이지네이션) |
| GET | `/api/products/{id}` | 상품 단건 조회 |
| PUT | `/api/products/{id}` | 상품 수정 |

### 상품 생성 예시

```bash
curl -X POST http://localhost:8081/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "테스트 상품", "price": 15000, "stock": 100}'
```

### 상품 목록 조회 예시

```bash
# 기본 (0페이지, 100개)
curl "http://localhost:8081/api/products"

# 페이지 지정
curl "http://localhost:8081/api/products?page=0&size=50"
```

## 로컬 실행

```bash
# 인프라 먼저 기동
docker compose -f docker/docker-compose.infra.yml up -d

# 서비스 실행
./gradlew :product:app:bootRun
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `MYSQL_USER` | `product_user` | DB 사용자 |
| `MYSQL_PASSWORD` | `product_password` | DB 비밀번호 |
| `REDIS_PASSWORD` | (없음) | Redis 클러스터 비밀번호 |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka 주소 |
| `EUREKA_DEFAULT_ZONE` | `http://localhost:8761/eureka/` | Eureka 주소 |

## Kafka 토픽 발행

| 토픽 | 발행 시점 |
|------|-----------|
| `product.item.created` | 상품 생성 후 |
| `product.item.updated` | 상품 수정 후 |

## 빌드

```bash
./gradlew :product:app:build
./gradlew :product:app:bootJar    # Docker 이미지용 JAR 생성
```
