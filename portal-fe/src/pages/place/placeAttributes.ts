import type {
  Attraction,
  AttractionQuery,
  AttributeFacets,
  BarrierFreeFilterCode,
  PlaceLang,
} from '../../api/placeApi';
import { PLACE_COURSE_TYPES, PLACE_EVENT_TYPES, PLACE_STAY_TYPES, placeIntroText, sourceText } from '../../seo/copy.mjs';

/*
 * 속성 패싯 — 검색 화면의 속성 칩과 상세의 방문 정보 배지.
 *
 * 배지·지역 문구·섹션 제목은 서버 렌더(search `AttractionPageRenderer` 의 badges · regionSection · similarSection)와
 * **같은 문구·같은 순서**다. 크롤러가 읽은 본문과 하이드레이션 뒤 화면이 달라지지 않게 한다 —
 * 한쪽 문구를 고치면 다른 쪽도 고친다.
 */

export type AttributeChipId =
  | 'openToday'
  | 'parking'
  | 'creditCard'
  | 'strollerRental'
  | 'petAllowed'
  | 'petPartial'
  | 'admissionFree'
  | 'bfWheelchair'
  | 'bfElevator'
  | 'bfRestroom'
  | 'wellness';

/** 무장애 칩 → 서버 코드. 라벨 정밀도 95% 이상인 키만 연다(search `BarrierFreeInfo.FILTER_CODES`). */
const BARRIER_FREE_CHIPS: ReadonlyArray<[AttributeChipId, BarrierFreeFilterCode]> = [
  ['bfWheelchair', 'WHEELCHAIR'],
  ['bfElevator', 'ELEVATOR'],
  ['bfRestroom', 'RESTROOM'],
];

/** `only` 가 있으면 그 언어 목록에만 칩을 둔다 — 무장애 원천은 국문뿐이라 영문에서는 늘 0 이다. */
export const ATTRIBUTE_CHIPS: ReadonlyArray<{ id: AttributeChipId; ko: string; en: string; only?: PlaceLang }> = [
  { id: 'openToday', ko: '오늘 정기휴무 아님', en: 'Not closed today' },
  { id: 'parking', ko: '주차 가능', en: 'Parking' },
  { id: 'creditCard', ko: '신용카드', en: 'Credit cards' },
  { id: 'strollerRental', ko: '유모차 대여', en: 'Stroller rental' },
  { id: 'petAllowed', ko: '반려동물 동반', en: 'Pets allowed' },
  { id: 'petPartial', ko: '반려동물 일부 구역', en: 'Pets in some areas' },
  { id: 'admissionFree', ko: '입장 무료', en: 'Free admission' },
  { id: 'bfWheelchair', ko: '휠체어', en: 'Wheelchairs', only: 'ko' },
  { id: 'bfElevator', ko: '엘리베이터', en: 'Elevator', only: 'ko' },
  { id: 'bfRestroom', ko: '장애인 화장실', en: 'Accessible restroom', only: 'ko' },
  { id: 'wellness', ko: '웰니스 관광', en: 'Wellness tourism' },
];

export function attributeChips(lang: PlaceLang) {
  return ATTRIBUTE_CHIPS.filter((chip) => chip.only == null || chip.only === lang);
}

export const ATTRIBUTE_CAPTION: Record<PlaceLang, string> = {
  ko: '정보가 있는 곳만 거릅니다',
  en: 'Filters only places that list this information',
};

/** 고른 칩 → 검색 파라미터. 반려동물 두 칩은 한 파라미터(CSV, OR)로 합친다. */
export function attributeQuery(selected: ReadonlySet<AttributeChipId>): Pick<
  AttractionQuery,
  'openToday' | 'parking' | 'creditCard' | 'strollerRental' | 'pet' | 'admission' | 'barrierFree' | 'wellness'
