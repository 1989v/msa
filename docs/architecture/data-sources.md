# 원천 데이터 대장

플랫폼이 **외부에서 받아오는 모든 데이터**의 출처·라이선스·받는 방법을 한곳에 모은다.

지금까지 이 정보는 ADR·스펙·시드 README 에 흩어져 있었다. 흩어져 있으면 "이 값이 어디서
왔는지" 를 물었을 때 답할 수 없고, 라이선스 표기 의무를 지키고 있는지도 확인할 수 없다.

> **새 외부 데이터를 붙이면 여기에 줄을 추가한다.** 코드에만 있고 여기 없으면 없는 것과 같다.

---

## 0. 연동 규칙 — 원천이 준 것은 버리지 않는다

**새 외부 데이터를 붙일 때 이 세 줄을 먼저 지킨다.**

### ① 원천 필드는 전부 적재한다

응답에 있는 필드는 지금 화면에서 안 쓰더라도 **컬럼으로 남긴다.** 원천 호출은 대부분
일일 한도가 있는 자원이고, 나중에 필요해졌을 때 다시 받으려면 **그 한도를 다시 쓴다.**

> 실제로 겪은 값: TourAPI 의 `lclsSystm1~3`(신 분류)을 적재 시점에 `category` 한 글자로
> 태우고 버렸다. 분류 규칙 하나를 고치려고 **6만 건 재호출**이 필요했다 (2026-08-21).
> 함께 버려지고 있던 것: `contenttypeid`, `cpyrhtDivCd`(이미지 저작권 구분), `mlevel`,
> `zipcode`, `createdtime`, `firstimage2`.

### ② 가공은 파생 컬럼으로 따로 둔다

화면용 그루핑·정규화는 **원천 컬럼을 덮지 않고** 별도 컬럼에 쓴다
(예: `lcls_systm1~3` 원본 → `category` 파생, `title` 원본 → `title_display`/`title_local` 파생 —
꼬리 괄호 표기 분리, 규칙은 place:domain `AttractionTitle`). 그루핑 규칙이 바뀌면
**UPDATE 한 번**으로 끝나고, 판단이 틀렸을 때 되돌릴 근거가 DB 안에 남는다.

다른 원천에서 온 **보강 컬럼**도 같은 취급이다 — `overview`(TourAPI 상세 1콜),
`google_place_id`(Google Places, §7). TourAPI 목록 원천을 덮지 않는 별도 컬럼이고,
전체 동기화(`Attraction.syncFrom`)가 보존한다.

### ③ 전체 동기화 경로는 **왕복 양쪽**을 함께 갱신한다

bulk upsert 가 **전체 동기화**면(보내지 않은 필드를 null 로 덮는 방식), 컬럼을 추가할 때
그 경로의 필드 목록도 같이 고쳐야 한다. 안 그러면 **다음 배치가 매일 새 컬럼을 지운다.**

보강 배치가 "읽어서 → 되돌려 보내는" 모양이면 고칠 자리가 **둘**이다. 하나만 고치면 증상이
같다 — 매일 밤 조용히 null 이 된다.

| 방향 | 자리 | 빠뜨리면 |
|---|---|---|
| 보낼 때 | `place/ingest/src/backfill_overview.py` 의 `UPSERT_FIELDS` | 필드를 안 보내서 지워진다 |
| 읽을 때 | `AttractionResponse` (조회 응답 DTO) | **읽어오질 못해서** 보낼 수가 없다 |

> 실제로 겪은 값: `cat1~3` 은 `UPSERT_FIELDS` 에 있었지만 조회 응답에 없었다. 수집기는
> 보내려 했지만 애초에 못 읽었고, 그래서 매일 지워지고 있었다 (2026-08-21).

사람이 세 곳(요청 DTO·View·응답 DTO)을 매번 맞추는 건 실패한다. `AttractionDtoRoundTripTest`
가 "적재할 수 있는 필드는 전부 조회로 되읽을 수 있어야 한다"를 리플렉션으로 강제한다 —
같은 모양의 왕복 배치를 새로 만들면 이 테스트도 같이 복제한다.

---

## 1. 한눈에

