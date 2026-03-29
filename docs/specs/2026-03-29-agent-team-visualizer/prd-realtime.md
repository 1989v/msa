# PRD: Agent Viewer — Real-time Agent Visualization Service

## 개요

Claude Code 에이전트 팀의 활동을 실시간으로 시각화하는 독립 서비스 도메인.
Claude Code의 공식 HTTP Hook을 통해 에이전트 라이프사이클 이벤트를 수신하고,
WebSocket으로 프론트엔드에 실시간 브로드캐스트한다.

## 서비스 구조

```
agent-viewer/                 ← 하나의 서비스 도메인
├── api/                      ← Spring Boot 백엔드
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/kgd/agentviewer/
│       ├── hook/             ← Claude Code Hook 수신 (REST)
│       ├── websocket/        ← WebSocket 브로드캐스트
│       ├── model/            ← 도메인 모델
│       └── store/            ← 인메모리 상태 저장소
└── front/                    ← React 프론트엔드 (기존 front/ 이동)
    ├── package.json
    └── src/
```

## 데이터 흐름

```
Claude Code Session
  ↓ (HTTP POST - Hook events)
agent-viewer/api (Spring Boot :8090)
  ├── POST /hooks/session-start
  ├── POST /hooks/session-end
  ├── POST /hooks/subagent-start
  ├── POST /hooks/subagent-stop
  ├── POST /hooks/task-created
  ├── POST /hooks/task-completed
  ↓ (WebSocket broadcast)
agent-viewer/front (Vite :5175)
  └── ws://localhost:8090/ws/events
```

## API 엔드포인트

### Hook 수신 API (Claude Code → Backend)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/hooks/session-start` | 세션 시작 이벤트 수신 |
| POST | `/hooks/session-end` | 세션 종료 이벤트 수신 |
| POST | `/hooks/subagent-start` | 에이전트 스폰 이벤트 수신 |
| POST | `/hooks/subagent-stop` | 에이전트 완료 이벤트 수신 |
| POST | `/hooks/task-created` | 태스크 생성 이벤트 수신 |
| POST | `/hooks/task-completed` | 태스크 완료 이벤트 수신 |

### 상태 조회 API (Frontend → Backend)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/state` | 현재 전체 상태 스냅샷 |
| GET | `/api/sessions` | 활성 세션 목록 |
| GET | `/api/agents` | 활성 에이전트 목록 |

### WebSocket

| Path | 설명 |
|------|------|
| `ws://localhost:8090/ws/events` | 실시간 이벤트 스트림 |

## WebSocket 이벤트 형식

```json
{
  "type": "SUBAGENT_START",
  "timestamp": 1743300000000,
  "data": {
    "sessionId": "abc123",
    "agentId": "agent-def456",
    "agentType": "Explore"
  }
}
```

이벤트 타입: `SESSION_START`, `SESSION_END`, `SUBAGENT_START`, `SUBAGENT_STOP`, `TASK_CREATED`, `TASK_COMPLETED`, `STATE_SNAPSHOT`

## Claude Code Hook 설정

`.claude/settings.local.json`에 추가:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "http", "url": "http://localhost:8090/hooks/session-start" }] }],
    "SessionEnd": [{ "hooks": [{ "type": "http", "url": "http://localhost:8090/hooks/session-end" }] }],
    "SubagentStart": [{ "hooks": [{ "type": "http", "url": "http://localhost:8090/hooks/subagent-start" }] }],
    "SubagentStop": [{ "hooks": [{ "type": "http", "url": "http://localhost:8090/hooks/subagent-stop" }] }],
    "TaskCreated": [{ "hooks": [{ "type": "http", "url": "http://localhost:8090/hooks/task-created" }] }],
    "TaskCompleted": [{ "hooks": [{ "type": "http", "url": "http://localhost:8090/hooks/task-completed" }] }]
  }
}
```

## 인메모리 상태 모델

- 별도 DB 불필요 — ConcurrentHashMap 기반 인메모리 저장
- 서버 재시작 시 상태 리셋 (실시간 모니터링 도구이므로 영속성 불필요)
- 세션/에이전트/태스크를 세션ID로 그루핑

## 기술 스택

### Backend (api/)
- Kotlin + Spring Boot 4.0.4
- Spring WebSocket (STOMP 없이 raw WebSocket)
- Jackson JSON
- 포트: 8090

### Frontend (front/)
- 기존 React+Vite+TypeScript (front/에서 이동)
- WebSocket 클라이언트 추가
- 정적 JSON fallback 유지 (백엔드 미실행 시)

## Out of Scope (1차)
- 이벤트 영속 저장 (DB/파일)
- 인증/보안 (로컬 전용)
- 다중 프로젝트 지원
- OpenTelemetry 연동
