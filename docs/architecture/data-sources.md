# 원천 데이터 대장

플랫폼이 **외부에서 받아오는 모든 데이터**의 출처·라이선스·받는 방법을 한곳에 모은다.

지금까지 이 정보는 ADR·스펙·시드 README 에 흩어져 있었다. 흩어져 있으면 "이 값이 어디서
왔는지" 를 물었을 때 답할 수 없고, 라이선스 표기 의무를 지키고 있는지도 확인할 수 없다.

> **새 외부 데이터를 붙이면 여기에 줄을 추가한다.** 코드에만 있고 여기 없으면 없는 것과 같다.

---

## 0. 연동 규칙 — 원천이 준 것은 버리지 않는다

**새 외부 데이터를 붙일 때 이 세 줄을 먼저 지킨다.**

### ① 원천이 주는 것은 **전부** 적재한다 — 필드도, 대상도

응답에 있는 필드는 지금 화면에서 안 쓰더라도 **컬럼으로 남긴다.** 원천 호출은 대부분
일일 한도가 있는 자원이고, 나중에 필요해졌을 때 다시 받으려면 **그 한도를 다시 쓴다.**

**"전부" 는 필드만이 아니라 대상(레코드·유형)도 뜻한다.** 예산이 빠듯하면 범위를 줄이는 게
아니라 **기간을 늘린다** — 하루치를 잘라 며칠에 걸쳐 받는다. 유형을 골라 받으면 나중에
필요해졌을 때 그 유형만 다시 받아야 하고, 그때 드는 것이 바로 아끼려던 그 한도다.

