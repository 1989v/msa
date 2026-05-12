# Study Topics

간략하게 주제를 남기면 `/study:init`으로 구조화된 학습 계획서가 생성됩니다.

## Pending Topics

1. aws 인프라 환경에서 network / 방화벽 / nat / alb / nlb 등 스터디
2. JVM 내부 + GC 튜닝 (G1/ZGC 차이, GC 로그 해석, OOM 원인 분석)
3. Java/Kotlin 동시성 심화 (synchronized, volatile, AtomicXxx, ConcurrentHashMap 내부, Kotlin coroutine, Virtual Threads/Loom)
4. DB 인덱스 + 트랜잭션 격리 (B-Tree, 클러스터드 인덱스, MVCC, Lock, Deadlock, 실행 계획 분석)
5. Spring Transactional 심화 (전파 속성, 격리 수준, proxy 한계, 외부 IO 분리, 중첩 트랜잭션)
6. Kafka 내부 동작 (파티션, 컨슈머 그룹, 리밸런싱, Exactly-once semantics, 멱등성, DLQ, 장애 대응)
7. 분산 시스템 이론 + 패턴 (CAP/PACELC, SAGA, 2PC, 분산 락, Idempotency, Retry, Circuit Breaker)
8. 시스템 설계 시나리오 10선 (URL Shortener, Chat, Feed, Payment, Rate Limiter, 알림 시스템, 티켓팅, 검색, 커머스, 지도)
9. Redis 심화 (자료구조 내부, AOF/RDB 퍼시스턴스, 클러스터, Cache Stampede 방어, 분산 락, Stream)
10. Observability 3축 (Metrics: Prometheus + Grafana / Logs: ELK, Loki / Tracing: OpenTelemetry, Jaeger)
11. K8s 심화 + 배포 전략 (Operator/CRD, Networking 심화, Rolling/Blue-Green/Canary, Helm, GitOps)
12. Latency Numbers Every Programmer Should Know, 즉 레이어간 통신 비용에 대한 스터(L1, 메인메모리, SSD, 데이터센터간 통신, 디스크, 리전간 통신 등)
  12-1. https://colin-scott.github.io/personal_website/research/interactive_latency.html
  12-2. https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf page 12
  12-3. https://www.youtube.com/watch?v=WbzMtyyOQpM
13. encrypt, jwt, aes, sha 등등
14. CRDT, MRDT 등
15. 커넥션 풀, 히카리CP, reader/writer CP 분리, 레디스 풀
16. 비동기, 논블러킹
17. spring 
  17-1. Transactional(readonly, writable)
  17-2. spring filter chain, intercept, aop
  17-3. 스레드 덤프, 분석
  17-4. jackson
  17-5. gzip
18. grpc
19. 검색엔진 심화 (Elasticsearch · OpenSearch · Hybrid Search · Re-Ranking)
  19-1. Lucene 기반 내부 (segment / commit / refresh / flush / merge)
  19-2. Inverted Index + Analyzer/Tokenizer/Filter pipeline
  19-3. 한국어 형태소 분석기 (nori vs mecab-ko vs seunjeon, 사용자 사전, decompound mode)
  19-4. 스코어링 알고리즘 (TF-IDF → BM25, BM25 파라미터 k1/b 튜닝, function_score)
  19-5. Query DSL 패턴 (term/match/multi_match/bool/nested/function_score, 하이라이트, suggest)
  19-6. Vector / Semantic Search (dense_vector, HNSW, kNN, 임베딩 파이프라인)
  19-7. Hybrid Search (BM25 + dense, RRF · Reciprocal Rank Fusion, weighted score)
  19-8. Re-Ranking (cross-encoder, LTR · Learning To Rank, business signal 결합)
  19-9. Cluster 토폴로지 (master/data/coordinating/ingest 노드, shard/replica, allocation awareness)
  19-10. 인덱싱 파이프라인 (ingest pipeline, processor, reindex, alias, ILM/ISM)
  19-11. Elasticsearch vs OpenSearch 분기 (라이선스 변천, 기능 차이, 호환성, 마이그레이션 비용)
  19-12. 동기화 전략 (Outbox + Kafka + ES Sink, Debezium CDC, eventual consistency, 색인 lag SLA)
  19-13. msa search 서비스 grounding (실제 인덱스 설계, 가격/재고 같은 변동성 큰 필드 분리 원칙)
  19-14. 운영 — 모니터링 (cluster health, hot threads, slow log), 재색인 RTO, 백업/스냅샷
  > 입력 자료: `study/notes/2026-05-03-원본데이터-보조저장소-패턴-검색엔진.md` (코딩하는기술사 영상 요약 — 원본 + 보조 저장소 패턴 + 2단계 조회 + Polyglot Persistence)
