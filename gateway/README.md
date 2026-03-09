# gateway

Spring Cloud Gateway 기반 API 게이트웨이.
JWT 인증/인가, 요청 라우팅, 로깅 필터를 담당한다.

## 포트: 8080

## 의존 인프라

| 인프라 | 용도 | 로컬 포트 |
|--------|------|-----------|
| Eureka | 서비스 디스커버리 (lb://) | 8761 |
| Redis Cluster | JWT 블랙리스트 조회 | 6379~6384 |

## 라우팅 규칙

| 경로 | 대상 서비스 | 인증 |
|------|------------|------|
| `/api/auth/**` | auth-service | 불필요 |
| `/api/products/**` | product-service | JWT 필요 |
| `/api/orders/**` | order-service | JWT 필요 |
| `/api/search/**` | search-service | JWT 필요 |

## JWT 인증 흐름

1. 클라이언트가 `Authorization: Bearer {token}` 헤더 전송
2. `AuthenticationGatewayFilter` — RS256 서명 검증
3. Redis에서 토큰 블랙리스트 확인 (로그아웃 토큰 차단)
4. 검증 성공 시 `X-User-Id` 헤더를 추출해 하위 서비스로 전달

## 로컬 실행

```bash
# Eureka + Redis 먼저 기동
docker compose -f docker/docker-compose.infra.yml up -d redis-1 redis-2 redis-3 redis-4 redis-5 redis-6 redis-cluster-init

./gradlew :gateway:bootRun
```

## 환경변수

| 변수 | 설명 |
|------|------|
| `JWT_SECRET` | RS256 공개키 (필수) |
| `REDIS_PASSWORD` | Redis 클러스터 비밀번호 |
| `EUREKA_DEFAULT_ZONE` | Eureka 주소 (기본: `http://localhost:8761/eureka/`) |

## 빌드

```bash
./gradlew :gateway:build
```
