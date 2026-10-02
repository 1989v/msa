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

/** 카드 머리 두 줄 — 「오늘 / 10.3 토」 · 「10.5 / 월」 */
function dayLabel(date: string, today: string, lang: PlaceLang): { main: string; sub: string } {
  const L = UI[lang];
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const d = new Date(`${date}T00:00:00Z`);
  if (lang === 'ko') {
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
    const md = `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
    if (diff === 0) return { main: L.today, sub: `${md} ${weekday}` };
    if (diff === 1) return { main: L.tomorrow, sub: `${md} ${weekday}` };
    return { main: md, sub: weekday };
  }
  const weekday = d.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' });
  const md = d.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (diff === 0) return { main: L.today, sub: `${md} ${weekday}` };
  if (diff === 1) return { main: L.tomorrow, sub: `${md} ${weekday}` };
  return { main: md, sub: weekday };
}

type SkyIcon = 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'sleet' | 'shower';

/** 기상청 하늘 표현 → 아이콘. 강수가 붙으면 강수 쪽이 이긴다. 모르는 표현은 아이콘 없이 글자로 둔다. */
function skyIcon(sky: string): SkyIcon | null {
  if (sky.includes('비/눈') || sky.includes('빗방울눈날림')) return 'sleet';
  if (sky.includes('소나기')) return 'shower';
  if (sky.includes('눈')) return 'snow';
  if (sky.includes('비')) return 'rain';
  if (sky.startsWith('흐')) return 'cloudy';
  if (sky.startsWith('구름')) return 'partly';
  if (sky === '맑음') return 'clear';
  return null;
}

/** 선 아이콘 — 해는 황토, 비·눈은 강조 글자색, 구름은 글자색(토큰은 CSS 가 준다) */
function Icon({ kind }: { kind: SkyIcon }) {
  const cloud = 'M9 21h14a5.5 5.5 0 0 0 0-11 7.5 7.5 0 0 0-14 2.3A4.4 4.4 0 0 0 9 21z';
  return (
    <svg className="place-weather-icon" viewBox="0 0 32 32" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {kind === 'clear' && (
        <g className="sun">
          <circle cx="16" cy="16" r="6" />
          <path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" />
        </g>
      )}
      {kind === 'partly' && (
        <>
          <g className="sun">
            <circle cx="12" cy="11" r="4.5" />
            <path d="M12 2.5v2M3.5 11h2M5.9 4.9l1.4 1.4M18.1 4.9l-1.4 1.4" />
          </g>
          <path className="cloud" d="M10 27h13a5 5 0 0 0 0-10 7 7 0 0 0-13 2 4 4 0 0 0 0 8z" />
        </>
      )}
      {kind === 'cloudy' && <path className="cloud" d="M9 25h15a6 6 0 0 0 0-12 8 8 0 0 0-15 2.5A4.8 4.8 0 0 0 9 25z" />}
      {(kind === 'rain' || kind === 'shower' || kind === 'snow' || kind === 'sleet') && <path className="cloud" d={cloud} />}
      {kind === 'rain' && <path className="wet" d="M11 24l-1.5 4M17 24l-1.5 4M23 24l-1.5 4" />}
      {kind === 'shower' && <path className="wet" d="M13 24l-2 5M20 24l-2 5" />}
      {kind === 'snow' && <path className="wet" d="M11 26h.01M16 28h.01M21 26h.01M13.5 30h.01M18.5 30h.01" strokeWidth="2.6" />}
      {kind === 'sleet' && <path className="wet" d="M11 24l-1.5 4M21 24l-1.5 4M16 27h.01" strokeWidth="2.2" />}
    </svg>
  );
}

/** 강수확률이 이 값 이상이면 강조한다 — 우산을 챙길지 고민하는 선 */
const WET_POP = 40;

function Pop({ pop, lang }: { pop: number; lang: PlaceLang }) {
  return (
    <span className="place-weather-pop" data-wet={pop >= WET_POP || undefined} aria-label={`${UI[lang].pop} ${pop}%`}>
      <svg viewBox="0 0 12 12" aria-hidden>
        <path d="M6 1C6 1 2.5 5.2 2.5 7.5a3.5 3.5 0 0 0 7 0C9.5 5.2 6 1 6 1z" fill="currentColor" />
      </svg>
      {pop}%
    </span>
  );
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
  const icon = skyIcon(half.sky);
  const sky = skyLabel(half.sky, lang);
  return (
    <span className="place-weather-half" data-one={label == null || undefined}>
      {label && <span className="place-weather-half-label">{label}</span>}
      {icon ? <Icon kind={icon} /> : null}
      {/* 하늘 표현은 아이콘이 대신 보이고 글자는 읽기 도구용으로 남긴다. 아이콘이 없는 표현은 글자를 그대로 보인다 */}
      <span className={icon ? 'place-weather-sky place-sr-only' : 'place-weather-sky'}>{sky}</span>
      {half.pop != null && <Pop pop={half.pop} lang={lang} />}
    </span>
  );
}

/** 좁은 화면 요약 — 하루 하나. 강수확률이 높은 쪽(같으면 강수 표현이 있는 쪽, 그다음 오후)을 고른다 */
function summaryHalf(day: WeatherDay): WeatherHalf | null {
  if (day.allDay) return day.allDay;
  const halves = [day.pm, day.am].filter((h): h is WeatherHalf => h != null);
  if (halves.length === 0) return null;
  const wet = (h: WeatherHalf) => (['rain', 'shower', 'snow', 'sleet'].includes(skyIcon(h.sky) ?? '') ? 1 : 0);
  return [...halves].sort((a, b) => (b.pop ?? -1) - (a.pop ?? -1) || wet(b) - wet(a))[0];
}

function Day({ day, today, lang }: { day: WeatherDay; today: string; lang: PlaceLang }) {
  const L = UI[lang];
  const label = dayLabel(day.date, today, lang);
  const summary = summaryHalf(day);
  const summaryIcon = summary ? skyIcon(summary.sky) : null;
  return (
    <li className="place-weather-day" data-weather-source={day.source} data-today={label.main === L.today || undefined}>
      <span className="place-weather-date">
        <span className="place-weather-date-main">{label.main}</span>
        <span className="place-weather-date-sub">{label.sub}</span>
      </span>
      {/* 넓은 화면 — 오전·오후 따로 */}
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
      {/* 좁은 화면 — 아이콘 하나와 강수확률 하나(위 칸과 같은 값의 요약이라 읽기 도구에는 숨긴다) */}
      {summary && (
        <span className="place-weather-summary" aria-hidden>
          {summaryIcon ? <Icon kind={summaryIcon} /> : <span className="place-weather-sky">{skyLabel(summary.sky, lang)}</span>}
          {summary.pop != null && <Pop pop={summary.pop} lang={lang} />}
        </span>
      )}
      <span className="place-weather-temp">
        {/* 원천에 없는 값(17시 발표의 오늘 최저 등)은 0 이 아니라 빈칸으로 둔다 */}
        <span className="place-weather-min" aria-label={day.min != null ? `${L.min} ${day.min}°` : undefined}>{day.min != null ? `${day.min}°` : '–'}</span>
        {' / '}
        <span className="place-weather-max" aria-label={day.max != null ? `${L.max} ${day.max}°` : undefined}>{day.max != null ? `${day.max}°` : '–'}</span>
      </span>
    </li>
  );
}

/**
 * 관광지 상세 「○○구 날씨」 — 오늘 ~ 10일(단기: 글피까지, 중기: 그 뒤)을 날짜별 카드로. 넓은 화면은 한 줄에
 * 다 들어가고 오전·오후 아이콘을 따로, 좁은 화면은 하루 아이콘 하나로 줄여 옆으로 넘긴다. 시군구 단위 예보임을 제목과 안내로 밝힌다.
 * 기상청 자료는 공공누리 제1유형이라 출처와 발표 시각을 절 안에 함께 적는다. 서버 렌더 본문에는 넣지 않는다.
 * 날이 하나도 없으면(신선도 기준을 넘겼거나 매핑이 없는 시군구) 절을 그리지 않는다.
 */
export default function AttractionWeather({
  outlook,
  place,
  today,
  lang,
  showTitle = true,
}: {
  outlook: WeatherOutlook;
  place: string;
  today: string;
  lang: PlaceLang;
  /** 탭 안에서는 탭 이름이 제목을 대신한다 */
  showTitle?: boolean;
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
      {showTitle && <h2 className="place-detail-info-title">{L.title(place)}</h2>}
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
