---
parent: 2-jvm-gc
seq: 23
title: G1GC 튜닝 Cookbook — 9개 시나리오 (디폴트 / Heap / Young / Old / back-to-back / Allocation Burst / System.gc / OS sys time)
type: deep
created: 2026-05-01
---

# 23. G1GC 튜닝 Cookbook

## TL;DR

본 파일은 Oracle 의 [Garbage-First Garbage Collector Tuning](https://docs.oracle.com/en/java/javase/21/gctuning/garbage-first-g1-garbage-collector1.html) 공식 가이드를 9개 실전 시나리오로 풀어쓴 cookbook 이다. 06번 (G1 (Garbage-First Collector) 상세) 이 알고리즘 / 자료구조 중심이라면, 본 파일은 **"증상이 보이면 무엇을 만지나"** 의 의사결정 트리. 모든 케이스에 (1) 증상 → (2) 진단 query → (3) 튜닝 옵션 → (4) 검증 방법 → (5) 트레이드오프 5단계로 정리. msa 의 1Gi limit / 70% MaxRAMPercentage 환경을 디폴트 가정으로 한다.

```
   증상 인식 ──→ 진단(GC 로그/NMT/JFR) ──→ 옵션 변경 ──→ 검증 ──→ 트레이드오프 수용 여부
     ▲                                                              │
     └──────────────────────────────────────────────────────────────┘
                  변경 후 측정 → 다시 증상 보면 다른 시나리오
```

> 본 파일에서 다루지 않는 것: ZGC 튜닝(7번), Heap Dump 분석(13번), JFR 사용(16번), Native Memory Leak(11번), 메모리 산정 표(19번). 위 9개 시나리오 외 옵션은 06번 / Oracle 공식 docs 참조.

---

## 0. 사용 전제

### 0.1 측정 없이는 튜닝하지 않는다

모든 시나리오는 **GC 로그가 있다는 전제**. 09번 / 18번 의 다음 옵션 먼저 켜고 30분 부하 데이터 확보:

```kotlin
"-Xlog:gc*,gc+heap=info,gc+age=info,safepoint=warning:time,uptime,level,tags",
"-XX:+HeapDumpOnOutOfMemoryError",
"-XX:NativeMemoryTracking=summary",
```

### 0.2 한 번에 한 옵션만 바꾼다

옵션 두 개를 동시에 바꾸면 어떤 게 효과 / 어떤 게 부작용인지 구분 불가. **A/B 변경 → 30분 부하 → 측정 → 다음 옵션** 순서 강제.

### 0.3 변경 적용 위치 (msa)

본 파일의 옵션 예시는 다음 두 곳에 적용 가능:
- **빌드 시**: `buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts` 의 `jvmFlags`
- **런타임**: K8s deployment 의 env `JAVA_TOOL_OPTIONS`

운영 안정성: jib-convention. 트러블슈팅 임시: env. 18번 파일 참조.

---

## 1. 시나리오 1 — G1GC 디폴트 옵션 + 기본 튜닝 가이드

### 1.1 OpenJDK 21 / 25 의 G1 디폴트 (참고용)

| 옵션 | 디폴트 | 의미 |
|---|---|---|
| `-XX:+UseG1GC` | 활성 (JDK 9+) | G1 사용 |
| `-XX:MaxGCPauseMillis` | **200** | pause 목표 |
| `-XX:G1HeapRegionSize` | heap/2048, 1MB~32MB | region 크기 자동 |
| `-XX:G1NewSizePercent` | **5** / `-XX:G1MaxNewSizePercent` **60** | Young 비율 동적 |
| `-XX:InitiatingHeapOccupancyPercent` | **45** | concurrent mark 시작 점유율 (IHOP) |
| `-XX:G1MixedGCLiveThresholdPercent` | **85** | Mixed GC 대상 region live 한도 |
| `-XX:G1HeapWastePercent` | **5** | Mixed GC 종료 조건 |
| `-XX:G1ReservePercent` | **10** | promotion 실패 방지 reserve |
| `-XX:G1MixedGCCountTarget` | **8** | Mixed GC 분산 목표 횟수 |
| `-XX:ParallelGCThreads` | CPU 의존 / `-XX:ConcGCThreads` Parallel/4 | STW / concurrent 워커 |
| `-XX:MaxTenuringThreshold` | **15** | promotion age 상한 |

JDK 25 에서도 위 디폴트는 동일. 큰 변경은 generational ZGC (JDK 21+) 쪽.

### 1.2 디폴트로 안 되는 전형적 케이스

- 1Gi 미만 컨테이너 + burst — Young 5% 시작이라 작아서 GC 빈발
- 10GB+ 큰 힙 + latency 민감 — 200 ms 가 길게 느껴짐
- 동적 클래스 로딩 많음 — IHOP 45% 가 늦어 Old full
- Humongous 잦은 코드 — region size 자동 산정이 작아 임계 낮음

### 1.3 권장 시작점 (msa 일반 API)

```kotlin
"-XX:+UseG1GC",
"-XX:MaxGCPauseMillis=200",                  // 디폴트 명시
"-XX:InitiatingHeapOccupancyPercent=40",     // 45 → 40 (Mixed GC 더 일찍)
"-XX:G1ReservePercent=15",                   // 10 → 15 (promotion 실패 방어)
"-XX:+ParallelRefProcEnabled",               // JDK 21+ 디폴트지만 명시
```

`MaxGCPauseMillis` 는 보통 안 만지는 게 맞다 — 너무 작게 잡으면 Young 작아져 throughput / promotion 폭증. 200 → 100 변경은 측정 후에만.

### 1.4 트레이드오프 / 검증

- IHOP ↓ → Mixed GC 자주 → CPU ↑, Old footprint ↓
- ReservePercent ↑ → 사용 가능 힙 ↓, evacuation failure ↓

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.flags | grep -E "G1|Pause|Reserve|IHOP"
```

→ 22 카드 Q1.

---

## 2. 시나리오 2 — Heap size 조정 (G1)

### 2.1 설계 원칙

Oracle 공식 권장: 컨테이너에서는 **`-Xms`/`-Xmx` 절대값 대신 `-XX:MaxRAMPercentage`**, 그리고 **Xms == Xmx (Initial == Max)** 로 고정. 이유: G1 은 Xms 에서 시작해 Xmx 까지 확장하는데 확장 시 Full GC 비슷한 비용 발생.

### 2.2 컨테이너 환경 권장 패턴

```kotlin
"-XX:+UseContainerSupport",
"-XX:MaxRAMPercentage=70.0",
"-XX:InitialRAMPercentage=70.0",   // Initial == Max
```

`InitialRAMPercentage` 를 Max 와 같게 잡아도 page 는 lazy allocation. 진짜 미리 잡으려면 시나리오 9 의 `+AlwaysPreTouch` 와 조합.

### 2.3 Heap 부족 신호

```
[gc] To-space exhausted              ← 핵심 키워드
[gc] Evacuation Failure
[gc] Pause Full (G1 Compaction) 850ms
```

원인: Survivor/Old 로 promote 할 free region 부족, Allocation rate >> Old reclaim.

### 2.4 늘리는 방법

| 옵션 | 변경 | 비고 |
|---|---|---|
| **A. limit 자체 증가** | k8s memory limit 1Gi → 2Gi | `MaxRAMPercentage=70` 이면 자동 추적. 가장 안전 |
| **B. native 영역 축소** | `MaxRAMPercentage 70→75` + `MaxMetaspaceSize 256m→192m` | gateway 같은 라우터만. 일반 API 는 OOMKilled 위험 |
| **C. ReservePercent 조정** | `G1ReservePercent=15` (10→15) | 작은 힙(<4GB) 에서 evacuation failure 방어 |

### 2.5 Heap 이 너무 큰 경우

큰 힙(16GB+) 은 RSet 비용 ↑ + pause ↑. region 개수 줄이기:

```kotlin
"-XX:G1HeapRegionSize=16m",   // region 개수 1024 정도로
```

### 2.6 검증

```bash
kubectl exec product-xxx -- jcmd 1 VM.flags | grep -E "MaxHeap|InitialHeap|HeapRegion"
kubectl logs product-xxx | grep -i "to-space\|evacuation failure"   # 없으면 OK
```

### 2.7 트레이드오프

| 변경 | + | - |
|---|---|---|
| limit 증가 | 안전, 단순 | 비용, 노드 수용량 |
| MaxRAMPercentage ↑ | 비용 0 | OOMKilled 위험 |
| ReservePercent ↑ | evacuation failure ↓ | 사용 가능 힙 ↓ |
| Initial == Max | 확장 비용 0 | 부팅 RSS 즉시 max |

---

## 3. 시나리오 3 — Young generation 이 G1 의 핵심인 이유

### 3.1 왜 핵심인가

**Pause time 의 80%+ 가 Young GC 에서 발생**한다. Mixed GC 도 본질적으로 "Young + 일부 Old" 라서 Young evacuation 시간이 그대로 들어감. 즉:

- Young 사이즈 = pause time
- Young 효율 = throughput
- Young 실패 = evacuation failure → Full GC 까지

### 3.2 약한 세대 가설 + Copy GC 효율

대부분 객체는 일찍 죽는다 (90~98%). Eden region 100MB → Young GC 시 살아있는 1~5MB 만 Survivor copy → 나머지 95~99MB region 통째 free. **죽은 객체는 만지지 않음** — sweep 비용 0.

### 3.3 Old 가 Young 보다 비싼 이유

- Old GC = 살아있는 비율 30~80% → 거의 전부를 만져야
- Mark / Compact 비용 ↑ + RSet 갱신
- → G1 의 모든 트릭은 **"Young 에서 죽이고, Old 로 promote 안 시키기"**

### 3.4 Young size 트레이드오프

| Young size | + | - |
|---|---|---|
| 작음 (5%) | pause 짧음 | GC 빈발 → throughput ↓, promotion 폭증 |
| 큼 (60%) | GC 드묾, throughput ↑ | pause 길어짐, promotion 압박 |

G1 이 `MaxGCPauseMillis` 에 맞춰 5%~60% 범위 자동 조정.

### 3.5 면접 답변

> "G1 은 모든 GC 가 사실상 Young evacuation 으로 시작합니다. Pause time 의 dominant factor 가 Young 이고, 약한 세대 가설로 99% 가 Young 에서 죽기 때문에 Young 의 사이즈/효율이 G1 전체 성능을 결정합니다. Old 는 Mixed 로 incremental 하게 돌아 직접 부담이 작은 반면, Young 이 잘못 잡히면 promotion 폭증 + 빈도 ↑로 Full GC 까지 갈 수 있습니다."

→ 22 카드 Q-NEW-1.

---

## 4. 시나리오 4 — Young 수집 시간이 목표치 초과

### 4.1 증상

```
[gc] Pause Young (Normal) (G1 Evacuation Pause) 800M->100M(1024M) 280ms
                                                                    ↑↑↑↑↑
                                                           MaxGCPauseMillis=200 초과
```

목표 200ms 인데 실측 280ms 가 자주 보인다. P99 > target.

### 4.2 진단

phase 별 분해 (`Evacuate Collection Set` 이 보통 dominant):
- `Pre Evacuate Collection Set` (RSet update)
- `Merge Heap Roots`
- `Evacuate Collection Set` ← copy 실제
- `Post Evacuate`, `Other`

```bash
grep "Pause Young" gc.log | awk '{print $NF}' | sort -n | tail -20
```

### 4.3 원인별 옵션

| 원인 | 옵션 | 메커니즘 |
|---|---|---|
| **A. CSet 큼 (Young 큼)** | `-XX:G1MaxNewSizePercent=40` (60→40), `-XX:MaxGCPauseMillis=150` | pacing 이 Young 자동 ↓ |
| **B. 워커 부족** | `-XX:ParallelGCThreads=8` | K8s `limits.cpu: 500m` 면 자동값 작아짐 — CPU limit 도 같이 |
| **C. RSet 비용** | `-XX:G1ConcRefinementThreads=8`, `-XX:+G1SummarizeRSetStats` 로 진단 | refinement 워커 ↑ |
| **D. To-space exhausted** | `-XX:G1ReservePercent=20`, `-XX:MaxTenuringThreshold=10` | Survivor 압박 해소 |
| **E. Humongous 잦음** | `-XX:G1HeapRegionSize=8m` (2→8) | humongous 임계 ↑. 또는 코드 수정 (`findAll()` → pagination) |

`MaxGCPauseMillis` 줄이면 G1 pacing 이 Young eden region 수 줄임. **GC 빈도 ↑ 트레이드오프**.

### 4.4 검증

```bash
grep "Pause Young" gc.log | awk '{print $NF+0}' | sort -n | \
  awk 'BEGIN{c=0} {a[c++]=$1} END {print "P99:", a[int(c*0.99)]}'
```

목표: P99 < MaxGCPauseMillis × 1.2.

### 4.5 트레이드오프

- MaxGCPauseMillis ↓ → pause ↓, throughput ↓, promotion 압박 ↑
- ParallelGCThreads ↑ → CPU 비용 ↑, K8s CPU limit 충돌 가능

---

## 5. 시나리오 5 — Old 수집 시간이 목표치 초과

### 5.1 증상

```
[gc] Pause Young (Mixed) (G1 Evacuation Pause) 1024M->600M(2048M) 350ms
                            ↑↑↑↑↑                                   ↑↑↑↑↑
                            Mixed                                   초과
```

또는 Concurrent Mark Cycle 중 Remark / Cleanup 의 STW phase 가 길다:

```
[gc] Pause Remark 1024M->1024M(2048M) 80ms     ← 보통 < 10ms 가 정상
```

### 5.2 진단

```bash
# Mixed GC pause 분포
grep "Pause Young (Mixed)" gc.log | awk '{print $NF}'

# Remark / Cleanup
grep -E "Pause Remark|Pause Cleanup" gc.log | awk '{print $NF}'

# Concurrent Mark 사이클 길이
grep "Concurrent Mark Cycle" gc.log
```

### 5.3 원인별 옵션

| 원인 | 옵션 | 비고 |
|---|---|---|
| **A. 한 Mixed 가 너무 많은 Old region** | `-XX:G1MixedGCCountTarget=16` (8→16), `-XX:G1OldCSetRegionThresholdPercent=5` | 더 많이 분산 → 1회 부담 ↓ |
| **B. live 임계 높음 (live 많은 region 까지 청소)** | `-XX:G1MixedGCLiveThresholdPercent=65` (85→65) | garbage 많은 region 만 청소. Old reclaim 속도 ↓ — IHOP 같이 조정 |
| **C. Concurrent Mark 늦음 → Remark 길어짐** | `-XX:ConcGCThreads=4`, `-XX:InitiatingHeapOccupancyPercent=35` | mark 일찍 시작 + 워커 ↑ |
| **D. Reference 처리 병목 (WeakRef 많음)** | `-XX:+ParallelRefProcEnabled` | JDK 21+ default. JDK 17 미만 명시 |

### 5.4 검증

```bash
# Mixed GC 가 8~16회로 골고루 분산
grep "Pause Young (Mixed)" gc.log | wc -l

# Old regions 톱니파 (우상향이면 못 따라잡는 상태)
grep "Old regions:" gc.log | awk '{print $3}' | tail -100
```

### 5.5 트레이드오프

- G1MixedGCCountTarget ↑ → 1회 부담 ↓, 전체 사이클 길어짐
- LiveThresholdPercent ↓ → 효율 ↑, Old reclaim ↓
- IHOP ↓ → Mark 자주, CPU ↑

---

## 6. 시나리오 6 — back-to-back GC

### 6.1 증상

GC 가 **종료 직후 또는 매우 짧은 간격으로** 다시 발생.

```
[12.345s] GC(42) Pause Young 25ms
[12.380s] GC(43) Pause Young 28ms     ← 35ms 만에 또
[12.420s] GC(44) Pause Young 30ms     ← 40ms 만에 또
[12.460s] GC(45) Pause Young 32ms     ← 40ms 만에 또
```

또는 GCEasy 의 "GC Frequency" 가 **수백 ms 단위**로 표시.

### 6.2 의미

mutator 가 거의 일을 못 하고 GC 만 돌고 있음. **Throughput 폭락** (보통 < 90%). Allocation rate 가 reclaim 속도 못 따라가는 상태. 방치하면 → `GC overhead limit exceeded` OOM (98% CPU 가 GC 인데 회수가 2% 미만).

### 6.3 진단

```bash
# GC 간격 (1초 미만이면 위험)
grep "Pause Young" gc.log | awk -F'[][]' '{print $2}' | \
  awk 'NR>1 {print $1-prev} {prev=$1}' | sort -n | head -20
```

GCEasy 의 Throughput 이 < 95% 면 의심.

### 6.4 원인별 옵션

| 원인 | 옵션 | 비고 |
|---|---|---|
| **A. Heap 부족** (가장 흔함) | `MaxRAMPercentage=80` 또는 K8s limit ↑ | 첫 의심. 누수 가능성 함께 검토 |
| **B. Allocation burst** | → 시나리오 7 | |
| **C. Old full + Mixed 못 따라잡음** | `IHOP=30`, `LiveThresholdPercent=90`, `MixedGCCountTarget=4` | Mark 더 일찍 + 더 많이 청소 + 더 빨리 정리 |
| **D. Promotion 폭증** | `MaxTenuringThreshold=8` (15→8), `G1ReservePercent=20` | Survivor 정체 풀기 |
| **E. 메모리 누수** | 옵션 변경은 미봉책 — Heap Dump (13번) | GC 후 Old 점유율 우상향 |

### 6.5 검증

```bash
# GC 간격 톱니파, throughput > 95%
grep "Pause Young" gc.log | awk -F'[][]' '{print $2}' | \
  awk 'NR>1 {print $1-prev} {prev=$1}' | sort -n | tail -20
```

### 6.6 트레이드오프

- Heap ↑: 단순하고 효과적, 비용 ↑
- IHOP ↓ + LiveThreshold ↑: CPU ↑
- 누수면 옵션 변경은 미봉책 — 코드 수정 필수

---

## 7. 시나리오 7 — 객체 생성 속도 폭증으로 Full GC

### 7.1 증상

```
[gc] Allocation Rate: 1500 MB/s   ← 평소 200 MB/s 의 7배
[gc] GC(N) Pause Young (Concurrent Start) ...
[gc] GC(N) To-space exhausted     ← evacuation failure
[gc] GC(N+1) Pause Full (G1 Compaction Pause) 2048M->1800M(2048M) 1200ms
```

Full GC 발생 → STW 1초+. 트래픽 burst / batch 작업 시작 / 메모리 폭주 코드 등에 의해 G1 의 incremental 정리가 못 따라감.

### 7.2 진단

```bash
# JFR allocation hotspot
jcmd 1 JFR.start name=alloc settings=profile maxage=2m
# 2분 후
jcmd 1 JFR.dump name=alloc filename=alloc.jfr
# JMC: "TLAB Allocations" / "Outside TLAB"
```

GCEasy 의 "Object Creation Rate" 섹션. Eden region 사용량 × region_size / GC 간격.

### 7.3 원인별 대응

| 대응 | 옵션 / 변경 | 비고 |
|---|---|---|
| **A. 코드 (가장 효과적)** | `findAll()` → pagination, 큰 List → chunk, String.format 루프 → StringBuilder, N+1 → JOIN | JFR allocation hotspot 으로 직접 확인 |
| **B. Eden 키워서 burst 흡수** | `G1NewSizePercent=20` (5→20), `G1MaxNewSizePercent=80` (60→80) | Young pause ↑ trade |
| **C. IHOP 보수적** | `IHOP=30` | Mark 가 burst 와 경합 안 하게 |
| **D. Reserve 확보** | `G1ReservePercent=20` | evacuation failure 방어 |
| **E. Heap 자체 ↑** | K8s limit 1Gi → 3Gi | burst 일시적이면 가장 단순 |
| **F. ParallelGCThreads ↑** | `ParallelGCThreads=8` | reclaim rate ↑ (CPU 가용 시) |
| **G. Rate limiting** | Resilience4j, K8s HPA, Kafka concurrency | JVM 튜닝의 한계 — burst 자체 완화 |

### 7.4 검증

```bash
grep "Pause Full" gc.log | wc -l   # 부하 30분 동안 0 이 정상
```

### 7.5 트레이드오프

- G1NewSizePercent ↑ → Young pause ↑
- Heap / ParallelGCThreads ↑ → 비용 ↑
- Code 수정 → 작업량 ↑, 효과 가장 크고 지속적

---

## 8. 시나리오 8 — System.gc() 로 인한 Full GC

### 8.1 증상

```
[gc] GC(42) Pause Full (System.gc()) 1024M->800M(2048M) 600ms
                       ↑↑↑↑↑↑↑↑↑↑↑
                       명시적 호출
```

원인: 누군가 `System.gc()` 또는 `Runtime.getRuntime().gc()` 를 호출. **Full GC 가 강제로 발생** → 600ms+ STW.

### 8.2 호출 주체 (자주 의심)

- 라이브러리 (오래된 NIO 코드, DirectByteBuffer 정리)
- RMI distributed GC (`-Dsun.rmi.dgc.server.gcInterval` 으로 1시간 주기 호출)
- 내부 코드 (악의 또는 무지)
- JMX / 모니터링 도구가 트리거
- 디버그 코드 남음

### 8.3 진단

```bash
grep "System.gc()" gc.log | wc -l

# 호출 stack — JFR
jcmd 1 JFR.start name=sysgc settings=default maxage=1h
# 1시간 후 dump → JMC 에서 "jdk.SystemGC" 이벤트 → 호출 stack
```

### 8.4 옵션 대응

| 옵션 | 동작 | 권장 |
|---|---|---|
| `-XX:+ExplicitGCInvokesConcurrent` | `System.gc()` → G1 concurrent mark cycle 로 변환. STW 거의 없음 | **운영 default** |
| `-XX:+DisableExplicitGC` | `System.gc()` no-op | NIO DirectBuffer 정리 의존 시 native 누수 risk |
| `-Dsun.rmi.dgc.server.gcInterval=86400000` | RMI distributed GC 주기 1h → 24h | RMI 사용 시만 |

### 8.5 코드 측 — ArchUnit 으로 차단

```kotlin
@Test
fun `production code must not call System#gc`() {
    noClasses().that().resideInAPackage("com.kgd..")
        .should().callMethod(System::class.java, "gc")
        .check(allClasses)
}
```

### 8.6 검증

```bash
grep "System.gc()" gc.log | wc -l
# DisableExplicitGC: 0
# ExplicitGCInvokesConcurrent: log 표시되지만 Concurrent Mark 분류
```

→ msa 는 RMI 안 쓰지만 **DirectBuffer 사용 (Netty / Kafka client) 있어 ExplicitGCInvokesConcurrent 가 안전한 default**. 18번 jib-convention 추가 후보.

→ 22 카드 Q-NEW-2.

---

## 9. 시나리오 9 — OS system time 이 클 때

### 9.1 증상

GC 로그의 `User/Sys/Real` 라인:

```
[gc,cpu] GC(42) User=0.10s Sys=0.30s Real=0.05s
                          ↑↑↑↑↑↑↑↑
                          Sys 가 User 보다 큼
```

**Sys >> User** 는 비정상. OS kernel 작업이 GC 시간의 대부분 — 디스크 IO, swap, page fault, NUMA migration 등.

또는 `safepoint` 로그의 `Time to Reach Safepoint` 가 큼:

```
[safepoint] Total time for which application threads were stopped: 0.005s
            Stopping threads took: 0.150s     ← safepoint sync 이 길다
```

### 9.2 자주 보이는 원인

| 원인 | 정황 |
|---|---|
| Memory swap | 노드 메모리 압박, Linux 의 swap 발생 |
| Page faults | huge anon page 미사용, lazy alloc page in 비용 |
| NUMA migration | 멀티 소켓 노드, JVM 이 다른 NUMA node 의 메모리 접근 |
| Disk IO 경합 | GC 로그 디스크 / heap dump 디스크 / 같은 디스크의 batch job |
| JIT 컴파일 burst | C2 compile 이 sys time 잡아먹음 |
| Transparent Huge Pages defrag | THP khugepaged 가 컨테이너 메모리 압축 시도 |

### 9.3 진단

```bash
# 호스트의 swap 사용
kubectl exec -n commerce product-xxx -- cat /proc/meminfo | grep -i swap
# SwapTotal: 0 이 정상 (K8s 노드는 보통 swap off)

# Page fault
kubectl exec -n commerce product-xxx -- cat /proc/1/status | grep -i fault

# THP
cat /sys/kernel/mm/transparent_hugepage/enabled
# [always] madvise never  → always 면 의심

# NUMA
numactl --hardware
# 멀티 노드면 jvm 의 NUMA 정렬 검토
```

### 9.4 옵션 대응

| 옵션 | 동작 | 트레이드오프 |
|---|---|---|
| **A. `-XX:+AlwaysPreTouch`** | 부팅 시 모든 heap page touch → runtime lazy page-in 없음 | 부팅 시간 ↑ (큰 힙은 수십 초). readinessProbe 로 흡수 |
| **B. `-XX:+UseLargePages` + `LargePageSizeInBytes=2m`** | 페이지 4KB→2MB → TLB miss ↓ | 노드 sysctl + `hugepages-2Mi` K8s resource 필요 |
| **C. THP off** (`echo never > /sys/kernel/mm/transparent_hugepage/enabled`) | THP defrag 비용 제거 | 일반 워크로드는 THP 가 도움 — 측정 필수 |
| **D. `-XX:+UseNUMA`** + `numactl --membind=0` | NUMA migration ↓ | G1 부분 지원. ParallelGC 가 더 잘 동작 |
| **E. `-XX:CICompilerCount=2`** | JIT compiler 스레드 ↓ → burst 완화 | 소형 컨테이너 한정 |
| **F. 디스크 IO 분리** | GC log / heap dump 를 NVMe / tmpfs 로 | tmpfs 는 큰 dump 시 OOM risk |

K8s hugepages 예시:

```yaml
resources:
  limits:
    hugepages-2Mi: 1Gi
```

### 9.5 검증

```bash
# Sys vs User 비율 (Sys > User 가 0회면 정상)
grep "User=" gc.log | awk -F'[= ]' '{print $2, $4}' | \
  awk '{if ($2 > $1) over++} END {print "Sys-heavy count:", over}'
```

→ 22 카드 Q-NEW-3.

---

## 10. 의사결정 트리 (요약)

```
GC 로그 보고 어디로 가야 하나?

  [Pause time 초과?]
    Young 만 → 시나리오 4
    Mixed / Remark → 시나리오 5

  [GC 간격 짧음, throughput < 95%]
    → 시나리오 6 (back-to-back)
       └ Allocation rate 폭증? → 시나리오 7 (full GC 위험)

  [Full GC 발생?]
    Cause = "System.gc()" → 시나리오 8
    Cause = "Allocation Failure" / "To-space exhausted" → 시나리오 7
    Cause = "Metadata GC Threshold" → MaxMetaspaceSize 늘려야 (12번)

  [GC 로그의 Sys >> User]
    → 시나리오 9 (OS system time)

  [힙 부족 / OOM]
    → 시나리오 2 (heap size) + Heap Dump (13번)

  [Young 의 동작이 헷갈림]
    → 시나리오 3 (Young 핵심 이유) — 학습용

  [전체 옵션 다시 보고 싶음]
    → 시나리오 1 (디폴트 + 권장 시작점)
```

---

## 11. msa 적용: jib-convention 에 권장 추가

기존 21번의 P0 변경안에 본 cookbook 결론을 반영하면:

```kotlin
// commerce.jib-convention.gradle.kts 추가 권장
jvmFlags = listOf(
    // 기존 (18번 / 21번 참조)
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=70.0",
    "-XX:InitialRAMPercentage=70.0",            // [시나리오 2] heap 확장 비용 회피
    "-XX:MaxMetaspaceSize=256m",
    "-XX:ReservedCodeCacheSize=128m",
    "-XX:MaxDirectMemorySize=64m",
    "-Djava.security.egd=file:/dev/./urandom",

    // GC 명시 + 디폴트 강화 [시나리오 1]
    "-XX:+UseG1GC",
    "-XX:MaxGCPauseMillis=200",
    "-XX:InitiatingHeapOccupancyPercent=40",    // 45 → 40
    "-XX:G1ReservePercent=15",                  // 10 → 15

    // System.gc() 안전 처리 [시나리오 8]
    "-XX:+ExplicitGCInvokesConcurrent",         // Full GC 회피, NIO 호환

    // 진단
    "-Xlog:gc*,gc+heap=info,gc+age=info,safepoint=warning:time,uptime,level,tags",
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
    "-XX:+ExitOnOutOfMemoryError",
    "-XX:NativeMemoryTracking=summary",
)
```

**의도적으로 안 넣은 옵션** (시나리오별 측정 후 추가):

| 옵션 | 보류 이유 |
|---|---|
| `+AlwaysPreTouch` | 부팅 시간 trade. K8s readinessProbe 와 조합 검토 필요. quant 에 한정 검토. |
| `+UseLargePages` | 노드 sysctl + DaemonSet 필요. quant / latency 민감 서비스 한정. |
| `+UseNUMA` | G1 부분 지원. 멀티소켓 노드 환경에서만 의미. |
| `+DisableExplicitGC` | NIO DirectBuffer 호환성 risk. ExplicitGCInvokesConcurrent 로 충분. |
| `G1NewSizePercent=20` | 코드 burst 패턴 측정 후 결정. |

---

## 12. cross-reference

- 06번 (G1GC 상세) — 알고리즘 / RSet / SATB / Region
- 09번 (GC 로그) — 로그 형식 / GCEasy
- 14번 (Lab 1) — G1 / ZGC / Parallel 비교 부하 실측
- 18번 (msa Jib config) — jvmFlags 적용 위치
- 19번 (K8s 메모리) — Heap size 산정 표
- 21번 (개선 후보) — ADR-0028 초안 (본 파일 시나리오 8/9 반영 후보)
- 22번 (면접 Q&A) — 본 파일에서 카드 3개 추가:
  - Q-NEW-1: Young 이 G1 에서 핵심인 이유 (시나리오 3)
  - Q-NEW-2: System.gc() 처리 옵션 차이 (시나리오 8)
  - Q-NEW-3: GC 의 Sys time 이 큰 경우 진단 (시나리오 9)

→ Oracle 공식: [HotSpot Virtual Machine Garbage Collection Tuning Guide — JDK 21](https://docs.oracle.com/en/java/javase/21/gctuning/)

---

## 13. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "MaxGCPauseMillis 만 줄이면 latency 좋아짐" | Young 작아져 GC 빈도 ↑, throughput ↓, promotion 폭증. 측정 후 결정 |
| "System.gc() 무시하면 NIO 메모리 누수" | DisableExplicitGC 만 그렇다. ExplicitGCInvokesConcurrent 는 호환 |
| "back-to-back GC = heap 부족" | 부족 / 누수 / Old reclaim 못 따라감 / promotion 폭증 — 4 가지 다른 원인 |
| "Sys time 크면 무조건 swap" | THP / NUMA / 디스크 IO / JIT burst 도 원인 — meminfo / numa 같이 |
| "AlwaysPreTouch 가 무조건 좋다" | 부팅 시간 vs runtime 안정성 trade. K8s 환경에선 readinessProbe 와 조합 |
| "G1ReservePercent 늘리면 손해" | 작은 힙(<4GB) 에선 evacuation failure 방어로 효과 큼 |
| "Full GC 가 Mixed GC" | Mixed = Young + 일부 Old (CSet). Full = 전체 STW Compact. 완전 다름 |

---

## 14. 다음 학습

- [22-interview-qa.md](22-interview-qa.md) — 본 파일 Q-NEW-1/2/3 카드 회독
- [21-improvements.md](21-improvements.md) — 본 파일 결론을 ADR-0028 에 반영
- [14-lab-gc-log.md](14-lab-gc-log.md) — 시나리오 4/5/6/7 을 부하 실측으로 재현
