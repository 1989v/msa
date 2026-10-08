# spec-review 2라운드 — place 롱테일 속성 랜딩 + 편집 페이지

범위는 `review-verdict-round1.md` §5 「볼 것」이다. 1라운드에서 판정된 33건은 다시 열지 않았고, 아래는 E1~E7 반영본에서 **새로 생긴 결함**만 적었다.

| 차원 | 판정 | 새 결함 |
|---|---|---|
| architecture | REVISE | 1 |
| domain | REVISE | 2 |
| implementation | REVISE | 4 |
| security | REVISE | 2 |
| test-strategy | REVISE | 3 |
| usecase | REVISE | 2 |

---

## architecture — REVISE

§5 확인 결과
- 스위치를 읽는 곳이 하나인지: 충족. SPA 도 `copy.mjs` 를 직접 import 한다(`portal-fe/src/components/ads/AdSlot.tsx:2`, `src/App.tsx:4`). 그래서 상수 하나를 프리렌더와 SPA 가 함께 볼 수 있다.
- 경계 문장과 계약 테스트의 충돌: 없음. `render-content.mjs` 의 `renderContent` 는 순수 함수다(`render-content.mjs:72-142`). 파일 입출력은 `main()`(`:184-194`)에만 있어서, 소스 목록으로 일반화해도 `search-architecture` 출력은 그대로 유지할 수 있다.

**AR2-1. 「상수 하나」가 놓일 자리가 node 스크립트에서 닿지 않는다**
- 스펙: SR-4(`spec.md:78`)는 「수치·키(… 슬러그 표 · SIGHT_CATEGORIES)는 상수 하나에서 나온다」고 하고, SR-1.2(`spec.md:30`)는 선정·집계·목록이 모두 `SIGHT_CATEGORIES` 를 건다고 한다.
- 코드: `SIGHT_CATEGORIES` 는 TS 파일 `portal-fe/src/api/placeApi.ts:332` 에 있다. 칩 id 도 TS 파일 `placeAttributes.ts:26-56` 에 있다. 반면 선정 스크립트와 `prerender-seo.mjs` 는 plain node 로 돈다(`package.json:9` `node scripts/prerender-seo.mjs`). 프리렌더는 지금도 분류 목록을 따로 들고 있다(`prerender-seo.mjs:1029`).
- 이대로 구현하면 node 쪽이 사본을 하나 더 만들게 되고, SR-1.2 의 「프리렌더 N 과 SPA N 이 같은 질의」가 사본 두 벌에 기대게 된다.
- 수정: SR-1.1 슬러그 표와 `SIGHT_CATEGORIES` 를 `copy.mjs`(또는 다른 `.mjs`)로 옮긴다. `placeApi.ts`·`placeAttributes.ts` 는 거기서 re-export 한다고 SR-4 에 한 줄 적는다.

## domain — REVISE

**D2-1. `barrier-free` 의 이름 「휠체어 이용」이 센 값보다 넓다**
- 스펙: `spec.md:26` 의 행 `barrierFree=WHEELCHAIR` → 국문 이름 「휠체어 이용」이고, h1·title 이 「… 휠체어 이용 관광지」가 된다.
- 코드·근거: 원천 키 `wheelchair` 의 표시명은 「휠체어」다(`search/domain/.../AttractionAccessibility.kt:24,51`, 칩 `placeAttributes.ts:53`). 라벨 검수 표본 원문 대부분은 「휠체어 대여가능」「휠체어 있음」이다(`docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-barrierfree-labels.md:43-55`). 즉 이 값은 「휠체어를 빌릴 수 있다」에 가깝고, 「휠체어로 이용할 수 있다(접근성)」를 보증하지 않는다.
- 랜딩 제목이 접근 가능을 약속하면 1라운드 D1 이 막으려던 「이름 ≠ 센 값」이 다시 생긴다.
- 수정: 국문 이름을 「휠체어 대여」로 바꾼다. 「휠체어」로 두려면 칩 라벨과 같게 쓴다. Q2 권고 문구도 같이 고친다.

