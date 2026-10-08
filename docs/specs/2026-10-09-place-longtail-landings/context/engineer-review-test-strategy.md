# Engineer Review — test-strategy (1라운드)

스펙: `docs/specs/2026-10-09-place-longtail-landings/spec.md`
체크리스트: hns 0.15.1 `reviewers/test-strategy/checklist.md`
기준: `docs/standards/test-rules.md` 는 백엔드(Kotest·MockK)만 다룬다(`test-rules.md:4-17`). FE 는 portal-fe 의 vitest 선례(`src/seo/__tests__`, `src/content/__tests__`, `src/pages/place/__tests__`)를 따른다.

## Findings

### T1. SR 과 테스트의 대응에 빈칸이 있다 (체크: Every AC has a test)
SR-4.1(`spec.md:31`)이 덮지 않는 요구:
| 요구 | 위치 | 빠진 테스트 |
|---|---|---|
| SPA 10건 미만 안내 + noindex | `spec.md:16` | 없음 |
| SPA h1·문장이 프리렌더와 **같은 함수** 출력 | `spec.md:21` | 「같은 함수」를 확인하는 단언 없음 — 같은 픽스처로 프리렌더 출력과 SPA 화면 텍스트가 일치하는지 |
| canonical 이 조건 변경 뒤에도 랜딩 주소 | `spec.md:22` | 「조건 변경 뒤 주소 유지」만 있고 canonical 은 없음 |
| sitemap lastmod = 결과 원천 수정일 최댓값 | `spec.md:17` | 없음 |
| 영문은 parking·free 만 | `spec.md:12` | 선정 함수 쪽만 있고 프리렌더/라우트 쪽(영문 `pet` 주소 = 파일 없음 → 404)은 없음 |
| `/guides` 목록은 published 만 | `spec.md:28` | 없음 |
| draft 는 llms 제외 | `spec.md:26` | sitemap 제외만 있음 |
| 편집 페이지 SPA 라우트(implementation I2) | — | 라우트 자체가 스펙에 없어 테스트도 없음 |
- 수정안: 위 행을 SR-4.1 목록에 추가.

### T2. nginx 검사가 문자열 존재만 본다 (체크: Test layer / 검사 근거)
- 스펙: "nginx 설정 문자열에 랜딩 location `=404` 존재"(`spec.md:31`).
- 문자열이 있어도 정규식이 실제 주소에 안 맞거나 순서상 다른 location 이 먼저 이기면 무동작이다(정규식 location 은 먼저 맞은 것이 이김 — `nginx.conf:223`). 이 레포에는 nginx 설정 테스트 선례가 없다(portal-fe 테스트 중 `nginx` 를 읽는 파일 0건).
- 수정안: 테스트가 `nginx.conf` 에서 정규식 location 을 **파일 순서대로** 뽑아 `/regions/11110/parking`·`/en/regions/11110/pet`·`/regions/11110`(지역 상세)·`/guides/x` 각각의 첫 매칭 블록과 그 `try_files` 마지막 인자(`=404` vs `/index.html`)를 단언한다. 회귀 주입 「=404 → SPA 폴백」은 이 방식에서 빨강이 난다.

### T3. 상한 회귀 주입이 빨강을 못 낼 수 있다 (체크: Negative/edge cases)
- 국문 4속성 × 5 = 20 이라 국문만 보면 「전체 20」은 절대 물리지 않는다(`spec.md:12-13`). implementation I5 에서 해석을 정하기 전에는 「상한 제거」 주입(`spec.md:32`)이 어떤 상한을 지우는지 불분명하다.
- 수정안: 속성당 상한과 전체 상한을 따로 주입하고, 각각 상한에 실제로 닿는 픽스처(한 속성 후보 6+, 전체 후보 21+)를 쓴다고 적는다.