| 데이터 | 원천 | 키 | 라이선스 | 적재 경로 |
|---|---|---|---|---|
| 관광지 | 한국관광공사 TourAPI 4.0 | 필요 | 공공누리 (출처표시) | `place/ingest --job=sync` |
| 관광지 개요 | TourAPI `detailCommon2` | 필요 | 〃 | `place/ingest --job=overview` (매일) |
| **행정구역(법정동)** | 행정안전부 행정표준코드관리시스템 | **불필요** | 공공누리 제1유형 | `place/ingest --job=admin-regions` |
| 세계 지명 계층 | GeoNames | 불필요 | **CC BY 4.0** | `tools/seed/place/normalize_regions.py` |
| POI(상가) | 소상공인시장진흥공단 상가(상권)정보 | 필요 | 이용허락범위 제한없음 | `tools/seed/place/normalize_pois.py` |
| 상품·영양 | 식약처 / 한국소비자원 참가격 | 필요 | 제한없음 / KOGL 제1유형 | `tools/seed/products/normalize.py` |
| 관광지 영상 | YouTube Data API v3 | 필요 | Google API 서비스 약관 | `place/ingest --job=links` (매시) |
| 관광지 후기 | 네이버 검색 API(블로그) | 필요 | 네이버 오픈API 이용약관 | 〃 |
| 지도 | Google Maps JavaScript API | 필요 | Google Maps Platform 약관 | 브라우저 직접 호출 |
| 구글 place_id | Google Places API (New) Text Search | 필요 | Google Maps Platform 약관 (**place_id 만 무기한 저장 허용**) | `place/ingest --job=google-places` |
| **주유소·유가** | 한국석유공사(오피넷) — **공공데이터포털 경유** | `DATA_GO_KR_KEY` **재사용** | 공공누리 (출처표시) | `ranking/ingest --job=gas-stations` (매일) |
| 자동차 경로 | Google Routes API | 필요 | Google Maps Platform 약관 | 서버 호출 (요청 시) |

**출처 표기 의무가 있는 것**: GeoNames(CC BY 4.0), TourAPI(공공누리), 참가격(KOGL 제1유형), **오피넷**.
화면 하단 또는 관련 페이지에 표기한다 — `place` 화면은 "출처: 한국관광공사 TourAPI",
`rank` 화면은 "출처: 한국석유공사 오피넷"(보드 행의 `source_label` 이 들고 다닌다).

---

## 2. 관광지 — 한국관광공사 TourAPI 4.0

| | |
|---|---|
| 원천 | `apis.data.go.kr/B551011` — `KorService2`(국문) / `EngService2`(영문) |
| 키 | `TOUR_API_KEY` (data.go.kr 활용신청). 클러스터는 Secret `place-ingest-secrets/tour-api-key` |
| 받는 것 | 이름·주소·좌표·이미지·전화·분류·법정동 코드 / 개요(별도 오퍼레이션) |
| 규모 | 59,573건 (ko 44,913 · en 14,660), 5개 분류 × 2개 언어 |

**국문과 영문은 contentId 체계가 달라 별도 레코드**다. 같은 장소라도 id 가 다르다
(경복궁 ko 126508 / en 264337). 그래서 hreflang 을 걸지 않는다.

**구 코드는 폐기 중이다.** `areaBasedList2` 를 areaCode 없이 부르면 응답의 `areacode`·`cat1~3`
이 100% 빈 문자열로 온다. 발급 화면에서도 `areaCode2`/`categoryCode2` 는 "미사용(삭제예정)".
**신체계(`lclsSystm1~3`, `lDongRegnCd`, `lDongSignguCd`)가 원본**이고 구 코드는 파생이다.

지역을 지정해 순회하면 areaCode 자체가 없는 레코드 **43%** 를 통째로 놓친다 — 무지정 페이징으로
전량을 받는다.

**세종은 법정동 코드가 5자리로 온다** (`lDongRegnCd`=`lDongSignguCd`=`36110`). 시도 행이 없는
단층제라 그렇다. 그대로 저장하면 시도 코드 `36` 과 조인이 안 돼 `sync_tour._ldong` 이 2/3 으로 쪼갠다.

**일일 한도는 (서비스 × 오퍼레이션)별로 따로다** — `KorService2`가 429여도 `EngService2`는
살아 있고, `areaBasedList2`도 `detailCommon2`와 별도 한도다.

> 원천 raw 응답은 레포에 커밋하지 않는다. 정규화 산출물만 적재한다.

---

## 3. 행정구역 — 행정안전부 법정동코드

