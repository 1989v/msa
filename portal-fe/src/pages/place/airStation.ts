import type { AirStation } from '../../api/placeApi';
import { haversineKm } from './googleMaps';

/**
 * 가장 가까운 측정소가 이보다 멀면 절을 그리지 않는다 — 그 측정값을 이 장소의 대기라고 보기 어렵다.
 * 2026-10-02 실측(운영 국문 관광지 48,725곳 → 672곳 중 최근접): 중앙값 2.2km · 90% 11.1km · 95% 14.5km · 20km 초과 1.7%.
 */
export const MAX_STATION_KM = 20;

/** 후보 가운데 이 장소에서 가장 가까운 측정소와 거리(km). 후보가 시군구 관광지마다의 최근접을 다 품으므로 전국 최근접과 같다. */
export function nearestStation(stations: AirStation[], latitude: number, longitude: number): { station: AirStation; km: number } | null {
  let best: { station: AirStation; km: number } | null = null;
  for (const station of stations) {
    const km = haversineKm(latitude, longitude, station.latitude, station.longitude);
    if (!best || km < best.km) best = { station, km };
  }
  return best;
}
