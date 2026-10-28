<!-- source: docs/specs/2026-10-29-game-platform-links/spec.md -->

# 진행

- 사용자 승인: 설계대로 구현 후 배포까지.
- 작업 위치: /Users/gideok-kwon/.codex/worktrees/44e3/msa (원격 main 9a284307e 기반).
- 기존 로컬 main은 원격과 크게 갈라져 있어 수정/merge/reset하지 않는다. 원래 작업본의 미커밋 파일과 staging도 보존한다.
- 구현 담당은 gpt-6.1-sol 1명. 부모는 설계/독립 검토/배포 담당.
- 배포 대상: game을 포함한 content 앱, portal-fe, admin-fe. 기존 GitHub images→OCIR→Argo 경로를 확인 중.
- Roblox 자동 업로드/실판매는 범위 밖. 브라우저/화면 도구 사용하지 않음.

- 확인: 운영 game.1989v.com API는 정상이고 platformLinks는 아직 없다. 배포 호스트는 scripts/ci/topology.sh 기준 content.
- 입력 세부 결정: Roblox URL의 Place ID 뒤 선택적 게임 이름 슬러그 허용, 정규 출력에는 포함하지 않는다. HTTPS 정확 roblox.com/www.roblox.com 호스트만 허용하고 사용자 정보/임의 포트를 거부한다.
