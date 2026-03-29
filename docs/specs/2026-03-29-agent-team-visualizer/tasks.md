# Task Breakdown: Agent Team Visualizer

## Overview

Claude Code 에이전트 팀을 2D 픽셀 아트 RPG 오피스 스타일로 시각화하는 프론트엔드 SPA.
`front/` 디렉토리에 독립 구성, MSA 본 프로젝트(Gradle/Kotlin)와 빌드 의존성 없음.

Total Task Groups: 8
Estimated Effort: Medium-Large (프론트엔드 SPA 풀 구현)

---

## Task List

### Task Group 1: 프로젝트 초기화 및 기본 구조
**Dependencies:** None
**Phase:** setup
**Required Skills:** frontend, tooling, typescript

- [ ] 1.0 Complete Vite+React+TypeScript 프로젝트 셋업 및 폴더 구조 확립
  - [ ] 1.1 `front/` 디렉토리에 Vite+React+TypeScript 프로젝트 생성 (pnpm create vite)
  - [ ] 1.2 pnpm 패키지 매니저 설정 및 기본 의존성 설치 (react 18+, typescript, zustand)
  - [ ] 1.3 디렉토리 구조 생성:
    ```
    front/src/
    ├── components/     # UI 컴포넌트
    ├── data/           # 정적 JSON (agents.json)
    ├── hooks/          # 커스텀 훅
    ├── store/          # Zustand 스토어
    ├── types/          # TypeScript 타입 정의
    ├── utils/          # 유틸리티 함수
    └── styles/         # 글로벌 스타일
    ```
  - [ ] 1.4 TypeScript strict 모드 설정 및 tsconfig 구성
  - [ ] 1.5 ESLint + Prettier 설정 (React/TypeScript 규칙)
  - [ ] 1.6 환경변수 설정 (`VITE_DATA_SOURCE` 등 .env.example 작성)
  - [ ] 1.7 Verify: `cd front && pnpm install && pnpm dev` 실행 시 localhost에서 빈 페이지 정상 렌더링

**Acceptance Criteria:**
- `pnpm dev`로 개발 서버 기동 성공
- `pnpm build`로 프로덕션 빌드 성공
- TypeScript strict 모드에서 컴파일 에러 없음
- 디렉토리 구조가 설계와 일치

---

### Task Group 2: 타입 정의 및 데이터 레이어
**Dependencies:** Task Group 1
**Phase:** core
**Required Skills:** typescript, state-management

- [ ] 2.0 Complete 데이터 모델, 정적 JSON, Zustand 스토어 구현
  - [ ] 2.1 Write 4 focused tests: Agent/Team/Task 타입 유효성, JSON 로딩, 스토어 상태 변경, 필터링 로직
  - [ ] 2.2 TypeScript 인터페이스 정의 (`types/`):
    - `Agent` (id, name, team, role, tools, status, spriteType, currentTaskIds, speechBubble)
    - `Team` (id, name, color, agents, areaPosition)
    - `Task` (id, name, status, assignedAgentIds, progress, description)
    - `ViewMode` ("team" | "task")
    - `AgentStatus` ("idle" | "working" | "thinking")
    - `TaskStatus` ("pending" | "in-progress" | "completed")
  - [ ] 2.3 정적 JSON 데이터 파일 작성 (`data/agents.json`):
    - 11개 팀 정의 (harness-scaffold, doc-scaffolding, ai-debugger, content-analyzer, superpowers, atlassian, context7, docs-tree-tools, private-repo, prompt-craft, ralph-loop) + Core 가상 팀
    - 17개+ 에이전트 정의 (역할별 spriteType 매핑 포함)
    - 5개+ 샘플 작업 정의
  - [ ] 2.4 데이터 로딩 유틸리티 구현 (`utils/dataLoader.ts`):
    - 정적 JSON import 방식
    - `VITE_DATA_SOURCE` 환경변수 분기 (향후 CLI 파싱 확장 지점)
  - [ ] 2.5 Zustand 스토어 구현 (`store/useAppStore.ts`):
    - agents, teams, tasks 상태
    - selectedAgentId, viewMode, filters 상태
    - selectAgent, setViewMode, toggleTeamFilter, toggleTaskFilter 액션
    - getAgentsByTeam, getAgentsByTask, getUnassignedAgents 파생 셀렉터
  - [ ] 2.6 Verify: `pnpm test` 실행 시 데이터 레이어 테스트 4건 전체 통과

