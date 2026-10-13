# 선두 포커스·폭포 마지막 회전체·동적 슬로모션 검증

작업 위치: `/Users/gideok-kwon/.codex/worktrees/d3c3/msa`. 사용자 최신 요구는 참고 레포와 비슷한 동적 감속이며 직전0.68배속 계획을 대체한다. 실제 미결정 cutoff가 close contest group 안에 있을 때 입구거리로1→0.30 목표배속을 정한다. 최대burst1.6 active wall초/라운드3.2 active wall초/cooldown2.5초. 정상속도 복귀는 기존 dt×7 easing의 짧은 tail이 있으며 활성 budget이 tail 전체를 의미하지는 않는다. 완료는 즉시1로 초기화한다. 수동0.34/reduced-motion 규약 유지. 참고: https://github.com/lazygyu/roulette/blob/main/src/roulette.ts .

- `npx vitest run tests/games/marbleCompetition.test.ts`: **Test Files 1 passed (1), Tests29 passed (29)**,8.81s. 4모드 매 fixed-step 위치/시간/순위/당첨 및 결과문자열 baseline 동일. 현재 선두 카메라/handoff/수동강조 보존. 실제 mode cutoff, 거리별 감속, 최소0.30, 30/60/120Hz burst/예산/cooldown/retrigger/recovery, 분리/pipe/first·rank 해결/완료, reduced-motion/manual 확인. 최종 dynamic 소스의 cascade 대표30/60/120Hz 자연재생은 같은 seed15838 FF 순서와 동일.
- `npx vitest run tests/games/marbleCascadeFinish.test.ts -t 'preserves five|physical spin'`: **Tests2 passed |1 skipped (3)**,895ms. 다른5코스 전체 hash, cascade 입구/앞구간/기존 finish translation 보존. 신규 마지막3rotor가 실제 정상재생에서 spin 충돌을 발생함. 이미 수행한134회 matrix test는 의도적으로 반복하지 않았다.
- 기존 `focus-cascade-finish.json`: **30 replay pairs,134 simulations,60 seeds/360samples,rho=-0.11603699664774364**,30/60/120Hz/FF 순서 통과. 자동0.42의 이전 presentation에서 측정된 관찰값이며 최신 동적감속의 wall-time 체류 자료가 아니다. 물리/RNG/geometry는 그 이후 동일. 실제 simulation-time upstream 체류 평균1.805444→2.345208초, approach2.324944→2.872014초. 따라서 단순 코스 길이와 별도로 구간 체류 증가를 확인했다. 유한표본은 완전한 무편향 증명이 아니다.
- 기존 expansion suite가 초기 검증 command에 포함돼1회 실행됨: **marbleCourseExpansion3 passed (3)**,126.454s. 변경된 역사적 matrix 산출물은 원래 HEAD 내용으로 복원하여 과거 evidence를 덮어쓰지 않았다. 초기 old slow frame 동일성4실패는 의도적으로 변경된 timing에 대한 obsolete assertion이며, 최종 fixed-step 불변성 검사29개는 통과했다.
- touched-test eslint exit0; root/games `git diff --check` exit0.
- 최종 소스 `npm run build` **exit0**: tsc -b, Vite **✓ built in5.46s**, `[seo] 프리렌더184개 페이지 · 게임82종`, `[html] 주석 제거892개 파일 ·1410.0KB절감`까지 완료.
- Fresh-context parent review: **SHIP**, blocking findings 없음.

브라우저·UI·클립보드·방 생성 없이 non-UI 검증만 했다. 다른6개의 untracked 과거 QA 산출물은 이번 커밋에서 제외한다. 구현자는 push/deploy하지 않는다.
