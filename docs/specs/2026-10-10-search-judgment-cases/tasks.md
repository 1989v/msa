# Task Breakdown: 관광지 검색 판정 세트 — 의도 유형·사례 추가·의도별 리포트 (S3-6b)

Total Task Groups: 5. 정본 `spec.md`. 열린 질문 `context/open-questions.yml`(권고 기본값으로 진행). 심판 판정 `context/review-verdict.md`(F1~F14 반영).
작업 위치: 워크트리 `scratchpad/wt-impl`. 운영은 `ssh msa-oci` 읽기만(ClickHouse `--readonly=1`, OpenSearch `_search`·`_count`·`_alias` GET/POST 조회). 원시 덤프는 스크래치패드에 두고 레포에는 결과 파일만.
클러스터 안 실행(수동 Job·임시 파드)은 Q5 네 조건으로만 한다: ① `ssh msa-oci` 에서만(로컬 kubectl 금지) ② 이 변경이 Argo 로 반영된 뒤 ③ KST 06:30~06:45·07:30(정기 `search-eval`) 회피 ④ 끝나면 Job·파드 삭제. 운영 클러스터에 리소스를 만드는 일이라 띄우기 전에 사용자에게 한 줄 알린다.

착수 전 메모
- 채점(TG3)은 서브 에이전트로 나눠 돌린다. 한 에이전트에 질의 10개 안팎, 같은 유형끼리. 채점 에이전트는 서로의 결과와 검색 순위를 보지 않는다.
- 채점기는 v2 와 같은 Claude Sonnet 이다 — 다른 채점기를 섞으면 v2 등급과 눈금이 갈린다(README v2 절: Haiku 는 평균 +0.28 후했다). `graded_by` 에 모델 id 를 넣는다(SR-4.5).
- 기준선 env 를 바꾸는 커밋과 세트 파일 교체 커밋은 같은 묶음으로 푸시한다 — 사이에 CronJob 이 돌면 새 세트를 옛 기준선으로 잰다.

---

### Task Group 1: 기존 150 질의 의도 라벨링 (SR-1)
**Dependencies:** None
- [x] 1.1 `judgments-attractions-2026-10-05.json` 을 읽어 각 항목에 `intent` 를 SR-1 표 규칙(위쪽 우선)으로 단다. 기존 항목 `evidence: "v2"`, `graded_by: "v2"`.
- [x] 1.2 라벨 결과를 `context/intent-labels-v2.md` 표(질의 · lang · source · intent · 판단 근거 한 줄)로 남긴다. 애매한 것(예: 「야경 명소」 CATEGORY vs NATURAL, 「서울 근교 드라이브」 REGION_TYPE vs NATURAL)은 근거 칸에 적는다.
- [x] 1.3 Verify: 150 항목 전부 `intent` 가 여덟 값 안 · 유형별 수 표 · CONDITION 에 4 질의(SR-4.4)가 들어 있는지.

