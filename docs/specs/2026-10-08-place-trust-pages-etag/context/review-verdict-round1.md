# 스펙 리뷰 판정 — 1라운드 (place 신뢰 페이지 + 상세 SSR ETag)

**결론: 36건 중 34건 유지, 2건 강등, 기각 0건. BLOCK 은 없다.** 재리뷰는 security 를 뺀 5개 차원에서 필요하다.

판정 대상은 워크트리 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl`(HEAD 145c324ee)의 `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` 하나다. 인용한 `file:line` 은 모두 직접 열어 확인했다. A3·IMPL-R2 는 근거가 「알려진 동작」뿐이어서 Gradle 캐시의 spring-webmvc 7.0.6 `HttpEntityMethodProcessor` 바이트코드를 `javap` 로 직접 확인했다. 엔티티 헤더를 응답에 먼저 복사하고, 그 뒤 200 이면서 GET/HEAD 일 때만 `isResourceNotModified` → `ServletWebRequest.checkNotModified` → flush·return 순서로 간다. 발견의 주장과 같다.

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 |
|---|---|---|---|
| 출처 표 상수 위치(프리렌더가 `.tsx` 를 못 읽어 검사 밖 사본이 생김) | A1, IMPL-R1, TS-R8 | 유지 | REVISE |
| 바닥글 패리티 「최소안」은 패리티를 재지 않음 → 골든 방식 | A2, TS-R1 | 유지 | REVISE |
| 304 를 컨트롤러가 직접 만들면 프레임워크와 겹치고 헤더가 빠짐 | A3, IMPL-R2 | 유지 | REVISE |
| 렌더러 골든 HTML 9개가 깨짐, `:553` 은 링크를 검사하지 않음 | IMPL-R3 | 유지 | REVISE |
| 대장 라이선스 열 정규화 규칙 없음(`〃`·`**`·백틱·내부 메모) | D2, IMPL-R4, TS-R2, SEC-참고2 | 유지 | REVISE(SEC-참고2 는 MINOR) |
| KOGL/공공누리 혼용, 「제한 없음」 띄어쓰기 | D3 | **강등** | MINOR |
| 「출처표시 문구」가 §1 에 없음(CC BY 고지) | D4 | 유지 | REVISE |
| TourAPI 「공공누리(출처표시)」 vs §2 「행마다 다름, Type3」 | D5 | 유지 | REVISE(사용자 판단) |
| 에어코리아 「확정 전 자료」 고지 유실 | D6 | 유지 | REVISE |
| 바닥글 라벨 「소개」 vs 「사이트 소개」, 순서 불일치 | D1, A4 | 유지 | REVISE / MINOR |
| llms 「`/about` 선례」가 없음 | IMPL-R5 | 유지 | REVISE |
| `:1620-1623` 은 `/about` 분기가 아니라 공통 루프, export 함수 없음 | IMPL-R6 | 유지 | REVISE |
| 남는 옛 문구 / `SITE_LINKS` 의미 / 304 는 전송량만 줄임 | IMPL-R7, R8, R9 | 유지 | MINOR |
| ETag 가 본문에서 나온 값인지 확인 안 함 | TS-R3 | 유지 | REVISE |
| 폴백·404 에 `If-None-Match` 를 보내는 사례 없음 | TS-R4 | 유지 | REVISE |
| 배포 뒤 측정의 최신성·소프트 404 기준 없음 | TS-R5 | 유지 | REVISE |
| `curl -sI` 는 gzip(`W/`) 경로를 안 탐 | TS-R6, UC-3 | 유지 | REVISE |
| 컨트롤러 테스트 시계 미고정 | TS-R7 | **강등** | MINOR |
| 원천 열 미대조 / 상설 부정 테스트 / Footer·sitemap 단언 누락 | TS-참고1~3 | 유지 | MINOR |
| 프리렌더 표 셀 이스케이프 | SEC-참고1 | 유지 | MINOR |
| 영문 화면 링크 문구 미정 | UC-1 | 유지 | REVISE(사용자 판단) |
| Goal 「모든 화면」이 셸 폴백 경로에서 거짓 | UC-2 | 유지 | REVISE |
| Q1 이 부정일 때 S2-8 완료 판정 없음 | UC-4 | 유지 | REVISE |

## 2. 발견별 판정

```json
[
  { "id": "A1 출처 목록 상수의 위치가 프리렌더와 공유되지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 95, "quote": "} from '../src/seo/copy.mjs';" },
      { "file": "portal-fe/package.json", "line": 9, "quote": "tsc -b && vite build && node scripts/prerender-seo.mjs" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 14, "quote": "데이터는 페이지의 TS 상수로 두고(대장을 빌드 때 읽지 않는다)" } ],
    "reason": "프리렌더는 번들 없는 Node 스크립트이고 소스에서 copy.mjs 만 import 하므로, .tsx 상수를 쓰면 게이트 밖 사본이 생긴다는 주장이 실측과 같다." },
  { "id": "A2 바닥글 패리티 「최소안」은 패리티를 재지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 20, "quote": "최소안: 각 쪽 테스트가 같은 4링크 리터럴을 단언" },
      { "file": "search/app/src/test/kotlin/.../AttractionJsonLdParityTest.kt", "line": 26, "quote": "CI 가 픽스처를 다시 만들어 `git diff --exit-code` 로 막으므로" },
      { "file": ".github/workflows/ci.yml", "line": 305, "quote": "run: git diff --exit-code -- search/app/src/test/resources/render/jsonld-golden.json" } ],
    "reason": "같은 레포에 골든+CI diff 방식의 패리티 선례가 실재하고, 리터럴 각자 단언은 검사가 자기 근거를 만든다는 전역 규칙 위반이다." },
  { "id": "A3 304 를 컨트롤러가 직접 만들면 프레임워크 처리와 겹친다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/.../AttractionPageController.kt", "line": 41, "quote": "return ResponseEntity.status(status)" },
      { "file": "spring-webmvc-7.0.6.jar HttpEntityMethodProcessor (javap)", "line": 391, "quote": "status==200 && (GET||HEAD) → isResourceNotModified → flush; return (헤더 복사는 그 앞 267-299)" },
      { "file": "gradle/libs.versions.toml", "line": 3, "quote": "springBoot = \"4.0.4\"" } ],
    "reason": "바이트코드로 확인했다: 엔티티 헤더를 응답에 먼저 싣고 200 GET/HEAD 에서 If-None-Match 를 직접 평가하므로, 수동 checkNotModified 는 판정이 둘로 갈리고 별도 304 경로에서 헤더가 빠진다." },
  { "id": "A4 런타임 바닥글과 초기 HTML 바닥글의 순서·주소 형태", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/src/components/Footer.tsx", "line": 47, "quote": "<a className=\"site-footer-policy\" href=\"/privacy\">" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 19, "quote": "「소개 /about · 연락처 /contact · 개인정보처리방침 /privacy · 데이터 출처 /data-sources」" } ],
    "reason": "런타임은 방침·소개·연락처 순서이고 스펙은 소개·연락처·방침 순서라 차이가 실재한다. 리뷰어 스스로 비차단으로 적었다." },
  { "id": "D1 바닥글 라벨 「소개」가 기존 화면의 「사이트 소개」와 다르다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/components/Footer.tsx", "line": 51, "quote": "사이트 소개" },
      { "file": "portal-fe/src/seo/copy.mjs", "line": 994, "quote": "title: portalTitle('사이트 소개')," },
      { "file": "portal-fe/src/pages/ContactPage.tsx", "line": 71, "quote": "운영 주체와 데이터 출처는 <a href=\"/about\">사이트 소개</a>에 있습니다." } ],
    "reason": "기존 화면 세 곳이 모두 「사이트 소개」이므로 스펙 라벨 「소개」와 어긋난다(스타일이 아니라 같은 대상의 이름 불일치)." },
  { "id": "D2 「라이선스 문자열이 대장과 같다」의 비교 규칙이 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/architecture/data-sources.md", "line": 75, "quote": "| 필요 | 〃 (행마다 `cpyrhtDivCd`) |" },
      { "file": "docs/architecture/data-sources.md", "line": 88, "quote": "**공공누리 제3유형으로 취급** (포털 표기 미확인 — 같은 기관 대기오염정보 기준)" },
      { "file": "docs/architecture/data-sources.md", "line": 89, "quote": "| **행정구역(법정동)** | 행정안전부 행정표준코드관리시스템 |" } ],
    "reason": "라이선스 열에 〃(69-77 의 9행)·굵게·필드명·내부 메모가 실재하고, 데이터 열도 굵게 표기된 행(89, 97)이 있어 정규화 없이는 비교도 공개도 성립하지 않는다." },
  { "id": "D3 같은 라이선스를 「KOGL」과 「공공누리」 두 이름으로 공개", "verdict": "demote", "severity": "MINOR",
    "evidence": [
      { "file": "CLAUDE.md", "line": 0, "quote": "출처표시 의무가 있는 것(GeoNames CC BY 4.0, TourAPI 공공누리, 참가격 KOGL 제1유형)" },
      { "file": "docs/architecture/data-sources.md", "line": 99, "quote": "GeoNames(CC BY 4.0), TourAPI(공공누리), 참가격(KOGL 제1유형), 기상청(공공누리 제1유형)" },
      { "file": "docs/architecture/data-sources.md", "line": 92, "quote": "| 제한없음 / KOGL 제1유형 |" } ],
    "reason": "ⓐ 프로젝트 표준(CLAUDE.md·대장 :99)이 참가격을 「KOGL 제1유형」으로 나란히 적는 것을 수용된 표기로 둔다. 「제한없음/제한 없음」 띄어쓰기는 표기 통일이라 스타일이다. 남는 것은 노출 문구 개선뿐이라 MINOR." },
  { "id": "D4 「출처표시 의무가 있으면 그 문구」의 대상이 대장 §1 에 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 13, "quote": "라이선스(출처표시 의무가 있으면 그 문구)」 세 열로 … 대장에 없는 값은 쓰지 않는다." },
      { "file": "docs/architecture/data-sources.md", "line": 100, "quote": "화면 하단 또는 관련 페이지에 표기한다 — `place` 화면은 \"출처: 한국관광공사 TourAPI\"," } ],
    "reason": "§1 표에는 라이선스 이름만 있고 표기 문구는 다른 절에 있어 스펙의 「그 문구」가 가리킬 값이 없다. (a)/(b) 중 선택은 사용자 판단이다." },
  { "id": "D5 TourAPI 「공공누리 (출처표시)」 vs §2 「행마다 다름·Type3」", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/architecture/data-sources.md", "line": 68, "quote": "| 관광지 | 한국관광공사 TourAPI 4.0 | 필요 | 공공누리 (출처표시) |" },
      { "file": "docs/architecture/data-sources.md", "line": 168, "quote": "공공누리 유형은 **행마다 다르다**(`cpyrhtDivCd`, 표본은 `Type3` = 출처표시·변경금지)" } ],
    "reason": "대장 내부 불일치가 실재하고, 결정 ②대로 §1 만 옮기면 공개 페이지가 변경금지 조건을 감춘다. 대장 수정이 범위 밖이라 사용자 판단으로 넘긴다." },
  { "id": "D6 About 요약 축약 시 에어코리아 「확정 전 자료」 고지가 빠진다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/AboutPage.tsx", "line": 85, "quote": "<li>한국환경공단 에어코리아 — 대기 실시간 측정 (확정 전 자료)</li>" },
      { "file": "docs/architecture/data-sources.md", "line": 261, "quote": "화면은 「출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료」와 측정소 이름" } ],
    "reason": "SR-1.5 로 About 목록이 줄고 SR-1.2 는 세 열만 옮기므로 이 고지가 공개 화면에서 사라진다. 문구는 대장에 있는 값이다." },
  { "id": "IMPL-R1 SR-1.3 「페이지 TS 상수」는 프리렌더가 읽을 수 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 95, "quote": "} from '../src/seo/copy.mjs';" } ],
    "reason": "A1 과 같은 사실(중복). 실측과 일치한다." },
  { "id": "IMPL-R2 수동 checkNotModified 대신 eTag() 만, 분기는 Page.Found", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/.../AttractionPageController.kt", "line": 39, "quote": "is RenderAttractionPageUseCase.Page.Fallback -> 200 to FALLBACK" },
      { "file": "spring-webmvc-7.0.6.jar HttpEntityMethodProcessor (javap)", "line": 354, "quote": "if_icmpne(HttpStatus.OK) → GET/HEAD → isResourceNotModified" } ],
    "reason": "폴백도 200 이라 「200 이면 ETag」로 짜면 폴백에 붙는다는 지적과 프레임워크 동작이 모두 확인된다(A3 와 중복)." },
  { "id": "IMPL-R3 바닥글을 바꾸면 골든 HTML 9개가 깨진다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/test/kotlin/.../AttractionPageRendererTest.kt", "line": 553, "quote": "root shouldContain \"<p data-place-section=\\\"source\\\">출처: 한국관광공사 TourAPI</p><footer>\"" },
      { "file": "search/app/src/test/resources/render/golden/stay-ko.html", "line": 1, "quote": "(9개 골든 모두 rank.1989v.com 바닥글 링크 1건 포함 — grep -c 결과)" } ],
    "reason": ":553 은 링크를 보지 않아 「갱신 대상」이 아니고, 바닥글을 바꾸면 골든 9개가 바이트 비교로 깨지므로 재생성 작업이 스펙에 빠져 있다." },
  { "id": "IMPL-R4 대장 「라이선스」 열은 그대로 비교할 모양이 아니다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/architecture/data-sources.md", "line": 69, "quote": "| 관광지 개요 | TourAPI `detailCommon2` | 필요 | 〃 |" } ],
    "reason": "D2 와 같은 사실이라 유지한다. 단 인용한 79-83·85·88 의 〃 는 라이선스 열이 아니라 키 열(「필요 (〃)」)이다 — 라이선스 열의 〃 는 69-77 뿐이다." },
  { "id": "IMPL-R5 llms 「/about 선례」가 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 687, "quote": "...['/', '/tech', '/tech/search', '/portfolio', '/shop', '/privacy', '/about', '/contact'].map(" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1737, "quote": "function portalLlmsTxt() {  (파일 전체에서 'about' 은 :687 한 곳뿐)" } ],
    "reason": "ⓒ 반대 방향 확인: 스펙이 든 선례가 llms 쪽에는 실재하지 않으므로 발견이 맞다." },
  { "id": "IMPL-R6 :1620-1623 은 /about 분기가 아니라 공통 루프다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1604, "quote": "if (path === '/tech/search') {" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1596, "quote": "async function renderPortalPages(shell, concepts = [], { searchArchitecture } = {}) {" } ],
    "reason": "경로별 분기는 /tech/search 하나뿐이고 renderPortalPages 는 export 되지 않아, 스펙이 지목한 분기와 vitest 대상이 둘 다 없다." },
  { "id": "IMPL-R7 남는 옛 문구 (ContactPage·AboutPage 주석)", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/src/pages/ContactPage.tsx", "line": 71, "quote": "운영 주체와 데이터 출처는 <a href=\"/about\">사이트 소개</a>에 있습니다." },
      { "file": "portal-fe/src/pages/AboutPage.tsx", "line": 13, "quote": "출처 목록은 `docs/architecture/data-sources.md` 대장에서 옮긴 것이다" } ],
    "reason": "SR-1.5 뒤 사실과 어긋나는 문구가 실재한다. 리뷰어가 nit 으로 낸 것을 그대로 둔다." },
  { "id": "IMPL-R8 신뢰 링크는 SITE_LINKS 에 섞지 말고 옆 상수로", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 451, "quote": "색인 대상 호스트 전부. resume 는 색인 대상이 아니라 넣지 않는다 (ADR-0064)." } ],
    "reason": "SITE_LINKS 의 정의가 「호스트 목록」이라 섞으면 의미가 흐려진다. 스펙이 「또는 그 옆 새 상수」로 이미 허용해 nit 이다." },
  { "id": "IMPL-R9 304 는 전송량만 줄인다", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "search/app/src/main/kotlin/.../AttractionPageService.kt", "line": 36, "quote": "return RenderAttractionPageUseCase.Page.Found(renderPort.attractionPage(shell, doc, today))" } ],
    "reason": "매 요청마다 조회와 렌더를 한 뒤 해시하므로 사실이다. 리뷰어도 변경 불요라고 적은 정보성 발견이다." },
  { "id": "TS-R1 바닥글 「최소안」은 패리티 검사가 아니다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": ".github/workflows/ci.yml", "line": 304, "quote": "- name: JSON-LD golden fixture is current" } ],
    "reason": "A2 와 같은 사실(중복). CI diff 한 줄이 함께 있어야 FE 단독 변경이 잡힌다는 보강까지 유효하다." },
  { "id": "TS-R2 대장 파서 정규화 규칙이 스펙에 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/architecture/data-sources.md", "line": 87, "quote": "**공공누리 제3유형(출처표시 · 변경금지)**" } ],
    "reason": "D2 와 같은 사실이라 유지한다(「13칸」은 실제 9칸이라 숫자는 틀렸다). 부정 단언 제안은 유효하다." },
  { "id": "TS-R3 ETag 다섯 사례가 본문에서 나온 값인지 확인하지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 29, "quote": "200 응답에 ETag, 같은 ETag 로 재요청 → 304·본문 0, `W/` 붙은 값도 304, 다른 값 → 200" },
      { "file": "search/app/src/main/kotlin/.../AttractionPageController.kt", "line": 44, "quote": "HTML 은 항상 재검증 — 재색인 뒤에도 CDN 이 옛 메타를 내보내면 서버 렌더를 한 이유가 없다" } ],
    "reason": "나열된 다섯 사례는 상수 ETag 구현으로도 모두 통과하므로, 본문이 바뀌면 ETag 도 바뀌는지 보는 사례가 없다는 지적이 맞다." },
  { "id": "TS-R4 폴백·404 에 If-None-Match 를 실은 사례가 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "search/app/src/test/kotlin/.../AttractionPageControllerTest.kt", "line": 104, "quote": "result.body() shouldBe AttractionPageFixtures.SHELL" } ],
    "reason": "현행 폴백 테스트는 조건부 요청 없이 한 번 부를 뿐이라, 폴백이 304 로 옛 정상 본문을 고정하는 경로를 막는 단언이 없다." },
  { "id": "TS-R5 배포 뒤 검증이 측정 대상의 최신성을 확인하지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/nginx.conf", "line": 148, "quote": "try_files /prerender/$1.html /index.html;" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 33, "quote": "`/data-sources` 200·소프트 404 아님, 304 확인." } ],
    "reason": "옛 이미지도 index.html 폴백으로 200 을 내므로 판정 표지가 필요하다. 전역 규칙 「재기 전에 대상이 최신인지」에 해당한다." },
  { "id": "TS-R6 배포 뒤 curl -sI 는 약한 ETag 경로를 타지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/nginx.conf", "line": 41, "quote": "gzip on;" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 30, "quote": "`curl -sI https://place.1989v.com/attractions/1` 의 ETag 로 `If-None-Match` 재요청 → 304." } ],
    "reason": "Accept-Encoding 없는 HEAD 는 SR-4.2 가 대비한 gzip 경로를 재지 않는다." },
  { "id": "TS-R7 컨트롤러 테스트의 시계가 고정돼 있지 않다", "verdict": "demote", "severity": "MINOR",
    "evidence": [
      { "file": "search/app/src/main/kotlin/.../AttractionPageRenderer.kt", "line": 64, "quote": "(EventSchedule.isEvent(doc.contentTypeId) && EventSchedule.indexExpired(doc.eventPeriod, today))," },
      { "file": "search/app/src/main/kotlin/.../AttractionPageRenderer.kt", "line": 382, "quote": "doc.region?.let { append(regionSection(lang, doc, it, today)) }" },
      { "file": "search/app/src/test/kotlin/.../AttractionPageFixtures.kt", "line": 47, "quote": "region: AttractionRegion? = null," } ],
    "reason": "ⓒ 컨트롤러 테스트가 쓰는 doc() 는 행사가 아니고 region 이 없어 today 가 본문에 들어가지 않는다. 주장한 간헐 실패는 지금 픽스처에서 성립하지 않고 위생 권고로만 남는다." },
  { "id": "TS-R8 About·데이터 출처 프리렌더 본문을 vitest 가 부를 함수가 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1647, "quote": "export function renderTechSearchHtml(shell, generated) {" } ],
    "reason": "포털 페이지 본문은 비공개 루프 안에서 조립되고 선례(renderTechSearchHtml export)가 실재하므로, SR-5 의 vitest 항목은 지금 대상이 없다." },
  { "id": "TS-참고1 게이트가 「원천」 열을 대조하지 않는다", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 15, "quote": "대장 §1 표의 「데이터」 열 집합 == 페이지 상수의 데이터 집합, 각 행의 라이선스 문자열이 대장과 같다." } ],
    "reason": "공개 세 열 중 원천만 대조 밖이라는 사실이 맞다. 리뷰어가 판정 외로 둔 것이라 MINOR." },
  { "id": "TS-참고2 대장 직접 수정 대신 compare(ledgerText, rows) 상설 부정 테스트", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 33, "quote": "회귀 주입(대장에 행 추가 → 게이트 빨강" } ],
    "reason": "공유 트리의 대장을 직접 고치는 주입은 전역 규칙(회귀 주입은 임시 사본에서)과 부딪힌다. 개선 제안 수준." },
  { "id": "TS-참고3 Footer·sitemap·nginx 변경이 SR-5 테스트 목록에 없다", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 33, "quote": "vitest(DataSources 게이트·페이지 렌더·copy·prerender 바닥글·About 프리렌더 본문)" } ],
    "reason": "목록에 런타임 Footer·sitemap 항목이 실제로 없다. 비차단." },
  { "id": "SEC-참고1 프리렌더 표 셀 이스케이프", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 472, "quote": "SITE_LINKS.map(([href, label]) => `<a href=\"${href}\">${escapeHtml(label)}</a>`)" } ],
    "reason": "기존 관례가 실재하고 새 표에도 적용하라는 비차단 권고다." },
  { "id": "SEC-참고2 라이선스 열 내부 메모 공개 범위", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/architecture/data-sources.md", "line": 88, "quote": "(포털 표기 미확인 — 같은 기관 대기오염정보 기준)" } ],
    "reason": "D2-3 과 같은 사실. 보안 차원에서는 비밀이 아니라 MINOR 이고, 공개 여부는 도메인 쪽 사용자 판단으로 넘긴다." },
  { "id": "UC-1 영문 place 화면의 링크 문구가 정해지지 않았다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/components/Footer.tsx", "line": 39, "quote": "{lang === 'en' ? 'Explore services' : '서비스 탐색'}" },
      { "file": "portal-fe/src/pages/place/AttractionPage.tsx", "line": 574, "quote": "<Footer lang={lang}>" } ],
    "reason": "Footer 는 lang 을 받지만 정책 링크는 국문 고정이고, SR-2.1 「같은 문구」가 그 상태를 굳힌다. 문구는 사용자 판단이다." },
  { "id": "UC-2 Goal 「모든 화면」이 셸 폴백 경로에서 거짓이 된다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/index.html", "line": 139, "quote": "<div id=\"root\"></div>" },
      { "file": "portal-fe/nginx.conf", "line": 235, "quote": "try_files /prerender/$1$2/$3.html /index.html;" },
      { "file": "portal-fe/nginx.conf", "line": 211, "quote": "try_files /index.html =404;" } ],
    "reason": "개요 없는 지역·프록시 폴백·search 폴백 세 경로가 바닥글 없는 맨 셸을 내므로 Goal 문장과 SR-5 지역 검증이 어긋난다." },
  { "id": "UC-3 배포 뒤 304 확인이 크롤러 경로를 재현하지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/nginx.conf", "line": 41, "quote": "gzip on;" } ],
    "reason": "TS-R6 과 같은 사실(중복)." },
  { "id": "UC-4 Q1 이 부정일 때 완료 판정이 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 82, "quote": "304 응답 확인 (→ 크롤 통계의 304 비율)" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/context/open-questions.yml", "line": 6, "quote": "answer: SR-4.4 에서 origin 직접 vs 공개 주소를 비교해 기록." } ],
    "reason": "Cloudflare 설정 변경이 범위 밖인데 공개 주소 304 실패 시 S2-8 완료 여부를 가를 규칙이 스펙에 없다." }
]
```

SUMMARY: keep 34 / demote 2 / dismiss 0

NOTES: `nginx.conf` 에 `gzip_proxied` 지시어가 없다. 기본값 off 라면, 앞단 프록시가 `Via` 헤더를 단 요청에는 proxy_pass 응답이 압축되지 않아 `W/` 변환 자체가 안 일어날 수 있다. Q1 측정 때 origin 직접 응답과 Cloudflare 경유 응답의 `Content-Encoding` 을 함께 기록할 것(새 발견이 아니라 메모).

## 3. spec.md 에 반영할 편집 목록

1. **SR-1.1** — 「sitemap·llms 에 한 줄씩(`/about` 선례 따름)」
   → 「sitemap 은 `prerender-seo.mjs:687` 의 포털 경로 배열에 `'/data-sources'` 를 더한다. llms 에는 선례가 없다(`portalLlmsTxt()` :1737 에 `/about`·`/contact`·`/privacy` 줄이 없음). [사용자 판단 U6 결과에 따라] `## 참고` 아래 `- [데이터 출처](${PORTAL_ORIGIN}/data-sources): 원천·라이선스 목록` 한 줄을 새로 두거나, llms 를 범위에서 뺀다.」

