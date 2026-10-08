# 3라운드 판정 결과: 10건 모두 유지

발견 10건이 인용한 `file:line` 을 전부 직접 열어 보았고, 모두 리뷰가 적은 그대로였습니다. 유지 10 · 강등 0 · 기각 0 입니다. 강등이나 기각을 받칠 증거(표준에 수용된 패턴, 레포에 같은 패턴 실존, 인용과 원문 불일치)는 한 건도 찾지 못했습니다.

BLOCK 은 없습니다. 열 건 모두 스펙 결정과 코드 위반을 함께 인용하지 않았고, 리뷰도 BLOCK 을 매기지 않았습니다. 등급은 리뷰가 매긴 대로 유지했습니다(REVISE 4, MINOR 6).

## 묶음 표

| 묶음 | 발견 | 판정 | 등급 | 핵심 근거 |
|---|---|---|---|---|
| 선정 입력 모양 | I3-1 | keep | REVISE | `spec.md:34` 의 `candidates` 에 facet 이 없다. 그런데 `:90,97,101` 은 「선정 함수:」(`:91`) 아래에서 facet 을 전제한다 |
| 은퇴 항목 파급 | I3-2 | keep | REVISE | 형제 링크(`:46`)와 편집 링크(`:74`)에는 은퇴 조건이 없다. 은퇴 항목은 목록에 영구히 남는다(`:41`). sitemap(`:52`)만 은퇴를 뺀다 |
| | U3-1 | keep | REVISE | 옛 지역 301 정규식 `regions/(29\|46)([0-9]{3})?$` 는 세그먼트 하나만 받는다(`nginx.conf` 레거시 블록). 모집단 밖 항목을 어떻게 처리할지 스펙에 규칙이 없다 |
| | U3-2 | keep | MINOR | `:39` 상한은 활성 항목만 센다. `:41` 은 항목을 지우지 않는다. `:50` 은 은퇴 항목도 조회해 페이지를 만든다. 그래서 목록이 계속 늘어난다 |
| | U3-3 | keep | MINOR | ADR 초안 `:12,14-15` 에 은퇴 규칙이 없고, 상한 20 이 활성 항목 기준이라는 말도 없다 |
| 표지 해석 | I3-4 | keep | MINOR | `:67` 의 검사와 `:69` 의 분할이 각자 표지를 해석한다. `render-content.mjs:144-182` `check()` 는 `data-*` 를 보지 않는다 |
| | T3-1 | keep | REVISE | `:121` 은 형식 위반과 집합 불일치를 한 줄에 묶었다. 그래서 `abc` 픽스처는 형식 검사를 지워도 집합 검사에 걸려 실패하고, `:162` 주입이 빨강이 되지 않는다 |
| 테스트 픽스처 | T3-2 | keep | MINOR | `:87` 은 「경계 픽스처는 계산한다」고 한다. 그런데 `:92`·`:99` 는 리터럴이다 |
| | T3-3 | keep | MINOR | `:161` 은 「HTML 문자열 결합」만 적어, 이스케이프를 거친 결합이면 `:120` 이 초록이다 |
| 주석 | I3-3 | keep | MINOR | `placeApi.ts:330` 「여기 한 곳에 둔다」는 SR-4.1 이 정의를 옮기면 거짓이 된다 |

## 발견별 JSON

