# 스펙 리뷰 — test-strategy

## 2라운드 (2026-10-08)

대상: 개정 `spec.md`(SR-5·SR-6), `planning/test-quality.md` 「1라운드 심판 반영」 절. 심판 `context/review-verdict-round1.md` 결정(G1 `import.meta.glob` 기각 등)은 재론하지 않는다. 새 발견은 「게이트가 자기 근거를 만든다」·「AC 가 어느 수준에도 없다」 둘에 해당할 때만 적었다.

**판정: REVISE** (비차단). 1라운드 F1~F8 은 전부 해소. 남은 것은 회귀 주입 ⑨가 적힌 방식으로는 짤 수 없다는 것, 프리렌더 테스트 입력의 출처, clickBoost 의 env 덮어쓰기 경로 셋이다.

### 1라운드 항목별 해소

| # | 상태 | 근거 |
|---|---|---|
| F1 warnings 를 삼키는 경로 | 해소 | SR-2.1 펜스마다 `renderDiagram`, SR-2.3 ①② `warnings`·`svg === null`·svg 수 ≠ 펜스 수 → exit 1. `rect` 는 실제로 파싱 오류다 — `node_modules/fencesvg/dist/index.js:7` `Gn=/^(rect)\b/`, `:8` `if(Gn.test(l))return{error:"… 블록은 아직 지원하지 않는다"}`. caption 누락은 warnings 1건(`context/probe-2026-10-08.md:5`). 주입 ①②는 목이 아닌 실제 fencesvg 로 빨개진다 |
| F2 생성물 없는 CI | 해소 | SR-2.4 세 곳에 render → `tsc -b` 순서, ci.yml Type check 앞. 잔여: 생성물 없는 새 워크트리에서 `compile-changed.sh` 의 `tsc -b` 가 커밋을 막는다 — G1 결정 범위 안이라 기록만 한다(`npm run dev`/build 한 번이면 풀린다) |
| F3 파서 | 해소(잔여 R3) | SR-1.5 행당 값 하나·백틱 토큰, SR-5.1 `toBeDefined` 뒤 `toBe`, 가중치 `application.yml`, 모델 ref 두 매니페스트, JSON 은 `JSON.parse`, Kotlin 은 키 앵커 |
| F4 프리렌더 순수 함수 | 해소(잔여 R2) | SR-4.2 `renderTechSearchHtml` export, `PORTAL_PAGES` 를 함수 안에서 읽음, JSON 은 `main()`, 실패는 `PartialSeoFailure` |
| F5 스위치 값 | 해소 | 9값에 하이브리드·clickBoost·fusion·동의어 포함, SR-1.6·SR-5.3 문구도 9값 |
| F6 include·환경 | 해소 | `src/content/__tests__/` + `@vitest-environment node` (`vitest.config.ts:13` include 안) |
| F7 AC 무테스트 | 해소 | 금칙 패턴(SR-2.3 ⑦)·`<th scope="col"`·`aria-label="목차"`·`rect` 실제 펜스가 SR-4.4·SR-6.1 에 있다. 노드 12개 이하는 게이트 밖이지만 1라운드에서 선택으로 둔 것 |
| F8 배포 뒤 최신성·4조합 | 해소 | SR-6.4 `data-source-hash` 대조 후 측정, 기기×사이트 4 × 뷰포트 2, 390 touch 에뮬레이션, 그림별 비율 |

### 회귀 주입 11건 — 무엇이 빨개지나

| 주입 | 빨개지는 것 | 성립 |
|---|---|---|
| ① sequence `rect` 1줄 | `renderContent` 가 `svg === null`·error → exit 1, `renderContent.test` | 성립(fencesvg `index.js:8`) |
| ② 5펜스 중 1개 깨기 | 같은 경로 + svg 수 ≠ 펜스 수 | 성립 |
| ③ `sight-weight` 변경 | 드리프트 ②(`application.yml:72` 리터럴) | 성립 |
| ④ HYBRID `"true"`→`"false"` | 드리프트 ⑦(`deployment.yaml:36-37`) | 성립 |
| ⑤ 모델 ref 해시 변경 | 드리프트 ③(md == deployment == cronjob 셋 일치) | 성립 |
| ⑥ md 값 하나 변경 | 드리프트 `toBe` | 성립 |
| ⑦ md 행 키 이름 변경 | `toBeDefined` 「행을 못 찾음」 | 성립 |
| ⑧ `PORTAL_PAGES` 항목 제거 | `copy.test.ts:165` 정확 배열 + 페이지 `tsc`(strict 인덱싱) + 프리렌더 | 대체로 성립. 프리렌더 쪽은 구현이 `PORTAL_PAGES[path].title` 처럼 바로 읽을 때만 던진다(선례 `prerender-seo.mjs:1589`). SR-4.4 단언에 `<title>` 이 없어 `?.` 로 짜면 프리렌더 테스트는 초록 → R2 에 한 줄 |
| ⑨ 라우트 제거 | `routes.test.tsx` | **적힌 방식으로는 짤 수 없다** → R1 |
| ⑩ 생성 JSON 지운 채 `tsc -b` | TS2307 | 성립. `tsconfig.app.json:13` `moduleResolution: bundler` 면 `resolveJsonModule` 이 기본 켜진다(`typescript/lib/typescript.js:22040`) — tsconfig 변경 불요 |
| ⑪ Dockerfile 렌더 단계 재현 | `node scripts/render-content.mjs` exit 1 | 성립하나 ①과 같은 명령이라 Dockerfile 배선은 재지 않는다. 배선은 ⑩이 대신 문다(Dockerfile 에서 render 줄이 빠지면 뒤의 `tsc -b` 가 TS2307). 문구만 「①과 같은 스크립트 — 배선은 ⑩이 문다」로 |

