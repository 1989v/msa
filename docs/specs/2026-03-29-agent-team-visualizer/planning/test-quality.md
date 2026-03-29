# Test Strategy: Agent Team Visualizer

## Test Layers

### Unit Tests
- 에이전트 데이터 파싱 로직 (CLI 출력 → JSON 변환)
- 팀/에이전트 계층 구조 빌드 로직
- 상태 전환 로직 (idle → working → thinking)

### Component Tests
- 에이전트 카드/캐릭터 컴포넌트 렌더링
- 사이드바 네비게이션 컴포넌트
- 프로파일 패널 컴포넌트
- 말풍선 컴포넌트

### E2E Tests
- 페이지 로드 시 에이전트 그리드 표시
- 에이전트 클릭 → 우측 패널 상세 정보 표시
- 팀별 필터링/그룹핑

## Critical Paths
1. 에이전트 데이터 로드 → 오피스 그리드 렌더링
2. 에이전트 클릭 → 프로파일 패널 표시
3. 상태 애니메이션 전환

## Nice-to-have Coverage
- 스프라이트 애니메이션 프레임 정합성
- 다크 테마 색상 대비 접근성
- 대량 에이전트(50+) 렌더링 성능

## Test Framework
- Vitest (unit/component)
- Playwright 또는 Cypress (e2e, 추후)
