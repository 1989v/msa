<!-- source: portal-fe/src/analytics/tracker.ts, portal-fe/src/pages/place/PlaceLandingRoute.tsx, portal-fe/tsconfig.json, portal-fe/Dockerfile, .github/workflows/ci.yml, place/ingest/Dockerfile, place/ingest/README.md, place/ingest/tests/datagokr_test.py, portal-fe/src/pages/__tests__/privacyRetention.test.ts, analytics/app/src/main/resources/clickhouse/analytics/V005__events_two_axis.sql, k8s/overlays/oci-arm/kustomization.yaml, k8s/overlays/oci-arm/README.md, docs/adr/ADR-0070-attraction-content-enrichment.md, portal-fe/src/analytics/events.ts, portal-fe/src/analytics/identity.ts, portal-fe/src/App.tsx, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/nginx.conf, portal-fe/src/pages/PrivacyPage.tsx, analytics/app/src/main/kotlin/com/kgd/analytics/presentation/event/dto/EventCollectDtos.kt, analytics/app/src/main/kotlin/com/kgd/analytics/infrastructure/schema/ClickHouseSchemaInitializer.kt, place/ingest/src/main.py, place/ingest/src/popularity.py, k8s/base/place-ingest/, k8s/base/network-policy/, k8s/argocd/stuck-sync-watchdog.yaml, docs/adr/ADR-0095-impression-click-pipeline.md, docs/adr/ADR-0077-ledger-retention.md -->
# Specification: place 유입 측정 — 세션 유입 기록 · 봇 크롤 집계

## Goal

place 서비스(`place.1989v.com`)로 들어오는 사람과 검색엔진 로봇을 각각 하루 단위로 셀 수 있게 한다. 사람 쪽은 탭 세션의 첫 진입에서 이전 사이트 **호스트**·UTM 3종·착지 경로 유형(`landingType`)을 기존 이벤트 원장에 한 행으로 남기고(I0-5), 로봇 쪽은 portal-fe nginx 접근 로그를 시간마다 읽어 로봇·호스트·경로 유형·상태 코드별 건수를 ClickHouse 집계 표에 남긴다(I0-6). 둘 다 SR-9 의 질의 한 벌로 일 추이를 본다. 지금은 운영 `analytics.events` 의 `SESSION_START` payload 가 `{}` 라 검색 유입이 0 인지 측정 불가인지 가를 수 없고, 로봇 요청(Googlebot 하루 ~90, place 상세 ~17)은 컨테이너가 바뀌면 사라지는 로그에만 있다.

## User Stories

- 운영자로서, 검색엔진(구글·네이버·다음·빙)별 유입 세션과 그 세션이 처음 연 화면 종류(허브·상세·지역·랜딩·편집)를 하루 단위로 보고 싶다. 그래야 1~3단계 작업(사이트맵·내부 링크·외부 언급)이 유입으로 이어졌는지 판단한다.
- 운영자로서, 커뮤니티 출시(I2-4)에 붙인 UTM 이 세션 수로 보이기를 바란다.
- 운영자로서, Googlebot·Yeti·Bingbot 등이 어느 호스트의 어떤 페이지 종류를 얼마나 가져가고 그중 304·404·5xx 가 얼마인지 GSC 없이도 일별로 보고 싶다.
- 방문자로서, 내가 어디서 왔는지가 주소 전체(검색어·토큰이 실린 경로)가 아니라 사이트 이름 수준으로만 남기를 바란다.

## 구현 전제

- 워크트리(`place-stage2`)에서만 구현한다. 메인 워킹트리의 analytics·common 미커밋 변경(`EventType.kt` 삭제 등)과 섞지 않는다.
- 서버 `EventAction`·`EntityType`·`common` 은 바꾸지 않는다. 수집 서버는 payload 를 `Map<String, Any?>` 로 받아 null 만 걸러 JSON 문자열로 적재한다(`EventCollectDtos.kt:89`, `EventRepositoryAdapter.kt:52`) — 코드 변경 없이 새 키가 남는다. 이것은 SR-8 의 운영 확인으로 증명한다.
- 롤백: 화면은 이미지 되돌리기. 봇 집계는 CronJob `suspend: true`. ClickHouse 표는 남겨 둔다(데이터 이행 없음).

## Specific Requirements

