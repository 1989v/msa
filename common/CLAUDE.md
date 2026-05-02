# Common Module

전 서비스 공유 라이브러리. JAR로 배포 (bootJar 아님).

## Module

단일 모듈 `:common`

## Commands

```bash
./gradlew :common:build   # 빌드
./gradlew :common:test    # 테스트
```

## Provided Components

- `ApiResponse<T>` — 표준 API 응답 래퍼
- `BusinessException`, `ErrorCode` — 예외 처리
- `GlobalExceptionHandler` — 중앙 에러 핸들링
- `CommonSecurityAutoConfiguration` — JWT/AES 자동 설정 (`kgd.common.security.enabled`)
- `CommonRedisAutoConfiguration` — Redis 클러스터 자동 설정 (`kgd.common.redis.enabled`)
- `CommonWebClientAutoConfiguration` — WebClient 자동 설정 (`kgd.common.web-client.enabled`)
- `IdempotentEventHandlerAutoConfiguration` — Kafka consumer 멱등 헬퍼 (ADR-0029, `messaging` 패키지). `ProcessedEventRepositoryPort` 구현체를 등록한 서비스에서만 활성. `kgd.common.messaging.idempotent.cleanup.enabled=true` 시 7일 retention 스케줄러 동작.
- `KgdMessagingOutboxAutoConfiguration` — Transactional Outbox 표준 (ADR-0032 Phase 0, `messaging.outbox` 패키지). `OutboxPort` / `OutboxPollingPublisher` / `OutboxEntity` 를 제공. JPA classpath + `outbox.polling.enabled` (default true) 에서 활성. 서비스 application class 가 `@EntityScan` / `@EnableJpaRepositories` 에 `com.kgd.common.messaging.outbox` 패키지를 명시해야 동작.

## Key Rules

- **모든 서비스가 의존** — 변경 시 전체 빌드 영향, L3 리스크
- Auto-Configuration 기반 활성화 (`kgd.common.*` 프로퍼티)
- 새 컴포넌트 추가 시 `docs/service.md` Provided Components 테이블 업데이트 필수

## Docs

- [서비스 상세](docs/service.md) — 컴포넌트 목록, 활성화 방법
