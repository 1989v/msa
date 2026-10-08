# spec-review 2라운드 판정: place 롱테일 속성 랜딩 + 편집 페이지

**결론: 14건 모두 유지합니다(REVISE 11 · MINOR 3). 강등과 기각은 없습니다.** 발견마다 인용된 `file:line` 을 워크트리에서 직접 열어 확인했고, 결론을 뒤집는 반증은 없었습니다.

인용 위치가 어긋난 것은 셋이고, 판정은 바뀌지 않습니다.
- **AR2-1**: 리뷰어가 「프리렌더가 분류 목록을 따로 들고 있다」의 근거로 든 `prerender-seo.mjs:1029` 는 `SLICE_CATEGORIES`(전체 10분류)입니다. 관광 분류 4종이 아닙니다. 다만 node 쪽에 `SIGHT_CATEGORIES` 가 아예 없다는 사실은 grep 으로 확인됐고, 이것이 지적의 핵심입니다.
- **I2-1**: 허브 비교 줄은 `:569` 가 아니라 `PlacePage.tsx:570`, `screenRef` 는 `:423` 이 아니라 `:424` 입니다.
- **D2-1**: 라벨 원문 위치는 `phase2-barrierfree-labels.md:40-55` 입니다.

---

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 | 처리 |
|---|---|---|---|---|
| H1 상수의 자리와 결정 고정 | AR2-1, T2-1 | keep | REVISE | 상수 전부를 `copy.mjs` 에 두고 TS 는 re-export. 결정 수치는 리터럴 단언으로 고정 (SR-4 교체) |
| H2 N 의 정의 | D2-2, I2-3 | keep | REVISE | N = 필터 질의의 `totalElements`. M(전체 건수)은 문장에서 뺌 |
| H3 선정 함수 입력과 목록 수명 | I2-2, U2-1 | keep | REVISE | SR-1.3 교체. 입력에 `ids`·`previous` 추가, 빠진 항목은 `retired` 로 남김 |
| H4 코드 자릿수 | I2-1 | keep | REVISE | `sigunguCode = code.slice(2)` 를 명시 |
| H5 이름과 센 값 | D2-1 | keep | REVISE | 국문 이름을 「휠체어 대여」로 |
| H6 SPA 카드 주입과 표지 | S2-1, S2-2 | keep(S2-2 MINOR) | REVISE | 카드는 React 요소로, 표지 id 형식과 머리말 집합 검사 |
| H7 게시 후 복구 | U2-2 | keep | REVISE | 실패 메시지 형식과 복구 커밋을 명시 |
| H8 회귀 주입 · 실행 시점 | T2-2, T2-3 | keep(T2-3 MINOR) | REVISE | 무동작 주입 교체, nginx 스크립트는 수동 실행으로 기록 |
| H9 문체 게이트 | I2-4 | keep | MINOR | 장 구성 맨 앞에 요약 표 |

---

## 2. 발견별 JSON

