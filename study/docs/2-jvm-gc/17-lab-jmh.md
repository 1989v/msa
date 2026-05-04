---
parent: 2-jvm-gc
seq: 17
title: Lab 4 — JMH (Java Microbenchmark Harness)
type: lab
created: 2026-05-01
---

# Lab 4. JMH

## 목표

JMH 로 micro 벤치마크 작성 → **Escape Analysis / Inlining / Tiered Compilation** 효과를 직접 측정. 면접에서 "JIT (Just-In-Time compilation, 즉시 컴파일) 가 정말 객체 할당을 제거하나요?" 같은 질문에 측정 데이터로 답할 수 있게 만든다.

## 소요 시간

3-4h

---

## 왜 JMH 가 필요한가

### Naïve 측정의 함정

```kotlin
// ❌ 잘못된 측정
fun main() {
    val start = System.nanoTime()
    repeat(1_000_000) {
        someOperation()
    }
    println("${(System.nanoTime() - start) / 1_000_000} ms")
}
```

문제:
- **JIT warmup**: 처음엔 인터프리터 → 천천히. C2 컴파일 후에야 진짜 빠름. 평균을 내면 의미 없음.
- **Dead Code Elimination**: `someOperation()` 결과를 안 쓰면 C2 가 통째로 제거 → 0 ms 측정.
- **Constant Folding**: 입력이 컴파일 타임 상수면 결과를 미리 계산.
- **OSR (On-Stack Replacement)**: 루프 안에서 컴파일 → benchmark 함수와 다른 컨텍스트.

JMH 는 이 모든 함정을 자동으로 회피.

---

## 1. JMH 셋업

### Gradle 추가 (별도 모듈 권장)

`benchmark/build.gradle.kts`:

```kotlin
plugins {
    kotlin("jvm")
    id("me.champeau.jmh") version "0.7.2"
}

dependencies {
    implementation(project(":product:domain"))
    jmh("org.openjdk.jmh:jmh-core:1.37")
    jmh("org.openjdk.jmh:jmh-generator-annprocess:1.37")
}

jmh {
    fork = 2
    warmupIterations = 5
    iterations = 5
    timeOnIteration = "10s"
}
```

또는 standalone JMH archetype:
```bash
mvn archetype:generate -DinteractiveMode=false \
  -DarchetypeGroupId=org.openjdk.jmh \
  -DarchetypeArtifactId=jmh-java-benchmark-archetype \
  -DgroupId=com.kgd -DartifactId=bench -Dversion=1.0
```

---

## 2. 첫 번째 벤치마크 — Escape Analysis

### 실험 1: 객체 할당이 정말 제거되는가

```kotlin
import org.openjdk.jmh.annotations.*
import org.openjdk.jmh.infra.Blackhole
import java.util.concurrent.TimeUnit

@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(2)
@State(Scope.Benchmark)
open class EscapeAnalysisBench {

    data class Point(val x: Int, val y: Int)

    @Benchmark
    fun withObject(bh: Blackhole) {
        val p = Point(3, 4)
        bh.consume(p.x * p.x + p.y * p.y)
    }

    @Benchmark
    fun withoutObject(bh: Blackhole) {
        val x = 3
        val y = 4
        bh.consume(x * x + y * y)
    }
}
```

### 실행

```bash
./gradlew :benchmark:jmh
```

### 예상 결과

```
Benchmark                              Mode  Cnt    Score   Error  Units
EscapeAnalysisBench.withObject        thrpt   10  450.123 ± 5.234  ops/us
EscapeAnalysisBench.withoutObject     thrpt   10  455.876 ± 4.987  ops/us
```

→ 거의 차이 없음. **C2 의 Escape Analysis 가 Point 객체 할당을 제거**한 결과.

### -prof gc 옵션으로 검증

```bash
./gradlew :benchmark:jmh -PjmhProfilers="gc"
```

```
EscapeAnalysisBench.withObject:gc.alloc.rate.norm    0.0   B/op   ← 객체 할당 0
EscapeAnalysisBench.withoutObject:gc.alloc.rate.norm 0.0   B/op
```

`B/op = 0` → 실제로 객체가 0개 만들어짐. Escape Analysis 가 동작했다는 정량적 증거.

