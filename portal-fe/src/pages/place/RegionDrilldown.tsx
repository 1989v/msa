import { useQuery } from '@tanstack/react-query';
import { fetchAdminRegions, type AdminRegion, type PlaceLang } from '../../api/placeApi';
import { nearestRegion } from './googleMaps';

/**
 * 시도 → 시군구 드릴다운 (ADR-0071 §3).
 *
 * 사람이 여행지를 고르는 순서는 키워드가 아니라 지역이다 — "제주"나 "강릉"을 먼저 정하고
 * 그 안에서 고른다. 건수는 **관광 분류만** 센다(음식·쇼핑까지 세면 "제주 12,000곳"이 나온다).
 *
 * 좌표가 있으면 그 위치의 시도를 **맨 앞으로 올리기만** 한다 — 자동으로 고르지 않는다.
 * 지금 있는 곳이 곧 가려는 곳은 아니다.
 */
const UI = {
  ko: { all: '전체', sido: '지역 선택', loading: '지역을 불러오는 중…', near: '현재 위치' },
  en: { all: 'All', sido: 'Choose a region', loading: 'Loading regions…', near: 'Near you' },
} as const;

function label(region: AdminRegion, lang: PlaceLang): string {
  return (lang === 'en' && region.nameEn) || region.name;
}

export default function RegionDrilldown({
  lang,
  sidoCode,
  sigunguCode,
  origin,
  onChange,
}: {
  lang: PlaceLang;
  sidoCode: string | null;
  sigunguCode: string | null;
  origin?: { lat: number; lng: number } | null;
  onChange: (next: { sidoCode: string | null; sigunguCode: string | null; region?: AdminRegion }) => void;
}) {
  const L = UI[lang];

  const { data: sidos, isLoading } = useQuery({
    queryKey: ['admin-regions', 'SIDO', lang],
    queryFn: () => fetchAdminRegions({ level: 'SIDO', lang }),
    staleTime: 30 * 60_000,
  });

  const { data: sigungus } = useQuery({
    queryKey: ['admin-regions', 'SIGUNGU', sidoCode, lang],
    queryFn: () => fetchAdminRegions({ level: 'SIGUNGU', parent: sidoCode!, lang }),
    enabled: sidoCode != null,
    staleTime: 30 * 60_000,
  });

  if (isLoading) return <span className="place-region-hint">{L.loading}</span>;
  // 자료가 없으면 호출자가 이전 축을 계속 쓴다 (같은 쿼리 키를 보고 판단한다)
  if (!sidos || sidos.length === 0) return null;

  const nearCode = origin ? (nearestRegion(sidos, origin.lat, origin.lng)?.code ?? null) : null;
  // 가까운 시도를 맨 앞으로. 정렬만 바꾸고 선택은 사용자가 한다.
  const ordered = nearCode
    ? [...sidos].sort((a, b) => Number(b.code === nearCode) - Number(a.code === nearCode))
    : sidos;

  const selectedSido = sidoCode ? sidos.find((s) => s.code === sidoCode) : null;
  const shown = selectedSido ? (sigungus ?? []) : ordered;

  return (
    <div className="place-region" aria-label={L.sido}>
      <div className="place-region-crumbs">
        <button
          type="button"
          className={`place-chip ${sidoCode == null ? 'active' : ''}`}
          onClick={() => onChange({ sidoCode: null, sigunguCode: null })}
        >
          {L.all}
        </button>
        {selectedSido && (
          <>
            <span className="place-region-sep" aria-hidden="true">›</span>
            <button
              type="button"
              className={`place-chip ${sigunguCode == null ? 'active' : ''}`}
              onClick={() => onChange({ sidoCode: selectedSido.code, sigunguCode: null, region: selectedSido })}
            >
              {label(selectedSido, lang)}
            </button>
          </>
        )}
      </div>

      <div className="place-region-list">
        {shown.map((region) => {
          const active = region.level === 'SIGUNGU' && region.code === sigunguCode;
          return (
            <button
              key={region.code}
              type="button"
              className={`place-chip ${active ? 'active' : ''}`}
              onClick={() =>
                onChange(
                  region.level === 'SIDO'
                    ? { sidoCode: region.code, sigunguCode: null, region }
                    : { sidoCode: region.parentCode, sigunguCode: region.code.slice(2), region },
                )
              }
            >
              {region.code === nearCode && <span className="place-region-near">{L.near}</span>}
              {label(region, lang)}
              {region.attractionCount != null && (
                <span className="place-region-count">{region.attractionCount.toLocaleString()}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
