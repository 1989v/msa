# 스펙 리뷰 판정 — 2라운드 (place 신뢰 페이지 + 상세 SSR ETag)

**결론: 19건 중 19건 유지, 강등 0건, 기각 0건, BLOCK 0건.** 발견이 인용한 `file:line` 은 워크트리 `wt-impl` 에서 직접 열어 확인했다. 원문이 발견 내용과 다른 경우가 없었고, 반대되는 선례나 표준도 찾지 못했다. 그래서 강등하거나 기각할 근거가 없다. 판정 결과는 아래 다섯 가지로 모인다.

- **같은 지적 셋 (A-R2-2 · TS-N1 · IMPL-I3)**: 바닥글 골든을 상수로 쓸 수 있게 열려 있으면 골든이 자기 자신을 재게 된다.
- **구현 불가 사례 (IMPL-I1)**: 「같은 id 의 국문·영문 경로는 ETag 가 다르다」는 지금 코드에서 성립할 수 없다. `AttractionPageService.kt:36` 이 Found 본문을 `renderPort.attractionPage(shell, doc, today)` 로 그리고 `pathLang` 을 쓰지 않기 때문이다.
- **도메인 R2-1 의 수정 범위 조정**: 리뷰어는 TourAPI 행 10개 전부에 비고를 달자고 했다. 하지만 대장 `:168` 은 축제·숙박·여행코스 절(`:158` 부터 시작) 안의 문장이다. 그래서 대장 근거가 있는 범위는 §1 `:75-77` 세 행뿐이다. 발견 자체는 유지하고 편집 목록에서 범위만 세 행으로 좁혔다.
- **게이트 부족 셋 (TS-N2 · N3 · N4)**: 원천·라이선스 열 대조, 폴백에 ETag 를 붙이지 않는 것, 셀 이스케이프 — 셋 다 지금은 빨간불이 나는 입력이 없다. 대장 §1 표에는 `&<>"` 가 0건이다(`sed -n 66,97p | grep -c` 결과 0).
- **기록 위치 (UC 참고1)**: 계획서 2단계 표에는 「비고」 열이 없다(`plan:72`). 진행 상태 표(`plan:14`)에도 S2-8 행이 없다.

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 |
|---|---|---|---|
| 런타임 Footer 가 `TRUST_LINKS` 와 묶이지 않은 셋째 사본 | A-R2-1, TS-참고2(Footer 기대값 출처) | 유지 | REVISE / MINOR |
| 골든을 렌더 출력에서만, 호스트 6 + 신뢰 4 전부로 | A-R2-2, TS-N1, IMPL-I3 | 유지 | REVISE / REVISE / MINOR |
| 새 골든 파일 미추적 상태를 `git diff` 가 못 잡음 | IMPL-I2, TS-참고1 | 유지 | MINOR |
| 신뢰 4링크가 모든 호스트 프리렌더에 붙는다는 점을 명시 | IMPL-I3 참고 | 유지 | MINOR |
| 대장 수정자에게 `dataSources.mjs` 안내 | IMPL-I4 | 유지 | MINOR |
| 같은 id 의 국문·영문 ETag 가 다르다는 사례가 구현 불가 | IMPL-I1 | 유지 | REVISE |
| TourAPI 비고를 다는 행 미정 | D-R2-1 | 유지(범위는 `:75-77`) | REVISE |
| 비고 열의 게이트 지위 미정 | D-R2-2 | 유지 | REVISE |
| U2 「류」와 규칙 ③ 범위 차이, `:96` 괄호 | D-R2-3 | 유지 | MINOR |
| 상설 부정 테스트가 데이터 집합 축만 덮음 | TS-N2 | 유지 | REVISE |
| 폴백에 ETag 를 붙이지 않는 것을 증명하는 회귀 주입 없음 | TS-N3 | 유지 | REVISE |
| 셀 이스케이프 단언에 걸 입력이 없음 | TS-N4 | 유지 | REVISE |
| Footer·sitemap·llms 에 회귀 주입 짝 없음 | TS-참고3 | 유지 | MINOR |
| 「계획서 S2-8 비고」 자리가 없음 | UC-참고1 | 유지 | MINOR |
| S2-8 의 lastmod 절반이 스펙 본문에 없음 | UC-참고2 | 유지 | MINOR |

