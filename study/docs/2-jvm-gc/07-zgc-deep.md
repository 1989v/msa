---
parent: 2-jvm-gc
seq: 07
title: ZGC 상세 — Colored Pointers / Load Barrier / Generational
type: deep
created: 2026-05-01
---

# 07. ZGC 상세

## TL;DR

ZGC (Z Garbage Collector) 는 **모든 GC (Garbage Collection, 가비지 컬렉션) phase 가 concurrent**, 힙 크기와 무관하게 **STW < 1ms** 를 달성한 GC. 핵심 무기는 **Colored Pointer** — 64-bit 포인터의 상위 비트에 GC 메타데이터를 박아서 객체와 함께 이동/추적. 그리고 **Load Barrier** — 모든 객체 read 시 짧은 가드 코드가 실행되어 mid-flight 이동 중인 객체도 안전하게 처리. JDK 21 부터 **Generational ZGC** GA, JDK 25 부터는 ZGC = always Generational.

```
   Pointer (64-bit)
   ┌────────────────────────────────────────────────────────────┐
   │  unused (16) │ color metadata (4) │ virtual address (44)    │
   └────────────────────────────────────────────────────────────┘
                       ↑
                       │
                       └─ Marked0, Marked1, Remapped, Finalizable
```

---

## 1. ZGC 의 목표

### 설계 원칙

1. **Pause time < 1ms** (어떤 힙 크기에서도)
2. **Pause time 이 힙 크기에 독립** (8GB 든 16TB 든 같은 pause)
3. **Throughput 손실 < 15%** (실제로는 보통 5~10%)

### 트레이드오프

- **Throughput 약간 ↓** (load barrier 오버헤드)
- **Memory footprint ↑** (compressed oops 못 씀)
- **Address space 많이 사용** (multi-mapping 으로 4TB 의 가상 주소를 1TB 힙에 사용)

---

## 2. Colored Pointer — 핵심 혁신

### 64-bit 포인터 사용처

x86_64 / ARM64 의 가상 주소는 보통 **하위 47-48 비트만 사용**. 상위 16-17 비트가 비어있다 → ZGC 가 여기에 **GC 메타데이터** 를 박는다.

### 색깔 (Color)

```
4-bit color 영역에 다음 상태들:
- Marked0:        이번 GC 사이클에서 marked (홀수 사이클)
- Marked1:        이번 GC 사이클에서 marked (짝수 사이클)
- Remapped:       compact 후 새 주소로 remap 된 상태
- Finalizable:    finalizer 대상
```

같은 객체를 가리키는 포인터라도 GC 사이클마다 색이 달라진다.

### Multi-Mapping (가상 메모리 트릭)

```
Virtual Address Space:
   0x0000_0000_0000  ─ Marked0 영역 (1TB)
   0x0000_0010_0000  ─ Marked1 영역 (1TB)
   0x0000_0020_0000  ─ Remapped 영역 (1TB)

이 셋이 모두 같은 1TB 의 물리 메모리에 매핑됨 (3중 매핑).
```

ZGC 는 한 객체를 **세 가지 다른 가상 주소** 로 접근 가능. 객체 이동 없이 색만 바꿔도 효과적으로 metadata 변경. 매우 영리하다.

### Compressed Oops 와 충돌

압축 오옵스는 64-bit 환경에서도 32-bit 포인터(× 8 byte 정렬)로 객체를 가리킨다. **상위 비트가 32 bit 자체** 라 ZGC 색 정보를 박을 자리가 없음 → ZGC 활성 시 자동으로 disable.

결과: 객체당 reference 필드가 4 byte → 8 byte 로 증가. 8GB 미만 힙에서 ZGC 가 footprint 불리한 이유.

---

## 3. Load Barrier — 또 다른 핵심

### 동작

JIT (Just-In-Time compilation, 즉시 컴파일) 가 모든 reference load (`obj.field`) 에 다음 가드 코드를 끼움:

```c
// 의사 코드
ref = obj.field;
if (color_of(ref) != current_good_color) {
    ref = slow_path(ref);  // remap or 재포인팅
    obj.field = ref;       // self-healing: 다음엔 빠른 path
}
```

### 효과

- 객체 이동 중에도 mutator 가 안전하게 read 가능 — barrier 가 새 주소로 redirect
- **Self-healing** — 한번 slow path 거치면 그 reference 는 다음에 fast path
- mark 와 remap 이 read 시점에 점진적으로 일어남 → **incremental**

### G1 의 SATB 와 차이

