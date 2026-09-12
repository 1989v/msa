# 이어받기 — AMP ARENA

## 산출물 경로

| 무엇 | 어디 |
|---|---|
| 기획서 (단일 원본) | `amp-arena/docs/GDD.md` (§12 네트워크는 2026-09-11 방장 권위로 개정) |
| 시안 캔버스 (발행본) | https://claude.ai/code/artifact/70a06d89-577c-4e82-96ac-622bd95a5023 |
| 시안 소스 | `amp-arena/design/canvas/gen/` → `node amp-arena/design/canvas/gen/build.mjs` 가 `design/canvas/*.dc.html` 생성 |
| 시안 조립·재발행 | `design` 스킬의 `seed-canvas.mjs` 로 `design/dist/amp-arena-mockup.html` 을 만들고 같은 경로로 재발행 |
| 볼트 사본 | 개인 볼트 `claude/artifact/amp-arena-mockup.{html,md}` · `wiki/entities/amp-arena.md` |
| 코드 | `amp-arena/{shared,client,tools}` |
| 배포 산출물 | games 레포(`1989v/games`, msa 의 `portal-fe/public/games` 서브모듈) `arena/` + `thumbs/shots/arena.jpg` |
| 카탈로그 행 | `game/feature/src/main/resources/gamedb/migration/V89__seed_arena.sql` (slug `arena`, BETA) + `V90__arena_score_boards.sql` (순위표 보드 online/practice, sdk_integrated=1) |
| 운영 주소 | https://game.1989v.com/games/arena (카탈로그 상세 → IFRAME `/games/arena/index.html`) |
| 운영 상태 (2026-09-13) | main 84ec14b1 · games 1f984baa · 이미지 portal-fe:84ec14b · 번들 `index-B3nwRH39.js`. **Phase 2 완료 + 공중 공격**. 운영 실측: `tools/e2e-prod-{fullscreen,portrait,score,rules,air}.mjs` + `e2e-online.mjs`(채팅·점수판) + `e2e-progress.mjs` + `e2e-emblem.mjs` 전부 통과 |

## 작업 위치

- 브랜치 `worktree-amp-arena`, 워크트리 `.claude/worktrees/amp-arena`. 푸시는 `HEAD:main` 으로, 계정 1989v(전환 → 푸시 → 즉시 복귀).
- games 레포는 이 세션에서 git 을 못 쓴다(워크트리 가드) → `tools/publish-games.mjs` 가 GitHub API 로 커밋한다. 그 뒤 msa 의 서브모듈 포인터를 올린다.

## 진행

- [x] P0 시안 — 기획서 + 캔버스 13장 발행 (2026-09-10)
- [x] P1 코어 전투 — shared 시뮬(상태 머신·판정·잡기·다운·낙사·모드) + 연습 모드(봇) + 콜로세움 + HUD (2026-09-11)
- [x] P2 온라인 — 예측/되감기·100ms 보간·결과 (2026-09-11)
- [x] P3 콘텐츠 — 악세서리 6종·스카이독·모드 3·아이템(상자·하트·폭탄) (2026-09-11)
- [x] P4 마감 — 합성 SFX·터치 조작·히트스톱/흔들림·README. 모바일 가로 844×390 E2E (2026-09-11)
- [x] 플레이 소감 반영 — 좌우 반전, 근접 리치 +0.25m, 연타는 후딜 끝나야, 스타일 5종, 맵 2종 추가(옥상·얼음 호수) (2026-09-11)
- [x] **서버 제거 → 플랫폼 릴레이 + 방장 권위** (2026-09-11) — 파드 0. `arena.1989v.com` Ingress·NetworkPolicy·Deployment·CI 매핑·Dockerfile 삭제.
  방장 워커 권위(60틱) · 스냅샷 10Hz · 입력 20Hz · 지연 균등화 · 방장 승계(마지막 스냅샷 + 월드 단위 상태). 테스트 64, E2E: 코드 방 2탭 · 빠른 대전 3탭(방장 숨김·승계·완주) 오류 0, 릴레이 실측 최대 2,243자 · 23 msg/s
