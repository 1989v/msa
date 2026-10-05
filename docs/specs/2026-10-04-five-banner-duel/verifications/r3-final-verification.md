<!-- source: portal-fe/public/games/duel-defense/js/main.mjs, portal-fe/public/games/duel-defense/js/core.mjs, portal-fe/public/games/duel-defense/tools/r3-e2e.mjs, portal-fe/public/games/duel-defense/tools/r3-layout.mjs, portal-fe/public/games/duel-defense/tools/r3-touch-timer.mjs -->
# R3 클릭 배치·타이머·툴팁 검증 — 2026-10-05

정본 [R3 명세](../iterations/03-placement-timer-tooltips.md). 게임 commit **b26b580f**, [독립 fresh-context 리뷰](r3-review.md) 최종 **SHIP**. P1/R2 로그와 화면은 변경하지 않았다.

## 구현

카드 클릭만으로 차감 없이 carry 상태, portrait cursor/range/유효칸 preview. 한 번 성공 구매 후 carry 종료. 점유/상대/잘못된 칸 무차감, 재선택/재시도 가능. 드래그·터치·배치 병사 이동·44px dialog·키보드 유지, drag-generated click 재배치/재선택 방지. Escape/우클릭/탭/도움말/일시정지/재시작/phase 전환 cleanup. 컨트롤을 타일 입력으로 처리하지 않는다.

첫 준비45초, 이후30초. 하나의 **바로 시작**을 우측 상단에 배치, 하단 중복 제거. 기존 red token의 **빨간 숫자**, 대비 paper 배경과 red border. 도움말/README 시간 동기화. 기존 숨김 탭/일시정지/도움말 timer 보존 경로 유지. 경제·HP·피해·range·interval·AI 전략·원화는 변경하지 않았다.

6개 병과의 native title 대체 DOM tooltip(role=tooltip, aria-describedby)은 hover/focus, touch는 같은 내용의 persistent 선택 상세. 공격력·BASE `1/interval`회/초·interval·tile range·실제 trait 표시. 궁수 단일, 창병 직선/armor65%, 포수85%, 화차90px(1.34칸), 총통45px(.67칸)/85%, 군악 주변속도30% 비중첩. 공격하는 병과는 tooltip과 터치 상세 모두 '군악수 지원 시 연사+30%(기본값과별도)' 명시. 방어 support 실제 cooldown×1.3은 기존 unit case로 대조.

## 명령과 결과

| 명령 | 실제 결과 |
|---|---|
| `node --test portal-fe/public/games/duel-defense/tests/*.test.mjs` | **13 tests /13 pass /0 fail** — [r3-unit-output.txt](r3-unit-output.txt). 기존 경제12개 유지,45/30/자동/조기 시작/일시정지 추가 |
| `node portal-fe/public/games/duel-defense/tools/r3-e2e.mjs` | **R3 Chrome E2E PASS ·0 console/page errors** — [r3-e2e-output.txt](r3-e2e-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r3-layout.mjs` | 여섯 viewport/상단 start/timer/44px dialog/키보드/이동/환급 **PASS ·0 browser errors** — [r3-layout-output.txt](r3-layout-output.txt) |
| red-number 시각 수정 후 `node portal-fe/public/games/duel-defense/tools/r3-touch-timer.mjs` | computed numeral **rgb(162,35,29)** = 기존 red token, desktop/narrow 가시성·실제 native touch tap **PASS** — [r3-touch-timer-output.txt](r3-touch-timer-output.txt) |
| `cd portal-fe && npx tsc -b` | exit0, 오류 출력 없음. Static ES module runtime/syntax는 위 실제 Chrome load로 검증 |
| game/docs scoped `git diff --check` | exit0 |

같은 통합 검증을 부모/리뷰어가 반복하지 않았다. 마지막 숫자 색상 수정에는 관련 시각·touch만 확인했다. 변경 없는 raster/atlas decoder는 standalone asset 검사를 반복하지 않았으며 실제 browser assets.ready(전체5개 load/decode 성공)와 모든 병과 sprite 렌더를 확인했다. R2 asset5 PASS는 이력에 보존.

## 실제 입력·시간

- 카드 클릭→커서 이동→궁수 구매40, 두 번째 빈 칸 무차감. 점유/상대 클릭은 carry 유지·무차감, 병과 교체→포수70. Escape/우클릭/tab/help/pause cleanup 무차감.
- 실제 mouse drag 구매40, 기존 병사 이동 무차감. 후속 click은 carry 재활성/추가 차감하지 않음.
- 여섯 hover tooltip의 base rate/interval/range를 data 원본과 비교, 실제 armor/splash/support note 대조. 키보드 focus tooltip 확인.
- **바로 시작** 실제 click으로 조기 출진, 실제 전투 후 stage2 준비 time29~30 확인. 재시작 후 wall clock **45초**를 기다리고 carry 상태의 자동 출진: 군량260 유지·ghost cleanup. 시계/군량/HP 주입 없음. 전체5단계는 이미 R2 통과하여 재실행하지 않았다.
- 390px 실제 touch drag,44px 도움/Enter 한 번 구매→exit, pause/help 시간 보존. 추가 native touchStart/End **카드 탭**으로 carry 활성, 기본 연사 .91회/초·장갑65%·지원+30% touch detail 확인. 창병50 구매 후 두 번째 번호칸 무차감.

Core의 빠른 time loop는 synthetic 명세 검증이며 실제 사용자 시간 검증과 구분했다. 브라우저는 readonly snapshot/ui 진단만 사용.

## 화면

- 최종 [1440px 빨간 타이머](shots/r3-final-timer-1440.png), [390px 빨간 타이머](shots/r3-final-timer-390.png)
- [실제 cursor/range preview](shots/r3-cursor-range.png)
- [desktop tooltip](shots/r3-tooltip-desktop.png), [narrow tooltip](shots/r3-tooltip-narrow.png)
- layout [1440×900](shots/r3-layout-1440x900.png), [1280×800](shots/r3-layout-1280x800.png), [1200×1000](shots/r3-layout-1200x1000.png), [900×1100](shots/r3-layout-900x1100.png), [900×900](shots/r3-layout-900x900.png), [390×844](shots/r3-layout-390x844.png)

Wide1440/1280/1200 수비·공격 전장/카드 no-scroll. 상단 action bottom131px(desktop)/175px(narrow), 모든 viewport 안, confirm1개만 존재. 900×900은 세로903px(3px 추가 scroll),390px은 세로 scroll 허용. width clipping 없음. 모든44px dialog 버튼은 viewport 안. Tooltip은 screen bounds 안에 고정·본문 카드/선택 정보도 제공. 초기 검증 shots의 흰 숫자/red 배경은 수정 전 기록이며 `r3-final-timer-*`가 최종 시각 정본.

## 저장

로컬 preview `http://127.0.0.1:4179`, server session28669 유지. games b26b580f만 커밋, 다른 game/lib 작업 및 root의 다른 staged files/pointer 그대로 보존. Root games pointer stage/commit을 하지 않는다. 정상 git commit hooks, 우회 없음. 부모가 소유한 iteration/spec/설계/review 문서는 이번 commit에 넣지 않는다.

잔여는 기존5단계 prototype 밸런스이며 온라인/배포/카탈로그/원화 생성은 범위 밖. 작은 화면은 click/44px 도움 또는 drag edge scroll을 사용한다.
