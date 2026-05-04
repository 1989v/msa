---
parent: 6-kafka-internals
seq: 15
title: Rebalance 프로토콜 진화 — Eager → Cooperative → Static → KIP-848 (server-side)
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 07-consumer-rebalance.md
  - 08-offset-commit-poll.md
  - 14-kraft-tiered-storage.md
sources:
  - https://cwiki.apache.org/confluence/display/KAFKA/KIP-429%3A+Kafka+Consumer+Incremental+Rebalance+Protocol
  - https://cwiki.apache.org/confluence/display/KAFKA/KIP-345%3A+Introduce+static+membership+protocol+to+reduce+consumer+rebalances
  - https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol
  - https://kafka.apache.org/40/documentation.html#consumerconfigs
catalog-row: "§C Cooperative Rebalancing (★ → ✅), Static Membership (★ → ✅), Consumer Group Protocol 신규 (★ → ✅)"
---

# 15. Rebalance 프로토콜 진화 — Eager → Cooperative → Static → KIP-848 (server-side)

> 카탈로그 매핑: §99 §C — `Cooperative Rebalancing (KIP-429)`, `Static Membership (KIP-345)`, `Consumer Group Protocol 신규 (KIP-848, 4.x)` (★ → ✅).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B+

> §07 이 consumer group / coordinator / rebalance 트리거를 다뤘다면, 본 deep file 은 **rebalance 프로토콜 자체의 진화 — 왜 eager 가 stop-the-world 였고, 왜 cooperative 가 이를 해결했고, static membership 이 왜 보조 도구이며, 4.x 의 KIP-848 이 왜 client-side 책임을 server-side 로 옮기는지** — 를 한 묶음으로 다룬다. msa 의 search-consumer / analytics consumer / wishlist consumer 가 rebalance 폭주에 어떻게 노출되는지, 어떤 옵션 조합으로 ROI 를 낼 수 있는지가 핵심.

---

## 1. 한 줄 핵심

> **Rebalance 프로토콜은 "그룹 멤버십이 바뀔 때 모든 멤버가 STW (stop-the-world) 로 멈춰야 하는 eager" 에서, "각자 자기 일은 계속하면서 변경된 partition 만 점진 재할당하는 cooperative" 로, 다시 "transient 재시작은 아예 rebalance 를 안 일으키는 static membership" 으로, 마지막으로 "client 가 들고 있던 assignor 책임을 broker 의 group coordinator 가 가져가는 KIP-848 (server-side rebalance)" 로 진화 중.** 핵심은 매번 STW 윈도우를 줄이고 transient 운영 (재시작 / autoscale) 의 hidden cost 를 깎아내는 일이며, 이를 위해 client config (`partition.assignment.strategy`, `group.instance.id`, `session.timeout.ms`, `max.poll.interval.ms`) 와 broker 버전 / API 매트릭스를 같이 봐야 한다.

---

## 2. 등장 배경 — Eager 의 통증부터

### 2-1. Eager (legacy) 의 동작

```
[Group: search-indexer, members: A, B, C, partitions: 0~5]
초기 할당: A=[0,1], B=[2,3], C=[4,5]

새 멤버 D 합류 (rebalance 트리거)
  Phase 1: A/B/C 에게 SyncGroup → 자기 partition 모두 revoke
            ┌─────────────────────────────┐
            │  A: revoke 0,1              │
            │  B: revoke 2,3              │ ← 모든 멤버 동시 STW
            │  C: revoke 4,5              │
            └─────────────────────────────┘
  Phase 2: leader 가 새 assignment 계산: A=[0], B=[1,2], C=[3,4], D=[5]
  Phase 3: 각자 새 assignment 받아 다시 시작

STW 시간 = (revoke + assignment + state restore) — 보통 5~30s
```

**문제**:
- 4 명 중 1 명 (D) 만 새로 들어왔는데 **A/B/C 의 작업도 전부 멈춤**.
- D 가 graceful 하게 합류하기 위해 A/B/C 가 in-flight 메시지 commit + state 비우기 필요.
- partition 1 개도 안 바뀐 멤버까지 처리 흐름 단절.

### 2-2. autoscaling 시대의 통증 폭증

K8s + HPA (Horizontal Pod Autoscaler, 수평 파드 오토스케일러) 환경에선 consumer pod 가 자주 추가/삭제됨:

```
14:00:00 - search-indexer pod count = 2
14:00:30 - HPA: traffic ↑ → scale to 4 (rebalance 1회)
14:01:00 - traffic ↓ → scale to 2 (rebalance 1회)
14:01:30 - traffic ↑ → scale to 3 (rebalance 1회)

eager 라면: 30 초마다 5~30s STW → 가용 시간의 절반이 STW
cooperative 라면: 변경된 partition 만 revoke → STW ~1s
static membership 이라면: 같은 instance 재시작은 rebalance 안 일어남
```

→ HPA / k8s rolling update / 장애 재시작 빈도가 높아질수록 eager 는 답이 없다.

### 2-3. KIP-429 (Cooperative) 와 KIP-345 (Static) 의 핵심 통찰

