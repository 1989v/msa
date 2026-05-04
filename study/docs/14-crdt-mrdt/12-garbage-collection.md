---
parent: 14-crdt-mrdt
seq: 12
title: Tombstone GC · Causal Stability · Compaction
type: deep
created: 2026-05-01
---

# 12. Garbage Collection — CRDT 의 진짜 적

CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 가 학술 영역을 벗어나 실 시스템에서 쓰이려면 반드시 풀어야 하는 문제. **tombstone 누적 = 메모리 폭증**.

## 문제: Tombstone 이 사라지지 않는다

OR-Set 의 dot store 표현 다시 보기.

```
op 1만 번 (add → remove → add → remove ...):
  dotstore: {} (모두 삭제됨)
  ctx: 1만 dot

ctx 가 영원히 자란다 → 결국 메모리 폭주
```

심지어 dot store 가 비어있어도 ctx 가 있어야 *과거 dot 이 죽었음을 다른 replica 에게 알릴 수 있다*. 그래서 단순 ctx 청소 못 한다.

## 핵심 도구: Causal Stability

```
정의: dot d 가 stable
  ⟺ 시스템의 모든 replica 가 d 를 본 적이 있음
  ⟺ 더 이상 누군가가 "d 가 새 op 라며 들고올 수 없음"
```

stable 한 dot 은 안전하게 GC 가능.

```
계산:
  각 replica i 의 ctx_i 알고 있을 때
  stable = ⋂_i ctx_i   (intersection)
  또는 vector clock 형태로: stable_vc = element-wise min(vc_i)
```

### Element-wise Min 예시

```
A.vc = {A:5, B:3, C:4}
B.vc = {A:4, B:5, C:3}
C.vc = {A:3, B:3, C:5}

stable_vc = {A:3, B:3, C:3}

→ A:1~3, B:1~3, C:1~3 의 dot 은 모두 stable
→ ctx 에서 제거 가능
```

## Stability 정보 수집

각 replica 가 자기 ctx 를 다른 replica 에 주기적으로 알려야 stable_vc 계산 가능.

```
방법 1: 모든 replica 가 다른 replica 의 vc 를 추적
  → 각 replica 가 N×N 정보 보관 (N = replica 수)
  → 작은 시스템에서만 viable

방법 2: 중앙 GC coordinator
  → coordinator 가 모든 vc 수집, stable_vc 발행
  → coordinator 장애 시 GC 멈춤

방법 3: Gossip 기반 epoch 진행
  → 주기적으로 epoch 증가, 모든 replica 가 epoch_k 에 도달하면 epoch_k-1 까지 stable
  → Riak / Akka 가 사용
```

## Compaction

ctx 가 stable_vc 를 추적하면, 그 이하의 dot 을 ctx 에서 제거.

```
A.ctx = {A:5, B:3, C:4}
stable_vc = {A:3, B:3, C:3}

A.ctx after compaction:
  A:1~3 → 압축된 entry "A: 3" 으로 (또는 vc entry 로)
  B:1~3 → 압축
  C:1~3 → 압축
  남는 cloud: A:4, A:5, C:4   ← stable 위쪽

저장: vc {A:3, B:3, C:3} + cloud {(A,4), (A,5), (C,4)}
```

## OR-Set 의 dotstore Compaction

dotstore 는 살아있는 dot 만 저장 → tombstone 이 본질적으로 ctx 에 있다.

```
A.dotstore = {(A,5) → "apple", (C,4) → "orange"}
A.ctx = {A:5, B:3, C:4}
stable_vc = {A:3, B:3, C:3}

stable 한 부분 (A:1~3, B:1~3, C:1~3) 의 dot 은 모두 dotstore 에 없음 → 죽음
  → 이미 안전하게 잊을 수 있음

남는 ctx: vc {A:3, B:3, C:3} + cloud {(A,4), (A,5), (C,4)}
남는 dotstore: {(A,5) → "apple", (C,4) → "orange"}
```

## 시간 기반 GC (시도와 한계)

```
"30일 지난 tombstone 은 GC"

문제:
  - 어떤 replica 가 30일+ 동안 오프라인 + 그 동안 add 수행 → 합류 시 죽은 것을 새 add 라 착각
  - 즉 시간 기반은 *모든 replica 가 30일 안에 sync* 라는 가정
  - 모바일/오프라인 우선 앱에선 깨질 수 있음

Cassandra 의 grace period (gc_grace_seconds, default 10일) 가 같은 설계.
```

