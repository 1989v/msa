# 웹게임 검색 상위 노출 기준선
<!-- source: portal-fe/nginx.conf, portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs -->

## 2026-10-11 확인 결과

비로그인 curl GET, `Mozilla/5.0`, 네이버 통합검색(nexearch) 최초 응답 HTML 기준.
웹 도구에서는 검색 URL이 열리지 않았으나 curl에서는 정상 검색 본문을 확보했다.
JavaScript 내부의 captcha 문자열을 차단 화면으로 잘못 탐지한 최초 플래그는 사용하지 않았다.
script/style을 제외한 실제 본문·검색 결과 링크를 분석했다. 정확한 시각은 evidence JSON 참조.

| 질의 | 관찰 |
|---|---|
| 웹게임 | 최초 결과 페이지에 game.1989v.com 직접 검색 결과 링크 없음. CrazyGames·오름게임즈·OGTO·곰곰 Play 존재 |
| 무료 웹게임 | 최초 결과 페이지에 game.1989v.com 직접 검색 결과 링크 없음. 오름게임즈·CrazyGames·OGTO 존재 |
| site:game.1989v.com | 홈페이지·arena·card-flip·rift-front·block-burst·mine-pioneer 등 다수 실제 검색 결과 존재 |

`site:`의 내부 링크·사이트 링크를 합친 URL 수는 색인 문서 수로 계산하지 않는다.
홈페이지 설명은 이전 48종이고 여러 상세 설명은 기록·평가 공통 문구다.
현재 운영 HTML 82종·소개와 다르다. 수정본 반영 시각과 순위에 미친 영향은 미확인.
첫 응답에서 없다는 결과는 전체 검색 결과의 부재·정확한 전체 순위를 뜻하지 않는다.
PC 실제 브라우저 위치와 모바일 결과는 이 기준선에서 측정하지 않았다.

근거: [검색 링크·스니펫](evidence/serp-baseline.json).
원본 HTML은 `/private/tmp/naver-ranking-phase2/`에 보관했다. 응답 HTML 전체를 저장소에 넣지 않는다.

## 운영 HTML 표본

홈페이지 ko/en, 대표 상세 3개, 퍼즐 장르 총6개를 GET했다.
모두200, 자기 canonical1개, H1 1개, 초기 소개·내부링크 존재, noindex 메타 없음.
표본의 이미지 alt 속성 누락은0개. 전체 사이트·게임 iframe 내부·과거수집을 검사한 결과는 아니다.
수집 설정 변경이나 alt 일괄수정을 이번 보완에 추가할 근거가 발견되지 않았다.

근거: [HTTP·본문 표본](evidence/live-html-audit.json).

## 서버 로그 표본

ingress-nginx의 최근24시간/마지막15,000줄 중 Yeti User-Agent이면서 게임호스트 referrer가 있는24개 요청을 찾았다.
24개 모두200. `/en/games/crate-shift`에서 JS 자산·게임 상세 API·랭킹 API 등을 요청한 흔적이 있다.
단, referrer와UA만으로 네이버 봇의 IP 진위를 인증한 것은 아니다. 원문 요청 자체의 Host도 이 로그 형식에는 없다.
수집 HTML의 원요청은 표본에 없다. 빈 결과를 미방문으로 해석하거나 전체 수집 성공으로 일반화하지 않는다.
개인 IP·전체 요청 로그는 저장소에 포함하지 않았다.

근거: [UA 로그 집계](evidence/yeti-ua-log-summary.json).

## CSV와 공개 검색의 차이

사용자 CSV의 진단 색인은 9/17~10/10까지 1개지만 현재 공개 도메인 검색에는 다수 상세가 있다.
따라서 `실제 색인 문서가 정확히 1개라서 웹게임 검색에 안 나옴`으로확정하지않는다.
[네이버 사이트 진단 가이드](https://searchadvisor.naver.com/guide/report-diagnosis)는 통계 추출 시점과 현재 URL 검색의 차이를 설명한다.

## 배포 후 측정 기록

| 확인 시각·환경 | 웹게임 첫 페이지 홈페이지 노출 | 무료 웹게임 노출 | 홈페이지 검색 설명 | 상세 검색 소개 | 비고 |
|---|---|---|---|---|---|
| 2026-10-11 비로그인 HTTP GET | 없음 | 없음 | 48종 | 다수 기록·평가 문구 | 이번 2차 보완 전 |
| 배포 후 최초 확인 | 미확인 | 미확인 | 미확인 | 미확인 | 배포일·확인 시각 추가 |

첫 검색 페이지의 비광고 웹사이트 결과 진입이 첫 이정표다. 배포된 코드·테스트·색인 수만으로 상위 노출 완료를 선언하지 않는다.
변경을 묶어 배포했다면 개별 변경의 인과 효과로 분리해 단정하지 않는다.
Search Advisor 노출·클릭리포트는 [집계 지연·영역 제한](https://searchadvisor.naver.com/guide/report-expose-ctr)을 고려해 보조 지표로 사용한다.
