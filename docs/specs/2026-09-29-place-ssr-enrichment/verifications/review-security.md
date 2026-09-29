# 보안 리뷰 — place 관광지 서버 렌더 + 인리치먼트·패싯

- 대상: `spec.md` · `planning/requirements.md` · `context/open-questions.yml` · `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md`
- 차원: security (다른 차원은 보지 않았다)
- 기준 코드: 블로그 서버 렌더(`blog/feature/.../render/*`), 게이트웨이 라우트, ingress, NetworkPolicy, analytics 이벤트 수집·인기 집계

## 요약

설계 방향(데이터 주인이 렌더, 요청 경로에 서비스 간 호출 없음, 셸은 클러스터 내부에서만 받음)은 공격면을 늘리지 않는 쪽이다.
단, 스펙이 **블로그 렌더를 "복사한다"고만 적고** 아래 여섯 가지를 계약으로 적지 않았다. 구현자가 블로그 코드를 그대로 옮기면
두 가지(셸 페치 타임아웃, 인기도 조작)는 결함까지 함께 옮겨지고, 나머지는 구현자 재량에 맡겨진다.
차단할 사안은 없다 — **REVISE**.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 (STRIDE) | 부분 | 스펙에 위협 절이 없다. Tampering(인기도 조작 R-3)·DoS(R-4·R-5)가 빠져 있다 |
| 2 | 인증/인가 경계 | 부분 | SSR 경로는 공개로 맞다. 새 내부 API 의 노출 경계가 정해지지 않았다 (R-2) |
| 3 | 민감 데이터 흐름 | 통과 | 관광지 문서·집계 수치만 흐른다. PII 없음. 인기 API 는 visitor_id 를 내보내지 않도록 합계만 반환(SR-6 "조회·클릭 합") |
| 4 | 입력 검증 경계 (XSS/Injection/SSRF) | 부분 | 이스케이프 순서·id 검증이 스펙에 없다 (R-1) |
| 5 | 서비스 간 통신 | 부분 | search-batch → analytics NetworkPolicy 누락 (R-2) |
| 6 | 시크릿 | 통과 | 새 시크릿 없음. 셸 URL·origin 은 설정값(`ShellHtmlProvider.kt:22`, `BlogMetaRenderer.kt:28` 패턴) |
| 7 | 암호화 | 통과 | 외부는 ingress TLS, 내부는 기존과 같은 평문 클러스터 통신 |
| 8 | 감사 로깅 | 통과 | 렌더 로그(id·소요시간, requirements.md:80)·합류 실패 경고 건수(requirements.md:81). id 검증(R-1)이 들어가면 로그 인젝션도 닫힌다 |
| C3 | Rate Limiting / Abuse | 부분 | R-3·R-4 |

## 이슈

### R-1 (체크 4) 서버 렌더 출력 계약에 이스케이프 규칙과 id 형식이 없다

근거
- SR-1(spec.md:15-24)은 TourAPI 원문(제목·원어명·주소·개요·useTime·restDate·useFee·parking)을 HTML 에 넣는데 인코딩 규칙이 없다.
- 프리렌더 계약은 **태그 제거 → 엔티티 디코드 → 마지막에 escapeHtml** 순서다(`portal-fe/src/seo/copy.mjs:660-675` `sourceText` 가 `&lt;` 를 `<` 로 되돌리고, `portal-fe/scripts/prerender-seo.mjs:1101`·`:1123` 에서 escape).
  Kotlin 이식에서 순서가 바뀌면(escape 후 decode) 원문의 `&lt;script&gt;` 가 실행 가능한 태그가 된다. 원문은 외부 기관 데이터다.
- JSON-LD 는 `</script>` 조기 종료 방지가 필요하다(`BlogMetaRenderer.kt:162` `.replace("<", "\\u003c")`, `prerender-seo.mjs:420`).
- 셸 치환은 람다 형식이어야 한다(`BlogMetaRenderer.kt:105`). `Regex.replace(input, String)` 로 옮기면 원문의 `$1` 이 그룹 참조로 해석되어 예외나 내용 변형이 난다.
- id 는 경로에서 온다. 문서 id 는 place PK 숫자다(`search/batch/.../AttractionApiReindexTasklet.kt:103` `attraction.id.toString()`). 현재 JSON API 는 검증 없이 그대로 쓴다(`AttractionSearchController.kt:71-73`, 404 메시지에 id 반영).

