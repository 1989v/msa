---
parent: 2-jvm-gc
seq: 10
title: JIT 컴파일 — C1 / C2 / Tiered / Inlining / Escape Analysis
type: deep
created: 2026-05-01
---

# 10. JIT 컴파일

## TL;DR

JVM 은 부팅 시 모든 코드를 native 로 컴파일하지 않는다. 처음엔 **인터프리터**로 바이트코드를 한 줄씩 실행, 자주 호출되는 hot method 만 **JIT 컴파일러(C1, C2)** 가 native 로 변환. **Tiered Compilation** 은 C1 빠른 컴파일 → C2 깊은 최적화 단계적 적용. C2 의 무기는 **inlining** (메서드 호출 제거) 과 **escape analysis** (객체 할당 제거). 이 둘이 Kotlin/Java 의 추상화 비용을 사실상 0 으로 만든다. **JFR + JMC** 로 hot method 를 보고, **JMH** 로 효과를 측정.

```
   소스 코드
     ↓
   javac/kotlinc
     ↓
   바이트코드 (.class)
     ↓
   ┌──────────────────────────────────┐
   │ JVM 실행                          │
   │  ┌───────────────────────────┐  │
   │  │ Interpreter (모든 코드)    │  │
   │  └────────────┬──────────────┘  │
   │       호출 횟수 임계 도달        │
   │               ▼                  │
   │  ┌───────────────────────────┐  │
   │  │ C1 (빠른 컴파일, 가벼운 최적) │  │
   │  └────────────┬──────────────┘  │
   │       프로파일링 누적              │
   │               ▼                  │
   │  ┌───────────────────────────┐  │
   │  │ C2 (느린 컴파일, 깊은 최적) │  │
   │  │ - Inlining                  │  │
   │  │ - Escape Analysis           │  │
   │  │ - Loop Unrolling            │  │
   │  │ - Vectorization             │  │
   │  └───────────────────────────┘  │
   └──────────────────────────────────┘
```

---

## 1. 컴파일러 계층

### C1 (Client Compiler)

- 빠른 컴파일, 가벼운 최적화
- 옛날엔 `-client` 옵션의 그것
- 부팅 시간 / 짧은 프로그램에 적합

### C2 (Server Compiler)

- 깊은 최적화 (inlining, escape analysis, vectorization)
- 컴파일 자체는 느림 (수십~수백 ms)
- 장시간 실행 서비스에 적합

### Graal JIT (실험적)

- Java 로 작성된 JIT (HotSpot 의 C2 는 C++)
- JDK 17 까지 실험적, JDK 21+ 부터는 분리 (GraalVM 으로)
- 일부 워크로드에서 C2 보다 우수, 일부는 떨어짐

### Tiered Compilation (JDK 7+ 기본)

```
Tier 0: Interpreter
Tier 1: C1 + 프로파일링 없음
Tier 2: C1 + 가벼운 프로파일링
Tier 3: C1 + 풀 프로파일링
Tier 4: C2 (프로파일 데이터 사용)
```

대부분의 코드: 0 → 3 → 4 경로. 핫 코드는 결국 C2.

`-XX:-TieredCompilation` 으로 끄면 C2 만 사용 (옛 방식). 일반적으로 켜둔 상태가 throughput + warmup 균형.

---

## 2. 컴파일 트리거

### 호출 횟수 기반

```
-XX:CompileThreshold=10000   # C2 트리거 임계 (기본)
-XX:Tier3InvocationThreshold=200  # C1 트리거 임계
```

JIT 는 카운터로 메서드 호출 횟수 + 루프 백 에지 횟수 추적. 임계 넘으면 큐에 등록 → 컴파일러 스레드가 처리.

### OSR (On-Stack Replacement)

긴 루프 안에서 실행 중에도 메서드 컴파일 가능 → 새 native 코드로 **실행 중 점프**.

```kotlin
fun process(items: List<Item>) {
    for (item in items) {       // 100만 번 반복
        // ... 처음엔 인터프리터, 도중에 C2 컴파일 완료 시 OSR
    }
}
```

### Compile Time 진단

```bash
-XX:+PrintCompilation          # 컴파일 이벤트 stdout
-Xlog:jit+compilation=info     # JDK 9+ 통합 로그
```

```
   123  10  3       com.kgd.product.ProductService::find (45 bytes)
   125  15  4       com.kgd.product.ProductService::find (45 bytes)   ← C2 컴파일
   125  10  3       com.kgd.product.ProductService::find (45 bytes)   ← C1 코드 비활성
            ↑↑
            tier (3=C1, 4=C2)
```

---

## 3. Inlining (인라이닝)

### 동작

작은 메서드 호출을 호출지에 펼쳐 넣음 — 호출 비용(스택 프레임 push/pop, parameter pass) 제거 + 추가 최적화 기회.

```kotlin
// 소스
fun add(a: Int, b: Int): Int = a + b
fun caller() = add(2, 3) + add(5, 7)

// C2 인라이닝 후 (개념적)
fun caller() = (2 + 3) + (5 + 7)
// 추가 상수 폴딩 → caller() = 17
```

