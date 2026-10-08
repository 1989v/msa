# Engineer Review — implementation (1라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` · 기준 트리 origin/main a05ab2765.
세션 결정 ①~⑥ 은 재론하지 않는다. 아래는 결정을 그대로 두고 **구현 경로**가 성립하는지만 본다.

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조한 클래스·모듈 존재 | 대체로 OK — 인용 라인 일치(`nginx.conf:145`, `copy.mjs:993,998`, `App.tsx:246-249`, `AboutPage.tsx:74-92`, `AttractionPageRenderer.kt:656-663`). 단 「`/about` 분기」(R6)·「llms `/about` 선례」(R5)는 실재하지 않는다 |
| 2 | 기존 코드와 충돌 | **R1·R3·R5·R6** |
| 3 | 복잡도 위험 | **R4·R6** |
| 4 | NFR 안티패턴 | R9(정보) — 해시 계산 비용은 무시할 만하다 |
| 5 | 마이그레이션·롤백 | 해당 없음 — DB·스키마 변경 없음, 이미지 되돌리기로 끝. 스펙에 한 줄 적으면 충분 |
| 6 | 동시성 | 해당 없음 — 렌더는 무상태, ETag 는 본문의 순수 함수 |

## 이슈

### R1 (REVISE) SR-1.3 의 「페이지 TS 상수」는 SR-3 의 프리렌더가 읽을 수 없다
- 스펙: SR-1.3 「데이터는 페이지의 TS 상수로 두고」, SR-3.1 「`/data-sources` 프리렌더 본문은 표 전체」.
- 코드: 프리렌더는 번들 없이 `node scripts/prerender-seo.mjs` 로 돈다(`portal-fe/package.json:9`). 이 스크립트가 공유 문구를 받는 길은 `.mjs` 뿐이다(`prerender-seo.mjs:16-75` 가 `copy.mjs` 만 import). `DataSourcesPage.tsx` 의 상수는 JSX 파일 안이라 import 할 수 없다.
- 수정안: 표 상수를 `portal-fe/src/seo/copy.mjs`(또는 같은 폴더 새 `dataSources.mjs`)에 둔다. 페이지·프리렌더·게이트(SR-1.4)가 그 상수 하나를 import 한다. 「대장을 빌드 때 읽지 않는다」 결정은 그대로 유지된다.

### R2 (REVISE) SR-4.1 — 수동 `checkNotModified` 대신 `ResponseEntity.eTag()` 만, 분기는 `Page.Found` 로
- 스펙: SR-4.1 「`WebRequest.checkNotModified(etag)` 가 true 면 304(본문 없음), 아니면 `ResponseEntity.ok().eTag(etag)`」.
- 코드: 컨트롤러는 `ResponseEntity<String>` 을 반환한다(`AttractionPageController.kt:29,41-46`). Spring MVC 의 `HttpEntityMethodProcessor` 는 상태 200·GET/HEAD 인 `ResponseEntity` 에 ETag 헤더가 있으면 `If-None-Match` 를 스스로 평가해 304 로 바꾸고 본문을 쓰지 않는다. 이때 Cache-Control·X-Render 같은 다른 헤더는 그대로 나간다. 이 동작은 프레임워크 소스를 열어 확인한 것이 아니라 알려진 동작이다(spring-webmvc 7.0.x, 소스 jar 없음). SR-4.3 테스트가 이 동작을 고정한다.
- 수동 경로의 문제는 둘이다. 첫째, 304 를 따로 만들면 그 응답에서 `Cache-Control`·`X-Render` 가 빠진다. 둘째, 반환형이 nullable 이 되거나 304 가 두 경로에서 만들어진다.
- 분기 기준: `Page.Fallback` 도 200 이다(`AttractionPageController.kt:39`). 따라서 「200 이면 ETag」로 짜면 폴백에 ETag 가 붙는다. 판별 지점은 `:35-40` 의 `when` 이고, 기준은 `is Page.Found` 여야 한다.
- 수정안: `Page.Found` 일 때만 `.eTag(sha256(html.toByteArray(UTF_8)).hex.take(16))` 를 붙인다. `WebRequest` 파라미터는 두지 않는다. Spring `eTag()` 는 따옴표가 없으면 감싸므로 따옴표를 넣지 않아도 된다. SR-4.3 에 「304 에도 Cache-Control 이 있다」 단언을 하나 더한다. 약한 비교(SR-4.2) 테스트는 그대로 둔다.