수정안 — SR-1 에 한 줄씩 추가
1. "원문 텍스트는 `sourceText` 와 같은 순서(태그 제거 → 디코드)로 평문화한 뒤 **출력 직전에** HTML 이스케이프한다. 속성값(`content`·`href`)도 같은 함수를 쓴다."
2. "JSON-LD 는 직렬화 후 `<` 를 `<` 로 바꾼다. 셸 치환은 치환 문자열을 해석하지 않는 방식으로 한다."
3. "경로 id 는 `^[0-9]{1,12}$` 만 받고(`@GetMapping("/attractions/{id:\\d{1,12}}")`), 그 외는 조회 없이 404. 404·최소 HTML 은 요청 id 를 되돌려 쓰지 않으며, canonical·링크는 **조회된 문서의 id·lang** 과 설정된 origin 으로만 만든다(요청 Host 사용 금지)."
4. `href` 는 내부 경로(숫자 id·지역 코드)만 만든다. TourAPI `homepage` 등 원문 URL 을 본문에 넣게 되면 `http(s)` 스킴 허용 목록을 둔다.
5. 테스트: `BlogMetaRendererTest` 처럼 `<script>`·`&lt;script&gt;`·`</script>`·`$1`·`"` 를 담은 제목·개요 픽스처로 렌더 결과를 검사한다.

### R-2 (체크 2·5) analytics 내부 API 의 경로·네트워크 경계가 정해지지 않았다

근거
- SR-6(spec.md:54)·ADR-0103 §6(L32)은 "내부 API" 라고만 한다.
- 게이트웨이는 `/api/v1/analytics/**` 를 **인증 없이** analytics 로 보낸다(`gateway/src/main/resources/application.yml:37-41`). 이 밑에 두면 외부에 열리고, 14일 ClickHouse 집계를 누구나 반복 호출할 수 있다.
- 레포 관례는 `/internal/**` 을 게이트웨이 라우트·ingress 어디에도 두지 않는 것이다(`GatewayRouteConfig.kt:140-141`·`:660-661`, `commerce-platform.yaml:249-250`, `04-allow-backend-to-backend.yaml:6-7`).
- analytics 는 현재 gateway 에서만 ingress 를 받는다(`03-allow-gateway-to-backends.yaml:22-34`; network-policy 디렉토리에 analytics 를 대상으로 하는 다른 정책 없음). 재색인은 search-batch 가 하므로 정책이 없으면 호출이 막힌다.
  ADR-0103 결과(L45)는 search:app → portal-fe 정책 하나만 적었다.

수정안
- SR-6 에 "경로는 `/internal/attractions/popularity` (GET, 합계만), 게이트웨이·ingress 에 라우트를 두지 않는다" 를 적는다.
- ADR-0103 결과에 "search-batch → analytics:http NetworkPolicy 하나 추가(`04-allow-backend-to-backend.yaml` 에 per-target 로)" 를 더한다.
- search:app → portal-fe 정책은 `18-allow-blog-shell-fetch.yaml` 처럼 **별도 파일, podSelector=portal-fe, from=search, port 80** 으로 좁힌다(13번 확장 금지 — 같은 파일 L8-10 사유).

### R-3 (체크 1·C3) 인기도를 순위에 섞으면 익명 이벤트로 순위를 조작할 수 있다

근거
- 집계는 원시 이벤트 건수다 — `countIf(action = 'IMPRESSION')`·`countIf(action = 'CLICK')`, 방문자 중복 제거 없음(`analytics/.../ClickHouseAttractionPopularityAdapter.kt:44-54`).
- 수집 경로 `/api/v1/events` 는 익명 허용, 게이트웨이 필터·리미터 없음(`application.yml:40-41`). 수집기가 거르는 것은 크롤러 UA 뿐이다(`EventCollectController.kt:45`). 방문자 id 는 클라이언트가 보낸 헤더다(`:48`).
- SR-6(spec.md:55,58)은 이 값을 순위 계수와 「많이 본 곳」 표시에 쓴다. 상한 ×1.3 이 순위 영향은 묶지만, 최소 표본 기본값 "14일 조회 20"(open-questions.yml Q2)은 스크립트 한 번으로 넘는다.

