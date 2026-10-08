## 2라운드 (2026-10-08)

- 대상: 개정 `spec.md`(1라운드 심판 `context/review-verdict-round1.md` 반영본). 사용자 결정 ①~④와 심판 채택안은 재론하지 않았다.
- 코드 대조: `portal-fe/Dockerfile:41,54`, `.github/workflows/ci.yml:276-295`, `.github/workflows/images.yml:240,364`, `portal-fe/scripts/prerender-seo.mjs:148-156,238-247`, `portal-fe/package.json:8-9`, `portal-fe/src/pages/atlas/ConceptAtlasPage.tsx:15-16`.

### 1라운드 9건 해소 여부

| # | 1라운드 이슈 | 판정 | 근거 |
|---|---|---|---|
| 1 | 빌드 경로(Docker·CI 에 렌더 없음) | 해소 | `spec.md` SR-2.4 가 package.json(build·dev)·`Dockerfile:41`·ci.yml Type check 앞 세 곳을 `tsc -b` 보다 앞에 둔다. `Dockerfile:54` `ARG GIT_SHA` 를 :41 앞으로 올리는 것도 명시. 현행 `ci.yml:287-295` 순서(Type check → Test)라 렌더 스텝을 Type check 앞에 두면 vitest 도 생성물을 본다. SR-6.3 ⑩·⑪ 이 전제를 회귀 주입으로 확인한다 |
| 2 | 크롤러 예외(프리렌더 조용한 통과) | 해소 | SR-4.2 「없거나 형식이 다르거나 `html` 이 비면 `PartialSeoFailure`(exit 1)」. `prerender-seo.mjs:150-152` 가 이 타입만 exit 1 로 내므로 맞는 경로다. 전면 API 장애(:238 미발동)에도 `renderPortalPages`(:247)는 돌아 이 검사가 탄다. SR-4.4 에 「JSON 없이 호출하면 throw」 테스트 |
| 3 | 방문자 진입 NAV | 해소 | SR-3.1 이 `ConceptAtlasPage.tsx:14-17` NAV 한 줄을 유일한 예외로, Out of Scope 도 「아틀라스 NAV 한 줄 예외」. SR-6.1 「아틀라스 NAV 링크 1개」 |
| 4 | 「한눈에」 AC | 해소(단, 새 발견 N1) | SR-1.1 요약 불릿 5~6개(이름만, 값은 §4), SR-6.4 「1280×800 첫 화면에 요약 블록과 목차가 스크롤 없이」, SR-6.1 요약 블록 단언 |
| 5 | 390 시퀀스 가독성 | 해소 | SR-1.3 레인을 프로세스·저장소 6개로 제한, `QueryIntent` 는 `Note over`, `query_vectors` 는 OpenSearch 레인. SR-1.2 노드 12개 이하·5단 초과 TB. SR-6.4 그림별 `scrollWidth/clientWidth` 기록, 2.0 초과면 쪼갬 |
| 6 | 최신화 범위 명시 | 해소 | User Stories 운영자 줄, SR-1.6 「게이트가 잡는 것은 9값과 근거 파일 존재뿐이고, 그림·나머지 행·doc-index 연결은 사람이 고친다」. SR-5.2 구조 게이트(출처 주석·근거 열 파일 존재) |
| 7 | SHA 자동 | 해소 | SR-1.1 손 기입 금지, SR-2.2 `gitSha = process.env.GIT_SHA ?? 'dev'`. `images.yml:240,364` 가 `GIT_SHA=${GITHUB_SHA::7}` 를 portal-fe 에 넘기므로 SR-6.4 「배포 이미지 SHA 와 같음」 검사가 성립한다 |
| 8 | 파싱 실패 vs 값 불일치 메시지 | 해소 | SR-5.1 `toBeDefined('§4 표에서 {key} 행을 못 찾음')` 뒤 `toBe`. SR-6.3 ⑦ 이 회귀 주입으로 확인 |
| 9 | 범위 문구 | 해소 | Out of Scope·SR-1.5 마지막 행 모두 「**자체** 검색 면」 + 「통합 검색이 그 타입을 다루는 부분은 §3 에 포함」 |

### 새 발견

#### N1. 요약 불릿의 「§4 행 앵커」가 만들어지지 않는다 (C2·C4)

