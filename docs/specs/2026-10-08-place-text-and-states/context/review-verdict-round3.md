# 3라운드 발견 판정: place 원문 정제와 상태 규칙 스펙

3라운드 발견 12건을 판정한 결과 12건 모두 유지했고, 강등과 기각은 없습니다. 등급은 REVISE 3건(U3-1·T1·T2), MINOR 9건입니다.

- **구현을 막는 결함은 U3-1 하나입니다.** 「모두 해제」를 누르면 화면에 버튼으로 보이지 않던 속성 조건이 질의에 다시 붙습니다. 정해야 할 동작이 하나 있습니다.
- **T1·T2 는 REVISE 를 유지했습니다.** 스펙 결정은 그대로이고 테스트 항목만 더하면 닫힙니다. 그래도 강등할 실측 반증(헌법 ⓐⓑⓒ)이 없었습니다. 또 그대로 두면 운영에서 조용히 틀어지는 경로를 테스트가 하나도 잡지 못합니다. T1 은 대분류 필터가 소리 없이 꺼지는 경우, T2 는 SR-6 이 한 번도 적용되지 않는 경우입니다.
- **나머지 9건은 MINOR 입니다.** 구현 중 한 줄을 고치거나 테스트 한 줄을 더하는 보강입니다.
- 아래 편집을 반영하면 U3-1·T1·T2 모두 닫히고, 재리뷰는 필요 없습니다.

