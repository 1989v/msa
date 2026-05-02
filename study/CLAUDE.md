# study/ — MSA 학습 노트

> 18개 주제 / 333개 파일 / ~97K 줄의 백엔드 시니어 학습 자료.

본 폴더는 msa 코드베이스를 grounding 으로 삼아 작성한 백엔드 학습/면접 자료의 source of truth 다.
`/study:*` skill 파이프라인이 산출하는 모든 결과물은 이 폴더 안에 위치한다.

---

## Quick Navigation

- **Master Index**: [docs/00-INDEX.md](docs/00-INDEX.md) — 18 주제 entry point
- **Interview Index**: [docs/00-INTERVIEW-INDEX.md](docs/00-INTERVIEW-INDEX.md) — 면접 카드 통합
- **Learning Guide**: [docs/00-LEARNING-GUIDE.md](docs/00-LEARNING-GUIDE.md) — 회독 전략
- **ADR Candidates**: [docs/00-ADR-CANDIDATES.md](docs/00-ADR-CANDIDATES.md) — 학습 → ADR 후보 통합
- **현재 진도/스코프**: [temp.md](temp.md) — 18 주제 진척 추적 표

---

## Topic Structure

각 주제 폴더 (`docs/{N}-{slug}/`) 표준 구조:

- `00-plan.md` — 학습 계획 (frontmatter: id/title/status/tags/difficulty/hours)
- `00-preview.md` — 멘탈 모델 + 소주제 지도 + 학습 순서
- `NN-{slug}.md` — Phase 1-3 deep dive (개념 → 심화 → msa 코드 grounding)
- `(NN-1)-improvements.md` — 학습 → 개선 후보 + ADR 초안
- `NN-interview-qa.md` — 면접 카드 + 꼬리질문 + 자가평가

### Frontmatter 표준

```yaml
---
id: <topic-number>
title: <korean-title>
status: draft | ready | in-progress | completed
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [...]
difficulty: beginner | intermediate | advanced
estimated-hours: <int>
codebase-relevant: true | false
---
```

`status` 흐름: `draft` → `/study:bs` → `ready` → `/study:exec` → `in-progress` → 모든 NN 완료 시 `completed`.

---

## Pipeline (skill commands)

| Skill | 단계 | 산출물 |
|---|---|---|
| `/study:init N` | 주제 초기화 | `docs/{N}-{slug}/00-plan.md` |
| `/study:bs N` | 방향 다듬기 | plan.md 개정 + 미결사항 정리 |
| `/study:exec N` | preview (소주제 지도) | `docs/{N}-{slug}/00-preview.md` |
| `/study:start N [subtopic]` | 본격 심화 | `docs/{N}-{slug}/NN-{subtopic}.md` |

파이프라인은 partial 진입을 허용한다. 이미 plan.md 가 있으면 `/study:bs` 부터, preview 까지 있으면 `/study:start` 부터 재개.

---

## Topic 분류 (영역별)

### 런타임 / 언어
- **#2 JVM/GC** — heap layout, G1/ZGC, escape analysis, OOM 디버깅
- **#3 동시성** — synchronized/volatile, AQS, virtual threads (Loom), coroutine
- **#16 Async/IO** — NIO selector, Reactor, Netty pipeline, epoll
- **#17 Spring Web** — Filter / Interceptor / AOP, Jackson, gzip

### 저장소 / 데이터
- **#4 DB Index/TX** — B-tree, MVCC, isolation, intention/MDL lock, deadlock
- **#5 Spring TX** — `@Transactional` propagation, AOP proxy 함정, 외부 IO 분리
- **#9 Redis** — persistence, cluster, stampede, distributed lock, stream
- **#15 Connection Pool** — HikariCP 튜닝, reader/writer 분리, Lettuce/Jedis
- **#14 CRDT/MRDT** — eventual consistency, conflict-free 데이터 타입

