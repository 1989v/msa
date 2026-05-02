---
parent: 2-jvm-gc
seq: 01
title: JVM 메모리 영역 — Heap / Metaspace / Stack / Native
type: deep
created: 2026-05-01
---

# 01. JVM 메모리 영역

## TL;DR

JVM은 프로세스 가상 메모리 안에서 **힙(공유, GC 대상) + 메타스페이스(클래스 메타) + 스레드별 스택 + 네이티브(Direct/JNI/코드 캐시)** 4가지 큰 영역을 관리한다. OOM 메시지는 이 4영역 중 어디에서 터졌는지를 구분해서 보여준다 — 메시지를 못 읽으면 진단이 안 된다.

```
   ┌───────────────────────────────────────────────────────────┐
   │                  JVM Process Virtual Memory                │
   │                                                           │
   │  ┌──── Heap (관리) ────────────────────────────────────┐ │
   │  │   Young: Eden + Survivor 0 + Survivor 1               │ │
   │  │   Old (Tenured)                                       │ │
   │  └────────────────────────────────────────────────────┘  │
   │                                                           │
   │  ┌──── Metaspace (Native) ────────────────────────────┐ │
   │  │   Class Metadata, Method Bytecode                     │ │
   │  │   Compressed Class Space (UseCompressedClassPointers) │ │
   │  └────────────────────────────────────────────────────┘  │
   │                                                           │
   │  ┌──── Code Cache (Native) ───────────────────────────┐ │
   │  │   JIT 컴파일된 네이티브 코드 (C1/C2)                    │ │
   │  └────────────────────────────────────────────────────┘  │
   │                                                           │
   │  ┌──── Direct Buffers / JNI / Mmap (Native) ──────────┐ │
   │  │   ByteBuffer.allocateDirect, FileChannel, Netty       │ │
   │  └────────────────────────────────────────────────────┘  │
   │                                                           │
   │  ┌──── Per-Thread Stack ──────────────────────────────┐ │
   │  │   Frame (지역변수, 피연산자 스택, return address)         │ │
   │  │   PC Register                                           │ │
   │  └────────────────────────────────────────────────────┘  │
   └───────────────────────────────────────────────────────────┘
```

---

## 1. Heap

### 구조

JVM 사양은 "객체와 배열은 힙에 둔다"고만 정의한다. **Young/Old 분할은 generational GC의 구현 디테일**이지 사양이 아니다 — ZGC Generational(JDK 21)은 region 기반으로 young/old를 표현하고, ZGC non-generational은 분할 자체가 없다.

#### Young Generation
- **Eden**: 새 객체가 처음 들어가는 공간
- **Survivor 0, Survivor 1**: Minor GC에서 살아남은 객체가 머무는 두 공간 (Copying 알고리즘에서 from/to 역할 교대)
- 비율 기본값: Eden:Survivor = 8:1:1 (`-XX:SurvivorRatio=8`, 단 G1은 region 기반이라 무시됨)

#### Old (Tenured) Generation
- 여러 번 Minor GC를 살아남은 객체
- 큰 객체(Humongous, G1에서 region 50% 이상)는 처음부터 Old로 직행하기도 함

### 핵심 옵션

| 옵션 | 의미 | 비고 |
|---|---|---|
| `-Xms` | 초기 힙 크기 | 부팅 시 확보 |
| `-Xmx` | 최대 힙 크기 | 절대값. 컨테이너에서는 비추 |
| `-XX:MaxRAMPercentage` | 컨테이너 메모리의 X% 를 힙 최대로 | **컨테이너 권장**. msa 기본 75% |
| `-XX:NewRatio` | Old:Young 비율 (기본 2 = Old 2 : Young 1) | G1에선 무시 |
| `-XX:SurvivorRatio` | Eden:Survivor 비율 | G1에선 무시 |
| `-XX:MaxHeapFreeRatio` / `MinHeapFreeRatio` | 힙 자동 축소/확장 임계 | 컨테이너에선 보통 끔 |

### -Xms == -Xmx 가 운영 권장인 이유

- 힙 크기 조정 자체가 비용 (Resize 시 GC 동반)
- 메모리 확보 실패는 운영 중에 만나기 싫음 → 부팅 시 fail-fast
- 컨테이너에서 `MaxRAMPercentage` 만 쓰면 자동으로 비슷한 효과 (limit 기반 단일 값 계산)

