# order:app

주문 서비스 Spring Boot 애플리케이션.
주문 생성(결제 연동), 주문 조회, Kafka 이벤트 발행을 담당한다.

## 포트: 8082

## 의존 인프라

| 인프라 | 용도 | 로컬 포트 |
|--------|------|-----------|
| MySQL Master | 쓰기 (order_db) | 3326 |
| MySQL Replica | 읽기 (order_db) | 3327 |
| Kafka | 주문 이벤트 발행 | 9092 |
| Eureka | 서비스 등록 | 8761 |
| Payment Service | 외부 결제 API (WebClient) | 9090 (기본) |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/orders` | 주문 생성 (결제 포함) |
| GET | `/api/orders/{id}` | 주문 단건 조회 |

### 주문 생성 예시

Gateway를 통한 요청 (JWT 인증 필요):

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 1, "quantity": 2, "price": 15000}
    ]
  }'
```

직접 요청 시 `X-User-Id` 헤더 필요 (Gateway가 JWT에서 추출해 전달):

```bash
curl -X POST http://localhost:8082/api/orders \
  -H "X-User-Id: user-123" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": 1, "quantity": 2, "price": 15000}]}'
```

## 로컬 실행

```bash
# 인프라 먼저 기동
docker compose -f docker/docker-compose.infra.yml up -d

# 서비스 실행
./gradlew :order:app:bootRun
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `MYSQL_USER` | `order_user` | DB 사용자 |
| `MYSQL_PASSWORD` | `order_password` | DB 비밀번호 |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka 주소 |
| `EUREKA_DEFAULT_ZONE` | `http://localhost:8761/eureka/` | Eureka 주소 |
| `PAYMENT_SERVICE_URL` | `http://localhost:9090` | 결제 서비스 URL |

## Kafka 토픽 발행

| 토픽 | 발행 시점 |
|------|-----------|
| `order.order.completed` | 결제 완료 후 |
| `order.order.cancelled` | 주문 취소 후 |

## 빌드

```bash
./gradlew :order:app:build
./gradlew :order:app:bootJar
```
