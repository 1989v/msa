# Phase 2 Readiness Checklist

**서비스**: quant
**Phase**: 2 (페이퍼 트레이딩)
**작성일**: 2026-04-27
**기준 ADR**: [ADR-0024](../../docs/adr/ADR-0024-quant-service.md) (Proposed) + Phase 2 신규 ADR-0025/0026/0027

---

## 출고 전 체크리스트

### 빌드 & 테스트
- [x] `./gradlew :quant:domain:test` — Phase 1 35 tests green 유지
- [x] `./gradlew :quant:app:test` — Phase 2 추가 단위 테스트 모두 green
- [x] `./gradlew :quant:app:bootJar` — 실행 JAR 생성
- [x] `cd quant/frontend && npm run build` — FE 번들 성공 (552 KiB precache)
- [x] `kubectl kustomize k8s/overlays/k3s-lite` — overlay 빌드 검증
- [ ] `./gradlew :quant:app:test --tests '*IntegrationSpec*' -PincludeIntegration=true` — Docker 환경 1회 수동 (Testcontainers MySQL/ClickHouse/Redis/Kafka)

### 코드 품질
- [x] domain 모듈 Spring/JPA import 0건 (Phase 1 유지)
- [x] @Transactional 클래스 레벨 0건 (ADR-0020)
- [x] WebFlux starter 0건 (ADR-0002, gateway만 예외)
- [x] 모든 Repository port 시그니처에 tenantId (INV-05)
- [x] Bot Token / KEK / API Key 평문 로그 0건 (INV-P2-12 + SensitiveDataMaskingSpec)
- [x] WS 콜백 / Hub.emit 경로에 @Transactional 0건 (ADR-0025)

### Phase 2 신규 인프라
- [x] **TG-P2-01** 라이브러리 카탈로그 (resilience4j / oci-sdk / nimbus-jose / caffeine)
- [x] **TG-P2-02** ADR-0024 Errata (빗썸 JWT) docs 정정
- [x] **TG-P2-03** KeyManagementService Port + 3 Adapter (OciVault/LocalFile/Fake) + DEK 캐시 (TTL 30분 + stale-on-error)
- [x] **TG-P2-04** Envelope encryption + V002 (kek_version + dek_wrapped) + LazyReencryptionJob
- [x] **TG-P2-05** audit_log quant_audit DB 분리 + prev_hash 체인 + AuditChainVerifier
- [x] **TG-P2-06** 빗썸 WebSocket Subscriber + REST 폴백 + 재연결 백오프
- [x] **TG-P2-07** MarketDataHub (SharedFlow + 옵셔널 Kafka fan-out + latestTick)
- [x] **TG-P2-08** PaperExchangeAdapter + V003 PaperAccount + FixedSlippageModel(0.05%)
- [x] **TG-P2-09** PAPER UseCase (Start/Stop/Pause/Resume/Status)
- [x] **TG-P2-10** TelegramBotNotificationSender + 우선순위 큐 + per-chat rate limit
- [x] **TG-P2-11** CircuitBreaker 3종 + Redis Lua token bucket + Kafka DLQ
- [x] **TG-P2-12** Outbox → Kafka relay 활성 + ProcessedEvent 멱등 헬퍼
- [x] **TG-P2-13** SSE 컨트롤러 + Gateway long-lived 라우팅
- [x] **TG-P2-14** FE 페이퍼 트레이딩 모니터링 페이지
- [x] **TG-P2-15** K8s k3s-lite overlay Phase 2 패치
- [x] **TG-P2-16** Phase 2 readiness/release notes (본 문서)

### 문서
- [x] [Phase 2 Spec](../../docs/specs/2026-04-26-quant-phase2-paper-trading/planning/spec.md)
- [x] [Phase 2 Requirements](../../docs/specs/2026-04-26-quant-phase2-paper-trading/planning/requirements.md)
- [x] [ADR-0025 MarketDataHub](../../docs/adr/ADR-0025-market-data-hub.md)
- [x] [ADR-0026 audit immutability](../../docs/adr/ADR-0026-audit-log-immutability.md)
- [x] [ADR-0027 OCI Vault KEK](../../docs/adr/ADR-0027-oci-vault-kek-envelope-encryption.md)
- [x] [ADR-0024 Errata (빗썸 JWT)](../../docs/adr/ADR-0024-quant-service.md)
- [x] [key-rotation-sop.md](key-rotation-sop.md) — KEK 회전 SOP
- [x] [audit-rbac-sop.md](audit-rbac-sop.md) — audit RBAC SOP
- [x] quant/CLAUDE.md Phase 로드맵 갱신

