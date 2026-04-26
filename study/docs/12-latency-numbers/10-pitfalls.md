---
parent: 12-latency-numbers
phase: 4
order: 10
title: 함정 / 오해 포인트
created: 2026-04-26
estimated-hours: 1
---

# 10. 함정 / 오해 포인트 — 면접관이 시험하는 9가지

> Phase 4 시작. 면접관이 의도적으로 틀린 전제를 깔고 던지는 함정 질문 + 흔한 오해를 정리.
> 11번 (면접 Q&A) 의 답변에 자연스럽게 녹여 사용.

---

## 함정 #1: "평균 latency 가 빠르면 사용자도 빠르게 느낀다"

### 왜 함정인가

- 사용자는 **자기 요청의 latency 만 경험**
- 분포의 꼬리에 걸린 1% 사용자에게는 평균이 무의미
- 평균 50ms / P99 1s 시스템: 100명 중 1명은 항상 1초 기다림

### 진실

> **"평균은 SRE 가 보는 숫자, P99 는 사용자가 보는 숫자"**

### 면접 답변 패턴

> "평균만 보면 안 됩니다. P99 / P999 + heatmap 으로 분포 변화를 봐야 진짜 사용자 경험을 알 수 있어요."

---

## 함정 #2: "캐시 hit ratio 90% 면 충분히 좋다"

### 왜 함정인가

- 평균 latency 는 좋아 보임 (90% × cache + 10% × DB ≈ cache 에 가까움)
- 그러나 **10% miss 가 항상 분포의 위쪽 10% 를 차지** → P99 는 거의 hit 0% 와 비슷
- 07번 실측에서 직접 확인: hit 100% P99 = 22ms / hit 90% P99 = 78ms

### 진실

> **"P99 SLA 가 중요하면 hit ratio 99%+ 가 필요"**

### 면접 답변 패턴

> "평균이 좋아 보여도 P99 는 거의 0% hit 수준일 수 있습니다. 10% miss 가 항상 분포 위쪽을 차지하기 때문이에요."

---

## 함정 #3: "throughput 늘리면 latency 도 줄어든다"

### 왜 함정인가

- Little's Law: L = λW → throughput (λ) 과 latency (W) 는 직접 비례 관계 X
- 오히려 **utilization 70-80% 넘어가면 큐 대기로 latency 비선형 증가** (Queueing Theory M/M/1)
- "서버 더 키우면 다 빨라진다" 는 미신

### 진실

> **"throughput 과 latency 는 독립. capacity planning 은 utilization 70% 목표"**

### 면접 답변 패턴

> "Little's Law 상 둘이 직접 비례가 아닙니다. 오히려 utilization 이 높아지면 큐 대기로 latency 가 비선형 증가해요. 그래서 서버 사이징은 70% 사용률 목표가 합리적입니다."

---

## 함정 #4: "더 큰 인스턴스 = 더 낮은 latency"

### 왜 함정인가

- 인스턴스 크기는 주로 **throughput / 동시 처리** 를 늘림
- latency 의 자릿수를 결정하는 것은 **호출 경로의 매체** (메모리/디스크/네트워크)
- 작은 인스턴스 1대의 single-thread latency 가 큰 인스턴스보다 빠를 수도

### 진실

> **"latency 줄이기 = 자릿수를 옮기기 (DB→캐시, 동기→비동기). 인스턴스 키우는 건 throughput 해결책"**

### 면접 답변 패턴

> "인스턴스 사이즈는 throughput 변수입니다. latency 를 자릿수 단위로 줄이려면 호출 경로의 매체 자체를 바꿔야 해요."

---

## 함정 #5: "광속이 한계지만 더 빠른 네트워크가 나오면 해결된다"

### 왜 함정인가

- 1Gbps → 100Gbps 가 throughput 을 100배 늘리지만, **단일 패킷의 RTT** 는 거의 그대로
- RTT 는 거리와 광속의 함수 — 영원히 못 줄어듦
- 한미 RTT 150ms 는 50년 후에도 150ms

### 진실

> **"throughput 은 기술이 해결, latency 는 광속이 막음. 해결책은 데이터를 가까이 두기 (CDN, edge, 멀티 리전)"**

### 면접 답변 패턴

> "광속이 한계라 RTT 는 안 줄어요. 글로벌 서비스의 latency 는 throughput 기술이 아니라 데이터 위치 (CDN, edge replica) 로 해결합니다."

---

## 함정 #6: "마이크로서비스화하면 시스템이 빨라진다"

### 왜 함정인가

- 함수 호출 (~ns) 이 네트워크 호출 (~ms) 이 됨 = **자릿수 ×1000-1000000 추가**
- 서비스 분리 자체는 latency 비용. 빠른 건 **개별 서비스의 독립 scale + 빌드/배포**
- 동기 RPC 직렬 호출이 많으면 모놀리식보다 느려짐

