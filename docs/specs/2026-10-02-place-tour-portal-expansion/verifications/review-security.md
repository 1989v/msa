# Security Review — place 관광 포털 확장 (spec.md · ADR-0104)

대상: `spec.md`, `planning/`, `context/open-questions.yml`, `docs/adr/ADR-0104-place-tour-portal-expansion.md`
근거 코드: `portal-fe/nginx.conf`, `search/app/.../render/AttractionPageRenderer.kt`, `place/domain/.../AttractionDeepLink.kt`,
`place/feature/.../AttractionLinkService.kt`, `place/ingest/src/sync_tour.py`, `k8s/base/network-policy/11·19`

## 판정 요약

| # | 항목 | 결과 |
|---|---|---|
| 1 | 외부 원문 → 서버 렌더 HTML 이스케이프·XSS | 통과 (기존 규율 유지 전제) |
| 2 | 새 sitemap 노출 범위(호스트·내부 경로) | **이슈 R1** |
| 3 | 키 비노출 | 통과 |
| 4 | egress 범위 | 통과 |
| 5 | 출처표시·공공누리 | **이슈 R3** (경미) |
| 6 | 숙박 정보에 제휴·광고 혼입 금지 | **이슈 R2** |
| - | 입력 검증(`eventStatus`) | 통과 |
| - | 인증/인가 · PII · 결제 | 해당 없음(공개 읽기 전용, 회원 데이터 없음) |

## 통과 근거

- **XSS**: 렌더러는 모든 원문을 `sourceText`(태그 제거 → 디코드) 뒤 `escapeHtml` 로 내보내는 규율이 있고
  (`AttractionPageRenderer.kt:32`, `:258-:263`, `:280`), JSON-LD 는 `<` 를 `<` 로 바꿔 `</script>` 조기 종료를 막는다(`:144-:149`).
  링크는 내부 경로만 만든다(`:413-:418`). SR-5 의 행사·숙박·코스 절은 같은 렌더러에 절을 더하는 것이라 이 규율을 그대로 따르면 된다.
  코스 링크는 SR-4(spec.md:49-50)가 「같은 언어 관광지 id 로 매칭된 지점만 링크, 나머지는 이름만」이라 원천 값이 href 로 가지 않는다.
- **키**: `serviceKey` 는 URL 에만 붙고(`sync_tour.py:151`) 오류 메시지는 응답 헤더 코드·메시지만 싣는다(`:159-:170`).
  2단계 표본도 「키·개인 정보 없이」 남긴다(spec.md:87).
- **egress**: 외부 :443 은 `place-ingest` 라벨에만 열려 있고(`11-allow-egress-https-public.yaml:33`), 새 CronJob 은 같은 라벨을 쓰는 견본
  (`cronjob-pet-tour.yaml:17,:33`)을 따른다. 다른 파드가 egress 를 요구하면 붙이지 않는다는 문구도 있다(spec.md:97). 재색인에 외부 호출을 넣지 않는 결정(ADR-0104:29-30, :47) 도 경계를 지킨다.
- **입력 검증**: `eventStatus` 는 4개 값 화이트리스트, 그 밖은 무시(spec.md:52). 기준일은 서버 KST 계산이라 클라이언트 날짜를 받지 않는다.
- **내부 경로**: 렌더 프록시는 캡처한 값으로만 upstream 경로를 만들고 쿠키·Authorization 을 지운다(`nginx.conf:147-:166`). ADR-0103 은 공개 게이트웨이에 `/internal/**` 가 없음을 확인했다(ADR-0103:25, :67).

## 이슈

### R1 (체크: 입력/노출 경계) — 행사 sitemap 정확 일치 location 이 모든 호스트에서 응답한다

- 스펙: 「place 호스트의 이 경로를 portal-fe nginx 가 정확 일치 location 으로 … 프록시한다」(spec.md:79, ADR-0104:34-35).
- 코드: portal-fe nginx 는 한 server 블록이 apex·game·blog·rank·deal·resume 를 함께 서빙하고, 기존 sitemap 은 `try_files /seo/$host/$1` 로
  호스트별로 갈린다(`nginx.conf:64-:70`). `location = /sitemap-places-events.xml` 은 이 정규식보다 먼저 잡히므로 **호스트 조건이 없으면
  `1989v.com/sitemap-places-events.xml`·`resume.1989v.com/...` 도 place 행사 sitemap 을 낸다** — 지금은 404 인 경로다. 기존 렌더 location 도
  호스트를 보지 않는데(`nginx.conf:158`), 그쪽은 canonical 이 place 를 가리켜 피해가 없지만 sitemap 은 다른 호스트의 URL 목록을 그 호스트 이름으로 공표하게 된다.