### 9값 파서 — 자기 근거 여부

자기 근거가 아니다. 기대값은 md §4(대상 문서)에서, 실제값은 코드·매니페스트(대상 코드)에서 각각 읽고, 테스트가 정하는 것은 행 키 이름뿐이다. 키가 어긋나면 `toBeDefined` 가 막으므로 「양쪽 undefined 초록」(1라운드 F3)도 닫혔다. 예외 하나가 R3 이다.

### 새 발견

**R1 (중간) — `routes.test.tsx` 는 MemoryRouter 로 App 을 감쌀 수 없다.** `portal-fe/src/App.tsx:198-200` 의 `App` 이 스스로 `<BrowserRouter>` 를 연다. MemoryRouter 안에 넣으면 react-router 가 「Router 안에 Router」로 던지고, App 밖에 라우트 테이블을 따로 만들면 테스트가 대상이 아닌 사본을 잰다. SR-3.1 은 App 변경을 lazy import·Route 두 줄로 묶어 두었으니 추출 리팩터도 범위 밖이다.
수정안: SR-6.1 을 「`window.history.pushState({}, '', '/tech/search')` 뒤 `render(<App />)`, lazy 라 `findByRole('heading', { level: 1 })` 로 이 페이지 h1 이고 용어집(`/tech/:category`, `App.tsx:233`)이 아님」으로 바꾼다. jsdom 호스트는 `localhost` 라 apex 개발 분기를 탄다.

**R2 (중간) — 프리렌더 테스트가 넘길 `generated` 의 출처가 없다.** SR-4.4 는 단언만 적고 입력을 정하지 않았다. 테스트가 손으로 만든 JSON 을 넘기면 `role="img"` 수 == 펜스 수를 **테스트가 만든 HTML** 로 재게 된다. 이것은 자기 근거다. 생성 파일을 읽게 하면 로컬에서 낡은 산출물을 잴 수 있다.
수정안: SR-4.4 에 「입력은 `renderContent(readFileSync(실제 md), …)` 반환값 — 같은 함수, 실제 md」 한 줄을 넣는다. 「없이 호출하면 throw」 케이스만 `undefined`·`{ html: '' }` 를 넘긴다. 주입 ⑧ 이 프리렌더에서도 물리도록 단언에 `<title>` 이 `검색 아키텍처` 를 포함함을 더한다.

**R3 (낮음) — clickBoost 는 env 로 덮이는데 게이트는 기본값만 읽는다.** `application.yml:78` 은 `${SEARCH_ATTRACTION_CLICK_BOOST_ENABLED:false}` 다. SR-5.1 ⑧ 「`application.yml` 기본값, k8s env 부재면 그 값」은 env 가 **있을 때** 무엇을 읽는지 적지 않았다. `deployment.yaml` env 에 `"true"` 한 줄을 더하면 운영은 켜지고 게이트는 초록이다. SR-1.5 상태 열 규칙(env 우선)과도 어긋난다. 「9값이 바뀌면 CI 빨강」 AC 의 이 경로는 어느 수준에도 테스트가 없다.
수정안: ⑧ 을 「`deployment.yaml` 에 `SEARCH_ATTRACTION_CLICK_BOOST_ENABLED` 가 있으면 그 값, 없으면 yml 기본값」으로 고친다. 회귀 주입에 「deployment.yaml 에 env `"true"` 추가 → 빨강」 1건을 더한다. 하이브리드 ⑦ 은 env 가 이미 있어 같은 규칙으로 읽으면 된다.

VERDICT: REVISE

---

## 1라운드 (2026-10-08)

대상: `docs/specs/2026-10-08-tech-search-architecture/spec.md` (SR-1~SR-6), `planning/test-quality.md`, `planning/requirements.md`, `context/open-questions.yml`.
기준: `docs/standards/test-rules.md`, `docs/conventions/testing.md`(둘 다 Kotlin 전용 — portal-fe 는 선례 `src/seo/__tests__/*.test.ts` 가 표준), 루트 CLAUDE.md 「검사는 대상의 산출물을 본다」·「회귀를 주입해 빨간불을 본 뒤에만」·「grep·스크립트로 참/거짓이 나오는 규칙은 게이트로」, `docs/standards/fe-visual-verification.md`.
지식베이스: `[[gate-failure-modes]]` (vault, 2026-09-11) ④ 기대값이 대상과 같은 곳에서 온다 · ⑥ 검사가 0회 돈다 · ⑨ 게이트가 「실패」가 아니라 「아무 일도 안 함」으로 끝난다, `[[frontend-visual-verification]]` (vault, 2026-09-10) ② 재는 대상이 최신인지. 레포 문서와 충돌 없음.

