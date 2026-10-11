# Engineer Review — architecture · implementation · security

대상: `spec.md` · `tasks.md` · `context/open-questions.yml` (2026-10-10 place 유입 측정)
체크리스트: hns `spec-review/reviewers/{architecture,implementation,security}/checklist.md`. 0.16.1 캐시에는 이 파일이 없어서 0.15.1 판을 썼다.
근거: 워크트리 `scratchpad/wt-impl` 의 레포 파일만 봤다. kubectl 은 쓰지 않았다.

| 관점 | 판정 | BLOCK | REVISE | MINOR |
|---|---|---|---|---|
| security | **BLOCK** | 1 | 2 | 3 |
| implementation | **REVISE** | 0 | 4 | 5 |
| architecture | **REVISE** | 0 | 2 | 2 |

---

## Security — BLOCK

### S1 [BLOCK] 크롤 잡이 commerce 전 파드 로그 읽기 권한과 공용 인터넷 443 egress 를 함께 갖는다
- 스펙이 정한 것
  - `spec.md:83` (SR-8.1) 은 파드 라벨을 `app.kubernetes.io/name: place-ingest` 로 정했다. 이유는 「ClickHouse 허용을 그대로 받는다」이다.
  - `spec.md:84` (SR-8.2) 는 Role 을 `pods/log get` 으로 주는데, 범위가 네임스페이스 `commerce` 전체다.
- 코드·문서와 부딪히는 곳
  - `k8s/base/network-policy/11-allow-egress-https-public.yaml:34` 에서 `place-ingest` 라벨은 외부 `0.0.0.0/0:443` egress 화이트리스트에 들어 있다. 같은 라벨을 달면 ClickHouse 허용과 함께 **인터넷 egress 도 따라온다**. 스펙은 이 점을 언급하지 않는다.
  - RBAC 은 라벨로 범위를 좁히지 못하고, 파드 이름은 매번 바뀌어 `resourceNames` 도 쓸 수 없다. 그래서 `pods/log get` 이 있으면 auth·gateway·member·sideapp 등 **commerce 의 모든 파드 로그**를 읽을 수 있다.
  - portal-fe 로그에는 이미 토큰이 실린다. 이력서 공유 토큰이 쿼리로 오고(`portal-fe/src/pages/resume/ResumePage.tsx:25` `captureShareToken(window.location.search)`), 이 쿼리가 `$request`·`$http_referer` 에 남는다.
  - 레포는 지금까지 이런 조합을 피해 왔다.
    - `place/ingest/src/main.py:29-30`: 「배치 하나를 위해 권한을 늘리지 않는다」
    - `k8s/argocd/stuck-sync-watchdog.yaml:14-17`: 넓은 읽기 권한이 필요한 `--core` 방식을 접은 이유가 적혀 있다.
- 사람이 정할 것: 네임스페이스 전체 로그 읽기를 받아들일지. RBAC 으로는 portal-fe 로그만 읽게 좁힐 수 없다.
- 수정안
  1. 잡 파드 라벨을 `app.kubernetes.io/name: place-crawl-stats` 처럼 별도로 둔다. 그리고 `09-allow-app-to-clickhouse.yaml:42` 목록에 그 이름 하나를 더한다. 이렇게 하면 11번 정책의 인터넷 egress 를 받지 않는다.
  2. egress 는 셋만 연다: DNS(기존), ClickHouse 8123(12번 정책으로 이미 열림), API 서버 하나(SR-8.3).
  3. 스펙에 「이 SA 는 commerce 전 파드 로그를 읽을 수 있다 — 그래서 외부 egress 를 주지 않는다」를 위험 수용 근거로 적는다.
  4. 7.1 검증 스크립트에 「크롤 잡 파드가 `allow-egress-https-public` 의 podSelector 에 걸리지 않음」을 단언으로 넣는다. 8.1 회귀 주입에 「라벨을 place-ingest 로 되돌림」을 추가해 빨간불을 확인한다.

### S2 [REVISE] Role 에 쓰지 않는 `pods get` 이 들어 있다
- `spec.md:84` 는 `pods list·get` 과 `pods/log get` 을 준다. 그런데 `spec.md:76` (SR-7.3) 의 동작은 「라벨로 나열 → `pods/{name}/log` 읽기」뿐이다.
- `pods get` 은 다른 파드 spec(env 리터럴 등)을 하나씩 열어 보는 권한이다. 나열은 `list` 로 충분하다.
- 수정안: `pods: [list]` + `pods/log: [get]` 만 둔다. 7.1 스크립트도 이 집합과 정확히 같은지 비교한다.

