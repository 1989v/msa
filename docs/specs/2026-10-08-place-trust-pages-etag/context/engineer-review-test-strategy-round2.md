# Engineer Review — test-strategy (2라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` (워크트리 wt-impl, 1라운드 심판 반영 개정본)
기준: hns test-strategy 체크리스트, `docs/standards/test-rules.md`, 전역 CLAUDE.md 「검사는 대상의 산출물을 본다」·「회귀를 주입해 빨간불을 본 뒤에만 켰다」·「재기 전에 대상이 최신인지」.
1라운드 R1~R8 이 해소됐는지, 각 테스트가 대상의 산출물로 판정하는지, SR-5.4 회귀 주입이 각 게이트를 실제로 빨갛게 만드는지를 봤다.

## 1. 1라운드 지적 해소 여부

| # | 1라운드 지적 | 반영 위치 | 판정 |
|---|---|---|---|
| R1 | 바닥글 「최소안」 → 골든 + CI diff | SR-2.2 (`spec.md:22`) | 해소. 단 골든을 무엇에서 쓰는지가 모호하다 → N1 |
| R2 | 대장 정규화 규칙 | SR-1.4 ①②③ + 부정 단언 (`spec.md:17`) | 해소. 대장 §1(`data-sources.md:66-97`)을 규칙대로 펼쳐 보면 모든 행이 결정적으로 정해진다(`:75-77` 의 `〃 (행마다 …)` → 윗행 값, `:88` 메모 괄호 제거, `:96` 괄호는 메모가 아니라 유지) |
| R3 | ETag 가 본문에서 나온 값인지 | SR-4.3 「개요만 바뀐 문서」·「국문·영문 ETag 다름」, 해시 재계산 금지 (`spec.md:34`) | 해소. 픽스처 `doc(overview = …)`(`AttractionPageFixtures.kt:45`)로 바로 짤 수 있다 |
| R4 | 폴백·404 에 `If-None-Match` | SR-4.3 (`spec.md:34`) | 해소. 테스트는 있으나 회귀 주입 목록에 짝이 없다 → N3 |
| R5 | 배포 뒤 최신성 확인 | SR-5.5 (`spec.md:42`) | 해소. 판정 문자열(`href="https://1989v.com/data-sources"`, `<!--seo:prerendered-->` + `GeoNames`)이 이번 변경으로만 생기는 값이라 옛 이미지와 구분된다 |
| R6 | `curl -sI` → `--compressed` 유무 두 벌 GET | SR-4.4 (`spec.md:35`) | 해소 |
| R7 | 고정 시계(강등 MINOR) | SR-4.3 끝 「고정 시계(위생)」 | 해소. 서비스가 `clock` 생성자 인자를 이미 받는다(`AttractionPageService.kt:17`) |
| R8 | 프리렌더 본문 export 함수 + 공유 `.mjs` 상수 | SR-1.3 (`spec.md:16`), SR-3.1 (`spec.md:27`) | 해소. 이스케이프 단언은 대상이 없다 → N4 |
| 참고1~3 | 원천 열 대조·상설 부정 테스트·Footer/sitemap 단언 | SR-1.4(U5), SR-5.1 | 반영. 상설 부정 테스트의 범위가 좁다 → N2 |

## 2. 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | AC 마다 테스트 | 충족 — SR-1~4 각각 SR-5.1~5.3 에 대응 |
| 2 | 레이어 배정 | 적절 — ETag 사례는 MockMvc standalone(`AttractionPageControllerTest.kt:34`)이라 304 를 만드는 `HttpEntityMethodProcessor` 가 실제로 돈다 |
| 3 | 목 경계 | 적절 — 포트(색인·셸)만 대역(`AttractionPageControllerTest.kt:27-33`) |
| 4 | 테스트 데이터 | 충족 — 정규화 규칙·고정 시계·픽스처 명시 |
| 5 | 부정·경계 사례 | 부분 — N2·N3(부정 사례가 일부 축만 덮음), N4(이스케이프 입력 없음) |
| 6 | 네이밍 | 적절 — BehaviorSpec given/when/then(`test-rules.md`), 기존 파일 관례 |

