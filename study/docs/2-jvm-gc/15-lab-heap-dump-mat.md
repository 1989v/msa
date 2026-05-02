---
parent: 2-jvm-gc
seq: 15
title: Lab 2 — Heap Dump + MAT (의도적 OOM 재현)
type: lab
created: 2026-05-01
---

# Lab 2. Heap Dump + MAT

## 목표

의도적으로 누수 시나리오를 만들어 OOM 을 재현 → heap dump 채취 → Eclipse MAT 의 Leak Suspects / Dominator Tree / Path to GC Roots 로 원인 추적. **누수 진단 절차** 를 몸에 붙인다.

## 소요 시간

3-4h (시나리오 구현 60m + 재현 30m + 분석 90m + 정리 30m)

---

## 준비물

- Lab 1 환경 (k3d + product 서비스)
- Eclipse MAT 설치 (`brew install --cask mat` 또는 다운로드)
- 충분한 디스크 (2-4GB heap dump 용)

---

## 단계 1. 누수 컨트롤러 추가 (개발용 별도 브랜치 권장)

`product/app/src/main/kotlin/com/kgd/product/lab/LabLeakController.kt`:

```kotlin
package com.kgd.product.lab

import org.springframework.context.annotation.Profile
import org.springframework.web.bind.annotation.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Lab 전용. 운영 profile 에서는 활성화 X.
 */
@Profile("lab")
@RestController
@RequestMapping("/lab/leak")
class LabLeakController {

    // 패턴 1 — Unbounded Cache
    private val cache = ConcurrentHashMap<String, ByteArray>()

    @PostMapping("/cache")
    fun addToCache(@RequestParam id: String) {
        // 1MB 짜리 더미 데이터를 키마다 저장 — eviction 없음
        cache[id] = ByteArray(1024 * 1024)
    }

    @GetMapping("/cache/size")
    fun cacheSize() = mapOf("size" to cache.size, "estimatedMB" to cache.size)

    // 패턴 2 — ThreadLocal 누수
    private val tl = ThreadLocal<ByteArray>()

    @GetMapping("/threadlocal")
    fun threadLocalSet() {
        tl.set(ByteArray(512 * 1024))
        // 의도적으로 tl.remove() 안 함
        // Tomcat 이 같은 스레드 재사용 → 누적
    }

    // 패턴 3 — Static 컬렉션
    companion object {
        private val staticList = mutableListOf<ByteArray>()
    }

    @PostMapping("/static")
    fun addToStatic() {
        staticList.add(ByteArray(2 * 1024 * 1024))
    }
}
```

### 활성화

```yaml
# k8s/overlays/lab/patches/profile.yaml (별도 overlay)
env:
  - name: SPRING_PROFILES_ACTIVE
    value: "kubernetes,lab"
```

또는 deployment 의 env 임시 변경:
```bash
kubectl set env -n commerce deployment/product SPRING_PROFILES_ACTIVE=kubernetes,lab
```

### 작은 힙으로 빠른 OOM

```bash
kubectl set env -n commerce deployment/product JAVA_TOOL_OPTIONS="-Xmx256m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/jvm/"
```

---

## 단계 2. 누수 트리거 + OOM 재현

### 시나리오 A — Unbounded Cache

```bash
for i in $(seq 1 500); do
  curl -X POST "http://localhost:30081/lab/leak/cache?id=$i"
done
```

500MB 누적 → 256MB 힙으로는 도중에 OOM:

```bash
kubectl logs -n commerce product-xxx --previous
# ...
# java.lang.OutOfMemoryError: Java heap space
# Dumping heap to /var/log/jvm/heapdump-2026-05-01_12-34-56.hprof ...
```

### 시나리오 B — ThreadLocal

```bash
# Tomcat 스레드 풀이 200 정도라 200번 호출하면 거의 채움
for i in $(seq 1 300); do
  curl "http://localhost:30081/lab/leak/threadlocal" &
done
```

각 스레드가 512KB 보유 → 200 × 0.5MB = 100MB ThreadLocal 누수.

### 시나리오 C — Static 컬렉션

```bash
for i in $(seq 1 200); do
  curl -X POST "http://localhost:30081/lab/leak/static"
done
```

200 × 2MB = 400MB → OOM.

---

## 단계 3. Heap Dump 추출

### OOM 발생 시 자동 dump

`-XX:+HeapDumpOnOutOfMemoryError` 가 켜져있으면 OOM 시점에 자동 저장.

```bash
kubectl exec -n commerce product-xxx -- ls -lh /var/log/jvm/
# heapdump-2026-05-01_12-34-56.hprof  (200 MB)

kubectl cp commerce/product-xxx:/var/log/jvm/heapdump-...hprof ./heap.hprof
```

### Live dump (운영 시뮬레이션)

OOM 안 나도 정기 점검용:

```bash
# Pod 안에서
kubectl exec -n commerce product-xxx -- jcmd 1 GC.heap_dump /var/log/jvm/heap-live.hprof

kubectl cp commerce/product-xxx:/var/log/jvm/heap-live.hprof ./heap-live.hprof
```

---

## 단계 4. MAT 분석

### 4.1. 인덱스 빌드

MAT 실행 → File → Open Heap Dump → heap.hprof.
인덱싱 1-3분 (200MB 덤프 기준).

### 4.2. Leak Suspects Report

자동 팝업 → Yes:

```
Problem Suspect 1
  One instance of "java.util.concurrent.ConcurrentHashMap" 
  loaded by "jdk.internal.loader.ClassLoaders$AppClassLoader"
  occupies 209,715,200 (95.21%) bytes.
  
  Keywords:
    com.kgd.product.lab.LabLeakController
    java.util.concurrent.ConcurrentHashMap
```