> 실제로 겪은 값: TourAPI 의 `lclsSystm1~3`(신 분류)을 적재 시점에 `category` 한 글자로
> 태우고 버렸다. 분류 규칙 하나를 고치려고 **6만 건 재호출**이 필요했다 (2026-08-21).
> 함께 버려지고 있던 것: `contenttypeid`, `cpyrhtDivCd`(이미지 저작권 구분), `mlevel`,
> `zipcode`, `createdtime`, `firstimage2`. 그중 `firstimage2`(150×100 썸네일)는 `thumbnail_url` 로 적재해
> 검색 색인과 카드 얼굴이 쓴다 — 원본 `firstimage` 는 한 장에 약 500KB 다 (2026-09-03).

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
| 관광지 이용정보 | TourAPI `detailIntro2` | 필요 | 〃 | `place/ingest --job=intro` (매일) |
| 관광지 분류 코드표 | TourAPI `lclsSystmCode2` | 필요 | 〃 | `place/ingest --job=lcls-codes` (월 1회) |
| 관광지 반려동물 동반 | TourAPI `detailPetTour2` | 필요 | 〃 | `place/ingest --job=pet-tour` (주 1회) |
| 관광지 부가 사진 | TourAPI `detailImage2` | 필요 | 〃 | `place/ingest --job=media` (매일) |
| 관광지 반복정보 | TourAPI `detailInfo2` | 필요 | 〃 | `place/ingest --job=media` (매일) |
| 축제·공연·행사 | TourAPI `searchFestival2` (국·영) | 필요 | 〃 (행마다 `cpyrhtDivCd`) | `place/ingest --job=tour-portal-sync` (매일 KST 03:10) |
| 숙박 | TourAPI `searchStay2` (국·영) | 필요 | 〃 (행마다 `cpyrhtDivCd`) | 〃 |
| 여행코스 | TourAPI `areaBasedList2` `contentTypeId=25` (국문만) | 필요 | 〃 (행마다 `cpyrhtDivCd`) | 〃 |
| 관광지 무장애 정보 | 관광공사 무장애 여행 `KorWithService2` (15101897) `areaBasedList2` · `detailWithTour2` (국문만) | 필요 (`TOUR_API_KEY` 재사용) | 이용허락범위 제한 없음 | `place/ingest --job=attraction-attrs` (매일 KST 02:40, 하루 ≤ 900콜) |
| 관광지 웰니스 테마 | 관광공사 웰니스관광 `WellnessTursmService` (15144030) `areaBasedList` (국·영) | 필요 (〃) | 이용허락범위 제한 없음 | 〃 (월요일만, 주 2콜) |
| 지역 방문자 수 | 관광공사 빅데이터 `DataLabService` (15101972) `locgoRegnVisitrDDList`(시군구) · `metcoRegnVisitrDDList`(시도) | 필요 (〃) | 이용허락범위 제한 없음 | `place/ingest --job=visitors` (매일 KST 02:30, 하루 2콜 · 백필 `--from=YYYY-MM` 1회 약 48콜) |
| 관광지 집중률 예측 | 관광공사 빅데이터 `TatsCnctrRateService` `tatsCnctrRatedList` (시군구별, 앞 30일) | 필요 (〃) | 이용허락범위 제한 없음 | `place/ingest --job=congestion` (매일 KST 02:00, 시군구마다 1콜 = 하루 269콜) |
| 연관 관광지 | 관광공사 빅데이터 `TarRlteTarService1` `areaBasedList1` (시군구별, 월 `baseYm`) | 필요 (〃) | 이용허락범위 제한 없음 | `place/ingest --job=related` (매월 KST 3~28일 02:20 — 받은 달이면 0콜, 공개 전이면 1콜, 받는 날 시군구마다 1콜 = 269콜) |
| 단기예보(날씨) | 기상청 `VilageFcstInfoService_2.0` (15084084) `getVilageFcst` | 필요 (`TOUR_API_KEY` 재사용 — 같은 data.go.kr 계정 키) | **공공누리 제1유형(출처표시)** | `place/ingest --job=weather-short` (매일 KST 05:25 · 17:25, 회차당 고유 격자 243콜 · 하루 486) |
| 중기예보(날씨) | 기상청 `MidFcstInfoService` (15059468) `getMidLandFcst` · `getMidTa` | 필요 (〃) | **공공누리 제1유형(출처표시)** | `place/ingest --job=weather-mid` (매일 KST 06:25, 육상 10 + 기온 163 = 하루 173콜) |
| 중기 구역코드표 | 기상청 「중기예보 조회서비스 오픈API활용가이드」(241128) 육상 권역 표 + 첨부 「중기기온예보구역코드」(2025.12) | 불필요(포털 참고문서) | 공공누리 제1유형 | `place/ingest/src/weather_grid.py` 상수(남한 도시 176 + 육상 10) |
| 대기 실시간 측정 | 한국환경공단 에어코리아 `ArpltnInforInqireSvc` (15073861) `getCtprvnRltmMesureDnsty` `sidoName=전국` `ver=1.0` | 필요 (`TOUR_API_KEY` 재사용 — 같은 data.go.kr 계정 키) | **공공누리 제3유형(출처표시 · 변경금지)** | `place/ingest --job=air` (매시 40분, 전국 1콜 = 하루 24콜 · 시간 초과 재시도 포함 상한 72, 한도 500) |
| 대기 측정소 좌표 | 한국환경공단 에어코리아 `MsrstnInfoInqireSvc` (15073877) `getMsrstnList` (addr 생략 = 전국) | 필요 (〃) | **공공누리 제3유형으로 취급** (포털 표기 미확인 — 같은 기관 대기오염정보 기준) | `place/ingest --job=air-stations` (매주 월 KST 01:50, 1콜 · 재시도 포함 상한 3) |
| **행정구역(법정동)** | 행정안전부 행정표준코드관리시스템 | **불필요** | 공공누리 제1유형 | `place/ingest --job=administrative-regions` |
| 세계 지명 계층 | GeoNames | 불필요 | **CC BY 4.0** | `tools/seed/place/normalize_regions.py` |
| POI(상가) | 소상공인시장진흥공단 상가(상권)정보 | 필요 | 이용허락범위 제한없음 | `tools/seed/place/normalize_pois.py` |
| 상품·영양 | 식약처 / 한국소비자원 참가격 | 필요 | 제한없음 / KOGL 제1유형 | `tools/seed/products/normalize.py` |
| 관광지 영상 | YouTube Data API v3 | 필요 | Google API 서비스 약관 | `place/ingest --job=links` (매시) |
| 관광지 후기 | 네이버 검색 API(블로그) | 필요 | 네이버 오픈API 이용약관 | 〃 |
| 지도 | Google Maps JavaScript API | 필요 | Google Maps Platform 약관 | 브라우저 직접 호출 |
| 구글 place_id | Google Places API (New) Text Search | 필요 | Google Maps Platform 약관 (**place_id 만 무기한 저장 허용**) | `place/ingest --job=google-places` |
| **주유소·유가** | 한국석유공사 오피넷 (직접) | `OPINET_API_KEY` | **이용허락범위 제한 없음** | `ranking/ingest --job=gas-stations` (매일) |

**출처 표기 의무가 있는 것**: GeoNames(CC BY 4.0), TourAPI(공공누리), 참가격(KOGL 제1유형), 기상청(공공누리 제1유형), 에어코리아(공공누리 제3유형 — 변경금지).
화면 하단 또는 관련 페이지에 표기한다 — `place` 화면은 "출처: 한국관광공사 TourAPI",
`rank` 화면의 "출처: 한국석유공사 오피넷"은 **의무가 아니라 선택**이다(오피넷은 이용허락범위
제한 없음) — 그래도 보드 행이 `source_label` 로 들고 다닌다.

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

**한도는 계정 등급이 정한다 — 포털 화면의 숫자가 아니라.** 개발계정일 때는 상세기능별
100,000 이라 적혀 있어도 실제로는 하루 약 1,000건이었다(`detailIntro2` 예산을 5,000 으로 올리니
999건 뒤로 전부 `429`, 2026-09-08 실측). **운영계정 승인(2026-09-11) 뒤로는 그 벽이 없다** —
하루 2,198콜을 429 없이 넘겼다(2026-09-13 실측, 국문). 화면 값과 실제가 등급에 따라 갈리므로
어느 쪽도 상수로 박을 수 없고, `place/ingest/src/quota.py` 가 `DATA_GO_KR` 을 관측만 하는 이유가
그것이다.

