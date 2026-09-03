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

표준 준수 (2026-08-26, P3·P4·P7 완료) — 디렉토리 == 패키지, application → infrastructure import 0, presentation → infrastructure 0. `SearchDebugController` 가 직접 들고 있던 OpenSearch·리랭커·프로퍼티 9개는 `SearchDebugPort` + `SearchDebugAdapter` 뒤로 옮겼다(응답 JSON 무변경). 실험 variant 해석은 `SearchVariantPort` 뒤로(실험 on/off·비로그인 판정은 어댑터가 접는다). UseCase 인터페이스 4 · Adapter 4, Port 는 `search:domain` 의 문서화된 예외 위치.

## Commands

```bash
./gradlew :search:app:build        # API 서버 빌드
./gradlew :search:domain:test      # 도메인 테스트
./gradlew :search:consumer:build   # Consumer 빌드
./gradlew :search:batch:build      # Batch 빌드
```

## 인덱스 문서 계약 (ADR-0083 §5-1)

인덱스마다 **쓰기(`:batch`·`:consumer`)와 읽기(`:app`) 문서 클래스가 따로 있고, 합치지 않는다** — 셋은 별개
배포 단위라 클래스를 공유하면 색인 쪽 필드 추가가 검색 API 재배포를 강제하고, 애너테이션 비대칭
(`쓰기 @JsonInclude(NON_NULL)` / `읽기 @JsonIgnoreProperties(ignoreUnknown = true)`)이 그 독립 배포를 가능하게 한다.

**계약의 SSOT 는 클래스가 아니라 `search/batch/src/main/resources/opensearch/*-index.json` 이다.**
읽기 클래스는 `ignoreUnknown = true` 라 필드를 빠뜨려도 컴파일이 통과하고 값만 조용히 빈다 —
`verifyArchitecture` 의 `verifySearchIndexContract` 가 매핑 키와 클래스 필드를 맞춰본다
(쓰기는 정확히 일치, 읽기는 부분집합 + 빠진 이유를 루트 `build.gradle.kts` 의 `searchReadOmitted` 에).

| 인덱스 | 쓰기 | 읽기 | 필드 |
|---|---|---|---|
| `regions` | `RegionIndexDocument` (batch) | `RegionSearchDocument` (app) | 7 / 7 |
| `attractions` | `AttractionIndexDocument` (batch) | `AttractionSearchDocument` (app) | 21 / 19 — `idSort`·`titleJamo` 쓰기 전용 |
| `products` | `ProductIndexDocument` (batch·consumer 2벌) | `ProductSearchDocument` (app) | 26 / 26 |

`ProductIndexDocument` 2벌은 둘 다 쓰기 측이라 분리 근거가 없는 순수 중복이다. 게이트가 드리프트를 잡으므로
**세 번째 사본이 생길 때** 공유 모듈을 만든다(지금 묶으면 두 배포 단위를 다시 붙인다).
`GeoPoint` 는 각 모듈의 top-level — 한쪽 문서의 중첩 타입으로 두면 별개 인덱스가 남의 문서에 묶인다.

## Key Rules

- **읽기 전용** — OpenSearch 는 Product DB의 읽기 모델, 직접 쓰기 금지
- Kafka 소비 토픽: `product.item.created`, `product.item.updated` (consumer group: `search-indexer`)
- Batch 리인덱싱은 alias swap 방식 — 무중단 전환
- search:domain은 `spring-data-commons`에 의존 (Page/Pageable 포트용)
- 멱등성 패턴 적용 필수 (ADR-0012) — 중복 이벤트 방어

## Docs

- [서비스 상세](docs/service.md) — 아키텍처, 이벤트 흐름, 배치 전략
