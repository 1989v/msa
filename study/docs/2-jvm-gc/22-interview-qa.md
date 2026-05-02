---
parent: 2-jvm-gc
seq: 22
title: 면접 Q&A — JVM/GC 50문항 + 꼬리 질문 + 함정
type: qa
created: 2026-05-01
---

# 22. 면접 Q&A

## 사용법

- 6 영역 × 8문항 = **48 카드** + 함정 4 = **52** (50문항 목표 초과)
- 각 카드: Q → 1줄 정답 → 꼬리 질문 1-2 단계 → 함정/오해
- 회독: 학습 종료 후 1주일 간격 2회 권장
- 굵은 표시 = 면접에서 자주 나오는 단골

---

## 영역 1: 메모리 영역 + 할당

### Q1. **JVM 메모리 영역 5가지 말해보세요**

**A**: Heap, Metaspace, Stack(스레드별), PC Register, Native Memory(Direct Buffer / Code Cache / GC Internal).

- Q-1: PermGen 과 Metaspace 차이?
  - Heap 안 → Native 로 위치 이동, 한도 무제한이 default, GC 트리거 다름
- Q-2: PC Register 의 실무 의미?
  - 거의 없음. 면접 단골 5가지 채우는 자리
- 함정: Stack 도 GC 대상이라고 답하면 X (메서드 종료 시 자동 pop)

### Q2. 객체 할당 흐름 설명해보세요

**A**: TLAB(스레드 로컬) → Eden → 살아남으면 Survivor 0/1 (from/to swap) → age 도달 시 Old.

- Q-1: TLAB 가 왜 필요?
  - 힙 동시 할당 시 lock 경쟁 회피. bump-pointer 한 줄 → Lock-free
- Q-2: 큰 객체는?
  - G1 region 50% 초과 = Humongous → Old 직행

### Q3. **TLAB 동작 원리?**

**A**: 각 스레드가 Eden 안의 작은 영역(TLAB)을 미리 할당받아 그 안에서 bump-pointer로 객체 할당. 동기화 없이 빠름.

- Q-1: TLAB 가 다 차면?
  - 새 TLAB 받거나, 큰 객체면 Eden 직접 할당 (slow path)
- 함정: TLAB 크기가 고정이라고 답하면 X. ResizeTLAB 가 동적 조정

### Q4. Survivor 가 2개인 이유?

**A**: Copying GC 는 from/to 두 영역 필요. 매 Minor GC 마다 swap.

- Q-1: 둘 다 비어있으면?
  - 정상. from→to copy 후 from 이 비워짐
- Q-2: 둘 다 차면?
  - 일부가 Old 로 premature promotion → 튜닝 신호

### Q5. age / TenuringThreshold?

**A**: 객체가 Minor GC 살아남을 때마다 +1. MaxTenuringThreshold (G1 기본 15) 도달 시 Old 로 promote.

- Q-1: TargetSurvivorRatio 는?
  - Survivor 의 X% 가 차면 threshold 보다 일찍 promote (동적)

### Q6. Heap 의 Young/Old 비율?

**A**: Parallel/Serial 은 1:2 (`NewRatio=2`). G1/ZGC 는 region 기반이라 동적.

- Q-1: G1 에서 Young 사이즈 어떻게 결정?
  - `MaxGCPauseMillis` 목표 + region pacing 으로 동적

### Q7. **컨테이너 환경의 Xmx 설정?**

**A**: 절대값 (`-Xmx1g`) 보다 비율 (`-XX:MaxRAMPercentage=70`) 권장. limit 변경 시 자동 추적.

- Q-1: 75 가 default 보다 안전한가?
  - 1Gi limit 에서는 빠듯. native 영역 합치면 OOMKilled. 70 권장
- 함정: limit = 힙 크기로 답하면 X. native 포함

### Q8. Direct Buffer 와 -Xmx?

**A**: Direct Buffer 는 off-heap. `-XX:MaxDirectMemorySize` 별도 한도 (미지정 시 default = Xmx).