수정안
- SR-6 에 "인기 신호는 **관광지·일자별 고유 visitor_id 수**(`uniqExact(visitor_id)`, `ANONYMOUS` 제외)로 센다" 를 추가한다. events 테이블에 visitor_id 가 이미 있다(`analytics/.../clickhouse/analytics/V004__events.sql`).
  원시 건수 컬럼(`attraction_popularity_daily`)은 그대로 두고 파생 컬럼으로 더한다(data-sources §0 ②).
- Q2 를 확정할 때 최소 표본을 고유 방문자 기준으로 정한다.
- 수집 경로 리미터는 이 스펙 범위 밖이면 "알려진 한계" 로 스펙에 적는다.

### R-4 (체크 C3) SSR 경로가 Cloudflare 우회 호스트(rt)로도 열린다

근거
- `rt.1989v.com` 은 프록시 OFF 이고 `/` 전체를 게이트웨이로 보낸다(`commerce-platform.yaml:290-296`). 게이트웨이 라우트는 Host 를 보지 않는다 — 블로그 페이지도 같다(`GatewayRouteConfig.kt:750-754`).
  `/attractions/**` 라우트를 같은 모양으로 더하면 `rt.1989v.com/attractions/{id}` 가 Cloudflare(봇 관리·캐시) 없이 search:app 과 OpenSearch 에 닿는다.
- 레포에는 이미 이 문제에 대한 해법이 있다 — 광고 라우트는 Host 허용 목록으로 rt 를 404 처리한다(`GatewayRouteConfig.kt:590-598`, `AdsHostAllowlist.kt:15-25`).
- 무료 단일 노드의 OpenSearch 는 페이지 캐시가 빠듯하다(requirements.md:70). 문서가 55,524개로 늘고 `Cache-Control: no-cache`(Q3 기본값, `BlogPageController.kt:57`)라 엣지 캐시가 없다.
  ADR-0103 L44 의 "크롤 부하는 낮다" 는 수치 근거가 없다.

수정안
- SR-1 에 "관광지 페이지 라우트는 place 호스트만 받는다(Host 허용 목록 predicate, overlay 별 값) — 그 밖의 호스트는 404" 를 넣는다. 경로 predicate 는 `/attractions/*`·`/en/attractions/*` 로 좁힌다(`/**` 아님).
- ADR-0103 결과의 크롤 부하 문장에 기대 요청률(예: Googlebot 일 요청 수 × 문서 조회 ms)을 적거나, 운영 확인 항목에 "배포 후 1주 search:app 요청률·OpenSearch get 지연 기록" 을 넣는다.

### R-5 (체크 C3) 복사 대상 셸 제공자에 타임아웃·실패 백오프가 없다

근거
- `ShellHtmlProvider.kt:25` `RestClient.builder().build()` — 연결·읽기 타임아웃 설정이 없다.
- 캐시 미스이거나 페치가 실패하면 **매 요청마다** 다시 페치한다(`:49-63`; 실패는 캐시하지 않는다).
  portal-fe 가 응답하지 않으면 SSR 요청마다 요청 스레드가 기본 타임아웃까지 묶인다. 블로그와 달리 55,524개 URL 이 크롤되는 경로라 스레드 고갈이 search:app 의 JSON 검색 API 까지 번진다.
- ADR-0103 §1(L24)은 이 클래스를 **복사**한다고 정했다.

수정안
- SR-1 셸 항목에 "셸 페치는 연결 1s·읽기 2s 타임아웃, 실패 뒤 30s 는 재시도하지 않고 마지막 정상본·최소 HTML 을 쓴다" 를 추가한다.
  블로그 원본의 같은 결함은 이 스펙에서 고치지 않는다 — 발견으로 보고하고, 세 번째 사용처가 생겨 공통 모듈로 올릴 때 함께 고친다.

### R-6 (체크 4, 참고) 셸 캐시 오염

위험은 낮다. 셸은 클러스터 내부 고정 URL 에서만 받고(`ShellHtmlProvider.kt:22`), 요청 입력이 캐시 키나 셸 내용에 들어가지 않으며, 마커가 없는 응답은 받지 않는다(`:54`).
"셸 URL·origin 은 설정값이고 요청 헤더(Host·X-Forwarded-*)에서 만들지 않는다" 는 R-1 수정안 3 에 포함했다. 추가 조치는 없다.

