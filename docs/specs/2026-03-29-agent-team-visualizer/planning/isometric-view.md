# Planning: Isometric (2.5D) Office View

## 개요
현재 탑다운 평면 뷰 → 45도 아이소메트릭 2.5D 뷰로 전환.
Habbo Hotel / SimCity 스타일의 깊이감 있는 오피스 환경.

## 핵심 변경 사항

### 1. 좌표 시스템
- 카르테시안 (x, y) → 아이소메트릭 변환
- `isoX = (x - y) * tileWidth / 2`
- `isoY = (x + y) * tileHeight / 2`
- CSS transform으로 구현 가능: `transform: rotateX(60deg) rotateZ(-45deg)`

### 2. 타일맵
- 바닥: 마름모꼴 타일 (64x32px 또는 128x64px)
- 타일 타입: 카펫, 나무바닥, 타일, 회의실
- 벽: 좌측/우측 벽 높이 표현 (Z축)

### 3. 가구 스프라이트
- 현재 정면 뷰 SVG → 아이소메트릭 SVG로 교체
- 책상: 3면 보이는 입체 형태
- 의자: 등받이 높이 표현
- 모니터: 화면 각도 반영

### 4. 캐릭터 스프라이트
- 현재 16x16 정면 → 4방향 아이소메트릭 (NE, NW, SE, SW)
- 각 방향별 3프레임 (idle, walk1, walk2)
- 총 필요: 10종 × 4방향 × 3프레임 = 120 프레임
- 스프라이트시트 최적화 필요

### 5. 렌더링 순서
- Y축 기반 정렬 (뒤→앞 순서로 그리기)
- 에이전트가 가구 뒤에 가려지는 효과
- Canvas 2D 또는 CSS z-index 레이어링

## 기술 스택 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| CSS Transform | 기존 구조 재활용 | 복잡한 인터랙션 어려움 |
| Canvas 2D | 성능 최적화, 렌더링 순서 제어 | DOM 인터랙션 별도 구현 |
| PixiJS | 2D 게임 엔진, 스프라이트시트 지원 | 외부 의존성 추가 |
| Phaser | 풀 게임 엔진, 물리/충돌 | 오버킬, 번들 크기 증가 |

**권장**: CSS Transform + Canvas 하이브리드 (레이아웃은 CSS, 스프라이트 렌더링은 Canvas)

## 에셋 요구사항
- 아이소메트릭 바닥 타일: 4종 (64x32px)
- 아이소메트릭 가구: 5종 (책상, 의자, 모니터, 화분, 정수기)
- 아이소메트릭 캐릭터: 10종 × 4방향 × 3프레임
- 에셋 소싱: AI 생성(Midjourney/DALL-E) 또는 오픈소스 (itch.io 에셋팩)

## 예상 공수
- 에셋 제작/수집: 1~2일
- 좌표 변환 시스템: 0.5일
- 타일맵 렌더링: 1일
- 기존 컴포넌트 아이소메트릭 적응: 1~2일
- 총: 3~5일

## 참고
- https://clintbellanger.net/articles/isometric_math/
- Habbo Hotel 클론 프로젝트들 (GitHub)
- itch.io isometric asset packs
