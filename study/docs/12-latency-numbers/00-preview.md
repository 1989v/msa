---
parent: 12-latency-numbers
type: preview
created: 2026-04-26
---

# Latency Numbers Every Programmer Should Know — Preview

> 학습자 수준: 초급(A) · 전체 예상 시간: 24h · 목표: 자릿수 감각 + 아키텍처 활용 + 면접 대비 30% + ADR-0025 산출
> 계획서: [00-plan.md](00-plan.md) · BS 결정: 00-plan.md 섹션 2.1-2.4

---

## 멘탈 모델: "자릿수 사다리"

L1 캐시부터 대륙 간 RTT 까지 latency 는 **8자리수의 스펙트럼** 위에 분포한다. 절대값을 외우지 않고, **사다리의 칸과 칸 사이 비율**을 감각으로 가진다.

```
 1 ns  ▲ L1 ($1) — CPU 1 cycle
        │  ×3
 ~3 ns ─┤ L2 / 분기 예측 실패
        │  ×30
~100 ns ─┤ DRAM (메모리 random read)               ╲
        │  ×100                                      │ ns 그룹
  ~1 µs ─┤ in-process 함수 호출 / 1KB compress      │ (CPU/메모리)
        │  ×10                                      ╱
 ~10 µs ─┤ 1KB over 1Gbps NIC                       ╲
        │  ×2                                        │
 ~16 µs ─┤ SSD random read                           │ µs 그룹
        │  ×30                                       │ (디스크/근거리 net)
~500 µs ─┤ 같은 DC 내 RTT                           ╱
        │  ×4
  ~2 ms ─┤ HDD seek                                  ╲
        │  ×5                                        │ ms 그룹
 ~10 ms ─┤ 같은 리전 다른 AZ RTT                     │ (원거리 net)
        │  ×10                                       │
~100 ms ─┤ 한국→미국 RTT (대륙 간)                  │
        │  ×1.5                                      │
~150 ms ▼ CA → Netherlands → CA (Jeff Dean 표 원전) ╱
```

**핵심 비율 5개만 외운다**:
1. **L1 → DRAM ≈ ×100** (캐시 친화 코드가 빠른 이유)
2. **DRAM → SSD ≈ ×1000** (메모리 캐싱이 디스크보다 압도적인 이유)
3. **SSD → 같은 DC RTT ≈ ×30** (Redis 가 로컬 디스크보다 가끔 느린 이유)
4. **같은 DC → 대륙 간 RTT ≈ ×300** (멀티 리전이 느린 이유 = 광속 한계)
5. **평균 → P99 ≈ ×3~10** (tail latency 가 실제 사용자 경험을 결정)

---

## 소주제 지도

> 12개 deep file 로 분할. 각 파일 평균 ~2h.

### Phase 1 자릿수 지도 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 자릿수 사다리 + 인접 비율 | [01-orders-of-magnitude-map.md](01-orders-of-magnitude-map.md) | ns/µs/ms 그룹핑 + 영상/Colin Scott/Jeff Dean 정독 |

### Phase 2 핵심 메커니즘 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 02 | CPU 캐시 | [02-cpu-cache.md](02-cpu-cache.md) | cache line / hit-miss 자릿수 / false sharing 실무 예 |
| 03 | DRAM vs SSD vs HDD | [03-memory-vs-storage.md](03-memory-vs-storage.md) | 전기 신호 ns / NAND 4KB µs / seek+회전 ms |
| 04 | 네트워크 물리 | [04-network-physics.md](04-network-physics.md) | 광속 한계 RTT 계산 / BDP / DC vs 리전 vs 대륙 |
| 05 | tail latency + fan-out | [05-tail-and-fanout.md](05-tail-and-fanout.md) | P99/P999 / fan-out 곱셈 / Little's Law |

### Phase 3 풀 실측 + 벤치마크 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 06 | 기본 실측 baseline | [06-baseline-measurement.md](06-baseline-measurement.md) | redis-cli --latency / curl -w / ping / mtr / dd |
| 07 | 부하 테스트 + tail 측정 | [07-load-test-tail.md](07-load-test-tail.md) | wrk / k6 + 캐시 hit ratio 0/50/100% 실험 |
| 08 | Observability 셋업 | [08-observability-setup.md](08-observability-setup.md) | Prometheus + Grafana + Micrometer (10번 prerequisite) |
| 09 | msa 호출 경로 budget | [09-msa-call-budget.md](09-msa-call-budget.md) | gateway → product → MySQL/Redis/ES/Kafka 자릿수 라벨 |

### Phase 4 면접 대비 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 10 | 함정 / 오해 포인트 | [10-pitfalls.md](10-pitfalls.md) | 평균 vs P99 / hit ratio 함정 / latency↔throughput 혼동 |
| 11 | 면접 Q&A 트리 + 실측 스토리 | [11-interview-qa.md](11-interview-qa.md) | 6-8개 질문 × 꼬리 2단계 + Phase 3 실측 일화 답변화 |

