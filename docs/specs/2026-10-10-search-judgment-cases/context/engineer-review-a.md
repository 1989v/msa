# Engineer Review A — 관광지 검색 판정 세트 v3 (S3-6b)

관점 여섯(architecture · implementation · security · test-strategy · domain · usecase)을 한 번에 본다.
체크리스트: 지정 경로 `hns/0.16.1/...` 는 캐시에 없어 같은 내용의 `hns/0.15.1/skills/spec-review/reviewers/*/checklist.md` 를 썼다.
Seed: `spec.md` · `tasks.md` · `context/open-questions.yml` → `live-eval.py` · `cronjob-eval.yaml` · `kustomization.yaml` · `scripts/search-eval/README.md` · `grading-rubric.md` → `SearchAttractionUseCase.kt` · `QueryIntent.kt` · `placeAttributes.ts` · `intents.yml` · `tools/embed/src/embed/queries.py` · 판정 파일 v2.

## 요약

| 관점 | 판정 | 핵심 |
|---|---|---|
| architecture | SHIP | 측정만 바꾸고 레이어·모듈 경계는 건드리지 않는다. ConfigMap 교체 방식은 지금 관행 그대로다 |
| implementation | REVISE | F1 응답 필드 이름이 틀렸다(`total` 이 아니라 `totalElements`). F2 NO_ANSWER 를 nDCG 에서 빼는 근거가 틀렸고, `--click-boost-pair` 에는 그대로 섞인다 |
| security | SHIP (MINOR 1) | 운영 검색어를 공개 레포에 옮기기 전 개인정보 걸러내기(F11) |
| test-strategy | REVISE | F4 새 유형의 풀이 지금 시스템에만 공정하다. F5 evidence 규칙이 게이트가 아니라 사람 확인에 머문다. F6 회귀 주입 목록이 비었다 |
| domain | REVISE | F3 조건만 있는 질의에서 「UNKNOWN 최대 2」가 등급을 평평하게 만든다. `pet friendly` 가 재채점 뒤 오히려 만점에 가까워진다 |
| usecase | SHIP (MINOR 1) | 빈 정답 통과율이 구조상 0 근처에 붙어 신호가 약할 수 있다(F12) |

**전체: REVISE** — BLOCK 은 없다. 아래 F1~F6 을 고치면 착수할 수 있다.

### 사용자가 짚은 여섯 가지에 대한 답

1. **기존 150 질의 재라벨이 기준선·게이트를 깨나** — 라벨 자체는 깨지 않는다. `ndcg()` 는 `grades` 만 읽고(`live-eval.py:83-90`), v2 에 NO_ANSWER 가 없으므로 `intent` 를 달아도 제외되는 질의가 0개다. 값을 움직이는 것은 SR-4.4 재채점 4 질의 하나뿐이다. 다만 F3 를 고치지 않으면 en 쪽이 **올라가는** 방향으로 움직인다.
2. **NO_ANSWER 를 nDCG 평균에서 빼는 계산** — 의도는 맞고 근거는 틀렸다(F2). SR-3.3·SR-4.2 가 등급 1 을 허용하므로 `ndcg()` 는 `None` 이 아닌 숫자를 낸다. 평균에서 빼는 일은 `None` 에 맡기지 말고 `intent` 로 걸러야 한다.
3. **조건형 재채점 규칙과 「정보 없음 ≠ 불가」** — 조건과 유형이 함께 있는 질의(「주차 가능 해수욕장」)에서는 맞다(UNKNOWN 2 > NO 1). 조건만 있는 질의에서는 등급이 평평해져서 지표가 망가진다(F3).
4. **채점 편향(같은 Sonnet)** — 평가 대상인 검색이 Sonnet 을 쓰지 않으니 자기 선호 편향은 작다. 남는 위험은 두 가지다. 하나는 사람 대조 전 등급으로 기준선을 잡는다는 점이고, 다른 하나는 「같은 Sonnet」의 모델 버전이 기록되지 않는다는 점이다(F7·F8).
5. **형식 검사 게이트의 회귀 주입** — `intent` 삭제는 들어 있다. 「NO_ANSWER 아닌데 등급 >0 없음」과 evidence 위반은 주입 목록에 없다. 주입 ②는 F2 때문에 아무 변화 없이 끝날 수 있다(F6).
6. **evidence 가 지어낸 질의를 막나** — 형식은 정해졌지만 검사하는 것이 사람뿐이다(`tasks.md:28`). 접두어 형식·유형 짝·`edit:`/`variant:` 원 질의 존재·편집 거리 1 은 스크립트로 판정할 수 있으므로 게이트로 올린다(F5).

