# Paperclip - AI Company Orchestration Platform 분석

> **Repository**: https://github.com/paperclipai/paperclip
> **License**: MIT
> **Stars**: 41.2k+
> **Tagline**: "Open-source orchestration for zero-human companies"
> **분석일**: 2026-03-31

---

## 1. 프로젝트 개요

Paperclip은 여러 AI 에이전트를 하나의 "회사" 조직으로 편성하여 자율 운영하는 오케스트레이션 플랫폼이다.
핵심 컨셉은 **"If OpenClaw is an employee, Paperclip is the company"** -- 개별 에이전트 프레임워크가 아니라,
에이전트들이 일하는 **조직 미들웨어**를 제공한다.

### 핵심 가치

| 기존 방식 | Paperclip 방식 |
|-----------|---------------|
| 20개 터미널에서 Claude Code 세션을 수동 관리 | 티켓 기반 작업 관리, 세션 자동 유지 |
| 에이전트별 비용 추적 불가 | 에이전트/프로젝트/프로바이더별 비용 대시보드 |
| 반복 작업 수동 실행 | Heartbeat 스케줄링으로 24/7 자율 운영 |
| 에이전트 간 컨텍스트 공유 어려움 | Goal Alignment으로 미션부터 작업까지 계층적 컨텍스트 |
| 비용 폭주 통제 불가 | 에이전트별 월간 예산 + 자동 중지 |

---

## 2. 아키텍처 및 기술 스택

### 2.1 전체 구조

```
paperclip/
├── cli/                    # CLI 도구 (npx paperclipai onboard)
├── server/                 # Node.js 백엔드 (Express)
│   └── src/
│       ├── routes/         # REST API 엔드포인트
│       ├── services/       # 비즈니스 로직 (60+ 서비스 파일)
│       ├── middleware/     # 인증, 로깅
│       ├── adapters/       # 서버사이드 어댑터 로직
│       ├── realtime/       # SSE/WebSocket 이벤트
│       └── storage/        # 파일 저장소
├── ui/                     # React 프론트엔드 (Vite)
│   └── src/
│       ├── pages/          # 40+ 페이지 컴포넌트
│       ├── components/     # 재사용 UI 컴포넌트
│       ├── api/            # API 클라이언트
│       └── hooks/          # React Query 훅
├── packages/
│   ├── db/                 # Drizzle ORM 스키마 + 마이그레이션
│   ├── adapters/           # 에이전트 런타임 어댑터
│   │   ├── claude-local/   # Claude Code 어댑터
│   │   ├── codex-local/    # OpenAI Codex 어댑터
│   │   ├── cursor-local/   # Cursor 어댑터
│   │   ├── gemini-local/   # Gemini 어댑터
│   │   ├── openclaw-gateway/ # OpenClaw 어댑터
│   │   ├── opencode-local/ # OpenCode 어댑터
│   │   └── pi-local/       # Pi 어댑터
│   ├── adapter-utils/      # 어댑터 공통 유틸리티
│   ├── shared/             # 공유 타입/상수
│   └── plugins/            # 플러그인 시스템
├── skills/                 # 에이전트 스킬 정의
├── evals/                  # 평가 프레임워크
└── docs/                   # 문서
```

### 2.2 기술 스택

| 영역 | 기술 |
|------|------|
| **Runtime** | Node.js 20+ |
| **Language** | TypeScript (전체) |
| **Backend** | Express.js |
| **Frontend** | React + Vite |
| **ORM** | Drizzle ORM |
| **Database** | PostgreSQL (내장 embedded-postgres 또는 외부) |
| **패키지 관리** | pnpm 9.15+ (모노레포 워크스페이스) |
| **테스트** | Vitest + Playwright (E2E) |
| **빌드** | esbuild |
| **상태 관리 (UI)** | TanStack React Query |
| **실시간 통신** | SSE (Server-Sent Events) |

### 2.3 모노레포 구조

