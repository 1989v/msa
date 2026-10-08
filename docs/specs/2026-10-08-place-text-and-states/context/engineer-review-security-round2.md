# Engineer Review — security (2라운드, 가벼운 확인)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (개정본)
- 작업 트리: `scratchpad/wt-impl`
- Seed: spec → `context/engineer-review-security.md`(1라운드) · `context/review-verdict-round1.md` G6 → `AttractionSeoText.kt` · `AttractionSearchController.kt` · `GlobalExceptionHandler.kt` 대조
- 범위: G6 반영 확인, `exact` 파라미터의 입력 검증. 다른 차원은 보지 않았다.

## 판정: SHIP (이슈 0건)

## G6 반영 확인

| 1라운드 지적 | 반영 위치 | 결과 |
|---|---|---|
| R1 정규화 중복(이중 디코드) | SR-1.3(`spec.md:21`) 서버 통합 경로 미변경, SR-2.1·2.2(`:24-25`) FE 는 패널 원문에만, SR-7.1·7.3 `<PARASITE>` 회귀(`:65,72`) | 반영. 경로마다 디코드 단계가 하나다 |
| R2 목록 overview 가 이스케이프 안 된 평문이라는 계약 | SR-1.2 KDoc 문구 「이스케이프되지 않은 평문이라 HTML 로 내보내는 쪽이 escape 한다」(`spec.md:20`), 공개 소비자(프리렌더 `prerender-seo.mjs:1068`, llms.txt `:1731`) 명시 | 반영 |
| R2 `escapeHtml` 의 `'` 한계 | SR-1.1 「`escapeHtml` 은 `'` 를 이스케이프하지 않는다 — KDoc 에 「큰따옴표 속성값·요소 본문 전용」」(`spec.md:19`) | 반영. 현재 구현이 `&`·`<`·`>`·`"` 만 바꾸는 것(`AttractionSeoText.kt:67-71`)과 문구가 맞는다 |

1라운드에서 권한 「`search/CLAUDE.md`·API 문서에도 같은 문장」은 심판이 KDoc + 스펙으로 좁혀 채택했다(`review-verdict-round1.md:29`). 이 축소는 받아들인다. 계약의 정본이 UseCase KDoc 이고, 공개 소비자 목록이 스펙에 적혔기 때문이다.

## `exact` 입력 검증

- **값 공간**
  - 의미는 불리언 하나다(`spec.md:51`: 「true 면 `correct()` 를 건너뛴다」). 값이 여는 경로는 「교정 생략」 하나뿐이다.
  - 쿼리·스크립트·외부 호출에 문자열로 들어가지 않는다. 그래서 인젝션 면이 없다.
- **바인딩**
  - 같은 컨트롤러의 불리언 플래그는 `@RequestParam(defaultValue = "false") … : Boolean` 형태다(`AttractionSearchController.kt:60` `openToday`, `:68` `wellness`, `:70` `facets`).
  - 같은 형태로 두면 `exact=abc` 는 `MethodArgumentTypeMismatchException` 이 된다. 이것은 공통 처리기가 400 `INVALID_INPUT` 으로 바꾼다(`common/.../GlobalExceptionHandler.kt:50-54`).
  - 스펙이 서버 타입을 따로 적지 않았지만 FE 계약이 `exact?: boolean` 이다(`spec.md:51`). 기존 관례를 따르면 위 동작이 된다. 바인딩 케이스는 `AttractionSearchControllerTest` 에 들어간다(`spec.md:71`).
- **권한·남용**
  - 익명 공개 읽기 API 에 교정을 건너뛰는 플래그를 더할 뿐이다. 그래서 권한 경계 변화가 없다.
  - `exact=true` 는 `correct()` 호출(`SearchAttractionService.kt:85`)을 빼므로 요청당 비용이 줄어든다. 증폭 경로가 없다.
  - 교정 지표 `correctionCounter`(`:86`)가 오르지 않는 것은 지표 뜻과 맞는다.
- **응답**: `correctedKeyword` 는 exact 면 null(`spec.md:51`)이다. 사용자 입력을 되돌려 내는 새 필드는 없다.

## SR-6 (참고)
- SR-6 은 서버 내부 10분 주기 집계 한 번이다(`spec.md:58`). 사용자 입력이 집계 질의에 들어가지 않고 새 외부 노출도 없다. 보안 축의 새 위험은 없다.
- 집합 완전성(잘린 집계)은 정확성 문제다. 그래서 domain 리뷰 D2-2 로 넘겼다.

VERDICT: SHIP