- **KIP-429**: rebalance 가 "한 번에 모든 partition 을 재할당" 할 필요 없다. 변경되는 partition 만 revoke + reassign 하면 충분.
- **KIP-345**: 같은 instance 가 (재시작 등으로) 일시 사라졌다 돌아오면 그 사이에 누가 짧게 partition 을 받았다가 돌려주는 것보다 **그냥 기다리는 게** 빠르다.

### 2-4. KIP-848 의 다음 단계 — server-side

KIP-429 + KIP-345 까지 와도 여전히 client (consumer) 가 partition.assignment.strategy 를 알고, leader consumer 가 assignment 계산을 한다. 문제:

- consumer 마다 다른 strategy 를 설정하면 group 전체가 깨질 수 있음.
- 새 strategy 추가하려면 모든 consumer 를 rolling update 해야 함.
- consumer 가 죽었다 살아나는 동안 leader 부재 → coordinator 가 대신 못 함.

**KIP-848 (4.x)** 는 이 책임을 broker 의 group coordinator 로 옮긴다 — coordinator 가 assignment 계산 + state machine 보유. consumer 는 "내가 살아 있고 partition X 를 받았다" 만 보고. **client side 책임이 대폭 줄어든다.**

---

## 3. 동작 원리 — 4 가지 프로토콜 비교

### 3-1. Eager Protocol (legacy)

```
trigger event
   ▼
[ALL members]  send LeaveGroup (eager) 또는 join request 시 모든 partition revoke
   ▼
JoinGroup → SyncGroup
   ▼
leader consumer computes assignment using partition.assignment.strategy
   ▼
SyncGroup response → 각 멤버에게 새 assignment 전달
   ▼
모든 멤버가 새 partition 으로 fetch 시작
```

특징:
- `RangeAssignor`, `RoundRobinAssignor` 가 대표 strategy.
- 변경 영향 범위 = 전체 멤버.
- STW 시간 = revoke + JoinGroup wait + SyncGroup wait + state restore.

### 3-2. Cooperative Protocol (KIP-429)

```
trigger event (예: 새 멤버 D 합류)
   ▼
[ALL members]  send JoinGroup, 단 자기 partition 은 들고 있음
   ▼
leader (D 포함) computes new assignment using CooperativeStickyAssignor
   ▼
SyncGroup response: 각 멤버는 "유지 + revoke 할 partition" 정보 받음
   ▼
[partition 변경 없는 멤버]  계속 fetch → 영향 ❌
[partition revoke 있는 멤버] 해당 partition 만 commit + revoke
   ▼
2nd JoinGroup (revoked partition 들이 unowned 상태)
   ▼
2nd SyncGroup: 새 멤버에게 unowned partition 할당
```

특징:
- `CooperativeStickyAssignor` 가 default (3.x+).
- 변경 영향 범위 = 변경된 partition 의 owner 만.
- STW 시간 = 변경된 partition 의 revoke 시간만 (보통 sub-second).
- 2-phase rebalance 라 전체 시간은 약간 더 걸리나 STW 는 짧음.

### 3-3. Static Membership (KIP-345)

```
[member A starts]
  config: group.instance.id=search-consumer-0
  → JoinGroup with member.id 가 아니라 group.instance.id

[A 재시작 (5s 내)]
  → coordinator 는 group.instance.id 로 등록된 멤버를 session.timeout.ms 동안 보존
  → 같은 group.instance.id 로 재합류하면 partition 그대로 돌려받음
  → rebalance 발생 ❌

[A 가 session.timeout.ms 보다 오래 사라짐]
  → coordinator 가 멤버 제거 → rebalance 트리거
```

특징:
- `group.instance.id` 가 set 되면 static.
- consumer 의 transient 재시작 (k8s rolling update / liveness probe restart / GC pause) 시 rebalance 회피.
- session.timeout.ms 를 충분히 길게 (예: 30s) 잡아야 효과.
- cooperative 와 **결합 가능** — static + cooperative 가 표준.

### 3-4. KIP-848 — Next Generation Protocol (4.x)

```
[client 측 단순화]
  consumer 는 더 이상 assignor 를 들고 있지 않음
  consumer 는 group coordinator 에게 "내가 살아 있다, 현재 partition X" 를 heartbeat 로 보고
  coordinator 가 assignment 결정 + 변경된 부분만 push

[server 측]
  group coordinator 가 group state machine 보유
  partition.assignment.strategy 를 broker 측 config 로 설정
  consumer 가 추가/이탈 시 coordinator 가 incremental assignment 계산 + push
```

특징:
- consumer config 단순화 (assignor / session.timeout 등 일부 제거).
- coordinator 가 모든 consumer 의 state 를 알고 incremental 만 push.
- KRaft 와 자연스럽게 결합 — coordinator 의 state 자체가 `__consumer_offsets` (또는 후속 토픽) 에 저장.
- 4.0 GA, 클라이언트 라이브러리 점진 지원 (Java 4.0+, librdkafka 후속).

### 3-5. 비교표

