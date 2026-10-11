<!-- source: k8s/base/search-batch/eval/live-eval.py, k8s/base/search-batch/eval/judgments-attractions-2026-10-05.json, k8s/base/search-batch/cronjob-eval.yaml, k8s/base/search-batch/kustomization.yaml, scripts/search-eval/README.md, scripts/search-eval/grading-rubric.md, search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt, search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt, tools/embed/src/embed/queries.py, search/domain/src/main/kotlin/com/kgd/search/domain/query/model/QueryIntent.kt, portal-fe/src/pages/place/placeAttributes.ts -->
# Specification: 관광지 검색 판정 세트 — 의도 유형·사례 추가·의도별 리포트 (S3-6b)

> 2026-10-11. 계획 `docs/plans/2026-10-08-place-growth-work-plan.md:100` S3-6b, 이어받기 `docs/plans/2026-10-10-place-inflow-execution-handoff.md` H4.
> 이 스펙은 **측정**을 바꾼다. 검색 순위·쿼리 언더스탠딩은 고치지 않는다 — 새 사례가 드러낸 결함은 후속 후보로 보고만 한다.

## Goal
매일 평가(`search-eval`)가 판정 세트를 질의 의도 유형별로 나눠 nDCG@10·0건율·판정 없는 문서 비율을 내고, 정답이 「결과 없음」인 질의에서 검색이 결과를 지어내는지도 잰다. 새 질의는 운영 검색어와 원천 데이터에서만 가져온다.

## 현황 (2026-10-11 실측)

| 항목 | 값 | 근거 |
|---|---|---|
| 매일 평가가 쓰는 세트 | `judgments-attractions-2026-10-05.json` — 150 질의(ko 90 · en 60), 6,530쌍. 항목 키는 `query`·`lang`·`source`·`grades` 넷 | `cronjob-eval.yaml:38`, 파일 직접 집계 |
| 이전 세트 | `judgments-attractions-2026-09-13.json` — 48 질의, 2,141쌍(v2 에 흡수) | `scripts/search-eval/README.md` |
| 매일 평가 | CronJob `search-eval` KST 07:30, `live-eval.py` 가 A(BM25)·B(하이브리드)·C(라이브 API) nDCG@10 을 언어별 평균, C 가 기준선(ko .7767 · en .7140) − 0.03 아래면 Failed | `cronjob-eval.yaml`, `live-eval.py:main·gate` |
| 의도 표시 | 없다. `source` 가 출처와 유형을 섞는다(`2026-09-13` 48 · `분류` 20 · `의도` 15 · `지역×유형` 14 · `고유명` 12 · `category` 12 · `intent` 9 · `region` 7 · `name` 7 · `표기` 5 · `typo` 1) | 파일 집계 |
| 0건 질의 | **0/150.** 모든 질의에 등급 ≥1 문서가 있고, 라이브 API 결과가 0건인 질의도 0 | 공개 API 150회 GET(2026-10-11) |
| 판정 없는 top-10 문서 | 12/1,500 (ko `의도` 5) | 같은 측정 |
| 정답 없는 질의를 넣으면 | 지금 `ndcg()` 는 등급 >0 문서가 **하나도 없을 때만** `None` 을 내 평균에서 빠진다. 국내 대체지에 등급 1 이 하나라도 있으면 숫자가 나와 평균과 클릭 계수 짝 비교(`click_boost_pair`)에 섞인다 | `live-eval.py:84`·`:171-178` |
| 라이브 응답의 건수 키 | `data.totalElements`(`total` 아님). `correctedKeyword` 도 같은 객체에 있다. 지금 `ids_live` 는 `attractions` 만 읽는다 | `SearchAttractionUseCase.kt` `Result`, `AttractionSearchController.kt:103` `ApiResponse.success(result)`, `live-eval.py:80` |
| 운영 검색어 | `analytics.events` SEARCH 93건(PLACE_HUB 89, 10-08~; UNIFIED_SEARCH 4). 검색어가 있는 것은 `qzxqzxqzx`(시험 입력) 2건 · `궁` 2건뿐. ingress 7일 로그의 `keyword=` 도 시험 호출뿐 | ClickHouse 읽기 전용 질의, ingress 로그 |

