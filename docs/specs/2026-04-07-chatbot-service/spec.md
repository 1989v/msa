# Spec — Chatbot Service

> **Status**: Draft
> **Date**: 2026-04-07
> **Module**: `chatbot:domain`, `chatbot:app`

---

## 1. Overview

MSA Commerce Platform의 문서/정책/아키텍처에 대해 대화형으로 답변하는 AI 챗봇 서비스.
Claude Sonnet API를 기반으로 하며, 채널 추상화를 통해 Slack·웹 채팅 등 다양한 인터페이스를 지원한다.

### 핵심 설계 원칙

1. **채널 추상화**: 메시징 채널을 포트로 추상화, 구현체(Slack/Web/etc)는 어댑터
2. **지식 소스 추상화**: 문서 조회를 포트로 추상화, 1차 파일시스템 → ES 확장 가능
3. **Clean Architecture**: domain 레이어에 프레임워크 의존 없음
4. **Public-only 정책**: 외부 사용자에게는 public repo 정보만 제공

---

## 2. Domain Model

### 2.1 Aggregates

```
Conversation (Aggregate Root)
├── id: ConversationId (value object)
├── channelType: ChannelType (SLACK, WEB, API)
├── externalChannelId: String (Slack channel ID, web session ID 등)
├── userId: UserId
├── userRole: UserRole (INTERNAL, EXTERNAL)
├── status: ConversationStatus (ACTIVE, CLOSED, EXPIRED)
├── messages: List<Message>
├── createdAt: Instant
├── lastActiveAt: Instant
└── metadata: Map<String, String>

Message (Entity, Conversation 내부)
├── id: MessageId
├── role: MessageRole (USER, ASSISTANT, SYSTEM)
├── content: String
├── tokenCount: Int
├── costUsd: BigDecimal? (ASSISTANT만)
├── createdAt: Instant
└── metadata: Map<String, String>
```

### 2.2 Value Objects

```kotlin
data class ConversationId(val value: Long)
data class MessageId(val value: Long)
data class UserId(val value: String)

enum class ChannelType { SLACK, WEB, API }
enum class UserRole { INTERNAL, EXTERNAL }
enum class ConversationStatus { ACTIVE, CLOSED, EXPIRED }
enum class MessageRole { USER, ASSISTANT, SYSTEM }
```

### 2.3 Domain Service

```kotlin
class ConversationDomainService {
    fun buildContextWindow(conversation: Conversation, maxTokens: Int): List<Message>
    fun validateAccess(userRole: UserRole, query: String): AccessDecision
    fun estimateTokenCount(text: String): Int
}
```

- `buildContextWindow`: 최근 메시지에서 maxTokens 이내로 컨텍스트 윈도우 구성
- `validateAccess`: 외부 사용자의 질문이 public 범위인지 검증

---

## 3. Port & Adapter Design

### 3.1 Inbound Ports (Application Layer)

```kotlin
// 질문-답변 핵심 유스케이스
interface AskQuestionUseCase {
    suspend fun execute(command: AskQuestionCommand): AskQuestionResult
}

data class AskQuestionCommand(
    val conversationId: ConversationId?,  // null이면 새 대화 시작
    val channelType: ChannelType,
    val externalChannelId: String,
    val userId: UserId,
    val userRole: UserRole,
    val question: String
)

data class AskQuestionResult(
    val conversationId: ConversationId,
    val answer: String,
    val tokenCount: Int,
    val costUsd: BigDecimal
)

// 대화 관리
interface GetConversationUseCase {
    fun execute(command: GetConversationCommand): Conversation?
}

interface CloseConversationUseCase {
    fun execute(command: CloseConversationCommand)
}
```

### 3.2 Outbound Ports (Domain/Application Layer)

