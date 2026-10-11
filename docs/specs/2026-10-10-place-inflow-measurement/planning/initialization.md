# Initialization — place 유입 측정 (I0-5 · I0-6)

요청 원문 (2026-10-10, 메인 세션 → 스펙 작성 에이전트):

```text
작업 위치: 워크트리 W=/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl. 메인 트리 금지, 커밋 금지, 코드 수정 금지 — 스펙 문서만 쓴다. 운영 확인이 필요하면 `ssh msa-oci 'sudo k3s kubectl -n commerce …'` 읽기만(로컬 kubectl 금지).
hns 스펙을 쓴다(write-spec 형식: Goal · User Stories · Specific Requirements SR-n(항목 최대 8, 검증 가능한 문장) · Existing Code to Leverage · Out of Scope · Open Questions(권고 기본값과 함께, stage post-impl)). 그리고 tasks.md(그룹마다 Dependencies·Phase·Required Skills, 첫 하위 작업은 테스트, 마지막은 실행 가능한 검증 명령, 체크박스 비움, 마지막 그룹은 회귀 주입(임시 사본)·문서·배포·운영 확인)와 context/open-questions.yml, planning/initialization.md(이 프롬프트 원문)를 docs/specs/2026-10-10-place-inflow-measurement/ 에 쓴다. 400줄 이내.
배경: docs/plans/2026-10-10-place-search-inflow-plan.md 의 I0-5·I0-6, docs/plans/2026-10-10-place-inflow-execution-handoff.md. 실측: 운영 `analytics.events` 의 SESSION_START payload 가 `{}` 라 검색 유입을 셀 수 없다. 접근 로그로는 Googlebot 하루 ~90(place 상세 ~17), Yeti·Bing 거의 0.
범위:
- I0-5 세션 유입 기록: portal-fe tracker 의 SESSION_START payload 에 첫 진입 document.referrer 의 **호스트만**(경로·쿼리 금지 — 개인정보·토큰 유출 방지, 같은 출처면 빈 값), utm_source/medium/campaign(길이 상한), 착지 경로 유형(허브·상세·지역·랜딩·편집·기타 — 경로 정규화, id 금지). 기존 계측 규약 docs/specs/2026-10-08-place-hub-instrumentation/spec.md, portal-fe/src/analytics/tracker.ts, ADR-0095 를 읽고 따른다. 서버(analytics) 는 payload 를 그대로 적재하는지 확인(크롤러 UA 필터는 이미 있음). 일 집계 질의(검색엔진별·착지 유형별 세션)를 계측 스펙 SR-10 표 방식으로 문서화. 개인정보처리방침(/privacy) 문구에 영향이 있는지 확인(ADR-0077, 방침 §6) — 필요하면 SR 로.
- I0-6 봇 크롤 일 집계: portal-fe nginx 접근 로그에서 Googlebot·Yeti·Bingbot·Daumoa·OAI-SearchBot·GPTBot 의 요청을 호스트·경로 유형·상태코드(200/304/404/5xx)별로 하루 한 번 집계해 남긴다. 지금 nginx 로그 형식에 호스트가 없다(`$host` 미포함) — 로그 형식 변경 필요 여부, 집계 위치(CronJob + 최소 RBAC 로 pods/log 읽기 vs nginx 쪽 별도 로그 vs analytics 로 비컨) 중 무료 티어·단순성 기준으로 하나를 권고하고 근거를 쓴다. 결과 저장처(ClickHouse 새 테이블이면 마이그레이션 방식은 레포 선례 확인). k8s/CLAUDE.md, docs/standards/new-domain-checklist.md 는 새 도메인이 아니라 해당 없음이지만 CronJob·NetworkPolicy 관례는 따른다.
보고: 쓴 파일, 주요 결정과 권고, 열린 질문. 한글로.
```
