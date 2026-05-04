---
parent: 8-system-design
type: interview-qa
order: 13
title: 시나리오별 면접 꼬리질문 모음
---

# 13. 면접 꼬리질문 모음 (Interview Q&A)

> 각 시나리오별 4-5개의 단골 꼬리질문 + 모범 답안. 한국 대기업 면접관 톤. 짧고 명확하게, **숫자와 trade-off 동반**이 핵심.

---

## 0. 공통 (어떤 시나리오든)

**Q. DAU 10x로 늘면 어디가 먼저 터질까요?**
A. "보통 DB → Cache → MQ → Network 순으로 병목이 옮겨갑니다. DB는 인덱스/샤딩, Cache는 hit ratio + Stampede 방어, MQ는 partition 추가 + autoscale, Network는 CDN (Content Delivery Network, 콘텐츠 전송 네트워크)/edge로 풀겠습니다. 어디가 먼저인지는 현재 read:write 비율과 active set 크기로 판단합니다."

**Q. Consistency vs Availability 우선순위는?**
A. "Tier 1 (결제, 잔액)은 Strong Consistency 필수, Tier 2 (조회, 검색)는 Read-your-writes로 충분, Tier 3 (분석, 추천)은 Eventual OK. 본 msa의 latency budget도 같은 분류로 운영합니다."

**Q. 어디서부터 모니터링하시나요?**
A. "RED 메트릭 (Rate, Errors, Duration) per service + USE (Utilization, Saturation, Errors) per resource. SLO (Service Level Objective, 서비스 수준 목표)를 99.9% 정의하고 error budget 소진율이 50% 넘으면 alert."

---

## 1. URL Shortener (02번)

### Q1. 단축 URL 충돌 시 어떻게 하시나요?
**A.** "Auto-Increment + Base62는 충돌 0이라 가장 단순합니다. Hash 방식이면 같은 키 발견 시 (1) 같은 원본 URL이면 재사용, (2) 다른 URL이면 attempt 카운터 증가시켜 재해시. 5회 초과 시 길이를 1자 늘립니다. UNIQUE 제약은 DB 레벨에서 한 번 더 방어."

### Q2. 5년 후 60억 row, 단일 MySQL 가능?
**A.** "60억 × 150 byte = 900GB, 단일 MySQL 한계 근처입니다. 첫 번째 카드는 cold storage 이관 (1년 미사용 → S3 (Simple Storage Service, 객체 스토리지)), 두 번째는 read replica 추가, 세 번째가 샤딩 (short_key prefix hash 기반). 90%는 cache hit이라 실제 DB QPS (Queries Per Second, 초당 쿼리 수)는 작아 read replica로 버틸 수 있습니다."

### Q3. 클릭 통계가 1초 단위로 정확해야 한다면?
**A.** "그러면 Kafka 비동기 모델은 부적합. 동기 INCR을 Redis에 + 1분마다 batch flush로 ClickHouse에 적재. 다만 Redis 다운 시 손실이 있어, write-ahead log (Kafka producer)와 함께 운영합니다. 1초 정확도는 비용 ↑↑ — 보통 5-10초 lag 합의가 적절."

### Q4. 보안: 추측 가능한 short_key 문제는?
**A.** "Auto-Increment 기반은 1, 2, 3 식 추측 가능. 두 옵션: (1) random 7자 generation + 충돌 재시도, (2) base62 + offset 큰 수부터 (예: 1000000부터 시작). 보안이 중요하면 (1), 단순함 우선이면 (2)."

### Q5. 만료된 URL의 DB cleanup은?
**A.** "Cron으로 60억 row scan은 비용. Lazy 검사 (조회 시 expires_at 확인 후 404) + 별도 archive job (1년 이상 미접근은 cold storage 이관). DB의 active set 작게 유지가 핵심."

---

## 2. Chat System (03번)

### Q1. 메시지 순서를 어떻게 보장하나요?
**A.** "(1) 서버에서 timeuuid 발급으로 정렬 키 확보, (2) 같은 conversation_id는 Kafka 단일 partition으로 묶어 consumer 순서 보장, (3) 클라이언트는 clientMsgId로 ACK 매칭. 이 3중 구조면 분산 환경에서도 순서 보장 가능."

### Q2. 사용자가 모바일/웹 동시 접속 시?
**A.** "디바이스별 별도 WebSocket 연결, presence는 Redis SET으로 active devices 관리 (`active_devices:{userId}` SADD/SREM). 메시지 fan-out 시 모든 active device에 push, 한 곳 read 시 다른 device에 READ 이벤트 전파."

