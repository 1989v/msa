작업 위치: 워크트리 W=/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl. 메인 트리 금지, 커밋 금지, 코드 수정 금지 — 스펙 문서만. 운영은 공개 API GET, `ssh msa-oci` 읽기 질의만.
hns 스펙 형식(Goal · User Stories · SR-n(최대 8항목, 검증 가능) · Existing Code to Leverage · Out of Scope · Open Questions(권고 기본값, post-impl))으로 docs/specs/2026-10-10-place-search-query-fixes/ 에 spec.md, tasks.md(그룹 메타·첫 작업 테스트·마지막 검증 명령·체크박스 비움·마지막 그룹은 임시 사본 회귀 주입·배포·운영 확인·판정 세트 전후 nDCG), context/open-questions.yml, planning/initialization.md(이 프롬프트 원문). 400줄 이내.
배경: 판정 세트 스펙 docs/specs/2026-10-10-search-judgment-cases/spec.md 가 운영에서 드러낸 결함(2026-10-11):
1. 정답이 없는 질의에 결과를 낸다 — 「에펠탑」 854건, 「ㅁㄴㅇㄹ」 691건, 「디즈니랜드」 367건(관광지 검색 API). 「지원하지 않는 자연어·없는 대상은 해석한 척하지 않는다」 규칙.
2. 「주차 되는 해수욕장」: 조건어를 속성 필터로 옮기지 않아 주차 조건 없이 해수욕장 375건.
3. 「아이랑 갈 만한 곳」: 띄어 쓴 「갈 만한」이 불용구에 안 걸려 「아이아이 연남」·「아이와즈」가 상위.
먼저 관광지 검색 경로를 읽는다: search/app 의 AttractionSearchAdapter(하이브리드 BM25+벡터), 쿼리 언더스탠딩(CategoryLexiconService·intents.yml·불용구 목록 — 위치를 찾아라), 통합 검색 ADR-0090, 메모 「OpenSearch 3.8(Lucene 10) nori 품사 필터는 묶음 태그 E·J 를 모른다」, docs/specs/2026-10-08-place-text-and-states(exact·relax).
설계 요구: ① 결과 0건이 정답인 경우를 어떻게 판정할지(최소 점수·BM25 매칭 없음+벡터만 일치일 때 처리 등) — 벡터 단독 매칭이 엉뚱한 결과를 내는 구조인지 근거로 확인하고 권고 ② 조건어(주차·반려동물·무료·휠체어 등)를 속성 필터로 옮기는 규칙 — 기존 칩·속성 파라미터와 같은 값으로, 「해석했다」는 표시(사용자가 해제 가능)와 함께 ③ 불용구 정규화(띄어쓰기 변형) ④ 판정 세트(H4) 지표로 전후 비교, 회귀 기준선 게이트를 깨지 않게.
보고: 쓴 파일, 원인 분석(코드 근거), 주요 결정, 열린 질문. 한글로.
