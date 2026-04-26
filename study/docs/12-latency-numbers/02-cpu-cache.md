---
parent: 12-latency-numbers
phase: 2
order: 02
title: CPU 캐시 — 왜 L1 이 DRAM 보다 100배 빠른가
created: 2026-04-26
estimated-hours: 1
---

# 02. CPU 캐시 — 왜 L1 이 DRAM 보다 100배 빠른가

> **B 수준** (핵심 메커니즘): cache line, hit/miss 자릿수, false sharing.
> **C 수준** (MESI / NUMA / 캐시 일관성 프로토콜) 은 확장 트리거로만 언급.

## 0. 이 파일에서 얻을 것

- **L1 ~ DRAM 의 ×100 비율** 이 어디서 오는지 물리적으로 이해
- **cache line (64 bytes)** 이 왜 메모리 접근의 기본 단위인지
- **false sharing** 이 어떻게 멀티스레드 코드를 100배 느리게 하는지
- 면접 답변 카드: "L1 이 DRAM 보다 빠른 이유는?"

---

## 1. 캐시 계층 — 왜 여러 단계가 필요한가

### 물리적 사실

| 레벨 | 크기 | latency | CPU 코어와의 거리 |
|---|---|---|---|
| **레지스터** | ~수십 byte | <1 ns (0 cycle) | 코어 내부 |
| **L1 cache** | 32-64 KB | ~1 ns (4 cycle) | 코어 내부 |
| **L2 cache** | 256 KB ~ 1 MB | ~3-4 ns (12 cycle) | 코어 내부 |
| **L3 cache** | 수십 MB | ~10-20 ns (40 cycle) | 코어 외부, 패키지 내 |
| **DRAM** | 수십 GB | ~100 ns (300 cycle) | 메인보드 메모리 슬롯 |

### 왜 단계가 나뉘는가

- **속도 vs 크기 trade-off**: 빠른 메모리는 비싸고 작다 (SRAM), 느린 메모리는 싸고 크다 (DRAM)
- **거리 = 속도**: 신호가 멀리 갈수록 느림. CPU 코어 안에 있어야 ns 단위 응답 가능
- **모두를 만족할 단일 메모리는 물리적으로 불가능** → 계층화

### 비율의 핵심 직관

```
L1 → L2:    ×3      (같은 코어 내, 더 큰 SRAM)
L2 → L3:    ×3      (코어 → 패키지)
L3 → DRAM:  ×10     (패키지 → 메인보드, 신호 거리 점프)
─────────────────────────
L1 → DRAM:  ×100    (1 ns → 100 ns)
```

→ "L1 이 DRAM 보다 100배 빠르다" = "코어 안 vs 메인보드" 의 거리 차이.

---

## 2. Cache Line — 메모리 접근의 기본 단위

### 핵심 사실

- CPU 는 메모리에서 **64 bytes 단위로 한꺼번에 읽음** (Intel/AMD/ARM 공통)
- 이 64 bytes 가 cache line (캐시 라인)
- "1 byte 만 읽고 싶어도" 64 bytes 가 캐시로 올라온다

### 왜 64 bytes 인가

- DRAM 의 burst transfer 단위와 일치 (한 번 access 하면 인접 데이터를 같이 가져오는 게 효율적)
- "공간 지역성 (spatial locality)" 가정: 한 byte 를 쓰면 인접 byte 도 곧 쓸 가능성 높음
- 32 byte 면 너무 자주 캐시 miss / 128 byte 면 불필요한 데이터까지 가져옴

### 결과 — 데이터 구조 설계가 latency 를 바꾼다

```kotlin
// 캐시 친화적: 같은 cache line 에 자주 쓰는 필드 뭉치기
class HotData {
    var counter: Long = 0    //  8 byte
    var sum: Long = 0        //  8 byte
    var lastUpdated: Long = 0 // 8 byte
    // 총 24 byte → 한 cache line (64 byte) 에 들어감 → 1 access
}

// 캐시 비친화: 자주 쓰는 필드 사이에 큰 배열
class ColdData {
    var counter: Long = 0
    var bigArray: LongArray = LongArray(1000)  // 8000 byte (125 cache line)
    var sum: Long = 0    // counter 와 다른 cache line → 2 access
}
```

`counter + sum` 을 자주 같이 쓰면 HotData 가 ×2 빠르다 (1 cache miss vs 2 cache miss).

---

## 3. False Sharing — 멀티스레드의 숨은 100배 함정

### 시나리오

```kotlin
class Counter {
    @Volatile var a: Long = 0  // Thread 1 만 씀
    @Volatile var b: Long = 0  // Thread 2 만 씀
}
```

