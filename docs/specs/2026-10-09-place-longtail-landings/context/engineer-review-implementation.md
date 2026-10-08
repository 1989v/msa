# Engineer Review — implementation (1라운드)

스펙: `docs/specs/2026-10-09-place-longtail-landings/spec.md`
체크리스트: hns 0.15.1 `reviewers/implementation/checklist.md`

## 참조 실재 확인 (체크: Referenced classes/modules exist)
`spec.md:36` 의 인용은 전부 실재한다 — `prerender-seo.mjs:707-727`(sitemap 지역 항목)·`1159-1249`(지역 상세), `nginx.conf:232-235`(지역 location), `App.tsx:296-303`, `RegionPage.tsx:116`, `PlacePage.tsx:330-348`, `AttractionSearchController.kt:44-74`, `SearchAttractionUseCase.kt:202-213`, `place/feature/.../AdministrativeRegionController.kt`, `copy.mjs:541-547`, `placeAttributes.ts:37-58`. 통과.

## Findings

### I1. 편집 페이지는 nginx location 이 없어 프리렌더가 나가지 않는다 (체크: Conflicts with existing code) — 중요
- 스펙: `/guides/{slug}` 프리렌더(`spec.md:25`), 배포 뒤 "편집 초안 3장 200·noindex"(`spec.md:33`).
- 코드: `/guides/...` 를 받는 location 이 없어 `location /` 의 `try_files $uri /index.html` 로 떨어진다(`nginx.conf:331-332`). `$uri`=`/guides/x` 파일이 없으니 **SPA 셸**이 나가고 `prerender/guides/x.html` 은 영영 안 읽힌다.
- 수정안: SR-3 에 location 추가를 명시 — 예 `location ~ ^/guides/([a-z0-9][a-z0-9-]*)$ { … try_files /prerender/guides/$1.html =404; }`(없는 slug 는 404, 랜딩과 같은 규칙), `/guides` 는 SR-3.4 결정에 맞춰 404 또는 프리렌더. `X-Robots-Tag $host_robots_tag` 헤더 줄도 기존 블록처럼 넣는다.

### I2. 편집 페이지 SPA 라우트가 없어 JS 실행 뒤 NotFound(noindex)로 바뀐다 — 중요
- 스펙 SR-3 은 프리렌더만 다루고 React 라우트를 정하지 않았다(`spec.md:24-28`).
- 코드: 매칭 라우트가 없으면 `NotFoundPage` 가 그려지고 그것이 noindex 로 상태 코드를 대신한다(`App.tsx:334-338`). 렌더링 크롤러는 published 편집 페이지를 noindex 로 읽는다.
- 수정안: `/guides/:slug` 라우트(placeRoute 래핑)와 화면을 SR-3 에 넣고, 본문은 render-content 산출 JSON, 카드는 런타임 `GET /api/search/attractions/{id}`(`AttractionSearchController.kt:107`)로 그린다고 적는다. draft 띠·noindex 를 SPA 도 같은 머리말 값으로 낸다.

### I3. 랜딩 조회 실패가 부분 실패 가드 밖이다 (체크: NFR — 실패 모드)
- 코드: 일부 섹션만 실패하면 빌드를 세워 직전 이미지를 지킨다(`prerender-seo.mjs:139-150,241-250`). 반대로 가드 밖의 섹션은 조용히 비워진다(랭킹 선례 `prerender-seo.mjs:230-239`).
- 스펙은 facets 조회 실패 시 동작을 적지 않았다(`spec.md:13`). 가드 밖이면 일시 장애 한 번에 **색인된 랜딩 전부가 404**가 된 이미지가 배포된다(SR-1.5 의 `=404`).
- 수정안: 랜딩 조회를 `fetched/failed` 가드 안에 넣는다고 명시. 시군구 하나 조회 실패도 그 시군구 랜딩이 사라지므로 섹션 실패로 친다.

### I4. 빌드마다 다시 뽑으면 색인된 주소가 사라지고, 검수 안 된 주소가 생긴다 (체크: Migration/rollback, Complexity risk)
- 스펙: 대상 선정을 빌드 때 매번 한다(`spec.md:13`), 뽑히지 않으면 404(`spec.md:16`).
- 계획: S3-2 는 랜딩마다 「조건 정확성·목록 중복도·질의별 고유 설명」 검수를 요구하고(`work-plan.md:94`), D-2 는 "설계 기준이지 보장이 아니므로 검수 항목을 더한다"(`work-plan.md:50`).
- 건수가 10 경계를 오가거나 순위 5위 경계가 바뀌면 빌드마다 주소가 생기고 사라진다. 2~4주 색인률 측정(`work-plan.md:94`) 기간에 404 가 섞이고, 새로 뽑힌 주소는 검수 없이 sitemap 에 오른다.
- 수정안(KISS): 선정 결과를 레포에 커밋한 목록(`portal-fe/src/content/landings.json` 등)으로 고정하고, 빌드는 ① 목록의 각 항목이 아직 10건 이상인지 확인 ② 미달이면 빌드 실패(또는 그 항목만 noindex 로 남기고 경고) 만 한다. 선정 함수는 목록 갱신용 스크립트로 같은 코드를 쓴다. 최소한 「빠진 주소를 404 대신 지역 페이지로 301」 같은 이탈 정책을 적는다.

