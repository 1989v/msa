---
parent: 14-crdt-mrdt
seq: 19
title: 면접 Q&A 카드 + 50문항 인덱스 + 자가 평가 + 꼬리질문
type: deep
created: 2026-05-01
---

# 19. 면접 Q&A 카드 + 인덱스

> 회독용. 학습 종료 후 1주일 간격으로 2-3회 회독 권장.

---

## Phase 1: 분산 충돌 + SEC + 패러다임 (8개)

**Q1.1** CRDT 가 정확히 무엇인가?
> Conflict-free Replicated Data Type — 분산 환경에서 여러 replica 가 동시에 쓰기를 해도 자동으로 수렴하는 자료구조. 핵심은 merge 함수가 associative · commutative · idempotent (ACI) 라서 어떤 순서/중복으로 합쳐도 같은 결과. 그래서 *Strong* Eventually Consistent 보장이 가능.

> 꼬리질문: "Eventually Consistent 와의 차이를 더 명확히?"
>> EC 는 "충분히 오래 기다리면 수렴" 만 보장. 어디로 수렴할지는 시계/도착 순서로 다를 수 있음. SEC 는 "같은 update 집합을 본 replica 는 deterministic 하게 같은 state". 결정론이 추가된 강한 보장.

**Q1.2** 분산 환경에서 동시 쓰기 충돌 해결 패러다임은?
> 4가지. (1) single-master — 쓰기 한 곳만, 충돌 자체 회피. (2) LWW — timestamp 큰 쪽 채택, lost update 위험. (3) sibling 노출 — 양쪽 보관 후 앱이 merge, 구현 부담. (4) CRDT — 자료구조에 merge 함수 박아 자동. 현 msa 는 (1).

> 꼬리질문: "Cassandra 가 LWW 를 쓰는데, lost update 가 실제 큰 문제인가?"
>> 그렇다. 두 노드 시계가 100ms 어긋나면 100ms 차이로 들어온 두 쓰기 중 하나는 잃는다. NTP 보정해도 완전 정합 어려움. Cassandra 가 logging/event store 위주에 쓰이는 이유.

**Q1.3** Semilattice 와 CRDT 의 관계는?
> CvRDT 의 state 는 join semilattice — 결합/교환/멱등 ACI 갖춘 partial order. merge 가 두 state 의 least upper bound (join). ACI 셋이 있으니 op 도착 순서 / 재전송 / 중복에 무관하게 같은 state 로 수렴.

> 꼬리질문: "ACI 중 하나라도 깨지면?"
>> associative 깨지면 결합 순서로 결과 다름 → 수렴 안 됨. commutative 깨지면 도착 순서로 다름. idempotent 깨지면 같은 메시지 재전송 시 폭주. G-Counter 의 merge 가 sum 이 아닌 max 인 이유는 idempotent 보장 때문.

**Q1.4** CvRDT 와 CmRDT 의 차이는?
> CvRDT (state-based) 는 state 자체를 broadcast, eventual gossip 으로 충분. CmRDT (op-based) 는 op 만 broadcast, 단 reliable causal delivery 필수. CvRDT 가 더 자유로운 인프라 위에서 동작 가능, CmRDT 가 전송량 작음. delta-CRDT 가 두 장점 결합.

> 꼬리질문: "Kafka 위에 CRDT 올린다면?"
>> Kafka 는 partition 내 ordering + at-least-once. exactly-once 는 transactional API 또는 idempotent consumer. op-based 가 자연스럽지만 idempotent op 강제가 필요. state-based 라면 정기 snapshot 만 publish.

**Q1.5** monotonic update 가 깨지면 어떻게 되나?
> CvRDT 의 update 는 monotonic — `s ≤ update(s, u)` 보장. 깨지면 merge 가 과거 state 로 되돌릴 수 있음. 카운터 감소, Set 에서 원소 사라짐 등. G-Counter 가 항상 + 만 하는 이유.

> 꼬리질문: "Set 의 remove 는 monotonic 인가?"
>> 단순 remove 는 깨짐. 그래서 OR-Set 은 *tombstone Set* 또는 *dotstore + ctx* 로 monotonic 유지. 지운 dot 의 정보는 영원히 남음 (tombstone) 또는 ctx 에 압축.

