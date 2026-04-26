---
id: 12
title: Latency Numbers Every Programmer Should Know
status: completed
created: 2026-04-25
updated: 2026-04-26
learner-level: beginner
tags: [latency, performance, system-design, mental-model, networking, storage, hardware]
difficulty: intermediate
estimated-hours: 24
codebase-relevant: true
---

# Latency Numbers Every Programmer Should Know

## 1. 개요

L1/L2 캐시 → 메인 메모리 → SSD → 데이터센터 내부 → 리전 간 통신에 이르는 각 레이어의 지연 시간을 **숫자 감각**으로 익히는 주제. Jeff Dean 의 LADIS 2009 키노트에서 제시된 "Numbers Everyone Should Know" 가 원형이며, 시스템 설계 / 아키텍처 의사결정의 정량적 근거를 제공한다.

10ns(L1) ↔ 100ns(메인 메모리) ↔ 100µs(SSD) ↔ 500µs(같은 데이터센터 RTT) ↔ 150ms(대륙 간 RTT) — 자릿수 차이가 100,000 배까지 벌어지는 이 스펙트럼을 머릿속에 상주시켜야 캐시/배치/리전 배치/동기 vs 비동기 같은 결정을 직관적으로 내릴 수 있다.

> **방향성 노트 (2026-04-25 BS)**: 절대값을 암기하지 않는다. 영상 권고에 따라 **구간 간 상대 비율 / 자릿수 차이**로 감각을 잡고, 그 감각을 **아키텍처 의사결정에 활용**하는 데 비중을 둔다.

- 인접 구간 간 latency 비율을 즉답할 수 있다 (예: "메인 메모리 vs SSD 랜덤 read = 약 1000배", "DC 내 RTT vs 대륙 간 RTT = 약 300배")
- 각 구간을 자릿수(ns / µs / ms)로 그룹핑하여 머릿속 지도를 그릴 수 있다
- 시스템 설계 토론에서 "이 호출은 어느 자릿수 비용인가" 를 추론할 수 있다 (Redis GET vs MySQL PK vs Kafka produce vs S3 GET vs cross-region replication)
- 표를 근거로 한 아키텍처 패턴을 설명할 수 있다 (캐시 계층화, fan-out 의 tail latency 곱셈, 멀티 리전 vs 단일 리전, 동기 vs 이벤트 발행)
- msa 호출 경로(gateway → product → MySQL/Redis/ES)에 latency budget 자릿수 단위로 배분할 수 있다
- 면접에서 "이 API p99 가 느려요. 어디 의심?" 질문에 자릿수 기반 우선순위로 답할 수 있다

## 3. 선수 지식

- 컴퓨터 구조 기본 (CPU, 메모리 계층)
- OS 기본 (시스템 콜, context switch)
- 네트워크 기본 (TCP, RTT, bandwidth 개념)
- 분산 시스템 기초 (서비스 간 호출, 동기/비동기)

## 4. 학습 로드맵