### Phase 5 코드베이스 산출물 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 12 | ADR-0025 초안 작성 | [12-adr-draft.md](12-adr-draft.md) | `docs/adr/ADR-0025-latency-budget.md` PR-ready 초안 |

---

## 개념 관계도

```
                 ┌─────────────────────────────┐
                 │   Phase 1: 자릿수 사다리    │
                 │   (ns / µs / ms 그룹핑)     │
                 └──────────────┬──────────────┘
                                │ "왜 그 차이?"
                ┌───────────────┼───────────────┐
                ▼                               ▼
     ┌─────────────────────┐       ┌──────────────────────┐
     │ Phase 2 하드웨어    │       │ Phase 2 분산 응용    │
     │  02 CPU 캐시        │       │  05 tail latency     │
     │  03 메모리/디스크   │       │     fan-out          │
     │  04 네트워크 물리   │       │     Little's Law     │
     └──────────┬──────────┘       └──────────┬───────────┘
                │                              │
                └──────────────┬───────────────┘
                               │ "내 시스템에선?"
                               ▼
              ┌────────────────────────────────────┐
              │  Phase 3 풀 실측                  │
              │   06 baseline (redis-cli/curl)    │
              │   07 부하 테스트 (wrk + tail)     │
              │   08 Prom+Grafana 시각화          │
              │   09 msa 호출 경로 budget         │
              └─────────────────┬──────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
     ┌─────────────────────┐       ┌──────────────────────┐
     │ Phase 4 면접 대비   │       │ Phase 5 팀 자산      │
     │  10 함정 포인트     │       │  12 ADR-0025 초안    │
     │  11 Q&A + 스토리    │       │  (latency budget     │
     │                     │       │   표준 가이드)        │
     └─────────────────────┘       └──────────────────────┘
                │                               │
                └──────────────┬────────────────┘
                               ▼
                ┌─────────────────────────────┐
                │  연계 학습: 7→9→10→8        │
                │  (12번이 자릿수 어휘 제공)  │
                └─────────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 자릿수 그룹 — 머리에 그리기

| 그룹 | 범위 | 대표 케이스 |
|---|---|---|
| **ns 그룹** | 1 ns ~ 100 ns | L1/L2/L3, 분기 예측 실패, mutex, DRAM |
| **µs 그룹** | 1 µs ~ 500 µs | 메모리 1MB 순차, NIC 1Gbps, SSD random, 같은 DC RTT |
| **ms 그룹** | 1 ms ~ 200 ms | HDD seek, 같은 리전 다른 AZ, 대륙 간 RTT |

### 외워야 할 비율 5개 (절대값 X)

```
L1 → DRAM        ≈ ×100      (캐시 친화 코드)
DRAM → SSD       ≈ ×1000     (메모리 캐싱 압승)
SSD → DC RTT     ≈ ×30       (Redis vs 로컬 디스크)
DC → 대륙 간 RTT ≈ ×300      (광속 한계)
평균 → P99       ≈ ×3~10     (tail latency)
```

### 빠른 판단 트리

**"이 호출은 몇 µs/ms?"** 자릿수 사다리에서 가장 가까운 칸 찾기
**"왜 캐시가 필요?"** 자릿수 비율로 답 (메모리 vs 디스크 vs 네트워크)
**"멀티 리전 좋은가?"** RTT 비용 ×300 trade-off
**"평균은 빠른데 사용자가 느리다?"** P99 / fan-out 곱셈 의심
**"latency 줄이면 throughput 도?"** Little's Law (L = λW), 직접 비례 X

### 자주 쓰는 측정 도구 한 줄

| 도구 | 측정 대상 | 자릿수 |
|---|---|---|
| `redis-cli --latency` | Redis RTT | µs ~ ms |
| `curl -w '@fmt'` | HTTP latency 분해 (DNS/connect/TTFB) | ms |
| `ping`, `mtr` | 네트워크 RTT | µs ~ ms |
| `dd if=... of=...` | 디스크 read/write throughput | MB/s |
| `wrk`, `k6` | 부하 + P50/P99/P999 | ms |

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12**
- Phase 2 (02-05) 는 순서 바꿔도 OK. 단, 05(tail/fan-out) 는 06 실측 직전에 두는 게 좋음 (실측에서 P99 측정 의도가 명확해짐)
- Phase 3 (06-09) 는 도구 셋업 효율상 같은 세션에 묶어 진행 추천 (Prometheus/Grafana 한 번 셋업)
- 12 (ADR) 는 09 (msa 호출 경로 budget) 결과를 입력으로 사용하므로 마지막에 작성

각 deep file 호출:
```
/study:exec 12          # 다음 deep file 자동 선택 (01부터 순서대로)
```
또는 사용자가 직접 파일을 지정해 작업 가능.
