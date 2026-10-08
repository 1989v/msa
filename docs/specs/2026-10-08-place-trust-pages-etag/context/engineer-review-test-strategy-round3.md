# Engineer Review — test-strategy (3라운드, 마지막)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md`(2라운드 심판 E0~E12 반영본). 범위는 셋이다.
- 골든의 근거가 렌더 출력으로 한정됐는가.
- 상설 부정 ②③ 과 회귀 주입 목록이 실제로 빨간불을 내는가.
- 덤: domain E1·E2a/b, implementation E8·E5 가 구현 가능한가.

이미 판정된 항목은 다시 열지 않는다.

## Seed Discovery
- 스펙, `context/engineer-review-test-strategy-round2.md`, `context/review-verdict-round2.md`
- 코드·문서 대조
  - `docs/architecture/data-sources.md:66-97,168,261`
  - `portal-fe/scripts/prerender-seo.mjs:376-382`(`escapeHtml` 은 `"` → `&quot;`), `:471-478`
  - `portal-fe/src/seo/__tests__/attractionJsonLdGolden.test.ts:372-376`
  - `.github/workflows/ci.yml:95-109,225-245,298-305`(portal-fe 잡은 전체 체크아웃 — 대장 파일을 읽을 수 있음)
  - `search/.../AttractionPageService.kt:13-37`
  - `search/.../AttractionPageControllerTest.kt:26-39`
  - `search/.../AttractionPageFixtures.kt:41-51`
- 표준: `docs/standards/test-rules.md`(BehaviorSpec·MockK)

## 1. 확인 결과 (모두 통과)

| 대상 | 판정 | 근거 |
|---|---|---|
| 골든 근거 = 렌더 출력 | 한정됨 | `spec.md:24` 「골든은 이 출력에서만 쓴다 — `TRUST_LINKS` 를 골든에 직접 넣지 않는다」. 프리렌더 `<footer` 는 `siteFooter()` 한 곳이다(`prerender-seo.mjs:473`). 그래서 「`<footer>` 안 `<a>` 전부」 추출은 대상의 산출물을 잰다 |
| 상설 부정 ① 행 추가 | 빨강 | 데이터 집합이 어긋난다 |
| 상설 부정 ② 「관광지 개요」 라이선스 변경 | 빨강 | 대장 `:69` 이 `〃` 이고 펼친 값은 `:68` 「공공누리 (출처표시)」다. `compare` 가 라이선스를 안 보거나 `〃` 행을 건너뛰면 이 사례가 초록이 되므로, 이 사례가 그 실수를 잡는다 |
| 상설 부정 ③ 원천 변경 | 빨강 | 원천 열 비교를 직접 건드린다 |
| 주입 — `siteFooter` 가 `TRUST_LINKS` 를 뺌 | 빨강 | CI diff(`ci.yml:300` 뒤 새 단계)와 「마지막 넷」 단언이 같이 빨개진다(마지막 넷이 호스트 링크가 됨) |
| 주입 — 표 셀 `escapeHtml` 제거 | 빨강 | 입력 `<b>&"` 를 이스케이프하면 `&lt;b&gt;&amp;&quot;` 이 연속해서 나온다(`prerender-seo.mjs:378-381`) |
| 주입 — `status == 200` 기준 | 빨강 | 폴백 본문 해시는 정상 ETag 와 달라 304 가 아니다. 그런데 ETag 가 붙으므로 「ETag 없음」 단언이 빨개진다 |
| 주입 — 해시에 경로 언어 섞음 | 빨강 | 「같은 id 국문·영문 ETag 같음」 사례 |
| 주입 — Footer `slice(0,3)` | 빨강 | 기대값을 `TRUST_LINKS` 에서 꺼내므로 개수가 어긋난다 |