pnpm workspace로 관리되는 패키지 구조:

```yaml
# pnpm-workspace.yaml (추정)
packages:
  - cli
  - server
  - ui
  - packages/*
  - packages/adapters/*
```

핵심 패키지 의존 관계:

```
server ──→ @paperclipai/db
       ──→ @paperclipai/shared
       ──→ @paperclipai/adapter-utils
       ──→ @paperclipai/adapters/*

ui     ──→ (REST API 호출, 직접 의존 없음)

adapters/* ──→ @paperclipai/adapter-utils
           ──→ @paperclipai/shared
```

---

## 3. 에이전트 활동 및 비용 추적

### 3.1 비용 이벤트 데이터 모델

비용 추적의 핵심은 `cost_events` 테이블이다:

```typescript
// packages/db/src/schema/cost_events.ts (Drizzle ORM)
costEvents = pgTable("cost_events", {
  id:                uuid().primaryKey(),
  companyId:         uuid().notNull(),      // 회사 스코프
  agentId:           uuid().notNull(),      // 어떤 에이전트가
  issueId:           uuid(),                // 어떤 작업에서
  projectId:         uuid(),                // 어떤 프로젝트에서
  goalId:            uuid(),                // 어떤 목표를 위해
  heartbeatRunId:    uuid(),                // 어떤 실행에서

  // 프로바이더 정보
  provider:          text().notNull(),      // "anthropic", "openai" 등
  model:             text().notNull(),      // "claude-opus-4-6" 등
  biller:            text(),                // 과금 주체
  billingType:       text(),                // "metered_api" | "subscription_included" 등
  billingCode:       text(),                // 참조 코드

  // 토큰 사용량
  inputTokens:       integer().notNull(),
  outputTokens:      integer().notNull(),
  cachedInputTokens: integer(),             // 캐시된 입력 토큰 별도 추적

  // 비용
  costCents:         integer().notNull(),   // 센트 단위 비용

  // 시간
  occurredAt:        timestamp({ withTimezone: true }),
  createdAt:         timestamp({ withTimezone: true }),
});
```

**인덱스 설계**: company + occurredAt 기반 복합 인덱스 5개로 시계열 비용 조회 최적화.

### 3.2 비용 서비스 (costs.ts) 분석

`costService`는 다차원 비용 분석을 제공한다:

```
costService(db)
├── createEvent()         # 비용 이벤트 기록 + 월간 합계 갱신
├── summary()             # 회사 전체 비용 요약 (사용률 % 포함)
├── byAgent()             # 에이전트별 비용 분석
├── byProvider()          # 프로바이더별 비용 분석
├── byBiller()            # 과금 주체별 분석
├── byProject()           # 프로젝트별 비용 분석
├── byAgentModel()        # 에이전트 x 모델 교차 분석
└── windowSpend()         # 시간 윈도우별 지출 (5h, 24h, 7d)
```

**비용 이벤트 생성 흐름**:

```
어댑터에서 Claude/Codex 실행 완료
  → 토큰 사용량 + 비용(USD→cents 변환) 파싱
  → costService.createEvent() 호출
    → DB에 cost_event INSERT
    → 해당 에이전트의 spentMonthlyCents 재계산 (SUM)
    → 해당 회사의 spentMonthlyCents 재계산 (SUM)
    → budgets.evaluateCostEvent() 호출 → 예산 초과 체크
```

### 3.3 예산 관리 시스템 (budgets.ts)

예산은 3단계 계층으로 적용된다:

```
Company Budget (전사 월간 예산)
  └── Agent Budget (에이전트별 월간 예산)
      └── Project Budget (프로젝트별 예산)
```

**예산 정책 (Budget Policies)**:

| 필드 | 설명 |
|------|------|
| `scopeType` | `company` / `agent` / `project` |
| `scopeId` | 대상 엔티티 ID |
| `limitCents` | 예산 한도 (센트) |
| `windowType` | `calendar_month_utc` / `lifetime` |
| `warnThresholdPct` | 경고 임계값 (예: 80%) |
| `hardThresholdPct` | 강제 중지 임계값 (예: 100%) |

