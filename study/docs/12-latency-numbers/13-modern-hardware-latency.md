---
parent: 12-latency-numbers
seq: 13
title: 2024+ 현대 하드웨어 자릿수 — NVMe / DDR5 / Cloud / Serverless / GPU
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
catalog-row: "§2 자릿수 카탈로그"
---

# 13. 2024+ 현대 하드웨어 자릿수 — NVMe / DDR5 / Cloud / Serverless / GPU

> **목적** — Jeff Dean (2009) 의 자릿수 표는 여전히 "직관" 으로 유효하지만, 2024+ 의 NVMe / DDR5 / cloud / serverless / GPU 환경은 일부 그룹의 절대값이 ×3 ~ ×10 까지 이동했다.
> 본 문서는 99-concept-catalog §2 의 자릿수 표준을 **현대 하드웨어 / 클라우드 환경 갱신본** 으로 확장하고, msa 의 latency budget 에 grounding 한다.
>
> **B 수준 (자릿수 + 메커니즘)** 이 본 문서의 기본. C 수준 (FTL / NUMA balancing / Intel CXL 등) 은 트리거로만.

---

## 1. Why now — 자릿수 표 갱신이 필요한 이유

### 1-A. Jeff Dean 표 (2009) 의 한계

2009 년 LADIS keynote 에서 발표된 "Numbers Everyone Should Know" 는 15년이 지난 지금도 사람들의 머릿속 직관을 지배한다. 하지만 2024+ 의 환경은 다음 4 가지가 크게 달라졌다:

1. **저장 매체** — SATA SSD → NVMe SSD (×5 ~ ×10 빨라짐)
2. **메모리** — DDR3 / DDR4 → DDR5 (대역폭 ×2)
3. **네트워크** — 1 Gbps → 25/100 Gbps NIC, AWS placement group / cluster networking
4. **컴퓨팅 모델** — bare metal → 컨테이너 / serverless (cold start / sidecar overhead 추가)

### 1-B. 갱신의 원칙

본 문서는 다음 원칙으로 자릿수를 갱신한다:

- **자릿수는 보존, 절대값은 갱신** — "ns / µs / ms 그룹" 의 분류는 유효, 다만 각 그룹의 평균이 이동
- **"오해된" 자릿수 명시** — "디스크 seek 10 ms" 같은 옛날 가정이 NVMe 에서 µs 그룹으로 떨어진 것
- **클라우드 별도 그룹** — bare metal 자릿수 + 클라우드 abstraction overhead (sidecar / virtualization / sandbox)
- **출처 명시** — 모든 자릿수는 측정 시점 + 벤더 / 모델 명시

### 1-C. 본 문서의 5 가지 큰 흐름

```
§2 메모리 / CPU 캐시 ─── DDR5, Apple M3 / Zen 4 / Raptor Lake 의 L1-L3
§3 저장 매체     ────── NVMe vs SATA vs HDD, PCIe 4 / 5 throughput
§4 클라우드 인프라 ───── intra-AZ, cross-AZ, cross-region, EBS, S3
§5 컨테이너 / K8s ───── Pod startup, probe, sidecar, kube-proxy
§6 Serverless    ────── Lambda / Cloud Run / Knative cold start
§7 데이터베이스   ────── MySQL 8 / PG 16 / Redis 7 / DynamoDB
§8 벡터 / GPU    ────── HNSW, BBQ quantization, LLM inference
§9 "오해된" 자릿수 ──── 디스크 seek, 네트워크 RTT 의 옛날 가정
§10 msa latency budget ── 각 layer 자릿수 + 합산 cap
§11 자가 점검 + 면접 카드
```

---

## 2. 메모리 / CPU 캐시 — DDR5 와 2024 CPU 의 새 자릿수

### 2-A. DDR5 vs DDR4 — 대역폭은 ×2, latency 는 거의 동일

| 항목 | DDR4-3200 | DDR5-5600 | 비고 |
|---|---|---|---|
| 데이터 전송률 | 3.2 GT/s | 5.6 GT/s | "GigaTransfers per second" |
| 채널당 대역폭 | 25.6 GB/s | 44.8 GB/s | dual-channel = ×2 |
| CL latency (cycles) | CL16-19 | CL36-46 | cycle 수는 ↑ |
| **실제 access latency** | ~14 ns | ~14-15 ns | **거의 동일** |
| Bank group | 4 | 8 | 병렬도 ↑ |

**핵심 직관**:
- DDR5 의 "장점" 은 latency 가 아니라 **bandwidth + 병렬도** 다
- 단일 random access 의 self-time 은 DDR4 와 자릿수 동일 (~14 ns)
- 하지만 DDR5 는 채널 / bank group 분할로 **다중 동시 access 시** 효과적 latency 가 더 작음 (큐잉 효과 감소)

→ "DDR5 = 빠른 메모리" 는 절반만 맞다. **데이터 집약 워크로드 (벡터 검색, OLAP scan)** 에서 ×2 이득, **OLTP single-row read** 에서는 거의 차이 없음.

### 2-B. 2024 CPU 캐시 자릿수 — Apple M3 / AMD Zen 4 / Intel Raptor Lake

| CPU | L1d | L2 | L3 / SLC | DRAM access |
|---|---|---|---|---|
| **Apple M3** (Performance core) | 192 KB / ~3 cycles | 16 MB shared / ~14 cycles | (System Level Cache 24 MB / ~50 cycles) | ~80 ns |
| **AMD Zen 4** (Ryzen 7950X) | 32 KB / 4 cycles | 1 MB / 14 cycles | 64 MB / ~50 cycles (CCD 별) | ~80-100 ns |
| **Intel Raptor Lake** (i9-13900K) | 48 KB / 5 cycles | 2 MB / 16 cycles | 36 MB shared / ~40 cycles | ~80-100 ns |
| (참고: Jeff Dean 2009) | - / 1 ns (3 cycles @ 3GHz) | - / ~7 ns | (없음) | 100 ns |

**핵심 직관**:
- **L1 ~ 3-5 cycles** = ~1-1.5 ns @ 3-5 GHz → 자릿수 그대로 ns 그룹
- **L2 ~ 14-16 cycles** = ~3-5 ns @ 3-5 GHz → ns 그룹 (Jeff Dean 의 L2 ~7 ns 보다 약간 빨라짐)
- **L3 ~40-50 cycles** = ~10-15 ns → ns 그룹 (DRAM 보다 ×5-10 빠름)
- **DRAM ~80-100 ns** → 100 ns 그룹 (Jeff Dean 표 그대로)

→ **자릿수 그룹은 보존**. 다만 L3 가 더 커지고 (24-64 MB), DRAM access 가 살짝 빨라짐 (~80 ns 까지).

### 2-C. NUMA / cross-socket / Apple Unified Memory

#### x86 NUMA (AMD EPYC / Intel Xeon)

- **Local socket DRAM** ~80-100 ns
- **Remote socket DRAM** (cross-socket Infinity Fabric / UPI) ~150-300 ns → ×2-3 cost
- **AMD CCD 간** (같은 socket 내) ~120-150 ns → CCD-aware scheduling 필요

#### Apple Unified Memory (M-series)

