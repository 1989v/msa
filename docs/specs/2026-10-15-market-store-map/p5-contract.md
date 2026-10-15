# P5 계약 — 시장 검색 · 관광지 연동

공개 API (place, 게이트웨이 공개 GET, 로그인 불필요, ApiResponse<T>):

1. `GET /api/v1/place/markets/search?q=&lang=ko|en&page=0&size=20`
   - q 공백 제거 후 1자 이상이면: 판정상 시장 안(유효 소속 IN: judged_membership 우선, 없으면 membership, 보정 반영)인 가게 중 표시 이름·취급품목·업종(대/중/소)에 q 가 들어간 것. 정렬: 이름 일치 > 품목 일치 > 업종 일치, 같은 순위는 시장 이름·가게 이름 순.
   - q 가 비면 stores 는 빈 목록, markets 는 시장 지도 데이터가 있는 시장 전체(가게 수 내림차순, 페이지).
   - 응답:
     { "query": "떡볶이",
       "markets": [ { "contentId": "128880", "name": "광명시장", "region": "경기 광명시", "marketType": "STREET", "storeCount": 153, "attraction": { "id": 4127, "lang": "ko" } } ],   // q 가 있으면 이름에 q 가 들어간 시장(최대 10)
       "stores": { "items": [ { "storeId": 1, "name": "펭귄떡볶이", "items": "떡볶이, 튀김", "category": "분식", "marketContentId": "128880", "marketName": "광명시장", "zoneName": "오리로964번길", "latitude": 37.48, "longitude": 126.85, "attraction": { "id": 4127, "lang": "ko" } } ], "total": 12, "page": 0, "size": 20 } }
   - `attraction` 은 상세 페이지 주소용이다. 상세 경로는 contentId 가 아니라 **언어별 관광지 id** 를 받는다(경복궁 = `/attractions/1`). 요청 언어 행이 없으면 국문 행을 주고, 관광지 행이 없으면 null.
   - size 상한 50, q 길이 상한 50. 좌표는 null 가능(UNKNOWN). 상인회·운영자 보정 표시값 반영. 확인 필요 플래그·원천 raw 는 내지 않는다.
2. `GET /api/v1/place/markets/content-ids` → `["128880", ...]` 시장 지도 데이터(유효 IN 가게 1곳 이상 또는 경계)가 있는 관광지 contentId 목록. 응답 헤더 `Cache-Control: public, max-age=3600`.

화면 (portal-fe, place 호스트):
- 새 페이지 `/markets` (영문 `/en/markets`): 검색창(가게·품목), 결과 = 시장 묶음 + 가게 목록(가게 이름·품목·업종·시장 이름·골목). 결과 행 → `attraction.lang` 의 `/attractions/{attraction.id}?marketQuery=<q>#market` (`attraction` 이 null 이면 링크 없이 표시). q 가 비면 시장 목록(시장 이름·지역·가게 수) → `/attractions/{attraction.id}#market`. 검색은 화면 상태라 URL 은 `/markets` 하나(쿼리 문자열 `?q=` 는 공유용으로만 읽고 canonical 은 `/markets`).
- 관광지 상세: 시장 섹션 루트에 `id="market"`, `?marketQuery=` 가 있으면 시장 섹션의 가게 찾기 초기값으로 넣고 그 섹션으로 스크롤. 점프 내비가 있으면 시장 데이터가 있을 때 "시장 지도" 항목.
- 관광지 목록·카드(place 허브·지역·검색 결과에서 관광지 카드가 그려지는 곳): content-ids 에 든 관광지면 "시장 지도" 배지.
