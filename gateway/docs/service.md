# Gateway Service

## Overview

Spring Cloud Gateway 기반 API Gateway.
외부 트래픽의 단일 진입점으로, 인증/인가, 라우팅, 요청 검증을 담당한다.

## Module

단일 모듈: `:gateway` (`gateway/`)

## Base Package

`com.kgd.gateway`

## Key Components

| Component | Role |
|-----------|------|
| `GatewayRouteConfig` | 서비스별 라우팅 규칙 정의 |
| `AuthenticationGatewayFilter` | JWT 인증 필터 |
| `JwtTokenValidator` | JWT 토큰 검증 |
| `RequestLoggingFilter` | 요청 로깅 |
| `SecurityConfig` | Spring Security 설정 |
| `RedisConfig` | Redis 연동 (JWT 블랙리스트) |

## Routes

라우트 전체 목록의 원본은 `GatewayRouteConfig.kt` 다 — 선언 순서가 곧 우선순위라 좁은 경로가 앞에 있어야 한다.
아래 표는 인증 없이 열리면서 비공개 자료를 가리키는 라우트만 적는다. 이 라우트는 신원 헤더를 직접 지운다.

| Route id | 조건 | 업스트림 | 필터 | 위치 |
|---|---|---|---|---|
| `wishlist-shared-public` | `GET /api/v1/wishlist/shared/{token}` (한 세그먼트) | `account:8093` | `X-User-Id`·`X-User-Roles`·`Authorization` 제거 + `shortLinkLimit` 레이트리밋, 인증 필터 없음 | `wishlist-count-public` 다음, `wishlist-service` 앞 — 같은 접두의 쓰기·하위 경로는 `wishlist-service` 가 로그인으로 막는다 (ADR-0107) |
| `short-link-collection` | `/c`, `/c/**` | `account:8093` | 위와 같은 헤더 제거 + `shortLinkLimit`, `stripPrefix(0)`, 인증 필터 없음 | `short-link-content` 다음. apex 인그레스 단축 주소 블록의 `/c` 가 이리로 온다 (ADR-0107 §5) |

## Constraints

- 비즈니스 로직 수행 금지
- DB 직접 접근 금지
- WebFlux 허용 (Gateway 한정)

## Port

- 외부/내부: 8080

## Build

```bash
./gradlew :gateway:build
```