**이제 수집 속도를 정하는 것은 원천 한도가 아니라 Job 의 실행 시간이다.** 무료 단일 노드라
`activeDeadlineSeconds`(1시간) 안에 끝나야 하고, 건당 소요(요청 약 0.14초 + `REQUEST_GAP_SEC`)가
한 회차 분량을 정한다. 예산을 더 올리려면 시간 제한부터 같이 올려야 한다.

**분류 코드표는 이름을 준다.** `attractions` 는 `lclsSystm1~3` 을 코드로만 갖고 있어
필터 이름도, 질의의 「자연」이 어느 코드인지도 이을 수 없다. `lclsSystmCode2` 가 그 이름을 주고,
**같은 코드에 국문·영문 이름을 짝으로** 주므로 한영 동의어가 손으로 쓰지 않고 나온다
(`NA02 자연경관(하천‧해양) ↔ Natural Scenery (Rivers/Marine)`).
**깊이를 코드 길이로 유도하면 안 된다** — 대부분 2/4/8 자지만 `C01`(추천코스) 계열만 3/5/9 자다(13건).

**긴 값 하나가 배치를 통째로 죽인다.** `info_center` 만 `VARCHAR(255)` 였고, TourAPI `infocenter` 는
안내소가 여럿이면 줄바꿈으로 이어 붙여 온다. 255자를 넘는 값 하나에 `Data too long` 이 나면서
2,000건 배치가 롤백돼 그날 적재가 999건에서 멈췄다(V15 에서 TEXT 로 넓혔다).
**원천 문자열 컬럼은 형제 필드와 같은 너비여야 한다** — 하나만 좁으면 그게 배치의 상한이 된다.

**반려동물은 `detailIntro2` 로 오지 않는다.** 그쪽 `chkpet` 은 국문 44,924건 중 3건뿐이고,
원천이 이 축을 `detailPetTour2` 로 옮겼다. 그쪽은 **contentId 없이 목록으로** 9,691건을 준다 —
건당 1콜이 아니라 100건 페이징이라 약 100콜이면 전량이다.

**축제·숙박·여행코스는 별도 오퍼레이션으로 받는다** (ADR-0104, CronJob `place-ingest-tour-sync` · `--job=tour-portal-sync`, 매일 KST 03:10).
- 규모(2026-10-02 첫 적재): 행사 국 897 · 영 262, 숙박 국 2,925 · 영 207, 코스 1,000 — 합 5,291행. 하루 약 56콜(100행 쪽), 한 회차 41초.
  원천 건수와의 차이는 숙박 국 65(숙박 아닌 유형) · 영 4, 코스 68(좌표 없음)이다. 행사 문의처가 최대 123자라 `tel` 을 300자로 넓혔다(V24).
- 행사 `searchFestival2` 의 `eventStartDate` 는 이름과 달리 **「종료일 ≥ 값」** 으로 거른다. 그래서 오늘 − 365일을 주면
  진행 중·예정 행사와 지난 1년 안에 끝난 행사가 함께 온다(국 897 · 영 262건, 2026-10-02). 목록 행에 `eventstartdate`·
  `eventenddate`·`progresstype`·`festivaltype` 네 필드가 더 있고, 날짜는 `yyyyMMdd` 라 수집기가 ISO 로 바꿔 싣는다.
- 숙박 `searchStay2` 목록에는 **숙박이 아닌 유형이 섞여 온다**(국문 2,990건 중 관광지 61 · 레포츠 3 · 문화시설 1,
  영문에는 contentid 가 빈 행). 유형 32·80 만 싣고 나머지는 건수만 로그에 남긴다.
- 여행코스는 영문 서비스에 없다. 국문 1,068건 중 1,016건에 법정동 코드가 없어 지역 허브에 안 잡힌다(원천 그대로 둔다).
- **좌표가 없는 행은 싣지 않는다** — §0 ① 의 예외다. 지도·거리·근처 계산이 전부 좌표를 전제로 하고 모델이 좌표를
  필수로 갖는다. 대신 유형·언어마다 「좌표 제외 n건」을 로그에 남겨, 원천 건수와 적재 건수의 차이를 설명할 수 있게 한다.
- 공공누리 유형은 **행마다 다르다**(`cpyrhtDivCd`, 표본은 `Type3` = 출처표시·변경금지). 목록 행 원문(`list_raw`)에
  그대로 남는다.

**무장애 여행·웰니스관광은 관광지 행이 아니라 별도 표로 붙는다** (2단계, CronJob `place-ingest-attraction-attrs` · `--job=attraction-attrs`, 매일 KST 02:40).
설계·실측: `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-design.md` §2.3 · §2.8.
- 원천: `apis.data.go.kr/B551011/KorWithService2` · `/B551011/WellnessTursmService`. 키는 TourAPI 와 같은 `TOUR_API_KEY` 이고
  한도는 API(오퍼레이션) 하나당 하루 1,000 으로 잡는다. 이용허락범위는 둘 다 「제한 없음」이다(출처 의무 없음, 화면은 출처 줄에 원천 이름을 함께 단다).
