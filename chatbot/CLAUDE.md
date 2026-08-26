# Chatbot Service

플랫폼 문서/정책/아키텍처에 대해 대화형으로 답하는 서비스 (ADR-0052). Anthropic SDK 를 **직접** 쓴다
(Spring AI 아님 — 프롬프트 조합·토큰 상한·비용 제어를 직접 쥐기 위해).

## Modules

| Gradle path | 역할 |
|---|---|
| `:chatbot:domain` | Pure Kotlin 도메인 — `Conversation`, `Message`, `AccessDecision` |
| `:chatbot:app` | Spring Boot 앱 (port 8086) — REST + WebSocket + Slack 이벤트 |

## Commands

```bash
./gradlew :chatbot:domain:test
./gradlew :chatbot:app:build
```

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 3(`AskQuestion`/`GetConversation`/`CloseConversation`), Port 4
(`AiModelPort` / `ChannelNotificationPort` / `ConversationRepositoryPort` / `KnowledgeSourcePort`), adapter 5
(Claude / Slack / WebSocket / FileSystemKnowledge / ConversationRepository).
부채: `config/` 가 `infrastructure/config` 가 아니라 최상위에 있다 (플랜 P4) · **`app` 에 테스트 소스셋이 없다** (P6).

## Key Rules

- **채널은 포트 뒤에 있다** — REST/WebSocket/Slack 이 같은 `ChatService` 를 탄다. 새 채널은 `ChannelNotificationPort`
  구현 하나로 붙인다
- 지식원은 `KnowledgeSourcePort` (현재 파일시스템 문서). 시스템 프롬프트에 문서 컨텍스트를 동적으로 주입하는
  `PromptBuilder` 가 핵심이고, 토큰 상한은 `ChatbotProperties` 가 쥔다
- 외부 호출(Claude API·Slack)은 트랜잭션 밖 (`docs/conventions/transactional-usage.md`)
- 공개 범위는 `AccessDecision` 이 판정 — public repo 범위 밖 문서를 답에 섞지 않는다

## API

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/chat/conversations` | 대화 시작 |
| POST | `/api/v1/chat/conversations/{id}/messages` | 질문 |
| GET | `/api/v1/chat/conversations/{id}` · `/messages` | 대화/메시지 조회 |
| POST | `/api/v1/chat/slack/events` | Slack 이벤트 수신 |
| POST | `/api/v1/chat/admin/reload` | 지식원 재적재 (ADMIN) |

## Docs

- 용어: `chatbot/glossary.md` · ADR: `docs/adr/ADR-0052-chatbot-service.md`
