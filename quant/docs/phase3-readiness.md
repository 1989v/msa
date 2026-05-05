# Phase 3 Readiness Checklist

**서비스**: quant
**Phase**: 3 (실매매 / Live Trading)
**작성일**: 2026-05-05
**기준 ADR**: [ADR-0037](../../docs/adr/ADR-0037-quant-phase3-live-trading.md) (Accepted via J1 default closure)

---

## 빌드 & 테스트

- [x] `./gradlew :quant:domain:test` — Phase 3 도메인 invariant + chain verify spec green
- [x] `./gradlew :quant:app:test` — Phase 3 application service spec green
- [x] `./gradlew :quant:app:bootJar` — 실행 JAR 생성
- [x] `kubectl kustomize k8s/overlays/k3s-lite` — overlay 빌드 검증
- [ ] Docker 환경에서 `*IntegrationSpec*` 1회 수동 (Testcontainers MySQL+Redis) — M7 진행

## 코드 품질

- [x] domain 모듈 (live/, twofa/) Spring/JPA import 0건
- [x] @Transactional 클래스 레벨 0건
- [x] AuditEvent payload 평문 secret/credential 0건 (canonical JSON 정렬, AES-GCM 평문은 메모리 내만)
- [x] Clean Architecture validator PASS (J H8)
- [x] LiveOrderRecord invariant + LiveDomainSpec property 통과

## Phase 3 코어 (코드 완료 / 운영 wire-up 대기)

### 도메인 (G4 / H5)

- [x] `LiveTradingMode` sealed (Disabled/Enabled/Suspended)
- [x] `RiskLimit` (default 100k/1M/100k) + breach 평가
- [x] `KillSwitch` 3-레벨 sealed + `KillSwitchSnapshot`
- [x] `AuditEvent` SHA-256 chain (append + verify)
- [x] `LiveOrderRecord` (Phase 2 페이퍼 OrderRecord 와 분리)
- [x] `TwoFactorSecret` + 백업 코드 hash 8개
- [x] `TotpVerifier` RFC 6238 (HMAC-SHA1, ±1 step) — RFC 6238 Appendix B test vectors PASS

### 인프라 어댑터 (K1)

- [x] JPA 4: TwoFactorSecret / RiskLimit / KillSwitchLog / AuditEvent / LiveTradingState / LiveOrderRecord
- [x] Redis 4: KillSwitchState (multiGet) / RiskMetrics (HINCRBYFLOAT) / TwoFactorTokenStore (GETDEL atomic) / TwoFactorRateLimiter (5/min)

### Application (K2 / L1~L6)

- [x] `TwoFactorService` — register / verify / 백업 코드 + AES-256-GCM + KMS envelope + RateLimiter
- [x] `LiveModeService` — enable/disable (2FA redeem) + suspend (자동/Admin)
- [x] `KillSwitchService` — Redis state + MySQL append 이중 write
- [x] `RiskLimitService` — PreOrderResult + recordOrderAndCheck 자동 trigger
- [x] `AuditChainService` — canonical JSON + SHA-256 chain + verify
- [x] `PlaceLiveOrderUseCase` — 7-stage 게이트 (live-mode → kill-switch G/T/S → risk-limit loss/vol/single)
- [x] `CancelLiveOrderUseCase` — tenant 검증 + 거래소 cancel + AuditEvent
- [x] `LiveOrderReconcileJob` — 5분 cron + status 진척 + 수량 mismatch suspend + LOST 6h

### REST API (K5 / L6)

- [x] 12 엔드포인트 (2FA / live-mode / risk-limit / kill-switch tenant/strategy/global / orders / audit-log)
- [x] `QuantPhase3ExceptionHandler` — 6 ExchangeException 매핑

### Frontend (K6)

- [x] `/quant/live-trading` — 4 패널 (2FA / Live Mode / Risk Limit / Kill Switch)
- [x] `liveTrading.ts` API 클라이언트 (10 endpoint)
- [ ] FE 빌드 type drift 픽스 — M6

