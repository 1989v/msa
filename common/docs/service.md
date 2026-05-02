# Common Module

## Overview

모든 서비스가 공유하는 라이브러리 모듈.
`bootJar` 없이 `jar`만 생성한다 (실행 가능 JAR 아님).

## Module

단일 모듈: `:common` (`common/`)

## Base Package

`com.kgd.common`

## Provided Components

| Package | Component | Role |
|---------|-----------|------|
| `response` | `ApiResponse<T>` | 표준 API 응답 래퍼 |
| `exception` | `BusinessException` | 비즈니스 예외 기본 클래스 |
| `exception` | `ErrorCode` | 에러 코드 enum |
| `exception` | `GlobalExceptionHandler` | 전역 예외 핸들러 |
| `security` | `CommonSecurityAutoConfiguration` | JWT/AES auto-configuration (`kgd.common.security.enabled`) |
| `security` | `JwtUtil` | JWT 토큰 생성/검증 유틸 |
| `security` | `JwtProperties` | JWT 설정 프로퍼티 |
| `security` | `AesUtil` | AES 암호화 유틸 |
| `redis` | `CommonRedisAutoConfiguration` | Redis 클러스터 auto-configuration (`kgd.common.redis.enabled`) |
| `webclient` | `CommonWebClientAutoConfiguration` | WebClient auto-configuration (`kgd.common.web-client.enabled`) |
| `webclient` | `WebClientBuilderFactory` | 공통 정책 builder를 clone하여 서비스별 client 생성 |
| `messaging` | `IdempotentEventHandler` | Kafka consumer 멱등 헬퍼 — `(eventId, consumerGroup)` dedup + race 흡수 (ADR-0029) |
| `messaging` | `ProcessedEventRepositoryPort` | `processed_event` 영속화 추상화 (각 서비스가 JPA 어댑터 구현) |
| `messaging` | `ProcessedEventRecord` | DTO (JPA 의존성 0) — Port 시그니처용 |
| `messaging` | `IdempotentMetrics` | Micrometer counters (`kgd_idempotent_processed_total`, `kgd_idempotent_event_missing_id_total`) |
| `messaging` | `IdempotentEventCleanupScheduler` | 7일 retention `@Scheduled` cron (opt-in, `kgd.common.messaging.idempotent.cleanup.enabled`) |
| `messaging` | `IdempotentEventHandlerAutoConfiguration` | `@ConditionalOnBean(ProcessedEventRepositoryPort)` — Port 미등록 서비스는 자동 비활성화 |
| `messaging.outbox` | `OutboxEntity` | `outbox_event` 테이블 매핑 JPA `@Entity` (ADR-0032 Phase 0) |
| `messaging.outbox` | `OutboxRepository` | `JpaRepository<OutboxEntity, Long>` — `findAllByStatusOrderByCreatedAtAsc("PENDING")` 등 |
| `messaging.outbox` | `OutboxPort` | application 측 의존 인터페이스 — 비즈니스 TX 안에서 `save(...)` 호출 |
| `messaging.outbox` | `OutboxJpaAdapter` | default `OutboxPort` 구현. 서비스가 자체 `OutboxPort` 빈을 등록하면 그쪽이 우선 |
| `messaging.outbox` | `OutboxPollingPublisher` | `@Scheduled` (`outbox.polling.interval-ms`, default 1s) 로 PENDING row → Kafka 발행 |
| `messaging.outbox` | `OutboxMetrics` | Micrometer counters (`outbox_publish_total`, `outbox_publish_error_total`) |
| `messaging.outbox` | `KgdMessagingOutboxAutoConfiguration` | `@ConditionalOnClass(JpaRepository)` + `outbox.polling.enabled` (default true) — 서비스 application class 가 `@EntityScan` / `@EnableJpaRepositories` 에 `com.kgd.common.messaging.outbox` 패키지를 명시해야 동작 |

## Usage

각 서비스 모듈의 `build.gradle.kts`에서:

```kotlin
implementation(project(":common"))
```

domain 모듈도 `BusinessException`/`ErrorCode` 사용을 위해 common에 의존한다.

## Build

```bash
./gradlew :common:build
./gradlew :common:test
```