```json
[
  { "id": "I3-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 34, "quote": "`candidates` 는 ② 의 결과 `{ lang, code, attr, count: totalElements, ids }` 배열" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 90, "quote": "픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양 그대로이고" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 97, "quote": "`pet.PARTIAL`·`ELEVATOR` 는 N 에 안 들어감" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 101, "quote": "`count` 는 `totalElements` 다(facet 건수와 다른 픽스처에서 `totalElements` 를 씀)" } ],
    "reason": "선정 함수 입력에는 facet 이 없는데 그 아래 세 줄이 facet 을 전제하므로, 원문이 발견과 일치해 유지한다." },
  { "id": "I3-2", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 46, "quote": "형제 링크(같은 언어 목록 안의 같은 시군구 다른 속성, 같은 시도 같은 속성; 0개면 생략)" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 74, "quote": "내부 링크(상세·지역, 목록에 있는 랜딩)" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 52, "quote": "`PLACE_LANDINGS_INDEXABLE && !retired && N ≥ 하한` 인 항목만" } ],
    "reason": "같은 목록을 두고 sitemap 은 은퇴를 빼고 링크 두 곳은 빼지 않아 규칙이 갈리므로 유지한다." },
  { "id": "I3-3", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/src/api/placeApi.ts", "line": 330, "quote": "화면마다 각자 배열을 들고 있던 게 원인이라 여기 한 곳에 둔다." },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 85, "quote": "`export { SIGHT_CATEGORIES } from '../seo/copy.mjs'` 로 바꾼다" } ],
    "reason": "SR-4.1 을 적용하면 주석이 사실과 달라지므로 유지한다." },
  { "id": "I3-4", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 67, "quote": "render-content 는 표지 값이 `^[0-9]{1,12}$`…인지…검사하고" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 69, "quote": "본문 HTML 을 표지 기준으로 나눠, 표지 사이 조각…만 `dangerouslySetInnerHTML` 로" },
      { "file": "portal-fe/scripts/render-content.mjs", "line": 144, "quote": "function check(html, fenceCount) {" } ],
    "reason": "검사와 분할의 해석 규칙이 두 곳에 따로 생기는 구조가 원문 그대로라 유지한다." },
  { "id": "T3-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 121, "quote": "표지 id 형식 위반(`abc`)·`attractionIds` 와 표지 집합 불일치 → render-content 실패" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 162, "quote": "표지 id 형식 검사 제거" } ],
    "reason": "`abc` 는 attractionIds 에 들어갈 수 없어 형식 검사를 지워도 집합 검사로 실패하므로, 주입이 빨강이 되지 않을 수 있다." },
  { "id": "T3-2", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 87, "quote": "그 밖의 기대값(문장·제목·경계 픽스처)은 상수와 대상 함수의 출력으로 계산한다" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 92, "quote": "9 제외·10 포함" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 99, "quote": "30 id 중 21 공유(0.538) → 제외, 20 공유(0.5) → 포함" } ],
    "reason": "스펙 안의 두 규칙이 서로 어긋난다." },
  { "id": "T3-3", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 161, "quote": "SPA 카드를 HTML 문자열 결합으로(SPA 이스케이프 테스트가 빨강)" } ],
    "reason": "이스케이프를 거친 결합이면 `:120` 테스트가 초록이라 주입 형태를 특정해야 하므로 유지한다." },
  { "id": "U3-1", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/nginx.conf", "line": 225, "quote": "location ~ \"^/(?<legacy_region_lang>en/)?regions/(29|46)([0-9]{3})?$\" {" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 41, "quote": "항목은 목록에서 빠지지 않는다 — 한 번 생긴 주소는 404 가 되지 않는다" },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 36, "quote": "모집단: 그 언어의 `administrative-regions` 시군구 행(지역 페이지가 있는 코드)만." } ],
    "reason": "코드 개편 선례가 실재하고 301 정규식이 랜딩 주소를 받지 않으며 모집단 밖 항목을 처리할 규칙이 스펙에 없다." },
  { "id": "U3-2", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 39, "quote": "`retired` 가 아닌 항목만 센다." },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/spec.md", "line": 50, "quote": "항목이 `retired` 면 그 페이지는 그대로 만들되 noindex·sitemap·llms 제외로 내고" } ],
    "reason": "항목을 지우지 않고 상한도 은퇴를 세지 않아 목록이 단조 증가한다는 점이 원문으로 확인돼 유지한다." },
  { "id": "U3-3", "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-longtail-landings/context/adr-0062-amendment-draft.md", "line": 12, "quote": "언어별 속성당 5, 국·영 합산 20 상한." },
      { "file": "docs/specs/2026-10-09-place-longtail-landings/context/adr-0062-amendment-draft.md", "line": 14, "quote": "선정은 레포에 커밋한 목록이다. 빌드마다 다시 뽑지 않는다" } ],
    "reason": "승인 대상 문서에 은퇴 규칙과 「활성 기준 20」이 없다." }
]
```

## 편집 목록

### spec.md