### Phase 2 Open Questions
- [x] OQ-007 (시세 이벤트 버스) — SharedFlow primary + Kafka fan-out closed
- [x] OQ-P2-001 (KEK) — OCI Vault + LocalFile (Port 추상화) closed
- [x] OQ-P2-002 (audit) — ClickHouse 별도 DB + RBAC + prev_hash chain closed
- [x] OQ-P2-005 (SharedFlow buffer) — extraBufferCapacity=256, DROP_OLDEST closed
- [x] OQ-P2-006 (Rate Limiter) — Redis Lua token bucket closed
- [x] OQ-P2-007 (SSE) — first-message JWT + gateway long-lived closed (단순화: query param fallback)
- [ ] **OQ-011 (거래소 약관)** — 사용자 빗썸/업비트 약관 검토 미완료. Phase 3 실매매 진입 전 closed 필수
- [ ] OQ-P2-008 (PAPER vs 실 시장 slippage 검증) — Phase 3 진입 게이트, PAPER 운용 중 측정 필요

### Phase 3 진입 게이트 (Phase 2 완료 ≠ Phase 3 진입 가능)
- [ ] **OQ-011 closed** — 빗썸/업비트 OpenAPI 약관 검토 (자동매매 허용 / 상업적 제한 / Rate Limit)
- [ ] **OQ-012 (손실 한도)**, **OQ-013 (글로벌 kill-switch)**, **OQ-014 (주문 reconcile)** 모두 closed
- [ ] **OQ-015 (Gateway 우회 차단 NetworkPolicy/mTLS)**, **OQ-016 (실매매 2FA Role)** closed
- [ ] **OQ-019 (페이퍼 → 실매매 정량 게이트)** 정의
- [ ] **OQ-P2-008** (slippage 검증) — PAPER N주 운용 후 격차 p95 ≤ 0.1% 검증

---

## 종합 판정

**Phase 2 백엔드 + FE 페이퍼 트레이딩 골격 출고 가능.**

자동화된 검증이 통과한 항목 (체크된 항목)은 코드/테스트/문서 모두 정합. 단위 테스트 약 60+ specs green.

수동 검증 / 운영 진입 전 잔여 항목:
1. Docker 환경에서 `*IntegrationSpec*` 1회 수동 실행 (Testcontainers MySQL/ClickHouse/Redis/Kafka)
2. K8s 클러스터에 실 배포 후 Pod Ready / Health 확인
3. 빗썸 실 WebSocket 1회 수동 연결 검증 (real_market 통합 테스트)
4. OCI Vault 운영 환경 자격증명 등록 + OciVaultKmsAdapter 통합 검증

ADR-0025/0026/0027 Status 승격 (Proposed → Accepted) 은 위 4개 수동 검증 통과 후 별도 PR.

---

## 알려진 제약 / 단순화 (Phase 2 → Phase 3 이월)

| 영역 | 단순화 | Phase 3 처리 |
|---|---|---|
| 빗썸 ticker JSON 파싱 | stub | 실 schema 정확 매핑 |
| WS gzip + heartbeat | 단순화 | 빗썸 사양 실측 후 보강 |
| StartPaperTradingUseCase long-running | stub | SSE 통합과 함께 활성화 |
| LazyReencryptionJob 단위 테스트 | IntegrationSpec 분리 | 실 MySQL 검증 |
| first-message JWT (SSE) | query param fallback | 정식 first-message 패턴 + JWT 검증 라이브러리 wire-up |
| Bot Token KMS unwrap | env var 직접 | NotificationTarget repository + KMS 통합 |
| FE slot/order SSE 이벤트 → state | tick만 | 도메인 이벤트 SSE 송신 wire-up |
| 다중 거래쌍 탭 (FE) | BTC_KRW 고정 | 탭 전환 + 다중 SSE 구독 |
| Phase 1 envelope 데이터 마이그레이션 | dek_wrapped IS NULL fallback | 일회성 마이그레이션 스크립트 |
| OCI Vault key version → INT 매핑 | Math.abs(hashCode()) | 매핑 테이블 신설 |
| Audit Kafka mirror | best-effort | ETL 일관성 강화 (Phase 3+) |

---

## 다음 단계 (Phase 3 진입 전)

1. 본 체크리스트의 미체크 항목 4개 수동 처리
2. OQ-011 거래소 약관 검토 closed
3. PAPER N주 운용 → OQ-P2-008 slippage 격차 측정
4. Phase 3 Preflight 신설 (OQ-012/013/014/015/016/019 + OQ-P2-008 결과)
5. Phase 3 spec 사이클 (`/hns:start` 또는 새 spec 폴더)