### Q3. 100만 동시 연결 어떻게?
**A.** "WebSocket 서버당 100k 연결 가정 → 10대. Linux ulimit -n 1M, Netty/Reactor Netty heap 8GB. LB는 sticky (userId hash)로 sticky 처리하되, Redis pub/sub으로 cross-server fan-out. Graceful shutdown으로 drain mode 60초."

### Q4. 오프라인 사용자에게 메시지 전달은?
**A.** "(1) Cassandra에 영구 저장 — 재접속 시 since=lastSeenAt 으로 동기화. (2) Push notification으로 알림 (APNs/FCM). (3) 백오프 정책 — 5분 동안 N개 이상 오프라인 메시지 시 묶어서 1개 push."

### Q5. 200명 그룹방 1초 100메시지 폭주 시?
**A.** "fan-out = 100 × 200 = 20,000 / s. WebSocket 서버 한 대에 다 가지 않도록 Redis pub/sub 분산 + 채널 단위 sub-shard. 메시지를 batch로 묶어 push (100ms 간격)도 옵션. Cassandra write는 partition (conversation_id, bucket)으로 분산되어 OK."

---

## 3. Feed System (04번)

### Q1. Celebrity (1억 follower) 글 1개 작성 시?
**A.** "Push만 쓰면 1억 inbox write 폭주. Hybrid 정답: follower count ≥ 10k는 Pull-only. Home read 시 본인 inbox + celebrity recent posts를 merge. 임계치는 동적으로 follower_count 컬럼으로 결정."

### Q2. 사용자가 200명 follow했을 때 Pull-only 시 P99?
**A.** "200 query × 평균 5ms = 1초+. Pull-only는 안 되고, 일반 사용자는 Push로 inbox 미리 채워두는 게 정답. inbox에는 post_id ZSET (cap 800개)만 저장, 실제 post 데이터는 별도 Cassandra fetch."

### Q3. inbox cache 다운 시 어떻게 복구?
**A.** "Lazy rebuild: 첫 GET /feed 시 follow 목록을 가져와 각자의 user_timeline에서 최근 20개씩 fetch + merge. 이 동작은 평소보다 200% 느리지만 자체 복구. inbox는 ZSET capped (800개) → 메모리도 예측 가능."

### Q4. 인기 게시물 (좋아요 100만) 표시 동시성은?
**A.** "좋아요 카운트는 Redis INCR (atomic) → 1분마다 DB sync. Hot key 분산은 (`like:post:1:shard0~9`) 여러 키로 분산 + sum. View count도 같은 패턴."

### Q5. 추천 알고리즘과 어떻게 결합?
**A.** "Feed 서비스는 candidate generation (follow + recent), Ranking은 별도 ML 서비스. Feature store는 user/post embedding을 미리 저장, 200 candidate → ML rank → top 20. Latency budget 200ms 안에 처리."

---

## 4. Payment System (05번)

### Q1. 이중 결제 방어를 어떻게?
**A.** "3중 방어: (1) Redis SETNX(idempo:key, TTL (Time To Live, 생존 시간) 24h)로 빠른 거절, (2) DB UNIQUE(idempotency_key)로 한 번 더, (3) PG 자체 idempotency_key로 마지막. Redis 다운 시 DB로 fallback. 가장 위험은 PG TIMEOUT — 절대 FAILED 처리 안 하고 5분 후 PG 조회로 확정."

### Q2. SAGA 보상 트랜잭션 실패 시?
**A.** "보상도 idempotent 설계. 실패 시 DLQ (Dead Letter Queue, 데드 레터 큐)로 격리 + 운영자 alert + 자동 재시도 (exponential backoff). 끝까지 실패하면 manual reconciliation. 금융권은 보통 운영팀이 매일 새벽 reconcile job 결과를 검토."

### Q3. PG 5초 timeout 발생 시 사용자 화면은?
**A.** "사용자에게는 'PENDING - 결과를 확인 중' 표시. 백엔드는 PG 조회 API로 5분 단위 확인 → 결과 확정 후 webhook/push로 사용자 알림. 결제 SSOT는 자체 DB (PG 의존 X)."

### Q4. 정산 mismatch 발견 시?
**A.** "Reconciliation job이 DB ↔ PG 일별 비교. mismatch 케이스: (1) DB 있고 PG 없음 = TIMEOUT 오인, (2) PG 있고 DB 없음 = 응답 누락, (3) 금액 불일치. 모두 alert + 운영자 수동 처리. 금액 1원이라도 alert (왜냐하면 단위 오류 가능성)."