라이브 API 탐침(2026-10-11, 판정 세트 밖): 「에펠탑」 854건 · 「ㅁㄴㅇㄹ」 691건 · 「디즈니랜드」 367건 — 정답이 없는 질의에 결과를 낸다. 「qwxzv」(en) 0건. 「아이랑 갈 만한 곳」 상위가 아이아이 연남 · 아이뜰 관광 농원 · 아이와즈 — v2 의 「아이와 갈만한 곳」과 띄어쓰기·조사만 다른데 불용구(`STOP_PHRASES` 의 「갈만한」)가 안 걸린다. 「주차 되는 해수욕장」 375건 — 조건어는 쿼리 언더스탠딩이 필터로 옮기지 않는다(허브의 속성 칩·`parking=` 파라미터만 조건을 건다).

원천 속성 분포(운영 색인 `attractions`, 2026-10-11): ko 52,140 — 주차 YES 34,041 · NO 5,330 · UNKNOWN 12,769 / 입장 FREE 9,421 · PAID 3,575 · UNKNOWN 39,144 / 유모차 YES 81 / 반려동물 값 있음 9,663(전구역 9,129 · 일부 534). en 15,300 — 주차 YES 11,344 / 입장 FREE 346 / **반려동물·유모차 값 0건**. 제목에 괄호 별칭이 있는 문서 ko 360 · en 666.

## User Stories
- 검색 품질을 보는 사람으로서, 「조건형 질의만 nDCG 가 낮다」「오타 질의만 0건이 난다」처럼 어느 의도가 약한지 매일 보고 싶다.
- 같은 사람으로서, 정답이 없는 질의에 검색이 관련 없는 결과를 내놓는 빈도를 숫자로 보고 싶다.

## Specific Requirements

### SR-1 의도 유형 (`intent`)
판정 세트의 모든 질의는 아래 여덟 값 중 하나를 갖는다. 판정은 질의 문자열만 보고 내린다(검색 결과를 보고 고르지 않는다). 둘 이상에 걸리면 **표의 위쪽이 이긴다** — 「경복굼」은 NAME 이 아니라 TYPO, 「무료 박물관 서울」은 REGION_TYPE 이 아니라 CONDITION.

| 값 | 뜻 | 예(기존 세트) |
|---|---|---|
| `NO_ANSWER` | 색인에 정답이 없음을 원천 집계로 확인한 질의 | (없음) |
| `TYPO` | 근거 있는 질의에 편집 하나를 가해 색인 제목과 맞지 않게 된 것 | 경복굼 · 불국싸 · 해수욕쟝 · gyeongbokgoong |
| `ALIAS` | 같은 대상을 다른 이름으로 — 괄호 별칭·옛 이름·약칭·로마자 표기 변형·동의어 규칙의 다른 쪽 | (없음) |
| `CONDITION` | 원천 속성 필드로 참/거짓이 정해지는 조건(주차·입장 무료·반려동물·유모차·신용카드·무장애)을 담은 것 | 무료로 볼 수 있는 곳 · 반려견과 함께 갈 수 있는 곳 · pet friendly · free admission |
| `NATURAL` | 원천 필드에 없는 뜻(동반자·분위기·상황·계절)을 문장으로 말한 것 | 아이와 갈만한 곳 · 비 오는 날 갈만한 곳 · 데이트 코스 |
| `NAME` | 특정 장소 하나를 가리키는 고유명 | 불국사 · haeundae |
| `REGION_TYPE` | 지역 + 분류 | 부산 해수욕장 · palace in seoul |
| `CATEGORY` | 분류 이름 단독 | 폭포 · 캠핑장 · museum |

- 기존 150 질의는 이 규칙으로 다시 라벨링한다(TG1). `source` 는 출처로만 남기고 바꾸지 않는다.
- 「표기」로 묶인 「캠핑」·「글램핑」은 오타가 아니라 분류 이름 변형이므로 CATEGORY 다.

### SR-2 질의 출처 — 지어내지 않는다
새 질의마다 `evidence` 문자열 하나를 둔다. 아래 형식이 아니면 넣지 않는다.