### Escape 시키면?

```kotlin
private val refs = ArrayList<Point>()

@Benchmark
fun escapingObject(bh: Blackhole) {
    val p = Point(3, 4)
    refs.add(p)         // 메서드 밖 컬렉션에 저장 → escape!
    bh.consume(p.x)
    if (refs.size > 100) refs.clear()
}
```

이 경우엔 `gc.alloc.rate.norm` ≈ 32 B/op (Point 객체 + ArrayList resize) → 할당 발생.

---

## 3. 실험 2 — Inlining

### 작은 메서드 vs 큰 메서드

```kotlin
@State(Scope.Benchmark)
open class InliningBench {

    private fun smallAdd(a: Int, b: Int): Int = a + b   // 매우 작음

    private fun bigAdd(a: Int, b: Int): Int {
        var result = 0
        for (i in 0 until 100) result += (a + b) % (i + 1)
        return result
    }

    @Benchmark
    fun callSmall(bh: Blackhole) {
        bh.consume(smallAdd(2, 3))
    }

    @Benchmark
    fun callBig(bh: Blackhole) {
        bh.consume(bigAdd(2, 3))
    }
}
```

### 옵션으로 inlining 차단

```bash
# 모든 inline 끄고 측정
./gradlew :benchmark:jmh -PjmhArgs="-jvmArgs=-XX:-Inline"
```

inline 끈 결과 vs 켠 결과 비교 → 작은 메서드는 inline 효과가 매우 큼 (호출 비용 제거).

---

## 4. 실험 3 — Tiered Compilation

### Warmup curve 측정

```kotlin
@State(Scope.Benchmark)
open class TieredBench {

    @Benchmark
    fun work(): Int {
        var sum = 0
        for (i in 0 until 1000) sum += (i * i) % 7
        return sum
    }
}
```

### -XX:-TieredCompilation 비교

```bash
# Tiered ON (기본)
./gradlew :benchmark:jmh -P:include=TieredBench

# Tiered OFF
./gradlew :benchmark:jmh -P:include=TieredBench -PjmhArgs="-jvmArgs=-XX:-TieredCompilation"
```

Tiered ON: warmup 빠름 (C1 으로 빠르게 → C2 로 진화)
Tiered OFF: warmup 느림, 최종 throughput 비슷

### -prof perfasm (Linux)

```bash
./gradlew :benchmark:jmh -PjmhProfilers="perfasm"
```

생성된 native 어셈블리에서 vector 명령(VPADD, VFMADD 등) / inline / loop unrolling 확인.
macOS 는 perfasm 미지원 — Linux 컨테이너에서 실행 권장.

---

## 5. 실험 4 — Lock vs Lock-free

```kotlin
import java.util.concurrent.atomic.AtomicLong

@State(Scope.Benchmark)
open class ConcurrencyBench {

    private val counter = AtomicLong()
    private var plainCounter = 0L
    private val lock = Any()

    @Benchmark
    @Threads(8)
    fun atomicIncrement(): Long = counter.incrementAndGet()

    @Benchmark
    @Threads(8)
    fun synchronizedIncrement(): Long {
        synchronized(lock) {
            plainCounter += 1
            return plainCounter
        }
    }
}
```

8 스레드 + atomic vs synchronized → atomic 이 보통 5-10배 throughput.

---

## 6. JMH 핵심 어노테이션

| 어노테이션 | 의미 |
|---|---|
| `@Benchmark` | 측정 대상 메서드 |
| `@BenchmarkMode(Mode.Throughput / AverageTime / SampleTime / SingleShotTime)` | 측정 방식 |
| `@OutputTimeUnit` | 결과 단위 |
| `@Warmup(iterations, time)` | warmup 라운드 |
| `@Measurement(iterations, time)` | 측정 라운드 |
| `@Fork(N)` | 별도 JVM 프로세스 N개 — JIT 상태 격리 |
| `@State(Scope.Benchmark/Thread/Group)` | 상태 공유 범위 |
| `@Setup / @TearDown` | 초기화 / 정리 |
| `@Param` | 파라미터화 |
| `@Threads(N)` | 동시 스레드 수 |
| `@Group / @GroupThreads` | 비대칭 워크로드 (read-heavy 등) |