### Task Group 2: 새 질의 후보 수집 (SR-2 · SR-3 · SR-7)
**Dependencies:** TG1(중복 확인용)
- [x] 2.1 운영 검색어: ClickHouse 읽기 전용으로 SEARCH `term`·`entity_id`·`total`·방문자 수를 뽑는다. SR-2 제외 규칙(시험 입력·한 방문자·개인정보 정규식 — 숫자 6자리 이상 · `@` · URL) 적용 뒤 남는 수를 기록(0 이어도 기록). 개인정보 정규식에 걸린 원문은 스크래치패드에도 남기지 않고 건수만 적는다.
- [x] 2.2 CONDITION: 언어별 속성 × 분류(lclsSystm3) 집계 — YES/FREE/동반가능 문서 ≥5 인 조합에서 고른다. 문구는 칩 이름 + 분류 이름(「주차 가능 해수욕장」「입장 무료 박물관」「반려동물 동반 캠핑장」「유모차 대여 수목원」, en 「free admission museum」「parking beach」). 조합 집계 수를 `evidence` 에.
- [x] 2.3 NATURAL: `intents.yml` 중 세트에 없는 문구 + 기존 NATURAL 질의 변형(조사·띄어쓰기·어미). 한 원 질의당 변형 최대 1.
- [x] 2.4 ALIAS: 색인에서 괄호 제목 문서(ko 360 · en 666)를 뽑아 별칭이 독립 이름인 것(숫자·층수·지점명 제외)을 고른다 + `tourism_synonyms` 규칙의 덜 쓰이는 쪽(「뮤지엄」「재래시장」「유원지」) + 로마자 변환(매큔-라이샤워) 4개 안팎.
- [x] 2.5 TYPO: 기존 NAME·CATEGORY 질의에 편집 1회. 편집 종류가 한 가지로 몰리지 않게 고르고, 각 오타의 `title.keyword`·`title.en` 정확 일치 0 확인.
- [x] 2.6 NO_ANSWER: ⓐ GeoNames 국외 도시(place 지명 계층) + 분류 이름, ⓑ 분류 × 시도 집계 0 조합, ⓒ 무의미 입력. SR-3.2 ① 집계식·결과·시각을 `evidence` 에.
- [x] 2.7 후보 표를 `context/case-candidates.md` 에(질의 · lang · intent · evidence). 기존 세트·서로 중복 제거(정규화 소문자·공백 제거 일치).
- [x] 2.8 Verify: 모든 후보에 SR-2 형식 `evidence` · 유형별 수가 SR-7 표 ±2 안 · 지어낸 문구 0(evidence 없는 행 0).

### Task Group 3: 풀링·채점·사람 대조 (SR-4)
**Dependencies:** TG2
- [x] 3.1 풀링: 새 질의의 A·B·C top-20 합집합. A·B 는 OpenSearch·인코더(`search:8099`)가 클러스터 안에만 있으므로 `ssh msa-oci` 에서 `live-eval.py` 의 `ids_bm25`·`ids_hybrid` 와 같은 질의 모양(size 20)으로 조회한다. 임시 파드가 필요하면 위 Q5 네 조건으로 띄운다. C 는 공개 API GET. 색인 이름(`_alias/attractions`)·시각 기록.
- [x] 3.1b 유형별 풀 보강(SR-4.1): CONDITION 은 BM25 + 해당 속성 필터 top-20 레그 하나 더, ALIAS 는 `evidence` 문서 id 강제 포함, TYPO 는 원 질의의 v2 등급을 합치고 새 문서만 채점. 보강으로 늘어난 쌍 수를 유형별로 기록.
- [x] 3.2 `grading-rubric.md` 에 SR-4.2 두 절을 더한다(조건은 데이터로 · 정답 없는 질의). 예시는 시험 대상 질의를 쓰지 않는다(정답 누출 방지 — v2 와 같은 원칙).
- [x] 3.3 문서 카드: 제목 · 분류 이름 · 주소 · 개요 앞 300자 · (CONDITION 이면) 해당 속성 값. CONDITION 은 질의가 「조건 + 유형/지역」인지 「조건만」인지를 묶음 지시에 적어 SR-4.2 의 두 등급표 중 맞는 것을 쓰게 한다. 서브 에이전트로 유형별 묶음 채점, 결과는 `{query, lang, id, grade, reason?}` JSONL 로 스크래치패드에. 채점 모델 id 를 기록해 `graded_by: sonnet-<모델 id>-<날짜>` 로 쓴다.
- [x] 3.4 SR-4.4 기존 조건형 4 질의를 「조건만」 등급표로 재채점, 바뀐 쌍 수와 질의별 C nDCG 전/후(같은 날 같은 응답으로 옛 등급·새 등급 두 번 계산).
- [x] 3.4b SR-4.5: 채점 모델이 v2 와 같다고 확인할 수 없으면(README 에 v2 모델 id 없음) v2 질의 10개(유형별 고르게, 재채점 4 질의 제외)를 같은 지시로 다시 채점해 v2 등급과의 평균 차·관련/비관련(≥2) 일치율을 기록. 이 10개의 새 등급은 세트에 넣지 않는다(눈금 확인용).
- [x] 3.5 사람 대조 표본 80건 + NO_ANSWER 풀 전부를 `context/human-sample.md`(질의 · 문서 카드 · 빈 등급 칸)로 만든다. 일치 판정 경계는 관련 = 등급 ≥2(SR-4.3) — **사람 채점은 사용자 몫**(Q1). 사용자 결과가 오기 전에는 해당 유형 `graded_by: sonnet-<날짜>` 로 두고 README 에 「사람 대조 전」이라 적는다.
- [x] 3.6 NO_ANSWER 풀에 등급 ≥2 가 있으면 SR-3.2 ② 대로 유형을 옮긴다.
- [x] 3.7 Verify: 새 질의마다 등급 수 = 풀 크기 · NO_ANSWER 아닌 새 질의에 등급 >0 문서 ≥1 · 판정 없는 top-10 비율(C, 분모 = 돌려받은 문서 수 합) 유형별 ≤10% — **3.1b 보강 뒤** 값으로 잰다.