---

## Findings

### F1 [REVISE · implementation] 응답 필드는 `data.total` 이 아니라 `data.totalElements` 다
- 스펙: `spec.md:87` 「`ids_live` 가 응답 `data.total` 도 돌려준다」, `tasks.md:42`.
- 코드: `search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt:203-208` — `Result(searchId, attractions, totalElements, totalPages, …)`. 컨트롤러는 이 값을 `ApiResponse.success(result)` 로 그대로 낸다(`AttractionSearchController.kt:75,103`). `total` 은 통합 검색 쪽 이름이다(`SearchUnifiedService.kt:66`).
- 영향: `d["data"].get("total")` 처럼 짜면 늘 `None` 이 나온다. `or 0` 으로 받으면 0건율 100%, 빈 정답 통과율 100% 가 된다. 「정답 없는 질의를 잘 막는다」로 읽히는 값이 오류 없이 나온다.
- 수정: SR-5.2 를 `data.totalElements` 로 고친다. 키가 없으면 0 으로 두지 말고 그 질의를 실패로 센다. 오타 질의(TYPO)에서 교정이 일어났는지 보이도록 `correctedKeyword`(`SearchAttractionUseCase.kt:210`)도 행에 남긴다.

### F2 [REVISE · implementation] NO_ANSWER 는 `None` 으로 빠지지 않는다 — `intent` 로 걸러야 하고, 클릭 계수 짝 비교에는 그대로 섞인다
- 스펙: `spec.md:73` 「grades 는 풀의 등급(전부 0 또는 1)」, `spec.md:80` 「국내 대체지는 1」, `spec.md:74` 「nDCG 는 내지 않는다(이상적 순서가 비어 정의되지 않는다)」, `spec.md:110` 함정 문구 「NO_ANSWER 는 nDCG 에서 빠진다」.
- 코드: `live-eval.py:84` `if not any(g > 0 …): return None` — 등급 1 이 하나라도 있으면 숫자가 나온다. 「도쿄 수족관」 풀에 국내 수족관이 1 로 있으면 이상적 순서가 비지 않는다. 이때 검색이 정답대로 0건을 내면 nDCG 0 이 되어 **맞게 동작한 것이 벌점**을 받는다.
- `--click-boost-pair`: `live-eval.py:171-178` 는 `ndcg` 가 숫자를 내면 `deltas` 에 넣는다. SR-5.1(`spec.md:86`)은 이 경로를 「손대지 않고 돈다」고 하므로 NO_ANSWER 쌍이 켬/켜지 않음 판정(`click_boost_verdict`)에 들어간다. 판정 없는 문서 비율의 분모에도 들어간다.
- 수정: (1) SR-3.4 근거를 「등급 1 이 있어도 nDCG 를 내지 않는다 — 0건이 정답이라 nDCG 가 맞는 동작을 벌한다」로 바꾸고, 제외 조건을 `intent == "NO_ANSWER"` 로 명시한다. (2) `click_boost_pair` 에서도 NO_ANSWER 를 건너뛴다. 한 줄 수정이고, SR-5.1 의 「손대지 않는다」를 「NO_ANSWER 만 건너뛴다」로 고친다. (3) 함정 문구를 「`None` 이 아니라 intent 로 뺀다」로 바꾼다.

