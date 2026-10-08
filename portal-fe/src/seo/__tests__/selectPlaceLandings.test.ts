import { describe, expect, it } from 'vitest';
import {
  PLACE_LANDING_ATTRS,
  PLACE_LANDING_MAX_JACCARD,
  PLACE_LANDING_MAX_PER_ATTR,
  PLACE_LANDING_MAX_TOTAL,
  PLACE_LANDING_MIN_RESULTS,
  SIGHT_CATEGORIES,
} from '../copy.mjs';
import { buildCandidates, selectLandings } from '../../../scripts/select-place-landings.mjs';

const MIN = PLACE_LANDING_MIN_RESULTS;
const TODAY = '2026-10-09';

/** administrative-regions 시군구 행 */
const sigungu = (code: string) => ({ code, parentCode: code.slice(0, 2), level: 'SIGUNGU', name: code, nameEn: code, attractionCount: 50 });

/** `SearchAttractionUseCase.AttributeFacets` 모양 — 세지 않는 값(PARTIAL·ELEVATOR·RESTROOM)도 들어 있다 */
function facets(over: Partial<{ parking: number; petAllowed: number; petPartial: number; wheelchair: number; elevator: number; free: number }> = {}) {
  return {
    openToday: 0,
    parking: { YES: over.parking ?? 0 },
    creditCard: { YES: 0 },
    strollerRental: { YES: 0 },
    pet: { ALLOWED: over.petAllowed ?? 0, PARTIAL: over.petPartial ?? 0 },
    admission: { FREE: over.free ?? 0 },
    barrierFree: { WHEELCHAIR: over.wheelchair ?? 0, ELEVATOR: over.elevator ?? 0, RESTROOM: 0 },
    wellness: 0,
  };
}

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/**
 * 경로를 보고 응답을 만든다 — facets=true 면 facet 질의, 속성 파라미터가 있으면 필터 질의.
 * @param facetBy 시군구 3자리 → facet(null 이면 시간 초과로 빈 facet)
 * @param totals 필터 질의의 totalElements — `${sigungu3}:${param.key}`
 */
function fakeGet(facetBy: Record<string, ReturnType<typeof facets> | null>, totals: Record<string, number>) {
  const calls: URL[] = [];
  const get = async (path: string) => {
    const url = new URL(path, 'http://x');
    calls.push(url);
    const sg = url.searchParams.get('sigunguCode')!;
    if (url.searchParams.get('facets') === 'true') {
      return { totalElements: 40, attractions: [], attributeFacets: facetBy[sg] };
    }
    const def = PLACE_LANDING_ATTRS.find((a) => url.searchParams.get(a.param.key) === a.param.value)!;
    const total = totals[`${sg}:${def.param.key}`] ?? 0;
    return { totalElements: total, attractions: ids(`${sg}-${def.attr}-`, Math.min(30, total)).map((id) => ({ id })) };
  };
  return { get, calls };
}