- CPU + GPU + Neural Engine 가 **같은 메모리 풀** 공유
- CPU → GPU 메모리 복사 거의 없음 → 머신러닝 / 그래픽 워크로드에 유리
- 단일 access self-time 은 ~80 ns 그대로 (NUMA 없음)

→ **msa 의 의미**: 컨테이너가 여러 NUMA node 에 걸쳐 배치되면 cache miss + cross-socket access 비용 증가. K8s `topologySpreadConstraints` + `numaTopologyManager` 로 single-node 구성 권장.

### 2-D. 캐시 hierarchy 정리 (자릿수 + 비교)

| Layer | 2009 Dean | 2024 (M3 / Zen 4 / Raptor Lake 평균) | 비교 (L1=1×) |
|---|---|---|---|
| L1d | ~0.5 ns | ~1-1.5 ns | 1× |
| L2 | ~7 ns | ~3-5 ns | 3-5× |
| L3 | (없음) | ~10-15 ns | 10× |
| DRAM (local) | ~100 ns | ~80-100 ns | 80-100× |
| DRAM (remote NUMA) | (없음) | ~150-300 ns | 150-300× |

→ **결론**: ns 그룹의 내부 구조는 더 정교해졌지만, **그룹 자체는 그대로**. "DRAM ~ 100 ns" 는 여전히 옳은 직관.

---

## 3. 저장 매체 — NVMe / SATA SSD / HDD / PCIe 4-5

### 3-A. NVMe SSD vs SATA SSD vs HDD — 자릿수 비교 (2024)

| 매체 | random read 4KB | sequential read | IOPS | 가격 ($/TB) |
|---|---|---|---|---|
| **NVMe SSD (PCIe 4.0)** | 10-30 µs | 7,000 MB/s | 1M+ | ~$50-80 |
| **NVMe SSD (PCIe 5.0)** | 8-20 µs | 14,000 MB/s | 2M+ | ~$120-200 |
| **SATA SSD** | 50-150 µs | 550 MB/s | 100K | ~$50-70 |
| **HDD (7200 rpm)** | 5-15 ms | 200 MB/s | ~150 | ~$15-25 |
| (참고: Jeff Dean 2009 SSD) | "1 ms" (보수적) | - | - | - |

**핵심 직관 변화**:
- 2009 에는 "SSD = 1 ms" 였다 → 2024 NVMe 는 ~16 µs (×60 빨라짐)
- **NVMe random read = µs 그룹 확정** → "SSD 도 ms 자릿수" 는 옛날 직관
- SATA SSD vs NVMe = ×5-10 차이 (인터페이스가 dominant)
- HDD seek 자체는 변화 없음 (5-10 ms) — 기계식 한계

### 3-B. PCIe 4.0 vs 5.0 — bandwidth 자릿수

| PCIe 버전 | x4 lane bandwidth | x16 lane bandwidth | 도입 |
|---|---|---|---|
| PCIe 3.0 | 4 GB/s | 16 GB/s | 2010 |
| **PCIe 4.0** | 8 GB/s | 32 GB/s | 2017 (Zen 2 부터 보급) |
| **PCIe 5.0** | 16 GB/s | 64 GB/s | 2022 (Zen 4 / Raptor Lake) |
| PCIe 6.0 | 32 GB/s | 128 GB/s | 2024 (서버용 시작) |

**자릿수 의미**:
- NVMe SSD 가 PCIe 5.0 x4 = 14 GB/s sequential read → 2009 의 SATA SSD (~550 MB/s) 의 ×25
- GPU (NVIDIA H100 PCIe) 가 64 GB/s (PCIe 5.0 x16) → CPU ↔ GPU 데이터 전송이 더 이상 병목 아님
- → **"PCIe 가 병목" 은 옛말** (~2015 까지). 2024+ 는 NAND / GPU 메모리 자체가 병목

### 3-C. NVMe 의 4가지 자릿수 함정

NVMe 에서도 자릿수가 갑자기 ms 그룹으로 점프하는 4 가지 시나리오:

1. **SSD 사용률 80%+ 시 GC** — write amplification + GC stall → P99 가 µs → ms 점프
2. **컨트롤러 thermal throttling** — 노트북 / 데이터센터 NVMe 가 75°C+ 도달 시 throughput 절반
3. **fsync / O_DIRECT** — 캐시 우회 동기 쓰기는 컨트롤러 commit 대기 → 100 µs ~ 1 ms
4. **filesystem journal flush** (ext4 / XFS) — `journal_async_commit` 미사용 시 flush 가 추가 ms

→ **msa 의 의미**: MySQL `innodb_flush_log_at_trx_commit=1` (기본) 은 매 트랜잭션 fsync → P99 가 ~1-2 ms 깔리고 시작 (GC / thermal 시 +ms).

### 3-D. 디스크 자릿수 정리

| 항목 | 2009 (Dean) | 2024 (NVMe PCIe 4) | 그룹 이동 |
|---|---|---|---|
| Random read 4KB | "1 ms" | 10-30 µs | ms → µs 그룹 |
| Sequential 1MB read | (계산: ~30 ms) | ~140 µs | ms → µs 그룹 |
| Read 1MB total | ~20 ms | ~140 µs | ms → µs 그룹 |
| HDD seek | 10 ms | 5-15 ms | ms 그룹 그대로 |

→ **가장 큰 자릿수 이동**. "디스크 = 느리다" 의 옛날 가정이 무너짐.

---

## 4. 클라우드 인프라 — AWS / GCP 의 인스턴스 자릿수

### 4-A. intra-AZ vs cross-AZ vs cross-region

#### AWS (2024 측정값, t3 / c6i 기준)

| 경로 | RTT (P50) | RTT (P99) | bandwidth |
|---|---|---|---|
| **같은 placement group (cluster)** | 50-100 µs | 200-500 µs | 10-25 Gbps |
| **같은 AZ (다른 instance)** | 100-300 µs | 500-1000 µs | 10 Gbps |
| **cross-AZ (같은 region)** | 1-2 ms | 3-5 ms | 10 Gbps |
| **cross-region (us-east-1 ↔ us-west-2)** | 60-80 ms | 100-150 ms | ~수 Gbps |
| **cross-region (us ↔ eu)** | 80-100 ms | 150 ms | ~수 Gbps |
| **cross-region (us ↔ ap)** | 130-180 ms | 200-250 ms | ~수 Gbps |

#### GCP (대략 동등)

| 경로 | RTT |
|---|---|
| 같은 zone | 100-300 µs |
| cross-zone (region 내) | 1-2 ms |
| cross-region (us ↔ eu) | 100-130 ms |

**핵심 직관**:
- **intra-AZ** = µs 그룹 (광속 + 스위칭 자릿수)
- **cross-AZ** = ms 그룹 (5-15 km 거리 + 추가 hop)
- **cross-region** = 큰 ms 그룹 (광속 한계 dominate)
- US east ↔ west = ~70 ms 의 절반 정도가 광속 (4500 km / 0.67c ≈ 22 ms × 2 = 44 ms 광속 한계)

### 4-B. EBS gp3 / io2 Block Express — network attached SSD 자릿수

