# 3라운드(마지막) 재리뷰 — place hreflang · 피드 · IndexNow

범위는 `review-verdict-round2.md` §4 표를 따랐다. 이미 판정된 항목은 다시 열지 않았고, 편집 E1~E12 가 제대로 반영됐는지, 앞뒤와 맞물리는지, 편집 때문에 새로 생긴 결함만 봤다.

## 차원별 판정

| 차원 | 판정 | 발견 | 요약 |
|---|---|---|---|
| implementation | REVISE | 3 (+MINOR 1) | I-1 은 해소됐다. 남은 것은 entrypoint 실행 비트, 하위 디렉터리를 쓰는 이유, Secret 을 나중에 만들 때 재시작이 필요하다는 점 |
| security | REVISE | 1 | 키 형식 검사를 줄 단위 grep 으로 구현하면 여러 줄 값이 통과한다 |
| usecase | REVISE | 1 | 부록 C 4단계의 되돌리기가 엉뚱한 단계(3)를 가리킨다 |
| test-strategy | REVISE | 1 | 키 파일 검증 세 경우에 실행할 하네스와 회귀 주입이 없다 |
| architecture | SHIP | 0 | E11 개정 문단과 SR-1.7 주석 문구가 맞는다 |
| domain | 생략 | — | §4 표에서 생략 가능으로 둔 차원 |

## I-1(BLOCK) 해소 확인 — 해소됨

| 원래 실패 경로 | 지금 스펙 | 코드 근거 | 결과 |
|---|---|---|---|
| Secret 이 없으면 파드가 `CreateContainerConfigError` 로 멈춤 | `optional: true` (spec.md:114) | 같은 관례: `k8s/base/place-ingest/cronjob-media.yaml:63-66` | Secret 이 없어도 파드가 뜬다 |
| 템플릿 안의 `${INDEXNOW_KEY}` 가 남아 nginx 기동 실패 | 본문에 키를 두지 않고 `NGINX_ENVSUBST_FILTER` 도 그대로 둔다 (spec.md:115) | `portal-fe/Dockerfile:78-80` — 치환 대상은 `NGINX_LOCAL_RESOLVERS` 하나 | 템플릿에 새 변수가 생기지 않는다 |
| 조각이 없을 때 `include` 가 오류 | 와일드카드 글롭 (spec.md:118) | nginx `include` 는 와일드카드가 0건과 맞아도 오류를 내지 않는다(`GLOB_NOMATCH` 를 허용) | 키가 없을 때도 기동한다 |
| SealedSecret 컨트롤러가 없음 | 수동 Secret, 레포에는 두지 않음 (spec.md:113) | `k8s/overlays/oci-arm/kustomization.yaml:50` | 관례와 같다 |
| 네임스페이스 | `-n commerce` (spec.md:113) | `k8s/base/portal-fe/deployment.yaml:5`, `cronjob-media.yaml:17` | 두 파드 모두 commerce 에 있다 |

조각을 `conf.d/indexnow/` 하위 디렉터리에 두는 것도 맞다. 기본 `/etc/nginx/nginx.conf` 는 http 블록에서 `conf.d/*.conf` 만 include 하므로 하위 디렉터리 조각은 http 레벨로 새지 않는다.

## 발견

### R3-I1 (implementation, REVISE) — entrypoint 스크립트에 실행 비트가 없으면 아무 오류 없이 건너뛴다
- 근거: spec.md:116 은 「`/docker-entrypoint.d/` 스크립트(20-envsubst 보다 앞 번호)」라고만 적었다. nginx 공식 이미지의 `docker-entrypoint.sh` 는 `*.sh` 가 `-x` 가 아니면 `Ignoring …, not executable` 만 찍고 넘어간다. `portal-fe/Dockerfile:80` 의 기존 `COPY` 관례에는 모드 지정이 없다.
- 영향: 키가 있어도 키 파일이 생기지 않는다. nginx 는 정상으로 뜨므로 부록 B 1단계에서 404 를 보기 전까지 아무도 모른다.
- 수정안: SR-4.2 첫 항목 끝에 이 문장을 더한다. 「이미지에 넣을 때 실행 권한을 준다(`COPY --chmod=0755` 또는 레포 파일 모드 100755). 실행 비트가 없으면 엔트리포인트가 오류 없이 건너뛴다.」