### Observability (K7)

- [x] `QuantPhase3Metrics` — 6 메트릭 facade
- [x] PrometheusRule — P1 2건 + P2 3건 + P3 1건
- [x] Grafana dashboard 7 패널

### 자동 trigger (L5)

- [x] PlaceLiveOrderUseCase 사후 누적 → SuspendReason 시 KillSwitch + LiveMode suspend
- [x] AuditChainVerifyJob mismatch → tenant suspend
- [x] ReconcileJob drift → tenant suspend

---

## Beta 진입 게이트 (Phase 3 wire-up 후)

- [ ] **거래소 어댑터 추가** — 빗썸 외 업비트/Bybit/OKX 3종 (실 API key + WireMock 시나리오 5종/거래소)
- [ ] **OQ-011 / OQ-019 운영자 법무 자문 결과 반영** — 잠정 default 에 변경 시 ADR-0037 Errata
- [ ] **OCI Vault 운영 자격증명 등록** + `OciVaultKmsAdapter` 통합 검증
- [ ] **Beta 환경 변수**: `QUANT_LIVE_TRADING_ENABLED=true`, `QUANT_BITHUMB_LIVE_ENABLED=true`,
  `QUANT_RECONCILE_ENABLED=true`, `QUANT_AUDIT_VERIFY_ENABLED=true`,
  `QUANT_AUDIT_VERIFY_TENANTS=<admin-tenant-uuid>`
- [ ] **Admin 1인 1주 monitoring**:
  - 일일 한도 100k KRW 강제
  - daily audit verify 결과 모니터링
  - kill-switch reflect ≤200ms 반복 측정
- [ ] **Closed Beta** — 신청자 5명, 일일 한도 100k 강제, 1주 monitoring

---

## 알려진 제약 / 후속 정통화

| 영역 | 제약 | 정통 처리 |
|---|---|---|
| `tenantId.toUserId()` | `value.hashCode()` 매핑 | 별도 user_id ↔ tenant_id 매핑 테이블 (Phase 4) |
| `tenantId` UUID 강제 | `RiskLimitJpaAdapter.toUuid` 가 String → UUID 변환 실패 시 throw | 운영 데이터는 UUID format 보장 |
| KMS 버전 추적 | `WrappedDek.kekVersion="current"` 단순화 | KMS adapter 가 ciphertext prefix 로 인식 (Phase 2 EnvelopeUpdateExecutor 패턴) |
| LiveOrderController.list | 페이징 placeholder | `findByTenantPage` 추가 후 wire-up |
| TwoFactor register 응답 | 평문 secret 메모리 GC 의존 | wipe(0) best-effort — JNI off-heap 검토 (Phase 4) |
| 거래소 어댑터 4종 | 빗썸만 구현 | 업비트/Bybit/OKX 추가 (사용자가 보류 명시) |
| FE type drift | 기존 ChartsPage / LearnPage build 실패 | M6 |

---

## 종합 판정

**Phase 3 백엔드 코어 + FE 페이지 + Observability 출고 가능.**

자동화된 검증이 통과한 항목 (체크된 항목)은 코드/테스트/문서 모두 정합. Phase 3 신규 spec ~50+ green.

Beta 진입 전 잔여 항목:
1. 거래소 어댑터 wire-up (사용자 환경 의존)
2. OCI Vault 운영 자격증명 등록 + 통합 검증
3. Phase 3 통합 테스트 (M7) — Testcontainers MySQL + Redis
4. FE type drift 픽스 (M6)
5. Admin 1인 1주 모니터링 후 Closed Beta

---

## 다음 단계

1. M5 NetworkPolicy 강화 (OQ-015 default closure)
2. M6 FE type drift 픽스
3. M7 Phase 3 IntegrationSpec
4. 거래소 어댑터 wire-up — 사용자 API key 발급 후 빗썸 패턴 복사
5. ADR-0037 OQ-011/019 운영자 자문 결과 반영
6. Admin 1인 Beta 시작 → Closed Beta → GA
