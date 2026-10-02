# 2단계 공공데이터 12종 — 설계

활용신청이 승인된 12종을 실호출로 재고(2026-10-02 KST) 판정·연결 키·수집·저장·서빙을 정한다. 코드는 아직 없다.
실측 원자료: 필드 표본 `sample-phase2-apis.json`(18호출, `phase2-probe.py`) + 이 문서의 추가 실측(운영 키 43호출 — 그중 19건은
측정 스크립트의 URL 조립 오류로 난 401 이라 응답이 없다. 유효 24호출) · 운영 DB 읽기(`attractions` 64,967행 · `administrative_regions` 285행, PK 범위 키셋).

## 0. 판정 요약

한도는 API 하나당 하루 1,000(대기오염 500)으로 잡는다. 포털 표기는 기상청 두 API 가 개발계정 10,000 이지만
화면 값과 실제가 갈린 전례가 있어(`data-sources.md` §2) 1,000 기준으로 설계한다.

| # | API | 판정 | 연결 키 | 실측 일치율 | 하루 호출 | 백필 |
|---|---|---|---|---|---:|---|
| 1 | 무장애 여행 `KorWithService2` | **채택** | TourAPI contentId (국문) | 목록 9,630 중 9,623(99.9%) | 목록 1 + 상세 ≤ 899 | 상세 11일 |
| 2 | 집중률 `TatsCnctrRateService` | **채택** | 이름 `tAtsNm` + 시군구 `signguCd` | 정확 75.5% · 정규화 81.4% · 포함 88.3%(376곳) | 269 | 없음(앞 30일 예측) |
| 3 | 연관 관광지 `TarRlteTarService1` | **채택(관광지 대상만 링크)** | 이름 + 시군구 | 출발 정규화 75.4% · 대상 관광지 51.7% | 월 269 | 없음 |
| 4 | 두루누비 `Durunubi` | **보류(맨 끝)** | `crsIdx`(자체) | 원천 139코스 = 코리아둘레길 일부 | 주 2 + GPX(포털 밖) | 1회 |
| 5 | 고캠핑 `GoCamping` | **채택(새 원천)** | `contentId`(자체 체계) | 기존 캠핑장(AC05)과 이름+300m 겹침 705(22.6%) | 1 | 1회 |
| 6 | 관광사진 `PhotoGalleryService1` | **안 함(사용자 결정)** | — | — | 0 | — |
| 7 | 웰니스 `WellnessTursmService` | **채택** | TourAPI contentId (국·영) | 국 168/170 · 영 92/92 | 주 2 | 1회 |
| 8 | 지역 방문자 `DataLabService` | **채택** | 법정동 시군구 5자리 · 시도 2자리 | 시군구 269/269(100%) | 2 | 12개월 32콜 |
| 9 | 반려동물 `KorPetTourService2` | **안 함(겹침)** | — | 기존 원천의 부분집합, 새 필드 0 | 0 | — |
| 10 | 단기예보 `VilageFcstInfoService_2.0` | **채택** | 시군구 → 격자(nx,ny) | 시군구 269 → 고유 격자 243 | 486 | 없음 |
| 11 | 중기예보 `MidFcstInfoService` | **채택** | 시군구 → 육상 regId(10) · 기온 regId | 매핑표 출처: 기상청 활용가이드 | ≤ 200 | 없음 |
| 12 | 대기오염 `ArpltnInforInqireSvc` | **채택(측정소 좌표 확보 뒤 노출)** | 측정소 → 시군구 | 이름 일치 48/269 · 앞부분 일치 137/269 | 24 | 없음 |

## 1. 공통 원칙

- **수집은 place-ingest CronJob 만 한다.** 외부 :443 은 지금처럼 place-ingest 파드에만 열린다(`11-allow-egress-https-public.yaml`). 새 egress 정책은 없다.
- **표는 붙는 대상별로 나눈다.** 관광지에 붙는 값(무장애·웰니스·집중률·연관)은 `attractions` 컬럼이 아니라 `attraction_id` 를 갖는 별도 표에 둔다.
  관광지 bulk upsert 는 전체 동기화라 컬럼을 늘릴 때마다 왕복 10곳(SR-2)을 고쳐야 하고, 한 곳을 빠뜨리면 매일 밤 값이 지워진다(§0 ③).
  별도 표는 그 경로가 닿지 않아 이 위험이 구조상 없다. 재색인은 `attraction_similar` 와 같은 묶음 조회(lookup)로 읽는다.
- **원천 행은 원문 JSON 컬럼에 통째로 남기고(§0 ①), 화면·필터용 값은 파생 컬럼으로 둔다(§0 ②).** 자주 쓰는 원천 필드만 정규 컬럼으로 편다.
- **예측·실시간 값은 최신본으로 교체한다.** 집중률(앞 30일)·연관(월)·날씨·대기는 새 발표가 옛 발표를 대체하는 값이다. 필드는 버리지 않지만 지난 발표본을 쌓지 않는다.
  방문자 수는 과거 실적이라 일자별로 쌓는다.
- **서빙(ADR-0071 §10):** 하루 한 번 바뀌는 값은 재색인 문서에 싣고, 그보다 자주 바뀌는 값(날씨·대기)과 관광지가 아닌 단위(지역 방문자)는 place 의 레디스 캐시 경로로 낸다.
  place MySQL 을 화면 요청이 직접 치지 않는다 — 캐시 미스일 때만 PK 한 행을 읽고 채운다.
