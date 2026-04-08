# Discovery Service

Spring Cloud Netflix Eureka 기반 서비스 디스커버리.

## Module

단일 모듈 `:discovery` (port 8761)

## Commands

```bash
./gradlew :discovery:build     # 빌드
./gradlew :discovery:bootJar   # bootJar 생성
```

## Key Rules

- 모든 서비스가 Eureka에 등록, Gateway가 Eureka를 통해 서비스 탐색
- 설정 변경 시 전체 서비스에 영향 — L3 리스크로 취급

## Docs

- [서비스 상세](docs/service.md) — Eureka Server 구성
