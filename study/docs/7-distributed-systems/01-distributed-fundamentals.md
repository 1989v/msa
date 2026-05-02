---
parent: 7-distributed-systems
type: deep
order: 01
created: 2026-05-01
---

# 01. 분산 시스템의 본질과 8가지 오류

> 모든 분산 시스템 이야기는 결국 **"네트워크는 안 믿을만 하고, 시계는 어긋나며, 노드는 일부만 죽는다"** 의 변주다.

## 1. 분산 시스템의 정의 (Tanenbaum)

> "독립된 컴퓨터들의 모음이지만, 사용자에게는 하나의 일관된 시스템처럼 보이는 것."

핵심 단어 셋:
- **독립**: 각 노드는 별도 메모리, 별도 시계, 별도 장애 도메인
- **메시지 전달**: 공유 메모리 없음 → **오직 네트워크로만 통신**
- **부분 장애 (partial failure)**: 시스템의 "일부만" 죽거나 느려질 수 있다 → 모놀리식엔 없는 차원

**모놀리식 vs 분산** 의 사고 전환:

| 차원 | 모놀리식 | 분산 |
|---|---|---|
| 함수 호출 결과 | 성공 or 실패 | 성공 / 실패 / **모름 (timeout)** |
| 시계 | 단일 wall clock | 노드별로 어긋남 (NTP 동기 ±수 ms ~ 수 s) |
| 메모리 | 공유 | 없음, 메시지로만 공유 |
| 장애 모델 | crash-stop | crash-recover, byzantine, gray failure |
| 동시성 | 락 | 합의 + 멱등성 |

10년차 면접에서 자주 무너지는 지점은 "**timeout 의 의미가 모놀리식과 다르다**" 를 답하지 못해서다. timeout 은 "실패" 가 아니라 "**모른다 (unknown)**" 다.

## 2. 분산 컴퓨팅의 8가지 오류 (Fallacies)

Sun Microsystems 의 L. Peter Deutsch + James Gosling 이 정리한 분산 시스템 신참의 잘못된 가정들. 면접에서 "분산 시스템에서 가장 많이 하는 실수" 를 묻는다면 이걸 인용하면 좋다.

| # | 오류 | 현실 |
|---|---|---|
| 1 | The network is reliable | 패킷 손실, 라우팅 변경, NAT timeout, half-open connection |
| 2 | Latency is zero | TCP RTT, TLS 핸드셰이크, AZ 간 1ms, 리전 간 80-300ms |
| 3 | Bandwidth is infinite | 대형 페이로드, fan-out 발산, multi-region 비용 |
| 4 | The network is secure | MITM, BGP hijack, 사내 망도 zero trust 가정 |
| 5 | Topology doesn't change | k8s 의 pod IP 는 매번 바뀜, 서비스 디스커버리 필수 |
| 6 | There is one administrator | DevOps, SRE, 보안팀, 외부 SaaS 가 동시에 만짐 |
| 7 | Transport cost is zero | 직렬화 / 압축 / 네트워크 비용은 무시 못 함 |
| 8 | The network is homogeneous | k8s + EC2 + Lambda + 외부 SaaS 가 섞임 |

## 3. 부분 장애 (Partial Failure) — 분산 시스템의 정수

### 시나리오: order → payment 호출 timeout

```kotlin
// order/PaymentAdapter.kt 의 실제 패턴 (단순화)
suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult {
    return circuitBreaker.executeSuspendFunction {
        webClient.post().uri("/payments")
            .bodyValue(...)
            .retrieve()
            .bodyToMono(PaymentResult::class.java)
            .awaitSingle()
    }
}
```

`awaitSingle()` 이 5초 후 `TimeoutException` 을 던진 순간 발생할 수 있는 진짜 상태들:

1. payment 가 요청을 **못 받았다** (네트워크 단절, 요청 버려짐)
2. payment 가 **받고 처리 중** (느린 DB, GC pause)
3. payment 가 **이미 처리 완료** 했는데 응답이 timeout 안에 못 옴
4. payment 가 **부분 실패** (PG 사 결제 OK + 자기 DB 저장 실패)

**모놀리식 사고**: timeout = 실패 → 재시도 안전
**분산 사고**: timeout = 알 수 없음 → 재시도 시 **이중 결제 위험**

→ 모든 분산 시스템 호출은 **멱등성** 을 강제해야 안전하게 재시도 가능. (자세히는 09-idempotency 참조)

### Gray failure (회색 장애)

