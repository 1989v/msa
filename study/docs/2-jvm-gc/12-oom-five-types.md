---
parent: 2-jvm-gc
seq: 12
title: OOM 5유형 — 메시지 별 진단법
type: deep
created: 2026-05-01
---

# 12. OOM 5유형

## TL;DR

`OutOfMemoryError` 는 메시지가 **5가지** — 각각 원인과 진단법이 완전히 다르다. 메시지를 못 읽으면 진단 방향이 틀어진다. (1) **Java heap space** = 힙 부족, 가장 흔함. (2) **Metaspace** = 클래스 메타. (3) **GC (Garbage Collection, 가비지 컬렉션) overhead limit exceeded** = GC 가 일은 하는데 효율 < 2%. (4) **Direct buffer memory** = off-heap NIO. (5) **Unable to create native thread** = 스레드 한도 초과. 추가로 **OOMKilled (K8s (Kubernetes))** 는 OOM (Out Of Memory, 메모리 부족) 이 아니라 **OS 가 죽인 것** — JVM (Java Virtual Machine, 자바 가상 머신) 안에서 메시지가 안 보임. 면접 단골: "OOM 발생하면 어떻게 진단하시나요?" → 메시지 종류부터 분류한다고 답해야 점수.

```
   OutOfMemoryError 메시지 분기
   ├─ Java heap space          → 힙 부족 (누수 OR 한도)
   ├─ Metaspace                → 클래스 메타 부족
   ├─ GC overhead limit exceeded → GC 가 일하는데 진척 없음
   ├─ Direct buffer memory     → off-heap 부족
   └─ Unable to create native thread → OS 스레드 한도

   별도:
   ├─ OOMKilled (Exit 137)     → OS / cgroup 이 죽임 (RSS 초과)
   └─ StackOverflowError       → 스택 깊이 (별도, OOM 아님)
```

---

## 1. Java heap space (가장 흔함)

### 메시지

```
java.lang.OutOfMemoryError: Java heap space
```

### 의미

힙(Young + Old) 에 새 객체 할당 못 함. GC 가 회수해도 부족.

### 두 시나리오

#### A. 누수 (지속적 증가)

- 어떤 컬렉션에 객체가 영구히 쌓임 → Old 점유율 시간에 따라 우상향
- GC 로그에서 Old 가 GC 후에도 줄지 않음
- MAT 으로 확인 → leak suspect

```
힙 점유율 (Old):
  ▲
100│                         ╱╲╲ OOM
  │                      ╱╱
  │                  ╱╱
50│              ╱╱
  │          ╱╱
  │       ╱╱
  └────────────────────────────────► 시간
```

#### B. 단발성 큰 할당

- 평소엔 정상 → 어떤 요청이 갑자기 큰 객체(`findAll()` 같은) 할당
- Old 가 평소 20% 였는데 한 요청에서 90% → OOM
- 누수 아님. 코드 패턴 문제

### 진단 절차

1. **GC 로그**에서 Old 점유율 추이 확인 (누수 vs 단발 구분)
2. **Heap dump** (`jcmd <pid> GC.heap_dump`) 후 MAT
3. MAT 의 **Leak Suspects** 또는 **Dominator Tree**

### 해결

- 누수: 원인 객체의 참조 끊기. WeakReference / 캐시 TTL / 명시적 close
- 단발: pagination, streaming, 큰 객체 분할
- 한도 부족: `Xmx` / `MaxRAMPercentage` 증가

---

## 2. Metaspace

### 메시지

```
java.lang.OutOfMemoryError: Metaspace
```

### 의미

클래스 메타데이터 영역 (native) 부족. `-XX:MaxMetaspaceSize` 가 있을 때만 발생. 기본 무제한이지만 컨테이너 RSS 한도엔 영향.

### 흔한 원인

#### A. ClassLoader Leak

웹앱 hot-reload, plugin 시스템에서 옛 ClassLoader 가 GC 안 됨. 그 ClassLoader 가 로드한 클래스 + Metaspace 가 같이 쌓임.

#### B. 동적 클래스 폭주

- Groovy, Bytebuddy, ASM 으로 클래스를 무한정 생성
- CGLIB proxy 가 빈마다 생성 + 빈 재초기화 반복
- JSON 직렬화 라이브러리가 type 마다 reflection 클래스 생성 + 캐싱 안 함

#### C. Spring DevTools / 핫리로드

`spring-boot-devtools` 가 ClassLoader 를 새로 만들면 옛 로더 누수 가능.

### 진단

