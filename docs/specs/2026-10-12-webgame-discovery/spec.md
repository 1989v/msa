# 웹게임 대표 홈페이지와 변경일 전달 보완
<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/src/seo/gameGuide.mjs, portal-fe/scripts/prerender-seo.mjs, portal-fe/src/pages/games/GamesPage.tsx -->

## Goal
사용자의2026-10-12 `웹게임 키워드로도 노출가능하도록 보완할순 없나?` 요청으로 기존 ADR-0062 SEO 구현의 L2 보완을 실행한다.
일반 웹게임 검색 상위 진입이 목표지만 본 변경·검증 성공은 순위 달성이나 특정 순위 보장이 아니다.
새 기능/아키텍처/백엔드/DB 없이 현재 홈페이지 소개와 sitemap 수정일 전달을 보완한다.

## Evidence
10/12 실측: 웹게임1~10페이지 직접 링크 없음,1989v 웹게임 웹사이트 카드1번째 디펜스 장르와 홈페이지 관련 문서.
검색 홈페이지 설명은48종, 실제 운영은82종. 새 안내를 넣은3상세 lastmod는2026-08-17, 홈페이지 lastmod는없음.
브랜드는1989v 게임이다. 숫자1989만으로의 검색과 정식 브랜드를 혼동하지 않는다.

## Specific Requirements
- SR-1 현재 제목·H1·정식 브랜드는 유지한다. 홈페이지 기존 부제 위치를 공통 소개로 교체한다. 한국어:1989v 게임의 설치·회원가입 없는 무료 웹게임 서비스임을 간결하게 명시한다. 영어 대응. 장르를 고르는 기존 기능을 보존한다.
- SR-2 소개를 공통JS 카피에 두고 런타임/초기HTML에서 같은 문장을 사용한다. 메타 설명에도 브랜드와 무료 웹게임 관계를 간결하게 포함한다. 전체 게임 수82종 정상·조회 전 숫자 미노출 회귀를 유지한다. 키워드 반복·일반SEO문구를 실제 UI에 추가하지 않는다.
- SR-3 FE 정적 콘텐츠의 실제 수정일을 명시적으로 관리한다. 홈페이지 소개 변경일2026-10-12, 대표3게임 안내 수정일2026-10-11. 빌드일·현재시각을 사용하지 않는다.
- SR-4 sitemap homepage ko/en의lastmod는 홈페이지 콘텐츠 날짜와 실제 목록 게임 날짜 중 최신 유효일이다. 상세는 해당 게임 API contentUpdatedAt/releasedAt와 실제 FE 안내 수정일 중 최신 유효일을 사용한다. 비대상 게임은 기존 날짜 동작 유지. 더 새로운 실제 API 날짜를 오래된FE 날짜로 덮지 않는다. 유효하지 않은 날짜를 XML에 내보내지 않는다.
- SR-5 lang경로·canonical·hreflang·82종 메타·기존 대표3선택안내·게임별조작법·광고·플레이·기록 기능 유지. 스타일은 DESIGN.md의 기존 부제 스타일을 재사용한다. 게임 본체·관광지·기타 서비스 SEO 변경 없음.

## Verification
- 의미 있는 날짜 회귀: FE 최신/API 최신/비대상/잘못된 날짜/빌드 간 동일성. 실제 sitemap 생성에 수정일 연결되는지 검증.
- ko/en runtime·초기HTML소개일치/한H1/메타수/언어링크/기존대상안내 회귀.
- content생성,npx tsc -b,npx vite build,관련Vitest,변경ESLint,node --check,git diff --check.
- 신규번들390/1280홈페이지ko/en 4화면: 소개읽힘·가로넘침없음·카탈로그/기존안내링크존재. 운영API읽기응답을 로컬검증에 쓰면 그방법을 명시한다. 운영배포검증으로 부르지 않는다.

## Existing Code to Leverage
portal-fe/src/seo/copy.mjs hubMeta,gameHubGuide;gameGuide.mjs;prerender-seo.mjs writeRobotsAndSitemaps/renderHub;
GamesPage.tsx header;src/seo/__tests__/copy.test.ts,prerenderGames.test.ts;pages/games/__tests__/GamesPage.seo.test.tsx.

## Out of Scope
키워드대량페이지·허위인기/평가·숫자1989로브랜드변경·외부게시/연락·순위보장·robots/canonical변경·DB마이그레이션.

## Operational Boundary
구체적 diff/검증/문서 정리 후 운영 배포는 사용자에게 최종 승인받는다. 앞선10/11 배포승인은 이번변경에 사용하지 않는다.
서치어드바이저 수집요청·외부 게시도 아직 실행하지 않는다.

## Open Questions
구현을 막는 미결사항 없음. 실제 네이버 재수집 시각·순위 내부점수는 미확인이다.