> {
  const barrierFree = BARRIER_FREE_CHIPS.filter(([chip]) => selected.has(chip)).map(([, code]) => code);
  const pet: Array<'ALLOWED' | 'PARTIAL'> = [];
  if (selected.has('petAllowed')) pet.push('ALLOWED');
  if (selected.has('petPartial')) pet.push('PARTIAL');
  return {
    openToday: selected.has('openToday') || undefined,
    parking: selected.has('parking') ? 'YES' : undefined,
    creditCard: selected.has('creditCard') ? 'YES' : undefined,
    strollerRental: selected.has('strollerRental') ? 'YES' : undefined,
    pet: pet.length > 0 ? pet : undefined,
    admission: selected.has('admissionFree') ? 'FREE' : undefined,
    barrierFree: barrierFree.length > 0 ? barrierFree : undefined,
    wellness: selected.has('wellness') || undefined,
  };
}

/** 칩의 건수. 건수를 못 받았으면(null) null — 0 과 다른 뜻이다(모름 ≠ 없음). */
export function chipCount(facets: AttributeFacets | null | undefined, id: AttributeChipId): number | null {
  if (!facets) return null;
  switch (id) {
    case 'openToday': return facets.openToday ?? 0;
    case 'parking': return facets.parking?.YES ?? 0;
    case 'creditCard': return facets.creditCard?.YES ?? 0;
    case 'strollerRental': return facets.strollerRental?.YES ?? 0;
    case 'petAllowed': return facets.pet?.ALLOWED ?? 0;
    case 'petPartial': return facets.pet?.PARTIAL ?? 0;
    case 'admissionFree': return facets.admission?.FREE ?? 0;
    case 'bfWheelchair': return facets.barrierFree?.WHEELCHAIR ?? 0;
    case 'bfElevator': return facets.barrierFree?.ELEVATOR ?? 0;
    case 'bfRestroom': return facets.barrierFree?.RESTROOM ?? 0;
    case 'wellness': return facets.wellness ?? 0;
  }
}

/*
 * 접근성 정보(원천: 무장애 여행) — 서버 렌더(search `AttractionPageRenderer.barrierFreeSection`)와 같은 표 · 같은 순서 · 같은 문구.
 * 키 표는 search `BarrierFreeInfo.KEYS` 와 같다(원천 키 이름의 오타 `braile` 은 원천 그대로).
 */
const BARRIER_FREE_KEYS: ReadonlyArray<{ key: string; ko: string; en: string }> = [
  { key: 'parking', ko: '주차', en: 'Parking' },
  { key: 'publictransport', ko: '대중교통', en: 'Public transport' },
  { key: 'route', ko: '접근로', en: 'Access route' },
  { key: 'ticketoffice', ko: '매표소', en: 'Ticket office' },
  { key: 'promotion', ko: '홍보물', en: 'Brochures' },
  { key: 'wheelchair', ko: '휠체어', en: 'Wheelchairs' },
  { key: 'exit', ko: '출입통로', en: 'Entrance' },
  { key: 'elevator', ko: '엘리베이터', en: 'Elevator' },
  { key: 'restroom', ko: '화장실', en: 'Restrooms' },
  { key: 'auditorium', ko: '관람석', en: 'Seating' },
  { key: 'room', ko: '객실', en: 'Rooms' },
  { key: 'handicapetc', ko: '지체장애 기타', en: 'Mobility, other' },
  { key: 'braileblock', ko: '점자블록', en: 'Tactile paving' },
  { key: 'helpdog', ko: '보조견 동반', en: 'Assistance dogs' },
  { key: 'guidehuman', ko: '안내요원', en: 'Guide staff' },
  { key: 'audioguide', ko: '오디오가이드', en: 'Audio guide' },
  { key: 'bigprint', ko: '큰활자 홍보물', en: 'Large print' },
  { key: 'brailepromotion', ko: '점자 홍보물', en: 'Braille materials' },
  { key: 'guidesystem', ko: '유도안내설비', en: 'Guidance system' },
  { key: 'blindhandicapetc', ko: '시각장애 기타', en: 'Vision, other' },
  { key: 'signguide', ko: '수어 안내', en: 'Sign language' },
  { key: 'videoguide', ko: '자막 영상 안내', en: 'Captioned video' },
  { key: 'hearingroom', ko: '청각장애 객실', en: 'Rooms for hearing impaired' },
  { key: 'hearinghandicapetc', ko: '청각장애 기타', en: 'Hearing, other' },
  { key: 'stroller', ko: '유모차', en: 'Strollers' },
  { key: 'lactationroom', ko: '수유실', en: 'Nursing room' },
  { key: 'babysparechair', ko: '유아용 의자', en: 'Baby chairs' },
  { key: 'infantsfamilyetc', ko: '영유아 가족 기타', en: 'Families with infants, other' },
];

