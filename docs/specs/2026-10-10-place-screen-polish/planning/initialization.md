작업 위치: 워크트리 W=/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl. 메인 트리 금지, 커밋 금지, 코드 수정 금지 — 스펙 문서만.
hns 스펙 형식(Goal · User Stories · SR-n(최대 8항목, 검증 가능) · Existing Code to Leverage · Out of Scope · Open Questions(권고 기본값, post-impl))으로 docs/specs/2026-10-10-place-screen-polish/ 에 spec.md, tasks.md(그룹 메타·첫 작업 테스트·마지막 검증 명령·체크박스 비움·마지막 그룹은 임시 사본 회귀 주입·배포·CDP 측정), context/open-questions.yml, planning/initialization.md(이 프롬프트 원문). 400줄 이내.
표준: DESIGN.md 토큰(hex 금지), docs/conventions/frontend-design.md, docs/design/k-heritage.html(place 는 브랜드 면), docs/standards/fe-visual-verification.md(기기×사이트 4조합 CDP 실측).
배경과 실측(운영 2026-10-09):
1. 데스크톱 허브(1440×900) 첫 카드 y 438(목표 ≤320, 계획 S2-3b). 겹친 요소: 헤더 63px + 툴바 279px(검색·분류·속성 칩 줄). 모바일은 스펙 E(docs/specs/2026-10-09-place-hub-mobile-perf)에서 필터 한 줄 + 시트로 이미 바꿨다 — 데스크톱도 같은 패턴(요약 줄 + 펼치기) 또는 칩 줄 압축으로 y≤320. 계측(SEARCH trigger·필터 적용)과 기존 테스트를 깨지 않게.
2. 허브 카드 제목이 브라우저 기본 링크색(#0000ee)·밑줄 — `<a class="place-card">` 에 색·밑줄 규칙 없음(기존 결함).
3. `.place-btn.primary` 다크 사이트 대비 2.03:1(예: 툴바 「검색」 버튼) — 스펙 E 가 전환 버튼만 `var(--kh-hanji, var(--ko-surface-0))` 로 고쳤다. primary 전체로.
4. 공용 시트 제목 `.kh-sheet-label` 라이트 사이트 2.79:1, 시트 속성 설명 4.09:1 — 4.5:1 이상으로(공용 컴포넌트라 다른 사용처 영향 조사).
5. 모바일 상세(390×844, 가시 664)에서 길찾기가 폴드 안인 표본 4/10 — 남은 6곳은 1~93px 넘침, 원인은 방문 요약 칸이 여러 줄이고 영문 제목이 두 줄로 접히는 것. 긴 칸 접기(예: 칸 값 n줄 넘으면 「더 보기」) 또는 행동 줄을 방문 요약 위로 — 둘 중 권고하고 근거. docs/specs/2026-10-09-place-detail-first-screen 의 방문 요약 규칙·FE/SSR 골든 패리티(visit-summary-golden)와 맞물림 주의(SSR 에서는 접기 없이 전문, FE 만 접기 등).
보고: 쓴 파일, 주요 결정·권고, 열린 질문. 한글로.
