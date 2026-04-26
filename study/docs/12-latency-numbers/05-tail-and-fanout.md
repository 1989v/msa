---
parent: 12-latency-numbers
phase: 2
order: 05
title: tail latency + fan-out + Little's Law
created: 2026-04-26
estimated-hours: 1
---

# 05. tail latency + fan-out + Little's Law

> Phase 2 의 마지막. 하드웨어 (02-04) 에서 분산 시스템 응용으로 시야 전환.
> Phase 3 (실측) 에서 직접 보게 될 P99/P999/fan-out 곱셈을 미리 직관화.

## 0. 이 파일에서 얻을 것

- **평균 vs P99 vs P999** 의 차이가 왜 사용자 경험을 결정하는가
- **fan-out 의 곱셈 효과** — 백엔드 1개의 P99 가 전체 시스템의 P50 을 결정
- **Little's Law** — latency 와 throughput 과 동시 처리량의 관계
- 면접 답변 카드: "평균 latency 는 빠른데 사용자가 느리다고 합니다. 어디 의심?"

---

## 1. tail latency — 평균이 거짓말하는 이유

### 정의

- **P50 (median)**: 절반의 요청이 이보다 빠름
- **P95**: 95% 요청이 이보다 빠름 (5% 가 더 느림)
- **P99**: 99% 요청이 이보다 빠름 (1% 가 더 느림)
- **P999**: 99.9% 요청이 이보다 빠름 (0.1% 가 더 느림)
- **tail** = P99, P999, max — "분포의 꼬리" 부분

### 왜 평균이 거짓말하는가

전형적 latency 분포 (왼쪽 치우침 + 긴 오른쪽 꼬리):

```
요청 수
  │
  │   ████
  │  █████████
  │ ███████████
  │█████████████
  │██████████████
  │██████████████  ▒
  │██████████████ ▒▒▒  ▒
  │█████████████▒▒▒▒▒▒▒▒▒▒  ▒    ▒
  └────────────────────────────────────── latency
   1ms        10ms          100ms     1s
   ↑          ↑             ↑         ↑
   P50       평균/P95       P99      P999
```

- 평균이 ~10ms 라도 P99 가 ~100ms, P999 가 ~1s 일 수 있음
- 사용자는 **자기 요청의 latency 만 경험** — "1% 가 1초 걸린다" 는 100명 중 1명에게는 항상 일어남
- → "평균은 SRE 가 보는 숫자, P99 는 사용자가 보는 숫자"

### 왜 꼬리가 긴가 — 원인들

- **GC pause** (JVM 의 stop-the-world)
- **lock contention** / 큐 대기
- **캐시 miss** → DRAM 또는 디스크 access (자릿수 점프)
- **네트워크 retry / congestion**
- **컨테이너 / hypervisor noisy neighbor**
- **OS / kernel scheduling jitter**

### 비율 직관

```
P50 → P95: ~×2 ~ ×3
P50 → P99: ~×3 ~ ×10
P50 → P999: ~×10 ~ ×100
```

→ 외울 비율 #5: **평균 → P99 ≈ ×3 ~ ×10**

---

## 2. fan-out — tail 의 곱셈 효과

### 시나리오

```
gateway 가 N 개 백엔드를 병렬 호출 → 모든 응답 모이면 사용자에게 응답
```

- 단일 백엔드의 P99 latency = T
- N 개 fan-out 시 "**최소 1개라도 느리면 전체가 느림**"
- 수학적으로: fan-out N 의 latency = max(N개 백엔드 latency)

### 곱셈 효과 — Jeff Dean "The Tail at Scale"

| N | 단일 P50 | 단일 P99 | fan-out P99 (실효) |
|---|---|---|---|
| 1 | 5 ms | 50 ms | 50 ms |
| 10 | 5 ms | 50 ms | ~140 ms (P99 영역에 들어갈 확률 ↑) |
| 100 | 5 ms | 50 ms | 거의 항상 ~50ms 이상 |
| 1000 | 5 ms | 50 ms | P99 가 단일 P999 수준 |

