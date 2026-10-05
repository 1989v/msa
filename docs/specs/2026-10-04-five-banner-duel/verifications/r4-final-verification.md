# R4 통합 검증 — 2026-10-05

구현 완료·부모 실제 모션 확인·fresh-context 정적 리뷰 SHIP. 게임 커밋 **e5dddaa8**. 로컬 `http://127.0.0.1:4179/` (기존 serve 세션28669), 재시작 `node portal-fe/public/games/duel-defense/tools/serve.mjs`. 온라인/배포/push 없음. Root games pointer는 staging/수정하지 않았다. 기존 marine-command 브랜치와 다른 기여자의 staged/dirty 상태를 보존했다.

## 구현

- 명세의20개 군량/기본 습격·I~IV 등급, 숫자 방어력 감산/관통/최소1, 수비6역할·Lv1~3, 유료7병종·병종별 연구를 공통 stat 함수로 사용한다. 30초 강제 누수 제거, 유한 큐가 실제 경로를 이동한다.
- 강화/연구 잠금과 같은 군량·24명·카트 연구 금지, 현재 준비 구매/강화 지출만 정확히 한 번 환급. 기존 타워에 이번 강화 후 철거하면 강화금만 환급. 유료 연구와 기본 습격 등급은 별개.
- 사용자12~15분 선호: 준비1=45 /2~5=30 /6~10=20 /11~20=15초. 20까지 전체 준비415초. AI는 공개 정보와 자신의 전장만 보고 강화·유료 편성하며, 정상 예산에서 연구가 굶지 않도록16단계에 수비8개 이상이면 연구 예산을 먼저 잡는다.
- 투사체 도착과 피해/impact 동일 시점, 병과별 형태/폭/속도/지원파동. 창병은 captured 대상만 현재 range/고정 직선 폭28/forward를 다시 확인하고 최대3명. 이동 preview도 기존 병사 Lv3 range를 사용한다.
- 기존 단일 PNG 컷아웃의 가려진 허벅지로 생긴 절단 흔적을 그대로 출하하지 않았다. 부모 승인 투명9×4 부품 원화 추가, 원본 유지. 독립 팔/허벅지/정강이/부츠 관절과 실제 PATH stance 접지점 사용. 몸 크기 비례 보폭(전체.72body, 접지 반주기.36body), pause/reduced-motion. 2D이며3D/새로운 전체 캐릭터 원화라고 주장하지 않는다.

## 명령과 결과

아래는 root cwd에서 실행했다. 구현 후 통합 검증 후 실패/변경 관련 체크만 다시 실행했다. 처음 browser의 `관통20` 공백을 빠뜨린 assertion은 실제 표시 `관통 20`에 맞춰 수정했다. AI 연구 예산 변경 후 core/seeded 비교만 재확인했다. 비교표 군악 DPS0 표기 수정은 report script만 재실행했다.

