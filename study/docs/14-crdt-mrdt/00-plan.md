---
id: 14
title: CRDT · MRDT — 분산 데이터 동기화
status: completed
created: 2026-05-01
updated: 2026-05-02
tags: [distributed-data, crdt, mrdt, eventual-consistency, conflict-resolution, replication]
difficulty: advanced
estimated-hours: 14
codebase-relevant: false
---

# CRDT · MRDT — 분산 데이터 동기화

## 1. 개요

Conflict-free Replicated Data Type (CRDT) 와 Mergeable Replicated Data Type (MRDT) 는 충돌 없이 자동 병합되는 분산 데이터 구조다. Eventually Consistent 시스템에서 다중 replica 가 동시 쓰기를 받을 때 수동 충돌 해결 없이 수렴하는 보장을 제공한다. Riak, Redis Enterprise CRDB, Yjs, Automerge, Roshi(Slack), Figma, Notion 등 협업 도구와 multi-region 시스템의 핵심 기술.

#7(분산시스템)에서 다루는 Vector/Lamport Clock·Eventual Consistency 의 *데이터 구조 단계 구현*에 해당.

## 2. 학습 목표

- CRDT 의 두 패러다임 (state-based CvRDT, op-based CmRDT) 차이 설명
- 주요 CRDT 자료구조 (G-Counter, PN-Counter, G-Set, 2P-Set, OR-Set, LWW-Register, MV-Register, RGA, Yata) 의 머지 함수 직접 구현
- semilattice (join, monotonic, idempotent, commutative) 가 왜 수렴 보장의 핵심인지 증명
- causal context (vector clock, dot context, dot store) 와 CRDT 의 관계
- MRDT (OCaml/Irmin) 와 CRDT 의 차이 — Git 3-way merge 적용
- 실제 시스템 (Riak DT, Redis CRDB, Yjs, Automerge) 의 사용 패턴
- 한계: byte-size 증가, garbage collection, tombstone 누적, anti-entropy 비용
- CRDT vs OT (Operational Transform) 비교

## 3. 선수 지식

- #7 분산시스템 (Eventual Consistency, Vector Clock, Lamport Clock)
- 추상대수 기본 (semilattice, monoid, partial order)
- Git merge 개념 (3-way merge 가 사실상 MRDT 의 origin)

## 4. 학습 로드맵

### Phase 1: 기본 개념
- 분산 환경 multi-master 의 충돌 문제 (LWW, manual merge, Riak sibling)
- Strong Eventual Consistency (SEC) 정의
- Semilattice 와 monotonic merge 의 수렴성 보장 직관
- CRDT 두 종류: state-based (CvRDT) / op-based (CmRDT) 비교 (전송량 vs 전파 보장)
- 가장 단순한 CRDT: G-Counter (각 노드의 카운터 max merge)

### Phase 2: 심화
- **Counter 계열**: G-Counter (grow-only), PN-Counter (positive/negative 분리), Bounded Counter (상한 보장)
- **Set 계열**: G-Set, 2P-Set (add+tombstone), OR-Set (Observed-Remove with unique tag), Add-Wins/Remove-Wins
- **Register**: LWW-Register (Last-Write-Wins, timestamp 기반), MV-Register (multi-value, vector clock)
- **Map**: OR-Map, Riak DT Map (recursive CRDT composition)
- **Sequence/List (협업 편집의 핵심)**: Logoot, Treedoc, RGA (Replicated Growable Array), WOOT, Yata (Yjs)
- **JSON CRDT**: Automerge, Yjs 의 데이터 모델
- **Causal context**: dot, dot-context, dot store — 왜 단순 vector clock 으로 부족한가
- **Delta-CRDT**: state-based 의 전송량 폭증 문제 해결, anti-entropy
- **Garbage Collection**: tombstone 누적, causal stability, compaction
- **MRDT (OCaml Irmin)**: Git-style 3-way merge + heap-state CRDT, lowest common ancestor 활용
- **Byzantine 환경**: 일반 CRDT 는 신뢰 노드 가정 → BFT-CRDT 연구 동향

### Phase 3: 실전 적용
- **Yjs/Automerge** 로 협업 에디터 데모 (text + cursor sharing)
- **Redis CRDB** (Redis Enterprise CRDT) 로 multi-region active-active 패턴
- **Riak DT** API 로 PN-Counter 분산 카운터
- msa 프로젝트 적용 가능성 검토:
  - `analytics`: monotonic counter (PV/UV, 좋아요) → multi-region 시 PN-Counter
  - `wishlist`: OR-Set 패턴 (multi-device 동기화 시)
  - `quant`: 분산 포지션 상태 (multi-region 백업 시)
- **결론 후보**: 현 msa 는 single-region single-master → CRDT 도입 보류 ADR 작성

### Phase 4: 면접 대비
- "CRDT 가 정확히 뭔가요? Eventually Consistent 와의 관계는?"
- "OR-Set 이 2P-Set 보다 왜 필요한가요?"
- "LWW-Register 의 한계는? clock skew 가 있으면?"
- "협업 에디터(Notion/Figma)는 어떻게 동시 편집을 처리하나요?"
- "CRDT vs OT (Operational Transform) 의 차이는?"
- "CRDT 의 단점은? (tombstone, byte size, GC)"
- "MRDT 와 CRDT 의 차이는? Git merge 와 어떻게 연결되나요?"

## 5. 코드베이스 연관성

- 직접 적용 코드 현재 없음 (single-region 운영)
- **잠재 적용 영역**:
  - `analytics`: counter 메트릭 (PV/UV)
  - `wishlist`: multi-device OR-Set
  - `quant`: multi-region 포지션 동기화
- ADR 후보: "CRDT 도입 검토 — 현 시점 보류 사유"

## 6. 참고 자료

- "A comprehensive study of Convergent and Commutative Replicated Data Types" — Shapiro et al. 2011
- Martin Kleppmann "Designing Data-Intensive Applications" Ch.5 (Replication)
- Automerge / Yjs 공식 문서
- Riak DT 공식 문서
- Irmin (MRDT 원조)
- "Local-First Software" — Martin Kleppmann et al.

## 7. 미결 사항

- 협업 에디터 핸즈온(Yjs) 포함 여부
- MRDT 깊이 (OCaml Irmin 까지 vs CRDT 위주)
- Operational Transform 비교 포함 여부
- ADR 작성 여부 (msa 도입 검토 결론)

## 8. 원본 메모

```
14. CRDT, MRDT 등
```
