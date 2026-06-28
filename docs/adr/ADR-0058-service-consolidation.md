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
| **commerce** | order + inventory + fulfillment + warehouse | 바운디드 컨텍스트 간 사가는 **Kafka 유지**(in-process 미전환) — 디커플링·재분리 가능성·outbox at-least-once 내구성 보존. 사가 코드 무변경 |
| **engagement** | recommendation + experiment | (analytics 는 Worker 로 분리 유지) |
| **identity** | auth + member | ⚠️ auth 는 private submodule(1989v) — submodule 경계 정리 선행 |

`:domain` 모듈·패키지·DB 스키마는 분리 유지(바운디드 컨텍스트 보존), JVM/Spring 컨텍스트/
커넥션풀만 공유. **서로 다른 바운디드 컨텍스트 간 통신(사가)은 같은 JVM 이라도 Kafka 를 유지**한다 —
in-process @EventListener 로 전환하면 코드 결합이 생겨 재분리가 어렵고 기존 outbox 의 at-least-once
내구성을 잃는다. 모듈러 모놀리스의 목적은 모듈 경계를 메시징으로 강제하는 것이므로, 전환 대신
"모듈러 모놀리스라 (in-process 대신) Kafka 이벤트 유지" 주석으로 의도를 명시한다.

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

## Modular Monolith 컨벤션 (reversibility — 모든 폴드에 항상 적용)

자원 확보 시 **한 줄도 안 고치고 재분리**가 가능하도록, 도메인을 폴드할 때 아래를 표준으로 지킨다.

### 런타임은 단일 프로세스 (자원 절감의 본질 — 오해 금지)

`:feature` 모듈 분리는 **빌드타임 조직화일 뿐**이다. `commerce:app` 1개 bootJar =
**1 JVM = 1 API 서버**(단일 `@SpringBootApplication`·단일 Spring 컨텍스트·단일 Tomcat·단일 JVM
고정비). feature 들은 한 프로세스에 링크된 라이브러리(여느 의존 jar 와 동일). 따라서 도메인 N개가
JVM 고정비를 **1벌만** 부담 → 절감 목적 그대로. (스키마 분리에 따른 datasource별 커넥션풀만 한
JVM 안에서 N벌 — 풀 사이즈로 조절. 별도 JVM N개보다 훨씬 저렴.)

### 구조: feature 라이브러리 + 얇은 aggregator

- `{domain}:domain` — 순수 도메인 (불변).
- `{domain}:feature` — 컨트롤러·서비스·어댑터·Kafka 리스너 + **도메인별** DataSourceConfig + outbox.
  **`@SpringBootApplication` main / bootJar 없음** (순수 라이브러리).
- `commerce:app` — bootable 1개: `@SpringBootApplication` + N개 feature 의존 + 통합 application.yml
  (도메인별 datasource 블록) + @Primary datasource 지정.

### 불변식 (재분리 가능성을 구조로 보장)

1. **모듈 간 직접 빈 주입 금지** — 컨텍스트 간 통신은 Kafka(또는 HTTP)로만. `{domain}:feature` 는
   다른 feature 를 **의존하지 않는다** → 교차 import 가 **컴파일 에러로 차단**(결합 구조적 불가).
2. 컨텍스트 간 이벤트는 **같은 JVM 이라도 Kafka 유지**(in-process @EventListener 전환 금지).
3. **스키마·datasource·EMF·TM·outbox 는 도메인별 분리**(공유 금지). 도메인 `@Transactional` 은
   자기 TM 한정자(`@Transactional("xxxTransactionManager")`)를 명시.
4. 도메인별 application.yml 블록은 **자기 완결적**(복사 한 번으로 추출 가능).

### 재분리 체크리스트 (`{domain}` 떼어내기 — "쉬움"의 정의)

1. `{domain}:app` 신규(얇음): `@SpringBootApplication` + bootJar + `{domain}:feature` 의존 +
   자기 datasource 블록만 담은 application.yml.
2. `commerce:app` 에서 `{domain}:feature` 의존·yml 블록 제거.
3. k8s `{domain}` Deployment 복원 + gateway 라우트 repoint.
4. 끝 — `{domain}:feature`·DB(`{domain}_db`)·Kafka 토픽·outbox **무변경**, 데이터 이관 0.

## Consequences

- (+) 상주 JVM 약 20 → ~12–13 + ephemeral CronJob. 고정 오버헤드 ~3–5GB 회수.
- (+) 사가 코드 무변경(Kafka 유지) → 폴드가 순수 co-deployment, 동작·내구성 변화 0, 재분리 용이.
- (−) 병합 그룹은 독립 배포·독립 스케일·장애 격리 상실(1인·단일노드에선 수용 가능).
- (−) auth submodule 경계로 identity 병합은 마찰 → 후순위.
- 롤아웃은 페이즈별 커밋: ① search ② commerce ③ engagement ④ identity ⑤ infra.
