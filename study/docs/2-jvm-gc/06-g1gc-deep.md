---
parent: 2-jvm-gc
seq: 06
title: G1GC 상세 — Region / RSet / Humongous / Mixed GC
type: deep
created: 2026-05-01
---

# 06. G1GC 상세

## TL;DR

G1 (Garbage First) 은 **힙을 같은 크기 region 으로 쪼개고, 가장 garbage 가 많은 region 부터 회수**한다는 발상의 GC. Young/Old 가 영역으로 고정되지 않고 region 이 동적으로 역할을 가진다(Eden / Survivor / Old / Humongous). 핵심 자료구조는 **Remembered Set (RSet)** — region 간 참조를 추적해 Young GC 가 Old 전체를 스캔하지 않게 한다. **Mixed GC** 가 G1의 묘미: Young + 일부 Old region 을 함께 evacuate 하여 incremental 하게 Old 정리.

```
   힙 (예: 4GB) → 2048 개의 2MB region 으로 분할

   ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
   │E │E │S │O │O │H │H │  │O │E │S │  │  region 의 역할은 동적
   └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
    E=Eden  S=Survivor  O=Old  H=Humongous  공란=Free

   각 region 은:
   - 자기 RSet 을 가진다 (자기를 가리키는 다른 region 의 카드)
   - GC 시 collection set (CSet) 에 포함되면 evacuate 됨
```

---

## 1. Region 기반 설계

### Region 크기

- 기본 = **힙 / 2048** (1MB ~ 32MB, 2의 거듭제곱)
- 4GB 힙 → 2MB region × 2048개
- 직접 설정: `-XX:G1HeapRegionSize=4M`

### Region 의 역할

각 region 은 다음 중 하나:

| 역할 | 의미 |
|---|---|
| **Eden** | 새 객체 할당 |
| **Survivor** | Minor GC 살아남은 객체 (역할 동적) |
| **Old** | promoted 객체 |
| **Humongous** | region 50% 이상 크기 객체 1~N개 (Old 카운트) |
| **Free** | 비어있음 |

**Young = Eden + Survivor region 들의 합집합**. 비율 / 위치 고정 안됨.

### 동적 사이징

- Eden region 개수: GC 후 동적 결정 (`-XX:G1NewSizePercent=5` 최소, `-XX:G1MaxNewSizePercent=60` 최대)
- 현재 Eden 이 다 차면 → Young GC 트리거
- Young GC 후 Survivor → Old promote 후 free region 으로 반환

---

## 2. Humongous Object

### 정의

**객체 크기가 region 의 50% 를 넘으면 Humongous**. 2MB region 에서 1MB+ 객체.

### 처리

```
일반 객체:  TLAB → Eden region

Humongous:  Eden 우회 → 연속된 빈 region 들에 직접 할당, Old 로 분류
            └ 한 region 에 정확히 1개만, 끝 region 은 padding 으로 낭비
```

### 문제

1. **단편화 위험** — 연속 빈 region 못 찾으면 Full GC 트리거
2. **Promotion 오버헤드 없이 Old 직행** — 짧은 수명이라도 Old 에 머물러 Mixed GC 유발
3. **Padding 낭비** — 2MB region 에 1.1MB 객체 = 0.9MB 낭비

### 진단

```
[gc] Humongous regions: 12->0(120)
                 ↑     ↑
                 GC전  GC후 (총 region 개수)
```

GC 로그에서 humongous 가 자주 보이면 → **큰 객체 할당 패턴 의심**:

```kotlin
// 위험 — region 50% 초과 가능
val bigList = repository.findAll()         // 100만 row → 80MB List

// 더 위험 — 1MB+ byte array
val image = ByteArray(2 * 1024 * 1024)     // 2MB 무조건 humongous
```

### 대응

1. **region 크기 늘리기**: `-XX:G1HeapRegionSize=8M` (단 GC overhead 증가 trade)
2. **할당 패턴 수정**: streaming, pagination, chunked 처리
3. **`-XX:G1HeapWastePercent=10`** 의 humongous reclaim 비율 조정

---

## 3. Remembered Set (RSet)

### 문제 재정의

Young GC 는 Young region 의 살아있는 객체만 evacuate 하면 됨. 그러나 "누가 Young 객체를 참조하나"를 알려면 Old 전체 스캔이 필요 → 너무 비쌈.

### 해법: 각 region 마다 RSet

> **이 region 안의 객체를 가리키는 외부 region 들의 location** 을 기록.

```
Region X (Old):
   ┌──────────────────┐
   │  RSet:           │
   │  Region A → "card 5"   ← A 의 card 5 안에 있는 객체가 X 를 참조
   │  Region B → "card 12"
   │  ...
   └──────────────────┘

Young GC 시 X 의 RSet 을 보면 Old A, B 의 일부만 스캔하면 됨.
```

### 자료구조 (다단계)

용량별 압축:
1. **Sparse PRT** — 적은 카드 수 (sparsely populated remembered table)
2. **Fine-grained PRT** — 더 많을 때
3. **Coarse-grained** — 너무 많아지면 region 단위로 압축 (정확도 ↓ 비용 ↓)

