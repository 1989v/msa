# 웹게임 검색 노출 보완 — 대표 소개·수정일
<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/src/seo/gameContentDates.mjs, portal-fe/src/pages/games/GamesPage.tsx, portal-fe/scripts/prerender-seo.mjs -->

상태: 사용자 운영 배포 승인으로2026-10-12 배포 완료. `웹게임` 상위 노출 목표는 아직 미달성이다.
구현 커밋 `d2c231ef94acb18f1d677b5cbc1587b5e558ee49`.

## 변경

- 기존 부제의 개발 개념 설명을 서비스 소개로 바꿨다: “1989v 게임은 설치·회원가입 없이 즐기는 무료 웹게임 서비스입니다. 원하는 장르를 골라 바로 플레이하세요.”
- 한국어·영어의 실제 화면과 초기 HTML은 같은 소개 원본을 사용한다. 메타 설명에 브랜드·무료 웹게임·실제 전체 수를 함께 담는다.
- 제목·H1·정식 브랜드와 기존 게임별 고유 안내는 유지했다.
- 사이트맵은 FE 소개/안내의 실제 변경일과 API 날짜를 함께 고려한다. 홈페이지10/12, 대표3안내10/11. 더 최신 API 날짜는 보존하며, 비대상 날짜는 기존 방식대로 처리한다.
- 빌드일로 모든 URL 날짜를 바꾸지 않는다. 게임 본체·다른 서비스·robots/canonical 변경은 없다.

네이버는 사이트맵을 주기적으로 읽고 내부 알고리즘으로 수집 대상을 선별한다. lastmod는 실제 페이지 수정일을 담는 선택 항목이다.
[공식 가이드](https://searchadvisor.naver.com/guide/request-feed). 이 변경만으로 특정 순위를 보장할 수 없다.

## 검증

- 관련 Vitest: **4 files,59 tests passed**. 초기 HTML/화면 소개 일치, 전체 게임 수와 조회 전 숫자 미노출, canonical·언어 링크·기존 안내 회귀 포함.
- 콘텐츠 생성 성공, `npx tsc -b` exit0, `VITE_API_URL= npx vite build` exit0 (`built in802ms`).
- 변경 TS/TSX ESLint4파일, 변경 MJS3파일 `node --check`, `git diff --check` exit0. MJS는 ESLint 범위 밖이라 syntax 확인만 기록한다.
- 실제 sitemap renderer 테스트: FE/API 최신 날짜 선택, 비대상 우선순위 보존, 불가능한 날짜 제외, 빌드 시각이 달라도 같은 XML.
- 실제 상세 API4건으로 날짜 대조: 대표3개10/11, 비대상 Snake8/17 보존, ko/en 홈페이지10/12. [상세 날짜 증거](detail-date-audit.json).
- 부모가 diff를 검토하고 네이티브 Chrome CUA에서 ko/en 390/1280 총4화면의 소개 읽힘·카탈로그·기존 링크를 확인했다. 새 소개의 잘림은 관찰되지 않았다. computed scrollWidth·런타임 예외 전체 감사는 하지 않았다.

[화면 확인 방식·요약 목록 XML 표본](evidence.json). 82종 요약 목록에는 상세 날짜가 없어 그 XML은 실제 fetchCatalog 전체 결과가 아니다.
날짜 검증에는 실제 상세4건과 회귀 fixture를 사용했다. 작업트리: `/Users/gideok-kwon/.codex/worktrees/8849/msa`.

## 검증 한계

로컬 신규 번들과 읽기 전용 운영 API GET 프록시로 확인했다. 광고 POST는405로 차단됐으므로 운영 광고 검증은 아니다.
전체 `npm run build`/전체 프리렌더는 게임 submodule 미초기화로 실행하지 않았다. 이후 운영 이미지 빌드·CI와 배포 후검증을 완료했다.
검증용 탭·개발 도구·로컬 서버는 정리했고 사용자 원래 화면을 복원했다.

## 배포 이후 확인

1. 운영 초기 HTML·sitemap에서 소개와 실제 날짜 확인.
2. 주요 URL의 수집 상태 확인. 필요하면 주요 URL만 한 번 수집 요청하며 반복 제출하지 않는다.
3. 홈페이지48종 검색 설명 갱신 여부와 브랜드 검색의 대표 URL 확인.
4. `웹게임` 일반 검색 진입 여부 별도 측정. 페이지마다 혼합 결과 개수가 달라 페이지 부재를 임의의 숫자 순위로 바꾸지 않는다.

[네이버 수집 정책](https://searchadvisor.naver.com/guide/request-crawl)은 처리 지연과 검색 노출 비보장을 설명한다.
서치어드바이저 수집 요청·외부 소개 게시·연락은 이번에 실행하지 않았다.

## 관련 자료

- [구현 범위](spec.md) · [주요 결정](context/key-decisions.md)
- 10/12실측 문서: `/Users/gideok-kwon/IdeaProjects/msa/docs/research/2026-10-12-naver-search-rank-audit.md`
- [기존 게임별 안내](../2026-10-11-webgame-ranking/README.md)
- [외부 소개 글 초안](../2026-10-11-webgame-ranking/outreach-drafts.md) — 실제 리뷰·외부 인용 확보는 미실행

## 운영 확인

- images run38253629792 및CI38253629768 성공. 운영이미지`portal-fe:2224a81`,Ready1/1 확인.
- 실제운영초기HTML8페이지에서공통소개·82종메타·기존안내·canonical·H1·noindex없음 확인.
- sitemap ko/en 홈페이지·대표3게임·비대상snake 총10개 날짜를 실제상세API와 대조해 통과했다.
- [배포후증거](production-evidence.json). Google리포트정상화·웹게임상위노출달성은아직아니다.
- [CDN·원본캐시대조](cache-audit.json): 홈·sitemap·Overworld4요청방식의동일응답,홈원본SHA256일치. 표본의cf-cache-status는DYNAMIC.
- [Google색인실측](google-index-audit.json):10/9게임sitemap기준14색인/168미색인,Soft40418개현재HTTP200/noindex없음. OverworldGoogle라이브테스트등록가능/모든리소스로드/JS메시지없음.
- 홈페이지도크롤링후미색인목록에있고마지막수집9/13. 과거6noindex는8/20~22의정상상세였으며현재는noindex가없다. 최신상태재검증·색인결정은남아있다.


- [Google색인·캐시·이미실행한조치와남은확인](google-indexing.md). 홈페이지색인요청과Soft404검증은접수했고,noindex검증은새컴퓨터유즈승인대기다.