### 진실

> **"MSA 는 조직 / 배포 / scale 의 가치. latency 측면에선 비용. 비동기 / 배칭 / 캐싱으로 비용 상쇄"**

### 면접 답변 패턴

> "MSA 자체는 latency 측면에서 비용입니다. 함수 호출이 네트워크 호출이 되면서 자릿수 ×1000 추가돼요. 그 비용을 비동기화 / 배칭 / 캐싱으로 상쇄하는 게 핵심 설계 포인트입니다."

---

## 함정 #7: "fan-out 백엔드를 더 늘리면 평균이 빨라진다"

### 왜 함정인가

- fan-out 의 응답 시간 = **max(N개 백엔드)**
- N 이 늘수록 max 가 단일 백엔드의 P99 / P999 영역으로 수렴
- 100개 fan-out 시 전체 P50 ≈ 단일 백엔드 P99

### 진실

> **"fan-out 은 tail 의 곱셈. 백엔드 개수를 늘리면 오히려 P50 이 끌려 올라간다"**

### 면접 답변 패턴

> "fan-out 은 평균이 줄지 않고 오히려 tail 이 P50 을 끌어올립니다. Jeff Dean 의 'Tail at Scale' 논문이 정리했고, 완화책으로 hedged request, micro-partitioning 같은 전략이 있습니다."

---

## 함정 #8: "5xx 에러만 안 나면 시스템이 건강하다"

### 왜 함정인가

- 200 OK 응답이지만 P99 가 5초인 시스템 = 사용자에게는 "타임아웃 + 새로고침"
- 에러율과 latency 는 **독립적 SLA 지표**
- 사용자 이탈은 보통 latency 에서 먼저 옴

### 진실

> **"SLA 4축: throughput / latency (P99+) / error rate / saturation. 모두 같이 봐야 함"**

### 면접 답변 패턴

> "에러율만 보면 절반만 보는 거예요. RED method (Rate / Errors / Duration) 또는 Golden Signals (latency / traffic / errors / saturation) 처럼 latency 분포까지 같이 봐야 합니다."

---

## 함정 #9: "p99 latency 갑자기 늘었다 → 코드 배포가 원인"

### 왜 함정인가

- 자동으로 배포 의심하기 쉽지만, tail latency 의 원인은 더 다양:
  - GC pause (heap 압박, GC 알고리즘 변경)
  - DB lock contention / outlier query
  - 네트워크 noisy neighbor (특히 클라우드)
  - 캐시 hit ratio 변화 (cold cache, TTL 만료 동기화)
  - 외부 API 의 outlier
  - kernel scheduling jitter
- 배포는 의심 후보 중 하나일 뿐

### 진실

> **"tail latency 변화는 5축 (코드 / 데이터 / 외부 / 인프라 / 트래픽) 으로 분류해서 좁힌다"**

### 면접 답변 패턴

> "배포 시점과 일치하면 1순위지만, GC log / DB slow query / 외부 API latency / heatmap 변화 시점 / 트래픽 패턴 변화 같이 봅니다. 코드 외에도 데이터 / 외부 의존 / 인프라 noisy neighbor 가 흔한 원인이에요."

---

## 종합 — 함정 9개 빠른 참조표

| # | 함정 | 진실 한 줄 |
|---|------|----------|
| 1 | 평균이 좋으면 사용자도 좋다 | P99 / P999 + heatmap 봐라 |
| 2 | hit ratio 90% 면 충분 | P99 는 99%+ 필요 |
| 3 | throughput ↑ → latency ↓ | 독립. utilization 70% 목표 |
| 4 | 큰 인스턴스 = 낮은 latency | 자릿수 옮기기 (매체 변경) 가 답 |
| 5 | 빠른 네트워크가 RTT 줄여준다 | 광속 한계. CDN / edge 가 답 |
| 6 | MSA = 빨라짐 | 함수→네트워크 ×1000 비용 |
| 7 | fan-out N ↑ → 평균 ↓ | tail 곱셈, P50 이 끌려 올라감 |
| 8 | 5xx 0% = 건강함 | latency 분포가 진짜 SLA |
| 9 | tail latency 변화 = 배포 탓 | 5축 (코드/데이터/외부/인프라/트래픽) |

---

## 자가 점검

- [ ] 9가지 함정을 면접 자리에서 리프레이즈해 답변할 수 있다
- [ ] 각 함정의 "진실 한 줄" 을 외운다 (외울 비율과 합쳐 5+9개 = 핵심 14개 어휘)
- [ ] 함정마다 Phase 1-3 의 어느 학습이 근거인지 매핑 가능

## 다음 파일

- **11. 면접 Q&A 트리 + 실측 스토리** ([11-interview-qa.md](11-interview-qa.md))
