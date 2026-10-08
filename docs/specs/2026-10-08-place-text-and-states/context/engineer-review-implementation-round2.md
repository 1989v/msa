# Engineer Review — implementation (2라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (개정 2026-10-08, 1라운드 심판 반영본)
- 범위: 1라운드 묶음 G5·G7·G8 반영 확인, 새 SR-6 구현 가능성과 원인 진단 확인. 다른 차원은 보지 않는다.

## 1라운드 묶음 반영 확인

| 묶음 | 반영 | 판정 |
|---|---|---|
| G5 픽스처·버전 단언 | `spec.md:35` — `raw-fixtures.tsv:105` 기대값을 UNKNOWN 으로 바꾸고 행은 추가하지 않는다(`size 145` 유지). 원문 확인: `raw-fixtures.tsv:105` 은 `parking en NO N/A (Please use nearby parking facilities)` | 일부 반영. **새 결함 2건**(R2-1) |
| G7 배포 순서·롤백 | `spec.md:73`에 search:app → portal-fe → search:batch → 재색인 순서, `spec.md:36`에 이전 batch 이미지 + 재색인 1회와 `attributeParserVersion` 확인 | 해소. `exact` 는 옛 search:app 이 모르는 쿼리 파라미터라 무시된다(`AttractionSearchController.kt:44-73` 에 바인딩 없음). 그래서 search:app 롤백도 FE 와 충돌하지 않는다 |
| G8 placeApi exact 배선 | `spec.md:51`에 `AttractionQuery.exact?` 와 `searchAttractions`(`:405-428`) 직렬화, `spec.md:69`에 placeApi 단위 테스트, `spec.md:71`에 `AttractionSearchControllerTest` 바인딩 | 해소. 인용 줄 확인: `placeApi.ts:356` `export interface AttractionQuery`, `:405` `new URLSearchParams({ lang: query.lang })` 부터 `:428` 까지 필드를 하나씩 싣는다 |

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 있음. `CategoryLexiconAdapter.kt:50-86`, `QueryIntent.kt:171-236`, `SearchAttractionService.kt:91`, `SearchUnifiedService.kt:29` 를 확인했다 |
| 2 | 기존 코드와 충돌이 없는가 | **충돌 있음.** G5 지시대로 하면 읽기 테스트가 깨지고 CI 캡처 게이트에 걸린다(R2-1) |
| 3 | 복잡도 위험을 짚었는가 | SR-6 은 캐시·스케줄을 application 으로 옮기는 재배치다. 집계 크기, 언어별 교집합, 빈 집합 처리가 정해지지 않았다(R2-2) |
| 4 | NFR 안티패턴 | terms 집계의 기본 크기(10)가 사전을 조용히 잘라낼 수 있다(R2-2 ①). 10분 주기 집계 1회는 비용 문제가 아니다 |
| 5 | 마이그레이션·롤백 | 해소(G7) |
| 6 | 동시성 | 사전은 `AtomicReference` 로 통째 교체한다(`CategoryLexiconAdapter.kt:37,61`). 교집합을 적용한 뒤 한 번에 set 하면 안전하다. 문제없음 |

## 발견

### R2-1 [주요] G5 의 버전 단언 지시 하나가 틀렸고, CI 캡처 갱신이 빠졌다 — SR-4.2
- **`AttractionSearchDocumentTest.kt:61` 은 바꾸면 안 된다.** 이 테스트는 파서 출력을 보지 않는다. 색인 문서 JSON 을 읽는 테스트다. 입력이 리터럴 `"attributeParserVersion":1`(`:45`)이고, `:61` 은 그 값이 복원되는지 본다. `AttractionAttributeParser.VERSION`(=2)으로 바꾸면 입력 1 과 기대 2 가 어긋나 빨강이 된다. 1라운드 심판 NOTES 의 「깨질 수 있어」는 반대다. 그대로 두면 초록이고, 바꾸면 깨진다.
- **`reindex-capture.json` 재생성이 목록에 없다.** `AttractionApiReindexTaskletTest.kt:760` 은 배치 출력을 `search/app/src/test/resources/attraction/reindex-capture.json` 에 쓴다. CI 는 `ci.yml:108-109` 에서 `git diff --exit-code` 로 이 파일이 최신인지 확인한다. 이 파일에는 `"attributeParserVersion" : 1` 이 15곳 있다(`:25`·`:61`·… `:595`). VERSION 2 에서 이 줄들이 바뀌므로, 재생성해 같은 커밋에 넣지 않으면 CI 가 실패한다. 캡처 안에 영문 주차 `N/A` 문서가 있으면 `attrParking` 값도 함께 바뀐다.
- 수정안: SR-4.2 의 「`AttractionSearchDocumentTest.kt:61` 의 버전 단언은 `AttractionAttributeParser.VERSION` 으로 바꾼다」를 지운다. 대신 다음 문장을 넣는다. 「`AttractionApiReindexTaskletTest` 를 돌려 `reindex-capture.json` 을 재생성해 같은 커밋에 넣는다(`ci.yml:108-109` 게이트). `AttractionSearchDocumentTest.kt:61` 은 저장된 값을 읽는 테스트라 1 을 유지한다.」

