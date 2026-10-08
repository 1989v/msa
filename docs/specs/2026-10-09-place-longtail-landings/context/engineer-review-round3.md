# spec-review 3라운드(마지막) 재리뷰: place 롱테일 속성 랜딩 + 편집 페이지

범위: `context/review-verdict-round2.md` §4 표의 차원별 「볼 것」. 2라운드 편집 R2-E1~E20 은 전부 `spec.md` 에 반영돼 있다(6·26·29·30·31-42·45·50·52·53·56·58·60·67·69·74·81·85-87·94-102·110-111·120-122·131-133·143·145-162·172행, `open-questions.yml:16,32-46`). 이미 판정된 항목은 다시 열지 않았다. 아래 발견은 모두 편집끼리의 맞물림이나 편집이 새로 만든 결함이다.

## 판정 표

| 차원 | 판정 | 발견 |
|---|---|---|
| implementation | REVISE | I3-1(REVISE) · I3-2(REVISE) · I3-3(MINOR) · I3-4(MINOR) |
| test-strategy | REVISE | T3-1(REVISE) · T3-2(MINOR) · T3-3(MINOR) |
| usecase | REVISE | U3-1(REVISE) · U3-2(MINOR) · U3-3(MINOR) |
| security | SHIP | — |
| domain | SHIP | — |
| architecture | SHIP | — |

---

## implementation

**확인 결과(볼 것 ①~③)**
- ① N 의 출처: grep 해 보면 `facet` 이 N 을 정하는 줄은 SR-1.3 ①(`spec.md:32`) 하나뿐이다. 나머지는 슬러그 표 열 이름(`:22`), 부정문(`:30`, `:58`), M 을 빼는 이유(`:45`), 고정 단언 대상(`:86`), 테스트·주입(`:101-102,111,132,159`)이다. 다만 SR-5.1 의 세 줄이 옛 입력 모양을 전제로 남아 있다(I3-1).
- ② `retired` 다섯 곳: 선정(`:39,41`), 프리렌더(`:50`), sitemap·llms(`:52`), SPA 프리셋·noindex(`:56,60`) 모두 적혀 있다. 그러나 **링크 대상**에는 적히지 않았다(I3-2).
- ③ `as const` 소실: 컴파일된다. TS 사용처는 `PlacePage.tsx:380`(`.join`), `PlacePage.tsx:1347`(스프레드 뒤 `map`, `key`·`data-category`·`setCategory`), `RegionPage.tsx:119`(`.join`) 셋뿐이다. 받는 쪽 상태가 `useState<string | null>`(`PlacePage.tsx:337`)라 `string[]` 추론으로 충분하다. `typeof SIGHT_CATEGORIES[number]` 같은 리터럴 타입 사용처는 0건이다. 근거는 `tsconfig.app.json:16` `allowJs`(checkJs 없음)와 `:17` `verbatimModuleSyntax` 다. 값 re-export 는 이 설정에서 허용된다. `copy.mjs` 를 import 하는 src 파일이 이미 60개라 번들 크기도 바뀌지 않는다.

**I3-1 (REVISE) SR-5.1 「선정 함수」 테스트 세 줄이 새 입력 모양과 맞지 않는다**
- 스펙: R2-E4 로 `selectLandings({ regions, candidates, previous })` 의 입력은 `{ lang, code, attr, count: totalElements, ids }` 가 됐다(`spec.md:34`). 이 입력에는 facet 이 없다.
- 어긋난 줄:
  - `spec.md:90` 「픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양 그대로」
  - `spec.md:97` 「`pet.PARTIAL`·`ELEVATOR` 는 N 에 안 들어감」
  - `spec.md:101` 「`count` 는 `totalElements` 다(facet 건수와 다른 픽스처에서 `totalElements` 를 씀)」
  셋 다 「선정 함수:」(`:91`) 아래에 있는데, 선정 함수는 facet 을 받지 않는다. 그래서 이 테스트는 쓸 수 없거나, 써도 아무것도 재지 않는다. 대상은 ①·② 를 조립해 `candidates` 를 만드는 단계다. 그런데 SR-1.3 은 그 단계를 이름 있는 함수로 두지 않고 「스크립트 main」(`:102`)으로만 부른다.