2. **SR-1.2** — 「출처표시 의무 항목(…)은 대장의 표기를 그대로. 대장에 없는 값은 쓰지 않는다.」
   → 「각 칸은 SR-1.4 의 정규화를 거친 대장 값이다. 비고 열을 하나 두어 대장 본문에 있는 사실만 싣는다: 대기 실시간 측정에는 「실시간 측정값으로 확정 전 자료」(:261), [U1 결과에 따라] TourAPI 행에는 「행마다 공공누리 유형이 다름(표본 제3유형 = 출처표시·변경금지)」(:168). 라이선스 종류별 고정 고지는 [U3 결과에 따라] (a) 두지 않음 / (b) 데이터가 아닌 상수로 두고 게이트 대조에서 뺀다.」

3. **SR-1.3** — 「데이터는 페이지의 TS 상수로 두고(대장을 빌드 때 읽지 않는다)」
   → 「데이터는 `portal-fe/src/seo/dataSources.mjs`(또는 `copy.mjs` export)의 `.mjs` 상수 하나에 두고, 페이지·프리렌더·게이트가 모두 이것을 import 한다(대장을 빌드 때 읽지 않는다).」

4. **SR-1.4** — 「대장 §1 표의 「데이터」 열 집합 == 페이지 상수의 데이터 집합, 각 행의 라이선스 문자열이 대장과 같다.」
   → 「정규화 규칙(테스트 파일 안 함수 하나): ① `**`·백틱 제거(데이터 열 포함) ② 라이선스 열의 `〃` 는 바로 윗행의 정규화된 값으로 펼친다. `〃 (…)` 의 괄호 부분은 비고로 보낸다 ③ [U2 결과에 따라] 괄호 안 내부 메모를 버리거나 공개한다. 비교: 정규화한 데이터 집합 == 상수 데이터 집합, 행마다 라이선스가 완전 일치. [U5 결과에 따라] 원천 열도 같은 규칙으로 대조한다. 부정 단언: 상수 어느 칸에도 `〃`·`**`·백틱이 없고, 파싱된 라이선스는 빈 문자열이 아니다. 비교는 `compare(ledgerText, rows)` 로 짜서, 행을 하나 더한 텍스트를 넣는 상설 부정 테스트를 둔다. 파일을 못 읽으면 실패.」