사용자 결정 3건(새 경로 · 레포 문서 원본 + 빌드 렌더 · 관광지 + 통합)과 Q1~Q3 은 재론하지 않는다. 아래 수정안은 전부 그 결정 안에서 성립한다.

## 판정 요약

**REVISE** — 차단 아님. 8건. 그중 F1·F2 는 지금 스펙대로 구현하면 **게이트가 안 물거나 CI 가 상시 빨강**이 되는 것이라 구현 전에 반드시 고친다. 나머지는 게이트의 「무는 범위」와 「검증 대상이 최신인지」를 좁히는 것이다.

| # | 체크리스트 | 판정 | 근거 |
|---|---|---|---|
| 1 | AC 마다 테스트가 있는가 | 부분 | SR-1.7(공개 문서 금칙) · SR-3.5(접근성 마크업) · SR-1.3 「rect 금지」 에 대응 테스트 없음 → F7 |
| 2 | 테스트 계층 배정 | 통과 | 단위(렌더·드리프트·프리렌더) / 컴포넌트(페이지) / e2e(배포 뒤) — 적절. 단 환경(jsdom) 이 빌드 경로와 다름 → F6 |
| 3 | 목 경계 | 부분 | 「warnings 주입」은 fencesvg 를 목으로 바꾼다는 뜻인데 실제 경로가 warnings 를 안 돌려준다 → F1. 프리렌더는 부를 순수 함수가 없다 → F4 |
| 4 | 테스트 데이터 전략 | 통과 | 드리프트는 실제 md·실제 코드 파일, 프리렌더는 `SHELL` 선례(`prerenderPlace.test.ts:17-22`), 렌더는 인라인 md 픽스처 |
| 5 | 부정·경계 케이스 | 부분 | 파서 누락(양쪽 undefined) · 다섯 중 하나만 깨진 펜스 · 프리렌더 분기 예외 가 빠짐 → F1·F3·F4 |
| 6 | 명명 규약 | 통과 | `__tests__/*.test.ts(x)` + 한글 문장 `it()` 선례(`prerenderPlace.test.ts:43`) 와 일치 |

---

## F1 (높음) — `inlineDiagrams` 는 warnings 를 돌려주지 않는다. SR-2.3 의 첫 실패 조건이 닿지 않는 경로다

**스펙**: SR-2.1 「fencesvg `inlineDiagrams` → `marked.parse`」, SR-2.3 「fencesvg `warnings` 1건 이상 → 종료 코드 1」, SR-6.3 「펜스 한 줄 깨뜨리기 → 종료 코드 1」, `planning/test-quality.md:5` 「warnings 1건 주입 → throw」.

**코드**:
- `portal-fe/node_modules/fencesvg/dist/index.d.ts:11` — `declare function inlineDiagrams(markdown: string, opts?: Options): string;` 반환이 문자열뿐이다. warnings 는 `renderDiagram`(`:10`, `Result = { svg, caption, warnings }`) 만 돌려준다.
- `portal-fe/node_modules/fencesvg/README.md:69-71` — "`renderDiagram` never throws. On unreadable syntax it returns `svg: null` … and `inlineDiagrams` leaves that fence as a code block". `:339-340` 같은 내용.

**결과**: 스펙대로 짜면 깨진 펜스는 조용히 `<pre><code>` 로 남고, 남는 방어는 SR-2.3 의 「SVG 가 0개」뿐이다. 다이어그램이 5장이라 **하나가 깨져도 4장이 남아 초록**이다. SR-6.3 의 회귀 주입 ①이 빨간불을 못 낸다 → 「켰다」고 말할 수 없는 게이트가 된다(CLAUDE.md 「회귀를 주입해 빨간불을 본 뒤에만」). SR-4.4·SR-6.4 의 `role="img"` **≥ 4** 도 같은 구멍이다.

**수정안**:
1. SR-2.1 을 「`render-content.mjs` 가 mermaid 펜스를 직접 찾아(fencesvg 와 같은 펜스 규칙) 펜스마다 `renderDiagram` 을 부르고, `warnings.length > 0` 또는 `svg === null` 이면 즉시 실패. SVG 를 본문에 끼운 뒤 `marked.parse`」로 바꾼다. 「warnings 주입」은 목이 아니라 **실제 깨진 펜스**(README:332 `rect` 블록, `:318` caption 누락, 존재하지 않는 노드로 가는 간선)로 낸다 — 목으로 넣으면 스크립트의 분기만 재고 fencesvg 는 안 잰다.
2. 두 번째 게이트로 **대상에서 읽은 개수**를 쓴다: `fenceCount(md) === svgCount(html)`. SR-4.4·SR-6.2·SR-6.4 의 `≥ 4` 를 전부 `=== fenceCount`(지금은 5) 로 바꾼다.
3. `planning/test-quality.md:5` 의 「warnings 1건 주입 → throw」를 「rect 펜스 1개 → throw(실제 fencesvg)」로.