### T4. 프리셋 계측 단언이 약하다 (체크: Mock boundaries / edge)
- 스펙: "첫 질의 인자에 시군구·속성, trigger `landing`"(`spec.md:31`).
- 현재 허브는 첫 진입에 `landing` 뒤 자동 선택 `initial` 을 한 번 더 낸다(`PlacePage.tracking.test.tsx:103,167-169`, `PlacePage.tsx:623-643`). 첫 질의만 보면 그 뒤 자동 선택이 프리셋을 서울로 덮어도 초록이다.
- 수정안: 프리셋 진입의 SEARCH trigger 열이 정확히 `['landing']` 이고, 두 번째 질의(있다면)도 같은 시도·시군구·속성임을 단언한다. 좌표 응답(성공·거부) 두 경우 모두. 선례 파일 `PlacePage.tracking.test.tsx` 의 `byAction` 헬퍼를 재사용.

### T5. 데이터 기준 테스트의 근거가 대상 산출물이어야 한다 (체크: Test data strategy)
- 고정 픽스처(`spec.md:31`)는 좋다. 다만 「프리렌더 출력」 테스트가 기대 문장을 테스트 안에서 다시 조립하면 자기 사본을 재게 된다.
- 수정안: 기대값은 copy.mjs 의 같은 문장 함수 출력과 픽스처 숫자에서만 계산하고(선례: `SearchArchitecturePage.test.tsx:6` "기대값은 전부 생성 JSON 에서 계산"), 픽스처는 시군구 facets 응답 모양(`SearchAttractionUseCase.kt:202-212` 의 `attributeFacets`)을 그대로 따른다고 적는다. 픽스처에 `pet.PARTIAL`·무장애 코드별 값·분류 필터 유무를 넣어 domain D1·D2 결정이 테스트로 고정되게 한다.

### T6. 편집 페이지 문체 규칙이 게이트로 걸려 있지 않다 (체크: Negative cases / 게이트화)
- 스펙: "문체는 blog-writing.md 금지 규칙 준용"(`spec.md:27`).
- 규칙은 스크립트로 판정된다(`docs/conventions/blog-writing.md:110-133`, F2~F8). 그러나 F1 은 블로그 머리말 4필드를 요구해(`blog-writing.md:122`) 편집 페이지 머리말(`spec.md:25`)과 맞지 않아 그대로 돌리면 실패한다.
- 수정안: 편집 원본 3장에 `scripts/lint-blog-post.py` 의 F2~F8 을 적용하는 검사를 테스트 또는 render 단계에 넣고(F1 제외 이유 명시), 회귀 주입 목록에 「금칙 표현 한 줄 삽입 → 빨강」을 추가.

### T7. 배포 뒤 확인에 계획의 검수 항목이 없다 (체크: AC 추적)
- 계획 S3-2 검수: 조건 정확성·목록 중복도·질의별 고유 설명(`work-plan.md:94`). SR-4.3(`spec.md:33`)은 상태 코드·sitemap 수만 본다.
- 수정안: ① 조건 정확성 — 랜딩 목록 표본의 상세 응답에서 해당 속성 값이 참인지 ② 중복도 — 같은 시군구 랜딩끼리 목록 겹침 비율(예: Jaccard ≤ 0.5) ③ 고유 설명 — 랜딩 간 title·description 중복 0 을 빌드 검사나 배포 확인에 넣는다. ②③ 은 빌드 산출물만으로 계산되므로 vitest/빌드 게이트가 가능하다.

## 통과 항목
- 레이어: 순수 함수(선정·문장) 단위, 렌더 함수 출력 단위, 화면 라우트 컴포넌트 테스트, 배포 뒤 HTTP 확인 — 층 배분은 적절하다.
- 회귀 주입을 임시 사본에서 한다는 명시(`spec.md:32`)는 프로젝트 규칙과 맞다.
- 네이밍: FE 선례(한국어 describe/it)를 따르면 된다.

VERDICT: REVISE