### R2-2 [주요] SR-6 은 구현할 수 있다. 다만 규칙 세 가지가 비어 있어 그대로 짜면 사전이 깨지거나 en 질의는 그대로 0건이다 — SR-6.3·SR-6.5
구현 가능성: 가능하다. 집계 선례는 `AttractionSearchAdapter.kt:210-238` `countFacets` 하나다. 같은 클라이언트에 `size(0)` 요청을 보내고 `aggregations()` 를 읽는다. 다만 이 선례는 filter 집계라 terms 집계 선례는 레포에 없다(`Aggregation.of` 사용처는 `:220` 뿐). 포트 확장도 부담이 없다. `AttractionSearchPort`(search:domain)를 구현하는 테스트 대역은 전부 `mockk<AttractionSearchPort>()`(SearchAttractionServiceTest:40 등 7곳)라, 메서드를 하나 더해도 컴파일이 깨지지 않는다. 실패 처리도 지금 구조(`CategoryLexiconAdapter.kt:53-61` — 실패 시 return, 기존 캐시 유지)에 그대로 얹힌다. 첫 기동도 같다. `initialDelay = 5_000`(`:50`) 시점에 OpenSearch 가 안 떠 있으면 집계가 실패한다. 그러면 「한 번도 못 받음 → 코드표 전체」가 되어 오늘 동작이고, 10분 뒤 교집합으로 바뀐다. 문제없다.

비어 있는 규칙:
1. **집계 크기.** OpenSearch terms 집계의 기본 `size` 는 10 이다. 크기를 안 정하면 `lclsSystm3` 값이 10개만 오고, 교집합 뒤 사전은 소분류 10개로 줄어든다. 오류 없이 질의 이해가 거의 꺼진다. 코드표는 언어당 617~711행이다(`QueryIntent.kt:207` 주석, `report.md:6`). 수정안: 「집계 크기는 코드표 행 수 이상으로 잡는다(코드표 응답 크기에서 얻는다 — 상수 아님). 응답의 `sum_other_doc_count > 0` 이면 잘린 것이므로 실패로 친다.」
2. **언어별 교집합.** 사전은 언어마다 따로 만들고(`CategoryLexiconAdapter.kt:80-85`), 한 사전에 두 언어 이름이 모두 들어간다. 반면 본 질의는 `lang` 으로 거른다(`AttractionSearchAdapter.kt:522-524`). 색인 전체 값 집합으로 교집합하면, 국문 문서에만 있는 코드가 en 사전에 남는다. 그러면 「temple stay」(lang=en)는 여전히 0건일 수 있고, SR-6.5 의 배포 후 확인 `lang=en&keyword=temple stay` 가 실패한다. 수정안: 「값 집합은 `lang` 별로 받는다(lang terms → lclsSystm1~3 하위 집계, 또는 언어별 요청). 사전 키 `lang` 의 교집합은 그 언어 문서의 값 집합으로 한다.」
3. **빈 집합.** 집계가 성공했는데 값이 0개일 수 있다(빈 색인, 로컬). 이때 교집합은 빈 사전이다. 그런데 지금 가드 `loaded.isEmpty()`(`:57`)는 언어 키 맵이 비었는지만 본다. 키별 빈 `Lexicon` 은 통과해 캐시에 들어간다. 수정안: 「값 집합이 비면 실패로 친다(들고 있던 사전 유지)」를 SR-6.3 실패 처리에 더하고, SR-6.5 테스트에 「빈 집합 → 사전 유지」·「한 번도 못 받음 → 코드표 전체」 두 케이스를 더한다.
- 참고(비차단): 교집합을 application 에 두면 지금 infrastructure 어댑터가 가진 캐시·`@Scheduled`(`:37,50`)도 application 으로 옮겨야 한다. 그러면 `CategoryLexiconPort`(`CategoryLexiconPort.kt:12-14`)의 뜻이 「사전」에서 「코드표 행」으로 바뀐다. 이 포트를 쓰는 곳은 `SearchAttractionService.kt:35` · `SearchUnifiedService.kt:16` 과 테스트 대역 4곳(SearchAttractionServiceTest:52, SearchUnifiedServiceTest:38, AttractionReindexCaptureTest:183, UnifiedAttractionRequests:32)이다. 스펙은 위치를 구현 단계에 넘겼는데(`spec.md:58`), 영향 범위가 이 6곳이라는 점은 적어 두는 편이 좋다.

