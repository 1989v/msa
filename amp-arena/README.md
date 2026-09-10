# AMP ARENA

겟앰프드 계열 **8인 실시간 3D 아레나 대전 액션**을 브라우저로. 시스템·조작·게임 흐름은 원작 계열 문법을 따르고,
캐릭터·UI·이름·아트는 오리지널이다. 기획서는 [`docs/GDD.md`](docs/GDD.md), 시안은 `design/`.

## 실행

```bash
npm install
npm run check          # 타입 검사 3패키지 + 시뮬 테스트 43개
npm run build          # client/dist
npm start              # http://127.0.0.1:8787 — 정적 클라 + WebSocket /ws
```

개발 중에는 두 프로세스: `npm run dev:server` (8787) + `npm run dev:client` (5180, /ws 프록시).
도커: `docker build -t amp-arena . && docker run -p 8787:8787 amp-arena`.

## 조작

| 동작 | 키보드 | 패드 | 터치 |
|---|---|---|---|
| 이동 | 방향키 / WASD | 왼쪽 스틱 | 왼쪽 가상 스틱 |
| 대시 | 같은 방향 더블탭 / Shift | LB | 스틱 끝까지 · 빠른 재터치 |
| 공격 · 잡기(밀착) | Z | A | 공격 |
| 점프 | X / Space | B | 점프 |
| 가드 (홀드) | C | RB | 가드 |
| 악세서리 기술 | V | X | 기술 |
| 줍기 · 던지기 | F, 든 채로 Z | Y | 줍기 |
| 카메라 | Q / E · 우클릭 드래그 | 오른쪽 스틱 | 오른쪽 빈 곳 드래그 |
| 효과음 | M | | |

## 구조

```
shared/   시뮬레이션 (의존성 0) — 서버·클라·테스트가 같은 파일을 실행한다
server/   Node 22 + ws — 로비 · 방 · 60틱 매치 루프 · 봇 채움
client/   Vite + Three.js — 프리미티브 리그 · 예측/보간 · DOM HUD · 화면 흐름
tools/    헤드리스 크롬 E2E (연습 · 2탭 온라인)
design/   시안 캔버스 소스와 생성기
docs/     기획서 · 이어받기
```

- 서버가 권위. 클라는 입력만 보내고 자기 캐릭터를 예측(되감기·재실행), 남은 캐릭터는 100ms 보간.
- 프레임 데이터·수치는 `shared/src/moves.ts`·`constants.ts`·`items.ts` 가 단일 원본이고 기획서 표와 같다.
