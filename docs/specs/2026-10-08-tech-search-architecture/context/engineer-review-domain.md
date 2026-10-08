## 2라운드 (2026-10-08)

대상: 개정 `spec.md`(1라운드 심판 keep 41 / demote 3 반영본). 심판 판정·사용자 결정 ①~④는 재론하지 않는다.
코드 대조: `AttractionSearchAdapter.kt` · `SearchUnifiedService.kt` · `UnifiedSearchAdapter.kt` · `application.yml` · `k8s/base/search/deployment.yaml` · `attractions-index.json` · `cronjob-eval.yaml` · `AttractionSearchAdapterHybridTest.kt` · `search/glossary.md`.

### 1라운드 항목 해소

| # | 판정 | 근거 |
|---|---|---|
| D-1 가중치 위치 | 해소 | `spec.md:24` 「키워드 레그(BM25 × 분류 가중치 × ln1p(완결성) × clickBoost) ∥ 벡터 레그(가중치 없음) → RRF」, 「가중치는 융합 전」 — `AttractionSearchAdapter.kt:607-611,628,693-711` 과 일치 |
| D-2 완결성 ln1p | 해소 | `spec.md:24`, §4 행 「완결성 ln1p(`popularityScore`, missing 1.0)」(`spec.md:29`) — 코드 `:761-762` `Ln1p`·`missing(1.0)` |
| D-3 주변 4종 명칭 | 해소 | `spec.md:26` 「주변 명소·근처 숙소·근처 행사·주변 편의시설」 — `search/glossary.md:81,89,90` 과 일치, 「숙박」 미사용 |
| D-4 질의/쿼리 벡터 (MINOR) | 해소 | `spec.md:29,32,53` 「쿼리 벡터」, 첫 등장 `query_vectors` 병기 규칙(`:32`). 스펙 안에 「질의」 표기 없음 |
| D-5 과제 번호 | 해소 | `spec.md:29` 행동 계측 행이 내용으로 적히고 ADR-0095 「제안 상태」 구분, `:32` 「작업 계획 과제 번호를 적지 않는다」 |
| D-6 통합 타입·필드 | 해소(문구 보정은 R2-3) | `spec.md:27` `ALL_TYPES` 7종 + 필드 8개 — `SearchUnifiedService.kt:118-121`, `UnifiedSearchAdapter.kt:78-80` 과 일치. 「+ ln1p(인기도)」도 `:64,69`(`Ln1p`, `boostMode Sum` = 더하기)와 맞다 |
| D-7 상태 열 출처 | 해소 | `spec.md:28` 「상태 열 출처는 deployment.yaml env(없으면 application.yml 기본값) — Kotlin 기본값은 운영 상태가 아니다」. 실값: 하이브리드 `deployment.yaml:36-37` `"true"`, clickBoost `application.yml:78` `${…:false}` |
| D-8 glossary (MINOR) | 해소 | `spec.md:87` post-impl Q6 `/hns:glossary` |
| D-9 표기 쌍 (MINOR, 사실 항목만) | 해소 | 동의어(`spec.md:29`)·키워드 레그(`:24`)·「양자화(sq bits 1 + 재채점 ×3)」와 「사이드카 적재 fp32」 분리(`:29`, 색인 `attractions-index.json:457` `bits: 1`)·`search-eval` KST 07:30(`:22`, `cronjob-eval.yaml:4,17` `30 22 * * *`)·「place 검색 허브(`place.1989v.com`)」(`:24`) |

### 새 발견 (코드 대조, 실질 결함만)

