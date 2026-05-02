---
parent: 2-jvm-gc
type: preview
created: 2026-05-01
---

# JVM 내부 + GC 튜닝 — Preview

> 학습자 수준: 중급(B) · 전체 예상 시간: 35h · 목표: 10년차 면접 + 프로덕션 GC 장애 대응
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: 개념 + 실습 풀팩 (GC log / Heap Dump / JFR / JMH) · JDK 범위: 21 LTS ~ 25 LTS · msa 전체 JVM 서비스 직접 적용

---

## 멘탈 모델: "메모리 → GC → 진단" 3-Layer

JVM 학습은 **메모리 구조**를 머릿속에 그리고, 그 위에서 **GC가 어떻게 움직이는지** 이해하고, 마지막으로 **로그/덤프로 외부 관찰**하는 순서가 가장 빠르다.

```
  ┌──────────────────────────────────────────────┐
  │  Layer 3: 진단 / 운영 / 튜닝
  │  -Xlog:gc* / GCViewer / GCEasy
  │  Heap Dump (MAT) + Thread Dump (#3)
  │  JFR / JMC / JMH
  │  Prometheus + Micrometer JVM 메트릭
  └─────────────────┬────────────────────────────┘
                    │ "GC가 왜 그렇게 움직였는지 본다"
  ┌─────────────────┴────────────────────────────┐
  │  Layer 2: GC 알고리즘
  │  Mark-Sweep / Mark-Compact / Copy
  │  Serial / Parallel / G1 / ZGC / Shenandoah
  │  STW vs Concurrent, Throughput vs Latency
  └─────────────────┬────────────────────────────┘
                    │ "어디서 어디로 객체가 움직이나"
  ┌─────────────────┴────────────────────────────┐
  │  Layer 1: 메모리 구조 + 할당
  │  Heap (Young/Old) / Metaspace / Stack / Native
  │  TLAB → Eden → Survivor → Old
  │  GC Root, Reachability
  └──────────────────────────────────────────────┘
```

**핵심 7문장만 외운다**:
1. **객체는 거의 다 Eden TLAB에 할당**되고, 살아남으면 Survivor를 거쳐 Old로 promotion 된다.
2. **GC Root에서 도달 가능한 객체만 살아남는다** — 참조가 끊긴 순간 죽은 객체.
3. **Throughput vs Latency는 트레이드오프** — Parallel GC는 Throughput, ZGC는 Latency.
4. **G1은 Region 기반** — Young/Old가 고정 영역이 아니라 region이 동적 역할 부여.
5. **ZGC는 Colored Pointer + Load Barrier**로 sub-ms STW 달성, 모든 phase가 concurrent.
6. **컨테이너 환경 힙은 `-XX:MaxRAMPercentage`로 비율 지정** — 절대값보다 안전.
7. **OOM은 5가지** — Java heap / Metaspace / GC overhead / Direct buffer / Unable to create native thread, 각각 진단법이 다르다.

---

## 소주제 지도

> 23개 파일로 분할. Phase 1 기초 5개, Phase 2 심화 8개, 실습 4개, Phase 3 msa 적용 3개, 산출물 2개.

### Phase 1: JVM 메모리 + GC 기본 (5개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | JVM 메모리 영역 | [01-jvm-memory-areas.md](01-jvm-memory-areas.md) | Heap(Young/Old), Metaspace, Stack, PC, Native — JDK 8 PermGen 차이 |
| 02 | 객체 할당 흐름 | [02-object-allocation.md](02-object-allocation.md) | TLAB → Eden → Survivor → Old, age, Humongous |
| 03 | GC Root + Reachability | [03-gc-roots-reachability.md](03-gc-roots-reachability.md) | Strong/Soft/Weak/Phantom, Root 종류, Mark phase 동작 |
| 04 | GC 알고리즘 기본 | [04-gc-algorithms-basics.md](04-gc-algorithms-basics.md) | Mark-Sweep / Mark-Compact / Copying — 트레이드오프 |
| 05 | GC 종류 + STW + 트레이드오프 | [05-gc-overview-stw-throughput.md](05-gc-overview-stw-throughput.md) | Serial/Parallel/CMS/G1/ZGC/Shenandoah, Throughput vs Latency |