## F2 (높음) — 생성 JSON 이 `.gitignore` 인데 CI 의 `tsc -b`·vitest 는 빌드 없이 돈다. 머지 즉시 frontend-gate 가 빨개진다

**스펙**: SR-2.4 「`src/generated/search-architecture.json` 은 `.gitignore`」, SR-3.3 「생성 JSON 을 `import`」, SR-4.2 「프리렌더가 생성 JSON 을 읽는다」, SR-6.1 「vitest … `tsc -b`」.

**코드**:
- `.github/workflows/ci.yml:276-295` — frontend-gate 는 `npm ci` → `npx tsc -b --force` → `npx vitest run`. `node scripts/render-content.mjs` 나 `npm run build` 단계가 없다.
- `portal-fe/tsconfig.app.json:30` — `"include": ["src"]`. 페이지가 `src/generated/search-architecture.json` 을 정적 import 하면 파일이 없을 때 TS2307 로 `tsc -b` 가 실패한다.
- `.claude/hooks/hns/compile-changed.sh:22,26` — portal-fe `.ts/.tsx` 가 바뀐 커밋마다 `npx tsc -b` 를 돈다. 생성물이 없는 워크트리(새 클론·`git clean`)에서는 **커밋 자체가 막힌다**.
- `portal-fe/scripts/prerender-seo.mjs:148` — 직접 실행 가드가 있어 import 는 안전하지만, `/tech/search` 분기를 위해 JSON 을 **모듈 최상위**에서 읽으면 `prerenderPlace.test.ts:4-15` 등 기존 프리렌더 테스트까지 import 단계에서 죽는다.

**결과**: 생성물 없는 체크아웃에서 타입체크·테스트·커밋 훅이 전부 실패한다. 드리프트 게이트가 아무리 잘 짜여도 CI 가 다른 이유로 늘 빨가면 그 신호는 묻힌다(`[[gate-failure-modes]]` ⑨).

**수정안**(Q1 을 되돌리지 않는다 — 「커밋하지 않는다」는 유지하고 「쓰기 전에 만든다」를 더한다):
1. `vitest.config.ts` 에 `globalSetup` 으로 `render-content.mjs` 의 `renderContent` 를 실제 md 에 돌려 JSON 을 쓴다. 드리프트·프리렌더·페이지 테스트가 **같은 산출물**을 본다는 부수 효과도 있다.
2. `ci.yml` frontend-gate 의 Type check 앞에 `node scripts/render-content.mjs` 한 단계. Dockerfile 은 `package.json` build 체인(SR-2.4)이 이미 덮는다.
3. `compile-changed.sh` 가 도는 로컬에서도 같은 문제라, 가장 단순한 길은 페이지의 import 를 `useAtlasData.ts:12` 선례처럼 `import.meta.glob('../../generated/search-architecture.json')` 로 바꿔 **tsc 가 파일 존재를 요구하지 않게** 하는 것이다. 그러면 1·2 는 vitest 만을 위한 것이 된다. 둘 중 하나는 스펙에 적어야 한다.
4. 프리렌더는 JSON 을 최상위가 아니라 `renderPortalPages` 안(또는 F4 의 순수 함수 인자)에서 읽는다.

## F3 (중간) — 드리프트 파서: 양쪽이 같이 비면 초록, 한 셀에 값 넷, 유효 값이 아닌 기본값을 읽는다

**스펙**: SR-5.1 「md §4 표를 파싱해 … `toBe` 대조」, SR-5.2 「`현재 값` 열의 첫 숫자/문자열」, SR-1.5 행 정의.

