# Task Breakdown: Agent Viewer Real-time Service

## Overview

Claude Code HTTP Hook으로 에이전트 이벤트를 수신하는 Spring Boot 백엔드(agent-viewer/api/)와
WebSocket 실시간 브로드캐스트를 프론트엔드(agent-viewer/front/)에 연동하는 서비스 도메인 구축.

Total Task Groups: 6
Estimated Effort: Medium (백엔드 신규 + 프론트 WebSocket 연동 + 디렉토리 재편)

---

## Task List

### Task Group 1: 디렉토리 구조 재편 및 Gradle 서브모듈 생성
**Dependencies:** None
**Phase:** setup
**Required Skills:** gradle, project-structure, git

- [ ] 1.0 Complete agent-viewer/ 디렉토리 구조 확립 및 빌드 성공
  - [ ] 1.1 `front/` 디렉토리를 `agent-viewer/front/`로 이동 (git mv)
  - [ ] 1.2 `agent-viewer/api/` 디렉토리 생성 및 Spring Boot Kotlin 프로젝트 구조 셋업:
    ```
    agent-viewer/api/
    ├── build.gradle.kts
    └── src/main/kotlin/com/kgd/agentviewer/
        ├── AgentViewerApplication.kt
        ├── hook/
        ├── websocket/
        ├── model/
        └── store/
    ```
  - [ ] 1.3 `agent-viewer/api/build.gradle.kts` 작성:
    - Version Catalog 참조 (spring-boot-starter-web, spring-boot-starter-websocket, jackson)
    - Java 25 toolchain, Kotlin 2.2.21
    - bootJar archiveBaseName = "agent-viewer"
    - 포트 8090 설정 (application.yml)
  - [ ] 1.4 `gradle/libs.versions.toml`에 spring-boot-starter-websocket 라이브러리 추가
  - [ ] 1.5 `settings.gradle.kts`에 `agent-viewer:api` include 추가
  - [ ] 1.6 `agent-viewer/front/vite.config.ts` 업데이트: API 프록시를 localhost:8090으로 설정
  - [ ] 1.7 Verify: `./gradlew :agent-viewer:api:build` 성공 및 `cd agent-viewer/front && pnpm dev` 정상 기동

**Acceptance Criteria:**
- `agent-viewer/front/`에서 기존 프론트엔드 정상 동작 (pnpm dev)
- `agent-viewer/api/`가 Gradle 서브모듈로 빌드 성공
- `./gradlew build` 전체 빌드 시 agent-viewer:api 포함
- Spring Boot 앱이 포트 8090에서 기동

---

### Task Group 2: 백엔드 도메인 모델 및 인메모리 StateStore
**Dependencies:** Task Group 1
**Phase:** core
**Required Skills:** kotlin, domain-modeling, concurrency

- [ ] 2.0 Complete 도메인 모델 정의 및 ConcurrentHashMap 기반 StateStore 구현
  - [ ] 2.1 Write 5 focused tests (Kotest BehaviorSpec + 순수 단위 테스트):
    - AgentSession 생성 및 상태 변경
    - SubagentInfo 생성 및 세션 연관
    - TaskInfo 생성/완료 상태 전환
    - StateStore: 세션 추가/조회/제거
    - StateStore: 전체 스냅샷 반환 정합성
  - [ ] 2.2 도메인 모델 Kotlin data class 정의 (`model/`):
    - `AgentSession` (sessionId, startTime, endTime?, status, subagents, tasks)
    - `SubagentInfo` (agentId, sessionId, agentType, startTime, endTime?, status)
    - `TaskInfo` (taskId, sessionId, agentId?, description, startTime, endTime?, status)
    - `HookEvent` (type: EventType, timestamp, data: Map<String, Any?>)
    - `EventType` enum (SESSION_START, SESSION_END, SUBAGENT_START, SUBAGENT_STOP, TASK_CREATED, TASK_COMPLETED, STATE_SNAPSHOT)
    - `WebSocketEvent` (type: EventType, timestamp, data: Any?)
  - [ ] 2.3 `StateStore` 인터페이스 정의 (`store/StateStore.kt`):
    - startSession, endSession
    - addSubagent, removeSubagent
    - createTask, completeTask
    - getSession, getAllSessions, getActiveAgents
    - getFullSnapshot (전체 상태)
  - [ ] 2.4 `InMemoryStateStore` 구현 (`store/InMemoryStateStore.kt`):
    - ConcurrentHashMap<String, AgentSession> 기반
    - Thread-safe 상태 업데이트
    - @Component 등록
  - [ ] 2.5 Verify: `./gradlew :agent-viewer:api:test` 실행 시 StateStore 테스트 5건 전체 통과

