---
parent: 2-jvm-gc
seq: 11
title: NMT (Native Memory Tracking) — off-heap 메모리 진단
type: deep
created: 2026-05-01
---

# 11. NMT (Native Memory Tracking)

## TL;DR

JVM (Java Virtual Machine, 자바 가상 머신) 의 RSS(실 사용 메모리)는 **힙(`-Xmx`) 보다 훨씬 큰** 게 정상. Metaspace, Code Cache, GC (Garbage Collection, 가비지 컬렉션) Internal, Thread Stacks, Direct Buffers 등 native 영역이 합쳐지기 때문. **K8s (Kubernetes) OOMKilled 의 주범은 거의 항상 native 누수** — 힙은 멀쩡한데 RSS 가 limit 를 초과해서 죽는다. **NMT** 가 이걸 영역별로 분해해서 보여주는 JVM 내장 진단. `-XX:NativeMemoryTracking=summary` 로 켜고 `jcmd <pid> VM.native_memory` 로 조회.

```
   JVM Process RSS = 1.2 GB
   ├─ Java Heap         ─── 750 MB (Xmx)
   ├─ Class (Metaspace)─── 100 MB
   ├─ Thread Stacks    ───  80 MB (1MB × 80 threads)
   ├─ Code Cache       ───  60 MB
   ├─ GC Internal      ───  40 MB (G1 RSet 등)
   ├─ Compiler         ───  20 MB
   ├─ Symbol           ───  20 MB
   ├─ Native Library   ───  30 MB
   ├─ Direct Buffer    ───  50 MB (Netty)
   └─ Internal/etc     ───  50 MB
                          ───────
                          1200 MB ≈ 1.2 GB
```

---

## 1. NMT 켜기

### 부팅 옵션

```bash
-XX:NativeMemoryTracking=summary    # 요약만 (~5% 오버헤드)
-XX:NativeMemoryTracking=detail     # 상세 + 콜스택 (~10% 오버헤드)
-XX:NativeMemoryTracking=off        # 끔 (default)
```

운영 환경엔 `summary` 가 적당. detail 은 진단할 때만.

### 조회

```bash
# 영역별 요약
jcmd <pid> VM.native_memory summary

# 상세 (콜스택 포함, detail 모드만)
jcmd <pid> VM.native_memory detail

# 베이스라인 저장 → 시간 후 비교 (memory leak 추적)
jcmd <pid> VM.native_memory baseline
# ... 1시간 후 ...
jcmd <pid> VM.native_memory summary.diff
```

### 출력 해석

```
Native Memory Tracking:

Total: reserved=2048MB, committed=850MB

-                 Java Heap (reserved=1024MB, committed=600MB)
                            (mmap: reserved=1024MB, committed=600MB)

-                     Class (reserved=1056MB, committed=104MB)
                            (classes #15234)
                            (instance classes #14000, array classes #1234)
                            (malloc=4MB #38234)
                            (mmap: reserved=1052MB, committed=100MB)

-                    Thread (reserved=82MB, committed=82MB)
                            (thread #80)
                            (stack: reserved=80MB, committed=80MB)
                            (malloc=1MB #480)
                            (arena=1MB #160)

-                      Code (reserved=246MB, committed=58MB)
                            (malloc=2MB #11200)
                            (mmap: reserved=244MB, committed=56MB)

-                        GC (reserved=45MB, committed=43MB)
                            (malloc=15MB #5234)
                            (mmap: reserved=30MB, committed=28MB)

-                  Compiler (reserved=20MB, committed=20MB)

-                  Internal (reserved=15MB, committed=15MB)

-                    Symbol (reserved=21MB, committed=21MB)

-    Native Memory Tracking (reserved=4MB, committed=4MB)

-               Arena Chunk (reserved=1MB, committed=1MB)
```

---

## 2. 영역 별 의미

### Java Heap

`-Xmx` / `MaxRAMPercentage` 가 결정. **reserved** = 가상 주소 예약, **committed** = 실제 메모리. JVM 은 부팅 시 reserved 만 잡고 필요 시 commit.

### Class (Metaspace)

- 클래스 메타데이터, 메서드 바이트코드
- `-XX:MaxMetaspaceSize` 가 한도 (없으면 사실상 무제한)
- 누수 패턴: ClassLoader leak, dynamic proxy 폭주

```
정상: 100MB 정도 (Spring Boot 평범)
경고: 500MB +
위험: 1GB + (확실한 누수)
```

### Thread

- 스레드 수 × `-Xss` (보통 1MB)
- **80개 스레드 = 80MB** 가 단순 스택만으로
- 누수: 스레드가 무한 증식 (잘못 만든 ExecutorService)

진단:
```bash
jcmd <pid> Thread.print | grep "^\"" | wc -l   # 활성 스레드 수
```

### Code Cache

