## 판정 결과 — spec-review 1라운드 (place 롱테일 속성 랜딩 + 편집 페이지)

리뷰어 6명의 발견은 실제로 33건입니다(A4 · D5 · I9 · S2 · T7 · U6). 받은 메시지의 「38건」과 다릅니다. T1 표의 하위 행 8줄을 따로 셌을 가능성이 있어, 하위 행은 T1 한 건 안에서 다뤘습니다.

**SUMMARY: keep 31 / demote 2 / dismiss 0**

판정을 뒤집을 만큼 큰 오류는 없었습니다. 다만 근거를 고쳐야 하는 것이 넷 있습니다.
- **A1**: 인용한 `ADR-0062:442` 의 「태그별 랜딩 페이지」 기각은 게임 태그 이야기입니다(§2 표 `:61` 「태그 ✗ 장르와 크게 겹쳐」). place 쪽 결정의 실제 근거는 `PlacePage.tsx:339` 와 `docs/specs/2026-09-29-place-ssr-enrichment/spec.md:53` 입니다. 결론(ADR 개정이 필요하다)은 그대로 유지합니다.
- **T2**: 「nginx 검사 선례 0건」은 틀렸습니다. 실제 nginx 로 계약을 검사하는 `portal-fe/scripts/check-nginx-legacy-regions.sh` · `check-nginx-events-sitemap.sh` 가 있습니다. 그래서 수정안을 그 방식으로 바꿉니다.
- **D3**: 「관광지 용어가 어느 glossary 에도 없다」는 틀렸습니다. `search/glossary.md:76-80` 에 `petPolicy` · 「서버 렌더(관광지)」 · 「비슷한 곳」이 이미 있습니다.
- **A3/I7**: 프리셋을 상태 초기값으로 넣으면 자동 선택 effect 는 `sidoCode` 가 차 있어서 원래 돌지 않습니다(`PlacePage.tsx:625`). 그래도 effect 로 늦게 넣으면 덮이는 경합은 실제로 생깁니다. 유지하고, 수정 문안에 이 점을 반영했습니다.

---

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 | 처리 |
|---|---|---|---|---|
| G1 기존 결정과의 충돌 | A1 | keep | REVISE | 메인 방침대로 색인 스위치(SR-0)와 ADR-0062 개정 초안. 켜는 것은 사용자 몫 |
| G2 빌드 단계 경계 · 편집 페이지 배선 | A2, I1, I2, U2 | keep | REVISE | render-content 와 prerender 의 경계, nginx location, SPA 라우트, `/guides` 응답 |
| G3 프리셋 주입 · 계측 | A3, I7, T4, D4 | keep | REVISE | 상태 초기값 주입, trigger 열 단언, 랜딩 식별 필드 |
| G4 선정 결과의 안정성 | I4, U3, I8, U6, S2 | keep(S2 MINOR) | REVISE | 레포에 커밋한 목록으로 고정. 미달이면 noindex. SPA 미만 분기 제거. 공개 JSON 없앰 |
| G5 상한 산술 | I5, T3 | keep | REVISE | 언어별 속성당 5, 국·영 합산 20, 정렬 규칙 확정 |
| G6 속성 · 분류 정의 | D1, D2, D5 | keep | REVISE | 슬러그 표, 관광 분류 필터, 시도 약칭을 붙인 h1 |
| G7 메타 · 날짜 | I6, I9 | keep | REVISE | `landingMeta` 함수 하나, 표시 30건 기준 날짜 |
| G8 실패 모드 | I3 | keep | REVISE | 부분 실패 가드 안에 넣음 |
| G9 출력 안전 | S1 | keep | REVISE | 고정 템플릿 + 평문화 + `escapeHtml` |
| G10 테스트 빈칸 | T1, T2, T5, T6, T7 | keep | REVISE | SR-5 교체문 |
| G11 운영자 흐름 · 사전조건 | U1, U5 | keep | REVISE | 게시 절차와 사후조건, 후보 모집단 |
| G12 문서화만 필요 | U4, D3 | demote | MINOR | 한 줄 명시. glossary 는 문서 동기화 |
| G13 구조 메모 | A4 | keep | MINOR | 선정 함수를 순수 함수로 |

---

## 2. 발견별 JSON