**E1 (I3-1).** SR-1.3 의 ③ 줄(「③ 순수 함수 `selectLandings({ regions, candidates, previous })` 가 목록을 낸다.」로 시작) 바로 앞에 새 줄을 넣습니다.
```text
   ①·② 는 `buildCandidates({ lang, regions, get })` 가 한다(`get` 주입). 슬러그 표의 facet 키로 예비 후보를 고르고, 필터 질의의 `totalElements` 를 `count` 로, 상위 30건 id 를 `ids` 로 싣는다. facet 이 `null` 이면 예외를 던진다.
```

**E2 (I3-1).** SR-5.1 첫 줄을 바꿉니다.
- 바꿀 문장: 「1. vitest. 픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양 그대로이고, `pet.PARTIAL`·`barrierFree.ELEVATOR` 값과 분류 필터 유무를 포함한다.」
```text
1. vitest. 후보 조립 픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양(`pet.PARTIAL`·`barrierFree.ELEVATOR` 값 포함) + 검색 응답(`totalElements`, 상위 30 id)이다. 선정 함수 픽스처는 `candidates` 모양이다. 둘 다 분류 필터 유무를 포함한다.
```

**E3 (I3-1).** 「선정 함수:」 아래에서 세 줄을 지웁니다.
- 「`pet.PARTIAL`·`ELEVATOR` 는 N 에 안 들어감」
- 「`count` 는 `totalElements` 다(facet 건수와 다른 픽스처에서 `totalElements` 를 씀)」
- 「스크립트 main: facet `null` 응답 → 실패 종료(`get` 주입)」

그리고 「선정 함수:」 블록 바로 앞(같은 들여쓰기)에 새 블록을 넣습니다.
```text
   - 후보 조립(`buildCandidates`):
     - `pet.PARTIAL`·`ELEVATOR` 는 예비 후보 판정에 안 들어감
     - `count` 는 `totalElements` 다(facet 건수와 다른 픽스처에서 `totalElements` 를 씀)
     - facet `null` 응답 → 예외(스크립트 실패 종료, `get` 주입)
```

**E4 (I3-1).** SR-5.3 의 「선정 스크립트가 `previous` 항목을 버림(기존 항목 유지 테스트가 빨강)」 줄 다음에 한 줄을 넣습니다.
```text
   - 후보 조립이 `count` 에 facet 건수를 실음(후보 조립의 `count` 테스트가 빨강)
```

**E5 (I3-2).** SR-1.4 본문 줄의 문구를 바꿉니다.
- 바꿀 문구: 「형제 링크(같은 언어 목록 안의 같은 시군구 다른 속성, 같은 시도 같은 속성; 0개면 생략)」
```text
형제 링크(같은 언어 목록 안의 같은 시군구 다른 속성, 같은 시도 같은 속성 — `retired` 가 아니고 현재 N ≥ `PLACE_LANDING_MIN_RESULTS` 인 항목만, SR-1.9 와 같은 조건에서 스위치만 뺀다; 0개면 생략)
```

**E6 (I3-2).** SR-3.6 의 「내부 링크(상세·지역, 목록에 있는 랜딩)」를 바꿉니다.
```text
내부 링크(상세·지역, 목록에 있고 `retired` 가 아닌 랜딩 — render-content 가 `place-landings.json` 과 대조해 은퇴·목록 밖 랜딩 링크면 실패시키고, 프리렌더는 빌드 때 N 이 하한 미만인 랜딩 링크를 경고한다)
```

**E7 (I3-2).** SR-5.1 「프리렌더 출력:」 아래 「`retired` 항목 → noindex·sitemap·llms 제외, 파일은 생성」 다음에 한 줄을 넣습니다.
```text
     - `retired`·N 미달 형제는 링크 안 됨
```

**E8 (I3-3).** SR-4.1 끝(「같은 값을 다른 파일에 리터럴로 다시 적지 않는다.」 뒤)에 덧붙입니다.
```text
`placeApi.ts` 의 `SIGHT_CATEGORIES` 주석(명동 7건 쇼핑 사고 근거)은 `copy.mjs` 정의 위로 옮기고, `placeApi.ts` 에는 re-export 한 줄만 둔다.
```

