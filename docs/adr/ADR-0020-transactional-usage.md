# ADR-0020 [Moved] @Transactional 사용 규칙

## Status

Moved (재분류) — 2026-04-26

## 새 위치

`docs/conventions/transactional-usage.md`

## 이동 사유

본문 자체가 "유형: Convention" 으로 라벨링되어 있었고, 4가지 규칙 모두 코드 사용법 / 안티패턴 회피 가이드. ADR-0026 분류 기준상 architecturally significant decision 이 아닌 convention. 원칙 ("외부 IO 는 TXN 밖 / DB 커넥션 점유 최소화") 은 `docs/conventions/code-convention.md` §6 (TransactionalService 분리 패턴) 에서 별도로 다룸.

## History

원본 본문은 git history 참조 (commit before this PR).

## Related

- 거버넌스: [ADR-0026 docs taxonomy](ADR-0026-docs-taxonomy.md)
- TransactionalService 분리 패턴: `docs/conventions/code-convention.md` §6
