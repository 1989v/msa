---
parent: 15-connection-pool
seq: 01
title: 풀이 필요한 이유 — TCP / TLS / DB 인증 비용 분해
type: deep
created: 2026-05-01
---

# 01. 풀이 필요한 이유

## 왜 매번 새로 만들면 안 되는가

"connection 하나 만드는 데 얼마나 걸릴까?" 라는 질문은 운영 면접의 첫 단추다. 단순히 "느려서" 가 아니라, 어떤 단계가 latency 에 어떻게 기여하는지 분해할 수 있어야 한다.

### TCP 3-way handshake

DB 가 같은 데이터센터(LAN, RTT < 1ms) 에 있어도 3-way handshake 는 1 RTT 가 걸린다. AWS 동일 AZ (Availability Zone, 가용 영역) 기준 보통 0.3~0.7ms. cross-AZ 는 1~2ms. cross-region 은 30~100ms 까지 늘어난다.

```
Client → SYN              → Server     ┐
Client ← SYN-ACK          ← Server     │ 1 RTT
Client → ACK              → Server     ┘
```

`netstat -s | grep -i passive` 의 `passive open` 카운터가 connection 신규 생성 횟수와 같다. 풀이 잘 동작하면 이 값은 거의 증가하지 않아야 한다.

### TLS handshake (RDS, ElastiCache 가 TLS 강제일 때)

- **TLS 1.2**: 2 RTT (ClientHello → ServerHello → KeyExchange → Finished)
- **TLS 1.3**: 1 RTT (Hello + KeyShare 가 동시), 0-RTT 가능 (재방문)
- 인증서 chain 검증, OCSP stapling 등 CPU 비용 추가
- AWS RDS Proxy 처럼 TLS termination 이 LB 측에 있으면 짧아질 수 있음

DB connection 1 회 생성에 LAN + TLS 1.2 = 약 2~5ms 가 깔린다. 100 RPS 에서 매 요청마다 새로 만들면 그 자체로 200~500ms/sec 의 CPU 가 TLS handshake 에 소모된다.

### MySQL 인증/세션 setup

MySQL 의 connection 생성은 단순히 TCP/TLS 만이 아니다.

```
1. TCP/TLS handshake
2. Server → Client: Handshake Packet (server version, salt, capabilities)
3. Client → Server: Handshake Response (auth plugin, scrambled password)
4. (caching_sha2_password 의 경우) full RSA exchange or fast-path
5. Server → Client: OK Packet
6. (선택) SET autocommit, SET names utf8mb4, SET time_zone, ...
```

caching_sha2_password 의 fast-path 가 캐시 miss 일 경우 RSA-2048 1 회 추가 → CPU 0.5~2ms 부담. 컨테이너 재시작 직후 모든 인스턴스가 동시에 cache miss 를 일으키면 DB 측 CPU 가 spike 친다.

또 Spring Boot + Hikari 는 connection 획득 직후 다음을 기본 수행한다.

- `Connection.getAutoCommit()` (Hikari 내부 캐싱용)
- `Connection.getTransactionIsolation()`
- (HikariCP `connection-init-sql` 이 있으면) SET 문 실행
- (validationQuery / `isValid()` 가 활성화면) 검증 쿼리

이 setup cost 는 connection 한 번에 1~3ms. 풀이 없으면 매 쿼리마다 이 비용이 쿼리 자체보다 더 큰 경우가 흔하다.

### 결과: latency budget 위협

ADR-0025 latency budget (`docs/adr/ADR-0025-latency-budget.md`) 기준 Tier 1 P99 SLA 가 100~200ms 라면, connection 생성 5~10ms 는 5~10% 를 좀먹는 것과 같다. 게다가 P99 는 분산이 큰 영역이라 TLS handshake 의 jitter 가 그대로 SLO 위반으로 직결된다.

---

## 풀의 본질: "재사용 가능한 stateful object" 관리

connection 은 다음 특성을 갖는 자원이다.

1. **생성 비용 ≫ 사용 비용** (수 ms vs 0.1ms 쿼리)
2. **stateful** — autocommit / isolation / 세션 변수 / temp table
3. **상한 있음** — DB 측 max_connections, 메모리, 파일 디스크립터
4. **고장날 수 있음** — DB failover, 네트워크 단절, idle 후 RST

따라서 풀은 단순한 LRU 캐시가 아니라:

- **창고** — 미리 생성해 둔 N 개 connection
- **회수기** — borrow / return 인터페이스 (try-with-resources / AutoCloseable)
- **검진기** — borrow 시점 / 주기적으로 살아있는지 확인 (validate)
- **퇴역기** — 너무 오래 산 connection 을 강제 폐기 (maxLifetime)
- **누수 추적기** — return 이 누락된 connection 검출 (leakDetectionThreshold)

이 5가지 책임을 다 하는 라이브러리가 HikariCP, Tomcat JDBC, DBCP2 등이다.

---

## connection-per-request 안티패턴

```kotlin
// 절대 이렇게 짜지 말 것 (실제로 본 적 있음)
@RestController
class BadController {

    @GetMapping("/users/{id}")
    fun getUser(@PathVariable id: Long): User {
        val conn = DriverManager.getConnection(URL, USER, PASS) // 매 요청 신규
        try {
            val ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?")
            ps.setLong(1, id)
            val rs = ps.executeQuery()
            return rs.toUser()
        } finally {
            conn.close() // 진짜 close → TCP FIN
        }
    }
}
```

이 코드의 P99 latency 는 평균이 아니라 *분산* 이 문제다.

- 정상: 5ms (TLS handshake) + 1ms (쿼리)
- TIME_WAIT 폭증 시: 60s 동안 ephemeral port 고갈 → connect() 가 EADDRNOTAVAIL
- DB 측 입장: connection churn → max_connections 도달 → 다른 서비스 connection 거부

운영에서 종종 "왜 갑자기 5XX 가 나죠" 의 진범이 이 패턴이다.

---

## 풀이 해결하지 못하는 것

면접 꼬리질문에 자주 나오는 함정.

| 풀이 해결 | 풀이 해결 못 함 |
|---|---|
| connection 생성 비용 amortize | 쿼리 자체가 느린 것 |
| 동시성 제어 (대기 큐) | 트랜잭션 길이 |
| stale 검출 | replica lag |
| leak 추적 | DB 측 deadlock |

따라서 "Connection is not available" 에러를 "풀 사이즈 늘려" 로 처치하면 안 된다는 게 [08-pool-failure-patterns.md](08-pool-failure-patterns.md) 의 핵심이다.

---

## 핵심 포인트

- connection 생성 비용 = TCP + TLS + 인증 + 세션 setup, LAN/TLS 1.2 기준 2~5ms
- 이 비용은 평균보다 *분산* 이 더 위험 — P99 SLA 의 첫 번째 적
- 풀의 5대 책임: 창고 / 회수 / 검진 / 퇴역 / 누수 추적
- 풀은 connection 비용은 해결하지만 *쿼리* 와 *트랜잭션 길이* 는 해결하지 못함

## 다음 학습

- [02-pool-parameters.md](02-pool-parameters.md) — 위 5대 책임을 8개 파라미터로 분해
- [03-spring-boot-defaults.md](03-spring-boot-defaults.md) — Spring Boot 가 Hikari 를 기본값으로 채택한 배경
