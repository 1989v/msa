## 3라운드 (2026-10-08)

- 대상: 2라운드 심판(`context/review-verdict-round2.md`, keep 12) 편집 E1~E17 반영본 `spec.md`. 심판 결정과 사용자 판단(③ 은 결정 ④와 같은 종류, 하네스 원장 한 줄 필수)은 재론하지 않았다.
- 범위: 2라운드 N1~N3 해소 여부, 커밋 전 컴파일 훅을 네 번째 렌더 지점으로 넣는 경계(SR-2.4 넷째 불릿 · SR-6.3 ⑫)의 성립 여부.

### 판정 요약

**SHIP** — N1~N3 은 모두 해소됐다. 훅 경계는 호출 경로·전제·실패 의미가 기존 세 지점과 같아 성립한다. 새 실질 결함은 없다. 회귀 주입 ⑫ 의 실행 순서와 작업 디렉토리에 관한 구현 참고 두 줄만 남긴다.

### 2라운드 발견 해소 여부

| # | 판정 | 근거 |
|---|---|---|
| N1 커밋 훅 진입점 | 해소 | SR-2.4(`spec.md:38`)가 「네 곳」으로 바뀌었고 넷째 불릿(`spec.md:42`)이 `compile-changed.sh:26` 을 `(cd portal-fe && node scripts/render-content.mjs && npx tsc -b)` 로 정한다. `agent-behavior.md:31` 한 문장과 `harness-changelog.md` 한 줄도 같은 불릿에 있다. SR-6.3 ⑫(`spec.md:67`)가 렌더 유무로 exit 0 / TS2307 을 갈라 회귀를 증명한다 |
| N2 범용 반복 덮어쓰기 | 해소 | SR-4.2(`spec.md:55`)가 반복(`prerender-seo.mjs:1591`) 안 `path === '/tech/search'` 분기로 범용 본문 대신 `renderTechSearchHtml` 결과를 emit 하고 「같은 파일을 두 번 쓰지 않는다」고 적는다. 분기가 빠지면 SR-6.2 `role="img"` 수 0 으로 잡힌다 |
| N3 `.gitignore` 기준 | 해소 | SR-2.4(`spec.md:43`)가 `portal-fe/.gitignore` 에 `/src/pages/tech/generated/search-architecture.json` 을 파일 기준 경로로 적는다. SR-6.2(`spec.md:66`)에 `git check-ignore` 확인이 들어갔다 |

### 훅 경계 검토 — 성립한다

| 관점 | 확인 |
|---|---|
| 호출 경로 | `commit-gate.sh:13,17` 이 `HNS_COMPILE_CMD`(`.claude/hns-hooks.env:4` = `compile-changed.sh`)를 `bash -c` 로 돌리고 rc≠0 이면 tier `enforce` 에서 deny 한다. 렌더 실패도 같은 rc 로 흘러 「컴파일 실패」와 같은 의미가 된다 |
| 남은 `tsc -b` 진입점 | 레포 전체(`node_modules` 제외)에서 portal-fe `tsc -b` 실행 지점은 `package.json:9` · `Dockerfile:41` · `ci.yml:289` · `compile-changed.sh:26` 넷뿐이다. 나머지 일치는 admin·gifticon·agent-viewer 의 별개 패키지와 문서 인용이다. 다섯째 지점은 없다 |
| 전제 | 렌더는 fencesvg·marked 를 `node_modules` 에서 읽는다. `npx tsc -b` 도 같은 `node_modules` 를 요구하므로 훅이 새로 요구하는 전제는 없다 |
| 트리거 범위 | `compile-changed.sh:22` 는 portal-fe `.ts(x)` 변경에서만 `fe=1` 이다. md·`.mjs` 만 바꾼 커밋에서는 렌더가 돌지 않지만 그 경우는 CI `Render content` 스텝이 잡는다. Kotlin 만 바꾼 커밋에는 영향이 없다 |
| 부작용 | 훅이 gitignore 된 생성물을 작업 트리에 쓴다. 스테이지에 오르지 않으므로 커밋 내용은 바뀌지 않는다(N3 해소가 전제) |
| 실패 의미 | md 펜스가 깨진 상태에서는 무관한 portal-fe 커밋도 거부된다. 같은 md 로 CI·이미지 빌드도 실패하므로 커밋 단계에서 먼저 막는 것은 다른 세 지점과 일관된다 |
| 문서 정합 | `compile-changed.sh:3` 머리 주석, `ADR-0091:37,66`, `agent-behavior.md:48` 은 「portal-fe 는 `tsc -b`」라고만 적는다. 렌더가 앞에 붙어도 거짓이 되지는 않으므로 고칠 의무는 없다 |

### 구현 참고 (발견 아님, 회귀 주입 ⑫ 실행 시)

