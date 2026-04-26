# Phase 1 Readiness Checklist

**서비스**: seven-split
**Phase**: 1 (백테스트 엔진)
**작성일**: 2026-04-26
**기준 ADR**: [ADR-0024](../../docs/adr/ADR-0024-seven-split-service.md) (Status: Proposed)

---

## 출고 전 체크리스트

### 빌드 & 테스트
- [x] `./gradlew :seven-split:domain:test` — 35 tests green (도메인 + INV-01~07 property)
- [x] `./gradlew :seven-split:app:test` — UseCase / Backtest / Bithumb / Outbox / Maskng 모두 green
- [x] `./gradlew :seven-split:app:bootJar` — 실행 JAR 생성 성공
- [x] `cd seven-split/frontend && npm run build` — FE 번들 성공 (541 KB JS / 14 KB CSS, gzip 170 / 3.86 KB)
- [ ] `./gradlew :seven-split:app:goldenTest` — Phase 2 도입 (TG-12 deferred)
- [ ] `./gradlew :seven-split:app:test --tests '*Phase1E2ESpec*' -PincludeIntegration=true` — Docker 환경에서 1회 수동 실행 (TG-15)

### 코드 품질
- [x] Domain 모듈에 Spring/JPA 직접 import 0건 (Clean Architecture)
- [x] `@Transactional` 클래스 레벨 0건 (ADR-0020)
- [x] 모든 Repository port 시그니처에 `tenantId` (INV-05)
- [x] 도메인 이벤트는 `DomainEvent` sealed 계층 통일 (15종)
- [x] `SpotOrderType` sealed = Market/Limit 만 → 레버리지 컴파일 차단 (원칙 2)
- [x] `RoundSlot.fillSell` precondition → `StopLossAttemptException` (INV-01)
- [x] 민감정보 (`ExchangeCredential`, `DecryptedCredential`) `toString()` 마스킹 검증

### 인프라
- [x] Flyway V001 — 9 테이블 (모두 tenant_id + 인덱스)
- [x] ClickHouse `seven_split` DB 별도 신설 (analytics와 격리)
- [x] Outbox 패턴 (`OutboxEventPublisher` + `OutboxRelay`)
- [x] K8s base manifest 등록 (`k8s/base/seven-split/`) + k3s-lite overlay 자동 포함
- [ ] `kubectl apply -k k8s/overlays/k3s-lite` 후 seven-split Pod Ready 검증 (수동)
- [ ] `/actuator/health`, `/actuator/prometheus` 정상 응답 검증 (수동)

### 데이터
- [ ] 빗썸 분봉 2023-01 ~ 현재 BTC/KRW, ETH/KRW 적재 완료 (수동 1회 실행 필요)
  - 명령: `./gradlew :seven-split:app:bootRun --args='--spring.profiles.active=ingest-bithumb'`
- [x] 백테스트 골든셋 fixture 3종 (tight / volatile / exhausted) green

### 문서
- [x] `seven-split/CLAUDE.md` 존재 + 루트 Navigation 갱신
- [x] `seven-split/docs/README.md` 작성
- [x] [ADR-0024](../../docs/adr/ADR-0024-seven-split-service.md) Proposed 상태로 작성됨
- [x] [Spec](../../docs/specs/2026-04-24-seven-split-crypto-trading/planning/spec.md) revised 상태
- [x] [Requirements](../../docs/specs/2026-04-24-seven-split-crypto-trading/planning/requirements.md) v1
- [x] [Test Quality](../../docs/specs/2026-04-24-seven-split-crypto-trading/planning/test-quality.md)
- [x] [Phase 1 Release Notes](../../docs/specs/2026-04-24-seven-split-crypto-trading/planning/phase1-release-notes.md)
- [ ] ADR-0024 Status를 Proposed → Accepted 전환 (실제 Phase 1 실행 검증 후)

### Open Questions (Phase 1 관련)
- [x] OQ-008 (data-ingestion 파이프라인) — `context/data-ingestion.md` 로 closed
- [ ] OQ-011 (거래소 약관 자동매매 허용) — `context/exchange-terms.md` 작성됨, **사용자 수동 약관 검토 필요**
- [x] OQ-020 (부분체결 substate) — Phase 1 인라인 결정: `filledQty/targetQty` 필드 방식

### Phase 2 진입 전 해소 필요 (Phase 1 출고에는 무관)
- OQ-007, OQ-017, OQ-018 — Phase 2 Preflight 후보

### Phase 3 진입 전 해소 필요
- OQ-012 (손실 한도), OQ-013 (글로벌 kill-switch), OQ-014 (주문 reconcile),
  OQ-015 (Gateway 우회 차단), OQ-016 (실매매 2FA), OQ-019 (페이퍼→실매매 승격 게이트)

---

## 종합 판정

**Phase 1 백엔드 골격 + FE 스캐폴드 출고 가능.**

자동화된 검증이 통과한 항목 (체크된 항목)은 코드/테스트/문서 모두 정합. 

수동 검증이 필요한 잔여 항목 (체크 안 된 항목):
1. K8s 클러스터에 실제 배포 후 Pod Ready / Health 확인
2. 빗썸 히스토리 1회 적재 실행
3. Docker 환경에서 TG-15 통합 E2E 수동 실행
4. OQ-011 거래소 약관 검토 (Phase 2 전 필수, Phase 1 출고는 무관)

**ADR-0024 Status 승격 (Proposed → Accepted)** 은 위 4개 수동 검증 통과 후 별도 PR로.

---

## 다음 단계 (Phase 2 진입 전)

1. 본 체크리스트의 미체크 항목 4개 수동 처리
2. OQ-011 약관 검토 closed
3. Phase 2 Preflight 신설 (OQ-007 / OQ-017 / OQ-018)
4. spec/requirements/tasks Phase 2 사이클 (`/ideabank:bs` 또는 `/hns:start` 새 사이클)
