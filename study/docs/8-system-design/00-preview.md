---
parent: 8-system-design
type: preview
created: 2026-05-01
---

# 시스템 설계 시나리오 10선 — Preview

> 학습자 수준: 시니어(10년차) · 전체 예상 시간: 30h · 목표: 한국 대기업 시스템 설계 면접 30분 완주
> 계획서: [00-plan.md](00-plan.md) · 매핑: msa 코드베이스 (gateway, search, order) 직접 grounding

---

## 멘탈 모델: "설계 시나리오 4축 분류"

10개 시나리오를 무작정 외우는 게 아니라 **"무엇이 어려운지" 4축**으로 묶어서 패턴을 익힌다.
면접관이 새로운 시나리오를 던져도 어느 축으로 환원되는지만 알면 30분 안에 풀 수 있다.

```
                Read-heavy
                    ▲
                    │
   URL Shortener ───┤─── Feed
   Search          (1)│(2)   Map
                    │
   ─── Stateless ───┼─── Stateful ───
                    │
   Rate Limiter   (4)│(3)  Chat
   Notification     │     Payment
                    │     Ticketing
                    ▼
                Write-heavy
                e-Commerce (전 축)
```

| 사분면 | 핵심 도전 | 시나리오 |
|---|---|---|
| (1) Read-heavy + Stateless | 캐시 계층화, CDN | URL Shortener, Search |
| (2) Read-heavy + Stateful | Fan-out 모델, Hot Partition | Feed, Map (위치) |
| (3) Write-heavy + Stateful | 분산 트랜잭션, 재고 동시성, Idempotency | Payment, Ticketing, Chat, e-Commerce |
| (4) Write-heavy + Stateless | 분산 카운터, Token Bucket | Rate Limiter, Notification |

**핵심 5문장만 외운다**:
1. **Read-heavy는 캐시 + CDN + Replica**, Write-heavy는 **샤딩 + 큐 + 멱등성**.
2. **Stateful 시스템은 항상 "어디에 상태를 두느냐"가 첫 질문** (DB / Redis / Local memory).
3. **Hot Partition**은 모든 시나리오의 공통 적 — 샤드 키 선정 + 캐시로 해결.
4. **결제·재고는 항상 분산 트랜잭션 회피** (SAGA + 이벤트 + 보상).
5. **면접 30분 = 5분 요구사항 + 5분 추정 + 10분 high-level + 10분 deep dive**.

---

## 학습 순서 (10개 시나리오)

```
01. 공통 프레임워크 (절차)
   ↓
02. URL Shortener   ─── 가장 단순, "warm-up"
03. Chat            ─── 실시간성 학습
04. Feed            ─── Fan-out 모델
05. Payment         ─── 멱등성 + SAGA
06. Rate Limiter    ─── ★ msa gateway 코드 직접 분석
07. Notification    ─── 채널 추상화
08. Ticketing       ─── 동시성 극한
09. Search          ─── ★ msa search 모듈 직접 분석
10. e-Commerce      ─── ★ msa 자체를 회고
11. Map / Geo       ─── geohash, quadtree
   ↓
12. Improvements    ─── msa 회고에서 도출한 개선 후보
13. Interview Q&A   ─── 시나리오별 4-5 꼬리질문
```

---

## 시나리오별 한 줄 요약

| # | 시나리오 | 핵심 키워드 | 가장 어려운 한 가지 |
|---|---|---|---|
| 02 | URL Shortener | Base62, 충돌, 캐시 | 단축 URL의 충돌과 ID 채번 전략 |
| 03 | Chat | WebSocket, presence, 순서 | 메시지 순서 보장 + 오프라인 큐 |
| 04 | Feed | Fan-out write/read, hybrid | Celebrity 문제 → hybrid |
| 05 | Payment | Idempotency, SAGA, ledger | 결제 중복 방지 + PG 장애 복구 |
| 06 | Rate Limiter | Token Bucket, Redis Lua | 분산 환경 카운터 동기화 |
| 07 | Notification | 채널 추상화, throttle | 사용자 선호 + Quiet hours |
| 08 | Ticketing | 대기열, 좌석 선점 TTL | 매진 직전 폭주 트래픽 |
| 09 | Search | ES 인덱싱, 랭킹, autocomplete | 인덱싱 지연 + 쿼리 시간 |
| 10 | e-Commerce | 전체 + msa 회고 | 서비스 분리 경계 |
| 11 | Map / Geo | geohash, quadtree, R-tree | 실시간 위치 갱신 |

---

## 면접 진행 표준 (30분 기준)

```
00:00 ─ 04:00  요구사항 명확화 (Functional / Non-Functional / Out of scope)
04:00 ─ 09:00  용량 산정 (DAU → QPS → Storage → Bandwidth)
09:00 ─ 12:00  API 설계 (3-5개 핵심 엔드포인트)
12:00 ─ 17:00  High-Level Architecture (LB → App → Cache → DB → Queue)
17:00 ─ 22:00  Data Model + 샤딩/인덱스
22:00 ─ 28:00  Deep Dive (병목 1-2개 + 장애 시나리오 + scale-out)
28:00 ─ 30:00  요약 + 질문 받기
```

**가장 흔한 실수**:
- 요구사항 정리 안 하고 다이어그램부터 그림 → 5분만에 막힘
- 용량 추정 없이 샤딩 얘기 → 숫자 근거 없음
- 모든 컴포넌트를 그리려 함 → 시간 부족

---

## msa 프로젝트 grounding 매핑

| 시나리오 | 본 프로젝트 매핑 | 활용 ADR |
|---|---|---|
| Rate Limiter (06) | `gateway/RateLimiterConfig.kt` (Redis Token Bucket) | ADR-0015 |
| Search (09) | `search/{domain,app,consumer,batch}` 4개 모듈 | ADR-0008, ADR-0009, ADR-0012 |
| e-Commerce (10) | 전체 msa (product/order/inventory/search/...) | ADR-0001, 0006, 0011, 0013, 0019 |
| Payment (05) | `order` + 외부 PG (CircuitBreaker) | ADR-0015 |
| Notification (07) | (미구현) chatbot/notification 도메인 후보 | - |
| Ticketing (08) | inventory + Redis 분산 락 | ADR-0011, 0013 |

---

## 참고 자료

- "System Design Interview" Vol 1, 2 — Alex Xu (대표 시나리오)
- "Designing Data-Intensive Applications" — Martin Kleppmann (Ch.5-9)
- ByteByteGo 채널 (시각화 좋음)
- High Scalability 블로그 (실제 사례)
- 본 프로젝트 docs/adr/* (msa 의사결정 기록)
