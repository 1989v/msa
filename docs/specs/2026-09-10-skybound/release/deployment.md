# Skybound 베타 운영 배포 · 2026-09-13

공개 주소: https://game.1989v.com/games/skybound/index.html

사용자는 추가 게임 점검 없이 arena와 같은 게임 서비스에 먼저 배포하도록 명시적으로 요청했다. games 정적 저장소 → portal-fe 이미지 → 기존 OCI/Argo 운영 경로를 사용했다. 기존 게임 구현은 읽지 않았으며 배포 설정만 확인했다.

- games commit: `57aa280ee47f413767a699bd30b54572c8a06bbe` (skybound/ 파일6개)
- msa 운영 포인터 commit: `09d33d96e7bf1c5ad5cb48f030cccf717ccd7295`
- 이미지 빌드: https://github.com/1989v/msa/actions/runs/34749426589 — success
- 중복 수동 실행34749743787은 자동 실행 성공 확인 후 취소 요청.
- 원격 최신 브랜치의 별도 작업 공간: `/private/tmp/skybound-games-release`, `/private/tmp/skybound-msa-release`.

로컬 msa는 원격과 분기되어 있어 전체 로컬 브랜치를 push하지 않았다. 다른 작업자의 변경은 배포 커밋에 포함하지 않았다. 게임 카탈로그 DB 등록은 변경하지 않았으며 위 직접 실행 URL로 공개했다.

운영 HTTP 확인: index.html 200 및 제목 `바람의 유적 · 개발 베타`, build-metadata.json 200 및 일치하는 패키지 이름/생성 시각. 이 실행환경 curl의 인증서 체인 검증은 local issuer 오류였으므로 본문 확인은 `-k`로 수행했다. 서버 제공 인증서 issuer는 Let's Encrypt YE1/CN1989v.com. 브라우저 TLS/실기기 플레이 통과 주장 아님. 추가 게임 검사는 사용자 요청으로 실행하지 않았다.

롤백 필요 시 games 파일을 삭제하지 말고 운영 msa의 게임 서브모듈 포인터를 이전 `5b6f930af22079c1287135e794e5e8599157e6b6`으로 되돌리는 별도 커밋을 검토한다. 다른 게임 업데이트가 이어졌다면 Skybound만 되돌려야 한다.
