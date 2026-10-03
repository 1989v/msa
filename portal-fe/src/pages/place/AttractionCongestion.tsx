import { useId, useState } from 'react';
import type { CongestionDay, PlaceLang } from '../../api/placeApi';

type Level = 'calm' | 'normal' | 'busy' | 'packed';

const UI = {
  ko: {
    title: '혼잡 예측',
    today: '오늘',
    rate: '집중률',
    level: { calm: '한산', normal: '보통', busy: '붐빔', packed: '매우 붐빔' } as Record<Level, string>,
    todayIs: '오늘 예상',
    calmest: (date: string, level: string) => `이번 주 가장 한산한 날 ${date} · ${level}`,
    busiest: (date: string, level: string) => `가장 붐비는 날 ${date} · ${level}`,
    brief: '예측값 · 실제 혼잡과 다를 수 있음',
    more: '혼잡도 기준 보기',
    note: '관광공사가 예측한 앞으로 30일의 관광지 집중률(0~100)을 네 단계로 나눴습니다. 값이 클수록 사람이 몰릴 것으로 예측된 날이며, 실제 혼잡과 다를 수 있습니다.',
    source: '출처: 한국관광공사 빅데이터 서비스(관광지 집중률 예측)',
  },
  en: {
    title: 'Crowd forecast',
    today: 'Today',
    rate: 'Concentration',
    level: { calm: 'Quiet', normal: 'Moderate', busy: 'Busy', packed: 'Very busy' } as Record<Level, string>,
    todayIs: 'Today',
    calmest: (date: string, level: string) => `Quietest day this week: ${date} · ${level}`,
    busiest: (date: string, level: string) => `Busiest day: ${date} · ${level}`,
    brief: 'Forecast · actual crowds may differ',
    more: 'How this is measured',
    note: 'Forecast tourist concentration (0–100) for the next 30 days, grouped into four levels. Higher means more visitors are expected; actual crowds may differ.',
    source: 'Source: Korea Tourism Organization Big Data Service (tourist spot concentration forecast)',
  },
} as const;

/**
 * 집중률 → 네 단계. 경계는 운영 값 분포에서 정했다(2026-10-03, 관광지 1,772곳 × 30일 = 53,160개):
 * 40 미만 약 3할 · 40~70 약 4할 · 70~90 약 2할 · 90 이상 약 1할. 원천 값은 그대로 두고 화면에서만 나눈다.
 */
function levelOf(rate: number): Level {
  if (rate >= 90) return 'packed';
  if (rate >= 70) return 'busy';
  if (rate >= 40) return 'normal';
  return 'calm';
}

const LEVELS: Level[] = ['calm', 'normal', 'busy', 'packed'];

function dateLabel(date: string, lang: PlaceLang): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (lang === 'ko') {
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
    return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekday})`;
  }
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const fmt = (rate: number) => (Math.round(rate * 10) / 10).toString();

/** 막대 아래 날짜는 오늘과 일주일 간격에만 단다 — 30개를 다 달면 좁은 화면에서 겹친다(값은 막대마다 aria-label 로 읽힌다). */
const LABEL_EVERY = 7;
/** 「가장 한산한 날」은 가까운 일주일 안에서 고른다 — 한 달 뒤 날짜는 계획에 덜 쓰인다 */
const WEEK = 7;

/**
 * 관광지 상세 「혼잡 예측」 — 한국관광공사 집중률 예측(앞 30일)을 네 단계(한산·보통·붐빔·매우 붐빔)로 읽어 준다.
 * 오늘 단계를 크게, 이번 주 가장 한산한 날과 가장 붐비는 날을 한 줄씩, 30일 막대는 단계 색으로 칠한다.
 * 막대 높이는 원천 값 그대로(0~100)다 — 그 기간의 최댓값에 맞춰 늘리면 한산한 곳도 꽉 찬 막대가 된다.
 * 색인은 하루 한 번 바뀌므로 자정을 넘기면 어제 날짜가 남는다 — 오늘 이전 날은 그리지 않고, 남는 날이 없으면 절을 숨긴다.
 * 서버 렌더 본문에는 넣지 않는다(날씨와 같은 자리).
 */
export default function AttractionCongestion({
  days,
  today,
  lang,
  showTitle = true,
}: {
  days: CongestionDay[];
  today: string;
  lang: PlaceLang;
  showTitle?: boolean;
}) {
  const L = UI[lang];
  const noteId = useId();
  const [noteOpen, setNoteOpen] = useState(false);
  const upcoming = days.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0) return null;
  const todayDay = upcoming[0].date === today ? upcoming[0] : null;
  const week = upcoming.slice(0, WEEK);
  const calmest = week.reduce((a, b) => (b.rate < a.rate ? b : a));
  const peak = upcoming.reduce((a, b) => (b.rate > a.rate ? b : a));
  return (
    <section className="place-detail-info place-congestion" aria-label={L.title} data-place-section="congestion">
      {showTitle && <h2 className="place-detail-info-title">{L.title}</h2>}
      {todayDay && (
        <p className="place-congestion-today" data-level={levelOf(todayDay.rate)}>
          <span className="place-congestion-today-label">{L.todayIs}</span>
          <strong className="place-congestion-today-level">{L.level[levelOf(todayDay.rate)]}</strong>
          <span className="place-congestion-today-rate">
            {L.rate} {fmt(todayDay.rate)}
          </span>
        </p>
      )}
      <ul className="place-congestion-hints">
        {calmest.date !== todayDay?.date && <li>{L.calmest(dateLabel(calmest.date, lang), L.level[levelOf(calmest.rate)])}</li>}
        <li>{L.busiest(dateLabel(peak.date, lang), L.level[levelOf(peak.rate)])}</li>
      </ul>
      <ol className="place-congestion-chart">
        {upcoming.map((d, i) => {
          const isToday = d.date === today;
          const level = levelOf(d.rate);
          const label = `${isToday ? `${L.today} ` : ''}${dateLabel(d.date, lang)} — ${L.level[level]} (${L.rate} ${fmt(d.rate)})`;
          const height = `${Math.min(Math.max(d.rate, 0), 100)}%`;
          return (
            <li
              key={d.date}
              className={`place-congestion-day${isToday ? ' is-today' : ''}`}
              data-level={level}
              aria-label={label}
              title={label}
              aria-current={isToday ? 'date' : undefined}
            >
              <div className="place-congestion-bar">
                <span className="place-congestion-fill" style={{ height }} />
              </div>
              <span className="place-congestion-label" aria-hidden>
                {isToday ? L.today : i % LABEL_EVERY === 0 ? d.date.slice(5).replace('-', '/') : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="place-congestion-legend" aria-hidden>
        {LEVELS.map((level) => (
          <li key={level} data-level={level}>
            <i />
            {L.level[level]}
          </li>
        ))}
      </ul>
      {/* 좁은 화면은 한 줄 요약 + ⓘ 로 기준 설명을 연다 — 판 높이 안에 차트가 다 보이게. 넓은 화면은 설명을 그대로 */}
      <p className="place-congestion-note place-congestion-brief">
        {L.brief}
        <button
          type="button"
          className="place-congestion-info"
          aria-label={L.more}
          aria-expanded={noteOpen}
          aria-controls={noteId}
          onClick={() => setNoteOpen((v) => !v)}
        >
          ⓘ
        </button>
      </p>
      <p id={noteId} className="place-congestion-note place-congestion-note-detail" data-open={noteOpen || undefined}>
        {L.note}
      </p>
      <p className="place-congestion-note">{L.source}</p>
    </section>
  );
}