| 차원 | Eager | Cooperative | Static | KIP-848 |
|---|---|---|---|---|
| 도입 시기 | ~2.0 | 2.4 (KIP-429) | 2.3 (KIP-345) | 4.0 (KIP-848) |
| STW 범위 | 전체 멤버 | 변경된 partition 만 | 재시작 = 0 | 변경된 partition 만 |
| transient 재시작 처리 | full rebalance | full but cooperative | rebalance 없음 | rebalance 없음 (member.id 유지) |
| client 책임 | 강함 (assignor 보유) | 강함 | 강함 | 약함 (coordinator) |
| HPA 환경 적합도 | 매우 나쁨 | 좋음 | 매우 좋음 | 매우 좋음 |
| 호환성 | 모든 버전 | 2.4+ | 2.3+ | 4.0+ |
| msa 권장 | ❌ | ⚪ 1차 | ⚪ 2차 (병행) | △ broker/client 4.0+ 시점에 검토 |

---

## 4. 사용 예제 — Cooperative + Static 의 표준 조합

### 4-1. 시나리오: msa search-consumer 적용

`search/consumer` 는 `product.item.created/updated` 토픽 (각 6 partition) 을 consume. 현재 (`search/consumer/.../KafkaConsumerConfig.kt`):

```kotlin
mapOf(
    ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
    ConsumerConfig.GROUP_ID_CONFIG to groupId,                      // "search-indexer"
    ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
    ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,
    // partition.assignment.strategy 미설정 → default
    // group.instance.id 미설정 → static membership ❌
    // session.timeout.ms 미설정 → default 45s (3.x)
)
```

### 4-2. Cooperative + Static 적용 예시

```kotlin
@Bean
fun productEventListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent> {
    val factory = ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent>()
    factory.setConsumerFactory(
        DefaultKafkaConsumerFactory(
            mapOf(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                ConsumerConfig.GROUP_ID_CONFIG to groupId,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
                ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,

                // ── Cooperative Rebalancing ──
                ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG to
                    "org.apache.kafka.clients.consumer.CooperativeStickyAssignor",

                // ── Static Membership ──
                // pod 별 고유 ID — Strimzi / k8s StatefulSet 이면 pod name 활용
                ConsumerConfig.GROUP_INSTANCE_ID_CONFIG to System.getenv("HOSTNAME"),

                // ── Session timeout — static membership 의 grace 윈도우 ──
                ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG to 30_000,
                ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG to 10_000,

                // ── Poll interval — 작업 시간 + 여유 ──
                ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG to 300_000,

                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
                JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.*",
                JsonDeserializer.VALUE_DEFAULT_TYPE to ProductIndexEvent::class.java.name
            )
        )
    )
    // (existing) DefaultErrorHandler ...
    return factory
}
```

### 4-3. group.instance.id 의 안정성 보장

K8s 환경에서 `HOSTNAME` 은 pod name. Deployment + replicaset 이면 매 재시작마다 random suffix 가 바뀐다 → static membership 의 의미 ❌. 해결:

| 옵션 | 안정성 | 비고 |
|---|---|---|
| `Deployment` + random pod name | ❌ | `HOSTNAME` 매번 다름 — static 무효 |
| `StatefulSet` + ordinal pod name | ✅ | `pod-0`, `pod-1` ... 안정 |
| Deployment + `group.instance.id=$(POD_NAME)` env, but pod name 안정 X | ❌ | 위와 동일 |
| Deployment + replica index env (예: `MY_INSTANCE_INDEX`) 직접 주입 | ⚪ | 가능하나 직접 관리 |

**권장**: consumer 를 StatefulSet 으로 운영. msa 의 Strimzi 관리 consumer 는 application 코드라 별도 deployment — StatefulSet 으로 전환 검토 필요.

### 4-4. 점진 전환 (eager → cooperative)

같은 그룹 안에 eager / cooperative 가 섞이면 동작 안 함. 표준 전환:

```
Phase 1: 모든 consumer 의 partition.assignment.strategy 를
         "CooperativeStickyAssignor, RangeAssignor" 로 설정 (둘 다 listed)
         → coordinator 는 RangeAssignor (eager) 선택 (모든 멤버가 가진 게 그것뿐)

Phase 2: rolling restart — 모든 consumer 가 새 config 받음
         → 여전히 RangeAssignor 동작

Phase 3: 모든 consumer 의 strategy 를 "CooperativeStickyAssignor" 만 남김
         rolling restart
         → 1차 rebalance 시 RangeAssignor → CooperativeStickyAssignor 전환
         → 이후 cooperative 동작
```

> 직접 한 번에 cooperative 로 바꾸면 group join 실패. **반드시 2-phase**.

---

## 5. 트레이드오프 / 함정

### 5-1. session.timeout.ms 와 max.poll.interval.ms 의 차이

이 둘은 자주 혼동되는데 의미가 다름:

| config | 의미 | 트리거 |
|---|---|---|
| `session.timeout.ms` (default 45s) | heartbeat 받지 못하면 죽었다고 판단 | heartbeat thread 가 따로 보내므로 message 처리와 무관 |
| `max.poll.interval.ms` (default 5min) | poll() 호출 사이 최대 간격 | 처리 시간이 길면 violation |
| `heartbeat.interval.ms` (default 3s) | heartbeat 보내는 주기 | session.timeout.ms 의 1/3 권장 |

