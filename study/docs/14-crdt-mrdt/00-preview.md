---
parent: 14-crdt-mrdt
type: preview
created: 2026-05-01
---

# CRDT · MRDT — 분산 데이터 동기화 Preview

> 학습자 수준: 분산시스템(#7) 선수, 추상대수 기본 가정 · 전체 예상 시간: 14h · 목표: 면접 깊은 답변 + msa 도입 검토 ADR 작성
> 계획서: [00-plan.md](00-plan.md) · 학습 순서: 직진(01 → 19) 권장, Phase 3 적용 검토는 Phase 2 자료구조 학습 이후에 보면 의미 강함

---

## 멘탈 모델: "수렴 사다리"

CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 의 본질은 **"merge 가 수학적 join 이라서 모든 replica 가 같은 사다리를 위로 오르도록 강제"** 한다는 점이다. 4층 사다리로 정리한다.

```
  ┌────────────────────────────────────────┐
  │  Layer 4: 시스템                        │
  │   Riak DT / Redis CRDB / Yjs / Automerge│
  └─────────────────┬──────────────────────┘
                    │ "어떤 merge?"
  ┌─────────────────┴──────────────────────┐
  │  Layer 3: 합성 / 운영                   │
  │   Map(=재귀 CRDT) · delta · GC · MRDT   │
  └─────────────────┬──────────────────────┘
                    │ "어떻게 표현?"
  ┌─────────────────┴──────────────────────┐
  │  Layer 2: 자료구조                      │
  │   Counter · Set · Register · Sequence   │
  └─────────────────┬──────────────────────┘
                    │ "왜 수렴?"
  ┌─────────────────┴──────────────────────┐
  │  Layer 1: 이론                          │
  │   SEC · Semilattice · Causal Context    │
  └────────────────────────────────────────┘
```

**핵심 5문장만 외운다**:
1. **Strong Eventual Consistency (SEC)** — 같은 update 집합을 받은 replica 는 deterministic 하게 같은 상태로 수렴.
2. **수렴의 비밀은 "merge 가 join semilattice"** — associative · commutative · idempotent 셋이면 순서/재전송에 무관하게 수렴.
3. **op-based(CmRDT)** 는 op 를 정확히 1번 broadcast (causal delivery 필요), **state-based(CvRDT)** 는 state 를 join 으로 합침 (eventual gossip 으로 충분).
4. **OR-Set 의 핵심은 "삭제는 보았던 add 만"** — 동시 add+remove 시 add 가 살아남게 unique tag 를 단다.
5. **현 msa 는 single-region single-master 이라 CRDT 가 필요 없다** — 도입 보류 ADR 이 결론.

---

## 소주제 지도

> 19개 파일로 분할. 각 파일 평균 ~250-400 줄.

### Phase 1: 기반 이론 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 분산 환경의 쓰기 충돌 — LWW · sibling · manual merge | [01-distributed-conflict.md](01-distributed-conflict.md) | multi-master 의 본질적 문제, Dynamo sibling, GitHub 의 3-way merge |
| 02 | SEC · semilattice · 수렴 증명 직관 | [02-sec-semilattice.md](02-sec-semilattice.md) | join 의 ACI(associative/commutative/idempotent) 가 곧 수렴 |
| 03 | CvRDT vs CmRDT (state vs op) | [03-cvrdt-vs-cmrdt.md](03-cvrdt-vs-cmrdt.md) | 전송량 vs 전파 보장 트레이드오프, hybrid 의 등장 |

### Phase 2: 자료구조 (8개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 04 | Counter — G-Counter · PN-Counter · Bounded | [04-counter-crdts.md](04-counter-crdts.md) | per-replica vector + max merge, 음수는 P-N 분리 |
| 05 | Set — G-Set · 2P-Set · OR-Set · LWW-Element-Set | [05-set-crdts.md](05-set-crdts.md) | tombstone 의 한계, OR-Set 의 unique tag, Add/Remove-Wins |
| 06 | Register — LWW-Register · MV-Register | [06-register-crdts.md](06-register-crdts.md) | clock skew 가 LWW 를 깨는 이유, MV 가 vector clock 으로 fork |
| 07 | Map — OR-Map · Riak DT Map · 재귀 합성 | [07-map-crdts.md](07-map-crdts.md) | embed 된 CRDT 의 reset 문제, observed-remove 패턴 |
| 08 | Sequence — Logoot · Treedoc · RGA · WOOT · Yata | [08-sequence-crdts.md](08-sequence-crdts.md) | dense identifier, interleaving 문제, Yata 의 origin 트릭 |
| 09 | JSON CRDT — Automerge · Yjs | [09-json-crdts.md](09-json-crdts.md) | Document = Map+List+Register 합성, opset 모델 |
| 10 | Causal Context — dot · dot-context · dot store | [10-causal-context.md](10-causal-context.md) | 단순 vector clock 으로 부족한 이유, optimized OR-Set |
| 11 | Delta-CRDT · Anti-Entropy | [11-delta-crdt.md](11-delta-crdt.md) | state 전송량 폭증 해결, gossip 와 결합 |

### Phase 3: 운영 / 확장 / 비교 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 12 | Tombstone GC · Causal Stability · Compaction | [12-garbage-collection.md](12-garbage-collection.md) | tombstone 누적이 진짜 적, stable timestamp 합의 |
| 13 | MRDT (Irmin) — Git-style 3-way merge + LCA | [13-mrdt.md](13-mrdt.md) | LCA + replay merge, 사용자 정의 merge function |
| 14 | CRDT vs OT (Operational Transform) | [14-crdt-vs-ot.md](14-crdt-vs-ot.md) | OT 의 transformation matrix, 왜 협업 에디터가 CRDT 로 이동했나 |
| 15 | Byzantine 환경 · BFT-CRDT | [15-byzantine-bft.md](15-byzantine-bft.md) | 일반 CRDT 는 신뢰 노드 가정, 위변조 위협, 연구 동향 |

### Phase 4: 실 시스템 + msa 적용 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 16 | 실 시스템 — Riak DT · Redis CRDB · Yjs · Automerge · Roshi · Figma | [16-real-systems.md](16-real-systems.md) | 누가 어디까지 채택, sibling 노출 vs 자동 merge |
| 17 | msa 적용 가능성 — analytics/wishlist/quant | [17-msa-application.md](17-msa-application.md) | 코드 직접 분석, single-region 가정 하에서의 결론 |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 18 | 도입 검토 결론 + ADR 후보 | [18-improvements.md](18-improvements.md) | "현 시점 보류 — 트리거 조건 명시" |
| 19 | 면접 Q&A 카드 + 꼬리질문 50문항 | [19-interview-qa.md](19-interview-qa.md) | Phase별 8문항 + 꼬리질문 + 자가평가 |

---

## 개념 관계도

```
                    ┌────────────────────────┐
                    │  Layer 1: 이론          │
                    │  SEC ← Semilattice      │
                    │  Causal Context (dot)   │
                    └────────────┬───────────┘
                                 │ "데이터로 구현"
                                 ▼
                    ┌────────────────────────┐
                    │  Layer 2: 자료구조      │
                    │  Counter / Set /        │
                    │  Register / Sequence    │
                    └────────────┬───────────┘
                                 │ "합성/최적화"
                                 ▼
                    ┌────────────────────────┐
                    │  Layer 3: 운영          │
                    │  Map(재귀) · Delta · GC │
                    │  MRDT (Git-style)       │
                    └────────────┬───────────┘
                                 │ "실 시스템"
                                 ▼
                    ┌────────────────────────┐
                    │  Layer 4: 시스템        │
                    │  Riak DT · Redis CRDB   │
                    │  Yjs · Automerge        │
                    └────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 분산 쓰기 충돌 해결 4가지 패러다임

| 패러다임 | 예 | 특징 |
|---|---|---|
| **Single-master (강한 일관성)** | 현 msa MySQL primary | 충돌이 없으나 가용성/지연 손해 |
| **LWW (Last-Write-Wins)** | Cassandra default | 단순, 잃어버린 쓰기 위험 |
| **Sibling 노출** | Dynamo / Riak (CRDT 도입 전) | 앱이 직접 merge — 구현 부담 |
| **CRDT (자동 merge)** | Redis CRDB · Yjs · Automerge | merge 가 수학적으로 결정론 |

### 절대 헷갈리지 말 것

- **CRDT ≠ Eventually Consistent** — CRDT 는 수렴까지 보장하는 *Strong* EC.
- **vector clock ≠ causal context** — vector clock 은 dot 의 합집합으로 압축된 형태일 뿐.
- **LWW-Register ≠ Last-Write-Wins** — LWW 충돌 해결 정책은 모든 register 가 쓸 수 있다.
- **state-based 가 항상 무거운 건 아님** — delta-CRDT 가 op-based 와 비슷한 전송량까지 압축.
- **CRDT 는 Byzantine 안전이 아님** — 악의적 replica 가 false dot 을 보내면 깨진다.

### 권장 학습 순서

1. **이론 다지기** (01 → 02 → 03) — semilattice 가 머리에 박힐 때까지.
2. **자료구조 직진** (04 → 05 → 06 → 10 → 11) — 10/11 은 5/6 학습 후 다시 보면 명확.
3. **합성 + 협업 에디터** (07 → 08 → 09) — Yjs/Automerge 의 데이터 모델 이해.
4. **운영 / 비교** (12 → 13 → 14 → 15) — Git, OT 와의 비교는 면접 단골.
5. **실 시스템 + 적용** (16 → 17) — msa 코드 직접 보며 결론.
6. **마무리** (18 → 19) — ADR 후보 + 면접 회독.

---

## 학습 진행 가이드

- 권장 순서: **01 → ... → 17** (직진), 산출물(18-19)은 마지막
- Phase 1 (01-03) 은 반드시 순서대로 — semilattice 모르면 뒤가 안 박힌다
- Phase 2 의 08-09 (Sequence/JSON) 는 협업 에디터 관심자만 깊게, 그 외는 개념만
- Phase 3 의 13 (MRDT) 는 OCaml 모르면 의사코드 위주로 — Git 3-way merge 와 매핑
- Phase 4 (16-17) 는 코드베이스 작업 시 옆에 두고 의사결정 도구로 활용
- **19-interview-qa.md** 는 회독용 — 학습 종료 후 1주일 간격으로 2-3회 회독 권장

각 파일 호출:
```
/study:start 14           # 다음 deep file 자동 선택
/study:start 14 08        # 08-sequence-crdts.md 직접 지정
```