### 한계

- **메서드 크기**: 기본 35 byte 바이트코드 (`-XX:MaxInlineSize=35`)
- **호출 빈도**: hot 한 호출만
- **인라이닝 깊이**: 9단계 (`-XX:MaxInlineLevel=9`)
- **virtual call**: 단일 구현체만 있을 때 inline 가능 (CHA, monomorphic)

### Megamorphic call 문제

```kotlin
interface Animal { fun sound(): String }
class Dog : Animal { ... }
class Cat : Animal { ... }
class Cow : Animal { ... }

fun process(animals: List<Animal>) {
    animals.forEach { println(it.sound()) }   // megamorphic — 3개 이상의 구현
}
```

CHA (Class Hierarchy Analysis) 가 단일 구현체일 때만 inline. 여러 구현체 = polymorphic call → vtable lookup. 핫 코드에서 megamorphic 은 throughput 손해.

### Inlining 진단

```bash
-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining
```

```
@ 12   com.kgd.product.ProductService::findById (10 bytes)   inline (hot)
@ 25   com.kgd.product.ProductRepository::findById (5 bytes)  too big to inline
                                                                ↑
                                                           이유 표시
```

JITWatch 도구로 시각화 가능.

---

## 4. Escape Analysis (이스케이프 분석)

### 정의

> 객체가 메서드를 escape 하지 않으면 (= 메서드 밖으로 안 나감, 다른 스레드에 안 보임) 힙 할당을 생략하고 **스택 / 레지스터** 에 풀 수 있다.

### 효과: Scalar Replacement

```kotlin
data class Point(val x: Int, val y: Int)

fun distance(): Int {
    val p = Point(3, 4)            // 객체 안 만들어도 됨
    return p.x * p.x + p.y * p.y
}
```

C2 가 인라이닝 후 escape 분석:
- `p` 가 메서드 밖으로 안 나감 → escape 안 함
- 객체 대신 두 정수 변수(x=3, y=4) 로 분해 (scalar replacement)
- 결과: **객체 할당 0**, 정수 연산만

### Lock Elision

```kotlin
fun process() {
    val sb = StringBuilder()        // 지역
    sb.append("a")                   // synchronized 였다면
    sb.append("b")
    return sb.toString()
}
```

`sb` 가 escape 안 함 → 다른 스레드가 못 봄 → synchronized 블록 잠금 자체가 무의미 → **Lock Elision** 으로 잠금 제거.

### Escape Analysis 한계

- **인라이닝이 선행**되어야 분석 가능. inline 안 되면 객체가 메서드를 vesicle 로 넘어가는지 모름
- 분석 cost 가 있어 모든 메서드에 적용 안 됨 — hot 한 곳만
- 결과 보장 X (JVM 구현 디테일)

### 진단

JFR allocation 이벤트 / JMH 의 GC profile 로 객체 할당 횟수 측정. 이론적으로 0 이어야 하는 코드에 할당이 보이면 escape analysis 실패.

---

## 5. 다른 C2 최적화

### Loop Unrolling

```kotlin
for (i in 0 until 16) sum += a[i]
// → C2 가 4개씩 펼침
sum += a[0]; sum += a[1]; sum += a[2]; sum += a[3]
sum += a[4]; sum += a[5]; ...
```

분기 횟수 감소 + 명령어 수준 병렬성 향상.

### Auto-Vectorization (SIMD)

```kotlin
for (i in 0 until n) c[i] = a[i] + b[i]
// → C2 가 SIMD 명령으로 한 번에 4-8 개 더하기 (AVX2/AVX-512)
```

C2 의 superword optimization. JDK 21+ 에서 더 적극적.

JDK 의 **Vector API** (Project Panama, JEP 469 incubator) 가 명시적 vectorization 표준.

### Constant Folding & Dead Code Elimination

```kotlin
val x = 2 + 3        // → 5
val y = if (true) 10 else 20   // → 10
```

컴파일 타임에 결정되는 건 미리 계산.

### Branch Prediction 힌트

```kotlin
if (rare) doRare()
else doCommon()
```

C2 가 프로파일 데이터로 어느 분기가 자주 가는지 알면 instruction layout 을 그쪽에 유리하게 배치.

---

## 6. Code Cache

JIT 컴파일된 native 코드는 **Code Cache** (native 영역) 에 저장. 한도 있음:

```
-XX:InitialCodeCacheSize=2496K
-XX:ReservedCodeCacheSize=240M    # JDK 21 default
```

가득 차면:
```
WARNING: CodeCache is full. Compiler has been disabled.
```

→ JIT 가 멈추고 **인터프리터로 폴백** = 성능 폭락. 진단:

```bash
jcmd <pid> Compiler.codecache
```

해법: ReservedCodeCacheSize 증가, segmented code cache (`-XX:+SegmentedCodeCache` JDK 9+ 기본).

---

## 7. Deoptimization

### 정의

C2 컴파일 코드가 **잘못된 가정**(예: monomorphic 이라 inline 했는데 새 구현체 등장) 을 발견하면 인터프리터로 되돌림 (deopt).

