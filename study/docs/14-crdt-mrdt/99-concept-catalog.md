---
parent: 14-crdt-mrdt
seq: 99
title: CRDT · MRDT 개념 카탈로그
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - "Conflict-free Replicated Data Types (Shapiro et al., 2011)"
  - "A comprehensive study of CRDTs (Shapiro 2011)"
  - https://crdt.tech/
  - https://github.com/yjs/yjs
  - https://automerge.org/
  - https://github.com/electric-sql/electric
  - https://riak.com/posts/technical/the-byzantine-generals-of-consistency-or-introducing-mrdts/
---

# 99. CRDT · MRDT 개념 카탈로그

> **목적** — 14-crdt-mrdt 의 19+ deep file + Shapiro 의 CRDT 분류 / Yjs / Automerge / MRDT 자료 기준 빠진 영역 발굴 (RGA, Logoot, Causal stability, Fugue, Tree CRDT, Operational Transform 비교, Loro 등 신생 라이브러리).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 이론 | SEC (Strong Eventual Consistency), Semilattice, JOIN | ✅ |
| State-based (CvRDT) vs Op-based (CmRDT) | 2분류 | ✅ |
| 기본 CRDT | G-Counter / PN-Counter / G-Set / 2P-Set / OR-Set / LWW-Register / MV-Register | ✅ |
| Sequence CRDT | RGA / Treedoc / Logoot / WOOT / YATA (Yjs) | ✅ |
| Map / Tree | OR-Map, Tree CRDT | ✅ |
| Yjs / Automerge | 라이브러리 | ✅ |
| MRDT (Mergeable Replicated Data Type) | Riak | ✅ |
| **CRDT 자료구조 카탈로그** (Counter / Set / Register / Sequence / Map / Graph / JSON CRDT 16종 통합) | State-based + Op-based 분류, semilattice 증명 | ✅ 커버 ([20](20-crdt-types-deep.md)) |
| 응용 | 협업 에디터, multi-leader DB | ✅ |

### 1-A. 갭 진단

1. **Causal Stability** — operation 안전 GC 시점
2. **δ-CRDT (delta-state CRDT)** — state 전체 대신 delta 만 전파
3. **Fugue** — 삽입 충돌 의도 보존 새 sequence CRDT (2023)
4. **Loro** — Rust 기반 CRDT 라이브러리 (high perf)
5. **Y-CRDT (yrs)** — Yjs 의 Rust 포트
6. **Operational Transform (OT) vs CRDT** 비교 — Google Docs vs Yjs/Automerge
7. **JSON CRDT** — Automerge 의 nested JSON merge
8. **Move operation in Tree CRDT** — 노드 이동 충돌 해결 (Kleppmann 2020)
9. **Compaction / Garbage Collection** in CRDT — tombstone 폭증 방지
10. **Snapshot + Δ replication** — 효율 동기화
11. **Awareness protocol (Yjs)** — presence / cursor
12. **Encryption (E2EE) + CRDT** — local-first 표준
13. **Local-first software** (Ink & Switch) — 7 ideals
14. **Sync protocol over WebRTC / WebSocket / libp2p**
15. **Conflict resolution UI 패턴** — Diff 표시 / branch
16. **Causal+ Consistency** vs Strong Eventual Consistency
17. **CRDTs in distributed databases** — Riak / Redis Active-Active CRDB / Roshi (SoundCloud) / Antidote DB / AntidoteDB / Cassandra
18. **Pure operation-based CRDT** — Baquero
19. **Block-wise CRDT** — block-based document
20. **Convergence proof (commutativity / associativity / idempotency)**
21. **Counter alternatives** — Bounded Counter, Hybrid Counter
22. **Set semantics** — observed vs add-wins vs remove-wins
23. **Map semantics** — observed-remove map (OR-Map) vs add-wins map
24. **Multi-Value Register vs LWW-Register** trade-off
25. **CRDT in mobile-first apps** — offline support
26. **Schema evolution in CRDT** — field add/remove
27. **CRDT 의 vector clock 비용** — actor 폭증
28. **Compression of vector clocks (Bloom clocks, dot version vectors)**
29. **MRDT 의 GC + history pruning**
30. **CRDT 와 Reactive UI 통합** (Y-* + React/Vue)

---

## 2. 카테고리별 개념 트리

### A. 이론

| 개념 | 정의 | 상태 |
|---|---|---|
| Strong Eventual Consistency (SEC) | 동일 set of update → 동일 state | ✅ |
| Semilattice (Join-Semilattice) | partial order + LUB (Least Upper Bound) | ✅ |
| Commutativity / Associativity / Idempotency | op-based 요건 | ✅ |
| Causal+ Consistency | 인과 보존 + convergence | ★ 신규 |
| **Causal Stability** | op 가 더 이상 conflict 안 일으킬 시점 | ★ 신규 |

### B. CvRDT vs CmRDT vs δ-CRDT

| 종류 | 전파 | 비용 | 상태 |
|---|---|---|---|
| CvRDT (state-based) | full state merge | 큰 state | ✅ |
| CmRDT (op-based) | op 전파 + idempotent delivery | exactly-once 어려움 | ✅ |
| **δ-CRDT** | state delta 만 | state-based 의 효율 | ★ 신규 |
| **Pure op-based** (Baquero) | causal delivery 가정 | 학술 | ★ 신규 |

### C. 기본 데이터 타입