**Q1.6** CRDT 의 단점 3가지?
> (1) 메타데이터 오버헤드 — vc, dot, tag 가 데이터보다 클 수 있음. (2) tombstone 누적 — 삭제해도 정보 남음, GC 어려움 (causal stability 합의 필요). (3) Byzantine 안전 아님 — 악의적 replica 가 false dot 발행 시 깨짐.

> 꼬리질문: "tombstone GC 가 왜 어려운가?"
>> 어떤 dot 을 안전히 지우려면 모든 replica 가 본 적 있어야 함 (causal stable). 이를 알려면 모든 replica 의 vc 수집 → 분산 합의 비용. 시간 기반 (Cassandra grace period) 은 정확성 약함.

**Q1.7** Strong Eventual Consistency 의 정식 정의?
> 두 replica 가 같은 update 집합을 받았다면 query 결과가 동일. 즉 동일 inputs → deterministic outputs. EC 는 *수렴 자체* 만, SEC 는 *수렴 + 결정론*. Shapiro 2011 논문이 기원.

**Q1.8** 현 msa 가 CRDT 안 쓰는 이유?
> Single-region single-master. MySQL primary 1대, Redis standalone, Kafka partition. 분산 동시 쓰기 자체가 없음. CRDT 의 트리거인 multi-region active-active / 오프라인 / 협업 어느 것도 결정 안 됨.

---

## Phase 2: 자료구조 (12개)

**Q2.1** G-Counter 의 동작?
> 각 replica 가 자기 entry 만 +1 증가, merge 는 entry 별 max. value 는 모든 entry 합. naive sum-merge 는 idempotent 깨져 같은 메시지 재전송 시 폭주. max 는 idempotent.

> 꼬리질문: "replica 가 1만 개라면?"
>> entry 1만 개. delta-CRDT 로 변경분만 전송하거나, hierarchical (region 단위 aggregation) 으로 압축. Riak 은 hashed bucket 으로 entry 분리.

**Q2.2** PN-Counter 가 G-Counter 두 개인 이유?
> 단일 G-Counter 로 decrement 불가 — monotonic 깨짐. 양수 G-Counter (P) + 음수 G-Counter (N) 으로 분리하면 둘 다 grow-only 유지. value = P.value() - N.value().

**Q2.3** Bounded Counter 의 어려움?
> 단순 검사 (`if value < max`) 는 local view 만 봐서 동시 increment 시 합쳐 상한 초과. 해결: escrow / reservation — 노드별 reservation 분배, 사용 시 차감, 부족 시 노드 간 협상 (sync 필요 → 강한 정합성 등장).

**Q2.4** 2P-Set 의 치명적 한계?
> 한 번 삭제한 원소 재추가 불가. tombstone Set 에 영원히 남음. add → remove → add 순서로 했을 때 마지막 add 가 dead 인 상태로 무시됨.

**Q2.5** OR-Set 이 2P-Set 보다 진보한 점?
> 각 add 에 unique tag 부여. remove 는 *본 적 있는 tag 만* kill. 새 add 는 새 tag 라 기존 tombstone 영향 없음. concurrent add+remove 시 add 가 이김 (사용자가 모르는 add 는 죽이지 않음).

> 꼬리질문: "OR-Set 의 tag 는 어떻게 만드나?"
>> `(replicaId, sequenceNumber)` 또는 UUID. unique 하면 충분. 단순 구현은 tag 누적 → optimized OR-Set 은 dot store + causal context 로 압축.

**Q2.6** Add-Wins vs Remove-Wins 정책?
> default 가 Add-Wins (OR-Set 의 자연 시맨틱). concurrent add+remove 시 add 가 이김. Remove-Wins 는 권한 회수 같은 경우에 자연 — concurrent 시 remove 가 이김. 보안 권한, 게시판 차단 등.

**Q2.7** LWW-Register 의 핵심 단점?
> Clock skew. 두 노드 시계 차이로 *나중* 쓰기가 *먼저* 쓰기에게 짐. NTP 보정해도 완전 동기화 어려움. 100ms 차이로 들어온 두 쓰기 중 하나는 잃을 수 있음.