```
[정상]
poll() → record 100 처리 (10초) → poll() → record 100 처리 → ...
heartbeat thread: 3초마다 별도로 heartbeat 전송 → coordinator 정상 인식

[max.poll.interval.ms violation]
poll() → record 100 처리 (6분) → ...
heartbeat 는 정상 가지만 poll 간격 > 5분 → coordinator 가 멤버 제거 → rebalance
이 멤버가 다음 poll 호출하면 "member id rejected" 에러

[session.timeout.ms violation]
consumer JVM 이 GC pause 30초 → heartbeat thread 도 멈춤
coordinator: 30초 > 45초 - 약간 가까움, 보통 통과
JVM 이 60초 hang → session.timeout 위반 → 멤버 제거
```

**튜닝 원칙**:
- 처리 시간이 느린 워크로드 → `max.poll.interval.ms` 넉넉히 (5분 → 10분).
- GC pause 가 우려 → `session.timeout.ms` 넉넉히 (45s → 60s).
- HPA / k8s rolling update 가 잦음 → static membership.

### 5-2. Cooperative 의 트레이드오프

| 장점 | 비용 |
|---|---|
| STW 윈도우 ↓ (sub-second) | 2-phase rebalance — 전체 시간은 약간 ↑ |
| partition 변경 안 된 멤버는 영향 ❌ | revoke / unowned 상태 추적 코드 복잡도 ↑ |
| autoscaling 친화 | 일부 외부 도구 (구버전 monitoring) 가 incremental 을 모르는 경우 |

### 5-3. Static Membership 의 함정

| 함정 | 결과 | 방어 |
|---|---|---|
| `group.instance.id` 충돌 (두 pod 이 같은 ID) | "fenced member" 에러 — 후자 join 거부 | StatefulSet ordinal 사용 |
| pod 가 진짜 죽었는데 session.timeout 길면 | 그 시간 동안 그 partition 처리 정지 | 적절한 session.timeout 선택 (30s 가 표준) |
| Deployment 라 pod name 매번 바뀜 | static 효과 ❌ — 사실상 dynamic | StatefulSet 으로 전환 |
| consumer 수 < partition 수 일 때 한 인스턴스 죽으면 | 살아있는 인스턴스 들이 partition 못 받음 (static = 기다림) | 경계 케이스 — 모니터링 |

### 5-4. KIP-848 도입 시 호환성 고려

- broker 4.0+ 필수.
- consumer client 라이브러리 4.0+ (Java) — librdkafka / confluent-kafka-python 등은 추후 지원.
- group 단위로 protocol 선택 (`group.protocol=consumer` for new, `classic` for old).
- 같은 group 내 mix ❌ — phase 별 전환 필요.

### 5-5. rebalance 폭주 방어 패턴

```
증상: rebalance 가 분 단위로 반복
원인 후보:
  1. session.timeout.ms 너무 짧음 → GC pause 마다 violation
  2. max.poll.interval.ms 너무 짧음 → 작업 시간 spike 마다 violation
  3. heartbeat thread 가 GC 와 같은 thread 에서 영향 받음 (옛 클라이언트)
  4. consumer 가 매번 다른 group.instance.id (Deployment)
  5. coordinator 가 unstable (broker 자체 문제)

방어:
  - consumer JMX metric: rebalance-rate-per-hour 모니터링 + 알람
  - log: "Member ... in group ... has failed" 추적
  - chaos test: 의도적 GC pause / 네트워크 지연으로 임계값 검증
  - cooperative + static + 적절한 timeout 의 조합으로 baseline 안정화
```

---

## 6. msa 적용 — search / analytics / wishlist consumer

### 6-1. 현재 상태 매트릭스

| 서비스 | group.id | partition 수 | replicas | 현재 strategy | static? |
|---|---|---|---|---|---|
| search:consumer | `search-indexer` | 6 (×2 토픽) | 1~2 | default (Range) | ❌ |
| analytics:app | `analytics-event-ingestion` | 12 | 1~2 | default | ❌ |
| analytics streams | `analytics-streams` | (internal) | 1~2 | streams 자체 | ❌ |
| wishlist | `wishlist-product` | 6 | 1 | default | ❌ |
| order | (서비스 본체) | 6 | 1~2 | default | ❌ |

→ 모두 eager / dynamic. HPA 가 도입되면 rebalance 폭주 위험.

### 6-2. 적용 우선순위

| 순위 | 서비스 | 이유 |
|---|---|---|
| 1 | search:consumer | replica 늘리는 시나리오 가장 흔함 (peak 트래픽) |
| 2 | analytics streams | Streams 의 task rebalance 가 무거움 — STW 영향 큼 |
| 3 | wishlist | replica 1 — static 효과 크지만 우선순위 낮음 |
| 4 | order | 정확성 critical — eager 잘못 건드리면 영향 큼, 마지막 |

### 6-3. analytics streams 의 특수성

Streams 는 **Streams 만의 task rebalance** 를 가진다 (consumer rebalance 위 layer). 표준 consumer 의 cooperative + static 이 Streams 에서도 동일 효과:

```kotlin
// KafkaStreamsConfig.kt
val props = mutableMapOf<String, Any>(
    StreamsConfig.APPLICATION_ID_CONFIG to "analytics-streams",
    StreamsConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
    // ...

    // Streams 도 internal consumer 가 이걸 사용
    "consumer.partition.assignment.strategy" to
        "org.apache.kafka.clients.consumer.CooperativeStickyAssignor",
    "consumer.group.instance.id" to System.getenv("HOSTNAME"),
    "consumer.session.timeout.ms" to 30_000,

    // Streams 의 task rebalance 단축
    StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG to 1,  // standby 가 있으면 failover 빠름
)
```

→ §17 Streams 와 cross-ref.

### 6-4. K8s 적용 — StatefulSet 전환

현재 search:consumer / analytics 는 Deployment 일 것. static membership 효과를 위해:

```yaml
# search-consumer Deployment → StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: search-consumer
spec:
  serviceName: search-consumer-headless
  replicas: 2
  template:
    spec:
      containers:
        - name: search-consumer
          env:
            - name: KAFKA_GROUP_INSTANCE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name  # search-consumer-0, search-consumer-1
```

→ Spring Boot 에서 `KAFKA_GROUP_INSTANCE_ID` env 를 ConsumerConfig 에 주입.

### 6-5. session.timeout 결정 매트릭스 (msa)

| 서비스 | GC profile | 평균 처리 시간 | session.timeout 권장 |
|---|---|---|---|
| search:consumer (간단한 ES 인덱싱) | G1, < 200ms pause | 50~100ms / record | 30s |
| analytics:app (event ingestion) | G1, < 500ms pause | < 50ms / record | 30s |
| analytics streams | G1 + state store | 변동 큼 | 45s |
| wishlist | G1 | < 100ms | 30s |
| order (트랜잭션 + DB) | G1 | 100~500ms | 45s (DB latency 마진) |

### 6-6. 도입 단계 plan

```
Phase 1 (1주): search-consumer 만 cooperative + static 적용 (StatefulSet 화)
  - dev 클러스터 배포 + chaos test (pod kill / restart)
  - rebalance metric 측정 (before/after)

Phase 2 (1주): analytics:app + analytics streams 적용
  - streams 의 standby replica = 1 추가

Phase 3 (1주): wishlist + order
  - order 는 정확성 critical → 추가 검증 (saga / idempotency 영향 없음 확인)

Phase 4: HPA 도입 검토
  - cooperative + static 도입 후엔 HPA 가 안전
  - search:consumer 부터 HPA enable (target CPU 60%)
```

---

## 7. ADR 후보

> **ADR-XXXX: Consumer rebalance 표준 — Cooperative + Static Membership 도입**
>
> **Context**: msa 의 모든 Kafka consumer 가 default (eager + dynamic) 상태. HPA / k8s rolling update / 장애 재시작 시 rebalance 가 STW (5~30s) 로 발생해 in-flight 메시지 처리 지연 + 중복 처리 위험. KIP-429 (cooperative) 와 KIP-345 (static) 는 Kafka 2.4+ 에서 stable 이고 Strimzi 의 broker 도 지원.
>
> **Decision**:
> 1. **Cooperative Rebalancing 도입**:
>    - `partition.assignment.strategy = CooperativeStickyAssignor` 를 모든 consumer 에 적용.
>    - 전환은 2-phase: (a) `[CooperativeStickyAssignor, RangeAssignor]` listed → rolling restart, (b) `[CooperativeStickyAssignor]` only → rolling restart.
> 2. **Static Membership 도입**:
>    - `group.instance.id = <pod name>` 을 환경변수로 주입.
>    - consumer pod 를 Deployment → StatefulSet 으로 전환 (pod name 안정성).
>    - `session.timeout.ms = 30s` (search/analytics/wishlist), `45s` (order/streams).
> 3. **도입 우선순위**: search:consumer → analytics:app + streams → wishlist → order.
> 4. **HPA 게이트**: cooperative + static 도입 완료된 consumer 에만 HPA enable.
>
> **Consequences**:
> - (+) STW 윈도우 sub-second 로 단축 — 메시지 처리 latency 안정.
> - (+) k8s rolling update / liveness probe restart 시 rebalance 회피 — operational toil ↓.
> - (+) HPA 도입의 전제 조건 충족.
> - (-) StatefulSet 전환에 따른 PV (PersistentVolume, 영구 볼륨) 검토 (대부분 stateless 라 emptyDir OK).
> - (-) 2-phase 전환의 운영 절차 + 검증 필요.
>
> **Alternatives 검토**:
> - eager 유지 — HPA 도입 시 rebalance 폭주 위험. 채택 ❌.
> - cooperative 만 / static 없이 — transient 재시작 시 여전히 rebalance. 채택 ❌.
> - KIP-848 (server-side) 즉시 도입 — 4.0 broker + Java 4.0 client 매트릭스 미충족. 채택 ❌ (1년 후 재검토).
>
> **Followup ADR**: ADR-YYYY KIP-848 도입 — 모든 component 4.0+ 가 됐을 때.

---

## 8. 면접 한 줄 답변

### Q. eager rebalance 와 cooperative rebalance 의 차이는?