5. **SR-1.5** 끝에 덧붙임 → 「`ContactPage.tsx:71` 문구를 데이터 출처 링크(`/data-sources`)로, `AboutPage.tsx:13-14` 주석을 새 원본 위치로 함께 고친다. AboutPage 의 `useSeo` description(`:23-24`)은 `PORTAL_PAGES['/about'].description` 을 참조한다.」

6. **SR-2.1** — 「`SITE_LINKS`(또는 그 옆 새 상수)와 … 「소개 /about · 연락처 /contact · 개인정보처리방침 /privacy · 데이터 출처 /data-sources」」
   → 「`SITE_LINKS` 는 호스트 목록이라 섞지 않고, 옆에 새 상수(`TRUST_LINKS`)를 `copy.mjs` export 로 둔다. Kotlin 은 `siteLinks()` 옆 별도 함수로 둔다. 라벨·순서는 「사이트 소개 /about · 연락처 /contact · 개인정보처리방침 /privacy · 데이터 출처 /data-sources」. [U4 결과에 따라] 런타임 Footer 도 이 순서로 바꾼다. 초기 HTML 바닥글은 영문 화면에서도 국문 라벨이다.」

7. **SR-2.2** — 「…패리티 테스트를 하나 둔다(…). 최소안: 각 쪽 테스트가 같은 4링크 리터럴을 단언(`AttractionPageRendererTest.kt:553` 갱신, prerender 테스트에 한 단언).」
   → 「vitest 가 `copy.mjs` 의 바닥글 상수와 export 한 `siteFooter`(또는 `renderRegionDetail`) 출력으로 `search/app/src/test/resources/render/footer-links-golden.json` 을 쓴다. Kotlin 테스트는 렌더 HTML 의 `<footer>` 에서 href·라벨을 순서째 뽑아 골든과 비교한다. `ci.yml` JSON-LD 골든 단계 옆에 `git diff --exit-code -- …/footer-links-golden.json` 한 줄을 더한다. 렌더러 골든 HTML 9개는 `UPDATE_RENDER_GOLDEN=1 ./gradlew :search:app:test --tests '*AttractionPageRendererTest'` 로 다시 만들고, diff 가 `<footer>` 안뿐인지 확인한다. `:553` 은 갱신 대상이 아니다.」

