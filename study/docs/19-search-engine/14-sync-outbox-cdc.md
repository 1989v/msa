---
parent: 19-search-engine
seq: 14
title: 동기화 — Outbox vs Debezium CDC, Eventual Consistency, 색인 lag SLA
type: deep
created: 2026-05-03
---

# 14. 동기화 — Outbox vs CDC

> 묶음 3 (B) 시니어 의사결정 핵심. Dual Write 금지 → 어떻게 동기화? Outbox vs CDC 의 선택 기준 + msa 의 idempotent-consumer 패턴 (ADR-0012/0029) 와 결합.

## 1. 한 줄 핵심

> **RDB (SoR) → 보조 저장소 (ES) 동기화는 단방향 + 비동기 + 멱등 + 측정 가능 한 lag SLA 가 표준.**
> 구현 패턴은 Outbox 또는 CDC. msa 는 Outbox + Kafka 가 주력.

## 2. Dual Write 의 함정 (다시 강조)

### 2-1. 안티패턴

```kotlin
@Transactional
fun createProduct(...) {
    val product = productRepo.save(...)   // 1. RDB 쓰기
    esClient.index("products", product.toEsDoc())  // 2. ES 쓰기 ❌
}
```

문제 시나리오:
- RDB 성공, ES 네트워크 실패 → 부정합 (RDB 만 있음)
- RDB 성공, ES 성공, 트랜잭션 commit 실패 → 부정합 (ES 만 있음)
- ES 응답 늦음 → 트랜잭션 길게 → DB 락 길게 → 다른 사용자 영향

→ **트랜잭션 안에서 외부 IO 절대 금지**. msa 의 `docs/conventions/transactional-usage.md` 와 정합.

### 2-2. Eventual Consistency 수용

해결책의 출발점:
- ES 가 RDB 와 **즉시 일치할 수 없다** 는 것을 받아들임
- 대신 **bounded lag** (P99 < N 초) 을 보장
- 사용자 UX 는 lag 를 인지하고 설계

## 3. 동기화 패턴 — 3가지

| 패턴 | 방법 | 장점 | 단점 |
|---|---|---|---|
| **Outbox** | RDB 트랜잭션 + outbox 테이블 + relay → Kafka → consumer → ES | 트랜잭션 내 일관성, 코드 명시적 | outbox 테이블 / relay 운영 추가 |
| **CDC (Debezium)** | binlog → Kafka → consumer → ES | 어플리케이션 코드 변경 ❌, 모든 변경 캡처 | 인프라 의존 (binlog), 스키마 진화 어려움 |
| **Dual Write (안티)** | app 이 직접 RDB + ES | 단순 | **부정합 위험** (위 §2) |

## 4. Outbox 패턴 상세

### 4-1. 흐름

```
[App]
  │
  │ @Transactional 시작
  ├─→ products 테이블 INSERT/UPDATE
  ├─→ outbox_events 테이블 INSERT (RDB 같은 트랜잭션)
  │ COMMIT
  │
  └─[Outbox Relay]→ Kafka 발행 (poll outbox)
                    │
                    ▼
                 [Kafka topic: product.item.updated]
                    │
                    ▼
                 [Consumer: search:consumer]
                    │
                    ▼
                 [ES bulk update]
```

### 4-2. outbox 테이블 스키마

```sql
CREATE TABLE outbox_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  aggregate_type VARCHAR(50) NOT NULL,    -- 'product'
  aggregate_id   VARCHAR(50) NOT NULL,    -- product id
  event_type     VARCHAR(100) NOT NULL,   -- 'product.item.updated'
  payload        JSON NOT NULL,           -- doc 전체 또는 변경 부분
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at   TIMESTAMP NULL,          -- relay 발행 후 표시
  INDEX idx_unpublished (published_at, id)
);
```

### 4-3. App 코드

```kotlin
@Transactional
fun updateProduct(id: Long, dto: UpdateDto) {
    val product = productRepo.findById(id) ?: throw NotFound()
    product.update(dto)
    productRepo.save(product)
    
    // 같은 트랜잭션에 outbox 이벤트 기록
    outboxRepo.save(OutboxEvent(
        aggregateType = "product",
        aggregateId = product.id.toString(),
        eventType = "product.item.updated",
        payload = product.toEventPayload()
    ))
    // commit 시 두 테이블 모두 동시 반영 또는 둘 다 롤백
}
```

→ **두 INSERT 가 같은 트랜잭션** = atomicity 보장.

### 4-4. Relay (Polling vs Push)

#### Polling 방식