### SR-1 유입 이벤트의 모양
1. place 호스트(`isPlaceHost`, `App.tsx:80`)에서 앱이 처음 뜰 때 탭 세션당 한 번 `SESSION_START` 를 보낸다. 대상 `PAGE` / `place-entry`, 화면 `PLACE_ENTRY`(화면 쪽 `ScreenType` 유니온에 추가 — 서버 `screenType` 은 자유 문자열), `screenRef` 빈 값, 섹션 없음(`PageItem`), `viewId` 는 `newViewId()` 새 값. 이 행의 `view_id` 는 노출↔클릭을 잇는 키가 아니라 **단독 키**다 — 착지 화면은 payload 의 `landingType` 이 말한다(ADR-0095 §3 에 한 줄).
2. 기존 허브 세션(`entity_id='place-hub'`, `PlacePage.tsx:536-540`)은 그대로 둔다 — payload 도 `{}` 그대로. 허브 세션 정의(계측 스펙 SR-10)를 바꾸지 않기 위해서다. 두 행의 관계는 **같은 세션에서 `place-hub` ⊆ `place-entry`** 다. `place-hub` 는 「허브 또는 속성 랜딩(`/regions/:code/:attr`)을 한 번이라도 연 세션」이다 — `PlaceLandingRoute.tsx` 가 `<PlacePage preset…>` 를 렌더하고 허브 세션은 착지가 아니라 **마운트** 때 발화하기 때문이다(`PlacePage.tsx:536-540`). 따라서 상세로 착지해 허브로 옮겨 간 세션도 두 행을 남긴다. 이 포함 관계가 깨진 세션 수는 SR-9 에서 따로 센다.
3. 세션당 1회는 sessionStorage 플래그 `kgd.place.entryRecorded` 로 보장하고, 저장소를 못 쓰면 모듈 변수로 대신한다(그 경우 새로고침마다 1회). 테스트용 초기화 함수를 둔다. 같은 탭의 SPA 이동·새로고침은 새 행을 만들지 않는다.
4. 값은 앱 부팅 시점의 `document.referrer` 와 `window.location` 에서 한 번 읽는다. SPA 이동 뒤에는 읽지 않는다.
5. payload 키는 `referrerHost`·`landingType`·`lang`·`utmSource`·`utmMedium`·`utmCampaign` 여섯이다. `referrerHost`·`landingType`·`lang` 은 항상 있고(문자열, 빈 값 허용), UTM 셋은 값이 있을 때만 넣는다. 어떤 키도 `null`·`undefined` 를 담지 않는다. 키 이름을 `landing` 으로 두지 않는 이유: 허브 `SEARCH` 의 `trigger` 값에 이미 `'landing'` 이 있다(`PlacePage.tsx:305`) — 같은 원장에서 한 낱말이 두 뜻이 되지 않게 한다.
6. 이 이벤트는 대기열에 들어가 기존 규칙(20건·5초·pagehide beacon)으로 나간다. **`recordPlaceEntry` 가 `installFlushOnLeave()` 를 직접 한 번 설치한다**(해제하지 않는다). 지금 이 설치를 하는 화면은 `PlacePage:535`·`RegionPage:156`·`AttractionPage:236`·`UnifiedSearchPage:43` 넷뿐이고 `GuidePage`·`GuideIndexPage` 에는 없다 — 편집 글로 착지해 5초(`tracker.ts:14`) 안에 떠나면 유입 행이 사라진다. 화면 쪽 설치와 겹쳐도 빈 대기열 flush 는 아무것도 보내지 않는다.

### SR-2 이전 사이트 호스트
1. `referrerHost` 는 `new URL(document.referrer).hostname` 을 소문자로 바꾼 값이다. 경로·쿼리·프래그먼트·포트·사용자 정보는 담지 않는다.
2. 다음은 빈 값이다: 리퍼러가 없음, URL 파싱 실패, 스킴이 `http:`·`https:`·`android-app:` 밖. 호스트가 현재 `location.hostname` 과 같으면(같은 출처) 빈 값이 아니라 **`'self'`** 다 — 빈 값(`direct`)과 섞이면 「주소를 직접 친 방문」과 「place 안에서 새 탭으로 연 방문」을 가를 수 없다. `'self'` 세션은 place 세션 집계에는 들고 유입원에서만 따로 센다(SR-9).
3. 다른 1989v 서브도메인(`blog.1989v.com` 등)은 빈 값으로 만들지 않는다 — 서비스 간 링크(I2-6)의 유입을 세기 위해서다.
4. 253자를 넘으면 빈 값이다.
5. 순수 함수 `referrerHostOf(referrer: string, currentHost: string): string` 로 두고 단위 테스트가 이 함수를 직접 부른다.

