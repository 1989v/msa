# 스펙 D(place-detail-first-screen) TG6.3·6.4 — 회귀 주입(SR-5.5) · 골든 재생성 diff

- 2026-10-09 KST. 임시 사본 `scratchpad/wt-inject-d`(detached `9721f486c`)에서 했다. 원본 wt-impl·메인 트리는 손대지 않았고, 끝난 뒤 사본을 지웠다.
- 사본 준비: 서브모듈 ai·auth·gifticon 은 메인 `.git/modules` 에서 `clone --shared` 한 뒤 포인터 sha 를 checkout 했다(`8d09e81c9`·`eca3e91de`·`848ed98bc`). `portal-fe/node_modules` 는 wt-impl 것을 심링크했다(package-lock.json `cmp` 동일 확인).
- 주입 전 기준선:
  - vitest `src/seo src/pages/place`: 27 파일 437 passed.
  - Kotlin `--rerun`: AttractionAttributeParserTest 17/0 · AttractionFeeTest 11/0 · AttractionSeoTextTest 14/0 · AttractionApiReindexTaskletTest 39/0 · AttractionsIndexMappingTest 12/0 · SearchAttractionServiceTest 50/0 · AttractionPageRendererTest 99/0 · VisitSummaryParityTest 37/0 · PhoneParityTest 12/0 · AttractionJsonLdParityTest 40/0.
  - `verifySearchIndexContract` 종료 0.
  - FE `npx tsc -b`: 기준선 오류 9건. 모두 생성 파일 `search-architecture.json` 이 없어서 나는 것이다(`routes.test.tsx`·`SearchArchitecturePage*`).
- 주입은 한 번에 하나씩 넣었다. 대상 테스트만 돌리고 `git checkout -- .` 로 되돌린 뒤 `git status --porcelain` 이 비었는지 확인했다(19건 모두 clean). 골든 테스트는 `UPDATE_RENDER_GOLDEN` 없이 돌렸다.
- 컴파일 확인:
  - 주입마다 테스트 전에 따로 확인했다. Kotlin 은 `:search:domain/:search:batch/:search:app:compileTestKotlin`, FE 는 `npx tsc -b` 의 오류를 기준선 오류와 비교했다.
  - 15번(첫 판)만 컴파일에 실패했다. Map 갈래를 지우면 `else -> emptyList()` 의 타입을 추론하지 못한다(`AttractionFee.kt:27:21 Cannot infer type for type parameter 'T'`). 그래서 증거에서 빼고, 컴파일되는 19번(`is Map<*, *> -> emptyList<Any?>()`)으로 다시 쟀다.
  - 나머지 18건은 Kotlin 종료 0, FE 새 오류 0건이다.
- 빨강은 모두 해당 단언의 실패다. 같은 클래스·파일의 다른 테스트가 통과하므로 구문 오류가 아니다.
- Kotlin 은 `-q` 로 돌려 로그에 테스트 이름이 남지 않는다. 그래서 Kotlin 주입 16건(15번 제외)을 한 번 더 돌려 JUnit XML 에서 실패 testcase 이름을 뽑았다. 두 판의 결과 줄은 16건 모두 같았다.

## SR-5.5 회귀 주입