JIT 컴파일된 native 코드. `-XX:ReservedCodeCacheSize=240M` 기본. 가득 차면 JIT 멈춤(인터프리터 폴백) → 큰 성능 저하. 감지:

```bash
jcmd <pid> Compiler.codecache
```

### GC Internal

- G1: RSet, marking bitmap, card table
- ZGC: forwarding tables (적음)
- 일반적으로 힙의 5-10% 정도

### Symbol

JVM 내부 문자열 풀(class names, method names). 보통 작음. 동적 클래스 로딩 폭주 시 증가.

### Internal

malloc 으로 잡힌 잡다 (DirectBuffer 의 일부 포함). 큰 변동이 없어야 정상.

---

## 3. Direct Buffer 누수

### NMT 한계

Direct Buffer 가 **Internal** 로 분류되거나 **mmap** 으로 분류되어 단독 항목이 아닐 수 있다. JDK 21+ 부터는 `Other` 카테고리 추가.

### 별도 추적

```bash
# Direct Buffer 사용량
jcmd <pid> VM.flags | grep MaxDirectMemorySize

# JMX 로 직접
public class DirectBufferStats {
    public static void main(String[] args) {
        BufferPoolMXBean direct = ManagementFactory.getPlatformMXBeans(BufferPoolMXBean.class)
            .stream().filter { it.getName() == "direct" }.findFirst().get();
        System.out.println("Used: " + direct.getMemoryUsed());
        System.out.println("Count: " + direct.getCount());
    }
}
```

### Micrometer 메트릭

```promql
jvm_buffer_memory_used_bytes{id="direct"}
jvm_buffer_count_buffers{id="direct"}
```

### 누수 시나리오

- Netty: ByteBuf 를 `release()` 안 함. Netty leak detector 가 경고 (-Dio.netty.leakDetection.level=PARANOID)
- NIO: FileChannel.map() 의 MappedByteBuffer 가 GC 안 됨 (OS 페이지 캐시 별개)
- `ByteBuffer.allocateDirect()` 직접 사용 후 참조 누수

### 한도 명시

```bash
-XX:MaxDirectMemorySize=256m    # 명시. 미지정 시 Xmx 와 같음
```

---

## 4. K8s OOMKilled 진단 절차

### 증상

```bash
$ kubectl describe pod product-xxx
...
Last State: Terminated
  Reason: OOMKilled
  Exit Code: 137  (= 128 + SIGKILL)
```

JVM 안에서는 OOM 이 **안 던져짐** — OS 가 SIGKILL.

### 진단 1: 힙 vs 컨테이너

```bash
# 힙 사용량 (JMX 또는 jstat)
jstat -gc <pid> 1000 10
# 또는 actuator
curl localhost:8080/actuator/metrics/jvm.memory.used?tag=area:heap

# 프로세스 RSS
ps -o pid,rss,vsz -p <pid>

# 컨테이너 RSS (cgroup)
cat /sys/fs/cgroup/memory.current      # cgroup v2
cat /sys/fs/cgroup/memory/memory.usage_in_bytes  # cgroup v1
```

힙은 50% 정도인데 RSS 가 limit 의 95% → **native 누수 의심**.

### 진단 2: NMT 베이스라인 / diff

```bash
# 부팅 직후
jcmd <pid> VM.native_memory baseline

# 1시간 후
jcmd <pid> VM.native_memory summary.diff
```

```
Native Memory Tracking:
Total: ... +500MB committed   ← 1시간 사이 500MB 증가

-       Class (committed +20MB)
-       Thread (committed +200MB)   ← 스레드 200개 증가? 의심!
-       Internal (committed +250MB) ← Direct buffer? 의심!
```

### 진단 3: 영역 별 detail

```bash
jcmd <pid> VM.native_memory detail
```

- Thread 가 늘면 → `Thread.print` 로 어떤 스레드인지
- Internal 이 늘면 → DirectBuffer + Netty 로깅 (`-Dio.netty.leakDetection.level=PARANOID`)
- Class 가 늘면 → `GC.class_histogram`, `GC.class_stats` 로 어떤 클래스 폭주인지

---

## 5. 자주 보이는 native 누수 패턴

### 패턴 1 — Thread 폭증

```kotlin
// 위험
fun handle(req: Request) {
    Thread {                          // 매번 새 스레드, 회수 안 됨
        process(req)
    }.start()
}
```

해법: ExecutorService 재사용, Virtual Thread (JDK 21+).

### 패턴 2 — Netty Direct Buffer

```kotlin
// 위험 - leak detector 경고 무시
val buf = ByteBufAllocator.DEFAULT.directBuffer(1024)
// ...
// buf.release() 안 부름 → Netty pool 안 돌아옴 → 누적
```

해법:
```bash
-Dio.netty.leakDetection.level=PARANOID    # 100% 검사 (개발)
-Dio.netty.leakDetection.level=ADVANCED    # 1% 샘플링 (운영)
```

