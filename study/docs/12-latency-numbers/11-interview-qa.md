---
parent: 12-latency-numbers
phase: 4
order: 11
title: 면접 Q&A 트리 + 실측 스토리
created: 2026-04-26
estimated-hours: 2
---

# 11. 면접 Q&A 트리 + 실측 스토리

> Phase 4 의 메인. 6개 핵심 질문 × 꼬리 2단계 (Q → Q-1 → Q-1-1) + Phase 3 실측 일화를 답변에 자연스럽게 녹임.
> 한국 대기업/중견 기술 면접 환경 가정. 한국어 답변 + 영어 용어 병기.

---

## 사용 가이드

- 각 답변은 **3-part 구조**: ① 핵심 (1-2문장) → ② 설명 (2-3문장) → ③ 실무/실측 연결 (1-2문장)
- 꼬리 질문은 면접관이 "왜?" 또는 "그럼?" 으로 파고드는 자연 흐름
- 실측 스토리는 06-08 에서 만든 측정 결과를 일화로 변환 — "직접 측정해 봤는데..." 카드

---

## Q1. "Latency Numbers Every Programmer Should Know 표를 알고 계세요?"

### 답변

**핵심**: Jeff Dean 이 LADIS 2009 키노트에서 제시한 표로, L1 캐시부터 대륙 간 RTT 까지 8자리 자릿수의 latency 스펙트럼을 정리한 자료입니다.

**설명**: 핵심은 절대값을 외우는 게 아니라, 인접 구간 사이의 **비율** 을 감각으로 가지는 것입니다. 예를 들어 L1 → DRAM ×100, DRAM → SSD ×1000, 같은 DC → 대륙 간 RTT ×300 같은 비율을 머릿속에 두면 시스템 설계 의사결정에서 "이 호출이 어느 자릿수인가" 를 즉답할 수 있습니다.

**실무 연결**: 저는 이 비율들을 활용해 msa 의 호출 경로마다 latency budget Tier 를 설계해 봤습니다 — 사용자 직접 응답 100ms, 검색 300ms, 분석 5초 같은 식으로요.

### Q1-1: "표가 2009년 거잖아요. 지금도 유효한가요?"

**답변**: 개별 숫자는 일부 outdated 입니다. SSD random read 는 거의 그대로지만, NIC throughput 은 1Gbps → 100Gbps 로 자릿수 변화가 있어요. 그러나 **자릿수 그룹은 거의 안 변합니다** — DRAM 은 항상 ns, SSD 는 항상 µs, HDD seek 와 광속 한계 RTT 는 영원히 ms. Colin Scott 의 인터랙티브 페이지가 2020 까지 갱신되어 있어 변화 추세를 보기 좋아요. 그래서 그룹과 비율은 영구 자산입니다.

### Q1-1-1: "그럼 외울 비율은 몇 개면 충분한가요?"

**답변**: 5개로 시스템 설계의 80% 의사결정을 정량 추론할 수 있다고 봅니다.
1. L1 → DRAM ×100 (캐시 친화 코드 가치)
2. DRAM → SSD ×1000 (캐시 레이어 도입 근거)
3. SSD → DC RTT ×30 (Redis vs 로컬 디스크)
4. DC → 대륙 간 RTT ×300 (멀티 리전 비용)
5. 평균 → P99 ×3-10 (tail latency)

---

## Q2. "API p99 latency 가 갑자기 늘었습니다. 어디부터 보시겠어요?"

### 답변

**핵심**: 평균이 아닌 P99 / P999 + heatmap 으로 **분포 변화 시점** 을 정확히 잡고, 그 시점에 무엇이 변했는지 5축 (코드 / 데이터 / 외부 / 인프라 / 트래픽) 으로 좁힙니다.

**설명**: tail latency 의 원인은 다양합니다 — GC pause, lock contention, 캐시 miss 의 자릿수 점프, DB outlier query, 외부 API tail, 네트워크 noisy neighbor. 단순히 "배포가 원인" 으로 단정하면 절반의 케이스에서 헛다리 짚어요. heatmap 으로 분포가 위쪽 (느린 영역) 으로 확장됐는지, 특정 percentile 만 튀는지를 보면 가설이 좁혀집니다.

**실무 연결**: 저는 Spring Boot Actuator + Micrometer + Prometheus + Grafana 셋업으로 latency 히스토그램을 노출하고, `histogram_quantile` PromQL 로 P50/P99/P999 + heatmap 을 항상 떠 있게 했습니다.

### Q2-1: "GC pause 가 원인인지 어떻게 확인하나요?"

