# 회귀 주입 — TG1~TG3 (portal-fe 프리렌더 · nginx)

2026-10-11. 워크트리 밖 임시 사본(스크래치패드 `rg/portal-fe`, node_modules 는 심링크)에서 한 번에 하나씩 주입하고 해당 테스트만 돌렸다. 주입은 모두 컴파일되는 코드 변경이다(구문 오류 아님). 주입 뒤 사본은 원본으로 되돌렸다.

명령: `npx vitest run src/seo/__tests__/prerenderPlace.test.ts src/seo/__tests__/prerenderPlaceLandings.test.ts src/seo/__tests__/prerenderGuides.test.ts src/seo/__tests__/prerenderPortalHome.test.ts` (주입 전 기준선 `Tests  94 passed (94)`)

TG4 항목(서비스 언어 비교 생략 · SPA Navigate 제거 · 언어 정규화 생략 · 301 Cache-Control 누락 · 301→302 · Location 에 호스트)은 TG4 범위라 여기서 하지 않았다.

## 프리렌더 (scripts/prerender-seo.mjs)

### 티어 A 분류 조건 제거

- 바꾼 줄: `return SIGHT_CATEGORIES.includes(doc.category) && Boolean(doc.imageUrl?.trim()) && doc.hasGooglePlaceId === true;` → `return Boolean(doc.imageUrl?.trim()) && doc.hasGooglePlaceId === true;`
- 결과: exit 1 · Tests  2 failed | 92 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > isTierA — 핵심 sitemap 의 상세 기준 > 하나라도 빠지면 아니다 — 분류(쇼핑) · 사진 · place_id · 개요
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 티어 A 상세와 허브 항목은 core 에만, 나머지 상세는 core 에 없다

### 티어 A 의 사진·place_id 조건 제거

- 바꾼 줄: `return SIGHT_CATEGORIES.includes(doc.category) && Boolean(doc.imageUrl?.trim()) && doc.hasGooglePlaceId === true;` → `return SIGHT_CATEGORIES.includes(doc.category);`
- 결과: exit 1 · Tests  6 failed | 88 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > isTierA — 핵심 sitemap 의 상세 기준 > place_id · 사진이 빈 문자열이나 공백뿐이면 없는 것이다
  - src/seo/__tests__/prerenderPlace.test.ts > isTierA — 핵심 sitemap 의 상세 기준 > 하나라도 빠지면 아니다 — 분류(쇼핑) · 사진 · place_id · 개요
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > core 가 상한을 넘으면 core-2 로 이어 쓰고 색인에서 core 바로 다음 — 집합은 그대로
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 티어 A 상세와 허브 항목은 core 에만, 나머지 상세는 core 에 없다
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 시군구 페이지에 대표 최대 10곳 — 색인에 없는 id · 개요 없는 문서는 빠지고 티어 A 가 먼저
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 티어 A 가 모자라면 개요 있는 나머지로 채운다

### lastmod 가 contentUpdatedAt 무시

- 바꾼 줄: `if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;` → `if (false && /^\d{4}-\d{2}-\d{2}$/.test(head)) return head;`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 상세 lastmod > contentUpdatedAt 이 있으면 그 날짜 부분(KST 문자열 앞 10자) — 시간대 변환을 거치지 않는다

### contentUpdatedAt 을 isoDate 로

- 바꾼 줄: `if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;` → `if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return isoDate(a.contentUpdatedAt);`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 상세 lastmod > contentUpdatedAt 이 있으면 그 날짜 부분(KST 문자열 앞 10자) — 시간대 변환을 거치지 않는다

### 색인에서 core 를 뒤로

- 바꾼 줄: `const indexed = [...files.map(([name]) => name), PLACE_EVENT_SITEMAP];` → `const indexed = [...files.map(([name]) => name).filter((n) => !n.includes('core')), ...files.map(([name]) => name).filter((n) => n.includes('core')), PLACE_EVENT_SITEMAP];`
- 결과: exit 1 · Tests  3 failed | 91 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > core 가 상한을 넘으면 core-2 로 이어 쓰고 색인에서 core 바로 다음 — 집합은 그대로
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 색인 순서는 core → 나머지 → 행사, hub 파일은 없다
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap 인덱스 — 행사 sitemap(동적) 연결 > 상세가 있으면 인덱스가 sitemap-places-events.xml 을 가리키고, 그 파일은 정적으로 만들지 않는다