### Task Group 4: `live-eval.py` 의도별 리포트·형식 검사 (SR-5)
**Dependencies:** TG1 (파일 형식), TG3 와 병행 가능
- [x] 4.1 `ids_live` → `(ids, totalElements, correctedKeyword)` — 응답 `data.totalElements`(`SearchAttractionUseCase.Result`). `totalElements` 키가 없으면 예외로 올려 그 질의를 실패로 센다. 행에 `intent`·`total_C`·`unjudged_C`·`correctedKeyword`.
- [x] 4.1b `click_boost_pair` 가 `intent == "NO_ANSWER"` 항목을 건너뛴다(SR-5.1). 그 밖의 키 읽기는 그대로.
- [x] 4.2 의도별 표 출력(SR-5.3) — NO_ANSWER 는 `intent` 로 제외(`ndcg()` 의 `None` 에 기대지 않는다), NO_ANSWER 행에 빈 정답 통과율 + (선택) top-10 중 등급 0 비율, 판정 없는 비율 분모 = 돌려받은 문서 수 합(0 이면 `-`), NATURAL 은 `seed:` 와 나머지로 두 줄. 「v2 150 질의만」(선택 키 `evidence == "v2"`) C 평균과 「v2 146(재채점 제외)」 한 줄. 게이트 입력은 NO_ANSWER 를 뺀 언어별 C 평균, 질의 실패 수는 NO_ANSWER 포함 전체(SR-5.4).
- [x] 4.3 형식 검사(SR-5.5) — intent·등급 검사 + 오프라인 검사 ①~⑥(접두어 정규식 · 접두어↔intent 짝 · `edit:`/`variant:` 원 질의 존재와 편집 거리 1 · `graded_by` 형식 · `events:` 에 id 모양 없음 · 검색어 개인정보 정규식). 네트워크를 부르기 전에 위반 항목을 전부 출력하고 종료 코드 1. TG2.8 의 「지어낸 문구 0」 확인도 이 검사가 판정한다.
- [ ] 4.4 Verify (실행 근거를 남긴다):
  - 형식 검사·의도별 집계는 OpenSearch 없이도 확인한다: 스크래치패드에서 `ids_bm25`·`ids_hybrid`·`encode` 를 막고 C(공개 API)만 도는 사본으로 새 파일을 돌려 의도별 표가 나오는지 본다. 사본은 커밋하지 않는다.
  - 실제 3구성 확인은 배포 뒤 수동 Job(`kubectl create job --from=cronjob/search-eval`, Q5 네 조건) 또는 첫 정기 실행 로그. 의도별 표·판정 줄·소요 시간을 `verifications/first-run.md` 에.
  - 회귀 주입 전 확인: 세트에 등급 1 이 있는 NO_ANSWER 질의가 ≥1 인지 본다. 없으면 주입 ②가 `ndcg()` 의 `None` 때문에 값이 그대로여서 증거가 안 된다 — 그때는 임시 사본 세트에 등급 1 을 하나 넣고 주입한다.
  - 회귀 주입(임시 사본에서, 각각 컴파일·실행되는 회귀로):
    - ① 한 항목의 `intent` 삭제 → 형식 검사 빨간불
    - ② NO_ANSWER 를 nDCG 평균에 넣도록 한 줄 바꿈 → 「v2 150 질의만」 값은 그대로이고 언어 평균이 내려가는지
    - ③ `totalElements` 를 무시하고 0 으로 → 0건율 100% 로 튀는지(그리고 키 누락 시 실패로 세는지)
    - ④ 비-NO_ANSWER 한 질의의 등급을 전부 0 으로 → 형식 검사 빨간불
    - ⑤ 한 항목의 `evidence` 접두어를 틀리게(`edits:` 꼴) 또는 intent 와 안 맞게 → 형식 검사 빨간불
    - ⑥ `click_boost_pair` 의 NO_ANSWER 건너뛰기를 지움 → 짝 수(`deltas` 길이)가 늘어나는지
    - 여섯 다 빨간불(또는 기대한 값 변화)을 본 뒤에만 「켰다」고 적는다.