**예산 시행 흐름**:

```
비용 이벤트 발생
  → evaluateCostEvent()
    → 관련 모든 정책 조회 (회사/에이전트/프로젝트 레벨)
    → 현재 윈도우 지출 합계 계산
    → 임계값 비교
      ├── warnThreshold 초과 → 소프트 인시던트 생성 (경고)
      └── hardThreshold 초과 → 하드 인시던트 생성
            → 에이전트 pauseAndCancel 실행
            → 승인 요청 (Approval) 생성
            → 보드(관리자) 승인 시 예산 증액 또는 재개
```

**Atomic Budget Enforcement**: 작업 체크아웃과 예산 확인이 원자적으로 수행된다.
`getInvocationBlock()`이 에이전트 실행 전에 회사/에이전트/프로젝트 레벨의 예산 정책을
계층적으로 확인하여, 예산 초과 시 실행 자체를 차단한다.

### 3.4 활동 로그 (Activity Log)

모든 에이전트 행동이 감사 로그로 기록된다:

```typescript
interface LogActivityInput {
  companyId: string;
  actorType: "agent" | "user" | "system";
  actorId: string;
  action: string;          // "created", "updated", "assigned" 등
  entityType: string;      // "issue", "agent", "goal" 등
  entityId: string;
  agentId?: string;
  runId?: string;          // Heartbeat 실행 ID
  details?: Record<string, unknown>;
}
```

활동 로그는 플러그인 이벤트 버스와도 연동되어 외부 시스템(Slack, webhook 등)으로 전파 가능하다.

---

## 4. 에이전트 관리 및 생성

### 4.1 에이전트 데이터 모델

```typescript
agents = pgTable("agents", {
  id:                uuid().primaryKey(),
  companyId:         uuid().notNull(),        // 소속 회사
  name:              text().notNull(),         // 이름
  role:              text(),                   // 역할 (CEO, CTO, Engineer 등)
  status:            text().default("idle"),   // idle | running | paused | terminated
  pauseReason:       text(),                   // manual | budget | system

  // 조직 구조
  reportsTo:         uuid(),                   // 상위 보고자 (자기참조 FK)

  // 예산
  budgetMonthlyCents: integer(),               // 월간 예산 한도
  spentMonthlyCents:  integer(),               // 현재 월간 지출

  // 어댑터 설정
  adapterConfig:     jsonb(),                  // 런타임별 설정 (Claude, Codex 등)
  runtimeConfig:     jsonb(),                  // 추가 런타임 설정

  // 모니터링
  lastHeartbeatAt:   timestamp(),              // 마지막 하트비트

  // 메타데이터
  metadata:          jsonb(),
  permissions:       jsonb(),                  // 에이전트별 권한
});
```

### 4.2 에이전트 생명주기

```
                    ┌──────────────┐
                    │ 고용 요청     │
                    │ (agent-hire) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐     승인 게이트
                    │ pending      │ ────────────────→ 보드 승인 필요?
                    │ approval     │                    │
                    └──────┬───────┘                    │ Yes
                           │ No                  ┌─────▼─────┐
                    ┌──────▼───────┐             │ Approval  │
                    │   idle       │◄────────────│ Approved  │
                    └──────┬───────┘             └───────────┘
                           │ Heartbeat/Wakeup
                    ┌──────▼───────┐
              ┌────│   running    │────┐
              │    └──────┬───────┘    │
              │           │            │
       예산 초과    작업 완료     수동 중지
              │           │            │
       ┌──────▼──┐  ┌─────▼────┐  ┌───▼──────┐
       │ paused  │  │  idle    │  │  paused  │
       │(budget) │  │          │  │ (manual) │
       └─────────┘  └──────────┘  └──────────┘
              │
       보드 승인/예산 증액
              │
       ┌──────▼───────┐
       │   idle       │  (재개)
       └──────────────┘
```

