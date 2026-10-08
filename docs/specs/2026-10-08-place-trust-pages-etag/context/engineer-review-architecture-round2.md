# Engineer Review — architecture (2라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md`(심판 편집 반영본). 1라운드 A1~A3 의 반영 여부와 편집으로 생긴 새 문제만 본다.

## Seed Discovery
- 스펙, `context/engineer-review-architecture.md`(1라운드), `context/review-verdict-round1.md`(편집 3·7·10).
- 코드 대조: `AttractionPageController.kt:29-47`, `AttractionPageControllerTest.kt:34-37`, `AttractionPageRenderer.kt:647-663`, `AttractionRenderProperties.kt:16`, `prerender-seo.mjs:454-478,1647`, `Footer.tsx:43-56`, `tsconfig.app.json:16`, `attractionJsonLdGolden.test.ts:24,374`, `ci.yml:298-305`. `.tsx` 에서 `seo/copy.mjs` 를 import 하는 파일은 57곳이다(Grep).

## 1라운드 지적 반영 확인

| 지적 | 반영 | 근거 |
|---|---|---|
| A1 출처 표 상수 위치 | 반영됨 | `spec.md:16`(SR-1.3)이 `src/seo/dataSources.mjs` 하나를 페이지·프리렌더·게이트가 함께 import 한다고 정했다. `tsconfig.app.json:16` `allowJs: true` 이고 `.tsx` 가 `copy.mjs` 를 import 하는 선례가 57곳이라 페이지 쪽도 성립한다. 삭제 테스트: 지우면 복잡도가 세 호출자로 흩어지므로 제 몫을 한다 |
| A2 바닥글 패리티 골든 | 대체로 반영 | `spec.md:22`(SR-2.2)가 골든 파일·Kotlin 대조·CI diff 한 줄을 정했다. 선례(`attractionJsonLdGolden.test.ts:374`, `ci.yml:304-305`)와 같은 구조다. 골든의 근거 문구에 남은 모호함은 아래 R2-2 |
| A3 304 를 프레임워크에 맡김 | 반영됨 | `spec.md:32`(SR-4.1)가 `.eTag()` 만 더하고 `WebRequest` 를 두지 않는다고 정했다. 지금 컨트롤러는 헤더를 전부 `ResponseEntity` 빌더에서 붙이므로(`AttractionPageController.kt:41-46`) 304 에도 실린다. 테스트도 `MockMvcBuilders.standaloneSetup`(`AttractionPageControllerTest.kt:34`)이라 반환값 처리기를 실제로 거친다 — SR-4.3 의 304 사례가 프레임워크 동작을 잰다 |
| A4 순서·주소 형태 | 반영됨 | `spec.md:21` 이 순서를 런타임 Footer(방침·소개·연락처·출처)에 맞췄다 |

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | OK | ETag 는 presentation 컨트롤러, 바닥글은 infrastructure 렌더러 안 |
| 상향 의존 금지 / 순환 | OK | 새 의존 없음 |
| 외부 연동 Port 경유 / 트랜잭션 | 해당 없음 | |
| 모듈 경계 변경 근거 | OK | 대장을 빌드에서 읽지 않는 이유가 `spec.md:16` 에 있다 |
| 패턴 일관성 | OK | 골든+CI diff, `renderTechSearchHtml` 꼴 export 함수(`prerender-seo.mjs:1647`) 모두 선례를 따른다 |
| 인터페이스 표면 최소 | OK | 컨트롤러 시그니처 그대로 |
| 얕은 통과 모듈 / 이름 | OK | `dataSources.mjs`·`DataSourcesPage` 는 기존 꼴과 같다 |
| 삭제 테스트 | **REVISE** | R2-1 — 런타임 Footer 가 신뢰 링크의 셋째 사본으로 남는다 |

## 발견