#### R2-1. 벡터 레그의 knn filter 에 **검색어 일치 조건까지** 들어간다 — 스펙의 「knn + 필터」·「필터는 두 레그 각각」은 이를 구조 필터로만 읽힌다 (REVISE)
- 스펙: `spec.md:24` 「벡터 레그(knn + 필터, 가중치 없음)」, §4 행 「필터는 두 레그 각각」(`:29`).
- 코드: `AttractionSearchAdapter.kt:628` `hybridQuery(keywordLeg, embedding, matched, …)` → `:714` `vectorLeg(embedding, filters = matched)` → `:704` `b.filter(filters)`. `matched` 는 `matchedQuery`(`:511-562`)이고 그 안에 `:518` `b.must { multiMatch(keyword, KEYWORD_FIELDS) }` 가 있다. filter 문맥에 들어간 bool 의 must 는 점수만 버리고 일치 조건은 남는다. 그래서 벡터 레그는 검색어 토큰이 `title·title.en·titleLocal·overview·overview.en·address·address.en`(`:75-77`) 중 하나에 한 번이라도 걸린 문서 안에서만 이웃을 찾는다.
- 코드 주석·테스트는 구조 필터만 말한다. `:686-687` 「지역 필터를 건 검색에 엉뚱한 지역이 섞인다」, `search/CLAUDE.md:85`, `AttractionSearchAdapterHybridTest.kt:134-137` 은 안쪽 bool 의 `lang`·`ldongRegnCd` 만 단언하고 must 는 보지 않는다.
- 왜 도메인 결함인가: 공개 문서가 「하이브리드 = 어휘 밖 의미 리콜」로 읽히게 쓰면 코드와 다른 말을 퍼뜨린다. SR-1.5 규칙(문서는 코드를 따른다)상 사실대로 적어야 한다.
- 수정(스펙): §2-① 벡터 레그를 「knn(필터 = 키워드 레그의 bool 그대로 — 구조 필터 + 검색어 일치, + `embeddingModel` 스탬프)」로, §4 「필터는 두 레그 각각」 행의 현재 값 설명에 「벡터 레그도 검색어가 걸린 문서 안에서만」을 적는다. 검색어 없는 경우(`:623-626`)는 `matchAll` 이라 해당 없음.
- 보고만(코드 소유자 판단, Q5 묶음에 추가): 의도된 동작인지 확인이 필요하다. 의도가 아니면 knn filter 에 must 를 뺀 구조 필터만 넘겨야 한다. 그 경우 nDCG 판정이 바뀌므로 판정 세트로 재야 하고 문서도 다시 고친다. 이 스펙의 범위(코드 변경 없음)는 넘지 않는다.

#### R2-2. 「상업 의도면 가중치를 걸지 않는다」의 범위 — 코드는 완결성 ln1p·clickBoost 까지 통째로 건너뛴다 (MINOR)
- 스펙: `spec.md:24` 「상업 의도면 가중치를 걸지 않는다」, §4 「쿼리 언더스탠딩(… 상업 의도는 랭킹 스위치)」(`:29`).
- 코드: `AttractionSearchAdapter.kt:751` `if (!ranking.enabled || commerceIntent) return matched` — 분류 가중치·ln1p(완결성)·clickBoost 를 감싸는 `function_score` 전체가 빠지고 BM25 그대로다. `ranking.enabled` 는 두 가중치가 모두 1.0 일 때 꺼진다(`application.yml:70`).
- 수정: 「상업 의도면 키워드 레그는 BM25 그대로(분류 가중치·완결성·clickBoost 모두 없음)」로 고친다.

#### R2-3. 통합 검색의 타입 의도는 순서가 아니라 **검색 대상을 그 타입 하나로 좁힌다** (REVISE)
- 스펙: `spec.md:27` 「타입 의도 → 관광지는 …, 나머지 type(`ALL_TYPES` 7종)은 `unified` BM25 … → 묶음 순서(타입 의도 > 첫 결과 제목 포함 > 고정 순서)」.
- 코드: `SearchUnifiedService.kt:32-36` 은 요청 `type` 이 있으면 그것, 없고 타입 의도가 있으면 **그 타입 하나만** 검색한다. 7종 전부를 도는 것은 둘 다 없을 때뿐이다. 그래서 묶음 순서 ①(`:109` `it.type == intentType`)은 의도가 잡힌 요청에서 묶음이 하나뿐이라 실제로 순서를 가르지 않는다. 순서를 가르는 것은 ②·③(`:110,113`)이다.
- 같은 줄의 표현 둘도 코드와 다르다.
  - 「나머지 type(`ALL_TYPES` 7종)」: 7종은 관광지를 포함한 수다(`:118-121`). 나머지는 6종이다.
  - 관광지 외 타입은 원문이 아니라 **잔여 검색어**로 찾는다(`:83` `keyword = understood.residual`). 관광지는 원문을 넘긴다(`:40,57,62`).
