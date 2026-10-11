# Review Verdict — 관광지 검색 판정 세트 v3 (S3-6b)

- 대상: `docs/specs/2026-10-10-search-judgment-cases/spec.md` · `tasks.md` · `context/open-questions.yml`
- 리뷰: `context/engineer-review-a.md` (REVISE F1~F6, MINOR F7~F14)
- 판정 방식: 리뷰가 인용한 `file:line` 을 워크트리에서 직접 열어 대조했습니다.

강등하거나 기각한 발견은 없습니다. 헌법 2의 근거(표준에 수용 명시 · 레포에 같은 패턴이 실제로 있음 · 인용이 실제와 다름)를 하나도 찾지 못했고, 인용은 전부 원문과 맞았습니다.

| id | 원판정 | 심판 | 근거(직접 확인) | 스펙에 반영할 편집 한 줄 |
|---|---|---|---|---|
| F1 응답 필드 `totalElements` | REVISE | **유지 REVISE** | `SearchAttractionUseCase.kt` `Result(… val totalElements: Long …, val correctedKeyword: String?)`, `AttractionSearchController.kt:103` `ApiResponse.success(result)`. `live-eval.py:80` 은 지금 `attractions` 만 읽음 | SR-5.2·TG4.1: `data.total` → `data.totalElements`. 키가 없으면 그 질의를 실패로 셈. 행에 `correctedKeyword` 추가 |
| F2 NO_ANSWER 가 `None` 으로 안 빠짐 | REVISE | **유지 REVISE** | `live-eval.py:84` `if not any(g > 0 …): return None` 이라 등급 1 이 하나만 있어도 숫자가 나옴. 스펙 `:73` 「전부 0 또는 1」, `:80` 「국내 대체지는 1」. `click_boost_pair` `:176-178` 은 숫자면 `deltas` 에 넣음 | SR-3.4 근거를 「intent 로 제외」로 바꿈. SR-5.1 「손대지 않는다」 → 「`click_boost_pair` 는 NO_ANSWER 만 건너뜀」. SR-8 함정 문구도 같이 수정 |
| F3 조건만 있는 질의의 등급 평탄화 | REVISE | **유지 REVISE** | v2 파일 실측: `pet friendly` 등급 분포 {0:13, 1:11, 2:8, 3:7}(≥1 이 26건, 스펙과 일치). 스펙 `:79` 「값이 없으면 최고 2」. `live-eval.py:88` 은 이상적 순서를 풀 등급에서 만듦 → 풀이 전부 2 이면 순서와 관계없이 1.0 | SR-4.2: 조건만 있는 질의는 YES/FREE 3 · UNKNOWN+개요 근거 2 · 근거 없음 1 · NO/PAID 0. 조건+유형 질의는 지금대로. README 에 재채점 4 질의의 C 전/후 기록 |
| F4 새 유형 풀이 지금 시스템에만 공정 | REVISE | **유지 REVISE** | 스펙 `:77` 「v2 와 같다 — A·B·C top-20」, `:95` 와 README 함정 절 「판정 세트는 그것을 만든 시스템에만 공정하다」. A·B·C 모두 조건을 필터로 쓰지 않음(스펙 `:23`) | SR-4.1 에 유형별 풀 보강: CONDITION 은 BM25+속성 필터 top-20 한 레그, ALIAS 는 evidence 문서 id 강제 포함, TYPO 는 원 질의 v2 등급 합침. TG3.7 의 10% 기준은 보강 뒤에 잼 |
| F5 evidence 규칙이 게이트가 아님 | REVISE | **유지 REVISE** | `~/.claude/CLAUDE.md` 「grep·빌드 태스크·스크립트로 참/거짓이 나오는 규칙은 게이트로 만든다」. 스펙 `:90` 형식 검사는 intent·등급만 봄. 확인 수단은 `tasks.md:28` 의 사람/에이전트 확인뿐 | SR-5.5 에 오프라인 검사 ①~⑤ 추가(접두어 정규식 · 접두어↔intent 짝 · `edit:`/`variant:` 원 질의 존재와 편집 거리 1 · `graded_by` 형식 · `events:` 에 id 모양 없음) |
| F6 회귀 주입 공백 | REVISE | **유지 REVISE** | `tasks.md:48` 주입 ①②③뿐. ②는 F2 때문에 값이 그대로일 수 있음(위 `:84` 근거) | TG4.4: ② 앞에 「등급 1 있는 NO_ANSWER ≥1」 확인 단계. 주입 ④ 비-NO_ANSWER 등급 전부 0 · ⑤ evidence 접두어 오류 · ⑥ click_boost_pair 에 NO_ANSWER 재투입 → 짝 수 증가 추가 |
| F7 `graded_by` 에 모델 버전 없음 | MINOR | **유지 MINOR** | README v2 절에 「Claude Sonnet 4,289」만 있고 모델 id 가 없음. 같은 절에 Haiku 「후함 +0.28」 기록 | SR-4.5: `sonnet-<model id>-<날짜>`. 모델이 v2 와 다르면 v2 질의 10개를 다시 채점해 평균 차를 기록 |
| F8 사람 대조 전 기준선 · 관련 경계 | MINOR | **유지 MINOR** | `grading-rubric.md` 에는 0~3 정의만 있고 관련/비관련 경계가 없음. README v2 표도 「관련/비관련 일치 88%」만 적음 | SR-6.1: 등급만 바뀌어도 새 날짜 파일과 기준선 갱신을 한 커밋에. SR-4.3: 관련 = 등급 ≥ (v2 값) 명시 |
| F9 「v2 150 질의만」 선택 키 | MINOR | **유지 MINOR** | 스펙 `:83` graded_by 값과 SR-4.4 재채점이 겹쳐 graded_by 로 고르면 146 이 됨 | SR-5.3: 선택 키를 `evidence == "v2"` 로. 「v2 146(재채점 제외)」 줄 추가 |
| F10 첫 실행 경로 · 900초 | MINOR | **유지 MINOR** | `cronjob-eval.yaml:25` `activeDeadlineSeconds: 900`, `live-eval.py:28` 내부 `search:8083` | TG5.2: 기준선은 클러스터 안 실행값만 씀(로컬 C 는 참고). v2 정기 실행 소요 시간 × 1.5 를 900초와 비교해 기록 |
| F11 운영 검색어 개인정보 | MINOR | **유지 MINOR** | `kustomization.yaml` configMapGenerator 가 판정 파일을 그대로 실음. 스펙 `:55` 는 방문자 id 만 제외 | SR-2 제외 규칙에 「숫자 6자리 이상 · `@` · URL」 추가. 같은 정규식을 SR-5.5 에도 |
| F12 빈 정답 통과율이 0 근처에 붙음 | MINOR | **유지 MINOR** | 스펙 `:23` 탐침 「에펠탑 854건 · ㅁㄴㅇㄹ 691건」. 리뷰 스스로 「선택」으로 둠 | SR-5.3 NO_ANSWER 행에 「top-10 중 등급 0 비율」 한 칸(선택) |
| F13 분모 0 · 실패 계수 범위 | MINOR | **유지 MINOR** | 스펙 `:88-89` 에 분모 정의와 실패 계수 범위가 없음 | SR-5.3: 판정 없는 비율의 분모 = 돌려받은 문서 수 합. SR-5.4: 질의 실패는 NO_ANSWER 포함 전체로 셈 |
| F14 `seed:intents.yml` 은 미리 준비된 분포 | MINOR | **유지 MINOR** | `intents.yml:3` 「판정 세트의 30 질의는 여기에도 들어 있다」. `queries.py` 가 이 시드를 질의 벡터 사전에 넣음 → 시드 문구는 벡터 레그가 반드시 맞고, 처음 보는 문장은 BM25 로만 답함 | SR-5.3 의도별 표에서 NATURAL 을 `seed:` 와 `variant:` 로 나누거나, README 함정 절에 한 줄 |