| 출처 | `evidence` 형식 | 쓰는 유형 |
|---|---|---|
| 운영 검색어 | `events:<최초 관측일>` — `analytics.events` `action='SEARCH'` 의 `payload.term`(PLACE_HUB)·`entity_id`(UNIFIED_SEARCH). `*`·시험 입력(`qzx…`·`probe…`)·한 방문자만 낸 것은 뺀다. 방문자 id 는 파일에 남기지 않는다. 검색어 본문에 숫자 6자리 이상 연속 · `@` · URL(`http`·`www.`·`://`)이 있으면 뺀다 — 판정 파일은 `kustomization.yaml` configMapGenerator 로 ConfigMap 에 그대로 실린다 | 전부 |
| 분류 코드표 | `codes:<코드>` — place 분류 코드표 이름(사전에 실린 것) | CATEGORY · REGION_TYPE |
| 속성 집계 | `attr:<필드>=<값>:<건수>` — 그 언어 색인에서 해당 속성 값 문서가 1건 이상. 문구는 허브 칩 이름(`placeAttributes.ts` `ATTRIBUTE_CHIPS`) + 분류 이름 | CONDITION |
| 의도 사전 | `seed:intents.yml` — `docs/specs/2026-09-05-unified-search/intents.yml` 1층 문구 | NATURAL |
| 변형 | `variant:<기존 질의>:<종류>` — 기존 NATURAL 질의의 조사·띄어쓰기·어미 바꿈(「아이와 갈만한 곳」→「아이랑 갈 만한 곳」) | NATURAL |
| 제목 별칭 | `title:<문서 id>` — 색인 제목의 괄호 안 이름 또는 괄호 밖 이름(「Tower of Great Light (Hanbit Tower)」→「hanbit tower」) | ALIAS |
| 동의어 규칙 | `synonym:<규칙 앞 단어>` — `attractions-index.json` `tourism_synonyms` 10줄 | ALIAS |
| 로마자 변환 | `romanize:<문서 id>:mr` — 색인 영문 제목(개정 로마자)을 매큔-라이샤워식으로 옮긴 것 | ALIAS |
| 편집 | `edit:<기존 질의>:<종류>` — 종류는 `받침`·`된소리`·`ㅐㅔ`·`띄어쓰기`·`철자누락`·`철자전치` 중 하나, 편집 1회 | TYPO |
| 원천 0 집계 | `zero:<집계식>` — 아래 SR-3 확인을 통과한 것 | NO_ANSWER |

- 운영 검색어가 지금은 사실상 없다(현황 표). 그래서 이번 추가분은 원천 근거로 채우고, 운영 검색어는 세트를 갱신할 때마다 다시 읽어 위 규칙을 통과한 것을 더한다(SR-6).
- 편집으로 만든 오타가 다른 문서 제목과 정확히 일치하면(「경복굼」이 실제 상호라면) 오타가 아니므로 버린다 — 색인 `title.keyword`·`title.en` 정확 일치 0건 확인.

### SR-3 정답이 없는 질의 (`NO_ANSWER`) — 해석한 척하지 않는다
**규칙**: 검색이 지원하지 않거나 색인에 없는 대상을 묻는 질의의 올바른 응답은 0건이다. 글자가 겹치는 다른 문서(「에펠탑」→「충렬탑」)를 내는 것은 질의를 해석한 척한 것으로 센다.
1. 출처는 세 가지뿐이다. ⓐ **국외 지명**: place 세계 지명 계층(GeoNames `cities15000`)의 국외 도시 이름 + 분류 이름(「도쿄 수족관」). ⓑ **원천에 없는 지역×분류 조합**: 분류 코드 × 시도 집계가 0 인 조합(「제주 스키장」 꼴). ⓒ **무의미 입력**: 자모만 · 라틴 무작위 문자열(규칙으로 만든 것, `evidence: zero:nonsense`).
2. 확인(넣기 전, 셋 다): ① 색인 집계 — ⓐ 제목·주소에 그 도시 이름 일치 0, ⓑ `lclsSystm*=<코드> ∧ sidoCode=<시도>` 0, ⓒ 제목 일치 0. 집계식과 실행 시각을 `evidence` 에 적는다. ② 풀(SR-4) 문서 전부를 채점해 등급 ≥2 가 하나도 없다. 하나라도 있으면 그 질의는 정답이 있는 것이므로 NO_ANSWER 에서 빼고 알맞은 유형으로 옮긴다. ③ 사람 확인 — NO_ANSWER 질의는 전부 사람이 풀을 훑는다(건수가 적다).
3. 파일 표현: `"intent": "NO_ANSWER"`, `"grades"` 는 풀의 등급(전부 0 또는 1).
4. 지표: **빈 정답 통과율** = NO_ANSWER 질의 중 라이브 응답 `totalElements == 0` 인 비율. nDCG 는 내지 않는다 — **`intent == "NO_ANSWER"` 로 집계에서 뺀다.** `ndcg()` 의 `None` 에 맡기지 않는다: 국내 대체지가 등급 1 을 받으면(SR-4.2) `ndcg()` 가 숫자를 내기 때문이다(`live-eval.py:84`). 지금 값은 낮을 것이 예상되고(탐침 3/4 이 수백 건), 이 스펙은 그것을 고치지 않는다 — 처음 몇 주는 게이트가 아니라 보고값이다(SR-5.4).