> 꼬리질문: "MV-Register 가 어떻게 해결?"
>> vector clock 비교로 happens-before / concurrent 구분. concurrent 일 때만 둘 다 보존 (sibling). clock skew 영향 거의 없음. 단점: read 가 set 반환 → 앱이 sibling 처리 필요.

**Q2.8** Map CRDT 의 핵심 어려움?
> Value 가 CRDT 면 merge 도 재귀. key 의 add/remove 와 value 의 update 가 concurrent 일 때 *reset 의미* 가 모호. Riak DT Map 의 답: observed-remove. 본 적 있는 tag 만 죽음, 새 put 은 새 인스턴스.

**Q2.9** 협업 에디터의 동시 편집 처리?
> Sequence CRDT (RGA / Yata 계열). 각 char 가 globally unique id 를 가짐. insert 는 id-anchored — 두 동시 insert 도 id tie-break 으로 결정론적 정렬. tombstone 으로 delete 표현.

> 꼬리질문: "RGA 와 Yata 의 차이?"
>> RGA 는 prev (왼쪽 이웃) 만, 같은 prev 에 동시 insert 시 interleaving 가능 (글자 섞임). Yata 는 originLeft + originRight 로 block 단위 정렬, interleaving 방지. Yjs 가 Yata 사용.

**Q2.10** Yjs 와 Automerge 의 차이?
> Yjs 는 binary encoding 효율 + history 압축 → 큰 document 협업 production. Automerge 는 모든 op 보존 → time travel + local-first 충실, 메모리 큼. 큰 document = Yjs, 데이터 보존 critical = Automerge.

**Q2.11** Causal context 의 역할?
> Vector clock 의 진화. dot = (replicaId, seq) 가 단일 op 의 unique id. ctx = 본 적 있는 dot 들의 집합. *ctx \ dotstore* 가 곧 tombstone 정보 — tombstone 명시 저장 줄임. optimized OR-Set 의 핵심.

**Q2.12** Delta-CRDT 의 가치?
> CvRDT 의 전송량 폭증 해결. update 시 변경분 (delta) 만 broadcast. delta 자체가 작은 CRDT state 라 join 으로 merge. CmRDT 의 op-level 가벼움 + CvRDT 의 인프라 자유 결합.

---

## Phase 3: 운영 + 비교 (10개)

**Q3.1** CRDT 의 가장 큰 운영 문제?
> Tombstone 누적. add/remove 반복 시 ctx 가 영원히 자라 메모리 폭주. GC 가 핵심이지만 분산 합의 (causal stability 계산) 가 필요.

**Q3.2** Causal stability 의 정의와 활용?
> dot d 가 모든 replica 에서 본 적 있으면 stable. element-wise min(vc_i) 으로 계산. stable 한 dot 은 GC 가능 — 더 이상 누군가가 "새 op" 라며 들고올 수 없음.

> 꼬리질문: "stable_vc 를 어떻게 알아내?"
>> Gossip 으로 vc 교환. 또는 중앙 coordinator (SPOF). 또는 Chandy-Lamport snapshot. trade-off 는 정확성 vs 비용.

**Q3.3** Cassandra 의 grace period (gc_grace_seconds) 와 CRDT GC 차이?
> Cassandra 는 시간 기반 — 그 시간 안에 모든 replica sync 가정. 깨지면 zombie data. CRDT GC 는 causal stability 기반 — 모든 replica 가 *본 적 있을 때만* 삭제. 정확성 강함.

**Q3.4** MRDT 와 CRDT 의 차이?
> CRDT 는 모든 op 의 fold (순서 무관). MRDT 는 LCA 기반 3-way merge (Git-style). CRDT 는 자동 수렴 보장 강함, MRDT 는 사용자 정의 merge 자유도 강함. Irmin 이 MRDT 의 reference.

> 꼬리질문: "Git merge 가 MRDT 의 origin?"
>> 사실상 그렇다. Git 은 file 단위 LCA + 3-way merge. MRDT 는 그 모델을 데이터베이스 데이터에 일반화. 사용자가 merge 함수 정의 + commit graph 보존.