- **실패:** 한도 초과(HTTP 429 · `resultCode=22` `LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR`) 를 받으면 그 API 수집을 그날 멈추고 이미 받은 몫만 반영한다.
  한 시군구·한 측정 단위가 실패해도 나머지는 계속 받고, 실패한 단위의 이전 값은 지우지 않는다. 화면은 신선도 기준을 넘긴 값을 그리지 않는다(절을 숨긴다, 0 으로 그리지 않는다).
- **TourAPI 보강 잡은 TourAPI 행만 고른다.** 고캠핑 행이 `attractions` 에 들어오면 개요·이용정보·사진 잡의 `pick` 이 그 행의 `content_id` 로 `detailCommon2` 를 부를 수 있다 —
  다른 원천의 번호라 **엉뚱한 TourAPI 콘텐츠의 개요가 붙는다.** 고캠핑 착수 전에 모든 `pick` 에 `source = 'TOURAPI'` 조건을 먼저 넣는다(§3 V31 · spec SR-8c).
- 호출 수는 잡마다 로그(API · 호출 수 · 적재 건수 · 실패 단위)와 CronJob 주석에 적는다. `quota.py` 의 `DATA_GO_KR` 은 키 단위 관측이라 API 별 한도를 가르지 못한다 — 잡 안의 예산 상수가 상한이다.

## 2. 측정 결과

### 2.1 집중률 — 행은 (관광지 × 예측일), 앞 30일

| 시군구 | 행 | 관광지 | 예측일 | 정확 일치 | 정규화 | 포함 일치 | 정규화 중복 후보 |
|---|---:|---:|---|---:|---:|---:|---:|
| 종로구 11110 | 3,390 | 113 | 2026-10-02 ~ 10-31 (30일) | 87 | 96 | — | 1 |
| 제주시 50110 | 7,320 | 244 | 〃 | 183 | 196 | — | 3 |
| 해운대구 26350 | 570 | 19 | 〃 | 14 | 14 | — | 0 |
| 합 | 11,280 | 376 | | **284 (75.5%)** | **306 (81.4%)** | **332 (88.3%)** | 4 |

- (관광지, 예측일) 중복 0 — 관광지마다 30행이다. `cnctrRate` 는 0~100 실수다.
- `areaCd`·`signguCd` 를 빼거나 `areaCd` 만 주면 `totalCount=0` 이다. **시군구 단위로만 받는다** → 전국 = 시군구 269콜. 가장 큰 시군구(제주시 7,320행)도 `numOfRows=10000` 한 콜이다.
- 일치는 같은 시군구의 우리 국문 행 제목과 비교했다. 정규화 = 괄호 안·공백·구두점 제거, 포함 = 정규화한 두 이름 중 한쪽이 다른 쪽을 품고 짧은 쪽이 3자 이상.
  못 맞춘 예: `경운동민병옥가옥` · `보안1942` · `김녕사굴 [유네스코 세계자연유산]` · `SEA LIFE 부산아쿠아리움` — 우리 DB 에 없거나 표기가 다르다.
- 시군구 코드는 표본 셋이 우리 법정동 코드(`ldong_regn_cd`+`ldong_signgu_cd`)와 같다. 광주·전남 통합 코드 `12xxx` 를 받는지는 확인하지 못했다(Q-P2-CODE12).

### 2.2 연관 관광지 — 출발 관광지당 최대 50, 월 단위

| 시군구 (baseYm 202608) | 행 | 출발 관광지 | 출발 정확 | 출발 정규화 |
|---|---:|---:|---:|---:|
| 종로구 | 1,476 | 65 | 36 | 52 |
| 제주시 | 5,786 | 155 | 91 | 118 |
| 해운대구 | 607 | 16 | 7 | 8 |
| 합 | 7,869 | 236 | **134 (56.8%)** | **178 (75.4%)** · 포함 202 (85.6%) |

- 대상 분류(`rlteCtgryLclsNm`) 분포: 관광지 3,489 · 음식 3,293 · 숙박 1,087. 대상 일치율(대상 시군구의 우리 행, 정규화): **관광지 448/867(51.7%)** · 음식 270/1,494(18.1%) · 숙박 121/503(24.1%).
- 식별자 `tAtsCd`·`rlteTatsCd` 는 32자 해시로 TourAPI contentId 와 이어지지 않는다(Q-P2-RELATED 답).
- 집중률과 연관의 출발 관광지 이름은 133곳이 겹친다(집중률 376 · 연관 236) — 같은 이름 매칭 결과를 공유한다.
- 이것도 시군구가 없으면 0건이다 → 월 269콜.

### 2.3 무장애 여행

- `areaBasedList2` `numOfRows=10000` **한 콜에 9,630 전량**(6.2MB, 1.6초). 9,630 중 **9,623 이 우리 국문 행의 contentId 와 같다**. 영문 0.
  유형: 관광지 3,108 · 음식점 2,098 · 문화시설 1,652 · 쇼핑 1,555 · 숙박 946 · 레포츠 269 · 행사 2. 없는 7건은 우리 목록 동기화가 아직 못 받은 행이다.
