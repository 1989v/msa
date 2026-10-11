# Initialization — 원 요청 (2026-10-10, 메인 세션 → 스펙 작성 에이전트)

작업 위치: 워크트리 W=scratchpad/wt-impl. 메인 트리 금지, 커밋 금지, 코드 수정 금지 — 스펙 문서만. 운영 확인은 curl(GET) 또는 `ssh msa-oci 'sudo k3s kubectl -n commerce …'` 읽기만.
hns 스펙 형식(Goal · User Stories · SR-n(항목 최대 8, 검증 가능한 문장) · Existing Code to Leverage · Out of Scope · Open Questions(권고 기본값, stage post-impl))으로 docs/specs/2026-10-10-place-crawl-priority/ 에 spec.md, tasks.md(그룹마다 Dependencies·Phase·Required Skills, 첫 하위 작업 테스트, 마지막 실행 가능한 검증 명령, 체크박스 비움, 마지막 그룹은 임시 사본 회귀 주입·문서·배포·운영 확인), context/open-questions.yml, planning/initialization.md(이 프롬프트 원문)를 쓴다. 400줄 이내.
배경: docs/plans/2026-10-10-place-search-inflow-plan.md(I1-1·I1-3·I2-6·I3-3), docs/plans/2026-10-10-place-inflow-execution-handoff.md, ADR-0062. 실측: Googlebot place 상세 크롤 하루 ~17, sitemap 64,076 URL(허브 541·상세 62,984·행사 551), Search Console 은 하위 사이트맵을 3~9일마다 읽음.
범위:
1. I1-1 핵심 사이트맵 분리: 티어 A 상세(사진·개요·place_id 있는 것 등 — 정의를 데이터로 근거 있게) + 허브·지역·(색인 켜진) 랜딩을 `sitemap-places-core.xml` 로 사이트맵 색인 맨 앞에, 나머지 상세는 뒤 파일. lastmod 는 본문 변경 시각(contentUpdatedAt, 없으면 기존 규칙). portal-fe/scripts/prerender-seo.mjs 의 현 사이트맵 생성 코드를 읽고 최소 변경으로.
2. I1-3 내부 링크 깊이: 허브 → 시도 → 시군구 → 랜딩 → 상세가 3클릭 안. 지역 페이지(RegionPage·지역 프리렌더)에 시군구별 대표 상세 링크·형제 랜딩 링크 노출, 상세의 기존 링크 절 확인. 크롤 가능한 <a href>(SSR·프리렌더 HTML 에 있어야 함).
3. I3-3 llms.txt: 랜딩·편집 페이지는 각 스위치가 켜졌을 때만 반영되도록(지금은 꺼짐) — 이미 G1 이 한 부분을 확인하고 남은 것만.
4. 랜딩 `X-Robots-Tag: noindex` 헤더: 스위치 꺼진 동안 랜딩 응답 헤더에도 noindex(지금은 메타만, nginx `$host_robots_tag` 맵이 place 에 빈 값). 스위치를 켜면 사라지게.
5. `/en/attractions/{국문id}` 가 국문 레코드를 영문 경로로 내보내는 문제: 정규 주소로 301(또는 404) — 현재 동작(SSR·SPA·canonical)을 확인하고 권고.
6. I2-6 1989v 서비스 간 맥락 링크: 메인(apex)·rank·blog·deal 에서 place 로 가는 링크 현황을 조사하고, 맥락이 맞는 곳에만 최소 추가(예: blog 관광 글 → 해당 관광지, 메인 서비스 섹션). 과하면 Out of Scope.
보고: 쓴 파일, 주요 결정·권고, 열린 질문. 한글로.