### SR-3 UTM
1. `location.search` 의 `utm_source`·`utm_medium`·`utm_campaign` 을 읽는다. 그 밖의 쿼리 키는 읽지 않는다.
2. 값은 앞뒤 공백을 지운 뒤 `^[A-Za-z0-9._~-]{1,64}$` 에 맞을 때만 그대로 담는다. 맞지 않으면(65자 이상·한글·`@`·공백 포함 등) 그 키에 `'invalid'` 를 담는다 — 이메일·토큰이 UTM 자리에 실려 원장에 남는 것을 막고, 잘못 붙인 UTM 이 있었다는 사실은 남긴다.
3. 키가 없거나 빈 값이면 payload 에서 뺀다.
4. 캠페인(I2-4 커뮤니티 출시 등)은 **정규 주소(`place.1989v.com/attractions/{id}?utm_…`)에 UTM 을 붙인다.** 단축 주소 `/p/{code}` 는 UTM 을 넘기지 않는다 — `?utm_source=x` 로 열어도 `Location` 이 `https://place.1989v.com/attractions/4321`(쿼리 없음)이다(`AttractionShortLinkControllerTest.kt:67-75`). 단축 주소로 낸 캠페인은 유입원 칸에만 잡히고 캠페인 칸에는 없다.

### SR-4 착지 경로 유형
1. `landingType` 은 부팅 시 `location.pathname` 을 다음 표로 정규화한 값이다. id·코드·슬러그는 담지 않는다.

| 값 | 경로 (`/en` 접두·`/place` 접두 포함) |
|---|---|
| `hub` | `/`, `/en`, `/place`, `/en/place` |
| `detail` | `/attractions/:id`, `/place/attractions/:id` |
| `region` | `/regions/:code`, `/place/regions/:code` |
| `attr_landing` | `/regions/:code/:attr` |
| `editorial` | `/guides`, `/guides/:slug` |
| `other` | 그 밖 전부(`/favorites`, `/shared/:token` 등) |

2. `lang` 은 `/en` 또는 `/en/…` 이면 `en`, 아니면 `ko` 다.
3. 끝 슬래시는 무시한다(`/attractions/12/` = `detail`). 대소문자는 그대로 비교한다.
4. 정규화는 순수 함수 `landingTypeOf(pathname)` 하나이고, SR-6 의 봇 집계 경로 유형도 같은 표를 쓴다(파이썬 사본 — SR-6.4 가 두 구현을 같은 픽스처로 묶는다).

### SR-5 개인정보처리방침
1. `/privacy` §2 표에 행을 하나 더한다: 언제 「place 방문을 시작할 때(탭마다 한 번)」, 무엇 「직전 사이트의 도메인(주소 전체 아님)·캠페인 표시(utm)·처음 연 화면 종류 + 방문자 번호. 90일 보관(6항의 조회·클릭 기록과 같은 기간)」, 왜 「검색·외부 링크로 들어온 방문을 세어 사이트를 알리는 작업의 효과를 보기 위해」.
2. §2 의 「서버 접속 로그는 별도 저장소에 적재하지 않으며」 문단 뒤에 한 문장을 더한다: 검색엔진·AI 수집 로봇의 요청은 로봇 종류·페이지 종류·응답 코드별 **시간당 건수로만** 남기며 IP·주소·브라우저 정보는 남기지 않는다. (분류 대상에 `gptbot`·`oai-searchbot` 이 있어 「검색엔진」만 적으면 방침이 실제보다 좁다.)
3. 보존기간 숫자는 바꾸지 않는다 — 유입 행은 `analytics.events` 의 기존 TTL 90일을 따른다(`V005__events_two_axis.sql:50`; V004 의 표는 `V005:11` 이 지우고 다시 만든다). 봇 집계 표는 개인정보가 없어 ADR-0077 원장 표에 「개인정보 없음 · TTL 400일」 로 한 줄 적고 방침 §6 에는 숫자를 싣지 않는다(Q3).
4. 방침 개정일 표기가 있으면 갱신한다.

