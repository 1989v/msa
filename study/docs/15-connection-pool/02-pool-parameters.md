---
parent: 15-connection-pool
seq: 02
title: HikariCP 핵심 파라미터 8가지 — 의미, 상호작용, 흔한 오설정
type: deep
created: 2026-05-01
---

# 02. 핵심 파라미터 8가지

HikariCP 의 파라미터는 약 20개지만, 운영 튜닝의 90% 는 다음 8개로 끝난다. 각 파라미터를 *어떤 책임* 에 속하는지로 분류해서 외우면 까먹지 않는다.

---

## 분류

| 책임 | 파라미터 |
|---|---|
| 사이즈 | `maximumPoolSize`, `minimumIdle` |
| 수명 | `maxLifetime`, `idleTimeout`, `keepaliveTime` |
| 검진 | `validationTimeout`, `connectionTestQuery` |
| 회수 | `connectionTimeout` |
| 누수 추적 | `leakDetectionThreshold` |

---

## 1. `maximumPoolSize` (default 10)

풀이 생성할 수 있는 connection 의 *최대* 개수. 이 값에 도달한 후 추가 borrow 요청은 큐에서 대기한다.

- Spring Boot property: `spring.datasource.hikari.maximum-pool-size`
- 사이즈 산정은 [07-pool-sizing.md](07-pool-sizing.md) 참조
- **함정**: thread pool 의 thread 수와 같지 않다. DB 가 한 connection 당 하나의 backend process/thread 를 쓰므로 DB CPU 코어 수가 상한선의 hard limit
- **함정 2**: HPA (Horizontal Pod Autoscaler, 수평 파드 오토스케일러) 로 인스턴스가 N 배가 되면 DB 입장에서는 N × maxPoolSize. `(인스턴스 수 × 풀) > DB max_connections` 면 일부 인스턴스가 connection 을 못 받는다

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
```

## 2. `minimumIdle` (default = maximumPoolSize)

풀이 *유지하려고 노력* 하는 idle connection 의 최소 개수. HikariCP 는 historically 이 값을 maxPoolSize 와 같게 두는 "fixed-size pool" 을 권장한다.

- 이유: spike 시점에 새 connection 을 *생성* 하느라 latency 가 솟구치는 것보다, 미리 만들어 두는 비용이 훨씬 저렴
- minIdle < maxPool 이면 idleTimeout 이 의미를 갖고, idle 한 connection 이 점진적으로 폐기된다
- **권장**: prod 환경은 minIdle = maxPool, dev/test 는 minIdle = 1 (리소스 절약)

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 20      # fixed-size
```

## 3. `maxLifetime` (default 1,800,000 ms = 30 min)

connection 이 풀에 머물 수 있는 *최대 수명*. 이 시간을 넘기면 idle 상태일 때 또는 사용 후 반납 시점에 폐기되고 새 connection 으로 교체된다.

- **목적**: DB-side 의 강제 종료 (MySQL `wait_timeout`, Aurora 의 connection muxing) 보다 *먼저* 풀 측에서 자발적으로 끊어 stale connection 을 만들지 않기 위함
- **룰**: `maxLifetime < DB wait_timeout − 30s`
  - MySQL 기본 `wait_timeout = 28800s` (8h) → maxLifetime 28000s 이하
  - 단, 운영에서는 보수적으로 1800s (30min) 권장 — 네트워크 미들웨어 (LB, NAT) 가 idle connection 을 silent drop 하는 경우 대비
- AWS RDS Proxy / ProxySQL 사용 시 proxy 의 timeout 도 함께 고려

```yaml
spring:
  datasource:
    hikari:
      max-lifetime: 1800000   # 30 min
```

## 4. `idleTimeout` (default 600,000 ms = 10 min)

idle 상태인 connection 을 폐기하기까지의 시간. *minIdle 이하* 로는 줄이지 않는다.

- minIdle = maxPool 이면 사실상 비활성 (절대 줄어들 일 없음)
- 짧게 두면 트래픽 sparse 한 야간에 idle connection 이 줄어들어 DB 메모리 절약
- **함정**: idleTimeout < maxLifetime 이어야 의미 있음. idleTimeout 이 maxLifetime 보다 길면 maxLifetime 이 먼저 발동

```yaml
spring:
  datasource:
    hikari:
      idle-timeout: 600000   # 10 min
```

## 5. `keepaliveTime` (default 0 = 비활성, Hikari 4+ 추가)

idle connection 을 *주기적으로* 살아있는지 ping 하는 간격. 0 이면 비활성.

- 추가된 배경: cloud / k8s 환경에서 NAT / LB 가 idle TCP 를 5분 후 silent drop 하는 사례가 늘어남
- ping 방식: `Connection.isValid(timeout)` 또는 connectionTestQuery 사용
- 권장: `keepaliveTime = 30000` (30s), `maxLifetime` 보다 짧게

```yaml
spring:
  datasource:
    hikari:
      keepalive-time: 30000
```

## 6. `connectionTimeout` (default 30,000 ms = 30s)

borrow() 호출이 대기할 수 있는 최대 시간. 이 시간을 넘기면 `SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out` 발생.

