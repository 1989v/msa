import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Attraction } from '../../../api/placeApi';
import { cardFacts } from '../placeAttributes';
import { todayKst } from '../../../seo/eventSchedule';

/*
 * 허브 결과 카드의 판정 — 카드는 이 함수가 낸 값만 그린다. 판정 근거는 전부 cardFacts 의 반환값이다.
 * 요일은 인자 `today`(KST 날짜)로만 정해야 한다 — 시스템 시계는 일부러 다른 요일에 두어,
 * 함수가 시계나 기기 시간대를 읽으면 틀린 요일이 나오게 한다.
 */
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Seoul';
  vi.useFakeTimers({ toFake: ['Date'] });
  // 시스템 시계 = 2026-10-28(수) KST — 아래 today 인자(26일 월요일)와 다른 요일
  vi.setSystemTime(new Date('2026-10-28T03:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = ORIGINAL_TZ;
});
afterEach(() => {
  process.env.TZ = 'Asia/Seoul';
});

const MON = '2026-10-26';
const TUE = '2026-10-27';

const base = (over: Partial<Attraction> = {}): Attraction => ({
  id: '1', contentId: '1', lang: 'ko', title: '경복궁', category: 'history', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0, contentTypeId: '12',
  ...over,
});
const codes = (a: Attraction, today = MON, lang: 'ko' | 'en' = 'ko') => cardFacts(a, lang, today).badges.map((b) => b.code);
const texts = (a: Attraction, today = MON, lang: 'ko' | 'en' = 'ko') => cardFacts(a, lang, today).badges.map((b) => b.text);

describe('cardFacts — 카드 상태 배지 표', () => {
  it('WEEKLY 이고 오늘(KST) 요일이 휴무일이면 「오늘은 정기휴무일」 + 규칙 기준 접근성 문구', () => {
    const a = base({ closureState: 'WEEKLY', closedWeekdays: ['MON', 'TUE'] });
    const [ko] = cardFacts(a, 'ko', MON).badges;
    expect(ko).toMatchObject({ code: 'closedToday', text: '오늘은 정기휴무일' });
    expect(ko.srText).toBe('오늘은 정기휴무일(매주 월·화 휴무 규칙 기준)');
    const [en] = cardFacts({ ...a, lang: 'en' }, 'en', MON).badges;
    expect(en).toMatchObject({ code: 'closedToday', text: 'Regular closing day today' });
    expect(en.srText).toBe('Regular closing day today (weekly rule: Mon, Tue)');
  });

  it('WEEKLY 이고 오늘이 아니면 요일 휴무 — 요일은 월→일 순', () => {
    const a = base({ closureState: 'WEEKLY', closedWeekdays: ['SUN', 'MON'] });
    expect(cardFacts(a, 'ko', TUE).badges[0]).toMatchObject({ code: 'weeklyClosed', text: '월·일 휴무' });
    expect(cardFacts(a, 'en', TUE).badges[0]).toMatchObject({ code: 'weeklyClosed', text: 'Closed Mon, Sun' });
    expect(cardFacts(a, 'ko', TUE).badges[0].srText).toBeUndefined();
  });

  it('ALWAYS_OPEN 은 연중무휴', () => {
    expect(texts(base({ closureState: 'ALWAYS_OPEN' }))).toEqual(['연중무휴']);
    expect(texts(base({ closureState: 'ALWAYS_OPEN' }), MON, 'en')).toEqual(['Open every day']);
  });

  it('입장 무료 · 반려동물 동반/일부 · 주차 가능 — 국·영 문구', () => {
    expect(texts(base({ attrAdmission: 'FREE' }))).toEqual(['입장 무료']);
    expect(texts(base({ attrAdmission: 'FREE' }), MON, 'en')).toEqual(['Free admission']);
    expect(cardFacts(base({ petPolicy: 'ALLOWED' }), 'ko', MON).badges).toEqual([{ code: 'pet', text: '반려동물 동반' }]);
    expect(cardFacts(base({ petPolicy: 'PARTIAL' }), 'ko', MON).badges).toEqual([{ code: 'petPartial', text: '반려동물 일부 구역' }]);
    expect(texts(base({ petPolicy: 'ALLOWED' }), MON, 'en')).toEqual(['Pets allowed']);
    expect(texts(base({ petPolicy: 'PARTIAL' }), MON, 'en')).toEqual(['Pets in some areas']);
    expect(cardFacts(base({ attrParking: 'YES' }), 'ko', MON).badges).toEqual([{ code: 'parking', text: '주차 가능' }]);
    expect(texts(base({ attrParking: 'YES' }), MON, 'en')).toEqual(['Parking']);
  });

  it('무장애 — 목록 필터 정밀 3종 중 하나면 「무장애 시설」, 저정밀·비시설 코드만 있으면 배지 없음', () => {
    expect(cardFacts(base({ barrierFree: ['ELEVATOR'] }), 'ko', MON).badges).toEqual([{ code: 'barrierFree', text: '무장애 시설' }]);
    expect(texts(base({ barrierFree: ['WHEELCHAIR'] }), MON, 'en')).toEqual(['Accessible facilities']);
    expect(codes(base({ barrierFree: ['PROMOTION', 'LACTATION_ROOM'] }))).toEqual([]);
  });

  it('그리지 않는 값 — 요일 없는 WEEKLY · NO_WEEKLY · UNKNOWN · null, 주차 NO·UNKNOWN, 입장 PAID·UNKNOWN, 반려 UNKNOWN', () => {
    for (const a of [
      base({ closureState: 'WEEKLY', closedWeekdays: [] }),
      base({ closureState: 'WEEKLY', closedWeekdays: null }),
      base({ closureState: 'NO_WEEKLY' }),
      base({ closureState: 'UNKNOWN' }),
      base({ closureState: null }),
      base({ attrParking: 'NO' }),
      base({ attrParking: 'UNKNOWN' }),
      base({ attrAdmission: 'PAID' }),
      base({ attrAdmission: 'UNKNOWN' }),
      base({ petPolicy: 'UNKNOWN' }),
      base({ barrierFree: [] }),
      base({ barrierFree: null }),
    ]) {
      expect(cardFacts(a, 'ko', MON).badges).toEqual([]);
    }
  });

  it('최대 3개 · 순서는 휴무 → 무료 → 반려 → 무장애 → 주차 (넘치면 뒤를 버린다)', () => {
    const all = base({
      closureState: 'WEEKLY', closedWeekdays: ['MON'], attrAdmission: 'FREE', petPolicy: 'ALLOWED',
      barrierFree: ['RESTROOM'], attrParking: 'YES',
    });
    expect(codes(all)).toEqual(['closedToday', 'free', 'pet']);
    expect(codes({ ...all, closureState: 'UNKNOWN' })).toEqual(['free', 'pet', 'barrierFree']);
    expect(codes({ ...all, closureState: 'UNKNOWN', attrAdmission: 'PAID' })).toEqual(['pet', 'barrierFree', 'parking']);
    expect(codes({ ...all, attrAdmission: 'PAID', petPolicy: 'UNKNOWN' })).toEqual(['closedToday', 'barrierFree', 'parking']);
  });

  it('행사 유형은 속성 배지를 내지 않는다 — 기간·상태는 행사 줄이 맡는다', () => {
    const ev = base({ contentTypeId: '15', closureState: 'ALWAYS_OPEN', attrAdmission: 'FREE', attrParking: 'YES' });
    expect(cardFacts(ev, 'ko', MON).badges).toEqual([]);
  });
});