- Q-1: Netty 사용 서비스에서 왜 위험?
  - leak 시 Xmx 만큼 추가 가능 → 컨테이너 RSS 폭증

---

## 영역 2: GC 알고리즘 + 도달성

### Q9. **GC 가 객체 살아있다고 판단하는 기준?**

**A**: GC Root 에서 도달 가능한가 (Reachability 분석). 참조 카운트가 아님.

- Q-1: GC Root 종류?
  - 활성 스레드 스택 변수, static 필드, JNI handle, synchronized monitor, 시스템 ClassLoader 등
- Q-2: 순환 참조도 GC 됨?
  - 도달 가능성 기반이라 cycle 도 GC. C++/Python(refcount) 과 차이

### Q10. Mark-Sweep / Compact / Copy 차이?

**A**: 
- Sweep: 죽은 자리 free list → 단편화
- Compact: 살아있는 거 한쪽으로 압축 → 비싸지만 단편화 0
- Copy: 다른 영역에 살아있는 거 복사 → 빠르지만 공간 2배

- Q-1: 왜 Young 은 Copy?
  - 살아있는 비율 < 5% → 복사 비용 작고 효과 큼
- Q-2: Old 가 Mark-Compact 인 이유?
  - 살아있는 비율 높음 → Copy 면 거의 다 옮겨야 → 단편화 해결만 함

### Q11. 약한 세대 가설?

**A**: "대부분 객체는 일찍 죽는다." 측정상 90~98%. 그래서 Young 을 빠른 Copy GC 로 자주 처리.

- Q-1: 가설이 깨지는 워크로드?
  - 큰 캐시, in-memory store, object pool — 객체가 안 죽음

### Q12. **WeakReference vs SoftReference 차이?**

**A**:
- Weak: 다음 GC 시 무조건 회수
- Soft: 메모리 부족할 때만 회수 (대략 OOM 직전)

- Q-1: WeakHashMap 활용 사례?
  - 키가 외부에서 GC 되면 자동 entry 제거 — ThreadLocal 누수 방지
- 함정: Weak 가 메모리 부족시 회수 라고 답하면 X (그건 Soft)

### Q13. PhantomReference 용도?

**A**: 객체 GC 후 알림 → finalize 대체 자원 정리. `Cleaner` API 가 내부 구현.

- Q-1: get() 이 항상 null 인 이유?
  - 회수 시점만 알려주면 됨. 객체 부활(resurrection) 방지

### Q14. finalize() 사용해도 되나요?

**A**: JDK 9 deprecated, JDK 18 removable. 호출 보장 없음. AutoCloseable + Cleaner 사용.

### Q15. STW 와 Safepoint?

**A**: GC 의 일부 phase 에서 모든 mutator 정지. 안전하게 정지할 수 있는 지점(safepoint) 이 있어야 가능.

- Q-1: Safepoint 못 도달하는 스레드 영향?
  - 모든 스레드 기다려야 → safepoint sync time 길어짐

### Q16. Throughput vs Latency 트레이드오프?

**A**: Total GC Time = Frequency × Duration. Throughput 우선 = Duration 길게, Latency 우선 = Duration 짧게 (concurrent + barrier 비용).

- Q-1: 측정 단위?
  - Throughput = 1 - (GC time / total time), 보통 99%+
  - Latency = single STW pause, P99

---

## 영역 3: 현대 GC (G1/ZGC/Shenandoah)

### Q17. **G1 GC 의 핵심 아이디어?**

**A**: 힙을 region 으로 쪼개고 garbage 가장 많은 region 부터 회수. predictable pause time.

- Q-1: region 크기?
  - 힙 / 2048, 1MB ~ 32MB. `-XX:G1HeapRegionSize`
- Q-2: Mixed GC 가 뭔가요?
  - Young + 일부 Old region 을 한 사이클에 evacuate. incremental Old 정리

### Q18. Remembered Set 의 역할?

