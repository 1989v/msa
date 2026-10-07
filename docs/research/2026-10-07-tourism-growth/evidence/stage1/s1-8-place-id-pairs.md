측정 시각(KST): 2026-10-08T04:13:23.565365+09:00 ~ 2026-10-08T04:23:30.346751+09:00 | 도구: Python 3.14.6 urllib.request / html.parser / stdlib | 표본: en 300·ko 300·수동 30쌍(HTML 57개) | 명령: `python3 docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-collect.py; python3 - (동일 ID 재시도·HTML 수집·수동 판정 집계; 도구 실행 기록 참조)`

# S1-8 — googlePlaceId 보유율과 ko/en 언어 대체 짝 후보

영문 googlePlaceId 보유율은 **85/300(28.3%)**, 국문은 **205/300(68.3%)**였다. placeId는 후보 키이며 장소 범위 동일성을 보장하지 않는다. `placeId + 50m + category`가 모두 같아도 관광특구와 놀이공원, 같은 아울렛의 다른 브랜드가 연결됐다. 제목 일치·후보 중복 배제를 추가한 선별 후보는 **25/300(8.3%)**다. **「추정」** 현재 sitemap 영문 모집단의 선별 후보 비율을 약 8.3%로 추정할 수 있으나, 안전하게 자동 적용할 수 있는 최종 비율은 **「미확인」**이다.

## 1. 측정 방법과 접근 범위