- [x] 2차 소감 반영 (2026-09-11) — 카메라 더 가깝게(뒤 5.6m·위 7m), 걷기 4.0·달리기 6.2, 공격 템포(발동 ×1.2·후딜 ×1.25·경직 ×1.4), 직업별 악세서리, 상자 충돌·선분 판정, 폭탄 줍기 안내(HUD 프롬프트), 점프대(콜로세움·스카이독·옥상), 팀전 아군 피격(아군 KO −1). 테스트 `shared/test/feedback2.test.ts`
- [x] 3차 소감 반영 (2026-09-12) — 약공(Z)·강공(X) 사슬 + 피니시 + 반격기, 경직 원복(연타 사이 가드 가능), 봇 장비 무작위, 옥상 상자 겹침 수정·기계실 개방(벽·문·천장·비침), 폭탄 3.2m, IFRAME 안 전체화면. 테스트 `shared/test/feedback3.test.ts`
- [x] 승계 입력 복구·지연 보상 (2026-09-12) — `recover.ts`(ack 뒤 입력 16개씩 재전송), `World.latency`/`posAgo`(왕복+보간 지연만큼 되감은 상대 위치로 타격 판정), 워커 `lat` 메시지
- [x] 방·드럼통 (2026-09-12) — 콜로세움 동서 문루·스카이독 컨테이너, 드럼통(잽 3방·던지기로 폭발, 반경 3m 25, 연쇄, 45초 재생성) 전 맵. 좀비 상자 수정. 테스트 `shared/test/barrel.test.ts`, 스크린샷 `tools/shot-barrel.mjs`
- [x] 세로 모바일 강제 가로 (2026-09-12) — `client/src/ui/orient.ts` 가 세로 터치 기기에서 `#app` 을 90° 돌리고 `touch.ts` 가 좌표를 되돌린다. 전체화면 진입 뒤 가로 잠금 시도. 실측 `tools/e2e-portrait.mjs` (390×844, 회귀 주입으로 빨간불 확인)
- [x] 밸런스 2차 + KO 악세서리 드랍 + 밀리는 드럼통 (2026-09-12) — `tools/balance.mjs` 봇 토너먼트로 조정(기획서 §7.3), KO 시 든 악세서리가 떨어지고 직업이 맞는 사람이 주워 든다(`acc` 아이템, 25초 소멸, 봇도 줍는다), 드럼통은 걸어서 민다. 테스트 `shared/test/accdrop.test.ts`
- [x] 짧은 화면 스크롤 (2026-09-12 운영 실측이 잡음) — 폰 가로 844×390 에서 타이틀 「연습」 버튼이 화면 밖이라 손이 안 닿았다(E2E 가 `el.click()` 으로 눌러 가려져 있었다). `.screen` 을 스크롤 가능하게(가운데 정렬은 auto 마진), 로비 칸·대기실 슬롯도 스크롤. 모바일 E2E 는 이제 `tapElement`(실제 탭)로 누른다
- [x] 시안 캔버스 v0.2 (2026-09-12) — 스타일 5종·옥상·얼음 호수 아트보드 추가(16장), 콜로세움·스카이독에 문루·컨테이너·드럼통·점프대 반영. `node design/canvas/gen/build.mjs` → seed → 같은 URL 재발행(Version 4). 카탈로그 썸네일도 새 카메라로 교체
- [x] 관전 (2026-09-12) — 로비 체크박스 → `Pick.spectate`, `buildRoster`(`client/src/net/roster.ts`)가 명단에서 빼고 `cfg.spectators`, `GuestSource.spectator`(입력 안 보냄), 매치 `followId`(`]`/`[` 전환). 실측 `tools/e2e-spectate.mjs`
- [x] 플랫폼 순위표 (2026-09-12) — `client/src/platform/score.ts` (online/practice 보드, Bearer 쿠키, 결과 화면 한 줄), 마이그레이션 `game/.../V90__arena_score_boards.sql`(보드 이름·sdk_integrated). 세션은 카탈로그 페이지 몫. 실측 `tools/e2e-score.mjs`(가짜 API) · `tools/e2e-prod-score.mjs`(운영)
- [x] 진행 (2026-09-12) — `client/src/platform/progress.ts`(경험치·레벨·골드·스탯 분배·색 스킨, `sanitizeProgress`), `save.ts`(플랫폼 세이브 동기화), `ui/progressui.ts`(타이틀 줄·모달). 스탯은 명단으로 시뮬에(`sanitizeStatDelta`), 스킨은 리그 색으로. 테스트 `client/test/progress.test.ts`·`shared/test/stats.test.ts`, 실측 `tools/e2e-progress.mjs`
- [x] 점수판·매치 중 채팅 (2026-09-12) — Tab 점수판(타이머 탭), Enter 채팅(릴레이 `c` → HUD 피드), 관전 전환은 `]`/`[`. E2E `e2e-online.mjs` 에 채팅·점수판 검사
- [x] 공중 공격 (2026-09-13 소감 「점프하면서도 공격」) — 공중 약공 = `airAttack`(점프 궤적 유지, 5/3/12·7 데미지, 한 번 뛰어 최대 두 번), 공중 강공 = 기존 급강하. 무브가 공중에서 끝나면 `fall` 로(전엔 `idle` 이라 공중 재점프가 될 뻔), 착지 경직은 쓴 무브의 후딜. **봇은 `ACTIONABLE`(idle/walk/run/land) 밖이라 공중 공격을 쓰지 않는다** — 봇 밸런스에 영향 없음. 테스트 `shared/test/airattack.test.ts`, 그림 `tools/shot-airattack.mjs`, 운영 실측 `tools/e2e-prod-air.mjs`(번들 `index-B3nwRH39.js` 에서 3/3)
- [x] 밸런스 계측기 수정 (2026-09-13) — `balance.mjs` 가 **판 끝** 악세서리로 집계하던 것을 **시작 장비**로(KO 드랍 뒤로 판 끝 42% 가 달라진다). 60판은 노이즈(마셜 0.65↔0.92↔0.96) — **300판 이상에서만 판정**. 300판 실측으로 기획서 §7.3 의 「전부 ±30% 안」 기록을 사실로 정정(헤비·스피드스타·브레이커·더블탭이 밖). 원거리는 봇이 공정하게 못 재니 사람 데이터로 판정
- [x] **봇이 스스로 떨어져 죽던 것** (2026-09-13, 밸런스를 재려다 찾음) — 판당 사망 34 중 크레딧 KO 는 10.5 뿐이고 36% 가 자멸이었다(스카이독은 82%). 원인 셋: 상대가 위에 있으면 틱당 8% 로 빈 곳에 점프 · 절벽 검사가 0.9m 앞만 보고 접근 경로에만 걸림 · 점프대를 밟고 장외로. `bot.ts` 에 `footing`(발밑·점프대)·`avoidEdge`(속도 비례 예측 + 옆으로 틀기, 공중은 착지점)·`landingSpot`(탄도 착지 예상, 통로 전체가 딛을 수 있어야 뛴다). 자멸 36%→6%, 스카이독 판당 사망 45.7→15.2, 크레딧 타격사 44%→64%. 게이트 `shared/test/botedge.test.ts`(고치기 전 스카이독 20.75 로 빨간불 확인)
- [x] 밸런스 재판정 (2026-09-13) — 봇을 고치자 **직업·악세서리 전부 ±30% 안**(헤비 1.36→1.08, 스피드스타 0.62→0.97, 브레이커 1.50→1.10, 더블탭 0.41→1.04). 「범위 밖」 넷은 값이 아니라 자멸 결과였다. **수치는 하나도 안 바꿨다.** 기획서 §7.3 참조
- [x] 가슴 그림 엠블럼 (2026-09-12) — 12×12 격자 페인터(`client/src/ui/emblemui.ts`), 144자 문자열을 명단에 실어 온라인 상대에게도 보임(`sanitizeEmblem`, cfg 봉투 크기 테스트), 리그 토르소 앞뒤 CanvasTexture(`rig.setEmblem`). Phase 2 완료. 테스트 `shared/test/emblem.test.ts`, 실측 `tools/e2e-emblem.mjs`·`tools/shot-emblem.mjs`