**A**: 각 region 의 RSet 이 "이 region 을 참조하는 외부 region 들의 카드 위치" 기록 → Young GC 시 Old 전체 스캔 회피.

- Q-1: write barrier 와의 관계?
  - JIT 가 모든 reference write 에 card dirty 마킹 코드 삽입 → refinement thread 가 RSet 갱신
- Q-2: RSet 비용?
  - 메모리 5-10%, CPU 별도 thread

### Q19. Humongous Object?

**A**: G1 region 50% 이상 크기 객체. Eden 우회 → 연속 빈 region 들에 직접, Old 로 분류.

- Q-1: 위험점?
  - 단편화 → Full GC, padding 낭비, Old 직행으로 Mixed GC 유발
- Q-2: 대응?
  - region 크기 ↑, 코드에서 큰 List/byte[] 분할

### Q20. SATB?

**A**: Snapshot-At-The-Beginning. Concurrent Mark 시작 시점의 그래프를 snapshot 으로 보존. mutator 가 끊는 참조를 write barrier 가 큐에 보관.

- Q-1: 부작용?
  - floating garbage (snapshot 시 살아있던 게 끝나도 한 사이클 더 살아남음)

### Q21. **ZGC 의 Colored Pointer?**

**A**: 64-bit 포인터 상위 비트에 GC 상태 (Marked0/Marked1/Remapped) 박음. multi-mapping 으로 같은 메모리를 여러 가상주소로 접근.

- Q-1: Compressed Oops 와의 관계?
  - 압축 oops = 32-bit 포인터 → 색 정보 자리 없음 → ZGC 사용 시 자동 비활성. 객체당 +4 byte
- Q-2: 작은 힙 (4GB 미만) 에서 ZGC 가 불리한 이유?
  - oops 손실로 footprint ↑

### Q22. Load Barrier?

**A**: 모든 reference read 시 짧은 가드 코드 — 색이 옛것이면 새 주소로 redirect + self-healing.

- Q-1: G1 의 SATB write barrier 와 차이?
  - G1: write 시점 / ZGC: read 시점. ZGC 는 floating garbage 없음

### Q23. **G1 vs ZGC 언제 쓰나?**

**A**: 
- G1: 일반 서비스 (4GB ~ 수십 GB), pause 200ms 충분, default
- ZGC: 큰 힙 (8GB+), sub-ms pause 필요, latency 절대 우선

- Q-1: 작은 힙에서 ZGC 가 불리한 이유?
  - oops 손실 + concurrent thread 자원 + RSet 없는 대신 forwarding metadata
- Q-2: 트레이드오프?
  - ZGC: throughput ~10% 손실 + footprint ↑

### Q24. Shenandoah?

**A**: Red Hat OpenJDK 발 저지연 GC. Brooks Pointer (객체 헤더 앞 8 byte forwarding ptr). ZGC 와 비슷한 목표지만 Compressed Oops 호환.

- Q-1: Oracle JDK 에 있나?
  - 없음. Red Hat / Temurin / Adoptium / OpenJDK 본가만
- Q-2: ZGC vs Shenandoah 선택?
  - 큰 힙 + < 1ms → ZGC, 작은 힙 + Oops 유지 → Shenandoah

---

## 영역 4: 진단 (GC 로그 / Heap Dump / NMT / OOM)

### Q25. **GC 로그 어떻게 분석하시나요?**

**A**: `-Xlog:gc*:file=gc.log` 로 수집 → GCEasy 업로드 → 5지표 확인:
1. Pause Time (P99)
2. Throughput (99%+)
3. Allocation Rate
4. Promotion Rate
5. Old 점유율 추이

- Q-1: 우상향 패턴은?
  - Old 가 GC 후에도 안 줄면 누수 의심 → MAT
- Q-2: Full GC 가 보이면?
  - 튜닝 실패 신호. IHOP 낮추거나 region size 조정

### Q26. **OOM 5종류?**

**A**:
1. Java heap space — 힙 부족
2. Metaspace — 클래스 메타
3. GC overhead limit exceeded — GC 가 일하는데 진척 없음
4. Direct buffer memory — off-heap
5. unable to create native thread — OS 스레드