```json
[
  { "id": "A1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 339, "quote": "// 속성 칩 — 화면 상태일 뿐 주소를 만들지 않는다(새 색인 URL 금지). 속성끼리 AND." },
      { "file": "docs/specs/2026-09-29-place-ssr-enrichment/spec.md", "line": 53, "quote": "필터가 바뀌면 누적 목록을 처음부터 다시 받는다. 새 색인 URL 을 만들지 않는다." },
      { "file": "docs/adr/ADR-0062-seo-and-organic-discovery.md", "line": 61, "quote": "| 태그 | ✗ | 장르와 크게 겹쳐 얇은 페이지가 양산됨 |" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 4, "quote": "ADR 불요(새 서비스·스키마·통신 없음, 빌드타임 프리렌더 확장)" } ],
    "reason": "스펙과 기존 코드·스펙 결정이 정면으로 충돌하므로 유지한다. 단, ADR-0062:442 는 게임 태그 기각이라 place 의 직접 근거는 PlacePage.tsx:339 와 09-29 스펙이고, D-2 ⓑ 사용자 결정이 있어 BLOCK 이 아니라 REVISE 다." },
  { "id": "A2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/package.json", "line": 8, "quote": "\"dev\": \"node scripts/render-content.mjs && vite\"," },
      { "file": "portal-fe/scripts/render-content.mjs", "line": 17, "quote": "const SOURCE = resolve(ROOT, 'src/content/search-architecture.md');" } ],
    "reason": "render-content 는 dev 와 tsc 앞에서 도는 순수 변환이라, 색인 조회를 넣으면 dev 와 CI 가 운영 API 에 묶인다는 지적이 원문으로 확인된다." },
  { "id": "A3", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 312, "quote": "export default function PlacePage() {" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 625, "quote": "if (autoPickedRef.current || !hasRegionAxis || sidoCode || keyword || geo) return;" } ],
    "reason": "PlacePage 는 props 가 없고 canonical 을 허브 값으로 고정해서 주입 방식이 정해져야 한다. 초기값으로 넣으면 sidoCode 가드가 자동 선택을 막는다는 점을 문안에 반영한다." },
  { "id": "A4", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1038, "quote": "export async function fetchSidoSlice(lang, sidoCode, get = getJson) {" } ],
    "reason": "get 을 주입하는 순수 함수 선례가 실재하고, 리뷰어도 비차단이라고 했다." },
  { "id": "D1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/placeAttributes.ts", "line": 50, "quote": "{ id: 'petAllowed', ko: '반려동물 동반', en: 'Pets allowed', only: 'ko' }," },
      { "file": "search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt", "line": 66, "quote": "// 무장애(WHEELCHAIR·ELEVATOR·RESTROOM, 쉼표 AND) · 웰니스 테마 있음" } ],
    "reason": "pet 은 칩과 facet 이 둘로, 무장애는 코드 셋(AND)으로 나뉘어 있어 슬러그 하나가 무엇을 세는지 정의가 없다." },
  { "id": "D2", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/pages/place/RegionPage.tsx", "line": 117, "quote": "// 색인되는 지역 페이지다 — 안 걸면 병원·상점이 \"이 지역 관광지\" 로 색인된다" } ],
    "reason": "색인 면과 허브가 모두 SIGHT_CATEGORIES 로 거르는데, 스펙의 질의에는 분류 조건이 없다." },
  { "id": "D3", "verdict": "demote", "severity": "MINOR",
    "evidence": [ { "file": "search/glossary.md", "line": 76, "quote": "| **`petPolicy`** | 반려동물 동반 정책 — `ALLOWED`(전 구역) · `PARTIAL`(일부 구역) · `UNKNOWN`." } ],
    "reason": "ⓒ 관광지 용어는 이미 search/glossary.md 에 있다(context-map 행은 자동 추출 명사뿐이다). 새 용어 넷을 그 파일에 더하는 문서 동기화 항목이다." },
  { "id": "D4", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 434, "quote": "track('SESSION_START', { entityType: 'PAGE', entityId: 'place-hub', screenType: 'PLACE_HUB', screenRef: '' }" } ],
    "reason": "SEARCH payload 에 랜딩 진입과 허브 진입을 가를 필드가 없어, 계획 S3-2 의 측정이 성립하지 않는다." },
  { "id": "D5", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/seo/copy.mjs", "line": 460, "quote": "export function regionDisplayName(lang, region) { return (lang === 'en' && region.nameEn) || region.name;" } ],
    "reason": "표시명은 시군구 이름만 쓰므로 「중구 주차 가능 관광지」 같은 title·h1 이 여러 시도에서 겹친다." },
  { "id": "I1", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/nginx.conf", "line": 331, "quote": "location / { try_files $uri /index.html;" } ],
    "reason": "/guides 를 받는 location 이 없다(grep 으로 확인). 그래서 프리렌더 파일이 영영 안 읽히고 SPA 셸이 나간다." },
  { "id": "I2", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/App.tsx", "line": 338, "quote": "<Route path=\"*\" element={<NotFoundPage />} />" } ],
    "reason": "/guides 라우트가 없으면 JS 를 실행한 크롤러는 NotFound(noindex)를 본다." },
  { "id": "I3", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 244, "quote": "if (failed.length > 0 && fetched.length > 0) { throw new PartialSeoFailure(" } ],
    "reason": "가드 밖 섹션이 조용히 비는 선례(랭킹)가 실재한다. 스펙은 랜딩 조회 실패 시 동작을 정하지 않았다." },
  { "id": "I4", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 94, "quote": "검수: 조건 정확성·목록 중복도·질의별 고유 설명." } ],
    "reason": "빌드마다 다시 뽑으면 검수 없이 주소가 생기고 사라진다. 계획의 검수 요구와 2~4주 측정과 충돌한다." },
  { "id": "I5", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 13, "quote": "속성마다 최대 5장, 전체 최대 20장" } ],
    "reason": "국문 4속성 × 5 = 20 이라, 언어별로 해석하면 전체 상한이 절대 걸리지 않는다." },
  { "id": "I6", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1015, "quote": "// sitemap 의 lastmod. 원천 수정일이 없는 문서는 그냥 비운다 — 빌드일을 대신 적으면" } ],
    "reason": "N 이 30 을 넘으면 「결과 중 최댓값」의 범위가 둘로 읽힌다." },
  { "id": "I7", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/pages/place/__tests__/PlacePage.tracking.test.tsx", "line": 103, "quote": "expect(triggers()).toEqual(['landing', 'initial'])" } ],
    "reason": "허브 첫 진입은 실제로 SEARCH 두 번을 낸다. 프리셋을 늦게 넣으면 경합한다(A3 와 묶음)." },
  { "id": "I8", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 16, "quote": "SPA 에서 직접 그 주소로 들어와도 결과가 10건 미만이면 … (noindex)." } ],
    "reason": "미선정 주소는 nginx 가 404 라 이 분기에 닿을 경로가 없다. 선정된 주소에서는 프리렌더와 noindex 판정이 갈린다." },
  { "id": "I9", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/seo/copy.mjs", "line": 469, "quote": "export function regionMeta(lang, region, attractionCount = null) {" } ],
    "reason": "지역 페이지는 메타 함수 하나가 title·description·heading 을 다 내는데, 스펙은 h1·문장만 정했다." },
  { "id": "S1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1178, "quote": "<li><a href=\"${attractionPath(lang, a.id)}\">${escapeHtml(a.title)}</a></li>" },
      { "file": "portal-fe/src/seo/copy.mjs", "line": 696, "quote": "export function placeIntroText(introRaw, key) {" } ],
    "reason": "평문화와 이스케이프 선례가 있는데, 스펙에는 규칙이 없다. 카드는 render-content 의 check 를 거치지 않는다." },
  { "id": "S2", "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "portal-fe/nginx.conf", "line": 332, "quote": "try_files $uri /index.html;" } ],
    "reason": "dist 파일이 그대로 공개되는 것은 사실이다. 비차단이고, G4 에서 목록을 레포에 커밋하는 것으로 해소된다." },
  { "id": "T1", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 31, "quote": "편집 페이지 렌더(draft → noindex·띠·sitemap 제외, …)" } ],
    "reason": "llms 제외, /guides 목록, lastmod, canonical 유지, 같은 함수 사용에 대한 단언이 SR-4.1 에 없다." },
  { "id": "T2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/check-nginx-legacy-regions.sh", "line": 12, "quote": "# portal-fe/nginx.conf 를 이미지와 같은 방식(템플릿 + 기동 때 resolver 치환)으로 nginx:1.27-alpine 에 올리고," },
      { "file": "portal-fe/nginx.conf", "line": 223, "quote": "# 아래 지역 location 보다 앞에 둬야 한다 — 정규식 location 은 먼저 맞은 것이 이긴다." } ],
    "reason": "문자열이 있는지만 보는 검사는 순서상 무동작을 못 잡는다. 「선례 0건」은 ⓒ 로 틀렸다 — 실제 nginx 로 검사하는 스크립트 선례가 있어 그 방식으로 고친다." },
  { "id": "T3", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 32, "quote": "회귀 주입(임시 사본): 10건 경계를 9 로 · 상한 제거 · …" } ],
    "reason": "I5 와 같은 뿌리다. 상한 하나를 지우는 주입이 빨강을 못 낼 수 있다." },
  { "id": "T4", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/src/pages/place/__tests__/PlacePage.tracking.test.tsx", "line": 169, "quote": "expect(initial.payload).toMatchObject({ trigger: 'initial', sido: '11' });" } ],
    "reason": "첫 질의만 보면, 뒤따르는 initial 이 서울로 덮어도 초록이 나온다." },
  { "id": "T5", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt", "line": 202, "quote": "data class AttributeFacets(" } ],
    "reason": "기대값을 테스트 안에서 다시 조립하면 자기 사본을 재게 된다. 픽스처 모양도 facet 계약을 따라야 한다." },
  { "id": "T6", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "scripts/lint-blog-post.py", "line": 141, "quote": "for field in (\"title\", \"slug\", \"category\", \"summary\"):" } ],
    "reason": "F1 이 블로그 머리말을 요구해서 편집 원본에 그대로 돌리면 실패한다. 게이트가 없다." },
  { "id": "T7", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 94, "quote": "검수: 조건 정확성·목록 중복도·질의별 고유 설명." } ],
    "reason": "SR-4.3 은 상태 코드와 개수만 본다. 계획이 요구한 검수 세 항목이 없다." },
  { "id": "U1", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 93, "quote": "사실 검수·렌더링·내부 링크 확인" } ],
    "reason": "게시 절차, 사후조건, 검수일 이후 카드 값이 바뀌는 문제가 정의돼 있지 않다." },
  { "id": "U2", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/nginx.conf", "line": 331, "quote": "location / {" } ],
    "reason": "/guides 를 직접 열면 SPA 셸 200(soft 404)이 나간다. I1 과 묶음." },
  { "id": "U3", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 16, "quote": "해당 주소의 프리렌더 파일이 없으면 nginx 가 **404** 를 낸다" } ],
    "reason": "I4 와 같은 뿌리다." },
  { "id": "U4", "verdict": "demote", "severity": "MINOR",
    "evidence": [ { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 339, "quote": "속성 칩 — 화면 상태일 뿐 주소를 만들지 않는다" } ],
    "reason": "ⓑ 허브의 속성 칩이 이미 같은 성질(조건이 주소에 안 실림)로 운영 중이다. 의도라는 것을 한 줄 적으면 끝난다." },
  { "id": "U5", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 718, "quote": "(regions.ko ?? []).map((r) => r.code).filter((code) => (regions.en ?? []).some((r) => r.code === code))," } ],
    "reason": "후보 모집단이 지역 목록 안이라는 사전조건과, 형제 링크 0개 허용 여부가 정의돼 있지 않다." },
  { "id": "U6", "verdict": "keep", "severity": "REVISE",
    "evidence": [ { "file": "portal-fe/nginx.conf", "line": 215, "quote": "return 404;" } ],
    "reason": "404 본문 정책이 없다. 기본 본문을 쓰는 선례가 있으니, 그것을 택한다고 명시하면 된다." }
]
```