- 스펙: SR-1.1 「각 불릿은 §4 해당 행 앵커로 링크」. 이 링크가 「한눈에 → 자세히」 흐름의 유일한 연결이다.
- 그런데 SR-2.1 렌더러가 id 를 붙이는 것은 heading 뿐이다(`renderer: { heading, table, tablecell }` — tablecell 은 `th scope` 용). 표 행(`<tr>`)이나 셀에 id 를 붙이는 규칙이 없다. 게다가 heading id 에는 `idPrefix` 가 붙으므로, md 작성자가 `#rrf` 처럼 손으로 쓴 앵커는 접두사가 없어 어긋난다.
- 결과: 요약 불릿 5~6개가 전부 죽은 앵커가 된다. SR-2.3 ⑤ 는 `#` 로 시작하는지만 보고, SR-6.1 페이지 테스트는 **목차** 링크 수만 센다. 그래서 이 결함은 어느 게이트에도 안 걸린다.
- 수정안(둘 중 하나를 스펙에 적는다):
  - (a) 간단한 쪽: 불릿 링크 대상을 §4 **heading** 하나로 바꾼다. 행 단위 이동은 포기한다.
  - (b) 행 단위를 유지: tablecell(또는 tablerow) 렌더러가 `항목` 열 값의 slug + `idPrefix` 로 행 id 를 낸다. md 안 `#` 링크도 렌더러가 같은 `idPrefix` 를 앞에 붙여 고친다.
- 어느 쪽이든 SR-2.3 에 실패 조건 하나를 더한다. 「출력의 모든 `href="#x"` 에 대응하는 `id="x"` 가 있다」. 참/거짓이 스크립트로 나오므로 게이트에 맞다. SR-6.1 `renderContent.test.ts` 에 「없는 앵커 → throw」 한 건을 넣는다.

### 참고(이슈 아님)

- 새로 연 작업 트리에서 빌드 없이 `npx vitest run src/pages/tech` 를 돌리면 생성 JSON 이 없어 import 오류가 난다. `package.json:12` `test` 에는 렌더 단계가 없다. CI 는 렌더 → Type check → Test 순서라 영향이 없다. 구현자가 오진하지 않도록 SR-6.1 머리에 「먼저 `node scripts/render-content.mjs`」 한 줄을 두면 충분하다.

VERDICT: REVISE

---

# Engineer Review — usecase (1라운드)

- 대상: `docs/specs/2026-10-08-tech-search-architecture/spec.md` (+ `planning/initialization.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml`)
- 체크리스트: `~/.claude/plugins/cache/ai-common/hns/0.16.1/skills/spec-review/reviewers/usecase/checklist.md`
- 표준: `docs/standards/fe-visual-verification.md` · `docs/conventions/blog-diagram.md` · `docs/standards/doc-index-tracking.md`
- 지식베이스(`HNS_KB_PATH`, 볼트 `1989v`): `[[markdown-diagram-publishing-path]] (1989v, 2026-09-09)` — 「게이트에 붙인 것만 규칙」·그림 폭 breakout 근거. `[[msa-unified-search-plan-record]] (1989v, 2026-09-05)` — 당시 플랜은 모델 `e5-small` 이었으나 현행 코드는 `harrier-oss-v1-270m`(`k8s/base/search/deployment.yaml:33-34`). **레포가 이긴다** — 표의 값은 KB·플랜이 아니라 코드에서 읽는다(스펙 SR-1.5 「코드에서 읽은 그대로」와 일치).
- 사용자 결정 3건(새 경로 · 레포 원본 + 빌드 렌더 · 관광지 + 통합)은 재론하지 않았다. 아래는 그 결정 안에서의 흐름·전제·AC 결손이다.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | Actor-goal 쌍 | 부분 | 방문자·운영자·크롤러 셋이 `spec.md:12-14` 에 있다. 방문자의 **진입 흐름**이 없다(이슈 3) |
| 2 | 주/대안/예외 흐름 | 부분 | 렌더 실패 → 빌드 중단(`spec.md:30`) ✔. 드리프트 → CI 빨강(`spec.md:48`) ✔. **Docker·CI 에서 렌더 단계가 안 돈다**(이슈 1), **프리렌더 실패는 조용히 통과**(이슈 2) |
| 3 | 전제/사후 조건 | 부분 | 드리프트 테스트의 전제(레포 체크아웃)는 `spec.md:48` 에 명시 ✔. 생성 JSON 전제가 Docker·CI 에서 깨진다(이슈 1). 「기준 커밋 SHA」 사후조건이 게이트 밖(이슈 7) |
| 4 | AC 추적 가능 | 부분 | SR-1~5 ↔ SR-6 매핑은 된다. 요청의 두 속성 중 **「한눈에」에 측정 가능한 AC 가 없다**(이슈 4). 「작업시마다 최신화」는 5값 한정임을 페이지가 밝히지 않는다(이슈 6) |
| 5 | 엣지 케이스 | 부분 | fencesvg 판 차이(Q3)·금지 태그·빈 줄·SVG 0개·서브도메인 301(`nginx.conf:154`) ✔. 390px 시퀀스 가독성 미정(이슈 5), 파싱 실패 vs 값 불일치 미구분(이슈 8) |
| 6 | 테스트 전략 매핑 | 부분 | `planning/test-quality.md` 수준별 매핑 ✔. CI 전제(생성물)가 표에 없다(이슈 1) |

