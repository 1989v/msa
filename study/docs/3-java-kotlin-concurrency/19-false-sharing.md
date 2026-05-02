---
parent: 3-java-kotlin-concurrency
seq: 19
title: False Sharing + Cache Line + @Contended
type: deep
created: 2026-05-01
---

# 19. False Sharing + Cache Line

## 핵심 한 줄

**False sharing** = 서로 다른 변수가 *같은 64-byte cache line* 에 위치해서, 한 변수의 갱신이 다른 변수의 read/write 까지 cache invalidation 시키는 성능 문제. 진단 어렵고 영향 큰 hot-path 만의 이슈. JDK 의 `@Contended` 또는 padding 으로 해결.

## 배경 — Cache Coherence

CPU 캐시는 **cache line 단위** (보통 64 byte) 로 메모리를 fetch/invalidate.

```
주 메모리:
  [variable A][variable B][variable C][variable D]  ← 64B 안에 모두
                                                     같은 cache line

Core 1 의 L1 cache:                Core 2 의 L1 cache:
  [A][B][C][D]                       [A][B][C][D]
```

Core 1 이 A 를 write → MESI 프로토콜 (Modified/Exclusive/Shared/Invalid):
- Core 1 의 line: Modified
- Core 2 의 line: Invalid (A 만 갱신했지만 B/C/D 도 같은 line 이라 통째로)

→ Core 2 가 B, C, D 를 read 하려면 **다시 fetch** (캐시 miss + bus 트래픽).

## False Sharing — 위험 시나리오

```kotlin
class Counter {
    var c1 = 0L     // 8 byte
    var c2 = 0L     // 8 byte, 같은 64B cache line!
}

val counter = Counter()

// Thread 1 — c1 만 갱신
while (true) counter.c1++

// Thread 2 — c2 만 갱신
while (true) counter.c2++
```

논리적으로 두 스레드는 *완전히 다른 데이터* 를 만지지만, *물리적으로 같은 cache line* 이라 매번 invalidation. 단일 변수 갱신처럼 빨라야 할 작업이 lock contention 처럼 느려진다.

벤치마크 (가상 예):
- True sharing 없음 (다른 line) → 100M ops/sec
- False sharing → 5M ops/sec (20배 느려짐!)

## 해결 1 — Padding

```java
public class PaddedCounter {
    public volatile long c1;
    public long p1, p2, p3, p4, p5, p6, p7;  // 56 byte padding
    public volatile long c2;
}
```

64-byte cache line 안에 c1 만 있게 강제. JDK 7 까진 이 패턴이 흔했음.

단점:
- 메모리 낭비 (48-56 byte 패딩 per 변수)
- JVM 이 padding 변수를 *최적화로 제거* 할 수 있음 (사용 안 한다고 판단)
- 보기 흉함

## 해결 2 — `@Contended` (JDK 8+)

```java
import jdk.internal.vm.annotation.Contended;

class PaddedCounter {
    @Contended
    volatile long c1;

    @Contended
    volatile long c2;
}
```

JVM 이 자동으로 cache line 경계를 고려해서 padding. JDK 가 padding 안 지움.

⚠️ **주의**:
- JDK 9+ 에선 `@Contended` 가 internal API 로 분류 → `-XX:-RestrictContended` JVM 옵션 또는 `--add-exports` 필요
- 진짜 필요한 hot path 만 사용 — 메모리 비용

```bash
# JDK 9+ 에서 @Contended 사용
java --add-exports=java.base/jdk.internal.vm.annotation=ALL-UNNAMED ...
```

## JDK 가 자체적으로 쓰는 곳

- `LongAdder` 의 `Cell[]` — 각 Cell 이 `@Contended` 로 분리 → contention 분산의 핵심
- `Striped64` 등 striped counter 자료구조
- `ConcurrentHashMap.CounterCell` (size 카운팅)

→ 사용자가 직접 padding 하는 일이 사실상 없어짐. JDK 가 striped 패턴으로 캡슐화.

## 어떻게 진단하나

매우 어렵다. 직관적 신호가 없음 — 코드만 봐선 정상.

### perf 의 cache miss 측정

```bash
perf stat -e cache-misses,cache-references -p <pid> sleep 30
```

- cache miss rate 가 비정상적으로 높으면 의심
- 다만 false sharing 외에도 다양한 원인

### Linux `perf c2c` (cache-to-cache)

```bash
perf c2c record -p <pid>
perf c2c report
```

- inter-socket cache 트래픽 분석
- false sharing 직접 진단 가능

### JFR + Async-Profiler

- JFR 의 hardware event sampling
- async-profiler 의 `cache-misses` 이벤트

→ 실무에선 거의 *증상 (CPU 비효율 / 메모리 대역폭 폭증) 으로 시작* 후 코드 패턴 매칭으로 가설.

## 실무에서 만나는 시나리오