describe('cardFacts — KST 날짜 경계', () => {
  it('UTC 15:00 은 KST 다음 날 — 호출부가 넘기는 todayKst() 가 다음 날이고, 판정은 그 날짜의 요일이다', () => {
    vi.setSystemTime(new Date('2026-10-25T15:00:00Z')); // UTC 일요일 15:00 = KST 월요일 00:00
    const today = todayKst();
    expect(today).toBe(MON);
    const a = base({ closureState: 'WEEKLY', closedWeekdays: ['MON'] });
    expect(codes(a, today)).toEqual(['closedToday']);
    vi.setSystemTime(new Date('2026-10-28T03:00:00Z'));
  });

  it('요일은 인자 날짜로만 정한다 — 시스템 시계(수요일)와 기기 시간대가 달라도 같은 판정', () => {
    const a = base({ closureState: 'WEEKLY', closedWeekdays: ['MON'] });
    expect(codes(a, MON)).toEqual(['closedToday']);
    expect(codes(a, TUE)).toEqual(['weeklyClosed']);
    // 기기가 UTC 보다 늦은 시간대여도 「2026-10-26」은 월요일이다
    process.env.TZ = 'America/Los_Angeles';
    expect(codes(a, MON)).toEqual(['closedToday']);
    expect(codes(a, TUE)).toEqual(['weeklyClosed']);
  });
});

describe('cardFacts — 지역 라벨 · 거리 · 찜 수', () => {
  it('지역 라벨 — 국 「시도 시군구」 · 영 「시군구, 시도」 / 시군구 없으면 시도 / 세종(같은 이름)은 시도 / 둘 다 없으면 null', () => {
    const a = base({ sidoName: '서울특별시', sigunguName: '종로구' });
    expect(cardFacts(a, 'ko', MON).regionLabel).toBe('서울특별시 종로구');
    expect(cardFacts({ ...a, lang: 'en', sidoName: 'Seoul', sigunguName: 'Jongno-gu' }, 'en', MON).regionLabel).toBe('Jongno-gu, Seoul');
    expect(cardFacts(base({ sidoName: ' 강원특별자치도 ', sigunguName: null }), 'ko', MON).regionLabel).toBe('강원특별자치도');
    expect(cardFacts(base({ sidoName: '세종특별자치시', sigunguName: '세종특별자치시' }), 'ko', MON).regionLabel).toBe('세종특별자치시');
    expect(cardFacts(base({ sidoName: null, sigunguName: null }), 'ko', MON).regionLabel).toBeNull();
    expect(cardFacts(base({ sidoName: '  ', sigunguName: '' }), 'ko', MON).regionLabel).toBeNull();
  });

  it('거리 — 서버 렌더와 같은 표기, m 는 정수로 반올림해 넘긴다', () => {
    expect(cardFacts(base({ distanceKm: 0.4567 }), 'ko', MON).distance).toBe('457m');
    expect(cardFacts(base({ distanceKm: 0.9996 }), 'ko', MON).distance).toBe('1.0km');
    expect(cardFacts(base({ distanceKm: null }), 'ko', MON).distance).toBeNull();
  });

  it('찜 수 — 하한(3) 미만은 null, 이상이면 보이는 글자와 읽기 문구', () => {
    expect(cardFacts(base({ savedCount: 2 }), 'ko', MON).saved).toBeNull();
    expect(cardFacts(base({ savedCount: null }), 'ko', MON).saved).toBeNull();
    expect(cardFacts(base({ savedCount: 3 }), 'ko', MON).saved).toEqual({
      count: 3, label: '찜 3', srLabel: '이 사이트 회원 3명이 찜',
    });
    expect(cardFacts(base({ savedCount: 12 }), 'en', MON).saved).toEqual({
      count: 12, label: 'Saved 12', srLabel: 'Saved by 12 members of this site',
    });
  });
});