**답변**: GC log (`-Xlog:gc*`) 를 켜고 GCEasy.io 같은 도구로 STW 시간 분포를 봅니다. JFR (Java Flight Recorder) 로 hot spot 과 allocation rate 를 같이 보는 게 정밀해요. P99 latency 의 spike 시점과 GC pause 시점이 겹치면 GC 가 원인. 해결은 GC 알고리즘 변경 (G1 → ZGC), heap 사이즈 조정, allocation rate 줄이기 (객체 재사용, primitive 컬렉션) 입니다.

### Q2-1-1: "ZGC 가 G1 보다 항상 좋은 건 아닌가요?"

**답변**: 트레이드오프가 있습니다. ZGC 는 sub-ms pause 가 매력이지만 throughput 이 G1 보다 ~5-10% 낮고, heap 메모리 오버헤드 (Colored Pointers) 가 있어요. 작은 heap (수 GB) + 일반 처리량은 G1 이 여전히 sweet spot. 큰 heap (수십 GB+) + 짧은 pause 가 critical 한 환경 (e.g. low-latency 서비스) 에서 ZGC 가 유리합니다. JDK 21 부터는 Generational ZGC 가 GA 라 일반 워크로드에도 적용 검토 가능해요.

---

## Q3. "캐시 hit ratio 90% 면 충분한 거 아닌가요?"

### 답변

**핵심**: 평균만 보면 좋아 보이지만 **P99 는 거의 hit 0% 와 비슷합니다**. 10% miss 가 항상 분포의 위쪽 10% 를 차지하기 때문입니다.

**설명**: 캐시 hit 시 latency 가 1ms, miss 시 30ms 라면, hit ratio 90% 일 때 평균은 4ms 정도지만 P99 는 거의 30ms 입니다. P99 SLA 가 중요하면 hit ratio 99%+ 가 필요해요.

**실무 연결**: 저는 k6 로 hit ratio 0/50/90/100% 4가지 시나리오를 직접 측정해 봤습니다. hit 100% 일 때 P99 22ms 였는데, hit 90% 에서 P99 가 78ms 로 ×3.5 뛰었어요. hit 50% 와 hit 90% 의 P99 가 비슷한 자릿수라는 게 인상적이었습니다.

### Q3-1: "Hit ratio 99% 까지 어떻게 올리나요?"

**답변**: 몇 가지 결합으로 갑니다. (1) 캐시 워밍업 — 배포 후 hot 데이터 사전 로드. (2) TTL 정책 개선 — auto-refresh 로 만료 직전 갱신, jitter 로 동시 만료 방지 (cache stampede). (3) 캐시 크기 + 정책 (LRU/LFU) 튜닝. (4) cache-aside / write-through / write-behind 같은 패턴 선택. (5) 다층 캐시 (in-process LRU + Redis) 로 hot path 를 더 빠르게.

### Q3-1-1: "Cache stampede 가 뭐고 어떻게 방어하나요?"

**답변**: 인기 키의 TTL 만료 순간에 수많은 요청이 동시에 캐시 miss → 모두 DB 로 쇄도 → DB 폭주하는 현상입니다. 방어 패턴 3가지: (1) **mutex / single-flight** — miss 발생 시 1개만 DB 가고 나머지는 대기, (2) **probabilistic early expiration** — 만료 직전 일정 확률로 미리 갱신, (3) **stale-while-revalidate** — 만료된 값을 일시적으로 반환하면서 백그라운드 갱신. 9번 Redis 심화 주제에서 다룰 영역입니다.

---

## Q4. "한국 → 미국 RTT 가 왜 ~150ms 인가요? 더 줄일 방법은?"

### 답변

**핵심**: 광속의 물리 한계 때문입니다. 한미 거리 ~10,000km 를 광섬유 (광속의 2/3) 로 가면 편도 ~50ms, RTT ~100ms 가 이론 최소. 라우터 hop, 케이블 우회로 실제 ~150ms 가 됩니다.

**설명**: 이 RTT 는 **물리 법칙에 의해 강제** 되어 어떤 기술로도 못 줄여요. 더 빠른 광섬유나 더 큰 bandwidth 가 throughput 은 늘려도 RTT 는 그대로입니다.

**실무 연결**: 직접 ping 으로 한미 RTT 측정해 보면 ~150ms 가 실제 나오는 걸 확인할 수 있어요.

**해결**: 데이터를 가까이 둡니다.
1. **CDN** — 정적 컨텐츠를 엣지에 캐시 (CloudFront, Cloudflare)
2. **Read replica + 리전 라우팅** — 사용자 가까운 리전으로
3. **Edge computing** — 동적 응답도 엣지에서 (Cloudflare Workers, Lambda@Edge)
4. **비동기 복제** — write 는 단일 리전, read 는 멀티 리전 (eventual consistency 수용)