| | |
|---|---|
| 원천 | <https://www.code.go.kr/stdcode/regCodeL.do> — 행정표준코드관리시스템 |
| 키 | **불필요** (로그인도 불필요) |
| 라이선스 | 공공누리 제1유형 (출처표시, 상업 이용·변형 가능) |
| 형식 | ZIP → `법정동코드 전체자료.txt` · 탭 구분 · **CP949** |
| 규모 | 53,388줄 (그중 폐지 32,827줄) → 시도 15 + 세종(합성) · 시군구 269 |

```
법정동코드      법정동명                폐지여부
1100000000      서울특별시              존재
1111000000      서울특별시 종로구        존재
1111010100      서울특별시 종로구 청운동  존재   ← 읍면동은 버린다
```

받는 방법 — 화면의 **"법정동 코드 전체자료"**. 조건으로 거른 목록이 아니라 전체자료여야 한다
(조건부 목록은 시도 행이 빠져 시군구의 상위를 못 찾는다).

**행정구역은 개편된다.** 2026-08-20 자 자료 기준:

- 광주광역시(29) · 전라남도(46) **폐지** → `전남광주통합특별시`(12)
- 강원도(42) → 강원특별자치도(51) · 전라북도(45) → 전북특별자치도(52)
- 인천 서구(2826000000) **폐지** → 제물포구 · 영종구 · 서해구 · 검단구
- 세종은 시도 행(`3600000000`)이 없고 `3611000000` 만 있다 — 파서가 시도 행을 만들어 붙인다

> **낯선 행정구역명을 원천 오류로 단정하지 말 것.** 이 작업에서 두 번 그렇게 판단했고 두 번 다
> 틀렸다(`Jeonnam-Gwangju…`, `Seohae-gu`). **판정 기준은 기억이 아니라 이 자료다.**

**영문명이 없다.** 시도는 `admin_region.SIDO_EN` 상수, 시군구는 **영문 관광지 주소의 최빈값**으로
채운다(`161 Sajik-ro, Jongno-gu, Seoul` → `Jongno-gu`). 어느 칸을 볼지는 법정동 한글명의
단어 수가 정한다 — `전주시 완산구`(2단어)는 한 칸 더 앞을 함께 본다.

---

## 4. 세계 지명 계층 — GeoNames

| | |
|---|---|
| 원천 | `countryInfo.txt` · `admin1CodesASCII.txt` · `cities15000.zip` |
| 키 | 불필요 (공개 덤프) |
| 라이선스 | **CC BY 4.0** — 상업·재배포 가능, **출처표시 필수** |

**한국 행정구역으로 쓰지 않는다.** GeoNames 의 KR 자료는 행정구역 체계가 아니라 지명
데이터셋이다 — CITY 296행에 흥해읍·왜관읍이 섞여 있고 `admin2_code` 가 전부 NULL 이다.
한국 행정구역은 §3 의 법정동 코드로 따로 세운다(`admin_regions`).

> OSM/Nominatim/Geofabrik(ODbL share-alike)·SimpleMaps(유료)는 재배포 viral 리스크로 회피했다.

---

## 5. POI(상가) · 상품 · 영양

| 데이터 | data.go.kr | 라이선스 |
|---|---|---|
| 소상공인시장진흥공단 상가(상권)정보 | #15083033 | 이용허락범위 제한없음 |
| 식약처 식품(첨가물)품목제조보고 | #15064909 (`I1250`) | 제한없음 |
| 식약처 전국통합식품영양성분정보(가공식품) | #15100066 | 제한없음 |
| 식약처 품목제조보고(원재료) | #15062098 (`C002`) | 제한없음 |
| 한국소비자원 참가격 | #3043385 | **KOGL 제1유형 (출처표시)** |

화면 표기: "식품의약품안전처, 한국소비자원 참가격".

> ⚠ 영양값은 표준데이터 기준(연 1회 갱신)이라 리뉴얼 반영이 늦다 — **참고용이며 의료·다이어트
> 처방이 아니라는 면책이 필수**다.

---

## 6. 외부 콘텐츠 API

### YouTube Data API v3

