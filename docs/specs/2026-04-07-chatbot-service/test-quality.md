# Test Strategy — Chatbot Service

## Layer별 테스트 전략

### Domain Layer (chatbot:domain)
- **단위 테스트**: Kotest BehaviorSpec + MockK
- **Spring context 없음**
- 대상: Conversation, Message, KnowledgeSource 도메인 모델
- 대상: ChatService (도메인 서비스)
- 대상: 권한 검증 로직

### Application Layer (chatbot:app)
- **UseCase 테스트**: Mock Port 주입
- 대상: AskQuestionUseCase, CreateSessionUseCase
- 대상: 컨텍스트 윈도우 조합 로직
- 대상: 프롬프트 빌더

### Infrastructure Layer (chatbot:app)
- **통합 테스트**: H2 + TestContainers
- 대상: ConversationRepositoryAdapter (JPA)
- 대상: ClaudeApiAdapter (Mock 서버)
- 대상: SlackChannelAdapter, WebChannelAdapter

### Presentation Layer (chatbot:app)
- **API 테스트**: MockMvc / WebTestClient
- 대상: ChatController (REST API)
- 대상: WebSocket 핸들러
- 대상: 인증/인가 필터

## 커버리지 목표

| Layer | 목표 | 비고 |
|-------|------|------|
| Domain | 90%+ | 비즈니스 로직 핵심 |
| Application | 80%+ | UseCase 흐름 |
| Infrastructure | 70%+ | 어댑터 통합 |
| Presentation | 70%+ | API 계약 |

## 테스트 규칙
- Kotest BehaviorSpec (Given/When/Then)
- MockK (no Mockito)
- 파일명: `{ClassName}Test.kt`
- Domain 테스트에 Spring 의존성 금지