### Q4-1: "그럼 멀티 리전 active-active 는 항상 좋은 건가요?"

**답변**: trade-off 가 큽니다. 장점은 latency 절감 + DR. 단점은 (1) consistency 약화 — cross-region write 동기화는 ~150ms RTT 비용, (2) 비용 — 인프라 ×N 배 + cross-region 데이터 전송 비용, (3) 운영 복잡도 — 갈등 해결 (last-write-wins, CRDT), 장애 시 split-brain. 비즈니스가 strong consistency 가 필요하면 active-passive (단일 write 리전 + 다른 리전은 read replica) 가 더 현실적입니다.

### Q4-1-1: "msa 프로젝트에 멀티 리전 적용한다면 어디부터?"

**답변**: 사용자 직접 응답 경로 + read 비중 높은 서비스부터 가는 게 합리적입니다. product 의 상품 조회는 read 가 압도적이고 strong consistency 가 필요 없으니, 한국 / 미국 리전 각각에 read replica + Redis 캐시 두는 게 가성비 좋아요. order / payment 같이 strong consistency 필요한 영역은 단일 리전 유지하고, 다른 리전 사용자는 RTT 비용을 받아들이거나 비동기 결제 처리로 우회. 이런 결정을 ADR-0025 latency budget 의 Tier 와 묶어서 가이드라인으로 만들면 좋겠습니다.

---

## Q5. "Little's Law 로 connection pool 사이즈 정해보세요."

### 답변

**핵심**: L = λ × W. 피크 throughput 100 req/s, 평균 query latency 20ms 라면 L = 100 × 0.02 = 2 connection 이 이론 최소.

**설명**: 안전 마진과 tail 대비해서 5-10 정도면 충분합니다. pool 을 200, 500 으로 키우는 건 의미 없고 오히려 DB 쪽 contention 만 늘려서 전체 latency 가 더 나빠질 수 있어요.

**실무 연결**: HikariCP 의 공식 권장도 비슷합니다 — "small is fast". cores × 2 + spindle count 같은 경험치가 있는데, 본질은 Little's Law 와 같은 결론이에요.

### Q5-1: "throughput 을 늘리면 latency 도 줄어드나요?"

**답변**: 함정 질문입니다. Little's Law 상 둘이 직접 비례 관계가 아닙니다. 오히려 **utilization 70-80% 넘어가면 큐 대기로 latency 가 비선형 증가** 하는 게 Queueing Theory (M/M/1) 의 결론이에요. 그래서 capacity planning 은 utilization 70% 를 목표로 잡는 게 실무적입니다.

### Q5-1-1: "그럼 throughput 늘리려면 어떻게?"

**답변**: 3가지 축으로 봅니다. (1) **수평 scale** — 인스턴스 수 늘려 동시 처리량 증가 (단, DB / 외부 의존이 병목이면 효과 제한). (2) **수직 효율** — 한 요청의 latency 를 줄여 시간당 더 많은 처리 (캐시, 인덱스, 비동기화). (3) **배칭** — 여러 요청을 묶어 처리 (Kafka batch, DB bulk insert). 어느 축이 효과적인지는 현재 병목이 어디인지 (USE method 의 utilization / saturation / errors) 봐야 결정됩니다.

---

## Q6. "fan-out 시스템에서 tail 줄이려면?"

### 답변

**핵심**: Jeff Dean 의 "The Tail at Scale" 논문 처방을 씁니다. 백엔드 N개 fan-out 시 전체 latency 는 max(N개) 라 tail 이 곱해지는 효과가 있습니다.

**설명**: 4가지 완화 전략:
1. **Hedged request** — 단일 호출 P95 시점에 백업 요청 발사, 빠른 쪽 채택
2. **Tied request** — 둘 동시 발사하되 한쪽 시작하면 다른 쪽 취소
3. **Micro-partitioning** — 한 백엔드 영향 범위 최소화
4. **Backend pool 의 outlier 제거** — 느린 인스턴스 health check 로 격리

**실무 연결**: 저는 fan-out 시뮬레이션을 Python lognormal 분포로 직접 돌려봤어요. 단일 백엔드 P99 50ms 일 때 100개 fan-out 시 전체 P50 이 ~110ms 까지 끌려가는 걸 확인했습니다. 본질적 해결은 fan-out 자체를 줄이는 것 — 배칭, 응답 캐싱, 미리 집계.

### Q6-1: "Hedged request 가 trade-off 가 있을 텐데요?"

