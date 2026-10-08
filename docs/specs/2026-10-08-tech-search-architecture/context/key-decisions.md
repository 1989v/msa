# 결정 기록 — /tech/search

### 2026-10-08 TG1 구현 해석 (구현자 제안, 메인 채택)
- slug 의 「백틱 제외」는 백틱 문자만 지우고 코드 내용은 남긴다. 연속 `-` 는 합치지 않는다(스펙 문자 그대로).
- 링크 ⑤ 는 `//host` 도 막는다(스펙보다 엄격 — 같은 출처만).
- heading 과 §4 행 id 는 한 중복 집합(겹치면 `-2`) — 링크가 못 맞추면 ⑨ 가 세운다.
- fencesvg 의 `<div style="overflow-x:auto">` 래퍼를 벗기고 `<figure class="fs-figure">` 만 낸다 — 가로 스크롤은 페이지 CSS 가 figure 에.
- `slugify` 를 export — 원본 md 작성 시 요약 불릿 링크 계산에 쓴다.
- (TG3) 요약 블록은 따로 만들지 않고 생성 html 을 첫 `<h2` 에서 나눠 앞부분을 요약 섹션으로. `techArticleJsonLd` headline 은 「검색 아키텍처」 고정(원문 문장을 두 곳에 두지 않는다). fencesvg 변수 13종을 `--kh-*`/`--ko-*` 로 매핑.

### 2026-10-08 TG2 — 코드가 스펙과 달라 코드를 따른 곳 (공개 문서는 코드 기준)
- **쿼리 벡터 캐시는 OpenSearch `query_vectors` 인덱스가 아니라** 프로세스 Caffeine → MySQL `query_vector` 표 → search-embed(`QueryVectorService.kt:56-83`, `V1__create_query_vector.sql`, 커밋 54fc37387). 그림 레인은 MySQL, 용어 「쿼리 벡터 캐시(`query_vector` 표)」. ADR-0090:61·search/CLAUDE.md 는 옛 설명(보고만 — Q5).
- Redis ZSET 은 인코딩까지 실패한 쿼리만 센다. 통합 묶음 순서는 3단(타입 의도 묶음 > 첫 결과 제목 일치 > ALL_TYPES), 0건 묶음 제외. unified 인기도는 BM25 에 더한다(Sum). 자동완성 regions 는 log1p(인구). 벡터 레그 입력은 오타 교정된 검색어. 엣지 캐시는 상세·nearby 만. 계측 이벤트는 IMPRESSION·CLICK·SEARCH·SESSION_START. ClickHouse 는 clickBoost 원천으로 그림에.
- §4 `항목` 셀은 고정 키만(설명은 상태 열) — 파서 정확 비교·짧은 slug. 구조 게이트는 모든 행이 근거 파일 1개 이상.
- 생성 html 에 h1 이 이미 있다 → 페이지·프리렌더는 h1 을 따로 그리지 않는다.
- scripts/search-eval/README.md:10 의 KST 05:30 은 낡음(매니페스트 07:30) — 보고만.