### R2-3 [주요] 「템플스테이 0건」의 원인이 확정되지 않았다. 다른 원인이면 SR-6 으로 고쳐지지 않는다 — SR-6.1·6.2
흐름 확인(`SearchAttractionService.kt:83-118`):
- `:85` 에서 오타 교정을 먼저 하고, `:87` 의 `keyword` 로 `:89` 에서 임베딩을 만든다. `:91` 에서 `QueryIntent.analyze` 를 부른다.
- 「템플스테이」는 한 어절이라 `QueryIntent.kt:243-245` 에서 질의 전체가 사전에 걸린다. 그러면 `residual = null` 이고 facet 은 `lclsSystm3=EX040100` 이다. `TYPE_INTENTS`·`SETTING_INTENTS`(`:52-72`)에는 이 말이 없다. `COMMERCE_PREFIXES`(`:96`)는 EX 를 막지 않는다.
- `:103` 에서 keyword 가 null 로 넘어간다. 임베딩이 있으면 `AttractionSearchAdapter.kt:623-626` 의 **벡터 단독 경로**로 간다. 그 knn 필터는 `lang` + `lclsSystm3` + **`embeddingModel = modelRef`**(`:701-706`)다.

빠진 확인:
- 0건을 내는 원인 후보가 둘이다. ⓐ `lclsSystm3=EX040100` 문서가 색인에 없다(스펙이 고른 원인). ⓑ 그런 문서는 있는데 벡터가 없거나 다른 스탬프다. 벡터는 batch 의 `embeddings[attraction.id]` 가 있을 때만 실린다(`AttractionApiReindexTasklet.kt:211`, `:94-96`).
- 근거로 든 `report.md:54` 는 실험 스크립트의 knn 필터에 `embeddingModel` 을 넣고 쟀다(`exp.py:121`). 그래서 ⓐ 와 ⓑ 를 가르지 못한다. 문서 수를 따로 센 기록도 없다.
- ⓑ 라면 SR-6.3 의 집계(문서 존재 기준)는 EX040100 을 사전에 남기므로 0건이 그대로다. 또 이 경우는 템플스테이만의 문제가 아니다. 의도어만으로 된 질의 전부가 벡터 없는 문서를 잃는 구조 문제다.
- 사소한 점: 스펙은 「오타 교정이 이 말을 바꾸지 않는다」는 전제도 적지 않았다. 다만 report 는 API 의 `correctedKeyword` 로 재현했으므로(`report.md:6`) 이 전제는 맞는다고 본다.

수정안: SR-6.1 에 착수 전 측정 한 줄을 넣는다. 「`attractions` 에서 `lclsSystm3=EX040100` 을 언어별로 센다. ① 필터 없이 ② `embeddingModel=<modelRef>` 를 더해서. ①이 0 이면 SR-6 대로 진행한다. ①>0 이고 ②=0 이면 원인은 벡터 단독 경로의 스탬프 필터다. 이 경우 SR-6 을 다시 설계한다(예: 하이브리드가 켜져 있으면 값 집합을 `embeddingModel` 필터를 건 문서로 센다, 또는 벡터 단독 0건을 다른 방식으로 막는다).」 측정은 운영 OpenSearch 읽기 한 번이다.

### R2-4 [경미] 통합 검색에도 같은 사전이 걸린다
- `SearchUnifiedService.kt:29` 도 같은 사전을 쓰고, 통합 색인의 `facets.$field` 로 거른다(`UnifiedSearchAdapter.kt:33-34`).
- attractions 색인 기준으로 교집합하면 통합 검색의 관광지 필터도 함께 좁아진다. 두 색인의 원천이 같아 맞는 방향이다.
- 수정안: 스펙에 이 영향을 한 줄 적는다(SR-1.3 의 「통합 검색 코드 불변」과 헷갈리지 않게).

## 결론
- G7·G8 은 해소됐다.
- G5 는 반영 과정에서 틀린 지시 하나(`AttractionSearchDocumentTest.kt:61`)와 빠진 CI 캡처 재생성이 생겼다. 그대로 구현하면 첫 CI 에서 실패한다.
- SR-6 은 기존 구조 위에 구현할 수 있다. 다만 집계 크기·언어별 교집합·빈 집합 규칙이 없으면 사전이 조용히 깨지거나 en 확인이 실패한다.
- 원인 진단은 벡터 단독 경로의 `embeddingModel` 필터를 배제하지 못했다. 다른 원인일 가능성이 열려 있어, 착수 전 측정 한 줄이 필요하다.
- 전부 스펙 문구로 고칠 수 있어 BLOCK 은 아니다.

VERDICT: REVISE