- Q-1: 메시지 별 진단 다른가요?
  - 완전 다름. heap 은 MAT, Metaspace 는 ClassLoader, native thread 는 ulimit / ExecutorService
- Q-2: OOMKilled 는 어디?
  - 5종류에 안 들어감. OS / cgroup 이 죽임. JVM 안에서 메시지 안 보임

### Q27. Heap Dump 채취 방법?

**A**: `jcmd <pid> GC.heap_dump /path/heap.hprof` 또는 `-XX:+HeapDumpOnOutOfMemoryError` 자동.

- Q-1: 운영 영향?
  - STW 동반. 큰 힙은 분~십분. 트래픽 빼고 채취 권장
- Q-2: live=true 차이?
  - GC 한번 돌리고 살아있는 것만 dump. 작아짐

### Q28. **MAT 의 핵심 도구 3개?**

**A**:
1. Leak Suspects Report — 자동 누수 후보
2. Dominator Tree — Retained Heap 큰 객체
3. Path to GC Roots — 누수 경로 추적

- Q-1: Histogram 의 의미?
  - 클래스별 인스턴스 수 + 사이즈. byte[]/String 큰 게 보통이라 retained heap 으로 전환
- Q-2: OQL ?
  - SQL 비슷한 객체 쿼리. 수동 검증 강력

### Q29. Heap Dump + Thread Dump 조합 진단?

**A**: 
1. 동시 채취 (jcmd Thread.print + GC.heap_dump 같은 시점)
2. Thread Dump 의 의심 스레드 stack
3. Heap Dump 의 Thread Overview 에서 같은 스레드의 retain 객체
4. 두 정보 cross-check 으로 정확한 원인

- Q-1: 왜 둘 다 필요?
  - Heap Dump 만 → 데드락 / 무한 루프 못 봄. Thread Dump 만 → 어느 객체 retain 안 보임
- Q-2: 상세 thread state 분석은?
  - #3 동시성의 영역. 본 토픽은 cross-check 절차만

### Q30. NMT?

**A**: Native Memory Tracking. JVM 내장. `-XX:NativeMemoryTracking=summary` 켜고 `jcmd <pid> VM.native_memory summary` 조회.

- Q-1: 영역?
  - Java Heap, Class(Metaspace), Thread, Code, GC, Compiler, Internal, Symbol 등
- Q-2: OOMKilled 진단?
  - baseline → 시간 후 summary.diff 로 어느 영역이 늘었는지 추적

### Q31. JFR vs jstack vs JProfiler?

**A**:
- JFR: 영향 < 1%, 운영 always-on, 종합 (GC + allocation + lock + method sample)
- jstack: snapshot, 영향 0%, thread state 만
- JProfiler: 5-20% 영향, 깊지만 운영 risky

- Q-1: 운영 권장?
  - JFR continuous + jstack ad-hoc

### Q32. JFR 의 Custom Event?

**A**: Event 클래스 정의 → begin/commit. 비즈니스 milestone 을 GC/CPU 와 같은 timeline 에서 분석 가능.

```kotlin
@Name("Order")
class OrderEvent : Event() {
    @Label("Order ID") var orderId: Long = 0
}
```

---

## 영역 5: JIT / 성능 / 튜닝

### Q33. C1 vs C2?

**A**: 
- C1 (Client): 빠른 컴파일, 가벼운 최적화
- C2 (Server): 느린 컴파일, 깊은 최적화 (inlining, escape analysis, vectorization)
- Tiered: 0(인터프리터) → 1/2/3 (C1) → 4 (C2) 단계적

### Q34. **Inlining?**

**A**: 작은 메서드를 호출지에 펼쳐 넣음. 호출 비용 제거 + 추가 최적화 기회.

- Q-1: 한도?
  - 메서드 35 byte 바이트코드, 깊이 9