**Q3.5** CRDT 와 OT 의 핵심 차이?
> OT (Operational Transform) 는 op 의 *변환* 으로 commutativity 달성, 보통 중앙 서버 필요. CRDT 는 자료구조 자체를 재설계해 자동 수렴, P2P 친화. Google Docs 가 OT, Figma 가 CRDT (자체 구현).

> 꼬리질문: "Figma 가 OT 안 쓴 이유?"
>> 결정론 + 오프라인 친화 + 구현 단순. OT 의 N×N 변환 정의 부담. 신생 도구 (Notion, Linear, tldraw) 들이 모두 CRDT 채택 추세.

**Q3.6** CRDT 가 Byzantine safe 한가?
> 아님. 모든 replica 가 정직하다고 가정. 악의적 replica 가 false dot/op 발행하면 깨짐. BFT-CRDT 는 서명 (op 위조 방지), forking 탐지, hash chain (Merkle DAG), threshold acceptance (BFT 합의 결합) 등으로 보강.

**Q3.7** CRDT vs Saga / Outbox 의 비교?
> Saga 는 도메인 간 *순서가 의미 있는* eventual consistency (보상 트랜잭션). CRDT 는 *순서 무관 수렴*. quant 은 outbox + Saga (자금 정확성). multi-region 사용자 데이터는 CRDT (자동 merge). 다른 트레이드오프.

**Q3.8** Local-first 가 무엇이고 CRDT 와의 관계?
> 데이터를 로컬에 두고 sync 는 부가. 즉시 응답 + 오프라인 동작 + 협업 + 데이터 소유권 + 보안. CRDT 가 핵심 building block. Ink & Switch 그룹의 패러다임 변환 제안.

**Q3.9** production CRDT 시스템 예?
> 분산 KV: Riak DT, Redis Enterprise CRDB, Akka Distributed Data. 협업 도구: Yjs (오픈소스 표준), Automerge (local-first), Figma (자체 구현). 특화: Roshi (timeline).

**Q3.10** delta-CRDT 와 op-based 의 차이?
> Delta 는 *상태의 부분집합* (idempotent merge), op 는 *변경 행위* (보통 idempotent 아님). delta 는 중복 전송에 강하고 causal context 도 불필요. op-based 는 reliable causal delivery 필수.

---

## Phase 4: msa 적용 + 시야 (10개)

**Q4.1** msa 에 CRDT 도입 검토 결과?
> 보류. 현 시점 single-region single-master + 정확성 우선 도메인. 트리거 4개 (multi-region / 오프라인 모바일 / 협업 / Byzantine partner) 어느 것도 결정 안 됨. ADR 로 트리거 조건 명시 권장.

**Q4.2** analytics PV/UV 카운터에 CRDT 검토했다면?
> Kafka partition 단위로 단일 consumer 가 처리 → 동시 쓰기 자체 없음. PN-Counter 도 의미 없음. multi-region 으로 가면 G-Counter 자연스러우나 region 별 sum 으로도 충분.

**Q4.3** wishlist 에 OR-Set 가능?
> 오프라인 모바일 앱 추가 시 자연스러움. mobile/web 동시 수정의 의도 명확. 현재 단일 master MySQL + unique 제약 + 즉시 sync 라 불필요. 트리거: T2 (오프라인 모바일).

**Q4.4** quant 에 CRDT 적합?
> 부적합. 자금 거래 = 정확성 critical. state machine 의 순서가 의미 있음 (BUY → FILLED → SELL). CRDT 의 임의 merge 결정 불가. 거래소 자체가 single source of truth — region 분산 의미 없음.

**Q4.5** multi-region 으로 가면 무엇부터?
> Redis Enterprise CRDB 의 cache layer. 낮은 위험. 글로벌 카운터 두 번째. 사용자 데이터 (wishlist) 마지막. 정확성 critical 한 자금 거래 (quant) 는 region 분산 안 함.