### SR-6 봇 요청 수집 — nginx 로그 형식과 파서
1. `portal-fe/nginx.conf` 에 `log_format` 을 하나 더하고 server 블록의 `access_log` 가 그것을 쓴다. 형식은 지금 줄(공식 이미지 `main`: combined + `"$http_x_forwarded_for"`) 뒤에 ` "$host"` 하나만 덧붙인 것이다 — 기존 줄을 읽는 사람·도구가 깨지지 않게 끝에만 더한다. `$host` 는 템플릿 envsubst 대상이 아니다(치환은 `NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS` 하나로 좁혀져 있다, `Dockerfile:78-79`; 이미 `map $host` 가 쓰인다, `nginx.conf:8`).
2. 로봇 분류는 UA 부분 문자열(대소문자 무시)이며 위에서부터 첫 일치: `OAI-SearchBot`→`oai-searchbot`, `GPTBot`→`gptbot`, `Googlebot`→`googlebot`(Googlebot-Image 등 포함), `Yeti`→`yeti`, `bingbot`→`bingbot`, `Daum`→`daumoa`. 그 밖 UA 의 줄은 세지 않는다(`GoogleOther`·`ChatGPT-User` 등은 칸이 없다 — SR-9 읽는 법).
3. 호스트는 `1989v.com` 과 `*.1989v.com` 만 그대로 두고 나머지는 `other` 다(위조 Host 헤더가 칸을 늘리지 않게).
4. 경로 유형은 SR-4 표에 `sitemap`(`/sitemap*.xml`), `robots`(`/robots.txt`), `feed`(`/feed.xml`, `/en/feed.xml`), `llms`(`/llms.txt`), `asset`(`/assets/`·정적 확장자) 다섯을 앞에 더한 것이다. 쿼리는 잘라 낸다. 화면(TS)과 파이썬은 같은 픽스처 `place/ingest/tests/fixtures/path_types.json` 을 읽어 단언한다. **파이썬 쪽 일치는 로컬 pytest 로만 확인된다** — CI 가 `place/ingest/*` 를 테스트 대상에서 뺀다(`ci.yml:193`). 그래서 그룹 8 커밋 전 체크에 pytest 를 넣는다.
5. 상태 코드 칸: `200`·`304`·`404`·`3xx`(304 외)·`4xx`(404 외)·`5xx`·`other`.
6. 파서는 줄 하나를 받아 (시각, 로봇, 호스트, 경로 유형, 상태 칸) 또는 None 을 돌려주는 순수 함수다. IP·UA 원문·전체 경로는 함수 밖으로 나가지 않는다. **파싱 예외는 건수만 센다** — 예외 메시지에 줄 원문을 넣지 않고(`main.py:292` 의 `log(f"… 실패: {e}")` 모양을 따르지 않는다), 깨진 줄을 넣어도 stdout/stderr 에 IP·UA 가 나오지 않는다. 운영 실측 줄(`10.42.0.73 - - [10/Oct/2026:19:18:01 +0000] "GET /sitemap-places-4.xml HTTP/1.1" 200 … "Mozilla/5.0 (compatible; Googlebot/2.1; …)" "10.42.0.1"`)에 `"place.1989v.com"` 을 붙인 줄이 `(googlebot, place.1989v.com, sitemap, 200)` 이 된다. 호스트 칸이 없는 옛 형식 줄은 호스트 `unknown` 으로 센다(전환 시간대).
7. 이 수치는 **원본(portal-fe)에 도달한 요청**이다. `/assets/` 는 `expires 1y` immutable(`nginx.conf:406-409`)이라 CDN 이 앞에서 받아 원본에 덜 온다 — `asset` 칸은 절대량이 아니라 추이로만 읽는다.

