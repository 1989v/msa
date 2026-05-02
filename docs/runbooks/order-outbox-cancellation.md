# Runbook — Order Outbox + Cancellation 보상 흐름

**ADR**: [ADR-0032](../adr/ADR-0032-order-outbox-cancellation.md)
**Plan**: [ADR-0032 Implementation Plan](../plans/ADR-0032-implementation-plan.md) (PR-4 / Phase 3)
**Owner**: Order Squad + Inventory Squad (1차) / SRE (2차)
**Dashboard**: Grafana → "Order Cancellation / Outbox (ADR-0032)" (`uid=adr-0032-order-cancellation`)
**Last reviewed**: 2026-05-01

---

## 1. 시스템 개요

```
order-service (TX) ──> outbox_event (PENDING) ──> OutboxPollingPublisher ──> Kafka
                                                                                │
                                                                                ▼
                                                inventory-service ── onOrderCancelled
                                                                       └─> releaseStockByOrderUseCase
                                                                              (ACTIVE → CANCELLED)
```

- **TX 안에서 outbox INSERT**: order entity save 와 같은 commit 에 묶임 (atomicity 보장)
- **Polling publisher**: 1초 fixedDelay (`outbox.polling.interval-ms`)로 PENDING row 발행
- **At-least-once**: 발행 실패 시 row 는 PENDING 으로 유지, 다음 polling 재시도
- **30분 TTL fallback** (`ReservationExpiryService`): 정상 흐름에서 발화 0 이어야 함 — 발화 = 본 흐름 장애

## 2. 핵심 메트릭

| 메트릭 | 의미 | 정상 |
|---|---|---|
| `outbox_pending_count{application=...}` | 가장 최근 polling 시점의 PENDING row 수 | <100, 빈번히 0 |
| `outbox_publish_total` | 발행 성공 누적 (counter) | 정상 트래픽에 비례 |
| `outbox_publish_error_total` | 발행 실패 누적 (counter) | 0 또는 매우 낮은 비율 |
| `order_cancellation_to_release_latency_seconds` | order.cancelled → inventory release latency (histogram) | p99 ≤ 5s |
| `inventory_reservation_expired_total{warehouse_id=...}` | TTL fallback 발화 누적 | **0** |

Grafana 대시보드 패널 위치:
1. "Outbox PENDING rows by service" — outbox_pending_count
2. "Outbox publish rate (success vs error)"
3. "Order cancellation → inventory release latency" — p50/p95/p99 by reason
4. "TTL fallback expiries (last 1h)" — invariant 검증
5. "Kafka consumer lag — inventory-service"

## 3. 알람 트리아지 워크플로

알람을 받았을 때 가장 먼저 보는 곳:
1. Grafana 대시보드 ADR-0032 (위 링크)
2. order-service / inventory-service pod 로그 (`kubectl logs -n commerce -l app=order-service --tail=200`)
3. MySQL outbox_event 테이블 (`outbox_event WHERE status='PENDING' ORDER BY created_at LIMIT 50`)
4. Kafka consumer group lag (`inventory-service`)

### 3.1 OutboxLagHigh (warn, >100 for 5m)

**의미**: order-service 의 outbox 발행이 누적되고 있음.

**진단 순서**:
1. Grafana → "Outbox publish rate" 패널 확인.
   - `outbox_publish_error_total` 가 동시에 증가? → **3.3** (publish failure) 로 점프.
   - error 는 0 인데 success 도 멈춤? → polling publisher 자체 정지 의심 (3.1.a).
2. `kubectl logs -n commerce -l app=order-service --tail=300 | grep -i outbox`
   - "Failed to publish outbox event" 로그 → 메시지 송신 실패 (3.3 으로).
   - 로그 자체가 없음 → @Scheduled 가 동작 안 하거나 publisher bean 미등록 (3.1.a).
3. Kafka 클러스터 health (`kubectl get pods -n kafka`) — broker 다운 시 모든 producer 영향.

#### 3.1.a Polling publisher 정지 진단
- order-service pod 의 actuator health: `kubectl exec -it <pod> -- curl -s localhost:8080/actuator/health/livenessState`.
- thread dump: `kubectl exec -it <pod> -- curl -s localhost:8080/actuator/threaddump | grep -A2 scheduling-`. `OutboxPollingPublisher` thread 가 BLOCKED 상태? → 3.4 DB lock 진단.
- 임시 우회: `kubectl rollout restart deploy/order-service -n commerce` (재기동 후 PENDING row 자동 발행).

