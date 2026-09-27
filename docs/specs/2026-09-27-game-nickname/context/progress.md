<!-- source: game/feature/src/main/kotlin/com/kgd/game/application/profile/service/GamePlayerProfileService.kt, portal-fe/src/game-profile/GameProfileHost.tsx -->

# Progress

- 위치: /Users/gideok-kwon/IdeaProjects/msa 공유 트리. 다른 작업 변경 다수, 본 작업 파일만 커밋.
- 완료: guest/member 고유 프로필, 소유권 기반 점수, legacy 보존, 전역 모달과 게임 위젯, 실제 MySQL/브라우저 및 fresh review.
- 검증 증거: ../verifications/final-verification.md 및 browser-report.json, desktop.png, mobile.png.
- 다음: 사용자가 운영 반영을 요청하면 games submodule의 기존 미반영 pointer/관련 선행 변경을 확인하고 배포 계획 수립. 운영 migration/배포 미실행.
- 제한: 공유 tree global doc-index lock drift. 무관한 변경을 포함하지 않기 위해 전역 재생성 안함.
- 재현 비용이 있는 산출물: /private/tmp/game-nickname-validation/verification-final.log (서버27초), browser.mjs와 browser-report.json (브라우저 수초), /private/tmp/game-nickname-backend-final.log. 영속 증거는 verifications에 복사.
- 함정: MySQL REPEATABLE_READ snapshot 경합→READ_COMMITTED+profile lock; delayed401 자동재시도→계정B오염 방지를 위해 profile PUT retry차단; 저장중 시작GET→PUT완료generation무효화. Vite가 apply_patch CSS변경을 감지하지 못해 서버 재시작 후 4테마대비를 다시 검증함.

- 구현 커밋: msa e64c70c4, games e1c6bc4a (codex/game-player-nickname). root submodule pointer는 작업 전부터 dirty라 포함하지 않음.

## 2026-09-28 deployment continuation
- User authorized deployment. Isolated root worktree: /private/tmp/msa-game-nickname-release (release/game-nickname), base origin/main 6d1469d0. Games worktree: /private/tmp/games-nickname-release. Shared tree is untouched.
- Latest HttpOnly auth and operator/automation excluded score behavior preserved during cherry-pick; root d20ec036 + 7a8f7499. Games 38b70b2b pushed to main.
- Release validation: Gradle BUILD SUCCESSFUL in 1m26s; domain72 + feature286 (MySQL17, skipped0) + gateway114 =472, no failures. Portal tsc-b and 83 tests PASS; widget9 PASS.
- Fresh review found standalone expired-session recovery missing; adding owner-guarded refresh with no mutation replay, then re-review/test before root push.
- Next: commit release verification, push root main (normal fast-forward), monitor images workflow (gateway/content/portal-fe), Argo rollout, production smoke. Do not reset or merge shared dirty main.
- Evidence: /private/tmp/nickname-release-tests.log, /private/tmp/nickname-release-frontend.log. Initialized auth/gifticon/games at release pointers. gh account1989v required by push hook.

## Deployment complete
- Production nickname images: gateway/content/portal-fe9b5989c, all rollout success and Ready1. V102 applied success1. Public guest create/duplicate/rename/mobile/security/automation-exclusion checks PASS; temporary profiles deleted2, remaining0.
- Evidence: ../verifications/deployment.md, production-browser-report.json, production-api-report.json, production-mobile.png. Release worktrees retained; shared working tree remains untouched.
- Follow-up ontology citation correction af49c196 locally verified (OntologyFilesSpec4pass); automatic CI pending at evidence snapshot. No further nickname rollout action required.