### S3 [REVISE] 크롤 잡 파드에 place-ingest 비밀값이 섞이지 않게 못박아야 한다
- 다른 place-ingest CronJob 은 `place-ingest-secrets` 의 키를 env 로 받는다(`k8s/base/place-ingest/cronjob-visitors.yaml:50-56`).
- `spec.md:83` 은 「기존 모양을 따른다」고만 해서, 복사하면 SA 토큰과 외부 API 키가 한 파드에 같이 놓인다.
- 수정안: SR-8.1 에 「env 는 `CLICKHOUSE_URL` 뿐, secretKeyRef 없음」을 적는다. 7.1 스크립트가 이를 단언한다. 함께 `securityContext` 를 둔다(`readOnlyRootFilesystem`·`runAsNonRoot`·`drop ALL`, 선례 `stuck-sync-watchdog.yaml:168-176`).

### S4 [MINOR] 방침 문구가 실제 집계 대상과 어긋난다
- `spec.md:61` (SR-5.2) 는 「검색엔진 수집 로봇」이라고 쓴다. 그런데 `spec.md:67` (SR-6.2) 의 분류에는 `gptbot`·`oai-searchbot` 이 있다.
- `spec.md:60` (SR-5.1) 의 「place 첫 방문」은 실제 기준(탭 세션당 1회, `spec.md:26`)과 다르다.
- 수정안: 「검색엔진·AI 수집 로봇」, 「place 방문을 시작할 때(탭마다 한 번)」로 고친다.

### S5 [MINOR] 「도메인만 남긴다」는 약속을 화면만 지킨다
- 수집 서버는 payload 를 검증하지 않고 null 만 걸러 그대로 적재한다(`analytics/app/.../EventCollectDtos.kt:57,89`). 그래서 직접 POST 하면 `referrerHost` 에 전체 URL 이나 임의 문자열도 들어간다.
- 개인정보 측면에서는 그 사람이 스스로 넣은 값이라 위험이 낮다. 문제는 SR-9 수치를 부풀리거나 오염시킬 수 있다는 점이다.
- 수정안: 서버를 바꾸지 않는다는 전제(`spec.md:18`)는 그대로 두고, SR-9 에 「`referrerHost` 가 호스트 문법(`^[a-z0-9.-]{1,253}$`)에 맞지 않는 행은 `other` 로 셈」을 더한다. 원장 오염을 질의 쪽에서 가둔다.

### S6 [MINOR] 파서 실패 경로의 로그
- `spec.md:71` (SR-6.6) 과 `tasks.md:52` (5.3) 가 반환값과 로그 메시지에 원문이 없음을 단언하는 것은 맞다.
- 다만 예외 메시지(`str(e)`)에 줄 원문이 실려 잡 로그로 나갈 수 있다. 선례: `main.py:292` 의 `f"... 실패: {e}"` 패턴.
- 수정안: 파싱 예외는 건수만 세고 메시지를 찍지 않는다. 5.3 테스트에 「깨진 줄 입력 → stdout/stderr 에 IP·UA 부분 문자열 없음」을 넣는다.

---

## Implementation — REVISE

### I1 [REVISE] 타입체크 검증 명령이 아무것도 검사하지 않는다
- `tasks.md:13` (1.4) 와 `tasks.md:24` (2.5) 는 `npx tsc --noEmit -p .` 을 쓴다.
- `portal-fe/tsconfig.json:2` 는 `"files": []` 인 솔루션 파일이다. 그래서 이 명령은 0개 파일을 검사하고 통과한다. 근거: `.github/workflows/ci.yml:288` 「`--noEmit` 이 아니라 `-b` 다」, `portal-fe/Dockerfile:37-38`.
- 수정안: 두 곳 모두 `npx tsc -b` 로 바꾼다.