### F3 [REVISE · domain] 조건만 있는 질의에서 「UNKNOWN 최대 2」가 등급을 평평하게 만든다 — `pet friendly` 가 재채점 뒤 만점에 가까워진다
- 스펙: `spec.md:79` 「값이 UNKNOWN·없음이면 최대 2 … 그 언어 원천에 값이 아예 없으면 그 질의의 최고 등급은 2」. `open-questions.yml:12` Q2 는 「지금 등급이 해석한 척을 정답으로 삼고 있다」를 재채점 이유로 든다.
- 근거: 「pet friendly」·「무료로 볼 수 있는 곳」·「free admission」에는 조건 말고 다른 제약이 없다. 그래서 「나머지가 맞으면」이 늘 참이 된다. 원천 분포(`spec.md:25`)상 입장 UNKNOWN 이 ko 39,144/52,140(75%)이고 en 반려동물 값은 0건이므로, 풀 대부분이 2 로 묶인다. `ndcg()` 의 이상적 순서는 풀 등급을 정렬한 것이라(`live-eval.py:88`), 풀이 전부 2 이면 판정된 문서를 어떤 순서로 내도 1.0 이다. 재채점이 Q2 의 의도와 반대로 en C 를 **올린다**.
- 「정보 없음 ≠ 불가」와 맞추는 수정안: 조건과 유형이 함께 있는 질의는 스펙 그대로 둔다(YES 3 · UNKNOWN 2 · NO 1). **조건만 있는 질의**는 YES/FREE 3, UNKNOWN 이고 개요에 근거가 있으면 2, 근거가 없으면 1, NO/PAID 0 으로 둔다. 어느 쪽이든 UNKNOWN 이 NO 보다 위에 있어 「정보 없음」을 「불가」로 다루지 않는다. 그 언어 원천에 필드가 없으면(en 반려동물) 개요 근거가 있을 때만 2, 없으면 1 로 둔다. README 에는 재채점 4 질의의 C 값 변화 방향(전/후)을 함께 적는다.

### F4 [REVISE · test-strategy] 새 유형의 풀이 지금 시스템에만 공정하다 — 조건·별칭이 고쳐지는 날 그 개선이 벌점으로 보인다
- 스펙: `spec.md:77` 「풀링: v2 와 같다 — A·B·C top-20 합집합」. 같은 스펙 `spec.md:95` 와 README `scripts/search-eval/README.md:134-135` 는 「판정 세트는 그것을 만든 시스템에만 공정하다」를 함정으로 든다. 이번 스펙이 드러내려는 결함은 「조건어를 필터로 옮기지 않는다」(`open-questions.yml:37` Q7①)다.
- 영향: CONDITION 풀은 조건을 무시하는 지금 검색의 top-20 뿐이다. 「주차 가능 해수욕장」의 진짜 정답인 parking=YES 해수욕장 수천 건은 풀 밖에 있다. 후속에서 조건을 필터로 옮기면 그 문서들이 판정 없음(=0)으로 올라와 nDCG 가 **내려간다**. ALIAS 도 마찬가지로, 정답 문서(`title:<id>`)가 지금 검색 top-20 에 없으면 풀에 들어오지 않아 「정답 없음」으로 잘못 분류된다.
- 수정: SR-4.1 에 유형별 풀 보강을 넣는다. CONDITION 은 같은 질의 모양의 BM25 + 속성 필터(`parking=YES` 등) top-20 을 한 레그로 더한다. ALIAS 는 evidence 의 문서 id 를 풀에 강제로 넣는다. TYPO 는 원 질의(`edit:<기존 질의>`)의 v2 등급을 합친다. 기준(`grading-rubric.md:14`)이 「바로잡은 뜻으로 판정」이라 등급이 같아야 하고, 채점 비용과 불일치도 준다. TG3.7 의 「판정 없는 top-10 ≤10%」는 이 보강 뒤에 잰다.

