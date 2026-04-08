# Search Service

Elasticsearch 기반 읽기 전용 검색 모델 서비스. CDC + Kafka로 상품 데이터를 비동기 인덱싱.

## Modules

| Gradle path | 역할 |
|---|---|
| `:search:domain` | Pure Kotlin 도메인 (검색 모델, 포트) |
| `:search:app` | REST API 서버 (port 8083) |
| `:search:consumer` | Kafka 이벤트 소비 → ES 인덱싱 (port 8084) |
| `:search:batch` | 전체 리인덱싱 배치 (port 8085) |

## Commands

```bash
./gradlew :search:app:build        # API 서버 빌드
./gradlew :search:domain:test      # 도메인 테스트
./gradlew :search:consumer:build   # Consumer 빌드
./gradlew :search:batch:build      # Batch 빌드
```

## Key Rules

- **읽기 전용** — ES는 Product DB의 읽기 모델, 직접 쓰기 금지
- Kafka 소비 토픽: `product.item.created`, `product.item.updated` (consumer group: `search-indexer`)
- Batch 리인덱싱은 alias swap 방식 — 무중단 전환
- search:domain은 `spring-data-commons`에 의존 (Page/Pageable 포트용)
- 멱등성 패턴 적용 필수 (ADR-0012) — 중복 이벤트 방어

## Docs

- [서비스 상세](docs/service.md) — 아키텍처, 이벤트 흐름, 배치 전략