---

## 3. spec.md 편집 목록 (구현자는 해석 없이 그대로 반영)

**E1.** 4행 머리말 전체를 아래로 교체합니다.

> 2026-10-09. 사용자 위임, D-2 ⓑ(편집 2~3 + 프로그램형 10~20 동시 시험). **속성 랜딩은 기존 결정 「속성 칩은 주소를 만들지 않는다(새 색인 URL 금지)」(`PlacePage.tsx:339`, `docs/specs/2026-09-29-place-ssr-enrichment/spec.md:53`)와 ADR-0062 §2·§8 의 얇은 페이지 원칙에 어긋나므로 ADR-0062 개정이 필요하다.** 개정 승인은 사용자 몫이라, 이 스펙은 랜딩을 **색인 스위치를 끈 채로**(noindex · sitemap 제외 · llms 제외) 구현·배포하고, 개정 초안을 `context/adr-0062-amendment-draft.md` 에 둔다. 편집 페이지 선정·검수도 사용자 몫(Q1)이고 초안은 `draft` 로 둔다. 코드 지도: 속성 칩은 허브 useState 라 지금 크롤 가능한 패싯 URL 은 0건이다. 시군구 × 속성 집계 API 는 없고 시군구마다 `facets=true` 1회다. 지역 프리렌더가 없으면 SPA 셸 200(soft 404)이 나간다.

