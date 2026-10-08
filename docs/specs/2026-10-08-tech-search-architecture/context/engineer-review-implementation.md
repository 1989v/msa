# Engineer Review — implementation

## 3라운드 (2026-10-08)

- 대상: 2라운드 반영 `spec.md`, 심판 `context/review-verdict-round2.md`. 작업 트리 `wt-impl`(fencesvg 0.11.2 · marked 18.0.9 실설치).
- 방법: 이 리뷰 세션에는 셸 도구가 없어 node 로 돌려 보지 못했다. 대신 `node_modules/marked/lib/marked.esm.js` 와 `node_modules/fencesvg/dist/index.js` 의 해당 함수를 직접 읽어 판정했다. 스크래치 파일은 만들지 않았다.
- 재론하지 않는 것은 사용자 결정 ①~④와 심판 채택안(E1~E17)이다.

### 2라운드 발견 해소

| # | 2라운드 발견 | 개정본 | 판정 |
|---|---|---|---|
| N1 | 요약 불릿의 §4 행 앵커가 안 생긴다 | SR-2.1 ④ `tablerow` 로 `<tr id>`, ⑤ `link` 로 `#x` → `#{idPrefix}x`. SR-2.3 ⑨ 죽은 앵커 게이트. SR-6.1 에 `[x](#nope)` → throw 와 「요약 링크마다 `<tr id>` 존재」 | 해소. 구현 주의 2건은 아래 ①·R2 |
| N2 | 프리렌더 루프가 같은 파일을 일반 본문으로 덮어쓴다 | SR-4.2 가 루프(`prerender-seo.mjs:1591`) 안 `path === '/tech/search'` 분기를 적고, 범용 nav 링크 추가를 예외로 밝힌다. `copy.test.ts:165` 순서도 적었다 | 해소 |
| N3 | og:type 이 프리렌더와 SPA 에서 갈린다 | SR-4.1 끝이 「페이지도 `type` 을 주지 않는다」로 바뀌었다 | 해소 |
| N4 | 드리프트 ⑧ 추출 규칙이 비었다 | SR-5.1 ⑧ 이 `SEARCH_ATTRACTION_CLICK_BOOST_ENABLED:(true\|false)\}` 로 고정하고 ⑦ 도 같은 규칙. SR-6.3 ⑬ 이 env 추가 회귀를 넣었다 | 해소 |
| 참고 | 로컬 vitest 전 렌더 필요 | SR-2.4 넷째 불릿의 `agent-behavior.md:31` 문장이 이를 덮는다 | 해소 |

### 지정 확인 ①~③

**① marked 18 renderer 로 SR-2.1 ④⑤ 를 구현할 수 있다.**
- `table(e)` 는 셀을 `tablecell` 로 먼저 HTML 로 만든 뒤 `this.tablerow({text: n})` 를 부른다(`marked.esm.js:69`). 그래서 `tablerow` 가 받는 것은 **렌더된 셀 HTML 문자열 `{text}` 하나뿐**이다. 행 번호·머리 여부·소속 표는 오지 않는다.
- 그래도 구현은 된다. 머리 행은 `text` 가 `<th` 로 시작하는지로 가른다. 첫 셀은 `<td…>(.*?)</td>` 에서 태그를 걷고 엔터티를 푼 평문이다. 「§4 표만」은 `heading` renderer 가 현재 h2 를 클로저 변수에 적어 두면 된다. marked 는 동기로 문서 순서대로 renderer 를 부른다(`parse` 루프 `:76`). `table` 을 오버라이드해 `e.rows[r][0].text` 를 쓰는 길도 있다.
- `link({href,title,tokens})` 는 원문 href 를 그대로 받는다(`:76`). `#` 로 시작하면 접두사를 붙여 직접 `<a>` 를 내고, 아니면 `false` 를 돌려 기본 renderer 로 넘긴다. `marked.use` 의 래퍼가 `false` 일 때 기본을 부르므로(`:76` `c===!1&&(c=a.apply(r,u))`) 이 모양이 그대로 성립한다.
- 남는 것은 slug 입력의 정의다. 아래 R2 에 적는다.

**② ④ 이벤트 속성 정규식과 ⑨ 앵커 게이트는 fencesvg 출력에서 오탐하지 않는다.**
- fencesvg 0.11.2 번들에는 `href`·`xlink`·`<a `·`<metadata`·`<title`·`<!--` 를 내는 코드가 없다. 그래서 ⑤ `href=` 형식 검사와 ⑨ 앵커 검사는 SVG 를 건드리지 않는다.
- 마커는 `marker-end="url(#…)"` 로 참조한다. ⑨ 는 `href="#x"` 만 보므로 걸리지 않는다.
- 속성은 `` ` ${e}="${…}"` `` 꼴로 이름이 고정이고 `on` 으로 시작하는 속성이 없다. 값은 `Ct()` 로 이스케이프된다. 그래서 ④ `/<[^>]*[\s\/"']on[a-z]+\s*=/i` 가 잡을 자리가 없다. 감싸는 `<div style="overflow-x:auto">`(`index.js:3`)도 걸리지 않는다.
- 좌표는 `Math.round(t*100)/100` 로 소수 둘째 자리까지이고(`fn`·`D`), 경로는 `M x y L x y` 처럼 공백으로 이어진다(`j()`). 그래서 ⑦ 의 IPv4 패턴에 걸리는 `a.b.c.d` 꼴이 생기지 않는다.
- ③ `<meta`·`<link` 접두 일치는 `<metadata`·`<linearGradient` 와 겹칠 수 있는데, 번들에 둘 다 없다.