| 명령 | 결과·출력 |
|---|---|
| `node --test portal-fe/public/games/duel-defense/tests/core.test.mjs` | **19 tests /19 pass /0 fail**, [core 출력](r4-core-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/verify-assets.mjs` |6 PNG·chroma-key PASS, 전용 rig36부품 browser decode, [원화 출력](r4-assets-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r4-balance.mjs` |seed7 결정적 전략·전체20·병과 비교, [출력](r4-balance-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r4-e2e.mjs` |실제 mouse carry/drag/atomic invalid/cancel, pause-help,7종 실제HP/armor, paid general180 출현; 성장/연구2·3/카트 잠금/레벨range,6 FX관찰, native touch와44px, **0console/page errors**, [출력](r4-e2e-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r4-layout.mjs` |1440×900 /1280×800 /1200×1000 /900×1100 /900×900 /390×844 **모두 PASS**,25버튼44px·modal 내부/viewport bounds,red numeral computed rgb(162,35,29),큰 desktop no-scroll, [출력](r4-layout-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r4-motion.mjs` |dedicated parts 거리 기반 contact sheet 생성, [화면](r4-walk-contact.png) |
| `node portal-fe/public/games/duel-defense/tools/r4-walk-video.mjs` |실제15초 canvas30fps WebM·좌향/코너/세로/우향, **시각/상태 주입 없음**, [모션 출력](r4-motion-output.txt) |
| `node portal-fe/public/games/duel-defense/tools/r4-filmstrip.mjs` |실제 WebM6.000~6.469초8프레임 동일 road crop, [필름스트립](r4-actual-footplant-filmstrip.png) |
| `node portal-fe/public/games/duel-defense/tools/r4-effects.mjs` |실제 플레이로 궁수/창병/포수/군악4종 캡처, [출력](r4-effects-output.txt) |
| `cd portal-fe && npx tsc -b --noEmit` |exit0, [출력](r4-tsc-output.txt) |
| `git -C portal-fe/public/games diff --check -- duel-defense` |exit0 |

Core19는 감산/관통/최소1·병과 역할, Lv별 stats, atomic 구매/이동/강화/연구/환급/카트, support 최고 비중첩, 창병 max3/corridor 및 도착 때 재확인, 개별 AoE/부수55%·보드 분리·한 번 타격, 기본/유료 등급, 실제 경로/30초 초과,20결과/동시0, pause/gait/reduced-motion, AI privacy/연구, seeded full20, **stance world position <1px 유지(코너 포함)**를 확인한다.

## 전략 비교와 시간

게임 수치/군량/웨이브는 승인 명세 그대로다. 전략·AI 연구 예산 순서만 공개 정보 계약 안에서 조정했다. Domain simulation은 synthetic, 시간은 실제 전투 simulation 합 +모든 준비 전체 대기이며 실제 사용자의 플레이 시간 측정이 아니다.

| seed7 전략 | 종료 | 최종 HP 내/상대 | 전체 대기 포함 |
|---|---:|---:|---:|
| 수비 우선 /AI |18 승리 |20/0 |13.07분 |
| 혼합 /AI |18 승리 |6/0 |13.86분 |
| 공격 우선 /AI |3 패배 |0/17 |2.85분 |
| 수비 우선 양측 |20 무승부 |20/20 |13.17분 |

최종 full20 전투 약375초 +준비415초. AI 상대 수비/혼합은 목표12~15분에 들어오고, 약한 수비는 일찍 패배한다. 단순 DPS 표만으로 최종 밸런스 확정이라 주장하지 않는다. 갑옷26 단일 예시에서 궁수1.11 /창19.13 /포수36.67 DPS, 화차.4는 광역 이득 별도, 군악0은 지원 별도다.

## 실제 입력과 synthetic 구분·시각 증거

`r4-e2e` 성장 구간은 **테스트 페이지에서만 RAF timestamp×8**로 진행을 가속한다. 실제 버튼/포인터로 정상 군량 구매·강화·연구를 수행하며 state/stage/군량/파도 주입은 없다. 1~11까지 실제 UI 진행, 전체20은 domain simulation. R3 실제45초 자동 출진 이력은 보존했고 이번에는 시간 함수/전환 및 회귀 입력을 scoped 검증했다. `r4-walk-video`·`r4-effects`는 원래 clock 그대로의 실제 플레이다.

- [걷기 WebM](r4-actual-walk.webm), [실제 코너 필름스트립](r4-actual-footplant-filmstrip.png), [6초 좌향→코너](r4-actual-walk-1.png), [12초 우향](r4-actual-walk-3.png)
- [Lv3 이동 범위](r4-upgraded-move-range.png), [Lv2 연구](r4-research-stage6.png), [Lv3 연구](r4-research-stage11.png)
- [desktop 공격 통계](r4-attack-stats-desktop.png), [390px 공격 통계](r4-attack-stats-narrow.png), [desktop](r4-layout-1440x900.png), [390px](r4-layout-390x844.png)
- [화살](r4-effects-archer.png), [창](r4-effects-spear.png), [총](r4-effects-gunner.png), [군악 지원](r4-effects-drummer.png)

Fresh review의 유효 결함4개(창 범위/axis 재확인, 강화 이동 preview, role 관통 중복, 발 미끄러짐) 모두 수정. [부모 독립 리뷰](r4-review.md) SHIP. 부모는 최종 part sheet와 실제 recorded filmstrip/route 화면을 시각 확인·승인했다. 온라인/실사용 장시간 playtest/최종 난이도 확정은 범위 밖. 기존 root games pointer의 타 작업 이력 문제는 유지되어 부모의 별도 통합 결정이 필요하다.