8. **SR-2.3** — 「런타임 Footer(`components/Footer.tsx:47-55`)에 데이터 출처 링크 한 줄 추가.」
   → 「…추가하고 순서를 SR-2.1 과 맞춘다. [U4 결과에 따라] `lang === 'en'` 이면 「About · Contact · Privacy policy · Data sources」(대상 페이지는 국문), 또는 국문 고정이라는 사실을 적는다.」

9. **SR-3.1** — 「`prerender-seo.mjs:1620-1623` 의 `/about` 분기 본문을 …」
   → 「`renderPortalPages`(:1596)는 `/tech/search` 외에 분기가 없다. `/about`·`/data-sources` 분기를 새로 두고 본문은 export 한 순수 함수 `renderAboutHtml(shell)`·`renderDataSourcesHtml(shell)`(선례 `renderTechSearchHtml` :1647)가 만든다. About 절 상수 모양: `{ heading, paragraphs: (string | { href, label })[][], items?: { href, label, desc }[] }`. HTML 문자열과 `dangerouslySetInnerHTML` 은 쓰지 않는다. 표 셀은 `escapeHtml`.」

10. **SR-4.1** — 「…강한 ETag(`"…"`)를 만들고 `WebRequest.checkNotModified(etag)` 가 true 면 304(본문 없음), 아니면 `ResponseEntity.ok().eTag(etag)`.」
   → 「`Page.Found` 분기의 `ResponseEntity` 에만 `.eTag(<본문 UTF-8 바이트 SHA-256 hex 앞 16자>)` 를 더한다. 304 판정은 Spring `HttpEntityMethodProcessor` 에 맡긴다(200·GET/HEAD 에서 If-None-Match 평가, 엔티티 헤더 유지). `WebRequest` 파라미터는 두지 않는다. 분기 기준은 상태 코드가 아니라 `is Page.Found` 다(Fallback 도 200).」

