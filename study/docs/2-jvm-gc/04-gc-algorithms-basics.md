---
parent: 2-jvm-gc
seq: 04
title: GC 알고리즘 기본 — Mark-Sweep / Mark-Compact / Copying
type: deep
created: 2026-05-01
---

# 04. GC 알고리즘 기본

## TL;DR

모든 GC 는 **Mark + (Sweep | Compact | Copy)** 의 조합. Mark 는 도달성 분석. Sweep 은 죽은 자리만 비우기 (단편화 발생). Compact 는 살아있는 객체를 한쪽에 모으기 (단편화 해소, 비쌈). Copy 는 다른 영역으로 살아있는 것만 복사 (비싼 공간 비용, 빠른 할당). **Young 은 Copy, Old 는 Mark-Compact** 가 generational GC 의 정석.

```
원본 힙:  [A][_][B][_][C][_][D][_]   (_ = garbage)

Mark-Sweep:
   ▼
       [A][_][B][_][C][_][D][_]   ← 자리는 그대로, 죽은 것만 free list 에
       단편화 ↑

Mark-Compact:
   ▼
       [A][B][C][D][_][_][_][_]   ← 살아있는 것 한쪽으로 압축
       비쌈 (move + 참조 갱신)

Copy:
   ▼ (다른 영역으로)
       [A][B][C][D][_][_][_][_]   ← 살아있는 것만 복사, 원본은 통째로 비움
       빠르지만 공간 2배
```

---

## 1. Mark-Sweep

### 동작

```
1. Mark: GC Root 에서 도달 가능한 객체 표시 (live)
2. Sweep: 표시 안 된 객체 자리를 free list 로 회수
```

### 장점

- **이동 없음** — 객체 주소가 안 바뀜 → 참조 업데이트 불필요
- 구현 단순
- Old 영역에서 객체가 거의 안 죽는 경우 효율적 (live mark 만 함)

### 단점 — Fragmentation

```
GC 후:
   [A][_][_][B][_][C][_][_][D]
       ↑ 4 byte free
                ↑ 2 byte free

새로 8 byte 객체 할당 시도 → 빈 자리 합쳐 8 byte 가 안 되면 OOM
```

연속된 빈 자리(largest free block)가 부족하면 **할당 실패 = OOM**. 누적된 free space 총합은 충분해도.

### CMS (Concurrent Mark-Sweep, deprecated JDK 14)

CMS 는 Mark-Sweep 의 **concurrent 버전** — STW 를 줄였다. 단점 그대로 — Old 가 단편화되어 가끔 Full GC + Compact 동반. JDK 14에서 제거.

---

## 2. Mark-Compact

### 동작

```
1. Mark: 도달 가능한 객체 표시
2. Compact: 살아있는 객체를 메모리 한쪽 끝으로 이동시켜 빈 자리 합치기
3. (이동했으므로) 모든 참조를 새 주소로 업데이트
```

### 장점

- **단편화 해소** — Old 영역에 적합
- 이동 후 bump-pointer 할당 가능

### 단점

- **이동 비용** — 객체 복사 + 모든 참조 (스택 변수, 다른 객체의 필드, JIT 캐시) 갱신
- 거의 항상 STW (모든 참조를 안전하게 갱신해야 하므로)

### 사용처

- Parallel Old GC 의 Old 영역 (STW Mark-Compact)
- G1 의 Full GC 폴백
- Shenandoah / ZGC 의 concurrent 변형 — 핵심 혁신

### Compact 알고리즘 변형

| 방식 | 설명 |
|---|---|
| **LISP2** (Two-Finger) | 양쪽에서 포인터로 hole 과 live 를 swap |
| **Lisp2 변형** | 살아있는 객체만 한쪽으로 스윕 |
| **Sliding Compaction** | 객체 순서 유지하며 한쪽으로 슬라이드 (locality 보존) |

대부분 현대 GC 는 sliding 방식.

---

## 3. Copying (Cheney 알고리즘)

### 동작

힙을 **두 반쪽**(from-space, to-space) 으로 나눈다. 평소엔 from-space 만 사용.

```
1. GC 시: from-space 의 살아있는 객체를 to-space 로 복사
2. 참조를 새 주소로 업데이트 (forwarding pointer)
3. from-space 통째로 비움
4. from ↔ to 역할 교대
```

### 장점

- **할당이 bump-pointer** — 단편화 0
- GC 시간이 **live 객체 수에 비례** — 죽은 객체는 만지지도 않음
- "대부분 객체는 일찍 죽는다" 가설(Weak Generational Hypothesis)에 완벽

### 단점

- **메모리 절반 사용** — 항상 to-space 가 비어있어야 함
- 살아있는 비율이 높으면 비효율 (Old 에 부적합)

### Young Generation 에 최적

Young 객체는 **97~98% 가 죽는다** → 살아있는 2% 만 복사 = 매우 빠름. 그래서 Young 은 Copy GC.

Eden + Survivor 0/1 구조의 정체:
- Eden = 새 할당
- Survivor 0 = from
- Survivor 1 = to (Minor GC 시 swap)

엄밀히는 **Eden + Survivor(from)** 의 살아있는 객체를 **Survivor(to)** 로 복사 — Cheney 의 변형.

---

## 4. Generational Hypothesis

### 약한 세대 가설

> 대부분의 객체는 일찍 죽는다 (short-lived).

실증 측정: 객체의 90~98% 가 첫 GC 도 못 살아남음. 짧은 수명 객체가 대부분 → Young 영역을 빠른 Copy GC 로 자주 돌리는 게 효율적.

### 강한 세대 가설

> Old 객체는 Young 객체를 거의 참조하지 않는다.