- 무장애 목록 `areaBasedList2` 는 `numOfRows=10000` 한 콜에 9,630 전량이고 9,623 이 국문 contentId 와 같다(영문 0, 2026-10-02).
  상세 `detailWithTour2` 는 관광지당 1콜·29키 자유 문장이라 하루 899건씩 받는다 — 전량 백필 약 11일, 그 뒤는 목록 `modifiedtime` 이 바뀐 곳만.
- 웰니스 `areaBasedList` 는 언어(`langDivCd` KOR·ENG)마다 한 콜 — 국 170 중 168 · 영 92 전부가 기존 contentId 다. 언어마다 받은 목록으로 통째로 바꾼다.
- **의료관광 계열 테마(`EX0508xx`, 「기타의료관광」)는 적재·노출하지 않는다** — 규제 업권(의료)은 노출 대상이 아니다(의료법 27조).
  수집기가 걸러 「의료관광 제외 n건」만 로그에 남기고, 통째 교체라 이미 적재된 그 태그도 다음 회차에 빠진다.
- 저장: `attraction_barrier_free`(목록 행 · 상세 응답 원문 JSON + 파생 긍정 코드 `flags` · 규칙 판 `flags_rule_ver`) ·
  `attraction_wellness`(목록 행 원문 + 테마 코드). **관광지 bulk upsert(전체 동기화) 경로 밖이라 다른 잡의 왕복이 지우지 않는다** (§0 ③).
- 파생 코드는 긍정 값만이다 — 빈 값·「없음」「없으」「불가」「미설치」가 든 값은 코드가 없다. 목록 필터로는 라벨 정밀도 95% 이상인
  휠체어·엘리베이터·장애인 화장실만 연다(표본 100건 손 확인: `implementation/phase2-barrierfree-labels.md`).
- 서빙: 06:30 재색인이 `/internal/attractions/extras/lookup` 으로 읽어 색인 문서(`barrierFree` · `barrierFreeDetail` · `wellnessTheme` ·
  `wellnessThemeName`)에 싣는다. 화면은 place DB 를 읽지 않는다(ADR-0071 §10).

**관광지 집중률(앞 30일 예측)은 이름 매칭으로 관광지에 붙어 별도 표에 쌓이고, 재색인이 색인 문서로 옮긴다** (2단계, CronJob `place-ingest-congestion` · `--job=congestion`, 매일 KST 02:00).
설계·실측: `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-design.md` §2.1 · `implementation/phase2-congestion-match.md`.
- 원천: `apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList`. 키는 `TOUR_API_KEY`, 한도는 하루 1,000, 이용허락범위 「제한 없음」
  (화면은 「출처: 한국관광공사 빅데이터 서비스(관광지 집중률 예측)」를 단다). 행은 (관광지 이름 × 예측일)이고 키는 7개(`areaCd`·`areaNm`·`signguCd`·`signguNm`·`tAtsNm`·`baseYmd`·`cnctrRate`).
- **시군구를 주지 않으면 0건**이라 `areaCd`+`signguCd` 로 시군구마다 1콜이다(`numOfRows=10000` — 가장 큰 제주시 7,320행도 한 콜).
  **광주·전남은 통합 코드 12xxx 와 옛 29·46 코드 모두 0건이다**(2026-10-02, 여수·순천·목포·광주 동구 각 두 체계). 잡은 0건 시군구 목록을 로그에 남긴다.
- contentId 가 없어 **이름 + 법정동 시군구**로 같은 시군구 국문 행에 잇는다(`place/ingest/src/name_match.py`, 연관 관광지와 공용) — 정확 → 정규화(괄호 안·공백·구두점 제거) → 포함(짧은 쪽 3자 이상).
  단계마다 후보가 둘 이상이면 잇지 않는다. 실측 376곳: 정확 284 · 정규화 22 · 포함 21 · 모호 5 · 못 맞춤 44. **화면(색인)에는 정확·정규화만 싣는다** — 포함 매칭 표본 손 확인(2026-10-06, 각 25쌍 두 번)에서 집중률은 20/25 · 22/25 라 열지 않는다(Q-P2-MATCH).
  연관 관광지 **출발**은 49/50 이라 포함까지 싣되, 우리 행이 음식점·숙박·캠핑 시설이면 뺀다(`AttractionRelated.containsStartAllowed`). 연관 **대상**은 표본이 없어 정확·정규화만.
- 저장(V28): `attraction_congestion` — (시군구, 원천 이름)당 한 행에 원천 30행 원문 JSON(`rates_raw`) + 파생(예측일 범위 · 이은 관광지 id · 매칭 방법). 못 이은 이름도 저장한다.
  수집기가 받은 시군구의 행을 통째로 바꾸고(새 예측이 옛 예측을 대체), 0건·실패 시군구는 건드리지 않는다. 관광지 bulk upsert 경로 밖이다(§0 ③).
- 서빙: 06:30 재색인이 `/internal/attractions/extras/lookup` 으로 읽어 색인 문서 `congestion`(날짜·값 배열, 색인하지 않는 객체)에 싣는다.
  화면이 오늘 이후 날짜만 「혼잡 예측」으로 그린다. 서버 렌더 본문에는 넣지 않는다.

