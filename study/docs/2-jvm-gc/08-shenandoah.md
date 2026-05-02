---
parent: 2-jvm-gc
seq: 08
title: Shenandoah GC — Brooks Pointer / Concurrent Compaction
type: deep
created: 2026-05-01
---

# 08. Shenandoah GC

## TL;DR

Shenandoah 는 **Red Hat OpenJDK** 가 만든 저지연 GC. ZGC 와 비슷한 목표(짧은 pause, concurrent compact) 지만 **Brooks Pointer** 라는 다른 방식. 객체 헤더 앞에 1 word(8 byte) 의 **forwarding pointer** 를 두어 객체 이동 시 여기를 갱신. ZGC 와 비교한 강점은 **Compressed Oops 호환** 과 **작은 힙(2-4GB) 에서도 효율**. 단점은 객체당 1 word 추가 메타. JDK 17+ 부터 OpenJDK 본가 포함, **배포본별 가용성 차이**가 채택 시 검토 포인트.

```
   객체 레이아웃 (Shenandoah):
   ┌──────────────────┬─────────────────┬──────────────────┐
   │ Forwarding Ptr   │  Object Header   │  Fields...        │
   │ (8 bytes)        │  (mark word + 클래스 포인터)         │
   └──────────────────┴─────────────────┴──────────────────┘
        ↑
        └── 평소: 자기 자신 가리킴
            evacuate 중: 새 위치 가리킴
```

---

## 1. Brooks Pointer

### 핵심 아이디어

객체마다 **자기 시작 주소를 가리키는 포인터** 1 word를 객체 헤더 앞에 둔다. 평소엔 자기 자신을 가리킴.

```
일반 상태:
   객체 X (주소 0x1000)
   ┌──────────────┬──────────┐
   │ fwd: 0x1000  │ fields...│  ← fwd 가 자기 자신
   └──────────────┴──────────┘

객체 이동 중 (concurrent evacuation):
   X 의 옛 자리 (0x1000)        X 의 새 자리 (0x5000)
   ┌──────────────┬──────────┐  ┌──────────────┬──────────┐
   │ fwd: 0x5000  │ stale    │  │ fwd: 0x5000  │ fresh    │
   └──────────────┴──────────┘  └──────────────┴──────────┘
        ↑ 모든 read 가
        │  fwd 따라 0x5000 으로
        │
   기존 reference 들은 0x1000 가리킴 → fwd 통해 안전하게 redirect
```

### Read Barrier

```c
// 의사 코드
read_barrier(ref):
    return ref.fwd     // fwd 를 따라 실제 객체로
```

ZGC 의 load barrier 와 비슷한 역할. 단 Brooks 는 객체 자체에 메타가 박혀 있고 ZGC 는 포인터에 박힘.

### Write Barrier (SATB-style)

Shenandoah 도 마킹용 SATB write barrier 가 있다. ZGC 와 G1 의 중간.

---

## 2. Shenandoah vs ZGC vs G1

### 핵심 비교

| 항목 | Shenandoah | ZGC | G1 |
|---|---|---|---|
| 메타데이터 위치 | 객체 헤더 앞 (Brooks) | 포인터 상위 비트 (Color) | RSet, Card |
| 객체당 추가 | 8 bytes | 0 | 0 (다른 비용) |
| Compressed Oops | **호환 OK** | 불가 | 호환 |
| 최소 권장 힙 | 2GB | 4GB | 1GB |
| 최대 힙 | 수 TB | 16TB | 수 TB |
| Pause 목표 | < 10ms | < 1ms | < 200ms |
| Generational | 작업 진행 중 | JDK 21 GA, JDK 25 only | 항상 |
| OpenJDK 본가 | JDK 17+ | JDK 11+ | JDK 7+ |
| 배포본 가용성 | Red Hat / Adoptium / Temurin OK, **Oracle JDK 미포함** | 모든 배포본 | 모든 배포본 |

### 작은 힙에서 Shenandoah 우위

```
힙 4GB, 객체 100M개
ZGC: compressed oops 손실 = 100M × 4 byte = 400MB 추가 사용
Shenandoah: 객체당 8 byte = 800MB 추가 사용

한 객체 평균 크기에 따라 trade — 객체가 작으면(< 64 byte) Brooks 비중이 큼
                                     객체가 크면 압축 oops 손실이 큼
```

8GB 미만 힙에서 평균 객체 크기가 평범하면 Shenandoah 가 살짝 footprint 우위.

### Pause 차이

ZGC 가 sub-ms, Shenandoah 가 < 10ms 인데, **현실적으로 둘 다 충분**한 경우가 많다. 실시간 트레이딩 같이 < 1ms 가 절실하지 않으면 차이 무의미.

---

## 3. Shenandoah 사이클

```
1. Init Mark             (STW, < 1ms)   → root scan
2. Concurrent Mark                       → 앱 병행 mark
3. Final Mark            (STW, < 1ms)   → mark 종료
4. Concurrent Cleanup                    → 100% garbage region 회수
5. Concurrent Evacuation                 → 살아있는 객체 새 region 으로 복사
                                            (Brooks fwd 갱신, mutator는 read barrier 로 redirect)
6. Init Update Refs      (STW, < 1ms)
7. Concurrent Update Refs                → 모든 reference 새 주소로 갱신
8. Final Update Refs     (STW, < 1ms)   → 마무리
9. Concurrent Cleanup                    → 옛 region 회수
```