```json
[
  { "id": "AR2-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/api/placeApi.ts", "line": 332, "quote": "export const SIGHT_CATEGORIES = ['nature', 'history', 'culture', 'leisure'] as const;" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 97, "quote": "} from '../src/seo/copy.mjs';" },
      { "file": "portal-fe/src/components/ads/AdSlot.tsx", "line": 2, "quote": "import { ADSENSE_CLIENT, ADSENSE_SLOTS } from '../../seo/copy.mjs';" } ],
    "reason": "node 스크립트에는 SIGHT_CATEGORIES 가 없고(grep 0건) TS 파일은 node 에서 import 할 수 없다. 반면 node·TS 둘 다 copy.mjs 를 import 하는 선례가 있어 상수 자리를 옮기면 해소된다. 인용 :1029 는 SLICE_CATEGORIES 라 근거가 부정확하지만 결론은 그대로다." },
  { "id": "D2-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAccessibility.kt", "line": 24, "quote": "Key(\"wheelchair\", \"WHEELCHAIR\", \"휠체어\", \"Wheelchairs\")," },
      { "file": "docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-barrierfree-labels.md", "line": 40, "quote": "| 대여가능 (3) | 있음 | 맞음 |" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 26, "quote": "| `barrier-free` | `barrierFree=WHEELCHAIR` | `barrierFree.WHEELCHAIR` | `bfWheelchair` | 휠체어 이용 | — | ko |" } ],
    "reason": "표본 원문 17행 중 16행이 대여·보유 안내이고 「이동 가능」은 1행뿐이다. 「휠체어 이용」은 센 값보다 넓은 약속이다." },
  { "id": "D2-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt", "line": 191, "quote": "/** 건수는 결과의 부속이다 — 실패·지연은 경고만 남기고 건수 없이 간다. */" },
      { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt", "line": 194, "quote": "/** 속성 패싯 건수. 건수 요청이 실패하면 null — 결과는 그대로 온다. */" },
      { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt", "line": 189, "quote": "val totalElements: Long," } ],
    "reason": "facet 은 정상 경로에서도 null 이 되고, undefined < 10 은 false 라 스위치를 켠 뒤 noindex 가 풀린다. totalElements 는 null 이 될 수 없는 Long 이다." },
  { "id": "I2-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/RegionPage.tsx", "line": 116, "quote": "...(isSido ? { sidoCode: code } : { sidoCode: parentCode!, sigunguCode: code.slice(2) })," },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 570, "quote": "? regionName((sigunguRegions ?? []).find((r) => r.code.slice(2) === sigunguCode))" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 424, "quote": "const screenRef = sidoCode ? sidoCode + (sigunguCode ?? '') : '';" } ],
    "reason": "허브 상태와 API 는 시군구 3자리를 쓰는데, 스펙의 항목 code 는 5자리이고 변환 규칙이 없다(인용 줄 번호는 :569→:570, :423→:424 로 어긋남)." },
  { "id": "I2-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt", "line": 202, "quote": "data class AttributeFacets(" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 31, "quote": "선정 규칙(순수 함수 `selectLandings(facetsBySigungu, regions)`" } ],
    "reason": "AttributeFacets 는 건수 맵뿐이라 id 가 없어, :36 의 Jaccard 를 이 입력으로 계산할 수 없다." },
  { "id": "I2-3", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt", "line": 223, "quote": "val others = selected.filterKeys { it != bucket.facet }.values.toList()" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 40, "quote": "관광지 {N}곳(전체 {M}곳 중) — 원천 갱신 기준 {asOf}" } ],
    "reason": "속성 하나를 건 랜딩 질의의 응답에는 속성을 뺀 전체 건수가 없어, SPA 가 M 을 만들 수 없다. 그러면 :113 의 「SPA 문장 = 프리렌더 문장」 단언이 성립하지 않는다." },
  { "id": "I2-4", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "scripts/lint-blog-post.py", "line": 339, "quote": "def check_summary_first(body: str, r: Result) -> None:" },
      { "file": "scripts/lint-blog-post.py", "line": 381, "quote": "check_frontmatter(parse_frontmatter(fm_raw), r)" } ],
    "reason": "--body-only 로 F1 만 건너뛰어도 F8 은 그대로 돌고, SR-3.6 장 구성에는 첫 h2 앞 요약이 없다. lint 가 잡아 주므로 MINOR." },
  { "id": "S2-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/tech/SearchArchitecturePage.tsx", "line": 62, "quote": "<article className=\"ts-doc ts-body\" dangerouslySetInnerHTML={{ __html: bodyHtml }} />" },
      { "file": "portal-fe/scripts/render-content.mjs", "line": 140, "quote": "check(html, figures.length);" } ],
    "reason": "선례 화면은 생성 HTML 을 그대로 주입하고, 카드는 check() 뒤에 생긴다. SPA 의 주입 방식이 정해지지 않으면 외부 원천 문자열이 이스케이프 없이 DOM 에 들어갈 길이 열려 있다." },
  { "id": "S2-2", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/nginx.conf", "line": 192, "quote": "location ~ \"^/(?<render_lang>en/)?attractions/(?<render_id>[0-9]{1,12})$\" {" },
      { "file": "portal-fe/scripts/render-content.mjs", "line": 144, "quote": "function check(html, fenceCount) {" } ],
    "reason": "check() 는 data-* 속성 값을 보지 않는다. 원본이 레포 md 라 위험도는 낮아 MINOR." },
  { "id": "T2-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 78, "quote": "테스트는 그 상수와 대상 함수의 출력으로 기대값을 계산한다" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 124, "quote": "- 하한 10→9" } ],
    "reason": "상수에서 기대값을 계산하는 테스트는 상수를 바꾸면 함께 움직여서, 이 주입은 빨강을 내지 못한다(검사가 자기 값을 잼)." },
  { "id": "T2-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/nginx.conf", "line": 232, "quote": "location ~ ^/(en/)?(regions)/([A-Za-z0-9][A-Za-z0-9._-]*)$ {" },
      { "file": "portal-fe/nginx.conf", "line": 331, "quote": "location / {" } ],
    "reason": "지역 정규식은 세그먼트 하나뿐이라 두 세그먼트인 랜딩 경로와 겹치지 않는다. 순서를 바꾸는 주입은 무동작이고, location 을 지워야 location / 가 200 을 낸다." },
  { "id": "T2-3", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/scripts/check-nginx-legacy-regions.sh", "line": 22, "quote": "if ! docker info >/dev/null 2>&1; then" } ],
    "reason": "git grep 'check-nginx-' 결과 docs/ 밖에서 이 스크립트를 부르는 곳이 0건이다(CI·.githooks 포함). 실행 시점과 exit 2 처리를 문서로 정하면 되어 MINOR." },
  { "id": "U2-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 45, "quote": "404 로 지우지 않는다 — 이미 색인된 주소를 빌드 사이에 없애지 않는다). 목록 갱신은 스크립트를 다시 돌려 커밋하는 사람의 일이다." },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 44, "quote": "try_files /prerender/$1regions/$2/$3.html =404;" } ],
    "reason": "스크립트가 처음부터 다시 뽑으면 빠진 항목의 파일이 사라져 404 가 난다. 같은 스펙이 빌드 경로에서 막은 일이 스크립트 경로에서 일어난다." },
  { "id": "U2-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/render-content.mjs", "line": 8, "quote": "// 어기면 빌드를 세운다. 이미지 빌드가 실패하면 Argo 가 직전 이미지를 유지한다." },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 64, "quote": "관광지가 404 면 draft 는 그 카드를 빼고 경고하고, published 는 빌드를 실패시킨다." } ],
    "reason": "원천에서 일어난 사건이 portal-fe 전 호스트의 배포를 막는데, 복구 절차가 없다." }
]
```

