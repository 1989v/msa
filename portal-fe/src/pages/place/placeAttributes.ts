import type {
  Attraction,
  AttractionQuery,
  AttributeFacets,
  PlaceLang,
} from '../../api/placeApi';

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
  | 'admissionFree';

export const ATTRIBUTE_CHIPS: ReadonlyArray<{ id: AttributeChipId; ko: string; en: string }> = [
  { id: 'openToday', ko: '오늘 정기휴무 아님', en: 'Not closed today' },
  { id: 'parking', ko: '주차 가능', en: 'Parking' },
  { id: 'creditCard', ko: '신용카드', en: 'Credit cards' },
  { id: 'strollerRental', ko: '유모차 대여', en: 'Stroller rental' },
  { id: 'petAllowed', ko: '반려동물 동반', en: 'Pets allowed' },
  { id: 'petPartial', ko: '반려동물 일부 구역', en: 'Pets in some areas' },
  { id: 'admissionFree', ko: '입장 무료', en: 'Free admission' },
];

export const ATTRIBUTE_CAPTION: Record<PlaceLang, string> = {
  ko: '정보가 있는 곳만 거릅니다',
  en: 'Filters only places that list this information',
};

/** 고른 칩 → 검색 파라미터. 반려동물 두 칩은 한 파라미터(CSV, OR)로 합친다. */
export function attributeQuery(selected: ReadonlySet<AttributeChipId>): Pick<
  AttractionQuery,
  'openToday' | 'parking' | 'creditCard' | 'strollerRental' | 'pet' | 'admission'
> {
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
  }
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
  const place = regionPlaceName(a, lang);
  const category = region.categoryName?.trim() || null;
  if (category != null && region.categoryCount != null) {
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
