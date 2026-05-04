---
parent: 2-jvm-gc
seq: 99
title: JVM 내부 + GC 개념 카탈로그 — Full-Coverage Index + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://docs.oracle.com/en/java/javase/21/docs/specs/
  - https://docs.oracle.com/en/java/javase/21/gctuning/
  - https://docs.oracle.com/en/java/javase/21/vm/java-virtual-machine-technology-overview.html
  - https://openjdk.org/jeps/
---

# 99. JVM + GC 개념 카탈로그

> **목적** — 2-jvm-gc 의 22+ deep file 매트릭스 + OpenJDK 공식 (Oracle docs / JEP) 기준 빠진 영역을 발굴.
>
> **소스 기준** — Oracle JavaSE Specs / GC Tuning Guide / JEP (JDK Enhancement Proposals).

---

## 0. 사용법

`19-search-engine/99-concept-catalog.md` §0 와 동일. 상태: ✅ / 🟡 / ★ / skip.

---

## 1. 기존 커버 매트릭스 (요약)

| 카테고리 | 핵심 개념 | 다룬 영역 |
|---|---|---|
| Heap 구조 | Heap / Metaspace / TLAB / Humongous | ✅ 다수 deep |
| GC 알고리즘 | Mark-Sweep / Mark-Compact / G1 / ZGC / Shenandoah | ✅ |
| GC 로그 | JDK 21~25 로그 포맷, G1 로그 읽기 | ✅ |
| 도구 | JFR (Java Flight Recorder, 자바 비행 기록) / NMT (Native Memory Tracking, 네이티브 메모리 추적) / Heap dump / MAT (Eclipse Memory Analyzer) | ✅ |
| 진단 | OOM 종류, GC root, 도달성 분석 | ✅ |
| 컴파일러 | JIT (Just-In-Time, 즉시 컴파일) layer | 🟡 부분 |
| msa 시나리오 | G1 디폴트 옵션, jib-convention 권장 | ✅ |

### 1-A. 갭 진단 (OpenJDK 공식 트리 기준)