### Q5. Ledger를 단일 잔액 컬럼 대신 복식부기로 한 이유?
**A.** "(1) Race condition 방지 — append-only는 contention 없음, (2) Audit log 자동 — 모든 변경 이력, (3) 잔액 재계산 가능 — 사고 시 복구. 단점은 잔액 조회 시 SUM(amount) → snapshot table로 보완."

---

## 5. Rate Limiter (06번)

### Q1. Token Bucket vs Sliding Window 언제?
**A.** "Token Bucket이 80% 정답 — burst 허용 + 단순. Sliding Window는 정확한 SLA (Service Level Agreement, 서비스 수준 협약) 검증 (99 RPS (Requests Per Second, 초당 요청 수) 정확히)이 필요할 때, 메모리 비용 감수. 본 msa는 Spring Cloud Gateway의 RedisRateLimiter (Token Bucket) 사용 중."

### Q2. 분산 환경에서 정확한 카운터는?
**A.** "중앙 Redis + Lua script 가 표준. Spring Cloud Gateway 내장 Lua가 `last_tokens + delta * rate`를 atomic 계산. Redis 단일 스레드라 race condition 없음. 분산 캐시 (Redis Cluster) 도 OK — key 기반 hash."

### Q3. Redis 다운 시 fail-open vs fail-closed?
**A.** "API 성격에 따라. 결제 같은 critical은 fail-closed (보안). 일반 read API는 fail-open (가용성). 본 msa gateway는 Spring 기본 fallback (open). Local Caffeine fallback이 다음 개선 후보."

### Q4. 사용자 tier별 차등은 어떻게 구현?
**A.** "key 자체에 tier 포함 (`{routeId}:{userId}:tier:premium`) + RedisRateLimiter 여러 인스턴스 + KeyResolver에서 tier 조회 후 분기. 본 msa는 단일 limiter라 12번 improvements에 P0 후보로 등록."

### Q5. DDoS 시 1차 방어는?
**A.** "Rate Limiter가 마지막 방어선. 1차는 CDN/WAF (CloudFlare, AWS WAF) — 비정상 패턴 자동 차단. 2차는 IP-based 자동 ban (1분 1000 req → 1시간 차단). Rate Limiter는 정상 트래픽 보호용."

---

## 6. Notification System (07번)

### Q1. 사용자가 5분 동안 같은 알림 100번 받게 되는 경우?
**A.** "Producer가 이벤트 재발행 시 발생. Dedup key = `dedup:{userId}:{templateCode}:{keyId}` Redis SETNX 5분 TTL로 방어. keyId는 orderId 같은 자연 식별자."

### Q2. 마케팅 캠페인 1억 명 발송 어떻게?
**A.** "S3에 사용자 ID 리스트 → Spark job으로 청크 분할 → Kafka 100 partition 발행. Router는 사용자 선호 + Quiet Hours + Throttle 검사. APNs/FCM rate limit 고려해 worker 자체에 token bucket (예: 10k/s out-bound)."

### Q3. APNs 갑자기 응답 안 하면?
**A.** "Kafka backlog 누적 → autoscale + alert. APNs 다운은 Apple 책임 — 자체 retry로 30분 견딘 후 운영자 알림. Email도 같은 대응. 서비스가 자체 retry 무한반복 X (rate limit 위험)."

### Q4. 새벽 3시 알림 보내면?
**A.** "Quiet Hours (22:00-08:00) 검사. 사용자 timezone 고려 (`Asia/Seoul`). CRITICAL (결제 실패 등)은 무시 강행, NORMAL/LOW는 09:00로 reschedule. 잘못된 새벽 발송은 unsubscribe 폭증의 주범."

### Q5. Email bounce 폭증 시 sender reputation은?
**A.** "Hard bounce는 영구 차단 리스트, soft는 retry 3회. ISP (Gmail, Naver) 마다 reputation 추적, Postmaster Tools로 모니터링. DKIM/SPF/DMARC 인증 강제. 신규 IP는 warmup (점진적 발송량 증가)."

---

## 7. Ticketing System (08번)

### Q1. 100만 동시 접속 어떻게 처리?
**A.** "Queue Gateway (WebSocket)로 대기열 분리. Redis ZSET에 사용자 enqueue → 초당 1,000명씩 token 발급 → token 받은 사용자만 booking app 진입. 이렇게 하면 booking app은 100만이 아니라 1,000 RPS만 처리."