### Task Group 5: 세트 교체·기준선·문서 (SR-6 · SR-8)
**Dependencies:** TG3, TG4
- [x] 5.1 `judgments-attractions-<날짜>.json` 생성(기존 150 + 새 질의, 옛 파일 유지). `kustomization.yaml` configMapGenerator 에 새 파일 추가(옛 파일 줄은 빼서 ConfigMap 크기를 늘리지 않는다), CronJob 명령 파일 이름 교체. 이후 사람 대조 결과로 등급만 바뀔 때도 새 날짜 파일 + 기준선 갱신을 한 커밋에(SR-6.1).
- [x] 5.2 기준선은 **클러스터 안 실행 값만** 쓴다(배포 뒤 수동 Job — Q5 네 조건, 또는 첫 정기 실행). 로컬에서 공개 API 로 잰 C 는 경로(엣지 경유 vs 내부 `search:8083`)가 달라 참고값으로만 README 에 둔다. 그 값으로 `EVAL_BASELINE_KO/EN` 갱신, CronJob 주석 「판정 세트 v3(<날짜>, N 질의)로 잰 C」. v2 정기 실행 소요 시간 × (v3 질의 수 / 150) × 1.5 를 `activeDeadlineSeconds: 900` 과 비교해 기록하고, 넘으면 기준선 커밋 전에 멈추고 보고.
- [x] 5.3 README v3 절 · rubric · glossary · 계획서 S3-6b 상태(SR-8).
- [x] 5.4 커밋은 경로를 좁혀(`k8s/base/search-batch/` · `scripts/search-eval/` · `search/glossary.md` · 이 스펙 폴더 · 계획서) `git diff --cached` 로 세트 파일·CronJob 파일명·기준선 세 줄이 함께 들어갔는지 확인.
- [ ] 5.5 Verify: 배포 뒤 다음 정기 실행(KST 07:30) 로그에서 ① 판정 통과 ② 의도별 표에 여덟 유형 ③ 「v2 150 질의만」 C 가 v2 기준선 ±0.03 안 — 벗어나면 재채점 4 질의 때문인지 먼저 본다.
  - 배포 뒤 수동 Job(2026-10-11 12:26 KST)에서 ①②③ 확인 — `verifications/first-run.md`. 정기 실행(10-12 07:30) 로그 확인은 남음.

## 완료 보고에 넣을 것
유형별 질의 수(ko/en) · 쌍 수 · 등급 출처별 수 · 사람 대조 일치율(또는 「대기」) · 첫 측정 의도별 표 · 빈 정답 통과율 · 새 기준선 · 드러난 검색 결함 목록(후속 후보).
