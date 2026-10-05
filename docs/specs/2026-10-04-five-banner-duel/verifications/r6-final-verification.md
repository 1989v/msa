# R6 15웨이브·연구비 검증 — 2026-10-06

게임 커밋 **8b2bc8c0**. 로컬 구현·검증 완료. Fresh static review SHIP, 부모 iteration에 기록한다. Preview `http://127.0.0.1:4179/`, 기존 세션28669. BETA 배포는 사용자 승인에 따라 부모가 별도 처리하며, 이 작업자는 배포/카탈로그/서브모듈 pointer를 변경하지 않았다.

- 기존 첫15개 웨이브/군량을 그대로 유지(마지막320,heavy10+charger6+siege4+general1). WAVES.length로 최종 종료/AI 마지막 연구·UI header/phase/help/result를 연결했다. 마지막 뒤 추가 준비/군량 없음, HP winner/draw·조기 붕괴 유지.
- 공격 연구만 두 단계 모두 `round(oldCost*.9)`. 유료 구매·수비 강화·웨이브 난이도·리그 변경 없음. 실제 연구 예산 AI 조건을 마지막15에 옮기고 수비8개 이상/공개 HP 조건을 유지했다.

| 병종 | 연구 Lv2 | 연구 Lv3 |
|---|---:|---:|
| 척후 |81 |149 |
| 질주병 |90 |162 |
| 방패병 |108 |189 |
| 중갑병 |153 |257 |
| 돌격병 |117 |203 |
| 공성병 |216 |351 |
| 대장군 |378 |594 |

## 명령·결과

Root cwd에서 실행했다. 구현 후 scoped suite 한 번, 실패 없음.

| 명령 | 결과 |
|---|---|
| `node --check portal-fe/public/games/duel-defense/js/core.mjs` |exit0 |
| `node --test portal-fe/public/games/duel-defense/tests/core.test.mjs` |**21 tests /21 pass /0 fail**, [출력](r6-core-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r6-browser.mjs` |실제15 label/help·7종 연구 버튼 가격·browser module 두 단계·실제6단계 연구 차감81/카트 잠금·**0console/page errors**, [출력](r6-browser-output.txt), [화면](r6-research-stage6.png) |
| `git -C portal-fe/public/games diff --check -- duel-defense` |exit0 |

Core는15개 구성/마지막 군량·결과/추가 준비 없음, 전체15 결정적 simulation,7종 두 단계 할인·정수반올림, 부족 무차감/정확한 연구 차감/카트 잠금, 수비/유료 가격 불변, 마지막 AI 연구를 검증한다. 기존 전투/입력/관통/경제 회귀도 함께 통과했다.

브라우저 성장 구간만 **테스트 페이지의 RAF timestamp×8**로 가속했다. 실제 클릭·정상 군량/구매/강화로6단계에 도달해 척후 카트 연구 거부→카트 반환→Lv2 연구 군량81 차감을 확인했다. 상태/단계/군량/웨이브 주입 없음. 그 외 두 단계 비용은 실제 로드된 module/common researchCost 검증이다.

별도 synthetic full15 도메인은 **15스테이지 생존 · 무승부**, HP20/20, 준비/지급15회, 전체 준비 대기 포함9.1분. 이전20단계12~15분 조건을 강제하지 않았으며15웨이브를 압축/재설계하지 않았다. 전체15 실제 브라우저 경기·원화/모션/전체 서비스 빌드를 반복하지 않았다.

게임/관련 검증/README만 정상 exact-owned commit. Root games pointer와 다른 기여자의 staged/dirty 상태 보존. 공개 URL/배포 검증은 부모의 BETA 완료 기록에서 별도로 확인한다.