### SR-7 봇 요청 수집 — 위치·주기·저장
1. **권고: place-ingest 이미지에 `--job=crawl-stats` 를 더하고, 시간마다 도는 CronJob 이 쿠버네티스 API 로 portal-fe 파드 로그를 읽어 집계한다.** 근거: (a) 새 이미지가 없다 — OCIR 무료 10GB 안에서 이미지가 늘지 않고, 파이썬·ClickHouse HTTP 클라이언트(`popularity.py:24`)·테스트 틀이 이미 있다. (b) portal-fe 에 사이드카·볼륨을 붙이지 않아 상시 메모리가 늘지 않는다. (c) 비컨 방식은 로봇이 JS 를 실행하지 않고 수집 서버가 크롤러 UA 를 버리므로(202/accepted 0) 성립하지 않는다. (d) nginx 별도 로그 파일은 컨테이너 교체 때 같이 사라져 결국 읽어 낼 주체가 필요하다. **이미지는 같지만 파드는 place-ingest 가 아니다** — 권한·라벨·egress 는 SR-8 이 따로 준다. 표의 주인은 analytics(스키마·V 파일)이고 place-ingest 이미지는 실행 장소일 뿐이다(place 도메인 데이터 아님).
2. 하루 한 번이 아니라 **시간마다**(`5 * * * *`, 직전 정시 한 시간) 읽는다. 컨테이너 로그는 현재 컨테이너 것만 읽히고 portal-fe 는 커밋마다 새 이미지로 교체되므로 하루 한 번이면 마지막 교체 전 요청을 통째로 잃는다. 일 집계는 SR-9 질의가 시간 행을 더해 만든다. 지난 시간을 다시 돌릴 수 있게 `--hour=YYYY-MM-DDTHH`(UTC) 인자를 둔다.
3. 잡은 라벨 `app.kubernetes.io/name=portal-fe` 파드를 나열하고 각 파드의 `pods/{name}/log?sinceSeconds=7500&timestamps=false` 를 **스트리밍으로 한 줄씩** 읽어 직전 정시 한 시간에 든 줄만 센다(본문 전체를 메모리에 올리지 않는다). API 호출마다 `timeout`(연결 10초·읽기 120초)을 둔다. 여러 파드의 같은 칸은 파드 열로 나눠 쓴다(7.4).
4. 저장: ClickHouse `analytics.crawler_requests_hourly`(`hour DateTime('UTC')`, `pod`, `host`, `bot`, `path_type`, `status_class` LowCardinality(String), `requests UInt32`), `ReplacingMergeTree(requests)`, `ORDER BY (hour, host, bot, path_type, status_class, pod)`, `TTL hour + INTERVAL 400 DAY`. JSONEachRow 에는 `hour` 를 **epoch 초**로 넣는다(문자열 시각은 서버 시간대로 해석된다). 키에 `pod` 가 있는 이유: portal-fe 는 `replicas: 1`(`deployment.yaml:10`)이라 교체 시간에는 옛·새 파드가 한 시간을 나눠 갖는다 — `pod` 없이 `ReplacingMergeTree(requests)` 로 접으면 두 파드 합이 아니라 한쪽 최댓값만 남는다. 버전 열이 `requests` 라 같은 (시간, 파드) 를 다시 돌려 로그가 줄어든 뒤 더 적게 보아도 값이 줄지 않는다(최대 덮음). 질의는 `FINAL` 로 읽고 파드를 더한다.
5. 덮어 읽은 범위를 알 수 있게 `analytics.crawler_log_coverage_hourly`(`hour DateTime('UTC')`, `pod`, `lines UInt32`, `first_line_at DateTime('UTC')`, `container_started_at DateTime('UTC')`, `partial UInt8`, `collected_at DateTime('UTC')`, `ReplacingMergeTree(lines)`, `ORDER BY (hour, pod)`, 같은 TTL)에 (시간, 파드)당 한 행을 쓴다 — 버전 열이 `lines` 라 커버리지도 최대 덮음 기준이다. `partial` 은 **「그 파드의 첫 줄 시각 > 시간 시작」 또는 「컨테이너 시작(`status.containerStatuses[].state.running.startedAt`) > 시간 시작」** 일 때 1 이다. `pods/log` 는 현재 로그 파일만 주므로 회전으로 앞부분을 잃은 경우는 파드 시작 시각으로 드러나지 않고 첫 줄 시각으로만 드러난다.
6. 스키마는 analytics 의 `clickhouse/analytics/V{다음 번호}__crawler_requests.sql` 로 둔다(`ClickHouseSchemaInitializer` 가 기동 시 적용 — 선례 V006·V007). 번호는 구현 시점의 origin/main 기준 다음 빈 번호다. `statementsOf` 는 `--` 로 **시작하는** 줄만 거르고 `;` 로 자르므로(`ClickHouseSchemaInitializer.kt:85-92`) **문장 뒤 꼬리 주석에 `;` 를 쓰지 않는다.**
7. 쓰기는 ClickHouse HTTP 8123 에 `INSERT … FORMAT JSONEachRow` 한 번(표당)이다. 실패하면 잡이 0 이 아닌 코드로 끝난다 — 조용히 0행이 되지 않게.

### SR-8 쿠버네티스 배선과 검증
1. CronJob `place-crawl-stats`(`k8s/base/place-ingest/cronjob-crawl-stats.yaml`):
   - **파드 템플릿 라벨은 `app.kubernetes.io/name: place-crawl-stats` 전용이다.** `place-ingest` 라벨을 쓰면 `11-allow-egress-https-public.yaml:34` 가 외부 `0.0.0.0/0:443` 을 연다 — 클러스터 로그 읽기 권한을 가진 파드가 바깥으로 나갈 수 있게 된다. 파드 템플릿에는 `app.kubernetes.io/part-of: commerce-platform` 도 **붙이지 않는다** — `12-allow-backend-egress-internal.yaml:25-33` 이 그 라벨을 가진 파드에 commerce 안 모든 파드로의 egress 를 연다. CronJob **메타데이터**에는 `part-of` 를 둔다(oci-arm 의 OCIR pull secret 패치가 CronJob 메타데이터 라벨로 대상을 고른다, `k8s/overlays/oci-arm/kustomization.yaml:147-150`).
   - env 는 `CLICKHOUSE_URL` 과 ClickHouse 계정(평문 `analytics`, 재색인 잡과 같은 값)이다 — default 계정은 거부된다. `secretKeyRef` 를 두지 않는다(`cronjob-visitors.yaml:50-56` 의 `place-ingest-secrets` 를 복사하지 않는다).
   - `securityContext`: `runAsNonRoot: true`·`runAsUser: 65534`(이미지에 `USER` 가 없어 지정하지 않으면 기동 거부, `place/ingest/Dockerfile`)·`readOnlyRootFilesystem: true`·`allowPrivilegeEscalation: false`·`capabilities.drop: [ALL]`, env `PYTHONDONTWRITEBYTECODE=1`.
   - `concurrencyPolicy: Forbid`, `backoffLimit: 0`, `activeDeadlineSeconds: 600`, `successfulJobsHistoryLimit: 1`·`failedJobsHistoryLimit: 2`, `ttlSecondsAfterFinished: 3600`, resources requests `cpu 50m·memory 64Mi`·limits `memory 128Mi` — 시간마다 도는 잡이라 하루 24개 Job 이 kine 에 쌓이지 않게 기록을 짧게 둔다.
   - **위험 수용:** 이 SA 는 `commerce` 네임스페이스 전 파드의 로그를 읽을 수 있다 — RBAC 은 라벨로 대상을 좁히지 못하고, `resourceNames` 는 `list` 에 걸리지 않으며 portal-fe 파드 이름은 배포마다 바뀐다. **그래서 이 파드에는 외부 egress 를 주지 않는다**: 나갈 수 있는 곳은 DNS·ClickHouse 8123·쿠버네티스 API 서버 셋뿐이고, 읽은 줄은 파서 밖으로 나가지 않는다(SR-6.6).