→ LabLeakController 의 ConcurrentHashMap 이 95% 차지. 정답.

### 4.3. Dominator Tree

상위 10개 큰 retained heap:

```
   Class Name                                      Retained Heap   %
   java.util.concurrent.ConcurrentHashMap$Node[]   200 MB          95%
   ...
```

Node[] 우클릭 → Path to GC Roots → exclude weak/soft references:

```
ConcurrentHashMap$Node[] 200MB
   <-- ConcurrentHashMap.table
      <-- LabLeakController.cache (instance field)
         <-- DefaultListableBeanFactory ... (Spring container)
            <-- GC Root (Static field of ApplicationContext)
```

→ LabLeakController.cache 필드가 strong reference 로 GC root 까지 도달. 회수 불가능.

### 4.4. Histogram 으로 검증

```
Class Name              Objects    Shallow    Retained
byte[]                      200    200 MB     200 MB
ConcurrentHashMap$Node      200      6 KB     201 MB
ConcurrentHashMap             1     <1 KB     201 MB
```

200 개 byte[] = 200MB. cache 사이즈와 일치.

### 4.5. ThreadLocal 누수 분석 (시나리오 B)

같은 절차 + Group By → java.lang.ThreadLocal$ThreadLocalMap$Entry:

```
   Thread "http-nio-8081-exec-3" 
   Retained Heap: 1 MB
      └── ThreadLocalMap$Entry → ByteArray (512 KB)
   
   Thread "http-nio-8081-exec-4"
   Retained Heap: 1 MB
      └── ThreadLocalMap$Entry → ByteArray (512 KB)
   
   ... (200개 스레드)
```

각 스레드가 ThreadLocal value 를 retain. Tomcat 스레드 풀 재사용 → 영구 누수.

---

## 단계 5. OQL 활용

```sql
-- 1MB 이상 byte[] 모두
SELECT * FROM byte[] b WHERE b.@length > 1000000

-- ConcurrentHashMap 중 사이즈 100+ 인 것 (의심 캐시)
SELECT toString(m), m.size FROM java.util.concurrent.ConcurrentHashMap m WHERE m.size > 100

-- ThreadLocal value 가 ByteArray 인 entry
SELECT t, t.value FROM java.lang.ThreadLocal$ThreadLocalMap$Entry t 
WHERE t.value implements byte[]
```

---

## 단계 6. 면접 답변용 정리

### 스토리

> "운영에서 product 서비스가 시간이 지나면서 OOM 으로 재시작되는 패턴을 발견했습니다.
>
> 1. **GC 로그** 에서 Old 점유율이 우상향 → 누수 의심.
> 2. **`-XX:+HeapDumpOnOutOfMemoryError`** 로 OOM 시점 자동 dump 채취.
> 3. **MAT Leak Suspects** 가 ConcurrentHashMap 1개가 95% 차지한다고 지적.
> 4. **Dominator Tree** 와 **Path to GC Roots** 로 LabLeakController.cache 필드까지 추적.
> 5. **원인**: 캐시에 eviction 정책 없음 → Caffeine maximumSize + expireAfterWrite 적용으로 해결.
>
> Heap dump 분석은 한 번 해보면 다음부터 길이 보입니다."

### 차트 (스크린샷)

- MAT Dominator Tree 화면
- Path to GC Roots 그래프
- 누적 메모리 timeline (Prometheus)

---

## 단계 7. Thread Dump 조합 진단 (보너스)

OOM 직전 Thread Dump 도 채취:

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 Thread.print > thread-before-oom.txt
```

분석 (#3 동시성 plan Phase 2 의 영역):

```
"http-nio-8081-exec-3" #45 daemon prio=5 RUNNABLE
   at com.kgd.product.lab.LabLeakController.addToCache(LabLeakController.kt:21)
   at jdk.internal.reflect.GeneratedMethodAccessor...
```

→ 그 시점에 누수 코드를 실제로 실행 중인 스레드 확인. Heap Dump 의 retained heap 분석과 cross-check.

---

## 단계 8. 정리

```bash
# Lab profile 비활성
kubectl set env -n commerce deployment/product SPRING_PROFILES_ACTIVE=kubernetes
kubectl set env -n commerce deployment/product JAVA_TOOL_OPTIONS-

# LabLeakController 코드 제거 (또는 lab 브랜치 분리)
git checkout main  # lab 브랜치는 머지하지 않음
```

---

## 함정 / 흔한 실수

| 함정 | 대응 |
|---|---|
| Heap dump 가 너무 커서 MAT 가 OOM | MAT 의 -Xmx 조정 (mat.ini), 또는 live=true dump |
| Spring 의 모든 빈이 GC root 로 보여 길 찾기 어려움 | Path to GC Roots → Exclude weak/soft references |
| Leak Suspects 가 false positive | Dominator Tree + 직접 Path to GC Roots 검증 |
| ThreadLocal 누수가 안 보임 | Tomcat 스레드 풀이 작아서 재사용 안 됨 → 부하 충분히 |
| 운영 OOM 인데 dump 가 안 남음 | HeapDumpPath 디스크 부족, 권한 문제 — pre-flight 검증 |

---

## 다음 학습

- [13-heap-dump-mat.md](13-heap-dump-mat.md) — MAT 깊은 사용법
- [12-oom-five-types.md](12-oom-five-types.md) — 메시지 종류별 진단
- [16-lab-jfr-jmc.md](16-lab-jfr-jmc.md) — JFR 로 비OOM 상황의 hot allocation 추적