직관적으로:
- 단일 호출 P99 = "100번에 1번 50ms"
- 100개 fan-out = "거의 매 요청 1개는 그 P99 영역" → 전체 P50 이 단일 P99 와 비슷해짐

### 핵심 결론

> **"백엔드 N개 fan-out 시, 전체 시스템의 P50 ≈ 단일 백엔드의 P(100-100/N)"**
> 100개 fan-out 이면 전체 P50 ≈ 단일 P99

→ "백엔드를 더 늘리면 평균이 빨라진다" 는 직관 X. 오히려 **tail 이 P50 을 끌어올린다**.

### 완화 전략 (Jeff Dean 논문)

1. **Hedged requests**: 95 percentile 시점에서 백업 요청 발사 (응답 빠른 쪽 채택)
2. **Tied requests**: 두 곳에 동시 요청, 한 곳이 시작하면 다른 곳 취소
3. **Backup requests with cross-server cancellation**
4. **Micro-partitioning**: 작은 단위로 쪼개 한 백엔드의 영향 최소화

---

## 3. Little's Law — 동시성과 throughput 의 관계

### 공식

```
L = λ × W

L: 시스템 내 동시 처리 중인 요청 수 (concurrency)
λ: throughput (req/sec)
W: 평균 latency (sec)
```

### 직관

- 한 카페에 손님 10명, 평균 5분 머무름 → 분당 도착하는 손님 = 10 / 5 = 2 명/분
- 즉 **throughput = concurrency / latency**

### 응용 — 시스템 사이징

**Q: "초당 1000 req 처리하려면 몇 개 동시 처리가 필요한가?"**
- 평균 latency 50 ms → L = 1000 × 0.05 = **50 동시**
- 평균 latency 500 ms → L = 1000 × 0.5 = **500 동시**

→ "latency 가 10배 늘면 같은 throughput 위해 동시성도 10배 필요"

### 응용 — connection pool 사이징

**Q: "DB connection pool 크기를 얼마로 잡을까?"**
- 피크 throughput 100 req/s, 평균 query latency 20 ms
- L = 100 × 0.02 = **2 connection** (이론 최소)
- 안전 마진 + tail 대비 **5-10 connection** 정도면 충분
- → "connection pool 200 같은 과한 설정은 의미 없고 오히려 contention"

### 응용 — "throughput 늘리면 latency 줄어드나?"

- **No.** 공식상 latency 가 throughput 의 함수가 아님
- 다만 **시스템이 saturation 에 가까우면 큐 대기로 latency 가 폭증** (Queueing Theory, M/M/1)
- → utilization 70-80% 이상에서 latency 가 비선형 증가

---

## 4. msa 프로젝트와의 연결

### Phase 3 실측에서 직접 볼 것

- `wrk` 로 product API 부하 → P50 / P99 / P999 분포 확인
- 캐시 hit ratio 0/50/100% 변경 → tail 변화 측정
- gateway → 여러 백엔드 fan-out 시나리오 → tail 곱셈 효과 직접 관찰

### 설계 시사점

- **gateway 의 백엔드 호출** = fan-out 위험. 가능하면 직렬 → 비동기 / 단일 호출
- **Saga 패턴** (order 서비스): 동기 호출 직렬 합산 vs 이벤트 기반 비동기
- **Kafka consumer**: throughput 기준 Little's Law 로 partition / consumer 수 산정
- **DB connection pool**: HikariCP 설정 시 Little's Law 로 합리적 크기 도출

### 관련 ADR

- `docs/adr/ADR-0015-resilience-strategy.md` — CircuitBreaker, Rate Limiting 은 tail 완화 전략
- `docs/adr/ADR-0012-idempotent-consumer.md` — retry 시 idempotency

---

## 5. 자가 점검

- [ ] P50 / P95 / P99 / P999 차이를 한 문장으로 설명
- [ ] "평균이 거짓말하는 이유" 를 분포 그림과 함께 설명
- [ ] fan-out 시 tail 이 P50 을 끌어올리는 이유 (max(N개))
- [ ] Little's Law 공식과 connection pool 사이징 응용
- [ ] tail 완화 전략 2개 이상 (hedged / tied / micro-partitioning)

