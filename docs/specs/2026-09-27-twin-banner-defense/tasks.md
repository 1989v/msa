# Task Breakdown: 쌍성 수비대

사용자 승인: 수정 시안 그대로 개발, 개별 에셋과 공격 모션 구현(2026-09-27).

## Overview
Total Task Groups: 5. 검증 통과 뒤에만 완료 체크.

### Task Group 1: 승인 아트와 제작 계약
Dependencies: None. Phase: art. Required Skills: imagegen.
- [x] 개별 아틀라스(아군10종, 적3종+보스)와 빈 전장 제작.
- [x] 프레임 순서·발 접점·투명도·공격 타이밍 manifest 작성.
- [x] 갤러리로 모든 종류를 검사하고 승인 그림과 비교.
- Verify: `node tools/verify-assets.mjs` + 브라우저 갤러리 육안 검증.

### Task Group 2: 시뮬레이션
Dependencies: spec review. Phase: core. Required Skills: hns:implement-tasks.
- [x] 경제/소유권/합성/공격/승패/AI/스냅샷 관련 핵심 단위 테스트.
- [x] 순수 모듈, 고정 스텝, 웨이브,10종 특성,적3종+보스,저장 검증.
- Verify: `node --test tests/core.test.mjs`.

### Task Group 3: 렌더·UI·애니메이션
Dependencies: spec review; core/art interfaces. Phase: client. Required Skills: frontend-design.
- [x] 전장 렌더러, 실제 프레임 공격/보행, 투사체와 효과, 갤러리.
- [x] 소환/선택/이동/합성/강화/지원·모바일 배치 패드·메뉴·승패·소리.
- Verify: `node --test tests/client.test.mjs` + 브라우저 실제 입력과 스크린샷.

### Task Group 4: 협동
Dependencies: spec review; core interface. Phase: network. Required Skills: hns:implement-tasks.
- [x] protocol client + dev relay, 로비·명령 검증·스냅샷·이탈 승계.
- [x] 메시지 제한과 위조·중복 명령 테스트,2브라우저 일치/나가기/다시하기 검증.
- Verify: `node --test tests/network.test.mjs` + `node tools/e2e.mjs`.

### Task Group 5: 통합·품질
Dependencies: 1,2,3,4. Phase: verify. Required Skills: hns:verify.
- [x] 핵심 테스트 직접 재실행, 자연 플레이 싱글/협동, 애니메이션 상태 실제 관찰.
- [x] 독립 리뷰, 발견 수정, 자산 출처/실행 README/검증 보고와 scoped commit.
- Verify: `node --test tests/*.test.mjs`, `node tools/verify-assets.mjs`, `node tools/e2e.mjs`.

### Task Group 6: Stage-varying routes and release (2026-09-28)
Dependencies: initial implementation. User authorized revision and deployment.
- [x] Route geometry/core persistence/version2 + stage tests.
- [x] Center-road artwork, current/next invasion preview and help.
- [x] Browser regression, compatibility tests and fresh review.
- [x] Scoped remote release, production assets and two-browser online verification.