**Acceptance Criteria:**
- 6개 도메인 모델 data class 정의 완료
- StateStore 인터페이스 + InMemoryStateStore 구현
- ConcurrentHashMap 기반 thread-safe 동작
- 테스트 5건 통과

---

### Task Group 3: Hook 수신 REST API
**Dependencies:** Task Group 2
**Phase:** core
**Required Skills:** kotlin, spring-web, rest-api, jackson

- [ ] 3.0 Complete 6개 POST Hook 엔드포인트 및 상태 조회 GET API 구현
  - [ ] 3.1 Write 6 focused tests (Kotest BehaviorSpec + MockK):
    - POST /hooks/session-start 수신 시 StateStore.startSession 호출 확인
    - POST /hooks/session-end 수신 시 해당 세션 종료 확인
    - POST /hooks/subagent-start 수신 시 에이전트 추가 확인
    - POST /hooks/subagent-stop 수신 시 에이전트 제거 확인
    - POST /hooks/task-created, task-completed 수신 확인
    - GET /api/state 호출 시 전체 스냅샷 반환 확인
  - [ ] 3.2 Claude Code Hook JSON 파싱 DTO 정의 (`hook/dto/`):
    - `SessionStartPayload` (session_id, cwd, model 등 Claude Code가 보내는 필드)
    - `SessionEndPayload` (session_id)
    - `SubagentStartPayload` (session_id, agent_id, agent_type)
    - `SubagentStopPayload` (session_id, agent_id)
    - `TaskCreatedPayload` (session_id, agent_id?, task_id, description)
    - `TaskCompletedPayload` (session_id, task_id)
    - Jackson @JsonProperty로 snake_case 매핑, 알 수 없는 필드 무시 설정
  - [ ] 3.3 Hook 수신 컨트롤러 구현 (`hook/HookController.kt`):
    - 6개 POST 엔드포인트 (/hooks/session-start 등)
    - 각 엔드포인트에서 StateStore 업데이트
    - WebSocket 브로드캐스트 트리거 (Task Group 4에서 연결, 여기서는 이벤트 발행 인터페이스만)
    - 200 OK 반환 (Claude Code Hook은 응답 내용 무시)
  - [ ] 3.4 상태 조회 API 구현 (`hook/StateController.kt`):
    - GET /api/state -> StateStore.getFullSnapshot()
    - GET /api/sessions -> StateStore.getAllSessions()
    - GET /api/agents -> StateStore.getActiveAgents()
  - [ ] 3.5 CORS 설정 (`config/WebConfig.kt`):
    - localhost:5175 (Vite dev) 허용
    - 모든 Hook POST 경로 허용
  - [ ] 3.6 Jackson 글로벌 설정 (`config/JacksonConfig.kt`):
    - FAIL_ON_UNKNOWN_PROPERTIES = false
    - PropertyNamingStrategies.SNAKE_CASE 또는 DTO별 @JsonProperty
  - [ ] 3.7 Verify: `./gradlew :agent-viewer:api:test` 통과 + curl로 POST /hooks/session-start 호출 후 GET /api/state에서 세션 확인

**Acceptance Criteria:**
- 6개 POST Hook 엔드포인트가 Claude Code Hook JSON을 정상 파싱
- GET /api/state, /api/sessions, /api/agents 정상 응답
- CORS 설정으로 프론트엔드 접근 허용
- 알 수 없는 JSON 필드 무시 (Claude Code payload 변경에 유연 대응)
- 테스트 6건 통과

---

### Task Group 4: WebSocket 브로드캐스트
**Dependencies:** Task Group 3
**Phase:** core
**Required Skills:** kotlin, spring-websocket, json-serialization