**E9 (I3-4).** SR-3.2 두 문장을 바꿉니다.
- 둘째 항목 끝(「어긋나면 빌드를 실패시킨다.」)에 덧붙입니다.
```text
render-content 가 분할까지 해서 JSON 에 `parts: Array<{ html } | { cardId }>` 로 싣는다. 검사에는 「`data-guide-card` 출현 수 = 정확한 표지 형식(`<div data-guide-card="\d{1,12}"></div>`) 일치 수」를 더한다. 분할 규칙은 이 한 곳에만 있다.
```
- 넷째 항목의 「본문 HTML 을 표지 기준으로 나눠, 표지 사이 조각(render-content `check()` 를 통과한 레포 원본)만 `dangerouslySetInnerHTML` 로 넣고 카드는 React 요소로 그린다.」를 바꿉니다.
```text
SPA 는 나누지 않고 `parts` 를 그린다. `html` 조각(render-content `check()` 를 통과한 레포 원본)만 `dangerouslySetInnerHTML` 로 넣고, `cardId` 는 React 요소로 그린다.
```

**E10 (T3-1, I3-4 검사 포함).** SR-5.1 편집 페이지의 「표지 id 형식 위반(`abc`)·`attractionIds` 와 표지 집합 불일치 → render-content 실패」를 세 줄로 바꿉니다.
```text
     - 형식 위반: 표지와 `attractionIds` 가 둘 다 `1234567890123`(13자리 — 집합은 일치, 형식만 위반) → render-content 실패
     - 집합 불일치: 표지 `101`, `attractionIds: [101, 102]` → render-content 실패
     - 표지 변형(홑따옴표 `data-guide-card='101'`) → 출현 수 ≠ 형식 일치 수로 실패
```

**E11 (T3-1).** SR-5.3 의 「표지 id 형식 검사 제거」를 바꿉니다.
```text
   - 표지 id 형식 검사 제거(13자리 픽스처가 빨강)
```

**E12 (T3-2).** SR-5.1 의 픽스처 두 줄을 바꿉니다.
- 「9 제외·10 포함」을 바꿉니다.
```text
     - `PLACE_LANDING_MIN_RESULTS - 1` 제외 · `PLACE_LANDING_MIN_RESULTS` 포함
```
- 「Jaccard 는 입력 `ids` 로 센다: 30 id 중 21 공유(0.538) → 제외, 20 공유(0.5) → 포함」을 바꿉니다.
```text
     - Jaccard 는 입력 `ids` 로 센다: 30 id 두 묶음에서 k/(60−k) 가 Jaccard 상한을 넘는 최소 공유 수 k 를 상수로 계산 → 제외, k−1 → 포함
```

**E13 (T3-2).** SR-4.2 의 「테스트 파일 하나가」를 바꿉니다.
```text
상수만 import 하는 전용 테스트 파일(`landingDecisions.test.ts`) 하나가
```
SR-5.3 의 「하한 10→9(SR-4.2 고정 단언이 빨강)」를 바꿉니다.
```text
   - 하한 10→9(`landingDecisions.test.ts` 만 빨강 — 경계 테스트는 상수로 계산해 초록)
```

**E14 (T3-3).** SR-5.3 의 「SPA 카드를 HTML 문자열 결합으로(SPA 이스케이프 테스트가 빨강)」를 바꿉니다.
```text
   - SPA 카드를 이스케이프 없이 HTML 문자열에 이어 붙여 `dangerouslySetInnerHTML` 로(픽스처 `<script>` 가 요소로 생겨 SPA 이스케이프 테스트가 빨강)
```

**E15 (U3-1).** SR-1.7 끝(「스크립트도 항목을 지우지 않는다(SR-1.3 기존 항목 유지).」 뒤)에 덧붙입니다.
```text
예외: 항목 `code` 가 현재 모집단(`administrative-regions` 시군구 행)에 없으면(행정구역 개편 — 광주 29·전남 46 → 12 선례) 그 페이지는 만들지 않고 빌드 로그에 경고한다. 이때 nginx 옛 지역 301 이 랜딩 주소도 시도 허브로 보낸다(정규식 `^/(?<legacy_region_lang>en/)?regions/(29|46)([0-9]{3})?(/[^/]+)?$`). 「한 번 생긴 주소는 404 가 되지 않는다」의 유일한 예외이고, 이 경우도 404 가 아니라 301 이다.
```
SR-1.3 의 「항목은 목록에서 빠지지 않는다 — 한 번 생긴 주소는 404 가 되지 않는다(SR-1.7 과 같은 원칙).」 뒤에 덧붙입니다.
```text
코드 개편 예외는 SR-1.7.
```