| 타입 | 정의 | 상태 |
|---|---|---|
| G-Counter / PN-Counter / Bounded Counter | 카운터 3종 | ✅ |
| G-Set / 2P-Set / **OR-Set** / LWW-Element-Set / Add-Wins Set | set 변형 | ✅ |
| LWW-Register / MV-Register / Last-Writer-Wins | register | ✅ |
| OR-Map / Add-Wins Map / Last-Wins Map | map | ✅ |

### D. Sequence CRDT

| 알고리즘 | 정의 | 상태 |
|---|---|---|
| WOOT | tombstone + transitive precondition | ✅ |
| Treedoc | balanced binary | ✅ |
| Logoot | dense identifier | ✅ |
| RGA (Replicated Growable Array) | tombstone + s4vector | ✅ |
| **YATA** (Yjs) | RGA 변형 — high perf | ✅ |
| **Fugue** (2023) | intent-preserving | ★ 신규 |

### E. Tree / JSON / Move

| 개념 | 정의 | 상태 |
|---|---|---|
| Tree CRDT (Kleppmann 2020) | move 작업 안전 | ★ 신규 |
| JSON CRDT (Automerge) | nested merge | ✅ 커버 ([20](20-crdt-types-deep.md)) |
| **Block-wise CRDT** | document = blocks | ★ 신규 |
| **2P2P-Graph** (Add/Remove vertex+edge) | graph CRDT | ✅ 커버 ([20](20-crdt-types-deep.md)) |

### F. 라이브러리 / 운영

| 라이브러리 | 언어 | 비고 | 상태 |
|---|---|---|---|
| Yjs | JS | 표준 — encoding 효율 | ✅ |
| Y-CRDT (yrs) | Rust | Yjs 포트 | ★ 신규 |
| Automerge | TS / Rust | JSON CRDT | ✅ |
| **Loro** | Rust | high perf 신생 | ★ 신규 |
| Riak (DynamoDB-style) | Erlang | DB CRDT | ✅ |
| Redis Active-Active CRDB | Enterprise | DB | ★ 신규 |
| AntidoteDB | Erlang | research DB | 🟡 |
| **Electric SQL** | TS | local-first SQLite + sync | ★ 신규 |

### G. 비교 — OT vs CRDT

| 측면 | OT (Operational Transform) | CRDT |
|---|---|---|
| 모델 | op transform | merge by structure |
| 사용 | Google Docs (gShared/Wave) | Yjs / Automerge / Loro |
| 중앙화 | 보통 필요 | P2P 가능 |
| 정확성 | 복잡 (transform function) | semilattice 증명 |

### H. Sync Protocol

| 개념 | 정의 | 상태 |
|---|---|---|
| Awareness protocol (Yjs) | presence/cursor | ★ 신규 |
| Snapshot + Δ replication | 효율 | ★ 신규 |
| WebRTC / WebSocket / libp2p sync | 전송 | 🟡 |
| Encryption + CRDT (local-first) | E2EE | ★ 신규 |

### I. GC / Tombstone

| 개념 | 정의 | 상태 |
|---|---|---|
| Tombstone 폭증 문제 | 삭제 흔적 누적 | ✅ |
| Causal Stability 기반 GC | 안전 시점 | ★ 신규 |
| Compaction 패턴 | snapshot + 재시작 | ★ 신규 |
| Vector clock 압축 (Bloom clocks, dot version vectors) | actor 폭증 회피 | ★ 신규 |

### J. msa 응용

| 시나리오 | 적용 후보 | 상태 |
|---|---|---|
| 협업 코드 에디터 (가설) | Yjs / Loro | 🟡 |
| 회원 프로필 multi-device sync | OR-Map + LWW-Register | ★ 신규 |
| wishlist multi-device | OR-Set | ★ 신규 |
| 분산 카운터 (인기도) | PN-Counter | ★ 신규 |
| 실시간 협업 화이트보드 | Yjs Tree CRDT | ★ 신규 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **δ-CRDT** | state-based 의 효율 — 대용량 운영 진입 |
| 2 | **Tree CRDT (Move op)** | 협업 트리/UI 운영 시 표준 |
| 3 | **Yjs / Automerge / Loro 비교** | 라이브러리 선택 |
| 4 | **JSON CRDT (Automerge)** | nested data 표준 |
| 5 | **Causal Stability + Compaction** | tombstone GC 운영 |
| 6 | **Local-first software (Ink & Switch)** | 패러다임 |
| 7 | **CRDT + E2EE** | 보안 결합 |
| 8 | **OT vs CRDT 비교 (Google Docs vs Yjs)** | 의사결정 근거 |
| 9 | **Riak / Redis CRDB / Electric SQL** | DB-level CRDT |
| 10 | **Vector clock 압축 (Bloom clocks, DVV)** | 대규모 actor 운영 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. CRDT 특화:
- §3 → "convergence proof" 한 줄 + 작은 trace 예제
- §6 → "OT vs CRDT" 표
- §7 → "tombstone / GC / sync 운영 메트릭"

---

## 5. 참고 자료

- "Conflict-free Replicated Data Types" (Shapiro et al., 2011)
- crdt.tech — https://crdt.tech/
- Yjs — https://github.com/yjs/yjs
- Automerge — https://automerge.org/
- Loro — https://loro.dev/
- Electric SQL — https://electric-sql.com/
- Ink & Switch — https://www.inkandswitch.com/local-first/
- Kleppmann (Tree CRDT, 2020) — https://martin.kleppmann.com/papers/move-op14.pdf
- Riak MRDT — https://riak.com/