**코드·문서 근거**:
- `[[gate-failure-modes]]` ④·⑥: 두 파서 중 하나가 패턴을 못 찾아 `undefined` 를 내면 `expect(undefined).toBe(undefined)` 가 **통과**한다. 스펙은 「파일이 없으면 실패」(SR-5.1)만 적고 「패턴을 못 찾으면 실패」는 안 적었다.
- SR-1.5 의 행 「임베딩 모델(harrier-oss-v1-270m, 640차원, fp32, sq 인코더, hnsw m16 ef_c128)」 — SR-5.1 ④ 는 여기서 `dimension`·`m`·`ef_construction` **셋**을 읽어야 하는데 SR-5.2 규칙은 「첫 숫자」 하나다. 첫 숫자는 `harrier-oss-v1-270m` 의 `1` 또는 `270` 이다. 「분류 가중치 3.0/0.35」도 첫 숫자만 읽으면 `0.35` 를 못 본다.
- 모델 ref: SR-1.5 는 `harrier-oss-v1-270m`, 코드는 `k8s/base/search/deployment.yaml:34` `microsoft/harrier-oss-v1-270m@31de22b#d640`. `toBe` 는 정확 일치라 어느 문자열을 문서에 적을지 스펙이 정해야 한다(권장: 전체 문자열 — `@31de22b` 재고정이 바로 드리프트다).
- 가중치의 **유효 값**은 데이터 클래스 기본값(`AttractionRankingProperties.kt:18,20`)이 아니라 `search/app/src/main/resources/application.yml:71-73` 의 `sight-weight: 3.0 / commerce-weight: 0.35` 다. yml 만 2.5 로 바꾸면 운영은 바뀌고 게이트는 초록이다.
- 모델 ref 는 두 곳이다 — `deployment.yaml:34` 와 `k8s/base/search-batch/cronjob-attraction-reindex.yaml:62`(`:60` 「한 글자도 달라선 안 된다」). 한 곳만 읽으면 반만 올린 커밋을 못 잡는다.

**수정안**:
1. **게이트 값 하나당 표 한 행**, `현재 값` 셀은 백틱 토큰 하나(`` `60` `` · `` `3.0` `` · `` `0.35` `` · `` `microsoft/harrier-oss-v1-270m@31de22b#d640` `` · `` `640` `` · `` `16` `` · `` `128` `` · `` `N줄` ``). 설명은 `항목` 열이나 별도 열에. 테스트 머리의 파서 규칙은 「`항목` 고정 키 → `현재 값` 첫 백틱 안」으로 단순해진다.
2. 양쪽 파서 모두 **값을 꺼낸 직후 존재·타입 단언**(`expect(v, `${key} 파서 누락`).toBeDefined()`, 숫자면 `typeof === 'number'`). 그 뒤에 `toBe`.
3. 코드 쪽은 느슨한 regex 대신 구조 파서: `attractions-index.json` 은 `JSON.parse` 로 `mappings.properties.embedding.dimension / method.parameters.m / ef_construction`(`:446,452,453`)·`settings.analysis.tokenizer.nori_user.user_dictionary_rules.length`(`:39`); yaml 은 `SEARCH_EMBEDDING_MODEL_REF` 다음 줄 `value:` 에 앵커한 regex 또는 yaml 파서; Kotlin 은 `"rank_constant":\s*(\d+)` (`HybridSearchPipelineInitializer.kt:67`) 처럼 **키 이름에 앵커**.
4. 가중치는 `application.yml:72-73` 을 원본으로(또는 yml 과 클래스 기본값 둘 다 읽어 셋이 같아야 통과). 모델 ref 는 두 yaml 을 둘 다 읽어 문서 값과 셋이 같아야 통과.
5. 회귀 주입에 **md 쪽 둘**을 더한다: 값 하나 바꾸기 → 빨강, 행 키 이름 바꾸기(파서 누락) → 빨강. 지금 SR-6.3 은 코드 쪽 1건뿐이다.

## F4 (중간) — 프리렌더 테스트가 부를 함수가 없고, 프리렌더 분기 실패는 exit 0 이다

**스펙**: SR-4.2 「`renderPortalPages` 에 `/tech/search` 분기」, SR-4.4 「프리렌더 테스트 … 출력에 `<h1`·`<table`·…」, requirements.md:58 「조용히 빈 페이지가 나가지 않는다」.

**코드**:
- `portal-fe/scripts/prerender-seo.mjs:1584` `async function renderPortalPages(shell, concepts = [])` — **export 가 아니다**(export 목록 `:123,795,814,823,859,982,1001,1007,1017,1140,1192,1252,1294,1301,1424` 에 없음). 안에서 전 포털 페이지를 돌며 `emit`(`:1612`) 으로 파일을 쓴다. 테스트가 그대로 부를 수 없고, 억지로 부르면 파일 I/O 를 목으로 가려야 한다. 그러면 테스트가 HTML 을 **스스로 조립**해 비교하게 되기 쉽다 — 자기 근거.
- `prerender-seo.mjs:148-156` — `main()` 의 일반 예외는 `console.warn` + `process.exit(0)`(「SPA 만 배포됩니다」). `PartialSeoFailure` 만 exit 1. `/tech/search` 분기가 JSON 누락·형식 오류로 던지면 **포털 프리렌더 전체가 사라진 채 빌드가 통과**한다. `Dockerfile:41` 도 같은 명령이라 이미지까지 간다.