**연관 관광지(「여기 온 사람들이 함께 간 곳」)는 이름 매칭으로 출발·대상 관광지에 붙어 별도 표에 쌓이고, 재색인이 관광지로 이어진 대상만 색인 문서로 옮긴다** (2단계, CronJob `place-ingest-related` · `--job=related`, 매월 KST 3~28일 02:20).
설계·실측: `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-design.md` §2.2 · `implementation/phase2-related-match.md`.
- 원천: `apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1`. 키는 `TOUR_API_KEY`, 한도는 하루 1,000, 이용허락범위 「제한 없음」
  (상세 출처 줄에 「빅데이터 서비스(연관 관광지)」를 더한다). 행은 (출발 관광지 × 연관 대상)이고 출발당 최대 50, 키는 17개
  (`baseYm`·`areaCd`·`areaNm`·`signguCd`·`signguNm`·`tAtsCd`·`tAtsNm`·`rlteTatsCd`·`rlteTatsNm`·`rlteRegnCd`·`rlteRegnNm`·`rlteSignguCd`·`rlteSignguNm`·`rlteCtgryLclsNm`·`rlteCtgryMclsNm`·`rlteCtgrySclsNm`·`rlteRank`).
  식별자 `tAtsCd`·`rlteTatsCd` 는 32자 해시라 contentId 와 이어지지 않는다.
- **시군구를 주지 않으면 0건**이라 `baseYm`+`areaCd`+`signguCd` 로 시군구마다 1콜이다(`numOfRows=10000` — 제주시 5,786행도 한 콜).
  **전달 자료의 공개일을 모른다**(Q-P2-RELATED-LAG): 2026-10-02 · 10-06 KST 에 `202609` 는 0건, `202608` 은 있었다. 그래서 매달 3~28일 매일 돌며
  이미 받은 달이면 호출하지 않고, 공개 전이면 지난달 행이 있던 시군구 하나만 묻는다. 28일까지 안 나오면 Job 이 실패한다.
- 매칭은 집중률과 같은 `name_match` — 출발은 자기 시군구, 대상은 **대상 시군구**의 국문 행. 실측(종로·제주시·해운대 202608, 7,869행):
  출발 236 중 정확 134 · 정규화까지 176(같은 이름 행이 둘인 모호 2 포함 시 178) · 대상 관광지 867 중 정확·정규화 434(모호 포함 448) · 음식 270/1,494 · 숙박 121/503.
  **화면(색인)에는 정확·정규화로 이은 출발의, 우리 관광지 행(상세 페이지가 있는 것)으로 정확·정규화로 이어진 대상만** 싣는다(place `NameMatch.SERVED`, 집중률과 같은 기준).
  원천 분류는 보지 않는다 — 음식·숙박 대상도 우리 음식점·숙박 행으로 이어지면 내고, 화면이 원천 소분류로 그것을 밝힌다.
- 저장(V29): `attraction_related` — (시군구, 출발)당 한 행에 원천 행 원문 JSON(`related_raw`) + 파생(출발 매칭 · 대상별 매칭 `targets`). 못 이은 출발·대상도 저장한다.
  수집기가 받은 시군구의 행을 그 달로 통째로 바꾸고(최신 달만), 0건·실패 시군구는 건드리지 않는다. 더 옛 달로는 바꾸지 않는다. 관광지 bulk upsert 경로 밖이다(§0 ③).
- 서빙: 06:30 재색인이 `/internal/attractions/extras/lookup` 으로 읽어 색인 문서 `relatedPlaces`(순위·id·지금 제목·시도·원천 소분류, 색인하지 않는 객체, 최대 6)에 싣는다.
  자기 자신·출발과 같은 이름·비활성 문서는 뺀다. 상세 화면과 서버 렌더 본문이 같은 목록을 그린다(「비슷한 곳」과 별개 절).

**지역 방문자 수는 지역 단위 값이라 관광지 색인이 아니라 place 레디스 캐시 경로로 나간다** (2단계, CronJob `place-ingest-visitors` · `--job=visitors`, 매일 KST 02:30).
설계·실측: `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-design.md` §2.9 · §4.
- 원천: `apis.data.go.kr/B551011/DataLabService`. 키는 `TOUR_API_KEY`, 한도는 하루 1,000, 이용허락범위 「제한 없음」(화면은 「출처: 한국관광공사 빅데이터 서비스」를 단다).
- 기초는 시군구 269 × 현지인·외지인·외국인 = 하루 807행, 광역은 시도 16 × 3 = 48행이다. **시군구 코드 269개가 `administrative_regions` 시군구 269개와 전부 같다**(2026-10-02).
  광역은 2026-08-18 까지 옛 광주(29)·전남(46) 코드 행이 하루 한 행씩 더 온다 — 원천 전부 적재라 저장하고, 허브는 그 코드를 묻지 않는다.
