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