| | G1 (SATB) | ZGC (Load Barrier) |
|---|---|---|
| Barrier 위치 | Reference Write | Reference Read |
| 스냅샷 시점 | Mark 시작 시점 | 없음 (incremental update) |
| floating garbage | 있음 (한 사이클) | 없음 |
| 비용 | Write 시 약간 | Read 시 매번 (Read 가 Write 보다 흔함) |

ZGC 는 **read 가 더 흔하지만 barrier 가 짧고 self-healing 이라 평균 비용 작음**.

---

## 4. ZGC 사이클

### Phase 분해

```
1. Pause Mark Start    (STW, ~0.5ms)   → root scan 시작
2. Concurrent Mark/Remap                → app 과 병행, load barrier 사용
3. Pause Mark End      (STW, ~0.5ms)   → mark 완료 확인
4. Concurrent Process   (병행)          → reference processing
5. Pause Relocate Start (STW, ~0.5ms)  → relocation set 결정
6. Concurrent Relocate (병행)           → 객체 복사 (load barrier 가 healing)
```

총 STW = 1~2ms 수준. 힙 크기와 무관.

### Generational ZGC (JDK 21+)

옛 ZGC = single-generation (Young/Old 구분 없음). 단점:
- 모든 객체를 매 사이클 검사 → 큰 워크로드에서 throughput 손실
- 약한 generational hypothesis 활용 못 함

JDK 21 의 generational ZGC:
- Young / Old 분리
- Young 은 자주 작게 GC, Old 는 느슨하게
- **default = generational** (JDK 23+)
- **JDK 25 = generational only** (non-gen 제거)

---

## 5. 활성화 옵션

```bash
# JDK 21
-XX:+UseZGC -XX:+ZGenerational

# JDK 23-24
-XX:+UseZGC                    # generational 이 default
-XX:+UseZGC -XX:-ZGenerational # 옛 single-gen 강제

# JDK 25
-XX:+UseZGC                    # 항상 generational
```

### 핵심 옵션

| 옵션 | 의미 | 권장 |
|---|---|---|
| `-XX:+UseZGC` | ZGC 활성 | |
| `-Xmx` | 최대 힙 | ZGC 는 큰 힙이 sweet spot |
| `-XX:SoftMaxHeapSize=8G` | soft 한도 — 가능하면 이 안에서 동작 | 메모리 절약 |
| `-XX:ConcGCThreads=N` | concurrent 스레드 | CPU 여유 있을 때 ↑ |
| `-XX:ZUncommitDelay=300` | 사용 안 한 메모리 OS 반환 지연(초) | 컨테이너에선 짧게 |
| `-XX:+UseLargePages` | huge pages 사용 | latency 추가 ↓ |

---

## 6. ZGC 가 빛을 발하는 시나리오

### 시나리오 1 — 큰 힙 + 저지연

```
실시간 추천 서비스, 힙 32GB
G1 (Garbage-First Collector): Mixed GC pause 400ms
ZGC: 항상 < 1ms
```

### 시나리오 2 — 메모리 캐시 (대부분 살아있는 힙)

```
in-memory store, 80% Old 점유, 객체 자주 안 죽음
G1: Mixed GC 거의 안 효과 (live 비율 높아 evacuate 비용 큼)
ZGC: 같은 비용으로 큰 힙 처리 (concurrent compact 라 STW 무관)
```

### 시나리오 3 — 매우 큰 힙 (수 TB)

ZGC 가 16TB 까지 가능. G1 도 가능하지만 RSet 메모리가 폭발 (수십 GB). ZGC 는 RSet 없음.

### ZGC 가 부적합한 시나리오

| 워크로드 | 이유 |
|---|---|
| 작은 힙 (< 4GB) | compressed oops 손실이 더 큼 |
| Throughput 우선 (배치) | 5~10% throughput loss 무가치 |
| CPU 부족 | concurrent thread 가 자원 추가 사용 |

---

## 7. ZGC 모니터링

### GC 로그

```bash
-Xlog:gc*:file=zgc.log:time,uptime,tags
```

전형적인 로그:
```
[100.5s][info][gc] GC(42) Garbage Collection (Allocation Rate)
[100.5s][info][gc] GC(42) Pause Mark Start    0.234ms
[100.6s][info][gc] GC(42) Concurrent Mark     85.234ms
[100.6s][info][gc] GC(42) Pause Mark End      0.198ms
[100.6s][info][gc] GC(42) Concurrent Process Non-Strong References  5ms
[100.7s][info][gc] GC(42) Pause Relocate Start 0.154ms
[100.7s][info][gc] GC(42) Concurrent Relocate 45ms
[100.8s][info][gc] GC(42) Garbage Collection (Allocation Rate) 800M(45%)->100M(15%)
```

