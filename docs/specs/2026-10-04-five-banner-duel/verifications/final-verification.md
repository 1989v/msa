# P1 통합 검증 — 2026-10-05

구현 games commits `37abce08`(prototype), `cbf9b5e3`(aspect geometry/deadline regression), 최종 HEAD `cbf9b5e3`. 검증 담당은 구현자 gpt-6.1-sol 한 명. 부모는 같은 테스트를 반복하지 않는다. T1~T5 완료, 부모 fresh-context 최종 verdict 대기. 온라인·배포·카탈로그 변경 없음.

## 명령·실제 증거

| 검증 | 명령 (repo root 기준) | 결과 |
|---|---|---|
| Core | `node --test portal-fe/public/games/duel-defense/tests/*.test.mjs` | `# tests 12`, `# pass 12`, `# fail 0` — [출력](unit-output.txt) |
| 추가 support 검증 | `node --test --test-name-pattern="two nearby" portal-fe/public/games/duel-defense/tests/core.test.mjs` | 추가1 `# pass 1`, `# fail 0` — [출력](support-output.txt) |
| 추가 전투 deadline | `node --test --test-name-pattern="30-second" portal-fe/public/games/duel-defense/tests/core.test.mjs` | 추가1 `# pass 1`, `# fail 0` — [출력](deadline-output.txt) |
| 원화 | `node portal-fe/public/games/duel-defense/tools/verify-assets.mjs` | `5 approved raster assets + chroma-key checks PASS` — [출력](asset-output.txt) |
| FE compile | `cd portal-fe && npx tsc -b` | exit0, 오류 출력 없음. 정적 ES module은 추가로 Chrome 실제 로드함 |
| 실제 게임 E2E | 서버 실행 후 `node portal-fe/public/games/duel-defense/tools/e2e.mjs` | `Chrome E2E PASS · 0 console/page errors` — [출력](e2e-output.txt) |
| 변경된 UI focused | `node portal-fe/public/games/duel-defense/tools/layout.mjs` | 6종 viewport(1440×900/1280×800/1200×1000/900×1100/900×900/390×844), 이동/환급,44px 및 clipping 확인 PASS — [출력](layout-output.txt) |
| 중간폭 수직 확인 추가 | `LAYOUT_FOCUS=intermediate node portal-fe/public/games/duel-defense/tools/layout.mjs` | 스크롤 후 모든25 번호 버튼의 left/right/top/bottom viewport 안,44px PASS — [출력](pad-viewport-output.txt) |
| 파일 정합 | games/root scoped `git diff --check` | exit0 |

실행 실패 후 전체 core/build 반복 없이 해당 UI 검증만 수정·재실행했다. 첫 CDP 실패는 phase→DOM refresh race, 이후 desktop height/중간폭 target clipping은 실제 CSS 결함이었다. 최종 로그는 수정 후 성공 출력이며 초기 failure를 숨겨 성공으로 취급하지 않는다.

## 실제 유저 입력 플레이

CDP mouse events로 타이틀 시작, 초기 궁수4명(160 지불), 단계마다 새 궁수1명(40 지불)과 아래 실제 유료 카트를 입력했다. combo select는 실제 DOM change event, 다른 모든 편성·출진은 화면 버튼 입력이다. 실시간 전투를 기다렸으며 window 진단 객체는 read-only snapshot이다. 군량/HP/시간 주입·자동 테스트 전투 시계는 없다.

| 단계 | 카트 | 수비 비용 | 출진 후 잔액 | 출진 전 양측 HP |
|---|---|---|---|---|
| 1 | 척후4 | 40 | 20 | 20 / 20 |
| 2 | 방패3 | 40 | 40 | 20 / 20 |
| 3 | 중갑2 | 40 | 48 | 20 / 20 |
| 4 | 중갑1+군악2 | 40 | 72 | 20 / 20 |
| 5 | 중갑2+방패2 | 40 | 56 | 20 / 20 |

5단계 출진 queue와 실제 이동 enemy에서 대장군1명 확인. 내 완성 보상1회. 종료 문구 `5스테이지 검증 종료`, 최종20/20. 실제 재시작→title 확인. AI는 척후3단계 계획으로 같은 예산을 소비했다. 이 전략의 무누수 생존은 재현 가능한 prototype tuning 사례이며 최종 밸런스 확정은 아니다.

390px에서 실제 편성 증가, pause/resume, pause→help→close/Escape→pause 보존을 확인. focused input은 초기 궁수 구매→0칸 선택→24칸 이동→현재 준비 철거160 전액복구를4종 viewport에서 확인.

## Synthetic core 시나리오와 구분

경제 거절·카트 반환·이월 cap·25칸·전투 잠금, 부족/전환 조합 초기화·완성1회·기본습격 제외, stage5 general gateDamage6, combo 전에 HP0 패배, 같은 tick 양측0 무승부, 30초 제한, frame time cap, 비중첩 군악을 Node 상태 fixture로 검증했다. HP0/동시 사망은 synthetic이며 실제 일반 플레이로 거짓 보고하지 않는다. core unit fixture의 예산 확대는 rejection/25칸 규칙 검증에만 사용, 위 브라우저5단계는 실제 지급 군량만 사용했다.

## 화면 증거

- [실제 전투](shots/combat-desktop.png), [5단계 대장군](shots/general-stage5.png), [검증 결과](shots/result-desktop.png)
- 최종 controls/viewport: [1200×1000](shots/final-layout-1200.png), [1440×900](shots/final-layout-1440.png), [1280×800](shots/final-layout-1280.png), [900×900](shots/final-layout-900.png), [390×844](shots/final-layout-390.png)
- [좁은 화면 실제 편성](shots/narrow-controls.png)

1440/1280 scrollHeight 각각900/800, 출진 버튼 bottom809.25/709.25. 1200×1000 scrollHeight1000 및 출진 bottom809.64 확인. 측면 번호 pad 폭236+margin16을 실제 available column에서 빼고 두 scene size를 함께 계산해 모든 aspect ratio를 보장한다. 900/390은 스크롤 접근을 허용하며 pad의 모든 버튼은44×44 이상. 모든 visible button/select 최소44px 확인. 같은 논리 전장을 내/AI 배율만 달리 그린다. 25번호와 실제 grid mapping, 열린 독립 이동로/상단 성문/방향 arrows, 승인 원화의 발 anchor와 body .5 cell scale, DPR backing, reduced-motion CSS, DOM 요약 확인.

## 범위·잔여 사항

정적 독립 game만 변경. root DESIGN.md 승인 상수7종 사용, 추가 임의 hex 없음. 기존 협동 게임 파일/서비스/DB/온라인·운영 배포 변경 없음. UI는 DOM 텍스트, Canvas simulation/sprites이고 시안 통이미지 버튼 오버레이가 아니다. 원본 아틀라스4개 복사, 새1254×1254 빈 전장만 독립 반복 렌더링.

Root games pointer는 이번에 갱신하지 않음: 기존 root58dd81be→worktree36bcf951 차이에 타 작업 이력이 있어서 부모가 별도 통합해야 한다. 이번 game commitcbf9b5e3만 보존. 로컬 preview는 정상이다.