```json
[
 {"id":"F1","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt","line":206,"quote":"val totalElements: Long,"},{"file":"k8s/base/search-batch/eval/live-eval.py","line":80,"quote":"return [str(x[\"id\"]) for x in (d.get(\"data\") or {}).get(\"attractions\") or []]"}],"reason":"인용 일치, 반증 없음"},
 {"id":"F2","verdict":"keep","severity":"REVISE","evidence":[{"file":"k8s/base/search-batch/eval/live-eval.py","line":84,"quote":"if not any(g > 0 for g in grades.values()):"},{"file":"k8s/base/search-batch/eval/live-eval.py","line":176,"quote":"if n_off is not None and n_on is not None:"}],"reason":"등급 1 이 있으면 숫자가 나와 평균과 짝 비교에 섞임"},
 {"id":"F3","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":79,"quote":"그 언어 원천에 값이 아예 없으면 그 질의의 최고 등급은 2다"},{"file":"k8s/base/search-batch/eval/live-eval.py","line":88,"quote":"ideal = sorted(grades.values(), reverse=True)[:k]"}],"reason":"반증 없음, v2 실측 26건 일치"},
 {"id":"F4","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":77,"quote":"풀링: v2 와 같다 — 같은 날 운영 색인에서 A·B·C 세 구성의 top-20 합집합"}],"reason":"스펙 자신의 함정 절과 충돌, 반증 없음"},
 {"id":"F5","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":90,"quote":"형식 검사(종료 코드 1): intent 가 없거나 여덟 값 밖인 항목"}],"reason":"전역 규칙상 스크립트로 판정 가능한 규칙은 게이트 대상"},
 {"id":"F6","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/tasks.md","line":48,"quote":"② NO_ANSWER 를 nDCG 평균에 넣도록 한 줄 바꿈"}],"reason":"F2 근거로 ②가 무동작일 수 있음"},
 {"id":"F7","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":83,"quote":"sonnet-<날짜>"}],"reason":"반증 없음"},
 {"id":"F8","verdict":"keep","severity":"MINOR","evidence":[{"file":"scripts/search-eval/grading-rubric.md","line":10,"quote":"0 관련 없음 — 다른 종류, 다른 지역, 글자만 겹침"}],"reason":"관련 경계 정의 부재 확인"},
 {"id":"F9","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":88,"quote":"「v2 150 질의만」 C 평균 한 줄"}],"reason":"선택 키 미정"},
 {"id":"F10","verdict":"keep","severity":"MINOR","evidence":[{"file":"k8s/base/search-batch/cronjob-eval.yaml","line":25,"quote":"activeDeadlineSeconds: 900"}],"reason":"인용 일치"},
 {"id":"F11","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":55,"quote":"방문자 id 는 파일에 남기지 않는다"}],"reason":"검색어 본문 필터 없음"},
 {"id":"F12","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":23,"quote":"「에펠탑」 854건 · 「ㅁㄴㅇㄹ」 691건"}],"reason":"반증 없음, 선택 사항"},
 {"id":"F13","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-10-search-judgment-cases/spec.md","line":89,"quote":"NO_ANSWER 를 뺀 질의로 그대로 쓴다"}],"reason":"분모·범위 미정"},
 {"id":"F14","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-09-05-unified-search/intents.yml","line":3,"quote":"판정 세트(judgments.yml)의 30 질의는 여기에도 들어 있다"}],"reason":"시드 문구는 벡터 사전에 미리 들어 있음"}
]
```

