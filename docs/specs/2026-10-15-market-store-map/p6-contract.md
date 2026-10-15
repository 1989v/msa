# P6 계약 — 시장 가게 가격대 (착한가격업소)

시장 가게에 행정안전부 「착한가격업소 현황」의 대표 메뉴·가격을 붙인다. 가게 단위 가격의 공식 원천은 이것뿐이다.

## 원천

| 항목 | 값 |
|---|---|
| 데이터셋 | 공공데이터포털 #3045247 「행정안전부_착한가격업소 현황」 (파일, 분기 갱신) |
| 받는 법 | `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003681743&fileDetailSn=1&insertDataPrcus=N` (2026-06-30 기준, 1,577,607 B, cp949 CSV). 키 없음. 발표마다 파일 ID 가 바뀐다 → ConfigMap `place-market-source-files` 의 `good-price-url` |
| 열(14) | 시도, 시군, 업종, 업소명, 연락처, 주소, 메뉴1, 가격1, 메뉴2, 가격2, 메뉴3, 가격3, 메뉴4, 가격4 |
| 라이선스 | 이용허락범위 제한 없음. 화면에는 출처를 적는다: 「행정안전부 착한가격업소」 |
| 행 수 | 12,645 (2026-06-30) |

## 매칭 (적재 잡, `market_stores.py`)

같은 시장에 대해 이미 만든 가게 행(`prepare` 결과)과 맞춘다. 한 착한가격업소는 최대 한 가게에, 한 가게는 최대 한 착한가격업소에 붙는다.

1. **NAME(도로명까지 같음)**: 정규화한 이름(영문 소문자·숫자·한글만)과 시군구(주소 앞 두 어절)가 같고 도로명+건물번호도 같다. 이 단계를 전부 끝낸 뒤 다음 단계로 간다 — 원천이 한 가게를 도로명 행·지번 행·이웃 시장 목록으로 여러 번 싣기 때문이다.
2. **NAME**: 이름·시군구가 같고, 양쪽에 있는 도로명+건물번호와 법정동은 같아야 한다(한쪽에 없으면 따지지 않는다). 같은 구의 다른 지점이 붙지 않게 하는 조건이다.
3. **ROAD**: 같은 이름 업소가 아예 없을 때만. 도로명+건물번호와 시군구가 같고 정규화한 이름 하나가 다른 하나를 포함한다(2자 이상).
4. 후보가 둘 이상이면 붙이지 않는다(모호). 이미 다른 가게에 붙은 업소는 후보에서 뺀다.

도로명은 「중앙로 200번길」과 「중앙로200번길」을 같게 본다(번길·길 앞 띄어쓰기 제거).

실측(2026-10-15, 착한가격업소 12,645행 × 온누리 가맹점 106,301행): NAME 136, ROAD 12, 104개 시장, 모호 0, 도로명이 어긋난 NAME 0. 원천 파일 인코딩은 cp949 다.

## 적재 계약 (`PUT /internal/markets` 의 가게 행에 필드 추가)

```json
{ "goodPriceKey": "<sha 키: 시도|시군|업소명|주소>",
  "goodPriceRaw": "{원본 14열 JSON, 빈 값 포함}",
  "goodPriceMatchedBy": "NAME" | "ROAD" }
```

- 매칭이 없으면 세 필드 모두 null. **전체 동기화**라 다음 적재에서 매칭이 빠지면 null 로 지운다(원천에서 지정 취소된 업소).
- 가공(메뉴 목록)은 원본을 덮지 않는다. place 가 원본에서 읽어 만든다.

## 저장 (place, Flyway V39)

`market_store` 에 열 추가:

| 열 | 타입 | 뜻 |
|---|---|---|
| `good_price_key` | VARCHAR(64) NULL | 원천 키 |
| `good_price_raw` | TEXT NULL | 원본 14열 JSON |
| `good_price_matched_by` | VARCHAR(16) NULL | `NAME` / `ROAD` |
| `good_price_menu_names` | VARCHAR(500) NULL | **파생**: 메뉴 이름을 ` · ` 로 이은 것(검색용). 적재 때 원본에서 만든다 |

## 도메인

`GoodPriceMenu(name: String, price: Int?)` — 원본의 메뉴n/가격n 쌍에서 메뉴가 빈 것은 버린다. 가격은 숫자만 남겨 정수로, 못 읽으면 null.

## 공개 API

`GET /api/v1/place/markets/{contentId}` 응답:

- 가게마다 `goodPrice`: `null` 또는
  ```json
  { "category": "한식", "menus": [ { "name": "칼국수", "price": 5000 } ], "matchedBy": "NAME" }
  ```
  보정(override)으로 가게가 시장 밖이 되면 다른 필드처럼 따라간다(가게 단위 표시라 별도 규칙 없음).
- 시장에 `goodPrice`: 시장 안(IN) 가게 중 착한가격 가게가 1곳 이상이면
  ```json
  { "storeCount": 2, "minPrice": 5000, "maxPrice": 6000,
    "attribution": { "name": "행정안전부 착한가격업소", "url": "https://www.data.go.kr/data/3045247/fileData.do", "license": "이용허락범위 제한 없음" } }
  ```
  없으면 null. 가격 범위는 IN 가게 메뉴 가격(null 제외)의 최소·최대.

`GET /api/v1/place/markets/search`:

- 매칭 대상에 `good_price_menu_names` 를 더한다. 순위: 이름 0 > 품목 1 > **메뉴 2** > 업종 3.
- `stores.items[]` 에 `goodPrice`(위와 같은 모양, `matchedBy` 제외)를 더한다.

## 화면 (portal-fe)

- 시장 섹션 정보 줄에 「착한가격업소 N곳 · 5,000~6,000원」(영문 `Good-price shops N · ₩5,000–6,000`). 출처 링크를 같은 줄 끝에.
- 가게 목록 행: 착한가격 가게는 배지 「착한가격」(영문 `Good price`) + 메뉴 최대 2개 `칼국수 5,000원 · 수제비 6,000원`. 고른 가게 상세에는 메뉴 전부.
- 검색 결과 가게 행: 같은 배지 + 첫 메뉴와 가격.
- 가격 표기: `toLocaleString('ko-KR')` + `원` / 영문 `₩`.
- 색은 DESIGN.md 토큰만. 4조합(390·1280 × light·dark) CDP 실측.

## 문서

- `docs/architecture/data-sources.md` 원천 대장에 행 추가(출처·라이선스·키 불필요·받는 법·갱신 주기).