## 판정 근거

스펙 결정이 코드나 문서를 정면으로 어기는 곳은 없다. R-1~R-5 는 모두 스펙에 규칙을 더하면 닫힌다. R-3 은 순위 영향이 상한 ×1.3 으로 묶여 차단 사유는 아니다.

VERDICT: REVISE

## Round 2

대상: 개정된 `spec.md` · `planning/test-quality.md` · `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md`.

### 1차 항목 판정

| # | 판정 | 근거 |
|---|---|---|
| R-1 | RESOLVED | spec.md:23(id 숫자 1~12자리, 404 에 id 안 되돌림, canonical 은 문서 id·언어·설정 origin) · :24(치환 문자열 해석 안 함) · :25(태그 제거 → 디코드 → 이스케이프, JSON-LD `<` 치환). 테스트 test-quality.md:8 T1(`$1`·`&lt;script&gt;`·JSON-LD). 수정안 4(외부 URL 스킴)는 해당 없음 — 관광지 본문 링크는 내부 경로뿐이다(`prerender-seo.mjs:1074`·`:1089-1091`) |
| R-2 | RESOLVED | analytics 내부 API 를 없애고 ADR-0095 §6 대로 집계 표를 직접 읽는다(spec.md:65, ADR-0103:37-38, 대안 기각 :49). search-batch 는 이미 ClickHouse 허용 목록에 있다(`k8s/base/network-policy/09-allow-app-to-clickhouse.yaml:40`). 새 API·새 노출면이 없다 |
| R-3 | PARTIAL | 원시 건수 → 고유 클릭 방문자 수(spec.md:64), 노출 제외, 순위 반영 기본 꺼짐 + 짝지은 nDCG 게이트(spec.md:67). 남은 것은 아래 N-2 |
| R-4 | RESOLVED | 공개 게이트웨이에 경로를 만들지 않는다(spec.md:20-21, ADR-0103:25·:48). 게이트웨이는 search 로 `/api/search/**` 만 보낸다(`GatewayRouteConfig.kt:369-372`)·portal-fe 로 가는 라우트가 없다. 크롤 부하 수치 근거 추가(ADR-0103:54). 단 경로 이름이 정해지지 않아 N-1 에 의존 |
| R-5 | RESOLVED | spec.md:28(요청 2초, 실패 뒤 30초 재시도 안 함, 마지막 정상본, 최소 HTML, 헬스 표시기). 블로그 원본 결함은 Out of Scope 에 발견으로 기록(spec.md:93) |
| R-6 | RESOLVED | canonical 을 설정 origin 으로만 만든다(spec.md:23) — nginx 가 어떤 Host 를 넘기든 출력에 영향이 없다 |

### 개정에서 새로 생긴 것

#### N-1 (체크 2) 내부 렌더 경로의 이름이 없고, T19 가 엉뚱한 경로를 잰다

근거
- spec.md:20 은 "클러스터 내부 전용 렌더 경로" 라고만 한다. 게이트웨이는 `/api/search/**` 를 **인증 없이 경로 그대로** search:8083 에 넘긴다(`GatewayRouteConfig.kt:369-372`, `stripPrefix(0)`).
  구현자가 렌더 컨트롤러를 기존 search 컨트롤러 관례대로 `/api/search/...` 밑에 두면 `rt.1989v.com/api/search/.../attractions/{id}` 로 Cloudflare 없이 닿는다 — R-4 가 다시 열린다.
- test-quality.md:26 T19 는 "공개 게이트웨이(`rt.1989v.com`)로 렌더 경로 404" 를 확인하지만, 어느 경로로 요청하는지 적혀 있지 않다. `rt/attractions/{id}` 를 치면 게이트웨이에 라우트가 없어 **렌더 경로를 어디에 두든** 404 가 난다 — 대상이 아니라 게이트웨이 부재를 잰다.

