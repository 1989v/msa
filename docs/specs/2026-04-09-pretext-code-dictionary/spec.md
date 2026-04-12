# Pretext Interactive Text — Code Dictionary

## Summary
Code Dictionary 프론트엔드에 `@chenglou/pretext` 라이브러리를 적용하여 Editorial Engine 스타일의 인터랙티브 텍스트 효과를 구현한다.

## Target Components

### 1. HeroSection — Interactive Landing Text
- 기존 정적 타이틀/서브타이틀을 pretext 기반 인터랙티브 텍스트로 교체
- 드래그 가능한 빛나는 오브(orb)가 텍스트 위를 떠다님
- 오브를 드래그하면 텍스트가 실시간 리플로우 (60FPS)
- 오브 클릭 시 일시정지/재개
- 반응형 멀티 컬럼 레이아웃 (1~3 컬럼, 뷰포트 크기 기반)

### 2. DetailSidePanel — Editorial Concept Description
- 개념 설명(description) 텍스트에 드롭캡 적용
- 카테고리/레벨 뱃지를 장애물로 설정, 텍스트가 주변으로 흐름
- 관련 개념 풀쿼트 스타일 렌더링

### 3. Performance Stats Bar
- 하단 고정 바: Lines, Reflow(ms), DOM reads(0), FPS, Columns 실시간 표시
- 토글 가능 (개발/데모 용도)

## Technical Approach

### Core Engine (React 적응)
- `prepareWithSegments()` → useMemo로 텍스트 준비 (1회)
- `layoutNextLine()` → requestAnimationFrame 루프에서 매 프레임 레이아웃
- DOM 풀링: 라인 엘리먼트 재사용 (React 외부, ref 기반 직접 DOM 조작)
- 장애물 시스템: 원형(orb) + 직사각형(pullquote, badge) 충돌 계산

### Key Functions (from demo)
- `carveTextLineSlots()` — 장애물이 차지한 영역을 제외한 텍스트 슬롯 계산
- `circleIntervalForBand()` — 원형 장애물과 텍스트 라인 밴드의 교차 영역
- `layoutColumn()` — 장애물을 피하며 컬럼 단위 텍스트 배치
- `fitHeadline()` — 이진 탐색으로 최대 헤드라인 폰트 크기 결정

### Integration Pattern
- `usePretext` 커스텀 훅: prepare/layout 로직 캡슐화
- `PretextStage` 컴포넌트: canvas-free DOM 렌더링 + orb 관리
- `useAnimationLoop` 훅: rAF 루프 + FPS 추적

## Non-Goals
- Canvas/WebGL 렌더링 (DOM 기반 유지)
- 서버사이드 렌더링
- 백엔드 변경