---

## 3. spec.md 편집 목록

줄 번호는 현재 `spec.md` 기준입니다. 아래에서 위로 반영하면 줄 번호가 밀리지 않습니다.

**R2-E1. 6행**을 교체합니다.
```text
> 개정 2026-10-09 — 1라운드 심판(33건 중 31 유지·2 강등, `context/review-verdict-round1.md`)과 2라운드 심판(14건 전부 유지, `context/review-verdict-round2.md`) 반영. 사용자 판단 Q2~Q9 는 권고 기본값.
```
(부모가 이 판정문을 `context/review-verdict-round2.md` 로 저장합니다.)

**R2-E2. 26행**(D2-1)을 교체합니다.
```text
   | `barrier-free` | `barrierFree=WHEELCHAIR` | `barrierFree.WHEELCHAIR` | `bfWheelchair` | 휠체어 대여 | — | ko |
```
**29행 끝**에 다음 문장을 덧붙입니다.
```text
`barrier-free` 의 이름은 「휠체어 대여」다 — 원천 `wheelchair` 칸의 긍정 원문은 대부분 대여·보유 안내라(`docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-barrierfree-labels.md:40-55`) 「휠체어로 이용 가능」(접근성)을 약속하지 않는다. 허브 칩 라벨(「휠체어」, `placeAttributes.ts`)은 바꾸지 않는다.
```