- 수정: 「`type` 지정 > 타입 의도 = 그 타입 하나만 / 둘 다 없으면 `ALL_TYPES` 7종 전부 → 관광지는 원문으로 §2-①, 나머지 6종은 잔여 검색어로 `unified` BM25 … → 묶음 순서(첫 결과 제목이 검색어를 담음 > 고정 순서)」. 사전 용어 「타입 의도」·「잔여 검색어」의 뜻이 이 그림에서 정해지므로 Q6 glossary 시드에 이 정의를 넣는다.

### 체크리스트 재판정

| # | 항목 | 1R | 2R |
|---|---|---|---|
| 1 | BC 경계 | 통과 | 통과 |
| 2 | 사전 존재 | 조건부 | 조건부(Q6) |
| 3 | 어휘 ↔ 사전 | REVISE | 통과. 주변 4종은 사전과 일치하고, 새 용어는 Q6 로 넘겼다 |
| 4 | Avoid 동의어 | 통과 | 통과. 「근처 관광지」·「숙박」(근처 숙소 뜻)·「질의 이해」 미사용 |
| 5 | 언어 ↔ 코드 | REVISE | **REVISE**(R2-1·R2-3, R2-2 는 MINOR) |
| 6~9 | 애그리거트·이벤트·참조·VO | 해당 없음 | 해당 없음 |

BLOCK 아님. 세 건 모두 스펙 문구만 고치면 되고 사람의 도메인 판단이 필요한 것은 R2-1 의 「의도된 동작인가」뿐이다. 그것은 이 스펙 범위 밖(보고만)이다.

---

# Engineer Review — domain (1라운드, 2026-10-08)

대상: `docs/specs/2026-10-08-tech-search-architecture/spec.md` (작업 트리 origin/main `06550592a`)
체크리스트: `hns/0.16.1/skills/spec-review/reviewers/domain/checklist.md`
사용자 결정(재론 안 함): 새 경로 `/tech/search` · 레포 문서 원본 + 빌드 렌더 · 관광지 검색 + 통합 검색

## Seed Discovery

