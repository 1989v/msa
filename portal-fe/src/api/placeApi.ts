import axios from 'axios';
import type { ApiResponse } from './searchApi';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path 사용 (운영 / K8s ingress 경유).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
});

export type PlaceLang = 'ko' | 'en';

export interface Attraction {
  id: string;
  contentId: string;
  lang: PlaceLang;
  title: string;
  /**
   * 원어 병기명 — title 이 정제된 표시명이고, 괄호로 붙어 있던 현지어 이름이 여기로 분리된다
   * (예: en title "Dosan Park" / titleLocal "도산공원"). 구 응답에는 없다 — 없으면 표시하지 않는다.
   * 두 이름을 다시 한 문자열로 합치지 않는다 (titleParts 로만 소비).
   */
  titleLocal?: string | null;
  category: string | null;
  areaCode: string | null;
  /**
   * 법정동 시도코드 (ADR-0071 의 지역 축). 상세 화면의 breadcrumb 지역 단계가 이것을 쓴다 —
   * `areaCode` 는 구 TourAPI 체계라 문서의 43% 에서 비어 그 자리에 못 쓴다.
   * 색인이 새로 돌기 전 문서에는 없다 — 없으면 지역 단계를 뺀다.
   */
  sidoCode?: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /**
   * 대표 이미지 썸네일(TourAPI firstimage2, 150×100·약 18KB). 원본(imageUrl)은 약 500KB 라 카드 얼굴처럼
   * 작은 자리에는 이것을 쓴다. 색인이 새로 돌기 전 문서에는 없다 — 그때는 imageUrl.
   */
  thumbnailUrl?: string | null;
  tel: string | null;
  overview: string | null;
  /**
   * 이용정보 (TourAPI detailIntro2). 원천은 유형마다 키가 다르고(usetime / usetimeculture /
   * usetimeleports …) 서버가 하나로 모아 준다. 점진 보강이라 없을 수 있다 — 없는 줄은 안 그린다.
   */
  useTime?: string | null;
  restDate?: string | null;
  /** 이용요금. 관광지(12)·레포츠(28)에는 원천에 아예 없고 문화시설(14) 등에만 있다. */
  useFee?: string | null;
  parking?: string | null;
  parkingFee?: string | null;
  infoCenter?: string | null;
  /**
   * detailIntro2 응답 원문(JSON 문자열). 위 6개는 유형마다 다른 키를 서버가 하나로 모은 것이고,
   * 나머지(체험안내·소요시간·대표메뉴·유모차·신용카드 …)는 여기에만 있다.
   * 상세 화면이 이걸 펼쳐 **원천이 준 것을 다 보여준다**.
   */
  introRaw?: string | null;
  /**
   * 부가 사진 원문 (TourAPI detailImage2). 대표사진 말고 원천이 더 갖고 있는 것들 —
   * 많으면 24장이다. 유형마다 키가 달라 원문 그대로 오고 화면이 풀어 쓴다.
   */
  imagesRaw?: string | null;
  /** 반복정보 원문 (detailInfo2). 관광지는 예약안내, 레포츠는 코스안내가 이 자리에 온다. */
  infoRaw?: string | null;
  /** 시도 이름. 색인이 들고 있어 화면이 285행 목록을 받지 않는다 (ADR-0095). */
  sidoName?: string | null;
  /** 외부 링크 원문 JSON — `{ collected, deepLinks }`. 상세에서 DB 를 부르지 않는다. */
  links?: string | null;
  /**
   * Google Places place_id — 구글맵 딥링크(`query_place_id=`)가 장소 카드에 착지하게 한다.
   * 점진 보강이라 없을 수 있다 — 없으면 주소/좌표 검색 링크로 폴백 (googleMapsSearchUrl).
   */
  googlePlaceId?: string | null;
  distanceKm: number | null;
  position: number;
  /**
   * 방문 속성 — 색인 표기 그대로. 화면 JSON-LD(`copy.mjs`)가 이 이름으로 읽어 서버 렌더와 같은
   * 구조화 데이터를 만든다. 속성이 없던 옛 색인 문서에는 없다(「모두 모름」과 다른 뜻).
   */
  closureState?: 'ALWAYS_OPEN' | 'WEEKLY' | 'NO_WEEKLY' | 'UNKNOWN' | null;
  /** WEEKLY 일 때만 — MON · TUE · … · SUN (월→일 순) */
  closedWeekdays?: string[] | null;
  attrParking?: AttributeAvailability | null;
  attrCreditCard?: AttributeAvailability | null;
  attrStrollerRental?: AttributeAvailability | null;
  petPolicy?: 'ALLOWED' | 'PARTIAL' | 'UNKNOWN' | null;
  attrAdmission?: 'FREE' | 'PAID' | 'UNKNOWN' | null;
  /**
   * 원천 관광 유형 코드 — 지역 안 위치 문구의 「{유형}」과 유형별 본문(행사 15·85 · 숙박 32·80 · 코스 25)의 축.
   * 옛 문서에는 없다 — 없으면 그 문구를 그리지 않는다(유형을 짐작해 넣으면 N 의 뜻이 틀린다).
   */
  contentTypeId?: string | null;
  /** 행사의 유효 시작일·종료일(`YYYY-MM-DD`, 양 끝 포함). 행사가 아니거나 날짜를 모르면 null. */
  eventStart?: string | null;
  eventEnd?: string | null;
  /** 여행코스 구성 — 원천 순서. `attractionId` 가 null 이면 같은 언어 관광지와 이어지지 않아 링크하지 않는다. */
  courseStops?: CourseStop[] | null;
  /** 지역 안 위치 — 단건 조회에만 온다. 옛 문서·목록 응답은 null. */
  region?: AttractionRegion | null;
  /** 다른 시도의 비슷한 곳(같은 언어·유형) — 단건 조회에만 온다. 목록이 없으면 null. */
  similarElsewhere?: Array<{ id: string; title: string; sidoName: string | null; eventEndEffective?: string | null }> | null;
  /** 최근 14일 클릭한 고유 방문자 수 — 단건 조회에만 온다. 신호를 못 읽은 회차·옛 문서는 null. */
  uniqueClickers14d?: number | null;
  /** 무장애 긍정 코드(`WHEELCHAIR` …) — 정보가 없으면 null. 「없음」 코드는 없다. */
  barrierFree?: string[] | null;
  /** 무장애 원천 키 → 원문 문장 — 단건 조회에만 온다. */
  barrierFreeDetail?: Record<string, string> | null;
  /** 웰니스관광 테마 코드(EX05xxxx)·이름(분류 코드표) */
  wellnessTheme?: string | null;
  wellnessThemeName?: string | null;
  /**
   * 관광지 집중률 앞 30일(예측일 순, 국문 문서만) — 단건 조회에만 온다. 색인은 하루 한 번 바뀌어 지난 날이 섞일 수 있다 —
   * 오늘 이전 날은 화면이 거른다. 이름 매칭이 안 된 곳은 null.
   */
  congestion?: CongestionDay[] | null;
  /**
   * 여기 온 사람들이 함께 간 곳(원천 순위 순, 최대 6, 국문 문서만) — 단건 조회에만 온다. 한국관광공사 연관 관광지 중
   * 우리 관광지로 이어진 것만 색인에 실린다. 「비슷한 곳」과 겹쳐도 걸러져 오지 않는다(각 절이 따로 그린다).
   */
  relatedPlaces?: RelatedPlace[] | null;
  /** 같은 장소의 다른 등록(관광지·쇼핑 등) — 있으면 상세가 「복합공간」으로 알리고 잇는다. 단건 조회에만. */
  samePlace?: Array<{ id: string; contentTypeId?: string | null }> | null;
  /** 「캠핑장 정보」 — 고캠핑 원문 중 화면에 내는 키만 담은 JSON 객체 문자열(place 가 고른다). 캠핑장이 아니면 없다 */
  camping?: string | null;
  /** 원천 출처(TOURAPI · GOCAMPING …) — 없으면 「출처: 정보 없음」. TourAPI 로 추정하지 않는다. */
  source?: string | null;
  /** 공공누리 유형(Type1 · Type3 …) — 원천 값 그대로. */
  copyrightDivCd?: string | null;
  /** 요금 평문(색인 파생) — 이미 정규화돼 있어 sourceText 를 다시 걸지 않는다. 없으면 useFee 를 쓴다. */
  feeText?: string | null;
  /** 원천 최종 수정일(`yyyy-MM-ddTHH:mm:ss`). 없으면 「원천 갱신일: 정보 없음」. */
  modifiedAt?: string | null;
  /** 반려동물 동반 원문 — petPolicy 가 UNKNOWN 일 때 그대로 보여 준다. */
  petAcmpyType?: string | null;
  /**
   * 언어 대체 짝 — 상대 언어 문서 id(국문 ↔ 영문). 짝이 없거나 짝 스위치가 꺼져 있으면 null.
   * 같은 언어 안의 중복 등록(`samePlace`)과 다른 개념이다. 있으면 상세가 hreflang 을 단다.
   */
  alternateId?: string | null;
  /** 본문이 실제로 바뀐 시각(place 가 정규화 해시로 판정). 원천 수정일 `modifiedAt` 과 다르다. */
  contentUpdatedAt?: string | null;
}

