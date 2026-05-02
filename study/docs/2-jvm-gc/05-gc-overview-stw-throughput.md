---
parent: 2-jvm-gc
seq: 05
title: GC 종류 + STW + Throughput vs Latency 트레이드오프
type: deep
created: 2026-05-01
---

# 05. GC 종류 + STW + 트레이드오프

## TL;DR

GC 는 **Throughput(처리량) 우선** 과 **Latency(저지연) 우선** 의 두 갈래. Parallel 은 throughput, ZGC/Shenandoah 는 latency. **G1 이 둘의 균형으로 JDK 9+ 기본**. JDK 21 LTS 부터는 ZGC Generational 이 안정화되어 큰 힙(8GB+) + 저지연 요구 워크로드의 새 기본이 되어가고 있다. **선택은 힙 크기 + 허용 가능한 pause time + throughput 손실 감내 여부 3개 축**.

```
Latency (낮은 pause)
  ▲
  │   ZGC ★
  │      Shenandoah ★
  │
  │            G1 ★ ← JDK 9+ 기본
  │
  │
  │                 Parallel ★ ← Throughput 챔피언
  │
  │       Serial ★
  └─────────────────────────────► Throughput
```

---

## 1. 6대 GC 개요 (JDK 21~25)

### Serial GC

- **활성화**: `-XX:+UseSerialGC`
- **스레드**: 1개 (GC 도, 마킹도)
- **알고리즘**: Young Copy + Old Mark-Compact
- **STW**: 길다 (보통 100ms~수 초)
- **용도**: 임베디드, JDK CLI 도구, 작은 힙 (< 100MB)
- **메모리 footprint**: 가장 작음
- **JDK 25 기본?**: 컨테이너 메모리 < 1.78GB AND CPU < 2 일 때 자동 선택

### Parallel GC (옛 Throughput Collector)

- **활성화**: `-XX:+UseParallelGC`
- **스레드**: GC 시 멀티 (CPU 코어 수만큼)
- **알고리즘**: Young Copy (병렬) + Old Mark-Compact (병렬)
- **STW**: 길다 (Old GC 시 수백 ms ~ 수 초)
- **장점**: **단위 시간당 가장 많은 일** (throughput) — STW 동안만 GC 하므로 오버헤드 적음
- **단점**: pause time 길음
- **용도**: 배치, 분석, latency 무관한 처리 워크로드
- **JDK 8 이하 default** — 그래서 옛 시스템이 Parallel 인 경우 많음

### CMS (Concurrent Mark-Sweep) — Deprecated

- **JDK 9 deprecated, JDK 14 제거**
- 면접에서 "왜 CMS 가 사라졌나요?" 질문 단골 → **Old 단편화 + Initial Mark/Remark 의 STW + 코드 복잡도**
- 후계자 = G1
- 학습 포인트: CMS 는 사라졌지만 그 개념(concurrent mark)이 G1/ZGC 의 뿌리

### G1 GC (Garbage First) — JDK 9+ 기본

- **활성화**: `-XX:+UseG1GC` (JDK 9+ 기본이라 명시 불필요)
- **스레드**: 멀티 (GC + Concurrent Mark)
- **알고리즘**: Region 기반 Copy(Young) + Mark-Compact(Mixed)
- **STW**: ≤ 200ms 목표 (`-XX:MaxGCPauseMillis=200` 기본)
- **장점**: throughput/latency 균형, **predictable pause** (목표 시간 안 넘기려 노력)
- **단점**: 메모리 footprint 약간 큼 (RSet, Card), 매우 작은 힙엔 부적합
- **용도**: 일반 서비스 (msa, 웹, API), 4GB ~ 수십 GB 힙
- **6번 파일 상세**

### ZGC (Z Garbage Collector)

- **활성화**: `-XX:+UseZGC`
- **JDK 21+ Generational**: `-XX:+UseZGC -XX:+ZGenerational` (JDK 23부터 기본 generational, JDK 25 단일화)
- **스레드**: 다수 (concurrent)
- **알고리즘**: Concurrent Compact, Colored Pointer + Load Barrier
- **STW**: **< 1ms** (일관)
- **장점**: 힙 크기와 무관한 sub-ms pause, 8GB ~ 16TB 힙
- **단점**: throughput ~10% 감소, 메모리 footprint 약간 큼 (compressed oops 비활성)
- **용도**: 대용량 힙 + 저지연 (트레이딩, 게임, 실시간 추천)
- **7번 파일 상세**

### Shenandoah (Red Hat OpenJDK)