- **공개 지연 30일** — 2026-10-02 18시에 받은 가장 최근 날이 2026-09-02 였다. 잡은 매일 D-37 ~ D-28 열흘 창을 기초·광역 한 콜씩(기초 열흘 8,070행 < 쪽 10,000) 받는다.
  한 날을 여러 번 다시 받으므로 하루이틀 실패해도 메워진다. 창 안에 공개된 날이 없으면 exit 1(지연이 창보다 길어졌다는 신호), 로그에 회차마다 가장 최근 날과 지연 일수를 남긴다.
- 저장: `region_visitor_daily` — 키 (수준, 지역, 날짜, 구분) upsert 라 다시 받아도 행이 늘지 않는다. 연 약 31만 행. 원천 8키 전부 컬럼이고,
  `touNum` 은 원천이 부동소수 표기(`24814.549999999996`, 소수 10~14자리가 절반)로 주므로 **원문 문자열(`tou_num`)과 합산용 파생값(`tou_num_value`, 소수 셋째 자리)** 을 따로 둔다.
- 서빙: `GET /api/places/administrative-regions/{code}/visitors` → 레디스 `placeRegionVisitors::{code}`(TTL 26시간). 수집기가 `PUT /internal/regions/visitors` 로 보내면
  place 가 저장한 뒤 받은 지역의 키를 다시 계산해 덮는다(write-through). 다 받은 달만 월 합계로 낸다(공개 지연 때문에 최근 달은 늘 일부라서). 지역 프리렌더 본문에는 넣지 않는다.

**날씨(기상청 단기·중기예보)는 시군구 단위 값이라 관광지 색인이 아니라 place 레디스 캐시 경로로 나간다** (2단계, CronJob `place-ingest-weather-short` · `place-ingest-weather-mid`).
설계·실측: `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-design.md` §2.4 · §4.
- 원천: `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` · `/1360000/MidFcstInfoService`. 키는 `TOUR_API_KEY`(같은 계정 키), 한도는 API 하나당 하루 1,000 으로 잡는다
  (포털 표기 10,000 — 화면 값과 실제가 갈린 전례가 있어 확인 전까지 1,000). **이용허락 공공누리 제1유형** — 화면은 날씨 절 안에
  「출처: 기상청 단기예보·중기예보」와 발표 시각을 단다.
- 단위: 관광지 좌표 그대로면 고유 격자 3,671 이라 한 회차가 한도를 넘는다. 시군구 대표점(`administrative_regions` 좌표 = 그 시군구 관광지 좌표 평균)
  269 중 좌표 있는 267 → 격자 243(2026-10-02). 부천시·안산시 행은 좌표가 없다(자치구 행이 따로 있다). 격자 변환은 기상청 활용가이드 식이고
  같은 자료의 격자_위경도 표(2607) 1·2단계 274행 중 270행과 같다(다른 4행은 표 자신의 좌표·격자가 어긋난 행). 화면 제목은 「종로구 날씨」처럼 단위를 밝힌다.
- 중기 구역: 육상 권역 10 은 활용가이드 표, 기온 regId 는 첨부 구역코드표의 도시(C) 코드 중 남한 176. 시군구 → 기온 regId 는 이름 일치(같은 권역 안) 193 ·
  광역시 자치구 → 그 도시 70 · 광역시 소속 군 → 그 광역시 4(기장군 → 부산, 달성군 → 대구, 옹진군 → 인천, 울주군 → 울산) · 같은 권역 최근접 도시 0
  (규칙은 남겨 둔다 — 새 시군구가 앞 세 단계에 안 걸리면 쓴다). 육상 권역은 기온 regId 앞자리가 정한다.
- **단기 17시 발표는 격자 하나에 1,052행**이다(05시 발표는 907행) — 쪽 크기를 1,500 으로 둬 격자당 한 콜이다(1,000 이면 두 콜).
- 발표: 단기는 05시·17시(예보 기간이 가장 긴 둘), 중기는 06시(18시 발표는 4일 뒤 값이 없다). 새 발표본이 옛 발표본을 바꾸고, 늦게 도착한 옛 발표본은 덮지 않는다.
- 저장(V27): `weather_sigungu_grid`(시군구 → 격자 · 육상 · 기온 · 매핑 근거) · `weather_short_forecast`(격자당 발표본 하나, item 전부 원문 JSON) ·
  `weather_mid_region`(구역코드표) · `weather_mid_forecast`((구역, 종류)당 발표본 하나, 항목 원문 JSON). 화면의 일별 값(최저·최고·오전/오후 하늘·강수확률)은 원문에서 읽을 때 만든다.
- 서빙: `GET /api/places/weather?sigungu=` → 레디스 `placeWeather::{시군구}`(TTL 13시간). 수집기가 `PUT /internal/weather/short`·`/mid` 로 보내면 place 가 저장한 뒤
  받은 격자·구역을 쓰는 시군구의 키를 다시 만들어 덮는다(write-through). 단기는 발표 24시간, 중기는 30시간이 지나면 응답에서 그 날들을 빼고(읽는 시각 기준),
  남는 날이 없으면 화면이 절을 숨긴다. 검색 색인·서버 렌더 본문에는 넣지 않는다.