**R2-E3. 30행 SR-1.2**(AR2-1 · D2-2)를 교체합니다.
```text
2. 분류와 N: 선정·집계·목록·SPA 첫 질의는 모두 `category=SIGHT_CATEGORIES.join(',')` 를 건다. `SIGHT_CATEGORIES` 는 `copy.mjs` 에 하나만 정의한다(SR-4.1) — `RegionPage.tsx:117-119`, `PlacePage.tsx:377-379`, 선정 스크립트, 프리렌더가 같은 배열을 쓴다. N(랜딩 건수)은 이 분류 필터 + SR-1.1 의 검색 파라미터 하나 + `sidoCode`·`sigunguCode`(SR-1.10)로 건 질의의 `totalElements` 다. facet 건수는 N 으로 쓰지 않는다 — facet 은 시간 초과·실패 때 `null` 로 오고 결과는 200 이다(`AttractionSearchAdapter.kt:191-205`). 프리렌더 N 과 SPA N 이 같은 질의에서 나온다.
```

**R2-E4. 31~37행 SR-1.3 전체**(I2-2 · U2-1 · D2-2 · I2-3)를 교체합니다.
```text
3. 선정은 빌드가 아니라 스크립트가 한다: `node scripts/select-place-landings.mjs` 가 `portal-fe/src/content/place-landings.json` 을 갱신하고 이것을 커밋한다. 빌드는 목록을 읽기만 한다. 순서:
   ① 언어마다 모집단 시군구 하나에 분류 필터만 건 `facets=true` 질의 1회 → facet 건수 ≥ `PLACE_LANDING_MIN_RESULTS` 인 (시군구, 속성)을 예비 후보로 둔다. facet 이 `null` 이면 스크립트를 실패로 끝낸다(조용히 건너뛰지 않는다 — 다시 돌린다).
   ② 예비 후보마다 SR-1.2 의 필터 질의(size 30) 1회 → `totalElements`(= N)와 상위 30건 id.
   ③ 순수 함수 `selectLandings({ regions, candidates, previous })` 가 목록을 낸다. `candidates` 는 ② 의 결과 `{ lang, code, attr, count: totalElements, ids }` 배열, `previous` 는 지금 커밋된 `place-landings.json` 항목 배열이다. 조회는 함수 밖에서 `get` 주입으로 한다(선례 `fetchSidoSlice`).
   선정 규칙:
   - 모집단: 그 언어의 `administrative-regions` 시군구 행(지역 페이지가 있는 코드)만. 시군구 행이 없는 시도는 후보 없음.
   - 후보: `count` ≥ `PLACE_LANDING_MIN_RESULTS` 인 (언어, 시군구, 속성).
   - 정렬: 건수 내림차순 → 언어(ko 먼저) → 코드 오름차순.
   - 상한: 언어별 속성당 5, 국·영 합산 전체 20. `retired` 가 아닌 항목만 센다. 정렬 순서대로 채우며 둘 중 하나라도 차면 건너뛴다.
   - 중복도: 같은 언어·같은 시군구에서 이미 뽑힌 랜딩과 `ids` 의 Jaccard 가 0.5 를 넘으면 건너뛴다.
   - 기존 항목 유지: `previous` 에 있던 (lang, code, attr) 가 이번에 뽑히지 않으면 지우지 않고 `retired: true`·`retiredAt`(KST 날짜)을 달아 남긴다. 다시 뽑히면 `retired`·`retiredAt` 을 지우고 `selectedAt` 은 처음 값을 유지한다. 항목은 목록에서 빠지지 않는다 — 한 번 생긴 주소는 404 가 되지 않는다(SR-1.7 과 같은 원칙).
   - 항목 필드: `lang, code, sidoCode, attr, count, jaccardMax, selectedAt`(KST 날짜), 선택 필드 `retired, retiredAt`.
```