- 상세 `detailWithTour2` 는 관광지당 1콜, 키 29개(주차 · 대중교통 · 접근로 · 매표소 · 홍보물 · 휠체어 · 출입통로 · 엘리베이터 · 화장실 · 관람석 · 객실 · 점자블록 · 보조견 · 안내요원 ·
  오디오가이드 · 큰활자 · 점자홍보물 · 유도안내설비 · 수어안내 · 영상자막 · 청각장애 기타 · 유모차 · 수유실 · 유아용 의자 · 영유아 기타 등). 값은 자유 문장(「대여가능」「장애인 화장실 있음」).
- 백필: 9,630 ÷ 하루 899(목록 1콜을 뺀 예산) = **11일**. 그 뒤에는 목록 `modifiedtime` 이 바뀐 행과 새 행만 다시 받는다.

### 2.4 단기·중기 예보

- 단기 `getVilageFcst` 는 격자 하나 · 발표 한 번이 약 900행(3일치, 12종 범주)이다. `numOfRows=1000` 한 콜이다.
- 기상청 람베르트 정각원추 격자(5km, 기준점 126°E·38°N, 원점 (43,136))로 변환한 고유 격자 수(서울 시청 → (60,127) 검산):

| 단위 | 수 | 고유 격자 | 1회 갱신 콜 |
|---|---:|---:|---:|
| 관광지 좌표 그대로 | 64,967 | **3,671** | 3,671 — 하루 한도의 3.7배 |
| 시군구 대표점(`administrative_regions` 좌표) | 269 | **243** | 243 |

- 관광지 → 자기 시군구 대표점 거리: 중앙값 4.1km · 90% 15.7km · 99% 35.6km. 화면 문구를 「종로구 날씨」처럼 시군구 단위로 밝힌다(관광지 지점 날씨로 보이지 않게).
- 갱신: 발표 05시·17시 두 번 × 243 = **486콜/일**. 한도가 실제로 10,000 임이 확인되면 8번(02·05·…·23시)으로 늘린다.
- 중기 육상(`getMidLandFcst`)은 권역 10개(`11B00000` 서울·인천·경기 등) — 강원은 영서·영동 둘이라 **시도 → 권역이 아니라 시군구 → 권역**이다.
  기온(`getMidTa`)은 도시 단위 regId(`11B10101` 서울 등)다. 두 regId 목록과 이름은 기상청이 「중기예보 조회서비스 활용가이드」 첨부 구역코드표로 낸다 —
  이것을 시드 표로 적재하고, 시군구 → 기온 regId 는 이름 일치 + 같은 권역 최근접 도시로 정한다(일치율은 시드 적재 때 잰다, Q-P2-MIDREG).
  하루 1번(06시 발표) × (10 + 기온 regId 수 ≤ 190) ≤ **200콜/일**.

### 2.5 대기오염

- `sidoName=전국` **한 콜에 측정소 672곳**(268KB). 시도 이름 16개 중 `전남광주` 는 우리 통합 코드 12 와 같은 묶음이다.
- 한 응답에 `dataTime` 이 섞인다(17:00 448곳 · 16:00 218곳). 46곳은 `pm10Grade` 가 비었다(점검·미수신).
- 측정소 이름은 대부분 동 이름이다(경기 `가남읍`·`경수대로(동수원)`·`고색동` …). 시군구 이름과 같은 측정소는 **48/269**, 앞부분이 같은 것까지 **137/269**(관광지 기준 53%).
  부산·대구의 자치구는 전부 못 맞춘다. 이름만으로는 쓸 수 없다.
- 측정소 좌표는 별도 API(에어코리아 측정소정보 `MsrstnInfoInqireSvc/getMsrstnList`, 15073877)가 준다 — 이번 신청 목록에 없다(Q-P2-AIRSTATION).
- **이용허락 공공누리 제3유형(출처표시 + 변경금지).** 여러 측정소 값을 평균한 「시도 대표값」은 변경에 해당할 수 있어 만들지 않는다. 한 측정소의 값과 등급을 그대로, 측정소 이름·측정 시각과 함께 낸다.

### 2.6 고캠핑

- `basedList` `numOfRows=4000` 한 콜에 3,115 전량(7.3MB). 운영 2,994 · 휴장 121. 대표 사진 2,343. 필드 82개.
- 우리 국문 레포츠(28) 중 신분류 `AC05`(야영장) 1,986행과 비교: 300m 안에 우리 캠핑장이 있는 곳 1,090(35.0%), 300m 안 + 이름 앞 4자·포함 일치 **705(22.6%)** → 우리 행 695곳.
  즉 고캠핑 약 2,400곳이 우리에게 없는 캠핑장이다.
- `contentId`(예 102331)는 지금 우리 국문 contentId 와 겹치는 값이 0 이지만 **번호 체계가 TourAPI 와 별개**라 앞으로도 안 겹친다는 보장이 없다.

### 2.7 두루누비

- `courseList` 139코스(서해랑길 42 · 해파랑길 37 · 남파랑길 30 · DMZ 평화의 길 30), `routeList` 4길. 코스 행에 좌표가 없고 `gpxpath`(durunubi.kr 파일)만 있다.
- GPX 표본 6개: 108~594KB · 트랙점 482~5,226개. 139코스 원본 약 40MB 로 추정. 코리아둘레길 전 구간(4길 합 약 280코스)의 절반이라 원천 범위가 일부다(Q-P2-DURUNUBI-RANGE).
- 이용허락 「제한 없음」. GPX 는 포털 밖 파일이라 data.go.kr 한도를 쓰지 않는다.