**Q4.6** 협업 도구 추가하면 어떤 CRDT?
> Yjs (production-grade JS 라이브러리). WebSocket relay 서버 1대 + y-leveldb 또는 자체 persistence. ProseMirror / Quill 같은 에디터의 어댑터 풍부. Y.Map / Y.Array / Y.Text 매핑.

**Q4.7** 팀이 CRDT 모른 채 multi-region 가도 되나?
> 위험. eventual consistency 의 정확한 의미와 수렴 보장 모르고 운영하면 silent data corruption. 학습 + POC 후 도입 권장. 본 학습 자료가 그 출발점.

**Q4.8** CRDT 가 학습 가치 있는 이유 (안 써도)?
> (1) 분산 시스템 사고력 — vector clock, causal context 가 일반 분산 시스템 디버깅에 적용. (2) EC 의미 명확화 — SEC vs EC 구분. (3) Saga / Outbox 와 비교 적재적소 선택. (4) Local-first 미래 도구 평가.

**Q4.9** 분산 데이터 sync 패러다임 4가지?
> (1) Single-master + replica — 강한 정합성, 단일 region. (2) Saga + Outbox + CDC — eventual, 도메인 간. (3) CRDT — eventual 자동 merge, multi-region / P2P. (4) Blockchain / BFT — 강한 무결성, Byzantine 안전, 비용 큼.

**Q4.10** CRDT 의 미래는?
> 협업 도구 영역 빠르게 성장 — Notion, Linear, tldraw 모두 CRDT. local-first 패러다임 부상. 분산 KV 영역은 정체 (Riak 사례). 실시간 분산 ML / 게임 state 등 새 영역 가능성. 5-10년 내 주류 도구는 CRDT-aware.

---

## 자가 평가 체크리스트

학습 종료 후 한 줄로 답할 수 있어야 합격선.

### 이론 (Phase 1)
- [ ] CRDT 와 EC 의 차이를 한 문장으로 설명할 수 있다.
- [ ] Semilattice 의 ACI 가 왜 수렴 보장인지 직관적으로 설명할 수 있다.
- [ ] CvRDT vs CmRDT 의 인프라 요구 차이를 설명할 수 있다.
- [ ] G-Counter 가 sum 이 아닌 max merge 인 이유를 설명할 수 있다.
- [ ] monotonic update 가 깨지면 어떻게 되는지 답할 수 있다.

### 자료구조 (Phase 2)
- [ ] G-Counter, PN-Counter 의 정의와 차이를 30초로 설명할 수 있다.
- [ ] OR-Set 의 unique tag 가 왜 필요한지, 2P-Set 의 어떤 한계를 푸는지 답할 수 있다.
- [ ] LWW-Register 의 clock skew 문제를 구체 예시로 설명할 수 있다.
- [ ] MV-Register 의 sibling 처리 방식을 설명할 수 있다.
- [ ] Sequence CRDT (RGA / Yata) 의 globally unique id 트릭을 설명할 수 있다.
- [ ] Yjs 와 Automerge 의 production 차이를 설명할 수 있다.
- [ ] Causal context 의 역할을 ctx \ dotstore 트릭과 함께 설명할 수 있다.
- [ ] Delta-CRDT 의 가치를 한 문장으로 설명할 수 있다.

### 운영 + 비교 (Phase 3)
- [ ] Tombstone GC 와 causal stability 의 관계를 설명할 수 있다.
- [ ] CRDT 와 OT 의 핵심 차이 + Figma 사례를 설명할 수 있다.
- [ ] MRDT (Irmin) 와 CRDT 의 차이를 Git 비유로 설명할 수 있다.
- [ ] CRDT 의 Byzantine 가정과 BFT-CRDT 의 보강 방향을 설명할 수 있다.
- [ ] Saga / Outbox / CRDT / BFT 4개 패러다임의 적재적소를 답할 수 있다.

### msa 적용 (Phase 4)
- [ ] msa 에 CRDT 도입 안 하는 이유를 트리거 조건과 함께 설명할 수 있다.
- [ ] analytics / wishlist / quant 각각의 평가 결론을 답할 수 있다.
- [ ] multi-region 결정 시 도입 단계 (cache → counter → user data) 설명할 수 있다.
- [ ] 협업 도구 추가 시 Yjs 선택 근거를 설명할 수 있다.

