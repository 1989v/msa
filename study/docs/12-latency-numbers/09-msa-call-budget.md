---
parent: 12-latency-numbers
phase: 3
order: 09
title: msa 호출 경로 latency budget
created: 2026-04-26
estimated-hours: 1
---

# 09. msa 호출 경로 latency budget — 자릿수로 라벨링

> Phase 3 의 마지막. 06-08 의 측정 도구로 얻은 자릿수를 **msa 코드베이스의 실제 호출 경로** 에 라벨링.
> Phase 5 ADR-0025 의 입력 자료가 됨.

## 0. 이 파일에서 얻을 것

- msa 의 주요 호출 경로별 latency 자릿수 라벨
- "현재 환경 (k3d) 기준" vs "managed K8s 기준" 의 가정 정리
- ADR-0025 작성에 직접 들어갈 budget 표 초안

---

## 1. msa 호출 경로 인벤토리

### 클라이언트 → 서비스 (in-cluster)

| 경로 | 매체 | 자릿수 (k3d) | 자릿수 (managed K8s) |
|---|---|---|---|
| Client → ingress (외부) | 인터넷 | ~10-100 ms | ~10-100 ms |
| Ingress → gateway Pod | K8s service | µs ~ ms | µs ~ ms |
| gateway → backend service | K8s DNS + HTTP | ~1-5 ms | ~1-5 ms |

### 서비스 → 데이터스토어

| 경로 | 매체 | 자릿수 (k3d 단일 노드) | 자릿수 (managed) |
|---|---|---|---|
| service → MySQL (PK lookup, 캐시 hit) | JDBC + InnoDB buffer pool | ~1-3 ms | ~1-3 ms |
| service → MySQL (full scan / index miss) | JDBC + SSD I/O | ~10-100 ms | ~10-100 ms |
| service → Redis (GET) | 네트워크 + DRAM | ~0.3-1 ms | ~0.5-2 ms |
| service → Elasticsearch (검색) | HTTP + Lucene | ~10-50 ms | ~10-50 ms |
| service → Kafka (produce, ack=1) | TCP + sequential write | ~1-5 ms | ~1-5 ms |
| service → ClickHouse (OLAP query) | HTTP + 컬럼 스캔 | ~50-500 ms | ~50-500 ms |

### 비동기 / 외부

| 경로 | 매체 | 자릿수 |
|---|---|---|
| Kafka consumer poll → process | 메모리 + 비즈니스 로직 | µs ~ ms |
| order → 외부 결제 API | 인터넷 + TLS | ~수십-수백 ms |
| service → 외부 OAuth provider | 인터넷 | ~수십-수백 ms |

---

## 2. 대표 시나리오 — End-to-end budget

### 시나리오 A: 상품 상세 조회 (캐시 hit)

```
Client → ingress → gateway → product → Redis(GET) → product → gateway → ingress → Client
   │              │           │            │              │
   ↓              ↓           ↓            ↓              ↓
~ms (외부 RTT)   µs        ~1ms        ~0.5ms         ~ms

E2E 합계: ~수십 ms (외부 RTT 가 dominant)
서버 내부: ~3-5 ms
```

### 시나리오 B: 상품 상세 조회 (캐시 miss → MySQL hit)

```
Client → ingress → gateway → product → Redis (MISS) → product → MySQL → product → ... → Client
                                          │ ~0.5ms                ~2ms
                                          ↓
                                      Redis SET (writeback) ~0.5ms

E2E 합계: ~수십 ms (외부) + 추가 ~3 ms (DB)
서버 내부: ~5-10 ms
```

→ **캐시 miss 의 추가 비용 ~3-5 ms** = 자릿수는 같지만 산술적으로 ~2배

### 시나리오 C: 주문 생성 (분산 트랜잭션 / Saga)

```
Client → gateway → order
                    ├─ MySQL INSERT (order, status=PENDING) ~3ms
                    ├─ Kafka produce (order.created) ~3ms
                    └─ → Client (응답)
                    
                    [비동기 후처리]
                    inventory → Kafka consume → MySQL UPDATE → Kafka produce (inventory.reserved)
                    payment → 외부 결제 API ~수백ms → Kafka produce (payment.completed)
                    order → 모든 이벤트 수신 → status=CONFIRMED

응답 시점 latency: ~10-15 ms (동기 부분만)
완전 처리 시점: ~수백 ms ~ 수 초 (외부 결제 API 가 dominant)
```

→ "사용자 응답" 과 "전체 완료" 분리 → tail 큰 외부 API 가 사용자 체감을 안 깎음 (Saga 의 가치)

### 시나리오 D: 검색 (Elasticsearch)

```
Client → gateway → search → Elasticsearch (인덱스 검색) ~10-30ms → search → ... → Client

E2E 합계: ~수십 ms (외부) + ~30 ms (ES)
서버 내부: ~30-50 ms
```

→ 검색은 다른 호출보다 자릿수 위. UX 상 "200ms 이내" 목표 가능.

### 시나리오 E: 분석 대시보드 (ClickHouse)

```
Client → admin → analytics → ClickHouse (수억 row 집계) ~수백ms ~ 수 s

E2E 합계: ~수백 ms ~ 수 s
```

→ OLAP 는 자릿수 자체가 OLTP 와 다름. 캐시 / 사전 집계 / materialized view 로 단축 필요.

---

## 3. Latency Budget 표 (초안)

### Tier 1 — 사용자 직접 응답 경로 (P99 SLA)

