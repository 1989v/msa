# R6 공개 브라우저 확인 — PASS

공개 URL: **https://game.1989v.com/games/duel-defense/index.html**
확인 시각:2026-10-06 01:36 KST (`2026-10-05T16:36:20.720Z`). 실제 공개 사이트를 isolated Chrome으로 확인했다. Parent live signal 이후에만 실행했다.

실행: `node /tmp/duel-beta-public-check.mjs > docs/specs/2026-10-04-five-banner-duel/verifications/r6-public-browser-output.txt 2>&1`

**exit0 /0 runtime·console·network failures**. [실행 출력](r6-public-browser-output.txt), [네트워크 status/MIME 기록](r6-public-network.json).

- 실제 원화6개 준비 완료·36 rig parts decode, header15/phase1/15.
- 실제 시작 준비45초, 공용 군량280, 빨간 숫자.
- 실제 카드 클릭→cursor carry→궁수 한 번 배치 군량40 차감(잔액240). 다음 빈 칸 클릭은 추가 구매/차감 없음. 창병 선택→Escape 취소는 무차감.
- 실제 공격 탭 선택 상세/연구 버튼의 척후81·대장군378 표시.
- **바로 시작** 클릭으로 전투 진입, 경로 이동 거리>20 확인. 실제 일시정지 후 시간/적 위치 전체가300ms 동안 고정.
- 별도390×844 페이지에서 공개 원화/15표시/시작45초 확인.
- 양 페이지에서 게임 경로 응답30건/고유15URL 수집. 모두 성공 status, module `text/javascript`, PNG `image/png`, HTML/CSS MIME 정상. 실패 요청0·실행/console 오류0.

| 화면 | 증거 |
|---|---|
|1440×900 첫 준비45초 |[Desktop](r6-public-desktop-prepare.png) |
|실제 연구 가격 |[공격 탭](r6-public-research-prices.png) |
|실제 출진/이동 |[전투](r6-public-battle.png) |
|390×844 공개 첫 시작 |[Narrow](r6-public-narrow-prepare.png) |

실제 clock와 실제 Input.dispatchMouseEvent/키 입력을 사용했다. 시간/군량/상태/단계 주입이나 RAF 가속 없음. 전체15경기·로컬 suite·원화/모션 검사를 반복하지 않았다. HTTP byte/SHA·카탈로그·CI/rollout 검증은 부모 담당이며 이 브라우저 기록과 구분한다. 이 작업자는 배포/게임 코드/카탈로그/root games pointer를 변경하지 않았다.