### Trigger 종류

ZGC 는 자동 trigger:
- **Allocation Rate** — 할당률 기반 예측 ("이대로면 곧 부족")
- **Allocation Stall** — mutator 가 할당 못 해 멈춤 (이건 안 좋음)
- **Proactive** — 유휴 시 미리
- **High Usage** — 힙 점유율 높을 때

### Allocation Stall (위험 신호)

```
[gc] Allocation Stall (Thread-12) 25.3ms
```

mutator 가 ZGC 를 기다림. 이게 자주 보이면:
1. `-XX:ConcGCThreads` 늘리기
2. `-Xmx` 키우기
3. 할당률 줄이기 (코드 최적화)

---

## 8. msa 컨텍스트

### 현재 상태

기본 G1 사용 중. **quant** (트레이딩) 같은 latency 민감 서비스에서 ZGC 를 검토 가치.

### quant 이 ZGC 후보인 이유

- 실시간 가격 데이터 처리
- 매수/매도 결정 latency 직접 영향
- 힙은 처음 1Gi → 추후 4Gi+ 로 확장 가능
- Mixed GC 200ms pause 가 거래 한 건의 latency 를 망칠 수 있음

### 적용안 (예시 — ADR 후보)

```kotlin
// quant/app/build.gradle.kts 에서 jvmFlags override
configure<JibExtension> {
    container {
        jvmFlags = listOf(
            "-XX:+UseContainerSupport",
            "-XX:MaxRAMPercentage=70.0",   // ZGC footprint 고려해 75 → 70
            "-XX:+UseZGC",
            "-XX:+UseLargePages",
            "-Xlog:gc*:file=/var/log/gc.log:time,uptime:filecount=5,filesize=10M",
            "-XX:+HeapDumpOnOutOfMemoryError"
        )
    }
}
```

K8s (Kubernetes) 에서 `vm.nr_hugepages` 설정 또는 `node-feature-discovery` 가 필요할 수 있음 — large pages 는 sysctl 설정 필요.

### 검증 방법 (Lab 1 에서)

1. G1 로 30분, allocation rate / pause 측정
2. ZGC 로 30분, 같은 부하
3. P50/P99 latency 비교

비교 매트릭스:
- P99 응답 지연
- GC throughput (CPU% GC)
- 메모리 footprint (RSS)

---

## 9. ZGC vs Shenandoah

| 항목 | ZGC | Shenandoah |
|---|---|---|
| 발원 | Oracle | Red Hat |
| Pause 목표 | < 1ms | < 10ms |
| 핵심 기법 | Colored Pointer | Brooks Pointer |
| Compressed Oops | 불가 | 가능 |
| OpenJDK 본가 | JDK 11+ | JDK 17+ (배포본 따라) |
| Generational | JDK 21 GA | Generational 작업 진행 중 |
| Trade | 메모리 ↑ | 객체당 1 word 추가 |

선택 기준:
- 큰 힙 + < 1ms pause 가 절대 필요 → ZGC
- 작은~중간 힙 + 저지연 + Compressed Oops 유지 → Shenandoah
- 중간 힙 + 200ms 충분 → G1 (대부분의 msa 서비스)

8번 파일에서 Shenandoah 상세.

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "ZGC 는 STW 가 0" | < 1ms 의 짧은 STW phase 가 있음. 0 은 아니다 |
| "ZGC pause 가 항상 짧으니 무조건 좋다" | throughput 손실 + footprint 증가 |
| "Compressed Oops 비활성 = 큰 손해" | 8GB+ 힙에선 거의 무시 가능. 작은 힙에선 손해 큼 |
| "ZGC 는 Generational 만 있다" | JDK 25 에서 그렇게 됨. JDK 21 까지는 둘 다 |
| "Load Barrier 가 모든 read 마다 있어 매우 느림" | barrier 자체는 짧음. self-healing 으로 평균 비용 ↓ |
| "ZGC 는 16GB+ 힙 전용" | 4GB 부터 동작 가능. 단 G1 대비 이점 적음 |
| "Allocation Stall 은 정상" | 위험 신호. 자주 보이면 GC 가 따라잡지 못함 |

---

## 다음 학습

- [08-shenandoah.md](08-shenandoah.md) — Brooks Pointer 와의 비교
- [09-gc-log-analysis.md](09-gc-log-analysis.md) — ZGC 로그 read
- [14-lab-gc-log.md](14-lab-gc-log.md) — G1 vs ZGC 직접 비교 실습