ZGC 와 거의 동일한 phase 구성. 차이는 mark 알고리즘과 메타데이터 위치.

---

## 4. 활성화

```bash
-XX:+UseShenandoahGC
```

### 핵심 옵션

| 옵션 | 의미 | 권장 |
|---|---|---|
| `-XX:+UseShenandoahGC` | 활성 | |
| `-XX:ShenandoahGCMode=satb` | mode (satb / iu / passive) | satb 기본 |
| `-XX:ShenandoahGuaranteedGCInterval=120000` | 강제 GC 주기 (ms) | 메모리 회수 보장 |
| `-XX:ShenandoahHeapRegionSize=2M` | region 크기 | G1 과 비슷 |
| `-XX:+UseLargePages` | huge pages | latency 개선 |
| `-XX:ShenandoahUncommitDelay=300000` | 미사용 메모리 OS 반환 지연 | |

### Mode 의 차이

- **satb** (default): G1 처럼 SATB write barrier
- **iu** (Incremental Update): ZGC 처럼 read 시 처리
- **passive**: 디버깅용 (concurrent 끔)

---

## 5. Shenandoah 가 적합한 케이스

### 케이스 1 — 중간 힙 + 저지연 + Compressed Oops 절대 필요

```
힙 6GB, 평균 객체 작음, latency < 5ms 필요
ZGC: oops 손실로 RSS 7-8GB
Shenandoah: 6.5GB 정도 (Brooks 비용)
→ 컨테이너 메모리 절약
```

### 케이스 2 — Oracle JDK 가 아닌 배포본

Red Hat / Temurin / Adoptium / OpenJDK 직접 빌드 — Shenandoah 가용. msa 같이 Eclipse Temurin 25 사용 환경에서는 OK.

### 케이스 3 — JDK 17 환경 (ZGC Generational 없음)

JDK 17 에서 ZGC 는 single-gen → 효율 문제. Shenandoah 가 더 나을 수 있음.

JDK 21+ 에서는 ZGC Generational 우위가 다시 붙음.

### Shenandoah 가 부적합한 케이스

| 워크로드 | 이유 |
|---|---|
| 매우 큰 힙 (16TB) | ZGC 가 여전히 우위 |
| < 1ms pause 절대 필요 | ZGC 가 더 짧음 |
| Oracle JDK 강제 환경 | Shenandoah 미포함 (배포본 정책) |
| Throughput 우선 | Parallel/G1 이 더 나음 |

---

## 6. msa 컨텍스트

### 현재 적합도

msa 는 **Eclipse Temurin 25-jre-alpine** 사용 (Jib config 확인됨). Shenandoah 는 OpenJDK 본가에 JDK 17+ 부터 포함되므로 **사용 가능**.

### 선택 기준 (msa 의 경우)

| 서비스 | 1순위 | 2순위 | 3순위 |
|---|---|---|---|
| product/order/search/member/wishlist (1Gi) | G1 | Shenandoah | ZGC (4Gi+ 로 키우면) |
| gateway (512Mi) | G1 | Shenandoah | (X) |
| analytics (큰 처리) | G1 | Parallel | ZGC |
| quant (트레이딩) | **ZGC (4Gi+)** | Shenandoah | G1 |

### 권장: 일단 G1 유지

10년차 면접 답변 측면에서도 "Shenandoah 를 검토했지만 현재 워크로드에서 G1 으로 충분, 트레이딩 서비스는 ZGC 검토" 가 가장 현실적이고 설득력 있다. 모든 서비스를 ZGC/Shenandoah 로 바꾸는 건 over-engineering.

---

## 7. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "Shenandoah = ZGC 동급" | 비슷한 목표지만 구현 다름. trade-off 다름 |
| "Brooks Pointer = ZGC Colored Pointer" | 위치 다름 (객체 vs 포인터). 효과는 비슷 |
| "Shenandoah 는 Oracle JDK 에 있다" | **없다**. Red Hat / OpenJDK 본가만 |
| "객체당 8 byte 추가 = 항상 손해" | 작은 힙에서는 ZGC 의 oops 손실이 더 큼 |
| "Shenandoah 가 더 안정" | 안정성은 동급. 사용처에 따라 선호 갈림 |
| "Generational Shenandoah 이미 있다" | 작업 진행 중. JDK 25 기준 아직 experimental |

---

## 8. 의사결정 체크리스트

ZGC vs Shenandoah 갈림길에서:

- [ ] 힙 8GB+ 인가? → ZGC
- [ ] Oracle JDK 강제? → Shenandoah 불가 → ZGC
- [ ] 4GB 이하 + 저지연? → Shenandoah
- [ ] < 1ms pause 가 절대 필요? → ZGC
- [ ] Compressed Oops 유지가 메모리 예산상 중요? → Shenandoah

대부분 msa 서비스는 위 체크에서 G1 이 나온다. 그게 정상.

---

## 다음 학습

- [09-gc-log-analysis.md](09-gc-log-analysis.md) — Shenandoah 도 같은 `-Xlog:gc*` 형식
- [14-lab-gc-log.md](14-lab-gc-log.md) — G1 vs ZGC 비교 (Shenandoah 추가 가능)
- [21-improvements.md](21-improvements.md) — msa 의 GC 선택 권장
