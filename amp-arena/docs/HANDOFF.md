# 이어받기 — AMP ARENA

## 산출물 경로

| 무엇 | 어디 |
|---|---|
| 기획서 (단일 원본) | `amp-arena/docs/GDD.md` |
| 시안 캔버스 (발행본) | https://claude.ai/code/artifact/70a06d89-577c-4e82-96ac-622bd95a5023 |
| 시안 소스 | `amp-arena/design/canvas/gen/` → `node amp-arena/design/canvas/gen/build.mjs` 가 `design/canvas/*.dc.html` 생성 |
| 시안 조립·재발행 | `design` 스킬의 `seed-canvas.mjs` 로 `design/dist/amp-arena-mockup.html` 을 만들고 같은 경로로 재발행 |
| 시안 스크린샷 | `scripts/cdp-chrome.sh start <이름>` → `node amp-arena/design/tools/shot-all.mjs <port> amp-arena/design/canvas <outDir>` → `stop` |
| 볼트 사본 | 개인 볼트 `claude/artifact/amp-arena-mockup.{html,md}` |
| 코드 | `amp-arena/{shared,server,client}` (P1 부터) |

## 작업 위치

- 브랜치 `worktree-amp-arena`, 워크트리 `.claude/worktrees/amp-arena` (공유 트리 오염 방지).
- 커밋은 `amp-arena/` 아래만 담는다. 푸시는 사용자에게 마지막에 한 번 묻는다.

## 진행

- [x] P0 시안 — 기획서 + 캔버스 13장 발행 (2026-09-10)
- [x] P1 코어 전투 — shared 시뮬(상태 머신·판정·잡기·다운·낙사·모드) + 연습 모드(봇) + 콜로세움 + HUD (2026-09-11)
- [x] P2 온라인 — 로비·방·8인·서버 60틱·예측/되감기·100ms 보간·결과 (2026-09-11, 헤드리스 2탭 E2E 통과)
- [~] P3 콘텐츠 — 악세서리 6종·스카이독·모드 3은 시뮬에 있음. 아이템(상자·하트·폭탄)은 미구현
- [ ] P4 마감 — 이펙트·SFX·터치·배포

## 실행·검증 명령

```bash
cd amp-arena && npm install
npm run check                     # tsc 3패키지 + vitest 23개
npm run build && npm start        # client/dist 빌드 → 서버가 8787 에서 정적 + /ws 서빙
# E2E (헤드리스 크롬, WebGL 은 --gl 필요, 끝나면 반드시 stop)
PORT=8787 node server/src/index.ts &   # 서버
P=$(../scripts/cdp-chrome.sh start amparena --gl | tail -1)
node tools/e2e-practice.mjs $P http://127.0.0.1:8787 <outDir>
node tools/e2e-online.mjs   $P http://127.0.0.1:8787 <outDir>
../scripts/cdp-chrome.sh stop amparena
```

## 막힌 것 · 함정

- 워크트리 세션은 다른 레포(볼트)의 git 명령을 거부한다. 볼트 사본은 파일만 넣었고 볼트 커밋은 별도 세션/사용자 몫.
- 헤드리스 크롬은 반드시 `scripts/cdp-chrome.sh` 로 띄우고 같은 명령 안에서 `stop` 한다 (훅이 직접 실행을 막는다).
- 디자인 캔버스 `.dc.html` 은 정적 HTML 이라 브라우저로 바로 열어 확인할 수 있다. `{{ }}` 를 쓰지 않는다.
- Node 22.22 는 `.ts` 를 그대로 실행한다(타입 제거). `enum`·파라미터 프로퍼티처럼 지워지지 않는 문법은 쓰지 않는다 (`erasableSyntaxOnly`).