| 볼륨 타입 | random read P50 | random read P99 | 최대 IOPS |
|---|---|---|---|
| **gp2** (구) | 1-3 ms | 5-10 ms | 16,000 |
| **gp3** | 0.5-2 ms | 3-5 ms | 16,000 (기본) ~ 64,000 (튜닝) |
| **io2** | 0.5-1 ms | 2-3 ms | 64,000 |
| **io2 Block Express** | 0.3-0.7 ms | 1-2 ms | 256,000 |
| **instance store NVMe (직접)** | 10-30 µs | 50-100 µs | 1M+ |
| **참고: 로컬 NVMe (bare metal)** | 10-30 µs | 50-100 µs | 1M+ |

**핵심 직관**:
- EBS = "**network 위 SSD**" → 기본 latency 가 **1 ms 그룹** 으로 시작 (네트워크 RTT 포함)
- instance store NVMe vs EBS = **×30-100 차이** (네트워크 우회 vs 네트워크 통과)
- → **"클라우드 SSD 는 로컬 NVMe 보다 한 자릿수 느리다"** 가 정확한 직관
- io2 Block Express 의 P99 ~2 ms 는 "네트워크 + 컨트롤러 + replication" 의 한계

→ **msa 의 의미**: production 에서 MySQL 을 EBS gp3 위에 올린다면 SSD self-latency (~16 µs) 가 아닌 **EBS RTT (~1-3 ms)** 가 dominant. 캐시 hit 의 가치가 훨씬 큼.

### 4-C. S3 / Glacier / IA — object storage 자릿수

| 티어 | first-byte latency | 가격 ($/GB-월) | 사용처 |
|---|---|---|---|
| **S3 Standard** | 10-200 ms | $0.023 | 일상 객체 |
| **S3 Standard-IA** | 10-200 ms | $0.0125 | 30일 미만 access ↓ |
| **S3 One Zone-IA** | 10-200 ms | $0.01 | 단일 AZ 백업 |
| **S3 Intelligent-Tiering** | 10-200 ms | 자동 | mixed 접근 |
| **S3 Glacier Instant Retrieval** | 100-300 ms | $0.004 | 분기 access |
| **S3 Glacier Flexible Retrieval** | 1-12 hour | $0.0036 | 연간 access |
| **S3 Glacier Deep Archive** | 12-48 hour | $0.00099 | 연 1회 미만 |

**핵심 직관**:
- S3 Standard first-byte ~수십 ms = **ms 그룹** (DB 보다 한 자릿수 느림)
- 그러나 **throughput** 은 압도적 (Multi-part + parallel = GB/s)
- Glacier 는 **분 ~ 시간 자릿수** → "실시간 접근 절대 안 됨"

→ **msa 의 의미**: 상품 이미지 / 백업 / 로그 압축 → S3. 사용자 직접 응답 경로에 S3 호출 들어가면 P99 가 자릿수 점프 (CDN 캐싱 필수).

### 4-D. Cloud abstraction 자릿수 정리

| 경로 | 자릿수 | 비고 |
|---|---|---|
| 같은 placement group | µs (100 µs) | low-latency cluster |
| 같은 AZ | µs (수백 µs) | 일반적 case |
| cross-AZ (HA) | ms (1-3 ms) | replication / failover |
| cross-region | 큰 ms (~100 ms) | DR / 글로벌 |
| EBS gp3 | ms (1-3 ms) | network-attached SSD |
| S3 Standard | 큰 ms (수십 ms) | object access |

→ **K8s 내 "service-to-service" 호출은 cross-AZ 가 default** (HA 위해 다른 AZ 의 Pod). intra-AZ 강제는 `topologySpreadConstraints` + `kube-proxy IPVS mode` 필요.

---

## 5. 컨테이너 / K8s overhead — Pod / Probe / Network

### 5-A. Pod startup 자릿수

| 단계 | 시간 | 비고 |
|---|---|---|
| **Image pull** (캐시 hit) | 0-1 s | imagePullPolicy=IfNotPresent |
| **Image pull** (캐시 miss, ECR/GCR) | 5-30 s | layer 크기에 비례 |
| **Container create** (containerd) | 100-500 ms | OCI runtime spec parse |
| **Process start** (Java JVM cold) | 1-5 s | JVM bootstrap |
| **Process start** (Node.js / Go) | 50-200 ms | runtime warm |
| **Application init** (Spring Boot) | 5-15 s | DI / bean / DB pool |
| **Application init** (Spring Boot + AppCDS) | 2-5 s | shared class archive |
| **Application init** (Spring Boot + CRaC) | 100-500 ms | checkpoint restore |
| **Readiness probe pass** | + 1-3 readiness 주기 | initialDelay + periodSeconds |

**핵심 직관**:
- **image pull = s 그룹** (네트워크 + decompression dominate)
- **container create = ms 그룹** (OS overhead)
- **Spring Boot init = s 그룹** → CRaC 도입 시 ms 그룹으로 이동
- → **K8s Pod 가 "수십 초" 걸리는 게 정상** (Java 의 경우)

### 5-B. Liveness / Readiness probe 자릿수

| 항목 | 자릿수 | 권장 |
|---|---|---|
| HTTP probe RTT | 1-10 ms | timeoutSeconds=1-3 |
| TCP probe | < 1 ms | timeoutSeconds=1 |
| Exec probe | 10-100 ms | exec 자체가 무거우므로 자제 |
| 권장 periodSeconds | 5-10 s | 너무 짧으면 부하 |
| 권장 failureThreshold | 3 | tail latency 흡수 |

**자릿수 함정**:
- Probe 의 P99 가 timeoutSeconds 초과하면 Pod 가 unhealthy 로 마킹 → restart loop
- → **probe latency 가 GC pause / cold cache 보다 짧으면 안 됨**

### 5-C. K8s 네트워크 overhead — kube-proxy / iptables / IPVS / eBPF

| 매체 | latency 추가 | 비고 |
|---|---|---|
| **iptables** (default ≤ ~1k Service) | < 100 µs | linear lookup → service ↑ 시 ↓ |
| **IPVS** (1k+ Service) | < 50 µs | hash table lookup |
| **eBPF** (Cilium) | < 30 µs | kernel bypass syscall |
| **Service mesh sidecar** (Istio Envoy) | 1-3 ms | TLS + L7 처리 |
| **CNI overlay** (Calico VXLAN) | + 50-100 µs | 추가 헤더 + encap |
| **CNI native** (Calico BGP) | < 50 µs | 추가 hop 없음 |

**핵심 직관**:
- **kube-proxy = µs 그룹** (CNI 가 native 일 때)
- **service mesh sidecar = ms 그룹** → fan-out 5단계면 +5-15 ms 누적
- → **mesh 도입은 latency budget 분석 필수** (특히 Tier 1 경로)

→ **msa 의 의미**: gateway → product → MySQL 의 fan-out 에서 mesh sidecar 가 양쪽에 끼면 +2-6 ms 추가. ADR-0025 의 Tier 1 budget (50-100 ms) 의 5-10% 차지.

### 5-D. Container / K8s 자릿수 정리