### Write Barrier 의 역할

JIT 가 모든 reference store (`obj.field = other`) 에 다음 코드를 끼움:

```
// 의사 코드
write_barrier(obj, field, value):
    if (region_of(value) != region_of(obj)):     # cross-region 참조
        mark_card_dirty(card_of(obj))            # 추후 RSet 업데이트
```

Concurrent refinement thread 가 dirty card 를 읽어 RSet 에 반영. **메인 스레드는 mark 만, refinement 가 RSet 갱신** → mutator 영향 최소화.

### RSet 의 비용

- 메모리: 보통 힙의 5~10% (큰 그래프, 많은 cross-region 참조면 더 큼)
- CPU: refinement thread 별도 워커
- 너무 큰 RSet → coarsening 으로 단순화 (정확도 손실 → 조금 더 스캔)

---

## 4. G1 의 4단계 사이클

### Phase 1: Young GC (STW)

```
1. Initial Mark (RSet scan + STW)
2. Eden + Survivor region 들의 살아있는 객체 → Survivor / Old 로 evacuate (copy)
3. Eden region 통째로 free
```

목표 시간: `MaxGCPauseMillis=200` 이내.

### Phase 2: Concurrent Mark Cycle

Old 영역 의 도달 가능성 추적 — 앱과 병행.

```
┌──────────────┐
│ Initial Mark │  STW (Young GC 와 piggyback)
└──────┬───────┘
       ▼
┌──────────────┐
│ Root Region  │  Survivor 의 root scan (concurrent)
│ Scan         │
└──────┬───────┘
       ▼
┌──────────────┐
│ Concurrent   │  앱과 병행으로 Old graph traversal
│ Mark         │
└──────┬───────┘
       ▼
┌──────────────┐
│ Remark       │  STW. SATB(Snapshot-At-The-Beginning) 처리, 누락 보정
└──────┬───────┘
       ▼
┌──────────────┐
│ Cleanup      │  STW (짧음). region 별 garbage 비율 계산. 100% garbage region 즉시 회수
└──────────────┘
```

### Phase 3: Mixed GC (STW)

Concurrent Mark 후, **garbage 비율 높은 Old region 을 collection set(CSet) 에 포함**시킨 Young GC. 한 번에 모든 Old 가 아니라 **여러 번에 나눠** 처리 → incremental.

```
Mixed GC #1: Young + Old region 1, 2, 3 (가장 garbage 많은 것 우선)
Mixed GC #2: Young + Old region 4, 5
Mixed GC #3: Young + Old region 6
...
```

이렇게 짧은 STW 여러 번 = 저지연 + Old 정리 동시 달성. **Garbage First** 라는 이름의 유래.

### Phase 4: Full GC (단발, STW)

위가 다 실패하면 — 힙 부족, evacuation failure, humongous 단편화 등.

JDK 10+ 부터 **병렬 Full GC** (이전엔 단일 스레드, 매우 길었음). JDK 21 추가 개선.

**Full GC 발생 = 튜닝 실패 신호**. 정상 운영에서는 안 보여야 함.

---

## 5. SATB (Snapshot-At-The-Beginning)

### 문제

Concurrent Mark 도중 mutator 가 참조를 바꾸면 누락이 생길 수 있다.

```
Mark 시작 시: A → B → C (live)

Mark 진행 중 mutator:
   1. A 가 B 참조를 끊음
   2. D 가 C 를 가리키게 됨 (D 는 root)

순진하게 처리하면: B 는 죽었다고 판단 → C 도 죽었다고 판단 → 잘못
```

### SATB 해법

> Mark 시작 시점의 도달성 그래프를 snapshot 으로 보존. **그 시점에 살아있던 모든 객체는 이번 GC에선 살아있다고 간주.**

Write barrier 가 참조 끊김을 감지해서 끊기는 객체를 별도 큐에 추가 → Remark 시 처리.

```kotlin
// Pseudo write barrier
fun setField(obj: Any, field: String, newValue: Any?) {
    val oldValue = obj.field   // 끊기는 참조
    if (oldValue != null && marking_active && !marked(oldValue)) {
        satb_queue.add(oldValue)   // snapshot 보존
    }
    obj.field = newValue
}
```

이 방식의 비용: 일시적으로 garbage 인 객체도 살아있다고 간주 (다음 GC에선 죽음) — **floating garbage**. 한 사이클 손해.

### G1 vs ZGC 의 marking 방식

- G1: SATB
- ZGC: Incremental Update (load barrier 로 읽는 시점에 수정)

차이는 7번에서.

---

## 6. 핵심 옵션

