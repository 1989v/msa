# Analytics Service

이벤트 수집, 지표 스코어 산출 (Kafka Streams), 스코어 조회 API 제공.

## Modules

| Gradle path | 역할 |
|---|---|
| `:analytics:domain` | Pure Kotlin 도메인 (Score 모델, 정규화, 포트) |
| `:analytics:app` | Spring Boot 앱 (port 8090) |

## Commands

```bash
./gradlew :analytics:app:build        # 빌드
./gradlew :analytics:domain:test      # 도메인 테스트 (Spring context 없음)
./gradlew :analytics:app:bootJar      # bootJar 생성
```

## Key Rules

- ClickHouse 단독 소유 (analytics DB)
- Kafka Streams로 준실시간 스코어 산출 (1시간 윈도우)
- Redis 캐시: 스코어 TTL 2h, 정규화 stats TTL 1h
- 이벤트 소비 토픽: `analytics.event.collected`, `game.session.started`, `game.session.ended` (ADR-0059 — ClickHouse events 적재)
- Kafka 접속은 `kafka:9092`(CLIENT) — 29092(INTERNAL)는 NetworkPolicy 가 차단, `@EnableKafka` 필수(@KafkaListener 활성화)
- 스코어 발행 토픽: `analytics.score.updated`

## Docs

- [analytics 스코어링 시스템 ADR](../docs/adr/ADR-0017-analytics-scoring-system.md)