## 6. 면접 답변 카드

**Q: "평균 latency 는 빠른데 사용자가 느리다고 합니다. 어디 의심하시겠어요?"**

> 평균이 아닌 P99 / P999 분포를 봐야 합니다. 평균이 10ms 여도 P99 가 100ms, P999 가 1s 면 1% 사용자는 항상 느린 경험을 합니다. 원인 후보는 GC pause, lock contention, 캐시 miss 의 자릿수 점프, DB의 outlier query. 메트릭에서 latency 히스토그램과 heatmap 을 먼저 보고, GC 로그 / slow query log / APM trace 로 좁힙니다.

**Q (꼬리): "fan-out 시스템에서 tail 이 더 심해지는 이유는?"**

> max 효과 때문입니다. 백엔드 N개 병렬 호출 시 전체 응답은 가장 느린 호출에 묶여요. 단일 호출 P99 가 50ms 면 100개 fan-out 시 전체 P50 이 거의 50ms 가 됩니다. 이걸 Jeff Dean 의 "The Tail at Scale" 논문이 정리했고, 완화책으로 hedged request, tied request, micro-partitioning 같은 전략이 있습니다.

**Q (꼬리): "Little's Law 로 connection pool 사이즈 정해보세요."**

> L = λ × W 입니다. 피크 throughput 100 req/s, 평균 query latency 20ms 면 L = 100 × 0.02 = 2 connection 이 이론 최소. 안전 마진과 tail 대비해서 5-10 정도면 충분해요. pool 을 200, 500 으로 키우는 건 의미 없고 오히려 DB 쪽 contention 만 늘립니다.

**Q (함정): "throughput 을 늘리면 latency 도 줄어드나요?"**

> 아닙니다. Little's Law 상 latency 와 throughput 은 직접 비례가 아니에요. 다만 utilization 70-80% 넘어가면 큐 대기로 latency 가 비선형 증가하는 게 Queueing Theory (M/M/1) 의 결론입니다. 그래서 capacity planning 은 70% 사용률을 목표로 잡는 게 실무적입니다.

---

## 7. Phase 2 종료 — 통합 치트시트

```
┌────────────────────────────────────────────────────────┐
│ 자릿수가 갈리는 물리적 이유 (02-04)                    │
├────────────────────────────────────────────────────────┤
│ ns 그룹  ← CPU 코어 내, 전기 신호                      │
│ µs 그룹  ← NAND/PCIe + 한 건물 내 RTT                  │
│ ms 그룹  ← 회전 디스크 + 광속 한계 (대륙 간)           │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 분산 시스템 응용 (05)                                  │
├────────────────────────────────────────────────────────┤
│ tail (P99) > 평균 ×3-10                                │
│ fan-out N → 전체 P50 ≈ 단일 P(100-100/N)               │
│ Little's Law: L = λW                                    │
│ utilization 70%+ 에서 latency 비선형 증가              │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Phase 3 실측에서 검증할 것                             │
├────────────────────────────────────────────────────────┤
│ 1. redis-cli --latency  → 실제 µs 자릿수 확인          │
│ 2. curl -w + ping       → DC 내 RTT 실측               │
│ 3. wrk + 캐시 hit ratio → P50/P99/P999 분포 변화        │
│ 4. fan-out 시뮬레이션   → tail 곱셈 효과 직접 관측     │
└────────────────────────────────────────────────────────┘
```

---

## C 수준 확장 트리거

- **Queueing Theory**: M/M/1, M/M/c, utilization vs latency 정확한 곡선
- **HDR Histogram**: 정밀한 latency 분포 측정 도구
- **USE method, RED method, Golden signals**: SRE 의 latency 모니터링 프레임워크
- **Adaptive concurrency**: Netflix 의 동적 concurrency 제어

## 다음 파일

- **06. baseline 실측** ([06-baseline-measurement.md](06-baseline-measurement.md)) — Phase 3 시작