### Q2. 좌석 오버셀링 어떻게 방지?
**A.** "4중 방어: (1) Redis 분산 락 SETNX 5초 TTL, (2) Redis Hash atomic 상태 (HSETNX), (3) DB UNIQUE(seat_id, status='SOLD'), (4) 재고 카운터 INCR 검증. 첫 관문이 통과해도 마지막 DB가 잡음."

### Q3. 5분 hold 후 결제 안 하면?
**A.** "Redis ZSET (`hold:{eventId}`)에 expires_at score로 저장 → 1초마다 worker가 ZRANGEBYSCORE 0~now 으로 만료된 좌석 회수. AVAILABLE 로 되돌리고 reservation은 EXPIRED 처리. 다른 사용자가 즉시 잡을 수 있음."

### Q4. 결제는 됐는데 좌석 확정 누락 (가장 큰 사고) 방지?
**A.** "Saga 보상: 결제 성공 후 좌석 SOLD 처리 실패 시 → 자동 환불 + alert. Idempotency-Key (= reservationId) 로 결제 호출하면 같은 결과 보장. Reconciliation job (1분 단위) 으로 mismatch 자동 검출."

### Q5. 매크로 봇 차단은?
**A.** "(1) WAF (AWS WAF, CloudFlare) 1차 — User-Agent / pattern 분석. (2) reCAPTCHA — 결제 직전. (3) 행동 분석 — 클릭 간격 / 마우스 이동 패턴. (4) 본인인증 강제 (Verified Fan). (5) IP/계정당 동시 좌석 N개 제한."

---

## 8. Search System (09번)

### Q1. 색인 lag을 1초로 줄이려면?
**A.** "ES refresh_interval을 1s로 (현재 5s). 단, segment 빈도 ↑ → CPU 부하 ↑. Bulk size를 줄이고 (1000 → 100) flush interval도 1초로. 비용은 indexing throughput 50% 감소. 보통 5초가 sweet spot."

### Q2. 인덱스 매핑 변경 (예: 새 필드 추가) 어떻게?
**A.** "Alias swap 패턴. 새 인덱스 `products_v2_20260501` 생성 → batch reindex (수십 분) → alias `products`를 새 인덱스로 atomic switch. 본 msa의 IndexAliasManager가 정확히 이 흐름."

### Q3. 한국어 검색에서 '아이폰' = 'iphone' 매핑은?
**A.** "Synonym filter 추가. ES analyzer에 `synonym` filter 등록 + dictionary file (`아이폰,iphone`). 본 msa nori analyzer에 추가 가능. 동의어 사전 관리는 정기 업데이트 + reindex 필요."

### Q4. 검색 결과 랭킹 A/B 테스트는?
**A.** "본 msa의 experiment 서비스 활용 + RankingProperties를 외부 config로. Variant별 popularityWeight, ctrWeight 다르게 → 사용자 그룹별 다른 가중치 적용. 결과는 analytics에서 conversion 측정."

### Q5. 동의어 / 오타 / 부분일치 모두 해결하려면?
**A.** "`match` (분석기 + 토큰 매칭) + `fuzzy` (edit distance) + `match_phrase_prefix` (autocomplete) + `synonym filter` 조합. multi_match로 묶고 boost 가중. 단, query 비용 ↑ — phase 별로 분리: 1차 match, 0건이면 fuzzy fallback."

---

## 9. e-Commerce / msa 회고 (10번)

### Q1. 이 프로젝트 가장 잘된 결정과 이유?
**A.** "Clean Architecture + Nested Submodule 구조. 도메인 테스트가 Spring 없이 1초 안에 실행되고, 인프라 교체 (예: MySQL → PostgreSQL) 시 도메인 변경이 0이라 적은 비용으로 큰 유연성을 얻었습니다."

### Q2. 다시 한다면 바꿀 결정은?
**A.** "Auto-Increment PK를 KSUID로 바꾸겠습니다. 현재는 단일 MySQL 의존이라 1억 row 도달 시 샤딩 마이그레이션이 강제됩니다. 처음부터 분산 친화적 ID로 시작했으면 점진적 샤딩이 쉬웠을 것."

