# Engineer Review — implementation (3라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (2라운드 심판 E1~E13 반영본)
- 범위: E1(캡처 재생성)과 E7(집계 규칙·구조 재배치)이 구현 가능한지, 빠진 변경 지점이 있는지. 이미 판정된 항목은 다시 열지 않는다.

## E1 확인 — 해소

| 확인 | 근거 | 결과 |
|---|---|---|
| 캡처를 쓰는 테스트와 경로 | `AttractionApiReindexTaskletTest.kt:760` `REINDEX_CAPTURE_PATH = "search/app/src/test/resources/attraction/reindex-capture.json"`, `:785` `repoRoot().resolve(...)` | 스펙 `spec.md:35` 의 명령·경로와 같다 |
| CI 게이트 | `ci.yml:107-109` (`:search:batch:test --tests '*AttractionApiReindexTaskletTest'` → `git diff --exit-code` → `git status --porcelain`) | 스펙 인용과 같다 |
| 버전 단언 위치 | `AttractionApiReindexTaskletTest.kt:305,329` 만 리터럴 1. `AttractionAttributeParserTest.kt:141` 은 이미 `VERSION` 비교, `AttractionsIndexMappingTest.kt:32` 는 타입만 본다 | 스펙에 빠진 단언 없음 |
| 읽기 쪽 왕복 | `AttractionReindexCaptureTest.kt` 는 `attributeParserVersion`·`attrParking` 을 단언하지 않는다(grep 0건) | 캡처가 바뀌어도 search:app 쪽 테스트는 깨지지 않는다 |
| `VERSION` 형 | `AttractionAttributeParser.kt:26` `const val VERSION = 1` (Int) — `source["attributeParserVersion"]` 의 Int 와 비교 가능 | 문제없음 |

## E7 확인 — 구현 가능

| 확인 | 근거 | 결과 |
|---|---|---|
| 집계 대상 필드 | `attractions-index.json:360-368` `lclsSystm1~3` 모두 `keyword`, 쓰기 쪽 `AttractionIndexDocument.kt:41-43,208-210` 이 셋을 다 싣는다 | terms 집계 가능 |
| 코드 ↔ 필드 대응 | `QueryIntent.kt:81` `lclsField(depth) = "lclsSystm$depth"`, `:187` `Facet(lclsField(depth), code)` | 세 필드 값의 합집합으로 `code ∈ 집합[L]` 을 보면 된다 |
| 버킷 크기 여유 | 코드표 행 수(두 언어 617, `QueryIntent.kt:207` 주석)가 한 필드·한 언어의 고유 값 수보다 훨씬 크다. 3필드 × 2언어 × 617 ≈ 3.7천 버킷으로 기본 `search.max_buckets` 안이다 | 잘림 예외가 상시로 나올 위험 없음 |
| 포트 확장 영향 | `AttractionSearchPort`(search:domain `:12`)의 구현은 `AttractionSearchAdapter.kt:61` 하나, 테스트 대역은 전부 `mockk` | 메서드를 더해도 컴파일이 깨지지 않는다 |
| 재배치 대상 | `CategoryLexiconPort` 사용처는 `SearchAttractionService.kt:35`·`SearchUnifiedService.kt:16` + 대역 4곳(`SearchAttractionServiceTest.kt:52`, `SearchUnifiedServiceTest.kt:38`, `UnifiedAttractionRequests.kt:32`, `AttractionReindexCaptureTest.kt:183`) | 스펙 `spec.md:64-65` 목록과 일치, 빠진 곳 없음 |
| 스케줄링 | `SearchApplication.kt:24` `@EnableScheduling`. search:app 테스트에 `@SpringBootTest` 없음(grep 0건) | 서비스로 옮긴 `@Scheduled` 가 테스트에서 돌 일 없음 |
| 레이어 게이트 | search 에 ArchUnit·Konsist 게이트 없음(grep 0건). `application/attraction/usecase`·`service` 디렉토리 실재 | 새 파일 위치 충돌 없음 |
| 동시성 | 갱신은 스케줄러 스레드 하나, 읽기는 `AtomicReference` 스냅샷(`CategoryLexiconAdapter.kt:37,61`) | 언어별로 합친 맵을 한 번에 `set` 하면 안전 |

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 있음(위 표) |
| 2 | 기존 코드와 충돌이 없는가 | 없음. 단 I3-1 의 기존 가드 두 개가 옮길 목록에 없다 |
| 3 | 복잡도 위험 | 낮음. 재배치는 기존 어댑터를 둘로 쪼개는 일이다 |
| 4 | NFR 안티패턴 | 10분에 집계 1회, 버킷 상한은 코드표 행 수로 묶였다. 문제없음 |
| 5 | 마이그레이션·롤백 | 해소(2라운드 G7) |
| 6 | 동시성 | 문제없음 |