**수정안**:
1. 순수 함수 `renderTechSearchHtml(shell, generated, meta) → html` 을 export 하고(선례 `renderRegionDetail` `:1140`, `placeDetailPages` `:1192` 가 `{path, html}` 를 돌려준다) `renderPortalPages` 가 그것을 부른다. 테스트는 globalSetup 이 만든 **실제 생성 JSON** 을 넘겨 같은 함수를 부른다. SR-4.4 의 단언은 그 반환값에 건다.
2. `/tech/search` 분기의 실패(JSON 없음·`html` 빈 문자열·SVG 개수 ≠ fenceCount)는 `PartialSeoFailure` 로 던진다 — 그래야 `:150-152` 경로로 exit 1 이 난다. 스펙 SR-4.2 에 한 줄.
3. 회귀 주입 ③ 「`PORTAL_PAGES` 항목 제거 → 프리렌더 테스트 빨강」은 순수 함수가 `PORTAL_PAGES['/tech/search']` 를 **안에서** 읽을 때만 성립한다. 인자로 받게 설계하면 copy.test 만 빨개진다 — 어느 쪽인지 적는다.

## F5 (중간) — 다섯 값에 켜짐/꺼짐 스위치가 없다. 그림을 거짓으로 만드는 값은 상수가 아니라 플래그다

**스펙**: SR-5.1 ①~⑤(RRF 상수·가중치·모델 ref·knn 파라미터·사전 줄 수).

**코드**:
- `k8s/base/search/deployment.yaml:36-37` `SEARCH_ATTRACTION_HYBRID_ENABLED: "true"`, 기본값은 `application.yml:86` `false`. 이 한 줄을 끄면 §2-① 「BM25 ∥ 벡터 → RRF」 시퀀스와 표의 하이브리드·RRF·임베딩·캐시 행이 전부 과거형이 되는데, 게이트 다섯은 전부 초록이다.
- `application.yml:78` `click-boost.enabled: ${SEARCH_ATTRACTION_CLICK_BOOST_ENABLED:false}` — 표 행 「clickBoost(꺼짐)」의 근거. 켜도 게이트는 모른다.
- `application.yml:88` `fusion: rrf` — `HybridSearchPipelineInitializer.kt:34-37` 은 `fusion != rrf` 면 파이프라인을 만들지 않는다. 즉 `rank_constant 60` 이 **유효한지**를 이 값이 정한다.
- 같은 파일에서 공짜로 읽히는 것: 동의어 수(`attractions-index.json:12`, 사전과 같은 JSON), 평가 허용폭 `0.03`(`k8s/base/search-batch/cronjob-eval.yaml:53`, 표 행 「−0.03 실패」), 자동완성 가중치 6/1/0.3(`AttractionSearchAdapter.kt:469,463,477`, 표 행 ②), 오타 `maxEdits(2)`(`:430`).

**수정안**: 최소 4개를 더해 9개 — 하이브리드 enabled(deployment.yaml) · clickBoost enabled(application.yml) · fusion(application.yml) · 동의어 수(index.json). 이미 여는 파일 셋에서 나오므로 파서 추가 비용이 0 에 가깝다. 자동완성 가중치·maxEdits·평가 허용폭은 표에 적는 값이니 같이 묶는 것을 권하되 선택. SR-1.6 「게이트가 잡는 값 N개」와 CLAUDE.md 한 줄의 「5값」도 같이 고친다.

## F6 (중간) — `scripts/__tests__/` 는 vitest include 밖이고, jsdom 환경은 빌드 경로와 다르다

**스펙**: SR-6.1 「`scripts/__tests__/renderContent.test.ts`」, test-quality.md:5 「unit (vitest, Node)」.

**코드**:
- `portal-fe/vitest.config.ts:13` `include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}']` — `scripts/__tests__` 는 **한 번도 안 돈다**(`[[gate-failure-modes]]` ⑥). 선례 `src/seo/__tests__/prerenderPlace.test.ts:15` 는 `src` 안에서 `../../../scripts/prerender-seo.mjs` 를 import 한다.
- `vitest.config.ts:7` `environment: 'jsdom'`. fencesvg 는 `typeof document` 로 DOM 유무를 가른다(`dist/index.js:8` `qe()` — `typeof document>"u"` 면 null → `EDITORIAL`). jsdom 아래서는 `detectTheme` 가 jsdom 의 계산값을 읽는 **다른 경로**를 타고, 빌드(`node scripts/render-content.mjs`)는 DOM 없는 경로를 탄다. 테스트가 빌드와 다른 렌더러 상태를 재게 된다.

**수정안**: 파일을 `src/content/__tests__/renderContent.test.ts` 로(드리프트 테스트 옆), 머리에 `// @vitest-environment node`. 드리프트·프리렌더 테스트도 같은 지시자(둘 다 DOM 이 필요 없고 fs 만 읽는다).

## F7 (낮음) — AC 에 대응 테스트가 없는 셋