**E2.** Goal 을 아래로 교체합니다.

> 「부산 중구 주차 가능 관광지」처럼 속성 하나 × 시군구 하나의 랜딩을, 결과가 충분한 조합만 뽑아 레포에 커밋한 목록으로 고정하고, 빌드가 읽히는 고유 페이지로 낸다. 색인은 스위치 하나로 열고 닫는다(기본 닫힘). 편집 페이지 3장의 틀과 초안을 검수 대기 상태로 둔다.

**E3.** `## Specific Requirements` 아래(9~33행) 전체를 다음으로 교체합니다.

```markdown
### SR-0 색인 스위치 (ADR-0062 개정 대기)
1. `portal-fe/src/seo/copy.mjs` 에 `export const PLACE_LANDINGS_INDEXABLE = false;` 한 줄. 프리렌더·SPA·sitemap·llms 가 전부 이 상수 하나만 본다(선례: 같은 파일의 `ADSENSE_CLIENT` 한 줄이 로더·지면·ads.txt 를 함께 켜고 끈다). 환경 변수로 두지 않는다 — Dockerfile ARG·CI 를 거치면 프리렌더와 SPA 가 다른 값을 볼 수 있고, 켜는 일이 커밋 한 줄로 남아야 사용자 승인과 짝이 맞는다.
2. `false` 일 때 속성 랜딩은 200 으로 나가되 프리렌더·SPA 모두 `noindex, follow`, sitemap·llms 에서 제외. nginx 404 규칙(SR-1.6)과 선정 목록은 스위치와 무관하게 동작한다.
3. `true` 로 바꾸는 커밋은 ADR-0062 개정(§18) 수용과 같은 커밋이어야 한다. 편집 페이지(SR-3)는 이 스위치를 따르지 않는다 — 자기 `status` 가 스위치다.
4. 「편집 페이지는 기각된 태그 랜딩이 아니다」: ADR-0062 의 기각 사유는 「기존 URL 축(장르)과 겹치는 프로그램형 페이지의 양산」이다. 편집 페이지는 ① 사람이 고른 3장이고 ② 선정 이유·주의 같은 고유 서술이 본문이며 ③ 기존 지역·속성 축의 부분집합이 아니라 축을 가로지르는 선별이고 ④ 검수자 없이는 published 가 될 수 없다(빌드 게이트). 속성 랜딩은 지역 페이지 목록의 부분집합이라 기각 사유의 범위 안에 있다 — 그래서 스위치는 랜딩에만 건다.

### SR-1 속성 랜딩 주소와 대상 (S3-2)
1. 주소: `/regions/{code5}/{attr}` (국문), `/en/regions/{code5}/{attr}` (영문). 속성 둘 이상·정렬·반경 조합 주소는 만들지 않는다(그래서 robots Disallow 대상 주소가 생기지 않는다 — 계획 S3-2 의 robots 항목은 「조합 주소를 만들지 않음」으로 충족). 슬러그 표(이 표가 유일한 정의):

   | attr | 검색 파라미터 | facet 키(건수) | 칩 id(SPA 프리셋) | 국문 이름 | 영문 이름 | 언어 |
   |---|---|---|---|---|---|---|
   | `parking` | `parking=YES` | `parking.YES` | `parking` | 주차 가능 | Parking | ko·en |
   | `pet` | `pet=ALLOWED` | `pet.ALLOWED` | `petAllowed` | 반려동물 동반 | — | ko |
   | `barrier-free` | `barrierFree=WHEELCHAIR` | `barrierFree.WHEELCHAIR` | `bfWheelchair` | 휠체어 이용 | — | ko |
   | `free` | `admission=FREE` | `admission.FREE` | `admissionFree` | 입장 무료 | Free admission | ko·en |

   `pet.PARTIAL`·`ELEVATOR`·`RESTROOM` 은 세지 않는다(이름이 센 것과 같아야 한다). 영문은 `parking`·`free` 만(`placeAttributes.ts:37-58`).
2. 분류: 선정·집계·목록·SPA 첫 질의는 모두 `category=SIGHT_CATEGORIES.join(',')`(`RegionPage.tsx:117-119`, `PlacePage.tsx:377-379` 와 같은 집합)를 건다. 프리렌더 N 과 SPA N 이 같은 질의에서 나온다.
3. 선정은 빌드가 아니라 스크립트가 한다: `node scripts/select-place-landings.mjs` 가 `portal-fe/src/content/place-landings.json` 을 쓰고 이것을 커밋한다. 빌드는 목록을 읽기만 한다. 선정 규칙(순수 함수 `selectLandings(facetsBySigungu, regions)` — 조회는 `get` 주입, 선례 `fetchSidoSlice`):
   - 모집단: 그 언어의 `administrative-regions` 시군구 행(지역 페이지가 있는 코드)만. 시군구 행이 없는 시도는 후보 없음.
   - 후보: 위 질의의 facet 건수가 `PLACE_LANDING_MIN_RESULTS`(copy.mjs, 10) 이상인 (언어, 시군구, 속성).
   - 정렬: 건수 내림차순 → 언어(ko 먼저) → 코드 오름차순.
   - 상한: 언어별 속성당 5, 국·영 합산 전체 20. 정렬 순서대로 채우며 둘 중 하나라도 차면 건너뛴다.
   - 중복도: 같은 언어·같은 시군구에서 이미 뽑힌 랜딩과 표시 목록(30건) id 의 Jaccard 가 0.5 를 넘으면 건너뛴다.
   - 항목 필드: `lang, code, sidoCode, attr, count, total, jaccardMax, selectedAt`(KST 날짜).
4. 페이지 본문(프리렌더, 국·영): 메타·제목·문장은 `copy.mjs` 의 `landingMeta(lang, sido, sigungu, attr, { count, total, asOf })` 하나가 `title`·`description`·`heading`·`sentence` 를 낸다. 프리렌더와 SPA 가 같은 함수를 쓴다.
   - heading 국문 「{시도 약칭} {시군구} {속성 국문 이름} 관광지」, 영문 「{Attr en} Attractions in {Sigungu en}, {Sido en}」. 시도 약칭은 지역 표시명 규칙을 따른다(영문명이 비면 국문명).
   - sentence 국문 「{시도} {시군구}에서 {속성 국문 이름} 관광지 {N}곳(전체 {M}곳 중) — 원천 갱신 기준 {asOf}」. `asOf` 가 없으면 「— 원천 갱신 기준」 꼬리를 뺀다. N 이 없으면 문장 자체를 내지 않는다.
   - 본문: 결과 목록 최대 30건(허브 기본 정렬, 이름·분류·주소 앞부분, 상세 링크) · 형제 링크(같은 언어 목록 안의 같은 시군구 다른 속성, 같은 시도 같은 속성; 0개면 생략) · 지역 페이지 링크(필수) · 허브 링크.
   - 원천 문자열은 `sourceText`/`placeIntroText` 로 평문화한 뒤 `escapeHtml` 한다. 링크는 `attractionPath`/`regionPath`/`landingPath` 로만 만든다(고정 템플릿).
5. 날짜: `asOf` = 표시된 30건의 `modifiedAt` 최댓값이다. 같은 값을 sitemap `lastmod` 로 쓰고, 없으면 둘 다 비운다(빌드일로 대신 적지 않는다 — `prerender-seo.mjs:1015-1017`).
6. nginx: 지역 location 바로 앞에 `location ~ ^/(en/)?regions/([^/]+)/([^/]+)$ { add_header Cache-Control "no-cache, must-revalidate"; add_header X-Robots-Tag $host_robots_tag always; try_files /prerender/$1regions/$2/$3.html =404; }`. 목록에 없는 조합·영문 `pet`·모르는 속성은 파일이 없어 **404**(nginx 기본 본문을 쓴다 — 선례 `nginx.conf:215-217`).
7. 빌드 시 데이터 미달: 목록 항목의 현재 N 이 `PLACE_LANDING_MIN_RESULTS` 미만이면 그 페이지는 그대로 만들되 noindex·sitemap 제외로 내고, 빌드 로그에 경고한다(404 로 지우지 않는다 — 이미 색인된 주소를 빌드 사이에 없애지 않는다). 목록 갱신은 스크립트를 다시 돌려 커밋하는 사람의 일이다.
8. 실패 모드: 랜딩 조회(목록·건수)는 `fetched/failed` 부분 실패 가드 안에 넣는다(섹션 이름 `place-landings`). 항목 하나만 실패해도 섹션 실패다.
9. sitemap·llms: `PLACE_LANDINGS_INDEXABLE && N ≥ 하한` 인 항목만. hreflang 은 같은 (code, attr) 가 국·영 둘 다 목록에 있고 둘 다 실릴 때만.

### SR-2 SPA 랜딩 화면
1. 라우트 `/regions/:code/:attr`·`/en/regions/:code/:attr` → `PlaceLandingRoute`. 이 컴포넌트는 번들에 포함된 `place-landings.json` 에서 (lang, code, attr) 항목을 찾고, 없으면 `NotFoundPage` 를 그린다. 있으면 `<PlacePage preset={{ sidoCode, sigunguCode, attribute: 칩 id, seo }} />`.
2. `PlacePage({ preset? })`: preset 이 있으면 ① `sidoCode`·`sigunguCode`·`attributes` 를 **`useState` 초기값**으로 넣는다(effect·`selectRegion` 경유 금지 — `selectRegion` 은 trigger 를 `initial`/`region` 으로 덮는다) ② `autoPickedRef` 를 `true` 로 시작한다 ③ `useSeo` 입력을 preset.seo 로 바꾼다. preset 이 없으면 지금과 같다.
3. 화면 위에 `landingMeta` 의 heading·sentence 를 보인다. 숫자는 프리셋 첫 결과의 facet 응답에서 나온다.
4. canonical 은 그 랜딩 주소로 고정한다. 조건이 바뀌어도 canonical·주소는 바꾸지 않는다(히스토리 교체 없음). 의도된 동작이다 — 허브의 속성 칩도 조건을 주소에 싣지 않는다(`PlacePage.tsx:339`).
5. noindex = `!PLACE_LANDINGS_INDEXABLE || 프리셋 첫 결과 N < PLACE_LANDING_MIN_RESULTS`. 프리렌더와 같은 규칙이고, 조건을 바꾼 뒤에는 다시 계산하지 않는다.
6. 계측: 프리셋 진입의 SEARCH trigger 는 `landing` 한 번뿐이다(`initial` 없음). 라우트가 살아 있는 동안의 모든 SEARCH payload 에 `landing: "{code5}/{attr}"` 를 싣는다. 페이지 종류는 문서에서 「속성 랜딩」이라 부르고, trigger 값 `landing`(첫 질의)과 구분한다.

### SR-3 편집 페이지 (S3-1)
1. 주소 `/guides/{slug}`(국문만 — D-1 ⓐ). 원본 `portal-fe/src/content/guides/{slug}.md`. 머리말은 `title`·`description`·`status: draft|published`·`reviewedBy`·`reviewedAt`·`attractionIds`.
2. 단계 경계:
   - `render-content.mjs` 는 소스 목록을 받도록 일반화한다(기존 `search-architecture` 출력 계약 유지 — `src/content/__tests__/prerenderTechSearch.test.ts` 그대로 통과). guides/*.md → `src/pages/place/generated/guides/{slug}.json`(본문 HTML + 머리말)까지만 만들고, API 는 부르지 않는다.
   - 본문 안 관광지 자리는 `<div data-guide-card="{id}"></div>` 표지로 남는다.
   - 카드는 `prerender-seo.mjs` 가 `GET /api/search/attractions/{id}` 로 채운다. 고정 템플릿 + 평문화 + `escapeHtml`, 요약은 이름·주소·요금·휴무·주차·반려.
   - SPA 는 같은 JSON 과 같은 엔드포인트로 런타임에 그린다.
   - 카드 조회는 부분 실패 가드 안이다. 관광지가 404 면 draft 는 그 카드를 빼고 경고하고, published 는 빌드를 실패시킨다.
3. nginx: `location ~ ^/guides/([a-z0-9][a-z0-9-]*)$ { … X-Robots-Tag $host_robots_tag; try_files /prerender/guides/$1.html =404; }`, `location ~ ^/guides/?$ { … try_files /prerender/guides/index.html =404; }`. 없는 slug 와 published 0건의 목록 주소는 404 다.
4. SPA 라우트 `/guides/:slug`·`/guides`(placeRoute). JSON 이 없는 slug 는 `NotFoundPage`.
5. `status: draft` → 프리렌더·SPA 모두 `noindex, follow`, sitemap·llms 제외, 화면 위에 「검수 전 초안」 띠. `published` 인데 `reviewedBy`·`reviewedAt` 이 비어 있으면 render-content 가 빌드를 실패시킨다.
6. 초안 3장(계획 예시): 서울 무료 실내 · 서울 고궁 반나절 · 제주 반려동물 동반. 각 장에 선정 이유(데이터 기준 문장) · 후보 5~8곳(색인 조건 검색, 기준을 적음) · 비교 표(요금·휴무·주차·반려 — 카드 값) · 주의(「정보 없음」 칸 명시) · 내부 링크(상세·지역, 목록에 있는 랜딩). 문체는 `docs/conventions/blog-writing.md` 를 따르고, `scripts/lint-blog-post.py --body-only` 로 F2~F8 을 통과해야 한다. 이를 위해 lint 스크립트에 `--body-only`(F1 생략 — 편집 머리말은 블로그 4필드와 다르다) 옵션 하나를 추가한다.
7. 목록 `/guides`: published 가 1장 이상일 때만 `prerender/guides/index.html` 을 만들고 SPA 도 published 만 보인다. 0장이면 파일이 없어 404 이고 링크도 내지 않는다.
8. 게시 절차(사용자):
   ① 머리말 `status: published`·`reviewedBy`·`reviewedAt` 수정
   ② `scripts/lint-blog-post.py --body-only` 통과
   ③ 커밋·배포
   사후조건: noindex 해제 · sitemap·llms 포함 · `/guides` 목록 생성 · place 허브 프리렌더 하단에 `/guides` 링크 1개(published ≥ 1 일 때만).
   `reviewedAt` 은 글(선정·서술)의 검수일이다. 카드 사실값은 빌드 시점 색인값이라 검수 뒤 바뀔 수 있고, 카드 영역에 「색인 기준 {빌드 KST 날짜}」를 표기한다.

### SR-4 테스트에 고정할 결정
위 SR 의 수치·키(하한 10 · 속성당 5 · 합산 20 · Jaccard 0.5 · 슬러그 표 · SIGHT_CATEGORIES)는 상수 하나에서 나오고, 테스트는 그 상수와 대상 함수의 출력으로 기대값을 계산한다(테스트 안에서 문장을 다시 조립하지 않는다 — 선례 `SearchArchitecturePage.test.tsx:6`).

### SR-5 검증
1. vitest. 픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양 그대로이고, `pet.PARTIAL`·`barrierFree.ELEVATOR` 값과 분류 필터 유무를 포함한다.
   - 선정 함수:
     - 9 제외·10 포함
     - 속성당 상한: 한 속성 후보 6+ 에서 5
     - 합산 상한: 국 20 + 영 10 후보에서 20, ko 먼저
     - 동점은 코드 오름차순
     - 영문 `pet`·`barrier-free` 제외
     - `pet.PARTIAL`·`ELEVATOR` 는 N 에 안 들어감
     - Jaccard 0.5 초과 제외
     - 모집단 밖 코드 제외
   - 질의 인자: `category` 가 SIGHT_CATEGORIES.
   - `landingMeta`: 시도 약칭 포함(같은 「중구」 두 시도 → title 다름), N 없음 → 문장 없음, `asOf` 없음 → 꼬리 없음, 영문 형식.
   - 프리렌더 출력:
     - h1·문장·목록 30·형제 링크·지역 링크·canonical
     - 스위치 false → `noindex` 메타
     - N < 하한 → noindex
     - 이스케이프(픽스처 이름에 `<script>` → 평문)
   - sitemap·llms: 스위치 false → 랜딩 0건. true → 목록 중 하한 이상만, lastmod = 표시 30건 `modifiedAt` 최댓값, hreflang 은 국·영 둘 다 있을 때만.
   - 품질 게이트(빌드 산출물 기준, 실패 시 빌드 실패): 목록 랜딩 간 title·description 중복 0.
   - 부분 실패: 랜딩 조회 하나 실패 + 다른 섹션 성공 → `PartialSeoFailure`.
   - 편집 페이지:
     - draft → noindex·띠·sitemap·llms 제외
     - published + 검수자 없음 → render-content 실패
     - published 0 → `guides/index.html` 없음
     - 카드 이스케이프
     - `search-architecture` 계약 테스트 그대로 통과
   - SPA 랜딩(선례 `PlacePage.tracking.test.tsx` 의 `byAction`, 좌표 성공·거부 두 경우):
     - SEARCH trigger 열 = `['landing']`
     - 모든 SEARCH 가 같은 시도·시군구·속성
     - payload `landing` 필드
     - 조건 변경 뒤 주소·canonical 유지
     - 목록에 없는 조합 → NotFound
     - heading·sentence 가 같은 픽스처의 프리렌더 출력과 일치
   - SPA 편집: `/guides/:slug` 렌더, draft 띠·noindex, 없는 slug → NotFound.
   - 문체: guides/*.md 마다 `python3 scripts/lint-blog-post.py --body-only` 종료 코드 0(python3 가 없으면 skip — 통과로 세지 않는다).
2. nginx 계약: `portal-fe/scripts/check-nginx-place-landings.sh` — `check-nginx-legacy-regions.sh` 와 같은 방식(실제 nginx:1.27-alpine, 도커가 없으면 exit 2)이다. 픽스처 dist 에서 다음을 확인한다.
   - `/regions/11110/parking`(파일 있음) 200·프리렌더 본문
   - `/regions/11110/foo`·`/en/regions/11110/pet`·`/regions/99999/parking` 404
   - `/regions/11110` 은 기존대로 200
   - `/regions/29110` 은 기존 301
   - `/guides/x`(있음) 200, `/guides/none` 404
   - `/guides`(index 없음) 404
3. 회귀 주입(임시 사본) — 각각 빨강:
   - 하한 10→9
   - 속성당 상한 제거
   - 합산 상한 제거
   - 분류 필터 제거
   - 스위치 false 인데 noindex 제거
   - 랜딩 location 의 `=404` → `/index.html`
   - 랜딩 location 을 지역 location 뒤로 이동
   - draft noindex 제거
   - published 게이트 제거
   - 프리셋을 effect 로 주입
   - 랜딩 조회를 가드 밖으로
   - 편집 원본에 금칙 표현 한 줄
4. 배포 뒤:
   - 목록 각 주소 200·`<!--seo:prerendered-->`·`noindex`(스위치 false)
   - 목록 밖 조합 404
   - place sitemap 에 `/regions/*/*` 0건(스위치 false)
   - 편집 초안 3장 200·noindex, `/guides` 404
   - 검수 표본(목록 전부): 표시 목록에서 3건씩 상세 응답의 해당 속성 값이 참인지(조건 정확성) — 결과를 `verifications/` 에 남긴다
   - Rich/Schema 검증은 해당 없음(구조화 데이터 추가 없음).
```

**E4.** `## Existing Code to Leverage` 끝에 다음을 덧붙입니다: `PlacePage.tsx:339,434,455-480,590-645`, `PlacePage.tracking.test.tsx:99-103`, `nginx.conf:215-235`, `scripts/check-nginx-legacy-regions.sh`, `prerender-seo.mjs:139-150,241-250,388-406,1015-1017`, `copy.mjs:460-491,696,1316`, `render-content.mjs:17-18,144-182`, `scripts/lint-blog-post.py:141-158,368-386`, `AttractionSearchController.kt:107`, `search/glossary.md`.

**E5.** `## Out of Scope` 를 다음으로 교체합니다: 「색인 스위치 켜기(ADR-0062 개정 승인 뒤 사용자), 편집 페이지 게시(검수 뒤 사용자), 속성 조합 랜딩, 정적 지도 이미지, ItemList 구조화 데이터, 영문 편집 페이지(D-1 ⓐ), 지역 페이지에서 랜딩으로 가는 링크(스위치를 켤 때 함께 — ADR-0062 §17 양방향 그래프).」

**E6.** `context/open-questions.yml` 에 Q2~Q4 를 추가합니다(아래 6절의 1·2·3번을 `stage: post-impl`, `status: open`, 권고 기본값을 `answer` 로).

**E7.** 문서 동기화 작업으로 다음 셋을 추가합니다.
- `search/glossary.md` 에 「속성 랜딩」「편집 페이지(guide)」「프리셋」「색인 스위치」 네 행
- `PlacePage.tsx:339` 주석을 「속성 칩 조작은 주소를 만들지 않는다 — 속성 주소는 `place-landings.json` 에 커밋된 랜딩뿐」으로 수정
- `docs/architecture/data-sources.md` 는 변경 없음(원천 추가 없음)

---

## 4. ADR-0062 개정 초안 (제안 — `context/adr-0062-amendment-draft.md` 에 둔다)

```markdown
### 18. place 속성 랜딩과 편집 페이지 (2026-10-09, 제안 — 승인 전)

**배경.** §2 는 게임 태그 랜딩을 「장르와 크게 겹쳐 얇은 페이지 양산」으로 기각했고, place 는 같은 이유로 속성 칩을 화면 상태로만 두었다(새 색인 URL 금지). §8 개정(2026-08-31)은 얇은 URL 이 도메인 다수를 차지하면 사이트 전체 평가가 떨어진다는 것을 AdSense 반려로 확인했다. 그런데 「{지역} 주차 가능 관광지」 류 질의에는 지금 착지할 주소가 없다(패싯 URL 0건).

**결정.** 속성 × 시군구 랜딩을 아래 조건을 **모두** 만족할 때만 색인 주소로 연다.
- 속성 하나 × 시군구 하나. 조합·정렬·반경 주소는 만들지 않는다.
- 결과 10건 이상(관광 분류 한정, 세는 값은 슬러그 표 하나로 정의).
- 언어별 속성당 5, 국·영 합산 20 상한.
- 같은 시군구 랜딩끼리 표시 목록 Jaccard ≤ 0.5, 랜딩 간 title·description 중복 0.
- 선정은 레포에 커밋한 목록이다. 빌드마다 다시 뽑지 않는다(주소가 빌드 사이에 생기거나 사라지지 않게).
- 목록 밖 조합은 404. 빌드 때 미달이면 404 가 아니라 noindex.
- 색인은 `copy.mjs` 의 `PLACE_LANDINGS_INDEXABLE` 한 줄로 연다. 이 개정을 수용하는 커밋에서 `true` 가 된다.
- 연 뒤 2~4주 Search Console 의 색인률·「발견됨-미색인」·소프트 404 를 보고 확대(S4-2) 또는 철회한다. 철회는 스위치를 `false` 로 되돌리는 것이고, 주소는 noindex 로 남겨 404 를 만들지 않는다.

**편집 페이지(`/guides/{slug}`)는 이 기각의 범위 밖이다.** 기각 대상은 기존 축의 부분집합을 기계적으로 펼친 페이지다. 편집 페이지는 사람이 고른 소수이고, 선정 이유·비교·주의가 본문이며, 검수자 없이는 published 가 될 수 없다(빌드 게이트). 색인 여부는 문서마다 `status` 가 정한다.

**대안.**
| 대안 | 기각 사유 |
|---|---|
| 빌드마다 자동 선정 | 경계 데이터가 흔들리면 주소가 생기고 사라져 측정 기간에 404 가 섞이고, 검수 없는 주소가 sitemap 에 오른다 |
| 허브 쿼리스트링 색인 | 조합 폭발 — 조합 주소 금지와 충돌 |
| 랜딩 없이 지역 페이지 본문만 보강 | 속성 질의의 제목·h1 이 맞지 않아 착지점이 되지 못한다 |

**결과.** 지역 페이지와 랜딩이 같은 시군구 목록의 일부를 공유한다. 중복도 게이트가 그 상한이다. 랜딩을 연 뒤 지역 페이지에서 랜딩으로 가는 링크를 더해 §17(양방향 그래프)을 맞춘다.
```

Status 줄에 덧붙일 문구: `2026-10-09 §18 — place 속성 랜딩(조건부, 스위치)·편집 페이지`.

---

## 5. 재리뷰 차원

| 차원 | 이유 | 볼 것 |
|---|---|---|
| architecture | SR-0 스위치, render-content/prerender 경계, `PlacePage` props | 스위치가 정말 한 곳에서만 읽히는지, 경계 문장이 기존 계약 테스트와 충돌하지 않는지 |
| implementation | 선정 시점 이동, nginx 정규식, 부분 실패 가드, `--body-only` 옵션 추가 | 산술(20 상한이 걸리는지), location 순서, lint 스크립트 수정이 최소 범위인지 |
| test-strategy | SR-5 전면 교체 | 각 회귀 주입이 컴파일되는 회귀로 빨강을 낼 수 있는지, nginx 스크립트의 판정 근거 |
| usecase | 게시 절차, 미달 noindex, 404 정책 | 운영자 흐름의 끝점과 철회 경로 |
| domain | 슬러그 표 (pet=ALLOWED, 무장애=WHEELCHAIR) | 이름과 센 값의 일치 |
| security | 카드 고정 템플릿 | 표지 `data-guide-card` 치환이 render-content check 이후라는 점과 이스케이프 범위 |

---

## 6. 사용자 판단 항목 (권고 기본값)

1. **ADR-0062 §18 개정 승인과 `PLACE_LANDINGS_INDEXABLE` 켜기.** 권고: 꺼진 채로 배포하고, 목록 검수(조건 정확성 표본) 결과를 본 뒤 승인 커밋에서 켭니다.
2. **슬러그 정의 — `pet` 을 ALLOWED 로만 셀지, PARTIAL 까지 합할지. 무장애를 휠체어로만 셀지.** 권고: ALLOWED 만, WHEELCHAIR 만. 이름(「반려동물 동반」 · 「휠체어 이용」)과 센 값이 어긋나지 않게 하기 위해서입니다.
3. **수치 — 하한 10 / 언어별 속성당 5 / 합산 20 / Jaccard 0.5.** 권고: 그대로 둡니다. 계획의 「10~20장」과 맞고, 두 상한이 모두 실제로 걸립니다.
4. **편집 초안을 공개 주소(200 · noindex)로 열어 둘지.** 기존 Q1 의 연장입니다. 권고: 공개 noindex. 검수를 실제 화면에서 할 수 있고, noindex 와 sitemap 제외로 색인 면은 닫혀 있습니다.
5. **빌드 때 미달한 랜딩의 처리.** 권고: noindex 로 남깁니다. 301 로 지역 페이지에 보내는 안은 데이터가 회복돼도 되돌리기 어렵습니다.

NOTES: 랜딩은 지역 페이지로 올라가는 링크만 있고 지역 페이지에서 내려오는 링크가 스펙에 없습니다. ADR-0062 §17(양방향 그래프)에 걸리므로 E5 의 Out of Scope 에 「스위치를 켤 때 함께」로만 적어 두었습니다. 새 발견으로 판정하지는 않았습니다.