| 작업 | 자릿수 | 그룹 |
|---|---|---|
| Container start (image cached) | 100-500 ms | ms |
| Container start (image pull) | 5-30 s | s |
| Spring Boot full init | 5-15 s | s |
| Spring Boot + CRaC | 100-500 ms | ms |
| Liveness probe (HTTP) | 1-10 ms | ms |
| K8s Service routing (IPVS) | < 50 µs | µs |
| Service mesh sidecar | 1-3 ms | ms |
| CNI overlay overhead | 50-100 µs | µs |

---

## 6. Serverless cold start — Lambda / Cloud Run / Knative

### 6-A. AWS Lambda cold start 자릿수 (런타임별)

| 런타임 | cold start P50 | cold start P99 | warm invoke |
|---|---|---|---|
| **Python 3.12** | 100-300 ms | 500-1000 ms | 1-10 ms |
| **Node.js 20** | 100-300 ms | 500-1000 ms | 1-10 ms |
| **Go 1.21** | 100-200 ms | 300-500 ms | 1-5 ms |
| **Rust** (Lambda Runtime API) | 50-100 ms | 200-300 ms | 1-3 ms |
| **Java 21 (Coretto)** | 1-3 s | 5-10 s | 1-10 ms |
| **Java 21 + SnapStart** | 100-500 ms | 1-2 s | 1-10 ms |
| **Java 21 + GraalVM AOT** | 200-500 ms | 1-2 s | 1-5 ms |
| **.NET 8** | 500 ms - 2 s | 3-5 s | 1-10 ms |

**핵심 직관**:
- **Native 런타임 (Go, Rust)** = 100 ms 그룹
- **인터프리터 런타임 (Python, Node)** = 100-300 ms 그룹
- **JVM cold** = 1-10 s 그룹 (큰 ms ~ s)
- **JVM + SnapStart / CRaC / AOT** = 100-500 ms 그룹 (×10 개선)

### 6-B. Cold start 의 4가지 비용

```
Cold start = init phase 합산:

1. Container provisioning      (100-500 ms)
   - VM / Firecracker microVM 생성
   
2. Runtime bootstrap           (50-500 ms / Java 1-3 s)
   - JVM / Node / Python 시작
   
3. Function code loading       (10-100 ms)
   - .zip download + unzip + classpath
   
4. INIT handler (cold init)    (10 ms - 수 s, 사용자 정의)
   - DB pool, secret 로드, AWS SDK init
```

→ **사용자가 줄일 수 있는 건 (4)** 뿐. (1)-(3) 은 런타임 / 클라우드 결정.

### 6-C. Cloud Run / Knative — Lambda 와의 비교

| 플랫폼 | cold start | 특징 |
|---|---|---|
| **AWS Lambda** | 100 ms - 10 s | provisioned concurrency 로 0 ms 가능 |
| **Google Cloud Run** | 100-500 ms (대부분) | gen 2 = Firecracker, gen 1 = gVisor |
| **Cloud Run minScale=1** | 0 (always warm) | 비용 ↑ |
| **Knative** (K8s 위) | 100-500 ms | activator 통과 |
| **AWS Fargate** | 30-90 s (full task start) | Lambda 와 다른 모델 |

**핵심 직관**:
- **Lambda** = 짧은 invocation 에 최적, JVM cold 가 함정
- **Cloud Run** = 항상 warm 유지하기 쉬움 (HTTP-driven scale-to-1)
- **Fargate** = container task 단위, "long-running" 용도

### 6-D. Cold start 회피 / 완화 전략

1. **Provisioned concurrency** (Lambda) — cold instance 미리 warm
2. **Reserved concurrency** (Lambda) — 동시 실행 한도 보장
3. **SnapStart / CRaC** (Java) — JVM checkpoint
4. **GraalVM Native Image** (Java/Kotlin) — AOT 컴파일
5. **Lambda + EFS** 회피 — EFS mount 가 추가 cold cost
6. **VPC-attached Lambda** 회피 — ENI provisioning 이 ~수 s 추가
7. **Init handler 최소화** — DB pool 은 lazy, secret 는 cache

→ **msa 의 의미**: 본 프로젝트는 Lambda 미사용 (모든 서비스가 K8s). 그러나 향후 charting / quant 의 일회성 백테스트 / 보고서 생성에 Cloud Run / Lambda 검토 가능. cold start budget 을 ADR-0025 Tier 3 (best-effort) 로 분류 추천.

---

## 7. Database 자릿수 update — MySQL 8 / PG 16 / Redis 7 / DynamoDB

### 7-A. MySQL 8.x InnoDB — single row read / write

| 작업 | self-time (NVMe local) | EBS gp3 위 | 비고 |
|---|---|---|---|
| PK lookup (buffer pool hit) | ~50-200 µs | ~50-200 µs | 메모리 hit |
| PK lookup (buffer pool miss → SSD) | ~100-300 µs | ~1-3 ms | EBS RTT dominate |
| Index range scan (10 rows) | ~200-500 µs | ~1-3 ms | + page read |
| INSERT single row | ~500 µs - 2 ms | ~2-5 ms | + redo log fsync |
| UPDATE with index | ~500 µs - 2 ms | ~2-5 ms | + undo log + redo |
| Full table scan (1M rows) | ~수 s | ~수 s | sequential I/O |

**핵심 변화** (2024 vs 2009):
- 2009 의 "MySQL row read 1 ms" 는 SATA SSD 기준 → 2024 NVMe 는 ~100-300 µs
- 그러나 EBS 위라면 self-time 의 우위가 사라지고 **EBS RTT (~1-3 ms)** 가 dominate
- → "MySQL = 1 ms 자릿수" 는 클라우드 환경에서 여전히 옳음

### 7-B. PostgreSQL 16 — single row 자릿수

| 작업 | self-time (NVMe) | 비고 |
|---|---|---|
| PK lookup (shared_buffers hit) | ~50-200 µs | 메모리 hit |
| PK lookup (miss → SSD) | ~100-300 µs | + 페이지 read |
| INSERT single row | ~500 µs - 1.5 ms | + WAL fsync |
| UPDATE with index | ~700 µs - 2 ms | HOT update / new tuple |
| **VACUUM full** | ~수 s ~ 분 | 테이블 락 |

**MySQL vs PostgreSQL 자릿수 차이**:
- 거의 **자릿수 동일** (둘 다 µs ~ ms 그룹)
- PostgreSQL 의 INSERT 가 약간 빠른 경향 (HOT update + 더 작은 WAL)
- MySQL 8 의 instant DDL 이 PG 보다 빠른 경향
- → **자릿수 의사결정 (둘 중 무엇)** 은 latency 가 아니라 기능/생태계로

### 7-C. Redis 7.x — GET / SET / pipeline

| 작업 | localhost | intra-AZ | cross-AZ |
|---|---|---|---|
| **GET** | 50-100 µs | 100-300 µs | 1-3 ms |
| **SET** | 50-100 µs | 100-300 µs | 1-3 ms |
| **MGET 10 keys** | 100-200 µs | 200-500 µs | 2-5 ms |
| **Lua script (small)** | 100-300 µs | 300-700 µs | 2-5 ms |
| **Pipeline 100 cmd** | 1-3 ms | 2-5 ms | 5-10 ms |
| **Cluster MOVED redirect** | + 1 RTT | + 1 RTT | + 1 RTT |