**E16 (U3-1).** SR-5.2 nginx 계약의 「`/regions/29110` 은 기존 301」 다음에 한 줄을 넣습니다.
```text
   - `/regions/29110/parking`·`/en/regions/46230/free` 301 → 시도 허브(`/regions/12`·`/en/regions/12`)
```
SR-5.1 「프리렌더 출력:」 아래에도 한 줄을 넣습니다.
```text
     - 모집단 밖 code 항목 → 파일 없음·경고
```

**E17 (U3-2, 권고 ⓑ).** SR-1.3 「기존 항목 유지」 항목 끝에 덧붙입니다.
```text
은퇴 항목 수가 합산 상한(20)을 넘으면 스크립트가 경고하고, 정리(삭제) 여부는 Q8 재판단으로 넘긴다 — 스크립트는 스스로 지우지 않는다.
```
SR-1.8 끝에 덧붙입니다.
```text
빌드 질의 수 = 목록 항목 수(은퇴 포함)이고, 실패 면적도 같은 수다.
```

### adr-0062-amendment-draft.md

**E18 (U3-3).** 「언어별 속성당 5, 국·영 합산 20 상한.」을 바꿉니다.
```text
- 언어별 속성당 5, 국·영 합산 20 상한(활성 항목 기준 — 은퇴 항목은 세지 않는다).
```
「선정은 레포에 커밋한 목록이다. 빌드마다 다시 뽑지 않는다(주소가 빌드 사이에 생기거나 사라지지 않게).」 줄 다음에 새 줄을 넣습니다.
```text
- 목록을 다시 뽑아도 빠진 항목은 지우지 않고 `retired`·noindex 로 남긴다. 그래서 주소 수는 활성 20 을 넘어 누적될 수 있다. 예외는 행정구역 개편으로 코드가 사라진 항목이고, 이 경우 페이지를 만들지 않고 시도 허브로 301 한다.
```

### open-questions.yml

**E19 (U3-2).** 사용자 판단 항목으로 Q10 을 끝에 더합니다.
```text
  - id: Q10
    stage: post-impl
    status: open
    question: 은퇴 랜딩 누적 정리 — 스위치를 켠 적 없는 동안 삭제(ⓐ) vs 은퇴 수가 20 을 넘으면 경고만 하고 정리는 Q8 재판단(ⓑ)
    answer: ⓑ(권고) — ⓐ 는 「켠 적이 있었는지」를 상수 하나로 알 수 없어 목록에 별도 상태가 필요하고, Q8 의 「규칙 하나」 원칙과도 갈린다
```

## 사용자 판단 항목

- **Q10 은퇴 랜딩 정리(U3-2).** 권고 기본값은 ⓑ로, 은퇴 항목이 20 을 넘으면 경고만 하고 정리는 Q8 재판단으로 넘깁니다. 이유는 두 가지입니다.
  - ⓐ는 「스위치가 켜진 적이 있었는지」를 `PLACE_LANDINGS_INDEXABLE` 상수만으로 알 수 없어, 목록에 상태 필드를 하나 더 둬야 합니다.
  - 2라운드 Q8 권고가 「규칙이 하나면 예외를 기억할 필요가 없다」였습니다.
- **U3-1 개편 예외 문구.** 「404 가 되지 않는다」 원칙에 301 예외를 하나 두는 결정이라 ADR 초안(E18)에도 들어갑니다. 승인할 때 함께 확인해 주세요. 권고는 시도 허브 301 이고, 옛 nginx 블록이 쓰는 방식과 같습니다.

SUMMARY: keep 10 / demote 0 / dismiss 0
NOTES: E6 의 「render-content 가 `place-landings.json` 과 대조」는 지금 API 를 부르지 않는 render-content 에 레포 파일 읽기를 하나 더하는 일입니다. 구현할 때 SR-3.2 의 「API 는 부르지 않는다」와 충돌하지 않는지 확인이 필요합니다(파일 읽기라 충돌은 없다고 봅니다). 대상 파일은 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-longtail-landings/` 아래 `spec.md`, `context/adr-0062-amendment-draft.md`, `context/open-questions.yml` 입니다.