```kotlin
@Scheduled(fixedDelay = 1000)  // 1초마다
fun publishOutbox() {
    val events = outboxRepo.findUnpublished(limit = 100)
    events.forEach { event ->
        kafkaTemplate.send(event.eventType, event.payload)
        event.markPublished()
    }
    outboxRepo.saveAll(events)
}
```

장점: 단순, app 코드만으로 가능
단점: lag = polling interval (1s)

#### Push 방식 (Debezium 활용)

- Debezium Outbox Event Router 가 outbox 테이블의 binlog 를 Kafka 로 직접
- lag 매우 짧음 (~100ms)
- Debezium 운영 부담

#### Transactional Outbox + Listener (Postgres LISTEN/NOTIFY)

- Postgres 만 가능 (MySQL 미지원)
- LISTEN/NOTIFY 로 즉시 알림 → relay 가 바로 발행

### 4-5. msa 의 패턴

`docs/conventions/idempotent-consumer.md` (ADR-0012/0029) 가 이 영역.

가정 흐름:
- product 트랜잭션 + outbox INSERT
- relay (별도 모듈 또는 Debezium Outbox Router)
- Kafka topic: `product.item.created` / `product.item.updated`
- search:consumer 가 받아서 멱등 처리 + ES bulk

## 5. CDC (Debezium) 패턴 상세

### 5-1. 흐름

```
[App]
  │
  └→ products 테이블 INSERT/UPDATE
        │
        │ MySQL binlog 자동 기록
        ▼
   [Debezium MySQL Connector]
        │ binlog 읽어서 변경 추출
        ▼
   [Kafka topic: dbserver.commerce.products]
        │
        ▼
   [Consumer: search:consumer]
        │
        ▼
   [ES bulk]
```

### 5-2. 장점

- **app 코드 변경 ❌** — 기존 RDB 만 쓰면 자동 캡처
- **누락 없음** — binlog 가 모든 변경 기록
- **순서 보장** — binlog 순서 그대로
- **schema 변화 감지** — Debezium 이 schema 변경도 이벤트로

### 5-3. 단점

- **MySQL 권한** — REPLICATION SLAVE 권한 필요
- **binlog 형식** — `binlog_format=ROW` 강제
- **DBA 협조** — DB 설정 변경
- **Schema evolution** — column 추가/삭제 시 consumer 가 호환되어야
- **Debezium 운영** — Kafka Connect / Strimzi 등 인프라 추가

### 5-4. Debezium 설정 예

```json
{
  "name": "products-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "***",
    "database.server.id": "184054",
    "topic.prefix": "dbserver",
    "database.include.list": "commerce",
    "table.include.list": "commerce.products",
    "snapshot.mode": "initial"
  }
}
```

→ Kafka topic 자동 생성 (`dbserver.commerce.products`).

### 5-5. CDC 의 함정

- **트랜잭션 경계** — 한 트랜잭션 = 여러 binlog 이벤트. consumer 가 transaction marker (BEGIN/END) 로 묶어야 일관성.
- **DDL 변경** — column 추가 시 consumer schema mismatch
- **숫자 / 날짜 / decimal 정밀도** — MySQL → JSON 변환 시 손실 가능

## 6. Outbox vs CDC 선택

| 기준 | Outbox | CDC |
|---|---|---|
| App 코드 수정 | 필요 | 불필요 |
| 트랜잭션 일관성 | 자연 (같은 트랜잭션) | binlog 순서 |
| Schema 진화 | 명시적 (event 정의) | 자동 (binlog) but 처리 어려움 |
| 운영 부담 | 낮음 (DB만) | 높음 (Debezium / Kafka Connect) |
| 누락 가능성 | 0 (트랜잭션) | 0 (binlog 손실 없음) |
| 성능 | polling lag | ms 단위 (binlog 직접) |
| 도메인 이벤트 의미 | 명시적 (event_type, payload) | row 변화로 추론 |
| 다중 보조 저장소 | event 한 번 발행 → 여러 consumer | 같음 |
| 새 도메인 추가 | 코드 변경 | 권한 추가 |

### 6-1. 시니어 결정

- **신규 시스템 / 도메인 이벤트 명시적**: Outbox
- **legacy DB 변경 어려움 / 도메인 이벤트 정의 어려움**: CDC
- **하이브리드** — 핵심 도메인은 Outbox, 부수 (감사 / 분석) 는 CDC

→ msa 는 Outbox 우선 (도메인 이벤트 명시적, 장기 진화 용이).

## 7. 멱등성 (Idempotent Consumer)

### 7-1. 왜 필요한가