- 또 기존 렌더 location 을 베끼면 `error_page 500 502 503 504 = @attraction_shell`(`:167-:168`)까지 따라와 **search 의 503 이 SPA `index.html` 200 으로
  바뀐다** — SR-7 이 막으려던 「빈 200」보다 나쁜 「HTML 200」이 sitemap 자리에 나간다.
- 수정안 (SR-7 에 nginx 블록 계약으로 명시):
  1. place 호스트가 아니면 404 (`if ($host !~ ^place\.) { return 404; }` 또는 `map $host` 변수).
  2. upstream 경로는 고정 문자열 `/internal/render/sitemap/events.xml` — `$request_uri`·쿼리 미전달.
  3. `proxy_set_header Cookie ""` · `Authorization ""` 유지.
  4. `proxy_intercept_errors` 쓰지 않음, SPA 폴백 없음(5xx 는 그대로 통과). search 연결 실패는 nginx 502 가 나가므로 「조회 실패 = 503」 확인은 search 단위 테스트, 「폴백 없음」은 nginx 스텁 검증으로 나눠 적는다.
  5. `Cache-Control` 명시(`nginx.conf:53-:56` 사고와 같은 이유) + `X-Robots-Tag $host_robots_tag`.
  6. 운영 확인(SR-10, spec.md:106)에 「apex·blog 호스트의 같은 경로가 404」 한 줄 추가.
- 부수: sitemap 은 인증 없는 요청마다 OpenSearch 를 조회한다(spec.md:80). 무료 노드 단일 search 파드라 search 쪽 짧은 메모리 캐시(분 단위) 또는 위 `Cache-Control` 로 반복 조회를 막는 것을 권한다. XML 은 id 숫자 검증 + `lastmod` 를 W3C 날짜로 변환한 값만 쓴다(원천 `modifiedtime` 문자열을 그대로 넣지 않는다)를 SR-7 에 한 줄로.

### R2 (체크: 데이터 흐름/정책) — 숙박 상세에 기존 「여행 상품」 딥링크가 그대로 붙는다

- 스펙: 숙박은 「제휴·예약 링크를 두지 않는다」(spec.md:61, ADR-0104:37-38), 예약·제휴는 범위 밖(spec.md:119).
- 코드: 딥링크는 유형을 보지 않고 모든 관광지에 조립된다 — `AttractionLinkService.kt:39`, `:49` 가 `AttractionDeepLinks.of(titleDisplay)` 를 부르고,
  그 안에 `MYREALTRIP`·`KLOOK` 검색 링크(`DeepLinkKind.TOUR_PRODUCT`)가 들어 있다(`AttractionDeepLink.kt:55-:61`).
  화면은 이것을 「여행 상품」 묶음으로 그린다(`AttractionLinks.tsx:21`, `:38-:43`, `AttractionPage.tsx:484`).
  두 곳 모두 숙박을 파는 OTA 이고, 설계상 제휴 승인 시 해당 제공자를 `AFFILIATE` 로 올리게 되어 있다(`AttractionDeepLink.kt:34-:36`).
  새 숙박 행 약 3,200건(ADR-0104:11)의 상세에 OTA 검색 링크가 붙고, 승인 순간 스펙 변경 없이 제휴 링크가 된다.
- 수정안: SR-5 숙박 항목에 「숙박(32·80)은 `TOUR_PRODUCT` 딥링크를 내지 않는다(`AttractionDeepLinks.of` 에 유형을 넘겨 제외)」와
  그 테스트(숙박 → `MYREALTRIP`·`KLOOK` 없음)를 더한다. 수집형 「방문 후기」(네이버 블로그) 를 숙박에도 붙일지(협찬 후기 비중이 큼)를 open-questions 에 한 항목으로 둔다.
  또 `introRaw` 는 공개 검색 응답에 원문 그대로 실린다(`SearchAttractionUseCase.kt:80`) — 예약 URL 키가 클라이언트로 가는 것은 원천 공개 데이터라 문제없지만,
  화면이 원문 키를 **허용 목록**으로만 그린다는 점(spec.md:61 「만 그린다」)을 TS 테스트로 고정한다.