/** 함께 간 곳 한 건 — `rank` 는 원천 순위, `category` 는 원천 소분류 이름 그대로. */
export interface RelatedPlace {
  rank: number;
  id: string;
  title: string;
  sidoName: string | null;
  category: string | null;
}

/** 집중률 예측 하루 — `date` 는 `YYYY-MM-DD`, `rate` 는 원천 값 그대로(0~100). */
export interface CongestionDay {
  date: string;
  rate: number;
}

export type AttributeAvailability = 'YES' | 'NO' | 'UNKNOWN';

export interface CourseStop {
  order: number;
  contentId: string | null;
  name: string;
  attractionId: number | null;
}

/** 허브 링크는 `/regions/{sidoCode}{ldongSignguCd}`. */
export interface AttractionRegion {
  ldongSignguCd: string | null;
  sigunguName: string | null;
  /** 같은 시군구·같은 유형 수 */
  typeCount: number;
  /** 그중 같은 분류(lclsSystm3) 수 — 항상 typeCount 이하 */
  categoryCount: number | null;
  categoryName: string | null;
  /** 같은 시군구·유형·분류의 가까운 곳(자기 제외, 최대 5). 행사 항목은 유효 종료일을 함께 싣는다. */
  sameCategoryNearby: Array<{ id: string; title: string; distanceMeters: number; eventEndEffective?: string | null }>;
}