### 메시징
- **#6 Kafka** — partition, consumer group, exactly-once, idempotency, DLQ
- **#18 gRPC** — Protobuf 진화, HTTP/2, streaming, schema 호환성

### 분산 / 아키텍처
- **#7 분산시스템** — CAP/PACELC, Saga, 2PC, idempotency, circuit breaker
- **#8 System Design** — 시스템 설계 시나리오 10선 (interview prep)

### 관측 / 운영 / 인프라
- **#1 AWS** — VPC/subnet/SG, ELB, IAM, S3, RDS 기본
- **#10 Observability** — metrics + logs + traces, Prometheus, OpenTelemetry
- **#11 K8s** — Operator/CRD, Helm, GitOps, deployment 전략 (canary/blue-green)
- **#12 Latency** — latency budget 설계, P99 SLA, 측정 표준
- **#13 Crypto** — symmetric/asymmetric, JWT, SSO, KMS, key rotation

---

## 학습 진도

`temp.md` 의 `학습 현황` 표를 참조. 모든 18주제 `completed + N deep files` 상태 (2026-05-02 기준).

진도 갱신은 수동:
1. NN-{subtopic}.md 추가 시 `temp.md` 표의 deep files 카운트 갱신
2. 주제 완료 시 `00-plan.md` frontmatter `status: completed`, `updated` 변경
3. `00-INDEX.md` 의 진척 표시 동기화

---

## Cross-cutting 주의

학습 자료에서 한 문제가 여러 주제를 가로지를 수 있으므로 cross-ref 명시:

| 시나리오 | 관련 주제 |
|---|---|
| K8s 위 Spring 서비스 관측 | #11 + #2 + #10 + #15 |
| Kafka 멱등 + Saga 보상 트랜잭션 | #6 + #7 + #5 |
| Redis 분산락 + CRDT 충돌 해결 | #9 + #7 + #14 |
| JWT 인증 + Filter 체인 + 분산 trace | #13 + #17 + #10 |
| HikariCP 튜닝 + JVM GC pause | #15 + #2 + #12 |
| gRPC streaming + 백프레셔 | #18 + #16 + #7 |

각 NN 파일에서 cross-ref 가 발생하면 상단 metadata 또는 본문에 `→ #N 참조` 형태로 명시한다.

---

## msa 코드 grounding 원칙

학습 자료의 Phase 3 (코드 grounding) 단계에서는 msa 코드베이스의 실제 구현/패턴을 인용한다.

- 인용 시 **절대 경로** + 줄 번호 명시 (예: `product/app/src/main/.../ProductService.kt:42`)
- ADR 인용 시 ADR 번호로 (예: `ADR-0019`)
- "이 코드의 약점" 발견 시 → `(NN-1)-improvements.md` 에 후보 기록 → `00-ADR-CANDIDATES.md` 에 통합

---

## Skill 라우팅

`/study:*` skills 는 본 폴더에 직접 산출. 학습 인덱스 갱신은 수동 (또는 별도 skill).

CLAUDE.md 루트의 Skill Routing Priority (`/hns:start` → hns → superpowers) 는 일반 코드 작업에 적용되며, **학습 자료 작성은 `/study:*` 가 우선**한다.

---

## Source of Truth

- 학습 진도 표 → `temp.md`
- 18 주제 entry → `docs/00-INDEX.md`
- ADR 후보 → `docs/00-ADR-CANDIDATES.md`
- 면접 통합 → `docs/00-INTERVIEW-INDEX.md`
- 회독 전략 → `docs/00-LEARNING-GUIDE.md`

---

## 제약

- **수정 금지**: 본 폴더 내 학습 자료는 `/study:*` skill 또는 명시적 사용자 요청으로만 수정.
- **plan.md frontmatter 무결성**: `status`/`updated` 외 필드는 함부로 변경하지 말 것.
- **코드베이스 grounding 검증**: 인용한 파일/줄번호는 작성 시점 기준이므로 큰 리팩터링 후 stale 가능 — 주기적으로 `/hns:gc` 로 점검.
