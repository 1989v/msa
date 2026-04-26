# PR 제목

(예: `feat(product): 상품 검색 캐시 도입` / `fix(order): payment timeout retry`)

## Summary

- 변경 요지 1-3줄
- 왜 변경하는가 (motivation)

---

## 분류 — 본 변경의 본질 (ADR-0026)

- [ ] **ADR** 감 — architecturally significant decision (서비스/통신/데이터/배포/보안 모델 변경)
  → `docs/adr/ADR-XXXX-<topic>.md` 신설 동반
- [ ] **Conventions** 변경 — 코드 / 설계 작성 규칙
  → `docs/conventions/<topic>.md` 갱신
- [ ] **Standards** 변경 — 도구 / 프로세스 / 검증 정책
  → `docs/standards/<topic>.md` 또는 `agent-os/standards/<topic>.md` 갱신
- [ ] 분류 불필요 (단순 기능 / 버그 수정)

> 분류 판단 기준 → `docs/adr/ADR-0026-docs-taxonomy.md` §2

---

## Latency Budget Impact (ADR-0025 — 신규/변경 호출 경로 시 필수)

- [ ] **속한 Tier**: Tier 1 (사용자 직접 응답) / Tier 2 (비동기) / Tier 3 (백오피스) / 해당 없음
- [ ] **예상 자릿수**: ns / µs / ms / 100ms+
- [ ] **fan-out 여부**: 있다면 N 개 백엔드 / 단일 P99 와 전체 P99 분리 추정
- [ ] **외부 호출 여부**: 있다면 timeout / CircuitBreaker (ADR-0015) / 비동기화 검토
- [ ] **캐시 적용 여부**: hit ratio 목표 / miss 시 fallback latency
- [ ] **측정 방법**: 어떤 메트릭으로 budget 준수 확인할지

> 상세 → `docs/conventions/latency-budget.md`

---

## Test Plan

- [ ] 도메인 / Application / Infrastructure 테스트 (Kotest BehaviorSpec + MockK)
- [ ] 통합 테스트 (필요 시 — 실제 DB / Kafka / Redis)
- [ ] 수동 검증 단계 (UI / API curl 명령어 등)
- [ ] doc-index drift 없음 (`python3 ai/plugins/hns/scripts/doc_map.py --check`)

---

## Checklist

- [ ] CLAUDE.md / 서비스 CLAUDE.md 갱신 필요 시 반영
- [ ] 새 컨벤션 위반 (logging / @Transactional / entity-mutation 등) 없음
- [ ] 외부 의존 추가 시 라이선스 / 보안 검토
- [ ] Breaking change 라면 마이그레이션 가이드 명시

🤖 본 템플릿은 ADR-0025 + ADR-0026 에 따라 도입됨.
