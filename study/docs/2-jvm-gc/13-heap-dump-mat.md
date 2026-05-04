---
parent: 2-jvm-gc
seq: 13
title: Heap Dump 분석 — MAT / jcmd / Thread Dump 와의 조합
type: deep
created: 2026-05-01
---

# 13. Heap Dump 분석

## TL;DR

Heap Dump 는 JVM (Java Virtual Machine, 자바 가상 머신) 힙의 스냅샷(.hprof) — **모든 객체 + 참조 그래프**. 누수 진단의 정공법. **jcmd / jmap** 으로 채취, **Eclipse MAT** 으로 분석. MAT 의 핵심 무기는 **Dominator Tree** (큰 객체 retention 분석) 와 **Leak Suspects Report** (자동 누수 후보 추천). 그리고 Heap Dump 만으로는 부족할 때가 있다 — **데드락이나 무한 루프성 OOM (Out Of Memory, 메모리 부족)** 은 Thread Dump 와 cross-check 해야 정확. Thread Dump 정밀 분석은 **#3 동시성 plan Phase 2** 에서 다루고, 본 절에서는 두 덤프를 **어떻게 조합 진단**하는지의 절차만 정리한다.

```
   힙 덤프 (.hprof, GB 단위)
        │
        ▼  Eclipse MAT 로 인덱스 빌드
   ┌────────────────────────────────────────┐
   │  Histogram     — 클래스별 인스턴스 수      │
   │  Dominator Tree — 가장 많이 retain 하는 객체 │
   │  Leak Suspects — 자동 분석 리포트          │
   │  Thread Overview — 스레드별 stack + heap   │
   │  OQL          — SQL 같은 쿼리 언어         │
   │  Path to GC Roots — 누수 경로 추적         │
   └────────────────────────────────────────┘
```

---

## 1. Heap Dump 채취

### 운영 중 dump (jcmd)

```bash
# 권장
jcmd <pid> GC.heap_dump /tmp/heap.hprof

# 또는 살아있는 객체만 (Full GC 한 번 돌리고 dump → 작음)
jcmd <pid> GC.heap_dump -all=false /tmp/heap-live.hprof
```

### 옛 방식 (jmap)

```bash
# live=true 면 GC 후 살아있는 것만
jmap -dump:live,format=b,file=/tmp/heap.hprof <pid>

# 전체 (죽은 것도 포함, 더 큼, 일부 누수는 죽은 객체 검사가 도움)
jmap -dump:format=b,file=/tmp/heap.hprof <pid>
```

### 자동 dump (OOM 시)

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof
```

OOM 발생 시점에 자동 — 누수 시점 정확히 잡힘.

### 주의

- **STW 동반** — dump 는 객체 그래프 일관성 위해 GC 와 비슷한 STW. 큰 힙(20GB+)은 분~십분
- **디스크 공간** — 힙 크기와 비슷. 1GB 힙 = 1GB 덤프. live-only 면 더 작음
- **운영 영향** — 트래픽 받는 pod 에서 dump 시 short blip. 미리 트래픽 빼기 권장

### K8s 에서 dump

```bash
# pod 안에서 채취
kubectl exec -it product-xxx -- jcmd 1 GC.heap_dump /tmp/heap.hprof

# 외부로 복사
kubectl cp product-xxx:/tmp/heap.hprof ./heap.hprof

# 또는 EFS/PVC 마운트해서 직접 떨궈둠
```

---

## 2. Eclipse MAT 사용

### 설치

```bash
# macOS
brew install --cask mat

# 또는 다운로드: https://www.eclipse.org/mat/downloads.php
```

### 첫 실행

1. File → Open Heap Dump → `.hprof` 선택
2. 인덱스 빌드 (1GB 덤프 기준 1~3분)
3. **Leak Suspects Report** 자동 제안 → Yes

### Leak Suspects Report

```
Problem Suspect 1
  61 instances of "java.util.concurrent.ConcurrentHashMap$Node[]",
  loaded by "..." occupy 750,123,456 (74.83%) bytes.
  
  Keywords:
    com.kgd.product.cache.UnboundedCache
    java.util.concurrent.ConcurrentHashMap
```

→ ConcurrentHashMap 이 750MB 잡고 있음 → UnboundedCache 가 의심.

자동 진단의 한계: **추천일 뿐, 진실 검증 필요**.

---

## 3. Dominator Tree (가장 강력)

### 개념

객체 X 의 **dominator** = "X 를 도달 가능하게 만드는 유일한 객체" — 그것이 사라지면 X 도 함께 GC 된다.

**Retained Heap** = 그 객체가 dominate 하는 객체들의 메모리 합. "이 객체 하나 없애면 얼마 회수되나" 의 척도.

### 보는 법

MAT 에서 Dominator Tree 열기 → 큰 retained heap 순으로 정렬 → 상위 10개:

```
   Class Name                                    Retained Heap   %
   com.kgd.product.cache.UnboundedCache          750 MB         74%
   io.netty.buffer.PoolThreadCache$MemoryRegionCache  50 MB    5%
   org.apache.tomcat.util.threads.TaskQueue       30 MB         3%
   ...