### I2 [REVISE] 공용 픽스처 위치 때문에 이미지 빌드가 깨질 수 있다
- `tasks.md:12` (1.3) 는 portal-fe 테스트가 `place/ingest/tests/fixtures/path_types.json` 을 읽게 한다.
- 이미지 빌드 맥락은 `portal-fe` 뿐이다(`images.yml:324`). 그런데 `tsconfig.app.json:30` `include: ["src"]` 이 `__tests__` 까지 `tsc -b` 대상에 넣고, 이 `tsc -b` 는 Docker 빌드 안에서 돈다(`Dockerfile:45`). 테스트가 이 JSON 을 `import` 하면 빌드가 TS2307 로 멈춘다.
- 또 place/ingest 의 pytest 는 CI 가 돌리지 않는다(`ci.yml:193` 에서 제외). 그래서 「두 구현을 같은 표로 묶는다」(`spec.md:57`)가 지켜지는 쪽은 TS 쪽뿐이다.
- 수정안
  - 픽스처는 `fs.readFileSync(new URL('../../../../place/ingest/tests/fixtures/path_types.json', import.meta.url))` 처럼 **런타임에 파일로 읽고 import 하지 않는다**고 명시한다.
  - SR-6.4 에 「파이썬 쪽 일치는 로컬 pytest 로만 확인된다(CI 게이트 없음)」를 적는다. 또는 frontend-gate 에 `python -m pytest place/ingest/tests/crawl_stats_test.py` 한 줄을 더하는 것을 결정 항목으로 올린다.

### I3 [REVISE] 착지 직후 떠난 편집·기타 세션의 유입 행을 잃는다
- `spec.md:29` (SR-1.6) 는 「상세·지역 화면은 이미 `installFlushOnLeave` 를 설치」에 기대고 있다.
- 실제로 설치한 곳은 `AttractionPage`·`PlacePage`·`RegionPage`·`UnifiedSearchPage` 뿐이다. `GuidePage`·`GuideIndexPage`·`FavoritesPage`·`SharedCollectionPage` 에는 없다(`installFlushOnLeave` grep 결과).
- 그래서 `editorial`·`other` 로 착지해 5초(`tracker.ts:14`) 안에 떠난 세션은 행이 없다. 3단계 편집 페이지 효과를 재는 지표가 체계적으로 적게 나온다.
- 수정안: `recordPlaceEntry()` 가 track 직후 `flush()` 를 한 번 부른다(fetch keepalive 1건). 아니면 자기 해제형 pagehide 리스너를 단다. 2.1 테스트의 beacon 케이스는 **가이드 경로 착지**로 둔다.

### I4 [REVISE] `partial` 판정이 kubelet 로그 회전을 못 잡는다
- `spec.md:78` (SR-7.5) 은 `partial` 을 「그 시간 시작 뒤에 시작한 파드만 있었을 때」로 정의한다.
- 그런데 `pods/{name}/log` 는 현재 로그 파일만 준다. kubelet 의 container-log-max-size 를 넘어 회전되면, 파드는 살아 있어도 그 시간 앞부분이 빠진다. portal-fe 는 전 호스트의 정적 자산 요청까지 한 줄씩 남겨 줄 수가 많다.
- 수정안: `partial` 을 「읽은 줄 중 가장 이른 시각 > 그 시간 시작」 **또는** 「파드 시작 > 그 시간 시작」으로 정의한다. 커버리지 표에 `first_line_at DateTime` 을 더한다.
- 같은 맥락에서 API 응답은 줄 단위로 스트리밍해 파싱한다. 2시간 5분 분량을 메모리에 통째로 올리지 않는다. urllib `timeout` 도 명시한다(선례 `popularity.py:44` `timeout=20`).

### I5 [MINOR] 스키마 적용 순서 — 표가 생기기 전에 잡이 먼저 돌 수 있다
- 표는 analytics 가 기동할 때 만들어진다(`ClickHouseSchemaInitializer.kt:31-65`). 크롤 CronJob 과 analytics 롤아웃이 같은 동기화에 실리면, 첫 몇 회는 `Table doesn't exist` 로 실패한다. 이건 SR-7.7 대로 0 이 아닌 종료 코드라 보이긴 한다.
- 수정안: 8.6 앞에 「analytics 로그에서 `[clickhouse] 적용 V0xx__crawler_requests.sql` 확인」을 넣는다.
- 그리고 `statementsOf` 는 `--` 로 **시작하는** 줄만 걷어내고 `;` 로 자른다(`ClickHouseSchemaInitializer.kt:86-92`). 그래서 열 뒤에 붙인 꼬리 주석 안에 `;` 가 있으면 문장이 깨진다. SR-7.6 에 「꼬리 주석에 `;` 금지」를 한 줄 적는다.

### I6 [MINOR] TTL 근거 인용이 틀렸다
- `spec.md:62` (SR-5.3) 은 `V004__events.sql:22` 를 가리킨다. 하지만 그 표는 `V005__events_two_axis.sql:11` 에서 DROP 후 다시 만들어진다. 지금 TTL 의 근거는 `V005__events_two_axis.sql:50` 이다.