/**
 * 속성 패싯 건수 — 키는 요청 파라미터 값과 같은 표기다. 각 건수는 **자기 속성의 선택만 빼고**
 * 나머지 선택·구조 필터를 반영한 「이 조건을 더하면」의 규모다. `UNKNOWN`·부정 값은 오지 않는다.
 */
export interface AttributeFacets {
  openToday: number;
  parking: Partial<Record<'YES', number>>;
  creditCard: Partial<Record<'YES', number>>;
  strollerRental: Partial<Record<'YES', number>>;
  pet: Partial<Record<'ALLOWED' | 'PARTIAL', number>>;
  admission: Partial<Record<'FREE', number>>;
  /** 무장애 코드별 건수 — 서버가 연 코드만 */
  barrierFree?: Partial<Record<BarrierFreeFilterCode, number>>;
  wellness?: number;
}

/** 목록 필터로 연 무장애 코드 — search `BarrierFreeInfo.FILTER_CODES` 와 같은 목록 */
export type BarrierFreeFilterCode = 'WHEELCHAIR' | 'ELEVATOR' | 'RESTROOM';

export interface AttractionSearchResult {
  searchId: string;
  attractions: Attraction[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  /** 오타 교정으로 바꿔 검색했으면 바꾼 검색어 */
  correctedKeyword?: string | null;
  /** `facets=true` 로 요청했을 때만. 건수 요청이 실패·시간 초과면 null — 결과는 그대로 온다. */
  attributeFacets?: AttributeFacets | null;
}

/**
 * 한국 행정구역 (ADR-0071). GeoNames 지명 계층(`/api/places/regions`)과 다른 축이다 —
 * 그쪽은 흥해읍·왜관읍이 CITY 로 섞인 지명 데이터셋이라 시군구로 쓸 수 없다.
 */
export interface AdministrativeRegion {
  code: string;
  parentCode: string | null;
  level: 'SIDO' | 'SIGUNGU';
  name: string;
  nameEn: string | null;
  latitude: number | null;
  longitude: number | null;
  /** 관광 분류 건수. lang 을 안 주면 null — 0(관광지 없음)과 다른 뜻이다. */
  attractionCount: number | null;
}

export const fetchAdministrativeRegions = async (
  params: { level?: 'SIDO' | 'SIGUNGU'; parent?: string; lang?: PlaceLang },
): Promise<AdministrativeRegion[]> => {
  const qs = new URLSearchParams();
  if (params.level) qs.set('level', params.level);
  if (params.parent) qs.set('parent', params.parent);
  if (params.lang) qs.set('lang', params.lang);
  const res = await api.get<ApiResponse<{ regions: AdministrativeRegion[] }>>(
    `/api/places/administrative-regions?${qs}`,
  );
  return res.data.data.regions;
};

/** 반나절(또는 하루) 날씨 — sky 는 기상청 중기예보 표현(맑음 · 구름많음 · 흐리고 비 …), pop 은 강수확률(%). */
export interface WeatherHalf {
  sky: string;
  pop: number | null;
}

/** 하루 날씨. 단기(SHORT)와 중기 4~7일은 am/pm, 중기 8~10일은 allDay 하나. 원천에 없는 칸은 null. */
export interface WeatherDay {
  date: string; // yyyy-MM-dd
  source: 'SHORT' | 'MID';
  min: number | null;
  max: number | null;
  am: WeatherHalf | null;
  pm: WeatherHalf | null;
  allDay: WeatherHalf | null;
}

export interface WeatherOutlook {
  sigunguCode: string;
  /** 단기·중기 발표 시각(yyyy-MM-ddTHH:mm, KST). 그 출처의 날이 없으면 null */
  shortBaseAt: string | null;
  midTmFc: string | null;
  /** 오늘부터, 신선도 기준을 넘긴 발표본의 날은 서버가 뺀다. 비면 절을 그리지 않는다 */
  days: WeatherDay[];
}

/**
 * 시군구 날씨(기상청 단기·중기예보). place 의 레디스 캐시 경로다 — 수집이 쓰면서 캐시를 채우고,
 * 이 요청은 캐시를 놓칠 때만 MySQL 에 닿는다 (ADR-0071 §10).
 */
export const fetchWeather = async (sigunguCode: string): Promise<WeatherOutlook> => {
  const res = await api.get<ApiResponse<WeatherOutlook>>(`/api/places/weather?sigungu=${encodeURIComponent(sigunguCode)}`);
  return res.data.data;
};

/** 오염물질 하나 — 원천(에어코리아) 문자열 그대로. grade 는 1 좋음 · 2 보통 · 3 나쁨 · 4 매우나쁨, flag 는 원천 상태 표시(통신장애 · 점검및교정 …). */
export interface AirPollutant {
  value: string | null;
  grade: string | null;
  flag: string | null;
}

/** 측정소 자신의 측정 — 측정 시각이 측정소마다 다를 수 있다. */
export interface AirMeasurement {
  sidoName: string;
  dataTime: string; // yyyy-MM-ddTHH:mm (KST)
  pm10: AirPollutant;
  pm25: AirPollutant;
}

/** 측정소 후보 하나. 좌표는 화면이 관광지에서 가장 가까운 후보를 고르는 데 쓴다. */
export interface AirStation {
  name: string;
  latitude: number;
  longitude: number;
  /** 측정 없음 · 3시간 초과면 서버가 null 로 낸다 */
  measurement: AirMeasurement | null;
}

export interface AirQuality {
  sigunguCode: string;
  /** 시군구 측정소 후보 — 그 시군구 관광지마다의 최근접 측정소를 다 품는다. 비면(후보 전) 절을 그리지 않는다 */
  stations: AirStation[];
}

/**
 * 시군구 측정소 후보의 실시간 대기(에어코리아). place 의 레디스 캐시 경로다 — 매시 수집이 쓰면서 캐시를 채우고,
 * 이 요청은 캐시를 놓칠 때만 MySQL 에 닿는다 (ADR-0071 §10).
 */
export const fetchAirQuality = async (sigunguCode: string): Promise<AirQuality> => {
  const res = await api.get<ApiResponse<AirQuality>>(`/api/places/air?sigungu=${encodeURIComponent(sigunguCode)}`);
  return res.data.data;
};

/** 지역 방문자 월 합계 — 현지인 · 외지인 · 외국인(원천 touDivCd 1·2·3). 다 받은 달만 온다. */
export interface RegionVisitorMonth {
  month: string; // yyyy-MM
  local: number;
  outsider: number;
  foreigner: number;
}

export interface RegionVisitorTrend {
  code: string;
  level: 'SIDO' | 'SIGUNGU';
  /** 받은 가장 최근 날(yyyy-MM-dd). 받은 적이 없으면 null */
  latestDate: string | null;
  months: RegionVisitorMonth[];
}

/**
 * 지역 허브 「방문 추이」(한국관광공사 빅데이터). place 의 레디스 캐시 경로다 — 수집이 쓰면서 캐시를 채우고,
 * 이 요청은 캐시를 놓칠 때만 MySQL 에 닿는다 (ADR-0071 §10).
 */
export const fetchRegionVisitors = async (code: string): Promise<RegionVisitorTrend> => {
  const res = await api.get<ApiResponse<RegionVisitorTrend>>(
    `/api/places/administrative-regions/${encodeURIComponent(code)}/visitors`,
  );
  return res.data.data;
};

export { SIGHT_CATEGORIES } from '../seo/copy.mjs';

/** 지도 위 토글로만 켜는 편의·식음·숙박 — 목록에는 올리지 않는다(숙박은 목록 칩이 아니라 여기다, ADR-0071 §5). */
export const OVERLAY_CATEGORIES = ['food', 'shopping', 'stay'] as const;

/** 목록 분류 칩의 행사 — 고르면 상태 칩이 나오고 시작일 순으로 받는다. */
export const EVENT_CATEGORY = 'festival';
/** 목록 분류 칩의 여행코스 — 국문 전용(영문 서비스에는 코스 유형이 없다). */
export const COURSE_CATEGORY = 'course';

/** 숙박 분류 — 상세의 「근처 숙소」가 이 분류만 받는다. */
export const STAY_CATEGORY = 'stay';

/**
 * 관광지 상세 아래 "주변 편의시설" 캐로셀에 올리는 분류.
 *
 * `etc` 는 **뺀다** — 그 안은 전량이 병원·성형외과·한의원(신 분류 `EX05` 의료관광)이라
 * 관광지 옆에 붙이면 목록에서 걷어낸 것을 캐로셀로 되돌려 놓는 셈이다.
 * 그래서 "관광 분류가 아닌 전부" 가 아니라 명시한다.
 *
 * 숙박(`stay`)은 여기 없다 — 「근처 숙소」 절이 그 몫을 갖는다. 둘 다에 두면 같은 숙소 카드가 한 화면에 두 번 뜬다.
 */
export const AMENITY_CATEGORIES = ['shopping', 'food'] as const;

export interface AttractionQuery {
  keyword?: string;
  lang: PlaceLang;
  areaCode?: string;
  /** 법정동 축 (ADR-0071). areaCode 와 같이 보내지 않는다 — 어느 쪽이 이기는지 알 수 없다. */
  sidoCode?: string;
  sigunguCode?: string;
  /**
   * **필수다.** 빼면 음식·쇼핑이 섞여 들어온다 — 적재의 절반 이상이 그쪽이라
   * "관광지 목록" 이 상점 목록이 된다. 실제로 상세 페이지 주변목록과 지역 페이지가
   * 이걸 빠뜨려 명동 주변 7/7 이 쇼핑, 부산 중구 영문 상위에 안과가 올라와 있었다.
   *
   * 전부 보고 싶으면 그 의도를 적어서 넘긴다 — 기본값으로 슬쩍 열리게 두지 않는다.
   */
  category: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  /** eventStart — 유효 시작일 오름차순(같으면 id). 행사 목록이 쓴다. */
  sort?: 'relevance' | 'distance' | 'eventStart';
  page?: number;
  size?: number;
  /**
   * 속성 필터 — 긍정 값만 받는다(서버가 `UNKNOWN`·부정은 무시한다). 속성끼리는 AND,
   * 반려동물 값끼리는 OR.
   */
  openToday?: boolean;
  parking?: 'YES';
  creditCard?: 'YES';
  strollerRental?: 'YES';
  pet?: Array<'ALLOWED' | 'PARTIAL'>;
  admission?: 'FREE';
  /** 무장애 코드 — 코드 사이는 AND */
  barrierFree?: BarrierFreeFilterCode[];
  /** 웰니스 테마가 있는 곳만 */
  wellness?: boolean;
  /**
   * 속성 패싯 건수 요청. 목록의 **첫 쪽만** 켠다 — 건수는 병렬 집계 요청 한 번이라,
   * 상세의 주변·편의시설 검색이나 지도 오버레이, 다음 쪽까지 켜면 조회마다 집계가 는다.
   */
  facets?: boolean;
  /**
   * 행사 상태 필터 — 「행사가 아니거나 이 범위 안」으로 걸린다(행사 아닌 문서는 영향 없음).
   * 범위는 서버가 KST 오늘로 정한다.
   */
  eventStatus?: 'ONGOING' | 'WEEKEND' | 'UPCOMING' | 'THIS_MONTH' | 'NOT_ENDED';
  /** 원래 검색어 검색 — 참이면 서버가 오타 교정을 건너뛰고 응답의 `correctedKeyword` 는 null 이다. */
  exact?: boolean;
}

export const searchAttractions = async (query: AttractionQuery): Promise<AttractionSearchResult> => {
  const params = new URLSearchParams({ lang: query.lang });
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.areaCode) params.set('areaCode', query.areaCode);
  if (query.sidoCode) params.set('sidoCode', query.sidoCode);
  if (query.sigunguCode) params.set('sigunguCode', query.sigunguCode);
  if (query.category) params.set('category', query.category);
  if (query.lat != null && query.lng != null) {
    params.set('lat', String(query.lat));
    params.set('lng', String(query.lng));
    if (query.radiusKm != null) params.set('radiusKm', String(query.radiusKm));
  }
  if (query.sort) params.set('sort', query.sort);
  if (query.openToday) params.set('openToday', 'true');
  if (query.parking) params.set('parking', query.parking);
  if (query.creditCard) params.set('creditCard', query.creditCard);
  if (query.strollerRental) params.set('strollerRental', query.strollerRental);
  if (query.pet && query.pet.length > 0) params.set('pet', query.pet.join(','));
  if (query.admission) params.set('admission', query.admission);
  if (query.barrierFree && query.barrierFree.length > 0) params.set('barrierFree', query.barrierFree.join(','));
  if (query.wellness) params.set('wellness', 'true');
  if (query.facets) params.set('facets', 'true');
  if (query.eventStatus) params.set('eventStatus', query.eventStatus);
  if (query.exact) params.set('exact', 'true');
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 30));
  const res = await api.get<ApiResponse<AttractionSearchResult>>(`/api/search/attractions?${params}`);
  return res.data.data;
};