### 2.8 웰니스

- 국문 170(전부 유형 12, 테마 `EX05xxxx`) 중 168, 영문 92(유형 76) 92 전부가 우리 행의 contentId 다. **새 행이 아니라 기존 관광지의 태그**다.

### 2.9 지역 방문자

- 기초(`locgoRegnVisitrDDList`) 하루 807행 = 시군구 269 × 구분 3(현지인 · 외지인 · 외국인). **시군구 코드 269개가 우리 `administrative_regions` 시군구 269개와 전부 같다**(통합 코드 12 포함).
- 광역(`metcoRegnVisitrDDList`) 하루 48~50행. 한 달 범위 요청이 25,018행(31일) — `numOfRows=10000` 3콜이면 한 달이다.
- 2026-08-01 · 09-01 일자가 10-02 에 조회된다. 공개 지연(며칠 전까지 나오는지)은 첫 수집에서 잰다(Q-P2-VISITORS-LAG).

### 2.10 반려동물 동반여행 — 안 함

| 비교 | 결과 |
|---|---|
| 목록 `KorPetTourService2/areaBasedList2` | 9,674 — 전부 우리 국문 행에 있다(새 대상 0) |
| 지금 원천 `KorService2/detailPetTour2` 목록 | 9,680 — 반려동물 서비스 목록 9,674 를 전부 포함한다 |
| 상세 `KorPetTourService2/detailPetTour2` | 키 10개가 `pet_raw` 와 같고, 같은 콘텐츠(126081)의 값도 같다 |
| 우리 `pet_raw` 없는 103건 | 전부 오늘(10-02 03:47) 들어온 숙박이다. 지금 원천에도 있어 다음 주 수집이 받는다 |
| `petTourSyncList2` (`showflag`) | 10,142 = 노출 9,680 + 비노출 462. 비노출 중 우리 행은 3건뿐이고, 셋 다 지금 원천 목록에서도 빠져 있다 |

새 필드 · 새 대상 · 더 최신 값이 모두 없다. **채택하지 않는다.** 대신 발견한 것 하나(이 스펙 범위 밖, 보고만):
지금 반려동물 잡은 원천 목록에서 빠진 행의 `pet_raw` 를 지우지 않는다 — 6건이 원천에 없는데 동반 가능으로 남아 있다(셋은 `showflag=0`).

### 2.11 이용허락(포털 표기, 2026-10-02)

| API | 이용허락범위 | 개발계정 트래픽 |
|---|---|---|
| 관광공사 7종(무장애 · 집중률 · 연관 · 두루누비 · 고캠핑 · 웰니스 · 방문자) · 반려동물 | 제한 없음 | 1,000 |
| 기상청 단기·중기 | 공공누리 제1유형(출처표시) | 10,000 |
| 에어코리아 대기오염 | 공공누리 제3유형(출처표시 · 변경금지) | 500 |

## 3. 저장 스키마 (place, Flyway 초안)

번호는 구현 순서(§8)대로 붙인 제안이다. 커밋된 마이그레이션은 고치지 않으므로 그때의 다음 빈 번호를 쓴다.
모든 새 표는 관광지 bulk upsert(전체 동기화) 경로 밖이다 — `syncFrom`·`UPSERT_FIELDS`·조회 DTO 를 건드리지 않는다.
원천 단위 교체는 각 표의 내부 엔드포인트가 「그 단위의 행을 통째로 바꾼다」(집중률은 시군구, 대기는 측정소). 받은 적 없는 단위는 지우지 않는다.

