<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/RegionPage.tsx -->
# 관광 홈·지역 소개의 한국어·영어 보완

## 범위와 근거

사용자는 관광 검색을 한국어와 Google 영어 검색에서 함께 잡기를 요청했다. 기존 영문 URL이 운영 중이며, 기존 CSV에서 영문 URL은 노출 44회·클릭 0회다. 1차는 기존 화면 본문 유지보수(L2)로 제한한다. 신규 영문 가이드·백엔드·데이터·언어 짝 스위치·색인 정책 변경은 포함하지 않는다.

기존 본문은 `placeHubMeta`·`regionMeta`의 155자 메타 설명을 재사용하거나 런타임의 별도 짧은 부제로 나온다. 본문용 공유 함수를 두어 자연스러운 완전한 문장과 짧은 사용 안내를 SSR·런타임에서 함께 제공한다. 키워드 반복이나 원천 개요문 재복사는 목적이 아니다.

## 확정된 본문

홈은 한 문단이다.

- ko: `한국 관광지 탐색에서 지역과 테마별로 가볼 만한 곳을 찾아보세요. 관광지 사진·주소·지도와 제공된 운영시간·방문 정보를 비교하고, 상세 페이지에서 가까운 역과 정류장을 확인할 수 있습니다.`
- en: `Find places to visit in South Korea by region and theme. Compare attraction photos, addresses, maps and available opening hours and visitor information, then check nearby stations and bus stops on each detail page.`

지역 기본 소개는 기존 `regionMeta` 설명의 **전체 문장**이다. 메타의 155자 제한은 유지하고, 본문은 제한 전에 공유 원본을 사용한다. 알 수 없는 수량을 0으로 표시하지 않는 기존 규칙을 보존한다.

SIDO 코드 11·50·26에는 다음 안내 한 문단을 추가한다. 명소별 휴무·요금·소요 시간·실제 보행 거리를 지어내지 않는다.

| 코드 | ko | en |
|---|---|---|
| 11 | 서울 여행은 궁궐·역사 명소, 박물관·문화 공간, 공원 등 관심 있는 테마부터 골라보세요. 자치구별 목록에서 방문지를 좁힌 뒤 상세 페이지의 운영시간과 가까운 역·정류장을 확인하면 이동 계획을 세우기 좋습니다. | For places to visit in Seoul, start with your interests: palaces and historic sites, museums and cultural spaces, or parks. Browse by district, then check the listed opening hours and nearby stations or bus stops to plan your stops. |
| 50 | 제주 가볼 만한 곳은 제주시와 서귀포시 목록으로 나누어 찾아보세요. 자연·역사·문화 등 테마와 위치를 함께 비교하고, 상세 페이지에 제공된 운영시간·휴무·주차 정보를 확인해 방문지를 골라보세요. | Find places to visit on Jeju Island through the Jeju-si and Seogwipo-si lists. Compare nature, history and cultural attractions by location, and check the opening hours, closed days and parking information available on each detail page. |
| 26 | 부산 여행은 해안·해수욕장과 역사·문화 공간 등 관심 있는 테마부터 골라보세요. 구·군별 목록에서 위치를 비교하고, 상세 페이지의 가까운 역·정류장과 제공된 방문 정보를 확인하면 동선을 정하기 좋습니다. | For things to do in Busan, explore coastal and beach attractions alongside historic and cultural places. Compare locations by district, then check nearby stations and bus stops and the available visitor information on each detail page. |

안내는 지역 코드와 SIDO 레벨을 확인한다. 다른 지역 및 SIGUNGU에 서울·제주·부산 안내를 오적용하지 않는다. 모든 지역의 원래 링크와 목록은 보존한다. 화면은 기존 문단 클래스만 사용하고 신규 디자인 요소·스타일을 추가하지 않는다. root DESIGN.md를 먼저 참조한다.

홈에서는 속성 랜딩 `preset`의 기존 설명을 유지한다. 일반 홈만 공유 소개를 사용한다. 런타임이 지역을 아직 받지 못한 경우 새 메타·오류 본문·noindex를 덮어쓰지 않는다.

## 검증 기준

- 한국어·영어 홈의 초기 HTML과 런타임 본문이 같은 공유 소개를 사용한다.
- 지역 소개에는 메타의 끝 생략 기호가 전파되지 않고 메타는 기존 길이 제한을 지킨다.
- ko/en × 서울·제주·부산 안내가 초기 HTML과 런타임에 있으며 다른 코드·SIGUNGU에는 없다.
- 단일 H1, 기존 canonical/hreflang/robots, 지역·관광지 링크, 속성 랜딩 경로를 유지한다.
- 생성 콘텐츠 처리 후 관련 Vitest, `npx tsc -b`, 변경 파일 lint·MJS 문법 검사, Vite 빌드, diff 검사를 수행한다. 필요한 실제 명령·출력을 기록한다.
- 컴퓨터 유즈 승인 없이 브라우저 렌더 검증을 실행하지 않는다. 초기 HTML·단위 검증만으로 실제 화면 검증 또는 검색 순위 상승을 주장하지 않는다.
- 구현·검증 담당은 명시적 gpt-6.1-sol worker 1명이다. 부모는 설계·증거·문서를 검토한다. 운영 배포는 결과를 보여주고 승인받은 뒤 진행한다.