### 4.3 에이전트 서비스 핵심 기능

```
agentService(db)
├── CRUD
│   ├── create()                    # 이름 중복 자동 해결 (접미사 #1, #2...)
│   ├── list() / getById()
│   ├── update()                    # 설정 변경 리비전 추적
│   └── remove()                    # 트랜잭션 기반 캐스케이드 삭제
│
├── 상태 관리
│   ├── pause(reason)               # manual | budget | system
│   ├── resume()
│   ├── terminate()                 # API 키 자동 폐기
│   └── activatePendingApproval()
│
├── 조직 구조
│   ├── ensureManager()             # 매니저 유효성 검증
│   ├── assertNoCycle()             # 순환 보고 방지
│   ├── orgForCompany()             # 조직도 트리 빌드
│   └── getChainOfCommand()         # 보고 체계 조회
│
├── 설정 리비전
│   ├── listConfigRevisions()       # 변경 이력 조회
│   ├── getConfigRevision()
│   └── rollbackConfigRevision()    # 이전 설정으로 롤백
│
└── API 키 관리
    ├── createApiKey()              # "pcp_" 접두사 토큰 생성
    ├── listKeys()
    └── revokeKey()
```

### 4.4 에이전트 생성 API

```
POST /companies/:companyId/agents        # 직접 생성
POST /companies/:companyId/agent-hires   # 고용 워크플로우 (승인 게이트 포함)
```

고용 시 자동 처리:
- 이름 중복 검사 및 자동 넘버링
- 기본 어댑터 설정 자동 적용 (codex_local, gemini_local, cursor 등)
- 스킬 할당
- 승인이 설정된 경우 Approval 생성

### 4.5 Heartbeat 시스템

에이전트의 자율 실행을 위한 Heartbeat 메커니즘:

```
heartbeat_runs = pgTable("heartbeat_runs", {
  id:                uuid(),
  companyId:         uuid(),
  agentId:           uuid(),

  // 실행 상태
  status:            text().default("queued"),  // queued → running → succeeded/failed
  invocationSource:  text(),                     // on_demand | scheduled | event
  triggerDetail:     text(),                     // 트리거 상세 정보

  // 프로세스 추적
  processPid:        integer(),
  exitCode:          integer(),
  signal:            text(),

  // 사용량
  usageJson:         jsonb(),                    // 토큰 사용량
  resultJson:        jsonb(),                    // 실행 결과
  contextSnapshot:   jsonb(),                    // 컨텍스트 스냅샷

  // 로그
  logStore:          text(),                     // 로그 저장소 타입
  logRef:            text(),                     // 로그 참조
  logBytes:          integer(),
  logCompressed:     boolean(),
  stdoutExcerpt:     text(),
  stderrExcerpt:     text(),

  // 세션 지속성
  sessionIdBefore:   text(),                     // 이전 세션 ID
  sessionIdAfter:    text(),                     // 이후 세션 ID
});
```

**Heartbeat 실행 흐름**:

```
스케줄 트리거 / 이벤트 트리거 / 수동 Wakeup
  → getInvocationBlock() 예산 확인
  → heartbeat_run INSERT (status: queued)
  → 어댑터 execute() 호출
    → Claude CLI / Codex CLI 프로세스 시작
    → 프롬프트 + 컨텍스트 + 스킬 주입
    → 스트리밍 출력 파싱
  → 토큰/비용 추출 → costService.createEvent()
  → heartbeat_run UPDATE (status: succeeded/failed)
  → 세션 ID 저장 (다음 Heartbeat에서 재개)
```

---

## 5. 메트릭 및 텔레메트리

### 5.1 수집되는 메트릭