- Kafka at-least-once delivery → 같은 이벤트 여러 번 도착
- consumer 재시작 / 리밸런싱 → 중복 처리
- 네트워크 재시도 → 중복

→ 같은 이벤트를 여러 번 적용해도 ES 상태가 같아야 (idempotent).

### 7-2. 패턴 1: ES `version_type=external`

```kotlin
fun handle(event: ProductUpdatedEvent) {
    esClient.index(IndexRequest("products")
        .id(event.productId)
        .source(event.payload)
        .versionType(VersionType.EXTERNAL)
        .version(event.version)   // 도메인 version (예: updated_at epoch)
    )
    // ES 가 version 비교 → 옛 버전이면 거부 (409)
}
```

→ out-of-order 메시지가 새 버전을 덮어쓰지 못하게.

### 7-3. 패턴 2: Processed Event Log

```sql
CREATE TABLE processed_events (
  event_id VARCHAR(100) PRIMARY KEY,
  processed_at TIMESTAMP
);
```

```kotlin
fun handle(event: Event) {
    if (processedRepo.exists(event.id)) return  // 이미 처리됨
    
    esClient.index(...)   // ES 적용
    
    processedRepo.save(ProcessedEvent(event.id))
}
```

→ 단점: RDB lookup 추가, exactly-once 가까이지만 race condition 여지.

### 7-4. 패턴 3: 도메인 자체 멱등

```kotlin
fun handle(event: ProductUpdatedEvent) {
    // payload 그대로 ES 에 (덮어쓰기)
    // 같은 payload 여러 번 = 같은 ES state
    esClient.index(...)
}
```

→ payload 가 self-contained 면 자연 멱등. 단, 순서 보장 + version 으로 보강.

### 7-5. msa 패턴 (추정)

`docs/conventions/idempotent-consumer.md` 의 ADR-0012/0029 가 위 패턴들 중 하나. §15 에서 코드 확인.

## 8. 색인 lag SLA

### 8-1. lag 의 정의

```
lag = (ES 에서 doc 가 검색 가능해진 시점) - (RDB 에서 doc 가 commit 된 시점)
```

총 lag 의 구성:
- Outbox INSERT 후 relay polling 까지: 0~1s (polling 주기)
- Kafka 전송: ~10ms
- consumer poll + 처리: 100ms~1s
- ES bulk 인덱싱: 10~100ms
- ES refresh: 0~1s (refresh_interval default)

→ 총 lag ≈ 1~3s (P50), 5s (P99)

### 8-2. SLA 정의 (ADR-0025 결합)

ADR-0025 latency budget 에 추가 후보:
> "**색인 lag SLA**: product 변경 → search 결과 반영 P99 < 5초."

이 SLA 가 있어야:
- 운영 모니터링 가능 (실측 vs SLA 비교)
- 사용자 UX 설계 가능 (lag 5초 이내 = 일반 사용자 인지 ❌)
- 변경 시 영향 평가 가능

### 8-3. 측정 방법

```
[App] product.update() → outbox INSERT (timestamp_1)
[ES] doc indexed + refreshed (timestamp_2)

lag = timestamp_2 - timestamp_1
```

구현:
- outbox 이벤트에 `created_at` 기록
- consumer 가 ES 에 인덱싱 시 `indexed_at` 필드 추가 (또는 별도 메트릭 수집)
- 모니터링 시스템 (Prometheus) 으로 lag histogram

### 8-4. lag 줄이기

| 단계 | 최적화 |
|---|---|
| Outbox polling | interval ↓ (1s → 100ms) 또는 push (LISTEN/NOTIFY) |
| Kafka | partition / consumer 병렬화 |
| Consumer | bulk batch 사이즈 적정 (작으면 throughput ↓) |
| ES bulk | refresh interval default 1s 그대로 (사용자 OK) |
| ES refresh | wait_for (즉시 보고 싶은 경우만, 일반 ❌) |

## 9. 재구성 가능성 (Source of Truth 원칙)

### 9-1. 원칙

> **ES 의 데이터가 모두 사라져도 RDB 에서 재구성 가능해야 한다.**

→ 영상 요약의 핵심 원칙. ES 는 SoR 가 아닌 파생.

### 9-2. msa 구현

- `search:batch` 가 product DB 전체 → ES 재인덱싱
- alias swap 으로 무중단 (§13)
- RTO (Recovery Time Objective) = batch 시간

### 9-3. RTO 측정 / 훈련

- 분기마다 staging 에서 ES 인덱스 전체 삭제 + reindex 시간 측정
- production 에서는 alias swap 으로 zero-downtime
- 임베딩 모델 변경 시도 같은 패턴