```kotlin
// 부팅 시 실제 힙 확인 (Spring Boot Actuator)
@RestController
class JvmInfoController(private val mxBean: java.lang.management.MemoryMXBean = ManagementFactory.getMemoryMXBean()) {
    @GetMapping("/jvm/heap")
    fun heap() = mapOf(
        "init" to mxBean.heapMemoryUsage.init,
        "used" to mxBean.heapMemoryUsage.used,
        "committed" to mxBean.heapMemoryUsage.committed,
        "max" to mxBean.heapMemoryUsage.max
    )
}
```

### Heap이 부족할 때

```
Exception in thread "http-nio-8081-exec-3" java.lang.OutOfMemoryError: Java heap space
```

이게 가장 흔한 OOM. **누수**일 수도 있고 단순히 **할당이 한도를 초과**한 일회성일 수도 있다 → 12번 파일에서 5유형 구분.

---

## 2. Metaspace (JDK 8 이후 PermGen 대체)

### PermGen vs Metaspace

| 항목 | PermGen (JDK 7-) | Metaspace (JDK 8+) |
|---|---|---|
| 위치 | Heap 내부 | Native 메모리 |
| 기본 한도 | 64-82MB (작음) | **무제한** (`-XX:MaxMetaspaceSize` 미지정 시) |
| GC | 풀 GC 시에만 | Class unload 시 자동 |
| OOM | `PermGen space` | `Metaspace` |

PermGen 시절 "OOM PermGen" 이 흔했던 이유 — 작은 고정 한도. Metaspace는 native 라서 기본은 사실상 무제한이지만, **컨테이너 메모리 리밋을 잠식**할 수 있어 운영에서는 한도를 주는 게 안전하다.

### 들어가는 것

- 클래스 메타데이터 (필드/메서드 시그니처, 상수 풀, 어노테이션)
- 컴파일된 메서드 바이트코드 자체
- **JDK 8+에서 String.intern() 풀은 힙으로 이동** (PermGen 시절 OOM 단골 원인 해소)

### 핵심 옵션

| 옵션 | 의미 |
|---|---|
| `-XX:MetaspaceSize` | 초기 임계 (이를 넘으면 class GC 트리거) |
| `-XX:MaxMetaspaceSize` | 최대 한도. 미지정 시 무제한 |
| `-XX:CompressedClassSpaceSize` | 압축 클래스 포인터 영역 (기본 1GB) |
| `-XX:+UseCompressedClassPointers` | 32-bit 클래스 포인터 (힙 < 32GB일 때 자동 활성) |

### Metaspace OOM 시나리오

- **동적 클래스 로딩**: Groovy, Bytebuddy, CGLIB proxy를 무한정 생성
- **ClassLoader leak**: 톰캣 hot-reload 시 옛 ClassLoader가 GC 안 됨 (Static 필드 참조 등)
- **CDI/Spring proxy 폭발**: AOP 빈을 동적으로 끝없이 만드는 경우

```
Caused by: java.lang.OutOfMemoryError: Metaspace
```

진단: `jcmd <pid> GC.class_histogram` 또는 `jcmd <pid> VM.metaspace`

---

## 3. Stack (스레드별)

### 구조

각 스레드는 자기 스택을 가진다. 스택 프레임은 **메서드 호출마다 푸시**:

```
   Stack Frame
   ├── Local Variables (this, 파라미터, 지역변수)
   ├── Operand Stack (바이트코드 피연산자)
   ├── Frame Data (return address, constant pool 참조)
```

### 핵심 옵션

| 옵션 | 의미 | 기본 |
|---|---|---|
| `-Xss` | 스레드별 스택 크기 | 보통 1MB (플랫폼별 차이) |

### 스레드 폭발 = 메모리 폭발

스레드 1000개 × 1MB = **1GB 가 스택**으로 사라진다. msa 처럼 Tomcat thread pool 200~400 + Kafka consumer 스레드 + Reactor 스레드를 합치면 무시 못 함.

**Virtual Threads (JDK 21+)** 가 이 문제를 해결 — VT는 OS 스레드가 아니므로 스택이 동적으로 늘어나는 작은 stackful coroutine. 백만 개 띄워도 메모리 폭발이 안 난다.

### StackOverflowError (vs OOM)

```
Exception in thread "main" java.lang.StackOverflowError
```

이건 **OOM 이 아니라** 스택 깊이 초과. 보통 무한 재귀나 잘못된 toString/equals 순환 참조. `-Xss` 늘리는 건 미봉책.

---

## 4. PC Register

스레드마다 **현재 실행 중 바이트코드 주소**를 가리킨다. 매우 작음(수 바이트). 면접에서 "JVM 메모리 영역 다섯 가지 말해보세요" 의 마지막 한 자리 채우는 단골. 실무 의미는 거의 없음.

---

## 5. Native Memory (off-heap)

### 종류