1. **JEP/JDK release 별 변화** — JDK 21 LTS 이후 (JDK 22, 23, 24, 25) 의 GC 변화 (Generational ZGC, Compact Object Headers 등)
2. **CRaC** (Coordinated Restore at Checkpoint) — startup latency 축소
3. **Project Leyden** — AOT (Ahead-Of-Time) JVM, AppCDS 진화
4. **Project Loom** — Virtual Threads / Structured Concurrency / Scoped Values (#3 와 cross)
5. **Project Valhalla** — Value Types / Primitive Classes
6. **Project Panama** — FFI (Foreign Function & Memory) / Vector API
7. **Project Lilliput** — Compact Object Headers
8. **Class Data Sharing (CDS / AppCDS / Dynamic CDS)** — startup 가속
9. **String deduplication** (G1) — heap 절감
10. **JFR streaming + custom events** — observability 강화
11. **Native Memory Tracking 단계별 (summary/detail)** vs **`-XX:+PrintNMTStatistics`**
12. **Compressed OOPs** — heap < 32GB 의 함정
13. **Escape Analysis + Scalar Replacement** — JIT 의 alloc 절약
14. **C1/C2 compiler tier + Graal JIT**
15. **Class loader / Module system (JPMS)** — Metaspace 와 직결
16. **Container awareness** (`-XX:+UseContainerSupport`, cgroup v2) — k8s 에서 결정적
17. **JVM ergonomics** — heap/CPU 자동 결정
18. **Safepoint / TTSP (Time-To-Safepoint)** 분석
19. **Allocation profiling** (JFR `jdk.ObjectAllocationInNewTLAB`)
20. **GC pause SLO + Tail latency** 측정 표준
21. **MaxRAMPercentage / InitialRAMPercentage** — container 환경 표준

---

## 2. 카테고리별 개념 트리

### A. JVM 메모리 모델

| 개념 | 정의 | 링크 | 상태 |
|---|---|---|---|
| Heap (Young / Old) | 객체 할당 + GC 대상 | docs/javase/21/vm | ✅ 커버 |
| Metaspace | 클래스 메타 (PermGen 후속) | gctuning/metaspace | ✅ 커버 |
| Code Cache | JIT 컴파일 코드 | vm/code-cache | 🟡 부분 |
| TLAB | thread-local 할당 버퍼 | gctuning/tlab | ✅ 커버 |
| Humongous Object | G1 region 의 50% 초과 객체 | gctuning/humongous | ✅ 커버 |
| Compressed OOPs | 32GB heap 미만 시 4-byte 오프셋 | vm/coops | ★ 신규 |
| Compact Object Headers (Lilliput) | 객체 헤더 16→8 byte | jeps/Lilliput | ★ 신규 |
| Direct Buffer | NIO off-heap | docs/nio | 🟡 부분 |
| Native memory (NMT) | non-Java 메모리 추적 | gctuning/NMT | ✅ 커버 |
| Stack / PC / Native stack | 스레드 별 영역 | vm/runtime | 🟡 부분 |

### B. GC 알고리즘

| GC | 특징 | 링크 | 상태 |
|---|---|---|---|
| Serial | single thread | gctuning/serial | 🟡 부분 |
| Parallel | throughput-focused | gctuning/parallel | 🟡 부분 |
| G1 (Garbage-First) | region + concurrent + parallel — JDK default | gctuning/g1 | ✅ 커버 |
| **ZGC (Generational, JDK 21+)** | sub-ms pause + generational (heap 수십 TB) | jeps/Generational-ZGC | ★ 신규 |
| Shenandoah | concurrent compaction (Brooks Pointer) | gctuning/shenandoah | ✅ 커버 |
| Epsilon | no-op (벤치) | gctuning/epsilon | ★ 신규 |

### C. GC 핵심 메커니즘

| 개념 | 정의 | 상태 |
|---|---|---|
| Mark / Sweep / Compact | 표시·청소·압축 phase | ✅ |
| Reachability / GC Root | 살아있는 객체 판단 | ✅ |
| Remember Set / Card Table | cross-generation 참조 추적 | 🟡 |
| Write Barrier (G1/ZGC) | 색칠/추적용 instrumentation | 🟡 |
| Brooks Pointer (Shenandoah) | concurrent compaction 의 indirection | ✅ |
| Colored Pointer (ZGC) | pointer 비트로 mark/relocate 표시 | ✅ |
| Concurrent vs STW (Stop-The-World, 전체 정지) | mutator 와 동시 vs 정지 | ✅ |
| Safepoint / TTSP | mutator 멈출 수 있는 지점 | ★ 신규 |
| Allocation profiling | TLAB outside / inside | ★ 신규 |

### D. JIT / 컴파일

| 개념 | 정의 | 상태 |
|---|---|---|
| Interpreter | bytecode 직접 실행 | ✅ |
| C1 / C2 compiler | Tier 1~4 | 🟡 |
| **Graal JIT** | C2 대체 옵션 | ★ 신규 |
| Tiered Compilation | warm-up 정책 | 🟡 |
| Inlining / Escape Analysis / Scalar Replacement | JIT 핵심 최적화 | 🟡 |
| Deoptimization | speculative 실패 시 | 🟡 |
| **CRaC** (Coordinated Restore at Checkpoint) | warm-up 회피 — checkpoint 복원 | ★ 신규 |
| **Project Leyden** | AOT JVM | ★ 신규 |
| **CDS / AppCDS / Dynamic CDS** | Class Data Sharing — startup 가속 | ★ 신규 |

### E. 동시성·언어 진화 (#3 cross)

| Project | 핵심 | 상태 |
|---|---|---|
| **Loom** (Virtual Threads, JDK 21 GA) | M:N 스케줄링, blocking I/O 친화 | 🟡 (#3 일부) |
| **Structured Concurrency** (preview) | scope 기반 자식 task 관리 | ★ 신규 |
| **Scoped Values** (preview) | ThreadLocal 후속 — virtual thread 친화 | ★ 신규 |
| **Valhalla** (Value Types) | identityless 값 타입 | ★ 신규 |
| **Panama** (FFI / Vector API) | 외부 함수 + SIMD | ★ 신규 |

### F. 도구 / 진단

| 도구 | 역할 | 상태 |
|---|---|---|
| JFR | 저비용 프로파일링 + custom event | ✅ |
| jcmd | 명령 채널 | ✅ |
| NMT | native memory 분석 | ✅ |
| Heap dump + MAT | OOM 분석 | ✅ |
| Async-profiler | flame graph + perf events | 🟡 |
| jstat / jmap (legacy) | 간단 모니터링 | 🟡 |
| GC log (Unified Logging, JDK 9+) | `-Xlog:gc*` 표준 | ✅ |
| **JFR streaming + remote** | 실시간 분석 | ★ 신규 |
| **JEP 405 Record patterns / pattern matching for switch** | 디버깅 자체와 무관하나 코드 | skip |

### G. 운영 / 컨테이너

| 개념 | 정의 | 상태 |
|---|---|---|
| `-XX:+UseContainerSupport` (default on) | cgroup-aware | 🟡 |
| **MaxRAMPercentage / InitialRAMPercentage** | container heap 결정 표준 | ★ 신규 |
| `ActiveProcessorCount` | CPU 인식 보정 | ★ 신규 |
| GC selection 자동 ergonomics | server JVM 의 default 선정 | ✅ |
| OOMKilled vs Java OOM | k8s 에서 OOMKilled 면 native heap | ✅ |
| **String deduplication** (G1) | heap 절감 | ★ 신규 |
| Class loader leak 진단 | Metaspace 누수 | 🟡 |

### H. JMH / 벤치

| 개념 | 정의 | 상태 |
|---|---|---|
| JMH (Java Microbenchmark Harness) | warm-up + measurement + fork | ✅ |
| Blackhole / DCE 회피 | 컴파일러 최적화 회피 | ✅ |
| Profilers (gc, perf, async-profiler) integration | JMH addon | ✅ |
| **Benchmark mode** (Throughput / AverageTime / SampleTime / SingleShotTime / All) | mode 결정 | 🟡 |

### I. JEP 트래커 (최근)

| JEP | 내용 | JDK | 상태 |
|---|---|---|---|
| JEP 425 | Virtual Threads | 19→21 GA | 🟡 |
| JEP 444 | Virtual Threads (final) | 21 | 🟡 |
| JEP 439 | Generational ZGC | 21 | ★ 신규 |
| JEP 450 | Compact Object Headers (preview) | Lilliput | ★ 신규 |
| JEP 450 family | CRaC / Leyden | 진행 | ★ 신규 |
| JEP 457 | Class-File API (preview) | 22 | skip (도구) |
| JEP 458 | Launch Multi-File Programs | 22 | skip |
| JEP 467 | Markdown Documentation Comments | 23 | skip |
| JEP 484 | ZGC: Remove Non-Generational Mode | 24 | ★ 신규 |

> JEP 트래커는 release 마다 갱신 — Oracle docs `https://openjdk.org/projects/jdk/<N>/` 의 JEP list 참고.

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Generational ZGC (JDK 21+)** | 현 표준 — 큰 heap + 낮은 pause |
| 2 | **Container-aware JVM 표준 (MaxRAMPercentage 등)** | k8s msa 운영 직결 |
| 3 | **CRaC + AppCDS** | startup latency / 비용 절감 (FaaS, scaling) |
| 4 | **Structured Concurrency + Scoped Values** | Virtual Threads 후속, #3 와 cross |
| 5 | **Compact Object Headers (Lilliput)** | heap 크기 ↓ — 메모리 비용 직결 |
| 6 | **Project Leyden (AOT JVM)** | startup + footprint |
| 7 | **JFR streaming + custom events** | 실시간 관측 |
| 8 | **G1 String deduplication / region tuning** | 메모리 비용 완화 |
| 9 | **Async-profiler + flame graph 표준** | profiling 운영 표준 |
| 10 | **Safepoint / TTSP 분석** | pause 의 숨은 원인 |

---

## 4. 표준 심화 스터디 템플릿

`19-search-engine/99-concept-catalog.md` §4 의 12-section 그대로 사용. JVM 특화 보강:
- §3 동작 원리 → "관련 JEP / JDK 도입 버전 / `-XX:` 플래그" 표 1개
- §6 → "GC vs GC" 비교 (G1 vs ZGC vs Shenandoah)
- §7 운영 → JFR event id, `-Xlog:` 표준
- §8 msa grounding → jib-convention / k8s resources / GC 옵션

---

## 5. 참고 자료

- Oracle Java SE 21 Specs: https://docs.oracle.com/en/java/javase/21/
- HotSpot GC Tuning Guide: https://docs.oracle.com/en/java/javase/21/gctuning/
- JEP index: https://openjdk.org/jeps/0
- Project Loom: https://openjdk.org/projects/loom/
- Project Leyden: https://openjdk.org/projects/leyden/
- Project Lilliput: https://openjdk.org/projects/lilliput/
- "Java Performance" (Scott Oaks)
- "Optimizing Java" (Benjamin J. Evans, James Gough)
- async-profiler: https://github.com/async-profiler/async-profiler
- JMH: https://github.com/openjdk/jmh

> JEP/JDK release 마다 본 카탈로그 갱신.