## 3. 회귀 주입 목록 검산 (SR-5.4, `spec.md:41`)

| 주입 | 빨개지는 게이트 | 판정 |
|---|---|---|
| 상수에서 행 하나 제거 | SR-1.4 데이터 집합 비교 | 빨강 확실 |
| Kotlin 바닥글 링크 하나 제거 | Kotlin 골든 대조 (+ 렌더러 골든 HTML 9개) | 빨강 확실 |
| FE `TRUST_LINKS` 하나 제거 | CI 골든 diff — vitest 가 매번 무조건 골든을 다시 쓰는 선례(`attractionJsonLdGolden.test.ts:374`)와 `ci.yml:300→305` 순서로 성립 | 빨강. 단 골든을 상수에서 쓰면 배선을 증명하지 못한다 → N1 |
| `.eTag()` 제거 | 컨트롤러 「200 응답에 ETag」 | 빨강 확실 |
| ETag 를 문서 id 해시로 | 「개요만 바뀐 문서」, 「국문·영문 ETag 다름」 | 빨강 확실(두 사례가 같이 빨개진다) |

목록에 없는 게이트: 라이선스·원천 열 비교(N2), 폴백·404 에 ETag 미부착(N3), 프리렌더 표 행 수·이스케이프(N4), 런타임 Footer·sitemap(참고).

## 4. Findings

### N1 [체크 5] 바닥글 골든을 「상수」가 아니라 「프리렌더 함수 출력」에서만 쓰도록 못 박기
- 스펙: SR-2.2 (`spec.md:22`) 「vitest 가 `copy.mjs` 의 `TRUST_LINKS` 와 export 한 프리렌더 바닥글 함수 출력에서 href·라벨을 순서째 뽑아 … 골든을 쓴다」.
- 문제: 「상수와 함수 출력에서」라 읽으면 골든을 `TRUST_LINKS` 에서 바로 쓰는 구현도 스펙을 만족한다. 그러면 `siteFooter()`(`prerender-seo.mjs:471-474`, 지금은 `SITE_LINKS` 만 그림)가 `TRUST_LINKS` 를 그리지 않아도 골든·Kotlin 대조·CI diff 가 모두 초록이다. 크롤러가 보는 것은 상수가 아니라 `siteFooter()` 출력이다. 이 경우 주입 「FE `TRUST_LINKS` 하나 제거 → CI diff 빨강」도 배선과 무관하게 빨개져 증거가 되지 못한다.
- 수정안: SR-2.2 를 「골든은 export 한 `siteFooter()` 출력의 `<footer>` 안 `<a>` 를 순서째 뽑은 값으로만 쓴다(`SITE_LINKS` 6개 + `TRUST_LINKS` 4개 전부). `TRUST_LINKS` 는 그 함수의 입력일 뿐 골든의 근거가 아니다」로 고친다. Kotlin 쪽도 `<footer>` 전체 링크를 비교한다(`AttractionPageRenderer.kt:648-663` 이 같은 `<footer><nav>` 하나에 그린다). 회귀 주입에 「`siteFooter()` 가 `TRUST_LINKS` 를 빼고 그림 → CI 골든 diff 빨강」을 한 줄 더한다.

### N2 [체크 5] 상설 부정 테스트와 주입이 「데이터 집합」 축만 덮는다
- 스펙: SR-1.4 (`spec.md:17`) 상설 부정 테스트는 「대장 텍스트에 행을 하나 더한 문자열」 하나, SR-5.4 주입은 「상수에서 행 하나 제거」 하나다.
- 문제: 둘 다 데이터 집합 비교만 빨갛게 만든다. `compare` 가 원천·라이선스를 비교하지 않거나, `〃` 를 「아무 값이나 일치」로 다뤄도 두 검사는 초록이다. 대장에서 `〃` 행이 9개(`data-sources.md:69-77`)라 이 경로가 라이선스 열의 3분의 1이다. 결정 ③(어긋나면 실패)과 U5(원천 열 대조)는 지금 증명 수단이 없다.
- 수정안: 상설 부정 테스트를 `compare` 에 넣는 세 가지로 늘린다. ① 행 추가(현행) ② 상수 한 행의 라이선스를 바꾼 rows — `〃` 로 펼쳐지는 행(예: 「관광지 개요」)을 고른다 ③ 상수 한 행의 원천을 바꾼 rows. 셋 다 실패해야 한다. 이것이 상설이면 SR-5.4 에 따로 주입할 필요가 없다.