### R3-I2 (implementation, REVISE) — 하위 디렉터리에 둬야 하는 이유가 스펙에 없다
- 근거: spec.md:116 은 경로 `/etc/nginx/conf.d/indexnow/indexnow.conf` 만 정했다. 기본 nginx.conf 의 http 블록 `include /etc/nginx/conf.d/*.conf;` 는 바로 아래 파일만 읽는다. 조각을 `conf.d/indexnow.conf` 로 옮기면 `location` 이 http 레벨에 놓여 `"location" directive is not allowed here` 로 nginx 가 기동하지 못한다. 그러면 I-1 과 같은 전 호스트 중단이 난다.
- 수정안: SR-4.2 첫 항목 경로 뒤에 이 괄호를 더한다. 「(하위 디렉터리여야 한다 — `conf.d/` 바로 아래 `*.conf` 는 http 블록이 읽어 `location` 이 server 밖에 놓이고 기동이 실패한다)」. 「디렉터리 마운트 금지」 옆에 둔다.

### R3-I3 (implementation·usecase 공통, REVISE) — Secret 을 portal-fe 배포 뒤에 만들면 재시작해야 한다
- 근거: spec.md:151 은 「Secret 생성 … 없어도 배포는 안전하고 키 파일만 없다」고 적었다. env `secretKeyRef` 는 컨테이너가 시작될 때 한 번 읽히고, 조각은 엔트리포인트가 기동 때 한 번 쓴다. `k8s/base/portal-fe/deployment.yaml:10` 은 replicas 1 이고 Secret 변경을 감지하는 장치가 없다. 그래서 Secret 을 늦게 만들면 다음 롤아웃까지 키 파일이 없다. place-ingest 는 CronJob 이 실행될 때마다 읽으므로 이 문제가 없다.
- 수정안: SR-5.3 괄호 안에 「배포 뒤에 만들었으면 `kubectl -n commerce rollout restart deploy/portal-fe`(ssh msa-oci)」를 더한다. 부록 B 1단계에도 「404 면 Secret 존재·portal-fe 재시작 여부 확인」을 더한다.

### R3-I4 (implementation, MINOR) — E9 를 붙인 자리의 문장 부호
- 근거: spec.md:53 「…로그 N 은 켜짐과 같음) 구현 커밋에서 … 켜기·되돌리기는 부록 C..」. 괄호 뒤에 마침표가 없고 끝에는 마침표가 두 개다.
- 수정안: 「…같음). 구현 커밋에서 … 부록 C.」

### R3-S1 (security, REVISE) — 키 형식 검사는 값 전체에 대해 해야 한다
- 근거: spec.md:116 「`INDEXNOW_KEY` 가 `^[0-9a-f]{32}$` 에 맞을 때만」. busybox sh 에서 흔히 쓰는 `echo "$INDEXNOW_KEY" | grep -Eq '^[0-9a-f]{32}$'` 는 **줄마다** 맞춰 본다. 그래서 첫 줄이 32자 hex 이고 둘째 줄에 `} location / { … }` 가 있는 값도 통과한다. 그 값이 조각의 `location = /{key}.txt` 와 `return 200 "{key}"` 에 그대로 들어가면 설정 주입이 된다. Secret 은 운영자가 만드는 값이라 위협은 낮다. 그래도 이 검사는 S-1 에서 「형식 검사 없이 설정 문법에 값을 넣는다」를 막으려고 넣은 것이므로, 구현 형태가 그 목적을 지켜야 한다. `--from-file` 로 만들면 끝에 개행이 붙는 경우도 같은 경로를 탄다.
- 수정안: SR-4.2 첫 항목에 「검사는 값 전체에 대해 한다 — 길이 `${#k} -eq 32` 와 `case "$k" in *[!0-9a-f]*) 거부` 를 함께 쓰고, 줄 단위 `grep` 은 쓰지 않는다」를 더한다. 검증 목록에는 「여러 줄 값(첫 줄은 정상 키) → 조각 없음」을 더한다. 경고 로그에 키를 찍지 않는 조건(spec.md:116)은 이미 충족한다.