/** 상세 위쪽 아이콘 줄 — 긍정 코드만, 이 순서(search `BarrierFreeInfo.ICONS`) */
const BARRIER_FREE_ICONS: ReadonlyArray<{ code: string; ko: string; en: string }> = [
  { code: 'WHEELCHAIR', ko: '휠체어', en: 'Wheelchairs' },
  { code: 'ELEVATOR', ko: '엘리베이터', en: 'Elevator' },
  { code: 'RESTROOM', ko: '장애인 화장실', en: 'Accessible restroom' },
  { code: 'PARKING', ko: '장애인 주차', en: 'Accessible parking' },
  { code: 'STROLLER', ko: '유모차', en: 'Strollers' },
  { code: 'LACTATION_ROOM', ko: '수유실', en: 'Nursing room' },
];

export const BARRIER_FREE_TITLE: Record<PlaceLang, string> = { ko: '접근성 정보', en: 'Accessibility' };
/** 원천 문장을 펼치는 줄 — 몇 항목인지 미리 보인다 */
export const BARRIER_FREE_DETAILS: Record<PlaceLang, (n: number) => string> = {
  ko: (n) => `접근성 상세 ${n}항목`,
  en: (n) => `Accessibility details (${n})`,
};

export function barrierFreeIcons(a: Attraction, lang: PlaceLang): string[] {
  const flags = a.barrierFree ?? [];
  return BARRIER_FREE_ICONS.filter((i) => flags.includes(i.code)).map((i) => i[lang]);
}

/** 원천 키 순서대로, 값이 있는 줄만 (라벨, 원문 평문) — 문장은 고치지 않는다 */
export function barrierFreeRows(a: Attraction, lang: PlaceLang): Array<{ key: string; label: string; value: string }> {
  const detail = a.barrierFreeDetail ?? {};
  return BARRIER_FREE_KEYS
    .map((k) => ({ key: k.key, label: k[lang], value: detail[k.key] == null ? '' : sourceText(String(detail[k.key])) }))
    .filter((r) => r.value.length > 0);
}

/** 「웰니스 관광 · {테마 이름}」 — 테마가 없으면 null, 이름을 모르면 앞말만 */
export function wellnessLine(a: Attraction, lang: PlaceLang): string | null {
  if (!a.wellnessTheme) return null;
  const head = lang === 'en' ? 'Wellness tourism' : '웰니스 관광';
  const name = a.wellnessThemeName?.trim();
  return name ? `${head} · ${name}` : head;
}

/** 출처 — TourAPI 에 이 관광지가 실제로 쓴 관광공사 원천 이름을 잇는다(서버 렌더 `sourceLine` 과 같은 문구) */
export function placeSourceLine(a: Attraction | null | undefined, lang: PlaceLang): string {
  const en = lang === 'en';
  const hasBarrierFree = (a?.barrierFree?.length ?? 0) > 0 || Object.keys(a?.barrierFreeDetail ?? {}).length > 0;
  return [
    en ? 'Source: Korea Tourism Organization TourAPI' : '출처: 한국관광공사 TourAPI',
    hasBarrierFree ? (en ? 'Barrier-free travel' : '무장애 여행 정보') : null,
    a?.wellnessTheme ? (en ? 'Wellness tourism' : '웰니스관광 정보') : null,
    a?.camping ? (en ? 'GoCamping' : '고캠핑') : null,
    (a?.relatedPlaces?.length ?? 0) > 0 ? (en ? 'Big Data (related attractions)' : '빅데이터 서비스(연관 관광지)') : null,
  ].filter((s): s is string => s != null).join(' · ');
}