11. **SR-4.3** — 「테스트(…): 200 응답에 ETag, … 404·폴백엔 ETag 없음.」 끝에 덧붙임
   → 「+ 304 응답에도 `ETag`·`Cache-Control`·`X-Render` 가 있다. + 같은 id 로 두 번째 조회 문서의 개요만 바꾸고 첫 응답 헤더에서 읽은 ETag 를 보내면 200·새 개요·다른 ETag(테스트 안에서 해시를 다시 계산하지 않는다). + 같은 id 의 국문·영문 경로는 ETag 가 다르다. + 색인 조회가 예외일 때 정상 ETag 를 보내면 200·셸 본문·ETag 없음, 404 도 같은 모양.」

12. **SR-4.4** — 「`curl -sI https://place.1989v.com/attractions/1` 의 ETag 로 `If-None-Match` 재요청 → 304.」
   → 「`curl -s -o /dev/null -D - --compressed …/attractions/1` 와 `--compressed` 없는 GET 두 벌로 받은 ETag(`W/` 여부 기록)를 그대로 `If-None-Match` 에 실어 304 를 본다. origin 직접(`ssh msa-oci`)도 같은 두 벌로 측정해 Q1 표에 넣는다. origin 304 가 확인되면 S2-8 은 완료로 본다. 공개 주소에서 ETag 가 사라지면 그 사실과 Cloudflare 후속(설정은 사용자 몫)을 계획서 S2-8 비고에 남기고, 크롤 통계 304 비율은 배포 후 관찰 항목으로 넘긴다.」