2. 전용 ServiceAccount `place-crawl-stats` + Role(네임스페이스 `commerce`) + RoleBinding. Role 규칙은 정확히 `pods: [list]`, `pods/log: [get]` 둘이다 — 동작이 「나열 → `pods/{name}/log`」뿐이라 `pods get` 은 필요 없다. 선례는 `k8s/argocd/stuck-sync-watchdog.yaml:19-60` 의 SA·Role·RoleBinding 이다. 이 SA 를 참조하는 것은 이 CronJob 하나뿐이고 `automountServiceAccountToken: true` 는 이 파드 스펙에 명시한다. 다른 place-ingest 잡은 바꾸지 않는다.
3. NetworkPolicy: `commerce` 는 기본 거부(egress 포함, `00-default-deny.yaml`)다. DNS 는 네임스페이스 전체 허용(`01-allow-dns-egress.yaml`)을 그대로 받는다. ClickHouse 는 `09-allow-app-to-clickhouse.yaml:42` 의 목록에 `place-crawl-stats` 를 더해 8123 인그레스를 받고, 이 파드의 8123 egress 와 쿠버네티스 API 서버 egress 는 새 정책 `21-allow-crawl-stats-egress.yaml` 한 장이 연다(`podSelector: app.kubernetes.io/name=place-crawl-stats`). API 서버를 어느 주소·포트로 열지(서비스 `10.43.0.1:443` vs 노드 `:6443`)는 구현 때 임시 파드 탐침으로 정해 **하나만** 연다(Q2).
4. 배포 뒤 운영 확인: (a) 일반 Chrome UA 로 `place.1989v.com/attractions/{id}?utm_source=test&utm_medium=spec&utm_campaign=i0-5` 에 리퍼러 `https://www.google.com/search?q=x` 로 진입한 행이 `analytics.events` 에서 `referrerHost='www.google.com'`·`landingType='detail'`·UTM 셋으로 보이고 payload 에 `search`·`q=` 가 없다. **검증 진입은 반드시 `utm_medium=spec` 을 단다** — SR-9 는 이 표지를 지표에서 뺀다(유입이 0 에 가까운 지금은 검증 1행이 지표 전부가 된다). (b) 크롤 잡 한 번 실행 뒤 `crawler_requests_hourly` 에 행이 있고, 같은 시간의 `googlebot` 합이 portal-fe 로그를 직접 grep 한 수와 같다(두 수를 한 표에, grep 명령은 tasks 8.6 에 고정).

### SR-9 일 집계 정의 (이 슬라이스의 산출물)
공통: 유입은 `entity_type='PAGE' AND entity_id='place-entry' AND action='SESSION_START' AND visitor_id != 'anonymous' AND JSONExtractString(payload,'utmMedium') != 'spec'`. **먼저 세션당 한 행으로 접는다** — `argMin(…, timestamp)` 로 세션의 첫 행 값만 쓴다. 저장소를 못 쓰는 탭은 새로고침마다 행을 내고(SR-1.3), `viewId` 가 비면 서버가 새 UUID 를 `eventId` 로 쓰므로(`EventCollectDtos.kt:66-68`) 원장에서 겹친 행이 접히지 않는다. 날짜는 세션 첫 행의 `toDate(timestamp, 'Asia/Seoul')`.

`referrerHost` 값 처리: `''` → `direct`, `'self'` → `self`, `^[a-z0-9.-]{1,253}$` 에 맞지 않는 값 → `other`(수집 서버가 payload 값을 검증하지 않는다, `EventCollectDtos.kt:89`). 유입원 분류는 **아래 SQL 의 `multiIf` 한 곳이 정의**이고 표는 그것을 말로 옮긴 것이다(표와 SQL 을 따로 고치지 않는다).