이게 성립해야 Young GC 가 Old 스캔 없이 가능 → **Remembered Set / Card Table** 로 예외만 추적.

### 결과: Generational GC

```
Young (Copy) ─→ 자주, 빠르게
   살아남은 것
   ▼
Old (Mark-Compact) ─→ 가끔, 비싸게
```

이 패턴이 Parallel, G1, ZGC Generational, Shenandoah Generational 모두의 뼈대.

### Generational 이 깨지는 워크로드

- **장수 객체가 빠르게 누적** — 큰 캐시, 영구 컬렉션
- **Object pool / 재사용 패턴** — Young 에서 안 죽음
- **Streaming** — 초당 수 GB 할당, 일부가 끝까지 살아남음

이런 경우 ZGC non-generational 이나 큰 Young 세대(`-XX:G1NewSizePercent`)로 대응.

---

## 5. Card Table / Remembered Set

### 문제

Young GC 시 "어떤 Old 객체가 Young 을 참조하는가" 를 알아야 함 (강한 세대 가설이 100% 성립하진 않음). Old 전체 스캔 = 너무 비쌈.

### 해법

#### Card Table (Parallel, Serial)

Old 영역을 **512 byte card** 로 쪼개서 boolean 배열로 표시. Old 객체가 Young 참조를 새로 잡으면 그 card 를 dirty 마킹. Young GC 는 dirty card 만 스캔.

```
Old:    [card0] [card1] [card2] [card3]
dirty:    [.]    [X]    [.]    [X]    ← X 만 스캔
```

#### Remembered Set (G1)

G1 은 region 단위. 각 region 의 **RSet** 이 "이 region 을 가리키는 다른 region들" 을 추적. 6번 파일에서 상세.

#### Write Barrier

**Old 객체.field = Young 객체** 같은 참조가 생길 때 **JIT 가 자동으로 card 를 dirty 마킹**하는 짧은 코드를 끼워넣음. 모든 참조 쓰기에 약간의 오버헤드 (보통 ~1%).

```
// 의사 어셈블리
mov [oldObj.field], youngObj
mov rax, oldObj
shr rax, 9                     // 512-byte card 인덱스
mov [card_table + rax], 0x00   // dirty (0 표시)
```

---

## 6. STW (Stop-The-World)

### 정의

GC 의 일부 phase 동안 **모든 mutator(앱) 스레드가 정지**. 정지 길이 = pause time = latency 의 핵심.

### Safepoint

JVM 은 임의의 지점에서 스레드를 못 멈춘다 — 안전한 지점(safepoint) 에서만 정지 가능. Safepoint 도달 대기 시간이 길면 **safepoint sync time** 이 GC 로그에 찍힘.

```
[1.234s][gc] Pause Young (G1 Evacuation Pause) 800M->100M(1024M) 25.3ms
[1.234s][safepoint] Total time for which application threads were stopped: 0.026s
                                                                              ↑ STW 총합
```

Safepoint 에 늦게 도착하는 스레드 (예: count-down loop 안에 있는 native 호출) → 모든 스레드를 기다려야 함.

### Concurrent

Mark phase 의 일부, sweep, compact 일부를 **앱 스레드와 병행**으로 돌리면 STW 가 짧아짐. 단, write/load barrier 같은 추가 비용.

| GC | STW phase | Concurrent phase |
|---|---|---|
| Serial | 전부 STW | 없음 |
| Parallel | 전부 STW (멀티 GC 스레드) | 없음 |
| G1 | Initial Mark, Remark, Cleanup | Concurrent Mark |
| ZGC | < 1ms 의 small phase 만 | 거의 전부 |
| Shenandoah | < 10ms small phase | 거의 전부 |

---

## 7. 알고리즘 매핑

각 GC 가 어디에 어떤 알고리즘을 쓰는지:

| GC | Young | Old |
|---|---|---|
| Serial | Copy (단일 스레드) | Mark-Compact (단일 스레드) |
| Parallel | Copy (멀티 스레드) | Mark-Compact (멀티 스레드) |
| CMS (deprecated) | Copy | **Concurrent Mark-Sweep** (단편화 발생) |
| G1 | Region-based Copy | Region-based Mark-Compact (incremental) |
| ZGC | (Generational) Region-based Copy | Region-based Concurrent Compact |
| Shenandoah | Region-based Copy | Region-based Concurrent Compact |

핵심: 모든 현대 GC 는 **region 기반** + **concurrent** 화 추세.

---

## 8. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "Sweep = 메모리를 0으로 채움" | 아님. free list 에 등록만. 다음 할당 시 덮어씀 |
| "Compact 는 항상 좋다" | 이동 + 참조 업데이트 = 비쌈. live 객체 많으면 더 비쌈 |
| "Copy 는 메모리 2배 사용" | 정확히는 Young 세대만 두 영역. 전체 힙은 아님 |
| "Generational 이 항상 최적" | 객체가 골고루 오래 살면 generational 효과 떨어짐 → ZGC non-gen 검토 |
| "Concurrent = STW 없음" | 거의 모든 concurrent GC 도 small STW phase 가 있음. 전혀 없는 건 incremental tracing GC 이상의 영역 |
| "Card Table 은 G1 이 안 씀" | G1 도 RSet 구현에 card 비슷한 자료구조 사용. Parallel 의 그것과는 다름 |

---

## 다음 학습

- [05-gc-overview-stw-throughput.md](05-gc-overview-stw-throughput.md) — Serial/Parallel/G1/ZGC/Shenandoah 비교
- [06-g1gc-deep.md](06-g1gc-deep.md) — Region 기반 Copy + Mixed GC
- [07-zgc-deep.md](07-zgc-deep.md) — Concurrent Compact + Colored Pointer