### 패턴 3 — JNA/JNI 라이브러리

C 라이브러리가 malloc 후 free 안 함. NMT 가 잘 못 잡음 (jvm 외부). pmap, valgrind 영역.

### 패턴 4 — Mmap'ed file

```kotlin
val ch = FileChannel.open(path)
val buf = ch.map(MapMode.READ_ONLY, 0, ch.size())   // mmap
// MappedByteBuffer 는 GC 가 비결정적 → 큰 파일 매핑 누적 시 RSS 폭증
```

해법: 명시적으로 unmap (Java 21 의 MemorySegment API), 또는 사용 후 close.

### 패턴 5 — Metaspace + ClassLoader leak

```kotlin
// 위험
fun reload() {
    val newLoader = URLClassLoader(jars)
    val cls = newLoader.loadClass("Foo")
    cache[k] = cls.getDeclaredConstructor().newInstance()  // 옛 ClassLoader 의 인스턴스를 영구 캐싱
    // 새 ClassLoader 가 GC 안 됨 → Metaspace 누적
}
```

해법: 캐싱하지 말기, 또는 reload 시 옛 캐시 명시 정리.

---

## 6. 측정 자동화 (Prometheus)

Micrometer 가 NMT 일부를 메트릭으로 노출:

```promql
jvm_memory_used_bytes{area="heap"}
jvm_memory_used_bytes{area="nonheap"}
jvm_memory_used_bytes{id="Metaspace"}
jvm_memory_used_bytes{id="Compressed Class Space"}
jvm_memory_used_bytes{id="CodeHeap 'non-nmethods'"}
jvm_memory_used_bytes{id="CodeHeap 'profiled nmethods'"}
jvm_memory_used_bytes{id="CodeHeap 'non-profiled nmethods'"}

jvm_threads_live_threads
jvm_threads_peak_threads

jvm_buffer_memory_used_bytes{id="direct"}
jvm_buffer_count_buffers{id="direct"}

# RSS는 process_resident_memory_bytes (Prometheus exporter)
process_resident_memory_bytes
```

알람:
```yaml
- alert: JvmRSSNearLimit
  expr: process_resident_memory_bytes > kube_pod_container_resource_limits{resource="memory"} * 0.9
  for: 5m
```

---

## 7. msa 컨텍스트

### 현재 한도

`commerce.jib-convention.gradle.kts` 에 `-XX:MaxRAMPercentage=75.0` 만 있음.

K8s `limits.memory: 1Gi` → 힙 750MB. 나머지 250MB 가 native 예산:
- Metaspace: ~100MB (Spring Boot 보통)
- Thread: ~50MB (50 스레드 가정)
- Code Cache: ~60MB
- GC Internal: ~40MB (G1)
- 기타: ~30MB
- **여유 -30MB** = 빠듯 → OOMKilled 위험

### 권장 패치 (21번 파일에서 정리)

```kotlin
jvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=70.0",                  // 75 → 70 (여유)
    "-XX:MaxMetaspaceSize=256m",                  // 명시 한도
    "-XX:ReservedCodeCacheSize=128m",             // 240MB default → 128MB
    "-XX:MaxDirectMemorySize=64m",                // Netty 사용 안 하면 작게
    "-XX:NativeMemoryTracking=summary",           // 진단 가능
    // 합계: 750(heap) + 256(meta) + 128(code) + 80(stack) + 50(GC) + 64(direct) ≈ 1.3GB
    // → 1Gi limit 으론 부족. limit 1.5Gi 또는 위 값들 더 줄이기
)
```

이 계산이 **정확한 메모리 예산 짜기**의 시작.

---

## 8. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "RSS = 힙 사용량" | RSS = 힙 + native 모두. RSS 가 1.5~2배 큰 게 정상 |
| "OOMKilled = 힙 OOM" | OOMKilled 는 OS 레벨. 힙은 멀쩡할 수 있음 |
| "NMT 켜면 운영 부담" | summary 모드 ~5%. 보통 OK. detail 은 진단 시만 |
| "Direct Buffer 도 -Xmx 에 포함" | 아님. 별도 한도 (`MaxDirectMemorySize`) |
| "Reserved 가 실제 사용 메모리" | Committed 가 실제. Reserved 는 가상 주소만 잡은 것 |
| "Metaspace 무제한이라 안전" | 한도 없으면 OOMKilled 의 주원인. 명시 권장 |

---

## 다음 학습

- [12-oom-five-types.md](12-oom-five-types.md) — OOM 5유형 vs OOMKilled 구분
- [13-heap-dump-mat.md](13-heap-dump-mat.md) — 힙 누수 진단
- [19-k8s-memory-vs-heap.md](19-k8s-memory-vs-heap.md) — 컨테이너 limit 산정 공식