- [ ] 4.0 Complete Raw WebSocket 핸들러, 연결 관리, 이벤트 브로드캐스트 구현
  - [ ] 4.1 Write 4 focused tests (Kotest BehaviorSpec + MockK):
    - WebSocket 연결 시 세션 등록 확인
    - 연결 해제 시 세션 제거 확인
    - 이벤트 브로드캐스트 시 모든 연결된 세션에 메시지 전송 확인
    - 연결 직후 STATE_SNAPSHOT 이벤트 전송 확인
  - [ ] 4.2 WebSocket 핸들러 구현 (`websocket/AgentWebSocketHandler.kt`):
    - TextWebSocketHandler 상속 (STOMP 없이 raw WebSocket)
    - CopyOnWriteArrayList<WebSocketSession>으로 연결 관리
    - afterConnectionEstablished: 세션 등록 + STATE_SNAPSHOT 전송
    - afterConnectionClosed: 세션 제거
    - handleTextMessage: 클라이언트 메시지 처리 (ping/pong 등)
  - [ ] 4.3 브로드캐스트 서비스 구현 (`websocket/EventBroadcaster.kt`):
    - broadcast(event: WebSocketEvent) 메서드
    - Jackson ObjectMapper로 JSON 직렬화
    - 전체 연결된 WebSocket 세션에 TextMessage 전송
    - 전송 실패 세션 자동 제거 (에러 핸들링)
  - [ ] 4.4 WebSocket 설정 (`config/WebSocketConfig.kt`):
    - WebSocketConfigurer 구현
    - /ws/events 경로 등록
    - setAllowedOrigins("*") (로컬 전용)
  - [ ] 4.5 HookController에 EventBroadcaster 연결:
    - 각 Hook 수신 시 StateStore 업데이트 후 EventBroadcaster.broadcast() 호출
    - 이벤트 타입별 WebSocketEvent 생성
  - [ ] 4.6 Verify: `./gradlew :agent-viewer:api:test` 통과 + wscat으로 ws://localhost:8090/ws/events 연결 후 Hook POST 시 WebSocket 메시지 수신 확인

**Acceptance Criteria:**
- ws://localhost:8090/ws/events 연결 성공
- 연결 직후 STATE_SNAPSHOT 이벤트 수신
- Hook POST 시 해당 이벤트가 WebSocket으로 브로드캐스트
- 다중 클라이언트 연결 시 모두에게 브로드캐스트
- 연결 해제 시 세션 정리
- 테스트 4건 통과

---

### Task Group 5: 프론트엔드 WebSocket 연동
**Dependencies:** Task Group 4, Task Group 2 (from tasks.md - 기존 Zustand 스토어)
**Phase:** feature
**Required Skills:** typescript, react, websocket, zustand

- [ ] 5.0 Complete WebSocket 클라이언트 훅, 실시간 상태 업데이트, fallback 로직 구현
  - [ ] 5.1 Write 4 focused tests:
    - useWebSocket 훅: 연결 상태 관리 (connected/disconnected/reconnecting)
    - WebSocket 메시지 수신 시 Zustand 스토어 업데이트
    - 연결 실패 시 정적 JSON fallback 동작
    - 자동 재연결 로직 (3회 시도, 지수 백오프)
  - [ ] 5.2 WebSocket 이벤트 타입 정의 (`types/websocket.ts`):
    - `WebSocketEventType` enum (SESSION_START, SESSION_END, SUBAGENT_START, SUBAGENT_STOP, TASK_CREATED, TASK_COMPLETED, STATE_SNAPSHOT)
    - `WebSocketMessage<T>` 제네릭 타입 (type, timestamp, data)
    - 각 이벤트별 data 타입 정의
  - [ ] 5.3 useWebSocket 커스텀 훅 구현 (`hooks/useWebSocket.ts`):
    - WebSocket 연결 관리 (connect, disconnect, reconnect)
    - 연결 상태: connected | disconnected | reconnecting
    - 자동 재연결: 3회 시도, 1s/2s/4s 지수 백오프
    - 메시지 수신 시 JSON 파싱 + 이벤트 핸들러 호출
    - 컴포넌트 언마운트 시 cleanup
  - [ ] 5.4 Zustand 스토어 확장 (`store/useAppStore.ts` 수정):
    - WebSocket 이벤트 핸들러 추가:
      - SESSION_START: 새 세션 추가
      - SESSION_END: 세션 상태 업데이트
      - SUBAGENT_START: 에이전트 추가 (agents 배열 + 해당 세션)
      - SUBAGENT_STOP: 에이전트 상태 업데이트
      - TASK_CREATED: 태스크 추가
      - TASK_COMPLETED: 태스크 상태 업데이트
      - STATE_SNAPSHOT: 전체 상태 교체
    - `dataSource: "static" | "websocket"` 상태 추가
    - `connectionStatus: "connected" | "disconnected" | "reconnecting"` 상태 추가
  - [ ] 5.5 데이터 소스 전환 로직 (`utils/dataSource.ts`):
    - VITE_DATA_SOURCE=websocket 시 WebSocket 연결 시도
    - VITE_DATA_SOURCE=static 시 기존 JSON 로드 (기본값)
    - WebSocket 연결 실패 시 자동으로 static fallback
    - 연결 상태 표시 (헤더에 인디케이터 추가)
  - [ ] 5.6 App.tsx 수정: useWebSocket 훅 연결 및 데이터 소스 초기화
  - [ ] 5.7 연결 상태 인디케이터 UI (`components/Layout/ConnectionStatus.tsx`):
    - 헤더 영역에 연결 상태 표시 (green dot=connected, yellow=reconnecting, gray=disconnected)
    - 현재 데이터 소스 표시 (Live / Static)
  - [ ] 5.8 Verify: `VITE_DATA_SOURCE=websocket pnpm dev` 실행 후 백엔드와 WebSocket 연결 확인, Hook POST 시 프론트엔드 실시간 업데이트 확인, 백엔드 미실행 시 static fallback 동작 확인

