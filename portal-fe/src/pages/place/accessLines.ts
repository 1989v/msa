import type { AttractionAccess, AttractionAccessStop, PlaceLang } from '../../api/placeApi';

/*
 * 「가까운 역·정류장」 문구 — 화면(AttractionAccess)과 search 서버 렌더(`AttractionPageRenderer` 의 access 절)가 같은 줄을 낸다.
 * 두 쪽이 같은지는 accessLinesGolden.test.ts 가 쓴 골든을 Kotlin `AttractionAccessParityTest` 가 대조한다.
 *
 * 거리는 하버사인 직선거리다 — 모든 거리 앞에 「직선거리」를 쓰고 도보 시간은 내지 않는다(길 경로 자료가 없다).
 */

export const ACCESS_COPY = {
  ko: {
    title: '가까운 역·정류장',
    directions: '대중교통 길찾기',
    distance: '직선거리',
    busStop: '버스정류장',
    busNoData: '이 지역은 버스정류장 위치 자료가 없습니다',
    note: '직선거리이며 실제 걷는 길은 더 깁니다',
    asOf: (date: string) => `자료 기준일 ${date}`,
    source: '출처',
    railSource: '국가철도공단 도시철도 역사정보',
    busSource: '국토교통부 전국 버스정류장 위치정보',
  },
  en: {
    title: 'Nearby stations and stops',
    directions: 'Transit directions',
    distance: 'straight-line',
    busStop: 'Bus stop',
    busNoData: 'No bus stop data for this area',
    note: 'Straight-line distance; the actual walk is longer',
    asOf: (date: string) => `Data as of ${date}`,
    source: 'Source',
    railSource: 'Korea National Railway urban rail station information',
    busSource: 'Ministry of Land, Infrastructure and Transport nationwide bus stop locations',
  },
} as const;

/** 999m · 1.0km — 1,000m 부터 km, 소수 첫째 자리(반올림)까지. */
export function accessDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  const tenths = Math.round(meters / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10}km`;
}

/** 원천 역명이 「역」으로 끝나면 그대로, 아니면 「역」을 붙인다(「서울역」 → 「서울역」, 「시청」 → 「시청역」). */
function koStationName(name: string): string {
  return name.endsWith('역') ? name : `${name}역`;
}

/** 영문 노선 — 「1·4호선」 → 「Line 1·4」. 번호 노선이 아니면 원천 표기 그대로. */
function enLines(lines: string): string {
  const numbered = /^(\d+(?:·\d+)*)호선$/.exec(lines);
  return numbered ? `Line ${numbered[1]}` : lines;
}

function stopLine(stop: AttractionAccessStop, lang: PlaceLang): string {
  const C = ACCESS_COPY[lang];
  const distance = `${C.distance} ${accessDistance(stop.distanceM)}`;
  if (stop.kind === 'BUS') {
    return lang === 'en' ? `${C.busStop} ${stop.name} · ${distance}` : `${stop.name} ${C.busStop} · ${distance}`;
  }
  const name = lang === 'en' && stop.nameEn?.trim() ? stop.nameEn.trim() : koStationName(stop.name);
  const lines = stop.lines?.trim() ? ` (${lang === 'en' ? enLines(stop.lines.trim()) : stop.lines.trim()})` : '';
  return `${name}${lines} · ${distance}`;
}

export interface AccessView {
  /** 역 → 정류장 줄. 버스 원천 미연계면 정류장 자리에 안내 한 줄 */
  items: string[];
  /** 「직선거리이며 … · 자료 기준일 {가장 늦은 날}」 — 줄이 없으면 null */
  note: string | null;
  /** 출처 줄 — 실린 원천만 */
  source: string;
}

/** 보일 것이 없으면(줄 없음 + 미연계 아님) null — 절을 숨긴다. */
export function accessView(access: AttractionAccess | null | undefined, lang: PlaceLang = 'ko'): AccessView | null {
  if (!access) return null;
  const C = ACCESS_COPY[lang];
  const rail = access.stops.filter((s) => s.kind === 'RAIL');
  const bus = access.stops.filter((s) => s.kind === 'BUS');
  const busNoData = access.busCovered === false;
  if (rail.length === 0 && bus.length === 0 && !busNoData) return null;

  const items = [...rail.map((s) => stopLine(s, lang)), ...(busNoData ? [C.busNoData] : bus.map((s) => stopLine(s, lang)))];
  const shown = busNoData ? rail : [...rail, ...bus];
  const latest = shown.map((s) => s.baseDate).filter((d): d is string => !!d).sort().pop();
  const note = shown.length === 0 ? null : latest ? `${C.note} · ${C.asOf(latest)}` : C.note;
  const sources = [...(rail.length > 0 ? [C.railSource] : []), ...(bus.length > 0 || busNoData ? [C.busSource] : [])];
  return { items, note, source: `${C.source}: ${sources.join(' · ')}` };
}