> "eager 는 멤버십이 바뀌면 모든 멤버가 자기 partition 을 한 번에 revoke 하고 재할당받는 stop-the-world 방식이라 5~30 초 STW 가 발생합니다. cooperative (KIP-429) 는 변경된 partition 만 revoke + reassign 해서 partition 변경 없는 멤버는 영향이 없고 STW 가 sub-second 로 줄어듭니다. 단 2-phase rebalance 라 전체 시간은 약간 증가합니다."

### Q. Static Membership 이 푸는 문제는?

> "k8s rolling update 나 liveness probe 재시작처럼 pod 이 짧게 사라졌다 돌아오는 transient 케이스에서, dynamic 이라면 그 사이에 누가 partition 을 짧게 받았다가 또 돌려주는 full rebalance 가 일어납니다. static 은 `group.instance.id` 가 같으면 session.timeout.ms 동안 partition 을 유지해 줘서 재시작이 끝나면 그대로 돌려받습니다 — rebalance 자체가 발생하지 않습니다."

### Q. session.timeout.ms 와 max.poll.interval.ms 의 차이는?

> "session.timeout.ms 는 heartbeat 가 끊기면 죽었다고 판단하는 시간 (default 45s), max.poll.interval.ms 는 poll() 호출 사이 최대 간격 (default 5min) 입니다. heartbeat 는 별도 thread 가 보내므로 처리 시간과 무관하게 살아 있다고 보고할 수 있지만, poll 호출 자체가 안 되면 max.poll.interval 위반으로 멤버 제거됩니다. 처리 시간이 길면 max.poll.interval 을, GC pause 가 우려되면 session.timeout 을 늘립니다."

### Q. eager → cooperative 로 전환할 때 주의할 점은?

> "한 group 안에 eager 와 cooperative 가 섞이면 group join 자체가 실패합니다. 표준 전환은 2-phase: 1차로 모든 consumer 의 strategy 를 `[CooperativeStickyAssignor, RangeAssignor]` listed 로 두고 rolling restart, 2차로 `[CooperativeStickyAssignor]` only 로 좁히고 rolling restart. coordinator 가 모든 멤버가 가진 strategy 의 교집합에서 선택하기 때문입니다."

### Q. KIP-848 (next-gen rebalance) 의 핵심 변화는?

> "client 가 들고 있던 partition.assignment.strategy 와 leader consumer 의 assignment 계산 책임이 broker 의 group coordinator 로 옮겨갑니다. consumer 는 'I'm alive, I have partition X' 만 heartbeat 로 보고, coordinator 가 incremental assignment 를 계산해서 push. consumer config 가 단순해지고, strategy 변경이 client rolling 없이 가능해집니다. 4.0 broker + Java 4.0 client 부터 사용 가능합니다."

### Q. msa 의 search-consumer 가 HPA 적용 가능한가?

> "현재는 default (eager + dynamic) 라 HPA scale 시마다 5~30s STW + 메시지 처리 지연이 발생합니다. cooperative + static + StatefulSet 전환을 선행한 뒤에 HPA 를 켜는 게 맞습니다. cooperative 만으로도 sub-second STW 라 HPA 가능하지만, 빈번한 scale 시 static 이 추가로 도움이 됩니다."

### Q. group.instance.id 의 안정적인 값을 어떻게 보장하나요?

> "Deployment 의 pod name 은 매번 random suffix 가 바뀌므로 static 효과가 없습니다. StatefulSet 으로 전환하면 pod-0, pod-1 같은 ordinal name 이 안정적으로 유지됩니다. K8s downward API 의 metadata.name 을 환경 변수로 주입해서 ConsumerConfig 에 넣는 게 표준 패턴입니다."

### Q. cooperative 의 단점은?

> "2-phase rebalance 라 전체 rebalance 완료 시간은 eager 보다 약간 길 수 있고, revoke / unowned partition 의 상태 추적 코드가 복잡해집니다. 일부 구버전 모니터링 도구가 incremental rebalance 를 인식 못 해서 metric 이 잘못 표시되는 경우도 있었습니다 (대부분 해결됨). 하지만 STW 영향이 워낙 줄어들어서 단점은 무시 가능."

---

## 9. 흔한 오해 정정

> **"cooperative rebalance 가 항상 빠르다"**

- ⚠ STW 윈도우는 짧지만 전체 rebalance 시간은 2-phase 라 eager 보다 길 수 있음. 핵심은 **STW** 이지 wall-clock 이 아님.

> **"static membership 이면 rebalance 가 절대 안 일어난다"**

- ❌ 같은 instance 가 session.timeout 안에 돌아왔을 때만. 진짜 죽거나 새 멤버 합류 / partition 수 변경 시엔 발생.

> **"group.instance.id 만 박으면 static 효과 끝"**

- ⚠ ID 가 매번 바뀌면 (Deployment 의 random pod name) 사실상 dynamic. 안정적 ID 보장 (StatefulSet) 이 핵심.

> **"session.timeout.ms 를 길게 하면 항상 안전하다"**

- ⚠ 진짜 죽었을 때 그 시간만큼 partition 처리 정지. 너무 길면 가용성 ↓. 30~45s 가 표준.