13. **SR-5** 배포 뒤 절의 첫 단계로 덧붙임 → 「측정 전 최신성 확인: 상세 SSR 본문에 `href="https://1989v.com/data-sources"` 가 있고, `/data-sources` 응답에 `<!--seo:prerendered-->` 와 대장 행 하나(`GeoNames`)가 함께 있어야 한다. 하나라도 없으면 그 측정은 버리고 Q1 을 기록하지 않는다. 지역 초기 HTML 확인은 프리렌더 파일이 있는(개요 있는) 지역 코드로 한다.」 회귀 주입 「대장에 행 추가」 → 「`compare` 에 행을 더한 텍스트를 넣는 상설 부정 테스트(공유 트리의 대장은 고치지 않는다)」.

14. **Goal** — 「place 의 모든 화면(JS 없이 보는 크롤러 포함)이」
   → 「place 의 프리렌더·SSR 본문이 있는 화면(JS 없이 보는 크롤러 포함)이」

15. **Out of Scope** 에 덧붙임 → 「바닥글 없는 맨 셸을 내는 경로(개요 없는 지역 `nginx.conf:228-236`, 상세 프록시 폴백 `:205-212`, search 셸 폴백 `AttractionPageController.kt:39`).」

16. **Existing Code to Leverage** — 「`prerender-seo.mjs:454-476,1620-1623`」 → 「`prerender-seo.mjs:454-476,687,1596-1629,1647,1737`」. 「`AttractionPageRendererTest.kt:553,556`」 → 「`AttractionPageRendererTest.kt:568-599`(골든), `AttractionJsonLdParityTest.kt`, `ci.yml:304-305`」.