| 종류 | 설명 | 누수 시나리오 |
|---|---|---|
| **Direct Buffer** | `ByteBuffer.allocateDirect()` — JVM 외부 메모리 | Netty, Kafka client, NIO 채널 |
| **JNI** | C/C++ 라이브러리가 잡은 메모리 | JNI 호출 누수 |
| **Mmap** | 파일 메모리 매핑 (`MappedByteBuffer`) | 커밋된 페이지 누적 |
| **Code Cache** | JIT 컴파일 결과 | full 시 인터프리터로 폴백 (느려짐) |
| **Compressed Class Space** | UseCompressedClassPointers 영역 | Metaspace의 일부 |
| **GC Internal** | Card Table, RSet, Marking Bitmap | G1/ZGC 내부 자료구조 |

### Direct Buffer 사이즈

기본 한도는 `-XX:MaxDirectMemorySize` (미지정 시 `-Xmx` 와 같음). Netty 는 자체 추적기로 누수 감지 (`Netty leak detector`).

```kotlin
// Direct Buffer 할당 (위험)
val buf: ByteBuffer = ByteBuffer.allocateDirect(64 * 1024 * 1024)  // 64MB off-heap
// 해제는 GC 가 PhantomReference 통해 비결정적으로 → 빠르게 해제하려면 sun.misc.Unsafe 또는 JDK 21 의 MemorySegment
```

### NMT (Native Memory Tracking)

JVM이 native 메모리를 어디에 얼마나 썼는지 영역별로 보여주는 내장 진단. 11번 파일에서 상세.

```bash
# 부팅 옵션
-XX:NativeMemoryTracking=summary

# 런타임 조회
jcmd <pid> VM.native_memory summary
```

### 컨테이너 OOMKilled

힙은 멀쩡한데 **RSS가 limit를 초과**해서 K8s OOMKiller에 죽는 경우 — 거의 항상 native memory(Direct Buffer / Metaspace / Code Cache / NMT 의 Internal 항목) 누수다. 이때 JVM 안에서는 `OutOfMemoryError` 가 아예 안 던져지고 그냥 SIGKILL → 컨테이너 재시작. 가장 골치 아픈 시나리오.

---

## 6. msa 컨텍스트

### 현재 설정 (commerce.jib-convention.gradle.kts)

```kotlin
container {
    jvmFlags = listOf(
        "-XX:+UseContainerSupport",
        "-XX:MaxRAMPercentage=75.0",
        "-Djava.security.egd=file:/dev/./urandom"
    )
}
```

- **UseContainerSupport** (JDK 10+) — cgroup memory limit 인식. JDK 17+ 는 기본 활성이지만 명시 OK
- **MaxRAMPercentage=75.0** — 컨테이너 limit 의 75% 를 힙 최대로
- 1Gi limit → 약 750MB 힙. 나머지 250MB 가 **Metaspace + Stack + Direct Buffer + Code Cache + GC Internal** 이 다 먹는 예산

### 빠진 것 (개선 후보, 21번 파일에서 정리)

- `InitialRAMPercentage` 미설정 → 부팅 시 점진 확장 = GC 빈도 증가
- `MaxMetaspaceSize` 미설정 → 무한 확장 가능 (OOMKilled 위험)
- `MaxDirectMemorySize` 미설정 → 기본 = `Xmx` (Netty 가 75% × 75% 씩 잡을 수 있음)
- GC 로그 미설정 → 장애 시 forensic 불가

---

## 7. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "PermGen 이 Metaspace 로 이름만 바뀐 것" | 위치가 Heap → Native 로 바뀜. 한도/관리 방식 다름 |
| "Stack 도 GC 대상" | 스택 프레임은 메서드 종료 시 자동 pop. GC 대상 아님 |
| "Metaspace 는 GC 안 됨" | Class unload 시 GC 됨. 단 트리거가 드물 뿐 |
| "Direct Buffer 도 -Xmx 에 포함" | 아니다. off-heap. `-XX:MaxDirectMemorySize` 별도 |
| "Heap 만 보면 OOM 진단 끝" | 컨테이너 OOMKilled 의 절반은 native 메모리 누수 |
| "JVM 메모리 = -Xmx" | NMT 로 보면 Reserved 가 Xmx 의 1.3~1.5배 흔함 |

---

## 다음 학습

- [02-object-allocation.md](02-object-allocation.md) — TLAB, Eden, Survivor, Old 흐름
- [11-nmt-native-memory.md](11-nmt-native-memory.md) — Native Memory Tracking 상세
- [19-k8s-memory-vs-heap.md](19-k8s-memory-vs-heap.md) — K8s limit ↔ MaxRAMPercentage
