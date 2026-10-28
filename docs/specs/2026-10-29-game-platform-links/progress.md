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

## 초기 독립 검토

검토자 /root/platform_links_review (clean-architecture-validator, 읽기 전용).

- 관리자 편집 패널의 최상위 중복 삽입으로 TS 변수 미정의: 구현 담당에게 수정 인계.
- outline 의미 토큰의 중복 shorthand 조립: 구현 담당에게 수정 인계.
- 관리 API visible에 부모 게임 공개 가능 상태 누락: 공개 조회는 차단 중이며 관리 응답도 일치시키도록 수정 인계.
- Domain/App/Infra 방향, 전용 DB/TM/JPA, enum/DDL, public 필터, batch, 새 탭/구서버 호환은 초기 소스상 적합.
- 실제 브라우저 화면은 미검증. CLI·컴포넌트 검사와 운영 API로 검증할 계획.

## 배포 전 운영 기준

- ssh msa-oci로 대상3개 content/portal-fe/admin-fe Ready=1 확인.
- Argo commerce Sync=Synced, operation=Succeeded. 전체 Health는 기존부터 Degraded로 표시되나 resource 목록에서 별도 unhealthy 항목은 없었다. 이번 변경과 구분해 대상별 rollout/API를 확인한다.
- 기존 기본 kubectl context는 회사 대상이므로 사용하지 않는다. 운영 조회는 개인 OCI 대상 ssh msa-oci로만 수행한다.

## 독립 재검토

초기3건 수정 확인. Domain/App/Infra 경계와 공개 batch·부모 필터·외부 링크·웹 플레이 보존에 추가 배포 차단 소스 결함을 발견하지 못했다. 관리 부모 상태 조회는 요청당 고정 횟수다. ui.md 구현 상태 문구도 갱신했다. 검토자는 테스트를 재실행하거나 브라우저를 사용하지 않았다.

## 최종 검증

구현 담당 실제 JVM 실행: domain105·feature40 (실제 MySQL18 포함), 실패/오류/skip0. 부모가 동일 Gradle 명령을 재실행해 BUILD SUCCESSFUL in 6s 확인(테스트는 입력 불변으로 UP-TO-DATE, 구조12개태스크 실행). XML 결과도 재확인했다.

- 명령: ./gradlew :game:domain:test :game:feature:test --tests '*GamePlatformRelease*' --tests '*GameQueryServiceTest' --tests '*EstimatedMinutesTest' --tests '*GameSchemaIntegrationSpec' verifyArchitecture --console=plain
- Portal: node scripts/render-content.mjs 후 npx tsc -b, 관련 Vitest2파일/10검사 통과. 기존 부가 API/act 경고는 stderr에 남으며 실패0.
- Admin: npx tsc -b 후 관련 Vitest2파일/8검사 통과. 기존 부가 API 네트워크 경고가 있으나 실패0.
- 독립검토 최종 추가4항목(URL raw 검증·폼 Enter·저장중잠금·JPA캡슐화/실제MySQL검사)도 차단 결함 없음.
- API 계약: openapi.yaml. 현재 V112 신규 테이블은 운영 배포 전이며 실제 Place ID 등록 없음.
- 이제 이번 변경만 커밋·main 반영하여 content/portal-fe/admin-fe 배포를 진행한다.