## 장르 문법 중 아직 없는 것

- 캐릭터 외형은 1종(스타일별 머리·체형 차이 + 색 8종)

## 실행·검증 명령

```bash
cd amp-arena && npm install
npm run check                          # tsc 2패키지 + vitest 64개 (시뮬 · 스냅샷 · 권위/승계)
npm run dev                            # 개발 릴레이 8790 + vite 5180 → http://127.0.0.1:5180 (온라인은 탭 둘 이상)
npm run build:games                    # client/dist-games (base /games/arena/)
ARENA_BASE=/games/arena/ ARENA_OUT=dist-games npm -w client run preview   # 5181 에서 빌드 산출물 검증 (http://127.0.0.1:5181/games/arena/)
# E2E — 헤드리스 크롬(WebGL 은 --gl), 온라인 스크립트는 개발 릴레이를 스스로 띄우고 끈다. 끝나면 반드시 stop
P=$(../scripts/cdp-chrome.sh start amparena --gl | tail -1)
node tools/e2e-practice.mjs $P http://127.0.0.1:5180 <outDir>      # 15초 스모크
node tools/e2e-online.mjs   $P http://127.0.0.1:5180 <outDir>      # 코드 방 2탭: 방장·게스트·릴레이 상한
node tools/e2e-online-full.mjs $P http://127.0.0.1:5180 <outDir>   # 빠른 대전 3탭: 방장 숨김 → 승계 → 2분 완주 → 로비 (약 2.5분)
node tools/e2e-mobile.mjs   $P http://127.0.0.1:5180 <outDir>      # 844×390 터치 레이아웃
node tools/e2e-autopilot.mjs $P http://127.0.0.1:5180 <outDir>     # 봇 AI 가 내 캐릭터 조종 60초 (준 데미지 > 0)
node tools/e2e-fullmatch.mjs $P http://127.0.0.1:5180 <outDir>     # 연습 2분 완주
node tools/shot-poses.mjs   $P http://127.0.0.1:5180 <outDir>      # 포즈 갤러리(/poses.html) 게임 각도·옆·앞 스크린샷 — 타격 포즈는 수치가 아니라 그림으로 판정한다
# 운영 실측 — 페이지 base 는 파일까지(index.html) 준다. /games/arena/ 는 portal-fe SPA 의 카탈로그 상세로 간다
node tools/e2e-online.mjs $P https://game.1989v.com/games/arena/index.html <outDir>   # Cloudflare + 실제 릴레이
node tools/e2e-catalog.mjs $P https://game.1989v.com/games/arena <outDir>             # 카탈로그 상세 IFRAME 안에 타이틀이 뜨는지
node tools/e2e-prod-air.mjs $P https://game.1989v.com/games/arena/index.html <outDir> # 공중 약공(궤적 유지)·강공(급강하)
../scripts/cdp-chrome.sh stop amparena
```