## 2. 발견별 JSON

```json
[
  { "id": "A-R2-1 런타임 Footer 의 신뢰 링크가 TRUST_LINKS 와 묶이지 않은 셋째 사본",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/components/Footer.tsx", "line": 47, "quote": "<a className=\"site-footer-policy\" href=\"/privacy\">" },
      { "file": "portal-fe/src/components/Footer.tsx", "line": 1, "quote": "import { useState, type ReactNode } from 'react';  (copy.mjs import 없음)" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 24, "quote": "런타임 Footer(...)에 데이터 출처 링크를 더하고 라벨을 「사이트 소개」로 맞춘다" }
    ],
    "reason": "Footer 는 JSX 리터럴이고 스펙은 Footer 가 무엇을 읽는지 정하지 않아 골든 밖의 사본이 남는다. 반증이 없어 유지한다." },

  { "id": "A-R2-2 골든은 렌더된 바닥글에서만 뽑고 호스트 링크도 담아야",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 22, "quote": "vitest 가 `copy.mjs` 의 `TRUST_LINKS` 와 export 한 프리렌더 바닥글 함수(...) 출력에서 href·라벨을 순서째 뽑아" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 471, "quote": "function siteFooter() {  (export 아님)" },
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt", "line": 649, "quote": "val footer = siteLinks().joinToString(\" · \") { (href, label) -> \"<a href=\\\"$href\\\">..." }
    ],
    "reason": "문구가 상수를 골든의 근거로 허용하고, Kotlin 이 <footer> 전체(10개)를 뽑을 때 골든과 모양이 어긋난다. 반증이 없어 유지한다." },

  { "id": "D-R2-1 TourAPI 비고를 다는 행이 정해지지 않았다",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/architecture/data-sources.md", "line": 75, "quote": "| 축제·공연·행사 | TourAPI `searchFestival2` (국·영) | 필요 | 〃 (행마다 `cpyrhtDivCd`) |" },
      { "file": "docs/architecture/data-sources.md", "line": 158, "quote": "**축제·숙박·여행코스는 별도 오퍼레이션으로 받는다** (ADR-0104, ...)" },
      { "file": "docs/architecture/data-sources.md", "line": 168, "quote": "공공누리 유형은 **행마다 다르다**(`cpyrhtDivCd`, 표본은 `Type3` = 출처표시·변경금지)." },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 17, "quote": "`〃 (…)` 의 괄호 부분은 버린다" }
    ],
    "reason": "규칙 ② 가 :75-77 의 괄호를 버리는데 비고를 다는 행이 정해지지 않아 유지한다. 다만 :168 은 축제·숙박·여행코스 절 안의 문장이라, 대장이 받쳐 주는 범위는 :68-77 전부가 아니라 :75-77 이다." },

  { "id": "D-R2-2 비고 열이 게이트 대조 대상인지 적혀 있지 않다",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 17, "quote": "정규화한 데이터 집합 == 상수 데이터 집합, 행마다 원천·라이선스 완전 일치" },
      { "file": "docs/architecture/data-sources.md", "line": 261, "quote": "화면은 「출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료」와 측정소 이름 · 측정 시각을 단다." }
    ],
    "reason": "비고는 대장 본문이 원본인 데이터인데 게이트에도 제외 목록에도 없어 결정 ③ 의 범위가 비어 있다. 반증이 없어 유지한다." },

  { "id": "D-R2-3 U2 「류」와 규칙 ③ 문자열 조건 범위 차",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/architecture/data-sources.md", "line": 96, "quote": "Google Maps Platform 약관 (**place_id 만 무기한 저장 허용**)" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 6, "quote": "U2 라이선스 칸 괄호 안 내부 메모(「포털 표기 미확인 — …」 류)는 공개하지 않는다" }
    ],
    "reason": "남는 괄호가 :96 하나이고 결과는 같지만, 구현자가 「류」를 넓게 읽을 여지가 실재한다. 스타일이 아니라 범위 문제라 MINOR 로 유지한다." },

  { "id": "IMPL-I1 같은 id 의 국문·영문 경로는 ETag 가 다르다 — 구현 불가",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/service/AttractionPageService.kt", "line": 36, "quote": "return RenderAttractionPageUseCase.Page.Found(renderPort.attractionPage(shell, doc, today))" },
      { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/service/AttractionPageService.kt", "line": 34, "quote": "?: return ...Page.NotFound(renderPort.notFoundPage(shell, query.pathLang))  (pathLang 은 여기서만)" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 34, "quote": "같은 id 의 국문·영문 경로는 ETag 가 다르다." }
    ],
    "reason": "Found 본문이 pathLang 과 무관해 본문 해시가 같을 수밖에 없고, 통과시키려 하면 결정 ⑥(본문 해시)을 깬다. 반증이 없어 유지한다." },

  { "id": "IMPL-I2 새 골든 파일은 git diff 만으로는 미추적을 못 잡는다",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": ".github/workflows/ci.yml", "line": 101, "quote": "test -z \"$(git status --porcelain -- portal-fe/src/seo/__tests__/fixtures/event-schedule-golden.json)\"" },
      { "file": ".github/workflows/ci.yml", "line": 305, "quote": "run: git diff --exit-code -- search/app/src/test/resources/render/jsonld-golden.json" }
    ],
    "reason": "레포가 새 골든에 status 검사를 같이 두는 선례가 있다. Kotlin 테스트가 뒤에서 막아 주므로 MINOR 로 유지한다." },

  { "id": "IMPL-I3 골든에 담을 범위가 두 가지로 읽힌다",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 22, "quote": "(`siteFooter` 또는 `renderRegionDetail`) 출력에서 href·라벨을 순서째 뽑아" },
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionRenderProperties.kt", "line": 16, "quote": "val origin: String = \"https://place.1989v.com\"," }
    ],
    "reason": "A-R2-2·TS-N1 과 같은 결함이다. 리뷰어 등급(MINOR)을 올릴 별도 근거가 없어 MINOR 로 유지하고, 묶음 수정은 REVISE 로 반영한다." },

  { "id": "IMPL-I3-참고 신뢰 4링크가 모든 호스트 프리렌더에 붙는다",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 476, "quote": "function shellBody(inner) { return `<div ...>${inner}${siteFooter()}</div>`;" }
    ],
    "reason": "siteFooter 는 모든 호스트가 함께 쓰는데 스펙에 그 범위가 적혀 있지 않다. 한 줄 명시가 필요해 유지한다." },

  { "id": "IMPL-I4 대장 수정자에게 dataSources.mjs 길 안내",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 17, "quote": "대장 파일을 못 읽으면 실패(CI 체크아웃에서 돈다)." }
    ],
    "reason": "실패 메시지 내용이 정해져 있지 않다는 지적은 사실이다. 반증이 없어 nit 등급 MINOR 로 유지한다." },

  { "id": "TS-N1 바닥글 골든을 상수가 아니라 프리렌더 함수 출력에서만",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 22, "quote": "vitest 가 `copy.mjs` 의 `TRUST_LINKS` 와 export 한 프리렌더 바닥글 함수 ... 출력에서" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 472, "quote": "const links = SITE_LINKS.map(([href, label]) => `<a href=\"${href}\">${escapeHtml(label)}</a>`).join(' · ');" }
    ],
    "reason": "골든을 상수로 쓰면 siteFooter 배선이 없어도 초록이라 검사가 자기 자신을 잰다. 반증이 없어 유지한다." },

  { "id": "TS-N2 상설 부정 테스트와 주입이 데이터 집합 축만 덮는다",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 17, "quote": "상설 부정 테스트: 대장 텍스트에 행을 하나 더한 문자열을 `compare` 에 넣으면 실패한다" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 41, "quote": "상수에서 행 하나 제거 → 게이트 빨강." },
      { "file": "docs/architecture/data-sources.md", "line": 69, "quote": "| 관광지 개요 | TourAPI `detailCommon2` | 필요 | 〃 |" }
    ],
    "reason": "원천·라이선스 비교와 〃 펼치기가 틀려도 빨간불이 나는 입력이 없다. 반증이 없어 유지한다." },

  { "id": "TS-N3 폴백·404 에 ETag 없음 테스트를 빨갛게 만드는 주입이 없다",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/presentation/render/controller/AttractionPageController.kt", "line": 39, "quote": "is RenderAttractionPageUseCase.Page.Fallback -> 200 to FALLBACK" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 41, "quote": "`.eTag()` 제거 → 컨트롤러 테스트 빨강. ETag 를 문서 id 해시로 바꿈 → ..." }
    ],
    "reason": "1라운드에서 막으려던 실수(200 이면 ETag)를 재현하는 주입이 목록에 없다. 반증이 없어 유지한다." },

  { "id": "TS-N4 셀 이스케이프 단언을 걸 입력이 없다",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/architecture/data-sources.md", "line": 66, "quote": "§1 표 :66-97 에 & < > \" 0건 (grep -c 결과 0)" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1647, "quote": "export function renderTechSearchHtml(shell, generated) {  (데이터를 인자로 받는 선례)" }
    ],
    "reason": "실제 상수로는 escapeHtml 을 지워도 단언이 초록이다. 반증이 없어 유지한다." },

  { "id": "TS-참고1 새 골든 미추적 (IMPL-I2 와 같음)",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": ".github/workflows/ci.yml", "line": 100, "quote": "git diff --exit-code -- portal-fe/src/seo/__tests__/fixtures/event-schedule-golden.json" } ],
    "reason": "IMPL-I2 와 같은 지적이라 함께 유지한다." },

  { "id": "TS-참고2 About 제목·Footer 링크 기대값의 출처 미정",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 38, "quote": "`renderAboutHtml`·`renderDataSourcesHtml` 출력(About 절 제목 넷, ...), 런타임 Footer 의 국문·영문 링크 넷" } ],
    "reason": "기대값을 리터럴로 쓰면 사본이 생기는데 출처가 정해져 있지 않다. 반증이 없어 유지한다." },

  { "id": "TS-참고3 Footer·sitemap·llms 단언에 주입 짝 없음",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 41, "quote": "회귀 주입(...): 상수에서 행 하나 제거 → ... `.eTag()` 제거 → ..." } ],
    "reason": "목록에 짝이 없는 것이 사실이다. 비용이 낮아 MINOR 로 유지한다." },

  { "id": "UC-참고1 「계획서 S2-8 비고」 자리가 표에 없다",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 72, "quote": "| ID | 작업 | 담당 | 의존 | 작업 완료 조건 (→ 이후 성과) |" },
      { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 14, "quote": "| 항목 | 상태 | 결과 요약 → ... |  (S2 행 없음, :16-25 는 S1 뿐)" }
    ],
    "reason": "스펙이 가리키는 「비고」 열이 실제로 없다. 반증이 없어 유지한다." },

  { "id": "UC-참고2 S2-8 의 lastmod 절반이 spec.md 본문에 없다",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 21, "quote": "| S1-9 | 완료 | lastmod = 원천 수정일. **S2-8 의 lastmod 항목 삭제**, ETag/304 만 |" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 35, "quote": "origin 304 가 확인되면 S2-8 은 완료로 본다.  (spec.md 내 lastmod 0건)" }
    ],
    "reason": "spec.md 안에 lastmod 가 0건이라 완료 조건 앞 절이 어디서 채워지는지 추적이 안 된다. 반증이 없어 유지한다." }
]
```
SUMMARY: keep 19 / demote 0 / dismiss 0
NOTES: 컨트롤러 테스트는 지금 `AttractionPageService(searchPort, shellPort, renderer)` 로 시계를 넘기지 않는다(`AttractionPageControllerTest.kt` 31-33행). SR-4.3 의 「고정 시계」는 네 번째 인자로 `Clock.fixed(...)` 를 넘기는 작업이다.

## 3. spec.md 편집 목록

줄 번호는 지금 `spec.md` 기준이다. 편집은 위에서 아래 순서로 적용한다.

**E0 — 4~6행 헤더 인용 블록 끝(6행 뒤)에 한 문단 추가**
> `>`
> `> 개정 2026-10-08 (2라운드) — 2라운드 심판(19건 전부 유지, `context/review-verdict-round2.md`) 반영: 바닥글 골든의 근거를 렌더 출력으로 한정, 런타임 Footer 를 `TRUST_LINKS` 에 묶음, 비고 행 범위·게이트 지위, 국문·영문 ETag 사례 정정, 부정 테스트·회귀 주입 보강.`

(심판은 파일을 쓰지 않는다. 판정 파일 `review-verdict-round2.md` 는 부모가 이 결과를 저장할 때의 경로다. 저장하지 않으면 괄호 안 경로를 뺀다.)

**E1 — 15행 (SR-1.2) TourAPI 비고 행 범위 (D-R2-1)**
- 바꿀 문장: `TourAPI 행에 「행마다 공공누리 유형이 다름(표본 제3유형 = 출처표시·변경금지)」(`:168`).`
- 새 문장: `대장 §1 라이선스 칸에 「(행마다 `cpyrhtDivCd`)」가 달린 TourAPI 세 행 — 축제·공연·행사(`:75`) · 숙박(`:76`) · 여행코스(`:77`) — 에 「행마다 공공누리 유형이 다름(표본 제3유형 = 출처표시·변경금지)」(`:168`, 축제·숙박·여행코스 절 안의 문장). 그 밖의 TourAPI 행(`:68-74`)과 나머지 행의 비고는 빈 문자열이다 — 비고가 있는 행은 이 넷(대기 실시간 측정 + TourAPI 셋)뿐이다.`

**E2 — 17행 (SR-1.4) 네 군데 수정 (D-R2-2 · D-R2-3 · TS-N2 · IMPL-I4)**
- (a) 바꿀 문장: `③ 라이선스 칸 괄호 안 내부 메모(「포털 표기 미확인」을 포함하는 괄호)는 버린다.`
  새 문장: `③ 라이선스 칸 괄호 안 내부 메모(「포털 표기 미확인」을 포함하는 괄호)는 버린다. 다른 괄호는 남긴다 — `:96` 「place_id 만 무기한 저장 허용」은 메모가 아니라 약관 조건이다.`
- (b) 바꿀 문장: `비교는 `compare(ledgerText, rows)` 로 짠다: 정규화한 데이터 집합 == 상수 데이터 집합, 행마다 원천·라이선스 완전 일치.`
  새 문장: `비교는 `compare(ledgerText, rows)` 로 짠다: 정규화한 데이터 집합 == 상수 데이터 집합, 행마다 원천·라이선스 완전 일치. 비고도 대장 본문이 원본이라 같은 테스트가 본다: `**` 를 지운 대장 전문에 대기 실시간 측정 비고 「실시간 측정값으로 확정 전 자료」가 부분 문자열로 있고, TourAPI 비고의 핵심어 「행마다 다르다」·「출처표시·변경금지」가 둘 다 있다. 상수에서 비고가 빈 문자열이 아닌 행은 정확히 넷(SR-1.2)이다.`
- (c) 바꿀 문장: `상설 부정 테스트: 대장 텍스트에 행을 하나 더한 문자열을 `compare` 에 넣으면 실패한다(공유 트리의 대장은 고치지 않는다).`
  새 문장: `상설 부정 테스트 셋 — 모두 `compare` 가 실패해야 한다(공유 트리의 대장은 고치지 않는다): ① 대장 텍스트에 행을 하나 더한 문자열 ② 실제 대장 + `〃` 로 펼쳐지는 행(「관광지 개요」)의 라이선스만 바꾼 rows ③ 실제 대장 + 한 행의 원천만 바꾼 rows.`
- (d) 바꿀 문장: `대장 파일을 못 읽으면 실패(CI 체크아웃에서 돈다).`
  새 문장: `대장 파일을 못 읽으면 실패(CI 체크아웃에서 돈다). 실패 메시지에 「`docs/architecture/data-sources.md` §1 을 고쳤다면 `portal-fe/src/seo/dataSources.mjs` 를 같이 고친다」를 넣는다.`

**E3 — 16행 (SR-1.3) 상수 이름 고정**
- 바꿀 문장: `(행 상수와 고지 상수)`
- 새 문장: `(행 상수 `DATA_SOURCES` 와 고지 상수 `DATA_SOURCE_NOTICES`)`

**E4 — 21행 (SR-2.1) `TRUST_LINKS` 모양과 적용 범위 (A-R2-1 · IMPL-I3 참고)**
- 바꿀 문장: `옆에 새 상수 `TRUST_LINKS` 를 `copy.mjs` export 로 두고,`
  새 문장: `옆에 새 상수 `TRUST_LINKS`(항목 `{ path, label, labelEn }`, `path` 는 `/privacy` 같은 상대 경로)를 `copy.mjs` export 로 두고,`
- 바꿀 문장: `절대 URL 은 apex(`https://1989v.com/...`).`
  새 문장: `프리렌더는 `${PORTAL_ORIGIN}${path}` 로 apex 절대 URL 을 만든다. `siteFooter()` 는 모든 호스트 프리렌더가 함께 쓰므로(`prerender-seo.mjs:471-478`) 4링크는 place 뿐 아니라 apex·game·blog·rank·deal 초기 HTML 에도 붙는다 — 의도한 범위다.`

**E5 — 22행 (SR-2.2) 전체를 아래로 교체 (A-R2-2 · TS-N1 · IMPL-I3 · IMPL-I2)**
> `2. 패리티는 골든으로 고정한다. `siteFooter` 를 export 하고, vitest `portal-fe/src/seo/__tests__/footerLinksGolden.test.ts` 가 `siteFooter()` 출력의 `<footer>` 안 `<a>` 전부(호스트 6 + 신뢰 4 = 10개)의 href·라벨을 순서째 뽑아 `search/app/src/test/resources/render/footer-links-golden.json` 을 매번 쓴다(선례 `attractionJsonLdGolden.test.ts:374`). 골든은 이 출력에서만 쓴다 — `TRUST_LINKS` 를 골든에 직접 넣지 않는다. 같은 vitest 가 따로 출력의 마지막 넷이 `TRUST_LINKS` 의 `${PORTAL_ORIGIN}${path}`·`label` 과 순서째 같은지 단언한다. Kotlin 테스트는 `AttractionRenderProperties()` 기본값(`origin = https://place.1989v.com`, `copy.mjs` `PLACE_ORIGIN` 과 같음)으로 렌더한 HTML 의 `<footer>` 안 `<a>` 전부를 같은 꼴로 뽑아 골든 10개 전체와 비교한다. `ci.yml` 의 JSON-LD 골든 단계(`:304-305`) 뒤에 새 단계를 두고 두 줄을 넣는다: `git diff --exit-code -- search/app/src/test/resources/render/footer-links-golden.json` · `test -z "$(git status --porcelain -- search/app/src/test/resources/render/footer-links-golden.json)"`(선례 `ci.yml:100-101`).`

**E6 — 24행 (SR-2.4) 전체를 아래로 교체 (A-R2-1)**
> `4. 런타임 Footer(`components/Footer.tsx:47-55`)는 JSX 리터럴 세 개를 지우고 `copy.mjs` 의 `TRUST_LINKS` 를 map 해 그린다. href 는 상대 경로 `path` 그대로(`:45-46` 주석의 이유 — 서브도메인에서는 그 호스트가 같은 라우트를 그린다), 라벨은 `lang === 'en'` 이면 `labelEn`(「Privacy policy · About · Contact · Data sources」, 대상 페이지는 국문), 아니면 `label`. 「사이트 소개」 라벨은 기존과 같다.`

**E7 — 27행 (SR-3.1) 함수 시그니처 (TS-N4)**
- 바꿀 문장: `export 한 순수 함수 `renderAboutHtml(shell)`·`renderDataSourcesHtml(shell)`(선례 `renderTechSearchHtml` :1647)가 만든다.`
- 새 문장: `export 한 순수 함수 `renderAboutHtml(shell)`·`renderDataSourcesHtml(shell, rows = DATA_SOURCES)`(행을 인자로 받아 이스케이프를 시험할 수 있게 한다, 선례 `renderTechSearchHtml(shell, generated)` :1647)가 만든다.`

**E8 — 34행 (SR-4.3) 국문·영문 사례 (IMPL-I1)**
- 바꿀 문장: `같은 id 의 국문·영문 경로는 ETag 가 다르다.`
- 새 문장: `같은 id 의 국문·영문 경로는 본문이 같으므로(`AttractionPageService.kt:36` — Found 본문은 문서만으로 그리고 경로 언어를 쓰지 않는다) ETag 도 같다. 언어가 다른 두 문서(`AttractionPageFixtures.doc()` 와 `doc(id = "6001", lang = "en")`)는 ETag 가 다르다.`
- 같은 행의 바꿀 문장: `컨트롤러 테스트는 고정 시계로 돈다(위생).`
  새 문장: `컨트롤러 테스트는 `AttractionPageService` 네 번째 인자에 `Clock.fixed(...)` 를 넘겨 고정 시계로 돈다(위생).`

**E9 — 35행 (SR-4.4) 기록 위치와 lastmod (UC-참고1 · UC-참고2)**
- 바꿀 문장: `공개 주소에서 ETag 가 사라지면 그 사실과 Cloudflare 후속(설정은 사용자 몫)을 계획서 S2-8 비고에 남기고, 크롤 통계 304 비율은 배포 후 관찰 항목으로 넘긴다.`
- 새 문장: `측정 결과(origin·공개 주소 두 벌의 ETag, `W/` 여부, `Content-Encoding`, 304 여부)는 계획서 진행 상태 표(`docs/plans/2026-10-08-place-growth-work-plan.md:14`)에 S2-8 행을 더해 결과 요약 칸에 적는다. 공개 주소에서 ETag 가 사라지면 그 사실과 Cloudflare 후속(설정은 사용자 몫)도 같은 칸에 적고, 크롤 통계 304 비율은 「배포 후 관찰」로 같은 칸에 적는다. S2-8 의 lastmod 조건(plan:82 「sitemap 의 lastmod 가 재색인 시각이 아님」)은 S1-9 결과(plan:21 「lastmod = 원천 수정일」)로 이미 충족돼 이 스펙은 lastmod 코드를 바꾸지 않는다.`

**E10 — 38행 (SR-5.1) 전체를 아래로 교체 (TS-N4 · TS-참고2 · A-R2-1)**
> `1. vitest: DataSources 게이트(SR-1.4 — 집합·원천·라이선스·비고 대조와 상설 부정 셋), 페이지 렌더, `copy.test.ts`, 바닥글 골든 쓰기와 「마지막 넷 == `TRUST_LINKS`」 단언(SR-2.2), `renderAboutHtml` 출력의 About 절 제목 넷(기대값은 SR-3.2 상수의 `heading` 에서 꺼낸다), `renderDataSourcesHtml` 출력의 표 행 수 == `DATA_SOURCES` 길이(기본 인자) · 셀 이스케이프(`rows` 에 `<b>&"` 가 든 행 하나를 넘겨 출력에 `&lt;b&gt;&amp;&quot;` 가 있고 원문 `<b>` 가 없음), 런타임 Footer 의 국문·영문 링크 넷(기대 href·라벨은 `TRUST_LINKS` 의 `path`·`label`·`labelEn` 에서 꺼낸다 — 리터럴 금지), sitemap 에 `/data-sources`.`

**E11 — 41행 (SR-5.4) 전체를 아래로 교체 (TS-N1 · N3 · N4 · TS-참고3 · IMPL-I1)**
> `4. 회귀 주입(컴파일되는 회귀, 임시 사본에서): 상수에서 행 하나 제거 → 게이트 빨강. Kotlin 바닥글 링크 하나 제거 → 골든 대조 빨강. FE `TRUST_LINKS` 하나 제거 → CI 골든 diff 빨강. `siteFooter()` 가 `TRUST_LINKS` 를 빼고 그림(상수는 그대로) → CI 골든 diff 와 「마지막 넷」 단언 빨강. 런타임 Footer 가 `TRUST_LINKS.slice(0, 3)` 만 그림 → Footer 단언 빨강. 표 셀에서 `escapeHtml` 제거 → 이스케이프 단언 빨강. `.eTag()` 제거 → 컨트롤러 테스트 빨강. ETag 를 문서 id 해시로 바꿈 → 「개요만 바뀐 문서」 사례 빨강. 해시 입력에 경로 언어를 섞음 → 「같은 id 국문·영문 ETag 같음」 사례 빨강. ETag 부착 기준을 `is Page.Found` 에서 `status == 200` 으로 바꿈 → 폴백 사례(정상 ETag 를 `If-None-Match` 로 실어 200·셸 본문·ETag 없음) 빨강. 원천·라이선스 열 대조는 SR-1.4 상설 부정 테스트 ②③ 이 맡으므로 따로 주입하지 않는다.`

**E12 — 45행 (Existing Code to Leverage) 끝에 덧붙임**
> `, `AttractionPageService.kt:17,36`(시계 인자 · Found 본문), `AttractionRenderProperties.kt:16`, `ci.yml:100-101`(status 검사 선례), `docs/architecture/data-sources.md`:75-77·:96·:158`

## 4. 3라운드 재리뷰가 필요한 차원

- **test-strategy — 필요.** E2(c)·E5·E10·E11 로 게이트의 근거와 회귀 주입 목록이 크게 바뀌었다. 특히 골든 근거를 렌더 출력으로 한정한 것과, 상설 부정 ②③ 이 실제로 빨간불을 내는지를 봐야 한다.
- **architecture — 필요.** E4·E6 으로 `TRUST_LINKS` 모양이 바뀌었고 Footer 가 그것을 읽게 됐다. 상대·절대 주소가 하나의 원본에서 갈리는 구조가 맞는지 확인이 필요하다.
- **domain · implementation — 그 편집만 확인.** domain 은 E1(비고 세 행)과 E2(a)(b), implementation 은 E8(시계 인자·`doc(lang="en")` 픽스처)과 E5 의 CI 두 줄만 보면 된다. 3라운드를 열지 않는다면, 구현자가 이 두 항목을 구현 직후 테스트 결과로 확인하는 것으로 대신할 수 있다.
- **usecase · security — 불필요.** usecase 는 SHIP 이고 E9 는 기록 위치만 바꾼다.

## 5. 사용자 판단 항목

1. **TourAPI 비고 범위 (E1)**: 대장 근거대로 축제·숙박·여행코스 **세 행에만** 달지, 관광지 등 TourAPI 열 행 전부에 달지 정해야 한다.
   - 기본값은 세 행이다. 대장 §1 이 그 셋에만 「행마다」를 달았고, `:168` 이 그 절 안에 있다.
   - 열 행 전부로 넓히면 대장에 없는 주장을 공개하게 된다.
2. **신뢰 4링크의 적용 호스트 (E4)**: `siteFooter()` 는 공용이라 game·blog·rank·deal·apex 초기 HTML 에도 4링크가 붙는다.
   - 기본값은 그대로 두는 것이다. 결정 ④ 의 「초기 HTML 바닥글」과 맞고, 링크가 apex 절대 주소라 어느 호스트에서도 맞는다.
   - place 에만 붙이려면 `siteFooter` 에 호스트 인자를 더해야 하고, 그만큼 골든 구조가 바뀐다.

판정 근거로 연 파일(워크트리 루트 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` 기준):
- `docs/specs/2026-10-08-place-trust-pages-etag/spec.md`
- `docs/architecture/data-sources.md`
- `docs/plans/2026-10-08-place-growth-work-plan.md`
- `portal-fe/src/components/Footer.tsx`
- `portal-fe/scripts/prerender-seo.mjs`
- `search/app/src/main/kotlin/com/kgd/search/application/attraction/service/AttractionPageService.kt`
- `search/app/src/main/kotlin/com/kgd/search/presentation/render/controller/AttractionPageController.kt`
- `search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt`
- `.github/workflows/ci.yml`