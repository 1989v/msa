# Specification: Agent Team Visualizer

## Goal

Claude Code에 설치된 플러그인/에이전트 팀을 2D 픽셀 아트 RPG 오피스 스타일로 시각화하는 프론트엔드 SPA를 구축한다. 사용자는 팀별 또는 작업별로 에이전트를 그루핑하여 현재 상태를 직관적으로 파악할 수 있다.


## User Stories

- 사용자로서, 오피스 맵에서 각 에이전트의 현재 상태(idle/working/thinking)를 한눈에 보고 싶다.
- 사용자로서, 에이전트를 클릭하여 소속 팀, 역할, 보유 도구 등 상세 프로파일을 확인하고 싶다.
- 사용자로서, **팀(플러그인)별 뷰**와 **작업(task)별 뷰**를 전환하여 에이전트 그루핑을 다른 관점으로 보고 싶다.
- 사용자로서, 특정 작업에 어떤 에이전트들이 투입되어 있는지 작업별 그루핑 뷰에서 확인하고 싶다.
- 사용자로서, 다크 테마 대시보드에서 QJC OS 레퍼런스와 유사한 레이아웃으로 작업하고 싶다.


## Specific Requirements

### SR-1: 기술 스택

- `front/` 디렉토리에 독립 SPA로 구성
- React 18+ / Vite 기반
- TypeScript 필수
- 상태 관리: Zustand 또는 React Context (경량 우선)
- 스타일링: CSS Modules 또는 Tailwind CSS
- 픽셀 아트 렌더링: HTML Canvas 또는 CSS 기반 (라이브러리 선택은 구현 시 결정)
- 패키지 매니저: pnpm
- MSA 본 프로젝트(Gradle/Kotlin)와 빌드 의존성 없음

### SR-2: 데이터 소스

- 1차: 정적 JSON 파일(`front/src/data/agents.json`)을 기본 데이터 소스로 사용
- 2차(확장): `claude plugins list` CLI 출력 파싱 또는 API 연동
- 에이전트/플러그인 목록, 상태, 작업 할당 정보를 포함
- 데이터 갱신: 수동 새로고침 또는 폴링(30초 이상 간격)
- 데이터 소스 전환은 환경변수(`VITE_DATA_SOURCE`)로 제어

### SR-3: 계층 구조 -- 팀별 그루핑

- 플러그인 = 팀 (11개 팀)
- 에이전트 = 팀원 (17개 이상)
- 팀별 오피스 영역을 시각적으로 구분 (색상 코드, 영역 경계)
- 팀 목록:

| 팀 (플러그인) | 소속 에이전트 |
|---|---|
| harness-scaffold | implementer, spec-initializer, spec-shaper, spec-writer, tasks-list-creator, tester, verifier |
| doc-scaffolding | scaffolding-agent |
| ai-debugger | debug-agent |
| content-analyzer | analyzer-agent |
| superpowers | code-reviewer |
| atlassian | (에이전트 TBD) |
| context7 | (에이전트 TBD) |
| docs-tree-tools | (에이전트 TBD) |
| private-repo | (에이전트 TBD) |
| prompt-craft | (에이전트 TBD) |
| ralph-loop | (에이전트 TBD) |

- 코어 에이전트(general-purpose, Explore, Plan)는 "Core" 가상 팀으로 분류

### SR-4: 픽셀 아트 RPG 스타일

- 스프라이트 크기: 16x16 또는 32x32 픽셀 도트 아트
- 역할별 고유 외형 (예: implementer=전사, spec-writer=마법사, tester=궁수, debugger=힐러)
- 상태별 애니메이션:
  - `idle`: 제자리 대기 모션 (2~3프레임 루프)
  - `working`: 작업 중 모션 (타이핑, 도구 사용)
  - `thinking`: 머리 위 물음표/느낌표 이펙트
- 말풍선: 현재 수행 중인 작업 요약 텍스트 표시
- 스프라이트 에셋: 초기에는 CSS 기반 픽셀 아트 또는 오픈소스 에셋 활용 (OQ-001)
- image-rendering: pixelated 적용으로 확대 시 도트 유지

