# Engineer Review — implementation (2라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md`(개정본), 워크트리 `wt-impl`.
범위: 1라운드 R1~R9 반영 확인 + 심판 편집 1·7·9(export 함수·골든 재생성·llms 자리) + `TRUST_LINKS`·Kotlin 별도 함수·`.eTag()` 단독 방식의 구현 가능성과 빠진 변경 지점(테스트·CI 포함).

## 1라운드 반영 확인

| 1R | 반영 위치 | 판정 |
|---|---|---|
| R1 `.tsx` 상수 → `.mjs` | SR-1.3 `src/seo/dataSources.mjs` | 해소. 프리렌더는 `../src/seo/copy.mjs` 를 import 하는 번들 없는 스크립트이고(`prerender-seo.mjs:95`), `tsconfig.app.json:16` 이 `allowJs` 라 페이지와 테스트도 `.mjs` 를 그대로 읽는다 |
| R2 `.eTag()` 만 사용, `Page.Found` 분기 | SR-4.1 | 해소. 분기 지점 `AttractionPageController.kt:35-40`, 헤더 조립 `:41-46`. 테스트가 `MockMvcBuilders.standaloneSetup`(`AttractionPageControllerTest.kt:34`)이라 `HttpEntityMethodProcessor` 를 실제로 거친다. 304 판정을 테스트로 고정할 수 있다 |
| R3 골든 HTML 9개 | SR-2.3 | 해소. 명령이 테스트 주석(`AttractionPageRendererTest.kt:569`)과 같다. `--tests` 로 범위를 지정했고 경로는 `File("src/test/resources/render/golden")`(`:571`)이다 |
| R4 정규화 규칙 | SR-1.4 | 해소 |
| R5 llms 자리 | SR-1.1 `## 참고`(`prerender-seo.mjs:1758`) 아래 한 줄 | 해소 |
| R6 export 순수 함수 | SR-3.1 `renderAboutHtml(shell)`·`renderDataSourcesHtml(shell)` | 해소. 선례 `renderTechSearchHtml`(`:1647`)이 있다. 이 모듈을 import 해도 main 이 돌지 않게 막혀 있다(`:151` `import.meta.url === pathToFileURL(process.argv[1])`). vitest 가 이 모듈을 import 하는 선례도 이미 4곳이다(`prerenderTechSearch.test.ts:8`, `RegionPage.test.tsx:20` 등) |
| R7 옛 문구 | SR-1.5 | 해소 |
| R8 `SITE_LINKS` 와 분리 | SR-2.1 `TRUST_LINKS` + Kotlin `siteLinks()` 옆 별도 함수 | 해소. `siteLinks()` 는 private 이고 `shellBody` 한 곳에서만 쓴다(`AttractionPageRenderer.kt:648-663`). 옆에 함수 하나를 더해도 충돌하지 않는다 |
| R9 | Out of Scope 「304 의 서버 비용 절감」 | 해소 |

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스·모듈 존재 | OK. `nginx.conf:145`, `copy.test.ts:166`, `prerender-seo.mjs:687,1596,1647,1737`, `App.tsx:248-249`, `AboutPage.tsx` h2 넷(`:39,50,75,95`), 서비스 `Clock` 주입(`AttractionPageService.kt:17`, 고정 시계 가능), `AttractionPageFixtures.doc(overview=…)`(`:41-45`, 「개요만 바꾼 문서」 사례 가능) |
| 2 | 기존 코드와 충돌 | **I1** (테스트 사례 하나가 현 렌더 구조와 모순된다) |
| 3 | 복잡도 위험 | 낮음. 골든 구조가 `jsonld-golden.json` 선례와 같다(`attractionJsonLdGolden.test.ts:24` 쓰기 → `AttractionJsonLdParityTest.kt:38` 읽기 → `ci.yml:304-305` diff) |
| 4 | NFR 안티패턴 | 없음. 해시는 렌더 뒤 한 번 계산한다 |
| 5 | 마이그레이션·롤백 | 해당 없음. 스키마 변경이 없고 이미지를 되돌리면 끝난다 |
| 6 | 동시성 | 해당 없음 |

## 이슈

### I1 (REVISE) SR-4.3 「같은 id 의 국문·영문 경로는 ETag 가 다르다」는 구현할 수 없다
- 스펙: `spec.md:34`
- 코드: `Page.Found` 본문은 `renderPort.attractionPage(shell, doc, today)` 로 만든다(`AttractionPageService.kt:36`). `query.pathLang` 은 NotFound 경로(`:34`)에서만 쓴다. 같은 id 는 같은 doc 을 돌려주므로, 국문 경로와 영문 경로의 본문이 바이트 단위로 같다. 기존 테스트도 「영문 경로로 국문 문서를 요청해도 canonical 은 문서 언어 경로」라고 고정한다(`AttractionPageControllerTest.kt:56-63`). 본문 해시 ETag 라면 두 경로의 값은 **같아야 정상**이다.
- 위험: 이 사례를 그대로 두면 테스트가 빨강이 된다. 구현자가 통과시키려고 `pathLang` 을 해시에 섞으면 「본문 해시」 결정(세션 결정 ⑥)을 깬다.
- 수정안: 사례를 「언어가 다른 두 문서(`doc()` 와 `doc(id="6001", lang="en")`)는 ETag 가 다르다」로 바꾼다. 같은 id 의 두 경로에 대해서는 「본문이 같으므로 ETag 도 같다」를 단언하거나 사례를 뺀다.