```sql
-- V25 무장애 · 웰니스 — TourAPI contentId 로 기존 관광지에 붙는다
CREATE TABLE attraction_barrier_free (
    attraction_id    BIGINT       NOT NULL COMMENT 'attractions.id',
    content_id       VARCHAR(32)  NOT NULL COMMENT '원천 contentid (국문)',
    list_raw         JSON         NULL     COMMENT 'KorWithService2 areaBasedList2 행 원문',
    detail_raw       JSON         NULL     COMMENT 'detailWithTour2 응답 원문 (29키)',
    list_modified_at DATETIME     NULL     COMMENT '목록 modifiedtime — 상세 재수집 판정',
    detail_synced_at DATETIME     NULL     COMMENT 'NULL 이면 상세 백필 대상',
    flags            VARCHAR(255) NULL     COMMENT '파생: 긍정 값만 코드 목록(WHEELCHAIR,ELEVATOR,RESTROOM,PARKING,STROLLER,LACTATION,…)',
    flags_rule_ver   SMALLINT     NULL     COMMENT '파생 규칙 판 — 규칙을 바꾸면 UPDATE 로 다시 만든다',
    PRIMARY KEY (attraction_id),
    UNIQUE KEY uk_barrier_free_content (content_id),
    KEY idx_barrier_free_backfill (detail_synced_at)
);
CREATE TABLE attraction_wellness (
    attraction_id BIGINT      NOT NULL,
    content_id    VARCHAR(32) NOT NULL,
    lang          VARCHAR(8)  NOT NULL COMMENT 'langDivCd KOR→ko, ENG→en',
    thema_cd      VARCHAR(16) NOT NULL COMMENT 'wellnessThemaCd (EX05xxxx)',
    list_raw      JSON        NOT NULL COMMENT 'areaBasedList 행 원문 (19키)',
    synced_at     DATETIME    NOT NULL,
    PRIMARY KEY (attraction_id)
);

-- V26 지역 방문자 — 과거 실적이라 일자별로 쌓는다 (하루 약 860행, 연 31만행)
CREATE TABLE region_visitor_daily (
    region_level VARCHAR(8)   NOT NULL COMMENT 'SIDO|SIGUNGU',
    region_code  VARCHAR(5)   NOT NULL COMMENT 'areaCode | signguCode',
    base_ymd     DATE         NOT NULL,
    tou_div_cd   VARCHAR(2)   NOT NULL COMMENT '1 현지인 2 외지인 3 외국인',
    tou_num      DECIMAL(14,1) NOT NULL,
    region_nm    VARCHAR(40)  NULL,
    tou_div_nm   VARCHAR(20)  NULL,
    daywk_div_cd VARCHAR(2)   NULL,
    daywk_div_nm VARCHAR(10)  NULL,
    PRIMARY KEY (region_level, region_code, base_ymd, tou_div_cd)
);

-- V27 날씨 — 시군구 단위. 발표본 하나를 원문 그대로 교체한다
CREATE TABLE weather_sigungu_grid (
    sigungu_code   VARCHAR(5) NOT NULL COMMENT 'administrative_regions.code',
    nx             SMALLINT   NOT NULL COMMENT '파생: 대표점 → 기상청 격자',
    ny             SMALLINT   NOT NULL,
    land_reg_id    VARCHAR(8) NULL     COMMENT '중기 육상 권역 regId',
    ta_reg_id      VARCHAR(8) NULL     COMMENT '중기 기온 regId',
    ta_match       VARCHAR(16) NULL    COMMENT '파생: NAME|NEAREST — 매핑 근거',
    PRIMARY KEY (sigungu_code),
    KEY idx_weather_grid (nx, ny)
);
CREATE TABLE weather_short_forecast (
    nx         SMALLINT NOT NULL,
    ny         SMALLINT NOT NULL,
    base_at    DATETIME NOT NULL COMMENT 'baseDate+baseTime (KST)',
    items_raw  JSON     NOT NULL COMMENT 'getVilageFcst item 전부(약 900행)',
    fetched_at DATETIME NOT NULL,
    PRIMARY KEY (nx, ny)
);
CREATE TABLE weather_mid_region (
    reg_id   VARCHAR(8)  NOT NULL,
    kind     VARCHAR(8)  NOT NULL COMMENT 'LAND|TA',
    name     VARCHAR(40) NOT NULL COMMENT '기상청 구역코드표 이름',
    PRIMARY KEY (reg_id)
);
CREATE TABLE weather_mid_forecast (
    reg_id     VARCHAR(8) NOT NULL,
    kind       VARCHAR(8) NOT NULL COMMENT 'LAND|TA',
    tm_fc      DATETIME   NOT NULL COMMENT '발표 시각',
    item_raw   JSON       NOT NULL COMMENT 'getMidLandFcst(23키) 또는 getMidTa(43키) 원문',
    fetched_at DATETIME   NOT NULL,
    PRIMARY KEY (reg_id, kind)
);

-- V28 집중률 — 원천 단위는 (시군구, 관광지 이름). 앞 30일을 한 행에
CREATE TABLE attraction_congestion (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    signgu_cd     VARCHAR(5)   NOT NULL,
    t_ats_nm      VARCHAR(200) NOT NULL COMMENT '원천 관광지 이름',
    area_cd       VARCHAR(2)   NOT NULL,
    area_nm       VARCHAR(40)  NULL,
    signgu_nm     VARCHAR(40)  NULL,
    rates_raw     JSON         NOT NULL COMMENT '[{baseYmd,cnctrRate}] 원문 30행',
    first_ymd     DATE         NOT NULL,
    last_ymd      DATE         NOT NULL,
    attraction_id BIGINT       NULL     COMMENT '파생: 이름 매칭 결과',
    match_method  VARCHAR(12)  NULL     COMMENT '파생: EXACT|NORMALIZED|CONTAINS|AMBIGUOUS|NONE',
    fetched_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_congestion (signgu_cd, t_ats_nm),
    KEY idx_congestion_attraction (attraction_id)
);

-- V29 연관 관광지 — 출발 관광지당 한 행, 최신 월만
CREATE TABLE attraction_related (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    t_ats_cd      CHAR(32)     NOT NULL COMMENT '원천 출발 관광지 해시',
    t_ats_nm      VARCHAR(200) NOT NULL,
    signgu_cd     VARCHAR(5)   NOT NULL,
    base_ym       CHAR(6)      NOT NULL,
    related_raw   JSON         NOT NULL COMMENT '원문 행 최대 50 (rlteTatsCd·이름·지역·분류 3단·순위)',
    attraction_id BIGINT       NULL     COMMENT '파생: 출발 이름 매칭',
    match_method  VARCHAR(12)  NULL,
    targets       JSON         NULL     COMMENT '파생: [{rank, attractionId|null, name, lcls}] — 대상 매칭',
    fetched_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_related (t_ats_cd),
    KEY idx_related_attraction (attraction_id)
);

-- V30 대기오염 — 측정소당 최신 한 행
CREATE TABLE air_quality_station (
    sido_name    VARCHAR(20) NOT NULL,
    station_name VARCHAR(40) NOT NULL,
    data_time    DATETIME    NULL,
    item_raw     JSON        NOT NULL COMMENT 'getCtprvnRltmMesureDnsty 행 원문 (23키)',
    fetched_at   DATETIME    NOT NULL,
    PRIMARY KEY (sido_name, station_name)
);
CREATE TABLE air_station_sigungu (
    sigungu_code VARCHAR(5)  NOT NULL,
    sido_name    VARCHAR(20) NOT NULL,
    station_name VARCHAR(40) NOT NULL,
    match_method VARCHAR(12) NOT NULL COMMENT '파생: NEAREST(좌표)|NAME — NAME 만으로는 노출하지 않는다',
    distance_m   INT         NULL,
    PRIMARY KEY (sigungu_code)
);

-- V31 고캠핑 — 자기 번호 체계를 가진 첫 원천. 관광지 자연키에 원천을 더한다
ALTER TABLE attractions
    ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'TOURAPI' COMMENT 'TOURAPI|GOCAMPING|DURUNUBI' AFTER lang,
    DROP INDEX uk_attractions_content_lang,
    ADD UNIQUE KEY uk_attractions_source_content_lang (source, content_id, lang);
CREATE TABLE gocamping_site (
    content_id            VARCHAR(32)  NOT NULL COMMENT '고캠핑 contentId',
    facility_name         VARCHAR(200) NOT NULL COMMENT 'facltNm',
    manage_status         VARCHAR(20)  NULL     COMMENT 'manageSttus 운영|휴장',
    latitude              DOUBLE       NULL,
    longitude             DOUBLE       NULL,
    source_modified_at    DATE         NULL,
    item_raw              JSON         NOT NULL COMMENT 'basedList 행 원문 (82키)',
    matched_attraction_id BIGINT       NULL     COMMENT '파생: 기존 TourAPI 캠핑장(AC05)과 같은 곳',
    match_method          VARCHAR(16)  NULL     COMMENT '파생: NEAR_NAME|NONE|MANUAL',
    attraction_id         BIGINT       NULL     COMMENT '이 원천으로 만든 attractions 행 (겹치지 않을 때만)',
    synced_at             DATETIME     NOT NULL,
    PRIMARY KEY (content_id)
);

-- V32 두루누비 — 보류. 착수 때 이 모양으로
CREATE TABLE durunubi_route (
    route_idx VARCHAR(40) NOT NULL, item_raw JSON NOT NULL, synced_at DATETIME NOT NULL, PRIMARY KEY (route_idx)
);
CREATE TABLE durunubi_course (
    crs_idx        VARCHAR(40)  NOT NULL,
    route_idx      VARCHAR(40)  NOT NULL,
    item_raw       JSON         NOT NULL COMMENT 'courseList 행 원문 (16키)',
    gpx_gz         MEDIUMBLOB   NULL     COMMENT 'GPX 원본 gzip — 파일 원천이 사라져도 남게',
    gpx_fetched_at DATETIME     NULL,
    start_lat      DOUBLE       NULL     COMMENT '파생: 첫 트랙점',
    start_lng      DOUBLE       NULL,
    path_polyline  TEXT         NULL     COMMENT '파생: 간략화 경로(인코딩 폴리라인)',
    attraction_id  BIGINT       NULL,
    synced_at      DATETIME     NOT NULL,
    PRIMARY KEY (crs_idx)
);
```