### R3 (REVISE) SR-2 — 바닥글을 바꾸면 골든 HTML 9개가 깨진다
- 스펙: SR-2.2 「최소안: `AttractionPageRendererTest.kt:553` 갱신, prerender 테스트에 한 단언」.
- 코드: `AttractionPageRendererTest.kt:568-599` 는 9개 유형을 `src/test/resources/render/golden/*.html` 과 바이트로 비교한다. 바닥글이 그 안에 있으므로 `siteLinks()`(`AttractionPageRenderer.kt:656-663`)를 바꾸면 9개 모두 빨강이 된다. 반면 `:553` 은 출처 문단 뒤에 `<footer>` 가 오는지만 본다. 링크를 더해도 깨지지 않고, 링크도 검사하지 않는다.
- 프리렌더 쪽: `siteFooter`·`renderPortalPages` 는 export 되지 않는다(`prerender-seo.mjs:471,1596`). 단언은 export 된 `renderRegionDetail`(`:1152`) 이나 `placeDetailPages`(`:1204`) 출력에 건다. 두 함수 모두 `shellBody` 를 거친다.
- 수정안 1: 「`UPDATE_RENDER_GOLDEN=1 ./gradlew :search:app:test --tests '*AttractionPageRendererTest'` 로 골든 재생성, diff 는 `<footer>` 안 4링크뿐」을 작업으로 적는다.
- 수정안 2: `:553` 은 갱신 대상이 아니다. 4링크 리터럴 단언을 새로 둔다. 프리렌더 단언은 `renderRegionDetail` 출력에 건다.

### R4 (REVISE) SR-1.4 게이트 — 대장 「라이선스」 열은 그대로 비교할 수 있는 모양이 아니다
- 스펙: 「각 행의 라이선스 문자열이 대장과 같다」, SR-1.2 「대장의 표기를 그대로」.
- 대장의 모양은 넷이다.
  - 같은 값을 `〃` 로 적은 행이 여럿이다(`data-sources.md:69-77, 79-83, 85, 88`).
  - `〃 (행마다 \`cpyrhtDivCd\`)` 처럼 생략 기호 뒤에 덧붙인 행이 있다(`:75-77`).
  - 굵게 표시와 백틱이 섞여 있다(`:84,85,87,88,90,97`).
  - 데이터 열 자체도 굵게 표시된 행이 있다(`:89` `**행정구역(법정동)**`, `:97` `**주유소·유가**`).
- 위험: 정규화 규칙이 없으면 구현이 둘 중 하나로 간다. 하나는 화면에 `〃`·`**` 를 그대로 노출하는 것이다. 다른 하나는 테스트 안에서 임의로 정규화하는 것인데, 그러면 검사가 자기 근거를 만든다.
- 수정안: 정규화를 스펙에 고정한다.
  - `〃` 는 바로 윗행의 라이선스 값으로 풀고, 뒤 덧붙임은 이어 붙인다.
  - `**` 와 백틱은 제거한다.
  - 비교는 정규화한 대장 값과 상수 값의 완전 일치로 한다.
  - 원천 열은 비교 대상이 아님을 명시한다. 대조하려면 같은 규칙으로 한다.

### R5 (REVISE) SR-1.1 llms — 「`/about` 선례」가 없다
- 스펙: 「sitemap·llms 에 한 줄씩(`/about` 선례 따름)」.
- 코드: sitemap 에는 `/about` 이 있다. 다만 `PORTAL_PAGES` 에서 파생되지 않는 하드코딩 배열이다(`prerender-seo.mjs:687`). `portalLlmsTxt()` 에는 `/about`·`/contact`·`/privacy` 줄이 없다(`:1737-1763`).
- 수정안: llms 에 넣을 자리와 문구를 정한다. 예: `## 참고` 아래 `- [데이터 출처](${PORTAL_ORIGIN}/data-sources): …`. 아니면 llms 를 범위에서 뺀다. sitemap 은 `:687` 배열에 `'/data-sources'` 를 더한다.

