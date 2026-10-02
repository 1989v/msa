import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  attractionNoindex,
  effectivePeriod,
  eventRange,
  eventStatus,
  eventStatusText,
  indexExpired,
  rangeContains,
  todayKst,
  type EventStatusFilter,
} from '../eventSchedule';

/**
 * 서버·화면 판정 동일성.
 *
 * 골든은 search/domain `EventScheduleGoldenTest` 가 Kotlin `EventSchedule`·`EventStatusText` 의 실제 출력으로 쓴
 * 날짜 격자다. 여기서는 각 줄의 **시각(now)** 에서 TS 가 KST 날짜를 직접 계산하고(골든의 today 를 쓰지 않는다)
 * 원천 날짜로 유효 기간·상태·문구·만료·필터를 다시 판정해 Kotlin 값과 비교한다.
 */
interface GoldenCase {
  now: string;
  today: string;
  sourceStart: string | null;
  sourceEnd: string | null;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  status: string;
  daysUntilStart: number | null;
  textKo: string | null;
  textEn: string | null;
  indexExpired: boolean;
  filters: Record<EventStatusFilter, boolean>;
}

const golden = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/event-schedule-golden.json'), 'utf8'),
) as { cases: GoldenCase[] };
const cases = golden.cases;
const FILTERS: EventStatusFilter[] = ['ONGOING', 'WEEKEND', 'UPCOMING', 'THIS_MONTH', 'NOT_ENDED'];

/** 한 줄을 TS 로 다시 판정한 값 — 골든과 같은 모양 */
function judge(c: GoldenCase) {
  const today = todayKst(new Date(c.now));
  const period = effectivePeriod(c.sourceStart, c.sourceEnd);
  return {
    today,
    effectiveStart: period?.start ?? null,
    effectiveEnd: period?.end ?? null,
    status: eventStatus(period, today),
    textKo: eventStatusText(period, today, 'ko'),
    textEn: eventStatusText(period, today, 'en'),
    indexExpired: indexExpired(period, today),
    filters: Object.fromEntries(FILTERS.map((f) => [f, rangeContains(eventRange(f, today), period)])),
  };
}

describe('행사 일정 — Kotlin 날짜 격자 골든과 같은 판정', () => {
  it('골든이 경계 사례를 담고 있다 — 비어 있으면 아래 대조가 아무것도 재지 않는다', () => {
    expect(cases.length).toBeGreaterThan(400);
    expect(new Set(cases.map((c) => c.status))).toEqual(new Set(['UPCOMING', 'ONGOING', 'ENDED', 'UNKNOWN']));
    expect(cases.some((c) => c.textEn === 'Starts tomorrow')).toBe(true);
    expect(cases.some((c) => c.indexExpired)).toBe(true);
    // KST 자정 전후 — UTC 날짜와 KST 날짜가 다른 시각이 섞여 있다
    expect(cases.some((c) => c.now.slice(0, 10) !== c.today)).toBe(true);
    for (const f of FILTERS) {
      expect(cases.some((c) => c.filters[f]), f).toBe(true);
      expect(cases.some((c) => !c.filters[f]), f).toBe(true);
    }
  });

  it('모든 줄에서 KST 날짜·유효 기간·상태·국영 문구·색인 만료·필터 다섯이 같다', () => {
    const mismatches = cases.flatMap((c) => {
      const want = {
        today: c.today,
        effectiveStart: c.effectiveStart,
        effectiveEnd: c.effectiveEnd,
        status: c.status,
        textKo: c.textKo,
        textEn: c.textEn,
        indexExpired: c.indexExpired,
        filters: Object.fromEntries(FILTERS.map((f) => [f, c.filters[f]])),
      };
      const got = judge(c);
      return JSON.stringify(got) === JSON.stringify(want) ? [] : [{ now: c.now, source: [c.sourceStart, c.sourceEnd], want, got }];
    });
    expect(mismatches.slice(0, 3)).toEqual([]);
  });

  it('상세 robots 는 개요가 있으면 골든의 색인 만료와 같고, 개요가 없으면 늘 noindex 다', () => {
    for (const c of cases) {
      const today = todayKst(new Date(c.now));
      const event = { overview: '개요', contentTypeId: '15', eventStart: c.effectiveStart, eventEnd: c.effectiveEnd };
      expect(attractionNoindex(event, today), `${c.now} ${c.sourceStart}~${c.sourceEnd}`).toBe(c.indexExpired);
      expect(attractionNoindex({ ...event, overview: null }, today)).toBe(true);
    }
    // 행사가 아닌 유형은 날짜가 있어도 개요 규칙만 따른다(양성 대조: 같은 날짜의 행사는 만료)
    const expired = cases.find((c) => c.indexExpired)!;
    const today = todayKst(new Date(expired.now));
    const dates = { overview: '개요', eventStart: expired.effectiveStart, eventEnd: expired.effectiveEnd };
    expect(attractionNoindex({ ...dates, contentTypeId: '12' }, today)).toBe(false);
    expect(attractionNoindex({ ...dates, contentTypeId: '85' }, today)).toBe(true);
  });
});