### I5. 상한 산술이 모호하다 (체크: arithmetic-verification)
- 스펙: "속성마다 최대 5장, 전체 최대 20장"(`spec.md:13`), 영문은 2속성(`spec.md:12`).
- 국문만 보면 4 × 5 = 20 이라 「전체 20」 상한은 절대 물리지 않는다. 국·영 합산이면 20 + 10 = 30 이 가능해 상한이 물리는데, 그때 국·영 사이 정렬 규칙(어느 언어를 먼저 자르나)이 없다.
- 그래서 SR-4.2 의 「상한 제거」 회귀 주입은 언어별 해석이면 빨강이 날 수 없다.
- 수정안: 「언어별 속성당 5, 국·영 합산 전체 20, 합산 정렬은 건수 내림차순 → 언어(ko 먼저) → 코드 오름차순」처럼 하나로 정하고, 테스트가 실제로 상한에 닿는 픽스처(국 20 + 영 10 후보)를 쓴다고 적는다.

### I6. 날짜·lastmod 의 계산 범위가 모호하다 (체크: Complexity risk)
- 스펙: 집계 문장 「원천 갱신 기준 {날짜}」(`spec.md:14`), lastmod = "결과 중 원천 수정일의 최댓값"(`spec.md:17`). 목록은 최대 30건(`spec.md:14`).
- N 이 30 을 넘으면 「결과」가 화면의 30건인지 N 전체인지에 따라 값이 다르다. 전체면 `sort` 로 최신 1건을 따로 받거나 전 페이지를 받아야 한다.
- 수정안: 「표시된 30건의 `modifiedAt` 최댓값」으로 한정하거나, 최신순 1건 조회를 추가한다고 명시. 날짜 문장과 lastmod 가 같은 값임도 적는다(`indexDoc` 의 "빌드일로 대신 적지 않는다" 규칙, `prerender-seo.mjs:1015-1017`).

### I7. 프리셋이 첫 진입 자동 선택과 경쟁한다 (체크: Concurrency safety — 화면 상태)
- 코드: 시도가 비어 있으면 좌표·기본 서울로 자동 선택하고 trigger 를 `initial` 로 쓴다(`PlacePage.tsx:623-643`). 지금 허브 첫 진입은 `landing` → `initial` 두 SEARCH 를 낸다(`PlacePage.tracking.test.tsx:103,167-169`).
- 프리셋을 effect 로 늦게 넣으면 자동 선택이 먼저 돌아 서울로 덮이거나 `initial` 이 한 번 더 나간다.
- 수정안: 프리셋은 `useState` 초기값으로 넣고 `autoPickedRef` 를 true 로 시작한다고 SR-2.1 에 명시(architecture A3 와 같은 내용).

### I8. SPA 「10건 미만」 분기가 프리렌더와 충돌한다 (체크: Conflicts)
- 스펙: SPA 에서 결과가 10건 미만이면 안내 + noindex(`spec.md:16`), 동시에 canonical 은 랜딩 주소 고정(`spec.md:22`).
- 뽑힌 랜딩은 빌드 뒤 데이터가 줄면 프리렌더(색인 가능)와 렌더링 결과(noindex)가 갈린다. 뽑히지 않은 주소는 nginx 가 404 라 SPA 분기에 도달하는 경로는 클라이언트 내비게이션뿐인데, 그런 링크는 SR-1.3 이 만들지 않는다.
- 수정안: SPA 는 빌드 목록(I4 의 커밋 목록을 번들에 포함)으로 「뽑힌 랜딩인가」만 판정하고 런타임 건수로 noindex 를 바꾸지 않는다. 런타임 건수가 줄면 문장만 실제 N 으로 보인다.

### I9. 메타(title·description) 함수가 정의되지 않았다
- 스펙은 h1·집계 문장 함수만 copy.mjs 에 둔다(`spec.md:21`). 지역 페이지는 `regionMeta` 가 title·description·heading 을 한 번에 낸다(`copy.mjs:469-491`).
- 수정안: `landingMeta(lang, region, attr, counts)` 하나가 title·description·heading·문장을 내고 프리렌더·SPA 가 같이 쓴다고 적는다. 영문 문장 형식도 함께.

## 통과 항목
- NFR(호출 수): 시군구 약 250 × 2언어 facets 1회 + 랜딩 ≤ 30 목록 조회. 기존 관광지 열거가 이미 시도 16 × 최대 100쪽 × 2언어를 부르므로(`prerender-seo.mjs:975-990,1070-1094`) 규모상 문제없다. timeout 15초(`prerender-seo.mjs:308`) 재사용.
- `/regions/{code}/{attr}` 는 기존 지역 정규식(`nginx.conf:232`, 세그먼트 하나)과 옛 광주·전남 리다이렉트(`nginx.conf:224`, `$` 고정)에 걸리지 않아 새 location 의 순서 충돌 없음.

VERDICT: REVISE