**③ 훅 명령은 실제 구조에서 그대로 실행된다.**
- `compile-changed.sh:22` 가 `fe` 를 정하고 `:24` 가 `rc=0` 을 둔다. `:26` 이 지금 `[ $fe -eq 1 ] && { (cd portal-fe && npx tsc -b) || rc=$?; }` 이므로, 스펙 문장은 서브셸 안에 `node scripts/render-content.mjs &&` 한 토막을 넣는 것과 같다. 실패 시 `rc` 에 렌더 또는 tsc 의 종료 코드가 담긴다.
- `fe` 는 `portal-fe/**/*.ts(x)` 가 바뀔 때만 1 이다. md 만 바꾼 커밋은 훅이 렌더하지 않는다. md 는 tsc 를 깨지 않고 렌더 실패는 CI 와 이미지 빌드가 잡으므로 이것은 맞는 동작이다.
- `docs/standards/agent-behavior.md:31` 문단도 스펙이 가리킨 그 자리에 있다.

### 새 발견 (실질 결함만)

**R1 그림 5장의 마커 id 가 전부 `d1-…` 로 겹친다 (체크 2)**
- 스펙 SR-2.1 은 「펜스마다 fencesvg `renderDiagram` 을 부른다」고만 적고 `idPrefix` 를 넘기라는 말이 없다.
- 코드는 `renderDiagram` 의 기본값이 `e.idPrefix ?? "d1"` 이다(`fencesvg/dist/index.js:12`). 마커 id 는 `${n}-arrow`·`${n}-cross`·`${n}-async`·`${n}-circle` 이다(`:4`, `:8`). `inlineDiagrams` 만 펜스마다 `d${r}` 로 번호를 올린다(`:15`). 스펙처럼 직접 부르면 한 문서에 `id="d1-arrow"` 가 최대 5번 나온다. 중복 id 는 HTML 위반이고, `url(#d1-arrow)` 는 문서의 첫 정의로 풀린다. 지금은 마커가 같은 함수 `lt()` 라 눈에 안 띄지만 SR-2.3 어느 게이트도 이것을 잡지 않는다.
- 수정안: SR-2.1 에 「펜스 i 마다 `renderDiagram(src, { idPrefix: \`${idPrefix}d${i}\` })`」 한 구절을 넣는다. SR-2.3 ⑨ 에 「출력 안 `id="…"` 중복 0」을 한 줄 더한다. SR-6.1 의 「펜스 3종 md」 케이스에 같은 단언을 둔다.

**R2 한글 slug 를 기본 `link` renderer 에 넘기면 ⑨ 가 거짓 빨강을 낸다 (체크 2, 경미)**
- 스펙 SR-2.1 ⑤ 는 href 를 `#{idPrefix}x` 로 「고쳐 낸다」고만 적었다. ⑨ 는 `href="#x"` 와 `id="x"` 를 문자열로 맞춘다.
- 코드는 기본 `link` 가 href 를 `Y()` 에 통과시키고, `Y` 는 `encodeURI` 다(`marked.esm.js:14`). §4 행 키와 heading 이 한글이라, 고친 href 를 기본 renderer 에 넘기는 구현은 `href="#ts-%EA%B4%80…"` 를 낸다. 반면 heading·행 id 는 날 한글이다. 브라우저에서는 이동이 되지만 ⑨ 는 빌드를 세운다. 소리 나는 실패라 사고는 아니고 구현자의 헛걸음이다.
- 수정안: SR-2.1 ⑤ 에 「`#` 링크는 renderer 가 `<a>` 를 직접 내고 `encodeURI` 를 거치지 않는다」를 적는다. ④ 에는 「slug 입력은 첫 셀의 평문(태그 제거·엔터티 해제, 백틱 제외)」을 적는다. md 작성자가 링크 slug 를 손으로 맞추므로 규칙이 하나여야 한다.

**R3 회귀 ⑫ 는 `CLAUDE_PROJECT_DIR` 가 있으면 다른 트리를 잰다 (체크 2, 경미)**
- 스펙 SR-6.3 ⑫ 는 `HNS_FILES=portal-fe/src/App.tsx .claude/hooks/hns/compile-changed.sh` 로 훅을 돌린다.
- 코드는 `ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"` 다(`compile-changed.sh:7`). 세션 환경에 `CLAUDE_PROJECT_DIR` 가 메인 트리로 잡혀 있으면 워크트리에서 돌려도 메인 트리로 이동한다. 그러면 메인 트리를 재고, 렌더가 생성 JSON 을 메인 트리에 쓴다. 공유 트리에 부수 효과가 남는다.
- 수정안: ⑫ 명령 앞에 `CLAUDE_PROJECT_DIR="$PWD"` 를 붙인다. 「render 를 뺀 사본」 실행에도 같은 접두를 붙인다.

### 체크리스트 (3라운드)

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스/모듈 존재 | 통과. `tablerow`·`link` renderer, `renderDiagram` 의 `idPrefix` 옵션(`index.d.ts:3`), 훅의 `fe`·`rc` 가 모두 있다. |
| 2 | 기존 코드와 충돌 | R1(마커 id 중복) 하나와 경미 2건(R2·R3). |
| 3 | 복잡도 | 낮다. |
| 4 | NFR 안티패턴 | 없다. |
| 5 | 마이그레이션/롤백 | SR-2.3 끝에 명시돼 있다. |
| 6 | 동시성 | 해당 없다. R3 은 공유 트리 부수 효과라 체크 2 에 넣었다. |