17. (선택, D3 MINOR) SR-1.2 에 한 줄 → 「KOGL 은 공공누리의 영문 약칭이라는 각주를 페이지에 둔다(대장 표기는 바꾸지 않는다).」

## 4. 재리뷰가 필요한 차원
- **architecture**: 공유 `.mjs` 상수 위치, 바닥글 골든 구조, 304 를 프레임워크에 맡기는 방식(편집 3·7·10).
- **domain**: 정규화 규칙, 비고 열, 고지 범위(편집 2·4·6). D1~D6 이 고쳐졌는지 확인.
- **test-strategy**: 골든·CI diff, ETag 추가 사례, 상설 부정 테스트, 최신성 기준(편집 4·7·11·13).
- **implementation**: export 함수, 골든 재생성 절차, llms 자리(편집 1·7·9).
- **usecase**: Goal 축소, 예외 경로, 영문 문구, Q1 분기(편집 8·12·14·15).
- **security**: 재리뷰 불요(SHIP 유지). 편집 2(b)에서 고지 상수를 더해도 공개 정적 문구라 범위 밖이다.

## 5. 사용자가 정해야 할 항목
- **U1 (D5) TourAPI 라이선스 표기**: 대장 §1 은 「공공누리 (출처표시)」(:68)이고 §2 는 「행마다 다름, 표본 Type3 = 출처표시·변경금지」(:168)다.
  - (가) §1 그대로 공개
  - (나) 비고에 §2 사실을 덧붙임(대장에 있는 값이라 「대장에 없는 값 금지」에 안 걸림)
  - (다) 대장 §1 자체를 고치는 후속 작업을 연다(지금은 범위 밖)