## 이슈

### 1. 생성물 미커밋 결정이 Docker 빌드·CI 게이트와 충돌한다 (C2·C3·C6) — 최우선

- 스펙: `spec.md:31` — `package.json` build 에 `node scripts/render-content.mjs` 를 넣고 `src/generated/search-architecture.json` 은 `.gitignore`(`context/open-questions.yml:5-6` Q1). `spec.md:37` — 페이지가 그 JSON 을 `import`. `planning/requirements.md:49` 최소 수정 목록은 `package.json build 1줄` 뿐.
- 코드: 이미지 빌드는 `npm run build` 를 쓰지 않는다 — `portal-fe/Dockerfile:41` `npx tsc -b --force && npx vite build --base / && node scripts/prerender-seo.mjs`. CI 도 같다 — `.github/workflows/ci.yml:289` `npx tsc -b --force`, `:295` `npx vitest run`. 세 곳 어디에도 렌더 단계가 없다.
- 결과: 생성물이 레포에 없으니 Docker 와 CI 에서 정적 import 는 `tsc -b`(TS2307)에서, `import.meta.glob` 방식(`src/pages/atlas/useAtlasData.ts:12` 선례)이면 `SearchArchitecturePage.test.tsx`·`prerenderTechSearch.test.ts` 가 런타임에서 깨진다. 어느 쪽이든 「운영자 주 흐름」(코드만 바꾼 PR 이 드리프트 빨강)이 아니라 **모든 PR 이 빨강**이 되고, 이미지는 안 구워진다. 아틀라스 `generated/graph.json` 은 커밋돼 있어서 같은 문제가 없다(`portal-fe/src/pages/atlas/generated/graph.json`).
- 수정안(스펙 결정 유지): SR-2.4 에 두 줄 추가 — `Dockerfile:41` 의 `tsc -b` 앞과 `ci.yml:287` Type check 앞에 `node scripts/render-content.mjs` 단계. `planning/requirements.md:49` 최소 수정 목록에 `Dockerfile 1줄 · ci.yml 1단계` 를 적는다(태스크 목표에 직접 필요한 변경이라 최소 수정 규칙에 맞다). SR-6.3 회귀 주입에 「JSON 을 지운 채 `npx tsc -b` → 빨강」을 넣어 전제가 지켜지는지 본다.
- 대안: Q1 을 다시 열어 아틀라스처럼 커밋하고 md→JSON 신선도 게이트(`AtlasGraphExportSpec` 선례)를 둔다. 빌드 설정을 안 건드리는 대신 PR diff 에 생성물이 섞인다. 어느 쪽이든 **스펙에 적혀야** 구현자가 고르지 않는다.

### 2. 크롤러 예외 흐름 — 프리렌더 실패가 조용히 통과한다 (C2)

- 스펙: `spec.md:30` 「조용히 빈 페이지가 나가지 않게 한다」는 렌더 단계만 막는다. `spec.md:43-44` 프리렌더 분기에는 실패 조건이 없다.
- 코드: `portal-fe/scripts/prerender-seo.mjs:149-156` — `PartialSeoFailure` 가 아닌 오류는 `console.warn` + `process.exit(0)` (「SPA 만 배포됩니다」). `Dockerfile:40` 주석도 「실패해도 빌드는 통과한다」. 그러면 `prerender/tech/search.html` 이 없고 `nginx.conf:153-157` 이 `index.html` 로 폴백 → 크롤러·llms 독자가 표·SVG 없는 셸을 받는다. 다른 페이지의 입력은 운영 API(일시 장애 허용이 맞다)지만 이 페이지의 입력은 **로컬 JSON** 이라 실패는 전부 결정적 결함이다.
- 수정안: SR-4.2 에 한 줄 — 「`/tech/search` 분기에서 생성 JSON 이 없거나 `html` 에 `<table`·`role="img"` 가 없으면 `PartialSeoFailure` 를 던진다(exit 1)」. `prerenderTechSearch.test.ts` 에 그 경우 throw 를 한 건 추가.