- 수정안:
  - SR-1.3 ③ 앞에 「①·② 는 `buildCandidates({ lang, regions, get })` 가 한다(`get` 주입). 슬러그 표의 facet 키로 예비 후보를 고르고, 필터 질의의 `totalElements` 를 `count` 로 싣는다」를 넣는다.
  - SR-5.1 에 「후보 조립」 소제목을 만들어 `:97`·`:101`·`:102` 를 옮긴다.
  - `:90` 은 「후보 조립 픽스처는 `AttributeFacets` 모양 + 검색 응답(`totalElements`, 상위 30 id), 선정 함수 픽스처는 `candidates` 모양」으로 바꾼다.
  - 회귀 주입 `:158`(previous 버림)은 선정 함수에 그대로 두고, 「후보 조립이 `count` 에 facet 건수를 실음(`:101` 테스트가 빨강)」을 하나 더한다.

**I3-2 (REVISE) 은퇴 항목이 형제 링크·편집 페이지 링크에서 빠지지 않는다**
- 스펙:
  - 형제 링크는 「같은 언어 목록 안의 같은 시군구 다른 속성, 같은 시도 같은 속성」이다(`spec.md:46`).
  - 편집 페이지 내부 링크는 「목록에 있는 랜딩」이다(`spec.md:74`).
  - R2-E4 이후 목록에는 `retired` 항목이 영구히 남는다(`spec.md:41`).
- 결함: 스위치를 켜면 색인되는 랜딩과 published 편집 페이지가 noindex 인 은퇴·미달 랜딩으로 링크를 건다. 링크 그래프가 noindex 페이지로 새고, 은퇴가 쌓일수록 그 비중이 커진다. 반면 sitemap 조건(`:52`)은 은퇴를 뺀다. 같은 목록에서 두 규칙이 갈린다.
- 수정안:
  - `:46` 형제 링크에 「`retired` 가 아니고 현재 N ≥ 하한인 항목만(SR-1.9 와 같은 조건, 스위치는 제외)」을 붙인다.
  - `:74` 「목록에 있는 랜딩」도 같은 조건으로 바꾼다.
  - SR-5.1 프리렌더 출력에 「`retired` 형제는 링크 안 됨」 한 줄을 넣는다.

**I3-3 (MINOR) re-export 뒤 `placeApi.ts` 주석이 거짓이 된다**
- 근거: `placeApi.ts:326-331` 「화면마다 각자 배열을 들고 있던 게 원인이라 여기 한 곳에 둔다」. SR-4.1(`spec.md:85`)이 정의를 `copy.mjs` 로 옮기면 이 주석은 사실과 다르다.
- 수정안: SR-4.1 에 「주석(명동 7건 쇼핑 사고 근거)은 `copy.mjs` 정의 위로 옮기고, `placeApi.ts` 에는 re-export 한 줄만 둔다」를 덧붙인다.

**I3-4 (MINOR) 표지 검사와 SPA 분할기가 각자 표지를 해석한다**
- 근거:
  - 검사는 「표지 값」의 형식과 집합만 본다(`spec.md:67`).
  - SPA 는 「본문 HTML 을 표지 기준으로 나눈다」(`spec.md:69`).
  - render-content 의 `check()` 는 `data-*` 형태를 보지 않는다(`render-content.mjs:144-182`).
  - 둘이 다른 정규식을 쓰면 문제가 생긴다. 예컨대 홑따옴표나 추가 속성이 붙은 표지는 검사를 통과하고 분할기를 빠져나간다. 그러면 카드가 조용히 사라지고 빈 div 가 innerHTML 로 들어간다. 보안 문제는 아니다(원본은 레포 md 다). 하지만 「프리렌더 카드 수 = SPA 카드 수」가 깨진다.
- 수정안: render-content 가 분할까지 해서 JSON 에 `parts: Array<{ html } | { cardId }>` 로 싣는다. SPA 는 나누지 않고 `parts` 를 그린다. 검사에는 「`data-guide-card` 출현 수 = 정확한 표지 형식(`<div data-guide-card="\d{1,12}"></div>`) 일치 수」를 더한다. 그러면 분할 규칙이 한 곳에만 있다.

