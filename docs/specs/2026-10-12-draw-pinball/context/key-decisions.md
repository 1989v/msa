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