- 공개 [sitemap index](https://place.1989v.com/sitemap.xml) 및 자식 6개를 읽었다. hub 541 URL은 상세 표본에서 제외하고, 일반 상세 sitemap 4개와 행사 sitemap의 상세 경로를 포함했다. 중복 제거 후 국문 46,980 URL, 영문 15,086 URL.
- `/attractions/{id}`와 `/en/attractions/{id}`만 사용. 언어별 URL을 사전식 정렬하고 독립 `random.Random(20261007).sample(urls, 300)`로 추출. 표본 URL·ID는 JSON에 보존. 두 언어 표본은 서로 짝지어 뽑은 표본이 아니다.
- 상세는 `https://api.1989v.com/api/search/attractions/{id}`의 `data.googlePlaceId`를 실제 응답에서 확인했다. 빈 값은 미보유로 판정. 첫 조회의 영문 TLS 오류 11건은 같은 ID만 재시도하여 전부 회복했다. 교체·탈락 없이 각 300건 모두 실제 lang 일치.
- 영문 `titleLocal`은 295/300건. 빈 5건은 제목 검색을 생략하되 매칭률 분모 300에 포함. 제목 비교는 NFKC·공백 제거·casefold만 적용하며 브랜드·분점·시설명 수식어를 지우지 않았다.
- 좌표는 Haversine 거리(지구 반경 6,371,008.8m)로 계산. 양쪽 좌표가 유효할 때 50m 이하를 통과. 영문 300건에 좌표 결측·0 좌표 없음. 분류는 응답 `category`의 비어 있지 않은 값이 같은 경우이며, 원천 세부 분류의 동일성은 확인하지 않았다.
- 총 공개 HTTP 요청 **1,276건**: 사전 확인 11, 본수집 1,175, 같은 ID 재시도 및 검색 33, HTML 57. 본수집 요청 시작 간격 0.27초·최대 동시 4개, 기록상 어느 1초 구간에도 최대 4건. 사전 확인·재시도·HTML은 순차 호출(0.25~0.3초 간격). 일반 Chrome UA를 사용했다.
- headless Chrome을 띄우지 않았다. 브라우저·MCP 프로필 접근, kubectl·ssh·DB·사내 도구 접근, 로컬 코드 수정 및 git 변경 명령은 수행하지 않았다. 코드 확인은 `git ls-tree origin/main`과 `git show origin/main:<path>`만 사용했다.

### 검색 파라미터 관측: `q`와 `keyword`는 다름

사용자가 지정한 `?lang=ko&q=<titleLocal>&size=5`는 295개 검색어 모두 ID `1,6,8,9,12`를 반환했다. 존재하지 않는 문자열도 같은 5건을 반환했고 `totalElements=10000`이었다. 이 호출 결과의 placeId·50m·제목 매칭은 모두 0/300이다. 이를 실제 짝 부재로 해석하면 안 된다. [q 예시](https://api.1989v.com/api/search/attractions?lang=ko&q=%EA%B2%BD%EB%B3%B5%EA%B6%81&size=5).

같은 공개 API의 `keyword`를 사용하면 경복궁 검색의 `totalElements=265`와 검색어에 따른 결과가 나왔다. 따라서 지정 `q` 호출도 보존하고, 아래 짝 탐색은 `keyword=<titleLocal>`로 보정한 결과를 별도 집계했다. [keyword 예시](https://api.1989v.com/api/search/attractions?lang=ko&keyword=%EA%B2%BD%EB%B3%B5%EA%B6%81&size=5). `origin/main`의 `search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt`에도 목록 검색 파라미터가 `keyword`로 선언되어 있다. 배포 버전과 git 커밋 동일성은 「미확인」이다.

## 2. googlePlaceId 보유율 — 사실

| 언어 | 응답·언어 확인 | 필드 존재 | 값 보유 | null | 보유율 |
|---|---:|---:|---:|---:|---:|
| en | 300/300 | 300 | 85 | 215 | 28.3% |
| ko | 300/300 | 300 | 205 | 95 | 68.3% |

「추정」 현재 sitemap 모집단의 보유율에 대한 95% Wilson 구간은 en 23.5~33.7%, ko 62.9~73.3%. 무작위 URL 표본을 전제로 한 표본오차이며 데이터 갱신·검색 인덱스 시차는 포함하지 않는다. 영문 표본의 shopping이 212/300이고 이 중 보유는 8/212인 반면 국문 shopping은 82/300이며 보유는 82/82였다. 언어별 원천 구성 차이와 함께 읽어야 하며, 언어가 누락의 원인이라고 단정할 수 없다.

## 3. 기준별 짝 후보 매칭률 — 사실

국문 상위 5개 중 하나라도 기준에 맞는 영문 **문서 수**를 분자로 센다. 한 영문에 여러 국문 후보가 붙을 수 있어 후보 쌍 수는 문서 수보다 크다. 후보 합집합은 세 기준 중 하나라도 통과한 경우이며 hreflang 승인 목록이 아니다. 모든 분모는 영문 표본 300개.

| 기준 | 영문 문서 수/300 | 매칭률 | 후보 쌍 수 |
|---|---:|---:|---:|
| 비어 있지 않은 googlePlaceId 일치 | 49/300 | 16.3% | 60 |
| 좌표 50m 이내 | 232/300 | 77.3% | 387 |
| titleLocal ↔ 국문 title 일치 | 265/300 | 88.3% | 266 |
| 세 기준 OR — 짝 후보 합집합 | 270/300 | 90.0% | 433 |
| placeId + 50m + category 모두 일치 | 35/300 | 11.7% | 41 |
| 위 조건 + 제목 일치 | 32/300 | 10.7% | 32 |
| 위 조건 + 상위 5개 내 placeId 일치 후보가 정확히 1개 | 25/300 | 8.3% | 25 |

검색을 실제 수행한 295개를 분모로 하면 placeId 49/295(16.6%), 좌표 232/295(78.6%), 제목 265/295(89.8%)다. placeId 보유 영문만 보면 일치 후보 발견은 49/85(57.6%)다. 상위 5개 밖 후보나 titleLocal 없는 문서의 좌표 역탐색은 실시하지 않아 **짝의 전수 보유율·검색 재현율은 「미확인」**이다.

## 4. 30쌍 직접 비교 — 판정은 분석자의 해석

엄격 조건(placeId·50m·분류·제목) 통과 32쌍에서 ID 정렬 후 시드 20261008로 15쌍 무작위 추출, placeId 충돌·범위 위험 사례 10쌍 의도 추출, placeId가 없는 기타 후보에서 같은 시드로 5쌍 무작위 추출했다. **30쌍은 27개 영문 문서·30개 국문 문서(총 HTML 57개)**에 해당한다. 모두 HTTP 200, 언어는 각 경로와 일치, 자기 URL canonical 존재, 정적 HTML의 alternate/hreflang 링크는 0개였다. JS 실행 후 변화는 「미확인」이다.

분석자 판정: **같은 범위의 언어 대체 페이지 19쌍 / 범위 다름 10쌍 / 판단 불가 1쌍**. 위험 사례를 의도적으로 포함했으므로 19/30을 전체 후보의 적합률로 적용하지 않는다. 엄격 조건 무작위 15쌍은 15쌍 모두 같은 범위로 판정했으나, 나머지 17쌍의 범위는 「미확인」이다.

다음 표의 좌표 비교는 API의 원 좌표에서 계산한 거리이며, 양쪽 원 좌표·주소 전문·googlePlaceId는 JSON `manual_review`에 함께 보존했다.

| # | 영문 ↔ 국문 페이지·제목 | 거리(m) | category en/ko | 주소 비교 | 판정 | 근거 |
|---:|---|---:|---|---|---|---|
| 1 | [Amore Seongsu](https://place.1989v.com/en/attractions/14815) ↔ [아모레 성수](https://place.1989v.com/attractions/10381) | 0.0 | leisure/leisure | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 두 본문 모두 자동차 정비소를 개조한 아모레 체험 매장. 주소 일치. 주차 가능/불가 정보 차이는 별도 품질 문제. |
| 2 | [Hwang Nyong Won](https://place.1989v.com/en/attractions/2180) ↔ [황룡원](https://place.1989v.com/attractions/5337) | 5.6 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 같은 구층탑 양식 건축물·명상 연수원. 경주 엑스포로 40 일치. |
| 3 | [Kansong House](https://place.1989v.com/en/attractions/14206) ↔ [간송옛집](https://place.1989v.com/attractions/7935) | 6.1 | history/history | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 같은 전형필의 옛집·묘소와 재실 역사. 시루봉로 149-18 일치. |
| 4 | [Gohado Marine Theme Park](https://place.1989v.com/en/attractions/13645) ↔ [고하도 해상테마파크](https://place.1989v.com/attractions/4085) | 0.0 | nature/nature | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 고하도 관광단지의 전망대·해안데크 등 복합 시설을 다룸. |
| 5 | [Dogapsa Temple](https://place.1989v.com/en/attractions/2325) ↔ [도갑사](https://place.1989v.com/attractions/3456) | 4.5 | history/history | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 도갑사 사찰과 해탈문·문화재를 포함한 사찰 전체 소개. |
| 6 | [Culture Station Seoul 284](https://place.1989v.com/en/attractions/13698) ↔ [문화역 서울 284](https://place.1989v.com/attractions/8647) | 6.7 | leisure/leisure | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 복원한 구 서울역사의 전시·공연 복합문화공간. |
| 7 | [Neungpohang Port](https://place.1989v.com/en/attractions/2194) ↔ [능포항](https://place.1989v.com/attractions/6776) | 4.6 | nature/nature | 능포동 ↔ 능포동 480-42 | 같은 범위의 언어 대체 페이지 | 양쪽 모두 능포항 전체와 1.7km 항구·수산/관광 기능 소개. 영문 주소는 동까지만 표기. |
| 8 | [Yeonhwajeong Library](https://place.1989v.com/en/attractions/18192) ↔ [연화정 도서관](https://place.1989v.com/attractions/15369) | 5.1 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 덕진공원 내 연화정 한옥 도서관과 연결 누각 소개. |
| 9 | [National Center for Forest Therapy](https://place.1989v.com/en/attractions/13515) ↔ [국립산림치유원](https://place.1989v.com/attractions/5318) | 0.0 | nature/nature | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 영주 국립산림치유원 전체와 치유숲길·숙박시설 소개. |
| 10 | [Gunsan Modern Art Museum](https://place.1989v.com/en/attractions/13853) ↔ [군산근대미술관](https://place.1989v.com/attractions/11343) | 5.2 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 옛 일본 제18은행 군산지점을 개조한 근대미술관 본관·금고동 소개. |
| 11 | [Pencil Museum](https://place.1989v.com/en/attractions/18161) ↔ [연필뮤지엄](https://place.1989v.com/attractions/16711) | 6.4 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 동해 연필박물관과 3,000여 연필·4층 카페를 소개. |
| 12 | [Daegu Art Museum](https://place.1989v.com/en/attractions/18206) ↔ [대구미술관](https://place.1989v.com/attractions/17689) | 7.5 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 대구 시립미술관과 전시·교육·3층 미술정보센터 소개. |
| 13 | [Busan Gwangandaegyo Bridge](https://place.1989v.com/en/attractions/14200) ↔ [부산광안대교](https://place.1989v.com/attractions/13062) | 0.0 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 7.4km 광안대교 전체 및 조명·주변 경관 소개. |
| 14 | [Geoje Gyedo Fishing Village](https://place.1989v.com/en/attractions/2220) ↔ [거제 계도어촌체험마을](https://place.1989v.com/attractions/10334) | 0.0 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 계도어촌체험마을의 바다낚시 등 체험 프로그램 소개. |
| 15 | [Brentwood - MODA Outlet Incheon Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/34965) ↔ [브렌우드 모다아울렛 인천점](https://place.1989v.com/attractions/22911) | 0.0 | shopping/shopping | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 BRENTWOOD 남성복 브랜드의 같은 아울렛 지점·2층. |
| 16 | [Yeonginsan Recreational Forest](https://place.1989v.com/en/attractions/15093) ↔ [아산 영인산자연휴양림](https://place.1989v.com/attractions/1015) | 0.0 | nature/nature | 일치(도로명·번지) | 판단 불가 | 영문 제목·본문은 휴양림 전체이나 titleLocal은 숲속야영장. 국문은 휴양림 전체여서 문서 내부 범위 충돌을 해소하지 못함. |
| 17 | [Yeonginsan Recreational Forest](https://place.1989v.com/en/attractions/15093) ↔ [영인산자연휴양림 스카이어드벤처](https://place.1989v.com/attractions/19627) | 69.7 | nature/leisure | 일치(도로명·번지) | 범위 다름 | 영문은 휴양림·숙박·물놀이 전체, 국문은 그 안의 약 630m 짚라인 시설. |
| 18 | [Dodamsambong Peaks](https://place.1989v.com/en/attractions/2059) ↔ [도담삼봉 모터보트](https://place.1989v.com/attractions/20783) | 273.1 | nature/leisure | 삼봉로 644 ↔ 644-13 | 범위 다름 | 영문은 남한강 세 기암 및 관광구역 소개, 국문은 별도 운영하는 약 10분 모터보트 코스. |
| 19 | [Wolmi Zzang Land (Wolmi Theme Park)](https://place.1989v.com/en/attractions/1676) ↔ [월미 관광특구](https://place.1989v.com/attractions/160) | 32.0 | nature/nature | 일치(도로명·번지) | 범위 다름 | 영문은 13,200㎡ 놀이시설 월미짱랜드, 국문은 카페·숙박·차이나타운·근대유산까지 포함한 관광특구. |
| 20 | [Levi’s Jeans MODA Outlet Incheon Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/34929) ↔ [레베끌레 모다아울렛 인천점](https://place.1989v.com/attractions/22869) | 0.0 | shopping/shopping | 일치(도로명·번지); 국문 층 누락/차이 | 범위 다름 | 영문 Levi’s 데님 매장, 국문 레베끌레 주니어웨어 매장. 같은 건물의 다른 브랜드. |
| 21 | [List - MODA Outlet Incheon Branch [Tax Refund Shop]  (리스트 모다아울렛 인천점)](https://place.1989v.com/en/attractions/34887) ↔ [린 모다아울렛 인천점](https://place.1989v.com/attractions/22857) | 0.0 | shopping/shopping | 일치(도로명·번지); 국문 층 누락/차이 | 범위 다름 | 영문 LIST 매장, 국문 LYNN 여성복 매장. 같은 건물의 다른 브랜드. |
| 22 | [Brentwood - MODA Outlet Incheon Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/34965) ↔ [링스 모다아울렛 인천점](https://place.1989v.com/attractions/22851) | 0.0 | shopping/shopping | 일치(도로명·번지); 국문 층 누락/차이 | 범위 다름 | 영문 BRENTWOOD 남성복, 국문 LYNX 골프웨어. 같은 건물의 다른 브랜드. |
| 23 | [Dangjin Sapgyoho Lake](https://place.1989v.com/en/attractions/14608) ↔ [삽교호놀이동산](https://place.1989v.com/attractions/9095) | 215.4 | nature/nature | 삽교천3길 100 ↔ 15 | 범위 다름 | 영문은 삽교호 관광지 전체와 함상공원·과학관·놀이동산, 국문은 놀이기구 시설만 소개. |
| 24 | [Gohado Marine Theme Park](https://place.1989v.com/en/attractions/13645) ↔ [고하도 전망대](https://place.1989v.com/attractions/2477) | 4.4 | nature/culture | 일치(도로명·번지) | 범위 다름 | 영문은 고하도 복합 관광단지, 국문은 그 안의 5층 전망대 건물만 소개. |
| 25 | [Kangwon Land Casino](https://place.1989v.com/en/attractions/22453) ↔ [강원랜드 카지노](https://place.1989v.com/attractions/19751) | 6.3 | leisure/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 두 문서 모두 강원랜드 카지노 자체. category leisure/culture 및 개장연도 서술 차이는 있으나 대상 범위는 같음. |
| 26 | [Ferragamo - Hyundai Department Store Ulsan Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/38412) ↔ [페라가모 현대백화점 울산점](https://place.1989v.com/attractions/25698) | 0.0 | shopping/shopping | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 Ferragamo의 현대백화점 울산점 1층. placeId가 없어도 대상은 같음. |
| 27 | [Hadong Tea Museum](https://place.1989v.com/en/attractions/18066) ↔ [하동야생차박물관](https://place.1989v.com/attractions/16043) | 0.0 | culture/culture | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 하동야생차박물관의 전시·차 체험. 주소·요금·시간표도 대응. |
| 28 | [Kiton Shinsegae Simon Premium Outlet Yeoju Branch[Tax Refund Shop]](https://place.1989v.com/en/attractions/40604) ↔ [오프라벨 신세계사이먼프리미엄아울렛 여주점](https://place.1989v.com/attractions/27494) | 0.0 | shopping/shopping | 일치(도로명·번지) | 범위 다름 | 영문 Kiton 남성 수트, 국문 오프라벨 아동복. 같은 아울렛의 다른 브랜드. |
| 29 | [Zen - Mario Outlet Building 1 Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/37669) ↔ [젠 마리오아울렛 1관점](https://place.1989v.com/attractions/23352) | 5.7 | shopping/shopping | 일치(도로명·번지) | 같은 범위의 언어 대체 페이지 | 양쪽 모두 ZEN의 마리오아울렛 1관 4층 지점. placeId는 없음. |
| 30 | [Andar - Shinsegae Simon Premium Outlet Jeju Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/36250) ↔ [산드로 신세계사이먼프리미엄아울렛 제주점](https://place.1989v.com/attractions/28383) | 0.0 | shopping/shopping | 일치(도로명·번지) | 범위 다름 | 영문 Andar 애슬레저, 국문 Sandro 프랑스 패션. 같은 아울렛 B1층의 다른 브랜드. |

### 범위 다름의 구체 사례 — placeId 일치만으로도 실패

- **#17 [Yeonginsan Recreational Forest](https://place.1989v.com/en/attractions/15093) ↔ [영인산자연휴양림 스카이어드벤처](https://place.1989v.com/attractions/19627)**: 영문은 휴양림·숙박·물놀이 전체, 국문은 그 안의 약 630m 짚라인 시설. 양쪽 placeId는 `ChIJryxvhHTgejURxdeh2z5QxYY`로 동일. 거리 69.7m, category `nature`/`leisure`. 영문 주소 `16-26, Asanoncheon-ro, Asan-si, Chungcheongnam-do`, 국문 주소 `충청남도 아산시 영인면 아산온천로 16-26`.
- **#18 [Dodamsambong Peaks](https://place.1989v.com/en/attractions/2059) ↔ [도담삼봉 모터보트](https://place.1989v.com/attractions/20783)**: 영문은 남한강 세 기암 및 관광구역 소개, 국문은 별도 운영하는 약 10분 모터보트 코스. 양쪽 placeId는 `ChIJ1_YpO5H0YzURW2e6XPn6qiA`로 동일. 거리 273.1m, category `nature`/`leisure`. 영문 주소 `644 Sambong-ro, Maepo-eup, Danyang-gun, Chungcheongbuk-do`, 국문 주소 `충청북도 단양군 매포읍 삼봉로 644-13`.
- **#19 [Wolmi Zzang Land (Wolmi Theme Park)](https://place.1989v.com/en/attractions/1676) ↔ [월미 관광특구](https://place.1989v.com/attractions/160)**: 영문은 13,200㎡ 놀이시설 월미짱랜드, 국문은 카페·숙박·차이나타운·근대유산까지 포함한 관광특구. 양쪽 placeId는 `ChIJ_99FToiCezURBfrQIL7RhFE`로 동일. 거리 32.0m, category `nature`/`nature`. 영문 주소 `81 Wolmimunhwa-ro, Jemulpo-gu, Incheon`, 국문 주소 `인천광역시 제물포구 월미문화로 81 (북성동1가)`.
- **#20 [Levi’s Jeans MODA Outlet Incheon Branch [Tax Refund Shop]](https://place.1989v.com/en/attractions/34929) ↔ [레베끌레 모다아울렛 인천점](https://place.1989v.com/attractions/22869)**: 영문 Levi’s 데님 매장, 국문 레베끌레 주니어웨어 매장. 같은 건물의 다른 브랜드. 양쪽 placeId는 `ChIJVT-MrBh_ezURfROwguY1N0M`로 동일. 거리 0.0m, category `shopping`/`shopping`. 영문 주소 `3F, 50, Bukhang-ro 32beonan-gil, Seohae-gu, Incheon`, 국문 주소 `인천광역시 서해구 북항로32번안길 50 (원창동)`.
- **#24 [Gohado Marine Theme Park](https://place.1989v.com/en/attractions/13645) ↔ [고하도 전망대](https://place.1989v.com/attractions/2477)**: 영문은 고하도 복합 관광단지, 국문은 그 안의 5층 전망대 건물만 소개. 양쪽 placeId는 `ChIJKzlsWYKlczURp8jmZUJJNBw`로 동일. 거리 4.4m, category `nature`/`culture`. 영문 주소 `234 Gohadoan-gil, Mokpo-si, Jeonnam-Gwangju Special Metropolitan City`, 국문 주소 `전남광주통합특별시 목포시 고하도안길 234 (달동)`.

특히 #19·#20·#21·#22는 **placeId + 50m + category 세 조건을 모두 통과하는 범위 불일치 반례**다. #16은 동일 조건을 통과하지만 영문 내부의 `titleLocal=아산 영인산자연휴양림 숲속야영장`과 전체 휴양림 본문이 충돌하여 판단 불가다. 세 조건을 통과한 수동 검토 20쌍 중 15쌍 같은 범위·4쌍 범위 다름·1쌍 판단 불가였으며, 이 역시 의도 표본의 결과다.

## 5. hreflang 자동 적용 조건 제안과 비율 — 추정·미확인 분리

**제안(추정): 자동 후보 생성과 실제 태그 적용을 분리한다.** 다음은 후보 생성 조건이다.

1. 양쪽 실제 응답 lang이 en/ko이고 비어 있지 않은 `googlePlaceId`가 같다.
2. 유효 좌표 거리 ≤50m, 비어 있지 않은 `category`가 같다.
3. 영문 `titleLocal`과 국문 `title`이 보수적 정규화 후 일치한다. 브랜드·분관·지점·층·하위 시설 수식어의 충돌은 배제한다.
4. 검색 상위 5개 내 placeId 일치 국문 후보가 정확히 1개다. 이는 전역 유일성 검증을 대신하지 못하므로 충돌 발견 시 수동 확인한다.

이 조건의 **관측 선별율은 25/300(8.3%)**, 「추정」 현재 sitemap 영문 모집단의 선별 후보율 약 **8.3%**(95% Wilson 5.7~12.0%). 참고로 제목까지 일치한 넓은 선별은 32/300(10.7%, 추정 구간 7.7~14.7%), 제목 없이 세 조건만 쓴 선별은 35/300(11.7%)이나 실측 반례 때문에 자동 적용 조건으로 충분하지 않다.

**실제 자동 태그 적용 제안:** 위 조건 통과 후에도 두 문서가 같은 대상·같은 시설 범위를 다룬다는 검토를 거쳐 승인된 en↔ko 엔터티 매핑에만 적용한다. 알려진 placeId 충돌을 배제하고 상호 역매핑의 일대일성, 양쪽 HTTP 200·언어 본문·자기 canonical을 확인한다. 승인된 매핑에 대해 상호 en/ko alternate를 생성하는 방식이다. 이 작업에서 그러한 엔터티 매핑 전체를 확정하거나 태그를 변경하지 않았다.

수동 검토한 보수 선별 후보 11쌍은 모두 같은 범위로 판정했고 공개 HTML 검사도 통과했다. 미검토 후보를 포함한 **최종 자동 적용 가능 비율·오연결률은 「미확인」**이며, 8.3%는 후보 수량의 추정이다. 같은 시설인데 category가 다른 #25(카지노), placeId 없이도 대체 관계가 확인되는 #26·#27·#29는 수동 매핑 경로로 구제할 수 있다. 반대로 긴 항구·해변·트레일의 좌표 차이는 대표점 차이일 수 있어 50m 탈락을 장소 불일치로 단정하지 않는다.

## 6. 산출물·한계

- 최종 짝 후보 및 판정 JSON (`s1-8-place-id-pairs.json`, 10~14MB 원시 덤프, 레포 밖 스크래치패드 raw-archive/ 보관): 언어별 300 표본, 영문별 상위 5 후보, q/keyword 분리, 기준별 boolean·거리·수동 근거.
- 최초 수집 원본 (`s1-8-place-id-pairs-raw.json`, 10~14MB 원시 덤프, 레포 밖 스크래치패드 raw-archive/ 보관), 같은 ID 재시도 병합 (`s1-8-place-id-pairs-recovered.json`, 10~14MB 원시 덤프, 레포 밖 스크래치패드 raw-archive/ 보관): 응답 핵심 필드, 모집단 URL, 요청 시간·HTTP 상태·실패 로그. 최초 수집에는 응답 본문 SHA-256도 저장.
- [공개 HTML 57개 증거](s1-8-review-pages.json): 읽은 본문 텍스트·metadata·HTTP 상태·SHA-256 및 30쌍 선택 목록. 브라우저 렌더링 화면 비교는 수행하지 않았으며 공개 SSR 본문을 직접 읽어 판단.
- [본수집 재현 스크립트](s1-8-collect.py): 고정 시드와 요청 제한 포함. 이미 있는 raw 파일에 덮어쓰기하지 않는 `open("x")` 사용. 후속 재시도·HTML 수집·최종 판정은 도구 실행 기록의 `python3 -` 명령으로 수행.
- **「미확인」**: 상위 5개 밖 누락, 전역 placeId 유일성, 미검토 엄격 후보 17쌍, 실제 서비스 엔터티 원본·배포 커밋, 검색엔진의 hreflang 처리, JS 실행 이후 태그, 영인산 제목 내부 범위 충돌.
- 이번 측정은 실시간 운영 데이터의 한 시점이며 처음 수집과 재시도·HTML 수집의 시각이 다르다. Google 원문·제3자 지도는 조회하지 않았고 반환된 placeId의 정확성을 독립 검증하지 않았다.
