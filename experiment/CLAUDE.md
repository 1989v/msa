# Experiment Service

A/B 테스트 실험 관리, 버킷 할당, 결과 분석 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:experiment:domain` | Pure Kotlin 도메인 (Experiment, Variant, 상태 전이) |
| `:experiment:app` | Spring Boot 앱 (port 8091) |

## Commands

```bash
./gradlew :experiment:app:build        # 빌드
./gradlew :experiment:domain:test      # 도메인 테스트 (Spring context 없음)
./gradlew :experiment:app:bootJar      # bootJar 생성
```

## Key Rules

- MySQL 단독 소유 (experiment_db)
- ClickHouse 직접 접근 금지 — 결과 분석은 analytics API 호출
- 버킷 할당: common 모듈 BucketAssigner 사용 (MurmurHash3 결정적 해싱)
- 실험 상태 전이: DRAFT → RUNNING → PAUSED/COMPLETED

## Docs

- [서비스 상세](docs/service.md)
