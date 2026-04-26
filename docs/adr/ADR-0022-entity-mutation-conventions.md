# ADR-0022 [Moved] Entity 수정 규칙

## Status

Moved (재분류) — 2026-04-26

## 새 위치

`docs/conventions/entity-mutation.md`

## 이동 사유

본문 자체가 "유형: Convention" 으로 라벨링되어 있었고, 원칙 (엔티티 캡슐화 = 자기 상태 변경의 책임) 은 이미 다음 두 곳에 흡수되어 있음:
- ADR-0001 Clean Architecture (도메인 캡슐화 원칙)
- `docs/conventions/code-convention.md` §3 (Domain 모델 생성 패턴 — `private constructor` + factory + `private set`)

본 ADR-0022 본문은 그 원칙의 **실천 가이드** (전체 동기화 vs 부분 수정 분리 / `changeXxx` 패턴 / 금지 패턴 / 네이밍) 로, ADR-0026 분류 기준상 conventions 가 본질적 위치.

> **분해 검토 결과**: 외부 리뷰 의견은 "원칙과 실천 분해" 였으나, 본문 정독 후 "원칙" 만 떼면 1-2문장 추상으로 남고 그것도 이미 ADR-0001 / code-convention §3 에 있어 별도 ADR 로 떼낼 실익이 약함. ADR-0020 과 같은 결론 — 전체 이동이 본질 적합.

## History

원본 본문은 git history 참조 (commit before this PR).

## Related

- 거버넌스: [ADR-0026 docs taxonomy](ADR-0026-docs-taxonomy.md)
- 원칙 출처: [ADR-0001 multi-module gradle](ADR-0001-multi-module-gradle.md), `docs/conventions/code-convention.md` §3
