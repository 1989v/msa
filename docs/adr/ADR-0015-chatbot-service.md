# ADR-0015 Chatbot Service 도입

## Status
Proposed

## Context

MSA Commerce Platform의 문서/정책/아키텍처에 대한 질문에 대화형으로 답변하는 챗봇이 필요하다.
내부 개발자뿐 아니라 외부 사용자(public repo 범위)에게도 제공해야 한다.

주요 결정 사항:
1. 신규 서비스 모듈 추가 (chatbot:domain, chatbot:app)
2. 외부 의존성 도입: Claude API (Anthropic SDK), Slack Webhook API
3. 채널 추상화를 통한 다중 인터페이스 지원

## Decision

### 1. 서비스 구조: 네스티드 서브모듈 (chatbot:domain, chatbot:app)

기존 MSA 모듈 구조(ADR-0001)를 따라 domain/app 분리.
- `chatbot:domain`: 순수 도메인 (Conversation, Message, ChatService)
- `chatbot:app`: Spring Boot 앱 (Claude API, Slack, WebSocket 어댑터)

### 2. AI 모델: Anthropic SDK 직접 사용

Spring AI 대신 Anthropic Java SDK를 직접 사용한다.
- 프롬프트 조합, 토큰 제한, 비용 제어 등 세밀한 제어 필요
- 시스템 프롬프트에 문서 컨텍스트를 동적으로 주입하는 패턴이 핵심
- Spring AI 추상화가 이 수준의 제어를 제공하지 않음

### 3. 지식 소스: 파일시스템 직접 읽기 (1차) → ES 확장 (2차)

- 현재 문서 규모 560KB (88파일) → 전체 주입 불가, 카테고리 기반 선별
- KnowledgeSourcePort 추상화로 구현체 교체 가능
- 전환 기준: 문서 총량 1MB 초과 시

### 4. Slack 연동: Webhook 방식

- Socket Mode 대신 Webhook — Spring MVC 자연 통합
- Gateway 뒤에서 엔드포인트 노출
- Signing secret으로 요청 검증

### 5. 채널 추상화: Port/Adapter 패턴

- `ChannelNotificationPort` → Slack, WebSocket 어댑터
- 채널 타입(SLACK, WEB, API)별 독립 어댑터
- 새 채널 추가 시 어댑터만 구현

### 6. 인증: 채널별 이원화

- 내부 사용자: 기존 auth 서비스 JWT (ADR-0004 준수)
- 외부 사용자: API Key 발급
- 외부 사용자는 public 카테고리 문서만 접근 가능

## Alternatives Considered

### Spring AI 사용
- 장점: Spring 생태계 통합, 모델 교체 용이
- 단점: 프롬프트 동적 조합, 비용 제어 등 세밀한 제어 부족
- 결론: 현 요구사항에는 SDK 직접이 적합. 향후 Spring AI 성숙 시 재검토

### ai-unified-slack-bot에 스킬 추가
- 장점: 인프라 재사용, 빠른 구현
- 단점: MSA 내부 API 접근 불가, Python 기반으로 기술 스택 불일치, 독립 운영 불가
- 결론: MSA 내 독립 서비스로 구현

### 벡터DB (RAG) 도입
- 장점: 의미 검색 품질 우수
- 단점: 인프라 복잡도 증가, 현재 문서 규모에서는 과잉
- 결론: 현재는 파일시스템, 필요 시 ES 경유 후 최종 옵션으로 검토

### DB 전략: 논리 스키마 분리 → 물리 분리 전환

**현재(1차)**: auth MySQL 인스턴스에 `chatbot_db` 스키마를 논리 분리로 공존시킨다.
- auth 서비스와 chatbot 서비스가 동일 MySQL 프로세스 공유
- 스키마(database)는 완전 분리 — 서비스 간 cross-reference 없음
- 로컬 개발 환경 리소스 절약 (MySQL 컨테이너 2개 절감)

**물리 DB 분리 전환 기준** — 아래 중 하나라도 해당되면 전용 MySQL 인스턴스로 분리:

| 기준 | 임계값 | 측정 방법 |
|------|--------|-----------|
| **일간 쿼리 수** | chatbot 쿼리가 auth 대비 3배 초과 | `SHOW GLOBAL STATUS LIKE 'Questions'` |
| **슬로우 쿼리** | chatbot 테이블 관련 슬로우 쿼리 일 10건 이상 | slow query log |
| **커넥션 풀 경합** | HikariCP pending 큐 대기 빈발 (p99 > 500ms) | 메트릭 모니터링 |
| **디스크 I/O** | message 테이블 데이터 1GB 초과 | `SELECT data_length FROM information_schema.tables` |
| **장애 격리 필요** | auth 장애 시 chatbot 동반 중단이 비즈니스 임팩트를 가질 때 | 운영 판단 |
| **독립 스케일링** | chatbot만 replica 추가 또는 스펙 업이 필요할 때 | 운영 판단 |

**전환 작업 (예상 소요: 1~2시간)**:
1. chatbot 전용 MySQL master/replica 컨테이너 생성
2. `mysqldump chatbot_db` → 새 인스턴스 import
3. `application.yml` datasource URL 변경
4. auth MySQL에서 chatbot_db 스키마 DROP

## Consequences

### 긍정적
- 내부/외부 사용자 모두 셀프서비스로 프로젝트 정보 획득
- 채널 추상화로 향후 확장 용이
- Clean Architecture 준수로 AI 모델/채널 교체 가능

### 부정적
- Claude API 비용 발생 (Sonnet 기준 요청당 ~$0.03, 월 1000건 ~$30)
- Anthropic SDK 직접 의존 → 모델 교체 시 어댑터 재구현 필요
- Slack Webhook용 공인 URL 필요 (Gateway 경유)

### 주의사항
- 프롬프트 인젝션 방어 필수 (사용자 입력 태그 격리)
- API Key/환경변수 등 민감정보 답변 방지 로직 필요
- 동시성 제어(Semaphore) 미적용 시 API 비용 폭주 위험