| 단계 | 읽은 것 |
|---|---|
| 스펙 | `spec.md`, `planning/requirements.md`, `planning/test-quality.md`, `planning/initialization.md`, `context/open-questions.yml` |
| 사전·규칙 | `docs/product/glossary.md` **없음** → `docs/context-map.md:20` 이 `search/glossary.md` 를 가리킴(있음, 2026-05-11 생성 + §3-1 2026-10-02). `docs/conventions/blog-writing.md:63-77` §2.0.1 기술 용어 표기. 메모리 `transliterate-established-tech-terms` |
| 코드 | `AttractionSearchAdapter.kt`(:60-99, :340-480, :595-765), `HybridSearchPipelineInitializer.kt`, `AttractionHybridProperties.kt`, `AttractionRankingProperties.kt`, `AttractionClickBoostProperties.kt`, `NearbyAttractionsService.kt`, `SearchUnifiedService.kt`, `UnifiedSearchAdapter.kt`, `QueryIntent.kt:1-60`, `UnifiedSourceApiClient.kt`(grep), `attractions-index.json`(:1-45, :440-465), `unified-index.json`(grep) |
| 운영·문서 | `k8s/base/search/deployment.yaml`, `k8s/base/search-batch/cronjob-eval.yaml:40-55`, ADR-0090, ADR-0095:1-20, ADR-0105(grep), `search/CLAUDE.md`, `docs/conventions/latency-budget.md:50-75`, `scripts/search-eval/README.md` |
| KB(읽기 전용) | `wiki/concepts/hybrid-search-local-embedding.md`, `raw/msa-unified-search-plan-record.md`, `claude/artifact/search-judging.md` |

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | BC 경계·누수 | 통과(비고) | 도메인 모델 변경 없음. 문서가 참여자로 적는 place(SSOT)·analytics(`attraction_popularity_daily`)·gateway 는 전부 API 관계다(`search/CLAUDE.md:5,107`). 비고: SR-5.1 드리프트 테스트가 portal-fe 에서 `../search/**`·`../k8s/**` 파일을 읽는다 — 런타임 결합은 아니고 선례(`AtlasGraphExportSpec`)가 있다 |
| 2 | 사전 존재 | 통과(조건부) | 멀티 BC: `docs/context-map.md:20` → `search/glossary.md`. 다만 그 사전이 이 스펙의 어휘를 거의 안 갖고 있다(D-8) |
| 3 | 스펙 어휘 ↔ 사전 | **REVISE** | 사전에 있는 항목은 일치(`clickBoost` 글로서리:78 ↔ SR-1.5 「14일 고유 클릭·꺼짐」). 사전 §3-1 과 어긋나는 축약 하나(D-3 「숙박」). 사전에 없는 핵심 용어 다수(D-8) |
| 4 | `Avoid:` 동의어 | 통과 | 글로서리 피할 말(「태그」·「프리렌더」(관광지 서버 렌더 뜻)·「근처 관광지」·「다가오는 주말」 등) 미사용. 스펙의 「프리렌더」는 portal-fe 빌드 파일 뜻이라 글로서리:79 와 같은 뜻. 「질의 이해」(blog-writing:70) 미사용 — 스펙은 「쿼리 언더스탠딩」 ✓ (`QueryIntent.kt:4`, `SearchUnifiedService.kt:28`, `scripts/search-eval/README.md:9` 와 같다). 단 「질의 (= query)」 행(blog-writing:71)과 「질의 벡터」가 걸린다 — 글로서리 Avoid 가 아니라 BLOCK 아님(D-4) |
| 5 | 유비쿼터스 언어 ↔ 코드 | **REVISE** | 일치: 하이브리드·RRF 60(`HybridSearchPipelineInitializer.kt:59,67`), 잔여 검색어·타입 의도·상업 의도(`QueryIntent.kt:11,14,18`), 분류 가중치 3.0/0.35(`AttractionRankingProperties.kt:18,20`), 묶음·묶음 순서(`SearchUnifiedService.kt:42,98-113`), 자모(`attractions-index.json:27`, `titleJamo`), 오타 교정 규칙(`AttractionSearchAdapter.kt:361-364,370,430`), 접두×6·형태소×1·자모×0.3(`:454-456,463,469,477`), pagination_depth(`:721`), 질의 벡터 캐시 `_id`·Redis ZSET(`search/CLAUDE.md:59,66`), 엣지 캐시 1h(ADR-0105:32), 지연 예산(`latency-budget.md:64-65`), 판정 세트 150·6,530·−0.03(README:99-103, `cronjob-eval.yaml:41,53`), 색인 alias swap(`search/CLAUDE.md:128`). 불일치: D-1(순서), D-2(빠진 요소), D-6(타입 수·필드), D-9(표기 쌍) |
| 6 | Aggregate 불변식 | 해당 없음 | 애그리거트를 만들지 않는다. 유일한 불변식은 「문서 값 == 코드 값」이고 SR-5 가 든다(검증 차원 몫) |
| 7 | 도메인 이벤트 | 해당 없음 | 없음 |
| 8 | 애그리거트 간 직접 참조 | 해당 없음 | 런타임 참조 없음(#1 비고의 테스트 파일 읽기뿐) |
| 9 | VO/Entity 분류 | 해당 없음 | 생성 JSON `{html, headings, updated, sourceHash}` 는 빌드 산출물이지 도메인 객체가 아니다 |

## Findings (REVISE — 전부 구현자가 고칠 수 있다)

### D-1. SR-1.3 ① 시퀀스에서 분류 가중치·clickBoost 가 RRF **뒤**에 있다 — 코드는 키워드 레그 **안**(융합 전)이다
- 스펙: `spec.md:21` 「… → RRF(rank_constant 60) → 분류 가중치(관광 3.0 / 상업 0.35)·clickBoost(꺼짐) → 응답」.
- 코드: `AttractionSearchAdapter.kt:607-611` `keywordLeg = withCategoryWeights(matched, commerceIntent, withClickBoost = …)` 가 먼저고, `:628` `hybridQuery(keywordLeg, embedding, …)` 가 그것을 레그로 넣는다. 벡터 레그 `:693-711` 은 `knn` + 필터뿐 가중치가 없다. RRF 는 순위만 쓰므로(`HybridSearchPipelineInitializer.kt:58`) 융합 뒤에 점수를 곱하는 단계는 존재하지 않는다.
- 수정: ① 「QueryIntent → **키워드 레그(BM25 × 분류 가중치 × 완결성 × clickBoost)** ∥ **벡터 레그(knn, 가중치 없음)** → RRF → 응답」. 상업 의도면 가중치 자체를 안 건다(`:751`).
- 보고만: ADR-0090 D4(`:66-67`) 「분류 가중치는 두 레그에 같이 건다」는 코드와 다르다(ADR `:139-140` 이 벡터 레그 가중치를 D5-1 과제로 남겨 둔 상태). 문서는 SR-1.5 규칙대로 코드를 따르고, ADR 불일치는 Q5 류로 따로 올린다.

### D-2. SR-1.5 표에 완결성 가중치(`popularityScore`, ln1p)가 없다
- `AttractionSearchAdapter.kt:757-763` 이 분류 함수와 같은 `function_score` 안에서 `popularityScore` 를 `ln1p` 로 곱한다(KDoc `:728-744` — 키워드 없는 목록의 순서가 이 값이다). 글로서리:78 이 `popularityScore`(정보 충실도)와 `clickBoost` 를 다른 값으로 구분한다.
- 수정: 「분류 가중치」 행에 「× ln1p(완결성 `popularityScore`, missing 1.0)」를 넣거나 행 하나를 더한다. 근거 `:757-763`.

### D-3. SR-1.3 ③ 「4종(명소·숙박·행사·편의)」 — 글로서리 명칭과 다르고 「숙박」은 다른 범위의 말이다
- `search/glossary.md:81` 「주변 명소」(「근처 관광지」「주변 관광지」 금지), `:89` 「근처 행사」, `:90` 「근처 숙소」 — 그리고 `:90` 비고 「『숙박 유형(32·80)』과 범위가 다르다」. 코드는 `category=stay`(`NearbyAttractionsService.kt:34,45`, 캠핑장 포함)이고 `sights·stays·events·amenities`(`:33-38`). ADR-0105:11 「명소·편의시설·행사·숙소」.
- 수정: 다이어그램·표에 「주변 명소 · 근처 숙소 · 근처 행사 · 주변 편의시설」로 적는다. 「숙박」은 쓰지 않는다.

### D-4. 「질의 벡터」 — 표기 규칙과 ADR 이 갈린다. 하나로 정하고 사전에 박는다
- 스펙 `spec.md:20,23,42` 「질의 벡터」·「질의 벡터 캐시」. `docs/conventions/blog-writing.md:71` 「질의 (= query) → 쿼리」(메모리 규칙은 「문서·블로그·아티팩트」에 적용). 반면 ADR-0090 D3(`:60-62`)·`search/CLAUDE.md:55`·`latency-budget.md:64-65`·`deployment.yaml:63` 은 전부 「질의 벡터」·「질의 인코더」다. 글로서리에는 어느 쪽도 없다.
- 수정(권장): 공개 문서·메타 설명(SR-4.1)은 규칙 §2.0.1 의 취지(검색되는 말)대로 「쿼리 벡터 캐시(`query_vectors`)」로 쓰고 첫 등장에 인덱스명을 병기한다. 「질의 벡터」를 유지하려면 글로서리에 「이 BC 의 고정 표기」로 적어 규칙의 예외임을 남긴다. 어느 쪽이든 문서 안에서 한 표기만.

### D-5. SR-1.5 「행동 계측(ADR-0095, **허브 S1-12b**)」 — 공개 문서에 작업 계획 과제 번호
- `S1-12b` 는 `docs/plans/2026-10-08-place-growth-work-plan.md`·`docs/specs/2026-10-08-place-hub-instrumentation/` 의 과제 id 다(`docs/research/2026-10-07-tourism-growth/evidence/stage2/README.md:5`). 전역 규칙 「Refer to features by durable names, not spec IDs」. SR-1.7 이 이 파일을 공개 문서로 못 박는다.
- 수정: 「place 허브 최소 행동 계측(검색 제출·필터·결과 선택·찜·지도 링크, 2026-10-08)」처럼 내용으로 적고, 상태 열은 ADR-0095 가 아직 「제안」(`ADR-0095:3`)이라는 점과 실제 배선 여부를 구분해 적는다.

### D-6. 통합 검색 타입 수·필드 목록의 출처를 코드로 못 박아야 한다
- `requirements.md:16` 「unified 8 type」·ADR-0090 D6(`:177`) 8종(`region` 포함) vs 코드 7종 `QueryIntent.Types`(`QueryIntent.kt:23-31`)·`SearchUnifiedService.ALL_TYPES`(`:118-121`), 배치는 관광지 외 6종만 싣는다(`UnifiedSourceApiClient.kt:62,95,126,150,168,190` — `region` 없음). 스펙 본문은 수를 안 적어 아직 틀리지 않았지만 구현이 ADR 을 베끼면 8이 된다.
- `spec.md:22` 「`unified` BM25(title^3·tags^2·body)」는 축약이다 — 실제 `UnifiedSearchAdapter.kt:78-80` 은 `title^3, title.en^3, titleEn^3, summary, summary.en, body, body.en, tags^2`.
- 수정: SR-1.4 에 「타입 목록은 `SearchUnifiedService.ALL_TYPES`(7), 필드는 `UnifiedSearchAdapter.KEYWORD_FIELDS` 에서 읽는다」 한 줄. ADR-0090 D6 의 `region` 은 보고만.

### D-7. 「상태(켜짐/꺼짐)」 열의 출처가 모호하다 — 코드 기본값과 운영값이 다르다
- 하이브리드: Kotlin 기본 **꺼짐**(`AttractionHybridProperties.kt:14`), 운영 **켜짐**(`k8s/base/search/deployment.yaml:36-37` `SEARCH_ATTRACTION_HYBRID_ENABLED=true`). clickBoost: 기본 꺼짐(`AttractionClickBoostProperties.kt:17`), k8s 어디에도 env 없음(grep) → 꺼짐. `spec.md:23` 「값은 코드에서 읽은 그대로」만으로는 하이브리드가 「꺼짐」으로 적힐 수 있다.
- 수정: SR-1.5 에 「상태 열은 `k8s/base/search/deployment.yaml`(및 overlay) env 가 정한다. Kotlin 기본값은 운영 상태가 아니다」를 명시. (드리프트 게이트에 넣을지는 검증 차원 몫.)

### D-8. `search/glossary.md` 가 이 스펙의 어휘를 못 받친다 — 선적 뒤 `/hns:glossary` 갱신 권장
- 글로서리는 2026-05-11 자동 추출본(`:3`) + §3-1(ADR-0103/0104)뿐이다. 스펙이 쓰는 하이브리드·키워드/벡터 레그·RRF·쿼리 언더스탠딩·잔여 검색어·타입 의도·상업 의도·분류 가중치·질의/쿼리 벡터 캐시·사이드카·판정 세트·묶음·자모·오타 교정·사용자 사전·동의어 가 하나도 없다. §1(`:10`)·§10(`:181`)은 아직 「Elasticsearch」다(`search/CLAUDE.md:3` 은 OpenSearch, ADR-0055).
- 수정: 스펙 Open Questions post-impl 에 「`/hns:glossary`(search BC) — §4 표를 시드로」 한 줄. 스펙 자체의 차단 사유는 아니다.

### D-9. 표기 쌍 — 문서 안에서 하나로 고정할 것(사전 항목 후보)
- 동의어(`attractions-index.json:10` `tourism_synonyms`, README:95) vs 유사어(ADR-0090:25, ADR-0065:11,48) → 「동의어」 권장(코드 이름).
- BM25 레그(ADR-0090 D8, 스펙) vs 키워드 레그(`AttractionSearchAdapter.kt:603,607,680`, `search/CLAUDE.md:76`) → 첫 등장에 「키워드(BM25) 레그」로 병기 후 하나만.
- 「oversample rescore」(`spec.md:23`) → 코드·README 의 말은 「재채점」(`AttractionHybridProperties.kt:20`, `AttractionSearchAdapter.kt:699`, README:41 「재채점 ×3」). 「sq 인코더」는 핵심이 빠졌다 — `sq bits:1`(`attractions-index.json:455-457`) 즉 「1-bit 양자화 + 재채점 ×3(oversample)」. 「fp32」는 색인이 아니라 사이드카 적재 옵션(ADR-0090:89)이니 행을 나눈다.
- 평가 CronJob 이름은 `search-eval`(`cronjob-eval.yaml:4,17` = KST 05:30). `search-eval-daily` 는 상품 검색용 다른 잡(README:135)이라 문서에 이름을 적을 때 섞지 않는다.
- 「허브」 — 이 스펙에서는 place 검색 허브(`spec.md:21` ①)인데 레포에는 「혜택 링크 허브」(deal, `context-map.md:63`)도 있다. 첫 등장에 「place 검색 허브(`place.1989v.com`)」로 한정.

### 선택 제안(판정에 안 셈)
- SR-1.3 ① 에 분기 셋을 한 줄씩: 「넷 중 하나라도 아니면 BM25 만」(`search/CLAUDE.md:81`), 「잔여 검색어 없으면 벡터 단독」(`AttractionSearchAdapter.kt:623-626`, ADR-0090 D8), 「사이드카 장애 → BM25」(ADR-0090 D3). 그림을 복잡하게 하기 싫으면 하이브리드 행의 「현재 값」에 조건으로.
- SR-1.3 ② 에 지역 자동완성(`regions` 인덱스, 상단 3슬롯 `AttractionSearchAdapter.kt:65,68,345`) — §1 이 `regions` 를 노드로 두면서 ② 에 안 나오면 독자가 왜 있는지 모른다.

## 공개 문서 안전(SR-1.7) 점검
스펙에 내부 호스트·키·계정은 없다. 모델 ref `microsoft/harrier-oss-v1-270m@31de22b#d640` 은 공개 HF id, 지연·nDCG 수치는 레포에 이미 공개된 값(`latency-budget.md`, `scripts/search-eval/README.md`). 유일한 내부 꼬리표가 D-5 의 `S1-12b` 다.

## 보고만(스펙 결함 아님, 소유자 판단)
- ADR-0090 D4(`:66`) 「두 레그에 같이」 ≠ 코드(키워드 레그만, `:607-611`·`:693-711`).
- ADR-0090 D6(`:177`) `region` 타입 ≠ 코드 7종.
- ADR-0090 D8 제목(`:148`) 「질의 이해」 — `blog-writing.md:70` 의 피할 말. 스펙은 올바르게 「쿼리 언더스탠딩」을 쓴다.

1라운드 VERDICT: REVISE

VERDICT: REVISE
