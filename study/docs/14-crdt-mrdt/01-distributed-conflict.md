---
parent: 14-crdt-mrdt
seq: 01
title: 분산 환경의 쓰기 충돌과 4가지 해결 패러다임
type: deep
created: 2026-05-01
---

# 01. 분산 환경의 쓰기 충돌

## 문제 정의

여러 replica 가 동시에 쓰기를 받는 시스템에서, 같은 키에 대한 쓰기가 동시에 발생하면 어떻게 처리할 것인가? 이는 분산 시스템의 가장 오래된 질문 중 하나이며, CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 는 이 질문에 대한 한 가지 *수학적* 답이다.

```
        Replica A                           Replica B
           │                                   │
   t=0  set(x, "a") ───────┐         ┌──── set(x, "b")  t=0
           │                │         │           │
           │                ▼         ▼           │
           │           ┌──────────────────┐       │
           │           │  네트워크 지연    │       │
           │           │  메시지 도착     │       │
           │           └──────────────────┘       │
           │                                      │
   t=1  ?  ◄────────── 값이 무엇이어야 하는가? ────► ?
```

## 해결 패러다임 4가지

분산 쓰기 충돌 해결은 역사적으로 4단계로 진화했다.

```
┌────────────────────────────────────────────────────────────┐
│  1. Single-master (Strong Consistency)                     │
│  ─────────────────────────────────────                     │
│  쓰기는 한 노드만 수락 → 충돌 자체가 없음                   │
│  (현 msa MySQL primary, Spanner 의 Paxos leader)           │
│                                                            │
│  ✓ 단순, 정합성 강력                                         │
│  ✗ 가용성 (CAP 의 C 선택), 지역간 지연                       │
└────────────────────────────────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  2. LWW (Last-Write-Wins)                                  │
│  ─────────────────────────────                             │
│  타임스탬프 가장 큰 값 채택                                 │
│  (Cassandra default, Dynamo 초기)                          │
│                                                            │
│  ✓ 구현 단순, 메타데이터 minimal                             │
│  ✗ clock skew → "사라진 쓰기" (lost update)                  │
└────────────────────────────────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  3. Sibling 노출 (Application Merge)                       │
│  ────────────────────────────────                          │
│  충돌 시 양쪽 값 모두 보관 → 앱이 read 시 merge 결정          │
│  (Riak 초기, Dynamo)                                       │
│                                                            │
│  ✓ 의미 손실 없음                                            │
│  ✗ 앱 코드가 매번 merge 로직 작성 — 구현 부담                 │
└────────────────────────────────────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────────┐
│  4. CRDT (Automatic Merge)                                 │
│  ────────────────────────                                  │
│  자료구조 자체가 merge 함수 내장 → 자동 수렴                  │
│  (Redis CRDB, Riak DT, Yjs, Automerge)                     │
│                                                            │
│  ✓ 앱 단순, 수학적 수렴 보장                                  │
│  ✗ 메타데이터 오버헤드, tombstone, GC 복잡도                  │
└────────────────────────────────────────────────────────────┘
```

## 1. Single-master 의 본질

가장 단순한 해결: **쓰기는 한 곳에서만**. 현 msa 는 이 모델이다.

```kotlin
// MySQL primary 1대 + replica N 대 (read-only)
// gateway → MySQL primary → binlog → replicas
// 읽기는 어디서든, 쓰기는 primary 만
```

- CAP 의 *C* (Consistency) 와 *P* (Partition tolerance) 우선
- *A* (Availability) 손실 — primary 장애 시 failover 까지 쓰기 불가
- 지역 간 지연 (e.g. Seoul → Tokyo replica 약 30ms RTT) 이 곧 쓰기 지연

> **현 msa 위치** — 단일 region 운영이라 single-master 가 맞다. CRDT 는 multi-region active-active 가 트리거. 자세한 결론은 [17-msa-application.md](17-msa-application.md) 참고.

## 2. Last-Write-Wins (LWW)

가장 단순한 분산 충돌 해결.

### 알고리즘

```
write(key, value, timestamp):
    current = read(key)
    if current is None or timestamp > current.timestamp:
        store(key, value, timestamp)
    else:
        discard
```

### Cassandra 의 LWW

```cql
-- Cassandra 는 모든 column 이 timestamp 갖고, 더 큰 timestamp 가 이김
INSERT INTO users(id, name) VALUES (1, 'Alice') USING TIMESTAMP 1700000000;
INSERT INTO users(id, name) VALUES (1, 'Bob') USING TIMESTAMP 1700000001;
-- 결과: name = 'Bob'
```

### LWW 의 치명적 결함: Lost Update

```
시계: A=2025-01-01 12:00, B=2025-01-01 11:59 (B 의 시계가 1분 느림)

t=0   A: set(x, "결제 완료")  timestamp=12:00:00
t=1   B: set(x, "결제 진행 중") timestamp=11:59:30  ← B 의 시계 기준
t=2   A 와 B 가 sync → A 의 12:00 > B 의 11:59 → A 가 이김 (정상)

또는:
t=0   B: set(x, "결제 완료")  timestamp=11:59:00 (B 시각, 실제 12:00)
t=1   A: set(x, "결제 진행 중") timestamp=12:00:30 (A 시각, B 보다 1분 30초 뒤)
t=2   A 가 이김 — 진행 중 이 결제 완료 를 덮어씀 ✗
```

