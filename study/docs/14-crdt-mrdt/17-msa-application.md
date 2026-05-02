---
parent: 14-crdt-mrdt
seq: 17
title: msa 코드베이스 적용 검토 — analytics · wishlist · quant
type: deep
created: 2026-05-01
---

# 17. msa 적용 검토

코드 직접 분석 후 결론. 결론을 먼저 말하면: **현 시점 msa 에 CRDT 도입은 필요 없다**. 그 근거를 영역별로.

## 현 msa 의 분산 모델 요약

```
저장소 운영 모델:
  - MySQL: primary 1대 + read replica (단일 region)
  - Redis: standalone (또는 cluster 모드 선택), 단일 region
  - Kafka: partition replication (ISR), 단일 region
  - Elasticsearch / OpenSearch / ClickHouse: 단일 클러스터

데이터 흐름:
  쓰기 → primary (단일 master) → 비동기 복제
  읽기 → primary 또는 replica

→ 분산 동시 쓰기 자체가 없음 → CRDT 불필요
```

CRDT 의 트리거인 *multi-region active-active* 가 없다. K8s 운영도 현재 단일 region (k3s-lite 또는 prod-k8s, [ADR-0019](../../docs/adr/ADR-0019-k8s-migration.md)).

## 영역 1: analytics (PV/UV 카운터, 좋아요)

### 현 코드

`/Users/gideok-kwon/IdeaProjects/msa/analytics/`

```kotlin
// ProductScore.kt — 단순 누적 카운터
data class ProductScore(
    val productId: Long,
    val impressions: Long,
    val clicks: Long,
    val orders: Long,
    ...
) {
    companion object {
        fun compute(productId, impressions, clicks, orders, normalizer) = ...
    }
}
```

```kotlin
// AnalyticsStreamTopology.kt — Kafka Streams 로 1시간 윈도우 집계
events
    .groupByKey(Grouped.with(Serdes.String(), eventSerde))
    .windowedBy(TimeWindows.ofSizeWithNoGrace(WINDOW_SIZE))
    .aggregate({ ProductMetrics() }, ...)
```

### CRDT 후보 평가

```
PV/UV 카운터:
  쓰기: Kafka 이벤트 → Kafka Streams (단일 instance group)
       → ClickHouse (단일 클러스터)
  분산 동시 쓰기: Kafka partition 단위 — 하나의 partition 은 하나의 consumer 가 처리
  → 동시 쓰기 충돌 자체가 없음
  → PN-Counter 불필요

만약 multi-region 으로 확장:
  region A 의 Kafka Streams 가 PV 집계
  region B 의 Kafka Streams 가 PV 집계
  region 간 글로벌 PV 가 필요?
    → CRDT (G-Counter) 후보
    → 또는 region 별 분리 + 사후 합산 (단순)
```

### 평가

```
현재: 불필요 (단일 region, partition 분리)
미래 (multi-region): G-Counter 가 자연스러우나 단순 sum 도 가능
판정: ★ 낮음 (도입 가치 낮음)
```

## 영역 2: wishlist (멀티 디바이스 동기화)

### 현 코드

`/Users/gideok-kwon/IdeaProjects/msa/wishlist/`

```kotlin
// WishlistItem — 단일 entity
class WishlistItem private constructor(
    val id: Long? = null,
    val memberId: Long,
    val productId: Long,
    val createdAt: LocalDateTime
)

// WishlistService — 단순 CRUD
@Transactional
override fun execute(command: AddWishlistItemUseCase.Command) {
    if (wishlistRepositoryPort.existsByMemberIdAndProductId(...))
        throw WishlistItemDuplicateException()
    val item = WishlistItem.create(...)
    wishlistRepositoryPort.save(item)
}
```

DB unique 제약 `(memberId, productId)` 으로 중복 방지.

### CRDT 후보 평가

```
시나리오: 사용자가 mobile 과 web 으로 동시에 wishlist 수정
  - mobile: add product-1 (오프라인)
  - web: remove product-1
  - mobile sync 후 add 가 들어옴

현재 동작:
  - 모든 쓰기가 즉시 MySQL primary 로 → 시간 순으로 처리
  - 오프라인 모드 없음 → mobile 이 sync 시점에 add 시도 → 단순 INSERT
  - INSERT 가 unique 제약 위배? mobile 의 add 가 *web 의 remove 이후* 에 들어왔으면
    실제로 새 row → product-1 살아남음 (Add-Wins 와 같은 효과)
  - 다만 의도 불명확 — 사용자가 *어떤 add* 를 의도했나?

OR-Set 도입 시:
  - WishlistItem 이 (memberId, productId, addTag, removed) 구조
  - mobile 의 add 가 새 tag 부여 → web 의 remove 가 tag 모름 → add 살아남음
  - 의도 명확

비용:
  - 자료구조 복잡도 ↑
  - DB 스키마 변경 필요
  - tombstone GC 필요
```

### 평가

```
현재: 불필요 (오프라인 모드 없음, 단일 master)
오프라인 모바일 앱 도입 시: OR-Set 검토 가치 있음
판정: ★★ (오프라인 모바일 앱 트리거 시)
```

만약 wishlist 를 *오프라인 우선 모바일 앱* 의 데이터로 확장한다면 CRDT (Yjs/Automerge 또는 자체 OR-Set) 가 자연스럽다.

## 영역 3: quant (분산 포지션 / 백업)

### 현 코드

`/Users/gideok-kwon/IdeaProjects/msa/quant/`