**R2-E5. 38행**: `{ count, total, asOf }` 를 `{ count, asOf }` 로 바꿉니다.

**R2-E6. 40행**(I2-3 ⓐ · D2-2)을 교체합니다.
```text
   - sentence 국문 「{시도} {시군구}에서 {속성 국문 이름} 관광지 {N}곳 — 원천 갱신 기준 {asOf}」. N 은 SR-1.2 의 `totalElements` 다. `asOf` 가 없으면 「— 원천 갱신 기준」 꼬리를 뺀다. N 이 없으면(결과 전) 문장 자체를 내지 않는다. 전체 건수(M)는 싣지 않는다 — 속성 필터 질의의 응답에는 속성을 뺀 전체 건수가 없다(facet 은 자기 속성 선택만 빼고 센다, `AttractionSearchAdapter.kt:223`).
```

**R2-E7. 45행 SR-1.7**(U2-1)을 교체합니다.
```text
7. 빌드 시 데이터 미달·은퇴: 목록 항목의 현재 N(SR-1.2)이 `PLACE_LANDING_MIN_RESULTS` 미만이거나 항목이 `retired` 면 그 페이지는 그대로 만들되 noindex·sitemap·llms 제외로 내고, 미달은 빌드 로그에 경고한다(404 로 지우지 않는다 — 이미 생긴 주소를 빌드 사이에 없애지 않는다). 목록 갱신은 스크립트를 다시 돌려 커밋하는 사람의 일이고, 스크립트도 항목을 지우지 않는다(SR-1.3 기존 항목 유지).
```

**R2-E8. 47행 SR-1.9**를 교체합니다.
```text
9. sitemap·llms: `PLACE_LANDINGS_INDEXABLE && !retired && N ≥ 하한` 인 항목만. hreflang 은 같은 (code, attr) 가 국·영 둘 다 목록에 있고 둘 다 실릴 때만.
```
**47행 뒤**에 SR-1.10 을 새로 넣습니다(I2-1).
```text
10. 코드 자릿수: 주소·목록 항목의 `code` 는 5자리(시도 2 + 시군구 3)다. 검색 API 의 `sigunguCode` 는 3자리라서, 선정 스크립트·프리렌더·SPA 프리셋 모두 `sidoCode = code.slice(0, 2)`, `sigunguCode = code.slice(2)` 로 넘긴다(선례 `RegionPage.tsx:116`, 허브 비교 `PlacePage.tsx:570`).
```

**R2-E9. 50행 SR-2.1**에서 `<PlacePage preset={{ sidoCode, sigunguCode, attribute: 칩 id, seo }} />` 를 다음으로 바꿉니다.
```text
<PlacePage preset={{ sidoCode: entry.sidoCode, sigunguCode: entry.code.slice(2), attribute: 칩 id, retired: entry.retired === true, seo }} />
```

**R2-E10. 52행 SR-2.3**을 교체합니다.
```text
3. 화면 위에 `landingMeta` 의 heading·sentence 를 보인다. N 은 프리셋 첫 결과의 `totalElements` 다(facet 아님 — SR-1.2).
```

**R2-E11. 54행 SR-2.5**(D2-2 · U2-1)를 교체합니다.
```text
5. noindex = `!PLACE_LANDINGS_INDEXABLE || preset.retired || 첫 결과 전 || 프리셋 첫 결과 totalElements < PLACE_LANDING_MIN_RESULTS`. 값이 없는 것을 통과로 세지 않는다. 프리렌더와 같은 규칙이고, 조건을 바꾼 뒤에는 다시 계산하지 않는다.
```