### R2-1 (REVISE) 런타임 Footer 의 신뢰 링크가 `TRUST_LINKS` 와 묶이지 않은 셋째 사본이다
- 스펙: `spec.md:21` 은 `TRUST_LINKS` 를 `copy.mjs` export 로 두고 라벨·순서를 런타임 Footer 와 같게 한다. `spec.md:24`(SR-2.4)는 Footer 에 링크를 더하고 영문 라벨을 단다고만 적었고, Footer 가 무엇을 읽는지는 정하지 않았다.
- 코드: Footer 는 href·라벨을 JSX 리터럴로 갖는다(`Footer.tsx:47-55`). 골든(SR-2.2)은 프리렌더와 Kotlin 만 묶는다.
- 결과: 같은 목록(경로·국문 라벨·순서)이 `TRUST_LINKS`·Kotlin 함수·Footer 세 곳에 생기고, 셋째는 어떤 게이트에도 안 걸린다. 다섯째 링크를 `TRUST_LINKS` 에 더하면 초기 HTML 과 Kotlin(골든 diff)은 따라오지만 사람이 보는 화면은 그대로다. SR-5.1 의 「런타임 Footer 국문·영문 링크 넷」 단언도 리터럴이면 자기 사본을 잰다.
- 수정안: `TRUST_LINKS` 항목을 `{ path, label, labelEn }` 꼴로 두고, Footer 는 이것을 map 해 상대 경로(`path`)로 그리고, 프리렌더는 `${PORTAL_ORIGIN}${path}` 로 절대 주소를 만든다. SR-5.1 의 Footer 단언은 `TRUST_LINKS` 와 렌더된 링크를 비교한다. 상대/절대 차이(`Footer.tsx:45-46` 주석의 이유)는 이 꼴로 그대로 유지된다.

### R2-2 (REVISE, 문구) 골든은 렌더된 바닥글에서만 뽑아야 하고 호스트 링크도 담아야 한다
- 스펙: `spec.md:22` 「vitest 가 `copy.mjs` 의 `TRUST_LINKS` 와 export 한 프리렌더 바닥글 함수 … 출력에서 href·라벨을 순서째 뽑아 … 골든을 쓴다」. Kotlin 은 「`<footer>` 에서 href·라벨을 순서째」 뽑는다.
- 코드: 두 바닥글 모두 호스트 6개 뒤에 붙는다(`prerender-seo.mjs:471-474`, `AttractionPageRenderer.kt:648-663`). Kotlin 쪽 place 링크는 설정값 `origin`(`AttractionRenderProperties.kt:16` 기본 `https://place.1989v.com`)이다. `siteFooter` 는 지금 export 되지 않는다(`prerender-seo.mjs:471`).
- 결과: 문구대로면 골든에 상수(`TRUST_LINKS`)가 섞여 들어갈 수 있다. 그러면 프리렌더 바닥글에 `TRUST_LINKS` 를 배선하지 않아도 골든은 상수로 채워지고 Kotlin 은 그 골든과 맞아 초록이 된다 — 검사가 스스로 만든 근거다. 또 골든이 신뢰 링크 넷만 담으면 Kotlin 의 `<footer>` 전체 추출(10개)과 모양이 달라 어느 쪽을 자를지 구현자가 정하게 된다.
- 수정안: SR-2.2 를 「골든은 export 한 `siteFooter()` 출력의 `<footer>` 안 `<a>` 전부(호스트 6 + 신뢰 4)를 순서째 뽑아 쓴다. `TRUST_LINKS` 는 골든을 쓰는 데 쓰지 않고, 같은 vitest 에서 출력의 마지막 넷이 `TRUST_LINKS` 와 같은지 따로 단언한다」로 바꾼다. 회귀 주입 「FE `TRUST_LINKS` 하나 제거 → CI 골든 diff 빨강」(`spec.md:41`)은 이 꼴에서도 그대로 성립한다.

### 참고 — 문제 아님으로 확인한 것
- `If-None-Match: W/"x"` 는 Spring 의 조건부 요청 처리가 약한 비교로 받으므로 SR-4.2 테스트가 프레임워크 기본 동작을 고정하는 것으로 충분하다. 컨트롤러에 별도 코드가 필요 없다.
- HEAD 는 `@GetMapping` 이 함께 받고, 반환값 처리기의 304 판정도 GET/HEAD 둘 다다(심판 바이트코드 확인).
- About 절 상수를 `copy.mjs` 에, 출처 행을 별도 `dataSources.mjs` 에 두는 분리는 맞다 — 출처 행은 대장 게이트의 대상이고 카피는 아니다.

## 요약
1라운드 A1·A3 는 그대로 반영됐고, A2 는 구조는 맞으나 골든의 근거 문구가 상수를 끌어들일 여지가 있다(R2-2). 새로 보인 것은 런타임 Footer 가 `TRUST_LINKS` 와 묶이지 않은 셋째 사본이라는 점이다(R2-1). 둘 다 스펙 문장 한두 줄로 고친다.

VERDICT: REVISE