- **순서**: 첫 실행(렌더 포함 훅)이 생성 JSON 을 다시 만든다. 렌더를 뺀 사본은 JSON 을 **다시 지운 뒤** 돌려야 TS2307 이 난다. 「지움 → 사본(TS2307) → 지움 → 원본(exit 0)」 순서가 안전하다.
- **작업 디렉토리**: `compile-changed.sh:7` 은 `CLAUDE_PROJECT_DIR` 가 있으면 그곳으로 `cd` 하고, `_lib.sh:4` 도 같다. 스크래치 워크트리에서 ⑫ 를 돌릴 때 이 변수가 메인 트리를 가리키면 메인 트리의 portal-fe 를 재게 된다. 명령 앞에 `CLAUDE_PROJECT_DIR="$PWD"` 를 붙여 대상 트리를 고정한다.

### 체크리스트 판정 (3라운드)

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 · 상향 의존 없음 | 통과 | 1·2라운드와 같다 |
| 외부 연동은 Port 로 | 해당 없음 | |
| 모듈 경계 변경 사유 명시 | 통과 | 빌드 진입점 넷과 하네스 원장이 모두 명시됐다(`spec.md:38-43`) |
| 패턴 일관성 | 통과 | |
| 순환 의존 · 트랜잭션 | 통과 / 해당 없음 | |
| 인터페이스 표면 최소 | 통과 | |
| 얕은 패스스루 없음 · Deletion Test | 통과 | |
| 정보 은닉 깊이 | 통과 | N2 분기로 호출 순서 지식이 `renderPortalPages` 안에 갇혔다 |
| Seam 현실성 · 모듈 이름 | 통과 | |

---

## 2라운드 (2026-10-08)

- 대상: 개정 `spec.md`(1라운드 심판 keep 41 / demote 3 반영본). 심판 판정의 채택안과 사용자 결정 ④(Dockerfile·CI 렌더 스텝)는 재론하지 않았다.
- 근거 경로는 작업 트리 `scratchpad/wt-impl` 기준.

### 판정 요약

**REVISE** — 1라운드 A1~A8 은 전부 해소됐다. 새 발견 세 건은 모두 비차단이지만, N1 은 tasks 분해 전에 스펙에 넣어야 한다. 넣지 않으면 구현 직후부터 새 체크아웃의 portal-fe 커밋이 훅에서 거부된다.

### 1라운드 발견 해소 여부

| # | 판정 | 근거 |
|---|---|---|
| A1 빌드 경로 | 해소 | SR-2.4 가 package.json(build·dev)·`Dockerfile:41`·ci.yml Type check 앞 세 곳에 렌더를 `tsc -b` 앞으로 둔다. `ARG GIT_SHA`(`Dockerfile:54`)는 같은 builder 단계라 :41 앞으로 올려도 유효하다. `images.yml:364` 가 `GIT_SHA=$TAG` 를 넘긴다. JSON import 는 `tsconfig.app.json:13` `moduleResolution: bundler` 에서 `resolveJsonModule` 기본값이 참이라(`typescript.js:22040`) 별도 설정이 필요 없다. 단 네 번째 진입점이 남았다 → N1 |
| A2 실패 의미 | 해소 | SR-4.2: export 순수 함수 `renderTechSearchHtml`, JSON 은 `main()` 에서 읽기, 없거나 형식 불일치면 `PartialSeoFailure`(`prerender-seo.mjs:144-156` exit 1). 같은 모양의 선례 `renderDealHubHtml`(:1252)이 있다 |
| A3 fencesvg 계약 | 해소 | SR-2.1 이 펜스마다 `renderDiagram` 을 부르고 figure·figcaption 을 스크립트가 만든다. `index.d.ts:5-10` 의 `{ svg, caption, warnings }` 와 맞고, `context/probe-2026-10-08.md:5` 가 「캡션 없음 → warnings 1건」을 실측했다 |
| A4 트립와이어 범위 | 해소 | SR-2.3 ③~⑧ 이 태그 안 이벤트 속성·href 스킴·주석·`<object|embed|base>` 를 다루고, SR-2.3·3.3 이 「sanitizer 가 아니라 트립와이어」를 적었다. fencesvg `dist/` 에 `<style`·`href`·`<use`·`<!--` 가 0건이라 SVG 쪽 오탐도 없다 |
| A5 useSeo 구성 | 해소 | SR-3.2 가 canonical·jsonLd 를 넘기고 빌더를 `copy.mjs` 공용으로 둔다. `useSeo.ts:9-21` 이 그 옵션을 모두 받고 `breadcrumbJsonLd(lang, trail)`(`copy.mjs:269`)가 있다 |
| A6 doc-index | 해소 | `manual_links` 글롭 하나로 줄였다. `doc-index.json:129` 대로 fnmatch 기반이라 `*` 가 `/` 를 넘어 하위 패키지까지 잡는다 |
| A7 진입 경로 | 해소 | SR-3.1 이 아틀라스 NAV 한 줄을 예외로 두고, 라우트 순서를 「가독성」으로 고쳤다 |
| A8 생성물 위치 | 해소 | SR-2.4 가 `src/pages/tech/generated/` 와 렌더→tsc 순서를 정했다 |

### 새 발견