```kotlin
// 대화 저장소
interface ConversationRepositoryPort {
    fun save(conversation: Conversation): Conversation
    fun findById(id: ConversationId): Conversation?
    fun findByExternalChannelId(channelType: ChannelType, externalChannelId: String): Conversation?
}

// AI 모델 호출
interface AiModelPort {
    suspend fun generateAnswer(request: AiModelRequest): AiModelResponse
}

data class AiModelRequest(
    val systemPrompt: String,
    val conversationHistory: List<Message>,
    val userQuestion: String,
    val maxTokens: Int,
    val model: String = "claude-sonnet-4-6"
)

data class AiModelResponse(
    val answer: String,
    val inputTokens: Int,
    val outputTokens: Int,
    val costUsd: BigDecimal
)

// 지식 소스
interface KnowledgeSourcePort {
    fun search(query: String, maxResults: Int = 5): List<KnowledgeChunk>
    fun getCategories(): List<String>
}

data class KnowledgeChunk(
    val title: String,
    val content: String,
    val source: String,      // 파일 경로 또는 URL
    val category: String,    // architecture, adr, standard, guide
    val relevanceScore: Float
)

// 채널 메시지 발송 (비동기 응답용)
interface ChannelNotificationPort {
    suspend fun sendMessage(channelType: ChannelType, externalChannelId: String, message: String)
    suspend fun sendTypingIndicator(channelType: ChannelType, externalChannelId: String)
}
```

### 3.3 Adapters (Infrastructure Layer)

| Port | Adapter | 설명 |
|------|---------|------|
| `ConversationRepositoryPort` | `ConversationJpaAdapter` | MySQL JPA 저장 |
| `AiModelPort` | `ClaudeApiAdapter` | Anthropic SDK 직접 호출 |
| `KnowledgeSourcePort` | `FileSystemKnowledgeAdapter` | docs/ 파일 직접 읽기 (1차) |
| `KnowledgeSourcePort` | `ElasticsearchKnowledgeAdapter` | ES 인덱스 검색 (2차 확장) |
| `ChannelNotificationPort` | `SlackNotificationAdapter` | Slack API 메시지 발송 |
| `ChannelNotificationPort` | `WebSocketNotificationAdapter` | WebSocket 푸시 |

---

## 4. Application Layer

### 4.1 AskQuestionService (UseCase 구현)

```
Flow:
1. conversationId 있으면 조회, 없으면 새 Conversation 생성
2. 사용자 메시지를 Conversation에 추가
3. ConversationDomainService.validateAccess() — 외부 사용자 접근 검증
4. ConversationDomainService.buildContextWindow() — 최근 대화 컨텍스트 구성
5. KnowledgeSourcePort.search(question) — 관련 문서 검색
6. PromptBuilder.build() — 시스템 프롬프트 + 문서 컨텍스트 + 대화 이력 조합
7. AiModelPort.generateAnswer() — Claude API 호출
8. 응답 Message를 Conversation에 추가, 저장
9. AskQuestionResult 반환
```

### 4.2 PromptBuilder

```
System Prompt 구조:
┌─────────────────────────────────────┐
│ Base Instruction                     │
│ (역할, 응답 규칙, 제약사항)           │
├─────────────────────────────────────┤
│ User Context                         │
│ (userRole, 접근 권한 범위)            │
├─────────────────────────────────────┤
│ <reference_data>                     │
│   Knowledge chunks from docs/        │
│ </reference_data>                    │
├─────────────────────────────────────┤
│ Conversation History (context window)│
└─────────────────────────────────────┘
```

- 시스템 프롬프트 상한: **60,000 chars**
- 문서 컨텍스트 최소 보장: **2,000 chars**
- 외부 사용자 프롬프트에는 "public repo 정보만 답변" 제약 주입

### 4.3 비용 제어

```kotlin
data class CostConfig(
    val maxBudgetPerRequest: BigDecimal = BigDecimal("0.50"),  // 요청당 최대
    val maxBudgetPerDay: BigDecimal = BigDecimal("50.00"),     // 일간 최대
    val model: String = "claude-sonnet-4-6"
)
```

---

## 5. Presentation Layer

### 5.1 REST API (웹 채팅)

```
POST   /api/v1/chat/conversations              — 새 대화 시작
POST   /api/v1/chat/conversations/{id}/messages — 메시지 전송
GET    /api/v1/chat/conversations/{id}          — 대화 조회
DELETE /api/v1/chat/conversations/{id}          — 대화 종료
GET    /api/v1/chat/conversations/{id}/messages — 메시지 이력 조회
```

