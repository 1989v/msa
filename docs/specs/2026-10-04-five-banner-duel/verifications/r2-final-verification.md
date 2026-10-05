<!-- source: portal-fe/public/games/duel-defense/js/core.mjs, portal-fe/public/games/duel-defense/js/main.mjs, portal-fe/public/games/duel-defense/js/data.mjs, portal-fe/public/games/duel-defense/tools/e2e.mjs, portal-fe/public/games/duel-defense/tools/layout.mjs -->
# R2 직접 구매·드래그 배치 검증 — 2026-10-05

정본: [R2 변경 명세](../iterations/02-direct-purchase.md). games commit **`70b818c1`**. P1 출력/화면은 그대로 이력으로 보존했다. R2 독립 fresh-context 리뷰는 부모 확인 **SHIP**. [리뷰](r2-review.md).

## 구현 결과

제목→1단계 공용260→120/140/160/180, 수비/공격 같은 잔액. 별도 초기 phase·조합·장부·완성 보상·AI 계획 선택 제거. 공격은 척후10/방패20/중갑40/대장군160 직접 구매. 대장군 HP850/speed42/성문6 유지, paid 마지막 출현. 처치 보상 없음, 기존 carry·24명·phase lock·동시 성문 판정 유지. AI는 같은 예산의 타워/유료 부대 구매를 사용하며 상대의 현재 비공개 cart를 읽지 않는다.

UI는 상단 성문/단계/타이머/군량1개, 독립 두 전장, 수비/공격 카드와 상세·출진. 상시 번호 pad 없음. 44px 배치 도움 dialog는 번호 선택·이동·키보드 대안. 실제 mouse/touch Pointer Events로 카드/배치 병사 드래그, portrait ghost/빈칸/실제 사거리 원 미리보기. 유효 release 때만 core buy/move. 밖/상대/occupied/insufficient/cancel/phase 전환 무차감. 작은 화면에서 가장자리 drag autoscroll. 배치 병사 선택은 바닥 표식·실제 사거리, 군악수는 공격속도+30% 비중첩. 구매 불가도 카드 정보 선택 가능.

수비 상세는 실제 damage/interval/GRID.cell 환산 사거리/role. 공격은 실제 HP, speed/67.2(칸/초), gate damage. 표기 속도는 척후.92/방패.77/중갑.68/대장군.63칸/초. 원화와 기본 전투 HP/공격 밸런스는 추가 변경 없음. sound localStorage mute를 최초 label/aria에도 적용.

## 실행한 검증