| # | 심각도 | 체크 | 한 줄 |
|---|---|---|---|
| N1 | 중간 | Cross-module boundary · Information hiding | 커밋 전 컴파일 훅이 렌더 없이 `npx tsc -b` 를 돌린다. 생성물이 gitignore 라 새 체크아웃에서 portal-fe ts 커밋이 TS2307 로 거부된다 |
| N2 | 낮음 | Information hiding | `renderPortalPages` 는 `PORTAL_PAGES` 의 모든 키에 범용 페이지를 쓴다. `/tech/search` 를 넣으면 같은 파일을 두 번 쓰고 호출 순서가 결과를 정한다 |
| N3 | 낮음 | Module placement | `.gitignore` 한 줄을 레포 기준 경로로 적었다. `portal-fe/.gitignore` 에 그대로 넣으면 매치하지 않아 생성물이 커밋된다 |

#### N1. 네 번째 `tsc -b` 진입점 — 커밋 전 컴파일 훅 (중간)

스펙 결정: SR-2.4 「렌더 스텝을 **세 곳에** 같은 순서로, `tsc -b` 보다 앞에」, 생성물은 `.gitignore`. SR-6.3 ⑩ 이 「생성 JSON 지운 채 `npx tsc -b` → TS2307」을 스스로 확인한다.

코드:
- `.claude/hooks/hns/compile-changed.sh:22,26` — 스테이지·워킹 변경에 `portal-fe/**/*.ts(x)` 가 있으면 `(cd portal-fe && npx tsc -b)` 를 돌리고, 실패하면 exit code 를 그대로 낸다.
- `docs/standards/agent-behavior.md:47-50` — 이 훅은 tier `enforce` 이고 실패하면 커밋을 **거부**한다. `:31` 은 에이전트의 FE 타입체크를 `npx tsc -b` 로 정한다.

결과: 이 레포는 스크래치 워크트리와 병렬 세션을 일상적으로 쓴다. 구현이 들어간 뒤 새 체크아웃에서 렌더를 한 번도 돌리지 않은 세션이 portal-fe ts·tsx 를 고치면, 이 페이지와 무관한 커밋도 TS2307 로 거부된다. 에이전트가 `agent-behavior.md:31` 대로 `npx tsc -b` 를 돌려도 같은 오류가 나서 남의 변경 탓으로 오진하기 쉽다.

수정안:
1. SR-2.4 를 「네 곳」으로 고치고 `compile-changed.sh:26` 을 `(cd portal-fe && node scripts/render-content.mjs && npx tsc -b)` 로 바꾼다. 렌더는 순수 로컬 연산이라 훅 시간 부담이 작다.
2. `agent-behavior.md:31` 에 한 문장을 더한다. 「새 체크아웃에서는 `node scripts/render-content.mjs` 를 먼저 돌린다. 생성물은 커밋하지 않는다」.
3. 두 파일 모두 하네스라 `docs/changelog/harness-changelog.md` 에 한 줄을 남긴다(루트 CLAUDE.md 「하네스 변경 원장」).

#### N2. 범용 포털 반복과 새 함수가 같은 파일을 쓴다 (낮음)

스펙: SR-4.1 이 `PORTAL_PAGES['/tech/search']` 를 추가하고, SR-4.2 는 「`renderPortalPages(shell, concepts, { searchArchitecture })` 가 `renderTechSearchHtml` 을 부른다」고만 적었다.

코드: `prerender-seo.mjs:1591-1612` 는 `PORTAL_PAGES` 의 모든 항목에 h1+설명+nav 범용 본문을 `prerender${path}.html` 로 쓴다. `copy.mjs:958-959` 주석도 「여기 없는 경로는 프리렌더 대상이 아니다」라고 적어 둔다. 새 키를 넣으면 같은 반복이 `prerender/tech/search.html` 을 범용 본문으로 쓴다. 새 함수를 반복보다 앞에서 부르면 범용 본문이 마지막에 덮어써서 표·SVG 없는 페이지가 나간다. 이 경우 SR-4.4 테스트는 `renderTechSearchHtml` 만 직접 부르므로 초록이다.

수정안: SR-4.2 에 「반복 안에서 `path === '/tech/search'` 이면 `renderTechSearchHtml` 결과를 emit 하고 범용 본문은 쓰지 않는다」를 명시한다. 범용 nav 가 새 경로 링크를 자동으로 얻는 것은 그대로 이득이다.

#### N3. `.gitignore` 경로의 기준 디렉토리 (낮음)

스펙: SR-2.4 「`.gitignore`(`portal-fe/src/pages/tech/generated/search-architecture.json` 한 줄)」.

코드: 루트 `.gitignore` 에는 portal-fe 항목이 없고, portal-fe 규칙은 `portal-fe/.gitignore` 가 갖는다. 중간에 `/` 가 있는 gitignore 패턴은 그 파일이 있는 디렉토리 기준이다. 적힌 문자열을 `portal-fe/.gitignore` 에 넣으면 `portal-fe/portal-fe/src/…` 를 찾아 매치하지 않는다. 그러면 공유 트리의 `git add -A` 가 생성물을 커밋해 Q1 「생성물 미커밋」이 깨진다.

수정안: 「`portal-fe/.gitignore` 에 `/src/pages/tech/generated/search-architecture.json`」으로 파일과 경로를 함께 적는다. SR-6.2 에 `git check-ignore portal-fe/src/pages/tech/generated/search-architecture.json` 이 경로를 출력하는지 확인하는 단계를 하나 더한다.

