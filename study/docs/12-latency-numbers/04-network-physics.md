---
parent: 12-latency-numbers
phase: 2
order: 04
title: 네트워크 물리 — 광속 한계와 BDP
created: 2026-04-26
estimated-hours: 1
---

# 04. 네트워크 물리 — 광속 한계와 BDP

> **B 수준** (핵심 메커니즘): 광속 한계 RTT 계산 / BDP / DC vs 리전 vs 대륙.
> **C 수준** (TCP slow start / congestion control / RDMA / DPDK) 은 확장 트리거로만 언급.

## 0. 이 파일에서 얻을 것

- **광속이 RTT 의 절대 하한** 임을 계산으로 보일 수 있다
- 같은 DC / 같은 리전 다른 AZ / 대륙 간 RTT 가 왜 자릿수로 갈리는지
- **BDP (Bandwidth-Delay Product)** 가 throughput 을 어떻게 제한하는지
- 면접 답변 카드: "한국에서 미국 RTT 가 왜 ~150 ms 인가요?"

---

## 1. 광속 — 모든 네트워크 latency 의 절대 하한

### 핵심 사실

- **진공 중 광속**: 299,792 km/s ≈ **300,000 km/s**
- **광섬유 속도**: ~200,000 km/s (굴절률 ~1.5 때문에 광속의 2/3)
- 즉 **광섬유로 1km 가는데 ~5 µs**

### 거리당 최소 RTT 계산

```
거리 1km   → 편도 ~5 µs   → RTT ~10 µs    (이론 최소)
거리 100km → 편도 ~500 µs → RTT ~1 ms     (인접 도시)
거리 1000km → 편도 ~5 ms  → RTT ~10 ms    (한국 종단)
거리 10,000km → 편도 ~50 ms → RTT ~100 ms (한국 → 미국 동부)
거리 20,000km → 편도 ~100ms → RTT ~200 ms (한국 → 유럽 경유 미국)
```

### 실제로는 이보다 더 느리다

- **광섬유 경로는 직선 아님**: 해저 케이블 우회, 라우팅 hop
- **각 라우터 / 스위치 / 네트워크 장비 통과 시 µs ~ ms 추가**
- **OS 네트워크 스택 처리 시간** (커널 ↔ 유저, TCP/TLS)
- 실제 한국 → 미국 RTT 는 **~150-200 ms** (이론 최소 ~100 ms 의 1.5-2배)

### 핵심 인사이트

- **물리법칙은 깰 수 없다** — 어떤 최적화로도 광속을 못 넘는다
- 멀티 리전 시스템의 latency 는 **거리에 의해 강제됨**
- 해결책은 "더 빠른 네트워크" 가 아니라 **"가까운 곳에 데이터를 복제"** (CDN, edge)

---

## 2. RTT 자릿수 그룹

| 시나리오 | RTT | 자릿수 |
|---|---|---|
| 같은 머신 (loopback) | <100 µs | µs |
| 같은 K8s 노드 (Pod ↔ Pod) | ~100-500 µs | µs |
| 같은 DC 다른 노드 | ~500 µs ~ 1 ms | µs ~ ms |
| 같은 리전 다른 AZ | ~1-5 ms | ms |
| 같은 대륙 다른 리전 | ~30-80 ms | ms |
| 대륙 간 (한↔미, 한↔유럽) | ~100-200 ms | ms |
| 위성 인터넷 (Starlink) | ~30-50 ms | ms |
| 정지 위성 인터넷 (구식) | ~600 ms | 100ms+ |

### 그룹별 의사결정 시사점

- **µs 그룹** (같은 DC): 동기 호출이 자유로움. fan-out 도 부담 적음
- **작은 ms 그룹** (같은 리전 AZ): 동기 호출 가능하지만 fan-out 시 P99 주의
- **큰 ms 그룹** (대륙 간): 동기 호출은 사용자 체감 한계 (250ms+ 는 "느린 사이트")
  → CDN / read replica / 비동기 / 데이터 복제 전략 필수

---

## 3. BDP — Bandwidth-Delay Product

### 정의

```
BDP = bandwidth × RTT
```

- BDP = "송신자가 ACK 받기 전에 link 에 흘려보낼 수 있는 최대 데이터량"
- TCP 의 window 가 BDP 보다 작으면 → link 가 비어있는 시간이 생김 → throughput 손해

### 계산 예

| 시나리오 | bandwidth | RTT | BDP |
|---|---|---|---|
| 같은 DC | 10 Gbps | 0.5 ms | 0.625 MB |
| 같은 리전 AZ | 10 Gbps | 5 ms | 6.25 MB |
| 대륙 간 | 1 Gbps | 150 ms | 18.75 MB |
| 위성 | 100 Mbps | 600 ms | 7.5 MB |

### 의미 — "왜 큰 파일 다운로드가 RTT 에 영향받나"

- TCP window 가 64 KB 기본인데, 대륙 간 BDP 가 18 MB → window 가 BDP 의 1/300 → throughput 도 ~1/300
- 대용량 전송 (백업, 데이터 마이그레이션) 은 RTT 에 의해 throughput 이 결정됨
- 해결: TCP window scaling / 멀티 connection / CDN

### 직관 공식

```
실효 throughput ≈ window / RTT
```

