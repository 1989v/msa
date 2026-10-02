import { useState } from 'react';
import type { AirQuality, CongestionDay, PlaceLang, WeatherOutlook } from '../../api/placeApi';
import AttractionAir, { MAX_STATION_KM, nearestStation } from './AttractionAir';
import AttractionCongestion from './AttractionCongestion';
import AttractionWeather from './AttractionWeather';

type Tab = 'weather' | 'air' | 'congestion';

const UI = {
  ko: { title: '날씨 · 대기질 · 혼잡', tab: { weather: '날씨', air: '대기질', congestion: '혼잡도' } as Record<Tab, string> },
  en: { title: 'Weather · Air · Crowds', tab: { weather: 'Weather', air: 'Air quality', congestion: 'Crowds' } as Record<Tab, string> },
} as const;

/**
 * 날씨 · 대기질 · 혼잡 예측을 탭 하나로 묶는다 — 셋을 쌓으면 상세의 한가운데를 화면 여러 장만큼 차지했다.
 * 그릴 것이 있는 탭만 둔다(각 절이 스스로 숨는 조건과 같은 조건). 하나도 없으면 묶음 자체가 없다.
 */
export default function AttractionConditions({
  weather,
  place,
  air,
  congestion,
  latitude,
  longitude,
  today,
  lang,
}: {
  weather: WeatherOutlook | undefined;
  place: string;
  air: AirQuality | undefined;
  congestion: CongestionDay[] | null | undefined;
  latitude: number | null;
  longitude: number | null;
  today: string;
  lang: PlaceLang;
}) {
  const L = UI[lang];
  const nearest = air && latitude != null && longitude != null ? nearestStation(air.stations, latitude, longitude) : null;
  const has: Record<Tab, boolean> = {
    weather: !!weather && weather.days.some((d) => d.date >= today),
    air: !!nearest && nearest.km <= MAX_STATION_KM && !!nearest.station.measurement,
    congestion: !!congestion && congestion.some((d) => d.date >= today),
  };
  const tabs = (['weather', 'air', 'congestion'] as const).filter((t) => has[t]);
  const [picked, setPicked] = useState<Tab>('weather');
  if (tabs.length === 0) return null;
  const current = tabs.includes(picked) ? picked : tabs[0];
  return (
    <section className="place-conditions" aria-label={L.title} data-place-section="conditions">
      <div className="place-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            type="button"
            role="tab"
            key={t}
            className="place-tab"
            aria-selected={t === current}
            onClick={() => setPicked(t)}
          >
            {L.tab[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="place-conditions-panel">
        {current === 'weather' && weather && (
          <AttractionWeather outlook={weather} place={place} today={today} lang={lang} showTitle={false} />
        )}
        {current === 'air' && air && (
          <AttractionAir air={air} latitude={latitude} longitude={longitude} lang={lang} showTitle={false} />
        )}
        {current === 'congestion' && congestion && (
          <AttractionCongestion days={congestion} today={today} lang={lang} showTitle={false} />
        )}
      </div>
    </section>
  );
}