### R6 (REVISE) SR-3.1 — `:1620-1623` 은 `/about` 분기가 아니라 공통 루프다. About 문구는 링크가 섞여 있어 모양을 정해야 한다
- 코드 1: `renderPortalPages` 는 `PORTAL_PAGES` 전부를 같은 본문(h1·description·nav)으로 낸다(`prerender-seo.mjs:1603-1629`). 경로별 분기는 `/tech/search`(`:1604-1607`) 하나뿐이다. `/about`·`/data-sources` 는 같은 방식으로 분기를 새로 만들어야 한다.
- 코드 2: `renderPortalPages` 는 파일을 쓰는 비공개 함수다. SR-5 의 「About 프리렌더 본문」 vitest 를 하려면 `renderTechSearchHtml`(`:1647`)처럼 순수 함수를 export 해야 한다.
- About 이전 가능성: 가능하다. AboutPage 의 절은 상태·훅 없는 정적 JSX 다(`AboutPage.tsx:37-105`). 다만 문장 가운데 링크가 있다.
  - `:45` 연락처
  - `:52-70` 서비스 6개(링크 + 설명)
  - `:102` 방침
- 수정안: copy.mjs 상수 모양을 고정한다. 예: `{ heading, paragraphs: (string | { href, label })[][], items?: { href, label, desc }[] }`. React 와 프리렌더가 각자 이 구조를 그린다. `dangerouslySetInnerHTML`·HTML 문자열은 쓰지 않는다.
- 덧붙임: AboutPage 의 `useSeo` description(`AboutPage.tsx:23-24`)은 `PORTAL_PAGES['/about'].description`(`copy.mjs:995-996`)과 같은 문자열의 사본이다. 같은 작업에서 상수를 참조하게 하면 원본이 하나가 된다.

### R7 (nit) 남는 옛 문구
- `ContactPage.tsx:71` 은 「운영 주체와 데이터 출처는 사이트 소개에 있습니다」라고 쓴다. SR-1.5 뒤에는 목록이 `/data-sources` 로 가므로 문구나 링크를 함께 고친다.
- `AboutPage.tsx:13-14` 주석(「출처 목록은 대장에서 옮긴 것」)도 함께 고친다.

### R8 (nit) 신뢰 링크는 `SITE_LINKS` 에 섞지 말고 옆 상수로
- `SITE_LINKS` 의 정의는 「색인 대상 호스트 전부」다(`prerender-seo.mjs:450-453`). 페이지 링크 4개를 넣으면 의미가 흐려진다.
- 스펙이 허용한 대로 새 상수를 둔다. Kotlin 쪽도 `siteLinks()` 옆에 따로 둔다. `shellBody` 는 두 줄을 그린다.
- 라벨: 런타임 Footer 는 「사이트 소개」(`Footer.tsx:50-52`)이고 SR-2.1 은 「소개」다. 어느 쪽으로 맞출지 하나로 정한다.

### R9 (정보) 304 는 전송량만 줄인다
- `AttractionPageService.render` 는 매 요청마다 OpenSearch 를 한 번 조회하고 전체를 렌더한다(`AttractionPageService.kt:25-36`). 본문 해시 ETag 는 그 뒤에 계산된다.
- 따라서 크롤러 재방문의 색인 조회 부하는 그대로다. Goal 에 「전송량·크롤 효율」이라고만 적어 두면 오해가 없다. 변경은 필요 없다.

## 확인한 것(문제 없음)
- nginx: `^/(about|contact|data-sources)$` 앞의 정규식 location 중 `/data-sources` 를 가로채는 것은 없다(`nginx.conf:93,145`). `try_files /prerender/$1.html` 은 `renderPortalPages` 의 출력 경로 `prerender${path}.html`(`prerender-seo.mjs:1628`)과 맞는다. 인그레스 apex 의 `/r`·`/p`·`/g`·`/b` 와도 겹치지 않는다(`commerce-platform.yaml:87-96`).
- `PORTAL_PAGES` 에 키를 더하면 프리렌더 루프와 모든 포털 페이지 nav 가 자동으로 따라온다(`prerender-seo.mjs:1600-1603`). `copy.test.ts:166` 배열 갱신이 필요하다. 이것은 스펙에 이미 있다.
- 상세 SSR 경로는 `If-None-Match` 를 지우지 않는다(`nginx.conf:192-203`). `proxy_intercept_errors` 는 5xx 만 가로채므로 304 는 그대로 통과한다.
- 렌더에 요청마다 바뀌는 값(nonce·현재 시각)은 없다. `today` 는 KST 날짜뿐이라 같은 날 같은 문서는 같은 ETag 를 낸다.

VERDICT: REVISE