## Overall
**REVISE 유지.** BLOCK 은 없습니다. F1~F6 을 스펙에 반영하면 착수할 수 있습니다. F7~F14 는 같은 편집 때 한 줄씩 넣으면 됩니다.

## 사용자 판단 목록
권고 기본값으로 진행하고, 사용자가 바꾸면 따릅니다.

1. **Q5 수동 Job (`kubectl create job --from=cronjob/search-eval`)**
   - 리뷰는 「진행해도 된다」고 했고, 스펙의 Q5 answer 는 「사용자 확인 뒤」입니다. 둘이 다릅니다.
   - 리뷰가 근거로 든 사용자 지시(「운영 데이터를 쓰지 않는 평가 실행이면 진행」)는 제가 원문으로 확인하지 못했습니다.
   - 기본값: 리뷰의 네 조건(`ssh msa-oci` 만 · Argo 반영 뒤 · KST 06:30~06:45 와 07:30 회피 · 끝나면 Job 삭제)을 지키며 진행합니다. 운영 클러스터에 리소스를 만드는 일이라 사용자에게 한 번 알립니다.
2. **Q1 사람 대조 80건 + NO_ANSWER 풀** — 사용자가 맡을 일입니다. 결과가 오기 전에는 `graded_by: sonnet-…` 과 README 의 「사람 대조 전」 표기로 세트를 교체합니다.
3. **F3 조건만 있는 질의의 등급표** (3/2/1/0, 개요 근거 기준) — 도메인 판단입니다. 기본값은 리뷰안 채택입니다.
4. **F4 CONDITION 풀 보강 레그** — 채점할 쌍이 늘어 서브 에이전트 비용이 커집니다. 기본값은 채택입니다.
5. **F7 모델 버전이 다를 때 v2 10질의 재채점** — 기본값은 채택입니다.
6. **F12 NO_ANSWER 「top-10 중 등급 0 비율」 칸** — 리뷰도 선택으로 둔 항목입니다. 비용이 작아 기본값은 채택입니다.
7. **F11 검색어 필터 정규식** (숫자 6자리 이상 · `@` · URL) — 기본값은 채택입니다.

SUMMARY: keep 14 / demote 0 / dismiss 0
NOTES: 리뷰가 Q5 answer 와 TG3.1·TG4.4·TG5.2 를 「위 조건으로 진행」으로 바꾸라고 권한 부분은 발견이 아니라 정책 변경 제안이라 판정하지 않았고, 사용자 판단 목록 1번으로 옮겼습니다.