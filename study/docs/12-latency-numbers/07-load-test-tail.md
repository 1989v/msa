---
parent: 12-latency-numbers
phase: 3
order: 07
title: 부하 테스트 + tail 측정 (wrk / k6 + 캐시 hit ratio 실험)
created: 2026-04-26
estimated-hours: 2
---

# 07. 부하 테스트 + tail 측정 — P50/P99/P999 분포 직접 보기

> 06 의 단발성 측정에서 한 단계 — **분포** 를 보고, **캐시 hit ratio 변화에 따른 tail 변화** 를 직접 측정.

## 0. 이 파일에서 얻을 것

- `wrk` / `k6` 로 부하 + latency 분포 측정 가능
- 캐시 hit ratio 0/50/100% 변화 시 P50/P99 가 어떻게 움직이는지 관측
- fan-out 시뮬레이션으로 tail 곱셈 효과 직접 확인
- 면접 카드: "캐시 hit 률이 P99 에 미치는 영향" 실측 일화

---

## 1. wrk — 가벼운 HTTP 부하 도구

### 설치 / 기본 명령

```bash
brew install wrk     # macOS
# Linux: 빌드 또는 패키지

# 12 thread, 400 connection, 30초간
wrk -t 12 -c 400 -d 30s http://localhost/api/v1/products/1
```

### 출력 해석

```
Running 30s test @ http://localhost/api/v1/products/1
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    25.34ms   18.71ms  340.12ms   76.83%
    Req/Sec     1.32k   210.45     2.10k    68.15%
  Requests/sec:  15823.45
  Transfer/sec:    1.23MB
```

- **Latency Avg / Stdev / Max**: 평균과 표준편차, 최대값 (P99 직접 표시 X)
- **Req/Sec**: throughput
- **Stdev 가 Avg 보다 큼** → 분포가 매우 넓음 → tail 길음

### Latency 분포 (--latency 플래그)

```bash
wrk -t 12 -c 400 -d 30s --latency http://localhost/api/v1/products/1
```

추가 출력:
```
  Latency Distribution
     50%   18.32ms
     75%   30.41ms
     90%   55.73ms
     99%  150.21ms
```

→ P50 vs P99 비율 ~×8 (외울 비율 #5 검증 ✅)

---

## 2. k6 — 더 정밀한 부하 + 시나리오

### 설치 / 기본 스크립트

```bash
brew install k6
```

`load.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '1m', target: 50 },    // sustain
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    'http_req_duration{type:api}': ['p(95)<500', 'p(99)<1000'],
  },
};

export default function () {
  const id = Math.floor(Math.random() * 100) + 1;
  const res = http.get(`http://localhost/api/v1/products/${id}`, {
    tags: { type: 'api' },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.1);
}
```

```bash
k6 run load.js
```

### 출력 해석

```
http_req_duration..............: avg=23.12ms min=2.1ms med=18.4ms max=890ms p(90)=45.3ms p(95)=88.1ms p(99)=320ms
```

- **min ~2ms / med ~18ms / p99 ~320ms / max ~890ms**
- p99 / med ≈ ×17 → tail 이 매우 김 (외울 비율 ×3-10 의 위쪽)
- 원인: GC, lock contention, DB outlier query 의심 → APM/log 와 cross-check

---

## 3. 캐시 Hit Ratio 실험 — 핵심 실측

### 가설

- 캐시 hit → DRAM/Redis access (µs)
- 캐시 miss → MySQL access (작은 ms)
- → hit ratio 가 낮아질수록 P50/P99 가 자릿수 점프

### 실험 설계

```javascript
// k6 시나리오: hit ratio 제어
export default function () {
  // hitRatio 만큼은 캐시 hit 되는 인기 상품 (id 1-10)
  // 나머지는 cold 상품 (id 1000-9999)
  const hitRatio = __ENV.HIT_RATIO || 0.5;
  const id = Math.random() < hitRatio
    ? Math.floor(Math.random() * 10) + 1
    : Math.floor(Math.random() * 9000) + 1000;

  http.get(`http://localhost/api/v1/products/${id}`);
}
```

```bash
HIT_RATIO=1.0 k6 run load.js   # 100% hit
HIT_RATIO=0.5 k6 run load.js   # 50% hit
HIT_RATIO=0.0 k6 run load.js   # 0% hit (전부 miss)
```

### 예상 결과

| Hit Ratio | P50 | P99 | 비고 |
|---|---|---|---|
| 100% | ~5 ms | ~20 ms | Redis만 hit, DB 안 거침 |
| 90% | ~6 ms | ~80 ms | 10% miss 가 P99 끌어올림 |
| 50% | ~15 ms | ~150 ms | 절반이 DB 거치니 P50 자체 점프 |
| 0% | ~30 ms | ~300 ms | 모두 DB |

### 핵심 인사이트

> **"Hit ratio 90% 도 P99 는 거의 0% 와 비슷하다"**
> 10% miss 가 항상 분포의 위쪽 10% 를 차지하기 때문.
> P99 를 좋게 하려면 **hit ratio 99%+** 가 필요.

→ 면접 카드: "캐시 hit ratio 90% 면 좋은 거 아닌가요?" 의 함정.

---

## 4. fan-out tail 곱셈 시뮬레이션

### 시나리오

gateway 가 N 개 백엔드를 병렬 호출하는 상황을 모사.

### 단순 시뮬레이션 — 단일 백엔드 분포 곱셈

`fanout-sim.py`:
```python
import numpy as np