### 3.2 OutboxLagCritical (page, >1000 for 1m)

**의미**: 보상 흐름 사실상 정지. flash sale / refund 실패 risk.

**즉시 조치**:
1. PagerDuty 응답 후 Slack `#incident-commerce` 채널에 상황 공유.
2. Grafana 대시보드 캡처 + outbox_event 카운트 SQL 결과 첨부.
3. 위 3.1 진단을 압축 진행.
4. **임시 완화**:
   - order-service replica 증설 (`kubectl scale deploy/order-service --replicas=N+1`) — polling 병렬화로 throughput 증가.
   - polling interval 단축: `outbox.polling.interval-ms=500` 으로 ConfigMap 수정 후 rollout.
5. 30분 TTL fallback 이 working 하므로 사용자 영향은 30분 지연 — 그 안에 복구 목표.

### 3.3 OutboxPublishFailureRateHigh (warn, error rate >1% for 5m)

**의미**: Kafka 발행이 일부/전부 실패.

**진단 순서**:
1. order-service 로그에서 stack trace 추출.
   ```
   kubectl logs -n commerce -l app=order-service --tail=500 | grep -A20 "Failed to publish outbox"
   ```
2. 자주 보이는 원인:
   - `TimeoutException` / `NotLeaderForPartitionException` → broker / partition leader 문제. Kafka SRE 팀 핸드오버.
   - `AuthorizationException` → topic ACL. RBAC 변경 후 미반영.
   - `RecordTooLargeException` → payload 비대 (대량 items 주문). `producer.max-request-size` 조정 또는 payload slim down.
   - `SerializationException` → ObjectMapper / Avro schema 불일치 (본 plan 은 Jackson 사용 — schema registry 미사용).
3. broker 자체가 정상이면 (`kubectl get pods -n kafka`) `kafkaTemplate` ProducerFactory bean 의 metric 확인.

### 3.4 CancellationLatencyP99High (warn, p99 > 5s for 10m)

**의미**: order.cancelled → inventory release latency SLA 위반.

**진단 순서**:
1. Grafana "Kafka consumer lag — inventory-service" 패널 확인.
   - lag 가 누적 → consumer 처리 느림 (3.4.a).
   - lag 0 인데 latency 큼 → 시계 skew 또는 Outbox publisher 자체 지연 (3.1).
2. inventory-service 로그.
   ```
   kubectl logs -n commerce -l app=inventory-service --tail=300 | grep -i "Released stock"
   ```
3. Order 측 publish 시각 vs inventory 처리 시각 차이 패턴 확인:
   - 항상 1-2초 → 정상 (polling 1s + 처리).
   - 가끔 30s+ spike → consumer rebalance / DB lock.

#### 3.4.a Consumer 처리 지연 진단
- `releaseStockByOrderUseCase` 의 DB lock contention: MySQL `SHOW PROCESSLIST` / `information_schema.innodb_trx`.
- inventory-service replica 증설.
- 멱등 dedup row insert 가 병목? → ADR-0029 의 `processed_event` 테이블 인덱스 확인.

### 3.5 ReservationExpiryFallbackTriggered (warn, increase > 0 for 5m)

**의미**: ADR-0032 핵심 invariant 위반. Outbox + cancellation consumer 흐름이 30분 안에 release 하지 못해 TTL fallback 이 동작.

**진단 순서**:
1. **위 1-4 알람 동반 발화 확인** — 모두 정상이면 별도 issue (예: order-service 가 cancel 호출 자체를 안 함, payment timeout 인데 cancelOrder 미호출 등).
2. fallback 으로 expire 된 reservation 의 orderId 추출.
   ```sql
   SELECT id, order_id, product_id, warehouse_id, expires_at, status
     FROM reservation
    WHERE status='CANCELLED'
      AND updated_at >= NOW() - INTERVAL 1 HOUR
    ORDER BY updated_at DESC LIMIT 50;
   ```