### Phase 2: 현대 GC + JIT + 진단 (8개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 06 | G1GC 상세 | [06-g1gc-deep.md](06-g1gc-deep.md) | Region, RSet, Humongous, Mixed GC, MaxGCPauseMillis |
| 07 | ZGC 상세 | [07-zgc-deep.md](07-zgc-deep.md) | Colored Pointer, Load Barrier, Generational ZGC (JDK 21) |
| 08 | Shenandoah | [08-shenandoah.md](08-shenandoah.md) | Brooks Pointer, Concurrent Compaction, Red Hat 발 GC |
| 09 | GC 로그 분석 | [09-gc-log-analysis.md](09-gc-log-analysis.md) | `-Xlog:gc*` 형식, GCViewer/GCEasy 핵심 지표 |
| 10 | JIT 최적화 | [10-jit-compilation.md](10-jit-compilation.md) | C1/C2, Tiered, Inlining, Escape Analysis, OSR |
| 11 | NMT (Native Memory Tracking) | [11-nmt-native-memory.md](11-nmt-native-memory.md) | NMT summary/detail, off-heap 누수 진단 |
| 12 | OOM 5유형 | [12-oom-five-types.md](12-oom-five-types.md) | Heap / Metaspace / GC overhead / Direct buffer / native thread |
| 13 | Heap Dump + MAT (+ Thread Dump 조합) | [13-heap-dump-mat.md](13-heap-dump-mat.md) | jcmd, MAT Dominator Tree, Leak Suspects, Thread Dump cross-ref → #3 |

### 실습 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 14 | Lab 1: GC 로그 수집 + 분석 | [14-lab-gc-log.md](14-lab-gc-log.md) | product 서비스에 `-Xlog:gc*` 적용, GCEasy 리포트 |
| 15 | Lab 2: Heap Dump + MAT | [15-lab-heap-dump-mat.md](15-lab-heap-dump-mat.md) | OOM 의도 재현, Dominator Tree 분석 |
| 16 | Lab 3: JFR + JMC | [16-lab-jfr-jmc.md](16-lab-jfr-jmc.md) | StartFlightRecording, hot method, allocation hotspot |
| 17 | Lab 4: JMH | [17-lab-jmh.md](17-lab-jmh.md) | Escape Analysis / Inlining 효과 측정 |

### Phase 3: msa 적용 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 18 | msa Jib JVM 옵션 점검 | [18-msa-jib-config.md](18-msa-jib-config.md) | `commerce.jib-convention.gradle.kts` 검토 + 개선안 |
| 19 | K8s 메모리 리밋 ↔ 힙 비율 | [19-k8s-memory-vs-heap.md](19-k8s-memory-vs-heap.md) | resources.limits vs `-XX:MaxRAMPercentage`, OOMKilled 방지 |
| 20 | 관측성: Prometheus + Micrometer | [20-observability-prometheus.md](20-observability-prometheus.md) | actuator/prometheus, JVM 메트릭 핵심 시리즈, Grafana 패널 |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 21 | msa JVM 튜닝 개선 후보 + ADR 후보 | [21-improvements.md](21-improvements.md) | 10개 제안 + 우선순위 + ADR-0028 후보 초안 |
| 22 | 면접 Q&A 50문항 + 꼬리 질문 | [22-interview-qa.md](22-interview-qa.md) | 6 영역 × 8문항 + 함정 / 실무 스토리 |

---

## 개념 관계도