**clock skew** 가 1초만 있어도 "나중 쓰기가 먼저 쓰기에 의해 덮어쓰임" 이 발생할 수 있다.

### 보완: Hybrid Logical Clock

clock skew 문제를 완화하기 위해 **physical time + logical counter** 를 결합한 HLC 를 쓴다 (CockroachDB).

```
HLC(physical, logical)
- physical: 실제 wall clock 의 millisecond
- logical: 같은 physical 에서 발생한 이벤트 순서
- merge: max(physical), 같으면 logical 비교
```

그래도 LWW 의 본질적 한계 — **두 동시 쓰기 중 하나는 잃는다** — 는 사라지지 않는다.

## 3. Sibling 노출 (Multi-Value)

Dynamo (DDB 전신) / Riak 의 초기 패턴: **충돌 시 양쪽 값을 모두 보관**.

### 동작

```
Replica A: set(x, "장바구니: 사과")    vector_clock = [A:1]
Replica B: set(x, "장바구니: 오렌지")  vector_clock = [B:1]

sync 후 → x = ["장바구니: 사과", "장바구니: 오렌지"]
                vector_clock = [A:1, B:1]

read(x) → 클라이언트가 sibling 둘 다 받음 → merge 후 write
```

### Dynamo 의 shopping cart 예시

논문 "Dynamo: Amazon's Highly Available Key-value Store" 에서 가장 유명한 예. 두 사용자가 같은 카트에 동시에 추가하면, sibling 으로 두 add 가 모두 보존되고, 클라이언트가 merge 한다.

```
A: cart = ["item-1"]                  → cart-v1
B: cart = ["item-2"]                  → cart-v1
A 가 sync 중 [item-1, item-2] 로 합침 → cart-v2
```

### 한계

- 앱이 매번 merge 로직 직접 구현 — Set 합집합은 쉽지만 Counter 는?
- 잘못 merge 하면 데이터 손실 — 예: 두 장바구니에서 "delete item-1" 의 의도가 합집합으로는 표현 불가
- read 시 sibling 처리 코드가 도처에 흩어짐

이 한계가 곧 CRDT 의 동기다 — *"merge 로직을 자료구조에 박아넣자"*.

## 4. CRDT — 자동 병합

CRDT 는 Sibling 노출의 진화: **merge 함수가 자료구조 정의의 일부**.

```
Replica A 의 OR-Set: {("apple", tagA1), ("orange", tagA2)}
Replica B 의 OR-Set: {("apple", tagB1)}

merge(A, B) = {("apple", tagA1), ("orange", tagA2), ("apple", tagB1)}
            = {"apple", "orange"}    (관찰자 수준에서)
```

merge 가 **associative · commutative · idempotent** 라는 것이 보장되면, 어느 순서로 어떻게 합쳐도 같은 결과로 수렴한다. 이것이 [Strong Eventual Consistency](02-sec-semilattice.md) 의 핵심이다.

## 트레이드오프 박스

| 패러다임 | 일관성 | 가용성 | 구현 복잡도 | 메타데이터 |
|---|---|---|---|---|
| Single-master | Strong | Low | 낮음 | 없음 |
| LWW | Eventual (lossy) | High | 낮음 | timestamp |
| Sibling | Eventual (no loss) | High | High (앱) | vector clock |
| CRDT | Strong Eventual | High | Medium | 자료구조별 (큼) |

**언제 무엇을 쓰나?**

- **단일 region · 강한 정합성 필요**: Single-master (현 msa)
- **로그/세션처럼 잃어도 무방**: LWW (Cassandra)
- **앱이 의미 있는 merge 가능 + 신중한 운영**: Sibling (legacy Dynamo)
- **multi-region active-active + 자동화 필요**: CRDT (Redis CRDB)
- **오프라인 우선 / 협업**: CRDT (Yjs, Automerge)

## 면접 포인트

- **"CRDT 가 왜 필요한가?"** — multi-master 환경에서 merge 를 앱이 수동으로 하면 비싸기 때문. CRDT 는 merge 함수를 자료구조에 박아 자동화한다.
- **"LWW 의 한계는?"** — clock skew 로 lost update 발생. NTP 가 100ms 어긋나면 100ms 차이로 들어온 두 쓰기 중 먼저 들어온 게 이길 수 있다.
- **"Dynamo sibling vs CRDT 차이는?"** — sibling 은 *어떻게 합칠지* 를 앱이 결정, CRDT 는 자료구조가 결정. CRDT 도입 후 Riak 은 sibling 노출을 줄였다.
- **"현 msa 가 CRDT 를 쓰지 않는 이유는?"** — single-region single-master 라 충돌 자체가 없다. multi-region active-active 로 가는 순간 검토 트리거.

## 다음 학습

- [02-sec-semilattice.md](02-sec-semilattice.md) — SEC 와 semilattice 가 왜 수렴을 보장하는가
- [03-cvrdt-vs-cmrdt.md](03-cvrdt-vs-cmrdt.md) — state-based vs op-based 비교