- bandwidth 가 아무리 커도 window 가 작으면 RTT 에 갇힘
- 대륙 간 1Gbps 회선이 실제로는 100 Mbps 도 못 내는 이유

---

## 4. 같은 DC RTT 가 왜 ~500 µs 인가

DC 내부는 거리 수백 m. 광속만 보면 수 µs 인데 왜 500 µs 가 나오는가?

### 구성 요소

```
물리적 광섬유    ~10 µs   (50m 왕복)
스위치 hop ×3-5  ~50 µs   (각 ~10-15 µs)
TCP/IP 처리      ~100 µs  (커널 + NIC 처리)
애플리케이션     ~수십 µs ~ ms (process scheduling 등)
─────────────────────────────────────────
합계             ~500 µs ~ 수 ms
```

### Kernel bypass 의 가치

- DPDK / RDMA / kernel bypass 는 위 ~100 µs 의 "TCP/IP 처리" 를 µs 미만으로 줄임
- 고빈도 트레이딩, HPC, 일부 분산 DB (예: Aerospike) 에서 사용
- 일반 서비스에는 과한 최적화 (다른 latency 가 dominant)

---

## 5. msa 프로젝트와의 연결

### K8s 클러스터 내 latency

- **Pod ↔ Pod 같은 노드** (K8s service ClusterIP): ~100-500 µs
- **Pod ↔ Pod 다른 노드**: ~500 µs ~ 1 ms
- **외부 → Ingress → Pod**: ~1-수 ms (NAT, kube-proxy 통과)
- **Pod → DB (Redis/MySQL)**: 같은 노드면 µs, 다른 노드면 ms 영역 진입

→ msa 의 gateway → product 호출 budget: **µs ~ 작은 ms 그룹** 으로 가정

### 멀티 리전 시 시사점

- 만약 향후 글로벌 사용자 대상 멀티 리전을 한다면:
  - 한국 사용자 → 한국 리전 (RTT µs ~ 작은 ms)
  - 미국 사용자 → 미국 리전 (RTT µs ~ 작은 ms)
  - **리전 간 데이터 동기화는 비동기** (Kafka 미러 메이커 / DB CDC)
  - **strong consistency 는 단일 리전 안에서만** (cross-region 은 ~150 ms RTT 비용)

### 코드 위치 (참고)

- `k8s/overlays/k3s-lite/` — 로컬 K8s 단일 노드 (latency 가장 좋음, 측정용)
- `k8s/overlays/prod-k8s/` — managed K8s (실제 production latency)
- `gateway/` — gateway 가 K8s service DNS 로 라우팅 (Eureka 제거 후, ADR-0019)

---

## 6. 자가 점검

- [ ] 광섬유 속도와 RTT 계산 (~5 µs/km)
- [ ] 한국 → 미국 RTT 자릿수 (~150 ms) + 그 이유 (광속 한계)
- [ ] BDP 정의와 의미 (window / RTT 가 throughput 상한)
- [ ] 같은 DC RTT 가 ~500 µs 인 구성 요소 (광섬유 + 스위치 + TCP + 앱)
- [ ] 멀티 리전 의사결정의 latency 베이스라인

## 7. 면접 답변 카드

**Q: "한국 → 미국 RTT 가 왜 ~150 ms 인가요?"**

> 광속의 물리 한계 때문이에요. 한국과 미국 동부 거리 ~10,000 km 를 광섬유로 가면 (광속의 2/3 속도) 편도 ~50 ms, RTT ~100 ms 가 이론 최소입니다. 거기에 라우터 hop, 케이블 우회 등이 더해져 실제 ~150 ms 가 나와요. 어떤 최적화로도 광속은 못 넘으니, 이 RTT 는 **물리 법칙에 의해 강제** 됩니다.

**Q (꼬리): "그럼 글로벌 서비스는 어떻게 빠르게 하나요?"**

> 데이터를 가까이 둡니다. CDN 으로 정적 컨텐츠를 엣지에 캐시, read replica 로 DB 를 리전마다 두고, 사용자 가장 가까운 리전으로 라우팅. write 는 보통 단일 리전이고 다른 리전엔 비동기로 복제합니다. consistency 가 약해지는 trade-off 를 받아들이는 게 핵심.

**Q (꼬리): "BDP 가 뭔가요?"**

> Bandwidth × RTT 입니다. TCP 가 ACK 받기 전에 link 에 흘려보낼 수 있는 최대 데이터양이에요. window 가 BDP 보다 작으면 link 가 idle 해져서 throughput 이 떨어집니다. 대륙 간처럼 RTT 가 큰 환경에서는 window scaling 이나 멀티 connection 이 필수에요.

---

## C 수준 확장 트리거

- **TCP slow start / congestion control** (Cubic, BBR)
- **TCP window scaling**, SACK, Fast Retransmit
- **kernel bypass**: RDMA, DPDK, io_uring
- **QUIC / HTTP3** — UDP 기반, 연결 수립 latency 절약
- **HOL blocking** (Head of Line) — TCP vs QUIC 의 차이
- **Anycast routing** — 가장 가까운 PoP 자동 선택

## 다음 파일

- **05. tail latency + fan-out** ([05-tail-and-fanout.md](05-tail-and-fanout.md))