---

## 50문항 빠른 인덱스

```
이론
1.  CRDT 의 정의?
2.  EC vs SEC?
3.  Semilattice 의 ACI?
4.  CvRDT vs CmRDT?
5.  Causal delivery 의 의미?
6.  Monotonic update?
7.  Bottom (⊥) 의 의미?
8.  CRDT 의 단점 3가지?
9.  단일 master vs LWW vs sibling vs CRDT?
10. clock skew 가 LWW 깨는 시나리오?

자료구조
11. G-Counter 의 동작?
12. G-Counter 가 max merge 인 이유?
13. PN-Counter 가 G-Counter 두 개인 이유?
14. Bounded Counter 의 escrow?
15. G-Set 의 정의?
16. 2P-Set 의 한계?
17. OR-Set 의 unique tag?
18. Add-Wins vs Remove-Wins?
19. LWW-Register 의 단점?
20. MV-Register 의 vector clock 사용?
21. OR-Map 의 reset 시맨틱?
22. Riak DT Map 의 재귀 합성?
23. Sequence CRDT 의 globally unique id?
24. RGA vs Yata 차이?
25. Yjs vs Automerge 차이?
26. JSON CRDT 의 합성?
27. Local-first 의 정의?
28. Causal context (dot, ctx)?
29. Optimized OR-Set 의 ctx \ dotstore?
30. Delta-CRDT 의 가치?

운영 + 비교
31. Tombstone GC 의 어려움?
32. Causal stability 의 정의?
33. stable_vc 계산 방법?
34. Cassandra grace period vs CRDT GC?
35. Yjs 의 GC 전략?
36. Automerge 의 history 보존?
37. MRDT (Irmin) 의 3-way merge?
38. Git 과 MRDT 의 관계?
39. CRDT vs OT?
40. Figma 가 CRDT 채택한 이유?
41. Byzantine 환경에서 CRDT?
42. BFT-CRDT 의 접근 (서명, hash chain, threshold)?
43. CRDT vs Saga / Outbox?
44. Production 시스템 예 (Riak, Redis, Yjs)?

msa 적용
45. msa 에 CRDT 안 쓰는 이유?
46. analytics 에 CRDT 검토 결과?
47. wishlist 에 OR-Set 적용 시점?
48. quant 에 CRDT 부적합 이유?
49. multi-region 결정 시 도입 순서?
50. 협업 도구 추가 시 Yjs 선택 근거?
```

---

## 회독 가이드

### 1차 회독 (학습 종료 직후)

- 전체 50문항 답변 시도 (10초 내 핵심 답)
- 막힌 부분만 해당 deep file 다시
- 답변 정확성보다 핵심 idea 회상 위주

### 2차 회독 (1주일 후)

- Phase 1 + 2 위주 (이론 + 자료구조)
- 잊은 부분 deep file 의 핵심 박스만
- 한국어로 자연스럽게 설명 연습

### 3차 회독 (2주일 후, 면접 직전)

- Phase 3 + 4 위주 (운영 + msa 적용)
- 꼬리질문 대비 — 실제 면접에서 follow-up 자주 나옴
- 자가 평가 체크리스트 모두 ✓ 확인

---

## 면접에서 주의할 표현

```
좋은 답변 패턴:
- "결론 먼저" — "X 가 Y 라서 Z 입니다"
- "근거 — 메커니즘" — 왜 그런지 자료구조 / 알고리즘 수준 설명
- "트레이드오프 인정" — "단 X 단점이 있어 Y 환경에선 Z 검토"
- "현 시스템 매핑" — "msa 의 W 영역에 그러나 트리거 없어 미도입"

피할 표현:
- "어... 그러니까..." — 시작이 흐릿하면 답 전체가 흐릿해보임
- "CRDT 는 좋습니다" 단순 칭찬 — 트레이드오프 무시
- "들어본 것 같은데..." — 부정확하면 차라리 모른다고
- 키워드 나열 — semilattice / vc / dot 만 던지지 말고 한 문장으로 연결
```