### R3 (체크: 출처 표시) — 서버 렌더 본문에는 지금 출처 문구가 없다

- 스펙: 「공공누리 유형별 출처 표시를 화면·서버 렌더 본문에 둔다(TourAPI 는 지금 문구)」(spec.md:96).
- 코드: 화면에는 있지만(`AttractionPage.tsx:581`, `RegionPage.tsx:227`) 서버 렌더 본문(`AttractionPageRenderer.kt:251-:268`)과 바닥글(`:394-:399`)에는 없다.
  「지금 문구」를 그대로 둔다고 읽으면 서버 렌더에는 아무것도 추가되지 않는다.
- 수정안: SR-5 에 「서버 렌더 본문 끝에 `출처: 한국관광공사 TourAPI` / `Source: Korea Tourism Organization TourAPI` 를 새로 넣는다」로 바꾸고,
  2단계 원천은 SR-8(spec.md:91) 대로 유형 확인 전 비노출 유지. 대장의 TourAPI 라이선스가 「공공누리 (출처표시)」로 유형 번호가 없다(`data-sources.md:68`) — 행사 원문에 포함된 주최측 이미지·문구의 유형(`cpyrhtDivCd`, `data-sources.md:27`)을 SR-9 대장 갱신 때 함께 적는다.

## 체크리스트

- 위협 모델링: 공개 읽기 전용 확장. 위협은 Information Disclosure(R1 호스트 누출)·Tampering(원문 XSS — 통과)·DoS(R1 부수)로 한정.
- 인증/인가: 해당 없음(새 쓰기 경로 없음, 행 삭제·비활성화 경로도 만들지 않음 spec.md:38).
- 민감 데이터: 회원 데이터 없음. 원천 키는 로그·표본에 남지 않음.
- 입력 검증: `eventStatus` 화이트리스트, 코스 링크는 매칭 id 만. R1 의 sitemap XML 생성 규칙 보강.
- 서비스 간 통신: NP 19 는 L4 로 search :8083 전체를 portal-fe 에 연다(`19-...yaml:18-:29`) — 경로 제한은 nginx 가 진다. 그래서 R1 의 nginx 계약이 곧 경계다.
- 시크릿: 기존 Secret 경유(`main.py:35`), 변경 없음.
- 감사 로깅: sitemap URL 수·생성 시간 로그(spec.md:82), 수집 호출 수 로그(spec.md:27) 로 충분.
- Rate limiting: R1 부수 항목.

VERDICT: REVISE

## 반영

근거 확인: `nginx.conf:64-70,158-168`(호스트 무관 · 5xx → `@attraction_shell`) · `AttractionDeepLink.kt:55-61`(`TOUR_PRODUCT` 무조건 조립) · `AttractionLinkService.kt:39,49` · `AttractionPageRenderer.kt`(출처 문구 없음 — 파일 전체에 「출처」·「Source」 문자열 0건) · `data-sources.md:68`.

| 지적 | 반영 위치 | 내용 |
|---|---|---|
| R1 ①~⑤ | spec.md:130-132 | place 외 호스트 404 · 고정 upstream · Cookie/Authorization 제거 · 오류 가로채기·SPA 폴백 없음 · Cache-Control + X-Robots-Tag |
| R1 ⑥ | spec.md:169 · test-quality T15·T19 | apex·blog 같은 경로 404 |
| R1 부수 | spec.md:128(id 숫자 · lastmod W3C) · :131(⑤ max-age=300) | search 쪽 메모리 캐시는 **미반영**: 요청당 OpenSearch 조회 한 번이고 크롤러 빈도가 낮다. 측정된 병목 없이 캐시를 두지 않는다(조기 최적화 금지). 캐시 헤더로 반복을 줄인다(spec.md:129) |
| R2 | spec.md:99-100(숙박 `TOUR_PRODUCT` 제외, 원문 키 허용 목록) · test-quality T11b·T16 · ADR-0104 결정 6 | 방문 후기는 open-questions Q5(기본: 숙박에는 그리지 않음) |
| R3 | spec.md:103(서버 렌더 본문에 출처 문구 새로 추가) · :147(대장에 `cpyrhtDivCd` 행 단위 유형) | |