**핵심 직관**:
- Redis self-time = ~50 µs (메모리 hit + 단일 thread)
- 네트워크 RTT 가 dominate → **intra-AZ µs 그룹, cross-AZ ms 그룹**
- Pipeline / MGET 으로 N 회 RTT → 1 회 RTT 로 amortize → 자릿수 이동

→ **msa 의 의미**: gateway 의 rate-limit token bucket (Redis 사용) 의 P99 budget = ~3-5 ms (cross-AZ + cluster 가능성 고려).

### 7-D. DynamoDB — single-key vs query

| 작업 | latency (P50) | latency (P99) | 비고 |
|---|---|---|---|
| **GetItem** (PK + SK) | 5-10 ms | 20-30 ms | global table 도 동일 |
| **Query** (PK + SK range, 10 items) | 10-20 ms | 30-50 ms | result size 비례 |
| **Scan** (전체 테이블) | 100 ms - 수 s | 수 s | RCU 한도 |
| **BatchGetItem** (25 items) | 10-30 ms | 30-50 ms | parallel |
| **Transaction (TransactGet)** | 20-30 ms | 50-80 ms | 2× normal cost |
| **DAX cache hit** | 0.5-1 ms | 1-3 ms | DAX = DynamoDB 의 캐시 |

**핵심 직관**:
- DynamoDB self = ~5-10 ms (managed service 의 multi-AZ replication + consensus)
- Redis vs DynamoDB = ~×10-30 차이 (Redis self 가 µs vs DynamoDB self 가 ms)
- → "DynamoDB = 빠르다" 는 절반만 맞다. **"안정된 ms"** 가 정확

### 7-E. Database 자릿수 정리표

| DB | single read (cold) | single read (cache hit) | 환경 |
|---|---|---|---|
| MySQL 8 (NVMe local) | ~300 µs | ~100 µs | µs 그룹 |
| MySQL 8 (EBS gp3) | ~3 ms | ~100 µs | ms 그룹 (cold) |
| PostgreSQL 16 (NVMe) | ~300 µs | ~100 µs | µs 그룹 |
| Redis 7 (intra-AZ) | ~200 µs | (메모리만) | µs 그룹 |
| DynamoDB | ~10 ms | (DAX 1 ms) | ms 그룹 |
| Cassandra (NVMe) | ~1-3 ms | ~수백 µs | ms ~ µs |
| MongoDB (NVMe) | ~500 µs | ~100 µs | µs 그룹 |

---

## 8. 벡터 검색 / GPU inference — 2024 의 새 자릿수 영역

### 8-A. 벡터 검색 — HNSW / Flat / BBQ quantization

벡터 검색은 검색의 self-time 외에 **recall** (정확도) trade-off 가 있어 자릿수만으로는 비교 불가. 동일 corpus / k=10 / 768-dim 가정:

| 알고리즘 | latency (1M vec) | recall@10 | 메모리 |
|---|---|---|---|
| **Flat (brute force)** | 100-500 ms | 100% | full vector |
| **HNSW** (M=16, ef=100) | 5-20 ms | 95-98% | full + graph |
| **HNSW + INT8 quantize** | 3-15 ms | 93-96% | 1/4 메모리 |
| **HNSW + BBQ** (Better Binary Quantization, ES 8.x) | 1-5 ms | 90-94% | 1/32 메모리 |
| **IVF** (Inverted File index, faiss) | 5-30 ms | 85-92% | + cluster centroid |
| **IVF + PQ** (Product Quantization) | 3-20 ms | 80-90% | 1/16 메모리 |

**핵심 직관**:
- **Flat = 100% recall, 100 ms 그룹**
- **HNSW = 95% recall, 10 ms 그룹** → 사실상 production 표준
- **BBQ = 92% recall, 1-5 ms 그룹** + **메모리 1/32** → 비용 효율 최강
- → "벡터 검색 = ms 그룹" 이 2024 표준 (HNSW 기반)

### 8-B. ES (Elasticsearch) 8.x 의 벡터 자릿수 (msa 의 search 컨텍스트)

| 시나리오 | latency P99 | 비고 |
|---|---|---|
| BM25 (Best Match 25, 키워드) | 10-30 ms | 기존 검색 |
| KNN (K-Nearest Neighbors, dense vector HNSW) | 10-50 ms | M=16 ef_search=100 |
| KNN + BBQ | 5-20 ms | 8.13+ |
| Hybrid (BM25 + KNN, RRF) | 20-80 ms | 두 검색 합산 |
| KNN + filter (post-filter) | 30-100 ms | filter 강도에 따라 |

→ **msa 의 의미**: search 의 hybrid 검색 (RRF) 은 ~50 ms 그룹. ADR-0025 의 검색 Tier 1 budget 300 ms 안에 충분히 들어감.

### 8-C. GPU inference — text embedding / LLM token

#### Text embedding (e5 / bge-small / nomic-embed)

| 모델 | latency / req (batch=1) | latency / req (batch=32) | GPU |
|---|---|---|---|
| **bge-small-en** (33M) | 5-10 ms | 50-100 ms | T4 / A10 |
| **e5-large** (335M) | 30-50 ms | 200-500 ms | A10 / A100 |
| **nomic-embed-text** (137M) | 15-25 ms | 100-200 ms | A10 |
| (CPU 비교: bge-small) | 50-100 ms | 1-3 s | x86 32-core |

#### LLM token generation (대표 모델, batch=1, GPU)

| 모델 | first-token latency | per-token latency | GPU |
|---|---|---|---|
| **Llama 3.1 8B** (FP16) | 200-500 ms | 10-20 ms (50-100 tok/s) | A10 (24GB) |
| **Llama 3.1 8B** (INT4) | 100-300 ms | 5-10 ms (100-200 tok/s) | T4 / A10 |
| **Llama 3.1 70B** (FP16, multi-GPU) | 500-1000 ms | 30-50 ms (20-30 tok/s) | 2× A100 |
| **Llama 3.1 70B** (INT4) | 200-500 ms | 15-25 ms (40-60 tok/s) | A100 (80GB) |
| **GPT-4o** (API) | 500-1000 ms | 20-40 ms | (Azure / OpenAI) |
| **Claude Opus 4** (API) | 500-1500 ms | 30-60 ms | (Anthropic) |

**핵심 직관**:
- **Embedding** = 5-50 ms / req → ms 그룹
- **LLM 첫 토큰** = 200-1000 ms → 큰 ms 그룹
- **LLM 후속 토큰** = 10-50 ms / token → ms 그룹
- → **"LLM 응답 1 초" 는 GPT-4 가 50 토큰 생성하는 시간** 정도

### 8-D. Batch size 의 효과

```
Throughput / latency trade-off (LLM inference):

batch=1   → latency 작음 (per-token 5 ms), throughput 작음 (200 tok/s)
batch=32  → latency 5× 증가, throughput 30× 증가
batch=128 → memory-bound, throughput 한계 도달
```

→ **online serving** 은 batch 작게 (latency 우선), **offline / batch job** 은 크게.

### 8-E. 벡터 / GPU 자릿수 정리