---

## test-strategy

**확인 결과**: 새 주입 5개(`spec.md:158-162`) 중 셋은 컴파일되는 회귀로 대응 테스트가 빨강을 낸다.
- previous 버림 → `:100`
- SPA N 을 facet 으로 → `:132`(facet `null` 픽스처)
- `sigunguCode` 5자리 → `:131`

나머지 둘은 아래 T3-1·T3-3 이다. SR-4.2 와 SR-4.3 은 문단으로는 갈렸지만, 픽스처 줄에서 섞였다(T3-2).

**T3-1 (REVISE) 「표지 id 형식 검사 제거」 주입이 무동작일 수 있다**
- 근거: `spec.md:121` 「표지 id 형식 위반(`abc`)·`attractionIds` 와 표지 집합 불일치 → render-content 실패」. 두 경우가 한 줄에 묶여 있다. 형식 위반 픽스처의 표지 `abc` 가 머리말 `attractionIds` 에 없으면, 형식 검사를 지워도 집합 검사가 같은 픽스처를 실패시킨다. 그러면 주입(`:162`)은 초록이다.
- 수정안: `:121` 을 두 줄로 나눈다.
  - 「형식 위반: 표지와 `attractionIds` 가 둘 다 `1234567890123`(13자리 — 집합은 일치, 형식만 위반) → 실패」
  - 「집합 불일치: 표지 `101`, `attractionIds: [101, 102]` → 실패」
  - `:162` 에는 「(13자리 픽스처가 빨강)」을 붙인다.

**T3-2 (MINOR) 경계 픽스처가 리터럴이라 SR-4.3 과 어긋난다**
- 근거:
  - SR-4.3 은 「경계 픽스처는 상수와 대상 함수의 출력으로 계산한다」고 한다(`spec.md:87`).
  - 그런데 `:92` 「9 제외·10 포함」과 `:99` 「30 id 중 21 공유(0.538) → 제외, 20 공유(0.5) → 포함」은 리터럴이다.
  - 그래서 주입 「하한 10→9」(`:145`)는 SR-4.2 단언과 경계 테스트를 함께 빨갛게 만든다. 어느 테스트가 결정 고정을 맡는지 흐려진다.
  - `:86` 「테스트 파일 하나가」는 SR-4.2 단언을 별도 파일에 두라는 뜻인지도 정하지 않았다.
- 수정안:
  - `:92` 를 「`MIN-1` 제외 · `MIN` 포함」으로 바꾼다.
  - `:99` 를 「공유 수 k 를 `JACCARD_MAX` 와 30 에서 계산(k/(60−k) 가 상한을 넘는 최소 k → 제외, 그보다 1 작은 k → 포함)」으로 바꾼다.
  - `:86` 에 「상수만 import 하는 전용 파일(예 `landingDecisions.test.ts`)」을 명시한다. 그러면 `:145` 주입은 SR-4.2 파일만, `:146` 주입은 경계 테스트만 빨갛게 한다.

**T3-3 (MINOR) 「SPA 카드를 HTML 문자열 결합으로」 주입의 형태가 열려 있다**
- 근거: `spec.md:161`. 결합하면서 `escapeHtml` 을 거치면 `:120` 의 이스케이프 테스트는 초록이다. 이스케이프된 결합은 실제로 안전하므로, 주입이 노리는 회귀는 「이스케이프 없는 결합」이다.
- 수정안: 「SPA 카드를 이스케이프 없이 HTML 문자열에 이어 붙여 `dangerouslySetInnerHTML` 로(픽스처 `<script>` 가 요소로 생겨 빨강)」로 쓴다.

---

## usecase

**수명주기 추적**: 선정(`:41`) → 은퇴(`:41,50`) → 재선정(`:41`, `selectedAt` 유지) → 스위치 켜기(`:16`, 초안 `adr-0062-amendment-draft.md:16`) → 철회(초안 `:17`, 스위치 `false`, 주소는 noindex 로 유지). 단계 사이 규칙은 서로 맞는다. 단, 아래 셋이 비어 있다.