수정안
- SR-1 에 경로를 고정한다: "렌더 경로는 `/internal/render/attractions/{id}`(·`/en/...`) — 레포 관례대로 `/internal/**` 은 게이트웨이·ingress 에 두지 않는다(`GatewayRouteConfig.kt:140-141`·`:660-661`)."
- T19 는 `rt.1989v.com` 에 **그 내부 경로 그대로** 요청해 404 를 확인하고, 같은 요청을 portal-fe 파드 안에서 보내 200 을 받는 짝으로 적는다(한쪽만 있으면 경로 오타도 통과한다).

#### N-2 (체크 1·C3) 고유 방문자 수도 visitor_id 를 돌리면 부풀릴 수 있다

근거
- visitor_id 는 클라이언트가 보내는 헤더다(`EventCollectController.kt:39`·`:48`). 요청마다 새 값을 넣으면 요청 수 = 고유 방문자 수다. 수집 경로는 익명·리미터 없음(1차 R-3 근거 그대로).
- 헤더가 없으면 전부 `"anonymous"` 한 값이 된다(`EventCollectController.kt:48`·`:63`). 스펙은 이 값을 빼라고 하지 않았다 — 관광지·일자마다 1명으로 잡힌다.
- ADR-0103:39 는 "원시 건수는 익명 수집 경로로 부풀릴 수 있다" 를 고유 방문자로 바꾼 **이유**로 적어, 고유 방문자는 조작에 안전하다고 읽힌다. spec.md:11 사용자 스토리도 "조작된 신호로 순위가 흔들리지 않기" 다.

영향은 묶여 있다 — 상한 계수·기본 꺼짐·nDCG 게이트(spec.md:66-67). 그래서 차단 사유는 아니다.

수정안
- SR-6 에 두 줄: "`anonymous` 는 세지 않는다." "visitor_id 는 클라이언트가 정하는 값이라 돌려 쓰면 부풀릴 수 있다 — 방어는 상한·최소 표본·스위치이고, 수집 경로 리미터는 범위 밖(알려진 한계)."
- ADR-0103:39 문장을 "원시 건수는 한 방문자가 반복해 부풀릴 수 있다(고유 방문자도 visitor_id 를 돌리면 부풀릴 수 있어 상한으로 묶는다)" 로 좁힌다.
- 선택: 같은 visitor_id 가 그 관광지 IMPRESSION 을 먼저 가진 CLICK 만 센다 — 스크립트가 노출까지 위조해야 해서 비용이 두 배가 된다. 비용 대비 효과는 구현 때 판단.

#### N-3 (체크 4) nginx 프록시 계약이 비어 있다 — 경로 패턴·전달 헤더

근거
- 지금 관광지·지역이 한 location 을 쓰고 id 문자 집합이 `[A-Za-z0-9._-]` 다(`portal-fe/nginx.conf:148`). 이 블록에 `proxy_pass` 를 얹으면 숫자가 아닌 id·지역 경로까지 search 로 간다. search 가 404 로 거르지만(spec.md:23) 거르는 층이 하나뿐이다.
- 이 location 은 호스트를 가리지 않는다(`nginx.conf:144-147` 주석). 브라우저는 `.1989v.com` 도메인 쿠키에 로그인 토큰을 싣는다(ADR-0079) — nginx 기본 동작은 Cookie·Authorization 을 upstream 에 그대로 넘기므로, 인증이 필요 없는 렌더 경로의 search 로그·예외 덤프에 토큰이 흘러갈 수 있다.
- Host 는 R-6 판정대로 출력에 영향이 없다.

수정안 — SR-1 nginx 항목에
- "프록시 location 은 `^/(en/)?attractions/([0-9]{1,12})$` 로 따로 두고, upstream URL 은 캡처한 숫자로만 만든다(`$request_uri` 전달 금지). 지역 경로는 지금 블록에 남긴다."
- "`proxy_set_header Cookie ""`·`Authorization ""` — 렌더에 필요 없는 자격증명은 넘기지 않는다."

### 판정

1차의 R-1·R-2·R-4·R-5·R-6 은 닫혔다. 남은 것은 모두 스펙 문장 몇 줄로 닫히며, 스펙 결정이 코드·문서를 정면으로 어기는 곳은 없다.
N-1 은 경로 이름 하나로 R-4 가 다시 열릴 수 있고 게이트 테스트가 그것을 못 잡으므로 이번 개정에서 고정하길 권한다.

VERDICT: REVISE
