# Requirements — Pixel Office View (agent-viewer FE)

**Date**: 2026-04-11
**Owner**: kgd
**Status**: draft
**Scope**: `agent-viewer/front` (FE only, no BE change)

## 1. Context

`agent-viewer/front`은 현재 `session` / `team` / `task` 3가지 뷰 모드를 가진 React SPA다.
각 뷰는 CSS Grid + 인라인 SVG `PixelSprite`로 팀/세션 박스를 단순 나열하는 정적 레이아웃이다.

`pablodelucca/pixel-agents` VS Code 확장은 동일한 "AI 에이전트 상태 시각화" 목적을 가지면서도
탑다운 픽셀 오피스, 좌석 할당, 배회, 타이핑/읽기/대기 상태머신, BFS 경로탐색 등
훨씬 몰입감 있는 표현을 달성했다. (레포 README + `webview-ui/src/office/types.ts` 확인)

## 2. Goals

G1. **새로운 뷰 모드 `office` 추가** — 기존 `session`/`team`/`task` 3종은 그대로 유지하고,
    Sidebar 토글·단축키(`4`)를 통해 진입 가능한 네 번째 뷰로 제공한다.
G2. **단일 탑다운 픽셀 오피스** — CSS Grid가 아니라 `<canvas>` 기반 타일맵 위에
    팀별 "구역(zone)"이 배치되고, 모든 에이전트가 하나의 연속된 공간에 렌더된다.
G3. **에이전트 상태의 시각적 구분** — 휴식/업무/대기 상태가 위치·동작·가구를 통해
    즉각 식별 가능해야 한다:
    - **업무(working/typing)**: 자기 자리(desk)에 앉아 모니터를 향한 채 타이핑 애니메이션
    - **읽기(reading)**: 앉은 상태에서 페이지 넘기기 애니메이션
    - **휴식(idle/resting)**: 자리를 벗어나 회의실·소파·자판기 구역을 배회(wander)
    - **대기(waiting)**: 위치 무관, 머리 위 `❓` 말풍선 표시
    - **결재 대기(permission)**: CEO 좌석 근처에 줄서기 + `📋` 말풍선
G4. **걷기 애니메이션** — 상태 전환 시 목적 타일까지 BFS 경로 계산 후
    tile-to-tile lerp 이동. 고정 배치가 아닌 실제로 "움직이는" 오피스.
G5. **팀 구분 유지** — 각 팀은 자기 구역(직사각형 영역)에 desk cluster를 가진다.
    구역 경계는 바닥 타일 색상·카펫으로 표현.
G6. **sub-agent 시각화** — 라이브 세션의 sub-agent는 부모 에이전트 옆 타일에 스폰되고,
    종료 시 페이드아웃.
G7. **데이터 호환** — 기존 `useAppStore`의 `agents` / `teams` / `liveSessions` / `liveSubagents`
    데이터를 그대로 사용. 백엔드 WS 이벤트 스키마 변경 없음.

## 3. Non-Goals

NG1. **레이아웃 에디터 미포함** — pixel-agents의 floor/wall paint, furniture place, import/export
     기능은 이번 스코프에서 제외. 오피스 레이아웃은 코드 상수로 고정.
NG2. **가구 에셋 번들 미포함** — JIK-A-4 Metro City 캐릭터팩 등 외부 에셋 일절 사용 금지.
     모든 타일·캐릭터·가구는 자체 제작 SVG/Canvas path 또는 프로시저럴 픽셀 데이터.
NG3. **pixel-agents 코드 복사 금지** — 타입 정의·아이디어는 참고하지만 코드는 직접 작성.
     라이선스(MIT)는 호환되나 그대로 복사하지 않는다.
NG4. **기존 3개 뷰 변경 금지** — `session` / `team` / `task` 뷰 레이아웃과 컴포넌트는 그대로.
     유일한 변경점은 Sidebar 토글에 `Office` 버튼이 추가되는 것뿐.
NG5. **음향 알림 미포함** — pixel-agents의 chime 기능 제외 (별도 이슈).
NG6. **모바일 반응형 미지원** — 데스크톱 해상도(≥1280×800) 기준으로만 동작.

## 4. User Scenarios

### S1. 오피스 뷰 진입
사용자가 Sidebar에서 `Office` 버튼 클릭(또는 `4` 키) → 중앙 영역이
타일맵 기반 캔버스로 전환. 팀별 구역에 desk cluster가 배치되어 있고,
각 에이전트 캐릭터가 자기 desk 앞에 앉아있다.

### S2. 업무 상태 식별
팀 A의 "implementer" 에이전트가 `status: working`이면 자기 자리에서
모니터를 향해 2프레임 타이핑 애니메이션을 반복한다.
마우스 오버 시 말풍선에 `agent.role` 표시.

### S3. 휴식 상태 표현
`status: idle` 에이전트는 일정 시간(예: 10~20초 랜덤) 뒤 자기 자리를 벗어나
공용 "break zone"(소파/자판기 주변)으로 걸어간다. 거기서 다시 서성이다가
자리로 복귀. 상태가 `working`으로 변하면 즉시 자리로 돌아간다.

### S4. 대기/결재 상태
`liveSession.status === 'waiting'`인 에이전트는 머리 위에 `❓` 말풍선을 띄운다.
`notifications`에 `actionRequired: true`가 있는 에이전트는 CEO 좌석
근처로 이동하여 줄을 서고 `📋` 말풍선을 띄운다.