- **SR-1.7 공개 문서 금칙**(회사·개인 식별 정보, 키, 내부 호스트): 테스트 없음. grep 으로 참/거짓이 나오는 규칙이라 CLAUDE.md 원칙상 **게이트**여야 한다. `render-content.mjs` 의 실패 조건에 금칙 패턴(예: `svc\.cluster\.local`, `\b10\.\d+\.\d+\.\d+\b`, `myrealtrip`, `AKIA[0-9A-Z]{16}`, `Bearer `) 한 줄을 더한다.
- **SR-3.5 접근성 마크업**(`<nav aria-label="목차">`, `<th scope="col">`, `role="img"` + `<figcaption>`): marked 의 GFM 표는 `scope="col"` 을 안 낸다 — 렌더러 훅이나 후처리가 필요하고, 그것을 단언하는 테스트가 없다. 렌더 테스트에 `<th scope="col"` 개수 > 0, 페이지·프리렌더 테스트에 `aria-label="목차"` 를 더한다.
- **SR-1.3 `rect` 금지·SR-1.2 노드 12개 이하**: fencesvg 가 `rect` 를 경고로 내는지(README:332 「not supported」만 있고 warning 여부는 안 적혀 있다) 구현 때 실측해 F1 의 「실제 깨진 펜스」 후보로 쓴다. 노드 수는 선택(렌더 테스트에서 flowchart 펜스의 노드 선언 수를 세도 되지만 게이트 가치가 낮다).

## F8 (낮음) — 배포 뒤 검증: 「대상이 최신인지」 단계가 없고, 4조합 정의가 표준과 다르다

**스펙**: SR-6.4 「CDP 4조합(라이트/다크 × 1280×800/390×844) … 기준 커밋 SHA 가 화면에 보인다」.

**근거**:
- SR-1.1 의 「기준: 커밋 짧은 SHA」는 **손으로 쓴 md 내용**이다. 화면에 보인다는 것은 문서가 그 줄을 갖고 있다는 뜻이지 배포된 번들·프리렌더가 이번 것이라는 증거가 아니다. `docs/standards/fe-visual-verification.md:157-176` 「재는 번들이 방금 구운 그것인지 — 이번에 새로 넣은 심볼이 응답 안에 있는지로 확인한다」, `[[frontend-visual-verification]]` ②.
- `fe-visual-verification.md:55-66` 의 4조합은 **기기(`prefers-color-scheme`) × 사이트 선택**이고 「테마 버그는 대각선에서만 드러난다」. 스펙의 「라이트/다크 × 뷰포트」는 대각선 둘이 빠진다. `--fs-*` → `--kh-*` 매핑(SR-3.4)이 정확히 그 캐스케이드 자리다.
- 모바일 측정에 `Emulation.setTouchEmulationEnabled` 가 없으면 `pointer: coarse` 규칙이 0줄 적용된 채 재진다(`[[frontend-visual-verification]]` 「`pointer: coarse` 는 뷰포트만으로 안 켜진다」).

**수정안**:
1. SR-2.2 의 `sourceHash` 를 페이지 머리 줄과 프리렌더 HTML 에 `data-source-hash` 로 낸다. 배포 뒤 첫 단계: `curl -A Googlebot` 응답의 `data-source-hash` == 배포 커밋에서 계산한 `sha256(md)[:12]`, CDP 에서도 같은 값이 DOM 에 있을 때만 측정을 시작한다. 다르면 그 측정은 버린다. (`nginx.conf:153-157` 이 `no-cache` 라 엣지 캐시는 문제 없다 — 번들 쪽만 보면 된다.)
2. 4조합을 「기기 light/dark × 사이트 light/dark」로 정의하고 뷰포트 둘(1280×800·390×844)을 곱한다(8회). 390 에서는 touch 에뮬레이션을 켠다. 캡처는 조합마다(자동 다크는 픽셀로만 보인다 — `fe-visual-verification.md:68-90`).
3. 가로 넘침은 `document.documentElement.scrollWidth <= innerWidth` 에 더해 **그림 단위**로 `figure.scrollWidth > figure.clientWidth` 인 그림이 있을 때 그 `overflow-x` 가 `auto` 인지(넘침이 figure 안에 갇혔는지)를 같이 남긴다 — SR-3.4 의 요구가 그것이다.

---

## 확인된 것 (이슈 아님)

