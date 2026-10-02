import type { CongestionDay, PlaceLang } from '../../api/placeApi';

const UI = {
  ko: {
    title: '혼잡 예측',
    today: '오늘',
    rate: '집중률',
    summary: (today: string, peak: string) => `오늘 집중률 ${today} · 가장 높은 날 ${peak}`,
    note: '앞으로 30일의 관광지 집중률 예측값(0~100)입니다. 실제 혼잡과 다를 수 있습니다.',
    source: '출처: 한국관광공사 빅데이터 서비스(관광지 집중률 예측)',
  },
  en: {
    title: 'Crowd forecast',
    today: 'Today',
    rate: 'Concentration',
    summary: (today: string, peak: string) => `Today ${today} · highest ${peak}`,
    note: 'Forecast tourist concentration (0–100) for the next 30 days. Actual crowds may differ.',
    source: 'Source: Korea Tourism Organization Big Data Service (tourist spot concentration forecast)',
  },
} as const;

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

/**
 * 관광지 상세 「혼잡 예측」 — 한국관광공사 집중률 예측을 오늘부터 막대로 그린다. 높이는 원천 값 그대로(0~100)다 —
 * 그 기간의 최댓값에 맞춰 늘리면 한산한 곳도 꽉 찬 막대가 되어 다른 관광지와 견줄 수 없다.
 * 색인은 하루 한 번 바뀌므로 자정을 넘기면 어제 날짜가 남는다 — 오늘 이전 날은 그리지 않고, 남는 날이 없으면 절을 숨긴다.
 * 예측이라는 안내와 출처를 절 안에 단다. 서버 렌더 본문에는 넣지 않는다(날씨와 같은 자리).
 */
export default function AttractionCongestion({
  days,
  today,
  lang,
}: {
  days: CongestionDay[];
  today: string;
  lang: PlaceLang;
}) {
  const L = UI[lang];
  const upcoming = days.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0) return null;
  const todayDay = upcoming[0].date === today ? upcoming[0] : null;
  const peak = upcoming.reduce((a, b) => (b.rate > a.rate ? b : a));
  return (
    <section className="place-detail-info place-congestion" aria-label={L.title} data-place-section="congestion">
      <h2 className="place-detail-info-title">{L.title}</h2>
      {todayDay && (
        <p className="place-congestion-summary">{L.summary(fmt(todayDay.rate), `${dateLabel(peak.date, lang)} ${fmt(peak.rate)}`)}</p>
      )}
      <ol className="place-congestion-chart">
        {upcoming.map((d, i) => {
          const isToday = d.date === today;
          const label = `${isToday ? `${L.today} ` : ''}${dateLabel(d.date, lang)} — ${L.rate} ${fmt(d.rate)}`;
          const height = `${Math.min(Math.max(d.rate, 0), 100)}%`;
          return (
            <li
              key={d.date}
              className={`place-congestion-day${isToday ? ' is-today' : ''}`}
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
      <p className="place-congestion-note">{L.note}</p>
      <p className="place-congestion-note">{L.source}</p>
    </section>
  );
}