**D2-2. N 의 출처가 「facet」이면 건수가 없을 때가 정상 경로다**
- 스펙: SR-2.3(`spec.md:52`)은 「숫자는 프리셋 첫 결과의 facet 응답」, SR-2.5(`:54`)는 「N < 하한이면 noindex」다.
- 코드: 건수는 시간 초과·실패 시 `null` 로 떨어지고 결과는 그대로 200 이다(`AttractionSearchAdapter.kt:191-205`, `SearchAttractionUseCase.kt:194-195`). JS 에서는 `undefined < 10` 이 `false` 라 스위치를 켠 뒤 noindex 가 풀린다.
- 랜딩 질의에는 이미 속성 필터가 걸려 있다. 그래서 `totalElements` 가 곧 N 이고, 이 값은 null 이 될 수 없다.
- 수정: N 을 「필터 질의의 `totalElements`」로 정의한다(I2-3 과 같은 결정).

## implementation — REVISE

§5 확인 결과
- 20 상한이 실제로 걸리는가: 걸린다. 국문 4속성 × 5 + 영문 2속성 × 5 = 30 > 20 이다.
- location 순서: 문제 없음. 새 정규식 `^/(en/)?regions/([^/]+)/([^/]+)$` 은 경로 세그먼트가 둘이다. 그래서 legacy `nginx.conf:224`, 지역 `:232`(세그먼트 하나, `/` 불허)와 겹치지 않는다. `.html` 접미 요청도 앞에서 이 location 이 잡아 404 를 낸다.
- `--body-only`: 최소 범위다. `lint()`(`lint-blog-post.py:381`)의 `check_frontmatter` 호출 하나만 건너뛰면 되고, 인자는 `main()`(`:390-392`)에 하나 더하면 된다.

**I2-1. 프리셋 `sigunguCode` 의 자릿수가 정해지지 않았다**
- 스펙: SR-1.3 항목은 `code`(5자리)·`sidoCode` 를 쓰고(`spec.md:37`), SR-2.1 은 `preset={{ sidoCode, sigunguCode, … }}` 다(`:50`).
- 코드: 허브 상태와 API 의 `sigunguCode` 는 **3자리**다(`PlacePage.tsx:569` `r.code.slice(2) === sigunguCode`, `RegionPage.tsx:116` `sigunguCode: code.slice(2)`). 5자리를 그대로 넣으면 0건이 나오고 화면은 「결과 없음」이 된다. `screenRef` 도 시도 코드가 두 번 붙는다(`PlacePage.tsx:423`).
- 수정: SR-2.1 에 `sigunguCode: code.slice(2)` 를 명시한다. 프리렌더·선정 질의에도 같은 규칙을 적는다.

**I2-2. `selectLandings` 의 입력으로는 Jaccard 를 셀 수 없다**
- 스펙: 시그니처는 `selectLandings(facetsBySigungu, regions)` 다(`spec.md:31`). 그런데 중복도 규칙은 「표시 목록(30건) id 의 Jaccard」다(`:36`).
- facet 에는 id 가 없다(`SearchAttractionUseCase.kt:202-212`).
- 수정: 입력에 `idsByCandidate`((lang, code, attr) → 상위 30 id)를 추가한다. 스크립트가 후보마다 목록 1회를 조회한다는 것도 적는다. 순수 함수 테스트(`spec.md:89`)도 이 입력을 픽스처로 받는다.

**I2-3. SPA 는 「전체 {M}곳」을 얻을 질의가 없다**
- 스펙: sentence 는 「… {N}곳(전체 {M}곳 중)」이다(`spec.md:40`). SPA 숫자는 「프리셋 첫 결과의 facet 응답」에서 온다(`:52`). 테스트는 SPA 와 프리렌더의 sentence 가 같기를 요구한다(`:113`).
- 코드: 각 facet 건수는 「자기 속성 선택만 빼고」 센다(`AttractionSearchAdapter.kt:212,223`). 그래서 속성 하나만 고른 랜딩에서 `parking.YES` 는 N 이고, 속성을 뺀 전체 M 은 응답 어디에도 없다.
- 수정 안 둘 중 하나를 고른다.
  - ⓐ M 을 빼고 N 만 쓴다.
  - ⓑ M 을 빌드 시점 값으로 `place-landings.json`(`total`)에서 읽는다고 명시하고, 그 값의 날짜 기준을 문장에 반영한다.