### R3-U1 (usecase, REVISE) — 부록 C 4단계의 되돌리기가 3단계를 가리킨다
- 근거: spec.md:225 「범위 다름이 1건이라도 나오면 3단계로 되돌린다.」 3단계(spec.md:224)는 재색인 로그를 확인하는 단계이고, 되돌리기는 5단계(spec.md:226)다. 이 문장을 그대로 따르면 스위치가 켜진 채 확인만 다시 하게 된다.
- 수정안: 「…나오면 5단계로 되돌린다.」 그 밖에 SR-5.4 를 두 단계로 나눈 것(spec.md:154-159)과 AC 전제(≥ 1건), 부록 B·C 의 켜기·확인·되돌리기 구성은 서로 맞는다.

### R3-T1 (test-strategy, REVISE) — 키 파일 검증 세 경우를 어디서 어떻게 돌리는지 없다
- 근거: spec.md:119 는 검증 세 경우(키 없음, 형식 틀림, 정상)를 적었지만 SR-5.1 단위 목록(spec.md:135-147)에도, SR-5.2 회귀 주입(spec.md:148-150)에도 없다. 레포에는 이 nginx 계약을 실제 nginx 로 재는 선례가 있다: `portal-fe/scripts/check-nginx-events-sitemap.sh:81-84`. 다만 이 스크립트는 템플릿만 마운트하고 entrypoint 스크립트는 마운트하지 않는다. 그 방식을 그대로 베끼면 조각을 쓰는 스크립트 없이 nginx 를 재게 되어 「키 없음 → 기동」만 초록이 된다.
- 수정안: SR-5.1 에 이 항목을 더한다. 「`portal-fe/scripts/check-nginx-indexnow.sh`(events-sitemap 검사와 같은 방식) — 레포의 실제 entrypoint 스크립트를 실행 권한째 `/docker-entrypoint.d/` 에 마운트하고 `-e INDEXNOW_KEY` 를 바꿔 가며 ① 미설정 → 기동·`/{임의hex}.txt` 키 본문 아님 ② `;` 포함·여러 줄 → 조각 없음·기동 ③ 정상 → place 200·본문 = 키·`Cache-Control` 한 벌, apex·blog 404.」 SR-5.2 에는 「형식 검사 삭제(② 가 잡는다)」를 더한다.
- SR-5.1 의 #27 사례(spec.md:136)와 SR-5.2 의 짝 스위치 주입(spec.md:150)은 부록 A #27 행(spec.md:206)·SR-1.5 테스트(spec.md:53)와 맞는다. 문제없음.

## 확인만 한 것 (문제없음)

- E1: spec.md:19 를 바꿨고 SR-2.3 표(spec.md:86-92)와 맞는다.
- E5: spec.md:160 의 기대값 「SPA 셸」이 `portal-fe/nginx.conf:331` 의 `location /` 와 맞는다. 키 파일은 정확 일치라 `/robots.txt`·`/llms.txt`·`/ads.txt`(`nginx.conf:58,100,111`)와 겹치지 않는다.
- E7·E12: 부록 A 합계(spec.md:211), Out of Scope(spec.md:174), ADR 초안 감수(adr-amendments-draft.md:19)가 같은 분류를 쓴다.
- E10·E11: SR-1.7 주석 문구(spec.md:68)와 ADR-0062 개정 문단(adr-amendments-draft.md:7-11)이 스위치 이름·기본값·적용 조건에서 같다. ADR-0062 본문 136·176행의 「hreflang 없음」은 개정 블록이 「위 …」로 받는다.
- 조각의 `add_header Cache-Control` 때문에 server 레벨 `X-Robots-Tag`(`nginx.conf:47`)가 상속되지 않는다. 하지만 place 호스트의 값이 빈 문자열이라(`nginx.conf:8-12`) 동작 차이는 없다. 관례(`nginx.conf:119-121`)대로 맞추려면 조각에 `add_header X-Robots-Tag $host_robots_tag always;` 를 함께 두면 된다(선택).

VERDICT: REVISE
