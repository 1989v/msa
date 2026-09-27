# Skybound 폐기 기록 · 2026-09-27

사용자가 다른 프로젝트에서 통합 개발하기 위해 이 게임의 폐기와 배포 리소스 제거를 명시적으로 요청했다. 재구축 작업을 종료하며, 이 저장소에서 개발을 재개하지 않는다.

## 제거 범위

- games 정적 저장소의 skybound/ 전용 파일6개(HTML/JS/CSS/GLB/metadata/license).
- 이 저장소의 기존 개발 소스·에셋·검증 docs/specs/2026-09-10-skybound/.
- 미커밋 재구축 skybound/, 새 spec/ADR/인계 문서의 활성 작업 경로. 이 내용은 로컬 백업으로 보존했다.
- 기존 /games/skybound 및 그 하위 파일, /en/games/skybound 경로는 nginx에서410 Gone/noindex/no-store. 공용 SPA로 잘못 넘어가며200을 반환하지 않는다.

전용 Deployment/Service/Ingress/CronJob/워크플로 참조는 검색에서 발견되지 않았다. 공용 portal-fe·게임 도메인·인증·다른 게임 파일은 유지한다. 운영 카탈로그 GET /api/v1/games/skybound는404 NOT_FOUND여서 카탈로그/DB 삭제 작업은 발생하지 않았다. 브라우저 로컬 세이브는 서버 배포 리소스가 아니며 원격으로 삭제하지 않았다.

## 이관 자료(로컬, Git 비추적)

원본 작업 공간 .qa/retired-skybound/:
- rebuild-handoff-2026-09-27.zip — 다른 환경용 소스/빌드/문서, 996038bytes.
- complete-before-retirement-2026-09-27.zip — 구/신 소스 전체, 38503489bytes.
- HANDOFF.md — 복사할 프롬프트와 구현/검증/알려진 문제.
- manifest.json — 파일별 SHA256. ZIP의 CRC와 모든 제거 대상 포함 여부를 확인한 뒤 활성 경로를 삭제했다.

백업은 운영 배포에 포함하지 않는다. git 과거 이력은 재작성하지 않는다.

## 배포와 확인

- games 삭제 커밋: ece211b5 (원격 게시 결과 확인 후 운영 포인터 연결).
- 배포 전용 경로: /private/tmp/skybound-retire-games-20260927, /private/tmp/skybound-retire-msa-20260927.
- nginx:1.27-alpine nginx -t: syntax is ok / test is successful.
- 운영 이미지 실행/공개410 확인은 진행 중. 완료 시 아래에 결과를 기록한다.

<!-- source: portal-fe/nginx.conf -->