/** 고캠핑 사이트 수 키 — (원문 키, 국문, 영문). 서버 렌더 `CAMPING_SITES` 와 같은 순서 */
const CAMPING_SITES: Array<[string, string, string]> = [
  ['gnrlSiteCo', '일반', 'Tent'],
  ['autoSiteCo', '자동차', 'Auto'],
  ['glampSiteCo', '글램핑', 'Glamping'],
  ['caravSiteCo', '카라반', 'Caravan'],
  ['indvdlCaravSiteCo', '개인 카라반', 'Own caravan'],
];

/**
 * 「캠핑장 정보」 줄 — 고캠핑 원문 중 place 가 고른 키(JSON 객체 문자열). 서버 렌더 `campingSection` 과 같은 줄·순서·문구.
 * 사이트 수는 0 인 종류를 뺀다. 원문을 못 읽으면 빈 목록.
 */
export function campingRows(raw: string | null | undefined, lang: PlaceLang): Array<{ label: string; value: string }> {
  if (!raw) return [];
  let node: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    node = parsed as Record<string, unknown>;
  } catch {
    return [];
  }
  const en = lang === 'en';
  const v = (key: string) => (typeof node[key] === 'string' ? (node[key] as string).trim() : '') || null;
  const sites = CAMPING_SITES.flatMap(([key, ko, enLabel]) => {
    const n = Number.parseInt(v(key) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? [`${en ? enLabel : ko} ${n}`] : [];
  }).join(' · ');
  const comma = (s: string) => s.replace(/,/g, ', ');
  const rows: Array<[string, string | null]> = [
    [en ? 'Type' : '업종', v('induty') && comma(v('induty')!)],
    [en ? 'Sites' : '사이트', sites || null],
    [en ? 'Facilities' : '부대시설', v('sbrsCl') && comma(v('sbrsCl')!)],
    [en ? 'Pets' : '반려동물 동반', v('animalCmgCl')],
    [en ? 'Season' : '운영 기간', v('operPdCl') && comma(v('operPdCl')!)],
    [en ? 'Days' : '운영일', v('operDeCl')],
    [en ? 'Status' : '운영 상태', v('manageSttus')],
  ];
  return rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

const KO_DAY: Record<string, string> = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };
const EN_DAY: Record<string, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};
const WEEK_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function closureBadge(a: Attraction, en: boolean): string | null {
  switch (a.closureState) {
    case 'ALWAYS_OPEN': return en ? 'Open every day' : '연중무휴';
    case 'NO_WEEKLY': return en ? 'No weekly closing day' : '매주 쉬는 요일 없음';
    case 'WEEKLY': {
      // 요일 없는 WEEKLY 는 서버도 「모름」으로 읽는다 — 배지를 내지 않는다
      const days = WEEK_ORDER.filter((d) => (a.closedWeekdays ?? []).includes(d));
      if (days.length === 0) return null;
      return en
        ? 'Closed on ' + days.map((d) => `${EN_DAY[d]}s`).join(', ')
        : '매주 ' + days.map((d) => KO_DAY[d]).join('·') + '요일 휴무';
    }
    default: return null;
  }
}

function availability(value: string | null | undefined, yes: string, no: string): string | null {
  if (value === 'YES') return yes;
  if (value === 'NO') return no;
  return null;
}

/**
 * 「많이 클릭한 곳」 최소 표본 — 14일 고유 클릭 방문자가 이 수 이상일 때만 배지를 붙인다.
 * search `AttractionClickSignal.MIN_SAMPLE`(search/domain) 과 같은 값이어야 한다 — 서버 렌더가 그 상수로 판단한다.
 */
