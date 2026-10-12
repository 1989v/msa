# 보완 결정
<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs -->

### 2026-10-12 대표 홈페이지와 실제 수정일
- Decision: 기존 제목/H1/브랜드는 유지. 기존 부제 위치에서 서비스 정체성과 무료 웹게임 관계를 명시하고 ko/en 프리렌더와 런타임을 일치시킨다.
- Reason: 타이틀에 이미 키워드·브랜드가 있어 반복 교체할 근거가 없다. 홈페이지에는 브랜드와 서비스의 관계를 읽을 수 있는 간결한 소개가 필요하다.
- Evidence: 10/12 검색 실측에서1989v 웹게임은 장르가 대표, 홈페이지는 관련 문서. 운영 H1은무료 웹게임 아케이드이고 브랜드 본문은 주로 푸터에 있다.
- Impact: hubMeta,GamesPage subtitle,renderHub. 정식 브랜드1989v 유지;1989로 개명하지 않는다.

### 2026-10-12 콘텐츠 변경일
- Decision: 실제 FE 변경일과 해당 API 날짜 중 최신 유효일을 sitemap에 제공한다. 변경되지 않은 게임을 모두 오늘 날짜로 바꾸지 않는다.
- Reason:10/11 새 안내가 추가된 상세3개의 사이트맵lastmod는8/17이다. 소스에서 API날짜만 읽어 정적 안내의 변경일이 누락됐다.
- Evidence: 운영sitemap.xml과prerender-seo.mjs.
- Impact: game sitemap 생성과 공통 콘텐츠 날짜 원본·회귀. homepage date10/12,대표guide date10/11.

### 2026-10-12 실행 경계
- Decision: 구현·관련 검증을gpt-6.1-sol worker에게 위임한다. 부모는 설계·증거 검토·문서를 담당한다. 배포는 검토 가능한 결과를 만든 뒤 최종 승인받는다.
- Reason: 사용자AGENTS의 모델분담·배포규칙. 순위 개선 확인은 빌드 통과와 별개다.
