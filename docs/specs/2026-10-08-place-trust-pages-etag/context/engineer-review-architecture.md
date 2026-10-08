# Engineer Review — architecture (1라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` (S2-9 · S2-8). 세션 결정 ①~⑥은 재론하지 않고 그 안의 구조 결함만 본다.
작업 트리: origin/main a05ab2765.

## Seed Discovery
- 스펙·`planning/initialization.md`·`context/open-questions.yml`, 계획서 `docs/plans/2026-10-08-place-growth-work-plan.md:82-83` (S2-8·S2-9 행과 스펙 범위 일치, lastmod 제외는 `:21` 근거).
- 프로젝트 규칙: `CLAUDE.md` 레이어 표준(ADR-0083)·`copy.mjs` 카피 SSOT 항목, CI `frontend-gate`(`.github/workflows/ci.yml:240-305`).
- 코드 대조: `AttractionPageController.kt:29-47`, `AttractionPageRenderer.kt:647-663`, `prerender-seo.mjs:12-95(import),454-478,1596-1629`, `nginx.conf:41-45,138-149,192-212`, `Footer.tsx:43-56`, `AboutPage.tsx:21-26,74-92`, `copy.mjs:993-1001`, `privacyRetention.test.ts:12`, `attractionJsonLdGolden.test.ts:24,374`, `AttractionJsonLdParityTest.kt:19-27`, `AttractionPageRendererTest.kt:549-557`, `docs/architecture/data-sources.md:66-97`.

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | OK | ETag·304 는 HTTP 관심사라 presentation 컨트롤러(`AttractionPageController.kt:29-47`)에 두는 것이 맞다. 바닥글은 기존 렌더러(infrastructure, `AttractionPageRenderer.kt:647-663`) 안에서 끝난다 |
| 상향 의존 금지 | OK | 새 의존 없음. 컨트롤러는 `RenderAttractionPageUseCase` 의 `Page` 타입으로만 분기한다 |
| 외부 연동은 Port 경유 | 해당 없음 | 외부 호출 추가 없음 |
| 모듈 경계 변경의 근거 | OK | portal-fe 테스트가 레포 문서를 읽는 것은 선례(`privacyRetention.test.ts:12`)와 같고, CI 는 전체 체크아웃이다(`ci.yml:240-245`) |
| 패턴 일관성 | **REVISE** | 아래 A2 — 서버·프리렌더 패리티에 이미 있는 골든 방식이 있는데 스펙이 「최소안」을 열어 둔다 |
| 순환 의존 | OK | 없음 |
| 트랜잭션 경계 | 해당 없음 | |
| 인터페이스 표면 최소 | **REVISE** | 아래 A3 — 304 를 프레임워크와 컨트롤러가 이중으로 다룬다 |
| 얕은 통과 모듈 | OK | 새 모듈은 페이지 하나와 데이터 상수 하나 |
| 정보 은닉 | OK | |
| Seam 현실성 | 해당 없음 | 새 인터페이스 없음 |
| 이름 | OK | `DataSourcesPage` 는 기존 `AboutPage`·`ContactPage`·`PrivacyPage` 와 같은 꼴 |
| 삭제 테스트 | **REVISE** | 아래 A1 — 데이터 상수가 페이지 안에 있으면 프리렌더가 사본을 만들어야 하고, 그 사본은 게이트 밖이다 |

## 발견

### A1 (REVISE) 출처 목록 상수의 위치가 프리렌더와 공유되지 않는다
- 스펙: SR-1.3 「데이터는 페이지의 TS 상수로 두고」, SR-3.1 「`/data-sources` 프리렌더 본문은 표 전체」, SR-1.4 게이트는 「페이지 상수」만 대장과 대조.
- 코드: 프리렌더는 `node scripts/prerender-seo.mjs` 로 도는 순수 Node 스크립트이고(`portal-fe/package.json:9`), 소스에서 가져오는 것은 `../src/seo/copy.mjs` 하나뿐이다(`prerender-seo.mjs:16-95`). React·CSS 를 import 하는 `.tsx` 페이지의 상수는 가져올 수 없다.
- 결과: 프리렌더가 표를 그리려면 두 번째 사본이 필요하고, 그 사본은 SR-1.4 게이트가 보지 않는다. 결정 ③(「대장과 페이지가 어긋나면 테스트가 실패」)이 크롤러가 받는 초기 HTML 에서는 성립하지 않는다.
- 수정안: 행 목록을 `.mjs` 모듈에 둔다(예: `portal-fe/src/seo/dataSources.mjs`, 또는 `copy.mjs` 의 export). 페이지·프리렌더·게이트가 모두 그 하나를 import 한다. SR-1.3 문구를 「페이지의 TS 상수」에서 「`src/seo/` 의 `.mjs` 상수(페이지·프리렌더 공용)」로 바꾼다. 같은 이유로 SR-3.1 의 About 절 텍스트도 `copy.mjs` 로 옮긴다고 이미 적혀 있으니 형식만 정한다(링크가 섞인 절이라 「문자열 + 링크 배열」인지 「HTML 문자열」인지 — 페이지가 `dangerouslySetInnerHTML` 없이 그릴 수 있는 쪽을 권한다).