**U3-1 (REVISE) 시군구 코드가 개편되면 영구 보존 항목이 이름 없는 페이지가 된다**
- 스펙: 항목은 목록에서 빠지지 않는다(`spec.md:41`). 빌드는 heading 에 시도 약칭·시군구 이름이 필요하다(`:44`). 모집단은 현재 `administrative-regions` 행이다(`:36`).
- 코드: 같은 일이 이미 있었다. 광주(29)·전남(46)이 12로 합쳐져 원천에 29·46 행이 없어졌고, nginx 가 옛 지역 주소를 시도 허브로 301 한다(`nginx.conf:219-226`). 그 정규식 `regions/(29|46)([0-9]{3})?$` 는 세그먼트가 하나라 `/regions/29110/parking` 같은 랜딩 주소는 받지 않는다.
- 결함: 개편된 코드의 항목은 다음 상태가 된다.
  - 이름 조회 실패: 스펙에 처리 규칙이 없다.
  - 결과 0건이면 noindex 200 으로 남는다. 2라운드가 막으려던 soft 404 가 다른 경로로 다시 생긴다.
- 수정안: SR-1.7 에 「항목 `code` 가 현재 모집단에 없으면 그 페이지는 만들지 않고 빌드 경고. nginx 레거시 지역 301 정규식에 `(/[^/]+)?` 를 붙여 랜딩 주소도 시도 허브로 보낸다」를 넣는다. 「한 번 생긴 주소는 404 가 되지 않는다」(`:41`)의 예외로 적는다. SR-5.2 nginx 계약에 「`/regions/29110/parking` 301」 한 줄, SR-5.1 에 「모집단 밖 항목 → 파일 없음」 한 줄을 더한다.

**U3-2 (MINOR) 은퇴 항목 누적의 상한과 비용이 적혀 있지 않다**
- 근거:
  - 상한은 활성 항목만 센다(`spec.md:39`). 은퇴 항목은 지워지지 않는다(`:41`).
  - 빌드는 은퇴 항목까지 현재 N 을 조회해 페이지를 만든다(`:50`). 항목 하나가 실패해도 섹션 전체가 실패다(`:51`).
  - 스크립트를 돌릴 때마다 최대 20개가 새로 들어오고 밀려난 것은 은퇴한다. 그래서 목록 크기는 「한 번이라도 뽑힌 조합 수」까지 단조 증가한다. 빌드 질의 수와 부분 실패 면적이 그만큼 늘어난다.
  - 판정문 §5.3 은 「스위치가 꺼진 동안은 색인된 주소가 없어 지워도 피해는 없다」고 적었다. 그런데 스펙에는 이 기간에 정리해도 된다는 규칙이 없다.
- 수정안: SR-1.3 기존 항목 유지 끝에 다음 둘 중 하나를 적는다.
  - 「`PLACE_LANDINGS_INDEXABLE` 이 한 번도 `true` 가 된 적 없는 동안은 스크립트가 은퇴 대신 삭제한다」
  - 「은퇴 항목 수가 활성 상한(20)을 넘으면 스크립트가 경고하고, 정리는 Q8 재판단으로 넘긴다」

  어느 쪽이든 「빌드 질의 수 = 목록 항목 수」를 SR-1.8 에 적어 둔다.

**U3-3 (MINOR) ADR 개정 초안에 은퇴 규칙이 없다**
- 근거: `adr-0062-amendment-draft.md:14-15` 는 「빌드마다 다시 뽑지 않는다」 「빌드 때 미달이면 noindex」까지만 적었다. `:12` 「국·영 합산 20 상한」도 활성 항목 기준이라는 말이 없다. 스펙(`spec.md:39,41`)과 Q8(`open-questions.yml:37-41`)이 정한 「다시 돌려도 빠진 주소는 noindex 로 남는다」가 수용 대상 문서에 빠져 있다. 승인자는 ADR 만 보고 판단하므로, 랜딩이 20개를 넘어 쌓이는 것을 모른 채 승인하게 된다.
- 수정안: 초안 `:14` 뒤에 「목록을 다시 뽑아도 빠진 항목은 지우지 않고 `retired`·noindex 로 남긴다. 상한 20은 활성 항목 수다」를 넣는다.

---

## security — SHIP

