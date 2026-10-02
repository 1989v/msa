import type { PlaceLang, RegionVisitorMonth, RegionVisitorTrend as Trend } from '../../api/placeApi';

const GROUPS = ['local', 'outsider', 'foreigner'] as const;
type Group = (typeof GROUPS)[number];

const UI = {
  ko: {
    title: '방문 추이',
    groups: { local: '현지인', outsider: '외지인', foreigner: '외국인' } as Record<Group, string>,
    unit: '명',
    note: (latest: string) => `월별 방문자 수(추정) · 다 받은 달만 · ${latest}까지 공개`,
    source: '출처: 한국관광공사 빅데이터 서비스(지역별 방문자 수)',
  },
  en: {
    title: 'Visitor trend',
    groups: { local: 'Locals', outsider: 'From other regions', foreigner: 'Foreigners' } as Record<Group, string>,
    unit: '',
    note: (latest: string) => `Monthly visitors (estimated) · complete months only · published through ${latest}`,
    source: 'Source: Korea Tourism Organization Big Data Service (visitors by region)',
  },
} as const;

const total = (m: RegionVisitorMonth) => m.local + m.outsider + m.foreigner;

function monthLabel(month: string, lang: PlaceLang): string {
  const [y, mm] = month.split('-').map(Number);
  if (lang === 'ko') return `${y}년 ${mm}월`;
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * 지역 허브 「방문 추이」 — 다 받은 달의 월 합계를 현지인·외지인·외국인 쌓은 막대로 그린다.
 * 막대 높이는 그 기간 가장 큰 달 대비다. 값은 막대마다 aria-label 로 읽힌다(그림만으로 수를 전하지 않는다).
 */
export default function RegionVisitorTrend({ trend, lang }: { trend: Trend; lang: PlaceLang }) {
  const T = UI[lang];
  const locale = lang === 'en' ? 'en' : 'ko';
  const max = Math.max(...trend.months.map(total), 1);
  const pct = (n: number, of: number) => `${Math.round((n / of) * 1000) / 10}%`;
  const fmt = (n: number) => `${n.toLocaleString(locale)}${T.unit}`;

  return (
    <section className="place-visitors" aria-label={T.title} data-place-section="REGION_VISITORS">
      <h2 className="place-subtitle">{T.title}</h2>
      <ul className="place-visitor-legend" aria-hidden>
        {GROUPS.map((g) => (
          <li key={g} className={`place-visitor-key place-visitor-${g}`}>
            {T.groups[g]}
          </li>
        ))}
      </ul>
      <ol className="place-visitor-chart">
        {trend.months.map((m) => {
          const sum = total(m);
          const label = `${monthLabel(m.month, lang)} — ${GROUPS.map((g) => `${T.groups[g]} ${fmt(m[g])}`).join(' · ')}`;
          return (
            <li key={m.month} className="place-visitor-month" aria-label={label} title={label}>
              <div className="place-visitor-bar">
                <div className="place-visitor-stack" style={{ height: pct(sum, max) }}>
                  {GROUPS.map((g) => (
                    <span key={g} className={`place-visitor-seg place-visitor-${g}`} style={{ flexGrow: sum ? m[g] / sum : 0 }} />
                  ))}
                </div>
              </div>
              <span className="place-visitor-label" aria-hidden>
                {m.month.slice(5)}
              </span>
            </li>
          );
        })}
      </ol>
      {trend.latestDate && <p className="place-visitor-note">{T.note(trend.latestDate)}</p>}
      <p className="place-visitor-note">{T.source}</p>
    </section>
  );
}
