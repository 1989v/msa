# 진행 상태 — 2026-09-27

## 현재 결과
- 승인 이미지 `planning/visuals/04-sata-siege-revision.png` 기준의 로컬 플레이 가능 구현.
- 게임: `portal-fe/public/games/twin-banner-defense/` (games 서브모듈). 공유 워킹트리에서 작업하며 다른 세션 파일은 건드리지 않음.
- 아군10종, 적4종, 84프레임. 투석기·화차·총통기·대형 총통 포함. 공격 준비/발사/회복, 적 보행/피격/죽음과 실제 투사체를 연결.
- 싱글+AI, 20웨이브, 저장/이어하기, 코드방/빠른 협동/공개방/초대, 협동 이탈 후 AI 승계, 모바일4×4 배치 패드 구현.
- 검증은 `../status.md`, `../verifications/browser-e2e.json`, `../verifications/fresh-review.md` 참조.

## 실행·산출물
- `node portal-fe/public/games/twin-banner-defense/tools/dev-relay.mjs --port 8799`
- 플레이 http://127.0.0.1:8799/ · 도감 http://127.0.0.1:8799/gallery.html
- 8789는 다른 게임 서버이므로 종료하거나 재사용하지 말 것.
- 원본 아트 `portal-fe/public/games/twin-banner-defense/assets/*.png` — 생성/수정 재작업 약15분 이상. 이미 보존했으므로 다시 생성할 필요 없음.
- 프롬프트 `planning/*Prompt.txt`, 승인 시안 `planning/visuals/04-sata-siege-revision.png`.
- 실제 화면 `verifications/play-art-review.png`, 전체 도감 `verifications/gallery-all-frames.png`.

## 확인한 함정
- 아틀라스의 창 끝이 셀 경계를 넘는다. 균등 사각 크롭 대신 연결 성분을 분리한다. 작은 이웃 깃발/분리된 화살은 제외.
- 게스트 스냅샷은 늦을 수 있다. 이동 직후 목적지를 빈 칸으로 추정해 소환하면 호스트가 거절한다. 명시적 빈 칸 선택과 유닛 이동 선택을 구별하도록 수정하고 실제 브라우저 재검증.
- Chrome E2E는 샌드박스 내 시작이 타임아웃된다. 승인된 `node .../tools/e2e.mjs` 명령을 권한 상승으로 실행. 기존 Chrome이나 다른 게임 서버를 종료하지 않는다.
- 브라우저 일치 검사는 최신 명령 결과가 게스트에 도착한 뒤 비교한다. 이전 스냅샷끼리 일치하는 검사는 불충분.
- `e2e-failure-*` 이미지는 최초 실패 증거. 최종 결과는 JSON과 성공 이미지 기준.

## 남은 범위
- 구현/로컬 검증의 외부 차단 사유 없음.
- 운영 릴레이·실제 두 휴대폰 네트워크·발열 성능은 미검증. 공개 배포·카탈로그 등록·DB 마이그레이션은 이번 승인 범위 밖.
- 다음 사용자 피드백을 게임 감각/밸런스/모션에 반영. 기존 사태 벡터 스타일로 되돌리지 않는다.

## 로컬 커밋
- games 구현 커밋: `d5caa78381089ac809ad02adb7ce92424cee9dfc`. 푸시 없음.
- 부모 저장소의 games 포인터는 작업 시작 전부터 다른 세션 커밋들과 차이가 있어 이번 문서 커밋에 포함하지 않는다. 후속 통합 시 이 게임 커밋을 보존하고 포인터를 함께 정리한다.

## 2026-09-28 stage routes/release in progress
- User requested center/both/one-side variety by stage and explicitly authorized deployment. Four stages1–5/6–10/11–15/16–20 implemented.
- Fresh image `assets/battlefield-routes-v2.png` opens the central road, image_gen prompt retained at `planning/route-background-prompt.txt`; regeneration several minutes, do not redo.
- Save/protocol version2, strict routeId, symmetric starting units and remainingdistance targeting. Fresh review caught and fixed late legacy hi, quick invite room-mode and busyACKloop regressions.
- Clean release worktrees `/private/tmp/twin-release-games-20260928` and `/private/tmp/twin-release-msa-20260928`, both based on fresh remote main. Shared dirty checkout must never be rebased or pushed wholesale.
- Public verification runner: `PUBLIC_GAME_URL=https://game.1989v.com/games/twin-banner-defense/index.html node portal-fe/public/games/twin-banner-defense/tools/public-smoke.mjs`. Independent Chrome processes, actual WebSocket snapshots, no game debughooks.

## 2026-09-28 completed public release
- Public URL https://game.1989v.com/games/twin-banner-defense/index.html
- Games remote commit19e6c2c3; parent deployment02ced3bc; imagesrun36338402776 success; serverimage02ced3b ready1/1.
- Final tests41/41, localE2E10/10, actualproduction two-Chrome smoke6/6. Full evidence status.md and verifications/public/public-smoke.json.
- All route-revision/deployment tasks complete. No blockers. Catalog DB row not added; direct index URL works and invitation retains /index.html.
- Shared parent remains on its original local history; deployment used clean worktrees to preserve other sessions. Do not force shared parent to release branch. Test-only public-smoke assertion improvement is local commitdb35ad77.

## 2026-09-28 difficulty patch
User requested harder difficulty and immediate deployment with verification procedures skipped to save tokens. Broad reviews/browser tests omitted; required minimum existing core suite17/17 passed. Same-seed quick comparison: onlyseat0AI builds→loss atwave17; bothAIbuild→wave20win. This is a sample, not a guarantee for every player strategy.
Normal waves: enemies6+wave→10+wave (max30); spacing.9s→.65s; speed+12%; health1.4×(1+.28p+.008p²), p=wave−1; boss additional1.35×. Rewards perkill perplayer ceil(base×.65) so added enemies do not inflate economy. Test-mode numbers unchanged.
Scoped games release81794e10; parentc55fec2e. Only deployment rollout/artifact confirmation follows; no extra E2E/review.