export const FREQUENTLY_CLICKED_MIN = 5;

/**
 * 방문 정보 배지 — 해석된 값만. `UNKNOWN` 은 그리지 않는다(「모른다」가 「아니다」로 읽히지 않게).
 * 순서: 정기휴무 · 주차 · 반려동물 · 신용카드 · 유모차 대여 · 입장료 · 많이 클릭한 곳.
 */
export function visitorBadges(a: Attraction, lang: PlaceLang): string[] {
  const en = lang === 'en';
  const pet =
    a.petPolicy === 'ALLOWED' ? (en ? 'Pets allowed' : '반려동물 동반 가능')
      : a.petPolicy === 'PARTIAL' ? (en ? 'Pets allowed in some areas' : '반려동물 일부 구역 동반 가능')
        : null;
  const admission =
    a.attrAdmission === 'FREE' ? (en ? 'Free admission' : '입장 무료')
      : a.attrAdmission === 'PAID' ? (en ? 'Paid admission' : '입장 유료')
        : null;
  return [
    closureBadge(a, en),
    availability(a.attrParking, en ? 'Parking available' : '주차 가능', en ? 'No parking' : '주차 불가'),
    pet,
    availability(a.attrCreditCard, en ? 'Credit cards accepted' : '신용카드 가능', en ? 'Credit cards not accepted' : '신용카드 불가'),
    availability(a.attrStrollerRental, en ? 'Stroller rental' : '유모차 대여', en ? 'No stroller rental' : '유모차 대여 없음'),
    admission,
    (a.uniqueClickers14d ?? 0) >= FREQUENTLY_CLICKED_MIN ? (en ? 'Frequently clicked' : '많이 클릭한 곳') : null,
  ].filter((s): s is string => s != null);
}

/**
 * 원천 관광 유형(contentTypeId) 이름 — 서버 렌더의 CONTENT_TYPE_KO · CONTENT_TYPE_EN 과 같은 표.
 * 국문·영문 서비스의 코드 체계가 다르다 (place-ingest `sync_tour.py` CONTENT_TYPES).
 */
const CONTENT_TYPE_KO: Record<string, string> = {
  '12': '관광지', '14': '문화시설', '15': '축제·행사', '25': '여행코스',
  '28': '레포츠', '32': '숙박', '38': '쇼핑', '39': '음식점',
};
const CONTENT_TYPE_EN: Record<string, string> = {
  '76': 'attractions', '78': 'cultural sites', '85': 'festivals', '75': 'leisure spots',
  '80': 'places to stay', '79': 'shopping spots', '82': 'restaurants', '77': 'transport hubs',
};

/**
 * 「{시군구} {유형} N곳 중 {분류} M곳」 / 「{분류} {M} of {N} {유형} in {시군구}」.
 *
 * 유형을 모르면 null 이다. 서버는 문서의 유형 코드를 알지만 화면이 받는 상세 응답에는 아직 없다 —
 * 「관광지」로 짐작해 넣으면 문화시설 문서에서 N 이 무엇을 센 수인지가 틀린다.
 */
export function regionPhrase(a: Attraction, lang: PlaceLang): string | null {
  const region = a.region;
  if (!region) return null;
  const en = lang === 'en';
  const type = a.contentTypeId ? (en ? CONTENT_TYPE_EN : CONTENT_TYPE_KO)[a.contentTypeId] : undefined;
  if (!type) return null;
  // 끝난 행사 자기 문서는 후보에서 빠져 건수가 0 일 수 있다 — 「0곳」은 그리지 않는다(서버 렌더와 같은 규칙)
  if (region.typeCount <= 0) return null;
  const place = regionPlaceName(a, lang);
  const category = region.categoryName?.trim() || null;
  if (category != null && region.categoryCount != null && region.categoryCount > 0) {
    return en
      ? `${category} ${region.categoryCount} of ${region.typeCount} ${type} in ${place}`
      : `${place} ${type} ${region.typeCount}곳 중 ${category} ${region.categoryCount}곳`;
  }
  return en ? `${region.typeCount} ${type} in ${place}` : `${place} ${type} ${region.typeCount}곳`;
}

