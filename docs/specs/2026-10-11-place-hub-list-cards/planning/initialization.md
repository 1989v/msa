작업 위치: 워크트리 W=/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl (먼저 `git pull --rebase -q origin main`). 커밋·푸시 금지. 한글.
hns 스펙 작성(shape+write, 인터뷰 없음 — 결정은 권고 기본값으로 open-questions.yml 에 answered-default). 새 폴더 docs/specs/2026-10-11-place-hub-list-cards/ 에 planning/initialization.md · planning/requirements.md · spec.md · tasks.md · context/open-questions.yml.

배경: 사용자의 이 세션 첫 요청은 「관광지 검색 서비스를 UI/UX 개선과 제대로 된 관광지 검색 사이트로 확장」이었고, 사용자가 「place.1989v.com 목록이 아무것도 안 바뀐 것 같다」고 지적했다. 실제로 허브 결과 카드는 사진·제목·현지명·meta·주소·개요 그대로이고, 초기 분석(scratchpad/reports/place 관광지 검색 글로벌 벤치마킹.md §3.1 우선순위 표·§3.2 「결과 카드」 절)이 권고한 #5 「결과 카드에 상태 배지·시군구 라벨·거리·순위 번호」와 #10 「모바일 고정 액션 바(길찾기·저장·공유) + 섹션 점프 탭」이 안 됐다. 이 둘을 범위로 스펙을 쓴다(#9 가봤다는 범위 밖).

요구:
- 먼저 현재 운영 화면을 파악: portal-fe/src/pages/place/PlacePage.tsx 카드(약 2160~2230행 AttractionCard 류), AttractionPage.tsx, 검색 API 응답 필드(search/app SearchAttractionUseCase.Result·AttractionSearchDocument) — 카드에 쓸 값(오늘 영업/휴무 closureState·closedWeekdays, 시군구 이름 region/sigungu, 거리 distanceKm(위치 정렬일 때), 분류, 사진, 무장애·반려 등 속성, 찜 수 savedCount 하한 3)이 응답에 이미 있는지·목록 응답에서 빠지는지(목록에서 access 등을 뺀다는 기록 있음) 확인하고 근거 file:line 을 적기.
- 벤치마크 근거(리포트 §3.2: 「사진·이름·분류·평가 신호·한 줄 설명」, Lonely Planet 동네 라벨)를 인용하되 리뷰·평점 데이터가 없으니 꾸며내지 않는다(「정보 없음」≠불가 원칙, 가짜 평가 신호 금지).
- 디자인 표준: DESIGN.md 토큰·§12, docs/design/k-heritage.html 견본 먼저, docs/conventions/frontend-design.md, docs/standards/fe-visual-verification.md(CDP 4조합). 서버 렌더(AttractionPageRenderer)·프리렌더(portal-fe/scripts/prerender-seo.mjs 허브·지역 목록)와 화면이 같은 카드 정보를 내야 하는지 판단.
- 모바일 상세 고정 액션 바: 길찾기·찜·공유(기존 공유 패널 재사용)·전화, 섹션 점프 탭(요약·가는 법·주변 등). 첫 화면 폴드·CLS·접근성(포커스·스크린리더) 완료 조건, 상세 행동 줄과 중복 노출 정책.
- 계측: 카드 클릭·액션 바 클릭 이벤트(기존 tracker 규약).
- 완료 조건은 수치(390×844·1440×900 캡처, 카드당 높이, CLS, 대비 4.5)와 회귀 주입 목록 포함. tasks.md 는 그룹별 테스트 먼저·검증 명령 끝.
끝나면 스펙 요약(SR 목록·결정한 기본값·근거)을 짧게 보고.