| 명령 | 실제 결과 |
|---|---|
| `node --test portal-fe/public/games/duel-defense/tests/*.test.mjs` | `# tests 12`, `# pass 12`, `# fail 0` — [r2-unit-output.txt](r2-unit-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/verify-assets.mjs` | 5 PNG, `5 approved raster assets + chroma-key checks PASS` — [r2-asset-output.txt](r2-asset-output.txt) |
| `cd portal-fe && npx tsc -b` | exit0, 오류 출력 없음. 정적 ES module syntax/runtime는 Chrome 실제 로드로 확인 |
| 서버 실행 후 `node portal-fe/public/games/duel-defense/tools/e2e.mjs` | `R2 Chrome E2E PASS ·0 console/page errors` — [r2-e2e-output.txt](r2-e2e-output.txt) |
| 정보 선택 tweak 후 `R2_INPUT_ONLY=1 node portal-fe/public/games/duel-defense/tools/e2e.mjs` | 변경된 입력/정보/cancel/작은화면/sound만 PASS, 전체5단계 재실행 없음 — [r2-input-output.txt](r2-input-output.txt) |
| 최종 CSS `node portal-fe/public/games/duel-defense/tools/layout.mjs` | 여섯 viewport, 수비+공격 wide no-scroll, dialog44px 모든 bounds, 실제 키보드/이동/환급 PASS — [r2-layout-output.txt](r2-layout-output.txt) |
| 게임/문서 scoped `git diff --check` | exit0 |

한 번의 통합 검증 후 실패/변경된 UI만 재검증. Layout 첫 native Enter 실패는 CDP `keyDown`에 text가 없어 browser activation이 안 된 테스트 드라이버 문제였다. `text:'\r'`/native Enter payload로 교정 후 키보드 구매 확인. Desktop 공격 카드는 수비 카드보다 높으므로 height reserve를365px로 잡고 양쪽 탭 no-scroll를 재검증. Core와5단계 실제 플레이를 불필요하게 반복하지 않았다.

## 실제 사용자 입력 결과

CDP 실제 mouse drag로 궁수 카드→빈0칸:260→220. 점유칸/바깥/상대 전장 drop 무차감. 기존0→5칸 이동 무차감. 두 궁수80과 대장군160 구매 후20 잔액, 대장군 실제 상대 queue/enemy에서1명 확인. 부족한 총통 drag와 combat drop은 무차감, ghost/preview cleanup 확인. 준비20초 마지막에 held drag 상태로 시간이 끝나면 자동 출진하고 군량260·수비0 그대로 유지.

실시간 일반 AI match에서 단계2~5 준비에 실제 구매·Canvas 클릭·출진. 종료 **`5스테이지 검증 종료`**, 성문 **18/20**. 재시작→title 확인. 예산·HP·타이머 주입 없이 wall clock을 기다렸다.

390px 실제 touchStart/Move/End로 카드→빈칸(가장자리 autoscroll) 구매. touchCancel 전에 dragging 상태가 참인 것을 확인한 후 무차감 cleanup. modal44px 번호칸 실제 클릭 구매. pause→help→닫기/Escape는 기존 pause 보존. 음소거→같은 page reload 시 label/aria는 꺼짐, 첫click은 unmute. 콘솔/page errors0.

Node synthetic 사례는 common260/carry, general160 구매반환/무료spawn 없음, 24명/무효수량/occupied/ownership, combat/pause lock, HP0와 same-tick draw,30초 deadline/5단계 종료, armor piercing, defensive support 비중첩, AI 동예산/같은 공개 상태 전략을 다룬다. Synthetic fixture를 일반 사용자 플레이로 보고하지 않았다.

## 화면·viewport

- [실제 드래그 portrait/사거리](shots/r2-drag-range-desktop.png)
- [대장군 직접 구매·HP/속도](shots/r2-attack-stats-desktop.png)
- [유료 대장군 전투](shots/r2-paid-general-combat.png), [실제 결과](shots/r2-result.png)
- [1440×900](shots/r2-layout-1440x900.png), [1280×800](shots/r2-layout-1280x800.png), [1200×1000](shots/r2-layout-1200x1000.png)
- [900×1100](shots/r2-layout-900x1100.png), [900×900](shots/r2-layout-900x900.png), [390×844](shots/r2-layout-390x844.png)
- [390px 공격 정보](shots/r2-attack-390x844.png), [44px 배치 도움](shots/r2-narrow-pad.png)

Wide 준비 화면 scrollHeight1440/1280/1200 각각900/800/1000. 수비 탭 출진 bottom783/683/883. 공격 탭도 viewport 안에 모든 주요 컨트롤과 전장(별도 height assertion) 확인. 900px 두 aspect도 page scroll 없음. 390px은 세로 스크롤 허용, width overflow 없음. 상시 DOM 번호판은 숨김, 열린 dialog의25개44×44 번호 버튼은 모든 viewport bounds 안. 실제 Enter로 같은 cell handler 구매 확인.

## 저장·잔여

preview `http://127.0.0.1:4179`, 기존 serve session28669. 게임 커밋70b818c1만 추가; root games pointer 갱신 없음. 다른 marine/lib/platform 등 작업 수정·스테이지·되돌림 없음. 정상 git commit, 훅 우회 없음. Root warn-only doctor의 기존 uncited-doc 경고는 범위 밖.

5단계 AI prototype이며 최종 balance/온라인/배포/카탈로그/새 원화는 포함하지 않는다. 작은 화면 드래그는 edge scroll 또는 클릭/44px 보조 입력을 사용한다. 부모가 root 명세/디자인 변경을 마무리한다.