## 새 발견

### I3-1 [경미] 옮기면서 사라지는 기존 가드 두 개가 스펙에 없다 — SR-6.3 「실패 처리」·「바꿀 곳」
- 지금 어댑터에는 가드가 두 개 있다. 스펙은 이 둘을 어디로 옮길지 적지 않았다.
  - `search.category-lexicon.enabled`(`CategoryLexiconAdapter.kt:22`, `:52` `if (!enabled) return`): 갱신 전체를 끄는 스위치다.
  - 빈 코드표 가드(`:57-60` `if (loaded.isEmpty()) … return`): 빈 응답이면 사전을 바꾸지 않는다.
- 스펙대로 `@Scheduled` 를 `CategoryLexiconService` 로 옮기고 `enabled` 를 `CategoryCodeAdapter` 에 남기면, 스위치를 꺼도 서비스가 10분마다 OpenSearch 집계를 부른다.
- 코드표가 빈 목록으로 오면 `bucketSize = 0` 인 terms 집계를 보낸다. OpenSearch 는 크기 0 을 거부하므로 예외 경로로 간다. 결과 사전은 「들고 있던 것」이나 「코드표 전체(=빈 사전)」라서 동작은 오늘과 같다. 다만 매 주기 실패 요청과 경고 로그가 남는다.
- 수정안(SR-6.3 실패 처리 첫 문장 뒤): 「코드표가 빈 목록이면 못 받은 것으로 본다. 그때는 색인 집계를 부르지 않는다(`CategoryLexiconAdapter.kt:57-60` 가드를 서비스로 옮긴다). `search.category-lexicon.enabled=false` 면 `CategoryCodeAdapter.codes()` 가 빈 목록을 돌려 같은 경로를 탄다.」 SR-6.5 ⑦ 에 「코드표가 빈 목록 → 집계 미호출·사전 유지」를 한 줄 더한다.

### 참고(비차단) — 요청 캡처 테스트의 기존 도우미는 그대로 못 쓴다
- `AttractionSearchRequestSnapshots.kt:48-52` 는 `client.search(any, JsonData::class.java)` 를 집계 없는 빈 응답으로 받는다. 받은 요청은 `captured.count` 에 넣는다.
- 새 집계 요청을 `JsonData` 로 보내면 이 도우미에서는 건수 요청과 섞인다. 또 SR-6.5 의 「`sum_other_doc_count > 0` 이면 예외」 케이스에 필요한 terms 응답도 만들 수 없다.
- 그래서 그 테스트는 응답을 직접 만드는 별도 `mockk<OpenSearchClient>` 로 짜야 한다. 스펙의 「관례」는 요청을 JSON 으로 단언하는 방식을 가리키는 것으로 읽으면 된다. 스펙을 고칠 필요는 없고 tasks 에 적어 두면 충분하다.

## 결론
- E1 은 경로·명령·게이트·단언 위치가 코드와 모두 맞는다. 빠진 변경 지점이 없다.
- E7 은 그대로 구현할 수 있다. 버킷 크기·잘림·빈 집합·언어별 규칙이 모두 코드로 옮길 수 있게 정해져 있다. 재배치 대상 목록도 사용처 grep 과 일치한다.
- 새 결함은 I3-1 하나다. 기존 가드 두 개(`enabled`·빈 코드표)를 어디로 옮길지가 빠졌다. 스펙 한 문장으로 닫히고 동작 회귀는 없으므로 재리뷰는 필요 없다.

VERDICT: REVISE