### 판정

REVISE. 이슈는 3건이다(실질 1 · 경미 2). 전부 스펙 구절 몇 개 추가로 끝나고 설계와 사용자 결정은 바뀌지 않는다. 2라운드 N1~N4 는 모두 해소됐다. 지정 확인 ①~③ 은 모두 구현 가능 또는 오탐 없음이다.

---

## 2라운드 (2026-10-08)

- 대상: 개정 `spec.md`, `context/probe-2026-10-08.md`, 심판 `context/review-verdict-round1.md`. 작업 트리 `wt-impl`(`portal-fe/node_modules` 는 `npm ci` 실설치, fencesvg 0.11.2 · marked 18.0.9).
- 재론하지 않는 것은 사용자 결정 ①~④(Dockerfile·CI 렌더 스텝 포함)와 심판 채택안이다.

### 1라운드 발견 해소

| # | 1라운드 발견 | 개정본 | 판정 |
|---|---|---|---|
| 1 | 생성 JSON 이 `tsc -b`·Docker·CI 에 없다 | SR-2.4 가 세 곳에 같은 순서로 렌더를 `tsc -b` 앞에 둔다. `Dockerfile:41` 앞으로 `ARG GIT_SHA` 를 올리고, ci.yml Type check 앞에 스텝을 둔다. | 해소 |
| 2 | marked 18 은 heading id·`th scope`·table class 를 안 낸다 | SR-2.1 이 `marked.use({ renderer: { heading, table, tablecell } })` 로 세 가지를 명시한다. | 해소 |
| 3 | `scripts/__tests__` 는 수집되지 않고 jsdom 은 다른 경로를 잰다 | SR-4.4·SR-5.1·SR-6.1 이 `src/content/__tests__/` 와 `// @vitest-environment node` 를 명시한다. 상대 경로 `../../../scripts/…`(=portal-fe)와 `../../../../…`(=레포 루트)도 맞다. | 해소 |
| 4 | 드리프트 ② 는 yml 을 읽어야 하고 ③ 인용이 틀렸다 | ② 는 `application.yml` 을 읽는다. ③ 은 `deployment.yaml` 과 `cronjob-attraction-reindex.yaml` 둘 다 읽는다. Kotlin 기본값과 yml 의 대조 행은 빠졌지만 심판 G5 채택안 범위다. | 해소 |
| 5 | 프리렌더가 JSON 을 모듈 최상위에서 읽으면 기존 테스트가 깨진다 | SR-4.2 는 `main()` 에서 읽고 순수 함수에 넘긴다. 없으면 `PartialSeoFailure` 를 던진다. | 해소 |
| 6 | 소소한 것 6건 | 주석 제거는 SR-2.2 와 ③⑥ 이 맡고, 이벤트 속성 정규식은 ③④ 로 경계를 잡았다. canonical 은 SR-3.2, generated 폴더는 SR-2.4, 롤백 한 줄은 SR-2.3 끝에 있다. doc_roots 우려는 아래 코드 확인으로 닫힌다. | 해소 |

doc_roots 우려가 닫히는 근거는 `doc_map.py`(hns 0.15.1 캐시) `:154-166` 이다. `manual_links` 는 `doc` 이 `doc_roots` 안에 있는지 보지 않고 링크를 만든다. `fnmatch` 의 `*` 는 `/` 도 넘으므로 `search/app/src/main/kotlin/com/kgd/search/*` 는 하위 파일 전부에 걸린다.

### 새 인용 검증

