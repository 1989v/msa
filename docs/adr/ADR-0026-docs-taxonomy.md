# ADR-0026 docs/ 분류 정책 — ADR vs Conventions vs Standards

## Status

Proposed

**Date**: 2026-04-26
**Authors**: kgd
**Related**: ADR-0023 (Doc Index Tracking)

## Context

본 저장소의 `docs/adr/` 디렉토리에는 시간이 지나며 다음 두 종류가 섞여 누적됐다:

1. **architecturally significant decision** — 시스템 구성 요소 / 경계 / 통신 / 배포 모델에 본질적 영향을 주고, 되돌리기 비용이 큰 결정 (예: ADR-0001 multi-module-gradle, ADR-0006 database-strategy, ADR-0019 k8s-migration)
2. **convention / standard / process** — 코드 작성 규칙 / 문서 조직 정책 / 자동화 규칙 (예: ADR-0014 code-convention, ADR-0021 logging-conventions, ADR-0023 doc-index-tracking)

후자가 ADR 디렉토리에 누적되면서 다음 문제가 발생한다:

- ADR 디렉토리를 처음 보는 합류자가 "결정의 무게" 를 가늠하기 어려움
- "이건 ADR 감인가?" 의 판단 기준이 암묵지 → 신규 작성 시 ADR 인지 convention 인지 매번 흔들림
- 갱신 빈도가 다른 두 부류가 한 디렉토리에 섞임 (ADR 은 사실상 immutable, convention 은 living)
- ADR 의 무게감 있는 형식 (Status: Accepted / Superseded) 이 가벼운 규칙에 과하게 적용됨

본 ADR 은 `docs/` 하위 분류 체계를 명문화하여, 향후 ADR 의 범위를 좁히고 convention / standards 의 위치를 합의한다.

## Decision

### 1. 분류 정의

| 분류 | 위치 | 정의 | 갱신 빈도 |
|---|---|---|---|
| **ADR** | `docs/adr/` | **되돌리기 어려운 구조 결정**. 시스템 구성 요소 (서비스, 모듈), 그 경계, 그들 간 통신/데이터 모델, 배포/보안 모델에 본질적 영향. 되돌리려면 다수 PR + 다수 팀 조정 필요 | 사실상 immutable (Superseded 로만 변경) |
| **Conventions** | `docs/conventions/` | **코드 / 설계 작성 규칙**. 따르지 않아도 시스템은 동작하지만, 일관성 / 가독성 / 유지보수성에 영향. 코드 리뷰의 베이스라인 | living (필요 시 자유롭게 갱신) |
| **Standards** | `docs/standards/` (필요 시 신설) 또는 `agent-os/standards/` (agent 행동) | **도구 / 프로세스 / 검증 정책**. 저장 위치, 필수 산출물, 자동화 규칙, 검증 절차 | living |
| **Operations** | `docs/ops/` (필요 시 신설) 또는 conventions 부록 | **운영 SLA / 측정 데이터 기반 living 문서**. production 측정에 따라 분기마다 갱신 | living, 측정 데이터에 따름 |

### 2. ADR 적격 판단 기준 (체크리스트)

신규 결정이 다음 중 **2개 이상** 해당하면 ADR. 그렇지 않으면 conventions / standards / ops.

- [ ] 시스템 구성 요소 (서비스, 모듈, 컴포넌트) 의 추가 / 제거 / 분리 / 병합
- [ ] 컴포넌트 간 통신 패턴 결정 (REST vs gRPC vs messaging, sync vs async)
- [ ] 데이터 저장 / 분리 / 일관성 모델 결정 (RDB vs NoSQL, sharding, CQRS, SSOT 경계)
- [ ] 배포 / 인프라 / 보안 모델 결정 (K8s migration, multi-region, 인증 방식)
- [ ] 결정 적용 시 다수 서비스 / 다수 PR 에 ripple effect
- [ ] 되돌리려면 다수 팀 조정 / 데이터 마이그레이션 / 다수 PR 필요

체크 0~1개:
- 코드 작성 규칙이면 → `docs/conventions/{topic}.md`
- 도구 / 프로세스 / 검증이면 → `docs/standards/{topic}.md` (신설) 또는 `agent-os/standards/{topic}.md`
- 운영 SLA / 측정 기반이면 → `docs/ops/{topic}.md` (신설) 또는 conventions 부록

### 3. 혼합 결정의 분해 원칙

하나의 결정이 "원칙 + 실천 + 운영" 을 모두 포함하는 경우, 본질에 따라 분해한다:

| 부분 | 위치 |
|---|---|
| **원칙 / 정책** (architecturally significant) | ADR (좁힌 형태) |
| **실천 / 작성 규칙** | conventions/ |
| **구체 SLA 숫자 / 측정 데이터** | ops/ 또는 conventions 부록 (living 명시) |

ADR 본문은 원칙 + "실천은 conventions/X 참고", "SLA 는 ops/Y 참고" 식으로 cross-link.

### 4. Redirect 표준 (Moved ADR 처리)

기존 ADR 을 conventions / standards / ops 로 옮길 때, 원본 ADR 자리에는 다음 형식의 redirect 문서를 둔다:

```markdown
# ADR-XXXX [Moved] {원본 제목}

## Status
Moved (재분류) — 2026-MM-DD

## 새 위치
`docs/conventions/{topic}.md` (또는 standards/, ops/)

## 이동 사유
{한 줄: 왜 ADR 범위에서 제외되었는가. 예: "코드 작성 규칙으로 architecturally significant 가 아님"}

## History
원본 본문은 git history 참조 (commit before {SHA})
```