| 카테고리 | 메트릭 | 수집 방법 |
|----------|--------|-----------|
| **토큰 사용량** | inputTokens, outputTokens, cachedInputTokens | 어댑터 출력 파싱 |
| **비용** | costCents (센트 단위), costUsd | 프로바이더 가격 모델 기반 계산 |
| **실행 추적** | exitCode, signal, processPid, duration | 프로세스 모니터링 |
| **세션 지속성** | sessionIdBefore/After | 어댑터 세션 관리 |
| **로그** | stdout/stderr excerpts, full log (compressed) | 프로세스 출력 캡처 |
| **빌링 분류** | billingType (metered_api / subscription) | 어댑터 인증 방식 감지 |
| **예산 상태** | 사용률%, 인시던트 수, 일시중지 리소스 수 | budget 서비스 집계 |

### 5.2 다차원 분석 뷰

```
비용 분석 축:
  ├── by Agent         → 에이전트별 토큰/비용 + API vs Subscription 분리
  ├── by Provider      → anthropic, openai 등 프로바이더별
  ├── by Biller        → 과금 주체별 (프로바이더 수, 모델 수 포함)
  ├── by Project       → 프로젝트별 (activity_log JOIN으로 run↔issue↔project 연결)
  ├── by Agent x Model → 에이전트별 모델 사용 교차 분석
  └── Window Spend     → 시간 윈도우별 (5시간, 24시간, 7일)
```

### 5.3 실시간 모니터링

- **SSE (Server-Sent Events)**: `live-events.ts` 서비스가 에이전트 상태 변경, 비용 이벤트 등을 실시간 푸시
- **30초 주기 갱신**: UI의 Costs 페이지가 30초 간격으로 지출/쿼터 데이터 자동 리페치
- **Heartbeat 상태 추적**: 에이전트의 `lastHeartbeatAt` 타임스탬프로 생존 확인

### 5.4 재무 서비스 (Finance)

비용 추적과 별도로 재무 이벤트 시스템도 존재:

```
financeService(db)
├── createEvent()     # 재무 이벤트 기록 (debit/credit)
├── summary()         # 총 debit, credit, 순액 집계
├── byBiller()        # 과금 주체별 재무 분석
├── byKind()          # 이벤트 유형별 분석
└── list()            # 이벤트 목록 (페이지네이션)
```

---

## 6. Web UI의 에이전트 상태 및 비용 표시

### 6.1 대시보드 (Dashboard.tsx)

메인 대시보드에 4개 핵심 메트릭 카드:

| 카드 | 내용 |
|------|------|
| **Agents Enabled** | 총 에이전트 수 + running/paused/error 상태별 카운트 |
| **Tasks In Progress** | 진행 중 작업 수 + open/blocked 분류 |
| **Month Spend** | 월간 지출 + "X% of Y budget" 또는 "unlimited" 표시 |
| **Pending Approvals** | 대기 중인 예산/작업 승인 수 |

추가 시각화:
- 14일간 Run Activity 타임라인 차트
- Issues by Priority / Status 차트
- Success Rate 차트
- 최근 활동 피드 (10건)
- 최근 작업 테이블 (10건)
- 예산 인시던트 경고 배너

### 6.2 비용 페이지 (Costs.tsx)

5개 탭으로 구성된 종합 비용 관리 페이지:

```
Costs Page
├── Overview      → 추론 비용, 플랫폼 수수료, 크레딧, 쿼터 윈도우
├── Budgets       → 예산 정책 관리, 인시던트 해결 UI
├── Providers     → 프로바이더별 사용량 + 쿼터 추적
├── Billers       → 과금 주체별 재무 분석
└── Finance       → 계정 수준 재무 이벤트 원장
```

핵심 UI 컴포넌트:
- `MetricTile`: 대시보드 통계 타일
- `BudgetIncidentCard`: 예산 인시던트 상세 (해결 액션 포함)
- `BudgetPolicyCard`: 예산 정책 표시/편집
- `ProviderQuotaCard`: 프로바이더 쿼터 현황
- `FinanceBillerCard` / `FinanceKindCard` / `FinanceTimelineCard`: 재무 분석 카드