### 3. 방문자의 진입 흐름이 없다 (C1·C2)

- 스펙: `spec.md:12` 방문자가 「5분 안에 파악하고 싶다」. 그러나 `spec.md:35` 「기존 /tech 화면 변경 0」, `spec.md:69` 「기존 `/tech` 아틀라스·용어집 변경」 범위 밖. SR-3.2 의 NAV 는 **이 페이지 안**의 링크다.
- 코드: `portal-fe/src/pages/atlas/ConceptAtlasPage.tsx:14-17` NAV 는 「아틀라스 · 홈」뿐. `TechGlossaryPage.tsx:68-70` 크럼도 `/tech` 만. 홈 런처 타일은 DB `display_service` 행(루트 `CLAUDE.md` Frontend 표)이라 코드 링크가 없다. 크롤러는 `prerender-seo.mjs:1588-1590` 가 `PORTAL_PAGES` 전체를 `<nav>` 로 찍어 자동으로 길이 생기지만, 그 본문은 하이드레이션 뒤 사라져 사람에게는 안 보인다.
- 수정안: Out of Scope 를 「아틀라스 NAV 한 줄(`ConceptAtlasPage.tsx:14-17` 에 `{ label: '검색 아키텍처', href: '/tech/search' }`)은 예외」로 고친다. 홈 타일은 만들지 않는다 — IT 하위 페이지이고 `display_service` 행을 늘릴 이유가 없다. SR-6.1 페이지 테스트에 「아틀라스에서 링크 1개」를 넣는다.

### 4. 「한눈에」에 측정 가능한 AC 가 없다 (C4)

- 요청 원문 `planning/initialization.md:3` 「한눈에 파악가능한 페이지」. 스펙이 주는 것은 `spec.md:19` 「한 줄 요약」과 `spec.md:37` 목차뿐이고, 본문은 그림 5장 + 16행 표라 데스크톱에서도 여러 화면이다. 목차는 **찾아가는** 장치지 **한눈에 보는** 장치가 아니다.
- 수정안: SR-1.1 에 「요약 블록」 — 제목 바로 아래 5~6 불릿(기법 이름 + 현재 값 한 토막, 각 불릿은 §4 해당 행 앵커). 예: 「형태소 nori + 사용자 사전 N줄 · 하이브리드 BM25+HNSW → RRF(60) · 쿼리 언더스탠딩(BM25 레그) · 질의 벡터 캐시 · 분류 가중치 3.0/0.35 · 일일 nDCG@10 평가」. 값은 §4 와 같은 셀 규칙으로 써서 드리프트 파서가 **요약 블록도 같이** 읽게 하면 둘이 어긋나지 않는다. AC(SR-6.4): 1280×800 첫 화면에 요약 블록과 목차가 스크롤 없이 들어온다(`getBoundingClientRect().bottom <= innerHeight`).

### 5. 모바일(390px) 시퀀스 다이어그램 가독성이 미정이다 (C5)

- 스펙: `spec.md:21` 시퀀스 ①의 참여자가 브라우저·gateway·search:app·QueryIntent·BM25 레그·`query_vectors`·search-embed·Redis 로 **8개**. `spec.md:38` 가로 스크롤만 정한다. `spec.md:56` 검사는 `scrollWidth <= innerWidth`(페이지 넘침)뿐이라 그림이 세 화면 폭이어도 초록이다.
- 코드·표준: fencesvg 는 SVG 에 `style="min-width:${u}px;max-width:100%"` 를 박는다(`portal-fe/node_modules/fencesvg/dist/index.js:3`) — 축소가 아니라 스크롤이다. `docs/conventions/blog-diagram.md:67-70` 「LR 5단 넘으면 TB」·「라벨 짧게」.
- 수정안: SR-1.3 에 참여자 상한 6 — `QueryIntent` 는 프로세스 안이라 `Note over search:app`, `query_vectors` 는 OpenSearch 레인에 합친다. SR-1.2 flowchart 는 5단을 넘으면 TB. SR-6.4 에 390px 에서 그림별 `scrollWidth / clientWidth` 를 기록하고 2.0 을 넘으면 그림을 쪼갠다. 수치는 측정값으로 남긴다(`docs/standards/fe-visual-verification.md:7`).

### 6. 「작업시마다 최신화」의 범위를 페이지가 밝혀야 한다 (C2·C4)