- **권장**: 3000~10000ms — fail-fast 가 운영상 유리. 30s 는 너무 길어서 사용자 인지 latency 를 폭발시킴
- 외부에서 timeout 을 거는 환경 (gateway, Feign) 의 timeout 보다 *짧아야* 한다
- gateway timeout = 5s 인데 hikari connectionTimeout = 30s 면, 클라이언트는 이미 5s 에 종료됐는데 thread 는 25s 더 점유

```yaml
spring:
  datasource:
    hikari:
      connection-timeout: 3000
```

## 7. `validationTimeout` (default 5000ms)

connection 검증 시 (`isValid()` 호출) 의 최대 대기 시간. connectionTimeout 보다 짧아야 함.

- borrow 직전에 수행되는 빠른 검증
- 너무 길면 DB 가 hang 됐을 때 borrow 가 그만큼 오래 막힘

## 8. `leakDetectionThreshold` (default 0 = 비활성)

connection 이 borrow 된 후 return 까지 걸린 시간이 이 임계값을 넘으면 stack trace 와 함께 WARN 로그를 출력한다.

- **운영 환경에서는 반드시 활성** — 미반납 connection 추적의 유일한 도구
- 권장: 5000~10000ms (5~10s)
- 너무 짧으면 정상 long query 도 false positive 로 잡힘
- 비용은 거의 없음 (StackTrace 한 번 capture)

```yaml
spring:
  datasource:
    hikari:
      leak-detection-threshold: 10000
```

---

## 파라미터 상호작용

이게 면접의 핵심이다. 8개 파라미터 사이의 *순서 관계* 와 *상한선*.

```
keepaliveTime  <  idleTimeout  <  maxLifetime  <  DB wait_timeout - 30s
       │              │                │
       │              │                └── connection 강제 교체 주기
       │              └── idle 청소 주기
       └── idle 헬스체크 주기

validationTimeout < connectionTimeout < (외부 caller timeout)
       │                  │
       │                  └── borrow 대기 상한
       └── 검증 쿼리 상한
```

- minIdle = maxPool 일 때 idleTimeout 은 무의미
- maxLifetime > DB wait_timeout 이면 stale connection 보장 → 100% 사고 발생
- connectionTimeout > caller timeout 이면 thread leak 위험

---

## 흔한 오설정 5가지

### 1. maxLifetime 미설정 + DB 측 timeout 변경

DBA 가 wait_timeout 을 28800 → 600 으로 바꿨는데 풀 설정 변경 안 함 → maxLifetime 1800000 (30min) 이 wait_timeout (10min) 보다 길어 stale.

### 2. connectionTimeout 30s 그대로 + gateway timeout 5s

P99 latency 가 5s 에 잘려 보이는데 thread dump 를 뜨면 25s 더 풀 borrow 에 매여있음. requestcount 그래프와 thread count 그래프가 *어긋남*.

### 3. minIdle = 0 + 새벽 idleTimeout 으로 비워짐

아침 9시 첫 트래픽 때 0 → maxPool 까지 *순차적* 으로 connection 을 만드느라 first-RPS 가 SLA 위반.

### 4. leakDetectionThreshold 0 (default)

운영 사고 시점에 *어떤* 코드 경로가 connection 을 안 반납했는지 알 수가 없다. 이 값을 켜는 데 비용은 없다 — 묻지도 따지지도 말고 켠다.

### 5. keepaliveTime 0 + LB 5분 idle drop

야간에 idle 상태 connection 이 LB 에 의해 silent drop 됨 → 다음 borrow 시 `Communications link failure` 첫 트래픽 fail. keepaliveTime 30s 면 90% 회피.

---

## 모든 파라미터 한 번에 보기 (실무 권장값)

```yaml
spring:
  datasource:
    hikari:
      # 사이즈
      maximum-pool-size: 20
      minimum-idle: 20
      # 수명
      max-lifetime: 1800000        # 30 min
      idle-timeout: 600000         # 10 min (minIdle=max 이면 사실상 무의미)
      keepalive-time: 30000        # 30 s
      # 검진
      validation-timeout: 3000
      # 회수
      connection-timeout: 3000     # gateway timeout 보다 짧게
      # 누수 추적
      leak-detection-threshold: 10000
      # 풀 식별 (메트릭/로그에서 구분)
      pool-name: order-master-pool
```

---

## 핵심 포인트

- 8개 파라미터는 사이즈 / 수명 / 검진 / 회수 / 누수 추적 5대 책임에 배정
- maxLifetime < DB wait_timeout − 30s 가 stale 회피 1번 룰
- minIdle = maxPool 의 fixed-size 가 spike 대응에 유리
- connectionTimeout < caller timeout 이어야 thread leak 방지
- leakDetectionThreshold 는 prod 에서 무조건 ON

## 다음 학습

- [03-spring-boot-defaults.md](03-spring-boot-defaults.md) — Spring Boot 의 default 값과 다른 풀 라이브러리 비교
- [07-pool-sizing.md](07-pool-sizing.md) — maximumPoolSize 산정 공식
- [08-pool-failure-patterns.md](08-pool-failure-patterns.md) — 위 파라미터 오설정이 만드는 4가지 장애