| 경로 | P99 budget | 근거 |
|---|---|---|
| 단순 상품 조회 (cache hit) | **50 ms** | 외부 RTT + 서버 내부 ~5ms |
| 단순 상품 조회 (cache miss) | **80 ms** | 위 + DB ~3ms (tail 고려 +30ms) |
| 검색 | **300 ms** | ES P99 ~100ms + 외부 RTT |
| 주문 생성 (동기 부분) | **100 ms** | DB INSERT + Kafka produce |
| 위시리스트 추가 | **80 ms** | 단순 INSERT + cache invalidate |

### Tier 2 — 비동기 처리 경로 (Throughput SLA)

| 경로 | Throughput budget | 비고 |
|---|---|---|
| Kafka consumer (order events) | 1000 msg/s/partition | partition 수로 scale |
| Inventory 예약 처리 | 500 req/s | DB lock contention 한계 |
| Analytics ingestion | 10000 events/s | Kafka Streams + 배치 |

### Tier 3 — 백오피스 경로 (Best-effort)

| 경로 | budget | 비고 |
|---|---|---|
| Admin 분석 대시보드 | 5 s | OLAP 특성상 유연 |
| 일일 리포트 생성 | 30 min | 배치성 |

---

## 4. 자릿수 위반 시 행동 가이드 (의사결정 체크리스트)

```
┌─ 호출 경로의 P99 가 budget 을 초과할 때 ──────────┐
│                                                    │
│ Q1. tail 만 큰가, 평균도 큰가?                     │
│   - 평균도 크다 → 본질적 비용 (DB scan / 외부 API) │
│     → 캐시 / 인덱스 / 비동기화 검토               │
│   - tail 만 크다 → outlier (GC, lock, miss)        │
│     → APM trace + heatmap 으로 좁히기              │
│                                                    │
│ Q2. fan-out 이 있는가?                             │
│   - Yes → 단일 백엔드 P99 의 곱셈 효과            │
│     → hedged / tied request, micro-partitioning   │
│                                                    │
│ Q3. 외부 호출이 있는가?                            │
│   - Yes → CircuitBreaker (ADR-0015) + timeout     │
│     → 비동기화 (Kafka) 검토                       │
│                                                    │
│ Q4. 자릿수 자체를 옮길 수 있는가?                  │
│   - DB → 캐시 (ms → µs)                            │
│   - 동기 → 비동기 (사용자 체감 latency 0)          │
│   - 직렬 → 병렬 (sum → max)                        │
└────────────────────────────────────────────────────┘
```

---

## 5. ADR-0025 입력 자료 정리

Phase 5 (12-adr-draft.md) 에서 ADR 작성 시 본 파일에서 가져갈 것:

1. **호출 경로 인벤토리 표** (1번 섹션)
2. **시나리오별 budget 표** (3번 Tier 1/2/3)
3. **위반 시 행동 가이드** (4번 체크리스트)
4. **k3d vs managed K8s 자릿수 가정** — ADR 의 Context 섹션에 명시

---

## 6. 자가 점검

- [ ] msa 의 주요 호출 경로 5-10개를 자릿수로 라벨링 가능
- [ ] 캐시 hit / miss 시나리오의 자릿수 차이 설명
- [ ] 동기 합산 vs 비동기 분리의 사용자 체감 latency 차이
- [ ] budget 위반 시 의사결정 체크리스트 활용 가능

## 7. 면접 답변 카드

**Q: "MSA 에서 latency 관리 어떻게 하나요?"**

> 호출 경로마다 자릿수 budget 을 명시적으로 잡습니다. 예를 들어 사용자 직접 응답 경로는 P99 100ms 이내, 검색은 300ms, OLAP 분석은 5초 같이 Tier 를 나눠요. 위반 시 (a) 평균/tail 어느 쪽 문제인지, (b) fan-out 이 있는지, (c) 외부 호출이 있는지 체크리스트로 좁히고, (d) 가능하면 자릿수 자체를 옮기는 방향 (DB→캐시, 동기→비동기) 으로 갑니다.

**Q (꼬리): "기존 시스템에 budget 도입은 어떻게 시작하나요?"**

> 측정부터입니다. Prometheus + Grafana 로 호출 경로별 P50/P99 분포를 일단 가시화. 그 다음 비즈니스 측과 합의해 SLA 를 정하고, 그게 자릿수 budget 으로 분해됩니다. 도입 초기엔 모든 경로에 강제하기보다 사용자 직접 응답 경로 (Tier 1) 부터 시작하는 게 현실적입니다.

---

## Phase 3 종료 — 통합 정리

### 측정 도구 매트릭스 (06-08 종합)

| 도구 | 측정 대상 | 자릿수 | 출처 |
|---|---|---|---|
| `redis-cli --latency` | Redis RTT | µs ~ ms | 06 |
| `curl -w` | HTTP 단계별 | ms | 06 |
| `ping`, `mtr` | 네트워크 RTT | µs ~ ms | 06 |
| `dd`, `fio` | 디스크 throughput / IOPS | MB/s, µs | 06 |
| `wrk`, `k6` | HTTP 부하 + 분포 | ms (P50/P99) | 07 |
| Prometheus + Grafana | 상시 메트릭 + heatmap | 모든 자릿수 | 08 |

### 핵심 발견 (가설 → 검증)

- ✅ Redis hit 가 MySQL hit 보다 ~3-10배 빠름 (자릿수 1-2개 차이)
- ✅ 캐시 hit ratio 90% 도 P99 는 거의 0% 와 비슷 (07 실험)
- ✅ 같은 DC 내 RTT 가 ~500 µs ~ 수 ms (06 ping)
- ✅ tail 이 평균의 ~×3-10 (외울 비율 #5)
- ✅ msa 호출 경로 자릿수가 표 값과 일치 (외부 RTT 제외)

---

## 다음 파일

- **10. 함정 / 오해 포인트** ([10-pitfalls.md](10-pitfalls.md)) — Phase 4 시작
