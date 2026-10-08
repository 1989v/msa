# Engineer Review — usecase (2라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md`(개정본), 1라운드 `context/engineer-review-usecase.md` 이슈 1~4, 심판 `context/review-verdict-round1.md` 편집 8·12·14·15, 계획 `docs/plans/2026-10-08-place-growth-work-plan.md` S2-8(:82)·S2-9(:83). 세션 결정 ①~⑥과 U1~U7 기본값은 재론하지 않는다.

## 1라운드 이슈 해소 대조

| 1라운드 | 요구 | 개정 스펙 | 판정 |
|---|---|---|---|
| 이슈 1 영문 문구 | 런타임 영문 라벨 결정 + 초기 HTML 국문 고정 명시 | SR-2.4(spec.md:24) 「`lang === 'en'` 이면 Privacy policy · About · Contact · Data sources(대상 페이지는 국문)」, SR-2.1(:21) 「초기 HTML 바닥글은 영문 화면에서도 국문 라벨」. 영문 순서가 국문 런타임 순서(`Footer.tsx:47-55` 방침·소개·연락처)와 같다. SR-5.1(:38) 이 국문·영문 링크 넷을 단언 | 해소 |
| 이슈 2 Goal 범위 | Goal 축소 + 맨 셸 경로를 범위 밖으로 + 지역 검증 코드 조건 | Goal(:9) 「프리렌더·SSR 본문이 있는 화면」. Out of Scope(:48)에 `nginx.conf:228-236`·`:205-212`·`AttractionPageController.kt:39` 세 경로. SR-5.5(:42) 「프리렌더 파일이 있는 개요 있는 지역 코드」 | 해소 |
| 이슈 3 크롤러 경로 | gzip GET 으로 `W/` 경로 확인 | SR-4.4(:35) `--compressed` GET 과 비압축 GET 두 벌, `W/`·`Content-Encoding` 기록, origin 직접도 같은 두 벌 | 해소 |
| 이슈 4 Q1 분기 | 공개 주소 실패 시 S2-8 완료 판정 | SR-4.4(:35) 「origin 304 확인되면 S2-8 완료」, 공개 주소 ETag 소실 시 사실·Cloudflare 후속을 계획서에 기록, 304 비율은 관찰 항목 | 해소 |

### 확인한 코드 근거
- 맨 셸 세 경로는 실제로 바닥글 없는 `index.html` 을 낸다: `nginx.conf:211` `try_files /index.html =404;`, `nginx.conf:235` `try_files /prerender/$1$2/$3.html /index.html;`, `AttractionPageController.kt:39` `Page.Fallback -> 200 to FALLBACK`. Goal 축소 뒤에는 이 경로들이 Goal 과 충돌하지 않는다.
- 범위 안 화면은 모두 바닥글을 갖는다: 프리렌더는 `shellBody`(`prerender-seo.mjs:476-477`)가 `siteFooter()`(:471)를 붙이고 `shellBody(` 호출이 12곳이다. SSR 은 Found·NotFound 둘 다 `RENDERED`(`AttractionPageController.kt:36-37`)이고 렌더러가 `<footer>` 를 붙인다(`AttractionPageRenderer.kt:652`). 그래서 404 화면도 4링크를 갖는다 — Goal 과 맞다.
- ETag 분기는 `is Page.Found` 만(spec.md:32)이라 NotFound(404)·Fallback(200)에 붙지 않고, SR-4.3(:34)이 두 예외 흐름에 `If-None-Match` 를 실은 사례를 둔다.

## 계획서 완료 조건과의 대조

- **S2-9**(plan:83) 「페이지 존재·링크 노출」: `/data-sources` 존재는 SR-1.1 + SR-5.3(`dist/prerender/data-sources.html`)·SR-5.5(200·소프트 404 아님·`<!--seo:prerendered-->`·`GeoNames`). 링크 노출은 런타임(SR-2.4, SR-5.1)과 초기 HTML(SR-2.1~2.3, SR-5.5 허브·상세·지역 4링크) 둘 다. `/about`·`/contact` 는 이미 있고 nginx 호스트 무관 서빙(`nginx.conf:145`)에 `data-sources` 가 더해진다. 추적 가능.
- **S2-8**(plan:82) 「sitemap 의 lastmod 가 재색인 시각이 아님, 304 응답 확인 (→ 크롤 통계의 304 비율)」:
  - 304 응답 확인 → SR-4.3(테스트)·SR-4.4(라이브). origin 기준 완료는 U7 기본값이다.
  - 괄호 「→ 크롤 통계의 304 비율」은 계획서 2단계 표 머리(plan:72 「작업 완료 조건 (→ 이후 성과)」)상 **성과**이고, 원칙(plan:32-34)은 성과가 늦어도 작업을 미완료로 두지 않는다고 적는다. 스펙이 이를 관찰 항목으로 넘긴 것은 계획서 규칙과 같다.
  - lastmod 조건은 S1-9 결과(plan:21 「lastmod = 원천 수정일. S2-8 의 lastmod 항목 삭제, ETag/304 만」)로 충족돼 있다. 근거는 `planning/initialization.md:2` 에 있고 spec.md 본문에는 없다(아래 참고 2).

## 체크리스트

1. **Actor-goal** — 충족. 국문·영문 방문자, JS 없는 크롤러, 광고 심사자 목표가 Goal(:9)·SR-2.1·SR-2.4 로 정의됨.
2. **Main/Alt/Exception** — 충족. 304 주 흐름, `W/` 대체 흐름(SR-4.2), 404·셸 폴백 예외(SR-4.3), 공개 주소 ETag 소실 분기(SR-4.4), 측정 대상이 옛 이미지일 때 측정 폐기(SR-5.5).
3. **Pre/Postconditions** — 충족. 사전조건 「배포가 최신」(SR-5.5), 사후조건 「대장 == 페이지」(SR-1.4 게이트).
4. **AC 추적성** — 충족(참고 1·2는 기록 위치·문구 보강).
5. **엣지 케이스** — 충족. 맨 셸 경로는 범위 밖으로 명시, 개요 없는 지역은 검증 대상에서 제외, 영문 화면 라벨 확정.
6. **테스트 매핑** — 충족. SR-4.3 ↔ SR-5.2, SR-2.4 ↔ SR-5.1, 회귀 주입 SR-5.4.

## 참고 (비차단, 판정에 영향 없음)

1. **「계획서 S2-8 비고」 자리가 표에 없다.** 2단계 표 열은 「ID · 작업 · 담당 · 의존 · 작업 완료 조건」(plan:72)이라 비고 열이 없다. 결과를 적는 열은 진행 상태 표의 「결과 요약」(plan:14)이다. SR-4.4(spec.md:35)의 「계획서 S2-8 비고」를 「계획서 진행 상태 표(plan:14)의 S2-8 행 결과 요약」으로 바꾸면 기록 위치가 하나로 정해진다. 관찰 항목(크롤 통계 304 비율)도 같은 행에 적는다고 한 줄.
2. **S2-8 의 lastmod 절반이 spec.md 본문에 없다.** SR-4.4 는 「origin 304 확인되면 S2-8 은 완료」라고만 해서, 계획 완료 조건의 앞 절(plan:82 「sitemap 의 lastmod 가 재색인 시각이 아님」)을 무엇이 채우는지 스펙만 읽어서는 알 수 없다. 헤더 결정 문단(spec.md:4) 또는 SR-4.4 에 「lastmod 조건은 S1-9 결과(plan:21)로 이미 충족 — 이 스펙은 코드 변경 없음」 한 줄을 두면 추적이 닫힌다.

VERDICT: SHIP
