# P5 계약 — 시장 검색 · 관광지 연동

공개 API (place, 게이트웨이 공개 GET, 로그인 불필요, ApiResponse<T>):

1. `GET /api/v1/place/markets/search?q=&lang=ko|en&page=0&size=20`
   - q 공백 제거 후 1자 이상이면: 판정상 시장 안(유효 소속 IN: judged_membership 우선, 없으면 membership, 보정 반영)인 가게 중 표시 이름·취급품목·대표 메뉴·업종(대/중/소)에 q 가 들어간 것. 정렬: 이름 일치 > 품목 일치 > 메뉴 일치 > 업종 일치, 같은 순위는 시장 이름·가게 이름·가게 id 순.
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

검색용 파생 표 `market_store_search`:

| 열 | 내용 |
|---|---|
| store_id / market_id / partner_id | 정본 가게·시장·짝 가게 식별자. store_id 가 기본키, market_id 에 인덱스 |
| name / items | 이름 300자·품목 1,000자. 자기 보정 → 짝 보정 → 원천 표시값 |
| category_major / category_mid / category_sub | 각 100자. 자기 값이 없으면 짝의 분류 |
| menu_names | 500자. 자기 착한가격 원문이 있으면 자기 메뉴, 없으면 짝 메뉴 |

짝이 있는 상가 행은 제외하고, 유효 소속이 IN 인 정본만 저장한다. 소속은 자기 보정 → 짝 보정 →
자기 판정 → 자기 적재값 순이며 짝의 원천 소속은 물려받지 않는다. 원천 JSON·판정 근거·보정 이력은
원래 표에 보존하고 검색 표는 언제든 다시 만들 수 있다.

검색 필터·순위·쪽 나누기·건수는 이 좁은 표와 시장 표만 읽는다. 원문 JSON 이 붙은 넓은 가게 행은
선택된 쪽의 정본과 짝만 읽는다. 데이터가 메모리에 올라오기 전 첫 요청에서도 원문이 든 페이지를
전국 가게 수만큼 읽지 않게 하려는 구조다. V42 는 그대로 두고 V43 으로 검색 표를 추가한다.

적재는 원천 행 묶음과 짝 연결이 끝난 뒤, 편집은 수동 가게·보정·삭제·이력 복원이 끝난 뒤,
판정은 저장한 뒤 같은 트랜잭션에서 해당 시장 검색 행을 통째로 교체한다. 시장 행 잠금으로 교체를
직렬화한다. 기동 완료 시 검색 표가 비었고 시장이 있으면 백그라운드에서 시장별로 채운다.
한 시장이 실패해도 나머지를 계속 처리하고 시작·종료·성공·실패 건수를 로그에 남긴다.