### 6.3 에이전트 상세 페이지 (AgentDetail.tsx)

6개 뷰로 구성:

```
AgentDetail
├── Dashboard       → 에이전트별 차트 + 최근 활동
├── Instructions    → 마크다운 프롬프트 편집기 (파일 트리 + 자동 저장)
├── Configuration   → 어댑터 설정 + API 키 관리 + 리비전 히스토리
├── Skills          → 스킬 동기화 (required/optional 분류)
├── Runs            → 실행 이력 테이블
└── Budget          → 에이전트별 비용 할당 + 모니터링
```

**실행 상태 아이콘 시스템**:

| 상태 | 아이콘 | 색상 |
|------|--------|------|
| succeeded | CheckCircle2 | green |
| failed | XCircle | red |
| running | Loader2 (회전) | cyan |
| queued | Clock | yellow |
| timed_out | Timer | orange |
| cancelled | Slash | neutral |

**실행별 메트릭 추출**:

```typescript
function runMetrics(run: HeartbeatRun) {
  // usageJson에서 토큰 사용량 추출
  const input = usageNumber(usage, "inputTokens", "input_tokens");
  const output = usageNumber(usage, "outputTokens", "output_tokens");
  const cached = usageNumber(usage, "cachedInputTokens", "cached_input_tokens");
  const cost = visibleRunCostUsd(usage, result);
  return { input, output, cached, cost, totalTokens: input + output };
}
```

### 6.4 조직도 (OrgChart.tsx)

에이전트 간 보고 체계를 시각적 조직도로 표시:
- `reportsTo` 필드 기반 계층 구조
- 역할, 상태, 마지막 활동 시간 표시
- SVG 기반 렌더링 (`org-chart-svg.ts` 서버사이드 생성)

---

## 7. AI 코딩 도구 통합 방법

### 7.1 어댑터 아키텍처

Paperclip은 **어댑터 패턴**으로 다양한 AI 도구와 통합한다:

```
packages/adapters/
├── claude-local/       # Claude Code CLI
├── codex-local/        # OpenAI Codex CLI
├── cursor-local/       # Cursor Editor
├── gemini-local/       # Google Gemini
├── openclaw-gateway/   # OpenClaw (게이트웨이 방식)
├── opencode-local/     # OpenCode
└── pi-local/           # Pi
```

각 어댑터는 동일한 인터페이스를 구현:

```
adapter/
├── src/
│   ├── index.ts        # type, label, models[], config 정의
│   ├── server/
│   │   ├── execute.ts  # 실행 로직
│   │   ├── parse.ts    # 출력 파싱 (토큰/비용 추출)
│   │   ├── quota.ts    # 쿼터 조회
│   │   ├── skills.ts   # 스킬 주입
│   │   └── test.ts     # 연결 테스트
│   ├── cli/            # CLI 통합
│   └── ui/             # UI 설정 폼
```

### 7.2 Claude Code 통합 상세

**지원 모델**:
- Claude Opus 4.6
- Claude Sonnet 4.6
- Claude Haiku 4.6
- Claude Sonnet 4.5 (20250929)
- Claude Haiku 4.5 (20251001)

**설정 파라미터**:

| 파라미터 | 설명 |
|----------|------|
| `cwd` | 작업 디렉토리 |
| `instructionsFilePath` | 마크다운 지시사항 파일 경로 |
| `model` | Claude 모델 식별자 |
| `effort` | 추론 수준 (low / medium / high) |
| `maxTurnsPerRun` | 대화 턴 제한 |
| `dangerouslySkipPermissions` | 권한 확인 우회 |
| `command` | CLI 실행 파일 (기본: "claude") |
| `extraArgs` | 추가 CLI 인자 |
| `env` | 환경 변수 |
| `workspaceStrategy` | Git worktree 설정 |
| `timeoutSec` / `graceSec` | 프로세스 타임아웃 |

