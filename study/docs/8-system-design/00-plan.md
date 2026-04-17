---
id: 8
title: 시스템 설계 시나리오 10선
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [system-design, scalability, interview, architecture]
difficulty: advanced
estimated-hours: 30
codebase-relevant: false
---

# 시스템 설계 시나리오 10선

## 1. 개요

10년차 면접에서 거의 반드시 등장하는 시스템 설계 (System Design) 질문 10가지 전형 시나리오를 준비한다. 각 시나리오마다 요구사항 추출 → Capacity Estimation → API 설계 → 데이터 모델링 → 아키텍처 다이어그램 → Scalability 고려사항을 체계적으로 정리.

코드베이스와는 직접 연관 없지만 msa 프로젝트의 실전 경험을 "저는 이 프로젝트에서 비슷한 문제를 ~ 했습니다" 같은 방식으로 녹여 쓸 수 있도록 한다.

## 2. 학습 목표

- 시스템 설계 면접의 체계적 접근 방법 (요구사항 → 추정 → API → 데이터 → 아키텍처) 숙달
- QPS / 스토리지 / 대역폭 추정 기법
- Read-heavy vs Write-heavy 시스템의 설계 차이
- 10개 시나리오 각각 30분 내 완주 가능
- 면접관의 꼬리 질문 (스케일 10x, 장애 시나리오) 에 대응
- 자신의 msa 프로젝트 경험을 시스템 설계 답변에 연결

## 3. 선수 지식

- 주제 1-7 완료 (AWS 네트워크, JVM, 동시성, DB, Spring, Kafka, 분산 시스템)
- Redis, Elasticsearch 기본
- CDN 기본 (CloudFront)

## 4. 학습 로드맵

### Phase 1: 기본 개념 (Framework)
- 시스템 설계 면접의 표준 진행:
  1. Requirement Clarification (기능/비기능)
  2. Capacity Estimation (DAU, QPS, Storage, Bandwidth)
  3. System API Design (REST / gRPC endpoint)
  4. High-Level Architecture (Load Balancer, App, DB, Cache, Queue)
  5. Data Model (스키마, 인덱스, 샤딩 키)
  6. Deep Dive (병목 분석, 스케일링, 장애 대응)
- 공통 빌딩 블록:
  - Load Balancer (ALB/NLB)
  - CDN (CloudFront)
  - Application Server (Stateless)
  - RDBMS + Sharding + Replication
  - Cache (Redis)
  - Message Queue (Kafka, SQS)
  - Object Storage (S3)
  - Search (Elasticsearch)
  - Real-time (WebSocket, SSE, Long Polling)

### Phase 2: 10개 시나리오 상세
- **2-1. URL Shortener (bit.ly)**
  - hash 생성 전략 (Base62)
  - 충돌 방지
  - Read-heavy → 캐싱 우선
- **2-2. Chat (WhatsApp, Slack DM)**
  - WebSocket vs Long Polling
  - 온라인 상태 관리
  - 메시지 순서 보장
  - Read Receipt
- **2-3. Feed (Twitter/Instagram Home Timeline)**
  - Fan-out on Write vs Read
  - Celebrity 문제
  - Hybrid 모델
- **2-4. Payment System**
  - Idempotency (결제 중복 방지)
  - 분산 트랜잭션 (SAGA)
  - Ledger (복식부기)
  - PG 연동 실패 처리
- **2-5. Rate Limiter**
  - Token Bucket, Leaky Bucket, Sliding Window
  - 분산 환경에서 Redis 기반 구현
  - Per-user vs Per-IP
- **2-6. 알림 시스템 (Notification Service)**
  - Push / Email / SMS 채널
  - 템플릿 관리
  - 배치 발송 + 개인화
  - 수신 거부 관리
- **2-7. 티켓팅 (콘서트/공연)**
  - 동시성 극한 (수만 명 동시 접속)
  - Queue 대기열
  - 좌석 선점 + 결제 TTL
  - 매진 알림
- **2-8. 검색 시스템 (Elasticsearch 기반)**
  - Indexing 파이프라인
  - Ranking 과 Boosting
  - Typo 허용 (Fuzzy)
  - Autocomplete
- **2-9. 커머스 (상품 + 주문 + 재고)**
  - msa 프로젝트 연결
  - 재고 동시성 (오버셀링 방지)
  - 주문-결제-배송 상태 전이
  - 검색 (Elasticsearch) + 상세 (RDBMS)
- **2-10. 지도/위치 기반 서비스 (Uber, Yelp)**
  - Geo Hash / Quad Tree / Geo Hash
  - 실시간 위치 업데이트
  - 근접 검색

### Phase 3: 실전 적용 (msa 경험 연결)
- msa 프로젝트에서 이미 경험한 설계 요소를 각 시나리오에 연결
  - 커머스 (2-9) ↔ 전체 msa 아키텍처
  - Rate Limiter (2-5) ↔ gateway 구현
  - 알림 (2-6) ↔ chatbot / notification 도메인
  - 검색 (2-8) ↔ search 서비스
  - Payment (2-4) ↔ order 서비스

### Phase 4: 면접 대비
- 각 시나리오당 30분 모의 설계 연습
- 꼬리 질문 대응:
  - "DAU 100x 늘어나면?"
  - "DB 가 장애나면?"
  - "Hot partition 이 생기면?"
  - "Consistency vs Availability 우선순위는?"
- Whiteboard/디지털 보드 작성 연습
- 한국어 설계 설명 톤 (영어 용어 병기)

## 5. 코드베이스 연관성

직접 연관 코드는 없음 (면접 준비 주제). 단, msa 프로젝트 경험을 답변에 연결하는 연습을 한다.

## 6. 참고 자료

- "System Design Interview - An Insider's Guide" Vol 1, 2 - Alex Xu
- "Designing Data-Intensive Applications" - Martin Kleppmann (재참조)
- ByteByteGo YouTube 채널
- High Scalability 블로그

## 7. 미결 사항

- 10개 다 할지 vs 핵심 5-6개 심화
- Whiteboard 연습 vs 노트 정리만
- 시뮬레이션 시간 (30분 × 10회)
- msa 경험 연결 스토리 작성 분량

## 8. 원본 메모

시스템 설계 시나리오 10선 (URL Shortener, Chat, Feed, Payment, Rate Limiter, 알림 시스템, 티켓팅, 검색, 커머스, 지도)