### I7 [MINOR] `hour` 값의 시간대
- `spec.md:77` 의 `hour DateTime` 에 JSONEachRow 문자열(`"2026-10-10 19:00:00"`)을 넣으면 ClickHouse **서버** 시간대로 해석된다.
- 수정안: 유닉스 초(정수)로 넣는다고 명시한다. 또는 열을 `DateTime('UTC')` 로 둔다. 그래야 SR-9 의 `toDate(hour,'Asia/Seoul')` 이 서버 설정과 무관해진다.

### I8 [MINOR] nginx 문법 검증 명령이 이번 변경과 무관한 이유로 실패한다
- `tasks.md:69` 는 `docker run nginx:alpine nginx -t` 를 쓴다.
- 템플릿에는 `${NGINX_LOCAL_RESOLVERS}` 가 있다(`nginx.conf:79` 등). 이 값은 `NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1`·`NGINX_ENVSUBST_FILTER` 로 채워진다(`Dockerfile:78-79`). 이 환경 변수가 없으면 `resolver  valid=10s` 가 되어 `nginx -t` 가 실패한다.
- 수정안: `-e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS` 를 주고 이미지 태그를 `nginx:1.27-alpine` 로 맞춘다.
- 참고로 SR-6.1 의 「끝에만 덧붙임」은 안전하다. 레포 안에 portal-fe 로그를 파싱하는 수집기(promtail/fluent-bit/loki 등)가 없고, 사람이 grep 하는 형식도 앞부분이 그대로다.

### I9 [MINOR] 무료 티어 — 자원 수치와 운영 문서
- `spec.md:83` 은 「작은 resources」라고만 쓴다. 다른 place-ingest 잡은 256Mi/512Mi 다(`cronjob-visitors.yaml:58-59`).
- 시간마다 도는 잡이 하나 늘면 `k8s/overlays/oci-arm/README.md:163` 의 「CronJob 28종」 표와 동시 실행 메모가 틀려진다.
- 수정안
  - 요청 64Mi·한도 128Mi 정도로 수치를 명시한다(로그는 스트리밍 전제, I4).
  - `successfulJobsHistoryLimit: 1`·`failedJobsHistoryLimit: 2`·`ttlSecondsAfterFinished` 를 둔다. 하루 24개 Job 객체가 쌓이므로 kine 부피 메모도 참고한다.
  - 8.2 문서 목록에 이 README 표 갱신을 더한다.
- 스케줄 `5 * * * *` 은 정각에 몰리는 잡들(README:163)을 피해 있어 괜찮다.

---

## Architecture — REVISE

### A1 [REVISE] analytics 가 소유한 집계 표를 다른 서비스가 쓴다 — 이 예외를 ADR 에 남긴다
- `spec.md:77-80` (SR-7.4~7.7) 에서 place-ingest 가 `analytics.crawler_*` 에 직접 INSERT 한다.
- ADR-0095 §5 는 analytics 의 소유를 「원장·ClickHouse 스키마·**집계 산출물**」로 정한다(`docs/adr/ADR-0095-impression-click-pipeline.md:98`).
- `09-allow-app-to-clickhouse.yaml:10-11` 은 place-ingest 를 「전용 집계 표만 **읽는다**」고 적는다.
- 선례는 있다. recommendation 이 analytics DB 에 raw insert 를 한다(`09-allow-app-to-clickhouse.yaml:9`). 그래서 금지라기보다 **기록되지 않은 예외**에 가깝다.
- 수정안: 8.2 문서 작업에 다음 둘을 넣는다.
  - ADR-0095 §5 에 「스키마 소유 analytics, 쓰는 쪽 crawl-stats 잡(쓰기 전용 표, 원장 아님)」 한 줄.
  - 09 정책 주석의 place-ingest 설명을 「attraction_popularity_daily 읽기 + crawler_* 쓰기」로 고친다(라벨을 바꾸면 S1 의 새 이름으로).