### F5 [REVISE · test-strategy] evidence 규칙이 게이트가 아니다 — 스크립트로 판정할 수 있는 부분을 형식 검사에 올린다
- 스펙: `spec.md:51` 「아래 형식이 아니면 넣지 않는다」. 확인은 `tasks.md:28`(TG2.8 Verify, 사람/에이전트 확인)뿐이고, SR-5.5 형식 검사(`spec.md:90`)는 `intent` 와 등급만 본다.
- 프로젝트 규칙: `/Users/gideok-kwon/.claude/CLAUDE.md` 「grep·빌드 태스크·스크립트로 참/거짓이 나오는 규칙은 게이트로 만든다」.
- 수정: SR-5.5 에 다음을 더한다(전부 오프라인, OpenSearch 없이 판정 가능).
  ① `evidence` 가 `v2` 이거나 SR-2 표의 접두어 열 개 정규식 중 하나에 맞는다.
  ② 접두어와 `intent` 의 짝이 표의 「쓰는 유형」 열과 맞는다(`edit:`→TYPO, `zero:`→NO_ANSWER, `attr:`→CONDITION …).
  ③ `edit:<q>:<종류>`·`variant:<q>:<종류>` 의 `<q>` 가 같은 파일의 기존 질의다. `edit` 이면 자모 단위 편집 거리가 1 이고 원 질의의 intent 가 NAME/CATEGORY, `variant` 이면 원 질의가 NATURAL 이다.
  ④ `graded_by` 가 `v2|sonnet-…|human-…` 꼴이다.
  ⑤ `events:` 항목에 방문자 id 모양(UUID·숫자열)이 없다.
  `title:`·`attr:`·`zero:` 의 건수 자체는 색인이 있어야 판정되므로 사람 확인으로 남기되, evidence 에 실행 시각을 적게 한 현행 규칙을 유지한다.

### F6 [REVISE · test-strategy] 회귀 주입 목록에 빈 칸이 있고, ②는 아무것도 바꾸지 못할 수 있다
- `tasks.md:48` 주입 ①②③. ②「NO_ANSWER 를 nDCG 평균에 넣도록」은 F2 를 고치기 전 구현이라면 이미 숫자가 섞여 있어 변화가 없다. 풀 등급이 전부 0 인 NO_ANSWER 만 있으면 `None` 이라 역시 변화가 없다. 그러면 「켰다」를 증명하지 못한다.
- 수정: ② 앞에 「NO_ANSWER 중 등급 1 이 있는 질의가 1개 이상」을 확인하는 단계를 둔다. 주입을 둘 더한다. ④ NO_ANSWER 아닌 항목의 등급을 전부 0 으로 → 형식 검사 빨간불(SR-5.5 둘째 조건). ⑤ evidence 접두어를 틀린 값으로 → 빨간불(F5). ⑥ `click_boost_pair` 에 NO_ANSWER 를 다시 넣으면 짝 수가 늘어난다(F2). 주입은 지금처럼 임시 사본에서 한다.

### F7 [MINOR · implementation] `graded_by` 에 채점 모델 버전이 없다
- `spec.md:83` `sonnet-<날짜>`, `tasks.md:8` 「v2 와 같은 Claude Sonnet」. README v2 절(`scripts/search-eval/README.md:106-107`)도 「Claude Sonnet」으로만 적었다.
- 「같은 채점기라 눈금이 같다」는 전제는 모델 id 가 같을 때만 성립한다. Haiku 는 +0.28 후했다는 기록이 있으므로 버전 차이도 확인 대상이다.
- 수정: `graded_by` 를 `sonnet-<model id>-<날짜>` 로 하고, README v3 절에 서브 에이전트 실제 모델 id 를 적는다. v2 와 버전이 다르면 v2 질의 10개를 다시 채점해 평균 차를 적는다.

### F8 [MINOR · domain] 사람 대조 전 등급으로 기준선을 잡는다 — 재채점 시 기준선도 같이 바꾸는 규칙을 명시한다
- `open-questions.yml:7` Q1 「결과가 오기 전에는 sonnet 등급으로 세트를 교체」, `spec.md:81` 「80% 미만 유형은 … 다시 채점」, `spec.md:89` 기준선 갱신.
- 사람 대조 결과로 한 유형을 다시 채점하면 세트 점수 눈금이 또 바뀐다. 그런데 SR-5.4 는 「세트가 바뀌면」 기준선을 갱신한다고만 적었다. 등급만 바뀌는 경우가 여기에 드는지가 열려 있다.
- 수정: SR-6.1 에 「등급이 바뀌어도 새 날짜 파일 + 기준선 갱신을 같은 커밋으로」를 명시한다. 「관련/비관련」의 경계(등급 ≥2 를 관련으로 보는지 ≥1 인지)도 v2 와 같은 값으로 적는다. README 에 정의가 없다(`README.md:107`).