### 체크리스트 판정 (2라운드)

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 · 상향 의존 없음 | 통과 | 1라운드와 같다 |
| 외부 연동은 Port 로 | 해당 없음 | |
| 모듈 경계 변경 사유 명시 | REVISE(N1) | Dockerfile·CI 경계는 명시됐고 훅 경계가 빠졌다 |
| 패턴 일관성 | 통과 | `useSeo`↔프리렌더 공용 빌더, `renderDealHubHtml` 형 순수 함수 |
| 순환 의존 · 트랜잭션 | 통과 / 해당 없음 | |
| 인터페이스 표면 최소 | 통과 | `renderContent(markdown, { idPrefix, gitSha }) → { html, headings, warnings }` 하나 |
| 얕은 패스스루 없음 · Deletion Test | 통과 | `renderContent` 를 지우면 vite 페이지와 프리렌더 두 곳에 흩어진다 |
| 정보 은닉 깊이 | REVISE(N2) | 호출자가 「범용 반복보다 뒤에 불러야 한다」는 순서를 알아야 안전하다 |
| Seam 현실성 · 모듈 이름 | 통과 | |

### 확인된 것 (발견 아님)

- 생성 JSON 은 `.dockerignore` 에 걸리지 않고, 로컬 컨텍스트에 낡은 사본이 있어도 Dockerfile 렌더가 덮어쓴다.
- 이미지 빌드 경로는 Dockerfile 하나뿐이다. `images.yml:354-364` 와 `scripts/image-import.sh:42` 모두 같은 Dockerfile 을 쓴다.
- 프리렌더 `compose` 는 `og:type` 을 `website` 로 고정한다(`prerender-seo.mjs:378`). SR-3.2 의 `type: 'article'` 은 SPA 전환에서만 값이 갈린다. 크롤러가 보는 값에는 영향이 없어 결함으로 세지 않는다. 맞추려면 SR-3.2 에서 `type` 을 빼면 된다.

---

# Architecture Review — `/tech/search` 검색 아키텍처 페이지 (1라운드)