### 나머지 상세 일부 버림

- 바꾼 줄: `split(detailEntries.filter((e) => !e.tierA)).forEach` → `split(detailEntries.filter((e) => !e.tierA).slice(1)).forEach`
- 결과: exit 1 · Tests  4 failed | 90 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > core 가 상한을 넘으면 core-2 로 이어 쓰고 색인에서 core 바로 다음 — 집합은 그대로
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 집합 동일성 — 모든 urlset 의 <loc> 멀티셋 = 입력 허브 ∪ 상세, 중복 0
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 티어 A 상세와 허브 항목은 core 에만, 나머지 상세는 core 에 없다
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap 인덱스 — 행사 sitemap(동적) 연결 > 상세가 있으면 인덱스가 sitemap-places-events.xml 을 가리키고, 그 파일은 정적으로 만들지 않는다

### 티어 A 를 core·나머지 양쪽에 기록

- 바꾼 줄: `split(detailEntries.filter((e) => !e.tierA)).forEach` → `split(detailEntries).forEach`
- 결과: exit 1 · Tests  4 failed | 90 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > core 가 상한을 넘으면 core-2 로 이어 쓰고 색인에서 core 바로 다음 — 집합은 그대로
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 기본 상한(20,000) 경계 — core 가 상한 + 1 이면 core-2 에 한 건
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 집합 동일성 — 모든 urlset 의 <loc> 멀티셋 = 입력 허브 ∪ 상세, 중복 0
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 티어 A 상세와 허브 항목은 core 에만, 나머지 상세는 core 에 없다

### 티어 A 0건 게이트 제거

- 바꾼 줄: `if (detailEntries.length >= TIER_A_GATE_MIN_DETAILS && !detailEntries.some((e) => e.tierA)) {` → `if (false) {`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > place sitemap — 핵심(core) 분리 > 티어 A 0건 게이트 — 상세 10,000건 · 티어 A 0 이면 빌드를 세우고, 9,999건이면 통과

### 시군구 대표 제거

- 바꾼 줄: `: sigunguTops(regionTops.get(`${lang}/${region.code}`), docsById);` → `: [];`
- 결과: exit 1 · Tests  4 failed | 90 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 링크 그래프 — 허브에서 <a href> 만 따라가면 시군구 대표가 깊이 3 안
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 빌드 로그 재료 — 티어 A 중 깊이 3 안 N/M
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 시군구 페이지에 대표 최대 10곳 — 색인에 없는 id · 개요 없는 문서는 빠지고 티어 A 가 먼저
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 티어 A 가 모자라면 개요 있는 나머지로 채운다

### 시군구 대표에서 티어 A 우선 생략

- 바꾼 줄: `return [...docs.filter(isTierA), ...docs.filter((d) => !isTierA(d))].slice(0, REGION_TOPS_SHOWN);` → `return docs.slice(0, REGION_TOPS_SHOWN);`
- 결과: exit 1 · Tests  3 failed | 91 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 빌드 로그 재료 — 티어 A 중 깊이 3 안 N/M
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 시군구 페이지에 대표 최대 10곳 — 색인에 없는 id · 개요 없는 문서는 빠지고 티어 A 가 먼저
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 티어 A 가 모자라면 개요 있는 나머지로 채운다

### 시군구 대표 질의에서 category 누락

- 바꾼 줄: `category: SIGHT_CATEGORIES.join(','),
      size: String(REGION_TOPS_SIZE),` → `size: String(REGION_TOPS_SIZE),`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > fetchRegionTops — 시군구 대표 조회 > 시군구마다 1회 — 관광 분류 · 시도 2자리 · 시군구 3자리 · size 30

### 시군구 대표 재시도 제거

- 바꾼 줄: `if (attempt >= retryDelays.length) throw err;` → `throw err;`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > fetchRegionTops — 시군구 대표 조회 > 첫 시도 실패 · 재시도 성공이면 성공으로 친다

