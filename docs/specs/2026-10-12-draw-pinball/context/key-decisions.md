# Decisions

## 2026-10-12 사용자 승인 범위
- Decision: 직전 벤치마크의 우선순위 네 가지를 구현하고 짧은 친구 공유 링크/코드 입장을 추가한다.
- Reason: 사용자 "우선순위대로 진행하되, 친구 공유 링크는 숏링크 형태로 쉽게 공유하고 쉽게 치고들어올 수 있으면 좋겠어 ... 공유파라미터 형태로 구성해도될듯해".
- Evidence: 기존 /party route와 SecureRandom 6자리 코드 발급 확인.
- Impact: portal-fe의 추첨/파티/구슬레이스. 서버 발급 규약은 유지한다.
- Computer use: 승인 없음. CDP/Playwright/브라우저 조작 포함 실행 금지; 비-UI 단위/시뮬/빌드 검증은 실행한다.

## 2026-10-12 컴퓨터 사용 승인
- User explicitly approved the parent request: localhost/127.0.0.1 and game.1989v.com only; UI/accessibility reads, screenshots, fake names, each-course execution/mobile viewport, temporary test rooms and link/code joining, user-click copy.
- State changes allowed: localStorage test settings/roster, temporary rooms, clipboard invite. No external sending/publishing/deploying.
- Completion: setup → race → result and valid/invalid invitation checks. Local new code and live existing deployed code must be distinguished.

## 2026-10-12 이름 변경
- User: "간단 추첨 > 이 워딩은 '랜덤레이스'로 변경".
- Decision: 새 페이지의 한국어 제품 이름/SEO와 허브 진입을 랜덤레이스, 영어를 Random Race로 변경. /draw 및 mode/순서 정하기 규약 유지.

## 2026-10-13 QR 디코더 및 입장 수명주기 보정
- Existing encoder's writeFormat row/column orientation made zbar fail clean short/legacy symbols at all6 tested size/quiet-zone combinations; scratch coordinate-only correction decoded6/6. Parent approved narrow format-bit fix plus q4/crisp/no-shrink display. LevelL retained. Actual mobile screenshot independently decodes.
- StrictMode effect cleanup closed the first socket while opened ref prevented second setup; parent approved cleanup reset/leave and invalid stale-cfg guard, with focused regression.
- Preserve preexisting root staged games pointer15cf171c; root FE/spec/pointer integration stays uncommitted pending explicit user choice. Own games7-file commit only.

## 2026-10-13 루트 통합 승인
- User replied "진행해" to the concrete integration question. Parent confirmed current games pointer560224e4 integration including intervening already committed games history (no isolation).
- Only listed featureFE/spec paths and gamesgitlink are authorized for this rootcommit. Preserve every other preexisting staged/dirty path; no push/deploy.

## 2026-10-13 맵 확장과 빨리감기 변경
- User requested more maps and replacing the large fast-forward action with a small top-right icon.
- Parent decision: add three distinct courses using existing safe parts (지그재그/범퍼 숲/시소), preserve original three; native icon with a 44px target positioned relative to the actual game canvas, preserving the existing three-second fixed-step fast-forward behavior.
- Scope: games marble-race course/setup/main/index and relevant portal-fe tests; existing spec amendment only. No new service/architecture/dependency/ADR. This request authorizes implementation, not publication or a fresh browser bundle.
- Korean wording follows project feedback memory `feedback_korean_game_wording.md`; short literal action labels and course descriptions.
- User additionally requested full visible viewport height for `/games/marble-race`. Parent decision: opt this slug into existing immersive stage through an optional trailing `useStageFit` flag, preserving visual viewport sizing and other games. Scope adds GameDetailPage/useStageFit and matching tests; no forced browser fullscreen or changed canvas aspect.
- User explicitly approved “로컬 브라우저 검증도 수행 해” after the scoped local browser bundle and viewport steering. Approved localhost/127.0.0.1 only: screenshot/UI reads, fake names, course selection/race/results, desktop/mobile sizes, icon clicks and keyboard. Local test names/settings storage allowed. No external sharing, room creation, production browser or deployment. Completion: new maps and icon/viewport layout verified; own browser cleaned.

## 2026-10-13 후속 조작 요구 (기존 빨리감기 아이콘 대체)
- User removed skip mode entirely, requested a completed-only replay icon in the map center, and removed the bottom button region.
- Parent decision: remove all player fast-forward/skip paths including racing Space; preserve internal deterministic simulation API only. Remove both bottom canvas button rows and shortcut strip. Same-seed native replay is centered after result activation guard; R works only on completed result. Native compact menu keeps slow/participant/settings and completed-only copy/new-seed round actions. Preserve course/viewport work.
- Existing local approval applies to the ongoing maps/layout/control validation: local icons/menu/keys and replay affect only the already approved local names/settings and game state. Stop verification of the removed FF control. Do not expand to native fullscreen, clipboard writes, production or rooms.