해결: stable_vc 기반이 정공법. 시간 기반은 위험 감수의 trade-off.

## Yjs 의 GC 전략

Yjs 는 production 에서 가장 잘 운영되는 CRDT 시스템. GC 전략:

```
1. Tombstone 의 Snapshot Compaction
   - 일정 주기로 모든 client 가 snapshot 합의
   - snapshot 시점 이전의 deleted item 은 *값 제거 + structure 만 유지*

2. Item 단위 압축
   - 인접한 item 이 같은 client + 연속 clock 이면 하나의 struct 로 합침
   - text editor 의 연속 input 이 자연스럽게 압축됨

3. Reference 단위 GC
   - 더 이상 참조되지 않는 (삭제된 + 모든 client 가 본) item 은 완전 제거
```

## Automerge 의 정책

Automerge 는 history 보존이 디자인 목표 → 적극적 GC 안 함.

```
Automerge:
  - op 모두 보존 (time travel 가능)
  - tombstone = remove op
  - history 압축 (snapshot) 으로 일부 op 합치기 가능
  - 하지만 "어느 시점이든 복원 가능" 을 깨지 않음

trade-off:
  document 가 커질수록 메모리 / 저장소 폭증
  → 작은~중간 document 또는 archive 가능한 환경 적합
```

## 실 운영의 GC 어려움

이론은 깔끔. 실 운영은 까다롭다.

### 1. Replica 합류/탈퇴

```
새 replica D 가 합류:
  - 기존 stable_vc 에 D 가 포함 안 됨
  - 합류 후엔 ⋂ 에 D 추가 → stable_vc 가 작아짐
  - 즉 일시적으로 "stable 했던 dot 이 unstable 로 회귀"

해결: replica membership 관리 필요 (멤버십 합의)
```

### 2. 영구 탈퇴 vs 일시 오프라인

```
replica 가 1주일 오프라인 → 일시 오프라인?
  - GC 멈춰서 기다림? → 메모리 폭증
  - 무시하고 GC? → 합류 시 데이터 깨짐

결정: 운영자가 "permanent removal" 명시하거나 timeout 정책
```

### 3. 분산 합의 비용

stable_vc 계산은 본질적으로 분산 합의. 모든 replica 의 vc 를 모아야 함.

```
gossip 기반: O(log N) 라운드, eventual stability
중앙 coordinator: 단일 장애점
distributed snapshot (Chandy-Lamport): 비싸지만 정확
```

## 트레이드오프 박스

| 전략 | 정확성 | 비용 | 사용처 |
|---|---|---|---|
| 영구 보존 (no GC) | 안전 | 메모리 폭증 | Automerge default |
| 시간 기반 (grace period) | 약함 | 단순 | Cassandra |
| stable_vc + gossip | 강함 | 메시지 비용 | Riak DT, Akka DD |
| Snapshot + 합의 | 강함 | 일시 멈춤 | Yjs |
| 중앙 coordinator | 강함 | SPOF | 일부 enterprise |

## msa 시사점

만약 msa 가 CRDT 도입하면 GC 가 가장 큰 운영 부담. single-region single-master 에선 회피 가능 — 결론적으로 도입을 미루는 한 이유 ([18](18-improvements.md) 참고).

## 면접 포인트

- **"CRDT 의 가장 큰 운영 문제?"** — tombstone 누적. add/remove 반복 시 ctx 가 영원히 자라 메모리 폭주. GC 가 핵심이지만 분산 합의가 필요.
- **"tombstone 을 어떻게 GC 하나?"** — causal stability. 모든 replica 가 본 dot 은 안전히 잊을 수 있음. element-wise min vc 로 stable_vc 계산.
- **"stable_vc 를 어떻게 알아?"** — gossip 기반 vc 교환, 중앙 coordinator, 또는 distributed snapshot. trade-off 는 정확성 vs 비용.
- **"Cassandra 의 gc_grace_seconds 와 같나?"** — 비슷하지만 *정확성이 약함*. Cassandra 는 시간 기반 — 그 시간 안에 모든 replica sync 가정. 깨지면 zombie data.
- **"Yjs 가 production 에서 잘 운영되는 이유?"** — snapshot 기반 압축 + 인접 item 합치기 + 적극적 reference GC. 협업 에디터의 자연스러운 패턴 (연속 입력) 을 압축으로 활용.

## 다음 학습

- [13-mrdt.md](13-mrdt.md) — Git-style 3-way merge 가 GC 어떻게 다루는가
- [16-real-systems.md](16-real-systems.md) — 실 시스템의 GC 구현