describe('buildCandidates — facet 으로 예비 후보, 필터 질의로 건수', () => {
  it('pet.PARTIAL · barrierFree.ELEVATOR 가 커도 예비 후보가 되지 않는다', async () => {
    const { get, calls } = fakeGet({ '110': facets({ petPartial: 99, elevator: 99 }) }, {});
    const got = await buildCandidates({ lang: 'ko', regions: [sigungu('26110')], get });
    expect(got).toEqual([]);
    expect(calls.filter((u) => u.searchParams.get('facets') !== 'true')).toHaveLength(0);
  });

  it('count 는 facet 건수가 아니라 필터 질의의 totalElements, ids 는 상위 결과 id', async () => {
    const { get } = fakeGet({ '110': facets({ parking: MIN + 5 }) }, { '110:parking': MIN + 2 });
    const got = await buildCandidates({ lang: 'ko', regions: [sigungu('26110')], get });
    expect(got).toEqual([
      { lang: 'ko', code: '26110', attr: 'parking', count: MIN + 2, ids: ids('110-parking-', MIN + 2) },
    ]);
  });

  it('facet 이 하한 미만이면 필터 질의를 하지 않는다', async () => {
    const { get, calls } = fakeGet({ '110': facets({ parking: MIN - 1, free: MIN }) }, { '110:admission': MIN });
    const got = await buildCandidates({ lang: 'ko', regions: [sigungu('26110')], get });
    expect(got.map((c: { attr: string }) => c.attr)).toEqual(['free']);
    expect(calls.filter((u) => u.searchParams.has('parking'))).toHaveLength(0);
  });

  it('영문은 영문 슬러그만 — pet · barrier-free 는 facet 이 커도 후보가 아니다', async () => {
    const { get } = fakeGet(
      { '110': facets({ parking: MIN, petAllowed: 99, wheelchair: 99, free: MIN }) },
      { '110:parking': MIN, '110:pet': 99, '110:barrierFree': 99, '110:admission': MIN },
    );
    const got = await buildCandidates({ lang: 'en', regions: [sigungu('26110')], get });
    expect(got.map((c: { attr: string }) => c.attr).sort()).toEqual(
      PLACE_LANDING_ATTRS.filter((a) => a.langs.includes('en')).map((a) => a.attr).sort(),
    );
  });

  it('facet 이 null 이면 예외 — 조용히 건너뛰지 않는다', async () => {
    const { get } = fakeGet({ '110': null }, {});
    await expect(buildCandidates({ lang: 'ko', regions: [sigungu('26110')], get })).rejects.toThrow(/26110/);
  });

  it('질의 인자 — 모든 질의에 관광 분류, 시도 2자리 · 시군구 3자리, 필터 질의는 size 30', async () => {
    const { get, calls } = fakeGet(
      { '110': facets({ parking: MIN, free: MIN }) },
      { '110:parking': MIN, '110:admission': MIN },
    );
    await buildCandidates({ lang: 'ko', regions: [sigungu('26110')], get });
    expect(calls.length).toBe(3);
    for (const u of calls) {
      expect(u.pathname).toBe('/api/search/attractions');
      expect(u.searchParams.get('lang')).toBe('ko');
      expect(u.searchParams.get('category')).toBe(SIGHT_CATEGORIES.join(','));
      expect(u.searchParams.get('sidoCode')).toBe('26110'.slice(0, 2));
      expect(u.searchParams.get('sigunguCode')).toBe('26110'.slice(2));
    }
    const filters = calls.filter((u) => u.searchParams.get('facets') !== 'true');
    expect(filters).toHaveLength(2);
    for (const u of filters) expect(u.searchParams.get('size')).toBe('30');
  });
});

type Cand = { lang: string; code: string; attr: string; count: number; ids: string[] };
const cand = (lang: string, code: string, attr: string, count: number, idList?: string[]): Cand => ({
  lang, code, attr, count, ids: idList ?? ids(`${lang}${code}${attr}-`, Math.min(30, count)),
});
/** 시군구 코드 n개 — 10001, 10002, … */
const codes = (n: number, base = 10000) => Array.from({ length: n }, (_, i) => String(base + i + 1));
const regionsOf = (ko: string[], en: string[] = ko) => ({ ko: ko.map(sigungu), en: en.map(sigungu) });
const keys = (entries: Array<{ lang: string; code: string; attr: string }>) => entries.map((e) => `${e.lang}/${e.code}/${e.attr}`);
const active = (entries: Array<{ retired?: boolean }>) => entries.filter((e) => !e.retired);

