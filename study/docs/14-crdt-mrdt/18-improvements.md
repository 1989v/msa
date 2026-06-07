---
parent: 14-crdt-mrdt
seq: 18
title: msa 도입 검토 결론 + ADR 후보 — CRDT 보류
type: deep
created: 2026-05-01
---

# 18. CRDT 도입 검토 결론 + ADR 후보

[17-msa-application.md](17-msa-application.md) 의 영역별 분석을 바탕으로 한 CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 도입 종합 결론과 ADR 후보 초안.

## 한 줄 결론

> 현 시점 msa 는 single-region single-master 운영이라 CRDT 도입 트리거가 없음. **ADR-NNNN** 으로 "현 시점 보류 + 트리거 조건" 을 기록.

## 도입 검토 종합 표

| # | 영역 | 검토 결과 | 우선순위 | ADR 필요 |
|---|---|---|---|---|
| 1 | analytics PV/UV 카운터 | 단일 region/partition 처리, CRDT 불필요 | 낮음 | N |
| 2 | analytics 좋아요 카운터 (가상) | PN-Counter 후보지만 multi-region 미정 | 낮음 | N |
| 3 | wishlist 멀티 디바이스 sync | 오프라인 모바일 앱 추가 시 OR-Set | 중간 (조건부) | Y (조건부) |
| 4 | quant 포지션 sync | 자금 거래, 정확성 우선 → CRDT 부적합 | 낮음 | N |
| 5 | admin / agent-viewer 협업 | 팀 협업 추가 시 Yjs | 낮음 | N |
| 6 | ideabank 협업 PRD | 협업 추가 시 Yjs / Automerge | 낮음 | N |
| 7 | 글로벌 cache (Redis CRDB) | multi-region 결정 시 검토 | 낮음 | Y (조건부) |
| 8 | 외부 partner federation | 비전제, 보류 | 매우 낮음 | N |
| 9 | 도입 보류 ADR (트리거 명시) | 학습 후 즉시 작성 가능 | **높음** | **Y** |
| 10 | 면접 / 학습 자료 정리 | 본 문서 + 19번 회독 | 중간 | N |

## 즉시 추진 가치: ADR 1개

### ADR-NNNN: CRDT 도입 검토 — 현 시점 보류

```
Status: Accepted
Date: 2026-05-01

Context:
  - 분산 데이터 sync 의 한 패러다임으로 CRDT (Conflict-free Replicated Data Type) 가
    Riak DT, Redis CRDB, Yjs, Automerge 등 production 시스템에서 검증됨.
  - 현 msa 는 multi-region active-active, 오프라인 모바일 앱, 협업 편집 도구 모두
    현 시점 트리거가 아님.
  - single-region single-master 운영에서는 CRDT 가 풀어야 할 문제 자체가 없음.

Decision:
  현 시점 msa 에 CRDT 도입을 *보류*. 단, 다음 트리거 중 하나라도 결정되면
  본 ADR 을 갱신하고 영역별 CRDT 선택 ADR 작성.

Triggers (도입 검토 재개 조건):
  T1. multi-region active-active 결정 (글로벌 사용자 < 200ms SLA 등)
      → 가장 자연스러운 후보: Redis Enterprise CRDB (cache layer)
      → 사용자 데이터 (wishlist 등) 는 별도 검토

  T2. 오프라인 우선 모바일 앱 추가
      → wishlist, ideabank 등 사용자 데이터 sync 필요
      → 후보: 자체 OR-Set 구현 또는 Yjs/Automerge 임베딩

  T3. 협업 편집 도구 추가 (admin, ideabank 의 PRD 협업, design tool 등)
      → 후보: Yjs (production-grade) 또는 Automerge (local-first)

  T4. 외부 partner 시스템과 분산 데이터 sync (Byzantine 위협 가능성)
      → 별도 ADR 로 BFT-CRDT 또는 federation 모델 검토

Consequences:
  + 현재 운영 단순 유지 (CRDT 메타데이터, GC 부담 없음)
  + 정확성 우선 도메인 (quant) 에 임의 merge 결정 회피
  - multi-region 으로 갈 때 CRDT 미경험 → 학습 비용 발생
  - 따라서 학습 자료 (study/docs/14-crdt-mrdt/) 를 미리 보유 (mitigation)

Alternatives Considered:
  A1. 일부 영역 (wishlist) 에 미리 OR-Set 도입
      → 오프라인 사용 사례 없어 비용만 발생, 거부.
  A2. analytics 에 G-Counter 도입
      → 단일 partition 처리로 충돌 자체가 없어 의미 없음, 거부.
  A3. quant 에 CRDT 적용
      → 자금 정확성 critical, 임의 merge 결정 불가, 거부.

Related:
  - ADR-0019 (K8s migration)
  - ADR-0017 (Analytics scoring)
  - ADR-0024 (Quant service)
```