- 대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml`
- 체크리스트: hns 0.16.1 `reviewers/architecture/checklist.md` (언어 참조 §3 Depth · Seam · Deletion Test)
- 근거 경로는 작업 트리(`scratchpad/wt-impl`, origin/main `06550592a`) 기준
- 지식베이스: [[markdown-diagram-publishing-path]] (1989v, updated 2026-09-09) · [[msa-blog-diagram-breakout-record]] (1989v raw, 2026-09-09) · [[msa-unified-search-plan-record]] (1989v raw, 2026-09-05 — 내용 출처 확인용, 구조 판단에는 미사용)

사용자 결정 3건(새 경로 · 레포 문서 원본 + 빌드 렌더 · 범위)은 재론하지 않았다. 아래는 그 결정을 **그대로 두고** 빌드 체인·프리렌더·면 훅의 이음새를 본 결과다.

## 판정 요약

**REVISE** — 차단은 아니지만 A1~A3 은 tasks 분해 전에 스펙을 고쳐야 한다. 세 건 모두 스펙이 가정한 실행 경로·라이브러리 계약이 코드와 다르다.

| # | 심각도 | 체크 | 한 줄 |
|---|---|---|---|
| A1 | 높음 | Layer & Dependency · Seam | `render-content.mjs` 를 `npm run build` 에만 끼웠는데 Docker 와 CI 는 그 스크립트를 부르지 않는다 → 생성 JSON 미커밋(Q1)과 합쳐지면 이미지 빌드·CI 타입체크가 깨진다 |
| A2 | 높음 | Information hiding · 실패 의미 | 프리렌더는 비(非)`PartialSeoFailure` 오류를 exit 0 으로 삼킨다 → 생성 JSON 이 없거나 깨지면 페이지 없는 이미지가 조용히 나간다 |
| A3 | 높음 | Interface surface | fencesvg `inlineDiagrams` 는 warnings 를 돌려주지 않고 실패한 펜스를 원문 그대로 둔다. caption 도 `<figcaption>` 이 아니라 「그림: …」 문단이다 → SR-2.1 · 2.3 · 3.5 · 6.1 이 없는 계약 위에 서 있다 |
| A4 | 중간 | Seam 경계 | SR-2.3 금지 패턴 `on[a-z]+=` 는 `ef_construction=128` 에 걸리고(오탐) `javascript:` · `<object` · HTML 주석은 안 본다. 신뢰 경계를 문장으로 못 박고 검사는 태그 안으로 좁힌다 |
| A5 | 중간 | Architecture pattern consistency | SR-3.2 `useSeo` 가 canonical · jsonLd 없이 호출된다 → SPA 전환에서 `/tech` 의 canonical 이 남고, 프리렌더가 심은 JSON-LD 가 하이드레이션에서 사라진다(용어집이 이미 겪은 함정) |
| A6 | 낮음 | Cross-module boundary | doc-index 연결 — md 머리 `<!-- source -->` 는 `doc_roots` 밖이라 스캔되지 않고, `manual_links` 의 글롭 4개 중 3개는 `source_roots`/`source_extensions` 밖이라 dangling 이 된다 |
| A7 | 낮음 | Seam (기존 `/tech`) | 아틀라스 NAV 에 새 페이지 링크가 없고 「기존 /tech 화면 변경 0」이라 사람 방문자는 SPA 안에서 도달 경로가 없다. 라우트 순서는 결정 요인이 아니다 |
| A8 | 낮음 | Module placement | SR-2.4 「아틀라스 generated 와 같은 폴더」와 `src/generated/` 가 서로 다르다. 체인 순서도 `tsc -b` 가 JSON 을 먼저 요구한다 |

## 발견

### A1. 생성 단계가 실제 빌드 경로에 없다 (높음)

스펙 결정: SR-2.4 `package.json` build 를 `tsc -b && node scripts/render-content.mjs && vite build && …` 로 바꾸고, 생성물 `src/generated/search-architecture.json` 은 `.gitignore`(Q1 — `context/open-questions.yml:5-6` "프리렌더·페이지 둘 다 빌드 체인 안에서 읽는다").

코드:
- `portal-fe/Dockerfile:41` — `RUN npx tsc -b --force && npx vite build --base / && node scripts/prerender-seo.mjs`. **`npm run build` 를 쓰지 않는다.** 뒤이어 `:62` `strip-html-comments.mjs` 도 따로 부른다.
- `.github/workflows/ci.yml:287-295` — frontend-gate 도 `npx tsc -b --force` · `npx vitest run` 을 직접 부른다.
- `portal-fe/tsconfig.app.json:30` — `include: ["src"]`. 페이지가 JSON 을 `import` 하면(SR-3.3) 파일이 없을 때 `tsc -b` 가 먼저 실패한다.
- `portal-fe/src/seo/__tests__/prerenderPlace.test.ts:4-15` — 기존 seo 테스트들이 `prerender-seo.mjs` 를 통째로 import 한다. 프리렌더가 모듈 최상위에서 생성 JSON 을 읽으면 이 테스트들도 전부 깨진다.

결과: 스펙대로 구현하면 `npm run build` 는 통과하지만 **이미지 빌드(Dockerfile)와 CI 게이트는 생성물이 없어 실패**한다. SR-6.2 의 `npm run build` 1회 검증은 이 경로를 재지 않는다.

수정안(사용자 결정 「빌드 때 렌더」 유지):
1. 체인 순서를 **렌더 → tsc → vite → 프리렌더** 로. `package.json` build: `node scripts/render-content.mjs && tsc -b && vite build && node scripts/prerender-seo.mjs && node scripts/strip-html-comments.mjs`.
2. `Dockerfile:41` 에 `node scripts/render-content.mjs &&` 를 `npx tsc -b` **앞**에 한 줄. 스펙 제약(`requirements.md:49` "최소 수정")에 Dockerfile 1줄을 추가한다.
3. `ci.yml:287` Type check 앞에 같은 한 줄(`working-directory: portal-fe`).
4. `dev` 스크립트도 `node scripts/render-content.mjs && vite` — 안 그러면 `vite` 개발 서버가 import 를 못 푼다.
5. 프리렌더는 생성 JSON 을 모듈 최상위가 아니라 `main()` 안에서 읽고 `renderPortalPages(shell, concepts, { searchArchitecture })` 로 **넘긴다** — 테스트는 픽스처를 주입한다(A2 와 같은 수정).

대안(참고만): 아틀라스처럼 생성물을 커밋하고 `sourceHash` 대조 게이트를 두면 Dockerfile · ci.yml 을 안 건드린다(`AtlasGraphExportSpec.kt:11-15` 선례). 다만 「빌드 때 렌더」라는 사용자 결정의 자구와 어긋나므로 추천하지 않는다.

### A2. 프리렌더의 실패 의미가 「조용히 빈 페이지」를 허용한다 (높음)

스펙: SR-2.3 "조용히 빈 페이지가 나가지 않게 한다", SR-4.2 프리렌더 분기가 생성 JSON 의 `html` 전체를 싣는다.

코드 `portal-fe/scripts/prerender-seo.mjs:149-156`:
```js
main().catch((err) => {
  if (err instanceof PartialSeoFailure) { …; process.exit(1); }
  console.warn(`[seo] 프리렌더 실패 — SPA 만 배포됩니다: ${err.message}`);
  process.exit(0);
});
```
`/tech/search` 분기에서 JSON 읽기·형식 검사가 일반 `Error` 로 던지면 **exit 0** 이고, Dockerfile `&&` 체인은 계속 진행해 `prerender/tech/search.html` 이 없는(그리고 그 뒤 페이지도 없는) 이미지가 나간다. nginx 는 `nginx.conf:157` `try_files … /index.html` 로 SPA 셸을 내보내므로 크롤러는 빈 본문을 받는다.

수정안: `main()` 머리에서 생성 JSON 을 읽고 `{html, headings, updated, sourceHash}` 형식과 `role="img"` ≥ 1 · `<table` ≥ 1 을 확인해 어긋나면 `PartialSeoFailure` 를 던진다(:144 의 클래스 재사용 — 「일부만 빠진 상태가 가장 위험하다」는 그 주석의 논리와 같다). 읽은 값을 `renderPortalPages` 인자로 넘긴다(A1-5).

### A3. fencesvg 계약이 스펙 가정과 다르다 (높음)

스펙: SR-2.1 `inlineDiagrams → marked.parse`, SR-2.3 "fencesvg `warnings` 1건 이상 → 실패", SR-3.5 "caption 이 `<figcaption>`", SR-6.1 "caption `<figcaption>`".

코드(작업 트리 `node_modules/fencesvg`, 0.11.2):
- `dist/index.d.ts:10-11` — `renderDiagram(source, opts) → { svg, caption, warnings }` 이고 **`inlineDiagrams(markdown, opts) → string`** 이다. warnings 채널이 없다.
- `dist/index.js:15` — 펜스 렌더가 실패하면(`!S.svg`) **원문 펜스 줄을 그대로 돌려놓는다**(`o.push(...n.slice(i,x+1))`). warnings 는 버려진다. marked 를 거치면 `<pre><code class="language-mermaid">` 코드 블록으로 남는다.
- `dist/index.js:15-17` — 성공 시 caption 은 `\n\n그림: {caption}` **마크다운 문단**으로 붙고, `.fs-figure` 래퍼는 `%% source` 지시가 있을 때만 생긴다.

결과: SR-2.3 의 「warnings → 실패」는 `inlineDiagrams` 경로로는 구현 불가하고, 「SVG 0개」 검사는 5장 중 1장만 실패한 경우를 통과시킨다. `<figcaption>` 은 라이브러리가 만들지 않는다. [[markdown-diagram-publishing-path]] 가 적은 대로 "배치는 사이트 CSS 의 몫 — 래퍼에 클래스가 없으면 `:has(> svg[role="img"])` 로 잡는다"가 지금 블로그의 실제 방식이다(`Blog.css:1101-1106`).

수정안(둘 중 하나를 스펙에 명시):
- (권장) `renderContent` 가 펜스를 직접 나누고 펜스마다 `renderDiagram` 을 부른다 → warnings · caption 을 손에 쥐고 `<figure class="fs-figure" role="group"><svg role="img"…/><figcaption>` 을 **자기 손으로** 만든다. 검사는 "svg 수 == 펜스 수 · warnings 0 · 출력에 `language-mermaid` 0건". 펜스 정규식 한 줄이 중복되지만 그 대가로 SR-2.3 이 실제로 선다.
- (대안) `inlineDiagrams` 를 유지하고 SR-3.5 · 6.1 의 `<figcaption>` 을 「그림: …」 문단으로 바꾸며, 검사를 "출력에 `language-mermaid` 코드 블록 0건 && `svg[role="img"]` 수 == 펜스 수"로 둔다. svg 는 나왔지만 일부가 안 그려진 warnings 는 못 잡는다.

### A4. sanitize 없는 주입의 경계 — 검사 범위가 어긋난다 (중간)

스펙: SR-3.3 "런타임 sanitize 없음, SR-2.3 이 계약을 검사한다". SR-2.3 금지 목록 `<script`·`<style`·`<use`·`<foreignObject`·`<iframe`·`on[a-z]+=`.

판단: 경계 자체는 성립한다 — 원본 md 는 레포 커밋물이고 쓰는 사람은 유지보수자뿐이며, 블로그가 DOMPurify 를 두는 이유(`pages/blog/markdown.ts:9-11` "계정 탈취 한 번이면…")가 여기에는 없다. 다만 스펙이 그 **이유**를 적지 않고 검사 목록만 적어, 다음 사람이 이 목록을 sanitizer 로 읽는다.

문제:
- `on[a-z]+=` 는 본문 텍스트에도 걸린다. 이 문서가 다룰 값 `ef_construction=128` · `rank_constant=60` 은 `onstruction=` · `onstant=` 로 **오탐**한다(SR-1.5 "값은 코드에서 읽은 그대로"라 이런 표기가 나온다).
- `javascript:` href · `<object` · `<embed` · `<base` 는 안 본다(저자 신뢰 전제라 치명적이진 않지만 목록이 "막는 것"을 자처하면 빠진 것이 눈에 띈다).
- md 머리의 `<!-- source: … -->`(SR-1.1) 는 marked 를 통과해 JSON `html` 에 남는다. `strip-html-comments.mjs:16` 은 `dist/**/*.html` 만 지우므로 **SPA 청크의 JSON 안 주석은 배포된다**. Dockerfile `:60-61` 의 「설계 메모를 산출물에 싣지 않는다」 방침과 어긋난다.

수정안: SR-3.3 에 한 문장 — "이 HTML 은 레포 커밋 md 에서만 나오고 SR-2.3 은 sanitizer 가 아니라 **계약 위반 트립와이어**다". SR-2.3 을 태그 안으로 좁힌다: `/<[^>]*\son[a-z]+\s*=/i`, `/\b(href|src|xlink:href)\s*=\s*["']?\s*javascript:/i`, `<object` · `<embed` · `<base` 추가, 그리고 **`<!--` 0건**(renderContent 가 주석을 걷어낸다).

### A5. `useSeo` 와 프리렌더의 구성이 다르다 (중간)

스펙: SR-3.2 `useSeo(PORTAL_PAGES['/tech/search'])`. SR-4.2 프리렌더는 canonical + `TechArticle` + `breadcrumbJsonLd`.

코드:
- `copy.mjs:961-997` — `PORTAL_PAGES` 항목은 `title` · `description` 뿐이다.
- `useSeo.ts:108-110` — canonical 은 값이 없으면 **지우지 않고 이전 값을 남긴다**. `/tech`(아틀라스는 `ConceptAtlasPage.tsx:66-71` 에서 canonical 을 명시한다)에서 SPA 전환으로 `/tech/search` 에 오면 canonical 이 `/tech` 로 남는다.
- `useSeo.ts:70` — 하이드레이션 때 `[SEO_MULTI_ATTR]` 요소를 전부 지운다. `TechGlossaryPage.tsx:48-49` 주석: "프리렌더와 같은 구성이어야 한다 — 하이드레이션이 그쪽을 갈아끼우므로 여기서 빠뜨리면 정적 HTML 에 있던 breadcrumb 이 렌더 후 사라진다".

수정안: 페이지는 `useSeo({ ...PORTAL_PAGES['/tech/search'], canonical: portalUrl('/tech/search'), type: 'article', jsonLd: [techArticleJsonLd(updated), breadcrumbJsonLd('ko', […])] })`. JSON-LD 빌더는 `copy.mjs` 에 두고 프리렌더와 페이지가 **같은 함수**를 부른다(`copy.mjs:955-960` "프리렌더·런타임 공용" 원칙). `updated` 는 생성 JSON 에서 온다.

### A6. doc-index 연결 — 절반이 작동하지 않는다 (낮음)

스펙: SR-1.1 md 머리 `<!-- source: … -->` "(doc-index 인용)", SR-5.3 `manual_links` 한 항목(sources 4 글롭: `search/app/**`, `search/batch/**/*.json`, `k8s/base/search/deployment.yaml`, `docs/adr/ADR-0090-*.md`).

코드:
- `docs/doc-index.json:35-37` `doc_roots: ["docs"]`, `:4-34` `source_roots` 에 `k8s` · `docs` 없음, `:61-69` `source_extensions` 에 `.json` · `.yaml` 없음.
- `doc_map.py:105-118`(hns 0.15.1 캐시; 작업 트리 `ai` 서브모듈 미초기화) — explicit 인용은 `doc_roots` + 서비스 `docs/` 만 훑는다 → portal-fe 안 md 의 주석은 **스캔되지 않는다**.
- `doc_map.py:154-174` — `manual_links` 의 `doc` 는 경로 제한 없이 그대로 쓰므로 항목 자체는 유효하다. 그러나 글롭이 `sources` 에 안 맞으면 `resolved: False` 행이 lock 에 남는다 → 4개 중 3개가 dangling.

수정안: `manual_links` 는 Kotlin 글롭 하나만(`search/app/src/main/kotlin/com/kgd/search/*`). md 머리 주석은 사람용 출처로 남기되 "doc-index 인용"이라 부르지 않는다. JSON · k8s · ADR 경로는 md §5 산문에 둔다. `doc_roots` 정책 확장은 이 스펙 범위 밖(보고만).

### A7. 기존 `/tech` 와의 이음새 (낮음)

- `ConceptAtlasPage.tsx:14-17` NAV 는 「아틀라스 · 홈」뿐이고 SR-3.1 은 "기존 /tech 화면 변경 0". 프리렌더 nav(`prerender-seo.mjs:1588-1590`)는 `PORTAL_PAGES` 전부를 걸어 크롤러에겐 보이지만 하이드레이션 뒤 SPA 가 갈아끼운다 → 사람 방문자는 **주소를 알아야만** 온다. 「변경 0」은 사용자 결정이 아니라 스펙 제약이다. NAV 에 `{ label: '검색 아키텍처', href: '/tech/search' }` 한 줄을 허용하거나, 고아 상태를 받아들인다고 명시한다.
- 라우트 순서: react-router v7 은 정적 세그먼트를 동적보다 높게 매긴다. `App.tsx:226-233` 에서 `/tech/search` 를 `:233` 앞에 두는 것은 무해하지만 **순서가 지키는 것이 아니다** — 지키는 것은 SR-6.1 페이지 테스트다. 스펙 문구를 "앞에 둔다(가독성)"로 바꾼다.
- nginx `nginx.conf:153-157` `^/tech/([a-z][a-z-]*)$` 가 `search` 를 받아 `prerender/tech/search.html` 을 먼저 찾는다 — 변경 없음이 맞다. `techCategoryFromSlug('search')` 는 `copy.mjs:894-897` 대로 null → 충돌 없음.
- 면: `useHeritageSurface()`(`useHeritageSurface.ts:109-131`)로 아틀라스와 같은 면에 서고, 용어집(`/tech/:category`)은 dark 고정(`TechGlossaryPage.tsx` 에 훅 없음)이다. 새 페이지가 아틀라스 쪽을 따르는 것은 일관된 선택이다.

### A8. 생성물 위치와 체인 순서 (낮음)

- SR-2.4 "아틀라스 `generated/graph.json` 과 같은 폴더를 쓰되" — 아틀라스는 `src/pages/atlas/generated/`(`useAtlasData.ts:12`)이고 스펙 출력은 `src/generated/`. 둘 중 하나로: 페이지 옆 `src/pages/tech/generated/search-architecture.json`(아틀라스와 같은 배치 원칙, gitignore 는 이 파일 한 줄)을 권한다.
- 체인은 A1 의 순서(렌더가 `tsc -b` 앞)여야 한다. SR-2.4 의 `tsc -b && node render …` 는 그대로 두면 첫 빌드부터 실패한다.

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 · 상향 의존 없음 | 통과 | FE + 빌드 스크립트. `scripts/render-content.mjs` 는 `src/` 를 import 하지 않고, 페이지는 생성 JSON 만 import 한다 |
| 외부 연동은 Port 로 | 해당 없음 | 런타임 외부 호출 없음(사용자 결정 ②) |
| 모듈 경계 변경 사유 명시 | REVISE(A1 · A6) | Dockerfile · ci.yml · doc-index 경계가 스펙에 빠져 있다 |
| 패턴 일관성 | REVISE(A5) | `useSeo` ↔ 프리렌더 구성 불일치, 용어집이 문서화한 함정 재발 |
| 순환 의존 | 통과 | 없음 |
| 트랜잭션 경계 | 해당 없음 | |
| 인터페이스 표면 최소 | REVISE(A3) | `renderContent` 시그니처는 작지만 그 밑의 `inlineDiagrams` 계약이 가정과 다르다 |
| 얕은 패스스루 없음 | 통과 | `renderContent` = 펜스 → SVG → HTML → 목차 → 계약 검사. 지우면 vite 페이지 빌드와 프리렌더 **둘**에 흩어진다(Deletion Test: scatter → 값을 한다) |
| 정보 은닉 깊이 | REVISE(A2) | 프리렌더 호출자가 "실패가 exit 0 으로 삼켜진다"는 내부 규칙을 알아야 안전하다 → 인자 주입 + `PartialSeoFailure` 로 닫는다 |
| Seam 현실성 | 통과 | 어댑터 1개짜리 새 인터페이스 없음 |
| 모듈 이름 | 통과 | `renderContent` · `SearchArchitecturePage` · `searchArchitecture.drift` — AI 접미사 없음. 새 `pages/tech/` 디렉토리는 `/tech` 페이지가 `pages/`(용어집)·`pages/atlas/` 에 흩어진 현상 위에 세 번째 자리를 만든다 — 허용하되 알고 둔다 |
| Deletion Test — `docs/architecture/search-overview.md`(3줄 포인터) | 통과(조건부) | ADR-0026:68 의 redirect 문서 형식에 맞는 포인터. 단 `search/docs/service.md:1-30` 이 이미 옛 상품 검색(Elasticsearch) 기준으로 낡아 있어 "검색 구조를 설명하는 곳"이 셋이 된다 — 범위 밖, 보고만 |

## 확인된 것 (발견 아님)

- 드리프트 게이트(SR-5)의 경로 방식은 선례가 있다: `src/seo/__tests__/attractionJsonLdGolden.test.ts:24` 가 `../../../../search/app/.../jsonld-golden.json` 을 읽고 `ci.yml:297-300` 이 그 위에 선다. `ci.yml:21-26` 에 path 필터가 없어 **search 만 바꾼 PR 에서도 frontend-gate 가 돈다** — 게이트가 의도한 자리에서 울린다. 대조 대상 5값은 모두 실재한다(`HybridSearchPipelineInitializer.kt:67`, `AttractionRankingProperties.kt:18-20`, `k8s/base/search/deployment.yaml:33-34`, `attractions-index.json:39,446,452-453`).
- 생성 JSON 을 페이지가 **직접 `import`** 하는 선택(SR-3.3)은 맞다. 아틀라스의 `import.meta.glob`(`useAtlasData.ts:12`)은 파일이 없을 때 조용히 빈 결과를 내므로 "조용히 빈 페이지 금지"와 반대다.
- `.fs-figure` 브레이크아웃 CSS 를 새 페이지 CSS 에 두 번째로 두는 것(SR-3.4)은 Rule of Three 안이다. [[msa-blog-diagram-breakout-record]] 의 실측(704 → 1,280)이 그 규칙의 근거이고, 세 번째 면이 생기면 그때 뽑는다.
- Q3 전제 정정: 작업 트리 `node_modules/fencesvg/package.json:3` 은 **0.11.2** 다(0.10.1 아님). 파이프 라벨 제한은 무해하지만 전제는 낡았다.

## 다른 차원에 넘길 것 (여기서 판정하지 않음)

- test-strategy: SR-6.1 `scripts/__tests__/renderContent.test.ts` 는 `vitest.config.ts:13` include(`src/**`, `tests/**`) 밖이라 **돌지 않는다**. `src/content/__tests__/` 로 옮기고 `../../../scripts/render-content.mjs` 를 import 하는 선례(`prerenderPlace.test.ts:15`)를 따른다.
- implementation: 드리프트 파서가 Kotlin 문자열 안 JSON(`"rank_constant": 60`)과 data class 기본값을 정규식으로 읽는 구조의 취약성.

1라운드 판정: REVISE

VERDICT: SHIP