describe('selectLandings — 하한·상한·정렬·중복도', () => {
  it('하한 — MIN−1 은 제외, MIN 은 포함', () => {
    const { entries } = selectLandings({
      regions: regionsOf(['26110', '26140']),
      candidates: [cand('ko', '26110', 'parking', MIN - 1), cand('ko', '26140', 'parking', MIN)],
      previous: [],
      today: TODAY,
    });
    expect(keys(entries)).toEqual(['ko/26140/parking']);
  });

  it('속성당 상한 — 한 속성 후보가 상한보다 많으면 상한 수만', () => {
    const cs = codes(PLACE_LANDING_MAX_PER_ATTR + 2);
    const { entries } = selectLandings({
      regions: regionsOf(cs),
      candidates: cs.map((c) => cand('ko', c, 'parking', MIN + 3)),
      previous: [],
      today: TODAY,
    });
    expect(entries).toHaveLength(PLACE_LANDING_MAX_PER_ATTR);
  });

  it('합산 상한 — 국 20 + 영 10 후보(같은 건수)면 합산 상한 수, 국문이 먼저', () => {
    const cs = codes(20);
    const koAttrs = PLACE_LANDING_ATTRS.map((a) => a.attr);
    const enAttrs = PLACE_LANDING_ATTRS.filter((a) => a.langs.includes('en')).map((a) => a.attr);
    // 시군구마다 속성 하나 — 같은 시군구 안 중복도가 끼지 않게
    const ko = cs.map((c, i) => cand('ko', c, koAttrs[i % koAttrs.length], MIN + 5));
    const en = cs.slice(0, 10).map((c, i) => cand('en', c, enAttrs[i % enAttrs.length], MIN + 5));
    const { entries } = selectLandings({ regions: regionsOf(cs), candidates: [...en, ...ko], previous: [], today: TODAY });
    expect(entries).toHaveLength(PLACE_LANDING_MAX_TOTAL);
    const koCap = koAttrs.length * PLACE_LANDING_MAX_PER_ATTR;
    expect(entries.filter((e: { lang: string }) => e.lang === 'ko')).toHaveLength(Math.min(koCap, PLACE_LANDING_MAX_TOTAL));
  });

  it('동점은 코드 오름차순 — 건수가 높으면 코드와 무관하게 먼저', () => {
    const cs = codes(PLACE_LANDING_MAX_PER_ATTR + 1);
    const reversed = [...cs].reverse();
    const { entries } = selectLandings({
      regions: regionsOf(cs),
      candidates: [...reversed.map((c) => cand('ko', c, 'free', MIN)), cand('ko', cs[cs.length - 1], 'parking', MIN)],
      previous: [],
      today: TODAY,
    });
    const free = entries.filter((e: { attr: string }) => e.attr === 'free').map((e: { code: string }) => e.code);
    expect(free).toEqual(cs.slice(0, PLACE_LANDING_MAX_PER_ATTR));

    const higher = selectLandings({
      regions: regionsOf(cs),
      candidates: [...cs.slice(0, -1).map((c) => cand('ko', c, 'free', MIN)), cand('ko', cs[cs.length - 1], 'free', MIN + 1)],
      previous: [],
      today: TODAY,
    }).entries.map((e: { code: string }) => e.code);
    expect(higher).toContain(cs[cs.length - 1]);
    expect(higher).not.toContain(cs[PLACE_LANDING_MAX_PER_ATTR - 1]);
  });

  it('영문 pet · barrier-free 후보는 제외', () => {
    const { entries } = selectLandings({
      regions: regionsOf(['26110']),
      candidates: [cand('en', '26110', 'pet', MIN + 9), cand('en', '26110', 'barrier-free', MIN + 9)],
      previous: [],
      today: TODAY,
    });
    expect(entries).toEqual([]);
  });

  it('Jaccard — 30건 두 묶음의 겹침 k 가 상한을 넘는 최소값이면 제외, 하나 적으면 포함', () => {
    // 30 + 30 에서 k 개가 겹치면 Jaccard = k / (60 − k)
    let k = 0;
    while (k / (60 - k) <= PLACE_LANDING_MAX_JACCARD) k += 1;
    const base = ids('a', 30);
    const overlap = (n: number) => [...base.slice(0, n), ...ids('b', 30 - n)];
    const run = (n: number) =>
      selectLandings({
        regions: regionsOf(['26110']),
        candidates: [cand('ko', '26110', 'parking', MIN + 9, base), cand('ko', '26110', 'free', MIN + 1, overlap(n))],
        previous: [],
        today: TODAY,
      }).entries;
    expect(keys(run(k))).toEqual(['ko/26110/parking']);
    const kept = run(k - 1);
    expect(keys(kept).sort()).toEqual(['ko/26110/free', 'ko/26110/parking']);
    const free = kept.find((e: { attr: string }) => e.attr === 'free');
    expect(free?.jaccardMax).toBeCloseTo((k - 1) / (60 - (k - 1)), 3);
  });

  it('Jaccard 는 같은 언어 · 같은 시군구끼리만 비교한다', () => {
    const same = ids('a', 30);
    const { entries } = selectLandings({
      regions: regionsOf(['26110', '26140']),
      candidates: [cand('ko', '26110', 'parking', MIN, same), cand('ko', '26140', 'parking', MIN, same), cand('en', '26110', 'parking', MIN, same)],
      previous: [],
      today: TODAY,
    });
    expect(entries).toHaveLength(3);
  });

  it('모집단(그 언어의 시군구 행) 밖 코드는 제외', () => {
    const { entries } = selectLandings({
      regions: regionsOf(['26110'], []),
      candidates: [cand('ko', '29110', 'parking', MIN + 9), cand('en', '26110', 'parking', MIN + 9), cand('ko', '26110', 'parking', MIN)],
      previous: [],
      today: TODAY,
    });
    expect(keys(entries)).toEqual(['ko/26110/parking']);
  });

  it('항목 필드 — sidoCode 는 code 앞 2자리, selectedAt 은 오늘', () => {
    const { entries } = selectLandings({
      regions: regionsOf(['26110']),
      candidates: [cand('ko', '26110', 'parking', MIN)],
      previous: [],
      today: TODAY,
    });
    expect(entries).toEqual([
      { lang: 'ko', code: '26110', sidoCode: '26110'.slice(0, 2), attr: 'parking', count: MIN, jaccardMax: 0, selectedAt: TODAY },
    ]);
  });
});