## 학습 가치 정리 (CRDT 를 안 쓰더라도)

CRDT 학습 자체가 도움 되는 부분.

### 1. 분산 시스템 사고력 강화

- vector clock, causal context 같은 도구는 *Kafka 의 partition + offset*, *Redis pub/sub* 등에도 적용 가능
- happens-before 관계가 일반적 분산 시스템 디버깅에 도움

### 2. Eventual Consistency 의미 명확화

- "EC 면 충분" 같은 모호한 답을 더 정밀하게 — SEC vs EC, 수렴 보장 강도

### 3. Saga / Outbox / CDC 와의 비교

- quant 의 outbox 가 한 도메인 안에서 *순서 보장* 을 위해 사용
- CRDT 는 *순서 무관 수렴* — 다른 트레이드오프
- 두 패턴을 비교 이해하면 적재적소 선택

### 4. 협업 도구 / Local-first 의 미래

- 이 영역은 향후 5-10년 가장 큰 변화 예상
- CRDT 이해는 신생 도구 평가 능력

## 학습 후 즉시 가능한 체크리스트

- [ ] **ADR-NNNN 작성** — 위 초안 기반, 트리거 조건 4개 명시
- [ ] **docs/standards 에 분산 sync 패턴 가이드** — CRDT 외에도 Saga, Outbox, CDC 비교
- [ ] **multi-region 운영 시 CRDT 후보 매핑 문서** — 위 표를 그대로 활용
- [ ] **면접 19번 회독** — 학습 직후 + 1주일 + 2주일

## 중기 (트리거 시) 추진 항목

```
T1 (multi-region) 결정 시:
  1. Redis Enterprise CRDB POC (또는 OSS Redis + 자체 anti-entropy 검토)
  2. cache layer 부터 도입 (낮은 위험)
  3. 글로벌 카운터 (PV/UV) 두 번째
  4. 사용자 데이터 (wishlist) 마지막 (가장 위험)

T2 (오프라인 모바일) 결정 시:
  1. wishlist 의 OR-Set 자체 구현 또는 Yjs 임베딩
  2. 모바일 앱 ↔ 서버 sync layer 설계
  3. tombstone GC 운영 setup

T3 (협업 도구) 결정 시:
  1. Yjs + WebSocket relay 도입
  2. Y.Map / Y.Array / Y.Text 매핑 설계
  3. persistence layer (y-leveldb 또는 자체)
```

## 장기 시야: 패러다임 비교

```
분산 데이터 동기화의 4가지 패러다임 (msa 가 향후 직면 가능):
  1. Single-master + replica (현 msa) — 강한 정합성, 단일 region 좋음
  2. Saga + Outbox + CDC — eventual 정합성, 도메인 간 (서비스 간)
  3. CRDT — eventual 자동 merge, multi-region / P2P
  4. Blockchain / BFT — 강한 무결성, Byzantine 안전, 비용 큼

대부분의 비즈니스 시스템은 1 + 2 조합. CRDT 는 multi-region 또는 협업.
```

## 대안 학습 후보 (CRDT 학습 다음 주제)

- **Operational Transform 심화** — Google Docs 사례 분석
- **Local-first 패러다임** — Ink & Switch 의 패러다임 변환
- **Saga vs CRDT vs Outbox** — 분산 정합성 패턴 비교 ADR
- **Multi-region 운영 일반론** — region 분리 / GeoDNS / failover

## 면접 포인트 — 도입 결론 관련

- **"왜 msa 에 CRDT 안 도입했나?"** — 현 시점 트리거 없음. single-region single-master + 정확성 우선 도메인. 오프라인 / multi-region / 협업 어느 트리거도 결정 안 됨.
- **"multi-region 으로 가면 무엇부터?"** — Redis Enterprise CRDB 의 cache layer 부터. 사용자 데이터는 마지막. 정확성 critical 한 자금 거래는 region 분산 자체를 안 함.
- **"오프라인 모바일 앱 만들면?"** — wishlist 같은 사용자 데이터에 OR-Set. Yjs 가 production-grade 라이브러리. 자체 구현은 학습 가치 있지만 운영 위험.
- **"팀이 CRDT 모른 채 multi-region 가도 되나?"** — 위험. eventual consistency 의 정확한 의미와 수렴 보장 모르고 운영하면 silent data corruption 위험. 학습 후 도입 권장.

## 다음 학습

- [19-interview-qa.md](19-interview-qa.md) — 면접 Q&A 카드 + 50문항 인덱스
- 별도 학습 주제 후보: Operational Transform / Local-first / Saga vs Outbox vs CRDT