| | |
|---|---|
| 발급 | Google Cloud Console → API 및 서비스 → 라이브러리 → `YouTube Data API v3` 사용 설정 → 사용자 인증 정보 → API 키 |
| 호출 ① | `youtube/v3/search` — `part=snippet`, `type=video`, `maxResults=10`, `regionCode=KR`, `relevanceLanguage`, `safeSearch=strict`, `videoCategoryId=19`(여행·이벤트), 좌표 있으면 `location`+`locationRadius=10km`. 검색어는 표시명(`title_display`). 여행 카테고리 결과 3건 미만이면 일반 검색 **1콜 보충**(건당 100 units — 최악엔 하루 예산이 절반) |
| 호출 ② | `youtube/v3/videos` — `part=statistics`, `id=` (최대 50개 묶음) |
| 쿼터 | 일 10,000 units · `search.list` **100 units** + `videos.list` **1 unit** → **하루 100 관광지** |
| 저장 | videoId · 제목 · URL · 썸네일 **URL** · 채널명 · 게시일 · **조회수** |
| 저장 안 함 | 설명, 좋아요·댓글 수, 채널 ID, 영상 파일. 썸네일 이미지도 내려받지 않는다 |
| 보관 | **30일** — 약관이 그보다 오래 보관하려면 갱신을 요구한다 |

`search.list` 는 **관련성 순**이라 그것만으로는 "인기 영상"이 아니다. `videos.list` 로 조회수를
받아 내림차순 정렬한다 — 50개를 묶어 1 unit 이라 100 units 짜리 search 옆에서는 사실상 공짜다.
**조회수를 못 받아도 영상은 버리지 않는다** — 정렬 근거가 없을 뿐이다.

쿼터 소진은 **403 `quotaExceeded`** 이지 429 가 아니다. 만나면 그 실행을 즉시 멈춘다.

**키 제한은 IP 다** — 서버(CronJob 파드) 호출이라 리퍼러 헤더가 없어 리퍼러 제한을 걸면 전부
403 이 된다. Maps 키(공개·리퍼러)와 **키를 분리**하는 이유이기도 하다 — 한 키에 둘을 담으면
어느 제한을 걸어도 한쪽이 죽는다. 아웃바운드 IP 는 OCI 노드 공인 IP 다(파드 → 노드 SNAT,
**Cloudflare 는 인바운드 전용이라 이 경로에 없다**).

**IP 가 바뀌면**(인스턴스 재생성, 임시 IP stop/start) 수집이 조용히 죽는다 — 화면은 안 깨지고
(딥링크 정상) 잡 로그에 `[YOUTUBE] 수집 0 · 실패 N` 만 쌓인다. 이 신호를 보면 Cloud Console
에서 키의 IP 항목을 갱신한다. 근본 대응은 OCI 공인 IP 를 **예약(Reserved)으로** 두는 것.

**주의: 100 units 는 "영상 100개"가 아니라 호출 1회의 가격표다.** 1개를 받든 50개를 받든
비용이 같아 후보 10개를 받아 저장하고, 화면은 5개만 노출한다(노출 확대는 FE 상수 하나). 수집 카드와 별개로 유튜브 **검색
딥링크**(`results?search_query=`)를 항상 조립해 내보낸다 — API 호출 0, 키 불필요.

> **30일 보관 제한이 예산과 맞물린다.** 하루 100건 × 30일 = **3,000곳**이 신선하게 유지할 수 있는
> 상한이다. 그래서 전량이 아니라 **조회 많은 곳부터** 채운다.

### 네이버 검색 API (블로그)

| | |
|---|---|
| 발급 | 네이버 개발자센터(developers.naver.com) → 애플리케이션 등록 → **검색** API 선택 → Client ID/Secret |
| 호출 | `/v1/search/blog.json` — `query`(국문 코퍼스라 en 행은 국문명, ko 행은 표시명), `display=5`, `sort=sim`, 헤더 `X-Naver-Client-Id/Secret` |
| 쿼터 | 일 25,000콜 |
| 저장 | 제목(`<b>` 태그 제거) · URL · 블로그명 · 게시일. 썸네일 없음 |
| external_id | 링크의 sha1 — 블로그 URL 이 길어 100자 컬럼에 안 들어간다 |

### 수집하지 않는 것

- **인스타그램 · X** — 장소 기반 공개 검색의 공식 경로가 없다(Basic Display 폐기, X API 유료).
  태그 검색 **딥링크만** 건다.
- **여행 상품(마이리얼트립·클룩 등)** — 제휴 API 승인 없이 상품명·가격·이미지를 가져오려면
  스크래핑이고 약관 위반이다. 승인 전까지 **검색 진입 링크만**.

---

## 7. 지도 — Google Maps Platform

| | |
|---|---|
| 사용 | Maps JavaScript API (브라우저 직접 호출) |
| 키 | 빌드타임 `VITE_GOOGLE_MAPS_KEY` — 번들에 박히는 공개값 |
| 보호 | HTTP 리퍼러 제한(`*.1989v.com`) + 쿼터 캡 |

