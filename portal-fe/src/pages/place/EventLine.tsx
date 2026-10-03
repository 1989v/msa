import type { Attraction, PlaceLang } from '../../api/placeApi';
import {
  effectivePeriod,
  eventPeriodLabel,
  eventStatus as eventStatusOf,
  eventStatusText,
  isEventType,
  todayKst,
} from '../../seo/eventSchedule';

/**
 * 행사의 기간·상태 줄 — 목록 카드·상세 본문(데스크톱 열·모바일 시트)·상세의 근처 행사·지역 허브의 이번 달 행사가 같이 쓴다.
 * 문구는 서버 렌더와 같은 판정(`eventSchedule`)이고 오늘은 렌더 시점의 KST 날짜다. 날짜를 모르는 행사는 그리지 않는다.
 */
export default function EventLine({
  attraction,
  lang,
}: {
  attraction: Pick<Attraction, 'contentTypeId' | 'eventStart' | 'eventEnd'>;
  lang: PlaceLang;
}) {
  if (!isEventType(attraction.contentTypeId)) return null;
  const today = todayKst();
  const period = effectivePeriod(attraction.eventStart, attraction.eventEnd);
  const status = eventStatusText(period, today, lang);
  if (!period || !status) return null;
  return (
    <p className="place-event-line" data-event-status={eventStatusOf(period, today)}>
      <span className="place-event-period">{eventPeriodLabel(period)}</span>
      <span className="place-event-status">{status}</span>
    </p>
  );
}
