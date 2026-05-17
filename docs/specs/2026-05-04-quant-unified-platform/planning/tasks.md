<!-- source: quant -->
---
spec: quant-unified-platform
date: 2026-05-04
parent: spec.md
phase: Phase 1
status: ready-for-approval
---

# Tasks — Quant 통합 플랫폼 Phase 1

## 의존성 그래프 (간략)

```
Foundation (T01~T04)
   ├── Domain (T05~T08)        ← Strategy sealed / Asset/Market
   ├── Storage (T09~T12)       ← MySQL/ClickHouse/pgvector schema
   └── Adapter (T13~T15)       ← MarketAdapter / FxRateProvider / ta4j
         ↓
Application (T16~T20)           ← UseCase / Query
         ↓
Presentation (T21~T24)          ← REST controller / 권한
         ↓
Frontend (T25~T28)              ← /quant SPA 통합
         ↓
Ingest (T29~T31)                ← Python sidecar
         ↓
Migration (T32~T35)             ← pgvector rename / charting 흡수
         ↓
Validation (T36~T38)
```

병렬 가능: Domain ↔ Storage ↔ Adapter ↔ Ingest 는 서로 독립 시작 가능

---

## T01. ADR 5건 / spec 산출물 git 정리
- 산출물: `docs/adr/ADR-0033/0034/0035.md`, `charting/docs/adr/ADR-001` Errata, `docs/adr/ADR-0024` Errata
- Done: spec/requirements/spec-review/tasks/open-questions 모두 commit + push
- 의존: 없음

## T02. Gradle 의존성 추가
- `:quant:domain` → 변경 없음
- `:quant:app` → ta4j (RSI/MACD/MA/BB), DJL or multik (임베딩)
- libs.versions.toml 업데이트
- Done: `./gradlew :quant:app:build` 성공

## T03. CLAUDE.md / docs/README 갱신
- 루트 CLAUDE.md 의 quant 행 — 통합 플랫폼 설명 추가
- quant/CLAUDE.md — 신규 메뉴 / sealed Strategy / ingest sidecar 명시
- charting/CLAUDE.md — Phase 2 deprecation 안내
- Done: docs/doc-index.lock.json 갱신

## T04. K8s 매니페스트 — quant-ingest CronJob 스켈레톤
- `k8s/base/quant-ingest/cronjob.yaml` (image placeholder, schedule)
- overlays/k3s-lite 에 patches 추가
- Done: kubectl kustomize 통과

---

## Domain (Pure Kotlin, no Spring)

## T05. `Asset` / `Market` 도메인 도입
- `:quant:domain/asset/Asset.kt`, `AssetCode`, `AssetClass(CRYPTO/STOCK_KR/STOCK_US)`
- `:quant:domain/market/Market.kt`, `MarketCode`
- Done: property-based test (값 검증)

## T06. sealed `Strategy` 도입
- `:quant:domain/strategy/Strategy.kt` sealed
- 기존 `TrancheStrategy` 가 자식이 되도록 이동 + import 경로 수정
- Done: `:quant:domain:test` PASS, 기존 테스트 깨지지 않음

## T07. `SignalStrategy` + `SignalConfig` sealed
- `SignalConfig`: VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze
- 각 타입별 valid 조건 (period > 0, threshold 범위 등) property-based test
- Done: 4종 시그널 단위 테스트

## T08. `PositionSizing` sealed + `IndicatorContent` 도메인
- PositionSizing: FixedKrw / PercentBalance / FixedQuantity
- IndicatorContent + IndicatorExample 데이터 클래스
- Done: 도메인 invariant 테스트

---

## Storage / Adapter

## T09. MySQL 스키마 — strategy 단일 테이블 + signal_strategy_run
- Flyway V20260504_001__strategy_unified.sql
- type 컬럼(TRANCHE/SIGNAL/HYBRID), config_json
- 기존 `tranche_strategy` 데이터 신규 `strategy` 로 마이그레이션
- Done: Testcontainers 마이그레이션 검증