### Blackhole

```kotlin
@Benchmark
fun work(bh: Blackhole) {
    val result = compute()
    bh.consume(result)   // DCE 방지 — 컴파일러가 결과를 안 쓴다고 제거 못 함
}
```

`Blackhole.consume(x)` 는 **JIT 가 못 제거**하도록 설계된 sink. 모든 결과는 여기로.

---

## 7. 실수 패턴

### 함정 1 — Constant Folding

```kotlin
@Benchmark
fun bad() = 2 + 3      // 컴파일 타임에 5 로 결정. 측정 의미 없음
```

해법: `@State` 필드 변수 + `@Param` 사용해 입력을 런타임 결정.

### 함정 2 — DCE (Dead Code Elimination)

```kotlin
@Benchmark
fun bad() {
    compute()         // 결과 안 씀 → 메서드 자체가 제거될 수도
}
```

해법: 결과를 반환하거나 Blackhole 로 consume.

### 함정 3 — 짧은 측정

```kotlin
@Measurement(iterations = 1, time = 1)   // 1초 1회 — 노이즈 큼
```

해법: 5+ iteration × 10s+. fork 2+ 로 격리.

### 함정 4 — JVM 옵션 미지정

```kotlin
// 기본 JVM 옵션으로 측정 → G1 인지 ZGC 인지 모름
```

해법: `@Fork(jvmArgsAppend=["-XX:+UseG1GC"])` 명시.

---

## 8. 면접 답변

### 질문: Escape Analysis 가 정말 동작하나요?

> "JMH 로 직접 측정해봤습니다. Point 클래스를 메서드 안에서만 쓰는 케이스는 `gc.alloc.rate.norm` 이 0 B/op 였고, 같은 객체를 컬렉션에 escape 시키면 32 B/op 였습니다. C2 의 Escape Analysis + Scalar Replacement 가 메서드 escape 안 하는 객체를 정수 변수로 분해해 힙 할당 자체를 제거합니다."

### 질문: micro 벤치마크 함정 알고 있나요?

> "JMH 같은 도구 없이 단순 측정하면 4가지 함정에 빠집니다. JIT warmup 미반영, Dead Code Elimination, Constant Folding, OSR. JMH 는 이를 모두 회피해줍니다 — fork 로 JVM 격리, Blackhole 로 DCE 방지, @State 변수로 constant folding 차단, warmup iteration 분리."

---

## 9. msa 적용 가치

### 어디에 쓰나

- Kotlin DSL/inline 함수의 효과 검증
- Hot path 함수의 변경 회귀 측정 (CI 통합)
- Cache 구현 비교 (Caffeine vs ConcurrentHashMap)
- Serialization 비교 (Jackson vs Kotlinx vs Avro)

### 권장: 별도 `benchmark` 모듈

```
msa/
├── product/
│   ├── domain/
│   ├── app/
│   └── benchmark/         ← JMH 모듈 (build 에서만 활성)
├── common/
└── ...
```

CI 에서 PR 마다 회귀 검출:
```yaml
- run: ./gradlew :product:benchmark:jmh
- run: jmh-compare baseline.json result.json --threshold 5%
```

5% 이상 throughput 떨어지면 fail.

---

## 10. 함정 / 흔한 실수 모음

| 함정 | 대응 |
|---|---|
| 측정 후 결과 안 씀 | Blackhole.consume 또는 return |
| @Fork 1 로 측정 | 최소 2, 보통 3+ |
| warmup 부족 | 5+ iteration 보통 안전 |
| GC 영향 무시 | -prof gc 로 alloc/op 측정 |
| 결과 절대값에 매몰 | 비교 (A/B 차이) 가 핵심 |
| 환경 차이 무시 | CI 일관 환경에서 비교, 로컬 측정은 정성 분석만 |

---

## 다음 학습

- [10-jit-compilation.md](10-jit-compilation.md) — JIT 이론과 실측 매칭
- [16-lab-jfr-jmc.md](16-lab-jfr-jmc.md) — 운영 환경의 JFR 프로파일링
- [21-improvements.md](21-improvements.md) — JMH 회귀 측정 ADR 후보
