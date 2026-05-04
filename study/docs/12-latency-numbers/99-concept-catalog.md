---
parent: 12-latency-numbers
seq: 99
title: Latency Numbers 개념 카탈로그 — 자릿수 + 측정 표준 + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - "Designing Data-Intensive Applications, Ch. 7" (Kleppmann)
  - https://colin-scott.github.io/personal_website/research/interactive_latency.html
  - https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf
  - "The Tail at Scale" (Dean & Barroso, 2013)
  - https://www.brendangregg.com/usemethod.html
  - https://sre.google/sre-book/
  - msa ADR-0025 (latency budget)
---

# 99. Latency Numbers 개념 카탈로그

> **목적** — 12-latency-numbers 의 12+ deep file + Jeff Dean / Kleppmann / Brendan Gregg / SRE Book / msa ADR-0025 기준 빠진 영역 발굴.
> 본 카탈로그는 "단일 reference 가 아닌 자릿수 표준 + 측정 방법 + 분석 도구" 카탈로그.

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 자릿수 어휘 | ns / µs / ms / s | ✅ |
| 메모리 layer | L1 / L2 / L3 / DRAM / SSD / HDD / DC / region | ✅ |
| 네트워크 | RTT region 간 / DC 내 | ✅ |
| 디스크 | random vs seq, NVMe vs SATA | ✅ |
| **2024+ 현대 하드웨어 자릿수** (NVMe / DDR5 / L1-L3 cache / PCIe 4-5 / 클라우드 / Lambda cold start / DB / 벡터 검색 / GPU inference) | 갱신본 자릿수 카탈로그 | ✅ 커버 ([13](13-modern-hardware-latency.md)) |
| msa 적용 | ADR-0025 latency budget | ✅ |
| 측정 | 표준 metric (#10 cross) | 🟡 |

### 1-A. 갭 진단

1. **Memory hierarchy 정확한 자릿수** — L1/L2/L3 cycle 단위, DRAM access ns
2. **TLB miss / Page walk** — virtual memory cost
3. **CPU branch misprediction / pipeline stall**
4. **NUMA cross-socket access cost**
5. **Context switch cost** (Linux ~5µs)
6. **Syscall overhead** (~100ns ~µs)
7. **kernel ↔ userspace 전환 (vDSO, io_uring)**
8. **Lock contention 비용** (uncontended ~25ns vs contended ms 단위)
9. **GC pause 자릿수** — G1 vs ZGC vs Shenandoah
10. **JIT warm-up 영향** — startup latency
11. **TLS handshake** (~tens of ms / 1-RTT vs 0-RTT)
12. **DNS resolution** (~ms - 100ms cold)
13. **HTTP/1 vs HTTP/2 vs HTTP/3 (QUIC)** latency 차이
14. **gRPC vs REST** wire latency
15. **Database round-trip** — local SSD vs network SSD (EBS gp3)
16. **DB lock wait** (deadlock detection 주기 1s default in MySQL)
17. **Kafka producer latency** — batching 전후
18. **Redis cluster MOVED redirect** 비용
19. **CDN edge latency** vs origin
20. **L7 LB** (ALB) vs L4 LB (NLB)
21. **Service mesh sidecar** overhead (~1-3ms)
22. **Container startup** (~tens of ms ~ s)
23. **Cold start (FaaS)** — Lambda / GCF (~hundreds ms ~ s)
24. **JVM startup vs CRaC** — checkpoint restore
25. **Tail latency theory** — "The Tail at Scale" (Dean)
26. **Hedged requests + speculation**
27. **Request slack + Request dropping**
28. **Probability of slow tail** in fan-out (1 - p)^N
29. **P50 vs P95 vs P99 vs P99.9** 의 의미
30. **Latency vs Throughput trade-off** (Little's Law)
31. **Little's Law**: L = λW (concurrency = arrival rate × time)
32. **Queueing theory M/M/1 / M/M/c basics**
33. **Coordinated omission** in benchmarking (HdrHistogram)
34. **HdrHistogram** — accurate latency histogram
35. **Goldilocks zone of latency** — UX 임계 (100ms / 1s / 10s)
36. **Apdex score** — UX 평가
37. **Web Vitals** (LCP / INP / CLS) — frontend latency
38. **Latency Numbers Every Programmer Should Know — 갱신본**
39. **Memory bandwidth (DDR4/DDR5/HBM)** — GB/s
40. **PCIe 4/5 throughput** — NVMe latency 단위
41. **Cloud network: VPC peering / TGW / PrivateLink** 추가 ms
42. **Multi-region latency budget**
43. **End-to-end SLO (front + middle + back)** — budget 분배

---

## 2. 자릿수 표준 카탈로그 (확장)

> Jeff Dean (2009) → Colin Scott interactive (2020) → 2024+ 갱신본 기준.

### 2-A. 메모리 / CPU

| 작업 | 시간 | 비교 (1ns 기준) |
|---|---|---|
| L1 cache reference | 0.5 ns | 1× |
| Branch mispredict | 5 ns | 10× |
| L2 cache reference | 7 ns | 14× |
| Mutex lock/unlock (uncontended) | 25 ns | 50× |
| Context switch | 1-5 µs | 2,000-10,000× |
| Syscall (cached) | 100-500 ns | 200-1000× |
| TLB miss + page walk | 100-500 ns | 200-1000× |
| Main memory reference | 100 ns | 200× |
| NUMA cross-socket | 200-300 ns | 400-600× |

### 2-B. 디스크 / SSD

| 작업 | 시간 |
|---|---|
| NVMe SSD random read 4KB | 10-30 µs |
| NVMe SSD sequential read 1MB | 100-200 µs |
| SATA SSD random read 4KB | 50-150 µs |
| HDD seek | 5-10 ms |
| HDD random read 4KB | 5-15 ms |

### 2-C. 네트워크

| 작업 | 시간 |
|---|---|
| Round-trip within same datacenter | 0.5 ms |
| Round-trip cross-AZ (region 내) | 1-2 ms |
| Round-trip cross-region (US ↔ EU) | 100-150 ms |
| Round-trip cross-region (US ↔ Asia) | 150-200 ms |
| Compress 1KB with zstd | 1-2 µs |
| Send 1MB over 1Gbps network | 8 ms |
| Send 1MB over 10Gbps network | 0.8 ms |

### 2-D. 프로토콜 / 응용

| 작업 | 시간 |
|---|---|
| TLS 1.3 handshake (1-RTT) | 1× RTT (예: 1ms intra-DC, 100ms cross-region) |
| TLS 1.3 0-RTT (resumption) | 0 추가 RTT |
| DNS resolve (cached) | < 1ms |
| DNS resolve (cold) | 10-100 ms |
| HTTP/1.1 keepalive request | RTT + processing |
| HTTP/2 multiplexed | RTT + processing (head-of-line free) |
| HTTP/3 (QUIC) | UDP + 0-RTT possible |
| gRPC unary | RTT + serialization |
| Kafka producer latency (batched) | 1-10 ms typical |
| Redis cluster command | 0.5-2 ms intra-DC |

### 2-E. JVM / GC

| 작업 | 시간 |
|---|---|
| JVM cold startup | 1-10 s |
| JVM warm-up (JIT) | 5-30 s additional |
| **CRaC restore** | 100ms-1s (vs cold) |
| G1 minor GC pause | 5-50 ms |
| G1 mixed GC pause | 50-200 ms |
| ZGC pause | < 1 ms |
| Shenandoah pause | < 10 ms |

### 2-F. Container / Serverless

| 작업 | 시간 |
|---|---|
| Container start (image cached) | 100-500 ms |
| Container start (image pull) | 1-10 s |
| Lambda cold start (Java) | 1-5 s |
| Lambda cold start (Python/Node) | 100-500 ms |
| Lambda warm invoke | 1-10 ms |

---

## 3. 측정 / 분석 표준

### 3-A. Percentile

- **P50** — median
- **P95 / P99 / P99.9** — tail
- **Coordinated omission** — load generator 가 stall 동안 sample drop → 실제 latency 과소평가
- **HdrHistogram** — wide-range + accurate + correctable for coordinated omission
- **Native Histogram (Prom 2.40+)** — sparse exponential bucket

### 3-B. 모델

- **Little's Law**: `L = λ × W` (concurrent in system = arrival rate × residence time)
- **M/M/1 / M/M/c** — 단일/c 서버 큐잉 모델
- **Tail at Scale (Dean)**: fan-out 시 worst-case 가 평균 좌우 — `P(slow ≥ 1) = 1 - (1-p)^N`

### 3-C. 도구

- **wrk / wrk2** — load gen + HdrHistogram
- **k6** — JS-based load gen
- **vegeta** — go-based
- **JMH** (#2 cross) — JVM 마이크로 벤치
- **perf / async-profiler** (#2/#3 cross)
- **eBPF** — bpftrace, BCC, libbpf

### 3-D. 자료

- "The Tail at Scale" (Dean & Barroso, 2013)
- "Designing Data-Intensive Applications" Ch.7 (Kleppmann)
- "USE method" (Brendan Gregg)
- "Latency Numbers Every Programmer Should Know" (Jeff Dean, 2009 + Colin Scott interactive)
- HdrHistogram: https://github.com/HdrHistogram/HdrHistogram

---

## 4. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Tail at Scale + Hedged Requests** | 분산 fan-out 의 latency 표준 |
| 2 | **HdrHistogram + Coordinated Omission** | 정확 측정 표준 |
| 3 | **Little's Law + Capacity planning** | scaling 결정 토대 |
| 4 | **JVM CRaC + AppCDS** | startup latency 절감 |
| 5 | **HTTP/3 (QUIC)** | mobile / 글로벌 latency |
| 6 | **NUMA / cache hierarchy 정확한 자릿수** | low-latency app 진입 시 |
| 7 | **DB local SSD vs network SSD (EBS gp3) latency 비교** | cloud DB 비용 결정 |
| 8 | **Service mesh sidecar overhead** | mesh 도입 시 |
| 9 | **Web Vitals (LCP/INP/CLS) 측정 표준** | frontend latency |
| 10 | **End-to-end latency budget 분배 + ADR-0025 grounding** | Tier 1 SLA 운영 |

---

## 5. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Latency 특화:
- §3 → "측정 도구 + 자릿수 표" 1개
- §6 → "측정 함정 (coordinated omission, warm-up)" 표
- §7 → ADR-0025 의 budget 배분과 연결

---

## 6. 참고 자료

- Jeff Dean keynote (2009): https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf
- Colin Scott interactive: https://colin-scott.github.io/personal_website/research/interactive_latency.html
- "The Tail at Scale" — https://research.google/pubs/pub40801/
- "Designing Data-Intensive Applications" (Kleppmann)
- "Systems Performance" (Brendan Gregg)
- "Site Reliability Engineering" (Google)
- ADR-0025 (msa) — latency budget

> 자릿수는 하드웨어 세대마다 변동 — 본 카탈로그를 갱신할 때 출처 + 측정 시점 명시.