**실행 흐름 (execute.ts)**:

```
1. buildClaudeRuntimeConfig()
   → 명령어, 작업 디렉토리, 환경변수, 타임아웃 구성

2. buildSkillsDir()
   → 임시 디렉토리에 스킬 파일 심링크 생성
   → Claude가 런타임에 스킬 발견 가능

3. 프롬프트 준비
   → 부트스트랩 프롬프트 + 세션 핸드오프 노트 + 템플릿 결합
   → stdin으로 전달

4. Claude CLI 실행
   → claude --model {model} --max-turns {n} --resume {sessionId}
   → 이전 세션 재개 지원 (sessionIdBefore → --resume)
   → 세션 재개 실패 시 자동으로 새 세션 시작

5. 출력 파싱 (parseClaudeStreamJson)
   → NDJSON (줄 구분 JSON) 스트림 파싱
   → 초기화 이벤트: sessionId, model 추출
   → 메시지 이벤트: 응답 텍스트 추출
   → 결과 이벤트: 토큰 사용량 + USD 비용 추출

6. 환경변수 주입
   → PAPERCLIP_WORKSPACE_* : 워크스페이스 정보
   → PAPERCLIP_RUNTIME_*   : 런타임 서비스 정보
```

**인증 모드**:
- **API Key 방식**: `ANTHROPIC_API_KEY` 환경변수 존재 시 → `metered_api` 빌링
- **구독 방식**: 로컬 로그인 기반 → `subscription_included` / `subscription_overage` 빌링

**세션 지속성**:
- 각 Heartbeat 실행 후 `sessionIdAfter` 저장
- 다음 Heartbeat에서 `--resume {sessionId}`로 이전 세션 재개
- 세션 재개 실패 시 자동 새 세션 + 이전 세션 클리어 시그널

### 7.3 Codex/Cursor/Gemini 통합

동일한 어댑터 패턴으로 통합. 각 어댑터별 차이:

| 어댑터 | 실행 방식 | 비용 추출 |
|--------|-----------|-----------|
| Claude Code | CLI (`claude` 명령어) 직접 실행 | NDJSON 스트림 파싱 |
| Codex | CLI 직접 실행 | 어댑터별 출력 파싱 |
| Cursor | 로컬 에디터 연동 | 어댑터별 메커니즘 |
| OpenClaw | HTTP 게이트웨이 | API 응답 파싱 |

### 7.4 스킬 주입 시스템

에이전트에 런타임 스킬을 주입하여 Paperclip API 호출 능력 부여:

```
skills/
├── paperclip/                # Paperclip 기본 스킬
├── paperclip-create-agent/   # 에이전트 생성 스킬
├── paperclip-create-plugin/  # 플러그인 생성 스킬
└── para-memory-files/        # 메모리 파일 관리 스킬
```

스킬은 실행 시 임시 디렉토리에 심링크되어 에이전트가 자동 발견한다.

---

## 8. 플러그인 시스템

Paperclip은 확장성을 위한 풍부한 플러그인 인프라를 갖추고 있다:

```
서버 플러그인 서비스 (20+ 파일):
├── plugin-registry.ts          # 플러그인 등록/관리
├── plugin-loader.ts            # 플러그인 로드
├── plugin-lifecycle.ts         # 생명주기 관리
├── plugin-event-bus.ts         # 이벤트 버스 (pub/sub)
├── plugin-tool-registry.ts     # 도구 등록
├── plugin-tool-dispatcher.ts   # 도구 호출 디스패치
├── plugin-runtime-sandbox.ts   # 샌드박스 실행
├── plugin-job-scheduler.ts     # 작업 스케줄러
├── plugin-job-coordinator.ts   # 작업 조정
├── plugin-secrets-handler.ts   # 시크릿 관리
├── plugin-state-store.ts       # 상태 저장소
├── plugin-stream-bus.ts        # 스트림 버스
├── plugin-config-validator.ts  # 설정 검증
├── plugin-manifest-validator.ts # 매니페스트 검증
├── plugin-capability-validator.ts # 역량 검증
├── plugin-log-retention.ts     # 로그 보존
├── plugin-dev-watcher.ts       # 개발 모드 감시
└── plugin-worker-manager.ts    # 워커 프로세스 관리
```