### S5. Sub-agent 스폰
`SUBAGENT_START` 이벤트 수신 시, 부모 세션의 메인 에이전트 주변 타일에
sub-agent 캐릭터가 matrix-spawn 유사 이펙트와 함께 등장. `SUBAGENT_STOP` 시
페이드아웃.

### S6. 에이전트 클릭
캔버스 내 에이전트 클릭 시 기존 `selectAgent(id)` 호출 → 우측 `ProfilePanel` 표시.
기존 3개 뷰와 동일한 상호작용.

## 5. Acceptance Criteria

**AC1**. Sidebar에 `Office` 버튼이 있고, 클릭 시 `viewMode === 'office'`가 된다.
키보드 `4` 단축키가 동일 동작을 한다.

**AC2**. 오피스 뷰 진입 시 `<canvas>`가 렌더되며 60fps에 근접한 게임 루프가 돌아간다.
(16ms 이내 프레임, Chrome DevTools Performance 탭에서 확인)

**AC3**. 모든 팀의 구역이 캔버스에 표시되고, 구역 경계는 시각적으로 구분 가능하다.
각 에이전트는 팀 구역 내부의 desk에 1:1 할당되어 있다.

**AC4**. `agent.status === 'working'`인 에이전트는 **반드시** 자기 desk에 앉아있는 상태이며
타이핑 애니메이션이 재생된다.

**AC5**. `agent.status === 'idle'`인 에이전트는 일정 확률로 자리를 벗어나 배회한다.
배회 반경은 팀 구역을 벗어나 break zone까지 포함할 수 있다.

**AC6**. `liveSession.status === 'waiting'` 연동 캐릭터는 `❓` 말풍선이 표시된다.

**AC7**. `notifications` 중 `actionRequired: true`인 에이전트는 CEO 영역 근처로 이동하여
줄을 선다.

**AC8**. 캔버스 내 캐릭터 클릭 → `selectedAgentId` 업데이트 → `ProfilePanel` 표시.

**AC9**. `SUBAGENT_START`/`SUBAGENT_STOP` 이벤트 수신 시 sub-agent 캐릭터가 스폰/디스폰된다.

**AC10**. 기존 `session` / `team` / `task` 3개 뷰의 DOM·기능은 변경이 없다.
(기존 스냅샷 테스트/스토리 통과)

**AC11**. `pnpm build`가 성공한다. ESLint 규칙 위반 없음.

## 6. Test Strategy

### Unit (Vitest)
- **Pathfinding**: `findPath(tileMap, from, to)` — 다양한 장애물 케이스, 도달 불가 케이스.
- **State machine**: `tickCharacter(character, dt, world)` — idle→walk→seat 복귀,
  working→seat forced, waiting bubble timer.
- **Tile map**: `buildDefaultLayout(teams)` — 팀 구역 할당, desk 개수 = 에이전트 수 검증.
- **Store integration**: `mapAgentToCharacterState(agent, liveSession)` — 상태 매핑 순수 함수.

### Component (Vitest + @testing-library/react)
- `OfficeCanvas` 렌더: mock agents/teams로 canvas ref mount, click 시 `selectAgent` 호출.
- Sidebar에 `Office` 버튼 추가 확인.
- 기존 3개 뷰 snapshot 변화 없음.

### Manual / Visual
- 브라우저에서 4개 뷰 토글 동작.
- idle 에이전트 배회, working 에이전트 착석, waiting 말풍선 표시 확인.
- sub-agent 스폰/디스폰 확인 (mock WS 이벤트 발사).

### Out of scope for this iteration
- E2E (Playwright 등) — 기존 프로젝트에 E2E 하네스 없음.
- 성능 부하 테스트 — 수동 프레임 확인으로 대체.

## 7. Open Questions

1. **타일 크기와 캔버스 해상도**: 기본 16×16 px 타일, 2× 스케일(32 px 표시) 사용 제안. 확정 필요.
2. **Break zone 위치**: 팀 구역과 별도로 상단/하단에 공용 break zone을 둘지, 각 팀 구역 내에 둘지.
   → 기본: 캔버스 하단 중앙에 단일 공용 break zone + CEO 영역은 상단 중앙.
3. **캐릭터 스프라이트**: 기존 `PixelSprite`(16×16 SVG)를 Canvas `drawImage`로 옮길지,
   아니면 ImageBitmap 캐시를 새로 만들지. → 후자 (런타임 성능을 위해 오프스크린 bake).
4. **persistence**: 레이아웃을 localStorage에 저장할지. → 이번 스코프 아웃.

## 8. Risks

- **R1: Canvas 렌더러 복잡도** — 게임 루프, 스프라이트 캐시, depth sort 등이 단일 PR로는 크다.
  → tasks.md에서 단계별 마일스톤(벽/바닥 → 캐릭터 → 애니메이션 → 상태머신)로 분리.
- **R2: 성능** — 에이전트 수가 20+이면 매 프레임 렌더 비용 증가.
  → 오프스크린 캔버스 사용, dirty rect 렌더는 일단 보류(YAGNI).
- **R3: 기존 컴포넌트 재사용 제한** — `PixelSprite`가 SVG라서 canvas에 직접 못 그림.
  → 동일한 픽셀 데이터를 canvas로 한 번 bake해서 `ImageBitmap` 캐시.