3. 각 orderId 에 대해:
   - `outbox_event` 에서 `order.order.cancelled` row 가 발행됐는지: `SELECT * FROM outbox_event WHERE event_type='order.order.cancelled' AND aggregate_id=?`.
     - row 없음 → order-service 가 cancelOrder 자체를 호출 안 함 (애플리케이션 버그).
     - row PENDING (>30m old) → publisher 정지 — 3.1 으로 핸드오버.
     - row PUBLISHED → inventory consumer 가 처리 못함 (3.4 로 핸드오버).
4. 본 알람은 사용자 경험 영향 큼 (재고가 30분 묶임). 발화 시 Inventory Squad 에 즉시 공유.

## 4. 일반 진단 명령어

### 4.1 Outbox 상태
```sql
-- pending row 수
SELECT COUNT(*) FROM outbox_event WHERE status='PENDING';

-- 가장 오래된 pending
SELECT id, event_type, aggregate_id, created_at,
       TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_seconds
  FROM outbox_event
 WHERE status='PENDING'
 ORDER BY created_at ASC LIMIT 10;

-- 최근 1시간 발행 분포
SELECT event_type, COUNT(*) total,
       SUM(status='PUBLISHED') published,
       SUM(status='PENDING')   pending
  FROM outbox_event
 WHERE created_at >= NOW() - INTERVAL 1 HOUR
 GROUP BY event_type;
```

### 4.2 Kafka consumer 상태
```bash
# inventory-service 그룹 lag
kubectl exec -n kafka kafka-0 -- \
  kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
    --group inventory-service --describe

# topic 상태
kubectl exec -n kafka kafka-0 -- \
  kafka-topics.sh --bootstrap-server localhost:9092 \
    --describe --topic order.order.cancelled
```

### 4.3 멱등 처리 상태
```sql
-- 최근 처리된 cancellation 이벤트
SELECT event_id, consumer_group, processed_at
  FROM processed_event
 WHERE consumer_group='inventory-service'
   AND processed_at >= NOW() - INTERVAL 30 MINUTE
 ORDER BY processed_at DESC LIMIT 50;
```

## 5. 복구 절차

### 5.1 PENDING row 수동 발행 (3.1.a 시)
```sql
-- 진단: 정말로 stuck 됐는지 확인
SELECT id, event_type, created_at, status
  FROM outbox_event WHERE status='PENDING' AND created_at < NOW() - INTERVAL 5 MINUTE;
```
1. order-service rollout restart 우선 시도 (`kubectl rollout restart deploy/order-service -n commerce`).
2. 그래도 안 풀리면, 임시로 `kafka-console-producer` 로 수동 발행 (운영 위험 — 멱등 보장이 그대로 동작하므로 중복 발행은 OK).
3. **수동 발행 후 row 상태를 PUBLISHED 로 update**: 자동 polling 이 다시 살아나면 중복 발행되지만 consumer 멱등이 흡수. 단, 운영 audit 의 일관성을 위해 update 권장.

### 5.2 Consumer dead-letter 처리
- ADR-0032 시점에는 별도 DLQ 미적용. error 시 spring-kafka 가 retry → 영구 실패 시 `seek` 으로 skip.
- 향후 ADR-0015 의 DLQ 도입 후 본 절차 갱신.

### 5.3 Reservation 수동 release
TTL fallback 도 동작 안 한다면 (DB lock 등):
```sql
UPDATE reservation
   SET status='CANCELLED', updated_at=NOW()
 WHERE order_id=? AND status='ACTIVE';
-- 그리고 inventory.available_qty 복원:
UPDATE inventory
   SET available_qty = available_qty + ?, reserved_qty = reserved_qty - ?
 WHERE product_id=? AND warehouse_id=?;
```
> **WARN**: SQL 직접 수정은 audit 위반. 가능하면 application 의 admin endpoint 사용.

## 6. 롤백 절차

본 PR (PR-4) 은 메트릭 / 알람 / 문서만 추가 — 코드 비즈니스 로직 영향 없음. revert 시:
- Grafana / Prometheus 가시성 손실
- 알람 손실 (직접 Kafka lag 등으로 트리아지)
- 기능 자체에는 영향 없음

PR-2 / PR-3 (Order Outbox + cancellation consumer) 의 rollback 은 `docs/plans/ADR-0032-implementation-plan.md` §9.2 참조.

## 7. 변경 이력

| 일자 | 변경 | 근거 |
|---|---|---|
| 2026-05-01 | 최초 작성 (PR-4) | ADR-0032 Phase 3 |