| 인용 | 결과 |
|---|---|
| `portal-fe/Dockerfile:41`, `ARG GIT_SHA :54` | 맞다. ARG 는 선언한 줄 다음 RUN 에서만 보이므로 `:41` 앞으로 올리는 게 필요하다. `COPY . .`(`:13`)가 이미 캐시를 깨므로 비용은 없다. `images.yml:364` 가 `GIT_SHA=$TAG` 를 넘기고 `TAG=${GITHUB_SHA::7}`(`:240`)이다. SR-6.4 의 「gitSha == 이미지 SHA」 비교는 7자리끼리다. |
| `.dockerignore` | `src/content`·`*.md` 를 제외하지 않으므로 md 가 빌드 컨텍스트에 들어간다. |
| `ci.yml:276-295` | Install `:276-278` → Type check `:287-289` → Test `:293-295` 순서다. 렌더 스텝은 Install 뒤, Type check 앞에 들어간다. frontend-gate 는 경로 필터가 없어 모든 PR·main 푸시에서 돈다(`:21-26`, `:224`). `search/` 만 바꾼 PR 도 드리프트 테스트를 탄다. |
| marked 18 renderer | `heading`·`table`·`tablerow`·`tablecell` 모두 `marked.esm.js` 에 renderer 메서드로 있다. |
| fencesvg `renderDiagram` | `index.d.ts:7-10` 은 `{ svg: string\|null, caption: string\|null, warnings: string[] }` 를 돌려준다. probe 와 일치한다. |
| `renderTechSearchHtml(shell, generated)` | 선례 `renderDealHubHtml(shell, sections)`(`prerender-seo.mjs:1252`, 테스트 `prerenderDeal.test.ts:38`)와 같은 모양이라 구현할 수 있다. |
| `renderPortalPages(shell, concepts, { searchArchitecture })` | 현재 `:1584` 는 `(shell, concepts = [])` 이고, 세 번째 인자를 더해도 호출부 `:247` 만 바뀐다. 루프 분기는 아래 N2 에서 다룬다. |
| `PartialSeoFailure :144-156` | 맞다. `main().catch` 는 이 예외만 exit 1 로 보내고 나머지는 경고 후 exit 0 이다(`:149-155`). 그래서 SR-4.2 가 이 예외를 지정한 것이 맞다. |
| 드리프트 ① `rank_constant` | `HybridSearchPipelineInitializer.kt:67`. `:59` 주석은 따옴표가 없어 정규식에 안 걸린다. |
| 드리프트 ② | `application.yml:72-73`. |
| 드리프트 ③ | `deployment.yaml:33-34`, `cronjob-attraction-reindex.yaml:61-62`. 같은 문자열 `microsoft/harrier-oss-v1-270m@31de22b#d640` 이다. |
| 드리프트 ④⑤⑥ | `attractions-index.json` 은 순수 JSON 이다. 경로는 `settings.analysis.filter.tourism_synonyms.synonyms`(`:12`), `settings.analysis.tokenizer.nori_user.user_dictionary_rules`(`:39`), `mappings.properties.embedding.dimension`(`:446`), `method.parameters.m·ef_construction`(`:452-453`)다. |
| 드리프트 ⑦ | `deployment.yaml:36-37` `"true"`. k8s 전체에서 overlay 덮어쓰기는 0건이라 base 값이 실효값이다. |
| 드리프트 ⑧ | `application.yml:78` 이 `${SEARCH_ATTRACTION_CLICK_BOOST_ENABLED:false}` 다. k8s env 는 0건이다(N4 참조). |
| 드리프트 ⑨ | `application.yml:88` `fusion: rrf`. |
| `cronjob-eval.yaml:15-17` | 맞다. `30 22 * * *` = KST 07:30. |
| `/tech/search` 경로 충돌 | `TECH_CATEGORY_KO`(`copy.mjs:873-887`)에 `SEARCH` 가 없다. `renderTechGlossaries` 와 출력 파일 `prerender/tech/search.html` 이 겹치지 않는다. |
| `copy.test.ts:165-170` | 정확 배열 `toEqual` 에 description 200자 이하 조건이 붙는다. 스펙 description 은 약 90자라 통과한다. |

### 새 발견 (실질 결함만)

**N1 요약 불릿의 §4 행 앵커가 생기지 않는다 (체크 1·2)**
- 스펙은 `spec.md:21` SR-1.1 에서 「각 불릿은 §4 해당 행 앵커로 링크」를 요구한다. 그런데 SR-2.1 renderer 는 `heading` 에만 id 를 준다.
- 코드를 보면 marked 18 의 `tablerow`·`tablecell` 은 id 를 내지 않는다. SR-2.3 ⑤ 는 `href="#…"` 의 형식만 보고 대상 id 가 있는지는 보지 않는다. 결과적으로 요약 링크 5~6개가 빌드와 게이트를 초록으로 통과한 채 죽은 앵커가 된다.
- 수정안은 두 가지다. SR-2.1 renderer 에 `tablerow` 를 더해 첫 셀(`항목`) slug + idPrefix 로 `<tr id>` 를 준다. 아니면 불릿을 §4 heading 앵커로 링크한다. 어느 쪽이든 SR-2.3 에 ⑨ 「출력의 모든 `href="#x"` 에 대응하는 `id="x"` 가 있다」를 더하고, SR-6.1 renderContent 테스트에 죽은 앵커 → throw 한 건을 넣는다.

**N2 `PORTAL_PAGES` 에 키를 더하면 기존 루프가 같은 파일을 일반 본문으로도 쓴다 (체크 2)**
- 스펙 SR-4.1·SR-4.2(`spec.md:53-54`)는 `PORTAL_PAGES['/tech/search']` 추가와 「`renderPortalPages` 가 이를 부른다」만 적었다.
- 코드는 `prerender-seo.mjs:1591-1612` 다. `Object.entries(PORTAL_PAGES)` 를 돌며 모든 키에 h1 + description + nav 일반 본문을 `prerender${path}.html` 로 emit 한다. 분기를 적지 않으면 구현에 따라 두 결과가 난다. `renderTechSearchHtml` 호출이 루프 앞에 있으면 일반 본문이 그것을 덮어쓴다. 뒤에 있으면 같은 파일을 두 번 쓴다. 덮어쓰인 경우 SR-4.4 테스트는 순수 함수만 재므로 초록이다. SR-6.2 의 `role="img"` 확인만 이것을 잡는다.
- 수정안은 SR-4.2 에 「루프 안에서 `path === '/tech/search'` 면 일반 본문 대신 `renderTechSearchHtml(shell, searchArchitecture)` 결과를 emit 한다」 한 줄을 넣는 것이다. 루프 위 `nav`(`:1588-1590`)가 나머지 포털 프리렌더 7장에 「검색 아키텍처」 링크를 더하는 것은 의도한 내부 링크라고 한 줄 적는다. 이것은 「기존 /tech 화면 변경은 NAV 한 줄뿐」(SR-3.1)의 예외다. `copy.test.ts:165` 배열에는 `'/tech'` 바로 뒤에 넣는다(`toEqual` 은 순서를 본다).