### I2 (MINOR) 새 골든 파일은 `git diff` 만으로는 추적되지 않은 상태를 못 잡는다
- 스펙: SR-2.2 「`git diff --exit-code -- …/footer-links-golden.json` 한 줄」.
- 코드: `footer-links-golden.json` 은 새 파일이다. 이 레포는 같은 이유로 `test -z "$(git status --porcelain -- …)"` 를 함께 둔다(`ci.yml:96,101,109`).
- 영향: 커밋을 빠뜨리면 frontend-gate 는 초록이다. 다만 Kotlin 테스트가 classpath 에서 파일을 못 찾아 실패하므로, 구멍은 test-gate·images 쪽에서 막힌다.
- 수정안: CI 단계를 `git diff --exit-code` + `test -z "$(git status --porcelain -- …)"` 두 줄로 한다.

### I3 (MINOR) 골든에 담을 범위가 두 가지로 읽힌다
- 스펙: SR-2.2 「`TRUST_LINKS` 와 export 한 프리렌더 바닥글 함수 … 출력에서 href·라벨을 순서째 뽑아」.
- 모호한 점: 골든을 `TRUST_LINKS` 상수에서 쓰면 FE 쪽 근거가 렌더 출력이 아니라 상수가 된다. 그러면 바닥글 함수가 상수를 그리지 않아도 초록이다.
- 수정안: 「골든은 바닥글 함수 출력(`renderRegionDetail` 결과의 `<footer>`)에서 뽑은 href·라벨 전체 목록(SITE_LINKS 6 + TRUST_LINKS 4, 순서째)이다. `TRUST_LINKS` 는 그 안에 부분열로 들어 있는지 단언하는 데만 쓴다」로 한 줄 고정한다. Kotlin `siteLinks()` 의 place 항목은 `origin` 프로퍼티다(`AttractionPageRenderer.kt:659`). 테스트 기본값이 `https://place.1989v.com` 인지 함께 확인한다.
- 참고: `siteFooter` 는 모든 호스트의 프리렌더가 함께 쓴다(`prerender-seo.mjs:471-478`). 그래서 4링크는 game·blog·rank·deal 초기 HTML 에도 붙는다. 결정 ④의 범위(「초기 HTML 바닥글」)와 맞고, 지금 바닥글 문자열을 단언하는 FE 테스트는 없다(`__tests__` grep 0건). 의도한 범위라면 문서에 한 줄로 밝혀 두면 된다.

### I4 (nit) 대장을 고친 사람에게 길 안내
- 대장에 행을 더하면 frontend-gate 의 `dataSources.test.ts` 가 빨강이 된다. 그런데 대장 쪽에는 `dataSources.mjs` 를 가리키는 표시가 없다.
- 수정안: 게이트의 실패 메시지에 `portal-fe/src/seo/dataSources.mjs 를 같이 고친다` 를 넣는다. 대장 본문은 범위 밖이라 고치지 않는다.

## 확인한 것(문제 없음)
- frontend-gate 는 모든 push·PR 에서 돈다. 경로 필터가 없다(`ci.yml:21-26`). 전체 체크아웃이라(`:240-245`) 게이트가 `docs/architecture/data-sources.md` 를 읽을 수 있다. 선례 `privacyRetention.test.ts:12,30` 이 같은 방식으로 레포 루트 파일을 읽는다.
- vitest(`:298-300`)가 골든 diff 단계(`:304-305`)보다 먼저 돌므로, 새 diff 줄을 그 옆에 두면 순서가 맞다.
- 폴백·404 에 조건부 요청을 보낼 때: 폴백은 응답에 ETag 가 없어 304 로 바뀌지 않는다. 404 는 상태가 200 이 아니라 평가 대상이 아니다(심판 바이트코드 확인, `review-verdict-round1.md:5`). SR-4.3 사례가 성립한다.
- `PORTAL_PAGES` 에 키를 더하면 프리렌더 루프와 nav 가 자동으로 따라온다(`prerender-seo.mjs:1600-1603`). 이 경우 `copy.test.ts:166` 배열과 sitemap 배열(`:687`)만 손으로 고친다. 둘 다 스펙에 있다.

VERDICT: REVISE