→ §16 (운영) 에서 detail.

## 10. 흔한 실수 패턴

### 10-1. 트랜잭션 안에서 ES 호출

→ 위 §2. 외부 IO 분리 절대 원칙.

### 10-2. Outbox relay 누락

→ 이벤트 발행 안 됨. ES lag = 무한대 (영원히 stale).
→ 해법: outbox 테이블 unpublished count 모니터링 + alert.

### 10-3. Outbox 테이블 폭증

→ relay 가 published_at 만 표시하고 row 안 지움 → 테이블 무한 증가.
→ 해법: 주기적 archival / 삭제 (예: 7일 후 published 된 것 delete).

### 10-4. Consumer 멱등성 무시

→ 같은 이벤트 두 번 → ES 에 두 번 적용 (보통 같은 결과지만 race 가능).
→ version_type=external 또는 processed event log.

### 10-5. version 없이 out-of-order 처리

```
event v1 도착 → ES 적용
event v2 도착 → ES 적용
event v1 (재전송) 도착 → ES 가 v2 를 v1 으로 덮음 (데이터 손상)
```

→ version 비교 필수.

### 10-6. lag 모니터링 없음

→ Kafka consumer lag, ES indexing rate, end-to-end lag 측정 안 함. 사고 후에야 인지.

### 10-7. Debezium 의 schema 변경 무시

→ DBA 가 column 추가 → consumer 가 모름 → 매핑 안 맞는 doc 적재.

### 10-8. CDC 의 트랜잭션 경계 무시

→ multi-table 트랜잭션의 이벤트들을 독립 처리 → 일시적 부정합 (트랜잭션 partial state 노출).

## 11. msa 시사점

### 11-1. ADR 후보

- "**색인 lag SLA**: product → search 반영 P99 < 5초" (ADR-0025 보강)
- "**Outbox 표준 패턴**: 모든 도메인 → 보조 저장소는 Outbox + Kafka" (이미 ADR-0012 등에 있을 가능성)

### 11-2. 검증 항목

`search/CLAUDE.md` + `docs/conventions/idempotent-consumer.md` 점검:
- [ ] product 트랜잭션이 ES 직접 호출하는지 (안티패턴)
- [ ] outbox 테이블 / relay 가 있는지
- [ ] consumer 가 멱등인지 (version_type=external)
- [ ] lag 모니터링이 있는지
- [ ] retry / DLQ 설정이 있는지

→ §15 grounding.

## 12. 자주 듣는 오해 정정

> **"ES 트랜잭션 클라이언트가 있다"**

- ❌ ES 는 분산 트랜잭션 X. 단일 doc 에서만 atomic.

> **"Outbox 가 있으면 Dual Write 와 다르다"**

- ✅ outbox INSERT 가 RDB 트랜잭션에 포함되어 atomic. dual write 는 ES 가 트랜잭션 밖.

> **"CDC 가 Outbox 보다 항상 좋다"**

- ⚠ legacy 시스템 / 코드 변경 어려움이면 OK. 신규 / 도메인 이벤트 명시적이면 Outbox 권장.

> **"version_type=external 만 있으면 멱등"**

- ⚠ ES 에 대해서는 OK. 하지만 ES 인덱싱 외 다른 side effect (메일 / 알림) 도 멱등화 필요.

> **"색인 lag 는 1초 이내가 표준"**

- ⚠ 도메인 의존. 사용자 검색은 1~5초 OK, 결제 직후 검색은 즉시 wait_for 등.

> **"reindex 는 재해 복구가 아니다"**

- ❌ 재해 복구의 일부. RDB 가 SoR 인 한 ES 는 재구성 가능 = ES 백업 부담 ↓.

## 13. 다음 학습

- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa 의 실제 outbox / consumer / batch 코드 분석
- [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) — lag 모니터링 + RTO 측정
- [19-improvements.md](19-improvements.md) — 색인 lag SLA ADR

> **§14 회독 체크리스트**:
> - [ ] Dual Write 의 3가지 부정합 시나리오를 답할 수 있다
> - [ ] Outbox 패턴의 흐름 (트랜잭션 → outbox → relay → Kafka → consumer)
> - [ ] CDC (Debezium) 가 binlog 를 어떻게 활용하는가
> - [ ] Outbox vs CDC 선택 기준 5가지
> - [ ] 멱등성 패턴 3가지 (version_type / processed log / 자체 멱등)
> - [ ] 색인 lag SLA 의 정의 + 구성 요소 + 측정 방법
> - [ ] "ES 가 모두 사라져도 RDB 에서 재구성" 원칙의 의미