- **활성화**: `-XX:+UseShenandoahGC`
- **OpenJDK 17+** 부터 OpenJDK 본가 포함 (Oracle JDK 별도 — 배포본 따라 다름)
- **스레드**: 다수 (concurrent)
- **알고리즘**: Concurrent Compact, Brooks Pointer
- **STW**: < 10ms 목표
- **장점**: 작은 힙(2GB~)부터 가능, ZGC 대안
- **단점**: ZGC 대비 약간 느린 pause, 일부 환경에서 안정성 평판
- **용도**: ZGC 가 부담스러운 작은 힙 + 저지연
- **8번 파일 상세**

### Epsilon GC (no-op)

- **활성화**: `-XX:+UseEpsilonGC -XX:+UnlockExperimentalVMOptions`
- **GC 안 함** — 힙이 다 차면 OOM
- **용도**: 짧은 수명 워크로드(CLI tool, JMH 벤치마크 ), GC 영향 배제하고 측정할 때

---

## 2. Throughput vs Latency

### 정의

- **Throughput** = (앱이 일한 시간) / (전체 시간) = 1 - (GC 시간 / 전체 시간)
- **Latency (Pause Time)** = 단일 STW 의 길이

### 트레이드오프 본질

GC 는 결국 **언젠가 죽은 객체를 청소**해야 한다. 두 가지 변수:

1. **얼마나 자주** 청소하는가 (frequency)
2. **한 번에 얼마나 길게** 멈추는가 (duration)

```
Total GC Time = Frequency × Duration
```

- Throughput 우선 (Parallel): Frequency 낮춤 + Duration 김 = 일에 집중
- Latency 우선 (ZGC): Duration 거의 0 (concurrent) + 잦은 frequency + write/load barrier 오버헤드

### Throughput 의 정량 목표

JVM 기본 GC throughput 목표 = **99%** (즉 GC 시간 < 1%). 측정:
```
GC log 에서:
  Total app time: 600s
  Total GC time:  3s
  Throughput = 1 - 3/600 = 99.5%
```

### Pause Time 의 정량 목표

| 사용 사례 | 허용 pause |
|---|---|
| 배치 / 데이터 처리 | 수 초 OK |
| 일반 웹 API | < 200ms (G1 기본) |
| 모바일 게임 백엔드 | < 50ms |
| 실시간 트레이딩 | < 10ms |
| HFT / 음성 처리 | < 1ms (ZGC) |

msa 의 일반 서비스(product, order, search)는 G1 의 200ms 기본이 안전 마진. 단 search 같은 P99 < 500ms SLO 가 있는 서비스는 더 짧은 pause 가 필요할 수 있음 (ADR-0025 latency budget).

---

## 3. GC 선택 결정 트리

```
                    ┌──────────────────────────┐
                    │  서비스 유형은?           │
                    └────────┬─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        Throughput      일반 웹/API      저지연
        (배치, 분석)                     (트레이딩, 실시간)
              │              │              │
              ▼              ▼              ▼
         Parallel          G1            힙 크기?
                                            │
                                ┌───────────┴───────────┐
                                │                       │
                                ▼                       ▼
                              < 4GB                   ≥ 8GB
                                │                       │
                                ▼                       ▼
                          Shenandoah                 ZGC
                          (or G1 + 짧은              (Generational
                           MaxGCPauseMillis)         JDK 21+)
```

### msa 의 결정

- **default**: G1 (모든 서비스)
- **search**: G1 또는 ZGC (큰 힙 + 검색 latency 민감)
- **analytics**: Parallel 검토 가능 (Kafka Streams + ClickHouse, throughput 우선)
- **gateway**: G1 (이미 default), latency 민감 → MaxGCPauseMillis 조정 검토

---

## 4. STW Phase 별 비교

GC 별로 STW 가 어디서 발생하는지:

### Parallel GC

```
Time ─────────────────────────────────────────►
App   [████████]    [██████████]    [████████]
GC            [STW Mark+Compact]  [STW M+C]
              └ 200ms~수초 ┘
```

전부 STW. Old GC 시 매우 길다.

### G1 GC

```
Time ─────────────────────────────────────────────────►
App   [██] [██] [████████████] [██] [████████] [██]
GC    [STW]    [Concurrent Mark]   [STW Remark]   [STW Mixed]
       Initial └─ 앱과 병행 ─┘     [STW]          [STW]
       Mark
       100ms                       50ms          150ms
```

Initial Mark, Remark, Cleanup, Mixed Evacuation 이 STW. 나머지 concurrent.

### ZGC (Generational)

```
Time ─────────────────────────────────────────────────►
App   [██████████████████████████████████████████████]
GC    [█][█][█][█][█][█][█][█][█][█][█][█][█][█]
       └ 0.5ms STW │ Concurrent (앱과 병행) │
        Mark Start
```

