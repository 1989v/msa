# Initialization — 원문 프롬프트 (2026-10-10, H5)

작업 위치: 워크트리 W=/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl. 메인 트리 금지, 커밋 금지, 코드 수정 금지 — 스펙 문서만. 외부 데이터 조사는 웹 검색/공개 문서 읽기만(키 발급·가입 금지).
hns 스펙 형식으로 docs/specs/2026-10-10-place-visits-and-access/ 에 spec.md, tasks.md, context/open-questions.yml, planning/initialization.md(이 프롬프트 원문). 400줄 이내.
배경: 계획 S4-3 「방문량 기반 추천(KTO 지표, 원천·대상·기간 표시, 『많이 본 곳』이라 부르지 않음) · 『많이 저장한 곳』 · 사이트 조회를 각각 근거 달아 표시」, S4-4 「가는 법: 가까운 역·정류장 사전 계산(직선거리·도보 구분), 정류장 데이터 출처·라이선스 대장 등재」. CLAUDE.md 「외부 데이터 연동 3규칙」·원천 데이터 대장 docs/architecture/data-sources.md 필수. 이미 쓰는 TourAPI 키·place-ingest 잡 구조(place/ingest), 상세 혼잡도(congestion — 이미 적재 중일 수 있음, 재색인 로그에 congestion 6374) 를 먼저 확인.
할 일: ① 방문량 원천 후보(한국관광공사 관광빅데이터·지역별 방문자 수, TourAPI 연관 서비스 등)를 찾아 「지금 키로 되는가/추가 신청이 필요한가/라이선스」를 표로. 이미 있는 데이터(congestion·관련 관광지 related 4190 등)로 할 수 있는 최소 버전을 먼저 권고. ② 역·정류장 데이터(지하철역 좌표 공공데이터, 버스정류장 — 국토부·지자체) 후보와 라이선스·받는 방법, 사전 계산 위치(place-ingest 배치 → place 컬럼/검색 문서), 표시(상세 「가는 법」: 가까운 역 이름·직선거리·「직선거리」 표기, 도보 시간은 계산하지 않거나 근거 있게). ③ 무료 티어 제약(OCI 무료, 외부 호출은 CronJob 만, 사용자 요청 경로에 외부 호출 없음). 키·신청이 필요한 원천은 사용자 몫으로 열린 질문에. 지금 할 수 있는 범위와 사용자 신청 뒤 범위를 SR 에서 나눈다.
보고: 쓴 파일, 원천 조사 표 요약, 지금 구현 가능한 범위, 열린 질문. 한글로.