| 지표 | 정의 |
|---|---|
| place 세션 | 접은 세션 수(`count()`). `self` 포함 |
| 유입원 | `search_google`(`google.com`·`google.<국가>`·`google.co(m).<국가>` 호스트와 구글 앱 `com.google.android.googlequicksearchbox`), `search_naver`(`search.naver.com`·`m.search.naver.com`), `search_daum`(`search.daum.net`·`m.search.daum.net`), `search_bing`(`bing.com`), `community_naver`(`blog.naver.com`·`cafe.naver.com` 과 그 `m.`), `community_daum`(`cafe.daum.net`·`m.cafe.daum.net`), `ai`(`chatgpt.com`·`perplexity.ai`), `internal`(`1989v.com`·`*.1989v.com` — **apex `/place/…` 에서 `location.replace` 로 넘어온 방문 포함**, `App.tsx:109-114` 가 리퍼러를 apex 로 바꾼다), `self`, `direct`, `other`(위에 없는 `naver.com`·`daum.net` 호스트 포함) |
| 검색 유입 세션 | 유입원이 `search_` 로 시작하는 세션 수. `community_*` 는 넣지 않는다 |
| 착지 유형별 | 위를 `landingType` 으로 나눈 것 |
| 캠페인 | `utmSource`·`utmCampaign` 별 세션 수. `'invalid'` 건수는 따로 본다(0 이어야 정상) |
| 허브 포함 불일치 | 같은 날 `place-hub` SESSION_START 가 있는데 `place-entry` 가 없는 `session_id` 수(SR-1.2 — 0 이어야 정상) |
| 봇 일 요청 | `sum(requests)` from `crawler_requests_hourly FINAL` group by `toDate(hour,'Asia/Seoul')`, `bot`, `host`, `path_type`, `status_class` (파드를 더한다) |
| 304 비율 | 봇·경로 유형별 `sumIf(requests, status_class='304') / sum(requests)` |
| 커버리지 | 그날 `crawler_log_coverage_hourly FINAL` 의 고유 `hour` 수(24 가 정상)와 `partial=1` 인 시간 수 — 봇 수치를 읽을 때 같이 본다 |

읽는 법:
- 봇 수치는 **주간 합계로 읽는다.** 그날 커버리지가 24 미만이거나 `partial` 시간이 있으면 그날 값은 **하한**이다.
- `path_type` 은 `host='place.1989v.com'` 행에서만 읽는다 — 표가 place 경로 기준이라 다른 호스트의 `/` 는 `hub` 가 되는 등 뜻이 없다.
- `googlebot` 칸은 UA 에 `Googlebot` 이 있는 요청만이다. `GoogleOther`·`ChatGPT-User` 등은 세지 않는다(SR-6.2). 수치는 「UA 가 그렇다고 말한 요청」이다(Q5).

```sql
-- 검색엔진별 · 착지 유형별 일 세션 (세션당 첫 행으로 접은 뒤)
SELECT d,
       multiIf(rh = '', 'direct', rh = 'self', 'self',
               NOT match(rh, '^[a-z0-9.-]{1,253}$'), 'other',
               match(rh, '(^|\\.)google\\.(com|[a-z]{2,3}|com?\\.[a-z]{2})$') OR rh = 'com.google.android.googlequicksearchbox', 'search_google',
               match(rh, '^(m\\.)?search\\.naver\\.com$'), 'search_naver',
               match(rh, '^(m\\.)?search\\.daum\\.net$'), 'search_daum',
               match(rh, '(^|\\.)bing\\.com$'), 'search_bing',
               match(rh, '^(m\\.)?(blog|cafe)\\.naver\\.com$'), 'community_naver',
               match(rh, '^(m\\.)?cafe\\.daum\\.net$'), 'community_daum',
               match(rh, '(^|\\.)(chatgpt\\.com|perplexity\\.ai)$'), 'ai',
               match(rh, '(^|\\.)1989v\\.com$'), 'internal', 'other') AS source,
       landing_type,
       count() AS sessions
FROM (SELECT session_id,
             toDate(min(timestamp), 'Asia/Seoul') AS d,
             argMin(JSONExtractString(payload, 'referrerHost'), timestamp) AS rh,
             argMin(JSONExtractString(payload, 'landingType'), timestamp) AS landing_type
      FROM analytics.events
      WHERE action = 'SESSION_START' AND entity_type = 'PAGE' AND entity_id = 'place-entry'
        AND visitor_id != 'anonymous' AND JSONExtractString(payload, 'utmMedium') != 'spec'
      GROUP BY session_id)
GROUP BY d, source, landing_type ORDER BY d, source, landing_type;
-- 봇 일 요청 (파드를 더한다)
SELECT toDate(hour, 'Asia/Seoul') AS d, bot, host, path_type, status_class, sum(requests) AS requests
FROM analytics.crawler_requests_hourly FINAL GROUP BY d, bot, host, path_type, status_class ORDER BY d, bot, requests DESC;
```

