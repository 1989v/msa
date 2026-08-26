# Search Service

OpenSearch 기반 읽기 전용 검색 모델 서비스 (ADR-0055 로 ES 에서 전환). CDC + Kafka로 상품 데이터를 비동기 인덱싱.
관광지(`attractions` 인덱스)는 place SSOT 를 batch 가 일괄 재색인 — Kafka 미경유 (ADR-0065).

## Modules

| Gradle path | 역할 | 배포 형태 |
|---|---|---|
| `:search:domain` | Pure Kotlin 도메인 (검색 모델, 포트) | — |
| `:search:app` | REST API 서버 (port 8083) | Deployment (API tier) |
| `:search:consumer` | Kafka 이벤트 소비 → OpenSearch 인덱싱 (port 8084) | Deployment (Worker tier — 벌크 색인이 쿼리 P99 위협, ADR-0025/0058 로 분리 유지) |
| `:search:batch` | 전체 리인덱싱 / 오프라인 평가 | **CronJob** (ADR-0058 — 상주 Deployment 제거, `search-reindex`/`search-eval-daily`/`attraction-reindex`) |

## 구조 상태 (ADR-0083)

모양은 표준(UseCase 인터페이스 4 · Adapter 4, Port 는 `search:domain` 의 문서화된 예외 위치)이지만 **디렉토리가
레거시**다 (app 21 + domain 4 파일, 아래 "디렉터리 ≠ 패키지" 절). 플랜 P3 에서 `git mv` 후 그 절을 지운다.
application → infrastructure import 2건은 P4.

## 디렉터리 ≠ 패키지 (주의)

`search/app/src/main/kotlin/com/kgd/search/opensearch/` 안의 파일들은 패키지를
**`com.kgd.search.infrastructure.opensearch`** 로 선언한다. 디렉터리 경로와 패키지가 어긋나 있고
Kotlin 은 이를 허용한다.

새 파일을 이 디렉터리에 만들 때 경로를 보고 `com.kgd.search.opensearch` 라고 적으면
같은 디렉터리의 클래스가 **"Unresolved reference"** 로 안 보인다. 이웃 파일의 첫 줄을 보고 맞춘다.


## Commands

```bash
./gradlew :search:app:build        # API 서버 빌드
./gradlew :search:domain:test      # 도메인 테스트
./gradlew :search:consumer:build   # Consumer 빌드
./gradlew :search:batch:build      # Batch 빌드
```

## Key Rules

- **읽기 전용** — OpenSearch 는 Product DB의 읽기 모델, 직접 쓰기 금지
- Kafka 소비 토픽: `product.item.created`, `product.item.updated` (consumer group: `search-indexer`)
- Batch 리인덱싱은 alias swap 방식 — 무중단 전환
- search:domain은 `spring-data-commons`에 의존 (Page/Pageable 포트용)
- 멱등성 패턴 적용 필수 (ADR-0012) — 중복 이벤트 방어

## Docs

- [서비스 상세](docs/service.md) — 아키텍처, 이벤트 흐름, 배치 전략