- "죽은 건 아닌데 정상도 아닌" 상태 — GC pause, 디스크 I/O 폭주, CPU 100%
- Health check `/actuator/health` 200 OK 인데 실제 응답 시간 30초
- → **single health check 불충분**, latency-based 회로 차단 (Circuit Breaker p99 기반) + Bulkhead 격리 필요

## 4. 동기 vs 비동기 네트워크 모델

분산 시스템 이론은 통신 모델을 두 부류로 나눈다:

| 모델 | 가정 | 예시 |
|---|---|---|
| Synchronous | 메시지 지연에 **알려진 상한**, 노드 처리 시간에 **알려진 상한**, 시계 차이에 **알려진 상한** | 데이터센터 내 정합성 좋은 환경 (이상화) |
| Asynchronous | **상한 없음**. 메시지가 영원히 안 올 수도 있음 | 인터넷, 클라우드, 일반 분산 시스템 |
| Partially synchronous | 평소엔 동기, 가끔 비동기 (실제 시스템) | Raft, PBFT 의 가정 |

**FLP Impossibility (1985)** 의 충격: 비동기 모델에서 **단 1개의 노드 장애** 만 있어도 **결정론적 합의 알고리즘은 존재하지 않는다**.
→ 실제 시스템 (Raft, Paxos) 은 partially synchronous 가정에 **timeout 휴리스틱** 으로 우회. (02-cap-pacelc-flp 에서 자세히)

## 5. 장애 모델 분류

| 모델 | 설명 | 대응 |
|---|---|---|
| Crash-stop | 노드가 죽고 영원히 안 돌아옴 | 가장 단순, Raft 기본 가정 |
| Crash-recover | 죽었다가 살아남, 디스크 상태는 유지 | Raft + WAL |
| Omission | 메시지 일부 누락 | retry, sequence number |
| Byzantine | 악의적 / 임의 동작 (해킹, 버그로 거짓말) | PBFT, 블록체인 |
| Gray failure | 부분 작동 / 느림 | latency-based CB, Bulkhead |

상용 비-블록체인 시스템 (Kafka, etcd, MySQL) 은 **crash-recover** 모델만 다룬다. Byzantine 은 블록체인 / 군용에서.

## 6. 분산 시스템에서 "시간" 의 함정

### wall clock 의 위험

```kotlin
// 안티패턴: 분산 환경에서 timestamp 비교로 순서 결정
if (event1.timestamp > event2.timestamp) { ... }  // ← 다른 노드의 timestamp 면 의미 없음
```

문제:
- NTP 동기 + drift 로 노드 간 ±수십 ms ~ 수 s 어긋남
- leap second 로 시계가 **뒤로** 가는 경우도 있음 (NTP slewing 으로 흡수)
- VM 일시 정지 (live migration, GC pause) 후 시계가 갑자기 점프

### 해법: 논리 시계 (Lamport / Vector Clock) — 05-clocks-ordering 에서 자세히

- happens-before 관계 (`a → b`) 만으로 순서 결정
- wall clock 은 "사람이 보기 위한 로그" 용도로만, 인과 판단에 사용 금지

## 7. 8가지 오류와 msa 프로젝트 매핑

| 오류 | msa 적용 / 방어 |
|---|---|
| network reliable | order → payment / product **CB + retry** (ADR-0015), Kafka outbox 로 발행 보장 |
| latency zero | non-blocking I/O (suspend + WebClient), Redis fast-path |
| bandwidth ∞ | Kafka payload 최소화, ES bulk indexing |
| network secure | mTLS (k8s + Istio 검토), JWT 검증 (gateway) |
| topology static | k8s DNS (`http://payment:9090`), 직접 IP 사용 안 함 |
| one admin | infra (Helm/Kustomize) / app / DB / Kafka 가 분리된 owner |
| transport free | JSON → Avro 검토, Kafka compression |
| network homogeneous | webflux (gateway) + webmvc (도메인) 혼재 인정 + 분리 |

## 8. 핵심 한 줄

분산 시스템을 설계한다는 것은 **"네트워크를 신뢰하지 않고도 동작하는 협력 모델"** 을 짜는 일이다.
이 한 문장만 머리에 박아두면 이후 CAP, Saga, Idempotency 가 전부 그 변주임이 보인다.

## 9. 더 읽기

- "Designing Data-Intensive Applications" Ch.8 (The Trouble with Distributed Systems)
- Peter Deutsch — "Fallacies of Distributed Computing" (1994)
- Werner Vogels — "Eventually Consistent" (CACM 2009)