이유:
- 기존 외부 참조 (commit 메시지, PR 본문, 다른 ADR 의 cross-link, README) 가 깨지지 않음
- ADR 번호는 회수하지 않음 (같은 번호가 다른 의미를 가지면 혼란)
- 새 위치를 명시해 추적 가능

### 5. 본 정책 적용 — 기존 ADR 재판정 결과

| ADR | 현재 본질 | 분해 결과 | 처리 |
|---|---|---|---|
| 0014 code-convention | 코딩 규칙 (네이밍/DI/도메인) | 전체 convention | → `docs/conventions/code-convention.md` ✅ 적용됨 |
| 0016 service-local-docs | 문서 조직 정책 | 전체 standards | → `docs/standards/service-local-docs.md` ✅ 적용됨 (디렉토리 신설) |
| 0020 transactional-usage | 본문 자체가 "유형: Convention" 라벨, 4가지 사용 규칙 | **분해 불필요** — 원칙(외부 IO ↔ TXN)은 ADR-0014→code-convention §6 에 이미 있음 | → `docs/conventions/transactional-usage.md` ✅ 적용됨 |
| 0021 logging-conventions | 코딩 규칙 | 전체 convention | → `docs/conventions/logging.md` ✅ 적용됨 |
| 0022 entity-mutation | 원칙 (entity 자기 보호) + 실천 (mutation 패턴) | 분해 — 원칙은 ADR 좁힘, 실천은 conventions | → 별도 PR (분해 까다로움) |
| 0023 doc-index-tracking | 도구 / 자동화 정책 | 전체 standards | → `docs/standards/doc-index-tracking.md` ✅ 적용됨 |
| 0025 latency-budget | 원칙 (budget 강제 + 측정 표준) + 실천 (어휘) + 운영 (Tier 숫자) | 분해 — 원칙은 ADR 좁힘, 실천은 conventions, 운영은 conventions 부록 | **본 PR 에서 처리** (사례) |

→ 본 PR 은 메타 ADR (0026) + 0025 분해 (사례) 까지. 나머지 6개는 별도 PR 들로 진행.

### 6. 신규 ADR 작성 시 체크리스트

- [ ] 위 §2 의 ADR 적격 판단 기준 2개 이상 해당하는가?
- [ ] 그렇지 않다면 conventions / standards / ops 중 어디인가?
- [ ] 혼합 결정이라면 §3 의 분해 원칙 적용했는가?
- [ ] CLAUDE.md Key Conventions 표 갱신 필요한가?
- [ ] doc-index.json manual_links 갱신 필요한가? (cross-cutting 코드 영향이 있는 경우)

## Alternatives Considered

### Alternative 1: 그대로 유지 (현 상태)

- **거부 이유**: ADR 디렉토리에 결정과 규칙이 섞여 신규 합류자가 "결정의 무게" 를 판별 못함. 신규 작성 시 매번 분류 흔들림.

### Alternative 2: 모든 docs/ 를 ADR 형식으로 통일

- **거부 이유**: convention / standards 의 living 성격에 ADR 의 immutable + Status 라벨이 과함. 갱신 비용 증가.

### Alternative 3: ADR 디렉토리 폐지, 모두 conventions/ 로

- **거부 이유**: architecturally significant 결정의 무게감 / 거버넌스 (Status: Accepted, Superseded) 가 사라짐. 되돌리기 어려운 결정과 living 규칙의 구분 필요.

## Consequences

### Positive

- ADR 디렉토리가 본질적 결정으로 좁혀짐 → 합류자가 시스템 구조의 핵심 결정을 빠르게 파악
- convention / standards / ops 의 갱신 비용 감소 (가벼운 형식)
- 신규 결정 작성 시 위치 판단 기준 명확
- 혼합 결정의 분해 원칙으로 ADR 본문이 짧고 결정문답게 유지됨

### Negative

- 기존 ADR 의 일부가 redirect 로 변환됨 → 외부 참조 일시적 혼란 (mitigated: redirect 문서로 새 위치 안내)
- 분류 판단의 회색 영역 존재 (특히 0020/0022 같은 원칙+실천 혼합) → §3 분해 원칙으로 가이드
- `docs/standards/` / `docs/ops/` 디렉토리 신설 시점에 doc-index 정책 갱신 필요

### Mitigation

- 기존 ADR 정리는 단계적 (PR 별 1~5개씩). 전면 force change 금지
- §5 재판정 표를 living 문서로 유지 (재판정 결과에 변화 시 본 ADR 갱신)
- 분해 까다로운 ADR (0022) 은 별도 PR 로 충분한 검토 시간 확보

## References

- Michael Nygard, "Documenting Architecture Decisions" (2011) — ADR 의 정통 정의
- ADR-0023: Doc Index Tracking (문서-소스 추적 자동화)
- 본 ADR 의 첫 적용 사례: ADR-0025 분해 (같은 PR)

## Open Questions

- [ ] `docs/standards/` 디렉토리 신설은 ADR-0023 의 doc_map.py 가 인식하도록 source_roots / doc_roots 정책 검토 필요
- [ ] `docs/ops/` 디렉토리 도입 여부 — Tier 별 SLA 가 늘어나면 신설, 작으면 conventions 부록 유지
- [ ] PR 템플릿에 "ADR / convention / standards / ops 중 어디인가?" 체크박스 추가 검토