# 단일 백엔드의 latency 분포 (lognormal: 평균 5ms, p99 50ms 가정)
n_samples = 100_000
samples = np.random.lognormal(mean=np.log(5), sigma=1.0, size=n_samples)

for n in [1, 5, 10, 50, 100]:
    # n 개 백엔드 fan-out → max(n 개 sample)
    fanout = np.max(samples.reshape(-1, n)[:n_samples//n], axis=1)
    p50 = np.percentile(fanout, 50)
    p99 = np.percentile(fanout, 99)
    print(f"N={n:3d} | P50={p50:6.1f}ms  P99={p99:6.1f}ms")
```

### 예상 출력

```
N=  1 | P50=   5.0ms  P99=  50.0ms
N=  5 | P50=  18.2ms  P99=  85.3ms
N= 10 | P50=  32.5ms  P99= 110.1ms
N= 50 | P50=  78.4ms  P99= 165.8ms
N=100 | P50= 110.2ms  P99= 215.4ms
```

→ N=100 일 때 전체 P50 (110ms) ≈ 단일 P99 (50ms) 의 2배 (Jeff Dean 의 직관과 일치).

### 실측 버전 (선택)

실제로 product API 를 N 번 병렬 호출하는 wrapper 를 만들어 측정. 단순 시뮬레이션이 직관 충분하면 스킵 가능.

---

## 5. 측정 결과 정리 양식

```markdown
## 측정 #2: 캐시 hit ratio 실험 (k6, k3d)
- 일시: 2026-04-26 15:30
- 환경: k3d 단일 노드, product + Redis + MySQL
- 시나리오: hit ratio 0/50/90/100% 4가지
- 결과:
  | Hit | P50 | P99 |
  |---|---|---|
  | 100% | 5ms | 22ms |
  | 90%  | 7ms | 78ms |   ← P99 가 거의 0% 와 비슷
  | 50%  | 16ms | 145ms |
  | 0%   | 32ms | 290ms |
- 학습 포인트: "hit ratio 90% = P99 90% 까지 좋다" 가 거짓말. 10% miss 가 P99 영역을 차지.
- 면접 답변 활용: 캐시 함정 / tail latency 실제 데이터
```

---

## 6. 자가 점검

- [ ] wrk 또는 k6 로 부하 + latency 분포 측정 가능
- [ ] P50 / P95 / P99 / max 출력 해석 가능
- [ ] 캐시 hit ratio 0/50/100% 실험을 직접 또는 시뮬레이션으로 수행
- [ ] "hit ratio 90% 면 P99 도 좋다" 가 함정인 이유 설명
- [ ] fan-out N 증가 시 전체 P50 이 단일 P99 에 수렴하는 원리

## 7. 면접 답변 카드

**Q: "캐시 hit ratio 90% 면 충분히 좋은 거 아닌가요?"**

> 평균만 보면 좋아 보이지만 P99 는 거의 hit 0% 수준일 수 있어요. 10% miss 가 항상 분포의 위쪽을 차지하기 때문이에요. 직접 측정해 보면 hit ratio 100% 일 때 P99 가 20ms 면, 90% 일 때 P99 가 80ms 까지 갑니다. P99 SLA 가 중요하면 hit ratio 99%+ 를 목표로 잡아야 합니다.

**Q (꼬리): "그럼 hit ratio 를 어떻게 99% 까지 올리나요?"**

> 캐시 워밍업, TTL 정책 (auto-refresh), 인기 데이터 사전 로드, 캐시 크기 증설 + LRU/LFU 튜닝. 그리고 cold cache 의 영향을 줄이는 cache stampede 방어 (mutex / probabilistic expiration). 9번 Redis 심화 주제에서 다룰 영역입니다.

**Q (꼬리): "fan-out 시스템에서 tail 줄이려면?"**

> Jeff Dean 의 "Tail at Scale" 논문 처방을 씁니다. Hedged request (P95 시점에 백업 요청), tied request (둘 발사 후 빠른 쪽 채택), micro-partitioning (한 백엔드 영향 최소화), backend pool 의 outlier 제거. 그리고 가능하면 fan-out 자체를 줄이는 (배칭, 응답 캐싱) 게 본질적 해결.

---

## 다음 파일

- **08. Observability 셋업** ([08-observability-setup.md](08-observability-setup.md)) — 측정을 메트릭으로 시각화