**R2-E12. 61행**(S2-2)을 교체합니다.
```text
   - 본문 안 관광지 자리는 `<div data-guide-card="{id}"></div>` 표지로 남는다. render-content 는 표지 값이 `^[0-9]{1,12}$`(nginx 상세 id 규칙 `nginx.conf:192` 와 같음)인지, 본문 표지 id 집합이 머리말 `attractionIds` 집합과 같은지 검사하고, 어긋나면 빌드를 실패시킨다.
```
**63행**(S2-1)을 교체합니다.
```text
   - SPA 는 같은 JSON 과 같은 엔드포인트로 런타임에 그린다. 본문 HTML 을 표지 기준으로 나눠, 표지 사이 조각(render-content `check()` 를 통과한 레포 원본)만 `dangerouslySetInnerHTML` 로 넣고 카드는 React 요소로 그린다. API 응답 문자열을 HTML 문자열에 이어 붙이지 않는다.
```

**R2-E13. 68행**(I2-4): 「각 장에 선정 이유(데이터 기준 문장)」를 「각 장에 첫 h2 앞 요약 표(후보 이름·핵심 조건 — lint F8) · 선정 이유(데이터 기준 문장)」로 바꿉니다.

**R2-E14. 74행 뒤**(U2-2)에 다음 줄을 넣습니다.
```text
   빌드 실패 복구: published 편집 페이지의 관광지가 404 면 빌드 실패 메시지에 원본 파일 경로와 관광지 id 를 적는다. portal-fe 이미지 하나에 전 호스트가 실려 있어 이 실패가 무관한 FE 배포까지 막으므로, 복구는 그 id 를 본문 표지·`attractionIds` 에서 빼거나 `status: draft` 로 되돌리는 커밋 하나다.
```

**R2-E15. 77~78행 SR-4 전체**(AR2-1 · T2-1)를 교체합니다.
```text
### SR-4 상수와 테스트에 고정할 결정
1. 상수의 자리: 슬러그 표(SR-1.1 의 attr·검색 파라미터·facet 키·칩 id·국문/영문 이름·언어), `SIGHT_CATEGORIES`, `PLACE_LANDING_MIN_RESULTS`(10)·속성당 상한(5)·합산 상한(20)·Jaccard 상한(0.5)은 `portal-fe/src/seo/copy.mjs` 에만 정의한다. node 스크립트(`select-place-landings.mjs`·`prerender-seo.mjs`)는 이 파일을 직접 import 한다(선례 `prerender-seo.mjs:97`). `src/api/placeApi.ts` 의 `SIGHT_CATEGORIES` 는 `export { SIGHT_CATEGORIES } from '../seo/copy.mjs'` 로 바꾼다(선례 `AdSlot.tsx:2` — TS 가 copy.mjs 를 import). 슬러그 표의 칩 id 는 `placeAttributes.ts` 의 `ATTRIBUTE_CHIPS` id 중 하나여야 하고, 테스트 하나가 이를 대조한다. 같은 값을 다른 파일에 리터럴로 다시 적지 않는다.
2. 결정 수치 고정: 테스트 파일 하나가 `expect(PLACE_LANDING_MIN_RESULTS).toBe(10)`, 속성당 5, 합산 20, Jaccard 0.5, 슬러그 표 4행(attr·facet 키·국문 이름), `SIGHT_CATEGORIES` 값을 리터럴로 단언한다. 이것은 사용자 결정(Q4·Q3)을 고정하는 단언이라, 상수를 바꾸는 커밋은 이 단언도 함께 바꿔야 한다.
3. 출력 비교: 그 밖의 기대값(문장·제목·경계 픽스처)은 상수와 대상 함수의 출력으로 계산한다 — 테스트 안에서 문장을 다시 조립하지 않는다(선례 `SearchArchitecturePage.test.tsx:6`). 2 와 3 은 다르다. 2 는 숫자 결정을 고정하고, 3 은 그 숫자를 쓰는 코드가 같은 값을 쓰는지 본다.
```