```
도메인:
  - TrancheSlot (회차별 슬롯, state 전이)
  - TrancheStrategy (전략 설정)
  - Order (주문)
  
운영:
  - tenantId 기반 격리 (INV-05)
  - 단일 master DB (MySQL quant)
  - 모든 도메인 변경이 outbox → Kafka
  - 정확성 매우 중요 (실 자금 거래)
```

```kotlin
// TrancheSlot.kt — 엄격한 state machine
class TrancheSlot internal constructor(...) {
    var state: TrancheSlotState = state
        private set

    fun fillBuy(executedPrice: Price, executedQty: Quantity) {
        if (state != TrancheSlotState.PENDING_BUY) throw ...
        // ... 정확한 state 전이
    }
}
```

### CRDT 후보 평가

```
포지션 / 주문 상태:
  - 정확성 절대 우선 (자금)
  - state machine 의 *순서가 의미 있음* (BUY → FILLED → SELL → CLOSED)
  - 동시 transition 충돌 시 CRDT merge 가 의미 잃음
  - 예: A 의 fillBuy + B 의 cancelBuy → CRDT 는 어느 게 이긴다고 결정?
       자금 거래에서 임의 결정은 불가
  → CRDT 부적합

multi-region 백업?
  - read-only replica 로 충분 (binlog 또는 logical replication)
  - 또는 region 별 tenant 분할 (sharding)
  → CRDT 불필요

multi-region active-active 로 확장 시?
  - 같은 tenant 의 같은 strategy 가 두 region 에서 활성?
  - 거래소 API 자체가 single source of truth — region 분산 의미 없음
  - 결론: active-active 자체가 의미 없음
```

### 평가

```
판정: ★ 매우 낮음 (정확성 우선 + 거래소 SSOT)
```

CRDT 의 자동 merge 는 *데이터 손실 허용도가 있는* 도메인에 적합. 자금 거래에서는 단일 master + Saga + 정확한 reconcile 이 정공법.

## 영역 4 (관찰): 그 외 가능성

### admin / agent-viewer (협업)

현재 단일 사용자 도구. 만약 *팀 단위 협업 편집* 추가하면 Yjs 후보.

### ideabank (PRD 협업 작성)

현재 단일 사용자 + git 으로 다듬음. 협업 PRD 작성으로 확장한다면 Yjs / Automerge 후보.

### chatbot / charting

단일 사용자 / 서버 중심 처리. CRDT 트리거 없음.

## 종합 결론

```
영역                    | 현재 필요성 | 미래 트리거                 | 판정
────────────────────────┼─────────────┼─────────────────────────────┼──────
analytics PV/UV         | 없음        | multi-region 글로벌 카운터  | ★
wishlist                | 없음        | 오프라인 모바일 앱           | ★★
quant            | 없음        | 없음 (거래소 SSOT)          | ★
admin / agent-viewer    | 없음        | 팀 협업 편집                | ★★
ideabank                | 없음        | 협업 PRD 작성               | ★★
chatbot / charting      | 없음        | 없음                        | ★
```

**결론: 현 시점 msa 에 CRDT 도입 없음. 트리거 시 검토.**

## 만약 도입한다면 단계별 권장

```
1단계: 작은 영역에서 OR-Set 자체 구현
  - 학습 + 운영 경험
  - 예: wishlist 의 멀티 디바이스 sync (모바일 앱 추가 시)

2단계: 협업 도구라면 Yjs
  - 자료구조 자체 구현보다 라이브러리 활용
  - WebSocket relay 서버 1대 추가

3단계: 글로벌 분산 (multi-region) 시 Redis Enterprise CRDB
  - cache 레이어부터 (낮은 위험)
  - 정합성 critical 한 도메인은 별도

4단계: 자체 분산 KV CRDT (Riak DT 같은 것)
  - 거의 권장 안 함 (Basho 사례)
  - 마지막 옵션
```

## 트리거 조건 명시 (ADR 후보)

```
CRDT 도입을 검토할 만한 트리거:
  T1. multi-region active-active 결정 (예: 글로벌 사용자 < 200ms 응답)
  T2. 오프라인 우선 모바일 앱 추가 결정
  T3. 협업 편집 도구 추가 결정 (예: 팀 PRD, 디자인)
  T4. 외부 partner 시스템과 분산 데이터 sync 필요

위 4 중 하나라도 *결정* 되면 ADR 작성 + 영역별 CRDT 자료구조 선택.
```

## 면접 포인트

- **"이 회사 도메인에 CRDT 가 적합한 곳은?"** — single-region single-master 전제하에선 없다. multi-region active-active / 오프라인 모바일 / 협업 편집 / P2P federation 중 하나가 트리거. 현 시점 msa 는 트리거 없음.
- **"PV/UV 카운터에 CRDT 검토했는데 왜 안 쓰나?"** — Kafka partition 단위로 단일 consumer 가 처리. 동시 쓰기 자체가 없음. multi-region 으로 가면 G-Counter 가 자연스러우나, 그 단계는 단순 region 별 sum 으로도 충분.
- **"wishlist 같은 사용자 데이터에 OR-Set 좋지 않나?"** — 오프라인 작업이 없으면 단순 INSERT/DELETE 가 더 명료. 오프라인 모바일 앱이 추가되면 그 때 OR-Set 검토.
- **"자동매매(quant) 에 CRDT?"** — 부적합. 자금 거래는 정확성 우선이라 임의 merge 결정 불가. 거래소 자체가 single source of truth — region 분산 의미 없음.

## 다음 학습

- [18-improvements.md](18-improvements.md) — ADR 후보 본격 작성
- [19-interview-qa.md](19-interview-qa.md) — 면접 회독
