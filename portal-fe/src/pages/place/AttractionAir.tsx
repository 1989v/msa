import type { AirPollutant, AirQuality, PlaceLang } from '../../api/placeApi';
import { MAX_STATION_KM, nearestStation } from './airStation';
import { issuedAt } from './forecastTime';
import { distanceLabel } from './placeAttributes';

const UI = {
  ko: {
    title: '대기질',
    station: (name: string, distance: string) => `${name} 측정소 · 이 장소에서 ${distance}`,
    pm10: '미세먼지(PM10)',
    pm25: '초미세먼지(PM2.5)',
    grade: { '1': '좋음', '2': '보통', '3': '나쁨', '4': '매우나쁨' } as Record<string, string>,
    source: '출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료',
    measured: (at: string) => `${at} 측정`,
  },
  en: {
    title: 'Air quality',
    station: (name: string, distance: string) => `${name} station · ${distance} from here`,
    pm10: 'Fine dust (PM10)',
    pm25: 'Ultrafine dust (PM2.5)',
    grade: { '1': 'Good', '2': 'Moderate', '3': 'Unhealthy', '4': 'Very unhealthy' } as Record<string, string>,
    source: 'Source: AirKorea (Korea Environment Corporation) — real-time measurements, not yet validated',
    measured: (at: string) => `measured ${at}`,
  },
} as const;

/** 원천 값이 수가 아니면(「-」 · 빈칸) 값이 없는 것이다. 0 으로 채우지 않는다. */
function hasValue(value: string | null): value is string {
  return value != null && /^\d+(\.\d+)?$/.test(value.trim());
}

function Row({ label, pollutant, lang }: { label: string; pollutant: AirPollutant; lang: PlaceLang }) {
  const L = UI[lang];
  const grade = pollutant.grade ? L.grade[pollutant.grade] : undefined;
  return (
    <li className="place-air-row" data-air-grade={pollutant.grade ?? undefined}>
      <span className="place-air-label">{label}</span>
      {pollutant.flag ? (
        // 점검·통신장애 등 — 값 대신 원천 표시를 그대로
        <span className="place-air-flag">{pollutant.flag}</span>
      ) : (
        <>
          {grade && <span className="place-air-grade">{grade}</span>}
          <span className="place-air-value">{hasValue(pollutant.value) ? `${pollutant.value.trim()}㎍/㎥` : '–'}</span>
        </>
      )}
    </li>
  );
}

/**
 * 관광지 상세 「대기질」 — 이 장소에서 가장 가까운 측정소 하나의 실시간 측정(에어코리아).
 * 공공누리 제3유형(변경금지)이라 원천 값·등급을 그대로 쓰고(여러 측정소를 섞지 않는다), 출처 · 측정소 이름 · 측정 시각을 함께 적는다.
 * 서버 렌더 본문에는 넣지 않는다. 후보가 없거나 · 가장 가까운 측정소에 측정이 없거나(3시간 초과는 서버가 뺀다) ·
 * 그 측정소가 [MAX_STATION_KM] 를 넘게 멀면 절을 그리지 않는다 — 더 먼 측정소로 넘어가지 않는다.
 */
export default function AttractionAir({
  air,
  latitude,
  longitude,
  lang,
  showTitle = true,
}: {
  air: AirQuality;
  latitude: number | null;
  longitude: number | null;
  lang: PlaceLang;
  showTitle?: boolean;
}) {
  const L = UI[lang];
  if (latitude == null || longitude == null) return null;
  const nearest = nearestStation(air.stations, latitude, longitude);
  if (!nearest || nearest.km > MAX_STATION_KM || !nearest.station.measurement) return null;
  const { station, km } = nearest;
  const measurement = nearest.station.measurement;
  return (
    <section className="place-detail-info place-air" aria-label={L.title} data-place-section="air">
      {showTitle && <h2 className="place-detail-info-title">{L.title}</h2>}
      <p className="place-air-station">{L.station(station.name, distanceLabel(Math.round(km * 1000)))}</p>
      <ul className="place-air-list">
        <Row label={L.pm10} pollutant={measurement.pm10} lang={lang} />
        <Row label={L.pm25} pollutant={measurement.pm25} lang={lang} />
      </ul>
      <p className="place-air-source">
        {L.source} · {L.measured(issuedAt(measurement.dataTime, lang))}
      </p>
    </section>
  );
}