**Acceptance Criteria:**
- agents.json에 12개 팀, 17개+ 에이전트, 5개+ 작업 정의 완료
- Zustand 스토어에서 뷰 모드 전환 및 에이전트 선택 동작
- 팀별/작업별 에이전트 그루핑 셀렉터 정상 동작
- 테스트 4건 통과

---

### Task Group 3: 대시보드 레이아웃 및 다크 테마
**Dependencies:** Task Group 2
**Phase:** core
**Required Skills:** frontend, css, layout

- [ ] 3.0 Complete 3컬럼 레이아웃, 다크 테마, 헤더, 사이드바/패널 shell 구현
  - [ ] 3.1 Write 3 focused tests: 레이아웃 3컬럼 렌더링, 헤더 통계 표시, 다크 테마 CSS 변수 적용
  - [ ] 3.2 글로벌 다크 테마 CSS 변수 정의 (`styles/`):
    - 배경 #0d1117 계열
    - 텍스트, 보더, 액센트 색상 체계
    - CSS 리셋 및 기본 폰트 설정
  - [ ] 3.3 App 레이아웃 컴포넌트 구현 (`components/Layout/`):
    - `AppLayout` -- 3컬럼 CSS Grid (좌 240px / 중앙 1fr / 우 320px)
    - `Header` -- 프로젝트 타이틀, 전체 에이전트 수, 활성 작업 수, Refresh 버튼
  - [ ] 3.4 좌측 사이드바 shell 구현 (`components/Sidebar/`):
    - `Sidebar` -- 뷰 전환 토글 영역, 필터 목록 영역 (내용은 Task Group 7에서 구현)
  - [ ] 3.5 우측 프로파일 패널 shell 구현 (`components/ProfilePanel/`):
    - `ProfilePanel` -- 에이전트 미선택 시 빈 상태 메시지, 선택 시 상세 표시 영역
  - [ ] 3.6 Verify: 브라우저에서 3컬럼 레이아웃이 다크 테마로 렌더링되고, 헤더에 에이전트/작업 수 표시 확인

