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
| `web` | `CrawlerUserAgents` | 자기소개형 크롤러·헤드리스 UA 판별 — analytics 원장(ADR-0095)과 game 랭킹 제출(ADR-0084 개정)이 같은 목록을 쓴다 |
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
| `shortlink` | `ShortCode` | 공개 콘텐츠 단축 코드 — id(0~2^40−1) 고정 순열 + base62 6~7자. 해석 실패는 `null`. **순열 상수 변경 금지**(퍼진 주소가 깨진다, ADR-0103) |
| `shortlink` | `ShortLinkPrefix` | 단축 주소 접두사 `r`·`p`·`g`·`b` |
| `shortlink` | `ShortLinkProperties` | `kgd.common.short-link.*` — `origin`(기본 `https://1989v.com`), `resume-origin`·`place-origin`·`game-origin`·`blog-origin`, `expose`(기본 `false`) |
| `shortlink` | `ShortLinks` | 단축 주소·목적지(경로 세그먼트 인코딩)·서비스 홈 조립. 호스트는 설정에서만 얻고 요청을 받지 않는다 |
| `shortlink` | `ShortLinkRedirects` | 302 응답(`no-store`, `X-Robots-Tag: noindex, nofollow`) 조립. 상태 없는 object — 컨트롤러가 주입 없이 부른다 |
| `shortlink` | `ShortLinkPath` | 접두사 뒤 경로를 `Home`(빈 경로·`/`·`list`)·`Code`(세그먼트 1개)·`Invalid`(2개 이상)로 가른다. 코드 형식은 판정하지 않는다 |
| `shortlink` | `ShortLinkAutoConfiguration` | `ShortLinks` 빈 등록 (조건 없음, `@ConditionalOnMissingBean`) |
| `crawler` | `CrawlerUserAgents` | 스스로 밝히는 크롤러·메신저 미리보기 봇(카카오톡 스크랩·Slack·Discord 등) UA 판별. UA 없음도 크롤러 |

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