응답 포맷: 기존 `ApiResponse<T>` 준수.

### 5.2 WebSocket (실시간 스트리밍)

```
STOMP /ws/chat
├── SUBSCRIBE /topic/conversation/{id}     — 응답 스트리밍 수신
├── SEND      /app/chat/{id}/message       — 메시지 전송
└── SUBSCRIBE /topic/conversation/{id}/typing — 타이핑 인디케이터
```

### 5.3 Slack Webhook

```
POST /api/v1/chat/slack/events     — Slack Event Subscription (challenge 포함)
POST /api/v1/chat/slack/commands   — Slash Command (/chatbot-health)
```

- Slack Webhook 검증: signing secret으로 요청 서명 검증
- 3초 ACK: 즉시 200 응답 후 비동기 처리
- 스레드 컨텍스트: `thread_ts`로 기존 Conversation 매핑

---

## 6. Infrastructure Details

### 6.1 DB Schema (MySQL)

```sql
CREATE TABLE conversation (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_type    VARCHAR(20) NOT NULL,
    external_channel_id VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    user_role       VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata        JSON,
    INDEX idx_external_channel (channel_type, external_channel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status_last_active (status, last_active_at)
);

CREATE TABLE message (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    token_count     INT NOT NULL DEFAULT 0,
    cost_usd        DECIMAL(10, 6),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata        JSON,
    FOREIGN KEY (conversation_id) REFERENCES conversation(id),
    INDEX idx_conversation_created (conversation_id, created_at)
);
```

### 6.2 Claude API Adapter

```kotlin
// Anthropic Java SDK 직접 사용
// 코루틴 전략: Spring MVC + runBlocking 브릿지 (Controller → UseCase)
//   - Controller에서 runBlocking { useCase.execute(cmd) }
//   - UseCase 내부에서 withContext(Dispatchers.IO) { sdk.call() }
//   - 향후 WebFlux 전환 시 runBlocking 제거만으로 마이그레이션 가능
// Retry: 429 (rate limit) → exponential backoff (1s, 2s, 4s, max 3회)
// Timeout: 30초
// 비용 계산: inputTokens * inputPrice + outputTokens * outputPrice
```

### 6.3 FileSystem Knowledge Adapter (1차)

```
문서 카테고리 매핑:
├── architecture → docs/architecture/*.md
├── adr          → docs/adr/ADR-*.md
├── standard     → agent-os/standards/**/*.md
├── guide        → CLAUDE.md, docs/plans/*.md
└── spec         → docs/specs/**/spec.md
```

- 앱 시작 시 모든 문서를 메모리에 로드 (카테고리별 인덱스)
- 질문 키워드 매칭으로 관련 카테고리 문서 선별
- **문서 갱신**: `@Scheduled(fixedDelay = 300_000)` 로 5분마다 파일 변경 감지 후 인메모리 인덱스 갱신. 즉시 반영이 필요하면 `/api/v1/chat/admin/reload` 엔드포인트 호출
- **전환 기준**: 문서 총량 1MB 초과 시 ES 확장 고려

### 6.4 동시성 제어

```kotlin
// Semaphore 기반 — ai-unified-slack-bot 패턴 차용
val aiCallSemaphore = Semaphore(5)  // 최대 동시 Claude API 호출 수

suspend fun callWithLimit(block: suspend () -> T): T {
    return withTimeout(90.seconds) {
        aiCallSemaphore.withPermit {
            withTimeout(30.seconds) { block() }
        }
    }
}
```

---

## 7. Security

### 7.1 인증

| 채널 | 인증 방식 |
|------|----------|
| Web UI | JWT (auth 서비스 연동, Authorization 헤더) |
| Slack | Slack signing secret 검증 + 사용자 ID 매핑 |
| API | API Key (X-API-Key 헤더) |

### 7.2 접근 제어

```
UserRole.INTERNAL → 모든 문서 기반 답변 가능
UserRole.EXTERNAL → public repo 문서만 (private 관련 질문 → "해당 정보는 제공할 수 없습니다")
```