- 어느 쪽이든 N 은 D2-2 대로 `totalElements` 다.

**I2-4. 초안 구조가 F8 을 통과하지 못한다 (MINOR)**
- `--body-only` 에서도 F8 「첫 h2 앞 요약 표 또는 목록 2항목」은 그대로 돈다(`lint-blog-post.py:339-365`). 그런데 SR-3.6 의 장 구성(`spec.md:68`)에는 요약이 없다.
- 수정: 「첫 h2 앞에 요약 표(후보·핵심 조건)」를 장 구성 맨 앞에 넣는다.

## security — REVISE

§5 확인 결과
- 카드 치환은 render-content `check()`(`render-content.mjs:140,144-182`) **뒤**에 일어난다. 그래서 카드 HTML 은 금지 태그·이벤트 속성·URL 검사를 거치지 않는다.
- 프리렌더 쪽은 SR-3.2 의 「고정 템플릿 + 평문화 + `escapeHtml`」로 막혀 있다.

**S2-1. SPA 의 카드 주입 방식이 정해지지 않았다**
- 스펙: 「SPA 는 같은 JSON 과 같은 엔드포인트로 런타임에 그린다」뿐이다(`spec.md:63`).
- 선례 화면은 생성 HTML 을 `dangerouslySetInnerHTML` 로 넣는다(`SearchArchitecturePage.tsx:50,62`). 같은 방식으로 표지 자리에 API 문자열을 이어 붙이면, 외부 원천(TourAPI) 값이 이스케이프 없이 DOM 에 들어간다.
- 수정: SR-3.2 에 다음 중 하나를 적는다.
  - 「SPA 는 HTML 을 표지 기준으로 나눠 카드는 React 요소로 그린다(문자열 결합 금지)」
  - 또는 「SPA 도 같은 `escapeHtml` 템플릿 함수를 쓴다」
- SR-5.1 「카드 이스케이프」(`:105`)도 SPA 경우를 포함하도록 고친다.

**S2-2. 표지 id 형식 검증이 없다 (MINOR)**
- `data-guide-card="{id}"`(`spec.md:61`)의 값이 그대로 `GET /api/search/attractions/{id}` 경로가 된다(`:62`). 그런데 `check()` 는 `data-*` 속성을 보지 않는다(`render-content.mjs:144-182`).
- 수정: render-content 가 표지 값을 `^[0-9]{1,12}$` 로 검사하게 한다. 형식은 nginx 상세 id 규칙 `nginx.conf:192` 와 같게 둔다. 머리말 `attractionIds` 와 본문 표지 집합이 같은지도 같은 단계에서 확인한다(두 원본이 어긋나지 않게).

## test-strategy — REVISE

**T2-1. 「하한 10→9」 주입은 SR-4 방식에서 빨강이 안 날 수 있다**
- SR-4(`spec.md:78`)는 테스트가 「그 상수와 대상 함수의 출력으로 기대값을 계산」하라고 한다. 상수 `PLACE_LANDING_MIN_RESULTS` 를 9 로 바꾸면 경계 테스트(`:83` 「9 제외·10 포함」)도 `MIN-1`/`MIN` 으로 따라 움직여 초록이 된다. 검사가 자기 값을 재는 꼴이다.
- 수정 안 둘 중 하나를 고른다.
  - ⓐ 결정값 고정 단언 `expect(PLACE_LANDING_MIN_RESULTS).toBe(10)` 을 한 줄 둔다. 같은 방식으로 5·20·0.5 도 고정한다.
  - ⓑ 주입 위치를 「비교 연산자 `>=` → `>`」로 바꾼다.