- **CI 체크아웃에서 `../search/...` 가 존재한다**: `ci.yml:240-245` frontend-gate 는 `actions/checkout@v4` 로 레포 전체를 받고(sparse 아님, submodules 만 false), `:293-295` vitest 는 `working-directory: portal-fe`. `search/`·`k8s/` 는 서브모듈이 아니라 보인다. 경로 해석은 cwd 가 아니라 `fileURLToPath(new URL('../../../../search/...', import.meta.url))` 로 두는 것이 `--root` 변경에 안전하다(권고).
- **Docker 빌드에서 테스트는 안 돈다**: `portal-fe/Dockerfile:41` 은 `tsc -b` · `vite build` · `prerender-seo.mjs` 만. `.dockerignore:1-12` 는 `src/content` 를 막지 않아 md 는 컨텍스트에 들어간다. `render-content.mjs` 는 build 체인(SR-2.4)으로 돈다.
- **frontend-gate 에 경로 필터가 없다**: `ci.yml:21-26` — `search/app/...` 만 바뀐 PR 에서도 portal-fe vitest 가 돌아 드리프트가 잡힌다. 사용자 요구 「작업시마다 최신화」의 CI 쪽 전제는 성립한다.
- **오버레이가 env 를 덮지 않는다**: `k8s/**` 전체에서 `SEARCH_EMBEDDING_MODEL_REF`·`SEARCH_ATTRACTION_HYBRID_ENABLED` 는 base 두 파일(`search/deployment.yaml:33,36`, `search-batch/cronjob-attraction-reindex.yaml:61`)에만 있다. base 를 읽으면 운영 값이다.
- **로컬 fencesvg 는 0.11.2 다**: `portal-fe/node_modules/fencesvg/package.json:3` `"version": "0.11.2"`, `dist/index.d.ts:116`. 리드 메시지·Q3·requirements.md:14 의 「로컬 0.10.1」은 지금 워크트리 기준으로 사실이 아니다. Q3 의 결정(파이프 표기만 쓴다)은 그대로 유효하되, 「로컬 0.10.1 로 검증」 문구는 고친다.
- **copy.test 게이트**: `src/seo/__tests__/copy.test.ts:165` 가 `Object.keys(PORTAL_PAGES)` 를 정확 배열로 단언 — SR-4.1 의 키 추가 없이는 빨강. 회귀 주입 ③의 copy 쪽은 성립한다.
- **명명·위치**: `test-rules.md`·`testing.md` 는 Kotlin 만 다룬다. portal-fe 선례(`__tests__/*.test.ts(x)`, 한글 문장 `it`)와 스펙 파일명이 일치한다.

---

## 회귀 주입 — 수정 뒤 대응표 (SR-6.3 교체안)

| 주입 | 빨개져야 하는 것 | 지금 스펙에서의 상태 |
|---|---|---|
| sequence 펜스에 `rect` 한 줄(또는 caption 삭제) | `render-content.mjs` exit 1 + `renderContent.test` | F1 — 코드 블록으로 남아 초록 |
| 다섯 펜스 중 하나만 깨뜨리기 | 같은 것 + `fenceCount === svgCount` | F1 — SVG 4개 ≥ 4 라 초록 |
| `application.yml:72` `sight-weight` 변경 | 드리프트 | 스펙은 클래스 기본값을 읽어 초록 (F3) |
| `HybridSearchPipelineInitializer.kt:67` `60` → `61` | 드리프트 | 성립 |
| `deployment.yaml:34` ref 의 `@31de22b` 변경 | 드리프트 | 문서가 짧은 이름이면 애초에 비교 불가 (F3) |
| `attractions-index.json:452` `m` 변경 · 사전 한 줄 추가 | 드리프트 | 성립 (JSON 파서 전제) |
| md 표 값 하나 변경 · md 행 키 이름 변경 | 드리프트 | 후자는 양쪽 undefined 로 초록 (F3) |
| `deployment.yaml:37` `"true"` → `"false"` | 드리프트 | 게이트 밖 (F5) |
| `PORTAL_PAGES['/tech/search']` 제거 | copy.test + 프리렌더 테스트 | 프리렌더 쪽은 설계에 따라 (F4) |
| `App.tsx` 라우트 제거 | 라우트 테스트 | **대응 테스트 없음** — 페이지 컴포넌트 테스트는 라우트를 모른다. `MemoryRouter initialEntries={['/tech/search']}` 로 App 의 라우트 테이블을 그려 페이지 h1 이 나오고 용어집(`/tech/:category`)이 아닌지 보는 `routes.test.tsx` 를 더하거나, 이 주입을 뺀다 |

주입마다 **빨간불의 출력 한 줄**(assert 메시지 또는 exit 코드)을 남기고 되돌린 뒤 초록도 한 번 본다 — `[[gate-failure-modes]]` 「양방향 보정」.

---

## 요약

- F1 fencesvg `inlineDiagrams` 는 warnings 를 삼킨다 — 펜스별 `renderDiagram` + `fenceCount === svgCount`.
- F2 생성 JSON gitignore + CI 무빌드 `tsc -b`·vitest = 상시 빨강 — globalSetup/CI 단계 또는 `import.meta.glob`.
- F3 파서 양쪽 누락이 초록, 한 셀에 값 넷, 유효 값은 yml — 행당 값 하나·존재 단언·구조 파서·두 yaml.
- F4 `renderPortalPages` 미export·프리렌더 일반 예외 exit 0 — 순수 함수 export + `PartialSeoFailure`.
- F5 하이브리드·clickBoost·fusion 플래그가 게이트 밖 — 9값으로.
- F6 `scripts/__tests__` 는 include 밖, jsdom ≠ 빌드 경로 — `src/content/__tests__` + `@vitest-environment node`.
- F7 금칙 패턴·접근성 마크업 테스트 없음.
- F8 배포 뒤 「최신 대상」 확인 없음·4조합 정의 — `data-source-hash` 대조 + 기기×사이트.

VERDICT: REVISE