```

상위 1개가 압도적으로 크면 → **그게 누수 후보**.

### Path to GC Roots

후보 객체 우클릭 → Path to GC Roots → with all references:

```
UnboundedCache (750 MB)
   <-- ProductService.cache (field)
      <-- BeanDefinitionRegistry (Spring 컨테이너)
         <-- ApplicationContext
            <-- GC Root (Static field of org.springframework...)
```

→ ProductService 의 cache 필드가 GC root 까지 도달 → **strong reference**. 누수 확정.

---

## 4. Histogram

### 보는 법

MAT 의 Histogram 탭 → 클래스별 인스턴스 수 + 총 사이즈.

```
   Class Name                  Objects      Shallow    Retained
   byte[]                       1,234,567    500 MB     500 MB
   char[]                         234,567    100 MB     100 MB
   java.lang.String               234,567     50 MB      80 MB
   com.kgd.product.Order            12,345     20 MB      45 MB
```

큰 byte[] / char[] 가 의심스러우면 우클릭 → "List Objects with incoming references" → 누가 들고 있는지 거꾸로 추적.

### Group By → ClassLoader

ClassLoader 별 클래스 분포 → ClassLoader Leak 진단.

---

## 5. OQL (Object Query Language)

SQL 비슷한 쿼리로 객체 검색.

```sql
-- 모든 String 중 길이 10000+
SELECT * FROM java.lang.String s WHERE s.value.@length > 10000

-- ArrayList 중 사이즈 1000+
SELECT * FROM java.util.ArrayList l WHERE l.size > 1000

-- 특정 클래스의 인스턴스 수
SELECT count(*) FROM com.kgd.product.Order

-- 큰 ConcurrentHashMap
SELECT toString(m), m.size FROM java.util.concurrent.ConcurrentHashMap m WHERE m.size > 10000
```

수동 분석 강력함. MAT 가이드에 예제 풍부.

---

## 6. Thread Overview

MAT 의 Thread Overview → 각 스레드의 스택 + 그 스레드가 retain 하는 메모리.

```
   Name                       State      Retained Heap
   http-nio-8081-exec-3       RUNNABLE   200 MB
   kafka-consumer-thread      WAITING     50 MB
   ...
```

**스레드가 200MB 를 retain** = 그 스레드의 stack frame 변수가 참조하는 객체 그래프가 200MB. 큰 데이터를 메서드 안에서 들고 있는 패턴.

이게 **Heap Dump + Thread Dump cross-check** 의 시작점.

---

## 7. Heap Dump + Thread Dump 조합 진단

### 왜 조합이 필요한가

Heap Dump 만으로는 알 수 없는 것:
- 데드락 (어느 스레드가 어느 락을 기다리는가)
- 무한 루프 (스택 추적 필요)
- 특정 스레드의 CPU burn

Thread Dump 만으로는 알 수 없는 것:
- 어느 객체가 메모리를 잡고 있는가
- 누수의 retention path

→ 두 덤프 조합 시 정밀 진단 가능.

### 조합 절차

#### 1. 동시 채취

```bash
# Thread Dump
jcmd <pid> Thread.print > thread.dump

# Heap Dump (같은 시점)
jcmd <pid> GC.heap_dump /tmp/heap.hprof
```

타임스탬프가 비슷한 두 덤프.

#### 2. Thread Dump 에서 의심 스레드 찾기 (#3 plan Phase 2 상세)

```
"http-nio-8081-exec-3" #45 daemon prio=5 os_prio=0 tid=0x... nid=0x... runnable
   java.lang.Thread.State: RUNNABLE
        at com.kgd.product.cache.UnboundedCache.put(...)
        at com.kgd.product.service.ProductService.find(...)
        ...
```

→ exec-3 이 cache 에 put 중. "이 스레드가 어떤 객체를 들고 있는가?" 가 다음 질문.

#### 3. Heap Dump 의 Thread Overview 에서 같은 스레드 찾기

```
   Thread "http-nio-8081-exec-3"
   Retained Heap: 250 MB
      ▼
   Local variables (frame 0):
      this (ProductService) → cache (UnboundedCache, 200 MB)
      productId (Long, 8 byte)
   Local variables (frame 1):
      ...
