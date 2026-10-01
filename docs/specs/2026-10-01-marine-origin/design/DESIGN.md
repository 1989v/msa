---
version: 1.0.0
extends: ../../../../DESIGN.md
archetype: medieval-expedition
status: proposal
---
# Visual design contract
## 1. Overview
어둡고 건조한 중세 판타지. 작은 2D 유닛, 큰 지형, 뚜렷한 이동 통로.
00-approved-tone.png의 미술 톤은 사용자 승인. 새 이미지와 수치는 아직 제안.
## 2. Colors
플랫폼 메뉴/접근성 텍스트는 root DESIGN.md의 text/surface/focus 토큰을 따른다.
게임 고유 팔레트는 명시 override: ground=hsl(34 18% 24%), cliff=hsl(32 12% 38%),
forest=hsl(78 24% 20%), iron=hsl(30 9% 16%), wood=hsl(30 28% 28%),
archer=hsl(211 48% 44%), hero=hsl(180 20% 47%), ivory=hsl(44 26% 78%),
enemy=hsl(355 44% 30%), gold=hsl(43 61% 62%), fog=hsl(30 8% 5%).
경제 금화와 몬스터 경고 색을 구분. 계정/버튼에 금융 profit/loss 토큰 의미를 재사용하지 않음.
## 3. Typography
실제 UI는 Pretendard/system 폰트, 본문14~16px, HUD14px, 보조12px, 제목24~32px.
시안 이미지 속 한글은 생성 모델이 그린 설명이며 UI 폰트 자산으로 잘라 쓰지 않는다.
## 4. Layout & Spacing — 크기 회귀 방지
- 일반 전투원/목수의 **불투명 발끝~머리 bound 높이** world32. 프레임32가 아니라 그림 자체32.
- desktop1920×1080 기본 높이28~36 CSS px 목표(표준32), 최대근접40px.
- 영웅/상위유닛은 최대1.1배. 미니보스1.6~1.8배, 최종보스2.2배 상한. 등급을 덩치로 표현하지 않음.
- normal scale s=min(1,max(.5,min(viewportW/1280,viewportH/720))). world span=viewport/s.
  줌 넓게=.8s, 보통=s, 가까이=1.25s. DPR은 해상도만 바꾸고 CSS 크기를 바꾸지 않음.
- 기준 예상: 1920×1080 32px;1280×720 32px;844×390 약17.3px;390×844 16px(기본줌).
- portrait은 보이는 가로폭이 줄고 전체 맵을 억지로 축소하지 않음. 가로 플레이 안내는 가능, 강제 회전 금지.
- 선택영역44CSS px는 투명 hit region; 렌더 크기는 그대로. 겹치는 hit영역은 가장 가까운 화면 중심거리로 선택하고 재탭 순환.
- 메뉴 터치 최소44px/4px spacing. 상단 HUD≤54px, 기본 전장85%이상. 확장관리창만 의도적으로 가림.
- 미니맵160px desktop/96px phone, 실제 시야 영역 정확 표시. 원정대 따라가기/독립 카메라 이동 제공.
- 조작: WASD/스틱 현재 선택 원정대 이동, 클릭/탭 목적지; 유닛 선택·원정/주둔 분리 UI, 탑 선택 후 넣기/꺼내기.
  건설은 목수선택→탑건설→지면미리보기→확정. 임의 화면 탭이 자원소비 거래를 바로 실행하지 않음.
## 5. Elevation & Depth
정사영 사선 top-down, 지면 좌표와 고도 분리, cliff faces/램프/나무 밑동으로 깊이.
광원 좌상단 고정·짧은 접지 그림자. 실시간 과한 블룸/3D 캐릭터 팝업 금지.
## 6. Shapes
UI 철/목재 재질은 얇은 테두리/얕은 모서리. root spacing/radius 참조.
카메라 가장자리 장식 vignette를 fog-of-war로 대체하지 않음.
## 7. Components × States
| 요소 | default | hover/active | focus | disabled/error |
|---|---|---|---|---|
| 고용 버튼 | 역할·금화 | 윤곽/눌림 | root primary ring | 금화부족/상한 설명 |
| 합성 카드 | 3재료→1결과 | 재료표시 | 키보드선택 | 주둔/지역차이 사유 |
| 타워 패널 | HP·주둔n/4 | 선택외곽선 | 이름/슬롯 | 건설불가 빨간 footprint |
| 모드/이어하기 | 날짜·진행·싱글/협동 | 선택탭 | 순환 가능한 포커스 | 복구실패 원본보존 |
| 온라인 상태 | 연결/동기화 | 진행상태 | aria-live | 재시도/혼자계속 구분 |

reduced-motion: 흔들림/강한 hit zoom/왕복 캐릭터 bob 억제, 공격예고 형태와 타이밍 유지.
## 8. Do / Don't
- 화면 시안처럼 작은 유닛을 유지. 디자인 보드 확대 그림을 실전 크기로 사용하지 말 것.
- 투명 여백 포함 frame 크기로 캐릭터 pixel gate를 속이지 말 것.
- 빈 탑이 스스로 발사하거나 목수가 처음부터 있는 연출 금지.
- fog 아래 적 실루엣/그림자/데미지 숫자 표시 금지.
- 캐릭터 초상화·큰 HUD가 전장을 차지하지 않도록 한다.
- 스타크래프트 갑옷/저그/음원 추출 금지. 새 원화로 제작.
- 시안 한 장을 배경으로 놓고 그 위에 점을 움직이는 구현 금지.
- 이미지 보드의 '32px' 글씨는 배율설명이며 이미지 측정값이 아니다. 브라우저 실측으로 검증.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->