- 스펙: `spec.md:24` 「드리프트 게이트가 잡는 값 5개를 나열한다」. 그 5값 외의 11행과 **그림(흐름)**은 게이트가 없다. 사용자 결정 ②(`planning/initialization.md:5`)의 「doc-index 게이트」는 현재 CI 차단이 **대기**다(`docs/standards/doc-index-tracking.md:55,67`, `planning/requirements.md:18`). 게이트가 확인된 것은 `.github/workflows/ci.yml:21-26`(경로 필터 없음) 덕에 `search/` 만 바뀐 PR 에서도 vitest 가 돌아 5값 드리프트는 **성립**한다.
- 수정안 두 줄: (a) SR-1.6 에 명시 — 「게이트가 잡는 것은 이 5값뿐이다. 흐름(그림)·나머지 행·doc-index 연결은 사람이 고친다」. 정직하게 적는 것이 「전부 자동」으로 읽히는 것보다 낫다(`[[markdown-diagram-publishing-path]]` 의 「게이트에 붙인 것만 규칙」). (b) 값싼 구조 게이트 추가 — 드리프트 테스트가 머리 `<!-- source: -->` 경로와 §4 「근거」 열의 `file` 존재를 검사한다. 파일 이동·삭제는 흐름 변경의 흔한 동반 신호고, 참/거짓이 스크립트로 나오므로 게이트에 맞다.

### 7. 「기준 커밋 SHA」 손 기입은 게이트 밖이라 옛 값이 남는다 (C3)

- 스펙: `spec.md:19` 「기준: origin/main 커밋 짧은 SHA · 갱신일」, `spec.md:56` 「기준 커밋 SHA 가 화면에 보인다」. 5값은 게이트가 지키지만 SHA 는 안 지킨다 — 값은 최신인데 SHA 는 석 달 전이면 독자가 「오래됐다」고 읽거나 반대로 옛 SHA 를 믿는다.
- 코드: `portal-fe/Dockerfile:54` `ARG GIT_SHA` 가 이미 빌드에 들어온다.
- 수정안: SR-2.2 의 JSON 에 `builtAt`(`process.env.GIT_SHA`, 없으면 `dev`)을 넣어 render 스크립트가 자동 스탬프하고, 손 기입은 「문서 갱신일」만 남긴다. 화면 표기는 「빌드 커밋 abc1234 · 문서 갱신 2026-10-08」.

### 8. 드리프트 실패 메시지 — 파싱 실패와 값 불일치를 구분 (C5, 작은 것)

- `spec.md:49` 파서 규칙을 머리에 적는 것까지는 있다. 표 형식이 깨지면 「값 불일치」로 보이게 하지 말고 「§4 표에서 `rank_constant` 행을 못 찾음」으로 실패해야 운영자가 문서 형식을 고칠지 값을 고칠지 바로 안다.

### 9. 범위 밖 문구 (C1, 작은 것)

- `spec.md:68` 「코드사전·블로그·혜택·랭킹·상품 검색 면」은 사용자 결정 ③과 일치한다. 다만 §3 통합 검색이 그 타입들을 `unified` 색인으로 다루므로(`spec.md:22`) 「**자체** 검색 면(코드사전 OpenSearch 검색·블로그 검색 등)은 범위 밖, 통합 검색이 그 타입을 다루는 부분은 §3 에 포함」으로 한 단어 보태면 헷갈리지 않는다.

## 확인된 것(이슈 아님)

- 라우트 순서 `/tech/search` → `/tech/:category` 앞(`App.tsx:233`), nginx `^/tech/([a-z][a-z-]*)$` → `prerender/tech/search.html`(`nginx.conf:153-157`), `techCategoryFromSlug('search')` 가 null 이라 용어집과 충돌 없음.
- 드리프트 5값의 코드 위치 존재: `HybridSearchPipelineInitializer.kt:67` `rank_constant 60`, `search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionRankingProperties.kt`(스펙은 경로를 `...` 로 생략 — SR-5.1 에 전체 경로를 적을 것), `k8s/base/search/deployment.yaml:33-34`, `attractions-index.json:39,446,452-453`.
- `PORTAL_PAGES` 추가의 부수 효과: `copy.test.ts:165` 정확 배열(스펙 반영 ✔)과 모든 포털 프리렌더의 `<nav>` 에 링크 추가(`prerender-seo.mjs:1588-1590`) — 크롤러 발견 경로로는 이득.
- 프리렌더 테스트 선례(`prerenderPlace.test.ts:2-15`)는 스크립트를 import 만 하고 네트워크를 안 친다 — 이 페이지 분기도 같은 방식으로 dry-verify 가능.

VERDICT: REVISE