/** 상세 응답 — 검색 결과 필드에 공유용 단축 주소를 더한다. 목록 응답에는 없다 */
export interface AttractionDetail extends Attraction {
  /** 서버 노출 설정이 꺼져 있으면 null — 공유 패널이 canonical 로 대신한다 */
  shortUrl?: string | null;
}

export const fetchAttraction = async (id: string): Promise<AttractionDetail> => {
  const res = await api.get<ApiResponse<AttractionDetail>>(`/api/search/attractions/${id}`);
  return res.data.data;
};

/** 관광지 상세 「주변 탐색」의 네 묶음 — 서버가 문서 좌표로 한 번에 찾는다. 자기 자신은 섞여 올 수 있다(화면이 뺀다). */
export interface AttractionNearby {
  sights: NearbyPlace[];
  stays: NearbyPlace[];
  events: NearbyPlace[];
  amenities: NearbyPlace[];
}

/** 주변 목록 한 줄 — 지도 핀과 목록 줄을 그리는 필드만 온다(search `NearbyPlace`). */
export type NearbyPlace = Pick<
  Attraction,
  | 'id'
  | 'lang'
  | 'title'
  | 'titleLocal'
  | 'category'
  | 'contentTypeId'
  | 'latitude'
  | 'longitude'
  | 'distanceKm'
  | 'imageUrl'
  | 'eventStart'
  | 'eventEnd'
