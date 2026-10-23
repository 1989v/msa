# Woodland Haven 공개 베타 운영

승인 범위: ADR-0104의 2026-10-23 계약. 하나의 협동 월드, 동시8명/등록64프로필. 등록 정원이 차면 기존 기록을 삭제하거나 계정을 교체하지 않고 정원 초과를 안내한다. 서버가 꺼져 있는 동안의 성장은 소급하지 않는다.

## 인증과 실행

기본 주소 `https://game.1989v.com/games/woodland-haven/index.html`은 공유 월드다. 게임 닉네임 버튼으로 ADR-0102 프로필을 설정한다. 명시적 `?offline=1`은 기존 브라우저 저장을 사용한다. 로컬 loopback `?online=1`은 개발용 게스트 서버이며 운영에서 `/api/guest`를 제공하지 않는다.

브라우저 → gateway `POST /api/v1/games/woodland/tickets` → content 전용30초 일회용 접속권 → Node `/api/v1/games/woodland/join` → content 내부 redemption 순서다. 내부 API는 `X-Woodland-Bridge`의 필수 비밀로 보호되고 gateway에는 라우트가 없다. 브라우저가 profile UUID·닉네임·회원 헤더를 직접 제출해 신원을 정하지 못한다. 운영 세션은 Secure/HttpOnly/Strict/namespace Path 쿠키로1시간 유지하고55분에 접속권을 다시 받는다. 플랫폼 access token 갱신은 기존 GameRank refreshProfile 흐름을 먼저 거친다. 재인증은 같은 프로필의 이전 쿠키와 SSE를 폐기한다.

기존24hex 저장ID에 platformPlayerId를 별도 저장한다. 로컬 게스트는 읽을 수 있지만 플랫폼 계정에 자동 귀속하지 않는다. 첫 운영 PVC는 새 월드다. 로컬 QA 데이터는 가져오거나 초기화하지 않는다.

## 배포

`images.yml`은 games gitlink 변경 시 portal-fe와 woodland를 빌드한다. game Kotlin 변경은 content, gateway 변경은 gateway를 빌드한다. CI 성공 후 OCIR SHA 태그를 OCI overlay에 commit-back하고 Argo가 적용한다. `woodland`와 `content`는1replica/Recreate로 단일 소유자를 유지한다. 공유 PVC에 동시 writer를 띄우지 않는다.

배포 전에 개인 OCI 대상 `msa-oci`에서 `woodland-bridge` Secret `secret` 키를64hex 랜덤 값으로 생성한다. 값을 출력하지 않는다. content와 woodland에 같은 비밀을 주입하며 없으면 시작하지 않는다. 기본 kubectl context가 회사 클러스터일 수 있으므로 로컬 기본 context를 쓰지 않는다. 개인 대상은 `ssh msa-oci 'sudo k3s kubectl ...'`로 명시한다.

Node24, user1000, readOnlyRootFilesystem, enableServiceLinks=false 및 명시 WOODLAND_PORT=8349(동명 K8s Service의 tcp:// 자동 변수 충돌 방지), RWO `woodland-world`1Gi, resource limit1CPU/384Mi. `/health/live`는 프로세스, `/health/ready`는 저장 오류 여부다. 신규 경제 명령은 파일 fsync/원자 교체 성공 뒤에만 응답한다. 장애 시 기록을 보존하고503으로 닫는다. 종료는 SSE를 닫고 HTTP를 드레인한 뒤 저장한다. Linux 잠금은 PID namespace+process start tick을 함께 기록해 컨테이너 재시작의 PID1 재사용을 구별한다. 서로 다른 namespace의 동시 writer를 허용하는 장치는 아니며 Recreate/RWO가 필수다.

## 백업과 복원

`woodland-backup` CronJob은매일03:30UTC에 같은 노드의 RWO PVC를 읽는다. 원자 교체된 world.json 전체를 parseRecord로 검증한 뒤 gzip으로 `/data/backups/woodland-*.json.gz`에 저장하고 로컬7일 보존한다. 기존 `db-backup-par`의 쓰기 전용 PAR로 **woodland/** prefix에만 Content-MD5를 포함해 업로드한다. 기존 MySQL 백업·prefix·보존은 변경하지 않는다. PAR 만료일과 업로드 Job 실패를 운영자가 감시한다.

PAR은 다운로드·삭제 권한이 없다. 따라서 오프노드 보존은 기본 무기한이며7일 자동 삭제는 승인된 Woodland prefix 전용 bucket lifecycle을 따로 설정해야 한다. 현재 로컬7일 보존과 구분한다. 복원 다운로드에는 운영자 OCI Object Storage 읽기 권한이 필요하다. PVC와 로컬 백업은 같은 노드이므로 노드 소실 시 OCI 업로드 사본만 복구 수단이다.

복원 연습은 운영 world.json과 분리된 빈 디렉터리에서 수행한다:

```bash
node backup.mjs restore /qa/downloaded-woodland.json.gz /qa/restored-world
```

기존 world.json/server.lock이 있는 경로에는 복원하지 않는다. 실제 운영 복원은 별도 승인 후 Node를 중지하고 원본 PVC를 별도 보존한 뒤 검증된 복원본을 새 볼륨에 연결한다. 기록 삭제·덮어쓰기를 자동화하지 않는다.

## 검증

`woodland-haven/package-lock.json`의 개발 의존성으로 `npm ci && npm test`를 실행한다. 런타임 패키지는 없다. `postman/simulations/woodland.sim.yaml`은 공개하지 않는 로컬 프로필 브리지 mock으로 실제 HTTP 요청/재사용401을 검증한다. Node의 실제 HTTP 의존 실패(401/HTML500/timeout), 쿠키 교체,2개인 공유·서버재시작·복원,8동시/64저장 정원, Linux 재시작 잠금을 별도로 검증한다. JVM은 `:game:feature:test --tests '*Woodland*'`, gateway 컴파일과 verifyArchitecture를 실행한다.

배포 후 실제 gateway를 경유한 접속권 발급/join200/state200/SSE를 확인해야 Host 보존과 실제 라우팅까지 증명된다. 화면·계단/사육 조작의 브라우저 검증은 별도 UI 승인이 필요하며 HTTP 테스트와 구분한다. 운영 월드 초기화 없이 전용 QA 프로필만 사용한다.


## 검증된 첫 릴리스

2026-10-23:4서비스 c05c2cd Ready, 실제2개 플랫폼 프로필의 join200/동시SSE/채집 저장, Node 재기동 후 ID·순번·개인 가방 복원, 실제 OCI 업로드·인증 다운로드·빈 디렉터리 복원 통과. 근거는 [Woodland status](../specs/2026-10-18-woodland-haven/status.md)의 운영 배포 완료 절을 참조한다.