```bash
# 클래스 수
jcmd <pid> GC.class_histogram | head -20

# Metaspace 통계
jcmd <pid> VM.metaspace

# 어떤 ClassLoader 가 많은 클래스 들고 있는지
jcmd <pid> VM.classloader_stats
```

### 해결

- 명시 한도: `-XX:MaxMetaspaceSize=256m` — 무한 증가 차단
- ClassLoader leak 추적: MAT 의 ClassLoader detection
- 동적 클래스 캐싱: 라이브러리가 type 별 클래스 generation 결과를 캐시하는지 확인

---

## 3. GC overhead limit exceeded

### 메시지

```
java.lang.OutOfMemoryError: GC overhead limit exceeded
```

### 의미

> **JVM 시간의 98% 이상을 GC 에 쓰는데 회수되는 메모리는 2% 미만**

JVM 이 "이건 GC 만 하다 끝날 것 같다" 고 미리 포기 선언. 사실상 heap space OOM 의 전조.

### 발생 시점

힙이 거의 다 찬 상태에서 작은 할당을 무한 반복. GC 는 매번 도는데 비울 게 거의 없음 → 다음 GC, 다음 GC...

### 진단

`-XX:-UseGCOverheadLimit` 로 끄면 메시지는 안 뜨고 그냥 평범한 heap space OOM 이 됨. **끄지 말고** 메시지를 신호로 활용.

### 해결

heap space OOM 과 동일. 보통 누수.

---

## 4. Direct buffer memory

### 메시지

```
java.lang.OutOfMemoryError: Direct buffer memory
```

### 의미

`-XX:MaxDirectMemorySize` 한도(미지정 시 `Xmx`) 초과로 `ByteBuffer.allocateDirect()` 실패.

### 흔한 원인

- Netty: ByteBuf 누수 (release 안 함)
- NIO: FileChannel.map 후 unmap 안 함
- Kafka producer / consumer 의 internal direct buffer 누적

### 진단

```bash
# 명령어
jcmd <pid> VM.flags | grep MaxDirectMemorySize

# JMX
BufferPoolMXBean direct = ...
direct.getMemoryUsed()    # 현재 사용
direct.getCount()         # 활성 버퍼 개수

# Netty leak detector
-Dio.netty.leakDetection.level=ADVANCED
```

### 해결

- 한도 명시: `-XX:MaxDirectMemorySize=128m`
- 누수 추적: leak detector 로그 분석
- ByteBuf release try/finally
- pool 사용 (`PooledByteBufAllocator`)

---

## 5. Unable to create native thread

### 메시지

```
java.lang.OutOfMemoryError: unable to create new native thread
```

### 의미

OS 레벨 스레드 생성 실패. 두 가지 원인:

#### A. JVM 메모리 부족

각 스레드 = 1MB 스택 (`-Xss`). 1만 스레드 = 10GB. JVM/OS 메모리 부족.

#### B. OS 스레드 한도

```bash
ulimit -u                                # max user processes
cat /proc/sys/kernel/threads-max         # 시스템 한도
cat /sys/fs/cgroup/pids.max              # cgroup 제한
```

K8s 에서 cgroup pids 제한 도달 → 스레드 못 만듦.

### 흔한 원인

- ExecutorService 를 매 요청마다 새로 생성
- `Thread { ... }.start()` 를 무한정 호출
- 라이브러리 버그로 스레드 풀 누수

### 진단

```bash
# 활성 스레드 수
jcmd <pid> Thread.print | grep "^\"" | wc -l

# 어떤 스레드가 많은지
jcmd <pid> Thread.print | grep "^\"" | sort | uniq -c | sort -rn | head
```

### 해결

- ExecutorService 재사용
- Virtual Thread (JDK 21+) — OS 스레드 아니므로 한도 영향 적음
- 스택 크기 줄이기: `-Xss512k` (StackOverflow 위험과 trade)
- ulimit / cgroup pids 한도 확장

---

## 6. OOMKilled (K8s)

### 증상

```bash
$ kubectl describe pod product-xxx
Last State: Terminated
  Reason: OOMKilled
  Exit Code: 137
```

JVM 안에서 OutOfMemoryError 가 **안 던져짐**. OS 가 SIGKILL.

### 원인

cgroup memory limit (e.g. `limits.memory: 1Gi`) 을 RSS 가 초과. 힙은 멀쩡할 수 있다 — native 영역(Metaspace, Thread, Code Cache, Direct Buffer, GC Internal) 합계가 한도 초과.

### 진단