## 2. 덤 확인 (한 줄씩)
- **domain E1**: 대장 `:75-77` 세 행에만 「(행마다 `cpyrhtDivCd`)」가 있다. 구현 가능.
- **domain E2a**: `:96` 의 괄호는 `**` 를 제거해도 「(place_id 만 무기한 저장 허용)」으로 남는다. `:88` 의 「포털 표기 미확인」 괄호만 버려진다. 구현 가능.
- **domain E2b**: `**` 를 제거하면 `:168` 에 「행마다 다르다」·「출처표시·변경금지」가 둘 다 있고, `:261` 에 「실시간 측정값으로 확정 전 자료」가 있다. 구현 가능. 단 판정 근거에 결함이 있다 → T3-1.
- **implementation E8**: `AttractionPageService` 네 번째 인자는 `clock: Clock = Clock.systemUTC()` 다(`AttractionPageService.kt:17`). 테스트 생성부(`AttractionPageControllerTest.kt:31-33`)에 `Clock.fixed(...)` 를 넘기면 된다. `doc(id, lang, …)` 인자도 있다(`AttractionPageFixtures.kt:41-43`). 구현 가능.
- **implementation E5**: 바닥글 골든을 쓰는 vitest 가 같은 portal-fe 잡의 `npx vitest run`(`ci.yml:298-300`)에서 돈다. 그래서 그 뒤에 diff·status 두 줄을 두는 배치가 맞다. 선례는 `ci.yml:100-101`. 구현 가능.

## 3. 새 발견

### T3-1 (REVISE) [체크 5] 비고 대조가 상수가 아니라 테스트 안의 리터럴과 대장을 비교한다
- 스펙: SR-1.4(`spec.md:19`) — 「`**` 를 지운 대장 전문에 대기 실시간 측정 비고 「실시간 측정값으로 확정 전 자료」가 부분 문자열로 있고, TourAPI 비고의 핵심어 「행마다 다르다」·「출처표시·변경금지」가 둘 다 있다. 상수에서 비고가 빈 문자열이 아닌 행은 정확히 넷(SR-1.2)이다.」 이 문장은 2라운드 심판 E2(b)가 새로 넣었다. 그래서 2라운드 test-strategy 리뷰 대상이 아니었다.
- 문제
  - TourAPI 비고의 공개 문구는 「행마다 공공누리 유형이 다름(…)」(`spec.md:17`)이다. 이 문구에는 「행마다 다르다」가 없다. 그래서 핵심어 검사는 구조상 테스트 리터럴로 대장만 보고 상수는 보지 않는다. 상수의 TourAPI 비고를 어떤 문장으로 바꿔도 초록이다.
  - 대기 비고도 「부분 문자열로 있고」의 왼쪽이 상수 값인지 리터럴인지 적혀 있지 않다. 리터럴로 짜면 상수 문구가 대장과 어긋나도 초록이다.
  - 「정확히 넷」은 개수만 본다. 비고를 「관광지」 행으로 옮겨도 초록이다.
  - 회귀 주입 목록(`spec.md:43`)에 비고 축의 짝이 없다.
  - 결정 ③(「대장과 페이지가 어긋나면 테스트가 실패」, `spec.md:4`)은 비고 열에 대해 증명 수단이 없다. 검사가 스스로 만든 근거로 판정하는 꼴이다.
- 수정안 (`spec.md:19` 의 해당 문장을 아래로 바꾼다)
  - 비고 판정은 상수에서 꺼낸 값으로 한다. 대기 실시간 측정 행의 상수 비고 전체가, `**` 를 지운 대장 전문의 부분 문자열이어야 한다.
  - TourAPI 비고는 두 쪽을 함께 본다. 대장 전문에 「행마다 다르다」·「출처표시·변경금지」가 있어야 하고, 상수 비고에 「행마다」·「출처표시·변경금지」가 있어야 한다.
  - 비고가 빈 문자열이 아닌 행은 개수가 아니라 데이터 이름 집합으로 단언한다. 기대 집합은 다음과 같이 만든다.
    - 정규화 전 대장 라이선스 칸에 「(행마다」가 든 행의 데이터 이름 — 대장에서 꺼낸다
    - 「대기 실시간 측정」
  - SR-5.4 에 주입 두 줄을 더한다.
    - 상수의 대기 비고 문구 한 글자 변경 → 빨강
    - TourAPI 비고를 「관광지」 행으로 옮김 → 빨강

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | AC 마다 테스트 | 충족 |
| 2 | 레이어 배정 | 적절 (MockMvc standalone 이라 `HttpEntityMethodProcessor` 가 실제로 돈다) |
| 3 | 목 경계 | 적절 (포트만 대역) |
| 4 | 테스트 데이터 | 충족 (고정 시계·픽스처·이스케이프 입력) |
| 5 | 부정·경계 사례 | 부분 — T3-1 |
| 6 | 네이밍 | 적절 |

이슈 1건(REVISE), 차단 없음. 스펙 한 문장과 주입 두 줄로 닫힌다.

VERDICT: REVISE