**R2-E16. SR-5.1 수정**(85·89·92·96·105·113행 주변)
- 85행을 「- 합산 상한: 국 20 + 영 10 후보(전부 같은 건수)에서 20, ko 먼저 — 1차 정렬이 건수라 「ko 먼저」는 건수가 같을 때만 성립한다」로 교체합니다.
- 89행 뒤에 다음 넷을 넣습니다.
```text
     - Jaccard 는 입력 `ids` 로 센다: 30 id 중 21 공유(0.538) → 제외, 20 공유(0.5) → 포함
     - 기존 항목 유지: `previous` 에 있고 이번에 안 뽑힌 항목 → `retired: true` 로 남음 · 상한 계산에서 빠짐 · 다시 뽑히면 `retired` 해제·`selectedAt` 유지
     - `count` 는 `totalElements` 다(facet 건수와 다른 픽스처에서 `totalElements` 를 씀)
     - 스크립트 main: facet `null` 응답 → 실패 종료(`get` 주입)
```
- 96행 뒤에 다음 둘을 넣습니다.
```text
     - `retired` 항목 → noindex·sitemap·llms 제외, 파일은 생성
     - facet `null` + `totalElements` 12 → 문장에 12, N 판정 통과
```
- 105행 「카드 이스케이프」를 「카드 이스케이프(프리렌더 출력과 SPA 렌더 둘 다 — 픽스처 이름 `<script>` 가 평문)」로 바꾸고, 그 뒤에 다음 둘을 넣습니다.
```text
     - 표지 id 형식 위반(`abc`)·`attractionIds` 와 표지 집합 불일치 → render-content 실패
     - published 카드 404 → 실패 메시지에 파일 경로와 id
```
- 113행 뒤에 다음 셋을 넣습니다.
```text
     - 프리셋 질의 인자 `sigunguCode` 가 3자리(`code.slice(2)`)
     - 첫 결과 facet `null` 이어도 N = `totalElements` 로 표시, 결과 전에는 noindex
     - `retired` 항목 → 화면은 그리고 noindex
```

**R2-E17. SR-5.2 끝(122행 뒤)**(T2-3)에 다음을 넣습니다.
```text
   실행 시점: CI·훅에 걸지 않는다(선례 두 스크립트도 수동 실행이다). 태스크 검증 단계에서 사람이 돌리고 출력 전문을 `verifications/` 에 남긴다. exit 2(도커 없음)는 통과로 세지 않는다 — 그 경우 검증 미완료로 보고한다.
```

**R2-E18. SR-5.3**(T2-1 · T2-2 및 새 규칙의 주입)
- 124행을 「- 하한 10→9(SR-4.2 고정 단언이 빨강)」로 교체하고, 그 뒤에 「- 선정 함수 비교 `>=` → `>`(경계 테스트가 빨강)」를 넣습니다.
- 130행을 「- 랜딩 location 삭제(`location /` 가 받아 `/regions/11110/foo` 가 200 → 빨강)」로 교체합니다.
- 135행 뒤에 다음을 넣습니다.
```text
   - 선정 스크립트가 `previous` 항목을 버림(기존 항목 유지 테스트가 빨강)
   - SPA N 을 facet 건수로(facet `null` 픽스처에서 빨강)
   - 프리셋 `sigunguCode` 를 5자리로
   - SPA 카드를 HTML 문자열 결합으로(SPA 이스케이프 테스트가 빨강)
   - 표지 id 형식 검사 제거
```

**R2-E19. 145행 Existing Code to Leverage 끝**에 다음을 덧붙입니다.
```text
`AttractionSearchAdapter.kt:191-205,223`, `SearchAttractionUseCase.kt:189,194`, `placeApi.ts:332`, `nginx.conf:192,232,331`, `SearchArchitecturePage.tsx:50,62`, `render-content.mjs:8,140`, `lint-blog-post.py:339-365`, `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-barrierfree-labels.md:40-55`
```

**R2-E20. `context/open-questions.yml`**
- Q3 의 answer 를 「pet=ALLOWED 만, barrier-free=WHEELCHAIR 만, 국문 이름 「휠체어 대여」(권고)」로 바꿉니다.
- 아래 6절의 2~5번을 Q7~Q9·Q10 이 아니라 **Q7 · Q8 · Q9** 세 개로 넣습니다(2번은 Q3 에 흡수했으므로 3·4·5번만 해당). 모두 `stage: post-impl`, `status: open`, 권고 기본값을 answer 로 둡니다.

