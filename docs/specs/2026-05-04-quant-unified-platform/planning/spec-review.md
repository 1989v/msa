<!-- source: quant -->
---
spec: quant-unified-platform
date: 2026-05-04
parent: spec.md
type: 5-dimension-self-review
---

# Spec Review (5-Dimension Self-Review)

## D1. 완전성 (Completeness)

| 항목 | 결과 | 비고 |
|---|---|---|
| 비즈니스 목표 | ✅ | requirements.md §1 G1~G4 |
| 사용자 페르소나 | ✅ | 트레이더 / 분석가 / 입문자 |
| 핵심 기능 (F1~F4) | ✅ | strategies / charts / learn / market adapter |
| 비기능 (latency / 보관 / 멀티테넌트) | ✅ | spec.md §9 |
| 데이터 모델 (MySQL / ClickHouse / pgvector) | ✅ | spec.md §3 |
| API contract | ✅ | spec.md §4 |
| 마이그레이션 / 영향 | ✅ | spec.md §10 |
| **누락**: 어드민 인증 흐름 | ⚠️ | ROLE_ADMIN 권한 검증 흐름 — auth 서비스 의존 명시 필요 |
| **누락**: ingest sidecar 실패 시 알림 | ⚠️ | Prometheus 메트릭은 있으나 alerting 룰 미정 |

**Verdict**: SHIP (보강 2건 implement 단계에서 처리)

## D2. 일관성 (Consistency)

| 항목 | 결과 | 비고 |
|---|---|---|
| ADR-0033/0034/0035 와 spec 결정 일치 | ✅ | 옵션 C / Kotlin 단일 / 분리 유지 |
| ADR-0024 (quant) Errata 반영 | ✅ | sealed `Strategy` 도입 명시 |
| ADR-001 (charting) Errata 반영 | ✅ | Phase 2 폐기 명시 |
| ADR-0019 (k8s) — Asset/Market 일반화가 K8s 매니페스트 영향? | ✅ | quant deployment 단일, ingest CronJob 신규만 추가 |
| ADR-0029 (멱등 consumer) | ✅ | Outbox 표준 그대로 사용 |
| 컨벤션 (tenantId INV-05) | ✅ | strategy/run/cms 모두 tenantId 명시 |
| common 모듈 활용 (`ApiResponse`, exception) | ✅ | 추가 영향 없음 |

**Verdict**: SHIP

## D3. 구현 가능성 (Feasibility)

| 영역 | 위험 | 평가 |
|---|---|---|
| ta4j Kotlin 통합 | 낮음 | 안정적인 Java/Kotlin 라이브러리 |
| 임베딩 numpy → DJL/multik 포팅 | **중간** | 부동소수점 정확도 차이 — golden test 필수 |
| pgvector schema rename (`pattern` → `quant_pattern`) | 낮음 | Flyway + dual-write |
| Python ingest sidecar | 낮음 | yfinance/FDR 그대로 사용 |
| ClickHouse `quant.ohlcv` 단일 테이블화 | 낮음 | `interval` 컬럼 + partition |
| 자산 검색 (`/api/v1/assets/search`) | 낮음 | static 카탈로그 + DB 인덱싱 |
| Strategy sealed JSON 직렬화 | **중간** | type discriminator + Jackson polymorphic |
| 어드민 CMS 화면 (Phase 1) | 중간 | admin-fe 메뉴 추가 필요 (별도 서비스 영향) |

**Verdict**: SHIP — 중간 위험 항목 2건은 implement 단계의 spike 작업으로 처리

## D4. 테스트 가능성 (Testability)

| 레이어 | 테스트 전략 | 결과 |
|---|---|---|
| domain (Strategy / SignalConfig / Asset) | Kotest property-based — 불변식 | ✅ |
| application UseCase | Kotest + MockK | ✅ |
| infrastructure adapter | Testcontainers (MySQL / ClickHouse / pgvector) | ✅ |
| ingest sidecar | pytest + ClickHouse docker | ✅ |
| 임베딩 동등성 (numpy vs Kotlin) | Golden test (입력 → 동일 32차원) | ⚠️ 추가 필요 |
| FE 라우팅 | playwright e2e (단일 prefix /quant/) | ✅ |
| 김치프리미엄 deferred (Phase 2) | spec 에서 out-of-scope 명시 | ✅ |

**Verdict**: REVISE — 임베딩 golden test 항목을 spec.md §11 에 명시 필요

## D5. 위험 (Risk)

| 위험 | Impact | 확률 | Mitigation |
|---|---|---|---|
| charting 흡수 중 데이터 손실 | High | Low | dual-write + golden test + Phase 2 까지 charting 병행 |
| Strategy sealed 변경으로 기존 API 깨짐 | High | Medium | type 컬럼 단일 테이블 + 하위 호환 path |
| ta4j ↔ Python ta-lib 결과 차이 | Medium | Medium | 핵심 지표 6종은 양 구현 비교 골든 테스트 |
| pgvector schema rename 중 검색 누락 | Medium | Low | Flyway + dual-read 윈도우 |
| Python sidecar 실패 → OHLCV stale | Medium | Medium | Prometheus alert + retry 백오프 + last-success timestamp |
| 어드민 CMS 권한 누수 (ROLE_ADMIN 우회) | High | Low | gateway JWT 검증 + 컨트롤러 가드 + 권한 단위 테스트 |
| 외부 노출 시 벤치마크 흔적 | High | Medium | grep 자동 검사 + 도메인 용어 화이트리스트 |

**Verdict**: SHIP — 모든 항목 mitigation 정의됨

---

## 최종 판정

| Dimension | Verdict |
|---|---|
| D1 완전성 | SHIP (minor 보강) |
| D2 일관성 | SHIP |
| D3 구현가능성 | SHIP |
| D4 테스트가능성 | **REVISE** (임베딩 골든 테스트 명시 필요) |
| D5 위험 | SHIP |

**Overall**: **REVISE** (1건 minor) → spec.md §11 에 임베딩 골든 테스트 명시 후 SHIP.

## 자동 보강 — spec.md §11 갱신

기존:
> ingest unit | pytest + pgvector docker | yfinance/fdr → ClickHouse insert

추가:
> embedding golden | pytest + Kotest 양쪽 — 동일 60일 윈도우 입력 → 32차원 출력 cosine ≥ 0.9999 보장 | numpy ↔ multik/DJL 결과 동등성 검증