**N3 og:type 이 프리렌더와 SPA 에서 갈린다 (체크 2, 경미)**
- SR-3.2(`spec.md:47`)는 `useSeo({ …, type: 'article' })` 를 요구한다. 반면 `metaTags`(`prerender-seo.mjs:378`)는 `og:type` 을 `website` 로 고정한다. 크롤러는 website 를, SPA 는 article 을 보게 되어 `useSeo.ts:29-30` 의 「프리렌더와 같은 값」 전제가 깨진다.
- 수정안은 SR-3.2 에서 `type: 'article'` 을 빼는 것이다. 최소 수정이고, TechArticle 은 JSON-LD 가 이미 말한다.

**N4 드리프트 ⑧ 의 추출 규칙이 비어 있다 (체크 2, 경미)**
- 스펙 SR-5.1 ⑧(`spec.md:59`)은 「`application.yml` 기본값, k8s env 부재면 그 값」만 적었다.
- 코드는 `application.yml` 에 `enabled:` 키가 둘이다(`:78` click-boost, `:86` hybrid). 값이 Spring 플레이스홀더 기본값 안에 있다. `enabled:\s*(\w+)` 류로 꺼내면 `$` 에서 실패하거나 다른 키를 집는다.
- 수정안은 정규식을 `SEARCH_ATTRACTION_CLICK_BOOST_ENABLED:(true|false)\}` 로 고정하는 것이다. 같은 테스트에서 `deployment.yaml` 에 이 env 가 없다는 것도 단언한다. env 가 생기면 그 값을 읽도록 실패시켜 사람이 고치게 한다.

**참고 (결함 아님)**: 생성 JSON 이 없는 로컬에서 범위 지정 `npx vitest run` 을 돌리면 페이지·라우트 테스트가 미해결 import 로 빨개진다. CI 는 렌더 스텝이 먼저라 상관없다. SR-6.1 머리에 「먼저 `node scripts/render-content.mjs`」를 한 줄 적어 두면 구현자가 오진하지 않는다.

### 체크리스트 (2라운드)

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스/모듈 존재 | 통과. 새로 만드는 `renderTechSearchHtml`·`techArticleJsonLd` 는 스펙이 신설을 밝힌다. N1 의 행 앵커만 수단이 빠졌다. |
| 2 | 기존 코드와 충돌 | N2(루프 중복 emit) 하나와 경미 2건(N3·N4)이 있다. 빌드 체인 충돌은 해소됐다. |
| 3 | 복잡도 | 낮다. |
| 4 | NFR 안티패턴 | 없다. |
| 5 | 마이그레이션/롤백 | SR-2.3 끝에 명시돼 있다. |
| 6 | 동시성 | 해당 없다. |

### 판정

REVISE. 이슈는 4건이다(실질 2 · 경미 2). 전부 스펙 문장 몇 줄 수정이고 설계나 사용자 결정은 바뀌지 않는다. 1라운드 6건은 모두 해소됐다.

2라운드 VERDICT: REVISE

---

## 1라운드 (원문 보존)

# Engineer Review — implementation (1라운드)

- 대상: `docs/specs/2026-10-08-tech-search-architecture/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`)
- 작업 트리: origin/main `06550592a`. 경로는 레포 루트 기준, `node_modules` 는 portal-fe 설치본(fencesvg 0.10.1 · marked 18.0.9 · react-router 7.14.0 · typescript 5.9).
- 표준: `docs/conventions/blog-diagram.md`, `docs/standards/doc-index-tracking.md`, `portal-fe/Dockerfile`·`.github/workflows/ci.yml` 주석(빌드 게이트 설명). 지식베이스: `[[markdown-diagram-publishing-path]]`·`[[fencesvg]]` (1989v 볼트, 2026-09-09).
- 사용자 결정 3건(새 경로 · 레포 원본 + 빌드 렌더 · 관광지 + 통합)은 재론하지 않는다.

## 인용 검증 (스펙이 가리킨 자리)