### A2 [REVISE] 전 호스트 크롤 관측이 place 수집 이미지에 들어간다 — 결정과 경계를 기록한다
- SR-6.3·6.4(`spec.md:68-69`)는 apex·blog·game·deal 등 **모든 호스트**를 집계한다. 하지만 잡은 place 원천 수집 이미지(`place/ingest/src/main.py:2`, ADR-0070) 안에 들어간다.
- 근거(`spec.md:74`: 새 이미지 없음·OCIR 10GB)는 타당하다. 다만 이것은 「place 수집기에 RBAC 과 플랫폼 관측 책임이 붙는」 구조 변경이고, `main.py:29-30` 의 「권한을 늘리지 않는다」 원칙을 처음 깨는 것이다.
- CLAUDE.md 는 구조 변경 시 ADR 을 요구한다.
- 수정안: 별도 ADR 은 과하다. ADR-0062(SEO·검색 유입)나 ADR-0070 에 개정 절 하나를 둔다. 내용은 다음 셋이다.
  1. 「크롤 집계는 place-ingest 이미지에 얹는다(무료 티어)」
  2. 「이 잡만 SA·API egress 를 갖는다」
  3. 「다른 호스트로 관측이 넓어지면 이미지 분리를 재검토한다」
- `main.py:4-24` 의 잡 목록 주석에도 한 줄을 더한다.

### A3 [MINOR] 유입 행의 viewId 는 화면과 연결되지 않는다 — 규약 문서에 밝힌다
- `spec.md:24` 는 `newViewId()` 새 값을 쓴다. 트래커 중복 키(`tracker.ts:27`)와 서버 eventId(`EventCollectDtos.kt:68`)는 `viewId|PAGE|place-entry||SESSION_START` 라서 허브 행(`place-hub`)과 **충돌하지 않는다**. 세션당 1회는 sessionStorage 플래그가 보장한다.
- 다만 ADR-0095 §3(`:78-85`)은 view_id 를 「같은 화면 한 벌」로 정의한다. place-entry 의 view_id 는 어느 화면도 가리키지 않는다.
- 수정안: 8.2 에서 ADR-0095 §3 에 행을 더할 때 「place-entry 의 view_id 는 단독 키 — 착지 화면은 payload `landing` 이 말한다」를 함께 적는다.

### A4 [MINOR] apex `/place…` 진입은 리퍼러가 1989v.com 으로 바뀐다
- apex 에서 들어온 `/place…` 요청은 `PlaceHostRedirect` 가 `location.replace` 로 넘긴다(`App.tsx:109-114`). 그 결과 place 호스트에서 `document.referrer` 는 원래 외부 리퍼러가 아니라 `https://1989v.com/` 이 된다. SR-9 에서는 `internal` 로 잡힌다.
- 수정안: SR-9 의 `internal` 정의에 「apex→place 리다이렉트를 포함한다」를 적는다. UTM 은 `search` 를 그대로 넘기므로 유지된다.
- 참고: `android-app://` 의 hostname 파싱은 비특수 스킴 처리에 의존한다. 오래된 Chromium 은 빈 값을 낼 수 있다. jsdom 테스트는 통과하므로 8.5 운영 확인에서 구글 앱 행이 0 이어도 이것이 원인일 수 있다는 점을 적어 둔다.

---

## 체크리스트 대조 요약
- architecture
  - 레이어·의존 방향: 서버 코드 변경 없음(`spec.md:18`), 위반 없음.
  - 모듈 깊이: `inflow.ts` 는 호출자가 App 과 테스트 둘이고 순수 함수 넷을 가둔다. 삭제 테스트를 통과한다.
  - 교차 모듈 경계: A1·A2.
- implementation
  - 참조 경로: 모두 존재 확인(`tracker.ts`, `identity.ts`, `PlacePage.tsx:315-339,536-540`, `App.tsx:80`, `EventCollectDtos.kt:57,89`, `ClickHouseSchemaInitializer.kt:68`, `stuck-sync-watchdog.yaml:18-60`).
  - 롤백(`spec.md:19`): 적절하다.
  - 동시성: `concurrencyPolicy: Forbid` + `ReplacingMergeTree(requests)` 로 재실행해도 값이 줄지 않는다. 단, 커버리지 표는 `collected_at` 버전이라 **나중 실행이 이긴다**. 그래서 덜 본 재실행이 앞 실행을 덮을 수 있다. I4 의 `first_line_at` 과 함께 `lines` 를 버전 열로 쓰는 것을 검토한다.
- security
  - STRIDE 중 정보 노출·권한 상승: S1·S2·S3.
  - 위조(Spoofing): Q5 로 수용(`open-questions.yml:24-27`).
  - 입력 검증: UTM 정규식·호스트 길이·허용 호스트 목록이 정의돼 있다. 서버 쪽 공백은 S5.

VERDICT: BLOCK