- V31 의 자연키 변경은 bulk upsert 의 기존 행 조회(`upsertAll` 의 (content_id, lang) 조회)를 (source, content_id, lang) 로 바꾸는 코드 변경과 함께다.
  TourAPI 경로는 기본값 `TOURAPI` 라 요청 모양이 그대로다. 6만 행 표의 키 교체는 InnoDB 온라인 DDL 이지만 배포는 수집 잡이 없는 시간에 한다.
- 고캠핑은 기존 캠핑장과 겹치는 705곳은 새 행을 만들지 않는다(`matched_attraction_id` 만). 겹치지 않는 곳만 `source=GOCAMPING` 행이 된다. 분류는 `stay`(ADR-0104 결정 1: 「숙소」= 캠핑장 포함), 화면 유형 이름은 원천이 정한다(「캠핑장」).
- 두루누비 행의 좌표는 GPX 첫 트랙점(파생)이다. 원천에 좌표가 없어 GPX 를 받기 전에는 행을 만들지 않는다(SR-1 좌표 없는 행 예외와 같은 이유).

## 4. 서빙 경로 (ADR-0071 §10)

| 값 | 바뀌는 주기 | 경로 | 서버 렌더 본문 |
|---|---|---|---|
| 무장애 플래그 · 상세 | 상세 변경 시 | 색인: `barrierFree`(keyword 배열, 필터) + `barrierFreeDetail`(색인 안 하는 객체) | 넣는다 — 「무장애 정보」 절 |
| 웰니스 테마 | 주 | 색인: `wellnessTheme`(keyword) | 테마 이름 한 줄 |
| 집중률 앞 30일 | 일(02:00 수집 → 04:30 재색인) | 색인: `congestion`(색인 안 하는 객체: 날짜·값 배열). 화면이 오늘 이후만 그린다 | 넣지 않는다(화면 그래프) |
| 함께 간 곳 | 월 | 색인: `relatedPlaces`(색인 안 하는 배열: 순위·id·이름·분류) | 넣는다 — 관광지로 링크된 항목만 |
| 단기·중기 날씨 | 하루 2~3번 | place `GET /api/places/weather?sigungu=` → 레디스 | 넣지 않는다 |
| 대기 | 매시 | place `GET /api/places/air?sigungu=` → 레디스 | 넣지 않는다 |
| 지역 방문자 | 일 | place `GET /api/places/administrative-regions/{code}/visitors` → 레디스 | 넣지 않는다(지역 프리렌더도 X) |
| 캠핑장 · 걷기길 행 | 주 | 관광지 행 → 기존 색인·상세 경로 | 유형별 절 |