```
                   ┌──────────────────────────┐
                   │  메모리 영역             │
                   │  Heap / Metaspace / ...  │
                   └────────────┬─────────────┘
                                │
                                ▼
                   ┌──────────────────────────┐
                   │  할당 흐름                │
                   │  TLAB → Eden → Surv → Old│
                   └────────────┬─────────────┘
                                │
                                ▼
                   ┌──────────────────────────┐
                   │  GC 알고리즘              │
                   │  Mark / Sweep / Copy /   │
                   │  Compact                 │
                   └────────────┬─────────────┘
                                │
                  ┌─────────────┼──────────────┐
                  ▼             ▼              ▼
            ┌─────────┐   ┌──────────┐  ┌──────────┐
            │  G1GC   │   │   ZGC    │  │Shenandoah│
            │ Region  │   │ Colored  │  │ Brooks   │
            │ RSet    │   │ Pointer  │  │ Pointer  │
            │ Mixed   │   │ Load Brr │  │ Concur.  │
            └────┬────┘   └────┬─────┘  └────┬─────┘
                 └──────┬──────┴──────┬──────┘
                        ▼             ▼
                 ┌──────────────────────────┐
                 │  진단 / 관측성            │
                 │  -Xlog:gc* / GCEasy      │
                 │  jcmd / MAT / JFR / JMH  │
                 │  Prometheus + Micrometer │
                 └──────────────────────────┘
                                │
                                ▼
                 ┌──────────────────────────┐
                 │  msa 적용                 │
                 │  Jib jvmFlags             │
                 │  K8s resources.limits     │
                 │  -XX:MaxRAMPercentage     │
                 └──────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 메모리 영역 한눈에

| 영역 | 위치 | 용도 | OOM 메시지 |
|---|---|---|---|
| Heap (Young) | 힙 일부 | 새 객체 — Eden + 2 Survivor | `Java heap space` |
| Heap (Old) | 힙 일부 | promoted 장수 객체 + Humongous | `Java heap space` (Old full) |
| Metaspace | Native | 클래스 메타, 메서드 코드 (JDK8+) | `Metaspace` |
| Stack | Native (스레드별) | 메서드 프레임, 지역변수 | `StackOverflowError` (별도) |
| Native (Direct Buffer) | Native | NIO 다이렉트 버퍼, 라이브러리 | `Direct buffer memory` |

### GC 한눈에 (JDK 21 기준)

| GC | Pause 목표 | Throughput | 권장 힙 | 용도 |
|---|---|---|---|---|
| Serial | 길다 | 낮음 | < 100MB | 임베디드, JDK CLI 도구 |
| Parallel | 100ms~수초 | **최고** | < 16GB | 배치, throughput 우선 |
| **G1** (default) | < 200ms | 좋음 | 4GB~수TB | **범용 (msa 기본)** |
| ZGC | **< 1ms** | 살짝 낮음 | 8GB~16TB | 초저지연, 큰 힙 |
| Shenandoah | < 10ms | 살짝 낮음 | 4GB~ | 저지연 대안 |

### 절대 하지 말 것

- 컨테이너에서 `-Xmx`를 절대값으로 박기 (limit 변경 시 잊어버림 → OOMKilled)
- `-XX:+UseConcMarkSweepGC` (CMS, JDK 14에서 제거)
- 힙 덤프를 운영 중 무인 호출 (STW 동반, 큰 힙은 분~십분)
- GC 로그 끄고 운영 (장애 시 원인 진단 불가)
- `System.gc()` 운영 코드에 박기 (Full GC 강제, 명시적 차단 옵션 있음)
- finalize() 사용 (deprecated, GC 지연 + 자원 해제 보장 없음)

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 22** (Top-down 직진)
- Phase 1(01-05)은 의존성 있음 → 순서대로 (메모리 → 할당 → 도달성 → 알고리즘 → GC 종류)
- Phase 2(06-13)는 06 G1 → 07 ZGC → 09 GC 로그 → 12 OOM → 13 Heap Dump 핵심 경로 우선, 08 Shenandoah / 10 JIT / 11 NMT는 보조
- 13-heap-dump-mat.md 의 마지막 섹션은 **#3 동시성 (스레드 덤프)** 와 cross-reference. 현재 #3 은 별도 plan 으로 진행 — 본 토픽에서는 "어떻게 조합하는가"만 다룸
- 실습(14-17)은 Phase 2 종료 후 권장 — 개념 없이 실습부터 하면 로그/덤프 해석이 안 됨
- Phase 3(18-20)은 실제 msa 코드를 직접 열어보며 진행
- **22-interview-qa.md**는 회독용 — 학습 종료 후 1주일 간격으로 2회 회독

각 파일 호출:
```
/study:start 2           # 다음 deep file 자동 선택
/study:start 2 06        # 06-g1gc-deep.md 직접 지정
```

---

## #3 (동시성) 와의 관계

본 토픽은 **JVM 메모리 + GC** 가 본진. **Thread Dump 정밀 해석**은 #3 동시성 plan Phase 2 에서 다룬다. 다만 실무 OOM 진단은 **Heap Dump + Thread Dump 조합**이 필수이므로, 13번 파일에서 "어떻게 두 덤프를 cross-check 하는가"의 메타 절차만 다루고 상세 thread state 분석은 #3 으로 위임한다.