describe('selectLandings — 기존 항목 유지', () => {
  const prev = { lang: 'ko', code: '26110', sidoCode: '26', attr: 'parking', count: MIN + 1, jaccardMax: 0, selectedAt: '2026-09-01' };

  it('이번에 안 뽑힌 기존 항목은 retired 로 남고 상한 계산에서 빠진다', () => {
    const cs = codes(PLACE_LANDING_MAX_PER_ATTR);
    const { entries } = selectLandings({
      regions: regionsOf([...cs, '26110']),
      candidates: cs.map((c) => cand('ko', c, 'parking', MIN + 5)),
      previous: [prev],
      today: TODAY,
    });
    const retired = entries.find((e: { code: string }) => e.code === '26110');
    expect(retired).toEqual({ ...prev, retired: true, retiredAt: TODAY });
    expect(active(entries)).toHaveLength(PLACE_LANDING_MAX_PER_ATTR);
  });

  it('이미 은퇴한 항목의 retiredAt 은 처음 값을 유지한다', () => {
    const old = { ...prev, retired: true, retiredAt: '2026-09-20' };
    const { entries } = selectLandings({ regions: regionsOf(['26110']), candidates: [], previous: [old], today: TODAY });
    expect(entries).toEqual([old]);
  });

  it('다시 뽑히면 retired · retiredAt 을 지우고 selectedAt 은 처음 값', () => {
    const old = { ...prev, retired: true, retiredAt: '2026-09-20' };
    const { entries } = selectLandings({
      regions: regionsOf(['26110']),
      candidates: [cand('ko', '26110', 'parking', MIN + 4)],
      previous: [old],
      today: TODAY,
    });
    expect(entries).toEqual([{ ...prev, count: MIN + 4, selectedAt: prev.selectedAt }]);
  });

  it('은퇴 수가 합산 상한을 넘으면 경고만 하고 지우지 않는다', () => {
    const cs = codes(PLACE_LANDING_MAX_TOTAL + 1);
    const previous = cs.map((c) => ({ ...prev, code: c, sidoCode: c.slice(0, 2) }));
    const { entries, warnings } = selectLandings({ regions: regionsOf(cs), candidates: [], previous, today: TODAY });
    expect(entries).toHaveLength(previous.length);
    expect(warnings.length).toBeGreaterThan(0);

    const under = selectLandings({ regions: regionsOf(cs), candidates: [], previous: previous.slice(1), today: TODAY });
    expect(under.warnings).toEqual([]);
  });

  it('모집단에서 사라진 코드의 기존 항목도 지우지 않는다 — 처리는 빌드 몫', () => {
    const gone = { ...prev, code: '29110', sidoCode: '29' };
    const { entries } = selectLandings({ regions: regionsOf(['26110']), candidates: [], previous: [gone], today: TODAY });
    expect(keys(entries)).toEqual(['ko/29110/parking']);
  });
});