### 스위치 false 인데 랜딩 링크

- 바꾼 줄: `: landingPages.filter((p) => p.indexed && p.entry.lang === lang && p.entry.code === region.code);` → `: landingPages.filter((p) => p.entry.lang === lang && p.entry.code === region.code);`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlace.test.ts > 시군구 대표 관광지 — 내부 링크 깊이 > 스위치가 꺼져 있으면 시군구 페이지 랜딩 링크 0, indexed 랜딩은 그 시군구 페이지에만

### noindex 파일을 원래 자리에 씀

- 바꾼 줄: `return `prerender${indexed ? '' : '/_noindex'}${pathname}.html`;` → `return `prerender${pathname}.html`;`
- 결과: exit 1 · Tests  4 failed | 90 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderGuides.test.ts > 편집 페이지 프리렌더 > draft → noindex · 「검수 전 초안」 띠 · sitemap·llms 제외 · 목록 없음 · 허브 링크 없음
  - src/seo/__tests__/prerenderPlaceLandings.test.ts > placeLandingPages — 출력 > 스위치 false → 모든 랜딩 파일이 prerender/_noindex 아래 같은 경로(국·영) — nginx 가 헤더로도 noindex 를 낸다
  - src/seo/__tests__/prerenderPlaceLandings.test.ts > placeLandingPages — 출력 > 스위치 true + 하한 이상 → 원래 자리, 은퇴·하한 미달 → _noindex
  - src/seo/__tests__/prerenderPlaceLandings.test.ts > placeLandingPages — 출력 > 파일 경로 공식 — nginx try_files(/prerender$uri.html · /prerender/_noindex$uri.html)와 같은 식

### llms 가 indexed 필터 생략(SR-3)

- 바꾼 줄: `.filter((p) => p.indexed) (placeLlmsTxt 첫 번째)` → `(삭제)`
- 결과: exit 1 · Tests  2 failed | 92 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPlaceLandings.test.ts > sitemap · llms > 스위치 false → 랜딩 0건
  - src/seo/__tests__/prerenderPlaceLandings.test.ts > sitemap · llms > 스위치 true → 하한 이상·비은퇴만, lastmod 는 표시 30건 modifiedAt 최댓값

### SR-6 홈 링크 제거

- 바꾼 줄: `(path === '/' ? `<p><a href="${regionUrl('ko', '11')}">서울 가볼 만한 곳</a></p>` : '') +` → `(삭제)`
- 결과: exit 1 · Tests  1 failed | 93 passed (94)
- 빨개진 테스트:
  - src/seo/__tests__/prerenderPortalHome.test.ts > apex 홈 프리렌더 — place 지역 링크 > 홈 본문에 서울 지역 페이지 링크가 하나 — 홈 카드가 서울 관광지를 보이는 맥락

## nginx (nginx.conf → scripts/check-nginx-place-landings.sh, NGINX_CONF 로 사본 지정)

### named location 헤더 삭제

- 바꾼 것: `@place_noindex` 의 `add_header X-Robots-Tag "noindex, follow" always;` 줄 삭제
- 결과: exit 1
- 빨개진 항목:
  - `FAIL /regions/11110/free X-Robots-Tag — 기대 [noindex, follow] 실제 []`
  - `FAIL /en/regions/11110/free X-Robots-Tag — 기대 [noindex, follow] 실제 []`
  - `FAIL /guides/draft-x X-Robots-Tag — 기대 [noindex, follow] 실제 []`
  - `FAIL /regions/11140/swap X-Robots-Tag — 기대 [noindex, follow] 실제 []`
  - `FAILED`

### _noindex 직접 경로 internal 제거

- 바꾼 것: `location ^~ /prerender/_noindex/ { internal; }` 블록 삭제
- 결과: exit 1
- 빨개진 항목:
  - `FAIL /prerender/_noindex/regions/11110/free.html 직접 경로 404 — 기대 [404] 실제 [200]`
  - `FAIL _noindex 파일이 직접 경로로 나간다`
  - `FAIL /prerender/_noindex/guides/draft-x.html 직접 경로 404 — 기대 [404] 실제 [200]`
  - `FAILED`
