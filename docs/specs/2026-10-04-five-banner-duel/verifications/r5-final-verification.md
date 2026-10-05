# R5 관통 순서 검증 — 2026-10-06

완료·fresh static review SHIP(부모 R5 iteration에 기록). 게임 **71edb3d4**. Preview `http://127.0.0.1:4179/`, 기존 서버28669. Root games pointer/타 기여자 staged·dirty 파일 보존, push/배포 없음.

기본 관통 **창병22 >화차18 >총통12 >포수10 >궁수0**. 같은 레벨의 강화+4/+8 유지. Lv2=26/22/16/14/4, Lv3=30/26/20/18/8. 군악 피해/관통0. 비용·공격력·간격·range·파도·적 방어력·리그 등 다른 gameplay는 변경하지 않았다. Core/UI는 원래 공통 stats를 사용하므로 추가 runtime 분기 없음. 기존 R4 브라우저 관통 assertion은 stat source에서 읽도록 갱신했다.

| 명령(root cwd) | 결과 |
|---|---|
| `node --check portal-fe/public/games/duel-defense/js/data.mjs` |exit0 |
| `node --test portal-fe/public/games/duel-defense/tests/core.test.mjs` |**20 tests /20 pass /0 fail**, suite 한 번, [출력](r5-core-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r5-pierce.mjs` |390px 실제 hover+card click 선택 상세5종, Lv1~3 browser shared stats, **0console/page errors**, [출력](r5-browser-output.txt), [화면](r5-narrow-pierce.png) |
| `git -C portal-fe/public/games diff --check -- duel-defense` |exit0 |

숫자 감산은 동일: 방어26 중갑 상대 궁수1, 창병32, 화차16, 포수54 피해. 총통 주 표적 중갑 HP300→174, 부수 표적 방패 HP150→73. pierce 초과 추가 피해 없음. 모든 동일 레벨에서 strict ranking/exact values를 회귀 테스트한다.

브라우저는 새 게임 원래 시간/군량으로 실제 마우스 이벤트를 사용했다. 다섯 카드 hover tooltip과 click selected detail 모두 새 기본 관통과 일치, 구매 차감/상태/시간 주입 없음. Lv3는 실제 로드된 browser module/common stat과 단위 검증으로 확인했으며9단계 실제 강화 UI를 반복하지 않았다. 기존 core suite의 seeded 회귀는 그대로 포함하지만 별도 전체20 balance 도구·경기·원화/모션 검사·TypeScript 빌드는 data-only 변경에 반복하지 않았다. 게임 README의 R4 시간 기록은 당시 검증으로 명시해 현행 측정이라는 오해를 없앴다.