| 시나리오 | False sharing 위험 |
|---|---|
| 일반적 비즈니스 코드 | 거의 없음 |
| 단순 카운터 (HTTP req/sec) | 없음 (LongAdder 가 알아서 처리) |
| 자체 lock-free queue / ring buffer 구현 | **있음** — head/tail 분리 필수 |
| 자체 striped counter 구현 | 있음 — `@Contended` 활용 |
| Disruptor / LMAX 패턴 | 있음 — 라이브러리가 이미 처리 |
| 일반 Spring Boot 서비스 | **거의 무관** |

→ msa 같은 일반 서비스에선 false sharing 을 직접 만질 일이 거의 없다. *표준 자료구조* 가 알아서 처리.

## CPU 마이크로아키 시각화

```
Modern CPU 의 캐시 계층:

  Core 1                     Core 2
  ┌──────────┐              ┌──────────┐
  │ L1 cache │              │ L1 cache │   (32 KB 정도)
  │ 64B line │              │ 64B line │
  └─────┬────┘              └─────┬────┘
        │                          │
  ┌─────▼────┐              ┌─────▼────┐
  │ L2 cache │              │ L2 cache │   (수백 KB)
  └─────┬────┘              └─────┬────┘
        │                          │
        └──────────┬───────────────┘
                   ▼
            ┌─────────────┐
            │  L3 shared  │              (수십 MB)
            └─────┬───────┘
                  ▼
              주 메모리
```

- L1 access ≈ 1 ns
- L3 access ≈ 10 ns
- DRAM access ≈ 100 ns

False sharing 은 한 코어의 갱신이 다른 코어의 L1 invalidate → 다음 read 가 L1 miss → L2 또는 L3 fetch → 10-100배 느림.

## Disruptor 와 mechanical sympathy

LMAX 의 Disruptor (high-frequency trading 시스템) 가 false sharing 회피의 정석 사례:

- ring buffer 의 sequence 변수마다 padding
- producer/consumer cursor 분리 → false sharing 없음
- "mechanical sympathy" — CPU 캐시 친화적 설계

→ msa 처럼 일반 비즈니스 서비스는 이 수준의 최적화 불필요. 다만 Kafka 같은 라이브러리의 *내부* 가 이런 패턴을 쓴다는 걸 아는 게 면접에 도움.

## msa 코드와 false sharing

거의 무관. 일반 ConcurrentHashMap, LongAdder, Atomic 사용처는 JDK 가 알아서 padding. 만약:

```kotlin
class Stats {
    val requestCount = AtomicLong(0)
    val errorCount = AtomicLong(0)
    val latencySum = AtomicLong(0)
    // 셋 다 같은 객체 안 → 같은 cache line 가능
}
```

이게 *초당 수백만 건* 갱신되는 hot path 면 false sharing 영향 가능. 해결:
- `LongAdder` 로 교체 (striped, 자동 분산)
- 또는 `@Contended` (JDK API 노출 필요)

## 면접 단골

**Q. False sharing 이 뭔가?**

서로 다른 두 변수가 *같은 64-byte CPU cache line* 에 위치해서, 한 스레드의 한 변수 갱신이 다른 스레드의 다른 변수 read/write 까지 cache invalidation 시키는 성능 문제. 논리적으로는 무관한 데이터지만 물리적으로 같은 line 이라 발생. lock contention 같은 효과를 내지만 코드만 봐선 안 보인다.

**Q. 어떻게 해결하나?**

(1) padding — 변수 사이에 dummy field 넣어 같은 cache line 회피, (2) `@Contended` annotation (JDK 8+) — JVM 이 자동 padding, (3) `LongAdder` 같은 striped 자료구조로 cache locality 자동 처리. 일반 서비스 코드에선 거의 직접 다룰 일 없음 — 표준 라이브러리가 알아서 처리.

**Q. cache line 이 64 byte 인 이유?**

x86-64 의 일반적 cache line 크기. ARM 도 같음. CPU 가 메모리를 *line 단위로 fetch/invalidate* 라 한 byte read 도 64 byte 통째로 읽어옴. 이는 메모리 access locality 가정 하의 trade-off — 인접 데이터를 미리 가져오면 다음 access 가 빠름.

**Q. `LongAdder` 가 false sharing 을 자동으로 어떻게 해결?**

내부적으로 `Cell[]` 배열을 두고 각 Cell 에 `@Contended` 적용. 스레드별 hash 로 자기 Cell 에 inc → cache line 분리 + striped. AtomicLong 의 단일 변수 CAS contention 도 같이 해소. JDK 가 캡슐화한 mechanical sympathy 패턴.

**Q. False sharing 을 production 에서 어떻게 진단?**

매우 어려움. 일반적 절차: (1) CPU 사용률은 높은데 throughput 이 안 올라가는 비정상 신호, (2) `perf stat` 로 cache-misses 비율 확인, (3) `perf c2c` 로 inter-core cache 트래픽 분석, (4) 코드에서 hot 변수가 같은 객체에 모여 있으면 가설 수립. 일반 비즈니스 코드에선 거의 안 만난다 — Kafka/Disruptor 같은 라이브러리 *내부* 이슈.

## 다음 학습

- [04-atomic-cas.md](04-atomic-cas.md) — `LongAdder` 와 striped
- [21-profiling-tools.md](21-profiling-tools.md) — async-profiler 의 cache event
