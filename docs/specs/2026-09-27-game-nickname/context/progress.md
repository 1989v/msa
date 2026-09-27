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