export function regionPlaceName(a: Attraction, lang: PlaceLang): string {
  return a.region?.sigunguName?.trim() || (lang === 'en' ? 'this district' : '이 지역');
}

/** 시군구 허브 코드(시도 2자리 + 시군구). 둘 중 하나라도 없으면 null — 링크를 걸지 않는다. */
export function regionHubCode(a: Attraction): string | null {
  const sido = a.sidoCode?.trim();
  const sigungu = a.region?.ldongSignguCd?.trim();
  return sido && sigungu ? sido + sigungu : null;
}

/** 서버 렌더 `distance` 와 같은 표기 — 1km 미만은 m, 이상은 소수 한 자리 km. */
export function distanceLabel(meters: number): string {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

/*
 * 유형별 본문 — 행사 · 숙박 · 여행코스는 일반 「이용 안내」 대신 자기 절을 그린다(서버 렌더 `typeSection` 과
 * 같은 제목·라벨·순서). 원문 키는 허용 목록으로만 고른다 — 숙박의 예약 URL·예약 안내는 목록에 없어 나가지 않는다.
 */
export type PlaceKind = 'event' | 'stay' | 'course';

export function placeKind(contentTypeId: string | null | undefined): PlaceKind | null {
  if (contentTypeId == null) return null;
  if ((PLACE_EVENT_TYPES as string[]).includes(contentTypeId)) return 'event';
  if ((PLACE_STAY_TYPES as string[]).includes(contentTypeId)) return 'stay';
  if ((PLACE_COURSE_TYPES as string[]).includes(contentTypeId)) return 'course';
  return null;
}

export const KIND_SECTION_TITLE: Record<PlaceKind, Record<PlaceLang, string>> = {
  event: { ko: '행사 정보', en: 'Event info' },
  stay: { ko: '숙박 정보', en: 'Stay info' },
  course: { ko: '코스 구성', en: 'Course' },
};

export const EVENT_PERIOD_LABEL: Record<PlaceLang, string> = { ko: '기간', en: 'Dates' };

const KIND_INTRO: Record<PlaceKind, ReadonlyArray<{ key: string; ko: string; en: string }>> = {
  event: [
    { key: 'eventplace', ko: '행사 장소', en: 'Venue' },
    { key: 'playtime', ko: '공연 시간', en: 'Hours' },
    { key: 'usetimefestival', ko: '이용 요금', en: 'Admission' },
    { key: 'sponsor1', ko: '주최', en: 'Organizer' },
  ],
  stay: [
    { key: 'checkintime', ko: '입실', en: 'Check-in' },
    { key: 'checkouttime', ko: '퇴실', en: 'Check-out' },
    { key: 'roomcount', ko: '객실 수', en: 'Rooms' },
    { key: 'roomtype', ko: '객실 유형', en: 'Room types' },
    { key: 'parkinglodging', ko: '주차', en: 'Parking' },
    { key: 'subfacility', ko: '부대시설', en: 'Facilities' },
  ],
  course: [
    { key: 'distance', ko: '총 거리', en: 'Total distance' },
    { key: 'taketime', ko: '소요 시간', en: 'Time needed' },
  ],
};

/** 허용 목록 순서대로, 원문에 값이 있는 키만 (라벨, 평문) */
export function kindIntroRows(
  introRaw: string | null | undefined,
  kind: PlaceKind,
  lang: PlaceLang,
): Array<{ key: string; label: string; value: string }> {
  return KIND_INTRO[kind]
    .map((k) => ({ key: k.key, label: k[lang], value: placeIntroText(introRaw ?? null, k.key) }))
    .filter((r) => r.value.length > 0);
}