---

## 9. 거버넌스 및 승인 시스템

### 9.1 승인 워크플로우

```
에이전트 고용 / 예산 초과 / 전략 변경
  → Approval 생성 (status: pending)
  → 보드(인간 관리자)에게 알림
  → 보드 결정
    ├── Approved → 작업 진행 / 예산 증액 / 에이전트 재개
    └── Rejected → 작업 취소 / 에이전트 유지 중지
```

### 9.2 설정 리비전 및 롤백

모든 에이전트 설정 변경이 리비전으로 기록:
- 변경 전/후 스냅샷
- 변경 소스 (user / agent / system)
- 이전 리비전으로 롤백 가능
- 롤백 시 원본 리비전 ID 참조 유지

---

## 10. MSA 프로젝트에 적용 가능한 인사이트

### 10.1 비용 추적 모델

Paperclip의 `cost_events` 테이블 설계는 다차원 비용 분석의 좋은 레퍼런스:
- **센트 단위 정수 저장**: 부동소수점 오류 방지
- **다중 집계 축**: agent, provider, project, biller, time window
- **월간 스냅샷 캐싱**: agents.spentMonthlyCents, companies.spentMonthlyCents로 빈번한 집계 쿼리 회피
- **빌링 타입 분류**: metered_api vs subscription으로 과금 모델 구분

### 10.2 예산 시행 패턴

- **3단계 계층 예산**: 전사 → 에이전트 → 프로젝트
- **Soft/Hard 임계값**: 경고와 강제 중지 분리
- **원자적 체크아웃**: 작업 시작 전 예산 확인의 원자성 보장
- **인시던트 기반 흐름**: 예산 초과를 이벤트가 아닌 인시던트로 모델링하여 해결 워크플로우 지원

### 10.3 어댑터 패턴

다양한 AI 도구를 동일 인터페이스로 추상화하는 어댑터 패턴:
- `index.ts`: type, label, models 선언
- `execute.ts`: 실행 로직
- `parse.ts`: 출력 파싱
- CLI / Server / UI 분리

### 10.4 세션 지속성

에이전트가 Heartbeat 간에 세션을 유지하는 패턴:
- `sessionIdBefore` / `sessionIdAfter`로 세션 체인 형성
- 실패 시 자동 새 세션 생성 + 이전 컨텍스트 전달

### 10.5 활동 감사 로그

모든 행동을 `actorType + action + entityType + entityId` 구조로 일관되게 기록하여
전체 작업 흐름 추적 가능.

---

## 11. 요약 비교표

| 영역 | Paperclip 접근 방식 | 특징 |
|------|---------------------|------|
| **에이전트 관리** | 회사-조직도 메타포 | 역할, 보고 체계, 권한, 스킬 |
| **비용 추적** | cost_events 이벤트 소싱 | 센트 단위, 다차원 집계, 실시간 |
| **예산 관리** | 3단계 계층 정책 | soft/hard 임계값, 자동 중지, 승인 |
| **실행 모델** | Heartbeat + 세션 지속 | 스케줄/이벤트 기반, 세션 재개 |
| **도구 통합** | 어댑터 패턴 | CLI 프로세스 실행 + 출력 파싱 |
| **텔레메트리** | 토큰/비용/로그 통합 | 프로세스별 전체 추적 |
| **거버넌스** | 승인 게이트 + 리비전 | 롤백, 감사 로그 |
| **UI** | React + TanStack Query | 대시보드, 조직도, 비용 분석 |
| **확장성** | 플러그인 시스템 | 이벤트 버스, 도구 레지스트리, 샌드박스 |