>;

/**
 * 주변 탐색 — 명소(관광 분류 5km) · 숙소(5km) · 행사(20km, 끝나지 않은 것, 가까운 순) · 편의시설(음식·쇼핑 5km).
 * 키가 관광지 id 하나라 엣지가 캐시한다(ADR-0105). 조건은 search `NearbyAttractionsService` 가 갖는다.
 */
export const fetchAttractionNearby = async (id: string): Promise<AttractionNearby> => {
  const res = await api.get<ApiResponse<AttractionNearby>>(`/api/search/attractions/${id}/nearby`);
  return res.data.data;
};

/**
 * 관광지 외부 링크 (ADR-0070). 원천은 place 지만 화면은 place 를 부르지 않는다 — 재색인이 링크 행을
 * 관광지 문서에 싣고, 상세 응답(`Attraction.links`, 원문 JSON)을 `placeView.parseLinks` 가 이 모양으로 푼다
 * (ADR-0071 §서빙 경로).
 */
export type LinkRevenueType = 'PLAIN' | 'AFFILIATE';

export interface AttractionDeepLink {
  provider: string;
  kind: 'SOCIAL' | 'TOUR_PRODUCT';
  url: string;
  revenueType: LinkRevenueType;
}

export interface CollectedLink {
  source: 'YOUTUBE' | 'NAVER_BLOG';
  title: string;
  url: string;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  /** 영상 조회수. 인기순 정렬의 근거이자 카드에 보이는 값. */
  viewCount: number | null;
  /** 원천 식별자(영상 id). 쇼츠는 이것으로 쇼츠 주소를 만든다 */
  externalId?: string;
  /** 영상 형태 — 세로·3분 이하면 SHORT(place `VideoFormat`). 길이·비율을 아직 모르면 null */
  format?: 'LONG' | 'SHORT' | null;
}

export interface AttractionLinks {
  collected: CollectedLink[];
  deepLinks: AttractionDeepLink[];
  /** 수집 대기 — 오류가 아니다. 조회가 큐를 채우고 CronJob 이 비운다. */
  pending: boolean;
}

// 통합 자동완성 — 지역(행정 계층, 인구 부스트 상단) + 관광지 prefix (ADR-0065)
export interface Suggestion {
  type: 'REGION' | 'ATTRACTION';
  id: string;
  title: string;
  /** 원어 병기명 (Attraction.titleLocal 과 같은 계약) — 구 응답·지역 항목에는 없다 */
  titleLocal?: string | null;
  latitude: number | null;
  longitude: number | null;
  regionLevel: 'CONTINENT' | 'COUNTRY' | 'REGION' | 'CITY' | null;
  category: string | null;
}

export const suggestPlaces = async (q: string, lang: PlaceLang, size = 8): Promise<Suggestion[]> => {
  const params = new URLSearchParams({ q, lang, size: String(size) });
  const res = await api.get<ApiResponse<Suggestion[]>>(`/api/search/attractions/suggest?${params}`);
  return res.data.data;
};
