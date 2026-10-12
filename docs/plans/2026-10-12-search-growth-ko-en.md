<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/RegionPage.tsx -->
# 게임·관광 검색 유입 보완 — 한국어와 영어

## 사용자 목표

- 게임: Google과 네이버에서 `웹게임` 검색 노출·순위 개선. 브랜드 검색도 별도 점검한다.
- 관광: Google과 네이버의 한국어 관광 검색에 더해, **Google의 영어 검색을 독립 목표로 포함**한다.
- 외국인 수요가 높을 것이라는 가정과 현재 서비스의 검색 실적을 구분한다. 국가 통계는 검색 위치이며 국적·검색 언어 통계가 아니다.

## 2026-10-12 확인한 상태

게임 초기 HTML·소개·사이트맵 보완은 운영 배포됐다. Google 홈페이지 색인 요청과 Soft 404 재검증은 접수됐지만 최종 색인·순위 상승은 확인되지 않았다. noindex 6개 재검증 제출은 아직 수행하지 않았다.

관광 서비스의 `/en`, `/en/regions/11`, `/en/regions/50`, `/en/regions/26`은 HTTP 200이고 영문 제목·본문·자기 URL canonical·ko/en/x-default 연결이 있다. 영문 경복궁·넥슨컴퓨터박물관·해운대 상세에도 언어별 대체 주소가 있다. 이 표본을 전체 문서의 언어 연결 검증으로 확대 해석하지 않는다. 반대쪽 상세 조회는 이번 표본 검사에서 HTTP 403으로 미확인이다.

지역 초기 본문은 155자로 제한된 메타 설명과 링크 목록이 중심이다. UI 허브 소개는 프리렌더 소개와 별도 문자열이다. 편집 가이드는 한국어 초안 3개이고 영문 편집 가이드는 없다. `/guides`는 게시된 글이 없어 404이며, 지원되지 않는 `/en/guides`는 현재 SPA 셸 200으로 응답한다. 후자는 후속 경로 정리 대상으로 기록한다.

## 기존 Search Console 기준선

기간: **2026-09-11~2026-10-08**, 검색 유형 웹. 원본은 `docs/specs/2026-10-10-place-crawl-priority/verifications/gsc-2026-10-11/`의 CSV이며 모든 페이지 행은 place 호스트다.

| 집계 | 노출 | 클릭 | 해석 |
|---|---:|---:|---|
| 전체 | 1,750 | 5 | 차트·국가·페이지 합계가 일치 |
| 영문 URL `/en`·`/en/*` | 44 | 0 | 13개 URL, 전체 노출의 2.51% |
| 한국 밖 국가 | 51 | 0 | 전체 노출의 2.91%, 영어 검색 비중과는 다름 |
| 미국 | 19 | 0 | 캐나다 4회·싱가포르 2회 등 소량 |
| 영문 홈 `/en` | 2 | 0 | 기간 평균 게재 순위 50.5 |
| 영문 제주 지역 | 6 | 0 | 기간 평균 게재 순위 51.67 |

실제 보이는 검색어에는 `where to visit in jeju` 1회/평균 41, `korea points of interest` 1회/평균 44, `tourism korea` 1회/평균 57이 있다. 소량 표본의 기간 평균이며 지금의 검색 순위가 아니다. 영문 제주 표기는 `jeju-si jeju-do`, `jeju si jeju do`, `jeju do map`도 있었다. Latin 문자 검색어에는 스페인어가 섞이므로 문자 분류를 영어 사용자 수로 계산하지 않는다. 공개 검색어 합계 1,591회는 익명화 등이 있는 전체 1,750회와 구분한다.

## 검색어와 착지 페이지

| 서비스·검색엔진 | 언어·의도 | 검색어 예시 | 주요 착지 페이지 |
|---|---|---|---|
| 게임 / Google·네이버 | 한국어 일반·브랜드 | 웹게임, 무료 웹게임, 1989v 웹게임 | 게임 홈·장르·게임 상세 |
| 관광 / Google·네이버 | 한국어 일반·지역 | 한국 관광지, 서울 가볼 만한 곳, 제주 관광지 | 관광 홈·지역·명소 상세 |
| 관광 / Google | 영어 일반 | South Korea attractions, Korea points of interest | `/en` |
| 관광 / Google | 영어 지역 | places to visit in Seoul, where to visit in Jeju, things to do in Busan | 해당 `/en/regions/{code}` |
| 관광 / Google | 영어 개별 명소·방문 정보 | Gyeongbokgung Palace opening hours, Haeundae Beach directions | 실제 영문 명소 상세 |

`South Korea travel`은 넓은 여행 정보 의도도 포함하므로 현재 관광지 탐색 서비스와 맞는 검색어부터 검증한다. 한국에 체류 중인 외국인의 영어 검색도 고려해 영어 페이지를 미국 사용자 전용으로 제한하지 않는다. 기본 언어 연결은 `en`이다.

## 진행 순서

1. **이번 유지보수:** 기존 ko/en 홈·지역 소개를 완전한 본문으로 분리하고 SSR·런타임을 일치시킨다. 서울·제주·부산에 방문지를 고르는 짧은 안내를 제공한다. 상세: `docs/specs/2026-10-12-place-ko-en-discovery/spec.md`.
2. **콘솔·검색 기준선 갱신:** 조회 승인을 받고 12개 직접 검색과 Google 서비스별 색인·영문 관광 실적·국가·대표 URL을 확인했다. 최신 게임 색인 14·관광 83, 영문 홈 미색인·서울 과거 Soft 404가 남아 있다. 네이버 콘솔은 로그인 화면으로 전환돼 인증 조작 없이 중단했다. 세부 범위·기간·한계는 `docs/specs/2026-10-12-place-ko-en-discovery/search-audit.md`에 기록했다.
3. **영문 편집 콘텐츠:** 기존 가이드 시스템의 영문 확장과 검수된 실용 가이드 1개를 먼저 설계한다. 교통·요금·휴무는 실제 확인한 정보만 쓰며 데이터 없음은 무료·상시 운영으로 바꾸지 않는다. 초안은 noindex를 유지한다. 구현·게시 범위는 별도 설계 후 확정한다.
4. **효과 평가:** 배포일 이후 같은 기간 길이로 ko/en URL의 노출·클릭·검색어·국가를 비교한다. 표본 부족과 재수집 지연을 표시하고, 테스트 통과나 색인 가능 판정을 순위 상승으로 보고하지 않는다.

운영 배포와 콘솔 제출은 각각 검토 가능한 결과 및 사용자 승인 범위에 따라 진행한다. 커뮤니티 게시·대외 메시지 전송은 포함하지 않는다.

## 공식 근거

Google은 본문으로 언어를 판단하며 언어별 URL과 언어 전환 링크를 권고한다. 메뉴만 번역한 페이지보다 실제 본문 언어가 중요하다. [다국어 사이트 안내](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)

hreflang은 적절한 언어 버전을 연결한다. 각각 자기 자신과 대체 버전을 포함하고 서로 돌아오는 링크가 있어야 한다. [현지화 페이지 안내](https://developers.google.com/search/docs/specialty/international/localized-versions)

공통 수집·콘텐츠 보완은 두 검색엔진에 도움이 될 수 있지만 순위는 각각 평가된다. [Google SEO 기본 가이드](https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=ko), [네이버 콘텐츠 가이드](https://searchadvisor.naver.com/guide/content-basic)