판정은 워크트리 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/` 의 원문을 직접 읽고 내렸습니다.

## 묶음 표

| 묶음 | 포함 발견 | 판정 | 등급 | 닫는 방법 |
|---|---|---|---|---|
| G1 행사 분류에서 해제할 때의 사후 상태 | usecase U3-1 | keep | **REVISE** | 분류 해제는 분류 칩과 같은 규칙을 쓰고, 「모두 해제」는 숨은 속성도 비운다(편집 E-a). 기본값 하나는 사용자 판단 1 |
| G2 자동 시도 선택이 해제 뒤에 끼어듦 | usecase U3-2 | keep | MINOR | 해제 핸들러에서 `autoPickedRef.current = true`(편집 E-b) |
| G3 집계 응답을 해석하는 코드에 테스트가 없음 | test T1, implementation 참고(헬퍼) | keep | **REVISE** / MINOR | 어댑터 테스트가 자기 목을 두고 응답 해석까지 단언한다(편집 E-c) |
| G4 서비스가 넘기는 버킷 크기에 테스트가 없음 | test T2 | keep | **REVISE** | 서비스 테스트 ⑧과 회귀 주입 한 줄(편집 E-d) |
| G5 잘림 검사의 회귀 주입 · `lexicon(null)` | test T3, test T4 | keep | MINOR | 주입 한 줄과 ⑨(편집 E-c, E-d) |
| G6 기존 가드 두 개를 옮길 곳 | implementation I3-1, architecture 참고② | keep | MINOR | 빈 코드표면 집계를 부르지 않는다. `enabled` 는 어댑터가 빈 목록을 돌려준다(편집 E-d) |
| G7 문서 동기화 | domain D3-1 | keep | MINOR | `search-architecture.md` 를 같은 커밋에서 고친다(편집 E-e) |
| G8 KDoc | domain 참고(옛 말), architecture 참고① | keep | MINOR | 옮겨 적는 KDoc 의 용어와 새 포트 계약 한 줄(편집 E-f) |

## 발견별 JSON

```json
[
  { "id": "usecase U3-1 행사 분류에서 분류를 풀면 숨은 속성이 다시 붙음",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 351, "quote": "// 고른 칩은 남겨 두어 행사 칩을 풀면 다시 걸린다 / ...(category === EVENT_CATEGORY ? {} : attributeQuery(attributes))" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 1223, "quote": "changedRef.current = ['category', 'listEventStatus', 'page']; setCategory(...); setListEventStatus(null);" },
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 49, "quote": "분류 `['category','page']`" },
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 47, "quote": "「모두 해제」는 순수 함수가 낸 조건 각각을 개별 버튼과 같은 규칙으로 한 번씩 푼다." } ],
    "reason": "행사 분류에서는 속성이 질의에서만 빠지고 상태에는 남는다. 그래서 스펙대로 「모두 해제」를 하면 버튼에 없던 속성이 다시 걸려 Goal(spec.md:9)과 어긋나고, 분류 해제의 changed 와 setter 도 기존 칩 어휘와 다르다. 어느 동작으로 할지 정하는 편집이 필요해 구현 전 결함으로 본다." },

  { "id": "usecase U3-2 자동 시도 선택이 해제 직후 initial 로 덮음",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 584, "quote": "if (autoPickedRef.current || !hasRegionAxis || sidoCode || keyword || geo) return;" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 587, "quote": "autoPickedRef.current = true;" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 556, "quote": "triggerRef.current = trigger;" } ],
    "reason": "검색어나 geo 가 시도 목록보다 먼저 걸리면 autoPickedRef 가 거짓으로 남고, 해제 뒤 effect 가 시도를 다시 고른다. keyword 초기값이 ''(:294)라 공유 링크로 들어오는 경로는 없고 경로가 좁다. 핸들러 한 줄과 테스트 한 건으로 닫히는 보강이다." },

  { "id": "test T1 집계 응답 해석이 목 경계 밖",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/test/kotlin/.../AttractionSearchRequestSnapshots.kt", "line": 48, "quote": "every { client.search(any<SearchRequest>(), JsonData::class.java) } ... // 집계가 없어 건수 조립은 실패한다 — 요청 모양만 본다" },
      { "file": "search/app/src/test/kotlin/.../UnifiedAttractionRequests.kt", "line": 31, "quote": "val (adapter, captured) = AttractionSearchRequestSnapshots.adapter()" },
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 70, "quote": "(`AttractionReindexCaptureTest`·`UnifiedAttractionRequests` 관례): ... `sum_other_doc_count > 0` 이면 예외를 던진다." } ],
    "reason": "스펙이 가리킨 관례 헬퍼는 집계 없는 빈 응답만 준다. 그래서 스펙이 요구한 잘림 예외 케이스를 그대로는 짤 수 없고(ⓒ 확인), 응답을 맵으로 바꾸는 코드는 어떤 테스트도 보지 않는다. 강등할 반증이 없다." },

  { "id": "implementation 참고 — 요청 캡처 헬퍼를 그대로 못 씀",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "search/app/src/test/kotlin/.../AttractionSearchRequestSnapshots.kt", "line": 36, "quote": "// 집계가 없어 건수 조립은 실패한다 — 요청 모양만 본다" } ],
    "reason": "T1 과 같은 근거다. 리뷰어는 tasks 에만 적으면 된다고 했지만, 스펙 문구가 그 헬퍼를 가리키므로 T1 편집(E-c)에 한 문장으로 흡수한다." },

  { "id": "test T2 서비스가 코드표 행 수를 버킷 크기로 넘기는지 미검증",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 61, "quote": "버킷 크기는 그 갱신에서 받은 코드표 행 수 이상으로 잡는다(상수·설정 아님)." },
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 63, "quote": "한 번도 만든 적이 없으면 코드표 전체로 만든다(오늘 동작)." },
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 83, "quote": "집계 버킷 크기 지정 삭제 → 요청 캡처 테스트 빨강" } ],
    "reason": "서비스가 상수를 넘기면 매 주기 잘림 예외가 나고, :63 의 규칙 때문에 사전이 영구히 코드표 전체로 남는다. 그러면 SR-6 이 무동작인데 단위 테스트는 모두 초록이다. 주입 목록도 어댑터 쪽만 덮는다." },

  { "id": "test T3 잘림 검사에 회귀 주입 없음",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 83, "quote": "집계 버킷 크기 지정 삭제 → 요청 캡처 테스트 빨강" } ],
    "reason": "SR-7.3 주입 목록에 sum_other_doc_count 검사 삭제가 없다. T1 픽스처가 생기면 주입 한 줄로 닫힌다." },

  { "id": "test T4 lexicon(null) 경로 테스트 없음",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt", "line": 40, "quote": "cache.get()[lang ?: DEFAULT_LANG] ?: QueryIntent.Lexicon.EMPTY" },
      { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 64, "quote": "`fun lexicon(lang: String?): QueryIntent.Lexicon`" } ],
    "reason": "null 이면 ko 사전을 쓴다는 규칙이 스펙 본문에도 테스트에도 없다. 새로 쓰는 서비스가 이 규칙을 잃어도 테스트가 잡지 못한다. 한 줄 규칙과 테스트 ⑨로 닫힌다." },

  { "id": "implementation I3-1 기존 가드 두 개(enabled·빈 코드표) 이전처 없음",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt", "line": 52, "quote": "if (!enabled) return" },
      { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt", "line": 57, "quote": "if (loaded.isEmpty()) { log.warn { \"분류 코드표가 비어 있다 — 사전을 바꾸지 않는다\" }" } ],
    "reason": "스펙 :63-65 에 두 가드를 어디로 옮길지가 없다. 결과 사전은 오늘과 같아 동작 회귀는 없지만, 크기 0 집계 요청과 경고가 매 주기 남는다. 한 문장으로 닫힌다." },

  { "id": "architecture 참고② enabled 는 어디서도 설정되지 않음",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt", "line": 22, "quote": "@Value(\"\\${search.category-lexicon.enabled:true}\") private val enabled: Boolean," } ],
    "reason": "git grep 결과 이 키를 쓰는 곳은 이 줄뿐이다. 빈 목록을 돌려주면 동작이 같다는 점은 맞지만, 집계를 부르지 않는다는 결론은 I3-1 편집이 있어야 성립한다. G6 에 합친다." },

  { "id": "domain D3-1 glossary §3-2 원본(search-architecture.md) 동기화 누락",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [
      { "file": "search/glossary.md", "line": 97, "quote": "정의는 `portal-fe/src/content/search-architecture.md` §2·§4 와 같다. 값이 바뀌면 그 문서의 §4 표가 먼저 바뀐다." },
      { "file": "portal-fe/src/content/search-architecture.md", "line": 263, "quote": "아래를 바꾸면 이 문서의 해당 행과 그림을 같은 커밋에서 고친다. - 검색 ADR ... - `search/` 아래 코드와 설정" } ],
    "reason": "스펙에는 search-architecture.md 가 한 번도 나오지 않는다(grep 0). 그 문서 §5 의 동기화 규칙이 이번 변경(ADR-0090 개정, search 코드)에 걸린다. 문서 한 줄로 닫힌다." },

  { "id": "domain 참고 — 옮겨 적는 KDoc 에 「질의 이해」가 따라감",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "search/app/src/main/kotlin/com/kgd/search/application/attraction/port/CategoryLexiconPort.kt", "line": 6, "quote": "질의 이해가 쓰는 분류 이름 사전의 공급원 (ADR-0090 개정)." } ],
    "reason": "이 KDoc 은 스펙 :65 가 옮기라고 한 대상이고, glossary 표제어는 「쿼리 언더스탠딩」(glossary.md:106)이다. 옮길 때 용어를 맞추면 된다. AttractionSearchPort.kt:60 은 이번 범위 밖이라 보고만 한다." },

  { "id": "architecture 참고① indexedCategoryCodes 실패 계약 KDoc",
    "verdict": "keep", "severity": "MINOR",
    "evidence": [ { "file": "docs/specs/2026-10-08-place-text-and-states/spec.md", "line": 70, "quote": "응답 `sum_other_doc_count > 0` 이면 예외를 던진다." } ],
    "reason": "서비스의 실패 처리가 이 예외 계약에 기대는데, 계약이 테스트 항목에만 있다. 포트 KDoc 한 줄로 닫힌다." }
]
```

## spec.md 편집 목록

**E-a · U3-1** (SR-5.1, SR-7.1, SR-7.3)
- `:49` 바꿀 문구: 「분류 `['category','page']`」
  - 새 문구: 「분류 `['category','listEventStatus','page']`」
  - 「모두 해제」 설명(「「모두 해제」는 푼 필드의 합집합」) 뒤에 이어서: 「「모두 해제」가 속성을 비웠으면 `attributes` 도 넣는다」
- `:47` 「버튼마다 그 조건 하나만 풀고 `setPage(0)`.」 바로 뒤에 추가:
  - 「분류 해제는 분류 칩(`:1220-1226`)과 같이 `setCategory(null)`·`setListEventStatus(null)` 을 부른다.」
  - 「행사 분류에서 분류만 풀면 상태에 남아 있던 속성 칩이 질의에 다시 붙고 칩 줄에 active 로 보인다 — 칩 동작과 같다(`:351-353`).」
- `:47` 「검색어가 있었으면 `keyword`·`keywordInput`·`exactFor` 도 비우고, 마지막에 `setPage(0)` 한다.」 앞에 추가:
  - 「「모두 해제」는 상태에 남은 `attributes` 도 비운다. 행사 분류에서 질의에 실리지 않던 속성도 포함한다. 「모두」를 누른 뒤 버튼에 없던 조건이 다시 걸리지 않게 하기 위해서다.」
- `:79` 끝에 추가:
  - 「행사 분류 + 속성 칩 1개(질의에 안 실림) + 검색어로 0건 → 버튼은 검색어·분류 둘과 「모두 해제」.」
  - 「「모두 해제」를 누르면 다음 질의에 속성 파라미터가 없고, `changed` 에 `attributes`·`listEventStatus` 가 든다.」
  - 「같은 화면에서 분류 버튼만 누르면 속성 파라미터가 다시 실리고, `changed` 는 `['category','listEventStatus','page']`.」
- `:83` 주입 목록에 추가: 「「모두 해제」에서 `attributes` 비우기 삭제 → 행사+숨은 속성 케이스 빨강」

**E-b · U3-2** (SR-5.1, SR-7.1)
- `:47` 「해제 결과로 `pickingRegion`(`:542`)이 참이 되면 지역 고르기 화면으로 바뀌는 것이 정상 동작이다.」 뒤에 추가:
  - 「해제 핸들러와 「모두 해제」는 상태를 바꾸기 전에 `autoPickedRef.current = true` 로 둔다. 첫 진입 자동 시도 선택(`:582-602`)이 해제 뒤에 돌아 시도를 다시 고르거나 trigger 를 `initial` 로 덮지 않게 하기 위해서다.」
- `:79` 끝에 추가: 「시도 목록 응답을 늦추고 검색어만 건 0건 → 검색어 해제 → 지역 고르기 화면, 질의에 `sidoCode` 없음, trigger `relax`.」

**E-c · T1 + implementation 참고 + T3** (SR-6.5, SR-7.3)
- `:70` 항목 전체를 바꾼다.
  - 새 문장: 「`AttractionSearchAdapter.indexedCategoryCodes` 테스트. 요청은 JSON 으로 단언한다(`AttractionReindexCaptureTest`·`UnifiedAttractionRequests` 관례). 단 `AttractionSearchRequestSnapshots.adapter()` 는 집계 없는 빈 응답만 주므로 쓰지 않는다(`:48-51`). 자기 `mockk<OpenSearchClient>` 를 두고, 응답은 `SearchResponse.Builder` 로 집계를 채워 준다.」
  - ⓐ 「요청이 `lang` 별로 `lclsSystm1`·`lclsSystm2`·`lclsSystm3` 세 필드를 terms 집계하고, 버킷 크기가 인자 `bucketSize` 이상이다.」
  - ⓑ 「응답 해석: ko 버킷 `lclsSystm1={A}`·`lclsSystm2={B}`·`lclsSystm3={C}`, en 버킷 `lclsSystm3={D}` → 반환값이 `{ko={A,B,C}, en={D}}` 와 같다. 맵 전체를 같음으로 단언한다.」
  - ⓒ 「어느 버킷이든 `sum_other_doc_count > 0` 이면 예외를 던진다.」
- `:83` 주입 목록에 추가:
  - 「`lclsSystm1` 하위 집계를 읽는 줄 삭제 → 어댑터 ⓑ 빨강」
  - 「`sum_other_doc_count` 검사 삭제 → 어댑터 ⓒ 빨강」

**E-d · T2 + T4 + I3-1** (SR-6.3, SR-6.5, SR-7.3)
- `:63` 「코드표를 못 받으면 지금처럼 들고 있던 사전을 쓴다(처음이면 빈 사전).」 뒤에 추가:
  - 「코드표가 빈 목록이어도 못 받은 것으로 보고, 색인 집계를 부르지 않는다(`CategoryLexiconAdapter.kt:57-60` 가드를 서비스로 옮긴다).」
  - 「`search.category-lexicon.enabled=false` 면 `CategoryCodeAdapter.codes()` 가 빈 목록을 돌려 같은 경로를 탄다.」
- `:64` 「`fun lexicon(lang: String?): QueryIntent.Lexicon`」 뒤에 추가: 「(`lang` 이 null 이면 ko 사전 — 지금 `CategoryLexiconAdapter.kt:39-40` 의 동작)」
- `:69` 「⑦ 코드표 조회 실패 → 들고 있던 사전 유지.」 뒤에 추가:
  - 「⑧ 코드표 N 행을 받으면 `indexedCategoryCodes` 는 N 이상의 인자로 불린다(`verify { search.indexedCategoryCodes(match { it >= N }) }`).」
  - 「⑨ `lexicon(null)` 은 `lexicon("ko")` 와 같은 필터를 낸다(ko 집합에 있는 코드 이름 → 필터 있음).」
  - 「⑩ 코드표가 빈 목록이면 `indexedCategoryCodes` 를 부르지 않고 들고 있던 사전을 유지한다.」
- `:83` 주입 목록에 추가:
  - 「서비스가 상수 `10` 을 넘김 → ⑧ 빨강」
  - 「`lexicon(null)` 이 `EMPTY` 를 돌려줌 → ⑨ 빨강」

**E-e · D3-1** (SR-5.5)
- `:55` 끝에 추가:
  - 「같은 커밋에서 `portal-fe/src/content/search-architecture.md` 를 고친다. 이 문서는 glossary §3-2 의 원본이고, §5 의 동기화 규칙을 따른다.」
  - 「§2.1 `:89` 단계와 §4 `:250` 쿼리 언더스탠딩 행에 「분류 사전은 코드표 ∩ 그 언어 색인 코드(10분 갱신)」를 더하고, 근거 열에 `CategoryLexiconService` 경로를 넣는다.」
  - 「§2.2 오타 교정 표(`:150-154`)에 「`exact=true` 면 건너뛴다」 행을 더한다.」

**E-f · KDoc 두 건** (SR-6.3 바꿀 곳)
- `:65` 바꿀 문장: 「`CategoryLexiconPort.kt:9` KDoc 「못 받으면 빈 사전을 준다」를 위 실패 처리로 옮겨 적는다.」
- 새 문장:
  - 「`CategoryLexiconPort.kt:5-11` KDoc 을 `CategoryLexiconUseCase` 로 옮겨 적는다. 「질의 이해」는 「쿼리 언더스탠딩」으로, 「못 받으면 빈 사전을 준다」는 위 실패 처리로 바꾼다.」
  - 「새 포트 메서드 `indexedCategoryCodes` 에 KDoc 을 단다: 「`bucketSize` 는 받을 코드 수의 상한이고, 어느 버킷이든 `sum_other_doc_count > 0` 이면 예외」.」

## 사용자 판단 항목

1. **「모두 해제」가 숨은 속성까지 비울지 (U3-1, E-a)**
   - Goal 의 「조건을 조용히 바꾸지 않는다」에 맞춰 **비운다**를 기본값으로 정했습니다.
   - 반대로 「분류 칩처럼 속성을 남겨 다시 걸리게 둔다」를 원하면 E-a 의 「모두 해제」 문장과 테스트 기대값만 뒤집으면 됩니다.
   - 분류 버튼 하나만 누를 때 속성이 다시 붙는 것은 어느 쪽이든 기존 칩 동작 그대로입니다.
2. **마지막 라운드에 유지된 REVISE 3건(U3-1·T1·T2)의 처리**
   - 프로토콜상 BLOCK 으로 올라가지만, 셋 다 위 편집으로 닫히고 스펙 결정은 바뀌지 않습니다.
   - T1·T2 는 테스트 항목만 더합니다. U3-1 은 1번 기본값만 정하면 됩니다.
   - 편집을 반영한 채로 구현에 들어가도 될지 확인이 필요합니다. 재리뷰는 필요 없다고 봅니다.

SUMMARY: keep 12 / demote 0 / dismiss 0
NOTES: U3-2 가 「위치 권한이 없으면 동기 경로」라고 한 것은 실제로는 `navigator.geolocation` 자체가 없을 때입니다(권한 거부는 비동기 콜백, `PlacePage.tsx:593-600`). 결론에는 영향이 없습니다. 기존 `fetch()` 의 이름·코드가 빈 행을 거르는 줄(`CategoryLexiconAdapter.kt:77`)을 어디로 옮길지 스펙에 없지만, 발견이 아니라 참고로만 남깁니다.