20. 추천 모델링 알고리즘 (CF · 베스트랭킹 · 거리/위치 · NLP 임베딩 · 딥러닝 추천)
  20-1. 동시 행동 기반 협업 필터링 (CF · Collaborative Filtering) — View Together / Search Together / Buy Together / City Together, 공출현 행렬, Item-Item vs User-Item CF, Jaccard / Cosine / PMI 유사도
  20-2. 베스트 랭킹 (Category Best · Urban) — 행동 가중합 (`reservation×100 + click×20 + addwish×10 + pageview×1`), CTR vs CVR, Wilson score / Bayesian smoothing, dynamic weight 변형 (lb/urb)
  20-3. 거리/위치 기반 (Geo-aware) — 숙소→TNA cross, Geohash / S2 / H3 셀, ES `geo_distance` / BigQuery `ST_DWITHIN`, 거리 패널티 + 인기 보정 결합, 랜드마크 인기도 (lb/ldp)
  20-4. 시즌 / 베스트 / 재구매 — 예약일 ±7일 시즌성 (sba), `중기 CTR 피처` (ctr-best), 재구매 사용자 수 (resale-best), Trip Home 통합 score (th)
  20-5. 콘텐츠 / NLP 임베딩 — Sentence-BERT (KoBERT / Electra / RoBERTa / BART) 문장 임베딩 코사인 유사도, ES MoreLikeThis (TF-IDF) 대체 시나리오, FAISS / HNSW (ANN · Approximate Nearest Neighbor), 형태소 분석 + 공기빈도 연관 검색어 (rs)
  20-6. 딥러닝 추천 (vt-deep 14종) — Wide & Deep (Google 2016), Two-Tower (YouTube 2019), DLRM (Deep Learning Recommendation Model, Meta 2019), Tab-Transformer (Amazon 2020), DeepFM / xDeepFM / DCN-v2 / AutoInt, two-stage retrieval (Two-Tower) → ranking (DLRM/Wide&Deep) 파이프라인
  20-7. 메타 / 스코어 보정 / 디스트리뷰션 — 섹션 매핑 reference DB (mr), default preference (c2dp), union-stay 부스팅 (union-stay-score), section preference bandit 후보 (stb)
  20-8. NER 추론 인프라 (nero) — KLUE-BERT 한국어 NER, Flask + waitress + AWS GPU AMI, 검색어 의도 파악 — **추천이 아닌 검색 인프라**, 비교/contrast 용
  20-9. 빌드/배포 패턴 — Scala 2.11 + Spark 2.4.4 Dataproc, Pure BigQuery + Airflow DAG, Python 딥러닝 (TensorFlow / PyTorch), `cloudbuild-dags.yaml` 로 `airflow-workflows` 레포 sync
  20-10. msa 적용 후보 — `analytics` (Kafka Streams + ClickHouse) vs OTA 의 BigQuery + Airflow, `search` 의 BM25 → Hybrid Search 도입 (#19 cross-ref), `experiment` A/B 플랫폼으로 추천 알고리즘 비교, ADR 후보: "추천 서비스 도입 — 1단계 룰 기반 CB → 2단계 CF Spark → 3단계 임베딩 ANN"
  > 입력 자료: `study/notes/archive/2026-05-12-ota-추천엔진-카탈로그.md` (engines/ (산업 사례) 디렉토리 전체 카탈로그 — 명명규칙 + 6개 카테고리 + 빌드/배포 패턴 + 학습 분해 + cross-ref)

## 파이프라인

각 주제는 `/study:init → bs → exec` 3단계로 학습:

| Skill | 역할 | 산출물 |
|---|---|---|
| `/study:init N` | 주제 초기화 | `{N}-{slug}/00-plan.md` |
| `/study:bs N` | 방향 다듬기 | plan.md 개정 |
| `/study:exec N` | 프리뷰 (소주제 지도) + 본격 심화 (반복 호출) | `{N}-{slug}/00-preview.md` + `NN-{subtopic}.md` |

`/study:exec` 는 첫 호출 시 preview 생성, 이후 호출/자연어 지시로 다음 deep file 순차 작성 (2026-05-12 정정).

## 학습 현황

> 2026-05-04: 19개 주제 모두에 `99-concept-catalog.md` (공식 reference 기반 풀 개념 매트릭스 + 갭 진단 + 우선 심화 후보 + 표준 deep-dive 템플릿) 추가. 새 학습 시작 시 99-catalog 부터 진입 권장.

| # | 주제 | 폴더 | 상태 |
|---|------|-------|------|
| 1 | AWS 네트워크 인프라 | [1-aws-network/](docs/1-aws-network/) | **completed + 19 deep + 99-catalog** |
| 2 | JVM 내부 + GC 튜닝 | [2-jvm-gc/](docs/2-jvm-gc/) | **completed + 22 deep + 99-catalog** |
| 3 | Java/Kotlin 동시성 심화 | [3-java-kotlin-concurrency/](docs/3-java-kotlin-concurrency/) | **completed + 24 deep + 99-catalog** |
| 4 | DB 인덱스 + 트랜잭션 격리 | [4-db-index-transaction/](docs/4-db-index-transaction/) | **completed + 18 deep + 99-catalog** |
| 5 | Spring Transactional 심화 | [5-spring-transactional/](docs/5-spring-transactional/) | **completed + 14 deep + 99-catalog** |
| 6 | Kafka 내부 동작 | [6-kafka-internals/](docs/6-kafka-internals/) | **completed + 13 deep + 99-catalog** |
| 7 | 분산 시스템 이론 + 패턴 | [7-distributed-systems/](docs/7-distributed-systems/) | **completed + 20 deep + 99-catalog** |
| 8 | 시스템 설계 시나리오 10선 | [8-system-design/](docs/8-system-design/) | **completed + 13 deep + 99-catalog** (시나리오+의사결정 카탈로그) |
| 9 | Redis 심화 | [9-redis-deep-dive/](docs/9-redis-deep-dive/) | **completed + 19 deep + 99-catalog** |
| 10 | Observability 3축 | [10-observability/](docs/10-observability/) | **completed + 14 deep + 99-catalog** |
| 11 | K8s 심화 + 배포 전략 | [11-k8s-deep-dive/](docs/11-k8s-deep-dive/) | **completed + 17 deep + 99-catalog** |
| 12 | Latency Numbers Every Programmer Should Know | [12-latency-numbers/](docs/12-latency-numbers/) | **completed + 12 deep + 99-catalog** (자릿수+측정 카탈로그) |
| 13 | 암호화 · JWT · SSO · 클라우드 KMS | [13-crypto-jwt-sso/](docs/13-crypto-jwt-sso/) | **completed + 20 deep + 99-catalog** |
| 14 | CRDT · MRDT — 분산 데이터 동기화 | [14-crdt-mrdt/](docs/14-crdt-mrdt/) | **completed + 19 deep + 99-catalog** |
| 15 | 커넥션 풀 심화 (HikariCP · R/W 분리 · Redis Pool) | [15-connection-pool/](docs/15-connection-pool/) | **completed + 18 deep + 99-catalog** |
| 16 | 비동기 · 논블러킹 IO (NIO · Reactor · Netty) | [16-async-nonblocking-io/](docs/16-async-nonblocking-io/) | **completed + 19 deep + 99-catalog** |
| 17 | Spring Web 처리 심화 (Filter/Interceptor/AOP · Jackson · gzip) | [17-spring-web/](docs/17-spring-web/) | **completed + 20 deep + 99-catalog** |
| 18 | gRPC 심화 (Protobuf · HTTP/2 · Streaming) | [18-grpc/](docs/18-grpc/) | **completed + 20 deep + 99-catalog** |
| 19 | 검색엔진 심화 (ES · OpenSearch · Hybrid · Re-Ranking · BM25 · nori · 평가/modifier/자동완성/인덱스템플릿/매핑/운영API/시계열/벡터고급) | [19-search-engine/](docs/19-search-engine/) | **completed + 44 deep + 99-catalog** (※ Top-12 보강 22~33 + 평가 34 + modifier 35 + 자동완성 36 + 인덱스 템플릿 37 + 매핑 파워 38 + 운영 API 39 + 시계열 40 + 벡터 고급 41, 2026-05-05) |
| 20 | 추천 모델링 알고리즘 (CF · 베스트랭킹 · 거리/위치 · NLP 임베딩 · 딥러닝 추천 · 산업 추천 엔진 카탈로그 + msa Phase 1~3 구현) | [20-recommendation-modeling/](docs/20-recommendation-modeling/) | **completed + 27 deep + 면접카드 + ADR 후보** (2026-05-12, ~12K 줄, Phase 1-10 + 부록 §26-27 통합) |

> **흡수 노트**: 원본 17-1 (`@Transactional(readonly/writable)`) 은 #5 plan + deep file 06/07 에, 17-3 (스레드 덤프) 은 #3 plan + deep file 20 에 흡수됨 (2026-05-01).
>
> **전체 통계** (2026-05-05 기준): 19개 주제 / 448개 폴더 파일 + master 8 = 456 .md / 145,358 폴더 line. #19 = 44 파일 / 20,069 line. 12개 토픽에 27 신규 deep file 추가 (#1 +2 / #3 +1 / #4 +2 / #6 +4 / #7 +2 / #8 +4 / #10 +2 / #11 +3 / #12 +1 / #13 +4 / #14 +1 / #16 +1 / #19 +5).