| 작업 | 자릿수 |
|---|---|
| Flat 벡터 검색 1M | 100 ms |
| HNSW 검색 1M | 10 ms |
| HNSW + BBQ | 1-5 ms |
| Embedding (small model, GPU) | 5-10 ms |
| Embedding (large model, GPU) | 30-50 ms |
| LLM first token | 200-1000 ms |
| LLM per token | 10-50 ms |

---

## 9. 2024 의 "오해된" 자릿수 — 옛날 가정 cleanup

### 9-A. "디스크 seek = 10 ms" — NVMe 시대에 절반은 거짓

**옛날 가정**: HDD 회전 / seek = 10 ms.
**2024 현실**:
- HDD 는 그대로 ms 그룹 (5-15 ms) — 변화 없음
- **그러나 디스크 = HDD 라는 가정이 깨짐**
- NVMe 가 표준 → "디스크 access = µs 그룹" 이 더 흔한 케이스
- → **"DB I/O = ms" 라는 옛날 직관은 EBS / 클라우드 SSD 에서만 유효**

### 9-B. "네트워크 RTT 1 ms" — DC 내 µs 시대

**옛날 가정**: 같은 datacenter 내 RTT = 1 ms.
**2024 현실**:
- **placement group / cluster networking** = ~100 µs (RDMA / SR-IOV)
- 일반 intra-AZ = ~수백 µs ~ 1 ms
- **cross-AZ = 1-3 ms** (multi-AZ HA 구성 시)
- → "DC 내 RTT" 자체가 모호. AZ / placement / VPC peering 명시 필요

### 9-C. "SSD = 1 ms" — NVMe 자릿수 점프

**옛날 가정** (Jeff Dean 2009): SSD random read = 1 ms.
**2024 현실**:
- **NVMe random 4KB = 10-30 µs** → ×30-100 빨라짐
- ms → µs 그룹으로 자릿수 이동
- → 캐시 / 메모리와의 격차가 옛날만큼 크지 않음 → DB 인덱스 / 인메모리 결정 trade-off 변화

### 9-D. "Java cold start = 10 s" — CRaC / SnapStart 시대

**옛날 가정**: Spring Boot Java 앱 cold start = 10 s.
**2024 현실**:
- **CRaC / SnapStart** = 100-500 ms (×20-100 개선)
- **GraalVM Native Image** = 100-500 ms
- → Lambda 같은 환경에서 Java 가 더 이상 cold start 의 최악 시나리오 아님

### 9-E. "Kafka = 메시지 큐" — latency 자릿수 명확

**옛날 오해**: Kafka 는 batch / 비동기 → latency 가 큼.
**2024 현실**:
- producer ack=1 + linger.ms=0 = ~1-5 ms (intra-AZ)
- producer ack=all = ~5-15 ms (replication)
- consumer poll = ~수 ms (long poll)
- → Kafka 자체는 ms 그룹 (RabbitMQ 와 비교해 약간 느린 정도)

### 9-F. "L1 캐시 access = 0.5 ns" — Apple Silicon 의 변동

**옛날 가정** (Jeff Dean 2009): L1d = 0.5 ns.
**2024 현실**:
- Apple M3 P-core L1d = ~3 cycles @ 3.5-4 GHz = ~0.75-0.85 ns
- AMD Zen 4 L1d = 4 cycles @ 5 GHz = ~0.8 ns
- → 자릿수 그대로 ns 그룹, 다만 구체값은 0.5 ns 가 아닌 ~1 ns

### 9-G. "RAM = 100 ns" — NUMA 시대의 미묘함

**옛날 가정**: 메인 메모리 access = 100 ns.
**2024 현실**:
- Local socket DRAM = ~80-100 ns (옳음)
- **Cross-socket** = 150-300 ns (NUMA penalty)
- → "100 ns" 는 single-socket 가정. multi-socket 서버는 thread affinity 중요

### 9-H. 정리 — 갱신 필요한 자릿수 vs 그대로

| 항목 | 옛날 (Dean 2009) | 2024 | 그룹 이동 |
|---|---|---|---|
| L1 cache | 0.5 ns | ~1 ns | ns (유지) |
| L2 cache | 7 ns | 3-5 ns | ns (유지) |
| RAM | 100 ns | 80-100 ns | ns/100 (유지) |
| SSD random | 1 ms | 10-30 µs | **ms → µs** |
| Disk seek | 10 ms | (HDD 한정) 5-10 ms | ms (유지, but NVMe 일반화) |
| DC 내 RTT | 1 ms | 100 µs ~ 1 ms | ms → µs (placement) |
| US-EU RTT | 150 ms | 80-100 ms | ms (광속 한계) |
| Java cold | 10 s | 100 ms-1 s (CRaC) | s → 큰 ms |
| Kafka publish | 1-10 ms | 1-5 ms | ms (유지) |

→ **3 가지 큰 자릿수 이동**: SSD (ms→µs), Java cold (s→ms), DC 내 RTT (ms→µs).

---

## 10. msa 의 latency budget — 각 layer 자릿수 + 합산 cap

### 10-A. msa Tier 1 경로 layer-by-layer

ADR-0025 의 Tier 1 (사용자 직접 응답) P99 budget 100 ms 의 layer 별 자릿수:

#### 시나리오: 상품 상세 조회 (cache miss → MySQL hit)

```
[Client]
  │  외부 인터넷 RTT (사용자 위치별 ~10-100 ms)
  │
[ALB / Ingress]
  │  ALB 처리 (~1-3 ms) — TLS handshake (1-RTT cached)
  │
[K8s Ingress (nginx)]
  │  L7 라우팅 (~100-500 µs)
  │
[gateway Pod]
  │  Spring 필터 + 인증 (~1-5 ms)
  │  → service mesh sidecar (있다면 +1-3 ms)
  │
[K8s Service (kube-proxy IPVS)]
  │  routing (~50 µs)
  │  CNI (Calico) (~50-100 µs)
  │
[product Pod]
  │  Spring controller / service (~500 µs - 2 ms)
  │
[Redis (cache lookup, MISS)]
  │  intra-AZ RTT (~200-500 µs)
  │  Redis self (~50 µs)
  │
[product Pod 다시]
  │  cache miss → DB 조회 결정 (~100 µs)
  │
[MySQL (PK lookup, buffer pool hit)]
  │  intra-AZ RTT (~200-500 µs)
  │  MySQL self (~100-300 µs)
  │
[product Pod 다시]
  │  Redis SET (writeback) (~500 µs intra-AZ + 50 µs self)
  │  Spring 응답 직렬화 (~500 µs)
  │
[gateway Pod 역방향 = 위와 대칭]
[ALB / Ingress 역방향]
[Client]

총 server-side: ~10-15 ms (cache miss 시)
+ 외부 RTT: ~10-100 ms (지역별)

E2E P99: 50-100 ms (Tier 1 budget 100 ms 와 일치)
```

### 10-B. layer 자릿수 합산 표