**대기(에어코리아 실시간 측정)는 매시 바뀌는 측정소 값이라 관광지 색인이 아니라 place 레디스 캐시 경로로 나간다** (2단계, CronJob `place-ingest-air` · `place-ingest-air-stations`).
설계·실측: `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-design.md` §2.5 · §4.
- 원천: `apis.data.go.kr/B552584/ArpltnInforInqireSvc` · `/B552584/MsrstnInfoInqireSvc`. 키는 `TOUR_API_KEY`(같은 계정 키), 실시간 측정 한도는 하루 500.
  **이용허락 공공누리 제3유형(출처표시 · 변경금지)** — 측정소 하나의 값·등급을 원천 문자열 그대로 내고, 여러 측정소를 평균한 값을 만들지 않는다.
  화면은 「출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료」와 측정소 이름 · 측정 시각을 단다.
- 응답 모양: `response.body.items` 가 `{"item": [...]}` 가 아니라 **행 배열 그 자체**다(`datagokr.items` 가 둘 다 읽는다). 결과코드 정상은 `00`.
  원천 시간 초과(`SERVICETIMEOUT_ERROR` 05 · HTTP 504)가 잦아 그 자리에서 두 번까지 다시 부르고, 다시 부른 것도 호출 예산에서 뺀다.
- 측정: `sidoName=전국` 한 콜에 672곳(2026-10-02 22:04 — 21시 612 · 22시 54 · 측정 없음 6). 측정 시각이 섞이므로 측정소마다 자기 `dataTime` 을 저장하고,
  자정은 원천이 그날 `24:00` 으로 준다(다음 날 00:00 으로 읽는다). Flag(이 응답에서 PM10 통신장애 14 · PM2.5 24)가 있으면 값이 「-」라 화면은 값 대신 원천 표시를 그린다.
- 측정소 좌표: **필드 이름과 반대로 `dmX` 가 위도, `dmY` 가 경도**다(서울 중구 37.564639 / 126.975961). 수집기가 한반도 범위(위도 33~39 · 경도 124~132)로
  검사해 바뀐 순서를 잡는다 — 하나도 안 남으면 보내지 않고 잡이 실패한다. 측정소 이름은 전국 672곳이 겹치지 않아 저장 키로 쓴다(겹치면 수집기가 멈춘다).
- 단위: 시군구마다 **측정소 후보** = 그 시군구 관광지 각각의 최근접 측정소 ∪ 대표점의 최근접 측정소(주 1회 다시 계산). 화면이 후보 가운데 그 관광지에서
  가장 가까운 측정소를 고르므로 전국 최근접과 같다. 관광지 → 최근접 측정소 거리(운영 국문 48,725곳): 중앙값 2.2km · 90% 11.1km · 20km 초과 1.7% —
  20km 를 넘으면 절을 숨긴다. 대표점 하나에 측정소 하나만 이으면 중앙값 5.1km · 20km 초과 8.2% 였다. 후보는 시군구당 중앙값 6 · 최대 21곳.
- 저장(V30): `air_station`(측정소 좌표 파생 + 목록 행 원문) · `air_measurement`(측정소마다 최신 측정 원문 한 행, 측정 시각이 같거나 새로울 때만 덮고 측정 없는 회차는 덮지 않는다) ·
  `air_station_sigungu`(시군구 → 측정소 후보, 받은 시군구는 통째로 교체).
- 서빙: `GET /api/places/air?sigungu=` → 레디스 `placeAir::{시군구}`(TTL 2시간). 수집기가 `PUT /internal/air/measurements` · `/stations` 로 보내면 place 가 저장한 뒤
  그 측정소를 후보로 갖는 시군구의 키를 다시 만들어 덮는다(write-through). 측정 3시간이 지난 측정소는 응답에서 측정을 뺀다(읽는 시각 기준).
  검색 색인·서버 렌더 본문에는 넣지 않는다.

> 원천 raw 응답은 레포에 커밋하지 않는다. 정규화 산출물만 적재한다.
> 예외: 테스트 픽스처와 스펙 표본(`place/ingest/tests/fixtures/sample-*.json`, `place/ingest/tests/fixtures/phase2-*.json`,
> `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/sample-*.json`)은 응답 **몇 행**을 둔다
> (무장애는 라벨 정밀도를 재려고 목록 100행 · 상세 100건을, 집중률은 이름 매칭 수치를 재려고 세 시군구의 원천 이름 376개 · 해운대구 원천 570행 · 같은 시군구 국문 제목 2,446을, 연관 관광지는 같은 이유로 세 시군구의 출발 236 · 대상 2,864(이름·대분류) · 해운대구 원천 607행 · 대상 43개 시군구 국문 제목 중 원천 이름과 관계있는 2,610을, 방문자는 시군구 코드 269개를 대조하려고 기초 한 날의 현지인 269행을, 날씨는 행 수·쪽 크기를 재려고 한 격자의 단기 발표 둘 전량(907 · 1,052행)과 기상청 격자표 1·2단계 274행을, 대기는 전국 한 응답이 672행인지와 측정 시각이 섞이는 모양·좌표 순서를 재려고 측정 · 측정소 응답 각 672행 전량과 측정소 후보 검사용 운영 관광지 좌표 1,914개(네 시군구)를 둔다) — 수집기가 실제 응답 모양을 다루는지는 지어낸 값으로 검사할 수 없어서다. 키·요청 URL 은 지우고
> 휴대전화 번호는 가린다(검사: 키 모양 문자열 grep, tasks 1.10).

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

