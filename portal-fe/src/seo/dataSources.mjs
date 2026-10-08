/**
 * 데이터 출처 목록 — `/data-sources` 페이지와 그 프리렌더가 함께 쓴다.
 *
 * 원본은 원천 대장 `docs/architecture/data-sources.md` §1 이다. 대장은 portal-fe 빌드 컨텍스트
 * 밖이라 빌드가 읽지 못해 여기에 사본을 둔다. 사본이 대장과 어긋나면
 * `src/pages/__tests__/dataSources.test.ts` 가 실패한다 — 대장 §1 을 고치면 여기도 같이 고친다.
 *
 * 공개하는 열은 데이터·원천·라이선스뿐이다. 키·적재 경로·호출 한도는 운영 정보라 옮기지 않는다.
 * 비고에는 대장 본문에 있는 사실만 싣는다. 프리렌더가 번들 없는 Node 스크립트라 순수 JS 로 둔다.
 */

/** 대장 §2 축제·숙박·여행코스 절 — 공공누리 유형이 행(콘텐츠)마다 다르다. */
const TOUR_PER_ROW_NOTE = '행마다 공공누리 유형이 다름(표본 제3유형 = 출처표시·변경금지)';

const TOUR_LICENSE = '공공누리 (출처표시)';
const FREE_USE = '이용허락범위 제한 없음';

/** @type {{ data: string, source: string, license: string, note: string }[]} */
export const DATA_SOURCES = [
  { data: '관광지', source: '한국관광공사 TourAPI 4.0', license: TOUR_LICENSE, note: '' },
  { data: '관광지 개요', source: 'TourAPI detailCommon2', license: TOUR_LICENSE, note: '' },
  { data: '관광지 이용정보', source: 'TourAPI detailIntro2', license: TOUR_LICENSE, note: '' },
  { data: '관광지 분류 코드표', source: 'TourAPI lclsSystmCode2', license: TOUR_LICENSE, note: '' },
  { data: '관광지 반려동물 동반', source: 'TourAPI detailPetTour2', license: TOUR_LICENSE, note: '' },
  { data: '관광지 부가 사진', source: 'TourAPI detailImage2', license: TOUR_LICENSE, note: '' },
  { data: '관광지 반복정보', source: 'TourAPI detailInfo2', license: TOUR_LICENSE, note: '' },
  { data: '축제·공연·행사', source: 'TourAPI searchFestival2 (국·영)', license: TOUR_LICENSE, note: TOUR_PER_ROW_NOTE },
  { data: '숙박', source: 'TourAPI searchStay2 (국·영)', license: TOUR_LICENSE, note: TOUR_PER_ROW_NOTE },
  {
    data: '여행코스',
    source: 'TourAPI areaBasedList2 contentTypeId=25 (국문만)',
    license: TOUR_LICENSE,
    note: TOUR_PER_ROW_NOTE,
  },
  {
    data: '관광지 무장애 정보',
    source: '관광공사 무장애 여행 KorWithService2 (15101897) areaBasedList2 · detailWithTour2 (국문만)',
    license: FREE_USE,
    note: '',
  },
  {
    data: '관광지 웰니스 테마',
    source: '관광공사 웰니스관광 WellnessTursmService (15144030) areaBasedList (국·영)',
    license: FREE_USE,
    note: '',
  },
  {
    data: '지역 방문자 수',
    source:
      '관광공사 빅데이터 DataLabService (15101972) locgoRegnVisitrDDList(시군구) · metcoRegnVisitrDDList(시도)',
    license: FREE_USE,
    note: '',
  },
  {
    data: '관광지 집중률 예측',
    source: '관광공사 빅데이터 TatsCnctrRateService tatsCnctrRatedList (시군구별, 앞 30일)',
    license: FREE_USE,
    note: '',
  },
  {
    data: '연관 관광지',
    source: '관광공사 빅데이터 TarRlteTarService1 areaBasedList1 (시군구별, 월 baseYm)',
    license: FREE_USE,
    note: '',
  },
  {
    data: '캠핑장',
    source: '한국관광공사 고캠핑 GoCamping basedList (data.go.kr 15101933)',
    license: FREE_USE,
    note: '',
  },
  {
    data: '단기예보(날씨)',
    source: '기상청 VilageFcstInfoService_2.0 (15084084) getVilageFcst',
    license: '공공누리 제1유형(출처표시)',
    note: '',
  },
  {
    data: '중기예보(날씨)',
    source: '기상청 MidFcstInfoService (15059468) getMidLandFcst · getMidTa',
    license: '공공누리 제1유형(출처표시)',
    note: '',
  },
  {
    data: '중기 구역코드표',
    source:
      '기상청 「중기예보 조회서비스 오픈API활용가이드」(241128) 육상 권역 표 + 첨부 「중기기온예보구역코드」(2025.12)',
    license: '공공누리 제1유형',
    note: '',
  },
  {
    data: '대기 실시간 측정',
    source: '한국환경공단 에어코리아 ArpltnInforInqireSvc (15073861) getCtprvnRltmMesureDnsty sidoName=전국 ver=1.0',
    license: '공공누리 제3유형(출처표시 · 변경금지)',
    note: '실시간 측정값으로 확정 전 자료',
  },
  {
    data: '대기 측정소 좌표',
    source: '한국환경공단 에어코리아 MsrstnInfoInqireSvc (15073877) getMsrstnList (addr 생략 = 전국)',
    license: '공공누리 제3유형으로 취급',
    note: '',
  },
  { data: '행정구역(법정동)', source: '행정안전부 행정표준코드관리시스템', license: '공공누리 제1유형', note: '' },
  { data: '세계 지명 계층', source: 'GeoNames', license: 'CC BY 4.0', note: '' },
  { data: 'POI(상가)', source: '소상공인시장진흥공단 상가(상권)정보', license: '이용허락범위 제한없음', note: '' },
  { data: '상품·영양', source: '식약처 / 한국소비자원 참가격', license: '제한없음 / KOGL 제1유형', note: '' },
  { data: '관광지 영상', source: 'YouTube Data API v3', license: 'Google API 서비스 약관', note: '' },
  { data: '관광지 후기', source: '네이버 검색 API(블로그)', license: '네이버 오픈API 이용약관', note: '' },
  { data: '지도', source: 'Google Maps JavaScript API', license: 'Google Maps Platform 약관', note: '' },
  {
    data: '구글 place_id',
    source: 'Google Places API (New) Text Search',
    license: 'Google Maps Platform 약관 (place_id 만 무기한 저장 허용)',
    note: '',
  },
  { data: '주유소·유가', source: '한국석유공사 오피넷 (직접)', license: FREE_USE, note: '' },
];

/**
 * 표 아래에 붙는 라이선스 종류별 고지. 데이터가 아니라 고정 문구라 대장 대조에서 뺀다.
 * `href`·`label` 이 있으면 문장 뒤에 링크를 단다.
 *
 * @type {{ text: string, href?: string, label?: string }[]}
 */
export const DATA_SOURCE_NOTICES = [
  {
    text: '공공누리 유형별 이용 조건(출처표시·상업적 이용·변경 허용 여부)은 공공누리 안내에 있습니다.',
    href: 'https://www.kogl.or.kr/info/license.do',
    label: '공공누리 유형 안내',
  },
  {
    text: 'GeoNames 자료는 CC BY 4.0 에 따라 가공해 씁니다.',
    href: 'https://creativecommons.org/licenses/by/4.0/deed.ko',
    label: 'CC BY 4.0 원문',
  },
  { text: 'KOGL 은 공공누리(Korea Open Government License)의 영문 약칭입니다.' },
];