### F9 [MINOR · implementation] 「v2 150 질의만」을 고르는 키
- `spec.md:88`, `spec.md:83`. 재채점 4 질의는 `graded_by` 가 `v2` 에서 `sonnet-…` 로 바뀐다. 이 키로 고르면 146 이 된다.
- 수정: 선택 키를 `evidence == "v2"` 로 정한다. 기준선 이동 원인을 가르려면 「v2 146(재채점 제외)」 줄도 함께 낸다. 색인 드리프트와 재채점 효과가 한 숫자에 섞이지 않게 하기 위해서다(TG5.5 `tasks.md:57` 의 원인 확인이 이 줄로 끝난다).

### F10 [MINOR · implementation] 첫 실행 경로와 실행 시간
- `tasks.md:54` 「로컬에서 C 만 공개 API 로」 vs CronJob 은 `http://search:8083`(`live-eval.py:28`)으로 게이트웨이를 거치지 않는다. 로컬 실행은 엣지·게이트웨이 레이트 리밋을 거치므로, 228 질의를 연달아 보내면 실패가 섞일 수 있다. 그 값으로 기준선을 잡으면 안 된다.
- `cronjob-eval.yaml:25` `activeDeadlineSeconds: 900`. 질의가 150에서 약 228로 1.5배 늘고, 질의마다 encode + A + B(2회) + C 를 부른다. v2 정기 실행 로그에서 실제 소요 시간을 읽어 900초 안에 여유가 있는지 적는다.
- 수정: 기준선은 아래 Q5 경계대로 클러스터 안 수동 Job 의 첫 값으로 잡는 것을 기본으로 한다. 로컬 C 값은 참고로만 쓴다.

### F11 [MINOR · security] 운영 검색어를 레포로 옮기기 전 개인정보를 거른다
- `spec.md:55` 「방문자 id 는 파일에 남기지 않는다」, `spec.md:94` 운영 검색어를 세트에 더한다. 판정 파일은 레포(공개)에 커밋되고 ConfigMap 으로도 나간다(`kustomization.yaml:16-20`).
- 검색창에는 전화번호·이메일·이름이 들어올 수 있다. 「두 명 이상 방문자」 조건이 많이 줄여 주지만 0 으로 만들지는 않는다.
- 수정: SR-2 제외 규칙에 「숫자 6자리 이상 · `@` · URL 이 든 검색어 제외」를 더하고 F5 형식 검사에도 같은 정규식을 둔다.

### F12 [MINOR · usecase] 빈 정답 통과율이 구조상 0 근처에 붙을 수 있다
- `spec.md:74` 지표 = `total == 0` 비율. 하이브리드는 kNN 레그가 k 개를 채워 오므로 정답이 없어도 결과가 나온다. 탐침도 ko 3/3 이 수백 건이었다(`spec.md:23`).
- 보고만 하는 단계(SR-5.4)라 막을 이유는 없다. 다만 몇 주 동안 0% 에서 움직이지 않으면 「흔들림을 보고 게이트로 올린다」(Q6)는 판단 근거가 생기지 않는다.
- 수정(선택): NO_ANSWER 행에 「top-10 중 등급 0 비율」(지어낸 결과의 비율)을 한 칸 더한다. 0건 임계값이 생기기 전에도 순위 변경에 따라 움직이는 값이다.

### F13 [MINOR · implementation] 분모가 0 인 경우와 실패 계수
- `spec.md:88` 판정 없는 top-10 비율: NO_ANSWER 가 0건을 내면 분모가 0 이다. 분모는 「돌려받은 문서 수 합」으로 정의한다.
- `spec.md:89` 「NO_ANSWER 를 뺀 질의로 그대로」가 질의 실패 계수까지 포함하는지가 모호하다. API 장애는 질의 종류와 관계없이 장애이므로 실패 계수는 전체 질의로 센다고 적는다.