| 옵션 | 의미 | 권장 |
|---|---|---|
| `-XX:+UseG1GC` | G1 활성 | JDK 9+ default |
| `-XX:MaxGCPauseMillis=200` | pause 목표 | 기본 200, latency 민감 시 ↓ |
| `-XX:G1HeapRegionSize=2M` | region 크기 | 기본 자동, humongous 많으면 ↑ |
| `-XX:G1NewSizePercent=5` | Young 최소 비율 | 기본 5% |
| `-XX:G1MaxNewSizePercent=60` | Young 최대 비율 | 기본 60% |
| `-XX:InitiatingHeapOccupancyPercent=45` | Concurrent Mark 시작 점유율 | 기본 45%, 큰 Old 면 ↓ (더 일찍 시작) |
| `-XX:G1MixedGCLiveThresholdPercent=85` | Mixed GC 대상 region 의 live 임계 | 기본 85% — live 가 85% 미만인 region만 |
| `-XX:G1HeapWastePercent=5` | Mixed GC 정리 후 허용 garbage | 기본 5% |
| `-XX:ParallelGCThreads=N` | STW GC 스레드 | CPU 코어 수 기반 자동 |
| `-XX:ConcGCThreads=N` | Concurrent 스레드 | ParallelGCThreads/4 |

### 튜닝 케이스

#### 케이스 1: pause 가 200ms 를 자주 넘음

```
[gc] Pause Young (Normal) 800M->100M(1024M) 280ms   ← 초과
```

대응:
1. `-XX:MaxGCPauseMillis=150` 으로 더 공격적 목표 (G1 이 Young 크기 줄임)
2. `-XX:ParallelGCThreads` 증가 (CPU 여유 있을 때)
3. RSet 비용 의심 → `-XX:+G1SummarizeRSetStats` 로 진단

#### 케이스 2: Mixed GC 가 안 일어나서 Old 점유율이 계속 증가

```
[gc] Old regions: 800->800(2048)   ← 정리가 안 됨
```

대응:
1. `-XX:InitiatingHeapOccupancyPercent=35` (Concurrent Mark 더 일찍 시작)
2. `-XX:G1MixedGCLiveThresholdPercent=90` (live 가 더 많은 region 도 청소 대상)
3. Old 가 정말 살아있는 객체 많으면 힙 부족 신호 → `Xmx` 증가 또는 누수 의심

#### 케이스 3: Humongous 가 많음

```
[gc] Humongous regions: 50->40(2048)   ← 자주 발생
```

대응:
1. `-XX:G1HeapRegionSize=8M` (region 크기 ↑ → humongous 임계 ↑)
2. 코드 수정 — 큰 List/byte[] 분할

---

## 7. msa 컨텍스트

### 현재 (Jib + 1Gi limit)

- 힙 ~750MB (MaxRAMPercentage=75)
- region size = 750MB / 2048 ≈ 384KB → 자동으로 1MB 로 보정
- Humongous threshold = 512KB
- 일반적인 DTO/Entity 는 humongous 가 안 되지만 **`findAll()` 결과 List** 는 위험

### 검증할 옵션 (21번 파일에서 ADR 후보로 정리)

```kotlin
jvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=75.0",
    "-XX:+UseG1GC",                      // 명시 (default 이지만 의도 명확화)
    "-XX:MaxGCPauseMillis=150",          // 200 → 150 (gateway/order 같은 latency 민감 서비스)
    "-XX:InitiatingHeapOccupancyPercent=40",  // 더 일찍 concurrent mark
    "-Xlog:gc*,gc+heap=debug,gc+age=trace:file=/var/log/gc.log:time,uptime,level,tags:filecount=5,filesize=10M",
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/heapdump",
    "-XX:+ExitOnOutOfMemoryError",       // OOM 시 즉시 종료 → K8s 재시작
)
```

### Mixed GC 가 충분히 도는지 모니터링

```promql
# Prometheus + Micrometer
rate(jvm_gc_pause_seconds_count{action="end of minor GC", gc="G1 Young Generation"}[5m])
rate(jvm_gc_pause_seconds_count{action="end of major GC", gc="G1 Old Generation"}[5m])
```

Old GC 카운트가 **0** 이면 → Mixed GC 가 안 도는 신호 → Old 가 무한 증가 가능성 → 다음 단계는 Full GC.

---

## 8. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "G1 의 Young 영역 위치 고정" | region 들이 동적 역할. 위치 무관 |
| "Humongous 도 Young" | 항상 Old 카운트 |
| "RSet 이 모든 참조 추적" | cross-region 만. 같은 region 내 참조는 추적 안 함 |
| "Mixed GC = Young GC + Full GC" | Young + 일부 Old region. Full GC 와 다름 |
| "Full GC 가 흔하다" | 운영에선 안 보여야 정상. Full GC 발생 = 튜닝 신호 |
| "MaxGCPauseMillis 만 줄이면 latency 좋아짐" | 너무 줄이면 Young 이 작아져 GC 빈도↑, throughput↓ |
| "G1 = JDK 11 부터 default" | 정확히는 **JDK 9 부터**. JDK 8 은 Parallel default |

---

## 다음 학습

- [07-zgc-deep.md](07-zgc-deep.md) — ZGC 의 다른 marking 방식과 sub-ms pause
- [09-gc-log-analysis.md](09-gc-log-analysis.md) — 위 옵션이 만든 로그 읽는 법
- [14-lab-gc-log.md](14-lab-gc-log.md) — 실제 product 서비스에 G1 로그 적용 실습