## T10. MySQL 스키마 — indicator_content + indicator_revision
- Flyway V20260504_002__indicator_cms.sql
- slug UNIQUE, body_md TEXT, examples_json JSON
- Done: 마이그레이션 검증

## T11. ClickHouse 스키마 — quant.ohlcv 단일 테이블 + signal_eval
- Flyway/스크립트 V20260504_003__ohlcv_unified.sql
- partition by toYYYYMM(ts), order by (asset_code, market_code, ts, interval)
- Done: dummy insert + select 성능 측정

## T12. pgvector schema rename `pattern` → `quant_pattern`
- Flyway V20260504_004__pattern_rename.sql (CREATE TABLE quant_pattern + INSERT SELECT + DROP pattern)
- 데이터 dual-write 윈도우 7일
- Done: 마이그레이션 + 검색 결과 동등성 골든 테스트

## T13. `MarketAdapter` 인터페이스 일반화
- 기존 `ExchangeAdapter` → `MarketAdapter` rename
- BithumbMarketAdapter (CRYPTO 전용) 그대로 호환
- Done: 기존 백테스트 path 통과

## T14. `FxRateProvider` port + BithumbUsdtKrwProxy
- port: `krwPerUsd(at: Instant): BigDecimal`
- 구현: 빗썸 USDT_KRW ticker 호출 + 1분 cache
- Done: integration test (Testcontainers + bithumb mock)

## T15. ta4j 통합 + IndicatorCalculator
- RSI / MACD / SMA / EMA / BB / Ichimoku / Volume
- 입력: List<Bar>, 출력: 시계열
- Done: ta4j 결과를 도메인 모델로 매핑

---

## Application / UseCase

## T16. `RegisterStrategyUseCase` (type-aware)
- TRANCHE / SIGNAL polymorphic 처리
- 검증: market 이 asset.class 지원하는지
- Done: UseCase 단위 테스트 (Kotest + MockK)

## T17. `RunBacktestUseCase` for SignalStrategy
- ClickHouse OHLCV read → ta4j 시그널 평가 → PaperExchangeAdapter → run insert
- Outbox: BacktestCompletedEvent
- Done: integration test (Testcontainers)

## T18. `OhlcvQuery` / `IndicatorQuery` / `SimilarityQuery`
- Charts 메뉴용 read-only Query
- pgvector cosine top-K
- Done: 단위 테스트 + integration

## T19. `IndicatorContentUseCase` (CMS CRUD)
- ROLE_ADMIN write, public read (slug)
- revision 자동 생성
- Done: 권한 검증 테스트

## T20. `AssetSearchQuery` + 자산 카탈로그 시드
- 빗썸 marketable + 주요 KR/US 주식 시드 (~200종)
- 자동완성용 인덱스
- Done: ngram 검색 테스트

---

## Presentation (REST)

## T21. StrategyController / BacktestController
- `/api/v1/strategies/**` — 기존 path 유지하며 type 라우팅
- Jackson polymorphic (type discriminator)
- Done: API contract test

## T22. ChartController
- `/api/v1/charts/{ohlcv,indicators,similarity,prediction}`
- Done: contract + e2e

## T23. LearnController (CMS)
- `/api/v1/learn/indicators/**`
- ROLE_ADMIN 가드
- Done: 권한 단위 테스트

## T24. Gateway routes 추가
- `quant-service` predicate 에 `/api/v1/charts/**`, `/api/v1/learn/**`, `/api/v1/assets/**` 추가
- Done: gateway 라우팅 smoke

---

## Frontend (`quant/frontend`)

## T25. SPA 라우팅 통합 + 메뉴 3종
- `/strategies`, `/charts`, `/learn` 라우트
- BottomNav / Sidebar 갱신
- Done: 진입 smoke

## T26. Strategy 등록 화면 — type selector + SignalConfigForm
- TRANCHE / SIGNAL 폼 분리
- VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze 각 폼
- Done: 4종 폼 입력 → 백엔드 등록

## T27. Charts 메뉴 — OhlcvChart + IndicatorTogglePanel + PatternSimilarityPanel
- lightweight-charts 통합 (기존 charting 흡수)
- 지표 토글 (RSI/MACD/MA/BB)
- 패턴 유사도 결과 inline 차트
- Done: 자산 검색 → 차트 표시

