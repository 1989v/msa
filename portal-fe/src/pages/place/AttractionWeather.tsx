import type { PlaceLang, WeatherDay, WeatherHalf, WeatherOutlook } from '../../api/placeApi';

const UI = {
  ko: {
    title: (place: string) => `${place} 날씨`,
    note: (place: string) => `${place} 단위 예보입니다 — 이 장소 지점의 날씨가 아니라 ${place} 대표 지점 기준입니다.`,
    today: '오늘',
    tomorrow: '내일',
    am: '오전',
    pm: '오후',
    pop: '강수확률',
    min: '최저',
    max: '최고',
    source: '출처: 기상청 단기예보·중기예보',
    issued: (label: string, at: string) => `${label} ${at} 발표`,
    shortLabel: '단기',
    midLabel: '중기',
  },
  en: {
    title: (place: string) => `Weather in ${place}`,
    note: (place: string) => `District-level forecast for ${place} — not for this exact spot.`,
    today: 'Today',
    tomorrow: 'Tomorrow',
    am: 'AM',
    pm: 'PM',
    pop: 'Chance of rain',
    min: 'Low',
    max: 'High',
    source: 'Source: Korea Meteorological Administration (short-range and mid-range forecasts)',
    issued: (label: string, at: string) => `${label} issued ${at}`,
    shortLabel: 'Short-range',
    midLabel: 'Mid-range',
  },
} as const;

const SKY_EN: Record<string, string> = { 맑음: 'Clear', 구름많음: 'Mostly cloudy', 흐림: 'Cloudy' };
const PRECIPITATION_EN: Record<string, string> = { 비: 'rain', '비/눈': 'rain/snow', 눈: 'snow', 소나기: 'showers' };

/** 기상청 표현 → 영문. 모르는 표현은 원문 그대로 둔다(지어내지 않는다). */
export function skyLabel(sky: string, lang: PlaceLang): string {
  if (lang === 'ko') return sky;
  for (const [prefix, base] of [['구름많고 ', 'Mostly cloudy'], ['흐리고 ', 'Cloudy']] as const) {
    if (sky.startsWith(prefix)) {
      const rest = sky.slice(prefix.length);
      return `${base}, ${PRECIPITATION_EN[rest] ?? rest}`;
    }
  }
  return SKY_EN[sky] ?? sky;
}

function dayLabel(date: string, today: string, lang: PlaceLang): string {
  const L = UI[lang];
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return L.today;
  if (diff === 1) return L.tomorrow;
  const d = new Date(`${date}T00:00:00Z`);
  if (lang === 'ko') {
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
    return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekday})`;
  }
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** 발표 시각 `yyyy-MM-ddTHH:mm` → 「10월 2일 17:00」 · 「Oct 2, 17:00」. */
export function issuedAt(at: string, lang: PlaceLang): string {
  const [date, time] = at.split('T');
  const [, m, d] = date.split('-').map(Number);
  const hm = (time ?? '').slice(0, 5);
  if (lang === 'ko') return `${m}월 ${d}일 ${hm}`;
  const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' });
  return `${month} ${d}, ${hm}`;
}

function Half({ label, half, lang }: { label: string | null; half: WeatherHalf; lang: PlaceLang }) {
  const L = UI[lang];
  return (
    <span className="place-weather-half">
      {label && <span className="place-weather-half-label">{label}</span>}
      <span className="place-weather-sky">{skyLabel(half.sky, lang)}</span>
      {half.pop != null && (
        <span className="place-weather-pop" aria-label={`${L.pop} ${half.pop}%`}>
          {half.pop}%
        </span>
      )}
    </span>
  );
}

function Day({ day, today, lang }: { day: WeatherDay; today: string; lang: PlaceLang }) {
  const L = UI[lang];
  return (
    <li className="place-weather-day" data-weather-source={day.source}>
      <span className="place-weather-date">{dayLabel(day.date, today, lang)}</span>
      <span className="place-weather-halves">
        {day.allDay ? (
          <Half label={null} half={day.allDay} lang={lang} />
        ) : (
          <>
            {day.am && <Half label={L.am} half={day.am} lang={lang} />}
            {day.pm && <Half label={L.pm} half={day.pm} lang={lang} />}
          </>
        )}
      </span>
      <span className="place-weather-temp">
        {/* 원천에 없는 값(17시 발표의 오늘 최저 등)은 0 이 아니라 빈칸으로 둔다 */}
        <span aria-label={day.min != null ? `${L.min} ${day.min}°` : undefined}>{day.min != null ? `${day.min}°` : '–'}</span>
        {' / '}
        <span aria-label={day.max != null ? `${L.max} ${day.max}°` : undefined}>{day.max != null ? `${day.max}°` : '–'}</span>
      </span>
    </li>
  );
}

/**
 * 관광지 상세 「○○구 날씨」 — 오늘 ~ 10일(단기: 글피까지, 중기: 그 뒤). 시군구 단위 예보임을 제목과 안내로 밝힌다.
 * 기상청 자료는 공공누리 제1유형이라 출처와 발표 시각을 절 안에 함께 적는다. 서버 렌더 본문에는 넣지 않는다.
 * 날이 하나도 없으면(신선도 기준을 넘겼거나 매핑이 없는 시군구) 절을 그리지 않는다.
 */
export default function AttractionWeather({
  outlook,
  place,
  today,
  lang,
}: {
  outlook: WeatherOutlook;
  place: string;
  today: string;
  lang: PlaceLang;
}) {
  const L = UI[lang];
  const days = outlook.days.filter((d) => d.date >= today);
  if (days.length === 0) return null;
  const issued = [
    outlook.shortBaseAt && L.issued(L.shortLabel, issuedAt(outlook.shortBaseAt, lang)),
    outlook.midTmFc && L.issued(L.midLabel, issuedAt(outlook.midTmFc, lang)),
  ].filter(Boolean);
  return (
    <section className="place-detail-info place-weather" aria-label={L.title(place)} data-place-section="weather">
      <h2 className="place-detail-info-title">{L.title(place)}</h2>
      <p className="place-weather-note">{L.note(place)}</p>
      <ul className="place-weather-list">
        {days.map((d) => (
          <Day key={d.date} day={d} today={today} lang={lang} />
        ))}
      </ul>
      <p className="place-weather-source">
        {L.source}
        {issued.length > 0 && ` · ${issued.join(' · ')}`}
      </p>
    </section>
  );
}