**Acceptance Criteria:**
- WebSocket 연결 성공 시 실시간 이벤트 수신 및 UI 업데이트
- 연결 실패 시 정적 JSON fallback으로 자동 전환
- 자동 재연결 동작 (최대 3회, 지수 백오프)
- 헤더에 연결 상태 인디케이터 표시
- VITE_DATA_SOURCE 환경변수로 데이터 소스 제어
- 테스트 4건 통과

---

### Task Group 6: Claude Code Hook 설정 및 통합 검증
**Dependencies:** Task Group 5
**Phase:** integration
**Required Skills:** claude-code-config, integration-testing, shell

- [ ] 6.0 Complete Claude Code Hook 설정 및 전체 파이프라인 End-to-End 검증
  - [ ] 6.1 Write 3 focused tests:
    - settings.local.json 파싱 유효성 (JSON schema 검증)
    - 전체 파이프라인 통합: Hook POST -> StateStore -> WebSocket -> 프론트 수신 (백엔드 통합 테스트)
    - 동시 다중 세션 처리 (2개 세션 동시 활성)
  - [ ] 6.2 `.claude/settings.local.json` 생성/업데이트:
    - 6개 Hook 이벤트 등록 (SessionStart, SessionEnd, SubagentStart, SubagentStop, TaskCreated, TaskCompleted)
    - 각 Hook type: "http", url: "http://localhost:8090/hooks/{event}"
    - 기존 settings.local.json이 있으면 hooks 섹션만 merge
  - [ ] 6.3 개발 편의 스크립트 작성 (`agent-viewer/dev.sh`):
    - 백엔드 기동 (./gradlew :agent-viewer:api:bootRun)
    - 프론트엔드 기동 (cd agent-viewer/front && pnpm dev)
    - 동시 실행 (concurrently 또는 background process)
  - [ ] 6.4 Hook 시뮬레이션 스크립트 작성 (`agent-viewer/test-hooks.sh`):
    - curl로 6개 Hook 엔드포인트에 샘플 payload 전송
    - 세션 시작 -> 에이전트 스폰 -> 태스크 생성 -> 태스크 완료 -> 에이전트 종료 -> 세션 종료 시나리오
    - 각 단계 후 GET /api/state로 상태 확인
  - [ ] 6.5 agent-viewer/front/.env.example 업데이트:
    - VITE_DATA_SOURCE=websocket 추가
    - VITE_WS_URL=ws://localhost:8090/ws/events 추가
  - [ ] 6.6 Verify: test-hooks.sh 실행 시 프론트엔드에서 실시간 에이전트 출현/퇴장/태스크 변경 확인, 전체 테스트 `./gradlew :agent-viewer:api:test` 통과