> **"KIP-848 도입하면 cooperative / static 이 필요 없다"**

- ⚠ KIP-848 자체가 cooperative + 더 단순화된 protocol. static 의 개념 (안정적 멤버 ID) 은 유지. 그러나 client config 가 단순해짐.

> **"max.poll.interval.ms 를 늘리면 rebalance 가 줄어든다"**

- ⚠ poll 간격 위반은 줄지만, 멤버가 정말 hang 됐을 때 감지가 늦어짐. 처리 시간을 정확히 모델링하고 + 1.5~2x 마진이 적정.

> **"eager 와 cooperative 를 한 그룹에 섞어도 된다"**

- ❌ join 실패. 반드시 2-phase 로 전환.

> **"Streams 는 별도 rebalance 를 가져서 cooperative 와 무관하다"**

- ⚠ Streams 의 internal consumer 가 동일한 protocol 사용. consumer config 의 cooperative + static 이 Streams 의 task rebalance 도 단축.

---

## 10. 회독 체크리스트

> §15 회독 체크리스트:
> - [ ] eager / cooperative / static / KIP-848 의 4 가지 프로토콜 차이
> - [ ] eager 의 STW 발생 메커니즘 (모든 멤버 동시 revoke)
> - [ ] cooperative 의 2-phase rebalance + 변경 partition 만 revoke
> - [ ] static membership 의 transient 재시작 회피 + group.instance.id 의 안정성 요구
> - [ ] session.timeout.ms / heartbeat.interval.ms / max.poll.interval.ms 의 차이
> - [ ] eager → cooperative 2-phase 전환 절차 (listed → only)
> - [ ] KIP-848 의 server-side 책임 이동 — broker 4.0+ + client 4.0+ 매트릭스
> - [ ] msa search/analytics/wishlist consumer 의 적용 우선순위
> - [ ] StatefulSet 전환 + downward API 로 group.instance.id 주입
> - [ ] HPA 적용 전제 조건 = cooperative + static
> - [ ] rebalance 폭주의 5 가지 원인 + 방어
> - [ ] Streams 의 internal consumer 도 같은 protocol 사용

---

## 11. 운영 시나리오 — 흔히 만나는 5 가지 케이스 + 진단

### 11-1. 케이스 A: HPA 가 scale-up 했는데 5 분간 처리 정지

```
[증상]
14:00 traffic 2x → HPA scale 2 → 4
14:00 ~ 14:00:30 rebalance 진행
14:00:30 ~ 14:05:00 처리량 0 또는 매우 낮음
14:05 정상 처리 복귀

[진단]
- consumer log 에 "Revoking partitions" + "Adding newly assigned partitions" 다수
- `kafka-consumer-groups.sh --describe` 로 lag 폭증 관찰
- JMX: rebalance-rate-per-hour 가 평소보다 ↑

[원인]
- eager rebalance — 모든 멤버가 동시 STW
- max.poll.interval.ms violation 가능성도 (rebalance 중 처리 hang)

[처방]
- cooperative 도입 (1차)
- max.poll.interval.ms 증가 (2차, 처리 시간 모델링 후)
- partition 수 ↑ (rebalance 단위 작아지면 영향 범위 ↓)
```

### 11-2. 케이스 B: 1 분마다 rebalance 가 반복

```
[증상]
consumer log: "Member ... in group ... has failed" 가 1 분마다 반복
group lag 가 oscillate (왔다갔다)

[진단]
- session.timeout.ms 와 heartbeat.interval.ms 비교
- consumer JVM 의 GC log
- network 지연 metric

[원인 후보]
1. heartbeat.interval.ms = session.timeout.ms 와 너무 가까움 (보통 1/3 권장)
2. JVM GC pause > session.timeout.ms (heartbeat thread 도 stop)
3. network jitter — broker 와 consumer 사이 packet loss
4. Deployment 의 pod liveness probe 가 자주 fail → 재시작 → 매번 dynamic rebalance

[처방]
- session.timeout.ms = 30s, heartbeat.interval.ms = 10s (1/3)
- GC pause < 100ms 보장 (G1 / ZGC)
- static membership 도입 (transient 재시작 흡수)
```

### 11-3. 케이스 C: 한 instance 가 죽었는데 다른 instance 들이 partition 못 받음

```
[증상]
3 instance 중 1 이 죽음 → 30 초 후에도 그 instance 의 partition 처리 ❌

[진단]
- group 의 멤버 list 조회: 죽은 instance 가 still member 로 보임
- session.timeout.ms 미경과

[원인]
- static membership 의 grace 윈도우 — 의도된 동작
- "정말 죽은 것" 과 "transient 재시작" 구분이 안 됨

[처방 옵션]
1. 의도된 동작 — session.timeout 을 더 짧게 (단, transient 재시작 시 rebalance 재발)
2. 정상 종료 시엔 LeaveGroup 명시 호출 (graceful shutdown)
3. dynamic 으로 회귀 (HPA / rolling update 시 rebalance 폭주 감수)
```

### 11-4. 케이스 D: cooperative 적용 후 throughput 이 오히려 떨어짐