**답변**: 네. (1) **백엔드 부하 증가** — 평균 ~5% (P95 시점에서만 발사하니까). (2) **idempotency 필수** — 같은 요청이 두 번 처리될 수 있으니. (3) **취소 비용** — tied request 는 cross-server 취소 메시지 비용이 있음. 그래서 read-only / idempotent 호출에 적용하고, write 는 신중. Google Spanner 같은 시스템이 이 패턴을 적극 사용한다고 알려져 있습니다.

### Q6-1-1: "msa 에서 fan-out 줄일 만한 곳이 있나요?"

**답변**: gateway 의 BFF (Backend For Frontend) 패턴이 가장 흔한 fan-out 위치입니다. 한 화면을 위해 product / wishlist / member 등 여러 백엔드를 동시 호출하는데, 각 호출의 tail 이 전체 응답 시간을 결정해요. 완화책:
1. **GraphQL / 응답 합성 캐시** — 자주 같이 조회되는 조합을 사전 집계
2. **streaming 응답** — 빠른 백엔드부터 부분 응답 (server-sent events / chunked)
3. **개별 호출의 P99 자체 개선** — 이게 사실 본질적 해결

---

## 실측 일화 카드 (모든 답변에 활용)

면접 답변에 자연스럽게 녹일 "직접 측정해 봤다" 카드 모음:

### 카드 #1: redis-cli 측정
> "redis-cli --latency-history 로 측정해 보니 같은 K8s 노드 기준 avg ~300µs, p99 ~1ms 가 나왔어요. Jeff Dean 표의 'DC 내 RTT 500µs' 자릿수와 일치했고, p99/avg ≈ ×4 라는 tail latency 비율도 확인했습니다."

### 카드 #2: 캐시 hit ratio 실험
> "k6 로 hit ratio 0/50/90/100% 시나리오를 직접 돌려봤습니다. hit 100% 일 때 P99 22ms 였는데, hit 90% 에서 78ms 까지 뛰었어요. 'hit 90% = 90% 좋다' 가 거짓말이라는 걸 데이터로 확인했습니다."

### 카드 #3: fan-out 시뮬레이션
> "Python lognormal 분포로 fan-out 시뮬레이션 돌려보니 단일 백엔드 P99 50ms 일 때 100개 fan-out 시 전체 P50 이 ~110ms 까지 가는 걸 봤어요. Jeff Dean 의 'Tail at Scale' 논문 결론과 일치합니다."

### 카드 #4: HTTP curl 분해
> "curl -w 로 단계별 분해해 보면 TTFB - pretransfer 가 순수 서버 처리 시간이라, 이게 dominant 인지 네트워크가 dominant 인지 빠르게 가르는 데 유용합니다."

### 카드 #5: Heatmap 으로 tail 변화 관측
> "Grafana heatmap 패널로 latency 분포를 시각화하면 GC pause 같은 tail 원인이 평균 그래프에서 안 보이는 패턴으로 드러나요. 부하 변화 시점에서 분포가 위쪽으로 확장되는 게 명확하게 보입니다."

---

## 시스템 설계 연결 (1개 시나리오)

### "글로벌 commerce 플랫폼 latency 설계 해보세요"

**1분 답변 흐름**:
1. **사용자 분포 파악** — 한국/미국/유럽 비율
2. **Latency Tier 정의** — 사용자 직접 응답 P99 200ms (글로벌 RTT 포함), 검색 500ms, 분석 5s
3. **데이터 위치 전략**:
   - Read 위주 (product, wishlist) → 멀티 리전 read replica + 리전별 Redis
   - Strong consistency (order, payment) → 단일 write 리전 + 다른 리전은 RTT 비용 수용
   - Static (이미지, 페이지) → CDN
4. **Tail 완화** — gateway 의 BFF fan-out 에 hedged request, 백엔드 P99 모니터링
5. **측정** — Prometheus + Grafana 로 리전별 P99 / heatmap 상시 노출
6. **Trade-off 명시** — multi-region active-active 의 consistency 비용 vs latency 절감

---

## 자가 점검

- [ ] 6개 핵심 질문 각각을 3-part 구조로 즉답 가능
- [ ] 꼬리 2단계 (총 18개 답변) 까지 막힘 없이 진행
- [ ] 실측 일화 5개를 자연스럽게 답변에 녹일 수 있다
- [ ] 시스템 설계 시나리오를 1분 안에 흐름으로 답변

## 다음 파일

- **12. ADR-0025 초안** ([12-adr-draft.md](12-adr-draft.md)) — 학습 산출물의 마지막 단계