| Layer | 자릿수 | budget 분배 (Tier 1, 100 ms 중) | 측정 도구 |
|---|---|---|---|
| 외부 인터넷 RTT | 10-100 ms | 50% (50 ms) | Real User Monitoring |
| ALB / Ingress | 1-5 ms | 5% (5 ms) | ALB CloudWatch / Ingress metrics |
| Service mesh sidecar (×2) | 2-6 ms | 5% (5 ms) | Istio metrics |
| gateway Spring 필터 | 1-5 ms | 5% (5 ms) | Micrometer http_server_requests |
| K8s service / CNI | 0.5 ms | 1% (1 ms) | (보통 측정 안 함) |
| backend Spring 처리 | 1-3 ms | 5% (5 ms) | Micrometer |
| Redis (cache hit) | 0.3-1 ms | 1% (1 ms) | Lettuce metrics |
| MySQL (PK + buffer pool hit) | 0.3-1 ms | 5% (5 ms) | HikariCP + slow query log |
| MySQL (cache miss → SSD) | 1-3 ms | 10% (10 ms) | (위와 동일) |
| MySQL (EBS gp3 P99 spike) | 5-10 ms | 추가 budget | EBS CloudWatch |
| GC pause (G1) | 5-50 ms | tail (P99 영향) | JFR + GC log |
| GC pause (ZGC) | < 1 ms | 무시 가능 | (위와 동일) |
| 응답 직렬화 (Jackson) | 0.5-2 ms | 2% | profiling |

**합산 cap 규칙**:
- 동기 직렬 호출: 자릿수 합산 (sum)
- 병렬 호출: 자릿수 max (worst-case 가 budget 결정)
- fan-out N: max(N) 의 P99 ≈ 단일 P99 × log(N) (Tail at Scale)

### 10-C. layer 별 자릿수 위반 시 영향도

```
영향도 (P99 budget 100 ms 기준):

CRITICAL (자릿수 점프 위험):
- GC pause (G1 mixed) ─── +50-200 ms ─── ZGC 전환 검토
- EBS gp3 P99 spike ──── +5-30 ms ──── instance store / io2 검토
- cross-AZ DB ──────── +1-3 ms × N hop ── intra-AZ pinning
- LLM inference ────── +200-1000 ms ── async / streaming
- Lambda cold start ── +500-3000 ms ── provisioned concurrency

WARNING (budget 의 10%+):
- Service mesh sidecar ─ +2-6 ms ── 필요한 경로만 mTLS
- Cache miss (full) ──── +3-10 ms ── pre-warming
- TLS handshake (cold) ─ +1-100 ms ── 0-RTT / session resumption

ACCEPTABLE (budget 의 1-5%):
- K8s service routing ─ +100 µs
- CNI overlay ──────── +100 µs
- Spring 필터 ──────── +1-5 ms
```

### 10-D. msa 별 권장 자릿수 cap

ADR-0025 의 Tier 1 / 2 / 3 + 본 문서의 layer 분석을 종합:

| 경로 | layer 합산 cap | 비고 |
|---|---|---|
| Tier 1: 단순 조회 (cache hit) | 50 ms | 외부 RTT + 서버 ~5ms |
| Tier 1: cache miss → DB | 80 ms | + DB ~3ms (tail +30ms) |
| Tier 1: 검색 (ES) | 300 ms | ES P99 ~100ms |
| Tier 1: 주문 생성 (동기) | 100 ms | DB + Kafka |
| Tier 1: LLM 응답 (stream) | first-token < 1s | streaming 필수 |
| Tier 2: Kafka consumer | 1000 msg/s | partition scale |
| Tier 3: OLAP 대시보드 | 5 s | ClickHouse |

### 10-E. 본 문서가 ADR-0025 에 추가할 항목

ADR-0025 갱신 시 (분기마다) 다음 항목 추가 권장:

1. **§4 의 클라우드 자릿수** — intra-AZ / cross-AZ / cross-region 명시값
2. **§5 의 K8s overhead** — service mesh / CNI 자릿수
3. **§7 의 EBS RTT** — MySQL / PostgreSQL self-time + EBS RTT 분리
4. **§8 의 LLM / 벡터** — 새 워크로드 (chatbot / search v2) 의 budget
5. **§9 의 옛날 가정 cleanup** — "SSD = 1 ms" 같은 옛날 직관 폐기

---

## 11. 자가 점검 + 면접 답변 카드

### 11-A. 자가 점검

- [ ] DDR4 vs DDR5 의 차이가 latency 가 아닌 bandwidth 임을 설명할 수 있다
- [ ] 2024 CPU 의 L1/L2/L3 자릿수 (1 ns / 5 ns / 15 ns) 를 안다
- [ ] NVMe random 4KB 가 ~16 µs 임을 외운다
- [ ] PCIe 4 vs 5 의 lane bandwidth (8 vs 16 GB/s per lane) 를 안다
- [ ] AWS intra-AZ vs cross-AZ vs cross-region 의 RTT 를 자릿수로 구분 (~100 µs / 1-3 ms / 100 ms)
- [ ] EBS gp3 의 P99 가 instance store NVMe 대비 ×30-100 느림을 안다
- [ ] S3 first-byte 가 ~수십 ms 그룹임을 안다
- [ ] K8s Pod startup 의 4 단계 (image pull / create / runtime / app init) 자릿수 분리 가능
- [ ] Service mesh sidecar 가 ms 그룹 overhead 임을 안다
- [ ] Lambda Java cold start 가 ~1-5 s, SnapStart 시 ~500 ms 임을 안다
- [ ] HNSW 가 Flat 대비 ×100 빠름을 자릿수로 안다 (10 ms vs 1 s)
- [ ] LLM first-token 이 ~수백 ms ~ 1 s 그룹임을 안다
- [ ] 2009 의 "SSD = 1 ms" 가 2024 NVMe 에서 µs 그룹으로 이동했음을 안다
- [ ] msa 의 Tier 1 budget 100 ms 의 layer 별 분배 (외부 RTT 50 + 서버 ~10) 를 안다

### 11-B. 면접 답변 카드

**Q1: "Jeff Dean 의 latency 표 (2009) 가 지금도 유효한가요?"**

> 자릿수 그룹 (ns / µs / ms) 의 분류는 여전히 유효하지만, **3 가지 큰 변화** 가 있어요. 첫째, SSD 가 ms 에서 µs 로 한 자릿수 떨어졌습니다 (NVMe 가 표준이 되며 ~16 µs). 둘째, Java cold start 가 CRaC / SnapStart 로 s 에서 100 ms 그룹으로 이동했어요. 셋째, DC 내 네트워크가 placement group / cluster networking 으로 µs 그룹까지 떨어졌습니다. 다만 **광속 한계인 cross-region RTT 는 변화 없어요** — 미국-유럽 간 ~100 ms 는 물리 법칙이라.

**Q2: "EBS 와 instance store NVMe 의 차이가 그렇게 큰가요?"**

> 자릿수가 달라요. instance store NVMe 는 PCIe 직결로 random 4KB ~16 µs, EBS 는 네트워크 attached SSD 라 RTT 포함 ~1-3 ms 입니다. **약 ×30-100 차이.** 그래서 production 에서 MySQL 을 EBS gp3 위에 올리면 self-time (µs) 보다 EBS RTT (ms) 가 dominant 해서, 캐시 hit 의 가치가 훨씬 커집니다. 큰 IOPS 가 필요하면 io2 Block Express 또는 instance store NVMe + replication 으로 고민합니다.

**Q3: "DDR5 가 DDR4 보다 빠른가요?"**