- 프롬프트 인젝션 방어: 사용자 입력을 `<user_message>` 태그로 격리
- 답변에 API Key, 환경변수 등 민감 정보 포함 방지 (시스템 프롬프트에 제약)

### 7.3 사용자별 레이트 리밋

```
- 사용자당 분당 최대 10회 요청 (Bucket4j 또는 인메모리 카운터)
- 일간 최대 100회 (DB 카운팅)
- 초과 시 429 Too Many Requests + 남은 쿨다운 시간 응답
```

---

## 8. Module Structure

```
chatbot/
├── domain/
│   ├── build.gradle.kts          # pure domain, no Spring
│   └── src/main/kotlin/com/kgd/chatbot/
│       ├── domain/
│       │   ├── Conversation.kt
│       │   ├── Message.kt
│       │   ├── ConversationDomainService.kt
│       │   └── vo/               # Value Objects
│       └── exception/
│           └── ChatbotException.kt
├── app/
│   ├── build.gradle.kts          # Spring Boot app
│   └── src/main/kotlin/com/kgd/chatbot/
│       ├── application/
│       │   ├── port/
│       │   │   ├── inbound/      # AskQuestionUseCase 등
│       │   │   └── outbound/     # ConversationRepositoryPort, AiModelPort 등
│       │   ├── service/
│       │   │   └── AskQuestionService.kt
│       │   └── dto/              # Command, Result
│       ├── infrastructure/
│       │   ├── persistence/      # JPA Entities, Adapters
│       │   ├── ai/               # ClaudeApiAdapter
│       │   ├── knowledge/        # FileSystemKnowledgeAdapter
│       │   ├── channel/
│       │   │   ├── slack/        # SlackWebhookAdapter
│       │   │   └── websocket/    # WebSocketAdapter
│       │   └── config/           # Bean configurations
│       ├── presentation/
│       │   ├── rest/             # ChatController
│       │   ├── slack/            # SlackEventController
│       │   └── websocket/        # WebSocketHandler
│       └── ChatbotApplication.kt
```

---

## 9. Configuration

```yaml
# application.yml
chatbot:
  ai:
    model: claude-sonnet-4-6
    max-tokens: 4096
    max-budget-per-request: 0.50
    max-budget-per-day: 50.00
    timeout-seconds: 30
    max-concurrent: 5
  knowledge:
    type: filesystem                # filesystem | elasticsearch
    docs-root: ./docs
    categories:
      architecture: docs/architecture
      adr: docs/adr
      standard: agent-os/standards
      guide: "CLAUDE.md,docs/plans"
    es-upgrade-threshold-bytes: 1048576  # 1MB
  conversation:
    context-window-max-tokens: 10000
    session-timeout-minutes: 60
    max-messages-per-session: 50
  slack:
    signing-secret: ${SLACK_SIGNING_SECRET}
    bot-token: ${SLACK_BOT_TOKEN}
  security:
    public-categories:
      - architecture
      - guide
    internal-only-categories:
      - standard
      - spec
```

---

## 10. Dependencies (신규)

```kotlin
// chatbot:domain — 최소 의존성
dependencies {
    implementation(project(":common"))
}

// chatbot:app
dependencies {
    implementation(project(":chatbot:domain"))
    implementation(project(":common"))

    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Claude API
    implementation("com.anthropic:anthropic-java:1.x")

    // Slack (Webhook 수신만, SDK 경량)
    // javax.crypto for signing secret verification
    
    // DB
    runtimeOnly("com.mysql:mysql-connector-j")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")
}
```

---

## 11. 확장 로드맵

| Phase | 내용 | 트리거 |
|-------|------|--------|
| 1차 | 문서 기반 답변 + Slack + Web UI | 초기 릴리스 |
| 2차 | ES 인덱싱 전환 | 문서 1MB 초과 |
| 3차 | 코드베이스 탐색 (GitHub API) | 비용 검토 후 |
| 4차 | 추가 채널 (Discord, Teams) | 수요 발생 시 |
| 5차 | 관리자 대시보드 (비용, 사용량) | 운영 안정화 후 |