- `a` 와 `b` 가 **같은 cache line** 에 위치 (8 + 8 = 16 byte, 64 byte 안에 충분)
- Thread 1 이 `a` 를 쓰면 → 그 cache line 전체가 다른 코어의 캐시에서 invalidate 됨
- Thread 2 가 `b` 를 읽으려면 → DRAM 에서 다시 가져와야 함
- 두 스레드가 "독립적인 변수" 를 쓴다고 생각했지만, 실제로는 서로 캐시를 무효화 → **거의 매번 DRAM access (×100 느려짐)**

### 해결: 패딩 (padding)

```kotlin
// Java/Kotlin: @Contended 또는 수동 패딩
class Counter {
    @Volatile var a: Long = 0
    private val pad1: LongArray = LongArray(7)  // 56 byte 패딩
    @Volatile var b: Long = 0
    // a 와 b 가 다른 cache line 에 → false sharing 제거
}
```

JDK 의 `LongAdder` 가 이 기법을 사용 — `AtomicLong` 보다 멀티스레드 환경에서 빠른 핵심 이유.

### 실무 시그널

- 멀티스레드 카운터 / 통계 수집 / 락 / queue 의 head/tail 포인터에서 자주 발생
- 측정: `perf stat` 의 cache-miss 비율, JFR (Java Flight Recorder) 의 thread contention
- "스레드 늘렸는데 throughput 이 안 올라가거나 오히려 떨어짐" → false sharing 의심

---

## 4. msa 프로젝트와의 연결

JVM 환경에서 일반 비즈니스 코드는 cache miss 자체에 직접 신경 쓸 일이 적다. 하지만:

- **JIT 가 cache locality 를 최적화** — 그래서 hot path 의 객체 레이아웃이 중요
- **고성능 라이브러리는 명시적으로 패딩** — Disruptor, Caffeine, JDK 의 `LongAdder/StampedLock`
- **Kafka 컨슈머의 batch processing** — cache 친화적인 메모리 접근 패턴이 throughput 을 결정
- **JIT escape analysis** 가 객체를 stack 에 할당하면 → cache 친화 → 빠름

직접 false sharing 을 의심해야 하는 코드는 드물지만, **"왜 이 라이브러리가 빠른가" 를 설명** 할 때 cache line 어휘가 필수.

---

## 5. 자가 점검

- [ ] L1 vs DRAM 의 비율을 자릿수로 답할 수 있다 (×100)
- [ ] cache line 의 크기를 답할 수 있다 (64 bytes)
- [ ] false sharing 이 무엇이고 왜 문제인지 한 문장으로 설명할 수 있다
- [ ] `LongAdder` 가 `AtomicLong` 보다 빠른 이유를 cache 어휘로 설명할 수 있다

## 6. 면접 답변 카드

**Q: "L1 이 DRAM 보다 100배 빠른 이유는?"**

> 거리와 매체가 다릅니다. L1 은 CPU 코어 내부의 SRAM, DRAM 은 메인보드 슬롯에 꽂히는 별도 칩이에요. 신호가 이동해야 하는 물리적 거리 자체가 자릿수가 다르고, SRAM 이 DRAM 보다 빠르지만 비싸서 작게 둘 수밖에 없습니다. 그래서 L1/L2/L3 로 계층화해서 자주 쓰는 데이터를 가까이 둡니다.

**Q (꼬리): "그럼 왜 더 큰 L1 을 안 만드나요?"**

> SRAM 자체가 트랜지스터를 많이 쓰기 때문에 면적/전력/비용이 비쌉니다. 또 캐시가 커지면 검색 시간도 늘어요. 32-64KB 가 현재 칩 설계의 sweet spot 이에요.

**Q (꼬리): "false sharing 직접 본 적 있나요?"**

> JDK 표준 라이브러리에서 흔합니다. `AtomicLong` 을 멀티스레드 카운터로 쓰면 한 cache line 의 contention 때문에 코어 수에 비례한 성능 향상이 안 나오는데, `LongAdder` 가 cell 별로 패딩해서 이를 회피합니다. 직접 측정하려면 `perf stat -e cache-misses` 같은 도구를 씁니다.

---

## C 수준 확장 트리거 (별도 학습)

본 세션에서는 다루지 않음. 인프라/SRE/성능 엔지니어 트랙으로 갈 때 별도 학습:
- **MESI 프로토콜** (Modified/Exclusive/Shared/Invalid)
- **Cache coherence** 와 multi-socket
- **NUMA** (Non-Uniform Memory Access) — 멀티 소켓 서버에서 메모리 접근 비대칭
- **Memory barriers / volatile / happens-before** 와 캐시의 관계

## 다음 파일

- **03. DRAM vs SSD vs HDD** ([03-memory-vs-storage.md](03-memory-vs-storage.md))