| # | 주입 | 대상 테스트 | 결과 줄 · 잡은 테스트 |
|---|---|---|---|
| 1 | 괄호 여는 말 처리 삭제. 국문 개장 단서 괄호를 떼지 않음(`… "" else m.value` → `m.value`) | :search:domain AttractionAttributeParserTest | 종료 1 · tests=17 failures=2 — 「연중무휴 · 매주 요일 · 명절만 · 조건부 로 갈린다」(tsv 픽스처, 77 포함)·「쉼표 없는 괄호에 여는 말만 있으면 괄호를 떼고 요일을 읽는다」 |
| 2 | 휴무 이동 말 판정 삭제(`KO_MOVED_CLOSURE` 검사 줄 제거) | AttractionAttributeParserTest | 종료 1 · tests=17 failures=1 — 「연중무휴 · 매주 요일 · 명절만 · 조건부(UNKNOWN) 로 갈린다」(tsv 픽스처, 4811 UNKNOWN) |
| 3 | `AttractionFee` 반복정보 폴백 삭제(`rows` 를 늘 빈 목록으로) | :search:domain AttractionFeeTest | 종료 1 · tests=11 failures=6 — 반복정보 값·serialnum 순 「 / 」·요금 행 선택·한 행짜리 목록·원천 위치 순서값·「&lt;어린이&gt; 무료」 정규화 한 번 |
| 4 | 태스클릿 `feeText` 전달 삭제(색인 문서의 `feeText = feeText,` 줄 제거) | :search:batch AttractionApiReindexTaskletTest | 종료 1 · tests=39 failures=3 — 무료 행 FREE·금액 행 PAID·깨진 JSON(useFee 기준) 세 단언 |
| 5 | `SearchAttractionService` 매핑 한 줄 삭제(`feeText = feeText,`) | :search:app SearchAttractionServiceTest | 종료 1 · tests=50 failures=1 — 「네 값을 결과에 그대로 싣는다」 |
| 6 | 확인 상태 null 폴백 삭제, FE `placeAttributes`(`${source ?? na}` → `${source}`, 국·영) | placeView.test.ts + AttractionPage.test.tsx | 종료 1 · 2 failed \| 142 passed (144) — 「확인 상태 — … 모르는 출처는 TourAPI 로 짐작하지 않는다」·「방문 요약은 일곱 칸을 표 순서로 — 값이 없는 칸은 「정보 없음」」 |
| 7 | 확인 상태 null 폴백 삭제, Kotlin 렌더러(`attractionSourceName(...) ?: na` → `?: na` 제거) | :search:app VisitSummaryParityTest + AttractionPageRendererTest | 종료 1 · Parity tests=37 failures=7(「칸 이름·값이 순서째 같다」 ×7) · Renderer tests=99 failures=2(「출처가 없거나 모르는 값이면 「출처: 정보 없음」…」·골든 attraction-http-image-ko) |
| 8 | 요금 행 `escapeHtml` 제거(SSR 방문 요약의 요금 `<dd>` 만 원문) | AttractionPageRendererTest | 종료 1 · tests=99 failures=5 — XSS 「태그 모양 글자가 요소가 되지 않는다」·「「&lt;어린이&gt; 무료」는 그대로 보인다」·「feeText 가 없으면 원천 useFee …」·골든 attraction-ko/en |
| 9 | FE 방문 요약 문구 한쪽만 변경(주차 칸 「주차 불가」→「주차 안 됨」, FE 만) | ① vitest visitSummaryGolden.test.ts(골든 재작성) ② CI 「Visit summary golden fixture is current」 두 명령 ③ VisitSummaryParityTest | ① 종료 0 · 3 passed(골든을 다시 쓰는 단계라 초록이 정상) ② `git diff --exit-code` 종료 1 · `test -z status` 종료 1 ③ 종료 1 · tests=37 failures=1 — 「칸 이름·값이 순서째 같다」 |
| 10 | SSR 방문 요약을 개요 뒤로(요약·배지 블록을 개요 append 뒤로) | AttractionPageRendererTest | 종료 1 · tests=99 failures=4 — 순서 단언 「절 순서는 제목 → 방문 요약 → 배지 줄 → 행동 줄 → 개요 → …」·골든 attraction-ko/en/http-image-ko |
| 11 | ImageObject license 매핑 뒤바꿈, Kotlin `KOGL_LICENSE` Type1↔Type3 | :search:app AttractionJsonLdParityTest | 종료 1 · tests=40 failures=3 — 절대값 단언 「관광지 사진 license 는 공공누리 제1·3유형만 절대 주소로」 + 패리티 「구조적으로 같다」 ×2 |
| 12 | ImageObject license 매핑 뒤바꿈, FE `copy.mjs` `KOGL_LICENSE` Type1↔Type3 | ① attractionJsonLdGolden.test.ts ② CI 골든 diff ③ AttractionJsonLdParityTest | ① 종료 1 · 1 failed \| 12 passed (13) — FE 절대값 「관광지 사진은 ImageObject — 공공누리 제1·3유형만 license 절대 주소를 싣는다」 ② diff 종료 1 · status 종료 1 ③ 종료 1 · tests=40 failures=2 — 패리티 「구조적으로 같다」 ×2 |
| 13 | 색인 매핑에서 새 필드 삭제(`attractions-index.json` 의 `feeText`) | :search:batch AttractionsIndexMappingTest + `verifySearchIndexContract` | Mapping 종료 1 · tests=12 failures=1 — 「출처·공공누리 유형은 keyword, 요금 텍스트는 … 색인하지 않는 text 다」 · 계약 종료 1 — `[attractions/write] AttractionIndexDocument 에 매핑에 없는 필드: feeText` / `[attractions/read] AttractionSearchDocument 에 매핑에 없는 필드: feeText` / `… 반드시 읽어야 할 필드를 안 읽는다: feeText` |
| 14 | SSR `feeText` 에 `sourceText` 다시 걸기(`doc.feeText?.let { sourceText(it) }`) | AttractionPageRendererTest | 종료 1 · tests=99 failures=4 — XSS 「태그 모양 글자가 요소가 되지 않는다」·「「&lt;어린이&gt; 무료」는 그대로 보인다」·골든 attraction-ko/en |
| 15 | `AttractionFee` Map 분기 삭제(줄 제거, 첫 판) | AttractionFeeTest | **컴파일 실패**(`AttractionFee.kt:27:21 Cannot infer type for type parameter 'T'`). 증거가 아니어서 19번으로 다시 쟀다 |
| 16 | Kotlin `attractionPhone` 에서 +82 갈래 삭제. 실제 정규식이 `(?:\+82[- ]?0?\|0)` 이라 이것을 `0` 으로 바꿨다 | :search:app PhoneParityTest | 종료 1 · tests=12 failures=2 — 「international」(+82-2-123-4567 케이스)·「렌더된 행동 줄의 tel: 링크가 골든 href 와 같다」 |
| 17 | FE 「이용 안내」에서 `repeatInfoRows` 제외(spread 줄 + 안 쓰게 된 import 제거) | AttractionPage.test.tsx | 종료 1 · 1 failed \| 67 passed (68) — 「「이용 안내」(일반 유형) — … 반복정보(요금 행 포함)는 원천 순서대로 남긴다」 |
| 18 | 파서 `admission()` 에 `stripTags` 다시 걸기 | AttractionAttributeParserTest | 종료 1 · tests=17 failures=1 — 「꺾쇠를 태그로 지우지 않으므로 무료로 시작하지 않아 UNKNOWN 이다」 |
| 19 | `AttractionFee` Map 분기 무력화(15번의 컴파일되는 판: `is Map<*, *> -> emptyList<Any?>()`) | AttractionFeeTest | 종료 1 · tests=11 failures=1 — 「한 행짜리 목록으로 읽는다」(단일 객체 케이스) |