### F14 [MINOR · domain] `seed:intents.yml` 문구는 시스템이 이미 준비한 분포다
- `spec.md:58` NATURAL 출처 = `intents.yml`. 이 파일은 질의 벡터를 미리 계산해 두는 시드다(`tools/embed/src/embed/queries.py:6,78`). v2 를 만들 때도 출처였다(`intents.yml:3` 「판정 세트의 30 질의는 여기에도 들어 있다」).
- 측정은 성립하지만, 이 문구들로 잰 NATURAL 점수는 처음 보는 문장보다 후하게 나올 수 있다.
- 수정: 의도별 표에서 NATURAL 을 `seed:` 와 `variant:` 로 한 줄씩 나눠 보이거나, README 에 이 차이를 함정으로 적는다.

---

## Q5 경계 — 수동 Job·임시 파드

사용자 지시 「운영 데이터를 쓰지 않는 평가 실행이면 진행」을 기준으로 정리했다.

| 행위 | 운영 데이터 쓰기 | 판단 |
|---|---|---|
| `ssh msa-oci` 에서 OpenSearch `_search`·`_count`·`_alias` GET/POST, ClickHouse `--readonly=1` | 없음 | 진행 |
| `ssh msa-oci` 에서 `kubectl -n commerce create job --from=cronjob/search-eval <이름>` | 없음. `live-eval.py` 는 stdout 만 쓴다(`live-eval.py:220` 결과 파일은 인자를 줄 때만, 파드 안 경로) | **진행해도 된다.** 조건: ① 로컬 kubectl 이 아니라 ssh 로 한다. ② 새 ConfigMap 이 Argo 로 반영된 뒤에 한다. ③ KST 06:30~06:45(재색인)와 07:30(정기 실행)을 피한다. ④ 끝나면 Job 을 지운다 |
| 풀링용 top-20 조회를 위한 임시 파드 | 없음 | 가능하면 띄우지 않는다. NetworkPolicy 가 임시 파드 egress 를 막은 전례가 있어(메모 `oci-prod-api-direct-call`) 결과가 비면 오진한다. 노드 셸에서 ClusterIP 조회로 충분한지 먼저 본다. 띄운다면 기존 eval 라벨(`app.kubernetes.io/component: eval`)을 달고 끝나면 지운다 |
| CronJob·ConfigMap·기준선 변경 | 배포 | 커밋 → Argo 경로로만 한다. 손으로 `kubectl apply`·`edit` 하지 않는다 |
| 색인·DB·ClickHouse 쓰기 | 있음 | 하지 않는다 |

이 경계를 `open-questions.yml` Q5 answer 에 반영하고, TG3.1·TG4.4·TG5.2 의 「사용자 확인」을 「위 조건으로 진행」으로 바꾸면 된다.

## 관점별 체크리스트 판정

- **architecture** — 모듈 경계·의존 방향 변화 없음. 평가 스크립트·판정 파일은 `k8s/base/search-batch/eval/` 안에 머문다. ADR-0050 상품 평가 표와 섞지 않는다(Q4). → SHIP
- **implementation** — 참조 코드는 존재한다. 단 응답 필드 이름 불일치(F1), `None` 의존(F2). 마이그레이션·롤백은 새 날짜 파일 + 같은 커밋 기준선 갱신이라 되돌리기가 단순하다(`tasks.md:9,56`). 동시성은 Forbid + 같은 묶음 푸시로 충분하다. → REVISE
- **security** — 읽기 전용 접근, 방문자 id 미보관. 검색어 개인정보 거르기 보강(F11). → SHIP
- **test-strategy** — 회귀 주입을 스펙이 요구하는 점은 좋다. 풀 편향(F4), evidence 게이트 부재(F5), 주입 공백(F6). → REVISE
- **domain** — 의도 유형 표·우선순위·용어집 계획은 일관된다(`캠핑`/`글램핑` CATEGORY, `경복굼` TYPO). 조건만 있는 질의의 등급 평탄화(F3). → REVISE
- **usecase** — 두 사용자 이야기가 SR-5.3 표·빈 정답 통과율로 이어진다. 운영 검색어 0건일 때의 처리도 정해져 있다(`tasks.md:21`). F12 는 선택 사항. → SHIP

VERDICT: REVISE