운영 실측(2026-09-11): 코드 방 생성 → 게스트 입장 → 매치, 방장/게스트 역할·스냅샷 흐름 정상, 콘솔 오류 0. 헤드리스 소프트웨어 GL 두 탭이라 RTT 는 수백 ms 로 찍혔다(실기기 수치 아님).

- `?autopilot=1` 이면 봇 AI 가 내 캐릭터를 조종한다(디버그·E2E). `window.__amp.source` 로 월드·`epoch`·`hostSeat`·`lastAuth` 를 본다. `?relay=ws://…` 로 릴레이 주소를 바꿀 수 있다.
- **헤드리스 크롬은 마지막에 연 탭만 visible** 이라 다른 탭은 rAF 가 멈춘다. 권위 워커는 그래도 돈다(3탭 E2E 의 `hostHiddenStillTicks`).

## 배포 절차 (games 레포 → msa)

```bash
npm run build:games
GH_TOKEN=$(gh auth token -u 1989v) node tools/publish-games.mjs --dir client/dist-games --dest arena --prune \
  --file thumbs/shots/arena.jpg=<320x180 jpg> --message "arena: …"        # 새 커밋 sha 출력
cd .. && git update-index --cacheinfo 160000,<sha>,portal-fe/public/games  # 서브모듈 포인터 올림 → 커밋 → 푸시
```

- msa 푸시 뒤 CI 가 portal-fe(서브모듈 경로 변경)와 **content**(game 마이그레이션 — ADR-0093 뒤 `game/*` 는 content 호스트) 이미지를 굽고 Argo 가 반영한다. 롤아웃 확인은 두 디플로이의 태그 + `GET /api/v1/games/arena` 의 `scoreBoards`(마이그레이션 적용) + `index.html` 의 번들 이름.
- 카탈로그 상세는 API 로 바로 뜨지만 프리렌더·사이트맵은 portal-fe 다음 빌드에 잡힌다.

## 막힌 것 · 함정

- 워크트리 세션은 다른 레포의 git 명령을 거부한다 → games 레포는 API 게시, 볼트 커밋은 별도 세션.
- 릴레이는 메시지 4,096자 · 40 msg/s 를 넘기면 연결을 끊는다. 스냅샷에 새 필드를 더하면 `client/test/authority.test.ts` 의 상한 테스트가 먼저 잡는다.
- 방장 승계 뒤 `acks` 는 옛 방장의 마지막 값에서 시작해야 한다 — 0 으로 두면 게스트가 밀린 입력을 두 번 재실행해 순간이동한다.
- `dist-games/` 의 파일명 해시가 매번 바뀐다 — 게시는 항상 `--prune` 으로 해서 `arena/` 아래 옛 번들을 같이 지운다.
- Node 22.22 는 `.ts` 를 그대로 실행한다(타입 제거). `enum`·파라미터 프로퍼티처럼 지워지지 않는 문법은 쓰지 않는다 (`erasableSyntaxOnly`).
- 입력은 rAF 폴링이라 **짧은 탭(40ms)은 느린 헤드리스 GL 에서 프레임 사이로 빠진다**. E2E 는 키를 150ms 넘게 누른다(`Page.hold`).
- **시간이 지나면 변하는 값으로 무브를 판정하지 않는다.** 공중 약공 뒤 `vel.y` 가 −3.6 이라 급강하로 오독했는데, 실제로는 표본을 220ms 뒤에 떠서 중력(18 m/s²)이 깎은 값이었다.
  판별자는 시뮬이 고정하는 것이어야 한다 — 급강하는 수평 6 m/s 를 주고 공중 약공은 속도를 아예 안 건드리므로 `hypot(vx, vz)` 로 가른다. 낙하 상태 확인도 착지 전에 떠야 해서 높이 8m 에서 시작한다.