## T28. Learn 메뉴 — 카탈로그 + 상세 + 어드민 CMS
- markdown + KaTeX 렌더링
- ROLE_ADMIN 시 CMS 폼 노출
- Done: 6종 지표 시드 콘텐츠 등록

---

## Ingest sidecar (Python)

## T29. quant/ingest 스캐폴드
- pyproject.toml + Dockerfile + src 구조
- ClickHouse driver (clickhouse-connect)
- Done: docker build 성공

## T30. yfinance / FinanceDataReader source 어댑터
- 증분 ingest (last_ts 이후)
- 멱등 — `(asset, market, ts, interval)` UNIQUE
- Done: dummy ticker 1주일 데이터 insert

## T31. K8s CronJob + Prometheus 메트릭
- cronjob.yaml: 시간봉 매시 +5min, 일봉 KST 16:30
- 메트릭: `quant_ingest_rows_total{source,asset}`, `quant_ingest_last_success_timestamp`
- Done: 클러스터 적용 + 1회 실행 검증

---

## Migration / Compatibility

## T32. 임베딩 numpy → DJL/multik 포팅 + golden test
- 동일 60일 입력 → 32차원 출력 cosine ≥ 0.9999
- charting Python 측을 fixture 로
- Done: 골든 테스트 PASS

## T33. charting 패턴 검색 API 흡수
- POST /api/v1/charts/similarity 가 기존 charting 결과와 일치
- dual-call 윈도우 (FE 가 두 endpoint 호출 후 비교)
- Done: 24h dual-call 후 결과 일치율 ≥ 99.9%

## T34. charting 서비스 stop 준비 (Phase 1 종료)
- charting deployment scale to 0
- ingress `/charting/` 제거 → 단일 `/quant/charts` 로 redirect
- Done: 사용자 트래픽이 quant 로만 라우팅됨을 24h 모니터

## T35. ADR-001 Status → Superseded (Phase 2 진입 시)
- charting/docs/adr/ADR-001 Status 변경
- charting 디렉토리 폐기 PR
- Done: Phase 2 진입 ADR 별도

---

## Validation

## T36. 외부 노출 키워드 검사
- grep 자동 검사: 모든 산출물에 외부 도구/사이트 출처 0회
- 도메인 용어 화이트리스트만 사용
- Done: CI lint 룰 추가

## T37. e2e smoke
- 자산 검색 → 차트 → 지표 토글 → strategy 등록 (TRANCHE/SIGNAL) → 백테스트 → leaderboard
- 학습 메뉴 6종 콘텐츠 진입
- Done: playwright 시나리오 PASS

## T38. 운영 문서 / Runbook
- ingest sidecar 실패 시 대응
- pgvector schema rename 롤백 절차
- charting → quant 마이그레이션 체크리스트
- Done: docs/runbooks/quant-unified-platform.md

---

## 작업량 추정

| 그룹 | Task 수 | 추정 |
|---|---|---|
| Foundation (T01~T04) | 4 | 0.5주 |
| Domain (T05~T08) | 4 | 1주 |
| Storage / Adapter (T09~T15) | 7 | 1.5주 |
| Application (T16~T20) | 5 | 1주 |
| Presentation (T21~T24) | 4 | 0.5주 |
| Frontend (T25~T28) | 4 | 1.5주 |
| Ingest (T29~T31) | 3 | 0.5주 |
| Migration (T32~T35) | 4 | 1주 |
| Validation (T36~T38) | 3 | 0.5주 |
| **총계** | **38** | **~8주** (1인 기준), **~4주** (2~3인 병렬) |

## Risk / Open Items

- 임베딩 numpy → Kotlin 포팅 결과 동등성 (T32) — 가장 위험 항목, spike 1주 별도
- Strategy sealed Jackson polymorphic 직렬화 — 기존 TrancheStrategy API 호환 보장 필요
- 어드민 CMS 화면을 admin-fe (별도 SPA) 에 추가 vs quant SPA 안에 두기 — admin-fe 추가 시 권한 흐름 통일