- 재색인은 관광지에 붙는 네 표를 **묶음 조회 하나**(`/internal/attractions/extras/lookup`, id ≤ 500)로 읽는다 — 표마다 따로 부르면 페이지당 왕복이 넷 늘어난다.
  새 색인 필드는 쓰기 문서 · 읽기 문서 · 매핑에 모두 넣어 `verifySearchIndexContract` 를 통과한다.
- 날씨·대기·방문자는 쓰기 경로가 캐시를 채운다(write-through): 수집기가 place 내부 bulk 엔드포인트로 보내면 place 가 MySQL 에 쓰고 같은 트랜잭션 밖에서 레디스 키를 덮는다.
  키는 `weather:{sigungu}` · `air:{sigungu}` · `visitors:{level}:{code}:{days}`, TTL 은 다음 수집 주기 + 여유(날씨 13시간 · 대기 2시간 · 방문자 26시간). 미스면 PK 한 행을 읽어 채운다.
  `placeServingPaths.test.tsx` 의 허용 목록에 세 경로를 더한다(캐시 경로만 허용하는 규칙 그대로).
- 신선도: 단기예보는 발표 24시간이 지나면, 대기는 측정 3시간이 지나면 응답에서 빼고 화면은 절을 숨긴다. 집중률은 오늘 이후 날짜만 그리고, 남는 날짜가 없으면 숨긴다.

## 5. API 별 수집

| API | 잡(CronJob) · KST | 오퍼레이션 · 쪽 크기 | 하루 콜 | 마감 | 비고 |
|---|---|---|---:|---|---|
| 무장애 + 웰니스 | `place-ingest-attraction-attrs` 매일 02:40 | `areaBasedList2` 10000 · `detailWithTour2` 1건 · 웰니스 `areaBasedList` KOR/ENG 500(월요일만) | 900 + 2 | 3,000초 | 상세는 `detail_synced_at IS NULL` 먼저, 그다음 목록 수정 시각이 바뀐 행 |
| 집중률 | `place-ingest-congestion` 매일 02:00 | `tatsCnctrRatedList` 시군구별 10000 | 269 | 1,200초 | 재색인(04:30) 앞. 이름 매칭은 수집 때 파생 컬럼에 |
| 연관 | `place-ingest-related` 매월 12일 02:20 | `areaBasedList1` `baseYm=전달` 시군구별 10000 | 월 269 | 1,200초 | 전달 자료가 언제 나오는지는 Q-P2-RELATED-LAG |
| 단기예보 | `place-ingest-weather-short` 05:25 · 17:25 | `getVilageFcst` 격자별 1000 | 486 | 900초 | 격자 243. 발표 직후 10분 여유 |
| 중기예보 | `place-ingest-weather-mid` 06:25 | `getMidLandFcst` 10 · `getMidTa` ≤ 190 | ≤ 200 | 900초 | `tmFc=당일0600` |
| 대기 | `place-ingest-air` 매시 40분 | `getCtprvnRltmMesureDnsty` `sidoName=전국` 1000 | 24 | 300초 | 한도 500 의 5% |
| 방문자 | `place-ingest-visitors` 매일 02:30 | 기초·광역 각 `startYmd=endYmd=D-k` 1000 | 2 | 600초 | 백필은 `--from` 으로 월 단위 3콜 |
| 고캠핑 | `place-ingest-gocamping` 매주 수 02:50 | `basedList` 4000 | 주 1 | 1,200초 | 응답 7.3MB — 파드 메모리 한도 768Mi 안 |
| 두루누비 | (보류) 매주 | `routeList` · `courseList` 200 + GPX 다운로드(수정 시각이 바뀐 코스만) | 주 2 | 1,800초 | |

- 시각은 기존 잡(03:10 행사·숙박 목록 · 03:20 구글 · 04:00 개요 · 04:30 재색인 · 05:00 이용정보 · 06:00 사진 · 매시 17분 링크)과 겹치지 않는 자리다.
- 이름 매칭(집중률·연관 공용, place-ingest 의 순수 함수): 같은 시군구 국문 행에서 ① 제목 정확 ② 정규화(괄호 안·공백·구두점 제거) ③ 포함(짧은 쪽 3자 이상, 후보 하나일 때만).
  ②③ 에서 후보가 둘 이상이면 `AMBIGUOUS` 로 남기고 잇지 않는다. 화면은 ①② 만 쓰고 ③ 은 정밀도를 표본으로 잰 뒤 연다(Q-P2-MATCH).
- 무장애 플래그 규칙: 키마다 빈 값이면 없음, 「없음」「불가」「미설치」가 들어가면 없음, 그 밖은 있음. 라벨 정밀도(표본 100건 손 확인)가 95% 미만인 키는 필터에 넣지 않는다(기존 Q-P2-KORWITH 기본안).