- 표지 사이 조각은 render-content 가 낸 HTML 의 부분 문자열이다. 그 HTML 전체가 `check()` 를 지난 뒤 JSON 에 실린다(`render-content.mjs:140`, `spec.md:66-67`).
- SPA 는 그 조각만 `dangerouslySetInnerHTML` 로 넣고, 카드는 React 요소로 그린다. API 응답 문자열을 HTML 에 잇지 않는다(`spec.md:69`).
- 프리렌더 카드는 고정 템플릿 + 평문화 + `escapeHtml` 이다(`spec.md:68`).
- 카드 영역이 innerHTML 경로로 새는 길은 스펙상 없다. 이스케이프는 양쪽 다 테스트(`:120`)와 주입(`:161`)이 받친다.
- 분할 규칙이 두 곳에 생기는 일관성 문제는 I3-4(MINOR, 보안 아님)로 implementation 에 두었다.

## domain — SHIP

- 「휠체어 대여」는 슬러그 표 한 칸(`spec.md:26`)에만 리터럴로 있다. heading·sentence 는 `{속성 국문 이름}` 자리로 그 칸을 쓰고(`:44-45`), title·description 도 같은 `landingMeta` 가 낸다(`:43`).
- SR-4.2 가 그 국문 이름을 리터럴 단언으로 고정한다(`:86`). Q3 답(`open-questions.yml:16`)도 같은 문구다.
- glossary 동기화 네 행(`:172`)은 속성 이름을 싣지 않아 충돌이 없다.
- 허브 칩 라벨 「휠체어」(`placeAttributes.ts:53`)가 남는 것은 `:29` 에 의도로 적혀 있다.
- ADR 초안에는 속성 이름이 나오지 않는다.

## architecture — SHIP

- 상수 자리는 `copy.mjs` 한 곳이다(`spec.md:85`). node 쪽은 직접 import 한다(선례 `prerender-seo.mjs:97`). TS 쪽은 `placeApi.ts` 가 re-export 한다(선례 `AdSlot.tsx:2`).
- `tsconfig.app.json:16` `allowJs` 로 경로가 성립한다. `copy.mjs` 짝 선언 파일은 없고 필요 없다(`.mjs` 추론으로 충분, implementation ③).
- 칩 id 는 `placeAttributes.ts` 에 두고 테스트로 대조한다. 따라서 `copy.mjs` → `.ts` 역방향 import 가 생기지 않는다.

---

## 발견 요약

| id | 차원 | 등급 | 한 줄 |
|---|---|---|---|
| I3-1 | implementation | REVISE | 선정 함수 테스트 3줄(`:90,97,101`)이 facet 입력을 전제 — 후보 조립 함수로 옮겨야 |
| I3-2 | implementation | REVISE | 형제·편집 링크(`:46,74`)가 은퇴·미달 랜딩을 가리킴 — SR-1.9 조건 적용 |
| I3-3 | implementation | MINOR | `placeApi.ts:326-331` 「여기 한 곳」 주석이 re-export 뒤 거짓 |
| I3-4 | implementation | MINOR | 표지 검사·SPA 분할기가 각자 해석 — render-content 가 `parts` 로 나눠 싣기 |
| T3-1 | test-strategy | REVISE | 형식 위반 `abc` 픽스처가 집합 검사에도 걸려 형식 검사 제거 주입이 초록 |
| T3-2 | test-strategy | MINOR | 경계 픽스처 리터럴(`:92,99`)이 SR-4.3 과 어긋남, 고정 단언 전용 파일 미명시 |
| T3-3 | test-strategy | MINOR | 카드 결합 주입을 「이스케이프 없는 결합」으로 특정 |
| U3-1 | usecase | REVISE | 코드 개편(29·46→12 선례) 시 영구 보존 항목이 이름 없는 soft 404 — 301 확장 |
| U3-2 | usecase | MINOR | 은퇴 항목 단조 누적의 상한·빌드 질의 수 미기재 |
| U3-3 | usecase | MINOR | ADR 초안에 은퇴 규칙·「20 = 활성 기준」 없음 |

BLOCK 없음. REVISE 4건은 모두 스펙 문장 수정으로 닫히고 사용자 판단이 필요 없다.

VERDICT: REVISE