---

## 4. 3라운드(마지막) 재리뷰 차원

| 차원 | 볼 것 |
|---|---|
| implementation | ① N 의 출처가 스펙 전체에서 하나인지 — `facet` 이 나오는 모든 줄이 「예비 후보 선별」(SR-1.3 ①) 한 곳뿐인지 grep 으로 확인. ② `retired` 가 선정·프리렌더·sitemap·llms·SPA noindex 다섯 곳에 빠짐없이 적혔는지. ③ `SIGHT_CATEGORIES` 를 mjs 로 옮기면 `as const` 리터럴 타입이 사라지는데, `PlacePage.tsx:379,1346` 의 사용처가 타입 오류 없이 컴파일되는지(`allowJs` 는 `tsconfig.app.json:16` 에 켜져 있음) |
| test-strategy | 새로 넣은 주입 5개가 각각 컴파일되는 회귀로 빨강을 내는지. SR-4.2 고정 단언과 SR-4.3 계산 비교가 같은 테스트 안에서 섞이지 않았는지 |
| usecase | 목록 수명주기 전체: 선정 → 은퇴 → 재선정 → 스위치 켜기 → 철회. 항목 수가 20 을 넘어 쌓일 때의 운영 부담 |
| security | SPA 분할 렌더에서 표지 사이 조각이 render-content `check()` 를 거친 문자열뿐인지(카드 영역이 innerHTML 경로로 새지 않는지) |
| domain | 「휠체어 대여」 문구가 heading·title·sentence·glossary 에 같은 이름으로 쓰였는지 |
| architecture | 상수 자리 한 곳(`copy.mjs`)과 re-export 경로만 확인. 나머지는 2라운드에서 충족됨 |

---

## 5. 사용자가 정할 것 (권고 기본값)

1. **무장애 랜딩의 이름.** 권고는 「휠체어 대여」입니다. 칩 라벨과 같은 「휠체어」로 두면 제목이 「… 휠체어 관광지」라 뜻이 흐려지고, 「휠체어 이용」은 센 값보다 넓은 약속이 됩니다. (기존 Q3 에 흡수)
2. **문장의 「전체 M곳 중」.** 권고는 빼는 것(ⓐ)입니다. 빌드 시점 값으로 넣는 안(ⓑ)은 N(현재값)과 M(선정일 값)의 기준 날짜가 갈립니다. (Q7)
3. **선정에서 빠진 랜딩을 404 로 지울지.** 권고는 지우지 않고 `retired`·noindex 로 남기는 것입니다. 스위치가 꺼진 동안은 색인된 주소가 없어 지워도 피해는 없습니다. 그래도 규칙이 하나면 스위치를 켠 뒤에 예외를 따로 기억할 필요가 없습니다. (Q8)
4. **게시된 편집 페이지의 관광지가 404 일 때.** 권고는 지금처럼 빌드를 실패시키고, 복구는 커밋 하나로 하는 것입니다(R2-E14). 대안은 draft 처럼 카드만 빼고 경고하는 것인데, 검수받은 비교 표가 조용히 틀린 채 나갈 수 있습니다. (Q9)
5. SPA 카드 렌더 방식(React 요소)과 결정 수치 고정 방식(리터럴 단언 + 비교 연산자 주입)은 사용자 판단이 아니라 스펙에 확정해 넣었습니다.

---

SUMMARY: keep 14 / demote 0 / dismiss 0

NOTES: SR-1.6 의 「지역 location 바로 앞에」는 T2-2 대로 순서가 결과에 영향을 주지 않지만 해롭지 않아 그대로 둡니다. SPA 첫 페이지 크기는 30(`PlacePage.tsx:395`)이라 「표시 30건의 modifiedAt 최댓값」 asOf 는 프리렌더와 SPA 에서 같은 집합으로 계산됩니다.

관련 경로:
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-longtail-landings/spec.md`
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-longtail-landings/context/engineer-review-round2.md`
- `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-longtail-landings/context/open-questions.yml`