힙 정상인데 OOMKilled 면 **NMT** 로 영역별 분해. 11번 파일 상세.

### 해결

- limits.memory 증가 (가장 빠른 응급)
- MaxRAMPercentage 낮추기 (heap 줄여 native 여유 확보)
- 영역별 한도 명시: MaxMetaspaceSize, ReservedCodeCacheSize, MaxDirectMemorySize
- native 누수 추적

---

## 7. 운영 권장 옵션

### 자동 덤프 + 재시작

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/log/heapdump-%t.hprof
-XX:+ExitOnOutOfMemoryError
```

`+ExitOnOutOfMemoryError` 가 핵심: OOM 시 즉시 종료 → K8s liveness 가 재시작. 대안 `+CrashOnOutOfMemoryError` 는 SIGABRT (core dump 남김).

**왜 종료가 안전한가?**: OOM 후 JVM 은 일관성이 깨질 수 있다 — 일부 스레드만 죽고 일부는 살아있는 좀비 상태가 되어 잘못된 응답을 낼 수 있음. 차라리 죽고 재시작.

### Reserve 디스크

`/var/log/heapdump` 가 PVC 로 마운트되어 있어야 컨테이너 재시작 후에도 덤프 살아남음.

---

## 8. 진단 결정 트리

```
OOM 발생 / 컨테이너 죽음
   │
   ▼
JVM 안에서 OutOfMemoryError 메시지가 보이나?
   │
   ├─ Yes → 메시지 종류 확인
   │         ├─ Java heap space → MAT 로 누수 분석
   │         ├─ Metaspace → ClassLoader 분석, MaxMetaspaceSize 명시
   │         ├─ GC overhead → heap space 와 동일 절차
   │         ├─ Direct buffer → Netty leak detector
   │         └─ unable to create native thread → 스레드 dump + ulimit
   │
   └─ No (OOMKilled, Exit 137)
              │
              ▼
       NMT 로 영역별 분해
              │
              ├─ Heap 정상 + Metaspace ↑ → ClassLoader leak
              ├─ Heap 정상 + Thread ↑ → 스레드 누수
              ├─ Heap 정상 + Internal ↑ → Direct buffer / native lib leak
              └─ 전부 정상 → limit 가 너무 작음 (산정 재검토)
```

---

## 9. msa 컨텍스트

### 현 설정의 위험

```kotlin
jvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=75.0",
    // ❌ HeapDumpOnOutOfMemoryError 없음 → 사후 진단 어려움
    // ❌ ExitOnOutOfMemoryError 없음 → 좀비 상태 가능
    // ❌ MaxMetaspaceSize 없음 → Metaspace 무한 증가 시 OOMKilled
    // ❌ NativeMemoryTracking 없음 → 영역 분해 불가
)
```

### 개선안 (21번에서 ADR 후보로)

```kotlin
jvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=70.0",
    "-XX:MaxMetaspaceSize=256m",
    "-XX:MaxDirectMemorySize=64m",
    "-XX:ReservedCodeCacheSize=128m",
    "-XX:NativeMemoryTracking=summary",
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
    "-XX:+ExitOnOutOfMemoryError",
    "-Xlog:gc*:file=/var/log/jvm/gc.log:time,uptime:filecount=5,filesize=10M",
)
```

K8s deployment 에 PVC 마운트 또는 EmptyDir(짧은 보존 OK).

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "OOM = 힙 부족" | 5종류 중 1개. 메시지부터 보기 |
| "OOMKilled = OOM 메시지" | 다름. OS 가 죽임. JVM 안에선 메시지 없음 |
| "GC overhead = 힙 부족 미만이니 안전" | heap space OOM 직전. 사실상 같은 사태 |
| "MaxDirectMemorySize 미지정 = 무제한" | Xmx 와 같음. 큰 영향 |
| "MaxMetaspaceSize 미지정 = 무한대라 좋다" | OOMKilled 의 주범. 한도 명시 권장 |
| "Heap Dump 가 항상 OOM 원인 알려줌" | 단발성 OOM 은 dump 가 정상 시점 → 누수 안 보임. 누수형에만 효과 |

---

## 다음 학습

- [13-heap-dump-mat.md](13-heap-dump-mat.md) — 누수형 OOM 의 정밀 진단
- [11-nmt-native-memory.md](11-nmt-native-memory.md) — OOMKilled 의 native 영역 분해
- [15-lab-heap-dump-mat.md](15-lab-heap-dump-mat.md) — OOM 의도 재현 + MAT 실습