### 트리거

- 새로 로드된 클래스가 CHA 가정 깸
- 프로파일과 다른 실행 경로
- Uncommon trap (예: null check 실패 비율이 너무 높아짐)

### 진단

```bash
-XX:+PrintCompilation -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining
-XX:+TraceDeoptimization
```

빈번한 deopt = 성능 저하 신호.

---

## 8. JIT 와 Warm-up

### 문제

JVM 은 부팅 직후 모든 코드를 인터프리터로 실행 → 처음 1000개 요청 정도는 **slow** → 이후 점차 빨라짐. 이 곡선이 "warm-up".

```
요청 P99 latency
  ▲
  │ █                                ← Tier 0 인터프리터
  │ ██
  │ █████ ◀── Tier 3 C1
  │      ████ ◀── Tier 4 C2
  │           ███████ ◀── 안정
  └────────────────────────────────► 시간
                       warm-up 시간
```

### K8s 시사점

- **readinessProbe initialDelaySeconds**: warm-up 끝나기 전엔 트래픽 안 받게 (msa 의 product deployment 는 15초)
- **HPA + 새 pod**: 스케일아웃 후 새 pod 가 cold → 잠시 P99 튐. 미리 warm-up 한 pod prefetch 가 있으면 좋음
- **AppCDS / CDS** (Class Data Sharing): 부팅 빠르게 (JIT warm-up 과 무관)
- **AOT (Project Leyden, JDK 25 일부)**: 부팅 시 미리 native 컴파일 → warm-up 단축

### Warm-up 단축 패턴

```bash
# JIT 코드 미리 생성
-XX:+UnlockDiagnosticVMOptions
-XX:+UseAppCDS                  # JDK 13+ default
-XX:SharedArchiveFile=app.jsa
```

또는 부팅 후 self-warm-up 호출:

```kotlin
@EventListener(ApplicationReadyEvent::class)
fun warmUp() {
    repeat(1000) { 
        productRepository.findById(1L)   // hot path 미리 워밍
    }
}
```

이걸 자주 보는 패턴이 **synthetic traffic** — 배포 후 N초간 합성 트래픽으로 warm.

---

## 9. msa 컨텍스트

### Spring Boot 의 reflection / dynamic proxy

- Spring 은 `@Service` / `@Repository` 빈에 dynamic proxy 적용 (CGLIB or JDK proxy)
- proxy → target method 호출이 **megamorphic** 이 될 수 있음 (여러 빈이 같은 인터페이스 구현 시)
- C2 가 인라인 못 해서 vtable lookup
- 영향: 일반적으로 무시 가능. hot path 에서 측정 시에만 신경

### Kotlin 의 inline function

```kotlin
inline fun <reified T> measure(block: () -> T): T {
    val start = System.nanoTime()
    val r = block()
    println(System.nanoTime() - start)
    return r
}
```

`inline` 키워드는 **kotlinc 가 컴파일 시 펼침** — JIT 와 별개. JIT 는 추가로 자기 inline 적용.

### `@RestController` 메서드의 컴파일

- 보통 호출 빈도 높음 → C2 까지 도달
- DTO 변환, JSON 직렬화 등은 hot path → JIT 완료 후 빠름
- warm-up 끝나면 (수백~수천 요청 후) 안정

### JIT 진단 켜기 (개발 환경)

```bash
-XX:+UnlockDiagnosticVMOptions
-XX:+PrintCompilation
-XX:+LogCompilation -XX:LogFile=jit.log
```

JITWatch 로 분석:
```bash
java -jar jitwatch.jar
# Open jit.log → hot method, inline 실패, deopt 보임
```

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "JIT 가 항상 빠름" | warm-up 전엔 인터프리터, 느림 |
| "JIT 컴파일 = AOT 컴파일" | JIT 는 실행 중. AOT 는 부팅 전 (Project Leyden) |
| "Inline 키워드(Kotlin) = JIT inline" | Kotlin inline 은 컴파일 시. JIT inline 은 별개 |
| "Escape Analysis 가 모든 객체 할당 제거" | inline + escape 분석 이 모두 성공해야. 보통 일부만 적용 |
| "C2 가 항상 C1 보다 빠른 native 생성" | 거의 그렇지만, 일부 핫 코드에서 C1 이 더 나은 경우도 (drop-back tier 4 → tier 1) |
| "Code Cache 는 메모리 거의 안 씀" | 240MB 가 default. 큰 앱에선 부족할 수 있음 |
| "Deoptimization 은 버그" | 자연스러운 동작 (CHA 가정 변경). 잦으면 문제 |

---

## 다음 학습

- [11-nmt-native-memory.md](11-nmt-native-memory.md) — Code Cache 도 native 메모리 추적 대상
- [16-lab-jfr-jmc.md](16-lab-jfr-jmc.md) — JFR 로 hot method / inline 진단
- [17-lab-jmh.md](17-lab-jmh.md) — JMH 로 escape analysis / inlining 효과 측정
