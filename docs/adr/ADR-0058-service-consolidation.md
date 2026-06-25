# ADR-0058 — 서비스 토폴로지 통합 (과분할 해소 + 워크로드 티어링)

- Status: Accepted
- Date: 2026-06-25
- Supersedes: 없음 / Relates: ADR-0019(K8s 전환), ADR-0025(Latency Budget), ADR-0055(OpenSearch)

## Context

플랫폼이 도메인당 1 JVM 원칙으로 분해되어 **상주 JVM 약 20개**(gateway, product, order,
search-app/consumer/batch, inventory, fulfillment, warehouse, member, auth, wishlist,
analytics, experiment, recommendation, code-dictionary, gifticon, chatbot, quant,
agent-viewer)에 도달했다. 단일 노드(OCI Ampere A1 free tier) 기준 문제:

- **JVM 고정 오버헤드세**: Spring Boot 4 / Java 25 프로세스당 Metaspace·스레드스택·JIT·
  다이렉트버퍼로 워크로드와 무관하게 ~250–400MB. 20개 ≈ 5–8GB가 "분할 자체의 비용".
- 마이크로서비스 분할의 정당화(독립 배포·독립 스케일·팀 경계)가 **1인·단일노드에선 부재** →
  세금만 지불하고 이득은 없음.
- 제약 노드에서 API latency의 최대 위협은 **JVM 과다로 인한 메모리 압박/GC**이지,
  코로케이트된 경량 컨슈머가 아니다.

## Decision

### 1) 워크로드 티어 모델 (분리 기준은 "무게"이지 "동기/비동기"가 아님)

| 티어 | 정의 | 규칙 |
|---|---|---|
| **API**(상주) | 온라인 요청 처리, latency SLA | 경량 컨슈머(@KafkaListener)·경량 @Scheduled 는 **app 내 코로케이트** |
| **Worker**(상주) | 무거운 비동기(GC/CPU 튐) | **무거운 것만 분리** + Kafka 전송. 현재: `search-consumer`(벌크 색인), `analytics`(Kafka Streams) |
| **Batch**(ephemeral) | run-to-completion | **상주 Deployment 금지 → Job/CronJob**. idle 메모리 0 |

근거: in-process async 는 요청 스레드만 풀어줄 뿐 작업 자체는 같은 JVM 자원을 경쟁한다.
작업이 API JVM 의 CPU/GC 를 위협할 만큼 무거울 때만 프로세스 분리가 실효를 가지며, 그 경우
프로세스 경계를 넘으므로 Kafka 가 전송 계층이 된다. 경량 비동기까지 분리하면 JVM 만 2배 →
메모리 압박 → latency 악화.

### 2) 도메인 병합 (모듈러 모놀리스 — `:domain` 분리 유지, `:app` 만 통합)

| 그룹 | 병합 대상 | 효과 |
|---|---|---|
| **commerce** | order + inventory + fulfillment + warehouse | 사가(order→inventory→fulfillment) **in-process 이벤트화**, Kafka 홉·결과적정합성 제거 |
| **engagement** | recommendation + experiment | (analytics 는 Worker 로 분리 유지) |
| **identity** | auth + member | ⚠️ auth 는 private submodule(1989v) — submodule 경계 정리 선행 |

`:domain` 모듈·패키지·DB 스키마는 분리 유지(바운디드 컨텍스트 보존), JVM/Spring 컨텍스트/
Kafka 컨슈머/커넥션풀만 공유. 그룹 내부 이벤트는 in-process, 그룹 간은 Kafka 유지.

**분리 유지**: gateway(WebFlux 리액티브, 서블릿/JPA 와 혼재 금지), product(카탈로그 SSOT),
search-api(OpenSearch 전용 + P99 SLA), quant(22k LOC, 도메인 단절), chatbot·code-dictionary·
gifticon·agent-viewer(도메인 단절 사이드앱).

### 3) search 재편 (이 ADR 1차 실행분)

- `search-batch` 상주 Deployment(트리거 불가 좀비: `job.enabled=false`+web 없음) **제거** →
  reindex/eval 은 CronJob (`searchEvaluationJob` 기존, `productApiReindexJob` 추가).
- `search-consumer` 는 **Worker 로 분리 유지**(벌크 색인이 쿼리 P99 위협, ADR-0025).

### 4) 인프라 통합

- **엔진 내부는 이미 최적**: 모든 datastore 가 단일 공유 인스턴스(MySQL/Redis/OpenSearch/
  ClickHouse/Kafka(KRaft)/Postgres 각 replicas=1). 서비스별 DB 중복 없음.
- **RDBMS 2종 → 1종 후보**: MySQL(커머스 전역) + Postgres(pgvector, quant 전용)가 공존.
  quant 벡터 패턴매칭을 **OpenSearch kNN** 으로 이관 시 Postgres 제거 가능(OpenSearch 는 이미 상주).
- **최대 레버는 "OCI 스코프"**: ClickHouse(OLAP)·quant 스택(app+postgres+ingest+fe)은
  커머스 코어와 단절된 중량 컴포넌트. OCI 가 커머스 데모라면 제외가 가장 큰 RAM 회수.
- quant-ingest 는 이미 CronJob(ephemeral) — 조치 불요.

## Consequences

- (+) 상주 JVM 약 20 → ~12–13 + ephemeral CronJob. 고정 오버헤드 ~3–5GB 회수.
- (+) 그룹 내부 Kafka 홉 소멸 → 결과적정합성 복잡도·브로커 왕복 감소.
- (−) 병합 그룹은 독립 배포·독립 스케일·장애 격리 상실(1인·단일노드에선 수용 가능).
- (−) auth submodule 경계로 identity 병합은 마찰 → 후순위.
- 롤아웃은 페이즈별 커밋: ① search ② commerce ③ engagement ④ identity ⑤ infra.