### A2 (REVISE) 바닥글 패리티 「최소안」은 패리티를 재지 않는다
- 스펙: SR-2.2 「최소안: 각 쪽 테스트가 같은 4링크 리터럴을 단언」.
- 코드: 두 목록은 서로의 사본이다(`AttractionPageRenderer.kt:655` 주석 「prerender `SITE_LINKS`」, `prerender-seo.mjs:454-461`). 레포에는 이미 이 상황을 위한 방식이 있다 — vitest 가 `copy.mjs` 의 실제 함수로 골든을 쓰고(`attractionJsonLdGolden.test.ts:24,374`), Kotlin 테스트가 렌더 결과를 그 골든과 비교하며(`AttractionJsonLdParityTest.kt:22-26`), CI 가 골든이 최신인지 `git diff --exit-code` 로 막는다(`ci.yml:302-305`).
- 결과: 최소안은 각 테스트가 자기 리터럴을 근거로 판정한다. 한쪽 목록과 그쪽 테스트를 함께 고치면 다른 쪽은 초록인 채로 어긋난다. 사본 둘을 묶는 장치가 없다.
- 수정안: 최소안을 지운다. 바닥글 링크 목록(기존 `SITE_LINKS` + 신뢰 링크 4개)을 `copy.mjs` export 로 옮겨 프리렌더가 import 하고, 기존 골든 테스트가 그 목록을 `jsonld-golden.json` 에 함께 쓴다(또는 같은 위치에 별도 골든 파일 + CI diff 한 줄). Kotlin 쪽은 렌더된 HTML 의 `<footer>` 에서 href·라벨을 꺼내 골든과 비교한다. 이러면 SR-5 회귀 주입 「바닥글 링크 하나 제거 → 빨강」이 어느 쪽을 지워도 성립한다.

### A3 (REVISE) 304 를 컨트롤러가 직접 만들면 프레임워크 처리와 겹치고 304 의 헤더가 빠진다
- 스펙: SR-4.1 「`WebRequest.checkNotModified(etag)` 가 true 면 304(본문 없음), 아니면 `ResponseEntity.ok().eTag(etag)`」.
- 코드: 응답 헤더(`X-Render`·`Cache-Control`)는 `ResponseEntity` 빌더에서만 붙는다(`AttractionPageController.kt:41-46`). Spring MVC(Boot 4.0.4, `gradle/libs.versions.toml:3`)는 GET/HEAD 의 2xx `ResponseEntity` 에 ETag 가 있으면 반환값 처리기(`HttpEntityMethodProcessor`)가 `If-None-Match` 를 직접 대조해 304 로 바꾸고, 그때 엔티티의 헤더를 그대로 싣는다.
- 결과: 컨트롤러가 `checkNotModified` 로 먼저 304 를 끝내면 같은 판정이 두 곳에 생긴다. 그 분기에서 `null` 이나 별도 빌더를 돌려주면 304 응답에서 `Cache-Control`·`X-Render` 가 빠진다(RFC 9110 은 304 에도 200 이었으면 보냈을 `Cache-Control`·`ETag` 를 싣게 한다). 메서드 시그니처에 `WebRequest` 인자도 늘어난다.
- 수정안: `Page.Found` 분기의 `ResponseEntity` 에 `.eTag(etag)` 만 더하고 304 판정은 프레임워크에 둔다. 404·폴백은 ETag 를 안 붙이므로 자연히 대조 대상이 아니다. SR-4.3 테스트에 「304 응답에도 `ETag`·`Cache-Control` 이 있다」 한 케이스를 더한다. 약한 비교(SR-4.2)는 같은 경로에서 그대로 테스트로 고정한다.

### A4 (참고, 비차단) 런타임 바닥글과 초기 HTML 바닥글의 순서·주소 형태가 다르다
- `Footer.tsx:47-55` 는 방침·소개·연락처 순서의 상대 경로이고, SR-2.1 은 소개·연락처·방침·데이터 출처 순서의 apex 절대 주소다.
- 상대 경로도 모든 호스트에서 그 자리에서 열리므로(`nginx.conf:135-149`) 동작 문제는 없다. SR-2.3 에서 데이터 출처 한 줄을 더할 때 순서를 SR-2.1 과 맞출지 한 줄로 정해 두면 다음 사람이 한쪽을 「고치는」 일을 막는다.

### 참고 — 문제 아님으로 확인한 것
- ETag 를 `ShallowEtagHeaderFilter` 로 일괄 처리하지 않는 것은 맞다. 셸 폴백도 200 이라(`AttractionPageController.kt:39`) 필터는 폴백에도 ETag 를 붙인다. 결정 ⑥을 지키려면 `Page` 타입을 아는 컨트롤러가 정해야 한다.
- nginx 는 `gzip on`(`nginx.conf:41`)이라 text/html 응답의 강한 ETag 를 `W/` 로 약화한다. 상세 location(`nginx.conf:192-203`)은 요청 헤더를 걸러내지 않으므로 `If-None-Match` 가 search 에 닿고, SR-4.2 의 약한 비교로 받는다. 304 는 `proxy_intercept_errors` 의 대상(5xx)이 아니라 그대로 나간다.
- `/data-sources` 를 `PORTAL_PAGES` 에 넣으면 프리렌더 포털 nav(`prerender-seo.mjs:1600-1602`)에도 자동으로 들어간다. 의도와 맞는다.

## 요약
레이어·의존 방향은 문제없다. 사본 관리 셋이 고칠 거리다. 출처 표가 프리렌더와 공유되지 않아 게이트 밖 사본이 생기고, 바닥글 패리티 최소안은 패리티를 재지 않으며, 304 를 컨트롤러가 직접 만들면 프레임워크와 겹치고 304 헤더가 빠진다.

VERDICT: REVISE