### Phase 1: 자릿수 지도 만들기 (암기 X, 그룹핑 O)
- YouTube 영상 (참고 자료 #3) 시청 + 핵심 메시지 정리
- Colin Scott 인터랙티브 페이지로 2020 기준 숫자 확인 — 슬라이더로 연도 변화 체감
- Jeff Dean LADIS 2009 page 12 원전 표 1회 정독 — 역사적 맥락
- **숫자를 외우지 않는다**. 대신:
  - **자릿수 그룹**으로 묶기: ns 그룹(L1/L2/메모리) / µs 그룹(SSD/같은 DC) / ms 그룹(디스크 seek/대륙 간)
  - **인접 구간 비율** 5-7개만 기억: L1↔메모리(~100x), 메모리↔SSD(~1000x), SSD↔DC RTT(~30x), DC RTT↔대륙 간 RTT(~300x)
  - **유추 가능한 것은 외우지 않는다**: 표에 없어도 "이 정도 자릿수일 것" 이라고 추정하는 능력 우선

### Phase 2: 핵심 메커니즘 (B 수준 — "왜 그 차이가 나는가" 표면)
- **CPU 캐시**: cache line 개념, 캐시 hit/miss 로 인한 자릿수 차이, false sharing 의 실무 예 (MESI 는 이름만)
- **메모리 vs SSD vs HDD 의 물리적 차이**:
  - DRAM: 전기 신호 기반, ns 단위
  - SSD: NAND 페이지(4KB) 단위 read, seek 없음 → µs 단위
  - HDD: seek time + rotational latency 의 물리적 한계 → ms 단위
- **네트워크**:
  - 광속 한계 (광섬유 ~200,000 km/s) → 거리당 최소 RTT 계산
  - 같은 DC vs 같은 리전 vs 대륙 간 RTT 가 자릿수로 갈리는 이유
  - BDP = bandwidth × RTT, "BDP가 throughput 상한을 만드는" 직관
- **분산 시스템 응용**:
  - tail latency (P99/P999) 와 fan-out 의 곱셈 효과 (10개 서비스 fan-out → P99가 평균보다 훨씬 위)
  - 동기 호출 직렬 합산 vs 병렬화 vs 이벤트 발행으로 budget 절약

> **C 수준 (확장 스터디 트리거 — 별도 세션)**:
> - CPU: MESI 프로토콜, NUMA, 캐시 일관성
> - SSD 내부: FTL, write amplification, GC, wear leveling, TRIM
> - 네트워크: TCP slow start / congestion control / BBR, kernel bypass (RDMA, DPDK)
> - DRAM: row buffer, refresh, bandwidth 한계
> 위 항목은 인프라/SRE/DBA 깊이가 필요할 때 별도 학습. 본 세션에서는 "이런 게 있다" 인지 수준만.

### Phase 3: 풀 실측 + 벤치마크 (C 수준, ≈ 6-8h)

> **노트**: 10번(Observability) 주제와 강하게 겹친다. 본 세션에서 풀 실측까지 진행하므로, 10번 학습 시 본 결과를 재활용한다.

**3-A. 기본 실측**
- `redis-cli --latency`, `redis-cli --latency-history` 로 로컬 K8s Redis 실측 → 표의 µs 값과 대조
- `curl -w '@curl-format.txt'` 로 gateway → product API 호출 latency 측정 (DNS / connect / starttransfer / total 분리)
- `ping`, `mtr` 로 같은 K8s 노드 / 다른 노드 / 외부 RTT 비교 (k3d 환경)
- `time` + `dd` 로 컨테이너 내부 디스크 read 자릿수 확인

**3-B. 부하 테스트 + tail latency**
- `wrk` 또는 `k6` 로 product API 부하 측정: 평균 vs P50 vs P99 vs P999
- 캐시 적중률을 의도적으로 변경(0% → 50% → 100%)하면서 latency 분포 변화 측정
- fan-out 시나리오: gateway 가 여러 백엔드 호출 시 tail latency 곱셈 효과 직접 확인

**3-C. 메트릭 시각화 (10번 주제 맛보기)**
- 로컬 K8s 에 Prometheus + Grafana 임시 배포 (혹은 기존 인프라 활용)
- Spring Boot Actuator + Micrometer 의 HTTP latency 메트릭 수집
- 히스토그램 / heatmap 으로 latency 분포 시각화
- "P99 가 평균보다 높은 이유" 를 데이터로 설명

**3-D. 호출 경로 latency budget 작성**
- gateway → product → MySQL/Redis/ES 호출 경로별 자릿수 라벨링
- 같은 노드 vs 다른 노드 vs 다른 AZ 의 추정값 정리 (managed K8s 가정)
- 캐시 적중/미적중 시나리오의 latency budget 추정 + 실측값 대조

### Phase 4: 면접 대비 (≈ 6h, 비중 ~30%)

**4-A. 핵심 Q&A 카드 (꼬리 질문 2단계까지)**
- "왜 캐시를 쓰는가" 를 자릿수로 설명 (메모리 ~100ns vs 디스크 ~100µs vs 네트워크 ~500µs/150ms)
  - Q-1: "그럼 캐시도 자릿수마다 골라야 하나?" (in-process / Redis / CDN)
- "동기 호출 N개 = 직렬 합산 vs 병렬화" 패턴
  - Q-1: "병렬화하면 latency 가 max(N개) 가 되는 이유?"
- "데이터센터를 한국에 둘까 미국에 둘까" — latency 기반 답변
  - Q-1: "그럼 멀티 리전은 무조건 좋나?" (consistency / cost / 복잡도 트레이드오프)
- "API p99 latency 가 갑자기 늘었어요. 어디부터 보시겠어요?" — 자릿수 기반 layered 접근
  - Q-1: "tail latency 만 늘었으면 원인 후보는?"
- "latency vs throughput 차이" — Little's Law (L = λW)
  - Q-1: "처리량을 늘리면 latency 도 줄어드나?"
- "초당 N req 처리하려면 몇 대 필요?" 계산
  - Q-1: "이 답이 동기 호출일 때와 비동기일 때 다른가?"

**4-B. 실측 스토리 변환 (12번의 차별화 카드)**
- Phase 3 실측 결과를 면접 답변 스토리로 변환
- 예: "로컬 k3d 에서 redis-cli --latency 로 재 보니 약 ~µs, 표 값과 자릿수 일치했고 P99 는 약 N배 늘어나는 걸 직접 봤다"
- 예: "wrk 로 product API 에 부하 주면서 캐시 hit 률을 0/50/100% 로 바꿔 보니 P99 가 ... 변했다"
- 예: "fan-out 시나리오에서 백엔드 1개씩 늘릴 때마다 P99 가 곱셈으로 증가하는 걸 그래프로 확인"

**4-C. 함정/오해 포인트**
- "평균 latency" 만 보고 판단하는 함정 (P99 이상이 진짜 사용자 경험)
- "캐시 hit ratio 90%" 가 좋아 보이지만 miss 10% 의 latency 가 전체 P99 를 결정하는 함정
- "더 큰 인스턴스" 가 latency 를 줄이는지 throughput 을 늘리는지 혼동
- "광속이 한계" 임을 잊고 무리한 RTT 가정

### Phase 5: 코드베이스 산출물 — ADR-0025 작성 (≈ 4h)

- 위치: `docs/adr/ADR-0025-latency-budget.md`
- 입력: Phase 3-D (호출 경로 latency budget 작성 결과) + Phase 3-A/B 실측 데이터
- 구성:
  - **Context**: msa 가 다양한 backend(MySQL/Redis/ES/Kafka) 와 호출 경로(같은 노드/다른 노드/다른 AZ)를 갖는데, 설계 토론 때 latency 자릿수 합의가 없어 의사결정이 직관에 의존
  - **Decision**: 자릿수 기반 latency budget 표준 채택 (ns/µs/ms 그룹핑 + 호출 경로별 라벨 + 자릿수 의사결정 체크리스트)
  - **Consequences**: 신규 호출 경로 추가 시 budget 명시 필수 / 위반 시 ADR 갱신 / multi-region 이나 fan-out 도입 시 영향 분석 가이드라인
  - **Alternatives**: 절대값 SLO 강제 (X — 환경마다 다름) vs 자릿수 가이드라인 (O — 의사결정 유연)
  - **References**: 본 학습 노트 (`study/docs/12-latency-numbers/`), Jeff Dean Numbers, Colin Scott interactive

## 5. 코드베이스 연관성

직접적인 "코드 변경" 주제는 아니지만, msa 프로젝트의 다음 의사결정에 정량적 근거를 제공한다:

- **gateway 라우팅** (`gateway/`): 같은 클러스터 내 호출 vs 외부 호출 latency 비교
- **Redis 캐시 전략** (`product/`, `experiment/`, `analytics/`, `gifticon/`): 캐시 적중/미적중의 latency 자릿수 차이
- **Elasticsearch 검색** (`search/`): 인덱싱 latency 와 검색 latency 트레이드오프
- **Kafka 비동기 처리** (`order/`, `analytics/`): 동기 호출 대신 이벤트 발행으로 latency budget 절약
- **K8s 배포 전략** (`k8s/overlays/`): 같은 노드 vs 다른 노드 vs 다른 가용영역 latency
- **ClickHouse OLAP** (`analytics/`): 큰 스캔에서 메모리/디스크 대역폭 한계가 응답 시간에 미치는 영향

직접 연관 ADR/문서: 학습 결과로 `docs/adr/ADR-0025-latency-budget.md` 신규 작성 (Phase 5 산출물).

## 6. 참고 자료

- **인터랙티브 시각화**: https://colin-scott.github.io/personal_website/research/interactive_latency.html (2020년까지 갱신된 숫자, 슬라이더로 연도 변화 확인)
- **Jeff Dean LADIS 2009 키노트**: https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf (page 12 — 원전)
- **YouTube 강의**: https://www.youtube.com/watch?v=WbzMtyyOQpM (Latency Numbers 해설)
- **Designing Data-Intensive Applications** — Martin Kleppmann (latency, throughput, tail latency)
- **High Performance Browser Networking** — Ilya Grigorik (TCP, RTT, BDP 설명)

## 2.1 학습자 프로필 · 학습 전략 (2026-04-25 BS 결정)

- **현재 수준**: 초급 (A) — Jeff Dean Numbers 표 자체를 거의 본 적 없음
- **방향성**: 절대값 암기 X. **구간 간 비율 / 자릿수 그룹핑** 으로 감각 체화 → **아키텍처 활용** 까지 (영상 가이드 따름)
- **시간 분배**: Phase 1 ~3h / Phase 2 ~4h / Phase 3 ~7h / Phase 4 ~6h / Phase 5 ~4h ≈ **24h**
- **Phase 2 깊이**: B (핵심 메커니즘만). C 수준(MESI/FTL/TCP 내부)은 확장 트리거로만 명시
- **Phase 3 실측**: C (풀 실측 + 벤치마크). 10번 Observability 와 결과물 공유
- **Phase 4 면접 비중**: ~30%, 꼬리 질문 2단계까지 (Q → Q-1 → Q-1-1)

## 2.2 출력 형태 (2026-04-25 BS 결정)

- **메인 노트**: 서술형, Phase 별 본문 정리
- **Phase 끝 치트시트**: 1-페이지, 핵심 자릿수 / 비율 / 패턴 압축
- **Q&A 카드**: Phase 4 에서 6-8개 핵심 질문 + 꼬리 2단계 (실측 스토리 답변 포함)
- **함정/오해 포인트** 별도 섹션

## 2.3 연계 주제 학습 순서 (2026-04-26 BS 결정)

- **권장 순서**: **12 → 7 → 9 → 10 → 8**
- 12번이 다른 주제의 **공통 어휘 (자릿수 / 비율)** 를 깔아준다
- 12번 Phase 3-C (메트릭 시각화) 산출물은 10번 Observability 의 prerequisite 로 재사용
- 12번 Phase 3-A/3-B (실측 + 부하 테스트) 는 9번 Redis 와 10번 모두에서 재활용
- Little's Law / tail latency / fan-out 곱셈 효과는 7번 분산 시스템 토론 베이스라인
- 8번 시스템 설계 시나리오는 마지막에 두어, 1-12번 전체를 활용한 통합 응용으로 마무리

## 2.4 코드베이스 산출물 (2026-04-26 BS 결정)

- **산출물**: 정식 ADR — `docs/adr/ADR-0025-latency-budget.md`
- **포지셔닝**: 신규 서비스 / 신규 호출 경로 설계 시 latency budget 표준
- **포함 내용**:
  - msa 호출 경로별 자릿수 라벨 (gateway → service → MySQL/Redis/ES/Kafka)
  - Phase 3 실측 결과 요약 표 (로컬 K8s 기준 자릿수)
  - 같은 노드 / 다른 노드 / 다른 AZ / 다른 리전 RTT 추정값
  - 자릿수 기반 의사결정 체크리스트 ("동기 직렬 합산 OK인가? 캐시 계층 배치는?")
  - 위반 시 트레이드오프 (multi-region consistency, fan-out tail latency 등)
- **추가 시간**: ~4h → 총 ~24h
- **확장 여지**: 향후 production 환경 실측 데이터로 ADR 갱신 가능

## 7. 미결 사항

- ~~학습 깊이 #1~~ → **2026-04-25 BS**: 영상 권고 따라 "절대값 암기 X / 구간 비율 + 아키텍처 활용 O" 로 결정
- ~~학습 깊이 #2~~ → **2026-04-25 BS**: B (핵심 메커니즘만) 채택. C 수준은 확장 트리거로만 명시
- ~~실측 비중~~ → **2026-04-25 BS**: C (풀 실측 + 벤치마크) 채택. 10번 Observability 와 겹치는 영역은 본 세션 산출물 재활용
- ~~출력 형태 + 면접 비중~~ → **2026-04-25 BS**: B (균형, ~30%). 노트 + 치트시트 + Q&A 카드 + 함정 포인트, 꼬리 질문 2단계
- ~~연계 주제 학습 순서~~ → **2026-04-26 BS**: A (12번 먼저). 권장 순서 **12 → 7 → 9 → 10 → 8**. 12번이 자릿수 어휘를 깔아주면 후속 주제 토론 가속
- ~~코드베이스 산출물~~ → **2026-04-26 BS**: C (정식 ADR). `docs/adr/ADR-0025-latency-budget.md` 작성 → Phase 5 로 분리

**모든 미결 사항 해결 완료. 학습 시작 준비됨.**

## 8. 원본 메모

```
12. Latency Numbers Every Programmer Should Know, 즉 레이어간 통신 비용에 대한 스터(L1, 메인메모리, SSD, 데이터센터간 통신, 디스크, 리전간 통신 등)
  12-1. https://colin-scott.github.io/personal_website/research/interactive_latency.html
  12-2. https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf page 12
  12-3. https://www.youtube.com/watch?v=WbzMtyyOQpM
```