**Acceptance Criteria:**
- .claude/settings.local.json에 6개 Hook 정상 등록
- test-hooks.sh 실행 시 전체 파이프라인 동작 (Hook -> Store -> WebSocket -> Frontend)
- 동시 다중 세션 처리 정상 동작
- 백엔드 전체 테스트 통과 (5 + 6 + 4 + 3 = 18건)
- dev.sh로 백엔드/프론트 동시 기동 성공

---

## Execution Order

1. **Task Group 1** -- 디렉토리 재편 및 Gradle 셋업 (선행 의존 없음)
2. **Task Group 2** -- 도메인 모델 + StateStore (1 완료 후)
3. **Task Group 3** -- Hook REST API (2 완료 후)
4. **Task Group 4** -- WebSocket 브로드캐스트 (3 완료 후)
5. **Task Group 5** -- 프론트엔드 WebSocket 연동 (4 완료 후)
6. **Task Group 6** -- Hook 설정 + 통합 검증 (5 완료 후)

```
[1: 구조 재편] -> [2: 모델+Store] -> [3: Hook API] -> [4: WebSocket] -> [5: FE 연동] -> [6: 통합 검증]
```

순차 의존 체인 -- 각 그룹이 이전 그룹의 산출물에 의존하므로 병렬화 없이 순차 실행.

## Test Summary

| Task Group | Tests | Focus |
|---|---|---|
| 1 | 0 (setup) | 빌드/기동 검증만 |
| 2 | 5 | 도메인 모델, StateStore CRUD, 스냅샷 |
| 3 | 6 | Hook 엔드포인트 6개, 상태 조회 |
| 4 | 4 | WebSocket 연결/해제, 브로드캐스트, 스냅샷 |
| 5 | 4 | WS 훅, 스토어 업데이트, fallback, 재연결 |
| 6 | 3 | 설정 검증, 통합 파이프라인, 동시 세션 |
| **Total** | **22** | |

## Technology Decisions

| 항목 | 선택 | 근거 |
|------|------|------|
| WebSocket | Raw TextWebSocketHandler | PRD 명시 (STOMP 없이) |
| 저장소 | ConcurrentHashMap | 인메모리, 재시작 시 리셋 (PRD 명시) |
| 직렬화 | Jackson | Spring Boot 기본, snake_case 매핑 |
| WS 연결 관리 | CopyOnWriteArrayList | 낮은 동시성 + 읽기 빈번 패턴에 적합 |
| 프론트 상태 | Zustand 확장 | 기존 스토어 활용, WebSocket 이벤트 핸들러 추가 |
| 데이터 소스 전환 | VITE_DATA_SOURCE 환경변수 | 정적 JSON fallback 유지 (PRD 명시) |

## File Impact Summary

### New Files (Backend)
- `agent-viewer/api/build.gradle.kts`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/AgentViewerApplication.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/model/*.kt` (6 files)
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/store/StateStore.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/store/InMemoryStateStore.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/hook/HookController.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/hook/StateController.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/hook/dto/*.kt` (6 files)
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/websocket/AgentWebSocketHandler.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/websocket/EventBroadcaster.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/WebConfig.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/WebSocketConfig.kt`
- `agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/JacksonConfig.kt`
- `agent-viewer/api/src/main/resources/application.yml`
- `agent-viewer/api/src/test/kotlin/com/kgd/agentviewer/**/*Test.kt`
- `agent-viewer/dev.sh`
- `agent-viewer/test-hooks.sh`

### New Files (Frontend)
- `agent-viewer/front/src/types/websocket.ts`
- `agent-viewer/front/src/hooks/useWebSocket.ts`
- `agent-viewer/front/src/utils/dataSource.ts`
- `agent-viewer/front/src/components/Layout/ConnectionStatus.tsx`

### Modified Files
- `settings.gradle.kts` (add agent-viewer:api)
- `gradle/libs.versions.toml` (add spring-boot-starter-websocket)
- `agent-viewer/front/vite.config.ts` (API proxy)
- `agent-viewer/front/src/store/useAppStore.ts` (WebSocket event handlers)
- `agent-viewer/front/src/App.tsx` (useWebSocket integration)
- `agent-viewer/front/.env.example` (WS config)
- `.claude/settings.local.json` (Hook registration)

### Moved Files
- `front/` -> `agent-viewer/front/` (git mv)