**영문명이 없다.** 시도는 `administrative_region.SIDO_EN` 상수, 시군구는 **영문 관광지 주소의 최빈값**으로
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
한국 행정구역은 §3 의 법정동 코드로 따로 세운다(`administrative_regions`).

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
| 호출 ① | `youtube/v3/search` — `part=snippet`, `type=video`, `maxResults=50`, `regionCode=KR`, `relevanceLanguage`, `safeSearch=strict`. **1순위: `videoCategoryId=19`(여행) + `location`·`locationRadius=10km`**, 이름 매칭 뒤 10개가 안 되면 **보충: 제한 없는 검색**으로 10개까지(1순위가 앞, 각 순위 안은 조회수 순). 검색어는 place 가 준다(표시명, 이름이 겹치면 + 시군구). 1관광지 1~2콜 |
| 호출 ② | `youtube/v3/videos` — `part=statistics,contentDetails,player`, `maxWidth=640`, `id=` (최대 50개 묶음). 수집 직후 + `links` 잡 끝에 길이·비율이 빈 영상 채우기(한 실행 5,000개 = 100 units) |
| 쿼터 | 일 10,000 units · `search.list` **100 units** + `videos.list` **1 unit** → **하루 100 관광지** |
| 저장 | videoId · 제목 · URL · 썸네일 **URL** · 채널명 · 게시일 · **조회수** · **길이**(ISO-8601 원문) · **플레이어 폭·높이**. 파생: `video_format`(세로·3분 이하 = SHORT) |
| 저장 안 함 | 설명, 좋아요·댓글 수, 채널 ID, 영상 파일. 썸네일 이미지도 내려받지 않는다 |
| 보관 | **30일** — 약관이 그보다 오래 보관하려면 갱신을 요구한다 |

`search.list` 는 **관련성 순**이라 그것만으로는 "인기 영상"이 아니다. `videos.list` 로 조회수를
받아 내림차순 정렬한다 — 50개를 묶어 1 unit 이라 100 units 짜리 search 옆에서는 사실상 공짜다.
**조회수를 못 받아도 영상은 버리지 않는다** — 정렬 근거가 없을 뿐이다.

쇼츠 여부 필드는 API 에 없다. 길이와 플레이어 비율로 가른다 — **플레이어 크기는 `maxWidth` 를 줘야
영상 비율대로 온다.** `maxHeight` 만 주면 전부 360×640(세로)으로 와서 44분짜리도 세로였다(2026-10-04).

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

## 8. 주유소·유가 — 한국석유공사 오피넷 (직접 호출)

| | |
|---|---|
| 원천 | `www.opinet.co.kr/api` — 지역코드 · **지역별 최저가 TOP20** · 반경 내 주유소 · 주유소 상세정보(ID) · 전국 평균가 등 |
| 키 | `OPINET_API_KEY` — **opinet.co.kr 회원가입 후 무료 API 이용신청**. 인증 파라미터는 `code`(포털 표준 `serviceKey` 아님). 클러스터는 Secret `ranking-ingest-secrets/opinet-api-key` |
| 라이선스 | **이용허락범위 제한 없음** (공공데이터포털 등록 정보 기준). 출처 표기는 의무가 아니라 선택 |
| 받는 것 | 상호·상표·셀프여부·좌표·주소·전화 · 유종별 판매가 |
| 적재 | `ranking/ingest --job=gas-stations` (매일 KST 05:00) → `gas_station` / `gas_station_price` |

**공공데이터포털을 거치지 않는다.** 포털의 한국석유공사 항목은 `API 유형: LINK` 라 포털이
중계하지 않고 제공기관 사이트로 **바로가기만** 걸어둔 것이다 — 활용신청 버튼이 없고 포털
인증키도 발급되지 않는다. `DATA_GO_KR_KEY` 로는 부를 수 없다.

현재 수집은 시군구 × 유종의 **최저가 TOP20**(≈500콜/일)이라 아는 것은 **싼 주유소 상위 20곳**
(전국 약 5,000곳)이다. 개발가이드에 `주유소 판매가격정보(지역별)`(전량+가격)이 있으면 그쪽으로
바꾼다 — 오퍼레이션 맵 한 곳만 고치면 되고, 그러면 이 제약이 사라진다(OQ-14).

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

## 관련

- 관광지 ETL 실행법 → `place/ingest/README.md`
- 지리·POI·상품 시드 → `tools/seed/place/README.md`, `tools/seed/products/README.md`
- 주유소 수집 실행법 → `ranking/ingest/README.md`
- 결정 → `docs/adr/ADR-0056`(지리·POI) · `ADR-0065`(K-관광) · `ADR-0070`(콘텐츠 보강) · `ADR-0071`(행정구역 드릴다운) · `ADR-0081`(랭킹 리더보드)
