# Experiment Service

A/B 테스트 실험 관리, 버킷 할당, 결과 분석 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:experiment:domain` | Pure Kotlin 도메인 (Experiment, Variant, 상태 전이) |
| `:experiment:feature` | 비-bootable 라이브러리. `engagement:app` 에 폴드 (ADR-0093). 전용 datasource 는 `ExperimentDataSourceConfig` 가 배선 |

## 구조 상태 (ADR-0083)

표준 준수 (2026-08-26, P4 완료) — `application/experiment/{usecase,port,service,dto}`. UseCase 인터페이스 6 · Port 2(`ExperimentRepositoryPort`·`AnalyticsMetricsPort`) · 서비스 2(`ExperimentService`·`ExperimentResultService`). analytics 호출은 포트 뒤.

## Commands

```bash
./gradlew :engagement:app:build        # 호스트 앱 (experiment 포함)
./gradlew :experiment:domain:test      # 도메인 테스트 (Spring context 없음)
./gradlew :engagement:app:bootJar      # bootJar 생성
```

## Key Rules

- MySQL 단독 소유 (experiment_db)
- **자동 구성에 기대지 않는다** — 같은 파드의 recommendation 이 `clickHouseDataSource` 를 만들어
  `DataSourceAutoConfiguration` 이 back-off 하면 MySQL 연결과 JPA 가 조용히 사라진다.
  `ExperimentDataSourceConfig` 가 명시로 만들고, `EngagementContextLoadSpec` 이 그걸 고정한다
- ClickHouse 직접 접근 금지 — 결과 분석은 analytics API 호출
- 버킷 할당: common 모듈 BucketAssigner 사용 (MurmurHash3 결정적 해싱)
- 실험 상태 전이: DRAFT → RUNNING → PAUSED/COMPLETED

## Docs

- [common 모듈 BucketAssigner](../common/CLAUDE.md) — MurmurHash3 결정적 해싱 패턴