### SR-4 정답(관련성 판정) 만드는 법
1. **풀링**: v2 와 같다 — 같은 날 운영 색인에서 A·B·C 세 구성의 top-20 합집합. 풀링 날짜와 색인 이름(`_alias/attractions` 가 가리키는 것)을 README 에 적는다. 기존 150 질의는 다시 풀링하지 않는다(v2 등급 유지).
   - **유형별 보강** — A·B·C 는 모두 조건을 필터로 쓰지 않고 별칭·오타를 따로 다루지 않으므로, 세 구성의 풀만으로는 새 유형이 지금 시스템에만 공정해진다(SR-6.3 과 같은 함정).
     - CONDITION: BM25 + 해당 속성 필터(`parking=YES` 꼴, 허브 칩과 같은 필드) top-20 레그 하나를 더한다.
     - ALIAS: `evidence` 의 문서 id(`title:`·`romanize:`)를 풀에 강제로 넣는다.
     - TYPO: 원 질의(`edit:<기존 질의>`)의 v2 등급을 풀에 합친다(같은 뜻이므로 등급 그대로, 새 문서만 채점).
   - 보강 뒤 TG3 측정에서 판정 없는 top-10 비율이 그 유형에서 10%를 넘으면 그 유형만 다시 풀링한다.
2. **채점기**: v2 와 같은 Claude Sonnet, 서브 에이전트로 유형별 묶음(한 묶음 질의 10개 안팎)을 나눠 돌린다. 기준은 `scripts/search-eval/grading-rubric.md` 에 아래 두 절을 더한 것. 채점기는 다른 채점 결과·검색 순위를 보지 않는다(블라인드, 풀은 id 순으로 섞어 준다).
   - **조건은 데이터로 판정한다(CONDITION)**: 문서 카드에 해당 속성 값을 함께 준다. 「상식으로 분명한 것은 인정한다」는 분류·지역에만 적용하고 조건에는 쓰지 않는다 — 주차·요금·반려동물은 시설마다 다르고 바뀐다.
     - **조건 + 유형/지역 질의**(「주차 가능 해수욕장」): 조건이 YES/FREE/동반가능이고 나머지가 맞으면 3, 값이 UNKNOWN·없음이면 최대 2, NO/PAID/불가면 최대 1.
     - **조건만 있는 질의**(「무료로 볼 수 있는 곳」「pet friendly」): YES/FREE/동반가능 3 · UNKNOWN 이지만 개요에 조건 근거가 있으면 2 · 근거 없음(UNKNOWN·값 없음) 1 · NO/PAID/불가 0. 「값이 없으면 최고 2」로 두면 영문 반려동물처럼 원천 값이 0건인 질의는 풀이 전부 2 가 되고, 이상적 순서도 풀 등급에서 만들므로(`live-eval.py:88`) 순서와 관계없이 nDCG 1.0 이 나온다 — 조건만 있는 질의는 개요 근거 유무로 2/1 을 가른다.
   - **정답 없는 질의(NO_ANSWER)**: 글자만 겹치는 문서는 0, 같은 분류의 다른 지역·국내 대체지는 1. 2 이상을 주면 사유를 한 줄 적는다(SR-3.2 ② 판정용). 등급 1 이 있어도 이 질의는 nDCG 에 들어가지 않는다(SR-3.4).