**Acceptance Criteria:**
- 3컬럼 레이아웃이 좌 240px / 중앙 가변 / 우 320px로 정상 렌더링
- 다크 테마 배경 (#0d1117 계열) 적용
- 헤더에 에이전트 수/작업 수 동적 표시
- 테스트 3건 통과

---

### Task Group 4: 픽셀 아트 스프라이트 시스템
**Dependencies:** Task Group 2
**Phase:** core
**Required Skills:** frontend, pixel-art, css-animation

- [ ] 4.0 Complete CSS 기반 픽셀 아트 스프라이트, 상태별 애니메이션, 말풍선 구현
  - [ ] 4.1 Write 4 focused tests: 스프라이트 렌더링(spriteType별), 상태별 애니메이션 클래스 적용, 말풍선 표시/숨김, image-rendering pixelated 적용
  - [ ] 4.2 스프라이트 타입 매핑 정의 (`utils/spriteConfig.ts`):
    - 역할별 외형 매핑 (implementer=warrior, spec-writer=mage, tester=archer, debugger=healer 등)
    - 스프라이트 크기: 32x32px 기본
  - [ ] 4.3 CSS 기반 픽셀 아트 스프라이트 컴포넌트 (`components/Sprite/`):
    - `PixelSprite` -- spriteType prop으로 캐릭터 렌더링
    - CSS box-shadow 또는 SVG 기반 도트 아트 렌더링
    - `image-rendering: pixelated` 적용
    - 최소 6종 고유 캐릭터 (warrior, mage, archer, healer, scholar, sentinel)
  - [ ] 4.4 상태별 애니메이션 구현:
    - `idle` -- 2~3프레임 대기 모션 (CSS keyframes, 미세한 상하 움직임)
    - `working` -- 타이핑 모션 (손 움직임/이펙트)
    - `thinking` -- 머리 위 물음표/느낌표 이펙트 (깜빡임)
  - [ ] 4.5 말풍선 컴포넌트 (`components/Sprite/SpeechBubble`):
    - 에이전트 위에 말풍선 표시
    - speechBubble 또는 현재 작업 요약 텍스트
    - 호버 시 표시, 일정 시간 후 자동 숨김
  - [ ] 4.6 스프라이트 확대 미리보기 컴포넌트 (프로파일 패널용, 64x64 또는 128x128)
  - [ ] 4.7 Verify: 브라우저에서 6종 이상 스프라이트가 각 상태(idle/working/thinking) 애니메이션과 함께 렌더링 확인

**Acceptance Criteria:**
- 6종 이상 고유 스프라이트 캐릭터 렌더링
- idle/working/thinking 3가지 상태 애니메이션 동작
- 말풍선 호버 시 표시
- 확대 시 도트 유지 (pixelated)
- 테스트 4건 통과

---

### Task Group 5: 오피스 그리드 뷰 (팀별)
**Dependencies:** Task Group 3, Task Group 4
**Phase:** feature
**Required Skills:** frontend, layout, interaction

- [ ] 5.0 Complete 팀별 영역 배치, 에이전트 그리드 렌더링, 팀 하이라이트 구현
  - [ ] 5.1 Write 4 focused tests: 팀별 영역 렌더링(팀 수만큼), 에이전트 배치(팀 영역 내), 팀 호버 하이라이트, 에이전트 클릭 이벤트 발생
  - [ ] 5.2 오피스 그리드 컨테이너 구현 (`components/OfficeGrid/`):
    - `OfficeGrid` -- 중앙 영역에 팀별 영역 배치
    - 팀 areaPosition 기반 절대/그리드 위치 계산
    - 줌/패닝 지원 (CSS transform + 마우스 휠/드래그 이벤트)
  - [ ] 5.3 팀 영역 컴포넌트 (`components/OfficeGrid/TeamArea`):
    - 팀 색상 코드로 영역 경계 표시
    - 팀 이름 라벨
    - 내부에 소속 에이전트 스프라이트 배치 (데스크 느낌)
    - 호버 시 팀 전체 하이라이트 (opacity/border 변경)
  - [ ] 5.4 에이전트 노드 컴포넌트 (`components/OfficeGrid/AgentNode`):
    - PixelSprite + 에이전트 이름 라벨
    - 클릭 시 스토어의 selectedAgentId 업데이트
    - 상태에 따른 시각적 표시 (idle=투명도, working=활성, thinking=이펙트)
  - [ ] 5.5 줌/패닝 커스텀 훅 (`hooks/useZoomPan.ts`):
    - 마우스 휠 줌 (0.5x ~ 2x 범위)
    - 드래그 패닝
    - 줌 레벨 리셋 기능
  - [ ] 5.6 Verify: 브라우저에서 12개 팀 영역이 색상 구분되어 표시, 에이전트 클릭/호버 동작, 줌/패닝 동작 확인

**Acceptance Criteria:**
- 12개 팀 영역이 색상 코드로 구분되어 렌더링
- 각 팀 영역 내에 소속 에이전트 스프라이트 배치
- 팀 호버 시 하이라이트 동작
- 에이전트 클릭 시 selectedAgentId 변경
- 줌/패닝 동작
- 테스트 4건 통과

---

### Task Group 6: 작업별 그루핑 뷰
**Dependencies:** Task Group 5
**Phase:** feature
**Required Skills:** frontend, layout, animation

- [ ] 6.0 Complete 작업 카드 레이아웃, Lobby 대기 영역, 뷰 전환 애니메이션 구현
  - [ ] 6.1 Write 4 focused tests: 작업 카드 렌더링(작업 수만큼), Lobby에 미할당 에이전트 표시, 뷰 전환 시 viewMode 상태 변경, 에이전트 복수 작업 표시
  - [ ] 6.2 작업 카드 컴포넌트 (`components/TaskView/TaskCard`):
    - 작업명 (상단)
    - 상태 배지 (pending/in-progress/completed, 색상 구분)
    - 진행률 바 (progress 있을 경우)
    - 할당 에이전트 스프라이트 (하단, 최대 6명 표시 후 +N 처리)
    - 작업 카드 클릭 시 해당 작업 에이전트만 하이라이트
  - [ ] 6.3 작업별 그리드 컨테이너 (`components/TaskView/TaskGrid`):
    - 작업 카드들을 그리드/플렉스 레이아웃으로 배치
    - 작업 상태별 정렬 (in-progress > pending > completed)
  - [ ] 6.4 Lobby (대기 영역) 컴포넌트 (`components/TaskView/Lobby`):
    - 작업에 할당되지 않은 에이전트 표시
    - "대기 중" 라벨, idle 상태 스프라이트 배치
  - [ ] 6.5 뷰 전환 애니메이션:
    - 팀별 뷰 <-> 작업별 뷰 전환 시 트랜지션 효과
    - CSS transition 또는 framer-motion 활용
    - 에이전트가 재배치되는 느낌의 이동 애니메이션
  - [ ] 6.6 OfficeGrid에 viewMode 분기 로직 추가 (team -> TeamArea, task -> TaskGrid)
  - [ ] 6.7 Verify: 뷰 전환 토글 클릭 시 팀별/작업별 뷰가 애니메이션과 함께 전환, Lobby에 미할당 에이전트 표시 확인

**Acceptance Criteria:**
- 작업 카드에 작업명, 상태, 에이전트 스프라이트 표시
- 6명 초과 시 +N 처리
- Lobby에 미할당 에이전트 정상 표시
- 뷰 전환 시 애니메이션 트랜지션 동작
- 한 에이전트가 복수 작업 카드에 표시
- 테스트 4건 통과

---

### Task Group 7: 상호작용, 프로파일 패널, 사이드바
**Dependencies:** Task Group 5, Task Group 6
**Phase:** feature
**Required Skills:** frontend, interaction, accessibility

- [ ] 7.0 Complete 에이전트 프로파일 패널, 사이드바 필터, 키보드 단축키 구현
  - [ ] 7.1 Write 5 focused tests: 프로파일 패널 정보 표시, 팀 필터 토글, 작업 필터 토글, 키보드 단축키(1/2/Esc) 동작, 뷰 전환 토글 버튼 동작
  - [ ] 7.2 에이전트 프로파일 패널 구현 (`components/ProfilePanel/AgentProfile`):
    - 에이전트 이름
    - 소속 팀 (색상 배지)
    - 역할 설명
    - 보유 도구 목록 (태그/칩 형태)
    - 현재 상태 (상태 인디케이터)
    - 현재 할당 작업 목록
    - 스프라이트 확대 미리보기 (64x64 이상)
    - 에이전트 미선택 시 안내 메시지
  - [ ] 7.3 좌측 사이드바 상세 구현 (`components/Sidebar/`):
    - 뷰 전환 토글 버튼 ("팀별" / "작업별")
    - 팀별 뷰: 팀 목록 체크박스 필터 (팀 색상 표시)
    - 작업별 뷰: 작업 목록 체크박스 필터 (상태 표시)
    - 필터 전체 선택/해제 버튼
  - [ ] 7.4 키보드 단축키 훅 구현 (`hooks/useKeyboardShortcuts.ts`):
    - `1` -- 팀별 뷰 전환
    - `2` -- 작업별 뷰 전환
    - `Esc` -- 선택 해제 (selectedAgentId = null)
    - input 포커스 시 단축키 비활성화
  - [ ] 7.5 호버 상호작용 개선:
    - 에이전트 호버 시 말풍선에 현재 상태/작업 요약 표시
    - 팀 영역 호버 시 팀 전체 하이라이트 (소속 에이전트 강조)
    - 작업 카드 호버 시 할당 에이전트 하이라이트
  - [ ] 7.6 Verify: 에이전트 클릭 시 프로파일 패널에 7개 항목 모두 표시, 키보드 1/2/Esc 동작, 필터 체크박스 토글 시 그리드 필터링 확인

**Acceptance Criteria:**
- 프로파일 패널에 이름, 팀, 역할, 도구, 상태, 작업, 스프라이트 확대 7개 항목 표시
- 사이드바 필터 토글 시 그리드 에이전트 필터링 동작
- 키보드 단축키 1/2/Esc 정상 동작
- 호버 시 말풍선/하이라이트 동작
- 테스트 5건 통과

---

### Task Group 8: 통합, 빌드 최적화, 마무리
**Dependencies:** Task Group 7
**Phase:** polish
**Required Skills:** frontend, testing, optimization

- [ ] 8.0 Complete 전체 통합 확인, 빌드 최적화, 에셋 최종화
  - [ ] 8.1 Write 4 focused tests: 전체 앱 렌더링 (smoke test), 데이터 로딩 -> 그리드 표시 통합, 뷰 전환 -> 필터 -> 프로파일 통합 시나리오, 빌드 결과물 크기 확인
  - [ ] 8.2 전체 통합 점검:
    - 앱 시작 시 agents.json 로딩 -> 팀별 뷰 기본 표시
    - 에이전트 클릭 -> 프로파일 -> 뷰 전환 -> 필터링 전체 플로우
    - 에러 바운더리 추가 (데이터 로딩 실패, 컴포넌트 에러 처리)
  - [ ] 8.3 빌드 최적화:
    - Vite 빌드 설정 최적화 (코드 스플리팅, 트리 쉐이킹)
    - CSS 번들 최적화
    - 빌드 결과물 크기 확인 (목표: 500KB 이하 gzipped)
  - [ ] 8.4 스프라이트 에셋 최종화:
    - 17개+ 에이전트 전체에 대한 스프라이트 매핑 완성
    - TBD 팀 에이전트(atlassian, context7 등) 기본 스프라이트 할당
    - 스프라이트 일관성 검토 (크기, 색상, 애니메이션 타이밍)
  - [ ] 8.5 접근성 기본 대응:
    - 키보드 탐색 (Tab, Enter)
    - 스크린 리더 기본 라벨 (aria-label)
    - 색상 대비 최소 기준 확인
  - [ ] 8.6 Verify: `pnpm build` 성공, `pnpm preview`로 프로덕션 빌드 동작 확인, `pnpm test` 전체 테스트 통과

**Acceptance Criteria:**
- `pnpm build` 에러 없이 성공
- `pnpm preview`로 프로덕션 빌드 정상 동작
- 전체 테스트 스위트 통과 (28건 이상)
- 빌드 결과물 500KB 이하 (gzipped)
- 모든 SR 요구사항 (SR-1 ~ SR-8) 충족

---

## Execution Order

1. **Task Group 1** -- 프로젝트 초기화 (선행 의존 없음)
2. **Task Group 2** -- 데이터 레이어 (1 완료 후)
3. **Task Group 3** + **Task Group 4** -- 레이아웃과 스프라이트 (2 완료 후, 병렬 가능)
4. **Task Group 5** -- 팀별 오피스 그리드 (3+4 완료 후)
5. **Task Group 6** -- 작업별 뷰 (5 완료 후)
6. **Task Group 7** -- 상호작용 및 프로파일 (5+6 완료 후)
7. **Task Group 8** -- 통합 및 마무리 (7 완료 후)

```
[1: 초기화] -> [2: 데이터] -> [3: 레이아웃] ----+-> [5: 팀별 그리드] -> [6: 작업별 뷰] -> [7: 상호작용] -> [8: 통합]
                            -> [4: 스프라이트] --+
```

## Test Summary

| Task Group | Tests | Focus |
|---|---|---|
| 1 | 0 (setup) | 빌드/실행 검증만 |
| 2 | 4 | 타입, JSON, 스토어, 셀렉터 |
| 3 | 3 | 레이아웃, 헤더, 테마 |
| 4 | 4 | 스프라이트, 애니메이션, 말풍선 |
| 5 | 4 | 팀 영역, 배치, 호버, 클릭 |
| 6 | 4 | 작업 카드, Lobby, 뷰 전환 |
| 7 | 5 | 프로파일, 필터, 단축키 |
| 8 | 4 | 통합, 빌드, 시나리오 |
| **Total** | **28** | |

## SR Coverage Matrix

| SR | Task Groups | Description |
|---|---|---|
| SR-1 | 1 | Vite+React+TS+pnpm, front/ 디렉토리 |
| SR-2 | 2 | 정적 JSON, 환경변수 분기, 확장 지점 |
| SR-3 | 2, 5 | 11개 팀 + Core, 에이전트 배치, 영역 구분 |
| SR-4 | 4 | 픽셀 아트 스프라이트, 애니메이션, 말풍선 |
| SR-5 | 3 | 다크 테마, 3컬럼, 헤더, 줌/패닝 |
| SR-6 | 5, 6, 7 | 클릭, 호버, 하이라이트, 키보드 단축키 |
| SR-7 | 7 | 프로파일 패널 7개 항목 |
| SR-8 | 6 | 뷰 전환, 작업 카드, Lobby, 애니메이션 |
