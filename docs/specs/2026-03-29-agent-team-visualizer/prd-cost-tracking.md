# PRD: Agent Viewer — 작업/비용 트래킹 확장

## 개요

현재 agent-viewer에 에이전트 작업 내역 및 비용 추적 기능을 추가한다.
Paperclip의 `cost_events` 이벤트 소싱 모델과 Claude Code의 OpenTelemetry를 참고하되,
외부 DB 없이 인메모리 + 파일 기반으로 경량 구현한다.

## 참고: Paperclip 핵심 패턴

Paperclip은 다음과 같은 방식으로 비용을 추적한다:
- **이벤트 소싱**: 모든 API 호출을 `cost_events` 테이블에 기록 (토큰 수, 비용, 모델명)
- **센트 단위 정수 저장**: 부동소수점 오류 방지 ($1.23 → 123)
- **3계층 예산**: 회사 → 에이전트 → 프로젝트 각각 월간 예산 설정
- **어댑터 패턴**: claude-local, codex-local 등 도구별 어댑터가 비용 이벤트를 리포트
- **월간 스냅샷 캐싱**: 비용 집계를 캐시하여 대시보드 성능 확보

## 구현 범위

### Phase 1: 세션 파일 기반 비용 추출 (DB 불필요)

Claude Code의 세션 JSONL 파일에는 API 호출 정보가 포함되어 있다:
```jsonl
{"type":"summary","costUSD":0.0234,"inputTokens":1200,"outputTokens":450,"model":"claude-opus-4-6"}
```

이 정보를 스캐너가 파싱하여 비용/토큰을 집계한다.

### Phase 2: OpenTelemetry 연동 (선택)

Claude Code의 OTEL 메트릭을 수신하여 실시간 비용 추적:
```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8090
```

→ Phase 2는 이번 스코프 밖. Phase 1만 구현.

---

## 데이터 모델

### CostEvent (인메모리)

```kotlin
data class CostEvent(
    val id: String,
    val sessionId: String,
    val tool: AiTool,            // CLAUDE, CODEX, etc.
    val model: String,           // "claude-opus-4-6"
    val inputTokens: Long,
    val outputTokens: Long,
    val cacheReadTokens: Long,
    val cacheWriteTokens: Long,
    val costCents: Int,          // 센트 단위 정수 (Paperclip 패턴)
    val timestamp: Instant,
    val projectName: String
)
```

### SessionCost (집계)

```kotlin
data class SessionCost(
    val sessionId: String,
    val tool: AiTool,
    val projectName: String,
    val totalInputTokens: Long,
    val totalOutputTokens: Long,
    val totalCostCents: Int,
    val modelBreakdown: Map<String, ModelUsage>,
    val lastUpdated: Instant
)

data class ModelUsage(
    val model: String,
    val inputTokens: Long,
    val outputTokens: Long,
    val costCents: Int,
    val callCount: Int
)
```

---

## 백엔드 변경

### 1. ClaudeScanner 확장

JSONL 파일에서 비용 정보 파싱:
- `type: "summary"` 라인에서 `costUSD`, `inputTokens`, `outputTokens`, `model` 추출
- `ScannedSession`에 `costCents`, `totalTokens`, `model` 필드 추가

### 2. CostStore (인메모리)

```kotlin
@Component
class CostStore {
    private val events = ConcurrentLinkedQueue<CostEvent>()

    fun addEvent(event: CostEvent)
    fun getSessionCost(sessionId: String): SessionCost
    fun getTotalCost(since: Instant): Int  // 센트
    fun getCostByTool(): Map<AiTool, Int>
    fun getCostByModel(): Map<String, Int>
}
```

### 3. API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/costs` | 전체 비용 요약 |
| GET | `/api/costs/sessions` | 세션별 비용 목록 |
| GET | `/api/costs/tools` | 도구별 비용 집계 |

### 4. WebSocket 이벤트

```json
{
  "type": "COST_UPDATE",
  "data": {
    "sessionId": "...",
    "totalCostCents": 234,
    "totalTokens": 15000,
    "model": "claude-opus-4-6"
  }
}
```

---

## 프론트엔드 변경

### 1. 헤더에 총 비용 표시

```
Agent Team Visualizer  🟢 Live  |  20 Agents  4 Working  💰 $12.34
```

### 2. 세션 카드에 비용 표시

각 세션 카드 하단에:
```
📊 12,500 tokens  |  💰 $0.23  |  claude-opus-4-6
```

### 3. 비용 대시보드 (새 뷰)

사이드바에 "Costs" 탭 추가:
- 도구별 비용 파이차트
- 모델별 비용 바차트
- 시간대별 비용 추이
- 세션별 비용 리스트 (정렬 가능)

---

## ScannedSession 확장

```kotlin
data class ScannedSession(
    // ... 기존 필드
    val costCents: Int?,             // 추가
    val totalInputTokens: Long?,     // 추가
    val totalOutputTokens: Long?,    // 추가
    val model: String?               // 추가
)
```

---

## Out of Scope

- PostgreSQL 영속 저장 (인메모리만)
- 예산 설정/알림 (Paperclip의 예산 시행)
- 에이전트 생성/관리 (Paperclip의 오케스트레이션)
- OpenTelemetry 수신 (Phase 2)
- Codex/Gemini 비용 파싱 (세션 파일 포맷 상이, 추후)

---

## 기술 결정

| 결정 | 이유 |
|------|------|
| 인메모리 (DB 없음) | 경량화, 서버 재시작 시 JSONL 재스캔으로 복구 |
| 센트 단위 정수 | Paperclip 검증된 패턴, 부동소수점 오류 방지 |
| 세션 파일 파싱 | Hook으로는 비용 데이터 안 옴, 파일 직접 읽기 필수 |
| Phase 1만 | OTEL 연동은 환경 설정 부담, 파일 파싱으로 충분 |
