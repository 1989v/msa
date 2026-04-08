# Gateway Service

Spring Cloud Gateway 기반 API Gateway. 인증 필터, 라우팅, Rate Limiting 담당.

## Module

단일 모듈 `:gateway` (port 8080)

## Commands

```bash
./gradlew :gateway:build     # 빌드
./gradlew :gateway:bootJar   # bootJar 생성
```

## Key Rules

- **비즈니스 로직 금지** — 라우팅, 인증, 로깅만 수행
- **직접 DB 접근 금지**
- WebFlux 사용은 Gateway에서만 허용 (다른 서비스는 WebMVC)
- JWT 검증 → `AuthenticationGatewayFilter`
- Redis 기반 Rate Limiting 적용 (ADR-0015)

## Docs

- [서비스 상세](docs/service.md) — 필터 체인, 라우트 설정, 보안 구성
