# 초기화 — place 허브 최소 행동 계측 (S1-12b)

- 작성: 2026-10-08 · 워크트리 `place-stage2`(origin/main `8a61f0b`)
- 사용자 요청 원문(2026-10-08): 「내가 결정해야할게 뭐라고? 상관없으면 이어서 마지막까지 진행해. 그리고 비포 이미지는 미리 첨부해둬도 될듯」 — 결정 5건은 계획서 기본 권고로 진행, 2단계 착수.
- 이 슬라이스의 정의(계획서 `docs/plans/2026-10-08-place-growth-work-plan.md` 진행 상태 절): **S1-12b 최소 계측** — 허브 submit·filter·결과 선택·찜 성공·지도 링크·세션 시작, 중복 키 `(viewId, entityType, entityId, action)`, beacon 식별자 계약 통일. 2단계 개선 **전**에 같은 정의로 기준선이 잡혀야 한다.
- 근거 조사: `docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-12-instrumentation.md`(허브 6종 행동 미계측, 공통 수집기 존재, 통합 검색·상세 추천·지역 행사만 일부, ClickHouse MergeTree 중복 가능, beacon 본문 visitorId/sessionId 를 서버가 안 읽음).
- 인터뷰 생략(`--no-interview`): 사용자가 「이어서 마지막까지 진행」을 지시했고, 요청이 계획서·조사 보고서에 파일·심볼 단위로 구체화돼 있다. 미지수는 코드가 답하거나 `context/open-questions.yml` 에 가정으로 적고 닫는다.