- Q-2: virtual call 도 inline?
  - CHA 가 단일 구현체 (monomorphic) 일 때만. 3+ 구현 = megamorphic = vtable lookup

### Q35. **Escape Analysis?**

**A**: 객체가 메서드를 escape 안 하면 힙 할당 생략하고 스택/레지스터로 분해 (scalar replacement).

- Q-1: JMH 로 검증?
  - `-prof gc` 의 `gc.alloc.rate.norm` 이 0 B/op 면 할당 0
- Q-2: 한계?
  - Inlining 선행 필요. 모든 메서드 적용 X

### Q36. Code Cache 부족하면?

**A**: 가득 차면 JIT 멈춤 → 인터프리터 폴백 → 큰 성능 저하. `-XX:ReservedCodeCacheSize` 증가.

### Q37. Deoptimization?

**A**: C2 가정 (예: monomorphic) 깨지면 인터프리터로 되돌림. 새 클래스 로드 등이 트리거.

- Q-1: 잦으면?
  - 성능 저하. PrintCompilation 으로 추적

### Q38. JVM Warm-up?

**A**: 부팅 직후 인터프리터 → C1 → C2 단계적. 처음 1000~10000 요청은 느림.

- Q-1: K8s 시사점?
  - readinessProbe initialDelaySeconds 로 트래픽 차단. 새 pod scale-out 시 cold 영향
- Q-2: 단축 방법?
  - AppCDS, AOT (Project Leyden, JDK 25), self-warm-up 호출

### Q39. JMH 의 함정?

**A**: 4가지: JIT warmup 미반영 / DCE / Constant Folding / OSR. JMH 가 fork + Blackhole + warmup iteration 으로 회피.

- Q-1: 측정 단위?
  - Throughput (ops/s) / AverageTime / SampleTime / SingleShotTime
- Q-2: -prof 옵션?
  - gc / perfasm / stack — 각각 GC 영향, native 어셈블리, stack sample

### Q40. **GC 튜닝 실제 해본 스토리?**

**A**: (자기 경험으로 답변. 없으면 lab 결과로)

> "msa 의 product 서비스에서 G1 default 가 P99 200ms 였는데, 트레이딩성 서비스(quant)는 그게 거래에 직접 영향이라 ZGC 검토했습니다. Lab 환경에서 비교 측정: ZGC 가 P99 < 1ms, throughput 8% 손실. quant 에는 채택, 일반 API 는 G1 유지."

---

## 영역 6: 컨테이너 / 운영

### Q41. **컨테이너 메모리 limit 과 JVM 힙?**

**A**: limit = RSS 한도 = 힙 + 모든 native. 힙은 70% 정도 (`MaxRAMPercentage=70`), 30% 가 native (Metaspace, Thread, Code, Direct, GC Internal).

- Q-1: 75 가 default 인데 70 권장?
  - 1Gi limit 에선 native 250MB 빠듯. 30% (300MB) 가 안전
- Q-2: 절대값 (-Xmx) 권장?
  - X. limit 변경 시 안 따라감. 비율 권장

### Q42. **OOMKilled 진단 절차?**

**A**:
1. JVM 안에 OOM 메시지 있나? 있으면 5종류 분류
2. 없으면 (Exit 137) → cgroup memory limit 초과
3. NMT diff 로 어느 영역이 늘었는지
4. heap 정상 + native ↑ → leak detector / Metaspace / Thread

### Q43. ExitOnOutOfMemoryError 권장 이유?

**A**: OOM 후 JVM 일관성 깨짐 가능 (좀비 상태). 즉시 종료 → K8s 재시작.

- Q-1: CrashOn~ 와 차이?
  - Crash: SIGABRT + core dump. 디버깅 풍부, 디스크 부담
  - Exit: 깔끔. 운영 권장

### Q44. K8s readinessProbe 와 JVM warm-up?

**A**: warm-up 끝나기 전 트래픽 받으면 P99 폭증. initialDelaySeconds 로 충분히 기다리고 readiness 응답.

### Q45. PVC vs emptyDir for heap dump?