### N3 [체크 5] 「폴백·404 에 ETag 없음」 테스트를 빨갛게 만드는 주입이 없다
- 스펙: SR-4.1 (`spec.md:32`) 「분기 기준은 상태 코드가 아니라 `is Page.Found`(Fallback 도 200, `:39`)」, SR-4.3 폴백·404 사례.
- 문제: 1라운드에서 막으려던 실제 실수는 「200 이면 ETag」로 짜서 폴백(`AttractionPageController.kt:39`, 200)에 ETag 가 붙는 것이다. SR-5.4 의 다섯 주입은 이 경로를 건드리지 않는다. 그래서 폴백 사례가 그 실수를 실제로 잡는지 확인되지 않는다. 예를 들어 폴백 사례가 `If-None-Match` 없이 부르면 ETag 가 붙어도 200·셸 본문이라 「ETag 없음」 한 단언에만 기댄다.
- 수정안: SR-5.4 에 「ETag 부착 기준을 `status == 200` 으로 바꿈 → 폴백 사례 빨강」을 더한다. 폴백 사례는 정상 응답에서 읽은 ETag 를 `If-None-Match` 로 실어 「200·셸 본문·ETag 없음」을 함께 보는 모양(현 스펙 문구 그대로)으로 짠다.

### N4 [체크 5] 「셀 이스케이프」 단언을 걸 입력이 없다
- 스펙: SR-5.1 (`spec.md:38`) 「`renderDataSourcesHtml` 출력(… 셀 이스케이프)」, 서명은 `renderDataSourcesHtml(shell)`(`spec.md:27`)이라 상수를 직접 읽는다.
- 문제: 대장 §1 표(`data-sources.md:66-97`)에는 `&`·`<`·`>`·`"` 가 하나도 없다. 상수에 이스케이프할 문자가 없으면 「셀이 이스케이프됐다」는 단언은 `escapeHtml` 을 지워도 초록이다.
- 수정안: 행을 인자로 받게 한다 — `renderDataSourcesHtml(shell, rows = DATA_SOURCES)`. 테스트는 `<b>&"` 가 든 행을 넘겨 출력에 `&lt;b&gt;&amp;&quot;` 가 있고 원문 `<b>` 가 없음을 본다. 「표 행 수 == 상수 행 수」는 기본 인자(실제 상수)로 본다. 회귀 주입에 「표 셀에서 `escapeHtml` 제거 → 빨강」을 더한다.

## 5. 참고 (판정에 넣지 않음)
- 새 골든 파일은 `git diff --exit-code` 가 미추적 상태를 못 잡는다. 선례 `ci.yml:100-101` 처럼 `test -z "$(git status --porcelain -- …/footer-links-golden.json)"` 를 함께 두면 확실하다. 다만 파일이 없으면 Kotlin 대조가 실패하므로 실제 구멍은 작다.
- SR-5.1 「About 절 제목 넷」과 「런타임 Footer 국문·영문 링크 넷」의 기대값을 어디서 가져올지 적혀 있지 않다. About 은 SR-3.2 상수의 `heading` 에서 꺼내고, Footer 국문 href·순서는 `TRUST_LINKS` 에서 꺼내면 리터럴 사본이 생기지 않는다.
- 런타임 Footer·sitemap·llms 단언은 SR-5.4 주입 짝이 없다. 실수 비용이 낮아 비차단이다.

이슈 4건(REVISE), 차단 없음. N1~N4 는 모두 스펙 문장 한두 줄 수정으로 닫힌다.

VERDICT: REVISE
