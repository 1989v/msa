# Google 색인·캐시·후속 조치 확인
<!-- source: portal-fe/nginx.conf, portal-fe/src/pages/games/GameDetailPage.tsx, portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs -->

2026-10-12, 실제 Chrome Search Console의 게임 사이트맵 필터를 확인했다.
기준일10/9: 색인14, 미색인168. 표의4는 제외 사유 수다. 네이버 순위와는 별도 지표다.

| 사유 | URL 수 | 이번 확인 |
|---|---:|---|
| Soft404 | 18 | 모두 정상 게임 상세. 현재 초기HTML은 전부200·H1하나·noindex없음. 마지막 수집9/1~10/2 |
| noindex | 6 | 모두 정상 상세. 마지막 수집8/20~22. 현재6개 모두noindex없음 |
| 발견 후 미색인 | 87 | Google이 발견했으나 아직 크롤링하지 않은 상태. 숫자만으로 서버 결함이나 페널티를 확정하지 않음 |
| 크롤링 후 미색인 | 57 | 수집했지만 색인되지 않은 상태. 홈페이지와Minefield 등이 포함. 홈페이지 마지막 수집9/13 |

이 상태를 전체 정상이나 전체 해결로 기록하지 않는다. 의도적 제외라고 단정했던 noindex는 실제 URL을 확인한 결과 정상 상세의 과거 기록이었다.
Google의 상태 정의와 100%색인 비보장은 [공식 보고서 도움말](https://support.google.com/webmasters/answer/7440203?hl=ko) 참고.

## 실제 Google 검사

- Overworld영문: 저장된10/2결과는Soft404,10/12 22:14라이브는등록가능·HTTP200·모든리소스로드·JS콘솔메시지없음.
  Google 스마트폰 렌더링 스크린샷에 게임 제목·커버·Play버튼·게임정보를 확인했다.
- 홈페이지: 저장된9/13결과는크롤링후미색인. 수집/색인허용·가져오기성공·자기canonical이었다.
  10/12 22:24라이브는등록가능·색인생성가능.
- 홈페이지검사의sitemap필드에일시적처리오류가보였지만 게임사이트맵필터·실제XML이존재한다. 이를사이트맵서버오류로확정하지않는다.
- 라이브등록가능은 최종색인·순위보장이 아니다. 이전 크롤링HTML은보기버튼이비활성이라 과거Soft404의정확한렌더내용을복원하지못했다.

[URL 검사 안내](https://support.google.com/webmasters/answer/9012289?hl=ko),
[Soft404와빈본문/JS오류 설명](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors?hl=ko).

## 웹 캐시 확인

홈페이지·사이트맵·Overworld상세를 일반/Googlebot UA/Cache-Control:no-cache/확인용쿼리의4방식으로GET했다.
각URL의4응답SHA256이같고cf-cache-status는DYNAMIC이며Age는없었다.
홈페이지는실제운영컨테이너원본과SHA256까지같고 새소개와동일한JS`index-C17zRYpA.js`를쓴다.
홈·상세Cache-Control은no-cache,must-revalidate,사이트맵은max-age300,must-revalidate다.

현재 표본에서오래된CDN응답이전달되는증거는없다. 모든PoP나사용자기존열린탭의메모리를검사한것은아니다.
검색설명이나과거색인보고서는서버원본이바뀌어도재수집/분석전까지이전상태를보여줄수있다.
캐시전체삭제를실행하지않았고,현재표본에는캐시삭제가필요할근거가없다.

## 이미 한 조치·남은 확인

- 운영`portal-fe:2224a81`배포,빌드/CI성공,Ready1/1. 운영HTML8개와사이트맵10개날짜검사성공.
- 홈페이지색인요청1회접수. 우선순위크롤링대기열추가메시지와`색인생성요청됨`표시확인.
- Soft404수정결과확인1회실행. `유효성검사상태:시작됨`,시작일10/12확인. 최종통과는아직아님.
- noindex6개재검증은아직미실행. 사용자의새컴퓨터유즈사전승인규칙에따라 추가화면조작을멈추고범위승인을요청했다.
- 동일사이트맵재등록·전체87/57개반복색인요청·캐시삭제는하지않았다.

성공적으로수집된사이트맵은Google이주기적으로다시읽는다. [사이트맵리포트공식안내](https://support.google.com/webmasters/answer/7451001?hl=en).
현시점에등록가능하다는이유만으로57개의색인이자동확정되거나추가콘텐츠보완이필요없다고결론내리지않는다.
다음에는홈페이지최종색인,두검증의통과/실패URL,새크롤링시각,일반검색실제노출을확인한다.

근거: [Google실측·URL목록](google-index-audit.json),[캐시대조](cache-audit.json),[운영검증](production-evidence.json).
계정이메일·Google검사ID·공유토큰·화면전체덤프는저장소에포함하지않았다.