**저장 정책**: Places 를 붙일 때 **`place_id` 외에는 저장하지 않는다.** Google Maps Platform
약관이 무기한 캐시를 허용하는 유일한 필드다. 이름·주소·평점은 우리가 TourAPI 에서 이미
갖고 있으므로 섞지 않는다.

로컬 개발은 별도 키를 쓴다 — 운영 키에 `localhost` 를 열면 누구나 그 키로 호출할 수 있다.

### Places API (New) — 구글 place_id 보강

구글맵 딥링크가 좌표 핀이 아니라 **장소 카드**(리뷰·사진·영업시간)에 착지하려면
`query_place_id=` 가 필요하다 (Maps URLs API — 조립 링크라 키·쿼터 불요). 그 id 하나를
`attractions.google_place_id`(V10, 보강 컬럼)에 채운다.

| | |
|---|---|
| 발급 | Cloud Console → **Places API (New)** 사용 설정 → API 키. **서버(CronJob) 호출이라 IP 제한** — Maps JS 키(공개·리퍼러 제한)와 키를 분리한다 (YouTube 키와 같은 이유: 한 키에 둘을 담으면 어느 제한을 걸어도 한쪽이 죽는다) |
| 호출 | `places:searchText` POST — `textQuery = "{표시명} {주소}"`(주소 없으면 표시명 단독), `languageCode` 는 행의 lang, `pageSize: 1`. 첫 결과의 `id` 만 취한다 |
| fieldMask | **`places.id` 고정** — ID-only 는 Essentials(무과금) SKU 다. 다른 필드를 넣는 순간 Pro 과금이 시작되므로 `google_place.FIELD_MASK` 상수로 못 박고 스모크가 지킨다 |
| 예산 | `GOOGLE_PLACES_DAILY_BUDGET` (기본 1,000/일) — 무과금이지만 상한 없이 돌리지 않는다. 전량(6만 건)은 약 60일 |
| 키 | `GOOGLE_PLACES_API_KEY`. 클러스터는 Secret `place-ingest-secrets/google-places-api-key` (optional) — **없으면 잡이 조용히 건너뛴다** (좌표/주소 링크 폴백으로 화면은 정상) |
| 저장 | **place_id 문자열만** (위 저장 정책의 캐싱 예외 조항). 검색 0건은 null 로 남겨 재시도한다 — 무과금 호출이고 구글 색인은 자라므로 negative cache 를 두지 않았다 |
| 경로 | `place/ingest --job=google-places` → `GET/POST /internal/attractions/google-place-ids/**` (클러스터 내부 전용, ADR-0070 §3 과 같은 패턴) |

---

## 8. 주유소·유가 — 한국석유공사(오피넷), 공공데이터포털 경유

| | |
|---|---|
| 원천 | `apis.data.go.kr` — 한국석유공사 오픈 API **5종**: 지역코드 · **지역별 최저가 TOP20** · 반경 내 주유소(5km) · 주유소 상세정보(ID) · 전국 평균가격 |
| 키 | **`DATA_GO_KR_KEY` 재사용** (참가격·식약처와 같은 키). 해당 API 별로 **활용신청**만 하면 된다 — 개발단계 자동승인 / 운영단계 심의승인. 클러스터는 Secret `ranking-ingest-secrets/data-go-kr-key` |
| 엔드포인트 | `OIL_API_BASE` — 활용신청 화면의 End Point. **기본값을 두지 않는다**(틀린 주소가 404 를 조용히 삼킨다) |
| 받는 것 | 상호·상표·셀프여부·좌표·주소·전화 · 유종별 판매가 |
| 적재 | `ranking/ingest --job=gas-stations` (매일 KST 05:00) → `gas_station` / `gas_station_price` |

**포털에는 지역 단위 전량+가격이 없다.** 가격을 주는 지역 단위 경로는 **최저가 TOP20** 뿐이라,
우리가 아는 것은 **시군구별 싼 주유소 상위 20곳**(전국 약 5,000곳)이다. 시군구 × 유종 ≈ 500콜/일.
전량(`주유소 판매가격정보(지역별)`)은 오피넷 직접 신청에만 있다 — 필요해지면 오퍼레이션 맵 한 곳을 바꾼다.

**유료인 것은 시도별 평균가 · 상호로 검색 · 특정 기간 통계**다. 현재 판매가격 자체는 무료다.

