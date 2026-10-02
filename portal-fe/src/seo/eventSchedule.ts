import { PLACE_EVENT_TYPES } from './copy.mjs';

/*
 * 행사 일정 규칙 — search/domain `EventSchedule`·`EventStatusText` 와 같은 규칙이다.
 * 서버 렌더가 그린 상태 문구·robots 를 하이드레이션이 뒤집지 않도록 화면도 같은 판정을 쓴다.
 * 날짜 격자 골든(`__tests__/fixtures/event-schedule-golden.json`)이 Kotlin 출력과 이 함수들의 출력을 대조한다.
 *
 * 날짜는 `YYYY-MM-DD` 문자열로 다룬다 — 같은 길이의 ISO 날짜는 문자열 비교가 곧 날짜 비교다.
 */

export type EventStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNKNOWN';
export type EventStatusFilter = 'ONGOING' | 'WEEKEND' | 'UPCOMING' | 'THIS_MONTH' | 'NOT_ENDED';

/** 유효 기간 — 시작일·종료일 모두 포함 */
export interface EventPeriod {
  start: string;
  end: string;
}

/** 색인 유지 기간 — 종료 + 이 일수까지 색인 대상, 그다음 날부터 noindex */
export const INDEX_GRACE_DAYS = 30;

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

export function isEventType(contentTypeId: string | null | undefined): boolean {
  return contentTypeId != null && (PLACE_EVENT_TYPES as string[]).includes(contentTypeId);
}

/** 시각 → KST 날짜. KST 는 서머타임이 없어 9시간을 더한 UTC 날짜가 곧 KST 날짜다. */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function toMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function addDays(date: string, days: number): string {
  return new Date(toMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** S·E 정상 → (S,E) · S 만 → (S,S) · E 만 → (E,E) · S>E · 둘 다 없음 → null */
export function effectivePeriod(start: string | null | undefined, end: string | null | undefined): EventPeriod | null {
  if (start && end) return start > end ? null : { start, end };
  if (start) return { start, end: start };
  if (end) return { start: end, end };
  return null;
}

export function eventStatus(period: EventPeriod | null, today: string): EventStatus {
  if (!period) return 'UNKNOWN';
  if (period.start > today) return 'UPCOMING';
  if (period.end < today) return 'ENDED';
  return 'ONGOING';
}

/** 예정 행사의 시작까지 남은 날 수. 예정이 아니면 null. */
export function daysUntilStart(period: EventPeriod | null, today: string): number | null {
  if (eventStatus(period, today) !== 'UPCOMING') return null;
  return Math.round((toMs(period!.start) - toMs(today)) / DAY_MS);
}

/** 상태 문구 — 서버 렌더 `EventStatusText` 와 같은 문자열. UNKNOWN 은 문구가 없다. */
export function eventStatusText(period: EventPeriod | null, today: string, lang: string): string | null {
  const ko = lang === 'ko';
  switch (eventStatus(period, today)) {
    case 'ONGOING':
      return ko ? '진행 중' : 'Ongoing';
    case 'ENDED':
      return ko ? '종료된 행사' : 'Ended';
    case 'UPCOMING': {
      const n = daysUntilStart(period, today)!;
      if (ko) return `D-${n} 시작`;
      return n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`;
    }
    default:
      return null;
  }
}

/** 기간 표기 — 서버 렌더와 같은 `YYYY-MM-DD ~ YYYY-MM-DD` */
export function eventPeriodLabel(period: EventPeriod): string {
  return `${period.start} ~ ${period.end}`;
}

/** 유효 종료일 + 31일 ≤ 오늘. 날짜 없는 행사는 만료가 아니다(robots 는 개요 규칙만 따른다). */
export function indexExpired(period: EventPeriod | null, today: string): boolean {
  return period != null && addDays(period.end, INDEX_GRACE_DAYS) < today;
}

/**
 * 관광지 상세 robots — 서버 렌더와 같은 판정: 개요 없음 OR (행사 ∧ 유효 종료일 + 31일 ≤ 오늘).
 * 하이드레이션의 `useSeo` 가 이 값을 써야 서버가 붙인 `noindex, follow` 를 지우지 않는다.
 */
export function attractionNoindex(
  attraction: {
    overview?: string | null;
    contentTypeId?: string | null;
    eventStart?: string | null;
    eventEnd?: string | null;
  },
  today: string,
): boolean {
  if (!attraction.overview) return true;
  return (
    isEventType(attraction.contentTypeId) &&
    indexExpired(effectivePeriod(attraction.eventStart, attraction.eventEnd), today)
  );
}

/**
 * 필터 하나가 뜻하는 유효 기간 [s, e] 조건 — 모든 경계 포함, null 은 그쪽 조건 없음.
 * 화면은 검색 API 에 필터 이름만 보내고 범위는 서버가 정한다. 이 함수는 골든 대조로 같은 규칙인지 확인하는 데 쓴다.
 */
export function eventRange(
  filter: EventStatusFilter,
  today: string,
): { startGte: string | null; startLte: string | null; endGte: string | null } {
  switch (filter) {
    case 'ONGOING':
      return { startGte: null, startLte: today, endGte: today };
    case 'UPCOMING':
      return { startGte: addDays(today, 1), startLte: null, endGte: null };
    case 'NOT_ENDED':
      return { startGte: null, startLte: null, endGte: today };
    case 'WEEKEND': {
      // 주는 월~일. getUTCDay: 일 0 · 월 1 … 토 6
      const weekday = (new Date(toMs(today)).getUTCDay() + 6) % 7; // 월 0 … 일 6
      const saturday = addDays(today, 5 - weekday);
      const sunday = addDays(saturday, 1);
      return { startGte: null, startLte: sunday, endGte: saturday > today ? saturday : today };
    }
    case 'THIS_MONTH': {
      const d = new Date(toMs(today));
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      return { startGte: null, startLte: lastDay, endGte: today };
    }
  }
}

export function rangeContains(range: ReturnType<typeof eventRange>, period: EventPeriod | null): boolean {
  if (!period) return false;
  if (range.startGte != null && period.start < range.startGte) return false;
  if (range.startLte != null && period.start > range.startLte) return false;
  if (range.endGte != null && period.end < range.endGte) return false;
  return true;
}