3. **사람 대조**: 새 유형마다(CONDITION·NATURAL·ALIAS·TYPO) 상위 10위 안 쌍 20건을 채점기 등급별로 고르게 뽑아 사람이 블라인드로 매긴다(총 80건 + NO_ANSWER 전부). **관련 = 등급 ≥2, 비관련 = 0·1** 로 가른다(v2 README 는 일치율만 적고 경계를 적지 않았다 — 이번에 명시하고 README 에도 적는다). 관련/비관련 일치가 80% 미만인 유형은 그 유형 등급을 `by: llm` 그대로 쓰지 않고 기준을 고쳐 다시 채점한다. v2 기준선은 88%(±6%).
4. **기존 조건형 4 질의 재채점**: 「반려견과 함께 갈 수 있는 곳」·「무료로 볼 수 있는 곳」·「pet friendly」·「free admission」은 v2 에서 상식 판정으로 매겨졌다(「pet friendly」 등급 ≥1 26건 — 영문 원천에 반려동물 값이 없다). SR-4.2 조건 규칙(넷 다 조건만 있는 질의다)으로 다시 매기고, 바뀐 쌍 수와 네 질의 각각의 C nDCG 전/후를 README 에 적는다.
5. 등급마다 `by` 를 남기지 않는 v2 형식을 유지하되, 질의 단위로 `graded_by`(`v2` · `sonnet-<모델 id>-<날짜>` · `human-<날짜>`)를 둔다 — 「이 nDCG 는 무엇 기준인가」에 답하려고. 모델 id 를 넣는 이유: 같은 계열도 판마다 눈금이 다르다(README v2 절: Haiku 는 평균 +0.28 후했다). v2 의 모델 id 는 README 에 없다(「Claude Sonnet」만) — 이번 채점 모델이 v2 와 같다고 확인할 수 없으면 다른 것으로 보고 v2 질의 10개(유형별 고르게)를 다시 채점해 v2 등급과의 평균 차를 README 에 적는다.

### SR-5 의도별 리포트 (`live-eval.py`)
1. 파일 형식 v3: 항목 키 `query`·`lang`·`source`·`grades`(그대로) + `intent`·`evidence`(새 질의 필수, 기존은 `"v2"`)·`graded_by`. 기존 키는 지우지 않는다. `click_boost_pair` 는 **NO_ANSWER 항목만 건너뛴다** — 그대로 두면 등급 1 이 있는 NO_ANSWER 질의에서 `ndcg()` 가 숫자를 내 짝 비교(`deltas`)에 섞인다(`live-eval.py:171-178`).
2. `ids_live` 가 응답 `data.totalElements`(`SearchAttractionUseCase.Result.totalElements`, 컨트롤러가 `ApiResponse.success(result)` 로 그대로 싸서 낸다)와 `data.correctedKeyword` 도 돌려준다. `totalElements` 키가 없으면 그 질의는 실패로 센다(0 으로 두면 0건율이 조용히 100% 가 된다). 행마다 `total_C`·`unjudged_C`(top-10 중 `grades` 에 없는 수)·`correctedKeyword` 를 남긴다.
3. 출력 표(언어별, 기존 A/B/C 표 아래): 의도 · 질의 수 · A/B/C nDCG@10 평균(NO_ANSWER 제외) · **0건율**(NO_ANSWER 를 뺀 질의 중 `total_C == 0` 비율) · 판정 없는 top-10 비율 · NO_ANSWER 행은 빈 정답 통과율과 (선택) top-10 중 등급 0 비율 — 통과율은 탐침상 0 근처에 붙어 있을 것이라(「에펠탑」 854건) 움직임은 이 칸이 보인다.
   - 판정 없는 비율의 분모는 그 유형 질의들이 돌려받은 문서 수의 합이다(질의 수 × 10 아님 — 10건 미만 응답이 있다). 분모가 0 이면 `-` 로 찍는다.
   - NATURAL 행은 `seed:` 와 그 밖(`variant:`·`v2`)으로 나눠 찍는다 — `intents.yml` 1층 문구는 `tools/embed/src/embed/queries.py` `seed` 가 질의 벡터 사전에 미리 넣으므로 벡터 레그가 맞히게 되어 있고, 처음 보는 문장은 BM25 로만 답한다.
   - 「v2 150 질의만」 C 평균 한 줄 — 기준선 이동을 추적하려고. **선택 키는 `evidence == "v2"`** 다(`graded_by` 로 고르면 SR-4.4 재채점 4 질의가 빠져 146 이 된다). 그 아래 「v2 146(재채점 제외)」 한 줄을 더해 재채점 효과와 검색 변화를 가른다.
