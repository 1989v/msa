# Phase 3 Tasks — Live Trading

> 본 task list 는 [spec.md](spec.md) 의 12개 섹션에 1:1 매핑.
> 우선순위: 도메인 → 보안 → 거래소 어댑터 → 운영 통합 → 베타 출시.

## TG-P3-A: 거버넌스

- [ ] TG-P3-01 OQ-011 (거래소 약관) 4 거래소별 closure
- [ ] TG-P3-02 OQ-012 ~ OQ-020 closure
- [ ] TG-P3-03 ADR-0037 승인 (본 spec 기반)

## TG-P3-B: 도메인 모델 + 마이그레이션

- [ ] TG-P3-04 `LiveTradingMode` sealed + `RiskLimit` + `KillSwitch` value 도메인 클래스
- [ ] TG-P3-05 `OrderRecord` Phase 2 → Phase 3 확장 (audit_hash_*, exchange_order_id)
- [ ] TG-P3-06 `AuditEvent` 도메인 + canonical JSON 직렬화
- [ ] TG-P3-07 Flyway V020 ~ V025 — 6개 신규 테이블 + index
- [ ] TG-P3-08 도메인 invariant 테스트 (BehaviorSpec + property)

## TG-P3-C: 보안 / 2FA

- [ ] TG-P3-09 TOTP 등록 / 검증 / 백업 코드 — `TwoFactorService`
- [ ] TG-P3-10 2FA secret 암호화 (KEK = OCI Vault, ADR-0027 envelope)
- [ ] TG-P3-11 2FA 검증 토큰 (Redis 5분 TTL, one-time)
- [ ] TG-P3-12 Brute force 방어 (Redis rate-limit 5/분)

## TG-P3-D: Kill-Switch + Risk Limit

- [ ] TG-P3-13 `KillSwitchService` (Redis dual write to MySQL)
- [ ] TG-P3-14 `RiskLimitService` + 일일 metric Redis hash
- [ ] TG-P3-15 자동 trigger (DAILY_LOSS_LIMIT / DAILY_VOLUME_LIMIT)
- [ ] TG-P3-16 KST 00:00 일일 reset 배치
- [ ] TG-P3-17 사용자 셀프 토글 API (tenant / strategy)
- [ ] TG-P3-18 글로벌 토글 API (Admin)

## TG-P3-E: 거래소 어댑터

- [ ] TG-P3-19 `LiveExchangeAdapter` 인터페이스 + `OrderPlacement` / `OrderAck` DTO
- [ ] TG-P3-20 BithumbLiveAdapter (JWT HS256, 135 RPS)
- [ ] TG-P3-21 UpbitLiveAdapter (JWT RS256 + nonce, 8 RPS)
- [ ] TG-P3-22 BybitLiveAdapter (HMAC-SHA256, V5 REST)
- [ ] TG-P3-23 OkxLiveAdapter (HMAC-SHA256 + Passphrase, V5 REST)
- [ ] TG-P3-24 어댑터별 WireMock 시나리오 5종 (정상/limit/reject/timeout/5xx)
- [ ] TG-P3-25 RateLimiter 통합 + masking 검증

## TG-P3-F: 주문 라이프사이클

- [ ] TG-P3-26 `PlaceLiveOrderUseCase` — 7단계 게이트 + AuditEvent + OrderRecord 저장
- [ ] TG-P3-27 `CancelLiveOrderUseCase`
- [ ] TG-P3-28 `ReconcileJob` (5분 cron) + drift 처리
- [ ] TG-P3-29 LOST 상태 (6시간 unknown) 처리 + 글로벌 alarm
- [ ] TG-P3-30 mismatch (수량/가격) 시 자동 tenant suspend

## TG-P3-G: Audit Chain

- [ ] TG-P3-31 `AuditChainService` — append + canonical JSON + SHA-256 hash chain
- [ ] TG-P3-32 일일 verify job (KST 03:00, per-tenant 마지막 100k 이벤트)
- [ ] TG-P3-33 Audit S3/GCS 7년 archive (Phase 2 backup pipeline 재활용)

## TG-P3-H: API + Presentation

- [ ] TG-P3-34 12개 엔드포인트 컨트롤러 + DTO + 인증 가드
- [ ] TG-P3-35 GlobalExceptionHandler 확장 (RiskLimitExceededException, KillSwitchActiveException 등)
- [ ] TG-P3-36 OpenAPI / Swagger 스펙 갱신

## TG-P3-I: Frontend

- [ ] TG-P3-37 quant-fe `/quant/live-trading` 페이지 (활성 토글 + 한도 + kill-switch)
- [ ] TG-P3-38 2FA 등록 플로우 (QR + 백업 코드)
- [ ] TG-P3-39 주문 이력 + Audit log 뷰

## TG-P3-J: Observability

- [ ] TG-P3-40 7개 메트릭 추가 (`quant_live_orders_total` 등)
- [ ] TG-P3-41 알람 규칙 (P1: audit chain fail / global kill-switch / P2: drift burst)
- [ ] TG-P3-42 운영자 대시보드 (Grafana)

## TG-P3-K: 출시

- [ ] TG-P3-43 Beta (Admin 1인) — 1주
- [ ] TG-P3-44 Closed Beta (5명) — 일일 한도 강제 100,000 KRW
- [ ] TG-P3-45 GA — 전체 open

## 추정 (참고)

| 그룹 | 예상 |
|---|---|
| A 거버넌스 | 1주 |
| B 도메인 | 1.5주 |
| C 보안 | 1주 |
| D Kill-Switch | 1주 |
| E 어댑터 4종 | 3주 |
| F 라이프사이클 | 1.5주 |
| G Audit | 1주 |
| H API | 1주 |
| I FE | 1.5주 |
| J Observability | 0.5주 |
| K 베타→GA | 4주 (관찰 포함) |
| **총** | **~17주** |