## 6. 출처 표시

| 원천 | 의무 | 화면·서버 렌더 문구 |
|---|---|---|
| 관광공사 7종 | 없음(제한 없음) — 기존 TourAPI 출처 문구와 같은 자리에 함께 | 「출처: 한국관광공사(무장애 여행 정보 · 빅데이터 서비스 · 고캠핑)」 |
| 기상청 | 제1유형 출처표시 | 「출처: 기상청 단기예보·중기예보」 + 발표 시각 |
| 에어코리아 | 제3유형 출처표시 · 변경금지 | 「출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료」 + 측정소 · 측정 시각. 값·등급 그대로, 평균·보간 없음 |

대장(`data-sources.md` §1·§2)에 API 마다 출처 · 이용허락 · 키 · 오퍼레이션 · 하루 호출 수 줄을 배포 전에 더한다(SR-9: 대장에 없으면 배포하지 않는다).

## 7. 화면 노출안

- **상세(관광지):** 무장애 아이콘 줄(휠체어 · 엘리베이터 · 장애인 화장실 · 주차 · 유모차 · 수유실, 긍정 값만) + 펼치면 원문 문장 ·
  「혼잡 예측」 앞 30일 막대(오늘부터, 집중률 값 그대로 0~100, 원천 용어 「집중률」) ·
  「종로구 날씨」 3일(단기: 기온·하늘·강수확률) + 4~10일(중기: 오전/오후 날씨 · 최저/최고) · 대기 등급(측정소 이름 · 측정 시각, 좌표 매핑 뒤) ·
  「여기 온 사람들이 함께 간 곳」(관광지로 링크된 항목, 최대 6, 비슷한 곳과 별개 절).
- **목록 필터:** 속성 패싯에 「무장애」(휠체어 · 엘리베이터 · 장애인 화장실 세 칩, 긍정만) · 「웰니스」 칩(테마).
- **새 유형:** 캠핑장(고캠핑 신규 약 2,400곳, 지도 오버레이의 숙박 토글 안 · 상세에 사이트 수·부대시설·애견 동반) ·
  걷기길(두루누비, 보류 — 착수 시 코스 경로 선 · 거리 · 소요 시간 · 난이도).
- **지역 허브:** 「방문 추이」 최근 12개월 월별 막대(현지인 · 외지인 · 외국인 쌓기) + 시도 안 순위. 조회 시점에 그리고 프리렌더 본문에는 넣지 않는다.

## 8. 구현 순서 (가치 ÷ 비용)

| 순서 | 묶음 | 가치 | 비용 | 이유 |
|---|---|---|---|---|
| 1 | 무장애 + 웰니스 | 높음 · 중간 | 중간 · 낮음 | contentId 그대로 붙는다(99.9%). 같은 lookup · 색인 필드 · 패싯 경로 하나로 둘 |
| 2 | 지역 방문자 | 중간 | 낮음 | 코드 100% 일치 · 하루 2콜. 「place → 레디스」 비관광지 서빙 경로를 먼저 세워 3·5 가 재사용 |
| 3 | 단기 + 중기 날씨 | 높음 | 중간 | 2 의 경로 재사용. 중기 구역 시드가 추가 일 |
| 4 | 집중률 | 높음 | 중간 | 이름 매칭 81%(정규화). 매칭 함수를 5 와 공유 |
| 5 | 연관 관광지 | 중간 | 중간 | 출발 75% · 대상 관광지 52% — 링크되는 것만 보여 절이 짧다 |
| 6 | 대기 | 중간 | 낮음(+측정소 좌표 선행) | 이름 매칭으로는 노출 불가. Q-P2-AIRSTATION 해결 뒤. 수집·저장은 먼저 해도 된다 |
| 7 | 고캠핑 | 중간 | 높음 | 자연키 변경(V31) · 보강 잡 `source` 필터 · 겹침 판정 |
| 8 | 두루누비 | 낮음~중간 | 높음 | 139코스(둘레길 절반) · GPX 40MB · 지도 경로 그리기. 원천 범위 확인 뒤 |
| — | 반려동물 · 관광사진 | — | — | 안 함 |

## 9. 새 미지수

- Q-P2-CODE12: 집중률·연관이 광주·전남 통합 코드 `12xxx` 로 답하는지(옛 29·46 로만 답하면 통합 시군구 매핑표가 필요하다).
- Q-P2-MATCH: 포함 일치(③)의 정밀도 — 표본 50쌍 손 확인 뒤 화면에 연다.
- Q-P2-MIDREG: 중기 기온 regId 목록 규모와 시군구 매핑 일치율(활용가이드 구역코드표 적재 때).
- Q-P2-AIRSTATION: 측정소 좌표 원천 — 측정소정보 API(15073877) 활용신청 또는 에어코리아 공개 측정소 목록 파일. 확보 전에는 대기 절을 그리지 않는다.
- Q-P2-VISITORS-LAG · Q-P2-RELATED-LAG: 방문자 일자 · 연관 월 자료의 공개 지연.
- Q-P2-DURUNUBI-RANGE: `courseList` 139 가 둘레길 전 코스가 아닌 이유(원천 범위 · 다른 `brdDiv`).
- Q-P2-PET-STALE(범위 밖 보고): 반려동물 잡이 원천 목록에서 빠진 행의 `pet_raw` 를 지우지 않는다(6건).
