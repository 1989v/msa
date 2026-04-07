# Tasks — Chatbot Service

> Spec: `docs/specs/2026-04-07-chatbot-service/spec.md`
> ADR: `docs/adr/ADR-0015-chatbot-service.md`

---

## Group 1: 모듈 스캐폴딩 & 빌드 설정

### Task 1.1: Gradle 모듈 생성
- `chatbot/domain/build.gradle.kts` (pure domain, common 의존만)
- `chatbot/app/build.gradle.kts` (Spring Boot + 모든 의존성)
- `settings.gradle.kts`에 `:chatbot:domain`, `:chatbot:app` 추가
- `ChatbotApplication.kt` 메인 클래스

### Task 1.2: Docker & Infra 설정
- `docker/docker-compose.yml`에 chatbot 서비스 추가
- chatbot용 MySQL DB/스키마 설정
- `application.yml` / `application-docker.yml` 프로파일

---

## Group 2: Domain Layer

### Task 2.1: 도메인 모델
- `Conversation` (Aggregate Root) + `Message` (Entity)
- Value Objects: `ConversationId`, `MessageId`, `UserId`, `ChannelType`, `UserRole`, `ConversationStatus`, `MessageRole`
- `ConversationDomainService`: buildContextWindow, validateAccess, estimateTokenCount
- `ChatbotException` 예외 계층

### Task 2.2: 도메인 테스트
- `ConversationTest` — 메시지 추가, 상태 전이
- `ConversationDomainServiceTest` — 컨텍스트 윈도우 구성, 접근 검증
- Kotest BehaviorSpec + MockK

---

## Group 3: Application Layer (Ports & UseCases)

### Task 3.1: Outbound Ports 정의
- `ConversationRepositoryPort`
- `AiModelPort` + `AiModelRequest`/`AiModelResponse`
- `KnowledgeSourcePort` + `KnowledgeChunk`
- `ChannelNotificationPort`

### Task 3.2: Inbound Ports & UseCase 구현
- `AskQuestionUseCase` + `AskQuestionCommand`/`AskQuestionResult`
- `GetConversationUseCase`, `CloseConversationUseCase`
- `AskQuestionService` (UseCase 구현체)
- `PromptBuilder` — 시스템 프롬프트 + 문서 컨텍스트 + 대화 이력 조합

### Task 3.3: Application Layer 테스트
- `AskQuestionServiceTest` — Mock Port 주입, 전체 플로우 검증
- `PromptBuilderTest` — 프롬프트 조합, 토큰 상한, 외부 사용자 제약

---

## Group 4: Infrastructure Layer — 핵심 어댑터

### Task 4.1: Persistence Adapter
- `ConversationJpaEntity`, `MessageJpaEntity`
- `ConversationJpaAdapter` (ConversationRepositoryPort 구현)
- DB 마이그레이션 스크립트 (conversation, message 테이블)

### Task 4.2: Claude API Adapter
- `ClaudeApiAdapter` (AiModelPort 구현)
- Anthropic Java SDK 연동
- Retry (429 → exponential backoff), Timeout 30초
- 비용 계산 로직
- Semaphore 기반 동시성 제어 (max 5)

### Task 4.3: FileSystem Knowledge Adapter
- `FileSystemKnowledgeAdapter` (KnowledgeSourcePort 구현)
- 카테고리별 문서 로드 (architecture, adr, standard, guide)
- 키워드 매칭 검색
- 5분 주기 문서 갱신 (@Scheduled)

---

## Group 5: Infrastructure Layer — 채널 어댑터

### Task 5.1: Slack Webhook Adapter
- `SlackEventController` — Event Subscription 수신, challenge 응답
- `SlackNotificationAdapter` (ChannelNotificationPort 구현)
- Signing secret 검증
- 3초 ACK + 비동기 처리
- thread_ts → Conversation 매핑

### Task 5.2: WebSocket Adapter
- STOMP WebSocket 설정
- `WebSocketHandler` — 메시지 수신/응답 스트리밍
- `WebSocketNotificationAdapter` (ChannelNotificationPort 구현)
- 타이핑 인디케이터

---

## Group 6: Presentation Layer

### Task 6.1: REST API Controller
- `ChatController` — CRUD 엔드포인트 (spec 5.1)
- `ApiResponse<T>` 포맷 준수
- 인증 필터 (JWT / API Key)
- 사용자별 레이트 리밋

### Task 6.2: 관리 엔드포인트
- `/api/v1/chat/admin/reload` — 문서 인덱스 수동 갱신
- `/actuator/health` — 헬스체크

---

## Group 7: Security & Config

### Task 7.1: 인증/인가 설정
- JWT 토큰 검증 필터 (auth 서비스 연동)
- API Key 검증 필터
- Slack signing secret 검증 유틸
- UserRole (INTERNAL/EXTERNAL) 결정 로직

### Task 7.2: 설정 클래스
- `ChatbotProperties` — application.yml 바인딩 (@ConfigurationProperties)
- `CostConfig`, `KnowledgeConfig`, `SlackConfig` 등

---

## Group 8: 통합 테스트 & 검증

### Task 8.1: 통합 테스트
- `ConversationJpaAdapterTest` — H2 DB 통합
- `ChatControllerTest` — MockMvc API 테스트
- `AskQuestionIntegrationTest` — 전체 플로우 (Mock Claude API)

### Task 8.2: 빌드 검증
- `./gradlew :chatbot:domain:test` 통과
- `./gradlew :chatbot:app:build` 통과
- Docker 이미지 빌드 확인

---

## 의존성 그래프

```
Group 1 (스캐폴딩)
  └→ Group 2 (Domain)
       └→ Group 3 (Application)
            ├→ Group 4 (핵심 어댑터)
            └→ Group 5 (채널 어댑터)
                 └→ Group 6 (Presentation)
                      └→ Group 7 (Security)
                           └→ Group 8 (통합 테스트)
```

## 병렬 가능 구간
- Group 4 & Group 5: 독립 어댑터, 동시 구현 가능
- Task 2.1 & Task 3.1: 도메인 모델 + 포트 정의 동시 가능