4. 게이트: 기존 규칙(언어별 C 평균 < 기준선 − 0.03 → 실패, 질의 실패 → 실패)을 쓴다. C 평균은 NO_ANSWER 를 뺀 질의로 내고, **질의 실패는 NO_ANSWER 를 포함한 전체로 센다**(NO_ANSWER 호출이 죽어도 빈 정답 통과율이 조용히 틀린다). 세트가 바뀌면 점수 눈금이 바뀌므로 v3 첫 실행 값으로 `EVAL_BASELINE_KO/EN` 을 같은 커밋 묶음에서 갱신한다(옛 기준선을 두면 게이트가 사실상 열리거나 닫힌다). 의도별 값·0건율·빈 정답 통과율은 처음엔 **보고만** 한다 — 유형당 질의가 10~20개라 하루 흔들림이 크다.
5. 형식 검사(종료 코드 1, 실행 시작, 네트워크 없이): `intent` 가 없거나 여덟 값 밖인 항목, NO_ANSWER 가 아닌데 등급 >0 문서가 없는 항목. 지금 `ndcg()` 가 그런 질의를 `None` 으로 조용히 빼므로, 라벨 누락이 평균에서 사라지지 않게 막는다. 그리고 SR-2 출처 규칙을 사람·에이전트 확인이 아니라 이 검사로 판정한다(스크립트로 참/거짓이 나오는 규칙은 게이트로 둔다):
   - ① `evidence` 가 `v2` 이거나 SR-2 접두어(`events:`·`codes:`·`attr:`·`seed:`·`variant:`·`title:`·`synonym:`·`romanize:`·`edit:`·`zero:`) 정규식에 맞는다.
   - ② 접두어 ↔ `intent` 짝이 SR-2 표의 「쓰는 유형」 안이다(`events:` 는 전부 허용).
   - ③ `edit:<기존 질의>`·`variant:<기존 질의>` 의 원 질의가 같은 파일·같은 언어에 있고, `edit:` 는 원 질의와 편집 거리 1(한글은 자모 단위)이다.
   - ④ `graded_by` 가 `v2` · `sonnet-<모델 id>-<YYYY-MM-DD>` · `human-<YYYY-MM-DD>` 중 하나다.
   - ⑤ `events:` 의 값이 날짜뿐이다(id 모양 — 긴 숫자·hex·UUID 가 없다).
   - ⑥ 모든 `query` 에 SR-2 개인정보 정규식(숫자 6자리 이상 · `@` · URL)이 걸리지 않는다.

### SR-6 세트 갱신 절차
1. 새 세트는 새 날짜 파일(`judgments-attractions-<날짜>.json`)로 만들고 옛 파일은 남긴다. `kustomization.yaml` configMapGenerator 와 CronJob 명령의 파일 이름을 함께 바꾼다. **질의는 그대로이고 등급만 바뀌어도**(사람 대조 결과 반영·재채점) 새 날짜 파일로 만들고 `EVAL_BASELINE_KO/EN` 갱신과 한 커밋에 넣는다 — 같은 파일 이름으로 등급만 바꾸면 기준선이 무엇으로 잰 값인지 잃는다.
2. 갱신할 때마다 운영 검색어(SR-2 첫 행)를 다시 읽는다. 두 명 이상의 방문자가 낸 검색어 중 세트에 없는 것을 SR-1 로 라벨링해 더한다. 운영 0건 검색어(`payload.total = 0`)는 우선 넣는다 — 그 검색어가 NO_ANSWER 인지(SR-3 확인) 정답이 있는데 놓친 것인지가 곧 분해 지표다.
3. 「판정 세트는 그것을 만든 시스템에만 공정하다」: 순위 구성을 바꾸는 변경(새 레그·리랭커·모델) 비교 전에는 그 구성의 top-20 을 풀에 합치고 판정 없는 문서를 채점한 뒤 잰다(README 함정 절 그대로).

