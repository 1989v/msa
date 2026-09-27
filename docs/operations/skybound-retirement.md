# Skybound 폐기 기록 · 2026-09-27

사용자가 다른 프로젝트에서 통합 개발하기 위해 이 게임의 폐기와 배포 리소스 제거를 명시적으로 요청했다. 재구축 작업을 종료하며, 이 저장소에서 개발을 재개하지 않는다.

## 제거 범위

- games 정적 저장소의 skybound/ 전용 파일6개(HTML/JS/CSS/GLB/metadata/license).
- 이 저장소의 기존 개발 소스·에셋·검증 docs/specs/2026-09-10-skybound/.
- 미커밋 재구축 skybound/, 새 spec/ADR의 활성 작업 경로. 이 내용은 로컬 백업으로 보존했다. 기존 인계 문서 경로에는 다른 프로젝트의 링크가 끊기지 않도록 백업 위치 안내만 남겼다.
- 기존 /games/skybound 및 그 하위 파일, /en/games/skybound 경로는 nginx에서410 Gone/noindex/no-store. 공용 SPA로 잘못 넘어가며200을 반환하지 않는다.

전용 Deployment/Service/Ingress/CronJob/워크플로 참조는 저장소 검색에서 발견되지 않았다. 운영 commerce 네임스페이스의 Deployment/Service/Ingress/CronJob 이름도 조회했으며 Skybound 전용 리소스는 없었다. 공용 portal-fe·게임 도메인·인증·다른 게임 파일은 유지한다. 운영 카탈로그 GET /api/v1/games/skybound는404 NOT_FOUND여서 카탈로그/DB 삭제 작업은 발생하지 않았다. 브라우저 로컬 세이브는 서버 배포 리소스가 아니며 원격으로 삭제하지 않았다.

## 이관 자료(로컬, Git 비추적)

원본 작업 공간 .qa/retired-skybound/:
- rebuild-handoff-2026-09-27.zip — 다른 환경용 소스/빌드/문서, 996038bytes.
- complete-before-retirement-2026-09-27.zip — 구/신 소스 전체, 38503489bytes.
- HANDOFF.md — 복사할 프롬프트와 구현/검증/알려진 문제.
- manifest.json — 파일별 SHA256. ZIP의 CRC와 모든 제거 대상 포함 여부를 확인한 뒤 활성 경로를 삭제했다.

백업은 운영 배포에 포함하지 않는다. git 과거 이력은 재작성하지 않는다.

## 배포와 확인

- games 삭제 커밋: ece211b5e133dd643b05dfda5674c31378c43ab8 (원격 main 반영).
- MSA 폐기 배포 커밋: d15abc36a94956ca61a6c5ee91df7050fe241499 (최신 원격 변경 위에 통합 후 main 반영).
- images 실행: https://github.com/1989v/msa/actions/runs/36323177090.
- 로컬 원본 작업 공간의 소스 제거: 14450a82. 로컬 games 체크아웃의 전용 파일 제거: 630f6669. 다른 게임의 미커밋 변경과 기존 staged gitlink는 보존했으며, 이 로컬 games 커밋을 원격에 게시하지 않는다. 배포 포인터는 격리 작업 공간에서 반영했다.
- 배포 전용 경로: /private/tmp/skybound-retire-games-20260927, /private/tmp/skybound-retire-msa-20260927.
- nginx:1.27-alpine nginx -t: syntax is ok / test is successful.
- images 실행 결과: success. 운영 portal-fe 이미지는 ap-chuncheon-1.ocir.io/axyooxbyk5yv/portal-fe:d15abc3, rollout status는 `successfully rolled out`.
- 운영 컨테이너의 /usr/share/nginx/html/games/skybound 부재 확인: `PASS_SKYBOUND_ASSETS_ABSENT`.
- 2026-09-27 13:46 UTC 무렵 공개 URL을 캐시 무효화 쿼리 없이 확인했다. /games/skybound, /en/games/skybound 및 index.html, viewer.bundle.js, viewer.bundle.css, assets/naru-lod0.glb, build-metadata.json, THIRD-PARTY-NOTICES.txt 모두 HTTP410 + X-Robots-Tag:noindex + Cache-Control:no-store.
- 공용 /games는 HTTP200, /api/v1/games/skybound는 HTTP404. 로컬 CA 문제 때문에 curl -k로 HTTP 응답을 확인했으며 TLS 신뢰 검증 결과는 아니다. 원본 응답 기록은 .qa/retired-skybound/public-check.json.
- Docs Health 실행36323177140은 기존 검색 문서의 /posts/ 링크와 다른 문서의 출처 누락으로 failure. 게임 폐기와 무관한 문서는 수정하지 않았다. 전체 저장소 검사 통과를 주장하지 않는다.
- ci 실행36323177132: portal-fe 타입체크·테스트, YAML, Kustomize 검사는 success. 전체 실행은 cancelled이며 JVM compile 작업도 cancelled이므로 전체 CI 통과로 기록하지 않는다.

## 완료 상태

활성 개발 경로와 운영 전용 파일 제거, 운영 접근 종료, 이관 백업 보존을 완료했다. 전용 Kubernetes 리소스는 없었으므로 공용 리소스를 삭제하지 않았다. Git 이력·이전 공용 이미지·사용자 브라우저 캐시를 전부 소거한 작업은 아니다.

<!-- source: portal-fe/nginx.conf -->
