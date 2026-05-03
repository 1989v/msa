# Runbook — Quant 통합 플랫폼 (Phase 1)

ADR-0033 / ADR-0034 / ADR-0035 운영 안내.

## 1. 진입점

| 메뉴 | 라우트 | 비고 |
|---|---|---|
| 자동매매 전략 | `/quant/strategies` | Tranche (기존) + Signal (신규 Phase 1) |
| 차트 분석 | `/quant/charts` | OHLCV + 지표 (placeholder, lightweight-charts 후반) |
| 입문자 학습 | `/quant/learn` | DB CMS, ROLE_ADMIN write |

REST API:
- `/api/v1/strategies/**` (Tranche), `/api/v1/signal-strategies/**` (Signal)
- `/api/v1/charts/{ohlcv,indicators}`
- `/api/v1/learn/indicators/**`

## 2. 데이터 흐름

```
yfinance / FDR  ─[CronJob 매시 +5min / KST 16:30]─▶  Python ingest sidecar
                                                            │ ClickHouse INSERT
                                                            ▼
                                                   quant.ohlcv (자산 무관)
                                                            ▲
quant (Kotlin/Spring) ─ read only ─ 차트 분석 / 백테스트 / 시그널 평가
```

## 3. 자주 묻는 운영 질문

### Q. ingest sidecar 가 실패하면?
- Prometheus 메트릭 `quant_ingest_last_success_timestamp` (Phase 1 후반) 가 stale 표시
- K8s Job 의 backoffLimit=2 — 2회 재시도 후 실패
- 응급 처치: `kubectl -n commerce create job --from=cronjob/quant-ingest-hourly manual-$(date +%s)`

### Q. quant BE 가 부팅 못 함 — `auditDataSource` 부재
- `quant.audit.enabled=false` (default) 일 때 `AuditClickHouseConfig` 비활성. 정상.
- 만약 어딘가 audit 빈을 강제로 활성화시켰다면 `application.yml` env 확인.

### Q. pgvector schema rename (`pattern` → `quant_pattern`) 롤백
1. `DROP TABLE quant_pattern;`
2. charting 서비스로 트래픽 다시 라우팅 (frontend-ingress `/charting/` 살리기)
3. 메인 서비스 재배포로 신규 코드 패스 비활성

### Q. charting → quant 흡수 진행 상태
- Phase 1 (현재): 두 서비스 병행 — quant 의 `/charts` 는 placeholder, charting 은 그대로
- Phase 2 진입 시: charting 패턴/유사도 로직을 Kotlin 으로 포팅 + golden test → charting deployment scale to 0 → ingress 폐기

## 4. 외부 노출 검사

본 플랫폼의 모든 산출물(코드/문서/커밋 메시지)은 외부 도구 출처를 인용하지 않는다.
CI 에서 다음 grep 자동 검사:

```bash
grep -rln "<외부 김프 도구 도메인 키워드>" \
  --exclude-dir=node_modules --exclude-dir=build --exclude-dir=.git . | wc -l
# 0 이어야 통과
```

## 5. 모니터링 메트릭 (Phase 1 후반)

- `quant_ingest_rows_total{source,asset}` — counter
- `quant_ingest_last_success_timestamp{source}` — gauge
- `quant_indicator_calc_latency_seconds{type}` — histogram
- `quant_signal_eval_total{signal_type, triggered}` — counter

## 6. 알려진 한계 (Phase 1)

- `IndicatorCalculator` 는 자체 단순 구현 — ta4j 정통 통합은 Phase 1 후반 follow-up + golden test
- `SignalStrategy` repository 는 in-memory stub — JPA 어댑터 Phase 1 후반
- `OhlcvRepository` 도 in-memory deterministic random walk — ClickHouse JDBC 어댑터 Phase 1 후반
- 어드민 CMS 인증은 `X-Role: ADMIN` 헤더 단순 가드 — auth 통합은 Phase 2

## 7. 관련 문서

- spec: `docs/specs/2026-05-04-quant-unified-platform/planning/spec.md`
- ADRs: `docs/adr/ADR-003{3,4,5}-*.md`, `docs/adr/ADR-0024` Errata, `charting/docs/adr/ADR-001` Errata
- tasks: `docs/specs/2026-05-04-quant-unified-platform/planning/tasks.md`