> **bandwidth** 는 ×2 이지만 **single access latency 는 거의 동일** (~14 ns) 합니다. DDR5 의 장점은 채널 / bank group 분할로 다중 동시 access 시 효과적 latency 가 작다는 것. 그래서 데이터 집약 워크로드 (벡터 검색, OLAP scan) 에서 ×2 이득이지만, OLTP single-row read 에서는 차이가 거의 없어요.

**Q4: "Lambda cold start 어떻게 줄이나요?"**

> 4 가지 비용 중 (1) container provisioning, (2) runtime bootstrap, (3) code loading 은 클라우드가 결정하고, **(4) INIT handler 만 사용자가 줄일 수 있습니다.** DB pool / secret 로드 / SDK init 을 lazy 로 하거나, 또는 자릿수 자체를 옮기는 방향으로 — Java 라면 SnapStart / CRaC / GraalVM Native Image 로 s 에서 100 ms 그룹 이동, 또는 provisioned concurrency 로 cold = 0 보장. msa 본 프로젝트는 Lambda 미사용이지만 향후 charting / quant 의 일회성 백테스트 같은 데 검토할 수 있어요.

**Q5: "벡터 검색에서 HNSW vs Flat 차이?"**

> Flat 은 brute force (모든 벡터와 거리 계산) → 100% recall 이지만 1M 벡터에 100-500 ms. HNSW 는 graph-based 근사 검색 → recall 95-98% 에 ~10 ms. **자릿수 ×30-100 차이.** Production 에서는 사실상 HNSW 표준이고, ES 8.13+ 의 BBQ (Better Binary Quantization) 를 추가하면 메모리 1/32 + latency 1-5 ms 까지 떨어져요. msa 의 search 컨텍스트에서는 hybrid (BM25 + KNN) RRF 로 ~50 ms 그룹.

**Q6: "K8s 환경에서 latency budget 어떻게 분배하나요?"**

> Tier 별로 layer 자릿수를 합산합니다. Tier 1 (사용자 직접 응답) 100 ms budget 이면 외부 RTT 50 ms + 서버 ~10-15 ms 가 baseline 이고, 그 안에서 ALB ~3 ms / Spring 필터 ~3 ms / DB ~3 ms / 응답 직렬화 ~1 ms 같이 분배합니다. 자릿수 점프 위험은 GC pause (G1 +50-200 ms), EBS spike (+5-30 ms), service mesh sidecar (+2-6 ms) 가 critical 이라 ZGC 전환 / instance store / 필요한 경로만 mTLS 같이 대응합니다. msa 에서는 ADR-0025 에 명문화돼 있어요.

**Q7 (꼬리): "광속 한계는 진짜 못 깨나요?"**

> 진공에서 ~30 만 km/s, 광섬유에서 ~20 만 km/s 라 미국 동서 (4500 km) 가 편도 22 ms 광속, 왕복 44 ms 광속 한계입니다. 실제 RTT 60-80 ms 는 광속 한계 + switching / routing overhead. **이건 못 깹니다** — edge / CDN 으로 사용자 가까이 데이터를 옮기는 게 유일한 방법이에요. AWS Global Accelerator / CloudFront / Cloudflare 가 이걸 하죠. 진정한 글로벌 분산 강일관성 (Spanner 같은) 은 광속 + Paxos 동의로 cross-region commit 이 본질적으로 ~100 ms 단위 입니다.

**Q8 (꼬리): "msa 에 LLM 도입한다면 budget 어떻게 잡나요?"**

> LLM first-token 이 200 ms - 1 s 그룹이라 동기 응답에 끼면 Tier 1 (100 ms) 못 맞춰요. 두 전략 — (a) **streaming** 으로 first-token 까지의 latency 만 SLA 잡고 (~1 s) 나머지는 client 가 progressive render. (b) **fully async** 로 Kafka 통해 별도 처리 (chat 응답을 polling / push 로 전달). 본 프로젝트의 chatbot 서비스가 향후 추가되면 Tier 1 의 별도 sub-tier (LLM-streaming) 로 빼서 first-token P99 1-2 s 로 합의하는 게 현실적입니다.

---

## C 수준 확장 트리거

본 문서는 B 수준 (자릿수 + 메커니즘) 까지. 다음 주제는 별도 학습 시 확장:

- **Intel CXL** (Compute Express Link) — DDR5 와 다른 메모리 hierarchy
- **GPUDirect RDMA** — GPU ↔ network 직결, CPU 우회
- **HBM3 / HBM3e** — H100 / B100 의 메모리 (3 TB/s+)
- **NVMe-oF (NVMe over Fabric)** — 네트워크 NVMe의 µs 그룹 회복
- **DPDK / SPDK** — userspace network / storage stack
- **AWS Nitro System** — hypervisor offload, EC2 의 latency 단축 origin
- **Firecracker microVM** — Lambda / Fargate 의 ~100 ms cold start 본질
- **DAX (Direct Access)** — Persistent Memory 의 mmap-able SSD
- **Intel Optane** (단종됨) — DRAM-like + persistent
- **Mojo / SIMD intrinsics** — CPU 캐시 friendly 코드
- **Continuous Profiling** (Pyroscope, Parca) — production 의 자릿수 변동 상시 추적

---

## 다음 액션

1. **본 문서의 §10-E** 항목들을 ADR-0025 갱신 PR 의 입력으로 활용
2. **분기 측정 갱신** — production 의 NVMe / EBS / cross-AZ RTT 실측 후 §4 / §7 갱신
3. **msa 신규 워크로드 (LLM, 벡터)** 도입 시 본 문서의 §8 자릿수 입력
4. **참고 문서 cross-link**:
   - [03-memory-vs-storage.md](03-memory-vs-storage.md) — DRAM / SSD / HDD 본질
   - [04-network-physics.md](04-network-physics.md) — 광속 / RTT 본질
   - [09-msa-call-budget.md](09-msa-call-budget.md) — msa 호출 경로
   - [12-adr-draft.md](12-adr-draft.md) — ADR-0025 본문
   - [99-concept-catalog.md](99-concept-catalog.md) — §2 자릿수 카탈로그

---

## 참고 출처

- Jeff Dean, "Numbers Everyone Should Know" (LADIS 2009): https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf
- Colin Scott, Interactive Latency Numbers: https://colin-scott.github.io/personal_website/research/interactive_latency.html
- AnandTech / Chips and Cheese — Apple M3 / Zen 4 / Raptor Lake 캐시 latency 측정 (2023-2024)
- AWS re:Invent 2023 / 2024 — EBS io2 Block Express, Nitro System, Lambda SnapStart
- ScyllaDB Summit talks — NVMe-oF, low-latency database design
- Elasticsearch 8.13 release notes — BBQ (Better Binary Quantization)
- NVIDIA H100 / B100 specs — HBM3, NVLink
- ADR-0025 (msa) — latency budget 표준
- "Designing Data-Intensive Applications" Ch. 7 (Kleppmann) — 자릿수 입문
- "Systems Performance" 2nd ed (Brendan Gregg, 2020) — USE method, NVMe 측정

> 본 문서의 자릿수는 **2024-2025 측정 시점 추정** — 매년 1-2회 갱신 권장. 특히 클라우드 / GPU / serverless 영역은 변동 빠름.
