# 진행 상태

## 현행 R3 (2026-10-05)

`iterations/03-placement-timer-tooltips.md` 승인 범위 완료. games `b26b580f`: 클릭 carry/한 번 성공 배치 종료·기존 드래그/이동/취소, 첫45/이후30, 상단 single바로시작/빨간 숫자, actual BASE 연사·traits hover/focus/touch detail. Core13pass0fail, 실제45초 자동·다음30초·취소/drag/touch/tooltip 및sixviewport PASS, console0. Red numeral rgb(162,35,29)와native tap 별도PASS. 부모 fresh-context 최종 SHIP. 증거 `verifications/r3-final-verification.md`, 모든 `r3-*` 로그/화면.

로컬4179 server session28669 유지. Root games pointer 및 타 staged EventType/lib/marine 변경 손대지 않음. 부모 iteration/spec/design/review는 부모 commit. 다음은 부모 최종 보고; 구현 블로커 없음. Art/decode는 변경 없어 다시 생성/검사하지 않으며 browser load로 확인. R2 실제5단계 PASS는 재실행하지 않음. 이전R2/P1 아래 기록은 이력.

## 현행 R2 (2026-10-05)

사용자 승인 단순화·직접 유료 공격 수정 완료. `iterations/02-direct-purchase.md`가 정본. games commit `70b818c1`. 초기 phase/활성 조합/장부 제거, stage1 공용260, paid general160, mouse/touch drag·range·실제 unit stats, 숨긴44px modal 도움. Core12/asset5/tsc-b/실제5단계 AI match/6viewport browser PASS, console0. 부모 fresh-context 최종 SHIP. `verifications/r2-final-verification.md` 및 모든 `r2-*` 로그/화면 참조. P1 아래 기록은 이력으로 보존.

미리보기4179, 기존 서버 session28669 유지. Rootgames pointer는 여전히 건드리지 않으며 다른 marine/lib/platform 작업 보존. 다음은 부모의 root명세/디자인 문서 commit; 구현 블로커 없음.

주의: R2 native Enter 검증은 실제 CDP keyDown text `\r`가 있어야 버튼 activation된다. 카드 가격 부족 때에도 정보를 선택할 수 있으며 드롭 core가 purchase를 거절한다. 화면 공간은 공격 카드 높이까지 reserve365px, modal은 viewport 안44px 입력. 재생성 필요 없는 art와 P1증거는 유지.

2026-10-05. 작업 위치 `/Users/gideok-kwon/IdeaProjects/msa` 공유 트리. 사용자 "이제 구현시작" 승인에 따른 P1 완료·부모 독립 리뷰 SHIP(2026-10-05).

## 구현·검증

- T1~T6 구현·통합 검증·독립 리뷰 SHIP 완료. 신규 `portal-fe/public/games/duel-defense/` 정적 ES modules 게임. 양측 독립 성문20, 5×5, AI, 공용 군량, 3/5단계 조합, 첫5단계 검증 결과.
- Node 초기12개와 추가 비중첩 support1개·30초 deadline1개 통과. 원화5개 및 browser frame extraction 검증. `npx tsc -b` exit0.
- 실제 CDP 입력으로 초기160 지불→5단계 조합 편성/수비 구매→대장군1 출진→5스테이지 검증 종료→재시작. 런타임에 예산/시간/피해 테스트 편법 없음. 마지막 성문20/20, 내 보상1회.
- 실제 Chrome desktop1440×900/1280×800은 전장·장부·컨트롤 동시 접근 및 page scroll 없음. 900×900/390×844는 번호44px 선택판을 전장 아래로 배치해 스크롤 접근. 모든 번호 버튼을 스크롤 후 실제 viewport 안으로 확인. Console/page errors0.
- 리뷰에서 발견한 도움말 close/Escape의 pause 해제, 작은/중간폭 배치 target 결함 수정·관련 UI 검증 완료.
- 자세한 명령과 출력·스크린샷: `verifications/final-verification.md`.

## Git 소유권·주의

게임 경로는 `portal-fe/public/games` 서브모듈. 기존 현재 HEAD `36bcf951`은 marine-command 작업 분기였고 root가 추적한 pointer는 `58dd81be`. 이번 게임만 커밋한 결과는 `37abce08`(prototype) + `cbf9b5e3`(최종 layout geometry/deadline regression). 부모 결정에 따라 root pointer는 갱신하지 않는다(기존 다른 변경 이력 혼입 방지). 부모가 향후 별도 통합을 결정해야 한다. Push/배포 없음. 다른 contributors' staged/dirty 변경은 보존.

## 다음

부모가 이 docs/specs의 설계·명세 슬라이스를 최종 정리한다. T6 final fresh-context verdict는 SHIP. 기능 범위 확대·온라인·카탈로그·20단계는 이번에 포함하지 않는다.

로컬 preview는 `http://127.0.0.1:4179`, 서버 재시작: `node portal-fe/public/games/duel-defense/tools/serve.mjs`. 모든 게임 데이터는 `js/data.mjs`. 대형 산출물은 승인 아틀라스 복사5개(약10MB)와 `planning/visuals/03-empty-battlefield.png` 원본이며 재생성하지 않는다.

검증 중 함정: phase 전환 후150ms DOM 갱신 전에 버튼 disabled를 읽으면 CDP가 Not clickable을 낸다. E2E가 refresh를 기다리도록 수정. DOM 번호 pad는 canvas cell 좌표 자체를 확대하지 않으며 공통 cell handler를 호출한다. 보이지 않는44px 겹침 targets를 만들지 않는다.

최종 focused layout은1440×900/1280×800/1200×1000/900×1100/900×900/390×844 여섯종 PASS. root evidence commit `3f54a3392`; normal precommit 실행, warn-only doctor의 기존 uncited-doc208건 경고는 비차단이며 다른 문서를 변경하지 않았다.

## R4 완료 — 2026-10-05

R4가 앞선 P1/R2/R3 활성 계약을 대체한다. 게임 `e5dddaa8`:20단계·6수비3레벨·7공격/연구·숫자 방어력·공개 정보 AI·독립 projectile impact·접지2D cutout. 사용자12~15분 선호로 준비45/30/20/15 적용. 기존 PNG는 가려진 허벅지를 복원할 수 없어 부모 전용9×4 투명 부품을 추가했고, 초기 detached thigh/boot와 sliding 발견을 수정한 뒤 실제15초 WebM/8 recorded frames를 부모가 승인했다. 원본 아틀라스 보존,3D 주장 없음.

Core19/19·asset6·tsc exit0·6viewport·실제 mouse/native touch·강화/연구2/3·cartlock·6FX관찰0console·실제4FX화면 PASS. 성장 E2E만 테스트 RAF×8, 상태/군량/단계 주입 없음; 전체20은 seeded domain. Final seed7 defense/AI18 HP20/0=13.07min, mixed/AI18 HP6/0=13.86min, attack/AI3=2.85min, defense양측20 HP20/20=13.17min. 승인 전투/군량 수치 변경 없음. AI 연구는16단계 수비8개 이상에서 예산을 먼저 확보해 실제 사용되게 했다.

Fresh independent static review SHIP·부모 actual motion 승인. 정확한 명령/출력/제약은 `verifications/r4-final-verification.md`. Preview `http://127.0.0.1:4179/`, 기존 세션28669. Root games pointer를 갱신하지 않고 다른 staged/dirty 상태 보존, 정상 owned commit·push/배포 없음.