합계:
- SR-5.5 목록은 16항목이다. 확인 상태와 license 는 FE·Kotlin 으로 나눠 2건씩 넣었다. Map 분기는 컴파일 실패한 15번을 빼고 19번으로 쟀다. 그래서 유효 주입은 18건이다.
- **빨강 18/18, 초록으로 남은 주입 0건.**
- 9·12번에서 첫 vitest 가 초록인 것은 골든을 다시 쓰는 단계라서다. 그 뒤의 CI diff 게이트와 Kotlin 패리티가 빨강이다.

## 6.4 골든 재생성 diff

- 확인 방법: 사본에서 render 골든 파일 17개(`golden/*.html` 12 · `*.json` 5)의 mtime 을 2020-01-01 로 돌려 두고 두 명령을 차례로 돌렸다.
  - `UPDATE_RENDER_GOLDEN=1 ./gradlew :search:app:test --tests '*AttractionPageRendererTest' --rerun`: 종료 0
  - `cd portal-fe && npx vitest run src/seo src/pages/place`: 종료 0, 27 파일 437 passed. jsonld·visit-summary·phone·secure-image·footer-links 골든을 다시 쓴다.
- 17개 파일이 모두 2026-10-09 11:36 으로 다시 쓰였다. 재생성이 실제로 일어났다는 뜻이다.
- **`git status --porcelain` 출력 없음, `git diff --stat -- search/app/src/test/resources/render` 출력 없음.** 커밋된 렌더 골든과 FE 골든 셋(jsonld·visit-summary·phone)은 최신이다. 재생성 diff 는 0 이다.
- 기준선 vitest(주입 전) 뒤에도 porcelain 이 비어 있었다.

## 근거 파일
- `scratchpad/inject-d/run.py`: 주입 정의와 실행기.
- `inj*-vt.log`·`inj*-kt.log`·`inj*-gd.log`·`inj*-ct.log`: 주입별 테스트 출력. `inj*-compile.log` 는 Kotlin 컴파일 확인이다.
- `rows.tsv`·`rows-rerun.tsv`: 결과 행. `failed-names.txt` 는 Kotlin 실패 testcase 이름이다.
- `base-vt.log`·`base-kt.log`·`base-tsc.log`: 기준선.
- `golden-update-kt.log`·`golden-update-vt.log`: 6.4 재생성.