### SR-5: 대시보드 레이아웃

- 다크 테마 기본 (배경 #0d1117 계열)
- 3컬럼 레이아웃:
  - **좌측 사이드바** (너비 ~240px): 네비게이션, 뷰 전환 토글, 팀/작업 필터
  - **중앙 오피스 그리드** (가변): 에이전트 배치 맵
  - **우측 프로파일 패널** (너비 ~320px): 선택된 에이전트 상세 정보
- 상단 헤더: 프로젝트 타이틀, 전체 에이전트 수, 활성 작업 수 요약
- 중앙 그리드는 줌/패닝 지원 (마우스 휠, 드래그)

### SR-6: 상호작용

- 에이전트 클릭 시 우측 프로파일 패널에 상세 정보 표시
- 에이전트 호버 시 말풍선으로 현재 상태/작업 요약 표시
- 팀 영역 호버 시 팀 전체 하이라이트
- 작업별 뷰에서 작업 카드 클릭 시 해당 작업에 할당된 에이전트만 하이라이트
- 좌측 사이드바에서 팀/작업 필터링 가능
- 키보드 단축키: `1`=팀별 뷰, `2`=작업별 뷰, `Esc`=선택 해제

### SR-7: 에이전트 프로파일

- 프로파일 패널에 표시할 정보:
  - 에이전트 이름
  - 소속 팀 (플러그인)
  - 역할 설명
  - 보유 도구 목록
  - 현재 상태 (idle / working / thinking)
  - 현재 할당 작업 (있을 경우)
  - 스프라이트 확대 미리보기
- 프로파일 데이터는 SR-2 데이터 소스에서 로드

### SR-8: 작업별 그루핑 뷰

- **뷰 전환**: 좌측 사이드바 상단에 "팀별" / "작업별" 토글 버튼 배치
- **작업(Task) 정의**: 현재 수행 중인 작업 단위 (예: "spec.md 작성", "API 구현", "테스트 수행")
- **작업별 레이아웃**:
  - 중앙 그리드가 작업 카드 기반으로 재배치
  - 각 작업 카드에는 작업명, 상태(진행중/완료/대기), 할당 에이전트 스프라이트 표시
  - 작업에 할당되지 않은 에이전트는 "대기 영역(Lobby)"에 표시
- **작업 카드 구성**:
  - 작업명 (상단)
  - 진행률 표시 (선택)
  - 할당 에이전트 스프라이트 (하단, 최대 6명까지 표시 후 +N 처리)
- **팀별 뷰와의 전환**: 애니메이션 트랜지션으로 에이전트가 재배치되는 효과
- **데이터**: 작업 정보는 SR-2 데이터 소스의 `tasks` 필드에서 로드
- 한 에이전트가 복수 작업에 할당 가능 (복수 작업 카드에 표시)


## Data Model

### Agent

```
{
  id: string               // 고유 식별자 (예: "implementer")
  name: string             // 표시 이름
  team: string             // 소속 팀(플러그인) ID
  role: string             // 역할 설명
  tools: string[]          // 보유 도구 목록
  status: "idle" | "working" | "thinking"
  spriteType: string       // 스프라이트 유형 (예: "warrior", "mage")
  currentTaskIds: string[] // 현재 할당 작업 ID 목록
  speechBubble?: string    // 말풍선 텍스트
}
```

### Team

```
{
  id: string               // 플러그인 ID (예: "harness-scaffold")
  name: string             // 표시 이름
  color: string            // 팀 색상 코드
  agents: string[]         // 소속 에이전트 ID 목록
  areaPosition: {x, y, w, h}  // 오피스 그리드 내 영역 좌표
}
```

### Task

```
{
  id: string               // 작업 고유 ID
  name: string             // 작업명 (예: "spec.md 작성")
  status: "pending" | "in-progress" | "completed"
  assignedAgentIds: string[] // 할당된 에이전트 ID 목록
  progress?: number        // 진행률 (0~100, 선택)
  description?: string     // 작업 설명
}
```

### 정적 JSON 구조 예시 (agents.json)

```
{
  "teams": [ ... ],
  "agents": [ ... ],
  "tasks": [ ... ]
}
```


## UI Wireframe (텍스트 기반)

### 팀별 뷰

```
+------------------------------------------------------------------+
| Agent Team Visualizer    | Agents: 17 | Active Tasks: 5 | [Refresh] |
+----------+-----------------------------------+-------------------+
|          |                                   |                   |
| SIDEBAR  |      OFFICE GRID (팀별)           |   PROFILE PANEL   |
|          |                                   |                   |
| [팀별]   |  +-------+  +-------+  +-------+  |  +-----------+    |
| [작업별] |  | h-scaf |  | debug |  | super |  |  | Sprite    |    |
|          |  | @@@ @  |  |  @    |  |  @    |  |  | (확대)    |    |
| 필터:    |  | @@ @@  |  |       |  |       |  |  +-----------+    |
| [] h-scaf|  +-------+  +-------+  +-------+  |  Name: impl..    |
| [] debug |                                    |  Team: h-scaf    |
| [] super |  +-------+  +-------+             |  Role: 구현 전문  |
| [] doc   |  | doc-sc|  | c-ana |             |  Tools: [...]     |
| [] ...   |  |  @    |  |  @    |             |  Status: working  |
|          |  +-------+  +-------+             |  Task: API 구현   |
|          |                                   |                   |
+----------+-----------------------------------+-------------------+
```

### 작업별 뷰

```
+------------------------------------------------------------------+
| Agent Team Visualizer    | Agents: 17 | Active Tasks: 5 | [Refresh] |
+----------+-----------------------------------+-------------------+
|          |                                   |                   |
| SIDEBAR  |      OFFICE GRID (작업별)          |   PROFILE PANEL   |
|          |                                   |                   |
| [팀별]   |  +------------------+             |                   |
| [작업별] |  | Task: spec.md 작성|             |  (에이전트 선택   |
|          |  | Status: 진행중    |             |   시 표시)        |
| 작업필터:|  | @@ @              |             |                   |
| [] spec  |  +------------------+             |                   |
| [] API   |                                   |                   |
| [] test  |  +------------------+             |                   |
| ...      |  | Task: API 구현    |             |                   |
|          |  | Status: 진행중    |             |                   |
|          |  | @@ @@             |             |                   |
|          |  +------------------+             |                   |
|          |                                   |                   |
|          |  +------ Lobby ------+            |                   |
|          |  | @ @  (대기중)      |            |                   |
|          |  +-------------------+            |                   |
+----------+-----------------------------------+-------------------+
```


## Existing Code to Leverage

- 이 프로젝트는 MSA 백엔드(Kotlin/Spring) 기반이며, `front/` 디렉토리는 독립 SPA로 신규 구성
- MSA 본 프로젝트의 빌드 시스템(Gradle)과 무관하게 독립적으로 구동
- `common` 모듈의 `ApiResponse<T>` 포맷은 향후 백엔드 API 연동 시 참고 가능


## Open Questions

| ID | 질문 | 영향 범위 |
|---|---|---|
| OQ-001 | 스프라이트 에셋 소싱 방법 (직접 제작 vs 오픈소스 vs AI 생성) | SR-4 |
| OQ-002 | 에이전트 상태 데이터 실시간 수집 방법 (CLI 파싱 주기, 이벤트 기반 등) | SR-2, SR-8 |
| OQ-003 | `front/` 디렉토리 내 다른 프로젝트와의 관계 및 라우팅 구조 | SR-1 |


## Out of Scope

- 실시간 WebSocket 기반 상태 업데이트 (1차는 정적/폴링)
- 에이전트 실행 제어 (시작, 중지, 재시작 등)
- 모바일 반응형 레이아웃
- 백엔드 서비스 신규 개발
- 에이전트 간 메시지 통신 시각화
- 작업 생성/수정/삭제 기능 (읽기 전용 시각화)