```

→ 그 스레드의 활성 frame 안 변수가 누수 후보 캐시를 retain 하고 있다. 시점 일치.

#### 4. 결론 도출

> Thread "http-nio-8081-exec-3" 이 RUNNABLE 상태로 UnboundedCache.put() 을 실행 중이며,
> 그 캐시는 Dominator Tree 1위로 750MB 차지.
> ProductService.cache 필드가 unbounded ConcurrentHashMap 으로 영구 누적 중.

이 한 문장이 면접 답변의 정수.

### #3 동시성 plan 으로 위임할 디테일

본 토픽에서는 thread state(RUNNABLE/BLOCKED/WAITING/TIMED_WAITING/PARKED) 의 의미, 데드락 패턴 분석, lock 분석은 **다루지 않는다**. 이는 #3 동시성 plan Phase 2 의 영역. 본 절은 "두 덤프를 어떻게 같이 보는가" 의 메타 절차에 집중.

---

## 8. 흔한 누수 패턴 + MAT 식별법

### 패턴 1 — Unbounded Cache

MAT 시그널:
```
java.util.concurrent.ConcurrentHashMap$Node[]   (큰 retained heap)
   <-- HashMap.table
      <-- ProductService.cache
```

해법: Caffeine `maximumSize` 설정 또는 TTL.

### 패턴 2 — ThreadLocal

MAT 시그널:
```
java.lang.ThreadLocal$ThreadLocalMap$Entry[]
   value: HeavyObject (큰 retained heap)
```

각 스레드마다 ThreadLocalMap → entry 가 누적.

해법: try/finally 안에서 `tl.remove()`.

### 패턴 3 — Listener 미등록 해제

MAT 시그널:
```
java.util.ArrayList   (커짐)
   <-- EventBus.listeners
      element: 옛 SubscriberImpl@0xABCD (이미 죽어야 할 객체)
```

해법: unsubscribe 또는 WeakReference 사용.

### 패턴 4 — Static Collection

MAT 시그널: GC Root 가 static field 로 끝남.

```
Path to GC Roots:
   ConcurrentHashMap (750 MB)
      <-- com.kgd.cache.GlobalCache.INSTANCE (static field)
```

해법: 명시적 eviction 또는 static 제거.

### 패턴 5 — ClassLoader Leak

MAT 시그널:
```
ClassLoader 가 비정상적으로 많음 (보통 1-2개여야)
각 ClassLoader 가 retain 하는 클래스 + Metaspace 큼
```

MAT 의 Group By ClassLoader → 동일 클래스가 여러 loader 에 로딩됨 → leak.

---

## 9. msa 컨텍스트

### 자동 dump 활성화 (운영 권장)

```kotlin
// commerce.jib-convention.gradle.kts 추가안
jvmFlags += listOf(
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
)
```

### K8s PVC

```yaml
volumeMounts:
  - name: jvm-dumps
    mountPath: /var/log/jvm
volumes:
  - name: jvm-dumps
    persistentVolumeClaim:
      claimName: jvm-heapdump-pvc   # ReadWriteMany 또는 노드별 ReadWriteOnce
```

### 사이드카로 dump 서비스

운영 시 직접 jcmd 보다는 **on-demand dump 사이드카** 가 안전:

```yaml
- name: heap-dump-sidecar
  image: openjdk:25
  command: ["sh", "-c", "while true; do sleep 3600; done"]
  # ad-hoc: kubectl exec sidecar -- jcmd <pid> GC.heap_dump /shared/heap.hprof
```

또는 Spring Boot Actuator `/actuator/heapdump` 엔드포인트 (JDK 11+ secured).

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "Heap dump = 운영에서 못 씀" | STW 5초~분 동안 잠깐. 미리 트래픽 빼면 OK |
| "Histogram 큰 클래스 = 누수" | 보통 byte[]/String 이 큼. 누가 retain 하는지가 중요 |
| "Leak Suspects 가 100% 정답" | 자동 추천. 검증 필수 |
| "MAT 인덱스 = 덤프와 같은 크기" | 보통 절반~비슷. 디스크 여유 필요 |
| "Live-only dump = 누수 못 잡음" | 누수는 살아있는 객체이므로 OK. 오히려 작아서 분석 빠름 |
| "Heap dump 만 보면 OOM 원인 다 알 수 있다" | 데드락/무한 루프 패턴엔 Thread Dump 조합 필요 |

---

## 다음 학습

- **#3 동시성 plan Phase 2** — Thread Dump 정밀 분석 (BLOCKED 패턴, 데드락, lock contention)
- [12-oom-five-types.md](12-oom-five-types.md) — OOM 메시지 종류와 dump 의 활용
- [15-lab-heap-dump-mat.md](15-lab-heap-dump-mat.md) — OOM 의도 재현 + MAT 실습