**A**: 
- emptyDir: 컨테이너 lifecycle. 재시작 시 dump 사라짐
- PVC: 영구. 장애 후에도 보존. 운영 권장

### Q46. JFR continuous 영향?

**A**: settings=default 면 < 1%. settings=profile 은 1-2%. 운영 default 권장.

### Q47. 컨테이너 안에서 jcmd?

**A**: 같은 user (1000) 만 가능. JDK image 안에 jcmd 포함 — `kubectl exec ... -- jcmd 1 ...`.

- Q-1: 1 이 PID?
  - 컨테이너 PID namespace 에서 JVM 이 PID 1

### Q48. Spring Boot Actuator + JVM 메트릭?

**A**: `actuator/prometheus` 로 jvm_memory / jvm_gc / jvm_threads / jvm_buffer 자동 노출. ServiceMonitor 로 자동 수집.

- Q-1: 핵심 알람?
  - container RSS > 90% limit, Old 무한 증가, Metaspace 누수, Full GC 발생 등 8개

---

## 함정 모음 (오답 단골)

### 함정 1. "OOM = 힙 부족"

5종류가 있고 OOMKilled 는 별개. 진단 방향이 다름.

### 함정 2. "JVM 메모리 = -Xmx"

Metaspace, Code Cache, Direct, Thread Stack 등 native 영역 전부. RSS 가 보통 1.5~2배.

### 함정 3. "MaxGCPauseMillis 작게 하면 latency 좋아짐"

Young 이 작아져 GC 빈도 ↑, throughput ↓. 너무 작게 잡으면 역효과.

### 함정 4. "ZGC 가 모든 면에서 G1 보다 우월"

작은 힙(<4GB) 에선 footprint 손해. throughput 5-10% 손실. 일반 서비스는 G1 default 가 보통 더 효율.

---

## 시스템 설계 연결 질문 1: 메모리 사용량 급증 서비스 설계

**Q**: 트래픽 급증 시 메모리 사용량이 폭증하는 서비스를 어떻게 설계하시겠습니까?

**A 골자**:
1. 할당 패턴 분석 (JFR allocation hotspot)
2. Streaming / pagination 으로 단발 큰 객체 회피
3. Cache TTL + maxSize (Caffeine)
4. Object pool 검토 (단 객체 escape 방지)
5. JVM 옵션: G1 default, MaxRAMPercentage 보수적, 자동 dump
6. K8s: HPA (CPU 기반 + 메모리 보조), PDB, requests=limits (Guaranteed)
7. 모니터링: Old 추이 / Allocation rate / RSS 알람
8. 부하 테스트: JMH + k6 로 회귀 측정

---

## 시스템 설계 연결 질문 2: 트레이딩 서비스의 JVM 설계

**Q**: 거래 latency 가 직접 매출에 영향. JVM 어떻게 설계?

**A 골자**:
1. ZGC Generational (JDK 21+) — sub-ms pause
2. 큰 힙 (4GB+) — ZGC sweet spot, oops 손실 흡수
3. UseLargePages — TLB miss ↓
4. JFR continuous + 정밀 알람
5. K8s Guaranteed pod, dedicated node (taint/toleration)
6. NUMA 인식 (멀티 소켓 노드)
7. JIT pre-warmup (synthetic traffic on start)
8. Object pool 신중 (lock contention vs allocation pressure trade)

---

## 회독 가이드

### 1차 회독 (학습 종료 직후)

48 카드 모두. 답이 막히는 카드 표시.

### 2차 회독 (1주 후)

표시 카드만. 함정 4개 + 시스템 설계 2개 추가 학습.

### 3차 회독 (이직/면접 1주 전)

전체 + Lab 결과 (1, 2, 3, 4) 의 자기 데이터 답변 가능하게 정리.

---

## 다음 학습

- [00-preview.md](00-preview.md) — 전체 토픽 회로
- 다른 plan: #3 동시성 (스레드 dump 정밀 분석), #4 분산 시스템 등