| 인용 | 결과 |
|---|---|
| `App.tsx:51-52, 226-233` | 맞다. `/tech/:category` 가 `:233`. |
| `prerender-seo.mjs:364-466, 675, 919, 1584-1616, 1676-1697` | 맞다. `escapeHtml :364` · `metaTags :372` · `compose :424` · `shellBody :464` · sitemap 포털 배열 `:675` · `emit :919` · `renderPortalPages :1584-1614`(본문 분기 `:1607`) · `portalLlmsTxt :1673-1698`(`/tech` 줄 `:1689`). 직접 실행 가드 `:148`. |
| `copy.mjs:893, 961-967` | `techCategoryFromSlug` 는 `:894`(한 줄 차이). `PORTAL_PAGES :961`, `/tech :967` 맞다. `portalTitle :302`·`portalUrl :298`·`ogCardUrl :221`·`breadcrumbJsonLd :269` 존재. |
| `copy.test.ts:165` | 맞다. 정확 배열 `toEqual`. |
| `markdown.ts:24-31` | 맞다. DOMPurify 경로라 Node 에서 못 쓴다는 판단도 맞다. |
| `Blog.css:1087-1170` | 맞다. breakout 규칙 `:1101-1106`, `.fs-source :1140-1170`. |
| `useHeritageSurface.ts:109-131` | 맞다. 시그니처 `useHeritageSurface(): void`(인자 없음), cleanup 이 dark 복귀. 참조 카운트라 라우트 전환에 안전. |
| `AttractionRankingProperties.kt:18-22` | 맞다. 3.0 / 0.35. 단, 같은 값이 `search/app/src/main/resources/application.yml:71-73` 에도 있다(아래 #4). |
| `HybridSearchPipelineInitializer.kt:55-67` | 맞다. `rank_constant: 60` 은 `:67`(Kotlin raw string 안). |
| `attractions-index.json` | synonyms `:12`, `user_dictionary_rules :39`(배열), `dimension 640 :446`, `cosinesimil :447`, `m 16 :452`, `ef_construction 128 :453`, encoder `sq` bits 1 `:455-457`. |
| `k8s/base/search/deployment.yaml:36-37` | **`:36-37` 은 `SEARCH_ATTRACTION_HYBRID_ENABLED`** 다. 드리프트 ③ 이 읽을 `SEARCH_EMBEDDING_MODEL_REF` 는 `:33-34`. |
| `.kh-table`·`.kh-section-head` | `k-heritage.css:483`, `:216` 존재. `.kh-table` 은 `<table class="kh-table">` 에만 붙는다(marked 출력엔 클래스가 없다 → #2). |
| `GNB` | `components/GNB.tsx:20-22` `pageLabel?: string`, 목록 prop 이름은 `items`(`ConceptAtlasPage.tsx:127` `<GNB pageLabel="IT" items={NAV} />`). |
| `useSeo` | `seo/useSeo.ts:32` `useSeo(input: SeoInput)`. 아틀라스는 `canonical: portalUrl(...)` 까지 넘긴다(`ConceptAtlasPage.tsx:67-71`). |
| `nginx.conf:153` | 맞다. `^/tech/([a-z][a-z-]*)$` → `prerender/tech/$1.html` 이라 `search` 가 그대로 걸린다. |
| `GatewayRouteConfig.kt:369-373` | 맞다(실제 경로 `gateway/src/main/kotlin/com/kgd/gateway/config/`). `/api/search/**` 에 authFilter 없음. |
| `placeApi.ts:404-523`, `searchApi.ts:79` | `:434`·`:468`(nearby)·`:523`(suggest), `:79` unified 맞다. |
| ADR-0103/0104/0105, `blog-diagram.md`, `scripts/search-eval/README.md`, `latency-budget.md:64-65` | 전부 존재. 74.6 / 354 ms 값 일치. |
| `atlas/useAtlasData.ts:12-13` | `import.meta.glob` 선례 맞다. 단 아틀라스 생성물은 `src/pages/atlas/generated/graph.json` 이지 `src/generated/` 가 아니다(SR-2.4 「같은 폴더」는 부정확). |

## 특별 확인 ①~⑦

- ② **fencesvg 는 Node 에서 돈다.** `node_modules/fencesvg/package.json:28-38` `type: module` + `exports.import: ./dist/index.js`. `dist/index.js` 의 팔레트 감지는 `qe(){if(typeof document>"u")return null;…}` 로 가드돼 DOM 이 없으면 `EDITORIAL` 로 떨어진다(`index.d.ts:93-96` 설명과 일치). `getComputedStyle`·`document.body` 참조는 전부 그 가드 뒤에만 있다. **marked 18 에는 `headerIds` 가 없다** — `marked.esm.js` 에서 `headerIds` 0건, `heading({tokens,depth})` 가 `<h${depth}>` 만 낸다(`:63`). 스펙 SR-2.1 「heading id 부여」는 renderer 오버라이드로만 가능하다(#2).
- ③ TS 5.9 는 `moduleResolution: bundler` 면 `resolveJsonModule` 이 기본 true 다(`typescript.js:22026-22040`) → 정적 JSON import 가 타입체크를 통과한다. **단 파일이 tsc 시점에 있어야 한다**(#1). 프리렌더(Node)는 `scripts/` 기준 `../src/generated/...` 를 `readFile` 로 읽으면 된다(`prerender-seo.mjs:98` `ROOT`).
- ④ **Docker 와 CI 는 `npm run build` 를 쓰지 않는다.** `portal-fe/Dockerfile:41` = `npx tsc -b --force && npx vite build --base / && node scripts/prerender-seo.mjs`, `ci.yml:289` = `npx tsc -b --force`, `:295` = `npx vitest run`. SR-2.4 의 `package.json` 한 줄은 이미지 빌드와 CI 에 닿지 않는다(#1).
- ⑤ 드리프트 테스트의 `../search/...` 읽기: CI `frontend-gate` 는 `actions/checkout` 전체 체크아웃(`ci.yml:240-245`, sparse 아님)이라 `node:fs` 로 읽힌다. vitest `include` 는 `src/**`·`tests/**`(`vitest.config.ts:13`) 라 `src/content/__tests__/` 위치는 맞다. `tsconfig.app.json include: src` 는 파일 읽기와 무관.
- ⑥ 위 표 참조. `.kh-table` 은 클래스 기반, `useHeritageSurface()` 는 인자 없음.
- ⑦ react-router 7.14.0 은 경로를 점수로 고른다 — 정적 세그먼트 10, 동적 3(`react-router/dist/production/chunk-HZQGQD2X.mjs:638-651`). `/tech/search` 는 선언 순서와 무관하게 `/tech/:category` 를 이긴다. SR-3.1 「앞에 둔다」는 무해하지만 근거는 순서가 아니라 랭킹이다(`requirements.md:10` 문구 정정).

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조 클래스/모듈 존재 | 거의 전부 존재. 다만 marked 에 「heading id」 기능이 없고(#2), `scripts/__tests__` 는 vitest 가 안 본다(#3). |
| 2 | 기존 코드와 충돌 없음 | **충돌 있음** — 생성물 gitignore(Q1) + 정적 import(SR-3.3) + `tsc -b` 선행(Dockerfile:41·ci.yml:289·SR-2.4 순서)이 동시에 성립하지 않는다(#1). 프리렌더 모듈 top-level 읽기면 기존 테스트가 깨진다(#5). |
| 3 | 복잡도 리스크 | 낮음. 빌드타임 스크립트 하나 + 정적 페이지. |
| 4 | NFR 안티패턴 | 없음. 런타임 외부 호출 0, 생성 HTML 은 lazy 청크 + 프리렌더에만 실린다. |
| 5 | 마이그레이션/롤백 | 스키마·설정 변경 없음. 롤백 = 커밋 되돌림. 렌더 실패 시 이미지 빌드가 서고 Argo 가 직전 이미지를 유지한다(`prerender-seo.mjs:140-142` 와 같은 모델). 스펙에 한 줄 명시하면 좋다. |
| 6 | 동시성 | 해당 없음(빌드타임). |

## Findings

### #1 (체크 2) 빌드 체인 — 생성 JSON 이 `tsc -b` 와 Docker·CI 에 없다 — 반드시 고친다
- 스펙: `open-questions.yml:6` Q1 「빌드마다 만든다(.gitignore)」, `spec.md:37` SR-3.3 「생성 JSON 을 `import`」, `spec.md:31` SR-2.4 `tsc -b && node scripts/render-content.mjs && vite build …`, `requirements.md:49` 「package.json build 1줄」.
- 코드: `portal-fe/Dockerfile:41` 과 `.github/workflows/ci.yml:289,295` 는 `npm run build` 가 아니라 `npx tsc -b --force` 를 직접 부른다. 생성물이 없는 체크아웃에서 `tsc -b` 는 정적 import 를 TS2307 로 거부하고, CI 의 `vitest run` 도 페이지·프리렌더 테스트(SR-6.1)가 같은 파일을 요구한다. SR-2.4 의 순서 자체도 `tsc -b` 가 렌더보다 앞이라 로컬 `npm run build` 조차 첫 실행에 실패한다.
- 수정안: ① SR-2.4 를 `node scripts/render-content.mjs && tsc -b && vite build && …` 로 바꾼다(렌더가 제일 앞). ② `Dockerfile:41` 을 `node scripts/render-content.mjs && npx tsc -b --force && npx vite build …` 로. ③ `ci.yml` Type check 앞에 `node scripts/render-content.mjs` 한 스텝(working-directory portal-fe). ④ `requirements.md:49` 최소 수정 목록에 Dockerfile 1줄·ci.yml 1스텝을 추가. 세 곳이 같은 명령을 쓰므로 스펙에 「렌더 스텝은 세 곳이 같은 순서로」를 한 줄 적는다. (대안인 `import.meta.glob` 은 파일이 없을 때 조용히 빈 객체가 되어 SR-2.3 「조용히 빈 페이지가 나가지 않게」와 어긋난다 — 권하지 않는다.)

### #2 (체크 1) marked 18 — heading id · `th scope` · `.kh-table` 은 renderer 오버라이드가 필요하다
- 스펙: `spec.md:28` SR-2.1 「`marked.parse`(gfm, heading id 부여)」, `spec.md:37` 「표는 `.kh-table`」, `spec.md:39` SR-3.5 「`<th scope="col">`」.
- 코드: `node_modules/marked/lib/marked.esm.js:63` `heading({tokens,depth})` → `<h${depth}>…` (id 없음, `headerIds` 옵션 0건). `:75` `tablecell` 은 `th`/`td` 에 `align` 만 붙인다. `table` 은 `<table>` 로 클래스 없음(`:69`).
- 수정안: SR-2.1 을 「`marked.use({ renderer: { heading, table, tablecell } })` 로 ① heading 에 `id`(자체 slug, `idPrefix` 적용, 중복 시 `-2`)와 `headings[]` 수집 ② `<table class="kh-table">` ③ 머리 셀 `<th scope="col">`」로 구체화한다. 선례: `markdownExtensions.ts` 의 `marked.use(blogMarkdown)`(`markdown.ts:22`). `renderContent.test.ts` 의 headings 검사는 이 renderer 가 낸 id 를 본다.

### #3 (체크 1·2) 렌더 테스트 위치·환경 — `scripts/__tests__` 는 vitest 가 안 돌리고, jsdom 은 빌드와 다른 경로를 잰다
- 스펙: `spec.md:53` SR-6.1 「`scripts/__tests__/renderContent.test.ts`」.
- 코드: `vitest.config.ts:13` `include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/…']` → `scripts/__tests__` 는 수집되지 않아 초록이 아니라 **0건**이 된다. `vitest.config.ts:7` `environment: 'jsdom'` 이라 fencesvg 가 테스트에서는 DOM 감지 경로(`Ge()`)를 타고, 빌드(Node)에서는 `EDITORIAL` 경로를 탄다 — 검사가 대상과 다른 산출물을 본다.
- 수정안: 테스트를 `src/content/__tests__/renderContent.test.ts` 로 두고 `../../../scripts/render-content.mjs` 를 import(선례 `prerenderPlace.test.ts:15`), 파일 머리에 `// @vitest-environment node`. 드리프트·프리렌더 테스트도 같은 주석을 단다(파일 읽기만이라 jsdom 이 필요 없다).

### #4 (체크 2) 드리프트 ② 는 Kotlin 기본값이 아니라 `application.yml` 을 읽어야 한다 + 인용 라인 정정
- 스펙: `spec.md:48` SR-5.1 ② 「`AttractionRankingProperties.kt`」, ③ 「`deployment.yaml` … (`:36-37`)」(`requirements.md:16`).
- 코드: `search/app/src/main/resources/application.yml:71-73` 이 `sight-weight: 3.0`·`commerce-weight: 0.35` 를 명시한다 → 실효값은 yml 이고 `AttractionRankingProperties.kt:18,20` 의 기본값은 yml 이 지워지기 전엔 죽은 값이다. yml 만 바꾸면 Kotlin 을 읽는 게이트는 초록인 채 문서가 틀린다. 모델 ref 는 `deployment.yaml:33-34`(`:36-37` 은 HYBRID_ENABLED).
- 수정안: ② 는 `application.yml` 의 두 값을 읽고(정규식 `sight-weight:\s*([\d.]+)`), Kotlin 기본값과 yml 이 다르면 그것도 실패로 본다(한 줄 추가). ③ 인용을 `:33-34` 로 고친다. 선택: `k8s/base/search-batch/cronjob-attraction-reindex.yaml:61` 의 같은 env 와도 대조(앱·배치 스탬프 불일치는 벡터 레그가 꺼지는 사고다 — `application.yml:80-81`).

### #5 (체크 2) 프리렌더가 생성 JSON 을 모듈 top-level 에서 읽으면 기존 테스트 5종이 깨진다
- 스펙: `spec.md:43` SR-4.2 「`renderPortalPages` 에 `/tech/search` 분기: 본문 = 생성 JSON 의 `html`」.
- 코드: `prerender-seo.mjs:146-148` 직접 실행 가드 덕에 `prerenderPlace.test.ts:4-15` 등이 모듈을 import 만 한다. 생성 JSON 을 import 문이나 top-level `readFileSync` 로 읽으면 파일이 없는 환경(#1 을 고치기 전 CI, 로컬 첫 실행)에서 import 자체가 터져 무관한 테스트까지 빨개진다.
- 수정안: `renderPortalPages` 안(또는 `/tech/search` 분기 전용 함수)에서 `readFile` 로 읽고, 없으면 `PartialSeoFailure` 로 빌드를 세운다(`:134-144` 의 기존 원칙). `prerenderTechSearch.test.ts` 는 JSON 을 인자로 주입할 수 있게 함수 시그니처에 넣는다.

### #6 (체크 1·2) 소소한 것 — 한 줄씩
- `<!-- source: … -->` 주석(SR-1.1)은 marked 가 raw HTML 로 통과시켜 생성 JSON → JS 청크에 실린다. `strip-html-comments.mjs:16,42` 는 `dist/*.html` 만 본다. `render-content.mjs` 가 출력 html 에서 주석을 지우거나 금지 패턴에 `<!--` 를 넣는다.
- SR-2.3 금지 패턴 `on[a-z]+=` 는 속성 경계가 없다. `[\s"']on[a-z]+=` 로 좁힌다(fencesvg 가 내는 `overflow-x:auto` 래퍼의 `style=` 는 `<style` 에 안 걸리니 그대로 둬도 된다).
- SR-3.2 `useSeo(PORTAL_PAGES['/tech/search'])` 에 `canonical: portalUrl('/tech/search')` 를 같이 넘긴다(`ConceptAtlasPage.tsx:67-71` 선례).
- SR-5.3 `manual_links` 의 `doc` 가 `portal-fe/…` 인데 `docs/doc-index.json:35-37` 은 `doc_roots: ["docs"]` 다. `doc_map.py` 가 `doc_roots` 밖 문서를 받는지 이 워크트리에선 확인 못 했다(`ai` 서브모듈 미초기화, 플러그인 캐시에도 없음) — 메인 체크아웃에서 lock 재생성 때 `missing` 으로 떨어지면 `doc_roots` 에 `portal-fe/src/content` 를 더한다.
- SR-2.4 「아틀라스 `generated/graph.json` 과 같은 폴더」는 틀리다 — 아틀라스는 `src/pages/atlas/generated/`. 「같은 이름 규칙(`generated/`)」로 고친다.
- 체크 5(롤백): 「렌더 실패 = 이미지 빌드 실패 = 직전 이미지 유지」를 SR-2.3 끝에 한 줄 적는다.

## 지식베이스 대조

- `[[markdown-diagram-publishing-path]]`(1989v 볼트, 2026-09-09): 발행 경로가 SVG 를 깎는 네 지점(sanitizer · lint · 서버 렌더 이스케이프 · CommonMark 빈 줄). 이 스펙은 sanitize 를 안 거치고(SR-3.3), 프리렌더 `compose` 가 body 를 그대로 끼우며(`prerender-seo.mjs:431`), 빈 줄은 SR-2.3 이 검사한다 → 네 지점 모두 비켜간다. 충돌 없음.
- `[[fencesvg]]`: 「열보다 넓은 그림은 85% 까지 줄고 그 아래는 `overflow-x:auto` 래퍼」·「`rect` 미지원」·「0.10 은 파이프 표기만」 — SR-1.3·SR-2.5·SR-3.4 와 일치.

## 판정

REVISE — 이슈 6건(#1 은 구현 전에 반드시 반영: 그대로 구현하면 Docker 이미지 빌드와 CI 가 첫 커밋부터 빨개진다). 사용자 결정 3건과 충돌하는 항목은 없다.

1라운드 VERDICT: REVISE

---

VERDICT: REVISE
