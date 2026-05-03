# Quant Service — 통합 트레이딩 플랫폼

자동매매 전략(분할/시그널/융합) + 차트 분석 + 입문자 지표 학습을 단일 서비스로 통합 (ADR-0033).
자산 클래스 무관 (`Asset` / `Market` 추상화). Phase 1 은 빗썸 암호화폐 + sealed `Strategy` 도입.

## 메뉴 (FE `/quant/`)

| 라우트 | 메뉴 |
|---|---|
| `/quant/strategies` | 자동매매 전략 (Tranche / Signal — Phase 1, Hybrid — Phase 3) |
| `/quant/charts` | 차트 분석 (OHLCV + ta4j 지표 + 패턴 유사도) |
| `/quant/learn` | 입문자 지표 학습 CMS (DB 기반) |

## Strategy sealed (ADR-0033)

- `TrancheStrategy` — 분할 진입 (기존)
- `SignalStrategy` — single-source 시그널 (Phase 1 신규): VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze
- `HybridStrategy` — 합성 (Phase 3)

## Modules

| Gradle path | 역할 |
|---|---|
| `:quant:domain` | Pure Kotlin 도메인 (Asset/Market/Strategy sealed/Tranche/Signal/IndicatorContent) |
| `:quant:app` | Spring Boot 앱 (port 8094) — REST + ta4j + multik + JPA + ClickHouse + pgvector |
| `quant/ingest/` | Python sidecar (별도 lifecycle) — yfinance/FDR → ClickHouse insert |
| `quant/frontend/` | React SPA (basename `/quant/`) — 메뉴 3종 |

## Commands

```bash
./gradlew :quant:app:build            # 빌드
./gradlew :quant:domain:test          # 도메인 테스트 (불변식 property-based)
./gradlew :quant:app:test             # app 테스트 (UseCase, 컨트롤러 등)
./gradlew :quant:app:bootJar          # 실행 JAR
./gradlew :quant:app:bootRun --args='--spring.profiles.active=ingest-bithumb'
                                            # 빗썸 히스토리 수집 배치
```

## Phase 로드맵

| Phase | 범위 | 상태 |
|---|---|---|
| Phase 1 | 백테스트 엔진 + ClickHouse 스키마 + REST API + FE 스캐폴드 | 출고 가능 |
| Phase 2 | 페이퍼 트레이딩 (WebSocket 시세 + SimulatedExchangeAdapter + Telegram + OCI Vault KEK + audit chain) | 진행 중 (Errata: 빗썸 인증 = JWT(HS256), ADR-0024 Errata 참조) |
| Phase 3 | 실매매 (빗썸/업비트 실 주문 + Rate Limiter + Kill-switch + 2FA) | TBD |

## Key Rules

- 분할 원칙 정통 구현 — 손절 없음(원칙 7), 레버리지 금지(원칙 2, `SpotOrderType` sealed), 회차별 독립 익절
- Clean Architecture 엄수 — domain 모듈에 Spring/JPA 금지
- ADR-0002 런타임: MVC + JPA blocking + Coroutine 외부 IO + Tomcat 가상 스레드
- ClickHouse `quant` DB 별도 소유 — analytics DB 직접 참조 금지
- 모든 도메인 이벤트는 Outbox 패턴 (MySQL outbox → Phase 2 Kafka relay)
- tenantId 필수 (INV-05) — 모든 Repository port 시그니처 강제
- 민감정보(API key / Bot token / 평문 credential) 로그 금지 — `ExchangeCredential`, `DecryptedCredential` `toString()` 마스킹 적용

## Observability (Phase 1)

- Prometheus scrape: `/actuator/prometheus`
- Phase 1 메트릭:
  - `quant_backtest_run_total{status}` — 백테스트 성공/실패 카운터
  - `quant_backtest_run_duration_seconds` — 백테스트 소요시간 (p50/p95/p99)
  - `quant_strategy_evaluation_latency_seconds{mode="backtest"}` — 전략 평가 지연
  - `quant_ingest_bithumb_rows_total{symbol}` — 빗썸 수집 insert row 수
  - `quant_outbox_pending_rows` — outbox 미발행 행 수 (gauge)

## Docs

- [Spec](../docs/specs/2026-04-24-quant-crypto-trading/planning/spec.md)
- [Requirements](../docs/specs/2026-04-24-quant-crypto-trading/planning/requirements.md)
- [ADR-0024](../docs/adr/ADR-0024-quant-service.md)
- [Phase 1 Readiness](docs/phase1-readiness.md) (TG-15에서 생성)

## Open Questions (Phase 2/3 Blockers)

- OQ-011 거래소 약관 자동매매 허용 — Phase 1 선행
- OQ-012 손실 한도 — Phase 3
- OQ-013 글로벌 kill-switch — Phase 3
- OQ-014 주문 reconcile — Phase 3
- OQ-015 Gateway 우회 차단 — Phase 3
- OQ-016 실매매 2FA — Phase 3
- OQ-017 KEK 회전 — Phase 2
- OQ-018 audit_log 불변성 — Phase 2