### Q3. Saga Choreography 선택 이유와 한계?
**A.** "Phase 1에서 단순성 우선이라 Choreography 채택 (ADR (Architecture Decision Record, 아키텍처 결정 기록)-0011). 이벤트 chain이 명확하고 중앙 의존 없음이 장점. 한계는 흐름 추적 — 분산 트레이싱 (OpenTelemetry + Jaeger) 강화가 다음 과제. 복잡한 5+ 단계는 Orchestrator (Temporal) 도 검토."

### Q4. 단일 PG 의존은 위험한가?
**A.** "운영 환경에선 매우 위험 — PG 다운 = 매출 0. 본 msa는 학습 목적이라 단일이지만, P1 개선 후보로 Multi-PG 라우팅 (70/20/10 split) + per-provider CircuitBreaker + 정산 reconciliation 분리를 두고 있습니다."

### Q5. K8s 전환의 장단점?
**A.** "장점: HPA 자동, blue-green 쉬움, multi-cluster 가능, ADR-0019 참조. 단점: 운영 복잡도 ↑ (특히 networking, observability), Eureka 같은 단순한 것 대신 K8s DNS + Service mesh 학습 필요. 본 msa는 k3s-lite (개발) + prod-k8s (운영) 이원화."

---

## 10. Map / Geo System (11번)

### Q1. 5km 반경 검색을 어떻게 빠르게?
**A.** "Redis GEO (geohash 기반) GEOSEARCH FROMLONLAT lat lng BYRADIUS 5 km. 내부적으로 ZSET + geohash score로 O(log N + M). PostGIS는 정적 POI 검색용 (GIST 인덱스)."

### Q2. 운전자 100k의 위치 갱신 부하는?
**A.** "5초마다 → 20k QPS write. Redis GEOADD는 atomic O(log N). 단일 Redis Cluster shard로 OK. 정지 시 갱신 빈도 1/10 throttle (geofence)로 부하 절감."

### Q3. Geohash 경계 문제는?
**A.** "인접한 두 점이 다른 geohash prefix일 수 있음. 검색 시 8개 이웃 cell 함께 조회 (Geohash.neighbors). 또는 Redis GEOSEARCH 처럼 내부적으로 처리하는 lib 사용. S2 (Google) 는 이 문제 약함."

### Q4. 운전자가 GPS jitter로 50m씩 점프하면?
**A.** "Kalman filter 또는 마지막 N개 평균. 또는 speed > 200km/h 같은 비정상 점프 무시. 클라이언트 측에서 1차 필터링 (모바일 SDK), 서버에서 2차 검증."

### Q5. 사용자 ↔ 운전자 매칭에서 race condition은?
**A.** "동시에 2명 사용자가 같은 운전자에게 push → 둘 다 ACCEPTED. 해결: push offer는 sequential (1명씩), accept 받으면 즉시 ZREM `drivers:active`. 또는 driver 측에 lock (SETNX assigned:driverId)."

---

## 부록 A. 모든 시나리오 공통 답변 패턴

면접 답변은 항상 다음 4단 구조:

```
1. 결론 한 줄: "X로 풉니다."
2. 이유 (trade-off): "왜냐하면 A vs B 중 X가 더 적합."
3. 숫자 근거: "DAU 100만 × 5 req → 5K QPS, 단일 X로 OK."
4. 한계 / 다음 단계: "단, Y 상황에선 Z로 전환 필요."
```

이 패턴이 익숙해지면 어떤 시나리오라도 30분 안에 풀 수 있다.

---

## 부록 B. 면접 직전 1분 리마인더

```
□ 요구사항 정리 → 4분
□ 용량 산정 → 5분
□ API → 3분
□ High-Level → 5분
□ DB 스키마 → 5분
□ Deep Dive 2개 → 8분
□ 30초 요약
□ 항상 Trade-off 1개 명시
□ 항상 본 msa 경험 1개 인용 ("본 프로젝트에서는...")
□ 모르면 모른다 + "이렇게 접근하겠습니다"
```

---

## 부록 C. 한국 대기업 면접관이 자주 던지는 질문 패턴

| 패턴 | 실제 의도 |
|---|---|
| "DAU 10x 늘면?" | 병목 파악 능력 |
| "이걸 다시 한다면?" | 자기 비판 + 학습 능력 |
| "장애 시?" | 운영 감각 |
| "왜 그 선택을?" | trade-off 이해도 |
| "본 프로젝트 경험은?" | 실전 매핑 능력 |
| "ML 적용은?" | 미래 비전 |

> 모든 질문은 결국 **"trade-off를 이해하는가"** 검증. 정답이 아니라 **선택과 그 근거**가 채점 포인트.