**좌표가 오퍼레이션마다 다르다.** `GIS_X_COOR`/`GIS_Y_COOR` 는 **KATEC(TM128)** 이고 위경도로
오는 오퍼레이션도 있다. KATEC 은 십만 단위라 위경도로 착각해도 그럴듯해 보이고, 그대로 저장하면
**지도 핀만 전부 어긋난다.** 반대로 **이미 위경도인 값을 또 변환하면 한반도 밖으로 날아간다** —
수집기가 형태를 판정해 한 번만 변환한다.
수집기가 WGS84 로 변환해 `latitude`/`longitude` 에 넣고 **원천 KATEC 도 `katec_x`/`katec_y` 에
남긴다**(§0 ①②). 변환식 검증은 `ranking/ingest/tests/test_katec.py` — 기대값은 PROJ 로 뽑았다.

**유료 오퍼레이션은 부르지 않는다.** `최저가 Top20`·`시군구 평균가` 는 유료지만, 무료
`주유소 기본정보(지역별)` 로 전량을 받아두면 같은 결과를 우리가 직접 집계할 수 있다.

**일일 한도가 공개돼 있지 않다.** 포털은 한도 초과를 **HTTP 200 + 본문 `resultCode`** 로
알려주므로 상태코드만 보면 성공으로 읽는다. 초과를 만나면 그 실행을 즉시 멈추고
**아무것도 적재하지 않는다** — 적재가 전체 동기화라 부분 적재를 남기면 다음 실행이 나머지를 지운다.

유종 코드: 휘발유 `B027` · 경유 `D047`. 원천은 (지역 × 유종)으로 답하므로 수집기가
**주유소 단위로 유종을 모아** 보낸다 — 나눠 보내면 뒤 유종이 앞 유종의 가격 행을 지운다.

## 9. 자동차 경로 — Google Routes API

| | |
|---|---|
| 발급 | Cloud Console → **Routes API** 사용 설정 → API 키. **서버 호출이라 IP 제한** |
| 호출 | `POST directions/v2:computeRoutes` — fieldMask `routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration` + `routingPreference=TRAFFIC_UNAWARE` 로 **고정** |
| 무료분 | **Essentials 월 10,000콜** (Pro 는 5,000) |
| 키 | `RANKING_GOOGLE_ROUTES_API_KEY`. 클러스터는 Secret `ranking-secrets/google-routes-api-key` (optional — **없으면 경로 화면만 비활성**) |
| 저장 | 저장하지 않는다 — 경로는 요청 때만 쓰고 응답에 실어 보낸다 |

**SKU 를 올리는 곳이 두 군데다.** 둘 다 `GoogleRoutesClient` 안에서만 정해진다.

| 올리는 것 | 결과 |
|---|---|
| `fieldMask` 에 불필요한 필드 추가 | 상위 SKU (Places 를 id-only 로 고정한 §7 과 같은 이유) |
| `routingPreference=TRAFFIC_AWARE` (실시간 교통) | **Pro SKU** — 무료분이 10,000 → **5,000** 으로 반토막 |

우리는 응답에서 폴리라인과 평균 속도만 쓰고, 그 평균 속도는 "약 N분"이라는 **근사값**의 입력이다.
근사값 하나 때문에 무료 구간을 벗어날 이유가 없어 `TRAFFIC_UNAWARE` 로 둔다.

**키를 Maps JS 키와 분리한다** — Maps JS 는 공개·리퍼러 제한, Routes 는 서버·IP 제한이다.
한 키에 둘을 담으면 어느 제한을 걸어도 한쪽이 죽는다(YouTube·Places 와 같은 함정).

> Directions API 는 Google 이 legacy 로 지정했다. **Routes API** 를 쓴다.
> 카카오모빌리티 자동차 길찾기는 **제휴 파트너 전용**이라 후보에서 빠졌다.

## 관련

- 관광지 ETL 실행법 → `place/ingest/README.md`
- 지리·POI·상품 시드 → `tools/seed/place/README.md`, `tools/seed/products/README.md`
- 주유소 수집 실행법 → `ranking/ingest/README.md`
- 결정 → `docs/adr/ADR-0056`(지리·POI) · `ADR-0065`(K-관광) · `ADR-0070`(콘텐츠 보강) · `ADR-0071`(행정구역 드릴다운) · `ADR-0081`(랭킹 리더보드)