### SR-7 추가 규모 (이번 갱신)
| 유형 | ko | en | 근거 출처 |
|---|---|---|---|
| CONDITION | 12 | 4 | 속성 집계 × 분류 이름. en 은 주차·입장 무료만(반려동물·유모차 원천 0) |
| NATURAL | 10 | 6 | 의도 사전 미수록분 + 기존 질의 변형 |
| ALIAS | 10 | 8 | 제목 별칭 · 동의어 규칙 · 로마자 변환 |
| TYPO | 8 | 6 | 기존 NAME·CATEGORY 질의에 편집 1회 |
| NO_ANSWER | 8 | 6 | ⓐ·ⓑ·ⓒ 고르게 |
| 운영 검색어 | 그때 수 | 그때 수 | SR-6.2 |

합 약 78 질의, 쌍 약 3,000(v2 평균 풀 크기 43 기준) — CONDITION 보강 레그(SR-4.1)로 CONDITION 쌍은 이보다 늘어난다. 결과 세트는 약 228 질의.

### SR-8 문서
- `scripts/search-eval/README.md`: 파일 표에 v3 행, 「판정 세트 v3」 절(질의·쌍 수, 유형별 수, 풀링 날짜·색인, 등급 출처, 사람 대조 일치율, 재채점 4 질의 변화, 첫 측정 의도별 표, 새 기준선), 함정 절에 「NO_ANSWER 는 `intent` 로 nDCG 평균·클릭 계수 짝 비교에서 뺀다 — `ndcg()` 의 `None` 에 맡기면 등급 1 이 있는 질의가 섞인다. 빈 정답 통과율로 본다」와 「`seed:` NATURAL 문구는 질의 벡터 사전에 미리 들어 있어 점수가 후하다 — NATURAL 은 `seed:` 와 나머지를 따로 본다」. v3 절에 관련/비관련 경계(등급 ≥2), 재채점 4 질의의 C 전/후, (해당하면) v2 10질의 재채점 평균 차, 첫 클러스터 실행 소요 시간과 `activeDeadlineSeconds: 900` 대비 여유.
- `scripts/search-eval/grading-rubric.md`: SR-4.2 두 절.
- `search/glossary.md`: 「질의 의도 유형」·「빈 정답 질의(NO_ANSWER)」·「0건율」·「빈 정답 통과율」 행. 피할 말: 「0건율」을 운영 지표와 섞지 않는다(이 값은 판정 세트 기준).
- 계획서 S3-6b 행 상태.

## Existing Code to Leverage
- 평가: `k8s/base/search-batch/eval/live-eval.py`(`ndcg`·`ids_live`·`main`·`gate`), `cronjob-eval.yaml`(env 기준선), `kustomization.yaml:16-20`.
- 기준: `scripts/search-eval/grading-rubric.md`. 풀링·채점 선례: README 「판정 세트 v2」 절.
- 근거: `docs/specs/2026-09-05-unified-search/intents.yml`, `search/batch/src/main/resources/opensearch/attractions-index.json`(`tourism_synonyms`·속성 필드), `portal-fe/src/pages/place/placeAttributes.ts:52-64`, `QueryIntent.kt`(`STOP_PHRASES`·`SETTING_INTENTS`).
- 원장: `analytics.events`(SEARCH payload `term`·`total`·`correctedKeyword`, `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` SR-2).

## Out of Scope
- 검색 동작 변경: 조건어를 속성 필터로 옮기는 쿼리 언더스탠딩, 정답 없는 질의에 0건을 내는 임계값, 「갈 만한」 띄어쓴 불용구. 새 사례가 드러내면 후속 후보로 보고만 한다.
- 운영 트래픽의 의도별 0건율(검색어 분류기 필요, 트래픽 부족 — Q3).
- 결과의 ClickHouse 적재(`search_eval_results` 는 상품 평가 잡 표다 — Q4). 상품 검색 판정(`analytics.search_judgments`).
- 통합 검색 화면의 비관광지 타입(블로그·게임·개념) 판정.