0.5~1ms 의 작은 STW 만. 나머지는 전부 concurrent. 힙 크기와 pause 무관.

---

## 5. JDK 21~25 변경사항

### JDK 21
- **ZGC Generational** GA — 옛 non-gen ZGC 와 공존, `-XX:+ZGenerational` 옵션
- **Virtual Threads** GA — 스택 크기 동적, 백만 개 thread 가능
- G1 Region Pinning (Critical 영역의 객체 이동 방지)

### JDK 22-23
- ZGC Generational 이 default ZGC 가 됨 (non-gen 사용 시 명시 옵션)
- G1 Full GC 병렬화 추가 개선

### JDK 24-25
- non-generational ZGC 제거 — 이제 ZGC = 항상 generational
- Late Barrier Expansion (G1 의 write barrier 코드 생성 시점 연기) → JIT 코드 품질 ↑
- **AOT 컴파일** (Project Leyden 일부 GA) — 부팅 시간 단축

### JDK 25 LTS의 추천 GC

| 워크로드 | 추천 |
|---|---|
| 일반 마이크로서비스 (힙 < 8GB) | **G1** (default) |
| 큰 힙 + 저지연 | **ZGC** (Generational, default) |
| 배치 / Kafka Streams | Parallel 또는 G1 |
| 작은 힙 + 저지연 | Shenandoah (대안) |

---

## 6. 메모리 footprint 비교 (대략)

같은 1GB 힙 기준 native memory 추가 사용량:

| GC | RSet/Card | Mark Bitmap | Forwarding | Compressed Oops | 합계 추정 |
|---|---|---|---|---|---|
| Serial | 1MB (Card) | 1MB | - | OK | +2MB |
| Parallel | 1MB | 1MB | - | OK | +2MB |
| G1 | 5~10% | 1MB | - | OK | +50~100MB |
| ZGC (Gen) | - | 2 bitmap | 매핑 N/A | **불가** | +50MB + oops 비활성 |
| Shenandoah | - | 1 bitmap | Brooks 1 word/obj | OK | +30~50MB |

ZGC 가 compressed oops 를 못 쓰므로 64-bit 환경에서 **객체당 +4 byte** (참조 필드마다). 이게 8GB 미만 힙에서 ZGC 가 불리한 이유 — 살아있는 객체 수가 많으면 누적 footprint 가 커짐.

---

## 7. msa 서비스 GC 선택 매트릭스 (제안)

| 서비스 | 힙 limit (current) | 권장 GC | 근거 |
|---|---|---|---|
| product | 1Gi | G1 (current) | 일반 CRUD + Kafka publish |
| order | 1Gi | G1 | 결제 연동, 200ms 이내 응답 |
| search | 1Gi | G1 → ZGC 검토 | 검색 latency 민감, 힙 키우면 ZGC |
| gateway | 512Mi | G1 | 라우팅 위주, 작은 힙 |
| analytics | 1Gi | G1 또는 Parallel | Kafka Streams, throughput 우선 시 Parallel |
| quant | TBD | **ZGC 강력 권장** | 트레이딩 → 저지연 필수 |

JVM 5세대 ↑ 기준. 7번 파일에서 ZGC 채택 기준 상세.

---

## 8. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "G1 이 ZGC 보다 무조건 느리다" | Throughput 은 G1 이 보통 더 좋음 |
| "ZGC pause 가 < 1ms 면 무조건 좋다" | throughput 손실 + footprint 증가 트레이드오프 있음 |
| "Parallel = STW 길어서 무조건 후진" | 배치 throughput 은 Parallel 이 챔피언. 무조건 Parallel = 옛것이라는 건 오해 |
| "JDK 17+ 면 무조건 ZGC" | 작은 힙(<4GB) 은 G1 이 보통 더 효율적 |
| "Shenandoah = ZGC 동급" | 비슷하지만 ZGC 가 Oracle 본가, Shenandoah 는 Red Hat 발 — 배포본 따라 가용성 다름 |
| "Concurrent GC 면 STW 가 0" | 0 은 아니다. < 1ms 의 짧은 STW 가 거의 모든 concurrent GC 에 있음 |

---

## 다음 학습

- [06-g1gc-deep.md](06-g1gc-deep.md) — G1 region/RSet/Mixed GC 상세
- [07-zgc-deep.md](07-zgc-deep.md) — Colored Pointer + Load Barrier
- [08-shenandoah.md](08-shenandoah.md) — Brooks Pointer
- [09-gc-log-analysis.md](09-gc-log-analysis.md) — 어느 GC 든 로그 분석법