- SR-4 의 「문장을 다시 조립하지 않는다」와 「결정 수치를 고정한다」는 다른 것이라고 구분해 적는다.

**T2-2. 「랜딩 location 을 지역 location 뒤로 이동」은 무동작 주입이다**
- 두 정규식은 세그먼트 수가 달라 겹치지 않는다(`nginx.conf:232` vs SR-1.6 `spec.md:44`). 그래서 순서를 바꿔도 결과가 같고 빨강이 나지 않는다.
- 수정: 이 항목(`spec.md:130`)을 「랜딩 location 삭제」로 바꾼다. 그러면 `location /`(`nginx.conf:331`)가 받아 `/regions/11110/foo` 에 200 이 나가므로 빨강이 난다. 순서 의존이 실제로 있는 곳은 legacy 301(`:224`)과 지역(`:232`)인데, 이것은 기존 `/regions/29110` 301 단언이 이미 본다.

**T2-3. nginx 계약 스크립트를 돌리는 시점이 없다 (MINOR)**
- 선례 두 스크립트는 CI·훅 어디에서도 호출되지 않는다. 레포 grep 결과 문서에만 등장한다.
- SR-5.2(`spec.md:116`)는 「도커가 없으면 exit 2」만 정했다. 그래서 주입 6·7 항목의 빨강은 사람이 직접 돌릴 때만 성립한다.
- 수정: 「태스크 검증 단계에서 수동 실행, 출력 전문을 `verifications/` 에 남김, exit 2 는 통과로 세지 않음」을 명시한다.
- (부기) `spec.md:85` 「국 20 + 영 10 후보에서 20, ko 먼저」는 1차 정렬이 건수라서, 건수가 같은 픽스처일 때만 「ko 먼저」가 성립한다. 픽스처 조건을 적는다.

## usecase — REVISE

§5 확인 결과
- 철회 경로(스위치 false → noindex, `adr-0062-amendment-draft.md:17`)와 편집 게시 끝점(`spec.md:70-75`)은 정의돼 있다.

**U2-1. 선정 스크립트를 다시 돌리면 색인된 주소가 404 가 된다**
- 스펙은 빌드 미달에 대해 「404 로 지우지 않는다 — 이미 색인된 주소를 빌드 사이에 없애지 않는다」고 정했다(`spec.md:45`). ADR 초안도 「주소는 noindex 로 남겨 404 를 만들지 않는다」고 한다(`adr-0062-amendment-draft.md:17`).
- 그런데 목록 갱신은 「스크립트를 다시 돌려 커밋」이다(`spec.md:45`). 스크립트는 지금 조건으로 처음부터 다시 뽑는다(`:31-37`). 이전 목록에 있던 항목이 빠지면 파일이 없어져 nginx 가 404 를 낸다(`:44`). 같은 원칙이 스크립트 경로에서 깨진다.
- 수정: 스크립트는 기존 항목을 지우지 않는다. 빠진 항목에 `retired: true` 를 달고 페이지는 noindex·sitemap 제외로 계속 만든다. 상한 20 은 `retired` 가 아닌 항목만 센다. SR-5.1 선정 테스트에 「기존 항목 유지」를 한 줄 더한다.

**U2-2. 게시된 편집 페이지의 관광지가 원천에서 사라지면 portal-fe 전체 배포가 막힌다**
- SR-3.2 는 「published 는 빌드를 실패시킨다」고 한다(`spec.md:64`). 관광지 삭제는 원천(TourAPI) 쪽 사건이고, portal-fe 이미지 하나에 apex·place·blog·game 등 전 호스트가 실려 있다.
- 복구 절차가 없으면 무관한 FE 변경까지 그 사이에 배포되지 못한다(Argo 는 직전 이미지 유지 — `render-content.mjs:7-8` 의 전제).
- 수정: SR-3.8 게시 절차에 「빌드 실패 메시지는 파일·id 를 이름으로 낸다. 복구는 해당 id 를 빼거나 `status: draft` 로 되돌리는 커밋」을 적는다.

VERDICT: REVISE