## Existing Code to Leverage

- 트래커: `portal-fe/src/analytics/tracker.ts`(`track`·`flush`·`installFlushOnLeave:97`, 중복 키 `keyOf`), `identity.ts`(`newViewId`·`sessionId`), `events.ts`(`PageItem`·`ScreenType`·`EventAction`). 세션당 1회 선례 `PlacePage.tsx:315-334`(`claimSessionStart`·저장소 실패 폴백·초기화 함수). 호스트 판별 `App.tsx:80`, 라우트 표 `App.tsx:273-315`, apex→place 리다이렉트 `App.tsx:109-114`, 속성 랜딩 `PlaceLandingRoute.tsx`.
- 수집 서버: `EventCollectDtos.kt:66-68,89`(eventId 짓기, payload 그대로), `EventRepositoryAdapter.kt:52`(JSON 문자열 적재), 크롤러 UA 거부(`CrawlerUserAgents.kt`). 테스트 `EventCollectControllerTest.kt`.
- nginx: `portal-fe/nginx.conf`(템플릿, `Dockerfile:78-80` 의 envsubst 필터), `map $host` 선례 `:8`, resolver 치환 `:79`.
- 배치: `place/ingest/src/main.py`(잡 디스패치·잡 목록 docstring), `popularity.py:24`(`CLICKHOUSE_URL`·HTTP 질의), `place/ingest/tests/*_test.py`(주입 fetch `Recorder` 선례 `datagokr_test.py:33-42`, 레포 k8s 매니페스트 단언 선례 `datagokr_test.py:14,120-130`), `k8s/base/place-ingest/cronjob-visitors.yaml`. 잡 목록 문서는 `place/ingest/README.md`. SA·Role 선례 `k8s/argocd/stuck-sync-watchdog.yaml:19-60`(curl 로 API 호출).
- ClickHouse: `ClickHouseSchemaInitializer.kt:68,85-92`(`clickhouse/analytics` 순서 적용, `statementsOf`), `V006__attraction_popularity_daily.sql`(TTL·엔진 선례), 테스트 `ClickHouseSchemaInitializerTest.kt:54,85-93,128`.
- 방침: `portal-fe/src/pages/__tests__/privacyRetention.test.ts:162-178`(V005 TTL 을 읽어 방침 행과 대조하는 선례).
- NetworkPolicy: `00-default-deny.yaml`, `01-allow-dns-egress.yaml`, `09-allow-app-to-clickhouse.yaml`, `11-allow-egress-https-public.yaml`, `12-allow-backend-egress-internal.yaml`, 탐침 요령은 메모리 「NP 임시 파드 검증은 15초 대기 + 무관 라벨 대조군」.
- 문서: ADR-0095 §3(`place-entry` 행·payload 키·단독 `view_id`)·§5(표 소유 한 줄), ADR-0070 개정 절, ADR-0077 원장 표에 봇 집계 표 한 줄, `place/ingest/README.md` 잡 목록, `k8s/overlays/oci-arm/README.md:163` CronJob 수 표, `analytics/CLAUDE.md` 표 목록.

## Out of Scope

- 리퍼러 전체 URL·검색어(구글은 어차피 origin 만 보낸다), 리퍼러 경로 기반 「어느 글에서 왔나」.
- place 외 호스트(blog·rank·deal·apex)의 유입 기록 — 같은 함수를 쓰면 되지만 이번 측정 대상이 아니다.
- Google Analytics(방침 §3)의 유입 보고서 연동 — ClickHouse 와 같은 질의로 볼 수 없고 차단기에 막힌다.
- 봇 UA 진위 검증(역DNS) — 로그의 원격 주소가 인그레스 파드라 실제 IP 가 없다. 수치는 「UA 가 그렇다고 말한 요청」이다.
- ingress-nginx 컨트롤러 로그 — 기본 형식에 호스트가 없고(`allow-snippet-annotations` 외 설정 없음) 모든 place 요청이 portal-fe 를 거친다.
- 봇 집계 화면·알림. GSC·서치어드바이저 기준선(I0-1~I0-4, 사용자 몫).

## Open Questions

- pre-impl: 심판 판정(`context/review-verdict.md`)의 사용자 판단 10건을 권고 기본값으로 반영했다 — `context/open-questions.yml` 의 J1~J10(`status: answered-default`, 사용자 확인 대기).
- post-impl 5건은 같은 파일(Q1 유입 이벤트를 허브 SESSION_START 에 합칠지, Q2 API egress 주소, Q3 봇 표 TTL 과 방침 숫자, Q4 시간 주기 대신 하루 주기, Q5 봇 UA 위조).