- **U2 (D2-3·SEC-참고2)**: 「포털 표기 미확인 — 같은 기관 대기오염정보 기준」 같은 괄호 안 내부 메모를 공개 페이지에 낼지 여부.
- **U3 (D4) 출처표시 고지 방식**:
  - (a) 라이선스 열 문자열만 싣고, 실제 표기 의무는 화면별 출처 줄이 진다
  - (b) 라이선스 종류별 고정 고지(공공누리 유형 링크, CC BY 4.0 링크와 「가공함」)를 게이트 밖 상수로 둔다
  - 리뷰어 권고는 (b)다. GeoNames 는 가공해서 쓰므로 CC BY 의 변경 표시 대상이다.
- **U4 (UC-1·D1·A4) 바닥글 문구와 순서**:
  - 영문 화면 런타임 Footer 를 「About · Contact · Privacy policy · Data sources」로 할지, 국문 고정으로 둘지
  - 순서를 런타임에 맞출지(방침·소개·연락처·출처), 스펙에 맞출지(소개·연락처·방침·출처)
  - 라벨 「사이트 소개」 채택은 판정상 필요하다(D1 유지).
- **U5 (TS-참고1)**: 게이트가 「원천」 열도 대조할지(공개 세 열 전부를 결정 ③의 대상으로 볼지).
- **U6 (IMPL-R5)**: llms 에 데이터 출처 줄을 새로 둘지, 범위에서 뺄지.
- **U7 (UC-4)**: 공개 주소에서 304 가 안 나와도 origin 304 확인만으로 S2-8 을 완료로 칠지.

## 참조 경로
- 스펙: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-08-place-trust-pages-etag/spec.md`
- 리뷰 원문: 같은 폴더 `context/engineer-review-{architecture,domain,implementation,security,test-strategy,usecase}.md`
- 원천 대장: `…/wt-impl/docs/architecture/data-sources.md`
- 주요 대조 코드:
  - `…/wt-impl/search/app/src/main/kotlin/com/kgd/search/presentation/render/controller/AttractionPageController.kt`
  - `…/wt-impl/portal-fe/scripts/prerender-seo.mjs`
  - `…/wt-impl/portal-fe/nginx.conf`
  - `…/wt-impl/portal-fe/src/components/Footer.tsx`
  - `…/wt-impl/portal-fe/src/pages/AboutPage.tsx`