```
[증상]
cooperative 적용 후 평소 throughput 이 5~10% 감소

[원인]
- 2-phase rebalance 의 추가 RPC
- assignor 가 sticky 라 partition 분포가 일시 균등하지 않을 수 있음

[처방]
- 일반적이지 않으면 metric 으로 정확히 측정 (consumer-fetch-rate)
- partition 수 점검 — sticky 가 제대로 작동하려면 partition 수 ≥ instance 수
- cooperative + static 동시 적용으로 rebalance 자체 빈도 ↓
```

### 11-5. 케이스 E: 한 group 의 멤버가 특정 partition 만 계속 받음

```
[증상]
group 의 instance A 가 항상 partition 0,1 만 받음.
B 가 항상 2,3. instance C 가 들어와도 균등 분배 ❌.

[원인]
- partition.assignment.strategy = StickyAssignor 또는 CooperativeStickyAssignor
- sticky 는 의도적으로 같은 partition 을 같은 instance 에 유지

[처방]
- 의도된 동작 — sticky 의 핵심
- 균등 분배가 정말 필요하면 RoundRobinAssignor 사용 (단 변경 시 STW)
- partition 수와 instance 수 비율 점검
```

---

## 12. 코드 분석 — msa search-consumer 의 현재와 개선 후 비교

### 12-1. 현재 (`search/consumer/.../KafkaConsumerConfig.kt:25-54`)

```kotlin
factory.setConsumerFactory(
    DefaultKafkaConsumerFactory(
        mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to groupId,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,
            // partition.assignment.strategy 미설정
            // group.instance.id 미설정
            // session.timeout.ms 미설정 (default 45s, 3.x)
            // heartbeat.interval.ms 미설정 (default 3s)
            // max.poll.interval.ms 미설정 (default 5min)
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
            JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.*",
            JsonDeserializer.VALUE_DEFAULT_TYPE to ProductIndexEvent::class.java.name
        )
    )
)
```

분석:
- eager rebalance (RangeAssignor default).
- dynamic membership.
- timeout 들 default — GC pause 60s+ 면 위험, 정상 처리 100ms 면 충분 여유.
- max.poll.records=50 + 처리 50ms/record = 2.5s — max.poll.interval (5min) 안에 충분.

### 12-2. 개선 후 (Phase 1 — cooperative + static + StatefulSet)

```kotlin
factory.setConsumerFactory(
    DefaultKafkaConsumerFactory(
        mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to groupId,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,

            // ── Phase 1: cooperative (transition phase = listed) ──
            ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG to listOf(
                "org.apache.kafka.clients.consumer.CooperativeStickyAssignor",
                "org.apache.kafka.clients.consumer.RangeAssignor"
            ),

            // ── Static Membership (StatefulSet pod name 주입) ──
            ConsumerConfig.GROUP_INSTANCE_ID_CONFIG to System.getenv("HOSTNAME"),

            // ── 명시적 timeout — GC pause 마진 + hearbeat 1/3 권장 ──
            ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG to 30_000,
            ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG to 10_000,
            ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG to 300_000,

            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
            JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.*",
            JsonDeserializer.VALUE_DEFAULT_TYPE to ProductIndexEvent::class.java.name
        )
    )
)
```

K8s 측 (StatefulSet 변경 + downward API):

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: search-consumer
spec:
  serviceName: search-consumer-headless
  replicas: 2
  template:
    spec:
      containers:
        - name: search-consumer
          env:
            - name: HOSTNAME      # static membership 의 group.instance.id
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
```

### 12-3. Phase 2 — cooperative only

Phase 1 rolling 후, 모든 instance 가 새 config 받았음을 확인하고:

```kotlin
ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG to listOf(
    "org.apache.kafka.clients.consumer.CooperativeStickyAssignor"
),
```

→ 다시 rolling restart. 이 시점부터 cooperative 동작.

### 12-4. 검증 절차

```bash
# 1. Strategy 확인
kafka-consumer-groups.sh --bootstrap-server kafka:29092 \
    --describe --group search-indexer --members --verbose

# 2. group.instance.id 가 보이는지 확인 (static membership)
# 출력에서 GROUP-INSTANCE-ID 컬럼이 채워져 있어야 함

# 3. chaos test
kubectl delete pod search-consumer-0  # transient 재시작
# session.timeout (30s) 안에 새 pod 가 올라오는지 확인
# rebalance log 가 없어야 함 (static 효과)

# 4. metric
# kafka.consumer:type=consumer-coordinator-metrics,client-id=*
#   - rebalance-rate-per-hour
#   - rebalance-total
```

---

## 13. 연결 학습

- §07 consumer rebalance 기본 — 본 문서는 그 위에 프로토콜 진화 추가
- §08 offset commit / poll loop — `max.poll.interval.ms` 와 처리 시간 분리
- §10 idempotency / DLQ — rebalance 중 in-flight 메시지의 중복 처리 방어
- §14 KRaft + tiered storage — controller failover 후 group coordinator 재선출
- §16 (다음) log compaction + tombstone — `__consumer_offsets` 가 compacted 토픽
- §17 (다음) Streams API — task rebalance 와 standby replica
